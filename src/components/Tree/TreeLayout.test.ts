import { computeTreeLayout, assignGenerations, measurePerson, measureFamily, measureAllFamilies, buildFamilyLookups } from './TreeLayout';
import { buildFamilyUnits } from '../../utils/buildTree';
import type { Person, Relationship } from '../../types';
import type { FamilyUnit } from '../../utils/buildTree';

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

  it('parents stay centered above children after overlap resolution', () => {
    // 4 siblings force overlap resolution — parents must re-center
    const p = [
      makePerson({ id: 'jens', firstName: 'Jens' }),
      makePerson({ id: 'klara', firstName: 'Klara', gender: 'female' }),
      makePerson({ id: 'dad', firstName: 'Dad' }),
      makePerson({ id: 'mom', firstName: 'Mom', gender: 'female' }),
      makePerson({ id: 'sib1', firstName: 'Sib1' }),
      makePerson({ id: 'sib2', firstName: 'Sib2' }),
      makePerson({ id: 'sib3', firstName: 'Sib3' }),
    ];
    const r: Relationship[] = [
      { type: 'partner', from: 'jens', to: 'klara', status: 'current' },
      { type: 'parent', from: 'dad', to: 'jens' },
      { type: 'parent', from: 'mom', to: 'jens' },
      { type: 'partner', from: 'dad', to: 'mom', status: 'current' },
      { type: 'parent', from: 'dad', to: 'sib1' },
      { type: 'parent', from: 'mom', to: 'sib1' },
      { type: 'parent', from: 'dad', to: 'sib2' },
      { type: 'parent', from: 'mom', to: 'sib2' },
      { type: 'parent', from: 'dad', to: 'sib3' },
      { type: 'parent', from: 'mom', to: 'sib3' },
    ];
    const layout = computeTreeLayout(p, r, 'jens');
    const dadNode = layout.find(n => n.personId === 'dad')!;
    const momNode = layout.find(n => n.personId === 'mom')!;
    const childNodes = ['jens', 'sib1', 'sib2', 'sib3']
      .map(id => layout.find(n => n.personId === id)!)
      .filter(Boolean);

    const parentCenter = (dadNode.x + momNode.x) / 2;
    const childXs = childNodes.map(n => n.x);
    const childCenter = (Math.min(...childXs) + Math.max(...childXs)) / 2;
    expect(parentCenter).toBeCloseTo(childCenter, 0);
  });

  it('adds extra spacing between different family groups on same row', () => {
    // Jens's parents (jens-father, jens-mother) and Klara's parents (klara-father, klara-mother)
    // are on the same y-row but are separate family groups
    const layout = computeTreeLayout(persons, relationships, 'jens');
    const jfNode = layout.find(n => n.personId === 'jens-father')!;
    const jmNode = layout.find(n => n.personId === 'jens-mother')!;
    const kfNode = layout.find(n => n.personId === 'klara-father')!;
    const kmNode = layout.find(n => n.personId === 'klara-mother')!;

    // Both couples are on the same y-level
    expect(jfNode.y).toBe(kfNode.y);

    // Find gap between rightmost of Jens-parents group and leftmost of Klara-parents group
    const jensGroupRight = Math.max(jfNode.x, jmNode.x);
    const klaraGroupLeft = Math.min(kfNode.x, kmNode.x);
    const interGroupGap = klaraGroupLeft - jensGroupRight;
    // Inter-group gap should be larger than minimum card spacing (160) due to FAMILY_GROUP_GAP
    expect(interGroupGap).toBeGreaterThan(160);
  });

  it('no overlaps in a large tree with many siblings', () => {
    // Both sides have 3 siblings each — stress test
    const p = [
      makePerson({ id: 'jens', firstName: 'Jens' }),
      makePerson({ id: 'klara', firstName: 'Klara', gender: 'female' }),
      makePerson({ id: 'jf', firstName: 'JF' }),
      makePerson({ id: 'jm', firstName: 'JM', gender: 'female' }),
      makePerson({ id: 'kf', firstName: 'KF' }),
      makePerson({ id: 'km', firstName: 'KM', gender: 'female' }),
      makePerson({ id: 'js1', firstName: 'JS1' }),
      makePerson({ id: 'js2', firstName: 'JS2' }),
      makePerson({ id: 'ks1', firstName: 'KS1' }),
      makePerson({ id: 'ks2', firstName: 'KS2' }),
    ];
    const r: Relationship[] = [
      { type: 'partner', from: 'jens', to: 'klara', status: 'current' },
      { type: 'parent', from: 'jf', to: 'jens' },
      { type: 'parent', from: 'jm', to: 'jens' },
      { type: 'partner', from: 'jf', to: 'jm', status: 'current' },
      { type: 'parent', from: 'jf', to: 'js1' },
      { type: 'parent', from: 'jm', to: 'js1' },
      { type: 'parent', from: 'jf', to: 'js2' },
      { type: 'parent', from: 'jm', to: 'js2' },
      { type: 'parent', from: 'kf', to: 'klara' },
      { type: 'parent', from: 'km', to: 'klara' },
      { type: 'partner', from: 'kf', to: 'km', status: 'current' },
      { type: 'parent', from: 'kf', to: 'ks1' },
      { type: 'parent', from: 'km', to: 'ks1' },
      { type: 'parent', from: 'kf', to: 'ks2' },
      { type: 'parent', from: 'km', to: 'ks2' },
    ];
    const layout = computeTreeLayout(p, r, 'jens');

    // Verify all placed
    expect(layout.length).toBe(p.length);

    // Verify no overlaps on any row
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
        expect(row[i].x - row[i - 1].x).toBeGreaterThanOrEqual(140);
      }
    }
  });

  it('places descendants of non-center persons', () => {
    const p = [
      makePerson({ id: 'center' }),
      makePerson({ id: 'spouse', gender: 'female' }),
      makePerson({ id: 'dad' }),
      makePerson({ id: 'mom', gender: 'female' }),
      makePerson({ id: 'sibling', gender: 'female' }),
      makePerson({ id: 'nephew' }),
    ];
    const r: Relationship[] = [
      { type: 'partner', from: 'center', to: 'spouse', status: 'current' },
      { type: 'parent', from: 'dad', to: 'center' },
      { type: 'parent', from: 'mom', to: 'center' },
      { type: 'parent', from: 'dad', to: 'sibling' },
      { type: 'parent', from: 'mom', to: 'sibling' },
      { type: 'partner', from: 'dad', to: 'mom', status: 'current' },
      { type: 'parent', from: 'sibling', to: 'nephew' },
    ];
    const layout = computeTreeLayout(p, r, 'center');
    const nephewNode = layout.find(n => n.personId === 'nephew');
    const siblingNode = layout.find(n => n.personId === 'sibling');
    expect(nephewNode).toBeDefined();
    expect(siblingNode).toBeDefined();
    expect(nephewNode!.y).toBeGreaterThan(siblingNode!.y);
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

describe('assignGenerations', () => {
  // Simple family: center + partner, two parents, one sibling, two grandparents
  const simplePersons: Person[] = [
    makePerson({ id: 'center', firstName: 'Center' }),
    makePerson({ id: 'spouse', firstName: 'Spouse', gender: 'female' }),
    makePerson({ id: 'dad', firstName: 'Dad' }),
    makePerson({ id: 'mom', firstName: 'Mom', gender: 'female' }),
    makePerson({ id: 'sibling', firstName: 'Sibling' }),
    makePerson({ id: 'grandpa', firstName: 'Grandpa' }),
    makePerson({ id: 'grandma', firstName: 'Grandma', gender: 'female' }),
    makePerson({ id: 'child1', firstName: 'Child1' }),
  ];
  const simpleRels: Relationship[] = [
    { type: 'partner', from: 'center', to: 'spouse', status: 'current' },
    { type: 'parent', from: 'dad', to: 'center' },
    { type: 'parent', from: 'mom', to: 'center' },
    { type: 'partner', from: 'dad', to: 'mom', status: 'current' },
    { type: 'parent', from: 'dad', to: 'sibling' },
    { type: 'parent', from: 'mom', to: 'sibling' },
    { type: 'parent', from: 'grandpa', to: 'dad' },
    { type: 'parent', from: 'grandma', to: 'dad' },
    { type: 'partner', from: 'grandpa', to: 'grandma', status: 'current' },
    { type: 'parent', from: 'center', to: 'child1' },
    { type: 'parent', from: 'spouse', to: 'child1' },
  ];

  it('center person is generation 0', () => {
    const units = buildFamilyUnits(simplePersons, simpleRels);
    const gens = assignGenerations('center', units);
    expect(gens.get('center')).toBe(0);
  });

  it('parents are generation -1', () => {
    const units = buildFamilyUnits(simplePersons, simpleRels);
    const gens = assignGenerations('center', units);
    expect(gens.get('dad')).toBe(-1);
    expect(gens.get('mom')).toBe(-1);
  });

  it('partners have same generation', () => {
    const units = buildFamilyUnits(simplePersons, simpleRels);
    const gens = assignGenerations('center', units);
    // Center's spouse
    expect(gens.get('spouse')).toBe(0);
    // Dad's partner (mom) should have same gen as dad
    expect(gens.get('mom')).toBe(gens.get('dad'));
    // Grandparents should be partners at same gen
    expect(gens.get('grandpa')).toBe(gens.get('grandma'));
  });

  it('grandparents are generation -2', () => {
    const units = buildFamilyUnits(simplePersons, simpleRels);
    const gens = assignGenerations('center', units);
    expect(gens.get('grandpa')).toBe(-2);
    expect(gens.get('grandma')).toBe(-2);
  });

  it('children of siblings are same generation as center children', () => {
    // Sibling has a child — that child should be gen +1 (same as center's child)
    const extPersons: Person[] = [
      ...simplePersons,
      makePerson({ id: 'nephew', firstName: 'Nephew' }),
    ];
    const extRels: Relationship[] = [
      ...simpleRels,
      { type: 'parent', from: 'sibling', to: 'nephew' },
    ];
    const units = buildFamilyUnits(extPersons, extRels);
    const gens = assignGenerations('center', units);
    expect(gens.get('nephew')).toBe(1);
    expect(gens.get('child1')).toBe(1);
  });

  it('siblings have the same generation as center', () => {
    const units = buildFamilyUnits(simplePersons, simpleRels);
    const gens = assignGenerations('center', units);
    expect(gens.get('sibling')).toBe(0);
  });

  it('children are generation +1', () => {
    const units = buildFamilyUnits(simplePersons, simpleRels);
    const gens = assignGenerations('center', units);
    expect(gens.get('child1')).toBe(1);
  });

  it('all persons get a generation', () => {
    const units = buildFamilyUnits(simplePersons, simpleRels);
    const gens = assignGenerations('center', units);
    for (const p of simplePersons) {
      expect(gens.has(p.id)).toBe(true);
    }
  });

  it('works with real family data expectations', () => {
    // Build a mini version of the real data to test specific expected values
    const realPersons: Person[] = [
      makePerson({ id: 'jens', firstName: 'Jens' }),
      makePerson({ id: 'klara', firstName: 'Klara', gender: 'female' }),
      makePerson({ id: 'per', firstName: 'Per' }),
      makePerson({ id: 'laila', firstName: 'Laila', gender: 'female' }),
      makePerson({ id: 'eva', firstName: 'Eva', gender: 'female' }),
      makePerson({ id: 'gunnar-w', firstName: 'Gunnar' }),
      makePerson({ id: 'barbro', firstName: 'Barbro', gender: 'female' }),
      makePerson({ id: 'birgitta', firstName: 'Birgitta', gender: 'female' }),
      makePerson({ id: 'mats', firstName: 'Mats' }),
      makePerson({ id: 'hampus-wikmark', firstName: 'Hampus' }),
      makePerson({ id: 'knut', firstName: 'Knut' }),
      makePerson({ id: 'jacob-wikmark', firstName: 'Jacob' }),
      makePerson({ id: 'agnes', firstName: 'Agnes', gender: 'female' }),
      makePerson({ id: 'konrad', firstName: 'Konrad' }),
      makePerson({ id: 'augusta', firstName: 'Augusta', gender: 'female' }),
      makePerson({ id: 'lennart', firstName: 'Lennart' }),
      makePerson({ id: 'greta', firstName: 'Greta', gender: 'female' }),
      makePerson({ id: 'arne-johansson', firstName: 'Arne' }),
      makePerson({ id: 'inger-sand', firstName: 'Inger', gender: 'female' }),
      makePerson({ id: 'karin-wernmark', firstName: 'Karin', gender: 'female' }),
      makePerson({ id: 'tor-ahlbck', firstName: 'Tor' }),
      makePerson({ id: 'lena-ahlbck', firstName: 'Lena', gender: 'female' }),
      makePerson({ id: 'erik-ahlbck', firstName: 'Erik' }),
      makePerson({ id: 'johan-ahlbck', firstName: 'Johan' }),
    ];
    const realRels: Relationship[] = [
      { type: 'partner', from: 'jens', to: 'klara', status: 'current' },
      { type: 'parent', from: 'per', to: 'jens' },
      { type: 'parent', from: 'laila', to: 'jens' },
      { type: 'partner', from: 'per', to: 'laila', status: 'current' },
      { type: 'parent', from: 'per', to: 'eva' },
      { type: 'parent', from: 'laila', to: 'eva' },
      { type: 'parent', from: 'gunnar-w', to: 'per' },
      { type: 'parent', from: 'barbro', to: 'per' },
      { type: 'partner', from: 'gunnar-w', to: 'barbro', status: 'current' },
      { type: 'parent', from: 'gunnar-w', to: 'birgitta' },
      { type: 'parent', from: 'barbro', to: 'birgitta' },
      { type: 'parent', from: 'gunnar-w', to: 'mats' },
      { type: 'parent', from: 'barbro', to: 'mats' },
      { type: 'parent', from: 'birgitta', to: 'hampus-wikmark' },
      { type: 'parent', from: 'hampus-wikmark', to: 'knut' },
      { type: 'parent', from: 'birgitta', to: 'jacob-wikmark' },
      { type: 'parent', from: 'jacob-wikmark', to: 'agnes' },
      { type: 'parent', from: 'konrad', to: 'gunnar-w' },
      { type: 'parent', from: 'augusta', to: 'gunnar-w' },
      { type: 'partner', from: 'konrad', to: 'augusta', status: 'current' },
      { type: 'parent', from: 'lennart', to: 'laila' },
      { type: 'parent', from: 'greta', to: 'laila' },
      { type: 'partner', from: 'lennart', to: 'greta', status: 'current' },
      { type: 'parent', from: 'lennart', to: 'arne-johansson' },
      { type: 'parent', from: 'greta', to: 'arne-johansson' },
      { type: 'parent', from: 'lennart', to: 'inger-sand' },
      { type: 'parent', from: 'greta', to: 'inger-sand' },
      { type: 'parent', from: 'lennart', to: 'karin-wernmark' },
      { type: 'parent', from: 'greta', to: 'karin-wernmark' },
      { type: 'parent', from: 'tor-ahlbck', to: 'klara' },
      { type: 'parent', from: 'lena-ahlbck', to: 'klara' },
      { type: 'partner', from: 'tor-ahlbck', to: 'lena-ahlbck', status: 'current' },
      { type: 'parent', from: 'tor-ahlbck', to: 'erik-ahlbck' },
      { type: 'parent', from: 'lena-ahlbck', to: 'erik-ahlbck' },
      { type: 'parent', from: 'tor-ahlbck', to: 'johan-ahlbck' },
      { type: 'parent', from: 'lena-ahlbck', to: 'johan-ahlbck' },
    ];

    const units = buildFamilyUnits(realPersons, realRels);
    const gens = assignGenerations('jens', units);

    // Center couple
    expect(gens.get('jens')).toBe(0);
    expect(gens.get('klara')).toBe(0);

    // Parents
    expect(gens.get('per')).toBe(-1);
    expect(gens.get('laila')).toBe(-1);
    expect(gens.get('tor-ahlbck')).toBe(-1);
    expect(gens.get('lena-ahlbck')).toBe(-1);

    // Siblings of center (Eva is sibling of Jens via Per+Laila)
    expect(gens.get('eva')).toBe(0);

    // Siblings of Klara
    expect(gens.get('erik-ahlbck')).toBe(0);
    expect(gens.get('johan-ahlbck')).toBe(0);

    // Grandparents
    expect(gens.get('gunnar-w')).toBe(-2);
    expect(gens.get('barbro')).toBe(-2);
    expect(gens.get('lennart')).toBe(-2);
    expect(gens.get('greta')).toBe(-2);

    // Siblings of Per (children of Gunnar+Barbro)
    expect(gens.get('birgitta')).toBe(-1);
    expect(gens.get('mats')).toBe(-1);

    // Children of Birgitta (Hampus, Jacob) — Birgitta is gen -1, so her children are gen 0
    expect(gens.get('hampus-wikmark')).toBe(0);
    expect(gens.get('jacob-wikmark')).toBe(0);

    // Grandchildren: Knut (child of Hampus), Agnes (child of Jacob)
    expect(gens.get('knut')).toBe(1);
    expect(gens.get('agnes')).toBe(1);

    // Great-grandparents
    expect(gens.get('konrad')).toBe(-3);
    expect(gens.get('augusta')).toBe(-3);

    // Siblings of Laila
    expect(gens.get('arne-johansson')).toBe(-1);
    expect(gens.get('inger-sand')).toBe(-1);
    expect(gens.get('karin-wernmark')).toBe(-1);
  });

  it('handles a single person with no relationships', () => {
    const singlePerson: Person[] = [makePerson({ id: 'alone', firstName: 'Alone' })];
    const units = buildFamilyUnits(singlePerson, []);
    const gens = assignGenerations('alone', units);
    expect(gens.get('alone')).toBe(0);
    expect(gens.size).toBe(1);
  });

  it('handles partner-only couple (no children)', () => {
    const couplePersons: Person[] = [
      makePerson({ id: 'a', firstName: 'A' }),
      makePerson({ id: 'b', firstName: 'B', gender: 'female' }),
    ];
    const coupleRels: Relationship[] = [
      { type: 'partner', from: 'a', to: 'b', status: 'current' },
    ];
    const units = buildFamilyUnits(couplePersons, coupleRels);
    const gens = assignGenerations('a', units);
    expect(gens.get('a')).toBe(0);
    expect(gens.get('b')).toBe(0);
  });
});

// --- Measure pass tests ---

// Constants mirrored from TreeLayout.ts for assertions
const CARD_WIDTH = 140;
const CARD_MARGIN = 20;
const PARTNER_GAP = 160;
const CHILD_GAP = 60;
const CARD_SLOT = CARD_WIDTH + CARD_MARGIN; // 160
const COUPLE_BLOCK = PARTNER_GAP + CARD_WIDTH + CARD_MARGIN; // 320

describe('measure pass', () => {
  it('leaf person has width CARD_WIDTH + CARD_MARGIN', () => {
    // Single person, no relationships
    const units = buildFamilyUnits(
      [makePerson({ id: 'leaf', firstName: 'Leaf' })],
      [],
    );
    const { unitsAsParent } = buildFamilyLookups(units);
    const visited = new Set<string>();
    const measuredWidths = new Map<string, number>();
    const width = measurePerson('leaf', unitsAsParent, measuredWidths, visited);
    expect(width).toBe(CARD_SLOT); // 160
  });

  it('couple without children has parentBlockWidth', () => {
    const persons = [
      makePerson({ id: 'a', firstName: 'A' }),
      makePerson({ id: 'b', firstName: 'B', gender: 'female' }),
    ];
    const rels: Relationship[] = [
      { type: 'partner', from: 'a', to: 'b', status: 'current' },
    ];
    const units = buildFamilyUnits(persons, rels);
    const widths = measureAllFamilies(units);
    // The family unit f-a-b has 2 parents, no children
    const familyUnit = units.find(u => u.parentIds.includes('a') && u.parentIds.includes('b'))!;
    expect(widths.get(familyUnit.id)).toBe(COUPLE_BLOCK); // 320
  });

  it('family with children: width = max(parentBlock, childrenTotal)', () => {
    // Two parents + 2 leaf children
    const persons = [
      makePerson({ id: 'dad', firstName: 'Dad' }),
      makePerson({ id: 'mom', firstName: 'Mom', gender: 'female' }),
      makePerson({ id: 'child1', firstName: 'Child1' }),
      makePerson({ id: 'child2', firstName: 'Child2' }),
    ];
    const rels: Relationship[] = [
      { type: 'partner', from: 'dad', to: 'mom', status: 'current' },
      { type: 'parent', from: 'dad', to: 'child1' },
      { type: 'parent', from: 'mom', to: 'child1' },
      { type: 'parent', from: 'dad', to: 'child2' },
      { type: 'parent', from: 'mom', to: 'child2' },
    ];
    const units = buildFamilyUnits(persons, rels);
    const widths = measureAllFamilies(units);
    const familyUnit = units.find(u => u.parentIds.includes('dad'))!;
    // parentBlockWidth = 320 (2 parents)
    // childrenTotal = 160 + 160 + 60 = 380
    // max(320, 380) = 380
    expect(widths.get(familyUnit.id)).toBe(380);
  });

  it('nested families: width includes descendant widths', () => {
    // Grandparent -> Parent+Spouse -> GrandChild
    const persons = [
      makePerson({ id: 'grandpa', firstName: 'Grandpa' }),
      makePerson({ id: 'parent', firstName: 'Parent' }),
      makePerson({ id: 'spouse', firstName: 'Spouse', gender: 'female' }),
      makePerson({ id: 'grandchild', firstName: 'Grandchild' }),
    ];
    const rels: Relationship[] = [
      { type: 'parent', from: 'grandpa', to: 'parent' },
      { type: 'partner', from: 'parent', to: 'spouse', status: 'current' },
      { type: 'parent', from: 'parent', to: 'grandchild' },
      { type: 'parent', from: 'spouse', to: 'grandchild' },
    ];
    const units = buildFamilyUnits(persons, rels);
    const widths = measureAllFamilies(units);

    // parent+spouse family: 2 parents (320), 1 child grandchild(160) → max(320,160) = 320
    const parentFamily = units.find(u => u.parentIds.includes('parent') && u.parentIds.includes('spouse'))!;
    expect(widths.get(parentFamily.id)).toBe(320);

    // measurePerson('parent') = max of families where parent is a parent
    //   = measureFamily(parent+spouse family) = 320
    // grandpa family: 1 parent (160), 1 child 'parent' with width 320 → max(160, 320) = 320
    const grandpaFamily = units.find(u => u.parentIds.includes('grandpa'))!;
    expect(widths.get(grandpaFamily.id)).toBe(320);
  });

  it('person with multiple families: width = max of all families', () => {
    // Person has two partner families: one with 1 child, one with 3 children
    const persons = [
      makePerson({ id: 'parent', firstName: 'Parent' }),
      makePerson({ id: 'partner1', firstName: 'Partner1', gender: 'female' }),
      makePerson({ id: 'partner2', firstName: 'Partner2', gender: 'female' }),
      makePerson({ id: 'child-a', firstName: 'ChildA' }),
      makePerson({ id: 'child-b', firstName: 'ChildB' }),
      makePerson({ id: 'child-c', firstName: 'ChildC' }),
      makePerson({ id: 'child-d', firstName: 'ChildD' }),
    ];
    const rels: Relationship[] = [
      { type: 'partner', from: 'parent', to: 'partner1', status: 'former' },
      { type: 'partner', from: 'parent', to: 'partner2', status: 'current' },
      { type: 'parent', from: 'parent', to: 'child-a' },
      { type: 'parent', from: 'partner1', to: 'child-a' },
      { type: 'parent', from: 'parent', to: 'child-b' },
      { type: 'parent', from: 'partner2', to: 'child-b' },
      { type: 'parent', from: 'parent', to: 'child-c' },
      { type: 'parent', from: 'partner2', to: 'child-c' },
      { type: 'parent', from: 'parent', to: 'child-d' },
      { type: 'parent', from: 'partner2', to: 'child-d' },
    ];
    const units = buildFamilyUnits(persons, rels);
    const { unitsAsParent } = buildFamilyLookups(units);

    // Family 1 (parent+partner1): 2 parents (320), 1 child (160) → 320
    // Family 2 (parent+partner2): 2 parents (320), 3 children (160+160+160+60+60=600) → 600
    // measurePerson('parent') = max(320, 600) = 600
    const visited = new Set<string>();
    const measuredWidths = new Map<string, number>();
    const width = measurePerson('parent', unitsAsParent, measuredWidths, visited);
    expect(width).toBe(600);
  });

  it('single parent family uses narrower parentBlockWidth', () => {
    // Single parent with 1 child
    const persons = [
      makePerson({ id: 'single-parent', firstName: 'SingleParent' }),
      makePerson({ id: 'only-child', firstName: 'OnlyChild' }),
    ];
    const rels: Relationship[] = [
      { type: 'parent', from: 'single-parent', to: 'only-child' },
    ];
    const units = buildFamilyUnits(persons, rels);
    const widths = measureAllFamilies(units);
    const familyUnit = units.find(u => u.parentIds.includes('single-parent'))!;
    // parentBlockWidth = 160 (1 parent)
    // childrenTotal = 160 (1 child)
    // max(160, 160) = 160
    expect(widths.get(familyUnit.id)).toBe(CARD_SLOT);
  });

  it('single parent with multiple children widens from children', () => {
    // Like Birgitta with Hampus + Jacob (each having families)
    const persons = [
      makePerson({ id: 'birgitta', firstName: 'Birgitta', gender: 'female' }),
      makePerson({ id: 'hampus', firstName: 'Hampus' }),
      makePerson({ id: 'linnea', firstName: 'Linnea', gender: 'female' }),
      makePerson({ id: 'knut', firstName: 'Knut' }),
      makePerson({ id: 'jacob', firstName: 'Jacob' }),
      makePerson({ id: 'karolina', firstName: 'Karolina', gender: 'female' }),
      makePerson({ id: 'agnes', firstName: 'Agnes', gender: 'female' }),
    ];
    const rels: Relationship[] = [
      { type: 'parent', from: 'birgitta', to: 'hampus' },
      { type: 'partner', from: 'hampus', to: 'linnea', status: 'current' },
      { type: 'parent', from: 'hampus', to: 'knut' },
      { type: 'parent', from: 'linnea', to: 'knut' },
      { type: 'parent', from: 'birgitta', to: 'jacob' },
      { type: 'partner', from: 'jacob', to: 'karolina', status: 'current' },
      { type: 'parent', from: 'jacob', to: 'agnes' },
      { type: 'parent', from: 'karolina', to: 'agnes' },
    ];
    const units = buildFamilyUnits(persons, rels);
    const widths = measureAllFamilies(units);

    // Hampus+Linnea family: 2 parents (320), 1 child Knut (160) → 320
    // Jacob+Karolina family: 2 parents (320), 1 child Agnes (160) → 320
    // measurePerson(Hampus) = 320, measurePerson(Jacob) = 320
    // Birgitta family: 1 parent (160), children = 320 + 320 + 60 = 700
    // max(160, 700) = 700
    const birgittaFamily = units.find(u =>
      u.parentIds.includes('birgitta') && u.parentIds.length === 1
    )!;
    expect(widths.get(birgittaFamily.id)).toBe(700);
  });

  it('measureAllFamilies returns widths for all family units', () => {
    const persons = [
      makePerson({ id: 'dad', firstName: 'Dad' }),
      makePerson({ id: 'mom', firstName: 'Mom', gender: 'female' }),
      makePerson({ id: 'child', firstName: 'Child' }),
    ];
    const rels: Relationship[] = [
      { type: 'partner', from: 'dad', to: 'mom', status: 'current' },
      { type: 'parent', from: 'dad', to: 'child' },
      { type: 'parent', from: 'mom', to: 'child' },
    ];
    const units = buildFamilyUnits(persons, rels);
    const widths = measureAllFamilies(units);
    // Every family unit should have a measured width
    for (const unit of units) {
      expect(widths.has(unit.id)).toBe(true);
      expect(widths.get(unit.id)!).toBeGreaterThan(0);
    }
  });
});
