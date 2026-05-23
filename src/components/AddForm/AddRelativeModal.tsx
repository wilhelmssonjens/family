import { useState, useRef } from 'react'
import { Modal } from '../Modal/Modal'
import { NameSuggestInput } from '../NameSuggestInput'
import { compressImage } from '../../utils/compressImage'
import { isValidDate } from '../../utils/validateDate'
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
  photoUrl?: string
  honeypot?: string
}

interface Props {
  relatedPersonName: string
  relatedPersonId: string
  persons: Person[]
  onSubmit: (data: AddRelativeData) => Promise<{ ok: boolean }>
  onCancel: () => void
}

const RELATION_TYPES = [
  { value: 'parent', label: 'Förälder', noun: 'förälder' },
  { value: 'sibling', label: 'Syskon', noun: 'syskon' },
  { value: 'partner', label: 'Partner', noun: 'partner' },
  { value: 'child', label: 'Barn', noun: 'barn' },
] as const

/** Swedish possessive form: "Anders" → "Anders'", "Erik" → "Eriks" */
function possessive(name: string): string {
  const last = name[name.length - 1]?.toLowerCase() ?? ''
  if (last === 's' || last === 'z' || last === 'x') return `${name}'`
  return `${name}s`
}

function relationNoun(type: string): string {
  return RELATION_TYPES.find(rt => rt.value === type)?.noun ?? 'släkting'
}

type Phase = 'form' | 'submitting' | 'success' | 'error'

