import { useState, useRef } from 'react'
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
}

export function PersonModal({ person, persons, relationLabel, onClose, onSave, onDelete, onAddRelative }: Props) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
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

  function handleSave() {
    if (!form.firstName.trim() || !form.lastName.trim()) return
    onSave(form)
    onClose()
  }

  function handleCancel() {
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

  function updateField(field: keyof EditPersonData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function updateStory(index: number, field: 'title' | 'text', value: string) {
    setForm(prev => ({
      ...prev,
      stories: prev.stories.map((s, i) => i === index ? { ...s, [field]: value } : s),
    }))
  }

  function addStory() {
    setForm(prev => ({ ...prev, stories: [...prev.stories, { title: '', text: '' }] }))
  }

  function removeStory(index: number) {
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
      setForm(prev => ({ ...prev, photos: [...prev.photos, url] }))
    } catch {
      alert('Kunde inte ladda upp bilden. Försök igen.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function removePhoto(index: number) {
    setForm(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== index) }))
  }

  if (editing) {
    return (
      <Modal onClose={handleCancel}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-xl bg-bg-secondary border-2 border-card-border flex items-center justify-center flex-shrink-0">
              <span className="text-accent font-sans font-semibold text-xl">{initials}</span>
            </div>
            <h2 className="font-serif font-bold text-text-primary text-lg">Redigera</h2>
          </div>

          {/* Edit form */}
          <div className="space-y-3 mb-5">
            <div className="flex gap-3 items-center text-sm font-sans">
              <label className="text-text-secondary w-28 flex-shrink-0">Förnamn</label>
              <NameSuggestInput className={inputClass} value={form.firstName} onChange={(v) => updateField('firstName', v)} suggestions={persons.map(p => p.firstName)} required />
            </div>
            <div className="flex gap-3 items-center text-sm font-sans">
              <label className="text-text-secondary w-28 flex-shrink-0">Efternamn</label>
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
              onClick={handleSave}
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

  return (
    <Modal onClose={onClose}>
      <div className="p-6">
        {/* Header: photo + name */}
        <div className="flex items-start gap-4 mb-5">
          <div className="w-20 h-20 rounded-xl bg-bg-secondary border-2 border-card-border flex items-center justify-center flex-shrink-0 overflow-hidden">
            {person.photos.length > 0 ? (
              <img
                src={photoSrc(person.photos[0])}
                alt={person.firstName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-accent font-sans font-semibold text-2xl">{initials}</span>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="font-serif font-bold text-text-primary text-lg leading-tight">{fullName}</h2>
            {lifespan && (
              <p className="text-text-secondary text-sm font-sans mt-1">{lifespan}</p>
            )}
            {relationLabel && (
              <p className="text-accent text-xs font-sans mt-1">{relationLabel}</p>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="space-y-3 mb-5">
          {person.birthDate && (
            <DetailRow label="Födelsedatum" value={person.birthDate} />
          )}
          {person.birthPlace && (
            <DetailRow label="Födelseort" value={person.birthPlace} />
          )}
          {person.birthName && (
            <DetailRow label="Födnamn" value={person.birthName} />
          )}
          {person.deathDate && (
            <DetailRow label="Dödsdatum" value={person.deathDate} />
          )}
          {person.deathPlace && (
            <DetailRow label="Dödsort" value={person.deathPlace} />
          )}
          {person.occupation && (
            <DetailRow label="Yrke" value={person.occupation} />
          )}
          {person.contactInfo && (
            <DetailRow label="Kontakt" value={person.contactInfo} />
          )}
        </div>

        {/* Övrig information (formerly "Berättelser") */}
        {person.stories.length > 0 && (
          <div className="mb-5">
            <h3 className="font-serif font-semibold text-text-primary text-sm mb-2">Övrig information</h3>
            <div className="space-y-3">
              {person.stories.map((story, i) => (
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
            onClick={() => setEditing(true)}
            className="flex-1 text-sm font-sans bg-accent text-white py-2 rounded-lg hover:bg-accent-dark transition-colors"
          >
            Redigera
          </button>
          <button
            onClick={onAddRelative}
            className="flex-1 text-sm font-sans bg-bg-secondary text-text-primary py-2 rounded-lg hover:bg-bg-secondary/70 transition-colors"
          >
            Lägg till släkting
          </button>
          <button
            onClick={onClose}
            className="text-sm font-sans text-text-secondary px-4 py-2 rounded-lg hover:bg-bg-secondary transition-colors"
          >
            Stäng
          </button>
        </div>
      </div>
    </Modal>
  )
}

function photoSrc(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `/${path}`
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-sm font-sans">
      <span className="text-text-secondary w-28 flex-shrink-0">{label}</span>
      <span className="text-text-primary">{value}</span>
    </div>
  )
}

function EditField({ label, value, onChange, inputClass, placeholder, required }: {
  label: string
  value: string
  onChange: (value: string) => void
  inputClass: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <div className="flex gap-3 items-center text-sm font-sans">
      <label className="text-text-secondary w-28 flex-shrink-0">{label}</label>
      <input
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </div>
  )
}
