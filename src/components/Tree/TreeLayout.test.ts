import { computeTreeLayout } from './TreeLayout';
import type { Person, Relationship } from '../../types';

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

const jens = makePerson({ id: 'jens', firstName: 'Jens', familySide: 'jens' });
const klara = makePerson({ id: 'klara', firstName: 'Klara', gender: 'female', familySide: 'klara' });
const jensFather = makePerson({ id: 'jens-father', firstName: 'JensFather', familySide: 'jens' });
const jensMother = makePerson({ id: 'jens-mother', firstName: 'JensMother', gender: 'female', familySide: 'jens' });
const klaraFather = makePerson({ id: 'klara-father', firstName: 'KlaraFather', familySide: 'klara' });
const klaraMother = makePerson({ id: 'klara-mother', firstName: 'KlaraMother', gender: 'female', familySide: 'klara' });
const jensSibling = makePerson({ id: 'jens-sibling', firstName: 'JensSibling', familySide: 'jens' });

const persons: Person[] = [jens, klara, jensFather, jensMother, klaraFather, klaraMother, jensSibling];

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
];

describe('computeTreeLayout', () => {
  it('returns a layout with positioned nodes', () => {
    const layout = computeTreeLayout(persons, relationships, 'jens');
    expect(layout).toBeDefined();
    expect(Array.isArray(layout)).toBe(true);
    expect(layout.length).toBeGreaterThan(0);
  });

  it('places the center couple near origin', () => {
    const layout = computeTreeLayout(persons, relationships, 'jens');
    const jensNode = layout.find((n) => n.personId === 'jens');
    const klaraNode = layout.find((n) => n.personId === 'klara');
    expect(jensNode).toBeDefined();
    expect(klaraNode).toBeDefined();
    // Center couple should be near origin (within reasonable bounds)
    expect(Math.abs(jensNode!.x)).toBeLessThan(500);
    expect(Math.abs(jensNode!.y)).toBeLessThan(500);
    expect(Math.abs(klaraNode!.x)).toBeLessThan(500);
    expect(Math.abs(klaraNode!.y)).toBeLessThan(500);
  });

  it('places Jens parents to the left of center', () => {
    const layout = computeTreeLayout(persons, relationships, 'jens');
    const jensNode = layout.find((n) => n.personId === 'jens');
    const jensFatherNode = layout.find((n) => n.personId === 'jens-father');
    expect(jensNode).toBeDefined();
    expect(jensFatherNode).toBeDefined();
    // Parents should be positioned to the left (smaller x) or above (smaller y)
    const parentIsLeft = jensFatherNode!.x < jensNode!.x;
    const parentIsAbove = jensFatherNode!.y < jensNode!.y;
    expect(parentIsLeft || parentIsAbove).toBe(true);
  });

  it('places Klara parents to the right of center', () => {
    const layout = computeTreeLayout(persons, relationships, 'jens');
    const klaraNode = layout.find((n) => n.personId === 'klara');
    const klaraFatherNode = layout.find((n) => n.personId === 'klara-father');
    expect(klaraNode).toBeDefined();
    expect(klaraFatherNode).toBeDefined();
    // Parents should be to the right (larger x) or above (smaller y)
    const parentIsRight = klaraFatherNode!.x > klaraNode!.x;
    const parentIsAbove = klaraFatherNode!.y < klaraNode!.y;
    expect(parentIsRight || parentIsAbove).toBe(true);
  });

  it('places siblings with vertical offset from each other', () => {
    const layout = computeTreeLayout(persons, relationships, 'jens');
    const jensNode = layout.find((n) => n.personId === 'jens');
    const siblingNode = layout.find((n) => n.personId === 'jens-sibling');
    expect(jensNode).toBeDefined();
    expect(siblingNode).toBeDefined();
    // Siblings should have different positions
    const differentX = jensNode!.x !== siblingNode!.x;
    const differentY = jensNode!.y !== siblingNode!.y;
    expect(differentX || differentY).toBe(true);
  });

  it('includes all persons in the layout', () => {
    const layout = computeTreeLayout(persons, relationships, 'jens');
    const layoutIds = layout.map((n) => n.personId).sort();
    const personIds = persons.map((p) => p.id).sort();
    expect(layoutIds).toEqual(personIds);
  });
});
