/**
 * Balance 테이블「채널 정산」열 — PricingSection ④ 최종 매출 & `ChannelSettlementTab`과 동일 파이프라인.
 */

import type { Reservation } from '@/types/reservation'
import type { ReservationPricingMapValue } from '@/types/reservationPricingMap'
import { aggregateReservationOptionSumsByReservationId } from '@/lib/syncReservationPricingAggregates'
import type { ReservationOptionSumRow } from '@/lib/syncReservationPricingAggregates'
import { sumReservationOptionCancelledRefundTotals } from '@/utils/reservationOptionsShared'
import {
  computeRefundAmountForCompanyRevenueBlock,
  computeStoredCompanyRevenueFields,
} from '@/utils/storedCompanyRevenue'
import { isHomepageBookingChannel } from '@/utils/homepageBookingChannel'
import {
  pricingFieldToNumber,
  mergePricingWithLiveOptionTotal,
  summarizePaymentRecordsForBalance,
  isStoredCustomerTotalMismatchWithFormula,
  computeCustomerPaymentTotalLineFormula,
  type PaymentRecordLike,
} from '@/utils/reservationPricingBalance'
import {
  computeChannelPaymentAfterReturn,
  computeChannelSettlementAmount,
  computeCompanyTotalRevenueLikePricingSection,
  deriveCommissionGrossForSettlement,
  shouldOmitAdditionalDiscountAndCostFromCompanyRevenueSum,
  type ChannelSettlementComputeInput,
} from '@/utils/channelSettlement'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function totalBillingPax(r: Reservation): number {
  const n = (r.adults ?? 0) + (r.child ?? 0) + (r.infant ?? 0)
  return n > 0 ? n : 1
}

export function channelIsOtaForBalance(
  ch: { type?: string | null; category?: string | null } | undefined
): boolean {
  if (!ch) return false
  return (
    String(ch.type ?? '').toLowerCase() === 'ota' || String(ch.category ?? '') === 'OTA'
  )
}

export type BalanceChannelRowInput = {
  id: string
  favicon_url?: string | null
  sub_channels?: string[] | null
  type?: string | null
  category?: string | null
  name?: string | null
  commission_percent?: number | null
  commission_rate?: number | null
  commission?: number | null
}

/** 예약 channel_id가 본문 id 또는 부모의 sub_channels 항목일 때 마스터 행 탐색 */
export function findChannelRowForBalance(
  reservationChannelId: string,
  channels: BalanceChannelRowInput[]
): BalanceChannelRowInput | undefined {
  const idNorm = String(reservationChannelId ?? '').trim()
  if (!idNorm) return undefined
  const direct = channels.find((c) => String(c.id ?? '').trim() === idNorm)
  if (direct) return direct
  return channels.find((c) => {
    const subs = c.sub_channels
    if (!Array.isArray(subs)) return false
    return subs.some((s) => String(s ?? '').trim() === idNorm)
  })
}

/** PricingSection과 동일: `commission_percent` 우선, 없으면 `commission_rate`·`commission`(레거시 %) */
export function commissionPercentFromChannelMaster(
  ch:
    | {
        commission_percent?: number | null
        commission_rate?: number | null
        commission?: number | null
      }
    | undefined
): number | null {
  if (!ch) return null
  const raw = ch.commission_percent ?? ch.commission_rate ?? ch.commission
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'string' && String(raw).trim() === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return n
}

export type BalanceChannelMetrics = {
  /** `computeCompanyTotalRevenueLikePricingSection` / ④ 스냅샷용 */
  omitAdditionalDiscountAndCostFromCompanyRevenueSum: boolean
  /** DB 또는 산식으로 정한 정산 베이스(총매출 가산의 시작) */
  channelSettlementBaseForRevenue: number
  /** `computeChannelSettlementAmount`만 — DB와 비교용 */
  channelSettlementFromFormula: number
  companyTotalRevenue: number
  /** PricingSection ④: 총매출 − 선결제 팁 */
  operatingProfit: number
  /** `commission_base_price`와 동일 의미(DB 표시) */
  channelPaymentDb: number | null
  /** `computeChannelPaymentAfterReturn` + OTA Partner Received 상한 — 가격 정보 채널 결제 금액 산식과 동일 파이프라인 */
  channelPaymentFromFormula: number
  /** 저장된 reservation_pricing.commission_percent */
  commissionPercentDb: number | null
  /** 채널 마스터 기본 % — 산식 줄(없으면 null) */
  commissionPercentFromChannel: number | null
  /** 저장 commission_amount */
  commissionAmountDb: number | null
  /** 채널 결제(산식) × 채널 마스터 commission_percent — 채널에 % 없으면 null */
  commissionAmountFromFormula: number | null
}

