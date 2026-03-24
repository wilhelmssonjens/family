import { buildFamilyGraph, type FamilyGraph } from '../../utils/buildTree'
import { CARD_WIDTH, CARD_HEIGHT } from '../PersonCard/PersonCardMini'
import type { Person, Relationship, LayoutNode, LayoutLink, FamilyGroup, GroupChild, GroupFrame, BackboneLink, TreeLayoutResult } from '../../types'

const GENERATION_GAP = 160
const PARTNER_GAP = 160
const CARD_MARGIN = 20
const CHILD_GAP = 40
const GROUP_PADDING = 20
const BACKBONE_GAP = 60

/**
 * Group-based tree layout.
 *
 * 1. Build the family graph
 * 2. Build the group tree (center group + ancestor groups)
 * 3. Calculate group widths bottom-up
 * 4. Place groups top-down, producing LayoutNodes, GroupFrames, and BackboneLinks
 *
 * Returns a TreeLayoutResult (breaking change from the old LayoutNode[] return type).
 */
export function computeTreeLayout(
  persons: Person[],
  relationships: Relationship[],
  centerId: string,
): TreeLayoutResult {
  const graph = buildFamilyGraph(persons, relationships)
  const { center, ancestorGroups } = buildGroupTree(graph, centerId)

  calculateGroupWidths(center)
  for (const group of ancestorGroups.values()) {
    calculateGroupWidths(group)
  }

  const result = placeGroups(center, ancestorGroups, graph)

  // Post-placement: resolve cross-group overlaps on each row
  resolveRowOverlaps(result.nodes)

  return result
}


/**
 * Simple row-based overlap resolution.
 * Groups nodes by y, sorts by x within each row, and shifts
 * rightward any nodes that are too close to their left neighbor.
 */
function resolveRowOverlaps(nodes: LayoutNode[]): void {
  const minSpacing = CARD_WIDTH + CARD_MARGIN

  const rows = new Map<number, LayoutNode[]>()
  for (const node of nodes) {
    const row = rows.get(node.y) ?? []
    row.push(node)
    rows.set(node.y, row)
  }

  for (const row of rows.values()) {
    if (row.length < 2) continue
    row.sort((a, b) => a.x - b.x)
    for (let i = 1; i < row.length; i++) {
      const gap = row[i].x - row[i - 1].x
      if (gap < minSpacing) {
        const shift = minSpacing - gap
        // Shift this node and all subsequent nodes on the row
        for (let j = i; j < row.length; j++) {
          row[j].x += shift
        }
      }
    }
  }
}

// --- Group-based tree building ---

export interface GroupTreeResult {
  center: FamilyGroup
  ancestorGroups: Map<string, FamilyGroup>
}

/**
 * BFS from descendantId upward through parentIds.
 * Returns true if personId is found as an ancestor of descendantId.
 */
export function isAncestorOf(
  graph: FamilyGraph,
  personId: string,
  descendantId: string,
): boolean {
  const visited = new Set<string>()
  const queue = [descendantId]
  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)
    const node = graph.get(current)
    if (!node) continue
    for (const pid of node.parentIds) {
      if (pid === personId) return true
      queue.push(pid)
    }
  }
  return false
}

/**
 * Build a recursive FamilyGroup tree starting from the center couple,
 * expanding UPWARD through ancestors.
 *
 * Returns the center group and a map from personId to their parent's FamilyGroup.
 * ancestorGroups.get('jens') = the group where Jens's parents are the parents
 * (i.e., Per+Laila group, with Jens as a backbone child).
 */
