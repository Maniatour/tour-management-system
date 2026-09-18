import {
  applyTrackAdvancedConstraints,
  type ImageCaptureConstraintSet,
} from '@/lib/guideLiveCameraFocus'

type Range = { min: number; max: number; step: number }

function readCapabilities(track: MediaStreamTrack): Record<string, unknown> {
  try {
    return ((track.getCapabilities?.() as Record<string, unknown> | undefined) || {}) as Record<string, unknown>
  } catch {
    return {}
  }
}

function asRange(value: unknown): Range | null {
  if (!value || typeof value !== 'object') return null
  const range = value as { min?: number; max?: number; step?: number }
  if (!Number.isFinite(range.min) || !Number.isFinite(range.max)) return null
  const min = range.min as number
  const max = range.max as number
  if (max <= min) return null
  return { min, max, step: Number.isFinite(range.step) && (range.step as number) > 0 ? (range.step as number) : (max - min) / 20 }
}

export function readTorchSupport(track: MediaStreamTrack | null | undefined): boolean {
  if (!track) return false
  const caps = readCapabilities(track)
  return Boolean(caps.torch)
}

export async function setCameraTorch(track: MediaStreamTrack, on: boolean): Promise<boolean> {
  return applyTrackAdvancedConstraints(track, [{ torch: on }])
}

export function readExposureCompensationRange(track: MediaStreamTrack | null | undefined): Range | null {
  if (!track) return null
  return asRange(readCapabilities(track).exposureCompensation)
}

export function snapExposureCompensation(value: number, range: Range): number {
  const clamped = Math.min(range.max, Math.max(range.min, value))
  if (range.step <= 0) return clamped
  return Math.min(range.max, range.min + Math.round((clamped - range.min) / range.step) * range.step)
}

export async function setExposureCompensation(track: MediaStreamTrack, value: number): Promise<boolean> {
  const range = readExposureCompensationRange(track)
  if (!range) return false
  const next = snapExposureCompensation(value, range)
  const advanced: ImageCaptureConstraintSet[] = [{ exposureCompensation: next }]
  return applyTrackAdvancedConstraints(track, advanced)
}