/**
 * @param reservationOptionsSum — reservation_options 합(OTA 옵션 가산용), 없으면 pricing option_total
 */
export function computeBalanceChannelMetrics(
  p: ReservationPricingMapValue | undefined,
  reservation: Reservation,
  channels: BalanceChannelRowInput[],
  paymentRecords: PaymentRecordLike[],
  reservationOptionSumByReservationId: Map<string, number> | undefined
): BalanceChannelMetrics | null {
  if (!p) return null

  const cid = String(reservation.channelId ?? '').trim()
  const chRow = findChannelRowForBalance(cid, channels)
  const isOta = channelIsOtaForBalance(chRow)
  const isHomepage = isHomepageBookingChannel(reservation.channelId, channels)

  const pLine =
    (mergePricingWithLiveOptionTotal(p, reservation.id, reservationOptionSumByReservationId) as
      | ReservationPricingMapValue
      | undefined) ?? p

  const paySm = summarizePaymentRecordsForBalance(paymentRecords)
  const returnedAmount = paySm.returnedTotal
  const partnerReceived = paySm.partnerReceivedStrict
  const refundedOur = paySm.refundedTotal

  const billingPax = totalBillingPax(reservation)
  const notIncludedPer = pricingFieldToNumber(p.not_included_price)
  const notIncludedTotalUsd = round2(notIncludedPer * billingPax)
  const productTotalForSettlement = round2(
    pricingFieldToNumber(p.product_price_total) + notIncludedTotalUsd
  )

  const storedCb = pricingFieldToNumber(p.commission_base_price)
  const depositAmount = pricingFieldToNumber(p.deposit_amount)
  const onlineRaw = 0
  const onlineForSettlement =
    Math.abs(onlineRaw) > 0.005
      ? onlineRaw
      : deriveCommissionGrossForSettlement(storedCb, {
          returnedAmount,
          depositAmount,
          productPriceTotal: productTotalForSettlement,
          isOTAChannel: isOta,
        }) || storedCb

  const optionTotalSum = pricingFieldToNumber(pLine.option_total)

  const settlementInput: ChannelSettlementComputeInput = {
    depositAmount,
    onlinePaymentAmount: onlineForSettlement,
    productPriceTotal: productTotalForSettlement,
    couponDiscount: pricingFieldToNumber(p.coupon_discount),
    additionalDiscount: pricingFieldToNumber(p.additional_discount),
    optionTotalSum,
    additionalCost: pricingFieldToNumber(p.additional_cost),
    tax: pricingFieldToNumber(p.tax),
    cardFee: pricingFieldToNumber(p.card_fee),
    prepaymentTip: pricingFieldToNumber(p.prepayment_tip),
    onSiteBalanceAmount: pricingFieldToNumber(p.balance_amount),
    returnedAmount,
    partnerReceivedAmount: partnerReceived,
    commissionAmount: pricingFieldToNumber(p.commission_amount),
    reservationStatus: reservation.status,
    isOTAChannel: isOta,
  }

  let channelPaymentFromFormula = computeChannelPaymentAfterReturn(settlementInput)
  if (isOta && partnerReceived > 0 && channelPaymentFromFormula > partnerReceived + 0.005) {
    channelPaymentFromFormula = partnerReceived
  }
  channelPaymentFromFormula = round2(Math.max(0, channelPaymentFromFormula))

  const channelSettlementFromFormula = computeChannelSettlementAmount(settlementInput)

  const channelPaymentDb =
    p.commission_base_price != null && Number.isFinite(Number(p.commission_base_price))
      ? storedCb
      : null

  const commissionPercentDb =
    p.commission_percent != null && Number.isFinite(Number(p.commission_percent))
      ? Number(p.commission_percent)
      : null

  const commissionAmountDb =
    p.commission_amount != null && Number.isFinite(Number(p.commission_amount))
      ? pricingFieldToNumber(p.commission_amount)
      : null

  const masterCommissionPct = commissionPercentFromChannelMaster(chRow)
  let commissionPercentFromChannel: number | null = masterCommissionPct
  if (commissionPercentFromChannel == null && commissionPercentDb != null) {
    commissionPercentFromChannel = commissionPercentDb
  }
  if (
    commissionPercentFromChannel == null &&
    channelPaymentFromFormula > 0.005 &&
    commissionAmountDb != null &&
    commissionAmountDb > 0.005
  ) {
    const implied = round2((commissionAmountDb / channelPaymentFromFormula) * 100)
    if (Number.isFinite(implied) && implied > 0.005) {
      commissionPercentFromChannel = implied
    }
  }

  const commissionAmountFromFormula =
    commissionPercentFromChannel != null
      ? round2(channelPaymentFromFormula * (commissionPercentFromChannel / 100))
      : null

  const storedSettle = p.channel_settlement_amount
  const hasStoredSettle = storedSettle != null && Number.isFinite(Number(storedSettle))

  const channelSettlementBaseForRevenue = hasStoredSettle
    ? Math.max(0, Number(storedSettle))
    : channelSettlementFromFormula

  const st = String(reservation.status || '').toLowerCase().trim()
  const isReservationCancelled = st === 'cancelled' || st === 'canceled'

  const usesStored = hasStoredSettle
  let channelPaymentGrossDbLike = 0
  if (Number.isFinite(onlineRaw) && onlineRaw !== 0) {
    channelPaymentGrossDbLike = onlineRaw
  } else if (storedCb) {
    channelPaymentGrossDbLike = deriveCommissionGrossForSettlement(storedCb, {
      returnedAmount,
      depositAmount,
      productPriceTotal: productTotalForSettlement,
      isOTAChannel: isOta,
    })
  }

  const omitAdditionalDiscountAndCostFromSum =
    shouldOmitAdditionalDiscountAndCostFromCompanyRevenueSum({
      usesStoredChannelSettlement: usesStored,
      isOTAChannel: isOta,
      depositAmount,
      onlinePaymentAmount: onlineRaw,
      channelPaymentGross: channelPaymentGrossDbLike,
    })

  const reservationOptionsSum =
    reservationOptionSumByReservationId?.get(reservation.id) ?? optionTotalSum

  const companyTotalRevenue = computeCompanyTotalRevenueLikePricingSection({
    channelSettlementBase: channelSettlementBaseForRevenue,
    isOTAChannel: isOta,
    isReservationCancelled,
    reservationOptionsTotalPrice: isOta ? reservationOptionsSum : 0,
    notIncludedTotalUsd,
    additionalDiscount: pricingFieldToNumber(p.additional_discount),
    additionalCost: pricingFieldToNumber(p.additional_cost),
    tax: pricingFieldToNumber(p.tax),
    prepaymentCost: pricingFieldToNumber(p.prepayment_cost),
    refundedOurAmount: refundedOur,
    omitAdditionalDiscountAndCostFromSum,
    excludeHomepageAdditionalCostFromCompanyTotals: isHomepage,
  })

  const prepTip = pricingFieldToNumber(p.prepayment_tip)
  const operatingProfit = round2(Math.max(0, companyTotalRevenue - prepTip))

  return {
    omitAdditionalDiscountAndCostFromCompanyRevenueSum: omitAdditionalDiscountAndCostFromSum,
    channelSettlementBaseForRevenue,
    channelSettlementFromFormula,
    companyTotalRevenue,
    operatingProfit,
    channelPaymentDb,
    channelPaymentFromFormula,
    commissionPercentDb,
    commissionPercentFromChannel,
    commissionAmountDb,
    commissionAmountFromFormula,
  }
}

