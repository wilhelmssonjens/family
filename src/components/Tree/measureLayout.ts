import type { FamilyUnit } from '../../utils/buildTree'
import type { LayoutConfig } from '../../types'
import { CARD_WIDTH, CARD_HEIGHT } from '../PersonCard/PersonCardMini'

// --- Default config factory ---

export function defaultLayoutConfig(): LayoutConfig {
  return {
    generationGap: 250,
    partnerGap: 160,
    cardMargin: 20,
    childGap: 60,
    cardWidth: CARD_WIDTH,   // 140
    cardHeight: CARD_HEIGHT, // 90
  }
}

// --- Computed helpers ---

const cardSlot = (config: LayoutConfig): number =>
  config.cardWidth + config.cardMargin

// --- Family / person lookups ---

export interface MeasureResult {
  familyWidths: Map<string, number>
  personWidths: Map<string, number>
  ancestorWidths: Map<string, number>
}

function buildFamiliesByParent(
  familyUnits: FamilyUnit[],
): Map<string, FamilyUnit[]> {
  const map = new Map<string, FamilyUnit[]>()
  for (const unit of familyUnits) {
    for (const parentId of unit.parentIds) {
      let list = map.get(parentId)
      if (!list) {
        list = []
        map.set(parentId, list)
      }
      list.push(unit)
    }
  }
  return map
}

function buildFamiliesByChild(
  familyUnits: FamilyUnit[],
): Map<string, FamilyUnit[]> {
  const map = new Map<string, FamilyUnit[]>()
  for (const unit of familyUnits) {
    for (const childId of unit.childIds) {
      let list = map.get(childId)
      if (!list) {
        list = []
        map.set(childId, list)
      }
      list.push(unit)
    }
  }
  return map
}

// --- Family width measurement (descendants) ---

/**
 * Measure how much horizontal space a FamilyUnit needs to display its parents
 * and all descendant subtrees.
 *
 * Memoized per familyId via the `memo` map. No cycle issues because families
 * form a DAG (parent -> child is directed).
 */
export function measureFamilyV3(
  familyId: string,
  unit: FamilyUnit,
  familiesByParent: Map<string, FamilyUnit[]>,
  config: LayoutConfig,
  memo: Map<string, number>,
): number {
  const cached = memo.get(familyId)
  if (cached !== undefined) return cached

  const parentCount = unit.parentIds.length
  const parentBlockWidth = parentCount === 1
    ? cardSlot(config)
    : config.partnerGap + config.cardWidth + config.cardMargin

  if (unit.childIds.length === 0) {
    memo.set(familyId, parentBlockWidth)
    return parentBlockWidth
  }

  // Sum child descendant widths
  const childWidths = unit.childIds.map(childId =>
    measurePersonDescendants(childId, familiesByParent, config, memo),
  )
  const childRowWidth =
    childWidths.reduce((sum, w) => sum + w, 0) +
    config.childGap * (unit.childIds.length - 1)

  const width = Math.max(parentBlockWidth, childRowWidth)
  memo.set(familyId, width)
  return width
}

/**
 * Measure how wide a person's descendant tree is when they occupy a child slot.
 *
 * KEY CHANGE FROM V2: If a person has MULTIPLE parent-families (i.e. they are a
 * parent in multiple FamilyUnits, meaning multiple partners), the width is the
 * SUM of all family widths + partnerGap between them. This reserves horizontal
 * space for side-by-side family composition.
 *
 * If the person has exactly ONE parent-family, width = that family's measured width.
 * If no families as parent (leaf node), width = cardSlot.
 */
export function measurePersonDescendants(
  personId: string,
  familiesByParent: Map<string, FamilyUnit[]>,
  config: LayoutConfig,
  memo: Map<string, number>,
): number {
  const families = familiesByParent.get(personId)
  if (!families || families.length === 0) {
    return cardSlot(config)
  }

  if (families.length === 1) {
    return measureFamilyV3(
      families[0].id,
      families[0],
      familiesByParent,
      config,
      memo,
    )
  }

  // Multiple families: SUM of widths + partnerGap between them
  let totalWidth = 0
  for (const family of families) {
    totalWidth += measureFamilyV3(
      family.id,
      family,
      familiesByParent,
      config,
      memo,
    )
  }
  totalWidth += config.partnerGap * (families.length - 1)

  return totalWidth
}

