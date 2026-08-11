/**
 * 입장권 부킹 UI 표시 헬퍼 — 상태 한 줄 요약·수량·워크보드 필터
 * (DB/워크플로 로직은 변경하지 않음)
 */

import { formatHHMM } from '@/lib/ticketBookingWorkflow'
import {
  getCancelDueDateForTicketBooking,
  localDateYmd,
  type SeasonDate,
} from '@/lib/ticketBookingCancelDue'
import { isTicketBookingPendingRequestState } from '@/lib/ticketBookingWorkflow'

export type TicketBookingDisplaySnap = {
  company?: string | null
  check_in_date?: string | null
  time?: string | null
  ea?: number | null
  pending_ea?: number | null
  booking_status?: string | null
  vendor_status?: string | null
  change_status?: string | null
  payment_status?: string | null
  status?: string | null
  paid_amount?: number | null
  expense?: number | null
}

/** 예약이 취소(완료) 상태인지 */
export function isTicketBookingCancelledStatus(b: TicketBookingDisplaySnap): boolean {
  const bs = (b.booking_status ?? b.status ?? '').trim().toLowerCase()
  return bs === 'cancelled' || bs === 'canceled' || bs === 'failed' || bs === 'expired'
}

/**
 * 유효 수량: 취소면 0, 변경 요청 중이면 pending_ea(표시용 목표), 아니면 ea
 * — DB ea 컬럼은 취소 후에도 원래 수량을 유지하는 경우가 있음
 */
export function getTicketBookingEffectiveQty(b: TicketBookingDisplaySnap): number {
  if (isTicketBookingCancelledStatus(b)) return 0
  const cs = (b.change_status ?? 'none').toLowerCase()
  if (cs === 'requested' && b.pending_ea != null) return Number(b.pending_ea)
  return Number(b.ea ?? 0)
}

/** 원래(기록) 수량 — 화면의 ea */
export function getTicketBookingOriginalQty(b: TicketBookingDisplaySnap): number {
  return Number(b.ea ?? 0)
}

/**
 * 벤더 축 라벨: 취소 완료 + vendor confirmed → 「취소 승인」
 * (그 외는 기존 번역 키에 맡김 — 호출측에서 fallback)
 */
export function isVendorCancelApproval(
  b: Pick<TicketBookingDisplaySnap, 'booking_status' | 'status' | 'vendor_status'>
): boolean {
  if (!isTicketBookingCancelledStatus(b)) return false
  return (b.vendor_status ?? '').trim().toLowerCase() === 'confirmed'
}

export function formatVendorAxisLabelContextual(
  b: TicketBookingDisplaySnap,
  fallbackLabel: string,
  locale: string
): string {
  if (isVendorCancelApproval(b)) {
    return locale.startsWith('en') ? 'Cancel approved' : '취소 승인'
  }
  if (
    isTicketBookingCancelledStatus(b) &&
    (b.vendor_status ?? '').trim().toLowerCase() === 'cancelled'
  ) {
    return locale.startsWith('en') ? 'Vendor cancelled' : '벤더 취소'
  }
  return fallbackLabel
}

/** 수량: `6개 → 4개 (−2)` 또는 취소 시 `원래 6 / 유효 0` */
export function formatQtyDisplay(b: TicketBookingDisplaySnap, locale = 'ko'): string {
  const unit = locale.startsWith('en') ? '' : '개'
  const orig = getTicketBookingOriginalQty(b)
  const cs = (b.change_status ?? 'none').toLowerCase()

  if (isTicketBookingCancelledStatus(b)) {
    return locale.startsWith('en')
      ? `orig ${orig} / eff 0`
      : `원래 ${orig}${unit} / 유효 0${unit}`
  }

  if (cs === 'requested' && b.pending_ea != null && Number(b.pending_ea) !== orig) {
    const pend = Number(b.pending_ea)
    const delta = pend - orig
    const deltaStr = delta > 0 ? `+${delta}` : String(delta)
    return locale.startsWith('en')
      ? `${orig} → ${pend} (${deltaStr})`
      : `${orig}${unit} → ${pend}${unit} (${deltaStr})`
  }

  return locale.startsWith('en') ? `${orig}` : `${orig}${unit}`
}

/**
 * 예약·벤더·변경 축을 업무 관점의 단일 상태로 합침 (표시 전용 — DB 값은 그대로)
 *
 * 예: 취소완료+벤더확정 → 「취소 승인」 / 가예약요청+벤더대기 → 「가예약 대기」
 */
export type TicketBookingUnifiedStatusKey =
  | 'hold_pending'
  | 'hold_rejected'
  | 'tentative'
  | 'confirmed'
  | 'confirmed_vendor_pending'
  | 'change_pending'
  | 'cancel_requested'
  | 'cancel_approved'
  | 'vendor_cancelled'
  | 'cancelled'
  | 'failed'
  | 'expired'
  | 'no_show'
  | 'other'

