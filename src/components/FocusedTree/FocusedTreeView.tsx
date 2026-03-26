import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { PersonCard } from './PersonCard'
import type { Person, Relationship } from '../../types'
import { buildFamilyGraph, getParents, getChildren, getSiblings, getPartners } from '../../utils/buildTree'
import type { FamilyGraph } from '../../utils/buildTree'

interface Props {
  persons: Person[]
  relationships: Relationship[]
  centerId: string
  onPersonClick: (personId: string) => void
}

// Max generations to show below center (center's children + grandchildren)
const MAX_DESCENDANT_GENS = 2

/**
 * Collect the ancestor chain upward from a person.
 * Returns an array of couples (person + partner), oldest first.
 * No siblings — just the direct line.
 */
function collectAncestorChain(personId: string, graph: FamilyGraph): { person: Person; partner: Person | null }[] {
  const chain: { person: Person; partner: Person | null }[] = []
  let currentId = personId

  while (true) {
    const parents = getParents(graph, currentId)
    if (parents.length === 0) break

    const parent = parents[0]
    const otherParent = parents[1] ?? null
    // Use the parent that has the most ancestors as the "main" line
    // (or just the first one if equal)
    chain.push({ person: parent, partner: otherParent })
    currentId = parent.id
  }

  return chain.reverse() // oldest first
}

/**
 * Collect descendant generations below a person.
 * Returns arrays of children per generation, max `maxGens` levels deep.
 * Only follows the CENTER person's direct children, not siblings' children.
 */
function collectDescendantGens(
  personId: string,
  graph: FamilyGraph,
  partners: Person[],
  maxGens: number,
): Person[][] {
  const result: Person[][] = []
  let currentParentIds = [personId, ...partners.map(p => p.id)]

  for (let gen = 0; gen < maxGens; gen++) {
    const childSet = new Set<string>()
    const children: Person[] = []

    for (const pid of currentParentIds) {
      for (const child of getChildren(graph, pid)) {
        if (!childSet.has(child.id)) {
          childSet.add(child.id)
          children.push(child)
        }
      }
    }

    if (children.length === 0) break
    result.push(children)

    // Next generation: all these children become parents
    currentParentIds = children.map(c => c.id)
    // Also include their partners
    for (const child of children) {
      for (const cp of getPartners(graph, child.id)) {
        if (!currentParentIds.includes(cp.id)) currentParentIds.push(cp.id)
      }
    }
  }

  return result
}

