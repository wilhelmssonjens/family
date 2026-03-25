/**
 * TreeLayout barrel re-export tests.
 *
 * The full test suite lives in the individual module test files:
 * - computeTreeLayoutV3.test.ts (22 layout integration tests)
 * - assignGenerations.test.ts (10 generation tests)
 * - measureLayout.test.ts (13 measurement tests)
 * - familySelection.test.ts (10 selection tests)
 * - validateLayout.test.ts (10 validation tests)
 *
 * This file verifies that the barrel re-exports work correctly.
 */
import { describe, it, expect } from 'vitest'
import { computeTreeLayout, assignGenerations, buildFamilyLookups } from './TreeLayout'
import { buildFamilyUnits } from '../../utils/buildTree'
import type { Person, Relationship } from '../../types'

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

const jens = makePerson({ id: 'jens', firstName: 'Jens' })
const klara = makePerson({ id: 'klara', firstName: 'Klara', gender: 'female' })
const jensFather = makePerson({ id: 'jens-father', firstName: 'JensFather' })
const jensMother = makePerson({ id: 'jens-mother', firstName: 'JensMother', gender: 'female' })

const persons: Person[] = [jens, klara, jensFather, jensMother]
const relationships: Relationship[] = [
  { type: 'partner', from: 'jens', to: 'klara' },
  { type: 'parent', from: 'jens-father', to: 'jens' },
  { type: 'parent', from: 'jens-mother', to: 'jens' },
  { type: 'partner', from: 'jens-father', to: 'jens-mother' },
]

describe('TreeLayout barrel exports', () => {
  it('computeTreeLayout re-export works and returns v3 result', () => {
    const result = computeTreeLayout(persons, relationships, 'jens')
    expect(result.visualNodes).toBeDefined()
    expect(result.visualNodes.length).toBeGreaterThan(0)
    expect(result.families).toBeDefined()
    expect(result.nodeIndex).toBeDefined()
  })

  it('assignGenerations re-export works', () => {
    const familyUnits = buildFamilyUnits(persons, relationships)
    const generations = assignGenerations('jens', familyUnits)
    expect(generations.get('jens')).toBe(0)
    expect(generations.get('jens-father')).toBe(-1)
  })

  it('buildFamilyLookups re-export works', () => {
    const familyUnits = buildFamilyUnits(persons, relationships)
    const { unitsAsParent, unitsAsChild } = buildFamilyLookups(familyUnits)
    expect(unitsAsParent.size).toBeGreaterThan(0)
    expect(unitsAsChild.size).toBeGreaterThan(0)
  })
})
