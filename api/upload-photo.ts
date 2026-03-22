import type { VercelRequest, VercelResponse } from '@vercel/node'
import { put } from '@vercel/blob'

export const config = {
  api: { bodyParser: { sizeLimit: '2mb' } },
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { filename, data } = req.body

  if (!filename || !data) {
    return res.status(400).json({ error: 'Filnamn och bilddata krävs.' })
  }

  try {
    const buffer = Buffer.from(data, 'base64')
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
