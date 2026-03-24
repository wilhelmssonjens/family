import { buildFamilyGraph, type FamilyGraph, type FamilyUnit } from '../../utils/buildTree'
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

// --- Constants ---

const GENERATION_GAP = 250
const PARTNER_GAP = 160
const CARD_MARGIN = 20
const CHILD_GAP = 60
const CARD_SLOT = CARD_WIDTH + CARD_MARGIN     // 160px
const COUPLE_SLOT = PARTNER_GAP + CARD_WIDTH   // 300px

// --- Phase 1: Build tree structure with calculated widths ---

interface DescendantNode {
  personId: string
  partnerId: string | null
  children: DescendantNode[]
  width: number
}

interface Branch {
  coupleIds: string[]
  backboneChildId: string
  siblings: DescendantNode[]
  parentBranches: Branch[]   // one per parent in coupleIds (index-aligned)
}

function buildDescendantTree(
  graph: FamilyGraph,
  personId: string,
  visited: Set<string>,
): DescendantNode {
  const node = graph.get(personId)
  const partnerId = node?.partnerIds.find(id => !visited.has(id)) ?? null
  if (partnerId) visited.add(partnerId)

  const childIds = node?.childIds.filter(id => !visited.has(id)) ?? []
  childIds.forEach(id => visited.add(id))

  const children = childIds.map(cid => buildDescendantTree(graph, cid, visited))

  const selfWidth = partnerId ? COUPLE_SLOT : CARD_SLOT
  const childrenWidth = children.length > 0
    ? children.reduce((s, c) => s + c.width, 0) + (children.length - 1) * CHILD_GAP
    : 0
  const width = Math.max(selfWidth, childrenWidth)

  return { personId, partnerId, children, width }
}

function buildBranch(
  graph: FamilyGraph,
  personId: string,
  visited: Set<string>,
): Branch | null {
  const node = graph.get(personId)
  if (!node) return null

  const parentIds = node.parentIds.filter(id => !visited.has(id))
  if (parentIds.length === 0) return null

  // Resolve parent couple
  const coupleIds = [...parentIds]
  for (const pid of parentIds) {
    const parentNode = graph.get(pid)
    if (parentNode) {
      for (const partnerId of parentNode.partnerIds) {
        if (!visited.has(partnerId) && !coupleIds.includes(partnerId)) {
          coupleIds.push(partnerId)
        }
      }
    }
  }
  coupleIds.forEach(id => visited.add(id))

  // Find siblings
  const allChildIds = new Set<string>()
  for (const pid of coupleIds) {
    const pNode = graph.get(pid)
    if (pNode) pNode.childIds.forEach(cid => allChildIds.add(cid))
  }

  const siblingIds = Array.from(allChildIds)
    .filter(id => id !== personId && !visited.has(id))
  siblingIds.forEach(id => visited.add(id))

  const siblings = siblingIds.map(sid => buildDescendantTree(graph, sid, visited))

  // Recurse upward — one branch per parent in coupleIds (index-aligned)
  const parentBranches = coupleIds.map(pid => buildBranch(graph, pid, visited))

  return { coupleIds, backboneChildId: personId, siblings, parentBranches }
}

// --- Phase 2: Place nodes ---

