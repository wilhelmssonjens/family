# Subtree-baserad trädlayout — Implementeringsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ersätt den platta radlayouten med en subtree-baserad layout där varje familjegrupp har egen breddberäkning och visuell avgränsning.

**Architecture:** Tre nya rena funktioner (`buildGroupTree`, `calculateGroupWidths`, `placeGroups`) bygger en hierarkisk FamilyGroup-struktur, beräknar bredder bottom-up, och placerar grupper top-down. `computeTreeLayout` returnerar `TreeLayoutResult` med noder, gruppramar och backbone-länkar. TreeView renderar gruppramar och backbone-kopplingar.

**Tech Stack:** React 19, TypeScript, D3.js (SVG), Vitest

**Spec:** `docs/superpowers/specs/2026-03-23-subtree-layout-design.md`

---

## Filstruktur

| Fil | Ansvar | Åtgärd |
|-----|--------|--------|
| `src/types/index.ts` | Nya typer + flytta LayoutNode/LayoutLink hit | Modifiera |
| `src/components/Tree/TreeLayout.ts` | Ny layoutalgoritm | Skriv om |
| `src/components/Tree/TreeLayout.test.ts` | Nya tester (gamla ersätts) | Skriv om |
| `src/components/Tree/TreeView.tsx` | Konsumera TreeLayoutResult, rendera gruppramar + backbone-linjer | Modifiera |
| `src/components/Tree/Minimap.tsx` | Uppdatera import av LayoutNode | Modifiera (import) |

Oförändrade: `src/utils/buildTree.ts`, `src/components/PersonCard/PersonCardMini.tsx`.

---

## Task 1: Lägg till nya typer och flytta LayoutNode

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/components/Tree/TreeLayout.ts` (import)
- Modify: `src/components/Tree/Minimap.tsx` (import)

- [ ] **Step 1: Flytta LayoutLink och LayoutNode från TreeLayout.ts till types/index.ts**

Flytta dessa interfaces från `src/components/Tree/TreeLayout.ts` (rad 5-16) till `src/types/index.ts`:

```typescript
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
```

Uppdatera imports:
- `src/components/Tree/TreeLayout.ts`: `import type { Person, Relationship, LayoutNode, LayoutLink, ... } from '../../types'`
- `src/components/Tree/Minimap.tsx` rad 1: ändra `import type { LayoutNode } from './TreeLayout'` → `import type { LayoutNode } from '../../types'`

- [ ] **Step 2: Lägg till FamilyGroup och relaterade typer i types/index.ts**

```typescript
export type GroupChild =
  | { type: 'leaf'; personId: string }
  | { type: 'subgroup'; personId: string; group: FamilyGroup }
  | { type: 'backbone'; personId: string; group: FamilyGroup }

export interface FamilyGroup {
  parents: string[]
  children: GroupChild[]
  width: number
  height: number
  x: number
  y: number
}

export interface GroupFrame {
  x: number; y: number; width: number; height: number
}

export interface BackboneLink {
  fromPersonId: string
  toPersonId: string
  points: [number, number][]
}

export interface TreeLayoutResult {
  nodes: LayoutNode[]
  groupFrames: GroupFrame[]
  backboneLinks: BackboneLink[]
}
```

- [ ] **Step 3: Verifiera bygge**

Kör: `npx tsc --noEmit`
Förväntat: Inga fel.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/components/Tree/TreeLayout.ts src/components/Tree/Minimap.tsx
git commit -m "refactor(types): add FamilyGroup types, move LayoutNode to types"
```

---

## Task 2: buildGroupTree — bygg gruppträdet

**Files:**
- Modify: `src/components/Tree/TreeLayout.ts`
- Modify: `src/components/Tree/TreeLayout.test.ts`

`buildGroupTree` tar en `FamilyGraph` + `centerId` och returnerar en `FamilyGroup`-rot med nestlade grupper. Algoritmen:

