import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom'
import { useState, useMemo, useRef, useEffect } from 'react'
import { FamilyDataProvider, useFamilyData } from './contexts/FamilyDataContext'
import { Header } from './components/Layout/Header'
import { TreeView } from './components/Tree/TreeView'
import { PersonCardExpanded } from './components/PersonCard/PersonCardExpanded'
import { AddPersonForm, type AddPersonData } from './components/AddForm/AddPersonForm'
import { SearchView } from './components/Search/SearchView'
import { GalleryView } from './components/Gallery/GalleryView'
import { buildFamilyGraph } from './utils/buildTree'
import { getRelationLabel } from './utils/formatPerson'

function TreePage() {
  const { id } = useParams()
  const { persons, relationships, loading, error } = useFamilyData()
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null)
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null)
  const [addFormState, setAddFormState] = useState<{ relationType: string; relatedToId: string } | null>(null)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const popupRef = useRef<HTMLDivElement>(null)

  const graph = useMemo(() => buildFamilyGraph(persons, relationships), [persons, relationships])

  // Clamp popup position so it doesn't go off-screen
  useEffect(() => {
    if (!popupRef.current || !popupPos) return
    const rect = popupRef.current.getBoundingClientRect()
    const parent = popupRef.current.parentElement?.getBoundingClientRect()
    if (!parent) return

    let { x, y } = popupPos
    // Keep within bounds
    if (x + rect.width > parent.width) x = parent.width - rect.width - 8
    if (x < 8) x = 8
    if (y < 8) y = 8
    if (y + rect.height > parent.height) y = parent.height - rect.height - 8

    if (x !== popupPos.x || y !== popupPos.y) {
      setPopupPos({ x, y })
    }
  }, [popupPos])

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
      const res = await fetch('/api/submit-contribution', {
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
    setPopupPos(null)
    setAddFormState(null)
  }

  return (
    <div className="flex-1 relative overflow-hidden" onClick={handleClose}>
      <TreeView
        persons={persons}
        relationships={relationships}
        centerId={centerId}
        onPersonClick={(pid, screenPos) => {
          if (expandedPersonId === pid) {
            handleClose()
          } else {
            setExpandedPersonId(pid)
            // Position popup above the card
            setPopupPos({ x: screenPos.x - 140, y: screenPos.y - 260 })
            setAddFormState(null)
          }
        }}
        onAdd={(personId, relationType) => {
          setAddFormState({ relationType, relatedToId: personId })
          setExpandedPersonId(null)
          setPopupPos(null)
        }}
        expandedPersonId={expandedPersonId}
      />

      {expandedPerson && popupPos && (
        <div
          ref={popupRef}
          className="absolute z-10 animate-in"
          style={{ left: popupPos.x, top: popupPos.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <PersonCardExpanded
            person={expandedPerson}
            relationLabel={getRelationLabel(graph, expandedPerson.id, persons)}
            onClose={handleClose}
            onEdit={() => {
              setAddFormState({ relationType: 'edit', relatedToId: expandedPerson.id })
              setExpandedPersonId(null)
              setPopupPos(null)
            }}
          />
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
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-accent text-white font-sans text-sm px-4 py-2 rounded-lg shadow-md">
          Tack! Ditt bidrag har skickats.
        </div>
      )}
      {submitStatus === 'error' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-600 text-white font-sans text-sm px-4 py-2 rounded-lg shadow-md">
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
