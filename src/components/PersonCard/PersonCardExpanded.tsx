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

      {person.occupation && (
        <p className="text-sm font-sans text-text-primary mb-2">{person.occupation}</p>
      )}

      {relationLabel && (
        <p className="text-xs font-sans text-accent mb-3">{relationLabel}</p>
      )}

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
