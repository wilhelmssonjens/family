import { useState, useMemo } from 'react'
import type { Person } from '../types'

export function searchPersons(persons: Person[], query: string): Person[] {
  if (!query.trim()) return persons

  const lower = query.toLowerCase()
  return persons.filter((p) =>
    p.firstName.toLowerCase().includes(lower) ||
    p.lastName.toLowerCase().includes(lower) ||
    (p.birthPlace?.toLowerCase().includes(lower) ?? false) ||
    (p.occupation?.toLowerCase().includes(lower) ?? false)
  )
}

export function useSearch(persons: Person[]) {
  const [query, setQuery] = useState('')
  const results = useMemo(() => searchPersons(persons, query), [persons, query])
  return { query, setQuery, results }
}
