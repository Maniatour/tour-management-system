'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { sanitizeTimeInput } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import CustomerForm from '@/components/CustomerForm'
import CustomerSection from '@/components/reservation/CustomerSection'
import TourInfoSection from '@/components/reservation/TourInfoSection'
import ParticipantsSection from '@/components/reservation/ParticipantsSection'
import PricingSection from '@/components/reservation/PricingSection'
import ProductSelectionSection from '@/components/reservation/ProductSelectionSection'
import ChannelSection from '@/components/reservation/ChannelSection'
import { getRequiredOptionsForProduct, getOptionalOptionsForProduct, getChoicesForOption } from '@/utils/reservationUtils'
import type { 
  Customer, 
  Product, 
  Channel, 
  ProductOption, 
  ProductOptionChoice, 
  Option, 
  PickupHotel, 
  Reservation 
} from '@/types/reservation'

interface ReservationFormProps {
  reservation?: Reservation | null
  customers: Customer[]
  products: Product[]
  channels: Channel[]
  productOptions: ProductOption[]
  optionChoices: ProductOptionChoice[]
  options: Option[]
  pickupHotels: PickupHotel[]
  coupons: Database['public']['Tables']['coupons']['Row'][]
  onSubmit: (reservation: Omit<Reservation, 'id'>) => void
  onCancel: () => void
  onRefreshCustomers: () => Promise<void>
  onDelete: (id: string) => void
  layout?: 'modal' | 'page'
}

