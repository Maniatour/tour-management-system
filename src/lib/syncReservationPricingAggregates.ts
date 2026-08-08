/**
 * reservation_options 합계 → reservation_pricing.option_total
 * 옵션 변경 시 subtotal·total_price(가격 정보 모달·라인 산식과 동일)
 * payment_records 집계 → reservation_pricing.deposit_amount(입금 보증 버킷 합), balance_amount
 * (Balance 테이블·reservationPricingBalance.ts 와 동일한 라인 총액·입금 집계 규칙)
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  computeCustomerPaymentTotalLineFormula,
  customerTotalDueForBalanceSettlement,
  depositNetForBalanceSettlement,
  inferResidentFeesUsdForBalance,
  pricingFieldToNumber,
  residentFeesUsdFromCustomerRows,
  summarizePaymentRecordsForBalance,
  type PaymentRecordLike,
  type PartySizeSource,
} from '@/utils/reservationPricingBalance'
import type { ReservationPricingMapValue } from '@/types/reservationPricingMap'
import type { Reservation } from '@/types/reservation'
import { computeReservationPricingStoredRevenueColumns } from '@/utils/balanceChannelRevenue'

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

export type ReservationExpenseSumRow = {
  reservation_id: string | null
  amount?: unknown
  status?: string | null
}

/** `reservation_expenses` 행 배치 → 예약별 합계 (rejected 제외) */
export function aggregateReservationExpenseSumsByReservationId(
  rows: ReservationExpenseSumRow[] | null | undefined
): Map<string, number> {
  const raw = new Map<string, number>()
  for (const r of rows || []) {
    const status = String(r.status ?? '').toLowerCase().trim()
    if (status === 'rejected') continue
    const rid = r.reservation_id
    if (!rid) continue
    const add = Number(r.amount) || 0
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
      .select('adults, child, infant, status, channel_id')
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

    const { data: residentCustomerRows } = await supabase
      .from('reservation_customers')
      .select('resident_status')
      .eq('reservation_id', reservationId)

    const { data: expenseRows } = await supabase
      .from('reservation_expenses')
      .select('amount, status')
      .eq('reservation_id', reservationId)
      .not('status', 'eq', 'rejected')
    const reservationExpensesTotal = roundUsd2(
      (expenseRows || []).reduce(
        (sum: number, e: { amount: number | null }) => sum + (Number(e.amount) || 0),
        0
      )
    )

    const records: PaymentRecordLike[] = (payRows || []).map((r) => ({
      payment_status: String(r.payment_status || ''),
      amount: Number(r.amount) || 0,
    }))

    const pricingAdultsRaw = (pricing as { pricing_adults?: number | null }).pricing_adults
    const hasPricingAdults =
      pricingAdultsRaw !== null &&
      pricingAdultsRaw !== undefined &&
      Number.isFinite(Number(pricingAdultsRaw))
    const party: PartySizeSource = {
      adults: hasPricingAdults
        ? Math.max(0, Math.floor(Number(pricingAdultsRaw)))
        : (res.adults ?? 0),
      child: res.child ?? 0,
      infant: res.infant ?? 0,
    }

    const pricingMerged = { ...pricing, option_total: optionSum }
    const statusLower = String(res.status || '').toLowerCase().trim()
    const isCancelled = statusLower === 'cancelled' || statusLower === 'canceled'

    const lineGrossBase = computeCustomerPaymentTotalLineFormula(
      pricingMerged as Parameters<typeof computeCustomerPaymentTotalLineFormula>[0],
      party
    )
    const residentFeeUsd = Math.max(
      residentFeesUsdFromCustomerRows(residentCustomerRows ?? []),
      inferResidentFeesUsdForBalance(pricingMerged, lineGrossBase)
    )
    const lineGross = roundUsd2(lineGrossBase + residentFeeUsd)

    let deposit_amount: number
    let balance_amount: number

    if (isCancelled) {
      const { depositBucketGross } = summarizePaymentRecordsForBalance(records)
      deposit_amount = depositBucketGross
      balance_amount = 0
    } else {
      const { depositTotalNet, depositBucketGross, balanceReceivedTotal, returnedTotal } =
        summarizePaymentRecordsForBalance(records)
      const dueForBalance = customerTotalDueForBalanceSettlement(
        pricingMerged as Parameters<typeof customerTotalDueForBalanceSettlement>[0],
        party,
        residentFeeUsd
      )
      const customerNet = Math.max(0, roundUsd2(dueForBalance - returnedTotal))
      balance_amount = roundUsd2(
        customerNet -
          depositNetForBalanceSettlement(depositTotalNet, pricingMerged.prepayment_tip) -
          balanceReceivedTotal
      )
      deposit_amount = depositBucketGross
    }

    let channels: Array<{
      id: string
      name?: string | null
      type?: string | null
      category?: string | null
      sub_channels?: string[] | null
      commission_percent?: number | null
      commission_rate?: number | null
      commission?: number | null
    }> = []
    const cid = String((res as { channel_id?: string | null }).channel_id ?? '').trim()
    if (cid) {
      const { data: chRow } = await supabase
        .from('channels')
        .select('id, name, type, category, sub_channels, commission_percent, commission_rate, commission')
        .eq('id', cid)
        .maybeSingle()
      if (chRow) channels = [chRow as (typeof channels)[0]]
    }

    const reservationLike = {
      id: reservationId,
      channelId: cid,
      adults: hasPricingAdults
        ? Math.max(0, Math.floor(Number(pricingAdultsRaw)))
        : (res.adults ?? 0),
      child: res.child ?? 0,
      infant: res.infant ?? 0,
      status: res.status as Reservation['status'],
    } as Reservation

    const reservationOptionRows = (optionRows || []).map((r) => ({
      ...r,
      reservation_id: reservationId,
    }))

    const storedCols = computeReservationPricingStoredRevenueColumns(
      pricingMerged as ReservationPricingMapValue,
      reservationLike,
      channels,
      records,
      reservationOptionRows,
      new Map([[reservationId, optionSum]]),
      reservationExpensesTotal
    )

    const subtotal = roundUsd2(
      pricingFieldToNumber(pricingMerged.product_price_total) +
        pricingFieldToNumber(pricingMerged.required_option_total) +
        optionSum
    )
    const total_price = Math.max(0, lineGross)

    const { error: upErr } = await supabase
      .from('reservation_pricing')
      .update({
        option_total: optionSum,
        subtotal,
        total_price,
        deposit_amount,
        balance_amount,
        ...(storedCols
          ? {
              company_total_revenue: storedCols.company_total_revenue,
              operating_profit: storedCols.operating_profit,
            }
          : {}),
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
