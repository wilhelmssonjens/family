import type { FamilyUnit } from '../../utils/buildTree'
import type {
  Person,
  VisualPersonNode,
  PositionedFamilyConnectorV3,
  LayoutConfig,
  LayoutBranch,
} from '../../types'
import type { GenerationTable } from './assignGenerations'
import { pickPrimaryBirthFamily } from './familySelection'
import type { MeasureResult } from './measureLayout'

// --- Post-processing: resolve row overlaps ---

// --- Post-processing: family grouping (subtree-aware) ---

/**
 * Ensure siblings from the same birth family are contiguous on each row.
 * Operates per y-level independently — no descendant propagation.
 * The branch resolver handles remaining cross-level alignment.
 */
export function resolveFamilyGrouping(ctx: PlacementContextV3): void {
  const minGap = ctx.config.cardWidth

  // Collect all y-levels
  const yLevels = new Set<number>()
  for (const node of ctx.visualNodes.values()) yLevels.add(node.y)

  for (const y of yLevels) {
    // Find "child" nodes at this y-level, grouped by birth family
    const childNodes = [...ctx.visualNodes.values()]
      .filter(n => n.y === y && n.role === 'child')

    // Group by familyId (birth family)
    const familyGroups = new Map<string, VisualPersonNode[]>()
    for (const n of childNodes) {
      const list = familyGroups.get(n.familyId) ?? []
      list.push(n)
      familyGroups.set(n.familyId, list)
    }

    if (familyGroups.size < 2) continue

    // Sort nodes within each group by x
    for (const nodes of familyGroups.values()) {
      nodes.sort((a, b) => a.x - b.x)
    }

    // Sort groups by leftmost node x
    const sortedGroups = [...familyGroups.entries()]
      .sort(([, a], [, b]) => a[0].x - b[0].x)

    // Push groups apart where they overlap
    for (let i = 1; i < sortedGroups.length; i++) {
      const prevGroup = sortedGroups[i - 1][1]
      const currGroup = sortedGroups[i][1]
      const prevMax = prevGroup[prevGroup.length - 1].x
      const currMin = currGroup[0].x
      const gap = currMin - prevMax

      if (gap < minGap) {
        const shift = minGap - gap
        // Shift this group and all subsequent groups (no descendants)
        for (let j = i; j < sortedGroups.length; j++) {
          for (const node of sortedGroups[j][1]) {
            node.x += shift
          }
        }
      }
    }
  }
}

/** Extra gap inserted between branches for visual clarity */
const BRANCH_GAP = 40

/**
 * After all placement, ensure that right-branch nodes (partner's ancestors)
 * never interleave with left/center nodes (center person's ancestors).
 *
 * Strategy:
 * 1. Per y-level, split nodes into two groups: "main" (left + center) and "right"
 * 2. Resolve internal overlaps within each group independently
 * 3. Shift the entire right group so it starts after the main group + gap
 *
 * Left and center nodes keep their original positions (only pushed apart if
 * they overlap each other). Right nodes are moved as a block.
 *
 * Modifies node positions in-place. Connectors reference VisualPersonNode
 * objects, so they automatically pick up the updated positions.
 */
export function resolveRowOverlaps(ctx: PlacementContextV3): void {
  const byY = new Map<number, VisualPersonNode[]>()
  for (const node of ctx.visualNodes.values()) {
    const list = byY.get(node.y) ?? []
    list.push(node)
    byY.set(node.y, list)
  }

  const minGap = ctx.config.cardWidth // 140px minimum between node centers

  for (const [, nodes] of byY) {
    if (nodes.length < 2) continue

    // 1. Deduplicate same-person: align all instances to leftmost x
    const personX = new Map<string, number>()
    for (const n of nodes) {
      const existing = personX.get(n.personId)
      if (existing === undefined || n.x < existing) {
        personX.set(n.personId, n.x)
      }
    }
    for (const n of nodes) {
      n.x = personX.get(n.personId) ?? n.x
    }

    // 2. Split into main (left + center) and right groups
    const main = nodes.filter(n => n.branch !== 'right')
    const right = nodes.filter(n => n.branch === 'right')

    // 3. Resolve internal overlaps within main group
    resolveGroupOverlaps(main, minGap)

    // 4. Resolve internal overlaps within right group
    resolveGroupOverlaps(right, minGap)

    // 5. Ensure right group is entirely to the right of main group
    if (main.length > 0 && right.length > 0) {
      const maxMain = Math.max(...main.map(n => n.x))
      const minRight = Math.min(...right.map(n => n.x))
      const requiredGap = minGap + BRANCH_GAP

      if (minRight - maxMain < requiredGap) {
        const shift = requiredGap - (minRight - maxMain)
        for (const n of right) {
          n.x += shift
        }
      }
    }
  }
}

