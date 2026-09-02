import type { Reservation } from '@/types/reservation'
import type { ReservationPricingMapValue } from '@/types/reservationPricingMap'
import { supabase, isAbortLikeError } from '@/lib/supabase'
import { buildPricingEngineContext } from '@/lib/pricingEngine/buildContext'
import { computeReservationPricing } from '@/lib/pricingEngine/compute'
import type { PricingProfileId, ReservationPricingResult } from '@/lib/pricingEngine/types'
import { channelIsOtaForPricingSection } from '@/utils/channelSettlement'
import {
  commissionPercentFromChannelMaster,
  computeBalanceChannelMetrics,
  computeChannelCommissionAmountUsd,
  computeReservationPricingStoredRevenueColumns,
  findChannelRowForBalance,
  type BalanceChannelRowInput,
} from '@/utils/balanceChannelRevenue'
import { isHomepageBookingChannel } from '@/utils/homepageBookingChannel'
import {
  balanceOutstandingTotalMinusDeposit,
  computeCustomerPaymentTotalLineFormula,
  computeDisplayedOnSiteBalanceLikePricingSection,
  mergePricingWithLiveOptionTotal,
  normalizeReservationIdForPayments,
  pricingDiscountAmountMagnitude,
  pricingFieldToNumber,
  resolvePaymentRecordsForReservation,
  summarizePaymentRecordsForBalance,
  type PaymentRecordLike,
} from '@/utils/reservationPricingBalance'
import {
  isCancelledReservationStatus,
} from '@/lib/reservationStatus'

const MATCH_EPS = 0.02

function resolveReservationExpensesTotal(
  reservationId: string,
  reservationExpenseSumByReservationId: Map<string, number> | undefined
): number {
  if (!reservationExpenseSumByReservationId) return 0
  const rid = normalizeReservationIdForPayments(reservationId)
  return (
    reservationExpenseSumByReservationId.get(rid) ??
    reservationExpenseSumByReservationId.get(reservationId) ??
    0
  )
}

function roundUsd2(n: number): number {
  return Math.round(n * 100) / 100
}

function fieldNum(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? roundUsd2(n) : null
}

export type EngineDbFieldKey =
  | 'total_price'
  | 'balance_amount'
  | 'commission_base_price'
  | 'channel_settlement_amount'
  | 'commission_amount'
  | 'company_total_revenue'
  | 'operating_profit'

export type EnginePatchFieldKey = EngineDbFieldKey | 'commission_percent'

export type LegacyPricingSnapshot = Record<EngineDbFieldKey, number>

export type EngineFieldComparison = {
  key: EngineDbFieldKey
  labelKo: string
  labelEn: string
  dbColumn: string
  dbValue: number | null
  /** Balance·가격 정보 기존 산식 */
  legacyValue: number | null
  engineValue: number
  deltaDbVsEngine: number
  deltaLegacyVsEngine: number
  /** DB ≈ 엔진 */
  matchDb: boolean
  /** 기존 산식 ≈ 엔진 */
  matchLegacy: boolean
}

export type EngineApplyPreviewRow = {
  key: EnginePatchFieldKey
  labelKo: string
  labelEn: string
  dbColumn: string
  dbValue: number | null
  legacyValue: number | null
  engineValue: number
  applyValue: number
  includedInApply: boolean
  includeReason: 'selected' | 'cascade' | null
}

export type ReservationPricingAnalysis = {
  reservationId: string
  profile: PricingProfileId
  profileLabelKo: string
  profileLabelEn: string
  hasPricing: boolean
  mismatchCount: number
  allMatch: boolean
  fields: EngineFieldComparison[]
  legacy: LegacyPricingSnapshot
  engine: ReservationPricingResult
}

