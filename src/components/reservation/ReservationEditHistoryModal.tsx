'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Clock, History, User, X } from 'lucide-react'
import { useLocale } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { choiceOptionIdsForSupabaseIn } from '@/utils/usResidentChoiceSync'
import { useReservationFormChildOverlayZIndex } from '@/components/reservation/ReservationFormModalStackContext'
import { displayNamesFromCanyonKey } from '@/lib/canyonChoice'

type EditHistoryLog = {
  id: string
  action: string
  changed_fields: string[] | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  created_at: string
  user_email: string | null
  table_name?: string | null
  record_id?: string | null
}

type AuditLookups = {
  pickupHotelsById: Record<string, { hotel?: string | null; pick_up_location?: string | null }>
  choiceNameById: Record<string, string>
  optionNameById: Record<string, string>
}

type PaymentRecordLite = {
  id: string
  amount: number | null
  payment_method: string | null
  payment_status: string | null
  note: string | null
  submit_by: string | null
  created_at: string | null
  updated_at: string | null
}

type PricingRowLite = {
  id: string
  adult_product_price: number | null
  child_product_price: number | null
  infant_product_price: number | null
  pricing_adults: number | null
  not_included_price: number | null
  product_price_total: number | null
  choices_total: number | null
  required_option_total: number | null
  option_total: number | null
  subtotal: number | null
  coupon_code: string | null
  coupon_discount: number | null
  additional_discount: number | null
  additional_cost: number | null
  card_fee: number | null
  tax: number | null
  prepayment_cost: number | null
  prepayment_tip: number | null
  private_tour_additional_cost: number | null
  refund_amount: number | null
  total_price: number | null
  deposit_amount: number | null
  balance_amount: number | null
  commission_percent: number | null
  commission_amount: number | null
  channel_settlement_amount: number | null
  company_total_revenue: number | null
  operating_profit: number | null
  created_at: string | null
  updated_at: string | null
}

type DetailRow = {
  key: string
  label: string
  oldText?: string
  newText: string
  isDiff: boolean
}

type DisplayHistoryItem = {
  id: string
  created_at: string
  authorEmail: string | null
  summary: string
  accent: 'default' | 'create' | 'tour' | 'payment' | 'pricing'
  detailRows: DetailRow[]
  extraRows: DetailRow[]
}

const MERGE_WINDOW_MS = 2 * 60 * 1000
const SAME_WRITE_SLACK_MS = 3 * 1000
const INSERT_PREVIEW_LIMIT = 6

const NOISE_FIELDS = new Set([
  'updated_at',
  'created_at',
  'operator_id',
  'variant_key',
  'archive',
  'added_by',
  'inventory_hold_ids',
  'commerce_offer_id',
  'commerce_pricing_source',
  'commerce_rate_plan_id',
  'date_change_live_reservation_id',
  'date_change_placeholder_reservation_id',
  'pickup_notification_sent',
  'photos_extended_access',
  'id',
])

const INSERT_PREVIEW_ORDER = [
  'status',
  'canyon_choice',
  'adults',
  'child',
  'infant',
  'total_people',
  'tour_date',
  'pickup_hotel',
  'channel_id',
  'product_id',
  'choices',
]

const MONEY_FIELDS = new Set([
  'amount',
  'amount_krw',
  'total_price',
  'deposit_amount',
  'balance_amount',
  'coupon_discount',
  'additional_discount',
  'additional_cost',
  'adult_product_price',
  'child_product_price',
  'infant_product_price',
  'product_price_total',
  'option_total',
  'choices_total',
  'subtotal',
  'card_fee',
  'tax',
  'prepayment_cost',
  'prepayment_tip',
  'private_tour_additional_cost',
  'not_included_price',
  'refund_amount',
  'commission_amount',
  'commission_base_price',
  'channel_settlement_amount',
  'company_total_revenue',
  'operating_profit',
  'required_option_total',
])

const RESERVATION_FIELD_LABELS: Record<string, { ko: string; en: string }> = {
  customer_id: { ko: '고객', en: 'Customer' },
  product_id: { ko: '상품', en: 'Product' },
  tour_date: { ko: '투어 날짜', en: 'Tour date' },
  tour_time: { ko: '투어 시간', en: 'Tour time' },
  event_note: { ko: '이벤트 노트', en: 'Event note' },
  pickup_hotel: { ko: '픽업 호텔', en: 'Pickup hotel' },
  pickup_time: { ko: '픽업 시간', en: 'Pickup time' },
  adults: { ko: '성인 인원', en: 'Adults' },
  child: { ko: '아동 인원', en: 'Child' },
  infant: { ko: '유아 인원', en: 'Infant' },
  total_people: { ko: '총 인원', en: 'Total people' },
  channel_id: { ko: '채널', en: 'Channel' },
  status: { ko: '상태', en: 'Status' },
  selected_options: { ko: '선택 옵션', en: 'Selected options' },
  selected_option_prices: { ko: '옵션 가격', en: 'Option prices' },
  choices: { ko: '초이스', en: 'Choices' },
  canyon_choice: { ko: '캐년 초이스', en: 'Canyon choice' },
  tour_id: { ko: '연결 투어', en: 'Linked tour' },
  is_private_tour: { ko: '프라이빗 투어', en: 'Private tour' },
  added_by: { ko: '등록자', en: 'Added by' },
  updated_at: { ko: '수정 일시', en: 'Updated at' },
  channel_rn: { ko: '채널 RN', en: 'Channel RN' },
}

