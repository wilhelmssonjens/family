import { buildFamilyUnits, type FamilyUnit } from '../../utils/buildTree'
import { CARD_WIDTH } from '../PersonCard/PersonCardMini'
import type { Person, Relationship, PositionedFamilyConnector } from '../../types'

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

export interface TreeLayoutResult {
  nodes: LayoutNode[]
  families: PositionedFamilyConnector[]
}

// --- Constants ---

const GENERATION_GAP = 250
const PARTNER_GAP = 160
const CARD_MARGIN = 20
const CHILD_GAP = 60
const CARD_SLOT = CARD_WIDTH + CARD_MARGIN     // 160px

// --- Helpers ---

function addLink(
  nodes: Map<string, LayoutNode>,
  fromId: string,
  toId: string,
  type: LayoutLink['type'],
): void {
  const from = nodes.get(fromId)
  if (from) {
    from.links.push({ targetId: toId, type })
  }
}

/**
 * Find the FamilyUnit where centerId is a parent.
 * Returns the partner ID (the other parent in that unit), or null.
 */
function pickCenterFamily(
  centerId: string,
  familyUnits: FamilyUnit[],
): string | null {
  for (const unit of familyUnits) {
    if (unit.parentIds.includes(centerId)) {
      const partner = unit.parentIds.find(id => id !== centerId)
      if (partner) return partner
    }
  }
  return null
}

// --- Placement pass ---

/**
 * Internal context passed through placement functions to avoid deep parameter lists.
 */
interface PlacementContext {
  personMap: Map<string, Person>
  unitsAsParent: Map<string, FamilyUnit[]>
  unitsAsChild: Map<string, FamilyUnit[]>
  familyById: Map<string, FamilyUnit>
  generations: Map<string, number>
  measuredWidths: Map<string, number>
  measuredPersonWidths: Map<string, number>
  ancestorWidths: Map<string, number>
  nodes: Map<string, LayoutNode>
  placed: Set<string>
  placedFamilies: Set<string>
  familyConnectors: PositionedFamilyConnector[]
}

/**
 * Measure how much horizontal space a person's ancestor chain needs.
 * This includes siblings at each level (with their descendant widths)
 * plus the recursive ancestor widths of each parent.
 */
function measureAncestorWidth(
  personId: string,
  unitsAsChild: Map<string, FamilyUnit[]>,
  measuredPersonWidths: Map<string, number>,
  cache: Map<string, number>,
  visited: Set<string>,
): number {
  if (cache.has(personId)) return cache.get(personId)!
  if (visited.has(personId)) return 0
  visited.add(personId)

  const birthFamilies = unitsAsChild.get(personId) ?? []
  if (birthFamilies.length === 0) { cache.set(personId, 0); return 0 }

  const family = birthFamilies[0]

  // Sibling widths (all children except this person)
  let siblingsWidth = 0
  const siblings = family.childIds.filter(id => id !== personId)
  for (const sibId of siblings) {
    siblingsWidth += measuredPersonWidths.get(sibId) ?? CARD_SLOT
  }
  if (siblings.length > 0) {
    siblingsWidth += siblings.length * CHILD_GAP
  }

  // Recursive: each parent's own ancestor width
  let parentAncestorTotal = 0
  for (const parentId of family.parentIds) {
    parentAncestorTotal += measureAncestorWidth(
      parentId, unitsAsChild, measuredPersonWidths, cache, visited
    )
  }

  const width = Math.max(siblingsWidth, parentAncestorTotal)
  cache.set(personId, width)
  return width
}

/**
 * Get the measured width of a person's subtree (how wide their descendants need).
 * Uses the max width across all families where the person is a parent.
 * Falls back to CARD_SLOT if the person has no families as parent.
 */
function getMeasuredPersonWidth(personId: string, ctx: PlacementContext): number {
  const cached = ctx.measuredPersonWidths.get(personId)
  if (cached !== undefined) return cached

  const families = ctx.unitsAsParent.get(personId)
  if (!families || families.length === 0) return CARD_SLOT

  let maxWidth = 0
  for (const family of families) {
    const w = ctx.measuredWidths.get(family.id) ?? CARD_SLOT
    if (w > maxWidth) maxWidth = w
  }
  return maxWidth
}

/**
 * Place a single node at (x, y). No-op if already placed.
 */
