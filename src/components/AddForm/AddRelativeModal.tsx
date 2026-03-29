import { useState } from 'react'
import { Modal } from '../Modal/Modal'
import { NameSuggestInput } from '../NameSuggestInput'
import type { Person } from '../../types'

export interface AddRelativeData {
  firstName: string
  lastName: string
  relationType: string
  gender: 'male' | 'female' | 'other'
  existingPersonId?: string
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
  relatedPersonId: string
  persons: Person[]
  onSubmit: (data: AddRelativeData) => void
  onCancel: () => void
}

const RELATION_TYPES = [
  { value: 'parent', label: 'Förälder' },
  { value: 'sibling', label: 'Syskon' },
  { value: 'partner', label: 'Partner' },
  { value: 'child', label: 'Barn' },
] as const

export function AddRelativeModal({ relatedPersonName, relatedPersonId, persons, onSubmit, onCancel }: Props) {
  const [mode, setMode] = useState<'new' | 'existing'>('new')
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
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedExistingId, setSelectedExistingId] = useState<string | null>(null)

  const filteredPersons = searchQuery.trim()
    ? persons
        .filter(p => p.id !== relatedPersonId)
        .filter(p => {
          const q = searchQuery.toLowerCase()
          return p.firstName.toLowerCase().includes(q) || p.lastName.toLowerCase().includes(q)
        })
        .slice(0, 8)
    : []

  const selectedExisting = selectedExistingId ? persons.find(p => p.id === selectedExistingId) : null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (mode === 'existing') {
      if (!selectedExistingId || !selectedExisting) return
      onSubmit({
        firstName: selectedExisting.firstName,
        lastName: selectedExisting.lastName,
        relationType,
        gender: selectedExisting.gender,
        existingPersonId: selectedExistingId,
      })
      return
    }

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

  // text-base (16px) prevents Safari auto-zoom on input focus
  const inputClass = 'w-full px-2 py-1.5 text-base font-sans border border-bg-secondary rounded bg-white text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent'

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

        {/* Mode toggle: New / Existing */}
        <div className="mb-4">
          <div className="flex gap-2">
            {([['new', 'Ny person'], ['existing', 'Befintlig person']] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => { setMode(value); setSelectedExistingId(null); setSearchQuery('') }}
                className={`flex-1 text-sm font-sans py-1.5 rounded-lg border transition-colors ${
                  mode === value
                    ? 'border-accent bg-accent/10 text-accent font-medium'
                    : 'border-bg-secondary text-text-primary hover:border-accent/50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {mode === 'existing' ? (
          <div className="mb-3">
            {selectedExisting ? (
              <div className="flex items-center gap-3 p-3 border border-accent rounded-lg bg-accent/5">
                <div className="w-8 h-8 rounded-full bg-bg-secondary border border-card-border flex items-center justify-center flex-shrink-0">
                  <span className="text-accent font-sans text-xs font-semibold">
                    {selectedExisting.firstName[0]}{selectedExisting.lastName[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-serif font-semibold text-text-primary truncate">
                    {selectedExisting.firstName} {selectedExisting.lastName}
                  </p>
                  {selectedExisting.birthDate && (
                    <p className="text-xs font-sans text-text-secondary">f. {selectedExisting.birthDate.slice(0, 4)}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedExistingId(null); setSearchQuery('') }}
                  className="text-xs font-sans text-text-secondary hover:text-text-primary"
                >
                  Ändra
                </button>
              </div>
            ) : (
              <>
                <input
                  className={inputClass}
                  placeholder="Sök efter namn..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                {filteredPersons.length > 0 && (
                  <div className="mt-2 border border-bg-secondary rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    {filteredPersons.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setSelectedExistingId(p.id); setSearchQuery('') }}
                        className="w-full text-left px-3 py-2 text-sm font-sans hover:bg-bg-secondary/50 transition-colors flex items-center gap-2 border-b border-bg-secondary last:border-b-0"
                      >
                        <span className="font-medium text-text-primary">{p.firstName} {p.lastName}</span>
                        {p.birthDate && (
                          <span className="text-xs text-text-secondary">f. {p.birthDate.slice(0, 4)}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {searchQuery.trim() && filteredPersons.length === 0 && (
                  <p className="mt-2 text-xs font-sans text-text-secondary">Inga träffar</p>
                )}
              </>
            )}
          </div>
        ) : (
          <>
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
              <NameSuggestInput className={inputClass} placeholder="Förnamn *" value={firstName} onChange={setFirstName} suggestions={persons.map(p => p.firstName)} required />
              <NameSuggestInput className={inputClass} placeholder="Efternamn *" value={lastName} onChange={setLastName} suggestions={persons.map(p => p.lastName)} required />
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
          </>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-bg-secondary">
          <button
            type="submit"
            className="flex-1 text-sm font-sans bg-accent text-white py-2 rounded-lg hover:bg-accent-dark transition-colors"
          >
            {mode === 'existing' ? 'Koppla' : 'Lägg till'}
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