const FIELD_DEFS: Array<{
  key: EngineDbFieldKey
  labelKo: string
  labelEn: string
  dbColumn: string
  pickDb: (p: ReservationPricingMapValue) => number | null
  pickLegacy: (l: LegacyPricingSnapshot) => number
  pickEngine: (e: ReservationPricingResult) => number
}> = [
  {
    key: 'total_price',
    labelKo: '고객 총 결제',
    labelEn: 'Customer total',
    dbColumn: 'total_price',
    pickDb: (p) => fieldNum(p.total_price),
    pickLegacy: (l) => l.total_price,
    pickEngine: (e) => e.totals.customerPaymentNet,
  },
  {
    key: 'balance_amount',
    labelKo: '잔액',
    labelEn: 'Balance due',
    dbColumn: 'balance_amount',
    pickDb: (p) => fieldNum(p.balance_amount),
    pickLegacy: (l) => l.balance_amount,
    pickEngine: (e) => e.totals.onSiteBalance,
  },
  {
    key: 'commission_base_price',
    labelKo: '채널 결제',
    labelEn: 'Channel payment',
    dbColumn: 'commission_base_price',
    pickDb: (p) => fieldNum(p.commission_base_price),
    pickLegacy: (l) => l.commission_base_price,
    pickEngine: (e) => e.totals.channelPaymentNet,
  },
  {
    key: 'channel_settlement_amount',
    labelKo: '채널 정산',
    labelEn: 'Channel settlement',
    dbColumn: 'channel_settlement_amount',
    pickDb: (p) => fieldNum(p.channel_settlement_amount),
    pickLegacy: (l) => l.channel_settlement_amount,
    pickEngine: (e) => e.totals.channelSettlement,
  },
  {
    key: 'commission_amount',
    labelKo: '채널 수수료',
    labelEn: 'Commission',
    dbColumn: 'commission_amount',
    pickDb: (p) => fieldNum(p.commission_amount),
    pickLegacy: (l) => l.commission_amount,
    pickEngine: (e) =>
      roundUsd2(Math.max(0, e.totals.channelPaymentNet - e.totals.channelSettlement)),
  },
  {
    key: 'company_total_revenue',
    labelKo: '총 매출',
    labelEn: 'Total revenue',
    dbColumn: 'company_total_revenue',
    pickDb: (p) => fieldNum(p.company_total_revenue),
    pickLegacy: (l) => l.company_total_revenue,
    pickEngine: (e) => e.totals.companyTotalRevenue,
  },
  {
    key: 'operating_profit',
    labelKo: '운영 이익',
    labelEn: 'Operating profit',
    dbColumn: 'operating_profit',
    pickDb: (p) => fieldNum(p.operating_profit),
    pickLegacy: (l) => l.operating_profit,
    pickEngine: (e) => e.totals.operatingProfit,
  },
]

const CUSTOMER_GROUP: EngineDbFieldKey[] = ['total_price', 'balance_amount']
const CHANNEL_GROUP: EngineDbFieldKey[] = [
  'commission_base_price',
  'commission_amount',
  'channel_settlement_amount',
]
const REVENUE_GROUP: EngineDbFieldKey[] = ['company_total_revenue', 'operating_profit']

/** 선택 필드 → 연쇄 반영 대상 확장 */
export function expandEngineApplyFieldKeys(
  selected: EngineDbFieldKey[]
): Set<EnginePatchFieldKey> {
  const out = new Set<EnginePatchFieldKey>()
  if (selected.length === 0) return out

  for (const k of selected) {
    out.add(k)
  }

  const touchesCustomer = selected.some((k) => CUSTOMER_GROUP.includes(k))
  const touchesChannel = selected.some((k) => CHANNEL_GROUP.includes(k))
  const touchesRevenue = selected.some((k) => REVENUE_GROUP.includes(k))

  if (touchesCustomer) {
    for (const k of CUSTOMER_GROUP) out.add(k)
  }
  if (touchesChannel) {
    for (const k of CHANNEL_GROUP) out.add(k)
    out.add('commission_percent')
  }
  if (touchesCustomer || touchesChannel || touchesRevenue) {
    for (const k of REVENUE_GROUP) out.add(k)
  }

  return out
}

