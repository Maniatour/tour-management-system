'use client'

import React, { useState, useEffect } from 'react'
import { Calendar, Users, Clock, MapPin, CreditCard, ShoppingCart, ArrowLeft, ArrowRight, Check, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'

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
}

interface BookingFlowProps {
  product: Product
  productChoices: ProductChoice[]
  onClose: () => void
  onComplete: (bookingData: BookingData) => void
}

const steps = [
  { id: 'date', title: '날짜 선택', icon: Calendar },
  { id: 'participants', title: '인원 선택', icon: Users },
  { id: 'required', title: '필수 선택', icon: Check },
  { id: 'optional', title: '추가 선택', icon: ShoppingCart },
  { id: 'customer', title: '고객 정보', icon: Users },
  { id: 'payment', title: '결제', icon: CreditCard }
]

// 국가 목록
const countries = [
  { code: 'KR', name: '대한민국', phoneCode: '+82' },
  { code: 'US', name: '미국', phoneCode: '+1' },
  { code: 'JP', name: '일본', phoneCode: '+81' },
  { code: 'CN', name: '중국', phoneCode: '+86' },
  { code: 'TH', name: '태국', phoneCode: '+66' },
  { code: 'SG', name: '싱가포르', phoneCode: '+65' },
  { code: 'MY', name: '말레이시아', phoneCode: '+60' },
  { code: 'ID', name: '인도네시아', phoneCode: '+62' },
  { code: 'PH', name: '필리핀', phoneCode: '+63' },
  { code: 'VN', name: '베트남', phoneCode: '+84' },
  { code: 'AU', name: '호주', phoneCode: '+61' },
  { code: 'CA', name: '캐나다', phoneCode: '+1' },
  { code: 'GB', name: '영국', phoneCode: '+44' },
  { code: 'DE', name: '독일', phoneCode: '+49' },
  { code: 'FR', name: '프랑스', phoneCode: '+33' },
  { code: 'IT', name: '이탈리아', phoneCode: '+39' },
  { code: 'ES', name: '스페인', phoneCode: '+34' },
  { code: 'RU', name: '러시아', phoneCode: '+7' },
  { code: 'BR', name: '브라질', phoneCode: '+55' },
  { code: 'MX', name: '멕시코', phoneCode: '+52' },
  { code: 'IN', name: '인도', phoneCode: '+91' },
  { code: 'OTHER', name: '기타', phoneCode: '+' }
]

// 투어 언어 옵션
const tourLanguages = [
  { code: 'ko', name: '한국어' },
  { code: 'en', name: '영어' }
]

