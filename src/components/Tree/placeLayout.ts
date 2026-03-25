import type { FamilyUnit } from '../../utils/buildTree'
import type {
  Person,
  VisualPersonNode,
  PositionedFamilyConnectorV3,
  LayoutConfig,
} from '../../types'
import type { GenerationTable } from './assignGenerations'
import { pickPrimaryBirthFamily } from './familySelection'
import type { MeasureResult } from './measureLayout'

// --- Visual ID ---

export function makeVisualId(
  personId: string,
  familyId: string,
  role: 'parent' | 'child',
): string {
  return `p:${personId}@f:${familyId}:${role}`
}

// --- Placement context ---

export interface PlacementContextV3 {
  personMap: Map<string, Person>
  familyById: Map<string, FamilyUnit>
  familiesByParent: Map<string, FamilyUnit[]>
  familiesByChild: Map<string, FamilyUnit[]>
  generations: GenerationTable
  measured: MeasureResult
  config: LayoutConfig
  // Output accumulators
  visualNodes: Map<string, VisualPersonNode>
  placedFamilies: Set<string>
  familyConnectors: PositionedFamilyConnectorV3[]
}

// --- Node placement ---

export function placeVisualNode(
  personId: string,
  familyId: string,
  role: 'parent' | 'child',
  x: number,
  y: number,
  ctx: PlacementContextV3,
): VisualPersonNode | null {
  const person = ctx.personMap.get(personId)
  if (!person) return null

  const visualId = makeVisualId(personId, familyId, role)

  // Skip if this exact visual instance already placed
  if (ctx.visualNodes.has(visualId)) return ctx.visualNodes.get(visualId)!

  const node: VisualPersonNode = {
    visualId,
    personId,
    person,
    familyId,
    role,
    x,
    y,
    width: ctx.config.cardWidth,
    height: ctx.config.cardHeight,
  }

  ctx.visualNodes.set(visualId, node)
  return node
}

// --- Family placement ---

/**
 * Place a FamilyUnit: parents centered at centerX on generation row,
 * children distributed below based on measured widths.
 * Recursively places each child's own families.
 */
export function placeFamilyV3(
  family: FamilyUnit,
  centerX: number,
  generation: number,
  ctx: PlacementContextV3,
): void {
  if (ctx.placedFamilies.has(family.id)) return
  ctx.placedFamilies.add(family.id)

  const y = generation * ctx.config.generationGap

  const parentVisualIds: string[] = []

  // Place parents
  if (family.parentIds.length >= 2) {
    const n0 = placeVisualNode(
      family.parentIds[0], family.id, 'parent',
      centerX - ctx.config.partnerGap / 2, y, ctx,
    )
    const n1 = placeVisualNode(
      family.parentIds[1], family.id, 'parent',
      centerX + ctx.config.partnerGap / 2, y, ctx,
    )
    if (n0) parentVisualIds.push(n0.visualId)
    if (n1) parentVisualIds.push(n1.visualId)
  } else if (family.parentIds.length === 1) {
    const n0 = placeVisualNode(
      family.parentIds[0], family.id, 'parent',
      centerX, y, ctx,
    )
    if (n0) parentVisualIds.push(n0.visualId)
  }

  const childGeneration = generation + 1
  const childY = childGeneration * ctx.config.generationGap
  const childVisualIds: string[] = []

  // Build connector
  const connector: PositionedFamilyConnectorV3 = {
    familyId: family.id,
    parentVisualIds,
    childVisualIds,
    centerX,
    parentY: y,
    childY,
  }

  if (family.childIds.length === 0) {
    ctx.familyConnectors.push(connector)
    return
  }

  // Distribute children below
  const childWidths = family.childIds.map(
    id => ctx.measured.personWidths.get(id) ?? (ctx.config.cardWidth + ctx.config.cardMargin),
  )
  const totalWidth = childWidths.reduce((sum, w) => sum + w, 0)
    + ctx.config.childGap * (family.childIds.length - 1)
  let cursor = centerX - totalWidth / 2

  for (let i = 0; i < family.childIds.length; i++) {
    const childId = family.childIds[i]
    const width = childWidths[i]
    const childCenterX = cursor + width / 2

    const childNode = placeVisualNode(childId, family.id, 'child', childCenterX, childY, ctx)
    if (childNode) childVisualIds.push(childNode.visualId)

    // Recursively place the child's own families (where they are a parent)
    const childFamilies = ctx.familiesByParent.get(childId) ?? []
    for (const childFamily of childFamilies) {
      if (ctx.placedFamilies.has(childFamily.id)) continue
      placeFamilyV3(childFamily, childCenterX, childGeneration, ctx)
    }

    cursor += width + ctx.config.childGap
  }

  connector.childVisualIds = childVisualIds
  ctx.familyConnectors.push(connector)
}

// --- Ancestor placement ---

/**
 * Place the ancestors of a person. Given a person already placed at (personX, generation),
 * find their birth family, place all siblings in the same row, place parents above
 * centered over the children, then recurse up for each parent.
 *
 * `direction` controls which side siblings expand to:
 *   -1 = LEFT (siblings placed to the left of personId)
 *   +1 = RIGHT (siblings placed to the right of personId)
 */
