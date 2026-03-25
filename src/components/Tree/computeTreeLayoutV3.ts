import { buildFamilyUnits, type FamilyUnit } from '../../utils/buildTree'
import type { Person, Relationship, LayoutResultV3, VisualPersonNode } from '../../types'
import { assignGenerations, buildFamilyLookups } from './assignGenerations'
import { pickCenterFamily } from './familySelection'
import { measureAllV3, defaultLayoutConfig } from './measureLayout'
import {
  placeFamilyV3,
  placeAncestorsV3,
  placeVisualNode,
  makeVisualId,
  type PlacementContextV3,
} from './placeLayout'

// Re-export for backward compatibility
export { makeVisualId } from './placeLayout'
export { defaultLayoutConfig } from './measureLayout'

/**
 * Compute the full tree layout using the v3 family-first algorithm.
 *
 * Pipeline:
 * 1. Build FamilyUnits from persons + relationships
 * 2. Pick center family (returns FamilyUnit, not partner ID)
 * 3. Build lookup indexes
 * 4. Assign generations (BFS from center)
 * 5. Measure all family/person/ancestor widths
 * 6. Place center family
 * 7. Place center's children (via placeFamilyV3)
 * 8. Place center person's ancestors (LEFT, direction=-1)
 * 9. Place center partner's ancestors (RIGHT, direction=+1)
 * 10. Build and return LayoutResultV3
 */
export function computeTreeLayoutV3(
  persons: Person[],
  relationships: Relationship[],
  centerId: string,
): LayoutResultV3 {
  const emptyResult: LayoutResultV3 = {
    visualNodes: [],
    families: [],
    nodeIndex: new Map(),
    width: 0,
    height: 0,
  }

  if (persons.length === 0) return emptyResult

  const personMap = new Map<string, Person>()
  for (const p of persons) personMap.set(p.id, p)

  if (!personMap.has(centerId)) return emptyResult

  const config = defaultLayoutConfig()

  // 1. Build family units
  const familyUnits = buildFamilyUnits(persons, relationships)
  if (familyUnits.length === 0) {
    // Isolated person with no relationships
    const person = personMap.get(centerId)!
    const node: VisualPersonNode = {
      visualId: `p:${centerId}@solo:solo`,
      personId: centerId,
      person,
      familyId: 'solo',
      role: 'parent',
      x: 0,
      y: 0,
      width: config.cardWidth,
      height: config.cardHeight,
    }
    return {
      visualNodes: [node],
      families: [],
      nodeIndex: new Map([[node.visualId, node]]),
      width: config.cardWidth,
      height: config.cardHeight,
    }
  }

  // 2. Pick center family
  const centerFamily = pickCenterFamily(centerId, familyUnits, personMap)

  // 3. Build lookup indexes
  const familyById = new Map<string, FamilyUnit>()
  for (const unit of familyUnits) familyById.set(unit.id, unit)
  const { unitsAsParent: familiesByParent, unitsAsChild: familiesByChild } =
    buildFamilyLookups(familyUnits)

  // 4. Assign generations
  const generations = assignGenerations(centerId, familyUnits)

  // 5. Measure all widths
  const measured = measureAllV3(familyUnits, config)

  // 6. Build placement context
  const ctx: PlacementContextV3 = {
    personMap,
    familyById,
    familiesByParent,
    familiesByChild,
    generations,
    measured,
    config,
    visualNodes: new Map(),
    placedFamilies: new Set(),
    familyConnectors: [],
  }

  // 7. Determine center partner
  const centerPartnerId = centerFamily.parentIds.find(id => id !== centerId) ?? null

  // 8. Place center couple
  if (centerPartnerId) {
    // Center is parent in a two-parent family
    placeVisualNode(centerId, centerFamily.id, 'parent', -config.partnerGap / 2, 0, ctx)
    placeVisualNode(centerPartnerId, centerFamily.id, 'parent', config.partnerGap / 2, 0, ctx)
  } else if (centerFamily.parentIds.includes(centerId)) {
    // Single parent family
    placeVisualNode(centerId, centerFamily.id, 'parent', 0, 0, ctx)
  } else {
    // Center is a child in their birth family — place at origin
    placeVisualNode(centerId, centerFamily.id, 'child', 0, 0, ctx)
  }

  // 9. Place center couple's children (families where center or partner is parent)
  const centerFamilies = familiesByParent.get(centerId) ?? []
  for (const family of centerFamilies) {
    if (ctx.placedFamilies.has(family.id)) continue
    const familyCenterX = centerPartnerId ? 0 : 0
    placeFamilyV3(family, familyCenterX, 0, ctx)
  }
  // Also place families where partner is parent (but center isn't)
  if (centerPartnerId) {
    const partnerFamilies = familiesByParent.get(centerPartnerId) ?? []
    for (const family of partnerFamilies) {
      if (ctx.placedFamilies.has(family.id)) continue
      placeFamilyV3(family, 0, 0, ctx)
    }
  }

  // 10. Place center person's ancestors (LEFT side, direction = -1)
  const centerVisualId = makeVisualId(
    centerId,
    centerFamily.id,
    centerFamily.parentIds.includes(centerId) ? 'parent' : 'child',
  )
  const centerNode = ctx.visualNodes.get(centerVisualId)
  if (centerNode) {
    placeAncestorsV3(centerId, centerNode.x, 0, -1, ctx)
  }

  // 11. Place center partner's ancestors (RIGHT side, direction = +1)
  if (centerPartnerId) {
    const partnerVisualId = makeVisualId(centerPartnerId, centerFamily.id, 'parent')
    const partnerNode = ctx.visualNodes.get(partnerVisualId)
    if (partnerNode) {
      placeAncestorsV3(centerPartnerId, partnerNode.x, 0, +1, ctx)
    }
  }

  // 12. Build result
  const visualNodes = Array.from(ctx.visualNodes.values())
  const nodeIndex = new Map(ctx.visualNodes)

  // Compute bounding box
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const node of visualNodes) {
    minX = Math.min(minX, node.x - node.width / 2)
    maxX = Math.max(maxX, node.x + node.width / 2)
    minY = Math.min(minY, node.y - node.height / 2)
    maxY = Math.max(maxY, node.y + node.height / 2)
  }

  return {
    visualNodes,
    families: ctx.familyConnectors,
    nodeIndex,
    width: visualNodes.length > 0 ? maxX - minX : 0,
    height: visualNodes.length > 0 ? maxY - minY : 0,
  }
}