export type TicketBookingUnifiedStatus = {
  key: TicketBookingUnifiedStatusKey
  label: string
  shortLabel: string
  detail: string
}

const UNIFIED_LABELS: Record<
  TicketBookingUnifiedStatusKey,
  { ko: string; en: string; shortKo: string; shortEn: string }
> = {
  hold_pending: {
    ko: '가예약 대기',
    en: 'Hold pending',
    shortKo: '대기',
    shortEn: 'Pend',
  },
  hold_rejected: {
    ko: '벤더 거절',
    en: 'Vendor rejected',
    shortKo: '거절',
    shortEn: 'Rej',
  },
  tentative: {
    ko: '가예약',
    en: 'Tentative',
    shortKo: '가예',
    shortEn: 'Tent',
  },
  confirmed: {
    ko: '확정',
    en: 'Confirmed',
    shortKo: '확정',
    shortEn: 'OK',
  },
  confirmed_vendor_pending: {
    ko: '확정 · 벤더 대기',
    en: 'Confirmed · vendor pending',
    shortKo: '확정?',
    shortEn: 'OK?',
  },
  change_pending: {
    ko: '변경 대기',
    en: 'Change pending',
    shortKo: '변경',
    shortEn: 'Chg',
  },
  cancel_requested: {
    ko: '취소 요청',
    en: 'Cancel requested',
    shortKo: '취요',
    shortEn: 'CXL?',
  },
  cancel_approved: {
    ko: '취소 승인',
    en: 'Cancel approved',
    shortKo: '취승',
    shortEn: 'CXL',
  },
  vendor_cancelled: {
    ko: '벤더 취소',
    en: 'Vendor cancelled',
    shortKo: '취벤',
    shortEn: 'V-CXL',
  },
  cancelled: {
    ko: '취소됨',
    en: 'Cancelled',
    shortKo: '취소',
    shortEn: 'CXL',
  },
  failed: {
    ko: '예약 실패',
    en: 'Failed',
    shortKo: '실패',
    shortEn: 'Fail',
  },
  expired: {
    ko: '만료',
    en: 'Expired',
    shortKo: '만료',
    shortEn: 'Exp',
  },
  no_show: {
    ko: '노쇼',
    en: 'No-show',
    shortKo: '노쇼',
    shortEn: 'NS',
  },
  other: {
    ko: '기타',
    en: 'Other',
    shortKo: '·',
    shortEn: '·',
  },
}

export function resolveTicketBookingUnifiedStatus(
  b: TicketBookingDisplaySnap,
  locale = 'ko'
): TicketBookingUnifiedStatus {
  const isEn = locale.startsWith('en')
  const bs = (b.booking_status ?? b.status ?? '').trim().toLowerCase()
  const vs = (b.vendor_status ?? '').trim().toLowerCase()
  const cs = (b.change_status ?? 'none').trim().toLowerCase()

  let key: TicketBookingUnifiedStatusKey = 'other'

  if (bs === 'failed') key = 'failed'
  else if (bs === 'expired') key = 'expired'
  else if (bs === 'no_show') key = 'no_show'
  else if (isTicketBookingCancelledStatus(b) && vs === 'confirmed') key = 'cancel_approved'
  else if (isTicketBookingCancelledStatus(b) && vs === 'cancelled') key = 'vendor_cancelled'
  else if (isTicketBookingCancelledStatus(b)) key = 'cancelled'
  else if (bs === 'cancel_requested') key = 'cancel_requested'
  else if (cs === 'requested') key = 'change_pending'
  else if (vs === 'rejected') key = 'hold_rejected'
  else if ((bs === 'requested' || bs === 'on_hold') && (vs === 'pending' || !vs))
    key = 'hold_pending'
  else if (bs === 'tentative') key = 'tentative'
  else if (bs === 'confirmed' && vs === 'confirmed') key = 'confirmed'
  else if (bs === 'confirmed' && (vs === 'pending' || !vs)) key = 'confirmed_vendor_pending'
  else if (bs === 'confirmed') key = 'confirmed'
  else if (bs === 'requested' || bs === 'on_hold') key = 'hold_pending'

  const L = UNIFIED_LABELS[key]
  const label = isEn ? L.en : L.ko
  const shortLabel = isEn ? L.shortEn : L.shortKo
  const detail = isEn
    ? `booking ${bs || '—'} · vendor ${vs || '—'}${cs !== 'none' ? ` · change ${cs}` : ''}`
    : `예약 ${bs || '—'} · 벤더 ${vs || '—'}${cs !== 'none' ? ` · 변경 ${cs}` : ''}`

  return { key, label, shortLabel, detail }
}