function placeNode(
  personId: string,
  x: number,
  y: number,
  ctx: PlacementContext,
): void {
  if (ctx.placed.has(personId)) return
  const person = ctx.personMap.get(personId)
  if (!person) return
  ctx.placed.add(personId)
  ctx.nodes.set(personId, { personId, person, x, y, links: [] })
}

/**
 * Place a FamilyUnit: parents centered at centerX on generation row,
 * children distributed below based on measured widths.
 * Recursively places each child's own families.
 */
function placeFamily(
  family: FamilyUnit,
  centerX: number,
  generation: number,
  ctx: PlacementContext,
): void {
  if (ctx.placedFamilies.has(family.id)) return
  ctx.placedFamilies.add(family.id)

  const y = generation * GENERATION_GAP

  // Place parents at y, centered at centerX
  if (family.parentIds.length >= 2) {
    placeNode(family.parentIds[0], centerX - PARTNER_GAP / 2, y, ctx)
    placeNode(family.parentIds[1], centerX + PARTNER_GAP / 2, y, ctx)
    addLink(ctx.nodes, family.parentIds[0], family.parentIds[1], 'partner')
  } else if (family.parentIds.length === 1) {
    placeNode(family.parentIds[0], centerX, y, ctx)
  }

  // Build family connector for this family
  const connector: PositionedFamilyConnector = {
    familyId: family.id,
    parentIds: family.parentIds.filter(id => ctx.placed.has(id)),
    childIds: [],
    centerX,
    parentY: y,
    childY: (generation + 1) * GENERATION_GAP,
  }

  if (family.childIds.length === 0) {
    ctx.familyConnectors.push(connector)
    return
  }

  // Place children below, distributed by measured widths
  const childGeneration = generation + 1
  const childWidths = family.childIds.map(id => getMeasuredPersonWidth(id, ctx))
  const totalWidth = childWidths.reduce((sum, w) => sum + w, 0)
    + CHILD_GAP * (family.childIds.length - 1)
  let cursor = centerX - totalWidth / 2

  for (let i = 0; i < family.childIds.length; i++) {
    const childId = family.childIds[i]
    const width = childWidths[i]
    const childCenterX = cursor + width / 2

    // Place child node
    placeNode(childId, childCenterX, childGeneration * GENERATION_GAP, ctx)

    // Add parent-child links
    for (const parentId of family.parentIds) {
      addLink(ctx.nodes, parentId, childId, 'parent-child')
    }

    // Recursively place the child's own families
    const childFamilies = ctx.unitsAsParent.get(childId) ?? []
    for (const childFamily of childFamilies) {
      if (ctx.placedFamilies.has(childFamily.id)) continue
      placeFamily(childFamily, childCenterX, childGeneration, ctx)
    }

    cursor += width + CHILD_GAP
  }

  // Update connector with placed children
  connector.childIds = family.childIds.filter(id => ctx.placed.has(id))
  ctx.familyConnectors.push(connector)
}

/**
 * Place the ancestors of a person. Given a person already placed at (personX, generation),
 * find their birth family, place all siblings in the same row, place parents above
 * centered over the children, then recurse up for each parent.
 *
 * `direction` controls which side siblings expand to:
 *   -1 = LEFT (siblings placed to the left of personId)
 *   +1 = RIGHT (siblings placed to the right of personId)
 */
