'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Calculator, DollarSign, TrendingUp, TrendingDown, AlertCircle, RefreshCw } from 'lucide-react'
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
import {
  computeChannelSettlementAmount,
  deriveCommissionGrossForSettlement,
} from '@/utils/channelSettlement'

function roundUsd2(n: number): number {
  return Math.round(n * 100) / 100
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

/**
 * UI·합계용: 기존 불포함(base)과 비거주 비용을 분리 표시.
 * choiceNotIncludedBaseTotal은 dynamic 계산에서 비거주를 더하기 전 값(신뢰 소스).
 */
function splitNotIncludedForDisplay(
  choiceNotIncludedTotal: number,
  choiceNotIncludedBaseTotal: number,
  notIncludedPerPerson: number,
  adults: number,
  child: number,
  infant: number,
  residentStatusAmounts?: Record<string, number>
): { baseUsd: number; residentFeesUsd: number; totalUsd: number } {
  const pax = (adults || 0) + (child || 0) + (infant || 0)
  const fieldTotal = (notIncludedPerPerson || 0) * pax
  const residentFeesUsd = sumResidentFeeAmountsUsd(residentStatusAmounts)

  const fromSubtract =
    choiceNotIncludedTotal > 0
      ? Math.max(0, roundUsd2(choiceNotIncludedTotal - residentFeesUsd))
      : 0

  // 입장권 등 기본 불포함: 계산기 base, (총액−비거주), 인당 불포함 필드×인원 중 큰 값
  const baseUsd = roundUsd2(
    Math.max(choiceNotIncludedBaseTotal, fromSubtract, fieldTotal)
  )

  const totalUsd =
    choiceNotIncludedTotal > 0
      ? Math.max(choiceNotIncludedTotal, roundUsd2(baseUsd + residentFeesUsd))
      : roundUsd2(baseUsd + residentFeesUsd)

  return {
    baseUsd,
    residentFeesUsd,
    totalUsd: roundUsd2(totalUsd),
  }
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
  expenseUpdateTrigger?: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFormData: (data: any) => void
  savePricingInfo: (reservationId: string, overrides?: { depositAmount?: number; balanceAmount?: number }) => Promise<void>
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
  isExistingPricingLoaded?: boolean
  /** DB에서 불러온 필드면 검은색, 계산값이면 빨간색 표시 */
  pricingFieldsFromDb?: Record<string, boolean>
  /** 동적가격 로드·정산 연쇄 계산 중이면 숫자 대신 오버레이 (깜빡임 완화) */
  priceCalculationPending?: boolean
  /** 사용자가 채널 정산 금액을 직접 수정하면 DB 출처 표시(검정)를 끔 */
  onChannelSettlementEdited?: () => void
}

export default function PricingSection({
  formData,
  setFormData,
  savePricingInfo,
  calculateProductPriceTotal,
  calculateChoiceTotal,
  calculateCouponDiscount,
  coupons,
  autoSelectCoupon,
  onCouponDropdownUserInput,
  reservationOptionsTotalPrice = 0,
  isExistingPricingLoaded,
  pricingFieldsFromDb = {},
  priceCalculationPending = false,
  onChannelSettlementEdited,
  reservationId,
  reservationPricingId,
  expenseUpdateTrigger,
  channels = [],
  products = [],
  t
}: PricingSectionProps) {
  const locale = useLocale()
  const isKorean = locale === 'ko'
  /** DB 값 = 검은색, 계산값 = 빨간색 */
  const priceTextClass = (field: string) => (pricingFieldsFromDb[field] ? 'text-gray-900' : 'text-red-600')
  /** reservation_pricing에 commission_base_price(채널 결제 net)가 있으면 상품가·보증금 effect로 덮어쓰지 않음 */
  const channelPaymentLoadedFromDb = Boolean(
    pricingFieldsFromDb.onlinePaymentAmount || pricingFieldsFromDb.commission_base_price
  )
  const [showHelp, setShowHelp] = useState(false)
  const [reservationExpensesTotal, setReservationExpensesTotal] = useState(0)
  const [loadingExpenses, setLoadingExpenses] = useState(false)
  const [tourExpensesTotal, setTourExpensesTotal] = useState(0)
  const [loadingTourExpenses, setLoadingTourExpenses] = useState(false)
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
  /** OTA: 마지막 자동 수수료 $ 기준(수수료 산출 base × %) — 이 키가 바뀌면 $를 다시 계산 */
  const otaCommissionAutoFingerprintRef = useRef<string>('')
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

  // fetchPaymentRecords 등에서 formData/channels 의존 루프 방지용 (항상 최신 참조)
  useEffect(() => {
    otaCommissionAutoFingerprintRef.current = ''
    otaChannelPaymentUserEditedRef.current = false
  }, [reservationId])

  /** 상품가·할인·인원이 바뀌면 OTA 채널 결제 자동 동기화를 다시 허용 */
  useEffect(() => {
    otaChannelPaymentUserEditedRef.current = false
  }, [
    formData.productPriceTotal,
    formData.couponDiscount,
    formData.additionalDiscount,
    formData.pricingAdults,
    formData.child,
    formData.infant,
  ])

  const formDataRef = useRef(formData)
  formDataRef.current = formData
  const channelsRef = useRef(channels)
  channelsRef.current = channels
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

      console.log('PricingSection: 예약 지출 조회 결과:', { data, error })

      if (error) {
        console.error('예약 지출 조회 오류:', error)
        setReservationExpensesTotal(0)
        return
      }

      const total = data?.reduce((sum: number, expense: { amount: number | null }) => sum + (expense.amount || 0), 0) || 0
      console.log('PricingSection: 계산된 지출 총합:', total, '개별 지출:', data?.map((e: { id: string; amount: number | null; paid_for: string | null; status: string | null }) => ({ id: e.id, amount: e.amount || 0, paid_for: e.paid_for || '', status: e.status || '' })))
      setReservationExpensesTotal(total)
    } catch (error) {
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
      return
    }

    // 상품의 sub_category 확인
    const product = products.find(p => p.id === formData.productId)
    const subCategory = product?.sub_category || ''
    const isManiaTour = subCategory === 'Mania Tour' || subCategory === 'Mania Service'
    
    if (!isManiaTour) {
      setTourExpensesTotal(0)
      return
    }

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
        const msg = String((reservationError as any)?.message ?? '')
        if (!msg.includes('AbortError') && !msg.includes('aborted')) {
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
          const msg = String((tourByIdError as any)?.message ?? '')
          if (!msg.includes('AbortError') && !msg.includes('aborted')) {
            console.error('tour_id로 투어 조회 오류:', tourByIdError)
          }
        } else if (tourById) {
          tourData = tourById
          console.log('PricingSection: reservations.tour_id로 투어 찾음:', tourData.id)
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
          const msg = String((toursError as any)?.message ?? '')
          if (!msg.includes('AbortError') && !msg.includes('aborted')) {
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
          const reservationIds = tour.reservation_ids
          if (reservationIds) {
            // 배열인 경우
            if (Array.isArray(reservationIds)) {
              const ids = reservationIds.map(id => String(id).trim())
              if (ids.includes(String(reservationId).trim())) {
                tourData = tour
                console.log('PricingSection: reservation_ids 배열에서 투어 찾음:', tourData.id)
                break
              }
            }
            // 문자열인 경우 (쉼표로 구분)
            else if (typeof reservationIds === 'string') {
              const ids = reservationIds.split(',').map(id => id.trim()).filter(id => id)
              if (ids.includes(String(reservationId).trim())) {
                tourData = tour
                console.log('PricingSection: reservation_ids 문자열에서 투어 찾음:', tourData.id)
                break
              }
            }
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
        const errMsg = String((expensesError as any)?.message ?? '')
        if (!errMsg.includes('AbortError') && !errMsg.includes('aborted') && !errMsg.includes('signal is aborted')) {
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
        console.error('입장권 부킹 조회 오류:', ticketBookingsError)
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
        console.error('호텔 부킹 조회 오류:', hotelBookingsError)
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
      const reservationIds = (tourData as any).reservation_ids
      if (reservationIds && Array.isArray(reservationIds) && reservationIds.length > 0) {
        const { data: reservationsData, error: reservationsError } = await supabase
          .from('reservations')
          .select('total_people')
          .in('id', reservationIds)

        if (reservationsError && (reservationsError.message || reservationsError.code || Object.keys(reservationsError).length > 0)) {
          console.error('예약 인원수 조회 오류:', reservationsError)
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

      setTourExpensesTotal(tourExpensesForReservation)
    } catch (error) {
      console.error('투어 지출 조회 중 예외 발생:', error)
      setTourExpensesTotal(0)
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
    const optionsTotal = cancelled ? 0 : reservationOptionsTotalPrice || 0
    const notIncludedPrice = cancelled ? 0 : notIncludedBreakdown.totalUsd
    const additionalCost = formData.additionalCost || 0
    const tax = formData.tax || 0
    const cardFee = formData.cardFee || 0
    const prepaymentCost = formData.prepaymentCost || 0
    const prepaymentTip = formData.prepaymentTip || 0
    // 초이스 판매 총액(choiceTotal/choicesTotal)은 불포함 금액과 이중 계산되므로 합산하지 않음
    return discountedProductPrice + optionsTotal + notIncludedPrice + additionalCost + tax + cardFee + prepaymentCost + prepaymentTip
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
    reservationOptionsTotalPrice,
    notIncludedBreakdown.totalUsd,
    (formData as { status?: string }).status,
  ])

  // 고객 총 결제금액: Returned(파트너 환불 조치)만큼 낮춤. 잔액 = 이 값 − 보증금 − 잔금 수령
  const calculateTotalCustomerPayment = useCallback(() => {
    const gross = calculateTotalCustomerPaymentGross()
    const ret = Math.max(0, Number(returnedAmount) || 0)
    return Math.max(0, roundUsd2(gross - ret))
  }, [calculateTotalCustomerPaymentGross, returnedAmount])

  calculateTotalCustomerPaymentGrossRef.current = calculateTotalCustomerPaymentGross
  calculateTotalCustomerPaymentRef.current = calculateTotalCustomerPayment

  /** 표시·포커스: DB/OTA가 0으로 남아 있어도 계산 잔액이 크면 계산값을 보여 줌 */
  const displayedOnSiteBalance = useCallback(() => {
    const cancelled =
      (formData as { status?: string }).status != null &&
      ['cancelled', 'canceled'].includes(String((formData as { status?: string }).status).toLowerCase().trim())
    if (cancelled) return 0
    const totalCustomerPayment = calculateTotalCustomerPayment()
    const totalPaid = formData.depositAmount + calculatedBalanceReceivedTotal
    const defaultBalance = Math.max(0, roundUsd2(totalCustomerPayment - totalPaid))
    const stored = formData.onSiteBalanceAmount
    if (stored === undefined || stored === null) return defaultBalance
    if (stored === 0 && defaultBalance > 0.01) return defaultBalance
    return roundUsd2(Number(stored))
  }, [
    calculateTotalCustomerPayment,
    returnedAmount,
    formData.depositAmount,
    formData.onSiteBalanceAmount,
    calculatedBalanceReceivedTotal,
    (formData as { status?: string }).status,
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

      // payment_status에 따라 보증금과 잔금 분리
      let depositTotal = 0 // 보증금 총합
      let balanceReceivedTotal = 0 // 잔금 수령 총합
      let refundedTotal = 0 // 우리 쪽 환불 (Refunded)
      let returnedTotal = 0 // 파트너 환불 (Returned)
      let partnerReceivedStrict = 0

      paymentRecords.forEach((record: { payment_status: string; amount: number }) => {
        const status = record.payment_status || ''
        const statusLower = status.toLowerCase()
        const amount = Number(record.amount) || 0

        if (status === 'Partner Received') {
          partnerReceivedStrict += amount
        }

        // 보증금 수령만 합산 (요청 금액 제외) - 고객 실제 지불액(보증금)에 반영
        if (
          statusLower.includes('partner received') ||
          statusLower.includes('deposit received') ||
          statusLower.includes("customer's cc charged")
        ) {
          depositTotal += amount
        }
        // 잔금 수령만 합산 (요청은 미수령)
        else if (statusLower.includes('balance received')) {
          balanceReceivedTotal += amount
        }
        // 환불 관련 처리 - 정확한 문자열 또는 포함 여부로 확인
        else if (status.includes('Refunded') || statusLower === 'refunded') {
          refundedTotal += amount
        }
        else if (status.includes('Returned') || statusLower === 'returned') {
          returnedTotal += amount
        }
      })

      /** 파트너 환불(Returned)은 파트너 수령(Partner Received) 구간에서만 보증금 합에서 차감: (Partner Received − Returned) + 기타 입금 */
      const depositTotalNet =
        depositTotal > 0
          ? roundUsd2(depositTotal - Math.min(partnerReceivedStrict, returnedTotal))
          : depositTotal

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
      const remainingBalance = Math.max(0, totalCustomerPayment - totalPaid)

      // OTA 채널 여부 확인 (최신 formData/channels는 ref에서 참조)
      const fd = formDataRef.current
      const chs = channelsRef.current
      const selectedChannel = (Array.isArray(chs) ? chs : []).find((c: { id: string }) => c.id === fd.channelId)
      const isOTAChannel = selectedChannel && (
        (selectedChannel as any).type?.toLowerCase() === 'ota' || 
        (selectedChannel as any).category === 'OTA' ||
        (selectedChannel as any).name?.toLowerCase().includes('ota') ||
        (selectedChannel as any).name?.toLowerCase().includes('expedia') ||
        (selectedChannel as any).name?.toLowerCase().includes('booking') ||
        (selectedChannel as any).name?.toLowerCase().includes('viator') ||
        (selectedChannel as any).name?.toLowerCase().includes('getyourguide')
      )

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
      const depositToSave =
        depositTotal > 0
          ? depositTotalNet
          : discountedPriceWithoutNotIncluded > 0
            ? discountedPriceWithoutNotIncluded
            : 0

      if (paymentRecords.length > 0) {
        // 입금 반영은 폼 상태만 갱신. reservation_pricing 저장은 사용자가「가격 정보 저장」또는 전체 예약 저장 시에만 수행.
        setFormData((prev: typeof formData) => ({
          ...prev,
          balanceReceivedTotal,
          depositAmount: depositToSave,
          ...(isOTAChannel
            ? {}
            : {
                onSiteBalanceAmount: remainingBalance,
                balanceAmount: remainingBalance
              })
        }))
      } else {
        setFormData((prev: typeof formData) => ({
          ...prev,
          balanceReceivedTotal
        }))
      }
    } catch (error) {
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
  // depositAmount → onlinePaymentAmount 효과에서 이미 적용한 값 (무한 루프 방지)
  const lastDepositSyncRef = useRef<{ depositAmount: number; online: number; commissionBase: number; commissionAmt: number } | null>(null)

  // 잔액 자동 계산 (= 총 결제 예정 금액 − 고객 실제 지불액: 보증금 + 잔금 수령)
  type BalanceDeps = {
    totalCustomerPayment: number
    depositAmount: number
    calculatedBalanceReceivedTotal: number
    notIncludedPrice: number
    pricingAdults: number
    child: number
    infant: number
  }
  const prevBalanceDepsRef = useRef<BalanceDeps | null>(null)

  useEffect(() => {
    const totalCustomerPayment = calculateTotalCustomerPayment()
    const totalPaid = formData.depositAmount + calculatedBalanceReceivedTotal
    const calculatedBalance = Math.max(0, totalCustomerPayment - totalPaid)

    const notIncludedPrice = notIncludedBreakdown.totalUsd

    const currentDeps: BalanceDeps = {
      totalCustomerPayment: roundUsd2(totalCustomerPayment),
      depositAmount: formData.depositAmount,
      calculatedBalanceReceivedTotal,
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
      (stored === 0 && calculatedBalance > 0.01) ||
      balanceDifference > 0.01

    if (shouldWrite && !(calculatedBalance === 0 && currentBalance > 0.01)) {
      setFormData((prevForm: typeof formData) => ({
        ...prevForm,
        onSiteBalanceAmount: calculatedBalance,
        balanceAmount: calculatedBalance,
      }))
    }
    prevBalanceDepsRef.current = currentDeps
  }, [
    calculateTotalCustomerPayment,
    returnedAmount,
    formData.depositAmount,
    calculatedBalanceReceivedTotal,
    formData.not_included_price,
    formData.pricingAdults,
    formData.child,
    formData.infant,
    notIncludedBreakdown.totalUsd,
    setFormData,
  ])

  // depositAmount를 할인 후 상품가격으로 자동 업데이트 (상품 가격이나 쿠폰 변경 시)
  // OTA 채널의 경우 OTA 판매가를 depositAmount로 설정하고, 채널 결제 금액과 수수료도 함께 업데이트
  useEffect(() => {
    // OTA 채널 여부 확인
    const selectedChannel = channels.find((c: { id: string }) => c.id === formData.channelId)
    const isOTAChannel = selectedChannel && (
      (selectedChannel as any).type?.toLowerCase() === 'ota' || 
      (selectedChannel as any).category === 'OTA' ||
      (selectedChannel as any).name?.toLowerCase().includes('ota') ||
      (selectedChannel as any).name?.toLowerCase().includes('expedia') ||
      (selectedChannel as any).name?.toLowerCase().includes('booking') ||
      (selectedChannel as any).name?.toLowerCase().includes('viator') ||
      (selectedChannel as any).name?.toLowerCase().includes('getyourguide')
    )
    
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
        
        // OTA 채널: depositAmount = 고객 총 결제 금액(잔액 0), 채널 결제 금액 = 쿠폰 시 할인 후 상품가·아니면 판매가×인원, 채널 수수료 $ = 채널 결제 금액 × 수수료 %
        // 단, 입금 내역이 있거나 DB에서 불러온 deposit_amount가 있으면 고객 실제 지불액(보증금)을 덮어쓰지 않음
        if (isOTAChannel) {
          const reservationCancelled =
            formData.status != null &&
            ['cancelled', 'canceled'].includes(String(formData.status).toLowerCase().trim())
          /** 입금·상품가 effect가 채널 결제 입력을 덮어쓰지 않음 (수동 입력·취소 후 부분 정산·DB 저장값) */
          const skipOtaChannelPaymentAuto =
            reservationCancelled || otaChannelPaymentUserEditedRef.current || channelPaymentLoadedFromDb

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

          const totalCustomerPayment = calculateTotalCustomerPayment()
          const salePriceTimesPax =
            formData.couponDiscount > 0
              ? Math.max(
                  0,
                  formData.productPriceTotal -
                    formData.couponDiscount -
                    formData.additionalDiscount
                )
              : formData.productPriceTotal
          /** 불포함(현장/추가 결제) 금액이 있으면 고객 총 결제 = 판매·옵션 등 + 불포함. 보증금(실제 지불액)은 불포함을 제외한 금액, 잔액(투어 당일) = 불포함 합. */
          const notIncludedTotal = notIncludedBreakdown.totalUsd
          const depositPortion =
            notIncludedTotal > 0
              ? Math.max(0, totalCustomerPayment - notIncludedTotal)
              : totalCustomerPayment
          const depositFromDb = isExistingPricingLoaded && (formData.depositAmount ?? 0) > 0 && Math.abs((formData.depositAmount ?? 0) - depositPortion) > 0.01
          if (hasPaymentRecordsRef.current || depositFromDb) {
            // 입금 내역 합 또는 DB 저장값 유지; depositAmount는 건드리지 않음. 채널 결제 금액만 판매가×인원으로 설정 가능
            const channelPaymentBase = Math.max(0, salePriceTimesPax - returnedAmount)
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
          } else if (currentDeposit === 0 || priceDifference > 0.01) {
            const channelPaymentBase = Math.max(0, salePriceTimesPax - returnedAmount)
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
            const otaRemainingBalance = Math.max(
              0,
              roundUsd2(totalCustomerPayment - depositPortion - calculatedBalanceReceivedTotal)
            )
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
          
          // depositAmount가 0이거나, 현재 값이 할인 후 상품가와 차이가 0.01 이상이면 업데이트
          if (currentDeposit === 0 || priceDifference > 0.01) {
            // 잔액도 함께 계산하여 업데이트
            const totalCustomerPayment = calculateTotalCustomerPayment()
            const totalPaid = discountedPrice + calculatedBalanceReceivedTotal
            const calculatedBalance = Math.max(0, totalCustomerPayment - totalPaid)
            const existingBalance = formData.onSiteBalanceAmount ?? 0
            const balanceToUse = (calculatedBalance === 0 && existingBalance > 0) ? existingBalance : calculatedBalance
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
  }, [formData.productPriceTotal, formData.couponDiscount, formData.additionalDiscount, formData.depositAmount, formData.channelId, formData.status, formData.not_included_price, formData.pricingAdults, formData.child, formData.infant, formData.commission_amount, formData.commission_percent, channels, returnedAmount, calculateTotalCustomerPayment, calculatedBalanceReceivedTotal, isExistingPricingLoaded, channelPaymentLoadedFromDb, setFormData, notIncludedBreakdown.totalUsd])

  // 선택된 채널 정보 가져오기
  const selectedChannel = channels?.find(ch => ch.id === formData.channelId)
  const commissionBasePriceOnly = selectedChannel?.commission_base_price_only || false
  const isOTAChannel = selectedChannel && (
    selectedChannel.type?.toLowerCase() === 'ota' || 
    selectedChannel.category === 'OTA'
  )
  // Homepage 채널 (채널 type이 ota가 아닐 때 쿠폰 선택에 함께 사용). id M00001 또는 이름에 Homepage/홈페이지 포함
  const homepageChannel = Array.isArray(channels) ? channels.find(ch =>
    ch.id === 'M00001' ||
    (ch.name && (String(ch.name).toLowerCase().includes('homepage') || String(ch.name).includes('홈페이지')))
  ) : null
  const homepageChannelId = homepageChannel?.id ?? null

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

  // 할인 후 상품가 = 상품가격 - 쿠폰할인 - 추가할인 (정산·채널 결제 UI에서 공통)
  const discountedProductPrice =
    formData.productPriceTotal - formData.couponDiscount - formData.additionalDiscount
  /** OTA: 쿠폰 적용 시 채널 결제(상품) 기준 = 할인 후 상품가, 없으면 판매가×인원 */
  const otaChannelProductPaymentGross =
    formData.couponDiscount > 0
      ? Math.max(0, discountedProductPrice)
      : formData.productPriceTotal

  /**
   * 정산 산식용 gross. 폼 `onlinePaymentAmount` 우선; 없으면 DB에 net만 있을 때 `deriveCommissionGrossForSettlement`로 복원.
   */
  const channelPaymentGrossDb = useMemo(() => {
    const online = Number(formData.onlinePaymentAmount)
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
  ])

  /** 「채널 결제 금액」입력칸: 환불 조치 전 gross에서 Returned를 뺀 금액. 보증금이 이미 순액이면 이중 차감하지 않음. */
  const channelPaymentAmountAfterReturn = useMemo(() => {
    const ret = Math.max(0, Number(returnedAmount) || 0)
    const dep = Number(formData.depositAmount) || 0
    const cg = Number(channelPaymentGrossDb) || 0

    if (cg > 0.005) {
      return Math.max(0, roundUsd2(cg - ret))
    }
    if (dep > 0.005 && ret > 0.005) {
      return Math.max(0, roundUsd2(dep))
    }
    if (dep > 0.005) {
      return Math.max(0, roundUsd2(dep - ret))
    }
    if (isOTAChannel) {
      const base =
        cg ||
        dep ||
        (otaChannelProductPaymentGross > 0 ? otaChannelProductPaymentGross : 0)
      return Math.max(0, roundUsd2(base - ret))
    }
    const productSubtotal =
      (formData.productPriceTotal - formData.couponDiscount) +
      reservationOptionsTotalPrice +
      (formData.additionalCost - formData.additionalDiscount) +
      formData.tax +
      formData.cardFee +
      formData.prepaymentTip -
      (formData.onSiteBalanceAmount || 0)
    const base = cg || (productSubtotal > 0 ? productSubtotal : 0)
    return Math.max(0, roundUsd2(base - ret))
  }, [
    channelPaymentGrossDb,
    returnedAmount,
    formData.depositAmount,
    isOTAChannel,
    otaChannelProductPaymentGross,
    formData.productPriceTotal,
    formData.couponDiscount,
    reservationOptionsTotalPrice,
    formData.additionalCost,
    formData.additionalDiscount,
    formData.tax,
    formData.cardFee,
    formData.prepaymentTip,
    formData.onSiteBalanceAmount,
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
      return Math.max(0, Number(fromForm))
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

    return computeChannelSettlementAmount({
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
      returnedAmount,
      partnerReceivedAmount: partnerReceivedForSettlement,
      commissionAmount: Number(formData.commission_amount) || 0,
      reservationStatus: formData.status ?? null,
      isOTAChannel: !!isOTAChannel,
    })
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
    partnerReceivedForSettlement,
    formData.commission_amount,
    formData.status,
    isOTAChannel,
    isReservationCancelled,
  ])

  /** DB에 net만 있고 폼이 online≈net으로 로드된 경우 gross로 보정 (저장·산식과 동일) */
  useEffect(() => {
    if (otaChannelPaymentUserEditedRef.current) return
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
        totalNotIncluded = defaultNotIncludedPrice * (formData.pricingAdults + formData.child + formData.infant)
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

  // Net 가격 계산
  const calculateNetPrice = () => {
    if (isReservationCancelled) {
      if (isOTAChannel) return channelSettlementBeforePartnerReturn
      return 0
    }
    // OTA 채널일 때는 단순 계산: OTA 판매가 - 쿠폰 할인 + 추가비용 - 커미션
    if (isOTAChannel) {
      const otaSalePrice = formData.productPriceTotal // OTA 판매가 (초이스 포함)
      const afterCoupon = otaSalePrice - formData.couponDiscount - formData.additionalDiscount + formData.additionalCost
      
      let commissionAmount = 0
      if (effectiveCommissionAmount > 0) {
        commissionAmount = effectiveCommissionAmount
      } else {
        commissionAmount = afterCoupon * (formData.commission_percent / 100)
      }
      
      return afterCoupon - commissionAmount
    }
    
    const totalPrice = formData.subtotal - formData.couponDiscount - formData.additionalDiscount + formData.additionalCost + formData.optionTotal + reservationOptionsTotalPrice
    
    // commission_base_price_only가 true인 경우, 판매가격에만 커미션 적용
    if (commissionBasePriceOnly) {
      const baseProductPrice = calculateProductPriceTotal()
      // 초이스별 불포함 금액 사용 (없으면 기본 불포함 금액)
      const notIncludedTotal = notIncludedBreakdown.totalUsd
      
      // 판매가격만 계산 (초이스와 불포함 금액 제외)
      const basePriceForCommission = baseProductPrice - formData.couponDiscount - formData.additionalDiscount + formData.additionalCost
      
      let commissionAmount = 0
      if (effectiveCommissionAmount > 0) {
        commissionAmount = effectiveCommissionAmount
      } else {
        commissionAmount = basePriceForCommission * (formData.commission_percent / 100)
      }
      
      // Net = 판매가격 - 커미션 + 불포함 금액 (초이스 판매총액은 불포함과 중복이므로 가산하지 않음)
      return basePriceForCommission - commissionAmount + notIncludedTotal
    } else {
      // 기존 로직: 전체 가격에 커미션 적용
      if (effectiveCommissionAmount > 0) {
        return totalPrice - effectiveCommissionAmount
      } else {
        return totalPrice * (1 - formData.commission_percent / 100)
      }
    }
  }

  // 정산 카드 하단 설명 표시 (모바일: 클릭 시 토글)
  const [expandedSettlementCard, setExpandedSettlementCard] = useState<string | null>(null)

  // 수익 계산 (Net 가격 - 예약 지출 총합 - 투어 지출 총합)
  const calculateProfit = () => {
    if (isReservationCancelled) {
      if (isOTAChannel) {
        return channelSettlementBeforePartnerReturn - reservationExpensesTotal - tourExpensesTotal
      }
      return 0
    }
    const netPrice = calculateNetPrice()
    return netPrice - reservationExpensesTotal - tourExpensesTotal
  }

  // 커미션 기본값 설정 및 자동 업데이트 (할인 후 상품가 우선, 없으면 OTA 판매가, 없으면 소계)
  const otaSalePrice = formData.onlinePaymentAmount ?? 0
  const currentCommissionBase = formData.commission_base_price ?? 0

  // OTA는 쿠폰 시 할인 후 상품가, 그 외는 판매가×인원. 0이 아닐 때 onlinePaymentAmount 자동 설정.
  // 취소 OTA·부분 정산은 수동 입력만 쓰므로 자동 덮어쓰기 안 함. 수동 입력 후 블러 시에도 사용자 값 유지.
  useEffect(() => {
    if (channelPaymentLoadedFromDb) return
    if (isOTAChannel && isReservationCancelled) return

    const targetOnline = isOTAChannel ? otaChannelProductPaymentGross : formData.productPriceTotal

    if (targetOnline > 0) {
      setFormData((prev: typeof formData) => {
        const currentOnlinePaymentAmount = prev.onlinePaymentAmount || 0
        const priceDifference = Math.abs(currentOnlinePaymentAmount - targetOnline)

        const shouldSyncFromProduct =
          !otaChannelPaymentUserEditedRef.current &&
          (currentOnlinePaymentAmount === 0 ||
            (priceDifference > 0.01 && !isChannelPaymentAmountFocused))

        if (shouldSyncFromProduct) {
          const netChannel = isOTAChannel ? Math.max(0, targetOnline - returnedAmount) : targetOnline
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
    formData.productPriceTotal,
    formData.couponDiscount,
    formData.additionalDiscount,
    formData.not_included_price,
    formData.pricingAdults,
    formData.child,
    formData.infant,
    isOTAChannel,
    isReservationCancelled,
    isChannelPaymentAmountFocused,
    returnedAmount,
    channelPaymentLoadedFromDb,
    setFormData,
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

  // depositAmount 변경 시 채널 결제 금액 자동 업데이트 (입력 중이 아닐 때만)
  useEffect(() => {
    if (isReservationCancelled) return
    if (channelPaymentLoadedFromDb) return
    if (isOTAChannel && otaChannelPaymentUserEditedRef.current) return
    if (isChannelPaymentAmountFocused || formData.depositAmount <= 0) return
    const deposit = formData.depositAmount
    const currentOnlinePaymentAmount = formData.onlinePaymentAmount || 0
    if (Math.abs(currentOnlinePaymentAmount - deposit) <= 0.01) return

    const nextOnline = deposit
    let nextCommissionBase = formData.commission_base_price ?? 0
    let nextCommissionAmount = formData.commission_amount ?? 0
    if (isOTAChannel) {
      nextCommissionBase = Math.max(0, deposit - returnedAmount)
      const commissionCalcBase = nextCommissionBase
      const pct = formData.commission_percent || channelCommissionPercent || 0
      nextCommissionAmount =
        commissionCalcBase > 0 && pct > 0
          ? Math.round(commissionCalcBase * (pct / 100) * 100) / 100
          : (formData.commission_amount ?? 0)
      otaCommissionAutoFingerprintRef.current = otaCommissionFeeFingerprint(commissionCalcBase, pct)
      isCardFeeManuallyEdited.current = false
    }
    const last = lastDepositSyncRef.current
    if (last && Math.abs(last.depositAmount - deposit) < 0.01 &&
        Math.abs(last.online - nextOnline) < 0.01 &&
        Math.abs(last.commissionBase - nextCommissionBase) < 0.01 &&
        Math.abs(last.commissionAmt - nextCommissionAmount) < 0.01) return
    lastDepositSyncRef.current = { depositAmount: deposit, online: nextOnline, commissionBase: nextCommissionBase, commissionAmt: nextCommissionAmount }

    setFormData((prev: typeof formData) => ({
      ...prev,
      onlinePaymentAmount: nextOnline,
      ...(isOTAChannel
        ? {
            commission_base_price: nextCommissionBase,
            commission_amount: nextCommissionAmount,
          }
        : {
            commission_base_price: nextOnline,
          }),
    }))
  }, [
    formData.depositAmount,
    formData.onlinePaymentAmount,
    formData.commission_base_price,
    formData.commission_amount,
    formData.commission_percent,
    isOTAChannel,
    channelCommissionPercent,
    returnedAmount,
    isChannelPaymentAmountFocused,
    isExistingPricingLoaded,
    channelPaymentLoadedFromDb,
    setFormData,
    isReservationCancelled
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
  
  // commission_base_price / commission_amount 자동 업데이트 (값이 실제로 다를 때만 set, 무한 루프 방지)
  useEffect(() => {
    if (isOTAChannel) return
    // DB에 commission이 있으면 계산하지 말고 그 값 유지
    if (hasDbCommissionRef.current || isExistingPricingLoaded) return
    if (isCardFeeManuallyEdited.current) return
    const basePrice = discountedProductPrice > 0 ? discountedProductPrice : (otaSalePrice > 0 ? otaSalePrice : formData.subtotal)
    if (basePrice <= 0) return
    if (formData.commission_base_price !== undefined && Math.abs(currentCommissionBase - basePrice) >= 0.01) return

    const calculatedAmount = formData.commission_percent > 0 ? basePrice * (formData.commission_percent / 100) : 0
    const needBase = formData.commission_base_price === undefined || Math.abs(currentCommissionBase - basePrice) >= 0.01
    const needAmount = formData.commission_percent > 0 && (formData.commission_amount === undefined || Math.abs((formData.commission_amount ?? 0) - calculatedAmount) >= 0.01)
    if (!needBase && !needAmount) return

    setFormData((prev: typeof formData) => {
      const newBase = basePrice
      const newAmount = (prev.commission_percent ?? 0) > 0 ? newBase * ((prev.commission_percent ?? 0) / 100) : (prev.commission_amount ?? 0)
      if (Math.abs((prev.commission_base_price ?? 0) - newBase) < 0.01 && Math.abs((prev.commission_amount ?? 0) - newAmount) < 0.01) return prev
      return prev.commission_percent > 0
        ? { ...prev, commission_base_price: newBase, commission_amount: newAmount }
        : { ...prev, commission_base_price: newBase }
    })
  }, [
    discountedProductPrice,
    otaSalePrice,
    formData.subtotal,
    currentCommissionBase,
    formData.commission_percent,
    formData.commission_base_price,
    formData.commission_amount,
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

  // 자체 채널: 채널 결제 금액 변경 시 카드 수수료 기본값 자동 업데이트
  useEffect(() => {
    if (isReservationCancelled) return
    if (isOTAChannel) return // OTA 채널은 제외
    if (isCardFeeManuallyEdited.current) return // 사용자가 수동으로 입력한 경우 자동 업데이트 안 함
    if (hasDbCommissionRef.current || isExistingPricingLoaded) return // DB에 값이 있으면 덮어쓰지 않음
    
    // 데이터베이스에서 불러온 commission_amount가 있으면 절대 덮어쓰지 않음
    if (loadedCommissionAmountRef.current !== null && loadedCommissionAmountRef.current > 0) return
    if (formData.commission_amount > 0) return
    
    // 채널 결제 금액 계산 (잔금 제외)
    const channelPaymentAmount = (
      (formData.productPriceTotal - formData.couponDiscount) + 
      reservationOptionsTotalPrice + 
      (formData.additionalCost - formData.additionalDiscount) + 
      formData.tax + 
      formData.cardFee +
      formData.prepaymentTip -
      (formData.onSiteBalanceAmount || 0)
    )
    
    // 고객 실제 지불액 기준으로 카드 수수료 계산
    const customerPaymentAmount = formData.depositAmount || 0
    const defaultCommissionPercent = 2.9
    
    // 채널 결제 금액이 변경되면 카드 수수료 기준값도 자동 업데이트
    // 단, commission_amount가 0일 때만 자동 업데이트 (데이터베이스에서 불러온 값이 있으면 절대 덮어쓰지 않음)
    if (channelPaymentAmount > 0 && customerPaymentAmount > 0 && formData.commission_amount === 0) {
      const currentBasePrice = formData.commission_base_price || 0
      
      // 현재 값이 기본값과 같거나, commission_base_price가 설정되지 않았으면 자동 업데이트
      if (formData.commission_base_price === undefined || 
          Math.abs(currentBasePrice - customerPaymentAmount) < 0.01) {
        const commissionPercent = formData.commission_percent > 0 ? formData.commission_percent : defaultCommissionPercent
        // 15센트를 더한 최종 카드 수수료 계산
        const calculatedCommissionAmount = Number((customerPaymentAmount * (commissionPercent / 100) + 0.15).toFixed(2))
        setFormData((prev: typeof formData) => ({ 
          ...prev, 
          commission_base_price: customerPaymentAmount,
          commission_percent: commissionPercent,
          commission_amount: calculatedCommissionAmount
        }))
      }
    }
  }, [
    isOTAChannel,
    formData.productPriceTotal,
    formData.couponDiscount,
    formData.additionalCost,
    formData.additionalDiscount,
    formData.tax,
    formData.cardFee,
    formData.prepaymentTip,
    formData.onSiteBalanceAmount,
    formData.depositAmount,
    reservationOptionsTotalPrice,
    formData.commission_base_price,
    formData.commission_amount,
    isExistingPricingLoaded,
    setFormData,
    isReservationCancelled
  ])

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
      {/* 왼쪽: 제목·채널·날짜·기존가격/완료 뱃지·단독투어 / 오른쪽 끝: 저장·초기화 */}
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
          <label className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-violet-50 border border-violet-200 cursor-pointer hover:bg-violet-100 focus-within:ring-2 focus-within:ring-violet-400 focus-within:ring-offset-1">
            <input
              type="checkbox"
              checked={formData.isPrivateTour}
              onChange={(e) => setFormData({ ...formData, isPrivateTour: e.target.checked })}
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
                onChange={(e) => setFormData({ ...formData, privateTourAdditionalCost: Number(e.target.value) || 0 })}
                className="w-16 px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                step="0.01"
                placeholder="0"
              />
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={async () => {
              try {
                if (!reservationId) {
                  alert(isKorean ? '가격 정보만 저장하려면 먼저 예약을 저장해 주세요.' : 'Please save the reservation first to save pricing.')
                  return
                }
                await savePricingInfo(reservationId)
                alert('가격 정보가 저장되었습니다!')
              } catch {
                alert('가격 정보 저장 중 오류가 발생했습니다.')
              }
            }}
            className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
          >
            저장
          </button>
          <button
            type="button"
            onClick={() => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                  <div className="flex items-center space-x-1">
                    <span className="text-xs text-gray-500 w-16">판매가</span>
                    <span className="font-medium text-xs">$</span>
                    <input
                      type="number"
                      value={formData.adultProductPrice || ''}
                      onChange={(e) => {
                        const salePrice = Number(e.target.value) || 0
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
                      className="w-16 px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      step="0.01"
                      placeholder="0"
                    />
                  </div>
                  {/* 불포함 가격 */}
                  <div className="flex items-center space-x-1">
                    <span className="text-xs text-gray-500 w-16">불포함</span>
                    <span className="font-medium text-xs">$</span>
                    <input
                      type="number"
                      value={formData.not_included_price || ''}
                      onChange={(e) => {
                        const notIncluded = Number(e.target.value) || 0
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
                      className="w-16 px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
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
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">아동</span>
                    <div className="flex items-center space-x-1">
                      <span className="font-medium">$</span>
                      <input
                        type="number"
                        value={formData.childProductPrice || ''}
                        onChange={(e) => {
                          const newPrice = Number(e.target.value) || 0
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
                        className="w-12 px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                        step="0.01"
                        placeholder="0"
                      />
                      <span className="text-gray-500">x{formData.child}</span>
                      <span className="font-medium">${((formData.childProductPrice || 0) * formData.child).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">유아</span>
                    <div className="flex items-center space-x-1">
                      <span className="font-medium">$</span>
                      <input
                        type="number"
                        value={formData.infantProductPrice || ''}
                        onChange={(e) => {
                          const newPrice = Number(e.target.value) || 0
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
                        className="w-12 px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
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
                      onChange={(e) => setFormData({ ...formData, additionalDiscount: Number(e.target.value) || 0 })}
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
                      onChange={(e) => setFormData({ ...formData, additionalCost: Number(e.target.value) || 0 })}
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
                      onChange={(e) => setFormData({ ...formData, tax: Number(e.target.value) || 0 })}
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
                      onChange={(e) => setFormData({ ...formData, cardFee: Number(e.target.value) || 0 })}
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
                        onChange={(e) => setFormData({ ...formData, prepaymentCost: Number(e.target.value) || 0 })}
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
                        onChange={(e) => setFormData({ ...formData, prepaymentTip: Number(e.target.value) || 0 })}
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
              
              {/* 옵션 추가 — 취소 예약은 징수 없음 */}
              {!isReservationCancelled && reservationOptionsTotalPrice > 0 && (
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] text-gray-600">{isKorean ? '+ 옵션 추가' : '+ Options'}</span>
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

              {returnedAmount > 0.005 && (
                <div className="flex justify-between items-center mb-1.5 rounded px-1.5 py-1 bg-amber-50 border border-amber-100">
                  <span
                    className="text-[10px] text-amber-900 cursor-help"
                    title={
                      isKorean
                        ? '입금 내역 중 Returned(파트너 환불 조치) 합계입니다. 아래「고객 총 결제 금액」에서 차감되어 표시됩니다.'
                        : 'Returned total from payment records. Subtracted in Total Customer Payment below.'
                    }
                  >
                    {isKorean ? '− Returned (파트너 환불 조치)' : '− Returned (partner refund)'}
                  </span>
                  <span className="text-[10px] font-semibold text-amber-900">
                    −${returnedAmount.toFixed(2)}
                  </span>
                </div>
              )}
              
              <div className="border-t border-gray-200 my-1.5"></div>
              
              {/* 고객 총 결제 금액 = 상품·옵션 등 합계 − Returned(있으면) */}
              <div className="flex justify-between items-center mb-1.5">
                <span
                  className="text-sm font-bold text-blue-800 cursor-help"
                  title={
                    isKorean
                      ? 'Returned가 있으면 파트너 환불 조치 금액을 뺀 순액입니다.'
                      : 'If Returned exists, partner refund is subtracted from the package total.'
                  }
                >
                  {isKorean ? '고객 총 결제 금액' : 'Total Customer Payment'}
                </span>
                <span className={`text-sm font-bold ${priceTextClass('totalPrice')}`}>
                  ${calculateTotalCustomerPayment().toFixed(2)}
                </span>
              </div>
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
                      ? '①과 동일(상품 합계에서 Returned 반영한 순액). 잔액 = 이 금액 − (보증금 + 잔금 수령)'
                      : 'Same as ① (package total net of Returned). Balance = this − (deposit + balance received)'
                  }
                >
                  {isKorean ? '총 결제 예정 금액' : 'Total Payment Due'}
                </span>
                <span className={`text-xs font-bold text-blue-700 ${priceTextClass('totalPrice')}`}>
                  ${calculateTotalCustomerPayment().toFixed(2)}
                </span>
              </div>
              
              {/* 고객 실제 지불액 (보증금) — 입금 동기화 시 Partner Received − Returned(파트너 환불) 반영 */}
              <div className="flex justify-between items-center mb-1.5">
                <span
                  className="text-xs text-gray-700 cursor-help"
                  title={
                    isKorean
                      ? '입금 내역이 있으면: 파트너 수령(Partner Received) 합계에서 파트너 환불(Returned)을 뺀 금액이 보증금에 반영됩니다.'
                      : 'With payment records: deposit = Partner Received total minus partner refunds (Returned), plus other deposit lines.'
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
                        const newDepositAmount = Number(e.target.value) || 0
                        const totalCustomerPayment = calculateTotalCustomerPayment()
                        const totalPaid = newDepositAmount + calculatedBalanceReceivedTotal
                        const calculatedBalance = Math.max(0, totalCustomerPayment - totalPaid)
                        setFormData((prev: typeof formData) => {
                          const otaNetBase = Math.max(0, newDepositAmount - returnedAmount)
                          const next = {
                            ...prev,
                            depositAmount: newDepositAmount,
                            onSiteBalanceAmount: calculatedBalance,
                            balanceAmount: calculatedBalance,
                            onlinePaymentAmount: newDepositAmount,
                            commission_base_price: isOTAChannel ? otaNetBase : newDepositAmount,
                          }
                          if (isOTAChannel) {
                            const commissionPercent = prev.commission_percent || channelCommissionPercent || 0
                            const adjustedBasePrice = otaNetBase
                            const calculatedCommission =
                              adjustedBasePrice > 0 && commissionPercent > 0
                                ? Math.round(adjustedBasePrice * (commissionPercent / 100) * 100) / 100
                                : 0
                            otaCommissionAutoFingerprintRef.current = otaCommissionFeeFingerprint(
                              adjustedBasePrice,
                              commissionPercent
                            )
                            isCardFeeManuallyEdited.current = false
                            return {
                              ...next,
                              commission_base_price: otaNetBase,
                              commission_amount: calculatedCommission,
                            }
                          }
                          return next
                        })
                      }}
                      className={`w-24 pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-right ${priceTextClass('depositAmount')}`}
                      step="0.01"
                      min="0"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
              
              {/* 잔금 수령 */}
              {calculatedBalanceReceivedTotal > 0 && (
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs text-gray-700">{isKorean ? '잔금 수령' : 'Balance Received'}</span>
                  <span className={`text-xs font-medium text-green-600 ${priceTextClass('')}`}>
                    ${calculatedBalanceReceivedTotal.toFixed(2)}
                  </span>
                </div>
              )}
              
              {/* 잔액 = 총 결제 예정 − 고객 실제 지불(보증금+잔금 수령) */}
              <div className="flex justify-between items-center mb-1.5">
                <span
                  className="text-xs text-gray-700 cursor-help"
                  title={
                    isKorean
                      ? '총 결제 예정 금액(①, Returned 반영 순액) − (보증금 + 잔금 수령). 투어 당일 등 남은 부담금'
                      : 'Total due (①, net of Returned) − (deposit + balance received). Typically on-site'
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
                      setFormData({ ...formData, onSiteBalanceAmount: newBalance, balanceAmount: newBalance })
                    }}
                    onFocus={() => {
                      setIsOnSiteBalanceAmountFocused(true)
                      setOnSiteBalanceAmountInput(displayedOnSiteBalance().toString())
                    }}
                    onBlur={() => {
                      setIsOnSiteBalanceAmountFocused(false)
                      const finalValue = parseFloat(parseFloat(onSiteBalanceAmountInput || '0').toFixed(2))
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
              
              {/* 채널 결제 금액 */}
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-medium text-gray-700">{isKorean ? '채널 결제 금액' : 'Channel Payment Amount'}</span>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500">:</span>
                  <div className="relative">
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
                        setChannelPaymentAmountInput(inputValue)
                        
                        const numValue = Number(inputValue) || 0
                        // Returned를 고려한 실제 금액
                        const actualAmount = numValue + returnedAmount
                        
                        if (isOTAChannel) {
                          if (numValue > 0.005) otaChannelPaymentUserEditedRef.current = true
                          const defaultBasePrice =
                            otaChannelProductPaymentGross > 0 ? otaChannelProductPaymentGross : formData.subtotal
                          const commissionBasePrice = formData.commission_base_price !== undefined
                            ? formData.commission_base_price
                            : (numValue > 0 ? numValue : defaultBasePrice)
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
                            ...omitChannelSettlementAmount(prev),
                            onlinePaymentAmount: actualAmount,
                            commission_base_price: numValue > 0 ? numValue : commissionBasePrice,
                            commission_amount: calculatedCommission,
                          }))
                        } else {
                          setFormData({
                            ...omitChannelSettlementAmount(formData),
                            onlinePaymentAmount: actualAmount,
                            commission_base_price: actualAmount,
                          })
                        }
                      }}
                      onFocus={() => {
                        setIsChannelPaymentAmountFocused(true)
                        setChannelPaymentAmountInput(channelPaymentAmountAfterReturn.toString())
                      }}
                      onBlur={() => {
                        setIsChannelPaymentAmountFocused(false)
                        const finalValue = Number(channelPaymentAmountInput) || 0
                        const actualAmount = finalValue + returnedAmount
                        
                        if (isOTAChannel) {
                          if (finalValue > 0.005) otaChannelPaymentUserEditedRef.current = true
                          const notIncludedPrice = notIncludedBreakdown.totalUsd
                          const discountedPrice = formData.productPriceTotal - formData.couponDiscount - formData.additionalDiscount - notIncludedPrice
                          const defaultBasePrice = discountedPrice > 0 ? discountedPrice : formData.subtotal
                          const commissionBasePrice = formData.commission_base_price !== undefined
                            ? formData.commission_base_price
                            : (finalValue > 0 ? finalValue : defaultBasePrice)
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
                            ...omitChannelSettlementAmount(prev),
                            onlinePaymentAmount: actualAmount,
                            commission_base_price: finalValue > 0 ? finalValue : commissionBasePrice,
                            commission_amount: calculatedCommission,
                          }))
                        } else {
                          setFormData({
                            ...omitChannelSettlementAmount(formData),
                            onlinePaymentAmount: actualAmount,
                            commission_base_price: actualAmount,
                          })
                        }
                        
                        setChannelPaymentAmountInput('')
                      }}
                      className={`w-24 pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-right ${priceTextClass('onlinePaymentAmount')}`}
                      step="0.01"
                      placeholder="0"
                    />
                  </div>
                  {returnedAmount > 0 && (
                    <span className="text-xs text-gray-500 ml-2">
                      (${(() => {
                        if (isOTAChannel) {
                          const originalAmount =
                            channelPaymentGrossDb ||
                            (() => {
                              const notIncludedPrice = notIncludedBreakdown.totalUsd
                              const discountedPrice =
                                formData.productPriceTotal -
                                formData.couponDiscount -
                                formData.additionalDiscount -
                                notIncludedPrice
                              return discountedPrice > 0 ? discountedPrice : 0
                            })()
                          return originalAmount.toFixed(2)
                        } else {
                          const productSubtotal =
                            (formData.productPriceTotal - formData.couponDiscount) +
                            reservationOptionsTotalPrice +
                            (formData.additionalCost - formData.additionalDiscount) +
                            formData.tax +
                            formData.cardFee +
                            formData.prepaymentTip -
                            (formData.onSiteBalanceAmount || 0)
                          const defaultAmount = productSubtotal
                          const originalAmount = channelPaymentGrossDb || (defaultAmount > 0 ? defaultAmount : 0)
                          return originalAmount.toFixed(2)
                        }
                      })()} - ${returnedAmount.toFixed(2)}) = ${channelPaymentAmountAfterReturn.toFixed(2)}
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
                </div>
              </div>
              
              {/* 채널 수수료 (커미션) / 카드 수수료 (자체 채널) */}
              {isOTAChannel ? (
                <div className="space-y-2 mb-2">
                  {/* 채널 수수료 % */}
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-700">
                      {isKorean ? '채널 수수료 %' : 'Channel Commission %'}
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
                              ...omitChannelSettlementAmount(prev),
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
                          console.log('PricingSection: commission_amount 수동 입력:', newAmount)
                          setFormData((prev: typeof formData) => ({
                            ...omitChannelSettlementAmount(prev),
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
                          setFormData((prev: typeof formData) => ({
                            ...omitChannelSettlementAmount(prev),
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
                          value={formData.commission_percent || 2.9}
                          onChange={(e) => {
                            isCardFeeManuallyEdited.current = true
                            const newPercent = Number(e.target.value) || 0
                            const basePrice = formData.commission_base_price !== undefined 
                              ? formData.commission_base_price 
                              : (formData.depositAmount || 0)
                            const newAmount = Number((basePrice * (newPercent / 100) + 0.15).toFixed(2))
                            setFormData({ 
                              ...omitChannelSettlementAmount(formData), 
                              commission_base_price: basePrice,
                              commission_percent: newPercent,
                              commission_amount: newAmount,
                            })
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
                            setFormData((prev: typeof formData) => ({
                              ...omitChannelSettlementAmount(prev),
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
                            setFormData((prev: typeof formData) => ({
                              ...omitChannelSettlementAmount(prev),
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
                      {(() => {
                        const basePrice = formData.commission_base_price !== undefined 
                          ? formData.commission_base_price 
                          : (formData.depositAmount || 0)
                        const commissionPercent = formData.commission_percent || 2.9
                        const calculatedAmount = basePrice * (commissionPercent / 100)
                        const currentAmount = effectiveCommissionAmount
                        // 15센트가 포함되어 있는지 확인 (계산된 값 + 0.15와 현재 값이 거의 같으면)
                        const isWith15Cents = Math.abs(currentAmount - (calculatedAmount + 0.15)) < 0.01
                        if (isWith15Cents && basePrice > 0) {
                          return (
                            <span className="text-xs text-gray-500">
                              ({basePrice.toFixed(2)} × {commissionPercent}% + $0.15)
                            </span>
                          )
                        }
                        return null
                      })()}
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
                        setFormData((prev: typeof formData) => ({
                          ...prev,
                          channelSettlementAmount: Math.max(0, n),
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
                        setFormData((prev: typeof formData) => omitChannelSettlementAmount({ ...prev }))
                      } else {
                        const finalValue = Math.max(0, roundUsd2(Number(raw) || 0))
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
                    min="0"
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
              
              {/* 채널 정산금액 (계산값 → 빨간색) — 채널 결제(표시) − 수수료와 동일 기준 */}
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-medium text-gray-700">
                  {isKorean ? '채널 정산금액' : 'Channel Settlement Amount'}
                </span>
                <span className={`text-xs font-medium ${priceTextClass('channel_settlement_amount')}`}>
                  ${channelSettlementBeforePartnerReturn.toFixed(2)}
                </span>
              </div>
              
              {/* 예약 옵션 가격 */}
              {!isReservationCancelled && reservationOptionsTotalPrice > 0 && (
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-medium text-gray-700">+ {isKorean ? '예약 옵션 가격' : 'Reservation Options'}</span>
                  <span className="text-xs font-medium text-gray-900">
                    +${reservationOptionsTotalPrice.toFixed(2)}
                  </span>
                </div>
              )}
              
              {/* 불포함 가격 — 입장권 / 비거주자 비용 분리 (취소 예약은 표시 안 함) */}
              {(() => {
                if (isReservationCancelled) return null
                const { baseUsd, residentFeesUsd, totalUsd } = notIncludedBreakdown
                if (totalUsd <= 0) return null
                return (
                  <>
                    {baseUsd > 0 && (
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs font-medium text-gray-700">
                          {isKorean
                            ? '+ 불포함 가격 (입장권)'
                            : '+ Not included (admission tickets)'}
                        </span>
                        <span className="text-xs font-medium text-gray-900">+${baseUsd.toFixed(2)}</span>
                      </div>
                    )}
                    {residentFeesUsd > 0 && (
                      <div className="flex justify-between items-center mb-1.5 pl-2">
                        <span className="text-xs font-medium text-gray-700">
                          + {isKorean ? '비거주자 비용' : '+ Non-resident fees'}
                        </span>
                        <span className="text-xs font-medium text-gray-900">+${residentFeesUsd.toFixed(2)}</span>
                      </div>
                    )}
                  </>
                )
              })()}
              
              {/* 추가할인 */}
              {(formData.additionalDiscount || 0) > 0 && (
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-medium text-gray-700">- {isKorean ? '추가할인' : 'Additional Discount'}</span>
                  <span className="text-xs font-medium text-red-600">
                    -${(formData.additionalDiscount || 0).toFixed(2)}
                  </span>
                </div>
              )}
              
              {/* 추가비용 */}
              {(formData.additionalCost || 0) > 0 && (
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-medium text-gray-700">+ {isKorean ? '추가비용' : 'Additional Cost'}</span>
                  <span className="text-xs font-medium text-gray-900">
                    +${(formData.additionalCost || 0).toFixed(2)}
                  </span>
                </div>
              )}
              
              {/* 세금 */}
              {(formData.tax || 0) > 0 && (
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-medium text-gray-700">+ {isKorean ? '세금' : 'Tax'}</span>
                  <span className="text-xs font-medium text-gray-900">
                    +${(formData.tax || 0).toFixed(2)}
                  </span>
                </div>
              )}
              
              {/* 결제 수수료 */}
              {(formData.cardFee || 0) > 0 && (
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-medium text-gray-700">+ {isKorean ? '결제 수수료' : 'Card Fee'}</span>
                  <span className="text-xs font-medium text-gray-900">
                    +${(formData.cardFee || 0).toFixed(2)}
                  </span>
                </div>
              )}
              
              {/* 선결제 지출 */}
              {(formData.prepaymentCost || 0) > 0 && (
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-medium text-gray-700">+ {isKorean ? '선결제 지출' : 'Prepayment Cost'}</span>
                  <span className="text-xs font-medium text-gray-900">
                    +${(formData.prepaymentCost || 0).toFixed(2)}
                  </span>
                </div>
              )}
              
              {/* 환불금 — 파트너 Returned는 위 채널 결제 금액(표시)에 이미 반영되어 이중 차감하지 않음 */}
              {(() => {
                if (refundedAmount <= 0) return null
                return (
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-medium text-red-700">- {isKorean ? '환불금 (우리)' : 'Refunded (Our Side)'}</span>
                    <span className="text-xs font-medium text-red-600">
                      -${refundedAmount.toFixed(2)}
                    </span>
                  </div>
                )
              })()}
              
              <div className="border-t border-gray-200 my-1.5"></div>
              
              {/* 총 매출 */}
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-sm font-bold text-green-800">{isKorean ? '총 매출' : 'Total Revenue'}</span>
                <span className="text-base font-bold text-green-600">
                  ${(() => {
                    if (isReservationCancelled) {
                      if (isOTAChannel) return channelSettlementBeforePartnerReturn.toFixed(2)
                      return '0.00'
                    }
                    const channelSettlementAmount = channelSettlementBeforePartnerReturn

                    // 불포함 가격 계산
                    const notIncludedTotal = notIncludedBreakdown.totalUsd
                    
                    // 총 매출 = 채널 정산금액 + 예약 옵션(OTA만) + 불포함 가격 + … (초이스 판매총액은 불포함과 중복이므로 가산하지 않음)
                    let totalRevenue = channelSettlementAmount
                    
                    // 예약 옵션 가격 (OTA는 채널 정산에 미포함이므로 가산; 비OTA는 채널 정산에 이미 포함)
                    if (reservationOptionsTotalPrice > 0 && isOTAChannel) {
                      totalRevenue += reservationOptionsTotalPrice
                    }
                    
                    // 불포함 가격
                    if (notIncludedTotal > 0) {
                      totalRevenue += notIncludedTotal
                    }
                    
                    // 추가할인 (차감)
                    if ((formData.additionalDiscount || 0) > 0) {
                      totalRevenue -= formData.additionalDiscount
                    }
                    
                    // 추가비용
                    if ((formData.additionalCost || 0) > 0) {
                      totalRevenue += formData.additionalCost
                    }
                    
                    // 세금
                    if ((formData.tax || 0) > 0) {
                      totalRevenue += formData.tax
                    }
                    
                    // 결제 수수료
                    if ((formData.cardFee || 0) > 0) {
                      totalRevenue += formData.cardFee
                    }
                    
                    // 선결제 지출
                    if ((formData.prepaymentCost || 0) > 0) {
                      totalRevenue += formData.prepaymentCost
                    }
                    
                    // 환불금 차감 (파트너 Returned는 채널 정산 기준에 이미 반영)
                    totalRevenue -= refundedAmount
                    
                    return totalRevenue.toFixed(2)
                  })()}
                </span>
              </div>
              
              {/* 선결제 팁 (수익 아님) */}
              {formData.prepaymentTip > 0 && (
                <>
                  <p className="text-xs text-red-600 mb-1">❗ 팁은 수익 아님 → 반드시 분리</p>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-600">- {isKorean ? '선결제 팁' : 'Prepaid Tips'}</span>
                    <span className="text-xs text-gray-700">-${formData.prepaymentTip.toFixed(2)}</span>
                  </div>
                </>
              )}
              
              <div className="border-t border-gray-200 my-2"></div>
              
              {/* 운영 이익 */}
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-sm font-bold text-purple-800">{isKorean ? '운영 이익' : 'Operating Profit'}</span>
                <span className="text-base font-bold text-purple-600">
                  ${(() => {
                    if (isReservationCancelled) {
                      if (isOTAChannel) {
                        return (
                          channelSettlementBeforePartnerReturn - (formData.prepaymentTip || 0)
                        ).toFixed(2)
                      }
                      return '0.00'
                    }
                    const channelSettlementAmount = channelSettlementBeforePartnerReturn

                    // 불포함 가격 계산
                    const notIncludedTotal = notIncludedBreakdown.totalUsd
                    
                    // 총 매출 = 채널 정산금액 + 예약 옵션(OTA만) + 불포함 가격 + … (초이스 판매총액은 불포함과 중복이므로 가산하지 않음)
                    let totalRevenue = channelSettlementAmount
                    
                    // 예약 옵션 가격 (OTA는 채널 정산에 미포함이므로 가산; 비OTA는 채널 정산에 이미 포함)
                    if (reservationOptionsTotalPrice > 0 && isOTAChannel) {
                      totalRevenue += reservationOptionsTotalPrice
                    }
                    
                    // 불포함 가격
                    if (notIncludedTotal > 0) {
                      totalRevenue += notIncludedTotal
                    }
                    
                    // 추가할인 (차감)
                    if ((formData.additionalDiscount || 0) > 0) {
                      totalRevenue -= formData.additionalDiscount
                    }
                    
                    // 추가비용
                    if ((formData.additionalCost || 0) > 0) {
                      totalRevenue += formData.additionalCost
                    }
                    
                    // 세금
                    if ((formData.tax || 0) > 0) {
                      totalRevenue += formData.tax
                    }
                    
                    // 결제 수수료
                    if ((formData.cardFee || 0) > 0) {
                      totalRevenue += formData.cardFee
                    }
                    
                    // 선결제 지출
                    if ((formData.prepaymentCost || 0) > 0) {
                      totalRevenue += formData.prepaymentCost
                    }
                    
                    // 환불금 차감 (파트너 Returned는 채널 정산 기준에 이미 반영)
                    totalRevenue -= refundedAmount

                    // 운영 이익 = 총 매출 - 선결제 팁
                    return (totalRevenue - (formData.prepaymentTip || 0)).toFixed(2)
                  })()}
                </span>
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
                  onClick={fetchReservationExpenses}
                  disabled={loadingExpenses}
                  className="p-1 text-blue-600 hover:text-blue-800 disabled:opacity-50"
                  title="지출 정보 새로고침"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingExpenses ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
            
            {(() => {
              // Mania Tour 또는 Mania Service인지 확인
              const product = products.find(p => p.id === formData.productId)
              const subCategory = product?.sub_category || ''
              const isManiaTour = subCategory === 'Mania Tour' || subCategory === 'Mania Service'
              
              return (
                <div className={`grid grid-cols-1 gap-3 ${isManiaTour ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
                  {/* Net 가격 */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedSettlementCard(prev => prev === 'net-price' ? null : 'net-price')}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedSettlementCard(prev => prev === 'net-price' ? null : 'net-price') } }}
                    className="group bg-white p-3 rounded-lg border border-blue-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer md:cursor-default"
                  >
                    <div className="flex items-center space-x-1.5 mb-1">
                      <DollarSign className="h-3 w-3 text-blue-500" />
                      <div className="text-xs font-medium text-gray-700">Net 가격</div>
                    </div>
                    <div className="text-base font-bold text-blue-600 mb-0.5">
                      ${calculateNetPrice().toFixed(2)}
                    </div>
                    <div className={`text-[10px] text-gray-500 ${expandedSettlementCard === 'net-price' ? 'block' : 'hidden'} md:block md:opacity-0 md:group-hover:opacity-100 md:transition-opacity`}>
                      커미션 차감 후 수령액
                    </div>
                  </div>

                  {/* 예약 지출 총합 */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedSettlementCard(prev => prev === 'reservation-expenses' ? null : 'reservation-expenses')}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedSettlementCard(prev => prev === 'reservation-expenses' ? null : 'reservation-expenses') } }}
                    className="group bg-white p-3 rounded-lg border border-red-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer md:cursor-default"
                  >
                    <div className="flex items-center space-x-1.5 mb-1">
                      <AlertCircle className="h-3 w-3 text-red-500" />
                      <div className="text-xs font-medium text-gray-700">예약 지출 총합</div>
                    </div>
                    <div className="text-base font-bold text-red-600 mb-0.5">
                      ${reservationExpensesTotal.toFixed(2)}
                    </div>
                    <div className={`text-[10px] text-gray-500 ${expandedSettlementCard === 'reservation-expenses' ? 'block' : 'hidden'} md:block md:opacity-0 md:group-hover:opacity-100 md:transition-opacity`}>
                      승인/대기/기타 지출 (거부 제외)
                    </div>
                  </div>

                  {/* 투어 지출 총합 (Mania Tour 또는 Mania Service인 경우만) */}
                  {isManiaTour && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedSettlementCard(prev => prev === 'tour-expenses' ? null : 'tour-expenses')}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedSettlementCard(prev => prev === 'tour-expenses' ? null : 'tour-expenses') } }}
                      className="group bg-white p-3 rounded-lg border border-orange-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer md:cursor-default"
                    >
                      <div className="flex items-center space-x-1.5 mb-1">
                        {loadingTourExpenses ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-orange-500"></div>
                        ) : (
                          <AlertCircle className="h-3 w-3 text-orange-500" />
                        )}
                        <div className="text-xs font-medium text-gray-700">투어 지출 총합</div>
                      </div>
                      <div className="text-base font-bold text-orange-600 mb-0.5">
                        ${tourExpensesTotal.toFixed(2)}
                      </div>
                      <div className={`text-[10px] text-gray-500 ${expandedSettlementCard === 'tour-expenses' ? 'block' : 'hidden'} md:block md:opacity-0 md:group-hover:opacity-100 md:transition-opacity`}>
                        투어 총 지출 ÷ 투어 인원수 × 예약 인원수
                      </div>
                    </div>
                  )}

                  {/* 수익 */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedSettlementCard(prev => prev === 'profit' ? null : 'profit')}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedSettlementCard(prev => prev === 'profit' ? null : 'profit') } }}
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
                    <div className={`text-base font-bold mb-0.5 ${calculateProfit() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${calculateProfit().toFixed(2)}
                    </div>
                    <div className={`text-[10px] text-gray-500 ${expandedSettlementCard === 'profit' ? 'block' : 'hidden'} md:block md:opacity-0 md:group-hover:opacity-100 md:transition-opacity`}>
                      Net 가격 - 지출 총합{isManiaTour ? ' - 투어 지출' : ''}
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
                  {calculateNetPrice() > 0 ? ((calculateProfit() / calculateNetPrice()) * 100).toFixed(1) : '0.0'}%
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
