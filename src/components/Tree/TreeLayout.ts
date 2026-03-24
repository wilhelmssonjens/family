import { buildFamilyGraph, buildFamilyUnits, type FamilyUnit } from '../../utils/buildTree'
import { CARD_WIDTH } from '../PersonCard/PersonCardMini'
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
  nodes: Map<string, LayoutNode>
  placed: Set<string>
  placedFamilies: Set<string>
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
 * Place a person and recursively place all families where they are a parent
 * (i.e. their descendants). The person is placed at centerX, and each of
 * their families' children are placed below.
 */
function placePerson(
  personId: string,
  centerX: number,
  generation: number,
  ctx: PlacementContext,
): void {
  if (ctx.placed.has(personId)) return

  placeNode(personId, centerX, generation * GENERATION_GAP, ctx)

  // Place families where this person is a parent
  const families = ctx.unitsAsParent.get(personId) ?? []
  for (const family of families) {
    if (ctx.placedFamilies.has(family.id)) continue
    placeFamily(family, centerX, generation, ctx)
  }
}

/**
 * Place a FamilyUnit: parents centered at centerX on generation row,
 * children distributed below based on measured widths.
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

  if (family.childIds.length === 0) return

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

    // Place child and their descendants recursively
    placePerson(childId, childCenterX, childGeneration, ctx)

    // Add parent-child links
    for (const parentId of family.parentIds) {
      addLink(ctx.nodes, parentId, childId, 'parent-child')
    }

    cursor += width + CHILD_GAP
  }
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

  // Actually place the sibling nodes
  for (let i = 0; i < birthFamily.childIds.length; i++) {
    const childId = birthFamily.childIds[i]
    if (childId !== personId) {
      placePerson(childId, placedChildXs[i], generation, ctx)
    }
  }

  // Place parents above, centered over the full children row
  const minChildX = Math.min(...placedChildXs)
  const maxChildX = Math.max(...placedChildXs)
  const familyCenterX = (minChildX + maxChildX) / 2

  if (birthFamily.parentIds.length >= 2) {
    placeNode(birthFamily.parentIds[0], familyCenterX - PARTNER_GAP / 2, parentGen * GENERATION_GAP, ctx)
    placeNode(birthFamily.parentIds[1], familyCenterX + PARTNER_GAP / 2, parentGen * GENERATION_GAP, ctx)
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

  // Recurse: for each parent, place THEIR ancestors
  // Both parents continue expanding in the same direction
  for (const parentId of birthFamily.parentIds) {
    const parentNode = ctx.nodes.get(parentId)
    if (parentNode) {
      placeAncestors(parentId, parentNode.x, parentGen, direction, ctx)
    }
  }
}

/**
 * Place any remaining unplaced persons. This catches partners who were not
 * placed through the normal traversal (e.g. a partner-only couple with no children
 * where the partner is not an ancestor of the center couple).
 */
function placeRemaining(ctx: PlacementContext): void {
  for (const [personId] of ctx.personMap) {
    if (ctx.placed.has(personId)) continue

    // Try to find a placed partner to place beside
    const families = ctx.unitsAsParent.get(personId) ?? []
    let placed = false
    for (const family of families) {
      const placedPartner = family.parentIds.find(id => id !== personId && ctx.placed.has(id))
      if (placedPartner) {
        const partnerNode = ctx.nodes.get(placedPartner)!
        placeNode(personId, partnerNode.x + PARTNER_GAP, partnerNode.y, ctx)
        addLink(ctx.nodes, placedPartner, personId, 'partner')
        placed = true
        break
      }
    }

    // Also check partner-only families where this person is a parent
    if (!placed) {
      // Check all family units for partner relationships
      for (const [, family] of ctx.familyById) {
        if (!family.parentIds.includes(personId)) continue
        const placedPartner = family.parentIds.find(id => id !== personId && ctx.placed.has(id))
        if (placedPartner) {
          const partnerNode = ctx.nodes.get(placedPartner)!
          placeNode(personId, partnerNode.x + PARTNER_GAP, partnerNode.y, ctx)
          addLink(ctx.nodes, placedPartner, personId, 'partner')
          placed = true
          break
        }
      }
    }

    // Last resort: place at origin
    if (!placed) {
      const gen = ctx.generations.get(personId) ?? 0
      placeNode(personId, 0, gen * GENERATION_GAP, ctx)
    }
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
 * 4. Place center couple at origin
 * 5. Place center couple's children below
 * 6. Place center person's ancestors (LEFT side, x < 0)
 * 7. Place center partner's ancestors (RIGHT side, x > 0)
 * 8. Place any remaining unplaced persons
 */
export function computeTreeLayout(
  persons: Person[],
  relationships: Relationship[],
  centerId: string,
): LayoutNode[] {
  if (persons.length === 0) return []

  const personMap = new Map<string, Person>()
  for (const p of persons) personMap.set(p.id, p)

  if (!personMap.has(centerId)) return []

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

  // Build placement context
  const ctx: PlacementContext = {
    personMap,
    unitsAsParent,
    unitsAsChild,
    familyById,
    generations,
    measuredWidths,
    measuredPersonWidths,
    nodes: new Map(),
    placed: new Set(),
    placedFamilies: new Set(),
  }

  // 4. Find center partner
  const graph = buildFamilyGraph(persons, relationships)
  const centerGraphNode = graph.get(centerId)
  const centerPartnerId = centerGraphNode?.partnerIds[0] ?? null

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

  // 9. Place remaining unplaced persons
  placeRemaining(ctx)

  return Array.from(ctx.nodes.values())
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
