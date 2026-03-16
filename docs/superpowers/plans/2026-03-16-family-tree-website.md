# Släkthemsida Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive family tree website centered on Jens & Klara, with a horizontal pan/zoom tree view, expandable person cards, visitor contribution forms via GitHub Issues, search, and photo gallery.

**Architecture:** React SPA with D3.js SVG tree rendering. Data lives in static JSON files served from `public/data/`. A single Vercel serverless function handles contribution submission to GitHub Issues. React Router provides URL routing. React Context manages global state.

**Tech Stack:** React 18, TypeScript, Vite, D3.js, d3-zoom, React Router, Tailwind CSS, Vitest, React Testing Library, Vercel serverless functions.

**Spec:** `docs/superpowers/specs/2026-03-16-family-tree-website-design.md`

---

## File Structure

```
family/
├── public/
│   ├── data/
│   │   ├── persons.json              # Person data (runtime fetch)
│   │   └── relationships.json        # Relationship data (runtime fetch)
│   └── photos/                       # Person photos
├── src/
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── Header.tsx            # Site name + nav icons
│   │   │   └── Header.test.tsx
│   │   ├── Tree/
│   │   │   ├── TreeView.tsx          # D3 SVG tree with pan/zoom
│   │   │   ├── TreeView.test.tsx
│   │   │   ├── TreeLayout.ts         # Pure function: data → node positions
│   │   │   ├── TreeLayout.test.ts
│   │   │   ├── Minimap.tsx           # Scaled silhouette + viewport rect
│   │   │   └── Minimap.test.tsx
│   │   ├── PersonCard/
│   │   │   ├── PersonCardMini.tsx    # Circle photo + name + year
│   │   │   ├── PersonCardMini.test.tsx
│   │   │   ├── PersonCardExpanded.tsx # Full details panel
│   │   │   └── PersonCardExpanded.test.tsx
│   │   ├── AddForm/
│   │   │   ├── AddPersonForm.tsx     # Compact + expandable form (also used for edits with pre-fill)
│   │   │   └── AddPersonForm.test.tsx
│   │   ├── Search/
│   │   │   ├── SearchView.tsx        # Search field + results list
│   │   │   └── SearchView.test.tsx
│   │   └── Gallery/
│   │       ├── GalleryView.tsx       # Photo grid + filters
│   │       └── GalleryView.test.tsx
│   ├── contexts/
│   │   ├── FamilyDataContext.tsx      # Persons, relationships, loading state
│   │   └── FamilyDataContext.test.tsx
│   ├── types/
│   │   └── index.ts                  # Person, Relationship, TreeNode types
│   ├── hooks/
│   │   ├── useSearch.ts              # Substring search logic
│   │   └── useSearch.test.ts
│   ├── utils/
│   │   ├── buildTree.ts             # Relationships → tree graph structure
│   │   ├── buildTree.test.ts
│   │   ├── formatPerson.ts          # Display helpers (dates, names)
│   │   └── formatPerson.test.ts
│   ├── App.tsx                       # Router setup, context providers
│   ├── App.test.tsx
│   ├── main.tsx                      # Entry point
│   ├── index.css                     # Tailwind imports + custom theme
│   └── test-setup.ts                 # Vitest setup (jest-dom matchers)
├── api/
│   └── submit-contribution.ts        # Vercel serverless function
├── scripts/                            # CLI tools (deferred to post-v1)
│   └── import-gedcom.ts              # GEDCOM/CSV import (not in this plan)
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
└── vitest.config.ts
```

---

## Chunk 1: Project Scaffold & Data Layer

### Task 1: Scaffold Vite + React + TypeScript project

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`
- Create: `tailwind.config.ts`, `postcss.config.js`, `vitest.config.ts`
- Create: `.gitignore`

- [ ] **Step 1: Create Vite project**

Run:
```bash
cd /home/jens/dev/family
npm create vite@latest . -- --template react-ts
```

- [ ] **Step 2: Install dependencies**

Run:
```bash
npm install react-router-dom d3-selection d3-zoom
npm install -D tailwindcss @tailwindcss/vite vitest @testing-library/react @testing-library/jest-dom jsdom @types/d3-selection @types/d3-zoom
```

- [ ] **Step 3: Configure Tailwind**

Replace `src/index.css`:
```css
@import "tailwindcss";

@theme {
  --color-bg-primary: #f7f4ef;
  --color-bg-secondary: #eee8dc;
  --color-accent: #6b8f71;
  --color-accent-dark: #4a7050;
  --color-text-primary: #3a3a3a;
  --color-text-secondary: #777;
  --color-card-bg: #ffffff;
  --color-card-border: #6b8f71;

  --font-serif: "Lora", serif;
  --font-sans: "Inter", sans-serif;
}

@keyframes animate-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-in {
  animation: animate-in 0.2s ease-out;
}
```

Add Tailwind plugin to `vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

- [ ] **Step 4: Configure Vitest**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
```

Create `src/test-setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 5: Add Google Fonts to index.html**

Update `index.html` `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Lora:wght@400;600;700&display=swap" rel="stylesheet">
```

- [ ] **Step 6: Verify dev server starts**

Run: `npm run dev`
Expected: Vite dev server starts on localhost

- [ ] **Step 7: Verify tests run**

Run: `npx vitest run`
Expected: Test suite runs (may have 0 tests initially)

- [ ] **Step 8: Update .gitignore and commit**

Add `.superpowers/` to `.gitignore`.

```bash
git add -A
git commit -m "feat: scaffold Vite + React + TypeScript project with Tailwind and Vitest"
```

---

### Task 2: Define TypeScript types

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Write types**

Create `src/types/index.ts`:
```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: define TypeScript types for Person, Relationship, TreeNode"
```

---

### Task 3: Create sample data

**Files:**
- Create: `public/data/persons.json`
- Create: `public/data/relationships.json`

- [ ] **Step 1: Create persons.json with 3-generation sample**

Create `public/data/persons.json`:
```json
[
  {
    "id": "jens",
    "firstName": "Jens",
    "lastName": "Andersson",
    "birthName": null,
    "birthDate": "1995-03-12",
    "birthPlace": "Göteborg",
    "deathDate": null,
    "deathPlace": null,
    "gender": "male",
    "occupation": null,
    "photos": [],
    "stories": [],
    "contactInfo": null,
    "familySide": "center"
  },
  {
    "id": "klara",
    "firstName": "Klara",
    "lastName": "Lindqvist",
    "birthName": null,
    "birthDate": "1996-07-20",
    "birthPlace": "Stockholm",
    "deathDate": null,
    "deathPlace": null,
    "gender": "female",
    "occupation": null,
    "photos": [],
    "stories": [],
    "contactInfo": null,
    "familySide": "center"
  },
  {
    "id": "erik",
    "firstName": "Erik",
    "lastName": "Andersson",
    "birthName": null,
    "birthDate": "1965-01-15",
    "birthPlace": "Göteborg",
    "deathDate": null,
    "deathPlace": null,
    "gender": "male",
    "occupation": "Snickare",
    "photos": [],
    "stories": [],
    "contactInfo": null,
    "familySide": "jens"
  },
  {
    "id": "anna",
    "firstName": "Anna",
    "lastName": "Andersson",
    "birthName": "Svensson",
    "birthDate": "1967-09-03",
    "birthPlace": "Borås",
    "deathDate": null,
    "deathPlace": null,
    "gender": "female",
    "occupation": "Lärare",
    "photos": [],
    "stories": [],
    "contactInfo": null,
    "familySide": "jens"
  },
  {
    "id": "lars",
    "firstName": "Lars",
    "lastName": "Lindqvist",
    "birthName": null,
    "birthDate": "1963-11-22",
    "birthPlace": "Uppsala",
    "deathDate": null,
    "deathPlace": null,
    "gender": "male",
    "occupation": "Ingenjör",
    "photos": [],
    "stories": [],
    "contactInfo": null,
    "familySide": "klara"
  },
  {
    "id": "maria",
    "firstName": "Maria",
    "lastName": "Lindqvist",
    "birthName": "Johansson",
    "birthDate": "1965-04-10",
    "birthPlace": "Stockholm",
    "deathDate": null,
    "deathPlace": null,
    "gender": "female",
    "occupation": "Sjuksköterska",
    "photos": [],
    "stories": [],
    "contactInfo": null,
    "familySide": "klara"
  },
  {
    "id": "gunnar",
    "firstName": "Gunnar",
    "lastName": "Andersson",
    "birthName": null,
    "birthDate": "1935-06-01",
    "birthPlace": "Skövde",
    "deathDate": "2015-12-20",
    "deathPlace": "Göteborg",
    "gender": "male",
    "occupation": "Jordbrukare",
    "photos": [],
    "stories": [{ "title": "Gården i Skövde", "text": "Gunnar växte upp på familjens gård utanför Skövde där han lärde sig allt om jordbruk." }],
    "contactInfo": null,
    "familySide": "jens"
  },
  {
    "id": "birgit",
    "firstName": "Birgit",
    "lastName": "Andersson",
    "birthName": "Karlsson",
    "birthDate": "1938-02-14",
    "birthPlace": "Skövde",
    "deathDate": null,
    "deathPlace": null,
    "gender": "female",
    "occupation": "Hemmafru",
    "photos": [],
    "stories": [],
    "contactInfo": null,
    "familySide": "jens"
  }
]
```

- [ ] **Step 2: Create relationships.json**

Create `public/data/relationships.json`:
```json
[
  { "type": "partner", "from": "jens", "to": "klara", "status": "current" },
  { "type": "partner", "from": "erik", "to": "anna", "status": "current" },
  { "type": "partner", "from": "lars", "to": "maria", "status": "current" },
  { "type": "partner", "from": "gunnar", "to": "birgit", "status": "current" },
  { "type": "parent", "from": "erik", "to": "jens" },
  { "type": "parent", "from": "anna", "to": "jens" },
  { "type": "parent", "from": "lars", "to": "klara" },
  { "type": "parent", "from": "maria", "to": "klara" },
  { "type": "parent", "from": "gunnar", "to": "erik" },
  { "type": "parent", "from": "birgit", "to": "erik" }
]
```

