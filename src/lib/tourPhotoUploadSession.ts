export type TourPhotoUploadSessionState = {
  active: boolean
  tourId: string | null
  current: number
  total: number
}

const initial: TourPhotoUploadSessionState = {
  active: false,
  tourId: null,
  current: 0,
  total: 0,
}

let state: TourPhotoUploadSessionState = { ...initial }
const listeners = new Set<() => void>()

export function getTourPhotoUploadSession(): TourPhotoUploadSessionState {
  return state
}

export function subscribeTourPhotoUploadSession(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange)
  return () => listeners.delete(onStoreChange)
}

function emit() {
  listeners.forEach((l) => l())
}

export function startTourPhotoUploadSession(tourId: string, total: number) {
  state = { active: true, tourId, total, current: 0 }
  emit()
}

export function updateTourPhotoUploadProgress(current: number, total?: number) {
  state = {
    ...state,
    current,
    ...(typeof total === 'number' ? { total } : {}),
  }
  emit()
}

export function endTourPhotoUploadSession() {
  state = { ...initial }
  emit()
}
