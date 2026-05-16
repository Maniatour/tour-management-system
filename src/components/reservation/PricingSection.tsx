'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { supabase, isAbortLikeError } from '@/lib/supabase'
import {
  Calculator,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  RefreshCw,
  HelpCircle,
} from 'lucide-react'
import { useLocale } from 'next-intl'
import {
  hotelAmountForSettlement,
  isHotelBookingIncludedInSettlement,
  isTicketBookingIncludedInSettlement,
  ticketExpenseForSettlement
} from '@/lib/bookingSettlement'
import {
  findUsResidentClassificationChoice,
  sumResidentFeeAmountsUsd,
} from '@/utils/usResidentChoiceSync'
import type { ChannelSettlementComputeInput } from '@/utils/channelSettlement'
import {
  channelIsOtaForPricingSection,
  computeChannelPaymentAfterReturn,
  computeChannelSettlementAmount,
  deriveCommissionGrossForSettlement,
  shouldOmitAdditionalDiscountAndCostFromCompanyRevenueSum,
} from '@/utils/channelSettlement'
import { isHomepageBookingChannel } from '@/utils/homepageBookingChannel'
import {
  computeEffectiveCustomerPaidTowardDue,
  summarizePaymentRecordsForBalance,
} from '@/utils/reservationPricingBalance'
import { splitNotIncludedForDisplay } from '@/utils/pricingSectionDisplay'

function roundUsd2(n: number): number {
  return Math.round(n * 100) / 100
}

/** `tours.reservation_ids` — 배열·JSON 문자열·콤마 구분 정규화 (투어 지출 배분 자격 판단용) */
function normalizeTourRosterIds(raw: unknown): string[] {
  if (raw == null) return []
  if (Array.isArray(raw)) {
    return [...new Set(raw.map((v) => String(v).trim()).filter((s) => s.length > 0))]
  }
  if (typeof raw === 'string') {
    const t = raw.trim()
    if (!t) return []
    if (t.startsWith('[') && t.endsWith(']')) {
      try {
        const parsed = JSON.parse(t) as unknown
        return Array.isArray(parsed) ? normalizeTourRosterIds(parsed) : []
      } catch {
        return []
      }
    }
    if (t.includes(',')) {
      return [...new Set(t.split(',').map((s) => s.trim()).filter((s) => s.length > 0))]
    }
    return [t]
  }
  return []
}

function tourRosterIncludesReservation(rawIds: unknown, reservationId: string): boolean {
  const rid = String(reservationId).trim()
  if (!rid) return false
  return normalizeTourRosterIds(rawIds).includes(rid)
}

function formulaUsdDiffers(current: number, formula: number): boolean {
  return Math.abs((Number(current) || 0) - (Number(formula) || 0)) > 0.009
}

/** exactOptionalPropertyTypes: `channelSettlementAmount: undefined` 불가 — 키를 제거해 DB 정산 캐시 무효화 */
function omitChannelSettlementAmount<T extends Record<string, unknown>>(
  prev: T
): Omit<T, 'channelSettlementAmount'> {
  const { channelSettlementAmount: _drop, ...rest } = prev as T & { channelSettlementAmount?: number }
  void _drop
  return rest as Omit<T, 'channelSettlementAmount'>
}

/** OTA 채널 수수료 $: (결제 그로스−Returned) 기준액 × % 가 바뀌면 자동 갱신, 이후 사용자가 $만 수정한 경우는 유지 */
function otaCommissionFeeFingerprint(commissionCalcBase: number, commissionPercent: number): string {
  return `${roundUsd2(Math.max(0, commissionCalcBase))}|${Number(commissionPercent || 0).toFixed(4)}`
}

/** 동적가격 계산 결과: 비거주 합산 전(base) / 비거주 / 합계 */
type NotIncludedCalcResult = {
  baseTotal: number
  residentFees: number
  total: number
}

function packNotIncluded(base: number, resident: number): NotIncludedCalcResult {
  const b = roundUsd2(base)
  const r = roundUsd2(resident)
  return { baseTotal: b, residentFees: r, total: roundUsd2(b + r) }
}
interface ProductOption {
  id: string
  name: string
  linked_option_id?: string
  product_option_choices?: Array<{
    id: string
    name: string
    adult_price_adjustment?: number
    child_price_adjustment?: number
    infant_price_adjustment?: number
  }>
}

interface Option {
  id: string
  name: string
  category: string
  adult_price: number
  child_price: number
  infant_price: number
}

interface PricingSectionProps {
  formData: {
    productId: string
    tourDate: string
    channelId: string
    isPrivateTour: boolean
    privateTourAdditionalCost: number
    adultProductPrice: number
    childProductPrice: number
    infantProductPrice: number
    adults: number
    pricingAdults: number
    child: number
    infant: number
    productPriceTotal: number
    productChoices: Array<{
      id: string
      name: string
      options?: Array<{
        id: string
        name: string
        adult_price?: number
        child_price?: number
        infant_price?: number
      }>
    }>
    selectedChoices: Record<string, { selected: string; timestamp: string }>
    choiceTotal: number
    choicesTotal?: number
    subtotal: number
    couponCode: string
    couponDiscount: number
    additionalDiscount: number
    additionalCost: number
    refundReason?: string
    refundAmount?: number
    tax: number
    cardFee: number
    prepaymentCost: number
    prepaymentTip: number
    selectedOptionalOptions: Record<string, { choiceId: string; quantity: number; price: number }>
    optionTotal: number
    selectedOptions: { [optionId: string]: string[] }
    totalPrice: number
    depositAmount: number
    balanceAmount: number
    /** 예약 상태 — 취소 시 채널 수수료·정산·매출 표시를 0 기준으로 맞춤 */
    status?: string
    commission_percent: number
    commission_amount: number
    commission_base_price?: number
    /** DB `channel_settlement_amount` — 로드 시 정산 행 표시 우선 */
    channelSettlementAmount?: number
    onlinePaymentAmount?: number
    onSiteBalanceAmount?: number
    not_included_price?: number
    /** 거주 상태별 금액(비거주 등) — 불포함 합산에 사용 */
    residentStatusAmounts?: Record<string, number>
    /** 동적 불포함 중 비거주·패스 등을 제외한 금액(표시용) */
    choiceNotIncludedBaseTotal?: number
    priceType?: 'base' | 'dynamic'
  }
  channels?: Array<{
    id: string
    name: string
    type?: string
    category?: string
    pricing_type?: 'separate' | 'single'
    commission_base_price_only?: boolean
    has_not_included_price?: boolean
    not_included_type?: 'none' | 'amount_only' | 'amount_and_choice'
    commission_percent?: number
    commission?: number
    commission_rate?: number
    [key: string]: unknown
  }>
  products?: Array<{
    id: string
    sub_category?: string | null
    [key: string]: unknown
  }>
  reservationId?: string
  /** `reservation_pricing` 행이 있으면 할인/쿠폰은 DB 값 유지·드롭다운은 저장 쿠폰만 표시 */
  reservationPricingId?: string | null
  /** 현재 채널 기준 dynamic_pricing 계산 스냅샷 — 입력값과 다르면 제목 옆 빨간색으로 표시 */
  dynamicProductPriceFormula?: {
    adultPrice: number
    childPrice: number
    infantPrice: number
    notIncludedPrice: number
  } | null
  showDynamicPricingFormula?: boolean
  expenseUpdateTrigger?: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFormData: (data: any) => void
  calculateProductPriceTotal: () => number
  calculateChoiceTotal: () => number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  calculateCouponDiscount: (coupon: any, subtotal: number) => number
  coupons: Array<{
    id: string
    coupon_code: string
    discount_type: 'percentage' | 'fixed'
    percentage_value?: number | null
    fixed_value?: number | null
    channel_id?: string | null
  }>
  getOptionalOptionsForProduct: (productId: string) => ProductOption[]
  options: Option[]
  t: (key: string) => string
  autoSelectCoupon: () => void
  /** 쿠폰 `<select>` 사용자 조작 시(예: Viator 가져오기에서 자동 쿠폰 재적용 억제) */
  onCouponDropdownUserInput?: () => void
  reservationOptionsTotalPrice?: number
  /** 취소·환불 처리된 예약 옵션 줄 total_price 합 — ④ 환불 입력 합에 포함 */
  reservationOptionCancelledRefundTotal?: number
  isExistingPricingLoaded?: boolean
  /** DB에서 불러온 필드면 검은색, 계산값이면 빨간색 표시 */
  pricingFieldsFromDb?: Record<string, boolean>
  /** 동적가격 로드·정산 연쇄 계산 중이면 숫자 대신 오버레이 (깜빡임 완화) */
  priceCalculationPending?: boolean
  /** 사용자가 가격 필드를 직접 수정하면 DB 출처 표시(검정)를 끄고 계산/수정값(빨강)으로 전환 */
  onPricingFieldEdited?: (field: string) => void
  /** 사용자가 채널 정산 금액을 직접 수정하면 DB 출처 표시(검정)를 끔 */
  onChannelSettlementEdited?: () => void
  pricingAudit?: {
    audited: boolean
    auditedAt: string | null
    auditedByEmail: string | null
    auditedByName: string | null
    auditedByNickName: string | null
    canToggle: boolean
    isLockedForCurrentUser: boolean
  }
  onTogglePricingAudited?: (audited: boolean) => void
  onRequestPricingAuditModification?: () => void
  /** `loadPricingInfo` 직후 DB의 `total_price`·저장된 매출/이익 — 화면 계산과 병기 */
  pricingDbSnapshot?: {
    total_price: number | null
    company_total_revenue: number | null
    operating_profit: number | null
  } | null
}

