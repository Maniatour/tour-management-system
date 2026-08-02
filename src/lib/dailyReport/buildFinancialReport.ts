import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { lasVegasDateRangeBounds } from '@/lib/dailyReport/dateUtils'
import { amountToNumber, roundUsd } from '@/lib/dailyReport/moneyUtils'
import { getCashPaymentMethodFilterValues } from '@/lib/cashPaymentMethodValues'
import {
  hotelAmountForSettlement,
  isHotelBookingActiveForReports,
  isTicketBookingActiveForReports,
  ticketExpenseForSettlement,
} from '@/lib/bookingSettlement'
import type {
  DailyReportFinancialCategory,
  DailyReportFinancialItem,
  DailyReportFinancialReport,
  DailyReportTourFinancial,
} from '@/lib/dailyReport/types'

const LEDGER_BASE_DATE = '2025-01-01'

const CASH_PAYMENT_STATUSES = [
  'Deposit Received',
  'Balance Received',
  'Partner Received',
  "Customer's CC Charged",
  'Commission Received !',
] as const

type TourRow = {
  id: string
  tour_date: string
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

function sortItems(items: DailyReportFinancialItem[]): DailyReportFinancialItem[] {
  return [...items].sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label))
}

function category(
  key: DailyReportFinancialCategory['key'],
  title: string,
  items: DailyReportFinancialItem[]
): DailyReportFinancialCategory {
  const sorted = sortItems(items)
  return {
    key,
    title,
    items: sorted,
    total: roundUsd(sorted.reduce((sum, item) => sum + item.amount, 0)),
  }
}