/**
 * `reservation_pricing`에 저장할 ④ 최종 매출·운영이익 — 가격 정보 UI `companyViewRevenueLedger`와 동일 산식.
 * (채널 정산 베이스·omit은 `computeBalanceChannelMetrics`와 맞춤)
 */
export function computeReservationPricingStoredRevenueColumns(
  p: ReservationPricingMapValue,
  reservation: Reservation,
  channels: BalanceChannelRowInput[],
  paymentRecords: PaymentRecordLike[],
  reservationOptionRows: ReservationOptionSumRow[],
  reservationOptionSumByReservationId?: Map<string, number>
): { company_total_revenue: number; operating_profit: number } | null {
  const optMapFromRows = aggregateReservationOptionSumsByReservationId(reservationOptionRows)
  const mergedOptMap = new Map<string, number>(reservationOptionSumByReservationId ?? [])
  for (const [k, v] of optMapFromRows) {
    mergedOptMap.set(k, v)
  }
  const pLine =
    (mergePricingWithLiveOptionTotal(p, reservation.id, mergedOptMap) as
      | ReservationPricingMapValue
      | undefined) ?? p
  const m = computeBalanceChannelMetrics(pLine, reservation, channels, paymentRecords, mergedOptMap)
  if (!m) return null

  const paySm = summarizePaymentRecordsForBalance(paymentRecords)
  const returnedAmount = paySm.returnedTotal
  const activeSum = mergedOptMap.get(reservation.id) ?? 0
  const optionCancelRefundUsd = sumReservationOptionCancelledRefundTotals(
    reservationOptionRows as Array<{ status?: string | null; total_price?: number | null }>
  )
  const chRow = findChannelRowForBalance(String(reservation.channelId ?? '').trim(), channels)
  const isOta = channelIsOtaForBalance(chRow)
  const refundForRevenue = computeRefundAmountForCompanyRevenueBlock({
    refundedFromRecords: paySm.refundedTotal,
    reservationOptionsActiveSum: activeSum,
    optionCancelRefundUsd,
    manualRefundAmount: pricingFieldToNumber(pLine.refund_amount),
    isOTAChannel: isOta,
    returnedAmount,
  })

  const pricingAdultsVal = Math.max(
    0,
    Math.floor(
      Number(
        (pLine as { pricing_adults?: number | null }).pricing_adults ?? reservation.adults ?? 0
      ) || 0
    )
  )

  return computeStoredCompanyRevenueFields({
    channelSettlementBase: m.channelSettlementBaseForRevenue,
    reservationStatus: reservation.status,
    isOTAChannel: isOta,
    isHomepageBooking: isHomepageBookingChannel(reservation.channelId, channels),
    reservationOptionsActiveSum: activeSum,
    omitCtx: {
      usesStoredChannelSettlement: false,
      depositAmount: 0,
      onlinePaymentAmount: 0,
      channelPaymentGross: 0,
    },
    omitAdditionalDiscountAndCostFromSumOverride: m.omitAdditionalDiscountAndCostFromCompanyRevenueSum,
    notIncludedPerPerson: pricingFieldToNumber(pLine.not_included_price),
    pricingAdults: pricingAdultsVal,
    child: reservation.child ?? 0,
    infant: reservation.infant ?? 0,
    additionalDiscount: pricingFieldToNumber(pLine.additional_discount),
    additionalCost: pricingFieldToNumber(pLine.additional_cost),
    tax: pricingFieldToNumber(pLine.tax),
    prepaymentCost: pricingFieldToNumber(pLine.prepayment_cost),
    prepaymentTip: pricingFieldToNumber(pLine.prepayment_tip),
    refundAmountForCompanyRevenueBlock: refundForRevenue,
  })
}

