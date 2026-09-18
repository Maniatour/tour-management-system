import {
  getBalanceAmountForDisplay,
  residentFeesUsdFromCustomerRows,
  withNormalizedBalanceAmountForDisplay,
  type PaymentRecordLike,
} from '@/utils/reservationPricingBalance'

export type AssignedBalanceOptionRow = {
  option_id?: string | null
  total_price?: unknown
  status?: string | null
}

export type AssignedBalanceReservationInput = {
  id: string
  status?: string | null
  adults?: number | null
  children?: number | null
  child?: number | null
  infants?: number | null
  infant?: number | null
}

/** 배정 관리 헤더·카드 잔액: 저장 잔액. 잔금 수령 입금이 있으면 입금 반영 미수금 */
export function computeAssignedReservationDisplayBalance(args: {
  reservation: AssignedBalanceReservationInput
  pricing: Record<string, unknown> | undefined
  paymentRecords?: PaymentRecordLike[]
  optionRows?: AssignedBalanceOptionRow[]
  customerRows?: Array<{ resident_status?: string | null }>
}): number {
  const { reservation, pricing, paymentRecords, customerRows } = args
  if (!pricing) return 0
  return getBalanceAmountForDisplay(
    withNormalizedBalanceAmountForDisplay(pricing),
    null,
    {
      adults: reservation.adults ?? null,
      children: reservation.children ?? reservation.child ?? null,
      infants: reservation.infants ?? reservation.infant ?? null,
      child: reservation.child ?? null,
      infant: reservation.infant ?? null,
    },
    {
      reservationStatus: reservation.status ?? null,
      ...(paymentRecords && paymentRecords.length > 0 ? { paymentRecords } : {}),
      ...(customerRows && customerRows.length > 0
        ? { residentFeeUsd: residentFeesUsdFromCustomerRows(customerRows) }
        : {}),
    }
  )
}