const PRICING_FIELD_LABELS: Record<string, { ko: string; en: string }> = {
  adult_product_price: { ko: '성인 상품가격', en: 'Adult product price' },
  child_product_price: { ko: '아동 상품가격', en: 'Child product price' },
  infant_product_price: { ko: '유아 상품가격', en: 'Infant product price' },
  pricing_adults: { ko: '가격 성인 인원', en: 'Pricing adults' },
  not_included_price: { ko: '불포함 가격', en: 'Not included' },
  product_price_total: { ko: '상품 가격 합계', en: 'Product price total' },
  choices_total: { ko: '초이스 합계', en: 'Choices total' },
  required_option_total: { ko: '필수 옵션 합계', en: 'Required option total' },
  option_total: { ko: '선택 옵션 합계', en: 'Option total' },
  subtotal: { ko: '소계', en: 'Subtotal' },
  coupon_code: { ko: '쿠폰 코드', en: 'Coupon code' },
  coupon_discount: { ko: '쿠폰 할인', en: 'Coupon discount' },
  additional_discount: { ko: '추가 할인', en: 'Additional discount' },
  additional_cost: { ko: '추가 비용', en: 'Additional cost' },
  card_fee: { ko: '카드 수수료', en: 'Card fee' },
  tax: { ko: '세금', en: 'Tax' },
  prepayment_cost: { ko: '선결제 비용', en: 'Prepayment cost' },
  prepayment_tip: { ko: '선결제 팁', en: 'Prepayment tip' },
  private_tour_additional_cost: { ko: '프라이빗 추가요금', en: 'Private tour extra' },
  refund_amount: { ko: '환불', en: 'Refund' },
  total_price: { ko: '총액', en: 'Total' },
  deposit_amount: { ko: '보증금', en: 'Deposit' },
  balance_amount: { ko: '잔액', en: 'Balance' },
  commission_percent: { ko: '커미션 %', en: 'Commission %' },
  commission_amount: { ko: '커미션', en: 'Commission' },
  channel_settlement_amount: { ko: '채널 정산액', en: 'Channel settlement' },
  company_total_revenue: { ko: '회사 매출', en: 'Company revenue' },
  operating_profit: { ko: '영업이익', en: 'Operating profit' },
}

/** 가격 정보 영역과 같은 순서: 상품가격 → 초이스/옵션 → 할인·추가 → 합계 */
const PRICING_DETAIL_ORDER = [
  'adult_product_price',
  'child_product_price',
  'infant_product_price',
  'pricing_adults',
  'not_included_price',
  'product_price_total',
  'choices_total',
  'required_option_total',
  'option_total',
  'subtotal',
  'coupon_code',
  'coupon_discount',
  'additional_discount',
  'additional_cost',
  'card_fee',
  'tax',
  'prepayment_cost',
  'prepayment_tip',
  'private_tour_additional_cost',
  'refund_amount',
  'total_price',
  'deposit_amount',
  'balance_amount',
  'commission_percent',
  'commission_amount',
  'channel_settlement_amount',
  'company_total_revenue',
  'operating_profit',
]

const PRICING_ALWAYS_SHOW = new Set([
  'adult_product_price',
  'child_product_price',
  'infant_product_price',
  'not_included_price',
  'product_price_total',
  'total_price',
  'deposit_amount',
  'balance_amount',
])

const PAYMENT_FIELD_LABELS: Record<string, { ko: string; en: string }> = {
  amount: { ko: '금액', en: 'Amount' },
  payment_method: { ko: '결제 수단', en: 'Payment method' },
  payment_status: { ko: '입금 상태', en: 'Payment status' },
  note: { ko: '메모', en: 'Note' },
  submit_by: { ko: '등록자', en: 'Submitted by' },
}

const STATUS_LABELS: Record<string, { ko: string; en: string }> = {
  pending: { ko: '대기', en: 'Pending' },
  confirmed: { ko: '확정', en: 'Confirmed' },
  completed: { ko: '완료', en: 'Completed' },
  cancelled: { ko: '취소', en: 'Cancelled' },
  canceled: { ko: '취소', en: 'Cancelled' },
}

function formatEditHistoryDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    let h = d.getHours()
    const min = String(d.getMinutes()).padStart(2, '0')
    const ampm = h < 12 ? 'AM' : 'PM'
    if (h === 0) h = 12
    else if (h > 12) h -= 12
    const hour = String(h).padStart(2, '0')
    return `${y}-${m}-${day} ${hour}:${min} ${ampm}`
  } catch {
    return iso
  }
}

function formatUsd(value: unknown): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return value == null ? '-' : String(value)
  return `$${n.toFixed(2)}`
}

function isSystemActor(email: string | null | undefined): boolean {
  const a = (email || '').trim().toLowerCase()
  return !a || a === 'system' || a === 'unknown' || a === '알 수 없음'
}

function isEmptyId(value: unknown): boolean {
  if (value == null) return true
  const s = String(value).trim()
  return !s || s === '-' || s === 'null' || s === 'undefined'
}