export default function ReservationForm({ 
  reservation, 
  customers, 
  products, 
  channels, 
  productOptions, 
  optionChoices, 
  options, 
  pickupHotels, 
  coupons, 
  onSubmit, 
  onCancel, 
  onRefreshCustomers, 
  onDelete,
  layout = 'modal'
}: ReservationFormProps) {
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const t = useTranslations('reservations')
  const tCommon = useTranslations('common')
  const customerSearchRef = useRef<HTMLDivElement | null>(null)
  const rez: any = reservation || {}
  const [showRawDetails, setShowRawDetails] = useState(false)
  
  const [formData, setFormData] = useState<{
    customerId: string
    customerSearch: string
    showCustomerDropdown: boolean
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
    child: number
    infant: number
    totalPeople: number
    channelId: string
    selectedChannelType: 'ota' | 'self' | 'partner'
    channelSearch: string
    channelRN: string
    addedBy: string
    addedTime: string
    tourId: string
    status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
    selectedOptions: { [optionId: string]: string[] }
    selectedOptionPrices: { [key: string]: number }
    // 가격 정보
    adultProductPrice: number
    childProductPrice: number
    infantProductPrice: number
    productPriceTotal: number
    requiredOptions: { [optionId: string]: { choiceId: string; adult: number; child: number; infant: number } }
    requiredOptionTotal: number
    subtotal: number
    couponCode: string
    couponDiscount: number
    additionalDiscount: number
    additionalCost: number
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
    productRequiredOptions: ProductOption[]
  }>({
    customerId: reservation?.customerId || rez.customer_id || '',
    customerSearch: reservation?.customerId ? 
      customers.find(c => c.id === reservation.customerId)?.name || '' : (rez.customer_id ? (customers.find(c => c.id === rez.customer_id)?.name || '') : ''),
    showCustomerDropdown: false,
    productId: reservation?.productId || rez.product_id || '',
    selectedProductCategory: '',
    selectedProductSubCategory: '',
    productSearch: '',
    tourDate: reservation?.tourDate || rez.tour_date || '',
    tourTime: reservation?.tourTime || rez.tour_time || '',
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
    pickUpTime: reservation?.pickUpTime || (rez.pickup_time ? String(rez.pickup_time).substring(0,5) : ''),
    adults: reservation?.adults || rez.adults || 1,
    child: reservation?.child || rez.child || 0,
    infant: reservation?.infant || rez.infant || 0,
    totalPeople: reservation?.totalPeople || rez.total_people || 1,
    channelId: reservation?.channelId || rez.channel_id || '',
    selectedChannelType: reservation?.channelId ? 
      (channels.find(c => c.id === reservation?.channelId)?.type || 'self') : (rez.channel_id ? (channels.find(c => c.id === rez.channel_id)?.type || 'self') : 'self'),
    channelSearch: '',
    channelRN: reservation?.channelRN || rez.channel_rn || '',
    addedBy: reservation?.addedBy || rez.added_by || '',
    addedTime: reservation?.addedTime || rez.created_at || new Date().toISOString().slice(0, 16).replace('T', ' '),
    tourId: reservation?.tourId || rez.tour_id || '',
    status: (reservation as any) || rez.status || 'pending',
    selectedOptions: reservation?.selectedOptions || rez.selected_options || {},
    selectedOptionPrices: reservation?.selectedOptionPrices || rez.selected_option_prices || {},
    // 가격 정보 초기값 (loadPricingInfo 함수에서 동적으로 로드)
    adultProductPrice: 0,
    childProductPrice: 0,
    infantProductPrice: 0,
    productPriceTotal: 0,
    requiredOptions: {},
    requiredOptionTotal: 0,
    subtotal: 0,
    couponCode: '',
    couponDiscount: 0,
    additionalDiscount: 0,
    additionalCost: 0,
    cardFee: 0,
    tax: 0,
    prepaymentCost: 0,
    prepaymentTip: 0,
    selectedOptionalOptions: {},
    optionTotal: 0,
    totalPrice: 0,
    depositAmount: 0,
    balanceAmount: 0,
    isPrivateTour: (reservation as any)?.isPrivateTour || rez.is_private_tour || false,
    privateTourAdditionalCost: 0,
    commission_percent: 0,
    productRequiredOptions: []
  })

  // 현재 사용자 정보 가져오기
  const [, setCurrentUser] = useState<{ email: string } | null>(null)
  
  // 가격 자동 입력 알림 상태
  const [priceAutoFillMessage, setPriceAutoFillMessage] = useState<string>('')



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

  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (user && !error) {
          setCurrentUser({ email: user.email || '' })
          // 새 예약인 경우에만 현재 사용자 이메일로 설정
          if (!reservation) {
            setFormData(prev => ({ ...prev, addedBy: user.email || '' }))
          }
        }
      } catch (error) {
        console.error('Error getting current user:', error)
      }
    }
    
    getCurrentUser()
  }, [reservation])

  // 상품 선택 시 필수 옵션 로드 함수 (dynamic_pricing의 options_pricing 참조)
  const loadRequiredOptionsForProduct = useCallback(async (productId: string, tourDate?: string, channelId?: string) => {
    if (!productId) {
      setFormData(prev => ({ ...prev, requiredOptions: {} }))
      return
    }

    try {
      // 상품의 필수 옵션들을 가져오기 (병합된 테이블 구조)
      const { data: productOptions, error } = await supabase
        .from('product_options')
        .select(`
          id,
          name,
          description,
          is_required,
          linked_option_id,
          choice_name,
          choice_description,
          adult_price_adjustment,
          child_price_adjustment,
          infant_price_adjustment,
          is_default
        `)
        .eq('product_id', productId)
        .eq('is_required', true)

      if (error) {
        console.error('필수 옵션 로드 오류:', error)
        return
      }

      // 필수 옵션을 formData에 설정 (병합된 테이블 구조)
      const requiredOptions: { [optionId: string]: { choiceId: string; adult: number; child: number; infant: number } } = {}
      
      productOptions?.forEach(productOption => {
        // 병합된 테이블에서는 각 행이 이미 하나의 선택지를 나타냄
        requiredOptions[productOption.id] = {
          choiceId: productOption.id, // 옵션 ID를 선택지 ID로 사용
          adult: productOption.adult_price_adjustment || 0,
          child: productOption.child_price_adjustment || 0,
          infant: productOption.infant_price_adjustment || 0
        }
      })

      // dynamic_pricing에서 options_pricing 가격 정보가 있으면 업데이트
      if (tourDate && channelId) {
        try {
          const { data: pricingData, error: pricingError } = await supabase
            .from('dynamic_pricing')
            .select('options_pricing')
            .eq('product_id', productId)
            .eq('date', tourDate)
            .eq('channel_id', channelId)
            .limit(1)

          if (!pricingError && pricingData && pricingData.length > 0) {
            const pricing = pricingData[0]
            console.log('Dynamic pricing options_pricing 조회:', pricing.options_pricing)
            
            // requiredOptionsList 변수 정의 (productOptions에서 직접 가져오기)
            const requiredOptionsList = productOptions || []
            
            console.log('ProductOptions 정보:', requiredOptionsList.map(opt => ({
              id: opt.id,
              name: opt.name,
              linked_option_id: opt.linked_option_id
            })))
            
            if (pricing.options_pricing && typeof pricing.options_pricing === 'object') {
              // options_pricing이 배열인 경우 처리
              if (Array.isArray(pricing.options_pricing)) {
                pricing.options_pricing.forEach((optionPricing: { option_id: string; adult_price?: number; child_price?: number; infant_price?: number }) => {
                  console.log(`Dynamic pricing 옵션 처리:`, {
                    option_id: optionPricing.option_id,
                    adult_price: optionPricing.adult_price,
                    child_price: optionPricing.child_price,
                    infant_price: optionPricing.infant_price
                  })
                  
                  // option_id를 linked_option_id로 매핑하는 로직
                  let targetOptionId = optionPricing.option_id
                  
                  // 기존 option_id가 product_options의 id와 일치하는 경우, linked_option_id로 변환
                  const productOptionById = requiredOptionsList.find(opt => opt.id === optionPricing.option_id)
                  if (productOptionById && productOptionById.linked_option_id) {
                    targetOptionId = productOptionById.linked_option_id
                    console.log(`옵션 ID 매핑: ${optionPricing.option_id} -> ${targetOptionId}`)
                  }
                  
                  // linked_option_id와 매칭되는 product_option 찾기
                  const matchingProductOption = requiredOptionsList.find(opt => 
                    opt.linked_option_id === targetOptionId || 
                    opt.id === targetOptionId
                  )
                  
                  // 매칭이 안 되는 경우 더 자세한 디버깅
                  if (!matchingProductOption) {
                    console.log(`매칭 실패 - 상세 분석:`, {
                      찾고있는_option_id: optionPricing.option_id,
                      available_product_options: requiredOptionsList.map(opt => ({
                        id: opt.id,
                        name: opt.name,
                        linked_option_id: opt.linked_option_id,
                        linked_option_id_type: typeof opt.linked_option_id,
                        linked_option_id_null: opt.linked_option_id === null,
                        linked_option_id_undefined: opt.linked_option_id === undefined
                      }))
                    })
                  }
                  
                  console.log(`매칭되는 product_option 찾기:`, {
                    option_id: optionPricing.option_id,
                    requiredOptionsList: requiredOptionsList.map(opt => ({ id: opt.id, linked_option_id: opt.linked_option_id })),
                    matchingProductOption: matchingProductOption ? { id: matchingProductOption.id, linked_option_id: matchingProductOption.linked_option_id } : null
                  })
                  
                  if (matchingProductOption && requiredOptions[matchingProductOption.id]) {
                    const beforePrice = requiredOptions[matchingProductOption.id]
                    requiredOptions[matchingProductOption.id] = {
                      ...requiredOptions[matchingProductOption.id],
                      adult: optionPricing.adult_price || 0,
                      child: optionPricing.child_price || 0,
                      infant: optionPricing.infant_price || 0
                    }
                    console.log(`옵션 ${matchingProductOption.id} (linked_option_id: ${optionPricing.option_id}) 가격 업데이트 (배열 형식):`, {
                      before: beforePrice,
                      after: requiredOptions[matchingProductOption.id],
                      dynamic_pricing: {
                        adult: optionPricing.adult_price,
                        child: optionPricing.child_price,
                        infant: optionPricing.infant_price
                      }
                    })
                  } else {
                    console.log(`매칭되는 product_option을 찾을 수 없음:`, {
                      option_id: optionPricing.option_id,
                      requiredOptions_keys: Object.keys(requiredOptions),
                      matchingProductOption: matchingProductOption,
                      requiredOptions_content: requiredOptions
                    })
                  }
                })
              } else {
                // options_pricing이 객체인 경우 처리
                Object.entries(pricing.options_pricing).forEach(([optionId, optionPricing]) => {
                  const pricingData = optionPricing as { adult?: number; adult_price?: number; child?: number; child_price?: number; infant?: number; infant_price?: number }
                  
                  // option_id를 linked_option_id로 매핑하는 로직
                  let targetOptionId = optionId
                  
                  // 기존 option_id가 product_options의 id와 일치하는 경우, linked_option_id로 변환
                  const productOptionById = requiredOptionsList.find(opt => opt.id === optionId)
                  if (productOptionById && productOptionById.linked_option_id) {
                    targetOptionId = productOptionById.linked_option_id
                    console.log(`옵션 ID 매핑 (객체): ${optionId} -> ${targetOptionId}`)
                  }
                  
                  // linked_option_id와 매칭되는 product_option 찾기
                  const matchingProductOption = requiredOptionsList.find(opt => 
                    opt.linked_option_id === targetOptionId || 
                    opt.id === targetOptionId
                  )
                  if (matchingProductOption && requiredOptions[matchingProductOption.id] && pricingData) {
                    requiredOptions[matchingProductOption.id] = {
                      ...requiredOptions[matchingProductOption.id],
                      adult: pricingData.adult || pricingData.adult_price || 0,
                      child: pricingData.child || pricingData.child_price || 0,
                      infant: pricingData.infant || pricingData.infant_price || 0
                    }
                    console.log(`옵션 ${matchingProductOption.id} (linked_option_id: ${optionId}) 가격 업데이트 (객체 형식):`, {
                      adult: pricingData.adult || pricingData.adult_price,
                      child: pricingData.child || pricingData.child_price,
                      infant: pricingData.infant || pricingData.infant_price
                    })
                  }
                })
              }
            }
          }
        } catch (pricingError) {
          console.log('Dynamic pricing 조회 중 오류 (기본 가격 사용):', pricingError)
        }
      }

      setFormData(prev => ({ 
        ...prev, 
        requiredOptions,
        productRequiredOptions: productOptions || []
      }))

      console.log('필수 옵션 로드 완료:', requiredOptions)
    } catch (error) {
      console.error('필수 옵션 로드 중 오류:', error)
    }
  }, [setFormData])

  // 가격 정보 조회 함수 (reservation_pricing 우선, 없으면 dynamic_pricing)
  const loadPricingInfo = useCallback(async (productId: string, tourDate: string, channelId: string, reservationId?: string) => {
    if (!productId || !tourDate || !channelId) {
      console.log('필수 정보가 부족합니다:', { productId, tourDate, channelId })
      return
    }

    try {
      console.log('가격 정보 조회 시작:', { productId, tourDate, channelId, reservationId })
      
      // 1. 먼저 reservation_pricing에서 기존 가격 정보 확인 (편집 모드인 경우)
      if (reservationId) {
        const { data: existingPricing, error: existingError } = await supabase
          .from('reservation_pricing')
          .select('*')
          .eq('reservation_id', reservationId)
          .single()

        if (existingError && existingError.code !== 'PGRST116') {
          console.log('기존 가격 정보 조회 오류:', existingError.message)
          // 오류가 발생해도 계속 진행 (dynamic_pricing 조회)
        } else if (existingPricing) {
          console.log('기존 가격 정보 사용:', existingPricing)
          setFormData(prev => ({
            ...prev,
            adultProductPrice: existingPricing.adult_product_price || 0,
            childProductPrice: existingPricing.child_product_price || 0,
            infantProductPrice: existingPricing.infant_product_price || 0,
            productPriceTotal: existingPricing.product_price_total || 0,
            requiredOptions: existingPricing.required_options || {},
            requiredOptionTotal: existingPricing.required_option_total || 0,
            subtotal: existingPricing.subtotal || 0,
            couponCode: existingPricing.coupon_code || '',
            couponDiscount: existingPricing.coupon_discount || 0,
            additionalDiscount: existingPricing.additional_discount || 0,
            additionalCost: existingPricing.additional_cost || 0,
            cardFee: existingPricing.card_fee || 0,
            tax: existingPricing.tax || 0,
            prepaymentCost: existingPricing.prepayment_cost || 0,
            prepaymentTip: existingPricing.prepayment_tip || 0,
            selectedOptionalOptions: existingPricing.selected_options || {},
            optionTotal: existingPricing.option_total || 0,
            totalPrice: existingPricing.total_price || 0,
            depositAmount: existingPricing.deposit_amount || 0,
            balanceAmount: existingPricing.balance_amount || 0,
            isPrivateTour: reservation?.isPrivateTour || false,
            privateTourAdditionalCost: existingPricing.private_tour_additional_cost || 0,
            commission_percent: existingPricing.commission_percent || 0
          }))
          
          setPriceAutoFillMessage('기존 가격 정보가 로드되었습니다!')
          return // 기존 가격 정보가 있으면 dynamic_pricing 조회하지 않음
        }
      }

      // 2. reservation_pricing에 가격 정보가 없으면 dynamic_pricing에서 조회
      console.log('Dynamic pricing 조회 시작:', { productId, tourDate, channelId })
      
      const { data: pricingData, error } = await supabase
        .from('dynamic_pricing')
        .select('*')
        .eq('product_id', productId)
        .eq('date', tourDate)
        .eq('channel_id', channelId)
        .limit(1)

      if (error) {
        console.log('Dynamic pricing 조회 오류:', error.message)
        // 오류가 발생해도 가격을 0으로 설정하고 계속 진행
        setFormData(prev => ({
          ...prev,
          adultProductPrice: 0,
          childProductPrice: 0,
          infantProductPrice: 0
        }))
        setPriceAutoFillMessage('가격 조회 중 오류가 발생했습니다. 수동으로 입력해주세요.')
        return
      }

      if (!pricingData || pricingData.length === 0) {
        console.log('Dynamic pricing 데이터가 없습니다. 가격을 0으로 설정합니다.')
        
        // 가격 정보가 없으면 0으로 설정
        setFormData(prev => ({
          ...prev,
          adultProductPrice: 0,
          childProductPrice: 0,
          infantProductPrice: 0
        }))
        
        setPriceAutoFillMessage('가격 정보가 없어 0으로 설정되었습니다. 수동으로 입력해주세요.')
        return
      }

      const pricing = pricingData[0]
      console.log('Dynamic pricing 데이터 조회 성공:', pricing)

      // 가격 정보를 formData에 반영
      setFormData(prev => ({
        ...prev,
        adultProductPrice: pricing.adult_price || 0,
        childProductPrice: pricing.child_price || 0,
        infantProductPrice: pricing.infant_price || 0,
        commission_percent: pricing.commission_percent || 0
      }))

      // 필수 옵션을 먼저 로드한 후 dynamic_pricing의 options_pricing으로 가격 업데이트
      await loadRequiredOptionsForProduct(productId, tourDate, channelId)

      console.log('가격 정보가 자동으로 입력되었습니다')
      
      // 사용자에게 알림 표시
      setPriceAutoFillMessage('Dynamic pricing에서 가격 정보가 자동으로 입력되었습니다!')
      setTimeout(() => setPriceAutoFillMessage(''), 3000)
    } catch (error) {
      console.error('Dynamic pricing 조회 중 오류:', error)
    }
  }, [loadRequiredOptionsForProduct])

  // 가격 계산 함수들
  const calculateProductPriceTotal = useCallback(() => {
    return (formData.adultProductPrice * formData.adults) + 
           (formData.childProductPrice * formData.child) + 
           (formData.infantProductPrice * formData.infant)
  }, [formData.adultProductPrice, formData.childProductPrice, formData.infantProductPrice, formData.adults, formData.child, formData.infant])

  const calculateRequiredOptionTotal = useCallback(() => {
    let total = 0
    console.log('calculateRequiredOptionTotal 호출:', {
      requiredOptions: formData.requiredOptions,
      selectedOptions: formData.selectedOptions,
      adults: formData.adults,
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
        adults: formData.adults,
        child: formData.child,
        infant: formData.infant,
        optionTotal: (option.adult * formData.adults) + (option.child * formData.child) + (option.infant * formData.infant)
      })
      
      if (isSelected) {
        const optionTotal = (option.adult * formData.adults) + 
                           (option.child * formData.child) + 
                           (option.infant * formData.infant)
        total += optionTotal
        console.log(`옵션 ${optionId} 총합 추가: ${optionTotal}, 현재 총합: ${total}`)
      }
    })
    
    console.log('최종 requiredOptionTotal:', total)
    return total
  }, [formData.requiredOptions, formData.selectedOptions, formData.adults, formData.child, formData.infant])

  const calculateSubtotal = useCallback(() => {
    return calculateProductPriceTotal() + calculateRequiredOptionTotal()
  }, [calculateProductPriceTotal, calculateRequiredOptionTotal])

  const calculateOptionTotal = useCallback(() => {
    let total = 0
    Object.values(formData.selectedOptionalOptions).forEach(option => {
      total += option.price * option.quantity
    })
    return total
  }, [formData.selectedOptionalOptions])

  const calculateTotalPrice = useCallback(() => {
    const subtotal = calculateSubtotal()
    const totalDiscount = formData.couponDiscount + formData.additionalDiscount
    const totalAdditional = formData.additionalCost + formData.cardFee + formData.tax + 
                           formData.prepaymentCost + formData.prepaymentTip + calculateOptionTotal() +
                           (formData.isPrivateTour ? formData.privateTourAdditionalCost : 0)
    
    return Math.max(0, subtotal - totalDiscount + totalAdditional)
  }, [calculateSubtotal, formData.couponDiscount, formData.additionalDiscount, formData.additionalCost, formData.cardFee, formData.tax, formData.prepaymentCost, formData.prepaymentTip, calculateOptionTotal, formData.isPrivateTour, formData.privateTourAdditionalCost])

  const calculateBalance = useCallback(() => {
    return Math.max(0, formData.totalPrice - formData.depositAmount)
  }, [formData.totalPrice, formData.depositAmount])

  // 쿠폰 할인 계산 함수
  const calculateCouponDiscount = useCallback((coupon: Database['public']['Tables']['coupons']['Row'], subtotal: number) => {
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

  // 쿠폰 자동 선택 함수
  const autoSelectCoupon = useCallback(() => {
    if (!formData.productId || !formData.tourDate || !formData.channelId) {
      return
    }

    console.log('쿠폰 자동 선택 시작:', {
      productId: formData.productId,
      tourDate: formData.tourDate,
      channelId: formData.channelId
    })

    // 투어 날짜를 Date 객체로 변환
    const tourDate = new Date(formData.tourDate)
    
    // 조건에 맞는 쿠폰 필터링
    const matchingCoupons = coupons.filter(coupon => {
      // 상태가 활성인지 확인
      if (coupon.status !== 'active') return false
      
      // 채널이 정확히 일치하는지 확인 (null이면 매칭하지 않음)
      if (!coupon.channel_id || coupon.channel_id !== formData.channelId) return false
      
      // 상품이 정확히 일치하는지 확인 (null이면 매칭하지 않음)
      if (!coupon.product_id || coupon.product_id !== formData.productId) return false
      
      // 날짜 범위 확인
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

    // 가장 적합한 쿠폰 선택 (우선순위: 고정값 할인 > 퍼센트 할인)
    if (matchingCoupons.length > 0) {
      const selectedCoupon = matchingCoupons.reduce((best, current) => {
        // 고정값 할인이 있는 쿠폰을 우선 선택
        if (current.discount_type === 'fixed' && current.fixed_value && 
            (!best || best.discount_type !== 'fixed' || (best.fixed_value || 0) < current.fixed_value)) {
          return current
        }
        // 고정값이 없으면 퍼센트 할인 중 가장 높은 것 선택
        if (current.discount_type === 'percentage' && current.percentage_value && 
            (!best || best.discount_type !== 'percentage' || (best.percentage_value || 0) < current.percentage_value)) {
          return current
        }
        return best
      })

      if (selectedCoupon) {
        console.log('자동 선택된 쿠폰:', selectedCoupon)
        
        const subtotal = calculateProductPriceTotal() + calculateRequiredOptionTotal()
        const couponDiscount = calculateCouponDiscount(selectedCoupon, subtotal)
        
        setFormData(prev => ({
          ...prev,
          couponCode: selectedCoupon.coupon_code || '',
          couponDiscount: couponDiscount
        }))
      }
    } else {
      // 매칭되는 쿠폰이 없으면 쿠폰 선택 해제
      setFormData(prev => ({
        ...prev,
        couponCode: '',
        couponDiscount: 0
      }))
    }
  }, [formData.productId, formData.tourDate, formData.channelId, coupons, calculateProductPriceTotal, calculateRequiredOptionTotal, calculateCouponDiscount])

  // 상품, 날짜, 채널이 변경될 때 dynamic pricing에서 가격 자동 조회
  useEffect(() => {
    if (formData.productId && formData.tourDate && formData.channelId) {
      console.log('가격 자동 조회 트리거:', {
        productId: formData.productId,
        tourDate: formData.tourDate,
        channelId: formData.channelId
      })
      loadPricingInfo(formData.productId, formData.tourDate, formData.channelId, reservation?.id)
    }
  }, [formData.productId, formData.tourDate, formData.channelId, reservation?.id, loadPricingInfo])

  // 상품, 날짜, 채널이 변경될 때 쿠폰 자동 선택
  useEffect(() => {
    autoSelectCoupon()
  }, [autoSelectCoupon])

  // 가격 정보 자동 업데이트
  useEffect(() => {
    const newProductPriceTotal = calculateProductPriceTotal()
    const newRequiredOptionTotal = calculateRequiredOptionTotal()
    const newSubtotal = calculateSubtotal()
    const newTotalPrice = calculateTotalPrice()
    const newBalance = calculateBalance()

    setFormData(prev => ({
      ...prev,
      productPriceTotal: newProductPriceTotal,
      requiredOptionTotal: newRequiredOptionTotal,
      subtotal: newSubtotal,
      totalPrice: newTotalPrice,
      balanceAmount: newBalance
    }))
  }, [
    formData.adultProductPrice, formData.childProductPrice, formData.infantProductPrice,
    formData.requiredOptions, formData.selectedOptions,
    formData.adults, formData.child, formData.infant,
    formData.couponDiscount, formData.additionalDiscount, formData.additionalCost,
    formData.cardFee, formData.tax, formData.prepaymentCost, formData.prepaymentTip,
    formData.isPrivateTour, formData.privateTourAdditionalCost,
    calculateProductPriceTotal, calculateRequiredOptionTotal, calculateSubtotal, calculateTotalPrice, calculateBalance
  ])

  // dynamic_pricing에서 특정 옵션의 가격 정보를 가져오는 함수
  const getDynamicPricingForOption = useCallback(async (optionId: string) => {
    if (!formData.productId || !formData.tourDate || !formData.channelId) {
      return null
    }

    try {
      // dynamic_pricing 테이블에서 직접 가격 정보 조회
      const { data: pricingData, error } = await supabase
        .from('dynamic_pricing')
        .select('options_pricing')
        .eq('product_id', formData.productId)
        .eq('date', formData.tourDate)
        .eq('channel_id', formData.channelId)
        .limit(1)

      if (error || !pricingData || pricingData.length === 0) {
        return null
      }

      const pricing = pricingData[0]
      if (pricing.options_pricing && typeof pricing.options_pricing === 'object') {
        if (Array.isArray(pricing.options_pricing)) {
          const optionPricing = pricing.options_pricing.find(
            (option: { option_id: string; adult_price?: number; child_price?: number; infant_price?: number }) => 
              option.option_id === optionId
          )
          if (optionPricing) {
            return {
              adult: optionPricing.adult_price || 0,
              child: optionPricing.child_price || 0,
              infant: optionPricing.infant_price || 0
            }
          }
        } else {
          const optionPricing = pricing.options_pricing[optionId]
          if (optionPricing) {
            const pricingData = optionPricing as { adult?: number; adult_price?: number; child?: number; child_price?: number; infant?: number; infant_price?: number }
            return {
              adult: pricingData.adult || pricingData.adult_price || 0,
              child: pricingData.child || pricingData.child_price || 0,
              infant: pricingData.infant || pricingData.infant_price || 0
            }
          }
        }
      }

      return null
    } catch (error) {
      console.error('Dynamic pricing 조회 중 오류:', error)
      return null
    }
  }, [formData.productId, formData.tourDate, formData.channelId])

  // 가격 정보 저장 함수 (외부에서 호출 가능)
  const savePricingInfo = useCallback(async (reservationId: string) => {
    try {
      // 기존 가격 정보가 있는지 확인하여 id를 가져오거나 새로 생성
      const { data: existingPricing, error: checkError } = await supabase
        .from('reservation_pricing')
        .select('id')
        .eq('reservation_id', reservationId)
        .single()

      let pricingId: string
      if (existingPricing) {
        pricingId = existingPricing.id
      } else {
        // 새 ID 생성 (UUID 형식)
        pricingId = crypto.randomUUID()
      }

      const pricingData = {
        id: pricingId,
        reservation_id: reservationId,
        adult_product_price: formData.adultProductPrice,
        child_product_price: formData.childProductPrice,
        infant_product_price: formData.infantProductPrice,
        product_price_total: formData.productPriceTotal,
        required_options: formData.requiredOptions,
        required_option_total: formData.requiredOptionTotal,
        subtotal: formData.subtotal,
        coupon_code: formData.couponCode,
        coupon_discount: formData.couponDiscount,
        additional_discount: formData.additionalDiscount,
        additional_cost: formData.additionalCost,
        card_fee: formData.cardFee,
        tax: formData.tax,
        prepayment_cost: formData.prepaymentCost,
        prepayment_tip: formData.prepaymentTip,
        selected_options: formData.selectedOptionalOptions,
        option_total: formData.optionTotal,
        total_price: formData.totalPrice,
        deposit_amount: formData.depositAmount,
        balance_amount: formData.balanceAmount,
        private_tour_additional_cost: formData.privateTourAdditionalCost,
        commission_percent: formData.commission_percent
      }

      let error
      if (checkError && checkError.code !== 'PGRST116') { // PGRST116은 "no rows returned" 오류
        console.error('기존 가격 정보 확인 오류:', checkError)
        throw checkError
      }

      if (existingPricing) {
        // 기존 데이터가 있으면 업데이트
        const { error: updateError } = await supabase
          .from('reservation_pricing')
          .update(pricingData)
          .eq('reservation_id', reservationId)
        
        error = updateError
      } else {
        // 기존 데이터가 없으면 새로 삽입
        const { error: insertError } = await supabase
          .from('reservation_pricing')
          .insert([pricingData])
        
        error = insertError
      }

      if (error) {
        console.error('가격 정보 저장 오류:', error)
        throw error
      }

      console.log('가격 정보가 성공적으로 저장되었습니다.')
    } catch (error) {
      console.error('가격 정보 저장 중 오류:', error)
      throw error
    }
  }, [formData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 필수 옵션이 모두 선택되었는지 확인 (카테고리별로 하나씩)
    const requiredOptions = getRequiredOptionsForProduct(formData.productId, productOptions, options)
    const missingCategories = Object.entries(requiredOptions).filter(([, options]) => {
      // 해당 카테고리에서 선택된 옵션이 있는지 확인
      return !(options as ProductOption[]).some((option: ProductOption) => 
        formData.selectedOptions[option.id] && formData.selectedOptions[option.id].length > 0
      )
    })
    
    if (missingCategories.length > 0) {
      alert(`다음 카테고리에서 필수 옵션을 선택해주세요:\n${missingCategories.map(([category]) => category).join('\n')}`)
      return
    }
    
    const totalPeople = formData.adults + formData.child + formData.infant
    
    try {
      // 예약 정보와 가격 정보를 함께 제출
      onSubmit({
        ...formData,
        totalPeople,
        // 가격 정보를 포함하여 전달
        pricingInfo: {
          adultProductPrice: formData.adultProductPrice,
          childProductPrice: formData.childProductPrice,
          infantProductPrice: formData.infantProductPrice,
          productPriceTotal: formData.productPriceTotal,
          requiredOptions: formData.requiredOptions,
          requiredOptionTotal: formData.requiredOptionTotal,
          subtotal: formData.subtotal,
          couponCode: formData.couponCode,
          couponDiscount: formData.couponDiscount,
          additionalDiscount: formData.additionalDiscount,
          additionalCost: formData.additionalCost,
          cardFee: formData.cardFee,
          tax: formData.tax,
          prepaymentCost: formData.prepaymentCost,
          prepaymentTip: formData.prepaymentTip,
          selectedOptionalOptions: formData.selectedOptionalOptions,
          optionTotal: formData.optionTotal,
          totalPrice: formData.totalPrice,
          depositAmount: formData.depositAmount,
          balanceAmount: formData.balanceAmount,
          isPrivateTour: formData.isPrivateTour,
          privateTourAdditionalCost: formData.privateTourAdditionalCost,
          commission_percent: formData.commission_percent
        }
      })
      
      console.log('예약 정보와 가격 정보가 제출되었습니다.')
    } catch (error) {
      console.error('예약 저장 중 오류:', error)
      alert('예약 저장 중 오류가 발생했습니다.')
    }
  }

  // 고객 추가 함수
  const handleAddCustomer = useCallback(async (customerData: Database['public']['Tables']['customers']['Insert']) => {
    try {
      // Supabase에 저장
      const { data, error } = await supabase
        .from('customers')
        .insert(customerData)
        .select()

      if (error) {
        console.error('Error adding customer:', error)
        alert('고객 추가 중 오류가 발생했습니다: ' + error.message)
        return
      }

      // 성공 시 고객 목록 새로고침
      await onRefreshCustomers()
      setShowCustomerForm(false)
      alert('고객이 성공적으로 추가되었습니다!')
      
      // 새로 추가된 고객을 자동으로 선택
      if (data && data[0]) {
        setFormData(prev => ({
          ...prev,
          customerId: data[0].id,
          customerSearch: `${data[0].name}${data[0].email ? ` (${data[0].email})` : ''}`,
          showCustomerDropdown: false
        }))
      }
    } catch (error) {
      console.error('Error adding customer:', error)
      alert('고객 추가 중 오류가 발생했습니다.')
    }
  }, [onRefreshCustomers])

  // 외부 클릭 시 고객 검색 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(event.target as Node)) {
        setFormData(prev => ({ ...prev, showCustomerDropdown: false }))
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const isModal = layout !== 'page'

  return (
    <div className={isModal ? "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4" : "w-full"}>
      <div className={isModal 
        ? "bg-white rounded-lg p-4 sm:p-6 w-full max-w-[95vw] sm:max-w-[80vw] max-h-[95vh] sm:max-h-[90vh] overflow-y-auto"
        : "bg-white rounded-lg p-4 sm:p-6 w-full"}
      >
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 space-y-3 sm:space-y-0">
          <h2 className="text-lg sm:text-xl font-bold">
            {reservation ? t('form.editTitle') : t('form.title')}
          </h2>
          <div className="w-full sm:w-auto">
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.status')}</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'pending' | 'confirmed' | 'completed' | 'cancelled' })}
              className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="pending">{t('status.pending')}</option>
              <option value="confirmed">{t('status.confirmed')}</option>
              <option value="completed">{t('status.completed')}</option>
              <option value="cancelled">{t('status.cancelled')}</option>
            </select>
          </div>
        </div>
        
        {/* 가격 자동 입력 알림 */}
        {priceAutoFillMessage && (
          <div className="mb-4 p-3 bg-green-100 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">
                  {priceAutoFillMessage}
                </p>
              </div>
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {/* 메인 레이아웃 - 모바일 최적화 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:h-[940px]">
            {/* 1열: 고객, 투어 정보, 가격 정보 - 모바일에서는 전체 너비 */}
            <div className="col-span-1 lg:col-span-6 space-y-4 overflow-y-auto border border-gray-200 rounded-lg p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">모든 필드가 보이지 않나요?</div>
                <button type="button" onClick={() => setShowRawDetails(!showRawDetails)} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200">
                  {showRawDetails ? '숨기기' : '전체 데이터 보기'}
                </button>
              </div>
              {showRawDetails && (
                <div className="p-2 bg-gray-50 rounded border overflow-x-auto">
                  <pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(reservation ?? rez, null, 2)}</pre>
                </div>
              )}
              <CustomerSection
                formData={formData}
                setFormData={setFormData}
                customers={customers}
                customerSearchRef={customerSearchRef}
                setShowCustomerForm={setShowCustomerForm}
                t={t}
              />
              
              <TourInfoSection
                formData={formData}
                setFormData={setFormData}
                pickupHotels={pickupHotels}
                sanitizeTimeInput={sanitizeTimeInput}
                t={t}
              />
              
              <ParticipantsSection
                formData={formData}
                setFormData={setFormData}
                t={t}
              />

              <PricingSection
                formData={formData}
                setFormData={setFormData}
                savePricingInfo={savePricingInfo}
                calculateProductPriceTotal={calculateProductPriceTotal}
                calculateRequiredOptionTotal={calculateRequiredOptionTotal}
                calculateCouponDiscount={calculateCouponDiscount}
                coupons={coupons}
                getOptionalOptionsForProduct={(productId) => getOptionalOptionsForProduct(productId, productOptions)}
                getDynamicPricingForOption={getDynamicPricingForOption}
                options={options}
                t={t}
                autoSelectCoupon={autoSelectCoupon}
              />
            </div>

            {/* 2열: 상품 선택 - 모바일에서는 전체 너비, 데스크톱에서는 25% */}
            <div className="col-span-1 lg:col-span-3 space-y-4 overflow-y-auto border border-gray-200 rounded-lg p-3 sm:p-4 lg:h-full">
              <ProductSelectionSection
                formData={formData}
                setFormData={setFormData}
                products={products}
                getRequiredOptionsForProduct={(productId) => getRequiredOptionsForProduct(productId, productOptions, options)}
                getChoicesForOption={(optionId) => getChoicesForOption(optionId, productOptions)}
                loadRequiredOptionsForProduct={(productId) => loadRequiredOptionsForProduct(productId, formData.tourDate, formData.channelId)}
                getDynamicPricingForOption={getDynamicPricingForOption}
                t={t}
              />
            </div>

            {/* 3열: 채널 선택 - 모바일에서는 전체 너비, 데스크톱에서는 25% */}
            <div className="col-span-1 lg:col-span-3 space-y-4 overflow-y-auto border border-gray-200 rounded-lg p-3 sm:p-4 lg:h-full">
              <ChannelSection
                formData={formData}
                setFormData={setFormData}
                channels={channels}
                t={t}
              />
            </div>
          </div>



          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 text-sm sm:text-base"
            >
              {reservation ? tCommon('edit') : tCommon('add')}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 text-sm sm:text-base"
            >
              {tCommon('cancel')}
            </button>
            {reservation && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(t('deleteConfirm'))) {
                    onDelete(reservation.id);
                    onCancel();
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <Trash2 size={16} className="inline mr-2" />
                {tCommon('delete')}
              </button>
            )}
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
    </div>
  )
}
