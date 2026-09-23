import { supabase } from '@/lib/supabase'
import { fetchReservationOptionLinesBatch } from '@/lib/reservationOptionsForEmail'
import { reservationExcludedFromTourBatchPrint } from '@/utils/tourUtils'
import {
  adjustOptionTotalExcludingLegacyNonResident,
  getBalanceAmountForDisplay,
  paymentRecordAmountToNumber,
  resolveResidentFeeUsdForBalanceDisplay,
  withNormalizedBalanceAmountForDisplay,
} from '@/utils/reservationPricingBalance'
import { countResidentLinesFromCustomers } from '@/utils/balanceEnvelopeBreakdown'
import {
  residentFeeAmountsFromPricingChoicesJson,
  residentFeeCountsFromPricingChoicesJson,
} from '@/utils/usResidentChoiceSync'
import { loadResidentStatusAmountsForReservation } from '@/lib/saveResidentStatusWithPricing'

export type ReservationBalancePrintRow = {
  reservationId: string
  customerName: string
  balanceAmount: number
  currency: string
  pickupLabel: string
}

type RezRow = {
  id: string
  customer_id?: string | null
  adults?: number | null
  child?: number | null
  infant?: number | null
  status?: string | null
  product_id?: string | null
  pickup_hotel?: string | null
}

