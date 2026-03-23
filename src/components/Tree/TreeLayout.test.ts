import { computeTreeLayout, isAncestorOf, buildGroupTree, calculateGroupWidths, placeGroups } from './TreeLayout';
import { buildFamilyGraph } from '../../utils/buildTree';
import type { Person, Relationship, FamilyGroup, LayoutNode } from '../../types';

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

describe('computeTreeLayout (integration)', () => {
  it('returns TreeLayoutResult with all persons', () => {
    const result = computeTreeLayout(persons, relationships, 'jens');
    const ids = result.nodes.map(n => n.personId).sort();
    const expected = persons.map(p => p.id).sort();
    expect(ids).toEqual(expected);
  });

  it('returns group frames', () => {
    const result = computeTreeLayout(persons, relationships, 'jens');
    expect(result.groupFrames.length).toBeGreaterThan(0);
  });

  it('returns backbone links', () => {
    const result = computeTreeLayout(persons, relationships, 'jens');
    expect(result.backboneLinks.length).toBeGreaterThan(0);
  });

  it('places parents above children (negative y)', () => {
    const result = computeTreeLayout(persons, relationships, 'jens');
    const jNode = result.nodes.find(n => n.personId === 'jens')!;
    const fNode = result.nodes.find(n => n.personId === 'jens-father')!;
    expect(fNode.y).toBeLessThan(jNode.y);
  });

  it('no cards overlap on same row', () => {
    const result = computeTreeLayout(persons, relationships, 'jens');
    const rows = new Map<number, LayoutNode[]>();
    for (const n of result.nodes) {
      const row = rows.get(n.y) ?? [];
      row.push(n);
      rows.set(n.y, row);
    }
    for (const row of rows.values()) {
      if (row.length < 2) continue;
      row.sort((a, b) => a.x - b.x);
      for (let i = 1; i < row.length; i++) {
        expect(row[i].x - row[i - 1].x).toBeGreaterThanOrEqual(140);
      }
    }
  });

  it('center couple placed near origin', () => {
    const result = computeTreeLayout(persons, relationships, 'jens');
    const jNode = result.nodes.find(n => n.personId === 'jens')!;
    expect(jNode.y).toBe(0);
    expect(Math.abs(jNode.x)).toBeLessThan(500);
  });
});

describe('isAncestorOf', () => {
  it('returns true for direct parent', () => {
    const p = [makePerson({ id: 'dad' }), makePerson({ id: 'child' })];
    const r: Relationship[] = [{ type: 'parent', from: 'dad', to: 'child' }];
    const graph = buildFamilyGraph(p, r);
    expect(isAncestorOf(graph, 'dad', 'child')).toBe(true);
  });

  it('returns true for grandparent', () => {
    const p = [makePerson({ id: 'gp' }), makePerson({ id: 'par' }), makePerson({ id: 'child' })];
    const r: Relationship[] = [
      { type: 'parent', from: 'gp', to: 'par' },
      { type: 'parent', from: 'par', to: 'child' },
    ];
    const graph = buildFamilyGraph(p, r);
    expect(isAncestorOf(graph, 'gp', 'child')).toBe(true);
  });

  it('returns false for non-ancestor', () => {
    const p = [makePerson({ id: 'a' }), makePerson({ id: 'b' })];
    const graph = buildFamilyGraph(p, []);
    expect(isAncestorOf(graph, 'a', 'b')).toBe(false);
  });

  it('returns false for self', () => {
    const p = [makePerson({ id: 'a' })];
    const graph = buildFamilyGraph(p, []);
    expect(isAncestorOf(graph, 'a', 'a')).toBe(false);
  });
});

