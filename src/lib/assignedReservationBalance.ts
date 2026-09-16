import {
  getBalanceAmountForDisplay,
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

/** 배정 관리 헤더·카드 잔액: reservation_pricing에 저장된 balance_amount */
export function computeAssignedReservationDisplayBalance(args: {
  reservation: AssignedBalanceReservationInput
  pricing: Record<string, unknown> | undefined
  paymentRecords?: PaymentRecordLike[]
  optionRows?: AssignedBalanceOptionRow[]
  customerRows?: Array<{ resident_status?: string | null }>
}): number {
  const { reservation, pricing } = args
  if (!pricing) return 0
  return getBalanceAmountForDisplay(
    withNormalizedBalanceAmountForDisplay(pricing),
    null,
    {},
    { reservationStatus: reservation.status ?? null }
  )
}
