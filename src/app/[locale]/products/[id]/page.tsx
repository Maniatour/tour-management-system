'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Star, MapPin, Users, Calendar, Clock, Heart, Share2, Phone, Mail, ArrowLeft, X } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import ProductFaqDisplay from '@/components/ProductFaqDisplay'
import TourScheduleSection from '@/components/product/TourScheduleSection'
import BookingFlow from '@/components/booking/BookingFlow'
import { CartProvider, CartIcon, CartSidebar } from '@/components/cart/CartProvider'
import PaymentProcessor from '@/components/payment/PaymentProcessor'
import { supabase } from '@/lib/supabase'
import { useLocale } from 'next-intl'

interface Product {
  id: string
  name: string
  name_ko: string | null
  name_en: string | null
  customer_name_ko: string
  customer_name_en: string
  sub_category: string | null
  category: string | null
  base_price: number | null
  duration: string | null
  max_participants: number | null
  status: string | null
  tags: string[] | null
  created_at: string | null
  updated_at: string | null
  description: string | null
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
  use_common_details: boolean
  choices: Record<string, unknown> | null
  tour_departure_times: Record<string, unknown> | null
}

interface ProductDetails {
  id: string
  product_id: string
  language_code: string
  slogan1: string | null
  slogan2: string | null
  slogan3: string | null
  description: string | null
  included: string | null
  not_included: string | null
  pickup_drop_info: string | null
  luggage_info: string | null
  tour_operation_info: string | null
  preparation_info: string | null
  small_group_info: string | null
  notice_info: string | null
  private_tour_info: string | null
  cancellation_policy: string | null
  chat_announcement: string | null
  tags: string[] | null
  channel_id: string | null
}

interface TourCourse {
  id: string
  name: string
  name_ko: string | null
  name_en: string | null
  description: string | null
  duration: string | null
  difficulty: string | null
  highlights: string[] | null
  itinerary: Record<string, unknown> | null
}

interface ProductTourCourse {
  id: string
  product_id: string
  tour_course_id: string
  tour_course: TourCourse
}

