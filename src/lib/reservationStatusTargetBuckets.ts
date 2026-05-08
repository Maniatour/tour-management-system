import type { ReservationStatusAuditRow } from '@/lib/reservationStatusAudit'
import {
  listAllReservationStatusTransitionsOnLocalDay,
  isIntoCancelledLikeTransition,
  statusTransitionSortIndex,
} from '@/lib/reservationStatusAudit'

/** UI·집계에서 “신규” 출발을 표시할 때 from 자리 표식 */
export const STATUS_TRANSITION_NEW_FROM_MARKER = '__new__'

export type StatusTransitionTargetKey = 'confirmed' | 'inquiry' | 'pending' | 'cancelled'

export type StatusTransitionSubLineAgg = {
  key: string
  displayFrom: string
  displayTo: string
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

/** 전환의 “도착” 상태가 확정·대기·취소/삭제 중 어디인지 (그 외는 null) */
export function classifyStatusTransitionTarget(tr: { from: string; to: string }): StatusTransitionTargetKey | null {
  if (isIntoCancelledLikeTransition(tr)) return 'cancelled'
  const to = tr.to.toLowerCase()
  if (to === 'confirmed') return 'confirmed'
  if (to === 'inquiry') return 'inquiry'
  if (to === 'pending') return 'pending'
  return null
}

/**
 * 예약 목록 + 감사 행을 날짜 키들에 대해 훑어,
 * 확정됨 / 대기중 / 취소됨(삭제 포함) 도착 버킷별로 세부 전환(from→to) 인원·건수를 합산한다.
 */
export function aggregateStatusTransitionBucketsForReservationWindow(params: {
  reservations: Array<{ id?: string | null }>
  party: (res: unknown) => number
  auditRowsByReservationId: Record<string, ReservationStatusAuditRow[]>
  dayKeys: string[]
}): StatusTransitionTargetBucketAgg[] {
  const order: StatusTransitionTargetKey[] = ['confirmed', 'inquiry', 'pending', 'cancelled']
  const maps = new Map<StatusTransitionTargetKey, Map<string, StatusTransitionSubLineAgg>>()
  for (const o of order) maps.set(o, new Map())

  for (const r of params.reservations) {
    const rid = String(r.id ?? '').trim()
    if (!rid) continue
    const rows = params.auditRowsByReservationId[rid]
    if (!rows?.length) continue
    const p = params.party(r)
    for (const ymd of params.dayKeys) {
      for (const tr of listAllReservationStatusTransitionsOnLocalDay(rows, ymd)) {
        const bucket = classifyStatusTransitionTarget(tr)
        if (!bucket) continue

        const fromRaw = (tr.from ?? '').trim()
        const toRaw = tr.to.trim()
        const fromLower = fromRaw.toLowerCase()
        const toLower = toRaw.toLowerCase()
        const mapKey = `${fromLower}\0${toLower}`

        const lineMap = maps.get(bucket)!
        let line = lineMap.get(mapKey)
        const displayFrom = isNewLikeStatusFrom(tr.from) ? STATUS_TRANSITION_NEW_FROM_MARKER : tr.from
        const sortIx = isNewLikeStatusFrom(tr.from)
          ? 5
          : statusTransitionSortIndex(fromRaw || 'pending', tr.to)

        if (!line) {
          line = {
            key: mapKey,
            displayFrom,
            displayTo: tr.to,
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
  }

  return order
    .map((target) => {
      const m = maps.get(target)!
      const lines = [...m.values()].sort((a, b) => {
        if (a.sortIx !== b.sortIx) return a.sortIx - b.sortIx
        const la =
          `${a.displayFrom}\0${a.displayTo}`.toLowerCase()
        const lb =
          `${b.displayFrom}\0${b.displayTo}`.toLowerCase()
        return la.localeCompare(lb, 'ko')
      })
      const totalPeople = lines.reduce((s, l) => s + l.people, 0)
      const totalBookings = lines.reduce((s, l) => s + l.bookings, 0)
      return { target, lines, totalPeople, totalBookings }
    })
    .filter((b) => b.lines.length > 0)
}