export function formatTicketBookingUnifiedStatus(
  b: TicketBookingDisplaySnap,
  locale = 'ko'
): string {
  return resolveTicketBookingUnifiedStatus(b, locale).label
}

export function getTicketBookingUnifiedStatusBadgeClass(
  key: TicketBookingUnifiedStatusKey | TicketBookingDisplaySnap
): string {
  const k =
    typeof key === 'string'
      ? key
      : resolveTicketBookingUnifiedStatus(key).key
  switch (k) {
    case 'hold_pending':
    case 'confirmed_vendor_pending':
      return 'bg-amber-100 text-amber-950 ring-1 ring-amber-200/80'
    case 'change_pending':
    case 'cancel_requested':
      return 'bg-orange-100 text-orange-950 ring-1 ring-orange-200/80'
    case 'tentative':
      return 'bg-sky-100 text-sky-900 ring-1 ring-sky-200/80'
    case 'confirmed':
      return 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/80'
    case 'hold_rejected':
    case 'cancel_approved':
    case 'vendor_cancelled':
    case 'cancelled':
    case 'failed':
      return 'bg-red-100 text-red-900 ring-1 ring-red-200/80'
    case 'expired':
    case 'no_show':
      return 'bg-slate-200 text-slate-800 ring-1 ring-slate-300/80'
    default:
      return 'bg-gray-100 text-gray-800 ring-1 ring-gray-200/80'
  }
}

/** 한 줄 요약 (상세 모달 상단) */
export function formatTicketBookingSummaryLine(
  b: TicketBookingDisplaySnap,
  locale = 'ko'
): string {
  const company = (b.company || '').trim() || '—'
  const date = (b.check_in_date || '').slice(0, 10) || '—'
  const time = formatHHMM(b.time) || '—'
  const orig = getTicketBookingOriginalQty(b)
  const eff = getTicketBookingEffectiveQty(b)
  const statusPart = formatTicketBookingUnifiedStatus(b, locale)

  const qtyPart = locale.startsWith('en')
    ? `eff ${eff} / orig ${orig}`
    : `유효 ${eff} / 원래 ${orig}`

  return [company, `${date} ${time}`, qtyPart, statusPart].join(' · ')
}

export type TicketWorkboardFilter =
  | 'none'
  | 'cancel_due'
  | 'needs_vendor'
  | 'unpaid'
  | 'tour_day'

export function matchesTicketWorkboardFilter(
  b: TicketBookingDisplaySnap,
  filter: TicketWorkboardFilter,
  opts?: {
    supplierProduct?: { season_dates: SeasonDate[] | null } | null
    todayYmd?: string
  }
): boolean {
  if (filter === 'none') return true
  const today = opts?.todayYmd ?? localDateYmd()

  switch (filter) {
    case 'needs_vendor':
      return isTicketBookingPendingRequestState(b)
    case 'cancel_due': {
      if (isTicketBookingCancelledStatus(b)) return false
      if (!b.check_in_date || !b.company) return false
      const due = getCancelDueDateForTicketBooking(
        { check_in_date: b.check_in_date, company: b.company },
        opts?.supplierProduct
      )
      if (!due) return false
      const checkIn = b.check_in_date.slice(0, 10)
      if (checkIn < today) return false
      const dueDate = new Date(`${due}T12:00:00`)
      const t = new Date(`${today}T12:00:00`)
      const diffDays = Math.round((dueDate.getTime() - t.getTime()) / 86400000)
      return diffDays <= 2
    }
    case 'unpaid': {
      if (isTicketBookingCancelledStatus(b)) return false
      const ps = (b.payment_status ?? '').toLowerCase()
      if (ps === 'paid') return false
      const eff = getTicketBookingEffectiveQty(b)
      if (eff <= 0) return false
      const expense = Number(b.expense ?? 0)
      const paid = Number(b.paid_amount ?? 0)
      if (expense > 0 && paid + 0.001 >= expense) return false
      return ps === 'not_due' || ps === 'requested' || ps === 'failed' || ps === 'partially_paid' || !ps
    }
    case 'tour_day': {
      const checkIn = (b.check_in_date || '').slice(0, 10)
      return checkIn === today
    }
    default:
      return true
  }
}

/** 달력 셀: Cancel Due 임박/지남 (취소 제외) */
export function isTicketBookingCancelDueHighlight(
  b: TicketBookingDisplaySnap,
  supplierProduct?: { season_dates: SeasonDate[] | null } | null,
  todayYmd: string = localDateYmd()
): boolean {
  return matchesTicketWorkboardFilter(b, 'cancel_due', {
    supplierProduct: supplierProduct ?? null,
    todayYmd,
  })
}
