'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Calendar, Users, Clock, CreditCard, ShoppingCart, ArrowLeft, ArrowRight, Check, X, ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLocale } from 'next-intl'
import LoginForm from '@/components/auth/LoginForm'
import SignUpForm from '@/components/auth/SignUpForm'

interface Product {
  id: string
  name: string
  name_ko: string | null
  name_en: string | null
  customer_name_ko: string
  customer_name_en: string
  base_price: number | null
  duration: string | null
  max_participants: number | null
  departure_city: string | null
  arrival_city: string | null
  departure_country: string | null
  arrival_country: string | null
  languages: string[] | null
  group_size: string | null
  adult_age: number | null
  child_age_min: number | null
  child_age_max: number | null
  infant_age: number | null
  choices: Record<string, unknown> | null
  tour_departure_times: Record<string, unknown> | null
}

interface Tour {
  id: string
  product_id: string
  tour_date: string
  tour_start_datetime: string | null
  tour_status: string | null
  team_type: string | null
  tour_guide_id: string | null
  tour_car_id: string | null
  tour_note: string | null
}

interface ProductOption {
  id: string
  product_id: string
  name: string
  description: string | null
  is_required: boolean
  is_multiple: boolean
  choice_name: string | null
  choice_description: string | null
  adult_price_adjustment: number | null
  child_price_adjustment: number | null
  infant_price_adjustment: number | null
  is_default: boolean
  linked_option_id: string | null
  // 옵션 정보 (linked_option_id를 통해 조인)
  option_name?: string
  option_name_ko?: string | null
  option_name_en?: string | null
  option_description?: string | null
  option_description_ko?: string | null
  option_description_en?: string | null
  option_image_url?: string | null
  option_thumbnail_url?: string | null
  option_adult_price?: number | null
  option_child_price?: number | null
  option_infant_price?: number | null
}

interface ChoiceOption {
  option_id: string
  option_name: string
  option_name_ko: string | null
  option_name_en?: string | null
  option_price: number | null
  option_child_price?: number | null
  option_infant_price?: number | null
  is_default: boolean | null
}

interface ChoiceGroup {
  choice_id: string
  choice_name: string
  choice_name_ko: string | null
  choice_name_en?: string | null
  choice_type: string
  choice_description: string | null
  choice_description_ko?: string | null
  choice_description_en?: string | null
  choice_image_url?: string | null
  choice_thumbnail_url?: string | null
  is_required: boolean
  options: ChoiceOption[]
}

interface ProductChoice {
  product_id: string
  product_name: string
  choice_id: string
  choice_name: string
  choice_name_ko: string | null
  choice_type: string
  choice_description: string | null
  option_id: string
  option_name: string
  option_name_ko: string | null
  option_price: number | null
  is_default: boolean | null
}

interface TourSchedule {
  id: string
  product_id: string
  tour_date: string
  departure_time: string | null
  available_spots: number | null
  status: string | null
  team_type: string | null
  guide_id: string | null
  guide_name: string | null
  vehicle_id: string | null
  vehicle_type: string | null
  notes: string | null
}

interface BookingData {
  productId: string
  tourDate: string
  departureTime: string
  participants: {
    adults: number
    children: number
    infants: number
  }
  selectedOptions: Record<string, string>
  totalPrice: number
  customerInfo: {
    name: string
    email: string
    phone: string
    country: string
    customerLanguage: string // 고객의 국가 언어 (단일 선택)
    tourLanguages: string[] // 투어 언어 (복수 선택 가능)
    specialRequests: string
  }
}

interface BookingFlowProps {
  product: Product
  productChoices: ProductChoice[]
  onClose: () => void
  onComplete: (bookingData: BookingData) => void
}

// 국가 목록
const countries = [
  { code: 'KR', nameKo: '대한민국', nameEn: 'South Korea', phoneCode: '+82' },
  { code: 'US', nameKo: '미국', nameEn: 'United States', phoneCode: '+1' },
  { code: 'JP', nameKo: '일본', nameEn: 'Japan', phoneCode: '+81' },
  { code: 'CN', nameKo: '중국', nameEn: 'China', phoneCode: '+86' },
  { code: 'TH', nameKo: '태국', nameEn: 'Thailand', phoneCode: '+66' },
  { code: 'SG', nameKo: '싱가포르', nameEn: 'Singapore', phoneCode: '+65' },
  { code: 'MY', nameKo: '말레이시아', nameEn: 'Malaysia', phoneCode: '+60' },
  { code: 'ID', nameKo: '인도네시아', nameEn: 'Indonesia', phoneCode: '+62' },
  { code: 'PH', nameKo: '필리핀', nameEn: 'Philippines', phoneCode: '+63' },
  { code: 'VN', nameKo: '베트남', nameEn: 'Vietnam', phoneCode: '+84' },
  { code: 'AU', nameKo: '호주', nameEn: 'Australia', phoneCode: '+61' },
  { code: 'CA', nameKo: '캐나다', nameEn: 'Canada', phoneCode: '+1' },
  { code: 'GB', nameKo: '영국', nameEn: 'United Kingdom', phoneCode: '+44' },
  { code: 'DE', nameKo: '독일', nameEn: 'Germany', phoneCode: '+49' },
  { code: 'FR', nameKo: '프랑스', nameEn: 'France', phoneCode: '+33' },
  { code: 'IT', nameKo: '이탈리아', nameEn: 'Italy', phoneCode: '+39' },
  { code: 'ES', nameKo: '스페인', nameEn: 'Spain', phoneCode: '+34' },
  { code: 'RU', nameKo: '러시아', nameEn: 'Russia', phoneCode: '+7' },
  { code: 'BR', nameKo: '브라질', nameEn: 'Brazil', phoneCode: '+55' },
  { code: 'MX', nameKo: '멕시코', nameEn: 'Mexico', phoneCode: '+52' },
  { code: 'IN', nameKo: '인도', nameEn: 'India', phoneCode: '+91' },
  { code: 'OTHER', nameKo: '기타', nameEn: 'Other', phoneCode: '+' }
]

// 전체 언어 옵션 (고객의 국가 언어용)
const allLanguages = [
  { code: 'ko', nameKo: '한국어', nameEn: 'Korean' },
  { code: 'en', nameKo: '영어', nameEn: 'English' },
  { code: 'ja', nameKo: '일본어', nameEn: 'Japanese' },
  { code: 'zh', nameKo: '중국어', nameEn: 'Chinese' },
  { code: 'es', nameKo: '스페인어', nameEn: 'Spanish' },
  { code: 'fr', nameKo: '프랑스어', nameEn: 'French' },
  { code: 'de', nameKo: '독일어', nameEn: 'German' },
  { code: 'it', nameKo: '이탈리아어', nameEn: 'Italian' },
  { code: 'pt', nameKo: '포르투갈어', nameEn: 'Portuguese' },
  { code: 'ru', nameKo: '러시아어', nameEn: 'Russian' },
  { code: 'th', nameKo: '태국어', nameEn: 'Thai' },
  { code: 'vi', nameKo: '베트남어', nameEn: 'Vietnamese' },
  { code: 'id', nameKo: '인도네시아어', nameEn: 'Indonesian' },
  { code: 'ar', nameKo: '아랍어', nameEn: 'Arabic' },
  { code: 'hi', nameKo: '힌디어', nameEn: 'Hindi' }
]

// 투어 언어 옵션 (영어, 한국어만)
const tourLanguages = [
  { code: 'ko', nameKo: '한국어', nameEn: 'Korean' },
  { code: 'en', nameKo: '영어', nameEn: 'English' }
]

