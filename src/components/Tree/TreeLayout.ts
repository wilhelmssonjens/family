import { buildFamilyGraph, type FamilyGraph } from '../../utils/buildTree'
import { CARD_WIDTH } from '../PersonCard/PersonCardMini'
import type { Person, Relationship } from '../../types'

export interface LayoutLink {
  targetId: string
  type: 'partner' | 'parent-child'
}

export interface LayoutNode {
  personId: string
  person: Person
  x: number
  y: number
  links: LayoutLink[]
}

const GENERATION_GAP = 300
const SIBLING_GAP = 250
const PARTNER_GAP = 160
const FAMILY_GROUP_GAP = 100
const MAX_RESOLVE_ITERATIONS = 10

/**
 * Vertical bottom-up tree layout with generation-based rows.
 *
 * Y-axis = generations (negative y = older). Each generation gets a fixed y-row.
 * X-axis = siblings spread horizontally within a generation.
 *
 * Center couple at y=0. Ancestors go upward (negative y).
 * Jens ancestors spread left, Klara ancestors spread right.
 * Siblings are placed in a horizontal row at the same y-level.
 */
export function computeTreeLayout(
  persons: Person[],
  relationships: Relationship[],
  centerId: string,
): LayoutNode[] {
  const graph = buildFamilyGraph(persons, relationships)
  const nodes = new Map<string, LayoutNode>()
  const visited = new Set<string>()

  const centerNode = graph.get(centerId)
  if (!centerNode) return []

  const centerPartnerId = centerNode.partnerIds[0]

  // Place center couple
  placeNode(centerId, -PARTNER_GAP / 2, 0, graph, nodes)
  visited.add(centerId)

  if (centerPartnerId) {
    placeNode(centerPartnerId, PARTNER_GAP / 2, 0, graph, nodes)
    visited.add(centerPartnerId)
    addLink(nodes, centerId, centerPartnerId, 'partner')
  }

  // Expand ancestors: left for centerId, right for partner
  expandAncestorsByGeneration(centerId, -1, graph, nodes, visited)
  if (centerPartnerId) {
    expandAncestorsByGeneration(centerPartnerId, 1, graph, nodes, visited)
  }

  // Place children of center couple below
  const allChildIds = new Set<string>()
  for (const id of [centerId, centerPartnerId].filter(Boolean) as string[]) {
    const n = graph.get(id)
    if (n) n.childIds.forEach(c => allChildIds.add(c))
  }
  const children = Array.from(allChildIds).filter(id => !visited.has(id))
  children.forEach((childId, i) => {
    const xOffset = (i - (children.length - 1) / 2) * SIBLING_GAP
    placeNode(childId, xOffset, GENERATION_GAP, graph, nodes)
    visited.add(childId)
    addLink(nodes, centerId, childId, 'parent-child')
  })

  // Place unvisited partners next to their already-placed partner
  placeUnvisitedPartners(graph, nodes, visited)

  // Place descendants of non-center persons (e.g. Hampus, child of Birgitta)
  placeDescendants(graph, nodes, visited)

  // Spread siblings apart based on subtree widths (bottom-up)
  spreadBySubtreeWidth(nodes, graph)

  // Resolve any overlapping cards with parent re-centering
  resolveOverlaps(nodes, graph, centerId)

  return Array.from(nodes.values())
}

/**
 * BFS expansion of ancestors, generation by generation.
 * Each generation gets a fixed y-row (negative = older).
 * Siblings spread horizontally in the direction of their family side.
 */
