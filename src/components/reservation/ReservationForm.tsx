'use client'
/* eslint-disable */

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Trash2, Eye, AlertTriangle, X, Mail, Phone, ChevronDown } from 'lucide-react'
import ReactCountryFlag from 'react-country-flag'
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
import ReviewManagementSection from '@/components/reservation/ReviewManagementSection'
import PricingInfoModal from '@/components/reservation/PricingInfoModal'
import { getOptionalOptionsForProduct } from '@/utils/reservationUtils'
import { getFallbackOtaSalePrice } from '@/utils/choicePricingMatcher'
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
  initialCustomerId?: string
  /** true이면 지난 날짜 예약도 수정 가능 (super 계정용) */
  allowPastDateEdit?: boolean
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
  onViewCustomer,
  initialCustomerId,
  allowPastDateEdit = false
}: ReservationFormProps) {
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [showPricingModal, setShowPricingModal] = useState(false)
  const [showProductChoiceModal, setShowProductChoiceModal] = useState(false)
  const [showChannelModal, setShowChannelModal] = useState(false)
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false)
  const [languageDropdownOpen, setLanguageDropdownOpen] = useState(false)
  const languageDropdownRef = useRef<HTMLDivElement | null>(null)
  const t = useTranslations('reservations')
  const tCommon = useTranslations('common')
  const customerSearchRef = useRef<HTMLDivElement | null>(null)
  const reservationFormRef = useRef<HTMLFormElement>(null)
  const rez: RezLike = (reservation as unknown as RezLike) || ({} as RezLike)
  const [, setChannelAccordionExpanded] = useState(layout === 'modal')
  const [, setProductAccordionExpanded] = useState(layout === 'modal')
  const [reservationOptionsTotalPrice, setReservationOptionsTotalPrice] = useState(0)
  const [expenseUpdateTrigger, setExpenseUpdateTrigger] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // 중복 고객 확인 모달 상태
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [similarCustomers, setSimilarCustomers] = useState<Customer[]>([])
  const [pendingCustomerData, setPendingCustomerData] = useState<any>(null)
  const [pendingFormDataState, setPendingFormDataState] = useState<any>(null)
  
  // 비슷한 이름을 찾는 함수
  const findSimilarCustomers = useCallback((name: string, email?: string, phone?: string): Customer[] => {
    if (!name.trim()) return []
    
    const nameLower = name.toLowerCase().trim()
    const similarCustomers: Customer[] = []
    
    for (const c of customers) {
      const customerNameLower = c.name.toLowerCase().trim()
      
      // 정확히 일치하는 경우
      if (customerNameLower === nameLower) {
        similarCustomers.push(c)
        continue
      }
      
      // 이름이 포함되는 경우 (양방향)
      if (customerNameLower.includes(nameLower) || nameLower.includes(customerNameLower)) {
        // 이미 추가되지 않은 경우만 추가
        if (!similarCustomers.find(sc => sc.id === c.id)) {
          similarCustomers.push(c)
        }
        continue
      }
      
      // 이메일이 일치하는 경우
      if (email && c.email && c.email.toLowerCase() === email.toLowerCase()) {
        if (!similarCustomers.find(sc => sc.id === c.id)) {
          similarCustomers.push(c)
        }
        continue
      }
      
      // 전화번호가 일치하는 경우
      if (phone && c.phone && c.phone === phone) {
        if (!similarCustomers.find(sc => sc.id === c.id)) {
          similarCustomers.push(c)
        }
        continue
      }
    }
    
    return similarCustomers
  }, [customers])
  
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
    nonResidentUnder16Count?: number // 비 거주자 (16세 이하)
    passCoveredCount?: number // 패스로 커버되는 인원 수
    channelId: string
    selectedChannelType: 'ota' | 'self' | 'partner'
    channelSearch: string
    variantKey?: string
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
    customerId: reservation?.customerId || (reservation as any)?.customer_id || rez.customer_id || initialCustomerId || '',
    customerSearch: (() => {
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
      const customerId = reservation?.customerId || (reservation as any)?.customer_id || rez.customer_id || initialCustomerId
      if (customerId && customers.length > 0) {
        const customer = customers.find(c => c.id === customerId)
        return customer?.name || ''
      }
      return ''
    })(),
    customerPhone: (() => {
      const customerId = reservation?.customerId || (reservation as any)?.customer_id || rez.customer_id || initialCustomerId
      if (customerId && customers.length > 0) {
        const customer = customers.find(c => c.id === customerId)
        return customer?.phone || ''
      }
      return ''
    })(),
    customerEmail: (() => {
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
    nonResidentUnder16Count: 0,
    passCoveredCount: 0,
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
    variantKey: (reservation as any)?.variant_key || (rez as any)?.variant_key || 'default',
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
    commission_base_price: 0,
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
  // reservation_pricing 행 id (상세/폼 가격 섹션 표시용)
  const [reservationPricingId, setReservationPricingId] = useState<string | null>(null)
  
  // 무한 렌더링 방지를 위한 ref
  const prevPricingParams = useRef<{productId: string, tourDate: string, channelId: string, variantKey: string, selectedChoicesKey: string} | null>(null)
  const prevCouponParams = useRef<{productId: string, tourDate: string, channelId: string} | null>(null)
  const prevProductId = useRef<string | null>(null)
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
          let nonResidentUnder16Count = 0
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
                } else if (rc.resident_status === 'non_resident_under_16') {
                  nonResidentUnder16Count++
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
                nonResidentUnder16Count,
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
        console.error('ReservationForm: 데이터 조회 중 예외 발생:', error)
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
  const loadReservationChoicesFromNewTable = useCallback(async (reservationId: string, productId?: string) => {
    try {
      console.log('ReservationForm: 초이스 데이터 로드 시작:', { reservationId, productId })
      
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
          console.error('ReservationForm: 상품 초이스 로드 오류:', productChoicesError)
        } else {
          allProductChoices = productChoicesData || []
          console.log('ReservationForm: 상품 초이스 로드 완료:', allProductChoices.length, '개')
        }
      }

      if (reservationChoicesError) {
        console.error('ReservationForm: 예약 초이스 로드 오류:', reservationChoicesError)
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
        
        // reservations 테이블에서 choices JSONB 컬럼 확인
        if (reservation && reservation.choices && typeof reservation.choices === 'object' && 'required' in reservation.choices) {
          console.log('ReservationForm: reservations.choices에서 데이터 발견:', reservation.choices)
          
          // choices.required에서 선택된 옵션 찾기
          if (reservation.choices.required && Array.isArray(reservation.choices.required)) {
            reservation.choices.required.forEach((choice: any) => {
              if (choice.options && Array.isArray(choice.options)) {
                // is_default가 true인 옵션 찾기
                const selectedOption = choice.options.find((option: any) => option.is_default === true || option.selected === true)
                if (selectedOption) {
                  // product_choices에서 choice_id 찾기
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
      return // 편집 모드가 아니면 실행하지 않음
    }
    
    // 이미 로드된 reservation이면 스킵
    if (loadedReservationChoicesRef.current === reservation.id) {
      console.log('ReservationForm: 이미 로드된 reservation choices, 스킵:', reservation.id)
      return
    }
    
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
      loadedReservationChoicesRef.current = reservation.id
      loadReservationChoicesFromNewTable(reservation.id, reservation.productId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservation?.id]) // loadReservationChoicesFromNewTable은 dependency에서 제거 (내부에서 조건부 호출)
  
  // 기존 choices JSONB 복원 (fallback, loadReservationChoicesFromNewTable이 실패한 경우)
  useEffect(() => {
    if (!reservation?.id) return
    
    // 이미 loadReservationChoicesFromNewTable에서 로드했으면 스킵
    if (loadedReservationChoicesRef.current === reservation.id) {
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

  // 새로운 간결한 초이스 시스템에서 상품 choices 로드
  const loadProductChoices = useCallback(async (productId: string) => {
    if (!productId) {
      setFormData(prev => ({ ...prev, productChoices: [], selectedChoices: [], choicesTotal: 0 }))
      return
    }
    
    // 이미 로드된 productId면 스킵 (편집 모드에서만)
    const isEditMode = !!reservation?.id
    if (isEditMode && loadedProductChoicesRef.current.has(productId)) {
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
        return;
      }
      // 편집 모드가 아닌 경우에만 기본 초이스 설정
      const defaultChoices: Array<{
        choice_id: string
        option_id: string
        quantity: number
        total_price: number
      }> = [];
      
      const isEditMode = !!reservation?.id;
      
      if (!isEditMode) {
        data?.forEach((choice: any) => {
          const defaultOption = choice.options?.find((opt: any) => opt.is_default);
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

      // 로드 완료 표시
      if (isEditMode) {
        loadedProductChoicesRef.current.add(productId)
      }
      
      setFormData(prev => {
        // 편집 모드에서는 selectedChoices를 절대 덮어쓰지 않음 (loadReservationChoicesFromNewTable에서 로드될 수 있음)
        if (isEditMode) {
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
        
        // 새 예약 모드인 경우에만 기본값 설정
        console.log('ReservationForm: 새 예약 모드 - 기본값 설정:', {
          isEditMode,
          defaultChoicesCount: defaultChoices.length,
          defaultChoices: defaultChoices.map(c => ({ choice_id: c.choice_id, option_id: c.option_id }))
        });
        return {
          ...prev,
          productChoices: (data || []) as typeof prev.productChoices,
          selectedChoices: defaultChoices,
          choicesTotal: choicesTotal
        };
      });
    } catch (error) {
      console.error('초이스 로드 오류:', error);
      setFormData(prev => ({ ...prev, productChoices: [], selectedChoices: [], choicesTotal: 0 }));
      // 에러 발생 시 로드 상태 제거
      if (isEditMode) {
        loadedProductChoicesRef.current.delete(productId)
      }
    }
  }, [reservation?.id]);

  // 가격 정보 조회 함수 (reservation_pricing 우선, 없으면 dynamic_pricing에서 조회)
  const loadPricingInfo = useCallback(async (productId: string, tourDate: string, channelId: string, reservationId?: string, selectedChoices?: Array<{ choice_id?: string; option_id?: string; id?: string }>) => {
    if (!productId || !tourDate || !channelId) {
      console.log('필수 정보가 부족합니다:', { productId, tourDate, channelId })
      return
    }

    try {
      // 선택된 초이스 정보 가져오기 (파라미터로 전달되지 않으면 formData에서 가져오기)
      const currentSelectedChoices = selectedChoices || (Array.isArray(formData.selectedChoices) ? formData.selectedChoices : [])
      setReservationPricingId(null)
      console.log('가격 정보 조회 시작:', { productId, tourDate, channelId, reservationId, selectedChoices: currentSelectedChoices })
      
      // 1. 먼저 reservation_pricing에서 기존 가격 정보 확인 (편집 모드인 경우)
      // 단, 폼에서 채널을 변경한 경우에는 기존 가격(이전 채널 기준)을 쓰지 않고 dynamic_pricing에서 새 채널 가격 로드
      const reservationChannelId = (reservation as any)?.channelId ?? (reservation as any)?.channel_id ?? (rez as any)?.channel_id ?? null
      const channelChangedInForm = reservationChannelId != null && channelId !== reservationChannelId

      if (reservationId && !channelChangedInForm) {
        const { data: existingPricing, error: existingError } = await (supabase as any)
          .from('reservation_pricing')
          .select('id, adult_product_price, child_product_price, infant_product_price, product_price_total, not_included_price, required_options, required_option_total, subtotal, coupon_code, coupon_discount, additional_discount, additional_cost, card_fee, tax, prepayment_cost, prepayment_tip, selected_options, option_total, total_price, deposit_amount, balance_amount, private_tour_additional_cost, commission_percent, commission_amount, choices, choices_total')
          .eq('reservation_id', reservationId)
          .maybeSingle()

        if (existingError) {
          console.log('기존 가격 정보 조회 오류:', existingError.message)
          // 오류가 발생해도 계속 진행 (dynamic_pricing 조회)
        } else if (existingPricing) {
          setReservationPricingId((existingPricing as { id?: string }).id ?? null)
          console.log('기존 가격 정보 사용:', existingPricing)

          // reservation_pricing에 채널 수수료 $ 가 있으면, 채널 수수료 % 를 역산 (기존 데이터는 $ 만 있음, channels 테이블 % 는 후순위)
          const commissionAmount = (existingPricing as any).commission_amount != null && (existingPricing as any).commission_amount !== ''
            ? Number((existingPricing as any).commission_amount)
            : 0
          let commissionPercentToUse: number
          if (commissionAmount > 0) {
            const base = Number((existingPricing as any).product_price_total) || Number((existingPricing as any).subtotal) || 0
            commissionPercentToUse = base > 0 ? (commissionAmount / base) * 100 : 0
            console.log('ReservationForm: 채널 수수료 % 역산 (채널 수수료 $ 기준)', { commission_amount: commissionAmount, base, commission_percent: commissionPercentToUse })
          } else {
            commissionPercentToUse = (existingPricing as any).commission_percent != null && (existingPricing as any).commission_percent !== ''
              ? Number((existingPricing as any).commission_percent)
              : 0
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
          
          // 불포함 있음 채널 확인 (commission_base_price_only 또는 has_not_included_price)
          const hasNotIncludedPrice = (selectedChannel as any)?.has_not_included_price || false
          const commissionBasePriceOnly = (selectedChannel as any)?.commission_base_price_only || false
          const shouldLoadBalanceAmount = hasNotIncludedPrice || commissionBasePriceOnly
          
          // 상품가(성인 판매가)는 reservation_pricing 말고 dynamic_pricing 기준으로만 결정
          // 새예약(임시 ID)이어도 reservation_pricing에 236이 들어가므로, choices_pricing 있으면 무시하고 dynamic_pricing 사용
          let adultPrice = existingPricing.adult_product_price || 0
          let childPrice = isSinglePrice ? adultPrice : (existingPricing.child_product_price || 0)
          let infantPrice = isSinglePrice ? adultPrice : (existingPricing.infant_product_price || 0)
          
          if (productId && tourDate && channelId) {
            const variantKey = formData.variantKey || 'default'
            let dpRows: any[] | null = null
            const { data: dpRows1 } = await (supabase as any)
              .from('dynamic_pricing')
              .select('choices_pricing')
              .eq('product_id', productId)
              .eq('date', tourDate)
              .eq('channel_id', channelId)
              .eq('variant_key', variantKey)
              .order('updated_at', { ascending: false })
              .limit(1)
            dpRows = dpRows1
            if (!dpRows || dpRows.length === 0) {
              if (variantKey !== 'default') {
                const { data: dpRowsDefault } = await (supabase as any)
                  .from('dynamic_pricing')
                  .select('choices_pricing')
                  .eq('product_id', productId)
                  .eq('date', tourDate)
                  .eq('channel_id', channelId)
                  .eq('variant_key', 'default')
                  .order('updated_at', { ascending: false })
                  .limit(1)
                dpRows = dpRowsDefault
              }
              if ((!dpRows || dpRows.length === 0)) {
                const { data: dpRowsAny } = await (supabase as any)
                  .from('dynamic_pricing')
                  .select('choices_pricing')
                  .eq('product_id', productId)
                  .eq('date', tourDate)
                  .eq('channel_id', channelId)
                  .order('updated_at', { ascending: false })
                  .limit(1)
                dpRows = dpRowsAny
              }
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
              const fallbackKey = currentSelectedChoices && currentSelectedChoices.length > 0
                ? currentSelectedChoices
                    .map((c: any) => `${c.choice_id || c.id}+${(c.option_id ?? c.option_key) ?? ''}`)
                    .filter(Boolean)
                    .sort()
                    .join('+')
                : ''
              const fallbackOta = getFallbackOtaSalePrice(
                { id: fallbackKey || 'fallback', combination_key: fallbackKey },
                choicesPricing
              )
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
          
          // 불포함 있음 채널인 경우 balance_amount를 onSiteBalanceAmount에 설정
          const balanceAmount = Number(existingPricing.balance_amount) || 0
          const onSiteBalanceAmount = shouldLoadBalanceAmount && balanceAmount > 0 ? balanceAmount : 0
          
          setFormData(prev => {
            const updated = {
              ...prev,
              adultProductPrice: adultPrice,
              childProductPrice: childPrice,
              infantProductPrice: infantPrice,
              not_included_price: Number(existingPricing.not_included_price) || 0,
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
              onSiteBalanceAmount: onSiteBalanceAmount,
              choices: existingPricing.choices || {},
              choicesTotal: Number(existingPricing.choices_total) || 0
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
            
            const notIncludedTotal = updated.choiceNotIncludedTotal || 0
            
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
            
            // commission_amount가 데이터베이스에서 불러온 값이면 절대 덮어쓰지 않음
            const finalCommissionAmount = loadedCommissionAmount.current !== null && loadedCommissionAmount.current > 0
              ? loadedCommissionAmount.current
              : updated.commission_amount
            
            console.log('ReservationForm: 가격 정보 업데이트', {
              loadedCommissionAmount: loadedCommissionAmount.current,
              updatedCommissionAmount: updated.commission_amount,
              finalCommissionAmount
            })
            
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
              commission_base_price: updated.commission_base_price
            }
          })
          
          setIsExistingPricingLoaded(true)
          setPriceAutoFillMessage('기존 가격 정보가 로드되었습니다!')
          return // 기존 가격 정보가 있으면 dynamic_pricing 조회하지 않음
        }
      }

      // 2. reservation_pricing에 가격 정보가 없으면 dynamic_pricing에서 조회 (항상 동일 경로)
      let adultPrice = 0
      let childPrice = 0
      let infantPrice = 0
      let commissionPercent = 0
      let notIncludedPrice = 0

      console.log('Dynamic pricing 조회 시작:', { productId, tourDate, channelId })
        
        const variantKey = formData.variantKey || 'default'
        let pricingData: any[] | null = null
        let pricingError: any = null
        const { data: pricingData1, error: err1 } = await (supabase as any)
          .from('dynamic_pricing')
          .select('adult_price, child_price, infant_price, commission_percent, options_pricing, not_included_price, choices_pricing, updated_at')
          .eq('product_id', productId)
          .eq('date', tourDate)
          .eq('channel_id', channelId)
          .eq('variant_key', variantKey)
          .order('updated_at', { ascending: false })
          .limit(1)
        pricingData = pricingData1
        pricingError = err1
        if (!pricingData || pricingData.length === 0) {
          if (variantKey !== 'default') {
            const { data: pricingDataDefault } = await (supabase as any)
              .from('dynamic_pricing')
              .select('adult_price, child_price, infant_price, commission_percent, options_pricing, not_included_price, choices_pricing, updated_at')
              .eq('product_id', productId)
              .eq('date', tourDate)
              .eq('channel_id', channelId)
              .eq('variant_key', 'default')
              .order('updated_at', { ascending: false })
              .limit(1)
            if (!pricingError && (pricingDataDefault?.length ?? 0) > 0) {
              pricingData = pricingDataDefault
            }
          }
          if ((!pricingData || pricingData.length === 0) && !pricingError) {
            const { data: pricingDataAny } = await (supabase as any)
              .from('dynamic_pricing')
              .select('adult_price, child_price, infant_price, commission_percent, options_pricing, not_included_price, choices_pricing, updated_at')
              .eq('product_id', productId)
              .eq('date', tourDate)
              .eq('channel_id', channelId)
              .order('updated_at', { ascending: false })
              .limit(1)
            if ((pricingDataAny?.length ?? 0) > 0) {
              pricingData = pricingDataAny
            }
          }
        }

        if (pricingError) {
          console.log('Dynamic pricing 조회 오류:', pricingError.message)
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
        const requiredChoices = formData.productChoices?.filter(choice => choice.is_required) || []
        const selectedChoiceIds = new Set(currentSelectedChoices?.map(c => c.choice_id || (c as any).id).filter(Boolean) || [])
        const allRequiredChoicesSelected = requiredChoices.length === 0 || requiredChoices.every(choice => selectedChoiceIds.has(choice.id))
        
        // choices_pricing이 있고 필수 초이스가 모두 선택되었으면 초이스별 가격 우선 사용
        // 초이스별 가격이 있으면 기본 가격(adult_price, child_price, infant_price)은 무시
        let useChoicePricing = false
        if (hasChoicesPricing && currentSelectedChoices && currentSelectedChoices.length > 0 && allRequiredChoicesSelected) {
          try {
            
            console.log('choices_pricing 데이터:', choicesPricing)
            console.log('선택된 초이스:', currentSelectedChoices)
            
            // 선택된 초이스의 조합 키 생성 (미정 선택은 가격 조회에서 제외)
            const UNDECIDED_OPTION_ID = '__undecided__'
            const choicesForPricing = currentSelectedChoices?.filter(c => c.option_id !== UNDECIDED_OPTION_ID && (c as any).option_key !== UNDECIDED_OPTION_ID) || []
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
            
            // choices_pricing 키 형식: "choice_id+option_key" 또는 "choice_id+option_id" (DB 저장 형식)
            const buildChoicePricingKeys = (c: { choice_id?: string; option_id?: string; option_key?: string; id?: string }) => {
              const cid = c.choice_id || (c as any).id
              const oid = c.option_id
              const okey = (c as any).option_key
              const keys: string[] = []
              if (cid && okey) keys.push(`${cid}+${okey}`)
              if (cid && oid) keys.push(`${cid}+${oid}`)
              return keys
            }
            
            let foundChoicePricing = false
            let choiceData = null
            
            // 1. DB 형식 우선: choice_id+option_key, choice_id+option_id (초이스 가격은 항상 이 형식 참조)
            for (const c of choicesForPricing) {
              for (const key of buildChoicePricingKeys(c)) {
                if (choicesPricing[key]) {
                  choiceData = choicesPricing[key]
                  console.log('choices_pricing 키(choice_id+option)로 초이스 가격 찾음:', { key, choiceData })
                  foundChoicePricing = true
                  break
                }
              }
              if (choiceData) break
            }
            
            // 2. 조합 키로 직접 찾기 (레거시: option_key만 이어붙인 경우)
            const combinationKey = selectedOptionKeys.length > 0
              ? selectedOptionKeys.join('+')
              : selectedOptionIds.length > 0 
                ? selectedOptionIds.join('+')
                : selectedChoiceIds.join('+')
            
            if (!choiceData && combinationKey && choicesPricing[combinationKey]) {
              choiceData = choicesPricing[combinationKey]
              console.log('조합 키로 초이스 가격 찾음:', { combinationKey, choiceData })
            }
            
            // 3. 정렬된 조합 키로 찾기 (순서에 상관없이 매칭)
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
              }
            }
            
            // 4. 개별 초이스로 찾기 (조합 키로 찾지 못한 경우)
            // 여러 초이스가 선택된 경우, 첫 번째 초이스의 가격을 사용 (일반적으로 조합 키로 찾아야 함)
            if (!choiceData) {
              for (const selectedChoice of currentSelectedChoices) {
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
                // 3-6. 모든 키를 순회하면서 option_key, option_id, choice_id가 포함된 키 찾기
                if (!choiceData) {
                  for (const [key, value] of Object.entries(choicesPricing)) {
                    if (optionKey && (key === optionKey || key.includes(optionKey))) {
                      choiceData = value
                      console.log('키에 option_key 포함하여 초이스 가격 찾음:', { key, optionKey, choiceData })
                      break
                    } else if (optionId && (key === optionId || key.includes(optionId))) {
                      choiceData = value
                      console.log('키에 option_id 포함하여 초이스 가격 찾음:', { key, optionId, choiceData })
                      break
                    } else if (choiceId && (key === choiceId || key.includes(choiceId))) {
                      choiceData = value
                      console.log('키에 choice_id 포함하여 초이스 가격 찾음:', { key, choiceId, choiceData })
                      break
                    }
                  }
                }
                
                if (choiceData) break
              }
            }
            
            if (choiceData) {
              const data = choiceData as any
              
              // 초이스별 가격 설정에서 OTA 판매가만 사용 (adult_price, child_price, infant_price는 저장하지 않음)
              if (data.ota_sale_price !== undefined && data.ota_sale_price !== null && data.ota_sale_price >= 0) {
                adultPrice = data.ota_sale_price
                childPrice = isSinglePrice ? data.ota_sale_price : data.ota_sale_price
                infantPrice = isSinglePrice ? data.ota_sale_price : data.ota_sale_price
                // 선택된 초이스의 불포함 가격 사용
                if (data.not_included_price !== undefined && data.not_included_price !== null) {
                  notIncludedPrice = data.not_included_price
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
            } else if (currentSelectedChoices && currentSelectedChoices.length > 0) {
              // 매칭 실패 또는 키 형식 불일치 시: choices_pricing 전체에서 최대 ota_sale_price(미국 거주자 쪽)로 폴백
              const fallbackCombinationKey = currentSelectedChoices
                .map((c: any) => `${c.choice_id || c.id}+${(c.option_id ?? c.option_key) ?? ''}`)
                .filter(Boolean)
                .sort()
                .join('+')
              const fallbackOta = fallbackCombinationKey
                ? getFallbackOtaSalePrice(
                    { id: fallbackCombinationKey, combination_key: fallbackCombinationKey },
                    choicesPricing
                  )
                : undefined
              if (fallbackOta !== undefined && fallbackOta > 0) {
                adultPrice = fallbackOta
                childPrice = isSinglePrice ? fallbackOta : fallbackOta
                infantPrice = isSinglePrice ? fallbackOta : fallbackOta
                useChoicePricing = true
                foundChoicePricing = true
                console.log('초이스 가격 폴백 OTA 판매가 사용:', { fallbackCombinationKey, fallbackOta, adultPrice })
              }
              if (!foundChoicePricing) {
                console.log('선택된 초이스의 가격을 찾지 못함, 기본 가격으로 폴백:', { 
                  choicesPricingKeys: Object.keys(choicesPricing),
                  selectedChoices: currentSelectedChoices
                })
              }
            }
          } catch (e) {
            console.warn('choices_pricing 파싱 오류:', e)
          }
        }
        
        // 초이스별 가격을 사용하지 않은 경우
        // 초이스가 있는 상품은 무조건 choices_pricing만 참조, 기본 가격(adult_price 등) 사용 금지
        const productHasChoices = (formData.productChoices?.length ?? 0) > 0
        const mustUseChoicePricingOnly = hasChoicesPricing || productHasChoices

        if (!useChoicePricing) {
          // 초이스가 있는 상품(choices_pricing 있음 또는 productChoices 있음)
          if (mustUseChoicePricingOnly) {
            // 필수 초이스가 모두 선택되지 않은 경우
            if (!allRequiredChoicesSelected) {
              console.log('초이스별 가격 설정이 있지만 모든 필수 초이스가 선택되지 않아 가격을 로드하지 않음:', {
                hasChoicesPricing: !!pricing?.choices_pricing,
                requiredChoicesCount: requiredChoices.length,
                selectedChoicesCount: currentSelectedChoices?.length || 0,
                allRequiredChoicesSelected
              })
              // 가격을 0으로 설정하고 메시지 표시
              adultPrice = 0
              childPrice = 0
              infantPrice = 0
              notIncludedPrice = 0
              setPriceAutoFillMessage('모든 필수 초이스를 선택하면 가격이 자동으로 로드됩니다.')
            } else {
              // 필수 초이스는 모두 선택되었지만 초이스별 가격을 찾지 못한 경우
              console.log('초이스별 가격 설정이 있지만 해당 초이스의 가격을 찾지 못함. 기본 가격을 로드하지 않음:', {
                hasChoicesPricing: !!pricing?.choices_pricing,
                choicesPricingKeys: Object.keys(choicesPricing || {}),
                selectedChoices: currentSelectedChoices
              })
              // 가격을 0으로 설정하고 메시지 표시
              adultPrice = 0
              childPrice = 0
              infantPrice = 0
              notIncludedPrice = 0
              setPriceAutoFillMessage('선택한 초이스에 대한 가격 정보가 없습니다. 수동으로 입력해주세요.')
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
              setPriceAutoFillMessage('모든 필수 초이스를 선택하면 가격이 자동으로 로드됩니다.')
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
        
        setPriceAutoFillMessage('Dynamic pricing에서 가격 정보가 자동으로 입력되었습니다!')

      setFormData(prev => {
        const updated = {
          ...prev,
          adultProductPrice: adultPrice,
          childProductPrice: childPrice,
          infantProductPrice: infantPrice,
          commission_percent: commissionPercent,
          not_included_price: notIncludedPrice,
          onlinePaymentAmount: notIncludedPrice != null
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
        
        const notIncludedTotal = updated.choiceNotIncludedTotal || 0
        
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
      }, [channels, reservationOptionsTotalPrice, loadProductChoices, formData.selectedChoices, formData.variantKey])

  // 가격 계산 함수들
  const calculateProductPriceTotal = useCallback(() => {
    // 불포함 가격 제외하여 계산 (불포함 가격은 별도로 표시됨)
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
    
    const notIncludedTotal = formData.choiceNotIncludedTotal || 0
    return calculateProductPriceTotal() + optionTotal + optionalOptionTotal + notIncludedTotal;
  }, [formData.choicesTotal, formData.choiceNotIncludedTotal, calculateRequiredOptionTotal, calculateProductPriceTotal, calculateOptionTotal]);

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
        
        // 불포함 가격 계산 (쿠폰 할인 계산에서 제외)
        const notIncludedPrice = (formData.not_included_price || 0) * (formData.adults + formData.child + formData.infant)
        const subtotal = calculateProductPriceTotal() + calculateRequiredOptionTotal() - notIncludedPrice
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
  }, [formData.productId, formData.tourDate, formData.channelId, coupons, formData.adults, formData.child, formData.infant, formData.not_included_price, calculateProductPriceTotal, calculateRequiredOptionTotal, calculateCouponDiscount, setFormData])

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
      
      const isEditMode = !!reservation?.id
      // 편집 모드에서는 loadReservationChoicesFromNewTable이 이미 초이스를 로드했을 수 있음
      // productChoices와 selectedChoices가 모두 있으면 스킵
      if (isEditMode && formData.productChoices && formData.productChoices.length > 0 && 
          formData.selectedChoices && formData.selectedChoices.length > 0) {
        console.log('ReservationForm: 편집 모드 - 이미 초이스가 로드되어 있음, 스킵', {
          productChoicesCount: formData.productChoices.length,
          selectedChoicesCount: formData.selectedChoices.length
        })
        return
      }
      
      // 편집 모드에서는 loadReservationChoicesFromNewTable이 초이스를 로드하므로
      // loadProductChoices를 호출하지 않음 (productChoices만 필요한 경우는 이미 로드됨)
      if (isEditMode) {
        // productChoices가 없으면 로드 (selectedChoices는 loadReservationChoicesFromNewTable에서 로드됨)
        if (!formData.productChoices || formData.productChoices.length === 0) {
          console.log('ReservationForm: 편집 모드 - productChoices만 로드 (selectedChoices는 loadReservationChoicesFromNewTable에서 로드됨)')
          loadProductChoices(formData.productId)
        } else {
          console.log('ReservationForm: 편집 모드 - productChoices가 이미 있음, loadProductChoices 스킵')
        }
        return
      }
      
      // 새 예약 모드인 경우에만 초이스 로드
      if (!formData.productChoices || formData.productChoices.length === 0) {
        console.log('ReservationForm: 새 예약 모드 - 초이스 로드 시작')
        loadProductChoices(formData.productId)
      }
    }
  }, [formData.productId, formData.productChoices, formData.selectedChoices, loadProductChoices, reservation?.id])

  // 상품, 날짜, 채널, variant, 초이스가 변경될 때 dynamic pricing에서 가격 자동 조회
  // 필수 초이스가 모두 선택된 경우에만 가격 로드
  useEffect(() => {
    if (formData.productId && formData.tourDate && formData.channelId) {
      // 필수 초이스가 모두 선택되었는지 확인
      const requiredChoices = formData.productChoices?.filter(choice => choice.is_required) || []
      const selectedChoicesArray = Array.isArray(formData.selectedChoices) ? formData.selectedChoices : []
      const selectedChoiceIds = new Set(selectedChoicesArray.map(c => c.choice_id || (c as any).id).filter(Boolean))
      const allRequiredChoicesSelected = requiredChoices.length === 0 || requiredChoices.every(choice => selectedChoiceIds.has(choice.id))
      
      // 필수 초이스가 모두 선택되지 않았으면 가격 로드 건너뛰기
      if (requiredChoices.length > 0 && !allRequiredChoicesSelected) {
        console.log('필수 초이스가 모두 선택되지 않아 가격 로드를 건너뜁니다:', {
          requiredChoicesCount: requiredChoices.length,
          selectedChoicesCount: selectedChoicesArray.length,
          requiredChoiceIds: requiredChoices.map(c => c.id),
          selectedChoiceIds: Array.from(selectedChoiceIds)
        })
        return
      }
      
      const selectedChoicesKey = JSON.stringify(selectedChoicesArray.map(c => ({ choice_id: c.choice_id, option_id: c.option_id })))
      const currentParams = {
        productId: formData.productId,
        tourDate: formData.tourDate,
        channelId: formData.channelId,
        variantKey: formData.variantKey || 'default',
        selectedChoicesKey
      }
      
      // 이전 파라미터와 비교하여 변경된 경우에만 실행
      if (!prevPricingParams.current || 
          prevPricingParams.current.productId !== currentParams.productId ||
          prevPricingParams.current.tourDate !== currentParams.tourDate ||
          prevPricingParams.current.channelId !== currentParams.channelId ||
          prevPricingParams.current.variantKey !== currentParams.variantKey ||
          prevPricingParams.current.selectedChoicesKey !== currentParams.selectedChoicesKey) {
        
        console.log('가격 자동 조회 트리거:', currentParams)
        prevPricingParams.current = currentParams
        loadPricingInfo(formData.productId, formData.tourDate, formData.channelId, reservation?.id, selectedChoicesArray)
      }
    }
  }, [formData.productId, formData.tourDate, formData.channelId, formData.variantKey, formData.selectedChoices, formData.productChoices, reservation?.id, loadPricingInfo])

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
      
      const notIncludedTotal = prev.choiceNotIncludedTotal || 0
      
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
    // 불포함 가격 제외하여 계산 (불포함 가격은 별도로 표시됨)
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
      
      const notIncludedTotal = formData.choiceNotIncludedTotal || 0
      const newSubtotal = newProductPriceTotal + optionTotal + optionalOptionTotal + notIncludedTotal
      
      setFormData(prev => ({
        ...prev,
        productPriceTotal: newProductPriceTotal,
        subtotal: newSubtotal
      }))
    }
  }, [formData.adultProductPrice, formData.childProductPrice, formData.infantProductPrice, formData.adults, formData.child, formData.infant, formData.choicesTotal, formData.choiceNotIncludedTotal, calculateRequiredOptionTotal, calculateOptionTotal])

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
      const variantKey = formData.variantKey || 'default'
      let pricingData: any[] | null = null
      let err: any = null
      const res = await (supabase as any)
        .from('dynamic_pricing')
        .select('choices_pricing, updated_at')
        .eq('product_id', formData.productId)
        .eq('date', formData.tourDate)
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
            .eq('date', formData.tourDate)
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
            .eq('date', formData.tourDate)
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
        not_included_price: formData.not_included_price || 0,
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
        commission_percent: formData.commission_percent,
        commission_amount: formData.commission_amount || 0
      } as Database['public']['Tables']['reservation_pricing']['Insert'] & { commission_amount?: number; not_included_price?: number }

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
                                   (formData.nonResidentWithPassCount || 0) > 0 ||
                                   (formData.nonResidentUnder16Count || 0) > 0
    
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
      
      if (!formData.customerId || showNewCustomerForm) {
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
          setPendingFormDataState(formData)
          setShowDuplicateModal(true)
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
          .select('*')
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
      
      console.log('ReservationForm: 초이스 데이터 준비 시작', {
        selectedChoicesType: Array.isArray(formData.selectedChoices) ? 'array' : typeof formData.selectedChoices,
        selectedChoicesCount: Array.isArray(formData.selectedChoices) ? formData.selectedChoices.length : 'not array',
        selectedChoices: formData.selectedChoices
      })
      
      // "미정"(__undecided__)은 DB choice_options에 없으므로 reservation_choices에 저장하지 않음
      const UNDECIDED_OPTION_ID = '__undecided__'
      if (Array.isArray(formData.selectedChoices) && formData.selectedChoices.length > 0) {
        formData.selectedChoices.forEach(choice => {
          if (choice.choice_id && choice.option_id && choice.option_id !== UNDECIDED_OPTION_ID) {
            choicesData.required.push({
              choice_id: choice.choice_id,
              option_id: choice.option_id,
              quantity: choice.quantity || 1,
              total_price: choice.total_price || 0
            })
          }
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
      
      // 예약 정보와 가격 정보를 함께 제출 (customerId 업데이트)
      const reservationPayload = {
        ...formData,
        id: reservation?.id, // 예약 ID 포함 (새 예약 모드에서 미리 생성된 ID)
        customerId: finalCustomerId || formData.customerId,
        totalPeople,
        choices: choicesData,
        selectedChoices: formData.selectedChoices as any,
        // 가격 정보를 포함하여 전달
        pricingInfo: {
          adultProductPrice: formData.adultProductPrice,
          childProductPrice: formData.childProductPrice,
          infantProductPrice: formData.infantProductPrice,
          productPriceTotal: formData.productPriceTotal,
          not_included_price: formData.not_included_price || 0,
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
          commission_percent: formData.commission_percent,
          commission_amount: formData.commission_amount || 0
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
        console.log('ReservationForm: onSubmit 호출 시작')
        await onSubmit(reservationPayload)
        console.log('ReservationForm: onSubmit 호출 완료')
      } catch (onSubmitError) {
        console.error('ReservationForm: onSubmit 호출 중 오류:', onSubmitError)
        throw onSubmitError
      }
    } catch (error) {
      console.error('예약 저장 중 오류:', error)
      alert('예약 저장 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

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
      
      // Supabase에 저장
      const { data, error } = await (supabase as any)
        .from('customers')
        .insert(customerDataWithDate as Database['public']['Tables']['customers']['Insert'])
        .select('*')

      if (error) {
        console.error('Error adding customer:', error)
        alert('고객 추가 중 오류가 발생했습니다: ' + error.message)
        return
      }

      // 성공 시 고객 목록 새로고침
      await onRefreshCustomers()
      setShowCustomerForm(false)

      // 새로 추가된 고객을 선택하고, 예약 폼도 제출하여 고객+예약 모두 저장
      if (data && data[0]) {
        const newCustomer = data[0] as Database['public']['Tables']['customers']['Row']
        setShowNewCustomerForm(false)
        setFormData(prev => ({
          ...prev,
          customerId: newCustomer.id,
          customerSearch: `${newCustomer.name}${newCustomer.email ? ` (${newCustomer.email})` : ''}`,
          showCustomerDropdown: false
        }))
        // setState 후 예약 폼 제출을 트리거하여 예약도 함께 저장
        setTimeout(() => {
          reservationFormRef.current?.requestSubmit()
        }, 0)
      } else {
        alert('고객이 성공적으로 추가되었습니다!')
      }
    } catch (error) {
      console.error('Error adding customer:', error)
      alert('고객 추가 중 오류가 발생했습니다.')
    }
  }, [onRefreshCustomers])

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
    <div className={isModal ? "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 max-lg:items-stretch max-lg:p-0" : "w-full"}>
      <div className={isModal 
        ? "bg-white rounded-none sm:rounded-lg p-0 sm:p-4 w-full max-w-full h-full max-h-full max-lg:h-[100dvh] max-lg:max-h-[100dvh] max-lg:flex max-lg:flex-col max-lg:overflow-hidden sm:w-[90vw] sm:max-h-[90vh] lg:block lg:overflow-y-auto"
        : "bg-white rounded-lg p-2 sm:p-4 w-full"}
      >
        {/* 헤더: 모바일에서 스티키, 데스크톱 기존 */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center flex-shrink-0 p-3 sm:p-0 sm:mb-2 sm:space-y-0 space-y-3 border-b border-gray-200 max-lg:bg-white max-lg:sticky max-lg:top-0 max-lg:z-10 max-lg:shadow-sm">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <h2 className="text-base sm:text-base font-semibold text-gray-900 truncate">
              {reservation ? t('form.editTitle') : t('form.title')}
              {reservation && (
                <span className="ml-2 text-xs font-normal text-gray-500 hidden sm:inline">
                  (ID: {reservation.id})
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2 flex-shrink-0 min-w-0 max-sm:flex sm:hidden">
              <label className="sr-only" htmlFor="reservation-status-mobile">{t('form.status')}</label>
              <select
                id="reservation-status-mobile"
                value={formData.status}
                onChange={(e) => setFormData((prev: any) => ({ ...prev, status: e.target.value as 'pending' | 'confirmed' | 'completed' | 'cancelled' }))}
                className="min-w-[6.5rem] px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
              >
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
          <div className="hidden sm:flex w-full sm:w-auto items-center space-x-2">
            <div className="flex items-center gap-2 flex-shrink-0">
              <label className="text-xs font-medium text-gray-700 whitespace-nowrap" htmlFor="reservation-status-desktop">{t('form.status')}</label>
              <select
                id="reservation-status-desktop"
                value={formData.status}
                onChange={(e) => setFormData((prev: any) => ({ ...prev, status: e.target.value as 'pending' | 'confirmed' | 'completed' | 'cancelled' }))}
                className="w-full min-w-[6.5rem] sm:w-auto px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
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
              className="px-2 py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-xs"
            >
              목록으로
            </button>
          </div>
        </div>

        <form ref={reservationFormRef} onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden lg:overflow-visible">
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 sm:p-0 sm:space-y-6 lg:flex-none lg:min-h-0 pb-2">
          <div className={`grid grid-cols-1 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-4 lg:grid-rows-1 ${isModal ? 'lg:h-auto' : 'lg:h-[940px]'}`}>
            {/* 1. 고객 정보 */}
            <div id="customer-section" className={`space-y-4 overflow-y-auto border border-gray-200 rounded-xl p-3 sm:p-4 lg:col-span-1 lg:row-span-1 bg-gray-50/50 max-lg:order-1 ${isModal ? 'lg:h-auto' : 'lg:h-[940px]'}`}>
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">언어</label>
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">비상연락처</label>
                        <input
                          type="tel"
                          value={formData.customerEmergencyContact}
                          onChange={(e) => setFormData(prev => ({ ...prev, customerEmergencyContact: e.target.value }))}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">주소</label>
                        <input
                          type="text"
                          value={formData.customerAddress}
                          onChange={(e) => setFormData(prev => ({ ...prev, customerAddress: e.target.value }))}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">특별요청</label>
                        <textarea
                          value={formData.customerSpecialRequests}
                          onChange={(e) => setFormData(prev => ({ ...prev, customerSpecialRequests: e.target.value }))}
                          rows={3}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
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

            {/* 데스크톱: 2·5·6 한 컬럼에 내용 높이만 사용, 예약 정보 바로 아래 가격/예약옵션 */}
            <div className="col-span-1 lg:col-span-2 lg:col-start-2 lg:flex lg:flex-col lg:gap-4 lg:self-start max-lg:contents">
              {/* 2. 예약 정보 (투어 정보, 참가자) */}
              <div className="space-y-4 overflow-y-auto border border-gray-200 rounded-xl p-3 sm:p-4 bg-gray-50/50 max-lg:order-2">
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
                      onChange={(e) => setFormData((prev: any) => ({ ...prev, status: e.target.value as 'pending' | 'confirmed' | 'completed' | 'cancelled' }))}
                      className="min-w-[6.5rem] px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="pending">{t('status.pending')}</option>
                      <option value="confirmed">{t('status.confirmed')}</option>
                      <option value="completed">{t('status.completed')}</option>
                      <option value="cancelled">{t('status.cancelled')}</option>
                    </select>
                  </div>
                </div>
                {/* 상품/초이스·채널 선택 모달 열기 버튼 - 상품 뱃지 + 초이스별 결과값 뱃지 */}
                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setShowProductChoiceModal(true)}
                    className="inline-flex flex-wrap items-center gap-1.5 text-left max-w-full min-w-0 rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1"
                  >
                    {formData.productId ? (
                      <>
                        {/* 상품 뱃지 1개 - 채널 선택 버튼과 동일 크기 */}
                        <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-200 text-xs font-medium truncate max-w-[200px]" title={(() => {
                          const p = products.find((p: { id: string }) => p.id === formData.productId)
                          return p ? (p as { name_ko?: string; name?: string }).name_ko || (p as { name?: string }).name || formData.productId : formData.productId
                        })()}>
                          {(() => {
                            const product = products.find((p: { id: string }) => p.id === formData.productId)
                            return product ? (product as { name_ko?: string; name?: string }).name_ko || (product as { name?: string }).name || formData.productId : formData.productId
                          })()}
                        </span>
                        {/* 초이스별 결과값만 뱃지 */}
                        {Array.isArray(formData.selectedChoices) && formData.selectedChoices.length > 0 && formData.selectedChoices.map((sc: { choice_id: string; option_id: string; option_name_ko?: string; option_key?: string }) => {
                          const label = (sc as { option_name_ko?: string; option_key?: string }).option_name_ko
                            || (sc as { option_name_ko?: string; option_key?: string }).option_key
                            || (() => {
                              const choice = formData.productChoices?.find((c: { id: string }) => c.id === sc.choice_id)
                              const option = choice?.options?.find((o: { id: string }) => o.id === sc.option_id)
                              return (option as { option_name_ko?: string; option_key?: string })?.option_name_ko || (option as { option_key?: string })?.option_key || sc.option_id
                            })()
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
                  <button
                    type="button"
                    onClick={() => setShowChannelModal(true)}
                    className="px-3 py-1.5 text-xs font-medium bg-sky-100 text-sky-800 border border-sky-200 rounded-lg hover:bg-sky-200 text-left max-w-full min-w-0"
                  >
                    <span className="truncate block">
                      {formData.channelId
                        ? (channels.find((c: { id: string }) => c.id === formData.channelId)?.name ?? formData.channelId)
                        : t('form.openChannelSelect')}
                    </span>
                  </button>
                </div>
                <div id="tour-info-section">
                  <TourInfoSection
                    formData={formData}
                    setFormData={setFormData}
                    pickupHotels={pickupHotels}
                    sanitizeTimeInput={sanitizeTimeInput}
                    t={t}
                    allowPastDate={allowPastDateEdit}
                  />
                </div>
                <div id="participants-section">
                  <ParticipantsSection
                    formData={formData}
                    setFormData={setFormData}
                    t={t}
                  />
                </div>
              </div>

              {/* 6. 예약 옵션 · 입금 · 지출 */}
              {reservation && (
                <div className="space-y-3 overflow-y-auto border border-gray-200 rounded-xl p-3 sm:p-3 bg-gray-50/50 max-lg:order-6">
                  <h3 className="text-xs font-medium text-gray-900 mb-1.5">
                    예약 옵션 · 입금 · 지출
                  </h3>
                  <div className="space-y-3">
                    <div id="options-section">
                      <ReservationOptionsSection 
                        reservationId={reservation.id} 
                        onTotalPriceChange={setReservationOptionsTotalPrice}
                      />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <div id="payment-section">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
                          <PaymentRecordsList
                            reservationId={reservation.id}
                            customerName={customers.find(c => c.id === reservation.customerId)?.name || 'Unknown'}
                          />
                        </div>
                      </div>
                      <div id="expense-section">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
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
                </div>
              )}

              {/* 연결된 투어 · 후기 관리 - 예약 옵션 아래 (page 레이아웃 시) */}
              {layout === 'page' && reservation && (
                <>
                  <div className="mt-4">
                    <TourConnectionSection
                      reservation={reservation}
                      onTourCreated={() => {}}
                    />
                  </div>
                  <div id="review-section" className="mt-4">
                    <ReviewManagementSection reservationId={reservation.id} />
                  </div>
                </>
              )}

              {/* 편집/취소 버튼 박스 - 예약 옵션·입금·지출 아래 배치 (스크롤 시 보임) */}
              <div className="w-full border border-gray-200 rounded-xl p-3 bg-white shadow-sm max-lg:order-7">
                <div className="flex flex-row items-center gap-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 min-w-0 bg-blue-600 text-white py-2.5 px-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    {isSubmitting ? tCommon('saving') || '저장 중...' : (reservation ? tCommon('edit') : tCommon('add'))}
                  </button>
                  <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 min-w-0 bg-gray-300 text-gray-700 py-2.5 px-3 rounded-lg hover:bg-gray-400 text-sm font-medium"
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
                      className="shrink-0 px-3 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                    >
                      <Trash2 size={16} className="inline mr-1" />
                      {tCommon('delete')}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 가격 정보 - 기존 상품/채널 선택 컬럼 자리 (제목은 PricingSection에서 버튼과 같은 줄로 표시) */}
            <div id="pricing-section" className={`col-span-1 lg:col-span-2 space-y-2 overflow-y-auto border border-gray-200 rounded-xl p-3 sm:p-4 bg-gray-50/50 max-lg:order-3 ${isModal ? 'lg:h-auto' : 'lg:h-[940px]'}`}>
              {reservation?.id && (
                <div className="text-xs text-gray-500 mb-2 pb-2 border-b border-gray-200">
                  reservation_pricing id: <span className="font-mono text-gray-700">{reservationPricingId ?? '(아직 저장되지 않음)'}</span>
                </div>
              )}
              <PricingSection
                formData={formData as any}
                setFormData={setFormData}
                savePricingInfo={savePricingInfo}
                calculateProductPriceTotal={calculateProductPriceTotal}
                calculateChoiceTotal={calculateRequiredOptionTotal}
                calculateCouponDiscount={calculateCouponDiscount}
                coupons={coupons}
                getOptionalOptionsForProduct={(productId) =>
                  getOptionalOptionsForProduct(productId, productOptions) as any
                }
                options={options}
                t={t}
                autoSelectCoupon={autoSelectCoupon}
                reservationOptionsTotalPrice={reservationOptionsTotalPrice}
                isExistingPricingLoaded={isExistingPricingLoaded}
                {...(reservation?.id ? { reservationId: reservation.id } : {})}
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
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
                loadProductChoices={(productId) => loadProductChoices(productId)}
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
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
                  setPendingFormDataState(null)
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
                {pendingCustomerData?.email && <div><strong>이메일:</strong> {pendingCustomerData.email}</div>}
                {pendingCustomerData?.phone && <div><strong>전화번호:</strong> {pendingCustomerData.phone}</div>}
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-3">
                비슷한 기존 고객 {similarCustomers.length}명을 찾았습니다. 기존 고객을 선택하시겠습니까, 아니면 새로 추가하시겠습니까?
              </p>
              
              <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-2">
                {similarCustomers.map((similarCustomer) => (
                  <div
                    key={similarCustomer.id}
                    className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={async () => {
                      // 기존 고객 선택
                      setFormData(prev => ({ ...prev, customerId: similarCustomer.id }))
                      setShowNewCustomerForm(false)
                      setShowDuplicateModal(false)
                      setSimilarCustomers([])
                      setPendingCustomerData(null)
                      setPendingFormDataState(null)
                      // 고객 목록 새로고침
                      await onRefreshCustomers()
                      // 폼 제출 계속 진행
                      if (pendingFormDataState) {
                        const form = document.querySelector('form') as HTMLFormElement
                        if (form) {
                          form.requestSubmit()
                        }
                      }
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 mb-1">
                          {similarCustomer.name}
                        </div>
                        <div className="text-xs text-gray-400 font-mono mb-1">
                          ID: {similarCustomer.id}
                        </div>
                        {similarCustomer.email && (
                          <div className="text-sm text-gray-600 flex items-center space-x-1">
                            <Mail className="h-3 w-3" />
                            <span>{similarCustomer.email}</span>
                          </div>
                        )}
                        {similarCustomer.phone && (
                          <div className="text-sm text-gray-600 flex items-center space-x-1 mt-1">
                            <Phone className="h-3 w-3" />
                            <span>{similarCustomer.phone}</span>
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                          선택
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => {
                  setShowDuplicateModal(false)
                  setSimilarCustomers([])
                  setPendingCustomerData(null)
                  setPendingFormDataState(null)
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
                    // 랜덤 ID 생성
                    const timestamp = Date.now().toString(36)
                    const randomStr = Math.random().toString(36).substring(2, 8)
                    const newCustomerId = `CUST_${timestamp}_${randomStr}`.toUpperCase()
                    
                    const customerData = {
                      ...pendingCustomerData,
                      id: newCustomerId
                    }
                    
                    const { data: newCustomer, error: customerError } = await (supabase as any)
                      .from('customers')
                      .insert(customerData)
                      .select('*')
                      .single()
                    
                    if (customerError) {
                      console.error('고객 정보 생성 오류:', customerError)
                      alert('고객 정보 생성 중 오류가 발생했습니다: ' + customerError.message)
                      return
                    }
                    
                    setFormData(prev => ({ ...prev, customerId: newCustomer.id }))
                    setShowNewCustomerForm(false)
                    await onRefreshCustomers()
                    
                    // 폼 제출 계속 진행
                    if (pendingFormDataState) {
                      const form = document.querySelector('form') as HTMLFormElement
                      if (form) {
                        form.requestSubmit()
                      }
                    }
                  }
                  setShowDuplicateModal(false)
                  setSimilarCustomers([])
                  setPendingCustomerData(null)
                  setPendingFormDataState(null)
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                새로 추가하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
