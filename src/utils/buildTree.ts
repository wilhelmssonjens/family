import type { Person, Relationship } from '../types'

export interface FamilyNode {
  person: Person
  parentIds: string[]
  childIds: string[]
  partnerIds: string[]
}

export type FamilyGraph = Map<string, FamilyNode>

export function buildFamilyGraph(persons: Person[], relationships: Relationship[]): FamilyGraph {
  const graph: FamilyGraph = new Map()

  for (const person of persons) {
    graph.set(person.id, {
      person,
      parentIds: [],
      childIds: [],
      partnerIds: [],
    })
  }

  for (const rel of relationships) {
    const fromNode = graph.get(rel.from)
    const toNode = graph.get(rel.to)
    if (!fromNode || !toNode) continue

    if (rel.type === 'parent') {
      toNode.parentIds.push(rel.from)
      fromNode.childIds.push(rel.to)
    } else if (rel.type === 'partner') {
      fromNode.partnerIds.push(rel.to)
      toNode.partnerIds.push(rel.from)
    }
  }

  return graph
}

export function getParents(graph: FamilyGraph, personId: string): Person[] {
  const node = graph.get(personId)
  if (!node) return []
  return node.parentIds
    .map((id) => graph.get(id)?.person)
    .filter((p): p is Person => p !== undefined)
}

export function getChildren(graph: FamilyGraph, personId: string): Person[] {
  const node = graph.get(personId)
  if (!node) return []
  return node.childIds
    .map((id) => graph.get(id)?.person)
    .filter((p): p is Person => p !== undefined)
}

export function getSiblings(graph: FamilyGraph, personId: string): Person[] {
  const node = graph.get(personId)
  if (!node) return []

  const siblingIds = new Set<string>()
  for (const parentId of node.parentIds) {
    const parent = graph.get(parentId)
    if (!parent) continue
    for (const childId of parent.childIds) {
      if (childId !== personId) siblingIds.add(childId)
    }
  }

  return Array.from(siblingIds)
    .map((id) => graph.get(id)?.person)
    .filter((p): p is Person => p !== undefined)
}

export function getPartners(graph: FamilyGraph, personId: string): Person[] {
  const node = graph.get(personId)
  if (!node) return []
  return node.partnerIds
    .map((id) => graph.get(id)?.person)
    .filter((p): p is Person => p !== undefined)
}
