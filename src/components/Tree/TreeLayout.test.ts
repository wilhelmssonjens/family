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

  it('places Jens parents above Jens (negative y)', () => {
    const layout = computeTreeLayout(persons, relationships, 'jens');
    const jensNode = layout.find((n) => n.personId === 'jens');
    const jensFatherNode = layout.find((n) => n.personId === 'jens-father');
    expect(jensNode).toBeDefined();
    expect(jensFatherNode).toBeDefined();
    expect(jensFatherNode!.y).toBeLessThan(jensNode!.y);
  });

  it('places Klara parents above Klara (negative y)', () => {
    const layout = computeTreeLayout(persons, relationships, 'jens');
    const klaraNode = layout.find((n) => n.personId === 'klara');
    const klaraFatherNode = layout.find((n) => n.personId === 'klara-father');
    expect(klaraNode).toBeDefined();
    expect(klaraFatherNode).toBeDefined();
    expect(klaraFatherNode!.y).toBeLessThan(klaraNode!.y);
  });

  it('places siblings on the same y-level with different x', () => {
    const layout = computeTreeLayout(persons, relationships, 'jens');
    const jensNode = layout.find((n) => n.personId === 'jens');
    const siblingNode = layout.find((n) => n.personId === 'jens-sibling');
    expect(jensNode).toBeDefined();
    expect(siblingNode).toBeDefined();
    expect(siblingNode!.y).toBe(jensNode!.y);
    expect(siblingNode!.x).not.toBe(jensNode!.x);
  });

  it('centers parents above children row', () => {
    const layout = computeTreeLayout(persons, relationships, 'jens');
    const jensNode = layout.find((n) => n.personId === 'jens')!;
    const siblingNode = layout.find((n) => n.personId === 'jens-sibling')!;
    const jensFatherNode = layout.find((n) => n.personId === 'jens-father')!;
    const jensMotherNode = layout.find((n) => n.personId === 'jens-mother')!;
    const parentCenterX = (jensFatherNode.x + jensMotherNode.x) / 2;
    const childrenCenterX = (jensNode.x + siblingNode.x) / 2;
    expect(parentCenterX).toBeCloseTo(childrenCenterX, 0);
  });

  it('includes all persons in the layout', () => {
    const layout = computeTreeLayout(persons, relationships, 'jens');
    const layoutIds = layout.map((n) => n.personId).sort();
    const personIds = persons.map((p) => p.id).sort();
    expect(layoutIds).toEqual(personIds);
  });

  it('places partner of single parent (only one parent-relation to child)', () => {
    // Tor is Klara's only parent, but Tor has a partner Lena
    const p = [
      makePerson({ id: 'jens', firstName: 'Jens' }),
      makePerson({ id: 'klara', firstName: 'Klara', gender: 'female' }),
      makePerson({ id: 'tor', firstName: 'Tor' }),
      makePerson({ id: 'lena', firstName: 'Lena', gender: 'female' }),
    ];
    const r: Relationship[] = [
      { type: 'partner', from: 'jens', to: 'klara', status: 'current' },
      { type: 'parent', from: 'tor', to: 'klara' },
      { type: 'partner', from: 'tor', to: 'lena', status: 'current' },
    ];
    const layout = computeTreeLayout(p, r, 'jens');
    const lenaNode = layout.find(n => n.personId === 'lena');
    const torNode = layout.find(n => n.personId === 'tor');
    expect(lenaNode).toBeDefined();
    expect(torNode).toBeDefined();
    expect(lenaNode!.y).toBe(torNode!.y);
  });

  it('no cards overlap on the same row', () => {
    const layout = computeTreeLayout(persons, relationships, 'jens');
    // Group by y
    const rows = new Map<number, typeof layout>();
    for (const node of layout) {
      const row = rows.get(node.y) ?? [];
      row.push(node);
      rows.set(node.y, row);
    }
    for (const row of rows.values()) {
      if (row.length < 2) continue;
      row.sort((a, b) => a.x - b.x);
      for (let i = 1; i < row.length; i++) {
        const gap = row[i].x - row[i - 1].x;
        expect(gap).toBeGreaterThanOrEqual(140); // CARD_WIDTH
      }
    }
  });

  it('discovers siblings from all parents, not just the first', () => {
    // Sibling is only a child of parent-b (not parent-a) — must still appear
    const p = [
      makePerson({ id: 'jens', firstName: 'Jens' }),
      makePerson({ id: 'klara', firstName: 'Klara', gender: 'female' }),
      makePerson({ id: 'parent-a', firstName: 'ParentA' }),
      makePerson({ id: 'parent-b', firstName: 'ParentB', gender: 'female' }),
      makePerson({ id: 'half-sibling', firstName: 'HalfSibling' }),
    ];
    const r: Relationship[] = [
      { type: 'partner', from: 'jens', to: 'klara', status: 'current' },
      { type: 'parent', from: 'parent-a', to: 'klara' },
      { type: 'parent', from: 'parent-b', to: 'klara' },
      { type: 'partner', from: 'parent-a', to: 'parent-b', status: 'current' },
      // Only parent-b is parent of half-sibling (not parent-a)
      { type: 'parent', from: 'parent-b', to: 'half-sibling' },
    ];
    const layout = computeTreeLayout(p, r, 'jens');
    const siblingNode = layout.find(n => n.personId === 'half-sibling');
    const klaraNode = layout.find(n => n.personId === 'klara');
    expect(siblingNode).toBeDefined();
    expect(klaraNode).toBeDefined();
    expect(siblingNode!.y).toBe(klaraNode!.y);
  });

  it('creates parent-child links from both parents to all siblings', () => {
    const layout = computeTreeLayout(persons, relationships, 'jens');
    const fatherNode = layout.find(n => n.personId === 'jens-father')!;
    const motherNode = layout.find(n => n.personId === 'jens-mother')!;
    const siblingLinks = fatherNode.links.filter(l => l.targetId === 'jens-sibling' && l.type === 'parent-child');
    const motherSiblingLinks = motherNode.links.filter(l => l.targetId === 'jens-sibling' && l.type === 'parent-child');
    expect(siblingLinks.length).toBeGreaterThan(0);
    expect(motherSiblingLinks.length).toBeGreaterThan(0);
  });
});
