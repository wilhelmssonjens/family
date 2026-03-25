import { describe, it, expect } from 'vitest'
import { buildFamilyUnits, type FamilyUnit } from '../../utils/buildTree'
import type { Person, Relationship } from '../../types'
import {
  defaultLayoutConfig,
  measureFamilyV3,
  measurePersonDescendants,
  measureAncestorWidth,
  measureAllV3,
} from './measureLayout'

// --- Helpers ---

let nextId = 0
function makePerson(overrides: Partial<Person> & { id: string }): Person {
  nextId++
  return {
    firstName: overrides.id,
    lastName: 'Test',
    birthName: null,
    birthDate: null,
    birthPlace: null,
    deathDate: null,
    deathPlace: null,
    gender: 'male',
    occupation: null,
    photos: [],
    stories: [],
    contactInfo: null,
    familySide: 'jens',
    ...overrides,
  }
}

function buildUnitsAndLookups(persons: Person[], relationships: Relationship[]) {
  const familyUnits = buildFamilyUnits(persons, relationships)

  const familiesByParent = new Map<string, FamilyUnit[]>()
  const familiesByChild = new Map<string, FamilyUnit[]>()

  for (const unit of familyUnits) {
    for (const parentId of unit.parentIds) {
      let list = familiesByParent.get(parentId)
      if (!list) {
        list = []
        familiesByParent.set(parentId, list)
      }
      list.push(unit)
    }
    for (const childId of unit.childIds) {
      let list = familiesByChild.get(childId)
      if (!list) {
        list = []
        familiesByChild.set(childId, list)
      }
      list.push(unit)
    }
  }

  return { familyUnits, familiesByParent, familiesByChild }
}

// --- Tests ---

