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
