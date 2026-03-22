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

const GENERATION_GAP = 300
const SIBLING_GAP = 250
const PARTNER_GAP = 160

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
      const primaryParent = graph.get(parentIds[0])
      const siblings = primaryParent
        ? primaryParent.childIds.filter(id => id !== childId && !visited.has(id))
        : []

      siblings.forEach((sibId, j) => {
        const sibX = childNode.x + (j + 1) * SIBLING_GAP * direction
        placeNode(sibId, sibX, childNode.y, graph, nodes)
        visited.add(sibId)
        for (const pid of parentIds) {
          addLink(nodes, pid, sibId, 'parent-child')
        }
      })

      // Center parent couple above the entire children row
      const allChildrenX = [childNode.x, ...siblings.map(sibId => nodes.get(sibId)!.x)]
      const minX = Math.min(...allChildrenX)
      const maxX = Math.max(...allChildrenX)
      const centerX = (minX + maxX) / 2

      if (parentIds.length >= 2) {
        placeNode(parentIds[0], centerX - PARTNER_GAP / 2, genY, graph, nodes)
        placeNode(parentIds[1], centerX + PARTNER_GAP / 2, genY, graph, nodes)
        visited.add(parentIds[0])
        visited.add(parentIds[1])

        addLink(nodes, parentIds[0], parentIds[1], 'partner')
        addLink(nodes, parentIds[0], childId, 'parent-child')
        addLink(nodes, parentIds[1], childId, 'parent-child')

        nextGenPersons.push(parentIds[0], parentIds[1])
      } else {
        placeNode(parentIds[0], centerX, genY, graph, nodes)
        visited.add(parentIds[0])
        addLink(nodes, parentIds[0], childId, 'parent-child')
        nextGenPersons.push(parentIds[0])
      }
    }

    currentGenPersons = nextGenPersons
    generation++
  }
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
