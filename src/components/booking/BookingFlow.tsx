'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Calendar, Users, CreditCard, ShoppingCart, ArrowLeft, ArrowRight, Check, X, ChevronLeft, ChevronRight, Lock, Ticket, Loader2, Minus, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLocale } from 'next-intl'
import LoginForm from '@/components/auth/LoginForm'
import SignUpForm from '@/components/auth/SignUpForm'
import Image from 'next/image'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { useCart } from '@/components/cart/CartProvider'

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
  option_image_url?: string | null
  option_thumbnail_url?: string | null
  option_description?: string | null
  option_description_ko?: string | null
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
  choice_description_ko?: string | null
  choice_description_en?: string | null
  choice_image_url?: string | null
  choice_thumbnail_url?: string | null
  option_id: string
  option_name: string
  option_name_ko: string | null
  option_price: number | null
  option_child_price?: number | null
  option_infant_price?: number | null
  is_default: boolean | null
  option_image_url?: string | null
  option_thumbnail_url?: string | null
  option_description?: string | null
  option_description_ko?: string | null
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

interface Coupon {
  id: string
  coupon_code: string | null
  discount_type: string | null
  percentage_value: number | null
  fixed_value: number | null
  status: string | null
  start_date: string | null
  end_date: string | null
  product_id: string | null
  channel_id: string | null
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

// Stripe Elements를 사용하는 결제 컴포넌트
interface BookingDataForPayment {
  customerInfo: {
    name: string
    email: string
  }
}

function PaymentForm({ 
  paymentMethod, 
  bookingData, 
  totalPrice, 
  onPaymentComplete, 
  translate,
  onPaymentSubmit
}: {
  paymentMethod: string
  bookingData: BookingDataForPayment
  totalPrice: number
  onPaymentComplete: (result: { success: boolean; transactionId?: string | null }) => Promise<void>
  translate: (ko: string, en: string) => string
  onPaymentSubmit?: (submitHandler: () => Promise<void>) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [cardError, setCardError] = useState<string>('')
  const [processing, setProcessing] = useState(false)
  const handleSubmitRef = React.useRef<(() => Promise<void>) | null>(null)
  const onPaymentSubmitRef = React.useRef(onPaymentSubmit)

  const handleSubmit = React.useCallback(async (event?: React.FormEvent) => {
    if (event) {
      event.preventDefault()
    }

    if (!stripe || !elements) {
      return
    }

    setProcessing(true)
    setCardError('')

    const cardElement = elements.getElement(CardElement)
    if (!cardElement) {
      setCardError(translate('카드 정보를 불러올 수 없습니다.', 'Unable to load card information.'))
      setProcessing(false)
      return
    }

    // Payment Intent 생성
    try {
      const reservationId = `reservation_${Date.now()}_${Math.random().toString(36).substring(2)}`
      
      const response = await fetch('/api/payment/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: totalPrice,
          currency: 'usd',
          reservationId: reservationId,
          customerInfo: {
            name: bookingData.customerInfo.name,
            email: bookingData.customerInfo.email
          }
        })
      })

      if (!response.ok) {
        let errorMessage = translate('결제 요청 생성에 실패했습니다.', 'Failed to create payment request.')
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (e) {
          // JSON 파싱 실패 시 텍스트로 읽기 시도
          try {
            const text = await response.text()
            errorMessage = text || errorMessage
          } catch (textError) {
            // 텍스트 읽기도 실패하면 기본 메시지 사용
            errorMessage = `서버 오류 (${response.status}): ${response.statusText}`
          }
        }
        throw new Error(errorMessage)
      }

      const { clientSecret } = await response.json()

      if (!clientSecret) {
        throw new Error(
          translate(
            '결제 시크릿을 받지 못했습니다. 서버 설정을 확인해주세요.',
            'Failed to receive payment secret. Please check server configuration.'
          )
        )
      }

      // Stripe Elements로 결제 확인
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: bookingData.customerInfo.name,
            email: bookingData.customerInfo.email,
          },
        },
      })

      if (error) {
        setCardError(error.message || translate('결제에 실패했습니다.', 'Payment failed.'))
        setProcessing(false)
        return
      }

      if (paymentIntent?.status === 'succeeded') {
        await onPaymentComplete({
          success: true,
          transactionId: paymentIntent.id
        })
      } else {
        throw new Error(translate('결제가 완료되지 않았습니다.', 'Payment was not completed.'))
      }
    } catch (error) {
      console.error('Stripe 결제 처리 오류:', error)
      setCardError(error instanceof Error ? error.message : translate('결제 처리 중 오류가 발생했습니다.', 'An error occurred during payment processing.'))
      setProcessing(false)
    }
  }, [stripe, elements, totalPrice, bookingData, onPaymentComplete, translate])

  // 외부에서 제출할 수 있도록 핸들러 노출
  // handleSubmit이 변경될 때마다 ref 업데이트
  useEffect(() => {
    handleSubmitRef.current = handleSubmit
  }, [handleSubmit])

  // onPaymentSubmit을 ref로 저장
  useEffect(() => {
    onPaymentSubmitRef.current = onPaymentSubmit
  }, [onPaymentSubmit])

  // onPaymentSubmit 호출을 완전히 분리하여 렌더링 완료 후 실행
  // handleSubmit은 의존성 배열에서 제거하고 ref를 통해 접근
  // 한 번만 실행되도록 플래그 사용
  const hasRegisteredHandler = React.useRef(false)
  
  useEffect(() => {
    // 이미 등록되었거나 필요한 조건이 없으면 리턴
    if (hasRegisteredHandler.current || !onPaymentSubmit || !stripe || !elements) {
      return
    }

    // 여러 단계의 지연을 사용하여 렌더링 완료 보장
    const timeoutId1 = setTimeout(() => {
      requestAnimationFrame(() => {
        const timeoutId2 = setTimeout(() => {
          // onPaymentSubmit을 호출하기 전에 한 번 더 확인
          // handleSubmit은 ref를 통해 접근하므로 항상 최신 버전 사용
          if (onPaymentSubmitRef.current && !hasRegisteredHandler.current) {
            try {
              hasRegisteredHandler.current = true
              onPaymentSubmitRef.current(async () => {
                // ref를 통해 항상 최신 handleSubmit에 접근
                if (handleSubmitRef.current) {
                  await handleSubmitRef.current()
                }
              })
            } catch (error) {
              // 에러가 발생해도 무한 루프를 방지
              hasRegisteredHandler.current = false
              console.error('Payment submit handler error:', error)
            }
          }
        }, 0)
      })
    }, 0)

    return () => {
      clearTimeout(timeoutId1)
    }
  }, [onPaymentSubmit, stripe, elements])

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
      invalid: {
        color: '#9e2146',
      },
    },
  }

  if (paymentMethod !== 'card') {
    return null
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <h4 className="font-medium text-gray-900 mb-4 flex items-center">
          <CreditCard className="h-5 w-5 mr-2 text-gray-600" />
          {translate('카드 정보', 'Card Information')}
        </h4>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {translate('카드 정보', 'Card Details')} *
            </label>
            <div className="px-3 py-2 border border-gray-300 rounded-lg bg-white">
              <CardElement options={cardElementOptions} />
            </div>
            {cardError && (
              <p className="text-xs text-red-500 mt-1">{cardError}</p>
            )}
          </div>
        </div>
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-start">
            <Lock className="h-4 w-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
            <span className="text-xs text-blue-800">
              {translate('카드 정보는 Stripe를 통해 안전하게 처리됩니다. 서버에 저장되지 않습니다.', 'Card information is securely processed through Stripe. It is not stored on our servers.')}
            </span>
          </div>
        </div>
      </div>
    </form>
  )
}