export function computeTreeLayout(
  persons: Person[],
  relationships: Relationship[],
  centerId: string,
): LayoutNode[] {
  const graph = buildFamilyGraph(persons, relationships)
  const visited = new Set<string>()

  const centerNode = graph.get(centerId)
  if (!centerNode) return []
  const centerPartnerId = centerNode.partnerIds[0]

  visited.add(centerId)
  if (centerPartnerId) visited.add(centerPartnerId)

  // Build branches
  const leftBranch = buildBranch(graph, centerId, visited)
  const rightBranch = centerPartnerId ? buildBranch(graph, centerPartnerId, visited) : null

  // Place each side independently (at x=0, will shift later)
  const leftNodes = new Map<string, LayoutNode>()
  emit(leftNodes, centerId, 0, 0, graph)
  if (leftBranch) {
    placeBranch(leftBranch, 0, 0, -1, leftNodes, graph)
  }

  const rightNodes = new Map<string, LayoutNode>()
  if (centerPartnerId) {
    emit(rightNodes, centerPartnerId, 0, 0, graph)
    if (rightBranch) {
      placeBranch(rightBranch, 0, 0, +1, rightNodes, graph)
    }
  }

  // Place center couple's children (if any)
  const centerChildIds: string[] = []
  for (const pid of [centerId, centerPartnerId].filter(Boolean) as string[]) {
    const n = graph.get(pid)
    if (n) n.childIds.forEach(c => { if (!visited.has(c)) centerChildIds.push(c) })
  }

  // Measure each side's extent toward center
  const leftMaxX = Math.max(0, ...Array.from(leftNodes.values()).map(n => n.x))
  const rightMinX = Math.min(0, ...Array.from(rightNodes.values()).map(n => n.x))

  // Calculate shifts so the two sides don't overlap
  const minSeparation = CARD_SLOT + CHILD_GAP // 220px between closest cards of the two sides
  const leftShift = -(leftMaxX + minSeparation / 2)
  const rightShift = -rightMinX + minSeparation / 2

  // Apply shifts and merge into final node set
  const nodes = new Map<string, LayoutNode>()

  for (const [id, node] of leftNodes) {
    node.x += leftShift
    nodes.set(id, node)
  }

  for (const [id, node] of rightNodes) {
    node.x += rightShift
    nodes.set(id, node)
  }

  // Add partner link between center couple
  if (centerPartnerId) {
    addLink(nodes, centerId, centerPartnerId, 'partner')
  }

  // Place center children (below center, centered between the two sides)
  if (centerChildIds.length > 0) {
    const centerX = 0 // midpoint
    const childTrees = centerChildIds.map(cid => {
      visited.add(cid)
      return buildDescendantTree(graph, cid, visited)
    })
    const totalWidth = childTrees.reduce((s, c) => s + c.width, 0)
      + (childTrees.length - 1) * CHILD_GAP
    let cx = centerX - totalWidth / 2
    for (const child of childTrees) {
      const childCx = cx + child.width / 2
      placeDescendantTree(child, childCx, GENERATION_GAP, nodes, graph)
      addLink(nodes, centerId, child.personId, 'parent-child')
      cx += child.width + CHILD_GAP
    }
  }

  return Array.from(nodes.values())
}

/**
 * Place a branch: siblings at backboneY spreading in direction,
 * couple above centered, then each parent recurses with OPPOSITE
 * directions so their families diverge naturally.
 */
function placeBranch(
  branch: Branch,
  backboneX: number,
  backboneY: number,
  direction: number,
  nodes: Map<string, LayoutNode>,
  graph: FamilyGraph,
): void {
  // 1. Place siblings at backboneY, spreading in direction
  let x = backboneX
  const sibXs: number[] = []

  for (const sib of branch.siblings) {
    x += direction * (CHILD_GAP + sib.width / 2)
    sibXs.push(x)
    placeDescendantTree(sib, x, backboneY, nodes, graph)
    x += direction * sib.width / 2
  }

  // 2. Place couple above, centered over backbone + siblings
  const allChildX = [backboneX, ...sibXs]
  const coupleCenter = (Math.min(...allChildX) + Math.max(...allChildX)) / 2
  const parentY = backboneY - GENERATION_GAP

  if (branch.coupleIds.length >= 2) {
    emit(nodes, branch.coupleIds[0], coupleCenter - PARTNER_GAP / 2, parentY, graph)
    emit(nodes, branch.coupleIds[1], coupleCenter + PARTNER_GAP / 2, parentY, graph)
    addLink(nodes, branch.coupleIds[0], branch.coupleIds[1], 'partner')
  } else {
    emit(nodes, branch.coupleIds[0], coupleCenter, parentY, graph)
  }

  // 3. Parent-child links
  for (const parentId of branch.coupleIds) {
    const fn = graph.get(parentId)
    if (!fn) continue
    if (fn.childIds.includes(branch.backboneChildId)) {
      addLink(nodes, parentId, branch.backboneChildId, 'parent-child')
    }
    for (const sib of branch.siblings) {
      if (fn.childIds.includes(sib.personId)) {
        addLink(nodes, parentId, sib.personId, 'parent-child')
      }
    }
  }

  // 4. Recurse: each parent's ancestors spread in alternating directions.
  //    Parent at index 0 keeps `direction`, parent at index 1 gets `-direction`.
  //    This ensures Per's family fans one way and Laila's family fans the other.
  for (let i = 0; i < branch.coupleIds.length; i++) {
    const pb = branch.parentBranches[i]
    if (!pb) continue
    const parentNode = nodes.get(pb.backboneChildId)
    if (!parentNode) continue
    const parentDir = i === 0 ? direction : -direction
    placeBranch(pb, parentNode.x, parentY, parentDir, nodes, graph)
  }
}

