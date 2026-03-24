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

// --- Constants ---

const GENERATION_GAP = 250
const PARTNER_GAP = 160
const CARD_MARGIN = 20
const CHILD_GAP = 60
const CARD_SLOT = CARD_WIDTH + CARD_MARGIN     // 160px — space for one card
const COUPLE_SLOT = PARTNER_GAP + CARD_WIDTH   // 300px — space for a couple

// --- Phase 1: Build tree structure with calculated widths ---

interface DescendantNode {
  personId: string
  partnerId: string | null
  children: DescendantNode[]
  width: number  // horizontal space needed for this person + all descendants
}

interface Branch {
  coupleIds: string[]           // parent couple at this level
  backboneChildId: string       // the child in the direct line to center
  siblings: DescendantNode[]    // other children (with descendant trees)
  parentBranches: Branch[]      // ancestor branches above (one per parent)
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

  // Width: bottom-up
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

  // Resolve the parent couple (find partner of first parent)
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

  // Find siblings (other children of this couple, not the backbone child)
  const allChildIds = new Set<string>()
  for (const pid of coupleIds) {
    const pNode = graph.get(pid)
    if (pNode) pNode.childIds.forEach(cid => allChildIds.add(cid))
  }

  const siblingIds = Array.from(allChildIds)
    .filter(id => id !== personId && !visited.has(id))
  siblingIds.forEach(id => visited.add(id))

  const siblings = siblingIds.map(sid => buildDescendantTree(graph, sid, visited))

  // Recurse upward for each parent
  const parentBranches = coupleIds
    .map(pid => buildBranch(graph, pid, visited))
    .filter((b): b is Branch => b !== null)

  return { coupleIds, backboneChildId: personId, siblings, parentBranches }
}

// --- Phase 2: Place nodes (top-down, recursive) ---

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

  // Mark center couple as visited
  visited.add(centerId)
  if (centerPartnerId) visited.add(centerPartnerId)

  // Build branches
  const leftBranch = buildBranch(graph, centerId, visited)
  const rightBranch = centerPartnerId
    ? buildBranch(graph, centerPartnerId, visited)
    : null

  // Calculate center gap: wide enough so branches don't overlap
  // Each branch's parents can extend ~PARTNER_GAP/2 inward from the backbone
  // With multiple generations, this compounds. Use a safe minimum.
  const branchInwardExtension = PARTNER_GAP / 2 + CARD_MARGIN
  const centerGap = Math.max(PARTNER_GAP, branchInwardExtension * 2 + CARD_SLOT)

  // Place center couple
  emit(nodes, centerId, -centerGap / 2, 0, graph)
  if (centerPartnerId) {
    emit(nodes, centerPartnerId, centerGap / 2, 0, graph)
    addLink(nodes, centerId, centerPartnerId, 'partner')
  }

  // Place center couple's children (if any, below center)
  const centerChildIds = new Set<string>()
  for (const pid of [centerId, centerPartnerId].filter(Boolean) as string[]) {
    const n = graph.get(pid)
    if (n) n.childIds.forEach(c => { if (!visited.has(c)) centerChildIds.add(c) })
  }
  if (centerChildIds.size > 0) {
    const centerChildren = Array.from(centerChildIds).map(cid => {
      visited.add(cid)
      return buildDescendantTree(graph, cid, visited)
    })
    const totalWidth = centerChildren.reduce((s, c) => s + c.width, 0)
      + (centerChildren.length - 1) * CHILD_GAP
    let x = -totalWidth / 2
    for (const child of centerChildren) {
      const cx = x + child.width / 2
      placeDescendantTree(child, cx, GENERATION_GAP, nodes, graph)
      addLink(nodes, centerId, child.personId, 'parent-child')
      x += child.width + CHILD_GAP
    }
  }

  // Place left branch (Jens side — direction -1)
  if (leftBranch) {
    placeBranch(leftBranch, -centerGap / 2, 0, -1, nodes, graph)
  }

  // Place right branch (Klara side — direction +1)
  if (rightBranch) {
    placeBranch(rightBranch, centerGap / 2, 0, +1, nodes, graph)
  }

  return Array.from(nodes.values())
}