export default function BookingFlow({ product, productChoices, onClose, onComplete }: BookingFlowProps) {
  const locale = useLocale()
  const isEnglish = locale === 'en'
  const translate = useCallback((ko: string, en: string) => (isEnglish ? en : ko), [isEnglish])
  const localeTag = isEnglish ? 'en-US' : 'ko-KR'
  const dayNames = isEnglish ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['일', '월', '화', '수', '목', '금', '토']
  const statusLabelMap: Record<string, string> = {
    available: translate('예약 가능', 'Available'),
    recruiting: translate('동행 모집중', 'More guests needed'),
    confirmed: translate('출발 확정', 'Confirmed departure'),
    almost_full: translate('마감 임박', 'Almost full'),
    closed: translate('마감', 'Closed'),
    unknown: translate('알 수 없음', 'Unknown')
  }
  const steps = isEnglish
    ? [
        { id: 'booking', title: 'Booking Details', icon: Calendar },
        { id: 'optional', title: 'Optional Add-ons', icon: ShoppingCart },
        { id: 'customer', title: 'Guest Details', icon: Users },
        { id: 'payment', title: 'Payment', icon: CreditCard }
      ]
    : [
        { id: 'booking', title: '예약 정보', icon: Calendar },
        { id: 'optional', title: '추가 선택', icon: ShoppingCart },
        { id: 'customer', title: '고객 정보', icon: Users },
        { id: 'payment', title: '결제', icon: CreditCard }
      ]

  const [currentStep, setCurrentStep] = useState(0)
  const [tourSchedules, setTourSchedules] = useState<TourSchedule[]>([])
  const [loading, setLoading] = useState(false)
  
  // 캘린더 관련 상태
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  
  // 추가 선택 옵션 상태
  const [productOptions, setProductOptions] = useState<ProductOption[]>([])
  const [loadingOptions, setLoadingOptions] = useState(false)
  
  // 예약 인원수 상태
  const [reservationCounts, setReservationCounts] = useState<Record<string, number>>({})
  
  // 마감된 날짜들 상태
  const [closedDates, setClosedDates] = useState<Set<string>>(new Set())
  
  // 날짜별 동적 가격 정보 (date -> { adult_price, child_price, infant_price })
  const [datePrices, setDatePrices] = useState<Record<string, { adult_price: number; child_price: number; infant_price: number }>>({})
  
  // 날짜별 초이스 판매 상태 (date -> { choiceCombinationKey -> is_sale_available })
  const [choiceAvailability, setChoiceAvailability] = useState<Record<string, Record<string, boolean>>>({})
  
  // 인증 관련 상태
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userEmail, setUserEmail] = useState<string>('')

  // 결제 관련 상태
  const [paymentMethod, setPaymentMethod] = useState<string>('card')
  const [cardDetails, setCardDetails] = useState({
    number: '',
    expiry: '',
    cvv: '',
    name: ''
  })
  const [cardErrors, setCardErrors] = useState({
    number: '',
    expiry: '',
    cvv: '',
    name: ''
  })

  const [bookingData, setBookingData] = useState<BookingData>({
    productId: product.id,
    tourDate: '',
    departureTime: '',
    participants: {
      adults: 1,
      children: 0,
      infants: 0
    },
    selectedOptions: {},
    totalPrice: product.base_price || 0,
    customerInfo: {
      name: '',
      email: '',
      phone: '',
      country: '',
      customerLanguage: '',
      tourLanguages: [],
      specialRequests: ''
    }
  })

  const productDisplayName = isEnglish
    ? product.customer_name_en || product.name_en || product.customer_name_ko || product.name
    : product.customer_name_ko || product.name

  // 투어 스케줄 로드 (매일 출발 가능, 고객은 모든 날짜 선택 가능)
  useEffect(() => {
    const loadTourSchedules = async () => {
      try {
        setLoading(true)
        
        // 1. 먼저 dynamic_pricing에서 해당 상품의 모든 날짜들을 조회 (가격 정보 및 초이스 판매 상태 포함)
        const { data: pricingData, error: pricingError } = await supabase
          .from('dynamic_pricing')
          .select('date, is_sale_available, adult_price, child_price, infant_price, choices_pricing')
          .eq('product_id', product.id)
          .gte('date', new Date().toISOString().split('T')[0])
          .order('date', { ascending: true })

        if (pricingError) {
          console.error('Dynamic pricing 조회 오류:', pricingError)
        }

        // 마감된 날짜들 추출 및 날짜별 가격 정보 저장, 초이스 판매 상태 저장
        const closedDatesSet = new Set<string>()
        const pricingMap: Record<string, { adult_price: number; child_price: number; infant_price: number }> = {}
        const choiceAvailabilityMap: Record<string, Record<string, boolean>> = {}
        
        if (pricingData) {
          pricingData.forEach((item: { 
            date: string
            is_sale_available: boolean
            adult_price: number
            child_price: number
            infant_price: number
            choices_pricing?: Record<string, { is_sale_available?: boolean }>
          }) => {
            if (item.is_sale_available === false) {
              closedDatesSet.add(item.date)
            }
            // 가격 정보 저장
            pricingMap[item.date] = {
              adult_price: item.adult_price || product.base_price || 0,
              child_price: item.child_price || 0,
              infant_price: item.infant_price || 0
            }
            
            // 초이스별 판매 상태 저장
            if (item.choices_pricing && typeof item.choices_pricing === 'object') {
              const choiceStatus: Record<string, boolean> = {}
              Object.entries(item.choices_pricing).forEach(([choiceId, choiceData]) => {
                if (choiceData && typeof choiceData === 'object') {
                  // is_sale_available이 명시적으로 false인 경우만 마감으로 처리
                  choiceStatus[choiceId] = choiceData.is_sale_available !== false
                }
              })
              choiceAvailabilityMap[item.date] = choiceStatus
            }
          })
        }
        
        setDatePrices(pricingMap)
        setChoiceAvailability(choiceAvailabilityMap)
        
        // 테스트를 위해 임시로 마감된 날짜 추가
        closedDatesSet.add('2025-11-01')
        closedDatesSet.add('2025-11-02')
        
        console.log('마감된 날짜들:', Array.from(closedDatesSet))
        setClosedDates(closedDatesSet)

        // 2. 기존 tours 테이블에서 실제 투어 정보 조회 (참고용)
        const { data: existingTours, error: toursError } = await supabase
          .from('tours')
          .select('*')
          .eq('product_id', product.id)
          .gte('tour_date', new Date().toISOString().split('T')[0])
          .order('tour_date', { ascending: true }) as { data: Tour[] | null, error: Error | null }

        if (toursError) {
          console.error('투어 정보 조회 오류:', toursError)
        }

        // 3. 날짜 범위 생성 (오늘부터 3개월 후까지)
        const today = new Date()
        const endDate = new Date()
        endDate.setMonth(endDate.getMonth() + 3) // 3개월 후까지

        const allDates: string[] = []
        const currentDate = new Date(today)
        
        while (currentDate <= endDate) {
          allDates.push(currentDate.toISOString().split('T')[0])
          currentDate.setDate(currentDate.getDate() + 1)
        }

        // 4. 스케줄 생성 로직
        const finalSchedules: TourSchedule[] = []

        if (pricingData && pricingData.length > 0) {
          // Dynamic pricing에 날짜가 있으면 해당 날짜들 우선 표시
          console.log('Dynamic pricing에서 가져온 날짜들:', pricingData.map(item => item.date))
          
          const pricingDates = pricingData.map((item: { date: string; is_sale_available: boolean }) => item.date)
          
          // Dynamic pricing 날짜들을 스케줄로 생성
          pricingDates.forEach(date => {
            const existingTour = existingTours?.find((tour: Tour) => tour.tour_date === date)
            
            if (existingTour) {
              // 기존 투어가 있으면 그 정보 사용
              finalSchedules.push({
                id: existingTour.id,
                product_id: existingTour.product_id,
                tour_date: existingTour.tour_date,
                departure_time: existingTour.tour_start_datetime ? 
                  new Date(existingTour.tour_start_datetime).toTimeString().substring(0, 5) : null,
                available_spots: product.max_participants || 20,
                status: existingTour.tour_status || 'active',
                team_type: existingTour.team_type,
                guide_id: existingTour.tour_guide_id,
                guide_name: null,
                vehicle_id: existingTour.tour_car_id,
                vehicle_type: null,
                notes: existingTour.tour_note
              })
            } else {
              // 기존 투어가 없으면 가상 스케줄 생성
              finalSchedules.push({
                id: `virtual_${date}`,
                product_id: product.id,
                tour_date: date,
                departure_time: null,
                available_spots: product.max_participants || 20,
                status: 'available', // 예약 가능 상태
                team_type: null,
                guide_id: null,
                guide_name: null,
                vehicle_id: null,
                vehicle_type: null,
                notes: translate('Dynamic pricing 기반 - 4인 이상 확정 시 출발', 'Dynamic pricing availability - departs with 4 or more guests')
              })
            }
          })
          
          // Dynamic pricing에 없는 날짜들도 추가 (모든 날짜 선택 가능)
          const remainingDates = allDates.filter(date => !pricingDates.includes(date))
          remainingDates.forEach(date => {
            const existingTour = existingTours?.find((tour: Tour) => tour.tour_date === date)
            
            if (existingTour) {
              finalSchedules.push({
                id: existingTour.id,
                product_id: existingTour.product_id,
                tour_date: existingTour.tour_date,
                departure_time: existingTour.tour_start_datetime ? 
                  new Date(existingTour.tour_start_datetime).toTimeString().substring(0, 5) : null,
                available_spots: product.max_participants || 20,
                status: existingTour.tour_status || 'active',
                team_type: existingTour.team_type,
                guide_id: existingTour.tour_guide_id,
                guide_name: null,
                vehicle_id: existingTour.tour_car_id,
                vehicle_type: null,
                notes: existingTour.tour_note
              })
            } else {
              finalSchedules.push({
                id: `available_${date}`,
                product_id: product.id,
                tour_date: date,
                departure_time: null,
                available_spots: product.max_participants || 20,
                status: 'available',
                team_type: null,
                guide_id: null,
                guide_name: null,
                vehicle_id: null,
                vehicle_type: null,
                notes: translate('매일 출발 가능 - 4인 이상 확정 시 출발', 'Daily departures available - confirmed with 4 or more guests')
              })
            }
          })
        } else {
          // Dynamic pricing에 날짜가 없으면 모든 날짜를 선택 가능하게 표시
          console.log('Dynamic pricing에 날짜가 없어 모든 날짜를 선택 가능하게 표시합니다.')
          
          allDates.forEach(date => {
            const existingTour = existingTours?.find((tour: Tour) => tour.tour_date === date)
            
            if (existingTour) {
              finalSchedules.push({
                id: existingTour.id,
                product_id: existingTour.product_id,
                tour_date: existingTour.tour_date,
                departure_time: existingTour.tour_start_datetime ? 
                  new Date(existingTour.tour_start_datetime).toTimeString().substring(0, 5) : null,
                available_spots: product.max_participants || 20,
                status: existingTour.tour_status || 'active',
                team_type: existingTour.team_type,
                guide_id: existingTour.tour_guide_id,
                guide_name: null,
                vehicle_id: existingTour.tour_car_id,
                vehicle_type: null,
                notes: existingTour.tour_note
              })
            } else {
              finalSchedules.push({
                id: `available_${date}`,
                product_id: product.id,
                tour_date: date,
                departure_time: null,
                available_spots: product.max_participants || 20,
                status: 'available',
                team_type: null,
                guide_id: null,
                guide_name: null,
                vehicle_id: null,
                vehicle_type: null,
                notes: translate('매일 출발 가능 - 4인 이상 확정 시 출발', 'Daily departures available - confirmed with 4 or more guests')
              })
            }
          })
        }

        // 날짜순으로 정렬
        finalSchedules.sort((a, b) => a.tour_date.localeCompare(b.tour_date))
        
        setTourSchedules(finalSchedules)
        
      } catch (error) {
        console.error('투어 스케줄 로드 오류:', error)
      } finally {
        setLoading(false)
      }
    }

    loadTourSchedules()
  }, [product.id, product.max_participants, translate])

  // product_options 테이블에서 추가 선택 옵션 로드
  useEffect(() => {
    const loadProductOptions = async () => {
      try {
        setLoadingOptions(true)
        
        const { data, error } = await supabase
          .from('product_options')
          .select(`
            id,
            product_id,
            name,
            description,
            is_required,
            is_multiple,
            choice_name,
            choice_description,
            adult_price_adjustment,
            child_price_adjustment,
            infant_price_adjustment,
            is_default,
            linked_option_id
          `)
          .eq('product_id', product.id)
          .eq('is_required', false) // 추가 선택만 가져오기

        if (error) {
          console.error('Product options 로드 오류:', error)
          return
        }

        // linked_option_id가 있으면 options 테이블에서 상세 정보 가져오기
        if (data && data.length > 0) {
          const linkedOptionIds = data
            .map(opt => opt.linked_option_id)
            .filter((id): id is string => id !== null && id !== undefined)
          
          let optionsData: Record<string, any> = {}
          
          if (linkedOptionIds.length > 0) {
            const { data: options, error: optionsError } = await supabase
              .from('options')
              .select(`
                id,
                name,
                name_ko,
                name_en,
                description,
                description_ko,
                description_en,
                image_url,
                thumbnail_url,
                adult_price,
                child_price,
                infant_price
              `)
              .in('id', linkedOptionIds)
            
            if (!optionsError && options) {
              options.forEach(opt => {
                optionsData[opt.id] = opt
              })
            }
          }
          
          // product_options 데이터에 options 정보 병합
          const enrichedData = data.map(po => ({
            ...po,
            option_name: po.linked_option_id ? (optionsData[po.linked_option_id]?.name || po.name) : po.name,
            option_name_ko: po.linked_option_id ? optionsData[po.linked_option_id]?.name_ko : null,
            option_name_en: po.linked_option_id ? optionsData[po.linked_option_id]?.name_en : null,
            option_description: po.linked_option_id ? (optionsData[po.linked_option_id]?.description || po.description) : po.description,
            option_description_ko: po.linked_option_id ? optionsData[po.linked_option_id]?.description_ko : null,
            option_description_en: po.linked_option_id ? optionsData[po.linked_option_id]?.description_en : null,
            option_image_url: po.linked_option_id ? optionsData[po.linked_option_id]?.image_url : null,
            option_thumbnail_url: po.linked_option_id ? optionsData[po.linked_option_id]?.thumbnail_url : null,
            option_adult_price: po.linked_option_id ? optionsData[po.linked_option_id]?.adult_price : po.adult_price_adjustment,
            option_child_price: po.linked_option_id ? optionsData[po.linked_option_id]?.child_price : po.child_price_adjustment,
            option_infant_price: po.linked_option_id ? optionsData[po.linked_option_id]?.infant_price : po.infant_price_adjustment
          }))
          
          setProductOptions(enrichedData)
        } else {
          setProductOptions([])
        }
      } catch (error) {
        console.error('Product options 로드 오류:', error)
      } finally {
        setLoadingOptions(false)
      }
    }

    loadProductOptions()
  }, [product.id])

  // 예약 인원수 로드
  useEffect(() => {
    const loadReservationCounts = async () => {
      try {
        // 오늘부터 3개월 후까지의 날짜 범위
        const today = new Date()
        const endDate = new Date()
        endDate.setMonth(endDate.getMonth() + 3)
        
        const { data, error } = await supabase
          .from('reservations')
          .select('tour_date, total_people, status')
          .eq('product_id', product.id) // product_id는 텍스트 타입
          .gte('tour_date', today.toISOString().split('T')[0])
          .lte('tour_date', endDate.toISOString().split('T')[0])
          .not('status', 'ilike', '%canceled%') // canceled가 포함된 모든 상태 제외 (대소문자 구분 없음)

        if (error) {
          console.error('예약 인원수 조회 오류:', error)
          return
        }

        console.log('예약 인원수 조회 결과:', data)
        console.log('상품 ID:', product.id)

        // 테스트를 위해 임시 더미 데이터 추가
        const dummyData = [
          { tour_date: '2025-10-28', total_people: 2, status: 'confirmed' },
          { tour_date: '2025-10-29', total_people: 5, status: 'confirmed' },
          { tour_date: '2025-10-30', total_people: 12, status: 'confirmed' },
          { tour_date: '2025-10-31', total_people: 1, status: 'confirmed' },
          { tour_date: '2025-11-03', total_people: 3, status: 'Canceled' }, // 이건 제외되어야 함
          { tour_date: '2025-11-04', total_people: 2, status: 'canceled' }, // 이것도 제외되어야 함
          { tour_date: '2025-11-05', total_people: 4, status: 'CANCELED' } // 이것도 제외되어야 함
        ]
        
        console.log('더미 데이터 추가:', dummyData)

        // 날짜별로 예약 인원수 합계 계산
        const counts: Record<string, number> = {}
        
        // 실제 데이터 처리
        data?.forEach((reservation: { tour_date: string; total_people: number; status: string }) => {
          const date = reservation.tour_date
          counts[date] = (counts[date] || 0) + (reservation.total_people || 0)
        })
        
        // 더미 데이터 처리 (canceled 상태 제외)
        dummyData.forEach((reservation: { tour_date: string; total_people: number; status: string }) => {
          // canceled가 포함된 상태는 제외
          if (!reservation.status.toLowerCase().includes('canceled')) {
            const date = reservation.tour_date
            counts[date] = (counts[date] || 0) + (reservation.total_people || 0)
          }
        })

        console.log('계산된 예약 인원수:', counts)
        setReservationCounts(counts)
      } catch (error) {
        console.error('예약 인원수 조회 오류:', error)
      }
    }

    loadReservationCounts()
  }, [product.id])

  // 기본 옵션 설정
  useEffect(() => {
    if (productChoices.length === 0) return
    
    const defaultOptions: Record<string, string> = {}
    
    const tempGroups = productChoices.reduce((groups, choice) => {
      const groupKey = choice.choice_id
      if (!groups[groupKey]) {
        groups[groupKey] = {
          choice_id: choice.choice_id,
          options: []
        }
      }
      groups[groupKey].options.push({
        option_id: choice.option_id,
        is_default: choice.is_default
      })
      return groups
    }, {} as Record<string, { choice_id: string; options: Array<{ option_id: string; is_default: boolean | null }> }>)
    
    Object.values(tempGroups).forEach((group) => {
      const defaultOption = group.options.find((option) => option.is_default)
      if (defaultOption) {
        defaultOptions[group.choice_id] = defaultOption.option_id
      } else if (group.options.length > 0) {
        defaultOptions[group.choice_id] = group.options[0].option_id
      }
    })
    
    setBookingData(prev => ({
      ...prev,
      selectedOptions: defaultOptions
    }))
  }, [productChoices])

  // 선택된 초이스 조합의 판매 가능 여부 확인
  const isChoiceCombinationAvailable = useCallback((choiceGroupId: string, optionId: string): boolean => {
    if (!bookingData.tourDate) return true // 날짜가 선택되지 않았으면 판매 가능으로 간주
    
    const dateAvailability = choiceAvailability[bookingData.tourDate]
    if (!dateAvailability) return true // 해당 날짜에 초이스별 설정이 없으면 판매 가능
    
    // 선택된 모든 필수 초이스 조합 생성
    const selectedOptionIds: string[] = []
    requiredChoices.forEach((group: ChoiceGroup) => {
      const selectedOptionId = group.choice_id === choiceGroupId 
        ? optionId 
        : bookingData.selectedOptions[group.choice_id]
      if (selectedOptionId) {
        selectedOptionIds.push(selectedOptionId)
      }
    })
    
    // 조합 키 생성 (option_id들을 +로 연결)
    const combinationKey = selectedOptionIds.sort().join('+')
    
    // 해당 조합의 판매 가능 여부 확인
    // 직접 조합 키가 있으면 그것 사용, 없으면 각 option_id별로 확인
    if (dateAvailability[combinationKey] !== undefined) {
      return dateAvailability[combinationKey]
    }
    
    // 조합 키가 없으면 각 option_id별로 확인 (하나라도 마감이면 마감)
    for (const optionIdCheck of selectedOptionIds) {
      if (dateAvailability[optionIdCheck] === false) {
        return false
      }
    }
    
    return true // 기본적으로 판매 가능
  }, [bookingData.tourDate, bookingData.selectedOptions, choiceAvailability, requiredChoices])

  // 가격 계산
  const calculateTotalPrice = () => {
    // 선택된 날짜의 동적 가격 사용 (있으면)
    let basePrice = product.base_price || 0
    
    if (bookingData.tourDate && datePrices[bookingData.tourDate]) {
      // 동적 가격이 있으면 인원별로 계산
      const pricing = datePrices[bookingData.tourDate]
      const adultTotal = (pricing.adult_price || basePrice) * bookingData.participants.adults
      const childTotal = (pricing.child_price || 0) * bookingData.participants.children
      const infantTotal = (pricing.infant_price || 0) * bookingData.participants.infants
      
      let totalPrice = adultTotal + childTotal + infantTotal
      
      // 선택된 옵션 가격 추가 (필수 + 추가 선택)
      const allChoices = [...requiredChoices, ...optionalChoices]
      allChoices.forEach((group: ChoiceGroup) => {
        const selectedOptionId = bookingData.selectedOptions[group.choice_id]
        if (selectedOptionId) {
          const option = group.options.find((opt: ChoiceOption) => opt.option_id === selectedOptionId)
          if (option && option.option_price) {
            // 옵션 가격도 인원수에 따라 곱하기
            const totalParticipants = bookingData.participants.adults + bookingData.participants.children + bookingData.participants.infants
            totalPrice += option.option_price * totalParticipants
          }
        }
      })
      
      return totalPrice
    } else {
      // 동적 가격이 없으면 기존 로직 사용
      let totalPrice = basePrice
      
      // 선택된 옵션 가격 추가 (필수 + 추가 선택)
      const allChoices = [...requiredChoices, ...optionalChoices]
      allChoices.forEach((group: ChoiceGroup) => {
        const selectedOptionId = bookingData.selectedOptions[group.choice_id]
        if (selectedOptionId) {
          const option = group.options.find((opt: ChoiceOption) => opt.option_id === selectedOptionId)
          if (option && option.option_price) {
            totalPrice += option.option_price
          }
        }
      })

      // 인원별 가격 계산 (성인 기준)
      const totalParticipants = bookingData.participants.adults + bookingData.participants.children + bookingData.participants.infants
      return totalPrice * totalParticipants
    }
  }

  // 필수 선택: productChoices에서 필수인 것들 (현재 추가 선택에 있던 내용을 필수로 이동)
  const groupedChoices = productChoices.reduce((groups, choice) => {
    const groupKey = choice.choice_id
    if (!groups[groupKey]) {
      groups[groupKey] = {
        choice_id: choice.choice_id,
        choice_name: choice.choice_name,
        choice_name_ko: choice.choice_name_ko,
        choice_type: choice.choice_type,
        choice_description: choice.choice_description,
        is_required: true, // 모든 productChoices를 필수로 설정
        options: []
      }
    }
    groups[groupKey].options.push({
      option_id: choice.option_id,
      option_name: choice.option_name,
      option_name_ko: choice.option_name_ko,
      option_price: choice.option_price,
      is_default: choice.is_default
    })
    return groups
  }, {} as Record<string, ChoiceGroup>)

  // 필수 선택: productChoices의 모든 내용
  const requiredChoices = Object.values(groupedChoices)
  
  // 추가 선택: product_options 테이블에서 가져온 내용
  const optionalChoices = productOptions.map(option => ({
    choice_id: option.id,
    choice_name: isEnglish ? (option.option_name_en || option.option_name || option.name) : (option.option_name_ko || option.option_name || option.name),
    choice_name_ko: option.option_name_ko || option.option_name || option.name,
    choice_name_en: option.option_name_en || option.option_name || option.name,
    choice_type: 'optional',
    choice_description: isEnglish ? (option.option_description_en || option.option_description || option.description) : (option.option_description_ko || option.option_description || option.description),
    choice_description_ko: option.option_description_ko || option.option_description || option.description,
    choice_description_en: option.option_description_en || option.option_description || option.description,
    choice_image_url: option.option_image_url || option.option_thumbnail_url,
    choice_thumbnail_url: option.option_thumbnail_url || option.option_image_url,
    is_required: false,
    options: [{
      option_id: option.id,
      option_name: isEnglish ? (option.option_name_en || option.option_name || option.name) : (option.option_name_ko || option.option_name || option.name),
      option_name_ko: option.option_name_ko || option.option_name || option.name,
      option_name_en: option.option_name_en || option.option_name || option.name,
      option_price: option.option_adult_price || option.adult_price_adjustment || 0,
      option_child_price: option.option_child_price || option.child_price_adjustment || 0,
      option_infant_price: option.option_infant_price || option.infant_price_adjustment || 0,
      is_default: option.is_default || false
    }]
  }))

  // 전화번호를 국제 형식으로 변환하는 함수
  const getFullPhoneNumber = () => {
    if (!bookingData.customerInfo.country || !bookingData.customerInfo.phone) {
      return ''
    }
    const country = countries.find(c => c.code === bookingData.customerInfo.country)
    return country ? `${country.phoneCode}${bookingData.customerInfo.phone}` : ''
  }

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  // 카드 정보 검증
  const validateCardDetails = () => {
    const errors = {
      number: '',
      expiry: '',
      cvv: '',
      name: ''
    }
    let isValid = true

    // 카드 번호 검증 (16자리 숫자)
    const cardNumber = cardDetails.number.replace(/\s/g, '')
    if (!cardNumber || cardNumber.length < 13 || cardNumber.length > 19) {
      errors.number = translate('올바른 카드 번호를 입력해주세요.', 'Please enter a valid card number.')
      isValid = false
    }

    // 만료일 검증 (MM/YY 형식)
    const expiryMatch = cardDetails.expiry.match(/^(\d{2})\/(\d{2})$/)
    if (!expiryMatch) {
      errors.expiry = translate('올바른 만료일을 입력해주세요. (MM/YY)', 'Please enter a valid expiry date (MM/YY).')
      isValid = false
    } else {
      const month = parseInt(expiryMatch[1])
      const year = parseInt('20' + expiryMatch[2])
      const currentDate = new Date()
      const expiryDate = new Date(year, month - 1)
      
      if (month < 1 || month > 12 || expiryDate < currentDate) {
        errors.expiry = translate('만료일이 지났거나 올바르지 않습니다.', 'Expiry date is invalid or has passed.')
        isValid = false
      }
    }

    // CVV 검증 (3-4자리 숫자)
    if (!cardDetails.cvv || cardDetails.cvv.length < 3 || cardDetails.cvv.length > 4) {
      errors.cvv = translate('올바른 CVV를 입력해주세요.', 'Please enter a valid CVV.')
      isValid = false
    }

    // 카드 소유자명 검증
    if (!cardDetails.name || cardDetails.name.trim().length < 2) {
      errors.name = translate('카드 소유자명을 입력해주세요.', 'Please enter the cardholder name.')
      isValid = false
    }

    setCardErrors(errors)
    return isValid
  }

  // Stripe 결제 처리 함수
  const processPayment = async (reservationId: string, amount: number) => {
    if (paymentMethod === 'card') {
      // 카드 정보 검증
      if (!validateCardDetails()) {
        throw new Error(translate('카드 정보를 확인해주세요.', 'Please check your card information.'))
      }

      try {
        // 1단계: Payment Intent 생성 (서버에서)
        const response = await fetch('/api/payment/create-payment-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: amount,
            currency: 'usd',
            reservationId: reservationId,
            customerInfo: {
              name: bookingData.customerInfo.name,
              email: bookingData.customerInfo.email
            }
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || translate('결제 요청 생성에 실패했습니다.', 'Failed to create payment request.'))
        }

        const { clientSecret, paymentIntentId } = await response.json()

        // 2단계: Stripe Elements로 결제 완료 (클라이언트에서)
        // @ts-ignore - Stripe.js는 동적 로딩
        const stripe = (await import('@stripe/stripe-js')).loadStripe(
          process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
        )

        const stripeInstance = await stripe
        
        if (!stripeInstance) {
          throw new Error(translate('Stripe 로드에 실패했습니다.', 'Failed to load Stripe.'))
        }

        // 3단계: 카드 정보로 결제 확인
        const { error: confirmError, paymentIntent } = await stripeInstance.confirmCardPayment(clientSecret, {
          payment_method: {
            card: {
              number: cardDetails.number.replace(/\s/g, ''),
              exp_month: parseInt(cardDetails.expiry.split('/')[0]),
              exp_year: parseInt('20' + cardDetails.expiry.split('/')[1]),
              cvc: cardDetails.cvv,
            },
            billing_details: {
              name: cardDetails.name,
              email: bookingData.customerInfo.email,
            },
          },
        })

        if (confirmError) {
          throw new Error(confirmError.message || translate('결제에 실패했습니다.', 'Payment failed.'))
        }

        if (paymentIntent?.status === 'succeeded') {
          return {
            success: true,
            transactionId: paymentIntent.id
          }
        } else {
          throw new Error(translate('결제가 완료되지 않았습니다.', 'Payment was not completed.'))
        }

      } catch (error) {
        console.error('Stripe 결제 처리 오류:', error)
        throw error
      }
    } else if (paymentMethod === 'bank_transfer') {
      // 은행 이체는 결제 기록만 생성하고 상태는 pending으로 유지
      return {
        success: true,
        transactionId: null
      }
    } else {
      throw new Error(translate('지원하지 않는 결제 방법입니다.', 'Unsupported payment method.'))
    }
  }

  const handleComplete = async () => {
    try {
      setLoading(true)
      
      // 결제 방법이 카드인 경우 카드 정보 검증
      if (paymentMethod === 'card' && !validateCardDetails()) {
        setLoading(false)
        return
      }
      
      // 전화번호를 국제 형식으로 변환하여 저장
      const fullPhoneNumber = getFullPhoneNumber()
      const totalPrice = calculateTotalPrice()
      
      // 1. 예약 기본 정보 생성
      const reservationId = `reservation_${Date.now()}_${Math.random().toString(36).substring(2)}`
      
      const reservationData = {
        id: reservationId,
        product_id: product.id,
        customer_name: bookingData.customerInfo.name,
        customer_email: bookingData.customerInfo.email,
        customer_phone: fullPhoneNumber,
        tour_date: bookingData.tourDate,
        departure_time: bookingData.departureTime || null,
        adults: bookingData.participants.adults,
        children: bookingData.participants.children,
        infants: bookingData.participants.infants,
        total_people: bookingData.participants.adults + bookingData.participants.children + bookingData.participants.infants,
        total_price: totalPrice,
        choices_total: 0, // 나중에 계산
        status: 'pending',
        notes: bookingData.customerInfo.specialRequests || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // 2. 예약 생성
      const { data: newReservation, error: reservationError } = await supabase
        .from('reservations')
        .insert(reservationData)
        .select()
        .single()

      if (reservationError) {
        throw new Error(`예약 생성 오류: ${reservationError.message}`)
      }

      // 3. 선택된 필수/선택 옵션들을 reservation_choices에 저장
      const choicesToInsert: any[] = []
      let choicesTotal = 0

      // 필수 선택 (productChoices)
      requiredChoices.forEach((group: ChoiceGroup) => {
        const selectedOptionId = bookingData.selectedOptions[group.choice_id]
        if (selectedOptionId) {
          const option = group.options.find((opt: ChoiceOption) => opt.option_id === selectedOptionId)
          if (option) {
            // choice_id는 product_choices의 UUID, option_id는 choice_options의 UUID
            // 하지만 현재 productChoices 구조에서는 choice_id와 option_id가 이미 올바르게 매핑되어 있음
            const totalParticipants = bookingData.participants.adults + bookingData.participants.children + bookingData.participants.infants
            const optionPrice = option.option_price || 0
            const totalPrice = optionPrice * totalParticipants
            
            choicesToInsert.push({
              reservation_id: reservationId,
              choice_id: group.choice_id, // UUID
              option_id: selectedOptionId, // UUID
              quantity: totalParticipants,
              total_price: totalPrice
            })
            
            choicesTotal += totalPrice
          }
        }
      })

      // 추가 선택 (productOptions) - reservation_options 테이블에 저장
      const optionsToInsert: any[] = []
      optionalChoices.forEach((group: ChoiceGroup) => {
        const selectedOptionId = bookingData.selectedOptions[group.choice_id]
        if (selectedOptionId) {
          // productOptions에서 해당 선택된 옵션 찾기
          const productOption = productOptions.find(po => po.id === selectedOptionId)
          const option = group.options.find((opt: ChoiceOption) => opt.option_id === selectedOptionId)
          
          if (option && productOption) {
            const totalParticipants = bookingData.participants.adults + bookingData.participants.children + bookingData.participants.infants
            const optionPrice = option.option_price || 0
            const totalPrice = optionPrice * totalParticipants
            
            // linked_option_id가 있으면 그것을 사용, 없으면 product_options의 id 사용
            // reservation_options의 option_id는 options 테이블의 id를 참조
            const actualOptionId = productOption.linked_option_id || selectedOptionId
            
            optionsToInsert.push({
              reservation_id: reservationId,
              option_id: actualOptionId,
              ea: totalParticipants,
              price: optionPrice,
              total_price: totalPrice,
              status: 'active'
            })
            
            choicesTotal += totalPrice
          }
        }
      })

      // reservation_options에 삽입 (추가 선택 상품)
      if (optionsToInsert.length > 0) {
        const { error: optionsError } = await supabase
          .from('reservation_options')
          .insert(optionsToInsert)

        if (optionsError) {
          console.error('예약 추가 선택 상품 저장 오류:', optionsError)
          // 추가 선택 상품 저장 실패해도 예약은 성공으로 처리
        }
      }

      // reservation_choices에 삽입 (필수 선택만)
      if (choicesToInsert.length > 0) {
        const { error: choicesError } = await supabase
          .from('reservation_choices')
          .insert(choicesToInsert)

        if (choicesError) {
          console.error('예약 선택사항 저장 오류:', choicesError)
          // 선택사항 저장 실패해도 예약은 성공으로 처리
        }
      }

      // 4. choices_total 업데이트
      if (choicesTotal > 0) {
        await supabase
          .from('reservations')
          .update({ choices_total: choicesTotal })
          .eq('id', reservationId)
      }

      // 5. 결제 처리
      let paymentStatus = 'pending'
      let transactionId: string | null = null
      
      if (paymentMethod === 'card') {
        try {
          const paymentResult = await processPayment(reservationId, totalPrice)
          
          if (!paymentResult.success) {
            // 결제 실패 시 예약 상태를 pending으로 유지하고 오류 메시지 표시
            throw new Error(paymentResult.error || translate('결제 처리에 실패했습니다.', 'Payment processing failed.'))
          }
          
          transactionId = paymentResult.transactionId || null
          paymentStatus = 'confirmed'
          
          // 결제 성공 시 예약 상태를 confirmed로 업데이트
          await supabase
            .from('reservations')
            .update({ status: 'confirmed' })
            .eq('id', reservationId)
        } catch (paymentError) {
          // 결제 실패 시 예약은 생성되었지만 pending 상태
          console.error('결제 처리 오류:', paymentError)
          alert(isEnglish 
            ? `Reservation created but payment failed: ${paymentError instanceof Error ? paymentError.message : 'Unknown error'}. We will contact you regarding payment.` 
            : `예약은 생성되었지만 결제에 실패했습니다: ${paymentError instanceof Error ? paymentError.message : '알 수 없는 오류'}. 결제 관련해서 곧 연락드리겠습니다.`)
          onComplete({
            ...bookingData,
            totalPrice: totalPrice,
            customerInfo: {
              ...bookingData.customerInfo,
              phone: fullPhoneNumber
            },
            reservationId: reservationId
          })
          return
        }
      }

      // 6. 결제 기록 생성 (payment_records 테이블에 저장)
      if (paymentMethod === 'card' && transactionId) {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.access_token) {
            await fetch('/api/payment-records', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({
                reservation_id: reservationId,
                payment_status: paymentStatus,
                amount: totalPrice,
                payment_method: paymentMethod,
                note: transactionId ? `Transaction ID: ${transactionId}` : null
              })
            })
          }
        } catch (error) {
          console.error('결제 기록 생성 오류:', error)
          // 결제 기록 생성 실패해도 예약은 성공으로 처리
        }
      }

      const finalBookingData = {
        ...bookingData,
        totalPrice: totalPrice,
        customerInfo: {
          ...bookingData.customerInfo,
          phone: fullPhoneNumber
        },
        reservationId: reservationId
      }

      // 성공 메시지 표시
      if (paymentMethod === 'card' && paymentStatus === 'confirmed') {
        alert(isEnglish 
          ? `Payment successful! Your reservation has been confirmed. Reservation ID: ${reservationId}` 
          : `결제가 완료되었습니다! 예약이 확정되었습니다. 예약 ID: ${reservationId}`)
      } else {
        alert(isEnglish 
          ? 'Your reservation has been submitted successfully! We will contact you soon.' 
          : '예약이 성공적으로 제출되었습니다! 곧 연락드리겠습니다.')
      }
      
      onComplete(finalBookingData)
      
    } catch (error) {
      console.error('예약 생성 오류:', error)
      alert(isEnglish 
        ? `Failed to create reservation: ${error instanceof Error ? error.message : 'Unknown error'}` 
        : `예약 생성에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    } finally {
      setLoading(false)
    }
  }

  // 인증 핸들러
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setIsAuthenticated(true)
        setUserEmail(session.user.email || '')
        setBookingData(prev => ({
          ...prev,
          customerInfo: {
            ...prev.customerInfo,
            email: session.user.email || prev.customerInfo.email,
            name: session.user.user_metadata?.name || prev.customerInfo.name
          }
        }))
      }
    }
    checkAuth()
  }, [])

  const handleAuthSuccess = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      setIsAuthenticated(true)
      setUserEmail(session.user.email || '')
      setShowAuthModal(false)
      setBookingData(prev => ({
        ...prev,
        customerInfo: {
          ...prev.customerInfo,
          email: session.user.email || prev.customerInfo.email,
          name: session.user.user_metadata?.name || prev.customerInfo.name
        }
      }))
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setIsAuthenticated(false)
    setUserEmail('')
    setBookingData(prev => ({
      ...prev,
      customerInfo: {
        ...prev.customerInfo,
        email: '',
        name: ''
      }
    }))
  }

  // 캘린더 관련 함수들
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()
    
    const days = []
    
    // 이전 달의 마지막 날짜들
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const prevMonthLastDay = new Date(year, month, 0).getDate()
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
        isAvailable: false
      })
    }
    
    // 현재 달의 날짜들
    for (let i = 1; i <= daysInMonth; i++) {
      const currentDate = new Date(year, month, i)
      const dateString = currentDate.toISOString().split('T')[0]
      const today = new Date().toISOString().split('T')[0]
      
      days.push({
        date: currentDate,
        isCurrentMonth: true,
        isAvailable: dateString >= today
      })
    }
    
    // 다음 달의 첫 날짜들
    const remainingDays = 42 - days.length // 6주 x 7일 = 42
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
        isAvailable: false
      })
    }
    
    return days
  }

  const getScheduleForDate = (date: Date) => {
    const dateString = date.toISOString().split('T')[0]
    return tourSchedules.find(schedule => schedule.tour_date === dateString)
  }

  // 날짜별 상태 결정 함수
  const getDateStatus = (date: Date) => {
    const dateString = date.toISOString().split('T')[0]
    const reservationCount = reservationCounts[dateString] || 0
    
    console.log(`날짜 ${dateString}의 예약 인원수:`, reservationCount)
    console.log('마감된 날짜인지:', closedDates.has(dateString))
    
    // dynamic_pricing에서 is_sale_available이 false이면 마감
    if (closedDates.has(dateString)) {
      console.log(`날짜 ${dateString}는 마감됨`)
      return 'closed' // 마감
    }
    
    // 예약 인원수에 따른 상태 결정
    if (reservationCount >= 10) {
      console.log(`날짜 ${dateString}는 마감 임박 (${reservationCount}명)`)
      return 'almost_full' // 마감 임박
    } else if (reservationCount >= 4) {
      console.log(`날짜 ${dateString}는 출발 확정 (${reservationCount}명)`)
      return 'confirmed' // 출발 확정
    } else if (reservationCount >= 1) {
      console.log(`날짜 ${dateString}는 동행 모집중 (${reservationCount}명)`)
      return 'recruiting' // 동행 모집중
    } else {
      console.log(`날짜 ${dateString}는 예약 가능 (${reservationCount}명)`)
      return 'available' // 예약 가능
    }
  }

  const handleDateSelect = (date: Date) => {
    const dateString = date.toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]
    
    if (dateString < today) return // 과거 날짜는 선택 불가
    if (closedDates.has(dateString)) return // 마감된 날짜는 선택 불가
    
    setSelectedDate(dateString)
    const schedule = getScheduleForDate(date)
    
    setBookingData(prev => ({
      ...prev,
      tourDate: dateString,
      departureTime: schedule?.departure_time || ''
    }))
  }

  const goToPreviousMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const isStepValid = useCallback(() => {
    switch (currentStep) {
      case 0: // 날짜 + 인원 + 필수 선택
        return bookingData.tourDate && 
               bookingData.participants.adults > 0 &&
               requiredChoices.every((group: ChoiceGroup) => {
                 const selectedOption = bookingData.selectedOptions[group.choice_id]
                 return selectedOption && selectedOption !== ''
               })
      case 1: // 추가 선택
        return true // 추가 선택은 선택사항
      case 2: // 고객 정보
        const { name, email, phone, customerLanguage, country } = bookingData.customerInfo
        return !!(
          name && 
          name.trim() &&
          email && 
          email.trim() &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && // 이메일 형식 검증
          country &&
          phone && 
          phone.trim() &&
          customerLanguage
        )
      case 3: // 결제
        // 카드 결제 방법 선택 시 카드 정보 검증
        if (paymentMethod === 'card') {
          const cardNumber = cardDetails.number.replace(/\s/g, '')
          const expiryMatch = cardDetails.expiry.match(/^(\d{2})\/(\d{2})$/)
          
          return !!(
            cardNumber && 
            cardNumber.length >= 13 && 
            cardNumber.length <= 19 &&
            expiryMatch &&
            cardDetails.cvv && 
            cardDetails.cvv.length >= 3 && 
            cardDetails.cvv.length <= 4 &&
            cardDetails.name && 
            cardDetails.name.trim().length >= 2
          )
        }
        // 은행 이체나 기타 결제 방법은 항상 유효
        return true
      default:
        return false
    }
  }, [currentStep, bookingData, requiredChoices, paymentMethod, cardDetails])

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{translate('예약 정보', 'Booking Details')}</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-blue-800">
                      <strong>{translate('매일 출발 가능합니다!', 'Tours depart daily!')}</strong> {translate('날짜, 인원, 필수 옵션을 선택해주세요.', 'Please select date, participants, and required options.')}
                    </p>
                  </div>
                </div>
              </div>
              
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">{translate('투어 스케줄을 불러오는 중...', 'Loading tour availability...')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* 왼쪽: 달력 */}
                  <div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4 min-h-[600px] flex flex-col">
                  {/* 캘린더 헤더 */}
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={goToPreviousMonth}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <ChevronLeft className="h-5 w-5 text-gray-600" />
                    </button>
                    <h4 className="text-lg font-semibold text-gray-900">
                      {currentMonth.toLocaleDateString(localeTag, { 
                            year: 'numeric',
                        month: 'long' 
                      })}
                    </h4>
                    <button
                      onClick={goToNextMonth}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <ChevronRight className="h-5 w-5 text-gray-600" />
                    </button>
                        </div>

                  {/* 요일 헤더 */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {dayNames.map((day) => (
                      <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* 캘린더 그리드 */}
                  <div className="grid grid-cols-7 gap-1">
                    {getDaysInMonth(currentMonth).map((day, index) => {
                      const dateString = day.date.toISOString().split('T')[0]
                      const isSelected = selectedDate === dateString
                      const isToday = dateString === new Date().toISOString().split('T')[0]
                      
                      return (
                        <button
                          key={index}
                          onClick={() => handleDateSelect(day.date)}
                          disabled={!day.isAvailable || closedDates.has(dateString)}
                          className={`
                            relative p-2 text-sm rounded-lg transition-colors
                            ${!day.isCurrentMonth ? 'text-gray-300' : ''}
                            ${!day.isAvailable || closedDates.has(dateString) ? 'cursor-not-allowed text-gray-300' : 'cursor-pointer'}
                            ${isSelected ? 'bg-blue-500 text-white' : ''}
                            ${!isSelected && day.isAvailable && day.isCurrentMonth && !closedDates.has(dateString) ? 'hover:bg-blue-50 text-gray-900' : ''}
                            ${isToday && !isSelected ? 'bg-yellow-100 text-yellow-800 font-semibold' : ''}
                            ${closedDates.has(dateString) ? 'bg-red-100 text-red-500' : ''}
                          `}
                        >
                          <div className="text-center">
                            <div>{day.date.getDate()}</div>
                            {/* 날짜별 가격 표시 */}
                            {day.isAvailable && day.isCurrentMonth && !closedDates.has(dateString) && (
                              <div className="text-xs font-semibold mt-1 text-blue-600">
                                {datePrices[dateString] 
                                  ? `$${datePrices[dateString].adult_price}`
                                  : product.base_price 
                                    ? `$${product.base_price}`
                                    : ''}
                              </div>
                            )}
                          </div>
                          
                          {/* 상태 표시 */}
                          {day.isAvailable && day.isCurrentMonth && (
                            <div className="absolute bottom-0 left-0 right-0 flex justify-center">
                              <div className={`
                                w-1 h-1 rounded-full
                                ${getDateStatus(day.date) === 'available' ? 'bg-green-500' : ''}
                                ${getDateStatus(day.date) === 'recruiting' ? 'bg-orange-500' : ''}
                                ${getDateStatus(day.date) === 'confirmed' ? 'bg-blue-500' : ''}
                                ${getDateStatus(day.date) === 'almost_full' ? 'bg-yellow-500' : ''}
                                ${getDateStatus(day.date) === 'closed' ? 'bg-red-500' : ''}
                              `} />
                            </div>
                          )}
                        </button>
                      )
                    })}
                      </div>

                  {/* 범례 */}
                  <div className="mt-4 flex items-center justify-center space-x-3 text-xs text-gray-600">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                      {statusLabelMap.available}
                    </div>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-orange-500 rounded-full mr-1"></div>
                      {statusLabelMap.recruiting}
                    </div>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mr-1"></div>
                      {statusLabelMap.confirmed}
                    </div>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full mr-1"></div>
                      {statusLabelMap.almost_full}
                    </div>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-red-500 rounded-full mr-1"></div>
                      {statusLabelMap.closed}
                    </div>
                  </div>
                  
                  {/* 선택된 날짜 정보 및 총 가격 */}
                  <div className="mt-auto pt-4 space-y-3">
                    {selectedDate && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <div className="text-sm text-gray-700">
                          <div className="font-medium text-xs mb-1">{translate('선택된 날짜', 'Selected Date')}</div>
                          <div className="text-xs">
                            {new Date(selectedDate).toLocaleDateString(localeTag, {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              weekday: 'short'
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* 총 가격 표시 */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="text-center">
                        <div className="text-xs text-gray-600 mb-1">{translate('총 가격', 'Total Price')}</div>
                        <div className="text-2xl font-bold text-blue-600">${calculateTotalPrice()}</div>
                        
                        {/* 가격 상세 내역 */}
                        <div className="mt-3 pt-3 border-t border-blue-200 space-y-1.5 text-left">
                          {/* 기본 가격/인원별 가격 */}
                          {selectedDate && datePrices[selectedDate] ? (
                            <>
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-600">{translate('성인', 'Adults')} × {bookingData.participants.adults}</span>
                                <span className="font-medium">${(datePrices[selectedDate].adult_price || product.base_price || 0) * bookingData.participants.adults}</span>
                              </div>
                              {bookingData.participants.children > 0 && (
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-600">{translate('아동', 'Children')} × {bookingData.participants.children}</span>
                                  <span className="font-medium">${(datePrices[selectedDate].child_price || 0) * bookingData.participants.children}</span>
                                </div>
                              )}
                              {bookingData.participants.infants > 0 && (
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-600">{translate('유아', 'Infants')} × {bookingData.participants.infants}</span>
                                  <span className="font-medium">${(datePrices[selectedDate].infant_price || 0) * bookingData.participants.infants}</span>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-600">{translate('기본 가격', 'Base price')}</span>
                              <span className="font-medium">${product.base_price || 0}</span>
                            </div>
                          )}
                          
                          {/* 선택된 초이스 가격 */}
                          {[...requiredChoices, ...optionalChoices]
                            .filter((group: ChoiceGroup) => {
                              const selectedOptionId = bookingData.selectedOptions[group.choice_id]
                              if (!selectedOptionId) return false
                              const selectedOption = group.options.find((opt: ChoiceOption) => opt.option_id === selectedOptionId)
                              if (!selectedOption) return false
                              const totalParticipants = bookingData.participants.adults + bookingData.participants.children + bookingData.participants.infants
                              return (selectedOption.option_price || 0) * totalParticipants > 0
                            })
                            .map((group: ChoiceGroup) => {
                              const selectedOptionId = bookingData.selectedOptions[group.choice_id]
                              const selectedOption = group.options.find((opt: ChoiceOption) => opt.option_id === selectedOptionId)
                              if (!selectedOption) return null
                              const totalParticipants = bookingData.participants.adults + bookingData.participants.children + bookingData.participants.infants
                              const totalOptionPrice = (selectedOption.option_price || 0) * totalParticipants
                              
                              return (
                                <div key={group.choice_id} className="flex justify-between text-xs">
                                  <span className="text-gray-600 truncate max-w-[120px]">
                                    {(isEnglish ? group.choice_name_ko || group.choice_name : group.choice_name_ko || group.choice_name)?.substring(0, 10)}
                                    {totalParticipants > 1 && ` ×${totalParticipants}`}
                                  </span>
                                  <span className="font-medium text-green-600 ml-2">+${totalOptionPrice}</span>
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    </div>
                  </div>
                    </div>
                  </div>
                  
                  {/* 오른쪽: 인원 선택 + 필수 선택 */}
                  <div className="space-y-4">
                    {/* 인원 선택 */}
                    <div className="bg-white border border-gray-200 rounded-lg p-4 sticky top-4">
                      <h4 className="text-base font-semibold text-gray-900 mb-4">{translate('인원 선택', 'Select Participants')}</h4>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <div className="font-medium text-gray-900 text-sm">{translate('성인', 'Adult')}</div>
                            <div className="text-xs text-gray-600">
                              {product.adult_age ? translate(`${product.adult_age}세 이상`, `${product.adult_age}+ years`) : translate('성인', 'Adult')}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => {
                                if (bookingData.participants.adults > 1) {
                                  setBookingData(prev => ({
                                    ...prev,
                                    participants: {
                                      ...prev.participants,
                                      adults: prev.participants.adults - 1
                                    }
                                  }))
                                }
                              }}
                              className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                            >
                              <X className="h-3 w-3" />
                            </button>
                            <span className="w-8 text-center font-medium text-sm">{bookingData.participants.adults}</span>
                            <button
                              onClick={() => {
                                const totalParticipants = bookingData.participants.adults + bookingData.participants.children + bookingData.participants.infants
                                if (totalParticipants < (product.max_participants || 20)) {
                                  setBookingData(prev => ({
                                    ...prev,
                                    participants: {
                                      ...prev.participants,
                                      adults: prev.participants.adults + 1
                                    }
                                  }))
                                }
                              }}
                              className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                            >
                              <Check className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        {product.child_age_min && product.child_age_max && (
                          <div className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <div className="font-medium text-gray-900 text-sm">{translate('아동', 'Child')}</div>
                              <div className="text-xs text-gray-600">
                                {translate(`${product.child_age_min}-${product.child_age_max}세`, `${product.child_age_min}-${product.child_age_max} years`)}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => {
                                  if (bookingData.participants.children > 0) {
                                    setBookingData(prev => ({
                                      ...prev,
                                      participants: {
                                        ...prev.participants,
                                        children: prev.participants.children - 1
                                      }
                                    }))
                                  }
                                }}
                                className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                              >
                                <X className="h-3 w-3" />
                              </button>
                              <span className="w-8 text-center font-medium text-sm">{bookingData.participants.children}</span>
                              <button
                                onClick={() => {
                                  const totalParticipants = bookingData.participants.adults + bookingData.participants.children + bookingData.participants.infants
                                  if (totalParticipants < (product.max_participants || 20)) {
                                    setBookingData(prev => ({
                                      ...prev,
                                      participants: {
                                        ...prev.participants,
                                        children: prev.participants.children + 1
                                      }
                                    }))
                                  }
                                }}
                                className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                              >
                                <Check className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        )}

                        {product.infant_age && (
                          <div className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <div className="font-medium text-gray-900 text-sm">{translate('유아', 'Infant')}</div>
                              <div className="text-xs text-gray-600">
                                {translate(`${product.infant_age}세 미만`, `Under ${product.infant_age} years`)}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => {
                                  if (bookingData.participants.infants > 0) {
                                    setBookingData(prev => ({
                                      ...prev,
                                      participants: {
                                        ...prev.participants,
                                        infants: prev.participants.infants - 1
                                      }
                                    }))
                                  }
                                }}
                                className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                              >
                                <X className="h-3 w-3" />
                              </button>
                              <span className="w-8 text-center font-medium text-sm">{bookingData.participants.infants}</span>
                              <button
                                onClick={() => {
                                  const totalParticipants = bookingData.participants.adults + bookingData.participants.children + bookingData.participants.infants
                                  if (totalParticipants < (product.max_participants || 20)) {
                                    setBookingData(prev => ({
                                      ...prev,
                                      participants: {
                                        ...prev.participants,
                                        infants: prev.participants.infants + 1
                                      }
                                    }))
                                  }
                                }}
                                className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                              >
                                <Check className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* 필수 선택 */}
                    {requiredChoices.length > 0 && (
                      <div className="bg-white border border-gray-200 rounded-lg p-4 sticky top-4">
                        <h4 className="text-base font-semibold text-gray-900 mb-3 flex items-center">
                          <span className="text-red-600 mr-1">*</span>
                          {translate('필수 선택', 'Required Options')}
                        </h4>
                        
                        <div className="space-y-3 max-h-[400px] overflow-y-auto">
                          {requiredChoices.map((group: ChoiceGroup) => (
                            <div key={group.choice_id} className="border border-red-200 rounded-lg p-3 bg-red-50">
                              <div className="mb-2">
                                <h5 className="font-medium text-gray-900 text-sm flex items-center">
                                  <span className="text-red-600 mr-1">*</span>
                                  {isEnglish ? group.choice_name || group.choice_name_ko : group.choice_name_ko || group.choice_name}
                                </h5>
                                {group.choice_description && (
                                  <p className="text-xs text-gray-600 mt-1">{group.choice_description}</p>
                                )}
                              </div>
                              <div className="space-y-1.5">
                                {group.options.map((option: ChoiceOption) => {
                                  const isAvailable = isChoiceCombinationAvailable(group.choice_id, option.option_id)
                                  const isDisabled = !isAvailable
                                  
                                  return (
                                    <label 
                                      key={option.option_id} 
                                      className={`flex items-center space-x-2 p-1.5 rounded transition-colors ${
                                        isDisabled 
                                          ? 'opacity-50 cursor-not-allowed bg-gray-100' 
                                          : 'cursor-pointer hover:bg-white'
                                      }`}
                                    >
                                      <input
                                        type="radio"
                                        name={group.choice_id}
                                        value={option.option_id}
                                        checked={bookingData.selectedOptions[group.choice_id] === option.option_id}
                                        onChange={(e) => {
                                          if (!isDisabled) {
                                            setBookingData(prev => ({
                                              ...prev,
                                              selectedOptions: {
                                                ...prev.selectedOptions,
                                                [group.choice_id]: e.target.value
                                              }
                                            }))
                                          }
                                        }}
                                        className="w-3.5 h-3.5 text-red-600"
                                        required
                                        disabled={isDisabled}
                                      />
                                      <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                          <span className={`font-medium text-xs ${
                                            isDisabled ? 'text-gray-500' : 'text-gray-900'
                                          }`}>
                                            {isEnglish ? option.option_name || option.option_name_ko : option.option_name_ko || option.option_name}
                                          </span>
                                          {isDisabled && (
                                            <span className="text-[10px] text-red-600 bg-red-100 px-1.5 py-0.5 rounded font-medium">
                                              {translate('마감', 'Closed')}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                          {option.option_price && option.option_price > 0 && (
                                            <span className="text-red-600 font-medium text-xs">
                                              +${option.option_price}
                                            </span>
                                          )}
                                          {option.is_default && (
                                            <span className="text-[10px] text-gray-500 bg-gray-200 px-1 py-0.5 rounded">{translate('기본', 'Default')}</span>
                                          )}
                                        </div>
                                      </div>
                                    </label>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )

      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{translate('추가 선택', 'Optional Add-ons')}</h3>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-green-800">
                      <strong>{translate('선택사항입니다!', 'These are optional!')}</strong> {translate('원하시는 추가 옵션을 선택하세요. 선택하지 않아도 됩니다.', 'Choose any add-ons you’d like—this step is optional.')}
                    </p>
                  </div>
                </div>
              </div>
              
              {loadingOptions ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">{translate('추가 선택사항을 불러오는 중...', 'Loading optional add-ons...')}</p>
                </div>
              ) : optionalChoices.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {optionalChoices.map((group: any) => (
                    group.options.map((option: any) => {
                      const adultPrice = option.option_price || 0
                      const childPrice = option.option_child_price || 0
                      const infantPrice = option.option_infant_price || 0
                      const hasPrice = adultPrice > 0 || childPrice > 0 || infantPrice > 0
                      
                      return (
                        <label 
                          key={option.option_id} 
                          className={`relative flex flex-col cursor-pointer rounded-lg border-2 bg-white hover:border-green-400 hover:shadow-lg transition-all ${
                            bookingData.selectedOptions[group.choice_id] === option.option_id 
                              ? 'border-green-500 shadow-md' 
                              : 'border-gray-200'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={bookingData.selectedOptions[group.choice_id] === option.option_id}
                            onChange={(e) => {
                              setBookingData(prev => {
                                // 이미 선택된 옵션이면 선택 취소
                                if (prev.selectedOptions[group.choice_id] === option.option_id) {
                                  const newSelectedOptions = { ...prev.selectedOptions }
                                  delete newSelectedOptions[group.choice_id]
                                  return {
                                    ...prev,
                                    selectedOptions: newSelectedOptions
                                  }
                                } else {
                                  // 새로운 옵션 선택
                                  return {
                                    ...prev,
                                    selectedOptions: {
                                      ...prev.selectedOptions,
                                      [group.choice_id]: option.option_id
                                    }
                                  }
                                }
                              })
                            }}
                            className="absolute top-3 right-3 w-5 h-5 text-green-600"
                          />
                          
                          {/* 이미지 */}
                          {group.choice_image_url && (
                            <div className="w-full h-48 overflow-hidden rounded-t-lg">
                              <img
                                src={group.choice_thumbnail_url || group.choice_image_url}
                                alt={isEnglish ? group.choice_name_en || group.choice_name : group.choice_name_ko || group.choice_name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                            </div>
                          )}
                          
                          {/* 내용 영역 */}
                          <div className="flex flex-col flex-1 p-4">
                            {/* 제목 */}
                            <h4 className="font-semibold text-gray-900 text-lg mb-2 pr-8">
                              {isEnglish ? group.choice_name_en || group.choice_name : group.choice_name_ko || group.choice_name}
                            </h4>
                            
                            {/* 설명 */}
                            {group.choice_description && (
                              <p className="text-sm text-gray-600 mb-3 line-clamp-3">
                                {isEnglish ? group.choice_description_en || group.choice_description : group.choice_description_ko || group.choice_description}
                              </p>
                            )}
                            
                            {/* 가격 정보 */}
                            {hasPrice && (
                              <div className="mt-auto pt-3 border-t border-gray-200">
                                <div className="space-y-1">
                                  {adultPrice > 0 && (
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs text-gray-600">{translate('성인', 'Adult')}</span>
                                      <span className="text-green-600 font-semibold text-sm">
                                        +${adultPrice.toFixed(2)}
                                      </span>
                                    </div>
                                  )}
                                  {childPrice > 0 && (
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs text-gray-600">{translate('아동', 'Child')}</span>
                                      <span className="text-green-600 font-medium text-xs">
                                        +${childPrice.toFixed(2)}
                                      </span>
                                    </div>
                                  )}
                                  {infantPrice > 0 && (
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs text-gray-600">{translate('유아', 'Infant')}</span>
                                      <span className="text-green-600 font-medium text-xs">
                                        +${infantPrice.toFixed(2)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {/* 기본 옵션 배지 */}
                            {option.is_default && (
                              <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded mt-3 inline-block self-start">
                                {translate('기본', 'Default')}
                              </span>
                            )}
                          </div>
                        </label>
                      )
                    })
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-600">{translate('추가 선택사항이 없습니다', 'There are no optional add-ons.')}</p>
                </div>
              )}
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{translate('고객 정보', 'Guest Information')}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{translate('이름 *', 'Name *')}</label>
                  <input
                    type="text"
                    value={bookingData.customerInfo.name}
                    onChange={(e) => {
                      setBookingData(prev => ({
                        ...prev,
                        customerInfo: {
                          ...prev.customerInfo,
                          name: e.target.value
                        }
                      }))
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={translate('이름을 입력하세요', 'Enter your name')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{translate('이메일 *', 'Email *')}</label>
                  <input
                    type="email"
                    value={bookingData.customerInfo.email}
                    onChange={(e) => {
                      setBookingData(prev => ({
                        ...prev,
                        customerInfo: {
                          ...prev.customerInfo,
                          email: e.target.value
                        }
                      }))
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={translate('이메일을 입력하세요', 'Enter your email')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{translate('전화번호 *', 'Phone Number *')}</label>
                  <div className="flex space-x-2">
                    <select
                      value={bookingData.customerInfo.country}
                      onChange={(e) => {
                        setBookingData(prev => ({
                          ...prev,
                          customerInfo: {
                            ...prev.customerInfo,
                            country: e.target.value
                          }
                        }))
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">{translate('국가', 'Country')}</option>
                      {countries.map(country => (
                        <option key={country.code} value={country.code}>
                          {country.phoneCode} {translate(country.nameKo, country.nameEn)}
                        </option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      value={bookingData.customerInfo.phone}
                      onChange={(e) => {
                        // 숫자만 입력 허용
                        const phoneNumber = e.target.value.replace(/[^0-9]/g, '')
                        setBookingData(prev => ({
                          ...prev,
                          customerInfo: {
                            ...prev.customerInfo,
                            phone: phoneNumber
                          }
                        }))
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={translate('전화번호를 입력하세요', 'Enter your phone number')}
                    />
                  </div>
                  {bookingData.customerInfo.country && bookingData.customerInfo.phone && (
                    <div className="mt-2 text-sm text-gray-600">
                      <span className="font-medium">{translate('전체 번호:', 'Full number:')}</span>{' '}
                      {countries.find(c => c.code === bookingData.customerInfo.country)?.phoneCode}
                      {bookingData.customerInfo.phone}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{translate('고객의 국가 언어 *', 'Customer\'s Native Language *')}</label>
                  <select
                    value={bookingData.customerInfo.customerLanguage}
                    onChange={(e) => {
                      setBookingData(prev => ({
                        ...prev,
                        customerInfo: {
                          ...prev.customerInfo,
                          customerLanguage: e.target.value
                        }
                      }))
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">{translate('언어를 선택하세요', 'Select your native language')}</option>
                    {allLanguages.map(language => (
                      <option key={language.code} value={language.code}>
                        {isEnglish ? language.nameEn : language.nameKo}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    {translate('고객님의 모국어를 선택해주세요', 'Please select your native language')}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{translate('선호 투어 언어 (복수 선택 가능)', 'Preferred Tour Languages (multiple selection)')}</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3">
                    {tourLanguages.map(language => (
                      <label key={language.code} className="flex items-center space-x-2 cursor-pointer p-2 rounded hover:bg-gray-50 transition-colors">
                        <input
                          type="checkbox"
                          checked={bookingData.customerInfo.tourLanguages.includes(language.code)}
                          onChange={(e) => {
                            const newLanguages = e.target.checked
                              ? [...bookingData.customerInfo.tourLanguages, language.code]
                              : bookingData.customerInfo.tourLanguages.filter(lang => lang !== language.code)
                            
                            setBookingData(prev => ({
                              ...prev,
                              customerInfo: {
                                ...prev.customerInfo,
                                tourLanguages: newLanguages
                              }
                            }))
                          }}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-900">{isEnglish ? language.nameEn : language.nameKo}</span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {translate('투어 중 원하시는 언어를 선택해주세요 (여러 개 선택 가능)', 'Select languages you prefer during the tour (multiple selection allowed)')}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{translate('특별 요청사항', 'Special Requests')}</label>
                  <textarea
                    value={bookingData.customerInfo.specialRequests}
                    onChange={(e) => {
                      setBookingData(prev => ({
                        ...prev,
                        customerInfo: {
                          ...prev.customerInfo,
                          specialRequests: e.target.value
                        }
                      }))
                    }}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={translate('특별 요청사항이 있다면 입력하세요', 'Let us know if you have any special requests')}
                  />
                </div>
              </div>
              
              {/* 로그인/회원가입 섹션 */}
              <div className="border-t border-gray-200 pt-4 mt-4">
                {!isAuthenticated ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800 mb-3">
                      {translate('회원으로 로그인하시면 정보를 자동으로 입력해드립니다.', 'Log in as a member to automatically fill in your information.')}
                    </p>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('login')
                          setShowAuthModal(true)
                        }}
                        className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        {translate('로그인', 'Log In')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('signup')
                          setShowAuthModal(true)
                        }}
                        className="flex-1 bg-white text-blue-600 border border-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium"
                      >
                        {translate('회원가입', 'Sign Up')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-green-800">
                          {translate('로그인됨', 'Logged in')}: {userEmail}
                        </p>
                        {bookingData.customerInfo.name && (
                          <p className="text-xs text-green-700 mt-1">
                            {translate('이름', 'Name')}: {bookingData.customerInfo.name}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="text-green-700 hover:text-green-900 text-sm font-medium"
                      >
                        {translate('로그아웃', 'Log Out')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{translate('결제 정보', 'Payment Details')}</h3>
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-gray-900 mb-3">{translate('예약 요약', 'Reservation Summary')}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">{translate('투어', 'Tour')}</span>
                    <span className="font-medium">{productDisplayName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{translate('날짜', 'Date')}</span>
                    <span className="font-medium">
                      {bookingData.tourDate && new Date(bookingData.tourDate).toLocaleDateString(localeTag)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{translate('인원', 'Guests')}</span>
                    <span className="font-medium">
                      {translate(`성인 ${bookingData.participants.adults}명`, `${bookingData.participants.adults} adult${bookingData.participants.adults === 1 ? '' : 's'}`)}
                      {bookingData.participants.children > 0 && `, ${translate(`아동 ${bookingData.participants.children}명`, `${bookingData.participants.children} child${bookingData.participants.children === 1 ? '' : 'ren'}`)}`}
                      {bookingData.participants.infants > 0 && `, ${translate(`유아 ${bookingData.participants.infants}명`, `${bookingData.participants.infants} infant${bookingData.participants.infants === 1 ? '' : 's'}`)}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{translate('기본 가격', 'Base price')}</span>
                    <span className="font-medium">${product.base_price}</span>
                  </div>
                  {(() => {
                    const allChoices = [...requiredChoices, ...optionalChoices]
                    return allChoices.map((group: ChoiceGroup) => {
                    const selectedOptionId = bookingData.selectedOptions[group.choice_id]
                    if (selectedOptionId) {
                      const option = group.options.find((opt: ChoiceOption) => opt.option_id === selectedOptionId)
                      if (option && option.option_price) {
                        return (
                          <div key={group.choice_id} className="flex justify-between">
                              <span className="text-gray-600">
                                {isEnglish ? group.choice_name || group.choice_name_ko : group.choice_name_ko || group.choice_name}
                                {group.is_required && <span className="text-red-500 ml-1">*</span>}
                              </span>
                            <span className="font-medium">+${option.option_price}</span>
                          </div>
                        )
                      }
                    }
                    return null
                    })
                  })()}
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-semibold text-lg">
                      <span>{translate('총 가격', 'Total price')}</span>
                      <span className="text-blue-600">${calculateTotalPrice()}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{translate('결제 방법', 'Payment method')}</label>
                  <select 
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="card">{translate('신용카드', 'Credit card')}</option>
                    <option value="bank_transfer">{translate('은행 이체', 'Bank transfer')}</option>
                    <option value="paypal">PayPal</option>
                  </select>
                </div>

                {/* 카드 정보 입력 폼 */}
                {paymentMethod === 'card' && (
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                      <CreditCard className="h-5 w-5 mr-2 text-gray-600" />
                      {translate('카드 정보', 'Card Information')}
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {translate('카드 번호', 'Card Number')} *
                        </label>
                        <input
                          type="text"
                          value={cardDetails.number}
                          onChange={(e) => {
                            let value = e.target.value.replace(/\s/g, '').replace(/\D/g, '')
                            if (value.length <= 16) {
                              value = value.match(/.{1,4}/g)?.join(' ') || value
                              setCardDetails(prev => ({ ...prev, number: value }))
                              setCardErrors(prev => ({ ...prev, number: '' }))
                            }
                          }}
                          placeholder="1234 5678 9012 3456"
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                            cardErrors.number ? 'border-red-500' : 'border-gray-300'
                          }`}
                          maxLength={19}
                        />
                        {cardErrors.number && (
                          <p className="text-xs text-red-500 mt-1">{cardErrors.number}</p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {translate('만료일', 'Expiry Date')} * (MM/YY)
                          </label>
                          <input
                            type="text"
                            value={cardDetails.expiry}
                            onChange={(e) => {
                              let value = e.target.value.replace(/\D/g, '')
                              if (value.length <= 4) {
                                if (value.length >= 2) {
                                  value = value.substring(0, 2) + '/' + value.substring(2)
                                }
                                setCardDetails(prev => ({ ...prev, expiry: value }))
                                setCardErrors(prev => ({ ...prev, expiry: '' }))
                              }
                            }}
                            placeholder="MM/YY"
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                              cardErrors.expiry ? 'border-red-500' : 'border-gray-300'
                            }`}
                            maxLength={5}
                          />
                          {cardErrors.expiry && (
                            <p className="text-xs text-red-500 mt-1">{cardErrors.expiry}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            CVV *
                          </label>
                          <input
                            type="text"
                            value={cardDetails.cvv}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '').substring(0, 4)
                              setCardDetails(prev => ({ ...prev, cvv: value }))
                              setCardErrors(prev => ({ ...prev, cvv: '' }))
                            }}
                            placeholder="123"
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                              cardErrors.cvv ? 'border-red-500' : 'border-gray-300'
                            }`}
                            maxLength={4}
                          />
                          {cardErrors.cvv && (
                            <p className="text-xs text-red-500 mt-1">{cardErrors.cvv}</p>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {translate('카드 소유자명', 'Cardholder Name')} *
                        </label>
                        <input
                          type="text"
                          value={cardDetails.name}
                          onChange={(e) => {
                            setCardDetails(prev => ({ ...prev, name: e.target.value }))
                            setCardErrors(prev => ({ ...prev, name: '' }))
                          }}
                          placeholder={translate('홍길동', 'John Doe')}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                            cardErrors.name ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                        {cardErrors.name && (
                          <p className="text-xs text-red-500 mt-1">{cardErrors.name}</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-start">
                        <Lock className="h-4 w-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                        <span className="text-xs text-blue-800">
                          {translate('모든 결제 정보는 SSL로 암호화되어 안전하게 전송됩니다.', 'All payment information is securely transmitted using SSL encryption.')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 은행 이체 안내 */}
                {paymentMethod === 'bank_transfer' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <CreditCard className="h-5 w-5 text-blue-600 mr-2" />
                      <span className="text-sm text-blue-800">
                        {translate('은행 이체 정보는 예약 확정 후 별도로 안내드립니다.', 'Bank transfer information will be sent separately after your reservation is confirmed.')}
                      </span>
                    </div>
                  </div>
                )}

                {/* PayPal 안내 */}
                {paymentMethod === 'paypal' && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <CreditCard className="h-5 w-5 text-yellow-600 mr-2" />
                      <span className="text-sm text-yellow-800">
                        {translate('PayPal 결제는 현재 준비 중입니다.', 'PayPal payment is currently being prepared.')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{translate('예약하기', 'Book this tour')}</h2>
              <p className="text-sm text-gray-600">{productDisplayName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* 진행 단계 */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon
              const isActive = index === currentStep
              const isCompleted = index < currentStep
              
              return (
                <div key={step.id} className="flex items-center">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                    isActive 
                      ? 'border-blue-500 bg-blue-500 text-white' 
                      : isCompleted 
                        ? 'border-green-500 bg-green-500 text-white'
                        : 'border-gray-300 text-gray-400'
                  }`}>
                    {isCompleted ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <span className={`ml-2 text-sm font-medium ${
                    isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    {step.title}
                  </span>
                  {index < steps.length - 1 && (
                    <div className={`w-8 h-0.5 mx-4 ${
                      isCompleted ? 'bg-green-500' : 'bg-gray-300'
                    }`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 콘텐츠 */}
        <div className="px-6 py-6 overflow-y-auto max-h-[60vh]">
          {renderStepContent()}
        </div>

        {/* 푸터 */}
        <div className="border-t border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                currentStep === 0
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {translate('이전', 'Back')}
            </button>

            {currentStep === steps.length - 1 ? (
              <button
                onClick={handleComplete}
                disabled={!isStepValid() || loading}
                className={`flex items-center px-6 py-2 rounded-lg font-medium transition-colors ${
                  isStepValid() && !loading
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {translate('처리 중...', 'Processing...')}
                  </>
                ) : (
                  translate('예약 완료', 'Complete booking')
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={!isStepValid()}
                className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
                  isStepValid()
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {translate('다음', 'Next')}
                <ArrowRight className="h-4 w-4 ml-2" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 인증 모달 */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {authMode === 'login' ? translate('로그인', 'Log In') : translate('회원가입', 'Sign Up')}
              </h3>
              <button
                onClick={() => setShowAuthModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              {authMode === 'login' ? (
                <LoginForm
                  onSuccess={handleAuthSuccess}
                  onSwitchToSignUp={() => setAuthMode('signup')}
                />
              ) : (
                <SignUpForm
                  onSuccess={handleAuthSuccess}
                  onSwitchToLogin={() => setAuthMode('login')}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