function placeDescendantTree(
  tree: DescendantNode,
  x: number,
  y: number,
  nodes: Map<string, LayoutNode>,
  graph: FamilyGraph,
): void {
  if (tree.partnerId) {
    emit(nodes, tree.personId, x - PARTNER_GAP / 2, y, graph)
    emit(nodes, tree.partnerId, x + PARTNER_GAP / 2, y, graph)
    addLink(nodes, tree.personId, tree.partnerId, 'partner')
  } else {
    emit(nodes, tree.personId, x, y, graph)
  }

  if (tree.children.length === 0) return

  const childY = y + GENERATION_GAP
  const totalWidth = tree.children.reduce((s, c) => s + c.width, 0)
    + (tree.children.length - 1) * CHILD_GAP
  let childX = x - totalWidth / 2

  for (const child of tree.children) {
    const cx = childX + child.width / 2
    placeDescendantTree(child, cx, childY, nodes, graph)

    addLink(nodes, tree.personId, child.personId, 'parent-child')
    if (tree.partnerId) {
      const pfn = graph.get(tree.partnerId)
      if (pfn?.childIds.includes(child.personId)) {
        addLink(nodes, tree.partnerId, child.personId, 'parent-child')
      }
    }

    childX += child.width + CHILD_GAP
  }
}

// --- Helpers ---

function emit(
  nodes: Map<string, LayoutNode>,
  personId: string,
  x: number,
  y: number,
  graph: FamilyGraph,
): void {
  if (nodes.has(personId)) return
  const familyNode = graph.get(personId)
  if (!familyNode) return
  nodes.set(personId, { personId, person: familyNode.person, x, y, links: [] })
}

function addLink(
  nodes: Map<string, LayoutNode>,
  fromId: string,
  toId: string,
  type: LayoutLink['type'],
): void {
  const from = nodes.get(fromId)
  if (from) {
    from.links.push({ targetId: toId, type })
  }
}

// --- Measure pass ---

/**
 * Build lookup maps from familyUnits for quick person → unit lookups.
 */
export function buildFamilyLookups(familyUnits: FamilyUnit[]): {
  unitsAsParent: Map<string, FamilyUnit[]>
  unitsAsChild: Map<string, FamilyUnit[]>
} {
  const unitsAsParent = new Map<string, FamilyUnit[]>()
  const unitsAsChild = new Map<string, FamilyUnit[]>()

  for (const unit of familyUnits) {
    for (const parentId of unit.parentIds) {
      let list = unitsAsParent.get(parentId)
      if (!list) {
        list = []
        unitsAsParent.set(parentId, list)
      }
      list.push(unit)
    }
    for (const childId of unit.childIds) {
      let list = unitsAsChild.get(childId)
      if (!list) {
        list = []
        unitsAsChild.set(childId, list)
      }
      list.push(unit)
    }
  }

  return { unitsAsParent, unitsAsChild }
}

/**
 * Measure the subtree width of a single person.
 *
 * - If the person has NO families where they are a parent → CARD_SLOT (one card slot).
 * - If the person has families → return the MAX width across all their families.
 * - Uses `visited` set to prevent infinite recursion (cycle protection).
 */
export function measurePerson(
  personId: string,
  unitsAsParent: Map<string, FamilyUnit[]>,
  measuredWidths: Map<string, number>,
  visited: Set<string>,
): number {
  if (visited.has(personId)) return CARD_SLOT
  visited.add(personId)

  const families = unitsAsParent.get(personId)
  if (!families || families.length === 0) {
    return CARD_SLOT
  }

  let maxWidth = 0
  for (const family of families) {
    const w = measureFamily(family.id, family, unitsAsParent, measuredWidths, visited)
    if (w > maxWidth) maxWidth = w
  }

  return maxWidth
}

/**
 * Measure the width of a single FamilyUnit.
 *
 * parentBlockWidth:
 *   1 parent  → CARD_SLOT (160)
 *   2 parents → PARTNER_GAP + CARD_WIDTH + CARD_MARGIN (320)
 *
 * If no children → parentBlockWidth
 * Otherwise → max(parentBlockWidth, sum(childWidths) + CHILD_GAP * (childCount - 1))
 */
