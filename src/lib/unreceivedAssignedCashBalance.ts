import { supabase } from '@/lib/supabase'
import { todayInLasVegas } from '@/lib/dailyReport/dateUtils'
import { mapIdsInConcurrentChunks } from '@/lib/fetchSupabaseInChunks'
import { getDefaultLedgerBaseDate } from '@/lib/fiscal-settings'
import { isTourCancelled } from '@/utils/tourStatusUtils'
import {
  isReservationCancelledStatus,
  isReservationDeletedStatus,
  normalizeReservationIds,
} from '@/utils/tourUtils'
import { resolveProductInternalName } from '@/utils/reservationUtils'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import {
  computeAssignedReservationDisplayBalance,
  type AssignedBalanceOptionRow,
  type AssignedBalanceReservationInput,
} from '@/lib/assignedReservationBalance'
import type { PaymentRecordLike } from '@/utils/reservationPricingBalance'

const TOUR_PAGE = 1000
const ID_CHUNK = 150
const ID_CONCURRENCY = 4
const UNRECEIVED_EPS = 0.005

export type UnreceivedAssignedCashTourRow = {
  tourId: string
  tourDate: string
  productName: string
  assignedBalance: number
  unpaidReservationCount: number
}

export type UnreceivedAssignedCashResult = {
  tours: UnreceivedAssignedCashTourRow[]
  totalAmount: number
  asOfDate: string
  fromDate: string
}

type TourQueryRow = {
  id: string
  tour_date: string
  tour_status: string | null
  reservation_ids: unknown
  product_id: string | null
  products:
    | {
        name?: string | null
        name_ko?: string | null
        name_en?: string | null
      }
    | Array<{
        name?: string | null
        name_ko?: string | null
        name_en?: string | null
      }>
    | null
}

function productFromJoin(raw: TourQueryRow['products']): {
  name?: string | null
  name_ko?: string | null
  name_en?: string | null
} | null {
  if (!raw) return null
  if (Array.isArray(raw)) return raw[0] ?? null
  return raw
}

function tourDateKey(value: string): string {
  return value.length >= 10 ? value.slice(0, 10) : value
}

async function fetchAllPastTours(
  operatorId: string,
  fromDate: string,
  beforeDate: string
): Promise<TourQueryRow[]> {
  const out: TourQueryRow[] = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('tours')
      .select('id, tour_date, tour_status, reservation_ids, product_id, products(name, name_ko, name_en)')
      .eq('operator_id', operatorId)
      .gte('tour_date', fromDate)
      .lt('tour_date', beforeDate)
      .order('tour_date', { ascending: false })
      .range(from, from + TOUR_PAGE - 1)

    if (error) {
      console.error('미수령 현금 잔금 투어 조회 오류:', error)
      break
    }
    const rows = (data ?? []) as TourQueryRow[]
    out.push(...rows)
    if (rows.length < TOUR_PAGE) break
    from += TOUR_PAGE
  }
  return out
}

/**
 * 오늘(라스베가스) 이전 투어의 배정 예약 잔액(배정 관리 헤더와 동일)이
 * 남아 있는 건만 모아 합산한다.
 */
