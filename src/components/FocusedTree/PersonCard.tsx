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

        {/* === BACK FACE (action buttons — horizontal icon row) === */}
        <div className="card-face-back absolute inset-0">
          <div className={`
            absolute inset-y-0 -inset-x-3 flex items-center justify-center
            rounded-xl border sm:border-2 border-accent bg-card-bg shadow-lg
          `}>
          <div className={`flex items-start ${isCenter ? 'gap-3' : 'gap-2'} justify-center`}>
            {!isCenter && onNavigate && (
              <button
                onClick={(e) => { e.stopPropagation(); onNavigate() }}
                className="flex flex-col items-center gap-0.5 group/btn cursor-pointer"
                aria-label="Visa släktträd"
              >
                <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-accent group-hover/btn:bg-accent-dark text-white
                               flex items-center justify-center transition-colors duration-150">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 sm:w-4 sm:h-4">
                    <rect x="3" y="3" width="10" height="10" rx="2" /><path d="M10 7h5.5a1.5 1.5 0 0 1 1.5 1.5V17" /><polyline points="13 14 17 17 17 14" />
                  </svg>
                </span>
                <span className="font-sans text-[9px] sm:text-[10px] text-text-secondary leading-tight text-center">Visa<br />släktträd</span>
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onShowInfo?.() }}
              className="flex flex-col items-center gap-0.5 group/btn cursor-pointer"
              aria-label="Visa information"
            >
              <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-accent group-hover/btn:bg-accent-dark text-white
                             flex items-center justify-center transition-colors duration-150">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3.5 h-3.5 sm:w-4 sm:h-4">
                  <circle cx="10" cy="10" r="8" /><line x1="10" y1="9" x2="10" y2="14" /><circle cx="10" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
                </svg>
              </span>
              <span className="font-sans text-[9px] sm:text-[10px] text-text-secondary leading-tight">Info</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onAddRelative?.() }}
              className="flex flex-col items-center gap-0.5 group/btn cursor-pointer"
              aria-label="Lägg till släkting"
            >
              <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-accent group-hover/btn:bg-accent-dark text-white
                             flex items-center justify-center transition-colors duration-150">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3.5 h-3.5 sm:w-4 sm:h-4">
                  <circle cx="8" cy="7" r="3.5" /><path d="M2 17c0-3.3 2.7-6 6-6s6 2.7 6 6" /><line x1="16" y1="8" x2="16" y2="14" /><line x1="13" y1="11" x2="19" y2="11" />
                </svg>
              </span>
              <span className="font-sans text-[9px] sm:text-[10px] text-text-secondary leading-tight text-center">Lägg till<br />släkting</span>
            </button>
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}
