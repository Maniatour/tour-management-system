/**
 * 영수증 OCR 전처리 — Node.js 전용 (sharp). 클라이언트 번들에 포함되면 안 됩니다.
 */

import {
  RECEIPT_OCR_MAX_EDGE,
  RECEIPT_OCR_TARGET_MIN_WIDTH,
} from '@/lib/receiptOcrPreprocess'

/** Node(sharp): 그레이스케일·대비·확대 */
export async function preprocessReceiptBufferForOcr(
  imageBuffer: Buffer,
  mode: 'normalize' | 'binarize' = 'normalize'
): Promise<Buffer> {
  const sharp = (await import('sharp')).default
  const meta = await sharp(imageBuffer).metadata()
  const w = meta.width ?? 0
  let pipeline = sharp(imageBuffer).rotate().grayscale().normalize()
  if (w > 0 && w < RECEIPT_OCR_TARGET_MIN_WIDTH) {
    pipeline = pipeline.resize({
      width: RECEIPT_OCR_TARGET_MIN_WIDTH,
      withoutEnlargement: false,
      kernel: sharp.kernel.lanczos3,
    })
  }
  if (mode === 'binarize') {
    pipeline = pipeline.threshold(175, { grayscale: true })
  }
  const out = await pipeline.png().toBuffer()
  const outMeta = await sharp(out).metadata()
  const ow = outMeta.width ?? 0
  const oh = outMeta.height ?? 0
  if (Math.max(ow, oh) > RECEIPT_OCR_MAX_EDGE) {
    return sharp(out)
      .resize({
        width: ow >= oh ? RECEIPT_OCR_MAX_EDGE : undefined,
        height: oh > ow ? RECEIPT_OCR_MAX_EDGE : undefined,
        fit: 'inside',
        withoutEnlargement: false,
      })
      .png()
      .toBuffer()
  }
  return out
}