function placeAncestors(
  personId: string,
  personX: number,
  generation: number,
  direction: number,
  ctx: PlacementContext,
): void {
  // Find the family where this person is a child
  const birthFamilies = ctx.unitsAsChild.get(personId) ?? []
  if (birthFamilies.length === 0) return

  const birthFamily = birthFamilies[0] // typically one birth family
  if (ctx.placedFamilies.has(birthFamily.id)) return
  ctx.placedFamilies.add(birthFamily.id)

  const parentGen = generation - 1

  // Get measured widths for all children in this family
  const childWidths = birthFamily.childIds.map(id => getMeasuredPersonWidth(id, ctx))
  const personIndex = birthFamily.childIds.indexOf(personId)

  // Place ALL siblings in `direction` from the anchor person.
  // direction=-1 (LEFT):  anchor is rightmost, siblings spread left
  // direction=+1 (RIGHT): anchor is leftmost, siblings spread right
  const placedChildXs: number[] = new Array(birthFamily.childIds.length)
  placedChildXs[personIndex] = personX

  // Collect indices of all siblings (excluding the anchor person)
  const otherIndices: number[] = []
  for (let i = 0; i < birthFamily.childIds.length; i++) {
    if (i !== personIndex) otherIndices.push(i)
  }

  if (direction < 0) {
    // LEFT: anchor is rightmost, all siblings spread to the left
    let leftCursor = personX - childWidths[personIndex] / 2
    for (let j = otherIndices.length - 1; j >= 0; j--) {
      const idx = otherIndices[j]
      leftCursor -= CHILD_GAP + childWidths[idx]
      placedChildXs[idx] = leftCursor + childWidths[idx] / 2
    }
  } else {
    // RIGHT: anchor is leftmost, all siblings spread to the right
    let rightCursor = personX + childWidths[personIndex] / 2
    for (const idx of otherIndices) {
      rightCursor += CHILD_GAP
      placedChildXs[idx] = rightCursor + childWidths[idx] / 2
      rightCursor += childWidths[idx]
    }
  }

  // Actually place the sibling nodes and their descendant families
  for (let i = 0; i < birthFamily.childIds.length; i++) {
    const childId = birthFamily.childIds[i]
    if (childId !== personId) {
      placeNode(childId, placedChildXs[i], generation * GENERATION_GAP, ctx)

      // Recursively place the sibling's own families (descendants)
      const siblingFamilies = ctx.unitsAsParent.get(childId) ?? []
      for (const sibFamily of siblingFamilies) {
        if (ctx.placedFamilies.has(sibFamily.id)) continue
        placeFamily(sibFamily, placedChildXs[i], generation, ctx)
      }
    }
  }

  // Place parents above, centered over the full children row
  const minChildX = Math.min(...placedChildXs)
  const maxChildX = Math.max(...placedChildXs)
  const familyCenterX = (minChildX + maxChildX) / 2

  // Dynamic couple gap: if both parents have ancestor branches, the gap must
  // be wide enough so their respective families (going in opposite directions)
  // don't overlap. Measured ancestor widths tell us exactly how much room each needs.
  let effectiveGap = PARTNER_GAP
  if (birthFamily.parentIds.length >= 2) {
    const p0aw = ctx.ancestorWidths.get(birthFamily.parentIds[0]) ?? 0
    const p1aw = ctx.ancestorWidths.get(birthFamily.parentIds[1]) ?? 0
    if (p0aw > 0 || p1aw > 0) {
      effectiveGap = Math.max(PARTNER_GAP, (p0aw + p1aw) / 2 + CHILD_GAP)
    }
  }

  if (birthFamily.parentIds.length >= 2) {
    placeNode(birthFamily.parentIds[0], familyCenterX - effectiveGap / 2, parentGen * GENERATION_GAP, ctx)
    placeNode(birthFamily.parentIds[1], familyCenterX + effectiveGap / 2, parentGen * GENERATION_GAP, ctx)
    addLink(ctx.nodes, birthFamily.parentIds[0], birthFamily.parentIds[1], 'partner')
  } else if (birthFamily.parentIds.length === 1) {
    placeNode(birthFamily.parentIds[0], familyCenterX, parentGen * GENERATION_GAP, ctx)
  }

  // Add parent-child links for ALL children in this family
  for (const parentId of birthFamily.parentIds) {
    for (const childId of birthFamily.childIds) {
      addLink(ctx.nodes, parentId, childId, 'parent-child')
    }
  }

  // Build family connector for this ancestor family
  ctx.familyConnectors.push({
    familyId: birthFamily.id,
    parentIds: birthFamily.parentIds.filter(id => ctx.placed.has(id)),
    childIds: birthFamily.childIds.filter(id => ctx.placed.has(id)),
    centerX: familyCenterX,
    parentY: parentGen * GENERATION_GAP,
    childY: generation * GENERATION_GAP,
  })

  // Place any other families where these parents are parents
  // (catches partner-only families and half-sibling families)
  for (const parentId of birthFamily.parentIds) {
    const parentNode = ctx.nodes.get(parentId)
    if (!parentNode) continue
    const otherFamilies = ctx.unitsAsParent.get(parentId) ?? []
    for (const otherFamily of otherFamilies) {
      if (ctx.placedFamilies.has(otherFamily.id)) continue
      placeFamily(otherFamily, parentNode.x, parentGen, ctx)
    }
  }

  // Recurse: each parent's ancestors expand in OPPOSITE directions.
  // First parent keeps `direction`, second gets `-direction`.
  // This ensures Per's family fans one way and Laila's family the other.
  if (birthFamily.parentIds.length >= 2) {
    const p0node = ctx.nodes.get(birthFamily.parentIds[0])
    const p1node = ctx.nodes.get(birthFamily.parentIds[1])
    if (p0node) placeAncestors(birthFamily.parentIds[0], p0node.x, parentGen, direction, ctx)
    if (p1node) placeAncestors(birthFamily.parentIds[1], p1node.x, parentGen, -direction, ctx)
  } else if (birthFamily.parentIds.length === 1) {
    const p0node = ctx.nodes.get(birthFamily.parentIds[0])
    if (p0node) placeAncestors(birthFamily.parentIds[0], p0node.x, parentGen, direction, ctx)
  }
}

