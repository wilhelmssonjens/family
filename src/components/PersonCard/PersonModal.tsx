import { useState } from 'react'
import { Modal } from '../Modal/Modal'
import { formatLifespan, formatFullName, getInitials } from '../../utils/formatPerson'
import type { Person } from '../../types'

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
}

interface Props {
  person: Person
  relationLabel: string
  onClose: () => void
  onSave: (data: EditPersonData) => void
  onAddRelative: () => void
}

export function PersonModal({ person, relationLabel, onClose, onSave, onAddRelative }: Props) {
  const [editing, setEditing] = useState(false)
  const [expandedStory, setExpandedStory] = useState<number | null>(null)
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
  })

  const fullName = formatFullName(person.firstName, person.lastName, person.birthName)
  const initials = getInitials(person.firstName, person.lastName)
  const lifespan = formatLifespan(person.birthDate, person.deathDate, person.birthPlace, person.deathPlace)

  const inputClass = 'w-full px-2 py-1.5 text-sm font-sans border border-bg-secondary rounded bg-white text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent'

  function handleSave() {
    if (!form.firstName.trim() || !form.lastName.trim()) return
    onSave(form)
    setEditing(false)
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
    })
    setEditing(false)
  }

  function updateField(field: keyof EditPersonData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
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
            <EditField label="Förnamn" value={form.firstName} onChange={(v) => updateField('firstName', v)} inputClass={inputClass} required />
            <EditField label="Efternamn" value={form.lastName} onChange={(v) => updateField('lastName', v)} inputClass={inputClass} required />
            <EditField label="Födnamn" value={form.birthName} onChange={(v) => updateField('birthName', v)} inputClass={inputClass} placeholder="Om annat än nuvarande" />
            <EditField label="Födelsedatum" value={form.birthDate} onChange={(v) => updateField('birthDate', v)} inputClass={inputClass} placeholder="ÅÅÅÅ-MM-DD" />
            <EditField label="Födelseort" value={form.birthPlace} onChange={(v) => updateField('birthPlace', v)} inputClass={inputClass} />
            <EditField label="Dödsdatum" value={form.deathDate} onChange={(v) => updateField('deathDate', v)} inputClass={inputClass} placeholder="ÅÅÅÅ-MM-DD" />
            <EditField label="Dödsort" value={form.deathPlace} onChange={(v) => updateField('deathPlace', v)} inputClass={inputClass} />
            <EditField label="Yrke" value={form.occupation} onChange={(v) => updateField('occupation', v)} inputClass={inputClass} />
            <EditField label="Kontakt" value={form.contactInfo} onChange={(v) => updateField('contactInfo', v)} inputClass={inputClass} />
          </div>

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
                src={`/${person.photos[0]}`}
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

        {/* Stories */}
        {person.stories.length > 0 && (
          <div className="mb-5">
            <h3 className="font-serif font-semibold text-text-primary text-sm mb-2">Berättelser</h3>
            <div className="space-y-2">
              {person.stories.map((story, i) => (
                <div key={i} className="border border-bg-secondary rounded-lg overflow-hidden">
                  <button
                    className="w-full text-left px-3 py-2 text-sm font-sans font-medium text-text-primary hover:bg-bg-secondary/50 transition-colors"
                    onClick={() => setExpandedStory(expandedStory === i ? null : i)}
                  >
                    {story.title}
                  </button>
                  {expandedStory === i && (
                    <p className="px-3 pb-3 text-sm font-sans text-text-secondary leading-relaxed">
                      {story.text}
                    </p>
                  )}
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