export function AddRelativeModal({ relatedPersonName, relatedPersonId, persons, onSubmit, onCancel }: Props) {
  const [phase, setPhase] = useState<Phase>('form')
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
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [honeypot, setHoneypot] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedExistingId, setSelectedExistingId] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [justAdded, setJustAdded] = useState<{ name: string; relation: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const queryLower = searchQuery.trim().toLowerCase()
  const allMatches = queryLower
    ? persons
        .filter(p => p.id !== relatedPersonId)
        .filter(p => {
          const full = `${p.firstName} ${p.lastName}`.toLowerCase()
          return full.includes(queryLower)
        })
    : []
  const filteredPersons = allMatches.slice(0, 8)
  const moreCount = allMatches.length - filteredPersons.length

  const selectedExisting = selectedExistingId ? persons.find(p => p.id === selectedExistingId) : null

  function resetFormFields() {
    setMode('new')
    setRelationType('parent')
    setGender('male')
    setFirstName('')
    setLastName('')
    setShowDetails(false)
    setBirthName('')
    setBirthDate('')
    setBirthPlace('')
    setDeathDate('')
    setDeathPlace('')
    setOccupation('')
    setStory('')
    setPhotoUrl(null)
    setPhotoError(null)
    setSearchQuery('')
    setSelectedExistingId(null)
    setFieldErrors({})
    setSubmitError(null)
  }

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {}
    if (mode === 'existing') {
      if (!selectedExistingId) errors.existing = 'Välj en person att koppla'
      return errors
    }
    if (!firstName.trim()) errors.firstName = 'Skriv ett förnamn'
    if (!lastName.trim()) errors.lastName = 'Skriv ett efternamn'
    if (birthDate && !isValidDate(birthDate)) errors.birthDate = 'Använd ÅÅÅÅ, ÅÅÅÅ-MM eller ÅÅÅÅ-MM-DD'
    if (deathDate && !isValidDate(deathDate)) errors.deathDate = 'Använd ÅÅÅÅ, ÅÅÅÅ-MM eller ÅÅÅÅ-MM-DD'
    return errors
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    setPhotoError(null)
    try {
      const { base64, filename } = await compressImage(file)
      const res = await fetch('/api/upload-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: base64, filename }),
      })
      if (!res.ok) throw new Error()
      const { url } = await res.json()
      setPhotoUrl(url)
    } catch {
      setPhotoError('Kunde inte ladda upp bilden. Försök igen.')
    } finally {
      setUploadingPhoto(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errors = validate()
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})
    setSubmitError(null)

    const noun = relationNoun(relationType)
    let displayName: string

    let payload: AddRelativeData
    if (mode === 'existing' && selectedExisting) {
      payload = {
        firstName: selectedExisting.firstName,
        lastName: selectedExisting.lastName,
        relationType,
        gender: selectedExisting.gender,
        existingPersonId: selectedExisting.id,
      }
      displayName = `${selectedExisting.firstName} ${selectedExisting.lastName}`
    } else {
      payload = {
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
        ...(photoUrl && { photoUrl }),
        ...(honeypot && { honeypot }),
      }
      displayName = `${firstName.trim()} ${lastName.trim()}`
    }

    setPhase('submitting')
    try {
      const result = await onSubmit(payload)
      if (result.ok) {
        setJustAdded({ name: displayName, relation: noun })
        setPhase('success')
      } else {
        setSubmitError('Något gick fel. Försök igen.')
        setPhase('error')
      }
    } catch {
      setSubmitError('Något gick fel. Försök igen.')
      setPhase('error')
    }
  }

  function handleAddAnother() {
    resetFormFields()
    setJustAdded(null)
    setPhase('form')
  }

  // text-base (16px) prevents Safari auto-zoom on input focus
  const inputBase = 'w-full px-2 py-1.5 text-base font-sans border rounded bg-white text-text-primary placeholder:text-text-secondary/50 focus:outline-none'
  const inputStyle = (hasError?: boolean) =>
    `${inputBase} ${hasError ? 'border-red-400 focus:border-red-500' : 'border-bg-secondary focus:border-accent'}`
  const isSubmitting = phase === 'submitting'

  const noun = relationNoun(relationType)
  const relationPreview = `Lägger till ${possessive(relatedPersonName)} ${noun}`

  // --- SUCCESS PHASE ---
  if (phase === 'success' && justAdded) {
    return (
      <Modal onClose={onCancel}>
        <div className="p-6 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-accent/15 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
              <path d="M5 12l5 5L20 7" />
            </svg>
          </div>
          <h2 className="font-serif font-bold text-text-primary text-lg mb-1">
            {justAdded.name} tillagd
          </h2>
          <p className="text-sm font-sans text-text-secondary mb-5">
            Som {possessive(relatedPersonName)} {justAdded.relation}
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleAddAnother}
              className="w-full text-sm font-sans bg-accent text-white py-2.5 rounded-lg hover:bg-accent-dark transition-colors cursor-pointer"
            >
              Lägg till en till till {relatedPersonName}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="w-full text-sm font-sans text-text-secondary py-2 rounded-lg hover:bg-bg-secondary transition-colors cursor-pointer"
            >
              Stäng
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  // --- FORM PHASE ---
  return (
    <Modal onClose={onCancel}>
      <form onSubmit={handleSubmit} className="p-6">
        <h2 className="font-serif font-bold text-text-primary text-lg mb-1">
          Lägg till släkting
        </h2>
        <p className="text-sm font-sans text-accent mb-5">
          {relationPreview}
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
                disabled={isSubmitting}
                className={`text-sm font-sans py-2 rounded-lg border transition-colors ${
                  relationType === rt.value
                    ? 'border-accent bg-accent/10 text-accent font-medium'
                    : 'border-bg-secondary text-text-primary hover:border-accent/50'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
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
                onClick={() => { setMode(value); setSelectedExistingId(null); setSearchQuery(''); setFieldErrors({}) }}
                disabled={isSubmitting}
                className={`flex-1 text-sm font-sans py-1.5 rounded-lg border transition-colors ${
                  mode === value
                    ? 'border-accent bg-accent/10 text-accent font-medium'
                    : 'border-bg-secondary text-text-primary hover:border-accent/50'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
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
                  disabled={isSubmitting}
                  className="text-xs font-sans text-text-secondary hover:text-text-primary disabled:opacity-50"
                >
                  Ändra
                </button>
              </div>
            ) : (
              <>
                <input
                  className={inputStyle(!!fieldErrors.existing)}
                  placeholder="Sök efter namn..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={isSubmitting}
                  autoFocus
                />
                {fieldErrors.existing && (
                  <p className="mt-1 text-xs text-red-500">{fieldErrors.existing}</p>
                )}
                {filteredPersons.length > 0 && (
                  <div className="mt-2 border border-bg-secondary rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    {filteredPersons.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setSelectedExistingId(p.id); setSearchQuery(''); setFieldErrors({}) }}
                        className="w-full text-left px-3 py-2 text-sm font-sans hover:bg-bg-secondary/50 transition-colors flex items-center gap-2 border-b border-bg-secondary last:border-b-0"
                      >
                        <span className="font-medium text-text-primary">{p.firstName} {p.lastName}</span>
                        {p.birthDate && (
                          <span className="text-xs text-text-secondary">f. {p.birthDate.slice(0, 4)}</span>
                        )}
                      </button>
                    ))}
                    {moreCount > 0 && (
                      <p className="px-3 py-2 text-xs font-sans text-text-secondary bg-bg-secondary/30">
                        + {moreCount} fler — förfina sökningen
                      </p>
                    )}
                  </div>
                )}
                {queryLower && filteredPersons.length === 0 && (
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
                    disabled={isSubmitting}
                    className={`flex-1 text-sm font-sans py-1.5 rounded-lg border transition-colors ${
                      gender === value
                        ? 'border-accent bg-accent/10 text-accent font-medium'
                        : 'border-bg-secondary text-text-primary hover:border-accent/50'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Photo + name row */}
            <div className="flex items-start gap-3 mb-3">
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting || uploadingPhoto}
                  aria-label={photoUrl ? 'Byt foto' : 'Lägg till foto'}
                  className={`w-16 h-16 rounded-xl bg-bg-secondary flex items-center justify-center overflow-hidden cursor-pointer group relative
                    ${photoUrl ? 'border-2 border-card-border' : 'border-2 border-dashed border-accent/50 hover:border-accent'}
                    disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {photoUrl ? (
                    <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-0.5">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-accent/60">
                        <rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="12" cy="13" r="3" /><path d="M9 5l1-2h4l1 2" />
                      </svg>
                      <span className="text-accent/60 font-sans text-[9px]">Foto</span>
                    </div>
                  )}
                </button>
                {uploadingPhoto && <span className="text-[10px] font-sans text-text-secondary">Laddar...</span>}
                {photoUrl && !uploadingPhoto && (
                  <button
                    type="button"
                    onClick={() => setPhotoUrl(null)}
                    className="text-[10px] font-sans text-red-400 hover:text-red-600 transition-colors"
                  >
                    Ta bort
                  </button>
                )}
              </div>

              <div className="flex-1 flex flex-col gap-2 min-w-0">
                <div>
                  <NameSuggestInput
                    className={inputStyle(!!fieldErrors.firstName)}
                    placeholder="Förnamn *"
                    value={firstName}
                    onChange={(v) => { setFirstName(v); if (fieldErrors.firstName) setFieldErrors(prev => ({ ...prev, firstName: '' })) }}
                    suggestions={persons.map(p => p.firstName)}
                  />
                  {fieldErrors.firstName && <p className="mt-1 text-xs text-red-500">{fieldErrors.firstName}</p>}
                </div>
                <div>
                  <NameSuggestInput
                    className={inputStyle(!!fieldErrors.lastName)}
                    placeholder="Efternamn *"
                    value={lastName}
                    onChange={(v) => { setLastName(v); if (fieldErrors.lastName) setFieldErrors(prev => ({ ...prev, lastName: '' })) }}
                    suggestions={persons.map(p => p.lastName)}
                  />
                  {fieldErrors.lastName && <p className="mt-1 text-xs text-red-500">{fieldErrors.lastName}</p>}
                </div>
              </div>
            </div>

            {photoError && (
              <p className="mb-2 text-xs text-red-500">{photoError}</p>
            )}

            {/* Birth date — always visible (most common detail) */}
            <div className="mb-3">
              <input
                className={inputStyle(!!fieldErrors.birthDate)}
                placeholder="Födelseår (t.ex. 1952)"
                value={birthDate}
                onChange={(e) => { setBirthDate(e.target.value); if (fieldErrors.birthDate) setFieldErrors(prev => ({ ...prev, birthDate: '' })) }}
                disabled={isSubmitting}
                inputMode="numeric"
              />
              {fieldErrors.birthDate && <p className="mt-1 text-xs text-red-500">{fieldErrors.birthDate}</p>}
            </div>

            {/* Toggle details */}
            {!showDetails && (
              <button
                type="button"
                onClick={() => setShowDetails(true)}
                disabled={isSubmitting}
                className="text-xs font-sans text-accent hover:text-accent-dark mb-3 inline-flex items-center gap-1 disabled:opacity-50"
              >
                <span>Fler detaljer</span>
                <span aria-hidden="true">▾</span>
              </button>
            )}

            {showDetails && (
              <div className="flex flex-col gap-2 mb-3">
                <input className={inputStyle()} placeholder="Födnamn (om annat)" value={birthName} onChange={(e) => setBirthName(e.target.value)} disabled={isSubmitting} />
                <input className={inputStyle()} placeholder="Födelseort" value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} disabled={isSubmitting} />
                <div>
                  <input
                    className={inputStyle(!!fieldErrors.deathDate)}
                    placeholder="Dödsdatum (ÅÅÅÅ eller ÅÅÅÅ-MM-DD)"
                    value={deathDate}
                    onChange={(e) => { setDeathDate(e.target.value); if (fieldErrors.deathDate) setFieldErrors(prev => ({ ...prev, deathDate: '' })) }}
                    disabled={isSubmitting}
                  />
                  {fieldErrors.deathDate && <p className="mt-1 text-xs text-red-500">{fieldErrors.deathDate}</p>}
                </div>
                <input className={inputStyle()} placeholder="Dödsort" value={deathPlace} onChange={(e) => setDeathPlace(e.target.value)} disabled={isSubmitting} />
                <input className={inputStyle()} placeholder="Yrke" value={occupation} onChange={(e) => setOccupation(e.target.value)} disabled={isSubmitting} />
                <textarea className={`${inputStyle()} resize-none`} rows={3} placeholder="Berättelse eller anekdot" value={story} onChange={(e) => setStory(e.target.value)} disabled={isSubmitting} />
              </div>
            )}
          </>
        )}

        {submitError && (
          <p className="mb-2 text-sm text-red-600 text-center" role="alert">{submitError}</p>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-bg-secondary">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-[2] text-sm font-sans bg-accent text-white py-2.5 rounded-lg hover:bg-accent-dark transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait flex items-center justify-center gap-2"
          >
            {isSubmitting && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            )}
            <span>
              {isSubmitting
                ? (mode === 'existing' ? 'Kopplar...' : 'Lägger till...')
                : (mode === 'existing' ? 'Koppla' : 'Lägg till')}
            </span>
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 text-sm font-sans text-text-secondary py-2.5 rounded-lg hover:bg-bg-secondary transition-colors cursor-pointer disabled:opacity-50"
          >
            Avbryt
          </button>
        </div>
      </form>
    </Modal>
  )
}
