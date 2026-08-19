import { isTicketBookingPendingRequestState } from '@/lib/ticketBookingWorkflow'
import {
  resolveTicketBookingUnifiedStatus,
  TICKET_BOOKING_UNIFIED_STATUS_FILTER_KEYS,
  type TicketBookingUnifiedStatusKey,
} from '@/lib/ticketBookingDisplay'

/** 목록 필터: 예매·변경 요청 후 벤더 응답 대기 (레거시 status 와 별도) */
export const TICKET_BOOKING_STATUS_FILTER_VENDOR_PENDING = '__vendor_pending__' as const

export type TicketBookingStatusFilterKey =
  | typeof TICKET_BOOKING_STATUS_FILTER_VENDOR_PENDING
  | TicketBookingUnifiedStatusKey
  | string

export type TicketBookingStatusFilterRow = {
  booking_status?: string | null
  vendor_status?: string | null
  change_status?: string | null
  status?: string | null
}

const UNIFIED_FILTER_KEY_SET = new Set<string>(TICKET_BOOKING_UNIFIED_STATUS_FILTER_KEYS)

/**
 * 예전 레거시 `status` 필터 키 → 달력 칩과 같은 통합 상태.
 * (기존에 선택된 필터 값이 남아 있어도 동작하도록)
 */
const LEGACY_STATUS_FILTER_TO_UNIFIED: Record<string, TicketBookingUnifiedStatusKey[]> = {
  pending: ['hold_pending'],
  tentative: ['tentative'],
  confirmed: ['confirmed'],
  completed: ['confirmed'],
  cancellation_requested: ['cancel_requested'],
  guest_change_requested: ['change_pending'],
  time_change_requested: ['change_pending'],
  cancelled: ['cancelled', 'cancel_approved', 'vendor_cancelled', 'weather_cancelled'],
  canceled: ['cancelled', 'cancel_approved', 'vendor_cancelled', 'weather_cancelled'],
  payment_requested: ['other'],
  credit: ['other'],
}

function unifiedKeysForFilterKey(key: string): TicketBookingUnifiedStatusKey[] {
  const k = key.trim().toLowerCase()
  if (k === 'failed') return ['cancelled']
  if (UNIFIED_FILTER_KEY_SET.has(k)) {
    return k === 'cancelled' ? ['cancelled', 'failed'] : [k as TicketBookingUnifiedStatusKey]
  }
  return LEGACY_STATUS_FILTER_TO_UNIFIED[k] ?? []
}

function unifiedStatusMatchesFilterKey(
  unified: TicketBookingUnifiedStatusKey,
  key: string
): boolean {
  const mapped = unifiedKeysForFilterKey(key)
  if (mapped.length > 0) return mapped.includes(unified)
  return unified === key.trim().toLowerCase()
}

/** 선택이 없으면 전체 통과. 달력 칩과 동일한 통합 상태로 맞춘다. */
export function ticketBookingMatchesStatusFilters(
  booking: TicketBookingStatusFilterRow,
  selected: ReadonlySet<string>
): boolean {
  if (selected.size === 0) return true

  if (
    selected.has(TICKET_BOOKING_STATUS_FILTER_VENDOR_PENDING) &&
    isTicketBookingPendingRequestState(booking)
  ) {
    return true
  }

  const unified = resolveTicketBookingUnifiedStatus(booking).key
  for (const key of selected) {
    if (key === TICKET_BOOKING_STATUS_FILTER_VENDOR_PENDING) continue
    if (unifiedStatusMatchesFilterKey(unified, key)) return true
  }
  return false
}
