import { buildFamilyGraph, type FamilyGraph } from '../../utils/buildTree'
import { CARD_WIDTH } from '../PersonCard/PersonCardMini'
import type { Person, Relationship, LayoutNode, LayoutLink, FamilyGroup, GroupChild } from '../../types'

const GENERATION_GAP = 300
const SIBLING_GAP = 250
const PARTNER_GAP = 160
const FAMILY_GROUP_GAP = 100
const MAX_RESOLVE_ITERATIONS = 10
const CHILD_GAP = 40
const GROUP_PADDING = 20

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
  let currentGenPersons = [startPersonId]
  let generation = 1

  while (currentGenPersons.length > 0) {
    const genY = -generation * GENERATION_GAP

    const couples: { parentIds: string[]; childId: string }[] = []

    for (const personId of currentGenPersons) {
      const node = graph.get(personId)
      if (!node) continue

      const parentIds = node.parentIds.filter(id => !visited.has(id))
      if (parentIds.length === 0) continue

      couples.push({ parentIds, childId: personId })
    }

    if (couples.length === 0) break

    const nextGenPersons: string[] = []

    for (const { parentIds, childId } of couples) {
      const childNode = nodes.get(childId)
      if (!childNode) continue

      // Place siblings of childId horizontally at same y, spreading in direction
      // Check ALL parents for children (not just the first) to find half-siblings too
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
        const sibX = childNode.x + (j + 1) * SIBLING_GAP * direction
        placeNode(sibId, sibX, childNode.y, graph, nodes)
        visited.add(sibId)
      })

      // Center parent couple above the entire children row
      const allChildrenX = [childNode.x, ...siblings.map(sibId => nodes.get(sibId)!.x)]
      const minX = Math.min(...allChildrenX)
      const maxX = Math.max(...allChildrenX)
      const centerX = (minX + maxX) / 2

      // Place parents (must happen before adding links to siblings)
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

        nextGenPersons.push(parentIds[0], parentIds[1])
      } else {
        // Single parent found — check if they have an unvisited partner
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

          // Add parent-child link from partner if they are also a parent
          const partnerNode = graph.get(unvisitedPartner)
          if (partnerNode?.childIds.includes(childId)) {
            addLink(nodes, unvisitedPartner, childId, 'parent-child')
          }

          nextGenPersons.push(parentIds[0], unvisitedPartner)
        } else {
          placeNode(parentIds[0], centerX, genY, graph, nodes)
          visited.add(parentIds[0])
          placedParentIds.push(parentIds[0])
          addLink(nodes, parentIds[0], childId, 'parent-child')
          nextGenPersons.push(parentIds[0])
        }
      }

      // Now add parent-child links from parents to siblings (parents are placed now)
      for (const sibId of siblings) {
        for (const pid of placedParentIds) {
          const parentGraphNode = graph.get(pid)
          if (parentGraphNode?.childIds.includes(sibId)) {
            addLink(nodes, pid, sibId, 'parent-child')
          }
        }
      }
    }

    currentGenPersons = nextGenPersons
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

// --- Group-based tree building ---

export interface GroupTreeResult {
  center: FamilyGroup
  ancestorGroups: Map<string, FamilyGroup>
}

/**
 * BFS from descendantId upward through parentIds.
 * Returns true if personId is found as an ancestor of descendantId.
 */
export function isAncestorOf(
  graph: FamilyGraph,
  personId: string,
  descendantId: string,
): boolean {
  const visited = new Set<string>()
  const queue = [descendantId]
  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)
    const node = graph.get(current)
    if (!node) continue
    for (const pid of node.parentIds) {
      if (pid === personId) return true
      queue.push(pid)
    }
  }
  return false
}

/**
 * Build a recursive FamilyGroup tree starting from the center couple,
 * expanding UPWARD through ancestors.
 *
 * Returns the center group and a map from personId to their parent's FamilyGroup.
 * ancestorGroups.get('jens') = the group where Jens's parents are the parents
 * (i.e., Per+Laila group, with Jens as a backbone child).
 */
