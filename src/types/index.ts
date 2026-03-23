export interface Person {
  id: string
  firstName: string
  lastName: string
  birthName: string | null
  birthDate: string | null
  birthPlace: string | null
  deathDate: string | null
  deathPlace: string | null
  gender: 'male' | 'female' | 'other'
  occupation: string | null
  photos: string[]
  stories: Story[]
  contactInfo: string | null
  familySide: 'jens' | 'klara' | 'center'
}

export interface Story {
  title: string
  text: string
}

export interface Relationship {
  type: 'partner' | 'parent'
  from: string
  to: string
  status?: 'current' | 'former'
}

export interface TreeNode {
  person: Person
  x: number
  y: number
  partners: TreeNode[]
  parents: TreeNode[]
  siblings: TreeNode[]
  children: TreeNode[]
}

export interface FamilyData {
  persons: Person[]
  relationships: Relationship[]
}

export interface LayoutLink {
  targetId: string
  type: 'partner' | 'parent-child'
}

export interface LayoutNode {
  personId: string
  person: Person
  x: number
  y: number
  links: LayoutLink[]
}

export type GroupChild =
  | { type: 'leaf'; personId: string }
  | { type: 'subgroup'; personId: string; group: FamilyGroup }
  | { type: 'backbone'; personId: string; group: FamilyGroup }

export interface FamilyGroup {
  parents: string[]
  children: GroupChild[]
  width: number
  height: number
  x: number
  y: number
}

export interface GroupFrame {
  x: number; y: number; width: number; height: number
}

export interface BackboneLink {
  fromPersonId: string
  toPersonId: string
  points: [number, number][]
}

export interface TreeLayoutResult {
  nodes: LayoutNode[]
  groupFrames: GroupFrame[]
  backboneLinks: BackboneLink[]
}