export function FocusedTreeView({ persons, relationships, centerId, onPersonClick }: Props) {
  const navigate = useNavigate()
  const graph = useMemo(() => buildFamilyGraph(persons, relationships), [persons, relationships])

  const center = persons.find(p => p.id === centerId)
  if (!center) {
    return <div className="flex-1 flex items-center justify-center font-sans text-text-secondary">Personen hittades inte</div>
  }

  const partners = getPartners(graph, centerId)
  const siblings = getSiblings(graph, centerId)
  const partnerSiblings = partners.flatMap(p =>
    getSiblings(graph, p.id).filter(s => s.id !== centerId)
  )

  // Collect ancestors for each parent separately (both sides)
  const parents = getParents(graph, centerId)
  const parentPairs: { person: Person; partner: Person | null }[] = []
  if (parents.length >= 2) {
    // Show both parent pairs separately
    const p0partner = getPartners(graph, parents[0].id).find(p => p.id === parents[1].id) ? parents[1] : null
    if (p0partner) {
      // Parents are partners — show as one pair
      parentPairs.push({ person: parents[0], partner: p0partner })
    } else {
      parentPairs.push({ person: parents[0], partner: getPartners(graph, parents[0].id)[0] ?? null })
      parentPairs.push({ person: parents[1], partner: getPartners(graph, parents[1].id)[0] ?? null })
    }
  } else if (parents.length === 1) {
    parentPairs.push({ person: parents[0], partner: getPartners(graph, parents[0].id)[0] ?? null })
  }

  // Build two ancestor lines (paternal + maternal)
  const paternalChain = parents[0] ? collectAncestorChain(parents[0].id, graph) : []
  const maternalChain = parents[1] ? collectAncestorChain(parents[1].id, graph) : []

  // Merge chains into rows: zip the two chains, longest first
  const maxChainLen = Math.max(paternalChain.length, maternalChain.length)

  // Descendants: center's children + grandchildren (max 2 gen)
  const descendantGens = collectDescendantGens(centerId, graph, partners, MAX_DESCENDANT_GENS)

  // Context links beyond the visible window
  const deepestDescendants = descendantGens.length === MAX_DESCENDANT_GENS
    ? descendantGens[descendantGens.length - 1].flatMap(c => getChildren(graph, c.id))
    : []

  // Partner's parents (context link if not showing ancestors for them)
  const partnerParentLinks = partners.flatMap(p => getParents(graph, p.id))

  function handleNav(id: string) {
    navigate(`/person/${id}`)
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="flex flex-col items-center gap-1 py-6 px-4 min-h-full">

        {/* === ANCESTORS (slim: just couples, no siblings) === */}
        {Array.from({ length: maxChainLen }).map((_, i) => {
          const patIdx = i - (maxChainLen - paternalChain.length)
          const matIdx = i - (maxChainLen - maternalChain.length)
          const patCouple = patIdx >= 0 ? paternalChain[patIdx] : null
          const matCouple = matIdx >= 0 ? maternalChain[matIdx] : null

          return (
            <div key={`anc-${i}`} className="flex flex-col items-center gap-1">
              {i > 0 && <div className="w-px h-4 bg-card-border/30" />}
              <div className="flex items-center gap-8">
                {patCouple && (
                  <CoupleRow
                    person={patCouple.person}
                    partner={patCouple.partner}
                    onNav={handleNav} onInfo={onPersonClick}
                  />
                )}
                {matCouple && patCouple && <div className="w-4" />}
                {matCouple && (
                  <CoupleRow
                    person={matCouple.person}
                    partner={matCouple.partner}
                    onNav={handleNav} onInfo={onPersonClick}
                  />
                )}
              </div>
            </div>
          )
        })}

        {/* Parents row (direct parents, no siblings) */}
        {parentPairs.length > 0 && (
          <>
            <div className="w-px h-4 bg-card-border/30" />
            <div className="flex items-center gap-8">
              {parentPairs.map((pp) => (
                <CoupleRow
                  key={pp.person.id}
                  person={pp.person}
                  partner={pp.partner}
                  onNav={handleNav} onInfo={onPersonClick}
                />
              ))}
            </div>
          </>
        )}

        {/* Connector to center */}
        {parents.length > 0 && <div className="w-px h-5 bg-card-border/40" />}

        {/* === CENTER ROW (with siblings) === */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center">
          {siblings.map(sib => (
            <PersonCard key={sib.id} person={sib} onNavigate={() => handleNav(sib.id)} onShowInfo={() => onPersonClick(sib.id)} />
          ))}

          <div className="flex items-center gap-2">
            <PersonCard person={center} isCenter onShowInfo={() => onPersonClick(centerId)} />
            {partners.map(p => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="text-accent font-sans text-lg font-light">+</span>
                <PersonCard person={p} onNavigate={() => handleNav(p.id)} onShowInfo={() => onPersonClick(p.id)} />
              </div>
            ))}
          </div>

          {partnerSiblings.map(ps => (
            <PersonCard key={ps.id} person={ps} onNavigate={() => handleNav(ps.id)} onShowInfo={() => onPersonClick(ps.id)} />
          ))}
        </div>

        {/* Partner's parents context */}
        {partnerParentLinks.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="font-sans text-xs text-text-secondary mr-1">
              {partners[0]?.firstName}s föräldrar:
            </span>
            {partnerParentLinks.map(pp => (
              <button key={pp.id} onClick={() => handleNav(pp.id)}
                className="font-sans text-xs text-accent hover:underline cursor-pointer">
                {pp.firstName}
              </button>
            ))}
          </div>
        )}

        {/* === DESCENDANTS (center's children + grandchildren) === */}
        {descendantGens.map((gen, genIdx) => (
          <div key={`desc-${genIdx}`} className="flex flex-col items-center gap-1">
            <div className="w-px h-5 bg-card-border/40" />
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center">
              {gen.map(child => (
                <PersonCard key={child.id} person={child} onNavigate={() => handleNav(child.id)} onShowInfo={() => onPersonClick(child.id)} />
              ))}
            </div>
          </div>
        ))}

        {/* Context links below (beyond max descendant gens) */}
        {deepestDescendants.length > 0 && (
          <>
            <div className="w-px h-3 bg-card-border/30" />
            <div className="flex gap-4 flex-wrap justify-center">
              {deepestDescendants.map(p => (
                <button key={p.id} onClick={() => handleNav(p.id)}
                  className="font-sans text-xs text-accent hover:underline cursor-pointer">
                  {p.firstName} {p.lastName}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Empty state */}
        {parents.length === 0 && partners.length === 0 && descendantGens.length === 0 && (
          <p className="font-sans text-sm text-text-secondary mt-4">
            Klicka på {center.firstName} för att lägga till familjemedlemmar.
          </p>
        )}
      </div>
    </div>
  )
}

/** Render a couple (person + optional partner) as a compact row */
function CoupleRow({ person, partner, onNav, onInfo }: {
  person: Person
  partner: Person | null
  onNav: (id: string) => void
  onInfo: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <PersonCard person={person} onNavigate={() => onNav(person.id)} onShowInfo={() => onInfo(person.id)} />
      {partner && (
        <>
          <span className="text-accent/50 font-sans text-lg">+</span>
          <PersonCard person={partner} onNavigate={() => onNav(partner.id)} onShowInfo={() => onInfo(partner.id)} />
        </>
      )}
    </div>
  )
}
