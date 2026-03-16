import type { VercelRequest, VercelResponse } from '@vercel/node'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const REPO_OWNER = process.env.GITHUB_REPO_OWNER
const REPO_NAME = process.env.GITHUB_REPO_NAME

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? 'unknown'
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'För många förfrågningar. Försök igen senare.' })
  }

  const { firstName, lastName, relationType, honeypot, ...rest } = req.body

  if (honeypot) {
    return res.status(200).json({ success: true })
  }

  if (!firstName || !lastName) {
    return res.status(400).json({ error: 'Förnamn och efternamn krävs.' })
  }

  if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME) {
    return res.status(500).json({ error: 'Server configuration error' })
  }

  const isEdit = !!rest.personId
  const title = isEdit
    ? `Uppdatera: ${firstName} ${lastName}`
    : `Ny person: ${firstName} ${lastName}`

  const body = [
    `## ${isEdit ? 'Uppdatering' : 'Ny person'}`,
    '',
    `**Namn:** ${firstName} ${lastName}`,
    `**Relationstyp:** ${relationType}`,
    rest.birthName ? `**Födnamn:** ${rest.birthName}` : null,
    rest.birthDate ? `**Födelsedatum:** ${rest.birthDate}` : null,
    rest.birthPlace ? `**Födelseort:** ${rest.birthPlace}` : null,
    rest.deathDate ? `**Dödsdatum:** ${rest.deathDate}` : null,
    rest.deathPlace ? `**Dödsort:** ${rest.deathPlace}` : null,
    rest.occupation ? `**Yrke:** ${rest.occupation}` : null,
    rest.story ? `\n### Berättelse\n${rest.story}` : null,
    '',
    '---',
    '```json',
    JSON.stringify(req.body, null, 2),
    '```',
  ].filter(Boolean).join('\n')

  try {
    const response = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          body,
          labels: ['bidrag'],
        }),
      },
    )

    if (!response.ok) {
      const errorData = await response.json()
      console.error('GitHub API error:', errorData)
      return res.status(500).json({ error: 'Kunde inte skicka bidraget.' })
    }

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('Error creating issue:', error)
    return res.status(500).json({ error: 'Nätverksfel. Försök igen.' })
  }
}
