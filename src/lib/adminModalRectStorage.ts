export const TOUR_DETAIL_MODAL_RECT_KEY = 'admin-tour-detail-modal-rect'
export const RESERVATION_EDIT_MODAL_RECT_KEY = 'admin-reservation-edit-modal-rect'

export const TOUR_DETAIL_MODAL_DEFAULT_SIZE = {
  width: 1280,
  height: 900,
} as const

export const RESERVATION_EDIT_MODAL_DEFAULT_SIZE = {
  width: 1200,
  height: 860,
} as const

const LEGACY_TOUR_DETAIL_MODAL_RECT_KEY = 'admin-todo-tour-hotel-detail-modal-rect'

/** 이전 키로 저장된 투어 상세 모달 크기를 공통 키로 이전 */
export function migrateLegacyTourDetailModalRect(): void {
  if (typeof window === 'undefined') return
  try {
    if (window.localStorage.getItem(TOUR_DETAIL_MODAL_RECT_KEY)) return
    const legacy = window.localStorage.getItem(LEGACY_TOUR_DETAIL_MODAL_RECT_KEY)
    if (legacy) {
      window.localStorage.setItem(TOUR_DETAIL_MODAL_RECT_KEY, legacy)
    }
  } catch {
    /* ignore */
  }
}
