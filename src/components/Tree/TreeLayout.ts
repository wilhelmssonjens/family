import { buildFamilyGraph, type FamilyGraph } from '../../utils/buildTree'
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

const HORIZONTAL_GAP = 320
const VERTICAL_GAP = 140
const PARTNER_GAP = 150

export function computeTreeLayout(
  persons: Person[],
  relationships: Relationship[],
  centerId: string,
): LayoutNode[] {
  const graph = buildFamilyGraph(persons, relationships)
  const nodes = new Map<string, LayoutNode>()
  const visited = new Set<string>()
  const occupiedSlots = new Map<number, number[]>()

  const centerNode = graph.get(centerId)
  if (!centerNode) return []

  const centerPartnerId = centerNode.partnerIds[0]

  placeNode(centerId, -PARTNER_GAP / 2, 0, graph, nodes)
  if (centerPartnerId) {
    placeNode(centerPartnerId, PARTNER_GAP / 2, 0, graph, nodes)
    addLink(nodes, centerId, centerPartnerId, 'partner')
  }
  visited.add(centerId)
  if (centerPartnerId) visited.add(centerPartnerId)

  expandAncestors(centerId, -1, graph, nodes, visited, occupiedSlots)

  if (centerPartnerId) {
    expandAncestors(centerPartnerId, 1, graph, nodes, visited, occupiedSlots)
  }

  const centerChildren = centerNode.childIds.filter(id => !visited.has(id))
  centerChildren.forEach((childId, i) => {
    const yOffset = (i - (centerChildren.length - 1) / 2) * VERTICAL_GAP
    placeNode(childId, 0, VERTICAL_GAP + yOffset, graph, nodes)
    visited.add(childId)
    addLink(nodes, centerId, childId, 'parent-child')
  })

  return Array.from(nodes.values())
}

function expandAncestors(
  personId: string,
  direction: number,
  graph: FamilyGraph,
  nodes: Map<string, LayoutNode>,
  visited: Set<string>,
  occupiedSlots: Map<number, number[]>,
) {
  const node = graph.get(personId)
  if (!node) return

  const parentIds = node.parentIds.filter(id => !visited.has(id))
  if (parentIds.length === 0) return

  const personNode = nodes.get(personId)
  const personY = personNode?.y ?? 0
  const xBase = (personNode?.x ?? 0) + direction * HORIZONTAL_GAP

  const parentY = findFreeSlot(occupiedSlots, xBase, personY, VERTICAL_GAP)

  if (parentIds.length >= 2) {
    placeNode(parentIds[0], xBase - PARTNER_GAP / 2, parentY, graph, nodes)
    placeNode(parentIds[1], xBase + PARTNER_GAP / 2, parentY, graph, nodes)
    visited.add(parentIds[0])
    visited.add(parentIds[1])
    claimSlot(occupiedSlots, xBase, parentY)

    addLink(nodes, parentIds[0], parentIds[1], 'partner')
    addLink(nodes, parentIds[0], personId, 'parent-child')
    addLink(nodes, parentIds[1], personId, 'parent-child')

    const allChildren = graph.get(parentIds[0])?.childIds ?? []
    const siblings = allChildren.filter(id => id !== personId && !visited.has(id))
    const personX = personNode?.x ?? 0
    siblings.forEach((sibId, i) => {
      const sibY = personY + (i + 1) * VERTICAL_GAP
      placeNode(sibId, personX, sibY, graph, nodes)
      visited.add(sibId)
      addLink(nodes, parentIds[0], sibId, 'parent-child')
    })

    expandAncestors(parentIds[0], direction, graph, nodes, visited, occupiedSlots)
    expandAncestors(parentIds[1], direction, graph, nodes, visited, occupiedSlots)
  } else {
    placeNode(parentIds[0], xBase, parentY, graph, nodes)
    visited.add(parentIds[0])
    claimSlot(occupiedSlots, xBase, parentY)
    addLink(nodes, parentIds[0], personId, 'parent-child')
    expandAncestors(parentIds[0], direction, graph, nodes, visited, occupiedSlots)
  }
}

function findFreeSlot(
  occupied: Map<number, number[]>,
  x: number,
  preferredY: number,
  gap: number,
): number {
  const slots = occupied.get(x)
  if (!slots || slots.length === 0) return preferredY

  if (slots.every(y => Math.abs(y - preferredY) >= gap)) return preferredY

  for (let offset = gap; offset < gap * 20; offset += gap) {
    const above = preferredY - offset
    if (slots.every(y => Math.abs(y - above) >= gap)) return above
    const below = preferredY + offset
    if (slots.every(y => Math.abs(y - below) >= gap)) return below
  }
  return preferredY
}

function claimSlot(occupied: Map<number, number[]>, x: number, y: number) {
  const slots = occupied.get(x) ?? []
  slots.push(y)
  occupied.set(x, slots)
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
