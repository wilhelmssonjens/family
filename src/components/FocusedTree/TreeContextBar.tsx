import { Fragment } from 'react'
import type { Person } from '../../types'
import type { FamilyGraph } from '../../utils/buildTree'
import { getPartners } from '../../utils/buildTree'
import { formatLifespan, getInitials } from '../../utils/formatPerson'
import { useNavTrail } from '../../hooks/useNavTrail'

interface Props {
  persons: Person[]
  graph: FamilyGraph
  centerId: string
  homeId: string
  /** Navigate the tree to a person (homeId means "go home"). */
  onNavigate: (personId: string) => void
  /** Open the detail modal for a person. */
  onShowInfo: (personId: string) => void
}

function photoSrc(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `/${path}`
}

function sideLabel(side: Person['familySide']): string | null {
  if (side === 'jens') return 'Jens sida'
  if (side === 'klara') return 'Klaras sida'
  return null
}

function Avatar({ person, size }: { person: Person; size: 'sm' | 'md' }) {
  const dim = size === 'md' ? 'w-9 h-9 text-sm' : 'w-6 h-6 text-[10px]'
  return (
    <div className={`${dim} rounded-full flex items-center justify-center border border-accent/60 overflow-hidden shrink-0 bg-bg-secondary`}>
      {person.photos.length > 0 ? (
        <img src={photoSrc(person.photos[0])} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="font-sans text-accent font-medium">{getInitials(person.firstName, person.lastName)}</span>
      )}
    </div>
  )
}

export function TreeContextBar({ persons, graph, centerId, homeId, onNavigate, onShowInfo }: Props) {
  const trail = useNavTrail(centerId, homeId)
  const center = persons.find((p) => p.id === centerId)
  if (!center) return null

  const isHome = centerId === homeId
  const homePerson = persons.find((p) => p.id === homeId)
  const homePartner = homePerson ? getPartners(graph, homeId)[0] ?? null : null
  const homeLabel = homePerson
    ? homePartner
      ? `${homePerson.firstName} & ${homePartner.firstName}`
      : homePerson.firstName
    : 'Hem'

  const lifespan = formatLifespan(center.birthDate, center.deathDate, null, null)
  const side = sideLabel(center.familySide)
  const meta = isHome
    ? `${persons.length} personer · klicka på ett kort för att utforska`
    : [lifespan, side].filter(Boolean).join(' · ')

  return (
    <div className="pointer-events-none fixed top-12 sm:top-14 left-0 right-0 z-30 flex flex-col items-center gap-1.5 px-3">
      {/* Focus descriptor pill */}
      <button
        type="button"
        onClick={() => onShowInfo(centerId)}
        className="pointer-events-auto flex items-center gap-2.5 max-w-full px-3 py-1.5 rounded-full
                   bg-card-bg/85 backdrop-blur border border-card-border/40 shadow-sm
                   hover:border-accent/50 transition-colors cursor-pointer text-left"
      >
        <Avatar person={center} size="md" />
        <div className="min-w-0">
          <p className="text-[10px] font-sans text-text-secondary leading-none mb-0.5">
            {isHome ? 'Släktträd' : 'Du tittar på'}
          </p>
          <p className="font-serif font-semibold text-text-primary text-sm leading-tight truncate">
            {isHome ? `${homeLabel}s släktträd` : `${center.firstName} ${center.lastName}`}
          </p>
          {meta && (
            <p className="text-[11px] font-sans text-text-secondary leading-tight truncate">{meta}</p>
          )}
        </div>
      </button>

      {/* Breadcrumb trail — only when navigated away from home */}
      {!isHome && (
        <div className="pointer-events-auto flex items-center gap-1 max-w-full overflow-x-auto px-3 py-1 rounded-full
                        bg-card-bg/70 backdrop-blur border border-card-border/30 text-xs font-sans whitespace-nowrap">
          <button
            type="button"
            onClick={() => onNavigate(homeId)}
            className="text-accent hover:underline cursor-pointer shrink-0"
          >
            {homeLabel}
          </button>
          {trail.map((id, idx) => {
            const person = persons.find((p) => p.id === id)
            if (!person) return null
            const isLast = idx === trail.length - 1
            return (
              <Fragment key={id}>
                <span className="text-text-secondary/50 shrink-0" aria-hidden="true">›</span>
                {isLast ? (
                  <span className="text-text-primary font-medium shrink-0">{person.firstName}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onNavigate(id)}
                    className="text-accent hover:underline cursor-pointer shrink-0"
                  >
                    {person.firstName}
                  </button>
                )}
              </Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}
