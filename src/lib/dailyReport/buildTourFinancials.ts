import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import {
  reservationExcludedFromTourSettlementAggregates,
  sumOperatingProfitForTourPricing,
  type ReservationPricingRow,
} from '@/lib/tourStatsCalculator'
import {
  hotelAmountForSettlement,
  isHotelBookingActiveForReports,
  isTicketBookingActiveForReports,
  ticketExpenseForSettlement,
} from '@/lib/bookingSettlement'
import {
  computeCustomerPaymentTotalLineFormula,
  computeDisplayedOnSiteBalanceLikePricingSection,
  paymentRecordAmountToNumber,
  type PaymentRecordLike,
  type PricingBalanceFields,
} from '@/utils/reservationPricingBalance'
import { getCashPaymentMethodFilterValues } from '@/lib/cashPaymentMethodValues'
import { amountToNumber, mergeCategoryAmounts, roundUsd } from '@/lib/dailyReport/moneyUtils'
import type { DailyReportTourFinancial, DailyReportTourSummary } from '@/lib/dailyReport/types'

const BATCH = 150

type TourRow = {
  id: string
  tour_date: string
  tour_status: string | null
  tour_guide_id: string | null
  tour_car_id: string | null
  reservation_ids: string[] | null
  product_id: string | null
  guide_fee: number | null
  assistant_fee: number | null
  products: { name: string | null; name_ko: string | null; name_en: string | null } | null
}

function productDisplayName(p: TourRow['products']): string {
  return p?.name_ko?.trim() || p?.name_en?.trim() || p?.name?.trim() || '상품 미지정'
}

function isCashPayment(method: string | null, cashSet: Set<string>): boolean {
  if (!method) return false
  const m = method.trim()
  return cashSet.has(m) || m.toLowerCase() === 'cash'
}

function isInflowPaymentStatus(status: string | null): boolean {
  const s = (status ?? '').trim()
  return (
    s === 'Deposit Received' ||
    s === 'Balance Received' ||
    s === 'Partner Received' ||
    s === "Customer's CC Charged" ||
    s === 'Commission Received !'
  )
}

