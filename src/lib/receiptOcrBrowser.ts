/**
 * 브라우저에서 Tesseract 실행 (Next 서버 번들·worker 경로 이슈 회피).
 * 열전사 영수증: 확대·대비 정규화 + (보조) 이진화 2회 OCR 병합, 단일 컬럼 PSM.
 */

import {
  configureReceiptOcrWorker,
  preprocessReceiptSourceToPngBlob,
  preprocessReceiptSourceToPngBlobBinarized,
} from '@/lib/receiptOcrPreprocess'
import { finalizeReceiptOcrText, mergeReceiptOcrTextsSmart, receiptOcrHasCoreFields } from '@/lib/receiptOcrCleanup'

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

export async function runReceiptOcrFromImageBuffer(
  data: ArrayBuffer,
  mimeType: string
): Promise<{ text: string }> {
  const source = await decodeSourceFromBuffer(data, mimeType)
  try {
    const [normalizedBlob, binarizedBlob] = await Promise.all([
      preprocessReceiptSourceToPngBlob(source),
      preprocessReceiptSourceToPngBlobBinarized(source),
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
      if (!receiptOcrHasCoreFields(normalizedText)) {
        const binarizedText = await recognizeBlob(binarizedBlob)
        merged = mergeReceiptOcrTextsSmart(normalizedText, binarizedText)
      }
      return { text: finalizeReceiptOcrText(merged) }
    } finally {
      await worker.terminate()
    }
  } finally {
    if (source instanceof ImageBitmap) source.close()
  }
}
