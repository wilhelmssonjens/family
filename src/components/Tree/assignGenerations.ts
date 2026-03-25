import type { FamilyUnit } from '../../utils/buildTree'

// --- Types ---

export type GenerationTable = Map<string, number>

// --- Helpers ---

/**
 * Build lookup maps from familyUnits for quick person -> unit lookups.
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
): GenerationTable {
  const generations: GenerationTable = new Map()
  generations.set(centerPersonId, 0)

  // Build lookup indexes: person -> units where they are a parent, person -> units where they are a child
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

// --- Accessors ---

/**
 * Get the generation for a person. Throws if the person is not found in the table.
 */
export function getGeneration(
  personId: string,
  generations: GenerationTable,
): number {
  const gen = generations.get(personId)
  if (gen === undefined) {
    throw new Error(`Person "${personId}" not found in generation table`)
  }
  return gen
}