export function buildGroupTree(
  graph: FamilyGraph,
  centerId: string,
): GroupTreeResult {
  const ancestorGroups = new Map<string, FamilyGroup>()
  const visited = new Set<string>()

  const centerNode = graph.get(centerId)
  if (!centerNode) {
    return {
      center: { parents: [centerId], children: [], width: 0, height: 0, x: 0, y: 0 },
      ancestorGroups,
    }
  }

  // Build center group: centerId + their partner
  const partnerId = centerNode.partnerIds[0] ?? null
  const centerParents = partnerId ? [centerId, partnerId] : [centerId]
  centerParents.forEach(id => visited.add(id))

  // Center group's children (the center couple's actual children)
  const centerChildIds = collectChildIds(centerParents, graph)
  const centerChildren: GroupChild[] = Array.from(centerChildIds)
    .filter(id => !visited.has(id))
    .map(id => {
      visited.add(id)
      return { type: 'leaf' as const, personId: id }
    })

  const centerGroup: FamilyGroup = {
    parents: centerParents,
    children: centerChildren,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
  }

  // Build ancestor groups for each person in the center couple
  const centerCoupleIds = new Set(centerParents)
  for (const personId of centerParents) {
    buildAncestorGroup(personId, centerId, centerCoupleIds, graph, visited, ancestorGroups)
  }

  return { center: centerGroup, ancestorGroups }
}

/**
 * Recursively calculate the width of each FamilyGroup, bottom-up.
 * Children are calculated first so their widths are available when computing the parent group.
 * Mutates the `width` field on the group and all nested groups.
 */
export function calculateGroupWidths(group: FamilyGroup): void {
  // Bottom-up: calculate children first
  for (const child of group.children) {
    if ((child.type === 'subgroup' || child.type === 'backbone') && child.group) {
      calculateGroupWidths(child.group)
    }
  }

  const parentRowWidth = group.parents.length >= 2
    ? PARTNER_GAP + CARD_WIDTH + CARD_MARGIN
    : CARD_WIDTH + CARD_MARGIN

  const childWidths = group.children.map(c =>
    c.type === 'leaf' ? CARD_WIDTH + CARD_MARGIN : c.group.width
  )
  const childrenRowWidth = childWidths.length > 0
    ? childWidths.reduce((s, w) => s + w, 0) + (childWidths.length - 1) * CHILD_GAP
    : 0

  group.width = Math.max(parentRowWidth, childrenRowWidth) + 2 * GROUP_PADDING
}

/**
 * Collect all child IDs for a set of parents (union of all their childIds).
 */
function collectChildIds(parentIds: string[], graph: FamilyGraph): Set<string> {
  const childIds = new Set<string>()
  for (const pid of parentIds) {
    const node = graph.get(pid)
    if (node) {
      for (const cid of node.childIds) {
        childIds.add(cid)
      }
    }
  }
  return childIds
}

/**
 * Recursively build ancestor groups for a person.
 * Creates a FamilyGroup for the person's parents and stores it in ancestorGroups
 * keyed by the person's ID.
 */