1. Center-gruppen = centerparet + deras barn
2. För varje person i centerparet: hitta föräldrar → skapa föräldragrupp
3. I föräldragruppen: klassificera barn (se `classifyChild` nedan)
4. Backbone-barn får sin grupp satt till den grupp där de är förälder
5. Rekursivt uppåt tills inga fler föräldrar finns

**Hjälpfunktion som behövs:** `isAncestorOf(graph, personId, descendantId)` — BFS/DFS som kontrollerar om `personId` är anfader till `descendantId`. Denna implementeras som ren funktion i TreeLayout.ts.

- [ ] **Step 1: Skriv tester**

```typescript
import { buildGroupTree, isAncestorOf } from './TreeLayout'
import { buildFamilyGraph } from '../../utils/buildTree'
import type { FamilyGroup, Relationship } from '../../types'

describe('isAncestorOf', () => {
  it('returns true for direct parent', () => {
    const p = [makePerson({ id: 'dad' }), makePerson({ id: 'child' })]
    const r: Relationship[] = [{ type: 'parent', from: 'dad', to: 'child' }]
    const graph = buildFamilyGraph(p, r)
    expect(isAncestorOf(graph, 'dad', 'child')).toBe(true)
  })
  it('returns true for grandparent', () => {
    const p = [makePerson({ id: 'gp' }), makePerson({ id: 'parent' }), makePerson({ id: 'child' })]
    const r: Relationship[] = [
      { type: 'parent', from: 'gp', to: 'parent' },
      { type: 'parent', from: 'parent', to: 'child' },
    ]
    const graph = buildFamilyGraph(p, r)
    expect(isAncestorOf(graph, 'gp', 'child')).toBe(true)
  })
  it('returns false for non-ancestor', () => {
    const p = [makePerson({ id: 'a' }), makePerson({ id: 'b' })]
    const r: Relationship[] = []
    const graph = buildFamilyGraph(p, r)
    expect(isAncestorOf(graph, 'a', 'b')).toBe(false)
  })
})

describe('buildGroupTree', () => {
  it('creates center group with partner', () => {
    const p = [makePerson({ id: 'a' }), makePerson({ id: 'b', gender: 'female' })]
    const r: Relationship[] = [{ type: 'partner', from: 'a', to: 'b', status: 'current' }]
    const graph = buildFamilyGraph(p, r)
    const root = buildGroupTree(graph, 'a')
    expect(root.parents).toEqual(['a', 'b'])
    expect(root.children).toEqual([])
  })

  it('builds parent group with backbone and leaf children', () => {
    const p = [
      makePerson({ id: 'child' }),
      makePerson({ id: 'spouse', gender: 'female' }),
      makePerson({ id: 'dad' }),
      makePerson({ id: 'mom', gender: 'female' }),
      makePerson({ id: 'sibling' }),
    ]
    const r: Relationship[] = [
      { type: 'partner', from: 'child', to: 'spouse', status: 'current' },
      { type: 'parent', from: 'dad', to: 'child' },
      { type: 'parent', from: 'mom', to: 'child' },
      { type: 'parent', from: 'dad', to: 'sibling' },
      { type: 'parent', from: 'mom', to: 'sibling' },
      { type: 'partner', from: 'dad', to: 'mom', status: 'current' },
    ]
    const graph = buildFamilyGraph(p, r)
    const root = buildGroupTree(graph, 'child')

    expect(root.parents).toContain('child')
    // Find dad+mom group via backbone
    const dadGroup = findGroupByParent(root, 'dad')
    expect(dadGroup).toBeDefined()
    const types = dadGroup!.children.map(c => ({ id: c.personId, type: c.type }))
    expect(types).toContainEqual({ id: 'child', type: 'backbone' })
    expect(types).toContainEqual({ id: 'sibling', type: 'leaf' })
  })

  it('handles single parent with child (subgroup)', () => {
    const p = [
      makePerson({ id: 'center' }),
      makePerson({ id: 'spouse', gender: 'female' }),
      makePerson({ id: 'dad' }),
      makePerson({ id: 'mom', gender: 'female' }),
      makePerson({ id: 'aunt', gender: 'female' }),
      makePerson({ id: 'cousin' }),
    ]
    const r: Relationship[] = [
      { type: 'partner', from: 'center', to: 'spouse', status: 'current' },
      { type: 'parent', from: 'dad', to: 'center' },
      { type: 'parent', from: 'mom', to: 'center' },
      { type: 'parent', from: 'dad', to: 'aunt' },
      { type: 'parent', from: 'mom', to: 'aunt' },
      { type: 'partner', from: 'dad', to: 'mom', status: 'current' },
      { type: 'parent', from: 'aunt', to: 'cousin' },
    ]
    const graph = buildFamilyGraph(p, r)
    const root = buildGroupTree(graph, 'center')
    const dadGroup = findGroupByParent(root, 'dad')!
    const auntChild = dadGroup.children.find(c => c.personId === 'aunt')
    expect(auntChild?.type).toBe('subgroup')
    if (auntChild?.type === 'subgroup') {
      expect(auntChild.group.parents).toEqual(['aunt'])
      expect(auntChild.group.children[0]).toEqual({ type: 'leaf', personId: 'cousin' })
    }
  })
})

function findGroupByParent(group: FamilyGroup, parentId: string): FamilyGroup | undefined {
  for (const child of group.children) {
    if ((child.type === 'backbone' || child.type === 'subgroup') && child.group) {
      if (child.group.parents.includes(parentId)) return child.group
      const found = findGroupByParent(child.group, parentId)
      if (found) return found
    }
  }
  return undefined
}
```