export function buildGroupTree(
  graph: FamilyGraph,
  centerId: string,
): GroupTreeResult {
  const ancestorGroups = new Map<string, FamilyGroup>()
  const visited = new Set<string>()

  const centerNode = graph.get(centerId)
  if (!centerNode) {
    return {
      center: { parents: [centerId], children: [], width: 0, height: 0, x: 0, y: 0 },
      ancestorGroups,
    }
  }

  // Build center group: centerId + their partner
  const partnerId = centerNode.partnerIds[0] ?? null
  const centerParents = partnerId ? [centerId, partnerId] : [centerId]
  centerParents.forEach(id => visited.add(id))

  // Center group's children (the center couple's actual children)
  const centerChildIds = collectChildIds(centerParents, graph)
  const centerChildren: GroupChild[] = Array.from(centerChildIds)
    .filter(id => !visited.has(id))
    .map(id => {
      visited.add(id)
      return { type: 'leaf' as const, personId: id }
    })

  const centerGroup: FamilyGroup = {
    parents: centerParents,
    children: centerChildren,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
  }

  // Build ancestor groups for each person in the center couple
  const centerCoupleIds = new Set(centerParents)
  for (const personId of centerParents) {
    buildAncestorGroup(personId, centerId, centerCoupleIds, graph, visited, ancestorGroups)
  }

  return { center: centerGroup, ancestorGroups }
}

/**
 * Recursively calculate the width of each FamilyGroup, bottom-up.
 * Children are calculated first so their widths are available when computing the parent group.
 * Mutates the `width` field on the group and all nested groups.
 */
export function calculateGroupWidths(group: FamilyGroup): void {
  // Bottom-up: calculate children first
  for (const child of group.children) {
    if ((child.type === 'subgroup' || child.type === 'backbone') && child.group) {
      calculateGroupWidths(child.group)
    }
  }

  const parentRowWidth = group.parents.length >= 2
    ? PARTNER_GAP + CARD_WIDTH + CARD_MARGIN
    : CARD_WIDTH + CARD_MARGIN

  const childWidths = group.children.map(c =>
    c.type === 'leaf' ? CARD_WIDTH + CARD_MARGIN : c.group.width
  )
  const childrenRowWidth = childWidths.length > 0
    ? childWidths.reduce((s, w) => s + w, 0) + (childWidths.length - 1) * CHILD_GAP
    : 0

  group.width = Math.max(parentRowWidth, childrenRowWidth) + 2 * GROUP_PADDING
}

/**
 * Top-down placement of family groups.
 *
 * Places the center group at (0, 0), then recursively places ancestor groups
 * above the persons they connect to. Returns positioned LayoutNodes, GroupFrames,
 * and BackboneLinks connecting duplicate backbone person representations.
 */