export function placeAncestorsV3(
  personId: string,
  personX: number,
  generation: number,
  direction: number,
  ctx: PlacementContextV3,
): void {
  const birthFamily = pickPrimaryBirthFamily(personId, ctx.familiesByChild, ctx.personMap)
  if (!birthFamily) return
  if (ctx.placedFamilies.has(birthFamily.id)) return
  ctx.placedFamilies.add(birthFamily.id)

  const parentGen = generation - 1
  const parentY = parentGen * ctx.config.generationGap
  const childY = generation * ctx.config.generationGap

  // Get measured widths for all children in this family
  const cardSlot = ctx.config.cardWidth + ctx.config.cardMargin
  const childWidths = birthFamily.childIds.map(
    id => ctx.measured.personWidths.get(id) ?? cardSlot,
  )
  const personIndex = birthFamily.childIds.indexOf(personId)

  // Place siblings in `direction` from the anchor person
  const placedChildXs: number[] = new Array(birthFamily.childIds.length)
  placedChildXs[personIndex] = personX

  const otherIndices: number[] = []
  for (let i = 0; i < birthFamily.childIds.length; i++) {
    if (i !== personIndex) otherIndices.push(i)
  }

  if (direction < 0) {
    // LEFT: anchor is rightmost, siblings spread left
    let leftCursor = personX - childWidths[personIndex] / 2
    for (let j = otherIndices.length - 1; j >= 0; j--) {
      const idx = otherIndices[j]
      leftCursor -= ctx.config.childGap + childWidths[idx]
      placedChildXs[idx] = leftCursor + childWidths[idx] / 2
    }
  } else {
    // RIGHT: anchor is leftmost, siblings spread right
    let rightCursor = personX + childWidths[personIndex] / 2
    for (const idx of otherIndices) {
      rightCursor += ctx.config.childGap
      placedChildXs[idx] = rightCursor + childWidths[idx] / 2
      rightCursor += childWidths[idx]
    }
  }

  // Place sibling nodes and their descendant families
  const childVisualIds: string[] = []
  for (let i = 0; i < birthFamily.childIds.length; i++) {
    const childId = birthFamily.childIds[i]
    const childNode = placeVisualNode(childId, birthFamily.id, 'child', placedChildXs[i], childY, ctx)
    if (childNode) childVisualIds.push(childNode.visualId)

    if (childId !== personId) {
      // Recursively place the sibling's own families (descendants)
      const siblingFamilies = ctx.familiesByParent.get(childId) ?? []
      for (const sibFamily of siblingFamilies) {
        if (ctx.placedFamilies.has(sibFamily.id)) continue
        placeFamilyV3(sibFamily, placedChildXs[i], generation, ctx)
      }
    }
  }

  // Place parents above, centered over the full children row
  const minChildX = Math.min(...placedChildXs)
  const maxChildX = Math.max(...placedChildXs)
  const familyCenterX = (minChildX + maxChildX) / 2

  // Dynamic couple gap based on ancestor widths
  let effectiveGap = ctx.config.partnerGap
  if (birthFamily.parentIds.length >= 2) {
    const p0aw = ctx.measured.ancestorWidths.get(birthFamily.parentIds[0]) ?? 0
    const p1aw = ctx.measured.ancestorWidths.get(birthFamily.parentIds[1]) ?? 0
    if (p0aw > 0 || p1aw > 0) {
      effectiveGap = Math.max(ctx.config.partnerGap, (p0aw + p1aw) / 2 + ctx.config.childGap)
    }
  }

  const parentVisualIds: string[] = []
  if (birthFamily.parentIds.length >= 2) {
    const n0 = placeVisualNode(
      birthFamily.parentIds[0], birthFamily.id, 'parent',
      familyCenterX - effectiveGap / 2, parentY, ctx,
    )
    const n1 = placeVisualNode(
      birthFamily.parentIds[1], birthFamily.id, 'parent',
      familyCenterX + effectiveGap / 2, parentY, ctx,
    )
    if (n0) parentVisualIds.push(n0.visualId)
    if (n1) parentVisualIds.push(n1.visualId)
  } else if (birthFamily.parentIds.length === 1) {
    const n0 = placeVisualNode(
      birthFamily.parentIds[0], birthFamily.id, 'parent',
      familyCenterX, parentY, ctx,
    )
    if (n0) parentVisualIds.push(n0.visualId)
  }

  // Build family connector
  ctx.familyConnectors.push({
    familyId: birthFamily.id,
    parentVisualIds,
    childVisualIds,
    centerX: familyCenterX,
    parentY,
    childY,
  })

  // Place any other families where these parents are parents
  // (catches partner-only families and half-sibling families)
  for (const parentId of birthFamily.parentIds) {
    const parentVisualId = makeVisualId(parentId, birthFamily.id, 'parent')
    const parentNode = ctx.visualNodes.get(parentVisualId)
    if (!parentNode) continue
    const otherFamilies = ctx.familiesByParent.get(parentId) ?? []
    for (const otherFamily of otherFamilies) {
      if (ctx.placedFamilies.has(otherFamily.id)) continue
      placeFamilyV3(otherFamily, parentNode.x, parentGen, ctx)
    }
  }

  // Recurse: each parent's ancestors expand in OPPOSITE directions
  if (birthFamily.parentIds.length >= 2) {
    const p0vid = makeVisualId(birthFamily.parentIds[0], birthFamily.id, 'parent')
    const p1vid = makeVisualId(birthFamily.parentIds[1], birthFamily.id, 'parent')
    const p0node = ctx.visualNodes.get(p0vid)
    const p1node = ctx.visualNodes.get(p1vid)
    if (p0node) placeAncestorsV3(birthFamily.parentIds[0], p0node.x, parentGen, direction, ctx)
    if (p1node) placeAncestorsV3(birthFamily.parentIds[1], p1node.x, parentGen, -direction, ctx)
  } else if (birthFamily.parentIds.length === 1) {
    const p0vid = makeVisualId(birthFamily.parentIds[0], birthFamily.id, 'parent')
    const p0node = ctx.visualNodes.get(p0vid)
    if (p0node) placeAncestorsV3(birthFamily.parentIds[0], p0node.x, parentGen, direction, ctx)
  }
}