function isNear(a: string | null | undefined, b: string | null | undefined, windowMs = MERGE_WINDOW_MS): boolean {
  if (!a || !b) return false
  const ta = new Date(a).getTime()
  const tb = new Date(b).getTime()
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return false
  return Math.abs(ta - tb) <= windowMs
}

function isLaterWrite(updatedAt: string | null | undefined, createdAt: string | null | undefined): boolean {
  if (!updatedAt || !createdAt) return false
  const tu = new Date(updatedAt).getTime()
  const tc = new Date(createdAt).getTime()
  if (!Number.isFinite(tu) || !Number.isFinite(tc)) return false
  return tu - tc > SAME_WRITE_SLACK_MS
}

function meaningfulFields(fields: string[] | null | undefined): string[] {
  return (Array.isArray(fields) ? fields : []).filter((f) => f && !NOISE_FIELDS.has(f))
}

function fieldLabel(fieldKey: string, isEn: boolean): string {
  const label = RESERVATION_FIELD_LABELS[fieldKey] || PRICING_FIELD_LABELS[fieldKey] || PAYMENT_FIELD_LABELS[fieldKey]
  return label ? (isEn ? label.en : label.ko) : fieldKey
}

function formatAuditValueWithLookups(
  fieldKey: string,
  value: unknown,
  isEn: boolean,
  lookups: AuditLookups
): string {
  if (value === null || value === undefined) return '-'
  if (fieldKey === 'commission_percent') {
    const n = Number(value)
    return Number.isFinite(n) ? `${n.toFixed(2)}%` : String(value)
  }
  if (fieldKey === 'pricing_adults') {
    const n = Number(value)
    return Number.isFinite(n) ? (isEn ? `${n}` : `${n}명`) : String(value)
  }
  if (MONEY_FIELDS.has(fieldKey)) return formatUsd(value)
  if (fieldKey === 'status' && typeof value === 'string') {
    const v = value.toLowerCase()
    return STATUS_LABELS[v] ? (isEn ? STATUS_LABELS[v].en : STATUS_LABELS[v].ko) : value
  }
  if (fieldKey === 'canyon_choice' && typeof value === 'string') {
    const names = displayNamesFromCanyonKey(value)
    if (names) return isEn ? `${names.option_name} (${value})` : `${names.option_name_ko} (${value})`
    return value
  }
  if (fieldKey === 'pickup_hotel' && typeof value === 'string') {
    const hotel = lookups.pickupHotelsById[value]
    if (hotel?.hotel) {
      return hotel.pick_up_location ? `${hotel.hotel} (${hotel.pick_up_location})` : hotel.hotel
    }
    return value
  }
  if (fieldKey === 'choices' && (typeof value === 'object' || typeof value === 'string')) {
    try {
      const raw = typeof value === 'string' ? JSON.parse(value) : value
      const required = raw?.required
      if (!Array.isArray(required) || required.length === 0) {
        return typeof value === 'string' ? value : JSON.stringify(value).slice(0, 60) + '…'
      }
      const parts = required.map((item: { choice_id?: string; option_id?: string; quantity?: number }) => {
        const choiceName = (item.choice_id && lookups.choiceNameById[item.choice_id]) || item.choice_id || '?'
        const optionName =
          item.option_id === '__undecided__'
            ? '미정'
            : (item.option_id && lookups.optionNameById[item.option_id]) || item.option_id || '?'
        const qty = item.quantity ?? 1
        return `${choiceName}: ${optionName} × ${qty}`
      })
      return parts.join(', ')
    } catch {
      return typeof value === 'object' ? JSON.stringify(value).slice(0, 80) + '…' : String(value)
    }
  }
  if (typeof value === 'object') {
    return JSON.stringify(value).slice(0, 80) + (JSON.stringify(value).length > 80 ? '…' : '')
  }
  const s = String(value)
  return s.length > 40 ? s.slice(0, 40) + '…' : s
}

function getEditHistorySummary(action: string, changedFields: string[] | null, isEn: boolean): string {
  if (action === 'INSERT') return isEn ? 'Reservation created' : '예약 생성'
  if (action === 'DELETE') return isEn ? 'Reservation deleted' : '예약 삭제'
  if (action === 'UPDATE') {
    const fields = meaningfulFields(changedFields)
    const labels = fields.map((f) => fieldLabel(f, isEn)).filter(Boolean)
    const list =
      labels.length > 0 ? labels.join(', ') : isEn ? `${fields.length} field(s)` : `${fields.length}개 필드`
    return isEn ? `Reservation updated: ${list}` : `예약 정보 수정: ${list}`
  }
  return isEn ? 'Change recorded' : '변경 기록'
}

function isSystemCanyonChoiceUpdate(log: EditHistoryLog): boolean {
  if (log.action !== 'UPDATE') return false
  const fields = meaningfulFields(log.changed_fields)
  if (fields.length !== 1 || fields[0] !== 'canyon_choice') return false
  return isSystemActor(log.user_email)
}

function isTourIdOnlyUpdate(log: EditHistoryLog): boolean {
  if (log.action !== 'UPDATE') return false
  const fields = meaningfulFields(log.changed_fields)
  return fields.length === 1 && fields[0] === 'tour_id'
}

