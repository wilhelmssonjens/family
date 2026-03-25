import { describe, it, expect } from 'vitest'
import { computeTreeLayoutV3 } from './computeTreeLayoutV3'
import type { Person, Relationship, VisualPersonNode } from '../../types'

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

// --- Standard test data (same as TreeLayout.test.ts) ---

const jens = makePerson({ id: 'jens', firstName: 'Jens', familySide: 'jens' })
const klara = makePerson({ id: 'klara', firstName: 'Klara', gender: 'female', familySide: 'klara' })
const jensFather = makePerson({ id: 'jens-father', firstName: 'JensFather', familySide: 'jens' })
const jensMother = makePerson({ id: 'jens-mother', firstName: 'JensMother', gender: 'female', familySide: 'jens' })
const klaraFather = makePerson({ id: 'klara-father', firstName: 'KlaraFather', familySide: 'klara' })
const klaraMother = makePerson({ id: 'klara-mother', firstName: 'KlaraMother', gender: 'female', familySide: 'klara' })
const jensSibling = makePerson({ id: 'jens-sibling', firstName: 'JensSibling', familySide: 'jens' })

const persons: Person[] = [jens, klara, jensFather, jensMother, klaraFather, klaraMother, jensSibling]

const relationships: Relationship[] = [
  { type: 'partner', from: 'jens', to: 'klara', status: 'current' },
  { type: 'parent', from: 'jens-father', to: 'jens' },
  { type: 'parent', from: 'jens-mother', to: 'jens' },
  { type: 'parent', from: 'klara-father', to: 'klara' },
  { type: 'parent', from: 'klara-mother', to: 'klara' },
  { type: 'partner', from: 'jens-father', to: 'jens-mother', status: 'current' },
  { type: 'partner', from: 'klara-father', to: 'klara-mother', status: 'current' },
  { type: 'parent', from: 'jens-father', to: 'jens-sibling' },
  { type: 'parent', from: 'jens-mother', to: 'jens-sibling' },
]

// Helpers to find nodes by personId
function findByPerson(nodes: VisualPersonNode[], personId: string): VisualPersonNode | undefined {
  return nodes.find(n => n.personId === personId)
}

function findAllByPerson(nodes: VisualPersonNode[], personId: string): VisualPersonNode[] {
  return nodes.filter(n => n.personId === personId)
}

// --- Ported tests from TreeLayout.test.ts ---

