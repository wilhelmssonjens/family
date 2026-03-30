import { useState, useRef, useCallback } from 'react'
import { Modal } from '../Modal/Modal'
import { formatLifespan } from '../../utils/formatPerson'
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

  const lifespan = formatLifespan(person.birthDate, person.deathDate, person.birthPlace, person.deathPlace)

  // Flatten stories into a single text block for display
  const notesText = form.stories.map(s => [s.title, s.text].filter(Boolean).join(': ')).join('\n\n')
  const [notesDraft, setNotesDraft] = useState(notesText)
  const notesFocused = useRef(false)

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
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <div
              className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-bg-secondary flex items-center justify-center overflow-hidden cursor-pointer group relative
                ${form.photos.length > 0 ? 'border-2 border-card-border' : 'border-2 border-dashed border-accent/50'}`}
              onClick={() => fileInputRef.current?.click()}
            >
              {form.photos.length > 0 ? (
                <img
                  src={photoSrc(form.photos[0])}
                  alt={person.firstName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-accent/60">
                    <rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="12" cy="13" r="3" /><path d="M9 5l1-2h4l1 2" />
                  </svg>
                  <span className="text-accent/60 font-sans text-[9px]">Lägg till</span>
                </div>
              )}
              {/* Camera overlay on hover (only when photo exists) */}
              {form.photos.length > 0 && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-white/0 group-hover:text-white/90 transition-colors">
                    <rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="12" cy="13" r="3" /><path d="M9 5l1-2h4l1 2" />
                  </svg>
                </div>
              )}
            </div>
            {uploading && <span className="text-[10px] font-sans text-text-secondary">Laddar upp...</span>}
            {/* Extra photo thumbnails */}
            {form.photos.length > 1 && (
              <div className="flex gap-1">
                {form.photos.slice(1).map((url, i) => (
                  <div key={i} className="relative w-7 h-7 rounded overflow-hidden border border-bg-secondary">
                    <img src={photoSrc(url)} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removePhoto(i + 1) }}
                      className="absolute inset-0 bg-black/0 hover:bg-black/40 flex items-center justify-center transition-colors cursor-pointer"
                      aria-label="Ta bort foto"
                    >
                      <svg width="8" height="8" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-white/0 hover:text-white">
                        <path d="M2 2l10 10M12 2L2 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            {/* Delete main photo link */}
            {form.photos.length > 0 && (
              <button
                type="button"
                onClick={() => removePhoto(0)}
                className="text-[10px] font-sans text-red-400 hover:text-red-600 transition-colors cursor-pointer"
              >
                Ta bort foto
              </button>
            )}
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
          <EditableDetailRow label="Födelsenamn" value={form.birthName} onChange={(v) => updateField('birthName', v)} placeholder="Om annat" />
          <EditableDetailRow label="Dödsdatum" value={form.deathDate} onChange={(v) => updateField('deathDate', v)} placeholder="ÅÅÅÅ-MM-DD" validate={isValidDate} />
          <EditableDetailRow label="Dödsort" value={form.deathPlace} onChange={(v) => updateField('deathPlace', v)} />
          <EditableDetailRow label="Yrke" value={form.occupation} onChange={(v) => updateField('occupation', v)} />
          <EditableDetailRow label="Kontakt" value={form.contactInfo} onChange={(v) => updateField('contactInfo', v)} />
        </div>

        {/* Notes — single editable text field */}
        <div className="mb-5">
          <h3 className="font-serif font-semibold text-text-primary text-sm mb-2">Övrig information</h3>
          <textarea
            className="w-full px-3 py-2 text-base font-sans border border-bg-secondary rounded-lg bg-white text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent resize-none"
            rows={3}
            placeholder="Skriv fritt — anekdoter, minnen, anteckningar..."
            value={notesFocused.current ? notesDraft : notesText}
            onFocus={() => { notesFocused.current = true; setNotesDraft(notesText) }}
            onChange={(e) => {
              dirty.current = true
              setNotesDraft(e.target.value)
            }}
            onBlur={() => {
              notesFocused.current = false
              setForm(prev => ({
                ...prev,
                stories: [{ title: '', text: notesDraft }],
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
              Visa släktträd
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

