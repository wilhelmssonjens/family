import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom'
import { useState, useMemo } from 'react'
import { FamilyDataProvider, useFamilyData } from './contexts/FamilyDataContext'
import { Header } from './components/Layout/Header'
import { TreeView } from './components/Tree/TreeView'
import { PersonModal, type EditPersonData } from './components/PersonCard/PersonModal'
import { AddRelativeModal, type AddRelativeData } from './components/AddForm/AddRelativeModal'
import { SearchView } from './components/Search/SearchView'
import { GalleryView } from './components/Gallery/GalleryView'
import type { Person, Relationship } from './types'
import { buildFamilyGraph } from './utils/buildTree'
import { getRelationLabel } from './utils/formatPerson'

// Config: set to true to require GitHub Issue approval, false for direct edits
const REQUIRE_APPROVAL = false

function TreePage() {
  const { id } = useParams()
  const { persons, relationships, loading, error, updatePerson, removePerson, addPerson, addRelationships } = useFamilyData()
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const [showAddRelative, setShowAddRelative] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null)

  const graph = useMemo(() => buildFamilyGraph(persons, relationships), [persons, relationships])

  if (loading) return <div className="flex-1 flex items-center justify-center font-sans text-text-secondary">Laddar...</div>
  if (error) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3">
      <p className="font-sans text-red-600">{error}</p>
      <button onClick={() => window.location.reload()} className="font-sans text-sm text-accent hover:underline">Försök igen</button>
    </div>
  )
  if (persons.length === 0) return <div className="flex-1 flex items-center justify-center font-sans text-text-secondary">Inga personer ännu</div>

  const centerId = id ?? 'jens'
  const selectedPerson = persons.find(p => p.id === selectedPersonId)

  async function handleEditSave(data: EditPersonData) {
    setSubmitStatus('sending')
    try {
      const endpoint = REQUIRE_APPROVAL ? '/api/submit-contribution' : '/api/submit-direct'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, relationType: 'edit', relatedToId: selectedPersonId }),
      })
      if (!res.ok) throw new Error()
      if (selectedPersonId) {
        updatePerson(selectedPersonId, {
          firstName: data.firstName,
          lastName: data.lastName,
          birthName: data.birthName || null,
          birthDate: data.birthDate || null,
          birthPlace: data.birthPlace || null,
          deathDate: data.deathDate || null,
          deathPlace: data.deathPlace || null,
          occupation: data.occupation || null,
          contactInfo: data.contactInfo || null,
          stories: data.stories.filter(s => s.title || s.text),
          photos: data.photos,
        })
      }
      setSubmitStatus('success')
      setTimeout(() => setSubmitStatus('idle'), 3000)
    } catch {
      setSubmitStatus('error')
      setTimeout(() => setSubmitStatus('idle'), 3000)
    }
  }

  async function handleDelete() {
    setSubmitStatus('sending')
    try {
      const endpoint = REQUIRE_APPROVAL ? '/api/submit-contribution' : '/api/submit-direct'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relationType: 'delete', relatedToId: selectedPersonId }),
      })
      if (!res.ok) throw new Error()
      if (selectedPersonId) {
        removePerson(selectedPersonId)
      }
      setSubmitStatus('success')
      setSelectedPersonId(null)
      setTimeout(() => setSubmitStatus('idle'), 3000)
    } catch {
      setSubmitStatus('error')
      setTimeout(() => setSubmitStatus('idle'), 3000)
    }
  }

  async function handleAddRelative(data: AddRelativeData) {
    setSubmitStatus('sending')
    try {
      const endpoint = REQUIRE_APPROVAL ? '/api/submit-contribution' : '/api/submit-direct'

      if (data.existingPersonId && selectedPersonId) {
        // Link existing person — only create relationship
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            relationType: 'link',
            relatedToId: selectedPersonId,
            existingPersonId: data.existingPersonId,
            linkRelationType: data.relationType,
          }),
        })
        if (!res.ok) throw new Error()

        const newRels: Relationship[] = []
        if (data.relationType === 'parent') {
          newRels.push({ type: 'parent', from: data.existingPersonId, to: selectedPersonId })
        } else if (data.relationType === 'child') {
          newRels.push({ type: 'parent', from: selectedPersonId, to: data.existingPersonId })
        } else if (data.relationType === 'partner') {
          newRels.push({ type: 'partner', from: selectedPersonId, to: data.existingPersonId, status: 'current' })
        } else if (data.relationType === 'sibling') {
          const parentRels = relationships.filter(r => r.type === 'parent' && r.to === selectedPersonId)
          for (const pr of parentRels) {
            newRels.push({ type: 'parent', from: pr.from, to: data.existingPersonId })
          }
        }
        addRelationships(newRels)
        setNewlyAddedId(data.existingPersonId)
        setTimeout(() => setNewlyAddedId(null), 1500)
      } else {
        // Create new person + relationship
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, relatedToId: selectedPersonId }),
        })
        if (!res.ok) throw new Error()
        const result = await res.json()
        if (result.personId && selectedPersonId) {
          const newPerson: Person = {
            id: result.personId,
            firstName: data.firstName,
            lastName: data.lastName,
            birthName: data.birthName ?? null,
            birthDate: data.birthDate ?? null,
            birthPlace: data.birthPlace ?? null,
            deathDate: data.deathDate ?? null,
            deathPlace: data.deathPlace ?? null,
            gender: data.gender,
            occupation: data.occupation ?? null,
            photos: [],
            stories: data.story ? [{ title: 'Berättelse', text: data.story }] : [],
            contactInfo: null,
            familySide: selectedPerson?.familySide ?? 'jens',
          }
          const newRels: Relationship[] = []
          if (data.relationType === 'parent') {
            newRels.push({ type: 'parent', from: result.personId, to: selectedPersonId })
          } else if (data.relationType === 'child') {
            newRels.push({ type: 'parent', from: selectedPersonId, to: result.personId })
          } else if (data.relationType === 'partner') {
            newRels.push({ type: 'partner', from: selectedPersonId, to: result.personId, status: 'current' })
          } else if (data.relationType === 'sibling') {
            const parentRels = relationships.filter(r => r.type === 'parent' && r.to === selectedPersonId)
            for (const pr of parentRels) {
              newRels.push({ type: 'parent', from: pr.from, to: result.personId })
            }
          }
          addPerson(newPerson, newRels)
          setNewlyAddedId(result.personId)
          setTimeout(() => setNewlyAddedId(null), 1500)
        }
      }

      setSubmitStatus('success')
      setShowAddRelative(false)
      setSelectedPersonId(null)
      setTimeout(() => setSubmitStatus('idle'), 3000)
    } catch {
      setSubmitStatus('error')
      setTimeout(() => setSubmitStatus('idle'), 3000)
    }
  }

  return (
    <div className="flex-1 relative overflow-hidden">
      <TreeView
        persons={persons}
        relationships={relationships}
        centerId={centerId}
        highlightPersonId={newlyAddedId}
        onPersonClick={(pid) => setSelectedPersonId(pid)}
      />

      {/* Person detail modal */}
      {selectedPerson && !showAddRelative && (
        <PersonModal
          person={selectedPerson}
          persons={persons}
          relationLabel={getRelationLabel(graph, selectedPerson.id, persons)}
          onClose={() => setSelectedPersonId(null)}
          onSave={handleEditSave}
          onDelete={handleDelete}
          onAddRelative={() => setShowAddRelative(true)}
        />
      )}

      {/* Add relative modal */}
      {selectedPerson && showAddRelative && (
        <AddRelativeModal
          relatedPersonName={selectedPerson.firstName}
          relatedPersonId={selectedPerson.id}
          persons={persons}
          onSubmit={handleAddRelative}
          onCancel={() => setShowAddRelative(false)}
        />
      )}

      {/* Status toasts */}
      {submitStatus === 'success' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-accent text-white font-sans text-sm px-4 py-2 rounded-lg shadow-md z-60">
          {REQUIRE_APPROVAL ? 'Tack! Ditt bidrag har skickats för granskning.' : 'Tack! Informationen har lagts till.'}
        </div>
      )}
      {submitStatus === 'error' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-600 text-white font-sans text-sm px-4 py-2 rounded-lg shadow-md z-60">
          Något gick fel. Försök igen.
        </div>
      )}
    </div>
  )
}

function SearchPage() {
  const { persons } = useFamilyData()
  return <SearchView persons={persons} />
}

function GalleryPage() {
  const { persons } = useFamilyData()
  return <GalleryView persons={persons} />
}

export default function App() {
  return (
    <BrowserRouter>
      <FamilyDataProvider>
        <div className="flex flex-col h-screen bg-bg-primary font-sans text-text-primary">
          <Header />
          <Routes>
            <Route path="/" element={<TreePage />} />
            <Route path="/person/:id" element={<TreePage />} />
            <Route path="/sok" element={<SearchPage />} />
            <Route path="/galleri" element={<GalleryPage />} />
          </Routes>
        </div>
      </FamilyDataProvider>
    </BrowserRouter>
  )
}
