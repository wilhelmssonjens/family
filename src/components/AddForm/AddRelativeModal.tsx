import { useState } from 'react'
import { Modal } from '../Modal/Modal'

export interface AddRelativeData {
  firstName: string
  lastName: string
  relationType: string
  gender: 'male' | 'female' | 'other'
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
  relatedPersonName: string
  onSubmit: (data: AddRelativeData) => void
  onCancel: () => void
}

const RELATION_TYPES = [
  { value: 'parent', label: 'Förälder' },
  { value: 'sibling', label: 'Syskon' },
  { value: 'partner', label: 'Partner' },
  { value: 'child', label: 'Barn' },
] as const

export function AddRelativeModal({ relatedPersonName, onSubmit, onCancel }: Props) {
  const [relationType, setRelationType] = useState<string>('parent')
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [showDetails, setShowDetails] = useState(false)
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
      gender,
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
    <Modal onClose={onCancel}>
      <form onSubmit={handleSubmit} className="p-6">
        <h2 className="font-serif font-bold text-text-primary text-lg mb-1">
          Lägg till släkting
        </h2>
        <p className="text-sm font-sans text-text-secondary mb-5">
          Till {relatedPersonName}
        </p>

        {/* Honeypot */}
        <input
          type="text"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          className="absolute -left-[9999px]"
          tabIndex={-1}
          autoComplete="off"
        />

        {/* Relation type selector */}
        <div className="mb-4">
          <label className="text-sm font-sans text-text-secondary mb-2 block">Relation</label>
          <div className="grid grid-cols-2 gap-2">
            {RELATION_TYPES.map((rt) => (
              <button
                key={rt.value}
                type="button"
                onClick={() => setRelationType(rt.value)}
                className={`text-sm font-sans py-2 rounded-lg border transition-colors ${
                  relationType === rt.value
                    ? 'border-accent bg-accent/10 text-accent font-medium'
                    : 'border-bg-secondary text-text-primary hover:border-accent/50'
                }`}
              >
                {rt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Gender selector */}
        <div className="mb-4">
          <label className="text-sm font-sans text-text-secondary mb-2 block">Kön</label>
          <div className="flex gap-2">
            {([['male', 'Man'], ['female', 'Kvinna'], ['other', 'Annat']] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setGender(value)}
                className={`flex-1 text-sm font-sans py-1.5 rounded-lg border transition-colors ${
                  gender === value
                    ? 'border-accent bg-accent/10 text-accent font-medium'
                    : 'border-bg-secondary text-text-primary hover:border-accent/50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Name fields */}
        <div className="flex flex-col gap-2 mb-3">
          <input className={inputClass} placeholder="Förnamn *" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          <input className={inputClass} placeholder="Efternamn *" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        </div>

        {/* Toggle details */}
        {!showDetails && (
          <button
            type="button"
            onClick={() => setShowDetails(true)}
            className="text-xs font-sans text-accent hover:text-accent-dark mb-3 block"
          >
            Fler detaljer
          </button>
        )}

        {showDetails && (
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

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-bg-secondary">
          <button
            type="submit"
            className="flex-1 text-sm font-sans bg-accent text-white py-2 rounded-lg hover:bg-accent-dark transition-colors"
          >
            Lägg till
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 text-sm font-sans text-text-secondary py-2 rounded-lg hover:bg-bg-secondary transition-colors"
          >
            Avbryt
          </button>
        </div>
      </form>
    </Modal>
  )
}
