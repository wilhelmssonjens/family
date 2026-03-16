import { useState } from 'react'

export interface AddPersonData {
  firstName: string
  lastName: string
  relationType: string
  birthName?: string
  birthDate?: string
  birthPlace?: string
  deathDate?: string
  deathPlace?: string
  occupation?: string
  story?: string
  honeypot?: string
}

interface Props {
  relationType: string
  onSubmit: (data: AddPersonData) => void
  onCancel: () => void
}

export function AddPersonForm({ relationType, onSubmit, onCancel }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [birthName, setBirthName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [birthPlace, setBirthPlace] = useState('')
  const [deathDate, setDeathDate] = useState('')
  const [deathPlace, setDeathPlace] = useState('')
  const [occupation, setOccupation] = useState('')
  const [story, setStory] = useState('')
  const [honeypot, setHoneypot] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) return

    onSubmit({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      relationType,
      ...(birthName && { birthName }),
      ...(birthDate && { birthDate }),
      ...(birthPlace && { birthPlace }),
      ...(deathDate && { deathDate }),
      ...(deathPlace && { deathPlace }),
      ...(occupation && { occupation }),
      ...(story && { story }),
      ...(honeypot && { honeypot }),
    })
  }

  const inputClass = 'w-full px-2 py-1.5 text-sm font-sans border border-bg-secondary rounded bg-white text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent'

  return (
    <form onSubmit={handleSubmit} className="bg-card-bg border-l-4 border-card-border rounded-lg shadow-md p-4 max-w-xs">
      <h4 className="font-serif font-semibold text-sm text-text-primary mb-3">
        Lägg till {relationType === 'parent' ? 'förälder' : relationType === 'sibling' ? 'syskon' : 'partner'}
      </h4>

      <input
        type="text"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        className="absolute -left-[9999px]"
        tabIndex={-1}
        autoComplete="off"
      />

      <div className="flex flex-col gap-2 mb-3">
        <input className={inputClass} placeholder="Förnamn" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        <input className={inputClass} placeholder="Efternamn" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
      </div>

      {!expanded && (
        <button type="button" onClick={() => setExpanded(true)} className="text-xs font-sans text-accent hover:text-accent-dark mb-3 block">
          Fler detaljer
        </button>
      )}

      {expanded && (
        <div className="flex flex-col gap-2 mb-3">
          <input className={inputClass} placeholder="Födnamn" value={birthName} onChange={(e) => setBirthName(e.target.value)} />
          <input className={inputClass} placeholder="Födelsedatum (ÅÅÅÅ-MM-DD)" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          <input className={inputClass} placeholder="Födelseort" value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} />
          <input className={inputClass} placeholder="Dödsdatum (ÅÅÅÅ-MM-DD)" value={deathDate} onChange={(e) => setDeathDate(e.target.value)} />
          <input className={inputClass} placeholder="Dödsort" value={deathPlace} onChange={(e) => setDeathPlace(e.target.value)} />
          <input className={inputClass} placeholder="Yrke" value={occupation} onChange={(e) => setOccupation(e.target.value)} />
          <textarea className={`${inputClass} resize-none`} rows={3} placeholder="Berättelse eller anekdot" value={story} onChange={(e) => setStory(e.target.value)} />
        </div>
      )}

      <div className="flex gap-2">
        <button type="submit" className="text-xs font-sans bg-accent text-white px-3 py-1.5 rounded hover:bg-accent-dark transition-colors">
          Skicka
        </button>
        <button type="button" onClick={onCancel} className="text-xs font-sans text-text-secondary px-3 py-1.5 rounded hover:bg-bg-secondary transition-colors">
          Avbryt
        </button>
      </div>
    </form>
  )
}
