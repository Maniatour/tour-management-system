/**
 * 배정 카드·Balance 봉투 등에서 동일하게 사용하는 잔액 계산
 * (가격 모달의 balance_amount 우선, 없으면 Grand Total − 보증금)
 *
 * 라인 총액·옵션 소계: 초이스 판매액은 reservation_options/option_total 로 이전되므로 choices_total 은 합산하지 않음(이중 계산 방지).
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
  adult_product_price?: unknown
  child_product_price?: unknown
  infant_product_price?: unknown
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

/** 잔금 수령 — 보증금(deposit) 합계에 절대 넣지 않음 (분류 우선) */
export function isBalanceReceivedPaymentStatus(paymentStatus: string): boolean {
  const t = (paymentStatus || '').trim().toLowerCase()
  if (!t) return false
  if (t === 'balance received') return true
  if (t.startsWith('balance received')) return true
  return false
}

function isDepositBucketPaymentStatus(paymentStatus: string): boolean {
  if (isBalanceReceivedPaymentStatus(paymentStatus)) return false
  const s = (paymentStatus || '').trim().toLowerCase()
  return (
    s.includes('partner received') ||
    s.includes('deposit received') ||
    s.includes("customer's cc charged")
  )
}

function isRefundedPaymentStatus(paymentStatus: string): boolean {
  const s = (paymentStatus || '').trim()
  const lower = s.toLowerCase()
  return s.includes('Refunded') || lower === 'refunded'
}

function isReturnedPaymentStatus(paymentStatus: string): boolean {
  const s = (paymentStatus || '').trim()
  const lower = s.toLowerCase()
  return s.includes('Returned') || lower === 'returned'
}

export function summarizePaymentRecordsForBalance(records: PaymentRecordLike[]): {
  depositTotalNet: number
  /** 보증금/파트너/CC 청구 라인 합(환불·Returned 차감 전) */
  depositBucketGross: number
  balanceReceivedTotal: number
  returnedTotal: number
  refundedTotal: number
  partnerReceivedStrict: number
} {
  let depositTotal = 0
  let partnerReceivedStrict = 0
  let balanceReceivedTotal = 0
  let returnedTotal = 0
  let refundedTotal = 0

  for (const record of records) {
    const status = record.payment_status || ''
    const amount = Number(record.amount) || 0

    if (status === 'Partner Received') {
      partnerReceivedStrict += amount
    }

    if (isBalanceReceivedPaymentStatus(status)) {
      balanceReceivedTotal += amount
      continue
    }

    if (isDepositBucketPaymentStatus(status)) {
      depositTotal += amount
    } else if (isRefundedPaymentStatus(status)) {
      refundedTotal += amount
    } else if (isReturnedPaymentStatus(status)) {
      returnedTotal += amount
    }
  }

  const afterReturned =
    depositTotal > 0
      ? roundUsd2(depositTotal - Math.min(partnerReceivedStrict, returnedTotal))
      : depositTotal

  const depositTotalNet = Math.max(0, roundUsd2(afterReturned - refundedTotal))

  return {
    depositTotalNet,
    depositBucketGross: depositTotal,
    balanceReceivedTotal,
    returnedTotal,
    refundedTotal,
    partnerReceivedStrict,
  }
}

/**
 * Balance 테이블과 동일한 라인 총액(computeCustomerPaymentTotalLineFormula)을 기준으로
 * payment_records 집계와 비교할 보증금 순액·잔액(미수)을 계산한다.
 * - 입금 기록이 없으면 hasRecords: false (UI에서 — 표시용)
 */
export function computeDepositBalanceFromPaymentRecordsForLineGross(
  lineGross: number,
  records: PaymentRecordLike[] | null | undefined
): {
  hasRecords: boolean
  depositTotalNet: number
  balanceReceivedTotal: number
  remainingAfterPayments: number
} {
  if (!records || records.length === 0) {
    return { hasRecords: false, depositTotalNet: 0, balanceReceivedTotal: 0, remainingAfterPayments: 0 }
  }
  const { depositTotalNet, balanceReceivedTotal, returnedTotal } = summarizePaymentRecordsForBalance(records)
  const customerNet = Math.max(0, roundUsd2(lineGross - returnedTotal))
  const remainingAfterPayments = Math.max(0, roundUsd2(customerNet - depositTotalNet - balanceReceivedTotal))
  return { hasRecords: true, depositTotalNet, balanceReceivedTotal, remainingAfterPayments }
}