- [ ] **Step 3: Commit**

```bash
git add public/data/
git commit -m "feat: add sample family data (3 generations, 8 persons)"
```

---

### Task 4: Build FamilyDataContext

**Files:**
- Create: `src/contexts/FamilyDataContext.tsx`
- Create: `src/contexts/FamilyDataContext.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/contexts/FamilyDataContext.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { FamilyDataProvider, useFamilyData } from './FamilyDataContext'

function TestConsumer() {
  const { persons, relationships, loading, error } = useFamilyData()
  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  return (
    <div>
      <span data-testid="count">{persons.length}</span>
      <span data-testid="rels">{relationships.length}</span>
    </div>
  )
}

describe('FamilyDataContext', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn((url: string) => {
      if (url.includes('persons.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 'jens', firstName: 'Jens', lastName: 'Andersson', familySide: 'center' },
            { id: 'klara', firstName: 'Klara', lastName: 'Lindqvist', familySide: 'center' },
          ]),
        })
      }
      if (url.includes('relationships.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { type: 'partner', from: 'jens', to: 'klara', status: 'current' },
          ]),
        })
      }
      return Promise.reject(new Error('Unknown URL'))
    }) as unknown as typeof fetch
  })

  it('loads and provides family data', async () => {
    render(
      <FamilyDataProvider>
        <TestConsumer />
      </FamilyDataProvider>
    )

    expect(screen.getByText('Loading...')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('2')
      expect(screen.getByTestId('rels')).toHaveTextContent('1')
    })
  })

  it('shows error on fetch failure', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, status: 500 })
    ) as unknown as typeof fetch

    render(
      <FamilyDataProvider>
        <TestConsumer />
      </FamilyDataProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/Error/)).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/contexts/FamilyDataContext.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement FamilyDataContext**

Create `src/contexts/FamilyDataContext.tsx`:
```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Person, Relationship } from '../types'

interface FamilyDataState {
  persons: Person[]
  relationships: Relationship[]
  loading: boolean
  error: string | null
  getPersonById: (id: string) => Person | undefined
}

const FamilyDataContext = createContext<FamilyDataState | null>(null)

export function FamilyDataProvider({ children }: { children: ReactNode }) {
  const [persons, setPersons] = useState<Person[]>([])
  const [relationships, setRelationships] = useState<Relationship[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const [personsRes, relsRes] = await Promise.all([
          fetch('/data/persons.json'),
          fetch('/data/relationships.json'),
        ])
        if (!personsRes.ok || !relsRes.ok) {
          throw new Error('Kunde inte ladda data')
        }
        const [personsData, relsData] = await Promise.all([
          personsRes.json(),
          relsRes.json(),
        ])
        setPersons(personsData)
        setRelationships(relsData)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Okänt fel')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  function getPersonById(id: string) {
    return persons.find((p) => p.id === id)
  }

  return (
    <FamilyDataContext.Provider value={{ persons, relationships, loading, error, getPersonById }}>
      {children}
    </FamilyDataContext.Provider>
  )
}

export function useFamilyData() {
  const ctx = useContext(FamilyDataContext)
  if (!ctx) throw new Error('useFamilyData must be used within FamilyDataProvider')
  return ctx
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/contexts/FamilyDataContext.test.tsx`
Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/contexts/ src/types/
git commit -m "feat: add FamilyDataContext with loading, error, and data fetching"
```

---

### Task 5: Build tree graph utility (buildTree)

**Files:**
- Create: `src/utils/buildTree.ts`
- Create: `src/utils/buildTree.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/utils/buildTree.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildFamilyGraph, getParents, getChildren, getSiblings, getPartners } from './buildTree'
import type { Person, Relationship } from '../types'

const makePerson = (id: string, side: Person['familySide'] = 'jens'): Person => ({
  id, firstName: id, lastName: 'Test', birthName: null,
  birthDate: null, birthPlace: null, deathDate: null, deathPlace: null,
  gender: 'male', occupation: null, photos: [], stories: [],
  contactInfo: null, familySide: side,
})

const persons: Person[] = [
  makePerson('jens', 'center'),
  makePerson('klara', 'center'),
  makePerson('erik', 'jens'),
  makePerson('anna', 'jens'),
  makePerson('sven', 'jens'), // sibling of jens
]

const relationships: Relationship[] = [
  { type: 'partner', from: 'jens', to: 'klara', status: 'current' },
  { type: 'partner', from: 'erik', to: 'anna', status: 'current' },
  { type: 'parent', from: 'erik', to: 'jens' },
  { type: 'parent', from: 'anna', to: 'jens' },
  { type: 'parent', from: 'erik', to: 'sven' },
  { type: 'parent', from: 'anna', to: 'sven' },
]

describe('buildFamilyGraph', () => {
  it('builds an adjacency structure from persons and relationships', () => {
    const graph = buildFamilyGraph(persons, relationships)
    expect(graph.size).toBe(5)
    expect(graph.get('jens')).toBeDefined()
  })
})

describe('getParents', () => {
  it('returns parents of a person', () => {
    const graph = buildFamilyGraph(persons, relationships)
    const parents = getParents(graph, 'jens')
    expect(parents.map(p => p.id).sort()).toEqual(['anna', 'erik'])
  })
})

describe('getChildren', () => {
  it('returns children of a person', () => {
    const graph = buildFamilyGraph(persons, relationships)
    const children = getChildren(graph, 'erik')
    expect(children.map(p => p.id).sort()).toEqual(['jens', 'sven'])
  })
})

describe('getSiblings', () => {
  it('derives siblings from shared parents', () => {
    const graph = buildFamilyGraph(persons, relationships)
    const siblings = getSiblings(graph, 'jens')
    expect(siblings.map(p => p.id)).toEqual(['sven'])
  })
})

describe('getPartners', () => {
  it('returns partners of a person', () => {
    const graph = buildFamilyGraph(persons, relationships)
    const partners = getPartners(graph, 'jens')
    expect(partners.map(p => p.id)).toEqual(['klara'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/buildTree.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement buildTree**

Create `src/utils/buildTree.ts`:
```ts
import type { Person, Relationship } from '../types'

export interface FamilyNode {
  person: Person
  parentIds: string[]
  childIds: string[]
  partnerIds: string[]
}

export type FamilyGraph = Map<string, FamilyNode>

export function buildFamilyGraph(persons: Person[], relationships: Relationship[]): FamilyGraph {
  const graph: FamilyGraph = new Map()

  for (const person of persons) {
    graph.set(person.id, {
      person,
      parentIds: [],
      childIds: [],
      partnerIds: [],
    })
  }

  for (const rel of relationships) {
    const fromNode = graph.get(rel.from)
    const toNode = graph.get(rel.to)
    if (!fromNode || !toNode) continue

    if (rel.type === 'parent') {
      toNode.parentIds.push(rel.from)
      fromNode.childIds.push(rel.to)
    } else if (rel.type === 'partner') {
      fromNode.partnerIds.push(rel.to)
      toNode.partnerIds.push(rel.from)
    }
  }

  return graph
}

export function getParents(graph: FamilyGraph, personId: string): Person[] {
  const node = graph.get(personId)
  if (!node) return []
  return node.parentIds
    .map((id) => graph.get(id)?.person)
    .filter((p): p is Person => p !== undefined)
}

export function getChildren(graph: FamilyGraph, personId: string): Person[] {
  const node = graph.get(personId)
  if (!node) return []
  return node.childIds
    .map((id) => graph.get(id)?.person)
    .filter((p): p is Person => p !== undefined)
}

export function getSiblings(graph: FamilyGraph, personId: string): Person[] {
  const node = graph.get(personId)
  if (!node) return []

  const siblingIds = new Set<string>()
  for (const parentId of node.parentIds) {
    const parent = graph.get(parentId)
    if (!parent) continue
    for (const childId of parent.childIds) {
      if (childId !== personId) siblingIds.add(childId)
    }
  }

  return Array.from(siblingIds)
    .map((id) => graph.get(id)?.person)
    .filter((p): p is Person => p !== undefined)
}

export function getPartners(graph: FamilyGraph, personId: string): Person[] {
  const node = graph.get(personId)
  if (!node) return []
  return node.partnerIds
    .map((id) => graph.get(id)?.person)
    .filter((p): p is Person => p !== undefined)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/buildTree.test.ts`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/buildTree.ts src/utils/buildTree.test.ts
git commit -m "feat: add buildFamilyGraph utility with parent/child/sibling/partner lookups"
```

---

### Task 6: Build display format utilities

**Files:**
- Create: `src/utils/formatPerson.ts`
- Create: `src/utils/formatPerson.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/utils/formatPerson.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { formatLifespan, formatFullName, getInitials } from './formatPerson'

describe('formatLifespan', () => {
  it('formats living person', () => {
    expect(formatLifespan('1995-03-12', null, 'Göteborg', null))
      .toBe('f. 1995 i Göteborg')
  })

  it('formats deceased person', () => {
    expect(formatLifespan('1935-06-01', '2015-12-20', 'Skövde', 'Göteborg'))
      .toBe('f. 1935 i Skövde – d. 2015 i Göteborg')
  })

  it('handles missing places', () => {
    expect(formatLifespan('1995-03-12', null, null, null))
      .toBe('f. 1995')
  })

  it('handles null birth date', () => {
    expect(formatLifespan(null, null, null, null)).toBe('')
  })
})

describe('formatFullName', () => {
  it('formats name without birth name', () => {
    expect(formatFullName('Jens', 'Andersson', null)).toBe('Jens Andersson')
  })

  it('formats name with birth name', () => {
    expect(formatFullName('Anna', 'Andersson', 'Svensson'))
      .toBe('Anna Andersson (född Svensson)')
  })
})

describe('getInitials', () => {
  it('returns initials from first and last name', () => {
    expect(getInitials('Jens', 'Andersson')).toBe('JA')
  })
})
```

- [ ] **Step 2b: Write getRelationLabel test**

Add to `src/utils/formatPerson.test.ts`:
```ts
import { getRelationLabel } from './formatPerson'
import { buildFamilyGraph } from './buildTree'
import type { Person, Relationship } from '../types'

describe('getRelationLabel', () => {
  const makePerson = (id: string, gender: 'male' | 'female', firstName: string): Person => ({
    id, firstName, lastName: 'Test', birthName: null, birthDate: null, birthPlace: null,
    deathDate: null, deathPlace: null, gender, occupation: null, photos: [], stories: [],
    contactInfo: null, familySide: 'jens',
  })

  it('returns parent label', () => {
    const persons = [makePerson('erik', 'male', 'Erik'), makePerson('jens', 'male', 'Jens')]
    const rels: Relationship[] = [{ type: 'parent', from: 'erik', to: 'jens' }]
    const graph = buildFamilyGraph(persons, rels)

    expect(getRelationLabel(graph, 'erik', persons)).toContain('Far till Jens')
  })

  it('returns mother label for female parent', () => {
    const persons = [makePerson('anna', 'female', 'Anna'), makePerson('jens', 'male', 'Jens')]
    const rels: Relationship[] = [{ type: 'parent', from: 'anna', to: 'jens' }]
    const graph = buildFamilyGraph(persons, rels)

    expect(getRelationLabel(graph, 'anna', persons)).toContain('Mor till Jens')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/formatPerson.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement formatPerson**

Create `src/utils/formatPerson.ts`:
```ts
export function formatLifespan(
  birthDate: string | null,
  deathDate: string | null,
  birthPlace: string | null,
  deathPlace: string | null,
): string {
  if (!birthDate) return ''

  const birthYear = birthDate.slice(0, 4)
  let result = `f. ${birthYear}`
  if (birthPlace) result += ` i ${birthPlace}`

  if (deathDate) {
    const deathYear = deathDate.slice(0, 4)
    result += ` – d. ${deathYear}`
    if (deathPlace) result += ` i ${deathPlace}`
  }

  return result
}

export function formatFullName(
  firstName: string,
  lastName: string,
  birthName: string | null,
): string {
  const name = `${firstName} ${lastName}`
  if (birthName) return `${name} (född ${birthName})`
  return name
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0]}${lastName[0]}`.toUpperCase()
}

/**
 * Generate a Swedish relation label for a person relative to the viewer.
 * Uses the family graph to determine the relationship.
 */
export function getRelationLabel(
  graph: import('../utils/buildTree').FamilyGraph,
  personId: string,
  persons: import('../types').Person[],
): string {
  const node = graph.get(personId)
  if (!node) return ''

  const labels: string[] = []

  // Check who this person is parent of
  for (const childId of node.childIds) {
    const child = persons.find(p => p.id === childId)
    if (child) {
      const parentWord = node.person.gender === 'female' ? 'Mor' : 'Far'
      labels.push(`${parentWord} till ${child.firstName}`)
    }
  }

  // Check partners
  for (const partnerId of node.partnerIds) {
    const partner = persons.find(p => p.id === partnerId)
    if (partner) {
      labels.push(`Gift med ${partner.firstName}`)
    }
  }

  return labels.join(' · ')
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/formatPerson.test.ts`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/formatPerson.ts src/utils/formatPerson.test.ts
git commit -m "feat: add display format utilities (lifespan, full name, initials)"
```

---

## Chunk 2: Layout, Routing & Tree View

### Task 7: Build Header and Layout

**Files:**
- Create: `src/components/Layout/Header.tsx`
- Create: `src/components/Layout/Header.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/Layout/Header.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { Header } from './Header'

describe('Header', () => {
  it('renders site name and navigation links', () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    )

    expect(screen.getByText('Familjen')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /träd/i })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /sök/i })).toHaveAttribute('href', '/sok')
    expect(screen.getByRole('link', { name: /galleri/i })).toHaveAttribute('href', '/galleri')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Layout/Header.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement Header**