/**
 * 예약 처리 필요「② 총액·채널 결제·정산 불일치」탭 — 고객 총액·채널 결제·수수료·정산을 가격 정보와 동일 산식으로 한 번에 DB 반영.
 * `company_total_revenue`·`operating_profit` 컬럼도 동일 ④ 산식으로 함께 채운다.
 */
export function buildReservationPricingMismatchFormulaPatch(
  r: Reservation,
  p: ReservationPricingMapValue,
  reservationOptionSumByReservationId: Map<string, number> | undefined,
  records: PaymentRecordLike[],
  channels: BalanceChannelRowInput[]
): Record<string, number> | null {
  const party = { adults: r.adults, children: r.child, infants: r.infant }
  const pForGross =
    (mergePricingWithLiveOptionTotal(p, r.id, reservationOptionSumByReservationId) as
      | ReservationPricingMapValue
      | undefined) ?? p

  const m = computeBalanceChannelMetrics(p, r, channels, records, reservationOptionSumByReservationId)
  if (!m) return null

  const gross = round2(computeCustomerPaymentTotalLineFormula(pForGross, party))
  const pay = m.channelPaymentFromFormula

  const cid = String(r.channelId ?? '').trim()
  const chRow = findChannelRowForBalance(cid, channels)
  const masterPct = commissionPercentFromChannelMaster(chRow)

  let feeUsd: number
  if (masterPct != null) {
    feeUsd = round2(pay * (masterPct / 100))
  } else if (m.commissionAmountFromFormula != null) {
    feeUsd = round2(m.commissionAmountFromFormula)
  } else {
    feeUsd = pricingFieldToNumber(p.commission_amount)
  }

  const settlement = round2(Math.max(0, pay - feeUsd))

  const patch: Record<string, number> = {
    total_price: gross,
    commission_base_price: round2(pay),
    channel_settlement_amount: settlement,
  }

  if (masterPct != null) {
    patch.commission_percent = round2(masterPct)
  }

  if (masterPct != null || m.commissionAmountFromFormula != null) {
    patch.commission_amount = feeUsd
  }

  const pMerged = { ...p, ...patch } as ReservationPricingMapValue
  const stored = computeReservationPricingStoredRevenueColumns(
    pMerged,
    r,
    channels,
    records,
    [],
    reservationOptionSumByReservationId
  )
  if (stored) {
    patch.company_total_revenue = stored.company_total_revenue
    patch.operating_profit = stored.operating_profit
  }

  return patch
}

