import { describe, it, expect } from 'vitest'
import { validateLayoutResult } from './validateLayout'
import type { LayoutResultV3, VisualPersonNode, PositionedFamilyConnectorV3 } from '../../types'

function makeNode(overrides: Partial<VisualPersonNode> & { visualId: string }): VisualPersonNode {
  return {
    personId: 'p1',
    person: {
      id: 'p1', firstName: 'Test', lastName: 'Person', birthName: null,
      birthDate: null, birthPlace: null, deathDate: null, deathPlace: null,
      gender: 'male', occupation: null, photos: [], stories: [],
      contactInfo: null, familySide: 'center',
    },
    familyId: 'f1',
    role: 'parent',
    x: 0,
    y: 0,
    width: 140,
    height: 90,
    ...overrides,
  }
}

function makeResult(
  nodes: VisualPersonNode[],
  families: PositionedFamilyConnectorV3[] = [],
): LayoutResultV3 {
  return {
    visualNodes: nodes,
    families,
    nodeIndex: new Map(nodes.map(n => [n.visualId, n])),
    width: 500,
    height: 300,
  }
}

describe('validateLayoutResult', () => {
  it('accepts a valid layout', () => {
    const n1 = makeNode({ visualId: 'v1', x: 0, y: 0 })
    const n2 = makeNode({ visualId: 'v2', x: 200, y: 0 })
    const result = makeResult([n1, n2], [{
      familyId: 'f1',
      parentVisualIds: ['v1', 'v2'],
      childVisualIds: [],
      centerX: 100,
      parentY: 0,
      childY: 250,
    }])
    expect(() => validateLayoutResult(result)).not.toThrow()
  })

  it('throws on duplicate visualIds', () => {
    const n1 = makeNode({ visualId: 'v1', x: 0, y: 0 })
    const n2 = makeNode({ visualId: 'v1', x: 200, y: 0 })
    const result = makeResult([n1, n2])
    expect(() => validateLayoutResult(result)).toThrow(/Duplicate visualId/)
  })

  it('throws on non-finite coordinates', () => {
    const n1 = makeNode({ visualId: 'v1', x: NaN, y: 0 })
    const result = makeResult([n1])
    expect(() => validateLayoutResult(result)).toThrow(/non-finite/)
  })

  it('throws on infinite coordinates', () => {
    const n1 = makeNode({ visualId: 'v1', x: Infinity, y: 0 })
    const result = makeResult([n1])
    expect(() => validateLayoutResult(result)).toThrow(/non-finite/)
  })

  it('throws on missing parent visual node reference', () => {
    const n1 = makeNode({ visualId: 'v1', x: 0, y: 0 })
    const result = makeResult([n1], [{
      familyId: 'f1',
      parentVisualIds: ['v1', 'v-missing'],
      childVisualIds: [],
      centerX: 0,
      parentY: 0,
      childY: 250,
    }])
    expect(() => validateLayoutResult(result)).toThrow(/missing parent visual node/)
  })

  it('throws on missing child visual node reference', () => {
    const n1 = makeNode({ visualId: 'v1', x: 0, y: 0 })
    const result = makeResult([n1], [{
      familyId: 'f1',
      parentVisualIds: ['v1'],
      childVisualIds: ['v-missing'],
      centerX: 0,
      parentY: 0,
      childY: 250,
    }])
    expect(() => validateLayoutResult(result)).toThrow(/missing child visual node/)
  })

  it('throws on duplicate family connector', () => {
    const n1 = makeNode({ visualId: 'v1', x: 0, y: 0 })
    const fam = {
      familyId: 'f1',
      parentVisualIds: ['v1'],
      childVisualIds: [],
      centerX: 0,
      parentY: 0,
      childY: 250,
    }
    const result = makeResult([n1], [fam, { ...fam }])
    expect(() => validateLayoutResult(result)).toThrow(/Duplicate family connector/)
  })

  it('throws on overlapping nodes on same row', () => {
    const n1 = makeNode({ visualId: 'v1', x: 0, y: 0 })
    const n2 = makeNode({ visualId: 'v2', x: 50, y: 0 }) // gap = 50 < 140
    const result = makeResult([n1, n2])
    expect(() => validateLayoutResult(result)).toThrow(/Overlap/)
  })

  it('allows nodes at same position (visual instances of same person)', () => {
    const n1 = makeNode({ visualId: 'v1', personId: 'p1', x: 0, y: 0 })
    const n2 = makeNode({ visualId: 'v2', personId: 'p1', x: 0, y: 0 })
    const result = makeResult([n1, n2])
    // Same x position should deduplicate in overlap check
    expect(() => validateLayoutResult(result)).not.toThrow()
  })

  it('accepts empty layout', () => {
    const result = makeResult([])
    expect(() => validateLayoutResult(result)).not.toThrow()
  })
})