export async function buildFinancialReport(
  client: SupabaseClient<Database>,
  operatorId: string,
  startDate: string,
  endDate: string,
  todayTours: TourRow[],
  tourFinancials: DailyReportTourFinancial[]
): Promise<DailyReportFinancialReport> {
  const { start, end } = lasVegasDateRangeBounds(startDate, endDate)
  const tourIds = todayTours.map((t) => t.id)
  const tourNameById = new Map(todayTours.map((t) => [t.id, productDisplayName(t.products)]))
  const cashPaymentMethods = new Set(await getCashPaymentMethodFilterValues())

  const tourExpensesQuery = fromUntypedTable(client, 'tour_expenses')
    .select('id, tour_id, paid_for, paid_to, amount, payment_method, note, submit_on')
    .eq('operator_id', operatorId)
    .is('deleted_at', null)

  const tourExpensesRes =
    startDate === endDate
      ? await tourExpensesQuery.eq('tour_date', startDate)
      : await tourExpensesQuery.gte('tour_date', startDate).lte('tour_date', endDate)

  const [
    reservationExpensesRes,
    companyExpensesRes,
    ticketBookingsRes,
    hotelBookingsRes,
    cashTransactionsPeriodRes,
    cashTransactionsLedgerRes,
    cashPaymentsPeriodRes,
    cashPaymentsLedgerRes,
    companyCashPeriodRes,
    companyCashLedgerRes,
    reservationCashPeriodRes,
    reservationCashLedgerRes,
  ] = await Promise.all([
    fromUntypedTable(client, 'reservation_expenses')
      .select('id, reservation_id, tour_id, paid_for, paid_to, amount, payment_method, note, submit_on')
      .eq('operator_id', operatorId)
      .is('deleted_at', null)
      .gte('submit_on', start)
      .lte('submit_on', end),
    fromUntypedTable(client, 'company_expenses')
      .select('id, paid_for, paid_to, amount, payment_method, description, notes, submit_on')
      .eq('operator_id', operatorId)
      .is('deleted_at', null)
      .eq('exclude_from_pnl', false)
      .gte('submit_on', start)
      .lte('submit_on', end),
    fromUntypedTable(client, 'ticket_bookings')
      .select('id, tour_id, category, company, expense, status, deleted_at, deletion_requested_at')
      .in('tour_id', tourIds.length ? tourIds : ['__none__']),
    client
      .from('tour_hotel_bookings')
      .select('id, tour_id, hotel, total_price, unit_price, rooms, status, deletion_requested_at')
      .in('tour_id', tourIds.length ? tourIds : ['__none__']),
    client
      .from('cash_transactions')
      .select('id, transaction_type, amount, transaction_date, category, description')
      .eq('operator_id', operatorId)
      .gte('transaction_date', start)
      .lte('transaction_date', end),
    client
      .from('cash_transactions')
      .select('id, transaction_type, amount, transaction_date')
      .eq('operator_id', operatorId)
      .gte('transaction_date', `${LEDGER_BASE_DATE}T00:00:00`)
      .lte('transaction_date', end),
    client
      .from('payment_records')
      .select('id, amount, submit_on, payment_method, note')
      .eq('operator_id', operatorId)
      .in('payment_method', [...cashPaymentMethods])
      .in('payment_status', [...CASH_PAYMENT_STATUSES])
      .gte('submit_on', start)
      .lte('submit_on', end),
    client
      .from('payment_records')
      .select('id, amount, submit_on')
      .eq('operator_id', operatorId)
      .in('payment_method', [...cashPaymentMethods])
      .in('payment_status', [...CASH_PAYMENT_STATUSES])
      .gte('submit_on', `${LEDGER_BASE_DATE}T00:00:00`)
      .lte('submit_on', end),
    fromUntypedTable(client, 'company_expenses')
      .select('id, amount, submit_on, paid_for, description, notes')
      .eq('operator_id', operatorId)
      .in('payment_method', [...cashPaymentMethods])
      .is('deleted_at', null)
      .gte('submit_on', start)
      .lte('submit_on', end),
    fromUntypedTable(client, 'company_expenses')
      .select('id, amount, submit_on')
      .eq('operator_id', operatorId)
      .in('payment_method', [...cashPaymentMethods])
      .is('deleted_at', null)
      .gte('submit_on', `${LEDGER_BASE_DATE}T00:00:00`)
      .lte('submit_on', end),
    fromUntypedTable(client, 'reservation_expenses')
      .select('id, amount, submit_on, paid_for, note')
      .eq('operator_id', operatorId)
      .in('payment_method', [...cashPaymentMethods])
      .is('deleted_at', null)
      .gte('submit_on', start)
      .lte('submit_on', end),
    fromUntypedTable(client, 'reservation_expenses')
      .select('id, amount, submit_on')
      .eq('operator_id', operatorId)
      .in('payment_method', [...cashPaymentMethods])
      .is('deleted_at', null)
      .gte('submit_on', `${LEDGER_BASE_DATE}T00:00:00`)
      .lte('submit_on', end),
  ])

  const tourExpenseItems: DailyReportFinancialItem[] = []
  for (const row of tourExpensesRes.data ?? []) {
    if ((row as { exclude_from_pnl?: boolean }).exclude_from_pnl) continue
    const tourId = row.tour_id as string | null
    tourExpenseItems.push({
      id: `te_${row.id}`,
      label: (row.paid_for as string)?.trim() || '투어 지출',
      detail: tourId ? tourNameById.get(tourId) ?? null : null,
      amount: amountToNumber(row.amount),
      paymentMethod: (row.payment_method as string | null) ?? null,
    })
  }

  for (const tour of todayTours) {
    const guideFee = amountToNumber(tour.guide_fee) + amountToNumber(tour.assistant_fee)
    if (guideFee <= 0) continue
    tourExpenseItems.push({
      id: `guide_${tour.id}`,
      label: '가이드피',
      detail: productDisplayName(tour.products),
      amount: guideFee,
    })
  }

  const reservationItems: DailyReportFinancialItem[] = (reservationExpensesRes.data ?? []).map((row) => ({
    id: `re_${row.id}`,
    label: (row.paid_for as string)?.trim() || '예약 지출',
    detail: [
      row.tour_id ? tourNameById.get(row.tour_id as string) : null,
      (row.note as string | null)?.trim() || null,
    ]
      .filter(Boolean)
      .join(' · ') || null,
    amount: amountToNumber(row.amount),
    paymentMethod: (row.payment_method as string | null) ?? null,
  }))

  const bookingItems: DailyReportFinancialItem[] = []
  for (const row of ticketBookingsRes.data ?? []) {
    if (!isTicketBookingActiveForReports(row)) continue
    const tourId = row.tour_id as string | null
    bookingItems.push({
      id: `tb_${row.id}`,
      label: '입장권 부킹',
      detail: [
        tourId ? tourNameById.get(tourId) : null,
        (row.category as string | null)?.trim() || (row.company as string | null)?.trim() || null,
      ]
        .filter(Boolean)
        .join(' · ') || null,
      amount: ticketExpenseForSettlement(row),
    })
  }
  for (const row of hotelBookingsRes.data ?? []) {
    if (!isHotelBookingActiveForReports(row)) continue
    const tourId = row.tour_id as string | null
    bookingItems.push({
      id: `hb_${row.id}`,
      label: '호텔 부킹',
      detail: [
        tourId ? tourNameById.get(tourId) : null,
        (row.hotel as string | null)?.trim() || null,
      ]
        .filter(Boolean)
        .join(' · ') || null,
      amount: hotelAmountForSettlement(row),
    })
  }

  const companyItems: DailyReportFinancialItem[] = (companyExpensesRes.data ?? []).map((row) => ({
    id: `ce_${row.id}`,
    label: (row.paid_for as string | null)?.trim() || '회사 지출',
    detail: [
      (row.description as string | null)?.trim() || null,
      (row.notes as string | null)?.trim() || null,
      (row.paid_to as string | null)?.trim() || null,
    ]
      .filter(Boolean)
      .join(' · ') || null,
    amount: amountToNumber(row.amount),
    paymentMethod: (row.payment_method as string | null) ?? null,
  }))

  const cashExpenseItems: DailyReportFinancialItem[] = []
  for (const row of cashTransactionsPeriodRes.data ?? []) {
    if (row.transaction_type !== 'withdrawal') continue
    cashExpenseItems.push({
      id: `ct_${row.id}`,
      label: (row.category as string | null)?.trim() || '현금 출금',
      detail: (row.description as string | null)?.trim() || null,
      amount: amountToNumber(row.amount),
      paymentMethod: 'cash',
    })
  }
  for (const row of companyCashPeriodRes.data ?? []) {
    cashExpenseItems.push({
      id: `cce_${row.id}`,
      label: (row.paid_for as string | null)?.trim() || '회사 지출',
      detail: [
        (row.description as string | null)?.trim() || null,
        (row.notes as string | null)?.trim() || null,
      ]
        .filter(Boolean)
        .join(' · ') || null,
      amount: amountToNumber(row.amount),
      paymentMethod: 'cash',
    })
  }
  for (const row of reservationCashPeriodRes.data ?? []) {
    cashExpenseItems.push({
      id: `cre_${row.id}`,
      label: (row.paid_for as string | null)?.trim() || '예약 지출',
      detail: (row.note as string | null)?.trim() || null,
      amount: amountToNumber(row.amount),
      paymentMethod: 'cash',
    })
  }
  for (const row of tourExpensesRes.data ?? []) {
    if (!isCashPayment(row.payment_method as string | null, cashPaymentMethods)) continue
    const tourId = row.tour_id as string | null
    cashExpenseItems.push({
      id: `cte_${row.id}`,
      label: (row.paid_for as string | null)?.trim() || '투어 지출',
      detail: tourId ? tourNameById.get(tourId) ?? null : null,
      amount: amountToNumber(row.amount),
      paymentMethod: 'cash',
    })
  }

  const cashInflowItems: DailyReportFinancialItem[] = []
  for (const row of cashTransactionsPeriodRes.data ?? []) {
    if (row.transaction_type !== 'deposit') continue
    cashInflowItems.push({
      id: `ctd_${row.id}`,
      label: (row.category as string | null)?.trim() || '현금 입금',
      detail: (row.description as string | null)?.trim() || null,
      amount: amountToNumber(row.amount),
      paymentMethod: 'cash',
    })
  }
  for (const row of cashPaymentsPeriodRes.data ?? []) {
    cashInflowItems.push({
      id: `cp_${row.id}`,
      label: '예약 현금 입금',
      detail: (row.note as string | null)?.trim() || null,
      amount: amountToNumber(row.amount),
      paymentMethod: (row.payment_method as string | null) ?? 'cash',
    })
  }

  const cashDepositFromTours = roundUsd(tourFinancials.reduce((sum, t) => sum + t.cashDeposit, 0))
  if (cashDepositFromTours > 0) {
    cashInflowItems.push({
      id: 'tour_cash_deposit',
      label: '투어 현금 입금',
      detail: `${todayTours.length}건 투어 합계`,
      amount: cashDepositFromTours,
      paymentMethod: 'cash',
    })
  }

  const cashInflowToday = roundUsd(cashInflowItems.reduce((sum, item) => sum + item.amount, 0))
  const cashOutflowToday = roundUsd(cashExpenseItems.reduce((sum, item) => sum + item.amount, 0))

  let ledgerBalance = 0
  for (const row of cashTransactionsLedgerRes.data ?? []) {
    if (row.transaction_type === 'deposit') ledgerBalance += amountToNumber(row.amount)
    else ledgerBalance -= amountToNumber(row.amount)
  }
  for (const row of cashPaymentsLedgerRes.data ?? []) {
    ledgerBalance += amountToNumber(row.amount)
  }
  for (const row of companyCashLedgerRes.data ?? []) {
    ledgerBalance -= amountToNumber(row.amount)
  }
  for (const row of reservationCashLedgerRes.data ?? []) {
    ledgerBalance -= amountToNumber(row.amount)
  }

  const cashOnHand = roundUsd(ledgerBalance)
  const cashItems: DailyReportFinancialItem[] = [
    ...cashInflowItems,
    ...cashExpenseItems.map((item) => ({
      ...item,
      id: `out_${item.id}`,
      amount: -item.amount,
    })),
    {
      id: 'cash_on_hand',
      label: '현금 보유 (잔액)',
      detail: `${LEDGER_BASE_DATE} 기준 원장`,
      amount: cashOnHand,
    },
  ]

  const categories: DailyReportFinancialCategory[] = [
    category('tour', '투어 지출', tourExpenseItems),
    category('reservation', '예약 지출', reservationItems),
    category('booking', '부킹', bookingItems),
    category('company', '회사 지출', companyItems),
    category('cash_expense', '현금 지출', cashExpenseItems),
    category('cash', '현금 흐름 · 보유', cashItems),
  ]

  return {
    categories,
    cashOnHand,
    cashInflowToday,
    cashOutflowToday,
    netCashFlowToday: roundUsd(cashInflowToday - cashOutflowToday),
  }
}