describe('measureLayout', () => {
  const config = defaultLayoutConfig()
  // cardSlot = cardWidth + cardMargin = 140 + 20 = 160
  const CARD_SLOT = config.cardWidth + config.cardMargin // 160
  // parentBlockWidth for 2 parents = partnerGap + cardWidth + cardMargin = 160 + 140 + 20 = 320
  const COUPLE_WIDTH = config.partnerGap + config.cardWidth + config.cardMargin // 320

  describe('defaultLayoutConfig', () => {
    it('returns expected default values', () => {
      expect(config.generationGap).toBe(250)
      expect(config.partnerGap).toBe(160)
      expect(config.cardMargin).toBe(20)
      expect(config.childGap).toBe(60)
      expect(config.cardWidth).toBe(140)
      expect(config.cardHeight).toBe(90)
    })
  })

  describe('measurePersonDescendants', () => {
    it('returns cardSlot for a leaf person (no families as parent)', () => {
      const alice = makePerson({ id: 'alice' })
      const { familiesByParent } = buildUnitsAndLookups([alice], [])
      const memo = new Map<string, number>()

      const width = measurePersonDescendants('alice', familiesByParent, config, memo)

      expect(width).toBe(CARD_SLOT) // 160
    })

    it('returns parentBlockWidth for a couple without children', () => {
      const alice = makePerson({ id: 'alice' })
      const bob = makePerson({ id: 'bob' })
      const rels: Relationship[] = [
        { type: 'partner', from: 'alice', to: 'bob' },
      ]
      const { familyUnits, familiesByParent } = buildUnitsAndLookups(
        [alice, bob],
        rels,
      )
      const memo = new Map<string, number>()

      // The couple forms a family where both are parents
      expect(familyUnits.length).toBe(1)
      const familyWidth = measureFamilyV3(
        familyUnits[0].id,
        familyUnits[0],
        familiesByParent,
        config,
        memo,
      )

      expect(familyWidth).toBe(COUPLE_WIDTH) // 320
    })

    it('returns correct width for a family with 2 leaf children', () => {
      const alice = makePerson({ id: 'alice' })
      const bob = makePerson({ id: 'bob' })
      const child1 = makePerson({ id: 'child1' })
      const child2 = makePerson({ id: 'child2' })
      const rels: Relationship[] = [
        { type: 'partner', from: 'alice', to: 'bob' },
        { type: 'parent', from: 'alice', to: 'child1' },
        { type: 'parent', from: 'bob', to: 'child1' },
        { type: 'parent', from: 'alice', to: 'child2' },
        { type: 'parent', from: 'bob', to: 'child2' },
      ]
      const { familyUnits, familiesByParent } = buildUnitsAndLookups(
        [alice, bob, child1, child2],
        rels,
      )
      const memo = new Map<string, number>()

      const family = familyUnits[0]
      const width = measureFamilyV3(
        family.id,
        family,
        familiesByParent,
        config,
        memo,
      )

      // childRowWidth = 2 * 160 + 60 = 380
      // parentBlockWidth = 320
      // max(320, 380) = 380
      expect(width).toBe(380)
    })

    it('returns correct recursive width for nested families', () => {
      // Grandparent couple -> parent (who has a child)
      const gp1 = makePerson({ id: 'gp1' })
      const gp2 = makePerson({ id: 'gp2' })
      const parent = makePerson({ id: 'parent' })
      const spouse = makePerson({ id: 'spouse' })
      const grandchild = makePerson({ id: 'grandchild' })

      const rels: Relationship[] = [
        { type: 'partner', from: 'gp1', to: 'gp2' },
        { type: 'parent', from: 'gp1', to: 'parent' },
        { type: 'parent', from: 'gp2', to: 'parent' },
        { type: 'partner', from: 'parent', to: 'spouse' },
        { type: 'parent', from: 'parent', to: 'grandchild' },
        { type: 'parent', from: 'spouse', to: 'grandchild' },
      ]
      const { familyUnits, familiesByParent } = buildUnitsAndLookups(
        [gp1, gp2, parent, spouse, grandchild],
        rels,
      )
      const memo = new Map<string, number>()

      // The parent-spouse family has 1 leaf child: width = max(320, 160) = 320
      // The gp family has 1 child (parent) whose descendant width = 320
      // gp family width = max(320, 320) = 320
      const gpFamily = familyUnits.find(f => f.parentIds.includes('gp1'))!
      const gpWidth = measureFamilyV3(
        gpFamily.id,
        gpFamily,
        familiesByParent,
        config,
        memo,
      )

      expect(gpWidth).toBe(COUPLE_WIDTH) // 320
    })

    it('sums widths for a multi-family person (2 partner families)', () => {
      // Person "alex" has 2 partners, each with one child
      const alex = makePerson({ id: 'alex' })
      const partner1 = makePerson({ id: 'partner1' })
      const partner2 = makePerson({ id: 'partner2' })
      const child1 = makePerson({ id: 'child1' })
      const child2 = makePerson({ id: 'child2' })

      const rels: Relationship[] = [
        { type: 'partner', from: 'alex', to: 'partner1' },
        { type: 'parent', from: 'alex', to: 'child1' },
        { type: 'parent', from: 'partner1', to: 'child1' },
        { type: 'partner', from: 'alex', to: 'partner2' },
        { type: 'parent', from: 'alex', to: 'child2' },
        { type: 'parent', from: 'partner2', to: 'child2' },
      ]
      const { familiesByParent } = buildUnitsAndLookups(
        [alex, partner1, partner2, child1, child2],
        rels,
      )
      const memo = new Map<string, number>()

      const width = measurePersonDescendants(
        'alex',
        familiesByParent,
        config,
        memo,
      )

      // Each family: max(320, 160) = 320
      // Total: 320 + 320 + partnerGap(160) = 800
      expect(width).toBe(320 + 320 + config.partnerGap) // 800
    })
  })

  describe('memoization', () => {
    it('returns the same result when measuring the same family twice', () => {
      const alice = makePerson({ id: 'alice' })
      const bob = makePerson({ id: 'bob' })
      const child = makePerson({ id: 'child' })

      const rels: Relationship[] = [
        { type: 'partner', from: 'alice', to: 'bob' },
        { type: 'parent', from: 'alice', to: 'child' },
        { type: 'parent', from: 'bob', to: 'child' },
      ]
      const { familyUnits, familiesByParent } = buildUnitsAndLookups(
        [alice, bob, child],
        rels,
      )
      const memo = new Map<string, number>()

      const family = familyUnits[0]
      const first = measureFamilyV3(
        family.id,
        family,
        familiesByParent,
        config,
        memo,
      )
      const second = measureFamilyV3(
        family.id,
        family,
        familiesByParent,
        config,
        memo,
      )

      expect(first).toBe(second)
      // The memo should contain exactly the family (child has no sub-families)
      expect(memo.has(family.id)).toBe(true)
    })
  })

  describe('order independence', () => {
    it('gives the same result regardless of family measurement order', () => {
      const a = makePerson({ id: 'a' })
      const b = makePerson({ id: 'b' })
      const c = makePerson({ id: 'c' })
      const d = makePerson({ id: 'd' })

      const rels: Relationship[] = [
        { type: 'partner', from: 'a', to: 'b' },
        { type: 'parent', from: 'a', to: 'c' },
        { type: 'parent', from: 'b', to: 'c' },
        { type: 'partner', from: 'c', to: 'd' },
      ]
      const { familyUnits, familiesByParent } = buildUnitsAndLookups(
        [a, b, c, d],
        rels,
      )

      // Measure in forward order
      const memo1 = new Map<string, number>()
      for (const unit of familyUnits) {
        measureFamilyV3(unit.id, unit, familiesByParent, config, memo1)
      }

      // Measure in reverse order
      const memo2 = new Map<string, number>()
      const reversed = [...familyUnits].reverse()
      for (const unit of reversed) {
        measureFamilyV3(unit.id, unit, familiesByParent, config, memo2)
      }

      // Results should be identical
      for (const [id, width] of memo1) {
        expect(memo2.get(id)).toBe(width)
      }
    })
  })

  describe('single parent family', () => {
    it('returns cardSlot for single parent with no children', () => {
      // A single parent family is created when a child has only one parent
      const parent = makePerson({ id: 'parent' })
      const child = makePerson({ id: 'child' })

      const rels: Relationship[] = [
        { type: 'parent', from: 'parent', to: 'child' },
      ]
      const { familyUnits, familiesByParent } = buildUnitsAndLookups(
        [parent, child],
        rels,
      )
      const memo = new Map<string, number>()

      const family = familyUnits[0]
      expect(family.parentIds.length).toBe(1)

      const width = measureFamilyV3(
        family.id,
        family,
        familiesByParent,
        config,
        memo,
      )

      // parentBlockWidth = CARD_SLOT = 160 (single parent)
      // childRowWidth = 160 (single leaf child)
      // max(160, 160) = 160
      expect(width).toBe(CARD_SLOT) // 160
    })
  })

  describe('measureAncestorWidth', () => {
    it('returns own descendant width for person with no parents', () => {
      const alice = makePerson({ id: 'alice' })
      const { familiesByParent, familiesByChild } = buildUnitsAndLookups(
        [alice],
        [],
      )

      const personWidths = new Map<string, number>()
      personWidths.set(
        'alice',
        measurePersonDescendants('alice', familiesByParent, config, new Map()),
      )

      const cache = new Map<string, number>()
      const width = measureAncestorWidth(
        'alice',
        familiesByChild,
        familiesByParent,
        config,
        personWidths,
        cache,
      )

      expect(width).toBe(CARD_SLOT) // 160
    })

    it('accounts for sibling row in ancestor measurement', () => {
      // Two parents with 3 children: alice, bob, charlie
      const mom = makePerson({ id: 'mom' })
      const dad = makePerson({ id: 'dad' })
      const alice = makePerson({ id: 'alice', birthDate: '1990-01-01' })
      const bob = makePerson({ id: 'bob', birthDate: '1992-01-01' })
      const charlie = makePerson({ id: 'charlie', birthDate: '1994-01-01' })

      const rels: Relationship[] = [
        { type: 'partner', from: 'mom', to: 'dad' },
        { type: 'parent', from: 'mom', to: 'alice' },
        { type: 'parent', from: 'dad', to: 'alice' },
        { type: 'parent', from: 'mom', to: 'bob' },
        { type: 'parent', from: 'dad', to: 'bob' },
        { type: 'parent', from: 'mom', to: 'charlie' },
        { type: 'parent', from: 'dad', to: 'charlie' },
      ]
      const { familiesByParent, familiesByChild } = buildUnitsAndLookups(
        [mom, dad, alice, bob, charlie],
        rels,
      )

      // Build person widths (all leaf children)
      const personWidths = new Map<string, number>()
      const famMemo = new Map<string, number>()
      for (const id of ['mom', 'dad', 'alice', 'bob', 'charlie']) {
        personWidths.set(
          id,
          measurePersonDescendants(id, familiesByParent, config, famMemo),
        )
      }

      const cache = new Map<string, number>()
      const aliceAncWidth = measureAncestorWidth(
        'alice',
        familiesByChild,
        familiesByParent,
        config,
        personWidths,
        cache,
      )

      // Sibling row width: 3 * 160 + 2 * 60 = 600
      // Parent ancestor total: mom(160) + dad(160) + partnerGap(160) = 480
      // (mom and dad have no parents themselves, so their ancestor widths = their own descendant widths)
      // Wait - mom and dad's ancestor widths: they have no parents, so it's their own personWidth
      // mom's personWidth: she is parent in a family with 3 children -> max(320, 3*160+2*60) = max(320, 600) = 600
      // dad's personWidth: same -> 600
      // parentAncestorTotal: 600 + 600 + 160 = 1360
      // max(600, 1360) = 1360
      const momDescendantWidth = personWidths.get('mom')!
      const dadDescendantWidth = personWidths.get('dad')!
      const siblingRowWidth =
        3 * CARD_SLOT + 2 * config.childGap // 3*160 + 2*60 = 600
      const parentAncestorTotal =
        momDescendantWidth + dadDescendantWidth + config.partnerGap

      expect(aliceAncWidth).toBe(
        Math.max(siblingRowWidth, parentAncestorTotal),
      )
    })
  })

  describe('measureAllV3', () => {
    it('returns all three maps with correct entries', () => {
      const alice = makePerson({ id: 'alice' })
      const bob = makePerson({ id: 'bob' })
      const child = makePerson({ id: 'child' })

      const rels: Relationship[] = [
        { type: 'partner', from: 'alice', to: 'bob' },
        { type: 'parent', from: 'alice', to: 'child' },
        { type: 'parent', from: 'bob', to: 'child' },
      ]
      const familyUnits = buildFamilyUnits(
        [alice, bob, child],
        rels,
      )

      const result = measureAllV3(familyUnits, config)

      // familyWidths: 1 family
      expect(result.familyWidths.size).toBe(1)

      // personWidths: 3 persons
      expect(result.personWidths.size).toBe(3)
      expect(result.personWidths.has('alice')).toBe(true)
      expect(result.personWidths.has('bob')).toBe(true)
      expect(result.personWidths.has('child')).toBe(true)

      // ancestorWidths: 3 persons
      expect(result.ancestorWidths.size).toBe(3)

      // child is a leaf: descendant width = 160
      expect(result.personWidths.get('child')).toBe(CARD_SLOT)

      // alice and bob each have 1 family with 1 child: max(320, 160) = 320
      expect(result.personWidths.get('alice')).toBe(COUPLE_WIDTH)
      expect(result.personWidths.get('bob')).toBe(COUPLE_WIDTH)
    })

    it('handles empty family units', () => {
      const result = measureAllV3([], config)

      expect(result.familyWidths.size).toBe(0)
      expect(result.personWidths.size).toBe(0)
      expect(result.ancestorWidths.size).toBe(0)
    })
  })
})