Create `src/components/Layout/Header.tsx`:
```tsx
import { NavLink } from 'react-router-dom'

export function Header() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-sans transition-colors ${
      isActive ? 'text-accent font-semibold' : 'text-text-secondary hover:text-text-primary'
    }`

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-bg-primary border-b border-bg-secondary">
      <h1 className="font-serif text-xl text-text-primary">
        <span className="font-semibold">Familjen</span>
      </h1>
      <nav className="flex gap-6">
        <NavLink to="/" end className={linkClass}>Träd</NavLink>
        <NavLink to="/sok" className={linkClass}>Sök</NavLink>
        <NavLink to="/galleri" className={linkClass}>Galleri</NavLink>
      </nav>
    </header>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Layout/Header.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/Layout/
git commit -m "feat: add Header component with nav links"
```

---

### Task 8: Set up App with Router and Context

**Files:**
- Modify: `src/App.tsx`
- Create: `src/App.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/App.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import App from './App'

describe('App', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn((url: string) => {
      if (url.includes('persons.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 'jens', firstName: 'Jens', lastName: 'Andersson', familySide: 'center' },
          ]),
        })
      }
      if (url.includes('relationships.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        })
      }
      return Promise.reject(new Error('Unknown'))
    }) as unknown as typeof fetch
  })

  it('renders header and tree view by default', async () => {
    render(<App />)

    expect(screen.getByText('Familjen')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /träd/i })).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement App with routing**

Replace `src/App.tsx`:
```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { FamilyDataProvider } from './contexts/FamilyDataContext'
import { Header } from './components/Layout/Header'

function TreePage() {
  return <div className="flex-1 bg-bg-primary">Trädvy (kommer snart)</div>
}

function SearchPage() {
  return <div className="flex-1 p-6 bg-bg-primary">Sökvy (kommer snart)</div>
}

function GalleryPage() {
  return <div className="flex-1 p-6 bg-bg-primary">Galleri (kommer snart)</div>
}

export default function App() {
  return (
    <BrowserRouter>
      <FamilyDataProvider>
        <div className="flex flex-col h-screen bg-bg-primary font-sans text-text-primary">
          <Header />
          <Routes>
            <Route path="/" element={<TreePage />} />
            <Route path="/person/:id" element={<TreePage />} />
            <Route path="/sok" element={<SearchPage />} />
            <Route path="/galleri" element={<GalleryPage />} />
          </Routes>
        </div>
      </FamilyDataProvider>
    </BrowserRouter>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS

- [ ] **Step 5: Verify visually**

Run: `npm run dev`
Expected: Header renders with nav links, placeholder content shows for each route.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: set up App with React Router, FamilyDataProvider, and placeholder pages"
```

---

### Task 9: Build TreeLayout (pure function: data → positions)

**Files:**
- Create: `src/components/Tree/TreeLayout.ts`
- Create: `src/components/Tree/TreeLayout.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/components/Tree/TreeLayout.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { computeTreeLayout, type LayoutNode } from './TreeLayout'
import type { Person, Relationship } from '../../types'

const makePerson = (id: string, side: Person['familySide'] = 'jens'): Person => ({
  id, firstName: id, lastName: 'Test', birthName: null,
  birthDate: null, birthPlace: null, deathDate: null, deathPlace: null,
  gender: 'male', occupation: null, photos: [], stories: [],
  contactInfo: null, familySide: side,
})

describe('computeTreeLayout', () => {
  it('places center couple at origin', () => {
    const persons = [makePerson('jens', 'center'), makePerson('klara', 'center')]
    const rels: Relationship[] = [{ type: 'partner', from: 'jens', to: 'klara', status: 'current' }]

    const nodes = computeTreeLayout(persons, rels, 'jens')
    const jens = nodes.find(n => n.personId === 'jens')!
    const klara = nodes.find(n => n.personId === 'klara')!

    expect(jens.x).toBeLessThan(klara.x) // Jens left of Klara
    expect(jens.y).toBe(klara.y) // Same vertical level
  })

  it('places jens parents to the left', () => {
    const persons = [
      makePerson('jens', 'center'), makePerson('klara', 'center'),
      makePerson('erik', 'jens'), makePerson('anna', 'jens'),
    ]
    const rels: Relationship[] = [
      { type: 'partner', from: 'jens', to: 'klara', status: 'current' },
      { type: 'partner', from: 'erik', to: 'anna', status: 'current' },
      { type: 'parent', from: 'erik', to: 'jens' },
      { type: 'parent', from: 'anna', to: 'jens' },
    ]

    const nodes = computeTreeLayout(persons, rels, 'jens')
    const jens = nodes.find(n => n.personId === 'jens')!
    const erik = nodes.find(n => n.personId === 'erik')!

    expect(erik.x).toBeLessThan(jens.x) // Parents to the left
  })

  it('places klara parents to the right', () => {
    const persons = [
      makePerson('jens', 'center'), makePerson('klara', 'center'),
      makePerson('lars', 'klara'), makePerson('maria', 'klara'),
    ]
    const rels: Relationship[] = [
      { type: 'partner', from: 'jens', to: 'klara', status: 'current' },
      { type: 'partner', from: 'lars', to: 'maria', status: 'current' },
      { type: 'parent', from: 'lars', to: 'klara' },
      { type: 'parent', from: 'maria', to: 'klara' },
    ]

    const nodes = computeTreeLayout(persons, rels, 'jens')
    const klara = nodes.find(n => n.personId === 'klara')!
    const lars = nodes.find(n => n.personId === 'lars')!

    expect(lars.x).toBeGreaterThan(klara.x) // Parents to the right
  })

  it('returns links between related persons', () => {
    const persons = [makePerson('jens', 'center'), makePerson('klara', 'center')]
    const rels: Relationship[] = [{ type: 'partner', from: 'jens', to: 'klara', status: 'current' }]

    const nodes = computeTreeLayout(persons, rels, 'jens')
    const jens = nodes.find(n => n.personId === 'jens')!
    expect(jens.links.length).toBeGreaterThan(0)
  })

  it('positions siblings vertically', () => {
    const persons = [
      makePerson('jens', 'center'), makePerson('klara', 'center'),
      makePerson('erik', 'jens'), makePerson('anna', 'jens'),
      makePerson('sven', 'jens'),
    ]
    const rels: Relationship[] = [
      { type: 'partner', from: 'jens', to: 'klara', status: 'current' },
      { type: 'partner', from: 'erik', to: 'anna', status: 'current' },
      { type: 'parent', from: 'erik', to: 'jens' },
      { type: 'parent', from: 'anna', to: 'jens' },
      { type: 'parent', from: 'erik', to: 'sven' },
      { type: 'parent', from: 'anna', to: 'sven' },
    ]

    const nodes = computeTreeLayout(persons, rels, 'jens')
    const jens = nodes.find(n => n.personId === 'jens')!
    const sven = nodes.find(n => n.personId === 'sven')!

    expect(jens.x).toBe(sven.x) // Same horizontal level
    expect(jens.y).not.toBe(sven.y) // Different vertical position
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/Tree/TreeLayout.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement TreeLayout**

Create `src/components/Tree/TreeLayout.ts`:
```ts
import { buildFamilyGraph, type FamilyGraph } from '../../utils/buildTree'
import type { Person, Relationship } from '../../types'

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