function expandAncestorsByGeneration(
  startPersonId: string,
  direction: number,
  graph: FamilyGraph,
  nodes: Map<string, LayoutNode>,
  visited: Set<string>,
) {
  // Each person carries their own sibling-spread direction.
  // Partners in a couple spread their siblings in OPPOSITE directions
  // so paternal and maternal branches don't overlap.
  let currentGen: { personId: string; dir: number }[] = [{ personId: startPersonId, dir: direction }]
  let generation = 1

  while (currentGen.length > 0) {
    const genY = -generation * GENERATION_GAP

    const couples: { parentIds: string[]; childId: string; sibDir: number }[] = []

    for (const { personId, dir } of currentGen) {
      const node = graph.get(personId)
      if (!node) continue

      const parentIds = node.parentIds.filter(id => !visited.has(id))
      if (parentIds.length === 0) continue

      couples.push({ parentIds, childId: personId, sibDir: dir })
    }

    if (couples.length === 0) break

    const nextGen: { personId: string; dir: number }[] = []

    for (const { parentIds, childId, sibDir } of couples) {
      const childNode = nodes.get(childId)
      if (!childNode) continue

      // Place siblings of childId horizontally, spreading in sibDir
      const siblingIds = new Set<string>()
      for (const pid of parentIds) {
        const parent = graph.get(pid)
        if (parent) {
          for (const cid of parent.childIds) {
            if (cid !== childId && !visited.has(cid)) {
              siblingIds.add(cid)
            }
          }
        }
      }
      const siblings = Array.from(siblingIds)

      siblings.forEach((sibId, j) => {
        const sibX = childNode.x + (j + 1) * SIBLING_GAP * sibDir
        placeNode(sibId, sibX, childNode.y, graph, nodes)
        visited.add(sibId)
      })

      // Center parent couple above the entire children row
      const allChildrenX = [childNode.x, ...siblings.map(sibId => nodes.get(sibId)!.x)]
      const minX = Math.min(...allChildrenX)
      const maxX = Math.max(...allChildrenX)
      const centerX = (minX + maxX) / 2

      // Place parents
      const placedParentIds: string[] = []
      if (parentIds.length >= 2) {
        placeNode(parentIds[0], centerX - PARTNER_GAP / 2, genY, graph, nodes)
        placeNode(parentIds[1], centerX + PARTNER_GAP / 2, genY, graph, nodes)
        visited.add(parentIds[0])
        visited.add(parentIds[1])
        placedParentIds.push(parentIds[0], parentIds[1])

        addLink(nodes, parentIds[0], parentIds[1], 'partner')
        addLink(nodes, parentIds[0], childId, 'parent-child')
        addLink(nodes, parentIds[1], childId, 'parent-child')

        // First parent keeps same direction, second parent gets flipped direction
        nextGen.push({ personId: parentIds[0], dir: sibDir })
        nextGen.push({ personId: parentIds[1], dir: -sibDir })
      } else {
        const singleParent = graph.get(parentIds[0])
        const unvisitedPartner = singleParent?.partnerIds.find(id => !visited.has(id))

        if (unvisitedPartner) {
          placeNode(parentIds[0], centerX - PARTNER_GAP / 2, genY, graph, nodes)
          placeNode(unvisitedPartner, centerX + PARTNER_GAP / 2, genY, graph, nodes)
          visited.add(parentIds[0])
          visited.add(unvisitedPartner)
          placedParentIds.push(parentIds[0], unvisitedPartner)

          addLink(nodes, parentIds[0], unvisitedPartner, 'partner')
          addLink(nodes, parentIds[0], childId, 'parent-child')

          const partnerNode = graph.get(unvisitedPartner)
          if (partnerNode?.childIds.includes(childId)) {
            addLink(nodes, unvisitedPartner, childId, 'parent-child')
          }

          nextGen.push({ personId: parentIds[0], dir: sibDir })
          nextGen.push({ personId: unvisitedPartner, dir: -sibDir })
        } else {
          placeNode(parentIds[0], centerX, genY, graph, nodes)
          visited.add(parentIds[0])
          placedParentIds.push(parentIds[0])
          addLink(nodes, parentIds[0], childId, 'parent-child')
          nextGen.push({ personId: parentIds[0], dir: sibDir })
        }
      }

      // Add parent-child links from parents to siblings
      for (const sibId of siblings) {
        for (const pid of placedParentIds) {
          const parentGraphNode = graph.get(pid)
          if (parentGraphNode?.childIds.includes(sibId)) {
            addLink(nodes, pid, sibId, 'parent-child')
          }
        }
      }
    }

    currentGen = nextGen
    generation++
  }
}

/**
 * Find all placed nodes whose partners are not yet placed,
 * and place those partners beside them.
 */
function placeUnvisitedPartners(
  graph: FamilyGraph,
  nodes: Map<string, LayoutNode>,
  visited: Set<string>,
) {
  for (const [personId, layoutNode] of nodes) {
    const familyNode = graph.get(personId)
    if (!familyNode) continue

    for (const partnerId of familyNode.partnerIds) {
      if (visited.has(partnerId)) continue

      const partnerX = layoutNode.x + PARTNER_GAP
      placeNode(partnerId, partnerX, layoutNode.y, graph, nodes)
      visited.add(partnerId)
      addLink(nodes, personId, partnerId, 'partner')

      // Also add parent-child links from the partner to children already placed
      const partnerFamilyNode = graph.get(partnerId)
      if (partnerFamilyNode) {
        for (const childId of partnerFamilyNode.childIds) {
          if (nodes.has(childId)) {
            addLink(nodes, partnerId, childId, 'parent-child')
          }
        }
      }
    }
  }
}

