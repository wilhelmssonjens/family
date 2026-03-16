import { buildFamilyGraph, getParents, getChildren, getSiblings, getPartners } from './buildTree';
import type { Person, Relationship } from '../types';

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
});

const alice = makePerson({ id: 'alice', firstName: 'Alice', gender: 'female' });
const bob = makePerson({ id: 'bob', firstName: 'Bob', gender: 'male' });
const charlie = makePerson({ id: 'charlie', firstName: 'Charlie', gender: 'male' });
const diana = makePerson({ id: 'diana', firstName: 'Diana', gender: 'female' });
const eve = makePerson({ id: 'eve', firstName: 'Eve', gender: 'female' });

const persons: Person[] = [alice, bob, charlie, diana, eve];

const relationships: Relationship[] = [
  { type: 'partner', from: 'alice', to: 'bob', status: 'current' },
  { type: 'parent', from: 'alice', to: 'charlie' },
  { type: 'parent', from: 'bob', to: 'charlie' },
  { type: 'parent', from: 'alice', to: 'diana' },
  { type: 'parent', from: 'bob', to: 'diana' },
  { type: 'parent', from: 'charlie', to: 'eve' },
];

describe('buildFamilyGraph', () => {
  it('returns a graph object with person lookup and relationships', () => {
    const graph = buildFamilyGraph(persons, relationships);
    expect(graph).toBeDefined();
    expect(typeof graph).toBe('object');
  });

  it('handles empty arrays', () => {
    const graph = buildFamilyGraph([], []);
    expect(graph).toBeDefined();
  });

  it('handles persons with no relationships', () => {
    const lonely = [makePerson({ id: 'lonely', firstName: 'Lonely' })];
    const graph = buildFamilyGraph(lonely, []);
    expect(graph).toBeDefined();
  });
});

describe('getParents', () => {
  it('returns parents for a child', () => {
    const graph = buildFamilyGraph(persons, relationships);
    const parents = getParents(graph, 'charlie');
    const parentIds = parents.map((p) => p.id).sort();
    expect(parentIds).toEqual(['alice', 'bob']);
  });

  it('returns empty array for a person with no parents', () => {
    const graph = buildFamilyGraph(persons, relationships);
    const parents = getParents(graph, 'alice');
    expect(parents).toEqual([]);
  });

  it('returns empty array for unknown id', () => {
    const graph = buildFamilyGraph(persons, relationships);
    const parents = getParents(graph, 'unknown');
    expect(parents).toEqual([]);
  });
});

describe('getChildren', () => {
  it('returns children for a parent', () => {
    const graph = buildFamilyGraph(persons, relationships);
    const children = getChildren(graph, 'alice');
    const childIds = children.map((p) => p.id).sort();
    expect(childIds).toEqual(['charlie', 'diana']);
  });

  it('returns empty array for a person with no children', () => {
    const graph = buildFamilyGraph(persons, relationships);
    const children = getChildren(graph, 'eve');
    expect(children).toEqual([]);
  });

  it('returns empty array for unknown id', () => {
    const graph = buildFamilyGraph(persons, relationships);
    const children = getChildren(graph, 'nonexistent');
    expect(children).toEqual([]);
  });
});

describe('getSiblings', () => {
  it('returns siblings (same parents, excluding self)', () => {
    const graph = buildFamilyGraph(persons, relationships);
    const siblings = getSiblings(graph, 'charlie');
    const siblingIds = siblings.map((p) => p.id);
    expect(siblingIds).toContain('diana');
    expect(siblingIds).not.toContain('charlie');
  });

  it('returns empty array for a person with no siblings', () => {
    const graph = buildFamilyGraph(persons, relationships);
    const siblings = getSiblings(graph, 'eve');
    expect(siblings).toEqual([]);
  });

  it('returns empty array for a person with no parents', () => {
    const graph = buildFamilyGraph(persons, relationships);
    const siblings = getSiblings(graph, 'alice');
    expect(siblings).toEqual([]);
  });
});

describe('getPartners', () => {
  it('returns partner for a paired person', () => {
    const graph = buildFamilyGraph(persons, relationships);
    const partners = getPartners(graph, 'alice');
    const partnerIds = partners.map((p) => p.id);
    expect(partnerIds).toContain('bob');
  });

  it('returns partner from reverse direction', () => {
    const graph = buildFamilyGraph(persons, relationships);
    const partners = getPartners(graph, 'bob');
    const partnerIds = partners.map((p) => p.id);
    expect(partnerIds).toContain('alice');
  });

  it('returns empty array for a person with no partner', () => {
    const graph = buildFamilyGraph(persons, relationships);
    const partners = getPartners(graph, 'eve');
    expect(partners).toEqual([]);
  });
});
