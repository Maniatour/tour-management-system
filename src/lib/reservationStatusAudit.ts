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
  ['pending:confirmed', 30],
  ['pending:cancelled', 40],
  ['pending:canceled', 41],
  ['confirmed:cancelled', 50],
  ['confirmed:canceled', 51],
  ['confirmed:completed', 60],
  ['pending:completed', 65],
])

export function statusTransitionSortIndex(from: string, to: string): number {
  return STATUS_TRANSITION_SORT_ORDER.get(`${from.toLowerCase()}:${to.toLowerCase()}`) ?? 1000
}
