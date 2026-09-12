export type NormalizedPoint = { x: number; y: number }

export const GUIDE_CAMERA_MAX_EDGE = 3840
export const GUIDE_CAMERA_JPEG_QUALITY = 0.94
export const GUIDE_CAMERA_STACK_MAX_EDGE = 1920

export function clampLongEdge(width: number, height: number, maxEdge: number): { width: number; height: number } {
  if (width < 1 || height < 1) return { width: Math.max(1, width), height: Math.max(1, height) }
  const longest = Math.max(width, height)
  if (longest <= maxEdge) return { width, height }
  const scale = maxEdge / longest
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

export function pickStillPhotoSize(capabilities: {
  imageWidth?: { max?: number }
  imageHeight?: { max?: number }
}): { imageWidth: number; imageHeight: number } | null {
  const width = capabilities.imageWidth?.max
  const height = capabilities.imageHeight?.max
  if (!width || !height || width < 1 || height < 1) return null
  return { imageWidth: Math.round(width), imageHeight: Math.round(height) }
}

export type ImageCaptureConstraintSet = MediaTrackConstraintSet & {
  focusMode?: string
  exposureMode?: string
  pointsOfInterest?: NormalizedPoint[]
  focusDistance?: number
  exposureTime?: number
  iso?: number
  exposureCompensation?: number
  brightness?: number
}

type FocusCapabilities = {
  focusMode?: string[]
  exposureMode?: string[]
  pointsOfInterest?: unknown
  focusDistance?: { min?: number; max?: number; step?: number }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function asStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

/** object-cover 미리보기에서 탭 좌표를 영상 프레임 정규화 좌표(0~1)로 변환한다. */
export function mapCoverTapToNormalizedPoint(
  tap: { clientX: number; clientY: number },
  elementRect: { left: number; top: number; width: number; height: number },
  videoSize: { width: number; height: number }
): NormalizedPoint | null {
  if (elementRect.width < 1 || elementRect.height < 1 || videoSize.width < 1 || videoSize.height < 1) {
    return null
  }

  const localX = tap.clientX - elementRect.left
  const localY = tap.clientY - elementRect.top
  const videoRatio = videoSize.width / videoSize.height
  const elementRatio = elementRect.width / elementRect.height

  let renderWidth = elementRect.width
  let renderHeight = elementRect.height
  let offsetX = 0
  let offsetY = 0

  if (videoRatio > elementRatio) {
    renderHeight = elementRect.height
    renderWidth = renderHeight * videoRatio
    offsetX = (elementRect.width - renderWidth) / 2
  } else {
    renderWidth = elementRect.width
    renderHeight = renderWidth / videoRatio
    offsetY = (elementRect.height - renderHeight) / 2
  }

  return {
    x: clamp01((localX - offsetX) / renderWidth),
    y: clamp01((localY - offsetY) / renderHeight),
  }
}

export function pickTapFocusAdvancedConstraints(
  capabilities: FocusCapabilities,
  point: NormalizedPoint,
  options?: { preserveExposure?: boolean }
): ImageCaptureConstraintSet[] {
  const advanced: ImageCaptureConstraintSet[] = []
  const clamped = { x: clamp01(point.x), y: clamp01(point.y) }
  const focusModes = asStringList(capabilities.focusMode)
  const exposureModes = asStringList(capabilities.exposureMode)

  if (capabilities.pointsOfInterest) {
    advanced.push({ pointsOfInterest: [clamped] })
  }

  if (focusModes.includes('single-shot')) {
    advanced.push({ focusMode: 'single-shot' })
  } else if (focusModes.includes('continuous')) {
    advanced.push({ focusMode: 'continuous' })
  }

  if (!options?.preserveExposure) {
    if (exposureModes.includes('single-shot')) {
      advanced.push({ exposureMode: 'single-shot' })
    } else if (exposureModes.includes('continuous')) {
      advanced.push({ exposureMode: 'continuous' })
    }
  }

  return advanced
}

export function sampleFocusDistances(min: number, max: number, step?: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return []
  const span = max - min
  const count =
    step && step > 0 ? Math.min(8, Math.max(5, Math.round(span / Math.max(step, span / 8)))) : 6
  const distances: number[] = []
  for (let i = 0; i < count; i += 1) {
    distances.push(min + (span * i) / (count - 1))
  }
  return distances
}

export function measureRegionContrast(data: Uint8ClampedArray): number {
  let sum = 0
  let sumSq = 0
  let count = 0
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    sum += gray
    sumSq += gray * gray
    count += 1
  }
  if (count < 2) return 0
  const mean = sum / count
  return sumSq / count - mean * mean
}

function readCapabilities(track: MediaStreamTrack): FocusCapabilities {
  try {
    return ((track.getCapabilities?.() as FocusCapabilities | undefined) || {}) as FocusCapabilities
  } catch {
    return {}
  }
}

export async function applyTrackAdvancedConstraints(
  track: MediaStreamTrack,
  advanced: ImageCaptureConstraintSet[]
): Promise<boolean> {
  if (advanced.length === 0) return false
  try {
    await track.applyConstraints({ advanced: advanced as MediaTrackConstraintSet[] })
    return true
  } catch {
    let anyApplied = false
    for (const item of advanced) {
      try {
        await track.applyConstraints({ advanced: [item] as MediaTrackConstraintSet[] })
        anyApplied = true
      } catch {
        // 기기마다 지원하는 제약만 남긴다
      }
    }
    return anyApplied
  }
}

export async function preferMaxCameraResolution(track: MediaStreamTrack): Promise<void> {
  let capabilities: MediaTrackCapabilities
  try {
    capabilities = track.getCapabilities()
  } catch {
    return
  }
  const next: MediaTrackConstraints = {}
  if (typeof capabilities.width?.max === 'number' && capabilities.width.max > 0) {
    next.width = { ideal: Math.min(Math.round(capabilities.width.max), GUIDE_CAMERA_MAX_EDGE) }
  }
  if (typeof capabilities.height?.max === 'number' && capabilities.height.max > 0) {
    next.height = { ideal: Math.min(Math.round(capabilities.height.max), GUIDE_CAMERA_MAX_EDGE) }
  }
  if (!next.width && !next.height) return
  try {
    await track.applyConstraints(next)
  } catch {
    // 기기가 최대 해상도를 거절하면 현재 스트림을 유지
  }
}

const GUIDE_CAMERA_STREAM_ATTEMPTS: MediaStreamConstraints[] = [
  {
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 4032 },
      height: { ideal: 3024 },
      ...({
        focusMode: { ideal: 'continuous' },
        exposureMode: { ideal: 'continuous' },
        resizeMode: 'none',
      } as MediaTrackConstraints),
    },
  },
  {
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 3840 },
      height: { ideal: 2160 },
    },
  },
  {
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
  },
  { audio: false, video: { facingMode: 'environment' } },
  { audio: false, video: true },
]

