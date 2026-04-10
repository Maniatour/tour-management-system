/**
 * 배정 카드·Balance 봉투 등에서 동일하게 사용하는 잔액 계산
 * (가격 모달의 balance_amount 우선, 없으면 Grand Total − 보증금)
 *
 * PricingSection의 gross 합산과 맞춤: choices_total(초이스 판매액)은 불포함·상품가와 이중이 될 수 있어 잔액 산식에 넣지 않음.
 */

function roundUsd2(n: number): number {
  return Math.round(n * 100) / 100
}

export function pricingFieldToNumber(v: unknown): number {
  if (v == null || v === '') return 0
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string') return parseFloat(v) || 0
  return Number(v) || 0
}

export type PartySizeSource = {
  adults?: number | null
  children?: number | null
  infants?: number | null
  child?: number | null
  infant?: number | null
}

/** reservation_pricing 행 또는 API JSON 일부 */
export type PricingBalanceFields = {
  balance_amount?: unknown
  deposit_amount?: unknown
  product_price_total?: unknown
  coupon_discount?: unknown
  additional_discount?: unknown
  option_total?: unknown
  choices_total?: unknown
  not_included_price?: unknown
  additional_cost?: unknown
  tax?: unknown
  card_fee?: unknown
  prepayment_cost?: unknown
  prepayment_tip?: unknown
}

/** 입금 내역 → 보증금(순)·잔금 수령·Returned (PricingSection·카드 공통) */
export type PaymentRecordLike = { payment_status: string; amount: number }

export function summarizePaymentRecordsForBalance(records: PaymentRecordLike[]): {
  depositTotalNet: number
  balanceReceivedTotal: number
  returnedTotal: number
} {
  let depositTotal = 0
  let partnerReceivedStrict = 0
  let balanceReceivedTotal = 0
  let returnedTotal = 0

  for (const record of records) {
    const status = record.payment_status || ''
    const statusLower = status.toLowerCase()
    const amount = Number(record.amount) || 0

    if (status === 'Partner Received') {
      partnerReceivedStrict += amount
    }

    if (
      statusLower.includes('partner received') ||
      statusLower.includes('deposit received') ||
      statusLower.includes("customer's cc charged")
    ) {
      depositTotal += amount
    } else if (statusLower.includes('balance received')) {
      // 잔금 "요청"은 미수령이므로 합산하지 않음
      balanceReceivedTotal += amount
    } else if (status.includes('Returned') || statusLower === 'returned') {
      returnedTotal += amount
    }
  }

  const depositTotalNet =
    depositTotal > 0
      ? roundUsd2(depositTotal - Math.min(partnerReceivedStrict, returnedTotal))
      : depositTotal

  return { depositTotalNet, balanceReceivedTotal, returnedTotal }
}

/**
 * 고객 총 결제 예정(gross, Returned 차감 전) — choices_total 제외
 */
export function computeCustomerTotalDueGross(
  pricing: PricingBalanceFields,
  optionsTotalFromOptions: number | null,
  party: PartySizeSource
): number {
  const totalPeople =
    (party.adults || 0) +
    ((party.children ?? party.child) || 0) +
    ((party.infants ?? party.infant) || 0) ||
    1
  const notIncludedTotal = pricingFieldToNumber(pricing.not_included_price) * totalPeople
  const effectiveOpts =
    optionsTotalFromOptions !== null ? optionsTotalFromOptions : pricingFieldToNumber(pricing.option_total)
  const discounted =
    pricingFieldToNumber(pricing.product_price_total) -
    pricingFieldToNumber(pricing.coupon_discount) -
    pricingFieldToNumber(pricing.additional_discount)
  return (
    discounted +
    effectiveOpts +
    notIncludedTotal +
    pricingFieldToNumber(pricing.additional_cost) +
    pricingFieldToNumber(pricing.tax) +
    pricingFieldToNumber(pricing.card_fee) +
    pricingFieldToNumber(pricing.prepayment_cost) +
    pricingFieldToNumber(pricing.prepayment_tip)
  )
}

/**
 * 입금 내역 없음: Grand Total − 보증금 (옵션 합 있으면 option_total 대신 사용)
 */
export function computeRemainingBalanceAmount(
  pricing: PricingBalanceFields,
  optionsTotalFromOptions: number | null,
  party: PartySizeSource
): number {
  const customerTotal = computeCustomerTotalDueGross(pricing, optionsTotalFromOptions, party)
  return Math.max(0, roundUsd2(customerTotal - pricingFieldToNumber(pricing.deposit_amount)))
}

export type GetBalanceDisplayOpts = {
  paymentRecords?: PaymentRecordLike[]
}

/**
 * DB balance_amount가 양수면 우선(입금 전 수동 잔액).
 * 입금 내역이 있으면 PricingSection과 동일: 순 총액 − (보증금 순 + 잔금 수령).
 */
export function getBalanceAmountForDisplay(
  pricing: PricingBalanceFields | null | undefined,
  optionsTotalFromOptions: number | null,
  party: PartySizeSource,
  opts?: GetBalanceDisplayOpts
): number {
  if (!pricing) return 0

  const records = opts?.paymentRecords
  const gross = computeCustomerTotalDueGross(pricing, optionsTotalFromOptions, party)

  if (records && records.length > 0) {
    const { depositTotalNet, balanceReceivedTotal, returnedTotal } = summarizePaymentRecordsForBalance(records)
    const customerNet = Math.max(0, roundUsd2(gross - returnedTotal))
    return Math.max(0, roundUsd2(customerNet - depositTotalNet - balanceReceivedTotal))
  }

  const stored = pricingFieldToNumber(pricing.balance_amount)
  if (stored > 0) return stored
  return computeRemainingBalanceAmount(pricing, optionsTotalFromOptions, party)
}
