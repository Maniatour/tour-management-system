'use client'

import React, { useState, useEffect, useCallback } from 'react'
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

  // 선택된 채널 정보 가져오기
  const selectedChannel = channels?.find(ch => ch.id === formData.channelId)
  const commissionBasePriceOnly = selectedChannel?.commission_base_price_only || false
  const isOTAChannel = selectedChannel && (
    selectedChannel.type?.toLowerCase() === 'ota' || 
    selectedChannel.category === 'OTA'
  )
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
  const calculateProfit = () => {
    const netPrice = calculateNetPrice()
    return netPrice - reservationExpensesTotal
  }

  // 커미션 금액 자동 계산
  const calculateCommissionAmount = useCallback(() => {
    if (formData.commission_percent <= 0) return 0
    
    if (isOTAChannel) {
      // OTA 채널: Grand Total (쿠폰 할인 적용 후, 추가비용 포함)에 커미션 적용
      const grandTotal = formData.productPriceTotal - formData.couponDiscount - formData.additionalDiscount + formData.additionalCost
      return grandTotal * (formData.commission_percent / 100)
    } else if (commissionBasePriceOnly) {
      // 판매가격에만 커미션 적용
      const baseProductPrice = calculateProductPriceTotal()
      const basePriceForCommission = baseProductPrice - formData.couponDiscount - formData.additionalDiscount + formData.additionalCost
      return basePriceForCommission * (formData.commission_percent / 100)
    } else {
      // 전체 가격에 커미션 적용
      const totalPrice = formData.subtotal - formData.couponDiscount - formData.additionalDiscount + formData.additionalCost + formData.optionTotal
      return totalPrice * (formData.commission_percent / 100)
    }
  }, [formData.commission_percent, formData.productPriceTotal, formData.couponDiscount, formData.additionalDiscount, formData.additionalCost, formData.subtotal, formData.optionTotal, isOTAChannel, commissionBasePriceOnly, calculateProductPriceTotal])

  // 커미션 기본값 설정 및 자동 업데이트 (OTA 판매가 우선, 없으면 소계)
  const otaSalePrice = formData.onlinePaymentAmount ?? 0
  const currentCommissionBase = formData.commission_base_price ?? 0
  
  useEffect(() => {
    const basePrice = otaSalePrice > 0 ? otaSalePrice : formData.subtotal
    
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
    otaSalePrice, 
    formData.subtotal, 
    currentCommissionBase, 
    formData.commission_percent,
    formData.commission_base_price
  ])

  return (
    <div>
      {/* 구분선 */}
      <div className="border-t border-gray-300 mb-4"></div>
      
      <div className="space-y-2 mb-3">
        {/* 첫 번째 줄: 가격 정보 제목, 가격 타입, 저장/초기화 버튼 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center space-x-3">
            <h3 className="text-base font-semibold text-gray-900">가격 정보</h3>
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
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">성인</span>
                <div className="flex items-center space-x-1">
                  <span className="font-medium">$</span>
                  <input
                    type="number"
                    value={formData.adultProductPrice || ''}
                    onChange={(e) => {
                      const newPrice = Number(e.target.value) || 0
                      const updatedChildPrice = isSinglePrice ? newPrice : formData.childProductPrice
                      const updatedInfantPrice = isSinglePrice ? newPrice : formData.infantProductPrice
                      // 상품 가격 총합 계산
                      const newProductPriceTotal = (newPrice * formData.adults) + 
                                                   (updatedChildPrice * formData.child) + 
                                                   (updatedInfantPrice * formData.infant)
                      setFormData({ 
                        ...formData, 
                        adultProductPrice: newPrice,
                        // 단일 가격 모드일 때는 아동/유아 가격도 동일하게 설정
                        ...(isSinglePrice ? {
                          childProductPrice: newPrice,
                          infantProductPrice: newPrice
                        } : {}),
                        productPriceTotal: newProductPriceTotal
                      })
                    }}
                    className="w-12 px-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    step="0.01"
                    placeholder="0"
                  />
                  {isSinglePrice ? (
                    <span className="text-gray-500">x{formData.adults + formData.child + formData.infant}</span>
                  ) : (
                    <span className="text-gray-500">x{formData.adults}</span>
                  )}
                  <span className="font-medium">
                    {isSinglePrice 
                      ? `$${((formData.adultProductPrice || 0) * (formData.adults + formData.child + formData.infant)).toFixed(2)}`
                      : `$${((formData.adultProductPrice || 0) * formData.adults).toFixed(2)}`
                    }
                  </span>
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
                          // 상품 가격 총합 계산
                          const newProductPriceTotal = (formData.adultProductPrice * formData.adults) + 
                                                       (newPrice * formData.child) + 
                                                       (formData.infantProductPrice * formData.infant)
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
                      <span className="font-medium">${(formData.childProductPrice * formData.child).toFixed(2)}</span>
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
                          // 상품 가격 총합 계산
                          const newProductPriceTotal = (formData.adultProductPrice * formData.adults) + 
                                                       (formData.childProductPrice * formData.child) + 
                                                       (newPrice * formData.infant)
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
                      <span className="font-medium">${(formData.infantProductPrice * formData.infant).toFixed(2)}</span>
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
            
            {/* Base Price */}
            <div className="flex justify-between items-center mb-2">
              <span 
                className="text-sm text-gray-700 cursor-help" 
                title={isKorean ? "OTA에 등록된 투어의 기본 판매 가격입니다. 할인이나 추가 비용이 적용되기 전의 기준 금액입니다." : "The original listed price of the tour on the OTA before any discounts or add-ons are applied."}
              >
                {isKorean ? '기본 가격' : 'Base Price'}
              </span>
              <span className="text-sm font-medium text-gray-900">${formData.productPriceTotal.toFixed(2)}</span>
            </div>
            
            {/* Coupon Discount */}
            {formData.couponDiscount > 0 && (
              <div className="flex justify-between items-center mb-2">
                <span 
                  className="text-xs text-gray-600 cursor-help" 
                  title={isKorean ? "OTA에서 제공하는 프로모션 쿠폰으로 인한 할인 금액입니다. 이 할인은 OTA 정책에 따라 적용됩니다." : "The discount applied through an OTA-issued promotional coupon, based on the OTA's policy."}
                >
                  {isKorean ? '- 쿠폰 할인' : '- Coupon Discount'}
                </span>
                <span className="text-xs text-green-600">-${formData.couponDiscount.toFixed(2)}</span>
              </div>
            )}
            
            {/* 구분선 */}
            <div className="border-t border-gray-200 my-2"></div>
            
            {/* Subtotal */}
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-700">{isKorean ? '소계' : 'Subtotal'}</span>
              <span className="text-sm font-medium text-gray-900">${(formData.productPriceTotal - formData.couponDiscount).toFixed(2)}</span>
            </div>
            
            {/* Manual Discount / Add-on */}
            {(formData.additionalDiscount !== 0 || formData.additionalCost !== 0) && (
              <div className="flex justify-between items-center mb-2">
                <span 
                  className="text-xs text-gray-600 cursor-help" 
                  title={isKorean ? "OTA를 통하지 않고 별도로 부과되는 추가 비용입니다. 투어 당일 결제하거나 별도 인보이스로 청구될 수 있습니다." : "An additional charge collected outside the OTA, paid separately during the tour or via invoice."}
                >
                  {isKorean ? '± 수동 할인 / 추가 비용' : '± Manual Discount / Add-on'}
                </span>
                <span className={`text-xs ${(formData.additionalCost - formData.additionalDiscount) >= 0 ? 'text-gray-700' : 'text-green-600'}`}>
                  {(formData.additionalCost - formData.additionalDiscount) >= 0 ? '+' : ''}${(formData.additionalCost - formData.additionalDiscount).toFixed(2)}
                </span>
              </div>
            )}
            
            {/* Tax */}
            {formData.tax > 0 && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-600">{isKorean ? '+ 세금' : '+ Tax'}</span>
                <span className="text-xs text-gray-700">+${formData.tax.toFixed(2)}</span>
              </div>
            )}
            
            {/* Payment Processing Fee */}
            {formData.cardFee > 0 && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-600">{isKorean ? '+ 결제 수수료' : '+ Payment Processing Fee'}</span>
                <span className="text-xs text-gray-700">+${formData.cardFee.toFixed(2)}</span>
              </div>
            )}
            
            {/* 구분선 */}
            <div className="border-t border-gray-200 my-2"></div>
            
            {/* OTA Customer Payable (OTA 판매가) */}
            <div className="flex justify-between items-center mb-2">
              <span 
                className="text-sm font-medium text-gray-700 cursor-help" 
                title={isKorean ? "고객이 OTA를 통해 실제로 결제한 금액입니다." : "The actual amount paid by the customer through the OTA."}
              >
                {isKorean ? 'OTA 고객 지불액' : 'OTA Customer Payable'}
              </span>
              <div className="relative">
                <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                <input
                  type="number"
                  value={formData.onlinePaymentAmount || 0}
                  onChange={(e) => {
                    const otaSalePrice = Number(e.target.value) || 0
                    // OTA 판매가가 변경되면 커미션도 자동 재계산
                    const commissionBasePrice = formData.commission_base_price !== undefined ? formData.commission_base_price : otaSalePrice
                    const calculatedCommission = commissionBasePrice * (formData.commission_percent / 100)
                    setFormData({ 
                      ...formData, 
                      onlinePaymentAmount: otaSalePrice,
                      // OTA 판매가를 커미션 기본값으로 사용
                      commission_base_price: otaSalePrice > 0 ? otaSalePrice : commissionBasePrice,
                      commission_amount: calculatedCommission
                    })
                  }}
                  onFocus={() => {
                    // 포커스 시 기본값 설정 (소계 또는 현재 값)
                    if (!formData.onlinePaymentAmount || formData.onlinePaymentAmount === 0) {
                      const defaultOtaPrice = formData.subtotal
                      const commissionBasePrice = formData.commission_base_price !== undefined ? formData.commission_base_price : defaultOtaPrice
                      const calculatedCommission = commissionBasePrice * (formData.commission_percent / 100)
                      setFormData({ 
                        ...formData, 
                        onlinePaymentAmount: defaultOtaPrice,
                        commission_base_price: defaultOtaPrice,
                        commission_amount: calculatedCommission
                      })
                    }
                  }}
                  className="w-24 pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-right"
                  step="0.01"
                  placeholder="0"
                />
              </div>
            </div>
            
            {/* Commission */}
            <div className="space-y-2 mb-2">
              <div className="flex items-center justify-between">
                <span 
                  className="text-sm font-medium text-gray-700 cursor-help" 
                  title={isKorean ? "OTA가 판매 대행의 대가로 차감하는 수수료입니다." : "The commission fee retained by the OTA for facilitating the booking."}
                >
                  {isKorean ? '- 커미션' : '- Commission'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {/* 대상 가격 입력칸 */}
                <div className="relative flex-1">
                  <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">$</span>
                  <input
                    type="number"
                    value={formData.commission_base_price !== undefined ? formData.commission_base_price.toFixed(2) : (formData.onlinePaymentAmount || formData.subtotal).toFixed(2)}
                    onChange={(e) => {
                      const basePrice = Number(e.target.value) || 0
                      const calculatedAmount = basePrice * (formData.commission_percent / 100)
                      setFormData({ 
                        ...formData, 
                        commission_base_price: basePrice,
                        commission_amount: calculatedAmount
                      })
                    }}
                    onFocus={() => {
                      // 포커스 시 기본값 설정 (OTA 판매가 또는 소계)
                      if (!formData.commission_base_price || formData.commission_base_price === 0) {
                        const defaultBasePrice = formData.onlinePaymentAmount || formData.subtotal
                        const calculatedAmount = defaultBasePrice * (formData.commission_percent / 100)
                        setFormData({ 
                          ...formData, 
                          commission_base_price: defaultBasePrice,
                          commission_amount: calculatedAmount
                        })
                      }
                    }}
                    className="w-full pl-5 pr-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-right"
                    step="0.01"
                    min="0"
                    placeholder="0"
                  />
                </div>
                {/* 곱하기 기호 */}
                <span className="text-xs text-gray-500">×</span>
                {/* 커미션 퍼센테이지 입력칸 */}
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    value={formData.commission_percent}
                    onChange={(e) => {
                      const percent = Number(e.target.value) || 0
                      const basePrice = formData.commission_base_price !== undefined ? formData.commission_base_price : (formData.onlinePaymentAmount || formData.subtotal)
                      const calculatedAmount = basePrice * (percent / 100)
                      setFormData({ 
                        ...formData, 
                        commission_percent: percent,
                        commission_amount: calculatedAmount
                      })
                    }}
                    className="w-12 px-1 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="0"
                  />
                  <span className="text-xs text-gray-500">%</span>
                </div>
                {/* 등호 */}
                <span className="text-xs text-gray-500">=</span>
                {/* 실 커미션 입력칸 */}
                <div className="relative">
                  <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">$</span>
                  <input
                    type="number"
                    value={formData.commission_amount.toFixed(2)}
                    onChange={(e) => {
                      const newAmount = Number(e.target.value) || 0
                      setFormData({ ...formData, commission_amount: newAmount })
                    }}
                    onBlur={() => {
                      // 포커스를 잃을 때 대상 가격과 퍼센트로 다시 계산
                      if (formData.commission_percent > 0 && formData.commission_amount > 0) {
                        const basePrice = formData.commission_base_price !== undefined ? formData.commission_base_price : (formData.onlinePaymentAmount || formData.subtotal)
                        const calculatedAmount = basePrice * (formData.commission_percent / 100)
                        if (Math.abs(calculatedAmount - formData.commission_amount) > 0.01) {
                          setFormData((prev: typeof formData) => ({ 
                            ...prev, 
                            commission_amount: calculatedAmount 
                          }))
                        }
                      }
                    }}
                    className="w-20 pl-5 pr-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-right"
                    step="0.01"
                    min="0"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
            
            {/* 구분선 */}
            <div className="border-t border-gray-200 my-2"></div>
            
            {/* Net Receivable from OTA (OTA 정산금액) */}
            <div className="flex justify-between items-center mb-2">
              <span 
                className="text-base font-bold text-blue-800 cursor-help" 
                title={isKorean ? "OTA로부터 정산받게 되는 금액입니다. 추가 비용은 제외됩니다." : "The amount the company will receive from the OTA after commission is deducted. Additional costs are excluded."}
              >
                {isKorean ? 'OTA 정산금액' : 'Net Receivable from OTA'}
              </span>
              <span className="text-lg font-bold text-blue-600">
                ${((formData.onlinePaymentAmount || 0) - formData.commission_amount).toFixed(2)}
              </span>
            </div>
            
            {/* Direct Add-on (추가 비용) */}
            {((formData.additionalCost - formData.additionalDiscount) !== 0 || formData.tax > 0 || formData.cardFee > 0) && (
              <div className="flex justify-between items-center mb-2">
                <span 
                  className="text-xs text-gray-600 cursor-help" 
                  title={isKorean ? "OTA를 통하지 않고 별도로 부과되는 추가 비용입니다. 투어 당일 결제하거나 별도 인보이스로 청구될 수 있습니다." : "An additional charge collected outside the OTA, paid separately during the tour or via invoice."}
                >
                  {isKorean ? '+ 직접 추가 비용' : '+ Direct Add-on'}
                </span>
                <span className="text-xs text-gray-700">
                  +${((formData.additionalCost - formData.additionalDiscount) + formData.tax + formData.cardFee).toFixed(2)}
                </span>
              </div>
            )}
            
            {/* 구분선 */}
            <div className="border-t border-gray-200 my-2"></div>
            
            {/* Total Net Revenue */}
            <div className="flex justify-between items-center mb-2">
              <span 
                className="text-base font-bold text-green-800 cursor-help" 
                title={isKorean ? "OTA 정산 금액과 직접 결제된 추가 비용을 합한 당사의 총 매출 금액입니다." : "The company's total revenue, including OTA settlements and direct customer payments."}
              >
                {isKorean ? '총 순수익' : 'Total Net Revenue'}
              </span>
              <span className="text-lg font-bold text-green-600">
                ${(((formData.onlinePaymentAmount || 0) - formData.commission_amount) + (formData.additionalCost - formData.additionalDiscount) + formData.tax + formData.cardFee).toFixed(2)}
              </span>
            </div>
            
            {/* Prepaid Costs */}
            {formData.prepaymentCost > 0 && (
              <div className="flex justify-between items-center mb-2">
                <span 
                  className="text-xs text-gray-600 cursor-help" 
                  title={isKorean ? "투어 진행을 위해 사전에 지출된 비용입니다. (입장권, 차량비 등)" : "Costs paid in advance to operate the tour, such as admission tickets or transportation."}
                >
                  {isKorean ? '- 선결제 비용' : '- Prepaid Costs'}
                </span>
                <span className="text-xs text-gray-700">-${formData.prepaymentCost.toFixed(2)}</span>
              </div>
            )}
            
            {/* Prepaid Tips */}
            {formData.prepaymentTip > 0 && (
              <div className="flex justify-between items-center mb-2">
                <span 
                  className="text-xs text-gray-600 cursor-help" 
                  title={isKorean ? "가이드 또는 현장 스태프에게 사전에 지급된 팁입니다." : "Tips paid in advance to guides or on-site staff."}
                >
                  {isKorean ? '- 선결제 팁' : '- Prepaid Tips'}
                </span>
                <span className="text-xs text-gray-700">-${formData.prepaymentTip.toFixed(2)}</span>
              </div>
            )}
            
            {/* 구분선 */}
            <div className="border-t border-gray-200 my-2"></div>
            
            {/* Operating Profit */}
            <div className="flex justify-between items-center mb-2">
              <span 
                className="text-sm font-medium text-gray-700 cursor-help" 
                title={isKorean ? "매출에서 모든 선지출 비용을 제외한 투어 기준 실질 수익입니다." : "The actual profit per tour after deducting all prepaid operating costs."}
              >
                {isKorean ? '운영 이익' : 'Operating Profit'}
              </span>
              <span className="text-sm font-semibold text-gray-900">
                ${((((formData.onlinePaymentAmount || 0) - formData.commission_amount) + (formData.additionalCost - formData.additionalDiscount) + formData.tax + formData.cardFee) - formData.prepaymentCost - formData.prepaymentTip).toFixed(2)}
              </span>
            </div>
            
            {/* 구분선 */}
            <div className="border-t border-gray-200 my-2"></div>
            
            {/* Deposit (Unearned Revenue) */}
            <div className="flex justify-between items-center mb-2">
              <span 
                className="text-sm font-medium text-gray-700 cursor-help" 
                title={isKorean ? "현재 OTA로부터 정산받아야 할 금액입니다." : "The amount currently receivable from the OTA."}
              >
                {isKorean ? '보증금' : 'Deposit (Unearned Revenue)'}
              </span>
              <div className="relative">
                <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                <input
                  type="number"
                  value={formData.depositAmount}
                  onChange={(e) => setFormData({ ...formData, depositAmount: Number(e.target.value) || 0 })}
                  className="w-24 pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-right"
                  step="0.01"
                  min="0"
                  placeholder="0"
                />
              </div>
            </div>
            
            {/* Remaining Balance */}
            <div className="flex justify-between items-center mb-2">
              <span 
                className="text-sm font-medium text-gray-700 cursor-help" 
                title={isKorean ? "고객이 현장 또는 별도로 추가 결제해야 하는 잔액입니다." : "The remaining balance to be paid directly by the customer."}
              >
                {isKorean ? '잔액' : 'Remaining Balance'}
              </span>
              <div className="relative">
                <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                <input
                  type="number"
                  value={formData.onSiteBalanceAmount || 0}
                  onChange={(e) => {
                    const newBalance = Number(e.target.value) || 0
                    setFormData({ ...formData, onSiteBalanceAmount: newBalance, balanceAmount: newBalance })
                  }}
                  onFocus={() => {
                    // commission_base_price_only가 true이고 밸런스가 0이면 자동 계산
                    if (commissionBasePriceOnly && !formData.onSiteBalanceAmount) {
                      const choicesTotal = formData.choicesTotal || formData.choiceTotal || 0
                      const notIncludedTotal = (formData.not_included_price || 0) * (formData.adults + formData.child + formData.infant)
                      const autoBalance = choicesTotal + notIncludedTotal
                      if (autoBalance > 0) {
                        setFormData({ 
                          ...formData, 
                          onSiteBalanceAmount: autoBalance, 
                          balanceAmount: autoBalance 
                        })
                      }
                    }
                  }}
                  className="w-24 pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-right"
                  step="0.01"
                  placeholder="0"
                />
              </div>
            </div>
            
            {/* Total Customer Payment (보증금 + 잔액) */}
            {(formData.depositAmount > 0 || (formData.onSiteBalanceAmount || 0) > 0) && (
              <div className="flex justify-between items-center mb-2 pt-2 border-t border-gray-200">
                <span 
                  className="text-sm font-semibold text-gray-900 cursor-help" 
                  title={isKorean ? "고객이 실제로 지불한 총액입니다. (보증금 + 잔액)" : "The total amount actually paid by the customer. (Deposit + Remaining Balance)"}
                >
                  {isKorean ? '고객 총 지불액' : 'Total Customer Payment'}
                </span>
                <span className="text-sm font-bold text-blue-600">
                  ${((formData.depositAmount || 0) + (formData.onSiteBalanceAmount || 0)).toFixed(2)}
                </span>
              </div>
            )}
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
                  <li>고객 총지불액 = OTA 판매가 + balance</li>
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
                  <li>total_price = 고객 총지불액</li>
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
