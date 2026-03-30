import type { Person } from '../../types'

interface Props {
  person: Person
  isCenter?: boolean
  isExpanded?: boolean
  onExpand?: () => void
  onNavigate?: () => void
  onShowInfo?: () => void
  onAddRelative?: () => void
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

export function PersonCard({ person, isCenter, isExpanded, onExpand, onNavigate, onShowInfo, onAddRelative }: Props) {
  const hasPhoto = person.photos.length > 0

  const sizeClasses = isCenter ? 'w-36 sm:w-44' : 'w-28 sm:w-36'

  return (
    <div
      className={`card-flip-container ${sizeClasses} ${isExpanded ? 'z-30' : ''}`}
      data-expanded-card={isExpanded || undefined}
    >
      <div className={`card-flip-inner ${isExpanded ? 'flipped' : ''}`}>
        {/* === FRONT FACE === */}
        <div
          className={`
            card-face flex flex-col items-center gap-1 p-2 sm:p-3 rounded-xl border sm:border-2 bg-card-bg
            transition-all duration-200 cursor-pointer ${sizeClasses}
            ${isCenter
              ? 'border-accent shadow-md'
              : 'border-card-border/40 hover:shadow-md hover:-translate-y-0.5 hover:border-accent'
            }
          `}
          onClick={(e) => { e.stopPropagation(); onExpand?.() }}
        >
          {/* Photo or initials */}
          <div className={`
            rounded-full flex items-center justify-center border-2 border-accent/60 overflow-hidden shrink-0
            ${isCenter ? 'w-9 h-9 sm:w-11 sm:h-11 text-base' : 'w-6 h-6 sm:w-8 sm:h-8 text-xs'}
          `}>
            {hasPhoto ? (
              <img src={person.photos[0]} alt={person.firstName} className="w-full h-full object-cover" />
            ) : (
              <span className="font-sans text-accent font-medium">{getInitials(person)}</span>
            )}
          </div>

          {/* Name */}
          <div className="text-center leading-tight">
            <div className={`font-serif font-semibold text-text-primary truncate ${isCenter ? 'text-sm' : 'text-xs'}`}>
              {person.firstName}
            </div>
            <div className={`font-serif text-text-secondary ${isCenter ? 'text-xs' : 'text-[10px]'}`}>
              {person.lastName}
              {isCenter && person.birthName && (
                <span className="text-text-secondary/70"> (f. {person.birthName})</span>
              )}
            </div>
          </div>

          {/* Years */}
          <div className={`font-sans text-text-secondary ${isCenter ? 'text-[11px]' : 'text-[10px]'}`}>
            {formatYears(person)}
          </div>
        </div>

        {/* === BACK FACE (action buttons) === */}
        <div
          className={`
            card-face-back absolute inset-0 flex flex-col items-stretch justify-center gap-1.5 p-2
            rounded-xl border sm:border-2 border-accent bg-card-bg shadow-lg ${sizeClasses}
          `}
        >
          {!isCenter && onNavigate && (
            <button
              onClick={(e) => { e.stopPropagation(); onNavigate() }}
              className="bg-accent hover:bg-accent-dark text-white font-sans text-[11px] sm:text-xs font-medium
                         py-1.5 px-2 rounded-lg transition-colors duration-150 cursor-pointer leading-tight"
            >
              Visa släktträd
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onShowInfo?.() }}
            className="bg-accent hover:bg-accent-dark text-white font-sans text-[11px] sm:text-xs font-medium
                       py-1.5 px-2 rounded-lg transition-colors duration-150 cursor-pointer leading-tight"
          >
            Visa information
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onAddRelative?.() }}
            className="bg-accent hover:bg-accent-dark text-white font-sans text-[11px] sm:text-xs font-medium
                       py-1.5 px-2 rounded-lg transition-colors duration-150 cursor-pointer leading-tight"
          >
            Lägg till släkting
          </button>
        </div>
      </div>
    </div>
  )
}
