import { describe, it, expect } from 'vitest'
import { pickCenterFamily, pickPrimaryBirthFamily } from './familySelection'
import type { FamilyUnit } from '../../utils/buildTree'
import type { Person } from '../../types'

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

function toMap(persons: Person[]): Map<string, Person> {
  const m = new Map<string, Person>()
  for (const p of persons) {
    m.set(p.id, p)
  }
  return m
}

describe('pickCenterFamily', () => {
  it('returns the single parent-family when center has one', () => {
    const persons = [
      makePerson({ id: 'jens' }),
      makePerson({ id: 'klara', gender: 'female' }),
      makePerson({ id: 'child1' }),
    ]
    const family: FamilyUnit = {
      id: 'f-jens-klara',
      parentIds: ['jens', 'klara'],
      childIds: ['child1'],
    }

    const result = pickCenterFamily('jens', [family], toMap(persons))
    expect(result).toBe(family)
  })

  it('picks the parent-family with the most children', () => {
    const persons = [
      makePerson({ id: 'jens' }),
      makePerson({ id: 'klara', gender: 'female' }),
      makePerson({ id: 'anna', gender: 'female' }),
      makePerson({ id: 'c1' }),
      makePerson({ id: 'c2' }),
      makePerson({ id: 'c3' }),
    ]
    const smallFamily: FamilyUnit = {
      id: 'f-jens-anna',
      parentIds: ['anna', 'jens'],
      childIds: ['c1'],
    }
    const bigFamily: FamilyUnit = {
      id: 'f-jens-klara',
      parentIds: ['jens', 'klara'],
      childIds: ['c2', 'c3'],
    }

    const result = pickCenterFamily(
      'jens',
      [smallFamily, bigFamily],
      toMap(persons),
    )
    expect(result.id).toBe('f-jens-klara')
  })

  it('prefers two-parent family over single-parent when same child count', () => {
    const persons = [
      makePerson({ id: 'jens' }),
      makePerson({ id: 'klara', gender: 'female' }),
      makePerson({ id: 'c1' }),
      makePerson({ id: 'c2' }),
    ]
    const singleParent: FamilyUnit = {
      id: 'f-jens',
      parentIds: ['jens'],
      childIds: ['c1'],
    }
    const twoParent: FamilyUnit = {
      id: 'f-jens-klara',
      parentIds: ['jens', 'klara'],
      childIds: ['c2'],
    }

    const result = pickCenterFamily(
      'jens',
      [singleParent, twoParent],
      toMap(persons),
    )
    expect(result.id).toBe('f-jens-klara')
  })

  it('falls back to child-family when center has no parent-families', () => {
    const persons = [
      makePerson({ id: 'jens' }),
      makePerson({ id: 'father' }),
      makePerson({ id: 'mother', gender: 'female' }),
    ]
    const birthFamily: FamilyUnit = {
      id: 'f-father-mother',
      parentIds: ['father', 'mother'],
      childIds: ['jens'],
    }

    const result = pickCenterFamily('jens', [birthFamily], toMap(persons))
    expect(result.id).toBe('f-father-mother')
  })

  it('throws if center person is not in any family', () => {
    const persons = [makePerson({ id: 'jens' })]
    const unrelatedFamily: FamilyUnit = {
      id: 'f-other',
      parentIds: ['someone'],
      childIds: ['other'],
    }

    expect(() =>
      pickCenterFamily('jens', [unrelatedFamily], toMap(persons)),
    ).toThrow(/does not belong to any family/)
  })

  it('is deterministic regardless of input order', () => {
    const persons = [
      makePerson({ id: 'jens' }),
      makePerson({ id: 'klara', gender: 'female' }),
      makePerson({ id: 'anna', gender: 'female' }),
      makePerson({ id: 'c1', birthDate: '2020-01-01' }),
      makePerson({ id: 'c2', birthDate: '2018-06-15' }),
      makePerson({ id: 'c3', birthDate: '2022-03-10' }),
    ]
    const familyA: FamilyUnit = {
      id: 'f-jens-anna',
      parentIds: ['anna', 'jens'],
      childIds: ['c1'],
    }
    const familyB: FamilyUnit = {
      id: 'f-jens-klara',
      parentIds: ['jens', 'klara'],
      childIds: ['c2', 'c3'],
    }

    const personsMap = toMap(persons)

    // Try multiple orderings
    const result1 = pickCenterFamily(
      'jens',
      [familyA, familyB],
      personsMap,
    )
    const result2 = pickCenterFamily(
      'jens',
      [familyB, familyA],
      personsMap,
    )

    expect(result1.id).toBe(result2.id)
    expect(result1.id).toBe('f-jens-klara')
  })
})

describe('pickPrimaryBirthFamily', () => {
  it('returns the single birth family when person has one', () => {
    const persons = [
      makePerson({ id: 'child' }),
      makePerson({ id: 'dad' }),
      makePerson({ id: 'mom', gender: 'female' }),
    ]
    const family: FamilyUnit = {
      id: 'f-dad-mom',
      parentIds: ['dad', 'mom'],
      childIds: ['child'],
    }
    const familiesByChild = new Map<string, FamilyUnit[]>([
      ['child', [family]],
    ])

    const result = pickPrimaryBirthFamily('child', familiesByChild, toMap(persons))
    expect(result).toBe(family)
  })

  it('prefers two-parent family over single-parent', () => {
    const persons = [
      makePerson({ id: 'child' }),
      makePerson({ id: 'dad' }),
      makePerson({ id: 'mom', gender: 'female' }),
    ]
    const singleParent: FamilyUnit = {
      id: 'f-dad',
      parentIds: ['dad'],
      childIds: ['child'],
    }
    const twoParent: FamilyUnit = {
      id: 'f-dad-mom',
      parentIds: ['dad', 'mom'],
      childIds: ['child'],
    }
    const familiesByChild = new Map<string, FamilyUnit[]>([
      ['child', [singleParent, twoParent]],
    ])

    const result = pickPrimaryBirthFamily('child', familiesByChild, toMap(persons))
    expect(result!.id).toBe('f-dad-mom')
  })

  it('returns null when person has no birth families', () => {
    const familiesByChild = new Map<string, FamilyUnit[]>()
    const result = pickPrimaryBirthFamily(
      'orphan',
      familiesByChild,
      new Map(),
    )
    expect(result).toBeNull()
  })

  it('uses parent metadata count as tiebreaker', () => {
    const persons = [
      makePerson({ id: 'child' }),
      makePerson({
        id: 'dad-a',
        birthDate: '1970-01-01',
        birthPlace: 'Stockholm',
        occupation: 'Engineer',
      }),
      makePerson({
        id: 'mom-a',
        gender: 'female',
        birthDate: '1972-05-15',
      }),
      makePerson({ id: 'dad-b' }),
      makePerson({ id: 'mom-b', gender: 'female' }),
    ]
    // Family A has rich metadata: dad-a has 3, mom-a has 1 = total 4
    const familyA: FamilyUnit = {
      id: 'f-dad-a-mom-a',
      parentIds: ['dad-a', 'mom-a'],
      childIds: ['child'],
    }
    // Family B has no metadata: total 0
    const familyB: FamilyUnit = {
      id: 'f-dad-b-mom-b',
      parentIds: ['dad-b', 'mom-b'],
      childIds: ['child'],
    }
    const familiesByChild = new Map<string, FamilyUnit[]>([
      ['child', [familyB, familyA]],
    ])

    const result = pickPrimaryBirthFamily('child', familiesByChild, toMap(persons))
    expect(result!.id).toBe('f-dad-a-mom-a')
  })
})
