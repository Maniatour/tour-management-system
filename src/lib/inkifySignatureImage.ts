/** Turn a signature bitmap into transparent-background black ink. */

export function inkifyRgbaBuffer(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  dilate = 2
): Uint8ClampedArray {
  const mask = new Uint8Array(width * height)
  for (let i = 0, p = 0; i < src.length; i += 4, p += 1) {
    const luma = 0.2126 * src[i] + 0.7152 * src[i + 1] + 0.0722 * src[i + 2]
    mask[p] = src[i + 3] > 24 && luma < 192 ? 1 : 0
  }

  const radius = Math.max(0, Math.floor(dilate))
  const out = new Uint8ClampedArray(src.length)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let ink = 0
      for (let dy = -radius; dy <= radius && !ink; dy += 1) {
        for (let dx = -radius; dx <= radius && !ink; dx += 1) {
          if (dx * dx + dy * dy > radius * radius + 1) continue
          const nx = x + dx
          const ny = y + dy
          if (nx >= 0 && ny >= 0 && nx < width && ny < height && mask[ny * width + nx]) ink = 1
        }
      }
      const i = (y * width + x) * 4
      out[i] = 24
      out[i + 1] = 24
      out[i + 2] = 24
      out[i + 3] = ink ? 212 : 0
    }
  }
  return out
}

export function inkifySignatureCanvas(
  source: CanvasImageSource,
  sourceW: number,
  sourceH: number,
  targetHeight = 48
): string {
  if (!sourceW || !sourceH) return ''
  const height = Math.max(28, targetHeight)
  const width = Math.max(1, Math.round((sourceW / sourceH) * height))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(source, 0, 0, width, height)
  const raw = ctx.getImageData(0, 0, width, height)
  raw.data.set(inkifyRgbaBuffer(raw.data, width, height, 2))
  ctx.putImageData(raw, 0, 0)
  return canvas.toDataURL('image/png')
}

export function inkifySignatureElement(img: HTMLImageElement, targetHeight = 48): string {
  const sourceW = img.naturalWidth || img.width
  const sourceH = img.naturalHeight || img.height
  return inkifySignatureCanvas(img, sourceW, sourceH, targetHeight)
}

export async function inkifySignatureFromUrl(src: string, targetHeight = 48): Promise<string> {
  try {
    const res = await fetch(src, { mode: 'cors', credentials: 'omit' })
    if (!res.ok) throw new Error('signature fetch failed')
    const blob = await res.blob()
    const bitmap = await createImageBitmap(blob)
    const out = inkifySignatureCanvas(bitmap, bitmap.width, bitmap.height, targetHeight)
    bitmap.close()
    if (out) return out
  } catch {
    /* canvas fallback below */
  }

  const img = await loadSignatureImage(src, true)
  try {
    const out = inkifySignatureElement(img, targetHeight)
    if (out) return out
  } catch {
    /* last resort: original */
  }
  return src
}

function loadSignatureImage(src: string, crossOrigin: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (crossOrigin) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('signature image load failed'))
    img.src = src
  })
}
