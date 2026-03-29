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

  return (
    <div className="relative" style={{ width: isCenter ? undefined : '7rem' }}>
      {/* Invisible placeholder keeps layout stable */}
      <div className={`invisible ${isCenter ? 'w-36 sm:w-44' : 'w-28 sm:w-36'}`}
        style={{ height: isCenter ? undefined : 0 }}
      >
        {/* Spacer matching front-face height — only for non-center so flex row keeps its size */}
        {!isCenter && (
          <div className="flex flex-col items-center gap-1 p-2 sm:p-3 rounded-xl border sm:border-2 bg-card-bg w-28 sm:w-36">
            <div className="w-6 h-6 sm:w-8 sm:h-8" />
            <div className="leading-tight"><div className="text-xs">&nbsp;</div><div className="text-[10px]">&nbsp;</div></div>
            <div className="text-[10px]">&nbsp;</div>
          </div>
        )}
      </div>

      {/* Actual card — absolute positioned to overlay without layout shift */}
      <div
        className={`card-flip-container ${isExpanded ? 'z-30' : ''}`}
        style={!isCenter ? {
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        } : undefined}
        data-expanded-card={isExpanded || undefined}
      >
        <div className={`card-flip-inner ${isExpanded ? 'flipped' : ''}`}>
          {/* === FRONT FACE === */}
          <div
            className={`
              card-face flex flex-col items-center gap-1 p-2 sm:p-3 rounded-xl border sm:border-2 bg-card-bg
              transition-all duration-200 cursor-pointer
              ${isCenter
                ? 'border-accent shadow-md w-36 sm:w-44 min-h-0'
                : 'border-card-border/40 w-28 sm:w-36 min-h-0 hover:shadow-md hover:-translate-y-0.5 hover:border-accent'
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
              card-face-back absolute inset-0 flex flex-col items-stretch justify-center gap-2 p-3
              rounded-xl border sm:border-2 border-accent bg-card-bg shadow-lg
              ${isCenter ? 'w-36 sm:w-44' : 'w-28 sm:w-36'}
            `}
          >
            {!isCenter && onNavigate && (
              <button
                onClick={(e) => { e.stopPropagation(); onNavigate() }}
                className="bg-accent hover:bg-accent-dark text-white font-sans text-xs sm:text-sm font-medium
                           py-2 px-2 rounded-lg transition-colors duration-150 cursor-pointer"
              >
                Visa släktträd
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onShowInfo?.() }}
              className="bg-accent hover:bg-accent-dark text-white font-sans text-xs sm:text-sm font-medium
                         py-2 px-2 rounded-lg transition-colors duration-150 cursor-pointer"
            >
              Visa information
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onAddRelative?.() }}
              className="bg-accent hover:bg-accent-dark text-white font-sans text-xs sm:text-sm font-medium
                         py-2 px-2 rounded-lg transition-colors duration-150 cursor-pointer"
            >
              Lägg till släkting
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
