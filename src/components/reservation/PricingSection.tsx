'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Calculator, DollarSign, TrendingUp, TrendingDown, AlertCircle, RefreshCw } from 'lucide-react'
import { useLocale } from 'next-intl'

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
    commission_percent: number
    commission_amount: number
    commission_base_price?: number
    onlinePaymentAmount?: number
    onSiteBalanceAmount?: number
    not_included_price?: number
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
  expenseUpdateTrigger?: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFormData: (data: any) => void
  savePricingInfo: (reservationId: string) => Promise<void>
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
  reservationOptionsTotalPrice?: number
  isExistingPricingLoaded?: boolean
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
  reservationOptionsTotalPrice = 0,
  isExistingPricingLoaded,
  reservationId,
  expenseUpdateTrigger,
  channels = [],
  products = [],
  t
}: PricingSectionProps) {
  const locale = useLocale()
  const isKorean = locale === 'ko'
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
  // 카드 수수료 수동 입력 여부 추적
  const isCardFeeManuallyEdited = useRef(false)
  // 채널 수수료 $ 입력 필드 로컬 상태 (입력 중 포맷팅 방지)
  const [commissionAmountInput, setCommissionAmountInput] = useState<string>('')
  const [isCommissionAmountFocused, setIsCommissionAmountFocused] = useState(false)
  // 채널 결제 금액 입력 필드 로컬 상태 (입력 중 포맷팅 방지)
  const [channelPaymentAmountInput, setChannelPaymentAmountInput] = useState<string>('')
  const [isChannelPaymentAmountFocused, setIsChannelPaymentAmountFocused] = useState(false)
  // 잔액 (투어 당일 지불) 입력 필드 로컬 상태 (입력 중 포맷팅 방지)
  const [onSiteBalanceAmountInput, setOnSiteBalanceAmountInput] = useState<string>('')
  const [isOnSiteBalanceAmountFocused, setIsOnSiteBalanceAmountFocused] = useState(false)

  // fetchPaymentRecords 등에서 formData/channels 의존 루프 방지용 (항상 최신 참조)
  const formDataRef = useRef(formData)
  formDataRef.current = formData
  const channelsRef = useRef(channels)
  channelsRef.current = channels
  const calculateTotalCustomerPaymentRef = useRef<() => number>(() => 0)

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
        console.error('예약 조회 오류:', reservationError)
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
          console.error('tour_id로 투어 조회 오류:', tourByIdError)
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
          console.error('투어 조회 오류:', toursError)
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
        console.error('투어 지출 조회 오류:', expensesError)
        setTourExpensesTotal(0)
        setLoadingTourExpenses(false)
        return
      }

      // 2-2. 입장권 부킹 비용 (ticket_bookings)
      const { data: ticketBookingsData, error: ticketBookingsError } = await supabase
        .from('ticket_bookings')
        .select('expense, status')
        .eq('tour_id', tourId)
        .in('status', ['confirmed', 'paid'])

      // 실제 오류인 경우에만 로그 출력 (빈 객체는 완전히 무시)
      // Supabase는 데이터가 없을 때 빈 객체를 반환할 수 있으므로, message나 code가 있는 경우에만 오류로 처리
      if (ticketBookingsError && (ticketBookingsError.message || ticketBookingsError.code)) {
        console.error('입장권 부킹 조회 오류:', ticketBookingsError)
        // 오류가 있어도 계속 진행
      }
      // 빈 객체 {}는 무시 (로그 출력 안 함)

      // 2-3. 호텔 부킹 비용 (tour_hotel_bookings)
      const { data: hotelBookingsData, error: hotelBookingsError } = await supabase
        .from('tour_hotel_bookings')
        .select('total_price, status')
        .eq('tour_id', tourId)
        .in('status', ['confirmed', 'paid'])

      // 실제 오류인 경우에만 로그 출력 (빈 객체는 완전히 무시)
      // Supabase는 데이터가 없을 때 빈 객체를 반환할 수 있으므로, message나 code가 있는 경우에만 오류로 처리
      if (hotelBookingsError && (hotelBookingsError.message || hotelBookingsError.code)) {
        console.error('호텔 부킹 조회 오류:', hotelBookingsError)
        // 오류가 있어도 계속 진행
      }
      // 빈 객체 {}는 무시 (로그 출력 안 함)

      // 3. 투어 총 지출 계산 (모든 소스 합산)
      const tourExpenses = (expensesData || []).reduce((sum: number, expense: any) => sum + (expense?.amount || 0), 0)
      const ticketBookingsCosts = (ticketBookingsData || []).reduce((sum: number, booking: any) => sum + (booking?.expense || 0), 0)
      const hotelBookingsCosts = (hotelBookingsData || []).reduce((sum: number, booking: any) => {
        // total_price만 사용 (total_cost 컬럼은 존재하지 않음)
        return sum + (booking?.total_price || 0)
      }, 0)
      
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

  // 고객 총 결제금액 계산 (화면 "고객 총 결제 금액" 표시와 동일한 식: 잔액 = 이 값 - 보증금 - 잔금 수령)
  const calculateTotalCustomerPayment = useCallback(() => {
    const discountedProductPrice = formData.productPriceTotal - formData.couponDiscount - formData.additionalDiscount
    const optionsTotal = reservationOptionsTotalPrice || 0
    const choicesTotal = formData.choiceTotal || formData.choicesTotal || 0
    const notIncludedPrice = (formData.not_included_price || 0) * (formData.adults + formData.child + formData.infant)
    const additionalCost = formData.additionalCost || 0
    const tax = formData.tax || 0
    const cardFee = formData.cardFee || 0
    const prepaymentCost = formData.prepaymentCost || 0
    const prepaymentTip = formData.prepaymentTip || 0
    return discountedProductPrice + optionsTotal + choicesTotal + notIncludedPrice + additionalCost + tax + cardFee + prepaymentCost + prepaymentTip
  }, [
    formData.productPriceTotal,
    formData.couponDiscount,
    formData.additionalDiscount,
    formData.choiceTotal,
    formData.choicesTotal,
    formData.not_included_price,
    formData.adults,
    formData.child,
    formData.infant,
    formData.additionalCost,
    formData.tax,
    formData.cardFee,
    formData.prepaymentCost,
    formData.prepaymentTip,
    reservationOptionsTotalPrice
  ])
  calculateTotalCustomerPaymentRef.current = calculateTotalCustomerPayment

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

      // payment_status에 따라 보증금과 잔금 분리
      let depositTotal = 0 // 보증금 총합
      let balanceReceivedTotal = 0 // 잔금 수령 총합
      let refundedTotal = 0 // 우리 쪽 환불 (Refunded)
      let returnedTotal = 0 // 파트너 환불 (Returned)

      paymentRecords.forEach((record: { payment_status: string; amount: number }) => {
        const status = record.payment_status || ''
        const statusLower = status.toLowerCase()
        const amount = Number(record.amount) || 0

        // 보증금 수령만 합산 (요청 금액 제외) - 고객 실제 지불액(보증금)에 반영
        if (
          statusLower.includes('partner received') ||
          statusLower.includes('deposit received') ||
          statusLower.includes("customer's cc charged")
        ) {
          depositTotal += amount
        }
        // 잔금 관련 상태
        else if (
          statusLower.includes('balance received') ||
          statusLower.includes('balance requested')
        ) {
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

      if (process.env.NODE_ENV === 'development') {
        console.log('PricingSection: 입금 내역 계산 결과', {
          depositTotal,
          balanceReceivedTotal,
          refundedTotal,
          returnedTotal,
          paymentRecordsCount: paymentRecords.length
        })
      }

      // 계산 결과를 state에 저장
      setCalculatedBalanceReceivedTotal(balanceReceivedTotal)
      setRefundedAmount(refundedTotal)
      setReturnedAmount(returnedTotal)

      // depositAmount와 balanceReceivedTotal을 기반으로 잔액 계산
      const totalCustomerPayment = calculateTotalCustomerPaymentRef.current()
      const totalPaid = depositTotal + balanceReceivedTotal
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

      // 입금 내역이 있으면 항상 자동으로 업데이트 (입금 내역이 실제 데이터이므로 우선)
      // 입금 내역이 없으면 할인 후 상품가를 기본값으로 설정 (새 예약 추가 시)
      const discountedPrice = fd.productPriceTotal - fd.couponDiscount - fd.additionalDiscount
      // 불포함 가격 제외한 할인 후 상품가
      const notIncludedPrice = (fd.not_included_price || 0) * (fd.adults + fd.child + fd.infant)
      const discountedPriceWithoutNotIncluded = discountedPrice - notIncludedPrice
      
      // OTA 채널일 경우 depositAmount를 먼저 설정하고, 잔액은 기존 useEffect에서 자동 계산
      if (isOTAChannel) {
        // OTA 채널: depositAmount만 먼저 설정 (잔액은 useEffect에서 자동 계산됨)
        // 입금 내역이 있으면 입금 내역 사용, 없으면 할인 후 상품가(불포함 가격 제외) 사용
        setFormData((prev: typeof formData) => {
          return {
            ...prev,
            depositAmount: depositTotal > 0 ? depositTotal : (discountedPriceWithoutNotIncluded > 0 ? discountedPriceWithoutNotIncluded : 0)
          }
        })
      } else {
        // 일반 채널: 기존대로 동시에 설정
        // 입금 내역이 있으면 입금 내역 사용, 없으면 할인 후 상품가(불포함 가격 제외) 사용
        setFormData((prev: typeof formData) => {
          return {
            ...prev,
            // 입금 내역이 있으면 자동으로 업데이트, 없으면 할인 후 상품가(불포함 가격 제외)
            depositAmount: depositTotal > 0 ? depositTotal : (discountedPriceWithoutNotIncluded > 0 ? discountedPriceWithoutNotIncluded : 0),
            // 잔금 수령이 있으면 남은 잔액 계산, 없으면 전체 잔액 계산
            onSiteBalanceAmount: remainingBalance,
            balanceAmount: remainingBalance
          }
        })
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

  // 잔액 자동 계산 (고객 총 결제금액 - 보증금 - 잔금 수령)
  // depositAmount, 고객 총 결제금액, 초이스 총액이 변경될 때 잔액을 자동으로 업데이트
  const prevBalanceDepsRef = useRef({
    depositAmount: formData.depositAmount,
    calculatedBalanceReceivedTotal,
    choiceTotal: formData.choiceTotal,
    choicesTotal: formData.choicesTotal,
    notIncludedPrice: (formData.not_included_price || 0) * (formData.adults + formData.child + formData.infant),
    adults: formData.adults,
    child: formData.child,
    infant: formData.infant,
    onSiteBalanceAmount: formData.onSiteBalanceAmount
  })
  
  useEffect(() => {
    const totalCustomerPayment = calculateTotalCustomerPayment()
    const totalPaid = formData.depositAmount + calculatedBalanceReceivedTotal
    const calculatedBalance = Math.max(0, totalCustomerPayment - totalPaid)
    
    // 불포함 가격 계산
    const notIncludedPrice = (formData.not_included_price || 0) * (formData.adults + formData.child + formData.infant)
    
    // 의존성 변경 확인 (onSiteBalanceAmount는 제외)
    const currentDeps = {
      depositAmount: formData.depositAmount,
      calculatedBalanceReceivedTotal,
      choiceTotal: formData.choiceTotal,
      choicesTotal: formData.choicesTotal,
      notIncludedPrice,
      adults: formData.adults,
      child: formData.child,
      infant: formData.infant
    }
    
    const depsChanged = 
      prevBalanceDepsRef.current.depositAmount !== currentDeps.depositAmount ||
      prevBalanceDepsRef.current.calculatedBalanceReceivedTotal !== currentDeps.calculatedBalanceReceivedTotal ||
      prevBalanceDepsRef.current.choiceTotal !== currentDeps.choiceTotal ||
      prevBalanceDepsRef.current.choicesTotal !== currentDeps.choicesTotal ||
      Math.abs(prevBalanceDepsRef.current.notIncludedPrice - currentDeps.notIncludedPrice) > 0.01 ||
      prevBalanceDepsRef.current.adults !== currentDeps.adults ||
      prevBalanceDepsRef.current.child !== currentDeps.child ||
      prevBalanceDepsRef.current.infant !== currentDeps.infant
    
    // 의존성이 변경되었을 때만 업데이트
    if (depsChanged) {
      const currentBalance = prevBalanceDepsRef.current.onSiteBalanceAmount ?? formData.onSiteBalanceAmount ?? 0
      const balanceDifference = Math.abs(currentBalance - calculatedBalance)
      
      // 잔액이 설정되지 않았거나 0일 때, 또는 계산된 잔액과 차이가 0.01 이상일 때만 업데이트
      if (currentBalance === 0 || currentBalance === undefined || currentBalance === null) {
        // 잔액이 없으면 불포함 가격을 기본값으로 설정
        const newBalance = notIncludedPrice > 0 ? notIncludedPrice : calculatedBalance
        setFormData((prev: typeof formData) => ({
          ...prev,
          onSiteBalanceAmount: newBalance,
          balanceAmount: newBalance
        }))
        prevBalanceDepsRef.current = { ...currentDeps, onSiteBalanceAmount: newBalance }
      } else if (balanceDifference > 0.01) {
        // 초이스 변경 등으로 재계산이 필요한 경우
        // 저장된 잔액(또는 사용자 입력)이 있고 계산값이 0이면 덮어쓰지 않음 (페이지 로드 시 $195 → $0 리셋 방지)
        if (calculatedBalance === 0 && currentBalance > 0) {
          prevBalanceDepsRef.current = { ...currentDeps, onSiteBalanceAmount: currentBalance }
        } else {
          setFormData((prev: typeof formData) => ({
            ...prev,
            onSiteBalanceAmount: calculatedBalance,
            balanceAmount: calculatedBalance
          }))
          prevBalanceDepsRef.current = { ...currentDeps, onSiteBalanceAmount: calculatedBalance }
        }
      } else {
        // 의존성은 변경되었지만 잔액 차이가 작으면 의존성만 업데이트
        prevBalanceDepsRef.current = { ...currentDeps, onSiteBalanceAmount: currentBalance }
      }
    }
  }, [calculateTotalCustomerPayment, formData.depositAmount, calculatedBalanceReceivedTotal, formData.choiceTotal, formData.choicesTotal, formData.not_included_price, formData.adults, formData.child, formData.infant, setFormData])

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
    
    // 채널의 commission_percent 가져오기
    const channelCommissionPercent = selectedChannel 
      ? (() => {
          const ch = selectedChannel as any
          return ch.commission_percent || ch.commission_rate || ch.commission || 0
        })()
      : 0
    
    if (formData.productPriceTotal > 0) {
      // 할인 후 상품가 계산 (불포함 가격 제외)
      // 할인 후 상품가 = OTA 판매가 - 쿠폰 할인 - 추가 할인
      const discountedPrice = formData.productPriceTotal - formData.couponDiscount - formData.additionalDiscount
      
      if (discountedPrice > 0) {
        const currentDeposit = formData.depositAmount || 0
        const priceDifference = Math.abs(currentDeposit - discountedPrice)
        
        // OTA 채널의 경우: depositAmount, onlinePaymentAmount, commission_base_price 모두 업데이트
        if (isOTAChannel) {
          // depositAmount가 0이거나, 현재 값이 할인 후 상품가와 차이가 0.01 이상이면 업데이트
          if (currentDeposit === 0 || priceDifference > 0.01) {
            // 잔액도 함께 계산하여 업데이트
            const totalCustomerPayment = calculateTotalCustomerPayment()
            const totalPaid = discountedPrice + calculatedBalanceReceivedTotal
            const calculatedBalance = Math.max(0, totalCustomerPayment - totalPaid)
            
            // 채널 결제 금액 계산 (Returned 차감)
            const adjustedBasePrice = Math.max(0, discountedPrice - returnedAmount)
            
            // 채널 수수료 계산 (commission_amount가 0일 때만)
            const currentCommissionAmount = formData.commission_amount || 0
            const commissionPercent = (formData.commission_percent && formData.commission_percent > 0) 
              ? formData.commission_percent 
              : (channelCommissionPercent || 0)
            const calculatedCommission = (currentCommissionAmount === 0 && commissionPercent > 0 && adjustedBasePrice > 0)
              ? adjustedBasePrice * (commissionPercent / 100)
              : currentCommissionAmount
            
            const existingBalance = formData.onSiteBalanceAmount ?? 0
            const balanceToUse = (calculatedBalance === 0 && existingBalance > 0) ? existingBalance : calculatedBalance
            setFormData((prev: typeof formData) => ({
              ...prev,
              depositAmount: discountedPrice,
              onlinePaymentAmount: discountedPrice,
              commission_base_price: discountedPrice,
              commission_amount: calculatedCommission,
              onSiteBalanceAmount: balanceToUse,
              balanceAmount: balanceToUse
            }))
          }
        } else {
          // 일반 채널: 입금 내역이 있는 경우에는 업데이트하지 않음
          if (formData.depositAmount > 0) {
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
  }, [formData.productPriceTotal, formData.couponDiscount, formData.additionalDiscount, formData.depositAmount, formData.channelId, formData.not_included_price, formData.adults, formData.child, formData.infant, formData.commission_amount, formData.commission_percent, channels, returnedAmount, calculateTotalCustomerPayment, calculatedBalanceReceivedTotal, setFormData])

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

  // 채널의 commission_percent 가져오기 (여러 필드명 지원)
  // channels 테이블에는 commission 컬럼이 있음 (commission_percent는 없을 수 있음)
  const channelCommissionPercent = selectedChannel
    ? (() => {
        const percent = selectedChannel.commission_percent ?? selectedChannel.commission_rate ?? selectedChannel.commission
        return percent ? Number(percent) : 0
      })()
    : 0
  
  // commission_amount가 0일 때 채널 수수료 자동 계산 (값이 실제로 다를 때만 set, 무한 루프 방지)
  useEffect(() => {
    if (!isOTAChannel || isCardFeeManuallyEdited.current) return
    const currentCommissionAmount = formData.commission_amount || 0
    if (currentCommissionAmount !== 0) return

    const basePrice = formData.commission_base_price !== undefined
      ? formData.commission_base_price
      : (formData.onlinePaymentAmount || (() => {
          const discountedPrice = formData.productPriceTotal - formData.couponDiscount - formData.additionalDiscount
          return discountedPrice > 0 ? discountedPrice : formData.subtotal
        })())
    const adjustedBasePrice = Math.max(0, basePrice - returnedAmount)
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
  }, [returnedAmount, isOTAChannel, formData.commission_base_price, formData.onlinePaymentAmount, formData.commission_percent, formData.commission_amount, formData.productPriceTotal, formData.couponDiscount, formData.additionalDiscount, formData.subtotal, channelCommissionPercent, setFormData])

  // 채널 결제 금액이 변경될 때 commission_amount 자동 재계산 (commission_amount가 0일 때만, 동일 값이면 set 안 함)
  useEffect(() => {
    if (!isOTAChannel || isCardFeeManuallyEdited.current) return
    const currentCommissionAmount = formData.commission_amount || 0
    if (currentCommissionAmount !== 0) return

    const basePrice = formData.commission_base_price !== undefined
      ? formData.commission_base_price
      : (formData.onlinePaymentAmount || (() => {
          const discountedPrice = formData.productPriceTotal - formData.couponDiscount - formData.additionalDiscount
          return discountedPrice > 0 ? discountedPrice : formData.subtotal
        })())
    const adjustedBasePrice = Math.max(0, basePrice - returnedAmount)
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
  }, [formData.commission_base_price, formData.onlinePaymentAmount, isOTAChannel, returnedAmount, formData.commission_percent, formData.commission_amount, formData.productPriceTotal, formData.couponDiscount, formData.additionalDiscount, formData.subtotal, channelCommissionPercent, setFormData])
  
  // 채널 변경 시 commission_percent 초기화 (채널이 변경되면 새로운 채널의 commission_percent를 사용)
  const prevChannelIdRef = useRef<string | undefined>(undefined)
  
  // 채널의 pricing_type 확인 (단일 가격 모드 체크)
  const pricingType = selectedChannel?.pricing_type || 'separate'
  const isSinglePrice = pricingType === 'single'
  
  // 초이스별 불포함 금액 계산 (항상 dynamic_pricing에서 조회)
  const calculateChoiceNotIncludedTotal = useCallback(async () => {
    if (!formData.productId || !formData.tourDate || !formData.channelId) {
      return 0
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
        return 0
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
          return defaultNotIncludedPrice * (formData.adults + formData.child + formData.infant)
        }
      }

      // 선택된 초이스별 불포함 금액 계산
      let totalNotIncluded = 0
      
      // 새로운 간결한 초이스 시스템 (selectedChoices가 배열인 경우)
      if (Array.isArray(formData.selectedChoices)) {
        formData.selectedChoices.forEach((choice: { choice_id?: string; id?: string; option_id?: string }) => {
          // choices_pricing의 키는 choice_id 또는 option_id일 수 있음
          const choiceId = choice.choice_id || choice.id
          const optionId = choice.option_id
          
          // 먼저 option_id로 찾고, 없으면 choice_id로 찾기
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
            // 불포함 금액은 인원당 금액이므로 인원수만 곱함 (quantity는 초이스 옵션 수량이므로 불포함 금액 계산에는 사용하지 않음)
            totalNotIncluded += choiceNotIncludedPrice * (formData.adults + formData.child + formData.infant)
          }
        })
      } else if (formData.selectedChoices && typeof formData.selectedChoices === 'object') {
        // 기존 객체 형태의 selectedChoices 처리
        Object.entries(formData.selectedChoices).forEach(([choiceId]) => {
          if (choicesPricing[choiceId]) {
            const choicePricing = choicesPricing[choiceId]
            const choiceNotIncludedPrice = choicePricing.not_included_price !== undefined && choicePricing.not_included_price !== null
              ? choicePricing.not_included_price
              : defaultNotIncludedPrice
            totalNotIncluded += choiceNotIncludedPrice * (formData.adults + formData.child + formData.infant)
          }
        })
      }

      // 선택된 초이스가 없으면 기본 불포함 금액 사용
      if (totalNotIncluded === 0 && defaultNotIncludedPrice > 0) {
        totalNotIncluded = defaultNotIncludedPrice * (formData.adults + formData.child + formData.infant)
      }

      return totalNotIncluded
    } catch (error) {
      console.error('초이스별 불포함 금액 계산 오류:', error)
      return (formData.not_included_price || 0) * (formData.adults + formData.child + formData.infant)
    }
  }, [formData.productId, formData.tourDate, formData.channelId, (formData as any).variantKey, formData.selectedChoices, formData.adults, formData.child, formData.infant, formData.not_included_price])

  const [choiceNotIncludedTotal, setChoiceNotIncludedTotal] = useState(0)

  // 초이스별 불포함 금액 업데이트 (productId, tourDate, channelId 있을 때 항상 조회)
  useEffect(() => {
    if (formData.productId && formData.tourDate && formData.channelId) {
      calculateChoiceNotIncludedTotal().then(total => {
        setChoiceNotIncludedTotal(total)
        setFormData((prev: typeof formData) => {
          const prevTotal = (prev as any).choiceNotIncludedTotal
          return prevTotal === total ? prev : { ...prev, choiceNotIncludedTotal: total }
        })
      })
    } else {
      setChoiceNotIncludedTotal(0)
      setFormData((prev: typeof formData) => {
        const prevTotal = (prev as any).choiceNotIncludedTotal
        return prevTotal === 0 ? prev : { ...prev, choiceNotIncludedTotal: 0 }
      })
    }
  }, [calculateChoiceNotIncludedTotal, formData.productId, formData.tourDate, formData.channelId, setFormData])

  // Net 가격 계산
  const calculateNetPrice = () => {
    // OTA 채널일 때는 단순 계산: OTA 판매가 - 쿠폰 할인 + 추가비용 - 커미션
    if (isOTAChannel) {
      const otaSalePrice = formData.productPriceTotal // OTA 판매가 (초이스 포함)
      const afterCoupon = otaSalePrice - formData.couponDiscount - formData.additionalDiscount + formData.additionalCost
      
      let commissionAmount = 0
      if (formData.commission_amount > 0) {
        commissionAmount = formData.commission_amount
      } else {
        commissionAmount = afterCoupon * (formData.commission_percent / 100)
      }
      
      return afterCoupon - commissionAmount
    }
    
    const totalPrice = formData.subtotal - formData.couponDiscount - formData.additionalDiscount + formData.additionalCost + formData.optionTotal + reservationOptionsTotalPrice
    
    // commission_base_price_only가 true인 경우, 판매가격에만 커미션 적용
    if (commissionBasePriceOnly) {
      const baseProductPrice = calculateProductPriceTotal()
      const choicesTotal = formData.choicesTotal || formData.choiceTotal || 0
      // 초이스별 불포함 금액 사용 (없으면 기본 불포함 금액)
      const notIncludedTotal = choiceNotIncludedTotal > 0 
        ? choiceNotIncludedTotal 
        : (formData.not_included_price || 0) * (formData.adults + formData.child + formData.infant)
      
      // 판매가격만 계산 (초이스와 불포함 금액 제외)
      const basePriceForCommission = baseProductPrice - formData.couponDiscount - formData.additionalDiscount + formData.additionalCost
      
      let commissionAmount = 0
      if (formData.commission_amount > 0) {
        commissionAmount = formData.commission_amount
      } else {
        commissionAmount = basePriceForCommission * (formData.commission_percent / 100)
      }
      
      // Net = 판매가격 - 커미션 + 초이스 + 불포함 금액 (커미션 적용 안 됨)
      return basePriceForCommission - commissionAmount + choicesTotal + notIncludedTotal
    } else {
      // 기존 로직: 전체 가격에 커미션 적용
      if (formData.commission_amount > 0) {
        return totalPrice - formData.commission_amount
      } else {
        return totalPrice * (1 - formData.commission_percent / 100)
      }
    }
  }

  // 초이스별 구매가 총합 계산
  const calculateChoiceCostTotal = useCallback(async () => {
    if (!formData.productId || !formData.tourDate || !formData.channelId) {
      return 0
    }

    try {
      const variantKey = (formData as any).variantKey || 'default'
      let pricingData: any[] | null = null
      let queryError: any = null
      const { data: data1, error: err1 } = await supabase
        .from('dynamic_pricing')
        .select('choices_pricing, updated_at')
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
            .select('choices_pricing, updated_at')
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
            .select('choices_pricing, updated_at')
            .eq('product_id', formData.productId)
            .eq('date', formData.tourDate)
            .eq('channel_id', formData.channelId)
            .order('updated_at', { ascending: false })
            .limit(1)
          if ((dataAny?.length ?? 0) > 0) pricingData = dataAny
        }
      }
      if (queryError || !pricingData || pricingData.length === 0) {
        return 0
      }

      const pricing = pricingData[0] as { choices_pricing?: any }
      if (!pricing.choices_pricing || typeof pricing.choices_pricing !== 'object') {
        return 0
      }

      let totalCost = 0

      // 새로운 간결한 초이스 시스템 (selectedChoices가 배열인 경우)
      if (Array.isArray(formData.selectedChoices)) {
        formData.selectedChoices.forEach((choice: { choice_id?: string; id?: string; option_id?: string; quantity?: number }) => {
          const choiceId = choice.choice_id || choice.id
          const optionId = choice.option_id
          const quantity = choice.quantity || 1

          // choices_pricing에서 구매가 찾기
          const choicePricing = (choiceId && pricing.choices_pricing[choiceId]) || (optionId && pricing.choices_pricing[optionId])
          if (choicePricing) {
            const adultCost = choicePricing.adult_cost_price || 0
            const childCost = choicePricing.child_cost_price || 0
            const infantCost = choicePricing.infant_cost_price || 0
            
            // 인원별 구매가 계산
            totalCost += (adultCost * (formData.adults || 0)) + 
                        (childCost * (formData.child || 0)) + 
                        (infantCost * (formData.infant || 0))
            totalCost *= quantity
          }
        })
      } else if (formData.selectedChoices && typeof formData.selectedChoices === 'object') {
        // 기존 객체 형태의 selectedChoices 처리
        Object.entries(formData.selectedChoices).forEach(([key, value]: [string, any]) => {
          const choiceId = value?.choice_id || value?.id || key
          const choicePricing = pricing.choices_pricing[choiceId]
          if (choicePricing) {
            const adultCost = choicePricing.adult_cost_price || 0
            const childCost = choicePricing.child_cost_price || 0
            const infantCost = choicePricing.infant_cost_price || 0
            
            totalCost += (adultCost * (formData.adults || 0)) + 
                        (childCost * (formData.child || 0)) + 
                        (infantCost * (formData.infant || 0))
          }
        })
      }

      return totalCost
    } catch (error) {
      console.error('초이스 구매가 계산 오류:', error)
      return 0
    }
  }, [formData.productId, formData.tourDate, formData.channelId, (formData as any).variantKey, formData.selectedChoices, formData.adults, formData.child, formData.infant])

  // 초이스 구매가 총합 상태
  const [choiceCostTotal, setChoiceCostTotal] = useState(0)
  // 정산 카드 하단 설명 표시 (모바일: 클릭 시 토글)
  const [expandedSettlementCard, setExpandedSettlementCard] = useState<string | null>(null)

  // 초이스 구매가 총합 업데이트 (formData.choicesTotal은 의존성에서 제외 - 우리가 설정하는 값이라 루프 방지)
  useEffect(() => {
    const updateChoiceCostTotal = async () => {
      const cost = await calculateChoiceCostTotal()
      setChoiceCostTotal(cost)
      // 값이 실제로 바뀔 때만 setFormData (무한 루프 방지)
      setFormData((prev: any) =>
        prev.choicesTotal === cost ? prev : { ...prev, choicesTotal: cost }
      )
    }
    updateChoiceCostTotal()
  }, [calculateChoiceCostTotal, setFormData])

  // 수익 계산 (Net 가격 - 예약 지출 총합 - 투어 지출 총합 - 초이스 구매가 총합)
  const calculateProfit = useCallback(() => {
    const netPrice = calculateNetPrice()
    return netPrice - reservationExpensesTotal - tourExpensesTotal - choiceCostTotal
  }, [calculateNetPrice, reservationExpensesTotal, tourExpensesTotal, choiceCostTotal])

  // 커미션 기본값 설정 및 자동 업데이트 (할인 후 상품가 우선, 없으면 OTA 판매가, 없으면 소계)
  const otaSalePrice = formData.onlinePaymentAmount ?? 0
  const currentCommissionBase = formData.commission_base_price ?? 0
  // 할인 후 상품가 = 상품가격 - 쿠폰할인 - 추가할인
  const discountedProductPrice = formData.productPriceTotal - formData.couponDiscount - formData.additionalDiscount
  
  // 채널 결제 금액이 0일 때 할인 후 상품가로 자동 설정 (모든 채널)
  // 할인 후 상품가가 업데이트되면 채널 결제 금액도 자동 업데이트
  useEffect(() => {
    // 불포함 가격 계산
    const notIncludedPrice = (formData.not_included_price || 0) * (formData.adults + formData.child + formData.infant)
    // 할인 후 상품가에서 불포함 가격 제외
    const discountedPrice = formData.productPriceTotal - formData.couponDiscount - formData.additionalDiscount - notIncludedPrice
    
    if (discountedPrice > 0) {
      // 채널 결제 금액이 0이거나 없을 때, 또는 할인 후 상품가와 차이가 있을 때 업데이트
      // prev를 사용하여 이전 값과 비교 (무한 루프 방지)
      setFormData((prev: typeof formData) => {
        const currentOnlinePaymentAmount = prev.onlinePaymentAmount || 0
        const priceDifference = Math.abs(currentOnlinePaymentAmount - discountedPrice)
        
        // 채널 결제 금액이 0이거나, 할인 후 상품가와 차이가 0.01 이상이면 업데이트
        // (사용자가 수동으로 변경한 경우를 방지하기 위해 차이가 클 때만 업데이트)
        if (currentOnlinePaymentAmount === 0 || (priceDifference > 0.01 && !isChannelPaymentAmountFocused)) {
          return {
            ...prev,
            onlinePaymentAmount: discountedPrice,
            commission_base_price: isOTAChannel ? (prev.commission_base_price || discountedPrice) : prev.commission_base_price
          }
        }
        return prev
      })
    }
  }, [formData.productPriceTotal, formData.couponDiscount, formData.additionalDiscount, formData.not_included_price, formData.adults, formData.child, formData.infant, isOTAChannel, isChannelPaymentAmountFocused, setFormData])

  // 채널 변경 시 선택된 쿠폰이 해당 채널에 속하지 않으면 쿠폰 초기화 (ota가 아닐 때 Homepage 쿠폰은 유지)
  useEffect(() => {
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
  }, [formData.channelId, formData.couponCode, coupons, homepageChannelId, isOTAChannel, setFormData])

  // 인원 변경 시 쿠폰 할인 재계산 (percentage 타입 쿠폰만)
  useEffect(() => {
    if (formData.couponCode) {
      const selectedCoupon = coupons.find(c => 
        c.coupon_code && 
        c.coupon_code.trim().toLowerCase() === formData.couponCode.trim().toLowerCase()
      )
      
      // percentage 타입 쿠폰인 경우에만 재계산 (fixed 타입은 금액이 고정이므로 재계산 불필요)
      if (selectedCoupon && selectedCoupon.discount_type === 'percentage') {
        // 불포함 가격 계산 (쿠폰 할인 계산에서 제외)
        const notIncludedPrice = (formData.not_included_price || 0) * (formData.adults + formData.child + formData.infant)
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
    formData.adults,
    formData.child,
    formData.infant,
    formData.choicesTotal,
    formData.choiceTotal,
    isOTAChannel,
    calculateProductPriceTotal,
    calculateChoiceTotal,
    calculateCouponDiscount,
    coupons,
    formData.couponDiscount,
    setFormData
  ])

  // depositAmount 변경 시 채널 결제 금액 자동 업데이트 (입력 중이 아닐 때만)
  useEffect(() => {
    // 사용자가 채널 결제 금액을 입력 중이면 자동 업데이트하지 않음
    if (isChannelPaymentAmountFocused) {
      return
    }
    
    // depositAmount가 변경되고, onlinePaymentAmount가 없거나 0이거나 depositAmount와 다를 때 업데이트
    if (formData.depositAmount > 0) {
      const currentOnlinePaymentAmount = formData.onlinePaymentAmount || 0
      // depositAmount와 onlinePaymentAmount가 다르면 업데이트 (사용자가 수동으로 변경한 경우를 제외하기 위해 0.01 이상 차이날 때만)
      if (Math.abs(currentOnlinePaymentAmount - formData.depositAmount) > 0.01) {
        setFormData((prev: typeof formData) => {
          const updated: any = {
            ...prev,
            onlinePaymentAmount: formData.depositAmount
          }
          
          // OTA 채널인 경우 commission_base_price도 업데이트
          if (isOTAChannel) {
            updated.commission_base_price = formData.depositAmount
            // commission_amount가 0일 때만 자동 계산
            const currentCommissionAmount = prev.commission_amount || 0
            if (currentCommissionAmount === 0) {
              const commissionPercent = prev.commission_percent || channelCommissionPercent || 0
              const adjustedBasePrice = Math.max(0, formData.depositAmount - returnedAmount)
              const calculatedCommission = adjustedBasePrice * (commissionPercent / 100)
              updated.commission_amount = calculatedCommission
            }
          }
          
          return updated
        })
      }
    }
  }, [
    formData.depositAmount,
    formData.onlinePaymentAmount,
    isOTAChannel,
    channelCommissionPercent,
    returnedAmount,
    isChannelPaymentAmountFocused,
    setFormData
  ])

  // 채널 수수료율 로드 확인 및 설정
  useEffect(() => {
    if (!selectedChannel || !isOTAChannel) return
    if (channelCommissionPercent === undefined || channelCommissionPercent === null) return
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
    setFormData
  ])

  // 채널 변경 감지: 채널을 바꾸면 이전 채널의 commission 보호 해제 후 새 채널 기준으로 재계산
  useEffect(() => {
    if (formData.channelId !== prevChannelIdRef.current) {
      prevChannelIdRef.current = formData.channelId
      loadedCommissionAmountRef.current = null
      if (isOTAChannel && channelCommissionPercent > 0) {
        const basePrice = formData.commission_base_price !== undefined
          ? formData.commission_base_price
          : (discountedProductPrice > 0 ? discountedProductPrice : (otaSalePrice > 0 ? otaSalePrice : formData.subtotal))
        const calculatedAmount = basePrice * (channelCommissionPercent / 100)
        setFormData((prev: typeof formData) => ({
          ...prev,
          commission_percent: channelCommissionPercent,
          commission_amount: calculatedAmount
        }))
      }
    }
  }, [formData.channelId, isOTAChannel, channelCommissionPercent, formData.commission_base_price, discountedProductPrice, otaSalePrice, formData.subtotal, setFormData])

  // 채널의 commission_percent를 기본값으로 설정 (초기 로딩 시 또는 commission_percent가 0일 때)
  useEffect(() => {
    if (!isOTAChannel) return
    // 이미 채널 수수료율과 동일하면 set 하지 않음 (무한 루프 방지, channelCommissionPercent 0 포함)
    if (formData.commission_percent === channelCommissionPercent) return
    if (channelCommissionPercent === undefined || channelCommissionPercent === null) return
    // 데이터베이스에서 불러온 commission_amount가 있으면 절대 덮어쓰지 않음
    if (loadedCommissionAmountRef.current !== null && loadedCommissionAmountRef.current > 0) return

    // commission_percent가 없거나 0일 때만, commission_amount도 0일 때만 설정
    const isUnset = (!formData.commission_percent && formData.commission_percent !== 0) || formData.commission_percent === 0
    if (!isUnset || formData.commission_amount !== 0) return

    const basePrice = formData.commission_base_price !== undefined
      ? formData.commission_base_price
      : (discountedProductPrice > 0 ? discountedProductPrice : (otaSalePrice > 0 ? otaSalePrice : formData.subtotal))
    const calculatedAmount = basePrice * (channelCommissionPercent / 100)

    setFormData((prev: typeof formData) => ({
      ...prev,
      commission_percent: channelCommissionPercent,
      commission_amount: prev.commission_amount > 0 ? prev.commission_amount : calculatedAmount
    }))
  }, [isOTAChannel, channelCommissionPercent, formData.commission_percent, formData.commission_amount, formData.commission_base_price, discountedProductPrice, otaSalePrice, formData.subtotal, setFormData])
  
  // commission_base_price / commission_amount 자동 업데이트 (값이 실제로 다를 때만 set, 무한 루프 방지)
  useEffect(() => {
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
    setFormData
  ])

  // 데이터베이스에서 불러온 commission_amount 추적 (자동 계산에 의해 덮어쓰이지 않도록)
  const loadedCommissionAmountRef = useRef<number | null>(null)
  
  // isExistingPricingLoaded가 true이고 commission_amount가 0보다 크면 데이터베이스에서 불러온 값
  useEffect(() => {
    if (isExistingPricingLoaded && formData.commission_amount > 0) {
      loadedCommissionAmountRef.current = formData.commission_amount
    }
  }, [isExistingPricingLoaded, formData.commission_amount])

  // 자체 채널: 채널 결제 금액 변경 시 카드 수수료 기본값 자동 업데이트
  useEffect(() => {
    if (isOTAChannel) return // OTA 채널은 제외
    if (isCardFeeManuallyEdited.current) return // 사용자가 수동으로 입력한 경우 자동 업데이트 안 함
    if (isExistingPricingLoaded) return // 기존 가격 정보가 로드된 경우 자동 업데이트 안 함 (저장된 값 유지)
    
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
    setFormData
  ])

  return (
    <div>
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
                const tempReservationId = `temp_${Date.now()}`
                await savePricingInfo(tempReservationId)
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
                        
                        const newProductPriceTotal = (salePrice * formData.adults) + 
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
                        
                        const newProductPriceTotal = (salePrice * formData.adults) + 
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
                        <span className="text-gray-500">x{formData.adults + formData.child + formData.infant}</span>
                        <span className="font-medium">
                          = ${((formData.adultProductPrice || 0) * (formData.adults + formData.child + formData.infant)).toFixed(2)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-gray-500">x{formData.adults}</span>
                        <span className="font-medium">
                          = ${((formData.adultProductPrice || 0) * formData.adults).toFixed(2)}
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
                          const newProductPriceTotal = (adultTotalPrice * formData.adults) + 
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
                          const newProductPriceTotal = (adultTotalPrice * formData.adults) + 
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
                    const notIncludedTotal = (formData.not_included_price || 0) * (formData.adults + formData.child + formData.infant)
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
                          총: ${((selectedOption.adult_price || 0) * formData.adults).toFixed(2)}
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
              
              <div className="border-t pt-1 flex justify-between items-center">
                <span className="text-sm font-medium text-gray-900">총합</span>
                <span className="text-sm font-bold text-green-600">+${(formData.choiceTotal || formData.choicesTotal || 0).toFixed(2)}</span>
              </div>
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
                      className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                      title="상품, 채널, 날짜에 맞는 쿠폰 자동 선택"
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
                    const selectedCouponCode = e.target.value
                    // 필터링된 쿠폰 목록에서 찾기 (채널이 ota가 아니면 Homepage 연결 쿠폰도 포함)
                    const filteredCoupons = coupons.filter(coupon => 
                      !formData.channelId || 
                      !coupon.channel_id || 
                      coupon.channel_id === formData.channelId ||
                      (!isOTAChannel && homepageChannelId && coupon.channel_id === homepageChannelId)
                    )
                    const selectedCoupon = filteredCoupons.find(coupon => 
                      coupon.coupon_code && 
                      coupon.coupon_code.trim().toLowerCase() === selectedCouponCode.trim().toLowerCase()
                    )
                    
                    // 불포함 가격 계산 (쿠폰 할인 계산에서 제외)
                    const notIncludedPrice = (formData.not_included_price || 0) * (formData.adults + formData.child + formData.infant)
                    // OTA 채널일 때는 OTA 판매가에 직접 쿠폰 할인 적용 (불포함 가격 제외)
                    const subtotal = isOTAChannel 
                      ? formData.productPriceTotal - notIncludedPrice
                      : calculateProductPriceTotal() + calculateChoiceTotal() - notIncludedPrice
                    const couponDiscount = calculateCouponDiscount(selectedCoupon, subtotal)
                    
                    setFormData({
                      ...formData,
                      couponCode: selectedCoupon?.coupon_code || '', // coupons.coupon_code를 저장 (대소문자 구분 없이 사용)
                      couponDiscount: couponDiscount
                    })
                  }}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">쿠폰 선택</option>
                  {coupons
                    .filter(coupon => {
                      // 현재 선택/저장된 쿠폰은 항상 목록에 포함 (reservation_pricing에 저장된 값이 선택되어 보이도록)
                      const isCurrentCoupon = formData.couponCode && coupon.coupon_code &&
                        String(coupon.coupon_code).trim().toLowerCase() === String(formData.couponCode).trim().toLowerCase()
                      if (isCurrentCoupon) return true
                      // 채널 미선택 / 쿠폰 채널 없음 / 선택 채널과 일치 시 표시. 채널 type이 ota가 아니면 Homepage 연결 쿠폰도 표시
                      return !formData.channelId ||
                        !coupon.channel_id ||
                        coupon.channel_id === formData.channelId ||
                        (!isOTAChannel && homepageChannelId && coupon.channel_id === homepageChannelId)
                    })
                    .map((coupon) => {
                      let discountText = '할인 정보 없음'
                      if (coupon.discount_type === 'percentage' && coupon.percentage_value) {
                        discountText = `${coupon.percentage_value}%`
                      } else if (coupon.discount_type === 'fixed' && coupon.fixed_value) {
                        discountText = `$${coupon.fixed_value}`
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
                  return selectedCoupon ? (
                    <div className="mt-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      선택된 쿠폰: {selectedCoupon.coupon_code} (할인: ${formData.couponDiscount.toFixed(2)})
                    </div>
                  ) : null
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
                <span className="text-xs font-medium text-gray-900">
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
                  <span className="text-[10px] text-green-600">-${formData.couponDiscount.toFixed(2)}</span>
                </div>
              )}
              
              <div className="border-t border-gray-200 my-1.5"></div>
              
              {/* 할인 후 상품가 */}
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-gray-700">{isKorean ? '할인 후 상품가' : 'Discounted Product Price'}</span>
                <span className="text-xs font-medium text-gray-900">
                  ${(() => {
                    // 할인 후 상품가 = OTA 판매가 - 쿠폰 할인 - 추가 할인
                    // productPriceTotal은 이미 판매가만 포함하고 있음 (불포함 가격 제외)
                    const discountedPrice = formData.productPriceTotal - formData.couponDiscount - formData.additionalDiscount
                    return discountedPrice.toFixed(2)
                  })()}
                </span>
              </div>
              
              {/* 옵션 추가 */}
              {reservationOptionsTotalPrice > 0 && (
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] text-gray-600">{isKorean ? '+ 옵션 추가' : '+ Options'}</span>
                  <span className="text-[10px] text-gray-700">+${reservationOptionsTotalPrice.toFixed(2)}</span>
                </div>
              )}
              
              <div className="border-t border-gray-200 my-1.5"></div>
              
              {/* 초이스 총액 */}
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-medium text-gray-700">{isKorean ? '초이스 총액' : 'Choices Total'}</span>
                <span className="text-xs font-semibold text-gray-900">
                  +${(formData.choiceTotal || formData.choicesTotal || 0).toFixed(2)}
                </span>
              </div>
              
              {/* 불포함 가격 */}
              {(() => {
                const notIncludedPrice = (formData.not_included_price || 0) * (formData.adults + formData.child + formData.infant)
                return notIncludedPrice > 0 ? (
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[10px] text-gray-600">{isKorean ? '+ 불포함 가격' : '+ Not Included Price'}</span>
                    <span className="text-[10px] text-gray-700">+${notIncludedPrice.toFixed(2)}</span>
                  </div>
                ) : null
              })()}
              
              {/* 추가 할인 */}
              {(formData.additionalDiscount || 0) > 0 && (
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] text-gray-600">{isKorean ? '- 추가 할인' : '- Additional Discount'}</span>
                  <span className="text-[10px] text-red-600">-${(formData.additionalDiscount || 0).toFixed(2)}</span>
                </div>
              )}
              
              {/* 추가 비용 */}
              {(formData.additionalCost || 0) > 0 && (
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] text-gray-600">{isKorean ? '+ 추가 비용' : '+ Additional Cost'}</span>
                  <span className="text-[10px] text-gray-700">+${(formData.additionalCost || 0).toFixed(2)}</span>
                </div>
              )}
              
              {/* 세금 */}
              {(formData.tax || 0) > 0 && (
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] text-gray-600">{isKorean ? '+ 세금' : '+ Tax'}</span>
                  <span className="text-[10px] text-gray-700">+${(formData.tax || 0).toFixed(2)}</span>
                </div>
              )}
              
              {/* 카드 수수료 */}
              {(formData.cardFee || 0) > 0 && (
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] text-gray-600">{isKorean ? '+ 카드 수수료' : '+ Card Fee'}</span>
                  <span className="text-[10px] text-gray-700">+${(formData.cardFee || 0).toFixed(2)}</span>
                </div>
              )}
              
              {/* 선결제 지출 */}
              {(formData.prepaymentCost || 0) > 0 && (
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] text-gray-600">{isKorean ? '+ 선결제 지출' : '+ Prepaid Expenses'}</span>
                  <span className="text-[10px] text-gray-700">+${(formData.prepaymentCost || 0).toFixed(2)}</span>
                </div>
              )}
              
              {/* 선결제 팁 */}
              {(formData.prepaymentTip || 0) > 0 && (
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] text-gray-600">{isKorean ? '+ 선결제 팁' : '+ Prepaid Tips'}</span>
                  <span className="text-[10px] text-gray-700">+${(formData.prepaymentTip || 0).toFixed(2)}</span>
                </div>
              )}
              
              <div className="border-t border-gray-200 my-1.5"></div>
              
              {/* 고객 총 결제 금액 */}
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-sm font-bold text-blue-800">{isKorean ? '고객 총 결제 금액' : 'Total Customer Payment'}</span>
                <span className="text-sm font-bold text-blue-600">
                  ${(() => {
                    // 할인 후 상품가 = 상품 가격 총합 - 쿠폰 할인 - 추가 할인
                    const discountedProductPrice = formData.productPriceTotal - formData.couponDiscount - formData.additionalDiscount
                    
                    // 옵션 추가
                    const optionsTotal = reservationOptionsTotalPrice || 0
                    
                    // 초이스 총액
                    const choicesTotal = formData.choiceTotal || formData.choicesTotal || 0
                    
                    // 불포함 가격
                    const notIncludedPrice = (formData.not_included_price || 0) * (formData.adults + formData.child + formData.infant)
                    const notIncludedTotal = notIncludedPrice
                    
                    // 추가 비용
                    const additionalCost = formData.additionalCost || 0
                    
                    // 세금
                    const tax = formData.tax || 0
                    
                    // 카드 수수료
                    const cardFee = formData.cardFee || 0
                    
                    // 선결제 지출
                    const prepaymentCost = formData.prepaymentCost || 0
                    
                    // 선결제 팁
                    const prepaymentTip = formData.prepaymentTip || 0
                    
                    // 고객 총 결제 금액 = 할인 후 상품가 + 옵션 + 초이스 총액 + 불포함 가격 + 추가 비용 + 세금 + 카드 수수료 + 선결제 지출 + 선결제 팁
                    const totalCustomerPayment = 
                      discountedProductPrice +
                      optionsTotal +
                      choicesTotal +
                      notIncludedTotal +
                      additionalCost +
                      tax +
                      cardFee +
                      prepaymentCost +
                      prepaymentTip
                    
                    return totalCustomerPayment.toFixed(2)
                  })()}
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
              
              {/* 고객 실제 지불액 (보증금) */}
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-gray-700">{isKorean ? '고객 실제 지불액 (보증금)' : 'Customer Payment (Deposit)'}</span>
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
                        
                        // 채널 결제 금액도 같은 값으로 업데이트
                        const updatedData: any = {
                          ...formData,
                          depositAmount: newDepositAmount,
                          onSiteBalanceAmount: calculatedBalance,
                          balanceAmount: calculatedBalance,
                          onlinePaymentAmount: newDepositAmount
                        }
                        
                        // OTA 채널인 경우 commission_base_price도 업데이트
                        if (isOTAChannel) {
                          updatedData.commission_base_price = newDepositAmount
                          // commission_amount가 0일 때만 자동 계산
                          const currentCommissionAmount = formData.commission_amount || 0
                          if (currentCommissionAmount === 0) {
                            const commissionPercent = formData.commission_percent || channelCommissionPercent || 0
                            const adjustedBasePrice = Math.max(0, newDepositAmount - returnedAmount)
                            const calculatedCommission = adjustedBasePrice * (commissionPercent / 100)
                            updatedData.commission_amount = calculatedCommission
                          }
                        }
                        
                        setFormData(updatedData)
                      }}
                      className="w-24 pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-right"
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
                  <span className="text-xs font-medium text-green-600">
                    ${calculatedBalanceReceivedTotal.toFixed(2)}
                  </span>
                </div>
              )}
              
              {/* 잔액 (투어 당일 지불) */}
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-gray-700">{isKorean ? '잔액 (투어 당일 지불)' : 'Remaining Balance (On-site)'}</span>
                <div className="relative">
                  <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                  <input
                    type="number"
                    value={isOnSiteBalanceAmountFocused ? onSiteBalanceAmountInput : (() => {
                      // 고객 총 결제 금액 - 보증금 - 잔금 수령
                      const totalCustomerPayment = calculateTotalCustomerPayment()
                      const totalPaid = formData.depositAmount + calculatedBalanceReceivedTotal
                      const defaultBalance = Math.max(0, totalCustomerPayment - totalPaid)
                      const balanceValue = formData.onSiteBalanceAmount !== undefined && formData.onSiteBalanceAmount !== null 
                        ? formData.onSiteBalanceAmount 
                        : defaultBalance
                      return parseFloat(balanceValue.toString()).toFixed(2)
                    })()}
                    onChange={(e) => {
                      const inputValue = e.target.value
                      setOnSiteBalanceAmountInput(inputValue)
                      const newBalance = Number(inputValue) || 0
                      setFormData({ ...formData, onSiteBalanceAmount: newBalance, balanceAmount: newBalance })
                    }}
                    onFocus={() => {
                      setIsOnSiteBalanceAmountFocused(true)
                      const totalCustomerPayment = calculateTotalCustomerPayment()
                      const totalPaid = formData.depositAmount + calculatedBalanceReceivedTotal
                      const defaultBalance = Math.max(0, totalCustomerPayment - totalPaid)
                      const currentValue = formData.onSiteBalanceAmount !== undefined && formData.onSiteBalanceAmount !== null 
                        ? formData.onSiteBalanceAmount 
                        : defaultBalance
                      setOnSiteBalanceAmountInput(currentValue.toString())
                    }}
                    onBlur={() => {
                      setIsOnSiteBalanceAmountFocused(false)
                      const finalValue = parseFloat(parseFloat(onSiteBalanceAmountInput || '0').toFixed(2))
                      setFormData({ ...formData, onSiteBalanceAmount: finalValue, balanceAmount: finalValue })
                    }}
                    className="w-24 pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-right"
                    step="0.01"
                    placeholder="0"
                  />
                </div>
              </div>
              
              <div className="border-t border-gray-200 my-1.5"></div>
              
              {/* 총 결제 예정 금액 */}
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-semibold text-gray-900">{isKorean ? '총 결제 예정 금액' : 'Total Payment Due'}</span>
                <span className="text-xs font-bold text-blue-600">
                  ${((formData.depositAmount || 0) + (calculatedBalanceReceivedTotal || 0) + (formData.onSiteBalanceAmount || 0)).toFixed(2)}
                </span>
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
              
              {/* 채널 결제 금액 */}
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-medium text-gray-700">{isKorean ? '채널 결제 금액' : 'Channel Payment Amount'}</span>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500">:</span>
                  <div className="relative">
                    <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                    <input
                      type="number"
                      value={isChannelPaymentAmountFocused ? channelPaymentAmountInput : (() => {
                        // depositAmount가 있으면 우선 사용 (인원 변경 등으로 업데이트된 값 반영)
                        if (formData.depositAmount > 0 && !isChannelPaymentAmountFocused) {
                          const baseAmount = formData.onlinePaymentAmount || formData.depositAmount
                          return Math.max(0, baseAmount - returnedAmount).toFixed(2)
                        }
                        
                        if (isOTAChannel) {
                          // OTA 채널: 할인 후 상품가 계산 (불포함 가격 제외하지 않음, productPriceTotal이 이미 판매가만 포함)
                          const discountedPrice = formData.productPriceTotal - formData.couponDiscount - formData.additionalDiscount
                          // onlinePaymentAmount가 없거나 0이면 할인 후 상품가를 기본값으로 사용
                          const baseAmount = formData.onlinePaymentAmount || formData.depositAmount || (discountedPrice > 0 ? discountedPrice : 0)
                          // Returned가 있으면 차감
                          return Math.max(0, baseAmount - returnedAmount).toFixed(2)
                        } else {
                          // 자체 채널: 상품 합계 - 초이스 총액
                          const productSubtotal = (
                            (formData.productPriceTotal - formData.couponDiscount) + 
                            reservationOptionsTotalPrice + 
                            (formData.additionalCost - formData.additionalDiscount) + 
                            formData.tax + 
                            formData.cardFee +
                            formData.prepaymentTip -
                            (formData.onSiteBalanceAmount || 0)
                          )
                          const choicesTotal = formData.choiceTotal || formData.choicesTotal || 0
                          const defaultAmount = productSubtotal - choicesTotal
                          // onlinePaymentAmount가 없거나 0이면 기본값 사용
                          const baseAmount = formData.onlinePaymentAmount || (defaultAmount > 0 ? defaultAmount : 0)
                          // Returned가 있으면 차감
                          return Math.max(0, baseAmount - returnedAmount).toFixed(2)
                        }
                      })()}
                      onChange={(e) => {
                        const inputValue = e.target.value
                        setChannelPaymentAmountInput(inputValue)
                        
                        const numValue = Number(inputValue) || 0
                        // Returned를 고려한 실제 금액
                        const actualAmount = numValue + returnedAmount
                        
                        if (isOTAChannel) {
                          // OTA 채널 로직
                          // 할인 후 상품가 계산 (불포함 가격 제외하지 않음, productPriceTotal이 이미 판매가만 포함)
                          const discountedPrice = formData.productPriceTotal - formData.couponDiscount - formData.additionalDiscount
                          const defaultBasePrice = discountedPrice > 0 ? discountedPrice : formData.subtotal
                          const commissionBasePrice = formData.commission_base_price !== undefined
                            ? formData.commission_base_price
                            : (actualAmount > 0 ? actualAmount : defaultBasePrice)
                          // Returned 차감 후 수수료 계산
                          const adjustedBasePrice = Math.max(0, commissionBasePrice - returnedAmount)
                          const commissionPercent = formData.commission_percent || channelCommissionPercent || 0
                          const calculatedCommission = adjustedBasePrice * (commissionPercent / 100)
                          
                          // commission_amount가 0일 때만 자동 계산
                          const currentCommissionAmount = formData.commission_amount || 0
                          const newCommissionAmount = currentCommissionAmount === 0 ? calculatedCommission : formData.commission_amount
                          
                          if (currentCommissionAmount === 0) {
                            isCardFeeManuallyEdited.current = false // 채널 결제 금액 변경 시 자동 계산 허용
                          }
                          
                          setFormData({
                            ...formData,
                            onlinePaymentAmount: actualAmount,
                            commission_base_price: actualAmount > 0 ? actualAmount : commissionBasePrice,
                            commission_amount: newCommissionAmount
                          })
                        } else {
                          // 자체 채널 로직
                          setFormData({
                            ...formData,
                            onlinePaymentAmount: actualAmount
                          })
                        }
                      }}
                      onFocus={() => {
                        setIsChannelPaymentAmountFocused(true)
                        const currentValue = (() => {
                          if (formData.depositAmount > 0) {
                            const baseAmount = formData.onlinePaymentAmount || formData.depositAmount
                            return Math.max(0, baseAmount - returnedAmount)
                          }
                          if (isOTAChannel) {
                            // 할인 후 상품가 계산 (불포함 가격 제외)
                            const notIncludedPrice = (formData.not_included_price || 0) * (formData.adults + formData.child + formData.infant)
                            const discountedPrice = formData.productPriceTotal - formData.couponDiscount - formData.additionalDiscount - notIncludedPrice
                            const baseAmount = formData.onlinePaymentAmount || (discountedPrice > 0 ? discountedPrice : 0)
                            return Math.max(0, baseAmount - returnedAmount)
                          } else {
                            const productSubtotal = (
                              (formData.productPriceTotal - formData.couponDiscount) + 
                              reservationOptionsTotalPrice + 
                              (formData.additionalCost - formData.additionalDiscount) + 
                              formData.tax + 
                              formData.cardFee +
                              formData.prepaymentTip -
                              (formData.onSiteBalanceAmount || 0)
                            )
                            const choicesTotal = formData.choiceTotal || formData.choicesTotal || 0
                            const defaultAmount = productSubtotal - choicesTotal
                            const baseAmount = formData.onlinePaymentAmount || (defaultAmount > 0 ? defaultAmount : 0)
                            return Math.max(0, baseAmount - returnedAmount)
                          }
                        })()
                        setChannelPaymentAmountInput(currentValue.toString())
                      }}
                      onBlur={() => {
                        setIsChannelPaymentAmountFocused(false)
                        const finalValue = Number(channelPaymentAmountInput) || 0
                        const actualAmount = finalValue + returnedAmount
                        
                        if (isOTAChannel) {
                          // OTA 채널 로직
                          // 할인 후 상품가 계산 (불포함 가격 제외)
                          const notIncludedPrice = (formData.not_included_price || 0) * (formData.adults + formData.child + formData.infant)
                          const discountedPrice = formData.productPriceTotal - formData.couponDiscount - formData.additionalDiscount - notIncludedPrice
                          const defaultBasePrice = discountedPrice > 0 ? discountedPrice : formData.subtotal
                          const commissionBasePrice = formData.commission_base_price !== undefined
                            ? formData.commission_base_price
                            : (actualAmount > 0 ? actualAmount : defaultBasePrice)
                          // Returned 차감 후 수수료 계산
                          const adjustedBasePrice = Math.max(0, commissionBasePrice - returnedAmount)
                          const commissionPercent = formData.commission_percent || channelCommissionPercent || 0
                          const calculatedCommission = adjustedBasePrice * (commissionPercent / 100)
                          
                          // commission_amount가 0일 때만 자동 계산
                          const currentCommissionAmount = formData.commission_amount || 0
                          const newCommissionAmount = currentCommissionAmount === 0 ? calculatedCommission : formData.commission_amount
                          
                          if (currentCommissionAmount === 0) {
                            isCardFeeManuallyEdited.current = false
                          }
                          
                          setFormData({
                            ...formData,
                            onlinePaymentAmount: actualAmount,
                            commission_base_price: actualAmount > 0 ? actualAmount : commissionBasePrice,
                            commission_amount: newCommissionAmount
                          })
                        } else {
                          // 자체 채널 로직
                          setFormData({
                            ...formData,
                            onlinePaymentAmount: actualAmount
                          })
                        }
                        
                        setChannelPaymentAmountInput('')
                      }}
                      className="w-24 pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-right"
                      step="0.01"
                      placeholder="0"
                    />
                  </div>
                  {returnedAmount > 0 && (
                    <span className="text-xs text-gray-500 ml-2">
                      (${(() => {
                        if (isOTAChannel) {
                          const originalAmount = formData.onlinePaymentAmount || (() => {
                            // 할인 후 상품가 계산 (불포함 가격 제외)
                            const notIncludedPrice = (formData.not_included_price || 0) * (formData.adults + formData.child + formData.infant)
                            const discountedPrice = formData.productPriceTotal - formData.couponDiscount - formData.additionalDiscount - notIncludedPrice
                            return discountedPrice > 0 ? discountedPrice : 0
                          })()
                          return originalAmount.toFixed(2)
                        } else {
                          const productSubtotal = (
                            (formData.productPriceTotal - formData.couponDiscount) + 
                            reservationOptionsTotalPrice + 
                            (formData.additionalCost - formData.additionalDiscount) + 
                            formData.tax + 
                            formData.cardFee +
                            formData.prepaymentTip -
                            (formData.onSiteBalanceAmount || 0)
                          )
                          const choicesTotal = formData.choiceTotal || formData.choicesTotal || 0
                          const defaultAmount = productSubtotal - choicesTotal
                          const originalAmount = formData.onlinePaymentAmount || (defaultAmount > 0 ? defaultAmount : 0)
                          return originalAmount.toFixed(2)
                        }
                      })()} - ${returnedAmount.toFixed(2)}) = ${(() => {
                        if (isOTAChannel) {
                          const baseAmount = formData.onlinePaymentAmount || (() => {
                            // 할인 후 상품가 계산 (불포함 가격 제외)
                            const notIncludedPrice = (formData.not_included_price || 0) * (formData.adults + formData.child + formData.infant)
                            const discountedPrice = formData.productPriceTotal - formData.couponDiscount - formData.additionalDiscount - notIncludedPrice
                            return discountedPrice > 0 ? discountedPrice : 0
                          })()
                          return Math.max(0, baseAmount - returnedAmount).toFixed(2)
                        } else {
                          const productSubtotal = (
                            (formData.productPriceTotal - formData.couponDiscount) + 
                            reservationOptionsTotalPrice + 
                            (formData.additionalCost - formData.additionalDiscount) + 
                            formData.tax + 
                            formData.cardFee +
                            formData.prepaymentTip -
                            (formData.onSiteBalanceAmount || 0)
                          )
                          const choicesTotal = formData.choiceTotal || formData.choicesTotal || 0
                          const defaultAmount = productSubtotal - choicesTotal
                          const baseAmount = formData.onlinePaymentAmount || (defaultAmount > 0 ? defaultAmount : 0)
                          return Math.max(0, baseAmount - returnedAmount).toFixed(2)
                        }
                      })()}
                    </span>
                  )}
                  {formData.prepaymentTip > 0 && isOTAChannel && (
                    <span className="text-xs text-gray-500">
                      (+ 팁 ${formData.prepaymentTip.toFixed(2)}) = ${(() => {
                        const baseAmount = formData.onlinePaymentAmount || (() => {
                          // 할인 후 상품가 계산 (불포함 가격 제외)
                          const notIncludedPrice = (formData.not_included_price || 0) * (formData.adults + formData.child + formData.infant)
                          const discountedPrice = formData.productPriceTotal - formData.couponDiscount - formData.additionalDiscount - notIncludedPrice
                          return discountedPrice > 0 ? discountedPrice : 0
                        })()
                        return Math.max(0, baseAmount - returnedAmount + formData.prepaymentTip).toFixed(2)
                      })()}
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
                          value={formData.commission_percent || channelCommissionPercent || 0}
                          onChange={(e) => {
                            const percent = Number(e.target.value) || 0
                            const basePrice = formData.commission_base_price !== undefined 
                              ? formData.commission_base_price 
                              : (formData.onlinePaymentAmount || (() => {
                                  // 할인 후 상품가 계산 (불포함 가격 제외)
                                  const notIncludedPrice = (formData.not_included_price || 0) * (formData.adults + formData.child + formData.infant)
                                  const discountedPrice = formData.productPriceTotal - formData.couponDiscount - formData.additionalDiscount - notIncludedPrice
                                  return discountedPrice > 0 ? discountedPrice : formData.subtotal
                                })())
                            // Returned 차감 후 수수료 계산
                            const adjustedBasePrice = Math.max(0, basePrice - returnedAmount)
                            const calculatedAmount = adjustedBasePrice * (percent / 100)
                            isCardFeeManuallyEdited.current = false // 수수료 % 변경 시 자동 계산 허용
                            setFormData({ 
                              ...formData, 
                              commission_percent: percent,
                              commission_amount: calculatedAmount
                            })
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
                        value={isCommissionAmountFocused ? commissionAmountInput : (formData.commission_amount !== undefined && formData.commission_amount !== null ? formData.commission_amount.toFixed(2) : '0.00')}
                        onChange={(e) => {
                          const inputValue = e.target.value
                          setCommissionAmountInput(inputValue)
                          const newAmount = Number(inputValue) || 0
                          isCardFeeManuallyEdited.current = true
                          console.log('PricingSection: commission_amount 수동 입력:', newAmount)
                          setFormData({ ...formData, commission_amount: newAmount })
                        }}
                        onFocus={() => {
                          setIsCommissionAmountFocused(true)
                          setCommissionAmountInput(formData.commission_amount !== undefined && formData.commission_amount !== null ? formData.commission_amount.toString() : '0')
                        }}
                        onBlur={() => {
                          setIsCommissionAmountFocused(false)
                          const finalAmount = Number(commissionAmountInput) || formData.commission_amount || 0
                          setFormData({ ...formData, commission_amount: finalAmount })
                          setCommissionAmountInput('')
                        }}
                        className="w-24 pl-5 pr-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-right"
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
                              ...formData, 
                              commission_base_price: basePrice,
                              commission_percent: newPercent,
                              commission_amount: newAmount
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
                          value={isCommissionAmountFocused ? commissionAmountInput : (formData.commission_amount !== undefined && formData.commission_amount !== null ? formData.commission_amount.toFixed(2) : '0.00')}
                          onChange={(e) => {
                            const inputValue = e.target.value
                            setCommissionAmountInput(inputValue)
                            const newAmount = Number(inputValue) || 0
                            isCardFeeManuallyEdited.current = true
                            setFormData({ ...formData, commission_amount: newAmount })
                          }}
                          onFocus={() => {
                            setIsCommissionAmountFocused(true)
                            setCommissionAmountInput(formData.commission_amount !== undefined && formData.commission_amount !== null ? formData.commission_amount.toString() : '0')
                          }}
                          onBlur={() => {
                            setIsCommissionAmountFocused(false)
                            const finalAmount = Number(commissionAmountInput) || formData.commission_amount || 0
                            setFormData({ ...formData, commission_amount: finalAmount })
                            setCommissionAmountInput('')
                          }}
                          className="w-24 pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-right"
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
                        const currentAmount = formData.commission_amount || 0
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
              {/* 채널 정산금액 */}
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-bold text-gray-700">{isKorean ? '채널 정산 금액' : 'Channel Settlement Amount'}</span>
                <span className="text-xs font-bold text-blue-600">
                  ${isOTAChannel
                    ? (() => {
                        // Returned 차감 후 채널 결제 금액
                        const adjustedPaymentAmount = Math.max(0, (formData.onlinePaymentAmount || 0) - returnedAmount)
                        return (adjustedPaymentAmount - formData.commission_amount).toFixed(2)
                      })()
                    : (() => {
                        // 자체 채널: 채널 결제 금액(onlinePaymentAmount 또는 상품 합계 - 초이스 총액) - 카드수수료
                        const productSubtotal = (
                          (formData.productPriceTotal - formData.couponDiscount) +
                          reservationOptionsTotalPrice +
                          (formData.additionalCost - formData.additionalDiscount) +
                          formData.tax +
                          formData.cardFee +
                          formData.prepaymentTip -
                          (formData.onSiteBalanceAmount || 0)
                        )
                        const choicesTotal = formData.choiceTotal || formData.choicesTotal || 0
                        const defaultChannelPaymentAmount = productSubtotal - choicesTotal
                        const channelPaymentAmount = formData.onlinePaymentAmount || (defaultChannelPaymentAmount > 0 ? defaultChannelPaymentAmount : 0)
                        // Returned 차감
                        const adjustedPaymentAmount = Math.max(0, channelPaymentAmount - returnedAmount)
                        return (adjustedPaymentAmount - formData.commission_amount).toFixed(2)
                      })()}
                </span>
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
              
              {/* 채널 정산금액 */}
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-medium text-gray-700">{isKorean ? '채널 정산금액' : 'Channel Settlement Amount'}</span>
                <span className="text-xs font-medium text-gray-900">
                  ${isOTAChannel 
                    ? (() => {
                        // Returned 차감 후 채널 결제 금액
                        const adjustedPaymentAmount = Math.max(0, (formData.onlinePaymentAmount || 0) - returnedAmount)
                        return (adjustedPaymentAmount - formData.commission_amount).toFixed(2)
                      })()
                    : (() => {
                        // 자체 채널: 채널 결제 금액(onlinePaymentAmount 또는 상품 합계 - 초이스 총액) - 카드수수료
                        const productSubtotal = (
                          (formData.productPriceTotal - formData.couponDiscount) +
                          reservationOptionsTotalPrice +
                          (formData.additionalCost - formData.additionalDiscount) +
                          formData.tax +
                          formData.cardFee +
                          formData.prepaymentTip -
                          (formData.onSiteBalanceAmount || 0)
                        )
                        const choicesTotal = formData.choiceTotal || formData.choicesTotal || 0
                        const defaultChannelPaymentAmount = productSubtotal - choicesTotal
                        const channelPaymentAmount = formData.onlinePaymentAmount || (defaultChannelPaymentAmount > 0 ? defaultChannelPaymentAmount : 0)
                        // Returned 차감
                        const adjustedPaymentAmount = Math.max(0, channelPaymentAmount - returnedAmount)
                        return (adjustedPaymentAmount - formData.commission_amount).toFixed(2)
                      })()}
                </span>
              </div>
              
              {/* 초이스 총액 */}
              {(formData.choiceTotal || formData.choicesTotal || 0) > 0 && (
                <>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-medium text-gray-700">+ {isKorean ? '초이스 총액' : 'Choices Total'}</span>
                    <span className="text-xs font-medium text-gray-900">
                      +${(formData.choiceTotal || formData.choicesTotal || 0).toFixed(2)}
                    </span>
                  </div>
                  {/* 초이스 구매가 (운영 이익 계산용) - 수정 가능 */}
                  <div className="flex justify-between items-center mb-1.5 p-1.5 bg-orange-50 border border-orange-200 rounded">
                    <div className="flex-1">
                      <label className="block text-[10px] font-medium text-orange-700 mb-0.5">
                        {isKorean ? '초이스 구매가 (운영 이익 계산용)' : 'Choices Cost (for Operating Profit)'}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={(((formData as any).choicesCostTotal as number) || choiceCostTotal || 0) === 0 ? '' : (((formData as any).choicesCostTotal as number) || choiceCostTotal || 0)}
                        onChange={(e) => {
                          const value = e.target.value
                          if (value === '' || value === '-') {
                            setFormData((prev: any) => ({ ...prev, choicesCostTotal: 0 }))
                            setChoiceCostTotal(0)
                            return
                          }
                          const numValue = parseFloat(value)
                          if (!isNaN(numValue) && numValue >= 0) {
                            setFormData((prev: any) => ({ ...prev, choicesCostTotal: numValue }))
                            setChoiceCostTotal(numValue)
                          }
                        }}
                        className="w-full px-1.5 py-0.5 text-xs border border-orange-300 rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500 bg-white"
                        placeholder="자동 불러오기 또는 수동 입력"
                      />
                      <p className="text-[10px] text-orange-600 mt-0.5">
                        {isKorean ? '초이스별 구매가가 자동으로 불러와집니다. 필요시 수정 가능합니다.' : 'Choice cost prices are loaded automatically. You can modify if needed.'}
                      </p>
                    </div>
                    <div className="ml-2 text-right">
                      <div className="text-xs font-medium text-orange-700 mb-0.5">-</div>
                      <div className="text-base font-bold text-orange-700">
                        ${(((formData as any).choicesCostTotal as number) || choiceCostTotal || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </>
              )}
              
              {/* 불포함 가격 */}
              {(() => {
                const notIncludedTotal = choiceNotIncludedTotal > 0 
                  ? choiceNotIncludedTotal 
                  : (formData.not_included_price || 0) * (formData.adults + formData.child + formData.infant)
                return notIncludedTotal > 0 ? (
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-medium text-gray-700">+ {isKorean ? '불포함 가격' : 'Not Included Price'}</span>
                    <span className="text-xs font-medium text-gray-900">
                      +${notIncludedTotal.toFixed(2)}
                    </span>
                  </div>
                ) : null
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
              
              {/* 환불금 */}
              {(() => {
                const hasRefund = refundedAmount > 0 || returnedAmount > 0
                if (!hasRefund) return null
                
                return (
                  <>
                    {refundedAmount > 0 && (
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs font-medium text-red-700">- {isKorean ? '환불금 (우리)' : 'Refunded (Our Side)'}</span>
                        <span className="text-xs font-medium text-red-600">
                          -${refundedAmount.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {returnedAmount > 0 && (
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs font-medium text-red-700">- {isKorean ? '환불금 (파트너)' : 'Returned (Partner)'}</span>
                        <span className="text-xs font-medium text-red-600">
                          -${returnedAmount.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </>
                )
              })()}
              
              <div className="border-t border-gray-200 my-1.5"></div>
              
              {/* 총 매출 */}
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-sm font-bold text-green-800">{isKorean ? '총 매출' : 'Total Revenue'}</span>
                <span className="text-base font-bold text-green-600">
                  ${(() => {
                    // 채널 정산금액 계산 (Returned 반영)
                    const channelSettlementAmount = isOTAChannel 
                      ? (() => {
                          const adjustedPaymentAmount = Math.max(0, (formData.onlinePaymentAmount || 0) - returnedAmount)
                          return adjustedPaymentAmount - formData.commission_amount
                        })()
                      : (() => {
                          // 자체 채널: 채널 결제 금액(잔금 제외) - 카드수수료 (commission_amount에 저장됨)
                          const channelPaymentAmount = (
                            (formData.productPriceTotal - formData.couponDiscount) + 
                            reservationOptionsTotalPrice + 
                            (formData.additionalCost - formData.additionalDiscount) + 
                            formData.tax + 
                            formData.cardFee +
                            formData.prepaymentTip -
                            (formData.onSiteBalanceAmount || 0)
                          )
                          // Returned 차감
                          const adjustedPaymentAmount = Math.max(0, channelPaymentAmount - returnedAmount)
                          return adjustedPaymentAmount - formData.commission_amount
                        })()
                    
                    // 불포함 가격 계산
                    const notIncludedTotal = choiceNotIncludedTotal > 0 
                      ? choiceNotIncludedTotal 
                      : (formData.not_included_price || 0) * (formData.adults + formData.child + formData.infant)
                    
                    // 총 매출 = 채널 정산금액 + 초이스 총액 + 불포함 가격 - 추가할인 + 추가비용 + 세금 + 결제 수수료 + 선결제 지출 - 환불금
                    let totalRevenue = channelSettlementAmount
                    
                    // 초이스 총액
                    const choicesTotal = formData.choiceTotal || formData.choicesTotal || 0
                    if (choicesTotal > 0) {
                      totalRevenue += choicesTotal
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
                    
                    // 환불금 차감
                    totalRevenue -= refundedAmount
                    totalRevenue -= returnedAmount
                    
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
                    // 채널 정산금액 계산 (Returned 반영)
                    const channelSettlementAmount = isOTAChannel 
                      ? (() => {
                          const adjustedPaymentAmount = Math.max(0, (formData.onlinePaymentAmount || 0) - returnedAmount)
                          return adjustedPaymentAmount - formData.commission_amount
                        })()
                      : (() => {
                          // 자체 채널: 채널 결제 금액(잔금 제외) - 카드수수료 (commission_amount에 저장됨)
                          const channelPaymentAmount = (
                            (formData.productPriceTotal - formData.couponDiscount) + 
                            reservationOptionsTotalPrice + 
                            (formData.additionalCost - formData.additionalDiscount) + 
                            formData.tax + 
                            formData.cardFee +
                            formData.prepaymentTip -
                            (formData.onSiteBalanceAmount || 0)
                          )
                          // Returned 차감
                          const adjustedPaymentAmount = Math.max(0, channelPaymentAmount - returnedAmount)
                          return adjustedPaymentAmount - formData.commission_amount
                        })()
                    
                    // 불포함 가격 계산
                    const notIncludedTotal = choiceNotIncludedTotal > 0 
                      ? choiceNotIncludedTotal 
                      : (formData.not_included_price || 0) * (formData.adults + formData.child + formData.infant)
                    
                    // 총 매출 = 채널 정산금액 + 초이스 총액 + 불포함 가격 - 추가할인 + 추가비용 + 세금 + 결제 수수료 + 선결제 지출 - 환불금
                    let totalRevenue = channelSettlementAmount
                    
                    // 초이스 총액
                    const choicesTotal = formData.choiceTotal || formData.choicesTotal || 0
                    if (choicesTotal > 0) {
                      totalRevenue += choicesTotal
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
                    
                    // 환불금 차감
                    totalRevenue -= refundedAmount
                    totalRevenue -= returnedAmount

                    // 초이스 구매가 차감 (운영 이익 계산용)
                    const choicesCost = ((formData as any).choicesCostTotal as number) || choiceCostTotal || 0
                    totalRevenue -= choicesCost

                    // 운영 이익 = 총 매출 - 선결제 팁 - 초이스 구매가
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
                      Net 가격 - 지출 총합{isManiaTour ? ' - 투어 지출' : ''}{choiceCostTotal > 0 ? ' - 초이스 구매가' : ''}
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