export async function buildTourFinancialSummary(
  client: SupabaseClient<Database>,
  todayTours: TourRow[],
  memberName: (email: string | null | undefined) => string | null
): Promise<Pick<DailyReportTourSummary, 'tours' | 'totals' | 'completed' | 'inProgress' | 'unassigned' | 'totalGuests'>> {
  const tourIds = todayTours.map((t) => t.id)
  const allReservationIds = [
    ...new Set(todayTours.flatMap((t) => (Array.isArray(t.reservation_ids) ? t.reservation_ids : []))),
  ].filter(Boolean)

  let reservations: Array<{
    id: string
    status: string | null
    total_people: number | null
    channel_id: string
    adults: number | null
    child: number | null
    infant: number | null
  }> = []

  for (let i = 0; i < allReservationIds.length; i += BATCH) {
    const batch = allReservationIds.slice(i, i + BATCH)
    const { data } = await client
      .from('reservations')
      .select('id, status, total_people, channel_id, adults, child, infant')
      .in('id', batch)
    if (data?.length) reservations = reservations.concat(data)
  }

  let pricingList: ReservationPricingRow[] = []
  for (let i = 0; i < allReservationIds.length; i += BATCH) {
    const batch = allReservationIds.slice(i, i + BATCH)
    const { data } = await client
      .from('reservation_pricing')
      .select(
        'reservation_id, total_price, product_price_total, option_total, choices_total, coupon_discount, additional_discount, additional_cost, not_included_price, card_fee, prepayment_tip, commission_amount, commission_percent, operating_profit, deposit_amount, balance_amount, adult_product_price, child_product_price, infant_product_price, tax, prepayment_cost, refund_amount'
      )
      .in('reservation_id', batch)
    if (data?.length) pricingList = pricingList.concat(data as ReservationPricingRow[])
  }

  const reservationExpensesMap: Record<string, number> = {}
  for (let i = 0; i < allReservationIds.length; i += BATCH) {
    const batch = allReservationIds.slice(i, i + BATCH)
    const { data } = await fromUntypedTable(client, 'reservation_expenses')
      .select('reservation_id, amount')
      .is('deleted_at', null)
      .in('reservation_id', batch)
    for (const row of data ?? []) {
      const id = row.reservation_id as string
      if (!id) continue
      reservationExpensesMap[id] = (reservationExpensesMap[id] ?? 0) + amountToNumber(row.amount)
    }
  }

  const channelIds = [...new Set(reservations.map((r) => r.channel_id).filter(Boolean))]
  const channelMap: Record<string, { commission_base_price_only?: boolean }> = {}
  if (channelIds.length) {
    const { data: channels } = await client
      .from('channels')
      .select('id, commission_base_price_only')
      .in('id', channelIds)
    for (const c of channels ?? []) {
      channelMap[c.id] = {
        ...(c.commission_base_price_only != null
          ? { commission_base_price_only: c.commission_base_price_only }
          : {}),
      }
    }
  }
  const reservationChannels: Record<string, { commission_base_price_only?: boolean }> = {}
  for (const r of reservations) {
    if (r.channel_id) reservationChannels[r.id] = channelMap[r.channel_id] ?? {}
  }

  const paymentsByReservation = new Map<string, PaymentRecordLike[]>()
  for (let i = 0; i < allReservationIds.length; i += BATCH) {
    const batch = allReservationIds.slice(i, i + BATCH)
    const { data } = await client
      .from('payment_records')
      .select('reservation_id, amount, payment_status, payment_method')
      .in('reservation_id', batch)
    for (const row of data ?? []) {
      const rid = row.reservation_id
      if (!rid) continue
      const list = paymentsByReservation.get(rid) ?? []
      list.push({
        payment_status: row.payment_status ?? '',
        amount: paymentRecordAmountToNumber(row.amount),
      })
      paymentsByReservation.set(rid, list)
    }
  }

  const cashPaymentMethods = new Set(await getCashPaymentMethodFilterValues())

  const { data: tourExpensesAll } = await fromUntypedTable(client, 'tour_expenses')
    .select('tour_id, amount, paid_for, exclude_from_pnl')
    .is('deleted_at', null)
    .in('tour_id', tourIds.length ? tourIds : ['__none__'])

  const { data: ticketBookingsAll } = await fromUntypedTable(client, 'ticket_bookings')
    .select('tour_id, expense, status, deleted_at, deletion_requested_at')
    .in('tour_id', tourIds.length ? tourIds : ['__none__'])

  const { data: hotelBookingsAll } = await client
    .from('tour_hotel_bookings')
    .select('tour_id, total_price, unit_price, rooms, status, deletion_requested_at')
    .in('tour_id', tourIds.length ? tourIds : ['__none__'])

  const pricingByReservation = new Map(pricingList.map((p) => [p.reservation_id, p]))
  const reservationById = new Map(reservations.map((r) => [r.id, r]))

  const tours: DailyReportTourFinancial[] = todayTours.map((tour) => {
    const resIds = Array.isArray(tour.reservation_ids) ? tour.reservation_ids : []
    const activeResIds = resIds.filter(
      (id) => !reservationExcludedFromTourSettlementAggregates(reservationById.get(id)?.status)
    )

    let totalPayment = 0
    let balanceOutstanding = 0

    for (const rid of activeResIds) {
      const r = reservationById.get(rid)
      const pricing = pricingByReservation.get(rid)
      if (!pricing || !r) continue

      const party = { adults: r.adults, child: r.child, infant: r.infant }
      const lineGross = computeCustomerPaymentTotalLineFormula(
        pricing as PricingBalanceFields,
        party
      )
      totalPayment += lineGross

      const payments = paymentsByReservation.get(rid) ?? []
      balanceOutstanding += computeDisplayedOnSiteBalanceLikePricingSection(
        pricing as PricingBalanceFields,
        null,
        party,
        payments
      )
    }

    const tourPricing = pricingList.filter((p) => activeResIds.includes(p.reservation_id))
    const statusMap = new Map(activeResIds.map((id) => [id, reservationById.get(id)?.status ?? null]))
    const totalIncome = sumOperatingProfitForTourPricing(
      tourPricing,
      statusMap,
      reservationExpensesMap,
      reservationChannels
    )

    const expenseRows: Array<{ category: string; amount: number }> = []
    for (const row of tourExpensesAll ?? []) {
      if (row.tour_id !== tour.id || row.exclude_from_pnl) continue
      expenseRows.push({
        category: (row.paid_for as string)?.trim() || '기타 지출',
        amount: amountToNumber(row.amount),
      })
    }
    const guideFeeTotal = amountToNumber(tour.guide_fee) + amountToNumber(tour.assistant_fee)
    if (guideFeeTotal > 0) {
      expenseRows.push({ category: '가이드피', amount: guideFeeTotal })
    }

    for (const row of ticketBookingsAll ?? []) {
      if (row.tour_id !== tour.id || !isTicketBookingActiveForReports(row)) continue
      expenseRows.push({ category: '입장권 부킹', amount: ticketExpenseForSettlement(row) })
    }
    for (const row of hotelBookingsAll ?? []) {
      if (row.tour_id !== tour.id || !isHotelBookingActiveForReports(row)) continue
      expenseRows.push({ category: '호텔 부킹', amount: hotelAmountForSettlement(row) })
    }

    const expensesByCategory = mergeCategoryAmounts(expenseRows)
    const totalExpenses = roundUsd(expensesByCategory.reduce((s, e) => s + e.amount, 0))

    const guestCount = activeResIds.reduce(
      (sum, id) => sum + (reservationById.get(id)?.total_people ?? 0),
      0
    )

    return {
      id: tour.id,
      productName: productDisplayName(tour.products),
      tourStatus: tour.tour_status,
      guideName: memberName(tour.tour_guide_id),
      guestCount,
      reservationCount: activeResIds.length,
      totalPayment: roundUsd(totalPayment),
      balanceOutstanding: roundUsd(balanceOutstanding),
      cashDeposit: 0, // filled below
      totalIncome: roundUsd(totalIncome),
      totalExpenses,
      netProfit: roundUsd(totalIncome - totalExpenses),
      expensesByCategory,
    }
  })

  // Second pass for cash — fetch payment records with method
  const cashByReservation = new Map<string, number>()
  for (let i = 0; i < allReservationIds.length; i += BATCH) {
    const batch = allReservationIds.slice(i, i + BATCH)
    const { data } = await client
      .from('payment_records')
      .select('reservation_id, amount, payment_status, payment_method')
      .in('reservation_id', batch)
    for (const row of data ?? []) {
      if (!row.reservation_id || !isInflowPaymentStatus(row.payment_status)) continue
      if (!isCashPayment(row.payment_method, cashPaymentMethods)) continue
      cashByReservation.set(
        row.reservation_id,
        (cashByReservation.get(row.reservation_id) ?? 0) + paymentRecordAmountToNumber(row.amount)
      )
    }
  }

  for (const tourFin of tours) {
    const tour = todayTours.find((t) => t.id === tourFin.id)
    const resIds = Array.isArray(tour?.reservation_ids) ? tour.reservation_ids : []
    tourFin.cashDeposit = roundUsd(
      resIds.reduce((sum, id) => sum + (cashByReservation.get(id) ?? 0), 0)
    )
  }

  const totals = {
    totalPayment: roundUsd(tours.reduce((s, t) => s + t.totalPayment, 0)),
    balanceOutstanding: roundUsd(tours.reduce((s, t) => s + t.balanceOutstanding, 0)),
    cashDeposit: roundUsd(tours.reduce((s, t) => s + t.cashDeposit, 0)),
    totalIncome: roundUsd(tours.reduce((s, t) => s + t.totalIncome, 0)),
    totalExpenses: roundUsd(tours.reduce((s, t) => s + t.totalExpenses, 0)),
    netProfit: roundUsd(tours.reduce((s, t) => s + t.netProfit, 0)),
    expensesByCategory: mergeCategoryAmounts(
      tours.flatMap((t) => t.expensesByCategory.map((e) => ({ category: e.category, amount: e.amount })))
    ),
  }

  const isTourCompleted = (status: string | null | undefined) => {
    const s = (status ?? '').toLowerCase()
    return s.includes('complete') || s.includes('done') || s === 'finished'
  }

  return {
    tours,
    totals,
    completed: todayTours.filter((t) => isTourCompleted(t.tour_status)).length,
    inProgress: todayTours.filter(
      (t) => !isTourCompleted(t.tour_status) && (t.tour_status ?? '').trim() !== ''
    ).length,
    unassigned: todayTours.filter((t) => !t.tour_guide_id || !t.tour_car_id).length,
    totalGuests: tours.reduce((s, t) => s + t.guestCount, 0),
  }
}
