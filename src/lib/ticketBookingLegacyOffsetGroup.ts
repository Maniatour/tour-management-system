import { normalizeTicketBookingStatusFromDb } from '@/lib/ticketBookingStatus'
import { isTicketBookingOffsetOrCancelRow } from '@/lib/ticketBookingSoftDelete'

export type TicketBookingRnGroupRow = {
  id: string
  ea?: number | null
  rn_number?: string | null
  deletion_requested_at?: string | null
  status?: string | null
  booking_status?: string | null
}

function activeRows<T extends TicketBookingRnGroupRow>(rows: readonly T[]): T[] {
  return rows.filter((r) => !r.deletion_requested_at)
}

/**
 * 예전 방식: 동일 RN#에 +N / -N(또는 취소) 행이 있고 수량 합이 0인 그룹.
 */
export function isTicketBookingLegacyOffsetRnGroup(rows: readonly TicketBookingRnGroupRow[]): boolean {
  const active = activeRows(rows)
  if (active.length < 2) return false

  const sumEa = active.reduce((s, r) => s + (Number(r.ea) || 0), 0)
  if (sumEa !== 0) return false

  const hasPositive = active.some((r) => (r.ea ?? 0) > 0)
  const hasOffsetLike = active.some(
    (r) => (r.ea ?? 0) < 0 || isTicketBookingOffsetOrCancelRow(r)
  )

  return hasPositive && hasOffsetLike
}

/** 본 행: 양수 수량이 있으면 그 중 첫 번째, 없으면 활성 행 첫 번째 */
export function pickPrimaryRowForLegacyOffsetMerge<T extends TicketBookingRnGroupRow>(
  rows: readonly T[]
): T | null {
  const active = activeRows(rows)
  if (active.length === 0) return null
  const positive = active.find((r) => (r.ea ?? 0) > 0)
  return positive ?? active[0]!
}

export function legacyOffsetRowIdsToSoftDelete(
  rows: readonly TicketBookingRnGroupRow[],
  primaryId: string
): string[] {
  return activeRows(rows)
    .filter((r) => r.id !== primaryId)
    .map((r) => r.id)
}

/** 예약(부킹) 축 또는 레거시 status 기준 확정 여부 */
export function isTicketBookingRowBookingConfirmed(row: TicketBookingRnGroupRow): boolean {
  const axis = String(row.booking_status ?? '').trim().toLowerCase()
  if (axis) return axis === 'confirmed'
  const legacy = String(normalizeTicketBookingStatusFromDb(row.status)).toLowerCase()
  return legacy === 'confirmed'
}

/** 소프트 삭제(삭제 요청) 후보 id — `excludeConfirmed`·`onlyIds` 로 범위 제한 */
export function ticketBookingRnGroupSoftDeleteCandidateIds(
  rows: readonly TicketBookingRnGroupRow[],
  opts?: { excludeConfirmed?: boolean; onlyIds?: ReadonlySet<string> }
): string[] {
  return activeRows(rows)
    .filter((r) => {
      if (opts?.onlyIds && !opts.onlyIds.has(r.id)) return false
      if (opts?.excludeConfirmed && isTicketBookingRowBookingConfirmed(r)) return false
      return true
    })
    .map((r) => r.id)
}

/** RN#별 그룹 키 — `buildTicketRnGroups` 와 동일 규칙 */
export function ticketBookingRnGroupKey(row: {
  id: string
  rn_number?: string | null
}): string {
  const trimmed = row.rn_number?.trim()
  return trimmed ? trimmed : `__empty_rn__:${row.id}`
}

function isSharedRnGroupKey(key: string): boolean {
  return !key.startsWith('__empty_rn__:')
}

/** 동일 RN#(비어 있지 않음)에 행이 2건 이상인 그룹 수 */
export function countTicketBookingMultiRnGroups(
  rows: readonly { id: string; rn_number?: string | null }[]
): number {
  const counts = new Map<string, number>()
  for (const b of rows) {
    const k = ticketBookingRnGroupKey(b)
    if (!isSharedRnGroupKey(k)) continue
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  let n = 0
  for (const c of counts.values()) {
    if (c >= 2) n += 1
  }
  return n
}

/** 동일 RN#에 2건 이상인 그룹에 속한 부킹 id */
export function ticketBookingIdsInMultiRnGroups(
  rows: readonly { id: string; rn_number?: string | null }[]
): Set<string> {
  const byKey = new Map<string, string[]>()
  for (const b of rows) {
    const k = ticketBookingRnGroupKey(b)
    if (!isSharedRnGroupKey(k)) continue
    const list = byKey.get(k) ?? []
    list.push(b.id)
    byKey.set(k, list)
  }
  const ids = new Set<string>()
  for (const idList of byKey.values()) {
    if (idList.length >= 2) {
      for (const id of idList) ids.add(id)
    }
  }
  return ids
}
