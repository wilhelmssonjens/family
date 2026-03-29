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

async function commitFiles(
  files: { path: string; content: string }[],
  message: string
): Promise<boolean> {
  const headers = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  }

  // 1. Get current commit SHA from the branch ref
  const refRes = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/ref/heads/main`,
    { headers }
  )
  if (!refRes.ok) return false
  const refData = await refRes.json()
  const currentCommitSha = refData.object.sha

  // 2. Get the tree SHA from that commit
  const commitRes = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/commits/${currentCommitSha}`,
    { headers }
  )
  if (!commitRes.ok) return false
  const commitData = await commitRes.json()
  const baseTreeSha = commitData.tree.sha

  // 3. Create blobs for each file
  const treeItems = []
  for (const file of files) {
    const blobRes = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/blobs`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content: file.content,
          encoding: 'utf-8',
        }),
      }
    )
    if (!blobRes.ok) return false
    const blobData = await blobRes.json()
    treeItems.push({
      path: file.path,
      mode: '100644' as const,
      type: 'blob' as const,
      sha: blobData.sha,
    })
  }

  // 4. Create a new tree containing both blobs
  const treeRes = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/trees`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeItems,
      }),
    }
  )
  if (!treeRes.ok) return false
  const treeData = await treeRes.json()

  // 5. Create a commit pointing to the new tree
  const newCommitRes = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/commits`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message,
        tree: treeData.sha,
        parents: [currentCommitSha],
      }),
    }
  )
  if (!newCommitRes.ok) return false
  const newCommitData = await newCommitRes.json()

  // 6. Update the branch ref to the new commit
  const updateRefRes = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/refs/heads/main`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        sha: newCommitData.sha,
      }),
    }
  )
  return updateRefRes.ok
}

function relationExists(relationships: any[], type: string, from: string, to: string): boolean {
  return relationships.some((r: any) =>
    r.type === type && r.from === from && r.to === to
  )
}

function addRelationIfNew(relationships: any[], rel: { type: string; from: string; to: string; status?: string }) {
  if (!relationExists(relationships, rel.type, rel.from, rel.to)) {
    relationships.push(rel)
  }
}