describe('buildGroupTree', () => {
  it('creates center group with partner and no children', () => {
    const p = [makePerson({ id: 'a' }), makePerson({ id: 'b', gender: 'female' })];
    const r: Relationship[] = [{ type: 'partner', from: 'a', to: 'b', status: 'current' }];
    const graph = buildFamilyGraph(p, r);
    const { center, ancestorGroups } = buildGroupTree(graph, 'a');
    expect(center.parents).toContain('a');
    expect(center.parents).toContain('b');
    expect(center.children).toEqual([]);
    expect(ancestorGroups.size).toBe(0);
  });

  it('builds ancestor group for center person with parents', () => {
    const p = [
      makePerson({ id: 'child' }),
      makePerson({ id: 'spouse', gender: 'female' }),
      makePerson({ id: 'dad' }),
      makePerson({ id: 'mom', gender: 'female' }),
      makePerson({ id: 'sibling' }),
    ];
    const r: Relationship[] = [
      { type: 'partner', from: 'child', to: 'spouse', status: 'current' },
      { type: 'parent', from: 'dad', to: 'child' },
      { type: 'parent', from: 'mom', to: 'child' },
      { type: 'parent', from: 'dad', to: 'sibling' },
      { type: 'parent', from: 'mom', to: 'sibling' },
      { type: 'partner', from: 'dad', to: 'mom', status: 'current' },
    ];
    const graph = buildFamilyGraph(p, r);
    const { center, ancestorGroups } = buildGroupTree(graph, 'child');

    expect(center.parents).toContain('child');
    expect(center.parents).toContain('spouse');

    // child's parent group should exist
    const parentGroup = ancestorGroups.get('child');
    expect(parentGroup).toBeDefined();
    expect(parentGroup!.parents).toContain('dad');
    expect(parentGroup!.parents).toContain('mom');

    const types = parentGroup!.children.map(c => ({ id: c.personId, type: c.type }));
    expect(types).toContainEqual({ id: 'child', type: 'backbone' });
    expect(types).toContainEqual({ id: 'sibling', type: 'leaf' });
  });

  it('handles single parent subgroup (Birgitta case)', () => {
    const p = [
      makePerson({ id: 'center' }),
      makePerson({ id: 'spouse', gender: 'female' }),
      makePerson({ id: 'dad' }),
      makePerson({ id: 'mom', gender: 'female' }),
      makePerson({ id: 'aunt', gender: 'female' }),
      makePerson({ id: 'cousin' }),
    ];
    const r: Relationship[] = [
      { type: 'partner', from: 'center', to: 'spouse', status: 'current' },
      { type: 'parent', from: 'dad', to: 'center' },
      { type: 'parent', from: 'mom', to: 'center' },
      { type: 'parent', from: 'dad', to: 'aunt' },
      { type: 'parent', from: 'mom', to: 'aunt' },
      { type: 'partner', from: 'dad', to: 'mom', status: 'current' },
      { type: 'parent', from: 'aunt', to: 'cousin' },
    ];
    const graph = buildFamilyGraph(p, r);
    const { ancestorGroups } = buildGroupTree(graph, 'center');

    const parentGroup = ancestorGroups.get('center')!;
    const auntChild = parentGroup.children.find(c => c.personId === 'aunt');
    expect(auntChild?.type).toBe('subgroup');
    if (auntChild?.type === 'subgroup') {
      expect(auntChild.group.parents).toEqual(['aunt']);
      expect(auntChild.group.children[0]).toEqual({ type: 'leaf', personId: 'cousin' });
    }
  });

  it('builds multi-level ancestor chain', () => {
    const p = [
      makePerson({ id: 'child' }),
      makePerson({ id: 'dad' }),
      makePerson({ id: 'mom', gender: 'female' }),
      makePerson({ id: 'grandpa' }),
      makePerson({ id: 'grandma', gender: 'female' }),
    ];
    const r: Relationship[] = [
      { type: 'parent', from: 'dad', to: 'child' },
      { type: 'parent', from: 'mom', to: 'child' },
      { type: 'partner', from: 'dad', to: 'mom', status: 'current' },
      { type: 'parent', from: 'grandpa', to: 'dad' },
      { type: 'parent', from: 'grandma', to: 'dad' },
      { type: 'partner', from: 'grandpa', to: 'grandma', status: 'current' },
    ];
    const graph = buildFamilyGraph(p, r);
    const { ancestorGroups } = buildGroupTree(graph, 'child');

    // child -> dad+mom group
    expect(ancestorGroups.has('child')).toBe(true);
    // dad -> grandpa+grandma group
    expect(ancestorGroups.has('dad')).toBe(true);
    expect(ancestorGroups.get('dad')!.parents).toContain('grandpa');
    expect(ancestorGroups.get('dad')!.parents).toContain('grandma');
  });
});

