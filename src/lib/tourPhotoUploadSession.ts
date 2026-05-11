export type TourPhotoUploadSessionState = {
  active: boolean
  /** Storage/중복 검사 등 실제 업로드 세션 시작 전 */
  preparing: boolean
  tourId: string | null
  current: number
  total: number
  /** preparing 단계에서 선택된 파일 수(안내용) */
  prepareSelectedCount: number
}

const initial: TourPhotoUploadSessionState = {
  active: false,
  preparing: false,
  tourId: null,
  current: 0,
  total: 0,
  prepareSelectedCount: 0,
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

/** 파일 선택 직후 ~ 업로드 큐가 본격 시작하기 전까지 표시용 */
export function startTourPhotoPrepare(tourId: string, selectedCount: number) {
  state = {
    active: true,
    preparing: true,
    tourId,
    current: 0,
    total: 0,
    prepareSelectedCount: Math.max(0, selectedCount),
  }
  emit()
}

export function startTourPhotoUploadSession(tourId: string, total: number) {
  state = {
    active: true,
    preparing: false,
    tourId,
    total,
    current: 0,
    prepareSelectedCount: 0,
  }
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