export function measureFamily(
  familyId: string,
  familyUnit: FamilyUnit | undefined,
  unitsAsParent: Map<string, FamilyUnit[]>,
  measuredWidths: Map<string, number>,
  visited: Set<string>,
): number {
  // Return cached result if available
  const cached = measuredWidths.get(familyId)
  if (cached !== undefined) return cached

  if (!familyUnit) return CARD_SLOT

  const parentCount = familyUnit.parentIds.length
  const parentBlockWidth = parentCount === 1
    ? CARD_SLOT
    : PARTNER_GAP + CARD_WIDTH + CARD_MARGIN

  if (familyUnit.childIds.length === 0) {
    measuredWidths.set(familyId, parentBlockWidth)
    return parentBlockWidth
  }

  const childWidths = familyUnit.childIds.map(childId =>
    measurePerson(childId, unitsAsParent, measuredWidths, visited)
  )
  const childrenTotal = childWidths.reduce((sum, w) => sum + w, 0)
    + CHILD_GAP * (familyUnit.childIds.length - 1)

  const width = Math.max(parentBlockWidth, childrenTotal)
  measuredWidths.set(familyId, width)
  return width
}

/**
 * Measure all family units and return a map of familyUnitId → measured width.
 * This is the top-level entry point for the measure pass.
 */
export function measureAllFamilies(
  familyUnits: FamilyUnit[],
): Map<string, number> {
  const { unitsAsParent } = buildFamilyLookups(familyUnits)
  const measuredWidths = new Map<string, number>()
  const visited = new Set<string>()

  for (const unit of familyUnits) {
    if (!measuredWidths.has(unit.id)) {
      measureFamily(unit.id, unit, unitsAsParent, measuredWidths, visited)
    }
  }

  return measuredWidths
}

// --- Generation assignment ---

/**
 * Assign a generation level to every person reachable from the center person.
 * Center = 0, parents = -1, grandparents = -2, children = +1, etc.
 * Partners always share the same generation.
 * BFS ensures consistent, shortest-path assignment.
 */
export function assignGenerations(
  centerPersonId: string,
  familyUnits: FamilyUnit[],
): Map<string, number> {
  const generations = new Map<string, number>()
  generations.set(centerPersonId, 0)

  // Build lookup indexes: person → units where they are a parent, person → units where they are a child
  const unitsAsParent = new Map<string, FamilyUnit[]>()
  const unitsAsChild = new Map<string, FamilyUnit[]>()

  for (const unit of familyUnits) {
    for (const parentId of unit.parentIds) {
      let list = unitsAsParent.get(parentId)
      if (!list) {
        list = []
        unitsAsParent.set(parentId, list)
      }
      list.push(unit)
    }
    for (const childId of unit.childIds) {
      let list = unitsAsChild.get(childId)
      if (!list) {
        list = []
        unitsAsChild.set(childId, list)
      }
      list.push(unit)
    }
  }

  const queue: string[] = [centerPersonId]

  while (queue.length > 0) {
    const personId = queue.shift()!
    const personGen = generations.get(personId)!

    // Units where this person is a PARENT: children get gen+1, co-parents get same gen
    const parentUnits = unitsAsParent.get(personId) ?? []
    for (const unit of parentUnits) {
      for (const childId of unit.childIds) {
        if (!generations.has(childId)) {
          generations.set(childId, personGen + 1)
          queue.push(childId)
        }
      }
      for (const coParentId of unit.parentIds) {
        if (coParentId !== personId && !generations.has(coParentId)) {
          generations.set(coParentId, personGen)
          queue.push(coParentId)
        }
      }
    }

    // Units where this person is a CHILD: parents get gen-1, siblings get same gen
    const childUnits = unitsAsChild.get(personId) ?? []
    for (const unit of childUnits) {
      for (const parentId of unit.parentIds) {
        if (!generations.has(parentId)) {
          generations.set(parentId, personGen - 1)
          queue.push(parentId)
        }
      }
      for (const siblingId of unit.childIds) {
        if (siblingId !== personId && !generations.has(siblingId)) {
          generations.set(siblingId, personGen)
          queue.push(siblingId)
        }
      }
    }
  }

  return generations
}
