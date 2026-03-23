import { computeTreeLayout, isAncestorOf, buildGroupTree, calculateGroupWidths } from './TreeLayout';
import { buildFamilyGraph } from '../../utils/buildTree';
import type { Person, Relationship, FamilyGroup } from '../../types';

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
