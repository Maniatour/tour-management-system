/**
 * 브라우저에서 Tesseract 실행 (Next 서버 번들·worker 경로 이슈 회피).
 * 열전사 영수증: 확대·대비 정규화 + (보조) 이진화 2회 OCR 병합, 단일 컬럼 PSM.
 */

import {
  configureReceiptOcrWorker,
  preprocessReceiptSourceToPngBlob,
  preprocessReceiptSourceToPngBlobBinarized,
  type ReceiptOcrRotationDegrees,
} from '@/lib/receiptOcrPreprocess'
import {
  finalizeReceiptOcrText,
  mergeReceiptOcrTextsSmart,
  receiptOcrHasCoreFields,
  receiptOcrHasUsableExtraction,
  scoreReceiptOcrOverall,
} from '@/lib/receiptOcrCleanup'

export type ReceiptOcrRunOptions = {
  /** OCR 전 이미지 회전 (세로 촬영·뒤집힌 영수증) */
  rotationDegrees?: ReceiptOcrRotationDegrees
  /** 1차 결과에 핵심 필드가 있어도 이진화 2-pass 병합 강제 */
  forceDualPass?: boolean
  /** 결과가 약하면 90°·270° 회전도 시도해 최고 점수 채택 */
  tryAlternateRotations?: boolean
}

async function decodeSourceFromBuffer(data: ArrayBuffer, mimeType: string): Promise<CanvasImageSource> {
  const type = mimeType?.startsWith('image/') ? mimeType : 'image/jpeg'
  const inBlob = new Blob([data], { type })

  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(inBlob)
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
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** ArrayBuffer → 디코드 → 전처리 PNG Blob */
export async function decodeReceiptImageToPngBlob(data: ArrayBuffer, mimeType: string): Promise<Blob> {
  const source = await decodeSourceFromBuffer(data, mimeType)
  try {
    return await preprocessReceiptSourceToPngBlob(source)
  } finally {
    if (source instanceof ImageBitmap) source.close()
  }
}

async function recognizeReceiptFromSource(
  source: CanvasImageSource,
  rotationDegrees: ReceiptOcrRotationDegrees,
  forceDualPass: boolean
): Promise<string> {
  const [normalizedBlob, binarizedBlob] = await Promise.all([
    preprocessReceiptSourceToPngBlob(source, rotationDegrees),
    preprocessReceiptSourceToPngBlobBinarized(source, rotationDegrees),
  ])
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng')
  try {
    await configureReceiptOcrWorker(worker)
    const recognizeBlob = async (blob: Blob) => {
      const {
        data: { text },
      } = await worker.recognize(blob)
      return text || ''
    }
    const normalizedText = await recognizeBlob(normalizedBlob)
    let merged = normalizedText
    if (forceDualPass || !receiptOcrHasCoreFields(normalizedText)) {
      const binarizedText = await recognizeBlob(binarizedBlob)
      merged = mergeReceiptOcrTextsSmart(normalizedText, binarizedText)
    }
    return finalizeReceiptOcrText(merged)
  } finally {
    await worker.terminate()
  }
}

export async function runReceiptOcrFromImageBuffer(
  data: ArrayBuffer,
  mimeType: string,
  options: ReceiptOcrRunOptions = {}
): Promise<{ text: string; rotationUsed: ReceiptOcrRotationDegrees }> {
  const rotationDegrees = options.rotationDegrees ?? 0
  const forceDualPass = options.forceDualPass ?? false
  const source = await decodeSourceFromBuffer(data, mimeType)
  try {
    let bestText = await recognizeReceiptFromSource(source, rotationDegrees, forceDualPass)
    let bestRotation = rotationDegrees

    if (
      options.tryAlternateRotations &&
      !receiptOcrHasUsableExtraction(bestText)
    ) {
      const alternates: ReceiptOcrRotationDegrees[] = [90, 270, 180]
      for (const alt of alternates) {
        if (alt === rotationDegrees) continue
        const candidate = await recognizeReceiptFromSource(source, alt, true)
        if (scoreReceiptOcrOverall(candidate) > scoreReceiptOcrOverall(bestText)) {
          bestText = candidate
          bestRotation = alt
        }
      }
    }

    return { text: bestText, rotationUsed: bestRotation }
  } finally {
    if (source instanceof ImageBitmap) source.close()
  }
}
