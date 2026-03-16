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
const VERTICAL_GAP = 180
const PARTNER_GAP = 150
const SIBLING_GAP = 130

/**
 * Horizontal tree layout with generation-based columns.
 *
 * X-axis = generations. Each generation gets a fixed x-column.
 * Y-axis = couples stacked vertically within a generation column.
 *
 * Center couple at x=0. Jens ancestors go left, Klara ancestors go right.
 * Siblings are placed vertically near their parent.
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
    const yOffset = (i - (children.length - 1) / 2) * SIBLING_GAP
    placeNode(childId, 0, VERTICAL_GAP + yOffset, graph, nodes)
    visited.add(childId)
    addLink(nodes, centerId, childId, 'parent-child')
  })

  return Array.from(nodes.values())
}

/**
 * BFS expansion of ancestors, generation by generation.
 * Each generation gets a single x-column, with couples stacked vertically.
 */
function expandAncestorsByGeneration(
  startPersonId: string,
  direction: number,
  graph: FamilyGraph,
  nodes: Map<string, LayoutNode>,
  visited: Set<string>,
) {
  // Queue of people whose parents we need to place, grouped by generation
  let currentGenPersons = [startPersonId]
  let generation = 1

  while (currentGenPersons.length > 0) {
    const genX = direction * generation * HORIZONTAL_GAP

    // Collect parent couples for this generation
    const couples: { parentIds: string[]; childId: string }[] = []

    for (const personId of currentGenPersons) {
      const node = graph.get(personId)
      if (!node) continue

      const parentIds = node.parentIds.filter(id => !visited.has(id))
      if (parentIds.length === 0) continue

      couples.push({ parentIds, childId: personId })
    }

    if (couples.length === 0) break

    // Place couples vertically centered in this generation column
    const nextGenPersons: string[] = []

    for (let i = 0; i < couples.length; i++) {
      const { parentIds, childId } = couples[i]
      const coupleY = (i - (couples.length - 1) / 2) * VERTICAL_GAP

      if (parentIds.length >= 2) {
        placeNode(parentIds[0], genX - PARTNER_GAP / 2, coupleY, graph, nodes)
        placeNode(parentIds[1], genX + PARTNER_GAP / 2, coupleY, graph, nodes)
        visited.add(parentIds[0])
        visited.add(parentIds[1])

        addLink(nodes, parentIds[0], parentIds[1], 'partner')
        addLink(nodes, parentIds[0], childId, 'parent-child')
        addLink(nodes, parentIds[1], childId, 'parent-child')

        nextGenPersons.push(parentIds[0], parentIds[1])
      } else {
        placeNode(parentIds[0], genX, coupleY, graph, nodes)
        visited.add(parentIds[0])
        addLink(nodes, parentIds[0], childId, 'parent-child')
        nextGenPersons.push(parentIds[0])
      }

      // Place siblings of childId (other children of these parents)
      const primaryParent = graph.get(parentIds[0])
      if (primaryParent) {
        const siblings = primaryParent.childIds.filter(
          id => id !== childId && !visited.has(id)
        )
        const childNode = nodes.get(childId)
        if (childNode && siblings.length > 0) {
          siblings.forEach((sibId, j) => {
            const sibY = childNode.y + (j + 1) * SIBLING_GAP
            placeNode(sibId, childNode.x, sibY, graph, nodes)
            visited.add(sibId)
            addLink(nodes, parentIds[0], sibId, 'parent-child')
          })
        }
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
