/** Turn a signature bitmap into transparent-background black ink without thickening strokes. */

export const PRINT_SIGNATURE_TARGET_HEIGHT = 160

const LUMA_R = 0.2126
const LUMA_G = 0.7152
const LUMA_B = 0.0722
const INK_CUTOFF = 0.1
const CORE_OPAQUE_AT = 0.4
const INK_GAIN = 1.5
const EDGE_GAMMA = 0.55
const PRINT_STROKE_DILATE = 3

function pixelInkDensity(r: number, g: number, b: number, a: number): number {
  if (a <= 10) return 0
  const luma = (LUMA_R * r + LUMA_G * g + LUMA_B * b) / 255
  const density = (1 - luma) * (a / 255)
  return density < INK_CUTOFF ? 0 : Math.min(1, density * INK_GAIN)
}

function inkAlpha(density: number): number {
  if (density >= CORE_OPAQUE_AT) return 255
  const t = density / CORE_OPAQUE_AT
  return Math.min(255, Math.round(Math.pow(t, EDGE_GAMMA) * 255))
}

export function inkifyRgbaBuffer(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  dilate = 0
): Uint8ClampedArray {
  const ink = new Float32Array(width * height)
  for (let i = 0, p = 0; i < src.length; i += 4, p += 1) {
    ink[p] = pixelInkDensity(src[i], src[i + 1], src[i + 2], src[i + 3])
  }

  const radius = Math.max(0, Math.floor(dilate))
  const out = new Uint8ClampedArray(src.length)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let density = ink[y * width + x]
      if (radius > 0 && density <= 0) {
        for (let dy = -radius; dy <= radius && density <= 0; dy += 1) {
          for (let dx = -radius; dx <= radius && density <= 0; dx += 1) {
            if (dx * dx + dy * dy > radius * radius + 1) continue
            const nx = x + dx
            const ny = y + dy
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
            const neighbor = ink[ny * width + nx]
            if (neighbor > 0) density = neighbor
          }
        }
      }

      const i = (y * width + x) * 4
      if (density <= 0) {
        out[i] = 0
        out[i + 1] = 0
        out[i + 2] = 0
        out[i + 3] = 0
        continue
      }

      out[i] = 0
      out[i + 1] = 0
      out[i + 2] = 0
      out[i + 3] = inkAlpha(density)
    }
  }
  return out
}

export function inkifySignatureCanvas(
  source: CanvasImageSource,
  sourceW: number,
  sourceH: number,
  targetHeight = PRINT_SIGNATURE_TARGET_HEIGHT
): string {
  if (!sourceW || !sourceH) return ''
  const maxHeight = Math.max(64, targetHeight)
  const height = Math.min(sourceH, maxHeight)
  const width = Math.max(1, Math.round((sourceW / sourceH) * height))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  const downscaling = sourceH > height || sourceW > width
  ctx.imageSmoothingEnabled = downscaling
  if (downscaling) ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, width, height)
  const raw = ctx.getImageData(0, 0, width, height)
  raw.data.set(inkifyRgbaBuffer(raw.data, width, height, PRINT_STROKE_DILATE))
  ctx.putImageData(raw, 0, 0)
  return canvas.toDataURL('image/png')
}

export function inkifySignatureElement(
  img: HTMLImageElement,
  targetHeight = PRINT_SIGNATURE_TARGET_HEIGHT
): string {
  const sourceW = img.naturalWidth || img.width
  const sourceH = img.naturalHeight || img.height
  return inkifySignatureCanvas(img, sourceW, sourceH, targetHeight)
}

export async function inkifySignatureFromUrl(
  src: string,
  targetHeight = PRINT_SIGNATURE_TARGET_HEIGHT
): Promise<string> {
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
