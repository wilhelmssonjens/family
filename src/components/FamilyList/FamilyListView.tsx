import { useMemo } from 'react'
import type { Person, Relationship } from '../../types'
import { buildFamilyGraph, getChildren, getPartners } from '../../utils/buildTree'

interface Props {
  persons: Person[]
  relationships: Relationship[]
  onPersonClick: (id: string) => void
}

function formatYear(date: string | null): string {
  if (!date) return '?'
  return date.slice(0, 4)
}

function PersonRow({ person, partners, onPersonClick }: {
  person: Person
  partners: Person[]
  onPersonClick: (id: string) => void
}) {
  const hasPhoto = person.photos.length > 0
  const initials = ((person.firstName?.[0] ?? '') + (person.lastName?.[0] ?? '')).toUpperCase()

  return (
    <div className="flex items-center gap-2 py-1.5">
      {/* Photo/initials */}
      <div className="w-7 h-7 rounded-full border border-accent/40 flex items-center justify-center overflow-hidden shrink-0">
        {hasPhoto ? (
          <img src={person.photos[0]} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="font-sans text-[10px] text-accent">{initials}</span>
        )}
      </div>

      {/* Name */}
      <button
        onClick={() => onPersonClick(person.id)}
        className="font-serif text-sm text-accent hover:underline cursor-pointer text-left"
      >
        {person.firstName} {person.lastName}
      </button>

      {/* Year */}
      <span className="font-sans text-xs text-text-secondary">{formatYear(person.birthDate)}</span>

      {/* Partners */}
      {partners.map(p => (
        <span key={p.id} className="flex items-center gap-1">
          <span className="text-text-secondary text-xs">+</span>
          <button
            onClick={() => onPersonClick(p.id)}
            className="font-serif text-sm text-accent hover:underline cursor-pointer"
          >
            {p.firstName}
          </button>
        </span>
      ))}
    </div>
  )
}

interface TreeItem {
  person: Person
  partners: Person[]
  children: TreeItem[]
}

function TreeBranch({ item, depth, onPersonClick }: {
  item: TreeItem
  depth: number
  onPersonClick: (id: string) => void
}) {
  return (
    <div className={depth > 0 ? 'ml-5 border-l-2 border-bg-secondary pl-3' : ''}>
      <PersonRow
        person={item.person}
        partners={item.partners}
        onPersonClick={onPersonClick}
      />
      {item.children.map(child => (
        <TreeBranch
          key={child.person.id}
          item={child}
          depth={depth + 1}
          onPersonClick={onPersonClick}
        />
      ))}
    </div>
  )
}

export function FamilyListView({ persons, relationships, onPersonClick }: Props) {
  const graph = useMemo(() => buildFamilyGraph(persons, relationships), [persons, relationships])

  // Find root ancestors: persons with no parents and at least one child.
  // Pick one person per couple to avoid duplicating branches.
  const roots = useMemo(() => {
    const rootIds = new Set<string>()
    const skipIds = new Set<string>()

    for (const [, node] of graph) {
      if (node.parentIds.length === 0 && node.childIds.length > 0) {
        rootIds.add(node.person.id)
      }
    }

    // For each root, if their partner is also a root, skip the partner
    const result: Person[] = []
    for (const id of rootIds) {
      if (skipIds.has(id)) continue
      const node = graph.get(id)!
      for (const partnerId of node.partnerIds) {
        if (rootIds.has(partnerId)) skipIds.add(partnerId)
      }
      result.push(node.person)
    }

    return result.sort((a, b) => {
      const order = { jens: 0, center: 1, klara: 2 }
      return (order[a.familySide] ?? 1) - (order[b.familySide] ?? 1)
    })
  }, [graph])

  // Pre-compute the tree structure as pure data to avoid render-time mutation.
  const treeData = useMemo(() => {
    const visited = new Set<string>()

    function buildBranch(personId: string): TreeItem | null {
      if (visited.has(personId)) return null
      visited.add(personId)

      const node = graph.get(personId)
      if (!node) return null

      const person = node.person
      const partners = getPartners(graph, personId)
      const childrenPersons = getChildren(graph, personId)

      // Also include partner's children
      const allChildIds = new Set(childrenPersons.map(c => c.id))
      for (const partner of partners) {
        for (const child of getChildren(graph, partner.id)) {
          if (!allChildIds.has(child.id)) {
            childrenPersons.push(child)
            allChildIds.add(child.id)
          }
        }
      }

      const children = childrenPersons
        .map(c => buildBranch(c.id))
        .filter((b): b is TreeItem => b !== null)

      return { person, partners, children }
    }

    return roots
      .map(r => buildBranch(r.id))
      .filter((b): b is TreeItem => b !== null)
  }, [graph, roots])

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-2xl mx-auto py-6 px-4">
        <h2 className="font-serif text-xl font-semibold text-text-primary mb-4">Hela släkten</h2>
        {treeData.map(item => (
          <TreeBranch key={item.person.id} item={item} depth={0} onPersonClick={onPersonClick} />
        ))}
      </div>
    </div>
  )
}
