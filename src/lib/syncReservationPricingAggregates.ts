/**
 * reservation_options 합계 → reservation_pricing.option_total
 * payment_records 집계 → reservation_pricing.deposit_amount(입금 보증 버킷 합), balance_amount
 * (Balance 테이블·reservationPricingBalance.ts 와 동일한 라인 총액·입금 집계 규칙)
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  computeCustomerPaymentTotalLineFormula,
  summarizePaymentRecordsForBalance,
  type PaymentRecordLike,
  type PartySizeSource,
} from '@/utils/reservationPricingBalance'

function roundUsd2(n: number): number {
  return Math.round(n * 100) / 100
}

function isOptionRowExcluded(status: string | null | undefined): boolean {
  const s = (status || 'active').toLowerCase()
  return s === 'cancelled' || s === 'refunded'
}

export type ReservationOptionSumRow = {
  reservation_id: string
  total_price?: unknown
  price?: unknown
  ea?: unknown
  status?: string | null
}

/**
 * `reservation_options` 행 배치 → 예약별 선택옵션 합계 (sync 와 동일 규칙: 취소·환불 제외, total_price 우선)
 */
export function aggregateReservationOptionSumsByReservationId(
  rows: ReservationOptionSumRow[] | null | undefined
): Map<string, number> {
  const raw = new Map<string, number>()
  for (const r of rows || []) {
    if (isOptionRowExcluded(r.status as string)) continue
    const rid = r.reservation_id
    let add = 0
    const rawTp = r.total_price
    if (rawTp != null && rawTp !== '') {
      const tp = Number(rawTp)
      if (!Number.isNaN(tp)) add = tp
    } else {
      add = (Number(r.ea) || 0) * (Number(r.price) || 0)
    }
    if (Number.isNaN(add)) continue
    raw.set(rid, (raw.get(rid) || 0) + add)
  }
  const sums = new Map<string, number>()
  for (const [rid, v] of raw) {
    sums.set(rid, roundUsd2(v))
  }
  return sums
}

/**
 * 예약 단위로 pricing 캐시 컬럼 동기화. reservation_pricing 행이 없으면 스킵.
 */
export async function syncReservationPricingAggregates(
  supabase: SupabaseClient,
  reservationId: string
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  try {
    const { data: res, error: resErr } = await supabase
      .from('reservations')
      .select('adults, child, infant, status')
      .eq('id', reservationId)
      .maybeSingle()

    if (resErr) {
      return { ok: false, error: resErr.message }
    }
    if (!res) {
      return { ok: true, skipped: true }
    }

    const { data: pricing, error: pErr } = await supabase
      .from('reservation_pricing')
      .select('*')
      .eq('reservation_id', reservationId)
      .maybeSingle()

    if (pErr) {
      return { ok: false, error: pErr.message }
    }
    if (!pricing?.id) {
      return { ok: true, skipped: true }
    }

    const { data: optionRows } = await supabase
      .from('reservation_options')
      .select('total_price, price, ea, status')
      .eq('reservation_id', reservationId)

    const optionSums = aggregateReservationOptionSumsByReservationId(
      (optionRows || []).map((r) => ({ ...r, reservation_id: reservationId }))
    )
    const optionSum = optionSums.get(reservationId) ?? 0

    const { data: payRows } = await supabase
      .from('payment_records')
      .select('payment_status, amount')
      .eq('reservation_id', reservationId)

    const records: PaymentRecordLike[] = (payRows || []).map((r) => ({
      payment_status: String(r.payment_status || ''),
      amount: Number(r.amount) || 0,
    }))

    const party: PartySizeSource = {
      adults: res.adults ?? 0,
      child: res.child ?? 0,
      infant: res.infant ?? 0,
    }

    const pricingMerged = { ...pricing, option_total: optionSum }
    const statusLower = String(res.status || '').toLowerCase().trim()
    const isCancelled = statusLower === 'cancelled' || statusLower === 'canceled'

    let deposit_amount: number
    let balance_amount: number

    if (isCancelled) {
      const { depositBucketGross } = summarizePaymentRecordsForBalance(records)
      deposit_amount = depositBucketGross
      balance_amount = 0
    } else {
      const lineGross = computeCustomerPaymentTotalLineFormula(pricingMerged as Parameters<typeof computeCustomerPaymentTotalLineFormula>[0], party)
      const { depositTotalNet, depositBucketGross, balanceReceivedTotal, returnedTotal } =
        summarizePaymentRecordsForBalance(records)
      const customerNet = Math.max(0, roundUsd2(lineGross - returnedTotal))
      balance_amount = roundUsd2(customerNet - depositTotalNet - balanceReceivedTotal)
      deposit_amount = depositBucketGross
    }

    const { error: upErr } = await supabase
      .from('reservation_pricing')
      .update({
        option_total: optionSum,
        deposit_amount,
        balance_amount,
      })
      .eq('id', pricing.id)

    if (upErr) {
      return { ok: false, error: upErr.message }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
