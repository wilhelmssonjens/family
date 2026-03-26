import { useState } from 'react'
import type { Person } from '../../types'

interface Props {
  person: Person
  isCenter?: boolean
  onNavigate?: () => void
  onShowInfo?: () => void
}

function formatYears(person: Person): string {
  const birth = person.birthDate?.slice(0, 4) ?? '?'
  const death = person.deathDate?.slice(0, 4)
  return death ? `${birth}–${death}` : birth
}

function getInitials(person: Person): string {
  const first = person.firstName?.[0] ?? ''
  const last = person.lastName?.[0] ?? ''
  return (first + last).toUpperCase()
}

export function PersonCard({ person, isCenter, onNavigate, onShowInfo }: Props) {
  const hasPhoto = person.photos.length > 0
  const [showActions, setShowActions] = useState(false)

  return (
    <div
      className="relative group"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onTouchStart={() => setShowActions(prev => !prev)}
    >
      {/* Card */}
      <div
        className={`
          flex flex-col items-center gap-1 p-3 rounded-xl border-2 bg-card-bg
          transition-all duration-200 cursor-pointer
          ${isCenter
            ? 'border-accent shadow-md w-44 min-h-28'
            : 'border-card-border/40 w-36 min-h-20 hover:shadow-md hover:-translate-y-0.5 hover:border-accent'
          }
        `}
        onClick={() => {
          // On click: navigate (or show info if center)
          if (isCenter && onShowInfo) onShowInfo()
          else if (onNavigate) onNavigate()
        }}
      >
        {/* Photo or initials */}
        <div className={`
          rounded-full flex items-center justify-center border-2 border-accent/60 overflow-hidden shrink-0
          ${isCenter ? 'w-11 h-11 text-base' : 'w-8 h-8 text-xs'}
        `}>
          {hasPhoto ? (
            <img src={person.photos[0]} alt={person.firstName} className="w-full h-full object-cover" />
          ) : (
            <span className="font-sans text-accent font-medium">{getInitials(person)}</span>
          )}
        </div>

        {/* Name */}
        <div className="text-center leading-tight">
          <div className={`font-serif font-semibold text-text-primary ${isCenter ? 'text-sm' : 'text-xs'}`}>
            {person.firstName}
          </div>
          <div className={`font-serif text-text-secondary ${isCenter ? 'text-xs' : 'text-[10px]'}`}>
            {person.lastName}
            {person.birthName && (
              <span className="text-text-secondary/70"> (f. {person.birthName})</span>
            )}
          </div>
        </div>

        {/* Years */}
        <div className={`font-sans text-text-secondary ${isCenter ? 'text-[11px]' : 'text-[10px]'}`}>
          {formatYears(person)}
        </div>
      </div>

      {/* Action buttons overlay — shown on hover/touch */}
      {showActions && !isCenter && (
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex gap-1 z-10 animate-in whitespace-nowrap">
          {onNavigate && (
            <button
              onClick={(e) => { e.stopPropagation(); onNavigate() }}
              className="bg-card-bg border border-card-border/60 rounded-full px-2 py-0.5 shadow-sm hover:bg-accent hover:text-white transition-colors cursor-pointer font-sans text-[10px] text-text-primary"
            >
              Centrera
            </button>
          )}
          {onShowInfo && (
            <button
              onClick={(e) => { e.stopPropagation(); onShowInfo() }}
              className="bg-card-bg border border-card-border/60 rounded-full px-2 py-0.5 shadow-sm hover:bg-accent hover:text-white transition-colors cursor-pointer font-sans text-[10px] text-text-primary"
            >
              Redigera
            </button>
          )}
        </div>
      )}

      {/* Center card: edit button */}
      {isCenter && onShowInfo && (
        <button
          onClick={(e) => { e.stopPropagation(); onShowInfo() }}
          className="absolute -top-2 -right-2 bg-card-bg border border-card-border/60 rounded-full px-2 py-0.5 shadow-sm hover:bg-accent hover:text-white transition-colors cursor-pointer font-sans text-[10px] text-text-primary opacity-0 group-hover:opacity-100"
        >
          Redigera
        </button>
      )}
    </div>
  )
}