async function fetchPricingByReservationIds(
  ids: string[]
): Promise<Map<string, Record<string, unknown> | null>> {
  const pricingByResId = new Map<string, Record<string, unknown> | null>()
  if (ids.length === 0) return pricingByResId

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token?.trim()
  if (token && typeof window !== 'undefined') {
    try {
      const res = await fetch(
        `/api/reservation-pricing?reservation_ids=${encodeURIComponent(ids.join(','))}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.ok) {
        const json = (await res.json()) as {
          items?: Array<{ reservation_id: string; pricing: Record<string, unknown> | null }>
        }
        if (Array.isArray(json.items)) {
          for (const { reservation_id, pricing } of json.items) {
            pricingByResId.set(reservation_id, pricing && typeof pricing === 'object' ? pricing : null)
          }
        }
      }
    } catch (e) {
      console.warn('[loadReservationBalanceRows] reservation-pricing API', e)
    }
  }

  const missing = ids.filter((id) => !pricingByResId.has(id))
  if (missing.length > 0) {
    const { data: pricingList } = await supabase
      .from('reservation_pricing')
      .select('*')
      .in('reservation_id', missing)
    for (const row of pricingList || []) {
      const rid = (row as { reservation_id?: string }).reservation_id
      if (rid) pricingByResId.set(rid, row as Record<string, unknown>)
    }
  }
  for (const id of ids) {
    if (!pricingByResId.has(id)) pricingByResId.set(id, null)
  }
  return pricingByResId
}

/** Balance 봉투와 같은 잔액. 취소·삭제 예약은 빼니다. */
export async function loadReservationBalanceRows(
  reservationIds: string[]
): Promise<ReservationBalancePrintRow[]> {
  const ids = [...new Set(reservationIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) return []

  const { data: rezList, error: rezErr } = await supabase
    .from('reservations')
    .select('id, customer_id, adults, child, infant, status, product_id, pickup_hotel')
    .in('id', ids)
  if (rezErr) throw new Error(rezErr.message)

  const active = ((rezList || []) as RezRow[]).filter(
    (row) => !reservationExcludedFromTourBatchPrint(row.status)
  )
  if (active.length === 0) return []

  const activeIds = active.map((row) => row.id)
  const customerIds = [
    ...new Set(active.map((row) => String(row.customer_id || '').trim()).filter(Boolean)),
  ]
  const hotelIds = [
    ...new Set(active.map((row) => String(row.pickup_hotel || '').trim()).filter(Boolean)),
  ]

  const [customersRes, hotelsRes, pricingByResId, optionLinesByResId, payResult, rcResult] =
    await Promise.all([
      customerIds.length
        ? supabase.from('customers').select('id, name').in('id', customerIds)
        : Promise.resolve({ data: [], error: null }),
      hotelIds.length
        ? supabase.from('pickup_hotels').select('id, hotel').in('id', hotelIds)
        : Promise.resolve({ data: [], error: null }),
      fetchPricingByReservationIds(activeIds),
      fetchReservationOptionLinesBatch(supabase, activeIds),
      supabase.from('payment_records').select('reservation_id, amount, payment_status').in('reservation_id', activeIds),
      supabase
        .from('reservation_customers')
        .select('reservation_id, resident_status')
        .in('reservation_id', activeIds),
    ])

  const customerName = new Map<string, string>()
  for (const row of customersRes.data || []) {
    customerName.set(row.id, row.name || '')
  }
  const hotelName = new Map<string, string>()
  for (const row of hotelsRes.data || []) {
    hotelName.set(row.id, row.hotel || '')
  }

  const optionsTotalByResId = new Map<string, number | null>()
  for (const id of activeIds) {
    const lines = optionLinesByResId.get(id) || []
    optionsTotalByResId.set(
      id,
      lines.length ? lines.reduce((sum, line) => sum + (Number(line.lineTotal) || 0), 0) : null
    )
  }

  const residentsByResId = new Map<string, Array<{ resident_status?: string | null }>>()
  for (const row of (rcResult.data || []) as Array<{
    reservation_id: string
    resident_status?: string | null
  }>) {
    const list = residentsByResId.get(row.reservation_id) || []
    list.push({ resident_status: row.resident_status ?? null })
    residentsByResId.set(row.reservation_id, list)
  }

  const paymentsByResId = new Map<string, Array<{ payment_status: string; amount: number }>>()
  for (const row of (payResult.data || []) as Array<{
    reservation_id: string
    amount?: unknown
    payment_status?: string | null
  }>) {
    const list = paymentsByResId.get(row.reservation_id) || []
    list.push({
      payment_status: row.payment_status || '',
      amount: paymentRecordAmountToNumber(row.amount),
    })
    paymentsByResId.set(row.reservation_id, list)
  }

  const residentAmountsByResId = new Map<string, Partial<Record<string, number>>>()
  await Promise.all(
    active.map(async (rez) => {
      if (!rez.product_id) return
      try {
        const amounts = await loadResidentStatusAmountsForReservation(supabase, rez.id, String(rez.product_id))
        residentAmountsByResId.set(rez.id, amounts)
      } catch {
        /* 상품 거주자 단가가 없으면 choices JSON으로 계산 */
      }
    })
  )

  return active.map((rez) => {
    const pricingRaw = pricingByResId.get(rez.id) ?? null
    const pricing = pricingRaw ? withNormalizedBalanceAmountForDisplay(pricingRaw) : null
    const optionsSumRaw = optionsTotalByResId.get(rez.id) ?? null
    const choicesJson =
      pricing && typeof (pricing as { choices?: unknown }).choices !== 'undefined'
        ? (pricing as { choices?: unknown }).choices
        : null
    const fromCustomers = countResidentLinesFromCustomers(residentsByResId.get(rez.id))
    const fromChoices = residentFeeCountsFromPricingChoicesJson(choicesJson)
    const residentCounts = { ...fromChoices }
    for (const [key, value] of Object.entries(fromCustomers)) {
      const typed = key as keyof typeof residentCounts
      residentCounts[typed] = Math.max(Number(residentCounts[typed]) || 0, Number(value) || 0)
    }
    const fromChoicesAmounts = residentFeeAmountsFromPricingChoicesJson(choicesJson)
    const residentStatusAmounts: Record<string, number> = {
      ...fromChoicesAmounts,
      ...(residentAmountsByResId.get(rez.id) || {}),
    }
    for (const [key, value] of Object.entries(fromChoicesAmounts)) {
      const current = Number(residentStatusAmounts[key]) || 0
      const alt = Number(value) || 0
      if (alt > current) residentStatusAmounts[key] = alt
    }
    const pricingAdultsRaw = (pricing as { pricing_adults?: unknown } | null)?.pricing_adults
    const hasPricingAdults =
      pricingAdultsRaw !== undefined &&
      pricingAdultsRaw !== null &&
      pricingAdultsRaw !== '' &&
      Number.isFinite(Number(pricingAdultsRaw)) &&
      Math.floor(Number(pricingAdultsRaw)) >= 0
    const party = {
      adults: hasPricingAdults ? Math.floor(Number(pricingAdultsRaw)) : (rez.adults ?? null),
      child: rez.child ?? null,
      infant: rez.infant ?? null,
      children: rez.child ?? null,
      infants: rez.infant ?? null,
    }
    const residentFeeUsd = resolveResidentFeeUsdForBalanceDisplay(
      pricing as Parameters<typeof resolveResidentFeeUsdForBalanceDisplay>[0],
      party,
      optionsSumRaw,
      residentCounts,
      residentStatusAmounts
    )
    const optionRows = (optionLinesByResId.get(rez.id) || []).map((line) => ({
      option_id: line.optionId,
      total_price: line.lineTotal,
      status: 'active',
    }))
    const optionsSum =
      optionsSumRaw === null
        ? null
        : adjustOptionTotalExcludingLegacyNonResident(optionsSumRaw, residentFeeUsd, optionRows)
    const balanceAmount = getBalanceAmountForDisplay(pricing, optionsSum, party, {
      paymentRecords: paymentsByResId.get(rez.id) ?? [],
      reservationStatus: rez.status ?? null,
      residentFeeUsd,
    })
    const currency =
      pricing && typeof (pricing as { currency?: unknown }).currency === 'string'
        ? (pricing as { currency: string }).currency || 'USD'
        : 'USD'
    const hotelId = String(rez.pickup_hotel || '').trim()
    return {
      reservationId: rez.id,
      customerName: customerName.get(String(rez.customer_id || '')) || 'Guest',
      balanceAmount,
      currency: currency || 'USD',
      pickupLabel: hotelName.get(hotelId) || '',
    }
  })
}