// --- Main layout function ---

/**
 * Compute the full tree layout for all persons.
 *
 * Algorithm:
 * 1. Build FamilyUnits from persons + relationships
 * 2. Assign generations (BFS from center)
 * 3. Measure all family widths (bottom-up)
 * 4. Find center partner via pickCenterFamily
 * 5. Place center couple at origin
 * 6. Place center couple's children below (via placeFamily)
 * 7. Place center person's ancestors (LEFT side, x < 0)
 * 8. Place center partner's ancestors (RIGHT side, x > 0)
 * 9. Warn about any unplaced persons
 */
export function computeTreeLayout(
  persons: Person[],
  relationships: Relationship[],
  centerId: string,
): TreeLayoutResult {
  if (persons.length === 0) return { nodes: [], families: [] }

  const personMap = new Map<string, Person>()
  for (const p of persons) personMap.set(p.id, p)

  if (!personMap.has(centerId)) return { nodes: [], families: [] }

  // 1. Build family units and lookups
  const familyUnits = buildFamilyUnits(persons, relationships)
  const { unitsAsParent, unitsAsChild } = buildFamilyLookups(familyUnits)
  const familyById = new Map<string, FamilyUnit>()
  for (const unit of familyUnits) familyById.set(unit.id, unit)

  // 2. Assign generations
  const generations = assignGenerations(centerId, familyUnits)

  // 3. Measure all family widths
  const measuredWidths = measureAllFamilies(familyUnits)

  // Pre-compute person widths
  const measuredPersonWidths = new Map<string, number>()
  const measureVisited = new Set<string>()
  for (const p of persons) {
    const w = measurePerson(p.id, unitsAsParent, measuredWidths, measureVisited)
    measuredPersonWidths.set(p.id, w)
  }

  // Pre-compute ancestor widths (how wide each person's ancestor chain is)
  const ancestorWidths = new Map<string, number>()
  const ancestorVisited = new Set<string>()
  for (const p of persons) {
    measureAncestorWidth(p.id, unitsAsChild, measuredPersonWidths, ancestorWidths, ancestorVisited)
  }

  // Build placement context
  const ctx: PlacementContext = {
    personMap,
    unitsAsParent,
    unitsAsChild,
    familyById,
    generations,
    measuredWidths,
    measuredPersonWidths,
    ancestorWidths,
    nodes: new Map(),
    placed: new Set(),
    placedFamilies: new Set(),
    familyConnectors: [],
  }

  // 4. Find center partner via FamilyUnit lookup (Step A)
  const centerPartnerId = pickCenterFamily(centerId, familyUnits)

  // 5. Place center couple
  placeNode(centerId, -PARTNER_GAP / 2, 0, ctx)
  if (centerPartnerId) {
    placeNode(centerPartnerId, PARTNER_GAP / 2, 0, ctx)
    addLink(ctx.nodes, centerId, centerPartnerId, 'partner')
  }

  // 6. Place center couple's children (families where center or partner is parent)
  const centerFamilies = unitsAsParent.get(centerId) ?? []
  for (const family of centerFamilies) {
    if (ctx.placedFamilies.has(family.id)) continue
    // Center the children between the center couple
    const familyCenterX = centerPartnerId ? 0 : -PARTNER_GAP / 2
    placeFamily(family, familyCenterX, 0, ctx)
  }
  // Also place families where partner is parent (but center isn't)
  if (centerPartnerId) {
    const partnerFamilies = unitsAsParent.get(centerPartnerId) ?? []
    for (const family of partnerFamilies) {
      if (ctx.placedFamilies.has(family.id)) continue
      placeFamily(family, 0, 0, ctx)
    }
  }

  // 7. Place center person's ancestors (LEFT side, direction = -1)
  const centerNodePlaced = ctx.nodes.get(centerId)
  if (centerNodePlaced) {
    placeAncestors(centerId, centerNodePlaced.x, 0, -1, ctx)
  }

  // 8. Place center partner's ancestors (RIGHT side, direction = +1)
  if (centerPartnerId) {
    const partnerNode = ctx.nodes.get(centerPartnerId)
    if (partnerNode) {
      placeAncestors(centerPartnerId, partnerNode.x, 0, +1, ctx)
    }
  }

  // 9. Warn about unplaced persons (Step C: no fallback positions)
  for (const [personId] of personMap) {
    if (!ctx.placed.has(personId)) {
      console.warn(`[TreeLayout] Person "${personId}" was not placed by family traversal.`)
    }
  }

  return {
    nodes: Array.from(ctx.nodes.values()),
    families: ctx.familyConnectors,
  }
}