/**
 * Place children of already-placed persons who haven't been visited yet.
 * This handles descendants of non-center persons (e.g. Hampus, child of Birgitta).
 * Iterates until no new nodes are placed.
 */
function placeDescendants(
  graph: FamilyGraph,
  nodes: Map<string, LayoutNode>,
  visited: Set<string>,
) {
  let placedNew = true
  while (placedNew) {
    placedNew = false
    for (const [personId, layoutNode] of Array.from(nodes)) {
      const familyNode = graph.get(personId)
      if (!familyNode) continue

      const unplacedChildren = familyNode.childIds.filter(id => !visited.has(id))
      if (unplacedChildren.length === 0) continue

      const childY = layoutNode.y + GENERATION_GAP
      unplacedChildren.forEach((childId, i) => {
        const childX = layoutNode.x + (i - (unplacedChildren.length - 1) / 2) * SIBLING_GAP
        placeNode(childId, childX, childY, graph, nodes)
        visited.add(childId)
        addLink(nodes, personId, childId, 'parent-child')
        placedNew = true
      })
    }
  }
}

/**
 * Spread siblings apart proportionally to their subtree widths.
 * Bottom-up: calculate how wide each person's descendant tree is.
 * Top-down: redistribute children's x-positions so wider subtrees get more space.
 */
function spreadBySubtreeWidth(
  nodes: Map<string, LayoutNode>,
  graph: FamilyGraph,
) {
  const nodeIds = Array.from(nodes.keys())
  const leafWidth = CARD_WIDTH + CARD_MARGIN // 160px per person (partners placed separately)

  // Bottom-up: calculate subtree width for each placed node
  const subtreeWidth = new Map<string, number>()

  function getSubtreeWidth(personId: string): number {
    if (subtreeWidth.has(personId)) return subtreeWidth.get(personId)!

    const familyNode = graph.get(personId)
    if (!familyNode) { subtreeWidth.set(personId, leafWidth); return leafWidth }

    // Only count children that are actually placed in the layout
    const placedChildren = familyNode.childIds.filter(id => nodes.has(id))
    if (placedChildren.length === 0) {
      subtreeWidth.set(personId, leafWidth)
      return leafWidth
    }

    const childrenTotalWidth = placedChildren.reduce(
      (sum, cid) => sum + getSubtreeWidth(cid), 0
    ) + (placedChildren.length - 1) * CHILD_GAP

    const width = Math.max(leafWidth, childrenTotalWidth)
    subtreeWidth.set(personId, width)
    return width
  }

  // Calculate all widths
  for (const id of nodeIds) {
    getSubtreeWidth(id)
  }

  // Top-down: for each parent with multiple placed children, redistribute x-positions
  const processed = new Set<string>()

  // Sort nodes by y (topmost first) so we process parents before children
  const sortedNodes = Array.from(nodes.values()).sort((a, b) => a.y - b.y)

  for (const parentNode of sortedNodes) {
    if (processed.has(parentNode.personId)) continue
    processed.add(parentNode.personId)

    const familyNode = graph.get(parentNode.personId)
    if (!familyNode) continue

    const placedChildren = familyNode.childIds.filter(id => nodes.has(id))
    if (placedChildren.length < 2) continue

    // Sort children by current x
    const childNodes = placedChildren
      .map(id => ({ id, node: nodes.get(id)!, width: subtreeWidth.get(id)! }))
      .sort((a, b) => a.node.x - b.node.x)

    // Calculate total width needed
    const totalWidth = childNodes.reduce((s, c) => s + c.width, 0)
      + (childNodes.length - 1) * CHILD_GAP

    // Center children around parent's x, distributed by subtree width
    let x = parentNode.x - totalWidth / 2

    for (const child of childNodes) {
      const newX = x + child.width / 2
      const dx = newX - child.node.x

      // Shift this child and ALL their descendants
      if (Math.abs(dx) > 1) {
        shiftSubtree(child.id, dx, nodes, graph)
      }

      x += child.width + CHILD_GAP
    }
  }
}

