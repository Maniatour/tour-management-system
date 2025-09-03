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
  onDelete 
}: ReservationFormProps) {
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const t = useTranslations('reservations')
  const tCommon = useTranslations('common')
  const customerSearchRef = useRef<HTMLDivElement | null>(null)
  
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
    customerId: reservation?.customerId || '',
    customerSearch: reservation?.customerId ? 
      customers.find(c => c.id === reservation.customerId)?.name || '' : '',
    showCustomerDropdown: false,
    productId: reservation?.productId || '',
    selectedProductCategory: '',
    selectedProductSubCategory: '',
    productSearch: '',
    tourDate: reservation?.tourDate || '',
    tourTime: reservation?.tourTime || '',
    eventNote: reservation?.eventNote || '',
    pickUpHotel: reservation?.pickUpHotel || '',
    pickUpHotelSearch: reservation?.pickUpHotel ? 
      pickupHotels.find(h => h.id === reservation.pickUpHotel) ? 
        `${pickupHotels.find(h => h.id === reservation.pickUpHotel)?.hotel} - ${pickupHotels.find(h => h.id === reservation.pickUpHotel)?.pick_up_location}` : '' : '',
    showPickupHotelDropdown: false,
    pickUpTime: reservation?.pickUpTime || '',
    adults: reservation?.adults || 1,
    child: reservation?.child || 0,
    infant: reservation?.infant || 0,
    totalPeople: reservation?.totalPeople || 1,
    channelId: reservation?.channelId || '',
    selectedChannelType: reservation?.channelId ? 
      (channels.find(c => c.id === reservation?.channelId)?.type || 'self') : 'self',
    channelSearch: '',
    channelRN: reservation?.channelRN || '',
    addedBy: reservation?.addedBy || '',
    addedTime: reservation?.addedTime || new Date().toISOString().slice(0, 16).replace('T', ' '),
    tourId: reservation?.tourId || '',
    status: reservation?.status || 'pending',
    selectedOptions: reservation?.selectedOptions || {},
    selectedOptionPrices: reservation?.selectedOptionPrices || {},
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
    isPrivateTour: false,
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
            isPrivateTour: existingPricing.is_private_tour || false,
            privateTourAdditionalCost: existingPricing.private_tour_additional_cost || 0,
            commission_percent: 0 // reservation_pricing에는 commission_percent가 없으므로 0으로 설정
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
        return
      }

      if (!pricingData || pricingData.length === 0) {
        console.log('Dynamic pricing 데이터가 없습니다. 기본 가격을 사용합니다.')
        
        // 기본 가격 조회
        try {
          const { data: productData, error: productError } = await supabase
            .from('products')
            .select('base_price')
            .eq('id', productId)
            .single()

          if (productError) {
            console.log('기본 가격 조회 오류:', productError.message)
            return
          }

          if (productData) {
            console.log('기본 가격 사용:', productData.base_price)
            setFormData(prev => ({
              ...prev,
              adultProductPrice: productData.base_price || 0,
              childProductPrice: productData.base_price * 0.7 || 0, // 아동은 성인 가격의 70%
              infantProductPrice: 0 // 유아는 무료
            }))
            
            setPriceAutoFillMessage('기본 가격이 자동으로 입력되었습니다!')
          }
        } catch (fallbackError) {
          console.log('기본 가격 조회 실패:', fallbackError)
        }
        
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
    Object.values(formData.requiredOptions).forEach(option => {
      total += (option.adult * formData.adults) + 
               (option.child * formData.child) + 
               (option.infant * formData.infant)
    })
    return total
  }, [formData.requiredOptions, formData.adults, formData.child, formData.infant])

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
  const calculateCouponDiscount = (coupon: Database['public']['Tables']['coupons']['Row'], subtotal: number) => {
    if (!coupon) return 0
    
    console.log('쿠폰 할인 계산:', { coupon, subtotal }) // 디버깅용
    
    // 새로운 스키마 사용: discount_type, percentage_value, fixed_value
    if (coupon.discount_type === 'percentage' && coupon.percentage_value) {
      return (subtotal * (Number(coupon.percentage_value) || 0)) / 100
    } else if (coupon.discount_type === 'fixed' && coupon.fixed_value) {
      return Number(coupon.fixed_value) || 0
    }
    
    return 0
  }

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
        is_private_tour: formData.isPrivateTour,
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-[80vw] max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            {reservation ? t('form.editTitle') : t('form.title')}
          </h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('form.status')}</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'pending' | 'confirmed' | 'completed' | 'cancelled' })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 메인 3열 그리드 레이아웃 */}
          <div className="grid grid-cols-12 gap-4 h-[940px]">
            {/* 1열: 고객, 투어 정보, 가격 정보 (6/12 = 50%) */}
            <div className="col-span-6 space-y-4 overflow-y-auto border border-gray-200 rounded-lg p-4">
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
              />
            </div>

            {/* 2열: 상품 선택 (3/12 = 25%) */}
            <div className="col-span-3 space-y-4 overflow-y-auto border border-gray-200 rounded-lg p-4 h-full">
              <ProductSelectionSection
                formData={formData}
                setFormData={setFormData}
                products={products}
                getRequiredOptionsForProduct={(productId) => getRequiredOptionsForProduct(productId, productOptions, options)}
                getChoicesForOption={(optionId) => getChoicesForOption(optionId, optionChoices)}
                loadRequiredOptionsForProduct={(productId) => loadRequiredOptionsForProduct(productId, formData.tourDate, formData.channelId)}
                getDynamicPricingForOption={getDynamicPricingForOption}
                t={t}
              />
            </div>

            {/* 3열: 채널 선택 (3/12 = 25%) */}
            <div className="col-span-3 space-y-4 overflow-y-auto border border-gray-200 rounded-lg p-4 h-full">
              <ChannelSection
                formData={formData}
                setFormData={setFormData}
                channels={channels}
                t={t}
              />
            </div>
          </div>



          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
            >
              {reservation ? tCommon('edit') : tCommon('add')}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
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
