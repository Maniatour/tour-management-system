'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
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
  UserRound,
} from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
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
import { syncReservationPricingAggregates } from '@/lib/syncReservationPricingAggregates'
import {
  CANCEL_DEPOSIT_REFUND_NOTE_MANUAL,
  insertCancelDepositRefundPaymentRecord,
} from '@/lib/cancelDepositRefundPaymentRecord'
import type { PaymentRecordLike } from '@/utils/reservationPricingBalance'
import TableSortHeaderButton from '@/components/expenses/TableSortHeaderButton'
import { ReservationChannelFavicon } from '@/components/reservation/ReservationChannelFavicon'
import type { SortDir } from '@/lib/clientTableSort'
import {
  pricingFieldToNumber,
  effectiveProductPriceTotalForBalance,
  computeCustomerPaymentTotalLineFormula,
  computeDepositBalanceFromPaymentRecordsForLineGross,
  balanceOutstandingTotalMinusDeposit,
  isStoredCustomerTotalMismatchWithFormula,
  summarizePaymentRecordsForBalance,
  mergePricingWithLiveOptionTotal,
  normalizeReservationIdForPayments,
  sumPaymentRecordLedgerRefundDisplayUsd,
} from '@/utils/reservationPricingBalance'
import { productShowsResidentStatusSectionByCode } from '@/utils/residentStatusSectionProducts'
import {
  buildReservationPricingMismatchFormulaPatch,
  computeBalanceChannelMetrics,
  findChannelRowForBalance,
} from '@/utils/balanceChannelRevenue'

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