export function buildEngineContextFromReservation(
  reservation: Reservation,
  pricing: ReservationPricingMapValue,
  channels: BalanceChannelRowInput[],
  paymentRecords: PaymentRecordLike[],
  reservationOptionSumByReservationId: Map<string, number> | undefined,
  reservationExpenseSumByReservationId?: Map<string, number> | undefined
): ReturnType<typeof buildPricingEngineContext> {
  const pLine =
    (mergePricingWithLiveOptionTotal(
      pricing,
      reservation.id,
      reservationOptionSumByReservationId
    ) as ReservationPricingMapValue | undefined) ?? pricing

  const cid = String(reservation.channelId ?? '').trim()
  const chRow = findChannelRowForBalance(cid, channels)
  const isOta = channelIsOtaForPricingSection(chRow)
  const isHomepage = isHomepageBookingChannel(reservation.channelId, channels)

  const adults = reservation.adults ?? 0
  const children = reservation.child ?? 0
  const infants = reservation.infant ?? 0
  const billingPax = adults + children + infants || 1
  const notIncludedPer = pricingFieldToNumber(pLine.not_included_price)
  const notIncludedTotalUsd = roundUsd2(notIncludedPer * billingPax)
  const optsSum =
    reservationOptionSumByReservationId?.get(reservation.id) ??
    pricingFieldToNumber(pLine.option_total)

  const paySm = summarizePaymentRecordsForBalance(paymentRecords)
  const storedSettle = fieldNum(pLine.channel_settlement_amount)

  return buildPricingEngineContext({
    reservationStatus: reservation.status,
    channelId: reservation.channelId,
    isOtaChannel: isOta,
    isHomepageBooking: isHomepage,
    adults,
    children,
    infants,
    pricingAdults: Math.max(
      0,
      Math.floor(Number((pLine as { pricing_adults?: number }).pricing_adults ?? adults) || 0)
    ),
    productPriceTotal: pricingFieldToNumber(pLine.product_price_total),
    adultProductPrice: pricingFieldToNumber(pLine.adult_product_price),
    childProductPrice: pricingFieldToNumber(pLine.child_product_price),
    infantProductPrice: pricingFieldToNumber(pLine.infant_product_price),
    couponDiscount: pricingDiscountAmountMagnitude(pLine.coupon_discount),
    additionalDiscount: pricingDiscountAmountMagnitude(pLine.additional_discount),
    additionalCost: pricingFieldToNumber(pLine.additional_cost),
    tax: pricingFieldToNumber(pLine.tax),
    cardFee: pricingFieldToNumber(pLine.card_fee),
    prepaymentCost: pricingFieldToNumber(pLine.prepayment_cost),
    prepaymentTip: pricingFieldToNumber(pLine.prepayment_tip),
    manualRefundAmount: pricingFieldToNumber(pLine.refund_amount),
    privateTourAdditionalCost: pricingFieldToNumber(pLine.private_tour_additional_cost),
    reservationOptionsTotal: optsSum,
    requiredOptionTotal: pricingFieldToNumber(pLine.required_option_total),
    optionTotal: pricingFieldToNumber(pLine.option_total),
    notIncludedTotalUsd,
    notIncludedBaseUsd: notIncludedTotalUsd,
    notIncludedResidentFeesUsd: 0,
    depositAmount: pricingFieldToNumber(pLine.deposit_amount),
    onlinePaymentAmount: 0,
    commissionAmount: pricingFieldToNumber(pLine.commission_amount),
    commissionPercent: pricingFieldToNumber(pLine.commission_percent),
    commissionBasePriceStored: fieldNum(pLine.commission_base_price),
    channelSettlementAmountStored: storedSettle,
    balanceAmountStored: fieldNum(pLine.balance_amount),
    totalPriceStored: fieldNum(pLine.total_price),
    /** 비교 탭 엔진(기준)은 DB 저장 정산값이 아니라 산식 결과를 사용 */
    usesStoredChannelSettlement: false,
    channelPricingFieldsUserEdited: false,
    paymentRecords,
    reservationExpensesTotal: resolveReservationExpensesTotal(
      reservation.id,
      reservationExpenseSumByReservationId
    ),
    optionCancelRefundUsd: 0,
    tourExpensesTotal: 0,
    partnerReceivedAmount: paySm.partnerReceivedStrict,
  })
}

