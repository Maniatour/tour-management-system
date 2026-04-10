'use client'

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import Image from 'next/image'
import {
  Calendar,
  DollarSign,
  Eye,
  Edit,
  Plus,
  Mail,
  ChevronDown,
  MessageSquare,
  FileText,
  Users,
  RefreshCw,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { Reservation, Customer } from '@/types/reservation'
import type { ReservationPricingMapValue } from '@/types/reservationPricingMap'
import {
  getCustomerName,
  getProductNameForLocale,
  formatChannelDashVariant,
  getStatusLabel,
  getStatusColor,
} from '@/utils/reservationUtils'
import { supabase } from '@/lib/supabase'
import type { PaymentRecordLike } from '@/utils/reservationPricingBalance'
import {
  pricingFieldToNumber,
  effectiveProductPriceTotalForBalance,
  computeCustomerPaymentTotalLineFormula,
  computeDepositBalanceFromPaymentRecordsForLineGross,
  balanceOutstandingTotalMinusDeposit,
  isStoredCustomerTotalMismatchWithFormula,
  summarizePaymentRecordsForBalance,
} from '@/utils/reservationPricingBalance'

function fmtUsd(v: number | undefined | null): string {
  if (v == null || (typeof v === 'number' && Number.isNaN(v))) return '—'
  return `$${Number(v).toFixed(2)}`
}

function fmtCoupon(v: number | undefined | null): string {
  if (v == null || (typeof v === 'number' && Number.isNaN(v))) return '—'
  const n = Number(v)
  if (Math.abs(n) < 0.005) return '—'
  return `-$${Math.abs(n).toFixed(2)}`
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** `reservation_options` 배치 합계가 있으면 `option_total`만 덮어써 표시·산식을 실제 행과 맞춤 */
function pricingWithLiveOptionTotal(
  p: ReservationPricingMapValue | undefined,
  reservationId: string,
  live?: Map<string, number>
): ReservationPricingMapValue | undefined {
  if (!p) return undefined
  const v = live?.get(reservationId)
  if (v === undefined) return p
  return { ...p, option_total: v }
}

type PricingApplyMode = 'total' | 'deposit' | 'balance' | 'all'

/** 일괄 반영·행 단위 반영 공통 — reservation_pricing 업데이트 필드만 생성 */
function buildReservationPricingPatch(
  r: Reservation,
  p: ReservationPricingMapValue,
  reservationOptionSumByReservationId: Map<string, number> | undefined,
  records: PaymentRecordLike[],
  mode: PricingApplyMode
): Record<string, number> | null {
  const party = { adults: r.adults ?? 0, children: r.child ?? 0, infants: r.infant ?? 0 }
  const ov = reservationOptionSumByReservationId?.get(r.id)
  const pForGross = ov !== undefined ? { ...p, option_total: ov } : p
  const gross = computeCustomerPaymentTotalLineFormula(pForGross, party)
  const st = String(r.status || '').toLowerCase().trim()
  const isCancelled = st === 'cancelled' || st === 'canceled'
  const depositNet = summarizePaymentRecordsForBalance(records).depositTotalNet
  /** 총액(산식) − 보증금(입금 집계 또는 DB 보증금). 잔금 수령 합은 차감하지 않음 */
  const remainingPay = balanceOutstandingTotalMinusDeposit(
    gross,
    records,
    pricingFieldToNumber(p.deposit_amount),
    isCancelled
  )
  const patch: Record<string, number> = {}
  if (mode === 'total' || mode === 'all') patch.total_price = gross
  if (mode === 'deposit' || mode === 'all') patch.deposit_amount = depositNet
  if (mode === 'balance' || mode === 'all') patch.balance_amount = remainingPay
  if (Object.keys(patch).length === 0) return null
  return patch
}

/** Hover: Supabase 테이블·컬럼명 */
function rpCol(column: string): string {
  return `reservation_pricing.${column}`
}

function rsvCol(column: string): string {
  return `reservations.${column}`
}

function dbTitle(tableCol: string, extra?: string | null): string {
  return extra ? `${tableCol}\n${extra}` : tableCol
}

function RowDbApplyButton(props: {
  visible: boolean
  busy: boolean
  /** 일괄 반영 진행 중 등 */
  parentBusy?: boolean
  title: string
  onClick: () => void | Promise<void>
}) {
  const { visible, busy, parentBusy, title, onClick } = props
  if (!visible) return null
  return (
    <button
      type="button"
      title={title}
      disabled={busy || parentBusy}
      onClick={(e) => {
        e.stopPropagation()
        void onClick()
      }}
      className="shrink-0 p-0.5 rounded border border-emerald-400/80 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
      aria-label={title}
    >
      <RefreshCw className={`w-3 h-3 ${busy ? 'animate-spin' : ''}`} />
    </button>
  )
}

/**
 * 할인·추가비용 섹션 소계 — 상품가 이후 반영분 합산(잔액 산식과 동일 부호)
 * - 쿠폰·추가할인은 차감, 그 외 비용·수수료·단독추가 등은 가산
 */
function discountExtraSectionSubtotal(p: ReservationPricingMapValue | undefined): number {
  if (!p) return 0
  return round2(
    -pricingFieldToNumber(p.coupon_discount) -
      pricingFieldToNumber(p.additional_discount) +
      pricingFieldToNumber(p.additional_cost) +
      pricingFieldToNumber(p.tax) +
      pricingFieldToNumber(p.card_fee) +
      pricingFieldToNumber(p.prepayment_cost) +
      pricingFieldToNumber(p.prepayment_tip) +
      pricingFieldToNumber(p.private_tour_additional_cost)
  )
}

function fmtUsdSigned(v: number): string {
  if (v == null || Number.isNaN(v)) return '—'
  const n = Number(v)
  if (Math.abs(n) < 0.005) return '$0.00'
  const sign = n < 0 ? '-' : ''
  return `${sign}$${Math.abs(n).toFixed(2)}`
}

/** 가로 스크롤 시 예약 영역 열 고정 — 대략 열 폭 기준 left 누적 */
const RES_LEFT: Record<'sel' | 'nosel', readonly [string, string, string, string, string]> = {
  nosel: ['left-0', 'left-[7.5rem]', 'left-[17rem]', 'left-[23.5rem]', 'left-[29.5rem]'],
  sel: ['left-8', 'left-[9.5rem]', 'left-[19rem]', 'left-[25.5rem]', 'left-[32rem]'],
}

const RES_Z = ['z-[30]', 'z-[29]', 'z-[28]', 'z-[27]', 'z-[26]'] as const

function reservationColSticky(
  col: 0 | 1 | 2 | 3 | 4,
  selectionEnabled: boolean,
  variant: 'theadSub' | 'tbody'
): string {
  const left = RES_LEFT[selectionEnabled ? 'sel' : 'nosel'][col]
  const bg = variant === 'tbody' ? 'bg-white group-hover:bg-gray-50/80' : 'bg-gray-50'
  return `sticky ${left} ${RES_Z[col]} ${bg} shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)] border-r border-gray-200`
}

/** 잔액·가격표와 동일: 성인+아동+유아, 0명이면 1 */
function totalBillingPax(r: Reservation): number {
  const n = (r.adults ?? 0) + (r.child ?? 0) + (r.infant ?? 0)
  return n > 0 ? n : 1
}

/** DB not_included_price는 1인당 → 표시는 청구 인원 곱 */
function notIncludedTotalForParty(p: ReservationPricingMapValue | undefined, r: Reservation): number {
  return round2(pricingFieldToNumber(p?.not_included_price) * totalBillingPax(r))
}

function partyFromReservation(r: Reservation) {
  return { adults: r.adults, children: r.child, infants: r.infant }
}

/**
 * 상품합 셀: `effectiveProductPriceTotalForBalance`와 동일(레거시 DB는 단가×인원만인 경우 미포함 보정).
 * 툴팁은 저장값과 표시값이 다를 때만.
 */
function productPriceTotalForDisplay(
  p: ReservationPricingMapValue | undefined,
  r: Reservation
): { amount: number | null; correctedFromDb: boolean } {
  if (p == null) return { amount: null, correctedFromDb: false }
  const stored = pricingFieldToNumber(p.product_price_total)
  const effective = effectiveProductPriceTotalForBalance(p, partyFromReservation(r))
  return {
    amount: effective,
    correctedFromDb: Math.abs(effective - stored) > 0.02,
  }
}

/** 필수·선택 — 미포함은 DB 상품합(product_price_total)에 이미 반영. choices_total 제외 */
function optionsLineItemsSum(p: ReservationPricingMapValue | undefined, _r: Reservation): number {
  if (!p) return 0
  return round2(
    (Number(p.required_option_total) || 0) + (Number(p.option_total) || 0)
  )
}

/** DB에 저장된 고객 총액 — 없으면 null */
function customerPaymentStoredTotalDb(
  p: ReservationPricingMapValue | undefined
): number | null {
  if (!p) return null
  if (p.total_price == null || p.total_price === '') return null
  return round2(pricingFieldToNumber(p.total_price))
}

/** 상품합 − 할인 + 추가 + 옵션 Subtotal (표시·DB 반영 동일) */
function customerPaymentComputedGross(
  p: ReservationPricingMapValue | undefined,
  r: Reservation
): number | null {
  if (!p) return null
  return round2(computeCustomerPaymentTotalLineFormula(p, partyFromReservation(r)))
}

type BalanceProps = {
  reservations: Reservation[]
  customers: Customer[]
  products: Array<{ id: string; name: string; sub_category?: string }>
  channels: Array<{ id: string; name: string; favicon_url?: string | null }>
  reservationPricingMap: Map<string, ReservationPricingMapValue>
  /** 예약별 입금 내역 — DB 보증금·잔액과 비교 표시 */
  paymentRecordsByReservationId?: Map<string, PaymentRecordLike[]>
  /** 예약별 reservation_options 합 — 선택옵션·소계·총액 산식에 반영 */
  reservationOptionSumByReservationId?: Map<string, number>
  locale: string
  emailDropdownOpen: string | null
  sendingEmail: string | null
  onPricingInfoClick: (reservation: Reservation) => void
  onCreateTour: (reservation: Reservation) => void
  onPaymentClick: (reservation: Reservation) => void
  onDetailClick: (reservation: Reservation) => void
  onReviewClick: (reservation: Reservation) => void
  onEmailPreview: (reservation: Reservation, emailType: 'confirmation' | 'departure' | 'pickup') => void
  onEmailLogsClick: (reservationId: string) => void
  onEmailDropdownToggle: (reservationId: string) => void
  onEditClick: (reservationId: string) => void
  onCustomerClick: (customer: Customer) => void
  onStatusChange?: (reservationId: string, newStatus: string) => Promise<void>
  onFollowUpClick: (reservation: Reservation) => void
  /** 선택 행 산식 반영 후 상위 목록 갱신(전체 예약 재조회) */
  onRefreshReservations?: () => void
  /** pricing만 병합 갱신 — 있으면 반영 후 이쪽 우선(모달·탭 상태 유지) */
  onRefreshReservationPricing?: (reservationIds: string[]) => void | Promise<void>
  /** 현재 탭 전체 목록(페이지 밖 id 조회용) */
  balanceReservationsForApply?: Reservation[]
  /** 작업 열에 가격·결제·메일 등 숨기고 수정만 표시 */
  actionsColumnEditOnly?: boolean
  /** 총액·보증금·잔액 일괄/행 DB 반영(체크·행 버튼) — 예약 가격 탭에서는 false */
  enablePricingDbApply?: boolean
}

function StatusDropdown({
  reservation,
  onStatusChange,
}: {
  reservation: Reservation
  onStatusChange?: (reservationId: string, newStatus: string) => Promise<void>
}) {
  const t = useTranslations('reservations')
  const [open, setOpen] = useState(false)
  const [updating, setUpdating] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const statusOptions = [
    { value: 'pending', labelKey: 'status.pending' },
    { value: 'confirmed', labelKey: 'status.confirmed' },
    { value: 'completed', labelKey: 'status.completed' },
    { value: 'cancelled', labelKey: 'status.cancelled' },
  ] as const

  const handleSelect = async (newStatus: string) => {
    if (!onStatusChange || newStatus === (reservation.status as string)?.toLowerCase?.()) {
      setOpen(false)
      return
    }
    setUpdating(true)
    try {
      await onStatusChange(reservation.id, newStatus)
      setOpen(false)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="relative inline-block" ref={ref}>
      {onStatusChange ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={updating}
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium cursor-pointer hover:opacity-90 disabled:opacity-70 ${getStatusColor(reservation.status)}`}
        >
          {getStatusLabel(reservation.status, t)}
          <ChevronDown className={`w-3 h-3 ml-0.5 ${open ? 'rotate-180' : ''}`} />
        </button>
      ) : (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${getStatusColor(reservation.status)}`}>
          {getStatusLabel(reservation.status, t)}
        </span>
      )}
      {onStatusChange && open && (
        <div className="absolute left-0 top-full mt-1 z-[70] py-1 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[7rem]">
          {statusOptions.map((opt) => {
            const isCurrent = (reservation.status as string)?.toLowerCase?.() === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={`w-full text-left px-3 py-1.5 text-[10px] hover:bg-gray-100 ${getStatusColor(opt.value)} ${isCurrent ? 'font-semibold' : ''}`}
              >
                {t(opt.labelKey)}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export type BalanceSectionViewMode = 'detail' | 'subtotal'

type BalanceRowProps = Omit<BalanceProps, 'reservations'> & {
  reservation: Reservation
  paymentRecords: PaymentRecordLike[]
  productPriceMode: BalanceSectionViewMode
  discountExtraMode: BalanceSectionViewMode
  selectionEnabled: boolean
  rowChecked: boolean
  onRowCheckChange: (reservationId: string, checked: boolean) => void
  selectionDisabled: boolean
  onApplyRowPatch?: (reservationId: string, mode: 'total' | 'deposit' | 'balance') => Promise<void>
  applyRowBusyKey?: string | null
}

function BalanceRow(props: BalanceRowProps) {
  const t = useTranslations('reservations')
  const {
    reservation,
    customers,
    products,
    channels,
    reservationPricingMap,
    locale,
    emailDropdownOpen,
    sendingEmail,
    onPricingInfoClick,
    onCreateTour,
    onPaymentClick,
    onDetailClick,
    onReviewClick,
    onEmailPreview,
    onEmailLogsClick,
    onEmailDropdownToggle,
    onEditClick,
    onCustomerClick,
    onStatusChange,
    onFollowUpClick,
    paymentRecords,
    reservationOptionSumByReservationId,
    productPriceMode,
    discountExtraMode,
    selectionEnabled,
    rowChecked,
    onRowCheckChange,
    selectionDisabled,
    onApplyRowPatch,
    applyRowBusyKey,
    actionsColumnEditOnly = false,
  } = props

  const p = reservationPricingMap.get(reservation.id)
  const pLine = useMemo(
    () => pricingWithLiveOptionTotal(p, reservation.id, reservationOptionSumByReservationId),
    [p, reservation.id, reservationOptionSumByReservationId]
  )
  const party = partyFromReservation(reservation)
  const storedGross = customerPaymentStoredTotalDb(p)
  const computedGross = customerPaymentComputedGross(pLine, reservation)
  const totalMismatch = pLine != null && isStoredCustomerTotalMismatchWithFormula(party, pLine)
  const lineGrossForPaymentCompare = computedGross ?? storedGross ?? 0
  const fromPayments = computeDepositBalanceFromPaymentRecordsForLineGross(lineGrossForPaymentCompare, paymentRecords)
  const depositDb = pricingFieldToNumber(p?.deposit_amount)
  const balanceDb = pricingFieldToNumber(p?.balance_amount)
  const rsvStatus = String(reservation.status || '').toLowerCase().trim()
  const isCancelledRsv = rsvStatus === 'cancelled' || rsvStatus === 'canceled'
  const balanceComputedOutstanding = balanceOutstandingTotalMinusDeposit(
    lineGrossForPaymentCompare,
    paymentRecords,
    depositDb,
    isCancelledRsv
  )
  const depositPrMismatch =
    fromPayments.hasRecords && Math.abs(depositDb - fromPayments.depositTotalNet) > 0.01
  const balancePrMismatch =
    p != null && Math.abs(balanceDb - balanceComputedOutstanding) > 0.01
  const productSumDisplay = productPriceTotalForDisplay(p, reservation)

  /** 잔금 수령(입금) 금액 ≠ 잔액(계산) 표시값 — 두 열 강조 */
  const highlightReceivedVsBalanceComputed =
    fromPayments.hasRecords &&
    p != null &&
    Math.abs(fromPayments.balanceReceivedTotal - balanceComputedOutstanding) > 0.01

  const product = products?.find((pr) => pr.id === reservation.productId)
  const isManiaTour = product?.sub_category === 'Mania Tour' || product?.sub_category === 'Mania Service'
  const showCreateTour = isManiaTour && !reservation.hasExistingTour
  const channel = channels?.find((c) => c.id === reservation.channelId)

  return (
    <tr className="group border-b border-gray-100 hover:bg-gray-50/80 align-top text-[11px]">
      {selectionEnabled && (
        <td className="sticky left-0 z-[32] px-1 py-1.5 w-8 border-r border-gray-200 align-middle text-center bg-white shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)] group-hover:bg-gray-50/80">
          <input
            type="checkbox"
            className="rounded border-gray-300"
            checked={rowChecked}
            disabled={selectionDisabled}
            onChange={(e) => onRowCheckChange(reservation.id, e.target.checked)}
            aria-label={t('actionRequired.balanceTable.cols.selectRow')}
          />
        </td>
      )}
      <td
        className={`px-1.5 py-1.5 max-w-[7rem] ${reservationColSticky(0, selectionEnabled, 'tbody')}`}
        title={rsvCol('customer_id')}
      >
        <button
          type="button"
          className="text-left font-medium text-gray-900 hover:text-blue-600 hover:underline line-clamp-2"
          onClick={() => {
            const c = customers.find((x) => x.id === reservation.customerId)
            if (c) onCustomerClick(c)
          }}
        >
          {getCustomerName(reservation.customerId, customers || [])}
        </button>
        <div className="text-[10px] text-gray-500 flex items-center gap-0.5 mt-0.5">
          <Users className="w-3 h-3 shrink-0" />
          {reservation.adults ?? 0}
          {t('card.peopleShort')}
        </div>
      </td>
      <td
        className={`px-1.5 py-1.5 max-w-[9rem] ${reservationColSticky(1, selectionEnabled, 'tbody')}`}
        title={rsvCol('product_id')}
      >
        <div className="font-medium text-gray-900 leading-tight line-clamp-3">
          {getProductNameForLocale(reservation.productId, products as any || [], locale)}
        </div>
      </td>
      <td
        className={`px-1.5 py-1.5 whitespace-nowrap text-gray-800 ${reservationColSticky(2, selectionEnabled, 'tbody')}`}
        title={rsvCol('tour_date')}
      >
        <div className="flex items-center gap-0.5">
          <Calendar className="w-3 h-3 text-gray-400 shrink-0" />
          {reservation.tourDate || '—'}
        </div>
      </td>
      <td
        className={`px-1.5 py-1.5 ${reservationColSticky(3, selectionEnabled, 'tbody')}`}
        title={rsvCol('status')}
      >
        <StatusDropdown reservation={reservation} onStatusChange={onStatusChange} />
      </td>
      <td
        className={`px-1.5 py-1.5 max-w-[10rem] align-top ${reservationColSticky(4, selectionEnabled, 'tbody')}`}
        title={dbTitle(
          rsvCol('channel_id'),
          [rsvCol('channel_rn'), rsvCol('variant_key'), formatChannelDashVariant(reservation.channelId, channels || [], reservation)].join('\n')
        )}
      >
        <div className="flex items-start gap-1 min-w-0">
          {channel?.favicon_url ? (
            <Image src={channel.favicon_url} alt="" width={12} height={12} className="rounded shrink-0 mt-0.5" />
          ) : (
            <span className="text-[9px] text-gray-400 shrink-0 mt-0.5">🌐</span>
          )}
          <div className="min-w-0">
            <div className="text-[10px] text-gray-800 leading-tight break-words">
              {formatChannelDashVariant(reservation.channelId, channels || [], reservation)}
            </div>
            <div className="text-[9px] text-gray-400 mt-0.5">RN: {reservation.channelRN ?? '—'}</div>
          </div>
        </div>
      </td>

      {productPriceMode === 'detail' ? (
        <>
          <td className="px-1.5 py-1.5 text-right tabular-nums border-r border-gray-100" title={rpCol('adult_product_price')}>
            {fmtUsd(p?.adult_product_price)}
          </td>
          <td className="px-1.5 py-1.5 text-right tabular-nums border-r border-gray-100" title={rpCol('child_product_price')}>
            {fmtUsd(p?.child_product_price)}
          </td>
          <td className="px-1.5 py-1.5 text-right tabular-nums border-r border-gray-100" title={rpCol('infant_product_price')}>
            {fmtUsd(p?.infant_product_price)}
          </td>
          <td
            className="px-1.5 py-1.5 text-right tabular-nums border-r border-gray-100 bg-gray-50/50"
            title={dbTitle(
              rpCol('not_included_price'),
              p != null && p.not_included_price != null && Math.abs(pricingFieldToNumber(p.not_included_price)) >= 0.005
                ? `${fmtUsd(pricingFieldToNumber(p.not_included_price))} × ${totalBillingPax(reservation)}`
                : undefined
            )}
          >
            {p == null || p.not_included_price == null ? '—' : fmtUsd(notIncludedTotalForParty(p, reservation))}
          </td>
          <td
            className="px-1.5 py-1.5 text-right tabular-nums font-medium text-blue-800 border-r border-gray-200 bg-blue-50/30"
            title={dbTitle(
              rpCol('product_price_total'),
              productSumDisplay.correctedFromDb
                ? `DB 저장값은 단가×인원만인 경우가 있어, 표시는 단가×인원+미포함(1인당×청구인원)으로 보정`
                : undefined
            )}
          >
            {fmtUsd(productSumDisplay.amount ?? undefined)}
          </td>
        </>
      ) : (
        <>
          <td
            className="px-1.5 py-1.5 text-right tabular-nums border-r border-gray-100 bg-gray-50/50"
            title={dbTitle(
              rpCol('not_included_price'),
              p != null && p.not_included_price != null && Math.abs(pricingFieldToNumber(p.not_included_price)) >= 0.005
                ? `${fmtUsd(pricingFieldToNumber(p.not_included_price))} × ${totalBillingPax(reservation)}`
                : undefined
            )}
          >
            {p == null || p.not_included_price == null ? '—' : fmtUsd(notIncludedTotalForParty(p, reservation))}
          </td>
          <td
            className="px-1.5 py-1.5 text-right tabular-nums font-medium text-blue-800 border-r border-gray-200 bg-blue-50/30"
            title={dbTitle(
              rpCol('product_price_total'),
              productSumDisplay.correctedFromDb
                ? `DB 저장값은 단가×인원만인 경우가 있어, 표시는 단가×인원+미포함(1인당×청구인원)으로 보정`
                : undefined
            )}
          >
            {fmtUsd(productSumDisplay.amount ?? undefined)}
          </td>
        </>
      )}

      {discountExtraMode === 'detail' ? (
        <>
          <td className="px-1.5 py-1.5 text-right tabular-nums text-green-800 border-r border-gray-100" title={rpCol('coupon_discount')}>
            {fmtCoupon(p?.coupon_discount)}
          </td>
          <td className="px-1.5 py-1.5 text-right tabular-nums border-r border-gray-100" title={rpCol('additional_discount')}>
            {fmtUsd(p?.additional_discount)}
          </td>
          <td className="px-1.5 py-1.5 text-right tabular-nums border-r border-gray-100" title={rpCol('additional_cost')}>
            {fmtUsd(p?.additional_cost)}
          </td>
          <td className="px-1.5 py-1.5 text-right tabular-nums border-r border-gray-100" title={rpCol('tax')}>
            {fmtUsd(p?.tax)}
          </td>
          <td className="px-1.5 py-1.5 text-right tabular-nums border-r border-gray-100" title={rpCol('card_fee')}>
            {fmtUsd(p?.card_fee)}
          </td>
          <td className="px-1.5 py-1.5 text-right tabular-nums border-r border-gray-100" title={rpCol('prepayment_cost')}>
            {fmtUsd(p?.prepayment_cost)}
          </td>
          <td className="px-1.5 py-1.5 text-right tabular-nums border-r border-gray-100" title={rpCol('prepayment_tip')}>
            {fmtUsd(p?.prepayment_tip)}
          </td>
          <td className="px-1.5 py-1.5 text-right tabular-nums border-r border-gray-100 bg-gray-50/50" title={rpCol('private_tour_additional_cost')}>
            {fmtUsd(p?.private_tour_additional_cost)}
          </td>
          <td
            className="px-1.5 py-1.5 text-right tabular-nums font-semibold text-orange-900 border-r border-gray-200 bg-orange-50/40"
            title={t('actionRequired.balanceTable.cols.discountSubtotalComputed')}
          >
            {fmtUsdSigned(discountExtraSectionSubtotal(p))}
          </td>
        </>
      ) : (
        <td
          className="px-1.5 py-1.5 text-right tabular-nums font-semibold text-orange-900 border-r border-gray-200 bg-orange-50/40"
          title={t('actionRequired.balanceTable.cols.discountSubtotalComputed')}
        >
          {fmtUsdSigned(discountExtraSectionSubtotal(p))}
        </td>
      )}

      <td className="px-1.5 py-1.5 text-right tabular-nums border-r border-gray-100" title={rpCol('required_option_total')}>
        {fmtUsd(p?.required_option_total)}
      </td>
      <td
        className="px-1.5 py-1.5 text-right tabular-nums border-r border-gray-100"
        title={dbTitle(
          rpCol('option_total'),
          reservationOptionSumByReservationId?.has(reservation.id) &&
            p != null &&
            Math.abs(pricingFieldToNumber(p.option_total) - (reservationOptionSumByReservationId.get(reservation.id) ?? 0)) > 0.01
            ? t('actionRequired.balanceTable.cols.optionLiveFromRowsHint', {
                amount: fmtUsd(reservationOptionSumByReservationId.get(reservation.id)),
              })
            : undefined
        )}
      >
        {fmtUsd(pLine?.option_total)}
      </td>
      <td
        className="px-1.5 py-1.5 text-right tabular-nums font-semibold text-emerald-900 border-r border-gray-200 bg-emerald-50/40"
        title={t('actionRequired.balanceTable.cols.optSumComputed')}
      >
        {fmtUsd(optionsLineItemsSum(pLine, reservation))}
      </td>

      <td
        className={`px-1.5 py-1.5 text-right tabular-nums font-semibold text-blue-900 border-r border-gray-100 ${
          totalMismatch ? 'bg-amber-50/90 ring-1 ring-inset ring-amber-200/80' : ''
        }`}
        title={dbTitle(
          rpCol('total_price'),
          totalMismatch ? t('actionRequired.balanceTable.cols.totalMismatchHint') : undefined
        )}
      >
        {storedGross == null ? '—' : fmtUsd(storedGross)}
      </td>
      <td
        className={`px-1.5 py-1.5 text-right tabular-nums font-semibold text-sky-900 border-r border-gray-100 ${
          totalMismatch ? 'bg-amber-50/90 ring-1 ring-inset ring-amber-200/80' : ''
        }`}
        title={dbTitle(
          t('actionRequired.balanceTable.cols.totalComputedNotDb'),
          totalMismatch ? t('actionRequired.balanceTable.cols.totalMismatchHint') : undefined
        )}
      >
        <div className="flex items-center justify-end gap-0.5">
          <span>{computedGross == null ? '—' : fmtUsd(computedGross)}</span>
          <RowDbApplyButton
            visible={Boolean(onApplyRowPatch && totalMismatch && computedGross != null)}
            busy={applyRowBusyKey === `${reservation.id}:total`}
            parentBusy={selectionDisabled}
            title={t('actionRequired.balanceTable.rowApplyTotalTitle')}
            onClick={() => onApplyRowPatch?.(reservation.id, 'total')}
          />
        </div>
      </td>
      <td
        className={`px-1.5 py-1.5 text-right tabular-nums border-r border-gray-100 ${
          depositPrMismatch ? 'bg-amber-50/90 ring-1 ring-inset ring-amber-200/80' : ''
        }`}
        title={dbTitle(
          rpCol('deposit_amount'),
          depositPrMismatch ? t('actionRequired.balanceTable.cols.prMismatchHint') : undefined
        )}
      >
        {fmtUsd(p?.deposit_amount)}
      </td>
      <td
        className={`px-1.5 py-1.5 text-right tabular-nums border-r border-gray-100 bg-slate-50/60 ${
          depositPrMismatch ? 'ring-1 ring-inset ring-amber-200/80' : ''
        }`}
        title={dbTitle(
          t('actionRequired.balanceTable.cols.paymentRecordsAgg'),
          depositPrMismatch ? t('actionRequired.balanceTable.cols.prMismatchHint') : undefined
        )}
      >
        <div className="flex items-center justify-end gap-0.5">
          <span>{fromPayments.hasRecords ? fmtUsd(fromPayments.depositTotalNet) : '—'}</span>
          <RowDbApplyButton
            visible={Boolean(onApplyRowPatch && depositPrMismatch && fromPayments.hasRecords)}
            busy={applyRowBusyKey === `${reservation.id}:deposit`}
            parentBusy={selectionDisabled}
            title={t('actionRequired.balanceTable.rowApplyDepositTitle')}
            onClick={() => onApplyRowPatch?.(reservation.id, 'deposit')}
          />
        </div>
      </td>
      <td
        className={`px-1.5 py-1.5 text-right tabular-nums font-medium border-r border-gray-100 bg-amber-50/40 ${
          balancePrMismatch ? 'ring-1 ring-inset ring-amber-200/80' : ''
        }`}
        title={dbTitle(
          rpCol('balance_amount'),
          balancePrMismatch ? t('actionRequired.balanceTable.cols.prMismatchHint') : undefined
        )}
      >
        {fmtUsd(p?.balance_amount)}
      </td>
      <td
        className={`px-1.5 py-1.5 text-right tabular-nums font-medium border-r border-gray-100 bg-amber-50/40 ${
          highlightReceivedVsBalanceComputed
            ? 'ring-2 ring-inset ring-rose-400/90 bg-rose-50/50'
            : balancePrMismatch
              ? 'ring-1 ring-inset ring-amber-200/80'
              : ''
        }`}
        title={dbTitle(
          t('actionRequired.balanceTable.cols.balanceReceivedRecordsHint'),
          [t('actionRequired.balanceTable.cols.paymentRecordsAgg'), t('actionRequired.balanceTable.rowApplyBalanceTitle')].join('\n')
        )}
      >
        <div className="flex items-center justify-end gap-0.5">
          <span>{fromPayments.hasRecords ? fmtUsd(fromPayments.balanceReceivedTotal) : '—'}</span>
          <RowDbApplyButton
            visible={Boolean(onApplyRowPatch && balancePrMismatch && p)}
            busy={applyRowBusyKey === `${reservation.id}:balance`}
            parentBusy={selectionDisabled}
            title={t('actionRequired.balanceTable.rowApplyBalanceTitle')}
            onClick={() => onApplyRowPatch?.(reservation.id, 'balance')}
          />
        </div>
      </td>
      <td
        className={`px-1.5 py-1.5 text-right tabular-nums font-medium border-r border-gray-100 bg-amber-50/50 ${
          highlightReceivedVsBalanceComputed
            ? 'ring-2 ring-inset ring-rose-400/90 bg-rose-50/50'
            : balancePrMismatch
              ? 'ring-1 ring-inset ring-amber-200/80'
              : ''
        }`}
        title={dbTitle(
          t('actionRequired.balanceTable.cols.balanceComputedOutstandingHint'),
          [
            fromPayments.hasRecords
              ? t('actionRequired.balanceTable.cols.balanceReceivedSupplement', {
                  received: fmtUsd(fromPayments.balanceReceivedTotal),
                })
              : '',
            highlightReceivedVsBalanceComputed
              ? t('actionRequired.balanceTable.cols.balanceReceivedVsComputedHint')
              : '',
            balancePrMismatch ? t('actionRequired.balanceTable.cols.prMismatchHint') : '',
          ]
            .filter(Boolean)
            .join('\n') || undefined
        )}
      >
        {p == null ? '—' : fmtUsd(balanceComputedOutstanding)}
      </td>

      <td className="px-1.5 py-1.5 text-right tabular-nums border-r border-gray-100 font-medium text-violet-900" title={rpCol('deposit_amount')}>
        {fmtUsd(p?.deposit_amount)}
      </td>
      <td className="px-1.5 py-1.5 text-right tabular-nums text-[10px] border-r border-gray-100" title={rpCol('commission_base_price')}>
        {fmtUsd(p?.commission_base_price)}
      </td>
      <td className="px-1.5 py-1.5 text-right tabular-nums border-r border-gray-100" title={rpCol('commission_percent')}>
        {p?.commission_percent != null && Math.abs(p.commission_percent) > 0.005 ? `${Number(p.commission_percent).toFixed(2)}%` : '—'}
      </td>
      <td className="px-1.5 py-1.5 text-right tabular-nums border-r border-gray-100" title={rpCol('commission_amount')}>
        {fmtUsd(p?.commission_amount)}
      </td>
      <td className="px-1.5 py-1.5 text-right tabular-nums font-medium border-r border-gray-200 bg-violet-50/30" title={rpCol('channel_settlement_amount')}>
        {fmtUsd(p?.channel_settlement_amount)}
      </td>

      <td className="px-1.5 py-1.5 bg-white">
        {actionsColumnEditOnly ? (
          <div className="flex flex-wrap gap-0.5 justify-end">
            <button
              type="button"
              title={t('card.editReservationTitle')}
              className="p-1 rounded-md bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100"
              onClick={() => onEditClick(reservation.id)}
            >
              <Edit className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-0.5 justify-end">
            <button
              type="button"
              title={t('actions.price')}
              className="p-1 rounded-md bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100"
              onClick={() => onPricingInfoClick(reservation)}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </button>
            {showCreateTour && (
              <button
                type="button"
                title={t('card.createTourTitle')}
                className="p-1 rounded-md bg-green-50 text-green-600 border border-green-200 hover:bg-green-100"
                onClick={() => onCreateTour(reservation)}
              >
                <Plus className="w-3 h-3" />
              </button>
            )}
            <button
              type="button"
              title={t('card.paymentHistoryTitle')}
              className="p-1 rounded-md bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100"
              onClick={() => onPaymentClick(reservation)}
            >
              <DollarSign className="w-3 h-3" />
            </button>
            <button
              type="button"
              title={t('card.viewCustomerTitle')}
              className="p-1 rounded-md bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100"
              onClick={() => onDetailClick(reservation)}
            >
              <Eye className="w-3 h-3" />
            </button>
            <button
              type="button"
              title="Follow up"
              className="p-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
              onClick={() => onFollowUpClick(reservation)}
            >
              <FileText className="w-3 h-3" />
            </button>
            <button
              type="button"
              title={t('card.reviewManagementTitle')}
              className="p-1 rounded-md bg-pink-50 text-pink-600 border border-pink-200 hover:bg-pink-100"
              onClick={() => onReviewClick(reservation)}
            >
              <MessageSquare className="w-3 h-3" />
            </button>
            <div className="relative inline-block">
              <button
                type="button"
                title={t('card.emailTitle')}
                disabled={sendingEmail === reservation.id}
                className="p-1 rounded-md bg-green-50 text-green-600 border border-green-200 hover:bg-green-100 disabled:opacity-50"
                onClick={() => onEmailDropdownToggle(reservation.id)}
              >
                <Mail className="w-3 h-3" />
              </button>
              {emailDropdownOpen === reservation.id && (
                <div className="absolute right-0 mt-1 w-40 bg-white rounded-md shadow-lg border border-gray-200 z-[70] py-1">
                  <button type="button" className="w-full text-left px-2 py-1 text-[10px] hover:bg-gray-50" onClick={() => onEmailPreview(reservation, 'confirmation')}>
                    {t('card.emailConfirmation')}
                  </button>
                  <button type="button" className="w-full text-left px-2 py-1 text-[10px] hover:bg-gray-50" onClick={() => onEmailPreview(reservation, 'departure')}>
                    {t('card.emailDeparture')}
                  </button>
                  <button
                    type="button"
                    disabled={!reservation.pickUpTime || !reservation.tourDate}
                    className="w-full text-left px-2 py-1 text-[10px] hover:bg-gray-50 disabled:opacity-50"
                    onClick={() => onEmailPreview(reservation, 'pickup')}
                  >
                    {t('card.emailPickup')}
                  </button>
                  <div className="border-t border-gray-100 my-0.5" />
                  <button type="button" className="w-full text-left px-2 py-1 text-[10px] text-blue-600 hover:bg-blue-50" onClick={() => onEmailLogsClick(reservation.id)}>
                    {t('card.emailLogs')}
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              title={t('card.editReservationTitle')}
              className="p-1 rounded-md bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100"
              onClick={() => onEditClick(reservation.id)}
            >
              <Edit className="w-3 h-3" />
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}

export function ReservationActionRequiredBalanceTable(props: BalanceProps) {
  const t = useTranslations('reservations')
  const {
    reservations,
    onRefreshReservations,
    onRefreshReservationPricing,
    balanceReservationsForApply,
    reservationPricingMap,
    paymentRecordsByReservationId,
    reservationOptionSumByReservationId,
    actionsColumnEditOnly = false,
    enablePricingDbApply = true,
    ...rest
  } = props
  const [productPriceMode, setProductPriceMode] = useState<BalanceSectionViewMode>('detail')
  const [discountExtraMode, setDiscountExtraMode] = useState<BalanceSectionViewMode>('detail')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [applySyncing, setApplySyncing] = useState(false)
  const [applyRowBusyKey, setApplyRowBusyKey] = useState<string | null>(null)
  const selectAllRef = useRef<HTMLInputElement>(null)

  const selectionEnabled =
    enablePricingDbApply && Boolean(onRefreshReservations || onRefreshReservationPricing)

  const reservationLookup = useMemo(() => {
    const m = new Map<string, Reservation>()
    for (const r of balanceReservationsForApply ?? []) m.set(r.id, r)
    for (const r of reservations) m.set(r.id, r)
    return m
  }, [balanceReservationsForApply, reservations])

  const pageIds = useMemo(() => reservations.map((r) => r.id), [reservations])
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id))
  const somePageSelected = pageIds.some((id) => selectedIds.has(id))

  useEffect(() => {
    const el = selectAllRef.current
    if (el) el.indeterminate = somePageSelected && !allPageSelected
  }, [somePageSelected, allPageSelected])

  const toggleSelectAllPage = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allPageSelected) pageIds.forEach((id) => next.delete(id))
      else pageIds.forEach((id) => next.add(id))
      return next
    })
  }, [allPageSelected, pageIds])

  const onRowCheckChange = useCallback((reservationId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(reservationId)
      else next.delete(reservationId)
      return next
    })
  }, [])

  type ApplyMode = 'total' | 'deposit' | 'balance' | 'all'

  const applySingleRow = useCallback(
    async (reservationId: string, mode: 'total' | 'deposit' | 'balance') => {
      if (!onRefreshReservations && !onRefreshReservationPricing) return
      const r = reservationLookup.get(reservationId)
      const p = reservationPricingMap.get(reservationId)
      if (!r || !p) return
      const key = `${reservationId}:${mode}`
      setApplyRowBusyKey(key)
      try {
        const records = paymentRecordsByReservationId?.get(reservationId) ?? []
        const patch = buildReservationPricingPatch(r, p, reservationOptionSumByReservationId, records, mode)
        if (!patch) return
        const { error } = await supabase.from('reservation_pricing').update(patch).eq('reservation_id', r.id)
        if (error) {
          console.error('apply row patch', mode, reservationId, error)
          return
        }
        if (onRefreshReservationPricing) {
          await onRefreshReservationPricing([reservationId])
        } else {
          onRefreshReservations?.()
        }
      } finally {
        setApplyRowBusyKey(null)
      }
    },
    [
      onRefreshReservations,
      onRefreshReservationPricing,
      reservationLookup,
      reservationPricingMap,
      paymentRecordsByReservationId,
      reservationOptionSumByReservationId,
    ]
  )

  const runApplySelected = useCallback(
    async (mode: ApplyMode) => {
      if ((!onRefreshReservations && !onRefreshReservationPricing) || selectedIds.size === 0) return
      setApplySyncing(true)
      try {
        const appliedOk: string[] = []
        for (const id of selectedIds) {
          const r = reservationLookup.get(id)
          const p = reservationPricingMap.get(id)
          if (!r || !p) continue
          const records = paymentRecordsByReservationId?.get(id) ?? []
          const patchMode: PricingApplyMode = mode === 'all' ? 'all' : mode
          const patch = buildReservationPricingPatch(r, p, reservationOptionSumByReservationId, records, patchMode)
          if (!patch) continue

          const { error } = await supabase.from('reservation_pricing').update(patch).eq('reservation_id', r.id)
          if (error) {
            console.error('apply pricing patch', mode, r.id, error)
            continue
          }
          appliedOk.push(r.id)
        }
        setSelectedIds(new Set())
        if (onRefreshReservationPricing && appliedOk.length > 0) {
          await onRefreshReservationPricing(appliedOk)
        } else {
          onRefreshReservations?.()
        }
      } finally {
        setApplySyncing(false)
      }
    },
    [
      onRefreshReservations,
      onRefreshReservationPricing,
      selectedIds,
      reservationLookup,
      reservationPricingMap,
      paymentRecordsByReservationId,
      reservationOptionSumByReservationId,
    ]
  )

  const s = (k: string) => t(`actionRequired.balanceTable.cols.${k}` as Parameters<typeof t>[0])
  const sec = (k: string) => t(`actionRequired.balanceTable.sections.${k}` as Parameters<typeof t>[0])
  const vm = (k: string) => t(`actionRequired.balanceTable.${k}` as Parameters<typeof t>[0])

  /** 상세: 성인·아동·유아·미포함·상품합 / 요약: 미포함·상품합 */
  const productColSpan = productPriceMode === 'detail' ? 5 : 2
  const discountColSpan = discountExtraMode === 'detail' ? 9 : 1

  /** 일괄 반영 행 colspan = 1행(섹션) 열 수와 동일 — 가로 스크롤·freeze와 정렬 */
  const totalTableColSpan = useMemo(() => {
    const sel = selectionEnabled ? 1 : 0
    return sel + 5 + productColSpan + discountColSpan + 3 + 7 + 5 + 1
  }, [selectionEnabled, productColSpan, discountColSpan])

  const tableMinWClass =
    productPriceMode === 'detail' && discountExtraMode === 'detail'
      ? selectionEnabled
        ? 'min-w-[2730px]'
        : 'min-w-[2670px]'
      : productPriceMode === 'subtotal' && discountExtraMode === 'subtotal'
        ? selectionEnabled
          ? 'min-w-[1590px]'
          : 'min-w-[1530px]'
        : selectionEnabled
          ? 'min-w-[2190px]'
          : 'min-w-[2130px]'

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <table className={`w-full ${tableMinWClass} text-left border-collapse`}>
        <thead className="sticky top-0 z-[50] bg-slate-100 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.12)]">
          {selectionEnabled && (
            <tr className="bg-gray-50/95 border-b border-gray-200">
              <th colSpan={totalTableColSpan} className="p-0 align-top">
                <div className="flex flex-wrap items-start justify-between gap-2 px-3 py-2">
                  <p className="text-[10px] text-gray-600 max-w-xl leading-snug">
                    {t('actionRequired.balanceTable.applyToolbarHint')}
                  </p>
                  <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
                    <button
                      type="button"
                      title={t('actionRequired.balanceTable.applyTotalTitle')}
                      disabled={applySyncing || selectedIds.size === 0}
                      onClick={() => runApplySelected('total')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-sky-300 bg-sky-50 text-sky-900 hover:bg-sky-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {applySyncing ? t('actionRequired.balanceTable.applySelectedRunning') : t('actionRequired.balanceTable.applyTotal')}
                      {!applySyncing && selectedIds.size > 0 ? ` (${selectedIds.size})` : null}
                    </button>
                    <button
                      type="button"
                      title={t('actionRequired.balanceTable.applyDepositTitle')}
                      disabled={applySyncing || selectedIds.size === 0}
                      onClick={() => runApplySelected('deposit')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-violet-300 bg-violet-50 text-violet-900 hover:bg-violet-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {applySyncing ? t('actionRequired.balanceTable.applySelectedRunning') : t('actionRequired.balanceTable.applyDeposit')}
                      {!applySyncing && selectedIds.size > 0 ? ` (${selectedIds.size})` : null}
                    </button>
                    <button
                      type="button"
                      title={t('actionRequired.balanceTable.applyBalanceTitle')}
                      disabled={applySyncing || selectedIds.size === 0}
                      onClick={() => runApplySelected('balance')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {applySyncing ? t('actionRequired.balanceTable.applySelectedRunning') : t('actionRequired.balanceTable.applyBalance')}
                      {!applySyncing && selectedIds.size > 0 ? ` (${selectedIds.size})` : null}
                    </button>
                    <button
                      type="button"
                      title={t('actionRequired.balanceTable.applyAllTitle')}
                      disabled={applySyncing || selectedIds.size === 0}
                      onClick={() => runApplySelected('all')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border border-emerald-400 bg-emerald-50 text-emerald-950 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {applySyncing ? t('actionRequired.balanceTable.applySelectedRunning') : t('actionRequired.balanceTable.applyAll')}
                      {!applySyncing && selectedIds.size > 0 ? ` (${selectedIds.size})` : null}
                    </button>
                  </div>
                </div>
              </th>
            </tr>
          )}
          <tr className="bg-slate-100 border-b border-gray-200 text-[10px] font-semibold text-slate-700">
            {selectionEnabled && (
              <th
                rowSpan={2}
                className="sticky left-0 z-[35] px-1 py-1.5 w-8 text-center border-r border-gray-200 align-middle bg-slate-100 shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]"
              >
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={allPageSelected}
                  disabled={applySyncing || pageIds.length === 0}
                  onChange={toggleSelectAllPage}
                  title={t('actionRequired.balanceTable.selectPageTitle')}
                  aria-label={t('actionRequired.balanceTable.selectPageAria')}
                />
              </th>
            )}
            <th
              colSpan={5}
              className={`px-1.5 py-1.5 text-center border-r border-gray-200 shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)] bg-slate-100 ${
                selectionEnabled ? 'sticky left-8 z-[34]' : 'sticky left-0 z-[34]'
              }`}
            >
              {sec('reservation')}
            </th>
            <th
              colSpan={productColSpan}
              className="p-0 text-center border-r border-gray-200 bg-blue-50/80 align-stretch"
            >
              <button
                type="button"
                onClick={() => setProductPriceMode((m) => (m === 'detail' ? 'subtotal' : 'detail'))}
                title={
                  productPriceMode === 'detail' ? vm('switchToSubtotalTitle') : vm('switchToDetailTitle')
                }
                aria-pressed={productPriceMode === 'subtotal'}
                className="w-full h-full min-h-[2.25rem] px-1.5 py-2 flex items-center justify-center hover:bg-blue-100/70 active:bg-blue-100 transition-colors cursor-pointer"
              >
                {sec('productPrice')}
              </button>
            </th>
            <th
              colSpan={discountColSpan}
              className="p-0 text-center border-r border-gray-200 bg-orange-50/50 align-stretch"
            >
              <button
                type="button"
                onClick={() => setDiscountExtraMode((m) => (m === 'detail' ? 'subtotal' : 'detail'))}
                title={
                  discountExtraMode === 'detail' ? vm('switchToSubtotalTitle') : vm('switchToDetailTitle')
                }
                aria-pressed={discountExtraMode === 'subtotal'}
                className="w-full h-full min-h-[2.25rem] px-1.5 py-2 flex items-center justify-center hover:bg-orange-100/70 active:bg-orange-100 transition-colors cursor-pointer"
              >
                {sec('discountExtra')}
              </button>
            </th>
            <th colSpan={3} className="px-1.5 py-1.5 text-center border-r border-gray-200">
              {sec('optionsSubtotal')}
            </th>
            <th colSpan={7} className="px-1.5 py-1.5 text-center border-r border-gray-200 bg-blue-50/60">
              {sec('customerPayment')}
            </th>
            <th colSpan={5} className="px-1.5 py-1.5 text-center border-r border-gray-200 bg-violet-50/50">
              {sec('channel')}
            </th>
            <th rowSpan={2} className="px-1.5 py-1.5 text-center align-bottom bg-slate-100 min-w-[3rem] border-l border-gray-200">
              {sec('actions')}
            </th>
          </tr>
          <tr className="bg-gray-50 border-b border-gray-200 text-[9px] font-medium text-gray-600 uppercase tracking-wide">
            <th
              className={`px-1.5 py-1 ${reservationColSticky(0, selectionEnabled, 'theadSub')}`}
              title={rsvCol('customer_id')}
            >
              {s('customer')}
            </th>
            <th
              className={`px-1.5 py-1 ${reservationColSticky(1, selectionEnabled, 'theadSub')}`}
              title={rsvCol('product_id')}
            >
              {s('product')}
            </th>
            <th
              className={`px-1.5 py-1 whitespace-nowrap ${reservationColSticky(2, selectionEnabled, 'theadSub')}`}
              title={rsvCol('tour_date')}
            >
              {s('tourDate')}
            </th>
            <th
              className={`px-1.5 py-1 ${reservationColSticky(3, selectionEnabled, 'theadSub')}`}
              title={rsvCol('status')}
            >
              {s('status')}
            </th>
            <th
              className={`px-1.5 py-1 text-left max-w-[8rem] ${reservationColSticky(4, selectionEnabled, 'theadSub')}`}
              title={[rsvCol('channel_id'), rsvCol('channel_rn'), rsvCol('variant_key')].join('\n')}
            >
              {s('channelVariant')}
            </th>

            {productPriceMode === 'detail' ? (
              <>
                <th className="px-1.5 py-1 border-r border-gray-100 text-right" title={rpCol('adult_product_price')}>
                  {s('adult')}
                </th>
                <th className="px-1.5 py-1 border-r border-gray-100 text-right" title={rpCol('child_product_price')}>
                  {s('child')}
                </th>
                <th className="px-1.5 py-1 border-r border-gray-100 text-right" title={rpCol('infant_product_price')}>
                  {s('infant')}
                </th>
                <th className="px-1.5 py-1 border-r border-gray-100 text-right bg-gray-50/50" title={rpCol('not_included_price')}>
                  {s('notIncluded')}
                </th>
                <th className="px-1.5 py-1 border-r border-gray-200 text-right bg-blue-50/40" title={rpCol('product_price_total')}>
                  {s('productSum')}
                </th>
              </>
            ) : (
              <>
                <th className="px-1.5 py-1 border-r border-gray-100 text-right bg-gray-50/50" title={rpCol('not_included_price')}>
                  {s('notIncluded')}
                </th>
                <th className="px-1.5 py-1 border-r border-gray-200 text-right bg-blue-50/40" title={rpCol('product_price_total')}>
                  {s('productSum')}
                </th>
              </>
            )}

            {discountExtraMode === 'detail' ? (
              <>
                <th className="px-1.5 py-1 border-r border-gray-100 text-right" title={rpCol('coupon_discount')}>
                  {s('coupon')}
                </th>
                <th className="px-1.5 py-1 border-r border-gray-100 text-right" title={rpCol('additional_discount')}>
                  {s('addDiscount')}
                </th>
                <th className="px-1.5 py-1 border-r border-gray-100 text-right" title={rpCol('additional_cost')}>
                  {s('addCost')}
                </th>
                <th className="px-1.5 py-1 border-r border-gray-100 text-right" title={rpCol('tax')}>
                  {s('tax')}
                </th>
                <th className="px-1.5 py-1 border-r border-gray-100 text-right" title={rpCol('card_fee')}>
                  {s('cardFee')}
                </th>
                <th className="px-1.5 py-1 border-r border-gray-100 text-right" title={rpCol('prepayment_cost')}>
                  {s('prepayCost')}
                </th>
                <th className="px-1.5 py-1 border-r border-gray-100 text-right" title={rpCol('prepayment_tip')}>
                  {s('prepayTip')}
                </th>
                <th className="px-1.5 py-1 border-r border-gray-100 text-right" title={rpCol('private_tour_additional_cost')}>
                  {s('privateTour')}
                </th>
                <th
                  className="px-1.5 py-1 border-r border-gray-200 text-right bg-orange-50/40"
                  title={t('actionRequired.balanceTable.cols.discountSubtotalComputed')}
                >
                  {s('discountExtraSubtotal')}
                </th>
              </>
            ) : (
              <th
                className="px-1.5 py-1 border-r border-gray-200 text-right bg-orange-50/40"
                title={t('actionRequired.balanceTable.cols.discountSubtotalComputed')}
              >
                {s('discountExtraSubtotal')}
              </th>
            )}

            <th className="px-1.5 py-1 border-r border-gray-100 text-right" title={rpCol('required_option_total')}>
              {s('requiredOpt')}
            </th>
            <th className="px-1.5 py-1 border-r border-gray-100 text-right" title={rpCol('option_total')}>
              {s('option')}
            </th>
            <th
              className="px-1.5 py-1 border-r border-gray-200 text-right bg-emerald-50/50"
              title={t('actionRequired.balanceTable.cols.optSumComputed')}
            >
              {s('optSum')}
            </th>

            <th className="px-1.5 py-1 border-r border-gray-100 text-right" title={rpCol('total_price')}>
              {s('totalDb')}
            </th>
            <th className="px-1.5 py-1 border-r border-gray-100 text-right" title={t('actionRequired.balanceTable.cols.totalComputedNotDb')}>
              {s('totalComputed')}
            </th>
            <th className="px-1.5 py-1 border-r border-gray-100 text-right" title={rpCol('deposit_amount')}>
              {s('depositDb')}
            </th>
            <th className="px-1.5 py-1 border-r border-gray-100 text-right bg-slate-50/80" title={t('actionRequired.balanceTable.cols.paymentRecordsAgg')}>
              {s('depositFromRecords')}
            </th>
            <th className="px-1.5 py-1 border-r border-gray-100 text-right" title={rpCol('balance_amount')}>
              {s('balanceDb')}
            </th>
            <th
              className="px-1.5 py-1 border-r border-gray-100 text-right bg-amber-50/40"
              title={t('actionRequired.balanceTable.cols.balanceReceivedRecordsHint')}
            >
              {s('balanceReceivedRecords')}
            </th>
            <th
              className="px-1.5 py-1 border-r border-gray-100 text-right bg-amber-50/50"
              title={t('actionRequired.balanceTable.cols.balanceComputedOutstandingHint')}
            >
              {s('balanceComputedOutstanding')}
            </th>

            <th className="px-1.5 py-1 border-r border-gray-100 text-right" title={rpCol('deposit_amount')}>
              {s('channelDeposit')}
            </th>
            <th className="px-1.5 py-1 border-r border-gray-100 text-right" title={rpCol('commission_base_price')}>
              {s('channelOtaBase')}
            </th>
            <th className="px-1.5 py-1 border-r border-gray-100 text-right" title={rpCol('commission_percent')}>
              {s('commPct')}
            </th>
            <th className="px-1.5 py-1 border-r border-gray-100 text-right" title={rpCol('commission_amount')}>
              {s('commAmt')}
            </th>
            <th className="px-1.5 py-1 border-r border-gray-200 text-right" title={rpCol('channel_settlement_amount')}>
              {s('settlement')}
            </th>
          </tr>
        </thead>
        <tbody>
          {reservations.map((reservation) => (
            <BalanceRow
              key={reservation.id}
              {...rest}
              actionsColumnEditOnly={actionsColumnEditOnly}
              reservationPricingMap={reservationPricingMap}
              reservationOptionSumByReservationId={reservationOptionSumByReservationId}
              reservation={reservation}
              paymentRecords={paymentRecordsByReservationId?.get(reservation.id) ?? []}
              productPriceMode={productPriceMode}
              discountExtraMode={discountExtraMode}
              selectionEnabled={selectionEnabled}
              rowChecked={selectedIds.has(reservation.id)}
              onRowCheckChange={onRowCheckChange}
              selectionDisabled={applySyncing}
              onApplyRowPatch={selectionEnabled ? applySingleRow : undefined}
              applyRowBusyKey={applyRowBusyKey}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
