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
  type: 'partner' | 'parent' | 'sibling'
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

export interface PositionedFamilyConnector {
  familyId: string
  parentIds: string[]
  childIds: string[]
  centerX: number
  parentY: number
  childY: number
}

// --- V3 Layout Types ---

export type LayoutBranch = 'left' | 'right' | 'center'

export interface VisualPersonNode {
  visualId: string // e.g. "p:anna@f:f1:parent"
  personId: string
  person: Person
  familyId: string
  role: 'parent' | 'child'
  x: number
  y: number
  width: number
  height: number
  branch: LayoutBranch
}

export interface PositionedFamilyConnectorV3 {
  familyId: string
  parentVisualIds: string[]
  childVisualIds: string[]
  centerX: number
  parentY: number
  childY: number
}

export interface LayoutResultV3 {
  visualNodes: VisualPersonNode[]
  families: PositionedFamilyConnectorV3[]
  nodeIndex: Map<string, VisualPersonNode>
  width: number
  height: number
}

export interface LayoutConfig {
  generationGap: number
  partnerGap: number
  cardMargin: number
  childGap: number
  cardWidth: number
  cardHeight: number
}