/**
 * 잔액(계산) 표시·`balance_amount` DB 반영: **총액(라인 산식) − 보증금(입금)**.
 * - `payment_records`가 있으면 보증금 순액(`depositTotalNet`) 사용
 * - 없으면 `deposit_amount`(DB) 사용
 * - 잔금 수령(Balance Received) 합은 여기서 차감하지 않음
 */
export function balanceOutstandingTotalMinusDeposit(
  lineGross: number,
  records: PaymentRecordLike[] | null | undefined,
  depositAmountDb: number,
  isCancelled: boolean
): number {
  if (isCancelled) return 0
  const g = Math.max(0, roundUsd2(lineGross))
  const hasRecords = records && records.length > 0
  const deposit = hasRecords
    ? summarizePaymentRecordsForBalance(records).depositTotalNet
    : roundUsd2(depositAmountDb)
  return Math.max(0, roundUsd2(g - deposit))
}

function totalBillingPaxFromParty(party: PartySizeSource): number {
  const a = party.adults ?? 0
  const c = (party.children ?? party.child ?? 0) ?? 0
  const i = (party.infants ?? party.infant ?? 0) ?? 0
  const n = a + c + i
  return n > 0 ? n : 1
}

function baseProductTierLinesSum(
  pricing: Pick<
    PricingBalanceFields,
    'adult_product_price' | 'child_product_price' | 'infant_product_price'
  >,
  party: PartySizeSource
): number {
  const a = party.adults ?? 0
  const c = (party.children ?? party.child ?? 0) ?? 0
  const i = (party.infants ?? party.infant ?? 0) ?? 0
  return roundUsd2(
    pricingFieldToNumber(pricing.adult_product_price) * a +
      pricingFieldToNumber(pricing.child_product_price) * c +
      pricingFieldToNumber(pricing.infant_product_price) * i
  )
}

function notIncludedTotalForPartyPricing(
  pricing: Pick<PricingBalanceFields, 'not_included_price'>,
  party: PartySizeSource
): number {
  return roundUsd2(pricingFieldToNumber(pricing.not_included_price) * totalBillingPaxFromParty(party))
}

/**
 * DB `product_price_total`이 (단가×인원)만 있고 미포함을 빠뜨린 레거시 행은 단가×인원+미포함(1인당×청구인원)으로 보정.
 * 그 외는 저장값 그대로.
 */
export function effectiveProductPriceTotalForBalance(
  pricing: Pick<
    PricingBalanceFields,
    | 'product_price_total'
    | 'adult_product_price'
    | 'child_product_price'
    | 'infant_product_price'
    | 'not_included_price'
  >,
  party: PartySizeSource
): number {
  const stored = pricingFieldToNumber(pricing.product_price_total)
  const base = baseProductTierLinesSum(pricing, party)
  const ni = notIncludedTotalForPartyPricing(pricing, party)
  const withNi = roundUsd2(base + ni)
  if (ni < 0.005) return stored
  if (Math.abs(stored - base) <= 0.02 && Math.abs(stored - withNi) > 0.02) {
    return withNi
  }
  return stored
}

/**
 * 고객 결제 총액 (Balance 표·DB 동기화): 상품합 − 할인 + 추가 + 옵션 Subtotal
 * - 상품합: product_price_total — 저장 시 `reservationUpdate` 등에서 (판매가×인원) + 미포함(1인당×인원)이 합산됨
 * - 할인: coupon_discount + additional_discount
 * - 추가: additional_cost, tax, card_fee, prepayment_cost, prepayment_tip, private_tour_additional_cost
 * - 옵션 Subtotal: 필수·선택만 — 미포함은 상품합에 이미 포함되어 여기서 더하지 않음. choices_total 제외
 */
export function computeCustomerPaymentTotalLineFormula(
  pricing: PricingBalanceFields & {
    required_option_total?: unknown
    choices_total?: unknown
    private_tour_additional_cost?: unknown
  },
  party: PartySizeSource
): number {
  const productSum = effectiveProductPriceTotalForBalance(pricing, party)
  const discount =
    pricingFieldToNumber(pricing.coupon_discount) +
    pricingFieldToNumber(pricing.additional_discount)
  const extras =
    pricingFieldToNumber(pricing.additional_cost) +
    pricingFieldToNumber(pricing.tax) +
    pricingFieldToNumber(pricing.card_fee) +
    pricingFieldToNumber(pricing.prepayment_cost) +
    pricingFieldToNumber(pricing.prepayment_tip) +
    pricingFieldToNumber(pricing.private_tour_additional_cost)
  const optionsSubtotal =
    pricingFieldToNumber(pricing.required_option_total) +
    pricingFieldToNumber(pricing.option_total)
  return roundUsd2(productSum - discount + extras + optionsSubtotal)
}