// --- Ancestor width measurement ---

/**
 * Measure how wide the ancestor chain above a person extends.
 *
 * Takes into account:
 * - All siblings in the birth family (with their descendant widths)
 * - Recursive ancestor widths of each parent in the birth family
 *
 * Uses a separate per-person memoization cache.
 */
export function measureAncestorWidth(
  personId: string,
  familiesByChild: Map<string, FamilyUnit[]>,
  familiesByParent: Map<string, FamilyUnit[]>,
  config: LayoutConfig,
  measuredPersonWidths: Map<string, number>,
  cache: Map<string, number>,
): number {
  const cached = cache.get(personId)
  if (cached !== undefined) return cached

  const birthFamilies = familiesByChild.get(personId) ?? []
  if (birthFamilies.length === 0) {
    const ownWidth = measuredPersonWidths.get(personId) ?? cardSlot(config)
    cache.set(personId, ownWidth)
    return ownWidth
  }

  const family = birthFamilies[0]

  // Sibling row width: sum of each sibling's measured descendant width
  const siblingWidths = family.childIds.map(
    childId => measuredPersonWidths.get(childId) ?? cardSlot(config),
  )
  const siblingWidth =
    siblingWidths.reduce((sum, w) => sum + w, 0) +
    config.childGap * (family.childIds.length - 1)

  // Recursive: each parent's ancestor width
  const parentAncestorWidths = family.parentIds.map(parentId =>
    measureAncestorWidth(
      parentId,
      familiesByChild,
      familiesByParent,
      config,
      measuredPersonWidths,
      cache,
    ),
  )
  const parentAncestorTotal =
    parentAncestorWidths.reduce((sum, w) => sum + w, 0) +
    (family.parentIds.length > 1
      ? config.partnerGap * (family.parentIds.length - 1)
      : 0)

  const width = Math.max(siblingWidth, parentAncestorTotal)
  cache.set(personId, width)
  return width
}

// --- Entry point ---

/**
 * Measure all families, persons, and ancestor widths.
 *
 * Returns three maps:
 * - familyWidths: familyId -> total width needed for that family and descendants
 * - personWidths: personId -> total descendant width for that person
 * - ancestorWidths: personId -> total ancestor chain width above that person
 */
export function measureAllV3(
  familyUnits: FamilyUnit[],
  config: LayoutConfig,
): MeasureResult {
  // 1. Build lookups
  const familiesByParent = buildFamiliesByParent(familyUnits)
  const familiesByChild = buildFamiliesByChild(familyUnits)

  // 2. Measure all family widths (also populates memo for person descendants)
  const familyMemo = new Map<string, number>()
  for (const unit of familyUnits) {
    measureFamilyV3(unit.id, unit, familiesByParent, config, familyMemo)
  }

  // 3. Build personWidths by measuring each unique person's descendants
  const personWidths = new Map<string, number>()
  const allPersonIds = new Set<string>()
  for (const unit of familyUnits) {
    for (const id of unit.parentIds) allPersonIds.add(id)
    for (const id of unit.childIds) allPersonIds.add(id)
  }
  for (const personId of allPersonIds) {
    personWidths.set(
      personId,
      measurePersonDescendants(personId, familiesByParent, config, familyMemo),
    )
  }

  // 4. Build ancestorWidths
  const ancestorCache = new Map<string, number>()
  for (const personId of allPersonIds) {
    measureAncestorWidth(
      personId,
      familiesByChild,
      familiesByParent,
      config,
      personWidths,
      ancestorCache,
    )
  }

  return {
    familyWidths: familyMemo,
    personWidths,
    ancestorWidths: ancestorCache,
  }
}
