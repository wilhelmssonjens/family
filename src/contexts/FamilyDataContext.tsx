import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
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
}

const FamilyDataContext = createContext<FamilyDataState | null>(null)

export function FamilyDataProvider({ children }: { children: ReactNode }) {
  const [persons, setPersons] = useState<Person[]>([])
  const [relationships, setRelationships] = useState<Relationship[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
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
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Okänt fel')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  function getPersonById(id: string) {
    return persons.find((p) => p.id === id)
  }

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

  return (
    <FamilyDataContext.Provider value={{
      persons, relationships, loading, error,
      getPersonById, updatePerson, removePerson, addPerson,
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
