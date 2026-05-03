'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { DollarSign, Users, Calendar, ChevronDown, ChevronRight, X, Filter, FileText, FileSpreadsheet, GitCompare } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useReservationData } from '@/hooks/useReservationData'
import { useRoutePersistedState } from '@/hooks/useRoutePersistedState'
import { getChannelName, getProductName, getCustomerName, getStatusColor } from '@/utils/reservationUtils'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import ReservationForm from '@/components/reservation/ReservationForm'
import { autoCreateOrUpdateTour } from '@/lib/tourAutoCreation'
import { type ChannelInvoiceItem } from '@/utils/pdfExport'
import ChannelInvoicePreviewModal from '@/components/statistics/ChannelInvoicePreviewModal'
import ChannelOtaReconciliationModal from '@/components/statistics/ChannelOtaReconciliationModal'
import type { Reservation } from '@/types/reservation'
import {
  computeChannelPaymentAfterReturn,
  computeChannelSettlementAmount,
  computeCompanyTotalRevenueLikePricingSection,
  deriveCommissionGrossForSettlement,
  shouldOmitAdditionalDiscountAndCostFromCompanyRevenueSum,
} from '@/utils/channelSettlement'
import { isHomepageBookingChannel } from '@/utils/homepageBookingChannel'
import { type SystemReservationForOta } from '@/utils/otaSettlementReconciliation'

interface ChannelSettlementTabProps {
  dateRange: { start: string; end: string }
  /** 채널 필터 (부모/URL과 연동). 변경 시 onChannelChange 호출 */
  selectedChannelId?: string
  onChannelChange?: (channelId: string) => void
  selectedStatuses: string[]
  searchQuery?: string
  /** team.position === 'super' 일 때만 Audit 체크박스 클릭 가능 */
  isSuper?: boolean
}

interface ChannelGroup {
  type: 'OTA' | 'SELF'
  label: string
  channels: Array<{ id: string; name: string; type?: string; category?: string }>
}

interface ReservationItem {
  id: string
  tourDate: string
  registrationDate: string
  customerId: string
  customerName: string
  productId: string
  productName: string
  totalPeople: number
  adults: number
  child: number
  infant: number
  /** 가격 정보 청구 성인 수 (reservation_pricing.pricing_adults). 없으면 예약 adults */
  pricingAdults?: number
  status: string
  channelRN: string
  channelId?: string
  channelName?: string
  totalPrice: number
  adultPrice?: number
  productPriceTotal?: number
  optionTotal?: number
  subtotal?: number
  commissionAmount?: number
  couponDiscount?: number
  additionalDiscount?: number
  additionalCost?: number
  tax?: number
  depositAmount?: number
  balanceAmount?: number
  /** DB `commission_base_price`(Returned 차감 후 net). 인보이스·산식은 `deriveCommissionGrossForSettlement`로 gross 복원 */
  commissionBasePrice?: number
  cardFee?: number
  prepaymentTip?: number
  /** 입금내역 (Partner Received) 합계 */
  partnerReceivedAmount?: number
  /** DB `reservation_pricing.channel_settlement_amount`만 표시 (통계 화면에서 재계산 없음) */
  channelSettlementAmount?: number | null
  /** DB `reservation_pricing.commission_percent` (0~100, 소수 저장 시 정규화). 없으면 채널 마스터 %로 검증 */
  pricingCommissionPercent?: number | null
  amountAudited?: boolean
  amountAuditedAt?: string | null
  amountAuditedBy?: string | null
  /** 채널 정산 집계용 — enrichItemsWithCompanyTotalRevenue 로 채움 */
  companyTotalRevenue?: number
  /** Partner Received − Returned(파트너 환불) */
  partnerReceivedNet?: number
}

function reservationItemsToOtaSystemRows(items: ReservationItem[]): SystemReservationForOta[] {
  return items.map((item) => ({
    id: item.id,
    channelRN: item.channelRN || '',
    channelSettlementAmount: item.channelSettlementAmount ?? null,
    status: item.status,
  }))
}

/** PricingSection 가격계산 4번「총 매출」용 부가 필드 (reservation_pricing) */
type StatsPricingExtras = {
  notIncludedPrice: number
  onlinePaymentAmount: number
  prepaymentCost: number
  commissionBasePrice: number | null
}

function defaultStatsExtras(): StatsPricingExtras {
  return { notIncludedPrice: 0, onlinePaymentAmount: 0, prepaymentCost: 0, commissionBasePrice: null }
}

function billingPaxForSettlementFromItem(item: {
  pricingAdults?: number | null
  adults?: number
  child?: number
  infant?: number
}): number {
  const pricingAdultsVal = Math.max(0, Math.floor(Number(item.pricingAdults ?? item.adults) || 0))
  return (
    pricingAdultsVal +
    Math.max(0, Math.floor(Number(item.child) || 0)) +
    Math.max(0, Math.floor(Number(item.infant) || 0))
  )
}

/** DB channel_settlement_amount 우선, 없으면 PricingSection과 동일한 computeChannelSettlementAmount */
function channelSettlementBaseForStatsRow(
  item: ReservationItem,
  extras: StatsPricingExtras,
  returnedAmount: number,
  partnerReceived: number,
  isOta: boolean
): number {
  const stored = item.channelSettlementAmount
  if (stored != null && Number.isFinite(Number(stored))) {
    return Math.max(0, Number(stored))
  }
  const billingPax = billingPaxForSettlementFromItem(item) || 1
  const notIncludedForSettlement = (extras.notIncludedPrice || 0) * billingPax
  const productTotalForSettlement = (item.productPriceTotal || 0) + notIncludedForSettlement

  const storedCb = Number(item.commissionBasePrice ?? extras.commissionBasePrice ?? 0)
  const onlineRaw = Number(extras.onlinePaymentAmount) || 0
  const online =
    Math.abs(onlineRaw) > 0.005
      ? onlineRaw
      : deriveCommissionGrossForSettlement(storedCb, {
          returnedAmount,
          depositAmount: item.depositAmount ?? 0,
          productPriceTotal: productTotalForSettlement,
          isOTAChannel: isOta,
        }) || storedCb

  return computeChannelSettlementAmount({
    depositAmount: item.depositAmount ?? 0,
    onlinePaymentAmount: online,
    productPriceTotal: productTotalForSettlement,
    couponDiscount: item.couponDiscount ?? 0,
    additionalDiscount: item.additionalDiscount ?? 0,
    optionTotalSum: item.optionTotal ?? 0,
    additionalCost: item.additionalCost ?? 0,
    tax: item.tax ?? 0,
    cardFee: item.cardFee ?? 0,
    prepaymentTip: item.prepaymentTip ?? 0,
    onSiteBalanceAmount: item.balanceAmount ?? 0,
    returnedAmount,
    partnerReceivedAmount: partnerReceived,
    commissionAmount: item.commissionAmount ?? 0,
    reservationStatus: item.status,
    isOTAChannel: isOta,
  })
}

/** 예약 정보 수정 → 가격정보 → 4번 총 매출과 동일 산식 */
function buildCompanyTotalRevenueForChannelRow(
  item: ReservationItem,
  extras: StatsPricingExtras,
  ctx: {
    returnedAmount: number
    partnerReceived: number
    refundedOur: number
    reservationOptionsSum: number
    isOta: boolean
    isHomepageChannel: boolean
  }
): number {
  const base = channelSettlementBaseForStatsRow(item, extras, ctx.returnedAmount, ctx.partnerReceived, ctx.isOta)
  const billingPax = billingPaxForSettlementFromItem(item) || 1
  const notIncludedTotalUsd = (extras.notIncludedPrice || 0) * billingPax
  const notIncludedForSettlement = (extras.notIncludedPrice || 0) * billingPax
  const productTotalForSettlement = (item.productPriceTotal || 0) + notIncludedForSettlement
  const st = String(item.status || '').toLowerCase().trim()
  const isReservationCancelled = st === 'cancelled' || st === 'canceled'

  const usesStored =
    item.channelSettlementAmount != null && Number.isFinite(Number(item.channelSettlementAmount))
  const onlineRaw = Number(extras.onlinePaymentAmount) || 0
  const storedCb = Number(item.commissionBasePrice ?? extras.commissionBasePrice ?? 0)
  let channelPaymentGrossDbLike = 0
  if (Number.isFinite(onlineRaw) && onlineRaw !== 0) {
    channelPaymentGrossDbLike = onlineRaw
  } else if (storedCb) {
    channelPaymentGrossDbLike = deriveCommissionGrossForSettlement(storedCb, {
      returnedAmount: ctx.returnedAmount,
      depositAmount: item.depositAmount ?? 0,
      productPriceTotal: productTotalForSettlement,
      isOTAChannel: ctx.isOta,
    })
  }
  const omitAdditionalDiscountAndCostFromSum = shouldOmitAdditionalDiscountAndCostFromCompanyRevenueSum({
    usesStoredChannelSettlement: usesStored,
    isOTAChannel: ctx.isOta,
    depositAmount: item.depositAmount ?? 0,
    onlinePaymentAmount: onlineRaw,
    channelPaymentGross: channelPaymentGrossDbLike,
  })

  return computeCompanyTotalRevenueLikePricingSection({
    channelSettlementBase: base,
    isOTAChannel: ctx.isOta,
    isReservationCancelled,
    reservationOptionsTotalPrice: ctx.isOta ? ctx.reservationOptionsSum : 0,
    notIncludedTotalUsd,
    additionalDiscount: item.additionalDiscount ?? 0,
    additionalCost: item.additionalCost ?? 0,
    tax: item.tax ?? 0,
    prepaymentCost: extras.prepaymentCost ?? 0,
    refundedOurAmount: ctx.refundedOur,
    omitAdditionalDiscountAndCostFromSum,
    excludeHomepageAdditionalCostFromCompanyTotals: ctx.isHomepageChannel,
  })
}

// TourItem을 ReservationItem과 동일하게 사용
// 배포/team 조회 실패 시에도 Audit 가능하도록 Super 관리자 이메일 직접 확인
const SUPER_ADMIN_EMAILS = ['wooyong.shim09@gmail.com']

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of items) {
    if (!item.id || seen.has(item.id)) continue
    seen.add(item.id)
    out.push(item)
  }
  return out
}

function dedupeChannelsById<T extends { id: string }>(list: T[]): T[] {
  const seen = new Set<string>()
  return list.filter((ch) => {
    if (!ch.id || seen.has(ch.id)) return false
    seen.add(ch.id)
    return true
  })
}

/** 상세 테이블「인원」·합계: reservation_pricing.pricing_adults 우선, 없으면 예약 adults → totalPeople */
function billingAdultsFromRow(item: {
  pricingAdults?: number | null
  adults?: number
  totalPeople?: number
}): number {
  if (item.pricingAdults != null) {
    const n = Math.floor(Number(item.pricingAdults))
    if (Number.isFinite(n)) return Math.max(0, n)
  }
  return Math.max(0, Math.floor(Number(item.adults ?? item.totalPeople ?? 0)))
}

/** 테이블 행과 동일한 식으로 합계(헤더·tfoot 공통) */
type ChannelPricingRowLike = {
  totalPeople?: number
  pricingAdults?: number | null
  adults?: number
  adultPrice?: number
  productPriceTotal?: number
  couponDiscount?: number
  additionalDiscount?: number
  additionalCost?: number
  commissionAmount?: number
  optionTotal?: number
  partnerReceivedAmount?: number
  channelSettlementAmount?: number | null
  /** PricingSection「총 매출」— enrichItemsWithCompanyTotalRevenue 후 설정 */
  companyTotalRevenue?: number
  partnerReceivedNet?: number
}

function aggregateChannelPricingRows<T extends ChannelPricingRowLike>(items: T[]) {
  return items.reduce(
    (acc, item) => {
      const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
      const grandTotal = (item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0)
      const totalPrice = grandTotal - (item.commissionAmount || 0)
      const netPriceLegacy = totalPrice + (item.optionTotal || 0)
      const companyRev = item.companyTotalRevenue ?? netPriceLegacy
      return {
        grandTotal: acc.grandTotal + grandTotal,
        commission: acc.commission + (item.commissionAmount || 0),
        totalPrice: acc.totalPrice + totalPrice,
        netPrice: acc.netPrice + companyRev,
        optionTotal: acc.optionTotal + (item.optionTotal || 0),
        partnerReceived:
          acc.partnerReceived + (item.partnerReceivedNet ?? item.partnerReceivedAmount ?? 0),
        channelSettlement: acc.channelSettlement + (item.channelSettlementAmount ?? 0),
        discountTotal: acc.discountTotal + discountTotal,
        productPriceTotalSum: acc.productPriceTotalSum + (item.productPriceTotal || 0),
        additionalCostSum: acc.additionalCostSum + (item.additionalCost || 0),
        adultPriceSum: acc.adultPriceSum + (item.adultPrice || 0),
        totalPeople: acc.totalPeople + billingAdultsFromRow(item),
      }
    },
    {
      grandTotal: 0,
      commission: 0,
      totalPrice: 0,
      netPrice: 0,
      optionTotal: 0,
      partnerReceived: 0,
      channelSettlement: 0,
      discountTotal: 0,
      productPriceTotalSum: 0,
      additionalCostSum: 0,
      adultPriceSum: 0,
      totalPeople: 0,
    }
  )
}