function tourLinkSummary(
  oldId: unknown,
  newId: unknown,
  tourCreatedAt: string | null | undefined,
  logCreatedAt: string,
  isEn: boolean
): string {
  const oldEmpty = isEmptyId(oldId)
  const newEmpty = isEmptyId(newId)
  if (oldEmpty && !newEmpty) {
    const createdNow = isNear(tourCreatedAt, logCreatedAt)
    if (createdNow) return isEn ? 'Tour created' : '투어 생성됨'
    return isEn ? 'Tour linked' : '투어 연결됨'
  }
  if (!oldEmpty && newEmpty) return isEn ? 'Tour unlinked' : '투어 연결 해제'
  return isEn ? 'Tour changed' : '투어 변경'
}

function hasDisplayValue(value: unknown): boolean {
  if (value === false || value === 0) return true
  if (value == null) return false
  if (value === '') return false
  if (Array.isArray(value) && value.length === 0) return false
  if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length === 0) {
    return false
  }
  return true
}

function orderedInsertKeys(newV: Record<string, unknown>): string[] {
  const keys = Object.keys(newV).filter((k) => !NOISE_FIELDS.has(k) && hasDisplayValue(newV[k]))
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const k of INSERT_PREVIEW_ORDER) {
    if (keys.includes(k) && !seen.has(k)) {
      seen.add(k)
      ordered.push(k)
    }
  }
  for (const k of keys) {
    if (!seen.has(k)) ordered.push(k)
  }
  return ordered
}

function toDetailRow(
  fieldKey: string,
  value: unknown,
  isEn: boolean,
  lookups: AuditLookups,
  oldValue?: unknown,
  isDiff = false
): DetailRow {
  const row: DetailRow = {
    key: fieldKey,
    label: fieldLabel(fieldKey, isEn),
    newText: formatAuditValueWithLookups(fieldKey, value, isEn, lookups),
    isDiff,
  }
  if (isDiff) {
    row.oldText = formatAuditValueWithLookups(fieldKey, oldValue, isEn, lookups)
  }
  return row
}

function shouldShowPricingField(
  fieldKey: string,
  value: unknown,
  oldValue: unknown | undefined,
  isDiff: boolean
): boolean {
  if (PRICING_ALWAYS_SHOW.has(fieldKey)) return true
  if (isDiff) return value !== oldValue
  if (typeof value === 'number') return Number.isFinite(value) && value !== 0
  return hasDisplayValue(value)
}

function pricingDetailRowsFromRecord(
  src: Record<string, unknown>,
  isEn: boolean,
  lookups: AuditLookups,
  oldSrc?: Record<string, unknown>,
  isDiff = false
): DetailRow[] {
  return PRICING_DETAIL_ORDER.filter((k) => shouldShowPricingField(k, src[k], oldSrc?.[k], isDiff)).map((k) =>
    toDetailRow(k, src[k], isEn, lookups, oldSrc?.[k], isDiff)
  )
}

function pricingRowToRecord(pricing: PricingRowLite): Record<string, unknown> {
  return {
    adult_product_price: pricing.adult_product_price,
    child_product_price: pricing.child_product_price,
    infant_product_price: pricing.infant_product_price,
    pricing_adults: pricing.pricing_adults,
    not_included_price: pricing.not_included_price,
    product_price_total: pricing.product_price_total,
    choices_total: pricing.choices_total,
    required_option_total: pricing.required_option_total,
    option_total: pricing.option_total,
    subtotal: pricing.subtotal,
    coupon_code: pricing.coupon_code,
    coupon_discount: pricing.coupon_discount,
    additional_discount: pricing.additional_discount,
    additional_cost: pricing.additional_cost,
    card_fee: pricing.card_fee,
    tax: pricing.tax,
    prepayment_cost: pricing.prepayment_cost,
    prepayment_tip: pricing.prepayment_tip,
    private_tour_additional_cost: pricing.private_tour_additional_cost,
    refund_amount: pricing.refund_amount,
    total_price: pricing.total_price,
    deposit_amount: pricing.deposit_amount,
    balance_amount: pricing.balance_amount,
    commission_percent: pricing.commission_percent,
    commission_amount: pricing.commission_amount,
    channel_settlement_amount: pricing.channel_settlement_amount,
    company_total_revenue: pricing.company_total_revenue,
    operating_profit: pricing.operating_profit,
  }
}

function accentClass(accent: DisplayHistoryItem['accent']): string {
  switch (accent) {
    case 'payment':
      return 'border-l-[3px] border-l-emerald-500'
    case 'pricing':
      return 'border-l-[3px] border-l-amber-500'
    case 'tour':
      return 'border-l-[3px] border-l-sky-500'
    case 'create':
      return 'border-l-[3px] border-l-gray-400'
    default:
      return ''
  }
}

