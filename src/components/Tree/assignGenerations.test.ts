import { describe, it, expect } from 'vitest'
import { buildFamilyUnits, type FamilyUnit } from '../../utils/buildTree'
import type { Person, Relationship } from '../../types'
import { assignGenerations, getGeneration, buildFamilyLookups } from './assignGenerations'

// --- Test helpers ---

function makePerson(id: string, overrides?: Partial<Person>): Person {
  return {
    id,
    firstName: id.charAt(0).toUpperCase() + id.slice(1),
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

// --- Test data ---

function buildTestData() {
  const persons: Person[] = [
    makePerson('jens'),
    makePerson('klara', { gender: 'female', familySide: 'klara' }),
    makePerson('jensFather', { birthDate: '1960-01-01' }),
    makePerson('jensMother', { gender: 'female', birthDate: '1962-03-15' }),
    makePerson('child1', { birthDate: '2020-06-01' }),
  ]

  const relationships: Relationship[] = [
    { type: 'partner', from: 'jens', to: 'klara' },
    { type: 'parent', from: 'jensFather', to: 'jens' },
    { type: 'parent', from: 'jensMother', to: 'jens' },
    { type: 'parent', from: 'jens', to: 'child1' },
    { type: 'parent', from: 'klara', to: 'child1' },
    { type: 'partner', from: 'jensFather', to: 'jensMother' },
  ]

  const familyUnits = buildFamilyUnits(persons, relationships)
  return { persons, relationships, familyUnits }
}

// --- Tests ---

describe('assignGenerations', () => {
  it('assigns generation 0 to center person', () => {
    const { familyUnits } = buildTestData()
    const generations = assignGenerations('jens', familyUnits)
    expect(generations.get('jens')).toBe(0)
  })

  it('assigns generation 0 to center partner', () => {
    const { familyUnits } = buildTestData()
    const generations = assignGenerations('jens', familyUnits)
    expect(generations.get('klara')).toBe(0)
  })

  it('assigns generation -1 to center parents', () => {
    const { familyUnits } = buildTestData()
    const generations = assignGenerations('jens', familyUnits)
    expect(generations.get('jensFather')).toBe(-1)
    expect(generations.get('jensMother')).toBe(-1)
  })

  it('assigns generation +1 to center children', () => {
    const { familyUnits } = buildTestData()
    const generations = assignGenerations('jens', familyUnits)
    expect(generations.get('child1')).toBe(1)
  })

  it('assigns generation -2 to grandparents', () => {
    const grandFather = makePerson('grandFather', { birthDate: '1930-01-01' })
    const grandMother = makePerson('grandMother', { gender: 'female', birthDate: '1932-05-10' })
    const { persons, relationships } = buildTestData()

    const extendedPersons = [...persons, grandFather, grandMother]
    const extendedRelationships: Relationship[] = [
      ...relationships,
      { type: 'parent', from: 'grandFather', to: 'jensFather' },
      { type: 'parent', from: 'grandMother', to: 'jensFather' },
      { type: 'partner', from: 'grandFather', to: 'grandMother' },
    ]

    const familyUnits = buildFamilyUnits(extendedPersons, extendedRelationships)
    const generations = assignGenerations('jens', familyUnits)

    expect(generations.get('grandFather')).toBe(-2)
    expect(generations.get('grandMother')).toBe(-2)
  })

  it('assigns generation 0 to siblings of center', () => {
    const sibling = makePerson('jensSibling', { birthDate: '1992-04-20' })
    const { persons, relationships } = buildTestData()

    const extendedPersons = [...persons, sibling]
    const extendedRelationships: Relationship[] = [
      ...relationships,
      { type: 'parent', from: 'jensFather', to: 'jensSibling' },
      { type: 'parent', from: 'jensMother', to: 'jensSibling' },
    ]

    const familyUnits = buildFamilyUnits(extendedPersons, extendedRelationships)
    const generations = assignGenerations('jens', familyUnits)

    expect(generations.get('jensSibling')).toBe(0)
  })

  it('assigns a generation to every person in the input', () => {
    const { persons, familyUnits } = buildTestData()
    const generations = assignGenerations('jens', familyUnits)

    for (const person of persons) {
      expect(generations.has(person.id)).toBe(true)
    }
    expect(generations.size).toBe(persons.length)
  })
})

describe('getGeneration', () => {
  it('throws for unknown person', () => {
    const { familyUnits } = buildTestData()
    const generations = assignGenerations('jens', familyUnits)

    expect(() => getGeneration('unknown-person', generations)).toThrowError(
      'Person "unknown-person" not found in generation table',
    )
  })

  it('returns correct value for known person', () => {
    const { familyUnits } = buildTestData()
    const generations = assignGenerations('jens', familyUnits)

    expect(getGeneration('jens', generations)).toBe(0)
    expect(getGeneration('klara', generations)).toBe(0)
    expect(getGeneration('jensFather', generations)).toBe(-1)
    expect(getGeneration('child1', generations)).toBe(1)
  })
})

describe('buildFamilyLookups', () => {
  it('builds correct parent and child lookup maps', () => {
    const { familyUnits } = buildTestData()
    const { unitsAsParent, unitsAsChild } = buildFamilyLookups(familyUnits)

    // jens should be a parent in at least one unit (jens+klara -> child1)
    const jensParentUnits = unitsAsParent.get('jens') ?? []
    expect(jensParentUnits.length).toBeGreaterThan(0)

    // child1 should be a child in at least one unit
    const child1ChildUnits = unitsAsChild.get('child1') ?? []
    expect(child1ChildUnits.length).toBeGreaterThan(0)

    // jens should be a child in the jensFather+jensMother unit
    const jensChildUnits = unitsAsChild.get('jens') ?? []
    expect(jensChildUnits.length).toBeGreaterThan(0)
    const birthFamily = jensChildUnits[0]
    expect(birthFamily.parentIds).toContain('jensFather')
    expect(birthFamily.parentIds).toContain('jensMother')
  })
})
