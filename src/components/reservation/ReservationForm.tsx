'use client'
/* eslint-disable */

import React, { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo } from 'react'
import { Trash2, Eye, AlertTriangle, X, Mail, Phone, ChevronDown, Globe, Store } from 'lucide-react'
import ReactCountryFlag from 'react-country-flag'
import { useTranslations, useLocale } from 'next-intl'
import { sanitizeTimeInput, timeToHHmm, normalizeTourDateForDb } from '@/lib/utils'
import {
  resolveImportChannelVariantKey,
  channelProductsIncludeVariantKey,
  mapSemanticVariantToChannelProductKey,
  canonicalVariantKey,
} from '@/lib/resolveImportChannelVariant'
import { supabase, isAbortLikeError } from '@/lib/supabase'
import { insertCustomerViaAdminApi } from '@/lib/adminCustomerInsert'
import { generateCustomerId } from '@/lib/entityIds'
import { useAuth } from '@/contexts/AuthContext'
import { isSuperAdminActor } from '@/lib/superAdmin'
import type { Database } from '@/lib/supabase'

/** 브라우저에서 customers INSERT 시 RLS(team↔is_staff 재귀 등)로 실패할 때 API+service role 경로 사용 */
async function insertCustomerForReservationForm(
  useServerApi: boolean,
  customerRow: Record<string, unknown>
): Promise<{ row: Database['public']['Tables']['customers']['Row'] | null; errorMessage: string | null }> {
  if (useServerApi) {
    const { customer, errorMessage } = await insertCustomerViaAdminApi(customerRow)
    if (errorMessage || !customer) {
      return { row: null, errorMessage: errorMessage || '고객 생성 실패' }
    }
    return { row: customer, errorMessage: null }
  }
  const { data, error } = await (supabase as any).from('customers').insert(customerRow).select('*').maybeSingle()
  if (error) {
    return { row: null, errorMessage: error.message }
  }
  return { row: (data as Database['public']['Tables']['customers']['Row']) ?? null, errorMessage: null }
}
import CustomerForm from '@/components/CustomerForm'
import CustomerSection from '@/components/reservation/CustomerSection'
import TourInfoSection from '@/components/reservation/TourInfoSection'
import ParticipantsSection from '@/components/reservation/ParticipantsSection'
import PricingSection from '@/components/reservation/PricingSection'
import ProductSelectionSection from '@/components/reservation/ProductSelectionSectionNew'
import ChannelSection from '@/components/reservation/ChannelSection'
import TourConnectionSection from '@/components/reservation/TourConnectionSection'
import ImportTourDaySummary from '@/components/reservation/ImportTourDaySummary'
import PaymentRecordsList from '@/components/PaymentRecordsList'
import ReservationExpenseManager from '@/components/ReservationExpenseManager'
import ReservationOptionsSection from '@/components/reservation/ReservationOptionsSection'
import ReviewManagementSection from '@/components/reservation/ReviewManagementSection'
import ReservationFollowUpSection from '@/components/reservation/ReservationFollowUpSection'
import CancellationReasonModal from '@/components/reservation/CancellationReasonModal'
import PricingInfoModal from '@/components/reservation/PricingInfoModal'
import { upsertReservationCancellationReason } from '@/lib/reservationCancellationReason'
import { findSimilarCustomersInList } from '@/lib/customerSimilarity'
import { getOptionalOptionsForProduct } from '@/utils/reservationUtils'
import {
  emptyResidentStatusAmounts,
  findUsResidentClassificationChoice,
  buildResidentChoiceRowsFromLineState,
  mergeResidentRowsIntoSelectedChoices,
  parseResidentLineStateFromSelections,
  residentLineStateEquals,
  computePassCoveredCount,
  type ResidentLineState,
  type ResidentLineKey,
} from '@/utils/usResidentChoiceSync'
import {
  getFallbackOtaSalePrice,
  getFallbackOtaAndNotIncluded,
  getNoChoiceOtaAndNotIncluded,
} from '@/utils/choicePricingMatcher'
import {
  computeChannelPaymentAfterReturn,
  computeChannelSettlementAmount,
  deriveCommissionGrossForSettlement,
  resolveCommissionBasePriceForPersistence,
} from '@/utils/channelSettlement'
import {
  isReturnedPaymentStatus,
  summarizePaymentRecordsForBalance,
  type PaymentRecordLike,
} from '@/utils/reservationPricingBalance'
import { aggregateReservationOptionSumsByReservationId } from '@/lib/syncReservationPricingAggregates'
import { sumReservationOptionCancelledRefundTotals } from '@/utils/reservationOptionsShared'
import {
  computeRefundAmountForCompanyRevenueBlock,
  computeStoredCompanyRevenueFields,
} from '@/utils/storedCompanyRevenue'
import { productShowsResidentStatusSectionByCode } from '@/utils/residentStatusSectionProducts'
import { getCountryFromPhone } from '@/utils/phoneUtils'
import type { 
  Customer, 
  Product, 
  Channel, 
  ProductOption, 
  Option, 
  PickupHotel, 
  Reservation 
} from '@/types/reservation'

// 언어 선택 옵션 (국기용 country code + 라벨)
const LANGUAGE_OPTIONS: { value: string; countryCode: string; label: string }[] = [
  { value: 'KR', countryCode: 'KR', label: '한국어' },
  { value: 'EN', countryCode: 'US', label: 'English' },
  { value: 'JA', countryCode: 'JP', label: '日本語' },
  { value: 'ZH', countryCode: 'CN', label: '中文' },
  { value: 'ES', countryCode: 'ES', label: 'Español' },
  { value: 'FR', countryCode: 'FR', label: 'Français' },
  { value: 'DE', countryCode: 'DE', label: 'Deutsch' },
  { value: 'IT', countryCode: 'IT', label: 'Italiano' },
  { value: 'PT', countryCode: 'PT', label: 'Português' },
  { value: 'RU', countryCode: 'RU', label: 'Русский' }
]

/** 특정 상품의 기본 투어 시간 (상품명 일치 시 적용, 채널 무관) */
const PRODUCT_DEFAULT_TOUR_TIMES: Record<string, string> = {
  '밤도깨비 그랜드캐년 일출 투어': '00:00',
}

const UNDECIDED_OPTION_ID_PRICING = '__undecided__'
type TeamAuditProfile = {
  email: string
  name: string
  nickName: string
  position: string | null
}

type ReservationPricingAuditState = {
  audited: boolean
  auditedAt: string | null
  auditedByEmail: string | null
  auditedByName: string | null
  auditedByNickName: string | null
}

function auditDisplayName(profile: TeamAuditProfile | null, fallbackEmail?: string | null): string {
  return profile?.nickName || profile?.name || fallbackEmail || ''
}
/** 동적가격(choices_pricing) 조회용: 미정(__undecided__)이면 미국 거주자 옵션 UUID로 치환 (DB 키에 미정 없음) */
function normalizeUndecidedChoicesForDynamicPricing(
  selectedChoices: Array<{ choice_id?: string; option_id?: string; id?: string; option_key?: string }>,
  productChoices: Array<{
    id: string
    choice_group?: string | null
    choice_group_ko?: string | null
    options?: Array<{
      id: string
      option_key?: string
      option_name?: string
      option_name_ko?: string
      option_name_en?: string
      name?: string
      name_ko?: string
      key?: string
    }>
  }>
): Array<{ choice_id?: string; option_id?: string; id?: string; option_key?: string }> {
  const GROUP_LABELS = ['미국 거주자 구분', '기타 입장료', '미국 거주자 구분 및 기타 입장료']
  const matchesUndecidedGroup = (groupKo: string) => {
    const g = groupKo.trim()
    if (!g) return false
    return GROUP_LABELS.some((label) => g === label || g.includes(label) || label.includes(g))
  }
  const findUsResidentOption = (opts: any[]) => {
    if (!opts?.length) return null
    const found = opts.find((opt: any) => {
      const nameKo = (opt.option_name_ko || opt.name_ko || '').trim()
      const name = (opt.option_name || opt.name || '').trim()
      const nameEn = (opt.option_name_en || opt.name_en || '').trim().toLowerCase()
      const key = (opt.option_key || opt.key || '').trim().toLowerCase()
      return (
        nameKo === '미국 거주자' ||
        name === '미국 거주자' ||
        (nameKo.includes('미국 거주자') && !nameKo.includes('비 거주자') && !nameKo.includes('비거주')) ||
        (nameKo.includes('미국') && nameKo.includes('거주') && !nameKo.includes('비')) ||
        nameEn === 'us resident' ||
        (nameEn.includes('us resident') && !nameEn.includes('non') && !nameEn.includes('비거주')) ||
        (key.includes('us') && key.includes('resident')) ||
        key === 'us_resident' ||
        key === 'usresident'
      )
    })
    if (found) return found
    const notNonResident = opts.find((opt: any) => {
      const nameKo = (opt.option_name_ko || opt.name_ko || '').trim()
      const name = (opt.option_name || opt.name || '').trim()
      const combined = `${nameKo} ${name}`.toLowerCase()
      if (/비\s*거주|비거주|non\s*resident|non-resident|nonresident/i.test(combined)) return false
      return true
    })
    return notNonResident || opts[0]
  }

  return (selectedChoices || []).map((c: any) => {
    const choiceId = c.choice_id || c.id
    const optionId = c.option_id
    const pc = productChoices?.find((p) => p.id === choiceId)
    const groupKo = (pc?.choice_group_ko || pc?.choice_group || '').trim()
    const isUndecided = optionId === UNDECIDED_OPTION_ID_PRICING || c.option_key === UNDECIDED_OPTION_ID_PRICING
    if (!isUndecided || !matchesUndecidedGroup(groupKo) || !pc?.options?.length) return c
    const us = findUsResidentOption(pc.options as any[])
    if (!us) return c
    return { ...c, option_id: us.id, option_key: (us as any).option_key ?? (us as any).key }
  })
}

/** 이메일/가져오기 등으로 choice_id·option_id가 현재 product_choices와 어긋날 때, 옵션 UUID·option_key로 보정 */
function resolveChoiceSelectionForPricing(
  c: { choice_id?: string; option_id?: string; id?: string; option_key?: string },
  productChoices: Array<{
    id: string
    options?: Array<{ id: string; option_key?: string }>
  }>
): { choice_id?: string; option_id?: string; id?: string; option_key?: string } {
  if (!productChoices?.length) return c
  const oid = c.option_id
  let cid = c.choice_id || c.id
  let pc = cid ? productChoices.find((p) => p.id === cid) : undefined
  if (!pc && oid) {
    const found = productChoices.find((p) => p.options?.some((o) => o.id === oid))
    if (found) {
      pc = found
      cid = found.id
    }
  }
  if (!pc) return c
  let opt = oid ? pc.options?.find((o) => o.id === oid) : undefined
  const ok = (c as { option_key?: string }).option_key
  if (!opt && ok) {
    opt = pc.options?.find((o) => o.option_key === ok)
  }
  const next = { ...c, choice_id: cid, id: cid } as typeof c
  if (opt) {
    const out: { choice_id?: string; option_id?: string; id?: string; option_key?: string } = {
      ...next,
      option_id: opt.id,
    }
    const okResolved = opt.option_key ?? ok
    if (okResolved !== undefined && okResolved !== null && okResolved !== '') {
      out.option_key = okResolved
    }
    return out
  }
  return next
}

type CouponRow = {
  id: string
  coupon_code: string
  discount_type: 'percentage' | 'fixed'
  percentage_value?: number | null
  fixed_value?: number | null
  status?: string | null
  channel_id?: string | null
  product_id?: string | null
  start_date?: string | null
  end_date?: string | null
}

interface ReservationFormProps {
  reservation?: Reservation | null
  customers: Customer[]
  products: Product[]
  channels: Channel[]
  productOptions: ProductOption[]
  options: Option[]
  pickupHotels: PickupHotel[]
  coupons: CouponRow[]
  onSubmit: (reservation: Omit<Reservation, 'id'>) => void
  onCancel: () => void
  onRefreshCustomers: () => Promise<void>
  onDelete: (id: string) => void
  /** 가격 정보만 저장(savePricingInfo) 성공 직후 — 부모가 목록/통계 로컬 상태를 갱신할 때 사용 */
  onPricingSaved?: (reservationId: string) => void | Promise<void>
  layout?: 'modal' | 'page'
  onViewCustomer?: () => void
  initialCustomerId?: string
  /** true이면 지난 날짜 예약도 수정 가능 (super 계정용) */
  allowPastDateEdit?: boolean
  /** 제목줄 오른쪽에 표시할 액션 (예: 영수증 인쇄 버튼) */
  titleAction?: React.ReactNode
  /** 새 예약 추가 모드(아직 DB에 저장 전). true이면 예약 옵션 추가는 저장 후에만 가능 */
  isNewReservation?: boolean
  /** 예약 가져오기(이메일)에서 넘긴 초기 고객 정보. reservation.id가 import- 로 시작할 때 사용 */
  initialDataFromImport?: { customer_name?: string; customer_email?: string; customer_phone?: string; emergency_contact?: string; customer_language?: string }
  /** 예약 가져오기 시 새 고객 추가 폼을 열어둘지 여부 (이메일에서 고객명이 있을 때 true) */
  initialShowNewCustomerForm?: boolean
  /** 예약 가져오기에서 파싱한 초이스 옵션명 (예: "Lower Antelope Canyon"). 상품 초이스 로드 시 해당 옵션으로 선택 */
  initialChoiceOptionNamesFromImport?: string[]
  /** "미정"으로 둘 초이스 그룹명 (예: "미국 거주자 구분", "기타 입장료"). option_id __undecided__ 로 설정 */
  initialChoiceUndecidedGroupNamesFromImport?: string[]
  /** 예약 가져오기에서 파싱한 이메일 본문 금액 (예: "$698.88"). 동적가격 합계와 다르면 채널·상품에 맞는 쿠폰을 골라 금액에 가깝게 맞춤 */
  initialAmountFromImport?: string
  /** Viator: 이메일 Net Rate (USD). 채널 정산 금액과 다를 때만 쿠폰 자동 선택 */
  initialViatorNetRateFromImport?: string
  /** Klook 등: 파싱된 채널 variant 표시문 (예: All Inclusive). 채널 버튼에 "Klook - …" 로 보이게 함 */
  initialChannelVariantLabelFromImport?: string
  /** 예약 가져오기: extracted_data.channel_variant_key → dynamic_pricing.variant_key 와 일치시키기 위함 */
  initialVariantKeyFromImport?: string
  /** @deprecated 가격 정보는 동적가격에서만 로드. 이메일 불포함 금액은 사용하지 않음 */
  initialNotIncludedAmountFromImport?: string
  /** 폼 제목 오버라이드 (예: 이메일에서 예약 가져오기) */
  formTitle?: string
  /** 예약 가져오기: 이미 confirmed 등 처리된 항목은 저장만 막고 UI는 동일하게 유지 */
  importSubmitDisabled?: boolean
  /** true면 고객 INSERT 를 /api/admin/customers 로 수행(서비스 롤) — 이메일 가져오기 시 브라우저 RLS 회피 */
  useServerCustomerInsert?: boolean
  /** Follow-up 파이프라인(컨펌·거주·출발·픽업) 스냅샷 재조회 트리거 — 예: 상단 이메일 발송 성공 시 증가 */
  followUpPipelineSnapshotRefreshToken?: number
}

