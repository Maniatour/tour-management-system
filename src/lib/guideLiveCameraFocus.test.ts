import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clampLongEdge,
  mapCoverTapToNormalizedPoint,
  measureRegionContrast,
  pickStillPhotoSize,
  pickTapFocusAdvancedConstraints,
  sampleFocusDistances,
} from '@/lib/guideLiveCameraFocus'

test('mapCoverTapToNormalizedPoint maps the visible center to 0.5, 0.5', () => {
  const point = mapCoverTapToNormalizedPoint(
    { clientX: 200, clientY: 400 },
    { left: 0, top: 0, width: 400, height: 800 },
    { width: 1920, height: 1080 }
  )
  assert.ok(point)
  assert.ok(Math.abs(point.x - 0.5) < 0.02)
  assert.ok(Math.abs(point.y - 0.5) < 0.02)
})

test('mapCoverTapToNormalizedPoint accounts for object-cover side crop', () => {
  const point = mapCoverTapToNormalizedPoint(
    { clientX: 0, clientY: 400 },
    { left: 0, top: 0, width: 400, height: 800 },
    { width: 1920, height: 1080 }
  )
  assert.ok(point)
  assert.ok(point.x > 0.3)
  assert.ok(point.x < 0.45)
  assert.ok(Math.abs(point.y - 0.5) < 0.02)
})

test('pickTapFocusAdvancedConstraints prefers points of interest and single-shot focus', () => {
  const advanced = pickTapFocusAdvancedConstraints(
    {
      pointsOfInterest: true,
      focusMode: ['continuous', 'single-shot'],
      exposureMode: ['continuous'],
    },
    { x: 0.25, y: 0.8 }
  )
  assert.deepEqual(advanced[0], { pointsOfInterest: [{ x: 0.25, y: 0.8 }] })
  assert.deepEqual(advanced[1], { focusMode: 'single-shot' })
  assert.deepEqual(advanced[2], { exposureMode: 'continuous' })
})

test('tap-to-focus can keep a manual night exposure', () => {
  const advanced = pickTapFocusAdvancedConstraints(
    {
      pointsOfInterest: true,
      focusMode: ['continuous', 'single-shot'],
      exposureMode: ['continuous'],
    },
    { x: 0.25, y: 0.8 },
    { preserveExposure: true }
  )
  assert.deepEqual(advanced[0], { pointsOfInterest: [{ x: 0.25, y: 0.8 }] })
  assert.deepEqual(advanced[1], { focusMode: 'single-shot' })
  assert.equal(advanced.some((item) => item.exposureMode), false)
})

test('sampleFocusDistances returns a short sweep between min and max', () => {
  const distances = sampleFocusDistances(0.1, 1, 0.05)
  assert.ok(distances.length >= 5)
  assert.ok(distances.length <= 8)
  assert.equal(distances[0], 0.1)
  assert.equal(distances[distances.length - 1], 1)
})

test('measureRegionContrast is higher for an edge than a flat fill', () => {
  const flat = new Uint8ClampedArray(16 * 16 * 4)
  const edge = new Uint8ClampedArray(16 * 16 * 4)
  for (let i = 0; i < flat.length; i += 4) {
    flat[i] = 120
    flat[i + 1] = 120
    flat[i + 2] = 120
    flat[i + 3] = 255
  }
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const i = (y * 16 + x) * 4
      const light = x < 8
      edge[i] = light ? 20 : 230
      edge[i + 1] = light ? 20 : 230
      edge[i + 2] = light ? 20 : 230
      edge[i + 3] = 255
    }
  }
  assert.ok(measureRegionContrast(edge) > measureRegionContrast(flat) * 4)
})

test('clampLongEdge keeps 4K under the max and preserves aspect', () => {
  const sized = clampLongEdge(4032, 3024, 3840)
  assert.equal(sized.width, 3840)
  assert.equal(sized.height, 2880)
  assert.deepEqual(clampLongEdge(1920, 1080, 3840), { width: 1920, height: 1080 })
})

test('pickStillPhotoSize uses the camera still-image maximum', () => {
  assert.deepEqual(pickStillPhotoSize({ imageWidth: { max: 4032 }, imageHeight: { max: 3024 } }), {
    imageWidth: 4032,
    imageHeight: 3024,
  })
  assert.equal(pickStillPhotoSize({}), null)
})

