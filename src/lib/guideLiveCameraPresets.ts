import {
  applyTrackAdvancedConstraints,
  captureGuideLivePhoto,
  clampLongEdge,
  enableContinuousAutofocus,
  GUIDE_CAMERA_JPEG_QUALITY,
  GUIDE_CAMERA_STACK_MAX_EDGE,
  type ImageCaptureConstraintSet,
} from '@/lib/guideLiveCameraFocus'

export const CAMERA_PRESETS = ['auto', 'night', 'stars'] as const
export type CameraPreset = (typeof CAMERA_PRESETS)[number]

type Range = { min?: number; max?: number; step?: number }

type CameraCapabilities = {
  exposureMode?: string[]
  focusMode?: string[]
  exposureTime?: Range
  iso?: Range
  exposureCompensation?: Range
  brightness?: Range
  focusDistance?: Range
}

export type CameraPresetSupport = {
  hasManualExposure: boolean
  hasManualIso: boolean
  hasInfinityFocus: boolean
}

export type CameraPresetApplyResult = CameraPresetSupport & {
  preset: CameraPreset
}

function asStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function readCapabilities(track: MediaStreamTrack): CameraCapabilities {
  try {
    return ((track.getCapabilities?.() as CameraCapabilities | undefined) || {}) as CameraCapabilities
  } catch {
    return {}
  }
}

function snapToRange(value: number, range: Range): number {
  const min = Number.isFinite(range.min) ? (range.min as number) : value
  const max = Number.isFinite(range.max) ? (range.max as number) : value
  const clamped = Math.min(max, Math.max(min, value))
  const step = range.step
  if (!step || step <= 0) return clamped
  return Math.min(max, min + Math.round((clamped - min) / step) * step)
}

export function lerpRange(range: Range | undefined, t: number): number | null {
  if (!range || !Number.isFinite(range.min) || !Number.isFinite(range.max)) return null
  const min = range.min as number
  const max = range.max as number
  if (max === min) return max
  return snapToRange(min + (max - min) * t, range)
}

export function readCameraPresetSupport(track: MediaStreamTrack | null | undefined): CameraPresetSupport {
  if (!track) {
    return { hasManualExposure: false, hasManualIso: false, hasInfinityFocus: false }
  }
  const caps = readCapabilities(track)
  const exposureModes = asStringList(caps.exposureMode)
  return {
    hasManualExposure:
      exposureModes.includes('manual') &&
      (Boolean(lerpRange(caps.exposureTime, 1)) || Boolean(lerpRange(caps.exposureCompensation, 1))),
    hasManualIso: Boolean(lerpRange(caps.iso, 1)),
    hasInfinityFocus: asStringList(caps.focusMode).includes('manual') && Boolean(lerpRange(caps.focusDistance, 1)),
  }
}

export function pickCameraPresetConstraints(
  capabilities: CameraCapabilities,
  preset: CameraPreset
): ImageCaptureConstraintSet[] {
  const exposureModes = asStringList(capabilities.exposureMode)
  const focusModes = asStringList(capabilities.focusMode)
  const advanced: ImageCaptureConstraintSet[] = []

  if (preset === 'auto') {
    if (focusModes.includes('continuous')) advanced.push({ focusMode: 'continuous' })
    if (exposureModes.includes('continuous')) advanced.push({ exposureMode: 'continuous' })
    return advanced
  }

  const exposureT = preset === 'stars' ? 1 : 0.62
  const isoT = preset === 'stars' ? 0.78 : 0.48
  const compensationT = preset === 'stars' ? 1 : 0.7

  if (exposureModes.includes('manual')) {
    const exposureTime = lerpRange(capabilities.exposureTime, exposureT)
    const iso = lerpRange(capabilities.iso, isoT)
    const manual: ImageCaptureConstraintSet = { exposureMode: 'manual' }
    if (exposureTime != null) manual.exposureTime = exposureTime
    if (iso != null) manual.iso = iso
    advanced.push(manual)
  } else {
    const compensation = lerpRange(capabilities.exposureCompensation, compensationT)
    if (compensation != null) advanced.push({ exposureCompensation: compensation })
    const brightness = lerpRange(capabilities.brightness, compensationT)
    if (brightness != null) advanced.push({ brightness })
  }

  if (preset === 'stars' && focusModes.includes('manual')) {
    const infinity = lerpRange(capabilities.focusDistance, 1)
    if (infinity != null) advanced.push({ focusMode: 'manual', focusDistance: infinity })
  } else if (focusModes.includes('continuous')) {
    advanced.push({ focusMode: 'continuous' })
  }

  return advanced
}