- [ ] **Step 2: Kör test — ska faila**

Kör: `npx vitest run src/components/Tree/TreeLayout.test.ts`

- [ ] **Step 3: Implementera isAncestorOf**

```typescript
export function isAncestorOf(graph: FamilyGraph, personId: string, descendantId: string): boolean {
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
```

- [ ] **Step 4: Implementera buildGroupTree**

```typescript
export function buildGroupTree(graph: FamilyGraph, centerId: string): FamilyGroup {
  const visited = new Set<string>()
  return buildGroupFor(centerId, graph, visited, centerId)
}

function buildGroupFor(
  personId: string,
  graph: FamilyGraph,
  visited: Set<string>,
  centerId: string,
): FamilyGroup {
  const node = graph.get(personId)
  if (!node) return { parents: [personId], children: [], width: 0, height: 0, x: 0, y: 0 }

  // Determine couple
  const partner = node.partnerIds.find(id => !visited.has(id))
  const parents = partner ? [personId, partner] : [personId]
  parents.forEach(id => visited.add(id))

  // Collect children of this couple
  const childIds = new Set<string>()
  for (const pid of parents) {
    const p = graph.get(pid)
    if (p) p.childIds.forEach(c => childIds.add(c))
  }

  // Classify each child
  const children: GroupChild[] = Array.from(childIds).map(cid =>
    classifyChild(cid, graph, visited, centerId)
  )

  // Now expand UPWARD: for each person in this couple, find THEIR parents
  // and build those ancestor groups. Attach them via backbone children.
  for (const pid of parents) {
    const parentNode = graph.get(pid)
    if (!parentNode) continue
    const unvisitedParentIds = parentNode.parentIds.filter(id => !visited.has(id))
    if (unvisitedParentIds.length === 0) continue

    // Build the grandparent group where `pid` is a backbone child
    const grandparentGroup = buildAncestorGroup(pid, graph, visited, centerId)
    // pid appears as a backbone child in grandparentGroup — we need to find
    // the backbone child entry and set its group to THIS group (the one we just built)
    // Actually: pid's backbone entry in grandparentGroup should point to
    // the group we're currently building. But our FamilyGroup doesn't store
    // a reference to its ancestor groups — the ancestor groups store backbone
    // children pointing DOWN.
    //
    // The structure is: grandparentGroup.children has a backbone child for pid,
    // and that backbone child's `group` is the current couple's group.
    // We handle this by letting buildAncestorGroup set up the linkage.
  }

  return { parents, children, width: 0, height: 0, x: 0, y: 0 }
}

function classifyChild(
  childId: string,
  graph: FamilyGraph,
  visited: Set<string>,
  centerId: string,
): GroupChild {
  const childNode = graph.get(childId)

  // Is this child an ancestor of the center person?
  if (isAncestorOf(graph, childId, centerId)) {
    // Backbone child — their own group is built separately during ancestor expansion
    const childGroup = buildGroupFor(childId, graph, new Set(visited), centerId)
    return { type: 'backbone', personId: childId, group: childGroup }
  }

  // Does this child have their own children?
  if (childNode && childNode.childIds.length > 0) {
    const subGroup = buildGroupFor(childId, graph, new Set(visited), centerId)
    return { type: 'subgroup', personId: childId, group: subGroup }
  }

  return { type: 'leaf', personId: childId }
}
```

