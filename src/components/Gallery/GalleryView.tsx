import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Person } from '../../types'

interface Props {
  persons: Person[]
}

type Filter = 'all' | 'jens' | 'klara'

export function GalleryView({ persons }: Props) {
  const [filter, setFilter] = useState<Filter>('all')

  const photos = persons
    .filter((p) => {
      if (filter === 'all') return true
      if (filter === 'jens') return p.familySide === 'jens' || p.familySide === 'center'
      return p.familySide === 'klara' || p.familySide === 'center'
    })
    .flatMap((p) =>
      p.photos.map((photo) => ({
        src: photo.startsWith('http') ? photo : `/${photo}`,
        person: p,
      }))
    )

  const filterClass = (f: Filter) =>
    `text-sm font-sans px-3 py-1 rounded transition-colors ${
      filter === f
        ? 'bg-accent text-white'
        : 'text-text-secondary hover:bg-bg-secondary'
    }`

  return (
    <div className="flex-1 p-6">
      <div className="flex gap-2 mb-6 justify-center">
        <button className={filterClass('all')} onClick={() => setFilter('all')}>Alla</button>
        <button className={filterClass('jens')} onClick={() => setFilter('jens')}>Jens sida</button>
        <button className={filterClass('klara')} onClick={() => setFilter('klara')}>Klaras sida</button>
      </div>

      {photos.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {photos.map(({ src, person }, i) => (
            <Link
              key={`${person.id}-${i}`}
              to={`/person/${person.id}`}
              className="group relative aspect-square overflow-hidden rounded-lg border border-card-border"
            >
              <img src={src} alt={person.firstName} className="w-full h-full object-cover" />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white text-sm font-sans">{person.firstName} {person.lastName}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-text-secondary font-sans text-center py-8">
          Inga foton att visa.
        </p>
      )}
    </div>
  )
}
