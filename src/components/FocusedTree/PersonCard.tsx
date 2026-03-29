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

  return (
    <div className="relative group">
      {/* Card — tap always opens info */}
      <div
        className={`
          flex flex-col items-center gap-1 p-2 sm:p-3 rounded-xl border sm:border-2 bg-card-bg
          transition-all duration-200 cursor-pointer
          ${isCenter
            ? 'border-accent shadow-md w-36 sm:w-44 min-h-0'
            : 'border-card-border/40 w-28 sm:w-36 min-h-0 hover:shadow-md hover:-translate-y-0.5 hover:border-accent'
          }
        `}
        onClick={() => onShowInfo?.()}
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

      {/* Navigate button — non-center cards only */}
      {!isCenter && onNavigate && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate() }}
          className="absolute -top-2 -right-2 w-7 h-7 sm:w-6 sm:h-6 rounded-full bg-card-bg border border-card-border/60
                     flex items-center justify-center shadow-sm
                     text-accent text-xs sm:text-[10px] font-sans font-bold leading-none
                     opacity-60 sm:opacity-0 sm:group-hover:opacity-100
                     hover:bg-accent hover:text-white hover:border-accent
                     active:scale-90 transition-all duration-150 cursor-pointer"
          title="Centrera"
          aria-label="Centrera denna person"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5 sm:w-3 sm:h-3">
            <circle cx="8" cy="8" r="3" />
            <line x1="8" y1="0.5" x2="8" y2="4" />
            <line x1="8" y1="12" x2="8" y2="15.5" />
            <line x1="0.5" y1="8" x2="4" y2="8" />
            <line x1="12" y1="8" x2="15.5" y2="8" />
          </svg>
        </button>
      )}
    </div>
  )
}
