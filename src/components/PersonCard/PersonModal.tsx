import { useState, useRef, useCallback } from 'react'
import { Modal } from '../Modal/Modal'
import { NameSuggestInput } from '../NameSuggestInput'
import { formatLifespan, formatFullName, getInitials } from '../../utils/formatPerson'
import { compressImage } from '../../utils/compressImage'
import type { Person, Story } from '../../types'

export interface EditPersonData {
  firstName: string
  lastName: string
  birthName: string
  birthDate: string
  birthPlace: string
  deathDate: string
  deathPlace: string
  occupation: string
  contactInfo: string
  stories: Story[]
  photos: string[]
}

interface Props {
  person: Person
  persons: Person[]
  relationLabel: string
  onClose: () => void
  onSave: (data: EditPersonData) => void
  onDelete: () => void
  onAddRelative: () => void
  onNavigate?: () => void
}

export function PersonModal({ person, persons, relationLabel, onClose, onSave, onDelete, onAddRelative, onNavigate }: Props) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dirty = useRef(false)
  const [form, setForm] = useState<EditPersonData>({
    firstName: person.firstName,
    lastName: person.lastName,
    birthName: person.birthName ?? '',
    birthDate: person.birthDate ?? '',
    birthPlace: person.birthPlace ?? '',
    deathDate: person.deathDate ?? '',
    deathPlace: person.deathPlace ?? '',
    occupation: person.occupation ?? '',
    contactInfo: person.contactInfo ?? '',
    stories: person.stories.length > 0 ? [...person.stories] : [],
    photos: [...person.photos],
  })

  const fullName = formatFullName(person.firstName, person.lastName, person.birthName)
  const initials = getInitials(person.firstName, person.lastName)
  const lifespan = formatLifespan(person.birthDate, person.deathDate, person.birthPlace, person.deathPlace)

  const inputClass = 'w-full px-2 py-1.5 text-sm font-sans border border-bg-secondary rounded bg-white text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent'

  function updateField(field: keyof EditPersonData, value: string) {
    dirty.current = true
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // Auto-save on close if any inline field was changed
  const handleClose = useCallback(() => {
    if (dirty.current && form.firstName.trim() && form.lastName.trim()) {
      onSave(form)
    }
    onClose()
  }, [form, onSave, onClose])

  function handleFullSave() {
    if (!form.firstName.trim() || !form.lastName.trim()) return
    dirty.current = false // prevent double save
    onSave(form)
    onClose()
  }

  function handleCancel() {
    dirty.current = false
    setForm({
      firstName: person.firstName,
      lastName: person.lastName,
      birthName: person.birthName ?? '',
      birthDate: person.birthDate ?? '',
      birthPlace: person.birthPlace ?? '',
      deathDate: person.deathDate ?? '',
      deathPlace: person.deathPlace ?? '',
      occupation: person.occupation ?? '',
      contactInfo: person.contactInfo ?? '',
      stories: person.stories.length > 0 ? [...person.stories] : [],
      photos: [...person.photos],
    })
    setEditing(false)
  }

  function updateStory(index: number, field: 'title' | 'text', value: string) {
    dirty.current = true
    setForm(prev => ({
      ...prev,
      stories: prev.stories.map((s, i) => i === index ? { ...s, [field]: value } : s),
    }))
  }

  function addStory() {
    dirty.current = true
    setForm(prev => ({ ...prev, stories: [...prev.stories, { title: '', text: '' }] }))
  }

  function removeStory(index: number) {
    dirty.current = true
    setForm(prev => ({ ...prev, stories: prev.stories.filter((_, i) => i !== index) }))
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const { base64, filename } = await compressImage(file)
      const res = await fetch('/api/upload-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: base64, filename }),
      })
      if (!res.ok) throw new Error()
      const { url } = await res.json()
      dirty.current = true
      setForm(prev => ({ ...prev, photos: [...prev.photos, url] }))
    } catch {
      alert('Kunde inte ladda upp bilden. Försök igen.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function removePhoto(index: number) {
    dirty.current = true
    setForm(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== index) }))
  }

  // === FULL EDIT MODE (photos, stories, names, delete) ===
  if (editing) {
    return (
      <Modal onClose={handleCancel}>
        <div className="p-4 sm:p-6">
          {/* Header */}
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-bg-secondary border-2 border-card-border flex items-center justify-center flex-shrink-0">
              <span className="text-accent font-sans font-semibold text-lg sm:text-xl">{initials}</span>
            </div>
            <h2 className="font-serif font-bold text-text-primary text-lg">Redigera</h2>
          </div>

          {/* Edit form */}
          <div className="space-y-3 mb-5">
            <div className="flex gap-3 items-center text-sm font-sans">
              <label className="text-text-secondary w-24 sm:w-28 flex-shrink-0">Förnamn</label>
              <NameSuggestInput className={inputClass} value={form.firstName} onChange={(v) => updateField('firstName', v)} suggestions={persons.map(p => p.firstName)} required />
            </div>
            <div className="flex gap-3 items-center text-sm font-sans">
              <label className="text-text-secondary w-24 sm:w-28 flex-shrink-0">Efternamn</label>
              <NameSuggestInput className={inputClass} value={form.lastName} onChange={(v) => updateField('lastName', v)} suggestions={persons.map(p => p.lastName)} required />
            </div>
            <EditField label="Födnamn" value={form.birthName} onChange={(v) => updateField('birthName', v)} inputClass={inputClass} placeholder="Om annat än nuvarande" />
            <EditField label="Födelsedatum" value={form.birthDate} onChange={(v) => updateField('birthDate', v)} inputClass={inputClass} placeholder="ÅÅÅÅ-MM-DD" />
            <EditField label="Födelseort" value={form.birthPlace} onChange={(v) => updateField('birthPlace', v)} inputClass={inputClass} />
            <EditField label="Dödsdatum" value={form.deathDate} onChange={(v) => updateField('deathDate', v)} inputClass={inputClass} placeholder="ÅÅÅÅ-MM-DD" />
            <EditField label="Dödsort" value={form.deathPlace} onChange={(v) => updateField('deathPlace', v)} inputClass={inputClass} />
            <EditField label="Yrke" value={form.occupation} onChange={(v) => updateField('occupation', v)} inputClass={inputClass} />
            <EditField label="Kontakt" value={form.contactInfo} onChange={(v) => updateField('contactInfo', v)} inputClass={inputClass} />
          </div>

          {/* Photos */}
          <div className="mb-5">
            <h3 className="font-serif font-semibold text-text-primary text-sm mb-2">Foto</h3>
            {form.photos.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {form.photos.map((url, i) => (
                  <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-bg-secondary">
                    <img src={photoSrc(url)} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute top-0 right-0 w-5 h-5 bg-red-600 text-white text-xs rounded-bl-lg flex items-center justify-center hover:bg-red-700"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
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
              disabled={uploading}
              className="text-xs font-sans text-accent hover:text-accent-dark transition-colors disabled:opacity-50"
            >
              {uploading ? 'Laddar upp...' : '+ Lägg till foto'}
            </button>
          </div>

          {/* Övrig information */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-serif font-semibold text-text-primary text-sm">Övrig information</h3>
              <button
                type="button"
                onClick={addStory}
                className="text-xs font-sans text-accent hover:text-accent-dark transition-colors"
              >
                + Lägg till
              </button>
            </div>
            {form.stories.map((story, i) => (
              <div key={i} className="mb-3 p-3 border border-bg-secondary rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-sans text-text-secondary">Info {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeStory(i)}
                    className="text-xs font-sans text-red-500 hover:text-red-700 transition-colors"
                  >
                    Ta bort
                  </button>
                </div>
                <input
                  className={`${inputClass} mb-2`}
                  placeholder="Rubrik (valfritt)"
                  value={story.title}
                  onChange={(e) => updateStory(i, 'title', e.target.value)}
                />
                <textarea
                  className={`${inputClass} resize-none`}
                  rows={3}
                  placeholder="Skriv här..."
                  value={story.text}
                  onChange={(e) => updateStory(i, 'text', e.target.value)}
                />
              </div>
            ))}
          </div>

          {/* Delete confirmation */}
          {confirmDelete && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm font-sans text-red-800 mb-2">
                Är du säker på att du vill ta bort {person.firstName}? Alla relationer tas också bort.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={onDelete}
                  className="text-sm font-sans bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Ja, ta bort
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-sm font-sans text-text-secondary px-3 py-1.5 rounded-lg hover:bg-bg-secondary transition-colors"
                >
                  Avbryt
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-bg-secondary">
            <button
              onClick={handleFullSave}
              className="flex-1 text-sm font-sans bg-accent text-white py-2 rounded-lg hover:bg-accent-dark transition-colors"
            >
              Spara
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 text-sm font-sans text-text-secondary py-2 rounded-lg hover:bg-bg-secondary transition-colors"
            >
              Avbryt
            </button>
            {!confirmDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-sm font-sans text-red-600 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
              >
                Ta bort
              </button>
            )}
          </div>
        </div>
      </Modal>
    )
  }

  // === DEFAULT VIEW: inline-editable fields ===
  return (
    <Modal onClose={handleClose}>
      <div className="p-4 sm:p-6">
        {/* Header: photo + name + edit icon */}
        <div className="flex items-start gap-3 sm:gap-4 mb-5">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-bg-secondary border-2 border-card-border flex items-center justify-center flex-shrink-0 overflow-hidden">
            {person.photos.length > 0 ? (
              <img
                src={photoSrc(person.photos[0])}
                alt={person.firstName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-accent font-sans font-semibold text-xl sm:text-2xl">{initials}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-serif font-bold text-text-primary text-lg leading-tight">{fullName}</h2>
            {lifespan && (
              <p className="text-text-secondary text-sm font-sans mt-1">{lifespan}</p>
            )}
            {relationLabel && (
              <p className="text-accent text-xs font-sans mt-1">{relationLabel}</p>
            )}
          </div>
          {/* Pencil icon — opens full edit mode */}
          <button
            onClick={() => setEditing(true)}
            className="flex-shrink-0 w-8 h-8 rounded-lg bg-bg-secondary/80 hover:bg-accent hover:text-white
                       flex items-center justify-center transition-colors text-text-secondary"
            title="Redigera alla fält"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 1.5l2.5 2.5M1 13l.9-3.6L10.3 1a1.4 1.4 0 012 0l.7.7a1.4 1.4 0 010 2L4.6 12.1 1 13z" />
            </svg>
          </button>
        </div>

        {/* Inline-editable detail fields */}
        <div className="space-y-2 mb-5">
          <EditableDetailRow label="Födelsedatum" value={form.birthDate} onChange={(v) => updateField('birthDate', v)} placeholder="ÅÅÅÅ-MM-DD" />
          <EditableDetailRow label="Födelseort" value={form.birthPlace} onChange={(v) => updateField('birthPlace', v)} />
          <EditableDetailRow label="Födnamn" value={form.birthName} onChange={(v) => updateField('birthName', v)} placeholder="Om annat" />
          <EditableDetailRow label="Dödsdatum" value={form.deathDate} onChange={(v) => updateField('deathDate', v)} placeholder="ÅÅÅÅ-MM-DD" />
          <EditableDetailRow label="Dödsort" value={form.deathPlace} onChange={(v) => updateField('deathPlace', v)} />
          <EditableDetailRow label="Yrke" value={form.occupation} onChange={(v) => updateField('occupation', v)} />
          <EditableDetailRow label="Kontakt" value={form.contactInfo} onChange={(v) => updateField('contactInfo', v)} />
        </div>

        {/* Övrig information */}
        {form.stories.length > 0 && (
          <div className="mb-5">
            <h3 className="font-serif font-semibold text-text-primary text-sm mb-2">Övrig information</h3>
            <div className="space-y-3">
              {form.stories.map((story, i) => (
                <div key={i}>
                  {story.title && (
                    <p className="text-sm font-sans font-medium text-text-primary mb-0.5">{story.title}</p>
                  )}
                  <p className="text-sm font-sans text-text-secondary leading-relaxed whitespace-pre-wrap">
                    {story.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-bg-secondary">
          <button
            onClick={onAddRelative}
            className="flex-1 text-sm font-sans bg-accent text-white py-2 rounded-lg hover:bg-accent-dark transition-colors"
          >
            Lägg till släkting
          </button>
          {onNavigate && (
            <button
              onClick={onNavigate}
              className="flex-1 text-sm font-sans bg-bg-secondary text-text-primary py-2 rounded-lg hover:bg-bg-secondary/70 transition-colors"
            >
              Visa i trädet
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

function photoSrc(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `/${path}`
}

/** Inline-editable field: tap to edit, blur/Enter to save locally */
function EditableDetailRow({ label, value, onChange, placeholder }: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  function commit() {
    onChange(draft)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex gap-3 items-center text-sm font-sans">
        <span className="text-text-secondary w-24 sm:w-28 flex-shrink-0">{label}</span>
        <input
          className="w-full px-2 py-1 text-sm font-sans border border-accent/60 rounded bg-white text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
          placeholder={placeholder}
          autoFocus
        />
      </div>
    )
  }

  return (
    <div
      className="flex gap-3 items-center text-sm font-sans group cursor-pointer rounded-lg px-1 -mx-1 py-1 hover:bg-bg-secondary/50 transition-colors"
      onClick={() => { setDraft(value); setEditing(true) }}
    >
      <span className="text-text-secondary w-24 sm:w-28 flex-shrink-0">{label}</span>
      {value ? (
        <span className="text-text-primary flex-1">{value}</span>
      ) : (
        <span className="text-accent/60 flex-1">+ Lägg till</span>
      )}
      <span className="text-text-secondary/0 group-hover:text-text-secondary/50 text-xs transition-colors flex-shrink-0">
        &#9998;
      </span>
    </div>
  )
}

function EditField({ label, value, onChange, inputClass, placeholder }: {
  label: string
  value: string
  onChange: (value: string) => void
  inputClass: string
  placeholder?: string
}) {
  return (
    <div className="flex gap-3 items-center text-sm font-sans">
      <label className="text-text-secondary w-24 sm:w-28 flex-shrink-0">{label}</label>
      <input
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}