/** Balance·가격 정보와 동일한 기존 산식 스냅샷 */
export function computeLegacyPricingSnapshot(
  reservation: Reservation,
  pricing: ReservationPricingMapValue,
  channels: BalanceChannelRowInput[],
  paymentRecords: PaymentRecordLike[],
  reservationOptionSumByReservationId: Map<string, number> | undefined,
  reservationExpenseSumByReservationId?: Map<string, number> | undefined
): LegacyPricingSnapshot {
  const party = {
    adults: reservation.adults ?? 0,
    children: reservation.child ?? 0,
    infants: reservation.infant ?? 0,
  }
  const pLine =
    (mergePricingWithLiveOptionTotal(
      pricing,
      reservation.id,
      reservationOptionSumByReservationId
    ) as ReservationPricingMapValue | undefined) ?? pricing

  const gross = roundUsd2(computeCustomerPaymentTotalLineFormula(pLine, party))
  const cancelled = isCancelledReservationStatus(reservation.status)
  const rid = normalizeReservationIdForPayments(reservation.id)
  const optsSum =
    reservationOptionSumByReservationId?.get(rid) ??
    reservationOptionSumByReservationId?.get(reservation.id) ??
    null
  const balance =
    !cancelled && paymentRecords.length > 0
      ? computeDisplayedOnSiteBalanceLikePricingSection(pLine, optsSum, party, paymentRecords)
      : balanceOutstandingTotalMinusDeposit(
          gross,
          paymentRecords,
          pricingFieldToNumber(pLine.deposit_amount),
          cancelled
        )

  const expenseTotal = resolveReservationExpensesTotal(
    reservation.id,
    reservationExpenseSumByReservationId
  )

  const m = computeBalanceChannelMetrics(
    pLine,
    reservation,
    channels,
    paymentRecords,
    reservationOptionSumByReservationId,
    expenseTotal
  )

  const channelPay = roundUsd2(m?.channelPaymentFromFormula ?? 0)
  const channelSettle = roundUsd2(m?.channelSettlementFromFormula ?? 0)
  const commission =
    m?.commissionAmountFromFormula != null
      ? roundUsd2(m.commissionAmountFromFormula)
      : roundUsd2(Math.max(0, channelPay - channelSettle))

  const storedRev = computeReservationPricingStoredRevenueColumns(
    pLine,
    reservation,
    channels,
    paymentRecords,
    [],
    reservationOptionSumByReservationId,
    expenseTotal
  )

  return {
    total_price: gross,
    balance_amount: roundUsd2(balance),
    commission_base_price: channelPay,
    channel_settlement_amount: channelSettle,
    commission_amount: commission,
    company_total_revenue: roundUsd2(storedRev?.company_total_revenue ?? 0),
    operating_profit: roundUsd2(storedRev?.operating_profit ?? 0),
  }
}

export const ENGINE_DB_PRICING_COLUMNS =
  'reservation_id, total_price, balance_amount, commission_base_price, channel_settlement_amount, commission_amount, company_total_revenue, operating_profit' as const

function mapDbStoredPricingRow(p: Record<string, unknown>): ReservationPricingMapValue {
  const companyTotalRevenue =
    p.company_total_revenue === null || p.company_total_revenue === undefined
      ? undefined
      : fieldNum(p.company_total_revenue) ?? undefined
  const operatingProfit =
    p.operating_profit === null || p.operating_profit === undefined
      ? undefined
      : fieldNum(p.operating_profit) ?? undefined
  return {
    total_price: fieldNum(p.total_price) ?? 0,
    balance_amount: fieldNum(p.balance_amount) ?? 0,
    commission_base_price: fieldNum(p.commission_base_price) ?? 0,
    channel_settlement_amount: fieldNum(p.channel_settlement_amount) ?? 0,
    commission_amount: fieldNum(p.commission_amount) ?? 0,
    ...(companyTotalRevenue !== undefined ? { company_total_revenue: companyTotalRevenue } : {}),
    ...(operatingProfit !== undefined ? { operating_profit: operatingProfit } : {}),
    currency: 'USD',
  }
}

/** 가격 정보 모달과 동일 — `reservation_pricing` DB 저장 컬럼만 직접 조회(목록 맵·캐시와 분리) */
export async function fetchReservationPricingDbStoredMap(
  reservationIds: string[]
): Promise<Map<string, ReservationPricingMapValue>> {
  const unique = [...new Set(reservationIds.map((id) => String(id ?? '').trim()).filter(Boolean))]
  const map = new Map<string, ReservationPricingMapValue>()
  if (unique.length === 0) return map

  const chunkSize = 200
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from('reservation_pricing')
      .select(ENGINE_DB_PRICING_COLUMNS)
      .in('reservation_id', chunk)

    if (error && !isAbortLikeError(error)) {
      console.warn('[pricing-engine] DB snapshot fetch error:', error.message)
      continue
    }

    for (const row of data ?? []) {
      const rid = String((row as { reservation_id?: string }).reservation_id ?? '').trim()
      if (!rid) continue
      map.set(rid, mapDbStoredPricingRow(row as Record<string, unknown>))
    }
  }
  return map
}