export function placeGroups(
  center: FamilyGroup,
  ancestorGroups: Map<string, FamilyGroup>,
  graph: FamilyGraph,
): TreeLayoutResult {
  const placedNodes = new Map<string, LayoutNode>()
  const groupFrames: GroupFrame[] = []
  const backboneLinks: BackboneLink[] = []

  // Track backbone child positions separately (these are secondary positions)
  const backboneChildPositions = new Map<string, { x: number; y: number }>()

  /**
   * Place a person as a LayoutNode at the given position.
   * If the person is already placed (as a parent in their own group), skip.
   */
  function emitNode(personId: string, x: number, y: number): void {
    if (placedNodes.has(personId)) return
    const familyNode = graph.get(personId)
    if (!familyNode) return
    placedNodes.set(personId, { personId, person: familyNode.person, x, y, links: [] })
  }

  /**
   * Add a link to a node's links array.
   */
  function emitLink(fromId: string, toId: string, type: LayoutLink['type']): void {
    const from = placedNodes.get(fromId)
    if (from) {
      from.links.push({ targetId: toId, type })
    }
  }

  /**
   * Place the contents of a single FamilyGroup: parents at topY, children below.
   * Returns the positions of all persons placed within this group.
   */
  function placeGroupContents(
    group: FamilyGroup,
    centerX: number,
    topY: number,
  ): void {
    // Place parents — use dynamic partner gap to prevent ancestor group overlaps
    if (group.parents.length >= 2) {
      // Check if each parent has an ancestor group that needs room above them
      const p0ancestor = ancestorGroups.get(group.parents[0])
      const p1ancestor = ancestorGroups.get(group.parents[1])
      const p0halfWidth = p0ancestor ? p0ancestor.width / 2 : CARD_WIDTH / 2
      const p1halfWidth = p1ancestor ? p1ancestor.width / 2 : CARD_WIDTH / 2
      const effectivePartnerGap = Math.max(PARTNER_GAP, p0halfWidth + p1halfWidth + CHILD_GAP)

      const p0x = centerX - effectivePartnerGap / 2
      const p1x = centerX + effectivePartnerGap / 2
      emitNode(group.parents[0], p0x, topY)
      emitNode(group.parents[1], p1x, topY)
      emitLink(group.parents[0], group.parents[1], 'partner')
    } else if (group.parents.length === 1) {
      emitNode(group.parents[0], centerX, topY)
    }

    // If no children: only emit frame if at least one parent was actually placed here
    // (backbone child groups often have no new nodes to place)
    if (group.children.length === 0) {
      const anyParentPlacedHere = group.parents.some(pid => {
        const node = placedNodes.get(pid)
        return node && Math.abs(node.x - centerX) < PARTNER_GAP && Math.abs(node.y - topY) < 1
      })
      if (anyParentPlacedHere) {
        const height = CARD_HEIGHT + 2 * GROUP_PADDING
        groupFrames.push({
          x: centerX - group.width / 2,
          y: topY - GROUP_PADDING,
          width: group.width,
          height,
        })
      }
      return
    }

    // Place children below
    const childrenY = topY + GENERATION_GAP

    // Calculate total width of all children
    const childWidths = group.children.map(c =>
      c.type === 'leaf' ? CARD_WIDTH + CARD_MARGIN : c.group.width
    )
    const totalChildWidth = childWidths.reduce((s, w) => s + w, 0)
      + (childWidths.length - 1) * CHILD_GAP

    let startX = centerX - totalChildWidth / 2

    for (let i = 0; i < group.children.length; i++) {
      const child = group.children[i]
      const childWidth = childWidths[i]

      const childCenterX = startX + childWidth / 2

      if (child.type === 'leaf') {
        emitNode(child.personId, childCenterX, childrenY)

        // Add parent-child links
        for (const parentId of group.parents) {
          emitLink(parentId, child.personId, 'parent-child')
        }
      } else if (child.type === 'backbone') {
        // Backbone child: record their position for backbone link,
        // but DON'T emit a LayoutNode here (they'll be emitted as a parent
        // in the group closer to center, or they're the center person).
        backboneChildPositions.set(child.personId, { x: childCenterX, y: childrenY })

        // Add parent-child links from this group's parents.
        for (const parentId of group.parents) {
          emitLink(parentId, child.personId, 'parent-child')
        }

        // Recursively place the backbone child's group contents (their family)
        placeGroupContents(child.group, childCenterX, childrenY)
      } else {
        // subgroup
        placeGroupContents(child.group, childCenterX, childrenY)

        // Add parent-child links from this group's parents to the subgroup's parent(s)
        for (const parentId of group.parents) {
          emitLink(parentId, child.personId, 'parent-child')
        }
      }

      startX += childWidth + CHILD_GAP
    }

    // Emit group frame
    const height = GENERATION_GAP + CARD_HEIGHT + 2 * GROUP_PADDING
    groupFrames.push({
      x: centerX - group.width / 2,
      y: topY - GROUP_PADDING,
      width: group.width,
      height,
    })
  }

  /**
   * Place ancestor groups recursively above a person.
   */
  function placeAncestors(
    personId: string,
    personX: number,
    personY: number,
  ): void {
    const ancestorGroup = ancestorGroups.get(personId)
    if (!ancestorGroup) return

    // Calculate the ancestor group's height
    const groupHasChildren = ancestorGroup.children.length > 0
    const groupHeight = groupHasChildren
      ? GENERATION_GAP + CARD_HEIGHT + 2 * GROUP_PADDING
      : CARD_HEIGHT + 2 * GROUP_PADDING

    // Place the ancestor group above the person
    const ancestorGroupTop = personY - BACKBONE_GAP - groupHeight + GROUP_PADDING

    placeGroupContents(ancestorGroup, personX, ancestorGroupTop)

    // Find the backbone child position and emit an orthogonal backbone link
    const backbonePos = backboneChildPositions.get(personId)
    const primaryNode = placedNodes.get(personId)
    if (backbonePos && primaryNode) {
      const fromX = backbonePos.x
      const fromY = backbonePos.y + CARD_HEIGHT / 2
      const toX = primaryNode.x
      const toY = primaryNode.y - CARD_HEIGHT / 2
      const midY = (fromY + toY) / 2
      // Orthogonal path: down → horizontal → down
      backboneLinks.push({
        fromPersonId: personId,
        toPersonId: personId,
        points: [
          [fromX, fromY],
          [fromX, midY],
          [toX, midY],
          [toX, toY],
        ],
      })
    }

    // Recurse: for each parent in the ancestor group, check if they have ancestors
    for (const parentId of ancestorGroup.parents) {
      const parentNode = placedNodes.get(parentId)
      if (parentNode) {
        placeAncestors(parentId, parentNode.x, ancestorGroupTop)
      }
    }
  }

  // 1. Place center group at (0, 0)
  placeGroupContents(center, 0, 0)

  // 2. Place ancestor groups for each person in the center couple
  for (const parentId of center.parents) {
    const parentNode = placedNodes.get(parentId)
    if (parentNode) {
      placeAncestors(parentId, parentNode.x, parentNode.y)
    }
  }

  return {
    nodes: Array.from(placedNodes.values()),
    groupFrames,
    backboneLinks,
  }
}

