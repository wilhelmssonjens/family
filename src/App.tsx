import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom'
import { useState, useMemo } from 'react'
import { FamilyDataProvider, useFamilyData } from './contexts/FamilyDataContext'
import { Header } from './components/Layout/Header'
import { TreeView } from './components/Tree/TreeView'
import { PersonCardExpanded } from './components/PersonCard/PersonCardExpanded'
import { AddPersonForm, type AddPersonData } from './components/AddForm/AddPersonForm'
import { SearchView } from './components/Search/SearchView'
import { GalleryView } from './components/Gallery/GalleryView'
import { buildFamilyGraph } from './utils/buildTree'
import { getRelationLabel } from './utils/formatPerson'

// Config: set to true to require GitHub Issue approval, false for direct edits
const REQUIRE_APPROVAL = false

function TreePage() {
  const { id } = useParams()
  const { persons, relationships, loading, error } = useFamilyData()
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null)
  const [addFormState, setAddFormState] = useState<{ relationType: string; relatedToId: string } | null>(null)
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
  const expandedPerson = persons.find(p => p.id === expandedPersonId)

  async function handleFormSubmit(data: AddPersonData) {
    setSubmitStatus('sending')
    try {
      const endpoint = REQUIRE_APPROVAL ? '/api/submit-contribution' : '/api/submit-direct'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, relatedToId: addFormState?.relatedToId }),
      })
      if (!res.ok) throw new Error()
      setSubmitStatus('success')
      setAddFormState(null)
      setTimeout(() => setSubmitStatus('idle'), 3000)
    } catch {
      setSubmitStatus('error')
      setTimeout(() => setSubmitStatus('idle'), 3000)
    }
  }

  function handleClose() {
    setExpandedPersonId(null)
    setAddFormState(null)
  }

  const expandedCardElement = expandedPerson ? (
    <PersonCardExpanded
      person={expandedPerson}
      relationLabel={getRelationLabel(graph, expandedPerson.id, persons)}
      onClose={handleClose}
      onEdit={() => {
        setAddFormState({ relationType: 'edit', relatedToId: expandedPerson.id })
        setExpandedPersonId(null)
      }}
    />
  ) : null

  return (
    <div className="flex-1 relative overflow-hidden" onClick={handleClose}>
      <TreeView
        persons={persons}
        relationships={relationships}
        centerId={centerId}
        onPersonClick={(pid) => {
          setExpandedPersonId(prev => prev === pid ? null : pid)
          setAddFormState(null)
        }}
        onAdd={(personId, relationType) => {
          setAddFormState({ relationType, relatedToId: personId })
          setExpandedPersonId(null)
        }}
        expandedPersonId={expandedPersonId}
        expandedCardContent={expandedCardElement}
      />

      {/* Mobile overlay for expanded person card */}
      {expandedCardElement && (
        <div
          className="md:hidden fixed inset-0 z-30 flex items-end justify-center"
          onClick={handleClose}
        >
          <div className="absolute inset-0 bg-black/20" />
          <div
            className="relative w-full max-w-sm mx-4 mb-4 animate-in"
            onClick={(e) => e.stopPropagation()}
          >
            {expandedCardElement}
          </div>
        </div>
      )}

      {addFormState && (
        <div className="absolute top-4 left-4 z-10" onClick={(e) => e.stopPropagation()}>
          <AddPersonForm
            relationType={addFormState.relationType}
            onSubmit={handleFormSubmit}
            onCancel={() => setAddFormState(null)}
          />
        </div>
      )}

      {submitStatus === 'success' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-accent text-white font-sans text-sm px-4 py-2 rounded-lg shadow-md z-20">
          {REQUIRE_APPROVAL ? 'Tack! Ditt bidrag har skickats för granskning.' : 'Tack! Informationen har lagts till.'}
        </div>
      )}
      {submitStatus === 'error' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-600 text-white font-sans text-sm px-4 py-2 rounded-lg shadow-md z-20">
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
