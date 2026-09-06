import assert from 'node:assert/strict'
import test from 'node:test'
import { isReceiptLikeOcrText, lookFromSampledPixels, scoreGuideCaptureReceiptText } from '@/lib/guideQuickPhotoClassify'

test('receipt OCR with total and money scores as a receipt', () => {
  const text = [
    'ARCO AMPM',
    'Regular Pump #3',
    'Fuel Total $64.20',
    'Visa Credit Approved',
    '05/12/2026',
  ].join('\n')
  assert.equal(isReceiptLikeOcrText(text), true)
  assert.ok(scoreGuideCaptureReceiptText(text) >= 36)
})

test('landscape-like OCR noise is not a receipt', () => {
  const text = 'sky rock canyon trail view'
  assert.equal(isReceiptLikeOcrText(text), false)
})

test('colorful sampled pixels look like a photo, paper-like pixels look like a document', () => {
  const photo = new Uint8ClampedArray(16 * 16 * 4)
  for (let i = 0; i < photo.length; i += 4) {
    photo[i] = 40
    photo[i + 1] = 140
    photo[i + 2] = 220
    photo[i + 3] = 255
  }
  assert.equal(lookFromSampledPixels(photo, 16, 16), 'photo')

  const paper = new Uint8ClampedArray(16 * 16 * 4)
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const i = (y * 16 + x) * 4
      const line = y % 3 === 0
      paper[i] = line ? 30 : 240
      paper[i + 1] = line ? 30 : 240
      paper[i + 2] = line ? 30 : 238
      paper[i + 3] = 255
    }
  }
  assert.equal(lookFromSampledPixels(paper, 16, 16), 'document')
})
