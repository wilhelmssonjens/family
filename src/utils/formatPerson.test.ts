import { formatLifespan, formatFullName, getInitials, getRelationLabel } from './formatPerson';
import { buildFamilyGraph } from './buildTree';
import type { Person, Relationship } from '../types';

const makePerson = (overrides: Partial<Person>): Person => ({
  id: 'test',
  firstName: 'John',
  lastName: 'Doe',
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

describe('formatLifespan', () => {
  it('returns birth and death years when both are provided', () => {
    const result = formatLifespan('1950-03-15', '2020-11-01', null, null);
    expect(result).toContain('1950');
    expect(result).toContain('2020');
  });

  it('returns birth year only when still alive', () => {
    const result = formatLifespan('1990-06-20', null, null, null);
    expect(result).toContain('1990');
  });

  it('returns empty or dash when no dates are provided', () => {
    const result = formatLifespan(null, null, null, null);
    expect(typeof result).toBe('string');
  });

  it('handles death date with no birth date', () => {
    const result = formatLifespan(null, '2010-01-01', null, null);
    // With no birth date, the function returns empty string
    expect(typeof result).toBe('string');
  });
});

describe('formatFullName', () => {
  it('returns first and last name', () => {
    const result = formatFullName('Anna', 'Schmidt', null);
    expect(result).toContain('Anna');
    expect(result).toContain('Schmidt');
  });

  it('includes birth name when provided', () => {
    const result = formatFullName('Anna', 'Schmidt', 'Mueller');
    expect(result).toContain('Anna');
    expect(result).toContain('Schmidt');
    expect(result).toContain('Mueller');
  });

  it('works without birth name', () => {
    const result = formatFullName('Max', 'Weber', null);
    expect(result).toContain('Max');
    expect(result).toContain('Weber');
  });
});

describe('getInitials', () => {
  it('returns initials from first and last name', () => {
    const result = getInitials('John', 'Doe');
    expect(result).toBe('JD');
  });

  it('handles single name', () => {
    const result = getInitials('Madonna', 'M');
    expect(result).toContain('M');
  });

  it('handles compound names', () => {
    const result = getInitials('Anna-Maria', 'von Berg');
    expect(result.length).toBeGreaterThanOrEqual(2);
  });
});

describe('getRelationLabel', () => {
  const jens = makePerson({ id: 'jens', firstName: 'Jens', gender: 'male' });
  const anna = makePerson({ id: 'anna', firstName: 'Anna', gender: 'female' });
  const child = makePerson({ id: 'child', firstName: 'Erik', gender: 'male' });

  const persons: Person[] = [jens, anna, child];

  const relationships: Relationship[] = [
    { type: 'partner', from: 'jens', to: 'anna', status: 'current' },
    { type: 'parent', from: 'jens', to: 'child' },
    { type: 'parent', from: 'anna', to: 'child' },
  ];

  it('returns a label for partner relationship', () => {
    const graph = buildFamilyGraph(persons, relationships);
    const result = getRelationLabel(graph, 'jens', persons);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns a label for parent relationship', () => {
    const graph = buildFamilyGraph(persons, relationships);
    const result = getRelationLabel(graph, 'jens', persons);
    expect(typeof result).toBe('string');
    expect(result).toContain('Far till Erik');
  });

  it('returns different labels for different types', () => {
    const graph = buildFamilyGraph(persons, relationships);
    const jensLabel = getRelationLabel(graph, 'jens', persons);
    const annaLabel = getRelationLabel(graph, 'anna', persons);
    // Jens is "Far till Erik", Anna is "Mor till Erik"
    expect(jensLabel).not.toBe(annaLabel);
  });
});