function formatUsd2(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** 입금내역 셀 — 순입금(수령−Returned) 및 상세 툴팁 */
function partnerReceivedNetTooltip(partnerReceived: number, returnedPartner: number): string {
  const pr = Number(partnerReceived) || 0
  const ret = Number(returnedPartner) || 0
  const net = Math.max(0, Math.round((pr - ret) * 100) / 100)
  return `파트너 수령: $${formatUsd2(pr)} · Returned(파트너 환불): $${formatUsd2(ret)} · 순입금: $${formatUsd2(net)}`
}

function numericDbOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' && value.trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** DB `channel_settlement_amount` 컬럼만 (commission_base_price와 혼용·대체 없음) */
function channelSettlementAmountFromRow(row: { channel_settlement_amount?: unknown }): number | null {
  return numericDbOrNull(row.channel_settlement_amount)
}

/** 인보이스 PDF 등 — `commission_base_price`만 */
function commissionBasePriceFromRow(row: { commission_base_price?: unknown }): number | null {
  return numericDbOrNull(row.commission_base_price)
}

/** 채널별 정산 탭 예약·투어 가격 조회/동기화 공통 */
/** `online_payment_amount` 등은 스키마에 없을 수 있어 SELECT에 넣지 않음 — 매퍼에서 없으면 0 */
const CHANNEL_SETTLEMENT_PRICING_SELECT =
  'reservation_id, total_price, adult_product_price, product_price_total, option_total, subtotal, commission_amount, commission_percent, coupon_discount, additional_discount, additional_cost, tax, deposit_amount, balance_amount, choices_total, card_fee, prepayment_tip, prepayment_cost, channel_settlement_amount, commission_base_price, pricing_adults, not_included_price'

/** DB 수수료율 → 표시·검증용 % (0.22 → 22) */
function commissionPercentFromPricingRow(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  let p = n
  if (p > 0 && p <= 1) p = p * 100
  return Math.round(p * 100) / 100
}

function mapPricingRowToChannelTabState(p: Record<string, unknown>) {
  return {
    adultPrice: Number(p.adult_product_price) || 0,
    productPriceTotal: Number(p.product_price_total) || 0,
    optionTotal: Number(p.option_total) || 0,
    subtotal: Number(p.subtotal) || 0,
    commissionAmount: Number(p.commission_amount) || 0,
    pricingCommissionPercent: commissionPercentFromPricingRow(p.commission_percent),
    couponDiscount: Number(p.coupon_discount) || 0,
    additionalDiscount: Number(p.additional_discount) || 0,
    additionalCost: Number(p.additional_cost) || 0,
    tax: Number(p.tax) || 0,
    depositAmount: Number(p.deposit_amount) || 0,
    balanceAmount: Number(p.balance_amount) || 0,
    choicesTotal: p.choices_total != null && p.choices_total !== '' ? Number(p.choices_total) : 0,
    cardFee: Number(p.card_fee) || 0,
    prepaymentTip: Number(p.prepayment_tip) || 0,
    prepaymentCost: Number(p.prepayment_cost) || 0,
    notIncludedPrice: Number(p.not_included_price) || 0,
    onlinePaymentAmount: Number(p.online_payment_amount) || 0,
    channelSettlementStored: channelSettlementAmountFromRow(p),
    commissionBasePrice: commissionBasePriceFromRow(p),
    pricingAdults:
      p.pricing_adults != null && p.pricing_adults !== ''
        ? Math.max(0, Math.floor(Number(p.pricing_adults)))
        : null,
  }
}

type ChannelTabPricingState = ReturnType<typeof mapPricingRowToChannelTabState>

/** `channel_settlement_amount` 없음 → 대시 (DB 값만 표시) */
function formatTourChannelSettlementCell(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return `$${Number(n).toLocaleString()}`
}

const CHANNEL_SETTLEMENT_PCT_VERIFY_EPS = 0.02

type ChannelMasterLike = {
  id: string
  commission_percent?: number | null
  commission_rate?: number | null
  commission?: number | null
}

/** 예약에 저장된 %가 있으면 우선(>0). 없거나 0이면 채널 마스터 */
function effectiveCommissionPercentForPctVerify(
  item: ReservationItem,
  channelsList: ChannelMasterLike[] | null | undefined
): number {
  const fromPricing = item.pricingCommissionPercent
  if (fromPricing != null && Number.isFinite(fromPricing) && fromPricing > 0) {
    return fromPricing
  }
  if (!item.channelId || !channelsList?.length) return 0
  const ch = channelsList.find((c) => c.id === item.channelId)
  return ch ? invoiceChannelCommissionPercent(ch) : 0
}

/** PricingSection·저장 로직과 동일한 채널 결제(표시) 금액 — OTA는 Partner Received 상한 적용 */
function channelPaymentForPctVerify(
  item: ReservationItem,
  returnedAmount: number,
  isOta: boolean,
  partnerReceived: number
): number {
  const storedCb = Number(item.commissionBasePrice ?? 0)
  const online = deriveCommissionGrossForSettlement(storedCb, {
    returnedAmount,
    depositAmount: item.depositAmount ?? 0,
    productPriceTotal: item.productPriceTotal ?? 0,
    isOTAChannel: isOta,
  })
  let pay = computeChannelPaymentAfterReturn({
    depositAmount: item.depositAmount ?? 0,
    onlinePaymentAmount: online,
    productPriceTotal: item.productPriceTotal ?? 0,
    couponDiscount: item.couponDiscount ?? 0,
    additionalDiscount: item.additionalDiscount ?? 0,
    optionTotalSum: item.optionTotal ?? 0,
    additionalCost: item.additionalCost ?? 0,
    tax: item.tax ?? 0,
    cardFee: item.cardFee ?? 0,
    prepaymentTip: item.prepaymentTip ?? 0,
    onSiteBalanceAmount: item.balanceAmount ?? 0,
    returnedAmount,
    commissionAmount: item.commissionAmount ?? 0,
    reservationStatus: item.status,
    isOTAChannel: isOta,
  })
  const pr = Number(partnerReceived) || 0
  if (isOta && pr > 0 && pay > pr + 0.005) {
    pay = pr
  }
  return pay
}

/** DB `channel_settlement_amount`가 「채널 결제 − (채널 결제 × 수수료%)」와 다르면 true */
function channelSettlementPctMismatch(
  item: ReservationItem,
  returnedAmount: number,
  partnerReceived: number,
  channelsList: ChannelMasterLike[] | null | undefined,
  isOta: boolean
): { mismatch: boolean; title?: string } {
  const stored = item.channelSettlementAmount
  if (stored == null || !Number.isFinite(Number(stored))) {
    return { mismatch: false }
  }
  const pct = effectiveCommissionPercentForPctVerify(item, channelsList)
  const pay = channelPaymentForPctVerify(item, returnedAmount, isOta, partnerReceived)
  const feeUsd = Math.round(pay * (pct / 100) * 100) / 100
  const expected = Math.max(0, Math.round((pay - feeUsd) * 100) / 100)
  const mismatch = Math.abs(Number(stored) - expected) > CHANNEL_SETTLEMENT_PCT_VERIFY_EPS
  if (!mismatch) return { mismatch: false }
  return {
    mismatch: true,
    title: `DB 저장값과 % 산식 불일치 — 채널 결제 $${formatUsd2(pay)}, 수수료 ${pct}% ($${formatUsd2(feeUsd)}), %기대 정산 $${formatUsd2(expected)}`,
  }
}

/** 인보이스 COMMISION %: 채널 마스터 비율 고정 (22 = 22%). DB에 소수(0.22)로 저장된 경우 변환 */
function invoiceChannelCommissionPercent(ch: {
  commission_percent?: number | null
  commission_rate?: number | null
  commission?: number | null
}): number {
  let p = Number(ch.commission_percent ?? ch.commission_rate ?? ch.commission ?? 0)
  if (!Number.isFinite(p)) p = 0
  if (p > 0 && p <= 1) p = p * 100
  return Math.round(p * 100) / 100
}

export default function ChannelSettlementTab({ dateRange, selectedChannelId = '', onChannelChange, selectedStatuses, searchQuery = '', isSuper = false }: ChannelSettlementTabProps) {
  const t = useTranslations('reservations')
  const { authUser } = useAuth()
  const isSuperByEmail = Boolean(
    authUser?.email && SUPER_ADMIN_EMAILS.some((e) => e.toLowerCase() === authUser.email!.toLowerCase().trim())
  )
  const canAudit = isSuper || isSuperByEmail

  const {
    reservations,
    customers,
    products,
    channels,
    productOptions,
    options,
    pickupHotels,
    coupons,
    refreshReservations,
    refreshCustomers,
    loading: reservationsLoading
  } = useReservationData()
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null)
  const [toursLoading, setToursLoading] = useState(false)
  const [tourItems, setTourItems] = useState<ReservationItem[]>([])
  const [reservationPrices, setReservationPrices] = useState<Record<string, number>>({})
  const [reservationPricingData, setReservationPricingData] = useState<Record<string, ChannelTabPricingState>>({})
  const [pricesLoading, setPricesLoading] = useState(false)
  const CHANNEL_SETTLEMENT_UI_DEFAULT = {
    activeDetailTab: 'reservations' as 'reservations' | 'tours',
    reservationSortOrder: 'asc' as 'asc' | 'desc',
    tourSortOrder: 'asc' as 'asc' | 'desc',
  }
  const [channelUi, setChannelUi] = useRoutePersistedState(
    'channel-settlement-ui',
    CHANNEL_SETTLEMENT_UI_DEFAULT
  )
  const { activeDetailTab, reservationSortOrder, tourSortOrder } = channelUi
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set())
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false)
  const channelFilter = selectedChannelId ?? ''
  const [partnerReceivedByReservation, setPartnerReceivedByReservation] = useState<Record<string, number>>({})
  const [returnedAmountByReservation, setReturnedAmountByReservation] = useState<Record<string, number>>({})
  /** payment_records Refunded(우리 쪽 환불) — PricingSection 총매출 차감과 동일 */
  const [refundedOurByReservation, setRefundedOurByReservation] = useState<Record<string, number>>({})
  /** reservation_options total_price 합 (취소·환불 제외) — OTA 총매출 가산용 */
  const [reservationOptionsSumByReservation, setReservationOptionsSumByReservation] = useState<Record<string, number>>({})
  const [reservationAudit, setReservationAudit] = useState<Record<string, { amount_audited: boolean; amount_audited_at: string | null; amount_audited_by: string | null }>>({})
  const [channelInvoicePreview, setChannelInvoicePreview] = useState<{
    channelName: string
    dateRange: { start: string; end: string }
    items: ChannelInvoiceItem[]
  } | null>(null)
  const [otaReconcileSession, setOtaReconcileSession] = useState<{
    channelId: string
    channelName: string
    systemReservationsOverride?: SystemReservationForOta[]
    periodNote?: string
  } | null>(null)

  const isOtaChannelId = useCallback(
    (channelId?: string | null) => {
      if (!channelId || !channels?.length) return false
      const ch = channels.find((c) => c.id === channelId)
      if (!ch) return false
      return String(ch.type || '').toLowerCase() === 'ota' || ch.category === 'OTA'
    },
    [channels]
  )

  const reservationRowPricingExtras = useCallback(
    (reservationId: string): StatsPricingExtras => {
      const p = reservationPricingData[reservationId]
      if (!p) return defaultStatsExtras()
      return {
        notIncludedPrice: p.notIncludedPrice ?? 0,
        onlinePaymentAmount: p.onlinePaymentAmount ?? 0,
        prepaymentCost: p.prepaymentCost ?? 0,
        commissionBasePrice: p.commissionBasePrice ?? null,
      }
    },
    [reservationPricingData]
  )

  const enrichItemsWithCompanyTotalRevenue = useCallback(
    (items: ReservationItem[]): ReservationItem[] =>
      items.map((item) => {
        const pr = partnerReceivedByReservation[item.id] ?? 0
        const ret = returnedAmountByReservation[item.id] ?? 0
        const partnerReceivedNet = Math.max(0, Math.round((pr - ret) * 100) / 100)
        return {
          ...item,
          partnerReceivedNet,
          companyTotalRevenue: buildCompanyTotalRevenueForChannelRow(
            item,
            reservationRowPricingExtras(item.id),
            {
              returnedAmount: ret,
              partnerReceived: pr,
              refundedOur: refundedOurByReservation[item.id] ?? 0,
              reservationOptionsSum: reservationOptionsSumByReservation[item.id] ?? 0,
              isOta: isOtaChannelId(item.channelId),
              isHomepageChannel: isHomepageBookingChannel(item.channelId, channels),
            }
          ),
        }
      }) as ReservationItem[],
    [
      reservationRowPricingExtras,
      returnedAmountByReservation,
      partnerReceivedByReservation,
      refundedOurByReservation,
      reservationOptionsSumByReservation,
      isOtaChannelId,
      channels,
    ]
  )

  // 예약 클릭 시 수정 모달 열기
  const openReservationEditModal = useCallback((reservationId: string) => {
    const reservation = reservations.find(r => r.id === reservationId)
    setEditingReservation(reservation ? (reservation as Reservation) : null)
  }, [reservations])

  /** 예약 폼에서「가격 정보만 저장」시 통계 테이블이 바로 갱신되도록 DB에서 다시 읽어 반영 */
  const handlePricingSaved = useCallback(async (reservationId: string) => {
    try {
      const { data, error } = await supabase
        .from('reservation_pricing')
        .select(CHANNEL_SETTLEMENT_PRICING_SELECT)
        .eq('reservation_id', reservationId)
        .maybeSingle()
      if (error || !data) return
      const row = data as Record<string, unknown>
      const mapped = mapPricingRowToChannelTabState(row)
      const totalPrice = Number(row.total_price) || 0
      setReservationPrices((prev) => ({ ...prev, [reservationId]: totalPrice }))
      setReservationPricingData((prev) => ({ ...prev, [reservationId]: mapped }))
      setTourItems((prev) =>
        prev.map((item) => {
          if (item.id !== reservationId) return item
          const next: ReservationItem = {
            ...item,
            totalPrice,
            adultPrice: mapped.adultPrice,
            productPriceTotal: mapped.productPriceTotal,
            optionTotal: mapped.optionTotal,
            subtotal: mapped.subtotal,
            commissionAmount: mapped.commissionAmount,
            couponDiscount: mapped.couponDiscount,
            additionalDiscount: mapped.additionalDiscount,
            additionalCost: mapped.additionalCost,
            tax: mapped.tax,
            depositAmount: mapped.depositAmount,
            balanceAmount: mapped.balanceAmount,
            cardFee: mapped.cardFee,
            prepaymentTip: mapped.prepaymentTip,
            channelSettlementAmount: mapped.channelSettlementStored,
            pricingCommissionPercent: mapped.pricingCommissionPercent,
            pricingAdults:
              mapped.pricingAdults != null
                ? mapped.pricingAdults
                : item.pricingAdults != null
                  ? item.pricingAdults
                  : Math.max(0, Math.floor(Number(item.adults ?? item.totalPeople ?? 0))),
          }
          if (mapped.commissionBasePrice != null) {
            next.commissionBasePrice = mapped.commissionBasePrice
          } else {
            delete next.commissionBasePrice
          }
          return next
        })
      )
    } catch (e) {
      console.error('handlePricingSaved:', e)
    }
  }, [])

  const handleOtaReconcilePatched = useCallback(
    async (reservationId: string) => {
      await handlePricingSaved(reservationId)
      try {
        const { data } = await supabase
          .from('reservations')
          .select('id, amount_audited, amount_audited_at, amount_audited_by')
          .eq('id', reservationId)
          .maybeSingle()
        if (data) {
          const row = data as {
            amount_audited?: boolean | null
            amount_audited_at?: string | null
            amount_audited_by?: string | null
          }
          setReservationAudit((prev) => ({
            ...prev,
            [reservationId]: {
              amount_audited: !!row.amount_audited,
              amount_audited_at: row.amount_audited_at ?? null,
              amount_audited_by: row.amount_audited_by ?? null,
            },
          }))
        }
      } catch {
        /* ignore */
      }
    },
    [handlePricingSaved]
  )

  const handleEditReservation = useCallback(async (reservation: Omit<Reservation, 'id'>) => {
    if (!editingReservation) return
    try {
      const reservationData = {
        customer_id: reservation.customerId,
        product_id: reservation.productId,
        tour_date: reservation.tourDate,
        tour_time: reservation.tourTime || null,
        event_note: reservation.eventNote,
        pickup_hotel: reservation.pickUpHotel,
        pickup_time: reservation.pickUpTime || null,
        adults: reservation.adults,
        child: reservation.child,
        infant: reservation.infant,
        total_people: reservation.totalPeople,
        channel_id: reservation.channelId,
        channel_rn: reservation.channelRN,
        added_by: reservation.addedBy,
        tour_id: reservation.tourId,
        status: reservation.status,
        selected_options: reservation.selectedOptions,
        selected_option_prices: reservation.selectedOptionPrices,
        is_private_tour: reservation.isPrivateTour || false,
        choices: reservation.choices,
        variant_key: (reservation as any).variantKey || 'default'
      }
      const { error } = await (supabase as any).from('reservations').update(reservationData as any).eq('id', editingReservation.id)
      if (error) {
        alert(t('messages.reservationUpdateError') + error.message)
        return
      }
      try {
        await supabase.from('reservation_choices').delete().eq('reservation_id', editingReservation.id)
        let choicesToSave: Array<{ reservation_id: string; choice_id: string; option_id: string; quantity: number; total_price: number }> = []
        if (Array.isArray((reservation as any).selectedChoices) && (reservation as any).selectedChoices.length > 0) {
          for (const choice of (reservation as any).selectedChoices) {
            if (choice.choice_id && choice.option_id) {
              choicesToSave.push({
                reservation_id: editingReservation.id,
                choice_id: choice.choice_id,
                option_id: choice.option_id,
                quantity: choice.quantity || 1,
                total_price: choice.total_price !== undefined && choice.total_price !== null ? Number(choice.total_price) : 0
              })
            }
          }
        }
        if (choicesToSave.length === 0 && reservation.choices?.required && Array.isArray(reservation.choices.required)) {
          for (const choice of reservation.choices.required) {
            if (choice.choice_id && choice.option_id) {
              choicesToSave.push({
                reservation_id: editingReservation.id,
                choice_id: choice.choice_id,
                option_id: choice.option_id,
                quantity: choice.quantity || 1,
                total_price: choice.total_price || 0
              })
            }
          }
        }
        if (choicesToSave.length > 0) {
          await (supabase as any).from('reservation_choices').insert(choicesToSave)
        }
      } catch {
        // 초이스 저장 실패해도 예약 수정은 성공
      }
      try {
        await supabase.from('reservation_customers').delete().eq('reservation_id', editingReservation.id)
        const reservationCustomers: any[] = []
        let orderIndex = 0
        const usResidentCount = (reservation as any).usResidentCount || 0
        for (let i = 0; i < usResidentCount; i++) {
          reservationCustomers.push({ reservation_id: editingReservation.id, customer_id: reservation.customerId, resident_status: 'us_resident', pass_covered_count: 0, order_index: orderIndex++ })
        }
        const nonResidentCount = (reservation as any).nonResidentCount || 0
        for (let i = 0; i < nonResidentCount; i++) {
          reservationCustomers.push({ reservation_id: editingReservation.id, customer_id: reservation.customerId, resident_status: 'non_resident', pass_covered_count: 0, order_index: orderIndex++ })
        }
        const nonResidentUnder16Count = (reservation as any).nonResidentUnder16Count || 0
        for (let i = 0; i < nonResidentUnder16Count; i++) {
          reservationCustomers.push({ reservation_id: editingReservation.id, customer_id: reservation.customerId, resident_status: 'non_resident_under_16', pass_covered_count: 0, order_index: orderIndex++ })
        }
        const nonResidentWithPassCount = (reservation as any).nonResidentWithPassCount || 0
        for (let i = 0; i < nonResidentWithPassCount; i++) {
          reservationCustomers.push({ reservation_id: editingReservation.id, customer_id: reservation.customerId, resident_status: 'non_resident_with_pass', pass_covered_count: 4, order_index: orderIndex++ })
        }
        if (reservationCustomers.length > 0) {
          await supabase.from('reservation_customers').insert(reservationCustomers as any)
        }
      } catch {
        // reservation_customers 실패해도 예약 수정은 성공
      }
      if (reservation.pricingInfo) {
        try {
          const pricingInfo = reservation.pricingInfo as any
          const toNum = (v: unknown) => (v !== null && v !== undefined && v !== '' ? Number(v) : 0)
          const pricingAdultsVal = Math.max(
            0,
            Math.floor(
              Number(
                pricingInfo.pricingAdults ??
                  pricingInfo.pricing_adults ??
                  reservation.adults ??
                  0
              ) || 0
            )
          )
          const billingPaxForSettlement =
            pricingAdultsVal + (reservation.child || 0) + (reservation.infant || 0)
          const notIncludedForSettlement = toNum(pricingInfo.not_included_price) * (billingPaxForSettlement || 1)
          const productTotalForChannelSettlement = toNum(pricingInfo.productPriceTotal) + notIncludedForSettlement
          const newOptionTotal = toNum(pricingInfo.optionTotal)

          let returnedAmount = 0
          let partnerReceivedAmount = 0
          try {
            const { data: payRows } = await (supabase as any)
              .from('payment_records')
              .select('amount, payment_status')
              .eq('reservation_id', editingReservation.id)
            ;(payRows || []).forEach((row: { payment_status?: string; amount?: number }) => {
              const status = row.payment_status || ''
              const sl = status.toLowerCase()
              if (status === 'Partner Received') {
                partnerReceivedAmount += Number(row.amount) || 0
              }
              if (status.includes('Returned') || sl === 'returned') {
                returnedAmount += Number(row.amount) || 0
              }
            })
          } catch {
            returnedAmount = 0
            partnerReceivedAmount = 0
          }

          const { data: existingPricing } = await supabase
            .from('reservation_pricing')
            .select('commission_base_price')
            .eq('reservation_id', editingReservation.id)
            .maybeSingle()

          const storedCb =
            toNum(pricingInfo.commission_base_price) ||
            toNum(pricingInfo.commissionBasePrice) ||
            toNum((existingPricing as { commission_base_price?: number } | null)?.commission_base_price)

          const commissionGross =
            toNum(pricingInfo.onlinePaymentAmount) ||
            toNum(pricingInfo.depositAmount) ||
            deriveCommissionGrossForSettlement(storedCb, {
              returnedAmount,
              depositAmount: toNum(pricingInfo.depositAmount),
              productPriceTotal: productTotalForChannelSettlement,
              isOTAChannel: isOtaChannelId(reservation.channelId),
            }) ||
            storedCb

          const channelSettlementComputeInput = {
            depositAmount: toNum(pricingInfo.depositAmount),
            onlinePaymentAmount: commissionGross,
            productPriceTotal: productTotalForChannelSettlement,
            couponDiscount: toNum(pricingInfo.couponDiscount),
            additionalDiscount: toNum(pricingInfo.additionalDiscount),
            optionTotalSum: newOptionTotal,
            additionalCost: toNum(pricingInfo.additionalCost),
            tax: toNum(pricingInfo.tax),
            cardFee: toNum(pricingInfo.cardFee),
            prepaymentTip: toNum(pricingInfo.prepaymentTip),
            onSiteBalanceAmount: toNum(pricingInfo.balanceAmount),
            returnedAmount,
            partnerReceivedAmount,
            commissionAmount: toNum(pricingInfo.commission_amount),
            reservationStatus: reservation.status,
            isOTAChannel: isOtaChannelId(reservation.channelId),
          }

          const channelPayNet = computeChannelPaymentAfterReturn(channelSettlementComputeInput)
          const channelSettlementComputed = computeChannelSettlementAmount(channelSettlementComputeInput)

          await supabase.from('reservation_pricing').upsert({
            reservation_id: editingReservation.id,
            adult_product_price: pricingInfo.adultProductPrice,
            child_product_price: pricingInfo.childProductPrice,
            infant_product_price: pricingInfo.infantProductPrice,
            product_price_total: pricingInfo.productPriceTotal,
            not_included_price: pricingInfo.not_included_price || 0,
            required_options: pricingInfo.requiredOptions,
            required_option_total: pricingInfo.requiredOptionTotal,
            choices: pricingInfo.choices || {},
            choices_total: pricingInfo.choicesTotal || 0,
            subtotal: pricingInfo.subtotal,
            coupon_code: pricingInfo.couponCode,
            coupon_discount: pricingInfo.couponDiscount,
            additional_discount: pricingInfo.additionalDiscount,
            additional_cost: pricingInfo.additionalCost,
            card_fee: pricingInfo.cardFee,
            tax: pricingInfo.tax,
            prepayment_cost: pricingInfo.prepaymentCost,
            prepayment_tip: pricingInfo.prepaymentTip,
            selected_options: pricingInfo.selectedOptionalOptions,
            option_total: pricingInfo.optionTotal,
            total_price: pricingInfo.totalPrice,
            deposit_amount: pricingInfo.depositAmount,
            balance_amount: pricingInfo.balanceAmount,
            private_tour_additional_cost: pricingInfo.privateTourAdditionalCost,
            commission_percent: pricingInfo.commission_percent || 0,
            commission_amount: pricingInfo.commission_amount || 0,
            pricing_adults: pricingAdultsVal,
            commission_base_price: Math.round(channelPayNet * 100) / 100,
            channel_settlement_amount: Math.round(channelSettlementComputed * 100) / 100,
          } as any, { onConflict: 'reservation_id', ignoreDuplicates: false })
        } catch {
          // 가격 저장 실패해도 예약 수정은 성공
        }
      }
      try {
        await autoCreateOrUpdateTour(reservation.productId, reservation.tourDate, editingReservation.id, reservation.isPrivateTour)
      } catch {
        // 투어 생성 실패해도 예약 수정은 성공
      }
      await refreshReservations()
      setEditingReservation(null)
      alert(t('messages.reservationUpdated'))
    } catch (error) {
      console.error('Error updating reservation:', error)
      alert(t('messages.reservationUpdateError') + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }, [editingReservation, refreshReservations, t])

  // 금액 Audit 체크박스 토글 (Net Price vs 입금내역 더블체크 기록)
  const handleToggleAmountAudit = useCallback(async (reservationId: string, checked: boolean) => {
    try {
      const payload: { amount_audited: boolean; amount_audited_at: string | null; amount_audited_by: string | null } = checked
        ? { amount_audited: true, amount_audited_at: new Date().toISOString(), amount_audited_by: authUser?.email ?? null }
        : { amount_audited: false, amount_audited_at: null, amount_audited_by: null }
      const { error } = await (supabase as any).from('reservations').update(payload).eq('id', reservationId)
      if (error) {
        alert('Audit 상태 저장 오류: ' + error.message)
        return
      }
      setReservationAudit(prev => ({ ...prev, [reservationId]: { amount_audited: payload.amount_audited, amount_audited_at: payload.amount_audited_at, amount_audited_by: payload.amount_audited_by } }))
    } catch (err) {
      console.error('handleToggleAmountAudit:', err)
      alert('Audit 상태 저장 중 오류가 발생했습니다.')
    }
  }, [authUser?.email])

  const handleDeleteReservation = useCallback(async (id: string) => {
    if (!confirm('이 예약을 삭제하시겠습니까? 데이터는 삭제되지 않고 상태만 \'삭제됨\'으로 변경됩니다.')) return
    try {
      const { error } = await supabase.from('reservations').update({ status: 'deleted' }).eq('id', id)
      if (error) {
        alert('예약 삭제 중 오류가 발생했습니다: ' + error.message)
        return
      }
      await refreshReservations()
      setEditingReservation(null)
      alert('예약이 삭제됨 상태로 변경되었습니다.')
    } catch (error) {
      console.error('Error deleting reservation:', error)
      alert('예약 삭제 중 오류가 발생했습니다.')
    }
  }, [refreshReservations, t])

  // 채널 그룹화
  const channelGroups = useMemo((): ChannelGroup[] => {
    if (!channels || channels.length === 0) return []
    
    const otaChannels = dedupeChannelsById(
      channels.filter(channel => {
        const type = (channel.type || '').toLowerCase()
        const category = (channel.category || '').toLowerCase()
        return type === 'ota' || category === 'ota'
      })
    )

    const selfChannels = dedupeChannelsById(
      channels.filter(channel => {
        const type = (channel.type || '').toLowerCase()
        const category = (channel.category || '').toLowerCase()
        return (
          type === 'self' ||
          type === 'partner' ||
          category === 'own' ||
          category === 'self' ||
          category === 'partner'
        )
      })
    )
    
    return [
      {
        type: 'OTA' as const,
        label: 'OTA 채널',
        channels: otaChannels
      },
      {
        type: 'SELF' as const,
        label: '자체 채널',
        channels: selfChannels
      }
    ].filter(group => group.channels.length > 0)
  }, [channels])

  // 그룹 토글
  const toggleGroup = (groupType: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupType)) {
        next.delete(groupType)
        // 그룹이 닫힐 때 하위 채널도 모두 닫기
        const group = channelGroups.find(g => g.type === groupType)
        if (group) {
          group.channels.forEach(ch => setExpandedChannels(prevCh => {
            const nextCh = new Set(prevCh)
            nextCh.delete(ch.id)
            return nextCh
          }))
        }
      } else {
        next.add(groupType)
      }
      return next
    })
  }

  // 채널 토글
  const toggleChannel = (channelId: string) => {
    setExpandedChannels(prev => {
      const next = new Set(prev)
      if (next.has(channelId)) {
        next.delete(channelId)
      } else {
        next.add(channelId)
      }
      return next
    })
  }

  // 예약 내역 필터링 (등록일 기준, 상태 필터, 검색 필터, 채널 필터)
  const filteredReservations = useMemo(() => {
    const matched = reservations.filter(reservation => {
      // 채널 필터 (선택된 경우에만)
      if (channelFilter && reservation.channelId !== channelFilter) return false
      
      // 상태 필터 (선택된 경우에만)
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(reservation.status)) return false
      
      // 등록일 필터 (addedTime 기준)
      const registrationDate = new Date(reservation.addedTime)
      const startDate = new Date(dateRange.start)
      const endDate = new Date(dateRange.end)
      endDate.setHours(23, 59, 59, 999) // 하루의 끝까지 포함
      
      if (!(registrationDate >= startDate && registrationDate <= endDate)) return false

      // 검색 필터
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        // 고객명 검색
        const customerName = getCustomerName(reservation.customerId, customers || []).toLowerCase()
        // 채널RN 검색
        const channelRN = reservation.channelRN?.toLowerCase() || ''
        // 상품명 검색
        const productName = getProductName(reservation.productId, products || []).toLowerCase()
        // 투어 날짜 검색
        const tourDate = new Date(reservation.tourDate).toLocaleDateString('ko-KR')
        // 등록일 검색
        const regDate = registrationDate.toLocaleDateString('ko-KR')
        
        if (
          !customerName.includes(query) &&
          !channelRN.includes(query) &&
          !productName.includes(query) &&
          !tourDate.includes(query) &&
          !regDate.includes(query)
        ) {
          return false
        }
      }

      return true
    })
    return dedupeById(matched)
  }, [reservations, selectedStatuses, dateRange, searchQuery, customers, products, channelFilter])

  // 채널별로 예약 필터링하는 헬퍼 함수
  const getReservationsByChannel = useCallback((channelId: string) => {
    return filteredReservations.filter(reservation => reservation.channelId === channelId)
  }, [filteredReservations])

  // 투어 아이템을 채널별로 필터링하는 헬퍼 함수
  const getTourItemsByChannel = useCallback((channelId: string) => {
    return tourItems.filter(item => item.channelId === channelId)
  }, [tourItems])

  // 예약 가격 정보 가져오기
  useEffect(() => {
    const fetchPrices = async () => {
      if (filteredReservations.length === 0) {
        setReservationPrices({})
        return
      }

      setPricesLoading(true)
      try {
        const reservationIds = filteredReservations.map(r => r.id)
        if (reservationIds.length === 0) {
          setReservationPrices({})
          setReservationPricingData({})
          setPricesLoading(false)
          return
        }

        const pricesMap: Record<string, number> = {}
        const pricingDataMap: Record<string, ChannelTabPricingState> = {}

        // URL 길이 제한을 피하기 위해 청크 단위로 나눠서 요청 (한 번에 최대 100개씩)
        const chunkSize = 100
        for (let i = 0; i < reservationIds.length; i += chunkSize) {
          const chunk = reservationIds.slice(i, i + chunkSize)
          
          const { data: pricingData, error } = await supabase
            .from('reservation_pricing')
            .select(CHANNEL_SETTLEMENT_PRICING_SELECT)
            .in('reservation_id', chunk)

          if (error) {
            console.error('예약 가격 조회 오류 (청크):', error, { chunkSize: chunk.length, chunkIndex: i / chunkSize })
            continue // 다음 청크 계속 처리
          }

          pricingData?.forEach((p: any) => {
            pricesMap[p.reservation_id] = p.total_price || 0
            pricingDataMap[p.reservation_id] = mapPricingRowToChannelTabState(p)
          })
        }

        const partnerReceivedMap: Record<string, number> = {}
        const returnedMap: Record<string, number> = {}
        const refundedOurMap: Record<string, number> = {}
        for (let i = 0; i < reservationIds.length; i += chunkSize) {
          const chunk = reservationIds.slice(i, i + chunkSize)
          const { data: paymentData } = await supabase
            .from('payment_records')
            .select('reservation_id, amount, payment_status')
            .in('reservation_id', chunk)
          paymentData?.forEach((row: { reservation_id: string; amount: number | null; payment_status?: string | null }) => {
            const rid = row.reservation_id
            const amt = Number(row.amount) || 0
            if (row.payment_status === 'Partner Received') {
              partnerReceivedMap[rid] = (partnerReceivedMap[rid] ?? 0) + amt
            }
            const st = row.payment_status || ''
            const sl = st.toLowerCase()
            if (st.includes('Refunded') || sl === 'refunded') {
              refundedOurMap[rid] = (refundedOurMap[rid] ?? 0) + amt
            } else if (st.includes('Returned') || sl === 'returned') {
              returnedMap[rid] = (returnedMap[rid] ?? 0) + amt
            }
          })
        }
        setPartnerReceivedByReservation(prev => ({ ...prev, ...partnerReceivedMap }))
        setReturnedAmountByReservation(prev => ({ ...prev, ...returnedMap }))
        setRefundedOurByReservation(prev => ({ ...prev, ...refundedOurMap }))

        const optionsSumMap: Record<string, number> = {}
        for (let i = 0; i < reservationIds.length; i += chunkSize) {
          const chunk = reservationIds.slice(i, i + chunkSize)
          const { data: optRows } = await supabase
            .from('reservation_options')
            .select('reservation_id, total_price, status')
            .in('reservation_id', chunk)
          optRows?.forEach((row: { reservation_id: string; total_price?: number | null; status?: string | null }) => {
            const rid = row.reservation_id
            const ost = String(row.status || '').toLowerCase()
            if (ost === 'cancelled' || ost === 'refunded') return
            optionsSumMap[rid] = (optionsSumMap[rid] ?? 0) + (Number(row.total_price) || 0)
          })
        }
        setReservationOptionsSumByReservation(prev => ({ ...prev, ...optionsSumMap }))

        // 금액 Audit 여부 조회 (amount_audited, amount_audited_at, amount_audited_by)
        const auditMap: Record<string, { amount_audited: boolean; amount_audited_at: string | null; amount_audited_by: string | null }> = {}
        try {
          for (let i = 0; i < reservationIds.length; i += chunkSize) {
            const chunk = reservationIds.slice(i, i + chunkSize)
            const { data: auditData } = await supabase
              .from('reservations')
              .select('id, amount_audited, amount_audited_at, amount_audited_by')
              .in('id', chunk)
            auditData?.forEach((row: any) => {
              auditMap[row.id] = {
                amount_audited: !!row.amount_audited,
                amount_audited_at: row.amount_audited_at ?? null,
                amount_audited_by: row.amount_audited_by ?? null
              }
            })
          }
          setReservationAudit(prev => ({ ...prev, ...auditMap }))
        } catch {
          // 컬럼 미존재 시 무시
        }

        setReservationPrices(pricesMap)
        setReservationPricingData(pricingDataMap)
      } catch (error) {
        console.error('예약 가격 정보 가져오기 오류:', error)
        setReservationPrices({})
        setReservationPricingData({})
      } finally {
        setPricesLoading(false)
      }
    }

    fetchPrices()
  }, [filteredReservations])

  // 예약 내역 데이터 포맷팅 및 정렬 (등록일 기준)
  const reservationItems = useMemo<ReservationItem[]>(() => {
    const items = filteredReservations.map(reservation => {
      const pricing = reservationPricingData[reservation.id] || {
        adultPrice: 0,
        productPriceTotal: 0,
        optionTotal: 0,
        subtotal: 0,
        commissionAmount: 0,
        couponDiscount: 0,
        additionalDiscount: 0,
        additionalCost: 0,
        tax: 0,
        depositAmount: 0,
        balanceAmount: 0,
        choicesTotal: 0,
        cardFee: 0,
        prepaymentTip: 0,
        prepaymentCost: 0,
        notIncludedPrice: 0,
        onlinePaymentAmount: 0,
        channelSettlementStored: null,
        pricingCommissionPercent: null,
        commissionBasePrice: null,
        pricingAdults: null,
      }
      const pricingAdultsResolved =
        pricing.pricingAdults != null
          ? pricing.pricingAdults
          : Math.max(0, Math.floor(Number(reservation.adults ?? 0)))
      const channelSettlementAmount = pricing.channelSettlementStored
      return {
        id: reservation.id,
        tourDate: reservation.tourDate,
        registrationDate: reservation.addedTime,
        customerId: reservation.customerId,
        customerName: getCustomerName(reservation.customerId, customers || []),
        productId: reservation.productId,
        productName: getProductName(reservation.productId, products || []),
        totalPeople: reservation.totalPeople,
        adults: reservation.adults || 0,
        child: reservation.child || 0,
        infant: reservation.infant || 0,
        pricingAdults: pricingAdultsResolved,
        status: reservation.status,
        channelRN: reservation.channelRN || '',
        channelId: reservation.channelId,
        channelName: getChannelName(reservation.channelId, channels || []),
        totalPrice: reservationPrices[reservation.id] || 0,
        adultPrice: pricing.adultPrice,
        productPriceTotal: pricing.productPriceTotal,
        optionTotal: pricing.optionTotal,
        subtotal: pricing.subtotal,
        commissionAmount: pricing.commissionAmount,
        couponDiscount: pricing.couponDiscount,
        additionalDiscount: pricing.additionalDiscount,
        additionalCost: pricing.additionalCost,
        tax: pricing.tax,
        depositAmount: pricing.depositAmount,
        balanceAmount: pricing.balanceAmount,
        cardFee: pricing.cardFee,
        prepaymentTip: pricing.prepaymentTip,
        partnerReceivedAmount: partnerReceivedByReservation[reservation.id] ?? 0,
        channelSettlementAmount,
        pricingCommissionPercent: pricing.pricingCommissionPercent ?? null,
        amountAudited: reservationAudit[reservation.id]?.amount_audited ?? false,
        amountAuditedAt: reservationAudit[reservation.id]?.amount_audited_at ?? null,
        amountAuditedBy: reservationAudit[reservation.id]?.amount_audited_by ?? null,
        ...(pricing.commissionBasePrice != null ? { commissionBasePrice: pricing.commissionBasePrice } : {}),
      }
    })
    
    // 등록일별 정렬
    return items.sort((a, b) => {
      const dateA = new Date(a.registrationDate).getTime()
      const dateB = new Date(b.registrationDate).getTime()
      return reservationSortOrder === 'asc' ? dateA - dateB : dateB - dateA
    })
  }, [
    filteredReservations,
    customers,
    products,
    channels,
    reservationPrices,
    reservationPricingData,
    reservationSortOrder,
    partnerReceivedByReservation,
    returnedAmountByReservation,
    reservationAudit,
  ])

  // 선택된 채널의 투어 진행 내역 가져오기 (투어 날짜 기준 예약 목록)
  useEffect(() => {
    const fetchTourReservations = async () => {
      setToursLoading(true)
      try {
        // 선택된 채널의 예약들 중 기간 필터에 맞는 것들
        // 투어 날짜 기준으로 필터링 (기간 필터 적용)
        let tourDateFilteredReservations = reservations.filter(reservation => {
          // 투어 날짜 기준 기간 필터
          const tourDate = new Date(reservation.tourDate)
          const startDate = new Date(dateRange.start)
          const endDate = new Date(dateRange.end)
          endDate.setHours(23, 59, 59, 999)
          
          if (!(tourDate >= startDate && tourDate <= endDate)) return false
          
          return true
        })

        // 추가 필터링 (채널, 상태, 검색)
        tourDateFilteredReservations = tourDateFilteredReservations.filter(reservation => {
          // 채널 필터 (선택된 경우에만)
          if (selectedChannelId && reservation.channelId !== selectedChannelId) return false
          
          // 상태 필터 (선택된 경우에만)
          if (selectedStatuses.length > 0 && !selectedStatuses.includes(reservation.status)) return false

          // 검색 필터
          if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim()
            const customerName = getCustomerName(reservation.customerId, customers || []).toLowerCase()
            const channelRN = reservation.channelRN?.toLowerCase() || ''
            const productName = getProductName(reservation.productId, products || []).toLowerCase()
            const tourDate = new Date(reservation.tourDate).toLocaleDateString('ko-KR')
            const regDate = new Date(reservation.addedTime).toLocaleDateString('ko-KR')
            
            if (
              !customerName.includes(query) &&
              !channelRN.includes(query) &&
              !productName.includes(query) &&
              !tourDate.includes(query) &&
              !regDate.includes(query)
            ) {
              return false
            }
          }

          return true
        })

        tourDateFilteredReservations = dedupeById(tourDateFilteredReservations)

        if (tourDateFilteredReservations.length === 0) {
          setTourItems([])
          setToursLoading(false)
          return
        }

        // 예약 가격 정보 가져오기
        const reservationIds = tourDateFilteredReservations.map(r => r.id)
        
        const pricesMap: Record<string, number> = {}
        const pricingDataMap: Record<string, ChannelTabPricingState> = {}

        // URL 길이 제한을 피하기 위해 청크 단위로 나눠서 요청 (한 번에 최대 100개씩)
        if (reservationIds.length > 0) {
          const chunkSize = 100
          for (let i = 0; i < reservationIds.length; i += chunkSize) {
            const chunk = reservationIds.slice(i, i + chunkSize)

            // 투어 상세「채널 정산 금액」은 channel_settlement_amount만 사용. commission_base_price는 인보이스 PDF 산식용으로만 매핑.
            const { data: pricingData, error } = await supabase
              .from('reservation_pricing')
              .select(CHANNEL_SETTLEMENT_PRICING_SELECT)
              .in('reservation_id', chunk)

            if (error) {
              console.error('예약 가격 조회 오류 (청크):', error, { chunkSize: chunk.length, chunkIndex: i / chunkSize })
              continue // 다음 청크 계속 처리
            }
            
            pricingData?.forEach((p: any) => {
              pricesMap[p.reservation_id] = p.total_price || 0
              pricingDataMap[p.reservation_id] = mapPricingRowToChannelTabState(p)
            })
          }
        }

        // 입금내역 (Partner Received / Returned / Refunded) 및 Audit 조회 (투어 탭용)
        const partnerReceivedMap: Record<string, number> = {}
        const returnedMapTour: Record<string, number> = {}
        const refundedOurTourMap: Record<string, number> = {}
        const auditMap: Record<string, { amount_audited: boolean; amount_audited_at: string | null; amount_audited_by: string | null }> = {}
        if (reservationIds.length > 0) {
          const chunkSize = 100
          for (let i = 0; i < reservationIds.length; i += chunkSize) {
            const chunk = reservationIds.slice(i, i + chunkSize)
            const { data: paymentData } = await supabase
              .from('payment_records')
              .select('reservation_id, amount, payment_status')
              .in('reservation_id', chunk)
            paymentData?.forEach((row: { reservation_id: string; amount: number | null; payment_status?: string | null }) => {
              const rid = row.reservation_id
              const amt = Number(row.amount) || 0
              if (row.payment_status === 'Partner Received') {
                partnerReceivedMap[rid] = (partnerReceivedMap[rid] ?? 0) + amt
              }
              const st = row.payment_status || ''
              const sl = st.toLowerCase()
              if (st.includes('Refunded') || sl === 'refunded') {
                refundedOurTourMap[rid] = (refundedOurTourMap[rid] ?? 0) + amt
              } else if (st.includes('Returned') || sl === 'returned') {
                returnedMapTour[rid] = (returnedMapTour[rid] ?? 0) + amt
              }
            })
            try {
              const { data: auditData } = await supabase
                .from('reservations')
                .select('id, amount_audited, amount_audited_at, amount_audited_by')
                .in('id', chunk)
              auditData?.forEach((row: any) => {
                auditMap[row.id] = {
                  amount_audited: !!row.amount_audited,
                  amount_audited_at: row.amount_audited_at ?? null,
                  amount_audited_by: row.amount_audited_by ?? null
                }
              })
            } catch { /* 컬럼 미존재 시 무시 */ }
          }
          setPartnerReceivedByReservation(prev => ({ ...prev, ...partnerReceivedMap }))
          setReturnedAmountByReservation(prev => ({ ...prev, ...returnedMapTour }))
          setRefundedOurByReservation(prev => ({ ...prev, ...refundedOurTourMap }))
          setReservationAudit(prev => ({ ...prev, ...auditMap }))

          const optionsSumTourMap: Record<string, number> = {}
          for (let i = 0; i < reservationIds.length; i += chunkSize) {
            const chunk = reservationIds.slice(i, i + chunkSize)
            const { data: optRows } = await supabase
              .from('reservation_options')
              .select('reservation_id, total_price, status')
              .in('reservation_id', chunk)
            optRows?.forEach((row: { reservation_id: string; total_price?: number | null; status?: string | null }) => {
              const rid = row.reservation_id
              const ost = String(row.status || '').toLowerCase()
              if (ost === 'cancelled' || ost === 'refunded') return
              optionsSumTourMap[rid] = (optionsSumTourMap[rid] ?? 0) + (Number(row.total_price) || 0)
            })
          }
          setReservationOptionsSumByReservation(prev => ({ ...prev, ...optionsSumTourMap }))
        }

        setReservationPricingData((prev) => ({ ...prev, ...pricingDataMap }))

        // 예약 아이템으로 변환
        const tourReservationItems: ReservationItem[] = tourDateFilteredReservations.map(reservation => {
          const pricing = pricingDataMap[reservation.id] || {
            adultPrice: 0,
            productPriceTotal: 0,
            optionTotal: 0,
            subtotal: 0,
            commissionAmount: 0,
            couponDiscount: 0,
            additionalDiscount: 0,
            additionalCost: 0,
            tax: 0,
            depositAmount: 0,
            balanceAmount: 0,
            choicesTotal: 0,
            cardFee: 0,
            prepaymentTip: 0,
            prepaymentCost: 0,
            notIncludedPrice: 0,
            onlinePaymentAmount: 0,
            channelSettlementStored: null,
            pricingCommissionPercent: null,
            commissionBasePrice: null,
            pricingAdults: null,
          }
          /** 채널 정산 금액: `channel_settlement_amount`만 (commission_base_price 미사용) */
          const channelSettlementAmount = pricing.channelSettlementStored
          const pricingAdultsResolved =
            pricing.pricingAdults != null
              ? pricing.pricingAdults
              : Math.max(0, Math.floor(Number(reservation.adults ?? 0)))
          const baseRow = {
          id: reservation.id,
          tourDate: reservation.tourDate,
          registrationDate: reservation.addedTime,
          customerId: reservation.customerId,
          customerName: getCustomerName(reservation.customerId, customers || []),
          productId: reservation.productId,
          productName: getProductName(reservation.productId, products || []),
          totalPeople: reservation.totalPeople,
            adults: reservation.adults || 0,
            child: reservation.child || 0,
            infant: reservation.infant || 0,
            pricingAdults: pricingAdultsResolved,
          status: reservation.status,
          channelRN: reservation.channelRN || '',
            channelId: reservation.channelId,
            channelName: getChannelName(reservation.channelId, channels || []),
            totalPrice: pricesMap[reservation.id] || 0,
            adultPrice: pricing.adultPrice,
            productPriceTotal: pricing.productPriceTotal,
            optionTotal: pricing.optionTotal,
            subtotal: pricing.subtotal,
            commissionAmount: pricing.commissionAmount,
            couponDiscount: pricing.couponDiscount,
            additionalDiscount: pricing.additionalDiscount,
            additionalCost: pricing.additionalCost,
            tax: pricing.tax,
            depositAmount: pricing.depositAmount,
            balanceAmount: pricing.balanceAmount,
            cardFee: pricing.cardFee,
            prepaymentTip: pricing.prepaymentTip,
            partnerReceivedAmount: partnerReceivedMap[reservation.id] ?? 0,
            channelSettlementAmount,
            pricingCommissionPercent: pricing.pricingCommissionPercent ?? null,
            amountAudited: auditMap[reservation.id]?.amount_audited ?? false,
            amountAuditedAt: auditMap[reservation.id]?.amount_audited_at ?? null,
            amountAuditedBy: auditMap[reservation.id]?.amount_audited_by ?? null
          }
          return {
            ...baseRow,
            ...(pricing.commissionBasePrice != null ? { commissionBasePrice: pricing.commissionBasePrice } : {}),
          }
        })

        setTourItems(tourReservationItems)
      } catch (error) {
        console.error('투어 진행 내역 조회 오류:', error)
        setTourItems([])
      } finally {
        setToursLoading(false)
      }
    }

    fetchTourReservations()
  }, [reservations, selectedChannelId, selectedStatuses, dateRange, customers, products, channels, searchQuery, isOtaChannelId])

  // 투어 내역 정렬
  const sortedTourItems = useMemo(() => {
    return [...tourItems].sort((a, b) => {
      const dateA = new Date(a.tourDate).getTime()
      const dateB = new Date(b.tourDate).getTime()
      return tourSortOrder === 'asc' ? dateA - dateB : dateB - dateA
    })
  }, [tourItems, tourSortOrder])

  // 합계 계산
  const totals = useMemo(() => {
    const reservationTotalPrice = reservationItems.reduce((sum, r) => sum + r.totalPrice, 0)
    const reservationTotalPeople = reservationItems.reduce((sum, r) => sum + billingAdultsFromRow(r), 0)
    const tourTotalPrice = sortedTourItems.reduce((sum, t) => sum + t.totalPrice, 0)
    const tourTotalPeople = sortedTourItems.reduce((sum, t) => sum + billingAdultsFromRow(t), 0)

    return {
      reservations: {
        count: reservationItems.length,
        totalPeople: reservationTotalPeople,
        totalPrice: reservationTotalPrice
      },
      tours: {
        count: sortedTourItems.length,
        totalPeople: tourTotalPeople,
        totalPrice: tourTotalPrice
      }
    }
  }, [reservationItems, sortedTourItems])

  // 선택된 채널명 가져오기 (early return 이전에 위치해야 함)
  const selectedChannelName = useMemo(() => {
    if (!channelFilter) return '전체 채널'
    return getChannelName(channelFilter, channels || []) || '알 수 없는 채널'
  }, [channelFilter, channels])

  if (reservationsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-3 sm:space-y-4 overflow-x-hidden max-w-full">
      {/* 채널 선택 버튼 */}
      <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Filter className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500 flex-shrink-0" />
          <span className="text-xs sm:text-sm font-medium text-gray-700">채널 필터:</span>
          <button
            onClick={() => setIsChannelModalOpen(true)}
            className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium text-blue-700 transition-colors flex items-center gap-1.5"
          >
            <span className="truncate max-w-[140px] sm:max-w-none">{selectedChannelName}</span>
            <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
          </button>
          {channelFilter && (
            <button
              onClick={() => onChannelChange?.('')}
              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
              title="필터 제거"
            >
              <X className="h-3 w-3" />
              초기화
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (!channelFilter) return
              setOtaReconcileSession({
                channelId: channelFilter,
                channelName: selectedChannelName === '전체 채널' ? '' : selectedChannelName,
                periodNote: `${dateRange.start} ~ ${dateRange.end} · 상단 버튼: 채널 전체 예약과 비교`,
              })
            }}
            disabled={!channelFilter}
            title={
              !channelFilter
                ? '채널을 하나 선택한 뒤 사용하세요'
                : 'OTA CSV/PDF·Excel과 채널 정산 금액 비교 (이 채널 DB 예약 전체)'
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet className="h-4 w-4 flex-shrink-0" />
            정산 비교
          </button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
            <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 sm:gap-0">
                <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg flex-shrink-0">
                  <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                </div>
                <div className="min-w-0 sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">예약 건수</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{totals.reservations.count}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 sm:gap-0">
                <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg flex-shrink-0">
                  <Users className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                </div>
                <div className="min-w-0 sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate" title="reservation_pricing.pricing_adults 합 (없으면 예약 성인)">
                    청구 성인 합
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{totals.reservations.totalPeople}명</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 sm:gap-0">
                <div className="p-1.5 sm:p-2 bg-purple-100 rounded-lg flex-shrink-0">
                  <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                </div>
                <div className="min-w-0 sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">투어 예약</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{totals.tours.count}건</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200 col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2 sm:gap-0">
                <div className="p-1.5 sm:p-2 bg-yellow-100 rounded-lg flex-shrink-0">
                  <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600" />
                </div>
                <div className="min-w-0 sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">투어 총액</p>
                  <p className="text-lg sm:text-2xl font-bold text-green-600 truncate">
                    ${totals.tours.totalPrice.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 상세 내역 탭 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* 탭 네비게이션 */}
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex gap-4 sm:gap-8 px-3 sm:px-6 overflow-x-auto">
                <button
                  onClick={() => setChannelUi((u) => ({ ...u, activeDetailTab: 'reservations' }))}
                  className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                    activeDetailTab === 'reservations'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  예약 내역
                </button>
                <button
                  onClick={() => setChannelUi((u) => ({ ...u, activeDetailTab: 'tours' }))}
                  className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                    activeDetailTab === 'tours'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  투어 진행 내역
                </button>
              </nav>
            </div>

            {/* 예약 내역 탭 */}
            {activeDetailTab === 'reservations' && (
          <div className="divide-y divide-gray-200">
            {/* 정렬 버튼 */}
            <div className="px-3 sm:px-6 py-2 sm:py-3 bg-gray-50 border-b border-gray-200">
                      <button
                        onClick={() =>
                          setChannelUi((u) => ({
                            ...u,
                            reservationSortOrder: u.reservationSortOrder === 'asc' ? 'desc' : 'asc',
                          }))
                        }
                className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
                        title="등록일로 정렬"
                      >
                <span>등록일 정렬</span>
                        <span className={`transition-transform ${reservationSortOrder === 'asc' ? '-rotate-180' : 'rotate-0'}`}>
                  <ChevronDown size={16} />
                        </span>
                      </button>
            </div>

            {channelGroups.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                {pricesLoading ? '가격 정보를 불러오는 중...' : '채널 데이터가 없습니다.'}
              </div>
            ) : (
               channelGroups.map(group => {
                 const isGroupExpanded = expandedGroups.has(group.type)
                 const groupReservations = dedupeById(
                   group.channels.flatMap(ch => getReservationsByChannel(ch.id))
                 )
                 const groupReservationIdSet = new Set(groupReservations.map((r) => r.id))
                 const groupTotal = reservationItems
                   .filter((i) => groupReservationIdSet.has(i.id))
                   .reduce(
                     (sum, item) =>
                       sum +
                       buildCompanyTotalRevenueForChannelRow(item, reservationRowPricingExtras(item.id), {
                         returnedAmount: returnedAmountByReservation[item.id] ?? 0,
                         partnerReceived: partnerReceivedByReservation[item.id] ?? 0,
                         refundedOur: refundedOurByReservation[item.id] ?? 0,
                         reservationOptionsSum: reservationOptionsSumByReservation[item.id] ?? 0,
                         isOta: isOtaChannelId(item.channelId),
                         isHomepageChannel: isHomepageBookingChannel(item.channelId, channels),
                       }),
                     0
                   )

                 // 자체 채널은 바로 모든 예약을 합쳐서 표시
                 if (group.type === 'SELF') {
                   const allChannelItems = reservationItems
                     .filter((i) => groupReservationIdSet.has(i.id))
                     .sort((a, b) => {
                       const dateA = new Date(a.registrationDate).getTime()
                       const dateB = new Date(b.registrationDate).getTime()
                       return reservationSortOrder === 'asc' ? dateA - dateB : dateB - dateA
                     })

                   return (
                     <div key={group.type} className="border-b border-gray-200">
                       {/* 자체 채널 그룹 헤더 */}
                       <button
                         onClick={() => toggleGroup(group.type)}
                         className="w-full px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                       >
<div className="flex flex-wrap items-center gap-1.5 sm:gap-3 min-w-0">
                         {isGroupExpanded ? (
                             <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 flex-shrink-0" />
                           ) : (
                             <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 flex-shrink-0" />
                           )}
                         <span className="font-semibold text-gray-900 text-sm sm:text-base truncate">{group.label}</span>
                         <span className="text-xs sm:text-sm text-gray-500">({group.channels.length}개)</span>
                         <span className="text-xs sm:text-sm font-medium text-green-600">
                             총 ${groupTotal.toLocaleString()}
                           </span>
                         </div>
                       </button>

                       {/* 자체 채널의 모든 예약 내역 테이블 */}
                       {isGroupExpanded && (
                         <div className="overflow-x-auto bg-gray-50">
                           <table className="w-full divide-y divide-gray-200 text-xs">
                             <thead className="bg-white">
                               <tr>
                                 <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-20">상태</th>
                                 <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">등록일</th>
                                 <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-32">고객명</th>
                                 <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">채널RN</th>
                                 <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">채널</th>
                                 <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase" style={{ width: '150px', minWidth: '150px', maxWidth: '150px' }}>상품명</th>
                                 <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-16" title="reservation_pricing.pricing_adults">인원</th>
                                 <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">성인 가격</th>
                                 <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">상품가격 합계</th>
                                 <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">할인총액</th>
                                 <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">추가비용 총액</th>
                                 <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">Grand Total</th>
                                 <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">커미션</th>
                                 <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">총 가격</th>
                                 <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">옵션 총합</th>
                                 <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24" title="예약 수정 · 가격정보 · 4. 총 매출과 동일 산식">총 매출</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                               {allChannelItems.length === 0 ? (
                    <tr>
                                   <td colSpan={16} className="px-2 py-3 text-center text-gray-500 text-xs">
                                     예약 내역이 없습니다.
                      </td>
                    </tr>
                  ) : (
                                 allChannelItems.map((item, idx) => {
                                   const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                                   const grandTotal = (item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0)
                                   const totalPrice = grandTotal - (item.commissionAmount || 0)
                                   const companyRev = buildCompanyTotalRevenueForChannelRow(
                                     item,
                                     reservationRowPricingExtras(item.id),
                                     {
                                       returnedAmount: returnedAmountByReservation[item.id] ?? 0,
                                       partnerReceived: partnerReceivedByReservation[item.id] ?? 0,
                                       refundedOur: refundedOurByReservation[item.id] ?? 0,
                                       reservationOptionsSum: reservationOptionsSumByReservation[item.id] ?? 0,
                                       isOta: isOtaChannelId(item.channelId),
                                       isHomepageChannel: isHomepageBookingChannel(item.channelId, channels),
                                     }
                                   )
                                   return (
                                     <tr 
                                       key={`self-${item.id}-${idx}`} 
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => openReservationEditModal(item.id)}
                      >
                                       <td className="px-2 py-2 whitespace-nowrap text-xs w-20">
                                         <span className={`px-1.5 py-0.5 rounded text-xs ${getStatusColor(item.status)}`}>
                                           {item.status === 'confirmed' ? '확정' :
                                            item.status === 'pending' ? '대기' :
                                            item.status === 'cancelled' ? '취소' :
                                            item.status === 'completed' ? '완료' :
                                            item.status === 'deleted' ? '삭제됨' :
                                            item.status}
                                         </span>
                        </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 w-24">
                                         {new Date(item.registrationDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                                       </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 w-32 truncate">
                          {item.customerName}
                        </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 w-24 truncate">
                                         {item.channelRN || '-'}
                                       </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 truncate max-w-[120px]">
                                         {item.channelName}
                                       </td>
                                       <td className="px-2 py-2 text-xs text-gray-600 truncate" style={{ width: '150px', minWidth: '150px', maxWidth: '150px' }} title={item.productName}>
                                         {item.productName}
                                       </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 text-center w-16" title="pricing_adults">
                                         {billingAdultsFromRow(item)}
                        </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right w-20">
                                         ${(item.adultPrice || 0).toLocaleString()}
                        </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right w-24">
                                         ${(item.productPriceTotal || 0).toLocaleString()}
                                       </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-red-600 text-right w-20">
                                         -${discountTotal.toLocaleString()}
                                       </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-orange-600 text-right w-24">
                                         ${(item.additionalCost || 0).toLocaleString()}
                                       </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-green-600 font-semibold text-right w-24">
                                         ${grandTotal.toLocaleString()}
                                       </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-blue-600 text-right w-20">
                                         ${(item.commissionAmount || 0).toLocaleString()}
                                       </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-green-600 font-semibold text-right w-20">
                                         ${totalPrice.toLocaleString()}
                                       </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right w-20">
                                         ${(item.optionTotal || 0).toLocaleString()}
                                       </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-purple-600 font-semibold text-right w-24">
                                         ${companyRev.toLocaleString()}
                                       </td>
                                     </tr>
                                   )
                                 })
                               )}
                             </tbody>
                             <tfoot className="bg-gray-50">
                               <tr>
                                 <td colSpan={6} className="px-2 py-2 text-xs font-medium text-gray-900">
                                   합계
                                 </td>
                                 <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-center w-16">
                                   {allChannelItems.reduce((sum, item) => sum + billingAdultsFromRow(item), 0)}
                                 </td>
                                 <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-right">
                                   ${allChannelItems.reduce((sum, item) => sum + (item.adultPrice || 0), 0).toLocaleString()}
                                 </td>
                                 <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-right">
                                   ${allChannelItems.reduce((sum, item) => sum + (item.productPriceTotal || 0), 0).toLocaleString()}
                                 </td>
                                 <td className="px-2 py-2 text-xs font-semibold text-red-600 text-right">
                                   -${allChannelItems.reduce((sum, item) => sum + (item.couponDiscount || 0) + (item.additionalDiscount || 0), 0).toLocaleString()}
                                 </td>
                                 <td className="px-2 py-2 text-xs font-semibold text-orange-600 text-right">
                                   ${allChannelItems.reduce((sum, item) => sum + (item.additionalCost || 0), 0).toLocaleString()}
                                 </td>
                                 <td className="px-2 py-2 text-xs font-semibold text-green-600 text-right">
                                   ${allChannelItems.reduce((sum, item) => {
                                     const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                                     return sum + ((item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0))
                                   }, 0).toLocaleString()}
                                 </td>
                                 <td className="px-2 py-2 text-xs font-semibold text-blue-600 text-right">
                                   ${allChannelItems.reduce((sum, item) => sum + (item.commissionAmount || 0), 0).toLocaleString()}
                                 </td>
                                 <td className="px-2 py-2 text-xs font-semibold text-green-600 text-right">
                                   ${allChannelItems.reduce((sum, item) => {
                                     const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                                     const grandTotal = (item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0)
                                     return sum + (grandTotal - (item.commissionAmount || 0))
                                   }, 0).toLocaleString()}
                                 </td>
                                 <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-right">
                                   ${allChannelItems.reduce((sum, item) => sum + (item.optionTotal || 0), 0).toLocaleString()}
                                 </td>
                                 <td className="px-2 py-2 text-xs font-semibold text-purple-600 text-right">
                                   ${groupTotal.toLocaleString()}
                                 </td>
                               </tr>
                             </tfoot>
                           </table>
                         </div>
                       )}
                     </div>
                   )
                 }

                 // OTA 채널은 기존대로 채널별로 나누어 표시
                 return (
                   <div key={group.type} className="border-b border-gray-200">
                     {/* 그룹 헤더 */}
                     <button
                       onClick={() => toggleGroup(group.type)}
                       className="w-full px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                     >
<div className="flex flex-wrap items-center gap-1.5 sm:gap-3 min-w-0">
                         {isGroupExpanded ? (
                             <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 flex-shrink-0" />
                           ) : (
                             <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 flex-shrink-0" />
                           )}
                         <span className="font-semibold text-gray-900 text-sm sm:text-base truncate">{group.label}</span>
                         <span className="text-xs sm:text-sm text-gray-500">({group.channels.length}개)</span>
                         <span className="text-xs sm:text-sm font-medium text-green-600">
                           총 ${groupTotal.toLocaleString()}
                         </span>
                       </div>
                     </button>

                     {/* 채널 목록 */}
                     {isGroupExpanded && (
                       <div className="bg-gray-50">
                         {group.channels.map(channel => {
                          const channelReservations = getReservationsByChannel(channel.id)
                          const isChannelExpanded = expandedChannels.has(channel.id)
                          
                          // 채널별 예약 아이템 생성 및 정렬
                          const channelItems = channelReservations.map(reservation => {
                            const pricing = reservationPricingData[reservation.id] || {
                              adultPrice: 0,
                              productPriceTotal: 0,
                              optionTotal: 0,
                              subtotal: 0,
                              commissionAmount: 0,
                              couponDiscount: 0,
                              additionalDiscount: 0,
                              additionalCost: 0,
                              tax: 0,
                              depositAmount: 0,
                              balanceAmount: 0,
                              choicesTotal: 0,
                              cardFee: 0,
                              prepaymentTip: 0,
                              prepaymentCost: 0,
                              notIncludedPrice: 0,
                              onlinePaymentAmount: 0,
                              channelSettlementStored: null,
                              pricingCommissionPercent: null,
                              commissionBasePrice: null,
                              pricingAdults: null,
                            }
                            const pricingAdultsResolved =
                              pricing.pricingAdults != null
                                ? pricing.pricingAdults
                                : Math.max(0, Math.floor(Number(reservation.adults ?? 0)))
                            const channelSettlementAmount = pricing.channelSettlementStored
                            return {
                              id: reservation.id,
                              tourDate: reservation.tourDate,
                              registrationDate: reservation.addedTime,
                              customerId: reservation.customerId,
                              customerName: getCustomerName(reservation.customerId, customers || []),
                              productId: reservation.productId,
                              productName: getProductName(reservation.productId, products || []),
                              totalPeople: reservation.totalPeople,
                              adults: reservation.adults || 0,
                              child: reservation.child || 0,
                              infant: reservation.infant || 0,
                              pricingAdults: pricingAdultsResolved,
                              status: reservation.status,
                              channelRN: reservation.channelRN || '',
                              channelId: channel.id,
                              channelName: channel.name,
                              totalPrice: reservationPrices[reservation.id] || 0,
                              adultPrice: pricing.adultPrice,
                              productPriceTotal: pricing.productPriceTotal,
                              optionTotal: pricing.optionTotal,
                              subtotal: pricing.subtotal,
                              commissionAmount: pricing.commissionAmount,
                              couponDiscount: pricing.couponDiscount,
                              additionalDiscount: pricing.additionalDiscount,
                              additionalCost: pricing.additionalCost,
                              tax: pricing.tax,
                              depositAmount: pricing.depositAmount,
                              balanceAmount: pricing.balanceAmount,
                              cardFee: pricing.cardFee,
                              prepaymentTip: pricing.prepaymentTip,
                              partnerReceivedAmount: partnerReceivedByReservation[reservation.id] ?? 0,
                              channelSettlementAmount,
                              pricingCommissionPercent: pricing.pricingCommissionPercent ?? null,
                              amountAudited: reservationAudit[reservation.id]?.amount_audited ?? false,
                              amountAuditedAt: reservationAudit[reservation.id]?.amount_audited_at ?? null,
                              amountAuditedBy: reservationAudit[reservation.id]?.amount_audited_by ?? null,
                              ...(pricing.commissionBasePrice != null
                                ? { commissionBasePrice: pricing.commissionBasePrice }
                                : {}),
                            }
                          }).sort((a, b) => {
                            const dateA = new Date(a.registrationDate).getTime()
                            const dateB = new Date(b.registrationDate).getTime()
                            return reservationSortOrder === 'asc' ? dateA - dateB : dateB - dateA
                          })

                          const displayChannelItems = enrichItemsWithCompanyTotalRevenue(channelItems)
                          const channelRowTotals = aggregateChannelPricingRows(displayChannelItems)

                          return (
                            <div key={channel.id} className="border-t border-gray-200">
                              {/* 채널 헤더 */}
                              <button
                                onClick={() => toggleChannel(channel.id)}
                                className="w-full px-3 sm:px-8 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2 hover:bg-gray-100 transition-colors text-left"
                              >
<div className="flex flex-wrap items-center gap-1.5 sm:gap-3 min-w-0">
                                {isChannelExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                )}
                                  <span className="font-medium text-gray-800 text-sm sm:text-base truncate">{channel.name}</span>
                                  <span className="text-xs text-gray-500">({channelItems.length}건)</span>
                                  <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-1 text-[11px] sm:text-xs">
                                    <span className="font-medium text-green-600">
                                      Grand Total: ${formatUsd2(channelRowTotals.grandTotal)}
                                    </span>
                                    <span className="font-medium text-blue-600">
                                      Commission: ${formatUsd2(channelRowTotals.commission)}
                                    </span>
                                    <span className="font-medium text-purple-600">
                                      총 가격: ${formatUsd2(channelRowTotals.totalPrice)}
                                    </span>
                                    <span className="font-medium text-gray-700">
                                      옵션: ${formatUsd2(channelRowTotals.optionTotal)}
                                    </span>
                                    <span className="font-medium text-purple-600">
                                      총 매출: ${formatUsd2(channelRowTotals.netPrice)}
                                    </span>
                                    <span
                                      className="font-medium text-teal-600"
                                      title="순입금 = 파트너 수령 − Returned(파트너 환불)"
                                    >
                                      입금내역: ${formatUsd2(channelRowTotals.partnerReceived)}
                                    </span>
                                    <span className="font-medium text-amber-600">
                                      채널 정산: ${formatUsd2(channelRowTotals.channelSettlement)}
                                    </span>
                                  </div>
                                </div>
                              </button>

                              {/* 채널 예약 내역 테이블 */}
                              {isChannelExpanded && (
                                <div className="overflow-x-auto">
                                  <table className="w-full divide-y divide-gray-200 text-xs">
                                    <thead className="bg-white">
                                      <tr>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-20">상태</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">등록일</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-32">고객명</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">채널RN</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase" style={{ width: '150px', minWidth: '150px', maxWidth: '150px' }}>상품명</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-16" title="reservation_pricing.pricing_adults">인원</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">성인 가격</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">상품가격 합계</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">할인총액</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">추가비용 총액</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">Grand Total</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">커미션</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">총 가격</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">옵션 총합</th>
                                        <th
                                          className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24"
                                          title="예약 수정 · 가격정보 · 4. 총 매출과 동일 산식"
                                        >
                                          총 매출
                                        </th>
                                        <th
                                          className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24"
                                          title="순입금 = 파트너 수령 − Returned(파트너 환불). 행 툴팁에 수령·환불 금액이 표시됩니다."
                                        >
                                          입금내역 (Partner Received)
                                        </th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">채널 정산 금액</th>
                                        <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase w-20">Audit</th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                      {channelItems.length === 0 ? (
                                        <tr>
                                          <td colSpan={18} className="px-2 py-3 text-center text-gray-500 text-xs">
                                            예약 내역이 없습니다.
                                          </td>
                                        </tr>
                                      ) : (
                                        displayChannelItems.map((item, idx) => {
                                          const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                                          const grandTotal = (item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0)
                                          const totalPrice = grandTotal - (item.commissionAmount || 0)
                                          const companyRev = item.companyTotalRevenue ?? totalPrice + (item.optionTotal || 0)
                                          const pr = partnerReceivedByReservation[item.id] ?? 0
                                          const ret = returnedAmountByReservation[item.id] ?? 0
                                          const partnerNet = item.partnerReceivedNet ?? Math.max(0, Math.round((pr - ret) * 100) / 100)
                                          const partnerTitle = partnerReceivedNetTooltip(pr, ret)
                                          const effectiveAudited = reservationAudit[item.id]?.amount_audited ?? item.amountAudited
                                          const effectiveAuditedAt = reservationAudit[item.id]?.amount_audited_at ?? item.amountAuditedAt
                                          const effectiveAuditedBy = reservationAudit[item.id]?.amount_audited_by ?? item.amountAuditedBy
                                          const auditTooltip = !canAudit
                                            ? 'Super 권한이 있는 사용자만 Audit 할 수 있습니다'
                                            : effectiveAudited && (effectiveAuditedBy || effectiveAuditedAt)
                                              ? `Audit: ${effectiveAuditedBy ?? '-'} / ${effectiveAuditedAt ? new Date(effectiveAuditedAt).toLocaleString('ko-KR') : '-'}`
                                              : '금액 더블체크 완료 시 체크'
                                          return (
                                            <tr 
                                              key={`${channel.id}-${item.id}-${idx}`} 
                                              className="hover:bg-gray-50 cursor-pointer transition-colors"
                                              onClick={() => openReservationEditModal(item.id)}
                                            >
                                              <td className="px-2 py-2 whitespace-nowrap text-xs w-20">
                                                <span className={`px-1.5 py-0.5 rounded text-xs ${getStatusColor(item.status)}`}>
                                                  {item.status === 'confirmed' ? '확정' :
                                                   item.status === 'pending' ? '대기' :
                                                   item.status === 'cancelled' ? '취소' :
                                                   item.status === 'completed' ? '완료' :
                                                   item.status === 'deleted' ? '삭제됨' :
                             item.status}
                          </span>
                        </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 w-24">
                                                {new Date(item.registrationDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 w-32 truncate">
                                                {item.customerName}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 w-24 truncate">
                          {item.channelRN || '-'}
                        </td>
                                              <td className="px-2 py-2 text-xs text-gray-600 truncate" style={{ width: '150px', minWidth: '150px', maxWidth: '150px' }} title={item.productName}>
                                                {item.productName}
                                              </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 text-center w-16" title="pricing_adults">
                                         {billingAdultsFromRow(item)}
                                       </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right w-20">
                                                ${(item.adultPrice || 0).toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right w-24">
                                                ${(item.productPriceTotal || 0).toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-red-600 text-right w-20">
                                                -${discountTotal.toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-orange-600 text-right w-24">
                                                ${(item.additionalCost || 0).toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-green-600 font-semibold text-right w-24">
                                                ${grandTotal.toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-blue-600 text-right w-20">
                                                ${(item.commissionAmount || 0).toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-green-600 font-semibold text-right w-20">
                                                ${totalPrice.toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right w-20">
                                                ${(item.optionTotal || 0).toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-purple-600 font-semibold text-right w-24">
                                                ${companyRev.toLocaleString()}
                                              </td>
                                              <td
                                                className="px-2 py-2 whitespace-nowrap text-xs text-teal-600 text-right w-24"
                                                title={partnerTitle}
                                              >
                                                ${partnerNet.toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-amber-600 text-right w-24">
                                                {formatTourChannelSettlementCell(item.channelSettlementAmount)}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-center w-20" onClick={e => e.stopPropagation()} title={auditTooltip}>
                                                <input
                                                  type="checkbox"
                                                  checked={!!effectiveAudited}
                                                  disabled={!canAudit}
                                                  onClick={e => e.stopPropagation()}
                                                  onChange={e => handleToggleAmountAudit(item.id, e.target.checked)}
                                                  className="rounded border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                                />
                                              </td>
                                            </tr>
                                          )
                                        })
                  )}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                                        <td colSpan={5} className="px-2 py-2 text-xs font-medium text-gray-900">
                      합계
                    </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-center w-16">
                                          {channelRowTotals.totalPeople}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-right">
                                          ${formatUsd2(channelRowTotals.adultPriceSum)}
                    </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-right">
                                          ${formatUsd2(channelRowTotals.productPriceTotalSum)}
                    </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-red-600 text-right">
                                          -${formatUsd2(channelRowTotals.discountTotal)}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-orange-600 text-right">
                                          ${formatUsd2(channelRowTotals.additionalCostSum)}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-green-600 text-right">
                                          ${formatUsd2(channelRowTotals.grandTotal)}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-blue-600 text-right">
                                          ${formatUsd2(channelRowTotals.commission)}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-green-600 text-right">
                                          ${formatUsd2(channelRowTotals.totalPrice)}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-right">
                                          ${formatUsd2(channelRowTotals.optionTotal)}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-purple-600 text-right">
                                          ${formatUsd2(channelRowTotals.netPrice)}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-teal-600 text-right">
                                          ${formatUsd2(channelRowTotals.partnerReceived)}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-amber-600 text-right">
                                          ${formatUsd2(channelRowTotals.channelSettlement)}
                                        </td>
                                        <td className="px-2 py-2 text-xs text-gray-500 text-center">—</td>
                  </tr>
                </tfoot>
              </table>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })
            )}
            </div>
            )}

            {/* 투어 진행 내역 탭 */}
            {activeDetailTab === 'tours' && (
          <div className="divide-y divide-gray-200">
            {/* 정렬 버튼 */}
            <div className="px-3 sm:px-6 py-2 sm:py-3 bg-gray-50 border-b border-gray-200">
              <button
                onClick={() =>
                setChannelUi((u) => ({
                  ...u,
                  tourSortOrder: u.tourSortOrder === 'asc' ? 'desc' : 'asc',
                }))
              }
                className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
                title="투어 날짜로 정렬"
              >
                <span>투어 날짜 정렬</span>
                <span className={`transition-transform ${tourSortOrder === 'asc' ? '-rotate-180' : 'rotate-0'}`}>
                  <ChevronDown size={16} />
                </span>
              </button>
            </div>

                {toursLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : channelGroups.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                채널 데이터가 없습니다.
              </div>
            ) : (
              channelGroups.map(group => {
                const isGroupExpanded = expandedGroups.has(group.type)
                const groupTourItems = dedupeById(
                  group.channels.flatMap(ch => getTourItemsByChannel(ch.id))
                )
                const groupTourEnriched = enrichItemsWithCompanyTotalRevenue(groupTourItems)
                const groupTotal = groupTourEnriched.reduce(
                  (sum, item) => sum + (item.companyTotalRevenue ?? 0),
                  0
                )

                // 자체 채널은 바로 모든 예약을 합쳐서 표시
                if (group.type === 'SELF') {
                  const allTourItems = enrichItemsWithCompanyTotalRevenue(
                    groupTourItems.slice().sort((a, b) => {
                      const dateA = new Date(a.tourDate).getTime()
                      const dateB = new Date(b.tourDate).getTime()
                      return tourSortOrder === 'asc' ? dateA - dateB : dateB - dateA
                    })
                  )

                  return (
                    <div key={group.type} className="border-b border-gray-200">
                      {/* 자체 채널 그룹 헤더 */}
                        <button
                        onClick={() => toggleGroup(group.type)}
                        className="w-full px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                      >
<div className="flex flex-wrap items-center gap-1.5 sm:gap-3 min-w-0">
                         {isGroupExpanded ? (
                             <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 flex-shrink-0" />
                           ) : (
                             <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 flex-shrink-0" />
                           )}
                         <span className="font-semibold text-gray-900 text-sm sm:text-base truncate">{group.label}</span>
                         <span className="text-xs sm:text-sm text-gray-500">({group.channels.length}개)</span>
                         <span className="text-xs sm:text-sm font-medium text-green-600">
                            총 ${groupTotal.toLocaleString()}
                          </span>
                        </div>
                        </button>

                      {/* 자체 채널의 모든 투어 내역 테이블 */}
                      {isGroupExpanded && (
                        <div className="overflow-x-auto bg-gray-50">
                          <table className="w-full divide-y divide-gray-200 text-xs">
                            <thead className="bg-white">
                              <tr>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-20">상태</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">투어 날짜</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-32">고객명</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">채널RN</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">채널</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase" style={{ width: '150px', minWidth: '150px', maxWidth: '150px' }}>상품명</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-16" title="reservation_pricing.pricing_adults">인원</th>
                                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">성인 가격</th>
                                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">상품가격 합계</th>
                                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">할인총액</th>
                                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">추가비용 총액</th>
                                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">Grand Total</th>
                                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">커미션</th>
                                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">총 가격</th>
                                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">옵션 총합</th>
                                <th
                                  className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24"
                                  title="예약 수정 · 가격정보 · 4. 총 매출과 동일 산식"
                                >
                                  총 매출
                                </th>
                                <th
                                  className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24"
                                  title="순입금 = 파트너 수령 − Returned(파트너 환불). 행 툴팁에 수령·환불 금액이 표시됩니다."
                                >
                                  입금내역 (Partner Received)
                                </th>
                                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">채널 정산 금액</th>
                                <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase w-20">Audit</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                              {allTourItems.length === 0 ? (
                      <tr>
                                  <td colSpan={19} className="px-2 py-3 text-center text-gray-500 text-xs">
                                    투어 진행 내역이 없습니다.
                        </td>
                      </tr>
                    ) : (
                                allTourItems.map((item, idx) => {
                                  const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                                  const grandTotal = (item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0)
                                  const totalPrice = grandTotal - (item.commissionAmount || 0)
                                  const companyRev =
                                    item.companyTotalRevenue ?? totalPrice + (item.optionTotal || 0)
                                  const pr = partnerReceivedByReservation[item.id] ?? 0
                                  const ret = returnedAmountByReservation[item.id] ?? 0
                                  const partnerNet =
                                    item.partnerReceivedNet ?? Math.max(0, Math.round((pr - ret) * 100) / 100)
                                  const partnerTitle = partnerReceivedNetTooltip(pr, ret)
                                  const effectiveAudited = reservationAudit[item.id]?.amount_audited ?? item.amountAudited
                                  const effectiveAuditedAt = reservationAudit[item.id]?.amount_audited_at ?? item.amountAuditedAt
                                  const effectiveAuditedBy = reservationAudit[item.id]?.amount_audited_by ?? item.amountAuditedBy
                                  const auditTooltip = !canAudit
                                    ? 'Super 권한이 있는 사용자만 Audit 할 수 있습니다'
                                    : effectiveAudited && (effectiveAuditedBy || effectiveAuditedAt)
                                      ? `Audit: ${effectiveAuditedBy ?? '-'} / ${effectiveAuditedAt ? new Date(effectiveAuditedAt).toLocaleString('ko-KR') : '-'}`
                                      : '금액 더블체크 완료 시 체크'
                                  const settlementPctVerify = channelSettlementPctMismatch(
                                    item,
                                    returnedAmountByReservation[item.id] ?? 0,
                                    partnerReceivedByReservation[item.id] ?? 0,
                                    channels,
                                    isOtaChannelId(item.channelId)
                                  )
                                  return (
                                    <tr 
                                      key={`self-tour-${item.id}-${idx}`} 
                          className="hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest('[data-audit-cell]')) return
                            openReservationEditModal(item.id)
                          }}
                        >
                                      <td className="px-2 py-2 whitespace-nowrap text-xs w-20">
                                        <span className={`px-1.5 py-0.5 rounded text-xs ${getStatusColor(item.status)}`}>
                                          {item.status === 'confirmed' ? '확정' :
                                           item.status === 'pending' ? '대기' :
                                           item.status === 'cancelled' ? '취소' :
                                           item.status === 'completed' ? '완료' :
                                           item.status === 'deleted' ? '삭제됨' :
                                           item.status}
                                        </span>
                          </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 w-24">
                                        {item.tourDate ? item.tourDate.split('T')[0] : '-'}
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 w-32 truncate">
                            {item.customerName}
                          </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 w-24 truncate">
                                        {item.channelRN || '-'}
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 truncate max-w-[120px]">
                                        {item.channelName || '-'}
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 truncate w-32">
                                        {item.productName}
                                      </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 text-center w-16" title="pricing_adults">
                                         {billingAdultsFromRow(item)}
                          </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right w-20">
                                        ${(item.adultPrice || 0).toLocaleString()}
                          </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right w-24">
                                        ${(item.productPriceTotal || 0).toLocaleString()}
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-red-600 text-right w-20">
                                        -${discountTotal.toLocaleString()}
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-orange-600 text-right w-24">
                                        ${(item.additionalCost || 0).toLocaleString()}
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-green-600 font-semibold text-right w-24">
                                        ${grandTotal.toLocaleString()}
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-blue-600 text-right w-20">
                                        ${(item.commissionAmount || 0).toLocaleString()}
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-green-600 font-semibold text-right w-20">
                                        ${totalPrice.toLocaleString()}
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right w-20">
                                        ${(item.optionTotal || 0).toLocaleString()}
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-purple-600 font-semibold text-right w-24">
                                        ${companyRev.toLocaleString()}
                                      </td>
                                      <td
                                        className="px-2 py-2 whitespace-nowrap text-xs text-teal-600 text-right w-24"
                                        title={partnerTitle}
                                      >
                                        ${partnerNet.toLocaleString()}
                                      </td>
                                      <td
                                        className={`px-2 py-2 whitespace-nowrap text-xs text-right w-24 ${settlementPctVerify.mismatch ? 'text-red-600 font-semibold' : 'text-amber-600'}`}
                                        title={settlementPctVerify.title}
                                      >
                                        {formatTourChannelSettlementCell(item.channelSettlementAmount)}
                                      </td>
                                      <td data-audit-cell className="px-2 py-2 whitespace-nowrap text-center w-20" onClick={e => e.stopPropagation()} title={auditTooltip}>
                                        <input
                                          type="checkbox"
                                          checked={!!effectiveAudited}
                                          disabled={!canAudit}
                                          onChange={e => handleToggleAmountAudit(item.id, e.target.checked)}
                                          className="rounded border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                        />
                                      </td>
                                    </tr>
                                  )
                                })
                              )}
                            </tbody>
                            <tfoot className="bg-gray-50">
                              <tr>
                                <td colSpan={6} className="px-2 py-2 text-xs font-medium text-gray-900">
                                  합계
                                </td>
                                <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-center w-16">
                                  {allTourItems.reduce((sum, item) => sum + billingAdultsFromRow(item), 0)}
                                </td>
                                <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-right">
                                  ${allTourItems.reduce((sum, item) => sum + (item.adultPrice || 0), 0).toLocaleString()}
                                </td>
                                <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-right">
                                  ${allTourItems.reduce((sum, item) => sum + (item.productPriceTotal || 0), 0).toLocaleString()}
                                </td>
                                <td className="px-2 py-2 text-xs font-semibold text-red-600 text-right">
                                  -${allTourItems.reduce((sum, item) => sum + (item.couponDiscount || 0) + (item.additionalDiscount || 0), 0).toLocaleString()}
                                </td>
                                <td className="px-2 py-2 text-xs font-semibold text-orange-600 text-right">
                                  ${allTourItems.reduce((sum, item) => sum + (item.additionalCost || 0), 0).toLocaleString()}
                                </td>
                                <td className="px-2 py-2 text-xs font-semibold text-green-600 text-right">
                                  ${allTourItems.reduce((sum, item) => {
                                    const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                                    return sum + ((item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0))
                                  }, 0).toLocaleString()}
                                </td>
                                <td className="px-2 py-2 text-xs font-semibold text-blue-600 text-right">
                                  ${allTourItems.reduce((sum, item) => sum + (item.commissionAmount || 0), 0).toLocaleString()}
                                </td>
                                <td className="px-2 py-2 text-xs font-semibold text-green-600 text-right">
                                  ${allTourItems.reduce((sum, item) => {
                                    const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                                    const grandTotal = (item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0)
                                    return sum + (grandTotal - (item.commissionAmount || 0))
                                  }, 0).toLocaleString()}
                                </td>
                                <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-right">
                                  ${allTourItems.reduce((sum, item) => sum + (item.optionTotal || 0), 0).toLocaleString()}
                                </td>
                                <td className="px-2 py-2 text-xs font-semibold text-purple-600 text-right">
                                  ${groupTotal.toLocaleString()}
                                </td>
                                <td className="px-2 py-2 text-xs font-semibold text-teal-600 text-right">
                                  $
                                  {allTourItems
                                    .reduce((sum, item) => sum + (item.partnerReceivedNet ?? 0), 0)
                                    .toLocaleString()}
                                </td>
                                <td className="px-2 py-2 text-xs font-semibold text-amber-600 text-right">
                                  ${allTourItems.reduce((sum, item) => sum + (item.channelSettlementAmount ?? 0), 0).toLocaleString()}
                                </td>
                                <td className="px-2 py-2 text-xs text-gray-500 text-center">—</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                }

                // OTA 채널은 기존대로 채널별로 나누어 표시
                return (
                  <div key={group.type} className="border-b border-gray-200">
                    {/* 그룹 헤더 */}
                    <button
                      onClick={() => toggleGroup(group.type)}
                      className="w-full px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                    >
<div className="flex flex-wrap items-center gap-1.5 sm:gap-3 min-w-0">
                         {isGroupExpanded ? (
                             <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 flex-shrink-0" />
                           ) : (
                             <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 flex-shrink-0" />
                           )}
                         <span className="font-semibold text-gray-900 text-sm sm:text-base truncate">{group.label}</span>
                         <span className="text-xs sm:text-sm text-gray-500">({group.channels.length}개)</span>
                         <span className="text-xs sm:text-sm font-medium text-green-600">
                          총 ${groupTotal.toLocaleString()}
                        </span>
                      </div>
                    </button>

                    {/* 채널 목록 */}
                    {isGroupExpanded && (
                      <div className="bg-gray-50">
                        {group.channels.map(channel => {
                          const channelTourItems = getTourItemsByChannel(channel.id)
                          const isChannelExpanded = expandedChannels.has(channel.id)
                          
                          // 채널별 투어 아이템 정렬
                          const sortedChannelItems = channelTourItems.slice().sort((a, b) => {
                            const dateA = new Date(a.tourDate).getTime()
                            const dateB = new Date(b.tourDate).getTime()
                            return tourSortOrder === 'asc' ? dateA - dateB : dateB - dateA
                          })

                          const displayTourChannelItems = enrichItemsWithCompanyTotalRevenue(sortedChannelItems)

                          const channelRowTotals = aggregateChannelPricingRows(displayTourChannelItems)

                          const formatDateForInvoice = (d: string) => {
                            if (!d) return '-'
                            const dt = new Date(d)
                            const m = (dt.getMonth() + 1).toString().padStart(2, '0')
                            const day = dt.getDate().toString().padStart(2, '0')
                            const y = dt.getFullYear()
                            return `${m}/${day}/${y}`
                          }
                          const buildInvoiceItems = (): ChannelInvoiceItem[] => {
                            const fixedCommissionPct = invoiceChannelCommissionPercent(channel as {
                              commission_percent?: number | null
                              commission_rate?: number | null
                              commission?: number | null
                            })
                            return sortedChannelItems.map((item) => {
                              const returnedAmount = returnedAmountByReservation[item.id] ?? 0
                              const storedCb = Number(item.commissionBasePrice ?? 0)
                              const online = deriveCommissionGrossForSettlement(storedCb, {
                                returnedAmount,
                                depositAmount: item.depositAmount ?? 0,
                                productPriceTotal: item.productPriceTotal ?? 0,
                                isOTAChannel: true,
                              })
                              const channelPayment = computeChannelPaymentAfterReturn({
                                depositAmount: item.depositAmount ?? 0,
                                onlinePaymentAmount: online,
                                productPriceTotal: item.productPriceTotal ?? 0,
                                couponDiscount: item.couponDiscount ?? 0,
                                additionalDiscount: item.additionalDiscount ?? 0,
                                optionTotalSum: item.optionTotal ?? 0,
                                additionalCost: item.additionalCost ?? 0,
                                tax: item.tax ?? 0,
                                cardFee: item.cardFee ?? 0,
                                prepaymentTip: item.prepaymentTip ?? 0,
                                onSiteBalanceAmount: item.balanceAmount ?? 0,
                                returnedAmount,
                                commissionAmount: item.commissionAmount ?? 0,
                                reservationStatus: item.status,
                                isOTAChannel: true,
                              })
                              const originalPrice = Math.round(channelPayment * 100) / 100
                              const commission = Math.round((item.commissionAmount ?? 0) * 100) / 100
                              const price = Math.max(0, Math.round((originalPrice - commission) * 100) / 100)
                              return {
                                reservationDate: formatDateForInvoice(item.registrationDate),
                                tourDate: formatDateForInvoice(item.tourDate),
                                bookingNumber: item.channelRN || '-',
                                description: item.productName || '',
                                guestName: item.customerName || '',
                                quantity: billingAdultsFromRow(item),
                                commissionPercent: fixedCommissionPct,
                                originalPrice,
                                commission,
                                price,
                              }
                            })
                          }
                          const handleChannelInvoice = (e: React.MouseEvent) => {
                            e.stopPropagation()
                            const items = buildInvoiceItems()
                            setChannelInvoicePreview({
                              channelName: channel.name,
                              dateRange: { start: dateRange.start, end: dateRange.end },
                              items
                            })
                          }

                          return (
                            <div key={channel.id} className="border-t border-gray-200">
                              {/* 채널 헤더: 왼쪽 토글 + 오른쪽 인보이스 버튼 */}
                              <div className="flex items-stretch">
                                <button
                                  type="button"
                                  onClick={() => toggleChannel(channel.id)}
                                  className="flex-1 px-3 sm:px-8 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2 hover:bg-gray-100 transition-colors text-left min-w-0"
                                >
                                  <div className="flex items-center space-x-3">
                                    {isChannelExpanded ? (
                                      <ChevronDown className="w-4 h-4 text-gray-500" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4 text-gray-500" />
                                    )}
                                    <span className="font-medium text-gray-800">{channel.name}</span>
                                    <span className="text-xs text-gray-500">({sortedChannelItems.length}건)</span>
                                    <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-1 text-[11px] sm:text-xs">
                                      <span className="font-medium text-green-600">
                                        Grand Total: ${formatUsd2(channelRowTotals.grandTotal)}
                                      </span>
                                      <span className="font-medium text-blue-600">
                                        Commission: ${formatUsd2(channelRowTotals.commission)}
                                      </span>
                                      <span className="font-medium text-purple-600">
                                        총 가격: ${formatUsd2(channelRowTotals.totalPrice)}
                                      </span>
                                      <span className="font-medium text-gray-700">
                                        옵션: ${formatUsd2(channelRowTotals.optionTotal)}
                                      </span>
                                      <span className="font-medium text-purple-600">
                                        총 매출: ${formatUsd2(channelRowTotals.netPrice)}
                                      </span>
                                      <span
                                        className="font-medium text-teal-600"
                                        title="순입금 = 파트너 수령 − Returned(파트너 환불)"
                                      >
                                        입금내역: ${formatUsd2(channelRowTotals.partnerReceived)}
                                      </span>
                                      <span className="font-medium text-amber-600">
                                        채널 정산: ${formatUsd2(channelRowTotals.channelSettlement)}
                                      </span>
                                    </div>
                                  </div>
                                </button>
                                <div className="flex items-stretch shrink-0 border-l border-gray-200">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setOtaReconcileSession({
                                        channelId: channel.id,
                                        channelName: channel.name,
                                        systemReservationsOverride: reservationItemsToOtaSystemRows(sortedChannelItems),
                                        periodNote: `${dateRange.start} ~ ${dateRange.end} · 투어 진행 내역`,
                                      })
                                    }}
                                    title="OTA CSV/PDF·Excel과 채널 정산 금액 비교 (이 목록·기간만 시스템 대상)"
                                    className="px-2.5 sm:px-3 py-2.5 sm:py-3 flex items-center gap-1.5 text-xs font-medium text-emerald-900 bg-emerald-50 hover:bg-emerald-100 transition-colors border-r border-gray-200"
                                  >
                                    <GitCompare className="w-4 h-4 shrink-0" />
                                    <span className="hidden sm:inline">정산 비교</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleChannelInvoice}
                                    title="인보이스 다운로드 (PDF)"
                                    className="px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 transition-colors"
                                  >
                                    <FileText className="w-4 h-4 shrink-0" />
                                    <span className="hidden sm:inline">인보이스</span>
                                  </button>
                                </div>
                              </div>

                              {/* 채널 투어 진행 내역 테이블 */}
                              {isChannelExpanded && (
                                <div className="overflow-x-auto">
                                  <table className="w-full divide-y divide-gray-200 text-xs">
                                    <thead className="bg-white">
                                      <tr>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-20">상태</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">투어 날짜</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-32">고객명</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">채널RN</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase" style={{ width: '150px', minWidth: '150px', maxWidth: '150px' }}>상품명</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-16" title="reservation_pricing.pricing_adults">인원</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">성인 가격</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">상품가격 합계</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">할인총액</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">추가비용 총액</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">Grand Total</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">커미션</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">총 가격</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">옵션 총합</th>
                                        <th
                                          className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24"
                                          title="예약 수정 · 가격정보 · 4. 총 매출과 동일 산식"
                                        >
                                          총 매출
                                        </th>
                                        <th
                                          className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24"
                                          title="순입금 = 파트너 수령 − Returned(파트너 환불). 행 툴팁에 수령·환불 금액이 표시됩니다."
                                        >
                                          입금내역 (Partner Received)
                                        </th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">채널 정산 금액</th>
                                        <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase w-20">Audit</th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                      {displayTourChannelItems.length === 0 ? (
                                        <tr>
                                          <td colSpan={18} className="px-2 py-3 text-center text-gray-500 text-xs">
                                            투어 진행 내역이 없습니다.
                                          </td>
                                        </tr>
                                      ) : (
                                        displayTourChannelItems.map((item, idx) => {
                                          const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                                          const grandTotal = (item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0)
                                          const totalPrice = grandTotal - (item.commissionAmount || 0)
                                          const companyRev =
                                            item.companyTotalRevenue ?? totalPrice + (item.optionTotal || 0)
                                          const pr = partnerReceivedByReservation[item.id] ?? 0
                                          const ret = returnedAmountByReservation[item.id] ?? 0
                                          const partnerNet =
                                            item.partnerReceivedNet ?? Math.max(0, Math.round((pr - ret) * 100) / 100)
                                          const partnerTitle = partnerReceivedNetTooltip(pr, ret)
                                          const effectiveAudited = reservationAudit[item.id]?.amount_audited ?? item.amountAudited
                                          const effectiveAuditedAt = reservationAudit[item.id]?.amount_audited_at ?? item.amountAuditedAt
                                          const effectiveAuditedBy = reservationAudit[item.id]?.amount_audited_by ?? item.amountAuditedBy
                                          const auditTooltip = !canAudit
                                            ? 'Super 권한이 있는 사용자만 Audit 할 수 있습니다'
                                            : effectiveAudited && (effectiveAuditedBy || effectiveAuditedAt)
                                              ? `Audit: ${effectiveAuditedBy ?? '-'} / ${effectiveAuditedAt ? new Date(effectiveAuditedAt).toLocaleString('ko-KR') : '-'}`
                                              : '금액 더블체크 완료 시 체크'
                                          const settlementPctVerify = channelSettlementPctMismatch(
                                            item,
                                            returnedAmountByReservation[item.id] ?? 0,
                                            partnerReceivedByReservation[item.id] ?? 0,
                                            channels,
                                            isOtaChannelId(item.channelId)
                                          )
                                          return (
                                            <tr 
                                              key={`${channel.id}-tour-${item.id}-${idx}`} 
                                              className="hover:bg-gray-50 cursor-pointer transition-colors"
                                              onClick={(e) => {
                                                if ((e.target as HTMLElement).closest('[data-audit-cell]')) return
                                                openReservationEditModal(item.id)
                                              }}
                                            >
                                              <td className="px-2 py-2 whitespace-nowrap text-xs w-20">
                                                <span className={`px-1.5 py-0.5 rounded text-xs ${getStatusColor(item.status)}`}>
                                                  {item.status === 'confirmed' ? '확정' :
                                                   item.status === 'pending' ? '대기' :
                                                   item.status === 'cancelled' ? '취소' :
                                                   item.status === 'completed' ? '완료' :
                                                   item.status === 'deleted' ? '삭제됨' :
                               item.status}
                            </span>
                          </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 w-24">
                                                {item.tourDate ? item.tourDate.split('T')[0] : '-'}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 w-32 truncate">
                                                {item.customerName}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 w-24 truncate">
                            {item.channelRN || '-'}
                          </td>
                                              <td className="px-2 py-2 text-xs text-gray-600 truncate" style={{ width: '150px', minWidth: '150px', maxWidth: '150px' }} title={item.productName}>
                                                {item.productName}
                                              </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 text-center w-16" title="pricing_adults">
                                         {billingAdultsFromRow(item)}
                                       </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right w-20">
                                                ${(item.adultPrice || 0).toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right w-24">
                                                ${(item.productPriceTotal || 0).toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-red-600 text-right w-20">
                                                -${discountTotal.toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-orange-600 text-right w-24">
                                                ${(item.additionalCost || 0).toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-green-600 font-semibold text-right w-24">
                                                ${grandTotal.toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-blue-600 text-right w-20">
                                                ${(item.commissionAmount || 0).toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-green-600 font-semibold text-right w-20">
                                                ${totalPrice.toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right w-20">
                                                ${(item.optionTotal || 0).toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-purple-600 font-semibold text-right w-24">
                                                ${companyRev.toLocaleString()}
                                              </td>
                                              <td
                                                className="px-2 py-2 whitespace-nowrap text-xs text-teal-600 text-right w-24"
                                                title={partnerTitle}
                                              >
                                                ${partnerNet.toLocaleString()}
                                              </td>
                                              <td
                                                className={`px-2 py-2 whitespace-nowrap text-xs text-right w-24 ${settlementPctVerify.mismatch ? 'text-red-600 font-semibold' : 'text-amber-600'}`}
                                                title={settlementPctVerify.title}
                                              >
                                                {formatTourChannelSettlementCell(item.channelSettlementAmount)}
                                              </td>
                                              <td data-audit-cell className="px-2 py-2 whitespace-nowrap text-center w-20" onClick={e => e.stopPropagation()} title={auditTooltip}>
                                                <input
                                                  type="checkbox"
                                                  checked={!!effectiveAudited}
                                                  disabled={!canAudit}
                                                  onChange={e => handleToggleAmountAudit(item.id, e.target.checked)}
                                                  className="rounded border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                                />
                                              </td>
                                            </tr>
                                          )
                                        })
                    )}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                                        <td colSpan={5} className="px-2 py-2 text-xs font-medium text-gray-900">
                        합계
                      </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-center w-16">
                                          {channelRowTotals.totalPeople}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-right">
                                          ${formatUsd2(channelRowTotals.adultPriceSum)}
                      </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-right">
                                          ${formatUsd2(channelRowTotals.productPriceTotalSum)}
                      </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-red-600 text-right">
                                          -${formatUsd2(channelRowTotals.discountTotal)}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-orange-600 text-right">
                                          ${formatUsd2(channelRowTotals.additionalCostSum)}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-green-600 text-right">
                                          ${formatUsd2(channelRowTotals.grandTotal)}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-blue-600 text-right">
                                          ${formatUsd2(channelRowTotals.commission)}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-green-600 text-right">
                                          ${formatUsd2(channelRowTotals.totalPrice)}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-right">
                                          ${formatUsd2(channelRowTotals.optionTotal)}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-purple-600 text-right">
                                          ${formatUsd2(channelRowTotals.netPrice)}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-teal-600 text-right">
                                          ${formatUsd2(channelRowTotals.partnerReceived)}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-amber-600 text-right">
                                          ${formatUsd2(channelRowTotals.channelSettlement)}
                                        </td>
                                        <td className="px-2 py-2 text-xs text-gray-500 text-center">—</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
                )}
                            </div>
                          )
                        })}
              </div>
            )}
          </div>
                )
              })
      )}
          </div>
        )}
      </div>

      {/* 채널 인보이스 미리보기 모달 */}
      {channelInvoicePreview && (
        <ChannelInvoicePreviewModal
          channelName={channelInvoicePreview.channelName}
          dateRange={channelInvoicePreview.dateRange}
          items={channelInvoicePreview.items}
          onClose={() => setChannelInvoicePreview(null)}
        />
      )}

      <ChannelOtaReconciliationModal
        open={otaReconcileSession !== null}
        onClose={() => setOtaReconcileSession(null)}
        channelId={otaReconcileSession?.channelId ?? ''}
        channelName={otaReconcileSession?.channelName ?? ''}
        {...(otaReconcileSession?.systemReservationsOverride !== undefined
          ? { systemReservationsOverride: otaReconcileSession.systemReservationsOverride }
          : {})}
        {...(otaReconcileSession?.periodNote !== undefined ? { periodNote: otaReconcileSession.periodNote } : {})}
        onPatched={handleOtaReconcilePatched}
        canAudit={canAudit}
        onOpenReservation={(id) => {
          setOtaReconcileSession(null)
          openReservationEditModal(id)
        }}
      />

      {/* 채널 선택 모달 */}
      {isChannelModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setIsChannelModalOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">채널 선택</h3>
              <button
                onClick={() => setIsChannelModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-120px)]">
              <div className="space-y-4">
                {/* 전체 채널 옵션 */}
                <button
                  onClick={() => {
                    onChannelChange?.('')
                    setIsChannelModalOpen(false)
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                    !channelFilter
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium">전체 채널</div>
                  <div className="text-sm text-gray-500 mt-1">모든 채널 표시</div>
                </button>

                {/* 채널 그룹별 표시 */}
                {channelGroups.map((group) => (
                  <div key={group.type} className="space-y-2">
                    <div className="text-sm font-semibold text-gray-700 px-2">
                      {group.label}
                    </div>
                    <div className="space-y-2">
                      {group.channels.map((channel) => (
                        <button
                          key={channel.id}
                          onClick={() => {
                            onChannelChange?.(channel.id)
                            setIsChannelModalOpen(false)
                          }}
                          className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                            channelFilter === channel.id
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="font-medium">{channel.name}</div>
                          {channel.type && (
                            <div className="text-xs text-gray-500 mt-1">
                              {channel.type}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {channelGroups.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    채널 데이터가 없습니다.
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200">
              <button
                onClick={() => setIsChannelModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 예약 수정 모달 */}
      {editingReservation && (
        <ReservationForm
          reservation={editingReservation}
          customers={customers || []}
          products={products || []}
          channels={(channels || []) as any}
          productOptions={productOptions || []}
          options={options || []}
          pickupHotels={(pickupHotels || []) as any}
          coupons={(coupons || []) as any}
          onSubmit={handleEditReservation}
          onCancel={() => setEditingReservation(null)}
          onRefreshCustomers={refreshCustomers}
          onDelete={handleDeleteReservation}
          onPricingSaved={handlePricingSaved}
          layout="modal"
          allowPastDateEdit={isSuper || isSuperByEmail}
        />
      )}
    </div>
  )
}

