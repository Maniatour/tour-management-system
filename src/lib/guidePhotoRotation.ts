export type PhotoRotation = 0 | 90 | 180 | 270

const STORAGE_PREFIX = 'kovegas.guide.photoRotation:'

export function normalizePhotoRotation(value: unknown): PhotoRotation {
  const n = Number(value)
  if (n === 90 || n === 180 || n === 270) return n
  return 0
}

export function nextPhotoRotation(current: PhotoRotation): PhotoRotation {
  return normalizePhotoRotation((current + 90) % 360)
}

export function readPhotoRotation(id: string): PhotoRotation {
  if (typeof window === 'undefined' || !id) return 0
  try {
    return normalizePhotoRotation(window.localStorage.getItem(`${STORAGE_PREFIX}${id}`))
  } catch {
    return 0
  }
}

export function storePhotoRotation(id: string, rotation: PhotoRotation): void {
  if (typeof window === 'undefined' || !id) return
  try {
    if (rotation === 0) window.localStorage.removeItem(`${STORAGE_PREFIX}${id}`)
    else window.localStorage.setItem(`${STORAGE_PREFIX}${id}`, String(rotation))
  } catch {
    // ignore storage failures
  }
}
