/**
 * 입장권 부킹(`ticket_bookings.status`) — 테이블·상세·편집 폼에서 동일한 값·라벨·색을 쓰기 위한 단일 기준(레거시 요약 필드).
 * 레거시 DB 값 `paid` → `completed` 로만 정규화합니다.
 */

export const TICKET_BOOKING_STATUS_VALUES = [
  'tentative',
  'pending',
  'payment_requested',
  'guest_change_requested',
  'time_change_requested',
  'cancellation_requested',
  'confirmed',
  'completed',
  'cancelled',
  'credit',
] as const

export type TicketBookingCanonicalStatus = (typeof TICKET_BOOKING_STATUS_VALUES)[number]

const LEGACY_TO_CANONICAL: Record<string, TicketBookingCanonicalStatus> = {
  paid: 'completed',
}

const CANONICAL_SET = new Set<string>(TICKET_BOOKING_STATUS_VALUES)

/** 드롭다운·표시용: DB/레거시 값을 공통 상태 값으로 맞춤 */
export function normalizeTicketBookingStatusFromDb(
  raw: string | null | undefined
): TicketBookingCanonicalStatus | string {
  const s = (raw ?? '').trim().toLowerCase()
  if (!s) return 'pending'
  if (LEGACY_TO_CANONICAL[s]) return LEGACY_TO_CANONICAL[s]
  if (CANONICAL_SET.has(s)) return s as TicketBookingCanonicalStatus
  return s
}

/** 저장 시: 알려진 값만 정규화하고, 그 외는 그대로 둠(레거시·커스텀 보존) */
export function normalizeTicketBookingStatusForSave(
  raw: string | null | undefined
): TicketBookingCanonicalStatus | string {
  return normalizeTicketBookingStatusFromDb(raw)
}

export function getTicketBookingStatusBadgeClass(status: string | null | undefined): string {
  const normalizedStatus = (status ?? '').toLowerCase()
  switch (normalizedStatus) {
    case 'tentative':
      return 'bg-amber-100 text-amber-900'
    case 'pending':
      return 'bg-yellow-100 text-yellow-800'
    case 'confirmed':
      return 'bg-green-100 text-green-800'
    case 'cancelled':
    case 'canceled':
      return 'bg-red-100 text-red-800'
    case 'completed':
      return 'bg-blue-100 text-blue-800'
    case 'credit':
      return 'bg-cyan-100 text-cyan-800'
    case 'cancellation_requested':
      return 'bg-orange-100 text-orange-800'
    case 'guest_change_requested':
      return 'bg-purple-100 text-purple-800'
    case 'time_change_requested':
      return 'bg-indigo-100 text-indigo-800'
    case 'payment_requested':
      return 'bg-pink-100 text-pink-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

type CalendarT = (key: string) => string

/**
 * `booking.calendar` 번역 + 추가 상태(한/영) — TicketBookingList / 상세 모달과 동일한 문구.
 */
export function formatTicketBookingStatusLabel(
  raw: string | null | undefined,
  t: CalendarT,
  locale: string | undefined
): string {
  const loc = locale ?? 'ko'
  const normalized = normalizeTicketBookingStatusFromDb(raw)
  const n = String(normalized).toLowerCase()
  switch (n) {
    case 'tentative':
      return t('tentative')
    case 'pending':
      return t('pending')
    case 'confirmed':
      return t('confirmed')
    case 'cancelled':
    case 'canceled':
      return t('cancelled')
    case 'completed':
      return t('completed')
    case 'credit':
      return loc === 'en' ? 'Credit' : '크레딧'
    case 'cancellation_requested':
      return loc === 'en' ? 'Cancellation requested' : '전체 취소 요청'
    case 'guest_change_requested':
      return loc === 'en' ? 'Guest count change requested' : '인원 변경 요청'
    case 'time_change_requested':
      return loc === 'en' ? 'Time change requested' : '시간 변경 요청'
    case 'payment_requested':
      return loc === 'en' ? 'Payment requested' : '결제 요청'
    default:
      return String(raw ?? '').trim() || '—'
  }
}