export default function BookingFlow({ product, productChoices, onClose, onComplete }: BookingFlowProps) {
  const locale = useLocale()
  const isEnglish = locale === 'en'
  const translate = useCallback((ko: string, en: string) => (isEnglish ? en : ko), [isEnglish])
  const localeTag = isEnglish ? 'en-US' : 'ko-KR'
  const dayNames = isEnglish ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['일', '월', '화', '수', '목', '금', '토']
  
  // 장바구니 훅
  const cart = useCart()
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
        { id: 'required', title: 'Required Options', icon: Ticket },
        { id: 'optional', title: 'Optional Add-ons', icon: ShoppingCart },
        { id: 'customer', title: 'Guest Details', icon: Users },
        { id: 'payment', title: 'Payment', icon: CreditCard }
      ]
    : [
        { id: 'booking', title: '예약 정보', icon: Calendar },
        { id: 'required', title: '필수 선택', icon: Ticket },
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
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null)

  // 쿠폰 관련 상태
  const [couponCode, setCouponCode] = useState<string>('')
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null)
  const [couponError, setCouponError] = useState<string>('')
  const [validatingCoupon, setValidatingCoupon] = useState(false)

  // PaymentForm의 handleSubmit 저장
  const [paymentSubmitHandler, setPaymentSubmitHandler] = useState<(() => Promise<void>) | null>(null)
  const [paymentProcessing, setPaymentProcessing] = useState(false)

  // Stripe 초기화
  useEffect(() => {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    if (publishableKey) {
      // Stripe 로딩 시 에러 처리 및 옵션 추가
      const stripePromiseValue = loadStripe(publishableKey, {
        // Stripe.js 로딩 최적화 옵션
        locale: isEnglish ? 'en' : 'ko',
      })
      
      // Promise에 에러 핸들러 추가
      stripePromiseValue.catch((error) => {
        console.error('Stripe 로딩 오류:', error)
        // 에러가 발생해도 계속 진행 (사용자에게 알림)
      })
      
      setStripePromise(stripePromiseValue)
    }
  }, [isEnglish])

  // locale에 따른 기본값 설정
  const getDefaultCustomerInfo = () => {
    if (locale === 'ko') {
      return {
        country: 'KR', // 대한민국
        customerLanguage: 'ko', // 한국어
        tourLanguages: ['ko'] // 한국어
      }
    } else {
      return {
        country: 'US', // 미국
        customerLanguage: 'en', // 영어
        tourLanguages: ['en'] // 영어
      }
    }
  }

  const defaultCustomerInfo = getDefaultCustomerInfo()

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
      country: defaultCustomerInfo.country,
      customerLanguage: defaultCustomerInfo.customerLanguage,
      tourLanguages: defaultCustomerInfo.tourLanguages,
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
          console.log('Dynamic pricing에서 가져온 날짜들:', pricingData.map((item: { date: string }) => item.date))
          
          const pricingDates = pricingData.map((item: { 
            date: string
            is_sale_available: boolean
            adult_price: number
            child_price: number
            infant_price: number
            choices_pricing?: Record<string, { is_sale_available?: boolean }>
          }) => item.date)
          
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
  }, [product.id, product.max_participants, product.base_price, translate])

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
            .map((opt: ProductOption) => opt.linked_option_id)
            .filter((id): id is string => id !== null && id !== undefined)
          
          const optionsData: Record<string, {
            id: string
            name: string
            name_ko: string | null
            name_en: string | null
            description: string | null
            description_ko: string | null
            description_en: string | null
            image_url: string | null
            thumbnail_url: string | null
            adult_price: number | null
            child_price: number | null
            infant_price: number | null
          }> = {}
          
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
              options.forEach((opt: {
                id: string
                name: string
                name_ko: string | null
                name_en: string | null
                description: string | null
                description_ko: string | null
                description_en: string | null
                image_url: string | null
                thumbnail_url: string | null
                adult_price: number | null
                child_price: number | null
                infant_price: number | null
              }) => {
                optionsData[opt.id] = opt
              })
            }
          }
          
          // product_options 데이터에 options 정보 병합
          const enrichedData = data.map((po: ProductOption) => ({
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

  // 필수 선택: productChoices에서 필수인 것들 (현재 추가 선택에 있던 내용을 필수로 이동)
  const groupedChoices = productChoices.reduce((groups, choice) => {
    const groupKey = choice.choice_id
    if (!groups[groupKey]) {
      // 같은 choice_id를 가진 모든 항목 중에서 설명이 있는 항목 찾기
      const choiceWithDescription = productChoices.find(c => 
        c.choice_id === choice.choice_id && 
        (c.choice_description_ko || c.choice_description_en || c.choice_description)
      ) || choice
      
      groups[groupKey] = {
        choice_id: choice.choice_id,
        choice_name: choice.choice_name,
        choice_name_ko: choice.choice_name_ko,
        choice_name_en: (choice as any).choice_name_en || null,
        choice_type: choice.choice_type,
        choice_description: choiceWithDescription.choice_description || null,
        choice_description_ko: choiceWithDescription.choice_description_ko || null,
        choice_description_en: choiceWithDescription.choice_description_en || null,
        choice_image_url: choice.choice_image_url || null,
        choice_thumbnail_url: choice.choice_thumbnail_url || null,
        is_required: true, // 모든 productChoices를 필수로 설정
        options: []
      }
    }
    groups[groupKey].options.push({
      option_id: choice.option_id,
      option_name: choice.option_name,
      option_name_ko: choice.option_name_ko,
      option_price: choice.option_price,
      option_child_price: choice.option_child_price || null,
      option_infant_price: choice.option_infant_price || null,
      is_default: choice.is_default,
      option_image_url: choice.option_image_url || null,
      option_thumbnail_url: choice.option_thumbnail_url || null,
      option_description: choice.option_description || null,
      option_description_ko: choice.option_description_ko || null
    })
    return groups
  }, {} as Record<string, ChoiceGroup>)

  // 필수 선택: productChoices의 모든 내용
  const requiredChoices = Object.values(groupedChoices)
  
  // 디버깅: productChoices와 requiredChoices 확인
  useEffect(() => {
    if (productChoices.length > 0) {
      console.log('BookingFlow - productChoices:', productChoices)
      const currentGroupedChoices = productChoices.reduce((groups, choice) => {
        const groupKey = choice.choice_id
        if (!groups[groupKey]) {
          groups[groupKey] = {
            choice_id: choice.choice_id,
            choice_name: choice.choice_name,
            choice_name_ko: choice.choice_name_ko,
            choice_type: choice.choice_type,
            choice_description: choice.choice_description || null,
            choice_description_ko: choice.choice_description_ko || null,
            choice_description_en: choice.choice_description_en || null,
            choice_image_url: choice.choice_image_url || null,
            choice_thumbnail_url: choice.choice_thumbnail_url || null,
            is_required: true,
            options: []
          }
        }
        groups[groupKey].options.push({
          option_id: choice.option_id,
          option_name: choice.option_name,
          option_name_ko: choice.option_name_ko,
          option_price: choice.option_price,
          option_child_price: choice.option_child_price || null,
          option_infant_price: choice.option_infant_price || null,
          is_default: choice.is_default,
          option_image_url: choice.option_image_url || null,
          option_thumbnail_url: choice.option_thumbnail_url || null,
          option_description: choice.option_description || null,
          option_description_ko: choice.option_description_ko || null
        })
        return groups
      }, {} as Record<string, ChoiceGroup>)
      const currentRequiredChoices = Object.values(currentGroupedChoices)
      console.log('BookingFlow - groupedChoices:', currentGroupedChoices)
      console.log('BookingFlow - requiredChoices:', currentRequiredChoices)
    } else {
      console.log('BookingFlow - productChoices가 비어있습니다. productChoices:', productChoices)
    }
  }, [productChoices])
  
  // 추가 선택: product_options 테이블에서 가져온 내용
  const optionalChoices: ChoiceGroup[] = productOptions.map(option => ({
    choice_id: option.id,
    choice_name: isEnglish ? (option.option_name_en || option.option_name || option.name) : (option.option_name_ko || option.option_name || option.name),
    choice_name_ko: option.option_name_ko || option.option_name || option.name,
    choice_name_en: option.option_name_en || option.option_name || option.name,
    choice_type: 'optional',
    choice_description: isEnglish ? (option.option_description_en || option.option_description || option.description) : (option.option_description_ko || option.option_description || option.description),
    choice_description_ko: option.option_description_ko || option.option_description || option.description || null,
    choice_description_en: option.option_description_en || option.option_description || option.description || null,
    choice_image_url: option.option_image_url || option.option_thumbnail_url || null,
    choice_thumbnail_url: option.option_thumbnail_url || option.option_image_url || null,
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
    const basePrice = product.base_price || 0
    
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

  // 쿠폰 할인 계산 함수
  const calculateCouponDiscount = useCallback((coupon: Coupon | null, subtotal: number) => {
    if (!coupon) return 0
    
    if (coupon.discount_type === 'percentage' && coupon.percentage_value) {
      return (subtotal * (Number(coupon.percentage_value) || 0)) / 100
    } else if (coupon.discount_type === 'fixed' && coupon.fixed_value) {
      return Number(coupon.fixed_value) || 0
    }
    
    return 0
  }, [])

  // 쿠폰 검증 및 적용 함수
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError(translate('쿠폰 코드를 입력해주세요.', 'Please enter a coupon code.'))
      return
    }

    setValidatingCoupon(true)
    setCouponError('')

    try {
      const response = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          couponCode: couponCode.toUpperCase(),
          productId: product.id,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.valid) {
        setCouponError(data.message || translate('유효하지 않은 쿠폰입니다.', 'Invalid coupon code.'))
        setAppliedCoupon(null)
        return
      }

      setAppliedCoupon(data.coupon)
      setCouponError('')
    } catch (error) {
      console.error('쿠폰 검증 오류:', error)
      setCouponError(translate('쿠폰 검증 중 오류가 발생했습니다.', 'An error occurred while validating the coupon.'))
      setAppliedCoupon(null)
    } finally {
      setValidatingCoupon(false)
    }
  }

  // 쿠폰 제거 함수
  const handleRemoveCoupon = () => {
    setAppliedCoupon(null)
    setCouponCode('')
    setCouponError('')
  }

  // 쿠폰 할인이 적용된 최종 가격 계산
  const calculateFinalPrice = () => {
    const subtotal = calculateTotalPrice()
    const discount = appliedCoupon ? calculateCouponDiscount(appliedCoupon, subtotal) : 0
    return Math.max(0, subtotal - discount)
  }

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

  // 장바구니에 추가
  const handleAddToCart = () => {
    try {
      const fullPhoneNumber = getFullPhoneNumber()
      const totalPrice = calculateTotalPrice()
      
      // 고객 정보 검증
      const { name, email, phone, country, customerLanguage } = bookingData.customerInfo
      if (!name || !email || !phone || !country || !customerLanguage) {
        alert(isEnglish 
          ? 'Please complete customer information before adding to cart.' 
          : '장바구니에 추가하기 전에 고객 정보를 완성해주세요.')
        return
      }

      // 예약 정보 검증
      if (!bookingData.tourDate || bookingData.participants.adults === 0) {
        alert(isEnglish 
          ? 'Please select a tour date and at least one adult participant.' 
          : '투어 날짜와 최소 1명의 성인을 선택해주세요.')
        return
      }

      // CartProvider 확인
      if (!cart || !cart.addItem) {
        console.error('CartProvider가 제대로 초기화되지 않았습니다.')
        alert(isEnglish 
          ? 'Cart system error. Please refresh the page.' 
          : '장바구니 시스템 오류가 발생했습니다. 페이지를 새로고침해주세요.')
        return
      }

      // 선택된 초이스 상세 정보 생성
      const selectedChoices: Array<{
        choiceId: string
        choiceName: string
        choiceNameKo: string | null
        choiceNameEn: string | null
        optionId: string
        optionName: string
        optionNameKo: string | null
        optionNameEn: string | null
        optionPrice: number | null
      }> = []

      // 필수 선택에서 선택된 항목 찾기
      requiredChoices.forEach((group) => {
        const selectedOptionId = bookingData.selectedOptions[group.choice_id]
        if (selectedOptionId) {
          const selectedOption = group.options.find((opt) => opt.option_id === selectedOptionId)
          if (selectedOption) {
            selectedChoices.push({
              choiceId: group.choice_id,
              choiceName: group.choice_name,
              choiceNameKo: group.choice_name_ko,
              choiceNameEn: group.choice_name_en || null,
              optionId: selectedOption.option_id,
              optionName: selectedOption.option_name,
              optionNameKo: selectedOption.option_name_ko,
              optionNameEn: selectedOption.option_name_en || null,
              optionPrice: selectedOption.option_price
            })
          }
        }
      })

      // 추가 선택에서 선택된 항목 찾기
      optionalChoices.forEach((group) => {
        const selectedOptionId = bookingData.selectedOptions[group.choice_id]
        if (selectedOptionId) {
          const selectedOption = group.options.find((opt) => opt.option_id === selectedOptionId)
          if (selectedOption) {
            selectedChoices.push({
              choiceId: group.choice_id,
              choiceName: group.choice_name,
              choiceNameKo: group.choice_name_ko,
              choiceNameEn: group.choice_name_en || null,
              optionId: selectedOption.option_id,
              optionName: selectedOption.option_name,
              optionNameKo: selectedOption.option_name_ko,
              optionNameEn: selectedOption.option_name_en || null,
              optionPrice: selectedOption.option_price
            })
          }
        }
      })

      // 장바구니에 추가할 아이템 생성
      const cartItem = {
        productId: product.id,
        productName: product.name,
        productNameKo: product.customer_name_ko || product.name_ko || product.name,
        productNameEn: product.customer_name_en || product.name_en || product.name,
        tourDate: bookingData.tourDate,
        departureTime: bookingData.departureTime || '',
        participants: bookingData.participants,
        selectedOptions: bookingData.selectedOptions,
        selectedChoices: selectedChoices,
        basePrice: product.base_price || 0,
        totalPrice: totalPrice,
        customerInfo: {
          name: bookingData.customerInfo.name,
          email: bookingData.customerInfo.email,
          phone: fullPhoneNumber,
          nationality: bookingData.customerInfo.country || '',
          specialRequests: bookingData.customerInfo.specialRequests || ''
        }
      }

      console.log('장바구니에 추가할 아이템:', cartItem)
      
      // 장바구니에 추가
      cart.addItem(cartItem)

      console.log('장바구니에 추가 완료. 현재 장바구니 아이템 수:', cart.items?.length || 0)

      alert(isEnglish 
        ? 'Item added to cart successfully!' 
        : '장바구니에 추가되었습니다!')
      onClose()
    } catch (error) {
      console.error('장바구니 추가 오류:', error)
      alert(isEnglish 
        ? `Failed to add item to cart: ${error instanceof Error ? error.message : 'Unknown error'}` 
        : `장바구니 추가 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }

  // 결제 완료 핸들러 (PaymentForm에서 호출)
  const handlePaymentComplete = async (result: { success: boolean; transactionId?: string | null }) => {
    // 결제가 성공하면 예약 생성 진행
    if (result.success) {
      await handleCompleteBooking(result.transactionId)
    }
  }

  // 예약 생성 (결제 완료 후)
  const handleCompleteBooking = async (transactionId: string | null | undefined) => {
    try {
      setLoading(true)
      
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
        choices_total: 0,
        status: transactionId ? 'confirmed' : 'pending',
        notes: bookingData.customerInfo.specialRequests || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // 2. 예약 생성
      const { error: reservationError } = await supabase
        .from('reservations')
        .insert(reservationData as never)

      if (reservationError) {
        throw new Error(`예약 생성 오류: ${reservationError.message}`)
      }

      // 3. 선택된 필수/선택 옵션들을 저장
      const choicesToInsert: Array<{
        reservation_id: string
        choice_id: string
        option_id: string
        quantity: number
        total_price: number
      }> = []
      let choicesTotal = 0

      // 필수 선택 (productChoices)
      requiredChoices.forEach((group) => {
        const selectedOptionId = bookingData.selectedOptions[group.choice_id]
        if (selectedOptionId) {
          const option = group.options.find((opt: ChoiceOption) => opt.option_id === selectedOptionId)
          if (option) {
            const totalParticipants = bookingData.participants.adults + bookingData.participants.children + bookingData.participants.infants
            const optionPrice = option.option_price || 0
            const totalPrice = optionPrice * totalParticipants
            
            choicesToInsert.push({
              reservation_id: reservationId,
              choice_id: group.choice_id,
              option_id: selectedOptionId,
              quantity: totalParticipants,
              total_price: totalPrice
            })
            
            choicesTotal += totalPrice
          }
        }
      })

      // 추가 선택 (productOptions)
      const optionsToInsert: Array<{
        reservation_id: string
        option_id: string
        ea: number
        price: number
        total_price: number
        status: string
      }> = []
      optionalChoices.forEach((group) => {
        const selectedOptionId = bookingData.selectedOptions[group.choice_id]
        if (selectedOptionId) {
          const productOption = productOptions.find(po => po.id === selectedOptionId)
          const option = group.options.find((opt: ChoiceOption) => opt.option_id === selectedOptionId)
          
          if (option && productOption) {
            const totalParticipants = bookingData.participants.adults + bookingData.participants.children + bookingData.participants.infants
            const optionPrice = option.option_price || 0
            const totalPrice = optionPrice * totalParticipants
            
            optionsToInsert.push({
              reservation_id: reservationId,
              option_id: selectedOptionId,
              ea: totalParticipants,
              price: optionPrice,
              total_price: totalPrice,
              status: 'confirmed'
            })
          }
        }
      })

      // reservation_options에 삽입
      if (optionsToInsert.length > 0) {
        const { error: optionsError } = await supabase
          .from('reservation_options')
          .insert(optionsToInsert as never)

        if (optionsError) {
          console.error('예약 추가 선택 상품 저장 오류:', optionsError)
        }
      }

      // reservation_choices에 삽입
      if (choicesToInsert.length > 0) {
        const { error: choicesError } = await supabase
          .from('reservation_choices')
          .insert(choicesToInsert as never)

        if (choicesError) {
          console.error('예약 선택사항 저장 오류:', choicesError)
        }
      }

      // choices_total 업데이트
      if (choicesTotal > 0) {
        await supabase
          .from('reservations')
          .update({ choices_total: choicesTotal } as never)
          .eq('id', reservationId)
      }

      // 결제 기록 생성
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
                payment_status: 'confirmed',
                amount: totalPrice,
                payment_method: paymentMethod,
                note: transactionId ? `Transaction ID: ${transactionId}` : null
              })
            })
          }
        } catch (error) {
          console.error('결제 기록 생성 오류:', error)
        }
      }

      const finalBookingData = {
        ...bookingData,
        totalPrice: totalPrice,
        customerInfo: {
          ...bookingData.customerInfo,
          phone: fullPhoneNumber
        }
      }

      // 이메일 발송 (결제 완료 시)
      if (paymentMethod === 'card' && transactionId) {
        try {
          await fetch('/api/send-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              reservationId: reservationId,
              email: bookingData.customerInfo.email,
              type: 'both', // 영수증과 투어 바우처 모두 발송
              locale: isEnglish ? 'en' : 'ko'
            })
          }).catch(error => {
            console.error('이메일 발송 오류 (무시):', error)
            // 이메일 발송 실패해도 예약은 완료된 것으로 처리
          })
        } catch (error) {
          console.error('이메일 발송 오류 (무시):', error)
        }
      }

      // 성공 메시지 표시
      if (paymentMethod === 'card' && transactionId) {
        alert(isEnglish 
          ? `Payment successful! Your reservation has been confirmed. Receipt and tour voucher have been sent to ${bookingData.customerInfo.email}. Reservation ID: ${reservationId}` 
          : `결제가 완료되었습니다! 예약이 확정되었습니다. 영수증과 투어 바우처가 ${bookingData.customerInfo.email}로 발송되었습니다. 예약 ID: ${reservationId}`)
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

  const handleComplete = async () => {
    // 카드 결제는 PaymentForm에서 처리하므로, 여기서는 은행 이체만 처리
    if (paymentMethod === 'card') {
      // PaymentForm에서 결제가 완료되면 handlePaymentComplete가 호출됨
      // 여기서는 아무것도 하지 않음
      return
    }

    // 은행 이체인 경우
    try {
      setLoading(true)
      await handleCompleteBooking(null)
    } catch (error) {
      console.error('예약 생성 오류:', error)
      alert(isEnglish 
        ? `Failed to create reservation: ${error instanceof Error ? error.message : 'Unknown error'}` 
        : `예약 생성에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    } finally {
      setLoading(false)
    }
  }

  // 기존 예약 생성 로직은 handleCompleteBooking으로 이동됨

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
      case 0: // 날짜만
        return bookingData.tourDate !== null && bookingData.tourDate !== ''
      case 1: // 필수 선택 + 인원
        return bookingData.participants.adults > 0 &&
               requiredChoices.every((group: ChoiceGroup) => {
                 const selectedOption = bookingData.selectedOptions[group.choice_id]
                 return selectedOption && selectedOption !== ''
               })
      case 2: // 추가 선택
        return true // 추가 선택은 선택사항
      case 3: // 고객 정보
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
      case 4: // 결제
        // Stripe Elements가 자동으로 카드 정보를 검증하므로 여기서는 항상 true
        // 카드 결제는 PaymentForm에서 처리
        return true
      default:
        return false
    }
  }, [currentStep, bookingData, requiredChoices])

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
                      <strong>{translate('매일 출발 가능합니다!', 'Tours depart daily!')}</strong> {translate('날짜를 선택해주세요.', 'Please select a date.')}
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
                <div className="flex justify-center">
                  {/* 달력 */}
                  <div className="w-full max-w-2xl">
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
                  
                  {/* 선택된 날짜 정보 */}
                  <div className="mt-auto pt-4">
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
                  </div>
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
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{translate('필수 선택', 'Required Options')}</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-blue-800">
                      <strong>{translate('필수 선택입니다!', 'These are required!')}</strong> {translate('초이스와 인원을 선택해주세요.', 'Please select your choice and number of participants.')}
                    </p>
                  </div>
                </div>
              </div>
              
              {requiredChoices.length > 0 ? (
                <div className="space-y-6">
                  {/* 인원 선택 - 상단 가로 배치 */}
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 className="text-base font-semibold text-gray-900 mb-4">{translate('인원 선택', 'Select Participants')}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                            <Minus className="h-3 w-3" />
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
                            <Plus className="h-3 w-3" />
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
                              <Minus className="h-3 w-3" />
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
                              <Plus className="h-3 w-3" />
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
                              <Minus className="h-3 w-3" />
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
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 초이스 그룹들 */}
                  <div className="space-y-6">
                  {requiredChoices.map((group: ChoiceGroup, groupIndex: number) => {
                    const groupDescription = isEnglish 
                      ? (group.choice_description_en || group.choice_description || '')
                      : (group.choice_description_ko || group.choice_description || '')
                    
                    // 디버깅: 그룹 설명 확인
                    if (groupIndex === 0) {
                      console.log('첫 번째 그룹 설명 확인:', {
                        choice_id: group.choice_id,
                        choice_name: group.choice_name,
                        choice_description: group.choice_description,
                        choice_description_ko: group.choice_description_ko,
                        choice_description_en: group.choice_description_en,
                        groupDescription,
                        hasDescription: !!groupDescription && groupDescription.trim().length > 0
                      })
                    }
                    
                    const hasDescription = groupDescription && groupDescription.trim().length > 0
                    
                    return (
                    <div key={group.choice_id} className="mb-6">
                      <h4 className="text-base font-semibold text-gray-900 mb-3 flex items-center">
                        <span className="text-blue-600 mr-1">*</span>
                        {isEnglish ? group.choice_name || group.choice_name_ko : group.choice_name_ko || group.choice_name}
                      </h4>
                      {hasDescription && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                            {groupDescription}
                          </p>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {group.options.map((option: ChoiceOption, optionIndex: number) => {
                          const isAvailable = isChoiceCombinationAvailable(group.choice_id, option.option_id)
                          const isDisabled = !isAvailable
                          const adultPrice = option.option_price || 0
                          const childPrice = option.option_child_price || 0
                          const infantPrice = option.option_infant_price || 0
                          const hasPrice = adultPrice > 0 || childPrice > 0 || infantPrice > 0
                          const isSelected = bookingData.selectedOptions[group.choice_id] === option.option_id
                          
                          return (
                            <label 
                              key={option.option_id} 
                              className={`relative flex flex-col cursor-pointer rounded-lg border-2 bg-white transition-all overflow-hidden ${
                                isDisabled
                                  ? 'opacity-50 cursor-not-allowed border-gray-200'
                                  : isSelected
                                    ? 'border-blue-500 shadow-lg ring-2 ring-blue-200'
                                    : 'border-gray-200 hover:border-blue-400 hover:shadow-lg'
                              }`}
                            >
                              <input
                                type="radio"
                                name={group.choice_id}
                                value={option.option_id}
                                checked={isSelected}
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
                                className="absolute top-3 right-3 w-5 h-5 text-blue-600"
                                required
                                disabled={isDisabled}
                              />
                              
                              {/* 이미지 - 옵션 이미지 우선, 없으면 그룹 이미지 */}
                              {(option.option_image_url || option.option_thumbnail_url || group.choice_image_url || group.choice_thumbnail_url) ? (
                                <div className="w-full h-56 overflow-hidden relative bg-gray-100">
                                  <Image
                                    src={option.option_thumbnail_url || option.option_image_url || group.choice_thumbnail_url || group.choice_image_url || ''}
                                    alt={isEnglish 
                                      ? (option.option_name_en || option.option_name || option.option_name_ko || '') 
                                      : (option.option_name_ko || option.option_name || option.option_name_en || '')}
                                    fill
                                    className="object-cover"
                                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                    priority={groupIndex === 0 && optionIndex === 0}
                                    onError={() => {
                                      // 이미지 로드 실패 시 처리
                                    }}
                                  />
                                  {isSelected && (
                                    <div className="absolute inset-0 bg-blue-500/10" />
                                  )}
                                </div>
                              ) : (
                                <div className="w-full h-56 bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                                  <Ticket className="h-16 w-16 text-blue-300" />
                                </div>
                              )}
                              
                              {/* 내용 영역 */}
                              <div className="flex flex-col flex-1 p-4">
                                {/* 제목 */}
                                <div className="flex items-center gap-2 mb-2 pr-8 flex-wrap">
                                  <h5 className="font-semibold text-gray-900 text-lg">
                                    {isEnglish ? option.option_name_en || option.option_name || option.option_name_ko : option.option_name_ko || option.option_name || option.option_name_en}
                                  </h5>
                                  {/* 기본 옵션 배지 */}
                                  {option.is_default && !isDisabled && (
                                    <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                      {translate('기본', 'Default')}
                                    </span>
                                  )}
                                </div>
                                
                                {/* 설명 - 옵션 설명 */}
                                {(() => {
                                  const optionDescription = isEnglish 
                                    ? (option.option_description || option.option_description_ko)
                                    : (option.option_description_ko || option.option_description)
                                  
                                  // 디버깅: 첫 번째 옵션 설명 확인
                                  if (groupIndex === 0 && optionIndex === 0) {
                                    console.log('첫 번째 옵션 설명 확인:', {
                                      option_id: option.option_id,
                                      option_name: option.option_name,
                                      option_description: option.option_description,
                                      option_description_ko: option.option_description_ko,
                                      optionDescription
                                    })
                                  }
                                  
                                  return optionDescription && optionDescription.trim() ? (
                                    <div className="mb-3 flex-1">
                                      <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                                        {optionDescription}
                                      </p>
                                    </div>
                                  ) : null
                                })()}
                                
                                {/* 가격 정보 */}
                                {hasPrice && (
                                  <div className="mt-auto pt-3 border-t border-gray-200">
                                    <div className="space-y-1">
                                      {adultPrice > 0 && (
                                        <div className="flex justify-between items-center">
                                          <span className="text-xs text-gray-600">{translate('성인', 'Adult')}</span>
                                          <span className="text-blue-600 font-semibold text-sm">
                                            +${adultPrice.toFixed(2)}
                                          </span>
                                        </div>
                                      )}
                                      {childPrice > 0 && (
                                        <div className="flex justify-between items-center">
                                          <span className="text-xs text-gray-600">{translate('아동', 'Child')}</span>
                                          <span className="text-blue-600 font-medium text-xs">
                                            +${childPrice.toFixed(2)}
                                          </span>
                                        </div>
                                      )}
                                      {infantPrice > 0 && (
                                        <div className="flex justify-between items-center">
                                          <span className="text-xs text-gray-600">{translate('유아', 'Infant')}</span>
                                          <span className="text-blue-600 font-medium text-xs">
                                            +${infantPrice.toFixed(2)}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                
                                {/* 마감 배지 */}
                                {isDisabled && (
                                  <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded mt-3 inline-block self-start">
                                    {translate('마감', 'Closed')}
                                  </span>
                                )}
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                    )
                  })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Ticket className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-600">{translate('필수 선택사항이 없습니다', 'There are no required options.')}</p>
                </div>
              )}
            </div>
          </div>
        )

      case 2:
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
                      <strong>{translate('선택사항입니다!', 'These are optional!')}</strong> {translate('원하시는 추가 옵션을 선택하세요. 선택하지 않아도 됩니다.', 'Choose any add-ons you would like—this step is optional.')}
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
                  {optionalChoices.map((group) => (
                    group.options.map((option) => {
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
                            onChange={() => {
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
                            <div className="w-full h-48 overflow-hidden rounded-t-lg relative">
                              <Image
                                src={group.choice_thumbnail_url || group.choice_image_url}
                                alt={isEnglish ? group.choice_name_en || group.choice_name : group.choice_name_ko || group.choice_name}
                                fill
                                className="object-cover"
                                onError={() => {
                                  // 이미지 로드 실패 시 처리
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

      case 3:
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

      case 4:
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
                      {bookingData.tourDate && (() => {
                        // 날짜 문자열을 직접 파싱하여 시간대 문제 방지
                        const [year, month, day] = bookingData.tourDate.split('-').map(Number)
                        const date = new Date(year, month - 1, day)
                        return date.toLocaleDateString(localeTag)
                      })()}
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
                    {appliedCoupon && (
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600">{translate('쿠폰 할인', 'Coupon Discount')}</span>
                        <span className="text-red-600">-${calculateCouponDiscount(appliedCoupon, calculateTotalPrice()).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold text-lg">
                      <span>{translate('총 가격', 'Total price')}</span>
                      <span className="text-blue-600">${calculateFinalPrice().toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                {/* 쿠폰 입력 필드 */}
                <div>
                  <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                    <Ticket className="h-4 w-4 mr-2 text-gray-600" />
                    {translate('쿠폰', 'Coupon')}
                  </label>
                  {!appliedCoupon ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(e) => {
                          setCouponCode(e.target.value.toUpperCase())
                          setCouponError('')
                        }}
                        placeholder={translate('쿠폰 코드 입력', 'Enter coupon code')}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleApplyCoupon()
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        disabled={validatingCoupon || !couponCode.trim()}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          validatingCoupon || !couponCode.trim()
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {validatingCoupon ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          translate('적용', 'Apply')
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center">
                        <Check className="h-4 w-4 text-green-600 mr-2" />
                        <span className="text-sm text-green-800">
                          {appliedCoupon.coupon_code}
                          {appliedCoupon.discount_type === 'percentage' && appliedCoupon.percentage_value && (
                            <span className="ml-2">({appliedCoupon.percentage_value}% {translate('할인', 'off')})</span>
                          )}
                          {appliedCoupon.discount_type === 'fixed' && appliedCoupon.fixed_value && (
                            <span className="ml-2">(${appliedCoupon.fixed_value} {translate('할인', 'off')})</span>
                          )}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        {translate('제거', 'Remove')}
                      </button>
                    </div>
                  )}
                  {couponError && (
                    <p className="text-xs text-red-500 mt-1">{couponError}</p>
                  )}
                </div>

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

                {/* 카드 정보 입력 폼 - Stripe Elements 사용 */}
                {paymentMethod === 'card' && stripePromise && (
                  <Elements 
                    stripe={stripePromise}
                    options={{
                      appearance: {
                        theme: 'stripe',
                      },
                    }}
                  >
                    <PaymentForm
                      paymentMethod={paymentMethod}
                      bookingData={bookingData}
                      totalPrice={calculateFinalPrice()}
                      onPaymentComplete={handlePaymentComplete}
                      translate={translate}
                      onPaymentSubmit={setPaymentSubmitHandler}
                    />
                  </Elements>
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
              // 카드 결제는 PaymentForm에서 처리하므로 버튼 숨김
              paymentMethod === 'card' ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAddToCart}
                    disabled={!isStepValid()}
                    className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
                      isStepValid()
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    {translate('장바구니에 추가', 'Add to Cart')}
                  </button>
                  <button
                    onClick={async () => {
                      if (paymentSubmitHandler) {
                        setPaymentProcessing(true)
                        try {
                          await paymentSubmitHandler()
                        } finally {
                          setPaymentProcessing(false)
                        }
                      }
                    }}
                    disabled={!isStepValid() || !paymentSubmitHandler || paymentProcessing || !stripePromise}
                    className={`flex items-center px-6 py-2 rounded-lg font-medium transition-colors ${
                      isStepValid() && paymentSubmitHandler && !paymentProcessing && stripePromise
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {paymentProcessing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        {translate('처리 중...', 'Processing...')}
                      </>
                    ) : (
                      translate('결제하기', 'Pay Now')
                    )}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAddToCart}
                    disabled={!isStepValid()}
                    className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
                      isStepValid()
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    {translate('장바구니에 추가', 'Add to Cart')}
                  </button>
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
                </div>
              )
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