const PRICING_LINE_MISMATCH_TOL = 0.01

/** Balance 테이블과 동일: 채널 결제(DB) vs 산식 */
export function hasChannelPaymentStoredVsFormulaMismatch(
  p: ReservationPricingMapValue | undefined,
  reservation: Reservation,
  channels: BalanceChannelRowInput[],
  paymentRecords: PaymentRecordLike[],
  reservationOptionSumByReservationId: Map<string, number> | undefined
): boolean {
  if (!p) return false
  const m = computeBalanceChannelMetrics(
    p,
    reservation,
    channels,
    paymentRecords,
    reservationOptionSumByReservationId
  )
  if (!m) return false
  const formula = m.channelPaymentFromFormula
  if (formula == null) return false
  const db = m.channelPaymentDb
  if (db == null) return true
  return Math.abs(db - formula) > PRICING_LINE_MISMATCH_TOL
}

/** Balance 테이블과 동일: 채널 정산(DB) vs 산식 */
export function hasChannelSettlementStoredVsFormulaMismatch(
  p: ReservationPricingMapValue | undefined,
  reservation: Reservation,
  channels: BalanceChannelRowInput[],
  paymentRecords: PaymentRecordLike[],
  reservationOptionSumByReservationId: Map<string, number> | undefined
): boolean {
  if (!p) return false
  const m = computeBalanceChannelMetrics(
    p,
    reservation,
    channels,
    paymentRecords,
    reservationOptionSumByReservationId
  )
  if (!m) return false
  const dbChannelSettlement =
    p.channel_settlement_amount != null &&
    Number.isFinite(Number(p.channel_settlement_amount))
      ? pricingFieldToNumber(p.channel_settlement_amount)
      : null
  const channelSettlementFormula = m.channelSettlementFromFormula ?? null
  return (
    channelSettlementFormula != null &&
    (dbChannelSettlement == null ||
      Math.abs(dbChannelSettlement - channelSettlementFormula) > PRICING_LINE_MISMATCH_TOL)
  )
}

/**
 * 예약 가격 ② 불일치 탭·밸런스 필터 공통:
 * 총액(DB vs 라인 산식) 또는 채널 결제·채널 정산(DB vs 산식) 중 하나라도 어긋나면 true.
 */
export function reservationMatchesExtendedPricingMismatchCriteria(
  reservation: Reservation,
  pricingMap: Map<string, ReservationPricingMapValue>,
  channels: BalanceChannelRowInput[],
  paymentRecordsByReservationId: Map<string, PaymentRecordLike[]> | undefined,
  reservationOptionSumByReservationId: Map<string, number> | undefined
): boolean {
  const p = pricingMap.get(reservation.id)
  const hasPricing = !!(p && p.total_price != null && Number(p.total_price) > 0)
  if (!hasPricing || !p) return false

  const party = {
    adults: reservation.adults,
    children: reservation.child,
    infants: reservation.infant,
  }
  const pLine = mergePricingWithLiveOptionTotal(
    p,
    reservation.id,
    reservationOptionSumByReservationId
  )
  if (isStoredCustomerTotalMismatchWithFormula(party, pLine)) return true

  const records = paymentRecordsByReservationId?.get(reservation.id) ?? []
  if (
    hasChannelPaymentStoredVsFormulaMismatch(
      p,
      reservation,
      channels,
      records,
      reservationOptionSumByReservationId
    )
  )
    return true
  if (
    hasChannelSettlementStoredVsFormulaMismatch(
      p,
      reservation,
      channels,
      records,
      reservationOptionSumByReservationId
    )
  )
    return true
  return false
}