function InsertExtraFieldsTooltip({
  extraRows,
  extraCountLabel,
  zIndex,
}: {
  extraRows: DetailRow[]
  extraCountLabel: string
  zIndex: number
}) {
  const triggerRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const show = () => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const width = 280
    const estimatedHeight = Math.min(256, extraRows.length * 22 + 20)
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8)
    let top = r.bottom + 6
    if (top + estimatedHeight > window.innerHeight - 8) {
      top = Math.max(8, r.top - estimatedHeight - 6)
    }
    setPos({ top, left })
    setOpen(true)
  }

  if (extraRows.length === 0) return null
  return (
    <>
      <span
        ref={triggerRef}
        className="text-gray-400 cursor-help underline decoration-dotted decoration-gray-300 underline-offset-2"
        onMouseEnter={show}
        onMouseLeave={() => setOpen(false)}
      >
        {extraCountLabel}
      </span>
      {open
        ? createPortal(
            <div
              role="tooltip"
              className="fixed max-h-64 w-[280px] overflow-y-auto rounded-lg bg-gray-900 px-3 py-2.5 text-xs text-white shadow-lg leading-snug pointer-events-none"
              style={{ top: pos.top, left: pos.left, zIndex }}
            >
              <div className="space-y-1">
                {extraRows.map((row) => (
                  <div key={row.key} className="flex gap-x-1.5">
                    <span className="shrink-0 text-gray-300">{row.label}:</span>
                    <span className="text-white break-all">{row.newText}</span>
                  </div>
                ))}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}

export interface ReservationEditHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  reservationId: string
}

export default function ReservationEditHistoryModal({
  isOpen,
  onClose,
  reservationId,
}: ReservationEditHistoryModalProps) {
  const locale = useLocale()
  const isEn = locale === 'en'
  const overlayZIndex = useReservationFormChildOverlayZIndex(120)

  const [editHistory, setEditHistory] = useState<EditHistoryLog[]>([])
  const [relatedAudits, setRelatedAudits] = useState<EditHistoryLog[]>([])
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecordLite[]>([])
  const [pricingRows, setPricingRows] = useState<PricingRowLite[]>([])
  const [toursById, setToursById] = useState<Record<string, { created_at: string | null }>>({})
  const [loading, setLoading] = useState(false)
  const [teamNameByEmail, setTeamNameByEmail] = useState<Record<string, string>>({})
  const [pickupHotelsById, setPickupHotelsById] = useState<
    Record<string, { hotel?: string | null; pick_up_location?: string | null }>
  >({})
  const [choiceNameById, setChoiceNameById] = useState<Record<string, string>>({})
  const [optionNameById, setOptionNameById] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isOpen || !reservationId) return
    let cancelled = false
    setLoading(true)

    ;(async () => {
      const [resLogsRes, paymentsRes, pricingRes] = await Promise.all([
        supabase
          .from('audit_logs_view')
          .select('id, action, changed_fields, old_values, new_values, created_at, user_email')
          .eq('table_name', 'reservations')
          .eq('record_id', reservationId)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('payment_records')
          .select('id, amount, payment_method, payment_status, note, submit_by, created_at, updated_at')
          .eq('reservation_id', reservationId)
          .order('created_at', { ascending: false }),
        supabase
          .from('reservation_pricing')
          .select(
            'id, adult_product_price, child_product_price, infant_product_price, pricing_adults, not_included_price, product_price_total, choices_total, required_option_total, option_total, subtotal, coupon_code, coupon_discount, additional_discount, additional_cost, card_fee, tax, prepayment_cost, prepayment_tip, private_tour_additional_cost, refund_amount, total_price, deposit_amount, balance_amount, commission_percent, commission_amount, channel_settlement_amount, company_total_revenue, operating_profit, created_at, updated_at'
          )
          .eq('reservation_id', reservationId)
          .limit(1),
      ])

      if (cancelled) return

      if (resLogsRes.error) {
        console.warn('audit_logs_view (reservation edit history) fetch skipped:', resLogsRes.error.message)
      }
      const reservationLogs = (resLogsRes.data || []) as EditHistoryLog[]
      const payments = (paymentsRes.data || []) as PaymentRecordLite[]
      const pricing = (pricingRes.data || []) as PricingRowLite[]

      const relatedIds = [...payments.map((p) => p.id), ...pricing.map((p) => p.id)].filter(Boolean)
      let related: EditHistoryLog[] = []
      if (relatedIds.length > 0) {
        const { data, error } = await supabase
          .from('audit_logs_view')
          .select('id, table_name, action, changed_fields, old_values, new_values, created_at, user_email, record_id')
          .in('table_name', ['payment_records', 'reservation_pricing'])
          .in('record_id', relatedIds)
          .order('created_at', { ascending: false })
          .limit(100)
        if (error) {
          console.warn('audit_logs_view (payment/pricing history) fetch skipped:', error.message)
        } else {
          related = (data || []) as EditHistoryLog[]
        }
      }

      const tourIds = new Set<string>()
      for (const log of reservationLogs) {
        const oldId = log.old_values?.tour_id
        const newId = log.new_values?.tour_id
        if (!isEmptyId(oldId)) tourIds.add(String(oldId))
        if (!isEmptyId(newId)) tourIds.add(String(newId))
      }

      const toursMap: Record<string, { created_at: string | null }> = {}
      if (tourIds.size > 0) {
        const { data } = await supabase.from('tours').select('id, created_at').in('id', [...tourIds])
        ;(data || []).forEach((row: { id: string; created_at: string | null }) => {
          toursMap[row.id] = { created_at: row.created_at ?? null }
        })
      }

      if (cancelled) return
      setEditHistory(reservationLogs)
      setRelatedAudits(related)
      setPaymentRecords(payments)
      setPricingRows(pricing)
      setToursById(toursMap)
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [isOpen, reservationId])

  const lookups: AuditLookups = useMemo(
    () => ({ pickupHotelsById, choiceNameById, optionNameById }),
    [pickupHotelsById, choiceNameById, optionNameById]
  )

  const displayItems = useMemo(() => {
    const items: DisplayHistoryItem[] = []
    const insertLog = editHistory.find((l) => l.action === 'INSERT')
    const hiddenIds = new Set<string>()
    let mergedCanyon: unknown

    if (insertLog) {
      for (const log of editHistory) {
        if (log.id === insertLog.id) continue
        if (!isSystemCanyonChoiceUpdate(log)) continue
        if (!isNear(log.created_at, insertLog.created_at)) continue
        hiddenIds.add(log.id)
        const nextVal = log.new_values?.canyon_choice
        if (nextVal != null && nextVal !== '') mergedCanyon = nextVal
      }
    }

    for (const log of editHistory) {
      if (hiddenIds.has(log.id)) continue
      if (log.action === 'UPDATE') {
        const fields = meaningfulFields(log.changed_fields)
        if (fields.length === 0) continue
      }

      const oldV = log.old_values || {}
      const newV = { ...(log.new_values || {}) }
      const addedByFromRow =
        log.action === 'INSERT' && typeof newV.added_by === 'string' ? newV.added_by.trim() || null : null
      const authorEmail = log.user_email?.trim() || addedByFromRow

      if (log.action === 'INSERT') {
        if (mergedCanyon !== undefined && isEmptyId(newV.canyon_choice)) {
          newV.canyon_choice = mergedCanyon
        }
        const keys = orderedInsertKeys(newV)
        const previewKeys = keys.slice(0, INSERT_PREVIEW_LIMIT)
        const extraKeys = keys.slice(INSERT_PREVIEW_LIMIT)
        items.push({
          id: log.id,
          created_at: log.created_at,
          authorEmail,
          summary: isEn ? 'Reservation created' : '예약 생성',
          accent: 'create',
          detailRows: previewKeys.map((k) => toDetailRow(k, newV[k], isEn, lookups)),
          extraRows: extraKeys.map((k) => toDetailRow(k, newV[k], isEn, lookups)),
        })
        continue
      }

      if (isTourIdOnlyUpdate(log)) {
        const newId = newV.tour_id
        const tourMeta = !isEmptyId(newId) ? toursById[String(newId)] : undefined
        items.push({
          id: log.id,
          created_at: log.created_at,
          authorEmail,
          summary: tourLinkSummary(oldV.tour_id, newId, tourMeta?.created_at, log.created_at, isEn),
          accent: 'tour',
          detailRows: [],
          extraRows: [],
        })
        continue
      }

      const fields = meaningfulFields(log.changed_fields)
      items.push({
        id: log.id,
        created_at: log.created_at,
        authorEmail,
        summary: getEditHistorySummary(log.action, log.changed_fields, isEn),
        accent: 'default',
        detailRows: fields.map((fieldKey) =>
          toDetailRow(fieldKey, newV[fieldKey], isEn, lookups, oldV[fieldKey], true)
        ),
        extraRows: [],
      })
    }

    const paymentAudits = relatedAudits.filter((l) => l.table_name === 'payment_records')
    const pricingAudits = relatedAudits.filter((l) => l.table_name === 'reservation_pricing')
    const paymentIdsWithAudit = new Set(paymentAudits.map((l) => String(l.record_id || '')))
    const pricingIdsWithAudit = new Set(pricingAudits.map((l) => String(l.record_id || '')))

    const paymentActionLabel = (action: string) => {
      if (action === 'INSERT') return isEn ? 'Deposit added' : '입금내역 추가됨'
      if (action === 'DELETE') return isEn ? 'Deposit deleted' : '입금내역 삭제됨'
      return isEn ? 'Deposit updated' : '입금내역 수정됨'
    }
    const pricingActionLabel = (action: string) => {
      if (action === 'INSERT') return isEn ? 'Pricing saved' : '가격 정보 저장됨'
      if (action === 'DELETE') return isEn ? 'Pricing deleted' : '가격 정보 삭제됨'
      return isEn ? 'Pricing updated' : '가격 정보 수정됨'
    }

    const paymentPreviewFields = ['amount', 'payment_method', 'payment_status', 'note']
    const pricingNoiseSkip = new Set([
      'audited',
      'audited_at',
      'audited_by_email',
      'audited_by_name',
      'audited_by_nick_name',
      'reservation_id',
    ])

    for (const log of paymentAudits) {
      const fields =
        log.action === 'UPDATE'
          ? meaningfulFields(log.changed_fields)
          : paymentPreviewFields.filter((k) => (log.new_values || log.old_values || {})[k] != null)
      const src = log.action === 'DELETE' ? log.old_values || {} : log.new_values || {}
      const oldV = log.old_values || {}
      items.push({
        id: log.id,
        created_at: log.created_at,
        authorEmail: log.user_email?.trim() || null,
        summary: paymentActionLabel(log.action),
        accent: 'payment',
        detailRows: fields.map((k) =>
          toDetailRow(k, src[k], isEn, lookups, oldV[k], log.action === 'UPDATE')
        ),
        extraRows: [],
      })
    }

    for (const log of pricingAudits) {
      const src = (log.action === 'DELETE' ? log.old_values : log.new_values) || {}
      const oldV = log.old_values || {}
      const isDiff = log.action === 'UPDATE'
      const detailRows = isDiff
        ? meaningfulFields(log.changed_fields)
            .filter((k) => !pricingNoiseSkip.has(k))
            .sort((a, b) => {
              const ia = PRICING_DETAIL_ORDER.indexOf(a)
              const ib = PRICING_DETAIL_ORDER.indexOf(b)
              return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib)
            })
            .map((k) => toDetailRow(k, src[k], isEn, lookups, oldV[k], true))
        : pricingDetailRowsFromRecord(src, isEn, lookups)
      items.push({
        id: log.id,
        created_at: log.created_at,
        authorEmail: log.user_email?.trim() || null,
        summary: pricingActionLabel(log.action),
        accent: 'pricing',
        detailRows,
        extraRows: [],
      })
    }

    for (const pay of paymentRecords) {
      if (paymentIdsWithAudit.has(pay.id)) continue
      const createdAt = pay.created_at || pay.updated_at
      if (!createdAt) continue
      const detailRows: DetailRow[] = [
        toDetailRow('amount', pay.amount, isEn, lookups),
        toDetailRow('payment_method', pay.payment_method, isEn, lookups),
        toDetailRow('payment_status', pay.payment_status, isEn, lookups),
      ]
      if (pay.note) detailRows.push(toDetailRow('note', pay.note, isEn, lookups))
      items.push({
        id: `payment-add-${pay.id}`,
        created_at: createdAt,
        authorEmail: pay.submit_by?.trim() || null,
        summary: isEn ? 'Deposit added' : '입금내역 추가됨',
        accent: 'payment',
        detailRows,
        extraRows: [],
      })
      if (isLaterWrite(pay.updated_at, pay.created_at) && pay.updated_at) {
        items.push({
          id: `payment-edit-${pay.id}`,
          created_at: pay.updated_at,
          authorEmail: pay.submit_by?.trim() || null,
          summary: isEn ? 'Deposit updated' : '입금내역 수정됨',
          accent: 'payment',
          detailRows,
          extraRows: [],
        })
      }
    }

    for (const pricing of pricingRows) {
      if (pricingIdsWithAudit.has(pricing.id)) continue
      const createdAt = pricing.created_at || pricing.updated_at
      if (!createdAt) continue
      const detailRows = pricingDetailRowsFromRecord(pricingRowToRecord(pricing), isEn, lookups)
      items.push({
        id: `pricing-add-${pricing.id}`,
        created_at: createdAt,
        authorEmail: null,
        summary: isEn ? 'Pricing saved' : '가격 정보 저장됨',
        accent: 'pricing',
        detailRows,
        extraRows: [],
      })
      if (isLaterWrite(pricing.updated_at, pricing.created_at) && pricing.updated_at) {
        items.push({
          id: `pricing-edit-${pricing.id}`,
          created_at: pricing.updated_at,
          authorEmail: null,
          summary: isEn ? 'Pricing updated' : '가격 정보 수정됨',
          accent: 'pricing',
          detailRows,
          extraRows: [],
        })
      }
    }

    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return items
  }, [editHistory, relatedAudits, paymentRecords, pricingRows, toursById, isEn, lookups])

  useEffect(() => {
    if (!isOpen) return
    const emails = [
      ...new Set(
        [
          ...editHistory.flatMap((l) => {
            const list: string[] = []
            if (l.user_email?.trim()) list.push(l.user_email.trim())
            if (!l.user_email?.trim() && l.action === 'INSERT' && l.new_values) {
              const ab = l.new_values.added_by
              if (typeof ab === 'string' && ab.trim()) list.push(ab.trim())
            }
            return list
          }),
          ...relatedAudits.flatMap((l) => (l.user_email?.trim() ? [l.user_email.trim()] : [])),
          ...paymentRecords.flatMap((p) => (p.submit_by?.trim() ? [p.submit_by.trim()] : [])),
        ]
      ),
    ]
    if (emails.length === 0) {
      setTeamNameByEmail({})
      return
    }
    let cancelled = false
    supabase
      .from('team')
      .select('email, nick_name, name_ko')
      .in('email', emails)
      .then(({ data }) => {
        if (cancelled) return
        const map: Record<string, string> = {}
        ;(data || []).forEach((row: { email: string; nick_name: string | null; name_ko: string | null }) => {
          map[row.email] = row.nick_name ?? row.name_ko ?? row.email
        })
        setTeamNameByEmail(map)
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, editHistory, relatedAudits, paymentRecords])

  useEffect(() => {
    if (!isOpen) return
    const pickupIds = new Set<string>()
    const choiceIds = new Set<string>()
    const optionIds = new Set<string>()
    editHistory.forEach((log) => {
      const oldV = log.old_values || {}
      const newV = log.new_values || {}
      if (typeof oldV.pickup_hotel === 'string' && oldV.pickup_hotel) pickupIds.add(oldV.pickup_hotel)
      if (typeof newV.pickup_hotel === 'string' && newV.pickup_hotel) pickupIds.add(newV.pickup_hotel)
      const parseChoices = (val: unknown) => {
        try {
          const raw = typeof val === 'string' ? JSON.parse(val) : val
          const required = raw?.required
          if (Array.isArray(required)) {
            required.forEach((item: { choice_id?: string; option_id?: string }) => {
              if (item.choice_id) choiceIds.add(item.choice_id)
              if (item.option_id) optionIds.add(item.option_id)
            })
          }
        } catch {
          /* ignore */
        }
      }
      parseChoices(oldV.choices)
      parseChoices(newV.choices)
    })
    if (pickupIds.size === 0 && choiceIds.size === 0 && optionIds.size === 0) {
      setPickupHotelsById({})
      setChoiceNameById({})
      setOptionNameById({})
      return
    }
    const useKo = !isEn
    let cancelled = false
    Promise.all([
      pickupIds.size > 0
        ? supabase.from('pickup_hotels').select('id, hotel, pick_up_location').in('id', [...pickupIds])
        : Promise.resolve({ data: [] }),
      choiceIds.size > 0
        ? supabase.from('product_choices').select('id, choice_group_ko, choice_group').in('id', [...choiceIds])
        : Promise.resolve({ data: [] }),
      optionIds.size > 0
        ? (() => {
            const ids = choiceOptionIdsForSupabaseIn(optionIds)
            return ids.length > 0
              ? supabase.from('choice_options').select('id, option_name_ko, option_name').in('id', ids)
              : Promise.resolve({ data: [] })
          })()
        : Promise.resolve({ data: [] }),
    ]).then(([pickupRes, choiceRes, optionRes]) => {
      if (cancelled) return
      const byId: Record<string, { hotel?: string | null; pick_up_location?: string | null }> = {}
      ;(pickupRes.data || []).forEach((row: { id: string; hotel?: string | null; pick_up_location?: string | null }) => {
        byId[row.id] = {
          hotel: row.hotel ?? null,
          pick_up_location: row.pick_up_location ?? null,
        }
      })
      setPickupHotelsById(byId)
      const choiceNames: Record<string, string> = {}
      ;(choiceRes.data || []).forEach((row: { id: string; choice_group_ko?: string | null; choice_group?: string | null }) => {
        choiceNames[row.id] =
          (useKo ? row.choice_group_ko : row.choice_group) || row.choice_group_ko || row.choice_group || row.id
      })
      setChoiceNameById(choiceNames)
      const optionNames: Record<string, string> = {}
      ;(optionRes.data || []).forEach((row: { id: string; option_name_ko?: string | null; option_name?: string | null }) => {
        optionNames[row.id] =
          (useKo ? row.option_name_ko : row.option_name) || row.option_name_ko || row.option_name || row.id
      })
      setOptionNameById(optionNames)
    })
    return () => {
      cancelled = true
    }
  }, [isOpen, editHistory, isEn])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
      style={{ zIndex: overlayZIndex }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reservation-edit-history-title"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <h3
            id="reservation-edit-history-title"
            className="text-sm font-semibold text-gray-900 flex items-center gap-2"
          >
            <History className="w-4 h-4 text-gray-600" />
            {isEn ? 'Reservation edit history' : '예약 수정 이력'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
            aria-label={isEn ? 'Close' : '닫기'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {loading ? (
            <p className="text-sm text-gray-500 py-6 text-center">{isEn ? 'Loading...' : '불러오는 중...'}</p>
          ) : displayItems.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">
              {isEn ? 'No edit history yet.' : '수정 이력이 없습니다.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {displayItems.map((item) => (
                <li
                  key={item.id}
                  className={`flex flex-col gap-1.5 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs ${accentClass(item.accent)}`}
                >
                  <div className="text-gray-800 font-medium">{item.summary}</div>
                  {item.detailRows.length > 0 && (
                    <div className="mt-1 pl-2 border-l-2 border-gray-200 space-y-1 text-gray-600">
                      {item.detailRows.map((row) =>
                        row.isDiff ? (
                          <div key={row.key} className="flex flex-wrap gap-x-1">
                            <span className="shrink-0 font-medium text-gray-700">{row.label}:</span>
                            <span className="text-red-600 line-through">{row.oldText}</span>
                            <span className="shrink-0"> → </span>
                            <span className="text-green-700 font-medium">{row.newText}</span>
                          </div>
                        ) : (
                          <div key={row.key}>
                            <span className="font-medium text-gray-700">{row.label}:</span> {row.newText}
                          </div>
                        )
                      )}
                      {item.extraRows.length > 0 && (
                        <InsertExtraFieldsTooltip
                          extraRows={item.extraRows}
                          extraCountLabel={`… +${item.extraRows.length} more`}
                          zIndex={overlayZIndex + 20}
                        />
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-gray-500 mt-0.5">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      {formatEditHistoryDateTime(item.created_at)}
                    </span>
                    <span className="flex items-center gap-1" title={item.authorEmail ?? ''}>
                      <User className="w-3.5 h-3.5 shrink-0" />
                      {item.authorEmail
                        ? teamNameByEmail[item.authorEmail] ??
                          (isSystemActor(item.authorEmail) ? 'system' : item.authorEmail)
                        : isEn
                          ? 'Unknown'
                          : '알 수 없음'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