export async function openGuideLiveCameraStream(): Promise<MediaStream> {
  let lastError: unknown
  for (const constraints of GUIDE_CAMERA_STREAM_ATTEMPTS) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      const track = stream.getVideoTracks()[0]
      if (track) {
        await preferMaxCameraResolution(track)
        await enableContinuousAutofocus(track)
      }
      return stream
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('camera_unavailable')
}

export async function enableContinuousAutofocus(track: MediaStreamTrack): Promise<void> {
  if ('contentHint' in track) {
    try {
      track.contentHint = 'detail'
    } catch {
      // ignore unsupported assignment
    }
  }

  const caps = readCapabilities(track)
  const focusModes = asStringList(caps.focusMode)
  const exposureModes = asStringList(caps.exposureMode)
  const advanced: ImageCaptureConstraintSet[] = []
  if (focusModes.includes('continuous')) advanced.push({ focusMode: 'continuous' })
  if (exposureModes.includes('continuous')) advanced.push({ exposureMode: 'continuous' })
  await applyTrackAdvancedConstraints(track, advanced)
}

function waitAnimationFrames(frames: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    let remaining = Math.max(1, frames)
    let frameId = 0
    const onAbort = () => {
      if (frameId) cancelAnimationFrame(frameId)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    const tick = () => {
      remaining -= 1
      if (remaining <= 0) {
        signal?.removeEventListener('abort', onAbort)
        resolve()
        return
      }
      frameId = requestAnimationFrame(tick)
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    frameId = requestAnimationFrame(tick)
  })
}

function sampleTapRegion(
  video: HTMLVideoElement,
  point: NormalizedPoint,
  canvas: HTMLCanvasElement
): Uint8ClampedArray | null {
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (vw < 8 || vh < 1) return null
  const region = Math.max(24, Math.round(Math.min(vw, vh) * 0.2))
  const sx = Math.min(vw - region, Math.max(0, Math.round(point.x * vw - region / 2)))
  const sy = Math.min(vh - region, Math.max(0, Math.round(point.y * vh - region / 2)))
  canvas.width = region
  canvas.height = region
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(video, sx, sy, region, region, 0, 0, region, region)
  return ctx.getImageData(0, 0, region, region).data
}

