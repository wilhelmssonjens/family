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
