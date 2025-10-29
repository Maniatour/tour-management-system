'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Calendar, Users, Clock, CreditCard, ShoppingCart, ArrowLeft, ArrowRight, Check, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLocale } from 'next-intl'

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
}

interface ChoiceOption {
  option_id: string
  option_name: string
  option_name_ko: string | null
  option_price: number | null
  is_default: boolean | null
}

interface ChoiceGroup {
  choice_id: string
  choice_name: string
  choice_name_ko: string | null
  choice_type: string
  choice_description: string | null
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
    tourLanguages: string[]
    specialRequests: string
  }
  uploaded_files: File[]
  uploaded_file_urls?: string[] // 업로드된 파일 URL들
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

// 투어 언어 옵션
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
        { id: 'date', title: 'Select Date', icon: Calendar },
        { id: 'participants', title: 'Guests', icon: Users },
        { id: 'required', title: 'Required Options', icon: Check },
        { id: 'optional', title: 'Optional Add-ons', icon: ShoppingCart },
        { id: 'customer', title: 'Guest Details', icon: Users },
        { id: 'payment', title: 'Payment', icon: CreditCard }
      ]
    : [
        { id: 'date', title: '날짜 선택', icon: Calendar },
        { id: 'participants', title: '인원 선택', icon: Users },
        { id: 'required', title: '필수 선택', icon: Check },
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
  
  // 파일 업로드 관련 상태
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

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
      tourLanguages: [],
      specialRequests: ''
    },
    uploaded_files: []
  })

  const productDisplayName = isEnglish
    ? product.customer_name_en || product.name_en || product.customer_name_ko || product.name
    : product.customer_name_ko || product.name

  // 투어 스케줄 로드 (매일 출발 가능, 고객은 모든 날짜 선택 가능)
  useEffect(() => {
    const loadTourSchedules = async () => {
      try {
        setLoading(true)
        
        // 1. 먼저 dynamic_pricing에서 해당 상품의 모든 날짜들을 조회 (is_sale_available 상태 포함)
        const { data: pricingData, error: pricingError } = await supabase
          .from('dynamic_pricing')
          .select('date, is_sale_available')
          .eq('product_id', product.id)
          .gte('date', new Date().toISOString().split('T')[0])
          .order('date', { ascending: true }) as { data: Array<{ date: string; is_sale_available: boolean }> | null, error: Error | null }

        if (pricingError) {
          console.error('Dynamic pricing 조회 오류:', pricingError)
        }

        // 마감된 날짜들 추출
        const closedDatesSet = new Set<string>()
        if (pricingData) {
          pricingData.forEach((item: { date: string; is_sale_available: boolean }) => {
            if (item.is_sale_available === false) {
              closedDatesSet.add(item.date)
            }
          })
        }
        
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
            is_default
          `)
          .eq('product_id', product.id)
          .eq('is_required', false) // 추가 선택만 가져오기

        if (error) {
          console.error('Product options 로드 오류:', error)
          return
        }

        setProductOptions(data || [])
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

  // 가격 계산
  const calculateTotalPrice = () => {
    let totalPrice = product.base_price || 0
    
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
    choice_name: option.name,
    choice_name_ko: option.name,
    choice_type: 'optional',
    choice_description: option.description,
    is_required: false,
    options: [{
      option_id: option.id,
      option_name: option.choice_name || option.name,
      option_name_ko: option.choice_name || option.name,
      option_price: option.adult_price_adjustment || 0,
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

  const handleComplete = async () => {
    // 전화번호를 국제 형식으로 변환하여 저장
    const fullPhoneNumber = getFullPhoneNumber()
    
    // 파일 업로드 처리
    let uploadedFileUrls: string[] = []
    if (bookingData.uploaded_files.length > 0) {
      setIsUploading(true)
      try {
        const uploadFormData = new FormData()
        uploadFormData.append('bucketType', 'ticket_bookings') // 기본적으로 입장권 부킹으로 설정
        bookingData.uploaded_files.forEach(file => {
          uploadFormData.append('files', file)
        })
        
        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: uploadFormData
        })
        
        if (uploadResponse.ok) {
          const uploadResult = await uploadResponse.json()
          uploadedFileUrls = uploadResult.urls
        } else {
          console.error('파일 업로드 실패')
        }
      } finally {
        setIsUploading(false)
      }
    }
    
    const finalBookingData = {
      ...bookingData,
      totalPrice: calculateTotalPrice(),
      customerInfo: {
        ...bookingData.customerInfo,
        phone: fullPhoneNumber
      },
      uploaded_file_urls: uploadedFileUrls // 업로드된 파일 URL들
    }
    onComplete(finalBookingData)
  }

  // 파일 업로드 핸들러
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setBookingData(prev => ({
      ...prev,
      uploaded_files: [...prev.uploaded_files, ...files]
    }))
  }

  // 파일 제거 핸들러
  const removeFile = (index: number) => {
    setBookingData(prev => ({
      ...prev,
      uploaded_files: prev.uploaded_files.filter((_, i) => i !== index)
    }))
  }

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    const validFiles = files.filter(file => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      return allowedTypes.includes(file.type) && file.size <= 10 * 1024 * 1024
    })
    
    if (validFiles.length !== files.length) {
      alert(translate('일부 파일이 지원되지 않는 형식이거나 크기가 너무 큽니다.', 'Some files are unsupported or exceed the size limit.'))
    }
    
    if (validFiles.length > 0) {
      setBookingData(prev => ({
        ...prev,
        uploaded_files: [...prev.uploaded_files, ...validFiles]
      }))
    }
  }

  // 클립보드 붙여넣기 핸들러
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const files: File[] = []
    
    items.forEach(item => {
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) {
          const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']
          if (allowedTypes.includes(file.type) && file.size <= 10 * 1024 * 1024) {
            files.push(file)
          }
        }
      }
    })
    
    if (files.length > 0) {
      setBookingData(prev => ({
        ...prev,
        uploaded_files: [...prev.uploaded_files, ...files]
      }))
    }
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

  const isStepValid = () => {
    switch (currentStep) {
      case 0: // 날짜 선택
        return bookingData.tourDate
      case 1: // 인원 선택
        return bookingData.participants.adults > 0
      case 2: // 필수 선택
        // 모든 필수 선택이 완료되었는지 확인
        return requiredChoices.every((group: ChoiceGroup) => {
          const selectedOption = bookingData.selectedOptions[group.choice_id]
          return selectedOption && selectedOption !== ''
        })
      case 3: // 추가 선택
        return true // 추가 선택은 선택사항
      case 4: // 고객 정보
        return bookingData.customerInfo.name && bookingData.customerInfo.email && bookingData.customerInfo.phone
      case 5: // 결제
        return true
      default:
        return false
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{translate('투어 날짜 선택', 'Select Tour Date')}</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-blue-800">
                      <strong>{translate('매일 출발 가능합니다!', 'Tours depart daily!')}</strong> {translate('원하시는 날짜를 선택하세요.', 'Pick the date that works best for you.')} 
                      {translate('4인 이상 확정 시 해당 날짜로 투어가 진행됩니다.', 'Departures are confirmed once four or more guests book the date.')}
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
                <div className="bg-white border border-gray-200 rounded-lg p-4">
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
                            {day.date.getDate()}
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
                  </div>
              )}
              
              {/* 선택된 날짜 정보 */}
              {selectedDate && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">{translate('선택된 날짜', 'Selected Date')}</h4>
                  <div className="text-sm text-gray-700">
                    <div className="font-medium">
                      {new Date(selectedDate).toLocaleDateString(localeTag, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        weekday: 'long'
                      })}
                    </div>
                    {bookingData.departureTime && (
                      <div className="mt-1 flex items-center text-gray-600">
                        <Clock className="h-4 w-4 mr-1" />
                        {translate('출발 시간', 'Departure time')}: {bookingData.departureTime}
                      </div>
                    )}
                    <div className="mt-1">
                      <span className="font-medium">{translate('상태', 'Status')}:</span>
                      {(() => {
                        const status = getDateStatus(new Date(selectedDate))
                        switch(status) {
                          case 'available':
                            return <span className="text-green-600 ml-1">{statusLabelMap.available}</span>
                          case 'recruiting':
                            return <span className="text-orange-600 ml-1">{statusLabelMap.recruiting}</span>
                          case 'confirmed':
                            return <span className="text-blue-600 ml-1">{statusLabelMap.confirmed}</span>
                          case 'almost_full':
                            return <span className="text-yellow-600 ml-1">{statusLabelMap.almost_full}</span>
                          case 'closed':
                            return <span className="text-red-600 ml-1">{statusLabelMap.closed}</span>
                          default:
                            return <span className="text-gray-600 ml-1">{statusLabelMap.unknown}</span>
                        }
                      })()}
                    </div>
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
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{translate('인원 선택', 'Select Participants')}</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900">{translate('성인', 'Adult')}</div>
                    <div className="text-sm text-gray-600">
                      {product.adult_age ? translate(`${product.adult_age}세 이상`, `${product.adult_age}+ years`) : translate('성인', 'Adult')}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
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
                      className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center font-medium">{bookingData.participants.adults}</span>
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
                      className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {product.child_age_min && product.child_age_max && (
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{translate('아동', 'Child')}</div>
                      <div className="text-sm text-gray-600">
                        {translate(`${product.child_age_min}-${product.child_age_max}세`, `${product.child_age_min}-${product.child_age_max} years`)}
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
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
                        className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <span className="w-8 text-center font-medium">{bookingData.participants.children}</span>
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
                        className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                {product.infant_age && (
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{translate('유아', 'Infant')}</div>
                      <div className="text-sm text-gray-600">
                        {translate(`${product.infant_age}세 미만`, `Under ${product.infant_age} years`)}
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
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
                        className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <span className="w-8 text-center font-medium">{bookingData.participants.infants}</span>
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
                        className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{translate('필수 선택', 'Required Options')}</h3>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-800">
                      <strong>{translate('필수 선택사항입니다!', 'These options are required!')}</strong> {translate('아래 옵션 중 하나를 반드시 선택해주세요.', 'Please choose at least one option below.')}
                    </p>
                  </div>
                </div>
              </div>
              
              {requiredChoices.length > 0 ? (
                <div className="space-y-4">
                  {requiredChoices.map((group: ChoiceGroup) => (
                    <div key={group.choice_id} className="border border-red-200 rounded-lg p-4 bg-red-50">
                      <div className="mb-3">
                        <h4 className="font-medium text-gray-900 flex items-center">
                          <span className="text-red-600 mr-2">*</span>
                          {isEnglish ? group.choice_name || group.choice_name_ko : group.choice_name_ko || group.choice_name}
                        </h4>
                        {group.choice_description && (
                          <p className="text-sm text-gray-600 mt-1">{group.choice_description}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        {group.options.map((option: ChoiceOption) => (
                          <label key={option.option_id} className="flex items-center space-x-3 cursor-pointer p-2 rounded hover:bg-white transition-colors">
                            <input
                              type="radio"
                              name={group.choice_id}
                              value={option.option_id}
                              checked={bookingData.selectedOptions[group.choice_id] === option.option_id}
                              onChange={(e) => {
                                setBookingData(prev => ({
                                  ...prev,
                                  selectedOptions: {
                                    ...prev.selectedOptions,
                                    [group.choice_id]: e.target.value
                                  }
                                }))
                              }}
                              className="w-4 h-4 text-red-600"
                              required
                            />
                            <div className="flex-1">
                              <span className="text-gray-900 font-medium">{isEnglish ? option.option_name || option.option_name_ko : option.option_name_ko || option.option_name}</span>
                              {option.option_price && (
                                <span className="text-red-600 font-medium ml-2">
                                  +${option.option_price}
                                </span>
                              )}
                              {option.is_default && (
                                <span className="text-xs text-gray-500 ml-2 bg-gray-200 px-2 py-1 rounded">{translate('기본', 'Default')}</span>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Check className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-600">{translate('필수 선택사항이 없습니다', 'There are no required options.')}</p>
                </div>
              )}
            </div>
          </div>
        )

      case 3:
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
                <div className="space-y-4">
                  {optionalChoices.map((group: ChoiceGroup) => (
                    <div key={group.choice_id} className="border border-gray-200 rounded-lg p-4">
                      <div className="mb-3">
                        <h4 className="font-medium text-gray-900">{isEnglish ? group.choice_name || group.choice_name_ko : group.choice_name_ko || group.choice_name}</h4>
                        {group.choice_description && (
                          <p className="text-sm text-gray-600 mt-1">{group.choice_description}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        {group.options.map((option: ChoiceOption) => (
                          <label key={option.option_id} className="flex items-center space-x-3 cursor-pointer p-2 rounded hover:bg-gray-50 transition-colors">
                            <input
                              type="radio"
                              name={group.choice_id}
                              value={option.option_id}
                              checked={bookingData.selectedOptions[group.choice_id] === option.option_id}
                              onChange={(e) => {
                                setBookingData(prev => ({
                                  ...prev,
                                  selectedOptions: {
                                    ...prev.selectedOptions,
                                    [group.choice_id]: e.target.value
                                  }
                                }))
                              }}
                              className="w-4 h-4 text-green-600"
                            />
                            <div className="flex-1">
                              <span className="text-gray-900">{isEnglish ? option.option_name || option.option_name_ko : option.option_name_ko || option.option_name}</span>
                              {option.option_price && option.option_price > 0 && (
                                <span className="text-green-600 font-medium ml-2">
                                  +${option.option_price}
                                </span>
                              )}
                              {option.is_default && (
                                <span className="text-xs text-gray-500 ml-2 bg-gray-200 px-2 py-1 rounded">{translate('기본', 'Default')}</span>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
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

      case 4:
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">{translate('투어 언어', 'Preferred Tour Language')}</label>
                  <div className="space-y-2">
                    {tourLanguages.map(language => (
                      <label key={language.code} className="flex items-center space-x-3 cursor-pointer">
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
                        <span className="text-gray-900">{translate(language.nameKo, language.nameEn)}</span>
                      </label>
                    ))}
                  </div>
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
              
              {/* 파일 업로드 섹션 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {translate('관련 문서 첨부 (선택사항)', 'Attach relevant documents (optional)')}
                </label>
                <div 
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
                    isUploading 
                      ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50' 
                      : isDragOver 
                        ? 'border-blue-500 bg-blue-100 scale-105 cursor-pointer' 
                        : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50 cursor-pointer'
                  }`}
                  onDragOver={!isUploading ? handleDragOver : undefined}
                  onDragEnter={!isUploading ? handleDragEnter : undefined}
                  onDragLeave={!isUploading ? handleDragLeave : undefined}
                  onDrop={!isUploading ? handleDrop : undefined}
                  onPaste={!isUploading ? handlePaste : undefined}
                  tabIndex={!isUploading ? 0 : -1}
                  onClick={!isUploading ? () => document.getElementById('booking_file_upload')?.click() : undefined}
                >
                  <div className="flex flex-col items-center space-y-2">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                      isUploading 
                        ? 'bg-blue-100' 
                        : isDragOver 
                          ? 'bg-blue-200' 
                          : 'bg-gray-100'
                    }`}>
                      {isUploading ? (
                        <div className="animate-spin">
                          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </div>
                      ) : isDragOver ? (
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className={`text-sm font-medium transition-colors ${
                        isDragOver ? 'text-blue-900' : 'text-gray-900'
                      }`}>
                      {isUploading 
                        ? translate('파일 업로드 중...', 'Uploading files...') 
                        : isDragOver 
                          ? translate('파일을 여기에 놓으세요', 'Drop files here') 
                          : translate('파일을 드래그하여 놓거나 클릭하여 선택하세요', 'Drag & drop files or click to browse')
                      }
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {translate('또는 클립보드에서 붙여넣기 (Ctrl+V)', 'Or paste from clipboard (Ctrl+V)')}
                      </p>
                    </div>
                    <div className="text-xs text-gray-400">
                      {translate('지원 형식: JPG, PNG, GIF, PDF, DOC, DOCX (최대 10MB)', 'Supported formats: JPG, PNG, GIF, PDF, DOC, DOCX (max 10MB)')}
                    </div>
                  </div>
                  
                  <input
                    id="booking_file_upload"
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  
                  {/* 업로드된 파일 목록 */}
                  {bookingData.uploaded_files.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-gray-200">
                      <h4 className="text-sm font-medium mb-3 text-gray-900">{translate(`업로드된 파일 (${bookingData.uploaded_files.length}개)`, `Uploaded files (${bookingData.uploaded_files.length})`)}</h4>
                      <div className="space-y-2">
                        {bookingData.uploaded_files.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-white border border-gray-200 p-3 rounded-lg hover:bg-gray-50">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                                {file.type.startsWith('image/') ? (
                                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{file.name}</p>
                                <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                removeFile(index)
                              }}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )

      case 5:
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
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="card">{translate('신용카드', 'Credit card')}</option>
                    <option value="bank_transfer">{translate('은행 이체', 'Bank transfer')}</option>
                    <option value="paypal">PayPal</option>
                  </select>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <CreditCard className="h-5 w-5 text-blue-600 mr-2" />
                    <span className="text-sm text-blue-800">
                      {translate('결제는 예약 확정 후 별도로 안내드립니다.', 'We will send separate payment instructions once your reservation is confirmed.')}
                    </span>
                  </div>
                </div>
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
            
            <div className="text-right">
              <div className="text-sm text-gray-600">{translate('총 가격', 'Total price')}</div>
              <div className="text-xl font-bold text-blue-600">${calculateTotalPrice()}</div>
            </div>

            {currentStep === steps.length - 1 ? (
              <button
                onClick={handleComplete}
                disabled={!isStepValid()}
                className={`flex items-center px-6 py-2 rounded-lg font-medium transition-colors ${
                  isStepValid()
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {translate('예약 완료', 'Complete booking')}
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
    </div>
  )
}