const CHILD_GAP = 40

/**
 * Shift a person and all their placed descendants by dx.
 */
function shiftSubtree(
  personId: string,
  dx: number,
  nodes: Map<string, LayoutNode>,
  graph: FamilyGraph,
) {
  const node = nodes.get(personId)
  if (!node) return
  node.x += dx

  // Also shift partner if they exist and are placed
  const familyNode = graph.get(personId)
  if (familyNode) {
    for (const partnerId of familyNode.partnerIds) {
      const partnerNode = nodes.get(partnerId)
      if (partnerNode && Math.abs(partnerNode.y - node.y) < 1) {
        partnerNode.x += dx
      }
    }

    // Recursively shift children
    for (const childId of familyNode.childIds) {
      if (nodes.has(childId)) {
        shiftSubtree(childId, dx, nodes, graph)
      }
    }
  }
}

const CARD_MARGIN = 20

/**
 * Iterative overlap resolution with family group spacing and parent re-centering.
 *
 * 1. Process rows bottom-to-top (children before parents)
 * 2. Group nodes on each row by family (shared parents / partners)
 * 3. Resolve overlaps within groups, add extra gap between groups
 * 4. Re-center parent couples above their children
 * 5. Repeat until stable (max MAX_RESOLVE_ITERATIONS)
 */
function resolveOverlaps(
  nodes: Map<string, LayoutNode>,
  graph: FamilyGraph,
  centerId: string,
) {
  const minSpacing = CARD_WIDTH + CARD_MARGIN

  for (let iteration = 0; iteration < MAX_RESOLVE_ITERATIONS; iteration++) {
    let anyMoved = false

    // Group nodes by y-row
    const rows = new Map<number, LayoutNode[]>()
    for (const node of nodes.values()) {
      const row = rows.get(node.y) ?? []
      row.push(node)
      rows.set(node.y, row)
    }

    // Process bottom-to-top (highest y first = children before parents)
    const sortedYs = Array.from(rows.keys()).sort((a, b) => b - a)

    for (const y of sortedYs) {
      const row = rows.get(y)!

      if (row.length >= 2) {
        // Identify family groups via union-find
        const groups = groupByFamily(row, graph)

        // Sort each group internally by x
        for (const group of groups) {
          group.sort((a, b) => a.x - b.x)
        }
        // Sort groups by leftmost node x
        groups.sort((a, b) => a[0].x - b[0].x)

        // Resolve within-group overlaps
        for (const group of groups) {
          if (group.length < 2) continue
          for (let i = 1; i < group.length; i++) {
            const gap = group[i].x - group[i - 1].x
            if (gap < minSpacing) {
              const shift = minSpacing - gap
              for (let j = i; j < group.length; j++) {
                group[j].x += shift
              }
              anyMoved = true
            }
          }
        }

        // Resolve between-group overlaps (with extra FAMILY_GROUP_GAP)
        for (let g = 1; g < groups.length; g++) {
          const prevRightmost = groups[g - 1][groups[g - 1].length - 1]
          const currLeftmost = groups[g][0]
          const requiredGap = minSpacing + FAMILY_GROUP_GAP
          const actualGap = currLeftmost.x - prevRightmost.x
          if (actualGap < requiredGap) {
            const shift = requiredGap - actualGap
            // Shift current and all subsequent groups
            for (let h = g; h < groups.length; h++) {
              for (const node of groups[h]) {
                node.x += shift
              }
            }
            anyMoved = true
          }
        }
      }

      // Re-center parent couples above this row's nodes
      if (recenterParentsOfRow(row, graph, nodes, centerId)) {
        anyMoved = true
      }
    }

    if (!anyMoved) break
  }
}

/**
 * Group nodes on the same row by family using union-find.
 * Nodes that share at least one parent, or are partners, form one group.
 */
