/**
 * 배정 카드·Balance 봉투·투어 인쇄 등에서 동일하게 사용하는 잔액 표시.
 * 예약수정모달 가격정보「잔금」과 맞추기 위해, DB `balance_amount`와 계산값이 다르면
 * 가격 탭과 같은 계산값(총 결제 − 입금 순효과 등, 비거주자 비용 포함)을 우선한다.
 */

import { isNotIncludedExcludedReservationStatus } from '@/lib/reservationStatus'
import { NON_RESIDENT_OPTION_ID } from '@/lib/reservationNoShowEffects'
import {
  countResidentLinesFromCustomers,
  sumResidentFeesFromResidentCounts,
  type ResidentStatusCounts,
} from '@/utils/balanceEnvelopeBreakdown'
import { sumResidentFeeAmountsUsd, sumResidentFeesFromPricingChoicesJson } from '@/utils/usResidentChoiceSync'

function roundUsd2(n: number): number {
  return Math.round(n * 100) / 100
}

export function pricingFieldToNumber(v: unknown): number {
  if (v == null || v === '') return 0
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string') {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : 0
  }
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** number input 값. `Number(x) || 0`은 `-10`은 유지하지만 `-` 입력 중 NaN을 0으로 만든다. */
export function parseUsdNumberInput(raw: string): number {
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

/** 수동 입력 잔액(음수 크레딧 포함)이 있는지 — `> 0.005`만 보면 -10이 계산값으로 덮인다. */
export function hasExplicitOnSiteBalance(value: unknown): boolean {
  const n = Number(value)
  return Number.isFinite(n) && Math.abs(n) > 0.005
}

/**
 * 예약 가져오기 레이스: 총액이 아직 0일 때 잔액이 `0 − 보증금`으로 음수가 된 뒤,
 * 총액이 채워져도 그 음수가 수동 입력으로 남는 경우.
 * 인당 $10 크레딧처럼 보증금과 무관한 소액 음수는 해당하지 않음.
 */
export function isPhantomNegativeOnSiteBalance(
  formBalance: unknown,
  depositAmount: unknown
): boolean {
  const form = Number(formBalance)
  const dep = Number(depositAmount) || 0
  if (!Number.isFinite(form) || form >= -0.005) return false
  if (dep < 0.005) return false
  return Math.abs(form + dep) < 0.05
}

/** 가져오기·가격 재계산 시 잔액을 유지할지. 보증금 레이스 음수는 유지하지 않음. */
export function shouldPreserveOnSiteBalance(
  formBalance: unknown,
  depositAmount: unknown = 0
): boolean {
  return (
    hasExplicitOnSiteBalance(formBalance) &&
    !isPhantomNegativeOnSiteBalance(formBalance, depositAmount)
  )
}

/**
 * 투어 당일 잔액 저장값.
 * 이메일 가져오기 등에서 총액 로드 전에 보증금만 채워지면 `0 − 보증금`이 음수로 남는 문제를 막는다.
 * 총액이 있는 상태에서 입력한 음수(인당 $10 크레딧 등)는 그대로 저장한다.
 */
export function resolveOnSiteBalanceAmountForSave(opts: {
  formBalance: unknown
  totalPrice: number
  depositAmount: number
}): number {
  const computed = roundUsd2(
    Math.max(0, (Number(opts.totalPrice) || 0) - (Number(opts.depositAmount) || 0))
  )
  const form = Number(opts.formBalance)
  if (!Number.isFinite(form)) {
    return computed
  }
  const total = Number(opts.totalPrice) || 0
  if (form < -0.005 && total < 0.005) {
    return computed
  }
  if (isPhantomNegativeOnSiteBalance(form, opts.depositAmount)) {
    return computed
  }
  return roundUsd2(form)
}

/** DB·폼에 ± 혼재 — PricingSection·엔진은 양수 할인액으로 차감 */
export function pricingDiscountAmountMagnitude(v: unknown): number {
  return Math.abs(pricingFieldToNumber(v))
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

/** Supabase/CSV 등에서 amount가 문자열·콤마 포함일 때 집계 누락 방지 */
export function paymentRecordAmountToNumber(v: unknown): number {
  if (v == null || v === '') return 0
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  const s = String(v).replace(/,/g, '').trim()
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

/**
 * payment_records ↔ 예약 행 Map 키 통일 (앞뒤 공백·zero-width로 조회 실패하는 경우 방지)
 */
export function normalizeReservationIdForPayments(id: unknown): string {
  return String(id ?? '')
    .trim()
    .replace(/\u200B/g, '')
}

/** payment_records 배치 Map — 정규화·원본 id 모두로 조회 */
export function resolvePaymentRecordsForReservation(
  map: Map<string, PaymentRecordLike[]> | undefined,
  reservationId: unknown
): PaymentRecordLike[] {
  if (!map || map.size === 0) return []
  const norm = normalizeReservationIdForPayments(reservationId)
  const raw = String(reservationId ?? '').trim()
  return map.get(norm) ?? (raw && raw !== norm ? map.get(raw) : undefined) ?? []
}

/** 입금 집계 Map에 예약 id(정규화·원본) 양쪽 키로 동일 레코드 추가 */
export function appendPaymentRecordToReservationMap(
  map: Map<string, PaymentRecordLike[]>,
  reservationId: unknown,
  record: PaymentRecordLike
): void {
  const norm = normalizeReservationIdForPayments(reservationId)
  const raw = String(reservationId ?? '').trim()
  for (const key of new Set([norm, raw].filter(Boolean))) {
    const arr = map.get(key) ?? []
    arr.push(record)
    map.set(key, arr)
  }
}

/** 입금 집계 Map — 예약 id 정규화·원본 키에 동일 배열 참조로 설정(배치 갱신용) */
export function setPaymentRecordsForReservation(
  map: Map<string, PaymentRecordLike[]>,
  reservationId: unknown,
  records: PaymentRecordLike[]
): void {
  const norm = normalizeReservationIdForPayments(reservationId)
  const raw = String(reservationId ?? '').trim()
  const copy = [...records]
  for (const key of new Set([norm, raw].filter(Boolean))) {
    map.set(key, copy)
  }
}

/**
 * 환불(기록) UI 합계: 분류 함수가 놓친 변형 문자열도 `환불됨`·Returned/Refunded 완료 건만 합산 (수령·청구 라인 제외)
 */
export function sumPaymentRecordLedgerRefundDisplayUsd(records: PaymentRecordLike[]): number {
  let sum = 0
  for (const r of records) {
    const raw = String(r.payment_status ?? '').trim()
    if (!raw) continue
    if (isBalanceReceivedPaymentStatus(raw)) continue
    if (isDepositBucketPaymentStatus(raw)) continue

    const amt = Math.abs(paymentRecordAmountToNumber(r.amount))
    if (amt < 0.005) continue

    const st = raw.normalize('NFKC').toLowerCase()
    const pendingOnly =
      (st.includes('request') || st.includes('요청')) &&
      !raw.includes('환불됨') &&
      st !== 'returned' &&
      st !== 'refunded' &&
      !/\breturned\b/.test(st) &&
      !/\brefunded\b/.test(st)
    if (pendingOnly) continue

    if (isReturnedPaymentStatus(raw) || isRefundedPaymentStatus(raw) || raw.includes('환불됨')) {
      sum += amt
    }
  }
  return roundUsd2(sum)
}

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

/** 우리 쪽 입금 환불 (DB: `환불됨 (우리)`, 구버전 Refunded 등) */
export function isRefundedPaymentStatus(paymentStatus: string): boolean {
  const raw = (paymentStatus || '').trim()
  if (!raw) return false
  const s = raw.replace(/\s+/g, ' ').trim()
  if (s === '환불됨 (우리)' || s === '환불됨(우리)') return true
  const noSpace = s.replace(/\s/g, '')
  if (/^환불됨[\(（]?우리[\)）]?$/.test(noSpace)) return true
  const lower = s.toLowerCase()
  return s.includes('Refunded') || lower === 'refunded'
}

/** 현금 원장: 우리·파트너 환불 라인은 출금 */
export function isCashLedgerRefundPaymentStatus(paymentStatus: string | null | undefined): boolean {
  const raw = String(paymentStatus ?? '')
  return isRefundedPaymentStatus(raw) || isReturnedPaymentStatus(raw)
}

/** 현금 원장: 환불 상태이거나 비고에 '현금 환불'이 있으면 출금 */
export function isCashLedgerRefundPaymentRecord(
  paymentStatus: string | null | undefined,
  note?: string | null
): boolean {
  return isCashLedgerRefundPaymentStatus(paymentStatus) || /현금\s*환불/.test(String(note ?? ''))
}

/** 파트너 입금 환불 (DB: `환불됨 (파트너)`, 구버전 Returned 등) */
export function isReturnedPaymentStatus(paymentStatus: string): boolean {
  const raw = (paymentStatus || '').trim()
  if (!raw) return false
  let s = raw.replace(/\s+/g, ' ').trim()
  try {
    s = s.normalize('NFKC')
  } catch {
    /* ignore */
  }
  if (s === '환불됨 (파트너)' || s === '환불됨(파트너)') return true
  const noSpace = s.replace(/\s/g, '')
  if (/^환불됨[\(（]?파트너[\)）]?$/.test(noSpace)) return true

  const lower = s.toLowerCase()
  if (lower === 'returned' || s.includes('Returned')) return true
  if (
    !lower.includes('우리') &&
    lower.includes('파트너') &&
    (lower.includes('환불') || lower.includes('return'))
  ) {
    return true
  }
  if (lower.includes('partner') && lower.includes('return')) return true
  return false
}

/** 보증금·잔금·환불 요청 등 — 실제 수령·환불 명세가 아님 (통합 PNL 입금·현금 거래 집계에서 제외) */
export function isPaymentRequestedStatus(paymentStatus: string | null | undefined): boolean {
  const raw = (paymentStatus ?? '').trim()
  if (!raw) return false
  if (
    raw === 'Deposit Requested' ||
    raw === 'Balance Requested' ||
    raw === 'Refund Requested' ||
    raw === 'pending' ||
    raw === 'Pending'
  ) {
    return true
  }
  const st = raw.normalize('NFKC').toLowerCase()
  if (!/\brequested\b/.test(st) && !raw.includes('요청')) return false
  if (isBalanceReceivedPaymentStatus(raw)) return false
  if (raw === 'Deposit Received' || st.startsWith('deposit received')) return false
  if (raw === 'Partner Received' || st.startsWith('partner received')) return false
  if (isRefundedPaymentStatus(raw) || isReturnedPaymentStatus(raw)) return false
  return true
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
    const status = (record.payment_status || '').trim()
    const amount = paymentRecordAmountToNumber(record.amount)

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

/** 입금 내역에 결제·환불 라인이 하나라도 있는지 */
export function hasPaymentRecordActivity(
  paySm: ReturnType<typeof summarizePaymentRecordsForBalance>
): boolean {
  return (
    paySm.depositBucketGross > 0.005 ||
    paySm.balanceReceivedTotal > 0.005 ||
    paySm.returnedTotal > 0.005 ||
    paySm.refundedTotal > 0.005
  )
}

/**
 * 취소 예약 채널 결제·정산 산식 — Returned·Refunded(우리 환불)·가격 환불 입력 중 최대값으로 gross 차감.
 */
export function cancelledSettlementReturnedAmount(
  paySm: ReturnType<typeof summarizePaymentRecordsForBalance>,
  manualRefundFromPricing: number
): number {
  return roundUsd2(
    Math.max(
      paySm.returnedTotal,
      paySm.refundedTotal,
      Math.max(0, manualRefundFromPricing)
    )
  )
}

/**
 * 취소·비-OTA ④ 총매출 — 입금 순수령.
 * 보증금 버킷(보증금 수령·파트너 수령 등) + 잔금 수령 − 우리 환불 − 파트너 환불.
 * `depositTotalNet`은 파트너 환불을 Partner Received에만 상계하므로,
 * 보증금 수령 후 `환불됨 (파트너)`인 전액 환불 건은 여기서 순액을 0으로 맞춘다.
 */
export function cancelledNonOtaNetCollectedFromPayments(
  paySm: ReturnType<typeof summarizePaymentRecordsForBalance>
): number | null {
  if (!hasPaymentRecordActivity(paySm)) return null
  const grossIn = roundUsd2(
    Math.max(0, Number(paySm.depositBucketGross) || 0) +
      Math.max(0, Number(paySm.balanceReceivedTotal) || 0)
  )
  const grossOut = roundUsd2(
    Math.max(0, Number(paySm.refundedTotal) || 0) +
      Math.max(0, Number(paySm.returnedTotal) || 0)
  )
  return roundUsd2(Math.max(0, grossIn - grossOut))
}

/**
 * 「총 결제 예정」과 보증금·잔금 수령 간 잔액 산출용: 고객이 이미 확정 적용된 지불(+) 합 추정.
 * - 폼 보증금이 입금(Refunded) 반영 순액이면 `deposit + balanceReceived` 가 총액과 맞음
 * - 보증금이 입금 차감 전 총액으로 남아 있으면 `deposit + balance − Refunded 합` 이 맞음
 * - 입금 환불 없이 「가격 정보」환불만 있으면 `deposit + balance − manualRefund` 가 맞음 (총액은 이미 환불 반영됨)
 * 위 세 가지 중 어느 하나가 현재 총액(`totalDue`)에 가장 가까운 값을 사용한다 (이중 카운팅 회피).
 */
/**
 * 입금 내역 집계가 있을 때 잔액(②): 총 결제 예정 − (보증금 순액 + 잔금 수령).
 * `summarizePaymentRecordsForBalance`의 `depositTotalNet`과 동일 기준.
 *
 * `refundCreditAgainstDue`: 입금 「환불됨 (우리)」·가격 투어 환불이 보증금 순액에 이미 반영됐을 때,
 * 총 결제 예정(①)에서도 동일 금액을 차감해 이중 차감을 막는다 (진행 중 예약 부분 환불 등).
 *
 * ①이 추가할인·투어 환불로 이미 낮아진 상태에서 초과 입금을 환불한 경우에는
 * `computeRemainingBalanceAfterPaymentRecords`가 초과분만큼 크레딧을 줄여
 * 잔액이 다시 음수가 되지 않게 한다.
 */
export function customerRefundCreditAgainstDue(
  paySm: Pick<ReturnType<typeof summarizePaymentRecordsForBalance>, 'refundedTotal'>,
  manualRefundFromPricing: number
): number {
  const refRec = roundUsd2(Math.max(0, Math.abs(Number(paySm.refundedTotal) || 0)))
  const man = roundUsd2(Math.max(0, Number(manualRefundFromPricing) || 0))
  return roundUsd2(Math.max(man, refRec))
}

export function computeRemainingBalanceAfterPaymentRecords(
  totalCustomerPayment: number,
  depositTotalNet: number,
  balanceReceivedTotal: number,
  refundCreditAgainstDue: number = 0
): number {
  const due = Math.max(0, roundUsd2(Number(totalCustomerPayment) || 0))
  const creditRaw = Math.max(0, roundUsd2(Number(refundCreditAgainstDue) || 0))
  const paid = roundUsd2(
    Math.max(0, Number(depositTotalNet) || 0) + Math.max(0, Number(balanceReceivedTotal) || 0)
  )
  /**
   * 보증금 순액은 이미 Refunded를 뺀 값이다. 환불 크레딧을 ①에서도 빼면
   * (할인으로 이미 낮아진 총액) − (환불 전 입금)이 되어 잔액이 −환불액이 된다.
   * ①이 입금 총액보다 낮으면 그 초과분은 이미 총액에 반영된 것으로 보고 크레딧에서 제외한다.
   */
  const paidGrossApprox = roundUsd2(paid + creditRaw)
  const overpayAlreadyInDue = Math.max(0, roundUsd2(paidGrossApprox - due))
  const credit = Math.max(0, roundUsd2(creditRaw - overpayAlreadyInDue))
  const adjustedDue = roundUsd2(Math.max(0, due - credit))
  return roundUsd2(adjustedDue - paid)
}

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
  records: PaymentRecordLike[],
  extraResidentFeeUsd?: number | null
): number {
  if (!records.length) {
    return computeRemainingBalanceAmount(pricing, optionsTotalFromOptions, party, extraResidentFeeUsd)
  }

  const optsOnly =
    optionsTotalFromOptions !== null && optionsTotalFromOptions !== undefined

  const pricingForGross = {
    ...pricing,
    required_option_total: optsOnly ? 0 : pricing.required_option_total,
    option_total: optsOnly ? optionsTotalFromOptions : pricing.option_total,
  } as Parameters<typeof computeCustomerPaymentTotalLineFormula>[0]

  const grossDue = customerTotalDueForBalanceSettlement(
    pricingForGross,
    party,
    extraResidentFeeUsd
  )

  const { depositTotalNet, balanceReceivedTotal, returnedTotal, refundedTotal } =
    summarizePaymentRecordsForBalance(records)

  const manualRefund = Math.max(0, pricingFieldToNumber(pricing.refund_amount))
  const returnedSurplus = Math.max(0, roundUsd2(returnedTotal - manualRefund))
  const totalCustomerPayment = Math.max(0, roundUsd2(grossDue - returnedSurplus))
  const refundCredit = customerRefundCreditAgainstDue({ refundedTotal }, manualRefund)

  return computeRemainingBalanceAfterPaymentRecords(
    totalCustomerPayment,
    depositNetForBalanceSettlement(depositTotalNet, pricing.prepayment_tip),
    balanceReceivedTotal,
    refundCredit
  )
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
    pricingDiscountAmountMagnitude(pricing.coupon_discount) +
    pricingDiscountAmountMagnitude(pricing.additional_discount)
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

/**
 * 거주 상태별 금액(비거주·패스 등)은 라인 산식 `option_total`·`product_price_total`에 없고
 * `total_price`·`choices`에만 반영되는 경우가 있음 — 잔액·배정 카드와 가격 탭 정합용.
 */
export function inferResidentFeesUsdForBalance(
  pricing: PricingBalanceFields & { total_price?: unknown; choices?: unknown },
  lineGrossWithoutResidentFees: number,
  extraResidentFeeUsd?: number | null
): number {
  const fromChoices = sumResidentFeesFromPricingChoicesJson(pricing.choices)

  /**
   * 고객 행 기준으로 거주 비용을 이미 집계한 경우(0원 포함) `total_price` 갭을 쓰지 않는다.
   * 갭은 추가할인·채널 환불(refund_amount)이 total_price에 아직 반영되지 않은
   * 레거시 행에서 그 차액을 비거주자 비용으로 오인하게 만든다.
   */
  if (extraResidentFeeUsd != null) {
    const extra = roundUsd2(Math.max(0, Number(extraResidentFeeUsd) || 0))
    return roundUsd2(Math.max(extra, fromChoices))
  }

  const line = roundUsd2(lineGrossWithoutResidentFees)
  const storedTotal = pricingFieldToNumber(pricing.total_price)
  const fromGap = storedTotal > line + 0.01 ? roundUsd2(storedTotal - line) : 0
  if (fromGap > 0.005) return fromGap
  if (fromChoices > 0.005) return fromChoices
  return 0
}

/** 레거시 예약 옵션(비거주자 비용 6941b5d0) — 거주 상태 금액으로 이전된 경우 option_total 이중 가산 방지 */
export function legacyNonResidentOptionAmountInRows(
  rows: Array<{ option_id?: string | null; total_price?: unknown; status?: string | null }> | null | undefined
): number {
  let sum = 0
  for (const row of rows || []) {
    const id = String(row.option_id ?? '').trim()
    if (id !== NON_RESIDENT_OPTION_ID) continue
    const st = String(row.status ?? 'active').toLowerCase()
    if (st === 'cancelled' || st === 'refunded') continue
    sum += paymentRecordAmountToNumber(row.total_price)
  }
  return roundUsd2(sum)
}

export function adjustOptionTotalExcludingLegacyNonResident(
  optionsTotal: number,
  residentFeeUsd: number,
  optionRows?: Array<{ option_id?: string | null; total_price?: unknown; status?: string | null }> | null
): number {
  if (residentFeeUsd <= 0.005 || !optionRows?.length) return optionsTotal
  const legacy = legacyNonResidentOptionAmountInRows(optionRows)
  if (legacy <= 0.005) return optionsTotal
  return roundUsd2(Math.max(0, optionsTotal - legacy))
}

/** 라인 산식 + 거주 상태별 현장 비용(비거주자 $100 등) */
export function computeCustomerPaymentLineGrossWithResidentFees(
  pricing: Parameters<typeof computeCustomerPaymentTotalLineFormula>[0] &
    PricingBalanceFields & { total_price?: unknown; choices?: unknown },
  party: PartySizeSource,
  extraResidentFeeUsd?: number | null
): number {
  const lineGross = roundUsd2(computeCustomerPaymentTotalLineFormula(pricing, party))
  return roundUsd2(
    lineGross + inferResidentFeesUsdForBalance(pricing, lineGross, extraResidentFeeUsd)
  )
}

/**
 * 선결제 팁(`prepayment_tip`) — 가이드 분배·수익 제외. 현장 잔액·배정 카드 지불/수령 산식에서는 제외.
 */
export function prepaymentTipUsdForBalance(
  pricing: Pick<PricingBalanceFields, 'prepayment_tip'>
): number {
  return roundUsd2(Math.max(0, pricingFieldToNumber(pricing.prepayment_tip)))
}

/** ② 잔액(계산)용 고객 총액 — 선결제 팁 제외 */
export function customerTotalDueForBalanceSettlement(
  pricing: Parameters<typeof computeCustomerPaymentLineGrossWithResidentFees>[0],
  party: PartySizeSource,
  extraResidentFeeUsd?: number | null
): number {
  const gross = computeCustomerPaymentLineGrossWithResidentFees(pricing, party, extraResidentFeeUsd)
  const prepTip = prepaymentTipUsdForBalance(pricing)
  return roundUsd2(Math.max(0, gross - prepTip))
}

/** 입금 보증금 순액에서 선결제 팁(이미 수령·가이드 분배) 분리 */
export function depositNetForBalanceSettlement(
  depositTotalNet: number,
  prepaymentTip: unknown
): number {
  const tip = roundUsd2(Math.max(0, pricingFieldToNumber(prepaymentTip)))
  const dep = Math.max(0, roundUsd2(Number(depositTotalNet) || 0))
  return roundUsd2(Math.max(0, dep - tip))
}

/** `reservation_customers` 인원으로 거주 현장 비용 추정 (choices·total_price에 없을 때) */
export function residentFeesUsdFromCustomerRows(
  rows: Array<{ resident_status?: string | null }> | null | undefined,
  amountOverrides?: Partial<Record<string, number>> | null
): number {
  const counts = countResidentLinesFromCustomers(rows)
  return sumResidentFeesFromResidentCounts(
    counts,
    amountOverrides as ResidentStatusCounts | undefined
  )
}

/**
 * 고객 인원·저장 금액·choices JSON 기준 거주 비용.
 * 고객 행/저장 금액이 있으면 `total_price` 갭은 쓰지 않는다 (추가할인·채널 환불과 혼동 방지).
 */
export function resolveResidentFeeUsdForBalanceDisplay(
  pricing:
    | (Parameters<typeof computeCustomerPaymentTotalLineFormula>[0] &
        PricingBalanceFields & { total_price?: unknown; choices?: unknown })
    | null
    | undefined,
  party: PartySizeSource,
  optionsTotalFromOptions: number | null,
  residentCounts: ResidentStatusCounts,
  residentStatusAmounts?: Partial<Record<string, number>> | null
): number {
  const fromCustomers = sumResidentFeesFromResidentCounts(
    residentCounts,
    residentStatusAmounts as ResidentStatusCounts | undefined
  )
  const fromStoredAmounts = sumResidentFeeAmountsUsd(
    residentStatusAmounts as Parameters<typeof sumResidentFeeAmountsUsd>[0]
  )
  const fromFees = roundUsd2(Math.max(fromCustomers, fromStoredAmounts))
  if (!pricing) return fromFees

  const optsOnly =
    optionsTotalFromOptions !== null && optionsTotalFromOptions !== undefined
  const pricingForLine = {
    ...pricing,
    required_option_total: optsOnly
      ? 0
      : (pricing as { required_option_total?: unknown }).required_option_total,
    option_total: optsOnly ? optionsTotalFromOptions : pricing.option_total,
  } as Parameters<typeof computeCustomerPaymentTotalLineFormula>[0]
  const lineGrossBase = computeCustomerPaymentTotalLineFormula(pricingForLine, party)
  return inferResidentFeesUsdForBalance(pricing, lineGrossBase, fromFees)
}

/**
 * 가격 정보 ④(Self·진행 예약): 고객 총 결제(넷) — 라인 산식 gross 후 Returned 초과분만 추가 차감
 * (`PricingSection` `calculateTotalCustomerPayment` 와 동일 원리)
 */
export function computeCustomerPaymentNetForCompanyRevenueBase(
  pricing: Parameters<typeof computeCustomerPaymentTotalLineFormula>[0],
  party: PartySizeSource,
  returnedAmount: number
): number {
  const gross = roundUsd2(computeCustomerPaymentTotalLineFormula(pricing, party))
  const manualRef = pricingFieldToNumber(
    (pricing as { refund_amount?: unknown }).refund_amount
  )
  const ret = Math.max(0, Number(returnedAmount) || 0)
  const returnedSurplus = Math.max(0, roundUsd2(ret - manualRef))
  return Math.max(0, roundUsd2(gross - returnedSurplus))
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
    pricingDiscountAmountMagnitude(pricing.coupon_discount) -
    pricingDiscountAmountMagnitude(pricing.additional_discount)
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
  party: PartySizeSource,
  extraResidentFeeUsd?: number | null
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
  const customerTotal = customerTotalDueForBalanceSettlement(
    pricingForLine,
    party,
    extraResidentFeeUsd
  )
  const deposit = depositNetForBalanceSettlement(
    pricingFieldToNumber(pricing.deposit_amount),
    pricing.prepayment_tip
  )
  return Math.max(0, roundUsd2(customerTotal - deposit))
}

export type GetBalanceDisplayOpts = {
  paymentRecords?: PaymentRecordLike[]
  /** 취소 예약은 잔액 0 (PricingSection displayedOnSiteBalance와 동일) */
  reservationStatus?: string | null
  /** 거주 상태별 인원·금액(비거주 $100 등) — DB choices/total_price에 없을 때 카드·배정 헤더용 */
  residentFeeUsd?: number | null
}

/**
 * `ReservationCard` fetchReservationPricing과 동일: `balance_amount` 비정상 문자열은 미설정으로 취급해
 * 배정 헤더 합계·카드 `getBalanceAmountForDisplay` 입력을 맞춤.
 */
export function withNormalizedBalanceAmountForDisplay(
  pricing: Record<string, unknown>
): PricingBalanceFields {
  const rawBal: unknown = pricing.balance_amount
  let balance_amount: unknown
  if (rawBal === null || rawBal === undefined || rawBal === '') {
    balance_amount = undefined
  } else if (typeof rawBal === 'string') {
    const n = parseFloat(rawBal)
    balance_amount = Number.isFinite(n) ? n : undefined
  } else {
    balance_amount = rawBal
  }
  return { ...pricing, balance_amount } as PricingBalanceFields
}

/**
 * 잔액 표시: 입금이 있으면 가격 정보 탭 `displayedOnSiteBalance`와 같은 식.
 * DB `balance_amount`와 계산값이 0.01 초과로 다르면 계산값 우선
 * (비거주자 비용 반영 후 DB 미동기화·구버전 sync 보정).
 */
function resolveBalanceDisplayAmount(
  storedNum: number,
  defaultBalance: number,
  depositAmount: number
): number {
  if (isPhantomNegativeOnSiteBalance(storedNum, depositAmount)) {
    return defaultBalance
  }
  if (storedNum < -0.005) {
    return roundUsd2(storedNum)
  }
  if (Math.abs(defaultBalance - storedNum) > 0.01) {
    return defaultBalance
  }
  if (Math.abs(storedNum) < 0.005 && Math.abs(defaultBalance) > 0.01) {
    return defaultBalance
  }
  return roundUsd2(storedNum)
}

export function getBalanceAmountForDisplay(
  pricing: PricingBalanceFields | null | undefined,
  optionsTotalFromOptions: number | null,
  party: PartySizeSource,
  opts?: GetBalanceDisplayOpts
): number {
  if (!pricing) return 0

  const excludeNotIncluded = isNotIncludedExcludedReservationStatus(opts?.reservationStatus)
  if (excludeNotIncluded) return 0

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
  const residentFeeUsd = opts?.residentFeeUsd
  const defaultBalanceNoRecords = computeRemainingBalanceAmount(
    pricingForLine,
    optionsTotalFromOptions,
    party,
    residentFeeUsd
  )

  if (records && records.length > 0) {
    const defaultBalance = computeDisplayedOnSiteBalanceLikePricingSection(
      pricingForLine,
      optionsTotalFromOptions,
      party,
      records,
      residentFeeUsd
    )

    const rawStored = pricing.balance_amount
    if (rawStored === undefined || rawStored === null || rawStored === '') {
      return defaultBalance
    }
    return resolveBalanceDisplayAmount(
      pricingFieldToNumber(rawStored),
      defaultBalance,
      pricingFieldToNumber(pricing.deposit_amount)
    )
  }

  const rawStoredNoRecords = pricing.balance_amount
  if (rawStoredNoRecords !== undefined && rawStoredNoRecords !== null && rawStoredNoRecords !== '') {
    return resolveBalanceDisplayAmount(
      pricingFieldToNumber(rawStoredNoRecords),
      defaultBalanceNoRecords,
      pricingFieldToNumber(pricing.deposit_amount)
    )
  }

  return defaultBalanceNoRecords
}
