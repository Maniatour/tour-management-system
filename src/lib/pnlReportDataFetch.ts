import { supabase } from '@/lib/supabase'
import { hotelAmountForSettlement, isHotelBookingIncludedInSettlement } from '@/lib/bookingSettlement'
import { fetchAllSupabasePages } from '@/lib/supabasePaginatedFetch'

/** 통합 PNL·expense_category_mappings.original_value (tour_hotel_bookings 공통 키) */
export const PNL_TOUR_HOTEL_BOOKING_MAPPING_ORIGINAL = 'Tour hotel booking'

export type PnlPaymentRecordRow = {
  id: string
  amount: unknown
  payment_status: string | null
  payment_method: string | null
  reservation_id: string
  submit_on: string | null
  note: string | null
  submit_by: string | null
}

const PAYMENT_RECORD_SELECT =
  'id, amount, payment_status, payment_method, reservation_id, submit_on, note, submit_by'

/** 통합 PNL 입금: 기간 내 payment_records 전부 (PostgREST 1000행 제한 순회) */
export async function fetchPaymentRecordsForPnlReport(startISO: string, endISO: string) {
  const { data, error } = await fetchAllSupabasePages<PnlPaymentRecordRow>((from, to) =>
    supabase
      .from('payment_records')
      .select(PAYMENT_RECORD_SELECT)
      .gte('submit_on', startISO)
      .lte('submit_on', endISO)
      .order('submit_on', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
  )
  if (error) return { data: [] as PnlPaymentRecordRow[], error }
  const byId = new Map<string, PnlPaymentRecordRow>()
  for (const r of data) byId.set(r.id, r)
  return { data: [...byId.values()], error: null }
}

export type PnlTourExpenseRow = {
  id: string
  amount: unknown
  paid_for: string | null
  paid_to: string | null
  note: string | null
  payment_method: string | null
  exclude_from_pnl: boolean | null
  submit_on: string | null
}

export type PnlReservationExpenseRow = PnlTourExpenseRow

export type PnlCompanyExpenseRow = {
  id: string
  amount: unknown
  paid_for: string | null
  category: string | null
  standard_paid_for: string | null
  expense_type: string | null
  paid_to: string | null
  notes: string | null
  description: string | null
  payment_method: string | null
  exclude_from_pnl: boolean | null
  submit_on: string | null
}

export type PnlTicketBookingRow = {
  id: string
  expense: unknown
  category: string | null
  company: string | null
  note: string | null
  payment_method: string | null
  submit_on: string | null
}

export type PnlTourHotelBookingRow = {
  id: string
  total_price: unknown
  unit_price: unknown
  rooms: unknown
  hotel: string | null
  reservation_name: string | null
  payment_method: string | null
  status: string | null
  submit_on: string | null
}

export async function fetchTourExpensesForPnlReport(startISO: string, endISO: string) {
  return fetchAllSupabasePages<PnlTourExpenseRow>((from, to) =>
    supabase
      .from('tour_expenses')
      .select('id, amount, paid_for, paid_to, note, payment_method, exclude_from_pnl, submit_on')
      .is('deleted_at', null)
      .gte('submit_on', startISO)
      .lte('submit_on', endISO)
      .order('submit_on', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
  )
}

export async function fetchReservationExpensesForPnlReport(startISO: string, endISO: string) {
  return fetchAllSupabasePages<PnlReservationExpenseRow>((from, to) =>
    supabase
      .from('reservation_expenses')
      .select('id, amount, paid_for, paid_to, note, payment_method, exclude_from_pnl, submit_on')
      .is('deleted_at', null)
      .gte('submit_on', startISO)
      .lte('submit_on', endISO)
      .order('submit_on', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
  )
}

export async function fetchCompanyExpensesForPnlReport(startISO: string, endISO: string) {
  return fetchAllSupabasePages<PnlCompanyExpenseRow>((from, to) =>
    supabase
      .from('company_expenses')
      .select(
        'id, amount, paid_for, category, standard_paid_for, expense_type, paid_to, notes, description, payment_method, exclude_from_pnl, submit_on'
      )
      .is('deleted_at', null)
      .gte('submit_on', startISO)
      .lte('submit_on', endISO)
      .order('submit_on', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
  )
}

export async function fetchTicketBookingsForPnlReport(startISO: string, endISO: string) {
  return fetchAllSupabasePages<PnlTicketBookingRow>((from, to) =>
    supabase
      .from('ticket_bookings')
      .select('id, expense, category, company, note, payment_method, submit_on')
      .is('deleted_at', null)
      .gte('submit_on', startISO)
      .lte('submit_on', endISO)
      .in('status', ['confirmed', 'paid'])
      .order('submit_on', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
  )
}

/** 통합 PNL 지출: 기간 내 tour_hotel_bookings (취소·삭제요청 제외, total_price 기준) */
export async function fetchTourHotelBookingsForPnlReport(startISO: string, endISO: string) {
  const { data, error } = await fetchAllSupabasePages<PnlTourHotelBookingRow>((from, to) =>
    supabase
      .from('tour_hotel_bookings')
      .select(
        'id, total_price, unit_price, rooms, hotel, reservation_name, payment_method, status, submit_on'
      )
      .gte('submit_on', startISO)
      .lte('submit_on', endISO)
      .order('submit_on', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)
  )
  if (error) return { data: [] as PnlTourHotelBookingRow[], error }
  const filtered = data.filter((r) => isHotelBookingIncludedInSettlement(r.status))
  return { data: filtered, error: null }
}

export function tourHotelBookingAmountForPnl(row: PnlTourHotelBookingRow): number {
  return hotelAmountForSettlement(row)
}