function fmtPct(v: number | undefined | null): string {
  if (v == null || (typeof v === 'number' && Number.isNaN(v))) return '—'
  return `${Number(v).toFixed(2)}%`
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

type PricingApplyMode =
  | 'total'
  | 'deposit'
  | 'balance'
  | 'channelPayment'
  | 'channelSettlement'
  | 'all'
  | 'mismatchFormulaBundle'
  /** 취소 탭: 채널 결제·수수료·정산을 DB에 0으로 고정 */
  | 'channelFinancialZeros'

/** 일괄 반영·행 단위 반영 공통 — reservation_pricing 업데이트 필드만 생성 */
function buildReservationPricingPatch(
  r: Reservation,
  p: ReservationPricingMapValue,
  reservationOptionSumByReservationId: Map<string, number> | undefined,
  records: PaymentRecordLike[],
  mode: PricingApplyMode,
  channels:
    | Array<{
        id: string
        type?: string | null
        category?: string | null
        name?: string | null
        commission_percent?: number | null
        commission_rate?: number | null
        commission?: number | null
        sub_channels?: string[] | null
      }>
    | undefined
): Record<string, number> | null {
  if (mode === 'channelFinancialZeros') {
    return {
      commission_base_price: 0,
      commission_percent: 0,
      commission_amount: 0,
      channel_settlement_amount: 0,
    }
  }
  if (mode === 'mismatchFormulaBundle') {
    return buildReservationPricingMismatchFormulaPatch(
      r,
      p,
      reservationOptionSumByReservationId,
      records,
      channels ?? []
    )
  }
  const party = { adults: r.adults ?? 0, children: r.child ?? 0, infants: r.infant ?? 0 }
  const pForGross =
    mergePricingWithLiveOptionTotal(p, normalizeReservationIdForPayments(r.id), reservationOptionSumByReservationId) ??
    p
  const gross = computeCustomerPaymentTotalLineFormula(pForGross, party)
  const st = String(r.status || '').toLowerCase().trim()
  const isCancelled = st === 'cancelled' || st === 'canceled'
  const { depositBucketGross } = summarizePaymentRecordsForBalance(records)
  /** 총액(산식) − 보증금(입금 집계 순효과 또는 DB 보증금). 잔금 수령 합은 차감하지 않음 */
  const remainingPay = balanceOutstandingTotalMinusDeposit(
    gross,
    records,
    pricingFieldToNumber(p.deposit_amount),
    isCancelled
  )
  const patch: Record<string, number> = {}
  if (mode === 'total' || mode === 'all') patch.total_price = gross
  if (mode === 'deposit' || mode === 'all') patch.deposit_amount = depositBucketGross
  if (mode === 'balance' || mode === 'all') patch.balance_amount = remainingPay
  if (mode === 'channelPayment') {
    const m = computeBalanceChannelMetrics(p, r, channels ?? [], records, reservationOptionSumByReservationId)
    if (m == null) return null
    patch.commission_base_price = round2(m.channelPaymentFromFormula)
  }
  if (mode === 'channelSettlement') {
    const m = computeBalanceChannelMetrics(p, r, channels ?? [], records, reservationOptionSumByReservationId)
    if (m == null) return null
    patch.channel_settlement_amount = round2(m.channelSettlementFromFormula)
  }
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

/** 인라인: 윗줄 DB값 더블클릭 → reservation_pricing 패치 */
type DbFormulaInlineEdit = {
  reservationId: string
  columnKey: string
  buildPatch: (n: number) => Record<string, number>
  canEdit: boolean
  inlineBusyKey: string | null
  onCommit: (reservationId: string, patch: Record<string, number>, columnKey: string) => Promise<void>
  editTitle: string
}

/** 금액·퍼센트: 윗줄 DB값 · 아랫줄 산식 — 가로줄 구분, 불일치 시 아랫줄만 빨간색. 윗줄 더블클릭 시 DB 인라인 수정 */
function DbFormulaMoneyCell(props: {
  dbVal: number | null | undefined
  computedVal: number | null | undefined
  format?: 'usd' | 'coupon' | 'percent'
  className?: string
  inlineEdit?: DbFormulaInlineEdit
  /** true면 산식(입금 집계) 금액을 위에 두고 DB는 아래 — 취소·환불이 입금에만 있을 때 한눈에 보이게 */
  stackComputedFirst?: boolean
}) {
  const { dbVal, computedVal, format = 'usd', className = '', inlineEdit, stackComputedFirst = false } = props
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const committingRef = useRef(false)
  /** blur 핸들러가 배치된 state보다 먼저 실행되는 경우 커밋 방지 */
  const editingRef = useRef(false)

  const nDb = dbVal == null || Number.isNaN(Number(dbVal)) ? null : Number(dbVal)
  const nCo =
    computedVal == null || Number.isNaN(Number(computedVal)) ? null : Number(computedVal)
  const tol = format === 'percent' ? 0.05 : 0.01
  const mismatch = nDb != null && nCo != null && Math.abs(nDb - nCo) > tol
  const top =
    format === 'coupon'
      ? fmtCoupon(nDb ?? undefined)
      : format === 'percent'
        ? fmtPct(nDb ?? undefined)
        : fmtUsd(nDb ?? undefined)
  const bot =
    format === 'coupon'
      ? fmtCoupon(nCo ?? undefined)
      : format === 'percent'
        ? fmtPct(nCo ?? undefined)
        : fmtUsd(nCo ?? undefined)

  const busy =
    inlineEdit?.canEdit &&
    inlineEdit.inlineBusyKey === `${inlineEdit.reservationId}:inline:${inlineEdit.columnKey}`

  const openEditor = () => {
    if (!inlineEdit?.canEdit || busy || editingRef.current) return
    const base = nDb ?? 0
    if (format === 'percent') {
      setDraft(Number(base).toFixed(2))
    } else if (format === 'coupon') {
      setDraft(Math.abs(base) < 0.005 ? '' : Math.abs(base).toFixed(2))
    } else {
      setDraft(Number(base).toFixed(2))
    }
    editingRef.current = true
    setEditing(true)
  }

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commitEdit = async () => {
    if (!inlineEdit?.canEdit || !editingRef.current || committingRef.current) return
    const raw = draft.trim()
    if (raw === '' || raw === '-') {
      editingRef.current = false
      setEditing(false)
      return
    }
    let n = parseFloat(raw)
    if (!Number.isFinite(n)) {
      editingRef.current = false
      setEditing(false)
      return
    }
    if (format === 'coupon') {
      n = Math.abs(n)
    }
    n = round2(n)
    committingRef.current = true
    try {
      const patch = inlineEdit.buildPatch(n)
      await inlineEdit.onCommit(inlineEdit.reservationId, patch, inlineEdit.columnKey)
    } finally {
      committingRef.current = false
      editingRef.current = false
      setEditing(false)
    }
  }

  const cancelEdit = () => {
    committingRef.current = false
    editingRef.current = false
    setEditing(false)
    setDraft('')
  }

  const topEl =
    editing && inlineEdit?.canEdit ? (
      <input
        ref={inputRef}
        type="number"
        step={format === 'percent' ? '0.01' : '0.01'}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void commitEdit()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            cancelEdit()
          }
        }}
        onBlur={() => void commitEdit()}
        disabled={busy}
        className="w-full min-w-[2.75rem] max-w-[4.5rem] ml-auto block tabular-nums text-[10px] text-right border border-blue-400 rounded px-0.5 py-px bg-white"
      />
    ) : (
      <div
        role={inlineEdit?.canEdit ? 'button' : undefined}
        tabIndex={inlineEdit?.canEdit ? 0 : undefined}
        title={inlineEdit?.canEdit ? inlineEdit.editTitle : undefined}
        onDoubleClick={(e) => {
          e.stopPropagation()
          openEditor()
        }}
        onKeyDown={(e) => {
          if (!inlineEdit?.canEdit || busy) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openEditor()
          }
        }}
        className={`tabular-nums leading-tight text-right text-gray-900 ${
          inlineEdit?.canEdit && !busy ? 'cursor-cell hover:bg-blue-50/80 rounded px-0.5 -mx-0.5' : ''
        }`}
      >
        {busy ? <span className="opacity-50">{top}</span> : top}
      </div>
    )

  if (stackComputedFirst) {
    return (
      <div className={`flex flex-col items-stretch min-w-[3.25rem] py-0.5 ${className}`}>
        <div className="tabular-nums leading-tight text-right font-semibold text-gray-900">{bot}</div>
        <div
          className={`mt-0.5 border-t border-gray-200/90 pt-0.5 ${mismatch ? 'rounded ring-1 ring-inset ring-amber-200/90' : ''}`}
        >
          {topEl}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col items-stretch min-w-[3.25rem] py-0.5 ${className}`}>
      {topEl}
      <div className="mt-0.5 border-t border-gray-200/90 pt-0.5">
        <div className={`tabular-nums leading-tight text-right ${mismatch ? 'font-semibold text-red-600' : 'text-gray-800'}`}>
          {bot}
        </div>
      </div>
    </div>
  )
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

function fmtUsdSigned(v: number): string {
  if (v == null || Number.isNaN(v)) return '—'
  const n = Number(v)
  if (Math.abs(n) < 0.005) return '$0.00'
  const sign = n < 0 ? '-' : ''
  return `${sign}$${Math.abs(n).toFixed(2)}`
}

/** 가로 스크롤 시 예약 영역 열 고정 — 대략 열 폭 기준 left 누적(패딩·max-w 축소와 맞춤) */
const RES_LEFT: Record<'sel' | 'nosel', readonly [string, string, string, string, string]> = {
  nosel: ['left-0', 'left-[6.25rem]', 'left-[13.75rem]', 'left-[18.75rem]', 'left-[23.75rem]'],
  sel: ['left-7', 'left-[8rem]', 'left-[15.5rem]', 'left-[20.5rem]', 'left-[25.5rem]'],
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

/** 고객 총액 라인 산식 문자열(표시용, 빨간색) — 취소가 아닌 예약용 */
function lineFormulaExpressionText(
  p: ReservationPricingMapValue | undefined,
  party: ReturnType<typeof partyFromReservation>
): string | null {
  if (!p) return null
  const productSum = effectiveProductPriceTotalForBalance(p, party)
  const discount =
    pricingFieldToNumber(p.coupon_discount) + pricingFieldToNumber(p.additional_discount)
  const optionsSub =
    pricingFieldToNumber(p.required_option_total) + pricingFieldToNumber(p.option_total)
  const extras =
    pricingFieldToNumber(p.additional_cost) +
    pricingFieldToNumber(p.tax) +
    pricingFieldToNumber(p.card_fee) +
    pricingFieldToNumber(p.prepayment_cost) +
    pricingFieldToNumber(p.prepayment_tip) +
    pricingFieldToNumber(p.private_tour_additional_cost) -
    pricingFieldToNumber(p.refund_amount)
  const computed = round2(computeCustomerPaymentTotalLineFormula(p, party))
  return `${fmtUsd(productSum)} − ${fmtUsd(discount)} + ${fmtUsd(optionsSub)} + ${fmtUsdSigned(extras)} = ${fmtUsd(computed)}`
}

/** 취소 예약: 보증금(입금) − 가격 환불 기록이 우선 */
function cancelledCustomerPaymentMoneyHint(
  depositBasis: number,
  refundFromPricing: number,
  t: (key: string, values?: Record<string, string>) => string
): string | null {
  const dep = round2(depositBasis)
  const ref = round2(refundFromPricing)
  const net = round2(dep - ref)
  const line1 = t('actionRequired.balanceTable.cols.cancelledMoneyHintLine', {
    deposit: fmtUsd(dep) ?? '$0.00',
    refund: fmtUsd(ref) ?? '$0.00',
    net: fmtUsd(net) ?? '$0.00',
  })
  const line2 = t('actionRequired.balanceTable.cols.cancelledMoneyHintNote')
  return `${line1}\n${line2}`
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
  if (p.total_price == null) return null
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
  products: Array<{ id: string; name: string; sub_category?: string; product_code?: string | null }>
  channels: Array<{
    id: string
    name: string
    favicon_url?: string | null
    type?: string | null
    category?: string | null
    commission_percent?: number | null
    commission_rate?: number | null
    commission?: number | null
    sub_channels?: string[] | null
  }>
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
  onEmailPreview: (
    reservation: Reservation,
    emailType: 'confirmation' | 'departure' | 'pickup' | 'resident_inquiry'
  ) => void
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
  /** 총액·보증금·잔액 일괄/행 DB 반영(체크·행 버튼). 예약 처리 필요 모달의 예약 가격·밸런스 탭 공통 */
  enablePricingDbApply?: boolean
  /** ② 산식 불일치 탭: 고객 총액·채널 결제·수수료·정산 계산식 일괄 반영 버튼 */
  enableMismatchFormulaBundleApply?: boolean
  /** 예약 처리 필요 취소 탭: 입금 내역과 동일 「-$취소」파트너 반환 라인 */
  showPartnerCancelRefundAction?: boolean
  onRefreshPaymentAggregates?: (reservationIds: string[]) => void | Promise<void>
  /** 예약 정보 · 투어일 헤더 정렬 */
  tourDateSortActive?: boolean
  tourDateSortDir?: SortDir
  onTourDateSortClick?: () => void
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
    { value: 'inquiry', labelKey: 'status.inquiry' },
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

/** 가격 정보 흐름: 상품합(DB·effective) ~ 옵션 Subtotal(DB·실시간) */
const PRICING_FLOW_COLUMN_COUNT = 15
/** 고객 결제: 총액·보증금·입금집계·환불·잔액 등 */
const PAYMENT_COLUMN_COUNT = 6
/** 채널 결제·수수료·정산·총매출·운영이익 (보증금은 고객 결제 열과 중복이므로 제외) */
const CHANNEL_COLUMN_COUNT = 6

export type BalanceRowProps = Omit<BalanceProps, 'reservations'> & {
  reservation: Reservation
  paymentRecords: PaymentRecordLike[]
  selectionEnabled: boolean
  rowChecked: boolean
  onRowCheckChange: (reservationId: string, checked: boolean) => void
  selectionDisabled: boolean
  onApplyRowPatch?: (
    reservationId: string,
    mode:
      | 'total'
      | 'deposit'
      | 'balance'
      | 'channelPayment'
      | 'channelSettlement'
      | 'mismatchFormulaBundle'
      | 'channelFinancialZeros'
  ) => Promise<void>
  applyRowBusyKey?: string | null
  /** 윗줄 DB값 더블클릭 인라인 저장 → reservation_pricing.update */
  onInlinePricingCommit?: (
    reservationId: string,
    patch: Record<string, number>,
    columnKey: string
  ) => Promise<void>
  inlineEditBusyKey?: string | null
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
    selectionEnabled,
    rowChecked,
    onRowCheckChange,
    selectionDisabled,
    onApplyRowPatch,
    applyRowBusyKey,
    onInlinePricingCommit,
    inlineEditBusyKey,
    actionsColumnEditOnly = false,
    enableMismatchFormulaBundleApply = false,
    showPartnerCancelRefundAction = false,
    onRefreshPaymentAggregates,
  } = props
  const paymentLocale = useLocale()
  const [partnerRefundBusy, setPartnerRefundBusy] = useState(false)

  const rsvKey = normalizeReservationIdForPayments(reservation.id)
  const p = reservationPricingMap.get(reservation.id)
  const pLine = useMemo(
    () =>
      mergePricingWithLiveOptionTotal(p, rsvKey, reservationOptionSumByReservationId) as
        | ReservationPricingMapValue
        | undefined,
    [p, rsvKey, reservationOptionSumByReservationId]
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
  const depositBasisForCancelHint = fromPayments.hasRecords
    ? fromPayments.depositBucketGross
    : depositDb
  const refundAmountDb = pricingFieldToNumber(p?.refund_amount)
  const paymentAggSummary = useMemo(
    () => summarizePaymentRecordsForBalance(paymentRecords),
    [paymentRecords]
  )
  /** 입금 내역 `환불됨 (파트너)`·Returned 라인 합(표시는 양수 환불액) */
  const partnerReturnedFromRecordsUsd = round2(Math.abs(paymentAggSummary.returnedTotal))
  /** 입금 `환불됨 (우리)`·Refunded 라인 합 */
  const ourRefundedFromRecordsUsd = round2(Math.abs(paymentAggSummary.refundedTotal))
  const summarizedLedgerRefundUsd = round2(partnerReturnedFromRecordsUsd + ourRefundedFromRecordsUsd)
  /** 환불(기록) 열 윗줄 — 집계가 0이면 변형 상태값도 잡는 느슨 합산 폴백 */
  const paymentLedgerRefundTotalUsd =
    summarizedLedgerRefundUsd > 0.01
      ? summarizedLedgerRefundUsd
      : sumPaymentRecordLedgerRefundDisplayUsd(paymentRecords)
  /** 취소 행이거나 입금에 환불 라인만 있어도 윗줄에 입금 합 표시(DB가 cancelled가 아닐 때 누락 방지) */
  const stackPaymentRefundLine = isCancelledRsv || paymentLedgerRefundTotalUsd > 0.01
  const customerRefundComputedVal = stackPaymentRefundLine ? paymentLedgerRefundTotalUsd : refundAmountDb
  /** 취소 툴팁 산식: 입금 환불 합이 있으면 그걸 쓰고, 없으면 가격 refund_amount */
  const cancelHintRefundUsd = isCancelledRsv
    ? paymentLedgerRefundTotalUsd > 0.01
      ? paymentLedgerRefundTotalUsd
      : refundAmountDb
    : refundAmountDb
  const formulaExpression = isCancelledRsv
    ? cancelledCustomerPaymentMoneyHint(depositBasisForCancelHint, cancelHintRefundUsd, t)
    : lineFormulaExpressionText(pLine, party)
  const balanceComputedOutstanding = balanceOutstandingTotalMinusDeposit(
    lineGrossForPaymentCompare,
    paymentRecords,
    depositDb,
    isCancelledRsv
  )
  const depositPrMismatch =
    fromPayments.hasRecords && Math.abs(depositDb - fromPayments.depositBucketGross) > 0.01
  const balancePrMismatch =
    p != null && Math.abs(balanceDb - balanceComputedOutstanding) > 0.01
  const productSumDisplay = productPriceTotalForDisplay(p, reservation)

  const rawProductStored = p != null ? pricingFieldToNumber(p.product_price_total) : null
  const effectiveProduct = p != null ? effectiveProductPriceTotalForBalance(p, party) : null
  const couponN = pricingFieldToNumber(p?.coupon_discount)
  const addDiscN = pricingFieldToNumber(p?.additional_discount)
  const dbAfterDiscountProduct =
    p != null && rawProductStored != null ? round2(rawProductStored - couponN - addDiscN) : null
  const computedAfterDiscountProduct =
    p != null && effectiveProduct != null ? round2(effectiveProduct - couponN - addDiscN) : null
  const notInclTotal = notIncludedTotalForParty(p, reservation)
  const optDbOnly = pricingFieldToNumber(p?.option_total)
  const optLineMerged = pLine != null ? pricingFieldToNumber(pLine.option_total) : null
  const optSubDb = p != null ? optionsLineItemsSum(p, reservation) : null
  const optSubLine = pLine != null ? optionsLineItemsSum(pLine, reservation) : null
  const depositComputedCompare = fromPayments.hasRecords
    ? fromPayments.depositBucketGross
    : depositDb

  /** 잔금 수령(입금) 금액 ≠ 잔액(계산) 표시값 — 두 열 강조 */
  const highlightReceivedVsBalanceComputed =
    fromPayments.hasRecords &&
    p != null &&
    Math.abs(fromPayments.balanceReceivedTotal - balanceComputedOutstanding) > 0.01

  /** 입금 내역「-$취소」와 동일: DB 보증금 우선, 없으면 입금 집계 보증금 순액 */
  const suggestedPartnerRefundUsd = useMemo(() => {
    const dbDep = pricingFieldToNumber(p?.deposit_amount)
    return round2(
      dbDep > 0.01
        ? dbDep
        : paymentAggSummary.depositTotalNet > 0.01
          ? paymentAggSummary.depositTotalNet
          : 0
    )
  }, [p, paymentAggSummary])

  const handlePartnerCancelRefundClick = async () => {
    if (!showPartnerCancelRefundAction || !onRefreshPaymentAggregates) return
    const amt = suggestedPartnerRefundUsd
    if (amt <= 0.01) {
      alert(
        paymentLocale === 'en'
          ? 'Set deposit in pricing first, or ensure deposit payment lines exist.'
          : '가격 정보의 보증금을 먼저 입력하거나, 보증금 입금 라인이 있는지 확인하세요.'
      )
      return
    }
    setPartnerRefundBusy(true)
    try {
      const res = await insertCancelDepositRefundPaymentRecord({
        supabase,
        reservationId: reservation.id,
        amountUsd: amt,
        note: CANCEL_DEPOSIT_REFUND_NOTE_MANUAL,
      })
      if (!res.ok) {
        alert(
          res.error ??
            (paymentLocale === 'en' ? 'Failed to add payment line.' : '입금 내역 추가에 실패했습니다.')
        )
        return
      }
      if (res.skipped) return
      await onRefreshPaymentAggregates([reservation.id])
    } finally {
      setPartnerRefundBusy(false)
    }
  }

  const product = products?.find((pr) => pr.id === reservation.productId)
  const isManiaTour = product?.sub_category === 'Mania Tour' || product?.sub_category === 'Mania Service'
  const showCreateTour = isManiaTour && !reservation.hasExistingTour
  const showResidentInquiryEmail = productShowsResidentStatusSectionByCode(product?.product_code ?? null)
  const channelMetrics = useMemo(
    () =>
      computeBalanceChannelMetrics(
        p,
        reservation,
        channels || [],
        paymentRecords,
        reservationOptionSumByReservationId
      ),
    [p, reservation, channels, paymentRecords, reservationOptionSumByReservationId]
  )

  const dbChannelSettlement =
    p != null &&
    p.channel_settlement_amount != null &&
    Number.isFinite(Number(p.channel_settlement_amount))
      ? pricingFieldToNumber(p.channel_settlement_amount)
      : null
  const channelSettlementFormula = channelMetrics?.channelSettlementFromFormula ?? null
  const channelSettlementMismatch =
    channelSettlementFormula != null &&
    p != null &&
    (dbChannelSettlement == null ||
      Math.abs(dbChannelSettlement - channelSettlementFormula) > 0.01)

  const channelPaymentFormula =
    channelMetrics != null ? channelMetrics.channelPaymentFromFormula : null
  const dbChannelPayment = channelMetrics?.channelPaymentDb ?? null
  const channelPaymentMismatch =
    channelPaymentFormula != null &&
    p != null &&
    (dbChannelPayment == null ||
      Math.abs(dbChannelPayment - channelPaymentFormula) > 0.01)

  const commPctMismatch =
    channelMetrics?.commissionPercentDb != null &&
    channelMetrics?.commissionPercentFromChannel != null &&
    Math.abs(channelMetrics.commissionPercentDb - channelMetrics.commissionPercentFromChannel) > 0.05

  const commAmtMismatch =
    channelMetrics?.commissionAmountDb != null &&
    channelMetrics.commissionAmountFromFormula != null &&
    Math.abs(channelMetrics.commissionAmountDb - channelMetrics.commissionAmountFromFormula) > 0.01

  const needsMismatchFormulaBundleRow =
    enableMismatchFormulaBundleApply &&
    p != null &&
    (totalMismatch ||
      channelPaymentMismatch ||
      channelSettlementMismatch ||
      commPctMismatch ||
      commAmtMismatch)

  const inlineEditHint = t('actionRequired.balanceTable.inlineEditDbHint')
  const rowPatchBusy =
    applyRowBusyKey != null && applyRowBusyKey.startsWith(`${reservation.id}:`)
  const inlineEditBlocked = selectionDisabled || rowPatchBusy

  function pricingInline(
    columnKey: string,
    buildPatch: (n: number) => Record<string, number>
  ): DbFormulaInlineEdit | undefined {
    if (!onInlinePricingCommit || !p || inlineEditBlocked) return undefined
    return {
      reservationId: reservation.id,
      columnKey,
      buildPatch,
      canEdit: true,
      inlineBusyKey: inlineEditBusyKey ?? null,
      onCommit: onInlinePricingCommit,
      editTitle: inlineEditHint,
    }
  }

  return (
    <tr className="group border-b border-gray-100 hover:bg-gray-50/80 align-top text-[10px]">
      {selectionEnabled && (
        <td className="sticky left-0 z-[32] px-0.5 py-1 w-7 border-r border-gray-200 align-middle text-center bg-white shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)] group-hover:bg-gray-50/80">
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
        className={`px-0.5 py-1 max-w-[5.75rem] ${reservationColSticky(0, selectionEnabled, 'tbody')}`}
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
        className={`px-0.5 py-1 max-w-[7.25rem] ${reservationColSticky(1, selectionEnabled, 'tbody')}`}
        title={rsvCol('product_id')}
      >
        <div className="font-medium text-gray-900 leading-tight line-clamp-3">
          {getProductNameForLocale(reservation.productId, products as any || [], locale)}
        </div>
      </td>
      <td
        className={`px-0.5 py-1 whitespace-nowrap text-gray-800 ${reservationColSticky(2, selectionEnabled, 'tbody')}`}
        title={rsvCol('tour_date')}
      >
        <div className="flex items-center gap-0.5">
          <Calendar className="w-3 h-3 text-gray-400 shrink-0" />
          {reservation.tourDate || '—'}
        </div>
      </td>
      <td
        className={`px-0.5 py-1 ${reservationColSticky(3, selectionEnabled, 'tbody')}`}
        title={rsvCol('status')}
      >
        <StatusDropdown
          reservation={reservation}
          {...(onStatusChange ? { onStatusChange } : {})}
        />
        {showPartnerCancelRefundAction ? (
          <div className="mt-1 text-[8px] leading-tight">
            {reservation.amount_audited ? (
              <span
                className="text-emerald-800 font-medium"
                title={
                  reservation.amount_audited_at || reservation.amount_audited_by
                    ? `${reservation.amount_audited_by ?? '—'} · ${reservation.amount_audited_at ? new Date(reservation.amount_audited_at).toLocaleString(paymentLocale) : '—'}`
                    : undefined
                }
              >
                {t('actionRequired.balanceTable.cols.amountAuditDone')}
              </span>
            ) : (
              <span className="text-rose-700 font-medium">{t('actionRequired.balanceTable.cols.amountAuditPending')}</span>
            )}
          </div>
        ) : null}
      </td>
      <td
        className={`px-0.5 py-1 max-w-[7.75rem] align-top ${reservationColSticky(4, selectionEnabled, 'tbody')}`}
        title={dbTitle(
          rsvCol('channel_id'),
          [rsvCol('channel_rn'), rsvCol('variant_key'), formatChannelDashVariant(reservation.channelId, channels || [], reservation)].join('\n')
        )}
      >
        <div className="flex items-start gap-1 min-w-0">
          <ReservationChannelFavicon
            channelId={reservation.channelId}
            channels={channels}
            sizeClass="h-3 w-3"
            className="mt-0.5"
          />
          <div className="min-w-0">
            <div className="text-[10px] text-gray-800 leading-tight break-words">
              {formatChannelDashVariant(reservation.channelId, channels || [], reservation)}
            </div>
            <div className="text-[9px] text-gray-400 mt-0.5">RN: {reservation.channelRN ?? '—'}</div>
          </div>
        </div>
      </td>

      <td
        className="px-0.5 py-1 text-right tabular-nums border-r border-gray-100 bg-blue-50/25"
        title={dbTitle(
          rpCol('product_price_total'),
          productSumDisplay.correctedFromDb
            ? t('actionRequired.balanceTable.cols.flowProductSumHint')
            : undefined
        )}
      >
        <DbFormulaMoneyCell
          dbVal={rawProductStored}
          computedVal={effectiveProduct}
          inlineEdit={pricingInline('product_price_total', (n) => ({ product_price_total: n }))}
        />
      </td>
      <td className="px-0.5 py-1 text-right tabular-nums border-r border-gray-100" title={t('actionRequired.balanceTable.cols.flowAfterDiscountHint')}>
        <DbFormulaMoneyCell dbVal={dbAfterDiscountProduct} computedVal={computedAfterDiscountProduct} />
      </td>
      <td
        className="px-0.5 py-1 text-right tabular-nums border-r border-gray-100 bg-gray-50/50"
        title={dbTitle(
          rpCol('not_included_price'),
          p != null && p.not_included_price != null && Math.abs(pricingFieldToNumber(p.not_included_price)) >= 0.005
            ? `${fmtUsd(pricingFieldToNumber(p.not_included_price))} × ${totalBillingPax(reservation)}`
            : undefined
        )}
      >
        <DbFormulaMoneyCell
          dbVal={notInclTotal}
          computedVal={notInclTotal}
          inlineEdit={pricingInline('not_included_price', (n) => ({
            not_included_price: round2(n / Math.max(1, totalBillingPax(reservation))),
          }))}
        />
      </td>
      <td className="px-0.5 py-1 text-right tabular-nums text-green-900 border-r border-gray-100" title={rpCol('coupon_discount')}>
        <DbFormulaMoneyCell
          dbVal={couponN}
          computedVal={couponN}
          format="coupon"
          inlineEdit={pricingInline('coupon_discount', (n) => ({ coupon_discount: n }))}
        />
      </td>
      <td className="px-0.5 py-1 text-right tabular-nums border-r border-gray-100" title={rpCol('additional_discount')}>
        <DbFormulaMoneyCell
          dbVal={addDiscN}
          computedVal={addDiscN}
          inlineEdit={pricingInline('additional_discount', (n) => ({ additional_discount: n }))}
        />
      </td>
      <td className="px-0.5 py-1 text-right tabular-nums border-r border-gray-100" title={rpCol('additional_cost')}>
        <DbFormulaMoneyCell
          dbVal={pricingFieldToNumber(p?.additional_cost)}
          computedVal={pricingFieldToNumber(p?.additional_cost)}
          inlineEdit={pricingInline('additional_cost', (n) => ({ additional_cost: n }))}
        />
      </td>
      <td className="px-0.5 py-1 text-right tabular-nums border-r border-gray-100" title={rpCol('tax')}>
        <DbFormulaMoneyCell
          dbVal={pricingFieldToNumber(p?.tax)}
          computedVal={pricingFieldToNumber(p?.tax)}
          inlineEdit={pricingInline('tax', (n) => ({ tax: n }))}
        />
      </td>
      <td className="px-0.5 py-1 text-right tabular-nums border-r border-gray-100" title={rpCol('card_fee')}>
        <DbFormulaMoneyCell
          dbVal={pricingFieldToNumber(p?.card_fee)}
          computedVal={pricingFieldToNumber(p?.card_fee)}
          inlineEdit={pricingInline('card_fee', (n) => ({ card_fee: n }))}
        />
      </td>
      <td className="px-0.5 py-1 text-right tabular-nums border-r border-gray-100" title={rpCol('prepayment_cost')}>
        <DbFormulaMoneyCell
          dbVal={pricingFieldToNumber(p?.prepayment_cost)}
          computedVal={pricingFieldToNumber(p?.prepayment_cost)}
          inlineEdit={pricingInline('prepayment_cost', (n) => ({ prepayment_cost: n }))}
        />
      </td>
      <td className="px-0.5 py-1 text-right tabular-nums border-r border-gray-100" title={rpCol('prepayment_tip')}>
        <DbFormulaMoneyCell
          dbVal={pricingFieldToNumber(p?.prepayment_tip)}
          computedVal={pricingFieldToNumber(p?.prepayment_tip)}
          inlineEdit={pricingInline('prepayment_tip', (n) => ({ prepayment_tip: n }))}
        />
      </td>
      <td className="px-0.5 py-1 text-right tabular-nums border-r border-gray-100 bg-gray-50/50" title={rpCol('private_tour_additional_cost')}>
        <DbFormulaMoneyCell
          dbVal={pricingFieldToNumber(p?.private_tour_additional_cost)}
          computedVal={pricingFieldToNumber(p?.private_tour_additional_cost)}
          inlineEdit={pricingInline('private_tour_additional_cost', (n) => ({
            private_tour_additional_cost: n,
          }))}
        />
      </td>
      <td className="px-0.5 py-1 text-right tabular-nums border-r border-gray-100" title={rpCol('refund_amount')}>
        <DbFormulaMoneyCell
          dbVal={pricingFieldToNumber(p?.refund_amount)}
          computedVal={pricingFieldToNumber(p?.refund_amount)}
          inlineEdit={pricingInline('refund_amount', (n) => ({ refund_amount: n }))}
        />
      </td>
      <td className="px-0.5 py-1 text-right tabular-nums border-r border-gray-100" title={rpCol('required_option_total')}>
        <DbFormulaMoneyCell
          dbVal={pricingFieldToNumber(p?.required_option_total)}
          computedVal={pricingFieldToNumber(p?.required_option_total)}
          inlineEdit={pricingInline('required_option_total', (n) => ({ required_option_total: n }))}
        />
      </td>
      <td
        className="px-0.5 py-1 text-right tabular-nums border-r border-gray-100"
        title={dbTitle(
          rpCol('option_total'),
          reservationOptionSumByReservationId?.has(rsvKey) &&
            p != null &&
            Math.abs(pricingFieldToNumber(p.option_total) - (reservationOptionSumByReservationId.get(rsvKey) ?? 0)) > 0.01
            ? t('actionRequired.balanceTable.cols.optionLiveFromRowsHint', {
                amount: fmtUsd(reservationOptionSumByReservationId.get(rsvKey)),
              })
            : undefined
        )}
      >
        <DbFormulaMoneyCell
          dbVal={optDbOnly}
          computedVal={optLineMerged}
          inlineEdit={pricingInline('option_total', (n) => ({ option_total: n }))}
        />
      </td>
      <td
        className="px-0.5 py-1 text-right tabular-nums border-r border-gray-200 bg-emerald-50/30"
        title={t('actionRequired.balanceTable.cols.optSumComputed')}
      >
        <DbFormulaMoneyCell dbVal={optSubDb} computedVal={optSubLine} />
      </td>

      <td
        className={`px-0.5 py-1 text-right align-top tabular-nums border-r border-gray-100 ${
          totalMismatch ? 'bg-amber-50/90 ring-1 ring-inset ring-amber-200/80' : ''
        }`}
        title={dbTitle(
          [rpCol('total_price'), t('actionRequired.balanceTable.cols.totalComputedNotDb')].join(' · '),
          totalMismatch ? t('actionRequired.balanceTable.cols.totalMismatchHint') : undefined
        )}
      >
        <div className="flex flex-row flex-wrap items-start justify-end gap-1">
          <RowDbApplyButton
            visible={Boolean(onApplyRowPatch && needsMismatchFormulaBundleRow)}
            busy={applyRowBusyKey === `${reservation.id}:mismatchFormulaBundle`}
            parentBusy={selectionDisabled}
            title={t('actionRequired.balanceTable.rowApplyMismatchFormulaBundleTitle')}
            onClick={() => onApplyRowPatch?.(reservation.id, 'mismatchFormulaBundle')}
          />
          <RowDbApplyButton
            visible={Boolean(onApplyRowPatch && totalMismatch && computedGross != null)}
            busy={applyRowBusyKey === `${reservation.id}:total`}
            parentBusy={selectionDisabled}
            title={t('actionRequired.balanceTable.rowApplyTotalTitle')}
            onClick={() => onApplyRowPatch?.(reservation.id, 'total')}
          />
          <DbFormulaMoneyCell
            dbVal={storedGross}
            computedVal={computedGross}
            inlineEdit={pricingInline('total_price', (n) => ({ total_price: n }))}
          />
        </div>
        {formulaExpression ? (
          <div
            className={`text-[8px] font-normal leading-snug mt-1 text-right break-words max-w-[11rem] ml-auto whitespace-pre-line ${
              isCancelledRsv ? 'text-amber-900' : 'text-red-600'
            }`}
          >
            {formulaExpression}
          </div>
        ) : null}
      </td>
      <td
        className={`px-0.5 py-1 text-right tabular-nums border-r border-gray-100 ${
          depositPrMismatch ? 'bg-amber-50/90 ring-1 ring-inset ring-amber-200/80' : ''
        }`}
        title={dbTitle(
          rpCol('deposit_amount'),
          depositPrMismatch ? t('actionRequired.balanceTable.cols.prMismatchHint') : undefined
        )}
      >
        <DbFormulaMoneyCell
          dbVal={depositDb}
          computedVal={depositComputedCompare}
          inlineEdit={pricingInline('deposit_amount', (n) => ({ deposit_amount: n }))}
        />
      </td>
      <td
        className={`px-0.5 py-1 text-right tabular-nums border-r border-gray-100 bg-slate-50/60 ${
          depositPrMismatch ? 'ring-1 ring-inset ring-amber-200/80' : ''
        }`}
        title={dbTitle(
          t('actionRequired.balanceTable.cols.paymentRecordsAgg'),
          depositPrMismatch ? t('actionRequired.balanceTable.cols.prMismatchHint') : undefined
        )}
      >
        <div className="flex flex-row items-start justify-end gap-1">
          <RowDbApplyButton
            visible={Boolean(onApplyRowPatch && depositPrMismatch && fromPayments.hasRecords)}
            busy={applyRowBusyKey === `${reservation.id}:deposit`}
            parentBusy={selectionDisabled}
            title={t('actionRequired.balanceTable.rowApplyDepositTitle')}
            onClick={() => onApplyRowPatch?.(reservation.id, 'deposit')}
          />
          <DbFormulaMoneyCell
            dbVal={fromPayments.hasRecords ? fromPayments.depositBucketGross : null}
            computedVal={fromPayments.hasRecords ? fromPayments.depositBucketGross : null}
          />
        </div>
      </td>
      <td
        className={`px-0.5 py-1 text-right align-top tabular-nums border-r border-gray-100 bg-rose-50/20 ${
          isCancelledRsv && paymentLedgerRefundTotalUsd < 0.01 && refundAmountDb < 0.01
            ? 'ring-1 ring-inset ring-rose-200/90'
            : ''
        }`}
        title={t('actionRequired.balanceTable.cols.customerRefundColHint')}
      >
        <div
          className={
            isCancelledRsv && paymentLedgerRefundTotalUsd < 0.01 && refundAmountDb < 0.01
              ? '[&_.tabular-nums]:text-red-600 [&_.text-gray-900]:text-red-600 [&_.text-gray-800]:text-red-600'
              : ''
          }
        >
          <DbFormulaMoneyCell
            dbVal={refundAmountDb}
            computedVal={customerRefundComputedVal}
            stackComputedFirst={stackPaymentRefundLine}
            inlineEdit={pricingInline('refund_amount', (n) => ({ refund_amount: n }))}
          />
        </div>
        {showPartnerCancelRefundAction && isCancelledRsv ? (
          <button
            type="button"
            disabled={partnerRefundBusy}
            title={t('actionRequired.partnerCancelRefundTitle', {
              amount: fmtUsd(suggestedPartnerRefundUsd) ?? '$0.00',
            })}
            onClick={() => void handlePartnerCancelRefundClick()}
            className="mt-1 inline-flex items-center justify-end w-full px-1 py-0.5 rounded border border-rose-300 bg-rose-50 text-rose-900 hover:bg-rose-100 text-[9px] font-semibold leading-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('actionRequired.partnerCancelRefundLabel')}
          </button>
        ) : null}
      </td>
      <td
        className={`px-0.5 py-1 text-right tabular-nums font-medium border-r border-gray-100 bg-amber-50/40 ${
          balancePrMismatch ? 'ring-1 ring-inset ring-amber-200/80' : ''
        }`}
        title={dbTitle(
          rpCol('balance_amount'),
          balancePrMismatch ? t('actionRequired.balanceTable.cols.prMismatchHint') : undefined
        )}
      >
        <div className="flex flex-row items-start justify-end gap-1">
          <RowDbApplyButton
            visible={Boolean(onApplyRowPatch && balancePrMismatch && p)}
            busy={applyRowBusyKey === `${reservation.id}:balance`}
            parentBusy={selectionDisabled}
            title={t('actionRequired.balanceTable.rowApplyBalanceTitle')}
            onClick={() => onApplyRowPatch?.(reservation.id, 'balance')}
          />
          <DbFormulaMoneyCell
            dbVal={balanceDb}
            computedVal={balanceComputedOutstanding}
            inlineEdit={pricingInline('balance_amount', (n) => ({ balance_amount: n }))}
          />
        </div>
      </td>
      <td
        className={`px-0.5 py-1 text-right tabular-nums font-medium border-r border-gray-100 bg-amber-50/40 ${
          highlightReceivedVsBalanceComputed
            ? 'ring-2 ring-inset ring-rose-400/90 bg-rose-50/50'
            : balancePrMismatch
              ? 'ring-1 ring-inset ring-amber-200/80'
              : ''
        }`}
        title={dbTitle(
          t('actionRequired.balanceTable.cols.balanceReceivedRecordsHint'),
          t('actionRequired.balanceTable.cols.balanceReceivedVsOutstandingHint')
        )}
      >
        <DbFormulaMoneyCell
          dbVal={fromPayments.hasRecords ? fromPayments.balanceReceivedTotal : null}
          computedVal={fromPayments.hasRecords ? fromPayments.balanceReceivedTotal : null}
        />
      </td>

      <td
        className={`px-0.5 py-1 text-right tabular-nums text-[10px] border-r border-gray-100 ${
          channelPaymentMismatch ? 'ring-1 ring-inset ring-amber-200/80' : ''
        }`}
        title={dbTitle(
          rpCol('commission_base_price'),
          t('actionRequired.balanceTable.cols.channelOtaBaseFormulaHint')
        )}
      >
        <div className="flex flex-row items-start justify-end gap-1">
          <RowDbApplyButton
            visible={Boolean(
              onApplyRowPatch && channelPaymentMismatch && channelPaymentFormula != null && p
            )}
            busy={applyRowBusyKey === `${reservation.id}:channelPayment`}
            parentBusy={selectionDisabled}
            title={t('actionRequired.balanceTable.rowApplyChannelPaymentTitle')}
            onClick={() => onApplyRowPatch?.(reservation.id, 'channelPayment')}
          />
          <DbFormulaMoneyCell
            dbVal={channelMetrics?.channelPaymentDb ?? null}
            computedVal={channelMetrics != null ? channelMetrics.channelPaymentFromFormula : null}
            inlineEdit={pricingInline('commission_base_price', (n) => ({ commission_base_price: n }))}
          />
        </div>
      </td>
      <td
        className="px-0.5 py-1 text-right tabular-nums border-r border-gray-100"
        title={dbTitle(
          rpCol('commission_percent'),
          t('actionRequired.balanceTable.cols.commPctFormulaHint')
        )}
      >
        <DbFormulaMoneyCell
          format="percent"
          dbVal={channelMetrics?.commissionPercentDb ?? null}
          computedVal={channelMetrics?.commissionPercentFromChannel ?? null}
          inlineEdit={pricingInline('commission_percent', (n) => ({ commission_percent: n }))}
        />
      </td>
      <td
        className="px-0.5 py-1 text-right tabular-nums border-r border-gray-100"
        title={dbTitle(
          rpCol('commission_amount'),
          t('actionRequired.balanceTable.cols.commAmtFormulaHint')
        )}
      >
        <DbFormulaMoneyCell
          dbVal={channelMetrics?.commissionAmountDb ?? null}
          computedVal={channelMetrics != null ? channelMetrics.commissionAmountFromFormula : null}
          inlineEdit={pricingInline('commission_amount', (n) => ({ commission_amount: n }))}
        />
      </td>
      <td
        className={`px-0.5 py-1 text-right tabular-nums font-medium border-r border-gray-100 bg-violet-50/25 ${
          channelSettlementMismatch ? 'ring-1 ring-inset ring-amber-200/80' : ''
        }`}
        title={dbTitle(
          rpCol('channel_settlement_amount'),
          t('actionRequired.balanceTable.cols.channelSettlementFormulaHint')
        )}
      >
        <div className="flex flex-row items-start justify-end gap-1">
          <RowDbApplyButton
            visible={Boolean(
              onApplyRowPatch && channelSettlementMismatch && channelSettlementFormula != null && p
            )}
            busy={applyRowBusyKey === `${reservation.id}:channelSettlement`}
            parentBusy={selectionDisabled}
            title={t('actionRequired.balanceTable.rowApplyChannelSettlementTitle')}
            onClick={() => onApplyRowPatch?.(reservation.id, 'channelSettlement')}
          />
          <DbFormulaMoneyCell
            dbVal={dbChannelSettlement}
            computedVal={channelSettlementFormula}
            inlineEdit={pricingInline('channel_settlement_amount', (n) => ({
              channel_settlement_amount: n,
            }))}
          />
        </div>
        {showPartnerCancelRefundAction && isCancelledRsv && onApplyRowPatch && p ? (
          <button
            type="button"
            disabled={selectionDisabled || applyRowBusyKey === `${reservation.id}:channelFinancialZeros`}
            title={t('actionRequired.balanceTable.rowApplyChannelFinancialZerosTitle')}
            onClick={() => void onApplyRowPatch(reservation.id, 'channelFinancialZeros')}
            className="mt-1 inline-flex w-full items-center justify-center px-1 py-0.5 rounded border border-rose-300 bg-rose-50 text-rose-900 hover:bg-rose-100 text-[9px] font-semibold leading-tight disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('actionRequired.balanceTable.rowApplyChannelFinancialZerosLabel')}
          </button>
        ) : null}
      </td>
      <td
        className="px-0.5 py-1 text-right tabular-nums border-r border-gray-100 bg-emerald-50/20"
        title={t('actionRequired.balanceTable.cols.companyTotalRevenueHint')}
      >
        <DbFormulaMoneyCell
          dbVal={null}
          computedVal={channelMetrics?.companyTotalRevenue ?? null}
        />
      </td>
      <td
        className="px-0.5 py-1 text-right tabular-nums border-r border-gray-200 bg-teal-50/25"
        title={t('actionRequired.balanceTable.cols.operatingProfitHint')}
      >
        <DbFormulaMoneyCell
          dbVal={null}
          computedVal={channelMetrics?.operatingProfit ?? null}
        />
      </td>

      <td className="px-0.5 py-1 bg-white">
        {actionsColumnEditOnly ? (
          <div className="flex flex-wrap gap-0.5 justify-end items-center">
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
                  {showResidentInquiryEmail && (
                    <button
                      type="button"
                      className="w-full text-left px-2 py-1 text-[10px] hover:bg-gray-50 flex items-center gap-1.5"
                      onClick={() => onEmailPreview(reservation, 'resident_inquiry')}
                    >
                      <UserRound className="w-3 h-3 shrink-0" />
                      {t('card.emailResidentInquiry')}
                    </button>
                  )}
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
    channels,
    actionsColumnEditOnly = false,
    enablePricingDbApply = true,
    enableMismatchFormulaBundleApply = false,
    showPartnerCancelRefundAction = false,
    onRefreshPaymentAggregates,
    tourDateSortActive,
    tourDateSortDir,
    onTourDateSortClick,
    ...rest
  } = props
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [applySyncing, setApplySyncing] = useState(false)
  const [applyRowBusyKey, setApplyRowBusyKey] = useState<string | null>(null)
  const [inlineEditBusyKey, setInlineEditBusyKey] = useState<string | null>(null)
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

  type ApplyMode =
    | 'total'
    | 'deposit'
    | 'balance'
    | 'all'
    | 'mismatchFormulaBundle'
    | 'channelFinancialZeros'

  const applySingleRow = useCallback(
    async (
      reservationId: string,
      mode:
        | 'total'
        | 'deposit'
        | 'balance'
        | 'channelPayment'
        | 'channelSettlement'
        | 'mismatchFormulaBundle'
        | 'channelFinancialZeros'
    ) => {
      if (!onRefreshReservations && !onRefreshReservationPricing) return
      const r = reservationLookup.get(reservationId)
      const p = reservationPricingMap.get(reservationId)
      if (!r || !p) return
      const key = `${reservationId}:${mode}`
      setApplyRowBusyKey(key)
      try {
        const records =
          paymentRecordsByReservationId?.get(normalizeReservationIdForPayments(reservationId)) ??
          paymentRecordsByReservationId?.get(reservationId) ??
          []
        const patch = buildReservationPricingPatch(
          r,
          p,
          reservationOptionSumByReservationId,
          records,
          mode as PricingApplyMode,
          channels
        )
        if (!patch) return
        const { error } = await supabase.from('reservation_pricing').update(patch).eq('reservation_id', r.id)
        if (error) {
          console.error('apply row patch', mode, reservationId, error)
          return
        }
        if (mode === 'channelFinancialZeros') {
          const sync = await syncReservationPricingAggregates(supabase, reservationId)
          if (!sync.ok && sync.error) {
            console.warn('[action-required] sync after channel zeros', reservationId, sync.error)
          }
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
      channels,
    ]
  )

  const commitInlinePricing = useCallback(
    async (reservationId: string, patch: Record<string, number>, columnKey: string) => {
      if (!onRefreshReservations && !onRefreshReservationPricing) return
      const r = reservationLookup.get(reservationId)
      if (!r || Object.keys(patch).length === 0) return
      const key = `${reservationId}:inline:${columnKey}`
      setInlineEditBusyKey(key)
      try {
        const { error } = await supabase
          .from('reservation_pricing')
          .update(patch)
          .eq('reservation_id', r.id)
        if (error) {
          console.error('inline reservation_pricing', columnKey, reservationId, error)
          return
        }
        if (onRefreshReservationPricing) {
          await onRefreshReservationPricing([reservationId])
        } else {
          onRefreshReservations?.()
        }
      } finally {
        setInlineEditBusyKey(null)
      }
    },
    [onRefreshReservations, onRefreshReservationPricing, reservationLookup]
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
          const records =
            paymentRecordsByReservationId?.get(normalizeReservationIdForPayments(id)) ??
            paymentRecordsByReservationId?.get(id) ??
            []
          const patchMode: PricingApplyMode =
            mode === 'all'
              ? 'all'
              : mode === 'mismatchFormulaBundle'
                ? 'mismatchFormulaBundle'
                : mode === 'channelFinancialZeros'
                  ? 'channelFinancialZeros'
                  : mode
          const patch = buildReservationPricingPatch(
            r,
            p,
            reservationOptionSumByReservationId,
            records,
            patchMode,
            channels
          )
          if (!patch) continue

          const { error } = await supabase.from('reservation_pricing').update(patch).eq('reservation_id', r.id)
          if (error) {
            console.error('apply pricing patch', mode, r.id, error)
            continue
          }
          if (mode === 'channelFinancialZeros') {
            const sync = await syncReservationPricingAggregates(supabase, r.id)
            if (!sync.ok && sync.error) {
              console.warn('[action-required] sync after channel zeros', r.id, sync.error)
            }
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
      channels,
    ]
  )

  const s = (k: string) => t(`actionRequired.balanceTable.cols.${k}` as Parameters<typeof t>[0])
  const sec = (k: string) => t(`actionRequired.balanceTable.sections.${k}` as Parameters<typeof t>[0])

  /** 일괄 반영 행 colspan = 1행(섹션) 열 수와 동일 — 가로 스크롤·freeze와 정렬 */
  const totalTableColSpan = useMemo(() => {
    const sel = selectionEnabled ? 1 : 0
    return sel + 5 + PRICING_FLOW_COLUMN_COUNT + PAYMENT_COLUMN_COUNT + CHANNEL_COLUMN_COUNT + 1
  }, [selectionEnabled])

  const tableMinWClass = selectionEnabled ? 'min-w-[2830px]' : 'min-w-[2770px]'

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
                    {enableMismatchFormulaBundleApply ? (
                      <button
                        type="button"
                        title={t('actionRequired.balanceTable.applyMismatchFormulaBundleTitle')}
                        disabled={applySyncing || selectedIds.size === 0}
                        onClick={() => runApplySelected('mismatchFormulaBundle')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border border-indigo-400 bg-indigo-50 text-indigo-950 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {applySyncing
                          ? t('actionRequired.balanceTable.applySelectedRunning')
                          : t('actionRequired.balanceTable.applyMismatchFormulaBundle')}
                        {!applySyncing && selectedIds.size > 0 ? ` (${selectedIds.size})` : null}
                      </button>
                    ) : null}
                    {showPartnerCancelRefundAction ? (
                      <button
                        type="button"
                        title={t('actionRequired.balanceTable.applyChannelFinancialZerosTitle')}
                        disabled={applySyncing || selectedIds.size === 0}
                        onClick={() => runApplySelected('channelFinancialZeros')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border border-rose-400 bg-rose-50 text-rose-950 hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {applySyncing
                          ? t('actionRequired.balanceTable.applySelectedRunning')
                          : t('actionRequired.balanceTable.applyChannelFinancialZeros')}
                        {!applySyncing && selectedIds.size > 0 ? ` (${selectedIds.size})` : null}
                      </button>
                    ) : null}
                  </div>
                </div>
              </th>
            </tr>
          )}
          <tr className="border-b border-gray-200 bg-white">
            <th
              colSpan={totalTableColSpan}
              className="px-3 py-2.5 text-left text-[11px] font-normal leading-snug text-gray-800"
            >
              <span className="font-semibold text-slate-900">{t('actionRequired.balanceTable.formulaExplainerTitle')}</span>
              <span className="mx-1.5 text-gray-300">·</span>
              <span className="text-gray-700">{t('actionRequired.balanceTable.formulaExplainerBody')}</span>
              {(onRefreshReservationPricing || onRefreshReservations) && (
                <>
                  <span className="mx-1.5 text-gray-300">·</span>
                  <span className="text-sky-900/90">{t('actionRequired.balanceTable.inlineEditDbHint')}</span>
                </>
              )}
            </th>
          </tr>
          <tr className="bg-slate-100 border-b border-gray-200 text-[10px] font-semibold text-slate-700">
            {selectionEnabled && (
              <th
                rowSpan={2}
                className="sticky left-0 z-[35] px-0.5 py-1 w-7 text-center border-r border-gray-200 align-middle bg-slate-100 shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]"
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
              className={`px-0.5 py-1 text-center border-r border-gray-200 shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)] bg-slate-100 ${
                selectionEnabled ? 'sticky left-7 z-[34]' : 'sticky left-0 z-[34]'
              }`}
            >
              {sec('reservation')}
            </th>
            <th
              colSpan={PRICING_FLOW_COLUMN_COUNT}
              className="px-0.5 py-1 text-center border-r border-gray-200 bg-blue-50/80"
            >
              {sec('pricingFlow')}
            </th>
            <th colSpan={PAYMENT_COLUMN_COUNT} className="px-0.5 py-1 text-center border-r border-gray-200 bg-sky-50/70">
              {sec('customerPayment')}
            </th>
            <th
              colSpan={CHANNEL_COLUMN_COUNT}
              className="px-0.5 py-1 text-center border-r border-gray-200 bg-violet-50/50"
              title={t('actionRequired.balanceTable.channelSectionHint')}
            >
              {sec('channel')}
            </th>
            <th rowSpan={2} className="px-0.5 py-1 text-center align-bottom bg-slate-100 min-w-[2.25rem] border-l border-gray-200">
              {sec('actions')}
            </th>
          </tr>
          <tr className="bg-gray-50 border-b border-gray-200 text-[8px] font-medium text-gray-600 uppercase tracking-wide">
            <th
              className={`px-0.5 py-0.5 ${reservationColSticky(0, selectionEnabled, 'theadSub')}`}
              title={rsvCol('customer_id')}
            >
              {s('customer')}
            </th>
            <th
              className={`px-0.5 py-0.5 ${reservationColSticky(1, selectionEnabled, 'theadSub')}`}
              title={rsvCol('product_id')}
            >
              {s('product')}
            </th>
            <th
              className={`px-0.5 py-0.5 whitespace-nowrap ${reservationColSticky(2, selectionEnabled, 'theadSub')}`}
              title={rsvCol('tour_date')}
            >
              {onTourDateSortClick ? (
                <TableSortHeaderButton
                  label={s('tourDate')}
                  active={tourDateSortActive === true}
                  dir={tourDateSortDir ?? 'asc'}
                  onClick={onTourDateSortClick}
                  className="text-[8px] font-medium uppercase tracking-wide text-gray-600"
                />
              ) : (
                s('tourDate')
              )}
            </th>
            <th
              className={`px-0.5 py-0.5 ${reservationColSticky(3, selectionEnabled, 'theadSub')}`}
              title={rsvCol('status')}
            >
              {s('status')}
            </th>
            <th
              className={`px-0.5 py-0.5 text-left max-w-[6.25rem] ${reservationColSticky(4, selectionEnabled, 'theadSub')}`}
              title={[rsvCol('channel_id'), rsvCol('channel_rn'), rsvCol('variant_key')].join('\n')}
            >
              {s('channelVariant')}
            </th>

            <th
              className="px-0.5 py-0.5 border-r border-gray-100 text-right bg-blue-50/40"
              title={dbTitle(rpCol('product_price_total'), t('actionRequired.balanceTable.cols.flowOtaProductSumHint'))}
            >
              {s('flowOtaProductSum')}
            </th>
            <th className="px-0.5 py-0.5 border-r border-gray-100 text-right" title={t('actionRequired.balanceTable.cols.flowAfterDiscountHint')}>
              {s('flowAfterDiscount')}
            </th>
            <th className="px-0.5 py-0.5 border-r border-gray-100 text-right bg-gray-50/50" title={rpCol('not_included_price')}>
              {s('notIncluded')}
            </th>
            <th className="px-0.5 py-0.5 border-r border-gray-100 text-right" title={rpCol('coupon_discount')}>
              {s('coupon')}
            </th>
            <th className="px-0.5 py-0.5 border-r border-gray-100 text-right" title={rpCol('additional_discount')}>
              {s('addDiscount')}
            </th>
            <th className="px-0.5 py-0.5 border-r border-gray-100 text-right" title={rpCol('additional_cost')}>
              {s('addCost')}
            </th>
            <th className="px-0.5 py-0.5 border-r border-gray-100 text-right" title={rpCol('tax')}>
              {s('tax')}
            </th>
            <th className="px-0.5 py-0.5 border-r border-gray-100 text-right" title={rpCol('card_fee')}>
              {s('cardFee')}
            </th>
            <th className="px-0.5 py-0.5 border-r border-gray-100 text-right" title={rpCol('prepayment_cost')}>
              {s('prepayCost')}
            </th>
            <th className="px-0.5 py-0.5 border-r border-gray-100 text-right" title={rpCol('prepayment_tip')}>
              {s('prepayTip')}
            </th>
            <th className="px-0.5 py-0.5 border-r border-gray-100 text-right bg-gray-50/50" title={rpCol('private_tour_additional_cost')}>
              {s('privateTour')}
            </th>
            <th className="px-0.5 py-0.5 border-r border-gray-100 text-right" title={rpCol('refund_amount')}>
              {s('refundDeduction')}
            </th>
            <th className="px-0.5 py-0.5 border-r border-gray-100 text-right" title={rpCol('required_option_total')}>
              {s('requiredOpt')}
            </th>
            <th className="px-0.5 py-0.5 border-r border-gray-100 text-right" title={rpCol('option_total')}>
              {s('option')}
            </th>
            <th
              className="px-0.5 py-0.5 border-r border-gray-200 text-right bg-emerald-50/50"
              title={t('actionRequired.balanceTable.cols.optSumComputed')}
            >
              {s('optSum')}
            </th>

            <th
              className="px-0.5 py-0.5 border-r border-gray-100 text-right"
              title={dbTitle(
                [rpCol('total_price'), t('actionRequired.balanceTable.cols.totalComputedNotDb')].join(' · '),
                t('actionRequired.balanceTable.cols.totalStackHeaderHint')
              )}
            >
              {s('total')}
            </th>
            <th className="px-0.5 py-0.5 border-r border-gray-100 text-right" title={rpCol('deposit_amount')}>
              {s('depositDb')}
            </th>
            <th className="px-0.5 py-0.5 border-r border-gray-100 text-right bg-slate-50/80" title={t('actionRequired.balanceTable.cols.paymentRecordsAgg')}>
              {s('depositFromRecords')}
            </th>
            <th
              className="px-0.5 py-0.5 border-r border-gray-100 text-right bg-rose-50/30"
              title={t('actionRequired.balanceTable.cols.customerRefundColHint')}
            >
              {s('customerRefundCol')}
            </th>
            <th className="px-0.5 py-0.5 border-r border-gray-100 text-right" title={rpCol('balance_amount')}>
              {s('balanceDb')}
            </th>
            <th
              className="px-0.5 py-0.5 border-r border-gray-100 text-right bg-amber-50/40"
              title={t('actionRequired.balanceTable.cols.balanceReceivedVsOutstandingHint')}
            >
              {s('balanceReceivedRecords')}
            </th>

            <th
              className="px-0.5 py-0.5 border-r border-gray-100 text-right"
              title={dbTitle(
                rpCol('commission_base_price'),
                t('actionRequired.balanceTable.cols.channelOtaBaseFormulaHint')
              )}
            >
              {s('channelOtaBase')}
            </th>
            <th
              className="px-0.5 py-0.5 border-r border-gray-100 text-right"
              title={dbTitle(
                rpCol('commission_percent'),
                t('actionRequired.balanceTable.cols.commPctFormulaHint')
              )}
            >
              {s('commPct')}
            </th>
            <th
              className="px-0.5 py-0.5 border-r border-gray-100 text-right"
              title={dbTitle(
                rpCol('commission_amount'),
                t('actionRequired.balanceTable.cols.commAmtFormulaHint')
              )}
            >
              {s('commAmt')}
            </th>
            <th
              className="px-0.5 py-0.5 border-r border-gray-100 text-right bg-violet-50/30"
              title={dbTitle(
                rpCol('channel_settlement_amount'),
                t('actionRequired.balanceTable.cols.channelSettlementFormulaHint')
              )}
            >
              {s('settlement')}
            </th>
            <th
              className="px-0.5 py-0.5 border-r border-gray-100 text-right bg-emerald-50/30"
              title={t('actionRequired.balanceTable.cols.companyTotalRevenueHint')}
            >
              {s('companyTotalRevenue')}
            </th>
            <th
              className="px-0.5 py-0.5 border-r border-gray-200 text-right bg-teal-50/30"
              title={t('actionRequired.balanceTable.cols.operatingProfitHint')}
            >
              {s('operatingProfit')}
            </th>
          </tr>
        </thead>
        <tbody>
          {reservations.map((reservation) => (
            <BalanceRow
              key={reservation.id}
              {...({
                ...rest,
                actionsColumnEditOnly,
                showPartnerCancelRefundAction,
                onRefreshPaymentAggregates,
                reservationPricingMap,
                reservationOptionSumByReservationId,
                reservation,
                paymentRecords:
                  paymentRecordsByReservationId?.get(normalizeReservationIdForPayments(reservation.id)) ??
                  paymentRecordsByReservationId?.get(String(reservation.id)) ??
                  [],
                selectionEnabled,
                rowChecked: selectedIds.has(reservation.id),
                onRowCheckChange,
                selectionDisabled: applySyncing,
                ...(selectionEnabled ? { onApplyRowPatch: applySingleRow } : {}),
                applyRowBusyKey,
                enableMismatchFormulaBundleApply,
                ...(onRefreshReservationPricing || onRefreshReservations
                  ? {
                      onInlinePricingCommit: commitInlinePricing,
                      inlineEditBusyKey,
                    }
                  : {}),
              } as BalanceRowProps)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