/**
 * Collect all child IDs for a set of parents (union of all their childIds).
 */
function collectChildIds(parentIds: string[], graph: FamilyGraph): Set<string> {
  const childIds = new Set<string>()
  for (const pid of parentIds) {
    const node = graph.get(pid)
    if (node) {
      for (const cid of node.childIds) {
        childIds.add(cid)
      }
    }
  }
  return childIds
}

/**
 * Recursively build ancestor groups for a person.
 * Creates a FamilyGroup for the person's parents and stores it in ancestorGroups
 * keyed by the person's ID.
 */
function buildAncestorGroup(
  personId: string,
  centerId: string,
  centerCoupleIds: Set<string>,
  graph: FamilyGraph,
  visited: Set<string>,
  ancestorGroups: Map<string, FamilyGroup>,
): void {
  const node = graph.get(personId)
  if (!node) return

  const parentIds = node.parentIds
  if (parentIds.length === 0) return

  // Build the parent couple: find all parents + their partners
  const groupParents = new Set<string>()
  for (const pid of parentIds) {
    groupParents.add(pid)
    // Include the partner of each parent if they exist
    const parentNode = graph.get(pid)
    if (parentNode) {
      for (const partnerId of parentNode.partnerIds) {
        // Only include partner if they are also a parent of one of the same children
        // or if they are a partner of an already-included parent
        if (!visited.has(partnerId)) {
          groupParents.add(partnerId)
        }
      }
    }
  }

  // Mark all group parents as visited
  const groupParentIds = Array.from(groupParents)
  groupParentIds.forEach(id => visited.add(id))

  // Collect all children of this parent couple
  const allChildIds = collectChildIds(groupParentIds, graph)

  // Classify each child
  const children: GroupChild[] = []
  for (const childId of allChildIds) {
    // Skip if this child is one of the group parents (shouldn't happen, but safety)
    if (groupParents.has(childId)) continue

    // A child is backbone if they are in the center couple or are an ancestor of centerId
    const isBackboneChild =
      centerCoupleIds.has(childId) || isAncestorOf(graph, childId, centerId)

    if (isBackboneChild) {
      // Backbone child: they connect this group toward center.
      // Build their downstream group (where they are a parent).
      const backboneGroup = buildBackboneChildGroup(childId, graph, visited)
      children.push({ type: 'backbone', personId: childId, group: backboneGroup })
      visited.add(childId)
    } else {
      // Check if child has their own children (subgroup) or is a leaf
      const childNode = graph.get(childId)
      const hasChildren = childNode ? childNode.childIds.length > 0 : false

      if (hasChildren) {
        // Subgroup: single parent (or with partner) who has children
        visited.add(childId)
        const subgroup = buildSubgroup(childId, graph, visited)
        children.push({ type: 'subgroup', personId: childId, group: subgroup })
      } else {
        visited.add(childId)
        children.push({ type: 'leaf', personId: childId })
      }
    }
  }

  const parentGroup: FamilyGroup = {
    parents: groupParentIds,
    children,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
  }

  // Store: ancestorGroups.get(personId) = their parent's group
  ancestorGroups.set(personId, parentGroup)

  // Recurse: for each parent in the group, build their ancestor groups
  for (const pid of groupParentIds) {
    if (!ancestorGroups.has(pid)) {
      buildAncestorGroup(pid, centerId, centerCoupleIds, graph, visited, ancestorGroups)
    }
  }
}

