/**
 * 기존 reservation_pricing 행에 company_total_revenue, operating_profit 채우기.
 * .env.local 에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요.
 *
 * 실행: npx tsx --tsconfig tsconfig.json scripts/backfill-reservation-pricing-revenue.ts
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import type { Reservation } from '../src/types/reservation'
import type { ReservationPricingMapValue } from '../src/types/reservationPricingMap'
import { computeReservationPricingStoredRevenueColumns } from '../src/utils/balanceChannelRevenue'
import type { PaymentRecordLike } from '../src/utils/reservationPricingBalance'

config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL 및 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.')
  process.exit(1)
}

const supabase = createClient(url, key)

const CHUNK = 150

async function main() {
  let from = 0
  let updated = 0
  let skipped = 0
  for (;;) {
    const { data: rows, error } = await supabase
      .from('reservation_pricing')
      .select('id, reservation_id')
      .order('id', { ascending: true })
      .range(from, from + CHUNK - 1)

    if (error) {
      console.error(error)
      process.exit(1)
    }
    if (!rows?.length) break

    for (const row of rows) {
      const reservationId = String(row.reservation_id ?? '').trim()
      if (!reservationId) {
        skipped++
        continue
      }

      const { data: res } = await supabase
        .from('reservations')
        .select('adults, child, infant, status, channel_id')
        .eq('id', reservationId)
        .maybeSingle()

      if (!res) {
        skipped++
        continue
      }

      const { data: pricing } = await supabase
        .from('reservation_pricing')
        .select('*')
        .eq('reservation_id', reservationId)
        .maybeSingle()

      if (!pricing?.id) {
        skipped++
        continue
      }

      const { data: optionRows } = await supabase
        .from('reservation_options')
        .select('reservation_id, total_price, price, ea, status')
        .eq('reservation_id', reservationId)

      const { data: payRows } = await supabase
        .from('payment_records')
        .select('payment_status, amount')
        .eq('reservation_id', reservationId)

      const records: PaymentRecordLike[] = (payRows || []).map((r) => ({
        payment_status: String(r.payment_status || ''),
        amount: Number(r.amount) || 0,
      }))

      const cid = String((res as { channel_id?: string | null }).channel_id ?? '').trim()
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
        adults: (res as { adults?: number }).adults ?? 0,
        child: (res as { child?: number }).child ?? 0,
        infant: (res as { infant?: number }).infant ?? 0,
        status: (res as { status?: Reservation['status'] }).status ?? 'pending',
      } as Reservation

      const reservationOptionRows = (optionRows || []).map((r) => ({
        ...r,
        reservation_id: reservationId,
      }))

      let optionSum = 0
      for (const r of reservationOptionRows) {
        const st = String(r.status || 'active').toLowerCase()
        if (st === 'cancelled' || st === 'refunded') continue
        const tp = r.total_price
        if (tp != null && tp !== '') {
          optionSum += Number(tp) || 0
        } else {
          optionSum += (Number(r.ea) || 0) * (Number(r.price) || 0)
        }
      }
      optionSum = Math.round(optionSum * 100) / 100

      const pricingMerged = { ...pricing, option_total: optionSum }

      const stored = computeReservationPricingStoredRevenueColumns(
        pricingMerged as unknown as ReservationPricingMapValue,
        reservationLike,
        channels,
        records,
        reservationOptionRows,
        new Map([[reservationId, optionSum]])
      )

      if (!stored) {
        skipped++
        continue
      }

      const { error: upErr } = await supabase
        .from('reservation_pricing')
        .update({
          company_total_revenue: stored.company_total_revenue,
          operating_profit: stored.operating_profit,
        })
        .eq('id', pricing.id)

      if (upErr) {
        console.error('update', reservationId, upErr.message)
        skipped++
      } else {
        updated++
      }
    }

    from += CHUNK
    if (rows.length < CHUNK) break
  }

  console.log(`완료: 갱신 ${updated}건, 스킵 ${skipped}건`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
