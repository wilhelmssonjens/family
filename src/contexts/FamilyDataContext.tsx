import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Person, Relationship } from '../types'

interface FamilyDataState {
  persons: Person[]
  relationships: Relationship[]
  loading: boolean
  error: string | null
  getPersonById: (id: string) => Person | undefined
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

  return (
    <FamilyDataContext.Provider value={{ persons, relationships, loading, error, getPersonById }}>
      {children}
    </FamilyDataContext.Provider>
  )
}

export function useFamilyData() {
  const ctx = useContext(FamilyDataContext)
  if (!ctx) throw new Error('useFamilyData must be used within FamilyDataProvider')
  return ctx
}