function groupByFamily(row: LayoutNode[], graph: FamilyGraph): LayoutNode[][] {
  if (row.length === 0) return []

  // Union-find with path compression
  const uf = new Map<string, string>()

  function find(x: string): string {
    while (uf.get(x) !== x) {
      uf.set(x, uf.get(uf.get(x)!)!)
      x = uf.get(x)!
    }
    return x
  }

  function union(a: string, b: string) {
    const ra = find(a), rb = find(b)
    if (ra !== rb) uf.set(ra, rb)
  }

  for (const node of row) {
    uf.set(node.personId, node.personId)
  }

  // Union children of the same parent
  const parentToRowChildren = new Map<string, string[]>()
  for (const node of row) {
    const familyNode = graph.get(node.personId)
    if (!familyNode) continue
    for (const pid of familyNode.parentIds) {
      const list = parentToRowChildren.get(pid) ?? []
      list.push(node.personId)
      parentToRowChildren.set(pid, list)
    }
  }
  for (const children of parentToRowChildren.values()) {
    for (let i = 1; i < children.length; i++) {
      union(children[0], children[i])
    }
  }

  // Union partners on the same row
  const rowIds = new Set(row.map(n => n.personId))
  for (const node of row) {
    const familyNode = graph.get(node.personId)
    if (!familyNode) continue
    for (const partnerId of familyNode.partnerIds) {
      if (rowIds.has(partnerId)) {
        union(node.personId, partnerId)
      }
    }
  }

  // Collect groups
  const groupMap = new Map<string, LayoutNode[]>()
  for (const node of row) {
    const root = find(node.personId)
    const group = groupMap.get(root) ?? []
    group.push(node)
    groupMap.set(root, group)
  }

  return Array.from(groupMap.values())
}

/**
 * Re-center parent couples above their children on the given row.
 * Skips the center couple (they are the layout anchor).
 */
function recenterParentsOfRow(
  row: LayoutNode[],
  graph: FamilyGraph,
  nodes: Map<string, LayoutNode>,
  centerId: string,
): boolean {
  let moved = false
  const processedCouples = new Set<string>()

  // Determine the center couple IDs to skip
  const centerFamilyNode = graph.get(centerId)
  const centerCoupleIds = new Set<string>([centerId])
  if (centerFamilyNode) {
    for (const pid of centerFamilyNode.partnerIds) {
      centerCoupleIds.add(pid)
    }
  }

  for (const childNode of row) {
    const familyNode = graph.get(childNode.personId)
    if (!familyNode) continue

    const placedParentIds = familyNode.parentIds.filter(id => nodes.has(id))
    if (placedParentIds.length === 0) continue

    // Expand to include partner (the couple)
    const coupleIds = new Set(placedParentIds)
    for (const pid of placedParentIds) {
      const parentFamilyNode = graph.get(pid)
      if (parentFamilyNode) {
        for (const partnerId of parentFamilyNode.partnerIds) {
          if (nodes.has(partnerId)) coupleIds.add(partnerId)
        }
      }
    }

    const coupleKey = Array.from(coupleIds).sort().join('|')
    if (processedCouples.has(coupleKey)) continue
    processedCouples.add(coupleKey)

    // Skip the center couple — they are the anchor point
    if (Array.from(coupleIds).every(id => centerCoupleIds.has(id))) continue

    // Collect all placed children of this couple
    const allChildIds = new Set<string>()
    for (const pid of coupleIds) {
      const pFamilyNode = graph.get(pid)
      if (pFamilyNode) {
        for (const cid of pFamilyNode.childIds) {
          if (nodes.has(cid)) allChildIds.add(cid)
        }
      }
    }

    const childXs = Array.from(allChildIds).map(id => nodes.get(id)!.x)
    if (childXs.length === 0) continue

    const childCenterX = (Math.min(...childXs) + Math.max(...childXs)) / 2

    const parentNodes = Array.from(coupleIds).map(id => nodes.get(id)!).filter(Boolean)
    const parentCenterX = parentNodes.reduce((sum, p) => sum + p.x, 0) / parentNodes.length
    const delta = childCenterX - parentCenterX

    if (Math.abs(delta) > 0.5) {
      for (const p of parentNodes) {
        p.x += delta
      }
      moved = true
    }
  }

  return moved
}

function placeNode(
  personId: string,
  x: number,
  y: number,
  graph: FamilyGraph,
  nodes: Map<string, LayoutNode>,
) {
  const familyNode = graph.get(personId)
  if (!familyNode) return
  nodes.set(personId, { personId, person: familyNode.person, x, y, links: [] })
}

function addLink(
  nodes: Map<string, LayoutNode>,
  fromId: string,
  toId: string,
  type: LayoutLink['type'],
) {
  const from = nodes.get(fromId)
  if (from) {
    from.links.push({ targetId: toId, type })
  }
}