**Notera:** `buildGroupFor` och `classifyChild` hanterar rekursion med visited-set för att undvika cykler. Backbone-barn och subgroup-barn får egna nestlade FamilyGroup-objekt.

- [ ] **Step 5: Kör tester — ska passa**
- [ ] **Step 6: Commit**

```bash
git add src/components/Tree/TreeLayout.ts src/components/Tree/TreeLayout.test.ts
git commit -m "feat(tree): add buildGroupTree and isAncestorOf with tests"
```

---

## Task 3: calculateGroupWidths — bottom-up breddberäkning

**Files:**
- Modify: `src/components/Tree/TreeLayout.ts`
- Modify: `src/components/Tree/TreeLayout.test.ts`

- [ ] **Step 1: Skriv tester**

```typescript
import { calculateGroupWidths } from './TreeLayout'

describe('calculateGroupWidths', () => {
  it('couple with one leaf child', () => {
    const group: FamilyGroup = {
      parents: ['a', 'b'], children: [{ type: 'leaf', personId: 'c' }],
      width: 0, height: 0, x: 0, y: 0,
    }
    calculateGroupWidths(group)
    // parentRowWidth=320, childrenRow=160, max=320, +padding(40) = 360
    expect(group.width).toBe(360)
  })

  it('three leaves', () => {
    const group: FamilyGroup = {
      parents: ['a', 'b'],
      children: [
        { type: 'leaf', personId: 'c1' },
        { type: 'leaf', personId: 'c2' },
        { type: 'leaf', personId: 'c3' },
      ],
      width: 0, height: 0, x: 0, y: 0,
    }
    calculateGroupWidths(group)
    // childrenRow = 3*160 + 2*40 = 560, parentRow=320, max=560, +40 = 600
    expect(group.width).toBe(600)
  })

  it('single parent', () => {
    const group: FamilyGroup = {
      parents: ['a'], children: [{ type: 'leaf', personId: 'c' }],
      width: 0, height: 0, x: 0, y: 0,
    }
    calculateGroupWidths(group)
    // parentRow=160, childrenRow=160, max=160, +40 = 200
    expect(group.width).toBe(200)
  })

  it('nested subgroup', () => {
    const sub: FamilyGroup = {
      parents: ['aunt'], children: [{ type: 'leaf', personId: 'cousin' }],
      width: 0, height: 0, x: 0, y: 0,
    }
    const group: FamilyGroup = {
      parents: ['dad', 'mom'],
      children: [
        { type: 'subgroup', personId: 'aunt', group: sub },
        { type: 'leaf', personId: 'uncle' },
      ],
      width: 0, height: 0, x: 0, y: 0,
    }
    calculateGroupWidths(group)
    expect(sub.width).toBe(200)
    // childrenRow = 200 + 160 + 40 = 400, parentRow=320, max=400, +40 = 440
    expect(group.width).toBe(440)
  })
})
```

