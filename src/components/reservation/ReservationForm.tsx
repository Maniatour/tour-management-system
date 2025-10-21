'use client'
/* eslint-disable */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
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
import ProductSelectionSection from '@/components/reservation/ProductSelectionSectionNew'
import ChannelSection from '@/components/reservation/ChannelSection'
import TourConnectionSection from '@/components/reservation/TourConnectionSection'
import PaymentRecordsList from '@/components/PaymentRecordsList'
import ReservationOptionsSection from '@/components/reservation/ReservationOptionsSection'
import QuantityBasedAccommodationSelector from '@/components/reservation/QuantityBasedAccommodationSelector'
import { getOptionalOptionsForProduct } from '@/utils/reservationUtils'
import type { 
  Customer, 
  Product, 
  Channel, 
  ProductOption, 
  Option, 
  PickupHotel, 
  Reservation 
} from '@/types/reservation'

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
  layout?: 'modal' | 'page'
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
  layout = 'modal'
}: ReservationFormProps) {
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const t = useTranslations('reservations')
  const tCommon = useTranslations('common')
  const customerSearchRef = useRef<HTMLDivElement | null>(null)
  const rez: RezLike = (reservation as unknown as RezLike) || ({} as RezLike)
  const [showRawDetails, setShowRawDetails] = useState(false)
  const [channelAccordionExpanded, setChannelAccordionExpanded] = useState(layout === 'modal')
  const [reservationOptionsTotalPrice, setReservationOptionsTotalPrice] = useState(0)
  
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
    // OTA/현장 결제 분리
    onlinePaymentAmount: number
    onSiteBalanceAmount: number
    productRequiredOptions: ProductOption[]
  }>({
    customerId: reservation?.customerId || (reservation as any)?.customer_id || rez.customer_id || '',
    customerSearch: (() => {
      const customerId = reservation?.customerId || (reservation as any)?.customer_id
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
    status: (reservation?.status as 'pending' | 'confirmed' | 'completed' | 'cancelled') || 'pending',
    selectedOptions: reservation?.selectedOptions || rez.selected_options || {},
    selectedOptionPrices: reservation?.selectedOptionPrices || rez.selected_option_prices || {},
    // 초이스 정보 초기값
    productChoices: [],
    selectedChoices: [],
    choicesTotal: 0,
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
    onlinePaymentAmount: 0,
    onSiteBalanceAmount: 0,
    productRequiredOptions: []
  })

  type OptionsPricingArray = Array<{ option_id: string; adult_price?: number | null; child_price?: number | null; infant_price?: number | null }>
  type OptionsPricingRecord = Record<string, { adult?: number | null; adult_price?: number | null; child?: number | null; child_price?: number | null; infant?: number | null; infant_price?: number | null }>
  type OptionsPricing = OptionsPricingArray | OptionsPricingRecord

  // 현재 사용자 정보 가져오기
  const [, setCurrentUser] = useState<{ email: string } | null>(null)
  
  // 가격 자동 입력 알림 상태
  const [priceAutoFillMessage, setPriceAutoFillMessage] = useState<string>('')
  // 기존 가격 정보가 로드되었는지 추적
  const [isExistingPricingLoaded, setIsExistingPricingLoaded] = useState<boolean>(false)
  
  // 무한 렌더링 방지를 위한 ref
  const prevPricingParams = useRef<{productId: string, tourDate: string, channelId: string} | null>(null)
  const prevCouponParams = useRef<{productId: string, tourDate: string, channelId: string} | null>(null)
  const prevProductId = useRef<string | null>(null)



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

  // reservation_id로 reservations 테이블에서 직접 데이터 가져오기
  useEffect(() => {
    const fetchReservationData = async () => {
      if (!reservation?.id) {
        console.log('ReservationForm: reservation 또는 reservation.id가 없음:', {
          hasReservation: !!reservation,
          reservationId: reservation?.id,
          reservationKeys: reservation ? Object.keys(reservation) : []
        })
        return
      }

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
          console.error('ReservationForm: 예약 데이터 조회 오류:', reservationError)
          console.log('예약 오류 상세:', {
            message: reservationError.message,
            details: reservationError.details,
            hint: reservationError.hint,
            code: reservationError.code
          })
          return
        }

        if (reservationData) {
          console.log('ReservationForm: 예약 데이터 조회 성공:', reservationData)
          
          // customer_id로 customers 테이블에서 고객 정보 조회
          if (reservationData.customer_id) {
            const { data: customerData, error: customerError } = await (supabase as any)
              .from('customers')
              .select('id, name, email, phone')
              .eq('id', reservationData.customer_id)
              .single()

            if (customerError) {
              console.error('ReservationForm: 고객 데이터 조회 오류:', customerError)
              console.log('고객 오류 상세:', {
                message: customerError.message,
                details: customerError.details,
                hint: customerError.hint,
                code: customerError.code
              })
            } else if (customerData) {
              console.log('ReservationForm: 고객 데이터 조회 성공:', customerData)
              
              // formData 업데이트 (기본 필드와 choices 데이터)
              setFormData(prev => ({
                ...prev,
                customerId: customerData.id,
                customerSearch: customerData.name || '',
                productId: reservationData.product_id || '',
                status: reservationData.status || 'pending'
              }))
              
              // 상품 ID가 설정된 후 초이스 로드
              if (reservationData.product_id) {
                console.log('ReservationForm: 예약 데이터 로드 후 상품 초이스 로드 시도:', reservationData.product_id)
                setTimeout(() => {
                  loadProductChoices(reservationData.product_id)
                }, 100) // 약간의 지연을 두어 formData 업데이트가 완료된 후 실행
              }
              
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
                    
                    // 수량 기반 다중 선택인 경우
                    if (choice.type === 'multiple_quantity' && choice.selections) {
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
                          total_price: selectedOption.adult_price || 0
                        })
                        
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
            }
          }
        }
      } catch (error) {
        console.error('ReservationForm: 데이터 조회 중 예외 발생:', error)
      }
    }

    fetchReservationData()
  }, [reservation?.id])

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

  // 새로운 reservation_choices 테이블에서 초이스 데이터 로드
  const loadReservationChoicesFromNewTable = useCallback(async (reservationId: string, productId?: string) => {
    try {
      console.log('ReservationForm: 새로운 테이블에서 초이스 데이터 로드 시작:', reservationId)
      
      const { data, error } = await supabase
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
            capacity,
            is_default,
            is_active,
            sort_order,
            product_choices!inner (
              id,
              choice_group,
              choice_group_ko,
              choice_type,
              is_required,
              min_selections,
              max_selections,
              sort_order
            )
          )
        `)
        .eq('reservation_id', reservationId)

      if (error) {
        console.error('ReservationForm: 새로운 테이블에서 초이스 데이터 로드 오류:', error)
        return
      }

      console.log('ReservationForm: 새로운 테이블에서 로드된 초이스 데이터:', data)

      if (data && data.length > 0) {
        const selectedChoices: Array<{
          choice_id: string
          option_id: string
          quantity: number
          total_price: number
        }> = []

        const productChoices: any[] = []
        const choicesData: Record<string, any> = {}

        // 선택된 초이스들을 배열로 변환
        data.forEach((item: any) => {
          selectedChoices.push({
            choice_id: item.choice_id,
            option_id: item.option_id,
            quantity: item.quantity,
            total_price: item.total_price
          })

          // productChoices에 초이스 정보 추가 (중복 방지)
          const existingChoice = productChoices.find(pc => pc.id === item.choice_options.product_choices.id)
          if (!existingChoice) {
            productChoices.push({
              id: item.choice_options.product_choices.id,
              choice_group: item.choice_options.product_choices.choice_group,
              choice_group_ko: item.choice_options.product_choices.choice_group_ko,
              choice_type: item.choice_options.product_choices.choice_type,
              is_required: item.choice_options.product_choices.is_required,
              min_selections: item.choice_options.product_choices.min_selections,
              max_selections: item.choice_options.product_choices.max_selections,
              sort_order: item.choice_options.product_choices.sort_order,
              options: []
            })
          }

          // 옵션 정보 추가
          const choice = productChoices.find(pc => pc.id === item.choice_options.product_choices.id)
          if (choice) {
            choice.options.push({
              id: item.choice_options.id,
              option_key: item.choice_options.option_key,
              option_name: item.choice_options.option_name,
              option_name_ko: item.choice_options.option_name_ko,
              adult_price: item.choice_options.adult_price,
              child_price: item.choice_options.child_price,
              infant_price: item.choice_options.infant_price,
              capacity: item.choice_options.capacity,
              is_default: item.choice_options.is_default,
              is_active: item.choice_options.is_active,
              sort_order: item.choice_options.sort_order
            })
          }

          // choices 데이터 추가
          choicesData[item.choice_options.id] = {
            adult_price: item.choice_options.adult_price,
            child_price: item.choice_options.child_price,
            infant_price: item.choice_options.infant_price
          }
        })

        const choicesTotal = selectedChoices.reduce((sum, choice) => sum + choice.total_price, 0)

        console.log('ReservationForm: 새로운 테이블에서 복원된 데이터:', {
          selectedChoices,
          productChoices,
          choicesData,
          choicesTotal
        })

        // 편집 모드에서는 해당 상품의 모든 초이스 옵션을 로드하여 모든 옵션을 표시
        if (productId) {
          console.log('ReservationForm: 편집 모드 - 상품의 모든 초이스 옵션 로드:', productId)
          try {
            const { data: allChoicesData, error: allChoicesError } = await supabase
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

            if (allChoicesError) {
              console.error('ReservationForm: 모든 초이스 옵션 로드 오류:', allChoicesError)
            } else {
              console.log('ReservationForm: 로드된 모든 초이스 옵션:', allChoicesData)
              setFormData(prev => ({
                ...prev,
                selectedChoices,
                productChoices: allChoicesData || [],
                choices: choicesData,
                choicesTotal,
                quantityBasedChoices: {},
                quantityBasedChoiceTotal: 0
              }))
              return
            }
          } catch (error) {
            console.error('ReservationForm: 모든 초이스 옵션 로드 중 예외:', error)
          }
        }

        setFormData(prev => ({
          ...prev,
          selectedChoices,
          productChoices,
          choices: choicesData,
          choicesTotal,
          quantityBasedChoices: {},
          quantityBasedChoiceTotal: 0
        }))
      } else {
        console.log('ReservationForm: 새로운 테이블에 초이스 데이터가 없음')
        // 새로운 테이블에 데이터가 없으면 기존 choices 데이터 사용
        if (reservation && reservation.choices && reservation.choices.required && reservation.choices.required.length > 0) {
          console.log('ReservationForm: 기존 choices 데이터로 fallback:', reservation.choices)
          // 기존 choices 데이터 처리 로직 실행
          processExistingChoicesData(reservation.choices)
        } else {
          // 데이터가 없으면 빈 상태로 설정
          setFormData(prev => ({
            ...prev,
            selectedChoices: [],
            productChoices: [],
            choices: {},
            choicesTotal: 0,
            quantityBasedChoices: {},
            quantityBasedChoiceTotal: 0
          }))
        }
      }
    } catch (error) {
      console.error('ReservationForm: 새로운 테이블에서 초이스 데이터 로드 중 예외:', error)
    }
  }, [])

  // 기존 products.choices에서 초이스 데이터 로드
  const loadProductChoicesFromOldTable = useCallback(async (productId: string) => {
    try {
      console.log('ReservationForm: 기존 products.choices에서 초이스 데이터 로드 시도:', productId);
      
      const { data: product, error } = await supabase
        .from('products')
        .select('choices')
        .eq('id', productId)
        .single();

      if (error) {
        console.error('ReservationForm: 기존 products.choices 로드 오류:', error);
        return;
      }

      if (product && product.choices) {
        console.log('ReservationForm: 기존 products.choices 데이터 발견:', product.choices);
        
        // 기존 choices 데이터를 새로운 형식으로 변환
        const productChoices: any[] = [];
        const selectedChoices: Array<{
          choice_id: string
          option_id: string
          quantity: number
          total_price: number
        }> = [];
        const choicesData: Record<string, any> = {};

        if (product.choices.required && Array.isArray(product.choices.required)) {
          product.choices.required.forEach((choice: any) => {
            const choiceData = {
              id: choice.id,
              choice_group: choice.name || choice.id,
              choice_group_ko: choice.name_ko || choice.name || choice.id,
              choice_type: choice.type || 'single',
              is_required: true,
              min_selections: choice.validation?.min_selections || 1,
              max_selections: choice.validation?.max_selections || 10,
              sort_order: 0,
              options: []
            };

            if (choice.options && Array.isArray(choice.options)) {
              choice.options.forEach((option: any) => {
                const optionData = {
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
          productChoices,
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
      console.error('ReservationForm: 기존 products.choices 로드 중 예외:', error);
    }
  }, [])

  // 기존 choices 데이터 처리 함수
  const processExistingChoicesData = useCallback((choicesData: any) => {
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

  // 예약 데이터에서 choices 선택 복원 (편집 모드에서만)
  useEffect(() => {
    console.log('ReservationForm: choices 복원 useEffect 실행:', {
      hasReservation: !!reservation,
      hasChoices: !!(reservation && reservation.choices),
      reservationId: reservation?.id,
      choices: reservation?.choices,
      isEditMode: !!reservation?.id
    })
    
    // 편집 모드에서만 기존 예약 데이터 복원
    if (reservation?.id) {
      // 새로운 reservation_choices 테이블에서 데이터 로드
      console.log('ReservationForm: 편집 모드 - 새로운 테이블에서 초이스 데이터 로드 시도:', reservation.id)
      loadReservationChoicesFromNewTable(reservation.id, formData.productId)
    } else if (reservation && reservation.choices && reservation.choices.required && reservation.choices.required.length > 0) {
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
  }, [reservation, loadReservationChoicesFromNewTable])

  // 새로운 간결한 초이스 시스템 사용

  // 새로운 간결한 초이스 시스템에서 상품 choices 로드
  const loadProductChoices = useCallback(async (productId: string) => {
    if (!productId) {
      setFormData(prev => ({ ...prev, productChoices: [], selectedChoices: [], choicesTotal: 0 }))
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
        return;
      }
      // 편집 모드가 아닌 경우에만 기본 초이스 설정
      const defaultChoices: Array<{
        choice_id: string
        option_id: string
        quantity: number
        total_price: number
      }> = [];
      
      if (!reservation?.id) {
        data?.forEach(choice => {
          const defaultOption = choice.options?.find(opt => opt.is_default);
          if (defaultOption) {
            defaultChoices.push({
              choice_id: choice.id,
              option_id: defaultOption.id,
              quantity: 1,
              total_price: defaultOption.adult_price
            });
          }
        });
      }

      const choicesTotal = defaultChoices.reduce((sum, choice) => sum + choice.total_price, 0);

      setFormData(prev => ({
        ...prev,
        productChoices: data || [],
        selectedChoices: reservation?.id ? prev.selectedChoices : defaultChoices, // 편집 모드에서는 기존 선택 유지
        choicesTotal: reservation?.id ? prev.choicesTotal : choicesTotal
      }));
    } catch (error) {
      console.error('초이스 로드 오류:', error);
      setFormData(prev => ({ ...prev, productChoices: [], selectedChoices: [], choicesTotal: 0 }));
    }
  }, []);

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
        const { data: existingPricing, error: existingError } = await (supabase as any)
          .from('reservation_pricing')
          .select('id, adult_product_price, child_product_price, infant_product_price, product_price_total, required_options, required_option_total, subtotal, coupon_code, coupon_discount, additional_discount, additional_cost, card_fee, tax, prepayment_cost, prepayment_tip, selected_options, option_total, total_price, deposit_amount, balance_amount, private_tour_additional_cost, commission_percent')
          .eq('reservation_id', reservationId)
          .maybeSingle()

        if (existingError) {
          console.log('기존 가격 정보 조회 오류:', existingError.message)
          // 오류가 발생해도 계속 진행 (dynamic_pricing 조회)
        } else if (existingPricing) {
          console.log('기존 가격 정보 사용:', existingPricing)
          console.log('쿠폰 정보 확인:', {
            coupon_code: existingPricing.coupon_code,
            coupon_discount: existingPricing.coupon_discount,
            coupon_discount_type: typeof existingPricing.coupon_discount
          })
          
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
            couponDiscount: Number(existingPricing.coupon_discount) || 0,
            additionalDiscount: Number(existingPricing.additional_discount) || 0,
            additionalCost: Number(existingPricing.additional_cost) || 0,
            cardFee: Number(existingPricing.card_fee) || 0,
            tax: Number(existingPricing.tax) || 0,
            prepaymentCost: Number(existingPricing.prepayment_cost) || 0,
            prepaymentTip: Number(existingPricing.prepayment_tip) || 0,
            selectedOptionalOptions: existingPricing.selected_options || {},
            optionTotal: Number(existingPricing.option_total) || 0,
            totalPrice: Number(existingPricing.total_price) || 0,
            depositAmount: Number(existingPricing.deposit_amount) || 0,
            balanceAmount: Number(existingPricing.balance_amount) || 0,
            isPrivateTour: reservation?.isPrivateTour || false,
            privateTourAdditionalCost: Number(existingPricing.private_tour_additional_cost) || 0,
            commission_percent: Number((existingPricing as any).commission_percent) || 0
          }))
          
          setIsExistingPricingLoaded(true)
          setPriceAutoFillMessage('기존 가격 정보가 로드되었습니다!')
          return // 기존 가격 정보가 있으면 dynamic_pricing 조회하지 않음
        }
      }

      // 2. reservation_pricing에 가격 정보가 없으면 dynamic_pricing에서 조회
      console.log('Dynamic pricing 조회 시작:', { productId, tourDate, channelId })
      
      const { data: pricingData, error } = await (supabase as any)
        .from('dynamic_pricing')
        .select('adult_price, child_price, infant_price, commission_percent, options_pricing, not_included_price')
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

      const pricing = pricingData[0] as any
      console.log('Dynamic pricing 데이터 조회 성공:', pricing)

      // 가격 정보를 formData에 반영
      setFormData(prev => ({
        ...prev,
        adultProductPrice: (pricing?.adult_price as number) || 0,
        childProductPrice: (pricing?.child_price as number) || 0,
        infantProductPrice: (pricing?.infant_price as number) || 0,
        commission_percent: (pricing?.commission_percent as number) || 0,
        // Derive OTA per-adult amount when not_included_price is provided
        onlinePaymentAmount: pricing?.not_included_price != null
          ? Math.max(0, ((pricing?.adult_price || 0) - (pricing?.not_included_price || 0)) * (prev.adults || 0))
          : prev.onlinePaymentAmount || 0
      }))

      // choice 데이터를 먼저 로드
      await loadProductChoices(productId)

      console.log('가격 정보가 자동으로 입력되었습니다')
      
      // 사용자에게 알림 표시
      setPriceAutoFillMessage('Dynamic pricing에서 가격 정보가 자동으로 입력되었습니다!')
      setTimeout(() => setPriceAutoFillMessage(''), 3000)
      
      // dynamic pricing에서 로드된 경우에도 상태 설정 (쿠폰 자동 선택 방지)
      setIsExistingPricingLoaded(true)
    } catch (error) {
      console.error('Dynamic pricing 조회 중 오류:', error)
    }
  }, [])

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

  // 새로운 간결한 초이스 시스템에서는 formData.choicesTotal을 직접 사용

  const calculateSubtotal = useCallback(() => {
    // 새로운 간결한 초이스 시스템 사용
    const choicesTotal = formData.choicesTotal || 0;
    const requiredOptionTotal = calculateRequiredOptionTotal();
    
    // 우선순위: 새로운 초이스 시스템 > 기존 requiredOptions
    const optionTotal = choicesTotal > 0 ? choicesTotal : requiredOptionTotal;
    
    return calculateProductPriceTotal() + optionTotal;
  }, [formData.choicesTotal, calculateRequiredOptionTotal, calculateProductPriceTotal]);

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
      (formData.isPrivateTour ? formData.privateTourAdditionalCost : 0) +
      reservationOptionsTotalPrice

    // 총 가격(고객 총지불 기준, balance는 별도로 표시만 함)
    const grossTotal = Math.max(0, subtotal - totalDiscount + totalAdditional)
    return grossTotal
  }, [calculateSubtotal, formData.couponDiscount, formData.additionalDiscount, formData.additionalCost, formData.cardFee, formData.tax, formData.prepaymentCost, formData.prepaymentTip, calculateOptionTotal, formData.isPrivateTour, formData.privateTourAdditionalCost, reservationOptionsTotalPrice])

  const calculateBalance = useCallback(() => {
    return Math.max(0, formData.totalPrice - formData.depositAmount)
  }, [formData.totalPrice, formData.depositAmount])

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
  }, [formData.productId, formData.tourDate, formData.channelId, coupons, formData.adults, formData.child, formData.infant])

  // 상품이 변경될 때 choice 데이터 로드 (편집 모드에서는 기존 데이터 보존)
  useEffect(() => {
    console.log('ReservationForm: 상품 변경 useEffect 실행:', {
      productId: formData.productId,
      prevProductId: prevProductId.current,
      isDifferent: formData.productId !== prevProductId.current,
      isEditMode: !!reservation?.id
    })
    
    // 편집 모드에서는 상품이 변경될 때만 초이스 로드 (기존 데이터 보존)
    if (formData.productId && formData.productId !== prevProductId.current) {
      console.log('ReservationForm: 상품 변경 감지 - 새로운 테이블에서 초이스 로드:', formData.productId)
      prevProductId.current = formData.productId
      
      // 편집 모드가 아닌 경우에만 기본 초이스 로드
      if (!reservation?.id) {
        loadProductChoices(formData.productId)
      }
    }
  }, [formData.productId, loadProductChoices, reservation?.id])

  // 상품, 날짜, 채널이 변경될 때 dynamic pricing에서 가격 자동 조회
  useEffect(() => {
    if (formData.productId && formData.tourDate && formData.channelId) {
      const currentParams = {
        productId: formData.productId,
        tourDate: formData.tourDate,
        channelId: formData.channelId
      }
      
      // 이전 파라미터와 비교하여 변경된 경우에만 실행
      if (!prevPricingParams.current || 
          prevPricingParams.current.productId !== currentParams.productId ||
          prevPricingParams.current.tourDate !== currentParams.tourDate ||
          prevPricingParams.current.channelId !== currentParams.channelId) {
        
        console.log('가격 자동 조회 트리거:', currentParams)
        prevPricingParams.current = currentParams
        loadPricingInfo(formData.productId, formData.tourDate, formData.channelId, reservation?.id)
      }
    }
  }, [formData.productId, formData.tourDate, formData.channelId, reservation?.id])

  // 상품, 날짜, 채널이 변경될 때 쿠폰 자동 선택 (기존 가격 정보가 로드되지 않은 경우에만)
  useEffect(() => {
    if (formData.productId && formData.tourDate && formData.channelId && !isExistingPricingLoaded) {
      const currentParams = {
        productId: formData.productId,
        tourDate: formData.tourDate,
        channelId: formData.channelId
      }
      
      // 이전 파라미터와 비교하여 변경된 경우에만 실행
      if (!prevCouponParams.current || 
          prevCouponParams.current.productId !== currentParams.productId ||
          prevCouponParams.current.tourDate !== currentParams.tourDate ||
          prevCouponParams.current.channelId !== currentParams.channelId) {
        
        console.log('쿠폰 자동 선택 실행 (기존 가격 정보 없음)')
        prevCouponParams.current = currentParams
        autoSelectCoupon()
      }
    }
  }, [formData.productId, formData.tourDate, formData.channelId, isExistingPricingLoaded])

  // 가격 정보 자동 업데이트 (무한 렌더링 방지를 위해 useEffect 완전 제거)
  const updatePrices = useCallback(() => {
    const newProductPriceTotal = calculateProductPriceTotal()
    const newRequiredOptionTotal = calculateRequiredOptionTotal()
    const newChoicesTotal = formData.choicesTotal || 0
    const newSubtotal = calculateSubtotal()
    const newTotalPrice = calculateTotalPrice()
    const newBalance = calculateBalance()

    setFormData(prev => ({
      ...prev,
      productPriceTotal: newProductPriceTotal,
      requiredOptionTotal: newRequiredOptionTotal,
      choicesTotal: newChoicesTotal,
      subtotal: newSubtotal,
      totalPrice: newTotalPrice,
      balanceAmount: prev.onSiteBalanceAmount > 0 ? prev.onSiteBalanceAmount : newBalance
    }))
  }, [])

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
      balanceAmount: prev.onSiteBalanceAmount > 0 ? prev.onSiteBalanceAmount : newBalance
    }))
  }, [reservationOptionsTotalPrice, reservation?.id])

  // dynamic_pricing에서 특정 choice의 가격 정보를 가져오는 함수
  const getDynamicPricingForOption = useCallback(async (choiceId: string) => {
    if (!formData.productId || !formData.tourDate || !formData.channelId) {
      return null
    }

    try {
      // dynamic_pricing 테이블에서 choices_pricing 조회
      const { data: pricingData, error } = await (supabase as any)
        .from('dynamic_pricing')
        .select('choices_pricing')
        .eq('product_id', formData.productId)
        .eq('date', formData.tourDate)
        .eq('channel_id', formData.channelId)
        .limit(1)

      if (error || !pricingData || pricingData.length === 0) {
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
  }, [])

  // 가격 정보 저장 함수 (외부에서 호출 가능)
  const savePricingInfo = useCallback(async (reservationId: string) => {
    try {
      // 기존 가격 정보가 있는지 확인하여 id를 가져오거나 새로 생성
      const { data: existingPricing, error: checkError } = await (supabase as any)
        .from('reservation_pricing')
        .select('id')
        .eq('reservation_id', reservationId)
        .maybeSingle()

      let pricingId: string
      if (existingPricing) {
        pricingId = existingPricing.id
      } else {
        // 새 ID 생성 (UUID 형식)
        pricingId = crypto.randomUUID()
      }

      const pricingData: Database['public']['Tables']['reservation_pricing']['Insert'] = {
        id: pricingId,
        reservation_id: reservationId,
        adult_product_price: formData.adultProductPrice,
        child_product_price: formData.childProductPrice,
        infant_product_price: formData.infantProductPrice,
        product_price_total: formData.productPriceTotal,
        required_options: formData.requiredOptions,
        required_option_total: formData.requiredOptionTotal,
        choices: formData.choices,
        choices_total: formData.choicesTotal,
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

      let error: unknown
      if (checkError && checkError.code !== 'PGRST116') { // PGRST116은 "no rows returned" 오류
        console.error('기존 가격 정보 확인 오류:', checkError)
        throw checkError
      }

      if (existingPricing) {
        // 기존 데이터가 있으면 업데이트
        const { error: updateError } = await (supabase as any)
          .from('reservation_pricing')
          .update(pricingData as Database['public']['Tables']['reservation_pricing']['Update'])
          .eq('reservation_id', reservationId)
        
        error = updateError
      } else {
        // 기존 데이터가 없으면 새로 삽입
        const { error: insertError } = await (supabase as any)
          .from('reservation_pricing')
          .insert([pricingData as Database['public']['Tables']['reservation_pricing']['Insert']])
        
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
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 새로운 간결한 초이스 시스템에서 필수 초이스 검증
    const missingRequiredChoices = formData.productChoices.filter(choice => {
      if (!choice.is_required) return false
      
      // 해당 초이스에서 선택된 옵션이 있는지 확인
      const hasSelection = formData.selectedChoices.some(selectedChoice => 
        selectedChoice.choice_id === choice.id
      )
      
      return !hasSelection
    })
    
    if (missingRequiredChoices.length > 0) {
      const missingChoiceNames = missingRequiredChoices.map(choice => choice.choice_group_ko || choice.choice_group).join('\n')
      alert(`다음 카테고리에서 필수 옵션을 선택해주세요:\n${missingChoiceNames}`)
      return
    }
    
    const totalPeople = formData.adults + formData.child + formData.infant
    
    try {
      // 새로운 간결한 초이스 시스템 사용
      const choicesData: any = {
        required: []
      }
      
      // 새로운 초이스 시스템에서 선택된 초이스 처리
      if (Array.isArray(formData.selectedChoices)) {
        formData.selectedChoices.forEach(choice => {
          choicesData.required.push({
            choice_id: choice.choice_id,
            option_id: choice.option_id,
            quantity: choice.quantity,
            total_price: choice.total_price,
            timestamp: new Date().toISOString()
          })
        })
      } else if (formData.selectedChoices && typeof formData.selectedChoices === 'object') {
        // 기존 객체 형태의 selectedChoices 처리
        Object.entries(formData.selectedChoices).forEach(([choiceId, choiceData]) => {
          if (choiceData && typeof choiceData === 'object' && 'selected' in choiceData) {
            choicesData.required.push({
              choice_id: choiceId,
              option_id: choiceData.selected,
              quantity: 1,
              total_price: 0, // 기존 시스템에서는 가격이 별도로 계산됨
              timestamp: choiceData.timestamp || new Date().toISOString()
            })
          }
        })
      }
      
      // 예약 정보와 가격 정보를 함께 제출
      onSubmit({
        ...formData,
        totalPeople,
        choices: choicesData,
        // 가격 정보를 포함하여 전달
        pricingInfo: {
          adultProductPrice: formData.adultProductPrice,
          childProductPrice: formData.childProductPrice,
          infantProductPrice: formData.infantProductPrice,
          productPriceTotal: formData.productPriceTotal,
          requiredOptions: formData.requiredOptions,
          requiredOptionTotal: formData.requiredOptionTotal,
          choices: choicesData,
          choicesTotal: formData.choicesTotal,
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
      const { data, error } = await (supabase as any)
        .from('customers')
        .insert(customerData as Database['public']['Tables']['customers']['Insert'])
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
          customerId: (data[0] as Database['public']['Tables']['customers']['Row']).id,
          customerSearch: `${(data[0] as Database['public']['Tables']['customers']['Row']).name}${(data[0] as Database['public']['Tables']['customers']['Row']).email ? ` (${(data[0] as Database['public']['Tables']['customers']['Row']).email})` : ''}`,
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
            {reservation && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                (ID: {reservation.id})
              </span>
            )}
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
                 calculateChoiceTotal={calculateRequiredOptionTotal}
                 calculateCouponDiscount={calculateCouponDiscount}
                 coupons={coupons}
                 getOptionalOptionsForProduct={(productId) => getOptionalOptionsForProduct(productId, productOptions)}
                 options={options}
                 t={t}
                 autoSelectCoupon={autoSelectCoupon}
                 reservationOptionsTotalPrice={reservationOptionsTotalPrice}
               />

              {/* 입금 내역과 예약 옵션을 2열 그리드로 배치 - 예약이 있을 때만 표시 */}
              {reservation && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* 왼쪽: 예약 옵션 */}
                  <div className="order-2 lg:order-1">
                    <ReservationOptionsSection 
                      reservationId={reservation.id} 
                      onTotalPriceChange={setReservationOptionsTotalPrice}
                    />
                  </div>
                  
                  {/* 오른쪽: 입금 내역 */}
                  <div className="order-1 lg:order-2">
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                      <PaymentRecordsList
                        reservationId={reservation.id}
                        customerName={customers.find(c => c.id === reservation.customerId)?.name || 'Unknown'}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2열: 상품 선택 - 모바일에서는 전체 너비, 데스크톱에서는 25% */}
            <div className="col-span-1 lg:col-span-3 space-y-4 overflow-y-auto border border-gray-200 rounded-lg p-3 sm:p-4 lg:h-full">
              <ProductSelectionSection
                formData={formData}
                setFormData={setFormData}
                products={products.map(p => ({ ...p, name_ko: p.name }))}
                loadProductChoices={(productId) => loadProductChoices(productId)}
                getDynamicPricingForOption={getDynamicPricingForOption}
                t={t}
                layout={layout}
              />

              {/* 새로운 간결한 초이스 시스템이 ProductSelectionSection에서 처리됨 */}
            </div>

            {/* 3열: 채널 선택 - 모바일에서는 전체 너비, 데스크톱에서는 25% */}
            <div className={`col-span-1 lg:col-span-3 space-y-4 overflow-y-auto border border-gray-200 rounded-lg p-3 sm:p-4 ${channelAccordionExpanded ? 'lg:h-full' : 'lg:h-auto'}`}>
              <ChannelSection
                formData={formData}
                setFormData={setFormData}
                channels={channels}
                t={t}
                layout={layout}
                onAccordionToggle={setChannelAccordionExpanded}
              />
              
              {/* 연결된 투어 섹션 - 채널 섹션 아래에 배치 */}
              {layout === 'page' && reservation && (
                <div className="mt-4">
                  <TourConnectionSection 
                    reservation={reservation}
                    onTourCreated={() => {
                      // 투어 생성 후 필요한 새로고침 로직
                    }}
                  />
                </div>
              )}
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
