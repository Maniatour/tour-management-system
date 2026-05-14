import type { Reservation } from '@/types/reservation'

function isBlankLinkId(v: string | null | undefined): boolean {
  if (v == null) return true
  const s = String(v).trim()
  return s === '' || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined'
}

/**
 * 새 예약 모달의 ensure-draft 가 넣은 최소 행과 동일하게,
 * 고객·상품·투어가 아직 연결되지 않은 pending 예약.
 * (저장 없이 닫혔을 때 abandon-draft 로 지울 수 있는 행과 동일 기준)
 */
export function isMinimalUnlinkedReservationRow(r: Reservation): boolean {
  const st = String(r.status ?? '').trim().toLowerCase()
  if (st === 'deleted') return false
  return (
    st === 'pending' &&
    isBlankLinkId(r.customerId) &&
    isBlankLinkId(r.productId) &&
    isBlankLinkId(r.tourId)
  )
}
