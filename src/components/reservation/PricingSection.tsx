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
  channels = []
}: PricingSectionProps) {
  const locale = useLocale()
  const isKorean = locale === 'ko'
  const [showHelp, setShowHelp] = useState(false)
  const [reservationExpensesTotal, setReservationExpensesTotal] = useState(0)
  const [loadingExpenses, setLoadingExpenses] = useState(false)
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

      const total = data?.reduce((sum: number, expense: { amount?: number }) => sum + (expense.amount || 0), 0) || 0
      console.log('PricingSection: 계산된 지출 총합:', total, '개별 지출:', data?.map((e: { id: string; amount: number; paid_for: string; status: string }) => ({ id: e.id, amount: e.amount, paid_for: e.paid_for, status: e.status })))
      setReservationExpensesTotal(total)
    } catch (error) {
      console.error('예약 지출 조회 중 오류:', error)
      setReservationExpensesTotal(0)
    } finally {
      setLoadingExpenses(false)
    }
  }, [reservationId])

  // 예약 지출 총합 조회
  useEffect(() => {
    fetchReservationExpenses()
  }, [reservationId, fetchReservationExpenses])

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

  // 고객 총 결제금액 계산 (상품 합계 + 초이스 총액 + 세금 + 선결제 지출)
  const calculateTotalCustomerPayment = useCallback(() => {
    // 상품 합계
    const productSubtotal = (
      (formData.productPriceTotal - formData.couponDiscount) + 
      reservationOptionsTotalPrice + 
      (formData.additionalCost - formData.additionalDiscount)
    )
    // 초이스 총액
    const choicesTotal = formData.choiceTotal || formData.choicesTotal || 0
    // 고객 총 결제 금액 = 상품 합계 + 초이스 총액 + 세금 + 선결제 지출
    return productSubtotal + choicesTotal + (formData.tax || 0) + (formData.prepaymentCost || 0)
  }, [
    formData.productPriceTotal,
    formData.couponDiscount,
    formData.additionalCost,
    formData.additionalDiscount,
    formData.choiceTotal,
    formData.choicesTotal,
    formData.tax,
    formData.prepaymentCost,
    reservationOptionsTotalPrice
  ])

  // 입금 내역 조회 및 자동 계산
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

        // 보증금 관련 상태
        if (
          statusLower.includes('partner received') ||
          statusLower.includes('deposit received') ||
          statusLower.includes("customer's cc charged") ||
          statusLower.includes('deposit requested')
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

      console.log('PricingSection: 입금 내역 계산 결과', {
        depositTotal,
        balanceReceivedTotal,
        refundedTotal,
        returnedTotal,
        paymentRecords: paymentRecords.map((r: { payment_status: string; amount: number }) => ({
          status: r.payment_status,
          amount: r.amount
        }))
      })

      // 계산 결과를 state에 저장
      setCalculatedBalanceReceivedTotal(balanceReceivedTotal)
      setRefundedAmount(refundedTotal)
      setReturnedAmount(returnedTotal)

      // depositAmount와 balanceReceivedTotal을 기반으로 잔액 계산
      const totalCustomerPayment = calculateTotalCustomerPayment()
      const totalPaid = depositTotal + balanceReceivedTotal
      const remainingBalance = Math.max(0, totalCustomerPayment - totalPaid)

      // 입금 내역이 있으면 항상 자동으로 업데이트 (입금 내역이 실제 데이터이므로 우선)
      setFormData((prev: typeof formData) => {
        return {
          ...prev,
          // 입금 내역이 있으면 자동으로 업데이트
          depositAmount: depositTotal,
          // 잔금 수령이 있으면 남은 잔액 계산, 없으면 전체 잔액 계산
          onSiteBalanceAmount: remainingBalance,
          balanceAmount: remainingBalance
        }
      })
    } catch (error) {
      console.error('PricingSection: 입금 내역 조회 중 오류', error)
    }
  }, [reservationId, calculateTotalCustomerPayment, setFormData])

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
  useEffect(() => {
    const totalCustomerPayment = calculateTotalCustomerPayment()
    const totalPaid = formData.depositAmount + calculatedBalanceReceivedTotal
    const calculatedBalance = Math.max(0, totalCustomerPayment - totalPaid)
    
    // 잔액이 설정되지 않았거나 0일 때, 또는 초이스가 변경되어 재계산이 필요한 경우 업데이트
    // 초이스 변경을 감지하기 위해 현재 계산된 잔액과 기존 잔액의 차이를 확인
    const balanceDifference = Math.abs((formData.onSiteBalanceAmount || 0) - calculatedBalance)
    
    if (formData.onSiteBalanceAmount === undefined || 
        formData.onSiteBalanceAmount === null || 
        formData.onSiteBalanceAmount === 0 ||
        balanceDifference > 0.01) {
      setFormData((prev: typeof formData) => ({
        ...prev,
        onSiteBalanceAmount: calculatedBalance,
        balanceAmount: calculatedBalance
      }))
    }
  }, [calculateTotalCustomerPayment, formData.depositAmount, calculatedBalanceReceivedTotal, formData.choiceTotal, formData.choicesTotal, formData.onSiteBalanceAmount, setFormData])

  // depositAmount를 할인 후 상품가격으로 자동 업데이트 (상품 가격이나 쿠폰 변경 시)
  useEffect(() => {
    if (formData.productPriceTotal > 0) {
      const discountedPrice = formData.productPriceTotal - formData.couponDiscount - formData.additionalDiscount
      if (discountedPrice > 0) {
        // depositAmount가 0이거나, 현재 값이 이전 할인 후 상품가와 다를 때 업데이트
        // (사용자가 수동으로 변경한 경우를 방지하기 위해 현재 값이 할인 후 상품가와 비슷하면 업데이트)
        const currentDeposit = formData.depositAmount || 0
        const priceDifference = Math.abs(currentDeposit - discountedPrice)
        
        // depositAmount가 0이거나, 현재 값이 할인 후 상품가와 차이가 0.01 이상이면 업데이트
        if (currentDeposit === 0 || priceDifference > 0.01) {
          // 잔액도 함께 계산하여 업데이트
          const totalCustomerPayment = calculateTotalCustomerPayment()
          const totalPaid = discountedPrice + calculatedBalanceReceivedTotal
          const calculatedBalance = Math.max(0, totalCustomerPayment - totalPaid)
          
          setFormData((prev: typeof formData) => ({
            ...prev,
            depositAmount: discountedPrice,
            onSiteBalanceAmount: calculatedBalance,
            balanceAmount: calculatedBalance
          }))
        }
      }
    }
  }, [formData.productPriceTotal, formData.couponDiscount, formData.additionalDiscount, calculateTotalCustomerPayment, calculatedBalanceReceivedTotal, setFormData])

  // 선택된 채널 정보 가져오기
  const selectedChannel = channels?.find(ch => ch.id === formData.channelId)
  const commissionBasePriceOnly = selectedChannel?.commission_base_price_only || false
  const isOTAChannel = selectedChannel && (
    selectedChannel.type?.toLowerCase() === 'ota' || 
    selectedChannel.category === 'OTA'
  )
  
  // 채널의 commission_percent 가져오기 (여러 필드명 지원)
  // channels 테이블에는 commission 컬럼이 있음 (commission_percent는 없을 수 있음)
  const channelCommissionPercent = selectedChannel 
    ? (() => {
        // commission_percent, commission_rate, commission 순서로 확인
        const percent = selectedChannel.commission_percent ?? selectedChannel.commission_rate ?? selectedChannel.commission
        const result = percent ? Number(percent) : 0
        console.log('PricingSection: 채널 수수료율 계산', {
          channelId: selectedChannel.id,
          channelName: selectedChannel.name,
          commission_percent: selectedChannel.commission_percent,
          commission_rate: selectedChannel.commission_rate,
          commission: selectedChannel.commission,
          calculatedPercent: result
        })
        return result
      })()
    : 0
  
  // commission_amount가 0일 때 채널 수수료 자동 계산 (페이지 로딩 시 및 채널 결제 금액 변경 시)
  useEffect(() => {
    if (isOTAChannel && !isCardFeeManuallyEdited.current) {
      // commission_amount가 0이거나 없을 때만 자동 계산
      const currentCommissionAmount = formData.commission_amount || 0
      if (currentCommissionAmount === 0) {
        // 채널 결제 금액 계산 (Returned 차감 포함)
        const basePrice = formData.commission_base_price !== undefined 
          ? formData.commission_base_price 
          : (formData.onlinePaymentAmount || (() => {
              const discountedPrice = formData.productPriceTotal - formData.couponDiscount - formData.additionalDiscount
              return discountedPrice > 0 ? discountedPrice : formData.subtotal
            })())
        const adjustedBasePrice = Math.max(0, basePrice - returnedAmount)
        
        // commission_percent: formData의 값이 0이거나 없으면 채널의 commission_percent 사용
        const commissionPercent = (formData.commission_percent && formData.commission_percent > 0) 
          ? formData.commission_percent 
          : (channelCommissionPercent || 0)
        
        // 수수료 계산: (채널 결제 금액 - Returned) × 수수료%
        if (commissionPercent > 0 && adjustedBasePrice > 0) {
          const calculatedCommission = adjustedBasePrice * (commissionPercent / 100)
          if (calculatedCommission > 0) {
            setFormData((prev: typeof formData) => ({ 
              ...prev, 
              commission_amount: calculatedCommission
            }))
          }
        }
      }
    }
  }, [returnedAmount, isOTAChannel, formData.commission_base_price, formData.onlinePaymentAmount, formData.commission_percent, formData.commission_amount, formData.productPriceTotal, formData.couponDiscount, formData.additionalDiscount, formData.subtotal, channelCommissionPercent, setFormData])
  
  // 채널 결제 금액이 변경될 때 commission_amount 자동 재계산 (commission_amount가 0일 때만)
  useEffect(() => {
    if (isOTAChannel && !isCardFeeManuallyEdited.current) {
      const currentCommissionAmount = formData.commission_amount || 0
      // commission_amount가 0일 때만 자동 재계산
      if (currentCommissionAmount === 0) {
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
        
        if (commissionPercent > 0 && adjustedBasePrice > 0) {
          const calculatedCommission = adjustedBasePrice * (commissionPercent / 100)
          if (calculatedCommission > 0) {
            setFormData((prev: typeof formData) => ({ 
              ...prev, 
              commission_amount: calculatedCommission
            }))
          }
        }
      }
    }
  }, [formData.commission_base_price, formData.onlinePaymentAmount, isOTAChannel, returnedAmount, formData.commission_percent, formData.commission_amount, formData.productPriceTotal, formData.couponDiscount, formData.additionalDiscount, formData.subtotal, channelCommissionPercent, setFormData])
  
  // 채널 변경 시 commission_percent 초기화 (채널이 변경되면 새로운 채널의 commission_percent를 사용)
  const prevChannelIdRef = useRef<string | undefined>(undefined)
  
  // 디버깅: 채널 정보 확인
  // channels 배열 대신 formData.channelId와 selectedChannel의 특정 값들을 의존성으로 사용
  useEffect(() => {
    console.log('PricingSection: 채널 정보 확인', {
      channelsCount: channels?.length || 0,
      channelId: formData.channelId,
      selectedChannel: selectedChannel ? {
        id: selectedChannel.id,
        name: selectedChannel.name,
        type: selectedChannel.type,
        category: selectedChannel.category,
        commission_percent: selectedChannel.commission_percent,
        commission_rate: selectedChannel.commission_rate,
        commission: selectedChannel.commission,
        allKeys: Object.keys(selectedChannel)
      } : null,
      channelCommissionPercent,
      formDataCommissionPercent: formData.commission_percent,
      isOTAChannel
    })
  }, [formData.channelId, selectedChannel?.id, selectedChannel?.commission_percent, selectedChannel?.commission, isOTAChannel, channelCommissionPercent, formData.commission_percent])
  // 채널의 pricing_type 확인 (단일 가격 모드 체크)
  const pricingType = selectedChannel?.pricing_type || 'separate'
  const isSinglePrice = pricingType === 'single'
  
  // 채널의 불포함 가격 정보 확인 (가격 타입 자동 결정)
  const hasNotIncludedPrice = selectedChannel?.has_not_included_price || false
  const notIncludedType = selectedChannel?.not_included_type || 'none'
  // 채널 정보에 따라 가격 타입 자동 결정
  // has_not_included_price가 true이거나 not_included_type이 'none'이 아니면 'dynamic' (불포함 있음)
  // 그렇지 않으면 'base' (불포함 없음)
  const autoPriceType: 'base' | 'dynamic' = (hasNotIncludedPrice || notIncludedType !== 'none') ? 'dynamic' : 'base'
  
  // 채널이 변경되면 가격 타입 자동 업데이트
  useEffect(() => {
    if (formData.channelId && autoPriceType && formData.priceType !== autoPriceType) {
      setFormData((prev: typeof formData) => ({ ...prev, priceType: autoPriceType }))
    }
  }, [formData.channelId, autoPriceType, formData.priceType, setFormData])
  
  // 디버깅용 로그 (개발 환경에서만)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('PricingSection - 채널 정보:', {
        channelId: formData.channelId,
        selectedChannel: selectedChannel ? { 
          id: selectedChannel.id, 
          name: selectedChannel.name, 
          pricing_type: pricingType,
          has_not_included_price: hasNotIncludedPrice,
          not_included_type: notIncludedType
        } : null,
        isSinglePrice,
        autoPriceType,
        currentPriceType: formData.priceType,
        channelsCount: channels?.length || 0
      })
    }
  }, [formData.channelId, selectedChannel, pricingType, isSinglePrice, autoPriceType, formData.priceType, hasNotIncludedPrice, notIncludedType, channels])

  // 초이스별 불포함 금액 계산 (Dynamic Price 타입일 때만)
  const calculateChoiceNotIncludedTotal = useCallback(async () => {
    // Base price 타입일 때는 불포함 금액이 없음
    if (formData.priceType === 'base') {
      return 0
    }
    
    if (!formData.productId || !formData.tourDate || !formData.channelId) {
      return 0
    }

    try {
      // dynamic_pricing에서 choices_pricing 조회
      const { data: pricingData, error } = await supabase
        .from('dynamic_pricing')
        .select('choices_pricing, not_included_price')
        .eq('product_id', formData.productId)
        .eq('date', formData.tourDate)
        .eq('channel_id', formData.channelId)
        .limit(1)

      if (error || !pricingData || pricingData.length === 0) {
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
  }, [formData.productId, formData.tourDate, formData.channelId, formData.selectedChoices, formData.adults, formData.child, formData.infant, formData.not_included_price, formData.priceType])

  const [choiceNotIncludedTotal, setChoiceNotIncludedTotal] = useState(0)

  // 초이스별 불포함 금액 업데이트 (Dynamic Price 타입일 때만)
  useEffect(() => {
    if (formData.priceType === 'dynamic') {
      calculateChoiceNotIncludedTotal().then(total => {
        setChoiceNotIncludedTotal(total)
        // formData에도 업데이트
        setFormData((prev: typeof formData) => ({ ...prev, choiceNotIncludedTotal: total }))
      })
    } else {
      // Base price 타입일 때는 불포함 금액을 0으로 설정
      setChoiceNotIncludedTotal(0)
      setFormData((prev: typeof formData) => ({ ...prev, choiceNotIncludedTotal: 0 }))
    }
  }, [calculateChoiceNotIncludedTotal, formData.priceType, setFormData])

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

  // 수익 계산 (Net 가격 - 예약 지출 총합)
  const calculateProfit = useCallback(() => {
    const netPrice = calculateNetPrice()
    return netPrice - reservationExpensesTotal
  }, [calculateNetPrice, reservationExpensesTotal])

  // 커미션 기본값 설정 및 자동 업데이트 (할인 후 상품가 우선, 없으면 OTA 판매가, 없으면 소계)
  const otaSalePrice = formData.onlinePaymentAmount ?? 0
  const currentCommissionBase = formData.commission_base_price ?? 0
  // 할인 후 상품가 = 상품가격 - 쿠폰할인 - 추가할인
  const discountedProductPrice = formData.productPriceTotal - formData.couponDiscount - formData.additionalDiscount
  
  // 채널 결제 금액이 0일 때 할인 후 상품가로 자동 설정
  useEffect(() => {
    if (isOTAChannel) {
      // 할인 후 상품가 계산
      const discountedPrice = formData.productPriceTotal - formData.couponDiscount - formData.additionalDiscount
      
      // onlinePaymentAmount가 0이거나 없을 때 할인 후 상품가로 설정
      if ((!formData.onlinePaymentAmount || formData.onlinePaymentAmount === 0) && discountedPrice > 0) {
        setFormData((prev: typeof formData) => ({
          ...prev,
          onlinePaymentAmount: discountedPrice,
          commission_base_price: prev.commission_base_price || discountedPrice
        }))
      }
    }
  }, [isOTAChannel, formData.productPriceTotal, formData.couponDiscount, formData.additionalDiscount, formData.onlinePaymentAmount, setFormData])

  // 인원 변경 시 쿠폰 할인 재계산 (percentage 타입 쿠폰만)
  useEffect(() => {
    if (formData.couponCode) {
      const selectedCoupon = coupons.find(c => 
        c.coupon_code && 
        c.coupon_code.trim().toLowerCase() === formData.couponCode.trim().toLowerCase()
      )
      
      // percentage 타입 쿠폰인 경우에만 재계산 (fixed 타입은 금액이 고정이므로 재계산 불필요)
      if (selectedCoupon && selectedCoupon.discount_type === 'percentage') {
        // OTA 채널일 때는 OTA 판매가에 직접 쿠폰 할인 적용
        const subtotal = isOTAChannel 
          ? formData.productPriceTotal 
          : calculateProductPriceTotal() + calculateChoiceTotal()
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
    console.log('PricingSection: 채널 수수료율 설정 useEffect 실행', {
      selectedChannel: selectedChannel ? { id: selectedChannel.id, name: selectedChannel.name } : null,
      isOTAChannel,
      channelCommissionPercent,
      formDataCommissionPercent: formData.commission_percent,
      shouldSet: selectedChannel && isOTAChannel && channelCommissionPercent > 0 && (!formData.commission_percent || formData.commission_percent === 0)
    })
    
    if (selectedChannel && isOTAChannel) {
      // channelCommissionPercent가 0보다 크면 설정 (0이어도 설정 가능하도록 조건 변경)
      if (channelCommissionPercent !== undefined && channelCommissionPercent !== null) {
        // commission_percent가 0이거나 없을 때 채널의 수수료율로 설정
        if (!formData.commission_percent || formData.commission_percent === 0) {
          console.log('채널 수수료율 자동 설정:', {
            channelId: selectedChannel.id,
            channelName: selectedChannel.name,
            channelCommissionPercent,
            currentCommissionPercent: formData.commission_percent
          })
          setFormData((prev: typeof formData) => ({
            ...prev,
            commission_percent: channelCommissionPercent
          }))
        }
      }
    }
  }, [
    selectedChannel,
    isOTAChannel,
    channelCommissionPercent,
    formData.commission_percent,
    setFormData
  ])

  // 채널 변경 감지
  useEffect(() => {
    if (formData.channelId !== prevChannelIdRef.current) {
      prevChannelIdRef.current = formData.channelId
      // 채널이 변경되면 commission_percent를 초기화하여 새 채널의 값을 사용하도록 함
      if (isOTAChannel && channelCommissionPercent > 0) {
        // 데이터베이스에서 불러온 commission_amount가 있으면 절대 덮어쓰지 않음
        if (loadedCommissionAmountRef.current !== null && loadedCommissionAmountRef.current > 0) {
          console.log('PricingSection: 데이터베이스에서 불러온 commission_amount 보호, 채널 변경 시 덮어쓰기 건너뜀:', loadedCommissionAmountRef.current)
          return
        }
        
        // commission_amount가 0보다 크면 데이터베이스에서 불러온 값이므로 건너뜀
        if (formData.commission_amount > 0) {
          console.log('PricingSection: commission_amount가 이미 설정되어 있음, 채널 변경 시 덮어쓰기 건너뜀:', formData.commission_amount)
          return
        }
        
        const basePrice = formData.commission_base_price !== undefined 
          ? formData.commission_base_price 
          : (discountedProductPrice > 0 ? discountedProductPrice : (otaSalePrice > 0 ? otaSalePrice : formData.subtotal))
        const calculatedAmount = basePrice * (channelCommissionPercent / 100)
        console.log('Channel changed - Setting commission_percent from new channel:', {
          channelId: formData.channelId,
          channelCommissionPercent,
          basePrice,
          calculatedAmount,
          currentCommissionAmount: formData.commission_amount,
          loadedCommissionAmount: loadedCommissionAmountRef.current
        })
        
        // 데이터베이스에서 불러온 commission_amount가 있으면 절대 덮어쓰지 않음
        if (loadedCommissionAmountRef.current !== null && loadedCommissionAmountRef.current > 0) {
          console.log('PricingSection: 데이터베이스에서 불러온 commission_amount 보호, 채널 변경 시 덮어쓰기 건너뜀:', loadedCommissionAmountRef.current)
          setFormData((prev: typeof formData) => ({
            ...prev,
            commission_percent: channelCommissionPercent,
            // commission_amount는 데이터베이스 값 유지
            commission_amount: prev.commission_amount > 0 ? prev.commission_amount : calculatedAmount
          }))
        } else if (formData.commission_amount > 0) {
          console.log('PricingSection: commission_amount가 이미 설정되어 있음, 채널 변경 시 덮어쓰기 건너뜀:', formData.commission_amount)
          setFormData((prev: typeof formData) => ({
            ...prev,
            commission_percent: channelCommissionPercent
            // commission_amount는 유지
          }))
        } else {
          setFormData((prev: typeof formData) => ({
            ...prev,
            commission_percent: channelCommissionPercent,
            commission_amount: calculatedAmount
          }))
        }
      }
    }
  }, [formData.channelId, isOTAChannel, channelCommissionPercent, formData.commission_base_price, discountedProductPrice, otaSalePrice, formData.subtotal, setFormData])

  // 채널의 commission_percent를 기본값으로 설정 (초기 로딩 시 또는 commission_percent가 0일 때)
  useEffect(() => {
    if (isOTAChannel && channelCommissionPercent > 0) {
      // 데이터베이스에서 불러온 commission_amount가 있으면 절대 덮어쓰지 않음
      if (loadedCommissionAmountRef.current !== null && loadedCommissionAmountRef.current > 0) {
        console.log('PricingSection: 데이터베이스에서 불러온 commission_amount 보호, 채널 기본값 설정 건너뜀:', loadedCommissionAmountRef.current)
        return
      }
      
      // commission_percent가 0이거나 없을 때만 설정
      // commission_amount가 0보다 크면 데이터베이스에서 불러온 값이므로 건너뜀
      if ((!formData.commission_percent || formData.commission_percent === 0) && formData.commission_amount === 0) {
        const basePrice = formData.commission_base_price !== undefined 
          ? formData.commission_base_price 
          : (discountedProductPrice > 0 ? discountedProductPrice : (otaSalePrice > 0 ? otaSalePrice : formData.subtotal))
        const calculatedAmount = basePrice * (channelCommissionPercent / 100)
        console.log('Setting commission_percent from channel (initial load):', {
          channelCommissionPercent,
          basePrice,
          calculatedAmount,
          currentCommissionAmount: formData.commission_amount,
          loadedCommissionAmount: loadedCommissionAmountRef.current
        })
        
        // 데이터베이스에서 불러온 commission_amount가 있으면 절대 덮어쓰지 않음
        if (loadedCommissionAmountRef.current !== null && loadedCommissionAmountRef.current > 0) {
          console.log('PricingSection: 데이터베이스에서 불러온 commission_amount 보호, 채널 기본값 설정 건너뜀:', loadedCommissionAmountRef.current)
          setFormData((prev: typeof formData) => ({
            ...prev,
            commission_percent: channelCommissionPercent,
            // commission_amount는 데이터베이스 값 유지
            commission_amount: prev.commission_amount > 0 ? prev.commission_amount : calculatedAmount
          }))
        } else if (formData.commission_amount > 0) {
          console.log('PricingSection: commission_amount가 이미 설정되어 있음, 채널 기본값 설정 건너뜀:', formData.commission_amount)
          setFormData((prev: typeof formData) => ({
            ...prev,
            commission_percent: channelCommissionPercent
            // commission_amount는 유지
          }))
        } else {
          setFormData((prev: typeof formData) => ({
            ...prev,
            commission_percent: channelCommissionPercent,
            commission_amount: calculatedAmount
          }))
        }
      }
    }
  }, [isOTAChannel, channelCommissionPercent, formData.commission_percent, formData.commission_amount, formData.commission_base_price, discountedProductPrice, otaSalePrice, formData.subtotal, setFormData])
  
  useEffect(() => {
    const basePrice = discountedProductPrice > 0 ? discountedProductPrice : (otaSalePrice > 0 ? otaSalePrice : formData.subtotal)
    
    if (basePrice > 0) {
      // commission_base_price가 설정되지 않았거나, basePrice와 같으면 자동 업데이트
      if (formData.commission_base_price === undefined || 
          Math.abs(currentCommissionBase - basePrice) < 0.01) {
        if (formData.commission_percent > 0) {
          const calculatedAmount = basePrice * (formData.commission_percent / 100)
          setFormData((prev: typeof formData) => ({ 
            ...prev, 
            commission_base_price: basePrice,
            commission_amount: calculatedAmount
          }))
        } else {
          // commission_percent가 0이면 commission_base_price만 업데이트
          setFormData((prev: typeof formData) => ({ 
            ...prev, 
            commission_base_price: basePrice
          }))
        }
      }
    }
  }, [
    discountedProductPrice,
    otaSalePrice, 
    formData.subtotal, 
    currentCommissionBase, 
    formData.commission_percent,
    formData.commission_base_price,
    formData.productPriceTotal,
    formData.couponDiscount,
    formData.additionalDiscount
  ])

  // 데이터베이스에서 불러온 commission_amount 추적 (자동 계산에 의해 덮어쓰이지 않도록)
  const loadedCommissionAmountRef = useRef<number | null>(null)
  
  // isExistingPricingLoaded가 true이고 commission_amount가 0보다 크면 데이터베이스에서 불러온 값
  useEffect(() => {
    console.log('PricingSection: commission_amount 추적 useEffect', {
      isExistingPricingLoaded,
      commission_amount: formData.commission_amount,
      type: typeof formData.commission_amount
    })
    
    if (isExistingPricingLoaded && formData.commission_amount > 0) {
      loadedCommissionAmountRef.current = formData.commission_amount
      console.log('PricingSection: 데이터베이스에서 불러온 commission_amount 추적:', formData.commission_amount)
    }
  }, [isExistingPricingLoaded, formData.commission_amount])

  // 자체 채널: 채널 결제 금액 변경 시 카드 수수료 기본값 자동 업데이트
  useEffect(() => {
    if (isOTAChannel) return // OTA 채널은 제외
    if (isCardFeeManuallyEdited.current) return // 사용자가 수동으로 입력한 경우 자동 업데이트 안 함
    if (isExistingPricingLoaded) return // 기존 가격 정보가 로드된 경우 자동 업데이트 안 함 (저장된 값 유지)
    
    // 데이터베이스에서 불러온 commission_amount가 있으면 절대 덮어쓰지 않음
    if (loadedCommissionAmountRef.current !== null && loadedCommissionAmountRef.current > 0) {
      console.log('PricingSection: 데이터베이스에서 불러온 commission_amount 보호, 자동 업데이트 건너뜀:', loadedCommissionAmountRef.current)
      return
    }
    
    // commission_amount가 이미 설정되어 있고 0이 아니면 저장된 값이므로 절대 덮어쓰지 않음
    if (formData.commission_amount > 0) {
      console.log('PricingSection: commission_amount가 이미 설정되어 있음, 자동 업데이트 건너뜀:', formData.commission_amount)
      return
    }
    
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
      {/* 구분선 */}
      <div className="border-t border-gray-300 mb-4"></div>
      
      <div className="space-y-2 mb-3">
        {/* 첫 번째 줄: 가격 정보 제목, 가격 타입, 저장/초기화 버튼 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center space-x-3">
            <h3 className="text-sm font-medium text-gray-900">가격 정보</h3>
            {/* 가격 타입 표시 (채널 정보에 따라 자동 결정) */}
            <div className="flex items-center space-x-2">
              <label className="text-xs text-gray-600">가격 타입:</label>
              <select
                value={formData.priceType || autoPriceType || 'dynamic'}
                onChange={async (e) => {
                  const newPriceType = e.target.value as 'base' | 'dynamic'
                  setFormData({ ...formData, priceType: newPriceType })
                  // 가격 타입이 변경되면 가격을 다시 로드
                  if (formData.productId && formData.tourDate && formData.channelId) {
                    // 부모 컴포넌트에 가격 타입 변경 알림 (ReservationForm에서 처리)
                    // 실제 가격 로드는 ReservationForm의 useEffect에서 처리됨
                  }
                }}
                disabled={!!formData.channelId} // 채널이 선택되면 자동 결정되므로 비활성화
                className={`px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 ${
                  formData.channelId ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
                title={formData.channelId ? '채널 정보에 따라 자동으로 결정됩니다' : '가격 타입을 선택하세요'}
              >
                <option value="dynamic">불포함 있음</option>
                <option value="base">불포함 없음</option>
              </select>
              {formData.channelId && (
                <span className="text-xs text-gray-500">(자동)</span>
              )}
            </div>
          </div>
          {/* 저장, 초기화 버튼 */}
          <div className="flex items-center gap-2">
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
                // 가격 정보 초기화
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
        
        {/* 두 번째 줄: 기존 가격 뱃지, 완료 뱃지, 단독 투어 체크박스 */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 기존 가격 정보 표시 */}
          {isExistingPricingLoaded && (
            <span className="px-2 py-1 bg-green-100 border border-green-300 rounded text-xs text-green-700">
              기존 가격
            </span>
          )}
          {/* 매핑 필드 상태 버튼들 */}
          <div className="flex items-center space-x-1">
            {!formData.productId && (
              <div className="px-2 py-1 bg-red-100 border border-red-300 rounded text-xs text-red-700">
                상품
              </div>
            )}
            {!formData.channelId && (
              <div className="px-2 py-1 bg-red-100 border border-red-300 rounded text-xs text-red-700">
                채널
              </div>
            )}
            {!formData.tourDate && (
              <div className="px-2 py-1 bg-red-100 border border-red-300 rounded text-xs text-red-700">
                날짜
              </div>
            )}
            {formData.productId && formData.channelId && formData.tourDate && (
              <div className="px-2 py-1 bg-green-100 border border-green-300 rounded text-xs text-green-700">
                ✓ 완료
              </div>
            )}
          </div>
          {/* 단독 투어 체크박스 */}
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.isPrivateTour}
              onChange={(e) => setFormData({ ...formData, isPrivateTour: e.target.checked })}
              className="mr-1 h-3 w-3 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-xs text-gray-700">단독투어</span>
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
                        const notIncluded = formData.not_included_price || 0
                        const adultTotalPrice = salePrice + notIncluded
                        
                        // 단일 가격 모드일 때는 모든 가격이 동일
                        // 단일 가격 모드가 아닐 때는 각각의 판매가에 불포함 가격을 더함
                        const childSalePrice = formData.childProductPrice || 0
                        const infantSalePrice = formData.infantProductPrice || 0
                        const childTotalPrice = isSinglePrice ? adultTotalPrice : (childSalePrice + notIncluded)
                        const infantTotalPrice = isSinglePrice ? adultTotalPrice : (infantSalePrice + notIncluded)
                        
                        // 상품 가격 총합 계산 (불포함 가격 포함)
                        const newProductPriceTotal = (adultTotalPrice * formData.adults) + 
                                                     (childTotalPrice * formData.child) + 
                                                     (infantTotalPrice * formData.infant)
                        setFormData({ 
                          ...formData, 
                          adultProductPrice: salePrice,
                          // 단일 가격 모드일 때는 아동/유아 가격도 동일하게 설정
                          ...(isSinglePrice ? {
                            childProductPrice: adultTotalPrice,
                            infantProductPrice: adultTotalPrice
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
                        const salePrice = formData.adultProductPrice || 0
                        const adultTotalPrice = salePrice + notIncluded
                        
                        // 단일 가격 모드일 때는 모든 가격이 동일
                        // 단일 가격 모드가 아닐 때는 각각의 판매가에 불포함 가격을 더함
                        const childSalePrice = formData.childProductPrice || 0
                        const infantSalePrice = formData.infantProductPrice || 0
                        const childTotalPrice = isSinglePrice ? adultTotalPrice : (childSalePrice + notIncluded)
                        const infantTotalPrice = isSinglePrice ? adultTotalPrice : (infantSalePrice + notIncluded)
                        
                        // 상품 가격 총합 계산 (불포함 가격 포함)
                        const newProductPriceTotal = (adultTotalPrice * formData.adults) + 
                                                     (childTotalPrice * formData.child) + 
                                                     (infantTotalPrice * formData.infant)
                        setFormData({ 
                          ...formData, 
                          not_included_price: notIncluded,
                          // 단일 가격 모드일 때는 아동/유아 가격도 동일하게 설정
                          ...(isSinglePrice ? {
                            childProductPrice: adultTotalPrice,
                            infantProductPrice: adultTotalPrice
                          } : {}),
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
                    성인 [${((formData.adultProductPrice || 0) + (formData.not_included_price || 0)).toFixed(2)}]
                  </span>
                  <div className="flex items-center space-x-1">
                    {isSinglePrice ? (
                      <>
                        <span className="text-gray-500">x{formData.adults + formData.child + formData.infant}</span>
                        <span className="font-medium">
                          = ${(((formData.adultProductPrice || 0) + (formData.not_included_price || 0)) * (formData.adults + formData.child + formData.infant)).toFixed(2)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-gray-500">x{formData.adults}</span>
                        <span className="font-medium">
                          = ${(((formData.adultProductPrice || 0) + (formData.not_included_price || 0)) * formData.adults).toFixed(2)}
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
                      <span className="font-medium">${(((formData.childProductPrice || 0) + (formData.not_included_price || 0)) * formData.child).toFixed(2)}</span>
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
                      <span className="font-medium">${(((formData.infantProductPrice || 0) + (formData.not_included_price || 0)) * formData.infant).toFixed(2)}</span>
                    </div>
                  </div>
                </>
              )}
              <div className="border-t pt-1 flex justify-between items-center">
                <span className="text-sm font-medium text-gray-900">합계</span>
                <span className="text-sm font-bold text-blue-600">${formData.productPriceTotal.toFixed(2)}</span>
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
                    const selectedCoupon = coupons.find(coupon => 
                      coupon.coupon_code && 
                      coupon.coupon_code.trim().toLowerCase() === selectedCouponCode.trim().toLowerCase()
                    )
                    
                    // OTA 채널일 때는 OTA 판매가에 직접 쿠폰 할인 적용
                    const subtotal = isOTAChannel 
                      ? formData.productPriceTotal 
                      : calculateProductPriceTotal() + calculateChoiceTotal()
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
                  {coupons.map((coupon) => {
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
          <div className="bg-white p-4 rounded border border-gray-200 h-full">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900">가격 계산</h4>
              <button
                type="button"
                onClick={() => setShowHelp(true)}
                className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
              >
                계산 안내
              </button>
            </div>

            {/* 1️⃣ 고객 기준 결제 흐름 (Customer View) */}
            <div className="mb-6 pb-4 border-b-2 border-gray-300">
              <div className="flex items-center mb-3">
                <span className="text-lg mr-2">1️⃣</span>
                <h5 className="text-sm font-semibold text-gray-800">고객 기준 결제 흐름</h5>
                <span className="ml-2 text-xs text-gray-500">(Customer View)</span>
              </div>
              <p className="text-xs text-gray-600 mb-3">👉 고객이 얼마를 부담했는지만 보여주는 영역</p>
              
              {/* 기본 가격 */}
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-700">{isKorean ? '기본 가격' : 'Base Price'}</span>
                <span className="text-sm font-medium text-gray-900">${formData.productPriceTotal.toFixed(2)}</span>
              </div>
              
              {/* 쿠폰 할인 */}
              {formData.couponDiscount > 0 && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-gray-600">{isKorean ? '- 쿠폰 할인' : '- Coupon Discount'}</span>
                  <span className="text-xs text-green-600">-${formData.couponDiscount.toFixed(2)}</span>
                </div>
              )}
              
              <div className="border-t border-gray-200 my-2"></div>
              
              {/* 할인 후 상품가 */}
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-700">{isKorean ? '할인 후 상품가' : 'Discounted Product Price'}</span>
                <span className="text-sm font-medium text-gray-900">${(formData.productPriceTotal - formData.couponDiscount).toFixed(2)}</span>
              </div>
              
              {/* 옵션 추가 */}
              {reservationOptionsTotalPrice > 0 && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-gray-600">{isKorean ? '+ 옵션 추가' : '+ Options'}</span>
                  <span className="text-xs text-gray-700">+${reservationOptionsTotalPrice.toFixed(2)}</span>
                </div>
              )}
              
              {/* 추가 비용(비거주자 등) */}
              {(formData.additionalCost - formData.additionalDiscount) > 0 && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-gray-600">{isKorean ? '+ 추가 비용(비거주자 등)' : '+ Additional Costs'}</span>
                  <span className="text-xs text-gray-700">+${(formData.additionalCost - formData.additionalDiscount).toFixed(2)}</span>
                </div>
              )}
              
              <div className="border-t border-gray-200 my-2"></div>
              
              {/* 상품 합계 */}
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">{isKorean ? '상품 합계' : 'Product Subtotal'}</span>
                <span className="text-sm font-semibold text-gray-900">
                  ${(
                    (formData.productPriceTotal - formData.couponDiscount) +
                    reservationOptionsTotalPrice +
                    (formData.additionalCost - formData.additionalDiscount)
                  ).toFixed(2)}
                </span>
              </div>

              {/* 초이스 총액 */}
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">{isKorean ? '초이스 총액' : 'Choices Total'}</span>
                <span className="text-sm font-semibold text-gray-900">
                  +${(formData.choiceTotal || formData.choicesTotal || 0).toFixed(2)}
                </span>
              </div>

              {/* 결제 수수료 */}
              {formData.cardFee > 0 && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-gray-600">{isKorean ? '+ 결제 수수료' : '+ Payment Processing Fee'}</span>
                  <span className="text-xs text-gray-700">+${formData.cardFee.toFixed(2)}</span>
                </div>
              )}
              
              {/* 세금 */}
              {(formData.tax || 0) > 0 && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-gray-600">{isKorean ? '+ 세금' : '+ Tax'}</span>
                  <span className="text-xs text-gray-700">+${(formData.tax || 0).toFixed(2)}</span>
                </div>
              )}
              
              {/* 선결제 지출 */}
              {(formData.prepaymentCost || 0) > 0 && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-gray-600">{isKorean ? '+ 선결제 지출' : '+ Prepaid Expenses'}</span>
                  <span className="text-xs text-gray-700">+${(formData.prepaymentCost || 0).toFixed(2)}</span>
                </div>
              )}
              
              {/* 선결제 팁 */}
              {formData.prepaymentTip > 0 && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-gray-600">{isKorean ? '+ 선결제 팁' : '+ Prepaid Tips'}</span>
                  <span className="text-xs text-gray-700">+${formData.prepaymentTip.toFixed(2)}</span>
                </div>
              )}
              
              <div className="border-t border-gray-200 my-2"></div>
              
              {/* 고객 총 결제 금액 */}
              <div className="flex justify-between items-center mb-2">
                <span className="text-base font-bold text-blue-800">{isKorean ? '고객 총 결제 금액' : 'Total Customer Payment'}</span>
                <span className="text-base font-bold text-blue-600">
                  ${(() => {
                    // 상품 합계
                    const productSubtotal = (
                      (formData.productPriceTotal - formData.couponDiscount) +
                      reservationOptionsTotalPrice +
                      (formData.additionalCost - formData.additionalDiscount)
                    )
                    // 초이스 총액
                    const choicesTotal = formData.choiceTotal || formData.choicesTotal || 0
                    // 고객 총 결제 금액 = 상품 합계 + 초이스 총액 + 세금 + 선결제 지출
                    return (productSubtotal + choicesTotal + (formData.tax || 0) + (formData.prepaymentCost || 0)).toFixed(2)
                  })()}
                </span>
              </div>
            </div>

            {/* 2️⃣ 고객 실제 지불 내역 (Payment Status) */}
            <div className="mb-6 pb-4 border-b-2 border-gray-300">
              <div className="flex items-center mb-3">
                <span className="text-lg mr-2">2️⃣</span>
                <h5 className="text-sm font-semibold text-gray-800">고객 실제 지불 내역</h5>
                <span className="ml-2 text-xs text-gray-500">(Payment Status)</span>
              </div>
              <p className="text-xs text-gray-600 mb-3">👉 지금 실제로 얼마 냈는지</p>
              
              {/* 고객 실제 지불액 (보증금) */}
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-700">{isKorean ? '고객 실제 지불액 (보증금)' : 'Customer Payment (Deposit)'}</span>
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
                  {reservationId && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          // 할인 후 상품가 계산
                          const discountedPrice = formData.productPriceTotal - formData.couponDiscount - formData.additionalDiscount
                          
                          if (discountedPrice <= 0) {
                            alert(isKorean ? '할인 후 상품가가 0 이하입니다.' : 'Discounted product price is 0 or less.')
                            return
                          }

                          const { data: { session } } = await supabase.auth.getSession()
                          if (!session?.access_token) {
                            alert(isKorean ? '인증이 필요합니다.' : 'Authentication required.')
                            return
                          }

                          const response = await fetch('/api/payment-records', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${session.access_token}`
                            },
                            body: JSON.stringify({
                              reservation_id: reservationId,
                              payment_status: 'Partner Received',
                              amount: discountedPrice,
                              payment_method: 'PAYM033'
                            })
                          })

                          if (!response.ok) {
                            const errorData = await response.json()
                            throw new Error(errorData.error || (isKorean ? '입금 내역 추가 중 오류가 발생했습니다.' : 'Error adding payment record.'))
                          }

                          alert(isKorean ? '입금 내역이 추가되었습니다.' : 'Payment record added successfully.')
                          
                          // 입금 내역 새로고침
                          if (reservationId) {
                            fetchPaymentRecords()
                          }
                        } catch (error) {
                          console.error('입금 내역 추가 오류:', error)
                          alert(isKorean ? `입금 내역 추가 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}` : `Error adding payment record: ${error instanceof Error ? error.message : 'Unknown error'}`)
                        }
                      }}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      {isKorean ? '입금내역 추가' : 'Add Payment'}
                    </button>
                  )}
                </div>
              </div>
              
              {/* 잔금 수령 */}
              {calculatedBalanceReceivedTotal > 0 && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-700">{isKorean ? '잔금 수령' : 'Balance Received'}</span>
                  <span className="text-sm font-medium text-green-600">
                    ${calculatedBalanceReceivedTotal.toFixed(2)}
                  </span>
                </div>
              )}
              
              {/* 잔액 (투어 당일 지불) */}
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-700">{isKorean ? '잔액 (투어 당일 지불)' : 'Remaining Balance (On-site)'}</span>
                <div className="relative">
                  <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                  <input
                    type="number"
                    value={(() => {
                      // 고객 총 결제 금액 - 보증금 - 잔금 수령
                      const totalCustomerPayment = calculateTotalCustomerPayment()
                      const totalPaid = formData.depositAmount + calculatedBalanceReceivedTotal
                      const defaultBalance = Math.max(0, totalCustomerPayment - totalPaid)
                      return formData.onSiteBalanceAmount !== undefined && formData.onSiteBalanceAmount !== null 
                        ? formData.onSiteBalanceAmount 
                        : defaultBalance
                    })()}
                    onChange={(e) => {
                      const newBalance = Number(e.target.value) || 0
                      setFormData({ ...formData, onSiteBalanceAmount: newBalance, balanceAmount: newBalance })
                    }}
                    className="w-24 pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-right"
                    step="0.01"
                    placeholder="0"
                  />
                </div>
              </div>
              
              <div className="border-t border-gray-200 my-2"></div>
              
              {/* 총 결제 예정 금액 */}
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-gray-900">{isKorean ? '총 결제 예정 금액' : 'Total Payment Due'}</span>
                <span className="text-sm font-bold text-blue-600">
                  ${((formData.depositAmount || 0) + (calculatedBalanceReceivedTotal || 0) + (formData.onSiteBalanceAmount || 0)).toFixed(2)}
                </span>
              </div>
            </div>

            {/* 3️⃣ 채널 정산 기준 (Channel / OTA View) */}
            <div className="mb-6 pb-4 border-b-2 border-gray-300">
              <div className="flex items-center mb-3">
                <span className="text-lg mr-2">3️⃣</span>
                <h5 className="text-sm font-semibold text-gray-800">채널 정산 기준</h5>
                <span className="ml-2 text-xs text-gray-500">(Channel / OTA View)</span>
              </div>
              <p className="text-xs text-gray-600 mb-3">👉 플랫폼에서 얼마를 가져가고, 얼마를 보내줬는지</p>
              
              {/* 채널 결제 금액 */}
              <div className="flex justify-between items-center mb-2">
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
                          // OTA 채널: 할인 후 상품가 계산
                          const discountedPrice = formData.productPriceTotal - formData.couponDiscount - formData.additionalDiscount
                          // onlinePaymentAmount가 없거나 0이면 할인 후 상품가를 기본값으로 사용
                          const baseAmount = formData.onlinePaymentAmount || (discountedPrice > 0 ? discountedPrice : 0)
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
                            const discountedPrice = formData.productPriceTotal - formData.couponDiscount - formData.additionalDiscount
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
                            const discountedPrice = formData.productPriceTotal - formData.couponDiscount - formData.additionalDiscount
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
                            const discountedPrice = formData.productPriceTotal - formData.couponDiscount - formData.additionalDiscount
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
                          const discountedPrice = formData.productPriceTotal - formData.couponDiscount - formData.additionalDiscount
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
                                  const discountedPrice = formData.productPriceTotal - formData.couponDiscount - formData.additionalDiscount
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
                    <span className="text-sm font-medium text-gray-700">
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
                          className="w-16 px-1 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-right"
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
                    <span className="text-sm font-medium text-gray-700">
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
                          className="w-24 pl-5 pr-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-right"
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
              
              {/* 채널 정산금액 */}
              {isOTAChannel && <div className="border-t border-gray-200 my-2"></div>}
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-medium text-gray-700">{isKorean ? '채널 정산 금액' : 'Channel Settlement Amount'}</span>
                <span className="text-sm font-bold text-blue-600">
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
              <p className="text-xs text-gray-500 mt-1">✔️ 이 금액은 회사 계좌로 들어오는 돈 | ✔️ 고객 추가 현금, 잔금, 팁 포함 ❌</p>
            </div>

            {/* 4️⃣ 최종 매출 & 운영 이익 (Company View) */}
            <div className="mb-4">
              <div className="flex items-center mb-3">
                <span className="text-lg mr-2">4️⃣</span>
                <h5 className="text-sm font-semibold text-gray-800">최종 매출 & 운영 이익</h5>
                <span className="ml-2 text-xs text-gray-500">(Company View)</span>
              </div>
              <p className="text-xs text-gray-600 mb-3">👉 회사 기준 실제 수익 구조</p>
              
              {/* 채널 정산금액 */}
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">{isKorean ? '채널 정산금액' : 'Channel Settlement Amount'}</span>
                <span className="text-sm font-medium text-gray-900">
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
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">+ {isKorean ? '초이스 총액' : 'Choices Total'}</span>
                <span className="text-sm font-medium text-gray-900">
                  +${(formData.choiceTotal || formData.choicesTotal || 0).toFixed(2)}
                </span>
              </div>
              
              {/* 추가 결제금 */}
              {(() => {
                // 채널 정산금액 계산 (Returned 반영)
                const channelSettlementAmount = isOTAChannel 
                  ? (() => {
                      const adjustedPaymentAmount = Math.max(0, (formData.onlinePaymentAmount || 0) - returnedAmount)
                      return adjustedPaymentAmount - formData.commission_amount
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
                      return adjustedPaymentAmount - formData.commission_amount
                    })()
                
                // 고객 총 결제 금액
                const totalCustomerPayment = calculateTotalCustomerPayment()
                
                // 추가 결제금 = 고객 총 결제 금액 - 채널 수수료$ - 채널 정산 금액 - 잔액
                // (잔액은 이미 별도로 표시되므로 중복 방지)
                const additionalPayment = totalCustomerPayment - formData.commission_amount - channelSettlementAmount - (formData.onSiteBalanceAmount || 0)
                
                return additionalPayment > 0 ? (
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">+ {isKorean ? '추가 결제금' : 'Additional Payment'}</span>
                    <span className="text-sm font-medium text-gray-900">
                      +${additionalPayment.toFixed(2)}
                    </span>
                  </div>
                ) : null
              })()}
              
              {/* 환불금 */}
              {(() => {
                const hasRefund = refundedAmount > 0 || returnedAmount > 0
                if (!hasRefund) return null
                
                return (
                  <>
                    {refundedAmount > 0 && (
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-red-700">- {isKorean ? '환불금 (우리)' : 'Refunded (Our Side)'}</span>
                        <span className="text-sm font-medium text-red-600">
                          -${refundedAmount.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {returnedAmount > 0 && (
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-red-700">- {isKorean ? '환불금 (파트너)' : 'Returned (Partner)'}</span>
                        <span className="text-sm font-medium text-red-600">
                          -${returnedAmount.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </>
                )
              })()}
              
              <div className="border-t border-gray-200 my-2"></div>
              
              {/* 총 매출 */}
              <div className="flex justify-between items-center mb-2">
                <span className="text-base font-bold text-green-800">{isKorean ? '총 매출' : 'Total Revenue'}</span>
                <span className="text-lg font-bold text-green-600">
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
                    
                    // 고객 총 결제 금액
                    const totalCustomerPayment = calculateTotalCustomerPayment()
                    
                    // 추가 결제금 = 고객 총 결제 금액 - 채널 수수료$ - 채널 정산 금액 - 잔액
                    // (잔액은 이미 별도로 표시되므로 중복 방지)
                    const additionalPayment = totalCustomerPayment - formData.commission_amount - channelSettlementAmount - (formData.onSiteBalanceAmount || 0)
                    
                    // 총 매출 = 채널 정산금액 + 초이스 총액 + 추가 결제금 - 환불금
                    // (잔액은 초이스 총액에 포함되어 있으므로 제외)
                    return (
                      channelSettlementAmount +
                      (formData.choiceTotal || formData.choicesTotal || 0) +
                      (additionalPayment > 0 ? additionalPayment : 0) -
                      refundedAmount -
                      returnedAmount
                    ).toFixed(2)
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
              <div className="flex justify-between items-center mb-2">
                <span className="text-base font-bold text-purple-800">{isKorean ? '운영 이익' : 'Operating Profit'}</span>
                <span className="text-lg font-bold text-purple-600">
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
                    
                    // 고객 총 결제 금액
                    const totalCustomerPayment = calculateTotalCustomerPayment()
                    
                    // 추가 결제금 = 고객 총 결제 금액 - 채널 수수료$ - 채널 정산 금액 - 잔액
                    // (잔액은 이미 별도로 표시되므로 중복 방지)
                    const additionalPayment = totalCustomerPayment - formData.commission_amount - channelSettlementAmount - (formData.onSiteBalanceAmount || 0)
                    
                    // 총 매출 = 채널 정산금액 + 초이스 총액 + 추가 결제금 - 환불금
                    // (잔액은 초이스 총액에 포함되어 있으므로 제외)
                    const totalRevenue = (
                      channelSettlementAmount +
                      (formData.choiceTotal || formData.choicesTotal || 0) +
                      (additionalPayment > 0 ? additionalPayment : 0) -
                      refundedAmount -
                      returnedAmount
                    )

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
        <div className="mt-6">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Calculator className="h-5 w-5 text-blue-600" />
                <h4 className="text-base font-semibold text-blue-900">정산 정보</h4>
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
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Net 가격 */}
              <div className="bg-white p-4 rounded-lg border border-blue-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center space-x-2 mb-2">
                  <DollarSign className="h-4 w-4 text-blue-500" />
                  <div className="text-sm font-medium text-gray-700">Net 가격</div>
                </div>
                <div className="text-xl font-bold text-blue-600 mb-1">
                  ${calculateNetPrice().toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">
                  커미션 차감 후 수령액
                </div>
              </div>

              {/* 예약 지출 총합 */}
              <div className="bg-white p-4 rounded-lg border border-red-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <div className="text-sm font-medium text-gray-700">예약 지출 총합</div>
                </div>
                <div className="text-xl font-bold text-red-600 mb-1">
                  ${reservationExpensesTotal.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">
                  승인/대기/기타 지출 (거부 제외)
                </div>
              </div>

              {/* 수익 */}
              <div className="bg-white p-4 rounded-lg border border-green-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center space-x-2 mb-2">
                  {calculateProfit() >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                  <div className="text-sm font-medium text-gray-700">수익</div>
                </div>
                <div className={`text-xl font-bold mb-1 ${calculateProfit() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${calculateProfit().toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">
                  Net 가격 - 지출 총합
                </div>
              </div>
            </div>

            {/* 수익률 표시 */}
            <div className="mt-4 pt-4 border-t border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700">수익률</span>
                  {calculateProfit() >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                </div>
                <span className={`text-lg font-bold ${calculateProfit() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {calculateNetPrice() > 0 ? ((calculateProfit() / calculateNetPrice()) * 100).toFixed(1) : '0.0'}%
                </span>
              </div>
              
              {/* 수익 상태 표시 */}
              <div className="mt-2">
                {calculateProfit() >= 0 ? (
                  <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    수익 발생
                  </div>
                ) : (
                  <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    손실 발생
                  </div>
                )}
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