async function contrastFocusAtPoint(
  track: MediaStreamTrack,
  video: HTMLVideoElement,
  point: NormalizedPoint,
  focusDistance: { min?: number; max?: number; step?: number },
  signal?: AbortSignal
): Promise<boolean> {
  const distances = sampleFocusDistances(focusDistance.min ?? 0, focusDistance.max ?? 0, focusDistance.step)
  if (distances.length === 0) return false

  const canvas = document.createElement('canvas')
  let bestDistance = distances[0]
  let bestContrast = -1

  for (const distance of distances) {
    if (signal?.aborted) return false
    const applied = await applyTrackAdvancedConstraints(track, [{ focusMode: 'manual', focusDistance: distance }])
    if (!applied) return false
    try {
      await waitAnimationFrames(2, signal)
    } catch {
      return false
    }
    const pixels = sampleTapRegion(video, point, canvas)
    if (!pixels) continue
    const contrast = measureRegionContrast(pixels)
    if (contrast > bestContrast) {
      bestContrast = contrast
      bestDistance = distance
    }
  }

  return applyTrackAdvancedConstraints(track, [{ focusMode: 'manual', focusDistance: bestDistance }])
}

export async function applyTapToFocus(options: {
  track: MediaStreamTrack
  point: NormalizedPoint
  video?: HTMLVideoElement | null
  signal?: AbortSignal
  preserveExposure?: boolean
  skipDistanceSweep?: boolean
}): Promise<boolean> {
  const { track, point, video, signal, preserveExposure, skipDistanceSweep } = options
  if (signal?.aborted) return false

  const caps = readCapabilities(track)
  const advanced = pickTapFocusAdvancedConstraints(caps, point, { preserveExposure: Boolean(preserveExposure) })
  const applied = await applyTrackAdvancedConstraints(track, advanced)
  if (skipDistanceSweep) return applied
  if (applied && caps.pointsOfInterest) return true
  if (applied && !caps.focusDistance) return true
  if (!video || !caps.focusDistance) return applied

  try {
    return await contrastFocusAtPoint(track, video, point, caps.focusDistance, signal)
  } catch {
    return applied
  }
}

type PhotoSizeRange = { min?: number; max?: number }
type PhotoCapabilitiesLike = {
  imageWidth?: PhotoSizeRange
  imageHeight?: PhotoSizeRange
}
type ImageCaptureLike = {
  takePhoto: (settings?: { imageWidth?: number; imageHeight?: number }) => Promise<Blob>
  getPhotoCapabilities?: () => Promise<PhotoCapabilitiesLike>
}

function createImageCapture(track: MediaStreamTrack): ImageCaptureLike | null {
  const ctor = (globalThis as unknown as { ImageCapture?: new (t: MediaStreamTrack) => ImageCaptureLike }).ImageCapture
  if (!ctor) return null
  try {
    return new ctor(track)
  } catch {
    return null
  }
}

async function takeHighestStillPhoto(track: MediaStreamTrack): Promise<Blob | null> {
  const imageCapture = createImageCapture(track)
  if (!imageCapture) return null
  let size: { imageWidth: number; imageHeight: number } | null = null
  try {
    const capabilities = await imageCapture.getPhotoCapabilities?.()
    if (capabilities) size = pickStillPhotoSize(capabilities)
  } catch {
    size = null
  }
  try {
    if (size) {
      try {
        return await imageCapture.takePhoto(size)
      } catch {
        return await imageCapture.takePhoto()
      }
    }
    return await imageCapture.takePhoto()
  } catch {
    return null
  }
}

function fileFromBlob(blob: Blob): File {
  const type = blob.type || 'image/jpeg'
  const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg'
  return new File([blob], `tour-photo-${Date.now()}.${ext}`, {
    type,
    lastModified: Date.now(),
  })
}

export function captureVideoFrame(video: HTMLVideoElement, quality = GUIDE_CAMERA_JPEG_QUALITY): Promise<File | null> {
  if (video.videoWidth < 1 || video.videoHeight < 1) return Promise.resolve(null)
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(video, 0, 0)
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(null)
          return
        }
        resolve(fileFromBlob(blob))
      },
      'image/jpeg',
      quality
    )
  })
}

/** 가능하면 카메라 스틸(takePhoto)을 쓰고, 아니면 미리보기 프레임을 캡처한다. */
export async function captureGuideLivePhoto(
  video: HTMLVideoElement,
  stream: MediaStream | null,
  options?: { preferPreview?: boolean }
): Promise<File | null> {
  if (!options?.preferPreview) {
    const track = stream?.getVideoTracks()[0]
    if (track) {
      const blob = await takeHighestStillPhoto(track)
      if (blob && blob.size > 0) return fileFromBlob(blob)
    }
  }
  return captureVideoFrame(video)
}
