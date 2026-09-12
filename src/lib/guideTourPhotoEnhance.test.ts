import assert from 'node:assert/strict'
import test from 'node:test'
import {
  analyzeTourPhotoPixels,
  enhanceTourPhotoPixels,
  whiteBalanceGains,
} from '@/lib/guideTourPhotoEnhance'

function fillRgba(value: number, pixels = 64): Uint8ClampedArray {
  const data = new Uint8ClampedArray(pixels * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = value
    data[i + 1] = value
    data[i + 2] = value
    data[i + 3] = 255
  }
  return data
}

test('dark underexposed pixels get brighter after auto enhance', () => {
  const data = fillRgba(42)
  enhanceTourPhotoPixels(data)
  assert.ok(data[0] > 42)
  assert.ok(data[0] < 140)
})

test('near-white highlights stay clipped instead of wrapping', () => {
  const data = fillRgba(250)
  enhanceTourPhotoPixels(data)
  assert.ok(data[0] >= 245)
})

test('warm canyon colors keep a red-over-blue cast', () => {
  const data = new Uint8ClampedArray(32 * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 196
    data[i + 1] = 118
    data[i + 2] = 64
    data[i + 3] = 255
  }
  const stats = analyzeTourPhotoPixels(data)
  assert.equal(stats.isWarm, true)
  assert.deepEqual(whiteBalanceGains(stats), { r: 1, g: 1, b: 1 })
  enhanceTourPhotoPixels(data)
  assert.ok(data[0] > data[2])
})

test('cool color cast is pulled toward a milder white balance', () => {
  const stats = analyzeTourPhotoPixels(
    (() => {
      const data = new Uint8ClampedArray(32 * 4)
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 90
        data[i + 1] = 110
        data[i + 2] = 170
        data[i + 3] = 255
      }
      return data
    })()
  )
  const gains = whiteBalanceGains(stats)
  assert.ok(gains.r > 1)
  assert.ok(gains.b < 1)
})
