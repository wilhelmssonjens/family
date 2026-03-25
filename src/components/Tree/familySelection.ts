import type { FamilyUnit } from '../../utils/buildTree'
import type { Person } from '../../types'

/**
 * Get the earliest child birthDate from a family unit.
 * Returns null if no children have birthDates.
 */
function earliestChildBirthDate(
  family: FamilyUnit,
  personsById: Map<string, Person>,
): string | null {
  let earliest: string | null = null
  for (const childId of family.childIds) {
    const child = personsById.get(childId)
    const bd = child?.birthDate ?? null
    if (bd !== null && (earliest === null || bd < earliest)) {
      earliest = bd
    }
  }
  return earliest
}

/**
 * Compare two FamilyUnits for sorting in pickCenterFamily.
 *
 * Sort order:
 *  1. Most children first (descending childIds.length)
 *  2. Two-parent families before single-parent (descending parentIds.length)
 *  3. Earliest child's birthDate (ascending, nulls last)
 *  4. familyId lexicographically (ascending)
 */
function compareCenterCandidates(
  a: FamilyUnit,
  b: FamilyUnit,
  personsById: Map<string, Person>,
): number {
  // Most children first (descending)
  if (b.childIds.length !== a.childIds.length) {
    return b.childIds.length - a.childIds.length
  }

  // Two-parent before single-parent (descending parentIds.length)
  if (b.parentIds.length !== a.parentIds.length) {
    return b.parentIds.length - a.parentIds.length
  }

  // Earliest child birthDate (ascending, nulls last)
  const dateA = earliestChildBirthDate(a, personsById)
  const dateB = earliestChildBirthDate(b, personsById)
  if (dateA !== null && dateB !== null) {
    if (dateA < dateB) return -1
    if (dateA > dateB) return 1
  } else if (dateA !== null && dateB === null) {
    return -1
  } else if (dateA === null && dateB !== null) {
    return 1
  }

  // familyId lexicographically (ascending)
  return a.id.localeCompare(b.id)
}

/**
 * Pick the center family where the center person should be anchored.
 *
 * Prefers families where the center person is a parent. Falls back to
 * families where the center person is a child. Throws if the person
 * does not belong to any family.
 */
export function pickCenterFamily(
  centerPersonId: string,
  familyUnits: FamilyUnit[],
  personsById: Map<string, Person>,
): FamilyUnit {
  // Filter to families where center is a parent
  const parentFamilies = familyUnits.filter((f) =>
    f.parentIds.includes(centerPersonId),
  )

  if (parentFamilies.length > 0) {
    const sorted = [...parentFamilies].sort((a, b) =>
      compareCenterCandidates(a, b, personsById),
    )
    return sorted[0]
  }

  // Fall back to families where center is a child
  const childFamilies = familyUnits.filter((f) =>
    f.childIds.includes(centerPersonId),
  )

  if (childFamilies.length > 0) {
    const sorted = [...childFamilies].sort((a, b) =>
      compareCenterCandidates(a, b, personsById),
    )
    return sorted[0]
  }

  throw new Error(
    `Center person "${centerPersonId}" does not belong to any family unit`,
  )
}

/**
 * Count non-null metadata fields on a person (birthDate, birthPlace, occupation).
 */
function countMetadata(person: Person): number {
  let count = 0
  if (person.birthDate !== null) count++
  if (person.birthPlace !== null) count++
  if (person.occupation !== null) count++
  return count
}

/**
 * Sum metadata counts for all parents in a family.
 */
function totalParentMetadata(
  family: FamilyUnit,
  personsById: Map<string, Person>,
): number {
  let total = 0
  for (const pid of family.parentIds) {
    const parent = personsById.get(pid)
    if (parent) {
      total += countMetadata(parent)
    }
  }
  return total
}

/**
 * Pick the primary birth family for a person (the best family where
 * the person appears as a child).
 *
 * Returns null if the person has no birth families.
 */
export function pickPrimaryBirthFamily(
  personId: string,
  familiesByChild: Map<string, FamilyUnit[]>,
  personsById: Map<string, Person>,
): FamilyUnit | null {
  const families = familiesByChild.get(personId)
  if (!families || families.length === 0) {
    return null
  }

  const sorted = [...families].sort((a, b) => {
    // Two-parent families first (descending parentIds.length)
    if (b.parentIds.length !== a.parentIds.length) {
      return b.parentIds.length - a.parentIds.length
    }

    // Most metadata on parents wins (descending)
    const metaA = totalParentMetadata(a, personsById)
    const metaB = totalParentMetadata(b, personsById)
    if (metaB !== metaA) {
      return metaB - metaA
    }

    // familyId lexicographically (ascending)
    return a.id.localeCompare(b.id)
  })

  return sorted[0]
}
