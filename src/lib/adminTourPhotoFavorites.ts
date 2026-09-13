const STORAGE_PREFIX = 'kovegas:admin-tour-photo-favorites:'

function storageKey(email: string): string {
  return `${STORAGE_PREFIX}${email.trim().toLowerCase()}`
}

export function readAdminTourPhotoFavorites(email: string): string[] {
  if (typeof window === 'undefined' || !email.trim()) return []
  try {
    const raw = window.localStorage.getItem(storageKey(email))
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0)
  } catch {
    return []
  }
}

export function writeAdminTourPhotoFavorites(email: string, ids: string[]): void {
  if (typeof window === 'undefined' || !email.trim()) return
  const unique = Array.from(new Set(ids))
  window.localStorage.setItem(storageKey(email), JSON.stringify(unique))
}

export function toggleAdminTourPhotoFavorite(email: string, photoId: string): string[] {
  const current = readAdminTourPhotoFavorites(email)
  const next = current.includes(photoId)
    ? current.filter((id) => id !== photoId)
    : [...current, photoId]
  writeAdminTourPhotoFavorites(email, next)
  return next
}
