import { describe, it, expect } from 'vitest'
import { buildFamilyUnits } from './buildTree'
import type { Person, Relationship } from '../types'

const makePerson = (overrides: Partial<Person> & { id: string }): Person => ({
  firstName: 'Test',
  lastName: 'Person',
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
  familySide: 'center',
  ...overrides,
})

describe('buildFamilyUnits', () => {
  it('creates a FamilyUnit for a simple couple with children', () => {
    const persons = [
      makePerson({ id: 'alice', firstName: 'Alice', gender: 'female' }),
      makePerson({ id: 'bob', firstName: 'Bob', gender: 'male' }),
      makePerson({ id: 'charlie', firstName: 'Charlie', gender: 'male' }),
      makePerson({ id: 'diana', firstName: 'Diana', gender: 'female' }),
    ]
    const relationships: Relationship[] = [
      { type: 'partner', from: 'alice', to: 'bob', status: 'current' },
      { type: 'parent', from: 'alice', to: 'charlie' },
      { type: 'parent', from: 'bob', to: 'charlie' },
      { type: 'parent', from: 'alice', to: 'diana' },
      { type: 'parent', from: 'bob', to: 'diana' },
    ]

    const units = buildFamilyUnits(persons, relationships)
    const unit = units.find((u) => u.id === 'f-alice-bob')

    expect(unit).toBeDefined()
    expect(unit!.parentIds).toEqual(['alice', 'bob'])
    expect(unit!.childIds).toEqual(['charlie', 'diana'])
  })

  it('creates a FamilyUnit for a single parent with children', () => {
    const persons = [
      makePerson({ id: 'mom', firstName: 'Mom', gender: 'female' }),
      makePerson({ id: 'kid1', firstName: 'Kid1', gender: 'male' }),
      makePerson({ id: 'kid2', firstName: 'Kid2', gender: 'female' }),
    ]
    const relationships: Relationship[] = [
      { type: 'parent', from: 'mom', to: 'kid1' },
      { type: 'parent', from: 'mom', to: 'kid2' },
    ]

    const units = buildFamilyUnits(persons, relationships)
    const unit = units.find((u) => u.id === 'f-mom')

    expect(unit).toBeDefined()
    expect(unit!.parentIds).toEqual(['mom'])
    expect(unit!.childIds).toEqual(['kid1', 'kid2'])
  })

  it('creates a FamilyUnit for partner-only couple (no children)', () => {
    const persons = [
      makePerson({ id: 'alice', firstName: 'Alice', gender: 'female' }),
      makePerson({ id: 'bob', firstName: 'Bob', gender: 'male' }),
    ]
    const relationships: Relationship[] = [
      { type: 'partner', from: 'alice', to: 'bob', status: 'current' },
    ]

    const units = buildFamilyUnits(persons, relationships)
    const unit = units.find((u) => u.id === 'f-alice-bob')

    expect(unit).toBeDefined()
    expect(unit!.parentIds).toEqual(['alice', 'bob'])
    expect(unit!.childIds).toEqual([])
  })

  it('creates multiple FamilyUnits for person with multiple partners', () => {
    const persons = [
      makePerson({ id: 'alice', firstName: 'Alice', gender: 'female' }),
      makePerson({ id: 'bob', firstName: 'Bob', gender: 'male' }),
      makePerson({ id: 'carl', firstName: 'Carl', gender: 'male' }),
      makePerson({ id: 'kid-ab', firstName: 'KidAB', gender: 'male' }),
      makePerson({ id: 'kid-ac', firstName: 'KidAC', gender: 'female' }),
    ]
    const relationships: Relationship[] = [
      { type: 'partner', from: 'alice', to: 'bob', status: 'former' },
      { type: 'partner', from: 'alice', to: 'carl', status: 'current' },
      { type: 'parent', from: 'alice', to: 'kid-ab' },
      { type: 'parent', from: 'bob', to: 'kid-ab' },
      { type: 'parent', from: 'alice', to: 'kid-ac' },
      { type: 'parent', from: 'carl', to: 'kid-ac' },
    ]

    const units = buildFamilyUnits(persons, relationships)

    const unitAB = units.find((u) => u.id === 'f-alice-bob')
    expect(unitAB).toBeDefined()
    expect(unitAB!.parentIds).toEqual(['alice', 'bob'])
    expect(unitAB!.childIds).toEqual(['kid-ab'])

    const unitAC = units.find((u) => u.id === 'f-alice-carl')
    expect(unitAC).toBeDefined()
    expect(unitAC!.parentIds).toEqual(['alice', 'carl'])
    expect(unitAC!.childIds).toEqual(['kid-ac'])
  })

  it('creates separate FamilyUnits for half-siblings', () => {
    const persons = [
      makePerson({ id: 'mom', firstName: 'Mom', gender: 'female' }),
      makePerson({ id: 'dad1', firstName: 'Dad1', gender: 'male' }),
      makePerson({ id: 'dad2', firstName: 'Dad2', gender: 'male' }),
      makePerson({ id: 'child1', firstName: 'Child1', gender: 'male' }),
      makePerson({ id: 'child2', firstName: 'Child2', gender: 'female' }),
    ]
    const relationships: Relationship[] = [
      { type: 'partner', from: 'mom', to: 'dad1', status: 'former' },
      { type: 'partner', from: 'mom', to: 'dad2', status: 'current' },
      { type: 'parent', from: 'mom', to: 'child1' },
      { type: 'parent', from: 'dad1', to: 'child1' },
      { type: 'parent', from: 'mom', to: 'child2' },
      { type: 'parent', from: 'dad2', to: 'child2' },
    ]

    const units = buildFamilyUnits(persons, relationships)

    const unit1 = units.find((u) => u.id === 'f-dad1-mom')
    expect(unit1).toBeDefined()
    expect(unit1!.childIds).toEqual(['child1'])

    const unit2 = units.find((u) => u.id === 'f-dad2-mom')
    expect(unit2).toBeDefined()
    expect(unit2!.childIds).toEqual(['child2'])
  })

  it('produces stable output regardless of input order', () => {
    const persons = [
      makePerson({ id: 'bob', firstName: 'Bob', birthDate: '19900101', gender: 'male' }),
      makePerson({ id: 'alice', firstName: 'Alice', birthDate: '19880101', gender: 'female' }),
      makePerson({ id: 'charlie', firstName: 'Charlie', birthDate: '20150601', gender: 'male' }),
      makePerson({ id: 'diana', firstName: 'Diana', birthDate: '20180301', gender: 'female' }),
    ]
    const relationships: Relationship[] = [
      { type: 'partner', from: 'bob', to: 'alice', status: 'current' },
      { type: 'parent', from: 'bob', to: 'diana' },
      { type: 'parent', from: 'alice', to: 'diana' },
      { type: 'parent', from: 'bob', to: 'charlie' },
      { type: 'parent', from: 'alice', to: 'charlie' },
    ]

    const units1 = buildFamilyUnits(persons, relationships)

    // Reverse persons and relationships order
    const units2 = buildFamilyUnits([...persons].reverse(), [...relationships].reverse())

    expect(units1).toEqual(units2)
  })

  it('does not create duplicate FamilyUnits for partner-only couple that also has children', () => {
    const persons = [
      makePerson({ id: 'alice', firstName: 'Alice', gender: 'female' }),
      makePerson({ id: 'bob', firstName: 'Bob', gender: 'male' }),
      makePerson({ id: 'kid', firstName: 'Kid', gender: 'male' }),
    ]
    const relationships: Relationship[] = [
      { type: 'partner', from: 'alice', to: 'bob', status: 'current' },
      { type: 'parent', from: 'alice', to: 'kid' },
      { type: 'parent', from: 'bob', to: 'kid' },
    ]

    const units = buildFamilyUnits(persons, relationships)
    const matchingUnits = units.filter((u) => u.id === 'f-alice-bob')

    expect(matchingUnits).toHaveLength(1)
    expect(matchingUnits[0].childIds).toEqual(['kid'])
  })

  it('handles empty input', () => {
    const units = buildFamilyUnits([], [])
    expect(units).toEqual([])
  })

  it('sorts parentIds by birthDate then id', () => {
    const persons = [
      makePerson({ id: 'zara', firstName: 'Zara', birthDate: '19850101', gender: 'female' }),
      makePerson({ id: 'adam', firstName: 'Adam', birthDate: '19900101', gender: 'male' }),
      makePerson({ id: 'kid', firstName: 'Kid', gender: 'male' }),
    ]
    const relationships: Relationship[] = [
      { type: 'partner', from: 'adam', to: 'zara', status: 'current' },
      { type: 'parent', from: 'adam', to: 'kid' },
      { type: 'parent', from: 'zara', to: 'kid' },
    ]

    const units = buildFamilyUnits(persons, relationships)
    const unit = units.find((u) => u.childIds.includes('kid'))

    // Zara has earlier birthDate, so she comes first
    expect(unit!.parentIds).toEqual(['zara', 'adam'])
  })

  it('sorts parentIds by id when birthDates are equal', () => {
    const persons = [
      makePerson({ id: 'zara', firstName: 'Zara', birthDate: '19900101', gender: 'female' }),
      makePerson({ id: 'adam', firstName: 'Adam', birthDate: '19900101', gender: 'male' }),
      makePerson({ id: 'kid', firstName: 'Kid', gender: 'male' }),
    ]
    const relationships: Relationship[] = [
      { type: 'parent', from: 'adam', to: 'kid' },
      { type: 'parent', from: 'zara', to: 'kid' },
    ]

    const units = buildFamilyUnits(persons, relationships)
    const unit = units.find((u) => u.childIds.includes('kid'))

    // Same birthDate, so sort by id: adam < zara
    expect(unit!.parentIds).toEqual(['adam', 'zara'])
  })

  it('sorts childIds by birthDate then id', () => {
    const persons = [
      makePerson({ id: 'mom', firstName: 'Mom', gender: 'female' }),
      makePerson({ id: 'dad', firstName: 'Dad', gender: 'male' }),
      makePerson({ id: 'zoe', firstName: 'Zoe', birthDate: '20100101', gender: 'female' }),
      makePerson({ id: 'anna', firstName: 'Anna', birthDate: '20150601', gender: 'female' }),
      makePerson({ id: 'ben', firstName: 'Ben', birthDate: null, gender: 'male' }),
    ]
    const relationships: Relationship[] = [
      { type: 'partner', from: 'mom', to: 'dad', status: 'current' },
      { type: 'parent', from: 'mom', to: 'anna' },
      { type: 'parent', from: 'dad', to: 'anna' },
      { type: 'parent', from: 'mom', to: 'zoe' },
      { type: 'parent', from: 'dad', to: 'zoe' },
      { type: 'parent', from: 'mom', to: 'ben' },
      { type: 'parent', from: 'dad', to: 'ben' },
    ]

    const units = buildFamilyUnits(persons, relationships)
    const unit = units.find((u) => u.id === 'f-dad-mom')

    // zoe (2010) before anna (2015) before ben (null → last, sorted by id)
    expect(unit!.childIds).toEqual(['zoe', 'anna', 'ben'])
  })

  it('uses FamilyUnit id based on sorted parentIds', () => {
    const persons = [
      makePerson({ id: 'zara', firstName: 'Zara', gender: 'female' }),
      makePerson({ id: 'adam', firstName: 'Adam', gender: 'male' }),
    ]
    const relationships: Relationship[] = [
      { type: 'partner', from: 'zara', to: 'adam', status: 'current' },
    ]

    const units = buildFamilyUnits(persons, relationships)
    // ID is alphabetically sorted: adam < zara
    expect(units[0].id).toBe('f-adam-zara')
  })

  describe('with real project data', () => {
    // Load real data for integration-style tests
    let persons: Person[]
    let relationships: Relationship[]

    beforeAll(async () => {
      const { readFileSync } = await import('fs')
      const { resolve } = await import('path')
      persons = JSON.parse(
        readFileSync(resolve(__dirname, '../../public/data/persons.json'), 'utf-8'),
      )
      relationships = JSON.parse(
        readFileSync(resolve(__dirname, '../../public/data/relationships.json'), 'utf-8'),
      )
    })

    it('creates a FamilyUnit for Per & Laila with Jens and Eva', () => {
      const units = buildFamilyUnits(persons, relationships)
      const unit = units.find((u) => u.id === 'f-laila-per')

      expect(unit).toBeDefined()
      // Per (19590208) is born before Laila (19591024)
      expect(unit!.parentIds).toEqual(['per', 'laila'])
      expect(unit!.childIds).toContain('jens')
      expect(unit!.childIds).toContain('eva')
      expect(unit!.childIds).toHaveLength(2)
    })

    it('creates a FamilyUnit for Gunnar-W & Barbro with Birgitta, Mats, Per', () => {
      const units = buildFamilyUnits(persons, relationships)
      const unit = units.find((u) => u.id === 'f-barbro-gunnar-w')

      expect(unit).toBeDefined()
      expect(unit!.parentIds).toEqual(['barbro', 'gunnar-w'])
      expect(unit!.childIds).toContain('birgitta')
      expect(unit!.childIds).toContain('mats')
      expect(unit!.childIds).toContain('per')
      expect(unit!.childIds).toHaveLength(3)
    })

    it('creates a single-parent FamilyUnit for Birgitta with Hampus and Jacob', () => {
      const units = buildFamilyUnits(persons, relationships)
      const unit = units.find((u) => u.id === 'f-birgitta')

      expect(unit).toBeDefined()
      expect(unit!.parentIds).toEqual(['birgitta'])
      expect(unit!.childIds).toContain('hampus-wikmark')
      expect(unit!.childIds).toContain('jacob-wikmark')
      expect(unit!.childIds).toHaveLength(2)
    })

    it('creates a partner-only FamilyUnit for Jens & Klara', () => {
      const units = buildFamilyUnits(persons, relationships)
      const unit = units.find((u) => u.id === 'f-jens-klara')

      expect(unit).toBeDefined()
      expect(unit!.parentIds).toEqual(['jens', 'klara'])
      expect(unit!.childIds).toEqual([])
    })

    it('creates a partner-only FamilyUnit for Birgitta & Alf', () => {
      const units = buildFamilyUnits(persons, relationships)
      const unit = units.find((u) => u.id === 'f-alf-birgitta')

      expect(unit).toBeDefined()
      expect(unit!.parentIds).toEqual(['alf', 'birgitta'])
      expect(unit!.childIds).toEqual([])
    })

    it('creates a single-parent FamilyUnit for Mats with Madeleine and Robert', () => {
      const units = buildFamilyUnits(persons, relationships)
      const unit = units.find((u) => u.id === 'f-mats')

      expect(unit).toBeDefined()
      expect(unit!.parentIds).toEqual(['mats'])
      expect(unit!.childIds).toContain('madeleine')
      expect(unit!.childIds).toContain('robert')
      expect(unit!.childIds).toHaveLength(2)
    })

    it('creates a partner-only FamilyUnit for Mats & Anne', () => {
      const units = buildFamilyUnits(persons, relationships)
      const unit = units.find((u) => u.id === 'f-anne-mats')

      expect(unit).toBeDefined()
      expect(unit!.parentIds).toEqual(['anne', 'mats'])
      expect(unit!.childIds).toEqual([])
    })

    it('does not create any duplicate FamilyUnits', () => {
      const units = buildFamilyUnits(persons, relationships)
      const ids = units.map((u) => u.id)
      const uniqueIds = new Set(ids)
      expect(ids.length).toBe(uniqueIds.size)
    })
  })
})
