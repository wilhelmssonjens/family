import { useState, useRef, useCallback } from 'react'
import { Modal } from '../Modal/Modal'
import { formatLifespan, getInitials } from '../../utils/formatPerson'
import { compressImage } from '../../utils/compressImage'
import { isValidDate } from '../../utils/validateDate'
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

export function PersonModal({ person, relationLabel, onClose, onSave, onDelete, onAddRelative, onNavigate }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
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

  const initials = getInitials(person.firstName, person.lastName)
  const lifespan = formatLifespan(person.birthDate, person.deathDate, person.birthPlace, person.deathPlace)

  // Flatten stories into a single text block for display
  const notesText = form.stories.map(s => [s.title, s.text].filter(Boolean).join(': ')).join('\n\n')

  // text-base (16px) prevents Safari auto-zoom on input focus
  const inputClass = 'w-full px-2 py-1.5 text-base font-sans border border-accent/60 rounded bg-white text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent'

  function updateField(field: keyof EditPersonData, value: string) {
    dirty.current = true
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // Auto-save on close if any field was changed
  const handleClose = useCallback(() => {
    if (dirty.current && form.firstName.trim() && form.lastName.trim()) {
      onSave(form)
      dirty.current = false
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 1500)
    }
    onClose()
  }, [form, onSave, onClose])

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

  // Hidden file input (shared)
  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      onChange={handlePhotoUpload}
      className="hidden"
    />
  )

  return (
    <Modal onClose={handleClose}>
      <div className="p-4 sm:p-6 relative">
        {fileInput}

        {/* Saved flash indicator */}
        {savedFlash && (
          <span className="absolute top-4 right-14 text-xs font-sans text-accent animate-in z-10">
            Sparat
          </span>
        )}

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-bg-secondary/80 hover:bg-text-secondary/20
                     flex items-center justify-center text-text-secondary hover:text-text-primary
                     transition-colors cursor-pointer z-10"
          aria-label="Stäng"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M2 2l10 10M12 2L2 12" />
          </svg>
        </button>

        {/* Header: photo + name (both tappable) */}
        <div className="flex items-start gap-3 sm:gap-4 mb-5">
          {/* Photo avatar — tap to upload */}
          <div
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-bg-secondary border-2 border-card-border flex items-center justify-center flex-shrink-0 overflow-hidden cursor-pointer group relative"
            onClick={() => fileInputRef.current?.click()}
          >
            {form.photos.length > 0 ? (
              <img
                src={photoSrc(form.photos[0])}
                alt={person.firstName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-accent font-sans font-semibold text-xl sm:text-2xl">{initials}</span>
            )}
            {/* Camera overlay on hover */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-colors">
              <span className="text-white/0 group-hover:text-white/90 text-lg transition-colors">+</span>
            </div>
          </div>

          {/* Name — tappable to edit inline */}
          <div className="min-w-0 flex-1">
            {editingName ? (
              <div
                className="space-y-1.5"
                onBlur={(e) => {
                  // Only close if focus leaves BOTH inputs (not when switching between them)
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setEditingName(false)
                }}
              >
                <input
                  className={`${inputClass} font-serif font-bold`}
                  value={form.firstName}
                  onChange={(e) => updateField('firstName', e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false) }}
                  placeholder="Förnamn"
                  autoFocus
                />
                <input
                  className={`${inputClass} font-serif`}
                  value={form.lastName}
                  onChange={(e) => updateField('lastName', e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false) }}
                  placeholder="Efternamn"
                />
              </div>
            ) : (
              <div
                className="cursor-pointer group"
                onClick={() => setEditingName(true)}
              >
                <h2 className="font-serif font-bold text-text-primary text-lg leading-tight group-hover:text-accent transition-colors">
                  {form.firstName} {form.lastName}
                  <span className="text-text-secondary/0 group-hover:text-text-secondary/50 text-xs ml-1.5 font-sans font-normal transition-colors">
                    &#9998;
                  </span>
                </h2>
              </div>
            )}
            {lifespan && (
              <p className="text-text-secondary text-sm font-sans mt-1">{lifespan}</p>
            )}
            {relationLabel && (
              <p className="text-accent text-xs font-sans mt-1">{relationLabel}</p>
            )}
          </div>
        </div>

        {/* Inline-editable detail fields */}
        <div className="space-y-2 mb-5">
          <EditableDetailRow label="Födelsedatum" value={form.birthDate} onChange={(v) => updateField('birthDate', v)} placeholder="ÅÅÅÅ-MM-DD" validate={isValidDate} />
          <EditableDetailRow label="Födelseort" value={form.birthPlace} onChange={(v) => updateField('birthPlace', v)} />
          <EditableDetailRow label="Födnamn" value={form.birthName} onChange={(v) => updateField('birthName', v)} placeholder="Om annat" />
          <EditableDetailRow label="Dödsdatum" value={form.deathDate} onChange={(v) => updateField('deathDate', v)} placeholder="ÅÅÅÅ-MM-DD" validate={isValidDate} />
          <EditableDetailRow label="Dödsort" value={form.deathPlace} onChange={(v) => updateField('deathPlace', v)} />
          <EditableDetailRow label="Yrke" value={form.occupation} onChange={(v) => updateField('occupation', v)} />
          <EditableDetailRow label="Kontakt" value={form.contactInfo} onChange={(v) => updateField('contactInfo', v)} />
        </div>

        {/* Photos section — always visible */}
        <div className="mb-5">
          <h3 className="font-serif font-semibold text-text-primary text-sm mb-2">Foto</h3>
          <div className="flex flex-wrap gap-2">
            {form.photos.map((url, i) => (
              <div key={i} className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden border border-bg-secondary">
                <img src={photoSrc(url)} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="absolute top-0 right-0 w-5 h-5 bg-red-600 text-white rounded-bl-lg flex items-center justify-center hover:bg-red-700 cursor-pointer"
                  aria-label="Ta bort foto"
                >
                  <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M2 2l10 10M12 2L2 12" />
                  </svg>
                </button>
              </div>
            ))}
            {/* Upload button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg border-2 border-dashed border-card-border/40 flex items-center justify-center
                         text-text-secondary hover:border-accent hover:text-accent transition-colors cursor-pointer disabled:opacity-50"
            >
              {uploading ? (
                <span className="text-xs font-sans">...</span>
              ) : (
                <span className="text-xl leading-none">+</span>
              )}
            </button>
          </div>
        </div>

        {/* Notes — single editable text field */}
        <div className="mb-5">
          <h3 className="font-serif font-semibold text-text-primary text-sm mb-2">Övrig information</h3>
          <textarea
            className="w-full px-3 py-2 text-base font-sans border border-bg-secondary rounded-lg bg-white text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent resize-none"
            rows={3}
            placeholder="Skriv fritt — anekdoter, minnen, anteckningar..."
            value={notesText}
            onChange={(e) => {
              dirty.current = true
              setForm(prev => ({
                ...prev,
                stories: [{ title: '', text: e.target.value }],
              }))
            }}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-bg-secondary">
          <button
            onClick={onAddRelative}
            className="flex-1 text-sm font-sans bg-accent text-white py-2 rounded-lg hover:bg-accent-dark transition-colors cursor-pointer"
          >
            Lägg till släkting
          </button>
          {onNavigate && (
            <button
              onClick={onNavigate}
              className="flex-1 text-sm font-sans bg-bg-secondary text-text-primary py-2 rounded-lg hover:bg-bg-secondary/70 transition-colors cursor-pointer"
            >
              Visa i trädet
            </button>
          )}
        </div>

        {/* Delete */}
        {confirmDelete ? (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm font-sans text-red-800 mb-2">
              Är du säker på att du vill ta bort {person.firstName}? Alla relationer tas också bort.
            </p>
            <div className="flex gap-2">
              <button
                onClick={onDelete}
                className="text-sm font-sans bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors cursor-pointer"
              >
                Ja, ta bort
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-sm font-sans text-text-secondary px-3 py-1.5 rounded-lg hover:bg-bg-secondary transition-colors cursor-pointer"
              >
                Avbryt
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="mt-3 w-full text-center text-xs font-sans text-red-500/70 hover:text-red-600 transition-colors cursor-pointer py-1"
          >
            Ta bort person
          </button>
        )}
      </div>
    </Modal>
  )
}

function photoSrc(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `/${path}`
}

/** Inline-editable field: tap to edit, blur/Enter to save locally */
function EditableDetailRow({ label, value, onChange, placeholder, validate }: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  validate?: (v: string) => boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const isInvalid = validate ? !validate(draft) : false

  function commit() {
    if (isInvalid) return
    onChange(draft)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex gap-3 items-center text-sm font-sans">
        <span className="text-text-secondary w-24 sm:w-28 flex-shrink-0">{label}</span>
        <input
          className={`w-full px-2 py-1.5 text-base font-sans border rounded bg-white text-text-primary placeholder:text-text-secondary/50 focus:outline-none ${isInvalid ? 'border-red-400 focus:border-red-500' : 'border-accent/60 focus:border-accent'}`}
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

