import type { ReservationStatusAuditRow } from '@/lib/reservationStatusAudit'
import {
  listAllReservationStatusTransitionsOnLocalDay,
  statusTransitionSortIndex,
} from '@/lib/reservationStatusAudit'

/** UI·집계에서 “신규” 출발을 표시할 때 from 자리 표식 */
export const STATUS_TRANSITION_NEW_FROM_MARKER = '__new__'

export type StatusTransitionTargetKey =
  | 'confirmed'
  | 'inquiry'
  | 'pending'
  | 'completed'
  | 'cancelled'

export type StatusTransitionSubLineAgg = {
  key: string
  displayFrom: string
  displayTo: string
  /** 당일 상태 경로 (시작 상태 + 각 전환 도착). UI에서 `A > B > C` */
  pathStatuses: string[]
  people: number
  bookings: number
  sortIx: number
}

export type StatusTransitionTargetBucketAgg = {
  target: StatusTransitionTargetKey
  lines: StatusTransitionSubLineAgg[]
  totalPeople: number
  totalBookings: number
}

export function isNewLikeStatusFrom(from: string | null | undefined): boolean {
  const f = (from ?? '').toLowerCase().trim()
  return f === '' || f === 'null' || f === 'new' || f === 'draft' || f === 'initial'
}

function isCancelledLikeToStatus(to: string): boolean {
  const t = to.toLowerCase().trim()
  return t === 'cancelled' || t === 'canceled' || t === 'deleted' || t === 'no_show'
}

/** 전환의 “도착” 상태가 어느 버킷 중 어디인지 (그 외는 null) */
export function classifyStatusTransitionTarget(tr: {
  from: string
  to: string
}): StatusTransitionTargetKey | null {
  const to = tr.to.toLowerCase().trim()
  if (isCancelledLikeToStatus(to)) return 'cancelled'
  if (to === 'confirmed') return 'confirmed'
  if (to === 'inquiry') return 'inquiry'
  if (to === 'pending' || to === 'recruiting') return 'pending'
  if (to === 'completed') return 'completed'
  return null
}

function normalizePathStatus(raw: string): string {
  if (isNewLikeStatusFrom(raw)) return STATUS_TRANSITION_NEW_FROM_MARKER
  return raw.trim()
}

/** 연속 중복 상태 제거: A > A > B → A > B */
function compactStatusPath(path: string[]): string[] {
  const out: string[] = []
  for (const s of path) {
    const cur = s.trim()
    if (!cur) continue
    const prev = out[out.length - 1]
    if (prev && prev.toLowerCase() === cur.toLowerCase()) continue
    out.push(cur)
  }
  return out
}

/**
 * 예약 목록 + 감사 행을 날짜 키들에 대해 훑어,
 * 확정·문의·대기·완료·취소 도착 버킷별로 집계한다.
 *
 * 예약·일별로 **최종 도착 상태만** 한 번 세고(중복 방지),
 * 라인에는 당일 전체 경로(대기 > 확정 > 취소)를 남긴다.
 */
export function aggregateStatusTransitionBucketsForReservationWindow(params: {
  reservations: Array<{ id?: string | null }>
  party: (res: unknown) => number
  auditRowsByReservationId: Record<string, ReservationStatusAuditRow[]>
  dayKeys: string[]
  /** 재예약 취소 등 — 취소 버킷에서만 제외(확정·대기 전환은 유지) */
  excludeFromCancelledReservationIds?: ReadonlySet<string>
}): StatusTransitionTargetBucketAgg[] {
  const order: StatusTransitionTargetKey[] = [
    'confirmed',
    'inquiry',
    'pending',
    'completed',
    'cancelled',
  ]
  const maps = new Map<StatusTransitionTargetKey, Map<string, StatusTransitionSubLineAgg>>()
  for (const o of order) maps.set(o, new Map())

  for (const r of params.reservations) {
    const rid = String(r.id ?? '').trim()
    if (!rid) continue
    const rows = params.auditRowsByReservationId[rid]
    if (!rows?.length) continue
    const p = params.party(r)
    for (const ymd of params.dayKeys) {
      const transitions = listAllReservationStatusTransitionsOnLocalDay(rows, ymd)
      if (!transitions.length) continue

      const last = transitions[transitions.length - 1]!
      const bucket = classifyStatusTransitionTarget(last)
      if (!bucket) continue
      if (bucket === 'cancelled' && params.excludeFromCancelledReservationIds?.has(rid)) continue

      const pathStatuses = compactStatusPath([
        normalizePathStatus(transitions[0]!.from),
        ...transitions.map((tr) => normalizePathStatus(tr.to)),
      ])
      if (pathStatuses.length < 2) continue

      const mapKey = pathStatuses.map((s) => s.toLowerCase()).join('\0')
      const displayFrom = pathStatuses[0]!
      const displayTo = pathStatuses[pathStatuses.length - 1]!
      const sortIx = isNewLikeStatusFrom(displayFrom === STATUS_TRANSITION_NEW_FROM_MARKER ? '' : displayFrom)
        ? 5
        : statusTransitionSortIndex(
            displayFrom === STATUS_TRANSITION_NEW_FROM_MARKER ? 'pending' : displayFrom,
            displayTo
          )

      const lineMap = maps.get(bucket)!
      let line = lineMap.get(mapKey)
      if (!line) {
        line = {
          key: mapKey,
          displayFrom,
          displayTo,
          pathStatuses,
          people: 0,
          bookings: 0,
          sortIx,
        }
        lineMap.set(mapKey, line)
      }
      line.people += p
      line.bookings += 1
    }
  }

  return order
    .map((target) => {
      const m = maps.get(target)!
      const lines = [...m.values()].sort((a, b) => {
        if (a.sortIx !== b.sortIx) return a.sortIx - b.sortIx
        const la = a.pathStatuses.join('\0').toLowerCase()
        const lb = b.pathStatuses.join('\0').toLowerCase()
        return la.localeCompare(lb, 'ko')
      })
      const totalPeople = lines.reduce((s, l) => s + l.people, 0)
      const totalBookings = lines.reduce((s, l) => s + l.bookings, 0)
      return { target, lines, totalPeople, totalBookings }
    })
    .filter((b) => b.lines.length > 0)
}
