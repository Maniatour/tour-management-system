import assert from 'node:assert/strict'
import test from 'node:test'
import { inkifyRgbaBuffer } from '@/lib/inkifySignatureImage'

test('inkifyRgbaBuffer makes white pixels transparent and dark pixels ink', () => {
  const src = new Uint8ClampedArray([255, 255, 255, 255, 18, 18, 18, 255])
  const out = inkifyRgbaBuffer(src, 2, 1, 0)
  assert.equal(out[3], 0)
  assert.equal(out[4], 0)
  assert.equal(out[5], 0)
  assert.equal(out[6], 0)
  assert.equal(out[7], 255)
})

test('inkifyRgbaBuffer keeps anti-aliased gray lighter than the stroke core', () => {
  const src = new Uint8ClampedArray([210, 210, 210, 255, 18, 18, 18, 255])
  const out = inkifyRgbaBuffer(src, 2, 1, 0)
  assert.ok(out[3] > 80)
  assert.ok(out[3] < out[7])
  assert.equal(out[7], 255)
})

test('inkifyRgbaBuffer does not bleed ink into neighboring white pixels', () => {
  const src = new Uint8ClampedArray([
    255, 255, 255, 255,
    12, 12, 12, 255,
    255, 255, 255, 255,
  ])
  const out = inkifyRgbaBuffer(src, 3, 1, 0)
  assert.equal(out[3], 0)
  assert.ok(out[7] > 200)
  assert.equal(out[11], 0)
})
