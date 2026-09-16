import assert from 'node:assert/strict'
import test from 'node:test'
import { inkifyRgbaBuffer } from '@/lib/inkifySignatureImage'

test('inkifyRgbaBuffer makes white pixels transparent and dark pixels ink', () => {
  const src = new Uint8ClampedArray([255, 255, 255, 255, 18, 18, 18, 255])
  const out = inkifyRgbaBuffer(src, 2, 1, 0)
  assert.equal(out[3], 0)
  assert.equal(out[4], 24)
  assert.equal(out[5], 24)
  assert.equal(out[6], 24)
  assert.equal(out[7], 212)
})