export function stackFrameCount(preset: CameraPreset, hasManualExposure: boolean): number {
  if (preset === 'auto') return 1
  if (preset === 'stars') return hasManualExposure ? 4 : 10
  return hasManualExposure ? 1 : 6
}

export function nightGain(preset: CameraPreset, hasManualExposure: boolean): number {
  if (preset === 'stars') return hasManualExposure ? 1.12 : 1.55
  if (preset === 'night') return hasManualExposure ? 1.04 : 1.28
  return 1
}

export function applyNightLift(data: Uint8ClampedArray, gain: number, gamma = 0.86): void {
  if (gain <= 1 && gamma >= 1) return
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.round(Math.pow(data[i] / 255, gamma) * gain * 255))
    data[i + 1] = Math.min(255, Math.round(Math.pow(data[i + 1] / 255, gamma) * gain * 255))
    data[i + 2] = Math.min(255, Math.round(Math.pow(data[i + 2] / 255, gamma) * gain * 255))
  }
}

function waitFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    let left = Math.max(1, count)
    const tick = () => {
      left -= 1
      if (left <= 0) {
        resolve()
        return
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

async function captureStackedPreview(
  video: HTMLVideoElement,
  frameCount: number,
  gain: number
): Promise<File | null> {
  if (video.videoWidth < 1 || video.videoHeight < 1) return null
  const { width, height } = clampLongEdge(video.videoWidth, video.videoHeight, GUIDE_CAMERA_STACK_MAX_EDGE)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  const acc = new Float32Array(width * height * 4)
  const frames = Math.max(1, frameCount)

  for (let i = 0; i < frames; i += 1) {
    ctx.drawImage(video, 0, 0, width, height)
    const pixels = ctx.getImageData(0, 0, width, height).data
    for (let p = 0; p < pixels.length; p += 1) acc[p] += pixels[p]
    if (i < frames - 1) await waitFrames(2)
  }

  const output = ctx.createImageData(width, height)
  for (let p = 0; p < output.data.length; p += 1) {
    output.data[p] = Math.round(acc[p] / frames)
  }
  applyNightLift(output.data, gain, presetGamma(gain))
  ctx.putImageData(output, 0, 0)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', GUIDE_CAMERA_JPEG_QUALITY)
  })
  if (!blob) return null
  return new File([blob], `tour-photo-${Date.now()}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  })
}

function presetGamma(gain: number): number {
  return gain > 1.2 ? 0.84 : 0.92
}

export async function applyCameraPreset(
  track: MediaStreamTrack,
  preset: CameraPreset
): Promise<CameraPresetApplyResult> {
  if (preset === 'auto') {
    await enableContinuousAutofocus(track)
    return { preset, ...readCameraPresetSupport(track) }
  }

  const caps = readCapabilities(track)
  const advanced = pickCameraPresetConstraints(caps, preset)
  await applyTrackAdvancedConstraints(track, advanced)
  await waitFrames(8)
  return { preset, ...readCameraPresetSupport(track) }
}

export async function captureWithCameraPreset(
  video: HTMLVideoElement,
  stream: MediaStream | null,
  preset: CameraPreset,
  support: CameraPresetSupport
): Promise<File | null> {
  if (preset === 'auto') return captureGuideLivePhoto(video, stream)

  const frames = stackFrameCount(preset, support.hasManualExposure)
  const gain = nightGain(preset, support.hasManualExposure)
  if (frames <= 1 && gain <= 1.05) {
    return captureGuideLivePhoto(video, stream, { preferPreview: true })
  }
  return captureStackedPreview(video, frames, gain)
}
