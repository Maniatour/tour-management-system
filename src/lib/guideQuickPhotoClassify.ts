import { scoreReceiptOcrOverall } from '@/lib/receiptOcrCleanup'

export type GuideQuickCaptureKind = 'photo' | 'receipt'
export type GuideQuickCaptureLook = 'photo' | 'document' | 'unknown'

const RECEIPT_KEYWORD =
  /\b(total|subtotal|tax|change|visa|mastercard|amex|debit|credit|invoice|receipt|approved|authorization|amount|balance|cash|pump|gallon|fuel)\b/i
const RECEIPT_KO = /합계|영수증|부가세|승인|카드|현금|거스름|세금/
const MONEY = /\$\s*\d{1,6}(?:\.\d{2})?|\b\d{1,5}\.\d{2}\b/

export function scoreGuideCaptureReceiptText(ocrText: string): number {
  const text = (ocrText || '').trim()
  if (!text) return 0

  let score = scoreReceiptOcrOverall(text)
  const keywordHits = (text.match(RECEIPT_KEYWORD) || []).length + (text.match(RECEIPT_KO) || []).length
  const moneyHits = (text.match(MONEY) || []).length
  score += Math.min(keywordHits * 8, 24)
  score += Math.min(moneyHits * 10, 30)
  if (text.length >= 80 && moneyHits >= 1) score += 12
  return score
}

export function isReceiptLikeOcrText(ocrText: string): boolean {
  const text = (ocrText || '').trim()
  if (!text) return false
  if (scoreGuideCaptureReceiptText(text) >= 36) return true
  const moneyHits = (text.match(MONEY) || []).length
  const keywordHits = (text.match(RECEIPT_KEYWORD) || []).length + (text.match(RECEIPT_KO) || []).length
  return moneyHits >= 2 || (moneyHits >= 1 && keywordHits >= 1) || keywordHits >= 3
}

function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === 0) return 0
  return (max - min) / max
}

function isPaperPixel(r: number, g: number, b: number): boolean {
  return Math.min(r, g, b) > 208 && Math.max(r, g, b) - Math.min(r, g, b) < 38
}

export function lookFromSampledPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number
): GuideQuickCaptureLook {
  if (width < 8 || height < 8) return 'unknown'

  let paper = 0
  let satSum = 0
  let edge = 0
  let samples = 0
  const step = 4

  for (let y = 0; y < height - 1; y += step) {
    for (let x = 0; x < width - 1; x += step) {
      const i = (y * width + x) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      paper += isPaperPixel(r, g, b) ? 1 : 0
      satSum += saturation(r, g, b)
      const gray = (r + g + b) / 3
      const right = (data[(y * width + x + 1) * 4] + data[(y * width + x + 1) * 4 + 1] + data[(y * width + x + 1) * 4 + 2]) / 3
      const below =
        (data[((y + 1) * width + x) * 4] + data[((y + 1) * width + x) * 4 + 1] + data[((y + 1) * width + x) * 4 + 2]) / 3
      if (Math.abs(gray - right) + Math.abs(gray - below) > 48) edge += 1
      samples += 1
    }
  }

  if (samples === 0) return 'unknown'
  const paperRatio = paper / samples
  const avgSat = satSum / samples
  const edgeRatio = edge / samples

  if (paperRatio >= 0.42 && avgSat < 0.24 && edgeRatio >= 0.08) return 'document'
  if (avgSat >= 0.3 && paperRatio < 0.38) return 'photo'
  if (paperRatio < 0.2 && avgSat >= 0.18) return 'photo'
  return 'unknown'
}

async function sampleImageLook(file: File): Promise<GuideQuickCaptureLook> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return 'unknown'
  }

  try {
    const maxEdge = 160
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(8, Math.round(bitmap.width * scale))
    const height = Math.max(8, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return 'unknown'
    ctx.drawImage(bitmap, 0, 0, width, height)
    const image = ctx.getImageData(0, 0, width, height)
    return lookFromSampledPixels(image.data, width, height)
  } finally {
    bitmap.close()
  }
}

async function downscaleForOcr(file: File): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }
  try {
    const maxEdge = 1100
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height, 1))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
    return blob ?? file
  } finally {
    bitmap.close()
  }
}

let ocrWorkerPromise: Promise<{ recognize: (blob: Blob) => Promise<string>; terminate: () => Promise<void> }> | null = null

async function recognizeQuickOcr(file: File): Promise<string> {
  const blob = await downscaleForOcr(file)
  const { createWorker } = await import('tesseract.js')
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = createWorker('eng').then((worker) => ({
      recognize: async (input: Blob) => {
        const {
          data: { text },
        } = await worker.recognize(input)
        return text || ''
      },
      terminate: async () => {
        await worker.terminate()
      },
    }))
  }
  const ocrWorker = await ocrWorkerPromise
  if (!ocrWorker) return ''
  return ocrWorker.recognize(blob)
}

export type GuideQuickCaptureClassification = {
  kind: GuideQuickCaptureKind
  look: GuideQuickCaptureLook
  ocrText?: string
}

/**
 * 풍경·인물 사진은 OCR을 건너뛰고 투어 사진으로 보낸다.
 * 문서처럼 보이거나 애매하면 OCR로 영수증 여부를 확인한다.
 */
export async function classifyGuideQuickCapture(file: File): Promise<GuideQuickCaptureClassification> {
  const look = await sampleImageLook(file)
  if (look === 'photo') {
    return { kind: 'photo', look }
  }

  try {
    const ocrText = await recognizeQuickOcr(file)
    if (isReceiptLikeOcrText(ocrText)) {
      return { kind: 'receipt', look, ocrText }
    }
    if (look === 'document' && (ocrText || '').trim().length >= 40) {
      return { kind: 'receipt', look, ocrText }
    }
    return { kind: 'photo', look, ocrText }
  } catch {
    return { kind: look === 'document' ? 'receipt' : 'photo', look }
  }
}
