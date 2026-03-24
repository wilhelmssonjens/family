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

// --- FamilyUnit ---

export interface FamilyUnit {
  id: string // e.g. "f-per-laila" or "f-birgitta" for single parent
  parentIds: string[] // 1 or 2 parent person IDs, stably sorted
  childIds: string[] // children of this specific couple, stably sorted
}

/**
 * Compare two person IDs by birthDate (ascending, nulls last) then by id.
 */
function compareByBirthDateThenId(
  personMap: Map<string, Person>,
  a: string,
  b: string,
): number {
  const personA = personMap.get(a)
  const personB = personMap.get(b)
  const dateA = personA?.birthDate ?? null
  const dateB = personB?.birthDate ?? null

  if (dateA !== null && dateB !== null) {
    if (dateA < dateB) return -1
    if (dateA > dateB) return 1
  } else if (dateA !== null && dateB === null) {
    return -1
  } else if (dateA === null && dateB !== null) {
    return 1
  }

  // Fall back to id comparison
  return a.localeCompare(b)
}

/**
 * Build FamilyUnits from persons and relationships.
 *
 * A FamilyUnit groups a couple (1-2 parents) with their shared children.
 * Partner-only couples (no children) also form a FamilyUnit.
 */
export function buildFamilyUnits(
  persons: Person[],
  relationships: Relationship[],
): FamilyUnit[] {
  const personMap = new Map<string, Person>()
  for (const p of persons) {
    personMap.set(p.id, p)
  }

  const graph = buildFamilyGraph(persons, relationships)

  // Step 1: Group children by their parent-couple key.
  // For each child, find all parents. The sorted set of parent IDs is the couple key.
  // Use \0 as internal separator since it can't appear in IDs.
  const KEY_SEP = '\0'
  const coupleChildren = new Map<string, Set<string>>()

  for (const [personId, node] of graph) {
    if (node.parentIds.length === 0) continue

    // Sort parent IDs alphabetically for a stable couple key
    const coupleKey = [...node.parentIds].sort().join(KEY_SEP)

    let children = coupleChildren.get(coupleKey)
    if (!children) {
      children = new Set<string>()
      coupleChildren.set(coupleKey, children)
    }
    children.add(personId)
  }

  // Step 2: Build FamilyUnits from child-based couples
  const unitMap = new Map<string, FamilyUnit>()

  for (const [coupleKey, childSet] of coupleChildren) {
    const parentIds = coupleKey.split(KEY_SEP)

    // Sort parentIds by birthDate then id (stable)
    const sortedParentIds = [...parentIds].sort((a, b) =>
      compareByBirthDateThenId(personMap, a, b),
    )

    // Sort childIds by birthDate then id (stable)
    const sortedChildIds = [...childSet].sort((a, b) =>
      compareByBirthDateThenId(personMap, a, b),
    )

    const unitId = 'f-' + [...parentIds].sort().join('-')

    unitMap.set(unitId, {
      id: unitId,
      parentIds: sortedParentIds,
      childIds: sortedChildIds,
    })
  }

  // Step 3: Add partner-only FamilyUnits (partners with no shared children)
  for (const rel of relationships) {
    if (rel.type !== 'partner') continue

    const sortedIds = [rel.from, rel.to].sort()
    const unitId = 'f-' + sortedIds.join('-')

    // Only add if this couple doesn't already have a FamilyUnit from children
    if (!unitMap.has(unitId)) {
      const sortedParentIds = [rel.from, rel.to].sort((a, b) =>
        compareByBirthDateThenId(personMap, a, b),
      )

      unitMap.set(unitId, {
        id: unitId,
        parentIds: sortedParentIds,
        childIds: [],
      })
    }
  }

  // Sort units by id for deterministic output
  return [...unitMap.values()].sort((a, b) => a.id.localeCompare(b.id))
}