export async function fetchUnreceivedAssignedCashBalances(
  operatorId?: string | null
): Promise<UnreceivedAssignedCashResult> {
  const fromDate = getDefaultLedgerBaseDate()
  const asOfDate = todayInLasVegas()
  const empty: UnreceivedAssignedCashResult = {
    tours: [],
    totalAmount: 0,
    asOfDate,
    fromDate,
  }

  const activeOperatorId = resolveOperatorId(operatorId)
  const tours = await fetchAllPastTours(activeOperatorId, fromDate, asOfDate)
  const eligible = tours
    .filter((tour) => !isTourCancelled(tour.tour_status))
    .map((tour) => ({
      tour,
      reservationIds: normalizeReservationIds(tour.reservation_ids),
    }))
    .filter((row) => row.reservationIds.length > 0)

  const allReservationIds = [
    ...new Set(eligible.flatMap((row) => row.reservationIds)),
  ]
  if (allReservationIds.length === 0) return empty

  const [reservations, pricingRows, payRows, optRows, custRows] = await Promise.all([
    mapIdsInConcurrentChunks(allReservationIds, ID_CHUNK, ID_CONCURRENCY, async (chunk) => {
      const { data, error } = await supabase
        .from('reservations')
        .select('id, status, adults, child, infant')
        .in('id', chunk)
      if (error) {
        console.error('미수령 현금 잔금 예약 조회 오류:', error)
        return []
      }
      return data ?? []
    }),
    mapIdsInConcurrentChunks(allReservationIds, ID_CHUNK, ID_CONCURRENCY, async (chunk) => {
      const { data, error } = await supabase
        .from('reservation_pricing')
        .select('*')
        .in('reservation_id', chunk)
      if (error) {
        console.error('미수령 현금 잔금 가격 조회 오류:', error)
        return []
      }
      return data ?? []
    }),
    mapIdsInConcurrentChunks(allReservationIds, ID_CHUNK, ID_CONCURRENCY, async (chunk) => {
      const { data, error } = await supabase
        .from('payment_records')
        .select('reservation_id, payment_status, amount')
        .in('reservation_id', chunk)
      if (error) {
        console.error('미수령 현금 잔금 입금 조회 오류:', error)
        return []
      }
      return data ?? []
    }),
    mapIdsInConcurrentChunks(allReservationIds, ID_CHUNK, ID_CONCURRENCY, async (chunk) => {
      const { data, error } = await supabase
        .from('reservation_options')
        .select('reservation_id, total_price, option_id, status')
        .in('reservation_id', chunk)
      if (error) {
        console.error('미수령 현금 잔금 옵션 조회 오류:', error)
        return []
      }
      return data ?? []
    }),
    mapIdsInConcurrentChunks(allReservationIds, ID_CHUNK, ID_CONCURRENCY, async (chunk) => {
      const { data, error } = await supabase
        .from('reservation_customers')
        .select('reservation_id, resident_status')
        .in('reservation_id', chunk)
      if (error) {
        console.error('미수령 현금 잔금 고객 조회 오류:', error)
        return []
      }
      return data ?? []
    }),
  ])

  const reservationById = new Map<string, AssignedBalanceReservationInput>()
  for (const row of reservations) {
    const id = String((row as { id: string }).id)
    reservationById.set(id, {
      id,
      status: (row as { status?: string | null }).status ?? null,
      adults: (row as { adults?: number | null }).adults ?? null,
      child: (row as { child?: number | null }).child ?? null,
      infant: (row as { infant?: number | null }).infant ?? null,
    })
  }

  const pricingById = new Map<string, Record<string, unknown>>()
  for (const row of pricingRows) {
    const id = String((row as { reservation_id: string }).reservation_id)
    pricingById.set(id, row as Record<string, unknown>)
  }

  const paymentsById = new Map<string, PaymentRecordLike[]>()
  for (const row of payRows) {
    const id = String((row as { reservation_id: string }).reservation_id)
    const list = paymentsById.get(id) || []
    list.push({
      payment_status: String((row as { payment_status?: string | null }).payment_status || ''),
      amount: Number((row as { amount?: unknown }).amount) || 0,
    })
    paymentsById.set(id, list)
  }

  const optionsById = new Map<string, AssignedBalanceOptionRow[]>()
  for (const row of optRows) {
    const id = String((row as { reservation_id: string }).reservation_id)
    const list = optionsById.get(id) || []
    list.push(row as AssignedBalanceOptionRow)
    optionsById.set(id, list)
  }

  const customersById = new Map<string, Array<{ resident_status?: string | null }>>()
  for (const row of custRows) {
    const id = String((row as { reservation_id: string }).reservation_id)
    const list = customersById.get(id) || []
    list.push({
      resident_status: (row as { resident_status?: string | null }).resident_status ?? null,
    })
    customersById.set(id, list)
  }

  const resultTours: UnreceivedAssignedCashTourRow[] = []
  for (const { tour, reservationIds } of eligible) {
    let assignedBalance = 0
    let unpaidReservationCount = 0
    for (const reservationId of reservationIds) {
      const reservation = reservationById.get(reservationId)
      if (!reservation) continue
      // 배정 관리 목록과 동일: 취소·삭제 예약은 잔금 합산에서 제외
      if (
        isReservationCancelledStatus(reservation.status) ||
        isReservationDeletedStatus(reservation.status)
      ) {
        continue
      }
      const amount = computeAssignedReservationDisplayBalance({
        reservation,
        pricing: pricingById.get(reservationId),
        paymentRecords: paymentsById.get(reservationId) || [],
        optionRows: optionsById.get(reservationId) || [],
        customerRows: customersById.get(reservationId) || [],
      })
      if (amount > UNRECEIVED_EPS) {
        assignedBalance += amount
        unpaidReservationCount += 1
      }
    }
    if (assignedBalance <= UNRECEIVED_EPS) continue
    resultTours.push({
      tourId: tour.id,
      tourDate: tourDateKey(tour.tour_date),
      productName: resolveProductInternalName(productFromJoin(tour.products), tour.product_id) || '상품 미지정',
      assignedBalance,
      unpaidReservationCount,
    })
  }

  resultTours.sort((a, b) => {
    if (a.tourDate !== b.tourDate) return a.tourDate < b.tourDate ? 1 : -1
    return b.assignedBalance - a.assignedBalance
  })

  const totalAmount = resultTours.reduce((sum, row) => sum + row.assignedBalance, 0)
  return { tours: resultTours, totalAmount, asOfDate, fromDate }
}

export function formatUnreceivedCashAmount(amount: number): string {
  if (!Number.isFinite(amount) || Math.abs(amount) < UNRECEIVED_EPS) return '$0.00'
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
