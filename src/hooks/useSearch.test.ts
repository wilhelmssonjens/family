import { searchPersons } from './useSearch';
import type { Person } from '../types';

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

const persons: Person[] = [
  makePerson({ id: '1', firstName: 'Jens', lastName: 'Mueller', birthPlace: 'Berlin', occupation: 'Engineer' }),
  makePerson({ id: '2', firstName: 'Klara', lastName: 'Schmidt', birthPlace: 'Hamburg', occupation: 'Teacher' }),
  makePerson({ id: '3', firstName: 'Hans', lastName: 'Weber', birthPlace: 'Munich', occupation: 'Doctor' }),
  makePerson({ id: '4', firstName: 'Anna', lastName: 'Mueller', birthPlace: 'Berlin', occupation: null }),
];

describe('searchPersons', () => {
  it('returns all persons for empty query', () => {
    const results = searchPersons(persons, '');
    expect(results).toHaveLength(persons.length);
  });

  it('searches by first name', () => {
    const results = searchPersons(persons, 'Jens');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('1');
  });

  it('searches by last name', () => {
    const results = searchPersons(persons, 'Mueller');
    expect(results).toHaveLength(2);
    const ids = results.map((p) => p.id).sort();
    expect(ids).toEqual(['1', '4']);
  });

  it('searches by place (birthPlace)', () => {
    const results = searchPersons(persons, 'Berlin');
    expect(results).toHaveLength(2);
    const ids = results.map((p) => p.id).sort();
    expect(ids).toEqual(['1', '4']);
  });

  it('searches by occupation', () => {
    const results = searchPersons(persons, 'Teacher');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('2');
  });

  it('is case insensitive', () => {
    const results = searchPersons(persons, 'jens');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('1');
  });

  it('returns empty array when no match', () => {
    const results = searchPersons(persons, 'Nonexistent');
    expect(results).toHaveLength(0);
  });

  it('handles partial matches', () => {
    const results = searchPersons(persons, 'Muel');
    expect(results.length).toBeGreaterThanOrEqual(2);
  });
});
