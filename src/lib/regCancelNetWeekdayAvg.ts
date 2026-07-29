import type { Reservation } from '@/types/reservation'
import { isRebookingReservationByReasonMap } from '@/lib/reservationCancellationReason'
import {
  localYmdSetWhereBecameCancelledFromAuditRows,
  type ReservationStatusAuditRow,
} from '@/lib/reservationStatusAudit'
import { getReservationPartySize, isoToLocalCalendarDateKey } from '@/utils/reservationUtils'
import {
  isReservationCancelledStatus,
  isReservationDeletedStatus,
} from '@/utils/tourUtils'

export type RegCancelChartMetricMode = 'people' | 'bookings'

function regCancelIncrement(
  r: Reservation,
  mode: RegCancelChartMetricMode
): number {
  return mode === 'people'
    ? getReservationPartySize(r as unknown as Record<string, unknown>)
    : 1
}

function localWeekdayIndexFromYmd(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return 0
  return new Date(y, m - 1, d, 12, 0, 0, 0).getDay()
}

function addToDailyMap(map: Map<string, number>, ymd: string, delta: number) {
  if (!ymd || ymd.length < 10) return
  map.set(ymd, (map.get(ymd) ?? 0) + delta)
}

/** 일별 등록·취소 맵 → 요일별 일평균 순예약 (해당 연도만) */
export function computeAvgDailyNetByWeekdayForYears(
  reservations: Reservation[],
  allowedYears: Set<number>,
  args: {
    auditRowsByRecordId?: Record<string, ReservationStatusAuditRow[]> | undefined
    cancellationReasonById?: ReadonlyMap<string, string> | Record<string, string | null | undefined> | null
    useAuditCancel: boolean
    mode?: RegCancelChartMetricMode
  }
): number[] {
  const mode = args.mode ?? 'people'
  const regDaily = new Map<string, number>()
  const cancelDaily = new Map<string, number>()

  for (const r of reservations) {
    const ck = isoToLocalCalendarDateKey(r.addedTime)
    if (!ck || ck.length < 10) continue
    const y = parseInt(ck.slice(0, 4), 10)
    if (!allowedYears.has(y)) continue
    addToDailyMap(regDaily, ck, regCancelIncrement(r, mode))
  }

  if (args.useAuditCancel && args.auditRowsByRecordId) {
    for (const r of reservations) {
      const id = String(r.id ?? '').trim()
      if (!id) continue
      if (isRebookingReservationByReasonMap(id, args.cancellationReasonById)) continue
      const ymds = localYmdSetWhereBecameCancelledFromAuditRows(args.auditRowsByRecordId[id])
      const p = regCancelIncrement(r, mode)
      for (const ymd of ymds) {
        const y = parseInt(ymd.slice(0, 4), 10)
        if (!allowedYears.has(y)) continue
        addToDailyMap(cancelDaily, ymd, p)
      }
    }
  } else {
    for (const r of reservations) {
      const id = String(r.id ?? '').trim()
      if (isRebookingReservationByReasonMap(id, args.cancellationReasonById)) continue
      const uk = isoToLocalCalendarDateKey(r.updated_at ?? null)
      if (!uk || uk.length < 10) continue
      const y = parseInt(uk.slice(0, 4), 10)
      if (!allowedYears.has(y)) continue
      if (!isReservationCancelledStatus(r.status) && !isReservationDeletedStatus(r.status)) continue
      addToDailyMap(cancelDaily, uk, regCancelIncrement(r, mode))
    }
  }

  const netDaily = new Map<string, number>()
  for (const [ymd, v] of regDaily) netDaily.set(ymd, (netDaily.get(ymd) ?? 0) + v)
  for (const [ymd, v] of cancelDaily) netDaily.set(ymd, (netDaily.get(ymd) ?? 0) - v)

  const buckets: number[][] = Array.from({ length: 7 }, () => [])
  for (const [ymd, total] of netDaily) {
    const y = parseInt(ymd.slice(0, 4), 10)
    if (!allowedYears.has(y)) continue
    buckets[localWeekdayIndexFromYmd(ymd)].push(total)
  }
  return buckets.map((arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0))
}

/** 연도 Y: 각 달 m에 대해 (그 달 일별 순예약 합, 미활동일 0) / 말일 수 */
export function computeAvgDailyNetByMonthForCalendarYear(
  reservations: Reservation[],
  year: number,
  args: {
    auditRowsByRecordId?: Record<string, ReservationStatusAuditRow[]> | undefined
    cancellationReasonById?: ReadonlyMap<string, string> | Record<string, string | null | undefined> | null
    useAuditCancel: boolean
    mode?: RegCancelChartMetricMode
  }
): number[] {
  const mode = args.mode ?? 'people'
  const regDaily = new Map<string, number>()
  const cancelDaily = new Map<string, number>()

  for (const r of reservations) {
    const k = isoToLocalCalendarDateKey(r.addedTime)
    if (!k || k.length < 10) continue
    if (parseInt(k.slice(0, 4), 10) !== year) continue
    addToDailyMap(regDaily, k, regCancelIncrement(r, mode))
  }

  if (args.useAuditCancel && args.auditRowsByRecordId) {
    for (const r of reservations) {
      const id = String(r.id ?? '').trim()
      if (!id) continue
      if (isRebookingReservationByReasonMap(id, args.cancellationReasonById)) continue
      const ymds = localYmdSetWhereBecameCancelledFromAuditRows(args.auditRowsByRecordId[id])
      const p = regCancelIncrement(r, mode)
      for (const ymd of ymds) {
        if (parseInt(ymd.slice(0, 4), 10) !== year) continue
        addToDailyMap(cancelDaily, ymd, p)
      }
    }
  } else {
    for (const r of reservations) {
      const id = String(r.id ?? '').trim()
      if (isRebookingReservationByReasonMap(id, args.cancellationReasonById)) continue
      const uk = isoToLocalCalendarDateKey(r.updated_at ?? null)
      if (!uk || uk.length < 10) continue
      if (parseInt(uk.slice(0, 4), 10) !== year) continue
      if (!isReservationCancelledStatus(r.status) && !isReservationDeletedStatus(r.status)) continue
      addToDailyMap(cancelDaily, uk, regCancelIncrement(r, mode))
    }
  }

  const out: number[] = new Array(13).fill(0)
  for (let m = 1; m <= 12; m++) {
    const dim = new Date(year, m, 0).getDate()
    let sum = 0
    for (let d = 1; d <= dim; d++) {
      const ymd = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      sum += (regDaily.get(ymd) ?? 0) - (cancelDaily.get(ymd) ?? 0)
    }
    out[m] = dim > 0 ? sum / dim : 0
  }
  return out
}