// --- Measure pass ---

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

/**
 * Measure the subtree width of a single person.
 *
 * - If the person has NO families where they are a parent -> CARD_SLOT (one card slot).
 * - If the person has families -> return the MAX width across all their families.
 * - Uses `visited` set to prevent infinite recursion (cycle protection).
 */
export function measurePerson(
  personId: string,
  unitsAsParent: Map<string, FamilyUnit[]>,
  measuredWidths: Map<string, number>,
  visited: Set<string>,
): number {
  if (visited.has(personId)) return CARD_SLOT
  visited.add(personId)

  const families = unitsAsParent.get(personId)
  if (!families || families.length === 0) {
    return CARD_SLOT
  }

  let maxWidth = 0
  for (const family of families) {
    const w = measureFamily(family.id, family, unitsAsParent, measuredWidths, visited)
    if (w > maxWidth) maxWidth = w
  }

  return maxWidth
}

/**
 * Measure the width of a single FamilyUnit.
 *
 * parentBlockWidth:
 *   1 parent  -> CARD_SLOT (160)
 *   2 parents -> PARTNER_GAP + CARD_WIDTH + CARD_MARGIN (320)
 *
 * If no children -> parentBlockWidth
 * Otherwise -> max(parentBlockWidth, sum(childWidths) + CHILD_GAP * (childCount - 1))
 */
export function measureFamily(
  familyId: string,
  familyUnit: FamilyUnit | undefined,
  unitsAsParent: Map<string, FamilyUnit[]>,
  measuredWidths: Map<string, number>,
  visited: Set<string>,
): number {
  // Return cached result if available
  const cached = measuredWidths.get(familyId)
  if (cached !== undefined) return cached

  if (!familyUnit) return CARD_SLOT

  const parentCount = familyUnit.parentIds.length
  const parentBlockWidth = parentCount === 1
    ? CARD_SLOT
    : PARTNER_GAP + CARD_WIDTH + CARD_MARGIN

  if (familyUnit.childIds.length === 0) {
    measuredWidths.set(familyId, parentBlockWidth)
    return parentBlockWidth
  }

  const childWidths = familyUnit.childIds.map(childId =>
    measurePerson(childId, unitsAsParent, measuredWidths, visited)
  )
  const childrenTotal = childWidths.reduce((sum, w) => sum + w, 0)
    + CHILD_GAP * (familyUnit.childIds.length - 1)

  const width = Math.max(parentBlockWidth, childrenTotal)
  measuredWidths.set(familyId, width)
  return width
}

/**
 * Measure all family units and return a map of familyUnitId -> measured width.
 * This is the top-level entry point for the measure pass.
 */
export function measureAllFamilies(
  familyUnits: FamilyUnit[],
): Map<string, number> {
  const { unitsAsParent } = buildFamilyLookups(familyUnits)
  const measuredWidths = new Map<string, number>()
  const visited = new Set<string>()

  for (const unit of familyUnits) {
    if (!measuredWidths.has(unit.id)) {
      measureFamily(unit.id, unit, unitsAsParent, measuredWidths, visited)
    }
  }

  return measuredWidths
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
): Map<string, number> {
  const generations = new Map<string, number>()
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