export function analyzeReservationPricingEngine(
  reservation: Reservation,
  pricing: ReservationPricingMapValue | undefined,
  channels: BalanceChannelRowInput[],
  paymentRecords: PaymentRecordLike[],
  reservationOptionSumByReservationId: Map<string, number> | undefined,
  reservationExpenseSumByReservationId?: Map<string, number> | undefined,
  /** DB 비교열 전용 — 없으면 pricing 맵(목록 캐시) 사용 */
  dbStoredPricing?: ReservationPricingMapValue | undefined
): ReservationPricingAnalysis | null {
  if (!pricing) return null
  const hasPricing = pricing.total_price != null && Number(pricing.total_price) > 0
  if (!hasPricing) return null

  const legacy = computeLegacyPricingSnapshot(
    reservation,
    pricing,
    channels,
    paymentRecords,
    reservationOptionSumByReservationId,
    reservationExpenseSumByReservationId
  )

  const ctx = buildEngineContextFromReservation(
    reservation,
    pricing,
    channels,
    paymentRecords,
    reservationOptionSumByReservationId,
    reservationExpenseSumByReservationId
  )
  const engine = computeReservationPricing(ctx)

  const dbLine = dbStoredPricing ?? pricing

  const fields: EngineFieldComparison[] = FIELD_DEFS.map((def) => {
    const dbValue = def.pickDb(dbLine)
    const legacyValue = roundUsd2(def.pickLegacy(legacy))
    const engineValue = roundUsd2(def.pickEngine(engine))
    const deltaDbVsEngine = roundUsd2(engineValue - (dbValue ?? 0))
    const deltaLegacyVsEngine = roundUsd2(engineValue - legacyValue)
    const matchDb =
      dbValue != null && Math.abs(dbValue - engineValue) <= MATCH_EPS
    const matchLegacy = Math.abs(legacyValue - engineValue) <= MATCH_EPS
    return {
      key: def.key,
      labelKo: def.labelKo,
      labelEn: def.labelEn,
      dbColumn: def.dbColumn,
      dbValue,
      legacyValue,
      engineValue,
      deltaDbVsEngine,
      deltaLegacyVsEngine,
      matchDb,
      matchLegacy,
    }
  })

  const mismatchCount = fields.filter((f) => !f.matchDb).length

  return {
    reservationId: reservation.id,
    profile: engine.profile,
    profileLabelKo: engine.profileLabelKo,
    profileLabelEn: engine.profileLabelEn,
    hasPricing: true,
    mismatchCount,
    allMatch: mismatchCount === 0,
    fields,
    legacy,
    engine,
  }
}

export function reservationMatchesEngineMismatchCriteria(
  reservation: Reservation,
  pricingMap: Map<string, ReservationPricingMapValue>,
  channels: BalanceChannelRowInput[],
  paymentRecordsByReservationId: Map<string, PaymentRecordLike[]> | undefined,
  reservationOptionSumByReservationId: Map<string, number> | undefined,
  reservationExpenseSumByReservationId?: Map<string, number> | undefined,
  dbStoredPricingByReservationId?: Map<string, ReservationPricingMapValue> | undefined
): boolean {
  const p = pricingMap.get(reservation.id)
  const records = resolvePaymentRecordsForReservation(
    paymentRecordsByReservationId,
    reservation.id
  )
  const rid = normalizeReservationIdForPayments(reservation.id)
  const analysis = analyzeReservationPricingEngine(
    reservation,
    p,
    channels,
    records,
    reservationOptionSumByReservationId,
    reservationExpenseSumByReservationId,
    dbStoredPricingByReservationId?.get(rid) ??
      dbStoredPricingByReservationId?.get(reservation.id)
  )
  if (!analysis) return false
  return analysis.fields.some((f) => !f.matchDb)
}

