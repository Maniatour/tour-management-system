/**
 * 브라우저에서 Tesseract 실행 (Next 서버 번들·worker 경로 이슈 회피).
 * JPEG 일부(추가 바이트·EXIF 등)는 브라우저는 보여 주지만 Tesseract libjpeg는 거부하는 경우가 있어,
 * Canvas로 디코드 후 PNG로 재인코딩해 넘깁니다.
 */

const MAX_OCR_EDGE = 4096

function getDrawSize(source: CanvasImageSource): { w: number; h: number } {
  if (source instanceof ImageBitmap) {
    return { w: source.width, h: source.height }
  }
  const el = source as HTMLImageElement
  const w = el.naturalWidth || el.width
  const h = el.naturalHeight || el.height
  return { w, h }
}

function drawSourceToPngBlob(source: CanvasImageSource): Promise<Blob> {
  let { w, h } = getDrawSize(source)
  if (!w || !h) {
    return Promise.reject(new Error('Invalid image dimensions'))
  }
  let cw = w
  let ch = h
  if (w > MAX_OCR_EDGE || h > MAX_OCR_EDGE) {
    const scale = MAX_OCR_EDGE / Math.max(w, h)
    cw = Math.round(w * scale)
    ch = Math.round(h * scale)
  }
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return Promise.reject(new Error('Canvas 2D context not available'))
  }
  ctx.drawImage(source, 0, 0, cw, ch)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Failed to encode PNG for OCR'))
      },
      'image/png',
      1
    )
  })
}

/** ArrayBuffer → 브라우저 디코드 → PNG Blob (Tesseract 안정 입력) */
export async function decodeReceiptImageToPngBlob(data: ArrayBuffer, mimeType: string): Promise<Blob> {
  const type = mimeType?.startsWith('image/') ? mimeType : 'image/jpeg'
  const inBlob = new Blob([data], { type })

  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(inBlob)
      try {
        return await drawSourceToPngBlob(bitmap)
      } finally {
        bitmap.close()
      }
    } catch {
      /* Image 폴백 */
    }
  }

  const url = URL.createObjectURL(inBlob)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Receipt image could not be decoded'))
      img.src = url
    })
    await (img.decode?.() ?? Promise.resolve())
    return await drawSourceToPngBlob(img)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function runReceiptOcrFromImageBuffer(
  data: ArrayBuffer,
  mimeType: string
): Promise<{ text: string }> {
  const pngBlob = await decodeReceiptImageToPngBlob(data, mimeType)
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng')
  try {
    const {
      data: { text },
    } = await worker.recognize(pngBlob)
    return { text: text || '' }
  } finally {
    await worker.terminate()
  }
}
