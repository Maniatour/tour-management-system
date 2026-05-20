import { browserLocalWeekRangeFromOffset } from '@/lib/browserLocalWeek'
import { isoToLocalCalendarDateKey } from '@/utils/reservationUtils'

export type ReservationStatusAuditRow = {
  record_id: string
  created_at: string
  changed_fields: string[] | null
  old_values: unknown
  new_values: unknown
}

/** PostgREST `.contains(changed_fields, ['status'])` → `cs.{status}` 로 500이 나는 환경이 있어, 조회 후 클라이언트에서만 사용한다. */
export function reservationAuditRowHasStatusFieldChange(
  row: Pick<ReservationStatusAuditRow, 'changed_fields'>
): boolean {
  return Array.isArray(row.changed_fields) && row.changed_fields.includes('status')
}

/** `reservation_status_events` 한 행을 기존 감사 기반 헬퍼와 호환되는 형태로 변환 */
export function reservationStatusEventRowToAuditRow(row: {
  reservation_id: string
  occurred_at: string
  from_status: string | null
  to_status: string | null
}): ReservationStatusAuditRow {
  return {
    record_id: row.reservation_id,
    created_at: row.occurred_at,
    changed_fields: ['status'],
    old_values: { status: row.from_status },
    new_values: { status: row.to_status },
  }
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
 * 예약 목록(심플 카드) 「상태 변경」에 노출할 전환.
 * `reservation_status_events.occurred_at`의 로컬 달력일로 묶는다(브라우저 TZ = 등록·수정일 그룹과 동일).
 */
export function isSimpleCardListedReservationStatusTransition(tr: {
  from: string
  to: string
}): boolean {
  const from = tr.from.toLowerCase().trim()
  const to = tr.to.toLowerCase().trim()
  if (from === to) return false
  if (from === 'pending' && to === 'confirmed') return true
  if (from === 'inquiry' && (to === 'pending' || to === 'confirmed')) return true
  if (from === 'recruiting' && (to === 'pending' || to === 'confirmed')) return true
  if (
    (from === 'pending' || from === 'confirmed' || from === 'inquiry' || from === 'recruiting') &&
    isCancelledLikeReservationStatus(to)
  ) {
    return true
  }
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

export type SimpleCardStatusChangeAuditRequest = {
  rangeStart: string
  rangeEnd: string
  targets: { key: string; reservationId: string; dateKey: string }[]
  uniqueIds: string[]
}

/** 필터·목록이 바뀌었는지 감사 캐시와 대조할 때 사용 */
export function reservationIdsSignature(ids: Iterable<string | null | undefined>): string {
  return [...new Set([...ids].map((x) => String(x ?? '').trim()).filter(Boolean))].sort().join('\0')
}

/** 당일 등록 직후에도 수정이 한 번이라도 더 있으면 true (등록 시각과 동일한 updated_at은 false) */
export function isReservationUpdatedStrictlyAfterAdded(r: {
  addedTime?: string | null
  updated_at?: string | null
}): boolean {
  const a = r.addedTime?.trim() ? new Date(r.addedTime).getTime() : NaN
  const u = r.updated_at?.trim() ? new Date(r.updated_at).getTime() : NaN
  return Number.isFinite(a) && Number.isFinite(u) && u > a
}

/** 날짜 그룹·심플 카드 감사 대상과 동일: 등록일·수정일·(선택) 상태 이벤트 로컬일 */
export function collectReservationActivityDateKeys(
  r: { addedTime?: string | null; updated_at?: string | null },
  auditRows?: ReservationStatusAuditRow[]
): string[] {
  const activityDates = new Set<string>()
  const createdKey = isoToLocalCalendarDateKey(r.addedTime)
  const updatedKey = isoToLocalCalendarDateKey(r.updated_at ?? null)
  if (createdKey) activityDates.add(createdKey)
  if (updatedKey) activityDates.add(updatedKey)
  if (auditRows?.length) {
    for (const row of auditRows) {
      const dk = isoToLocalCalendarDateKey(row.created_at)
      if (dk) activityDates.add(dk)
    }
  }
  return [...activityDates]
}

/**
 * 심플 카드 「상태 변경」에 해당 날짜를 조회·표시할지.
 * `updated_at`만 보면 이벤트(occurred_at) 일자와 어긋나는 경우가 있다.
 */
export function shouldIncludeSimpleCardStatusChangeTargetDate(
  r: { addedTime?: string | null; updated_at?: string | null },
  dateKey: string,
  auditRows?: ReservationStatusAuditRow[]
): boolean {
  const createdKey = isoToLocalCalendarDateKey(r.addedTime)
  const updatedKey = isoToLocalCalendarDateKey(r.updated_at ?? null)
  if (
    dateKey === updatedKey &&
    (createdKey !== dateKey || isReservationUpdatedStrictlyAfterAdded(r))
  ) {
    return true
  }
  if (dateKey !== createdKey && dateKey !== updatedKey) {
    return true
  }
  if (auditRows?.length) {
    for (const row of auditRows) {
      if (isoToLocalCalendarDateKey(row.created_at) !== dateKey) continue
      if (!reservationAuditRowHasStatusFieldChange(row)) continue
      const to = statusFromReservationAuditJson(row.new_values)
      const from = statusFromReservationAuditJson(row.old_values)
      if (to && from && from !== to && isSimpleCardListedReservationStatusTransition({ from, to })) {
        return true
      }
    }
  }
  return false
}

/**
 * 필터된 목록 + (선택) 이미 로드된 상태 이벤트로 심플 카드 상태변경 감사 요청을 만든다.
 * `groupedReservations`의 활동일 집합과 맞춘다.
 */
export function buildSimpleCardStatusChangeAuditRequestFromFiltered(
  filteredReservations: Array<{ id?: string | null; addedTime?: string | null; updated_at?: string | null }>,
  cardsWeekPage: number,
  auditRowsByRecordId?: Record<string, ReservationStatusAuditRow[]>
): SimpleCardStatusChangeAuditRequest {
  const { startYmd, endYmd, rangeStartIso, rangeEndIso } = browserLocalWeekRangeFromOffset(cardsWeekPage)
  const targets: { key: string; reservationId: string; dateKey: string }[] = []
  const uniqueIdSet = new Set<string>()

  for (const r of filteredReservations) {
    const reservationId = String(r.id ?? '').trim()
    if (!reservationId) continue
    const auditRows = auditRowsByRecordId?.[reservationId]
    const activityDates = collectReservationActivityDateKeys(r, auditRows)

    for (const dateKey of activityDates) {
      if (dateKey < startYmd || dateKey > endYmd) continue
      if (!shouldIncludeSimpleCardStatusChangeTargetDate(r, dateKey, auditRows)) continue
      targets.push({ key: `${reservationId}|${dateKey}`, reservationId, dateKey })
      uniqueIdSet.add(reservationId)
    }
  }

  return {
    rangeStart: rangeStartIso,
    rangeEnd: rangeEndIso,
    targets,
    uniqueIds: [...uniqueIdSet],
  }
}

/**
 * 등록·취소 차트 등에서 이미 불러온 감사 행으로 심플 카드 「상태 변경」전환 맵을 만든다.
 * 키는 `${reservationId}|${occurred_at 로컬 YMD}` — `updated_at` 그룹일과 어긋나도 이벤트 일자에 표시.
 */
export function buildSimpleCardStatusTransitionMapFromCachedAuditRows(
  req: SimpleCardStatusChangeAuditRequest,
  rowsByReservationId: Record<string, ReservationStatusAuditRow[]>
): Record<string, { from: string; to: string }> {
  const next: Record<string, { from: string; to: string }> = {}
  for (const id of req.uniqueIds) {
    const rows = rowsByReservationId[id]
    if (!rows?.length) continue
    const bestByDay = new Map<string, { from: string; to: string; t: number }>()
    for (const row of rows) {
      const at = row.created_at
      if (at < req.rangeStart || at > req.rangeEnd) continue
      if (!reservationAuditRowHasStatusFieldChange(row)) continue
      const to = statusFromReservationAuditJson(row.new_values)
      const from = statusFromReservationAuditJson(row.old_values)
      if (!to || !from || from === to) continue
      if (!isSimpleCardListedReservationStatusTransition({ from, to })) continue
      const dateKey = isoToLocalCalendarDateKey(row.created_at)
      if (!dateKey) continue
      const ts = new Date(row.created_at).getTime()
      const prev = bestByDay.get(dateKey)
      if (!prev || ts > prev.t) bestByDay.set(dateKey, { from, to, t: ts })
    }
    for (const [dateKey, v] of bestByDay) {
      next[`${id}|${dateKey}`] = { from: v.from, to: v.to }
    }
  }
  return next
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
  ['recruiting:pending', 8],
  ['recruiting:confirmed', 10],
  ['recruiting:cancelled', 20],
  ['recruiting:canceled', 21],
  ['inquiry:pending', 25],
  ['inquiry:confirmed', 26],
  ['inquiry:cancelled', 28],
  ['inquiry:canceled', 29],
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
