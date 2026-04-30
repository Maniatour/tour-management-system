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

/**
 * 배치 조회한 `reservation_options.total_price` 합이 있으면 `option_total`만 덮어써
 * 가격 불일치 필터·잔액 테이블이 동일한 “라인 총액”을 보게 함.
 */
export function mergePricingWithLiveOptionTotal<P extends { option_total?: unknown }>(
  p: P | null | undefined,
  reservationId: string,
  live?: Map<string, number>
): P | null | undefined {
  if (!p) return p
  const v = live?.get(reservationId)
  if (v === undefined) return p
  return { ...p, option_total: v }
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
  refund_amount?: unknown
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
 * 「총 결제 예정」과 보증금·잔금 수령 간 잔액 산출용: 고객이 이미 확정 적용된 지불(+) 합 추정.
 * - 폼 보증금이 입금(Refunded) 반영 순액이면 `deposit + balanceReceived` 가 총액과 맞음
 * - 보증금이 입금 차감 전 총액으로 남아 있으면 `deposit + balance − Refunded 합` 이 맞음
 * - 입금 환불 없이 「가격 정보」환불만 있으면 `deposit + balance − manualRefund` 가 맞음 (총액은 이미 환불 반영됨)
 * 위 세 가지 중 어느 하나가 현재 총액(`totalDue`)에 가장 가까운 값을 사용한다 (이중 카운팅 회피).
 */
export function computeEffectiveCustomerPaidTowardDue(
  totalDue: number,
  depositAmount: number,
  balanceReceived: number,
  refundedFromRecords: number,
  manualRefundFromPricing: number
): number {
  const d = Math.max(0, roundUsd2(Number(totalDue) || 0))
  const dep = Number(depositAmount) || 0
  const bal = Number(balanceReceived) || 0
  const rec = Math.max(0, Number(refundedFromRecords) || 0)
  const man = Math.max(0, Number(manualRefundFromPricing) || 0)

  const candRaw = roundUsd2(dep + bal)
  const candMinusRec = roundUsd2(dep + bal - rec)
  const candMinusMan = roundUsd2(dep + bal - man)
  const candidates = [candRaw, candMinusRec, candMinusMan]

  let best = candRaw
  let bestErr = Math.abs(d - candRaw)
  for (let i = 1; i < candidates.length; i++) {
    const v = candidates[i]
    const err = Math.abs(d - v)
    if (err + 1e-9 < bestErr) {
      best = v
      bestErr = err
    }
  }

  return Math.max(0, roundUsd2(best))
}

/** `PricingSection`의 depositAmountNetOfPartnerReturnedOverlap와 동일 */
export function depositAmountNetOfPartnerReturnedOverlapForBalance(
  totalDue: number,
  depositAmount: number,
  returnedTotal: number
): number {
  const ret = Math.max(0, Number(returnedTotal) || 0)
  const dep = Math.max(0, Number(depositAmount) || 0)
  const due = Math.max(0, Number(totalDue) || 0)
  const excessDepositOverDue = Math.max(0, roundUsd2(dep - due))
  const overlap = Math.min(ret, excessDepositOverDue)
  return Math.max(0, roundUsd2(dep - overlap))
}

/**
 * `PricingSection` **displayedOnSiteBalance** / ② 잔액(계산)과 동일:
 * - 총액(gross) = `computeCustomerPaymentTotalLineFormula`(옵션 합은 `reservation_options` 합이 있으면 그걸로만 쓰고 `required_option_total`은 0으로 막아 이중 가산 방지)
 * - `totalCustomerPayment` = gross − max(0, Returned − 가격 환불) (`calculateTotalCustomerPayment`)
 * - 보증금·`computeEffectiveCustomerPaidTowardDue`로 순 지불 추정 후 잔액
 */
export function computeDisplayedOnSiteBalanceLikePricingSection(
  pricing: PricingBalanceFields & {
    required_option_total?: unknown
    choices_total?: unknown
    private_tour_additional_cost?: unknown
  },
  optionsTotalFromOptions: number | null,
  party: PartySizeSource,
  records: PaymentRecordLike[]
): number {
  if (!records.length) {
    return computeRemainingBalanceAmount(pricing, optionsTotalFromOptions, party)
  }

  const optsOnly =
    optionsTotalFromOptions !== null && optionsTotalFromOptions !== undefined

  const pricingForGross = {
    ...pricing,
    required_option_total: optsOnly ? 0 : pricing.required_option_total,
    option_total: optsOnly ? optionsTotalFromOptions : pricing.option_total,
  } as Parameters<typeof computeCustomerPaymentTotalLineFormula>[0]

  const grossDue = roundUsd2(computeCustomerPaymentTotalLineFormula(pricingForGross, party))

  const { depositBucketGross, balanceReceivedTotal, returnedTotal, refundedTotal } =
    summarizePaymentRecordsForBalance(records)

  const manualRefund = Math.max(0, pricingFieldToNumber(pricing.refund_amount))
  const returnedSurplus = Math.max(0, roundUsd2(returnedTotal - manualRefund))
  const totalCustomerPayment = Math.max(0, roundUsd2(grossDue - returnedSurplus))

  const depositInput =
    depositBucketGross > 0 ? depositBucketGross : pricingFieldToNumber(pricing.deposit_amount)

  const depositForDue = depositAmountNetOfPartnerReturnedOverlapForBalance(
    totalCustomerPayment,
    depositInput,
    returnedTotal
  )

  const totalPaid = computeEffectiveCustomerPaidTowardDue(
    totalCustomerPayment,
    depositForDue,
    balanceReceivedTotal,
    refundedTotal,
    manualRefund
  )

  return roundUsd2(totalCustomerPayment - totalPaid)
}

/**
 * Balance 테이블과 동일한 라인 총액(computeCustomerPaymentTotalLineFormula)을 기준으로
 * payment_records 집계와 비교할 보증금(버킷 총액·순액)·잔액(미수)을 계산한다.
 * - `depositBucketGross`: reservation_pricing.deposit_amount(입금 보증 버킷 합)과 비교용
 * - `depositTotalNet`: 잔액·순유입 추정에 사용
 * - 입금 기록이 없으면 hasRecords: false (UI에서 — 표시용)
 */
export function computeDepositBalanceFromPaymentRecordsForLineGross(
  lineGross: number,
  records: PaymentRecordLike[] | null | undefined
): {
  hasRecords: boolean
  depositTotalNet: number
  depositBucketGross: number
  balanceReceivedTotal: number
  remainingAfterPayments: number
} {
  if (!records || records.length === 0) {
    return {
      hasRecords: false,
      depositTotalNet: 0,
      depositBucketGross: 0,
      balanceReceivedTotal: 0,
      remainingAfterPayments: 0,
    }
  }
  const { depositTotalNet, depositBucketGross, balanceReceivedTotal, returnedTotal } =
    summarizePaymentRecordsForBalance(records)
  const customerNet = Math.max(0, roundUsd2(lineGross - returnedTotal))
  const remainingAfterPayments = Math.max(0, roundUsd2(customerNet - depositTotalNet - balanceReceivedTotal))
  return {
    hasRecords: true,
    depositTotalNet,
    depositBucketGross,
    balanceReceivedTotal,
    remainingAfterPayments,
  }
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
    pricingFieldToNumber(pricing.private_tour_additional_cost) -
    pricingFieldToNumber(pricing.refund_amount)
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
    pricingFieldToNumber(pricing.prepayment_tip) -
    pricingFieldToNumber(pricing.refund_amount)
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
 * 입금 내역 없음: 라인 산식 총액 − 보증금(DB). 옵션 행 합이 있으면 option_total 대신 사용.
 * (`computeCustomerTotalDueGross`와 라인 산식 불일치로 배정 카드 잔금이 어긋나는 경우 방지)
 */
export function computeRemainingBalanceAmount(
  pricing: PricingBalanceFields,
  optionsTotalFromOptions: number | null,
  party: PartySizeSource
): number {
  const pricingForLine = {
    ...(pricing as PricingBalanceFields & {
      required_option_total?: unknown
      choices_total?: unknown
      private_tour_additional_cost?: unknown
    }),
    option_total:
      optionsTotalFromOptions !== null && optionsTotalFromOptions !== undefined
        ? optionsTotalFromOptions
        : pricing.option_total,
  } as Parameters<typeof computeCustomerPaymentTotalLineFormula>[0]
  const customerTotal = roundUsd2(computeCustomerPaymentTotalLineFormula(pricingForLine, party))
  return Math.max(0, roundUsd2(customerTotal - pricingFieldToNumber(pricing.deposit_amount)))
}

export type GetBalanceDisplayOpts = {
  paymentRecords?: PaymentRecordLike[]
  /** 취소 예약은 잔액 0 (PricingSection displayedOnSiteBalance와 동일) */
  reservationStatus?: string | null
}

/**
 * 잔액 표시: 입금이 있으면 가격 정보 탭 `displayedOnSiteBalance`와 같은 식(`computeDisplayedOnSiteBalanceLikePricingSection`).
 * `balance_amount`(DB)는 `displayedOnSiteBalance`와 같이: 비어 있으면 계산값만; 0인데 계산이 더 크면 계산값;
 * 양수인데 계산이 ~0이면 정산 완료로 계산값; 그 외 양수는 사용자 저장값.
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

  const optsOnly =
    optionsTotalFromOptions !== null && optionsTotalFromOptions !== undefined

  const pricingForLine = {
    ...(pricing as PricingBalanceFields & {
      required_option_total?: unknown
      choices_total?: unknown
      private_tour_additional_cost?: unknown
    }),
    required_option_total: optsOnly ? 0 : (pricing as { required_option_total?: unknown }).required_option_total,
    option_total:
      optionsTotalFromOptions !== null && optionsTotalFromOptions !== undefined
        ? optionsTotalFromOptions
        : pricing.option_total,
  } as Parameters<typeof computeCustomerPaymentTotalLineFormula>[0]

  const records = opts?.paymentRecords
  if (records && records.length > 0) {
    const defaultBalance = computeDisplayedOnSiteBalanceLikePricingSection(
      pricingForLine,
      optionsTotalFromOptions,
      party,
      records
    )

    const rawStored = pricing.balance_amount
    if (rawStored === undefined || rawStored === null || rawStored === '') {
      return defaultBalance
    }
    const storedNum = pricingFieldToNumber(rawStored)
    if (Math.abs(storedNum) < 0.005) {
      if (Math.abs(defaultBalance) > 0.01) return defaultBalance
      return roundUsd2(storedNum)
    }
    if (storedNum > 0.005) {
      if (defaultBalance <= 0.02) return roundUsd2(defaultBalance)
      return roundUsd2(storedNum)
    }
    return roundUsd2(storedNum)
  }

  return computeRemainingBalanceAmount(pricing, optionsTotalFromOptions, party)
}