/** Resolve overlaps within a group of nodes, preserving relative order. */
function resolveGroupOverlaps(nodes: VisualPersonNode[], minGap: number): void {
  if (nodes.length < 2) return
  nodes.sort((a, b) => a.x - b.x)

  for (let i = 1; i < nodes.length; i++) {
    // Same person at same y = same visual card
    if (nodes[i].personId === nodes[i - 1].personId) {
      nodes[i].x = nodes[i - 1].x
      continue
    }

    const overlap = minGap - (nodes[i].x - nodes[i - 1].x)
    if (overlap > 0) {
      for (let j = i; j < nodes.length; j++) {
        nodes[j].x += overlap
      }
    }
  }
}

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
  currentBranch: LayoutBranch
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
    branch: ctx.currentBranch,
  }

  ctx.visualNodes.set(visualId, node)
  return node
}

/**
 * Find an existing visual node for a person at a given y level.
 * Used to detect when a parent was already placed as a child in a birth family.
 */
function findExistingNodeAtY(
  personId: string,
  y: number,
  ctx: PlacementContextV3,
): VisualPersonNode | null {
  for (const node of ctx.visualNodes.values()) {
    if (node.personId === personId && node.y === y) return node
  }
  return null
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
  childAnchorX?: number,
): void {
  if (ctx.placedFamilies.has(family.id)) return
  ctx.placedFamilies.add(family.id)

  const y = generation * ctx.config.generationGap

  const parentVisualIds: string[] = []

  // Place parents.
  // If a parent was already placed as a child in a birth family at the same y level,
  // reuse that position and place the partner relative to it (no duplicate card).
  if (family.parentIds.length >= 2) {
    const existing0 = findExistingNodeAtY(family.parentIds[0], y, ctx)
    const existing1 = findExistingNodeAtY(family.parentIds[1], y, ctx)

    if (existing0 && !existing1) {
      // Parent 0 already placed as child — partner goes to the right
      parentVisualIds.push(existing0.visualId)
      const n1 = placeVisualNode(
        family.parentIds[1], family.id, 'parent',
        existing0.x + ctx.config.partnerGap, y, ctx,
      )
      if (n1) parentVisualIds.push(n1.visualId)
    } else if (existing1 && !existing0) {
      // Parent 1 already placed as child — partner goes to the left
      const n0 = placeVisualNode(
        family.parentIds[0], family.id, 'parent',
        existing1.x - ctx.config.partnerGap, y, ctx,
      )
      if (n0) parentVisualIds.push(n0.visualId)
      parentVisualIds.push(existing1.visualId)
    } else if (existing0 && existing1) {
      // Both already placed — just reference them
      parentVisualIds.push(existing0.visualId)
      parentVisualIds.push(existing1.visualId)
    } else {
      // Neither placed — normal placement
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
    }
  } else if (family.parentIds.length === 1) {
    const existing0 = findExistingNodeAtY(family.parentIds[0], y, ctx)
    if (existing0) {
      parentVisualIds.push(existing0.visualId)
    } else {
      const n0 = placeVisualNode(
        family.parentIds[0], family.id, 'parent',
        centerX, y, ctx,
      )
      if (n0) parentVisualIds.push(n0.visualId)
    }
  }

  const childGeneration = generation + 1
  const childY = childGeneration * ctx.config.generationGap
  const childVisualIds: string[] = []

  // Compute actual centerX from placed parent positions
  let actualCenterX = centerX
  if (parentVisualIds.length > 0) {
    const parentXs = parentVisualIds
      .map(vid => ctx.visualNodes.get(vid)?.x ?? centerX)
    actualCenterX = parentXs.reduce((sum, x) => sum + x, 0) / parentXs.length
  }

  // Build connector
  const connector: PositionedFamilyConnectorV3 = {
    familyId: family.id,
    parentVisualIds,
    childVisualIds,
    centerX: childAnchorX ?? actualCenterX,
    parentY: y,
    childY,
  }

  if (family.childIds.length === 0) {
    ctx.familyConnectors.push(connector)
    return
  }

  // Distribute children below.
  // Use childAnchorX (if provided) to keep children centered within their
  // allocated column, preventing sibling-group interleaving.
  const childDistCenter = childAnchorX ?? actualCenterX
  const childWidths = family.childIds.map(
    id => ctx.measured.personWidths.get(id) ?? (ctx.config.cardWidth + ctx.config.cardMargin),
  )
  const totalWidth = childWidths.reduce((sum, w) => sum + w, 0)
    + ctx.config.childGap * (family.childIds.length - 1)
  let cursor = childDistCenter - totalWidth / 2

  for (let i = 0; i < family.childIds.length; i++) {
    const childId = family.childIds[i]
    const width = childWidths[i]
    const childCenterX = cursor + width / 2

    const childNode = placeVisualNode(childId, family.id, 'child', childCenterX, childY, ctx)
    if (childNode) childVisualIds.push(childNode.visualId)

    // Recursively place the child's own families (where they are a parent).
    // Propagate childCenterX as anchor so grandchildren also stay in column.
    const childFamilies = ctx.familiesByParent.get(childId) ?? []
    for (const childFamily of childFamilies) {
      if (ctx.placedFamilies.has(childFamily.id)) continue
      placeFamilyV3(childFamily, childCenterX, childGeneration, ctx, childAnchorX != null ? childCenterX : undefined)
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
      // Recursively place the sibling's own families (descendants).
      // Pass sibling's position as childAnchorX to keep descendants in column.
      const siblingFamilies = ctx.familiesByParent.get(childId) ?? []
      for (const sibFamily of siblingFamilies) {
        if (ctx.placedFamilies.has(sibFamily.id)) continue
        placeFamilyV3(sibFamily, placedChildXs[i], generation, ctx, placedChildXs[i])
      }
    }
  }

  // Place parents above, centered over the full children row
  const minChildX = Math.min(...placedChildXs)
  const maxChildX = Math.max(...placedChildXs)
  const familyCenterX = (minChildX + maxChildX) / 2

  // Fixed partner gap — the branch-aware resolver handles overlap.
  const effectiveGap = ctx.config.partnerGap

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

  // Recurse: both parents' ancestors expand in the SAME direction.
  // The branch-aware resolver handles any resulting overlaps.
  if (birthFamily.parentIds.length >= 2) {
    const p0vid = makeVisualId(birthFamily.parentIds[0], birthFamily.id, 'parent')
    const p1vid = makeVisualId(birthFamily.parentIds[1], birthFamily.id, 'parent')
    const p0node = ctx.visualNodes.get(p0vid)
    const p1node = ctx.visualNodes.get(p1vid)
    if (p0node) placeAncestorsV3(birthFamily.parentIds[0], p0node.x, parentGen, direction, ctx)
    if (p1node) placeAncestorsV3(birthFamily.parentIds[1], p1node.x, parentGen, direction, ctx)
  } else if (birthFamily.parentIds.length === 1) {
    const p0vid = makeVisualId(birthFamily.parentIds[0], birthFamily.id, 'parent')
    const p0node = ctx.visualNodes.get(p0vid)
    if (p0node) placeAncestorsV3(birthFamily.parentIds[0], p0node.x, parentGen, direction, ctx)
  }
}