const HORIZONTAL_GAP = 200
const VERTICAL_GAP = 140
const PARTNER_GAP = 80

/**
 * Computes a horizontal tree layout centered on `centerId`.
 *
 * X-axis = generations (left for centerId's ancestors, right for partner's).
 * Y-axis = siblings/children spread vertically.
 *
 * Uses a slot-tracking approach: each placed group claims a y-range so that
 * subsequent placements avoid overlap.
 */
export function computeTreeLayout(
  persons: Person[],
  relationships: Relationship[],
  centerId: string,
): LayoutNode[] {
  const graph = buildFamilyGraph(persons, relationships)
  const nodes = new Map<string, LayoutNode>()
  const visited = new Set<string>()
  // Track occupied y-ranges per x-column to avoid overlap
  const occupiedSlots = new Map<number, number[]>()

  const centerNode = graph.get(centerId)
  if (!centerNode) return []

  const centerPartnerId = centerNode.partnerIds[0]

  // Place center couple at origin
  placeNode(centerId, -PARTNER_GAP / 2, 0, graph, nodes)
  if (centerPartnerId) {
    placeNode(centerPartnerId, PARTNER_GAP / 2, 0, graph, nodes)
    addLink(nodes, centerId, centerPartnerId, 'partner')
  }
  visited.add(centerId)
  if (centerPartnerId) visited.add(centerPartnerId)

  // Expand center person's ancestors leftward
  expandAncestors(centerId, -1, graph, nodes, visited, occupiedSlots)

  // Expand partner's ancestors rightward
  if (centerPartnerId) {
    expandAncestors(centerPartnerId, 1, graph, nodes, visited, occupiedSlots)
  }

  // Place children of center couple below
  const centerChildren = centerNode.childIds.filter(id => !visited.has(id))
  centerChildren.forEach((childId, i) => {
    const yOffset = (i - (centerChildren.length - 1) / 2) * VERTICAL_GAP
    placeNode(childId, 0, VERTICAL_GAP + yOffset, graph, nodes)
    visited.add(childId)
    addLink(nodes, centerId, childId, 'parent-child')
  })

  return Array.from(nodes.values())
}

function expandAncestors(
  personId: string,
  direction: number,
  graph: FamilyGraph,
  nodes: Map<string, LayoutNode>,
  visited: Set<string>,
  occupiedSlots: Map<number, number[]>,
) {
  const node = graph.get(personId)
  if (!node) return

  const parentIds = node.parentIds.filter(id => !visited.has(id))
  if (parentIds.length === 0) return

  const personNode = nodes.get(personId)
  const personY = personNode?.y ?? 0
  const xBase = (personNode?.x ?? 0) + direction * HORIZONTAL_GAP

  // Find a free y-slot at this x-column, preferring alignment with the child
  const parentY = findFreeSlot(occupiedSlots, xBase, personY, VERTICAL_GAP)

  if (parentIds.length >= 2) {
    placeNode(parentIds[0], xBase - PARTNER_GAP / 2, parentY, graph, nodes)
    placeNode(parentIds[1], xBase + PARTNER_GAP / 2, parentY, graph, nodes)
    visited.add(parentIds[0])
    visited.add(parentIds[1])
    claimSlot(occupiedSlots, xBase, parentY)

    addLink(nodes, parentIds[0], parentIds[1], 'partner')
    addLink(nodes, parentIds[0], personId, 'parent-child')
    addLink(nodes, parentIds[1], personId, 'parent-child')

    // Place siblings
    const allChildren = graph.get(parentIds[0])?.childIds ?? []
    const siblings = allChildren.filter(id => id !== personId && !visited.has(id))
    const personX = personNode?.x ?? 0
    siblings.forEach((sibId, i) => {
      const sibY = personY + (i + 1) * VERTICAL_GAP
      placeNode(sibId, personX, sibY, graph, nodes)
      visited.add(sibId)
      addLink(nodes, parentIds[0], sibId, 'parent-child')
    })

    // Recurse for grandparents
    expandAncestors(parentIds[0], direction, graph, nodes, visited, occupiedSlots)
    expandAncestors(parentIds[1], direction, graph, nodes, visited, occupiedSlots)
  } else {
    placeNode(parentIds[0], xBase, parentY, graph, nodes)
    visited.add(parentIds[0])
    claimSlot(occupiedSlots, xBase, parentY)
    addLink(nodes, parentIds[0], personId, 'parent-child')
    expandAncestors(parentIds[0], direction, graph, nodes, visited, occupiedSlots)
  }
}

/** Find a y-slot at the given x-column that doesn't overlap with existing nodes. */
function findFreeSlot(
  occupied: Map<number, number[]>,
  x: number,
  preferredY: number,
  gap: number,
): number {
  const slots = occupied.get(x)
  if (!slots || slots.length === 0) return preferredY

  // Check if preferred slot is free
  if (slots.every(y => Math.abs(y - preferredY) >= gap)) return preferredY

  // Search outward from preferred position
  for (let offset = gap; offset < gap * 20; offset += gap) {
    const above = preferredY - offset
    if (slots.every(y => Math.abs(y - above) >= gap)) return above
    const below = preferredY + offset
    if (slots.every(y => Math.abs(y - below) >= gap)) return below
  }
  return preferredY
}

function claimSlot(occupied: Map<number, number[]>, x: number, y: number) {
  const slots = occupied.get(x) ?? []
  slots.push(y)
  occupied.set(x, slots)
}

function placeNode(
  personId: string,
  x: number,
  y: number,
  graph: FamilyGraph,
  nodes: Map<string, LayoutNode>,
) {
  const familyNode = graph.get(personId)
  if (!familyNode) return
  nodes.set(personId, { personId, person: familyNode.person, x, y, links: [] })
}

