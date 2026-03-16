import type { FamilyGraph } from './buildTree'
import type { Person } from '../types'

export function formatLifespan(
  birthDate: string | null,
  deathDate: string | null,
  birthPlace: string | null,
  deathPlace: string | null,
): string {
  if (!birthDate) return ''

  const birthYear = birthDate.slice(0, 4)
  let result = `f. ${birthYear}`
  if (birthPlace) result += ` i ${birthPlace}`

  if (deathDate) {
    const deathYear = deathDate.slice(0, 4)
    result += ` – d. ${deathYear}`
    if (deathPlace) result += ` i ${deathPlace}`
  }

  return result
}

export function formatFullName(
  firstName: string,
  lastName: string,
  birthName: string | null,
): string {
  const name = `${firstName} ${lastName}`
  if (birthName) return `${name} (född ${birthName})`
  return name
}

export function getInitials(firstName: string, lastName: string): string {
  const first = firstName?.[0] ?? ''
  const last = lastName?.[0] ?? ''
  return `${first}${last}`.toUpperCase()
}

export function getRelationLabel(
  graph: FamilyGraph,
  personId: string,
  persons: Person[],
): string {
  const node = graph.get(personId)
  if (!node) return ''

  const labels: string[] = []

  for (const childId of node.childIds) {
    const child = persons.find(p => p.id === childId)
    if (child) {
      const parentWord = node.person.gender === 'female' ? 'Mor' : 'Far'
      labels.push(`${parentWord} till ${child.firstName}`)
    }
  }

  for (const partnerId of node.partnerIds) {
    const partner = persons.find(p => p.id === partnerId)
    if (partner) {
      labels.push(`Gift med ${partner.firstName}`)
    }
  }

  return labels.join(' · ')
}
