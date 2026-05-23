import { useEffect, useState } from 'react'

const KEY = 'famtree:navtrail'

function read(): string[] {
  try {
    const raw = sessionStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function write(trail: string[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(trail))
  } catch {
    // sessionStorage unavailable (private mode etc.) — trail is best-effort
  }
}

/**
 * Tracks the path of tree-navigations as a breadcrumb trail of person IDs
 * (excluding the home person). Returning home clears it; revisiting a person
 * already in the trail truncates back to that point. Backed by sessionStorage
 * so it survives the route remount when navigating between `/` and `/person/:id`.
 */
export function useNavTrail(centerId: string, homeId: string): string[] {
  const [trail, setTrail] = useState<string[]>(read)

  useEffect(() => {
    setTrail((prev) => {
      let next: string[]
      if (centerId === homeId) {
        next = []
      } else {
        const idx = prev.indexOf(centerId)
        next = idx >= 0 ? prev.slice(0, idx + 1) : [...prev, centerId]
      }
      write(next)
      return next
    })
  }, [centerId, homeId])

  return trail
}