export default function BookingFlow({ product, productChoices, onClose, onComplete }: BookingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [tourSchedules, setTourSchedules] = useState<TourSchedule[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // 캘린더 관련 상태
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  
  // 추가 선택 옵션 상태
  const [productOptions, setProductOptions] = useState<any[]>([])
  const [loadingOptions, setLoadingOptions] = useState(false)
  
  // 예약 인원수 상태
  const [reservationCounts, setReservationCounts] = useState<Record<string, number>>({})
  
  // 마감된 날짜들 상태
  const [closedDates, setClosedDates] = useState<Set<string>>(new Set())

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
    }
  })

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
          .order('date', { ascending: true })

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
          .order('tour_date', { ascending: true })

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
        let finalSchedules: TourSchedule[] = []

        if (pricingData && pricingData.length > 0) {
          // Dynamic pricing에 날짜가 있으면 해당 날짜들 우선 표시
          console.log('Dynamic pricing에서 가져온 날짜들:', pricingData.map(item => item.date))
          
          const pricingDates = pricingData.map(item => item.date)
          const existingTourDates = (existingTours || []).map(tour => tour.tour_date)
          
          // Dynamic pricing 날짜들을 스케줄로 생성
          pricingDates.forEach(date => {
            const existingTour = existingTours?.find(tour => tour.tour_date === date)
            
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
                notes: 'Dynamic pricing 기반 - 4인 이상 확정 시 출발'
              })
            }
          })
          
          // Dynamic pricing에 없는 날짜들도 추가 (모든 날짜 선택 가능)
          const remainingDates = allDates.filter(date => !pricingDates.includes(date))
          remainingDates.forEach(date => {
            const existingTour = existingTours?.find(tour => tour.tour_date === date)
            
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
                notes: '매일 출발 가능 - 4인 이상 확정 시 출발'
              })
            }
          })
        } else {
          // Dynamic pricing에 날짜가 없으면 모든 날짜를 선택 가능하게 표시
          console.log('Dynamic pricing에 날짜가 없어 모든 날짜를 선택 가능하게 표시합니다.')
          
          allDates.forEach(date => {
            const existingTour = existingTours?.find(tour => tour.tour_date === date)
            
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
                notes: '매일 출발 가능 - 4인 이상 확정 시 출발'
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
  }, [product.id])

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
    allChoices.forEach((group) => {
      const selectedOptionId = bookingData.selectedOptions[group.choice_id]
      if (selectedOptionId) {
        const option = group.options.find((opt) => opt.option_id === selectedOptionId)
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
  }, {} as Record<string, any>)

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

  const handleComplete = () => {
    // 전화번호를 국제 형식으로 변환하여 저장
    const fullPhoneNumber = getFullPhoneNumber()
    const finalBookingData = {
      ...bookingData,
      totalPrice: calculateTotalPrice(),
      customerInfo: {
        ...bookingData.customerInfo,
        phone: fullPhoneNumber
      }
    }
    onComplete(finalBookingData)
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
        return requiredChoices.every((group: any) => {
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
              <h3 className="text-lg font-semibold text-gray-900 mb-2">투어 날짜 선택</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-blue-800">
                      <strong>매일 출발 가능합니다!</strong> 원하시는 날짜를 선택하세요. 
                      4인 이상 확정 시 해당 날짜로 투어가 진행됩니다.
                    </p>
                  </div>
                </div>
              </div>
              
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">투어 스케줄을 불러오는 중...</p>
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
                      {currentMonth.toLocaleDateString('ko-KR', { 
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
                    {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
                      <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* 캘린더 그리드 */}
                  <div className="grid grid-cols-7 gap-1">
                    {getDaysInMonth(currentMonth).map((day, index) => {
                      const schedule = getScheduleForDate(day.date)
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
                      예약 가능
                    </div>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-orange-500 rounded-full mr-1"></div>
                      동행 모집중
                    </div>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mr-1"></div>
                      출발 확정
                    </div>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full mr-1"></div>
                      마감 임박
                    </div>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-red-500 rounded-full mr-1"></div>
                      마감
                    </div>
                  </div>
                  </div>
              )}
              
              {/* 선택된 날짜 정보 */}
              {selectedDate && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">선택된 날짜</h4>
                  <div className="text-sm text-gray-700">
                    <div className="font-medium">
                      {new Date(selectedDate).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        weekday: 'long'
                      })}
                    </div>
                    {bookingData.departureTime && (
                      <div className="mt-1 flex items-center text-gray-600">
                        <Clock className="h-4 w-4 mr-1" />
                        출발 시간: {bookingData.departureTime}
                      </div>
                    )}
                    <div className="mt-1">
                      <span className="font-medium">상태:</span>
                      {(() => {
                        const status = getDateStatus(new Date(selectedDate))
                        switch(status) {
                          case 'available':
                            return <span className="text-green-600 ml-1">예약 가능</span>
                          case 'recruiting':
                            return <span className="text-orange-600 ml-1">동행 모집중</span>
                          case 'confirmed':
                            return <span className="text-blue-600 ml-1">출발 확정</span>
                          case 'almost_full':
                            return <span className="text-yellow-600 ml-1">마감 임박</span>
                          case 'closed':
                            return <span className="text-red-600 ml-1">마감</span>
                          default:
                            return <span className="text-gray-600 ml-1">알 수 없음</span>
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
              <h3 className="text-lg font-semibold text-gray-900 mb-4">인원 선택</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900">성인</div>
                    <div className="text-sm text-gray-600">
                      {product.adult_age ? `${product.adult_age}세 이상` : '성인'}
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
                      <div className="font-medium text-gray-900">아동</div>
                      <div className="text-sm text-gray-600">
                        {product.child_age_min}-{product.child_age_max}세
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
                      <div className="font-medium text-gray-900">유아</div>
                      <div className="text-sm text-gray-600">
                        {product.infant_age}세 미만
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
              <h3 className="text-lg font-semibold text-gray-900 mb-2">필수 선택</h3>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-800">
                      <strong>필수 선택사항입니다!</strong> 아래 옵션 중 하나를 반드시 선택해주세요.
                    </p>
                  </div>
                </div>
              </div>
              
              {requiredChoices.length > 0 ? (
                <div className="space-y-4">
                  {requiredChoices.map((group: any) => (
                    <div key={group.choice_id} className="border border-red-200 rounded-lg p-4 bg-red-50">
                      <div className="mb-3">
                        <h4 className="font-medium text-gray-900 flex items-center">
                          <span className="text-red-600 mr-2">*</span>
                          {group.choice_name_ko || group.choice_name}
                        </h4>
                        {group.choice_description && (
                          <p className="text-sm text-gray-600 mt-1">{group.choice_description}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        {group.options.map((option: any) => (
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
                              <span className="text-gray-900 font-medium">{option.option_name_ko || option.option_name}</span>
                              {option.option_price && (
                                <span className="text-red-600 font-medium ml-2">
                                  +${option.option_price}
                                </span>
                              )}
                              {option.is_default && (
                                <span className="text-xs text-gray-500 ml-2 bg-gray-200 px-2 py-1 rounded">기본</span>
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
                  <p className="text-gray-600">필수 선택사항이 없습니다</p>
                </div>
              )}
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">추가 선택</h3>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-green-800">
                      <strong>선택사항입니다!</strong> 원하시는 추가 옵션을 선택하세요. 선택하지 않아도 됩니다.
                    </p>
                  </div>
                </div>
              </div>
              
              {loadingOptions ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">추가 선택사항을 불러오는 중...</p>
                </div>
              ) : optionalChoices.length > 0 ? (
                <div className="space-y-4">
                  {optionalChoices.map((group: any) => (
                    <div key={group.choice_id} className="border border-gray-200 rounded-lg p-4">
                      <div className="mb-3">
                        <h4 className="font-medium text-gray-900">{group.choice_name_ko || group.choice_name}</h4>
                        {group.choice_description && (
                          <p className="text-sm text-gray-600 mt-1">{group.choice_description}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        {group.options.map((option: any) => (
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
                              <span className="text-gray-900">{option.option_name_ko || option.option_name}</span>
                              {option.option_price && option.option_price > 0 && (
                                <span className="text-green-600 font-medium ml-2">
                                  +${option.option_price}
                                </span>
                              )}
                              {option.is_default && (
                                <span className="text-xs text-gray-500 ml-2 bg-gray-200 px-2 py-1 rounded">기본</span>
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
                  <p className="text-gray-600">추가 선택사항이 없습니다</p>
                </div>
              )}
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">고객 정보</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
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
                    placeholder="이름을 입력하세요"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">이메일 *</label>
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
                    placeholder="이메일을 입력하세요"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">전화번호 *</label>
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
                      <option value="">국가</option>
                      {countries.map(country => (
                        <option key={country.code} value={country.code}>
                          {country.phoneCode} {country.name}
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
                      placeholder="전화번호를 입력하세요"
                    />
                  </div>
                  {bookingData.customerInfo.country && bookingData.customerInfo.phone && (
                    <div className="mt-2 text-sm text-gray-600">
                      <span className="font-medium">전체 번호:</span> 
                      {countries.find(c => c.code === bookingData.customerInfo.country)?.phoneCode}
                      {bookingData.customerInfo.phone}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">투어 언어</label>
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
                        <span className="text-gray-900">{language.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">특별 요청사항</label>
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
                    placeholder="특별 요청사항이 있다면 입력하세요"
                  />
                </div>
              </div>
            </div>
          </div>
        )

      case 5:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">결제 정보</h3>
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-gray-900 mb-3">예약 요약</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">투어</span>
                    <span className="font-medium">{product.customer_name_ko}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">날짜</span>
                    <span className="font-medium">
                      {bookingData.tourDate && new Date(bookingData.tourDate).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">인원</span>
                    <span className="font-medium">
                      성인 {bookingData.participants.adults}명
                      {bookingData.participants.children > 0 && `, 아동 ${bookingData.participants.children}명`}
                      {bookingData.participants.infants > 0 && `, 유아 ${bookingData.participants.infants}명`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">기본 가격</span>
                    <span className="font-medium">${product.base_price}</span>
                  </div>
                  {(() => {
                    const allChoices = [...requiredChoices, ...optionalChoices]
                    return allChoices.map((group: any) => {
                    const selectedOptionId = bookingData.selectedOptions[group.choice_id]
                    if (selectedOptionId) {
                      const option = group.options.find((opt: any) => opt.option_id === selectedOptionId)
                      if (option && option.option_price) {
                        return (
                          <div key={group.choice_id} className="flex justify-between">
                              <span className="text-gray-600">
                                {group.choice_name_ko || group.choice_name}
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
                      <span>총 가격</span>
                      <span className="text-blue-600">${calculateTotalPrice()}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">결제 방법</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="card">신용카드</option>
                    <option value="bank_transfer">은행 이체</option>
                    <option value="paypal">PayPal</option>
                  </select>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <CreditCard className="h-5 w-5 text-blue-600 mr-2" />
                    <span className="text-sm text-blue-800">
                      결제는 예약 확정 후 별도로 안내드립니다.
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
        {/* 헤더 */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">예약하기</h2>
              <p className="text-sm text-gray-600">{product.customer_name_ko}</p>
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
              이전
            </button>
            
            <div className="text-right">
              <div className="text-sm text-gray-600">총 가격</div>
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
                예약 완료
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
                다음
                <ArrowRight className="h-4 w-4 ml-2" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