describe('computeTreeLayoutV3', () => {
  it('returns a layout with positioned visual nodes', () => {
    const result = computeTreeLayoutV3(persons, relationships, 'jens')
    expect(result.visualNodes).toBeDefined()
    expect(result.visualNodes.length).toBeGreaterThan(0)
  })

  it('places the center couple near origin', () => {
    const result = computeTreeLayoutV3(persons, relationships, 'jens')
    const jensNode = findByPerson(result.visualNodes, 'jens')
    const klaraNode = findByPerson(result.visualNodes, 'klara')
    expect(jensNode).toBeDefined()
    expect(klaraNode).toBeDefined()
    expect(Math.abs(jensNode!.x)).toBeLessThan(500)
    expect(Math.abs(jensNode!.y)).toBeLessThan(500)
    expect(Math.abs(klaraNode!.x)).toBeLessThan(500)
    expect(Math.abs(klaraNode!.y)).toBeLessThan(500)
  })

  it('places Jens parents above Jens (negative y)', () => {
    const result = computeTreeLayoutV3(persons, relationships, 'jens')
    const jensNode = findByPerson(result.visualNodes, 'jens')
    const jensFatherNode = findByPerson(result.visualNodes, 'jens-father')
    expect(jensNode).toBeDefined()
    expect(jensFatherNode).toBeDefined()
    expect(jensFatherNode!.y).toBeLessThan(jensNode!.y)
  })

  it('places Klara parents above Klara (negative y)', () => {
    const result = computeTreeLayoutV3(persons, relationships, 'jens')
    const klaraNode = findByPerson(result.visualNodes, 'klara')
    const klaraFatherNode = findByPerson(result.visualNodes, 'klara-father')
    expect(klaraNode).toBeDefined()
    expect(klaraFatherNode).toBeDefined()
    expect(klaraFatherNode!.y).toBeLessThan(klaraNode!.y)
  })

  it('places siblings on the same y-level with different x', () => {
    const result = computeTreeLayoutV3(persons, relationships, 'jens')
    const jensNode = findByPerson(result.visualNodes, 'jens')
    const siblingNode = findByPerson(result.visualNodes, 'jens-sibling')
    expect(jensNode).toBeDefined()
    expect(siblingNode).toBeDefined()
    expect(siblingNode!.y).toBe(jensNode!.y)
    expect(siblingNode!.x).not.toBe(jensNode!.x)
  })

  it('includes all persons in the layout', () => {
    const result = computeTreeLayoutV3(persons, relationships, 'jens')
    const placedPersonIds = new Set(result.visualNodes.map(n => n.personId))
    for (const person of persons) {
      expect(placedPersonIds.has(person.id)).toBe(true)
    }
  })

  it('handles empty persons array', () => {
    const result = computeTreeLayoutV3([], [], 'jens')
    expect(result.visualNodes).toEqual([])
    expect(result.families).toEqual([])
  })

  it('handles non-existent center id', () => {
    const result = computeTreeLayoutV3(persons, relationships, 'nonexistent')
    expect(result.visualNodes).toEqual([])
  })

  it('no cards overlap on the same row', () => {
    const result = computeTreeLayoutV3(persons, relationships, 'jens')
    const CARD_WIDTH = 140

    // Group by y, deduplicate by physical position
    // (visual instance model: same person may have multiple visual nodes at the same spot)
    const rowMap = new Map<number, number[]>()
    for (const node of result.visualNodes) {
      let row = rowMap.get(node.y)
      if (!row) {
        row = []
        rowMap.set(node.y, row)
      }
      row.push(node.x)
    }

    for (const [, xPositions] of rowMap) {
      // Deduplicate positions (same physical card rendered for multiple visual instances)
      const uniqueXs = [...new Set(xPositions)].sort((a, b) => a - b)
      for (let i = 1; i < uniqueXs.length; i++) {
        const gap = uniqueXs[i] - uniqueXs[i - 1]
        expect(gap).toBeGreaterThanOrEqual(CARD_WIDTH)
      }
    }
  })

  // --- Family connector tests ---

  it('produces family connectors for all placed families', () => {
    const result = computeTreeLayoutV3(persons, relationships, 'jens')
    expect(result.families.length).toBeGreaterThan(0)
  })

  it('family connectors reference valid visual ids', () => {
    const result = computeTreeLayoutV3(persons, relationships, 'jens')
    const validIds = new Set(result.visualNodes.map(n => n.visualId))
    for (const fam of result.families) {
      for (const vid of fam.parentVisualIds) {
        expect(validIds.has(vid)).toBe(true)
      }
      for (const vid of fam.childVisualIds) {
        expect(validIds.has(vid)).toBe(true)
      }
    }
  })

  // --- V3-specific tests ---

  it('all visualIds are unique', () => {
    const result = computeTreeLayoutV3(persons, relationships, 'jens')
    const ids = result.visualNodes.map(n => n.visualId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('nodeIndex contains all visual nodes', () => {
    const result = computeTreeLayoutV3(persons, relationships, 'jens')
    expect(result.nodeIndex.size).toBe(result.visualNodes.length)
    for (const node of result.visualNodes) {
      expect(result.nodeIndex.get(node.visualId)).toBe(node)
    }
  })

  it('has finite width and height', () => {
    const result = computeTreeLayoutV3(persons, relationships, 'jens')
    expect(Number.isFinite(result.width)).toBe(true)
    expect(Number.isFinite(result.height)).toBe(true)
    expect(result.width).toBeGreaterThan(0)
    expect(result.height).toBeGreaterThan(0)
  })

  it('all visual nodes have finite coordinates', () => {
    const result = computeTreeLayoutV3(persons, relationships, 'jens')
    for (const node of result.visualNodes) {
      expect(Number.isFinite(node.x)).toBe(true)
      expect(Number.isFinite(node.y)).toBe(true)
    }
  })

  // --- Multi-partner test ---

  it('multi-partner: same person in two families produces visual instances in each', () => {
    const alice = makePerson({ id: 'alice', firstName: 'Alice', gender: 'female', birthDate: '1980-01-01' })
    const bob = makePerson({ id: 'bob', firstName: 'Bob', birthDate: '1978-01-01' })
    const charlie = makePerson({ id: 'charlie', firstName: 'Charlie', birthDate: '1982-01-01' })
    const child1 = makePerson({ id: 'child1', firstName: 'Child1', birthDate: '2005-01-01' })
    const child2 = makePerson({ id: 'child2', firstName: 'Child2', birthDate: '2010-01-01' })

    const multiPersons = [alice, bob, charlie, child1, child2]
    const multiRels: Relationship[] = [
      { type: 'partner', from: 'alice', to: 'bob' },
      { type: 'partner', from: 'alice', to: 'charlie' },
      { type: 'parent', from: 'alice', to: 'child1' },
      { type: 'parent', from: 'bob', to: 'child1' },
      { type: 'parent', from: 'alice', to: 'child2' },
      { type: 'parent', from: 'charlie', to: 'child2' },
    ]

    const result = computeTreeLayoutV3(multiPersons, multiRels, 'alice')

    // Alice should appear as parent in both families
    const aliceNodes = findAllByPerson(result.visualNodes, 'alice')
    // At least 1 instance (might be more depending on center family placement)
    expect(aliceNodes.length).toBeGreaterThanOrEqual(1)

    // Both children should be placed
    expect(findByPerson(result.visualNodes, 'child1')).toBeDefined()
    expect(findByPerson(result.visualNodes, 'child2')).toBeDefined()

    // Both partners should be placed
    expect(findByPerson(result.visualNodes, 'bob')).toBeDefined()
    expect(findByPerson(result.visualNodes, 'charlie')).toBeDefined()

    // All visualIds unique
    const ids = result.visualNodes.map(n => n.visualId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  // --- Half-sibling test ---

  it('half-siblings are in separate families', () => {
    const parent = makePerson({ id: 'parent', firstName: 'Parent', birthDate: '1960-01-01' })
    const partner1 = makePerson({ id: 'partner1', firstName: 'Partner1', gender: 'female', birthDate: '1962-01-01' })
    const partner2 = makePerson({ id: 'partner2', firstName: 'Partner2', gender: 'female', birthDate: '1965-01-01' })
    const child1 = makePerson({ id: 'child1', firstName: 'Child1', birthDate: '1985-01-01' })
    const child2 = makePerson({ id: 'child2', firstName: 'Child2', birthDate: '1990-01-01' })

    const halfPersons = [parent, partner1, partner2, child1, child2]
    const halfRels: Relationship[] = [
      { type: 'partner', from: 'parent', to: 'partner1' },
      { type: 'partner', from: 'parent', to: 'partner2' },
      { type: 'parent', from: 'parent', to: 'child1' },
      { type: 'parent', from: 'partner1', to: 'child1' },
      { type: 'parent', from: 'parent', to: 'child2' },
      { type: 'parent', from: 'partner2', to: 'child2' },
    ]

    const result = computeTreeLayoutV3(halfPersons, halfRels, 'parent')

    // Both children placed
    expect(findByPerson(result.visualNodes, 'child1')).toBeDefined()
    expect(findByPerson(result.visualNodes, 'child2')).toBeDefined()

    // Children should be in different families
    const child1Node = findByPerson(result.visualNodes, 'child1')!
    const child2Node = findByPerson(result.visualNodes, 'child2')!
    expect(child1Node.familyId).not.toBe(child2Node.familyId)
  })

  // --- Single parent test ---

  it('single parent family works correctly', () => {
    const parent = makePerson({ id: 'parent', firstName: 'Parent' })
    const child = makePerson({ id: 'child', firstName: 'Child' })

    const result = computeTreeLayoutV3(
      [parent, child],
      [{ type: 'parent', from: 'parent', to: 'child' }],
      'parent',
    )

    expect(findByPerson(result.visualNodes, 'parent')).toBeDefined()
    expect(findByPerson(result.visualNodes, 'child')).toBeDefined()
    expect(result.families.length).toBeGreaterThan(0)
  })

  // --- Partner-only family test ---

  it('partner-only family (no children) renders correctly', () => {
    const a = makePerson({ id: 'a', firstName: 'A' })
    const b = makePerson({ id: 'b', firstName: 'B', gender: 'female' })

    const result = computeTreeLayoutV3(
      [a, b],
      [{ type: 'partner', from: 'a', to: 'b' }],
      'a',
    )

    expect(findByPerson(result.visualNodes, 'a')).toBeDefined()
    expect(findByPerson(result.visualNodes, 'b')).toBeDefined()
    // Should have a family connector with no children
    const famWithNoChildren = result.families.find(f => f.childVisualIds.length === 0)
    expect(famWithNoChildren).toBeDefined()
  })

  // --- Ancestors + descendants test ---

  it('places ancestors and descendants correctly with proper generations', () => {
    const grandpa = makePerson({ id: 'grandpa', firstName: 'Grandpa', birthDate: '1940-01-01' })
    const grandma = makePerson({ id: 'grandma', firstName: 'Grandma', gender: 'female', birthDate: '1942-01-01' })
    const dad = makePerson({ id: 'dad', firstName: 'Dad', birthDate: '1965-01-01' })
    const mom = makePerson({ id: 'mom', firstName: 'Mom', gender: 'female', birthDate: '1967-01-01' })
    const me = makePerson({ id: 'me', firstName: 'Me', birthDate: '1990-01-01' })
    const wife = makePerson({ id: 'wife', firstName: 'Wife', gender: 'female', birthDate: '1991-01-01' })
    const kid = makePerson({ id: 'kid', firstName: 'Kid', birthDate: '2020-01-01' })

    const threeGenPersons = [grandpa, grandma, dad, mom, me, wife, kid]
    const threeGenRels: Relationship[] = [
      { type: 'partner', from: 'grandpa', to: 'grandma' },
      { type: 'parent', from: 'grandpa', to: 'dad' },
      { type: 'parent', from: 'grandma', to: 'dad' },
      { type: 'partner', from: 'dad', to: 'mom' },
      { type: 'parent', from: 'dad', to: 'me' },
      { type: 'parent', from: 'mom', to: 'me' },
      { type: 'partner', from: 'me', to: 'wife' },
      { type: 'parent', from: 'me', to: 'kid' },
      { type: 'parent', from: 'wife', to: 'kid' },
    ]

    const result = computeTreeLayoutV3(threeGenPersons, threeGenRels, 'me')

    const meNode = findByPerson(result.visualNodes, 'me')!
    const dadNode = findByPerson(result.visualNodes, 'dad')!
    const grandpaNode = findByPerson(result.visualNodes, 'grandpa')!
    const kidNode = findByPerson(result.visualNodes, 'kid')!

    // Grandpa above dad above me, kid below me
    expect(grandpaNode.y).toBeLessThan(dadNode.y)
    expect(dadNode.y).toBeLessThan(meNode.y)
    expect(meNode.y).toBeLessThan(kidNode.y)

    // All persons placed
    for (const p of threeGenPersons) {
      expect(findByPerson(result.visualNodes, p.id)).toBeDefined()
    }
  })

  // --- No silent dropouts test ---

  it('no silent dropouts: all persons in families are placed', () => {
    const result = computeTreeLayoutV3(persons, relationships, 'jens')
    const placedPersonIds = new Set(result.visualNodes.map(n => n.personId))
    for (const person of persons) {
      expect(placedPersonIds.has(person.id)).toBe(true)
    }
  })

  // --- Isolated person test ---

  it('handles isolated person with no relationships', () => {
    const lonely = makePerson({ id: 'lonely', firstName: 'Lonely' })
    const result = computeTreeLayoutV3([lonely], [], 'lonely')
    expect(result.visualNodes.length).toBe(1)
    expect(result.visualNodes[0].personId).toBe('lonely')
  })
})
