import { BrowserRouter, Routes, Route, useParams, useNavigate } from 'react-router-dom'
import { useState, useMemo } from 'react'
import { FamilyDataProvider, useFamilyData } from './contexts/FamilyDataContext'
import { Header } from './components/Layout/Header'
import { TreeView } from './components/Tree/TreeView'
import { FocusedTreeView } from './components/FocusedTree/FocusedTreeView'
import { FamilyListView } from './components/FamilyList/FamilyListView'
import { PersonModal, type EditPersonData } from './components/PersonCard/PersonModal'
import { AddRelativeModal, type AddRelativeData } from './components/AddForm/AddRelativeModal'
import { SearchView } from './components/Search/SearchView'
import { GalleryView } from './components/Gallery/GalleryView'
import type { Person, Relationship } from './types'
import { buildFamilyGraph } from './utils/buildTree'
import { getRelationLabel } from './utils/formatPerson'
import { enqueueApiCall } from './utils/apiQueue'

// Config: set to true to require GitHub Issue approval, false for direct edits
const REQUIRE_APPROVAL = false

/**
 * Shared logic for pages that show person modals (focused view + full tree).
 * Accepts a `view` prop to render either FocusedTreeView or TreeView.
 */
function FamilyPage({ view }: { view: 'focused' | 'tree' }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { persons, relationships, loading, error, updatePerson, removePerson, addPerson, addRelationships } = useFamilyData()
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const [showAddRelative, setShowAddRelative] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')

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

  const showError = () => {
    setSubmitStatus('error')
    setTimeout(() => setSubmitStatus('idle'), 3000)
  }

  function handleEditSave(data: EditPersonData) {
    const editId = selectedPersonId
    // Optimistic: update locally + close modal immediately
    if (editId) {
      updatePerson(editId, {
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
    setSelectedPersonId(null)

    // Enqueue API call — runs after any pending calls finish
    const endpoint = REQUIRE_APPROVAL ? '/api/submit-contribution' : '/api/submit-direct'
    enqueueApiCall(async () => {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, relationType: 'edit', relatedToId: editId }),
      })
      if (!res.ok) throw new Error()
    }, showError)
  }

  function handleDelete() {
    const deleteId = selectedPersonId
    if (deleteId) removePerson(deleteId)
    setSelectedPersonId(null)

    const endpoint = REQUIRE_APPROVAL ? '/api/submit-contribution' : '/api/submit-direct'
    enqueueApiCall(async () => {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relationType: 'delete', relatedToId: deleteId }),
      })
      if (!res.ok) throw new Error()
    }, showError)
  }

  function handleAddRelative(data: AddRelativeData) {
    const anchorId = selectedPersonId
    const anchorFamilySide = selectedPerson?.familySide ?? 'jens'
    setShowAddRelative(false)
    setSelectedPersonId(null)

    if (!anchorId) return

    const endpoint = REQUIRE_APPROVAL ? '/api/submit-contribution' : '/api/submit-direct'

    if (data.existingPersonId) {
      // Link existing person — optimistic local update
      const newRels: Relationship[] = []
      if (data.relationType === 'parent') {
        newRels.push({ type: 'parent', from: data.existingPersonId, to: anchorId })
      } else if (data.relationType === 'child') {
        newRels.push({ type: 'parent', from: anchorId, to: data.existingPersonId })
      } else if (data.relationType === 'partner') {
        newRels.push({ type: 'partner', from: anchorId, to: data.existingPersonId, status: 'current' })
      } else if (data.relationType === 'sibling') {
        const parentRels = relationships.filter(r => r.type === 'parent' && r.to === anchorId)
        if (parentRels.length > 0) {
          for (const pr of parentRels) {
            newRels.push({ type: 'parent', from: pr.from, to: data.existingPersonId })
          }
        }
        newRels.push({ type: 'sibling', from: anchorId, to: data.existingPersonId })
      }
      addRelationships(newRels)

      enqueueApiCall(async () => {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            relationType: 'link',
            relatedToId: anchorId,
            existingPersonId: data.existingPersonId,
            linkRelationType: data.relationType,
          }),
        })
        if (!res.ok) throw new Error()
      }, showError)
    } else {
      // Create new person — optimistic with temp ID
      const tempId = data.firstName.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now()
      const newPerson: Person = {
        id: tempId,
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
        familySide: anchorFamilySide,
      }
      const newRels: Relationship[] = []
      if (data.relationType === 'parent') {
        newRels.push({ type: 'parent', from: tempId, to: anchorId })
      } else if (data.relationType === 'child') {
        newRels.push({ type: 'parent', from: anchorId, to: tempId })
      } else if (data.relationType === 'partner') {
        newRels.push({ type: 'partner', from: anchorId, to: tempId, status: 'current' })
      } else if (data.relationType === 'sibling') {
        const parentRels = relationships.filter(r => r.type === 'parent' && r.to === anchorId)
        if (parentRels.length > 0) {
          // Anchor has parents — share them with the new sibling
          for (const pr of parentRels) {
            newRels.push({ type: 'parent', from: pr.from, to: tempId })
          }
        }
        // Always add direct sibling relation (works even without parents)
        newRels.push({ type: 'sibling', from: anchorId, to: tempId })
      }
      addPerson(newPerson, newRels)

      enqueueApiCall(async () => {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, relatedToId: anchorId }),
        })
        if (!res.ok) throw new Error()
      }, showError)
    }
  }

  return (
    <div className={`flex-1 relative ${view === 'focused' ? 'overflow-auto' : 'overflow-hidden'}`}>
      {view === 'focused' ? (
        <FocusedTreeView
          persons={persons}
          relationships={relationships}
          centerId={centerId}
          onPersonClick={(pid) => setSelectedPersonId(pid)}
        />
      ) : (
        <TreeView
          persons={persons}
          relationships={relationships}
          centerId={centerId}
          highlightPersonId={null}
          onPersonClick={(pid) => setSelectedPersonId(pid)}
        />
      )}

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
          onNavigate={selectedPersonId !== centerId ? () => {
            setSelectedPersonId(null)
            navigate(`/person/${selectedPersonId}`)
          } : undefined}
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

function FamilyListPage() {
  const { persons, relationships } = useFamilyData()
  const navigate = useNavigate()

  if (persons.length === 0) return <div className="flex-1 flex items-center justify-center font-sans text-text-secondary">Laddar...</div>

  return (
    <FamilyListView
      persons={persons}
      relationships={relationships}
      onPersonClick={(id) => navigate(`/person/${id}`)}
    />
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
            <Route path="/" element={<FamilyPage view="focused" />} />
            <Route path="/person/:id" element={<FamilyPage view="focused" />} />
            <Route path="/lista" element={<FamilyListPage />} />
            <Route path="/sok" element={<SearchPage />} />
            <Route path="/galleri" element={<GalleryPage />} />
          </Routes>
        </div>
      </FamilyDataProvider>
    </BrowserRouter>
  )
}