export default function PricingSection({
  formData,
  setFormData,
  calculateProductPriceTotal,
  calculateChoiceTotal,
  calculateCouponDiscount,
  coupons,
  autoSelectCoupon,
  onCouponDropdownUserInput,
  reservationOptionsTotalPrice = 0,
  reservationOptionCancelledRefundTotal = 0,
  isExistingPricingLoaded,
  pricingFieldsFromDb = {},
  priceCalculationPending = false,
  onPricingFieldEdited,
  onChannelSettlementEdited,
  pricingAudit,
  onTogglePricingAudited,
  onRequestPricingAuditModification,
  reservationId,
  reservationPricingId,
  dynamicProductPriceFormula = null,
  showDynamicPricingFormula = false,
  expenseUpdateTrigger,
  channels = [],
  products = [],
  pricingDbSnapshot = null,
  t
}: PricingSectionProps) {
  const locale = useLocale()
  const isKorean = locale === 'ko'
  /** DB 값 = 검은색, 계산값 = 빨간색 */
  const priceTextClass = (field: string) => (pricingFieldsFromDb[field] ? 'text-gray-900' : 'text-red-600')
  const markPricingEdited = useCallback(
    (...fields: string[]) => {
      fields.forEach((field) => onPricingFieldEdited?.(field))
    },
    [onPricingFieldEdited]
  )
  /** reservation_pricing에 commission_base_price(채널 결제 net)가 있으면 상품가·보증금 effect로 덮어쓰지 않음 */
  const channelPaymentLoadedFromDb = Boolean(
    pricingFieldsFromDb.onlinePaymentAmount || pricingFieldsFromDb.commission_base_price
  )
  /** `markPricingEdited`로 온라인/채널결제 DB 플래그가 꺼진 뒤 — 블러 후 상품가 동기화 effect가 값을 덮어쓰지 않음(ref만으로는 레이스 가능) */
  const channelPaymentPricingTouched =
    pricingFieldsFromDb.onlinePaymentAmount === false ||
    pricingFieldsFromDb.commission_base_price === false
  const [showHelp, setShowHelp] = useState(false)
  const [reservationExpensesTotal, setReservationExpensesTotal] = useState(0)
  const [loadingExpenses, setLoadingExpenses] = useState(false)
  const [tourExpensesTotal, setTourExpensesTotal] = useState(0)
  const [loadingTourExpenses, setLoadingTourExpenses] = useState(false)
  /** `tours.reservation_ids`에 이 예약이 있을 때만 투어 지출 배분·정산 카드 노출 */
  const [tourExpenseAllocationEligible, setTourExpenseAllocationEligible] = useState(false)
  // 입금 내역 계산 결과 저장
  const [calculatedBalanceReceivedTotal, setCalculatedBalanceReceivedTotal] = useState(0)
  // 환불 금액 저장
  const [refundedAmount, setRefundedAmount] = useState(0) // 우리 쪽 환불 (Refunded)
  const [returnedAmount, setReturnedAmount] = useState(0) // 파트너 환불 (Returned)
  /** 정산 상한용: payment_status가 정확히 'Partner Received' 인 합계(DB·`computeChannelSettlementAmount`와 동일) */
  const [partnerReceivedForSettlement, setPartnerReceivedForSettlement] = useState(0)
  // 카드 수수료 수동 입력 여부 추적
  const isCardFeeManuallyEdited = useRef(false)
  /** OTA 채널 결제 금액을 사용자가 직접 입력한 뒤에는 상품가 동기화 effect가 덮어쓰지 않음(블러 직후 리셋 방지) */
  const otaChannelPaymentUserEditedRef = useRef(false)
  /** 홈페이지 등 비-OTA: 채널 결제 gross를 수동 입력한 뒤 상품가·보증금 effect가 덮어쓰지 않음 */
  const nonOtaChannelPaymentUserEditedRef = useRef(false)
  /**
   * 비-OTA: reservation_pricing에 채널 결제가 있었거나 사용자가 입력한 뒤에는
   * `markPricingEdited`가 pricingFieldsFromDb 플래그를 끄더라도 할인 후 상품가 → online/commission_base 자동 동기화를 하지 않음.
   */
  const nonOtaChannelPaymentStopProductAutoSyncRef = useRef(false)
  /** 채널 결제 금액 입력 포커스 중 — markPricingEdited로 DB 플래그가 꺼진 직후에도 자동 동기화가 덮어쓰지 않음 */
  const channelPaymentAmountFieldFocusedRef = useRef(false)
  /** OTA: 마지막 자동 수수료 $ 기준(수수료 산출 base × %) — 이 키가 바뀌면 $를 다시 계산 */
  const otaCommissionAutoFingerprintRef = useRef<string>('')
  /** User edited deposit (including 0): skip product/discount auto-fill for deposit */
  const depositAmountUserEditedRef = useRef(false)
  const prevDepositAutoChannelIdRef = useRef<string | undefined>(undefined)
  // 채널 수수료 $ 입력 필드 로컬 상태 (입력 중 포맷팅 방지)
  const [commissionAmountInput, setCommissionAmountInput] = useState<string>('')
  const [isCommissionAmountFocused, setIsCommissionAmountFocused] = useState(false)
  // 채널 결제 금액 입력 필드 로컬 상태 (입력 중 포맷팅 방지)
  const [channelPaymentAmountInput, setChannelPaymentAmountInput] = useState<string>('')
  const [isChannelPaymentAmountFocused, setIsChannelPaymentAmountFocused] = useState(false)
  // 잔액 (투어 당일 지불) 입력 필드 로컬 상태 (입력 중 포맷팅 방지)
  const [onSiteBalanceAmountInput, setOnSiteBalanceAmountInput] = useState<string>('')
  const [isOnSiteBalanceAmountFocused, setIsOnSiteBalanceAmountFocused] = useState(false)
  const [channelSettlementAmountInput, setChannelSettlementAmountInput] = useState('')
  const [isChannelSettlementAmountFocused, setIsChannelSettlementAmountFocused] = useState(false)
  /** 채널 정산 금액을 사용자가 직접 넣은 뒤에는 omit·타 필드 연쇄로 폼 값을 지우거나 산식이 덮어쓰지 않음 */
  const channelSettlementUserEditedRef = useRef(false)

  const stripChannelSettlementUnlessLocked = (prev: typeof formData): typeof formData => {
    if (channelSettlementUserEditedRef.current) return { ...prev }
    return { ...omitChannelSettlementAmount(prev) } as typeof formData
  }

  // fetchPaymentRecords 등에서 formData/channels 의존 루프 방지용 (항상 최신 참조)
  useEffect(() => {
    otaCommissionAutoFingerprintRef.current = ''
    otaChannelPaymentUserEditedRef.current = false
    nonOtaChannelPaymentUserEditedRef.current = false
    nonOtaChannelPaymentStopProductAutoSyncRef.current = false
    channelPaymentAmountFieldFocusedRef.current = false
    depositAmountUserEditedRef.current = false
    channelSettlementUserEditedRef.current = false
  }, [reservationId])

  /** DB에 채널 결제(net/gross) 스냅샷이 있으면 비-OTA 상품가 자동 동기화를 영구히 잠금(플래그는 수정 시 꺼질 수 있음). */
  useEffect(() => {
    if (
      isExistingPricingLoaded &&
      (pricingFieldsFromDb.onlinePaymentAmount === true ||
        pricingFieldsFromDb.commission_base_price === true)
    ) {
      nonOtaChannelPaymentStopProductAutoSyncRef.current = true
    }
  }, [
    isExistingPricingLoaded,
    pricingFieldsFromDb.onlinePaymentAmount,
    pricingFieldsFromDb.commission_base_price,
  ])

  const formDataRef = useRef(formData)
  formDataRef.current = formData
  const channelsRef = useRef(channels)
  channelsRef.current = channels
  /** Sale price (adult/child/infant): skip deposit/balance auto-sync while typing; sync after all sale fields blur. */
  const productSalePriceFocusDepthRef = useRef(0)
  const [productSalePriceCommitTick, setProductSalePriceCommitTick] = useState(0)
  const bumpProductSalePriceCommit = useCallback(() => {
    setProductSalePriceCommitTick((t) => t + 1)
  }, [])
  const onProductSalePriceFocusIn = useCallback(() => {
    productSalePriceFocusDepthRef.current += 1
  }, [])
  /** setTimeout(0): defer depth decrement so focus can move to another sale-price field without syncing mid-sequence. */
  const onProductSalePriceFocusOut = useCallback(() => {
    window.setTimeout(() => {
      productSalePriceFocusDepthRef.current = Math.max(0, productSalePriceFocusDepthRef.current - 1)
      if (productSalePriceFocusDepthRef.current === 0) {
        bumpProductSalePriceCommit()
      }
    }, 0)
  }, [bumpProductSalePriceCommit])
  const calculateTotalCustomerPaymentRef = useRef<() => number>(() => 0)
  const calculateTotalCustomerPaymentGrossRef = useRef<() => number>(() => 0)
  const [choiceNotIncludedTotal, setChoiceNotIncludedTotal] = useState(0)
  const [choiceNotIncludedBaseTotal, setChoiceNotIncludedBaseTotal] = useState(0)

  const notIncludedBreakdown = useMemo(
    () =>
      splitNotIncludedForDisplay(
        choiceNotIncludedTotal,
        choiceNotIncludedBaseTotal,
        formData.not_included_price || 0,
        formData.pricingAdults,
        formData.child,
        formData.infant,
        formData.residentStatusAmounts
      ),
    [
      choiceNotIncludedTotal,
      choiceNotIncludedBaseTotal,
      formData.not_included_price,
      formData.pricingAdults,
      formData.child,
      formData.infant,
      formData.residentStatusAmounts,
    ]
  )

  // 예약 지출 총합 조회 함수
  const fetchReservationExpenses = useCallback(async () => {
    if (!reservationId) {
      console.log('PricingSection: reservationId가 없어서 지출 조회를 건너뜁니다.')
      setReservationExpensesTotal(0)
      return
    }

    console.log('PricingSection: 예약 지출 조회 시작, reservationId:', reservationId)
    setLoadingExpenses(true)
    try {
      const { data, error } = await supabase
        .from('reservation_expenses')
        .select('amount, status, id, paid_for')
        .eq('reservation_id', reservationId)
        // 모든 상태의 지출을 포함 (rejected 제외)
        .not('status', 'eq', 'rejected')

      if (process.env.NODE_ENV === 'development') {
        if (!error || !isAbortLikeError(error)) {
          console.log('PricingSection: 예약 지출 조회 결과:', { data, error })
        }
      }

      if (error) {
        if (!isAbortLikeError(error)) {
          console.error('예약 지출 조회 오류:', error)
        }
        setReservationExpensesTotal(0)
        return
      }

      const total = data?.reduce((sum: number, expense: { amount: number | null }) => sum + (expense.amount || 0), 0) || 0
      console.log('PricingSection: 계산된 지출 총합:', total, '개별 지출:', data?.map((e: { id: string; amount: number | null; paid_for: string | null; status: string | null }) => ({ id: e.id, amount: e.amount || 0, paid_for: e.paid_for || '', status: e.status || '' })))
      setReservationExpensesTotal(total)
    } catch (error) {
      if (isAbortLikeError(error)) {
        return
      }
      console.error('예약 지출 조회 중 오류:', error)
      setReservationExpensesTotal(0)
    } finally {
      setLoadingExpenses(false)
    }
  }, [reservationId])

  // 투어 지출 총합 조회 함수 (Mania Tour 또는 Mania Service인 경우)
  const fetchTourExpenses = useCallback(async () => {
    if (!reservationId || !formData.productId || !formData.tourDate) {
      setTourExpensesTotal(0)
      setTourExpenseAllocationEligible(false)
      return
    }

    // 상품의 sub_category 확인
    const product = products.find(p => p.id === formData.productId)
    const subCategory = product?.sub_category || ''
    const isManiaTour = subCategory === 'Mania Tour' || subCategory === 'Mania Service'
    
    if (!isManiaTour) {
      setTourExpensesTotal(0)
      setTourExpenseAllocationEligible(false)
      return
    }

    setTourExpenseAllocationEligible(false)
    console.log('PricingSection: 투어 지출 조회 시작', { reservationId, productId: formData.productId, tourDate: formData.tourDate })
    setLoadingTourExpenses(true)
    try {
      // 1. 먼저 reservations 테이블에서 tour_id 확인
      const { data: reservationData, error: reservationError } = await supabase
        .from('reservations')
        .select('tour_id')
        .eq('id', reservationId)
        .maybeSingle()
      
      if (reservationError && (reservationError.message || reservationError.code)) {
        if (!isAbortLikeError(reservationError)) {
          console.error('예약 조회 오류:', reservationError)
        }
        setTourExpensesTotal(0)
        setLoadingTourExpenses(false)
        return
      }

      let tourData: any = null

      // 2. tour_id가 있으면 해당 투어 사용
      if (reservationData?.tour_id) {
        const { data: tourById, error: tourByIdError } = await supabase
          .from('tours')
          .select('id, reservation_ids, product_id, tour_date, guide_fee, assistant_fee')
          .eq('id', reservationData.tour_id)
          .maybeSingle()

        if (tourByIdError && (tourByIdError.message || tourByIdError.code)) {
          if (!isAbortLikeError(tourByIdError)) {
            console.error('tour_id로 투어 조회 오류:', tourByIdError)
          }
        } else if (tourById) {
          if (!tourRosterIncludesReservation((tourById as { reservation_ids?: unknown }).reservation_ids, reservationId)) {
            console.log(
              'PricingSection: reservations.tour_id는 있으나 tours.reservation_ids에 예약 없음 → 투어 지출 제외'
            )
          } else {
            tourData = tourById
            console.log('PricingSection: reservations.tour_id로 투어 찾음:', tourData.id)
          }
        }
      }

      // 3. tour_id가 없거나 찾지 못한 경우, tours 테이블의 reservation_ids 배열에서 찾기
      if (!tourData) {
        console.log('PricingSection: tour_id가 없어서 reservation_ids에서 투어 찾기 시도')
        
        // 같은 product_id와 tour_date의 모든 투어를 가져온 후 필터링
        const { data: allTours, error: toursError } = await (supabase as any)
          .from('tours')
          .select('id, reservation_ids, product_id, tour_date, guide_fee, assistant_fee')
          .eq('product_id', formData.productId)
          .eq('tour_date', formData.tourDate)

        // 오류가 있고 실제 오류인 경우에만 처리 (빈 객체나 null이 아닌 경우)
        if (toursError && (toursError.message || toursError.code || Object.keys(toursError).length > 0)) {
          if (!isAbortLikeError(toursError)) {
            console.error('투어 조회 오류:', toursError)
          }
          setTourExpensesTotal(0)
          setLoadingTourExpenses(false)
          return
        }

        if (!allTours || allTours.length === 0) {
          console.log('해당 날짜의 투어가 없습니다. (정상적인 경우일 수 있음)')
          setTourExpensesTotal(0)
          setLoadingTourExpenses(false)
          return
        }

        // reservation_ids 배열에 현재 예약 ID가 포함된 투어 찾기
        const toursList = (allTours || []) as any[]
        for (const tour of toursList) {
          if (tourRosterIncludesReservation(tour.reservation_ids, reservationId)) {
            tourData = tour
            console.log('PricingSection: reservation_ids에서 투어 찾음:', tourData.id)
            break
          }
        }
      }

      if (!tourData) {
        console.log('해당 예약이 포함된 투어를 찾을 수 없습니다.')
        setTourExpensesTotal(0)
        setLoadingTourExpenses(false)
        return
      }

      // 2. 투어 지출 총합 조회 (모든 지출 소스 포함)
      const tourId = (tourData as any).id
      
      // 2-1. 투어 영수증들 (tour_expenses)
      const { data: expensesData, error: expensesError } = await supabase
        .from('tour_expenses')
        .select('amount, status')
        .eq('tour_id', tourId)
        .not('status', 'eq', 'rejected')

      if (expensesError && (expensesError.message || expensesError.code || Object.keys(expensesError).length > 0)) {
        if (!isAbortLikeError(expensesError)) {
          console.error('투어 지출 조회 오류:', expensesError)
        }
        setTourExpensesTotal(0)
        setLoadingTourExpenses(false)
        return
      }

      // 2-2. 입장권 부킹 비용 (ticket_bookings)
      const { data: ticketBookingsData, error: ticketBookingsError } = await supabase
        .from('ticket_bookings')
        .select('expense, status')
        .eq('tour_id', tourId)

      // 실제 오류인 경우에만 로그 출력 (빈 객체는 완전히 무시)
      // Supabase는 데이터가 없을 때 빈 객체를 반환할 수 있으므로, message나 code가 있는 경우에만 오류로 처리
      if (ticketBookingsError && (ticketBookingsError.message || ticketBookingsError.code)) {
        if (!isAbortLikeError(ticketBookingsError)) {
          console.error('입장권 부킹 조회 오류:', ticketBookingsError)
        }
        // 오류가 있어도 계속 진행
      }
      // 빈 객체 {}는 무시 (로그 출력 안 함)

      // 2-3. 호텔 부킹 비용 (tour_hotel_bookings.total_price 합, 정산과 동일)
      const { data: hotelBookingsData, error: hotelBookingsError } = await supabase
        .from('tour_hotel_bookings')
        .select('total_price, unit_price, rooms, status')
        .eq('tour_id', tourId)

      // 실제 오류인 경우에만 로그 출력 (빈 객체는 완전히 무시)
      // Supabase는 데이터가 없을 때 빈 객체를 반환할 수 있으므로, message나 code가 있는 경우에만 오류로 처리
      if (hotelBookingsError && (hotelBookingsError.message || hotelBookingsError.code)) {
        if (!isAbortLikeError(hotelBookingsError)) {
          console.error('호텔 부킹 조회 오류:', hotelBookingsError)
        }
        // 오류가 있어도 계속 진행
      }
      // 빈 객체 {}는 무시 (로그 출력 안 함)

      // 3. 투어 총 지출 계산 (모든 소스 합산)
      const tourExpenses = (expensesData || []).reduce((sum: number, expense: any) => sum + (expense?.amount || 0), 0)
      const ticketBookingsCosts = (ticketBookingsData || [])
        .filter((b: any) => isTicketBookingIncludedInSettlement(b.status))
        .reduce((sum: number, booking: any) => sum + ticketExpenseForSettlement(booking), 0)
      const hotelBookingsCosts = (hotelBookingsData || [])
        .filter((b: any) => isHotelBookingIncludedInSettlement(b.status))
        .reduce((sum: number, booking: any) => sum + hotelAmountForSettlement(booking), 0)
      
      // 2-4. 가이드비 및 드라이버 비 (tourData에서 가져온 값 사용)
      const guideFee = (tourData as any).guide_fee || 0
      const assistantFee = (tourData as any).assistant_fee || 0
      
      const totalTourExpenses = tourExpenses + ticketBookingsCosts + hotelBookingsCosts + guideFee + assistantFee

      console.log('PricingSection: 투어 지출 상세', {
        tourExpenses,
        ticketBookingsCosts,
        hotelBookingsCosts,
        guideFee,
        assistantFee,
        totalTourExpenses
      })

      // 4. 투어의 총 인원수 계산 (reservation_ids의 예약들의 total_people 합산)
      let totalTourPeople = 0
      const reservationIds = normalizeTourRosterIds((tourData as { reservation_ids?: unknown }).reservation_ids)
      if (reservationIds.length > 0) {
        const { data: reservationsData, error: reservationsError } = await supabase
          .from('reservations')
          .select('total_people')
          .in('id', reservationIds)

        if (reservationsError && (reservationsError.message || reservationsError.code || Object.keys(reservationsError).length > 0)) {
          if (!isAbortLikeError(reservationsError)) {
            console.error('예약 인원수 조회 오류:', reservationsError)
          }
          // 오류가 있어도 계속 진행 (인원수는 0으로 처리)
        } else if (reservationsData) {
          totalTourPeople = (reservationsData || []).reduce((sum: number, r: any) => sum + (r?.total_people || 0), 0)
        }
      }

      // 5. 해당 예약건의 인원수
      const reservationPeople = formData.adults + formData.child + formData.infant

      // 6. 투어 지출 총합 = (투어 총 지출 / 투어 총 인원수) * 해당 예약건의 인원수
      const tourExpensesForReservation = totalTourPeople > 0 
        ? (totalTourExpenses / totalTourPeople) * reservationPeople
        : 0

      console.log('PricingSection: 투어 지출 계산 결과', {
        totalTourExpenses,
        totalTourPeople,
        reservationPeople,
        tourExpensesForReservation
      })

      setTourExpenseAllocationEligible(true)
      setTourExpensesTotal(tourExpensesForReservation)
    } catch (error) {
      if (isAbortLikeError(error)) {
        return
      }
      console.error('투어 지출 조회 중 예외 발생:', error)
      setTourExpensesTotal(0)
      setTourExpenseAllocationEligible(false)
    } finally {
      setLoadingTourExpenses(false)
    }
  }, [reservationId, formData.productId, formData.tourDate, formData.adults, formData.child, formData.infant, products])

  // 예약 지출 총합 조회
  useEffect(() => {
    fetchReservationExpenses()
  }, [reservationId, fetchReservationExpenses])

  // 투어 지출 총합 조회 (Mania Tour 또는 Mania Service인 경우)
  useEffect(() => {
    fetchTourExpenses()
  }, [reservationId, formData.productId, formData.tourDate, formData.adults, formData.child, formData.infant, fetchTourExpenses])

  // 예약 지출 업데이트 감지
  useEffect(() => {
    if (expenseUpdateTrigger && expenseUpdateTrigger > 0) {
      // 약간의 지연을 두고 지출 정보를 다시 조회
      const timer = setTimeout(() => {
        fetchReservationExpenses()
      }, 1000)
      
      return () => clearTimeout(timer)
    }
    return undefined
  }, [expenseUpdateTrigger, fetchReservationExpenses])

  /** 상품·옵션·불포함·부가비용 기준 총액(Returned 차감 전) */
  const calculateTotalCustomerPaymentGross = useCallback(() => {
    const cancelled =
      (formData as { status?: string }).status != null &&
      ['cancelled', 'canceled'].includes(String((formData as { status?: string }).status).toLowerCase().trim())
    const discountedProductPrice = formData.productPriceTotal - formData.couponDiscount - formData.additionalDiscount
    /** 예약 옵션은 취소 후에도 ① 고객 결제 흐름·총액에 포함(③·④·예약 옵션 패널과 정합) */
    const optionsTotal = Math.max(0, Number(reservationOptionsTotalPrice) || 0)
    const notIncludedPrice = cancelled ? 0 : notIncludedBreakdown.totalUsd
    const additionalCost = formData.additionalCost || 0
    const tax = formData.tax || 0
    const cardFee = formData.cardFee || 0
    const prepaymentCost = formData.prepaymentCost || 0
    const prepaymentTip = formData.prepaymentTip || 0
    const manualRefundAmount = Math.max(0, Number(formData.refundAmount) || 0)
    // 초이스 판매 총액(choiceTotal/choicesTotal)은 불포함 금액과 이중 계산되므로 합산하지 않음
    return Math.max(
      0,
      discountedProductPrice + optionsTotal + notIncludedPrice + additionalCost + tax + cardFee + prepaymentCost + prepaymentTip - manualRefundAmount
    )
  }, [
    formData.productPriceTotal,
    formData.couponDiscount,
    formData.additionalDiscount,
    formData.not_included_price,
    formData.pricingAdults,
    formData.child,
    formData.infant,
    formData.additionalCost,
    formData.tax,
    formData.cardFee,
    formData.prepaymentCost,
    formData.prepaymentTip,
    formData.refundAmount,
    reservationOptionsTotalPrice,
    notIncludedBreakdown.totalUsd,
    (formData as { status?: string }).status,
  ])

  // 고객 총 결제금액: Returned(파트너 환불) 중 투어 환불 입력과 겹치는 액수는 이미 gross에 반영되어 있으므로 한 번만 차감
  const calculateTotalCustomerPayment = useCallback(() => {
    const gross = calculateTotalCustomerPaymentGross()
    const ret = Math.max(0, Number(returnedAmount) || 0)
    const manualTourRefund = Math.max(0, Number(formData.refundAmount) || 0)
    const returnedSurplus = Math.max(0, roundUsd2(ret - manualTourRefund))
    return Math.max(0, roundUsd2(gross - returnedSurplus))
  }, [calculateTotalCustomerPaymentGross, returnedAmount, formData.refundAmount])

  /** 취소 건: DB/폼 `totalPrice`(total_price)를 고객 총 결제 표시·잔액에 사용 — 전액 환불 후 0 반영 */
  const effectiveTotalCustomerPayment = useCallback((): number => {
    const s = (formData as { status?: string }).status
    if (s != null && ['cancelled', 'canceled'].includes(String(s).toLowerCase().trim())) {
      return roundUsd2(Math.max(0, Number(formData.totalPrice) || 0))
    }
    return calculateTotalCustomerPayment()
  }, [(formData as { status?: string }).status, formData.totalPrice, calculateTotalCustomerPayment])

  calculateTotalCustomerPaymentGrossRef.current = calculateTotalCustomerPaymentGross
  calculateTotalCustomerPaymentRef.current = calculateTotalCustomerPayment

  /**
   * 보증금이 파트너 수령 총액처럼 총 결제 예정보다 클 때, 그 초과분이 입금 Returned와 맞으면
   * 잔액 계산용 보증금에서 Returned만큼 빼 파트너 순입금(투어 환불 반영)으로 맞춤.
   */
  const depositAmountNetOfPartnerReturnedOverlap = useCallback(
    (totalDue: number, deposit: number) => {
      const ret = Math.max(0, Number(returnedAmount) || 0)
      const dep = Math.max(0, Number(deposit) || 0)
      const due = Math.max(0, Number(totalDue) || 0)
      const excessDepositOverDue = Math.max(0, roundUsd2(dep - due))
      const overlap = Math.min(ret, excessDepositOverDue)
      return Math.max(0, roundUsd2(dep - overlap))
    },
    [returnedAmount]
  )

  /** 표시·포커스: DB/OTA가 0으로 남아 있어도 계산 잔액이 크면 계산값을 보여 줌 */
  const displayedOnSiteBalance = useCallback(() => {
    const cancelled =
      (formData as { status?: string }).status != null &&
      ['cancelled', 'canceled'].includes(String((formData as { status?: string }).status).toLowerCase().trim())
    if (cancelled) return 0
    const totalCustomerPayment = effectiveTotalCustomerPayment()
    const manualRef = Math.max(0, Number(formData.refundAmount) || 0)
    const depositForDue = depositAmountNetOfPartnerReturnedOverlap(
      totalCustomerPayment,
      formData.depositAmount
    )
    const totalPaid = computeEffectiveCustomerPaidTowardDue(
      totalCustomerPayment,
      depositForDue,
      calculatedBalanceReceivedTotal,
      refundedAmount,
      manualRef
    )
    const defaultBalance = roundUsd2(totalCustomerPayment - totalPaid)
    const stored = formData.onSiteBalanceAmount
    if (stored === undefined || stored === null) return defaultBalance
    if (pricingFieldsFromDb.onSiteBalanceAmount) {
      return roundUsd2(Number(stored))
    }
    if (stored === 0 && defaultBalance > 0.01) return defaultBalance
    return roundUsd2(Number(stored))
  }, [
    effectiveTotalCustomerPayment,
    returnedAmount,
    refundedAmount,
    formData.refundAmount,
    formData.depositAmount,
    formData.onSiteBalanceAmount,
    calculatedBalanceReceivedTotal,
    depositAmountNetOfPartnerReturnedOverlap,
    (formData as { status?: string }).status,
    formData.totalPrice,
    pricingFieldsFromDb.onSiteBalanceAmount,
  ])

  // 입금 내역 조회 및 자동 계산 (formData는 formDataRef로만 참조해 의존성 루프 방지)
  const fetchPaymentRecords = useCallback(async () => {
    if (!reservationId) {
      console.log('PricingSection: reservationId가 없어서 입금 내역 조회를 건너뜁니다.')
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        console.warn('PricingSection: 세션이 없어서 입금 내역 조회를 건너뜁니다.')
        return
      }

      const response = await fetch(`/api/payment-records?reservation_id=${reservationId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        console.warn('PricingSection: 입금 내역 조회 실패')
        return
      }

      const data = await response.json()
      const paymentRecords = data.paymentRecords || []

      // 이 예약에 대한 입금 내역 유무 표시 (자동 업데이트 effect가 보증금을 덮어쓰지 않도록)
      hasPaymentRecordsRef.current = paymentRecords.length > 0

      const normalized = paymentRecords.map((record: { payment_status: string; amount: number }) => ({
        payment_status: record.payment_status || '',
        amount: Number(record.amount) || 0,
      }))
      const {
        depositTotalNet,
        depositBucketGross: depositTotal,
        balanceReceivedTotal,
        returnedTotal,
        refundedTotal,
        partnerReceivedStrict,
      } = summarizePaymentRecordsForBalance(normalized)

      if (process.env.NODE_ENV === 'development') {
        console.log('PricingSection: 입금 내역 계산 결과', {
          depositTotal,
          depositTotalNet,
          partnerReceivedStrict,
          balanceReceivedTotal,
          refundedTotal,
          returnedTotal,
          paymentRecordsCount: paymentRecords.length
        })
      }

      // 계산 결과를 state에 저장 (총 결제 예정 금액 저장 시 사용하도록 formData에도 동기화)
      setCalculatedBalanceReceivedTotal(balanceReceivedTotal)
      setRefundedAmount(refundedTotal)
      setReturnedAmount(returnedTotal)
      setPartnerReceivedForSettlement(partnerReceivedStrict)

      // depositAmount와 balanceReceivedTotal을 기반으로 잔액 계산 (Returned 반영 순액 = gross − 이번 조회 returnedTotal)
      const grossDue = calculateTotalCustomerPaymentGrossRef.current()
      const totalCustomerPayment = Math.max(0, roundUsd2(grossDue - returnedTotal))
      const totalPaid = depositTotalNet + balanceReceivedTotal
      const remainingBalance = roundUsd2(totalCustomerPayment - totalPaid)

      const fd = formDataRef.current

      // 입금 내역이 있을 때만 보증금·잔액을 입금 합계 기준으로 덮어씀.
      // 입금 내역이 없으면 DB/사용자가 입력한 보증금·잔액을 유지 (할인가로 덮어쓰면 저장값이 사라지는 버그 방지)
      const discountedPrice = fd.productPriceTotal - fd.couponDiscount - fd.additionalDiscount
      const notIncludedPrice = splitNotIncludedForDisplay(
        (fd as any).choiceNotIncludedTotal ?? 0,
        (fd as any).choiceNotIncludedBaseTotal ?? 0,
        fd.not_included_price || 0,
        fd.pricingAdults,
        fd.child,
        fd.infant,
        (fd as any).residentStatusAmounts
      ).totalUsd
      const discountedPriceWithoutNotIncluded = discountedPrice - notIncludedPrice
      /** 보증금(표시·deposit_amount): 입금 보증 버킷 합(파트너 수령·보증금 수령 등). Refunded·Returned는 하위 라인·잔액은 depositTotalNet 기준. */
      const depositToSave =
        depositTotal > 0
          ? depositTotal
          : discountedPriceWithoutNotIncluded > 0
            ? discountedPriceWithoutNotIncluded
            : 0

      if (paymentRecords.length > 0) {
        // 입금 반영은 폼 상태만 갱신. reservation_pricing 저장은 사용자가「가격 정보 저장」또는 전체 예약 저장 시에만 수행.
        // OTA도 동일: 잔액은 입금 순효과(depositTotalNet)·Refunded 반영 후 맞추지 않으면 DB 잔액이 남아 −잔액으로 보임.
        setFormData((prev: typeof formData) => ({
          ...prev,
          balanceReceivedTotal,
          depositAmount: depositToSave,
          onSiteBalanceAmount: remainingBalance,
          balanceAmount: remainingBalance,
        }))
      } else {
        setFormData((prev: typeof formData) => ({
          ...prev,
          balanceReceivedTotal
        }))
      }
    } catch (error) {
      if (isAbortLikeError(error)) return
      console.error('PricingSection: 입금 내역 조회 중 오류', error)
    }
  }, [reservationId, setFormData])

  // 입금 내역 조회 (reservationId가 변경될 때)
  useEffect(() => {
    if (reservationId) {
      fetchPaymentRecords()
    }
  }, [reservationId, fetchPaymentRecords])

  // 입금 내역 업데이트 감지 (expenseUpdateTrigger와 동일한 방식)
  useEffect(() => {
    if (expenseUpdateTrigger && expenseUpdateTrigger > 0) {
      const timer = setTimeout(() => {
        fetchPaymentRecords()
      }, 1000)
      
      return () => clearTimeout(timer)
    }
    return undefined
  }, [expenseUpdateTrigger, fetchPaymentRecords])

  // 입금 내역이 있으면 보증금은 입금 내역 합으로 유지 (자동 업데이트 effect가 덮어쓰지 않도록)
  const hasPaymentRecordsRef = useRef(false)
  useEffect(() => {
    if (isExistingPricingLoaded) {
      depositAmountUserEditedRef.current = false
    }
  }, [isExistingPricingLoaded])

  useEffect(() => {
    if (isExistingPricingLoaded) {
      prevDepositAutoChannelIdRef.current = formData.channelId
      return
    }
    if (prevDepositAutoChannelIdRef.current !== formData.channelId) {
      depositAmountUserEditedRef.current = false
      prevDepositAutoChannelIdRef.current = formData.channelId
    }
  }, [formData.channelId, isExistingPricingLoaded])

  // 잔액 자동 계산 (= 총 결제 예정 금액 − 고객 실제 지불 추정치: 보증금·입금 환불·가격 환불과 잔금 수령 조합 반영)
  type BalanceDeps = {
    totalCustomerPayment: number
    depositAmount: number
    calculatedBalanceReceivedTotal: number
    refundedFromRecords: number
    manualRefundPricing: number
    notIncludedPrice: number
    pricingAdults: number
    child: number
    infant: number
  }
  const prevBalanceDepsRef = useRef<BalanceDeps | null>(null)

  useEffect(() => {
    if (productSalePriceFocusDepthRef.current > 0) {
      return
    }
    const totalCustomerPayment = effectiveTotalCustomerPayment()
    const manualRef = Math.max(0, Number(formData.refundAmount) || 0)
    const depositForDue = depositAmountNetOfPartnerReturnedOverlap(
      totalCustomerPayment,
      formData.depositAmount
    )
    const totalPaid = computeEffectiveCustomerPaidTowardDue(
      totalCustomerPayment,
      depositForDue,
      calculatedBalanceReceivedTotal,
      refundedAmount,
      manualRef
    )
    const calculatedBalance = roundUsd2(totalCustomerPayment - totalPaid)

    const notIncludedPrice = notIncludedBreakdown.totalUsd

    const currentDeps: BalanceDeps = {
      totalCustomerPayment: roundUsd2(totalCustomerPayment),
      depositAmount: formData.depositAmount,
      calculatedBalanceReceivedTotal,
      refundedFromRecords: refundedAmount,
      manualRefundPricing: manualRef,
      notIncludedPrice,
      pricingAdults: formData.pricingAdults,
      child: formData.child,
      infant: formData.infant,
    }

    const prev = prevBalanceDepsRef.current
    const depsChanged =
      prev == null ||
      Math.abs(prev.totalCustomerPayment - currentDeps.totalCustomerPayment) > 0.01 ||
      prev.depositAmount !== currentDeps.depositAmount ||
      prev.calculatedBalanceReceivedTotal !== currentDeps.calculatedBalanceReceivedTotal ||
      Math.abs(prev.refundedFromRecords - currentDeps.refundedFromRecords) > 0.01 ||
      Math.abs(prev.manualRefundPricing - currentDeps.manualRefundPricing) > 0.01 ||
      Math.abs(prev.notIncludedPrice - currentDeps.notIncludedPrice) > 0.01 ||
      prev.pricingAdults !== currentDeps.pricingAdults ||
      prev.child !== currentDeps.child ||
      prev.infant !== currentDeps.infant

    if (!depsChanged) return

    const stored = formData.onSiteBalanceAmount
    const currentBalance = stored ?? 0
    const balanceDifference = Math.abs(currentBalance - calculatedBalance)

    const shouldWrite =
      stored === undefined ||
      stored === null ||
      (stored === 0 &&
        calculatedBalance > 0.01 &&
        pricingFieldsFromDb.onSiteBalanceAmount !== true) ||
      balanceDifference > 0.01

    const manualRefundAmount = Math.max(0, Number(formData.refundAmount) || 0)
    const preserveExistingPositiveBalance = calculatedBalance === 0 && currentBalance > 0.01 && manualRefundAmount <= 0

    if (shouldWrite && !preserveExistingPositiveBalance) {
      setFormData((prevForm: typeof formData) => ({
        ...prevForm,
        onSiteBalanceAmount: calculatedBalance,
        balanceAmount: calculatedBalance,
      }))
    }
    prevBalanceDepsRef.current = currentDeps
  }, [
    effectiveTotalCustomerPayment,
    returnedAmount,
    refundedAmount,
    formData.depositAmount,
    calculatedBalanceReceivedTotal,
    formData.not_included_price,
    formData.pricingAdults,
    formData.child,
    formData.infant,
    formData.refundAmount,
    formData.totalPrice,
    (formData as { status?: string }).status,
    notIncludedBreakdown.totalUsd,
    setFormData,
    productSalePriceCommitTick,
    depositAmountNetOfPartnerReturnedOverlap,
    pricingFieldsFromDb.onSiteBalanceAmount,
  ])

  // depositAmount를 할인 후 상품가격으로 자동 업데이트 (상품 가격이나 쿠폰 변경 시)
  // OTA 채널의 경우 OTA 판매가를 depositAmount로 설정하고, 채널 결제 금액과 수수료도 함께 업데이트
  useEffect(() => {
    if (productSalePriceFocusDepthRef.current > 0) {
      return
    }
    // OTA 채널 여부 확인
    const selectedChannel = channels.find((c: { id: string }) => c.id === formData.channelId)
    const isOTAChannel = channelIsOtaForPricingSection(selectedChannel)
    
    // 채널의 commission_percent 가져오기 (숫자로 변환)
    const channelCommissionPercent = selectedChannel
      ? (Number((selectedChannel as any).commission_percent ?? (selectedChannel as any).commission_rate ?? (selectedChannel as any).commission) || 0)
      : 0
    
    if (formData.productPriceTotal > 0) {
      // 할인 후 상품가 계산 (불포함 가격 제외) = 채널 결제 금액 기준
      const discountedPrice = formData.productPriceTotal - formData.couponDiscount - formData.additionalDiscount
      
      if (discountedPrice > 0) {
        const currentDeposit = formData.depositAmount || 0
        const priceDifference = Math.abs(currentDeposit - discountedPrice)
        
        // OTA 채널: depositAmount = 고객 총 결제(불포함 제외)·잔액 반영 가능. 채널 결제 금액(③)=할인 후 상품가 기준 자동 설정.
        // 단, 입금 내역이 있거나 DB에서 불러온 deposit_amount가 있으면 고객 실제 지불액(보증금)을 덮어쓰지 않음
        if (isOTAChannel) {
          const reservationCancelled =
            formData.status != null &&
            ['cancelled', 'canceled'].includes(String(formData.status).toLowerCase().trim())
          /** 입금·상품가 effect가 채널 결제 입력을 덮어쓰지 않음 (수동 입력·취소 후 부분 정산·DB 저장값·채널 정산 수동) */
          const skipOtaChannelPaymentAuto =
            reservationCancelled ||
            otaChannelPaymentUserEditedRef.current ||
            channelSettlementUserEditedRef.current ||
            channelPaymentLoadedFromDb ||
            channelPaymentAmountFieldFocusedRef.current ||
            channelPaymentPricingTouched

          const resolveNextOtaCommissionAmount = (
            commissionCalcBase: number,
            pct: number,
            calculatedComm: number
          ): number => {
            const fp = otaCommissionFeeFingerprint(commissionCalcBase, pct)
            const refEmpty = otaCommissionAutoFingerprintRef.current === ''
            const currentStored = formData.commission_amount ?? 0
            if (refEmpty && isExistingPricingLoaded) {
              otaCommissionAutoFingerprintRef.current = fp
              isCardFeeManuallyEdited.current = false
              return currentStored
            }
            if (fp !== otaCommissionAutoFingerprintRef.current) {
              otaCommissionAutoFingerprintRef.current = fp
              isCardFeeManuallyEdited.current = false
              return calculatedComm
            }
            if (isCardFeeManuallyEdited.current) {
              return currentStored
            }
            if (isExistingPricingLoaded) {
              return currentStored
            }
            return calculatedComm
          }

          const totalCustomerPayment = effectiveTotalCustomerPayment()
          /** 채널 결제 금액(③) = 할인 후 상품가 (추가 할인·쿠폰 모두 반영) */
          const salePriceTimesPax = Math.max(0, discountedPrice)
          /** 불포함(현장/추가 결제) 금액이 있으면 고객 총 결제 = 판매·옵션 등 + 불포함. 보증금(실제 지불액)은 불포함을 제외한 금액, 잔액(투어 당일) = 불포함 합. */
          const notIncludedTotal = notIncludedBreakdown.totalUsd
          const depositPortion =
            notIncludedTotal > 0
              ? Math.max(0, totalCustomerPayment - notIncludedTotal)
              : totalCustomerPayment
          const depositFromDb = isExistingPricingLoaded && (formData.depositAmount ?? 0) > 0 && Math.abs((formData.depositAmount ?? 0) - depositPortion) > 0.01
          if (hasPaymentRecordsRef.current || depositFromDb) {
            // 입금 내역 합 또는 DB 저장값 유지; depositAmount는 건드리지 않음. 채널 결제 금액만 판매가×인원으로 설정 가능
            const manualRef = Math.max(0, Number(formData.refundAmount) || 0)
            const ret = Math.max(0, Number(returnedAmount) || 0)
            const channelPaymentBase = Math.max(0, roundUsd2(salePriceTimesPax - Math.max(manualRef, ret)))
            const commissionPercent = (formData.commission_percent != null && formData.commission_percent > 0)
              ? Number(formData.commission_percent)
              : channelCommissionPercent
            const calculatedCommission = (commissionPercent > 0 && channelPaymentBase > 0)
              ? Math.round(channelPaymentBase * (commissionPercent / 100) * 100) / 100
              : (formData.commission_amount ?? 0)
            const nextCommissionAmount = resolveNextOtaCommissionAmount(
              channelPaymentBase,
              commissionPercent,
              calculatedCommission
            )
            const sameOnline = Math.abs((formData.onlinePaymentAmount ?? 0) - salePriceTimesPax) < 0.01
            if (!sameOnline && !skipOtaChannelPaymentAuto) {
              setFormData((prev: typeof formData) => ({
                ...prev,
                onlinePaymentAmount: salePriceTimesPax,
                commission_base_price: channelPaymentBase,
                commission_amount: nextCommissionAmount,
              }))
            }
          } else if (!depositAmountUserEditedRef.current && (currentDeposit === 0 || priceDifference > 0.01)) {
            const manualRef = Math.max(0, Number(formData.refundAmount) || 0)
            const ret = Math.max(0, Number(returnedAmount) || 0)
            const channelPaymentBase = Math.max(0, roundUsd2(salePriceTimesPax - Math.max(manualRef, ret)))
            const commissionPercent = (formData.commission_percent != null && formData.commission_percent > 0)
              ? Number(formData.commission_percent)
              : channelCommissionPercent
            const calculatedCommission = (commissionPercent > 0 && channelPaymentBase > 0)
              ? Math.round(channelPaymentBase * (commissionPercent / 100) * 100) / 100
              : (formData.commission_amount ?? 0)
            const nextCommissionAmount = resolveNextOtaCommissionAmount(
              channelPaymentBase,
              commissionPercent,
              calculatedCommission
            )
            const commissionToSet = nextCommissionAmount
            const otaRemainingBalance = roundUsd2(totalCustomerPayment - depositPortion - calculatedBalanceReceivedTotal)
            const same =
              Math.abs((formData.depositAmount ?? 0) - depositPortion) < 0.01 &&
              Math.abs((formData.onlinePaymentAmount ?? 0) - salePriceTimesPax) < 0.01 &&
              Math.abs((formData.commission_amount ?? 0) - commissionToSet) < 0.01 &&
              Math.abs((formData.onSiteBalanceAmount ?? 0) - otaRemainingBalance) < 0.01
            if (!same && !skipOtaChannelPaymentAuto) {
              setFormData((prev: typeof formData) => ({
                ...prev,
                depositAmount: depositPortion,
                onlinePaymentAmount: salePriceTimesPax,
                commission_base_price: channelPaymentBase,
                commission_percent: (prev.commission_percent != null && prev.commission_percent > 0) ? prev.commission_percent : commissionPercent,
                commission_amount: nextCommissionAmount,
                onSiteBalanceAmount: otaRemainingBalance,
                balanceAmount: otaRemainingBalance
              }))
            }
          }
        } else {
          // 일반 채널: 입금 내역이 있거나 이미 보증금이 있으면 depositAmount 업데이트하지 않음
          if (hasPaymentRecordsRef.current || formData.depositAmount > 0) {
            return
          }
          
          if (depositAmountUserEditedRef.current) {
            return
          }

          // depositAmount가 0이거나, 현재 값이 할인 후 상품가와 차이가 0.01 이상이면 업데이트
          if (currentDeposit === 0 || priceDifference > 0.01) {
            // 잔액도 함께 계산하여 업데이트
            const totalCustomerPayment = effectiveTotalCustomerPayment()
            const totalPaid = discountedPrice + calculatedBalanceReceivedTotal
            const calculatedBalance = roundUsd2(totalCustomerPayment - totalPaid)
            const existingBalance = formData.onSiteBalanceAmount ?? 0
            const manualRefundAmount = Math.max(0, Number(formData.refundAmount) || 0)
            const balanceToUse =
              calculatedBalance === 0 && existingBalance > 0 && manualRefundAmount <= 0
                ? existingBalance
                : calculatedBalance
            // 무한 루프 방지: 설정할 값이 이미 현재와 같으면 setFormData 호출하지 않음
            const sameDeposit = Math.abs((formData.depositAmount ?? 0) - discountedPrice) < 0.01
            const sameBalance = Math.abs((formData.onSiteBalanceAmount ?? 0) - balanceToUse) < 0.01
            if (!sameDeposit || !sameBalance) {
              setFormData((prev: typeof formData) => ({
                ...prev,
                depositAmount: discountedPrice,
                onSiteBalanceAmount: balanceToUse,
                balanceAmount: balanceToUse
              }))
            }
          }
        }
      }
    }
  }, [formData.productPriceTotal, formData.couponDiscount, formData.additionalDiscount, formData.depositAmount, formData.channelId, formData.status, formData.not_included_price, formData.pricingAdults, formData.child, formData.infant, formData.commission_amount, formData.commission_percent, formData.refundAmount, formData.totalPrice, channels, returnedAmount, effectiveTotalCustomerPayment, calculatedBalanceReceivedTotal, isExistingPricingLoaded, channelPaymentLoadedFromDb, channelPaymentPricingTouched, setFormData, notIncludedBreakdown.totalUsd, productSalePriceCommitTick])

  // 선택된 채널 정보 가져오기
  const selectedChannel = channels?.find(ch => ch.id === formData.channelId)
  const isOTAChannel = channelIsOtaForPricingSection(selectedChannel)
  // Homepage 채널 (채널 type이 ota가 아닐 때 쿠폰 선택에 함께 사용). id M00001 또는 이름에 Homepage/홈페이지 포함
  const homepageChannel = Array.isArray(channels) ? channels.find(ch =>
    ch.id === 'M00001' ||
    (ch.name && (String(ch.name).toLowerCase().includes('homepage') || String(ch.name).includes('홈페이지')))
  ) : null
  const homepageChannelId = homepageChannel?.id ?? null
  const isHomepageBooking = isHomepageBookingChannel(formData.channelId, channels)

  const hasDbReservationPricingRow = Boolean(reservationPricingId)

  /** 채널·홈페이지 쿠폰 규칙으로 목록 구성 + 현재 선택 코드는 항상 포함(DB에만 있는 코드는 맨 위 placeholder) */
  const couponsForSelectOptions = useMemo(() => {
    const chName = (id: string | null | undefined) => {
      if (!id || !Array.isArray(channels)) return ''
      const row = channels.find((c) => c.id === id)
      return String(row?.name || '').toLowerCase()
    }
    const selectedName = chName(formData.channelId)
    const isGetYourGuideFamily = (n: string) =>
      n.includes('getyourguide') || n.includes('get your guide')
    const showAllGyCoupons = isGetYourGuideFamily(selectedName)

    const filtered = coupons.filter((coupon) => {
      const isCurrentCoupon =
        formData.couponCode &&
        coupon.coupon_code &&
        String(coupon.coupon_code).trim().toLowerCase() === String(formData.couponCode).trim().toLowerCase()
      if (isCurrentCoupon) return true
      if (
        showAllGyCoupons &&
        coupon.channel_id &&
        isGetYourGuideFamily(chName(coupon.channel_id))
      ) {
        return true
      }
      return (
        !formData.channelId ||
        !coupon.channel_id ||
        coupon.channel_id === formData.channelId ||
        (!isOTAChannel && homepageChannelId && coupon.channel_id === homepageChannelId)
      )
    })
    const code = String(formData.couponCode || '').trim()
    if (!code) return filtered
    const already = filtered.some(
      (c) => c.coupon_code && String(c.coupon_code).trim().toLowerCase() === code.toLowerCase()
    )
    if (already) return filtered
    return [
      {
        id: '__saved_coupon_not_in_master__',
        coupon_code: code,
        discount_type: 'fixed' as const,
        percentage_value: null as number | null,
        fixed_value: null as number | null,
        channel_id: null as string | null,
      },
      ...filtered,
    ]
  }, [channels, coupons, formData.couponCode, formData.channelId, isOTAChannel, homepageChannelId])

  // 채널의 commission_percent 가져오기 (여러 필드명 지원)
  // channels 테이블에는 commission 컬럼이 있음 (commission_percent는 없을 수 있음)
  const channelCommissionPercent = selectedChannel
    ? (() => {
        const percent = selectedChannel.commission_percent ?? selectedChannel.commission_rate ?? selectedChannel.commission
        return percent ? Number(percent) : 0
      })()
    : 0

  const reservationStatusRaw = (formData as { status?: string }).status
  const isReservationCancelled =
    reservationStatusRaw != null &&
    ['cancelled', 'canceled'].includes(String(reservationStatusRaw).toLowerCase().trim())
  /** 취소 후에도 OTA 부분 정산 시 `commission_amount` 그대로 반영 (미입력이면 0) */
  const effectiveCommissionAmount = Number(formData.commission_amount) || 0
  const manualRefundAmount = Math.max(0, Number(formData.refundAmount) || 0)
  /** 투어 환불과 동일 건으로 입금 Returned에 잡힌 금액(미지급·중복 표시 방지) */
  const tourRefundCreditedByPartnerReturn = Math.min(
    manualRefundAmount,
    Math.max(0, Number(returnedAmount) || 0)
  )
  /** Returned가 투어 환불 입력보다 큰 부분만 고객 총액·③ 채널 결제 넷에 추가 차감 */
  const returnedSurplusOverManualTourRefund = Math.max(
    0,
    roundUsd2(Math.max(0, Number(returnedAmount) || 0) - manualRefundAmount)
  )
  /** 예약 옵션 취소·환불 줄 합(투어 환불 입력칸과 별도로 합산해 「입력」 총액 표시) */
  const optionCancelRefundUsd = Math.max(0, Number(reservationOptionCancelledRefundTotal) || 0)
  /** 투어(및 상품) 환불 입력 + 옵션 취소 환불 합 — 입금 Refunded와 대조 */
  const totalRefundInputEntered = roundUsd2(manualRefundAmount + optionCancelRefundUsd)
  /** 입력 총액 − Refunded − 파트너 Returned로 상쇄된 투어 환불 */
  const unpaidRefundOutstanding = Math.max(
    0,
    roundUsd2(totalRefundInputEntered - refundedAmount - tourRefundCreditedByPartnerReturn)
  )

  /** ④ 환불 카드 — 입력 합·Returned·Refunded를 title 툴팁으로만 노출 */
  const companyViewRefundHoverTooltip = useMemo(() => {
    const retShown = roundUsd2(Math.max(0, Number(returnedAmount) || 0))
    const lines: string[] = []
    if (isKorean) {
      lines.push(`환불 입력 합계: $${totalRefundInputEntered.toFixed(2)}`)
      if (retShown > 0.005) {
        lines.push(`파트너 환불 조치 (Returned): $${retShown.toFixed(2)}`)
      }
      lines.push(`실제 입금 (Refunded): $${refundedAmount.toFixed(2)}`)
    } else {
      lines.push(`Refund entered (sum): $${totalRefundInputEntered.toFixed(2)}`)
      if (retShown > 0.005) {
        lines.push(`Partner refund (Returned): $${retShown.toFixed(2)}`)
      }
      lines.push(`Deposited (Refunded): $${refundedAmount.toFixed(2)}`)
    }
    return lines.join('\n')
  }, [isKorean, totalRefundInputEntered, returnedAmount, refundedAmount])

  /**
   * ④ 총 매출·운영 이익에서 차감할 입금 환불(Refunded) 상당액.
   * 예약 옵션 금액이 ④에 +되지 않은 경우(취소 등): Refunded 중 옵션취소 입력분은 채널 정산과 무관한 현금흐름으로 보지 않고,
   * 투어 관련 환불만 반영(max(투어 환불 입력, Refunded − 옵션취소분)).
   * OTA: 채널 정산 금액 산식에 이미 max(Returned, 투어 환불)가 들어가 있으므로,
   * 투어 환불 입력과 입금 Returned가 겹치는 금액(tourRefundCreditedByPartnerReturn)은 ④에서 재차감하지 않음.
   */
  const refundAmountForCompanyRevenueBlock = useMemo(() => {
    const ref = Math.max(0, Number(refundedAmount) || 0)
    const optRev = Math.max(0, Number(reservationOptionsTotalPrice) || 0)
    const optCancel = Math.max(0, Number(optionCancelRefundUsd) || 0)
    const man = Math.max(0, Number(manualRefundAmount) || 0)
    if (optRev > 0.005) {
      return roundUsd2(ref)
    }
    const base = roundUsd2(Math.max(man, Math.max(0, ref - optCancel)))
    if (!isOTAChannel) {
      return base
    }
    return Math.max(0, roundUsd2(base - tourRefundCreditedByPartnerReturn))
  }, [
    refundedAmount,
    reservationOptionsTotalPrice,
    optionCancelRefundUsd,
    manualRefundAmount,
    isOTAChannel,
    tourRefundCreditedByPartnerReturn,
  ])

  // 할인 후 상품가 = 상품가격 - 쿠폰할인 - 추가할인 (정산·채널 결제 UI에서 공통)
  const discountedProductPrice =
    formData.productPriceTotal - formData.couponDiscount - formData.additionalDiscount
  /** OTA·홈페이지 공통: 채널 결제(상품) 기준 = 할인 후 상품가 */
  const otaChannelProductPaymentGross = Math.max(0, discountedProductPrice)

  /**
   * 정산 산식용 gross. 폼 `onlinePaymentAmount` 우선; 없으면 DB에 net만 있을 때 `deriveCommissionGrossForSettlement`로 복원.
   * 취소·자체 채널: online이 고객 순잔액만 담기고 보증금이 실제 캡처액이면 gross는 보증금 우선(③에서 max(Returned, 투어환불) 이중 차감 방지).
   */
  const channelPaymentGrossDb = useMemo(() => {
    const online = Number(formData.onlinePaymentAmount)
    const dep = Number(formData.depositAmount) || 0
    const onlineMissingOrTiny = !Number.isFinite(online) || Math.abs(online) < 0.005
    if (
      isReservationCancelled &&
      !isOTAChannel &&
      dep > 0.005 &&
      (onlineMissingOrTiny || dep > online + 0.02)
    ) {
      return dep
    }
    if (Number.isFinite(online) && online !== 0) return online
    const raw = formData.commission_base_price
    const stored =
      raw !== undefined && raw !== null && Number.isFinite(Number(raw)) ? Number(raw) : 0
    if (!stored) return Number.isFinite(online) ? online : 0
    return deriveCommissionGrossForSettlement(stored, {
      returnedAmount,
      depositAmount: Number(formData.depositAmount) || 0,
      productPriceTotal: Number(formData.productPriceTotal) || 0,
      isOTAChannel: !!isOTAChannel,
    })
  }, [
    formData.commission_base_price,
    formData.onlinePaymentAmount,
    returnedAmount,
    formData.depositAmount,
    formData.productPriceTotal,
    isOTAChannel,
    isReservationCancelled,
  ])

  /** 자체(비-OTA) 채널: `computeChannelPaymentAfterReturn` / 정산과 동일 입력(상품+불포함·옵션·추가비용·카드수수료 등). */
  const selfChannelPaymentEngineInput = useMemo((): ChannelSettlementComputeInput | null => {
    if (isOTAChannel) return null
    const pricingAdultsVal = Math.max(
      0,
      Math.floor(Number(formData.pricingAdults ?? formData.adults) || 0)
    )
    const billingPax = pricingAdultsVal + (formData.child || 0) + (formData.infant || 0)
    const cancelledOtaSettle = isReservationCancelled && !!isOTAChannel
    const notIncludedTotal =
      cancelledOtaSettle ? 0 : (Number(formData.not_included_price) || 0) * (billingPax || 1)
    const productTotalForSettlement = (Number(formData.productPriceTotal) || 0) + notIncludedTotal
    const ret = Math.max(0, Number(returnedAmount) || 0)
    const manualR = Math.max(0, Number(formData.refundAmount) || 0)
    const returnedForSettlementCompute = Math.max(ret, manualR)
    const onl = Number(formData.onlinePaymentAmount)
    const depL = Number(formData.depositAmount) || 0
    const onlineMissingOrTiny = !Number.isFinite(onl) || Math.abs(onl) < 0.005
    const onlineForEngine =
      isReservationCancelled &&
      !isOTAChannel &&
      depL > 0.005 &&
      (onlineMissingOrTiny || depL > onl + 0.02)
        ? depL
        : onl || channelPaymentGrossDb
    return {
      depositAmount: Number(formData.depositAmount) || 0,
      onlinePaymentAmount: onlineForEngine,
      productPriceTotal: productTotalForSettlement,
      couponDiscount: Number(formData.couponDiscount) || 0,
      additionalDiscount: Number(formData.additionalDiscount) || 0,
      optionTotalSum: cancelledOtaSettle ? 0 : Number(formData.optionTotal) || 0,
      additionalCost: Number(formData.additionalCost) || 0,
      tax: Number(formData.tax) || 0,
      cardFee: Number(formData.cardFee) || 0,
      prepaymentTip: Number(formData.prepaymentTip) || 0,
      onSiteBalanceAmount: Number(formData.onSiteBalanceAmount ?? formData.balanceAmount) || 0,
      returnedAmount: returnedForSettlementCompute,
      commissionAmount: Number(formData.commission_amount) || 0,
      reservationStatus: formData.status ?? null,
      isOTAChannel: false,
    }
  }, [
    isOTAChannel,
    isReservationCancelled,
    formData.pricingAdults,
    formData.adults,
    formData.child,
    formData.infant,
    formData.not_included_price,
    formData.productPriceTotal,
    formData.depositAmount,
    formData.onlinePaymentAmount,
    channelPaymentGrossDb,
    formData.couponDiscount,
    formData.additionalDiscount,
    formData.optionTotal,
    formData.additionalCost,
    formData.tax,
    formData.cardFee,
    formData.prepaymentTip,
    formData.onSiteBalanceAmount,
    formData.balanceAmount,
    returnedAmount,
    formData.refundAmount,
    formData.commission_amount,
    formData.status,
  ])

  /** 「채널 결제 금액」입력칸: OTA는 commission_base_price가 순액(할인후−max(Returned,투어환불))이므로 우선. online이 이미 순액만 담긴 경우 cg−환불 이중 차감 방지. */
  const channelPaymentAmountAfterReturn = useMemo(() => {
    const ret = Math.max(0, Number(returnedAmount) || 0)
    const manualR = Math.max(0, Number(formData.refundAmount) || 0)
    const effectiveReturnOffGross = Math.max(ret, manualR)
    const dep = Number(formData.depositAmount) || 0
    const cg = Number(channelPaymentGrossDb) || 0
    const productGross = Math.max(0, discountedProductPrice)

    const cbRaw = formData.commission_base_price
    const hasCommissionBase =
      cbRaw !== undefined && cbRaw !== null && String(cbRaw) !== '' && Number.isFinite(Number(cbRaw))
    const cb = hasCommissionBase ? Number(cbRaw) : NaN

    /**
     * OTA: 사용자가 채널 결제(net)를 직접 입력한 뒤에는 폼의 commission_base만 표시.
     * (레거시 gross 판별로 Returned를 한 번 더 빼면 블러 직후 계산값으로 튀는 현상)
     */
    if (
      isOTAChannel &&
      hasCommissionBase &&
      (otaChannelPaymentUserEditedRef.current || channelPaymentPricingTouched)
    ) {
      return Math.max(0, roundUsd2(cb))
    }

    if (selfChannelPaymentEngineInput) {
      /**
       * 비-OTA: 산식 `computeChannelPaymentAfterReturn`이 상품가·옵션·수수료 등과 어긋나면
       * 사용자가 입력한 gross(online / commission_base) 기준 net을 표시 — 블러 후 산식으로 덮임 방지.
       */
      if (
        nonOtaChannelPaymentUserEditedRef.current ||
        nonOtaChannelPaymentStopProductAutoSyncRef.current ||
        channelPaymentPricingTouched
      ) {
        const onl = Number(formData.onlinePaymentAmount)
        const hasOnline =
          formData.onlinePaymentAmount !== undefined &&
          formData.onlinePaymentAmount !== null &&
          String(formData.onlinePaymentAmount) !== '' &&
          Number.isFinite(onl)
        const grossForDisplay =
          hasOnline && Math.abs(onl) > 1e-9 ? onl : hasCommissionBase && cb > 0.005 ? cb : null
        if (grossForDisplay != null && grossForDisplay > 0.005) {
          let g = grossForDisplay
          /** 취소·자체: 폼 online이 순잔액만 있고 보증금이 실제 캡처면 gross로 보증금 사용(이중 차감·$0 방지) */
          if (
            isReservationCancelled &&
            !isOTAChannel &&
            dep > g + 0.02 &&
            effectiveReturnOffGross > 0.005
          ) {
            g = dep
          }
          return Math.max(0, roundUsd2(g - effectiveReturnOffGross))
        }
      }
      return roundUsd2(computeChannelPaymentAfterReturn(selfChannelPaymentEngineInput))
    }

    if (isOTAChannel && hasCommissionBase && cb > 0.005) {
      /**
       * DB `commission_base_price`는 원칙적으로 Returned 차감 후 순액이지만,
       * 전액 환불 후에도 예약 금액(예금·OTA 판매가·상품가 총액)과 동일한 값이 남은 레거시/미동기화 행은
       * 아직 차감 전 금액으로 남아 있는 것으로 보고 환불을 반영한다.
       * (그대로 두면 638 순액으로 오인해 표시가 ($1276−638)처럼 어긋난다.)
       */
      const grossNetEps = 0.02
      const matchesDeposit = Math.abs(cb - dep) < grossNetEps
      const matchesProduct = Math.abs(cb - productGross) < grossNetEps
      if (effectiveReturnOffGross > 0.005 && (matchesDeposit || matchesProduct)) {
        return Math.max(0, roundUsd2(cb - effectiveReturnOffGross))
      }
      return Math.max(0, roundUsd2(cb))
    }

    const expectedNetFromProduct = Math.max(0, roundUsd2(productGross - effectiveReturnOffGross))
    if (cg > 0.005 && effectiveReturnOffGross > 0.005) {
      if (Math.abs(cg - expectedNetFromProduct) < 0.02) {
        return Math.max(0, roundUsd2(cg))
      }
    }

    if (cg > 0.005) {
      return Math.max(0, roundUsd2(cg - effectiveReturnOffGross))
    }
    if (productGross > 0.005) {
      return Math.max(0, roundUsd2(productGross - effectiveReturnOffGross))
    }
    if (dep > 0.005 && effectiveReturnOffGross > 0.005) {
      return Math.max(0, roundUsd2(dep))
    }
    if (dep > 0.005) {
      return Math.max(0, roundUsd2(dep - effectiveReturnOffGross))
    }
    return 0
  }, [
    channelPaymentGrossDb,
    returnedAmount,
    formData.refundAmount,
    formData.depositAmount,
    discountedProductPrice,
    isOTAChannel,
    isReservationCancelled,
    formData.commission_base_price,
    formData.onlinePaymentAmount,
    pricingFieldsFromDb.onlinePaymentAmount,
    pricingFieldsFromDb.commission_base_price,
    selfChannelPaymentEngineInput,
  ])

  /** 폼에 `channelSettlementAmount`가 있으면 그 값(수동·DB 로드), 없으면 `computeChannelSettlementAmount`. */
  const channelSettlementBeforePartnerReturn = useMemo(() => {
    const fromForm = formData.channelSettlementAmount
    if (
      fromForm !== undefined &&
      fromForm !== null &&
      String(fromForm) !== '' &&
      Number.isFinite(Number(fromForm))
    ) {
      return roundUsd2(Number(fromForm))
    }

    const pricingAdultsVal = Math.max(
      0,
      Math.floor(Number(formData.pricingAdults ?? formData.adults) || 0)
    )
    const billingPax = pricingAdultsVal + (formData.child || 0) + (formData.infant || 0)
    const cancelledOtaSettle = isReservationCancelled && !!isOTAChannel
    const notIncludedTotal = cancelledOtaSettle
      ? 0
      : (Number(formData.not_included_price) || 0) * (billingPax || 1)
    const productTotalForSettlement = (Number(formData.productPriceTotal) || 0) + notIncludedTotal

    /** 채널 결제 넷: gross − max(입금 Returned, 투어 환불) — 동일 건 이중 차감 방지 */
    const returnedForSettlementCompute = Math.max(
      Math.max(0, Number(returnedAmount) || 0),
      manualRefundAmount
    )

    const baseSettled = computeChannelSettlementAmount({
      depositAmount: Number(formData.depositAmount) || 0,
      onlinePaymentAmount: Number(formData.onlinePaymentAmount) || channelPaymentGrossDb,
      productPriceTotal: productTotalForSettlement,
      couponDiscount: Number(formData.couponDiscount) || 0,
      additionalDiscount: Number(formData.additionalDiscount) || 0,
      optionTotalSum: cancelledOtaSettle ? 0 : Number(formData.optionTotal) || 0,
      additionalCost: Number(formData.additionalCost) || 0,
      tax: Number(formData.tax) || 0,
      cardFee: Number(formData.cardFee) || 0,
      prepaymentTip: Number(formData.prepaymentTip) || 0,
      onSiteBalanceAmount: Number(formData.onSiteBalanceAmount ?? formData.balanceAmount) || 0,
      returnedAmount: returnedForSettlementCompute,
      partnerReceivedAmount: partnerReceivedForSettlement,
      commissionAmount: Number(formData.commission_amount) || 0,
      reservationStatus: formData.status ?? null,
      isOTAChannel: !!isOTAChannel,
    })
    return baseSettled
  }, [
    formData.channelSettlementAmount,
    formData.depositAmount,
    formData.onlinePaymentAmount,
    channelPaymentGrossDb,
    formData.productPriceTotal,
    formData.not_included_price,
    formData.pricingAdults,
    formData.adults,
    formData.child,
    formData.infant,
    formData.couponDiscount,
    formData.additionalDiscount,
    formData.optionTotal,
    formData.additionalCost,
    formData.tax,
    formData.cardFee,
    formData.prepaymentTip,
    formData.onSiteBalanceAmount,
    formData.balanceAmount,
    returnedAmount,
    manualRefundAmount,
    partnerReceivedForSettlement,
    formData.commission_amount,
    formData.status,
    isOTAChannel,
    isReservationCancelled,
    channelPaymentAmountAfterReturn,
  ])

  const omitAdditionalDiscountAndCostFromRevenueSum = useMemo(
    () =>
      shouldOmitAdditionalDiscountAndCostFromCompanyRevenueSum({
        usesStoredChannelSettlement:
          formData.channelSettlementAmount !== undefined &&
          formData.channelSettlementAmount !== null &&
          String(formData.channelSettlementAmount) !== '' &&
          Number.isFinite(Number(formData.channelSettlementAmount)),
        isOTAChannel: !!isOTAChannel,
        depositAmount: Number(formData.depositAmount) || 0,
        onlinePaymentAmount: Number(formData.onlinePaymentAmount) || 0,
        channelPaymentGross: Number(channelPaymentGrossDb) || 0,
      }),
    [
      formData.channelSettlementAmount,
      isOTAChannel,
      formData.depositAmount,
      formData.onlinePaymentAmount,
      channelPaymentGrossDb,
    ]
  )

  /** ④ 최종 매출 — 한눈에 보는 가감 산식(표시 줄 + 합계 일치) */
  const companyViewRevenueLedger = useMemo(() => {
    const prepTip = Number(formData.prepaymentTip) || 0
    type LedgerLine = { sign: '+' | '-'; labelKo: string; labelEn: string; amount: number }
    const lines: LedgerLine[] = []

    if (isReservationCancelled && !isOTAChannel) {
      const ch = channelSettlementBeforePartnerReturn
      const rex = Number(reservationExpensesTotal) || 0
      lines.push({ sign: '+', labelKo: '채널 정산 금액', labelEn: 'Channel settlement', amount: ch })
      if (Math.abs(rex) > 0.005) {
        lines.push({
          sign: rex >= 0 ? '-' : '+',
          labelKo: '예약 지출 금액',
          labelEn: 'Reservation expenses',
          amount: Math.abs(rex),
        })
      }
      /** 비-OTA 취소: 투어 환불은 ③ 채널 결제·정산 net에 이미 반영 — ④에서 환불 줄로 재차감하지 않음 */
      const tr = roundUsd2(ch - rex)
      return {
        lines,
        totalRevenue: tr,
        operatingProfit: roundUsd2(tr - prepTip),
      }
    }

    if (isReservationCancelled && isOTAChannel) {
      const ch = channelSettlementBeforePartnerReturn
      const rex = Number(reservationExpensesTotal) || 0
      const refb = refundAmountForCompanyRevenueBlock
      lines.push({ sign: '+', labelKo: '채널 정산 금액', labelEn: 'Channel settlement', amount: ch })
      if (Math.abs(rex) > 0.005) {
        lines.push({
          sign: rex >= 0 ? '-' : '+',
          labelKo: '예약 지출 금액',
          labelEn: 'Reservation expenses',
          amount: Math.abs(rex),
        })
      }
      if (refb > 0.005) {
        lines.push({
          sign: '-',
          labelKo: '환불 (총매출 차감)',
          labelEn: 'Refund (deducted from revenue)',
          amount: refb,
        })
      }
      const tr = roundUsd2(ch - rex - refb)
      return {
        lines,
        totalRevenue: tr,
        operatingProfit: roundUsd2(tr - prepTip),
      }
    }

    const omitDiscCostEffective =
      omitAdditionalDiscountAndCostFromRevenueSum &&
      !(isOTAChannel && !isReservationCancelled)

    /** Self·직판: ① 고객 총 결제(넷) 기준 — ③ 채널 정산 금액은 ④에 사용하지 않음 */
    if (!isReservationCancelled && !isOTAChannel) {
      const selfBase = effectiveTotalCustomerPayment()
      let trSelf = selfBase
      const linesSelf: LedgerLine[] = [
        {
          sign: '+',
          labelKo: '고객 총 결제 금액',
          labelEn: 'Total customer payment',
          amount: selfBase,
        },
      ]

      const rexSelf = Number(reservationExpensesTotal) || 0
      if (Math.abs(rexSelf) > 0.005) {
        linesSelf.push({
          sign: rexSelf >= 0 ? '-' : '+',
          labelKo: '예약 지출 금액',
          labelEn: 'Reservation expenses',
          amount: Math.abs(rexSelf),
        })
        trSelf -= rexSelf
      }

      const refbSelf = refundAmountForCompanyRevenueBlock
      if (refbSelf > 0.005) {
        linesSelf.push({
          sign: '-',
          labelKo: '환불 (총매출 차감)',
          labelEn: 'Refund (deducted from revenue)',
          amount: refbSelf,
        })
        trSelf -= refbSelf
      }

      if (isHomepageBooking && (Number(formData.additionalCost) || 0) > 0.005) {
        const ac = Number(formData.additionalCost) || 0
        linesSelf.push({
          sign: '-',
          labelKo: '추가비용 (회사 매출 제외)',
          labelEn: 'Additional cost (excluded from revenue)',
          amount: ac,
        })
        trSelf -= ac
      }

      trSelf = roundUsd2(trSelf)
      return {
        lines: linesSelf,
        totalRevenue: trSelf,
        operatingProfit: roundUsd2(trSelf - prepTip),
      }
    }

    let tr = channelSettlementBeforePartnerReturn
    lines.push({
      sign: '+',
      labelKo: '채널 정산 금액',
      labelEn: 'Channel settlement',
      amount: channelSettlementBeforePartnerReturn,
    })

    const rex = Number(reservationExpensesTotal) || 0
    if (Math.abs(rex) > 0.005) {
      lines.push({
        sign: rex >= 0 ? '-' : '+',
        labelKo: '예약 지출 금액',
        labelEn: 'Reservation expenses',
        amount: Math.abs(rex),
      })
      tr -= rex
    }

    if (reservationOptionsTotalPrice > 0 && isOTAChannel) {
      const a = reservationOptionsTotalPrice
      lines.push({ sign: '+', labelKo: '예약 옵션', labelEn: 'Reservation options', amount: a })
      tr += a
    }

    if (!isReservationCancelled) {
      const { baseUsd, residentFeesUsd } = notIncludedBreakdown
      if (baseUsd > 0.005) {
        lines.push({ sign: '+', labelKo: '불포함 (입장권)', labelEn: 'Not included (admission)', amount: baseUsd })
        tr += baseUsd
      }
      if (residentFeesUsd > 0.005) {
        lines.push({
          sign: '+',
          labelKo: '비거주자 비용',
          labelEn: 'Non-resident fees',
          amount: residentFeesUsd,
        })
        tr += residentFeesUsd
      }
    }

    if (!omitDiscCostEffective) {
      const disc = Number(formData.additionalDiscount) || 0
      if (disc > 0.005 && !isHomepageBooking) {
        lines.push({ sign: '-', labelKo: '추가할인', labelEn: 'Additional discount', amount: disc })
        tr -= disc
      }
      const ac = Number(formData.additionalCost) || 0
      if (ac > 0.005 && !isHomepageBooking) {
        lines.push({ sign: '+', labelKo: '추가비용', labelEn: 'Additional cost', amount: ac })
        tr += ac
      }
    }

    const tax = Number(formData.tax) || 0
    if (tax > 0.005) {
      lines.push({ sign: '+', labelKo: '세금', labelEn: 'Tax', amount: tax })
      tr += tax
    }

    const ppc = Number(formData.prepaymentCost) || 0
    if (ppc > 0.005 && !isHomepageBooking) {
      lines.push({ sign: '+', labelKo: '선결제 지출', labelEn: 'Prepayment cost', amount: ppc })
      tr += ppc
    }

    const cardFeeUsd = Number(formData.cardFee) || 0
    if (isOTAChannel && !isReservationCancelled && cardFeeUsd > 0.005) {
      lines.push({
        sign: '+',
        labelKo: '카드 수수료',
        labelEn: 'Card fee',
        amount: cardFeeUsd,
      })
      tr += cardFeeUsd
    }

    if (isOTAChannel && !isReservationCancelled && prepTip > 0.005) {
      lines.push({
        sign: '+',
        labelKo: '선결제 팁',
        labelEn: 'Prepayment tip',
        amount: prepTip,
      })
      tr += prepTip
    }

    const refb = refundAmountForCompanyRevenueBlock
    if (refb > 0.005) {
      lines.push({
        sign: '-',
        labelKo: '환불 (총매출 차감)',
        labelEn: 'Refund (deducted from revenue)',
        amount: refb,
      })
      tr -= refb
    }

    if (isHomepageBooking && (Number(formData.additionalCost) || 0) > 0.005) {
      const ac = Number(formData.additionalCost) || 0
      lines.push({
        sign: '-',
        labelKo: '추가비용 (회사 매출 제외)',
        labelEn: 'Additional cost (excluded from revenue)',
        amount: ac,
      })
      tr -= ac
    }

    tr = roundUsd2(tr)
    return {
      lines,
      totalRevenue: tr,
      operatingProfit: roundUsd2(tr - prepTip),
    }
  }, [
    isReservationCancelled,
    isOTAChannel,
    isHomepageBooking,
    channelSettlementBeforePartnerReturn,
    reservationExpensesTotal,
    refundAmountForCompanyRevenueBlock,
    reservationOptionsTotalPrice,
    notIncludedBreakdown,
    omitAdditionalDiscountAndCostFromRevenueSum,
    formData.additionalDiscount,
    formData.additionalCost,
    formData.tax,
    formData.prepaymentCost,
    formData.prepaymentTip,
    formData.cardFee,
    effectiveTotalCustomerPayment,
  ])

  /** DB에 net만 있고 폼이 online≈net으로 로드된 경우 gross로 보정 (저장·산식과 동일) */
  useEffect(() => {
    if (otaChannelPaymentUserEditedRef.current) return
    if (nonOtaChannelPaymentUserEditedRef.current) return
    if (returnedAmount <= 0.005) return
    const otaOrDeposit = !!isOTAChannel || (Number(formData.depositAmount) || 0) > 0
    if (!otaOrDeposit) return
    const cb = Number(formData.commission_base_price)
    if (!Number.isFinite(cb)) return
    const dep = Number(formData.depositAmount) || 0
    const ppt = Number(formData.productPriceTotal) || 0
    const gross = deriveCommissionGrossForSettlement(cb, {
      returnedAmount,
      depositAmount: dep,
      productPriceTotal: ppt,
      isOTAChannel: !!isOTAChannel,
    })
    const curOnline = Number(formData.onlinePaymentAmount) || 0
    if (gross <= cb + 0.01) return
    if (Math.abs(curOnline - cb) > 0.02) return
    setFormData((prev: typeof formData) => {
      const pOn = Number(prev.onlinePaymentAmount) || 0
      if (Math.abs(pOn - cb) > 0.02) return prev
      if (Math.abs(pOn - gross) < 0.02) return prev
      return { ...prev, onlinePaymentAmount: gross }
    })
  }, [
    returnedAmount,
    isOTAChannel,
    formData.depositAmount,
    formData.productPriceTotal,
    formData.commission_base_price,
    setFormData,
  ])
  
  // commission_amount가 0일 때 채널 수수료 자동 계산 (값이 실제로 다를 때만 set, 무한 루프 방지)
  useEffect(() => {
    if (isReservationCancelled) return
    if (!isOTAChannel || isCardFeeManuallyEdited.current) return
    if (isExistingPricingLoaded) return // DB에 값이 있으면 계산하지 않음
    if (pricingFieldsFromDb.commission_amount) return
    const currentCommissionAmount = formData.commission_amount || 0
    if (currentCommissionAmount !== 0) return

    const adjustedBasePrice = channelPaymentAmountAfterReturn
    const commissionPercent = (formData.commission_percent && formData.commission_percent > 0)
      ? formData.commission_percent
      : (channelCommissionPercent || 0)
    if (commissionPercent <= 0 || adjustedBasePrice <= 0) return

    const calculatedCommission = adjustedBasePrice * (commissionPercent / 100)
    if (calculatedCommission <= 0) return

    setFormData((prev: typeof formData) => {
      const prevAmount = prev.commission_amount ?? 0
      if (Math.abs(prevAmount - calculatedCommission) < 0.01) return prev
      return { ...prev, commission_amount: calculatedCommission }
    })
  }, [
    isReservationCancelled,
    returnedAmount,
    isOTAChannel,
    isExistingPricingLoaded,
    formData.commission_base_price,
    formData.onlinePaymentAmount,
    formData.commission_percent,
    formData.commission_amount,
    formData.productPriceTotal,
    formData.couponDiscount,
    formData.additionalDiscount,
    formData.subtotal,
    channelCommissionPercent,
    channelPaymentAmountAfterReturn,
    pricingFieldsFromDb,
    setFormData,
  ])

  // 채널 결제 금액이 변경될 때 commission_amount 자동 재계산 (commission_amount가 0일 때만, 동일 값이면 set 안 함)
  useEffect(() => {
    if (isReservationCancelled) return
    if (!isOTAChannel || isCardFeeManuallyEdited.current) return
    if (isExistingPricingLoaded) return // DB에 값이 있으면 계산하지 않음
    if (pricingFieldsFromDb.commission_amount) return
    const currentCommissionAmount = formData.commission_amount || 0
    if (currentCommissionAmount !== 0) return

    const adjustedBasePrice = channelPaymentAmountAfterReturn
    const commissionPercent = (formData.commission_percent && formData.commission_percent > 0)
      ? formData.commission_percent
      : (channelCommissionPercent || 0)
    if (commissionPercent <= 0 || adjustedBasePrice <= 0) return

    const calculatedCommission = adjustedBasePrice * (commissionPercent / 100)
    if (calculatedCommission <= 0) return

    setFormData((prev: typeof formData) => {
      const prevAmount = prev.commission_amount ?? 0
      if (Math.abs(prevAmount - calculatedCommission) < 0.01) return prev
      return { ...prev, commission_amount: calculatedCommission }
    })
  }, [
    isReservationCancelled,
    formData.commission_base_price,
    formData.onlinePaymentAmount,
    isOTAChannel,
    returnedAmount,
    isExistingPricingLoaded,
    formData.commission_percent,
    formData.commission_amount,
    formData.productPriceTotal,
    formData.couponDiscount,
    formData.additionalDiscount,
    formData.subtotal,
    channelCommissionPercent,
    channelPaymentAmountAfterReturn,
    pricingFieldsFromDb,
    setFormData,
  ])

  // OTA + 채널 수수료: 채널이 로드된 뒤 수수료 %와 $를 한 번에 설정 (채널 수수료 %가 채널 수수료 $보다 나중에 로드되어도 동작)
  useEffect(() => {
    if (channelPaymentAmountFieldFocusedRef.current) return
    if (isReservationCancelled) return
    if (!formData.channelId || !channels?.length || isExistingPricingLoaded) return
    if (pricingFieldsFromDb.commission_amount) return
    const ch = channels.find((c: { id: string }) => c.id === formData.channelId)
    const isOTA = ch && ((ch as any).type?.toLowerCase() === 'ota' || (ch as any).category === 'OTA')
    if (!isOTA) return
    const percentFromChannel = Number((ch as any).commission_percent ?? (ch as any).commission_rate ?? (ch as any).commission) || 0
    if (percentFromChannel <= 0) return
    const currentAmount = formData.commission_amount ?? 0
    if (currentAmount > 0.01) return

    const adjustedBase = channelPaymentAmountAfterReturn
    if (adjustedBase <= 0) return

    const percent = (formData.commission_percent != null && formData.commission_percent > 0) ? formData.commission_percent : percentFromChannel
    const calculated = Math.round(adjustedBase * (percent / 100) * 100) / 100
    if (calculated <= 0) return

    setFormData((prev: typeof formData) => {
      const prevAmount = prev.commission_amount ?? 0
      if (Math.abs(prevAmount - calculated) < 0.01) return prev
      return {
        ...prev,
        commission_percent: (prev.commission_percent != null && prev.commission_percent > 0) ? prev.commission_percent : percent,
        commission_amount: calculated,
        ...(prev.commission_base_price == null && adjustedBase > 0
          ? { commission_base_price: adjustedBase }
          : {}),
      }
    })
  }, [
    isReservationCancelled,
    formData.channelId,
    channels,
    isExistingPricingLoaded,
    formData.commission_amount,
    formData.commission_percent,
    formData.commission_base_price,
    formData.onlinePaymentAmount,
    formData.productPriceTotal,
    formData.couponDiscount,
    formData.additionalDiscount,
    formData.subtotal,
    returnedAmount,
    channelPaymentAmountAfterReturn,
    pricingFieldsFromDb,
    setFormData,
  ])

  // 채널 변경 시 commission_percent 초기화 (채널이 변경되면 새로운 채널의 commission_percent를 사용)
  const prevChannelIdRef = useRef<string | undefined>(undefined)
  
  // 채널의 pricing_type 확인 (단일 가격 모드 체크)
  const pricingType = selectedChannel?.pricing_type || 'separate'
  const isSinglePrice = pricingType === 'single'
  
  // 초이스별 불포함 금액 계산 (항상 dynamic_pricing에서 조회)
  const calculateChoiceNotIncludedTotal = useCallback(async (): Promise<NotIncludedCalcResult> => {
    const paxEarly = (formData.pricingAdults || 0) + (formData.child || 0) + (formData.infant || 0)
    const residentOnlyEarly = sumResidentFeeAmountsUsd(formData.residentStatusAmounts)
    const fieldOnlyEarly = (formData.not_included_price || 0) * paxEarly

    if (!formData.productId || !formData.tourDate || !formData.channelId) {
      return packNotIncluded(fieldOnlyEarly, residentOnlyEarly)
    }

    try {
      const variantKey = (formData as any).variantKey || 'default'
      let pricingData: any[] | null = null
      let queryError: any = null
      const { data: data1, error: err1 } = await supabase
        .from('dynamic_pricing')
        .select('choices_pricing, not_included_price, updated_at')
        .eq('product_id', formData.productId)
        .eq('date', formData.tourDate)
        .eq('channel_id', formData.channelId)
        .eq('variant_key', variantKey)
        .order('updated_at', { ascending: false })
        .limit(1)
      pricingData = data1
      queryError = err1
      if ((!pricingData || pricingData.length === 0) && !queryError) {
        if (variantKey !== 'default') {
          const { data: dataDefault } = await supabase
            .from('dynamic_pricing')
            .select('choices_pricing, not_included_price, updated_at')
            .eq('product_id', formData.productId)
            .eq('date', formData.tourDate)
            .eq('channel_id', formData.channelId)
            .eq('variant_key', 'default')
            .order('updated_at', { ascending: false })
            .limit(1)
          if ((dataDefault?.length ?? 0) > 0) pricingData = dataDefault
        }
        if (!pricingData || pricingData.length === 0) {
          const { data: dataAny } = await supabase
            .from('dynamic_pricing')
            .select('choices_pricing, not_included_price, updated_at')
            .eq('product_id', formData.productId)
            .eq('date', formData.tourDate)
            .eq('channel_id', formData.channelId)
            .order('updated_at', { ascending: false })
            .limit(1)
          if ((dataAny?.length ?? 0) > 0) pricingData = dataAny
        }
      }
      if (queryError || !pricingData || pricingData.length === 0) {
        return packNotIncluded(fieldOnlyEarly, residentOnlyEarly)
      }

      type PricingData = {
        not_included_price?: number
        choices_pricing?: string | Record<string, { not_included_price?: number }>
      }
      const pricing = pricingData[0] as PricingData | undefined
      const defaultNotIncludedPrice = pricing?.not_included_price || 0
      
      // choices_pricing 파싱
      type ChoicePricing = {
        not_included_price?: number
      }
      let choicesPricing: Record<string, ChoicePricing> = {}
      if (pricing?.choices_pricing) {
        try {
          choicesPricing = typeof pricing.choices_pricing === 'string'
            ? JSON.parse(pricing.choices_pricing)
            : pricing.choices_pricing
        } catch (e) {
          console.warn('choices_pricing 파싱 오류:', e)
          const pax = formData.pricingAdults + formData.child + formData.infant
          const fieldFromForm = (formData.not_included_price || 0) * pax
          return packNotIncluded(
            Math.max(defaultNotIncludedPrice * pax, fieldFromForm),
            sumResidentFeeAmountsUsd(formData.residentStatusAmounts)
          )
        }
      }

      // 선택된 초이스별 불포함 금액 계산 (미국 거주자 구분 그룹은 UI 금액(residentStatusAmounts)으로만 합산해 초이스와 무관하게 반영)
      let totalNotIncluded = 0
      const totalPax = formData.pricingAdults + formData.child + formData.infant
      const residentClassChoice = findUsResidentClassificationChoice(
        (formData.productChoices || []) as Parameters<typeof findUsResidentClassificationChoice>[0]
      )

      // 새로운 간결한 초이스 시스템 (selectedChoices가 배열인 경우)
      if (Array.isArray(formData.selectedChoices)) {
        formData.selectedChoices.forEach(
          (choice: { choice_id?: string; id?: string; option_id?: string; quantity?: number }) => {
          const choiceId = choice.choice_id || choice.id
          if (residentClassChoice && choiceId === residentClassChoice.id) return

          const optionId = choice.option_id

          let choiceData = null
          if (optionId && choicesPricing[optionId]) {
            choiceData = choicesPricing[optionId]
          } else if (choiceId && choicesPricing[choiceId]) {
            choiceData = choicesPricing[choiceId]
          }

          if (choiceData) {
            const choiceNotIncludedPrice = choiceData.not_included_price !== undefined && choiceData.not_included_price !== null
              ? choiceData.not_included_price
              : defaultNotIncludedPrice
            totalNotIncluded += choiceNotIncludedPrice * totalPax
          }
        })
      } else if (formData.selectedChoices && typeof formData.selectedChoices === 'object') {
        Object.entries(formData.selectedChoices).forEach(([choiceId]) => {
          if (residentClassChoice && choiceId === residentClassChoice.id) return
          if (choicesPricing[choiceId]) {
            const choicePricing = choicesPricing[choiceId]
            const choiceNotIncludedPrice = choicePricing.not_included_price !== undefined && choicePricing.not_included_price !== null
              ? choicePricing.not_included_price
              : defaultNotIncludedPrice
            totalNotIncluded += choiceNotIncludedPrice * (formData.pricingAdults + formData.child + formData.infant)
          }
        })
      }

      if (totalNotIncluded === 0 && defaultNotIncludedPrice > 0) {
        const hasGranularChoicePricing = Object.keys(choicesPricing).length > 0
        if (!hasGranularChoicePricing) {
          totalNotIncluded = defaultNotIncludedPrice * totalPax
        }
      }

      const fieldFromForm = (formData.not_included_price || 0) * totalPax
      const baseBeforeResident = Math.max(totalNotIncluded, fieldFromForm)

      const residentPart = sumResidentFeeAmountsUsd(formData.residentStatusAmounts)
      return packNotIncluded(baseBeforeResident, residentPart)
    } catch (error) {
      console.error('초이스별 불포함 금액 계산 오류:', error)
      const pax = formData.pricingAdults + formData.child + formData.infant
      return packNotIncluded(
        (formData.not_included_price || 0) * pax,
        sumResidentFeeAmountsUsd(formData.residentStatusAmounts)
      )
    }
  }, [
    formData.productId,
    formData.tourDate,
    formData.channelId,
    (formData as any).variantKey,
    formData.selectedChoices,
    formData.productChoices,
    formData.pricingAdults,
    formData.child,
    formData.infant,
    formData.not_included_price,
    formData.residentStatusAmounts,
  ])

  // 초이스별 불포함 금액 업데이트 (상품·날짜·채널 없을 때도 거주 금액·not_included_price×인원 반영)
  useEffect(() => {
    let cancelled = false
    calculateChoiceNotIncludedTotal().then((res) => {
      if (cancelled) return
      setChoiceNotIncludedTotal(res.total)
      setChoiceNotIncludedBaseTotal(res.baseTotal)
      setFormData((prev: typeof formData) => {
        const p = prev as any
        if (p.choiceNotIncludedTotal === res.total && p.choiceNotIncludedBaseTotal === res.baseTotal) return prev
        return {
          ...prev,
          choiceNotIncludedTotal: res.total,
          choiceNotIncludedBaseTotal: res.baseTotal,
        }
      })
    })
    return () => {
      cancelled = true
    }
  }, [
    calculateChoiceNotIncludedTotal,
    formData.productId,
    formData.tourDate,
    formData.channelId,
    formData.selectedChoices,
    formData.productChoices,
    formData.pricingAdults,
    formData.child,
    formData.infant,
    (formData as any).variantKey,
    formData.residentStatusAmounts,
    formData.not_included_price,
    setFormData,
  ])

  // 정산 카드 하단 설명 표시 (모바일: 클릭 시 토글)
  const [expandedSettlementCard, setExpandedSettlementCard] = useState<string | null>(null)

  /** 정산 정보: ④ 운영이익 − 예약·투어(배정된 투어만) 지출 */
  const calculateProfit = () => {
    return roundUsd2(
      companyViewRevenueLedger.operatingProfit - reservationExpensesTotal - tourExpensesTotal
    )
  }

  // 커미션 기본값 설정 및 자동 업데이트 (할인 후 상품가 우선, 없으면 OTA 판매가, 없으면 소계)
  const otaSalePrice = formData.onlinePaymentAmount ?? 0
  const currentCommissionBase = formData.commission_base_price ?? 0

  // OTA는 쿠폰 시 할인 후 상품가, 비-OTA(홈페이지)는 할인 후 상품가. 0이 아닐 때 onlinePaymentAmount 자동 설정.
  // 취소 OTA·부분 정산은 수동 입력만 쓰므로 자동 덮어쓰기 안 함. 수동 입력 후 사용자 값 최우선.
  useEffect(() => {
    if (channelPaymentAmountFieldFocusedRef.current) return
    if (channelPaymentLoadedFromDb) return
    if (!isOTAChannel && nonOtaChannelPaymentStopProductAutoSyncRef.current) return
    if (isOTAChannel && isReservationCancelled) return

    const targetOnline = isOTAChannel
      ? otaChannelProductPaymentGross
      : Math.max(0, discountedProductPrice)

    if (targetOnline > 0) {
      setFormData((prev: typeof formData) => {
        const currentOnlinePaymentAmount = prev.onlinePaymentAmount || 0
        const priceDifference = Math.abs(currentOnlinePaymentAmount - targetOnline)

        const userEditedChannelPayment =
          channelSettlementUserEditedRef.current ||
          channelPaymentPricingTouched ||
          (isOTAChannel
            ? otaChannelPaymentUserEditedRef.current
            : nonOtaChannelPaymentUserEditedRef.current)

        const shouldSyncFromProduct =
          !userEditedChannelPayment &&
          (currentOnlinePaymentAmount === 0 ||
            (priceDifference > 0.01 && !isChannelPaymentAmountFocused))

        if (shouldSyncFromProduct) {
          const man = Math.max(0, Number(prev.refundAmount) || 0)
          const ret = Math.max(0, Number(returnedAmount) || 0)
          const netChannel = isOTAChannel
            ? Math.max(0, targetOnline - Math.max(man, ret))
            : targetOnline
          return {
            ...prev,
            onlinePaymentAmount: targetOnline,
            commission_base_price: isOTAChannel ? netChannel : targetOnline,
          }
        }
        return prev
      })
    }
  }, [
    discountedProductPrice,
    isOTAChannel,
    isReservationCancelled,
    isChannelPaymentAmountFocused,
    returnedAmount,
    formData.refundAmount,
    channelPaymentLoadedFromDb,
    channelPaymentPricingTouched,
    setFormData,
    otaChannelProductPaymentGross,
  ])

  // 채널 변경 시 선택된 쿠폰이 해당 채널에 속하지 않으면 쿠폰 초기화 (ota가 아닐 때 Homepage 쿠폰은 유지)
  useEffect(() => {
    if (hasDbReservationPricingRow) return
    if (formData.couponCode && formData.channelId) {
      const selectedCoupon = coupons.find(c => 
        c.coupon_code && 
        c.coupon_code.trim().toLowerCase() === formData.couponCode.trim().toLowerCase()
      )
      if (!selectedCoupon || !selectedCoupon.channel_id) return
      const isHomepageCoupon = homepageChannelId && selectedCoupon.channel_id === homepageChannelId
      // 채널과 일치하거나, (ota가 아니고 Homepage 쿠폰이면) 유지. 그 외에만 초기화
      if (selectedCoupon.channel_id === formData.channelId) return
      if (!isOTAChannel && isHomepageCoupon) return
      setFormData((prev: typeof formData) => ({
        ...prev,
        couponCode: '',
        couponDiscount: 0
      }))
    }
  }, [formData.channelId, formData.couponCode, coupons, homepageChannelId, isOTAChannel, hasDbReservationPricingRow, setFormData])

  // 인원 변경 시 쿠폰 할인 재계산 (percentage 타입 쿠폰만)
  useEffect(() => {
    if (hasDbReservationPricingRow) return
    if (formData.couponCode) {
      const selectedCoupon = coupons.find(c => 
        c.coupon_code && 
        c.coupon_code.trim().toLowerCase() === formData.couponCode.trim().toLowerCase()
      )
      
      // percentage 타입 쿠폰인 경우에만 재계산 (fixed 타입은 금액이 고정이므로 재계산 불필요)
      if (selectedCoupon && selectedCoupon.discount_type === 'percentage') {
        // 불포함 가격 계산 (쿠폰 할인 계산에서 제외)
        const notIncludedPrice = notIncludedBreakdown.totalUsd
        // OTA 채널일 때는 OTA 판매가에 직접 쿠폰 할인 적용 (불포함 가격 제외)
        const subtotal = isOTAChannel 
          ? formData.productPriceTotal - notIncludedPrice
          : calculateProductPriceTotal() + calculateChoiceTotal() - notIncludedPrice
        const newCouponDiscount = calculateCouponDiscount(selectedCoupon, subtotal)
        
        // 할인 금액이 변경된 경우에만 업데이트
        if (Math.abs(newCouponDiscount - formData.couponDiscount) > 0.01) {
          setFormData((prev: typeof formData) => ({
            ...prev,
            couponDiscount: newCouponDiscount
          }))
        }
      }
    }
  }, [
    formData.couponCode,
    formData.productPriceTotal,
    formData.pricingAdults,
    formData.child,
    formData.infant,
    isOTAChannel,
    calculateProductPriceTotal,
    calculateChoiceTotal,
    calculateCouponDiscount,
    coupons,
    formData.couponDiscount,
    hasDbReservationPricingRow,
    setFormData,
    notIncludedBreakdown.totalUsd,
  ])

  // 채널 수수료율 로드 확인 및 설정
  useEffect(() => {
    if (!selectedChannel || !isOTAChannel) return
    if (channelCommissionPercent === undefined || channelCommissionPercent === null) return
    // DB에 commission_percent가 있으면 절대 덮어쓰지 않음
    if (hasDbCommissionRef.current || isExistingPricingLoaded) return
    // 이미 같은 값이면 setState 하지 않음 → 무한 루프 방지 (0일 때도 formData.commission_percent === 0 이면 재실행 시 동일하므로 한 번만 설정)
    if (formData.commission_percent === channelCommissionPercent) return
    // commission_percent가 없거나 0일 때만 채널 수수료율로 설정 (초기화 목적)
    const isUnset = formData.commission_percent === undefined || formData.commission_percent === null || formData.commission_percent === 0
    if (!isUnset) return

    setFormData((prev: typeof formData) => ({
      ...prev,
      commission_percent: channelCommissionPercent
    }))
  }, [
    selectedChannel,
    isOTAChannel,
    channelCommissionPercent,
    formData.commission_percent,
    isExistingPricingLoaded,
    setFormData
  ])

  // 채널 변경 감지: 채널을 바꾸면 이전 채널의 commission 보호 해제 후 새 채널 기준으로 재계산
  useEffect(() => {
    // DB 기존 가격 로드 직후 한 번만 ref 동기화하고 덮어쓰지 않음
    if (isExistingPricingLoaded && prevChannelIdRef.current === undefined) {
      prevChannelIdRef.current = formData.channelId
      return
    }
    if (formData.channelId !== prevChannelIdRef.current) {
      prevChannelIdRef.current = formData.channelId
      channelSettlementUserEditedRef.current = false
      nonOtaChannelPaymentUserEditedRef.current = false
      nonOtaChannelPaymentStopProductAutoSyncRef.current = false
      loadedCommissionAmountRef.current = null
      isCardFeeManuallyEdited.current = false
      otaCommissionAutoFingerprintRef.current = ''
      if (isOTAChannel && channelCommissionPercent > 0) {
        const commissionCalcBase = channelPaymentAmountAfterReturn
        const calculatedAmount = commissionCalcBase * (channelCommissionPercent / 100)
        otaCommissionAutoFingerprintRef.current = otaCommissionFeeFingerprint(
          commissionCalcBase,
          channelCommissionPercent
        )
        setFormData((prev: typeof formData) => ({
          ...prev,
          commission_percent: channelCommissionPercent,
          commission_amount: calculatedAmount
        }))
      }
    }
  }, [
    formData.channelId,
    isOTAChannel,
    isExistingPricingLoaded,
    channelCommissionPercent,
    formData.commission_base_price,
    discountedProductPrice,
    otaSalePrice,
    formData.subtotal,
    returnedAmount,
    channelPaymentAmountAfterReturn,
    setFormData,
  ])

  // 채널의 commission_percent를 기본값으로 설정 (초기 로딩 시 또는 commission_percent가 0일 때)
  useEffect(() => {
    if (!isOTAChannel) return
    // DB에 commission_percent가 있으면 절대 덮어쓰지 않음
    if (hasDbCommissionRef.current || isExistingPricingLoaded) return
    // 이미 채널 수수료율과 동일하면 set 하지 않음 (무한 루프 방지, channelCommissionPercent 0 포함)
    if (formData.commission_percent === channelCommissionPercent) return
    if (channelCommissionPercent === undefined || channelCommissionPercent === null) return
    // 데이터베이스에서 불러온 commission_amount가 있으면 절대 덮어쓰지 않음
    if (loadedCommissionAmountRef.current !== null && loadedCommissionAmountRef.current > 0) return

    // commission_percent가 없거나 0일 때만, commission_amount도 0일 때만 설정
    const isUnset = (!formData.commission_percent && formData.commission_percent !== 0) || formData.commission_percent === 0
    if (!isUnset || formData.commission_amount !== 0) return

    const commissionCalcBase = channelPaymentAmountAfterReturn
    const calculatedAmount = commissionCalcBase * (channelCommissionPercent / 100)

    setFormData((prev: typeof formData) => ({
      ...prev,
      commission_percent: channelCommissionPercent,
      commission_amount: prev.commission_amount > 0 ? prev.commission_amount : calculatedAmount
    }))
  }, [
    isOTAChannel,
    channelCommissionPercent,
    formData.commission_percent,
    formData.commission_amount,
    formData.commission_base_price,
    discountedProductPrice,
    otaSalePrice,
    formData.subtotal,
    isExistingPricingLoaded,
    channelPaymentAmountAfterReturn,
    setFormData,
  ])
  
  // commission_base_price 자동 동기화(자체 채널): 상품가 기준 베이스만 — 카드 수수료 $는 %로부터 역산하지 않음
  useEffect(() => {
    if (isOTAChannel) return
    if (nonOtaChannelPaymentUserEditedRef.current) return
    if (channelPaymentAmountFieldFocusedRef.current) return
    // DB에 commission이 있으면 계산하지 말고 그 값 유지
    if (hasDbCommissionRef.current || isExistingPricingLoaded) return
    if (isCardFeeManuallyEdited.current) return
    const basePrice = discountedProductPrice > 0 ? discountedProductPrice : (otaSalePrice > 0 ? otaSalePrice : formData.subtotal)
    if (basePrice <= 0) return
    if (formData.commission_base_price !== undefined && Math.abs(currentCommissionBase - basePrice) >= 0.01) return

    const needBase = formData.commission_base_price === undefined || Math.abs(currentCommissionBase - basePrice) >= 0.01
    if (!needBase) return

    setFormData((prev: typeof formData) => {
      const newBase = basePrice
      if (Math.abs((prev.commission_base_price ?? 0) - newBase) < 0.01) return prev
      return { ...prev, commission_base_price: newBase }
    })
  }, [
    discountedProductPrice,
    otaSalePrice,
    formData.subtotal,
    currentCommissionBase,
    formData.commission_base_price,
    formData.productPriceTotal,
    formData.couponDiscount,
    formData.additionalDiscount,
    isExistingPricingLoaded,
    isOTAChannel,
    returnedAmount,
    setFormData
  ])

  // 데이터베이스에서 불러온 commission 추적 (자동 계산/역산으로 덮어쓰지 않도록)
  const loadedCommissionAmountRef = useRef<number | null>(null)
  const hasDbCommissionRef = useRef<boolean>(false)
  
  // reservation_pricing에서 로드된 commission_percent/commission_amount가 있으면 플래그 설정 → 이후 어떤 effect도 덮어쓰지 않음
  useEffect(() => {
    if (isExistingPricingLoaded) {
      if (formData.commission_amount !== undefined && formData.commission_amount !== null) {
        loadedCommissionAmountRef.current = formData.commission_amount
      }
      if (formData.commission_percent !== undefined && formData.commission_percent !== null) {
        hasDbCommissionRef.current = true
      }
    }
  }, [isExistingPricingLoaded, formData.commission_amount, formData.commission_percent])

  return (
    <div className="relative">
      {priceCalculationPending && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg bg-white/80 backdrop-blur-[1px] min-h-[100px]"
          aria-busy="true"
          aria-live="polite"
        >
          <span
            className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600 mb-2"
            aria-hidden
          />
          <span className="text-sm text-gray-600">
            {isKorean ? '가격·정산 계산 중…' : 'Calculating prices…'}
          </span>
        </div>
      )}
      {/* 가격 정보 상태 뱃지 */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-medium text-gray-900">{t('form.pricingInfo')}</h3>
          {formData.channelId && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 border border-sky-200 text-xs font-medium" title={formData.channelId}>
              {channels?.find((c: { id: string; name?: string }) => c.id === formData.channelId)?.name ?? formData.channelId}
            </span>
          )}
          {formData.tourDate && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 border border-sky-200 text-xs font-medium" title={formData.tourDate}>
              {formData.tourDate}
            </span>
          )}
          {isExistingPricingLoaded && (
            <span className="px-2 py-1 bg-green-100 border border-green-300 rounded text-xs text-green-700">기존 가격</span>
          )}
          {!isExistingPricingLoaded && (
            <span className="px-2 py-1 bg-red-50 border border-red-200 rounded text-xs text-red-700">동적가격/계산값</span>
          )}
          <span className="px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs text-gray-700">
            검정=DB값
          </span>
          <span className="px-2 py-1 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            빨강=계산/수정값
          </span>
          <div className="flex items-center space-x-1">
            {!formData.productId && (
              <span className="px-2 py-1 bg-red-100 border border-red-300 rounded text-xs text-red-700">상품</span>
            )}
            {!formData.channelId && (
              <span className="px-2 py-1 bg-red-100 border border-red-300 rounded text-xs text-red-700">채널</span>
            )}
            {!formData.tourDate && (
              <span className="px-2 py-1 bg-red-100 border border-red-300 rounded text-xs text-red-700">날짜</span>
            )}
            {formData.productId && formData.channelId && formData.tourDate && (
              <span className="px-2 py-1 bg-green-100 border border-green-300 rounded text-xs text-green-700">✓ 완료</span>
            )}
          </div>
        </div>
      </div>

      {pricingAudit && (
        <div className={`mb-3 rounded-lg border p-3 text-xs ${
          pricingAudit.audited
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
            : 'border-amber-200 bg-amber-50 text-amber-900'
        }`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <label className="inline-flex items-center gap-2 font-semibold">
                <input
                  type="checkbox"
                  checked={pricingAudit.audited}
                  disabled={!pricingAudit.canToggle}
                  onChange={(e) => onTogglePricingAudited?.(e.target.checked)}
                  className="h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-60"
                />
                Audited
                {!pricingAudit.canToggle && <span className="text-[11px] font-normal text-gray-500">(super 관리자만 체크 가능)</span>}
              </label>
              {pricingAudit.audited ? (
                <div className="text-[11px] text-emerald-800">
                  검수자: {pricingAudit.auditedByNickName || pricingAudit.auditedByName || pricingAudit.auditedByEmail || '-'}
                  {pricingAudit.auditedAt ? ` · ${new Date(pricingAudit.auditedAt).toLocaleString('ko-KR')}` : ''}
                </div>
              ) : (
                <div className="text-[11px] text-amber-800">아직 super 관리자 검수가 완료되지 않았습니다.</div>
              )}
            </div>
            {pricingAudit.isLockedForCurrentUser && (
              <button
                type="button"
                onClick={onRequestPricingAuditModification}
                className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
              >
                수정 요청 보내기
              </button>
            )}
          </div>
          {pricingAudit.isLockedForCurrentUser && (
            <p className="mt-2 text-[11px] text-amber-800">
              Audited 된 가격 정보는 OP/Manager/Office Manager가 직접 수정할 수 없습니다.
            </p>
          )}
        </div>
      )}

      <div className={`grid grid-cols-1 md:grid-cols-3 gap-3 ${pricingAudit?.isLockedForCurrentUser ? 'pointer-events-none opacity-70' : ''}`}>
        {/* 왼쪽 열: 상품 가격 + 초이스 (위) + 할인/추가 비용 (아래) - 1/3 너비 */}
        <div className="space-y-3 md:col-span-1">
          {/* 상품 가격 */}
          <div className="bg-white p-3 rounded border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-900">상품가격</h4>
              {(formData.adultProductPrice > 0 || formData.childProductPrice > 0 || formData.infantProductPrice > 0) && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                  자동입력됨
                </span>
              )}
            </div>
            <div className="space-y-1">
              <div className="space-y-2">
                <div className="text-xs text-gray-600 mb-1">성인</div>
                <div className="flex items-center justify-between gap-2 mb-1.5 text-xs">
                  <span className="text-gray-600 shrink-0">예약 성인 인원</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={formData.pricingAdults}
                      onChange={(e) => {
                        const v = Math.max(0, Math.floor(Number(e.target.value) || 0))
                        markPricingEdited('pricingAdults', 'productPriceTotal', 'totalPrice', 'onSiteBalanceAmount')
                        setFormData({ ...formData, pricingAdults: v })
                      }}
                      className={`w-12 px-1 py-0.5 text-xs border border-gray-300 rounded text-right focus:ring-1 focus:ring-blue-500 ${priceTextClass('pricingAdults')}`}
                    />
                    <span className="text-gray-500">명</span>
                  </div>
                </div>
                {/* 판매가 + 불포함 가격 입력 */}
                <div className="space-y-2 mb-2">
                  {/* 판매가 */}
                  <div className="flex items-center space-x-1 flex-wrap gap-x-1">
                    <span className="text-xs text-gray-500 w-16 shrink-0">판매가</span>
                    {showDynamicPricingFormula &&
                      dynamicProductPriceFormula &&
                      formulaUsdDiffers(
                        formData.adultProductPrice,
                        dynamicProductPriceFormula.adultPrice
                      ) && (
                        <span className="text-[11px] text-red-600 font-medium shrink-0">
                          (계산 ${dynamicProductPriceFormula.adultPrice.toFixed(2)})
                        </span>
                      )}
                    <span className="font-medium text-xs">$</span>
                    <input
                      type="number"
                      value={formData.adultProductPrice || ''}
                      onFocus={onProductSalePriceFocusIn}
                      onBlur={onProductSalePriceFocusOut}
                      onChange={(e) => {
                        const salePrice = Number(e.target.value) || 0
                        markPricingEdited(
                          'adultProductPrice',
                          'productPriceTotal',
                          'totalPrice',
                          'onSiteBalanceAmount'
                        )
                        // 상품 가격 총합 계산 (불포함 가격 제외)
                        const childPrice = isSinglePrice ? salePrice : (formData.childProductPrice || 0)
                        const infantPrice = isSinglePrice ? salePrice : (formData.infantProductPrice || 0)
                        
                        const newProductPriceTotal = (salePrice * formData.pricingAdults) + 
                                                     (childPrice * formData.child) + 
                                                     (infantPrice * formData.infant)
                        setFormData({ 
                          ...formData, 
                          adultProductPrice: salePrice,
                          // 단일 가격 모드일 때는 아동/유아 가격도 동일하게 설정
                          ...(isSinglePrice ? {
                            childProductPrice: salePrice,
                            infantProductPrice: salePrice
                          } : {}),
                          productPriceTotal: newProductPriceTotal
                        })
                      }}
                      className={`w-16 px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 ${priceTextClass('adultProductPrice')}`}
                      step="0.01"
                      placeholder="0"
                    />
                  </div>
                  {/* 불포함 가격 */}
                  <div className="flex items-center space-x-1 flex-wrap gap-x-1">
                    <span className="text-xs text-gray-500 w-16 shrink-0">불포함</span>
                    {showDynamicPricingFormula &&
                      dynamicProductPriceFormula &&
                      formulaUsdDiffers(
                        formData.not_included_price || 0,
                        dynamicProductPriceFormula.notIncludedPrice
                      ) && (
                        <span className="text-[11px] text-red-600 font-medium shrink-0">
                          (계산 ${dynamicProductPriceFormula.notIncludedPrice.toFixed(2)})
                        </span>
                      )}
                    <span className="font-medium text-xs">$</span>
                    <input
                      type="number"
                      value={formData.not_included_price || ''}
                      onChange={(e) => {
                        const notIncluded = Number(e.target.value) || 0
                        markPricingEdited('not_included_price', 'productPriceTotal', 'totalPrice', 'onSiteBalanceAmount')
                        // 상품 가격 총합 계산 (불포함 가격 제외)
                        const salePrice = formData.adultProductPrice || 0
                        const childSalePrice = formData.childProductPrice || 0
                        const infantSalePrice = formData.infantProductPrice || 0
                        const childPrice = isSinglePrice ? salePrice : childSalePrice
                        const infantPrice = isSinglePrice ? salePrice : infantSalePrice
                        
                        const newProductPriceTotal = (salePrice * formData.pricingAdults) + 
                                                     (childPrice * formData.child) + 
                                                     (infantPrice * formData.infant)
                        setFormData({ 
                          ...formData, 
                          not_included_price: notIncluded,
                          productPriceTotal: newProductPriceTotal
                        })
                      }}
                      className={`w-16 px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 ${priceTextClass('not_included_price')}`}
                      step="0.01"
                      placeholder="0"
                    />
                  </div>
                  {/* 합계 */}
                  <div className="flex items-center space-x-1">
                    <span className="text-xs text-gray-500 w-16"></span>
                    <span className="text-xs text-gray-500">=</span>
                    <span className="font-medium text-xs text-blue-600">
                      ${((formData.adultProductPrice || 0) + (formData.not_included_price || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
                {/* 성인 가격 x 인원수 */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">
                    성인 [${(formData.adultProductPrice || 0).toFixed(2)}]
                  </span>
                  <div className="flex items-center space-x-1">
                    {isSinglePrice ? (
                      <>
                        <span className="text-gray-500">x{formData.pricingAdults + formData.child + formData.infant}</span>
                        <span className="font-medium">
                          = ${((formData.adultProductPrice || 0) * (formData.pricingAdults + formData.child + formData.infant)).toFixed(2)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-gray-500">x{formData.pricingAdults}</span>
                        <span className="font-medium">
                          = ${((formData.adultProductPrice || 0) * formData.pricingAdults).toFixed(2)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {/* 단일 가격 모드일 때는 아동/유아 필드 숨김 */}
              {!isSinglePrice && (
                <>
                  <div className="flex items-center justify-between text-xs gap-2">
                    <span className="text-gray-600 inline-flex items-center gap-1 flex-wrap shrink-0">
                      아동
                      {showDynamicPricingFormula &&
                        dynamicProductPriceFormula &&
                        formulaUsdDiffers(
                          formData.childProductPrice,
                          dynamicProductPriceFormula.childPrice
                        ) && (
                          <span className="text-[11px] text-red-600 font-medium">
                            (계산 ${dynamicProductPriceFormula.childPrice.toFixed(2)})
                          </span>
                        )}
                    </span>
                    <div className="flex items-center space-x-1">
                      <span className="font-medium">$</span>
                      <input
                        type="number"
                        value={formData.childProductPrice || ''}
                        onFocus={onProductSalePriceFocusIn}
                        onBlur={onProductSalePriceFocusOut}
                        onChange={(e) => {
                          const newPrice = Number(e.target.value) || 0
                          markPricingEdited(
                            'childProductPrice',
                            'productPriceTotal',
                            'totalPrice',
                            'onSiteBalanceAmount'
                          )
                          const adultTotalPrice = (formData.adultProductPrice || 0) + (formData.not_included_price || 0)
                          const childTotalPrice = newPrice + (formData.not_included_price || 0)
                          const infantTotalPrice = (formData.infantProductPrice || 0) + (formData.not_included_price || 0)
                          // 상품 가격 총합 계산 (불포함 가격 포함)
                          const newProductPriceTotal = (adultTotalPrice * formData.pricingAdults) + 
                                                       (childTotalPrice * formData.child) + 
                                                       (infantTotalPrice * formData.infant)
                          setFormData({ 
                            ...formData, 
                            childProductPrice: newPrice,
                            productPriceTotal: newProductPriceTotal
                          })
                        }}
                        className={`w-12 px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 ${priceTextClass('childProductPrice')}`}
                        step="0.01"
                        placeholder="0"
                      />
                      <span className="text-gray-500">x{formData.child}</span>
                      <span className="font-medium">${((formData.childProductPrice || 0) * formData.child).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs gap-2">
                    <span className="text-gray-600 inline-flex items-center gap-1 flex-wrap shrink-0">
                      유아
                      {showDynamicPricingFormula &&
                        dynamicProductPriceFormula &&
                        formulaUsdDiffers(
                          formData.infantProductPrice,
                          dynamicProductPriceFormula.infantPrice
                        ) && (
                          <span className="text-[11px] text-red-600 font-medium">
                            (계산 ${dynamicProductPriceFormula.infantPrice.toFixed(2)})
                          </span>
                        )}
                    </span>
                    <div className="flex items-center space-x-1">
                      <span className="font-medium">$</span>
                      <input
                        type="number"
                        value={formData.infantProductPrice || ''}
                        onFocus={onProductSalePriceFocusIn}
                        onBlur={onProductSalePriceFocusOut}
                        onChange={(e) => {
                          const newPrice = Number(e.target.value) || 0
                          markPricingEdited(
                            'infantProductPrice',
                            'productPriceTotal',
                            'totalPrice',
                            'onSiteBalanceAmount'
                          )
                          const adultTotalPrice = (formData.adultProductPrice || 0) + (formData.not_included_price || 0)
                          const childTotalPrice = (formData.childProductPrice || 0) + (formData.not_included_price || 0)
                          const infantTotalPrice = newPrice + (formData.not_included_price || 0)
                          // 상품 가격 총합 계산 (불포함 가격 포함)
                          const newProductPriceTotal = (adultTotalPrice * formData.pricingAdults) + 
                                                       (childTotalPrice * formData.child) + 
                                                       (infantTotalPrice * formData.infant)
                          setFormData({ 
                            ...formData, 
                            infantProductPrice: newPrice,
                            productPriceTotal: newProductPriceTotal
                          })
                        }}
                        className={`w-12 px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 ${priceTextClass('infantProductPrice')}`}
                        step="0.01"
                        placeholder="0"
                      />
                      <span className="text-gray-500">x{formData.infant}</span>
                      <span className="font-medium">${((formData.infantProductPrice || 0) * formData.infant).toFixed(2)}</span>
                    </div>
                  </div>
                </>
              )}
              <div className="border-t pt-1 flex justify-between items-center">
                <span className="text-sm font-medium text-gray-900">상품 가격 합계</span>
                <span className="text-sm font-bold text-blue-600">
                  ${(() => {
                    // 판매가 + 불포함 가격 = 상품 가격 합계
                    const salePriceTotal = formData.productPriceTotal || 0
                    const notIncludedTotal = notIncludedBreakdown.totalUsd
                    return (salePriceTotal + notIncludedTotal).toFixed(2)
                  })()}
                </span>
              </div>
            </div>
          </div>

          {/* 초이스 - OTA 채널일 때는 숨김 */}
          {!isOTAChannel && (
          <div className="bg-white p-3 rounded border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-900">초이스</h4>
              {formData.productChoices?.length > 0 && Object.keys(formData.selectedChoices || {}).length > 0 && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                  자동입력됨
                </span>
              )}
            </div>
            <div className="space-y-2">
              {formData.productChoices?.map((choice) => {
                const selectedChoiceId = formData.selectedChoices[choice.id]?.selected
                if (!selectedChoiceId) return null
                
                const selectedOption = choice.options?.find((opt: { id: string; name: string; adult_price?: number }) => opt.id === selectedChoiceId)
                if (!selectedOption) return null
                
                return (
                  <div key={choice.id} className="border border-gray-200 rounded p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700">{choice.name}</span>
                      <span className="text-xs text-gray-500">{selectedOption.name}</span>
                    </div>
                    
                    {/* 가격 표시 */}
                    <div className={isSinglePrice ? "grid grid-cols-1 gap-2 text-xs" : "grid grid-cols-3 gap-2 text-xs"}>
                      <div>
                        <label className="block text-gray-600 mb-1">성인</label>
                        <input
                          type="number"
                          value={selectedOption.adult_price || 0}
                          readOnly
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-gray-50"
                          step="0.01"
                        />
                        <div className="text-xs text-gray-500 mt-1">
                          총: ${((selectedOption.adult_price || 0) * formData.pricingAdults).toFixed(2)}
                        </div>
                      </div>
                      {!isSinglePrice && (
                        <>
                          <div>
                            <label className="block text-gray-600 mb-1">아동</label>
                            <input
                              type="number"
                              value={selectedOption.child_price || 0}
                              readOnly
                              className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-gray-50"
                              step="0.01"
                            />
                            <div className="text-xs text-gray-500 mt-1">
                              총: ${((selectedOption.child_price || 0) * formData.child).toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <label className="block text-gray-600 mb-1">유아</label>
                            <input
                              type="number"
                              value={selectedOption.infant_price || 0}
                              readOnly
                              className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-gray-50"
                              step="0.01"
                            />
                            <div className="text-xs text-gray-500 mt-1">
                              총: ${((selectedOption.infant_price || 0) * formData.infant).toFixed(2)}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
              
              {(!formData.productChoices || formData.productChoices.length === 0) && (
                <div className="text-center py-2 text-gray-500 text-xs">
                  상품 선택 시 표시
                </div>
              )}
            </div>
          </div>
          )}

          {/* 할인 및 추가 비용 입력 */}
          <div className="bg-white p-3 rounded border border-gray-200">
            <h4 className="text-sm font-medium text-gray-900 mb-2">할인/추가비용</h4>
            <div className="space-y-2">
              {/* 쿠폰 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600">쿠폰</label>
                    <button
                      type="button"
                      onClick={autoSelectCoupon}
                      disabled={hasDbReservationPricingRow}
                      className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                      title={
                        hasDbReservationPricingRow
                          ? '예약에 저장된 가격(reservation_pricing)이 있을 때는 자동 선택을 사용할 수 없습니다'
                          : '상품, 채널, 날짜에 맞는 쿠폰 자동 선택'
                      }
                    >
                      자동 선택
                    </button>
                  </div>
                  {formData.couponCode && (
                    <div className="text-xs text-red-600 font-medium">
                      -${formData.couponDiscount.toFixed(2)}
                    </div>
                  )}
                </div>
                <select
                  value={formData.couponCode}
                  onChange={(e) => {
                    onCouponDropdownUserInput?.()
                    markPricingEdited('couponDiscount', 'totalPrice', 'onSiteBalanceAmount')
                    const selectedCouponCode = e.target.value
                    const notIncludedPrice = notIncludedBreakdown.totalUsd
                    setFormData((prev: typeof formData) => {
                      const t = selectedCouponCode.trim()
                      if (!t) {
                        return { ...prev, couponCode: '', couponDiscount: 0 }
                      }
                      const chNameOn = (id: string | null | undefined) => {
                        if (!id || !Array.isArray(channels)) return ''
                        const row = channels.find((c) => c.id === id)
                        return String(row?.name || '').toLowerCase()
                      }
                      const gyFam = (n: string) =>
                        n.includes('getyourguide') || n.includes('get your guide')
                      const showAllGyCouponsOn = gyFam(chNameOn(prev.channelId))
                      const filteredCoupons = coupons.filter((coupon) => {
                        if (
                          showAllGyCouponsOn &&
                          coupon.channel_id &&
                          gyFam(chNameOn(coupon.channel_id))
                        ) {
                          return true
                        }
                        return (
                          !prev.channelId ||
                          !coupon.channel_id ||
                          coupon.channel_id === prev.channelId ||
                          (!isOTAChannel && homepageChannelId && coupon.channel_id === homepageChannelId)
                        )
                      })
                      const selectedCoupon = filteredCoupons.find(coupon => 
                        coupon.coupon_code && 
                        coupon.coupon_code.trim().toLowerCase() === selectedCouponCode.trim().toLowerCase()
                      )
                      const subtotal = isOTAChannel 
                        ? prev.productPriceTotal - notIncludedPrice
                        : calculateProductPriceTotal() + calculateChoiceTotal() - notIncludedPrice
                      // coupons 마스터에 없는 저장 코드만 재선택 시 금액 유지
                      if (
                        !selectedCoupon &&
                        t.toLowerCase() === (prev.couponCode || '').trim().toLowerCase()
                      ) {
                        return prev
                      }
                      const couponDiscount = calculateCouponDiscount(selectedCoupon, subtotal)
                      return {
                        ...prev,
                        couponCode: selectedCoupon?.coupon_code || '',
                        couponDiscount,
                      }
                    })
                  }}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">쿠폰 선택</option>
                  {couponsForSelectOptions.map((coupon) => {
                      let discountText = '할인 정보 없음'
                      if (coupon.discount_type === 'percentage' && coupon.percentage_value) {
                        discountText = `${coupon.percentage_value}%`
                      } else if (coupon.discount_type === 'fixed' && coupon.fixed_value) {
                        discountText = `$${coupon.fixed_value}`
                      } else if (coupon.id === '__saved_coupon_not_in_master__') {
                        discountText = '저장된 코드'
                      }
                      
                      return (
                        <option key={coupon.id} value={coupon.coupon_code || ''}>
                          {coupon.coupon_code} ({discountText})
                        </option>
                      )
                    })}
                </select>
                {/* 선택된 쿠폰 정보 표시 */}
                {formData.couponCode && (() => {
                  const selectedCoupon = coupons.find(c => 
                    c.coupon_code && 
                    c.coupon_code.trim().toLowerCase() === formData.couponCode.trim().toLowerCase()
                  )
                  if (selectedCoupon) {
                    return (
                      <div className="mt-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                        선택된 쿠폰: {selectedCoupon.coupon_code} (할인: ${formData.couponDiscount.toFixed(2)})
                      </div>
                    )
                  }
                  return (
                    <div className="mt-1 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
                      저장/입력 코드: {formData.couponCode} (할인: ${formData.couponDiscount.toFixed(2)}, 쿠폰 마스터에 없음)
                    </div>
                  )
                })()}
              </div>

              {/* 추가 할인 및 비용 */}
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">추가할인</label>
                  <div className="relative">
                    <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                    <input
                      type="number"
                      value={formData.additionalDiscount}
                      onChange={(e) => {
                        markPricingEdited('additionalDiscount', 'totalPrice', 'onSiteBalanceAmount')
                        setFormData({ ...formData, additionalDiscount: Number(e.target.value) || 0 })
                      }}
                      className="w-full pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      step="0.01"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">추가비용</label>
                  <div className="relative">
                    <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                    <input
                      type="number"
                      value={formData.additionalCost}
                      onChange={(e) => {
                        markPricingEdited('additionalCost', 'totalPrice', 'onSiteBalanceAmount')
                        setFormData({ ...formData, additionalCost: Number(e.target.value) || 0 })
                      }}
                      className="w-full pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      step="0.01"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">세금</label>
                  <div className="relative">
                    <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                    <input
                      type="number"
                      value={formData.tax}
                      onChange={(e) => {
                        markPricingEdited('tax', 'totalPrice', 'onSiteBalanceAmount')
                        setFormData({ ...formData, tax: Number(e.target.value) || 0 })
                      }}
                      className="w-full pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      step="0.01"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">카드수수료</label>
                  <div className="relative">
                    <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                    <input
                      type="number"
                      value={formData.cardFee}
                      onChange={(e) => {
                        markPricingEdited('cardFee', 'totalPrice', 'onSiteBalanceAmount')
                        const raw = e.target.value
                        const nextVal =
                          raw === '' ? 0 : Number.isFinite(Number(raw)) ? Number(raw) : null
                        setFormData((prev: typeof formData) => ({
                          ...prev,
                          cardFee: nextVal === null ? prev.cardFee : nextVal,
                        }))
                      }}
                      className="w-full pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      step="0.01"
                    />
                  </div>
                </div>
              </div>

                             {/* 선결제 비용 */}
               <div className="border-t pt-2 mt-2">
                 <div className="grid grid-cols-2 gap-1">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">선결제 지출</label>
                    <div className="relative">
                      <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                      <input
                        type="number"
                        value={formData.prepaymentCost}
                        onChange={(e) => {
                          markPricingEdited('prepaymentCost', 'totalPrice', 'onSiteBalanceAmount')
                          setFormData({ ...formData, prepaymentCost: Number(e.target.value) || 0 })
                        }}
                        className="w-full pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                        step="0.01"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">선결제 팁</label>
                    <div className="relative">
                      <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                      <input
                        type="number"
                        value={formData.prepaymentTip}
                        onChange={(e) => {
                          markPricingEdited('prepaymentTip', 'totalPrice', 'onSiteBalanceAmount')
                          setFormData({ ...formData, prepaymentTip: Number(e.target.value) || 0 })
                        }}
                        className="w-full pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                        step="0.01"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 환불 입력 */}
          <div className="bg-white p-3 rounded border border-gray-200">
            <h4 className="text-sm font-medium text-gray-900 mb-2">환불</h4>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-gray-600 mb-0.5">
                  {isKorean ? '투어 환불 금액' : 'Tour refund amount'}
                </label>
                <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1 mb-1 leading-snug">
                  {isKorean
                    ? '예약 옵션 취소·환불 금액은 여기에 넣지 마세요. 옵션은 예약 옵션에서 상태를 바꾸면 ④ 최종 매출의 환불 입력 합에 따로 포함됩니다.'
                    : 'Do not enter option cancellation refunds here. Mark options cancelled/refunded under Reservation options; section 4 adds them to the entered refund total.'}
                </p>
                <div className="relative">
                  <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                  <input
                    type="number"
                    value={formData.refundAmount ?? 0}
                    onChange={(e) => {
                      markPricingEdited('refundAmount', 'totalPrice', 'onSiteBalanceAmount')
                      setFormData({ ...formData, refundAmount: Number(e.target.value) || 0 })
                    }}
                    className="w-full pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">환불 이유</label>
                <textarea
                  value={formData.refundReason ?? ''}
                  onChange={(e) => setFormData({ ...formData, refundReason: e.target.value })}
                  rows={3}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                  placeholder="예: 일정 변경, 고객 취소"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 오른쪽 열: 가격 계산 - 2/3 너비 */}
        <div className="md:col-span-2">
          <div className="bg-white p-3 rounded border border-gray-200 h-full">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-gray-900">가격 계산</h4>
              <button
                type="button"
                onClick={() => setShowHelp(true)}
                className="px-1.5 py-0.5 text-[10px] border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
              >
                계산 안내
              </button>
            </div>

            {/* 1️⃣ 고객 기준 결제 흐름 (Customer View) */}
            <div className="mb-4 pb-3 border-b-2 border-gray-300">
              <div className="flex items-center mb-2">
                <span className="text-base mr-1.5">1️⃣</span>
                <h5 
                  className="text-xs font-semibold text-gray-800 cursor-help" 
                  title="👉 고객이 얼마를 부담했는지만 보여주는 영역"
                >
                  고객 기준 결제 흐름
                </h5>
                <span className="ml-1.5 text-[10px] text-gray-500">(Customer View)</span>
              </div>
              
              {/* 기본 가격 (OTA 판매가) */}
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-gray-700">{isKorean ? 'OTA 판매가' : 'OTA Sale Price'}</span>
                <span className={`text-xs font-medium ${priceTextClass('productPriceTotal')}`}>
                  ${(() => {
                    // OTA 판매가 = productPriceTotal (판매가 * 인원, 불포함 가격 제외)
                    // productPriceTotal은 이미 판매가만 포함하고 있음
                    return formData.productPriceTotal.toFixed(2)
                  })()}
                </span>
              </div>
              
              {/* 쿠폰 할인 */}
              {formData.couponDiscount > 0 && (
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] text-gray-600">{isKorean ? '- 쿠폰 할인' : '- Coupon Discount'}</span>
                  <span className={`text-[10px] text-green-600 ${priceTextClass('couponDiscount')}`}>-${formData.couponDiscount.toFixed(2)}</span>
                </div>
              )}
              
              <div className="border-t border-gray-200 my-1.5"></div>
              
              {/* 할인 후 상품가 (계산값) */}
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-gray-700">{isKorean ? '할인 후 상품가' : 'Discounted Product Price'}</span>
                <span className={`text-xs font-medium ${priceTextClass('')}`}>
                  ${(() => {
                    // 할인 후 상품가 = OTA 판매가 - 쿠폰 할인 - 추가 할인
                    const discountedPrice = formData.productPriceTotal - formData.couponDiscount - formData.additionalDiscount
                    return discountedPrice.toFixed(2)
                  })()}
                </span>
              </div>
              
              {/* 예약 옵션 — 취소 후에도 부과·정산 이력과 ① 총액을 맞추기 위해 표시 */}
              {reservationOptionsTotalPrice > 0 && (
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] text-gray-600">{isKorean ? '+ 예약 옵션' : '+ Reservation options'}</span>
                  <span className="text-[10px] text-gray-700">+${reservationOptionsTotalPrice.toFixed(2)}</span>
                </div>
              )}
              
              <div className="border-t border-gray-200 my-1.5"></div>
              
              {/* 불포함 가격 (입장권 + 비거주자 비용 분리 표기) — 취소 예약은 징수 없음 */}
              {(() => {
                if (isReservationCancelled) return null
                const { baseUsd, residentFeesUsd, totalUsd } = notIncludedBreakdown
                if (totalUsd <= 0) return null
                return (
                  <>
                    {baseUsd > 0 && (
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[10px] text-gray-600">
                          {isKorean
                            ? '+ 불포함 가격 (입장권)'
                            : '+ Not included (admission tickets)'}
                        </span>
                        <span className={`text-[10px] text-gray-700 ${priceTextClass('not_included_price')}`}>
                          +${baseUsd.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {residentFeesUsd > 0 && (
                      <div className="flex justify-between items-center mb-1.5 pl-2">
                        <span className="text-[10px] text-gray-600">
                          {isKorean ? '+ 비거주자 비용' : '+ Non-resident fees'}
                        </span>
                        <span className={`text-[10px] text-gray-700 ${priceTextClass('not_included_price')}`}>
                          +${residentFeesUsd.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </>
                )
              })()}
              
              {/* 추가 할인 */}
              {(formData.additionalDiscount || 0) > 0 && (
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] text-gray-600">{isKorean ? '- 추가 할인' : '- Additional Discount'}</span>
                  <span className={`text-[10px] text-red-600 ${priceTextClass('additionalDiscount')}`}>-${(formData.additionalDiscount || 0).toFixed(2)}</span>
                </div>
              )}
              
              {/* 추가 비용 */}
              {(formData.additionalCost || 0) > 0 && (
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] text-gray-600">{isKorean ? '+ 추가 비용' : '+ Additional Cost'}</span>
                  <span className={`text-[10px] text-gray-700 ${priceTextClass('additionalCost')}`}>+${(formData.additionalCost || 0).toFixed(2)}</span>
                </div>
              )}

              {manualRefundAmount > 0 && (
                <div className="flex justify-between items-center mb-1.5 rounded px-1.5 py-1 bg-red-50 border border-red-100">
                  <span
                    className="text-[10px] text-red-800 cursor-help"
                    title={
                      formData.refundReason?.trim() ||
                      (isKorean
                        ? '직접 입력한 투어·상품 환불 금액입니다. 옵션 취소분은 포함하지 않습니다.'
                        : 'Tour/product refund entered here. Option cancellations are excluded.')
                    }
                  >
                    {isKorean ? '− 투어 환불' : '− Tour refund'}
                    {formData.refundReason?.trim() ? `: ${formData.refundReason.trim()}` : ''}
                  </span>
                  <span className={`text-[10px] font-semibold text-red-700 ${priceTextClass('refundAmount')}`}>
                    −${manualRefundAmount.toFixed(2)}
                  </span>
                </div>
              )}
              
              {/* 세금 */}
              {(formData.tax || 0) > 0 && (
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] text-gray-600">{isKorean ? '+ 세금' : '+ Tax'}</span>
                  <span className={`text-[10px] text-gray-700 ${priceTextClass('tax')}`}>+${(formData.tax || 0).toFixed(2)}</span>
                </div>
              )}
              
              {/* 카드 수수료 */}
              {(formData.cardFee || 0) > 0 && (
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] text-gray-600">{isKorean ? '+ 카드 수수료' : '+ Card Fee'}</span>
                  <span className={`text-[10px] text-gray-700 ${priceTextClass('cardFee')}`}>+${(formData.cardFee || 0).toFixed(2)}</span>
                </div>
              )}
              
              {/* 선결제 지출 */}
              {(formData.prepaymentCost || 0) > 0 && (
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] text-gray-600">{isKorean ? '+ 선결제 지출' : '+ Prepaid Expenses'}</span>
                  <span className={`text-[10px] text-gray-700 ${priceTextClass('prepaymentCost')}`}>+${(formData.prepaymentCost || 0).toFixed(2)}</span>
                </div>
              )}
              
              {/* 선결제 팁 */}
              {(formData.prepaymentTip || 0) > 0 && (
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] text-gray-600">{isKorean ? '+ 선결제 팁' : '+ Prepaid Tips'}</span>
                  <span className={`text-[10px] text-gray-700 ${priceTextClass('prepaymentTip')}`}>+${(formData.prepaymentTip || 0).toFixed(2)}</span>
                </div>
              )}

              {returnedSurplusOverManualTourRefund > 0.005 && (
                <div className="flex justify-between items-center mb-1.5 rounded px-1.5 py-1 bg-amber-50 border border-amber-100">
                  <span
                    className="text-[10px] text-amber-900 cursor-help"
                    title={
                      isKorean
                        ? '입금 Returned 중, 위「투어 환불」입력 금액을 초과하는 부분만 총액에 추가로 반영합니다. (같은 $면 중복 차감하지 않음)'
                        : 'Only the Returned amount exceeding the tour refund field is applied to the total (no double count when they match).'
                    }
                  >
                    {isKorean ? '− Returned (파트너, 추가분)' : '− Returned (partner, surplus)'}
                  </span>
                  <span className="text-[10px] font-semibold text-amber-900">
                    −${returnedSurplusOverManualTourRefund.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="border-t border-gray-200 my-1.5"></div>
              
              {/* 고객 총 결제: 진행 예약은 산식, 취소 건은 DB total_price(폼 totalPrice) 직접 수정 가능 */}
              <div className="flex justify-between items-center mb-1.5">
                <span
                  className="text-sm font-bold text-blue-800 cursor-help"
                  title={
                    isReservationCancelled
                      ? isKorean
                        ? '취소 건: 저장 총액(total_price)을 직접 입력합니다. 전액 환불 후 0으로 두면 저장 시 DB에도 0이 반영됩니다.'
                        : 'Cancelled: edit stored total (total_price). Use 0 after full refund to persist zero.'
                      : isKorean
                        ? '투어 환불 입력을 뺀 뒤, 입금 Returned 중 그보다 큰 금액만 한 번 더 뺍니다. 같은 금액이면 중복 차감하지 않습니다.'
                        : 'After tour refund field, only Returned in excess of that amount is subtracted again (no double count when equal).'
                  }
                >
                  {isKorean ? '고객 총 결제 금액' : 'Total Customer Payment'}
                </span>
                {isReservationCancelled ? (
                  <div className="flex flex-col items-end gap-0.5 max-w-[11rem]">
                    <div className="relative w-full">
                      <span className="absolute left-1 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
                      <input
                        type="number"
                        className={`w-full pl-4 pr-1 py-0.5 text-sm font-bold border border-gray-300 rounded text-right ${priceTextClass('totalPrice')}`}
                        step="0.01"
                        min="0"
                        value={formData.totalPrice ?? 0}
                        onChange={(e) => {
                          markPricingEdited('totalPrice', 'onSiteBalanceAmount', 'balanceAmount')
                          setFormData((prev: typeof formData) => ({
                            ...prev,
                            totalPrice: Math.max(0, Number(e.target.value) || 0),
                          }))
                        }}
                      />
                    </div>
                    <span className="text-[9px] text-gray-500 text-right leading-tight">
                      {isKorean
                        ? `산식 참고 $${calculateTotalCustomerPayment().toFixed(2)}`
                        : `Formula ref $${calculateTotalCustomerPayment().toFixed(2)}`}
                    </span>
                  </div>
                ) : (
                  <span className={`text-sm font-bold ${priceTextClass('totalPrice')}`}>
                    ${effectiveTotalCustomerPayment().toFixed(2)}
                  </span>
                )}
              </div>
              {isExistingPricingLoaded && reservationPricingId && pricingDbSnapshot != null && (
                <div className="mt-1.5 rounded border border-slate-200 bg-slate-50/90 px-2 py-1.5 text-[10px] leading-snug text-slate-700">
                  <div className="flex justify-between gap-2">
                    <span className="shrink-0 text-slate-600">
                      {isKorean ? 'DB total_price (로드 시)' : 'DB total_price (at load)'}
                    </span>
                    <span className="font-mono tabular-nums">
                      ${(Number(pricingDbSnapshot.total_price) || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 border-t border-slate-200/80 pt-1 mt-1">
                    <span className="shrink-0 text-slate-600">
                      {isKorean ? '① 화면 계산' : '① Calculated'}
                    </span>
                    <span className="font-mono tabular-nums">${effectiveTotalCustomerPayment().toFixed(2)}</span>
                  </div>
                  {Math.abs(
                    (Number(pricingDbSnapshot.total_price) || 0) - effectiveTotalCustomerPayment()
                  ) > 0.02 && (
                    <p className="mt-1 text-amber-800">
                      {isKorean
                        ? '위 두 값이 다르면, 저장 시 예약 폼 로직으로 DB 총액이 갱신됩니다.'
                        : 'If these differ, saving updates DB totals via the reservation form rules.'}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* 2️⃣ 고객 실제 지불 내역 (Payment Status) */}
            <div className="mb-4 pb-3 border-b-2 border-gray-300">
              <div className="flex items-center mb-2">
                <span className="text-base mr-1.5">2️⃣</span>
                <h5 
                  className="text-xs font-semibold text-gray-800 cursor-help" 
                  title="👉 지금 실제로 얼마 냈는지"
                >
                  고객 실제 지불 내역
                </h5>
                <span className="ml-1.5 text-[10px] text-gray-500">(Payment Status)</span>
              </div>

              {/* 총 결제 예정 금액 = ① 고객 총 결제 금액과 동일 */}
              <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-100">
                <span
                  className="text-xs font-semibold text-gray-900"
                  title={
                    isKorean
                      ? '①과 동일. 잔액 = 이 금액 − (보증금 + 잔금 수령)'
                      : 'Same as ①. Balance = this − (deposit + balance received)'
                  }
                >
                  {isKorean ? '총 결제 예정 금액' : 'Total Payment Due'}
                </span>
                <span className={`text-xs font-bold text-blue-700 ${priceTextClass('totalPrice')}`}>
                  ${effectiveTotalCustomerPayment().toFixed(2)}
                </span>
              </div>
              
              {/* 고객 실제 지불액 (보증금) — 입금 동기화 시 보증금 버킷 합(파트너 수령 등). 환불 라인은 별도 표시 */}
              <div className="flex justify-between items-center mb-1.5">
                <span
                  className="text-xs text-gray-700 cursor-help"
                  title={
                    isKorean
                      ? '입금 내역이 있으면: 보증금(Partner Received·보증금 수령 등) 버킷 합계가 여기에 맞춰집니다. Refunded·Returned는 아래 줄에 따로 표시됩니다.'
                      : 'With payment records: deposit matches the sum of deposit-bucket lines (Partner Received, etc.). Refunded and Returned are shown below.'
                  }
                >
                  {isKorean ? '고객 실제 지불액 (보증금)' : 'Customer Payment (Deposit)'}
                </span>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                    <input
                      type="number"
                      value={formData.depositAmount}
                      onChange={(e) => {
                        depositAmountUserEditedRef.current = true
                        markPricingEdited('depositAmount', 'onSiteBalanceAmount', 'balanceAmount')
                        const newDepositAmount = Number(e.target.value) || 0
                        const totalCustomerPayment = effectiveTotalCustomerPayment()
                        const manualRef = Math.max(0, Number(formData.refundAmount) || 0)
                        const depForDue = depositAmountNetOfPartnerReturnedOverlap(
                          totalCustomerPayment,
                          newDepositAmount
                        )
                        const totalPaid = computeEffectiveCustomerPaidTowardDue(
                          totalCustomerPayment,
                          depForDue,
                          calculatedBalanceReceivedTotal,
                          refundedAmount,
                          manualRef
                        )
                        const calculatedBalance = roundUsd2(totalCustomerPayment - totalPaid)
                        setFormData((prev: typeof formData) => ({
                          ...prev,
                          depositAmount: newDepositAmount,
                          onSiteBalanceAmount: calculatedBalance,
                          balanceAmount: calculatedBalance,
                        }))
                      }}
                      className={`w-24 pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-right ${priceTextClass('depositAmount')}`}
                      step="0.01"
                      min="0"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              {/* 잔금 수령 — 보증금 다음, 환불 라인보다 앞 */}
              {calculatedBalanceReceivedTotal > 0 && (
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs text-gray-700">{isKorean ? '잔금 수령' : 'Balance Received'}</span>
                  <span className={`text-xs font-medium text-green-600 ${priceTextClass('')}`}>
                    ${calculatedBalanceReceivedTotal.toFixed(2)}
                  </span>
                </div>
              )}

              {/* 입금 내역상 환불(Refunded) */}
              {refundedAmount > 0.005 && (
                <div className="flex justify-between items-center mb-1.5">
                  <span
                    className="text-xs text-gray-700 cursor-help"
                    title={
                      isKorean
                        ? '입금 내역 중 Refunded 상태 합계입니다. 잔액·지불 합계는 이 금액을 반영해 계산합니다.'
                        : 'Sum of Refunded lines on payment records. Balance and paid-toward-due use this when matching totals.'
                    }
                  >
                    {isKorean ? '− 입금 환불 (Refunded)' : '− Refunded (payment records)'}
                  </span>
                  <span className="text-xs font-medium text-red-600 tabular-nums">
                    −${refundedAmount.toFixed(2)}
                  </span>
                </div>
              )}
              {returnedAmount > 0.005 && (
                <div className="flex justify-between items-center mb-1.5">
                  <span
                    className="text-xs text-gray-700 cursor-help"
                    title={
                      isKorean
                        ? '입금 내역 중 파트너 환불(Returned) 합계입니다. 잔액·총액 정합 시 파트너 수령과 함께 반영됩니다.'
                        : 'Sum of partner Returned lines. Reconciled with Partner Received when computing balance and paid-toward-due.'
                    }
                  >
                    {isKorean ? '− 파트너 환불 (Returned)' : '− Returned (partner)'}
                  </span>
                  <span className="text-xs font-medium text-amber-800 tabular-nums">
                    −${(Number(returnedAmount) || 0).toFixed(2)}
                  </span>
                </div>
              )}
              
              {/* 잔액: ① − 입금 순효과(보증금 버킷 − Refunded·Returned 반영) − 잔금 수령 */}
              <div className="flex justify-between items-center mb-1.5">
                <span
                  className="text-xs text-gray-700 cursor-help"
                  title={
                    isKorean
                      ? '총 결제(①)에서 입금 순효과(Refunded·Returned 반영된 보증금 기여)와 잔금 수령을 반영한 잔액입니다. 위 보증금 칸은 파트너 수령 등 총액입니다.'
                      : 'Remaining after ① minus the net deposit effect (after Refunded/Returned) and balance received. The deposit field above is the gross bucket total.'
                  }
                >
                  {isKorean ? '잔액 (투어 당일 지불)' : 'Remaining Balance (On-site)'}
                </span>
                <div className="relative">
                  <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                  <input
                    type="number"
                    value={isOnSiteBalanceAmountFocused ? onSiteBalanceAmountInput : displayedOnSiteBalance().toFixed(2)}
                    onChange={(e) => {
                      const inputValue = e.target.value
                      setOnSiteBalanceAmountInput(inputValue)
                      const newBalance = Number(inputValue) || 0
                      markPricingEdited('onSiteBalanceAmount', 'balanceAmount')
                      setFormData({ ...formData, onSiteBalanceAmount: newBalance, balanceAmount: newBalance })
                    }}
                    onFocus={() => {
                      setIsOnSiteBalanceAmountFocused(true)
                      setOnSiteBalanceAmountInput(displayedOnSiteBalance().toString())
                    }}
                    onBlur={() => {
                      setIsOnSiteBalanceAmountFocused(false)
                      const finalValue = parseFloat(parseFloat(onSiteBalanceAmountInput || '0').toFixed(2))
                      markPricingEdited('onSiteBalanceAmount', 'balanceAmount')
                      setFormData({ ...formData, onSiteBalanceAmount: finalValue, balanceAmount: finalValue })
                    }}
                    className={`w-24 pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-right ${priceTextClass('onSiteBalanceAmount')}`}
                    step="0.01"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* 3️⃣ 채널 정산 기준 (Channel / OTA View) */}
            <div className="mb-4 pb-3 border-b-2 border-gray-300">
              <div className="flex items-center mb-2">
                <span className="text-base mr-1.5">3️⃣</span>
                <h5 
                  className="text-xs font-semibold text-gray-800 cursor-help" 
                  title="👉 플랫폼에서 얼마를 가져가고, 얼마를 보내줬는지"
                >
                  채널 정산 기준
                </h5>
                <span className="ml-1.5 text-[10px] text-gray-500">(Channel / OTA View)</span>
              </div>
              {isReservationCancelled && isOTAChannel && (
                <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1 mb-2 leading-snug">
                  {isKorean
                    ? '취소 후에도 플랫폼이 부분 정산·입금한 경우: 반영된 판매가·채널 결제 금액·수수료 %/$를 실제 입금에 맞게 입력하세요.'
                    : 'After cancel, if the platform still pays out: enter the adjusted sale price, channel payment, and commission to match the deposit.'}
                </p>
              )}
              
              {/* 채널 결제 금액 — 보조 산식 왼쪽, 입력란 오른쪽 끝 */}
              <div className="flex justify-between items-center mb-1.5 gap-2">
                <span
                  className="text-xs font-medium text-gray-700 shrink-0 cursor-help"
                  title={
                    !isOTAChannel && isKorean
                      ? '자체·파트너 채널: ③ 정산 기준 금액은 ① 고객 총 결제 금액과 같습니다.'
                      : !isOTAChannel
                        ? 'Self/partner channel: section ③ uses the same amount as ① total customer payment.'
                        : undefined
                  }
                >
                  {isOTAChannel
                    ? isKorean
                      ? '채널 결제 금액'
                      : 'Channel Payment Amount'
                    : isKorean
                      ? '고객 총 결제 금액'
                      : 'Total Customer Payment'}
                </span>
                <div className="flex items-center justify-end gap-x-2 gap-y-1 flex-wrap flex-1 min-w-0">
                  <span className="text-xs text-gray-500">:</span>
                  {isOTAChannel &&
                    (returnedAmount > 0.005 || manualRefundAmount > 0.005) && (
                      <span className="text-xs text-gray-500">
                        ($
                        {roundUsd2(
                          channelPaymentAmountAfterReturn +
                            Math.max(Number(returnedAmount) || 0, manualRefundAmount)
                        ).toFixed(2)}{' '}
                        − $
                        {Math.max(Number(returnedAmount) || 0, manualRefundAmount).toFixed(2)}) = $
                        {channelPaymentAmountAfterReturn.toFixed(2)}
                      </span>
                    )}
                  {!isOTAChannel && (
                    <span className="text-xs text-gray-500 tabular-nums">
                      {isKorean ? '①과 동일' : 'Same as ①'} · $
                      {effectiveTotalCustomerPayment().toFixed(2)}
                    </span>
                  )}
                  {formData.prepaymentTip > 0 && isOTAChannel && (
                    <span className="text-xs text-gray-500">
                      (+ 팁 ${formData.prepaymentTip.toFixed(2)}) = $
                      {Math.max(
                        0,
                        (channelPaymentGrossDb ||
                          (() => {
                            const notIncludedPrice = notIncludedBreakdown.totalUsd
                            const discountedPrice =
                              formData.productPriceTotal -
                              formData.couponDiscount -
                              formData.additionalDiscount -
                              notIncludedPrice
                            return discountedPrice > 0 ? discountedPrice : 0
                          })()) -
                          returnedAmount +
                          formData.prepaymentTip
                      ).toFixed(2)}
                    </span>
                  )}
                  <div className="relative shrink-0 ml-auto">
                    <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                    <input
                      type="number"
                      value={
                        isChannelPaymentAmountFocused
                          ? channelPaymentAmountInput
                          : channelPaymentAmountAfterReturn.toFixed(2)
                      }
                      onChange={(e) => {
                        const inputValue = e.target.value
                        if (isOTAChannel) {
                          otaChannelPaymentUserEditedRef.current = true
                        } else {
                          nonOtaChannelPaymentUserEditedRef.current = true
                          nonOtaChannelPaymentStopProductAutoSyncRef.current = true
                        }
                        setChannelPaymentAmountInput(inputValue)
                        markPricingEdited('onlinePaymentAmount', 'commission_base_price', 'commission_amount', 'channel_settlement_amount')

                        const trimmed = inputValue.trim()
                        if (trimmed === '' || trimmed === '-') {
                          return
                        }
                        const parsed = Number(trimmed)
                        if (!Number.isFinite(parsed)) {
                          return
                        }
                        const numValue = Math.max(0, parsed)
                        // Returned를 고려한 실제 금액
                        const actualAmount = numValue + returnedAmount
                        
                        if (isOTAChannel) {
                          const adjustedBasePrice = numValue
                          const commissionPercent = formData.commission_percent || channelCommissionPercent || 0
                          const calculatedCommission =
                            adjustedBasePrice > 0 && commissionPercent > 0
                              ? Math.round(adjustedBasePrice * (commissionPercent / 100) * 100) / 100
                              : 0
                          otaCommissionAutoFingerprintRef.current = otaCommissionFeeFingerprint(
                            adjustedBasePrice,
                            commissionPercent
                          )
                          isCardFeeManuallyEdited.current = false
                          setFormData((prev: typeof formData) => ({
                            ...stripChannelSettlementUnlessLocked(prev),
                            onlinePaymentAmount: actualAmount,
                            commission_base_price: numValue,
                            commission_amount: calculatedCommission,
                          }))
                        } else {
                          setFormData((prev: typeof formData) => ({
                            ...stripChannelSettlementUnlessLocked(prev),
                            onlinePaymentAmount: actualAmount,
                            commission_base_price: actualAmount,
                          }))
                        }
                      }}
                      onFocus={() => {
                        channelPaymentAmountFieldFocusedRef.current = true
                        setIsChannelPaymentAmountFocused(true)
                        setChannelPaymentAmountInput(channelPaymentAmountAfterReturn.toString())
                      }}
                      onBlur={() => {
                        channelPaymentAmountFieldFocusedRef.current = false
                        setIsChannelPaymentAmountFocused(false)
                        markPricingEdited('onlinePaymentAmount', 'commission_base_price', 'commission_amount', 'channel_settlement_amount')
                        const trimmed = channelPaymentAmountInput.trim()
                        if (trimmed === '' || trimmed === '-') {
                          setChannelPaymentAmountInput('')
                          return
                        }
                        const parsedBlur = Number(trimmed)
                        if (!Number.isFinite(parsedBlur)) {
                          setChannelPaymentAmountInput('')
                          return
                        }
                        const finalValue = Math.max(0, parsedBlur)
                        const actualAmount = finalValue + returnedAmount
                        
                        if (isOTAChannel) {
                          const adjustedBasePrice = finalValue
                          const commissionPercent = formData.commission_percent || channelCommissionPercent || 0
                          const calculatedCommission =
                            adjustedBasePrice > 0 && commissionPercent > 0
                              ? Math.round(adjustedBasePrice * (commissionPercent / 100) * 100) / 100
                              : 0
                          otaCommissionAutoFingerprintRef.current = otaCommissionFeeFingerprint(
                            adjustedBasePrice,
                            commissionPercent
                          )
                          isCardFeeManuallyEdited.current = false
                          setFormData((prev: typeof formData) => ({
                            ...stripChannelSettlementUnlessLocked(prev),
                            onlinePaymentAmount: actualAmount,
                            commission_base_price: finalValue,
                            commission_amount: calculatedCommission,
                          }))
                        } else {
                          nonOtaChannelPaymentUserEditedRef.current = true
                          nonOtaChannelPaymentStopProductAutoSyncRef.current = true
                          setFormData((prev: typeof formData) => ({
                            ...stripChannelSettlementUnlessLocked(prev),
                            onlinePaymentAmount: actualAmount,
                            commission_base_price: actualAmount,
                          }))
                        }
                        
                        setChannelPaymentAmountInput('')
                      }}
                      className={`w-24 pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-right ${priceTextClass('onlinePaymentAmount')}`}
                      step="0.01"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
              
              {/* 채널 수수료 (커미션) / 카드 수수료 (자체 채널) */}
              {isOTAChannel ? (
                <div className="space-y-2 mb-2">
                  {/* 채널 수수료 % */}
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-700 inline-flex flex-wrap items-baseline gap-x-1 gap-y-0">
                      <span>{isKorean ? '채널 수수료 %' : 'Channel Commission %'}</span>
                      {formData.channelId && selectedChannel ? (
                        <span className="text-[10px] font-normal text-gray-500 tabular-nums">
                          {isKorean
                            ? `(채널 정보 ${channelCommissionPercent}%)`
                            : `(channel ${channelCommissionPercent}%)`}
                        </span>
                      ) : null}
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">x</span>
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          value={formData.commission_percent ?? channelCommissionPercent ?? 0}
                          title={
                            isReservationCancelled
                              ? isKorean
                                ? '취소 후에도 플랫폼이 부분 정산하면 실제 채널 결제·수수료를 입력하세요.'
                                : 'If the platform still settles after cancel, enter channel payment and fee.'
                              : undefined
                          }
                          onChange={(e) => {
                            const percent = Number(e.target.value) || 0
                            markPricingEdited('commission_percent', 'commission_amount', 'channel_settlement_amount')
                            const basePrice = formData.commission_base_price !== undefined 
                              ? formData.commission_base_price 
                              : (formData.onlinePaymentAmount || (() => {
                                  // 할인 후 상품가 계산 (불포함 가격 제외)
                                  const notIncludedPrice = notIncludedBreakdown.totalUsd
                                  const discountedPrice = formData.productPriceTotal - formData.couponDiscount - formData.additionalDiscount - notIncludedPrice
                                  return discountedPrice > 0 ? discountedPrice : formData.subtotal
                                })())
                            const adjustedBasePrice =
                              isReservationCancelled
                                ? Math.max(
                                    0,
                                    Number(formData.commission_base_price) || channelPaymentAmountAfterReturn || 0
                                  )
                                : Math.max(0, basePrice - returnedAmount)
                            const calculatedAmount =
                              adjustedBasePrice > 0 && percent > 0
                                ? Math.round(adjustedBasePrice * (percent / 100) * 100) / 100
                                : 0
                            isCardFeeManuallyEdited.current = false
                            otaCommissionAutoFingerprintRef.current = otaCommissionFeeFingerprint(
                              adjustedBasePrice,
                              percent
                            )
                            setFormData((prev: typeof formData) => ({
                              ...stripChannelSettlementUnlessLocked(prev),
                              commission_percent: percent,
                              commission_amount: calculatedAmount,
                            }))
                          }}
                          className="w-16 px-1 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-right"
                          step="0.01"
                          min="0"
                          max="100"
                          placeholder={channelCommissionPercent > 0 ? channelCommissionPercent.toString() : "0"}
                        />
                        <span className="text-xs text-gray-500">%</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* 구분선 */}
                  <div className="border-t border-gray-200 my-2"></div>
                  
                  {/* 채널 수수료 $ */}
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-700">
                      {isKorean ? '채널 수수료 $' : 'Channel Commission $'}
                    </span>
                    <div className="relative">
                      <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">$</span>
                      <input
                        type="number"
                        value={isCommissionAmountFocused ? commissionAmountInput : effectiveCommissionAmount.toFixed(2)}
                        title={
                          isReservationCancelled
                            ? isKorean
                              ? '플랫폼이 차감한 수수료 금액을 입력하세요.'
                              : 'Enter the commission retained by the platform.'
                            : undefined
                        }
                        onChange={(e) => {
                          const inputValue = e.target.value
                          setCommissionAmountInput(inputValue)
                          const newAmount = Number(inputValue) || 0
                          isCardFeeManuallyEdited.current = true
                          markPricingEdited('commission_amount', 'channel_settlement_amount')
                          console.log('PricingSection: commission_amount 수동 입력:', newAmount)
                          setFormData((prev: typeof formData) => ({
                            ...stripChannelSettlementUnlessLocked(prev),
                            commission_amount: newAmount,
                          }))
                        }}
                        onFocus={() => {
                          setIsCommissionAmountFocused(true)
                          setCommissionAmountInput(formData.commission_amount !== undefined && formData.commission_amount !== null ? formData.commission_amount.toString() : '0')
                        }}
                        onBlur={() => {
                          setIsCommissionAmountFocused(false)
                          const finalAmount = Number(commissionAmountInput) || formData.commission_amount || 0
                          isCardFeeManuallyEdited.current = true
                          markPricingEdited('commission_amount', 'channel_settlement_amount')
                          setFormData((prev: typeof formData) => ({
                            ...stripChannelSettlementUnlessLocked(prev),
                            commission_amount: finalAmount,
                          }))
                          setCommissionAmountInput('')
                        }}
                        className={`w-24 pl-5 pr-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-right ${priceTextClass('commission_amount')}`}
                        step="0.01"
                        min="0"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* 자체 채널: 카드 수수료 % */}
                  <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-gray-700">
                        {isKorean ? '카드 수수료 %' : 'Card Processing Fee %'}
                      </span>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500">x</span>
                        <div className="flex items-center space-x-1">
                          <input
                            type="number"
                            value={formData.commission_percent ?? 2.9}
                            onChange={(e) => {
                              markPricingEdited('commission_percent', 'channel_settlement_amount')
                              const newPercent = Number(e.target.value) || 0
                              setFormData((prev: typeof formData) => ({
                                ...stripChannelSettlementUnlessLocked(prev),
                                commission_percent: newPercent,
                              }))
                            }}
                            className="w-24 pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-right"
                            step="0.01"
                            min="0"
                            max="100"
                            placeholder="2.9"
                          />
                          <span className="text-xs text-gray-500">%</span>
                        </div>
                      </div>
                  </div>

                  {/* 구분선 */}
                  <div className="border-t border-gray-200 my-2"></div>
                  
                  {/* 자체 채널: 카드 수수료 $ */}
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-700">
                      {isKorean ? '카드 수수료 $' : 'Card Processing Fee $'}
                    </span>
                    <div className="flex items-center space-x-2">
                      <div className="relative">
                        <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">$</span>
                        <input
                          type="number"
                          value={isCommissionAmountFocused ? commissionAmountInput : effectiveCommissionAmount.toFixed(2)}
                          readOnly={isReservationCancelled}
                          title={isReservationCancelled ? (isKorean ? '취소된 예약은 카드/채널 수수료 정산이 없습니다.' : 'No processing fee for cancelled reservations.') : undefined}
                          onChange={(e) => {
                            if (isReservationCancelled) return
                            const inputValue = e.target.value
                            setCommissionAmountInput(inputValue)
                            const newAmount = Number(inputValue) || 0
                            isCardFeeManuallyEdited.current = true
                          markPricingEdited('commission_amount', 'channel_settlement_amount')
                            setFormData((prev: typeof formData) => ({
                              ...stripChannelSettlementUnlessLocked(prev),
                              commission_amount: newAmount,
                            }))
                          }}
                          onFocus={() => {
                            setIsCommissionAmountFocused(true)
                            setCommissionAmountInput(formData.commission_amount !== undefined && formData.commission_amount !== null ? formData.commission_amount.toString() : '0')
                          }}
                          onBlur={() => {
                            setIsCommissionAmountFocused(false)
                            const finalAmount = Number(commissionAmountInput) || formData.commission_amount || 0
                            isCardFeeManuallyEdited.current = true
                          markPricingEdited('commission_amount', 'channel_settlement_amount')
                            setFormData((prev: typeof formData) => ({
                              ...stripChannelSettlementUnlessLocked(prev),
                              commission_amount: finalAmount,
                            }))
                            setCommissionAmountInput('')
                          }}
                          className={`w-24 pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-right ${priceTextClass('commission_amount')} ${isReservationCancelled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                          step="0.01"
                          min="0"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
              
              {/* 구분선: 카드 수수료 $ / 채널 수수료 $ 와 채널 정산 금액 사이 */}
              <div className="border-t border-gray-200 my-1.5"></div>
              {/* 채널 정산 금액 — 직접 입력(비우고 블러 시 자동 산식으로 복귀) */}
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-bold text-gray-700">
                  {isKorean ? '채널 정산 금액' : 'Channel Settlement Amount'}
                </span>
                <div className="relative">
                  <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                  <input
                    type="number"
                    value={
                      isChannelSettlementAmountFocused
                        ? channelSettlementAmountInput
                        : channelSettlementBeforePartnerReturn.toFixed(2)
                    }
                    onChange={(e) => {
                      const inputValue = e.target.value
                      setChannelSettlementAmountInput(inputValue)
                      const n = Number(inputValue)
                      if (inputValue === '' || inputValue === '-') return
                      if (Number.isFinite(n)) {
                        channelSettlementUserEditedRef.current = true
                        markPricingEdited('channel_settlement_amount')
                        setFormData((prev: typeof formData) => ({
                          ...prev,
                          channelSettlementAmount: n,
                        }))
                        onChannelSettlementEdited?.()
                      }
                    }}
                    onFocus={() => {
                      setIsChannelSettlementAmountFocused(true)
                      setChannelSettlementAmountInput(channelSettlementBeforePartnerReturn.toString())
                    }}
                    onBlur={() => {
                      setIsChannelSettlementAmountFocused(false)
                      const raw = channelSettlementAmountInput.trim()
                      if (raw === '') {
                        channelSettlementUserEditedRef.current = false
                        markPricingEdited('channel_settlement_amount')
                        setFormData((prev: typeof formData) => omitChannelSettlementAmount({ ...prev }))
                      } else {
                        const finalValue = roundUsd2(Number(raw) || 0)
                        channelSettlementUserEditedRef.current = true
                        markPricingEdited('channel_settlement_amount')
                        setFormData((prev: typeof formData) => ({
                          ...prev,
                          channelSettlementAmount: finalValue,
                        }))
                        onChannelSettlementEdited?.()
                      }
                      setChannelSettlementAmountInput('')
                    }}
                    className={`w-24 pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-right ${priceTextClass('channel_settlement_amount')}`}
                    step="0.01"
                    placeholder="0"
                  />
                </div>
              </div>
              <p className="text-[10px] text-gray-500 mt-0.5">✔️ 이 금액은 회사 계좌로 들어오는 돈 | ✔️ 고객 추가 현금, 잔금, 팁 포함 ❌</p>
            </div>

            {/* 4️⃣ 최종 매출 & 운영 이익 (Company View) */}
            <div className="mb-3">
              <div className="flex items-center mb-2">
                <span className="text-base mr-1.5">4️⃣</span>
                <h5 
                  className="text-xs font-semibold text-gray-800 cursor-help" 
                  title="👉 회사 기준 실제 수익 구조"
                >
                  최종 매출 & 운영 이익
                </h5>
                <span className="ml-1.5 text-[10px] text-gray-500">(Company View)</span>
              </div>

              <div className="rounded-lg border border-gray-200/90 bg-gradient-to-b from-slate-50 to-slate-100/80 p-3 shadow-sm">
                {companyViewRevenueLedger.lines.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    {isKorean ? '표시할 항목이 없습니다.' : 'No line items.'}
                  </p>
                ) : (
                  <div
                    className="grid gap-y-2 font-mono text-xs tabular-nums"
                    style={{ gridTemplateColumns: '1.5rem minmax(0, 1fr) auto' }}
                  >
                    {companyViewRevenueLedger.lines.map((row, idx) => (
                      <div key={idx} className="contents">
                        <span
                          className={`text-center text-sm font-bold leading-none ${
                            row.sign === '+' ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {row.sign}
                        </span>
                        <span className="min-w-0 pr-2 leading-snug text-gray-800 inline-flex items-center gap-1">
                          {isKorean ? row.labelKo : row.labelEn}
                          {row.sign === '-' &&
                            (row.labelEn === 'Refund (deducted from revenue)' ||
                              row.labelKo === '환불 (총매출 차감)') && (
                              <span
                                className="inline-flex shrink-0 cursor-help text-gray-400 hover:text-gray-600"
                                title={companyViewRefundHoverTooltip}
                                aria-label={companyViewRefundHoverTooltip}
                              >
                                <HelpCircle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                              </span>
                            )}
                        </span>
                        <span
                          className={`text-right text-sm font-semibold whitespace-nowrap ${
                            row.sign === '+' ? 'text-gray-900' : 'text-red-700'
                          }`}
                        >
                          {row.sign === '+'
                            ? `+$${row.amount.toFixed(2)}`
                            : `−$${row.amount.toFixed(2)}`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {(refundedAmount > 0.005 ||
                  manualRefundAmount > 0.005 ||
                  optionCancelRefundUsd > 0.005 ||
                  unpaidRefundOutstanding > 0.005) && (
                  <div className="mt-3 rounded-lg border border-red-100/90 bg-white/70 px-2.5 py-2 shadow-inner">
                    {(optionCancelRefundUsd > 0.005 || manualRefundAmount > 0.005) && (
                    <div className="flex flex-col divide-y divide-gray-200/90 text-xs text-gray-800">
                      {optionCancelRefundUsd > 0.005 && (
                        <div
                          className="grid gap-y-1.5 pb-2.5"
                          style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}
                        >
                          <span className="leading-snug text-gray-700">
                            {isKorean ? '옵션 입금 (받은 금액)' : 'Option amount received'}
                          </span>
                          <span className="text-right font-mono font-semibold tabular-nums text-emerald-700">
                            +$
                            {(
                              calculatedBalanceReceivedTotal > 0.005
                                ? calculatedBalanceReceivedTotal
                                : optionCancelRefundUsd
                            ).toFixed(2)}
                          </span>
                          <span className="leading-snug text-gray-700 inline-flex min-w-0 flex-wrap items-center gap-1">
                            {isKorean ? '옵션 취소' : 'Option cancelled'}
                            {reservationOptionsTotalPrice <= 0.005 && (
                              <span
                                className="inline-flex shrink-0 cursor-help items-center gap-0.5 rounded border border-gray-200/80 bg-gray-50/80 px-1 py-px text-[10px] font-medium text-gray-500"
                                title={
                                  isKorean
                                    ? '※ 채널 매출과 별도이며, 이번 건 ④ 차감액에는 포함되지 않습니다.'
                                    : 'Separate from channel line; not in ④ deduction this case.'
                                }
                                aria-label={
                                  isKorean
                                    ? '※ 채널 매출과 별도이며, 이번 건 ④ 차감액에는 포함되지 않습니다.'
                                    : 'Separate from channel line; not in ④ deduction this case.'
                                }
                              >
                                <HelpCircle className="h-3 w-3 shrink-0 text-gray-400" aria-hidden />
                                {isKorean ? '안내' : 'Note'}
                              </span>
                            )}
                          </span>
                          <span className="text-right font-mono font-semibold tabular-nums text-red-700">
                            −${optionCancelRefundUsd.toFixed(2)}
                          </span>
                          {reservationOptionsTotalPrice > 0.005 && (
                            <>
                              <span className="col-span-2 -mx-0.5 border-t border-dashed border-gray-200/90" />
                              <span className="col-span-2 text-[11px] leading-snug text-gray-500">
                                {isKorean
                                  ? '※ 예약 옵션 매출(+줄)과 연동된 금액입니다.'
                                  : 'Linked to ④ options (+ line).'}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                      {manualRefundAmount > 0.005 && (
                        <div
                          className="grid gap-y-1.5 py-2.5"
                          style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}
                        >
                          <span className="leading-snug text-gray-700">
                            {isKorean ? '투어 상품 환불 (수동 입력)' : 'Tour refund (manual)'}
                          </span>
                          <span className="text-right font-mono font-semibold tabular-nums text-red-700">
                            −${manualRefundAmount.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {manualRefundAmount > 0.005 &&
                        isReservationCancelled &&
                        !isOTAChannel &&
                        (Number(formData.depositAmount) || 0) > 0.005 && (
                          <div className="pt-2.5 text-[11px] leading-snug text-gray-600">
                            {isKorean ? (
                              <>
                                <span className="font-medium text-gray-700">④ 총매출 참고:</span> 고객 결제(보증금) $
                                {(Number(formData.depositAmount) || 0).toFixed(2)} − 투어 환불(수동) $
                                {manualRefundAmount.toFixed(2)} ={' '}
                                <span className="font-semibold text-gray-900 tabular-nums">
                                  $
                                  {roundUsd2(
                                    Math.max(0, Number(formData.depositAmount) || 0) - manualRefundAmount
                                  ).toFixed(2)}
                                </span>
                                . 취소·자체 채널은 이 금액이 ③ 채널 정산 net과 같으면 위 ④ 합계와 맞습니다.
                              </>
                            ) : (
                              <>
                                <span className="font-medium text-gray-700">For ④ revenue:</span> customer paid
                                (deposit) ${(Number(formData.depositAmount) || 0).toFixed(2)} − tour refund (manual) $
                                {manualRefundAmount.toFixed(2)} ={' '}
                                <span className="font-semibold text-gray-900 tabular-nums">
                                  $
                                  {roundUsd2(
                                    Math.max(0, Number(formData.depositAmount) || 0) - manualRefundAmount
                                  ).toFixed(2)}
                                </span>
                                . Cancelled direct bookings: when this matches ③ channel settlement net, section ④
                                totals align.
                              </>
                            )}
                          </div>
                        )}
                    </div>
                    )}
                    {unpaidRefundOutstanding > 0.005 && (
                      <div className="mt-2 rounded bg-amber-50/90 px-2 py-1 text-[11px] font-medium text-amber-900">
                        {isKorean
                          ? `미지급 환불(추정) 약 $${unpaidRefundOutstanding.toFixed(2)}`
                          : `Outstanding refund ~$${unpaidRefundOutstanding.toFixed(2)}`}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-2.5 flex items-baseline justify-between gap-2 border-t-2 border-dashed border-gray-300 pt-2">
                  <span className="text-xs font-bold text-gray-900">
                    = {isKorean ? '총 매출' : 'Total revenue'}
                  </span>
                  <span className="text-base font-bold text-green-700">
                    ${companyViewRevenueLedger.totalRevenue.toFixed(2)}
                  </span>
                </div>

                {formData.prepaymentTip > 0.005 && (
                  <div className="mt-1.5 flex items-baseline justify-between gap-2 text-xs text-gray-800">
                    <span className="flex min-w-0 items-baseline gap-1">
                      <span className="w-5 shrink-0 text-center text-sm font-bold text-red-600">
                        −
                      </span>
                      <span className="leading-snug">
                        {isKorean ? '선결제 팁 (수익 제외)' : 'Prepaid tips (excl. revenue)'}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono font-semibold text-red-700 tabular-nums">
                      −${(Number(formData.prepaymentTip) || 0).toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="mt-2 flex items-baseline justify-between gap-2 border-t border-gray-300 pt-2">
                  <span className="text-sm font-bold text-purple-900">
                    = {isKorean ? '운영 이익' : 'Operating profit'}
                  </span>
                  <span className="text-base font-bold text-purple-600">
                    ${companyViewRevenueLedger.operatingProfit.toFixed(2)}
                  </span>
                </div>
                {isExistingPricingLoaded && reservationPricingId && pricingDbSnapshot != null && (
                  <div className="mt-2 rounded border border-emerald-200/80 bg-white/80 px-2 py-1.5 text-[10px] leading-snug text-gray-700">
                    <div className="font-medium text-gray-800 mb-1">
                      {isKorean ? 'DB 저장 스냅샷 (로드 시)' : 'DB snapshot (at load)'}
                    </div>
                    {pricingDbSnapshot.company_total_revenue != null && (
                      <div className="flex justify-between gap-2">
                        <span className="text-gray-600 shrink-0">company_total_revenue</span>
                        <span className="font-mono tabular-nums">
                          ${(Number(pricingDbSnapshot.company_total_revenue) || 0).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {pricingDbSnapshot.operating_profit != null && (
                      <div className="flex justify-between gap-2 mt-0.5">
                        <span className="text-gray-600 shrink-0">operating_profit</span>
                        <span className="font-mono tabular-nums">
                          ${(Number(pricingDbSnapshot.operating_profit) || 0).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {((pricingDbSnapshot.company_total_revenue != null &&
                      Math.abs(
                        (Number(pricingDbSnapshot.company_total_revenue) || 0) -
                          companyViewRevenueLedger.totalRevenue
                      ) > 0.02) ||
                      (pricingDbSnapshot.operating_profit != null &&
                        Math.abs(
                          (Number(pricingDbSnapshot.operating_profit) || 0) -
                            companyViewRevenueLedger.operatingProfit
                        ) > 0.02)) ? (
                      <p className="mt-1 text-amber-800">
                        {isKorean
                          ? '저장된 매출·이익과 위 계산(④)이 다릅니다. 예약 저장 시 DB 값이 다시 계산되어 갱신됩니다.'
                          : 'Stored revenue/profit differs from ④ above; saving the reservation recomputes DB columns.'}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 정산 섹션 - 예약이 있을 때만 표시 */}
      {reservationId && (
        <div className="mt-4">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-1.5">
                <Calculator className="h-4 w-4 text-blue-600" />
                <h4 className="text-sm font-semibold text-blue-900">정산 정보</h4>
              </div>
              <div className="flex items-center space-x-2">
                {loadingExpenses && (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-xs text-blue-600">지출 조회 중...</span>
                  </div>
                )}
                <button
                  onClick={() => {
                    void fetchReservationExpenses()
                    void fetchTourExpenses()
                  }}
                  disabled={loadingExpenses}
                  className="p-1 text-blue-600 hover:text-blue-800 disabled:opacity-50"
                  title="지출 정보 새로고침"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingExpenses ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
            
            {(() => {
              const product = products.find(p => p.id === formData.productId)
              const subCategory = product?.sub_category || ''
              const isManiaTour = subCategory === 'Mania Tour' || subCategory === 'Mania Service'
              const showTourCol = isManiaTour && tourExpenseAllocationEligible
              const gridClass = showTourCol ? 'md:grid-cols-5' : 'md:grid-cols-4'
              const ledgerTr = companyViewRevenueLedger.totalRevenue
              const ledgerOp = companyViewRevenueLedger.operatingProfit

              return (
                <div className={`grid grid-cols-1 gap-3 ${gridClass}`}>
                  {/* 총 매출 — ④와 동일 */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setExpandedSettlementCard((prev) => (prev === 'total-revenue' ? null : 'total-revenue'))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setExpandedSettlementCard((prev) => (prev === 'total-revenue' ? null : 'total-revenue'))
                      }
                    }}
                    className="group bg-white p-3 rounded-lg border border-emerald-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer md:cursor-default"
                  >
                    <div className="flex items-center space-x-1.5 mb-1">
                      <TrendingUp className="h-3 w-3 text-emerald-600" />
                      <div className="text-xs font-medium text-gray-700">{isKorean ? '총 매출' : 'Total revenue'}</div>
                    </div>
                    <div className="text-base font-bold text-emerald-700 mb-0.5">${ledgerTr.toFixed(2)}</div>
                    <div
                      className={`text-[10px] text-gray-500 ${expandedSettlementCard === 'total-revenue' ? 'block' : 'hidden'} md:block md:opacity-0 md:group-hover:opacity-100 md:transition-opacity`}
                    >
                      {isKorean ? '④ 최종 매출과 동일' : 'Same as section ④ total revenue'}
                    </div>
                  </div>

                  {/* 운영 이익 — ④와 동일 */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setExpandedSettlementCard((prev) => (prev === 'operating-profit' ? null : 'operating-profit'))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setExpandedSettlementCard((prev) =>
                          prev === 'operating-profit' ? null : 'operating-profit'
                        )
                      }
                    }}
                    className="group bg-white p-3 rounded-lg border border-purple-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer md:cursor-default"
                  >
                    <div className="flex items-center space-x-1.5 mb-1">
                      <DollarSign className="h-3 w-3 text-purple-600" />
                      <div className="text-xs font-medium text-gray-700">{isKorean ? '운영 이익' : 'Operating profit'}</div>
                    </div>
                    <div className="text-base font-bold text-purple-600 mb-0.5">${ledgerOp.toFixed(2)}</div>
                    <div
                      className={`text-[10px] text-gray-500 ${expandedSettlementCard === 'operating-profit' ? 'block' : 'hidden'} md:block md:opacity-0 md:group-hover:opacity-100 md:transition-opacity`}
                    >
                      {isKorean ? '④ 운영 이익과 동일' : 'Same as section ④ operating profit'}
                    </div>
                  </div>

                  {/* 예약 지출 총합 */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setExpandedSettlementCard((prev) =>
                        prev === 'reservation-expenses' ? null : 'reservation-expenses'
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setExpandedSettlementCard((prev) =>
                          prev === 'reservation-expenses' ? null : 'reservation-expenses'
                        )
                      }
                    }}
                    className="group bg-white p-3 rounded-lg border border-red-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer md:cursor-default"
                  >
                    <div className="flex items-center space-x-1.5 mb-1">
                      <AlertCircle className="h-3 w-3 text-red-500" />
                      <div className="text-xs font-medium text-gray-700">예약 지출 총합</div>
                    </div>
                    <div className="text-base font-bold text-red-600 mb-0.5">
                      ${reservationExpensesTotal.toFixed(2)}
                    </div>
                    <div
                      className={`text-[10px] text-gray-500 ${expandedSettlementCard === 'reservation-expenses' ? 'block' : 'hidden'} md:block md:opacity-0 md:group-hover:opacity-100 md:transition-opacity`}
                    >
                      승인/대기/기타 지출 (거부 제외)
                    </div>
                  </div>

                  {showTourCol && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        setExpandedSettlementCard((prev) => (prev === 'tour-expenses' ? null : 'tour-expenses'))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setExpandedSettlementCard((prev) => (prev === 'tour-expenses' ? null : 'tour-expenses'))
                        }
                      }}
                      className="group bg-white p-3 rounded-lg border border-orange-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer md:cursor-default"
                    >
                      <div className="flex items-center space-x-1.5 mb-1">
                        {loadingTourExpenses ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-orange-500" />
                        ) : (
                          <AlertCircle className="h-3 w-3 text-orange-500" />
                        )}
                        <div className="text-xs font-medium text-gray-700">투어 지출 총합</div>
                      </div>
                      <div className="text-base font-bold text-orange-600 mb-0.5">
                        ${tourExpensesTotal.toFixed(2)}
                      </div>
                      <div
                        className={`text-[10px] text-gray-500 ${expandedSettlementCard === 'tour-expenses' ? 'block' : 'hidden'} md:block md:opacity-0 md:group-hover:opacity-100 md:transition-opacity`}
                      >
                        {isKorean
                          ? 'tours.reservation_ids에 이 예약이 있을 때만 배분'
                          : 'Allocated only when this reservation is on the tour roster'}
                      </div>
                    </div>
                  )}

                  {/* 수익: ④ 운영이익 − 예약·투어 지출 */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedSettlementCard((prev) => (prev === 'profit' ? null : 'profit'))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setExpandedSettlementCard((prev) => (prev === 'profit' ? null : 'profit'))
                      }
                    }}
                    className="group bg-white p-3 rounded-lg border border-green-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer md:cursor-default"
                  >
                    <div className="flex items-center space-x-1.5 mb-1">
                      {calculateProfit() >= 0 ? (
                        <TrendingUp className="h-3 w-3 text-green-500" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-500" />
                      )}
                      <div className="text-xs font-medium text-gray-700">수익</div>
                    </div>
                    <div
                      className={`text-base font-bold mb-0.5 ${calculateProfit() >= 0 ? 'text-green-600' : 'text-red-600'}`}
                    >
                      ${calculateProfit().toFixed(2)}
                    </div>
                    <div
                      className={`text-[10px] text-gray-500 ${expandedSettlementCard === 'profit' ? 'block' : 'hidden'} md:block md:opacity-0 md:group-hover:opacity-100 md:transition-opacity`}
                    >
                      {isKorean
                        ? `운영 이익 − 예약 지출${showTourCol ? ' − 투어 지출' : ''}`
                        : `Operating profit − reservation${showTourCol ? ' − tour' : ''} expenses`}
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* 수익률 표시 + 수익 발생 뱃지 */}
            <div className="mt-3 pt-3 border-t border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-medium text-gray-700">수익률</span>
                    {calculateProfit() >= 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-500" />
                    )}
                  </div>
                  {calculateProfit() >= 0 ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-800">
                      수익 발생
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-800">
                      손실 발생
                    </span>
                  )}
                </div>
                <span className={`text-base font-bold ${calculateProfit() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {companyViewRevenueLedger.totalRevenue > 0.005
                    ? ((calculateProfit() / companyViewRevenueLedger.totalRevenue) * 100).toFixed(1)
                    : '0.0'}
                  %
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setShowHelp(false)}></div>
          <div className="relative bg-white w-full max-w-2xl max-h-[80vh] rounded-lg shadow-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">가격 계산 안내</h3>
              <button className="text-gray-400 hover:text-gray-600" onClick={() => setShowHelp(false)}>✕</button>
            </div>
            <div className="p-4 overflow-y-auto text-sm text-gray-800 space-y-3">
              <div>
                <div className="font-semibold text-gray-900 mb-1">1) 판매가 구성</div>
                <p>상품가(성인/아동/유아 단가×인원) + 초이스 합계 = 소계(Subtotal)</p>
              </div>
              <div>
                <div className="font-semibold text-gray-900 mb-1">2) 할인 적용</div>
                <p>소계에서 쿠폰 할인 + 추가 할인 차감</p>
              </div>
              <div>
                <div className="font-semibold text-gray-900 mb-1">3) 추가 비용</div>
                <p>추가비용, 세금, 카드수수료, 단독투어 추가비, 선결제 비용/팁, 옵션 합계 가산</p>
              </div>
              <div>
                <div className="font-semibold text-gray-900 mb-1">4) 총 판매가</div>
                <p>2단계 결과 + 3단계 결과</p>
              </div>
              <div>
                <div className="font-semibold text-gray-900 mb-1">5) 분할 결제(해당 채널일 때)</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>OTA 판매가: 고객이 OTA에서 결제한 금액</li>
                  <li>커미션 금액 = OTA 판매가 × 커미션%</li>
                  <li>Net = OTA 판매가 − 커미션 금액</li>
                  <li>balance: 현장 수금 잔액</li>
                  <li>고객 실제 지불액 = OTA 판매가 + balance</li>
                </ul>
              </div>
              <div>
                <div className="font-semibold text-gray-900 mb-1">6) 용어 간단 설명</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>소계: 상품가와 초이스만 더한 중간합</li>
                  <li>총 판매가: 모든 할인과 추가비용을 반영한 고객 기준 최종금액</li>
                  <li>커미션: OTA 수수료(퍼센트 기준)</li>
                  <li>Net: 커미션 차감 후 우리 측에 귀속되는 금액</li>
                  <li>보증금/잔액: 선결제·현장 수금 분배</li>
                </ul>
              </div>
              <div>
                <div className="font-semibold text-gray-900 mb-1">7) 저장 매핑</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>commission_percent, commission_amount 저장</li>
                  <li>deposit_amount = OTA 판매가, balance_amount = balance</li>
                  <li>total_price = 고객 실제 지불액</li>
                </ul>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 text-right">
              <button className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700" onClick={() => setShowHelp(false)}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