- [ ] **Step 2: Kör test — ska faila**
- [ ] **Step 3: Implementera**

```typescript
const CHILD_GAP = 40
const GROUP_PADDING = 20

export function calculateGroupWidths(group: FamilyGroup): void {
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
```

- [ ] **Step 4: Kör tester — ska passa**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat(tree): add calculateGroupWidths with tests"
```

---

## Task 4: placeGroups — top-down placering

**Files:**
- Modify: `src/components/Tree/TreeLayout.ts`
- Modify: `src/components/Tree/TreeLayout.test.ts`

- [ ] **Step 1: Skriv tester**

```typescript
import { placeGroups } from './TreeLayout'

describe('placeGroups', () => {
  it('places center group at origin', () => {
    // Simple: just center couple, no children
    const group: FamilyGroup = {
      parents: ['a', 'b'], children: [], width: 360, height: 0, x: 0, y: 0,
    }
    const result = placeGroups(group, graph)
    const a = result.nodes.find(n => n.personId === 'a')
    const b = result.nodes.find(n => n.personId === 'b')
    expect(a).toBeDefined()
    expect(b).toBeDefined()
    expect(a!.y).toBe(0)
    expect(b!.y).toBe(0)
    // Partners should be PARTNER_GAP apart
    expect(Math.abs(a!.x - b!.x)).toBeCloseTo(PARTNER_GAP, 0)
  })

  it('places children below parents within group', () => {
    // Couple + 2 leaf children
    const group: FamilyGroup = {
      parents: ['dad', 'mom'],
      children: [
        { type: 'leaf', personId: 'c1' },
        { type: 'leaf', personId: 'c2' },
      ],
      width: 400, height: 0, x: 0, y: 0,
    }
    const result = placeGroups(group, graph)
    const dad = result.nodes.find(n => n.personId === 'dad')!
    const c1 = result.nodes.find(n => n.personId === 'c1')!
    expect(c1.y).toBeGreaterThan(dad.y) // children below parents
  })

  it('no nodes overlap', () => {
    // Use the full test data with parents + siblings
    const result = placeGroups(fullGroupTree, fullGraph)
    const rows = new Map<number, typeof result.nodes>()
    for (const n of result.nodes) {
      const row = rows.get(n.y) ?? []
      row.push(n)
      rows.set(n.y, row)
    }
    for (const row of rows.values()) {
      if (row.length < 2) continue
      row.sort((a, b) => a.x - b.x)
      for (let i = 1; i < row.length; i++) {
        expect(row[i].x - row[i - 1].x).toBeGreaterThanOrEqual(140)
      }
    }
  })

  it('generates group frames for each FamilyGroup', () => {
    const result = placeGroups(fullGroupTree, fullGraph)
    expect(result.groupFrames.length).toBeGreaterThan(0)
    for (const frame of result.groupFrames) {
      expect(frame.width).toBeGreaterThan(0)
      expect(frame.height).toBeGreaterThan(0)
    }
  })

  it('generates backbone links between groups', () => {
    const result = placeGroups(fullGroupTree, fullGraph)
    expect(result.backboneLinks.length).toBeGreaterThan(0)
  })
})
```

**Notera:** `fullGroupTree` och `fullGraph` byggs i en `beforeAll` med den fullständiga testdatan (jens, klara, föräldrar, syskon) och passeras genom `buildGroupTree` + `calculateGroupWidths`.

- [ ] **Step 2: Kör test — ska faila**
- [ ] **Step 3: Implementera placeGroups**

Signaturen:
```typescript
const BACKBONE_GAP = 120
const GENERATION_GAP = 200

