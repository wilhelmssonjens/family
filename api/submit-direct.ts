import type { VercelRequest, VercelResponse } from '@vercel/node'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const REPO_OWNER = process.env.GITHUB_REPO_OWNER
const REPO_NAME = process.env.GITHUB_REPO_NAME

// Simple in-memory rate limiting
const requestCounts = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60 * 60 * 1000

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = requestCounts.get(ip)
  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return false
  }
  entry.count++
  return entry.count > RATE_LIMIT
}

async function getFile(path: string): Promise<{ content: string; sha: string } | null> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`,
    {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
      },
    }
  )
  if (!res.ok) return null
  const data = await res.json()
  return {
    content: Buffer.from(data.content, 'base64').toString('utf-8'),
    sha: data.sha,
  }
}

async function updateFile(path: string, content: string, sha: string, message: string) {
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        content: Buffer.from(content).toString('base64'),
        sha,
      }),
    }
  )
  return res.ok
}

function generateId(firstName: string, lastName: string): string {
  return `${firstName}-${lastName}`.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? 'unknown'
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'För många förfrågningar. Försök igen senare.' })
  }

  const { firstName, lastName, relationType, honeypot, relatedToId, ...rest } = req.body

  if (honeypot) {
    return res.status(200).json({ success: true })
  }

  if (!firstName || !lastName) {
    return res.status(400).json({ error: 'Förnamn och efternamn krävs.' })
  }

  if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME) {
    return res.status(500).json({ error: 'Server configuration error' })
  }

  try {
    // Load current data files
    const personsFile = await getFile('public/data/persons.json')
    const relsFile = await getFile('public/data/relationships.json')

    if (!personsFile || !relsFile) {
      return res.status(500).json({ error: 'Kunde inte läsa data.' })
    }

    const persons = JSON.parse(personsFile.content)
    const relationships = JSON.parse(relsFile.content)

    // Create new person
    const newId = generateId(firstName, lastName)
    const newPerson = {
      id: newId,
      firstName,
      lastName,
      birthName: rest.birthName || null,
      birthDate: rest.birthDate || null,
      birthPlace: rest.birthPlace || null,
      deathDate: rest.deathDate || null,
      deathPlace: rest.deathPlace || null,
      gender: 'other',
      occupation: rest.occupation || null,
      photos: [],
      stories: rest.story ? [{ title: 'Berättelse', text: rest.story }] : [],
      contactInfo: null,
      familySide: 'jens', // Default, can be changed later
    }

    // Determine familySide from related person
    if (relatedToId) {
      const relatedPerson = persons.find((p: any) => p.id === relatedToId)
      if (relatedPerson) {
        newPerson.familySide = relatedPerson.familySide
      }
    }

    persons.push(newPerson)

    // Add relationship if we know how they're related
    if (relatedToId && relationType) {
      if (relationType === 'parent') {
        relationships.push({ type: 'parent', from: newId, to: relatedToId })
      } else if (relationType === 'sibling') {
        // Find parents of relatedTo and add same parents
        const parentRels = relationships.filter(
          (r: any) => r.type === 'parent' && r.to === relatedToId
        )
        for (const pr of parentRels) {
          relationships.push({ type: 'parent', from: pr.from, to: newId })
        }
      } else if (relationType === 'partner') {
        relationships.push({ type: 'partner', from: relatedToId, to: newId, status: 'current' })
      }
    }

    // Commit persons.json
    const personsOk = await updateFile(
      'public/data/persons.json',
      JSON.stringify(persons, null, 2) + '\n',
      personsFile.sha,
      `Lägg till ${firstName} ${lastName}`,
    )

    if (!personsOk) {
      return res.status(500).json({ error: 'Kunde inte spara personen.' })
    }

    // Re-fetch relationships sha (persons commit may have changed it on same branch)
    const relsFileUpdated = await getFile('public/data/relationships.json')
    if (!relsFileUpdated) {
      return res.status(500).json({ error: 'Kunde inte läsa relationer.' })
    }

    const relsOk = await updateFile(
      'public/data/relationships.json',
      JSON.stringify(relationships, null, 2) + '\n',
      relsFileUpdated.sha,
      `Lägg till relation för ${firstName} ${lastName}`,
    )

    if (!relsOk) {
      return res.status(500).json({ error: 'Kunde inte spara relationen.' })
    }

    return res.status(200).json({ success: true, personId: newId })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({ error: 'Nätverksfel. Försök igen.' })
  }
}
