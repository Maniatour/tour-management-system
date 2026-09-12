import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyNightLift,
  lerpRange,
  nightGain,
  pickCameraPresetConstraints,
  stackFrameCount,
} from '@/lib/guideLiveCameraPresets'

test('star preset uses the slowest shutter, high ISO, and infinity focus', () => {
  const advanced = pickCameraPresetConstraints(
    {
      exposureMode: ['continuous', 'manual'],
      focusMode: ['continuous', 'manual'],
      exposureTime: { min: 0.001, max: 0.4, step: 0.001 },
      iso: { min: 50, max: 3200, step: 1 },
      focusDistance: { min: 0.1, max: 1 },
    },
    'stars'
  )
  const manual = advanced.find((item) => item.exposureMode === 'manual')
  const focus = advanced.find((item) => item.focusMode === 'manual')
  assert.equal(manual?.exposureTime, 0.4)
  assert.ok((manual?.iso ?? 0) > 2400)
  assert.ok((manual?.iso ?? 0) < 2700)
  assert.equal(focus?.focusDistance, 1)
})

test('night preset is slower than auto but not the maximum shutter', () => {
  const advanced = pickCameraPresetConstraints(
    {
      exposureMode: ['manual'],
      exposureTime: { min: 0, max: 100, step: 1 },
      iso: { min: 100, max: 1000, step: 1 },
    },
    'night'
  )
  const manual = advanced.find((item) => item.exposureMode === 'manual')
  assert.ok(manual)
  assert.ok((manual?.exposureTime ?? 0) > 50)
  assert.ok((manual?.exposureTime ?? 0) < 100)
})

test('auto preset restores continuous exposure and focus', () => {
  const advanced = pickCameraPresetConstraints(
    {
      exposureMode: ['manual', 'continuous'],
      focusMode: ['manual', 'continuous'],
    },
    'auto'
  )
  assert.deepEqual(advanced, [{ focusMode: 'continuous' }, { exposureMode: 'continuous' }])
})

test('stacking and gain kick in when the device cannot hold a long shutter', () => {
  assert.equal(stackFrameCount('stars', false), 10)
  assert.equal(stackFrameCount('stars', true), 4)
  assert.ok(nightGain('stars', false) > nightGain('stars', true))
})

test('night lift brightens dark pixels without overflowing white', () => {
  const data = new Uint8ClampedArray([20, 20, 20, 255, 250, 250, 250, 255])
  applyNightLift(data, 1.5, 0.84)
  assert.ok(data[0] > 20)
  assert.equal(data[4], 255)
})

test('lerpRange snaps to the device step', () => {
  assert.equal(lerpRange({ min: 0, max: 10, step: 2 }, 0.5), 6)
  assert.equal(lerpRange(undefined, 1), null)
})