/** 산식 총액 − 보증금 (선택 반영 시 balance_amount 갱신용) */
export function computeRemainingBalanceFromLineFormula(
  pricing: Parameters<typeof computeCustomerPaymentTotalLineFormula>[0],
  party: PartySizeSource
): number {
  const gross = computeCustomerPaymentTotalLineFormula(pricing, party)
  return Math.max(0, roundUsd2(gross - pricingFieldToNumber(pricing.deposit_amount)))
}

/**
 * 고객 총 결제 예정(gross, Returned 차감 전) — choices_total 제외
 * 미포함(1인당×인원)은 DB `product_price_total`에 이미 합산되어 있으므로 별도 가산하지 않음
 */
export function computeCustomerTotalDueGross(
  pricing: PricingBalanceFields,
  optionsTotalFromOptions: number | null,
  party: PartySizeSource
): number {
  const effectiveOpts =
    optionsTotalFromOptions !== null ? optionsTotalFromOptions : pricingFieldToNumber(pricing.option_total)
  const discounted =
    effectiveProductPriceTotalForBalance(pricing, party) -
    pricingFieldToNumber(pricing.coupon_discount) -
    pricingFieldToNumber(pricing.additional_discount)
  return (
    discounted +
    effectiveOpts +
    pricingFieldToNumber(pricing.additional_cost) +
    pricingFieldToNumber(pricing.tax) +
    pricingFieldToNumber(pricing.card_fee) +
    pricingFieldToNumber(pricing.prepayment_cost) +
    pricingFieldToNumber(pricing.prepayment_tip)
  )
}

/**
 * DB `total_price`가 있고, `computeCustomerPaymentTotalLineFormula`와 0.01 초과로 다르면 true.
 * 저장 총액이 없으면 false (불일치로 보지 않음).
 */
export function isStoredCustomerTotalMismatchWithFormula(
  party: PartySizeSource,
  pricing:
    | (PricingBalanceFields & {
        total_price?: unknown
        required_option_total?: unknown
        choices_total?: unknown
        private_tour_additional_cost?: unknown
      })
    | null
    | undefined
): boolean {
  if (!pricing) return false
  const raw = pricing.total_price
  if (raw === undefined || raw === null || raw === '') return false
  const stored = pricingFieldToNumber(raw)
  const computed = roundUsd2(computeCustomerPaymentTotalLineFormula(pricing, party))
  return Math.abs(stored - computed) > 0.01
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
  /** 취소 예약은 잔액 0 (PricingSection displayedOnSiteBalance와 동일) */
  reservationStatus?: string | null
}

/**
 * 잔액 표시: DB balance_amount(사용자 저장값) 최우선, 없을 때만 계산값.
 * - 취소 → 0
 * - balance_amount 가 null/undefined/빈 문자열이 아니면 → 그 값(0 포함)
 * - 비어 있으면 defaultBalance = 순 총액 − (보증금 순 + 잔금 수령) 또는 총액 − 보증금
 */
export function getBalanceAmountForDisplay(
  pricing: PricingBalanceFields | null | undefined,
  optionsTotalFromOptions: number | null,
  party: PartySizeSource,
  opts?: GetBalanceDisplayOpts
): number {
  if (!pricing) return 0

  const st = opts?.reservationStatus
  const cancelled =
    st != null && ['cancelled', 'canceled'].includes(String(st).toLowerCase().trim())
  if (cancelled) return 0

  const rawStored = pricing.balance_amount
  const hasExplicitBalance =
    rawStored !== undefined && rawStored !== null && rawStored !== ''
  if (hasExplicitBalance) {
    return Math.max(0, roundUsd2(pricingFieldToNumber(rawStored)))
  }

  const gross = computeCustomerTotalDueGross(pricing, optionsTotalFromOptions, party)
  const records = opts?.paymentRecords

  if (records && records.length > 0) {
    const { depositTotalNet, balanceReceivedTotal, returnedTotal } = summarizePaymentRecordsForBalance(records)
    const customerNet = Math.max(0, roundUsd2(gross - returnedTotal))
    return Math.max(0, roundUsd2(customerNet - depositTotalNet - balanceReceivedTotal))
  }

  return computeRemainingBalanceAmount(pricing, optionsTotalFromOptions, party)
}