/** 이메일에서 파싱한 금액 문자열 → 숫자 (Price $ 319.41 등) */
function parseMoneyFromImportString(raw?: string | null): number | null {
  if (raw == null || String(raw).trim() === '') return null
  const s = String(raw).replace(/,/g, '')
  const m = s.match(/(\d+(?:\.\d+)?)/)
  if (!m) return null
  const n = parseFloat(m[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

/** channel_id 없음 = 채널 공통 쿠폰으로 간주 */
function couponMatchesChannel(coupon: { channel_id?: string | null }, channelId: string | null | undefined): boolean {
  if (!channelId) return false
  if (coupon.channel_id == null || coupon.channel_id === '') return true
  return coupon.channel_id === channelId
}

/** Viator 자동 9%: DB·UI에 따라 discount_type 대소문자, percentage_value 형식 차이 허용 */
function isNinePercentCouponForViator(coupon: {
  discount_type?: string | null
  percentage_value?: unknown
}): boolean {
  const dt = String(coupon.discount_type ?? '').toLowerCase()
  if (dt !== 'percentage') return false
  const pv = Number(coupon.percentage_value)
  if (!Number.isFinite(pv)) return false
  return Math.abs(pv - 9) < 0.05
}

type RezLike = Partial<Reservation> & {
  customer_id?: string
  product_id?: string
  tour_date?: string
  tour_time?: string
  event_note?: string
  pickup_hotel?: string
  pickup_time?: string
  total_people?: number
  channel_id?: string
  channel_rn?: string
  added_by?: string
  created_at?: string
  tour_id?: string
  selected_options?: { [optionId: string]: string[] }
  selected_option_prices?: { [key: string]: number }
  is_private_tour?: boolean
  variant_key?: string
}

export default function ReservationForm({ 
  reservation, 
  customers, 
  products, 
  channels, 
  productOptions, 
  options, 
  pickupHotels, 
  coupons, 
  onSubmit, 
  onCancel, 
  onRefreshCustomers, 
  onDelete,
  onPricingSaved,
  layout = 'modal',
  onViewCustomer,
  initialCustomerId,
  allowPastDateEdit: _allowPastDateEdit = false,
  titleAction,
  isNewReservation = false,
  initialDataFromImport,
  initialShowNewCustomerForm = false,
  initialChoiceOptionNamesFromImport,
  initialChoiceUndecidedGroupNamesFromImport,
  initialAmountFromImport,
  initialViatorNetRateFromImport,
  initialChannelVariantLabelFromImport,
  initialVariantKeyFromImport,
  initialNotIncludedAmountFromImport: _initialNotIncludedAmountFromImport,
  formTitle: formTitleOverride,
  importSubmitDisabled = false,
  useServerCustomerInsert = false,
  followUpPipelineSnapshotRefreshToken = 0,
}: ReservationFormProps) {
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [showPricingModal, setShowPricingModal] = useState(false)
  const [showProductChoiceModal, setShowProductChoiceModal] = useState(false)
  const [showChannelModal, setShowChannelModal] = useState(false)
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(initialShowNewCustomerForm)
  const [languageDropdownOpen, setLanguageDropdownOpen] = useState(false)
  const languageDropdownRef = useRef<HTMLDivElement | null>(null)
  const t = useTranslations('reservations')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const { authUser, userPosition } = useAuth()
  const isSuperPricingAdmin = isSuperAdminActor(authUser?.email, userPosition)
  const customerSearchRef = useRef<HTMLDivElement | null>(null)
  const reservationFormRef = useRef<HTMLFormElement>(null)
  const rez: RezLike = (reservation as unknown as RezLike) || ({} as RezLike)
  const isImportMode = typeof (reservation as any)?.id === 'string' && (reservation as any).id.startsWith('import-')
  const effectiveReservationId = isImportMode ? undefined : reservation?.id
  // id-only stub: ensure-draft API inserts minimal DB row so expenses FK works before full save.
  const reservationKeyList = reservation
    ? Object.keys(reservation as unknown as Record<string, unknown>)
    : []
  const isStubReservationOnlyId =
    Boolean(reservation?.id) &&
    !isImportMode &&
    reservationKeyList.length === 1 &&
    reservationKeyList[0] === 'id'
  const [, setChannelAccordionExpanded] = useState(layout === 'modal')
  const [, setProductAccordionExpanded] = useState(layout === 'modal')
  const [reservationOptionsTotalPrice, setReservationOptionsTotalPrice] = useState(0)
  /** 취소·환불된 예약 옵션 줄 합 — 가격 ④ 환불(입력)에 옵션 취소분 포함 */
  const [reservationOptionsCancelledRefundTotal, setReservationOptionsCancelledRefundTotal] = useState(0)
  const [expenseUpdateTrigger, setExpenseUpdateTrigger] = useState(0)
  const [reservationDraftReady, setReservationDraftReady] = useState(false)
  const [reservationDraftError, setReservationDraftError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  /** 새 예약 시 저장 전에 추가한 옵션 목록. 예약 저장 시 함께 전달됨 */
  const [pendingReservationOptions, setPendingReservationOptions] = useState<Array<{ option_id: string; ea?: number; price?: number; total_price?: number; status?: string; note?: string }>>([])
  
  // 중복 고객 확인 모달 상태
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [similarCustomers, setSimilarCustomers] = useState<Customer[]>([])
  const [pendingCustomerData, setPendingCustomerData] = useState<any>(null)
  const resolvedCustomerIdRef = useRef<string | null>(null)
  /** 이메일 가져오기: 상위 reservation.channel_id는 비동기로 채워지며, 이후 effect가 사용자가 모달에서 고른 채널을 덮어쓰면 안 됨 */
  const emailImportChannelParentSyncedRef = useRef(false)

  useEffect(() => {
    if (!isStubReservationOnlyId) {
      setReservationDraftReady(true)
      setReservationDraftError(null)
      return
    }
    const rid = reservation?.id
    if (!rid) {
      setReservationDraftReady(false)
      setReservationDraftError(null)
      return
    }
    setReservationDraftReady(false)
    setReservationDraftError(null)
    let cancelled = false
    ;(async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (token) headers.Authorization = `Bearer ${token}`
        const res = await fetch('/api/reservations/ensure-draft', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            id: rid,
            added_by: sessionData?.session?.user?.email ?? null,
          }),
        })
        const json = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string }
        if (cancelled) return
        if (res.ok && json.success !== false) {
          setReservationDraftReady(true)
          setReservationDraftError(null)
        } else {
          setReservationDraftReady(false)
          setReservationDraftError(
            typeof json.message === 'string' ? json.message : '예약 연결에 실패했습니다.'
          )
        }
      } catch {
        if (!cancelled) {
          setReservationDraftReady(false)
          setReservationDraftError('예약 연결에 실패했습니다.')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isStubReservationOnlyId, reservation?.id])
  
  const findSimilarCustomers = useCallback(
    (name: string, email?: string, phone?: string): Customer[] =>
      findSimilarCustomersInList(customers, name, email, phone),
    [customers]
  )
  
  const [formData, setFormDataState] = useState<{
    customerId: string
    customerSearch: string
    showCustomerDropdown: boolean
    // 고객 정보 필드 추가
    customerName: string
    customerPhone: string
    customerEmail: string
    customerAddress: string
    customerLanguage: string
    customerEmergencyContact: string
    customerSpecialRequests: string
    customerChannelId: string
    customerStatus: string
    productId: string
    selectedProductCategory: string
    selectedProductSubCategory: string
    productSearch: string
    tourDate: string
    tourTime: string
    eventNote: string
    pickUpHotel: string
    pickUpHotelSearch: string
    showPickupHotelDropdown: boolean
    pickUpTime: string
    adults: number
    pricingAdults: number
    child: number
    infant: number
    totalPeople: number
    // 거주 상태별 인원 수 (미국 거주자 구분 초이스와 동기화)
    undecidedResidentCount?: number
    usResidentCount?: number
    nonResidentCount?: number
    nonResidentWithPassCount?: number
    nonResidentUnder16Count?: number // 비 거주자 (16세 이하)
    nonResidentPurchasePassCount?: number
    passCoveredCount?: number // 패스로 커버되는 인원 수
    residentStatusAmounts?: Record<ResidentLineKey, number>
    channelId: string
    selectedChannelType: 'ota' | 'self' | 'partner'
    channelSearch: string
    variantKey?: string
    channelRN: string
    addedBy: string
    addedTime: string
    tourId: string
    status: 'inquiry' | 'pending' | 'confirmed' | 'completed' | 'cancelled'
    selectedOptions: { [optionId: string]: string[] }
    selectedOptionPrices: { [key: string]: number }
    // 새로운 간결한 초이스 시스템
    productChoices: Array<{
      id: string
      choice_group: string
      choice_group_ko: string
      choice_type: 'single' | 'multiple' | 'quantity'
      is_required: boolean
      min_selections: number
      max_selections: number
      sort_order: number
      options: Array<{
        id: string
        option_key: string
        option_name: string
        option_name_ko: string
        adult_price: number
        child_price: number
        infant_price: number
        capacity: number
        is_default: boolean
        is_active: boolean
        sort_order: number
      }>
    }>
    selectedChoices: Array<{
      choice_id: string
      option_id: string
      quantity: number
      total_price: number
    }>
    choicesTotal: number
    choiceTotal: number
    // 가격 정보
    adultProductPrice: number
    childProductPrice: number
    infantProductPrice: number
    productPriceTotal: number
    requiredOptions: { [optionId: string]: { choiceId: string; adult: number; child: number; infant: number } }
    requiredOptionTotal: number
    choices: { [key: string]: unknown }
    subtotal: number
    couponCode: string
    couponDiscount: number
    additionalDiscount: number
    additionalCost: number
    refundReason: string
    refundAmount: number
    cardFee: number
    tax: number
    prepaymentCost: number
    prepaymentTip: number
    selectedOptionalOptions: { [optionId: string]: { choiceId: string; quantity: number; price: number } }
    optionTotal: number
    totalPrice: number
    depositAmount: number
    balanceAmount: number
    isPrivateTour: boolean
    privateTourAdditionalCost: number
    commission_percent: number
    commission_amount: number
    commission_base_price?: number
    /** DB `channel_settlement_amount` — 로드 시 표시 우선, 없으면 PricingSection에서 계산 */
    channelSettlementAmount?: number
    not_included_price?: number
    // OTA/현장 결제 분리
    onlinePaymentAmount: number
    onSiteBalanceAmount: number
    /** 잔금 수령 총합 (입금 내역에서 계산, 총 결제 예정 금액 = 보증금 + 잔금 수령 + 잔액) */
    balanceReceivedTotal?: number
    productRequiredOptions: ProductOption[]
    // 가격 타입 선택
    priceType: 'base' | 'dynamic'
    // 초이스별 불포함 금액 총합
    choiceNotIncludedTotal?: number
    /** 비거주 등 제외한 불포함(기타) — 표시·분리용 */
    choiceNotIncludedBaseTotal?: number
  }>({
    customerId: reservation?.customerId || (reservation as any)?.customer_id || rez.customer_id || initialCustomerId || '',
    customerSearch: (() => {
      if (initialDataFromImport?.customer_name && (reservation as any)?.id?.startsWith?.('import-')) return initialDataFromImport.customer_name
      const customerId = reservation?.customerId || (reservation as any)?.customer_id || initialCustomerId
      if (customerId && customers.length > 0) {
        const customer = customers.find(c => c.id === customerId)
        return customer?.name || ''
      }
      if (rez.customer_id && customers.length > 0) {
        const customer = customers.find(c => c.id === rez.customer_id)
        return customer?.name || ''
      }
      return ''
    })(),
    showCustomerDropdown: false,
    // 고객 정보 초기값
    customerName: (() => {
      if (initialDataFromImport?.customer_name && (reservation as any)?.id?.startsWith?.('import-')) return initialDataFromImport.customer_name
      const customerId = reservation?.customerId || (reservation as any)?.customer_id || rez.customer_id || initialCustomerId
      if (customerId && customers.length > 0) {
        const customer = customers.find(c => c.id === customerId)
        return customer?.name || ''
      }
      return ''
    })(),
    customerPhone: (() => {
      if (initialDataFromImport?.customer_phone && (reservation as any)?.id?.startsWith?.('import-')) return initialDataFromImport.customer_phone
      const customerId = reservation?.customerId || (reservation as any)?.customer_id || rez.customer_id || initialCustomerId
      if (customerId && customers.length > 0) {
        const customer = customers.find(c => c.id === customerId)
        return customer?.phone || ''
      }
      return ''
    })(),
    customerEmail: (() => {
      if (initialDataFromImport?.customer_email && (reservation as any)?.id?.startsWith?.('import-')) return initialDataFromImport.customer_email
      const customerId = reservation?.customerId || (reservation as any)?.customer_id || rez.customer_id || initialCustomerId
      if (customerId && customers.length > 0) {
        const customer = customers.find(c => c.id === customerId)
        return customer?.email || ''
      }
      return ''
    })(),
    customerAddress: (() => {
      const customerId = reservation?.customerId || (reservation as any)?.customer_id || rez.customer_id
      if (customerId && customers.length > 0) {
        const customer = customers.find(c => c.id === customerId)
        return (customer as any)?.address || ''
      }
      return ''
    })(),
    customerLanguage: (() => {
      if (initialDataFromImport?.customer_language && (reservation as any)?.id?.startsWith?.('import-')) {
        const l = (initialDataFromImport.customer_language || '').trim()
        if (l === 'EN' || l === 'en' || l === 'English' || l === '영어' || /^english\b/i.test(l)) return 'EN'
        if (l === 'KR' || l === 'ko' || l === '한국어' || /^korean\b|^한국어/i.test(l)) return 'KR'
        return l || 'KR'
      }
      const customerId = reservation?.customerId || (reservation as any)?.customer_id || rez.customer_id
      if (customerId && customers.length > 0) {
        const customer = customers.find(c => c.id === customerId)
        const lang = (customer as any)?.language
        if (lang === 'EN' || lang === 'en' || lang === '영어') return 'EN'
        if (lang === 'KR' || lang === 'ko' || lang === '한국어') return 'KR'
        return lang || 'KR'
      }
      return 'KR'
    })(),
    customerEmergencyContact: (() => {
      if (initialDataFromImport?.emergency_contact && (reservation as any)?.id?.startsWith?.('import-')) return initialDataFromImport.emergency_contact
      const customerId = reservation?.customerId || (reservation as any)?.customer_id || rez.customer_id
      if (customerId && customers.length > 0) {
        const customer = customers.find(c => c.id === customerId)
        return (customer as any)?.emergency_contact || ''
      }
      return ''
    })(),
    customerSpecialRequests: (() => {
      const customerId = reservation?.customerId || (reservation as any)?.customer_id || rez.customer_id
      if (customerId && customers.length > 0) {
        const customer = customers.find(c => c.id === customerId)
        return (customer as any)?.special_requests || ''
      }
      return ''
    })(),
    customerChannelId: (() => {
      const customerId = reservation?.customerId || (reservation as any)?.customer_id || rez.customer_id
      if (customerId && customers.length > 0) {
        const customer = customers.find(c => c.id === customerId)
        return (customer as any)?.channel_id || ''
      }
      return ''
    })(),
    customerStatus: (() => {
      const customerId = reservation?.customerId || (reservation as any)?.customer_id || rez.customer_id
      if (customerId && customers.length > 0) {
        const customer = customers.find(c => c.id === customerId)
        return (customer as any)?.status || 'active'
      }
      return 'active'
    })(),
    productId: reservation?.productId || rez.product_id || '',
    selectedProductCategory: '',
    selectedProductSubCategory: '',
    productSearch: '',
    tourDate: normalizeTourDateForDb(reservation?.tourDate || rez.tour_date || '') || (reservation?.tourDate || rez.tour_date || ''),
    tourTime: timeToHHmm(reservation?.tourTime || rez.tour_time || '') || '',
    eventNote: reservation?.eventNote || rez.event_note || '',
    pickUpHotel: reservation?.pickUpHotel || rez.pickup_hotel || '',
    pickUpHotelSearch: (() => {
      const pickUpHotelId = reservation?.pickUpHotel || rez.pickup_hotel || ''
      const matched = pickupHotels.find(h => h.id === pickUpHotelId)
      if (matched) {
        return `${matched.hotel} - ${matched.pick_up_location}`
      }
      // fallback: if stored value is already a label or unknown id, show it as-is
      return pickUpHotelId || ''
    })(),
    showPickupHotelDropdown: false,
    pickUpTime: timeToHHmm(reservation?.pickUpTime || (rez.pickup_time ? String(rez.pickup_time) : '') || '') || '',
    adults: reservation?.adults || rez.adults || 1,
    /** 상품가·필수옵션·불포함(성인) 등 청구 계산용 성인 수 (예약 인원 adults와 별도) */
    pricingAdults: reservation?.adults || rez.adults || 1,
    child: reservation?.child || rez.child || 0,
    infant: reservation?.infant || rez.infant || 0,
    totalPeople: reservation?.totalPeople || rez.total_people || 1,
    // 거주 상태별 인원 수 (초기값은 0, 예약 수정 시 reservation_customers·초이스에서 로드)
    undecidedResidentCount: 0,
    usResidentCount: 0,
    nonResidentCount: 0,
    nonResidentWithPassCount: 0,
    nonResidentUnder16Count: 0,
    nonResidentPurchasePassCount: 0,
    passCoveredCount: 0,
    residentStatusAmounts: emptyResidentStatusAmounts(),
    channelId: reservation?.channelId || rez.channel_id || '',
    selectedChannelType: (() => {
      const channelType = reservation?.channelId 
        ? (channels.find(c => c.id === reservation?.channelId)?.type || 'self')
        : (rez.channel_id ? (channels.find(c => c.id === rez.channel_id)?.type || 'self') : 'self')
      return (channelType === 'ota' || channelType === 'self' || channelType === 'partner') 
        ? channelType as 'ota' | 'self' | 'partner'
        : 'self'
    })(),
    channelSearch: '',
    variantKey: (() => {
      const raw = (reservation as any)?.variant_key ?? rez.variant_key
      if (
        typeof (reservation as any)?.id === 'string' &&
        (reservation as any).id.startsWith('import-')
      ) {
        const r = resolveImportChannelVariantKey(
          raw != null && raw !== '' ? String(raw) : undefined,
          initialChannelVariantLabelFromImport
        )
        const v = (r && r !== '' ? r : undefined) || (raw != null && raw !== '' ? String(raw) : undefined) || 'default'
        return v
      }
      return raw || 'default'
    })(),
    // 예약 가져오기(import) 시 채널 RN은 이메일에서 추출한 예약번호만. "ID" 단어만 있으면 빈칸
    channelRN: (() => {
      const rn = isImportMode ? (rez as any).channel_rn : (reservation?.channelRN ?? rez.channel_rn)
      if (rn == null || rn === '') return ''
      const s = String(rn).trim()
      if (s.toLowerCase() === 'id') return ''
      return s
    })(),
    addedBy: reservation?.addedBy || rez.added_by || '',
    addedTime: reservation?.addedTime || rez.created_at || new Date().toISOString().slice(0, 16).replace('T', ' '),
    tourId: reservation?.tourId || rez.tour_id || '',
    status: (reservation?.status as 'inquiry' | 'pending' | 'confirmed' | 'completed' | 'cancelled') || 'pending',
    selectedOptions: reservation?.selectedOptions || rez.selected_options || {},
    selectedOptionPrices: reservation?.selectedOptionPrices || rez.selected_option_prices || {},
    // 초이스 정보 초기값
    productChoices: [],
    selectedChoices: [],
    choicesTotal: 0,
    choiceTotal: 0,
    // 가격 정보 초기값 (loadPricingInfo 함수에서 동적으로 로드)
    adultProductPrice: 0,
    childProductPrice: 0,
    infantProductPrice: 0,
    productPriceTotal: 0,
    requiredOptions: {},
    requiredOptionTotal: 0,
    choices: {},
    subtotal: 0,
    couponCode: '',
    couponDiscount: 0,
    additionalDiscount: 0,
    additionalCost: 0,
    refundReason: '',
    refundAmount: 0,
    cardFee: 0,
    tax: 0,
    prepaymentCost: 0,
    prepaymentTip: 0,
    selectedOptionalOptions: {},
    optionTotal: 0,
    totalPrice: 0,
    depositAmount: 0,
    balanceAmount: 0,
    isPrivateTour: (reservation?.isPrivateTour as boolean) || (rez as any).is_private_tour || false,
    privateTourAdditionalCost: 0,
    commission_percent: 0,
    commission_amount: 0,
    commission_base_price: 0,
    not_included_price: 0,
    onlinePaymentAmount: 0,
    onSiteBalanceAmount: 0,
    balanceReceivedTotal: 0,
    productRequiredOptions: [],
    priceType: 'dynamic', // 기본값은 dynamic pricing
    choiceNotIncludedTotal: 0,
    choiceNotIncludedBaseTotal: 0
  })


  // 현재 사용자 정보 가져오기
  const [, setCurrentUser] = useState<{ email: string } | null>(null)
  
  // 가격 자동 입력 알림 상태
  const [, setPriceAutoFillMessage] = useState<string>('')
  // 기존 가격 정보가 로드되었는지 추적
  const [isExistingPricingLoaded, setIsExistingPricingLoaded] = useState<boolean>(false)
  // DB에서 불러온 가격 필드 여부 (검은색=DB값, 빨간색=계산값 표시용)
  const [pricingFieldsFromDb, setPricingFieldsFromDb] = useState<Record<string, boolean>>({})
  const pricingFieldsFromDbRef = useRef(pricingFieldsFromDb)
  pricingFieldsFromDbRef.current = pricingFieldsFromDb
  // 편집 모드에서 가격 로드(loadPricingInfo)가 끝난 뒤에만 저장 가능 (0으로 덮어쓰기 방지)
  const [pricingLoadComplete, setPricingLoadComplete] = useState<boolean>(false)
  // reservation_pricing 행 id (상세/폼 가격 섹션 표시용)
  const [reservationPricingId, setReservationPricingId] = useState<string | null>(null)
  /** reservation_pricing 행이 있을 때 현재 채널·초이스 기준 dynamic_pricing 계산 결과(입력칸과 비교·「계산식 적용」용) */
  const [dynamicPriceFormula, setDynamicPriceFormula] = useState<{
    adultPrice: number
    childPrice: number
    infantPrice: number
    commissionPercent: number
    notIncludedPrice: number
  } | null>(null)
  const [pricingAudit, setPricingAudit] = useState<ReservationPricingAuditState>({
    audited: false,
    auditedAt: null,
    auditedByEmail: null,
    auditedByName: null,
    auditedByNickName: null,
  })
  const [currentTeamProfile, setCurrentTeamProfile] = useState<TeamAuditProfile | null>(null)
  /** 비동기 loadPricingInfo 중에도 최신 여부를 반영 — state보다 앞서 자동 쿠폰이 도는 것 방지 */
  const reservationPricingIdRef = useRef<string | null>(null)
  reservationPricingIdRef.current = reservationPricingId
  /** loadPricingInfo가 마지막으로 대상으로 한 예약 id (같은 예약 재조회 시 reservation_pricing id를 null로 비우지 않음) */
  const pricingLoadReservationKeyRef = useRef<string | undefined>(undefined)
  /** 이메일 가져오기: product_choices 로드·이메일 기반 초이스 매칭까지 끝난 productId (이 값이 맞을 때만 loadPricingInfo 실행) */
  const [importChoicesHydratedProductId, setImportChoicesHydratedProductId] = useState<string | null>(null)
  /** 저장된 예약 수정: 초이스 하이드레이션 전에 loadPricingInfo가 빈 selectedChoices로 한 번 도는 것 방지 (가격·정산 오버레이 이중 표시) */
  const [editPricingChoicesReady, setEditPricingChoicesReady] = useState(true)
  /** 채널 버튼/모달에 "Klook - All Inclusive" 형태로 보이기 위해 channel_products variant명 로드 */
  const [channelProductVariantsForDisplay, setChannelProductVariantsForDisplay] = useState<
    Array<{ variant_key: string; variant_name_ko?: string | null; variant_name_en?: string | null }>
  >([])

  /** 채널 모달·동적가격: 시맨틱(all_inclusive) → 실제 DB variant_key(variant_…) */
  const importPreferredVariantKey = useMemo(() => {
    if (!isImportMode) return undefined
    const raw =
      resolveImportChannelVariantKey(
        String(initialVariantKeyFromImport ?? '').trim() ||
          String((reservation as { variant_key?: string })?.variant_key ?? '').trim() ||
          undefined,
        initialChannelVariantLabelFromImport
      )?.trim() ||
      String(initialVariantKeyFromImport ?? '').trim() ||
      String((reservation as { variant_key?: string })?.variant_key ?? '').trim() ||
      undefined
    if (!raw || raw === 'default') return undefined
    if (channelProductVariantsForDisplay.length > 0) {
      const dbKey = mapSemanticVariantToChannelProductKey(
        channelProductVariantsForDisplay,
        raw,
        initialChannelVariantLabelFromImport
      )
      if (dbKey) return dbKey
    }
    return raw
  }, [
    isImportMode,
    initialVariantKeyFromImport,
    (reservation as { variant_key?: string })?.variant_key,
    initialChannelVariantLabelFromImport,
    channelProductVariantsForDisplay,
  ])

  // savePricingInfo 등에서 항상 최신 formData 참조용 (제출 시 배칭 전 최신값 반영용)
  const formDataRef = useRef(formData)
  formDataRef.current = formData

  // setFormData 호출 시 formDataRef를 동기적으로 갱신하여, 입력 직후 저장해도 불포함 가격 등이 반영되도록 함
  const setFormData = useCallback((arg: typeof formData | ((prev: typeof formData) => typeof formData)) => {
    if (typeof arg === 'function') {
      const next = (arg as (prev: typeof formData) => typeof formData)(formDataRef.current)
      formDataRef.current = next
      setFormDataState(next)
    } else {
      formDataRef.current = arg
      setFormDataState(arg)
    }
  }, [])

  const syncResidentChoicesInFormState = useCallback((prev: typeof formData): typeof formData => {
    const ch = findUsResidentClassificationChoice(prev.productChoices)
    if (!ch) return prev
    const ra = { ...emptyResidentStatusAmounts(), ...(prev.residentStatusAmounts || {}) }
    const state: ResidentLineState = {
      undecidedResidentCount: prev.undecidedResidentCount || 0,
      usResidentCount: prev.usResidentCount || 0,
      nonResidentCount: prev.nonResidentCount || 0,
      nonResidentUnder16Count: prev.nonResidentUnder16Count || 0,
      nonResidentWithPassCount: prev.nonResidentWithPassCount || 0,
      nonResidentPurchasePassCount: prev.nonResidentPurchasePassCount || 0,
      residentStatusAmounts: ra,
    }
    const rows = buildResidentChoiceRowsFromLineState(ch, state, false)
    const { selectedChoices, choicesTotal } = mergeResidentRowsIntoSelectedChoices(
      prev.productChoices,
      Array.isArray(prev.selectedChoices) ? prev.selectedChoices : [],
      rows
    )
    return { ...prev, selectedChoices, choicesTotal, residentStatusAmounts: ra }
  }, [])

  const applyResidentParticipantPatch = useCallback(
    (patch: Record<string, unknown>) => {
      setFormData((prev) => {
        const merged = { ...prev, ...patch } as typeof formData
        if (patch.residentStatusAmounts && typeof patch.residentStatusAmounts === 'object') {
          merged.residentStatusAmounts = {
            ...emptyResidentStatusAmounts(),
            ...(prev.residentStatusAmounts || {}),
            ...(patch.residentStatusAmounts as Record<string, number>),
          }
        }
        return syncResidentChoicesInFormState(merged)
      })
    },
    [setFormData, syncResidentChoicesInFormState]
  )

  /** 상품 초이스(모달)에서 거주 그룹 행이 있을 때만 예약 정보 거주 칸으로 반영 (빈 배열이면 DB 로드 직후 덮어쓰기 방지) */
  useEffect(() => {
    const ch = findUsResidentClassificationChoice(formData.productChoices)
    if (!ch) return
    const arr = (formData.selectedChoices || []).filter((s) => s.choice_id === ch.id)
    if (arr.length === 0) return
    const parsed = parseResidentLineStateFromSelections(
      formData.productChoices,
      formData.selectedChoices || []
    )
    if (!parsed) return
    setFormData((prev) => {
      const cur: ResidentLineState = {
        undecidedResidentCount: prev.undecidedResidentCount || 0,
        usResidentCount: prev.usResidentCount || 0,
        nonResidentCount: prev.nonResidentCount || 0,
        nonResidentUnder16Count: prev.nonResidentUnder16Count || 0,
        nonResidentWithPassCount: prev.nonResidentWithPassCount || 0,
        nonResidentPurchasePassCount: prev.nonResidentPurchasePassCount || 0,
        residentStatusAmounts: { ...emptyResidentStatusAmounts(), ...(prev.residentStatusAmounts || {}) },
      }
      if (residentLineStateEquals(cur, parsed)) return prev
      const passCovered = computePassCoveredCount(
        parsed.nonResidentWithPassCount,
        parsed.usResidentCount,
        parsed.nonResidentCount,
        parsed.nonResidentUnder16Count,
        prev.totalPeople
      )
      return {
        ...prev,
        undecidedResidentCount: parsed.undecidedResidentCount,
        usResidentCount: parsed.usResidentCount,
        nonResidentCount: parsed.nonResidentCount,
        nonResidentUnder16Count: parsed.nonResidentUnder16Count,
        nonResidentWithPassCount: parsed.nonResidentWithPassCount,
        nonResidentPurchasePassCount: parsed.nonResidentPurchasePassCount,
        residentStatusAmounts: parsed.residentStatusAmounts,
        passCoveredCount: passCovered,
      }
    })
  }, [formData.selectedChoices, formData.productChoices, setFormData])

  useEffect(() => {
    setFormData((prev) => {
      const nextPc = computePassCoveredCount(
        prev.nonResidentWithPassCount || 0,
        prev.usResidentCount || 0,
        prev.nonResidentCount || 0,
        prev.nonResidentUnder16Count || 0,
        prev.totalPeople || 0
      )
      if (nextPc === (prev.passCoveredCount || 0)) return prev
      return { ...prev, passCoveredCount: nextPc }
    })
  }, [
    formData.totalPeople,
    formData.nonResidentWithPassCount,
    formData.usResidentCount,
    formData.nonResidentCount,
    formData.nonResidentUnder16Count,
    setFormData,
  ])

  // 무한 렌더링 방지를 위한 ref
  const prevPricingParams = useRef<{productId: string, tourDate: string, channelId: string, variantKey: string, selectedChoicesKey: string} | null>(null)
  /** loadPricingInfo 중첩 호출 시 마지막 로드만 완료 처리 */
  const pricingLoadGenerationRef = useRef(0)
  const prevCouponParams = useRef<{productId: string, tourDate: string, channelId: string} | null>(null)
  /** 이메일 금액 기준 쿠폰 자동 적용이 이미 이 입력 조합에 대해 끝났는지 (중복 setFormData 방지) */
  const emailCouponApplyRef = useRef<string>('')
  /** Viator Net Rate 자동 쿠폰: 사용자가 쿠폰 드롭다운을 건드리면 재강제하지 않음 (수수료 재계산 effect와 충돌 방지) */
  const viatorImportCouponUserAdjustedRef = useRef(false)
  /** 예약 가져오기 쿠폰 매칭을 다른 가격 useEffect 이후로 미루는 타이머 */
  const importEmailCouponRafRef = useRef<number | null>(null)
  const importEmailCouponTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevProductId = useRef<string | null>(null)
  /** 예약 가져오기: 이메일에서 추출한 초이스 힌트가 나중에 갱신(재파싱 등)되어도 동일 상품에서 초이스를 다시 적용하기 위한 키 */
  const importChoiceHintKey = useMemo(
    () =>
      `${(initialChoiceOptionNamesFromImport ?? []).join('\u001e')}\u001f${(initialChoiceUndecidedGroupNamesFromImport ?? []).join('\u001e')}`,
    [initialChoiceOptionNamesFromImport, initialChoiceUndecidedGroupNamesFromImport]
  )

  useEffect(() => {
    const cid = formData.channelId
    const pid = formData.productId
    if (!cid || !pid) {
      setChannelProductVariantsForDisplay([])
      return
    }
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('channel_products')
        .select('variant_key, variant_name_ko, variant_name_en')
        .eq('channel_id', cid)
        .eq('product_id', pid)
        .eq('is_active', true)
        .order('variant_key')
      if (cancelled) return
      if (error) {
        setChannelProductVariantsForDisplay([])
        return
      }
      const rows = (data || []).map(
        (item: { variant_key?: string; variant_name_ko?: string | null; variant_name_en?: string | null }) => ({
          variant_key: item.variant_key || 'default',
          variant_name_ko: item.variant_name_ko ?? null,
          variant_name_en: item.variant_name_en ?? null,
        })
      )
      setChannelProductVariantsForDisplay(rows)

      // 예약 가져오기: 동적가격 variant_key는 variant_… 실키 — fetch 직후 맞춰야 가격 effect가 시맨틱(all_inclusive)으로 먼저 조회하지 않음
      if (!cancelled && isImportMode && rows.length > 0) {
        const rawSemantic =
          resolveImportChannelVariantKey(
            String(initialVariantKeyFromImport ?? '').trim() ||
              String((reservation as { variant_key?: string })?.variant_key ?? '').trim() ||
              undefined,
            initialChannelVariantLabelFromImport
          )?.trim() ||
          String(initialVariantKeyFromImport ?? '').trim() ||
          String((reservation as { variant_key?: string })?.variant_key ?? '').trim() ||
          ''
        const dbKey = mapSemanticVariantToChannelProductKey(
          rows,
          rawSemantic,
          initialChannelVariantLabelFromImport
        )
        if (dbKey) {
          setFormData((prev) => {
            const cur = prev.variantKey || ''
            if (cur === dbKey) return prev
            const curInRows = rows.some((r) => r.variant_key === cur)
            const c = canonicalVariantKey(cur)
            const semanticOnly = c === 'all_inclusive' || c === 'with_exclusions'
            if (curInRows && !semanticOnly) return prev
            return { ...prev, variantKey: dbKey }
          })
          prevPricingParams.current = null
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    formData.channelId,
    formData.productId,
    isImportMode,
    initialVariantKeyFromImport,
    initialChannelVariantLabelFromImport,
    (reservation as { variant_key?: string })?.variant_key,
    setFormData,
  ])

  const selectedChannelDisplayTitle = useMemo(() => {
    if (!formData.channelId) return ''
    const ch = channels.find((c: { id: string }) => c.id === formData.channelId)
    if (!ch) return formData.channelId
    const vk = formData.variantKey || 'default'
    const prettyFromKey = (key: string) =>
      key
        .split('_')
        .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''))
        .join(' ')
    const variantKeys = channelProductVariantsForDisplay.map((v) => v.variant_key)
    const vkRow = channelProductsIncludeVariantKey(variantKeys, vk) ?? vk
    const pv = channelProductVariantsForDisplay.find((v) => v.variant_key === vkRow)
    const dbLabel = (pv?.variant_name_ko || pv?.variant_name_en)?.trim()
    if (dbLabel) return `${ch.name} - ${dbLabel}`
    // variant 목록 로드 전에는 import 라벨만 쓰면 실제 variantKey(with_exclusions)와 어긋나 "All Inclusive" 버튼 + 모달 "With Exclusions" 불일치가 남
    if (channelProductVariantsForDisplay.length === 0 && vk && vk !== 'default') {
      return `${ch.name} - ${prettyFromKey(vk)}`
    }
    if (isImportMode && initialChannelVariantLabelFromImport?.trim()) {
      return `${ch.name} - ${initialChannelVariantLabelFromImport.trim()}`
    }
    if (vk && vk !== 'default') {
      return `${ch.name} - ${prettyFromKey(vk)}`
    }
    return ch.name
  }, [
    formData.channelId,
    formData.variantKey,
    channelProductVariantsForDisplay,
    channels,
    isImportMode,
    initialChannelVariantLabelFromImport,
  ])

  const showResidentStatusSection = useMemo(
    () =>
      productShowsResidentStatusSectionByCode(
        (
          products.find((p: { id: string }) => p.id === formData.productId) as
            | { product_code?: string | null }
            | undefined
        )?.product_code ?? null
      ),
    [products, formData.productId]
  )

  // 데이터베이스에서 불러온 commission_amount 값을 추적 (자동 계산에 의해 덮어쓰이지 않도록)
  const loadedCommissionAmount = useRef<number | null>(null)
  
  // 중복 로딩 방지를 위한 ref
  const loadedReservationChoicesRef = useRef<string | null>(null) // reservationId 추적
  const loadedReservationDataRef = useRef<string | null>(null) // reservationId 추적
  const loadedProductChoicesRef = useRef<Set<string>>(new Set()) // productId 추적



  // 고객 선택 시 고객 정보 자동 로드
  useEffect(() => {
    if (formData.customerId && customers.length > 0) {
      const customer = customers.find(c => c.id === formData.customerId)
      if (customer) {
        setShowNewCustomerForm(false) // 고객을 선택하면 새 고객 입력 모드 해제
        setFormData(prev => ({
          ...prev,
          customerName: customer.name || '',
          customerPhone: customer.phone || '',
          customerEmail: customer.email || '',
          customerAddress: (customer as any)?.address || '',
          customerLanguage: (() => {
            const lang = (customer as any)?.language
            if (lang === 'EN' || lang === 'en' || lang === '영어') return 'EN'
            if (lang === 'KR' || lang === 'ko' || lang === '한국어') return 'KR'
            return lang || 'KR'
          })(),
          customerEmergencyContact: (customer as any)?.emergency_contact || '',
          customerSpecialRequests: (customer as any)?.special_requests || '',
          customerChannelId: (customer as any)?.channel_id || '',
          customerStatus: (customer as any)?.status || 'active'
        }))
      }
    }
  }, [formData.customerId, customers])

  // 외부 클릭 감지하여 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('.pickup-hotel-dropdown')) {
        setFormData(prev => ({ ...prev, showPickupHotelDropdown: false }))
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const reservationId = reservation == null ? null : (reservation as any)?.id ?? (reservation as any)?.reservation_id ?? null
  const needsEditChoicesHydration = useMemo(() => {
    const r = reservation as any
    if (!r) return false
    const id = r.id ?? r.reservation_id ?? null
    if (id == null || typeof id !== 'string' || id.startsWith('import-')) return false
    const keys = Object.keys(r)
    if (keys.length === 1 && keys[0] === 'id') return false
    return !!(r.product_id || r.productId)
  }, [
    reservation,
    (reservation as any)?.id,
    (reservation as any)?.reservation_id,
    (reservation as any)?.product_id,
    (reservation as any)?.productId,
  ])

  useEffect(() => {
    if (!needsEditChoicesHydration) {
      setEditPricingChoicesReady(true)
      return
    }
    setEditPricingChoicesReady(false)
  }, [needsEditChoicesHydration, reservationId])

  useEffect(() => {
    let cancelled = false
    const getCurrentUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (cancelled || !user || error) return
        setCurrentUser(prev => (prev?.email === (user.email || '') ? prev : { email: user.email || '' }))
        if (!reservationId) {
          setFormData(prev => (prev.addedBy === (user.email || '') ? prev : { ...prev, addedBy: user.email || '' }))
        }
      } catch (error) {
        if (!cancelled && !isAbortLikeError(error)) {
          console.error('Error getting current user:', error)
        }
      }
    }
    getCurrentUser()
    return () => { cancelled = true }
  }, [reservationId])

  useEffect(() => {
    if (!authUser?.email) {
      setCurrentTeamProfile(null)
      return
    }

    let cancelled = false
    void (async () => {
      const email = authUser.email.trim().toLowerCase()
      const { data } = await (supabase as any)
        .from('team')
        .select('email, name_ko, name_en, nick_name, position')
        .ilike('email', email)
        .maybeSingle()

      if (cancelled) return
      setCurrentTeamProfile({
        email,
        name: data?.name_ko || data?.name_en || authUser.name || email,
        nickName: data?.nick_name || data?.name_ko || authUser.name || email,
        position: data?.position ?? userPosition ?? null,
      })
    })()

    return () => {
      cancelled = true
    }
  }, [authUser?.email, authUser?.name, userPosition])

  // 예약 가져오기(import) 모드: initialDataFromImport가 들어오면 고객/언어 필드 동기화
  useEffect(() => {
    if (!isImportMode || !initialDataFromImport) return
    const next: Partial<typeof formData> = {}
    if (initialDataFromImport.customer_name != null && initialDataFromImport.customer_name !== '') next.customerName = initialDataFromImport.customer_name
    if (initialDataFromImport.customer_email != null && initialDataFromImport.customer_email !== '') next.customerEmail = initialDataFromImport.customer_email
    if (initialDataFromImport.customer_phone != null && initialDataFromImport.customer_phone !== '') next.customerPhone = initialDataFromImport.customer_phone
    if (initialDataFromImport.emergency_contact != null && initialDataFromImport.emergency_contact !== '') next.customerEmergencyContact = initialDataFromImport.emergency_contact
    if (initialDataFromImport.customer_language != null && initialDataFromImport.customer_language !== '') {
      const l = (initialDataFromImport.customer_language || '').trim()
      next.customerLanguage = (l === 'EN' || l === 'en' || l === 'English' || l === '영어' || /^english\b/i.test(l)) ? 'EN' : (l === 'KR' || l === 'ko' || l === '한국어' || /^korean\b|^한국어/i.test(l)) ? 'KR' : (l.length === 2 ? l.toUpperCase() : l)
    }
    if (Object.keys(next).length === 0) return
    setFormData(prev => ({ ...prev, ...next, customerSearch: next.customerName ?? prev.customerSearch }))
  }, [isImportMode, initialDataFromImport?.customer_name, initialDataFromImport?.customer_email, initialDataFromImport?.customer_phone, initialDataFromImport?.emergency_contact, initialDataFromImport?.customer_language])

  // 이메일 가져오기: 상품이 바뀌면 초이스 하이드레이션을 다시 기다림 (가격은 그 이후에만 로드)
  useEffect(() => {
    if (!isImportMode) {
      setImportChoicesHydratedProductId(null)
      return
    }
    setImportChoicesHydratedProductId(null)
  }, [isImportMode, formData.productId])

  // 가격 정보(판매가·불포함)는 이메일이 아닌 동적가격(상품·초이스·채널·날짜)에서만 로드됨 → initialNotIncludedAmountFromImport 사용 안 함

  // 예약 가져오기(import) 모드: 상위에서 전달한 reservation(tour_date, adults, product_id 등) 변경 시 폼 필드 동기화
  useEffect(() => {
    if (!isImportMode || !reservation) return
    const rez = reservation as RezLike
    const next: Partial<typeof formData> = {}
    if (rez.tour_date) {
      const nd = normalizeTourDateForDb(String(rez.tour_date))
      next.tourDate = nd || String(rez.tour_date)
    }
    if (rez.tour_time != null) next.tourTime = timeToHHmm(String(rez.tour_time)) || ''
    if (rez.adults != null) {
      next.adults = rez.adults
      next.pricingAdults = rez.adults
    }
    if (rez.child != null) next.child = rez.child
    if (rez.infant != null) next.infant = rez.infant
    if ((rez as any).total_people != null) next.totalPeople = (rez as any).total_people
    if (rez.product_id) next.productId = rez.product_id
    if (rez.channel_rn != null) {
      const rn = String(rez.channel_rn).trim()
      if (rn && rn.toLowerCase() !== 'id') next.channelRN = rn
    }
    if (rez.pickup_hotel != null) {
      const hid = String(rez.pickup_hotel)
      next.pickUpHotel = hid
      const matched = pickupHotels.find(h => h.id === hid)
      if (matched) {
        next.pickUpHotelSearch = `${matched.hotel} - ${matched.pick_up_location}`
      } else if (hid) {
        next.pickUpHotelSearch = hid
      }
    }
    if (rez.event_note != null) next.eventNote = rez.event_note

    const parentChannelId = rez.channel_id ? String(rez.channel_id) : ''
    const tryApplyParentChannelOnce =
      Boolean(parentChannelId) && !emailImportChannelParentSyncedRef.current

    if (Object.keys(next).length === 0 && !tryApplyParentChannelOnce) return

    setFormData((prev) => {
      const merged = { ...prev, ...next }
      if (!tryApplyParentChannelOnce) return merged
      emailImportChannelParentSyncedRef.current = true
      if (!prev.channelId) return { ...merged, channelId: parentChannelId }
      return merged
    })
  }, [
    isImportMode,
    pickupHotels,
    (reservation as any)?.tour_date,
    (reservation as any)?.tour_time,
    (reservation as any)?.adults,
    (reservation as any)?.child,
    (reservation as any)?.infant,
    (reservation as any)?.total_people,
    (reservation as any)?.product_id,
    (reservation as any)?.channel_id,
    (reservation as any)?.channel_rn,
    (reservation as any)?.pickup_hotel,
    (reservation as any)?.event_note,
  ])

  // initialCustomerId가 있고 reservation이 null일 때 고객 정보를 초기값으로 설정
  useEffect(() => {
    if (!reservation && initialCustomerId && customers.length > 0) {
      const customer = customers.find(c => c.id === initialCustomerId)
      if (customer) {
        const customerData = customer as any // eslint-disable-line @typescript-eslint/no-explicit-any
        setFormData((prev: typeof formData) => ({
          ...prev,
          customerId: customer.id,
          customerSearch: customer.name,
          customerName: customer.name,
          customerPhone: customer.phone || '',
          customerEmail: customer.email || '',
          customerAddress: (customerData.address as string | undefined) || '',
          customerLanguage: customer.language || 'KR',
          customerEmergencyContact: (customerData.emergency_contact as string | undefined) || '',
          customerSpecialRequests: (customerData.special_requests as string | undefined) || '',
          channelId: (customerData.channel_id as string | undefined) || prev.channelId || '',
          addedBy: customer.name
        }))
      }
    }
  }, [initialCustomerId, reservation, customers])

  // 밤도깨비 그랜드캐년 일출 투어 등: 선택 상품에 기본 투어 시간이 있으면 00:00 AM 적용 (채널 무관)
  useEffect(() => {
    if (!formData.productId || !products?.length) return
    const product = products.find((p: { id: string }) => p.id === formData.productId) as { name_ko?: string | null; name?: string } | undefined
    const nameKo = (product?.name_ko ?? '').trim()
    const nameEn = (product?.name ?? '').trim()
    const defaultTime = PRODUCT_DEFAULT_TOUR_TIMES[nameKo] ?? PRODUCT_DEFAULT_TOUR_TIMES[nameEn]
    if (defaultTime) {
      setFormData(prev => (prev.tourTime === defaultTime ? prev : { ...prev, tourTime: defaultTime }))
    }
  }, [formData.productId, products])

  // reservation_id로 reservations 테이블에서 직접 데이터 가져오기
  useEffect(() => {
    const fetchReservationData = async () => {
      if (!reservation?.id) {
        console.log('ReservationForm: reservation 또는 reservation.id가 없음:', {
          hasReservation: !!reservation,
          reservationId: reservation?.id,
          reservationKeys: reservation ? Object.keys(reservation) : []
        })
        loadedReservationDataRef.current = null
        return
      }
      
      // 이미 로드된 reservation이면 스킵
      if (loadedReservationDataRef.current === reservation.id) {
        console.log('ReservationForm: 이미 로드된 reservation 데이터, 스킵:', reservation.id)
        return
      }
      // 예약 가져오기(이메일)에서 열었을 때: DB 조회 없이 전달된 rez 초기값만 사용
      if (typeof reservation.id === 'string' && reservation.id.startsWith('import-')) {
        loadedReservationDataRef.current = reservation.id
        return
      }
      
      // 새 예약 모드 확인: reservation에 id만 있고 다른 필드가 없으면 새 예약
      const reservationKeys = Object.keys(reservation)
      const isNewReservation = reservationKeys.length === 1 && reservationKeys[0] === 'id'
      
      if (isNewReservation) {
        console.log('ReservationForm: 새 예약 모드 감지, 데이터베이스 조회 건너뜀:', {
          reservationId: reservation.id,
          reservationKeys
        })
        loadedReservationDataRef.current = reservation.id
        return
      }
      
      loadedReservationDataRef.current = reservation.id

      console.log('ReservationForm: reservation_id로 데이터 조회 시작:', {
        reservationId: reservation.id,
        reservationIdType: typeof reservation.id,
        reservationIdLength: reservation.id?.length,
        reservationIdValue: reservation.id,
        allReservationFields: Object.keys(reservation).map(key => ({
          key,
          value: (reservation as any)[key],
          type: typeof (reservation as any)[key]
        }))
      })
      
      try {
        console.log('ReservationForm: Supabase 쿼리 시작 - reservations 테이블 조회')
        
        // reservations 테이블에서 customer_id 등 정보 조회
        const { data: reservationData, error: reservationError } = await (supabase as any)
          .from('reservations')
          .select('id, customer_id, product_id, status, choices')
          .eq('id', reservation.id)
          .single()

        if (reservationError) {
          // PGRST116은 "no rows returned" 오류 - 새 예약 모드일 수 있음
          if (reservationError.code === 'PGRST116') {
            console.log('ReservationForm: 예약 데이터가 없음 (새 예약 모드일 수 있음):', reservation.id)
            return
          }
          if (!isAbortLikeError(reservationError)) {
            console.error('ReservationForm: 예약 데이터 조회 오류:', reservationError)
            console.log('예약 오류 상세:', {
              message: reservationError.message,
              details: reservationError.details,
              hint: reservationError.hint,
              code: reservationError.code
            })
          }
          return
        }

        if (reservationData) {
          console.log('ReservationForm: 예약 데이터 조회 성공:', reservationData)
          
          // reservation_customers 테이블에서 거주 상태별 인원 수 가져오기
          let usResidentCount = 0
          let nonResidentCount = 0
          let nonResidentUnder16Count = 0
          let nonResidentWithPassCount = 0
          let nonResidentPurchasePassCount = 0
          let passCoveredCount = 0
          
          try {
            const { data: reservationCustomers, error: rcError } = await supabase
              .from('reservation_customers')
              .select('resident_status, pass_covered_count')
              .eq('reservation_id', reservation.id)
            
            if (!rcError && reservationCustomers && reservationCustomers.length > 0) {
              reservationCustomers.forEach((rc: any) => {
                if (rc.resident_status === 'us_resident') {
                  usResidentCount++
                } else if (rc.resident_status === 'non_resident') {
                  nonResidentCount++
                } else if (rc.resident_status === 'non_resident_under_16') {
                  nonResidentUnder16Count++
                } else if (rc.resident_status === 'non_resident_with_pass') {
                  nonResidentWithPassCount++
                  // 각 패스는 4인을 커버하므로 합산
                  if (rc.pass_covered_count) {
                    passCoveredCount += rc.pass_covered_count
                  }
                } else if (rc.resident_status === 'non_resident_purchase_pass') {
                  nonResidentPurchasePassCount++
                }
              })
            }
          } catch (rcError) {
            if (!isAbortLikeError(rcError)) {
              console.error('ReservationForm: reservation_customers 조회 오류:', rcError)
            }
          }
          
          // customer_id로 customers 테이블에서 고객 정보 조회
          if (reservationData.customer_id) {
            const { data: customerData, error: customerError } = await (supabase as any)
              .from('customers')
              .select('id, name, email, phone')
              .eq('id', reservationData.customer_id)
              .single()

            if (customerError) {
              if (!isAbortLikeError(customerError)) {
                console.error('ReservationForm: 고객 데이터 조회 오류:', customerError)
                console.log('고객 오류 상세:', {
                  message: customerError.message,
                  details: customerError.details,
                  hint: customerError.hint,
                  code: customerError.code
                })
              }
            } else if (customerData) {
              console.log('ReservationForm: 고객 데이터 조회 성공:', customerData)
              
              // formData 업데이트 (기본 필드와 choices 데이터, 거주 상태별 인원 수)
              setFormData(prev => ({
                ...prev,
                customerId: customerData.id,
                customerSearch: customerData.name || '',
                productId: reservationData.product_id || '',
                status: reservationData.status || 'pending',
                usResidentCount,
                nonResidentCount,
                nonResidentWithPassCount,
                nonResidentUnder16Count,
                nonResidentPurchasePassCount,
                passCoveredCount
              }))
              
              // 상품 ID가 설정된 후 초이스 로드 (편집 모드에서는 loadReservationChoicesFromNewTable이 이미 처리했을 수 있으므로 스킵)
              // loadReservationChoicesFromNewTable이 이미 productChoices를 로드했으면 스킵
              // 주의: fetchReservationData는 loadReservationChoicesFromNewTable보다 먼저 실행될 수 있으므로
              // 여기서는 productChoices 로드를 하지 않고, loadReservationChoicesFromNewTable에 맡김
              // (편집 모드에서는 loadReservationChoicesFromNewTable이 productChoices와 selectedChoices를 모두 로드함)
              
              // choices 데이터가 있으면 복원
              if (reservationData.choices) {
                console.log('ReservationForm: fetchReservationData에서 choices 데이터 발견:', reservationData.choices)
                
                // choices 복원 로직 실행
                if (reservationData.choices.required && Array.isArray(reservationData.choices.required)) {
                  const selectedChoices: Array<{
                    choice_id: string
                    option_id: string
                    quantity: number
                    total_price: number
                  }> = []
                  const choicesData: Record<string, any> = {}
                  const quantityBasedChoices: Record<string, any[]> = {}
                  
                  const productChoices: any[] = []
                  
                  reservationData.choices.required.forEach((choice: any) => {
                    console.log('ReservationForm: fetchReservationData에서 choice 처리 중:', choice)
                    
                    // choice_id와 option_id가 직접 있는 경우 (새로운 형식)
                    if (choice.choice_id && choice.option_id) {
                      console.log('ReservationForm: fetchReservationData에서 직접 choice_id/option_id 발견:', {
                        choice_id: choice.choice_id,
                        option_id: choice.option_id,
                        quantity: choice.quantity,
                        total_price: choice.total_price
                      })
                      
                      selectedChoices.push({
                        choice_id: choice.choice_id,
                        option_id: choice.option_id,
                        quantity: choice.quantity || 1,
                        total_price: choice.total_price || 0,
                        ...(choice.option?.option_key || choice.option_key ? { option_key: choice.option?.option_key || choice.option_key } : {}),
                        ...(choice.option?.name_ko || choice.option?.option_name_ko || choice.option_name_ko ? { option_name_ko: choice.option?.name_ko || choice.option?.option_name_ko || choice.option_name_ko } : {})
                      } as any)
                      
                      // 가격 정보는 나중에 productChoices에서 가져올 수 있음
                      if (choice.option && choice.option.adult_price !== undefined) {
                        choicesData[choice.option_id] = {
                          adult_price: choice.option.adult_price || 0,
                          child_price: choice.option.child_price || 0,
                          infant_price: choice.option.infant_price || 0
                        }
                      }
                    }
                    // 수량 기반 다중 선택인 경우
                    else if (choice.type === 'multiple_quantity' && choice.selections) {
                      console.log('ReservationForm: fetchReservationData에서 수량 기반 다중 선택 복원:', choice.selections)
                      quantityBasedChoices[choice.id] = choice.selections
                      
                      // 각 선택된 옵션의 가격 정보도 복원
                      choice.selections.forEach((selection: any) => {
                        if (selection.option) {
                          choicesData[selection.option.id] = {
                            adult_price: selection.option.adult_price || 0,
                            child_price: selection.option.child_price || 0,
                            infant_price: selection.option.infant_price || 0
                          }
                        }
                      })
                    }
                    // 기존 단일 선택인 경우
                    else if (choice.options && Array.isArray(choice.options)) {
                      // productChoices에 모든 옵션 추가
                      choice.options.forEach((option: any) => {
                        productChoices.push({
                          id: option.id,
                          name: option.name,
                          name_ko: option.name_ko,
                          description: choice.description,
                          adult_price: option.adult_price || 0,
                          child_price: option.child_price || 0,
                          infant_price: option.infant_price || 0,
                          is_default: option.is_default || false
                        })
                      })
                      
                      // is_default가 true인 옵션 찾기
                      const selectedOption = choice.options.find((option: any) => option.is_default === true)
                      console.log('ReservationForm: fetchReservationData에서 선택된 옵션:', selectedOption)
                      
                      if (selectedOption) {
                        selectedChoices.push({
                          choice_id: choice.id,
                          option_id: selectedOption.id,
                          quantity: 1,
                          total_price: selectedOption.adult_price || 0,
                          ...(selectedOption.option_key || selectedOption.key ? { option_key: selectedOption.option_key || selectedOption.key } : {}),
                          ...(selectedOption.name_ko || selectedOption.option_name_ko || selectedOption.name ? { option_name_ko: selectedOption.name_ko || selectedOption.option_name_ko || selectedOption.name } : {})
                        } as any)
                        
                        choicesData[selectedOption.id] = {
                          adult_price: selectedOption.adult_price || 0,
                          child_price: selectedOption.child_price || 0,
                          infant_price: selectedOption.infant_price || 0
                        }
                      }
                    }
                  })
                  
                  // 수량 기반 초이스 총 가격 계산
                  const quantityBasedChoiceTotal = Object.values(quantityBasedChoices).reduce((total, choiceSelections) => {
                    if (Array.isArray(choiceSelections)) {
                      return total + choiceSelections.reduce((choiceTotal, selection) => {
                        return choiceTotal + (selection.total_price || 0)
                      }, 0)
                    }
                    return total
                  }, 0)
                  
                  console.log('ReservationForm: fetchReservationData에서 복원된 choices:', {
                    selectedChoices,
                    choicesData,
                    productChoices,
                    quantityBasedChoices,
                    quantityBasedChoiceTotal
                  })
                  
                  setFormData(prev => {
                    // loadReservationChoicesFromNewTable에서 이미 selectedChoices를 로드했으면 덮어쓰지 않음
                    const shouldKeepExistingChoices = prev.selectedChoices && prev.selectedChoices.length > 0
                    
                    console.log('ReservationForm: fetchReservationData에서 formData 업데이트', {
                      existingSelectedChoicesCount: prev.selectedChoices?.length || 0,
                      newSelectedChoicesCount: selectedChoices.length,
                      shouldKeepExistingChoices
                    })
                    
                    return { 
                      ...prev,
                      // selectedChoices는 이미 있으면 유지, 없으면 새로 설정
                      selectedChoices: shouldKeepExistingChoices ? prev.selectedChoices : selectedChoices,
                      choices: choicesData,
                      productChoices: productChoices.length > 0 ? productChoices : prev.productChoices, // productChoices도 이미 있으면 유지
                      quantityBasedChoices,
                      quantityBasedChoiceTotal
                    }
                  })
                }
              }
            }
          }
        }
      } catch (error) {
        if (!isAbortLikeError(error)) {
          console.error('ReservationForm: 데이터 조회 중 예외 발생:', error)
        }
      }
    }

    fetchReservationData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservation?.id]) // loadProductChoices는 dependency에서 제거 (내부에서 조건부 호출)

  // customers 데이터가 로드된 후 고객 이름 설정 (fallback)
  useEffect(() => {
    console.log('ReservationForm: customers 데이터 로드 확인:', {
      customersLength: customers.length,
      hasReservation: !!reservation,
      customerId: reservation?.customerId,
      customer_id: (reservation as any)?.customer_id,
      currentCustomerSearch: formData.customerSearch,
      reservationKeys: reservation ? Object.keys(reservation) : [],
      customersSample: customers.slice(0, 3).map(c => ({ id: c.id, name: c.name }))
    })
    
    // 이미 formData에 고객 정보가 있으면 건너뛰기
    if (formData.customerSearch) return
    
    if (customers.length > 0 && reservation) {
      // customerId 또는 customer_id 필드에서 고객 ID 가져오기 (fallback)
      const customerId = reservation.customerId || (reservation as any).customer_id
      console.log('ReservationForm: 사용할 고객 ID (fallback):', customerId)
      
      if (customerId) {
        const customer = customers.find(c => c.id === customerId)
        console.log('ReservationForm: 찾은 고객 (fallback):', customer)
        console.log('ReservationForm: 고객 이름 (fallback):', customer?.name || '이름 없음')
        
        if (customer && customer.name) {
          console.log('ReservationForm: 고객 이름 설정 (fallback):', customer.name)
          setFormData(prev => ({
            ...prev,
            customerSearch: customer.name
          }))
        }
      }
    }
  }, [customers, reservation?.id]) // formData.customerSearch 제거하여 무한 루프 방지

  // 새로운 reservation_choices 테이블에서 초이스 데이터 로드 (카드뷰와 동일한 로직)
  const loadReservationChoicesFromNewTable = useCallback(
    async (
      reservationId: string,
      productId?: string,
      reservationChoicesJson?: unknown | null,
      loadKeyForApplyGuard?: string | null,
      partyForUsClassDefault?: {
        adults?: number | null | undefined
        child?: number | null | undefined
        infant?: number | null | undefined
        total_people?: number | null | undefined
      } | null
    ) => {
    const capturedLoadKey = loadKeyForApplyGuard ?? null
    try {
      console.log('ReservationForm: 초이스 데이터 로드 시작:', { reservationId, productId, hasChoicesJson: !!reservationChoicesJson })
      
      // 1. productId가 있으면 모든 product_choices 먼저 로드 (안정적인 식별자 포함)
      // productId가 없으면 reservation_choices에서 product_id를 가져올 수 있음
      let allProductChoices: any[] = []
      let actualProductId = productId
      
      if (productId) {
        const { data: productChoicesData, error: productChoicesError } = await supabase
          .from('product_choices')
          .select(`
            id,
            choice_group,
            choice_group_ko,
            choice_type,
            is_required,
            min_selections,
            max_selections,
            sort_order,
            options:choice_options (
              id,
              option_key,
              option_name,
              option_name_ko,
              adult_price,
              child_price,
              infant_price,
              capacity,
              is_default,
              is_active,
              sort_order
            )
          `)
          .eq('product_id', productId)
          .order('sort_order')

        if (productChoicesError) {
          if (!isAbortLikeError(productChoicesError)) {
            console.error('ReservationForm: 상품 초이스 로드 오류:', productChoicesError)
          }
        } else {
          allProductChoices = productChoicesData || []
          console.log('ReservationForm: 상품 초이스 로드 완료:', allProductChoices.length, '개')
        }
      }

      // 2. reservation_choices에서 선택된 초이스 가져오기 (마이그레이션 전/후 모두 지원)
      const { data: reservationChoicesData, error: reservationChoicesError } = await supabase
        .from('reservation_choices')
        .select(`
          choice_id,
          option_id,
          quantity,
          total_price,
          choice_options!inner (
            id,
            option_key,
            option_name,
            option_name_ko,
            adult_price,
            child_price,
            infant_price,
            product_choices!inner (
              id,
              choice_group_ko,
              product_id
            )
          )
        `)
        .eq('reservation_id', reservationId)
      
      // productId가 없고 reservation_choices에서 product_id를 가져올 수 있으면 사용
      if (!actualProductId && reservationChoicesData && reservationChoicesData.length > 0) {
        const firstChoice = reservationChoicesData[0] as any
        if (firstChoice.choice_options?.product_choices?.product_id) {
          actualProductId = firstChoice.choice_options.product_choices.product_id
          console.log('ReservationForm: reservation_choices에서 product_id 발견:', actualProductId)
        }
      }
      
      // productId를 찾았으면 product_choices 로드
      if (actualProductId && allProductChoices.length === 0) {
        const { data: productChoicesData, error: productChoicesError } = await supabase
          .from('product_choices')
          .select(`
            id,
            choice_group,
            choice_group_ko,
            choice_type,
            is_required,
            min_selections,
            max_selections,
            sort_order,
            options:choice_options (
              id,
              option_key,
              option_name,
              option_name_ko,
              adult_price,
              child_price,
              infant_price,
              capacity,
              is_default,
              is_active,
              sort_order
            )
          `)
          .eq('product_id', actualProductId)
          .order('sort_order')

        if (productChoicesError) {
          if (!isAbortLikeError(productChoicesError)) {
            console.error('ReservationForm: 상품 초이스 로드 오류:', productChoicesError)
          }
        } else {
          allProductChoices = productChoicesData || []
          console.log('ReservationForm: 상품 초이스 로드 완료:', allProductChoices.length, '개')
        }
      }

      if (reservationChoicesError) {
        if (!isAbortLikeError(reservationChoicesError)) {
          console.error('ReservationForm: 예약 초이스 로드 오류:', reservationChoicesError)
        }
      }

      console.log('ReservationForm: 예약 초이스 로드 완료:', reservationChoicesData?.length || 0, '개', {
        reservationId,
        data: reservationChoicesData,
        error: reservationChoicesError
      })
      
      // 데이터가 없으면 reservations.choices JSONB 컬럼에서 확인
      let fallbackChoicesData: any[] = []
      if (!reservationChoicesData || reservationChoicesData.length === 0) {
        console.log('ReservationForm: reservation_choices에 데이터가 없음, reservations.choices 확인')
        
        const rcj = reservationChoicesJson
        if (rcj && typeof rcj === 'object' && 'required' in (rcj as object)) {
          console.log('ReservationForm: reservations.choices에서 데이터 발견:', rcj)
          
          const required = (rcj as { required?: unknown }).required
          if (required && Array.isArray(required)) {
            const UNDECIDED_FALLBACK = '__undecided__'
            ;(required as any[]).forEach((choice: any) => {
              // 저장 시 형식: { choice_id, option_id, quantity, total_price } (미정은 option_id __undecided__)
              if (choice.choice_id && choice.option_id) {
                if (String(choice.option_id) === UNDECIDED_FALLBACK) {
                  fallbackChoicesData.push({
                    choice_id: choice.choice_id,
                    option_id: UNDECIDED_FALLBACK,
                    option_key: UNDECIDED_FALLBACK,
                    option_name_ko: '미정',
                    quantity: choice.quantity ?? 1,
                    total_price: choice.total_price ?? 0
                  })
                } else {
                  fallbackChoicesData.push({
                    choice_id: choice.choice_id,
                    option_id: choice.option_id,
                    option_key: choice.option_key || '',
                    option_name_ko: choice.option_name_ko || '',
                    quantity: choice.quantity ?? 1,
                    total_price: choice.total_price ?? 0
                  })
                }
                return
              }
              if (choice.options && Array.isArray(choice.options)) {
                const selectedOption = choice.options.find((option: any) => option.is_default === true || option.selected === true)
                if (selectedOption) {
                  const matchingChoice = allProductChoices.find((pc: any) =>
                    pc.choice_group_ko === choice.name_ko ||
                    pc.choice_group === choice.name ||
                    pc.id === choice.id
                  )
                  if (matchingChoice) {
                    const matchingOption = matchingChoice.options?.find((opt: any) =>
                      opt.id === selectedOption.id ||
                      opt.option_key === selectedOption.option_key ||
                      opt.option_name_ko === selectedOption.name_ko
                    )
                    if (matchingOption) {
                      fallbackChoicesData.push({
                        choice_id: matchingChoice.id,
                        option_id: matchingOption.id,
                        option_key: matchingOption.option_key || '',
                        option_name_ko: matchingOption.option_name_ko || '',
                        quantity: selectedOption.quantity || 1,
                        total_price: selectedOption.total_price || (matchingOption.adult_price || 0)
                      })
                    }
                  }
                }
              }
            })
            
            console.log('ReservationForm: reservations.choices에서 복원된 초이스:', fallbackChoicesData.length, '개')
          }
        }
      }

      // 3. 선택된 초이스를 allProductChoices와 매칭하여 selectedChoices 생성
      // 저장할 때와 동일한 구조로 생성 (choice_id, option_id, quantity, total_price만 포함)
      const selectedChoices: Array<{
        choice_id: string
        option_id: string
        quantity: number
        total_price: number
      }> = []

      const choicesData: Record<string, any> = {}

      // reservation_choices 데이터 또는 fallback 데이터 사용
      const choicesToProcess = (reservationChoicesData && reservationChoicesData.length > 0) 
        ? reservationChoicesData 
        : fallbackChoicesData.map(fc => ({
            choice_id: fc.choice_id,
            option_id: fc.option_id,
            quantity: fc.quantity,
            total_price: fc.total_price,
            choice_options: {
              option_key: fc.option_key || '',
              option_name_ko: fc.option_name_ko || ''
            } // fallback 데이터의 option_key와 option_name_ko 포함
          }))
      
      if (choicesToProcess && choicesToProcess.length > 0) {
        choicesToProcess.forEach((rc: any) => {
          // allProductChoices에서 매칭된 옵션 찾기
          let matchedChoice: any = null
          let matchedOption: any = null

          // 1차: option_id로 직접 매칭 시도 (빠름)
          if (allProductChoices.length > 0 && rc.option_id) {
            for (const choice of allProductChoices) {
              const option = choice.options?.find((opt: any) => opt.id === rc.option_id)
              if (option) {
                matchedChoice = choice
                matchedOption = option
                break
              }
            }
          }

          // 2차: choice_options에서 가져온 option_key로 시도 (fallback)
          if (!matchedOption && rc.choice_options?.option_key && allProductChoices.length > 0) {
            for (const choice of allProductChoices) {
              const option = choice.options?.find((opt: any) => 
                opt.option_key?.toLowerCase().trim() === rc.choice_options.option_key?.toLowerCase().trim()
              )
              if (option) {
                matchedChoice = choice
                matchedOption = option
                break
              }
            }
          }

          // 최종적으로 매칭된 값 사용 (없으면 reservation_choices의 값 사용)
          // SimpleChoiceSelector에서 필요한 필드 포함 (choice_id, option_id, option_key, option_name_ko, quantity, total_price)
          const finalChoiceId = matchedChoice?.id || rc.choice_options?.product_choices?.id || rc.choice_id
          const finalOptionId = matchedOption?.id || rc.option_id
          const finalOptionKey = matchedOption?.option_key || rc.choice_options?.option_key || ''
          const finalOptionNameKo = matchedOption?.option_name_ko || rc.choice_options?.option_name_ko || ''

          const totalPrice = rc.total_price !== undefined && rc.total_price !== null 
            ? Number(rc.total_price) 
            : 0
          console.log('ReservationForm: 초이스 로드 - total_price 확인:', {
            choice_id: finalChoiceId,
            option_id: finalOptionId,
            option_name_ko: finalOptionNameKo,
            quantity: rc.quantity || 1,
            total_price: totalPrice,
            original_total_price: rc.total_price,
            type: typeof rc.total_price
          })
          selectedChoices.push({
            choice_id: finalChoiceId,
            option_id: finalOptionId,
            quantity: rc.quantity || 1,
            total_price: totalPrice,
            ...(finalOptionKey ? { option_key: finalOptionKey } : {}),
            ...(finalOptionNameKo ? { option_name_ko: finalOptionNameKo } : {})
          } as any)

          // 가격 정보 저장
          const priceOption = matchedOption || rc.choice_options
          if (priceOption) {
            choicesData[finalOptionId] = {
              adult_price: priceOption.adult_price || 0,
              child_price: priceOption.child_price || 0,
              infant_price: priceOption.infant_price || 0
            }
          } else if (matchedOption) {
            // matchedOption이 있으면 가격 정보 저장
            choicesData[finalOptionId] = {
              adult_price: matchedOption.adult_price || 0,
              child_price: matchedOption.child_price || 0,
              infant_price: matchedOption.infant_price || 0
            }
          }
        })
      }

      // 3-2. reservations.choices.required의 "미정"(__undecided__) — 호출 시점 JSON 사용(클로저 stale 방지). JSON이 우선이면 동일 choice_id 행을 덮어씀
      const UNDECIDED_OPTION_ID = '__undecided__'
      if (reservationChoicesJson && typeof reservationChoicesJson === 'object' && Array.isArray((reservationChoicesJson as any).required)) {
        const required = (reservationChoicesJson as any).required as Array<{ choice_id: string; option_id: string; quantity?: number; total_price?: number }>
        required.forEach((item: any) => {
          if (item.option_id !== UNDECIDED_OPTION_ID || !item.choice_id) return
          const row = {
            choice_id: item.choice_id,
            option_id: UNDECIDED_OPTION_ID,
            quantity: item.quantity ?? 1,
            total_price: item.total_price ?? 0,
            option_key: UNDECIDED_OPTION_ID,
            option_name_ko: '미정'
          } as any
          const idx = selectedChoices.findIndex((c) => c.choice_id === item.choice_id)
          if (idx >= 0) selectedChoices[idx] = row
          else selectedChoices.push(row)
        })
      }

      // 3-3. 미국 거주자 구분·기타 입장료(통합 그룹) 등: 구체 옵션(미정 제외)이 없으면 항상 미정으로 표시·저장 루프와 맞춤
      const usClassChoice = findUsResidentClassificationChoice(allProductChoices)
      if (usClassChoice) {
        const rowsForGroup = selectedChoices.filter((s) => s.choice_id === usClassChoice.id)
        const hasConcreteOption = rowsForGroup.some(
          (s) => s.option_id && String(s.option_id) !== UNDECIDED_OPTION_ID
        )
        if (!hasConcreteOption) {
          const p = partyForUsClassDefault
          const sumPax =
            (Number(p?.adults) || 0) + (Number(p?.child) || 0) + (Number(p?.infant) || 0)
          const totalPeopleField = Number(p?.total_people) || 0
          const totalPax = Math.max(1, sumPax > 0 ? sumPax : totalPeopleField > 0 ? totalPeopleField : 1)
          const existingUndecided = rowsForGroup.find((s) => String(s.option_id) === UNDECIDED_OPTION_ID)
          const qty =
            existingUndecided != null
              ? Math.max(1, Number(existingUndecided.quantity) || totalPax)
              : totalPax
          const rest = selectedChoices.filter((s) => s.choice_id !== usClassChoice.id)
          selectedChoices.length = 0
          selectedChoices.push(...rest, {
            choice_id: usClassChoice.id,
            option_id: UNDECIDED_OPTION_ID,
            option_key: UNDECIDED_OPTION_ID,
            option_name_ko: '미정',
            quantity: qty,
            total_price: existingUndecided != null ? Number(existingUndecided.total_price) || 0 : 0,
          } as any)
        }
      }

      const choicesTotal = selectedChoices.reduce((sum, choice) => sum + choice.total_price, 0)

      console.log('ReservationForm: 초이스 데이터 준비 완료:', {
        selectedChoicesCount: selectedChoices.length,
        productChoicesCount: allProductChoices.length,
        choicesTotal
      })

      // 4. formData 업데이트
      console.log('ReservationForm: loadReservationChoicesFromNewTable 완료, formData 업데이트', {
        selectedChoicesCount: selectedChoices.length,
        selectedChoices: selectedChoices.map(c => ({ choice_id: c.choice_id, option_id: c.option_id })),
        productChoicesCount: allProductChoices.length,
        choicesTotal
      })

      if (
        capturedLoadKey != null &&
        loadedReservationChoicesRef.current !== capturedLoadKey
      ) {
        console.log('ReservationForm: 초이스 로드 결과 무시 (stale)', {
          capturedLoadKey,
          currentRef: loadedReservationChoicesRef.current
        })
        return
      }

      setFormData(prev => {
        const updated = {
          ...prev,
          selectedChoices,
          productChoices: allProductChoices.length > 0 ? allProductChoices : prev.productChoices, // productChoices가 있으면 사용, 없으면 기존 값 유지
          choices: choicesData,
          choicesTotal,
          quantityBasedChoices: {},
          quantityBasedChoiceTotal: 0
        }
        
        console.log('ReservationForm: formData 업데이트 완료', {
          updatedSelectedChoicesCount: updated.selectedChoices.length,
          updatedProductChoicesCount: updated.productChoices.length
        })
        
        return updated
      })

    } catch (error) {
      if (!isAbortLikeError(error)) {
        console.error('ReservationForm: 초이스 데이터 로드 중 예외:', error)
      }
    } finally {
      if (
        reservationId &&
        !String(reservationId).startsWith('import-') &&
        (capturedLoadKey == null || loadedReservationChoicesRef.current === capturedLoadKey)
      ) {
        setEditPricingChoicesReady(true)
      }
    }
    },
    [supabase, setFormData, setEditPricingChoicesReady]
  )

  // 기존 products.choices에서 초이스 데이터 로드
  const loadProductChoicesFromOldTable = useCallback(async (productId: string) => {
    try {
      console.log('ReservationForm: 기존 products.choices에서 초이스 데이터 로드 시도:', productId);
      
      type ProductChoices = {
        required?: Array<{
          id: string
          name?: string
          name_ko?: string
          type?: string
          validation?: { min_selections?: number; max_selections?: number }
          options?: Array<{
            id: string
            name?: string
            name_ko?: string
            adult_price?: number
            child_price?: number
            infant_price?: number
            capacity?: number
            is_default?: boolean
          }>
        }>
      }

      type ProductRow = {
        choices?: ProductChoices | null
      }

      const { data: product, error } = await supabase
        .from('products')
        .select('choices')
        .eq('id', productId)
        .maybeSingle();

      if (error) {
        if (!isAbortLikeError(error)) {
          console.error('ReservationForm: 기존 products.choices 로드 오류:', error);
        }
        return;
      }

      if (!product) {
        console.log('ReservationForm: 해당 상품을 찾을 수 없습니다:', productId);
        return;
      }

      const productRow = product as ProductRow | null
      if (productRow && productRow.choices) {
        const productChoicesData = productRow.choices as ProductChoices
        console.log('ReservationForm: 기존 products.choices 데이터 발견:', productChoicesData);
        
        // 기존 choices 데이터를 새로운 형식으로 변환
        type ChoiceOption = {
          id: string
          option_key: string
          option_name: string
          option_name_ko: string
          adult_price: number
          child_price: number
          infant_price: number
          capacity: number
          is_default: boolean
          is_active: boolean
          sort_order: number
        }

        type ChoiceData = {
          id: string
          choice_group: string
          choice_group_ko: string
          choice_type: string
          is_required: boolean
          min_selections: number
          max_selections: number
          sort_order: number
          options: ChoiceOption[]
        }

        const productChoices: ChoiceData[] = [];
        const selectedChoices: Array<{
          choice_id: string
          option_id: string
          quantity: number
          total_price: number
        }> = [];
        const choicesData: Record<string, any> = {};

        if (productChoicesData.required && Array.isArray(productChoicesData.required)) {
          productChoicesData.required.forEach((choice) => {
            const choiceData: ChoiceData = {
              id: choice.id,
              choice_group: choice.name || choice.id,
              choice_group_ko: choice.name_ko || choice.name || choice.id,
              choice_type: (choice.type || 'single') as 'single' | 'multiple' | 'quantity',
              is_required: true,
              min_selections: choice.validation?.min_selections || 1,
              max_selections: choice.validation?.max_selections || 10,
              sort_order: 0,
              options: []
            };

            if (choice.options && Array.isArray(choice.options)) {
              choice.options.forEach((option) => {
                const optionData: ChoiceOption = {
                  id: option.id,
                  option_key: option.id,
                  option_name: option.name || option.id,
                  option_name_ko: option.name_ko || option.name || option.id,
                  adult_price: option.adult_price || 0,
                  child_price: option.child_price || 0,
                  infant_price: option.infant_price || 0,
                  capacity: option.capacity || 1,
                  is_default: option.is_default || false,
                  is_active: true,
                  sort_order: 0
                };

                choiceData.options.push(optionData);

                // 기본값으로 선택된 옵션 추가
                if (option.is_default) {
                  selectedChoices.push({
                    choice_id: choice.id,
                    option_id: option.id,
                    quantity: 1,
                    total_price: option.adult_price || 0
                  });

                  choicesData[option.id] = {
                    adult_price: option.adult_price || 0,
                    child_price: option.child_price || 0,
                    infant_price: option.infant_price || 0
                  };
                }
              });
            }

            productChoices.push(choiceData);
          });
        }

        const choicesTotal = selectedChoices.reduce((sum, choice) => sum + choice.total_price, 0);

        console.log('ReservationForm: 기존 choices 데이터 변환 완료:', {
          productChoices,
          selectedChoices,
          choicesData,
          choicesTotal
        });

        setFormData(prev => ({
          ...prev,
          productChoices: productChoices as typeof prev.productChoices,
          selectedChoices,
          choices: choicesData,
          choicesTotal
        }));
      } else {
        console.log('ReservationForm: 기존 products.choices 데이터가 없음');
        setFormData(prev => ({
          ...prev,
          productChoices: [],
          selectedChoices: [],
          choices: {},
          choicesTotal: 0
        }));
      }
    } catch (error) {
      if (!isAbortLikeError(error)) {
        console.error('ReservationForm: 기존 products.choices 로드 중 예외:', error);
      }
    }
  }, [])

  // 기존 choices 데이터 처리 함수 (현재 사용되지 않음 - 향후 사용을 위해 주석 처리)
  /*
  const _processExistingChoicesData = useCallback((choicesData: any) => {
    console.log('ReservationForm: 기존 choices 데이터 처리 시작:', choicesData)
    
    if (choicesData.required && Array.isArray(choicesData.required)) {
      const selectedChoices: Array<{
        choice_id: string
        option_id: string
        quantity: number
        total_price: number
      }> = []
      const choicesDataRecord: Record<string, any> = {}
      const quantityBasedChoices: Record<string, any[]> = {}
      
      const productChoices: any[] = []
      
      choicesData.required.forEach((choice: any) => {
        console.log('ReservationForm: 기존 choice 처리 중:', choice)
        
        // 수량 기반 다중 선택인 경우
        if (choice.type === 'multiple_quantity' && choice.selections) {
          console.log('ReservationForm: 수량 기반 다중 선택 복원:', choice.selections)
          quantityBasedChoices[choice.id] = choice.selections
          
          // 각 선택된 옵션의 가격 정보도 복원
          choice.selections.forEach((selection: any) => {
            if (selection.option) {
              choicesDataRecord[selection.option.id] = {
                adult_price: selection.option.adult_price || 0,
                child_price: selection.option.child_price || 0,
                infant_price: selection.option.infant_price || 0
              }
            }
          })
        }
        // 기존 단일 선택인 경우
        else if (choice.options && Array.isArray(choice.options)) {
          // productChoices에 모든 옵션 추가
          choice.options.forEach((option: any) => {
            productChoices.push({
              id: option.id,
              name: option.name,
              name_ko: option.name_ko,
              description: choice.description,
              adult_price: option.adult_price || 0,
              child_price: option.child_price || 0,
              infant_price: option.infant_price || 0,
              is_default: option.is_default || false
            })
          })
          
          // is_default가 true인 옵션 찾기
          const selectedOption = choice.options.find((option: any) => option.is_default === true)
          console.log('ReservationForm: 기존 선택된 옵션:', selectedOption)
          
          if (selectedOption) {
            selectedChoices.push({
              choice_id: choice.id,
              option_id: selectedOption.id,
              quantity: 1,
              total_price: selectedOption.adult_price || 0
            })
            
            choicesDataRecord[selectedOption.id] = {
              adult_price: selectedOption.adult_price || 0,
              child_price: selectedOption.child_price || 0,
              infant_price: selectedOption.infant_price || 0
            }
          }
        }
      })
      
      // 수량 기반 초이스 총 가격 계산
      const quantityBasedChoiceTotal = Object.values(quantityBasedChoices).reduce((total, choiceSelections) => {
        if (Array.isArray(choiceSelections)) {
          return total + choiceSelections.reduce((choiceTotal, selection) => {
            return choiceTotal + (selection.total_price || 0)
          }, 0)
        }
        return total
      }, 0)
      
      const choicesTotal = selectedChoices.reduce((sum, choice) => sum + choice.total_price, 0)
      
      console.log('ReservationForm: 기존 choices 데이터 처리 완료:', {
        selectedChoices,
        choicesDataRecord,
        productChoices,
        quantityBasedChoices,
        quantityBasedChoiceTotal,
        choicesTotal
      })
      
      setFormData(prev => ({ 
        ...prev,
        selectedChoices,
        choices: choicesDataRecord,
        productChoices: productChoices,
        quantityBasedChoices,
        quantityBasedChoiceTotal,
        choicesTotal
      }))
    }
  }, [])
  */

  // 예약 데이터에서 choices 선택 복원 (편집 모드에서만)
  useEffect(() => {
    if (!reservation?.id) {
      loadedReservationChoicesRef.current = null
      return
    }

    let choicesKey = ''
    try {
      choicesKey = reservation.choices != null ? JSON.stringify(reservation.choices) : ''
    } catch {
      choicesKey = ''
    }
    const loadKey = `${reservation.id}|${choicesKey}`
    if (loadedReservationChoicesRef.current === loadKey) {
      console.log('ReservationForm: 이미 동일 예약·choices로 초이스 로드됨, 스킵:', reservation.id)
      setEditPricingChoicesReady(true)
      return
    }

    console.log('ReservationForm: choices 복원 useEffect 실행:', {
      hasReservation: !!reservation,
      hasChoices: !!(reservation && reservation.choices),
      reservationId: reservation?.id,
      choices: reservation?.choices,
      isEditMode: !!reservation?.id
    })

    loadedReservationChoicesRef.current = loadKey
    const rezParty = reservation as unknown as {
      adults?: number | null
      child?: number | null
      infant?: number | null
      total_people?: number | null
    }
    void loadReservationChoicesFromNewTable(reservation.id, reservation.productId, reservation.choices, loadKey, {
      adults: rezParty.adults ?? null,
      child: rezParty.child ?? null,
      infant: rezParty.infant ?? null,
      total_people: rezParty.total_people ?? null,
    })
  }, [reservation?.id, reservation?.choices, loadReservationChoicesFromNewTable])
  
  // 기존 choices JSONB 복원 (fallback, loadReservationChoicesFromNewTable이 실패한 경우)
  useEffect(() => {
    if (!reservation?.id) return
    
    // 이미 loadReservationChoicesFromNewTable에서 로드했으면 스킵
    if (
      typeof loadedReservationChoicesRef.current === 'string' &&
      loadedReservationChoicesRef.current.startsWith(`${reservation.id}|`)
    ) {
      return
    }
    
    if (reservation && reservation.choices && typeof reservation.choices === 'object' && 'required' in reservation.choices && Array.isArray(reservation.choices.required) && reservation.choices.required.length > 0) {
      console.log('ReservationForm: 복원할 choices 데이터:', reservation.choices)
      
      // choices.required에서 선택된 옵션 찾기
      if (reservation.choices.required && Array.isArray(reservation.choices.required)) {
        const selectedChoices: Array<{
          choice_id: string
          option_id: string
          quantity: number
          total_price: number
        }> = []
        const choicesData: Record<string, any> = {}
        const quantityBasedChoices: Record<string, any[]> = {}
        
        // productChoices도 복원
        const productChoices: any[] = []
        
        reservation.choices.required.forEach((choice: any) => {
          console.log('ReservationForm: choice 처리 중:', choice)

          if (choice.choice_id && choice.option_id) {
            selectedChoices.push({
              choice_id: choice.choice_id,
              option_id: choice.option_id,
              quantity: choice.quantity ?? 1,
              total_price: choice.total_price ?? 0,
              ...(String(choice.option_id) === '__undecided__'
                ? { option_key: '__undecided__', option_name_ko: '미정' }
                : {}),
            } as any)
            return
          }
          
          // 수량 기반 다중 선택인 경우
          if (choice.type === 'multiple_quantity' && choice.selections) {
            console.log('ReservationForm: 수량 기반 다중 선택 복원:', choice.selections)
            quantityBasedChoices[choice.id] = choice.selections
            
            // 각 선택된 옵션의 가격 정보도 복원
            choice.selections.forEach((selection: any) => {
              if (selection.option) {
                choicesData[selection.option.id] = {
                  adult_price: selection.option.adult_price || 0,
                  child_price: selection.option.child_price || 0,
                  infant_price: selection.option.infant_price || 0
                }
              }
            })
          }
          // 기존 단일 선택인 경우
          else if (choice.options && Array.isArray(choice.options)) {
            // productChoices에 모든 옵션 추가
            choice.options.forEach((option: any) => {
              productChoices.push({
                id: option.id,
                name: option.name,
                name_ko: option.name_ko,
                description: choice.description,
                adult_price: option.adult_price || 0,
                child_price: option.child_price || 0,
                infant_price: option.infant_price || 0,
                is_default: option.is_default || false
              })
            })
            
            // is_default가 true인 옵션 찾기
            const selectedOption = choice.options.find((option: any) => option.is_default === true)
            console.log('ReservationForm: 선택된 옵션:', selectedOption)
            
            if (selectedOption) {
              // 배열 형태로 추가
              selectedChoices.push({
                choice_id: choice.id,
                option_id: selectedOption.id,
                quantity: 1,
                total_price: selectedOption.adult_price || 0
              })
              
              // choices 데이터도 복원 (가격 계산을 위해)
              choicesData[selectedOption.id] = {
                adult_price: selectedOption.adult_price || 0,
                child_price: selectedOption.child_price || 0,
                infant_price: selectedOption.infant_price || 0
              }
              
              console.log('ReservationForm: selectedChoices에 추가:', choice.id, selectedOption.id)
            }
          }
        })
        
        console.log('ReservationForm: 복원된 selectedChoices:', selectedChoices)
        console.log('ReservationForm: 복원된 choices:', choicesData)
        console.log('ReservationForm: 복원된 productChoices:', productChoices)
        console.log('ReservationForm: 복원된 quantityBasedChoices:', quantityBasedChoices)
        
        // 수량 기반 초이스 총 가격 계산
        const quantityBasedChoiceTotal = Object.values(quantityBasedChoices).reduce((total, choiceSelections) => {
          if (Array.isArray(choiceSelections)) {
            return total + choiceSelections.reduce((choiceTotal, selection) => {
              return choiceTotal + (selection.total_price || 0)
            }, 0)
          }
          return total
        }, 0)
        
        setFormData(prev => ({ 
          ...prev, 
          selectedChoices,
          choices: choicesData,
          productChoices: productChoices,
          quantityBasedChoices,
          quantityBasedChoiceTotal
        }))
      }
    }
  }, [reservation?.id]) // reservation 전체가 아닌 id만 dependency로 사용

  // 새로운 간결한 초이스 시스템 사용

  // 새로운 간결한 초이스 시스템에서 상품 choices 로드 (channelId: Klook일 때 미국 거주자 구분·기타 입장료 미정 적용)
  const loadProductChoices = useCallback(async (productId: string, channelId?: string) => {
    if (!productId) {
      setFormData(prev => ({ ...prev, productChoices: [], selectedChoices: [], choicesTotal: 0 }))
      return
    }
    
    // 이미 로드된 productId면 스킵 (실제 편집 모드에서만, 예약 가져오기 import-xxx 는 제외)
    const isEditModeForChoices = !!reservation?.id && !isImportMode
    if (isEditModeForChoices && loadedProductChoicesRef.current.has(productId)) {
      console.log('ReservationForm: 이미 로드된 productChoices, 스킵:', productId)
      return
    }

    try {
      const { data, error } = await supabase
        .from('product_choices')
        .select(`
          id,
          choice_group,
          choice_group_ko,
          choice_type,
          is_required,
          min_selections,
          max_selections,
          sort_order,
          options:choice_options (
            id,
            option_key,
            option_name,
            option_name_ko,
            adult_price,
            child_price,
            infant_price,
            capacity,
            is_default,
            is_active,
            sort_order
          )
        `)
        .eq('product_id', productId)
        .order('sort_order');

      if (error) throw error;

      console.log('ReservationForm에서 로드된 초이스:', data);
      
      if (!data || data.length === 0) {
        console.log('ReservationForm: 새로운 테이블에 해당 상품의 초이스 데이터가 없음:', productId);
        // 새로운 테이블에 데이터가 없으면 기존 products.choices에서 로드 시도
        await loadProductChoicesFromOldTable(productId);
        if (isImportMode && formDataRef.current.productId === productId) {
          setImportChoicesHydratedProductId(productId)
        }
        return;
      }
      // 편집 모드가 아닌 경우에만 기본 초이스 설정 (예약 가져오기 import-xxx 는 새 예약처럼 초이스 기본값 적용)
      const defaultChoices: Array<{
        choice_id: string
        option_id: string
        quantity: number
        total_price: number
      }> = [];
      
      const importOptionNames = initialChoiceOptionNamesFromImport?.length ? initialChoiceOptionNamesFromImport.map(n => n.toLowerCase().trim()) : [];
      const importUndecidedGroups = initialChoiceUndecidedGroupNamesFromImport?.length ? new Set(initialChoiceUndecidedGroupNamesFromImport.map(g => g.trim())) : new Set<string>();
      // Klook 채널에서 온 예약: 미국 거주자 구분·기타 입장료 항상 미정
      const klookUndecidedGroups = new Set<string>(['미국 거주자 구분', '기타 입장료', '미국 거주자 구분 및 기타 입장료']);
      const effectiveUndecidedGroups = new Set(importUndecidedGroups);
      if (channelId && channels?.length) {
        const ch = channels.find((c: { id?: string; name?: string }) => c.id === channelId);
        const isKlook = ch && (String((ch as { name?: string }).name || '').toLowerCase().includes('klook') || String((ch as { id?: string }).id || '').toLowerCase() === 'klook');
        if (isKlook) klookUndecidedGroups.forEach(g => effectiveUndecidedGroups.add(g));
      }

      // 미정 기본 수량 = 총인원(성인+아동+유아, 없으면 totalPeople). 1 고정이면 거주 칸 합계와 총인원 불일치 경고만 반복됨.
      const fd = formDataRef.current
      const sumPax = (fd.adults || 0) + (fd.child || 0) + (fd.infant || 0)
      const totalPaxForUndecided = Math.max(1, sumPax > 0 ? sumPax : Number(fd.totalPeople) || 1)

      if (!isEditModeForChoices) {
        data?.forEach((choice: any) => {
          const choiceGroupKo = (choice.choice_group_ko || choice.choice_group || '').trim();
          // 미국 거주자 구분·기타 입장료: 그룹명이 정확히 일치하거나 서로 포함하면 미정(__undecided__) 기본 선택
          const isUndecidedGroup = effectiveUndecidedGroups.size > 0 && Array.from(effectiveUndecidedGroups).some(
            (g) => choiceGroupKo === g || choiceGroupKo.includes(g) || g.includes(choiceGroupKo)
          );
          if (isUndecidedGroup) {
            defaultChoices.push({
              choice_id: choice.id,
              option_id: '__undecided__',
              quantity: totalPaxForUndecided,
              total_price: 0
            });
            return;
          }
          let selectedOption: any = null;
          if (importOptionNames.length > 0 && choice.options?.length) {
            for (const name of importOptionNames) {
              selectedOption = choice.options.find((opt: any) => {
                const on = (opt.option_name || '').toLowerCase();
                const ok = (opt.option_name_ko || '').toLowerCase();
                const okey = (opt.option_key || '').toLowerCase();
                const n = name.toLowerCase();
                return on.includes(n) || n.includes(on) || ok.includes(n) || n.includes(ok) || okey.includes(n) || n.includes(okey);
              });
              if (selectedOption) break;
            }
          }
          if (!selectedOption) selectedOption = choice.options?.find((opt: any) => opt.is_default);
          if (selectedOption && selectedOption.id !== '__undecided__') {
            defaultChoices.push({
              choice_id: choice.id,
              option_id: selectedOption.id,
              quantity: 1,
              total_price: selectedOption.adult_price || 0
            });
          }
        });
      }

      const choicesTotal = defaultChoices.reduce((sum, choice) => sum + choice.total_price, 0);

      // 로드 완료 표시 (실제 편집 모드에서만 ref에 추가)
      if (isEditModeForChoices) {
        loadedProductChoicesRef.current.add(productId)
      }
      
      setFormData(prev => {
        // 편집 모드에서는 selectedChoices를 절대 덮어쓰지 않음 (loadReservationChoicesFromNewTable에서 로드될 수 있음)
        if (isEditModeForChoices) {
          console.log('ReservationForm: 편집 모드 - productChoices만 업데이트, selectedChoices 유지:', {
            prevSelectedChoicesCount: prev.selectedChoices?.length || 0,
            prevSelectedChoices: prev.selectedChoices?.map(c => ({ choice_id: c.choice_id, option_id: c.option_id })) || [],
            newProductChoicesCount: data?.length || 0,
            willKeepSelectedChoices: true
          });
          return {
            ...prev,
            productChoices: (data || []) as typeof prev.productChoices // productChoices만 업데이트하고 selectedChoices는 절대 건드리지 않음
          };
        }
        
        // 새 예약/가져오기: 동일 상품에 대해 loadProductChoices가 여러 번 호출될 때(가격 조회 후 setTimeout 등)
        // selectedChoices를 defaultChoices로 매번 덮어쓰면 미정(__undecided__) 수량 1 고정 등 사용자 입력이 사라짐 → 보존
        const prevChoices = Array.isArray(prev.selectedChoices) ? prev.selectedChoices : []
        const newChoiceIds = new Set((data || []).map((c: { id: string }) => c.id))
        const canPreserveSelected =
          prev.productId === productId &&
          prevChoices.length > 0 &&
          prevChoices.every(
            (s) => typeof s.choice_id === 'string' && s.choice_id.length > 0 && newChoiceIds.has(s.choice_id)
          )
        const selectedChoicesToUse = canPreserveSelected ? prevChoices : defaultChoices
        const choicesTotalToUse = canPreserveSelected
          ? prevChoices.reduce((sum, c) => sum + (Number(c.total_price) || 0), 0)
          : choicesTotal

        console.log('ReservationForm: 새 예약 모드 - 기본값 설정:', {
          isEditModeForChoices,
          defaultChoicesCount: defaultChoices.length,
          defaultChoices: defaultChoices.map(c => ({ choice_id: c.choice_id, option_id: c.option_id })),
          preservedUserChoices: canPreserveSelected,
        })
        return {
          ...prev,
          productChoices: (data || []) as typeof prev.productChoices,
          selectedChoices: selectedChoicesToUse,
          choicesTotal: choicesTotalToUse,
        }
      });
      if (isImportMode && formDataRef.current.productId === productId) {
        setImportChoicesHydratedProductId(productId)
      }
    } catch (error) {
      if (!isAbortLikeError(error)) {
        console.error('초이스 로드 오류:', error);
      }
      setFormData(prev => ({ ...prev, productChoices: [], selectedChoices: [], choicesTotal: 0 }));
      // 에러 발생 시 로드 상태 제거
      if (isEditModeForChoices) {
        loadedProductChoicesRef.current.delete(productId)
      }
      if (isImportMode && formDataRef.current.productId === productId) {
        setImportChoicesHydratedProductId(productId)
      }
    }
  }, [reservation?.id, isImportMode, initialChoiceOptionNamesFromImport, initialChoiceUndecidedGroupNamesFromImport, channels, loadProductChoicesFromOldTable]);

  // 가격 정보 조회 함수 (reservation_pricing 우선, 없으면 dynamic_pricing에서 조회)
  const loadPricingInfo = useCallback(async (productId: string, tourDate: string, channelId: string, reservationId?: string, selectedChoices?: Array<{ choice_id?: string; option_id?: string; id?: string }>) => {
    const tourDateNormalized = normalizeTourDateForDb(tourDate) || tourDate?.trim() || ''
    if (!productId || !tourDateNormalized || !channelId) {
      console.log('필수 정보가 부족합니다:', { productId, tourDate, tourDateNormalized, channelId })
      return
    }
    const loadGen = ++pricingLoadGenerationRef.current
    setPricingLoadComplete(false)
    // 이메일 가져오기 등: reservation id가 import- 로 시작하면 아직 DB 예약이 없음 → reservation_pricing 조회 생략 후 dynamic_pricing만 사용
    const pricingReservationId =
      reservationId && !String(reservationId).startsWith('import-') ? String(reservationId) : undefined
    setPricingFieldsFromDb({})
    setDynamicPriceFormula(null)

    try {
      // reservation_pricing에 행이 있을 때 dynamic_pricing으로 채운 뒤에도 불포함 가격은 DB 컬럼 값 유지
      let notIncludedPriceFromReservationPricing: number | null = null
      // 선택된 초이스 정보 가져오기 (파라미터로 전달되지 않으면 formData에서 가져오기)
      const rawSelectedChoices = selectedChoices || (Array.isArray(formData.selectedChoices) ? formData.selectedChoices : [])
      const pcsForResolve = (formData.productChoices || []) as Array<{ id: string; options?: Array<{ id: string; option_key?: string }> }>
      const currentSelectedChoices = rawSelectedChoices.map((c) =>
        resolveChoiceSelectionForPricing(c as any, pcsForResolve)
      )
      const pricingSelectedChoices = normalizeUndecidedChoicesForDynamicPricing(
        currentSelectedChoices,
        (formData.productChoices || []) as any
      )
      // 같은 예약에 대한 재조회(초이스/variant 변경 등)에서는 reservation_pricing id를 비우지 않음.
      // 비우는 순간 자동 쿠폰(9%/10% 등)이 끼어들어 DB 쿠폰·정산을 덮어쓸 수 있음.
      if (!pricingReservationId) {
        setReservationPricingId(null)
        pricingLoadReservationKeyRef.current = undefined
      } else if (pricingReservationId !== pricingLoadReservationKeyRef.current) {
        setReservationPricingId(null)
        pricingLoadReservationKeyRef.current = pricingReservationId
      }
      console.log('가격 정보 조회 시작:', { productId, tourDate, tourDateNormalized, channelId, reservationId: pricingReservationId, selectedChoices: currentSelectedChoices, pricingSelectedChoices })

      const DP_SELECT_FULL =
        'adult_price, child_price, infant_price, commission_percent, options_pricing, not_included_price, choices_pricing, updated_at'
      const DP_SELECT_CHOICES = 'choices_pricing'
      const queryDynamicPricingByVariant = async (fields: string, vk: string) => {
        const run = async (useVk: string, priceType: 'dynamic' | 'base' | null) => {
          let q = (supabase as any).from('dynamic_pricing').select(fields)
            .eq('product_id', productId)
            .eq('date', tourDateNormalized)
            .eq('channel_id', channelId)
            .eq('variant_key', useVk)
            .order('updated_at', { ascending: false })
            .limit(1)
          if (priceType) q = q.eq('price_type', priceType)
          return q
        }
        for (const pt of ['dynamic', 'base'] as const) {
          const { data, error } = await run(vk, pt)
          if (error) return { data: null as any[] | null, error }
          if (data?.length) return { data, error: null }
        }
        const { data, error } = await run(vk, null)
        if (error) return { data: null, error }
        if (data?.length) return { data, error: null }
        return { data: null, error: null }
      }
      const queryDynamicPricingAnyVariant = async (fields: string) => {
        const run = async (priceType: 'dynamic' | 'base' | null) => {
          let q = (supabase as any).from('dynamic_pricing').select(fields)
            .eq('product_id', productId)
            .eq('date', tourDateNormalized)
            .eq('channel_id', channelId)
            .order('updated_at', { ascending: false })
            .limit(1)
          if (priceType) q = q.eq('price_type', priceType)
          return q
        }
        for (const pt of ['dynamic', 'base'] as const) {
          const { data, error } = await run(pt)
          if (error) return { data: null as any[] | null, error }
          if (data?.length) return { data, error: null }
        }
        const { data, error } = await run(null)
        if (error) return { data: null, error }
        if (data?.length) return { data, error: null }
        return { data: null, error: null }
      }

      /** 예약 가져오기 등: UI·파서 라벨(예: Klook - All Inclusive)과 시맨틱 키 → channel_products.variant_key로 해석. 가격 조회가 채널 로드보다 먼저 돌아도 동적가격 행이 맞게 조회됨 */
      const resolveVariantKeyForDynamicPricing = async (): Promise<string> => {
        const vk =
          (formDataRef.current.variantKey && String(formDataRef.current.variantKey).trim()) ||
          (formData.variantKey && String(formData.variantKey).trim()) ||
          'default'
        const importLike =
          isImportMode ||
          (reservationId && String(reservationId).startsWith('import-')) ||
          !!(initialChannelVariantLabelFromImport && String(initialChannelVariantLabelFromImport).trim()) ||
          !!(initialVariantKeyFromImport && String(initialVariantKeyFromImport).trim())
        if (!importLike) return vk || 'default'

        const { data: cpData, error: cpErr } = await (supabase as any)
          .from('channel_products')
          .select('variant_key, variant_name_ko, variant_name_en')
          .eq('channel_id', channelId)
          .eq('product_id', productId)
          .eq('is_active', true)
          .order('variant_key')
        if (cpErr || !cpData?.length) return vk || 'default'
        const rows = (cpData as Array<{ variant_key?: string; variant_name_ko?: string | null; variant_name_en?: string | null }>).map(
          (item) => ({
            variant_key: item.variant_key || 'default',
            variant_name_ko: item.variant_name_ko ?? null,
            variant_name_en: item.variant_name_en ?? null,
          })
        )
        const rawSemantic =
          resolveImportChannelVariantKey(
            String(initialVariantKeyFromImport ?? '').trim() ||
              (vk && vk !== 'default' ? vk : undefined) ||
              undefined,
            initialChannelVariantLabelFromImport
          )?.trim() || vk
        const dbKey = mapSemanticVariantToChannelProductKey(rows, rawSemantic, initialChannelVariantLabelFromImport)
        const resolved = (dbKey || vk || 'default').trim() || 'default'
        if (resolved !== vk) {
          console.log('ReservationForm: loadPricingInfo variant_key 재해석 (라벨/시맨틱 → DB)', {
            vk,
            rawSemantic,
            resolved,
            label: initialChannelVariantLabelFromImport,
          })
        }
        return resolved
      }
      const variantKeyForDp = await resolveVariantKeyForDynamicPricing()
      if (
        (isImportMode || (reservationId && String(reservationId).startsWith('import-'))) &&
        variantKeyForDp &&
        variantKeyForDp !== (formDataRef.current.variantKey || 'default')
      ) {
        setFormData((prev) =>
          prev.variantKey === variantKeyForDp ? prev : { ...prev, variantKey: variantKeyForDp }
        )
      }

      const loadDynamicPricingFromDb = async (): Promise<{
        adultPrice: number
        childPrice: number
        infantPrice: number
        commissionPercent: number
        notIncludedPrice: number
      }> => {
              let adultPrice = 0
              let childPrice = 0
              let infantPrice = 0
              let commissionPercent = 0
              let notIncludedPrice = 0
        
              console.log('Dynamic pricing 조회 시작:', {
                productId,
                tourDate,
                tourDateNormalized,
                channelId,
                variantKey: variantKeyForDp,
                variantKeyForm: formDataRef.current.variantKey || formData.variantKey || 'default',
              })
                // variantKeyForDp: channel_products로 라벨·시맨틱 해석 후 조회 (순서와 무관)
                let pricingData: any[] | null = null
                let pricingError: any = null
                let dpRes = await queryDynamicPricingByVariant(DP_SELECT_FULL, variantKeyForDp)
                pricingData = dpRes.data
                pricingError = dpRes.error
                if ((!pricingData || pricingData.length === 0) && !pricingError) {
                  if (variantKeyForDp !== 'default') {
                    dpRes = await queryDynamicPricingByVariant(DP_SELECT_FULL, 'default')
                    if (dpRes.error) pricingError = dpRes.error
                    else if (dpRes.data?.length) pricingData = dpRes.data
                  }
                }
                // variant_key를 특정했는데(all_inclusive 등) 해당 행이 없을 때 임의 variant로 채우면 With Exclusions 가격이 들어가는 버그
                if ((!pricingData || pricingData.length === 0) && !pricingError && variantKeyForDp === 'default') {
                  dpRes = await queryDynamicPricingAnyVariant(DP_SELECT_FULL)
                  if (dpRes.error) pricingError = dpRes.error
                  else if (dpRes.data?.length) pricingData = dpRes.data
                }
        
                if (pricingError) {
                  console.log('Dynamic pricing 조회 오류:', pricingError.message)
                  return { adultPrice: 0, childPrice: 0, infantPrice: 0, commissionPercent: 0, notIncludedPrice: 0 }
                }
        
                if (!pricingData || pricingData.length === 0) {
                  console.log('Dynamic pricing 데이터가 없습니다.')
                  return { adultPrice: 0, childPrice: 0, infantPrice: 0, commissionPercent: 0, notIncludedPrice: 0 }
                }
        
                const pricing = pricingData[0] as any
                console.log('Dynamic pricing 데이터 조회 성공:', pricing)
                
                commissionPercent = (pricing?.commission_percent as number) || 0
                
                // 채널 정보 확인
                const selectedChannel = channels.find(c => c.id === channelId)
                const isOTAChannel = selectedChannel && (
                  (selectedChannel as any)?.type?.toLowerCase() === 'ota' || 
                  (selectedChannel as any)?.category === 'OTA'
                )
                const pricingType = (selectedChannel as any)?.pricing_type || 'separate'
                const isSinglePrice = pricingType === 'single'
                
                console.log('채널 정보:', { channelId, isOTAChannel, pricingType, isSinglePrice })
        
                // choices_pricing이 있는지 확인
                let hasChoicesPricing = false
                let choicesPricing: Record<string, any> = {}
                try {
                  if (pricing?.choices_pricing) {
                    choicesPricing = typeof pricing.choices_pricing === 'string' 
                      ? JSON.parse(pricing.choices_pricing) 
                      : pricing.choices_pricing
                    hasChoicesPricing = choicesPricing && typeof choicesPricing === 'object' && Object.keys(choicesPricing).length > 0
                  }
                } catch (e) {
                  console.warn('choices_pricing 확인 중 오류:', e)
                }
        
                // 필수 초이스가 모두 선택되었는지 확인
                // productChoices가 아직 비어 있으면(로드 전) requiredChoices도 비어 vacuously true가 되어
                // choices_pricing 있는 상품에서 판매가·불포함이 0으로 덮어써지는 버그가 난다 → 로드 전에는 "필수 미충족"으로 본다
                const productChoicesLoaded = (formData.productChoices?.length ?? 0) > 0
                const requiredChoices = formData.productChoices?.filter(choice => choice.is_required) || []
                const selectedChoiceIds = new Set(currentSelectedChoices?.map(c => c.choice_id || (c as any).id).filter(Boolean) || [])
                const allRequiredChoicesSelected = !productChoicesLoaded
                  ? false
                  : (requiredChoices.length === 0 || requiredChoices.every(choice => selectedChoiceIds.has(choice.id)))
                
                // choices_pricing이 있고 (필수 초이스 완료 또는 OTA 채널)이면 초이스별 가격 우선 시도
                // 이메일 가져오기 직후 productChoices 미로드 시 allRequiredChoicesSelected가 항상 false라
                // choices_pricing을 건너뛰고 행 adult_price(기본가)만 쓰는 문제 방지 — OTA는 선택된 초이스만으로도 OTA가 로드되게 함
                // 초이스별 가격이 있으면 기본 가격(adult_price, child_price, infant_price)은 무시
                let useChoicePricing = false
                if (
                  hasChoicesPricing &&
                  pricingSelectedChoices &&
                  pricingSelectedChoices.length > 0 &&
                  (allRequiredChoicesSelected || isOTAChannel)
                ) {
                  try {
                    
                    console.log('choices_pricing 데이터:', choicesPricing)
                    console.log('선택된 초이스(동적가격 조회용·미정→미국 거주자 치환):', pricingSelectedChoices)
                    
                    // normalizeUndecidedChoicesForDynamicPricing에서 미정→미국 거주자 치환 후, 남은 미정만 제외
                    const UNDECIDED_OPTION_ID = UNDECIDED_OPTION_ID_PRICING
                    const choicesForPricingLookup = pricingSelectedChoices || []
                    const choicesForPricing = choicesForPricingLookup.filter((c: any) => c.option_id !== UNDECIDED_OPTION_ID && c.option_key !== UNDECIDED_OPTION_ID)
                    const selectedOptionIds = choicesForPricing
                      .map(c => c.option_id)
                      .filter(Boolean)
                      .sort()
                    const selectedOptionKeys = choicesForPricing
                      .map(c => (c as any).option_key)
                      .filter(Boolean)
                      .sort()
                    const selectedChoiceIds = choicesForPricing
                      .map(c => c.choice_id || (c as any).id)
                      .filter(Boolean)
                      .sort()
                    
                    // choices_pricing 키 형식: DB는 "choice_id+option_id" (전체 UUID) 사용 → 이 형식 우선 시도
                    const buildChoicePricingKeys = (c: { choice_id?: string; option_id?: string; option_key?: string; id?: string }) => {
                      const cid = c.choice_id || (c as any).id
                      const oid = c.option_id
                      const okey = (c as any).option_key
                      const keys: string[] = []
                      if (cid && oid) keys.push(`${cid}+${oid}`)
                      if (cid && okey) keys.push(`${cid}+${okey}`)
                      return keys
                    }
                    // DB 키와 매칭 (UUID 대시 유무 차이 무시)
                    const findChoicePricingEntry = (choiceId: string, optionId: string): any => {
                      const exact = `${choiceId}+${optionId}`
                      if (choicesPricing[exact]) return choicesPricing[exact]
                      const normalized = exact.replace(/-/g, '')
                      const foundKey = Object.keys(choicesPricing).find(k => k.replace(/-/g, '') === normalized)
                      return foundKey ? choicesPricing[foundKey] : null
                    }
                    
                    const combinationKey = selectedOptionKeys.length > 0
                      ? selectedOptionKeys.join('+')
                      : selectedOptionIds.length > 0
                        ? selectedOptionIds.join('+')
                        : selectedChoiceIds.join('+')
                    let foundChoicePricing = false
                    let choiceData: any = null
        
                    // 1. 조합 키 우선 (밤도깨비 등 복수 초이스 시 불포함 가격이 조합 키에만 있는 경우 대비)
                    if (combinationKey && choicesPricing[combinationKey]) {
                      choiceData = choicesPricing[combinationKey]
                      console.log('choices_pricing 조합 키로 초이스 가격 찾음:', { combinationKey, choiceData })
                      foundChoicePricing = true
                    }
                    if (!choiceData && combinationKey) {
                      const sortedKey = combinationKey.split('+').sort().join('+')
                      const availableKeys = Object.keys(choicesPricing)
                      const matchingKey = availableKeys.find(key => {
                        const sortedAvailableKey = key.split('+').sort().join('+')
                        return sortedAvailableKey === sortedKey
                      })
                      if (matchingKey) {
                        choiceData = choicesPricing[matchingKey]
                        console.log('정렬된 조합 키로 초이스 가격 찾음:', { matchingKey, sortedKey, choiceData })
                        foundChoicePricing = true
                      }
                    }
        
                    // 1b. product_choices에서 option_key를 풀어 조합 (구 useChoiceManagement: option_key1+option_key2)
                    if (!choiceData && productChoicesLoaded && formData.productChoices?.length && choicesForPricing.length) {
                      const optKeysSorted = choicesForPricing
                        .map((c: any) => {
                          const cid = c.choice_id || (c as any).id
                          const pc = formData.productChoices!.find((p: any) => p.id === cid)
                          const opt = pc?.options?.find((o: any) => o.id === c.option_id)
                          return (opt as any)?.option_key as string | undefined
                        })
                        .filter(Boolean)
                        .sort()
                        .join('+')
                      if (optKeysSorted) {
                        if (choicesPricing[optKeysSorted]) {
                          choiceData = choicesPricing[optKeysSorted]
                          foundChoicePricing = true
                          console.log('choices_pricing option_key 조합으로 찾음:', { optKeysSorted, choiceData })
                        }
                        if (!choiceData) {
                          const mk = Object.keys(choicesPricing).find((k) => {
                            const a = k.split('+').sort().join('+')
                            const b = optKeysSorted.split('+').sort().join('+')
                            return a === b
                          })
                          if (mk) {
                            choiceData = choicesPricing[mk]
                            foundChoicePricing = true
                            console.log('choices_pricing 정렬 option_key 조합으로 찾음:', { mk, choiceData })
                          }
                        }
                      }
                    }
        
                    // 1c. choice_id+option_key (동적가격에 option UUID 대신 option_key로 저장된 경우)
                    if (!choiceData && productChoicesLoaded && formData.productChoices?.length) {
                      for (const c of choicesForPricing) {
                        const cid = c.choice_id || (c as any).id
                        const pc = formData.productChoices!.find((p: any) => p.id === cid)
                        const opt = pc?.options?.find((o: any) => o.id === c.option_id)
                        const ok = (opt as any)?.option_key as string | undefined
                        if (cid && ok && choicesPricing[`${cid}+${ok}`]) {
                          choiceData = choicesPricing[`${cid}+${ok}`]
                          foundChoicePricing = true
                          console.log('choices_pricing choice_id+option_key로 찾음:', { key: `${cid}+${ok}`, choiceData })
                          break
                        }
                      }
                    }
                    
                    // 2. DB 형식: choice_id+option_id 우선 (UUID 대시 유무 무시), 그다음 choice_id+option_key
                    if (!choiceData) {
                      for (const c of choicesForPricing) {
                        const cid = c.choice_id || (c as any).id
                        const oid = c.option_id
                        if (cid && oid) {
                          const entry = findChoicePricingEntry(cid, oid)
                          if (entry) {
                            choiceData = entry
                            console.log('choices_pricing choice_id+option_id로 초이스 가격 찾음:', { cid, oid, choiceData })
                            foundChoicePricing = true
                            break
                          }
                        }
                        if (!choiceData) {
                          for (const key of buildChoicePricingKeys(c)) {
                            if (choicesPricing[key]) {
                              choiceData = choicesPricing[key]
                              console.log('choices_pricing 키(choice_id+option)로 초이스 가격 찾음:', { key, choiceData })
                              foundChoicePricing = true
                              break
                            }
                          }
                        }
                        if (choiceData) break
                      }
                    }
        
                    // 3. 복수 초이스: DB 키가 choice_id+option_id 한 쌍짜리만 있을 때, 선택별 행을 찾아 OTA 합산
                    if (!choiceData && choicesForPricing.length > 0 && productChoicesLoaded) {
                      const pcs = formData.productChoices || []
                      const entries: any[] = []
                      for (const c of choicesForPricing) {
                        const cid = c.choice_id || (c as any).id
                        const oid = c.option_id
                        let e: any = null
                        if (cid && oid) e = findChoicePricingEntry(cid, oid)
                        if (!e && cid && oid) {
                          const pc = pcs.find((p: any) => p.id === cid)
                          const opt = pc?.options?.find((o: any) => o.id === oid)
                          const ok = (opt as any)?.option_key as string | undefined
                          if (cid && ok && choicesPricing[`${cid}+${ok}`]) e = choicesPricing[`${cid}+${ok}`]
                        }
                        if (e) entries.push(e)
                      }
                      if (entries.length === choicesForPricing.length && entries.every((x) => x && x.ota_sale_price != null)) {
                        const sumOta = entries.reduce((s, x) => s + (Number(x.ota_sale_price) || 0), 0)
                        if (sumOta > 0) {
                          let maxNi = 0
                          for (const x of entries) {
                            const ni = Number(x.not_included_price) || 0
                            if (ni > maxNi) maxNi = ni
                          }
                          choiceData = { ota_sale_price: sumOta, not_included_price: maxNi || undefined }
                          foundChoicePricing = true
                          console.log('choices_pricing 복수 초이스 OTA 합산:', { sumOta, pairCount: entries.length })
                        }
                      }
                    }
                    
                    // 4. 개별 초이스로 찾기 (조합 키로 찾지 못한 경우) — 미정→미국 거주자 치환된 목록 사용
                    if (!choiceData) {
                      for (const selectedChoice of choicesForPricingLookup) {
                        const choiceId = selectedChoice.choice_id || (selectedChoice as any).id
                        const optionId = selectedChoice.option_id
                        const optionKey = (selectedChoice as any).option_key
                        
                        // 다양한 키 형식으로 찾기 시도 (우선순위: option_key > option_id > choice_id)
                        // 3-1. option_key로 먼저 찾기 (가장 우선)
                        if (optionKey && choicesPricing[optionKey]) {
                          choiceData = choicesPricing[optionKey]
                          console.log('option_key로 초이스 가격 찾음:', { optionKey, choiceData })
                          break
                        }
                        // 3-2. option_id로 찾기
                        else if (optionId && choicesPricing[optionId]) {
                          choiceData = choicesPricing[optionId]
                          console.log('option_id로 초이스 가격 찾음:', { optionId, choiceData })
                          break
                        }
                        // 3-3. choice_id로 찾기
                        else if (choiceId && choicesPricing[choiceId]) {
                          choiceData = choicesPricing[choiceId]
                          console.log('choice_id로 초이스 가격 찾음:', { choiceId, choiceData })
                          break
                        }
                        // 3-4. choice_id + option_id 조합 형식 찾기
                        else if (choiceId && optionId) {
                          const combinedKey1 = `${choiceId}+${optionId}`
                          const combinedKey2 = `${choiceId}_${optionId}`
                          if (choicesPricing[combinedKey1]) {
                            choiceData = choicesPricing[combinedKey1]
                            console.log('조합 키(형식1)로 초이스 가격 찾음:', { combinedKey1, choiceData })
                            break
                          } else if (choicesPricing[combinedKey2]) {
                            choiceData = choicesPricing[combinedKey2]
                            console.log('조합 키(형식2)로 초이스 가격 찾음:', { combinedKey2, choiceData })
                            break
                          }
                        }
                        // 3-5. choice_id + option_key 조합 형식 찾기
                        else if (choiceId && optionKey) {
                          const combinedKey1 = `${choiceId}+${optionKey}`
                          const combinedKey2 = `${choiceId}_${optionKey}`
                          if (choicesPricing[combinedKey1]) {
                            choiceData = choicesPricing[combinedKey1]
                            console.log('조합 키(choice_id+option_key 형식1)로 초이스 가격 찾음:', { combinedKey1, choiceData })
                            break
                          } else if (choicesPricing[combinedKey2]) {
                            choiceData = choicesPricing[combinedKey2]
                            console.log('조합 키(choice_id+option_key 형식2)로 초이스 가격 찾음:', { combinedKey2, choiceData })
                            break
                          }
                        }
                        // 3-6. 조합 키만 정확히 매칭 (로어 vs X 앤텔롭 등 같은 choice 내 다른 옵션 오매칭 방지)
                        if (!choiceData) {
                          const exactCombinationKeys =
                            choiceId && optionId ? [`${choiceId}+${optionId}`, `${choiceId}_${optionId}`] : []
                          const exactWithOptionKey =
                            choiceId && optionKey ? [`${choiceId}+${optionKey}`, `${choiceId}_${optionKey}`] : []
                          for (const key of [...exactCombinationKeys, ...exactWithOptionKey]) {
                            if (choicesPricing[key]) {
                              choiceData = choicesPricing[key]
                              console.log('조합 키 정확 매칭으로 초이스 가격 찾음:', { key, choiceData })
                              break
                            }
                          }
                        }
                        
                        if (choiceData) break
                      }
                    }
                    
                    // 5. choice_id 불일치 시 option_id/option_key만으로 매칭 (폼 choice_id와 pricing 키의 choice_id가 다른 경우)
                    if (!choiceData && choicesForPricingLookup.length > 0) {
                      const ourOptionIds = new Set(
                        choicesForPricingLookup.map((c: any) => c.option_id).filter(Boolean)
                      )
                      const ourOptionKeys = new Set(
                        choicesForPricingLookup.map((c: any) => (c as any).option_key).filter(Boolean)
                      )
                      const matches: { key: string; entry: any }[] = []
                      for (const key of Object.keys(choicesPricing)) {
                        const parts = key.split(/[+_]/)
                        const optionPart = parts.length >= 2 ? parts[parts.length - 1] : key
                        if (ourOptionIds.has(optionPart) || ourOptionKeys.has(optionPart)) {
                          matches.push({ key, entry: choicesPricing[key] })
                        }
                        if (ourOptionIds.has(key) || ourOptionKeys.has(key)) matches.push({ key, entry: choicesPricing[key] })
                      }
                      if (matches.length > 0) {
                        const best = matches.reduce((a, b) => 
                          (Number((b.entry as any)?.ota_sale_price) || 0) > (Number((a.entry as any)?.ota_sale_price) || 0) ? b : a
                        )
                        choiceData = best.entry
                        const maxNi = matches.reduce((m, x) => {
                          const ni = Number((x.entry as any)?.not_included_price)
                          return ni > 0 && ni > m ? ni : m
                        }, 0)
                        if (choiceData && (choiceData as any).ota_sale_price != null) {
                          foundChoicePricing = true
                          if (maxNi > 0) (choiceData as any).not_included_price = maxNi
                          console.log('option_id/option_key만으로 초이스 가격 찾음 (choice_id 불일치 폴백):', { matchesCount: matches.length, bestKey: best.key, ota_sale_price: (choiceData as any).ota_sale_price, not_included_price: maxNi || (choiceData as any).not_included_price })
                        }
                      }
                    }
                    
                    if (choiceData) {
                      const data = choiceData as any
                      
                      // 초이스별 가격 설정에서 OTA 판매가만 사용 (adult_price, child_price, infant_price는 저장하지 않음)
                      if (data.ota_sale_price !== undefined && data.ota_sale_price !== null && data.ota_sale_price >= 0) {
                        adultPrice = data.ota_sale_price
                        childPrice = isSinglePrice ? data.ota_sale_price : data.ota_sale_price
                        infantPrice = isSinglePrice ? data.ota_sale_price : data.ota_sale_price
                        // 선택된 초이스의 불포함 가격 사용 (단일 조합 키에서 온 경우)
                        if (data.not_included_price !== undefined && data.not_included_price !== null) {
                          notIncludedPrice = data.not_included_price
                        }
                        // 복수 초이스인 경우: DB는 키당 하나의 행(choice_id+option_id)이므로, 각 초이스의 choice_id+option_id로 매칭된 항목 중 not_included_price 사용 (최대값으로 해당 조합 행 값 반영, 25de6afe+8f8a7270 → 95 등)
                        if (choicesForPricing.length > 1) {
                          let maxNotIncluded = notIncludedPrice
                          for (const c of choicesForPricing) {
                            const cid = c.choice_id || (c as any).id
                            const oid = c.option_id
                            if (cid && oid) {
                              const entry = findChoicePricingEntry(cid, oid)
                              if (entry && entry.not_included_price !== undefined && entry.not_included_price !== null) {
                                const ni = Number(entry.not_included_price)
                                if (ni > 0 && ni > maxNotIncluded) maxNotIncluded = ni
                              }
                            }
                          }
                          if (maxNotIncluded > 0) notIncludedPrice = maxNotIncluded
                        }
                        foundChoicePricing = true
                        console.log('선택된 초이스의 OTA 판매가 사용:', { combinationKey, otaSalePrice: data.ota_sale_price, adultPrice, childPrice, infantPrice, notIncludedPrice })
                      } else {
                        // OTA 판매가가 없으면 가격을 로드하지 않음
                        console.log('초이스별 가격 설정에 OTA 판매가가 없어 가격을 로드하지 않음:', { combinationKey, data })
                        foundChoicePricing = false
                      }
                    }
                    
                    // 선택된 초이스의 가격을 찾은 경우
                    if (foundChoicePricing) {
                      useChoicePricing = true
                      console.log('초이스별 가격 사용 완료:', { adultPrice, childPrice, infantPrice, notIncludedPrice })
                    } else if (choicesForPricingLookup.length > 0) {
                      // 매칭 실패 시: 폼 choice_id/option_id가 DB 키와 다를 때(가져오기 등) OTA·불포함 폴백 조회
                      const fallbackCombinationKey = choicesForPricingLookup
                        .map((c: any) => `${c.choice_id || c.id}+${(c.option_id ?? c.option_key) ?? ''}`)
                        .filter(Boolean)
                        .sort()
                        .join('+')
                      const fallbackResult = fallbackCombinationKey
                        ? getFallbackOtaAndNotIncluded(
                            { id: fallbackCombinationKey, combination_key: fallbackCombinationKey },
                            choicesPricing
                          )
                        : undefined
                      const fallbackOta = fallbackResult?.ota_sale_price
                      if (fallbackOta !== undefined && fallbackOta > 0) {
                        adultPrice = fallbackOta
                        childPrice = isSinglePrice ? fallbackOta : fallbackOta
                        infantPrice = isSinglePrice ? fallbackOta : fallbackOta
                        if (fallbackResult?.not_included_price !== undefined && fallbackResult.not_included_price !== null && Number(fallbackResult.not_included_price) > 0) {
                          notIncludedPrice = Number(fallbackResult.not_included_price)
                        }
                        useChoicePricing = true
                        foundChoicePricing = true
                        console.log('초이스 가격 폴백 OTA·불포함 사용:', { fallbackCombinationKey, fallbackOta, notIncludedPrice })
                      }
                      if (!foundChoicePricing) {
                        console.log('선택된 초이스의 가격을 찾지 못함, 기본 가격으로 폴백:', { 
                          choicesPricingKeys: Object.keys(choicesPricing),
                          selectedChoices: pricingSelectedChoices
                        })
                      }
                    }
                  } catch (e) {
                    console.warn('choices_pricing 파싱 오류:', e)
                  }
                }
        
                // 초이스 없는 상품: VIATOR OTA 등은 choices_pricing['no_choice'].ota_sale_price 에만 저장됨 (행 adult_price는 기본가)
                if (!useChoicePricing && isOTAChannel && hasChoicesPricing) {
                  const hasDefiniteSelection = (pricingSelectedChoices || []).some(
                    (c: any) =>
                      c.option_id !== UNDECIDED_OPTION_ID_PRICING &&
                      (c as any).option_key !== UNDECIDED_OPTION_ID_PRICING
                  )
                  if (!hasDefiniteSelection) {
                    const nc = getNoChoiceOtaAndNotIncluded(choicesPricing)
                    if (nc && nc.ota_sale_price > 0) {
                      adultPrice = nc.ota_sale_price
                      childPrice = isSinglePrice ? nc.ota_sale_price : nc.ota_sale_price
                      infantPrice = isSinglePrice ? nc.ota_sale_price : nc.ota_sale_price
                      if (nc.not_included_price != null && nc.not_included_price > 0) {
                        notIncludedPrice = nc.not_included_price
                      }
                      useChoicePricing = true
                      console.log('choices_pricing no_choice OTA 적용 (확정 초이스 없음):', {
                        ota_sale_price: nc.ota_sale_price,
                        not_included_price: nc.not_included_price,
                      })
                    }
                  }
                }
                
                // 초이스별 가격을 사용하지 않은 경우
                // 초이스가 있는 상품은 무조건 choices_pricing만 참조, 기본 가격(adult_price 등) 사용 금지
                const productHasChoices = (formData.productChoices?.length ?? 0) > 0
                const mustUseChoicePricingOnly = hasChoicesPricing || productHasChoices
        
                if (!useChoicePricing) {
                  // 초이스가 있는 상품(choices_pricing 있음 또는 productChoices 있음)
                  if (mustUseChoicePricingOnly) {
                    // 필수 초이스가 모두 선택되지 않은 경우: 기본 상품가(판매가·불포함)는 dynamic_pricing 행에서 로드
                    if (!allRequiredChoicesSelected) {
                      const baseAdult = (pricing?.adult_price as number) ?? 0
                      const baseChild = isSinglePrice ? baseAdult : ((pricing?.child_price as number) ?? 0)
                      const baseInfant = isSinglePrice ? baseAdult : ((pricing?.infant_price as number) ?? 0)
                      const baseNotIncluded = (pricing?.not_included_price as number) ?? 0
                      adultPrice = baseAdult
                      childPrice = baseChild
                      infantPrice = baseInfant
                      notIncludedPrice = baseNotIncluded
                      console.log('필수 초이스 미선택 — 기본 상품가(판매가·불포함) 로드:', {
                        adultPrice,
                        childPrice,
                        infantPrice,
                        notIncludedPrice
                      })
        
                    } else {
                      // 필수 초이스는 모두 선택되었지만 초이스별 가격을 찾지 못한 경우
                      console.log('초이스별 가격 설정이 있지만 해당 초이스의 가격을 찾지 못함. 기본 가격을 로드하지 않음:', {
                        hasChoicesPricing: !!pricing?.choices_pricing,
                        choicesPricingKeys: Object.keys(choicesPricing || {}),
                        selectedChoices: pricingSelectedChoices
                      })
                      // 가격을 0으로 설정하고 메시지 표시
                      adultPrice = 0
                      childPrice = 0
                      infantPrice = 0
                      notIncludedPrice = 0
        
                    }
                  } else {
                    // formData.productChoices는 아직 로드 전일 수 있으므로, DB에서 상품 초이스 여부 확인
                    // 초이스 상품이면 기본가(236 등) 사용 금지 → 0으로 두고 초이스 선택 후 로드 유도
                    let productHasChoicesFromDb = false
                    try {
                      const { data: productChoicesRows } = await (supabase as any)
                        .from('product_choices')
                        .select('id')
                        .eq('product_id', productId)
                        .limit(1)
                      productHasChoicesFromDb = Array.isArray(productChoicesRows) && productChoicesRows.length > 0
                    } catch {
                      // 조회 실패 시 기존 로직 유지
                    }
                    if (productHasChoicesFromDb) {
                      console.log('초이스 상품인데 choices_pricing/폼 초이스 없음 → 기본가 미사용, 0으로 설정:', { productId })
                      adultPrice = 0
                      childPrice = 0
                      infantPrice = 0
                      notIncludedPrice = 0
        
                    } else {
                      // 실제로 초이스가 없는 상품에만 기본 가격 사용
                      adultPrice = (pricing?.adult_price as number) || 0
                      childPrice = isSinglePrice ? adultPrice : ((pricing?.child_price as number) || 0)
                      infantPrice = isSinglePrice ? adultPrice : ((pricing?.infant_price as number) || 0)
                      notIncludedPrice = (pricing?.not_included_price as number) || 0
                      console.log('기본 가격 사용 (초이스가 없는 상품):', { 
                        hasChoicesPricing: false,
                        adultPrice, 
                        childPrice, 
                        infantPrice 
                      })
                    }
                  }
                }
        return { adultPrice, childPrice, infantPrice, commissionPercent, notIncludedPrice }
      }


      // 1. 먼저 reservation_pricing에서 기존 가격 정보 확인 (편집 모드인 경우)
      if (pricingReservationId) {
        const toNum = (v: unknown): number => {
          if (v === null || v === undefined) return 0
          if (typeof v === 'number' && !Number.isNaN(v)) return v
          if (typeof v === 'string') return parseFloat(v) || 0
          return Number(v) || 0
        }
        const { data: existingPricing, error: existingError } = await (supabase as any)
          .from('reservation_pricing')
          .select(
            'id, adult_product_price, child_product_price, infant_product_price, product_price_total, not_included_price, required_options, required_option_total, subtotal, coupon_code, coupon_discount, additional_discount, additional_cost, refund_reason, refund_amount, card_fee, tax, prepayment_cost, prepayment_tip, selected_options, option_total, total_price, deposit_amount, balance_amount, private_tour_additional_cost, commission_percent, commission_amount, commission_base_price, channel_settlement_amount, choices, choices_total, pricing_adults, audited, audited_at, audited_by_email, audited_by_name, audited_by_nick_name'
          )
          .eq('reservation_id', pricingReservationId)
          .maybeSingle()

        if (existingError) {
          console.log('기존 가격 정보 조회 오류:', existingError.message)
          setReservationPricingId(null)
          // 오류가 발생해도 계속 진행 (dynamic_pricing 조회)
        } else if (existingPricing) {
          setReservationPricingId((existingPricing as { id?: string }).id ?? null)
          setPricingAudit({
            audited: Boolean((existingPricing as any).audited),
            auditedAt: (existingPricing as any).audited_at ?? null,
            auditedByEmail: (existingPricing as any).audited_by_email ?? null,
            auditedByName: (existingPricing as any).audited_by_name ?? null,
            auditedByNickName: (existingPricing as any).audited_by_nick_name ?? null,
          })
          console.log('기존 가격 정보 사용:', existingPricing)

          // reservation_pricing에 commission_percent가 있으면 그대로 사용(계산하지 않음). 없을 때만 $ 기준 역산
          const commissionAmount = (existingPricing as any).commission_amount != null && (existingPricing as any).commission_amount !== ''
            ? Number((existingPricing as any).commission_amount)
            : 0
          const dbCommissionPercent = (existingPricing as any).commission_percent != null && (existingPricing as any).commission_percent !== ''
            ? Number((existingPricing as any).commission_percent)
            : null
          let commissionPercentToUse: number
          if (dbCommissionPercent !== null) {
            // DB에 commission_percent가 있으면 그대로 사용 (절대 역산으로 덮어쓰지 않음)
            commissionPercentToUse = dbCommissionPercent
          } else if (commissionAmount > 0) {
            const base = Number((existingPricing as any).product_price_total) || Number((existingPricing as any).subtotal) || 0
            commissionPercentToUse = base > 0 ? (commissionAmount / base) * 100 : 0
            console.log('ReservationForm: 채널 수수료 % 역산 (DB에 % 없음, $ 기준)', { commission_amount: commissionAmount, base, commission_percent: commissionPercentToUse })
          } else {
            commissionPercentToUse = 0
          }

          console.log('쿠폰 정보 확인:', {
            coupon_code: existingPricing.coupon_code,
            coupon_discount: existingPricing.coupon_discount,
            coupon_discount_type: typeof existingPricing.coupon_discount
          })
          console.log('commission_amount 확인:', {
            raw: (existingPricing as any).commission_amount,
            type: typeof (existingPricing as any).commission_amount,
            converted: Number((existingPricing as any).commission_amount),
            isNull: (existingPricing as any).commission_amount === null,
            isUndefined: (existingPricing as any).commission_amount === undefined,
            finalValue: (existingPricing as any).commission_amount !== null && (existingPricing as any).commission_amount !== undefined
              ? Number((existingPricing as any).commission_amount)
              : 0
          })
          
          // 채널의 pricing_type 확인 (단일 가격 모드 체크)
          const selectedChannel = channels.find(c => c.id === channelId)
          const pricingType = (selectedChannel as any)?.pricing_type || 'separate'
          const isSinglePrice = pricingType === 'single'
          
          // reservation_pricing에 저장된 상품 단가를 우선 사용 (DB가 문자열로 반환할 수 있으므로 toNum 적용)
          let adultPrice = toNum((existingPricing as any).adult_product_price)
          let childPrice = isSinglePrice ? adultPrice : toNum((existingPricing as any).child_product_price)
          let infantPrice = isSinglePrice ? adultPrice : toNum((existingPricing as any).infant_product_price)
          const hasSavedProductPrices = adultPrice > 0 || childPrice > 0 || infantPrice > 0

          // 저장된 상품 단가가 없을 때만 dynamic_pricing/choices_pricing으로 채움 (있으면 덮어쓰지 않음)
          if (productId && tourDateNormalized && channelId && !hasSavedProductPrices) {
            let dpRows: any[] | null = null
            let rCh = await queryDynamicPricingByVariant(DP_SELECT_CHOICES, variantKeyForDp)
            dpRows = rCh.data
            if (!dpRows?.length) {
              if (variantKeyForDp !== 'default') {
                rCh = await queryDynamicPricingByVariant(DP_SELECT_CHOICES, 'default')
                dpRows = rCh.data
              }
            }
            if (!dpRows?.length && variantKeyForDp === 'default') {
              const rAny = await queryDynamicPricingAnyVariant(DP_SELECT_CHOICES)
              dpRows = rAny.data
            }
            const dpData = Array.isArray(dpRows) ? dpRows[0] : dpRows
            let choicesPricing: Record<string, any> = {}
            if (dpData?.choices_pricing) {
              try {
                choicesPricing = typeof dpData.choices_pricing === 'string' ? JSON.parse(dpData.choices_pricing) : dpData.choices_pricing
              } catch { /* ignore */ }
            }
            if (choicesPricing && Object.keys(choicesPricing).length > 0) {
              // 이 상품은 초이스 상품 → reservation_pricing의 236 쓰지 않고 choices_pricing에서만 로드
              const fallbackKey = pricingSelectedChoices && pricingSelectedChoices.length > 0
                ? pricingSelectedChoices
                    .map((c: any) => `${c.choice_id || c.id}+${(c.option_id ?? c.option_key) ?? ''}`)
                    .filter(Boolean)
                    .sort()
                    .join('+')
                : ''
              let fallbackOta = getFallbackOtaSalePrice(
                { id: fallbackKey || 'fallback', combination_key: fallbackKey },
                choicesPricing
              )
              const noChoiceRow = getNoChoiceOtaAndNotIncluded(choicesPricing)
              if ((fallbackOta === undefined || fallbackOta <= 0) && noChoiceRow && noChoiceRow.ota_sale_price > 0) {
                fallbackOta = noChoiceRow.ota_sale_price
              }
              if (fallbackOta !== undefined && fallbackOta > 0) {
                adultPrice = fallbackOta
                childPrice = isSinglePrice ? fallbackOta : fallbackOta
                infantPrice = isSinglePrice ? fallbackOta : fallbackOta
                console.log('ReservationForm: 초이스 상품 → choices_pricing 기준 가격 적용', { fallbackOta, adultPrice })
              } else {
                adultPrice = 0
                childPrice = 0
                infantPrice = 0
              }
            } else {
              // dynamic_pricing에 choices_pricing 없음 → 상품이 실제로 초이스 상품이면 기본가(236) 사용 금지
              try {
                const { data: productChoicesRows } = await (supabase as any)
                  .from('product_choices')
                  .select('id')
                  .eq('product_id', productId)
                  .limit(1)
                if (Array.isArray(productChoicesRows) && productChoicesRows.length > 0) {
                  adultPrice = 0
                  childPrice = 0
                  infantPrice = 0
                  console.log('ReservationForm: 초이스 상품인데 choices_pricing 없음 → 기본가 미사용', { productId })
                }
              } catch { /* ignore */ }
            }
          }
          
          // DB에 저장된 잔액(가격 정보 모달 「잔액(투어 당일 지불)」 등)은 채널 종류와 관계없이 로드
          const balanceAmount = Number(existingPricing.balance_amount) || 0
          const onSiteBalanceAmount = balanceAmount
          
          setFormData(prev => {
            const { channelSettlementAmount: _stripChSettle, ...prevWithoutChSettle } = prev
            void _stripChSettle
            const paRaw = (existingPricing as any).pricing_adults
            const paNum = paRaw != null && paRaw !== '' ? Number(paRaw) : NaN
            const pricingAdultsLoaded = Number.isFinite(paNum)
              ? Math.max(0, Math.floor(paNum))
              : prev.pricingAdults ?? prev.adults
            const channelSettlementFromDb = (() => {
              const v = (existingPricing as any).channel_settlement_amount
              if (v == null || v === '') return null
              const n = Number(v)
              return Number.isFinite(n) ? n : null
            })()
            const updated = {
              ...prevWithoutChSettle,
              pricingAdults: pricingAdultsLoaded,
              adultProductPrice: adultPrice,
              childProductPrice: childPrice,
              infantProductPrice: infantPrice,
              not_included_price: Number(existingPricing.not_included_price) || 0,
              requiredOptions: existingPricing.required_options || {},
              couponCode: existingPricing.coupon_code || '',
              couponDiscount: Number(existingPricing.coupon_discount) || 0,
              additionalDiscount: Number(existingPricing.additional_discount) || 0,
              additionalCost: Number(existingPricing.additional_cost) || 0,
              refundReason: (existingPricing as any).refund_reason || '',
              refundAmount: Number((existingPricing as any).refund_amount) || 0,
              cardFee: Number(existingPricing.card_fee) || 0,
              tax: Number(existingPricing.tax) || 0,
              prepaymentCost: Number(existingPricing.prepayment_cost) || 0,
              prepaymentTip: Number(existingPricing.prepayment_tip) || 0,
              selectedOptionalOptions: existingPricing.selected_options || {},
              depositAmount: Number(existingPricing.deposit_amount) || 0,
              isPrivateTour: reservation?.isPrivateTour || false,
              privateTourAdditionalCost: Number(existingPricing.private_tour_additional_cost) || 0,
              commission_percent: commissionPercentToUse,
              commission_amount: (() => {
                const dbValue = (existingPricing as any).commission_amount !== null && (existingPricing as any).commission_amount !== undefined
                  ? Number((existingPricing as any).commission_amount)
                  : 0
                // 데이터베이스에서 불러온 값 추적
                if (dbValue > 0) {
                  loadedCommissionAmount.current = dbValue
                  console.log('ReservationForm: 데이터베이스에서 commission_amount 로드됨:', dbValue)
                }
                return dbValue
              })(),
              commission_base_price: (existingPricing as any).commission_base_price !== undefined && (existingPricing as any).commission_base_price !== null
                ? Number((existingPricing as any).commission_base_price) 
                : 0,
              ...(channelSettlementFromDb != null ? { channelSettlementAmount: channelSettlementFromDb } : {}),
              onSiteBalanceAmount: onSiteBalanceAmount,
              choices: existingPricing.choices || {},
              choicesTotal: Number(existingPricing.choices_total) || 0
            }
            
            // 가격 계산 수행 (단일 가격 모드 적용 후 재계산)
            const newProductPriceTotal = (updated.adultProductPrice * updated.pricingAdults) + 
                                         (updated.childProductPrice * updated.child) + 
                                         (updated.infantProductPrice * updated.infant)
            
            // requiredOptionTotal 계산
            let requiredOptionTotal = 0
            Object.entries(updated.requiredOptions).forEach(([optionId, option]) => {
              const isSelected = updated.selectedOptions && 
                updated.selectedOptions[optionId] && 
                updated.selectedOptions[optionId].length > 0
              if (isSelected && option && typeof option === 'object' && 'adult' in option && 'child' in option && 'infant' in option) {
                const optionData = option as { adult: number; child: number; infant: number }
                requiredOptionTotal += (optionData.adult * updated.pricingAdults) + 
                                      (optionData.child * updated.child) + 
                                      (optionData.infant * updated.infant)
              }
            })
            
            // 초이스 판매 총액(choicesTotal)은 동적가격 불포함·초이스별 불포함과 이중 합산되므로 소계에 넣지 않음. 레거시 필수 옵션만 반영.
            const optionTotal = requiredOptionTotal
            
            // 선택 옵션 총합 계산
            let optionalOptionTotal = 0
            Object.values(updated.selectedOptionalOptions).forEach((option) => {
              if (option && typeof option === 'object' && 'price' in option && 'quantity' in option) {
                const opt = option as { price: number; quantity: number }
                optionalOptionTotal += opt.price * opt.quantity
              }
            })
            
            const notIncludedTotal = updated.choiceNotIncludedTotal || 0
            
            const newSubtotal = newProductPriceTotal + optionTotal + optionalOptionTotal + notIncludedTotal
            const totalDiscount = updated.couponDiscount + updated.additionalDiscount
            const refundAmount = Number(updated.refundAmount) || 0
            const totalAdditional = updated.additionalCost + updated.cardFee + updated.tax +
              updated.prepaymentCost + updated.prepaymentTip +
              (updated.isPrivateTour ? updated.privateTourAdditionalCost : 0) +
              reservationOptionsTotalPrice
            const newTotalPrice = Math.max(0, newSubtotal - totalDiscount + totalAdditional - refundAmount)
            const newBalance = Math.max(0, newTotalPrice - updated.depositAmount)
            
            // 명시 잔액(DB/당일 지불)이 있으면 항상 우선. 없으면 총액−보증금 계산값 사용
            const finalBalanceAmount =
              updated.onSiteBalanceAmount !== 0 ? updated.onSiteBalanceAmount : newBalance
            
            // commission_amount가 데이터베이스에서 불러온 값이면 절대 덮어쓰지 않음
            const finalCommissionAmount = loadedCommissionAmount.current !== null && loadedCommissionAmount.current > 0
              ? loadedCommissionAmount.current
              : updated.commission_amount
            
            console.log('ReservationForm: 가격 정보 업데이트', {
              loadedCommissionAmount: loadedCommissionAmount.current,
              updatedCommissionAmount: updated.commission_amount,
              finalCommissionAmount
            })

            /** DB `commission_base_price`는 net(Returned 반영)일 수 있음 → gross `onlinePaymentAmount`를 동기화 (입금 Returned는 이후 PricingSection에서 반영) */
            let nextOnlinePayment = prev.onlinePaymentAmount ?? 0
            const rawCbForOnline = (existingPricing as any).commission_base_price
            if (rawCbForOnline != null && rawCbForOnline !== '') {
              const cbNum = Number(rawCbForOnline)
              if (Number.isFinite(cbNum)) {
                const chRow = channels.find((c: { id: string }) => c.id === prev.channelId) as
                  | { type?: string; category?: string }
                  | undefined
                const isOtaLoad =
                  !!chRow &&
                  (String(chRow.type || '').toLowerCase() === 'ota' || chRow.category === 'OTA')
                nextOnlinePayment = deriveCommissionGrossForSettlement(cbNum, {
                  returnedAmount: 0,
                  depositAmount: Number(updated.depositAmount) || 0,
                  productPriceTotal: newProductPriceTotal,
                  isOTAChannel: isOtaLoad,
                })
              }
            }
            
            return {
              ...updated,
              productPriceTotal: newProductPriceTotal,
              requiredOptionTotal: requiredOptionTotal,
              subtotal: newSubtotal,
              totalPrice: newTotalPrice,
              balanceAmount: finalBalanceAmount,
              // commission_amount와 commission_percent 명시적으로 보존 (데이터베이스 값 우선)
              commission_amount: finalCommissionAmount,
              commission_percent: updated.commission_percent,
              commission_base_price: updated.commission_base_price,
              onlinePaymentAmount: nextOnlinePayment,
            }
          })
          
          // DB에서 불러온 필드 표시용 (가격 정보에서 검은색=DB값, 빨간색=계산값)
          setPricingFieldsFromDb({
            productPriceTotal: (existingPricing as any).product_price_total != null && (existingPricing as any).product_price_total !== '',
            couponDiscount: (existingPricing as any).coupon_discount != null && (existingPricing as any).coupon_discount !== '',
            additionalDiscount: (existingPricing as any).additional_discount != null && (existingPricing as any).additional_discount !== '',
            additionalCost: (existingPricing as any).additional_cost != null && (existingPricing as any).additional_cost !== '',
            refundAmount: (existingPricing as any).refund_amount != null && (existingPricing as any).refund_amount !== '',
            cardFee: (existingPricing as any).card_fee != null && (existingPricing as any).card_fee !== '',
            tax: (existingPricing as any).tax != null && (existingPricing as any).tax !== '',
            prepaymentCost: (existingPricing as any).prepayment_cost != null && (existingPricing as any).prepayment_cost !== '',
            prepaymentTip: (existingPricing as any).prepayment_tip != null && (existingPricing as any).prepayment_tip !== '',
            optionTotal: (existingPricing as any).option_total != null && (existingPricing as any).option_total !== '',
            totalPrice: (existingPricing as any).total_price != null && (existingPricing as any).total_price !== '',
            depositAmount: (existingPricing as any).deposit_amount != null && (existingPricing as any).deposit_amount !== '',
            balanceAmount: (existingPricing as any).balance_amount != null && (existingPricing as any).balance_amount !== '',
            commission_percent: (existingPricing as any).commission_percent != null && (existingPricing as any).commission_percent !== '',
            commission_amount: (existingPricing as any).commission_amount != null && (existingPricing as any).commission_amount !== '',
            not_included_price: (existingPricing as any).not_included_price != null && (existingPricing as any).not_included_price !== '',
            choicesTotal: (existingPricing as any).choices_total != null && (existingPricing as any).choices_total !== '',
            onSiteBalanceAmount: (existingPricing as any).balance_amount != null && (existingPricing as any).balance_amount !== '',
            onlinePaymentAmount: (existingPricing as any).commission_base_price != null && (existingPricing as any).commission_base_price !== '',
            /** 채널 결제(net) DB 보존 — PricingSection 자동 덮어쓰기 억제용 */
            commission_base_price: (existingPricing as any).commission_base_price != null && (existingPricing as any).commission_base_price !== '',
            channel_settlement_amount:
              (existingPricing as any).channel_settlement_amount != null &&
              (existingPricing as any).channel_settlement_amount !== '',
            pricingAdults:
              (existingPricing as any).pricing_adults != null && (existingPricing as any).pricing_adults !== '',
            adultProductPrice:
              (existingPricing as any).adult_product_price != null &&
              (existingPricing as any).adult_product_price !== '',
            childProductPrice:
              (existingPricing as any).child_product_price != null &&
              (existingPricing as any).child_product_price !== '',
            infantProductPrice:
              (existingPricing as any).infant_product_price != null &&
              (existingPricing as any).infant_product_price !== '',
          })

          // 상품 단가·불포함이 모두 0이면 dynamic_pricing에서 채우기 위해 아래로 진행 (불포함은 DB 컬럼 값 유지)
          const hasAnySavedPrice = hasSavedProductPrices || (Number((existingPricing as any).not_included_price) || 0) > 0
          if (hasAnySavedPrice) {
            try {
              const formula = await loadDynamicPricingFromDb()
              setDynamicPriceFormula(formula)
            } catch (e) {
              console.warn('동적 가격 계산식 스냅샷 실패:', e)
              setDynamicPriceFormula(null)
            }
            setIsExistingPricingLoaded(true)
            setPriceAutoFillMessage('기존 가격 정보가 로드되었습니다!')
            return
          }
          notIncludedPriceFromReservationPricing = Number((existingPricing as any).not_included_price) || 0
        } else {
          setReservationPricingId(null)
          setPricingAudit({
            audited: false,
            auditedAt: null,
            auditedByEmail: null,
            auditedByName: null,
            auditedByNickName: null,
          })
        }
      }

      const pricingFromDynamic = await loadDynamicPricingFromDb()
      setDynamicPriceFormula(null)
      setPriceAutoFillMessage('Dynamic pricing에서 가격 정보가 자동으로 입력되었습니다!')

      setFormData(prev => {
        const notIncludedToUse =
          notIncludedPriceFromReservationPricing !== null
            ? notIncludedPriceFromReservationPricing
            : pricingFromDynamic.notIncludedPrice
        const updated = {
          ...prev,
          adultProductPrice: pricingFromDynamic.adultPrice,
          childProductPrice: pricingFromDynamic.childPrice,
          infantProductPrice: pricingFromDynamic.infantPrice,
          commission_percent: pricingFromDynamic.commissionPercent,
          not_included_price: notIncludedToUse,
          onlinePaymentAmount: notIncludedToUse != null
            ? Math.max(0, (pricingFromDynamic.adultPrice - (notIncludedToUse || 0)) * (prev.pricingAdults || 0))
            : prev.onlinePaymentAmount || 0
        }
        
        // 가격 계산 수행
        const newProductPriceTotal = (updated.adultProductPrice * updated.pricingAdults) + 
                                     (updated.childProductPrice * updated.child) + 
                                     (updated.infantProductPrice * updated.infant)
        
        // requiredOptionTotal 계산
        let requiredOptionTotal = 0
        Object.entries(updated.requiredOptions).forEach(([optionId, option]) => {
          const isSelected = updated.selectedOptions && 
            updated.selectedOptions[optionId] && 
            updated.selectedOptions[optionId].length > 0
          if (isSelected) {
            requiredOptionTotal += (option.adult * updated.pricingAdults) + 
                                  (option.child * updated.child) + 
                                  (option.infant * updated.infant)
          }
        })
        
        // OTA 채널인 경우 초이스 가격을 포함하지 않음 (OTA 판매가에 이미 포함됨)
        const selectedChannelForCheck = channels.find(c => c.id === channelId)
        const isOTAChannel = selectedChannelForCheck && (
          (selectedChannelForCheck as any)?.type?.toLowerCase() === 'ota' || 
          (selectedChannelForCheck as any)?.category === 'OTA'
        )
        
        // 초이스 판매 총액(choicesTotal)은 불포함 금액과 겹치므로 소계에 포함하지 않음. 레거시 필수 옵션만.
        const optionTotal = requiredOptionTotal
        
        // 선택 옵션 총합 계산
        let optionalOptionTotal = 0
        Object.values(updated.selectedOptionalOptions).forEach(option => {
          optionalOptionTotal += option.price * option.quantity
        })
        
        const notIncludedTotal = updated.choiceNotIncludedTotal || 0
        
        // OTA 채널일 때는 초이스 가격을 포함하지 않음
        const newSubtotal = isOTAChannel 
          ? newProductPriceTotal + optionalOptionTotal + notIncludedTotal
          : newProductPriceTotal + optionTotal + optionalOptionTotal + notIncludedTotal
        const totalDiscount = updated.couponDiscount + updated.additionalDiscount
        const refundAmount = Number(updated.refundAmount) || 0
        const totalAdditional = updated.additionalCost + updated.cardFee + updated.tax +
          updated.prepaymentCost + updated.prepaymentTip +
          (updated.isPrivateTour ? updated.privateTourAdditionalCost : 0) +
          reservationOptionsTotalPrice
        const newTotalPrice = Math.max(0, newSubtotal - totalDiscount + totalAdditional - refundAmount)
        const newBalance = Math.max(0, newTotalPrice - updated.depositAmount)
        
        return {
          ...updated,
          productPriceTotal: newProductPriceTotal,
          requiredOptionTotal: requiredOptionTotal,
          subtotal: newSubtotal,
          totalPrice: newTotalPrice,
          balanceAmount: updated.onSiteBalanceAmount !== 0 ? updated.onSiteBalanceAmount : newBalance
        }
      })

      // choice 로드는 다음 이벤트 루프로 미룸 → React가 위 setFormData(불포함 가격 등)를 먼저 반영한 뒤 실행되도록 해서, loadProductChoices의 setFormData가 prev에서 not_included_price를 0으로 덮어쓰지 않도록 함
      setTimeout(() => {
        loadProductChoices(productId, formData.channelId)
      }, 0)

      console.log('가격 정보가 자동으로 입력되었습니다')
      
      // 사용자에게 알림 표시
      setTimeout(() => setPriceAutoFillMessage(''), 3000)
      
      // dynamic_pricing에서만 로드한 경우(새 예약/가져오기)에는 isExistingPricingLoaded를 true로 두지 않음.
      // 그러면 PricingSection에서 채널 수수료 %/$ 자동 계산이 동작함.
      // (reservation_pricing에서 로드한 경우에만 위에서 이미 setIsExistingPricingLoaded(true) 호출됨)
    } catch (error) {
      console.error('Dynamic pricing 조회 중 오류:', error)
    } finally {
      const settleGen = loadGen
      // 연쇄 setFormData / PricingSection useEffect 반영 후 한 번에 보이도록 완료 플래그 지연
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.setTimeout(() => {
            if (settleGen === pricingLoadGenerationRef.current) {
              setPricingLoadComplete(true)
            }
          }, 320)
        })
      })
    }
      }, [channels, reservationOptionsTotalPrice, loadProductChoices, formData.selectedChoices, formData.variantKey, formData.productChoices, reservation?.id, (reservation as any)?.channel_id, isImportMode, initialVariantKeyFromImport, initialChannelVariantLabelFromImport])

  /** 동적 가격 계산식 → 입력칸 반영(저장 시 DB 반영). reservation_pricing 행이 있을 때만 의미 있음 */
  const applyDynamicProductPriceFormula = useCallback(() => {
    if (!dynamicPriceFormula || !reservationPricingId) return
    const ch = channels.find((c) => c.id === formData.channelId)
    const isSingle = ((ch as { pricing_type?: string })?.pricing_type || 'separate') === 'single'
    const a = dynamicPriceFormula.adultPrice
    const c = isSingle ? a : dynamicPriceFormula.childPrice
    const i = isSingle ? a : dynamicPriceFormula.infantPrice
    const ni = dynamicPriceFormula.notIncludedPrice
    const channelIdForCalc = formData.channelId
    setPricingFieldsFromDb((prev) => ({
      ...prev,
      adultProductPrice: false,
      childProductPrice: false,
      infantProductPrice: false,
      not_included_price: false,
      productPriceTotal: false,
      totalPrice: false,
      onSiteBalanceAmount: false,
    }))
    setFormData((prev) => {
      const updated = {
        ...prev,
        adultProductPrice: a,
        childProductPrice: c,
        infantProductPrice: i,
        not_included_price: ni,
        commission_percent: dynamicPriceFormula.commissionPercent,
        onlinePaymentAmount:
          ni != null
            ? Math.max(0, (a - (ni || 0)) * (prev.pricingAdults || 0))
            : prev.onlinePaymentAmount || 0,
      }
      const newProductPriceTotal =
        updated.adultProductPrice * updated.pricingAdults +
        updated.childProductPrice * updated.child +
        updated.infantProductPrice * updated.infant
      let requiredOptionTotal = 0
      Object.entries(updated.requiredOptions).forEach(([optionId, option]) => {
        const isSelected =
          updated.selectedOptions &&
          updated.selectedOptions[optionId] &&
          updated.selectedOptions[optionId].length > 0
        if (isSelected && option && typeof option === 'object' && 'adult' in option) {
          const optionData = option as { adult: number; child: number; infant: number }
          requiredOptionTotal +=
            optionData.adult * updated.pricingAdults +
            optionData.child * updated.child +
            optionData.infant * updated.infant
        }
      })
      const selectedChannelForCheck = channels.find((c) => c.id === channelIdForCalc)
      const isOTAChannel = !!(
        selectedChannelForCheck &&
        ((selectedChannelForCheck as { type?: string; category?: string })?.type?.toLowerCase() === 'ota' ||
          (selectedChannelForCheck as { category?: string })?.category === 'OTA')
      )
      const optionTotal = requiredOptionTotal
      let optionalOptionTotal = 0
      Object.values(updated.selectedOptionalOptions).forEach((option) => {
        if (option && typeof option === 'object' && 'price' in option && 'quantity' in option) {
          optionalOptionTotal += (option as { price: number; quantity: number }).price * (option as { price: number; quantity: number }).quantity
        }
      })
      const notIncludedTotal = updated.choiceNotIncludedTotal || 0
      const newSubtotal = isOTAChannel
        ? newProductPriceTotal + optionalOptionTotal + notIncludedTotal
        : newProductPriceTotal + optionTotal + optionalOptionTotal + notIncludedTotal
      const totalDiscount = updated.couponDiscount + updated.additionalDiscount
      const refundAmount = Number(updated.refundAmount) || 0
      const totalAdditional =
        updated.additionalCost +
        updated.cardFee +
        updated.tax +
        updated.prepaymentCost +
        updated.prepaymentTip +
        (updated.isPrivateTour ? updated.privateTourAdditionalCost : 0) +
        reservationOptionsTotalPrice
      const newTotalPrice = Math.max(0, newSubtotal - totalDiscount + totalAdditional - refundAmount)
      const newBalance = Math.max(0, newTotalPrice - updated.depositAmount)
      return {
        ...updated,
        productPriceTotal: newProductPriceTotal,
        requiredOptionTotal,
        subtotal: newSubtotal,
        totalPrice: newTotalPrice,
        balanceAmount: updated.onSiteBalanceAmount !== 0 ? updated.onSiteBalanceAmount : newBalance,
      }
    })
  }, [channels, dynamicPriceFormula, formData.channelId, reservationPricingId, reservationOptionsTotalPrice, setFormData])

  // 가격 계산 함수들
  const calculateProductPriceTotal = useCallback(() => {
    // 불포함 가격 제외하여 계산 (불포함 가격은 별도로 표시됨)
    return (formData.adultProductPrice * formData.pricingAdults) + 
           (formData.childProductPrice * formData.child) + 
           (formData.infantProductPrice * formData.infant)
  }, [formData.adultProductPrice, formData.childProductPrice, formData.infantProductPrice, formData.pricingAdults, formData.child, formData.infant])

  const calculateRequiredOptionTotal = useCallback(() => {
    let total = 0
    console.log('calculateRequiredOptionTotal 호출:', {
      requiredOptions: formData.requiredOptions,
      selectedOptions: formData.selectedOptions,
      pricingAdults: formData.pricingAdults,
      child: formData.child,
      infant: formData.infant
    })
    
    Object.entries(formData.requiredOptions).forEach(([optionId, option]) => {
      // 택일 옵션의 경우 selectedOptions에서 선택된 옵션만 계산
      const isSelected = formData.selectedOptions && 
        formData.selectedOptions[optionId] && 
        formData.selectedOptions[optionId].length > 0
      
      console.log(`옵션 ${optionId} 계산:`, {
        isSelected,
        option,
        pricingAdults: formData.pricingAdults,
        child: formData.child,
        infant: formData.infant,
        optionTotal: (option.adult * formData.pricingAdults) + (option.child * formData.child) + (option.infant * formData.infant)
      })
      
      if (isSelected) {
        const optionTotal = (option.adult * formData.pricingAdults) + 
                           (option.child * formData.child) + 
                           (option.infant * formData.infant)
        total += optionTotal
        console.log(`옵션 ${optionId} 총합 추가: ${optionTotal}, 현재 총합: ${total}`)
      }
    })
    
    console.log('최종 requiredOptionTotal:', total)
    return total
  }, [formData.requiredOptions, formData.selectedOptions, formData.pricingAdults, formData.child, formData.infant])

  // PricingSection과 동일: 쿠폰 할인 적용 전 기준 금액 (OTA는 productPriceTotal 기준, 그 외는 상품+필수옵션; 초이스 판매총액은 불포함과 중복이므로 제외)
  const getCouponDiscountSubtotal = useCallback(() => {
    const pax = formData.pricingAdults + formData.child + formData.infant
    const notIncludedPrice = (formData.not_included_price || 0) * pax
    const selectedChannel = channels.find(c => c.id === formData.channelId)
    const isOTAChannel = selectedChannel && (
      (selectedChannel as { type?: string; category?: string })?.type?.toLowerCase() === 'ota' ||
      (selectedChannel as { category?: string })?.category === 'OTA'
    )
    if (isOTAChannel) {
      return Math.max(0, (formData.productPriceTotal || 0) - notIncludedPrice)
    }
    const requiredOptionTotal = calculateRequiredOptionTotal()
    return Math.max(0, calculateProductPriceTotal() + requiredOptionTotal - notIncludedPrice)
  }, [
    formData.pricingAdults,
    formData.child,
    formData.infant,
    formData.not_included_price,
    formData.channelId,
    formData.productPriceTotal,
    channels,
    calculateProductPriceTotal,
    calculateRequiredOptionTotal,
  ])

  const calculateOptionTotal = useCallback(() => {
    let total = 0
    Object.values(formData.selectedOptionalOptions).forEach(option => {
      total += option.price * option.quantity
    })
    return total
  }, [formData.selectedOptionalOptions])

  const calculateSubtotal = useCallback(() => {
    const requiredOptionTotal = calculateRequiredOptionTotal()
    const optionalOptionTotal = calculateOptionTotal()
    const notIncludedTotal = formData.choiceNotIncludedTotal || 0
    // choicesTotal(초이스 판매 합)은 불포함·동적가격과 중복되므로 합산하지 않음
    return calculateProductPriceTotal() + requiredOptionTotal + optionalOptionTotal + notIncludedTotal
  }, [formData.choiceNotIncludedTotal, calculateRequiredOptionTotal, calculateProductPriceTotal, calculateOptionTotal])

  const calculateTotalPrice = useCallback(() => {
    const subtotal = calculateSubtotal()
    const totalDiscount = formData.couponDiscount + formData.additionalDiscount
    const refundAmount = Number(formData.refundAmount) || 0
    // Grand Total에는 추가비용, 세금, 카드 수수료, 선결제 지출, 선결제 팁이 모두 포함됨
    const totalAdditional = formData.additionalCost + formData.cardFee + formData.tax +
      formData.prepaymentCost + formData.prepaymentTip +
      (formData.isPrivateTour ? formData.privateTourAdditionalCost : 0) +
      reservationOptionsTotalPrice

    // 총 가격(고객 총지불 기준, balance는 별도로 표시만 함)
    const grossTotal = Math.max(0, subtotal - totalDiscount + totalAdditional - refundAmount)
    return grossTotal
  }, [calculateSubtotal, formData.couponDiscount, formData.additionalDiscount, formData.refundAmount, formData.additionalCost, formData.cardFee, formData.tax, formData.prepaymentCost, formData.prepaymentTip, formData.isPrivateTour, formData.privateTourAdditionalCost, reservationOptionsTotalPrice])

  const calculateBalance = useCallback(() => {
    return Math.max(0, formData.totalPrice - formData.depositAmount)
  }, [formData.totalPrice, formData.depositAmount])

  /** Follow-up 파이프라인·이메일 미리보기용: 폼에 수정 중인 값 반영 */
  const followUpPipelineReservationMerged = useMemo((): Reservation | null => {
    if (!reservation || !effectiveReservationId) return null
    return {
      ...reservation,
      status: formData.status as Reservation['status'],
      productId: formData.productId,
      tourDate: formData.tourDate,
      pickUpTime: formData.pickUpTime,
      channelRN: formData.channelRN,
      customerId: formData.customerId || reservation.customerId,
    }
  }, [
    reservation,
    effectiveReservationId,
    formData.status,
    formData.productId,
    formData.tourDate,
    formData.pickUpTime,
    formData.channelRN,
    formData.customerId,
  ])

  // 쿠폰 할인 계산 함수
  const calculateCouponDiscount = useCallback((coupon: CouponRow, subtotal: number) => {
    if (!coupon) return 0
    
    console.log('쿠폰 할인 계산:', { coupon, subtotal }) // 디버깅용
    
    // 새로운 스키마 사용: discount_type, percentage_value, fixed_value
    if (coupon.discount_type === 'percentage' && coupon.percentage_value) {
      return (subtotal * (Number(coupon.percentage_value) || 0)) / 100
    } else if (coupon.discount_type === 'fixed' && coupon.fixed_value) {
      return Number(coupon.fixed_value) || 0
    }
    
    return 0
  }, [])

  // 쿠폰 자동 선택 함수 (이메일 금액 없을 때: 채널·상품·날짜에 맞는 쿠폰 중 고정 우선)
  const autoSelectCoupon = useCallback(() => {
    if (reservationPricingIdRef.current) {
      return
    }
    const savedResId = reservation?.id
    if (
      savedResId &&
      !String(savedResId).startsWith('import-') &&
      !pricingLoadComplete
    ) {
      return
    }
    if (!formData.productId || !formData.tourDate || !formData.channelId) {
      return
    }

    console.log('쿠폰 자동 선택 시작:', {
      productId: formData.productId,
      tourDate: formData.tourDate,
      channelId: formData.channelId
    })

    const tourDate = new Date(formData.tourDate)
    const matchingCoupons = coupons.filter(coupon => {
      if (coupon.status !== 'active') return false
      if (!couponMatchesChannel(coupon, formData.channelId)) return false
      if (coupon.product_id && coupon.product_id !== formData.productId) return false
      if (coupon.start_date) {
        const startDate = new Date(coupon.start_date)
        if (tourDate < startDate) return false
      }
      if (coupon.end_date) {
        const endDate = new Date(coupon.end_date)
        if (tourDate > endDate) return false
      }
      return true
    })

    console.log('매칭되는 쿠폰들:', matchingCoupons)

    if (matchingCoupons.length > 0) {
      const selectedCoupon = matchingCoupons.reduce((best, current) => {
        if (current.discount_type === 'fixed' && current.fixed_value &&
            (!best || best.discount_type !== 'fixed' || (best.fixed_value || 0) < current.fixed_value)) {
          return current
        }
        if (current.discount_type === 'percentage' && current.percentage_value &&
            (!best || best.discount_type !== 'percentage' || (best.percentage_value || 0) < current.percentage_value)) {
          return current
        }
        return best
      })

      if (selectedCoupon) {
        console.log('자동 선택된 쿠폰:', selectedCoupon)
        const subtotal = getCouponDiscountSubtotal()
        const couponDiscount = calculateCouponDiscount(selectedCoupon, subtotal)
        setFormData(prev => ({
          ...prev,
          couponCode: selectedCoupon.coupon_code || '',
          couponDiscount: couponDiscount
        }))
      }
    } else {
      setFormData(prev => ({
        ...prev,
        couponCode: '',
        couponDiscount: 0
      }))
    }
  }, [
    reservation?.id,
    pricingLoadComplete,
    formData.productId,
    formData.tourDate,
    formData.channelId,
    coupons,
    getCouponDiscountSubtotal,
    calculateCouponDiscount,
    setFormData,
  ])

  /** 예약 가져오기: 이메일 금액과 맞도록 쿠폰 선택 (product_id 없음 = 채널 공통 쿠폰 포함).
   *  Viator compareSettlementToNet: PricingSection·`computeChannelSettlementAmount`와 동일한 채널 정산 금액을 Net Rate와 비교.
   *  일치하면 쿠폰을 건드리지 않음. 불일치할 때만 9% 쿠폰을 시도.
   *  `formDataRef`로 최신 상태를 읽고 콜백 의존성에서 couponDiscount를 빼서, 사용자가 쿠폰을 해제해도 effect만으로 재강제되지 않게 함. */
  const applyCouponToMatchEmailAmount = useCallback(
    (emailTarget: number, opts?: { compareSettlementToNet?: boolean }) => {
      if (reservationPricingIdRef.current) {
        return
      }
      const fd = formDataRef.current
      if (!fd.productId || !fd.tourDate || !fd.channelId) return
      const compareSettlementToNet = opts?.compareSettlementToNet === true
      if (compareSettlementToNet && viatorImportCouponUserAdjustedRef.current) return
      const base = getCouponDiscountSubtotal()
      const productTotal = fd.productPriceTotal || 0
      const additionalDisc = fd.additionalDiscount || 0
      const channelRow = channels.find(c => c.id === fd.channelId)
      const commissionPctForKey =
        fd.commission_percent != null && fd.commission_percent > 0
          ? Number(fd.commission_percent)
          : Number(
              (channelRow as { commission_percent?: number; commission_rate?: number; commission?: number })
                ?.commission_percent ??
                (channelRow as { commission_rate?: number })?.commission_rate ??
                (channelRow as { commission?: number })?.commission
            ) || 0
      const toN = (v: unknown) => (v !== null && v !== undefined && v !== '' ? Number(v) : 0)
      const billingPax = (fd.pricingAdults ?? fd.adults) + fd.child + fd.infant
      const notIncludedTotal = (Number(fd.not_included_price) || 0) * (billingPax || 1)
      const productTotalForSettlement = (Number(fd.productPriceTotal) || 0) + notIncludedTotal
      const commissionBaseForRow = toN(fd.commission_base_price) || toN(fd.onlinePaymentAmount)
      const onlinePaymentForCompute = toN(fd.onlinePaymentAmount) || commissionBaseForRow
      const key = `${fd.productId}|${emailTarget.toFixed(2)}|${base.toFixed(2)}|${productTotalForSettlement.toFixed(2)}|${additionalDisc.toFixed(2)}|${(fd.couponDiscount || 0).toFixed(2)}|${onlinePaymentForCompute.toFixed(2)}|${toN(fd.commission_amount).toFixed(4)}|${commissionPctForKey.toFixed(4)}|${fd.channelId}|${compareSettlementToNet ? 'net' : 'price'}`
      if (base <= 0) return
      if (emailCouponApplyRef.current === key) return

      const tourDate = new Date(fd.tourDate)
      const matchingCoupons = coupons.filter(coupon => {
        if (coupon.status !== 'active') return false
        if (!couponMatchesChannel(coupon, fd.channelId)) return false
        if (coupon.product_id && coupon.product_id !== fd.productId) return false
        if (coupon.start_date) {
          const startDate = new Date(coupon.start_date)
          if (tourDate < startDate) return false
        }
        if (coupon.end_date) {
          const endDate = new Date(coupon.end_date)
          if (tourDate > endDate) return false
        }
        return true
      })

      if (compareSettlementToNet) {
        const isOTAChannel = !!(
          channelRow &&
          (((channelRow as { type?: string }).type?.toLowerCase() === 'ota') ||
            (channelRow as { category?: string }).category === 'OTA')
        )
        let commissionAmt = toN(fd.commission_amount)
        if (commissionAmt < 0.005 && isOTAChannel) {
          const pct =
            fd.commission_percent != null && fd.commission_percent > 0
              ? Number(fd.commission_percent)
              : commissionPctForKey
          const basePrice =
            fd.commission_base_price !== undefined &&
            fd.commission_base_price !== null &&
            String(fd.commission_base_price) !== ''
              ? Number(fd.commission_base_price)
              : onlinePaymentForCompute ||
                Math.max(0, productTotalForSettlement - toN(fd.couponDiscount) - toN(fd.additionalDiscount))
          const adjustedBase = Math.max(0, basePrice)
          if (pct > 0 && pct <= 100 && adjustedBase > 0) {
            commissionAmt = Math.round(adjustedBase * (pct / 100) * 100) / 100
          }
        }

        const settlementUi = computeChannelSettlementAmount({
          depositAmount: toN(fd.depositAmount),
          onlinePaymentAmount: onlinePaymentForCompute,
          productPriceTotal: productTotalForSettlement,
          couponDiscount: toN(fd.couponDiscount),
          additionalDiscount: toN(fd.additionalDiscount),
          optionTotalSum: toN(fd.optionTotal),
          additionalCost: toN(fd.additionalCost),
          tax: toN(fd.tax),
          cardFee: toN(fd.cardFee),
          prepaymentTip: toN(fd.prepaymentTip),
          onSiteBalanceAmount: toN(fd.onSiteBalanceAmount ?? fd.balanceAmount),
          returnedAmount: 0,
          commissionAmount: commissionAmt,
          reservationStatus: fd.status,
          isOTAChannel,
        })

        if (Math.abs(settlementUi - emailTarget) < 0.02) {
          emailCouponApplyRef.current = key
          return
        }

        let nineCoupon = matchingCoupons.find(c => isNinePercentCouponForViator(c))
        if (!nineCoupon) {
          nineCoupon = coupons.find(c => {
            if (c.status !== 'active') return false
            if (!couponMatchesChannel(c, fd.channelId)) return false
            if (c.start_date) {
              const startDate = new Date(c.start_date)
              if (tourDate < startDate) return false
            }
            if (c.end_date) {
              const endDate = new Date(c.end_date)
              if (tourDate > endDate) return false
            }
            return isNinePercentCouponForViator(c)
          })
        }
        if (nineCoupon) {
          const couponDiscount = calculateCouponDiscount(nineCoupon, base)
          console.log('Viator Net Rate: 채널정산(표시 산식) 불일치 → 9% 쿠폰', {
            emailTarget,
            settlementUi,
            commissionAmt,
            onlinePaymentForCompute,
            coupon: nineCoupon.coupon_code,
            couponDiscount,
          })
          setFormData(prev => ({
            ...prev,
            couponCode: nineCoupon.coupon_code || '',
            couponDiscount,
          }))
          emailCouponApplyRef.current = key
        } else if (matchingCoupons.length === 0) {
          console.warn('[Viator import] 9% 쿠폰 없음: 매칭 쿠폰 0건 (채널·상품·기간 필터). coupons 총', coupons.length)
        } else {
          console.warn('[Viator import] 9% 비율 쿠폰 없음. 매칭 후보:', matchingCoupons.map(c => c.coupon_code).join(', '))
        }
        return
      }

      if (Math.abs(base - emailTarget) < 0.02) {
        setFormData(prev => ({ ...prev, couponCode: '', couponDiscount: 0 }))
        emailCouponApplyRef.current = key
        return
      }

      const errWithoutCoupon = Math.abs(base - emailTarget)
      let best: { coupon: CouponRow | null; err: number } = { coupon: null, err: errWithoutCoupon }

      for (const c of matchingCoupons) {
        const disc = calculateCouponDiscount(c, base)
        const err = Math.abs(base - disc - emailTarget)
        if (err < best.err - 0.0001) best = { coupon: c, err }
      }

      if (best.coupon) {
        const couponDiscount = calculateCouponDiscount(best.coupon, base)
        console.log('이메일 금액에 맞춘 쿠폰:', {
          emailTarget,
          base,
          productTotal,
          additionalDisc,
          compareSettlementToNet: false,
          coupon: best.coupon.coupon_code,
          err: best.err,
          errWithoutCoupon,
          couponDiscount,
        })
        setFormData(prev => ({
          ...prev,
          couponCode: best.coupon!.coupon_code || '',
          couponDiscount,
        }))
        emailCouponApplyRef.current = key
      }
    },
    [channels, coupons, getCouponDiscountSubtotal, calculateCouponDiscount, setFormData]
  )

  const isImportViatorNetRateMode =
    isImportMode && parseMoneyFromImportString(initialViatorNetRateFromImport) != null

  const pricingSectionAutoSelectCoupon = useCallback(() => {
    if (reservationPricingIdRef.current) {
      return
    }
    if (isImportViatorNetRateMode) {
      viatorImportCouponUserAdjustedRef.current = false
      emailCouponApplyRef.current = ''
    }
    autoSelectCoupon()
  }, [isImportViatorNetRateMode, autoSelectCoupon])

  // 상품이 변경될 때 choice 데이터 로드 (편집 모드에서는 기존 데이터 보존)
  useEffect(() => {
    console.log('ReservationForm: 상품 변경 useEffect 실행:', {
      productId: formData.productId,
      prevProductId: prevProductId.current,
      isDifferent: formData.productId !== prevProductId.current,
      isEditMode: !!reservation?.id,
      hasProductChoices: formData.productChoices && formData.productChoices.length > 0,
      hasSelectedChoices: formData.selectedChoices && formData.selectedChoices.length > 0
    })
    
    // 상품이 변경될 때마다 초이스 로드
    if (formData.productId && formData.productId !== prevProductId.current) {
      console.log('ReservationForm: 상품 변경 감지 - 새로운 테이블에서 초이스 로드:', formData.productId)
      prevProductId.current = formData.productId

      /** 예약 가져오기(import-): DB에 저장된 예약이 아니므로 편집 모드 초이스 스킵 규칙을 쓰지 않고, 상품이 바뀔 때마다 무조건 로드 */
      if (isImportMode) {
        console.log('ReservationForm: 예약 가져오기 — 상품별 초이스 강제 로드')
        loadProductChoices(formData.productId, formData.channelId)
        return
      }

      const isEditModeWithSavedReservation = !!reservation?.id
      // 편집 모드에서는 loadReservationChoicesFromNewTable이 이미 초이스를 로드했을 수 있음
      // productChoices와 selectedChoices가 모두 있으면 스킵
      if (isEditModeWithSavedReservation && formData.productChoices && formData.productChoices.length > 0 && 
          formData.selectedChoices && formData.selectedChoices.length > 0) {
        console.log('ReservationForm: 편집 모드 - 이미 초이스가 로드되어 있음, 스킵', {
          productChoicesCount: formData.productChoices.length,
          selectedChoicesCount: formData.selectedChoices.length
        })
        return
      }
      
      // 편집 모드에서는 loadReservationChoicesFromNewTable이 초이스를 로드하므로
      // loadProductChoices를 호출하지 않음 (productChoices만 필요한 경우는 이미 로드됨)
      if (isEditModeWithSavedReservation) {
        // productChoices가 없으면 로드 (selectedChoices는 loadReservationChoicesFromNewTable에서 로드됨)
        if (!formData.productChoices || formData.productChoices.length === 0) {
          console.log('ReservationForm: 편집 모드 - productChoices만 로드 (selectedChoices는 loadReservationChoicesFromNewTable에서 로드됨)')
          loadProductChoices(formData.productId, formData.channelId)
        } else {
          console.log('ReservationForm: 편집 모드 - productChoices가 이미 있음, loadProductChoices 스킵')
        }
        return
      }
      
      // 새 예약 모드인 경우에만 초이스 로드
      if (!formData.productChoices || formData.productChoices.length === 0) {
        console.log('ReservationForm: 새 예약 모드 - 초이스 로드 시작')
        loadProductChoices(formData.productId, formData.channelId)
      }
    }
  }, [formData.productId, formData.productChoices, formData.selectedChoices, loadProductChoices, reservation?.id, isImportMode])

  // 예약 가져오기: resolveImportChannelVariantKey 반영 후 variantKey 동기화 (가격 effect가 같은 틱에서 올바른 variant 사용)
  useLayoutEffect(() => {
    if (!isImportMode) return
    const raw =
      (initialVariantKeyFromImport && String(initialVariantKeyFromImport).trim()) ||
      (String((reservation as { variant_key?: string })?.variant_key ?? '').trim()) ||
      ''
    const vk = (
      resolveImportChannelVariantKey(raw || undefined, initialChannelVariantLabelFromImport) ||
      raw ||
      ''
    ).trim()
    if (!vk || vk === 'default') return
    const cur = formDataRef.current.variantKey || 'default'
    if (cur === vk) return
    setFormData((prev) => ({ ...prev, variantKey: vk }))
    prevPricingParams.current = null
  }, [isImportMode, initialVariantKeyFromImport, (reservation as { variant_key?: string })?.variant_key, initialChannelVariantLabelFromImport, setFormData])

  // 예약 가져오기(import-): 상품은 그대로인데 재파싱 등으로 initialChoiceOptionNames만 채워진 경우 — 초이스 다시 로드
  useEffect(() => {
    if (!isImportMode || !formData.productId) return
    loadProductChoices(formData.productId, formData.channelId)
  }, [isImportMode, formData.productId, formData.channelId, importChoiceHintKey, loadProductChoices])

  // 상품, 날짜, 채널, variant, 초이스가 변경될 때 dynamic pricing에서 가격 자동 조회 (새 예약 모달과 동일)
  useEffect(() => {
    const tourDateNorm = normalizeTourDateForDb(formData.tourDate) || formData.tourDate?.trim() || ''
    if (!formData.productId || !tourDateNorm || !formData.channelId) return
    if (needsEditChoicesHydration && !editPricingChoicesReady) {
      return
    }
    if (
      isImportMode &&
      formData.productId &&
      importChoicesHydratedProductId !== formData.productId
    ) {
      return
    }
    const selectedChoicesArray = Array.isArray(formData.selectedChoices) ? formData.selectedChoices : []
    const selectedChoicesKey = JSON.stringify(selectedChoicesArray.map(c => ({ choice_id: c.choice_id, option_id: c.option_id })))
    const currentParams = {
      productId: formData.productId,
      tourDate: tourDateNorm,
      channelId: formData.channelId,
      variantKey: formData.variantKey || 'default',
      selectedChoicesKey
    }
    if (!prevPricingParams.current ||
        prevPricingParams.current.productId !== currentParams.productId ||
        prevPricingParams.current.tourDate !== currentParams.tourDate ||
        prevPricingParams.current.channelId !== currentParams.channelId ||
        prevPricingParams.current.variantKey !== currentParams.variantKey ||
        prevPricingParams.current.selectedChoicesKey !== currentParams.selectedChoicesKey) {
      console.log('가격 자동 조회 트리거:', currentParams)
      prevPricingParams.current = currentParams
      const isRealReservationId = reservation?.id && !String(reservation.id).startsWith('import-')
      if (isRealReservationId) setIsExistingPricingLoaded(true)
      loadPricingInfo(formData.productId, tourDateNorm, formData.channelId, reservation?.id, selectedChoicesArray)
    }
  }, [formData.productId, formData.tourDate, formData.channelId, formData.variantKey, formData.selectedChoices, formData.productChoices, reservation?.id, loadPricingInfo, isImportMode, importChoicesHydratedProductId, needsEditChoicesHydration, editPricingChoicesReady])

  // 이메일에서 예약 가져오기: 상위에서 넘긴 reservation에 상품·날짜·채널이 있으면 새 예약 모달과 동일한 방식으로 loadPricingInfo 한 번 호출
  useEffect(() => {
    if (!isImportMode || !reservation) return
    const rez = reservation as RezLike
    const productId = rez.product_id
    const tourDateRaw = rez.tour_date
    const tourDateNorm = normalizeTourDateForDb(String(tourDateRaw ?? '')) || String(tourDateRaw ?? '').trim() || ''
    const channelId = rez.channel_id
    if (!productId || !tourDateNorm || !channelId) return
    if (importChoicesHydratedProductId !== productId) return
    const selectedChoicesArray = Array.isArray(formData.selectedChoices) ? formData.selectedChoices : []
    const selectedChoicesKey = JSON.stringify(selectedChoicesArray.map(c => ({ choice_id: c.choice_id, option_id: c.option_id })))
    const variantKey = formData.variantKey || 'default'
    const currentParams = { productId, tourDate: tourDateNorm, channelId, variantKey, selectedChoicesKey }
    if (prevPricingParams.current &&
        prevPricingParams.current.productId === currentParams.productId &&
        prevPricingParams.current.tourDate === currentParams.tourDate &&
        prevPricingParams.current.channelId === currentParams.channelId &&
        prevPricingParams.current.variantKey === currentParams.variantKey &&
        prevPricingParams.current.selectedChoicesKey === currentParams.selectedChoicesKey) return
    prevPricingParams.current = currentParams
    loadPricingInfo(productId, tourDateNorm, channelId, reservation?.id, selectedChoicesArray)
  }, [isImportMode, (reservation as any)?.product_id, (reservation as any)?.tour_date, (reservation as any)?.channel_id, reservation?.id, formData.variantKey, formData.selectedChoices, loadPricingInfo, importChoicesHydratedProductId])

  // 상품·채널·날짜·이메일 금액 변경 시 이메일 기준 쿠폰 재시도 가능하도록 (수동 쿠폰 조작 플래그도 초기화)
  useEffect(() => {
    emailCouponApplyRef.current = ''
    viatorImportCouponUserAdjustedRef.current = false
  }, [
    formData.productId,
    formData.channelId,
    formData.tourDate,
    initialAmountFromImport,
    initialViatorNetRateFromImport,
  ])

  // 상품, 날짜, 채널이 변경될 때 쿠폰 자동 선택 (예약 가져오기는 아래 전용 effect에서 마지막에 처리)
  useEffect(() => {
    if (!formData.productId || !formData.tourDate || !formData.channelId) return
    if (isImportMode) return

    const savedResId = reservation?.id
    if (
      savedResId &&
      !String(savedResId).startsWith('import-') &&
      !pricingLoadComplete
    ) {
      return
    }
    if (reservationPricingId) return
    if (isExistingPricingLoaded) return

    const currentParams = {
      productId: formData.productId,
      tourDate: formData.tourDate,
      channelId: formData.channelId
    }
    if (!prevCouponParams.current ||
        prevCouponParams.current.productId !== currentParams.productId ||
        prevCouponParams.current.tourDate !== currentParams.tourDate ||
        prevCouponParams.current.channelId !== currentParams.channelId) {
      console.log('쿠폰 자동 선택 실행 (기존 가격 정보 없음)')
      prevCouponParams.current = currentParams
      autoSelectCoupon()
    }
  }, [
    formData.productId,
    formData.tourDate,
    formData.channelId,
    formData.productPriceTotal,
    formData.not_included_price,
    reservation?.id,
    pricingLoadComplete,
    reservationPricingId,
    isExistingPricingLoaded,
    isImportMode,
    autoSelectCoupon,
  ])

  // 가격 정보 자동 업데이트 (무한 렌더링 방지를 위해 useEffect 완전 제거)
  // 사용되지 않지만 향후 사용을 위해 주석 처리
  /*
  const updatePrices = useCallback(() => {
    setFormData(prev => {
      // 현재 상태를 기반으로 계산
      const newProductPriceTotal = (prev.adultProductPrice * prev.adults) + 
                                   (prev.childProductPrice * prev.child) + 
                                   (prev.infantProductPrice * prev.infant)
      
      // requiredOptionTotal 계산
      let requiredOptionTotal = 0
      Object.entries(prev.requiredOptions).forEach(([optionId, option]) => {
        const isSelected = prev.selectedOptions && 
          prev.selectedOptions[optionId] && 
          prev.selectedOptions[optionId].length > 0
        if (isSelected) {
          requiredOptionTotal += (option.adult * prev.adults) + 
                                (option.child * prev.child) + 
                                (option.infant * prev.infant)
        }
      })
      
      // choicesTotal 또는 requiredOptionTotal 사용
      const choicesTotal = prev.choicesTotal || 0
      const optionTotal = choicesTotal > 0 ? choicesTotal : requiredOptionTotal
      
      // 선택 옵션 총합 계산
      let optionalOptionTotal = 0
      Object.values(prev.selectedOptionalOptions).forEach(option => {
        optionalOptionTotal += option.price * option.quantity
      })
      
      const notIncludedTotal = prev.choiceNotIncludedTotal || 0
      
      const newSubtotal = newProductPriceTotal + optionTotal + optionalOptionTotal + notIncludedTotal
      const totalDiscount = prev.couponDiscount + prev.additionalDiscount
      const refundAmount = Number(prev.refundAmount) || 0
      const totalAdditional = prev.additionalCost + prev.cardFee + prev.tax +
        prev.prepaymentCost + prev.prepaymentTip +
        (prev.isPrivateTour ? prev.privateTourAdditionalCost : 0) +
        reservationOptionsTotalPrice
      const newTotalPrice = Math.max(0, newSubtotal - totalDiscount + totalAdditional - refundAmount)
      const newBalance = Math.max(0, newTotalPrice - prev.depositAmount)
      
      return {
        ...prev,
        productPriceTotal: newProductPriceTotal,
        requiredOptionTotal: requiredOptionTotal,
        choicesTotal: choicesTotal,
        subtotal: newSubtotal,
        totalPrice: newTotalPrice,
        balanceAmount: prev.onSiteBalanceAmount !== 0 ? prev.onSiteBalanceAmount : newBalance
      }
    })
  }, [reservationOptionsTotalPrice])
  */

  // 상품 가격 또는 인원 수가 변경될 때 productPriceTotal 및 subtotal 자동 업데이트
  useEffect(() => {
    // 불포함 가격 제외하여 계산 (불포함 가격은 별도로 표시됨)
    const newProductPriceTotal = (formData.adultProductPrice * formData.pricingAdults) + 
                                 (formData.childProductPrice * formData.child) + 
                                 (formData.infantProductPrice * formData.infant)
    
    // productPriceTotal이 다를 때만 업데이트 (무한 루프 방지)
    if (Math.abs(newProductPriceTotal - formData.productPriceTotal) > 0.01) {
      const requiredOptionTotal = calculateRequiredOptionTotal()
      const optionalOptionTotal = calculateOptionTotal()
      const notIncludedTotal = formData.choiceNotIncludedTotal || 0
      const newSubtotal = newProductPriceTotal + requiredOptionTotal + optionalOptionTotal + notIncludedTotal

      setFormData(prev => ({
        ...prev,
        productPriceTotal: newProductPriceTotal,
        subtotal: newSubtotal
      }))
    }
  }, [formData.adultProductPrice, formData.childProductPrice, formData.infantProductPrice, formData.pricingAdults, formData.child, formData.infant, formData.choiceNotIncludedTotal, calculateRequiredOptionTotal, calculateOptionTotal])

  // 예약 옵션 총 가격이 변경될 때 가격 재계산 (편집 모드에서는 자동 저장 방지)
  useEffect(() => {
    // 편집 모드에서는 자동으로 가격을 업데이트하지 않음
    if (reservation?.id) {
      return
    }
    
    const newTotalPrice = calculateTotalPrice()
    const newBalance = calculateBalance()

    setFormData(prev => ({
      ...prev,
      totalPrice: newTotalPrice,
      balanceAmount: prev.onSiteBalanceAmount !== 0 ? prev.onSiteBalanceAmount : newBalance
    }))
  }, [reservationOptionsTotalPrice, reservation?.id])

  /** 예약 가져오기: 동적가격·초이스·productPriceTotal 동기화·PricingSection 정산 반영 후 마지막에 이메일 금액 기준 쿠폰 매칭 */
  useEffect(() => {
    if (!isImportMode) return
    if (!formData.productId || !formData.tourDate || !formData.channelId) return
    if (!pricingLoadComplete) return
    if (importChoicesHydratedProductId !== formData.productId) return

    const viatorNetParsed = parseMoneyFromImportString(initialViatorNetRateFromImport)
    const emailParsed = parseMoneyFromImportString(initialAmountFromImport)
    if (viatorNetParsed == null && emailParsed == null) return

    if (importEmailCouponRafRef.current != null) {
      cancelAnimationFrame(importEmailCouponRafRef.current)
      importEmailCouponRafRef.current = null
    }
    if (importEmailCouponTimerRef.current != null) {
      clearTimeout(importEmailCouponTimerRef.current)
      importEmailCouponTimerRef.current = null
    }

    importEmailCouponRafRef.current = requestAnimationFrame(() => {
      importEmailCouponRafRef.current = null
      importEmailCouponTimerRef.current = setTimeout(() => {
        importEmailCouponTimerRef.current = null
        if (viatorNetParsed != null) {
          applyCouponToMatchEmailAmount(viatorNetParsed, { compareSettlementToNet: true })
        } else if (emailParsed != null) {
          applyCouponToMatchEmailAmount(emailParsed)
        }
      }, 50)
    })

    return () => {
      if (importEmailCouponRafRef.current != null) {
        cancelAnimationFrame(importEmailCouponRafRef.current)
        importEmailCouponRafRef.current = null
      }
      if (importEmailCouponTimerRef.current != null) {
        clearTimeout(importEmailCouponTimerRef.current)
        importEmailCouponTimerRef.current = null
      }
    }
  }, [
    isImportMode,
    pricingLoadComplete,
    importChoicesHydratedProductId,
    formData.productId,
    formData.tourDate,
    formData.channelId,
    formData.commission_base_price,
    formData.onlinePaymentAmount,
    formData.productPriceTotal,
    formData.not_included_price,
    formData.pricingAdults,
    formData.child,
    formData.infant,
    initialAmountFromImport,
    initialViatorNetRateFromImport,
    applyCouponToMatchEmailAmount,
    coupons,
    formData.commission_percent,
    formData.commission_amount,
  ])

  // dynamic_pricing에서 특정 choice의 가격 정보를 가져오는 함수
  const getDynamicPricingForOption = useCallback(async (choiceId: string) => {
    const tourDateNorm = normalizeTourDateForDb(formData.tourDate) || formData.tourDate?.trim() || ''
    if (!formData.productId || !tourDateNorm || !formData.channelId) {
      return null
    }

    try {
      const variantKey = formData.variantKey || 'default'
      let pricingData: any[] | null = null
      let err: any = null
      const res = await (supabase as any)
        .from('dynamic_pricing')
        .select('choices_pricing, updated_at')
        .eq('product_id', formData.productId)
        .eq('date', tourDateNorm)
        .eq('channel_id', formData.channelId)
        .eq('variant_key', variantKey)
        .order('updated_at', { ascending: false })
        .limit(1)
      pricingData = res.data
      err = res.error
      if (!pricingData || pricingData.length === 0) {
        if (variantKey !== 'default') {
          const resDefault = await (supabase as any)
            .from('dynamic_pricing')
            .select('choices_pricing, updated_at')
            .eq('product_id', formData.productId)
            .eq('date', tourDateNorm)
            .eq('channel_id', formData.channelId)
            .eq('variant_key', 'default')
            .order('updated_at', { ascending: false })
            .limit(1)
          if (!err && (resDefault.data?.length ?? 0) > 0) {
            pricingData = resDefault.data
          }
        }
        if ((!pricingData || pricingData.length === 0) && !err) {
          const resAny = await (supabase as any)
            .from('dynamic_pricing')
            .select('choices_pricing, updated_at')
            .eq('product_id', formData.productId)
            .eq('date', tourDateNorm)
            .eq('channel_id', formData.channelId)
            .order('updated_at', { ascending: false })
            .limit(1)
          if ((resAny.data?.length ?? 0) > 0) {
            pricingData = resAny.data
          }
        }
      }

      if (err || !pricingData || pricingData.length === 0) {
        return null
      }

      const pricing = pricingData[0] as { choices_pricing?: any }
      if (pricing.choices_pricing && typeof pricing.choices_pricing === 'object') {
        // choices_pricing에서 해당 choice ID의 가격 정보 찾기
        const choicePricing = pricing.choices_pricing[choiceId]
        if (choicePricing) {
          return {
            adult: choicePricing.adult || choicePricing.adult_price || 0,
            child: choicePricing.child || choicePricing.child_price || 0,
            infant: choicePricing.infant || choicePricing.infant_price || 0
          }
        }
      }

      return null
    } catch (error) {
      console.error('Dynamic pricing choice 조회 중 오류:', error)
      return null
    }
  }, [formData.productId, formData.tourDate, formData.channelId, formData.variantKey])

  const getSuperNotificationRecipients = useCallback(async () => {
    const { data } = await (supabase as any)
      .from('team')
      .select('email')
      .eq('is_active', true)
      .ilike('position', 'super')

    const emails = new Set<string>(
      ((data || []) as Array<{ email?: string | null }>)
        .map((row) => row.email?.trim().toLowerCase())
        .filter((email): email is string => Boolean(email))
    )
    emails.add('info@maniatour.com')
    emails.add('wooyong.shim09@gmail.com')
    if (authUser?.email) emails.delete(authUser.email.trim().toLowerCase())
    return [...emails]
  }, [authUser?.email])

  const insertPricingAuditNotifications = useCallback(
    async (
      reservationId: string,
      type: 'modification_request' | 'audited_pricing_updated',
      message: string,
      requestId?: string | null
    ) => {
      const recipients = await getSuperNotificationRecipients()
      if (recipients.length === 0 || !authUser?.email) return

      const actorName = auditDisplayName(currentTeamProfile, authUser.email)
      const rows = recipients.map((recipientEmail) => ({
        reservation_id: reservationId,
        reservation_pricing_id: reservationPricingId,
        request_id: requestId ?? null,
        recipient_email: recipientEmail,
        actor_email: authUser.email,
        actor_name: currentTeamProfile?.name || actorName,
        actor_nick_name: currentTeamProfile?.nickName || actorName,
        notification_type: type,
        message,
      }))

      const { error } = await (supabase as any)
        .from('reservation_pricing_audit_notifications')
        .insert(rows)
      if (error) {
        console.error('가격 감사 알림 생성 오류:', error)
      }
    },
    [authUser?.email, currentTeamProfile, getSuperNotificationRecipients, reservationPricingId]
  )

  const handleRequestPricingAuditModification = useCallback(async () => {
    if (!effectiveReservationId || !authUser?.email) {
      alert('예약 저장 후 수정 요청을 보낼 수 있습니다.')
      return
    }
    const reason = window.prompt('super 관리자에게 보낼 가격 정보 수정 요청 내용을 입력해 주세요.')
    if (!reason?.trim()) return

    const requesterName = auditDisplayName(currentTeamProfile, authUser.email)
    const { data, error } = await (supabase as any)
      .from('reservation_pricing_modification_requests')
      .insert({
        reservation_id: effectiveReservationId,
        reservation_pricing_id: reservationPricingId,
        requested_by_email: authUser.email,
        requested_by_name: currentTeamProfile?.name || requesterName,
        requested_by_nick_name: currentTeamProfile?.nickName || requesterName,
        reason: reason.trim(),
      })
      .select('id')
      .single()

    if (error) {
      console.error('가격 정보 수정 요청 오류:', error)
      alert('수정 요청을 보내는 중 오류가 발생했습니다.')
      return
    }

    await insertPricingAuditNotifications(
      effectiveReservationId,
      'modification_request',
      `Audited 가격 정보 수정 요청이 도착했습니다.\n\n요청자: ${requesterName}\n내용: ${reason.trim()}`,
      data?.id ?? null
    )
    alert('super 관리자에게 수정 요청을 보냈습니다.')
  }, [
    authUser?.email,
    currentTeamProfile,
    effectiveReservationId,
    insertPricingAuditNotifications,
    reservationPricingId,
  ])

  const handleTogglePricingAudited = useCallback(
    async (nextAudited: boolean) => {
      if (!effectiveReservationId || !reservationPricingId) {
        alert('가격 정보를 먼저 저장한 뒤 Audited 체크를 할 수 있습니다.')
        return
      }
      if (!isSuperPricingAdmin || !authUser?.email) {
        alert('Audited 체크는 super 관리자만 변경할 수 있습니다.')
        return
      }

      const actorName = auditDisplayName(currentTeamProfile, authUser.email)
      const auditedAtIso = nextAudited ? new Date().toISOString() : null
      const patch = nextAudited
        ? {
            audited: true,
            audited_at: auditedAtIso,
            audited_by_email: authUser.email,
            audited_by_name: currentTeamProfile?.name || actorName,
            audited_by_nick_name: currentTeamProfile?.nickName || actorName,
          }
        : {
            audited: false,
            audited_at: null,
            audited_by_email: null,
            audited_by_name: null,
            audited_by_nick_name: null,
          }

      const { error } = await (supabase as any)
        .from('reservation_pricing')
        .update(patch)
        .eq('id', reservationPricingId)

      if (error) {
        console.error('Audited 상태 변경 오류:', error)
        alert('Audited 상태 변경 중 오류가 발생했습니다.')
        return
      }

      // 예약 통계(채널 정산 등)의 금액 검증 체크는 reservations.amount_audited 를 사용함 — pricing Audited 와 동기화
      const amountAuditPayload = nextAudited
        ? { amount_audited: true, amount_audited_at: auditedAtIso, amount_audited_by: authUser.email }
        : { amount_audited: false, amount_audited_at: null, amount_audited_by: null }
      const { error: amountAuditSyncError } = await (supabase as any)
        .from('reservations')
        .update(amountAuditPayload)
        .eq('id', effectiveReservationId)
      if (amountAuditSyncError) {
        console.error('예약 금액 검증(통계) 동기화 오류:', amountAuditSyncError)
        alert(
          '가격 Audited는 저장되었으나, 예약 통계의 금액 검증 표시와 동기화하지 못했습니다. 잠시 후 통계에서 다시 시도해 주세요.\n' +
            (amountAuditSyncError.message || '')
        )
      }

      setPricingAudit({
        audited: nextAudited,
        auditedAt: nextAudited ? patch.audited_at : null,
        auditedByEmail: nextAudited ? authUser.email : null,
        auditedByName: nextAudited ? patch.audited_by_name : null,
        auditedByNickName: nextAudited ? patch.audited_by_nick_name : null,
      })
    },
    [authUser?.email, currentTeamProfile, effectiveReservationId, isSuperPricingAdmin, reservationPricingId]
  )

  // 가격 정보 저장 함수 (외부에서 호출 가능)
  // overrides: 입금 내역 반영 등으로 보증금/잔액만 갱신할 때 사용. 항상 formDataRef에서 최신 formData 사용.
  // 주의: 가격 로드 전에는 pricingAdults가 adults와 동일한 초기값이라, 입금만 갱신 시 pricing_adults를 UPDATE에 넣으면
  // DB에 저장된 청구 성인 수(예: 1)가 예약 인원(2)으로 덮어씌워지는 버그가 난다 → 기존 행 업데이트 시 해당 컬럼은 생략.
  const savePricingInfo = useCallback(async (
    reservationId: string,
    overrides?: { depositAmount?: number; balanceAmount?: number }
  ) => {
    try {
      const fd = formDataRef.current
      const isPartialPaymentSync = overrides != null
      // 기존 가격 정보 조회 (업데이트 시 0 덮어쓰기 방지를 위해 가격·수수료·잔액 컬럼 포함)
      const selectColumns = 'id, adult_product_price, child_product_price, infant_product_price, product_price_total, not_included_price, subtotal, total_price, choices_total, option_total, required_option_total, refund_reason, refund_amount, card_fee, tax, prepayment_cost, prepayment_tip, deposit_amount, balance_amount, commission_percent, commission_amount, commission_base_price, channel_settlement_amount, audited, audited_at, audited_by_email, audited_by_name, audited_by_nick_name'
      const { data: existingRow, error: checkError } = await (supabase as any)
        .from('reservation_pricing')
        .select(selectColumns)
        .eq('reservation_id', reservationId)
        .maybeSingle()

      const existing = checkError ? null : existingRow
      let pricingId: string
      if (existing?.id) {
        pricingId = existing.id
      } else {
        pricingId = crypto.randomUUID()
      }

      const existingAudited = Boolean((existing as any)?.audited)
      if (existingAudited && !isSuperPricingAdmin) {
        throw new Error('Audited 된 가격 정보는 super 관리자만 수정할 수 있습니다. 수정 요청을 보내 주세요.')
      }
      if (existingAudited && isSuperPricingAdmin && !isPartialPaymentSync) {
        const ok = window.confirm(
          '이 가격 정보는 Audited 상태입니다.\n수정 내용을 저장하면 다른 super 관리자에게 수정 알림이 전송됩니다.\n계속 저장할까요?'
        )
        if (!ok) throw new Error('AUDIT_SAVE_CANCELLED')
      }

      // 불포함 가격 합계(인원별) = product_price_total·subtotal·total_price에 포함하여 저장 (청구 인원 = pricingAdults+아동+유아)
      const billingPax = (fd.pricingAdults ?? fd.adults) + fd.child + fd.infant
      const notIncludedTotal = (Number(fd.not_included_price) || 0) * (billingPax || 1)

      const toNum = (v: unknown) => (v !== null && v !== undefined && v !== '' ? Number(v) : 0)
      const newAdult = toNum(fd.adultProductPrice)
      const newChild = toNum(fd.childProductPrice)
      const newInfant = toNum(fd.infantProductPrice)
      const newProductTotal = (toNum(fd.productPriceTotal) || 0) + notIncludedTotal
      const newNotIncluded = toNum(fd.not_included_price)
      const newSubtotal = (toNum(fd.subtotal) || 0) + notIncludedTotal
      const newTotal = (toNum(fd.totalPrice) || 0) + notIncludedTotal
      const newChoicesTotal = toNum(fd.choicesTotal)
      const newOptionTotal = toNum(fd.optionTotal)
      const newRequiredOptionTotal = toNum(fd.requiredOptionTotal)

      let returnedAmount = 0
      let partnerReceivedAmount = 0
      let paymentRecords: PaymentRecordLike[] = []
      try {
        const { data: payRows } = await (supabase as any)
          .from('payment_records')
          .select('amount, payment_status')
          .eq('reservation_id', reservationId)
        paymentRecords = (payRows || []).map((row: { payment_status?: string; amount?: number }) => ({
          payment_status: String(row.payment_status || ''),
          amount: Number(row.amount) || 0,
        }))
        paymentRecords.forEach((row) => {
          const status = row.payment_status || ''
          if (status === 'Partner Received') {
            partnerReceivedAmount += Number(row.amount) || 0
          }
          if (isReturnedPaymentStatus(status)) {
            returnedAmount += Number(row.amount) || 0
          }
        })
      } catch {
        returnedAmount = 0
        partnerReceivedAmount = 0
        paymentRecords = []
      }

      let isOTAChannel = false
      let isHomepageBooking = String(fd.channelId ?? '').trim() === 'M00001'
      try {
        if (fd.channelId) {
          const { data: chRow } = await (supabase as any)
            .from('channels')
            .select('type, category, name')
            .eq('id', fd.channelId)
            .maybeSingle()
          if (chRow) {
            isOTAChannel =
              String((chRow as any).type || '').toLowerCase() === 'ota' ||
              (chRow as any).category === 'OTA'
            const nm = String((chRow as { name?: string }).name || '')
            isHomepageBooking =
              isHomepageBooking ||
              nm.toLowerCase().includes('homepage') ||
              nm.includes('홈페이지')
          }
        }
      } catch {
        isOTAChannel = false
      }

      const depAmt = overrides?.depositAmount ?? toNum(fd.depositAmount)
      const storedCb =
        toNum(fd.commission_base_price) || toNum((existing as any)?.commission_base_price)

      const commissionGross =
        toNum(fd.onlinePaymentAmount) ||
        depAmt ||
        deriveCommissionGrossForSettlement(storedCb, {
          returnedAmount,
          depositAmount: depAmt,
          productPriceTotal: newProductTotal,
          isOTAChannel,
        }) ||
        storedCb

      const channelSettlementComputeInput = {
        depositAmount: depAmt,
        onlinePaymentAmount: commissionGross,
        productPriceTotal: newProductTotal,
        couponDiscount: Number(fd.couponDiscount) || 0,
        additionalDiscount: Number(fd.additionalDiscount) || 0,
        optionTotalSum: newOptionTotal,
        additionalCost: Number(fd.additionalCost) || 0,
        tax: Number(fd.tax) || 0,
        cardFee: Number(fd.cardFee) || 0,
        prepaymentTip: Number(fd.prepaymentTip) || 0,
        onSiteBalanceAmount: Number(fd.onSiteBalanceAmount ?? fd.balanceAmount) || 0,
        returnedAmount,
        partnerReceivedAmount,
        commissionAmount: Number(fd.commission_amount) || 0,
        reservationStatus: fd.status,
        isOTAChannel,
      }

      const channelPayNet = computeChannelPaymentAfterReturn(channelSettlementComputeInput)
      const pffd = pricingFieldsFromDbRef.current
      const channelPricingFieldsUserEdited =
        pffd.commission_base_price === false || pffd.onlinePaymentAmount === false
      const commissionBaseToSave = resolveCommissionBasePriceForPersistence({
        formCommissionBase: fd.commission_base_price,
        channelPayNet,
        channelPricingFieldsUserEdited,
      })
      const channelSettlementComputed = computeChannelSettlementAmount(channelSettlementComputeInput)

      const channelSettlementToSave = (() => {
        const m = fd.channelSettlementAmount
        if (m !== undefined && m !== null && String(m) !== '' && Number.isFinite(Number(m))) {
          return Math.round(Number(m) * 100) / 100
        }
        return Math.round(channelSettlementComputed * 100) / 100
      })()

      let storedMetrics: { company_total_revenue: number; operating_profit: number } | null = null
      if (!isPartialPaymentSync) {
        let reservationOptionsRows: Array<{
          reservation_id: string
          total_price?: unknown
          price?: unknown
          ea?: unknown
          status?: string | null
        }> = []
        try {
          const { data: optRows } = await (supabase as any)
            .from('reservation_options')
            .select('reservation_id, total_price, price, ea, status')
            .eq('reservation_id', reservationId)
          reservationOptionsRows = (optRows || []) as typeof reservationOptionsRows
        } catch {
          reservationOptionsRows = []
        }
        const optionActiveSum =
          aggregateReservationOptionSumsByReservationId(reservationOptionsRows).get(reservationId) ?? 0
        const optionCancelRefundUsd = sumReservationOptionCancelledRefundTotals(
          reservationOptionsRows as Array<{ status?: string | null; total_price?: number | null }>
        )
        const paySm = summarizePaymentRecordsForBalance(paymentRecords)
        const manualRefundAmt = Number(fd.refundAmount) || 0
        const refundForRevenue = computeRefundAmountForCompanyRevenueBlock({
          refundedFromRecords: paySm.refundedTotal,
          reservationOptionsActiveSum: optionActiveSum,
          optionCancelRefundUsd,
          manualRefundAmount: manualRefundAmt,
          isOTAChannel,
          returnedAmount,
        })
        const pricingAdultsVal = Math.max(0, Math.floor(Number(fd.pricingAdults ?? fd.adults) || 0))
        storedMetrics = computeStoredCompanyRevenueFields({
          channelSettlementBase: channelSettlementToSave,
          reservationStatus: fd.status,
          isOTAChannel,
          isHomepageBooking,
          reservationOptionsActiveSum: optionActiveSum,
          omitCtx: {
            usesStoredChannelSettlement: Number.isFinite(channelSettlementToSave),
            depositAmount: depAmt,
            onlinePaymentAmount: toNum(fd.onlinePaymentAmount),
            channelPaymentGross: commissionGross,
          },
          notIncludedPerPerson: toNum(fd.not_included_price),
          pricingAdults: pricingAdultsVal,
          child: fd.child || 0,
          infant: fd.infant || 0,
          ...(fd.residentStatusAmounts && Object.keys(fd.residentStatusAmounts).length > 0
            ? { residentStatusAmounts: fd.residentStatusAmounts }
            : {}),
          additionalDiscount: Number(fd.additionalDiscount) || 0,
          additionalCost: Number(fd.additionalCost) || 0,
          tax: Number(fd.tax) || 0,
          prepaymentCost: Number(fd.prepaymentCost) || 0,
          prepaymentTip: Number(fd.prepaymentTip) || 0,
          refundAmountForCompanyRevenueBlock: refundForRevenue,
        })
      }

      // 업데이트 시: 가격이 0이면 기존 DB 값을 유지 (의도치 않은 0 덮어쓰기 방지)
      const keep = (newVal: number, existingVal: unknown) =>
        existing && newVal === 0 && (toNum(existingVal) || 0) > 0 ? toNum(existingVal) : newVal

      // DB에 저장할 전체 컬럼을 명시적으로 구성 (타입 필터로 누락 방지)
      const pricingData = {
        id: pricingId,
        reservation_id: reservationId,
        adult_product_price: keep(newAdult, (existing as any)?.adult_product_price),
        child_product_price: keep(newChild, (existing as any)?.child_product_price),
        infant_product_price: keep(newInfant, (existing as any)?.infant_product_price),
        product_price_total: keep(newProductTotal, (existing as any)?.product_price_total),
        not_included_price: keep(newNotIncluded, (existing as any)?.not_included_price),
        required_options: fd.requiredOptions,
        required_option_total: keep(newRequiredOptionTotal, (existing as any)?.required_option_total),
        choices: fd.choices,
        choices_total: keep(newChoicesTotal, (existing as any)?.choices_total),
        subtotal: keep(newSubtotal, (existing as any)?.subtotal),
        coupon_code: fd.couponCode ?? '',
        coupon_discount: Number(fd.couponDiscount) || 0,
        additional_discount: Number(fd.additionalDiscount) || 0,
        additional_cost: Number(fd.additionalCost) || 0,
        refund_reason: String(fd.refundReason ?? '').trim() || null,
        refund_amount: Number(fd.refundAmount) || 0,
        /** 카드 수수료는 0 초기화를 허용 — `keep`으로 이전 DB값을 유지하면 사용자가 0으로 저장해도 반영되지 않음 */
        card_fee: Math.round(toNum(fd.cardFee) * 100) / 100,
        tax: keep(Number(fd.tax) || 0, (existing as any)?.tax),
        prepayment_cost: keep(Number(fd.prepaymentCost) || 0, (existing as any)?.prepayment_cost),
        prepayment_tip: keep(Number(fd.prepaymentTip) || 0, (existing as any)?.prepayment_tip),
        selected_options: fd.selectedOptionalOptions,
        option_total: keep(newOptionTotal, (existing as any)?.option_total),
        total_price: keep(newTotal, (existing as any)?.total_price),
        deposit_amount: overrides?.depositAmount ?? (Number(fd.depositAmount) || 0),
        balance_amount: overrides?.balanceAmount ?? (Number(fd.onSiteBalanceAmount ?? fd.balanceAmount) || 0),
        private_tour_additional_cost: Number(fd.privateTourAdditionalCost) || 0,
        commission_percent: Number(fd.commission_percent) || 0,
        commission_amount: keep(Number(fd.commission_amount) || 0, (existing as any)?.commission_amount),
        pricing_adults: Math.max(0, Math.floor(Number(fd.pricingAdults ?? fd.adults) || 0)),
        commission_base_price: keep(
          commissionBaseToSave,
          (existing as any)?.commission_base_price
        ),
        channel_settlement_amount: channelSettlementToSave,
        ...(storedMetrics
          ? {
              company_total_revenue: storedMetrics.company_total_revenue,
              operating_profit: storedMetrics.operating_profit,
            }
          : {}),
      }

      const pricingDataForUpdate =
        isPartialPaymentSync && existing?.id
          ? (() => {
              const row = { ...pricingData } as Record<string, unknown>
              delete row.pricing_adults
              return row
            })()
          : pricingData

      let error: unknown
      if (checkError && checkError.code !== 'PGRST116') { // PGRST116은 "no rows returned" 오류
        console.error('기존 가격 정보 확인 오류:', checkError)
        throw checkError
      }

      if (existing?.id) {
        // 기존 데이터가 있으면 업데이트 (전체 컬럼 명시로 card_fee, balance_amount, commission_amount 등 누락 방지)
        const { error: updateError } = await (supabase as any)
          .from('reservation_pricing')
          .update(pricingDataForUpdate)
          .eq('reservation_id', reservationId)
        
        error = updateError
      } else {
        // 기존 데이터가 없으면 새로 삽입
        const { error: insertError } = await (supabase as any)
          .from('reservation_pricing')
          .insert([pricingData])
        
        error = insertError
      }

      if (error) {
        console.error('가격 정보 저장 오류:', error)
        throw error
      }

      console.log('가격 정보가 성공적으로 저장되었습니다.')
      if (existingAudited && isSuperPricingAdmin && !isPartialPaymentSync) {
        const actorName = auditDisplayName(currentTeamProfile, authUser?.email)
        await insertPricingAuditNotifications(
          reservationId,
          'audited_pricing_updated',
          `Audited 가격 정보가 super 관리자에 의해 수정되었습니다.\n\n수정자: ${actorName || authUser?.email || ''}`
        )
      }
      await Promise.resolve(onPricingSaved?.(reservationId))
    } catch (error) {
      console.error('가격 정보 저장 중 오류:', error)
      throw error
    }
  }, [authUser?.email, currentTeamProfile, insertPricingAuditNotifications, isSuperPricingAdmin, onPricingSaved])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (importSubmitDisabled) return

    // 새로운 간결한 초이스 시스템에서 필수 초이스 검증
    // 거주 상태별 인원 수가 설정되어 있으면 "미국 거주자 구분" 관련 초이스 검증 건너뛰기
    const hasResidentStatusData =
      (formData.undecidedResidentCount || 0) > 0 ||
      (formData.usResidentCount || 0) > 0 ||
      (formData.nonResidentCount || 0) > 0 ||
      (formData.nonResidentWithPassCount || 0) > 0 ||
      (formData.nonResidentUnder16Count || 0) > 0 ||
      (formData.nonResidentPurchasePassCount || 0) > 0
    
    // selectedChoices가 배열인지 확인하고, 배열이 아니면 빈 배열로 처리
    const selectedChoicesArray = Array.isArray(formData.selectedChoices) 
      ? formData.selectedChoices 
      : (formData.selectedChoices && typeof formData.selectedChoices === 'object' 
          ? Object.entries(formData.selectedChoices).map(([choiceId, choiceData]: [string, any]) => ({
              choice_id: choiceId,
              option_id: choiceData?.selected || choiceData?.option_id || '',
              quantity: choiceData?.quantity || 1,
              total_price: choiceData?.total_price || 0
            }))
          : [])
    
    console.log('ReservationForm: handleSubmit 검증 시작', {
      productChoicesCount: formData.productChoices?.length || 0,
      selectedChoicesArrayCount: selectedChoicesArray.length,
      selectedChoicesArray: selectedChoicesArray.map(c => ({ choice_id: c.choice_id, option_id: c.option_id })),
      formDataSelectedChoicesType: Array.isArray(formData.selectedChoices) ? 'array' : typeof formData.selectedChoices,
      formDataSelectedChoices: formData.selectedChoices,
      productChoicesIds: formData.productChoices?.map(c => ({ id: c.id, group: c.choice_group_ko || c.choice_group, isRequired: c.is_required })) || []
    })
    
    const missingRequiredChoices = formData.productChoices.filter(choice => {
      if (!choice.is_required) return false
      
      // "미국 거주자 구분" 관련 초이스이고 거주 상태별 인원 수가 설정되어 있으면 검증 건너뛰기
      const isResidentStatusChoice = choice.choice_group_ko?.includes('거주자') || 
                                     choice.choice_group_ko?.includes('거주') ||
                                     choice.choice_group?.toLowerCase().includes('resident') ||
                                     choice.choice_group?.toLowerCase().includes('거주')
      
      if (isResidentStatusChoice && hasResidentStatusData) {
        return false // 거주 상태별 인원 수가 설정되어 있으면 검증 건너뛰기
      }
      
      // "미정" 선택도 유효한 선택으로 인정 (미국 거주자 구분·기타 입장료 등)
      const UNDECIDED_OPTION_ID = '__undecided__'
      const hasSelection = selectedChoicesArray.some(selectedChoice => {
        const matches = selectedChoice.choice_id === choice.id
        if (!matches) return false
        // 미정(__undecided__) 선택 시 필수 검증 통과
        if (selectedChoice.option_id === UNDECIDED_OPTION_ID) return true
        return true
      })
      
      console.log(`ReservationForm: 초이스 검증 - ${choice.choice_group_ko || choice.choice_group}`, {
        choiceId: choice.id,
        isRequired: choice.is_required,
        hasSelection,
        selectedChoicesArray: selectedChoicesArray.map(c => ({ choice_id: c.choice_id, option_id: c.option_id })),
        allChoiceIds: formData.productChoices?.map(c => c.id) || []
      })
      
      return !hasSelection
    })
    
    if (missingRequiredChoices.length > 0) {
      const missingChoiceNames = missingRequiredChoices.map(choice => choice.choice_group_ko || choice.choice_group).join('\n')
      alert(`다음 카테고리에서 필수 옵션을 선택해주세요:\n${missingChoiceNames}`)
      return
    }
    
    const totalPeople = formData.adults + formData.child + formData.infant
    
    try {
      // 고객 정보 저장/업데이트 또는 생성 (새 고객 생성 로직을 먼저 처리)
      let finalCustomerId = formData.customerId
      
      // 중복 고객 모달에서 이미 고객을 생성/선택한 경우, ref에 저장된 ID를 사용
      if (resolvedCustomerIdRef.current) {
        finalCustomerId = resolvedCustomerIdRef.current
        resolvedCustomerIdRef.current = null
      } else if (!formData.customerId || showNewCustomerForm) {
        // 새 고객 생성
        if (!formData.customerSearch || !formData.customerSearch.trim()) {
          alert('고객 이름을 입력해주세요.')
          return
        }
        
        // 비슷한 고객 체크
        const similar = findSimilarCustomers(
          formData.customerSearch.trim(),
          formData.customerEmail || undefined,
          formData.customerPhone || undefined
        )
        
        if (similar.length > 0) {
          // 비슷한 고객이 있으면 모달 표시
          setSimilarCustomers(similar)
          setPendingCustomerData({
            name: formData.customerSearch.trim(),
            phone: formData.customerPhone || null,
            email: formData.customerEmail || null,
            address: formData.customerAddress || null,
            language: formData.customerLanguage || 'KR',
            emergency_contact: formData.customerEmergencyContact || null,
            special_requests: formData.customerSpecialRequests || null,
            channel_id: formData.channelId || null,
            status: formData.customerStatus || 'active'
          })
          setShowDuplicateModal(true)
          return
        }
        
        const newCustomerId = generateCustomerId()
        
        const customerData = {
          id: newCustomerId,
          name: formData.customerSearch.trim(),
          phone: formData.customerPhone || null,
          email: formData.customerEmail || null,
          address: formData.customerAddress || null,
          language: formData.customerLanguage || 'KR',
          emergency_contact: formData.customerEmergencyContact || null,
          special_requests: formData.customerSpecialRequests || null,
          channel_id: formData.channelId || null,
          status: formData.customerStatus || 'active'
        }
        
        const { row: newCustomer, errorMessage: createCustomerErr } = await insertCustomerForReservationForm(
          useServerCustomerInsert,
          customerData
        )

        if (createCustomerErr || !newCustomer) {
          console.error('고객 정보 생성 오류:', createCustomerErr)
          alert('고객 정보 생성 중 오류가 발생했습니다: ' + (createCustomerErr || '알 수 없음'))
          return
        }

        finalCustomerId = newCustomer.id
        setFormData(prev => ({ ...prev, customerId: finalCustomerId }))
        
        // 고객 목록 새로고침은 비동기로 실행 (실패/지연 시에도 예약 저장이 진행되도록 await 하지 않음)
        void onRefreshCustomers().catch(() => {})
      } else if (formData.customerId) {
        // 기존 고객 업데이트
        const customerData = {
          name: formData.customerSearch.trim() || formData.customerName, // 고객 검색 입력칸 또는 이름 사용
          phone: formData.customerPhone || null,
          email: formData.customerEmail || null,
          address: formData.customerAddress || null,
          language: formData.customerLanguage || 'KR',
          emergency_contact: formData.customerEmergencyContact || null,
          special_requests: formData.customerSpecialRequests || null,
          channel_id: formData.channelId || null, // 오른쪽 채널 선택기에서 선택한 값 사용
          status: formData.customerStatus || 'active'
        }
        
        const { error: customerError } = await (supabase as any)
          .from('customers')
          .update(customerData)
          .eq('id', formData.customerId)
        
        if (customerError) {
          console.error('고객 정보 업데이트 오류:', customerError)
          alert('고객 정보 업데이트 중 오류가 발생했습니다: ' + customerError.message)
          return
        }
        
        // 고객 목록 새로고침은 비동기로 실행 (실패/지연 시에도 예약 저장이 진행되도록 await 하지 않음)
        void onRefreshCustomers().catch(() => {})
      }
      
      // 고객 ID 최종 검증 (새 고객 생성 후에도 고객 ID가 없으면 오류)
      if (!finalCustomerId) {
        alert('고객을 선택해주세요.')
        return
      }
      
      // 새로운 간결한 초이스 시스템 사용
      const choicesData: any = {
        required: []
      }
      
      console.log('ReservationForm: 초이스 데이터 준비 시작', {
        selectedChoicesType: Array.isArray(formData.selectedChoices) ? 'array' : typeof formData.selectedChoices,
        selectedChoicesCount: Array.isArray(formData.selectedChoices) ? formData.selectedChoices.length : 'not array',
        selectedChoices: formData.selectedChoices
      })
      
      // "미정"(__undecided__)은 reservation_choices FK에 없으나 reservations.choices JSON에는 보관
      const UNDECIDED_OPTION_ID = '__undecided__'
      if (Array.isArray(formData.selectedChoices) && formData.selectedChoices.length > 0) {
        formData.selectedChoices.forEach(choice => {
          if (!choice.choice_id || !choice.option_id) return
          if (choice.option_id === UNDECIDED_OPTION_ID) {
            choicesData.required.push({
              choice_id: choice.choice_id,
              option_id: UNDECIDED_OPTION_ID,
              quantity: choice.quantity || 1,
              total_price: choice.total_price || 0
            })
            return
          }
          choicesData.required.push({
            choice_id: choice.choice_id,
            option_id: choice.option_id,
            quantity: choice.quantity || 1,
            total_price: choice.total_price || 0
          })
        })
      } else if (formData.selectedChoices && typeof formData.selectedChoices === 'object') {
        // 기존 객체 형태의 selectedChoices 처리
        Object.entries(formData.selectedChoices).forEach(([choiceId, choiceData]) => {
          if (choiceData && typeof choiceData === 'object' && 'selected' in choiceData) {
            const choice = choiceData as { selected: string; timestamp?: string }
            if (choice.selected && choice.selected !== UNDECIDED_OPTION_ID) {
              choicesData.required.push({
                choice_id: choiceId,
                option_id: choice.selected,
                quantity: 1,
                total_price: 0 // 기존 시스템에서는 가격이 별도로 계산됨
              })
            }
          }
        })
      }
      
      console.log('ReservationForm: 초이스 데이터 준비 완료', {
        choicesRequiredCount: choicesData.required.length,
        choicesData: choicesData
      })
      
      // 가격 정보는 formDataRef에서 읽어 최신 입력값(불포함·채널 수수료$ 등)이 반영되도록 함
      const fd = formDataRef.current
      const toNum = (v: unknown) => (v !== null && v !== undefined && v !== '' ? Number(v) : 0)
      // 예약 정보와 가격 정보를 함께 제출 (customerId 업데이트)
      const reservationPayload = {
        ...formData,
        id: reservation?.id, // 예약 ID 포함 (새 예약 모드에서 미리 생성된 ID)
        customerId: finalCustomerId || formData.customerId,
        totalPeople,
        choices: choicesData,
        selectedChoices: formData.selectedChoices as any,
        // 새 예약 시 저장 전에 추가한 옵션 목록 (예약 저장 시 함께 저장)
        pendingReservationOptions: isNewReservation ? pendingReservationOptions : undefined,
        // 가격 정보를 포함하여 전달 (DB 저장 시 숫자로 쓰이도록 명시적 변환, fd 사용으로 불포함/commission_amount 등 최신값 반영)
        pricingInfo: {
          adultProductPrice: toNum(fd.adultProductPrice),
          childProductPrice: toNum(fd.childProductPrice),
          infantProductPrice: toNum(fd.infantProductPrice),
          productPriceTotal: toNum(fd.productPriceTotal),
          not_included_price: toNum(fd.not_included_price),
          requiredOptions: fd.requiredOptions,
          requiredOptionTotal: toNum(fd.requiredOptionTotal),
          choices: choicesData,
          choicesTotal: toNum(fd.choicesTotal),
          quantityBasedChoices: {},
          quantityBasedChoiceTotal: 0,
          subtotal: toNum(fd.subtotal),
          couponCode: fd.couponCode ?? '',
          couponDiscount: toNum(fd.couponDiscount),
          additionalDiscount: toNum(fd.additionalDiscount),
          additionalCost: toNum(fd.additionalCost),
          refundReason: String(fd.refundReason ?? ''),
          refundAmount: toNum(fd.refundAmount),
          cardFee: toNum(fd.cardFee),
          tax: toNum(fd.tax),
          prepaymentCost: toNum(fd.prepaymentCost),
          prepaymentTip: toNum(fd.prepaymentTip),
          selectedOptionalOptions: fd.selectedOptionalOptions,
          optionTotal: toNum(fd.optionTotal),
          totalPrice: toNum(fd.totalPrice),
          // DB deposit_amount = 입금 보증 버킷 합(파트너 수령 등, Refunded·Returned 별도). 잔금 수령은 payment_records·balanceReceivedTotal, 잔액은 balance_amount
          depositAmount: toNum(fd.depositAmount),
          balanceAmount: toNum(fd.onSiteBalanceAmount ?? fd.balanceAmount ?? 0),
          isPrivateTour: fd.isPrivateTour,
          privateTourAdditionalCost: toNum(fd.privateTourAdditionalCost),
          commission_percent: toNum(fd.commission_percent),
          /** DB `commission_amount` — 가격 계산 3. 채널 정산 기준 · 채널 수수료 $ */
          commission_amount: toNum(fd.commission_amount),
          /** DB `pricing_adults` — 상품가격 · 예약 성인 인원 */
          pricingAdults: Math.max(0, Math.floor(toNum(fd.pricingAdults ?? fd.adults))),
          /**
           * DB `commission_base_price` — UI「채널 결제 금액」(Returned 차감 후 net).
           * gross는 `onlinePaymentAmount`·보증금 등으로 `savePricingInfo`·`updateReservation`에서 복원.
           */
          commission_base_price: toNum(fd.commission_base_price),
          onlinePaymentAmount:
            toNum(fd.onlinePaymentAmount) || toNum(fd.commission_base_price),
          /** 이메일 가져오기 confirm API 등 — 수동 입력 시 우선 저장 */
          channel_settlement_amount: (() => {
            const m = fd.channelSettlementAmount
            if (m !== undefined && m !== null && String(m) !== '' && Number.isFinite(Number(m))) {
              return Math.round(Number(m) * 100) / 100
            }
            return undefined
          })(),
        }
      }
      
      console.log('ReservationForm: 예약 정보와 가격 정보 제출', {
        reservationId: reservationPayload.id,
        hasChoices: !!reservationPayload.choices,
        choicesRequiredCount: reservationPayload.choices?.required?.length || 0,
        hasSelectedChoices: !!reservationPayload.selectedChoices,
        selectedChoicesCount: Array.isArray(reservationPayload.selectedChoices) ? reservationPayload.selectedChoices.length : 0,
        hasPricingInfo: !!reservationPayload.pricingInfo,
        pricingInfo: reservationPayload.pricingInfo,
        onSubmitType: typeof onSubmit,
        onSubmitExists: !!onSubmit
      })
      
      try {
        const prevStatus = (reservation?.status || '').toLowerCase()
        const nextStatus = (reservationPayload.status || '').toLowerCase()
        const isMovingToCancelled =
          !!reservation?.id &&
          (nextStatus === 'cancelled' || nextStatus === 'canceled') &&
          !(prevStatus === 'cancelled' || prevStatus === 'canceled')
        let cancellationReasonForSave: string | null = null

        if (isMovingToCancelled && reservation?.id) {
          const reason = await requestCancellationReason()
          if (!reason) {
            setIsSubmitting(false)
            return
          }
          cancellationReasonForSave = reason
        }

        if (pricingAudit.audited && !isSuperPricingAdmin) {
          ;(reservationPayload as { pricingInfo?: unknown }).pricingInfo = undefined
        }
        if (pricingAudit.audited && isSuperPricingAdmin) {
          const ok = window.confirm(
            '이 예약의 가격 정보는 Audited 상태입니다.\n예약 저장 시 가격 정보가 함께 수정될 수 있고, 다른 super 관리자에게 수정 알림이 전송됩니다.\n계속 저장할까요?'
          )
          if (!ok) {
            setIsSubmitting(false)
            return
          }
        }

        console.log('ReservationForm: onSubmit 호출 시작')
        await onSubmit(reservationPayload)
        if (pricingAudit.audited && isSuperPricingAdmin && reservation?.id) {
          const actorName = auditDisplayName(currentTeamProfile, authUser?.email)
          await insertPricingAuditNotifications(
            reservation.id,
            'audited_pricing_updated',
            `Audited 가격 정보가 포함된 예약 정보가 super 관리자에 의해 저장되었습니다.\n\n수정자: ${actorName || authUser?.email || ''}`
          )
        }
        if (isMovingToCancelled && reservation?.id && cancellationReasonForSave) {
          await upsertReservationCancellationReason(reservation.id, cancellationReasonForSave)
        }
        console.log('ReservationForm: onSubmit 호출 완료')
      } catch (onSubmitError) {
        console.error('ReservationForm: onSubmit 호출 중 오류:', onSubmitError)
        throw onSubmitError
      }
    } catch (error) {
      console.error('예약 저장 중 오류:', error)
      const message = error instanceof Error ? error.message : ''
      alert(message.includes('Audited') ? message : '예약 저장 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const [cancellationReasonModalOpen, setCancellationReasonModalOpen] = useState(false)
  const [cancellationReasonSaving, setCancellationReasonSaving] = useState(false)
  const cancellationReasonResolveRef = useRef<((value: string | null) => void) | null>(null)

  const requestCancellationReason = useCallback(() => {
    setCancellationReasonModalOpen(true)
    return new Promise<string | null>((resolve) => {
      cancellationReasonResolveRef.current = resolve
    })
  }, [])

  const closeCancellationReasonModal = useCallback(() => {
    setCancellationReasonModalOpen(false)
    cancellationReasonResolveRef.current?.(null)
    cancellationReasonResolveRef.current = null
  }, [])

  const submitCancellationReasonModal = useCallback(async (reason: string) => {
    const trimmed = reason.trim()
    if (!trimmed) return
    setCancellationReasonSaving(true)
    try {
      setCancellationReasonModalOpen(false)
      cancellationReasonResolveRef.current?.(trimmed)
      cancellationReasonResolveRef.current = null
    } finally {
      setCancellationReasonSaving(false)
    }
  }, [])

  // 고객 추가 함수
  const handleAddCustomer = useCallback(async (customerData: Database['public']['Tables']['customers']['Insert']) => {
    try {
      // 라스베가스 시간대의 오늘 날짜를 ISO 문자열로 생성
      const getLasVegasToday = () => {
        const now = new Date()
        // 라스베가스 시간대의 현재 날짜를 가져옴
        const lasVegasFormatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Los_Angeles',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        })
        
        const parts = lasVegasFormatter.formatToParts(now)
        const year = parseInt(parts.find(p => p.type === 'year')?.value || '0')
        const month = parseInt(parts.find(p => p.type === 'month')?.value || '0')
        const day = parseInt(parts.find(p => p.type === 'day')?.value || '0')
        
        // 라스베가스 시간대의 오늘 날짜 자정(00:00:00)을 UTC로 변환
        // 라스베가스 시간대의 특정 날짜/시간에 대한 UTC 오프셋을 계산하기 위해
        // 먼저 임시로 UTC로 해석된 Date 객체를 만들고, 그 시각을 라스베가스 시간대로 포맷팅하여 오프셋 계산
        const tempUTC = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)) // 정오를 사용하여 DST 문제 방지
        
        // 그 UTC 시간을 라스베가스 시간대로 변환하여 오프셋 계산
        const lasVegasFormatter2 = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Los_Angeles',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        })
        
        const lasVegasParts = lasVegasFormatter2.formatToParts(tempUTC)
        const lvYear = parseInt(lasVegasParts.find(p => p.type === 'year')?.value || '0')
        const lvMonth = parseInt(lasVegasParts.find(p => p.type === 'month')?.value || '0')
        const lvDay = parseInt(lasVegasParts.find(p => p.type === 'day')?.value || '0')
        const lvHour = parseInt(lasVegasParts.find(p => p.type === 'hour')?.value || '0')
        const lvMinute = parseInt(lasVegasParts.find(p => p.type === 'minute')?.value || '0')
        const lvSecond = parseInt(lasVegasParts.find(p => p.type === 'second')?.value || '0')
        
        // 라스베가스 시간대의 날짜/시간을 나타내는 Date 객체 생성 (로컬 시간대로 해석)
        const lasVegasTime = new Date(lvYear, lvMonth - 1, lvDay, lvHour, lvMinute, lvSecond)
        
        // 오프셋 계산 (밀리초 단위)
        // tempUTC는 UTC 시간이고, lasVegasTime은 그 UTC 시간을 라스베가스 시간대로 변환한 것
        // 따라서 오프셋은 tempUTC - lasVegasTime (라스베가스가 UTC보다 느리므로)
        const offsetMs = tempUTC.getTime() - lasVegasTime.getTime()
        
        // 라스베가스 시간대의 오늘 날짜 자정(00:00:00)을 UTC로 변환
        // 라스베가스 시간대의 날짜/시간을 나타내는 Date 객체 생성
        const lasVegasDateLocal = new Date(year, month - 1, day, 0, 0, 0)
        const utcDate = new Date(lasVegasDateLocal.getTime() + offsetMs)
        
        return utcDate.toISOString()
      }
      
      // created_at을 라스베가스 시간대의 오늘 날짜로 설정
      const customerDataWithDate = {
        ...customerData,
        created_at: getLasVegasToday()
      }
      
      const { row: newCustomer, errorMessage: addErr } = await insertCustomerForReservationForm(
        useServerCustomerInsert,
        customerDataWithDate as Record<string, unknown>
      )

      if (addErr || !newCustomer) {
        console.error('Error adding customer:', addErr)
        alert('고객 추가 중 오류가 발생했습니다: ' + (addErr || '알 수 없음'))
        return
      }

      // 성공 시 고객 목록 새로고침
      await onRefreshCustomers()
      setShowCustomerForm(false)

      // 새로 추가된 고객을 선택하고, 예약 폼도 제출을 트리거하여 예약도 함께 저장
      setShowNewCustomerForm(false)
      setFormData((prev) => ({
        ...prev,
        customerId: newCustomer.id,
        customerSearch: `${newCustomer.name}${newCustomer.email ? ` (${newCustomer.email})` : ''}`,
        showCustomerDropdown: false,
      }))
      setTimeout(() => {
        reservationFormRef.current?.requestSubmit()
      }, 0)
    } catch (error) {
      console.error('Error adding customer:', error)
      alert('고객 추가 중 오류가 발생했습니다.')
    }
  }, [onRefreshCustomers, useServerCustomerInsert])

  // 외부 클릭 시 고객 검색 드롭다운 / 언어 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(event.target as Node)) {
        setFormData(prev => ({ ...prev, showCustomerDropdown: false }))
      }
      if (languageDropdownRef.current && !languageDropdownRef.current.contains(event.target as Node)) {
        setLanguageDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const isModal = layout !== 'page'

  return (
    <div className={isModal ? "fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-2 sm:p-4 max-lg:items-stretch max-lg:p-0" : "w-full min-h-0 flex-1 flex flex-col"}>
      <div className={isModal 
        ? "bg-white rounded-none sm:rounded-lg p-0 sm:p-4 w-full max-w-full h-full max-h-full max-lg:h-[100dvh] max-lg:max-h-[100dvh] max-lg:flex max-lg:flex-col max-lg:overflow-hidden sm:w-[90vw] sm:max-h-[90vh] lg:block lg:overflow-y-auto"
        : "bg-white rounded-lg p-2 sm:p-4 w-full min-h-0 flex-1 flex flex-col overflow-hidden"}
      >
        {/* 헤더: 모바일에서 스티키, 데스크톱 기존 */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center flex-shrink-0 p-3 sm:p-0 sm:mb-2 sm:space-y-0 space-y-3 border-b border-gray-200 max-lg:bg-white max-lg:sticky max-lg:top-0 max-lg:z-10 max-lg:shadow-sm">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <h2 className="text-base sm:text-base font-semibold text-gray-900 truncate">
              {formTitleOverride ?? (isNewReservation ? t('form.title') : (reservation ? t('form.editTitle') : t('form.title')))}
              {reservation && !isNewReservation && (
                <span className="ml-2 text-xs font-normal text-gray-500 hidden sm:inline">
                  (ID: {reservation.id})
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2 flex-shrink-0 min-w-0">
              {reservation && titleAction}
              <div className="flex items-center gap-2 max-sm:flex sm:hidden">
              <label className="sr-only" htmlFor="reservation-status-mobile">{t('form.status')}</label>
              <select
                id="reservation-status-mobile"
                value={formData.status}
                onChange={(e) => setFormData((prev: any) => ({ ...prev, status: e.target.value as 'inquiry' | 'pending' | 'confirmed' | 'completed' | 'cancelled' }))}
                className="min-w-[6.5rem] px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
              >
                <option value="inquiry">{t('status.inquiry')}</option>
                <option value="pending">{t('status.pending')}</option>
                <option value="confirmed">{t('status.confirmed')}</option>
                <option value="completed">{t('status.completed')}</option>
                <option value="cancelled">{t('status.cancelled')}</option>
              </select>
              <button
                type="button"
                onClick={onCancel}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                aria-label="닫기"
              >
                <X className="w-5 h-5" />
              </button>
              </div>
            </div>
          </div>
          <div className="hidden sm:flex w-full sm:w-auto items-center space-x-2">
            <div className="flex items-center gap-2 flex-shrink-0">
              <label className="text-xs font-medium text-gray-700 whitespace-nowrap" htmlFor="reservation-status-desktop">{t('form.status')}</label>
              <select
                id="reservation-status-desktop"
                value={formData.status}
                onChange={(e) => setFormData((prev: any) => ({ ...prev, status: e.target.value as 'inquiry' | 'pending' | 'confirmed' | 'completed' | 'cancelled' }))}
                className="w-full min-w-[6.5rem] sm:w-auto px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
              >
                <option value="inquiry">{t('status.inquiry')}</option>
                <option value="pending">{t('status.pending')}</option>
                <option value="confirmed">{t('status.confirmed')}</option>
                <option value="completed">{t('status.completed')}</option>
                <option value="cancelled">{t('status.cancelled')}</option>
              </select>
            </div>
            {onViewCustomer && (
              <button
                type="button"
                onClick={onViewCustomer}
                className="px-3 py-2 text-sm bg-purple-50 text-purple-600 rounded-md hover:bg-purple-100 transition-colors flex items-center space-x-2 border border-purple-200"
                title="고객 보기"
              >
                <Eye className="w-4 h-4" />
                <span>고객 보기</span>
              </button>
            )}
            <button
              type="submit"
              form="reservation-edit-form"
              disabled={importSubmitDisabled || isSubmitting || (!isNewReservation && !!reservation?.id && !pricingLoadComplete)}
              title={
                importSubmitDisabled
                  ? '이미 처리된 예약 가져오기 항목은 저장할 수 없습니다.'
                  : !isNewReservation && reservation?.id && !pricingLoadComplete
                    ? '가격 정보 로딩 중입니다. 잠시 후 저장해 주세요.'
                    : undefined
              }
              className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!isNewReservation && reservation?.id && !pricingLoadComplete ? '가격 로딩 중...' : isSubmitting ? tCommon('saving') || '저장 중...' : (reservation ? tCommon('save') : tCommon('add'))}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-2 text-sm bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
            >
              {tCommon('cancel')}
            </button>
            {reservation && !(isImportMode && importSubmitDisabled) && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(t('deleteConfirm'))) {
                    onDelete(reservation.id);
                    onCancel();
                  }
                }}
                className="px-3 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-1.5"
              >
                <Trash2 size={16} />
                {tCommon('delete')}
              </button>
            )}
            <button
              type="button"
              onClick={() => window.history.back()}
              className="px-2 py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-xs"
            >
              목록으로
            </button>
          </div>
        </div>

        <form id="reservation-edit-form" ref={reservationFormRef} onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className={`flex-1 min-h-0 overflow-x-hidden p-3 sm:p-0 sm:space-y-6 ${isModal ? 'overflow-y-auto' : 'lg:overflow-hidden lg:flex lg:flex-col lg:min-h-0'} ${isModal ? '' : 'lg:pb-0'} pb-2`}>
          <div className={`grid grid-cols-1 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-4 lg:grid-rows-1 lg:min-h-0 ${isModal ? 'lg:h-auto' : 'lg:flex-1 lg:h-[calc(100vh-var(--header-height,4rem)-6rem)] lg:max-h-[calc(100vh-var(--header-height,4rem)-6rem)]'}`}>
            {/* 1열: 고객 정보 + Follow up */}
            <div className="lg:col-span-1 lg:flex lg:flex-col lg:gap-4 lg:min-h-0 lg:h-full lg:overflow-y-auto max-lg:contents">
            <div id="customer-section" className={`space-y-4 max-lg:overflow-y-auto lg:overflow-visible border border-gray-200 rounded-xl p-3 sm:p-4 bg-gray-50/50 max-lg:order-1 lg:h-auto lg:flex-none`}>
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2">
                  고객 정보
                </h3>
                {/* 고객 검색 */}
                <CustomerSection
                  formData={formData}
                  setFormData={setFormData}
                  customers={customers}
                  customerSearchRef={customerSearchRef}
                  setShowCustomerForm={(show) => {
                    if (show) {
                      // + 버튼을 누르면 새 고객 입력 모드 활성화
                      // 입력된 고객 이름은 유지하고, customerId만 초기화
                      const currentSearch = formData.customerSearch || ''
                      setShowNewCustomerForm(true)
                      setFormData(prev => ({
                        ...prev,
                        customerId: '',
                        customerSearch: currentSearch, // 입력된 검색어 유지
                        customerName: currentSearch, // 이름 필드에도 입력된 값 설정
                        customerPhone: '',
                        customerEmail: '',
                        customerAddress: '',
                        customerLanguage: 'KR',
                        customerEmergencyContact: '',
                        customerSpecialRequests: '',
                        customerChannelId: '',
                        customerStatus: 'active'
                      }))
                    } else {
                      setShowNewCustomerForm(false)
                    }
                  }}
                  t={t}
                />
                
                {/* 고객 정보 입력/수정 폼 - 새 고객 입력 모드이거나 고객이 선택되었을 때 */}
                {(showNewCustomerForm || formData.customerId) && (
                  <div className="mt-4 space-y-3 pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">전화번호</label>
                        <input
                          type="tel"
                          value={formData.customerPhone}
                          onChange={(e) => {
                            const phone = e.target.value
                            setFormData(prev => {
                              const next = { ...prev, customerPhone: phone }
                              const country = getCountryFromPhone(phone)
                              const langMatch = country ? LANGUAGE_OPTIONS.find(o => o.countryCode === country) : null
                              if (langMatch) next.customerLanguage = langMatch.value
                              return next
                            })
                          }}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
                          placeholder="+82 10 1234 5678"
                        />
                        {(() => {
                          const country = getCountryFromPhone(formData.customerPhone)
                          const langMatch = country ? LANGUAGE_OPTIONS.find(o => o.countryCode === country) : null
                          if (!langMatch) return null
                          return (
                            <p className="mt-1 text-xs text-gray-500">
                              전화번호에서 국가가 감지됨 → 언어: {langMatch.label}
                            </p>
                          )
                        })()}
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">이메일</label>
                        <input
                          type="email"
                          value={formData.customerEmail}
                          onChange={(e) => setFormData(prev => ({ ...prev, customerEmail: e.target.value }))}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
                        />
                      </div>
                      
                      <div ref={languageDropdownRef}>
                        <label className="block text-xs font-medium text-gray-700 mb-1">언어</label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setLanguageDropdownOpen(prev => !prev)}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs bg-white flex items-center justify-between gap-2 text-left"
                          >
                            <span className="flex items-center gap-2">
                              {(() => {
                                const opt = LANGUAGE_OPTIONS.find(o => o.value === formData.customerLanguage) || LANGUAGE_OPTIONS[0]
                                return (
                                  <>
                                    <ReactCountryFlag
                                      countryCode={opt.countryCode}
                                      svg
                                      style={{ width: '18px', height: '14px', borderRadius: '2px', flexShrink: 0 }}
                                    />
                                    <span>{opt.label}</span>
                                  </>
                                )
                              })()}
                            </span>
                            <ChevronDown className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${languageDropdownOpen ? 'rotate-180' : ''}`} />
                          </button>
                          {languageDropdownOpen && (
                            <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-56 overflow-auto">
                              {LANGUAGE_OPTIONS.map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => {
                                    setFormData(prev => ({ ...prev, customerLanguage: opt.value }))
                                    setLanguageDropdownOpen(false)
                                  }}
                                  className={`w-full px-2 py-1.5 text-xs flex items-center gap-2 hover:bg-gray-100 text-left ${formData.customerLanguage === opt.value ? 'bg-blue-50 text-blue-700' : ''}`}
                                >
                                  <ReactCountryFlag
                                    countryCode={opt.countryCode}
                                    svg
                                    style={{ width: '18px', height: '14px', borderRadius: '2px', flexShrink: 0 }}
                                  />
                                  <span>{opt.label}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">비상연락처</label>
                        <input
                          type="tel"
                          value={formData.customerEmergencyContact}
                          onChange={(e) => setFormData(prev => ({ ...prev, customerEmergencyContact: e.target.value }))}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">주소</label>
                        <input
                          type="text"
                          value={formData.customerAddress}
                          onChange={(e) => setFormData(prev => ({ ...prev, customerAddress: e.target.value }))}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">특별요청</label>
                        <textarea
                          value={formData.customerSpecialRequests}
                          onChange={(e) => setFormData(prev => ({ ...prev, customerSpecialRequests: e.target.value }))}
                          rows={3}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
                        />
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <label className="block text-xs font-medium text-gray-700">상태</label>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            customerStatus: prev.customerStatus === 'active' ? 'inactive' : 'active'
                          }))}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                            formData.customerStatus === 'active' ? 'bg-blue-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              formData.customerStatus === 'active' ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                        <span className={`text-sm font-medium ${
                          formData.customerStatus === 'active' ? 'text-blue-600' : 'text-gray-500'
                        }`}>
                          {formData.customerStatus === 'active' ? '활성' : '비활성'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Follow up - 1열 고객 정보 아래 (상세 페이지·예약 수정 모달 공통) */}
            {reservation && effectiveReservationId && (
              <div className="max-lg:order-9 max-lg:mt-4 lg:shrink-0">
                <ReservationFollowUpSection
                  reservationId={effectiveReservationId}
                  status={formData.status as string}
                  followUpPipelineProductId={formData.productId}
                  followUpPipelineProducts={products}
                  followUpPipelineReservation={followUpPipelineReservationMerged}
                  followUpPipelineCustomers={customers}
                  followUpPipelineRefreshToken={followUpPipelineSnapshotRefreshToken}
                />
              </div>
            )}

            {/* 편집/취소/삭제 버튼 - Follow up 아래 (1열 하단) */}
            <div className="w-full border border-gray-200 rounded-xl p-3 bg-white shadow-sm max-lg:order-7 flex-shrink-0">
              <div className="flex flex-row items-center gap-2">
                <button
                  type="submit"
                  disabled={importSubmitDisabled || isSubmitting || (!isNewReservation && !!reservation?.id && !pricingLoadComplete)}
                  title={
                    importSubmitDisabled
                      ? '이미 처리된 예약 가져오기 항목은 저장할 수 없습니다.'
                      : !isNewReservation && reservation?.id && !pricingLoadComplete
                        ? '가격 정보 로딩 중입니다. 잠시 후 저장해 주세요.'
                        : undefined
                  }
                  className="flex-1 min-w-0 bg-blue-600 text-white py-2.5 px-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {!isNewReservation && reservation?.id && !pricingLoadComplete ? '가격 로딩 중...' : isSubmitting ? tCommon('saving') || '저장 중...' : (reservation ? tCommon('save') : tCommon('add'))}
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 min-w-0 bg-gray-300 text-gray-700 py-2.5 px-3 rounded-lg hover:bg-gray-400 text-sm font-medium"
                >
                  {tCommon('cancel')}
                </button>
                {reservation && !(isImportMode && importSubmitDisabled) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(t('deleteConfirm'))) {
                        onDelete(reservation.id);
                        onCancel();
                      }
                    }}
                    className="shrink-0 px-3 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                  >
                    <Trash2 size={16} className="inline mr-1" />
                    {tCommon('delete')}
                  </button>
                )}
              </div>
            </div>
            </div>

            {/* 데스크톱: 2열 예약정보+연결된투어 | 3열 예약옵션/입금/지출/후기관리 */}
            <div className="col-span-1 lg:col-span-2 lg:col-start-2 lg:grid lg:grid-cols-2 lg:gap-4 lg:min-h-0 max-lg:contents">
              {/* 2열: 예약 정보 + 연결된 투어 */}
              <div className="lg:flex lg:flex-col lg:gap-4 lg:min-h-0 max-lg:contents">
              {/* 예약 정보 (투어 정보, 참가자) */}
              <div className="space-y-4 overflow-y-auto border border-gray-200 rounded-xl p-3 sm:pt-4 sm:px-4 sm:pb-1 bg-gray-50/50 max-lg:order-2 lg:min-h-0 lg:flex-none lg:h-auto">
                <div className="max-lg:flex max-lg:items-center max-lg:justify-between max-lg:gap-2 lg:block mb-2 lg:mb-0">
                  <h3 className="text-sm font-medium text-gray-900 max-lg:mb-0">
                    예약 정보
                  </h3>
                  {/* 모바일/태블릿 전용: 타이틀과 같은 줄 오른쪽 끝 정렬 */}
                  <div className="hidden max-lg:block lg:hidden flex-shrink-0">
                    <label className="sr-only" htmlFor="reservation-status-section">{t('form.status')}</label>
                    <select
                      id="reservation-status-section"
                      value={formData.status}
                      onChange={(e) => setFormData((prev: any) => ({ ...prev, status: e.target.value as 'inquiry' | 'pending' | 'confirmed' | 'completed' | 'cancelled' }))}
                      className="min-w-[6.5rem] px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="inquiry">{t('status.inquiry')}</option>
                      <option value="pending">{t('status.pending')}</option>
                      <option value="confirmed">{t('status.confirmed')}</option>
                      <option value="completed">{t('status.completed')}</option>
                      <option value="cancelled">{t('status.cancelled')}</option>
                    </select>
                  </div>
                </div>
                {/* 1번째 줄: 상품명 및 초이스 */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">상품 · 초이스</label>
                  <button
                    type="button"
                    onClick={() => setShowProductChoiceModal(true)}
                    className="inline-flex flex-wrap items-center gap-1.5 text-left max-w-full min-w-0 rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1"
                  >
                    {formData.productId ? (
                      <>
                        <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-200 text-xs font-medium truncate max-w-[200px]" title={(() => {
                          const p = products.find((p: { id: string }) => p.id === formData.productId)
                          return p ? (p as { name_ko?: string; name?: string }).name_ko || (p as { name?: string }).name || formData.productId : formData.productId
                        })()}>
                          {(() => {
                            const product = products.find((p: { id: string }) => p.id === formData.productId)
                            return product ? (product as { name_ko?: string; name?: string }).name_ko || (product as { name?: string }).name || formData.productId : formData.productId
                          })()}
                        </span>
                        {Array.isArray(formData.selectedChoices) && formData.selectedChoices.length > 0 && formData.selectedChoices.map((sc: { choice_id: string; option_id: string; option_name_ko?: string; option_key?: string }) => {
                          const label = sc.option_id === '__undecided__'
                            ? '미정'
                            : ((sc as { option_name_ko?: string; option_key?: string }).option_name_ko
                            || (sc as { option_name_ko?: string; option_key?: string }).option_key
                            || (() => {
                              const choice = formData.productChoices?.find((c: { id: string }) => c.id === sc.choice_id)
                              const option = choice?.options?.find((o: { id: string }) => o.id === sc.option_id)
                              return (option as { option_name_ko?: string; option_key?: string })?.option_name_ko || (option as { option_key?: string })?.option_key || sc.option_id
                            })())
                          return (
                            <span key={`${sc.choice_id}-${sc.option_id}`} className="inline-flex items-center px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-200 text-xs font-medium truncate max-w-[120px]" title={label}>
                              {label}
                            </span>
                          )
                        })}
                      </>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-200 text-xs font-medium">{t('form.openProductChoice')}</span>
                    )}
                  </button>
                </div>
                {/* 2·3·4번째 줄: 투어 날짜/시간, 채널/픽업시간, 픽업 호텔 */}
                <div id="tour-info-section" className="space-y-4">
                  <TourInfoSection
                    formData={formData}
                    setFormData={setFormData}
                    pickupHotels={pickupHotels}
                    sanitizeTimeInput={sanitizeTimeInput}
                    t={t}
                    channelSlot={
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">채널</label>
                        <button
                          type="button"
                          onClick={() => setShowChannelModal(true)}
                          title={formData.channelId ? selectedChannelDisplayTitle : undefined}
                          className="w-full px-3 py-1.5 text-xs font-medium bg-sky-100 text-sky-800 border border-sky-200 rounded-lg hover:bg-sky-200 text-left truncate"
                        >
                          {formData.channelId
                            ? selectedChannelDisplayTitle ||
                              (channels.find((c: { id: string }) => c.id === formData.channelId)?.name ?? formData.channelId)
                            : t('form.openChannelSelect')}
                        </button>
                      </div>
                    }
                  />
                </div>
                <div id="participants-section">
                  <ParticipantsSection
                    showResidentStatusSection={showResidentStatusSection}
                    formData={formData}
                    setFormData={setFormData}
                    applyResidentParticipantPatch={applyResidentParticipantPatch}
                    t={t}
                    reservationId={effectiveReservationId ?? null}
                    locale={locale}
                  />
                </div>
              </div>

              {/* 연결된 투어 - 2열 하단 */}
              {layout === 'page' && reservation && !isImportMode && (
                <div className="max-lg:mt-4 max-lg:order-5">
                  <TourConnectionSection
                    reservation={reservation}
                    onTourCreated={() => {}}
                  />
                </div>
              )}
              </div>

              {/* 3열: 예약 옵션 · 입금 · 지출 (각각 별도 박스, 타이틀 한 번, 내역은 가로줄 구분) */}
              <div className="lg:flex lg:flex-col lg:gap-4 lg:min-h-0 lg:overflow-y-auto max-lg:contents">
              {layout === 'page' && isImportMode && (
                <ImportTourDaySummary
                  tourDate={formData.tourDate}
                  productId={formData.productId}
                  products={products}
                  locale={locale}
                />
              )}
              {reservation && !isImportMode && effectiveReservationId && (
                <>
                  <div id="options-section" className="border border-gray-200 rounded-xl p-3 sm:p-4 bg-gray-50/50 max-lg:order-6 overflow-y-auto">
                    <ReservationOptionsSection
                      reservationId={effectiveReservationId}
                      onTotalPriceChange={setReservationOptionsTotalPrice}
                      onCancelledRefundTotalChange={setReservationOptionsCancelledRefundTotal}
                      title="예약 옵션"
                      itemVariant="line"
                      isPersisted={!isNewReservation}
                      onPendingOptionsChange={setPendingReservationOptions}
                    />
                  </div>
                  <div id="payment-section" className="border border-gray-200 rounded-xl p-3 sm:p-4 bg-gray-50/50 max-lg:order-6 overflow-y-auto">
                    <PaymentRecordsList
                      reservationId={effectiveReservationId}
                      customerName={customers.find(c => c.id === formData.customerId)?.name || 'Unknown'}
                      title="입금 내역"
                      itemVariant="line"
                      onPaymentRecordsUpdated={() => setExpenseUpdateTrigger(prev => prev + 1)}
                      suggestedCancelRefundAmountUsd={Number(formData.depositAmount) || 0}
                    />
                  </div>
                  <div id="expense-section" className="border border-gray-200 rounded-xl p-3 sm:p-4 bg-gray-50/50 max-lg:order-6 overflow-y-auto">
                    <ReservationExpenseManager
                      key={
                        isStubReservationOnlyId
                          ? `${effectiveReservationId}-${reservationDraftReady}`
                          : (effectiveReservationId ?? 'expenses')
                      }
                      reservationId={effectiveReservationId}
                      submittedBy={formData.addedBy}
                      userRole="admin"
                      onExpenseUpdated={() => setExpenseUpdateTrigger(prev => prev + 1)}
                      title="예약 지출"
                      itemVariant="card"
                      isPersisted={!isStubReservationOnlyId || reservationDraftReady}
                      {...(isStubReservationOnlyId &&
                      (!reservationDraftReady || reservationDraftError != null)
                        ? {
                            persistHint:
                              reservationDraftError ?? '예약과 연결하는 중입니다…',
                          }
                        : {})}
                    />
                  </div>
                  <div id="assigned-tour-section" className="border border-gray-200 rounded-xl p-3 sm:p-4 bg-gray-50/50 max-lg:order-6 overflow-y-auto">
                    <TourConnectionSection reservation={reservation} variant="assignedSummary" />
                  </div>
                  {/* 후기 관리 - 3열 */}
                  {layout === 'page' && (
                    <div id="review-section" className="max-lg:order-8 max-lg:mt-4">
                      <ReviewManagementSection reservationId={effectiveReservationId} compact={true} />
                    </div>
                  )}
                </>
              )}
              </div>
            </div>

            {/* 가격 정보 - 기존 상품/채널 선택 컬럼 자리 (제목은 PricingSection에서 버튼과 같은 줄로 표시) */}
            <div id="pricing-section" className={`col-span-1 lg:col-span-2 space-y-2 overflow-y-auto border border-gray-200 rounded-xl p-3 sm:p-4 bg-gray-50/50 max-lg:order-3 ${isModal ? 'lg:h-auto' : 'lg:min-h-0 lg:flex-1'}`}>
              <div className="mb-2 pb-2 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-gray-500">
                  {reservation?.id ? (
                    <>
                      reservation_pricing id: <span className="font-mono text-gray-700">{reservationPricingId ?? '(아직 저장되지 않음)'}</span>
                    </>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {reservationPricingId && dynamicPriceFormula ? (
                    <button
                      type="button"
                      onClick={applyDynamicProductPriceFormula}
                      disabled={pricingAudit.audited && !isSuperPricingAdmin}
                      title={
                        pricingAudit.audited && !isSuperPricingAdmin
                          ? 'Audited 가격 정보는 super 관리자만 수정할 수 있습니다.'
                          : '현재 채널·날짜·초이스 기준 dynamic_pricing 계산값을 판매가·불포함·수수료% 입력칸에 반영합니다. 저장 시 DB에 반영됩니다.'
                      }
                      className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      계산식 적용
                    </button>
                  ) : null}
                  <label className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-violet-50 border border-violet-200 cursor-pointer hover:bg-violet-100 focus-within:ring-2 focus-within:ring-violet-400 focus-within:ring-offset-1">
                    <input
                      type="checkbox"
                      checked={formData.isPrivateTour}
                      onChange={(e) => {
                        setPricingFieldsFromDb((prev) => ({ ...prev, totalPrice: false }))
                        setFormData({ ...formData, isPrivateTour: e.target.checked })
                      }}
                      className="h-4 w-4 text-violet-600 focus:ring-violet-500 border-violet-300 rounded"
                    />
                    <span className="text-xs font-medium text-violet-800">단독투어</span>
                  </label>
                  {formData.isPrivateTour && (
                    <div className="flex items-center space-x-1">
                      <span className="text-xs text-gray-600">+$</span>
                      <input
                        type="number"
                        value={formData.privateTourAdditionalCost}
                        onChange={(e) => {
                          setPricingFieldsFromDb((prev) => ({ ...prev, totalPrice: false }))
                          setFormData({ ...formData, privateTourAdditionalCost: Number(e.target.value) || 0 })
                        }}
                        className="w-16 px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                        step="0.01"
                        placeholder="0"
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        if (!effectiveReservationId) {
                          alert(locale === 'ko' ? '가격 정보만 저장하려면 먼저 예약을 저장해 주세요.' : 'Please save the reservation first to save pricing.')
                          return
                        }
                        await savePricingInfo(effectiveReservationId)
                        alert('가격 정보가 저장되었습니다!')
                      } catch (error) {
                        const message = error instanceof Error ? error.message : ''
                        if (message === 'AUDIT_SAVE_CANCELLED') {
                          alert('Audited 가격 정보 저장을 취소했습니다.')
                        } else if (message.includes('Audited')) {
                          alert(message)
                        } else {
                          alert('가격 정보 저장 중 오류가 발생했습니다.')
                        }
                      }
                    }}
                    disabled={pricingAudit.audited && !isSuperPricingAdmin}
                    title={pricingAudit.audited && !isSuperPricingAdmin ? 'Audited 가격 정보는 super 관리자만 저장할 수 있습니다.' : undefined}
                    className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    저장
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPricingFieldsFromDb({})
                      setFormData((prev: any) => ({
                        ...prev,
                        adultProductPrice: 0,
                        childProductPrice: 0,
                        infantProductPrice: 0,
                        selectedChoices: {},
                        couponCode: '',
                        couponDiscount: 0,
                        additionalDiscount: 0,
                        additionalCost: 0,
                        refundReason: '',
                        refundAmount: 0,
                        cardFee: 0,
                        tax: 0,
                        prepaymentCost: 0,
                        prepaymentTip: 0,
                        selectedOptionalOptions: {},
                        depositAmount: 0,
                        isPrivateTour: false,
                        privateTourAdditionalCost: 0,
                        commission_percent: 0,
                        commission_amount: 0,
                        productChoices: []
                      }))
                    }}
                    className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                  >
                    초기화
                  </button>
                </div>
              </div>
              <PricingSection
                formData={formData as any}
                setFormData={setFormData}
                calculateProductPriceTotal={calculateProductPriceTotal}
                calculateChoiceTotal={calculateRequiredOptionTotal}
                calculateCouponDiscount={calculateCouponDiscount}
                coupons={coupons}
                getOptionalOptionsForProduct={(productId) =>
                  getOptionalOptionsForProduct(productId, productOptions) as any
                }
                options={options}
                t={t}
                autoSelectCoupon={pricingSectionAutoSelectCoupon}
                {...(isImportViatorNetRateMode
                  ? {
                      onCouponDropdownUserInput: () => {
                        viatorImportCouponUserAdjustedRef.current = true
                      },
                    }
                  : {})}
                reservationOptionsTotalPrice={reservationOptionsTotalPrice}
                reservationOptionCancelledRefundTotal={reservationOptionsCancelledRefundTotal}
                isExistingPricingLoaded={isExistingPricingLoaded}
                pricingFieldsFromDb={pricingFieldsFromDb}
                onPricingFieldEdited={(field) =>
                  setPricingFieldsFromDb((prev) => ({ ...prev, [field]: false }))
                }
                onChannelSettlementEdited={() =>
                  setPricingFieldsFromDb((prev) => ({ ...prev, channel_settlement_amount: false }))
                }
                pricingAudit={{
                  ...pricingAudit,
                  canToggle: isSuperPricingAdmin,
                  isLockedForCurrentUser: pricingAudit.audited && !isSuperPricingAdmin,
                }}
                onTogglePricingAudited={handleTogglePricingAudited}
                onRequestPricingAuditModification={handleRequestPricingAuditModification}
                priceCalculationPending={
                  Boolean(formData.productId && formData.tourDate && formData.channelId) &&
                  !pricingLoadComplete &&
                  !(needsEditChoicesHydration && !editPricingChoicesReady)
                }
                {...(effectiveReservationId ? { reservationId: effectiveReservationId } : {})}
                reservationPricingId={reservationPricingId}
                dynamicProductPriceFormula={dynamicPriceFormula}
                showDynamicPricingFormula={Boolean(reservationPricingId)}
                expenseUpdateTrigger={expenseUpdateTrigger}
                channels={channels.map(({ type, ...c }) => ({ ...c, ...(type != null ? { type } : {}) })) as any}
                products={products}
              />
            </div>
          </div>
          </div>
        </form>
      </div>

      {/* 고객 추가 모달 */}
      {showCustomerForm && (
        <CustomerForm
          customer={null}
          channels={channels}
          onSubmit={handleAddCustomer}
          onCancel={() => setShowCustomerForm(false)}
        />
      )}

      {/* 가격 정보 수정 모달 */}
      {reservation && (
        <PricingInfoModal
          reservation={reservation}
          isOpen={showPricingModal}
          onClose={() => setShowPricingModal(false)}
        />
      )}

      {/* 상품 및 초이스 선택 모달 */}
      {showProductChoiceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-base font-semibold text-gray-900">{t('form.openProductChoice')}</h3>
              <button
                type="button"
                onClick={() => setShowProductChoiceModal(false)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                aria-label="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-3">
              <ProductSelectionSection
                formData={formData}
                setFormData={setFormData}
                products={products.map((p) => ({
                  ...p,
                  name_ko: (p as { name?: string | null; name_ko?: string | null }).name ?? (p as { name_ko?: string | null }).name_ko ?? '',
                }))}
                loadProductChoices={(productId) => loadProductChoices(productId, formData.channelId)}
                getDynamicPricingForOption={getDynamicPricingForOption}
                t={t}
                layout="modal"
                onAccordionToggle={setProductAccordionExpanded}
                isEditMode={!!reservation?.id}
                channels={channels.map(({ type, ...c }) => ({ ...c, ...(type != null ? { type } : {}) }))}
              />
            </div>
            <div className="p-2 border-t border-gray-200 flex justify-end flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowProductChoiceModal(false)}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium"
              >
                {tCommon('confirm') || '확인'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 채널 선택 모달 */}
      {showChannelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-base font-semibold text-gray-900">{t('form.openChannelSelect')}</h3>
              <button
                type="button"
                onClick={() => setShowChannelModal(false)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                aria-label="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-3">
              <ChannelSection
                formData={formData}
                setFormData={setFormData}
                channels={channels.map((c) => ({
                  ...c,
                  type: (c.type ?? 'self') as 'partner' | 'ota' | 'self',
                }))}
                t={t}
                layout="modal"
                onAccordionToggle={setChannelAccordionExpanded}
                {...(formData.channelId ? { selectedChannelTitleOverride: selectedChannelDisplayTitle } : {})}
                {...(isImportMode && importPreferredVariantKey
                  ? { importPreferredVariantKey }
                  : {})}
              />
            </div>
            <div className="p-2 border-t border-gray-200 flex justify-end flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowChannelModal(false)}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium"
              >
                {tCommon('confirm') || '확인'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 중복 고객 확인 모달 */}
      {showDuplicateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[110]">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center space-x-2">
                <AlertTriangle className="h-6 w-6 text-amber-500" />
                <span>비슷한 고객이 있습니다</span>
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowDuplicateModal(false)
                  setSimilarCustomers([])
                  setPendingCustomerData(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-700 mb-2">
                <strong>입력한 정보:</strong>
              </p>
              <div className="text-sm space-y-1">
                <div><strong>이름:</strong> {pendingCustomerData?.name}</div>
                <div><strong>이메일:</strong> {pendingCustomerData?.email?.trim() || '—'}</div>
                <div><strong>전화번호:</strong> {pendingCustomerData?.phone?.trim() || '—'}</div>
                <div>
                  <strong>언어:</strong>{' '}
                  {LANGUAGE_OPTIONS.find((o) => o.value === pendingCustomerData?.language)?.label ||
                    pendingCustomerData?.language ||
                    '—'}
                </div>
                <div>
                  <strong>채널:</strong>{' '}
                  {pendingCustomerData?.channel_id
                    ? channels.find((ch) => ch.id === pendingCustomerData.channel_id)?.name || '—'
                    : '—'}
                </div>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-3">
                비슷한 기존 고객 {similarCustomers.length}명을 찾았습니다. 기존 고객을 선택하시겠습니까, 아니면 새로 추가하시겠습니까?
              </p>
              
              <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-2">
                {similarCustomers.map((similarCustomer) => {
                  const langLabel =
                    LANGUAGE_OPTIONS.find((o) => o.value === similarCustomer.language)?.label ||
                    (similarCustomer.language?.trim() ? similarCustomer.language : null) ||
                    '—'
                  const channelLabel =
                    channels.find((ch) => ch.id === similarCustomer.channel_id)?.name || '—'
                  return (
                  <div
                    key={similarCustomer.id}
                    className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={async () => {
                      // 기존 고객 선택 - ref에 ID를 저장하여 handleSubmit에서 즉시 사용
                      resolvedCustomerIdRef.current = similarCustomer.id
                      setFormData(prev => ({ ...prev, customerId: similarCustomer.id }))
                      setShowNewCustomerForm(false)
                      setShowDuplicateModal(false)
                      setSimilarCustomers([])
                      setPendingCustomerData(null)
                      void onRefreshCustomers().catch(() => {})
                      const form = document.querySelector('form') as HTMLFormElement
                      if (form) {
                        form.requestSubmit()
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 mb-1">
                          {similarCustomer.name?.trim() || '—'}
                        </div>
                        <div className="text-xs text-gray-400 font-mono mb-2">
                          ID: {similarCustomer.id}
                        </div>
                        <div className="text-sm text-gray-600 space-y-1.5">
                          <div className="flex items-start gap-2">
                            <Mail className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-gray-400" />
                            <span>
                              <span className="text-gray-500">이메일 </span>
                              {similarCustomer.email?.trim() || '—'}
                            </span>
                          </div>
                          <div className="flex items-start gap-2">
                            <Phone className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-gray-400" />
                            <span>
                              <span className="text-gray-500">전화번호 </span>
                              {similarCustomer.phone?.trim() || '—'}
                            </span>
                          </div>
                          <div className="flex items-start gap-2">
                            <Globe className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-gray-400" />
                            <span>
                              <span className="text-gray-500">언어 </span>
                              {langLabel}
                            </span>
                          </div>
                          <div className="flex items-start gap-2">
                            <Store className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-gray-400" />
                            <span>
                              <span className="text-gray-500">채널 </span>
                              {channelLabel}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                          선택
                        </span>
                      </div>
                    </div>
                  </div>
                  )
                })}
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => {
                  setShowDuplicateModal(false)
                  setSimilarCustomers([])
                  setPendingCustomerData(null)
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={async () => {
                  // 새로 추가하기
                  if (pendingCustomerData) {
                    const newCustomerId = generateCustomerId()
                    
                    const customerData = {
                      ...pendingCustomerData,
                      id: newCustomerId
                    }

                    const { row: newCustomer, errorMessage: dupCreateErr } = await insertCustomerForReservationForm(
                      useServerCustomerInsert,
                      customerData as Record<string, unknown>
                    )

                    if (dupCreateErr || !newCustomer) {
                      console.error('고객 정보 생성 오류:', dupCreateErr)
                      alert('고객 정보 생성 중 오류가 발생했습니다: ' + (dupCreateErr || '알 수 없음'))
                      return
                    }

                    // ref에 생성된 고객 ID를 저장하여 handleSubmit에서 즉시 사용
                    resolvedCustomerIdRef.current = newCustomer.id
                    setFormData(prev => ({ ...prev, customerId: newCustomer.id }))
                    setShowNewCustomerForm(false)
                    setShowDuplicateModal(false)
                    setSimilarCustomers([])
                    setPendingCustomerData(null)
                    void onRefreshCustomers().catch(() => {})
                    
                    const form = document.querySelector('form') as HTMLFormElement
                    if (form) {
                      form.requestSubmit()
                    }
                  } else {
                    setShowDuplicateModal(false)
                    setSimilarCustomers([])
                    setPendingCustomerData(null)
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                새로 추가하기
              </button>
            </div>
          </div>
        </div>
      )}
      <CancellationReasonModal
        isOpen={cancellationReasonModalOpen}
        locale={locale}
        saving={cancellationReasonSaving}
        onClose={closeCancellationReasonModal}
        onSubmit={submitCancellationReasonModal}
      />
    </div>
  )
}