function buildAncestorGroup(
  personId: string,
  centerId: string,
  centerCoupleIds: Set<string>,
  graph: FamilyGraph,
  visited: Set<string>,
  ancestorGroups: Map<string, FamilyGroup>,
): void {
  const node = graph.get(personId)
  if (!node) return

  const parentIds = node.parentIds
  if (parentIds.length === 0) return

  // Build the parent couple: find all parents + their partners
  const groupParents = new Set<string>()
  for (const pid of parentIds) {
    groupParents.add(pid)
    // Include the partner of each parent if they exist
    const parentNode = graph.get(pid)
    if (parentNode) {
      for (const partnerId of parentNode.partnerIds) {
        // Only include partner if they are also a parent of one of the same children
        // or if they are a partner of an already-included parent
        if (!visited.has(partnerId)) {
          groupParents.add(partnerId)
        }
      }
    }
  }

  // Mark all group parents as visited
  const groupParentIds = Array.from(groupParents)
  groupParentIds.forEach(id => visited.add(id))

  // Collect all children of this parent couple
  const allChildIds = collectChildIds(groupParentIds, graph)

  // Classify each child
  const children: GroupChild[] = []
  for (const childId of allChildIds) {
    // Skip if this child is one of the group parents (shouldn't happen, but safety)
    if (groupParents.has(childId)) continue

    // A child is backbone if they are in the center couple or are an ancestor of centerId
    const isBackboneChild =
      centerCoupleIds.has(childId) || isAncestorOf(graph, childId, centerId)

    if (isBackboneChild) {
      // Backbone child: they connect this group toward center.
      // Build their downstream group (where they are a parent).
      const backboneGroup = buildBackboneChildGroup(childId, graph, visited)
      children.push({ type: 'backbone', personId: childId, group: backboneGroup })
      visited.add(childId)
    } else {
      // Check if child has their own children (subgroup) or is a leaf
      const childNode = graph.get(childId)
      const hasChildren = childNode ? childNode.childIds.length > 0 : false

      if (hasChildren) {
        // Subgroup: single parent (or with partner) who has children
        visited.add(childId)
        const subgroup = buildSubgroup(childId, graph, visited)
        children.push({ type: 'subgroup', personId: childId, group: subgroup })
      } else {
        visited.add(childId)
        children.push({ type: 'leaf', personId: childId })
      }
    }
  }

  const parentGroup: FamilyGroup = {
    parents: groupParentIds,
    children,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
  }

  // Store: ancestorGroups.get(personId) = their parent's group
  ancestorGroups.set(personId, parentGroup)

  // Recurse: for each parent in the group, build their ancestor groups
  for (const pid of groupParentIds) {
    if (!ancestorGroups.has(pid)) {
      buildAncestorGroup(pid, centerId, centerCoupleIds, graph, visited, ancestorGroups)
    }
  }
}

/**
 * Build a placeholder FamilyGroup for a backbone child.
 * This represents the group where the backbone person is a PARENT.
 * The actual content is determined by what's already been built closer to center.
 */
function buildBackboneChildGroup(
  personId: string,
  graph: FamilyGraph,
  visited: Set<string>,
): FamilyGroup {
  const node = graph.get(personId)
  if (!node) {
    return { parents: [personId], children: [], width: 0, height: 0, x: 0, y: 0 }
  }

  // The backbone person's group includes them and their partner
  const groupParents = [personId]
  for (const partnerId of node.partnerIds) {
    if (!visited.has(partnerId)) {
      groupParents.push(partnerId)
    }
  }

  // Children of this backbone person (that aren't already visited)
  const childIds = collectChildIds(groupParents, graph)
  const children: GroupChild[] = Array.from(childIds)
    .filter(id => !visited.has(id) && !groupParents.includes(id))
    .map(id => {
      visited.add(id)
      return { type: 'leaf' as const, personId: id }
    })

  return {
    parents: groupParents,
    children,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
  }
}

/**
 * Build a FamilyGroup for a subgroup child (someone with children but not backbone).
 * E.g., Birgitta who has son Hampus but no partner and is not an ancestor of center.
 */
function buildSubgroup(
  personId: string,
  graph: FamilyGraph,
  visited: Set<string>,
): FamilyGroup {
  const node = graph.get(personId)
  if (!node) {
    return { parents: [personId], children: [], width: 0, height: 0, x: 0, y: 0 }
  }

  // Include partner if they have one and aren't visited
  const groupParents = [personId]
  for (const partnerId of node.partnerIds) {
    if (!visited.has(partnerId)) {
      groupParents.push(partnerId)
      visited.add(partnerId)
    }
  }

  // Collect children
  const childIds = collectChildIds(groupParents, graph)
  const children: GroupChild[] = Array.from(childIds)
    .filter(id => !visited.has(id) && !groupParents.includes(id))
    .map(id => {
      visited.add(id)
      // Recursively check if this child is also a subgroup
      const childNode = graph.get(id)
      if (childNode && childNode.childIds.length > 0) {
        const subgroup = buildSubgroup(id, graph, visited)
        return { type: 'subgroup' as const, personId: id, group: subgroup }
      }
      return { type: 'leaf' as const, personId: id }
    })

  return {
    parents: groupParents,
    children,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
  }
}