interface ChoiceGroup {
  choice_id: string
  choice_name: string
  choice_name_ko: string | null
  choice_type: string
  choice_description: string | null
  options: Array<{
    option_id: string
    option_name: string
    option_name_ko: string | null
    option_price: number | null
    is_default: boolean | null
  }>
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

export default function ProductDetailPage() {
  const params = useParams()
  const productId = params.id as string
  const locale = useLocale()
  const isEnglish = locale === 'en'
  
  const [product, setProduct] = useState<Product | null>(null)
  const [productDetails, setProductDetails] = useState<ProductDetails | null>(null)
  const [tourCourses, setTourCourses] = useState<ProductTourCourse[]>([])
  const [productChoices, setProductChoices] = useState<ProductChoice[]>([])
  const [tourCoursePhotos, setTourCoursePhotos] = useState<Array<{
    id: string
    course_id: string
    photo_url: string
    photo_alt_ko: string | null
    photo_alt_en: string | null
    display_order: number
    is_primary: boolean
    sort_order: number
    thumbnail_url: string | null
    uploaded_by: string | null
  }>>([])
  const [productMedia, setProductMedia] = useState<Array<{
    id: string
    product_id: string
    file_name: string
    file_url: string
    file_type: 'image' | 'video' | 'document'
    file_size: number
    mime_type: string
    alt_text: string
    caption: string
    order_index: number
    is_primary: boolean
    is_active: boolean
  }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState('overview')
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  
  // 부킹 시스템 상태
  const [showBookingFlow, setShowBookingFlow] = useState(false)
  const [showCart, setShowCart] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [paymentData, setPaymentData] = useState<any>(null)
  const [cartItems, setCartItems] = useState<any[]>([])

  // 실제 데이터 로드
  useEffect(() => {
    const loadProductData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // 1. 기본 제품 정보 가져오기
        const { data: productData, error: productError } = await supabase
          .from('products')
          .select('*')
          .eq('id', productId)
          .eq('status', 'active')
          .single()
        
        if (productError) {
          console.error('Error fetching product:', productError)
          setError(isEnglish ? 'Product not found.' : '상품을 찾을 수 없습니다.')
          return
        }
        
        setProduct(productData)
        
        // 2. 다국어 상세 정보 가져오기
        const { data: detailsData, error: detailsError, status: detailsStatus } = await supabase
          .from('product_details_multilingual')
          .select('*')
          .eq('product_id', productId)
          .eq('language_code', locale)
          .maybeSingle()
        
        if (!detailsError && detailsData) {
          setProductDetails(detailsData)
        } else if ((detailsStatus === 404 || detailsStatus === 406) && locale !== 'ko') {
          const { data: fallbackDetails, error: fallbackError } = await supabase
            .from('product_details_multilingual')
            .select('*')
            .eq('product_id', productId)
            .eq('language_code', 'ko')
            .maybeSingle()

          if (!fallbackError && fallbackDetails) {
            setProductDetails(fallbackDetails)
          }
        } else if (detailsError) {
          throw detailsError
        }
        
        // 3. 투어 코스 정보 가져오기
        const { data: tourCoursesData, error: tourCoursesError } = await supabase
          .from('product_tour_courses')
          .select(`
            *,
            tour_course:tour_courses(*)
          `)
          .eq('product_id', productId)
        
        if (!tourCoursesError && tourCoursesData) {
          setTourCourses(tourCoursesData)
        }
        
        // 4. 선택 옵션 정보 가져오기
        try {
          const { data: fallbackChoices, error: fallbackError } = await supabase
            .from('product_choices')
            .select(`
              id,
              product_id,
              choice_group,
              choice_group_ko,
              choice_type,
              options:choice_options (
                id,
                option_name,
                option_name_ko,
                adult_price,
                is_default
              )
            `)
            .eq('product_id', productId)
            .order('sort_order', { ascending: true })

          if (fallbackError) {
            console.error('product_choices 로드 오류:', fallbackError)
            // 에러가 발생해도 빈 배열로 설정
            setProductChoices([])
          } else if (fallbackChoices) {
            const flattenedChoices: ProductChoice[] = fallbackChoices.flatMap((choice: any) => {
              const choiceName = choice.choice_group || ''
              const choiceNameKo = choice.choice_group_ko || null
              const choiceDescription = null
              const choiceType = choice.choice_type || 'single'
              const options = Array.isArray(choice.options) ? choice.options : []

              return options.map((option: any) => ({
                product_id: choice.product_id,
                product_name: product?.name || product?.customer_name_ko || '',
                choice_id: choice.id,
                choice_name: choiceName,
                choice_name_ko: choiceNameKo,
                choice_type: choiceType,
                choice_description: choiceDescription,
                option_id: option.id,
                option_name: option.option_name || option.option_key || '',
                option_name_ko: option.option_name_ko || null,
                option_price: option.adult_price ?? null,
                is_default: option.is_default ?? null
              }))
            })

            setProductChoices(flattenedChoices)
          } else {
            setProductChoices([])
          }
        } catch (error) {
          console.error('선택 옵션 로드 중 예외 발생:', error)
          setProductChoices([])
        }
        
        // 5. 상품 미디어 가져오기
        const { data: mediaData, error: mediaError } = await supabase
          .from('product_media')
          .select('*')
          .eq('product_id', productId)
          .eq('is_active', true)
          .order('order_index', { ascending: true })
        
        if (!mediaError && mediaData) {
          setProductMedia(mediaData)
        }

        // 6. 투어 코스 사진 가져오기
        if (tourCoursesData && tourCoursesData.length > 0) {
          const courseIds = tourCoursesData.map(tc => (tc as { tour_course?: { id: string } }).tour_course?.id).filter(Boolean)
          if (courseIds.length > 0) {
            const { data: photosData, error: photosError } = await supabase
              .from('tour_course_photos')
              .select('*')
              .in('course_id', courseIds)
              .order('is_primary', { ascending: false })
              .order('sort_order', { ascending: true })
            
            if (!photosError && photosData) {
              setTourCoursePhotos(photosData)
            }
          }
        }
        
      } catch (error) {
        console.error('상품 데이터 로드 오류:', error)
        setError(isEnglish ? 'Failed to load product information.' : '상품 정보를 불러오는데 실패했습니다.')
      } finally {
        setLoading(false)
      }
    }

    if (productId) {
      loadProductData()
    }
  }, [productId, locale])

  // 이미지 배열이 변경되면 선택된 이미지 인덱스를 리셋
  useEffect(() => {
    setSelectedImageIndex(0)
  }, [productMedia, tourCoursePhotos])

  const getDifficultyLabel = (difficulty: string) => {
    const difficultyLabels: { [key: string]: string } = isEnglish
      ? {
          easy: 'Easy',
          medium: 'Moderate',
          hard: 'Challenging'
        }
      : {
          easy: '쉬움',
          medium: '보통',
          hard: '어려움'
        }
    return difficultyLabels[difficulty] || difficulty
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'hard': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getCategoryLabel = (category: string) => {
    const categoryLabels: { [key: string]: string } = isEnglish
      ? {
          city: 'City',
          nature: 'Nature',
          culture: 'Culture',
          adventure: 'Adventure',
          food: 'Food',
          tour: 'Tour',
          sightseeing: 'Sightseeing',
          outdoor: 'Outdoor'
        }
      : {
          city: '도시',
          nature: '자연',
          culture: '문화',
          adventure: '모험',
          food: '음식',
          tour: '투어',
          sightseeing: '관광',
          outdoor: '야외활동'
        }
    return categoryLabels[category] || category
  }

  const getCustomerDisplayName = (product: Product) => {
    if (locale === 'en' && product.customer_name_en) {
      return product.customer_name_en
    }
    return product.customer_name_ko || product.name_ko || product.name
  }

  // 시간 형식을 일수 형식으로 변환 (예: 36:00:00 → 1박 2일)
  const formatDuration = (duration: string | null) => {
    if (!duration) return isEnglish ? 'Not specified' : '미정'
    
    // HH:MM:SS 형식인지 확인
    const timeMatch = duration.match(/^(\d+):(\d+):(\d+)$/)
    if (timeMatch) {
      const hours = parseInt(timeMatch[1], 10)
      const minutes = parseInt(timeMatch[2], 10)
      const seconds = parseInt(timeMatch[3], 10)
      
      // 총 시간을 시간 단위로 계산
      const totalHours = hours + (minutes / 60) + (seconds / 3600)
      
      // 일수 계산 (24시간 = 1일)
      const days = Math.ceil(totalHours / 24)
      
      if (days === 1) {
        // 당일 투어는 시간으로 표시
        if (hours === 0 && minutes > 0) {
          return isEnglish ? `${minutes} minute${minutes === 1 ? '' : 's'}` : `${minutes}분`
        } else if (hours > 0 && minutes === 0) {
          return isEnglish ? `${hours} ${hours === 1 ? 'hour' : 'hours'}` : `${hours}시간`
        } else if (hours > 0 && minutes > 0) {
          const hourLabel = isEnglish ? `${hours} ${hours === 1 ? 'hour' : 'hours'}` : `${hours}시간`
          const minuteLabel = isEnglish ? `${minutes} minute${minutes === 1 ? '' : 's'}` : `${minutes}분`
          return `${hourLabel} ${minuteLabel}`
        } else {
          const formattedHours = Math.round(totalHours * 10) / 10
          return isEnglish ? `${formattedHours} hours` : `${formattedHours}시간`
        }
      } else if (days === 2) {
        return isEnglish ? '1 night 2 days' : '1박 2일'
      } else if (days === 3) {
        return isEnglish ? '2 nights 3 days' : '2박 3일'
      } else if (days === 4) {
        return isEnglish ? '3 nights 4 days' : '3박 4일'
      } else if (days === 5) {
        return isEnglish ? '4 nights 5 days' : '4박 5일'
      } else if (days === 6) {
        return isEnglish ? '5 nights 6 days' : '5박 6일'
      } else if (days === 7) {
        return isEnglish ? '6 nights 7 days' : '6박 7일'
      } else {
        const nights = days - 1
        return isEnglish
          ? `${nights} night${nights === 1 ? '' : 's'} ${days} day${days === 1 ? '' : 's'}`
          : `${nights}박 ${days}일`
      }
    }
    
    // 다른 형식이면 그대로 반환
    return duration
  }

  // 선택 옵션을 그룹별로 정리
  const groupedChoices = productChoices.reduce((groups, choice) => {
    const groupKey = choice.choice_id
    if (!groups[groupKey]) {
      groups[groupKey] = {
        choice_id: choice.choice_id,
        choice_name: choice.choice_name,
        choice_name_ko: choice.choice_name_ko,
        choice_type: choice.choice_type,
        choice_description: choice.choice_description,
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

  // 기본 옵션 설정
  useEffect(() => {
    if (productChoices.length === 0) return
    
    const defaultOptions: Record<string, string> = {}
    
    // productChoices를 직접 사용하여 그룹화
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
    
    setSelectedOptions(defaultOptions)
  }, [productChoices])

  const handleOptionChange = (choiceId: string, optionId: string) => {
    setSelectedOptions(prev => ({
      ...prev,
      [choiceId]: optionId
    }))
  }

  const getSelectedOptionPrice = () => {
    let totalPrice = product?.base_price || 0
    Object.values(groupedChoices).forEach((group: ChoiceGroup) => {
      const selectedOptionId = selectedOptions[group.choice_id]
      if (selectedOptionId) {
        const option = group.options.find((opt) => opt.option_id === selectedOptionId)
        if (option && option.option_price) {
          totalPrice += option.option_price
        }
      }
    })
    return totalPrice
  }

  // 부킹 플로우 핸들러
  const handleBookingComplete = (bookingData: any) => {
    // 장바구니에 추가
    const cartItem = {
      productId: product?.id,
      productName: product?.name,
      productNameKo: product?.customer_name_ko,
      productNameEn: product?.customer_name_en || product?.name_en,
      tourDate: bookingData.tourDate,
      departureTime: bookingData.departureTime,
      participants: bookingData.participants,
      selectedOptions: bookingData.selectedOptions,
      basePrice: product?.base_price || 0,
      totalPrice: bookingData.totalPrice,
      customerInfo: bookingData.customerInfo
    }
    
    setCartItems(prev => [...prev, cartItem])
    setShowBookingFlow(false)
    setShowCart(true)
  }

  const handleCheckout = () => {
    if (cartItems.length === 0) return
    
    const totalAmount = cartItems.reduce((sum, item) => sum + item.totalPrice, 0)
    const firstItem = cartItems[0]
    
    setPaymentData({
      method: 'card',
      amount: totalAmount,
      currency: 'USD',
      customerInfo: firstItem.customerInfo
    })
    
    setShowCart(false)
    setShowPayment(true)
  }

  const handlePaymentSuccess = (result: any) => {
    console.log('결제 성공:', result)
    setShowPayment(false)
    setCartItems([])
    // 성공 메시지 표시 또는 리다이렉트
    alert(isEnglish ? 'Your reservation has been completed successfully!' : '예약이 성공적으로 완료되었습니다!')
  }

  const handlePaymentError = (error: string) => {
    console.error('결제 오류:', error)
    alert(isEnglish ? `An error occurred during payment: ${error}` : `결제 중 오류가 발생했습니다: ${error}`)
  }

  const tabs = isEnglish
    ? [
        { id: 'overview', label: 'Overview' },
        { id: 'itinerary', label: 'Tour Course' },
        { id: 'tour-schedule', label: 'Tour Schedule' },
        { id: 'details', label: 'Details' },
        { id: 'faq', label: 'FAQ' }
      ]
    : [
        { id: 'overview', label: '개요' },
        { id: 'itinerary', label: '투어 코스' },
        { id: 'tour-schedule', label: '투어 스케줄' },
        { id: 'details', label: '상세정보' },
        { id: 'faq', label: 'FAQ' }
      ]

  const detailTabs = isEnglish
    ? [
        { id: 'basic', label: 'Basic Info' },
        { id: 'included', label: 'Included / Excluded' },
        { id: 'logistics', label: 'Logistics' },
        { id: 'policy', label: 'Policies' }
      ]
    : [
        { id: 'basic', label: '기본정보' },
        { id: 'included', label: '포함/불포함' },
        { id: 'logistics', label: '운영정보' },
        { id: 'policy', label: '정책' }
      ]

  const [activeDetailTab, setActiveDetailTab] = useState('basic')

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{isEnglish ? 'Loading product information...' : '상품 정보를 불러오는 중...'}</p>
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{isEnglish ? 'An error occurred' : '오류가 발생했습니다'}</h2>
          <p className="text-gray-600 mb-4">{error || (isEnglish ? 'Product not found.' : '상품을 찾을 수 없습니다.')}</p>
          <Link 
            href={`/${locale}/products`} 
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {isEnglish ? 'Back to product list' : '상품 목록으로 돌아가기'}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <CartProvider>
      <div className="min-h-screen bg-gray-50">
        {/* 헤더 */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link href={`/${locale}/products`} className="text-gray-500 hover:text-gray-700">
                  <ArrowLeft size={24} />
                </Link>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {getCustomerDisplayName(product)}
                  </h1>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {getCategoryLabel(product.category || '')}
                    </span>
                    {product.tags && product.tags.length > 0 && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {product.tags[0]}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* 장바구니 아이콘 */}
              <CartIcon onClick={() => setShowCart(true)} />
            </div>
          </div>
        </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 메인 콘텐츠 */}
          <div className="lg:col-span-2 space-y-8">
            {/* 이미지 갤러리 */}
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              {(() => {
                // 모든 이미지 통합 (미디어 우선, 투어 코스 사진 추가)
                const mediaImages = productMedia.filter(item => item.file_type === 'image')
                const tourCourseImages = tourCoursePhotos.map(photo => ({
                  id: `tour-course-${photo.id}`,
                  file_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tour-course-photos/${photo.photo_url}`,
                  alt_text: photo.photo_alt_ko || photo.photo_alt_en || 'Tour course photo',
                  caption: photo.photo_alt_ko || photo.photo_alt_en || '',
                  file_name: photo.photo_url,
                  is_primary: photo.is_primary,
                  order_index: photo.sort_order
                }))
                
                const allImages = [...mediaImages, ...tourCourseImages]
                
                return allImages.length > 0 ? (
                <>
                  {/* 메인 이미지 */}
                  <div className="relative h-96 bg-gray-200">
                    <Image
                      src={allImages[selectedImageIndex].file_url}
                      alt={allImages[selectedImageIndex].alt_text || allImages[selectedImageIndex].file_name}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      priority
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                    <div className="absolute top-4 right-4 flex space-x-2">
                      <button className="p-2 bg-white/80 rounded-full hover:bg-white transition-colors">
                        <Heart size={20} className="text-gray-600" />
                      </button>
                      <button className="p-2 bg-white/80 rounded-full hover:bg-white transition-colors">
                        <Share2 size={20} className="text-gray-600" />
                      </button>
                    </div>
                  </div>
                  
                  {/* 썸네일 갤러리 */}
                  <div className="p-4">
                    <div className="flex space-x-2 overflow-x-auto">
                      {allImages.slice(0, 8).map((image, index) => (
                        <div key={image.id} className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-200 relative border-2 ${selectedImageIndex === index ? 'border-blue-500' : 'border-transparent'}`}>
                          <Image
                            src={image.file_url}
                            alt={image.alt_text || image.file_name}
                            fill
                            sizes="80px"
                            className="object-cover cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => setSelectedImageIndex(index)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* 사진이 없을 때 플레이스홀더 */}
                  <div className="relative h-96 bg-gray-200">
                    <div className="w-full h-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-6xl mb-4">🏔️</div>
                        <div className="text-lg font-medium text-gray-600">
                          {getCustomerDisplayName(product)}
                        </div>
                        <div className="text-sm text-gray-500 mt-2">
                          {isEnglish ? 'Image coming soon' : '이미지 준비 중'}
                        </div>
                      </div>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                    <div className="absolute top-4 right-4 flex space-x-2">
                      <button className="p-2 bg-white/80 rounded-full hover:bg-white transition-colors">
                        <Heart size={20} className="text-gray-600" />
                      </button>
                      <button className="p-2 bg-white/80 rounded-full hover:bg-white transition-colors">
                        <Share2 size={20} className="text-gray-600" />
                      </button>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex space-x-2 overflow-x-auto">
                      <div className="flex-shrink-0 w-20 h-20 rounded-lg bg-gray-200 flex items-center justify-center text-gray-500 text-xs">
                        {isEnglish ? 'No image' : '이미지 없음'}
                      </div>
                    </div>
                  </div>
                </>
              )
              })()}
            </div>

            {/* 탭 네비게이션 */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex overflow-x-auto scrollbar-hide px-4 sm:px-6">
                  <div className="flex space-x-2 sm:space-x-8 min-w-max">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-sm whitespace-nowrap flex-shrink-0 transition-colors touch-optimized mobile-button ${
                          activeTab === tab.id
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </nav>
              </div>

              {/* 탭 콘텐츠 */}
              <div className="p-4 sm:p-6">
                {/* 개요 탭 */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* 슬로건 표시 */}
                    {productDetails && (
                      <div className="space-y-4">
                        {productDetails.slogan1 && (
                          <div className="text-2xl font-bold text-blue-600">
                            {productDetails.slogan1}
                          </div>
                        )}
                        {productDetails.slogan2 && (
                          <div className="text-lg font-semibold text-gray-800">
                            {productDetails.slogan2}
                          </div>
                        )}
                        {productDetails.slogan3 && (
                          <div className="text-base text-gray-600">
                            {productDetails.slogan3}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 투어 소개 */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">{isEnglish ? 'Tour Overview' : '투어 소개'}</h3>
                      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {productDetails?.description || product.description || getCustomerDisplayName(product)}
                      </p>
                    </div>

                    {/* 기본 정보 */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">{isEnglish ? 'Key Information' : '기본 정보'}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center space-x-3">
                          <Calendar className="h-5 w-5 text-blue-500" />
                          <div>
                            <span className="text-sm text-gray-600">{isEnglish ? 'Duration' : '기간'}</span>
                            <p className="font-medium">{formatDuration(product.duration)}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Users className="h-5 w-5 text-green-500" />
                          <div>
                            <span className="text-sm text-gray-600">{isEnglish ? 'Maximum Participants' : '최대 참가자'}</span>
                            <p className="font-medium">
                              {product.max_participants || 0}
                              {isEnglish ? ' people' : '명'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <MapPin className="h-5 w-5 text-red-500" />
                          <div>
                            <span className="text-sm text-gray-600">{isEnglish ? 'Category' : '카테고리'}</span>
                            <p className="font-medium">{getCategoryLabel(product.category || '')}</p>
                          </div>
                        </div>
                        {product.group_size && (
                          <div className="flex items-center space-x-3">
                            <Users className="h-5 w-5 text-purple-500" />
                            <div>
                              <span className="text-sm text-gray-600">{isEnglish ? 'Group Size' : '그룹 크기'}</span>
                              <p className="font-medium">{product.group_size}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 포함/불포함 정보 */}
                    {(productDetails?.included || productDetails?.not_included) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {productDetails.included && (
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">{isEnglish ? 'Included' : '포함 사항'}</h3>
                            <div className="text-gray-700 whitespace-pre-line">
                              {productDetails.included}
                            </div>
                          </div>
                        )}
                        {productDetails.not_included && (
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">{isEnglish ? 'Excluded' : '불포함 사항'}</h3>
                            <div className="text-gray-700 whitespace-pre-line">
                              {productDetails.not_included}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 태그 */}
                    {(product.tags && product.tags.length > 0) || (productDetails?.tags && productDetails.tags.length > 0) && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">{isEnglish ? 'Tags' : '태그'}</h3>
                        <div className="flex flex-wrap gap-2">
                          {(productDetails?.tags || product.tags || []).map((tag, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 일정 탭 */}
                {activeTab === 'itinerary' && (
                  <div className="space-y-6">
                    {tourCourses.length > 0 ? (
                      tourCourses.map((productTourCourse) => {
                        const tourCourse = productTourCourse.tour_course
                        if (!tourCourse) return null
                        
                        return (
                          <div key={productTourCourse.id} className="border rounded-lg p-6">
                            <h3 className="text-xl font-semibold text-gray-900 mb-4">
                              {locale === 'en' && tourCourse.name_en ? tourCourse.name_en : tourCourse.name_ko || tourCourse.name}
                            </h3>
                            
                            {tourCourse.description && (
                              <p className="text-gray-700 mb-4 whitespace-pre-wrap">
                                {tourCourse.description}
                              </p>
                            )}
                            
                            {tourCourse.duration && (
                              <div className="flex items-center mb-4">
                                <Clock className="h-5 w-5 text-blue-500 mr-2" />
                                <span className="text-gray-600">{isEnglish ? 'Duration:' : '소요시간:'} {tourCourse.duration}</span>
                              </div>
                            )}
                            
                            {tourCourse.difficulty && (
                              <div className="flex items-center mb-4">
                                <span className="text-gray-600 mr-2">{isEnglish ? 'Difficulty:' : '난이도:'}</span>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(tourCourse.difficulty)}`}>
                                  {getDifficultyLabel(tourCourse.difficulty)}
                                </span>
                              </div>
                            )}
                            
                            {tourCourse.highlights && tourCourse.highlights.length > 0 && (
                              <div className="mb-4">
                                <h4 className="font-medium text-gray-900 mb-2">{isEnglish ? 'Highlights' : '하이라이트'}</h4>
                                <ul className="space-y-1">
                                  {tourCourse.highlights.map((highlight, index) => (
                                    <li key={index} className="flex items-center text-sm text-gray-600">
                                      <Star className="h-3 w-3 text-yellow-400 mr-2 flex-shrink-0" />
                                      {highlight}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {tourCourse.itinerary && (
                              <div>
                                <h4 className="font-medium text-gray-900 mb-2">{isEnglish ? 'Detailed Itinerary' : '상세 일정'}</h4>
                                <div className="text-sm text-gray-600 whitespace-pre-line">
                                  {JSON.stringify(tourCourse.itinerary, null, 2)}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-center py-8">
                        <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p className="text-lg font-medium text-gray-900">{isEnglish ? 'Schedule information is not available yet' : '일정 정보가 없습니다'}</p>
                        <p className="text-gray-600">{isEnglish ? 'Please add tour course details.' : '투어 코스 정보를 추가해주세요'}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* 투어 스케줄 탭 */}
                {activeTab === 'tour-schedule' && product && (
                  <TourScheduleSection 
                    productId={productId} 
                    teamType={null}
                    locale={locale}
                  />
                )}

                {/* 상세정보 탭 */}
                {activeTab === 'details' && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-gray-900">{isEnglish ? 'Detailed Tour Information' : '투어 상세 정보'}</h3>
                    
                    {/* 상세정보 서브 탭 네비게이션 */}
                    <div className="border-b border-gray-200">
                      <nav className="-mb-px flex overflow-x-auto scrollbar-hide">
                        <div className="flex space-x-2 sm:space-x-8 min-w-max px-4 sm:px-0">
                          {detailTabs.map((tab) => (
                            <button
                              key={tab.id}
                              onClick={() => setActiveDetailTab(tab.id)}
                              className={`py-2 sm:py-2 px-2 sm:px-1 border-b-2 font-medium text-sm whitespace-nowrap flex-shrink-0 transition-colors touch-optimized mobile-button ${
                                activeDetailTab === tab.id
                                  ? 'border-blue-500 text-blue-600'
                                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                              }`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                      </nav>
                    </div>

                    {/* 기본정보 탭 */}
                    {activeDetailTab === 'basic' && (
                      <div className="space-y-6">
                        {/* 기본 정보 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="font-medium text-gray-900 mb-3">{isEnglish ? 'Basic Information' : '기본 정보'}</h4>
                            <dl className="space-y-3 text-sm">
                              <div className="flex justify-between">
                                <dt className="text-gray-600">{isEnglish ? 'Category' : '카테고리'}</dt>
                                <dd className="text-gray-900">{getCategoryLabel(product.category || '')}</dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-gray-600">{isEnglish ? 'Subcategory' : '서브 카테고리'}</dt>
                                <dd className="text-gray-900">{product.sub_category || (isEnglish ? 'Not specified' : '미정')}</dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-gray-600">{isEnglish ? 'Duration' : '기간'}</dt>
                                <dd className="text-gray-900">{formatDuration(product.duration)}</dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-gray-600">{isEnglish ? 'Maximum Participants' : '최대 참가자'}</dt>
                                <dd className="text-gray-900">
                                  {product.max_participants || 0}
                                  {isEnglish ? ' people' : '명'}
                                </dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-gray-600">{isEnglish ? 'Status' : '상태'}</dt>
                                <dd className="text-gray-900">{product.status || (isEnglish ? 'Not specified' : '미정')}</dd>
                              </div>
                              {product.group_size && (
                                <div className="flex justify-between">
                                  <dt className="text-gray-600">{isEnglish ? 'Group Size' : '그룹 크기'}</dt>
                                  <dd className="text-gray-900">{product.group_size}</dd>
                                </div>
                              )}
                            </dl>
                          </div>

                          <div>
                            <h4 className="font-medium text-gray-900 mb-3">{isEnglish ? 'Age Guidelines' : '연령 정보'}</h4>
                            <dl className="space-y-3 text-sm">
                              {product.adult_age && (
                                <div className="flex justify-between">
                                  <dt className="text-gray-600">{isEnglish ? 'Adult Age' : '성인 연령'}</dt>
                                  <dd className="text-gray-900">
                                    {isEnglish ? `${product.adult_age}+ years` : `${product.adult_age}세 이상`}
                                  </dd>
                                </div>
                              )}
                              {product.child_age_min && product.child_age_max && (
                                <div className="flex justify-between">
                                  <dt className="text-gray-600">{isEnglish ? 'Child Age' : '아동 연령'}</dt>
                                  <dd className="text-gray-900">
                                    {isEnglish
                                      ? `${product.child_age_min}-${product.child_age_max} years`
                                      : `${product.child_age_min}-${product.child_age_max}세`}
                                  </dd>
                                </div>
                              )}
                              {product.infant_age && (
                                <div className="flex justify-between">
                                  <dt className="text-gray-600">{isEnglish ? 'Infant Age' : '유아 연령'}</dt>
                                  <dd className="text-gray-900">
                                    {isEnglish ? `Under ${product.infant_age} years` : `${product.infant_age}세 미만`}
                                  </dd>
                                </div>
                              )}
                            </dl>
                          </div>
                        </div>

                        {/* 언어 정보 */}
                        {product.languages && product.languages.length > 0 && (
                          <div>
                            <h4 className="font-medium text-gray-900 mb-3">{isEnglish ? 'Supported Languages' : '지원 언어'}</h4>
                            <div className="flex flex-wrap gap-2">
                              {product.languages.map((language, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800"
                                >
                                  {language}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 출발/도착 정보 */}
                        {(product.departure_city || product.arrival_city) && (
                          <div>
                            <h4 className="font-medium text-gray-900 mb-3">{isEnglish ? 'Departure / Arrival Details' : '출발/도착 정보'}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {product.departure_city && (
                                <div className="flex items-center space-x-2">
                                  <MapPin className="h-4 w-4 text-blue-500" />
                                  <span className="text-sm text-gray-600">{isEnglish ? 'Departure:' : '출발지:'}</span>
                                  <span className="text-sm font-medium">{product.departure_city}</span>
                                  {product.departure_country && (
                                    <span className="text-sm text-gray-500">({product.departure_country})</span>
                                  )}
                                </div>
                              )}
                              {product.arrival_city && (
                                <div className="flex items-center space-x-2">
                                  <MapPin className="h-4 w-4 text-green-500" />
                                  <span className="text-sm text-gray-600">{isEnglish ? 'Arrival:' : '도착지:'}</span>
                                  <span className="text-sm font-medium">{product.arrival_city}</span>
                                  {product.arrival_country && (
                                    <span className="text-sm text-gray-500">({product.arrival_country})</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 태그 */}
                        {(product.tags && product.tags.length > 0) || (productDetails?.tags && productDetails.tags.length > 0) && (
                          <div>
                            <h4 className="font-medium text-gray-900 mb-3">{isEnglish ? 'Tags' : '태그'}</h4>
                            <div className="flex flex-wrap gap-2">
                              {(productDetails?.tags || product.tags || []).map((tag, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 포함/불포함 탭 */}
                    {activeDetailTab === 'included' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {productDetails?.included && (
                            <div>
                              <h4 className="font-medium text-gray-900 mb-3">{isEnglish ? 'Included' : '포함 사항'}</h4>
                              <div className="text-sm text-gray-600 whitespace-pre-line bg-green-50 p-4 rounded-lg">
                                {productDetails.included}
                              </div>
                            </div>
                          )}
                          {productDetails?.not_included && (
                            <div>
                              <h4 className="font-medium text-gray-900 mb-3">{isEnglish ? 'Excluded' : '불포함 사항'}</h4>
                              <div className="text-sm text-gray-600 whitespace-pre-line bg-red-50 p-4 rounded-lg">
                                {productDetails.not_included}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {!productDetails?.included && !productDetails?.not_included && (
                          <div className="text-center py-8">
                            <div className="text-gray-400 mb-2">📋</div>
                            <p className="text-gray-600">{isEnglish ? 'No inclusion or exclusion details available' : '포함/불포함 정보가 없습니다'}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 운영정보 탭 */}
                    {activeDetailTab === 'logistics' && (
                      <div className="space-y-6">
                        <div className="space-y-6">
                          {productDetails?.pickup_drop_info && (
                            <div>
                              <h4 className="font-medium text-gray-900 mb-3">{isEnglish ? 'Pickup & Drop-off Information' : '픽업/드롭 정보'}</h4>
                              <div className="text-sm text-gray-600 whitespace-pre-line bg-blue-50 p-4 rounded-lg">
                                {productDetails.pickup_drop_info}
                              </div>
                            </div>
                          )}
                          
                          {productDetails?.luggage_info && (
                            <div>
                              <h4 className="font-medium text-gray-900 mb-3">{isEnglish ? 'Luggage Information' : '짐 정보'}</h4>
                              <div className="text-sm text-gray-600 whitespace-pre-line bg-yellow-50 p-4 rounded-lg">
                                {productDetails.luggage_info}
                              </div>
                            </div>
                          )}
                          
                          {productDetails?.tour_operation_info && (
                            <div>
                              <h4 className="font-medium text-gray-900 mb-3">{isEnglish ? 'Tour Operations' : '투어 운영 정보'}</h4>
                              <div className="text-sm text-gray-600 whitespace-pre-line bg-purple-50 p-4 rounded-lg">
                                {productDetails.tour_operation_info}
                              </div>
                            </div>
                          )}
                          
                          {productDetails?.preparation_info && (
                            <div>
                              <h4 className="font-medium text-gray-900 mb-3">{isEnglish ? 'Preparation Tips' : '준비사항'}</h4>
                              <div className="text-sm text-gray-600 whitespace-pre-line bg-orange-50 p-4 rounded-lg">
                                {productDetails.preparation_info}
                              </div>
                            </div>
                          )}
                          
                          {productDetails?.small_group_info && (
                            <div>
                              <h4 className="font-medium text-gray-900 mb-3">{isEnglish ? 'Small Group Details' : '소그룹 정보'}</h4>
                              <div className="text-sm text-gray-600 whitespace-pre-line bg-indigo-50 p-4 rounded-lg">
                                {productDetails.small_group_info}
                              </div>
                            </div>
                          )}
                          
                          {productDetails?.notice_info && (
                            <div>
                              <h4 className="font-medium text-gray-900 mb-3">{isEnglish ? 'Important Notes' : '주의사항'}</h4>
                              <div className="text-sm text-gray-600 whitespace-pre-line bg-red-50 p-4 rounded-lg">
                                {productDetails.notice_info}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {!productDetails?.pickup_drop_info && !productDetails?.luggage_info && 
                         !productDetails?.tour_operation_info && !productDetails?.preparation_info && 
                         !productDetails?.small_group_info && !productDetails?.notice_info && (
                          <div className="text-center py-8">
                            <div className="text-gray-400 mb-2">🚌</div>
                            <p className="text-gray-600">{isEnglish ? 'No logistics information available' : '운영 정보가 없습니다'}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 정책 탭 */}
                    {activeDetailTab === 'policy' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 gap-6">
                          {productDetails?.private_tour_info && (
                            <div>
                              <h4 className="font-medium text-gray-900 mb-3">{isEnglish ? 'Private Tour Information' : '프라이빗 투어 정보'}</h4>
                              <div className="text-sm text-gray-600 whitespace-pre-line bg-purple-50 p-4 rounded-lg">
                                {productDetails.private_tour_info}
                              </div>
                            </div>
                          )}
                          
                          {productDetails?.cancellation_policy && (
                            <div>
                              <h4 className="font-medium text-gray-900 mb-3">{isEnglish ? 'Cancellation Policy' : '취소 정책'}</h4>
                              <div className="text-sm text-gray-600 whitespace-pre-line bg-red-50 p-4 rounded-lg">
                                {productDetails.cancellation_policy}
                              </div>
                            </div>
                          )}
                          
                          {productDetails?.chat_announcement && (
                            <div>
                              <h4 className="font-medium text-gray-900 mb-3">{isEnglish ? 'Announcements' : '공지사항'}</h4>
                              <div className="text-sm text-gray-600 whitespace-pre-line bg-blue-50 p-4 rounded-lg">
                                {productDetails.chat_announcement}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {!productDetails?.private_tour_info && !productDetails?.cancellation_policy && 
                         !productDetails?.chat_announcement && (
                          <div className="text-center py-8">
                            <div className="text-gray-400 mb-2">📋</div>
                            <p className="text-gray-600">{isEnglish ? 'No policy information available' : '정책 정보가 없습니다'}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* FAQ 탭 */}
                {activeTab === 'faq' && (
                  <ProductFaqDisplay productId={productId} />
                )}
              </div>
            </div>
          </div>

          {/* 사이드바 */}
          <div className="space-y-6">
            {/* 예약 카드 */}
            <div className="bg-white rounded-lg shadow-sm border p-6 sticky top-6">
              <div className="text-center mb-6">
                <div className="text-3xl font-bold text-gray-900">
                  ${getSelectedOptionPrice()}
                </div>
                <div className="text-sm text-gray-600">
                  {Object.keys(groupedChoices).length > 0
                    ? (isEnglish ? 'Includes selected options' : '선택 옵션 포함')
                    : (isEnglish ? 'Base price' : '기본 가격')}
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{isEnglish ? 'Maximum participants' : '최대 참가자'}</span>
                  <span className="font-medium">
                    {product.max_participants || 0}
                    {isEnglish ? ' people' : '명'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{isEnglish ? 'Duration' : '기간'}</span>
                  <span className="font-medium">{formatDuration(product.duration)}</span>
                </div>
                {product.group_size && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{isEnglish ? 'Group size' : '그룹 크기'}</span>
                    <span className="font-medium">{product.group_size}</span>
                  </div>
                )}
              </div>

              {/* 선택 옵션 */}
              {Object.keys(groupedChoices).length > 0 && (
                <div className="mb-6">
                  <h4 className="font-medium text-gray-900 mb-3">{isEnglish ? 'Optional add-ons' : '선택 옵션'}</h4>
                  <div className="space-y-4">
                    {Object.values(groupedChoices).map((group: ChoiceGroup) => (
                      <div key={group.choice_id}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {isEnglish ? group.choice_name || group.choice_name_ko : group.choice_name_ko || group.choice_name}
                        </label>
                        <select
                          value={selectedOptions[group.choice_id] || ''}
                          onChange={(e) => handleOptionChange(group.choice_id, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {group.options.map((option) => (
                            <option key={option.option_id} value={option.option_id}>
                              {isEnglish ? option.option_name || option.option_name_ko : option.option_name_ko || option.option_name}
                              {option.option_price ? ` (+$${option.option_price})` : ''}
                              {option.is_default ? (isEnglish ? ' (default)' : ' (기본)') : ''}
                            </option>
                          ))}
                        </select>
                        {group.choice_description && (
                          <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{group.choice_description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button 
                onClick={() => setShowBookingFlow(true)}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                {isEnglish ? 'Book Now' : '예약하기'}
              </button>

              <div className="mt-4 text-center">
                <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                  {isEnglish ? 'Contact Us' : '문의하기'}
                </button>
              </div>
            </div>

            {/* 연락처 정보 */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="font-semibold text-gray-900 mb-4">{isEnglish ? 'Contact' : '연락처'}</h3>
              <div className="space-y-3">
                <div className="flex items-center text-gray-700">
                  <Phone size={16} className="mr-3" />
                  <span>010-1234-5678</span>
                </div>
                <div className="flex items-center text-gray-700">
                  <Mail size={16} className="mr-3" />
                  <span>info@tourtour.com</span>
                </div>
              </div>
            </div>

            {/* 리뷰 요약 */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">{isEnglish ? 'Reviews' : '리뷰'}</h3>
                <div className="flex items-center">
                  <Star className="h-4 w-4 text-yellow-400 mr-1" />
                  <span className="font-medium">4.5</span>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                {isEnglish ? '12 reviews' : '12개의 리뷰'}
              </div>
              <button className="w-full mt-3 text-blue-600 hover:text-blue-700 text-sm font-medium">
                {isEnglish ? 'View all reviews' : '모든 리뷰 보기'}
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* 부킹 플로우 모달 */}
      {showBookingFlow && product && (
        <BookingFlow
          product={product}
          productChoices={productChoices}
          onClose={() => setShowBookingFlow(false)}
          onComplete={handleBookingComplete}
        />
      )}

      {/* 장바구니 사이드바 */}
      <CartSidebar
        isOpen={showCart}
        onClose={() => setShowCart(false)}
        onCheckout={handleCheckout}
      />

      {/* 결제 처리 모달 */}
      {showPayment && paymentData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">{isEnglish ? 'Complete Payment' : '결제하기'}</h2>
                <button
                  onClick={() => setShowPayment(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[80vh]">
              <PaymentProcessor
                paymentData={paymentData}
                cartItems={cartItems}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                onCancel={() => setShowPayment(false)}
              />
            </div>
          </div>
        </div>
      )}
    </CartProvider>
  )
}
