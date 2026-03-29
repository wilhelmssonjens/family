import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react'
import type { Person, Relationship } from '../types'

interface FamilyDataState {
  persons: Person[]
  relationships: Relationship[]
  loading: boolean
  error: string | null
  getPersonById: (id: string) => Person | undefined
  updatePerson: (id: string, data: Partial<Person>) => void
  removePerson: (id: string) => void
  addPerson: (person: Person, newRelationships: Relationship[]) => void
  addRelationships: (newRelationships: Relationship[]) => void
  replacePersonId: (tempId: string, permanentId: string) => void
  reloadFromServer: () => Promise<void>
}

const FamilyDataContext = createContext<FamilyDataState | null>(null)

export function FamilyDataProvider({ children }: { children: ReactNode }) {
  const [persons, setPersons] = useState<Person[]>([])
  const [relationships, setRelationships] = useState<Relationship[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [personsRes, relsRes] = await Promise.all([
        fetch('/data/persons.json'),
        fetch('/data/relationships.json'),
      ])
      if (!personsRes.ok || !relsRes.ok) {
        throw new Error('Kunde inte ladda data')
      }
      const [personsData, relsData] = await Promise.all([
        personsRes.json(),
        relsRes.json(),
      ])
      setPersons(personsData)
      setRelationships(relsData)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Okänt fel')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Issue 14: memoized person lookup map
  const personMap = useMemo(() => new Map(persons.map(p => [p.id, p])), [persons])
  const getPersonById = useCallback((id: string) => personMap.get(id), [personMap])

  const updatePerson = useCallback((id: string, data: Partial<Person>) => {
    setPersons(prev => prev.map(p => p.id === id ? { ...p, ...data } : p))
  }, [])

  const removePerson = useCallback((id: string) => {
    setPersons(prev => prev.filter(p => p.id !== id))
    setRelationships(prev => prev.filter(r => r.from !== id && r.to !== id))
  }, [])

  const addPerson = useCallback((person: Person, newRelationships: Relationship[]) => {
    setPersons(prev => [...prev, person])
    setRelationships(prev => [...prev, ...newRelationships])
  }, [])

  const addRelationships = useCallback((newRelationships: Relationship[]) => {
    setRelationships(prev => [...prev, ...newRelationships])
  }, [])

  // Issue 13: replace temp ID with server-assigned permanent ID
  const replacePersonId = useCallback((tempId: string, permanentId: string) => {
    setPersons(prev => prev.map(p => p.id === tempId ? { ...p, id: permanentId } : p))
    setRelationships(prev => prev.map(r => ({
      ...r,
      from: r.from === tempId ? permanentId : r.from,
      to: r.to === tempId ? permanentId : r.to,
    })))
  }, [])

  // Issue 3: reload data from server (used on API error to restore truth)
  const reloadFromServer = useCallback(async () => {
    await loadData()
  }, [loadData])

  return (
    <FamilyDataContext.Provider value={{
      persons, relationships, loading, error,
      getPersonById, updatePerson, removePerson, addPerson, addRelationships,
      replacePersonId, reloadFromServer,
    }}>
      {children}
    </FamilyDataContext.Provider>
  )
}

export function useFamilyData() {
  const ctx = useContext(FamilyDataContext)
  if (!ctx) throw new Error('useFamilyData must be used within FamilyDataProvider')
  return ctx
}
