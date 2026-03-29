import type { VercelRequest, VercelResponse } from '@vercel/node'
import { put } from '@vercel/blob'

export const config = {
  api: { bodyParser: { sizeLimit: '2mb' } },
}

// IP-based rate limiting (same pattern as submit-direct.ts)
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

const MAX_FILE_SIZE = 500 * 1024 // 500KB

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? 'unknown'
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'För många förfrågningar. Försök igen senare.' })
  }

  const { filename, data } = req.body

  if (!filename || !data) {
    return res.status(400).json({ error: 'Filnamn och bilddata krävs.' })
  }

  try {
    const buffer = Buffer.from(data, 'base64')

    // File size check
    if (buffer.length > MAX_FILE_SIZE) {
      return res.status(400).json({ error: 'Bilden är för stor. Max 500KB.' })
    }

    // JPEG magic bytes validation (0xFF 0xD8 0xFF)
    if (buffer.length < 3 || buffer[0] !== 0xFF || buffer[1] !== 0xD8 || buffer[2] !== 0xFF) {
      return res.status(400).json({ error: 'Bara JPEG-bilder är tillåtna.' })
    }

    const blob = await put(`photos/${filename}`, buffer, {
      access: 'public',
      contentType: 'image/jpeg',
    })

    return res.status(200).json({ url: blob.url })
  } catch (error) {
    console.error('Upload error:', error)
    return res.status(500).json({ error: 'Kunde inte ladda upp bilden.' })
  }
}
