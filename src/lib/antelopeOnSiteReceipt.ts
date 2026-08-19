import { resolveAntelopeCheckInDate } from '@/lib/scheduleVehicleOilMaintenance'
import { deriveLegacyTicketBookingStatusFromAxes } from '@/lib/ticketBookingLegacyAxisMap'
import type { TourChoiceCountKey } from '@/lib/tourChoiceCounts'
import { SEE_CANYON_TICKET_UNIT_USD } from '@/lib/zellePaymentEmail'

export const ANTELOPE_ON_SITE_L_COMPANY = 'SEE CANYON'
export const ANTELOPE_ON_SITE_X_COMPANY = 'Antelope X'

export type AntelopeOnSiteCanyon = 'L' | 'X'

export type AntelopeOnSiteReceiptRow = {
  id: string
  tour_id: string
  amount: number
  tour_date: string | null
  paid_for: string | null
  paid_to: string | null
  image_url: string | null
  payment_method: string | null
  linked_booking_id?: string | null
  linked_canyon?: TourChoiceCountKey | null
}

export type AntelopeOnSiteDayTotals = {
  total: number
  byCanyon: Partial<Record<'X' | 'L' | 'U', number>>
}

/** 투어 영수증에서 넘긴 현장 결제 입장권 부킹인지 */
export function isOnSiteTransferredTicketBooking(booking: {
  tour_expense_id?: string | null
}): boolean {
  return Boolean(String(booking.tour_expense_id || '').trim())
}

/** OCR·수동 입력 모두 Antelope / 앤텔롭 현장 결제 영수증인지 */
export function isAntelopeOnSiteTourExpense(row: {
  paid_for?: string | null
  paid_to?: string | null
}): boolean {
  const blob = `${row.paid_for ?? ''} ${row.paid_to ?? ''}`.toLowerCase()
  return (
    blob.includes('antelope') ||
    blob.includes('앤텔롭') ||
    blob.includes('엔텔롭') ||
    blob.includes('앤틸롭') ||
    blob.includes('엔틸롭')
  )
}

/** 영수증에 수량이 없을 때 SEE CANYON 단가로 EA 추정 */
export function suggestAntelopeOnSiteEa(amount: number): number {
  const n = Number(amount)
  if (!Number.isFinite(n) || n <= 0) return 1
  const ea = Math.round(n / SEE_CANYON_TICKET_UNIT_USD)
  return Math.max(1, ea)
}

export function antelopeOnSiteCompanyForCanyon(canyon: AntelopeOnSiteCanyon): {
  company: string
  category: string
} {
  if (canyon === 'X') {
    return { company: ANTELOPE_ON_SITE_X_COMPANY, category: 'Antelope X' }
  }
  return { company: ANTELOPE_ON_SITE_L_COMPANY, category: 'antelope_canyon' }
}

export function antelopeOnSiteReceiptCalendarDate(
  receipt: Pick<AntelopeOnSiteReceiptRow, 'tour_id' | 'tour_date'>,
  tour?: {
    tour_date?: string | null
    product_id?: string | null
    antelope_check_in_date?: string | null
  } | null
): string {
  if (tour) {
    const d = resolveAntelopeCheckInDate(tour)
    if (d) return d
  }
  return String(receipt.tour_date || '').slice(0, 10)
}

export function groupAntelopeOnSiteAmountByDateAndCanyon(
  receipts: AntelopeOnSiteReceiptRow[],
  tourById: Map<
    string,
    {
      tour_date?: string | null
      product_id?: string | null
      antelope_check_in_date?: string | null
    }
  >
): Map<string, AntelopeOnSiteDayTotals> {
  const map = new Map<string, AntelopeOnSiteDayTotals>()
  for (const receipt of receipts) {
    if (!isAntelopeOnSiteTourExpense(receipt)) continue
    const date = antelopeOnSiteReceiptCalendarDate(receipt, tourById.get(receipt.tour_id) ?? null)
    if (!date) continue
    const amount = Number(receipt.amount) || 0
    if (!(amount > 0)) continue
    const canyon: 'X' | 'L' | 'U' =
      receipt.linked_canyon === 'X' || receipt.linked_canyon === 'L' || receipt.linked_canyon === 'U'
        ? receipt.linked_canyon
        : 'L'
    const cur = map.get(date) ?? { total: 0, byCanyon: {} }
    cur.total += amount
    cur.byCanyon[canyon] = (cur.byCanyon[canyon] ?? 0) + amount
    map.set(date, cur)
  }
  return map
}

export function buildAntelopeOnSiteTicketBookingInsert(input: {
  expenseId: string
  tourId: string
  checkInDate: string
  ea: number
  canyon: AntelopeOnSiteCanyon
  amount: number
  paymentMethod: string | null
  imageUrl: string | null
  submitOn: string
}): Record<string, unknown> {
  const { company, category } = antelopeOnSiteCompanyForCanyon(input.canyon)
  const bookingStatus = 'confirmed'
  const vendorStatus = 'confirmed'
  const changeStatus = 'none'
  const paymentStatus = 'paid'
  const refundStatus = 'none'
  const operationStatus = 'none'
  const amountLabel = Number(input.amount).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
  const uploaded = String(input.imageUrl || '').trim()

  return {
    category,
    company,
    check_in_date: input.checkInDate,
    submit_on: input.submitOn,
    time: null,
    ea: input.ea,
    expense: 0,
    income: 0,
    paid_amount: 0,
    payment_method: input.paymentMethod || null,
    rn_number: null,
    tour_id: input.tourId,
    tour_ids: [input.tourId],
    tour_expense_id: input.expenseId,
    note: `현장 결제 · 투어 영수증 $${amountLabel}`,
    uploaded_file_urls: uploaded ? [uploaded] : null,
    booking_status: bookingStatus,
    vendor_status: vendorStatus,
    change_status: changeStatus,
    payment_status: paymentStatus,
    refund_status: refundStatus,
    operation_status: operationStatus,
    status: deriveLegacyTicketBookingStatusFromAxes(
      bookingStatus,
      vendorStatus,
      changeStatus,
      paymentStatus,
      refundStatus,
      operationStatus
    ),
  }
}