/**
 * Build a placeholder FamilyGroup for a backbone child.
 * This represents the group where the backbone person is a PARENT.
 * The actual content is determined by what's already been built closer to center.
 */
function buildBackboneChildGroup(
  personId: string,
  graph: FamilyGraph,
  visited: Set<string>,
): FamilyGroup {
  const node = graph.get(personId)
  if (!node) {
    return { parents: [personId], children: [], width: 0, height: 0, x: 0, y: 0 }
  }

  // The backbone person's group includes them and their partner
  const groupParents = [personId]
  for (const partnerId of node.partnerIds) {
    if (!visited.has(partnerId)) {
      groupParents.push(partnerId)
    }
  }

  // Children of this backbone person (that aren't already visited)
  const childIds = collectChildIds(groupParents, graph)
  const children: GroupChild[] = Array.from(childIds)
    .filter(id => !visited.has(id) && !groupParents.includes(id))
    .map(id => {
      visited.add(id)
      return { type: 'leaf' as const, personId: id }
    })

  return {
    parents: groupParents,
    children,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
  }
}

/**
 * Build a FamilyGroup for a subgroup child (someone with children but not backbone).
 * E.g., Birgitta who has son Hampus but no partner and is not an ancestor of center.
 */
function buildSubgroup(
  personId: string,
  graph: FamilyGraph,
  visited: Set<string>,
): FamilyGroup {
  const node = graph.get(personId)
  if (!node) {
    return { parents: [personId], children: [], width: 0, height: 0, x: 0, y: 0 }
  }

  // Include partner if they have one and aren't visited
  const groupParents = [personId]
  for (const partnerId of node.partnerIds) {
    if (!visited.has(partnerId)) {
      groupParents.push(partnerId)
      visited.add(partnerId)
    }
  }

  // Collect children
  const childIds = collectChildIds(groupParents, graph)
  const children: GroupChild[] = Array.from(childIds)
    .filter(id => !visited.has(id) && !groupParents.includes(id))
    .map(id => {
      visited.add(id)
      // Recursively check if this child is also a subgroup
      const childNode = graph.get(id)
      if (childNode && childNode.childIds.length > 0) {
        const subgroup = buildSubgroup(id, graph, visited)
        return { type: 'subgroup' as const, personId: id, group: subgroup }
      }
      return { type: 'leaf' as const, personId: id }
    })

  return {
    parents: groupParents,
    children,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
  }
}
