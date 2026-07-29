/**
 * 영수증 OCR용 이미지 전처리 + Tesseract 파라미터 (열전사·세로 영수증 대응)
 */

import type { Worker } from 'tesseract.js'

/** Tesseract가 글자를 안정적으로 읽을 최소 가로 해상도 */
export const RECEIPT_OCR_TARGET_MIN_WIDTH = 2200
export const RECEIPT_OCR_MAX_EDGE = 4096

/** Otsu 이진화 — 열전사 영수증(검은 글씨·흰 배경)에 유리 */
function otsuThreshold(grays: Uint8Array): number {
  const hist = new Array<number>(256).fill(0)
  for (let i = 0; i < grays.length; i++) hist[grays[i]]++
  const total = grays.length
  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * hist[i]

  let sumB = 0
  let wB = 0
  let maxVar = 0
  let threshold = 128

  for (let t = 0; t < 256; t++) {
    wB += hist[t]
    if (wB === 0) continue
    const wF = total - wB
    if (wF === 0) break
    sumB += t * hist[t]
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const between = wB * wF * (mB - mF) ** 2
    if (between > maxVar) {
      maxVar = between
      threshold = t
    }
  }
  return threshold
}

function computeOcrDrawSize(w: number, h: number): { cw: number; ch: number } {
  if (!w || !h) return { cw: w, ch: h }
  let scale = 1
  if (w < RECEIPT_OCR_TARGET_MIN_WIDTH) {
    scale = RECEIPT_OCR_TARGET_MIN_WIDTH / w
  }
  let cw = Math.round(w * scale)
  let ch = Math.round(h * scale)
  const maxEdge = Math.max(cw, ch)
  if (maxEdge > RECEIPT_OCR_MAX_EDGE) {
    const down = RECEIPT_OCR_MAX_EDGE / maxEdge
    cw = Math.round(cw * down)
    ch = Math.round(ch * down)
  }
  return { cw, ch }
}

/** Canvas ImageData: 그레이스케일 + 대비 정규화 (이진화 없음 — 헤더·주소 보존) */
export function normalizeReceiptImageData(imageData: ImageData): void {
  const { data, width, height } = imageData
  const n = width * height
  const grays = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const o = i * 4
    grays[i] = Math.round(0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2])
  }
  let min = 255
  let max = 0
  for (let i = 0; i < n; i++) {
    const g = grays[i]
    if (g < min) min = g
    if (g > max) max = g
  }
  const range = max - min || 1
  for (let i = 0; i < n; i++) {
    const v = Math.round(((grays[i] - min) / range) * 255)
    const o = i * 4
    data[o] = v
    data[o + 1] = v
    data[o + 2] = v
    data[o + 3] = 255
  }
}

/** Canvas ImageData: 그레이스케일 → 대비 정규화 → Otsu 이진화 (흑백) */
export function binarizeReceiptImageData(imageData: ImageData): void {
  normalizeReceiptImageData(imageData)
  const { data, width, height } = imageData
  const n = width * height
  const grays = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    grays[i] = data[i * 4]
  }
  const thresh = otsuThreshold(grays)
  for (let i = 0; i < n; i++) {
    const v = grays[i] > thresh ? 255 : 0
    const o = i * 4
    data[o] = v
    data[o + 1] = v
    data[o + 2] = v
    data[o + 3] = 255
  }
}

export type ReceiptOcrRotationDegrees = 0 | 90 | 180 | 270

function getDrawSize(source: CanvasImageSource): { w: number; h: number } {
  if (source instanceof ImageBitmap) {
    return { w: source.width, h: source.height }
  }
  const el = source as HTMLImageElement
  return { w: el.naturalWidth || el.width, h: el.naturalHeight || el.height }
}

/** OCR 전 회전(세로 촬영·뒤집힌 영수증 대응) */
export function rotateReceiptCanvasSource(
  source: CanvasImageSource,
  rotationDegrees: ReceiptOcrRotationDegrees
): HTMLCanvasElement {
  const { w, h } = getDrawSize(source)
  if (!w || !h) {
    throw new Error('Invalid image dimensions')
  }
  if (rotationDegrees === 0) {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context not available')
    ctx.drawImage(source, 0, 0, w, h)
    return canvas
  }

  const swap = rotationDegrees === 90 || rotationDegrees === 270
  const canvas = document.createElement('canvas')
  canvas.width = swap ? h : w
  canvas.height = swap ? w : h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context not available')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((rotationDegrees * Math.PI) / 180)
  ctx.drawImage(source, -w / 2, -h / 2, w, h)
  return canvas
}

function drawPreprocessedCanvas(
  source: CanvasImageSource,
  mode: 'normalize' | 'binarize',
  rotationDegrees: ReceiptOcrRotationDegrees = 0
): HTMLCanvasElement {
  const rotated = rotationDegrees === 0 ? source : rotateReceiptCanvasSource(source, rotationDegrees)
  let { w, h } = getDrawSize(rotated)
  if (!w || !h) {
    throw new Error('Invalid image dimensions')
  }
  const { cw, ch } = computeOcrDrawSize(w, h)
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas 2D context not available')
  }
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, cw, ch)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(rotated, 0, 0, cw, ch)
  const imageData = ctx.getImageData(0, 0, cw, ch)
  if (mode === 'binarize') {
    binarizeReceiptImageData(imageData)
  } else {
    normalizeReceiptImageData(imageData)
  }
  ctx.putImageData(imageData, 0, 0)
  return canvas
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
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

/** 브라우저: 디코드 → (선택) 회전 → 확대·정규화 → PNG Blob */
export async function preprocessReceiptSourceToPngBlob(
  source: CanvasImageSource,
  rotationDegrees: ReceiptOcrRotationDegrees = 0
): Promise<Blob> {
  return canvasToPngBlob(drawPreprocessedCanvas(source, 'normalize', rotationDegrees))
}

export async function preprocessReceiptSourceToPngBlobBinarized(
  source: CanvasImageSource,
  rotationDegrees: ReceiptOcrRotationDegrees = 0
): Promise<Blob> {
  return canvasToPngBlob(drawPreprocessedCanvas(source, 'binarize', rotationDegrees))
}

export function mergeReceiptOcrTexts(primary: string, secondary: string): string {
  // 하위 호환 — smart merge는 receiptOcrCleanup에서 처리
  const lines: string[] = []
  const seen = new Set<string>()
  for (const block of [primary, secondary]) {
    for (const raw of block.split(/\r?\n/)) {
      const line = raw.trim()
      if (!line) continue
      const key = line.toLowerCase().replace(/\s+/g, ' ')
      if (seen.has(key)) continue
      seen.add(key)
      lines.push(line)
    }
  }
  return `${lines.join('\n')}\n`
}

/** 세로 열전사 영수증: 단일 컬럼 + 300 DPI 힌트 */
export async function configureReceiptOcrWorker(worker: Worker): Promise<void> {
  const { PSM } = await import('tesseract.js')
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_COLUMN,
    user_defined_dpi: '300',
    preserve_interword_spaces: '1',
  })
}
