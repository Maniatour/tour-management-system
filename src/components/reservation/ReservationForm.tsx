'use client'
/* eslint-disable */

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Trash2, Eye } from 'lucide-react'
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
import ReservationExpenseManager from '@/components/ReservationExpenseManager'
import ReservationOptionsSection from '@/components/reservation/ReservationOptionsSection'
import PricingInfoModal from '@/components/reservation/PricingInfoModal'
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
  onViewCustomer?: () => void
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
  layout = 'modal',
  onViewCustomer
}: ReservationFormProps) {
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [showPricingModal, setShowPricingModal] = useState(false)
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false)
  const t = useTranslations('reservations')
  const tCommon = useTranslations('common')
  const customerSearchRef = useRef<HTMLDivElement | null>(null)
  const rez: RezLike = (reservation as unknown as RezLike) || ({} as RezLike)
  const [, setChannelAccordionExpanded] = useState(layout === 'modal')
  const [, setProductAccordionExpanded] = useState(layout === 'modal')
  const [reservationOptionsTotalPrice, setReservationOptionsTotalPrice] = useState(0)
  const [expenseUpdateTrigger, setExpenseUpdateTrigger] = useState(0)
  
  const [formData, setFormData] = useState<{
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
    child: number
    infant: number
    totalPeople: number
    // 거주 상태별 인원 수
    usResidentCount?: number
    nonResidentCount?: number
    nonResidentWithPassCount?: number
    passCoveredCount?: number // 패스로 커버되는 인원 수
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
    not_included_price?: number
    // OTA/현장 결제 분리
    onlinePaymentAmount: number
    onSiteBalanceAmount: number
    productRequiredOptions: ProductOption[]
    // 가격 타입 선택
    priceType: 'base' | 'dynamic'
    // 초이스별 불포함 금액 총합
    choiceNotIncludedTotal?: number
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
    // 고객 정보 초기값
    customerName: (() => {
      const customerId = reservation?.customerId || (reservation as any)?.customer_id || rez.customer_id
      if (customerId && customers.length > 0) {
        const customer = customers.find(c => c.id === customerId)
        return customer?.name || ''
      }
      return ''
    })(),
    customerPhone: (() => {
      const customerId = reservation?.customerId || (reservation as any)?.customer_id || rez.customer_id
      if (customerId && customers.length > 0) {
        const customer = customers.find(c => c.id === customerId)
        return customer?.phone || ''
      }
      return ''
    })(),
    customerEmail: (() => {
      const customerId = reservation?.customerId || (reservation as any)?.customer_id || rez.customer_id
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
    // 거주 상태별 인원 수 (초기값은 0, 예약 수정 시 reservation_customers에서 로드)
    usResidentCount: 0,
    nonResidentCount: 0,
    nonResidentWithPassCount: 0,
    passCoveredCount: 0,
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
    commission_base_price: undefined,
    not_included_price: 0,
    onlinePaymentAmount: 0,
    onSiteBalanceAmount: 0,
    productRequiredOptions: [],
    priceType: 'dynamic', // 기본값은 dynamic pricing
    choiceNotIncludedTotal: 0
  })


  // 현재 사용자 정보 가져오기
  const [, setCurrentUser] = useState<{ email: string } | null>(null)
  
  // 가격 자동 입력 알림 상태
  const [, setPriceAutoFillMessage] = useState<string>('')
  // 기존 가격 정보가 로드되었는지 추적
  const [isExistingPricingLoaded, setIsExistingPricingLoaded] = useState<boolean>(false)
  
  // 무한 렌더링 방지를 위한 ref
  const prevPricingParams = useRef<{productId: string, tourDate: string, channelId: string} | null>(null)
  const prevCouponParams = useRef<{productId: string, tourDate: string, channelId: string} | null>(null)
  const prevProductId = useRef<string | null>(null)



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
          
          // reservation_customers 테이블에서 거주 상태별 인원 수 가져오기
          let usResidentCount = 0
          let nonResidentCount = 0
          let nonResidentWithPassCount = 0
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
                } else if (rc.resident_status === 'non_resident_with_pass') {
                  nonResidentWithPassCount++
                  // 각 패스는 4인을 커버하므로 합산
                  if (rc.pass_covered_count) {
                    passCoveredCount += rc.pass_covered_count
                  }
                }
              })
            }
          } catch (rcError) {
            console.error('ReservationForm: reservation_customers 조회 오류:', rcError)
          }
          
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
                passCoveredCount
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

  // 새로운 reservation_choices 테이블에서 초이스 데이터 로드 (카드뷰와 동일한 로직)
  const loadReservationChoicesFromNewTable = useCallback(async (reservationId: string, productId?: string) => {
    try {
      console.log('ReservationForm: 초이스 데이터 로드 시작:', { reservationId, productId })
      
      // 1. productId가 있으면 모든 product_choices 먼저 로드 (안정적인 식별자 포함)
      let allProductChoices: any[] = []
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
          console.error('ReservationForm: 상품 초이스 로드 오류:', productChoicesError)
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
              choice_group_ko
            )
          )
        `)
        .eq('reservation_id', reservationId)

      if (reservationChoicesError) {
        console.error('ReservationForm: 예약 초이스 로드 오류:', reservationChoicesError)
      }

      console.log('ReservationForm: 예약 초이스 로드 완료:', reservationChoicesData?.length || 0, '개')

      // 3. 선택된 초이스를 allProductChoices와 매칭하여 selectedChoices 생성
      const selectedChoices: Array<{
        choice_id: string
        option_id: string
        option_key: string
        option_name_ko: string
        quantity: number
        total_price: number
      }> = []

      const choicesData: Record<string, any> = {}

      if (reservationChoicesData && reservationChoicesData.length > 0) {
        reservationChoicesData.forEach((rc: any) => {
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
          const finalChoiceId = matchedChoice?.id || rc.choice_options?.product_choices?.id || rc.choice_id
          const finalOptionId = matchedOption?.id || rc.option_id
          const finalOptionKey = matchedOption?.option_key || rc.choice_options?.option_key || ''
          const finalOptionNameKo = matchedOption?.option_name_ko || rc.choice_options?.option_name_ko || ''

          selectedChoices.push({
            choice_id: finalChoiceId,
            option_id: finalOptionId,
            option_key: finalOptionKey,
            option_name_ko: finalOptionNameKo,
            quantity: rc.quantity,
            total_price: rc.total_price
          })

          // 가격 정보 저장
          const priceOption = matchedOption || rc.choice_options
          if (priceOption) {
            choicesData[finalOptionId] = {
              adult_price: priceOption.adult_price,
              child_price: priceOption.child_price,
              infant_price: priceOption.infant_price
            }
          }
        })
      }

      const choicesTotal = selectedChoices.reduce((sum, choice) => sum + choice.total_price, 0)

      console.log('ReservationForm: 초이스 데이터 준비 완료:', {
        selectedChoicesCount: selectedChoices.length,
        productChoicesCount: allProductChoices.length,
        choicesTotal
      })

      // 4. formData 업데이트
      setFormData(prev => ({
        ...prev,
        selectedChoices,
        productChoices: allProductChoices, // 모든 옵션 표시를 위해 allProductChoices 사용
        choices: choicesData,
        choicesTotal,
        quantityBasedChoices: {},
        quantityBasedChoiceTotal: 0
      }))

    } catch (error) {
      console.error('ReservationForm: 초이스 데이터 로드 중 예외:', error)
    }
  }, [supabase, setFormData])

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
        console.error('ReservationForm: 기존 products.choices 로드 오류:', error);
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
      loadReservationChoicesFromNewTable(reservation.id, reservation.productId)
    } else if (reservation && reservation.choices && typeof reservation.choices === 'object' && 'required' in reservation.choices && Array.isArray(reservation.choices.required) && reservation.choices.required.length > 0) {
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
  }, [reservation])

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
        data?.forEach((choice: { id: string; options?: Array<{ id: string; is_default?: boolean; adult_price?: number }> }) => {
          const defaultOption = choice.options?.find((opt: { id: string; is_default?: boolean; adult_price?: number }) => opt.is_default);
          if (defaultOption) {
            defaultChoices.push({
              choice_id: choice.id,
              option_id: defaultOption.id,
              quantity: 1,
              total_price: defaultOption.adult_price || 0
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
  }, [reservation?.id]);

  // 가격 정보 조회 함수 (reservation_pricing 우선, 없으면 priceType에 따라 base_price 또는 dynamic_pricing)
  const loadPricingInfo = useCallback(async (productId: string, tourDate: string, channelId: string, reservationId?: string, priceType: 'base' | 'dynamic' = 'dynamic') => {
    if (!productId || !tourDate || !channelId) {
      console.log('필수 정보가 부족합니다:', { productId, tourDate, channelId })
      return
    }

    try {
      console.log('가격 정보 조회 시작:', { productId, tourDate, channelId, reservationId, priceType })
      
      // 1. 먼저 reservation_pricing에서 기존 가격 정보 확인 (편집 모드인 경우)
      if (reservationId) {
        const { data: existingPricing, error: existingError } = await (supabase as any)
          .from('reservation_pricing')
          .select('id, adult_product_price, child_product_price, infant_product_price, product_price_total, required_options, required_option_total, subtotal, coupon_code, coupon_discount, additional_discount, additional_cost, card_fee, tax, prepayment_cost, prepayment_tip, selected_options, option_total, total_price, deposit_amount, balance_amount, private_tour_additional_cost, commission_percent, commission_amount')
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
          
          // 채널의 pricing_type 확인 (단일 가격 모드 체크)
          const selectedChannel = channels.find(c => c.id === channelId)
          const pricingType = (selectedChannel as any)?.pricing_type || 'separate'
          const isSinglePrice = pricingType === 'single'
          
          // 불포함 있음 채널 확인 (commission_base_price_only 또는 has_not_included_price)
          const hasNotIncludedPrice = (selectedChannel as any)?.has_not_included_price || false
          const commissionBasePriceOnly = (selectedChannel as any)?.commission_base_price_only || false
          const shouldLoadBalanceAmount = hasNotIncludedPrice || commissionBasePriceOnly
          
          // 단일 가격 모드인 경우 adult_product_price를 모든 가격에 적용
          const adultPrice = existingPricing.adult_product_price || 0
          const childPrice = isSinglePrice ? adultPrice : (existingPricing.child_product_price || 0)
          const infantPrice = isSinglePrice ? adultPrice : (existingPricing.infant_product_price || 0)
          
          // 불포함 있음 채널인 경우 balance_amount를 onSiteBalanceAmount에 설정
          const balanceAmount = Number(existingPricing.balance_amount) || 0
          const onSiteBalanceAmount = shouldLoadBalanceAmount && balanceAmount > 0 ? balanceAmount : 0
          
          setFormData(prev => {
            const updated = {
              ...prev,
              adultProductPrice: adultPrice,
              childProductPrice: childPrice,
              infantProductPrice: infantPrice,
              requiredOptions: existingPricing.required_options || {},
              couponCode: existingPricing.coupon_code || '',
              couponDiscount: Number(existingPricing.coupon_discount) || 0,
              additionalDiscount: Number(existingPricing.additional_discount) || 0,
              additionalCost: Number(existingPricing.additional_cost) || 0,
              cardFee: Number(existingPricing.card_fee) || 0,
              tax: Number(existingPricing.tax) || 0,
              prepaymentCost: Number(existingPricing.prepayment_cost) || 0,
              prepaymentTip: Number(existingPricing.prepayment_tip) || 0,
              selectedOptionalOptions: existingPricing.selected_options || {},
              depositAmount: Number(existingPricing.deposit_amount) || 0,
              isPrivateTour: reservation?.isPrivateTour || false,
              privateTourAdditionalCost: Number(existingPricing.private_tour_additional_cost) || 0,
              commission_percent: Number((existingPricing as any).commission_percent) || 0,
              commission_amount: Number((existingPricing as any).commission_amount) || 0,
              commission_base_price: (existingPricing as any).commission_base_price !== undefined && (existingPricing as any).commission_base_price !== null
                ? Number((existingPricing as any).commission_base_price) 
                : undefined,
              onSiteBalanceAmount: onSiteBalanceAmount
            }
            
            // 가격 계산 수행 (단일 가격 모드 적용 후 재계산)
            const newProductPriceTotal = (updated.adultProductPrice * updated.adults) + 
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
                requiredOptionTotal += (optionData.adult * updated.adults) + 
                                      (optionData.child * updated.child) + 
                                      (optionData.infant * updated.infant)
              }
            })
            
            // choicesTotal 또는 requiredOptionTotal 사용
            const choicesTotal = updated.choicesTotal || 0
            const optionTotal = choicesTotal > 0 ? choicesTotal : requiredOptionTotal
            
            // 선택 옵션 총합 계산
            let optionalOptionTotal = 0
            Object.values(updated.selectedOptionalOptions).forEach((option) => {
              if (option && typeof option === 'object' && 'price' in option && 'quantity' in option) {
                const opt = option as { price: number; quantity: number }
                optionalOptionTotal += opt.price * opt.quantity
              }
            })
            
            // Dynamic Price 타입일 때만 초이스별 불포함 금액 포함
            const notIncludedTotal = updated.priceType === 'dynamic' 
              ? (updated.choiceNotIncludedTotal || 0)
              : 0
            
            const newSubtotal = newProductPriceTotal + optionTotal + optionalOptionTotal + notIncludedTotal
            const totalDiscount = updated.couponDiscount + updated.additionalDiscount
            const totalAdditional = updated.additionalCost + updated.cardFee + updated.tax +
              updated.prepaymentCost + updated.prepaymentTip +
              (updated.isPrivateTour ? updated.privateTourAdditionalCost : 0) +
              reservationOptionsTotalPrice
            const newTotalPrice = Math.max(0, newSubtotal - totalDiscount + totalAdditional)
            const newBalance = Math.max(0, newTotalPrice - updated.depositAmount)
            
            // 불포함 있음 채널인 경우 onSiteBalanceAmount를 우선 사용, 없으면 계산된 balance 사용
            const finalBalanceAmount = shouldLoadBalanceAmount && updated.onSiteBalanceAmount > 0 
              ? updated.onSiteBalanceAmount 
              : newBalance
            
            return {
              ...updated,
              productPriceTotal: newProductPriceTotal,
              requiredOptionTotal: requiredOptionTotal,
              subtotal: newSubtotal,
              totalPrice: newTotalPrice,
              balanceAmount: finalBalanceAmount
            }
          })
          
          setIsExistingPricingLoaded(true)
          setPriceAutoFillMessage('기존 가격 정보가 로드되었습니다!')
          return // 기존 가격 정보가 있으면 dynamic_pricing 조회하지 않음
        }
      }

      // 2. reservation_pricing에 가격 정보가 없으면 priceType에 따라 base_price 또는 dynamic_pricing에서 조회
      let adultPrice = 0
      let childPrice = 0
      let infantPrice = 0
      let commissionPercent = 0
      let notIncludedPrice = 0

      if (priceType === 'base') {
        // Base Price 타입: products 테이블에서 base_price 조회
        console.log('Base price 조회 시작:', { productId })
        
        type ProductData = {
          adult_base_price?: number | null
          child_base_price?: number | null
          infant_base_price?: number | null
          base_price?: string | { adult?: number; adult_price?: number; child?: number; child_price?: number; infant?: number; infant_price?: number } | null
        }

        const { data: productData, error: productError } = await supabase
          .from('products')
          .select('adult_base_price, child_base_price, infant_base_price, base_price')
          .eq('id', productId)
          .single()

        if (productError) {
          console.log('Base price 조회 오류:', productError.message)
          setFormData(prev => ({
            ...prev,
            adultProductPrice: 0,
            childProductPrice: 0,
            infantProductPrice: 0
          }))
          setPriceAutoFillMessage('기본 가격 조회 중 오류가 발생했습니다. 수동으로 입력해주세요.')
          return
        }

        const product = productData as ProductData | null

        // base_price가 JSON 형태인 경우 파싱
        if (product?.base_price) {
          try {
            const basePrice = typeof product.base_price === 'string' 
              ? JSON.parse(product.base_price) 
              : product.base_price
            
            if (basePrice && typeof basePrice === 'object') {
              adultPrice = (basePrice as { adult?: number; adult_price?: number }).adult || (basePrice as { adult?: number; adult_price?: number }).adult_price || 0
              childPrice = (basePrice as { child?: number; child_price?: number }).child || (basePrice as { child?: number; child_price?: number }).child_price || 0
              infantPrice = (basePrice as { infant?: number; infant_price?: number }).infant || (basePrice as { infant?: number; infant_price?: number }).infant_price || 0
            }
          } catch (e) {
            console.warn('base_price 파싱 오류:', e)
          }
        }

        // adult_base_price, child_base_price, infant_base_price 컬럼이 있는 경우 사용
        if (product?.adult_base_price !== undefined && product?.adult_base_price !== null) {
          adultPrice = product.adult_base_price
        }
        if (product?.child_base_price !== undefined && product?.child_base_price !== null) {
          childPrice = product.child_base_price
        }
        if (product?.infant_base_price !== undefined && product?.infant_base_price !== null) {
          infantPrice = product.infant_base_price
        }

        console.log('Base price 데이터 조회 성공:', { adultPrice, childPrice, infantPrice })
        // Base price 타입일 때는 불포함 금액을 0으로 설정
        notIncludedPrice = 0
        setPriceAutoFillMessage('기본 가격이 자동으로 입력되었습니다!')
      } else {
        // Dynamic Price 타입: dynamic_pricing 테이블에서 조회
        console.log('Dynamic pricing 조회 시작:', { productId, tourDate, channelId })
        
        const { data: pricingData, error } = await (supabase as any)
          .from('dynamic_pricing')
          .select('adult_price, child_price, infant_price, commission_percent, options_pricing, not_included_price, choices_pricing')
          .eq('product_id', productId)
          .eq('date', tourDate)
          .eq('channel_id', channelId)
          .limit(1)

        if (error) {
          console.log('Dynamic pricing 조회 오류:', error.message)
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
        
        adultPrice = (pricing?.adult_price as number) || 0
        commissionPercent = (pricing?.commission_percent as number) || 0
        notIncludedPrice = (pricing?.not_included_price as number) || 0

        // 채널 정보 확인
        const selectedChannel = channels.find(c => c.id === channelId)
        const isOTAChannel = selectedChannel && (
          (selectedChannel as any)?.type?.toLowerCase() === 'ota' || 
          (selectedChannel as any)?.category === 'OTA'
        )
        const pricingType = (selectedChannel as any)?.pricing_type || 'separate'
        const isSinglePrice = pricingType === 'single'
        
        console.log('채널 정보:', { channelId, isOTAChannel, pricingType, isSinglePrice })

        // OTA 채널이고 choices_pricing에 ota_sale_price가 있는 경우 사용
        childPrice = isSinglePrice ? adultPrice : ((pricing?.child_price as number) || 0)
        infantPrice = isSinglePrice ? adultPrice : ((pricing?.infant_price as number) || 0)

        if (isOTAChannel && pricing?.choices_pricing) {
          try {
            const choicesPricing = typeof pricing.choices_pricing === 'string' 
              ? JSON.parse(pricing.choices_pricing) 
              : pricing.choices_pricing
            
            console.log('choices_pricing 데이터:', choicesPricing)
            
            // choices_pricing에서 ota_sale_price가 있는 첫 번째 초이스 찾기
            let foundOtaSalePrice = false
            for (const [choiceId, choiceData] of Object.entries(choicesPricing)) {
              const data = choiceData as any
              if (data.ota_sale_price && data.ota_sale_price > 0) {
                const otaSalePrice = data.ota_sale_price
                adultPrice = otaSalePrice
                childPrice = isSinglePrice ? otaSalePrice : (data.child_price || data.child || otaSalePrice)
                infantPrice = isSinglePrice ? otaSalePrice : (data.infant_price || data.infant || otaSalePrice)
                foundOtaSalePrice = true
                console.log('OTA 판매가 사용:', { choiceId, otaSalePrice, adultPrice, childPrice, infantPrice })
                break
              }
            }
            
            // ota_sale_price가 없으면 첫 번째 초이스의 일반 가격 사용
            if (!foundOtaSalePrice) {
              const firstChoiceId = Object.keys(choicesPricing)[0]
              if (firstChoiceId && choicesPricing[firstChoiceId]) {
                const choiceData = choicesPricing[firstChoiceId] as any
                adultPrice = choiceData.adult_price || choiceData.adult || adultPrice
                childPrice = isSinglePrice ? adultPrice : (choiceData.child_price || choiceData.child || childPrice)
                infantPrice = isSinglePrice ? adultPrice : (choiceData.infant_price || choiceData.infant || infantPrice)
                console.log('초이스 가격 사용 (OTA 판매가 없음):', { firstChoiceId, adultPrice, childPrice, infantPrice })
              }
            }
          } catch (e) {
            console.warn('choices_pricing 파싱 오류:', e)
          }
        }
        
        setPriceAutoFillMessage('Dynamic pricing에서 가격 정보가 자동으로 입력되었습니다!')
      }


      setFormData(prev => {
        const updated = {
          ...prev,
          adultProductPrice: adultPrice,
          childProductPrice: childPrice,
          infantProductPrice: infantPrice,
          commission_percent: commissionPercent,
          not_included_price: notIncludedPrice,
          // Derive OTA per-adult amount when not_included_price is provided
          onlinePaymentAmount: notIncludedPrice != null && priceType === 'dynamic'
            ? Math.max(0, (adultPrice - (notIncludedPrice || 0)) * (prev.adults || 0))
            : prev.onlinePaymentAmount || 0
        }
        
        // 가격 계산 수행
        const newProductPriceTotal = (updated.adultProductPrice * updated.adults) + 
                                     (updated.childProductPrice * updated.child) + 
                                     (updated.infantProductPrice * updated.infant)
        
        // requiredOptionTotal 계산
        let requiredOptionTotal = 0
        Object.entries(updated.requiredOptions).forEach(([optionId, option]) => {
          const isSelected = updated.selectedOptions && 
            updated.selectedOptions[optionId] && 
            updated.selectedOptions[optionId].length > 0
          if (isSelected) {
            requiredOptionTotal += (option.adult * updated.adults) + 
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
        
        // choicesTotal 또는 requiredOptionTotal 사용
        const choicesTotal = updated.choicesTotal || 0
        const optionTotal = choicesTotal > 0 ? choicesTotal : requiredOptionTotal
        
        // 선택 옵션 총합 계산
        let optionalOptionTotal = 0
        Object.values(updated.selectedOptionalOptions).forEach(option => {
          optionalOptionTotal += option.price * option.quantity
        })
        
        // Dynamic Price 타입일 때만 초이스별 불포함 금액 포함
        const notIncludedTotal = priceType === 'dynamic' 
          ? (updated.choiceNotIncludedTotal || 0)
          : 0
        
        // OTA 채널일 때는 초이스 가격을 포함하지 않음
        const newSubtotal = isOTAChannel 
          ? newProductPriceTotal + optionalOptionTotal + notIncludedTotal
          : newProductPriceTotal + optionTotal + optionalOptionTotal + notIncludedTotal
        const totalDiscount = updated.couponDiscount + updated.additionalDiscount
        const totalAdditional = updated.additionalCost + updated.cardFee + updated.tax +
          updated.prepaymentCost + updated.prepaymentTip +
          (updated.isPrivateTour ? updated.privateTourAdditionalCost : 0) +
          reservationOptionsTotalPrice
        const newTotalPrice = Math.max(0, newSubtotal - totalDiscount + totalAdditional)
        const newBalance = Math.max(0, newTotalPrice - updated.depositAmount)
        
        return {
          ...updated,
          productPriceTotal: newProductPriceTotal,
          requiredOptionTotal: requiredOptionTotal,
          subtotal: newSubtotal,
          totalPrice: newTotalPrice,
          balanceAmount: updated.onSiteBalanceAmount > 0 ? updated.onSiteBalanceAmount : newBalance
        }
      })

      // choice 데이터를 먼저 로드
      await loadProductChoices(productId)

      console.log('가격 정보가 자동으로 입력되었습니다')
      
      // 사용자에게 알림 표시
      setTimeout(() => setPriceAutoFillMessage(''), 3000)
      
      // 가격 정보가 로드된 경우 상태 설정 (쿠폰 자동 선택 방지)
      setIsExistingPricingLoaded(true)
    } catch (error) {
      console.error('Dynamic pricing 조회 중 오류:', error)
    }
  }, [channels, reservationOptionsTotalPrice, loadProductChoices])

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

  const calculateOptionTotal = useCallback(() => {
    let total = 0
    Object.values(formData.selectedOptionalOptions).forEach(option => {
      total += option.price * option.quantity
    })
    return total
  }, [formData.selectedOptionalOptions])

  const calculateSubtotal = useCallback(() => {
    // 새로운 간결한 초이스 시스템 사용
    const choicesTotal = formData.choicesTotal || 0;
    const requiredOptionTotal = calculateRequiredOptionTotal();
    
    // 우선순위: 새로운 초이스 시스템 > 기존 requiredOptions
    const optionTotal = choicesTotal > 0 ? choicesTotal : requiredOptionTotal;
    
    // 선택 옵션(optional options)도 포함
    const optionalOptionTotal = calculateOptionTotal();
    
    // Dynamic Price 타입일 때만 초이스별 불포함 금액 포함
    const notIncludedTotal = formData.priceType === 'dynamic' 
      ? (formData.choiceNotIncludedTotal || 0)
      : 0
    
    return calculateProductPriceTotal() + optionTotal + optionalOptionTotal + notIncludedTotal;
  }, [formData.choicesTotal, formData.priceType, formData.choiceNotIncludedTotal, calculateRequiredOptionTotal, calculateProductPriceTotal, calculateOptionTotal]);

  const calculateTotalPrice = useCallback(() => {
    const subtotal = calculateSubtotal()
    const totalDiscount = formData.couponDiscount + formData.additionalDiscount
    // Grand Total에는 추가비용, 세금, 카드 수수료, 선결제 지출, 선결제 팁이 모두 포함됨
    const totalAdditional = formData.additionalCost + formData.cardFee + formData.tax +
      formData.prepaymentCost + formData.prepaymentTip +
      (formData.isPrivateTour ? formData.privateTourAdditionalCost : 0) +
      reservationOptionsTotalPrice

    // 총 가격(고객 총지불 기준, balance는 별도로 표시만 함)
    const grossTotal = Math.max(0, subtotal - totalDiscount + totalAdditional)
    return grossTotal
  }, [calculateSubtotal, formData.couponDiscount, formData.additionalDiscount, formData.additionalCost, formData.cardFee, formData.tax, formData.prepaymentCost, formData.prepaymentTip, formData.isPrivateTour, formData.privateTourAdditionalCost, reservationOptionsTotalPrice])

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
          couponCode: selectedCoupon.coupon_code || '', // coupons.coupon_code를 저장 (대소문자 구분 없이 사용)
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
    
    // 상품이 변경될 때마다 초이스 로드 (편집 모드에서도 모든 옵션을 보여주기 위해)
    if (formData.productId && formData.productId !== prevProductId.current) {
      console.log('ReservationForm: 상품 변경 감지 - 새로운 테이블에서 초이스 로드:', formData.productId)
      prevProductId.current = formData.productId
      
      // 모든 경우에 초이스 로드 (편집 모드에서도 초이스 선택 섹션을 보여주기 위해)
      loadProductChoices(formData.productId)
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
        loadPricingInfo(formData.productId, formData.tourDate, formData.channelId, reservation?.id, formData.priceType || 'dynamic')
      }
    }
  }, [formData.productId, formData.tourDate, formData.channelId, formData.priceType, reservation?.id, loadPricingInfo])

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
      
      // Dynamic Price 타입일 때만 초이스별 불포함 금액 포함
      const notIncludedTotal = prev.priceType === 'dynamic' 
        ? (prev.choiceNotIncludedTotal || 0)
        : 0
      
      const newSubtotal = newProductPriceTotal + optionTotal + optionalOptionTotal + notIncludedTotal
      const totalDiscount = prev.couponDiscount + prev.additionalDiscount
      const totalAdditional = prev.additionalCost + prev.cardFee + prev.tax +
        prev.prepaymentCost + prev.prepaymentTip +
        (prev.isPrivateTour ? prev.privateTourAdditionalCost : 0) +
        reservationOptionsTotalPrice
      const newTotalPrice = Math.max(0, newSubtotal - totalDiscount + totalAdditional)
      const newBalance = Math.max(0, newTotalPrice - prev.depositAmount)
      
      return {
        ...prev,
        productPriceTotal: newProductPriceTotal,
        requiredOptionTotal: requiredOptionTotal,
        choicesTotal: choicesTotal,
        subtotal: newSubtotal,
        totalPrice: newTotalPrice,
        balanceAmount: prev.onSiteBalanceAmount > 0 ? prev.onSiteBalanceAmount : newBalance
      }
    })
  }, [reservationOptionsTotalPrice])
  */

  // 상품 가격 또는 인원 수가 변경될 때 productPriceTotal 및 subtotal 자동 업데이트
  useEffect(() => {
    const newProductPriceTotal = (formData.adultProductPrice * formData.adults) + 
                                 (formData.childProductPrice * formData.child) + 
                                 (formData.infantProductPrice * formData.infant)
    
    // productPriceTotal이 다를 때만 업데이트 (무한 루프 방지)
    if (Math.abs(newProductPriceTotal - formData.productPriceTotal) > 0.01) {
      // 새로운 간결한 초이스 시스템 사용
      const choicesTotal = formData.choicesTotal || 0;
      const requiredOptionTotal = calculateRequiredOptionTotal();
      
      // 우선순위: 새로운 초이스 시스템 > 기존 requiredOptions
      const optionTotal = choicesTotal > 0 ? choicesTotal : requiredOptionTotal;
      
      // 선택 옵션(optional options)도 포함
      const optionalOptionTotal = calculateOptionTotal();
      
      // Dynamic Price 타입일 때만 초이스별 불포함 금액 포함
      const notIncludedTotal = formData.priceType === 'dynamic' 
        ? (formData.choiceNotIncludedTotal || 0)
        : 0
      
      const newSubtotal = newProductPriceTotal + optionTotal + optionalOptionTotal + notIncludedTotal
      
      setFormData(prev => ({
        ...prev,
        productPriceTotal: newProductPriceTotal,
        subtotal: newSubtotal
      }))
    }
  }, [formData.adultProductPrice, formData.childProductPrice, formData.infantProductPrice, formData.adults, formData.child, formData.infant, formData.choicesTotal, formData.priceType, formData.choiceNotIncludedTotal, calculateRequiredOptionTotal, calculateOptionTotal])

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
      } as Database['public']['Tables']['reservation_pricing']['Insert'] & { commission_amount?: number }

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
    // 거주 상태별 인원 수가 설정되어 있으면 "미국 거주자 구분" 관련 초이스 검증 건너뛰기
    const hasResidentStatusData = (formData.usResidentCount || 0) > 0 || 
                                   (formData.nonResidentCount || 0) > 0 || 
                                   (formData.nonResidentWithPassCount || 0) > 0
    
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
      // 고객 정보 저장/업데이트 또는 생성 (새 고객 생성 로직을 먼저 처리)
      let finalCustomerId = formData.customerId
      
      if (!formData.customerId || showNewCustomerForm) {
        // 새 고객 생성
        if (!formData.customerSearch || !formData.customerSearch.trim()) {
          alert('고객 이름을 입력해주세요.')
          return
        }
        
        // 랜덤 ID 생성
        const timestamp = Date.now().toString(36)
        const randomStr = Math.random().toString(36).substring(2, 8)
        const newCustomerId = `CUST_${timestamp}_${randomStr}`.toUpperCase()
        
        const customerData = {
          id: newCustomerId,
          name: formData.customerSearch.trim(), // 고객 검색 입력칸의 값을 이름으로 사용
          phone: formData.customerPhone || null,
          email: formData.customerEmail || null,
          address: formData.customerAddress || null,
          language: formData.customerLanguage || 'KR',
          emergency_contact: formData.customerEmergencyContact || null,
          special_requests: formData.customerSpecialRequests || null,
          channel_id: formData.channelId || null, // 오른쪽 채널 선택기에서 선택한 값 사용
          status: formData.customerStatus || 'active'
        }
        
        const { data: newCustomer, error: customerError } = await (supabase as any)
          .from('customers')
          .insert(customerData)
          .select()
          .single()
        
        if (customerError) {
          console.error('고객 정보 생성 오류:', customerError)
          alert('고객 정보 생성 중 오류가 발생했습니다: ' + customerError.message)
          return
        }
        
        finalCustomerId = newCustomer.id
        setFormData(prev => ({ ...prev, customerId: finalCustomerId }))
        
        // 고객 목록 새로고침
        await onRefreshCustomers()
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
        
        // 고객 목록 새로고침
        await onRefreshCustomers()
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
            const choice = choiceData as { selected: string; timestamp?: string }
            choicesData.required.push({
              choice_id: choiceId,
              option_id: choice.selected,
              quantity: 1,
              total_price: 0, // 기존 시스템에서는 가격이 별도로 계산됨
              timestamp: choice.timestamp || new Date().toISOString()
            })
          }
        })
      }
      
      // 예약 정보와 가격 정보를 함께 제출 (customerId 업데이트)
      onSubmit({
        ...formData,
        customerId: finalCustomerId || formData.customerId,
        totalPeople,
        choices: choicesData,
        selectedChoices: formData.selectedChoices as any,
        // 거주 상태별 인원 수 정보 전달
        usResidentCount: formData.usResidentCount || 0,
        nonResidentCount: formData.nonResidentCount || 0,
        nonResidentWithPassCount: formData.nonResidentWithPassCount || 0,
        passCoveredCount: formData.passCoveredCount || 0,
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
          quantityBasedChoices: {},
          quantityBasedChoiceTotal: 0,
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
        ? "bg-white rounded-lg p-2 sm:p-4 w-[90vw] max-h-[95vh] sm:max-h-[90vh] overflow-y-auto"
        : "bg-white rounded-lg p-2 sm:p-4 w-full"}
      >
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2 space-y-3 sm:space-y-0">
          <h2 className="text-lg sm:text-xl font-bold">
            {reservation ? t('form.editTitle') : t('form.title')}
            {reservation && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                (ID: {reservation.id})
              </span>
            )}
          </h2>
          <div className="w-full sm:w-auto flex items-end space-x-2">
            <div className="flex-1 sm:flex-none">
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
              type="button"
              onClick={() => window.history.back()}
              className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200 text-sm"
            >
              목록으로
            </button>
          </div>
        </div>
        
        
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {/* 메인 레이아웃 - 모바일 최적화 */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:h-[940px]">
            {/* 1열: 고객 정보 수정 - 모바일에서는 전체 너비 */}
            <div className="col-span-1 lg:col-span-1 space-y-4 overflow-y-auto border border-gray-200 rounded-lg p-3 sm:p-4 lg:h-[940px]">
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-3">고객 정보</h3>
                {/* 고객 검색 */}
                <CustomerSection
                  formData={formData}
                  setFormData={setFormData}
                  customers={customers}
                  customerSearchRef={customerSearchRef}
                  setShowCustomerForm={(show) => {
                    if (show) {
                      // + 버튼을 누르면 새 고객 입력 모드 활성화
                      setShowNewCustomerForm(true)
                      setFormData(prev => ({
                        ...prev,
                        customerId: '',
                        customerSearch: '',
                        customerName: '',
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
                        <input
                          type="tel"
                          value={formData.customerPhone}
                          onChange={(e) => setFormData(prev => ({ ...prev, customerPhone: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
                        <input
                          type="email"
                          value={formData.customerEmail}
                          onChange={(e) => setFormData(prev => ({ ...prev, customerEmail: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">언어</label>
                        <select
                          value={formData.customerLanguage}
                          onChange={(e) => setFormData(prev => ({ ...prev, customerLanguage: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="KR">🇰🇷 한국어</option>
                          <option value="EN">🇺🇸 English</option>
                          <option value="JA">🇯🇵 日本語</option>
                          <option value="ZH">🇨🇳 中文</option>
                          <option value="ES">🇪🇸 Español</option>
                          <option value="FR">🇫🇷 Français</option>
                          <option value="DE">🇩🇪 Deutsch</option>
                          <option value="IT">🇮🇹 Italiano</option>
                          <option value="PT">🇵🇹 Português</option>
                          <option value="RU">🇷🇺 Русский</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">비상연락처</label>
                        <input
                          type="tel"
                          value={formData.customerEmergencyContact}
                          onChange={(e) => setFormData(prev => ({ ...prev, customerEmergencyContact: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">주소</label>
                        <input
                          type="text"
                          value={formData.customerAddress}
                          onChange={(e) => setFormData(prev => ({ ...prev, customerAddress: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">특별요청</label>
                        <textarea
                          value={formData.customerSpecialRequests}
                          onChange={(e) => setFormData(prev => ({ ...prev, customerSpecialRequests: e.target.value }))}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <label className="block text-sm font-medium text-gray-700">상태</label>
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

            {/* 2열: 예약 정보 (투어 정보, 참가자, 가격) - 모바일에서는 전체 너비 */}
            <div className="col-span-1 lg:col-span-2 space-y-4 overflow-y-auto border border-gray-200 rounded-lg p-3 sm:p-4 lg:h-[940px]">
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-3">예약 정보</h3>
              </div>
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

              <div className="space-y-2">
                <PricingSection
                  formData={formData as any}
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
                  isExistingPricingLoaded={isExistingPricingLoaded}
                  {...(reservation?.id ? { reservationId: reservation.id } : {})}
                  expenseUpdateTrigger={expenseUpdateTrigger}
                  channels={channels}
                />
                {reservation && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowPricingModal(true)}
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      <span>reservation_pricing 수정</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 입금 내역, 지출 내역과 예약 옵션을 3열 그리드로 배치 - 예약이 있을 때만 표시 */}
              {reservation && (
                <div className="space-y-4">
                  {/* 상단: 예약 옵션 */}
                  <div>
                    <ReservationOptionsSection 
                      reservationId={reservation.id} 
                      onTotalPriceChange={setReservationOptionsTotalPrice}
                    />
                  </div>
                  
                  {/* 하단: 입금 내역과 지출 내역을 2열 그리드로 배치 */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* 왼쪽: 입금 내역 */}
                    <div>
                      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                        <PaymentRecordsList
                          reservationId={reservation.id}
                          customerName={customers.find(c => c.id === reservation.customerId)?.name || 'Unknown'}
                        />
                      </div>
                    </div>
                    
                    {/* 오른쪽: 지출 내역 */}
                    <div>
                      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                        <ReservationExpenseManager
                          reservationId={reservation.id}
                          submittedBy={reservation.addedBy}
                          userRole="admin"
                          onExpenseUpdated={() => setExpenseUpdateTrigger(prev => prev + 1)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3열: 상품 선택 - 모바일에서는 전체 너비, 데스크톱에서는 1/5 */}
            <div className="col-span-1 lg:col-span-1 space-y-4 overflow-y-auto border border-gray-200 rounded-lg p-3 sm:p-4 lg:h-[940px]">
              <ProductSelectionSection
                formData={formData}
                setFormData={setFormData}
                products={products.map(p => ({ ...p, name_ko: p.name }))}
                loadProductChoices={(productId) => loadProductChoices(productId)}
                getDynamicPricingForOption={getDynamicPricingForOption}
                t={t}
                layout={layout}
                onAccordionToggle={setProductAccordionExpanded}
                isEditMode={!!reservation?.id}
              />

              {/* 새로운 간결한 초이스 시스템이 ProductSelectionSection에서 처리됨 */}
            </div>

            {/* 4열: 채널 선택 - 모바일에서는 전체 너비, 데스크톱에서는 1/5 */}
            <div className="col-span-1 lg:col-span-1 space-y-4 overflow-y-auto border border-gray-200 rounded-lg p-3 sm:p-4 lg:h-[940px]">
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

      {/* 가격 정보 수정 모달 */}
      {reservation && (
        <PricingInfoModal
          reservation={reservation}
          isOpen={showPricingModal}
          onClose={() => setShowPricingModal(false)}
        />
      )}
    </div>
  )
}