function generateId(firstName: string, lastName: string, existingPersons: any[]): string {
  const base = `${firstName}-${lastName}`.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-')
  let id = base
  let counter = 2
  const existingIds = new Set(existingPersons.map((p: any) => p.id))
  while (existingIds.has(id)) {
    id = `${base}-${counter}`
    counter++
  }
  return id
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? 'unknown'
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'För många förfrågningar. Försök igen senare.' })
  }

  const { firstName, lastName, relationType, honeypot, relatedToId, gender, existingPersonId, ...rest } = req.body

  if (honeypot) {
    return res.status(200).json({ success: true })
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

    let persons = JSON.parse(personsFile.content)
    let relationships = JSON.parse(relsFile.content)

    // --- DELETE ---
    if (relationType === 'delete') {
      if (!relatedToId) {
        return res.status(400).json({ error: 'Person-ID krävs för borttagning.' })
      }
      const personToDelete = persons.find((p: any) => p.id === relatedToId)
      if (!personToDelete) {
        return res.status(404).json({ error: 'Personen hittades inte.' })
      }

      persons = persons.filter((p: any) => p.id !== relatedToId)
      relationships = relationships.filter(
        (r: any) => r.from !== relatedToId && r.to !== relatedToId
      )

      const ok = await commitFiles(
        [
          { path: 'public/data/persons.json', content: JSON.stringify(persons, null, 2) + '\n' },
          { path: 'public/data/relationships.json', content: JSON.stringify(relationships, null, 2) + '\n' },
        ],
        `Ta bort ${personToDelete.firstName} ${personToDelete.lastName}`,
      )
      if (!ok) {
        return res.status(500).json({ error: 'Kunde inte spara.' })
      }

      return res.status(200).json({ success: true })
    }

    // --- EDIT ---
    if (relationType === 'edit') {
      if (!relatedToId) {
        return res.status(400).json({ error: 'Person-ID krävs för redigering.' })
      }
      const personIndex = persons.findIndex((p: any) => p.id === relatedToId)
      if (personIndex === -1) {
        return res.status(404).json({ error: 'Personen hittades inte.' })
      }

      const existing = persons[personIndex]
      persons[personIndex] = {
        ...existing,
        firstName: firstName || existing.firstName,
        lastName: lastName || existing.lastName,
        birthName: rest.birthName || null,
        birthDate: rest.birthDate || null,
        birthPlace: rest.birthPlace || null,
        deathDate: rest.deathDate || null,
        deathPlace: rest.deathPlace || null,
        occupation: rest.occupation || null,
        contactInfo: rest.contactInfo || null,
        stories: Array.isArray(rest.stories) ? rest.stories.filter((s: any) => s.title || s.text) : existing.stories,
        photos: Array.isArray(rest.photos) ? rest.photos : existing.photos,
      }

      const personsOk = await updateFile(
        'public/data/persons.json',
        JSON.stringify(persons, null, 2) + '\n',
        personsFile.sha,
        `Redigera ${persons[personIndex].firstName} ${persons[personIndex].lastName}`,
      )
      if (!personsOk) {
        return res.status(500).json({ error: 'Kunde inte spara ändringarna.' })
      }

      return res.status(200).json({ success: true, personId: relatedToId })
    }

    // --- LINK EXISTING PERSON ---
    if (relationType === 'link') {
      if (!relatedToId || !existingPersonId) {
        return res.status(400).json({ error: 'Båda person-ID krävs för koppling.' })
      }

      const fromPerson = persons.find((p: any) => p.id === relatedToId)
      const toPerson = persons.find((p: any) => p.id === existingPersonId)
      if (!fromPerson || !toPerson) {
        return res.status(404).json({ error: 'En eller båda personerna hittades inte.' })
      }

      const linkType = rest.linkRelationType as string
      if (linkType === 'parent') {
        addRelationIfNew(relationships, { type: 'parent', from: existingPersonId, to: relatedToId })
      } else if (linkType === 'child') {
        addRelationIfNew(relationships, { type: 'parent', from: relatedToId, to: existingPersonId })
      } else if (linkType === 'sibling') {
        const parentRels = relationships.filter(
          (r: any) => r.type === 'parent' && r.to === relatedToId
        )
        for (const pr of parentRels) {
          addRelationIfNew(relationships, { type: 'parent', from: pr.from, to: existingPersonId })
        }
        addRelationIfNew(relationships, { type: 'sibling', from: relatedToId, to: existingPersonId })
        // Transitive: link with all existing siblings of anchor
        const existingSiblingIds = new Set<string>()
        for (const r of relationships) {
          if (r.type === 'sibling' && r.from === relatedToId && r.to !== existingPersonId) existingSiblingIds.add(r.to)
          if (r.type === 'sibling' && r.to === relatedToId && r.from !== existingPersonId) existingSiblingIds.add(r.from)
        }
        for (const sibId of existingSiblingIds) {
          addRelationIfNew(relationships, { type: 'sibling', from: sibId, to: existingPersonId })
        }
      } else if (linkType === 'partner') {
        addRelationIfNew(relationships, { type: 'partner', from: relatedToId, to: existingPersonId, status: 'current' })
      }

      const relsOk = await updateFile(
        'public/data/relationships.json',
        JSON.stringify(relationships, null, 2) + '\n',
        relsFile.sha,
        `Koppla ${fromPerson.firstName} ${fromPerson.lastName} till ${toPerson.firstName} ${toPerson.lastName}`,
      )
      if (!relsOk) {
        return res.status(500).json({ error: 'Kunde inte spara relationen.' })
      }

      return res.status(200).json({ success: true, personId: existingPersonId })
    }

    // --- ADD NEW PERSON ---
    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'Förnamn och efternamn krävs.' })
    }

    const newId = generateId(firstName, lastName, persons)
    const newPerson = {
      id: newId,
      firstName,
      lastName,
      birthName: rest.birthName || null,
      birthDate: rest.birthDate || null,
      birthPlace: rest.birthPlace || null,
      deathDate: rest.deathDate || null,
      deathPlace: rest.deathPlace || null,
      gender: gender || 'other',
      occupation: rest.occupation || null,
      photos: [],
      stories: rest.story ? [{ title: 'Berättelse', text: rest.story }] : [],
      contactInfo: null,
      familySide: 'jens',
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
        addRelationIfNew(relationships, { type: 'parent', from: newId, to: relatedToId })
      } else if (relationType === 'child') {
        addRelationIfNew(relationships, { type: 'parent', from: relatedToId, to: newId })
      } else if (relationType === 'sibling') {
        const parentRels = relationships.filter(
          (r: any) => r.type === 'parent' && r.to === relatedToId
        )
        for (const pr of parentRels) {
          addRelationIfNew(relationships, { type: 'parent', from: pr.from, to: newId })
        }
        addRelationIfNew(relationships, { type: 'sibling', from: relatedToId, to: newId })
        // Transitive: link new sibling with all existing siblings of anchor
        const existingSiblingIds = new Set<string>()
        for (const r of relationships) {
          if (r.type === 'sibling' && r.from === relatedToId && r.to !== newId) existingSiblingIds.add(r.to)
          if (r.type === 'sibling' && r.to === relatedToId && r.from !== newId) existingSiblingIds.add(r.from)
        }
        for (const sibId of existingSiblingIds) {
          addRelationIfNew(relationships, { type: 'sibling', from: sibId, to: newId })
        }
      } else if (relationType === 'partner') {
        addRelationIfNew(relationships, { type: 'partner', from: relatedToId, to: newId, status: 'current' })
      }
    }

    // Commit both files atomically
    const ok = await commitFiles(
      [
        { path: 'public/data/persons.json', content: JSON.stringify(persons, null, 2) + '\n' },
        { path: 'public/data/relationships.json', content: JSON.stringify(relationships, null, 2) + '\n' },
      ],
      `Lägg till ${firstName} ${lastName}`,
    )

    if (!ok) {
      return res.status(500).json({ error: 'Kunde inte spara.' })
    }

    return res.status(200).json({ success: true, personId: newId })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({ error: 'Nätverksfel. Försök igen.' })
  }
}