function placeBranch(
  branch: Branch,
  backboneX: number,
  backboneY: number,
  direction: number, // -1 = left, +1 = right
  nodes: Map<string, LayoutNode>,
  graph: FamilyGraph,
): void {
  // 1. Place siblings at the same y as the backbone, spreading in direction
  let x = backboneX
  const siblingPositions: { personId: string; x: number }[] = []

  for (const sib of branch.siblings) {
    x += direction * (CHILD_GAP + sib.width / 2)
    siblingPositions.push({ personId: sib.personId, x })

    // Place this sibling and their descendants
    placeDescendantTree(sib, x, backboneY, nodes, graph)
    x += direction * sib.width / 2
  }

  // 2. Place parent couple above, centered over backbone + siblings
  const allChildrenX = [backboneX, ...siblingPositions.map(s => s.x)]
  const minX = Math.min(...allChildrenX)
  const maxX = Math.max(...allChildrenX)
  const coupleCenter = (minX + maxX) / 2
  const parentY = backboneY - GENERATION_GAP

  if (branch.coupleIds.length >= 2) {
    emit(nodes, branch.coupleIds[0], coupleCenter - PARTNER_GAP / 2, parentY, graph)
    emit(nodes, branch.coupleIds[1], coupleCenter + PARTNER_GAP / 2, parentY, graph)
    addLink(nodes, branch.coupleIds[0], branch.coupleIds[1], 'partner')
  } else {
    emit(nodes, branch.coupleIds[0], coupleCenter, parentY, graph)
  }

  // 3. Add parent-child links
  for (const parentId of branch.coupleIds) {
    const parentFamilyNode = graph.get(parentId)
    if (!parentFamilyNode) continue

    // Link to backbone child
    if (parentFamilyNode.childIds.includes(branch.backboneChildId)) {
      addLink(nodes, parentId, branch.backboneChildId, 'parent-child')
    }

    // Link to siblings
    for (const sib of branch.siblings) {
      if (parentFamilyNode.childIds.includes(sib.personId)) {
        addLink(nodes, parentId, sib.personId, 'parent-child')
      }
    }
  }

  // 4. Recurse for ancestor branches above
  for (const parentBranch of branch.parentBranches) {
    const parentNode = nodes.get(parentBranch.backboneChildId)
    if (!parentNode) {
      // The backbone child of the parent branch should be one of our coupleIds
      // Find their position
      const pos = nodes.get(parentBranch.backboneChildId)
      if (pos) {
        placeBranch(parentBranch, pos.x, parentY, direction, nodes, graph)
      }
    } else {
      placeBranch(parentBranch, parentNode.x, parentY, direction, nodes, graph)
    }
  }
}

function placeDescendantTree(
  tree: DescendantNode,
  x: number,
  y: number,
  nodes: Map<string, LayoutNode>,
  graph: FamilyGraph,
): void {
  // Place person (and partner if any)
  if (tree.partnerId) {
    emit(nodes, tree.personId, x - PARTNER_GAP / 2, y, graph)
    emit(nodes, tree.partnerId, x + PARTNER_GAP / 2, y, graph)
    addLink(nodes, tree.personId, tree.partnerId, 'partner')
  } else {
    emit(nodes, tree.personId, x, y, graph)
  }

  // Place children below, centered under the couple/person
  if (tree.children.length === 0) return

  const childY = y + GENERATION_GAP
  const totalWidth = tree.children.reduce((s, c) => s + c.width, 0)
    + (tree.children.length - 1) * CHILD_GAP
  let childX = x - totalWidth / 2

  for (const child of tree.children) {
    const cx = childX + child.width / 2
    placeDescendantTree(child, cx, childY, nodes, graph)

    // Parent-child links
    addLink(nodes, tree.personId, child.personId, 'parent-child')
    if (tree.partnerId) {
      const partnerFamilyNode = graph.get(tree.partnerId)
      if (partnerFamilyNode?.childIds.includes(child.personId)) {
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
  if (nodes.has(personId)) return // don't overwrite already-placed nodes
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