function addLink(
  nodes: Map<string, LayoutNode>,
  fromId: string,
  toId: string,
  type: LayoutLink['type'],
) {
  const from = nodes.get(fromId)
  if (from) {
    from.links.push({ targetId: toId, type })
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/Tree/TreeLayout.test.ts`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/Tree/TreeLayout.ts src/components/Tree/TreeLayout.test.ts
git commit -m "feat: add TreeLayout computing horizontal positions from family data"
```

---

### Task 10: Build TreeView component with D3 pan/zoom

**Files:**
- Create: `src/components/Tree/TreeView.tsx`
- Create: `src/components/Tree/TreeView.test.tsx`
- Create: `src/components/PersonCard/PersonCardMini.tsx`
- Create: `src/components/PersonCard/PersonCardMini.test.tsx`

- [ ] **Step 1: Write PersonCardMini test**

Create `src/components/PersonCard/PersonCardMini.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PersonCardMini } from './PersonCardMini'

describe('PersonCardMini', () => {
  it('renders name and birth year', () => {
    render(
      <svg>
        <PersonCardMini
          person={{
            id: 'jens', firstName: 'Jens', lastName: 'Andersson',
            birthName: null, birthDate: '1995-03-12', birthPlace: 'Göteborg',
            deathDate: null, deathPlace: null, gender: 'male',
            occupation: null, photos: [], stories: [],
            contactInfo: null, familySide: 'center',
          }}
          x={0}
          y={0}
          onClick={() => {}}
        />
      </svg>
    )

    expect(screen.getByText('Jens')).toBeInTheDocument()
    expect(screen.getByText('1995')).toBeInTheDocument()
    expect(screen.getByText('JA')).toBeInTheDocument() // initials
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/PersonCard/PersonCardMini.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement PersonCardMini**

Create `src/components/PersonCard/PersonCardMini.tsx`:
```tsx
import { getInitials } from '../../utils/formatPerson'
import type { Person } from '../../types'

interface Props {
  person: Person
  x: number
  y: number
  isExpanded?: boolean
  onClick: () => void
}

const CARD_WIDTH = 120
const CARD_HEIGHT = 80

export function PersonCardMini({ person, x, y, isExpanded, onClick }: Props) {
  const initials = getInitials(person.firstName, person.lastName)
  const birthYear = person.birthDate?.slice(0, 4)
  const deathYear = person.deathDate?.slice(0, 4)

  return (
    <g
      transform={`translate(${x - CARD_WIDTH / 2}, ${y - CARD_HEIGHT / 2})`}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      {/* Card background */}
      <rect
        width={CARD_WIDTH}
        height={CARD_HEIGHT}
        rx={8}
        fill="white"
        stroke={isExpanded ? '#4a7050' : '#6b8f71'}
        strokeWidth={isExpanded ? 2.5 : 1.5}
        filter="url(#shadow)"
      />

      {/* Photo circle or initials */}
      <circle cx={CARD_WIDTH / 2} cy={24} r={16} fill="#eee8dc" stroke="#6b8f71" strokeWidth={1} />
      <text
        x={CARD_WIDTH / 2}
        y={28}
        textAnchor="middle"
        fontSize={11}
        fontFamily="Inter, sans-serif"
        fill="#6b8f71"
      >
        {initials}
      </text>

      {/* Name */}
      <text
        x={CARD_WIDTH / 2}
        y={54}
        textAnchor="middle"
        fontSize={13}
        fontFamily="Lora, serif"
        fontWeight={600}
        fill="#3a3a3a"
      >
        {person.firstName}
      </text>

      {/* Year */}
      <text
        x={CARD_WIDTH / 2}
        y={70}
        textAnchor="middle"
        fontSize={11}
        fontFamily="Inter, sans-serif"
        fill="#777"
      >
        {birthYear ?? '?'}
        {deathYear ? ` – ${deathYear}` : ''}
      </text>
    </g>
  )
}

export { CARD_WIDTH, CARD_HEIGHT }
```

- [ ] **Step 4: Run PersonCardMini test**

Run: `npx vitest run src/components/PersonCard/PersonCardMini.test.tsx`
Expected: PASS

- [ ] **Step 5: Write TreeView test**

Create `src/components/Tree/TreeView.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TreeView } from './TreeView'
import type { Person, Relationship } from '../../types'

const persons: Person[] = [
  {
    id: 'jens', firstName: 'Jens', lastName: 'Andersson', birthName: null,
    birthDate: '1995-03-12', birthPlace: 'Göteborg', deathDate: null,
    deathPlace: null, gender: 'male', occupation: null, photos: [],
    stories: [], contactInfo: null, familySide: 'center',
  },
  {
    id: 'klara', firstName: 'Klara', lastName: 'Lindqvist', birthName: null,
    birthDate: '1996-07-20', birthPlace: 'Stockholm', deathDate: null,
    deathPlace: null, gender: 'female', occupation: null, photos: [],
    stories: [], contactInfo: null, familySide: 'center',
  },
]

const relationships: Relationship[] = [
  { type: 'partner', from: 'jens', to: 'klara', status: 'current' },
]

describe('TreeView', () => {
  it('renders person cards for all persons', () => {
    render(
      <TreeView
        persons={persons}
        relationships={relationships}
        centerId="jens"
        onPersonClick={vi.fn()}
        expandedPersonId={null}
      />
    )

    expect(screen.getByText('Jens')).toBeInTheDocument()
    expect(screen.getByText('Klara')).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Implement TreeView**

Create `src/components/Tree/TreeView.tsx`:
```tsx
import { useRef, useEffect, useState } from 'react'
import { select } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
import { computeTreeLayout } from './TreeLayout'
import { PersonCardMini } from '../PersonCard/PersonCardMini'
import { Minimap } from './Minimap'
import type { Person, Relationship } from '../../types'

interface Props {
  persons: Person[]
  relationships: Relationship[]
  centerId: string
  onPersonClick: (personId: string) => void
  expandedPersonId: string | null
}

export function TreeView({ persons, relationships, centerId, onPersonClick, expandedPersonId }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 })

  const nodes = computeTreeLayout(persons, relationships, centerId)

  useEffect(() => {
    if (!svgRef.current || !gRef.current) return

    const svgEl = select(svgRef.current)
    const zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 3])
      .on('zoom', (event) => {
        setTransform({
          x: event.transform.x,
          y: event.transform.y,
          k: event.transform.k,
        })
      })

    svgEl.call(zoomBehavior)

    // Center on initial load
    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight
    svgEl.call(
      zoomBehavior.transform,
      zoomIdentity.translate(width / 2, height / 2).scale(0.8),
    )

    return () => {
      svgEl.on('.zoom', null)
    }
  }, [])

  // Build links for rendering
  const links: Array<{ x1: number; y1: number; x2: number; y2: number; type: string }> = []
  for (const node of nodes) {
    for (const link of node.links) {
      const target = nodes.find(n => n.personId === link.targetId)
      if (target) {
        links.push({
          x1: node.x, y1: node.y,
          x2: target.x, y2: target.y,
          type: link.type,
        })
      }
    }
  }

  const svgWidth = svgRef.current?.clientWidth ?? 800
  const svgHeight = svgRef.current?.clientHeight ?? 600

  return (
    <div className="relative w-full h-full">
      <svg ref={svgRef} className="w-full h-full bg-bg-primary" style={{ touchAction: 'none' }}>
        <defs>
          <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.08" />
          </filter>
        </defs>
        <g ref={gRef} transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
          {/* Links */}
          {links.map((link, i) => (
            <line
              key={i}
              x1={link.x1} y1={link.y1}
              x2={link.x2} y2={link.y2}
              stroke={link.type === 'partner' ? '#c4a77d' : '#aaa'}
              strokeWidth={1.5}
              strokeDasharray={link.type === 'partner' ? '4,4' : undefined}
            />
          ))}

          {/* Person cards */}
          {nodes.map((node) => (
            <PersonCardMini
              key={node.personId}
              person={node.person}
              x={node.x}
              y={node.y}
              isExpanded={expandedPersonId === node.personId}
              onClick={() => onPersonClick(node.personId)}
            />
          ))}
        </g>
      </svg>
      <Minimap
        nodes={nodes}
        viewportX={transform.x}
        viewportY={transform.y}
        viewportWidth={svgWidth}
        viewportHeight={svgHeight}
        scale={transform.k}
      />
    </div>
  )
}
```

- [ ] **Step 7: Run TreeView test**

Run: `npx vitest run src/components/Tree/TreeView.test.tsx`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/components/Tree/ src/components/PersonCard/
git commit -m "feat: add TreeView with D3 pan/zoom and PersonCardMini"
```

---

### Task 11: Wire TreeView into App and verify visually

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace TreePage placeholder**

In `src/App.tsx`, replace the `TreePage` function:
```tsx
import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useFamilyData } from './contexts/FamilyDataContext'
import { TreeView } from './components/Tree/TreeView'
import { buildFamilyGraph } from './utils/buildTree'
import { getRelationLabel } from './utils/formatPerson'

function TreePage() {
  const { id } = useParams()
  const { persons, relationships, loading, error } = useFamilyData()
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null)

  if (loading) return <div className="flex-1 flex items-center justify-center font-sans text-text-secondary">Laddar...</div>
  if (error) return <div className="flex-1 flex items-center justify-center font-sans text-red-600">{error}</div>
  if (persons.length === 0) return <div className="flex-1 flex items-center justify-center font-sans text-text-secondary">Inga personer ännu</div>

  const centerId = id ?? 'jens'

  return (
    <div className="flex-1 relative">
      <TreeView
        persons={persons}
        relationships={relationships}
        centerId={centerId}
        onPersonClick={(personId) =>
          setExpandedPersonId(prev => prev === personId ? null : personId)
        }
        expandedPersonId={expandedPersonId}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify visually**

Run: `npm run dev`
Expected: Interactive tree with Jens & Klara in center, parents on each side, grandparents further out. Pan/zoom works.

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire TreeView into App with loading/error states"
```

---

## Chunk 3: Person Card Expanded & Add Form

### Task 12: Build PersonCardExpanded

**Files:**
- Create: `src/components/PersonCard/PersonCardExpanded.tsx`
- Create: `src/components/PersonCard/PersonCardExpanded.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/PersonCard/PersonCardExpanded.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PersonCardExpanded } from './PersonCardExpanded'
import type { Person } from '../../types'

const person: Person = {
  id: 'erik', firstName: 'Erik', lastName: 'Andersson',
  birthName: null, birthDate: '1965-01-15', birthPlace: 'Göteborg',
  deathDate: null, deathPlace: null, gender: 'male',
  occupation: 'Snickare', photos: [],
  stories: [{ title: 'Sommaren 1990', text: 'Det var en fin sommar.' }],
  contactInfo: null, familySide: 'jens',
}

describe('PersonCardExpanded', () => {
  it('renders full details', () => {
    render(
      <PersonCardExpanded
        person={person}
        relationLabel="Far till Jens"
        onClose={vi.fn()}
        onEdit={vi.fn()}
      />
    )

    expect(screen.getByText('Erik Andersson')).toBeInTheDocument()
    expect(screen.getByText('f. 1965 i Göteborg')).toBeInTheDocument()
    expect(screen.getByText('Snickare')).toBeInTheDocument()
    expect(screen.getByText('Sommaren 1990')).toBeInTheDocument()
    expect(screen.getByText('Far till Jens')).toBeInTheDocument()
    expect(screen.getByText('Redigera')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/PersonCard/PersonCardExpanded.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement PersonCardExpanded**

Create `src/components/PersonCard/PersonCardExpanded.tsx`:
```tsx
import { useState } from 'react'
import { formatLifespan, formatFullName, getInitials } from '../../utils/formatPerson'
import type { Person } from '../../types'

interface Props {
  person: Person
  relationLabel: string
  onClose: () => void
  onEdit: () => void
}

export function PersonCardExpanded({ person, relationLabel, onClose, onEdit }: Props) {
  const [expandedStory, setExpandedStory] = useState<number | null>(null)

  const lifespan = formatLifespan(person.birthDate, person.deathDate, person.birthPlace, person.deathPlace)
  const fullName = formatFullName(person.firstName, person.lastName, person.birthName)
  const initials = getInitials(person.firstName, person.lastName)

  return (
    <div
      className="bg-card-bg border-l-4 border-card-border rounded-lg shadow-md p-4 max-w-xs animate-in"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header with photo/initials and name */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-14 h-14 rounded-lg bg-bg-secondary border border-card-border flex items-center justify-center flex-shrink-0">
          {person.photos.length > 0 ? (
            <img src={`/${person.photos[0]}`} alt={person.firstName} className="w-full h-full object-cover rounded-lg" />
          ) : (
            <span className="text-accent font-sans font-semibold text-lg">{initials}</span>
          )}
        </div>
        <div>
          <h3 className="font-serif font-bold text-text-primary text-base">{fullName}</h3>
          <p className="text-text-secondary text-sm font-sans">{lifespan}</p>
        </div>
      </div>

      {/* Occupation */}
      {person.occupation && (
        <p className="text-sm font-sans text-text-primary mb-2">{person.occupation}</p>
      )}

      {/* Relation */}
      <p className="text-xs font-sans text-accent mb-3">{relationLabel}</p>

      {/* Stories */}
      {person.stories.length > 0 && (
        <div className="mb-3">
          {person.stories.map((story, i) => (
            <div key={i} className="mb-1">
              <button
                className="text-sm font-sans font-medium text-text-primary hover:text-accent transition-colors text-left"
                onClick={() => setExpandedStory(expandedStory === i ? null : i)}
              >
                {story.title}
              </button>
              {expandedStory === i && (
                <p className="text-sm font-sans text-text-secondary mt-1 pl-2 border-l-2 border-bg-secondary">
                  {story.text}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onEdit}
          className="text-xs font-sans bg-accent text-white px-3 py-1 rounded hover:bg-accent-dark transition-colors"
        >
          Redigera
        </button>
        <button
          onClick={onClose}
          className="text-xs font-sans text-text-secondary px-3 py-1 rounded hover:bg-bg-secondary transition-colors"
        >
          Stäng
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/PersonCard/PersonCardExpanded.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/PersonCard/PersonCardExpanded.tsx src/components/PersonCard/PersonCardExpanded.test.tsx
git commit -m "feat: add PersonCardExpanded with stories, lifespan, and relation label"
```

---

### Task 13: Build AddPersonForm

**Files:**
- Create: `src/components/AddForm/AddPersonForm.tsx`
- Create: `src/components/AddForm/AddPersonForm.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/AddForm/AddPersonForm.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AddPersonForm } from './AddPersonForm'

describe('AddPersonForm', () => {
  it('renders compact form with basic fields', () => {
    render(<AddPersonForm relationType="parent" onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByPlaceholderText('Förnamn')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Efternamn')).toBeInTheDocument()
    expect(screen.getByText('Skicka')).toBeInTheDocument()
  })

  it('expands to show additional fields', () => {
    render(<AddPersonForm relationType="parent" onSubmit={vi.fn()} onCancel={vi.fn()} />)

    fireEvent.click(screen.getByText('Fler detaljer'))

    expect(screen.getByPlaceholderText('Födelseort')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Yrke')).toBeInTheDocument()
  })

  it('calls onSubmit with form data', () => {
    const onSubmit = vi.fn()
    render(<AddPersonForm relationType="parent" onSubmit={onSubmit} onCancel={vi.fn()} />)

    fireEvent.change(screen.getByPlaceholderText('Förnamn'), { target: { value: 'Erik' } })
    fireEvent.change(screen.getByPlaceholderText('Efternamn'), { target: { value: 'Svensson' } })
    fireEvent.click(screen.getByText('Skicka'))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      firstName: 'Erik',
      lastName: 'Svensson',
      relationType: 'parent',
    }))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/AddForm/AddPersonForm.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement AddPersonForm**

Create `src/components/AddForm/AddPersonForm.tsx`:
```tsx
import { useState } from 'react'

export interface AddPersonData {
  firstName: string
  lastName: string
  relationType: string
  birthName?: string
  birthDate?: string
  birthPlace?: string
  deathDate?: string
  deathPlace?: string
  occupation?: string
  story?: string
  honeypot?: string
}

interface Props {
  relationType: string
  onSubmit: (data: AddPersonData) => void
  onCancel: () => void
}

export function AddPersonForm({ relationType, onSubmit, onCancel }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [birthName, setBirthName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [birthPlace, setBirthPlace] = useState('')
  const [deathDate, setDeathDate] = useState('')
  const [deathPlace, setDeathPlace] = useState('')
  const [occupation, setOccupation] = useState('')
  const [story, setStory] = useState('')
  const [honeypot, setHoneypot] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) return

    onSubmit({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      relationType,
      ...(birthName && { birthName }),
      ...(birthDate && { birthDate }),
      ...(birthPlace && { birthPlace }),
      ...(deathDate && { deathDate }),
      ...(deathPlace && { deathPlace }),
      ...(occupation && { occupation }),
      ...(story && { story }),
      ...(honeypot && { honeypot }),
    })
  }

  const inputClass = 'w-full px-2 py-1.5 text-sm font-sans border border-bg-secondary rounded bg-white text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent'

  return (
    <form onSubmit={handleSubmit} className="bg-card-bg border-l-4 border-card-border rounded-lg shadow-md p-4 max-w-xs">
      <h4 className="font-serif font-semibold text-sm text-text-primary mb-3">
        Lägg till {relationType === 'parent' ? 'förälder' : relationType === 'sibling' ? 'syskon' : 'partner'}
      </h4>

      {/* Honeypot - hidden from humans */}
      <input
        type="text"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        className="absolute -left-[9999px]"
        tabIndex={-1}
        autoComplete="off"
      />

      <div className="flex flex-col gap-2 mb-3">
        <input className={inputClass} placeholder="Förnamn" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        <input className={inputClass} placeholder="Efternamn" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
      </div>

      {!expanded && (
        <button type="button" onClick={() => setExpanded(true)} className="text-xs font-sans text-accent hover:text-accent-dark mb-3 block">
          Fler detaljer
        </button>
      )}

      {expanded && (
        <div className="flex flex-col gap-2 mb-3">
          <input className={inputClass} placeholder="Födnamn" value={birthName} onChange={(e) => setBirthName(e.target.value)} />
          <input className={inputClass} placeholder="Födelsedatum (ÅÅÅÅ-MM-DD)" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          <input className={inputClass} placeholder="Födelseort" value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} />
          <input className={inputClass} placeholder="Dödsdatum (ÅÅÅÅ-MM-DD)" value={deathDate} onChange={(e) => setDeathDate(e.target.value)} />
          <input className={inputClass} placeholder="Dödsort" value={deathPlace} onChange={(e) => setDeathPlace(e.target.value)} />
          <input className={inputClass} placeholder="Yrke" value={occupation} onChange={(e) => setOccupation(e.target.value)} />
          <textarea className={`${inputClass} resize-none`} rows={3} placeholder="Berättelse eller anekdot" value={story} onChange={(e) => setStory(e.target.value)} />
        </div>
      )}

      <div className="flex gap-2">
        <button type="submit" className="text-xs font-sans bg-accent text-white px-3 py-1.5 rounded hover:bg-accent-dark transition-colors">
          Skicka
        </button>
        <button type="button" onClick={onCancel} className="text-xs font-sans text-text-secondary px-3 py-1.5 rounded hover:bg-bg-secondary transition-colors">
          Avbryt
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/AddForm/AddPersonForm.test.tsx`
Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/AddForm/
git commit -m "feat: add AddPersonForm with compact and expanded modes"
```

---

### Task 14: Build Vercel serverless function for GitHub Issues

**Files:**
- Create: `api/submit-contribution.ts`

- [ ] **Step 1: Implement serverless function**

Create `api/submit-contribution.ts`:
```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const REPO_OWNER = process.env.GITHUB_REPO_OWNER
const REPO_NAME = process.env.GITHUB_REPO_NAME

// Simple in-memory rate limiting (resets on cold start, good enough for v1)
const requestCounts = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60 * 60 * 1000 // 1 hour

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = requestCounts.get(ip)

  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return false
  }

  entry.count++
  return entry.count > RATE_LIMIT
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? 'unknown'
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'För många förfrågningar. Försök igen senare.' })
  }

  const { firstName, lastName, relationType, honeypot, ...rest } = req.body

  // Honeypot check
  if (honeypot) {
    // Silently accept to not reveal the check to bots
    return res.status(200).json({ success: true })
  }

  if (!firstName || !lastName) {
    return res.status(400).json({ error: 'Förnamn och efternamn krävs.' })
  }

  if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME) {
    return res.status(500).json({ error: 'Server configuration error' })
  }

  const isEdit = !!rest.personId
  const title = isEdit
    ? `Uppdatera: ${firstName} ${lastName}`
    : `Ny person: ${firstName} ${lastName}`

  const body = [
    `## ${isEdit ? 'Uppdatering' : 'Ny person'}`,
    '',
    `**Namn:** ${firstName} ${lastName}`,
    `**Relationstyp:** ${relationType}`,
    rest.birthName ? `**Födnamn:** ${rest.birthName}` : null,
    rest.birthDate ? `**Födelsedatum:** ${rest.birthDate}` : null,
    rest.birthPlace ? `**Födelseort:** ${rest.birthPlace}` : null,
    rest.deathDate ? `**Dödsdatum:** ${rest.deathDate}` : null,
    rest.deathPlace ? `**Dödsort:** ${rest.deathPlace}` : null,
    rest.occupation ? `**Yrke:** ${rest.occupation}` : null,
    rest.story ? `\n### Berättelse\n${rest.story}` : null,
    '',
    '---',
    '```json',
    JSON.stringify(req.body, null, 2),
    '```',
  ].filter(Boolean).join('\n')

  try {
    const response = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          body,
          labels: ['bidrag'],
        }),
      },
    )

    if (!response.ok) {
      const errorData = await response.json()
      console.error('GitHub API error:', errorData)
      return res.status(500).json({ error: 'Kunde inte skicka bidraget.' })
    }

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('Error creating issue:', error)
    return res.status(500).json({ error: 'Nätverksfel. Försök igen.' })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add api/submit-contribution.ts
git commit -m "feat: add Vercel serverless function for GitHub Issue contributions"
```

---

## Chunk 4: Search, Gallery & Minimap

### Task 15: Build useSearch hook

**Files:**
- Create: `src/hooks/useSearch.ts`
- Create: `src/hooks/useSearch.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/hooks/useSearch.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { searchPersons } from '../hooks/useSearch'
import type { Person } from '../types'

const persons: Person[] = [
  { id: 'jens', firstName: 'Jens', lastName: 'Andersson', birthName: null, birthDate: null, birthPlace: 'Göteborg', deathDate: null, deathPlace: null, gender: 'male', occupation: 'Ingenjör', photos: [], stories: [], contactInfo: null, familySide: 'center' },
  { id: 'klara', firstName: 'Klara', lastName: 'Lindqvist', birthName: null, birthDate: null, birthPlace: 'Stockholm', deathDate: null, deathPlace: null, gender: 'female', occupation: 'Läkare', photos: [], stories: [], contactInfo: null, familySide: 'center' },
  { id: 'erik', firstName: 'Erik', lastName: 'Andersson', birthName: null, birthDate: null, birthPlace: 'Göteborg', deathDate: null, deathPlace: null, gender: 'male', occupation: 'Snickare', photos: [], stories: [], contactInfo: null, familySide: 'jens' },
]

describe('searchPersons', () => {
  it('matches by first name (case insensitive)', () => {
    const result = searchPersons(persons, 'jens')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('jens')
  })

  it('matches by last name', () => {
    const result = searchPersons(persons, 'andersson')
    expect(result).toHaveLength(2)
  })

  it('matches by birth place', () => {
    const result = searchPersons(persons, 'göteborg')
    expect(result).toHaveLength(2)
  })

  it('matches by occupation', () => {
    const result = searchPersons(persons, 'snickare')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('erik')
  })

  it('returns empty array for no match', () => {
    expect(searchPersons(persons, 'xyz')).toHaveLength(0)
  })

  it('returns all for empty query', () => {
    expect(searchPersons(persons, '')).toHaveLength(3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useSearch.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement useSearch**

Create `src/hooks/useSearch.ts`:
```ts
import { useState, useMemo } from 'react'
import type { Person } from '../types'

export function searchPersons(persons: Person[], query: string): Person[] {
  if (!query.trim()) return persons

  const lower = query.toLowerCase()
  return persons.filter((p) =>
    p.firstName.toLowerCase().includes(lower) ||
    p.lastName.toLowerCase().includes(lower) ||
    (p.birthPlace?.toLowerCase().includes(lower) ?? false) ||
    (p.occupation?.toLowerCase().includes(lower) ?? false)
  )
}

export function useSearch(persons: Person[]) {
  const [query, setQuery] = useState('')
  const results = useMemo(() => searchPersons(persons, query), [persons, query])
  return { query, setQuery, results }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useSearch.test.ts`
Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSearch.ts src/hooks/useSearch.test.ts
git commit -m "feat: add useSearch hook with substring matching"
```

---

### Task 16: Build SearchView

**Files:**
- Create: `src/components/Search/SearchView.tsx`
- Create: `src/components/Search/SearchView.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/Search/SearchView.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { SearchView } from './SearchView'
import type { Person } from '../../types'

const persons: Person[] = [
  { id: 'jens', firstName: 'Jens', lastName: 'Andersson', birthName: null, birthDate: '1995-03-12', birthPlace: 'Göteborg', deathDate: null, deathPlace: null, gender: 'male', occupation: 'Ingenjör', photos: [], stories: [], contactInfo: null, familySide: 'center' },
  { id: 'klara', firstName: 'Klara', lastName: 'Lindqvist', birthName: null, birthDate: '1996-07-20', birthPlace: 'Stockholm', deathDate: null, deathPlace: null, gender: 'female', occupation: null, photos: [], stories: [], contactInfo: null, familySide: 'center' },
]

describe('SearchView', () => {
  it('renders search field', () => {
    render(
      <MemoryRouter>
        <SearchView persons={persons} />
      </MemoryRouter>
    )
    expect(screen.getByPlaceholderText('Sök på namn, plats, yrke...')).toBeInTheDocument()
  })

  it('filters results on input', () => {
    render(
      <MemoryRouter>
        <SearchView persons={persons} />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByPlaceholderText('Sök på namn, plats, yrke...'), {
      target: { value: 'Jens' },
    })

    expect(screen.getByText('Jens Andersson')).toBeInTheDocument()
    expect(screen.queryByText('Klara Lindqvist')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Search/SearchView.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement SearchView**

Create `src/components/Search/SearchView.tsx`:
```tsx
import { Link } from 'react-router-dom'
import { useSearch } from '../../hooks/useSearch'
import { formatLifespan, getInitials } from '../../utils/formatPerson'
import type { Person } from '../../types'

interface Props {
  persons: Person[]
}

export function SearchView({ persons }: Props) {
  const { query, setQuery, results } = useSearch(persons)

  return (
    <div className="flex-1 p-6 max-w-2xl mx-auto">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Sök på namn, plats, yrke..."
        className="w-full px-4 py-3 text-base font-sans border border-bg-secondary rounded-lg bg-white text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent mb-6"
        autoFocus
      />

      <div className="flex flex-col gap-2">
        {results.map((person) => (
          <Link
            key={person.id}
            to={`/person/${person.id}`}
            className="flex items-center gap-3 p-3 bg-card-bg border-l-2 border-card-border rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="w-10 h-10 rounded-full bg-bg-secondary border border-card-border flex items-center justify-center flex-shrink-0">
              <span className="text-accent font-sans text-sm font-semibold">
                {getInitials(person.firstName, person.lastName)}
              </span>
            </div>
            <div>
              <div className="font-serif font-semibold text-text-primary">
                {person.firstName} {person.lastName}
              </div>
              <div className="text-sm font-sans text-text-secondary">
                {formatLifespan(person.birthDate, person.deathDate, person.birthPlace, person.deathPlace)}
                {person.occupation && ` · ${person.occupation}`}
              </div>
            </div>
          </Link>
        ))}
        {query && results.length === 0 && (
          <p className="text-text-secondary font-sans text-center py-8">
            Inga resultat för "{query}"
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Search/SearchView.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/Search/
git commit -m "feat: add SearchView with live substring filtering"
```

---

### Task 17: Build GalleryView

**Files:**
- Create: `src/components/Gallery/GalleryView.tsx`
- Create: `src/components/Gallery/GalleryView.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/Gallery/GalleryView.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { GalleryView } from './GalleryView'
import type { Person } from '../../types'

const persons: Person[] = [
  { id: 'jens', firstName: 'Jens', lastName: 'Andersson', birthName: null, birthDate: null, birthPlace: null, deathDate: null, deathPlace: null, gender: 'male', occupation: null, photos: ['photos/jens-1.jpg', 'photos/jens-2.jpg'], stories: [], contactInfo: null, familySide: 'center' },
  { id: 'erik', firstName: 'Erik', lastName: 'Andersson', birthName: null, birthDate: null, birthPlace: null, deathDate: null, deathPlace: null, gender: 'male', occupation: null, photos: ['photos/erik-1.jpg'], stories: [], contactInfo: null, familySide: 'jens' },
  { id: 'klara', firstName: 'Klara', lastName: 'Lindqvist', birthName: null, birthDate: null, birthPlace: null, deathDate: null, deathPlace: null, gender: 'female', occupation: null, photos: [], stories: [], contactInfo: null, familySide: 'center' },
]

describe('GalleryView', () => {
  it('renders photos from all persons', () => {
    render(
      <MemoryRouter>
        <GalleryView persons={persons} />
      </MemoryRouter>
    )

    const images = screen.getAllByRole('img')
    expect(images).toHaveLength(3) // 2 from jens + 1 from erik
  })

  it('filters by family side', () => {
    render(
      <MemoryRouter>
        <GalleryView persons={persons} />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByText('Jens sida'))

    const images = screen.getAllByRole('img')
    // jens is 'center' so filter 'jens' shows only erik's photo
    expect(images).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Gallery/GalleryView.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement GalleryView**

Create `src/components/Gallery/GalleryView.tsx`:
```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Person } from '../../types'

interface Props {
  persons: Person[]
}

type Filter = 'all' | 'jens' | 'klara'

export function GalleryView({ persons }: Props) {
  const [filter, setFilter] = useState<Filter>('all')

  const photos = persons
    .filter((p) => {
      if (filter === 'all') return true
      return p.familySide === filter
    })
    .flatMap((p) =>
      p.photos.map((photo) => ({
        src: `/${photo}`,
        person: p,
      }))
    )

  const filterClass = (f: Filter) =>
    `text-sm font-sans px-3 py-1 rounded transition-colors ${
      filter === f
        ? 'bg-accent text-white'
        : 'text-text-secondary hover:bg-bg-secondary'
    }`

  return (
    <div className="flex-1 p-6">
      {/* Filters */}
      <div className="flex gap-2 mb-6 justify-center">
        <button className={filterClass('all')} onClick={() => setFilter('all')}>Alla</button>
        <button className={filterClass('jens')} onClick={() => setFilter('jens')}>Jens sida</button>
        <button className={filterClass('klara')} onClick={() => setFilter('klara')}>Klaras sida</button>
      </div>

      {/* Photo grid */}
      {photos.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {photos.map(({ src, person }, i) => (
            <Link
              key={`${person.id}-${i}`}
              to={`/person/${person.id}`}
              className="group relative aspect-square overflow-hidden rounded-lg border border-card-border"
            >
              <img src={src} alt={person.firstName} className="w-full h-full object-cover" />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white text-sm font-sans">{person.firstName} {person.lastName}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-text-secondary font-sans text-center py-8">
          Inga foton att visa.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Gallery/GalleryView.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/Gallery/
git commit -m "feat: add GalleryView with family side filter"
```

---

### Task 18: Build Minimap

**Files:**
- Create: `src/components/Tree/Minimap.tsx`
- Create: `src/components/Tree/Minimap.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/Tree/Minimap.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Minimap } from './Minimap'
import type { LayoutNode } from './TreeLayout'

describe('Minimap', () => {
  it('renders an svg with nodes and viewport rectangle', () => {
    const nodes: LayoutNode[] = [
      { personId: 'a', person: {} as any, x: 0, y: 0, links: [] },
      { personId: 'b', person: {} as any, x: 200, y: 0, links: [] },
    ]

    const { container } = render(
      <Minimap
        nodes={nodes}
        viewportX={0}
        viewportY={0}
        viewportWidth={800}
        viewportHeight={600}
        scale={1}
      />
    )

    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    // Should have circles for nodes + rect for viewport
    const circles = container.querySelectorAll('circle')
    expect(circles.length).toBe(2)
    const rects = container.querySelectorAll('rect')
    expect(rects.length).toBeGreaterThanOrEqual(1) // viewport rect
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Tree/Minimap.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement Minimap**

Create `src/components/Tree/Minimap.tsx`:
```tsx
import type { LayoutNode } from './TreeLayout'

interface Props {
  nodes: LayoutNode[]
  viewportX: number
  viewportY: number
  viewportWidth: number
  viewportHeight: number
  scale: number
}

const MINIMAP_WIDTH = 160
const MINIMAP_HEIGHT = 100

export function Minimap({ nodes, viewportX, viewportY, viewportWidth, viewportHeight, scale }: Props) {
  if (nodes.length === 0) return null

  // Compute bounds of all nodes
  const xs = nodes.map(n => n.x)
  const ys = nodes.map(n => n.y)
  const minX = Math.min(...xs) - 100
  const maxX = Math.max(...xs) + 100
  const minY = Math.min(...ys) - 100
  const maxY = Math.max(...ys) + 100

  const treeWidth = maxX - minX
  const treeHeight = maxY - minY

  const scaleX = MINIMAP_WIDTH / treeWidth
  const scaleY = MINIMAP_HEIGHT / treeHeight
  const s = Math.min(scaleX, scaleY)

  // Map viewport to minimap coordinates
  const vpX = (-viewportX / scale - minX) * s
  const vpY = (-viewportY / scale - minY) * s
  const vpW = (viewportWidth / scale) * s
  const vpH = (viewportHeight / scale) * s

  return (
    <div className="absolute bottom-4 right-4 bg-card-bg/90 border border-bg-secondary rounded-lg shadow-md p-1">
      <svg width={MINIMAP_WIDTH} height={MINIMAP_HEIGHT}>
        {/* Node dots */}
        {nodes.map((node) => (
          <circle
            key={node.personId}
            cx={(node.x - minX) * s}
            cy={(node.y - minY) * s}
            r={3}
            fill="#6b8f71"
            opacity={0.6}
          />
        ))}

        {/* Viewport rectangle */}
        <rect
          x={vpX}
          y={vpY}
          width={Math.max(vpW, 10)}
          height={Math.max(vpH, 10)}
          fill="none"
          stroke="#3a3a3a"
          strokeWidth={1}
          opacity={0.5}
        />
      </svg>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Tree/Minimap.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/Tree/Minimap.tsx src/components/Tree/Minimap.test.tsx
git commit -m "feat: add Minimap component showing tree silhouette and viewport"
```

---

## Chunk 5: Integration & Polish

### Task 19: Wire all views into App

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace all placeholder pages with real components**

Update `src/App.tsx` to import and use `SearchView`, `GalleryView`, and integrate expanded cards and add forms into `TreePage`:

```tsx
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom'
import { useState, useMemo } from 'react'
import { FamilyDataProvider, useFamilyData } from './contexts/FamilyDataContext'
import { Header } from './components/Layout/Header'
import { TreeView } from './components/Tree/TreeView'
import { PersonCardExpanded } from './components/PersonCard/PersonCardExpanded'
import { AddPersonForm, type AddPersonData } from './components/AddForm/AddPersonForm'
import { SearchView } from './components/Search/SearchView'
import { GalleryView } from './components/Gallery/GalleryView'
import { buildFamilyGraph } from './utils/buildTree'
import { getRelationLabel } from './utils/formatPerson'

function TreePage() {
  const { id } = useParams()
  const { persons, relationships, loading, error } = useFamilyData()
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null)
  const [addFormState, setAddFormState] = useState<{ relationType: string; relatedToId: string } | null>(null)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')

  if (loading) return <div className="flex-1 flex items-center justify-center font-sans text-text-secondary">Laddar...</div>
  if (error) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3">
      <p className="font-sans text-red-600">{error}</p>
      <button onClick={() => window.location.reload()} className="font-sans text-sm text-accent hover:underline">Försök igen</button>
    </div>
  )
  if (persons.length === 0) return <div className="flex-1 flex items-center justify-center font-sans text-text-secondary">Inga personer ännu</div>

  const centerId = id ?? 'jens'
  const graph = useMemo(() => buildFamilyGraph(persons, relationships), [persons, relationships])
  const expandedPerson = persons.find(p => p.id === expandedPersonId)

  async function handleFormSubmit(data: AddPersonData) {
    setSubmitStatus('sending')
    try {
      const res = await fetch('/api/submit-contribution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, relatedToId: addFormState?.relatedToId }),
      })
      if (!res.ok) throw new Error()
      setSubmitStatus('success')
      setAddFormState(null)
      setTimeout(() => setSubmitStatus('idle'), 3000)
    } catch {
      setSubmitStatus('error')
      setTimeout(() => setSubmitStatus('idle'), 3000)
    }
  }

  return (
    <div className="flex-1 relative" onClick={() => { setExpandedPersonId(null); setAddFormState(null) }}>
      <TreeView
        persons={persons}
        relationships={relationships}
        centerId={centerId}
        onPersonClick={(pid) => {
          setExpandedPersonId(prev => prev === pid ? null : pid)
          setAddFormState(null)
        }}
        expandedPersonId={expandedPersonId}
      />

      {/* Expanded person card overlay */}
      {expandedPerson && (
        <div className="absolute top-4 left-4 z-10" onClick={(e) => e.stopPropagation()}>
          <PersonCardExpanded
            person={expandedPerson}
            relationLabel={getRelationLabel(graph, expandedPerson.id, persons)}
            onClose={() => setExpandedPersonId(null)}
            onEdit={() => {
              setAddFormState({ relationType: 'edit', relatedToId: expandedPerson.id })
              setExpandedPersonId(null)
            }}
          />
        </div>
      )}

      {/* Add form overlay */}
      {addFormState && (
        <div className="absolute top-4 left-4 z-10" onClick={(e) => e.stopPropagation()}>
          <AddPersonForm
            relationType={addFormState.relationType}
            onSubmit={handleFormSubmit}
            onCancel={() => setAddFormState(null)}
          />
        </div>
      )}

      {/* Status toast */}
      {submitStatus === 'success' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-accent text-white font-sans text-sm px-4 py-2 rounded-lg shadow-md">
          Tack! Ditt bidrag har skickats.
        </div>
      )}
      {submitStatus === 'error' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-600 text-white font-sans text-sm px-4 py-2 rounded-lg shadow-md">
          Något gick fel. Försök igen.
        </div>
      )}
    </div>
  )
}

function SearchPage() {
  const { persons } = useFamilyData()
  return <SearchView persons={persons} />
}

function GalleryPage() {
  const { persons } = useFamilyData()
  return <GalleryView persons={persons} />
}

export default function App() {
  return (
    <BrowserRouter>
      <FamilyDataProvider>
        <div className="flex flex-col h-screen bg-bg-primary font-sans text-text-primary">
          <Header />
          <Routes>
            <Route path="/" element={<TreePage />} />
            <Route path="/person/:id" element={<TreePage />} />
            <Route path="/sok" element={<SearchPage />} />
            <Route path="/galleri" element={<GalleryPage />} />
          </Routes>
        </div>
      </FamilyDataProvider>
    </BrowserRouter>
  )
}
```

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 3: Verify visually**

Run: `npm run dev`
Expected:
- Tree view renders with sample data, pan/zoom works
- Clicking a person shows expanded card
- Search page filters persons
- Gallery shows "Inga foton" (no photos in sample data yet)
- Navigation between views works

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire all views into App with routing, overlays, and status toasts"
```

---

### Task 20: Add "+" buttons to tree nodes

**Files:**
- Modify: `src/components/PersonCard/PersonCardMini.tsx`
- Modify: `src/components/Tree/TreeView.tsx`

- [ ] **Step 1: Add plus buttons to PersonCardMini**

Update `PersonCardMini` to accept an `onAdd` callback and render "+" circles around the card:

```tsx
// Add to Props:
onAdd?: (relationType: string) => void

// Add after the closing </g> of the main card (inside the outer <g>):
{onAdd && (
  <>
    {/* Add parent (left/right depending on side) */}
    <g transform={`translate(${-16}, ${CARD_HEIGHT / 2 - 10})`} onClick={(e) => { e.stopPropagation(); onAdd('parent') }} style={{ cursor: 'pointer' }}>
      <circle r={10} fill="#6b8f71" opacity={0.8} />
      <text textAnchor="middle" dy={4} fill="white" fontSize={14} fontFamily="sans-serif">+</text>
    </g>
    {/* Add sibling (below) */}
    <g transform={`translate(${CARD_WIDTH / 2}, ${CARD_HEIGHT + 10})`} onClick={(e) => { e.stopPropagation(); onAdd('sibling') }} style={{ cursor: 'pointer' }}>
      <circle r={10} fill="#6b8f71" opacity={0.8} />
      <text textAnchor="middle" dy={4} fill="white" fontSize={14} fontFamily="sans-serif">+</text>
    </g>
    {/* Add partner (right) */}
    <g transform={`translate(${CARD_WIDTH + 16}, ${CARD_HEIGHT / 2 - 10})`} onClick={(e) => { e.stopPropagation(); onAdd('partner') }} style={{ cursor: 'pointer' }}>
      <circle r={10} fill="#c4a77d" opacity={0.8} />
      <text textAnchor="middle" dy={4} fill="white" fontSize={14} fontFamily="sans-serif">+</text>
    </g>
  </>
)}
```

- [ ] **Step 2: Pass onAdd through TreeView**

Update `TreeView` props to include `onAdd: (personId: string, relationType: string) => void` and pass it through to each `PersonCardMini`.

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/PersonCard/PersonCardMini.tsx src/components/Tree/TreeView.tsx
git commit -m "feat: add '+' buttons to tree nodes for adding family members"
```

---

### Task 21: Final integration test and polish

**Files:**
- Modify: various for minor fixes

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors

- [ ] **Step 3: Test production build locally**

Run: `npm run preview`
Expected: Site works in preview mode

- [ ] **Step 4: Add vercel.json for SPA routing**

Create `vercel.json`:
```json
{
  "rewrites": [
    { "source": "/((?!api|data|photos).*)", "destination": "/" }
  ]
}
```

- [ ] **Step 5: Create .env.example**

Create `.env.example`:
```
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_REPO_OWNER=your_github_username
GITHUB_REPO_NAME=family
```

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: add Vercel config, env example, and final polish"
```

---

## Summary

| Chunk | Tasks | What it delivers |
|-------|-------|-----------------|
| 1: Scaffold & Data | 1-6 | Working project with types, sample data, data context, graph utils, format helpers |
| 2: Layout & Tree | 7-11 | Header, routing, D3 tree view with pan/zoom and person cards |
| 3: Cards & Forms | 12-14 | Expanded person cards, add person form, serverless GitHub Issue function |
| 4: Search & Gallery | 15-18 | Search view, gallery view, minimap |
| 5: Integration | 19-21 | Everything wired together, "+" buttons, build verified, Vercel config |
