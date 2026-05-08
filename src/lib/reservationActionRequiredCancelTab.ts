import type { Reservation } from '@/types/reservation'
import type { ReservationPricingMapValue } from '@/types/reservationPricingMap'
import {
  pricingFieldToNumber,
  summarizePaymentRecordsForBalance,
  type PaymentRecordLike,
} from '@/utils/reservationPricingBalance'
import {
  computeBalanceChannelMetrics,
  type BalanceChannelRowInput,
} from '@/utils/balanceChannelRevenue'

export function isReservationCancelledOnlyForActionRequired(
  status: string | null | undefined
): boolean {
  const s = String(status ?? '').trim().toLowerCase()
  return s === 'cancelled' || s === 'canceled'
}

/**
 * 예약 처리 필요「취소」탭 — 취소됐는데
 * - 입금(보증금 순액·잔금 수령)이 환불 반영으로 정리되지 않았거나
 * - 저장 총액(total_price) 또는 총매출·운영이익 산식에 수익이 남아 있는 예약
 */
export function reservationNeedsCancelFinancialCleanup(
  r: Reservation,
  reservationPricingMap: Map<string, ReservationPricingMapValue>,
  paymentRecordsByReservationId: Map<string, PaymentRecordLike[]>,
  channels: BalanceChannelRowInput[],
  reservationOptionSumByReservationId: Map<string, number> | undefined
): boolean {
  if (!isReservationCancelledOnlyForActionRequired(r.status)) return false

  const records = paymentRecordsByReservationId.get(r.id) ?? []
  const sm = summarizePaymentRecordsForBalance(records)
  const hasUnrefundedCustomerMoney =
    records.length > 0 &&
    (sm.depositTotalNet > 0.01 || sm.balanceReceivedTotal > 0.01)

  const p = reservationPricingMap.get(r.id)
  const totalPrice = p ? pricingFieldToNumber(p.total_price) : 0
  const m = p
    ? computeBalanceChannelMetrics(
        p,
        r,
        channels,
        records,
        reservationOptionSumByReservationId
      )
    : null
  const hasResidualRevenue =
    totalPrice > 0.01 ||
    (m != null && (m.companyTotalRevenue > 0.01 || m.operatingProfit > 0.01))

  return hasUnrefundedCustomerMoney || hasResidualRevenue
}
