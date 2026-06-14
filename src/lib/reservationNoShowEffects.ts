/**
 * 예약 상태 → no_show 전환 시 자동 처리:
 * - 비거주자 비용 옵션(6941b5d0) 취소 + 금액 $0
 * - reservation_pricing 불포함·잔액 0
 */
import { supabase } from './supabase'
import { syncReservationPricingAggregates } from './syncReservationPricingAggregates'

export const NON_RESIDENT_OPTION_ID = '6941b5d0'

function roundUsd2(n: number): number {
  return Math.round(n * 100) / 100
}

function toNum(v: unknown): number {
  return v !== null && v !== undefined && v !== '' ? Number(v) : 0
}

export async function applyNoShowReservationSideEffects(reservationId: string): Promise<void> {
  const rid = String(reservationId ?? '').trim()
  if (!rid) return

  const { data: optRows, error: optErr } = await supabase
    .from('reservation_options')
    .select('id, status')
    .eq('reservation_id', rid)
    .eq('option_id', NON_RESIDENT_OPTION_ID)

  if (optErr) {
    console.error('[no-show] reservation_options 조회 오류:', optErr)
  } else {
    for (const row of optRows || []) {
      const st = String(row.status || 'active').toLowerCase()
      if (st === 'cancelled' || st === 'refunded') continue
      const { error: upErr } = await supabase
        .from('reservation_options')
        .update({
          status: 'cancelled',
          price: 0,
          total_price: 0,
          note: 'No Show',
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
      if (upErr) console.error('[no-show] reservation_options 취소 오류:', upErr)
    }
  }

  const { data: reservation } = await supabase
    .from('reservations')
    .select('adults, child, infant')
    .eq('id', rid)
    .maybeSingle()

  const { data: pricing, error: prErr } = await supabase
    .from('reservation_pricing')
    .select(
      'id, not_included_price, pricing_adults, product_price_total, subtotal, total_price, balance_amount'
    )
    .eq('reservation_id', rid)
    .maybeSingle()

  if (prErr) {
    console.error('[no-show] reservation_pricing 조회 오류:', prErr)
  } else if (pricing?.id) {
    const adults = Math.max(
      0,
      Math.floor(toNum(pricing.pricing_adults ?? (reservation as { adults?: number } | null)?.adults))
    )
    const child = toNum((reservation as { child?: number } | null)?.child)
    const infant = toNum((reservation as { infant?: number } | null)?.infant)
    const billingPax = adults + child + infant
    const notIncludedPerPerson = toNum(pricing.not_included_price)
    const notIncludedTotal = notIncludedPerPerson * (billingPax || 1)

    const patch: Record<string, unknown> = {
      balance_amount: 0,
      updated_at: new Date().toISOString(),
    }

    if (notIncludedPerPerson > 0.005 || notIncludedTotal > 0.005) {
      patch.not_included_price = 0
      patch.product_price_total = Math.max(
        0,
        roundUsd2(toNum(pricing.product_price_total) - notIncludedTotal)
      )
      patch.subtotal = Math.max(0, roundUsd2(toNum(pricing.subtotal) - notIncludedTotal))
      patch.total_price = Math.max(0, roundUsd2(toNum(pricing.total_price) - notIncludedTotal))
    }

    const { error: upPrErr } = await supabase
      .from('reservation_pricing')
      .update(patch as any)
      .eq('id', pricing.id)
    if (upPrErr) console.error('[no-show] reservation_pricing 갱신 오류:', upPrErr)
  }

  const sync = await syncReservationPricingAggregates(supabase, rid)
  if (!sync.ok && sync.error) {
    console.warn('[no-show] reservation_pricing 동기화 실패:', rid, sync.error)
  }
}