describe('calculateGroupWidths', () => {
  it('couple with one leaf child', () => {
    const group: FamilyGroup = {
      parents: ['a', 'b'], children: [{ type: 'leaf', personId: 'c' }],
      width: 0, height: 0, x: 0, y: 0,
    };
    calculateGroupWidths(group);
    // parentRow=320, childrenRow=160, max=320, +40 padding = 360
    expect(group.width).toBe(360);
  });

  it('three leaf children', () => {
    const group: FamilyGroup = {
      parents: ['a', 'b'],
      children: [
        { type: 'leaf', personId: 'c1' },
        { type: 'leaf', personId: 'c2' },
        { type: 'leaf', personId: 'c3' },
      ],
      width: 0, height: 0, x: 0, y: 0,
    };
    calculateGroupWidths(group);
    // childrenRow = 3*160 + 2*40 = 560, parentRow=320, max=560, +40 = 600
    expect(group.width).toBe(600);
  });

  it('single parent group', () => {
    const group: FamilyGroup = {
      parents: ['a'], children: [{ type: 'leaf', personId: 'c' }],
      width: 0, height: 0, x: 0, y: 0,
    };
    calculateGroupWidths(group);
    // parentRow=160, childrenRow=160, max=160, +40 = 200
    expect(group.width).toBe(200);
  });

  it('nested subgroup calculated bottom-up', () => {
    const sub: FamilyGroup = {
      parents: ['aunt'], children: [{ type: 'leaf', personId: 'cousin' }],
      width: 0, height: 0, x: 0, y: 0,
    };
    const group: FamilyGroup = {
      parents: ['dad', 'mom'],
      children: [
        { type: 'subgroup', personId: 'aunt', group: sub },
        { type: 'leaf', personId: 'uncle' },
      ],
      width: 0, height: 0, x: 0, y: 0,
    };
    calculateGroupWidths(group);
    expect(sub.width).toBe(200);  // single parent + 1 leaf
    // childrenRow = 200 + 160 + 40 = 400, parentRow=320, max=400, +40 = 440
    expect(group.width).toBe(440);
  });

  it('group with no children', () => {
    const group: FamilyGroup = {
      parents: ['a', 'b'], children: [],
      width: 0, height: 0, x: 0, y: 0,
    };
    calculateGroupWidths(group);
    // parentRow=320, childrenRow=0, max=320, +40 = 360
    expect(group.width).toBe(360);
  });
});