/** 선택·연쇄 포함 적용 미리보기 */
export function buildEngineApplyPreview(
  analysis: ReservationPricingAnalysis,
  selectedKeys: EngineDbFieldKey[],
  opts: {
    reservation: Reservation
    channels: BalanceChannelRowInput[]
    pricing: ReservationPricingMapValue
    paymentRecords: PaymentRecordLike[]
    reservationOptionSumByReservationId: Map<string, number> | undefined
  }
): { patch: Record<string, number>; rows: EngineApplyPreviewRow[] } {
  const expanded = expandEngineApplyFieldKeys(selectedKeys)
  const selectedSet = new Set(selectedKeys)

  const enginePatch = buildReservationPricingEnginePatch(analysis, expanded, opts)

  const patch: Record<string, number> = { ...enginePatch }

  const rows: EngineApplyPreviewRow[] = []

  for (const def of FIELD_DEFS) {
    const field = analysis.fields.find((f) => f.key === def.key)!
    const inApply = expanded.has(def.key)
    const applyValue = inApply ? field.engineValue : field.dbValue ?? field.engineValue
    rows.push({
      key: def.key,
      labelKo: def.labelKo,
      labelEn: def.labelEn,
      dbColumn: def.dbColumn,
      dbValue: field.dbValue,
      legacyValue: field.legacyValue,
      engineValue: field.engineValue,
      applyValue,
      includedInApply: inApply,
      includeReason: inApply
        ? selectedSet.has(def.key)
          ? 'selected'
          : 'cascade'
        : null,
    })
    if (inApply) {
      patch[def.key] = field.engineValue
    }
  }

  if (expanded.has('commission_percent')) {
    const chRow = findChannelRowForBalance(
      String(opts.reservation.channelId ?? '').trim(),
      opts.channels
    )
    const masterPct = commissionPercentFromChannelMaster(chRow)
    const pct =
      masterPct != null
        ? roundUsd2(masterPct)
        : fieldNum(opts.pricing.commission_percent) ?? 0
    if (pct > 0.005) {
      patch.commission_percent = pct
      rows.push({
        key: 'commission_percent',
        labelKo: '채널 수수료 %',
        labelEn: 'Commission %',
        dbColumn: 'commission_percent',
        dbValue: fieldNum(opts.pricing.commission_percent),
        legacyValue: fieldNum(opts.pricing.commission_percent),
        engineValue: pct,
        applyValue: pct,
        includedInApply: true,
        includeReason: selectedSet.has('commission_amount') ||
          selectedSet.has('commission_base_price') ||
          selectedSet.has('channel_settlement_amount')
          ? 'cascade'
          : 'selected',
      })
    }
  }

  return { patch, rows }
}

/** 새 엔진 기준 DB 패치 — 선택 필드 + 연쇄 */
export function buildReservationPricingEnginePatch(
  analysis: ReservationPricingAnalysis,
  fieldKeys?: EngineDbFieldKey[] | Set<EnginePatchFieldKey>,
  opts?: {
    reservation: Reservation
    channels: BalanceChannelRowInput[]
    pricing: ReservationPricingMapValue
  }
): Record<string, number> {
  const rawKeys =
    fieldKeys instanceof Set
      ? [...fieldKeys].filter((k): k is EngineDbFieldKey => k !== 'commission_percent')
      : fieldKeys ?? analysis.fields.filter((f) => !f.matchDb).map((f) => f.key)

  const keys = expandEngineApplyFieldKeys(rawKeys)
  const patch: Record<string, number> = {}

  for (const key of keys) {
    if (key === 'commission_percent') continue
    const row = analysis.fields.find((f) => f.key === key)
    if (!row) continue
    patch[key] = row.engineValue
  }

  if (opts && keys.has('commission_percent')) {
    const chRow = findChannelRowForBalance(String(opts.reservation.channelId ?? '').trim(), opts.channels)
    const masterPct = commissionPercentFromChannelMaster(chRow)
    if (masterPct != null) {
      patch.commission_percent = roundUsd2(masterPct)
      const pay = patch.commission_base_price ?? analysis.engine.totals.channelPaymentNet
      patch.commission_amount = computeChannelCommissionAmountUsd(pay, masterPct)
      if (!keys.has('channel_settlement_amount')) {
        patch.channel_settlement_amount = roundUsd2(
          Math.max(0, pay - patch.commission_amount)
        )
      }
    }
  } else if (
    opts &&
    (keys.has('commission_base_price') || keys.has('channel_settlement_amount'))
  ) {
    const chRow = findChannelRowForBalance(String(opts.reservation.channelId ?? '').trim(), opts.channels)
    const masterPct = commissionPercentFromChannelMaster(chRow)
    if (masterPct != null) {
      patch.commission_percent = roundUsd2(masterPct)
      const pay = patch.commission_base_price ?? analysis.engine.totals.channelPaymentNet
      patch.commission_amount = computeChannelCommissionAmountUsd(pay, masterPct)
      if (!keys.has('channel_settlement_amount')) {
        patch.channel_settlement_amount = roundUsd2(
          Math.max(0, pay - patch.commission_amount)
        )
      }
    }
  }

  return patch
}
