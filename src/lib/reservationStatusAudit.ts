import { isoToLocalCalendarDateKey } from '@/utils/reservationUtils'

export type ReservationStatusAuditRow = {
  record_id: string
  created_at: string
  changed_fields: string[] | null
  old_values: unknown
  new_values: unknown
}

export function statusFromReservationAuditJson(json: unknown): string | null {
  if (!json || typeof json !== 'object') return null
  const v = (json as Record<string, unknown>).status
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function isCancelledLikeReservationStatus(s: string): boolean {
  const t = s.toLowerCase().trim()
  return t === 'cancelled' || t === 'canceled' || t === 'deleted'
}

/**
 * 예약 목록(심플 카드) 「상태 변경」에만 노출할 전환:
 * 대기(pending) → 확정(confirmed), 대기·확정 → 취소/삭제류
 */
export function isSimpleCardListedReservationStatusTransition(tr: {
  from: string
  to: string
}): boolean {
  const from = tr.from.toLowerCase().trim()
  const to = tr.to.toLowerCase().trim()
  if (from === 'pending' && to === 'confirmed') return true
  if ((from === 'pending' || from === 'confirmed') && isCancelledLikeReservationStatus(tr.to)) return true
  return false
}

/** 그날 마지막 유효 status 변경 1건(심플 카드 등) */
export function pickReservationStatusTransitionForDay(
  rows: ReservationStatusAuditRow[],
  dateKey: string
): { from: string; to: string } | null {
  const candidates = rows
    .filter((r) => isoToLocalCalendarDateKey(r.created_at) === dateKey)
    .filter((r) => Array.isArray(r.changed_fields) && r.changed_fields.includes('status'))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  for (const row of candidates) {
    const to = statusFromReservationAuditJson(row.new_values)
    const from = statusFromReservationAuditJson(row.old_values)
    if (to && from && from !== to) return { from, to }
  }
  return null
}

/**
 * 그날 감사 로그 중, 심플 카드 「상태 변경」에 표시할 전환만 모은 뒤
 * 가장 최근 시각 1건을 반환한다. (당일 확정 후 완료 등은 제외)
 */
export function pickReservationStatusTransitionForSimpleCardDay(
  rows: ReservationStatusAuditRow[],
  dateKey: string
): { from: string; to: string } | null {
  let best: { from: string; to: string; t: number } | null = null
  for (const row of rows) {
    if (isoToLocalCalendarDateKey(row.created_at) !== dateKey) continue
    if (!Array.isArray(row.changed_fields) || !row.changed_fields.includes('status')) continue
    const to = statusFromReservationAuditJson(row.new_values)
    const from = statusFromReservationAuditJson(row.old_values)
    if (!to || !from || from === to) continue
    if (!isSimpleCardListedReservationStatusTransition({ from, to })) continue
    const t = new Date(row.created_at).getTime()
    if (!best || t > best.t) best = { from, to, t }
  }
  return best ? { from: best.from, to: best.to } : null
}

/** 로컬 달력일 기준, status 필드가 바뀐 감사 행마다 from→to (from≠to), 시간순 */
export function listAllReservationStatusTransitionsOnLocalDay(
  rows: ReservationStatusAuditRow[],
  dateKey: string
): { from: string; to: string }[] {
  const out: { from: string; to: string; t: number }[] = []
  for (const row of rows) {
    if (isoToLocalCalendarDateKey(row.created_at) !== dateKey) continue
    if (!Array.isArray(row.changed_fields) || !row.changed_fields.includes('status')) continue
    const to = statusFromReservationAuditJson(row.new_values)
    const fromRaw = statusFromReservationAuditJson(row.old_values)
    const from = fromRaw ?? ''
    if (to && from !== to) {
      out.push({ from: fromRaw ?? '', to, t: new Date(row.created_at).getTime() })
    }
  }
  out.sort((a, b) => a.t - b.t)
  return out.map(({ from, to }) => ({ from, to }))
}

/** 그날 감사 기준으로 취소·삭제 상태로 바뀐 전환만 (이미 취소인 건의 금액 수정 등 제외) */
export function isIntoCancelledLikeTransition(tr: { from: string; to: string } | null | undefined): boolean {
  if (!tr) return false
  const to = tr.to.toLowerCase()
  const from = tr.from.toLowerCase()
  const toTerm = to === 'cancelled' || to === 'canceled' || to === 'deleted'
  const fromTerm = from === 'cancelled' || from === 'canceled' || from === 'deleted'
  return toTerm && !fromTerm
}

/** 예약별: 로컬 YMD 목록 중 그날 감사상 상태가 취소/삭제로 바뀐 날만 */
export function localYmdSetWhereBecameCancelledFromAuditRows(
  rows: ReservationStatusAuditRow[] | undefined
): Set<string> {
  const out = new Set<string>()
  if (!rows?.length) return out
  const dayKeys = new Set<string>()
  for (const row of rows) {
    if (!Array.isArray(row.changed_fields) || !row.changed_fields.includes('status')) continue
    const dk = isoToLocalCalendarDateKey(row.created_at)
    if (dk && dk.length >= 10) dayKeys.add(dk)
  }
  for (const dk of dayKeys) {
    const tr = pickReservationStatusTransitionForDay(rows, dk)
    if (isIntoCancelledLikeTransition(tr)) out.add(dk)
  }
  return out
}

const STATUS_TRANSITION_SORT_ORDER = new Map<string, number>([
  ['recruiting:confirmed', 10],
  ['recruiting:cancelled', 20],
  ['recruiting:canceled', 21],
  ['inquiry:pending', 25],
  ['inquiry:confirmed', 26],
  ['pending:confirmed', 30],
  ['pending:cancelled', 40],
  ['pending:canceled', 41],
  ['confirmed:cancelled', 50],
  ['confirmed:canceled', 51],
  ['confirmed:completed', 60],
  ['pending:completed', 65],
  ['inquiry:cancelled', 68],
  ['inquiry:canceled', 69],
])

export function statusTransitionSortIndex(from: string, to: string): number {
  return STATUS_TRANSITION_SORT_ORDER.get(`${from.toLowerCase()}:${to.toLowerCase()}`) ?? 1000
}