describe('placeGroups', () => {
  it('places center couple at y=0', () => {
    const graph = buildFamilyGraph(
      [makePerson({ id: 'a' }), makePerson({ id: 'b', gender: 'female' })],
      [{ type: 'partner', from: 'a', to: 'b', status: 'current' }],
    );
    const { center, ancestorGroups } = buildGroupTree(graph, 'a');
    calculateGroupWidths(center);
    const result = placeGroups(center, ancestorGroups, graph);

    const a = result.nodes.find(n => n.personId === 'a')!;
    const b = result.nodes.find(n => n.personId === 'b')!;
    expect(a.y).toBe(0);
    expect(b.y).toBe(0);
    expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(160); // at least PARTNER_GAP
  });

  it('places children below parents', () => {
    const persons = [
      makePerson({ id: 'dad' }),
      makePerson({ id: 'mom', gender: 'female' }),
      makePerson({ id: 'child' }),
    ];
    const rels: Relationship[] = [
      { type: 'partner', from: 'dad', to: 'mom', status: 'current' },
      { type: 'parent', from: 'dad', to: 'child' },
      { type: 'parent', from: 'mom', to: 'child' },
    ];
    const graph = buildFamilyGraph(persons, rels);
    // Build a group manually for dad+mom with child as leaf
    const group: FamilyGroup = {
      parents: ['dad', 'mom'],
      children: [{ type: 'leaf', personId: 'child' }],
      width: 0, height: 0, x: 0, y: 0,
    };
    calculateGroupWidths(group);
    const result = placeGroups(group, new Map(), graph);

    const dad = result.nodes.find(n => n.personId === 'dad')!;
    const child = result.nodes.find(n => n.personId === 'child')!;
    expect(child.y).toBeGreaterThan(dad.y);
  });

  it('places ancestor group above center', () => {
    const persons = [
      makePerson({ id: 'child' }),
      makePerson({ id: 'spouse', gender: 'female' }),
      makePerson({ id: 'dad' }),
      makePerson({ id: 'mom', gender: 'female' }),
    ];
    const rels: Relationship[] = [
      { type: 'partner', from: 'child', to: 'spouse', status: 'current' },
      { type: 'parent', from: 'dad', to: 'child' },
      { type: 'parent', from: 'mom', to: 'child' },
      { type: 'partner', from: 'dad', to: 'mom', status: 'current' },
    ];
    const graph = buildFamilyGraph(persons, rels);
    const { center, ancestorGroups } = buildGroupTree(graph, 'child');
    calculateGroupWidths(center);
    for (const g of ancestorGroups.values()) calculateGroupWidths(g);

    const result = placeGroups(center, ancestorGroups, graph);
    const dad = result.nodes.find(n => n.personId === 'dad')!;
    const child = result.nodes.find(n => n.personId === 'child')!;
    expect(dad.y).toBeLessThan(child.y); // parents above
  });

  it('generates group frames', () => {
    const graph = buildFamilyGraph(
      [makePerson({ id: 'a' }), makePerson({ id: 'b', gender: 'female' })],
      [{ type: 'partner', from: 'a', to: 'b', status: 'current' }],
    );
    const { center, ancestorGroups } = buildGroupTree(graph, 'a');
    calculateGroupWidths(center);
    const result = placeGroups(center, ancestorGroups, graph);
    expect(result.groupFrames.length).toBeGreaterThan(0);
    expect(result.groupFrames[0].width).toBeGreaterThan(0);
    expect(result.groupFrames[0].height).toBeGreaterThan(0);
  });

  it('generates backbone links for ancestor connections', () => {
    const persons = [
      makePerson({ id: 'child' }),
      makePerson({ id: 'spouse', gender: 'female' }),
      makePerson({ id: 'dad' }),
      makePerson({ id: 'mom', gender: 'female' }),
    ];
    const rels: Relationship[] = [
      { type: 'partner', from: 'child', to: 'spouse', status: 'current' },
      { type: 'parent', from: 'dad', to: 'child' },
      { type: 'parent', from: 'mom', to: 'child' },
      { type: 'partner', from: 'dad', to: 'mom', status: 'current' },
    ];
    const graph = buildFamilyGraph(persons, rels);
    const { center, ancestorGroups } = buildGroupTree(graph, 'child');
    calculateGroupWidths(center);
    for (const g of ancestorGroups.values()) calculateGroupWidths(g);

    const result = placeGroups(center, ancestorGroups, graph);
    expect(result.backboneLinks.length).toBeGreaterThan(0);
    // The link should connect 'child' in the parent group to 'child' in center
    const childLink = result.backboneLinks.find(l => l.fromPersonId === 'child');
    expect(childLink).toBeDefined();
  });

  it('no nodes overlap on same row', () => {
    const persons = [
      makePerson({ id: 'center' }),
      makePerson({ id: 'spouse', gender: 'female' }),
      makePerson({ id: 'dad' }),
      makePerson({ id: 'mom', gender: 'female' }),
      makePerson({ id: 'sib1' }),
      makePerson({ id: 'sib2' }),
      makePerson({ id: 'sib3' }),
    ];
    const rels: Relationship[] = [
      { type: 'partner', from: 'center', to: 'spouse', status: 'current' },
      { type: 'parent', from: 'dad', to: 'center' },
      { type: 'parent', from: 'mom', to: 'center' },
      { type: 'parent', from: 'dad', to: 'sib1' },
      { type: 'parent', from: 'mom', to: 'sib1' },
      { type: 'parent', from: 'dad', to: 'sib2' },
      { type: 'parent', from: 'mom', to: 'sib2' },
      { type: 'parent', from: 'dad', to: 'sib3' },
      { type: 'parent', from: 'mom', to: 'sib3' },
      { type: 'partner', from: 'dad', to: 'mom', status: 'current' },
    ];
    const graph = buildFamilyGraph(persons, rels);
    const { center, ancestorGroups } = buildGroupTree(graph, 'center');
    calculateGroupWidths(center);
    for (const g of ancestorGroups.values()) calculateGroupWidths(g);

    const result = placeGroups(center, ancestorGroups, graph);

    // Check no overlaps per row
    const rows = new Map<number, typeof result.nodes>();
    for (const n of result.nodes) {
      const row = rows.get(n.y) ?? [];
      row.push(n);
      rows.set(n.y, row);
    }
    for (const row of rows.values()) {
      if (row.length < 2) continue;
      row.sort((a, b) => a.x - b.x);
      for (let i = 1; i < row.length; i++) {
        expect(row[i].x - row[i - 1].x).toBeGreaterThanOrEqual(140);
      }
    }
  });
});