export function placeGroups(
  rootGroup: FamilyGroup,
  graph: FamilyGraph,
): { nodes: LayoutNode[]; groupFrames: GroupFrame[]; backboneLinks: BackboneLink[] }
```

Algoritm:

```typescript
function placeGroupAt(group: FamilyGroup, centerX: number, topY: number, ...): void {
  group.x = centerX
  group.y = topY

  // 1. Place parents at top of group
  if (group.parents.length >= 2) {
    placeNode(group.parents[0], centerX - PARTNER_GAP / 2, topY)
    placeNode(group.parents[1], centerX + PARTNER_GAP / 2, topY)
  } else {
    placeNode(group.parents[0], centerX, topY)
  }

  // 2. Place children below parents, spread horizontally
  const childY = topY + GENERATION_GAP
  let childX = centerX - totalChildrenWidth / 2

  for (const child of group.children) {
    if (child.type === 'leaf') {
      placeNode(child.personId, childX + leafWidth / 2, childY)
      childX += leafWidth + CHILD_GAP
    } else {
      // subgroup or backbone — place the nested group
      const childGroupWidth = child.group.width
      placeGroupAt(child.group, childX + childGroupWidth / 2, childY, ...)
      childX += childGroupWidth + CHILD_GAP
    }
  }

  // 3. Emit GroupFrame for this group
  groupFrames.push({ x: left, y: topY - pad, width: group.width, height: calculatedHeight })

  // 4. For backbone children: emit BackboneLink from this group's
  //    backbone child position to the same person's parent position
  //    in their own group below
}
```

Anropas initialt som:
```typescript
// Start placement: center group expanding UPWARD
// 1. Place center group at y=0
// 2. For each backbone child's parent group: place ABOVE (negative y)
//    at y = centerGroup.y - BACKBONE_GAP - parentGroup.height
```

**Nyckelkoordinatmatematik:**
- Föräldrapar: `centerX ± PARTNER_GAP/2`
- Barn: utspridda horisontellt centrerade under föräldraparet
- Varje barns x-position: `groupLeftEdge + GROUP_PADDING + ackumulerad bredd`
- Backbone-barn placeras närmast center-sidan (höger i Jens-sidan, vänster i Klara-sidan)

- [ ] **Step 4: Kör tester — ska passa**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat(tree): add placeGroups with tests"
```

---

## Task 5: Ny computeTreeLayout + ta bort gammal kod

**Files:**
- Modify: `src/components/Tree/TreeLayout.ts`
- Modify: `src/components/Tree/TreeLayout.test.ts`

- [ ] **Step 1: Ta bort alla gamla tester**

Ta bort hela den gamla `describe('computeTreeLayout', ...)` blocket i `TreeLayout.test.ts`.

- [ ] **Step 2: Skriv nya integrationstester**

```typescript
describe('computeTreeLayout (integration)', () => {
  const persons = [jens, klara, jensFather, jensMother, klaraFather, klaraMother, jensSibling]
  const relationships = [ /* ... befintlig testdata ... */ ]

  it('returns TreeLayoutResult with all persons as nodes', () => {
    const result = computeTreeLayout(persons, relationships, 'jens')
    const ids = result.nodes.map(n => n.personId).sort()
    expect(ids).toEqual(persons.map(p => p.id).sort())
  })

  it('returns groupFrames', () => {
    const result = computeTreeLayout(persons, relationships, 'jens')
    expect(result.groupFrames.length).toBeGreaterThan(0)
  })

  it('returns backboneLinks', () => {
    const result = computeTreeLayout(persons, relationships, 'jens')
    expect(result.backboneLinks.length).toBeGreaterThan(0)
  })

  it('parents are above children (negative y)', () => {
    const result = computeTreeLayout(persons, relationships, 'jens')
    const jNode = result.nodes.find(n => n.personId === 'jens')!
    const fNode = result.nodes.find(n => n.personId === 'jens-father')!
    expect(fNode.y).toBeLessThan(jNode.y)
  })

  it('no cards overlap', () => {
    const result = computeTreeLayout(persons, relationships, 'jens')
    const rows = new Map<number, LayoutNode[]>()
    for (const n of result.nodes) {
      const row = rows.get(n.y) ?? []
      row.push(n)
      rows.set(n.y, row)
    }
    for (const row of rows.values()) {
      if (row.length < 2) continue
      row.sort((a, b) => a.x - b.x)
      for (let i = 1; i < row.length; i++) {
        expect(row[i].x - row[i - 1].x).toBeGreaterThanOrEqual(140)
      }
    }
  })
})
```

