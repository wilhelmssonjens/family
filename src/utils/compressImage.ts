const MAX_SIZE = 400
const QUALITY = 0.7

export async function compressImage(file: File): Promise<{ base64: string; filename: string }> {
  const bitmap = await createImageBitmap(file)

  let width = bitmap.width
  let height = bitmap.height

  if (width > MAX_SIZE || height > MAX_SIZE) {
    if (width > height) {
      height = Math.round((height / width) * MAX_SIZE)
      width = MAX_SIZE
    } else {
      width = Math.round((width / height) * MAX_SIZE)
      height = MAX_SIZE
    }
  }

  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas context not available')

  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: QUALITY })
  const buffer = await blob.arrayBuffer()
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))

  const timestamp = Date.now()
  const safeName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  const filename = `${safeName}-${timestamp}.jpg`

  return { base64, filename }
}