- [ ] **Step 3: Implementera ny computeTreeLayout**

```typescript
export function computeTreeLayout(
  persons: Person[],
  relationships: Relationship[],
  centerId: string,
): TreeLayoutResult {
  const graph = buildFamilyGraph(persons, relationships)
  const rootGroup = buildGroupTree(graph, centerId)
  calculateGroupWidths(rootGroup)
  return placeGroups(rootGroup, graph)
}
```

- [ ] **Step 4: Ta bort gammal kod**

Ta bort funktionerna som inte längre används:
- `expandAncestorsByGeneration`
- `placeUnvisitedPartners`
- `resolveOverlaps`
- `groupByFamily`
- `recenterParentsOfRow`
- Gamla konstanter som inte längre används (`SIBLING_GAP`, `MAX_RESOLVE_ITERATIONS`, `FAMILY_GROUP_GAP`)

- [ ] **Step 5: Kör tester — ska passa**
- [ ] **Step 6: Commit**

```bash
git commit -m "feat(tree): wire up new computeTreeLayout, remove old algorithm"
```

---

## Task 6: Uppdatera TreeView

**Files:**
- Modify: `src/components/Tree/TreeView.tsx`

- [ ] **Step 1: Konsumera TreeLayoutResult**

Ändra rad ~23:
```typescript
const { nodes, groupFrames, backboneLinks } = computeTreeLayout(persons, relationships, centerId)
```

- [ ] **Step 2: Rendera gruppramar (före personkort i SVG)**

```tsx
{groupFrames.map((frame, i) => (
  <rect
    key={`group-${i}`}
    x={frame.x} y={frame.y} width={frame.width} height={frame.height}
    rx={10} fill="none" stroke="var(--color-card-border)"
    strokeWidth={1} strokeDasharray="6" opacity={0.3}
  />
))}
```

- [ ] **Step 3: Rendera backbone-kopplingar (ortogonala linjer)**

```tsx
{backboneLinks.map((link, i) => (
  <path
    key={`backbone-${i}`}
    d={link.points.map((p, j) => `${j === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ')}
    fill="none" stroke="var(--color-accent)"
    strokeWidth={1.5} strokeDasharray="6" opacity={0.4}
  />
))}
```

- [ ] **Step 4: Kör bygge + visuell verifiering**

```bash
npm run build  # ska lyckas
npm run dev    # verifiera visuellt: 21 personer, gruppramar, backbone-linjer
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(tree): render group frames and backbone links in TreeView"
```

---

## Task 7: Slutlig verifiering, docs, push

- [ ] **Step 1: Kör alla tester**

Kör: `npx vitest run` — alla ska passa.

- [ ] **Step 2: Visuell verifiering**

Verifiera i webbläsaren:
- Alla 21 personer synliga (inklusive Hampus)
- Gruppramar runt: Konrad+Augusta, Gunnar+Barbro, Lennart+Greta, Per+Laila, Tor+Lena, Birgitta (ensam), Jens+Klara
- Backbone-linjer: Jens→Per→Gunnar→Konrad och Jens→Laila→Lennart och Klara→Tor+Lena
- Pan/zoom fungerar

- [ ] **Step 3: Uppdatera docs**

Uppdatera `docs/tree-system.md` och `CLAUDE.md` med det nya layoutsystemet.

- [ ] **Step 4: Commit och push**

```bash
git add -A
git commit -m "docs: update tree system docs for subtree layout"
git push
```
