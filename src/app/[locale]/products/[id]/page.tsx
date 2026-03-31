'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { Star, MapPin, Users, Calendar, Clock, Heart, Share2, ArrowLeft, X, Info, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Car, Luggage, Settings, Lightbulb, Users2, AlertTriangle, Shield, Megaphone } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import ProductFaqDisplay from '@/components/ProductFaqDisplay'
import TourScheduleSection from '@/components/product/TourScheduleSection'
import BookingFlow from '@/components/booking/BookingFlow'
import { CartIcon, CartSidebar } from '@/components/cart/CartProvider'
import CartCheckout from '@/components/cart/CartCheckout'
import PaymentProcessor from '@/components/payment/PaymentProcessor'
import { supabase } from '@/lib/supabase'
import { useLocale } from 'next-intl'
import { markdownToHtml } from '@/components/LightRichEditor'
import { isProductDetailVisibleOnCustomerPage } from '@/lib/fetchProductDetailsForEmail'

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
  greeting: string | null
  companion_recruitment_info: string | null
  notice_info: string | null
  important_notes: string | null
  private_tour_info: string | null
  cancellation_policy: string | null
  chat_announcement: string | null
  tags: string[] | null
  channel_id: string | null
  customer_page_visibility?: Record<string, unknown> | null
}

interface TourCourse {
  id: string
  name: string
  name_ko: string | null
  name_en: string | null
  customer_name_ko: string | null
  customer_name_en: string | null
  customer_description_ko: string | null
  customer_description_en: string | null
  description: string | null
  duration: string | null
  duration_hours: number | null
  difficulty: string | null
  difficulty_level: 'easy' | 'medium' | 'hard' | null
  highlights: string[] | null
  itinerary: Record<string, unknown> | null
  location: string | null
  category: string | null
  level: number | null
  path: string | null
  parent_id: string | null
  point_name: string | null
  sort_order: number | null
  min_participants: number | null
  max_participants: number | null
  parent?: TourCourse
  photos?: Array<{
    id: string
    course_id: string
    photo_url: string
    photo_alt_ko: string | null
    photo_alt_en: string | null
    display_order: number
    is_primary: boolean
    sort_order: number
    thumbnail_url: string | null
  }>
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
  choice_name_en?: string | null
  choice_type: string
  choice_description: string | null
  choice_description_ko?: string | null
  choice_description_en?: string | null
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
  choice_name_en?: string | null
  choice_type: string
  choice_description: string | null
  option_id: string
  option_name: string
  option_name_ko: string | null
  option_price: number | null
  is_default: boolean | null
  option_image_url?: string | null
  option_thumbnail_url?: string | null
  option_description?: string | null
  option_description_ko?: string | null
  choice_image_url?: string | null
  choice_thumbnail_url?: string | null
  choice_description_ko?: string | null
  choice_description_en?: string | null
}

// 포함/불포함 정보를 파싱하여 각 항목 앞에 이모지를 추가하는 함수
function formatInclusionList(text: string, isIncluded: boolean): string {
  if (!text) return ''
  
  const emoji = isIncluded ? '✓' : '✗'
  const lines = text.split('\n')
  const formattedLines: string[] = []
  
  for (const line of lines) {
    const trimmed = line.trim()
    
    // 빈 줄은 그대로 유지
    if (!trimmed) {
      formattedLines.push(line)
      continue
    }
    
    // 이미 이모지가 있으면 추가하지 않음
    if (trimmed.startsWith('✓') || trimmed.startsWith('✗') || trimmed.startsWith('✅') || trimmed.startsWith('❌')) {
      formattedLines.push(line)
      continue
    }
    
    // 마크다운 리스트 항목 처리 (-, *, 숫자)
    const listItemMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.+)$/)
    if (listItemMatch) {
      const [, indent, marker, content] = listItemMatch
      formattedLines.push(`${indent}${marker} ${emoji} ${content}`)
      continue
    }
    
    // 일반 텍스트 줄도 이모지 추가
    formattedLines.push(`${emoji} ${line}`)
  }
  
  return formattedLines.join('\n')
}

// 계층 구조 경로를 생성하는 함수
function buildHierarchyPath(tourCourse: TourCourse, locale: string, allCoursesMap?: Map<string, any>): string[] {
  const path: string[] = []
  
  // path 필드를 직접 파싱 (path는 "id1.id2.id3" 형식, id1이 루트)
  if (tourCourse.path && allCoursesMap && allCoursesMap.size > 0) {
    const pathIds = tourCourse.path.split('.').filter(Boolean)
    
    console.log('Building hierarchy path:', {
      path: tourCourse.path,
      pathIds,
      mapSize: allCoursesMap.size
    })
    
    // path의 각 ID에 해당하는 이름을 순서대로 가져오기
    pathIds.forEach(id => {
      const course = allCoursesMap.get(id)
      if (course) {
        const name = locale === 'en'
          ? (course.customer_name_en || course.name_en || course.name_ko || course.name || '')
          : (course.customer_name_ko || course.name_ko || course.name || '')
        
        if (name) {
          path.push(name)
        }
      } else {
        console.warn('Course not found in map for id:', id)
      }
    })
    
    console.log('Built path from path field:', path)
  } else if (tourCourse.parent) {
    // path가 없으면 parent 체인을 따라 올라가기
    let current: TourCourse | undefined = tourCourse
    const tempPath: string[] = []
    
    // 현재 코스부터 루트까지 수집
    while (current) {
      const name = locale === 'en'
        ? (current.customer_name_en || current.name_en || current.name_ko || current.name || '')
        : (current.customer_name_ko || current.name_ko || current.name || '')
      
      if (name) {
        tempPath.push(name)
      }
      
      current = current.parent
    }
    
    // 역순으로 뒤집어서 루트부터 현재까지 순서로 만들기
    const reversedPath = tempPath.reverse()
    console.log('Built path from parent chain:', reversedPath)
    return reversedPath
  } else {
    console.log('No path or parent available for course:', tourCourse.id)
  }
  
  return path
}

// 투어 코스 카드 컴포넌트 (슬라이드쇼 포함)
function TourCourseCard({
  productTourCourse,
  tourCourse,
  coursePhotos,
  customerName,
  customerDescription,
  difficulty,
  locale,
  isEnglish,
  getDifficultyColor,
  getDifficultyLabel,
  allCoursesMap
}: {
  productTourCourse: ProductTourCourse
  tourCourse: TourCourse
  coursePhotos: Array<{
    id: string
    course_id: string
    photo_url: string
    photo_alt_ko: string | null
    photo_alt_en: string | null
    display_order: number
    is_primary: boolean
    sort_order: number
    thumbnail_url: string | null
  }>
  customerName: string
  customerDescription: string | null
  difficulty: string | null
  locale: string
  isEnglish: boolean
  getDifficultyColor: (difficulty: string) => string
  getDifficultyLabel: (difficulty: string) => string
  allCoursesMap?: Map<string, any>
}) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  const [isAutoSlidePaused, setIsAutoSlidePaused] = useState(false)
  
  // 계층 구조 경로 생성
  const hierarchyPath = buildHierarchyPath(tourCourse, locale, allCoursesMap)
  
  // 디버깅 로그
  useEffect(() => {
    console.log('TourCourseCard hierarchy path:', {
      courseId: tourCourse.id,
      courseName: customerName,
      path: tourCourse.path,
      parentId: tourCourse.parent_id,
      hasParent: !!tourCourse.parent,
      mapSize: allCoursesMap?.size || 0,
      hierarchyPath,
      hierarchyPathLength: hierarchyPath.length
    })
  }, [tourCourse.id, tourCourse.path, tourCourse.parent_id, customerName, hierarchyPath, allCoursesMap])

  // 자동 슬라이드 기능
  useEffect(() => {
    if (coursePhotos.length <= 1 || isAutoSlidePaused) return

    const interval = setInterval(() => {
      setCurrentPhotoIndex((prevIndex) => (prevIndex + 1) % coursePhotos.length)
    }, 4000) // 4초마다 자동 슬라이드

    return () => clearInterval(interval)
  }, [coursePhotos.length, isAutoSlidePaused])

  const goToPrevious = () => {
    setCurrentPhotoIndex((prevIndex) => 
      prevIndex === 0 ? coursePhotos.length - 1 : prevIndex - 1
    )
    setIsAutoSlidePaused(true)
    setTimeout(() => setIsAutoSlidePaused(false), 5000)
  }

  const goToNext = () => {
    setCurrentPhotoIndex((prevIndex) => (prevIndex + 1) % coursePhotos.length)
    setIsAutoSlidePaused(true)
    setTimeout(() => setIsAutoSlidePaused(false), 5000)
  }

  const goToSlide = (index: number) => {
    setCurrentPhotoIndex(index)
    setIsAutoSlidePaused(true)
    setTimeout(() => setIsAutoSlidePaused(false), 5000)
  }

  const currentPhoto = coursePhotos && coursePhotos.length > 0 ? coursePhotos[currentPhotoIndex] : null
  const photoUrl = currentPhoto?.photo_url?.startsWith('http')
    ? currentPhoto.photo_url
    : currentPhoto?.photo_url
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tour-course-photos/${currentPhoto.photo_url}`
    : ''
  const photoAlt = locale === 'en'
    ? (currentPhoto?.photo_alt_en || currentPhoto?.photo_alt_ko || 'Tour course photo')
    : (currentPhoto?.photo_alt_ko || currentPhoto?.photo_alt_en || '투어 코스 사진')

  return (
    <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
      {/* 사진 슬라이드쇼 - 카드 상단 */}
      {coursePhotos && coursePhotos.length > 0 && currentPhoto && photoUrl ? (
        <div 
          className="relative w-full aspect-[4/3] bg-gray-200"
          onMouseEnter={() => setIsAutoSlidePaused(true)}
          onMouseLeave={() => setIsAutoSlidePaused(false)}
        >
          <Image
            src={photoUrl}
            alt={photoAlt}
            fill
            sizes="100vw"
            priority={currentPhotoIndex === 0}
            className="object-cover transition-opacity duration-500"
          />
          
          {/* 그라데이션 오버레이 */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          
          {/* 이전/다음 버튼 */}
          {coursePhotos.length > 1 && (
            <>
              <button
                onClick={goToPrevious}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 rounded-full p-2 transition-all z-10"
                aria-label={isEnglish ? 'Previous photo' : '이전 사진'}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={goToNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 rounded-full p-2 transition-all z-10"
                aria-label={isEnglish ? 'Next photo' : '다음 사진'}
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}
          
          {/* 인디케이터 (하단 중앙) */}
          {coursePhotos.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2 z-10">
              {coursePhotos.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`h-2 rounded-full transition-all ${
                    index === currentPhotoIndex
                      ? 'bg-white w-8'
                      : 'bg-white/50 w-2 hover:bg-white/75'
                  }`}
                  aria-label={isEnglish ? `Go to slide ${index + 1}` : `${index + 1}번째 슬라이드로 이동`}
                />
              ))}
            </div>
          )}
          
          {/* 사진 번호 표시 */}
          {coursePhotos.length > 1 && (
            <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm z-10">
              {currentPhotoIndex + 1} / {coursePhotos.length}
            </div>
          )}
        </div>
      ) : (
        // 사진이 없을 때 플레이스홀더
        <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">📷</div>
            <div className="text-lg font-medium text-gray-600">
              {isEnglish ? 'No photos available' : '사진 없음'}
            </div>
          </div>
        </div>
      )}

      {/* 헤더 영역 */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            {/* 계층 구조 경로 (그랜드캐년 > 사우스림 > 그랜드뷰 포인트) */}
            {hierarchyPath && hierarchyPath.length > 0 && (
              <div className="mb-2 text-sm text-gray-600 flex items-center flex-wrap">
                {hierarchyPath.map((name, index) => (
                  <span key={index} className="flex items-center">
                    <span>{name}</span>
                    {index < hierarchyPath.length - 1 && (
                      <span className="mx-2 text-gray-400">›</span>
                    )}
                  </span>
                ))}
              </div>
            )}
            
            {/* 코스 이름과 포인트 라벨 */}
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <h3 className="text-xl font-semibold text-gray-900">
                {customerName}
              </h3>
              {/* 투어 포인트 라벨 */}
              {tourCourse.point_name && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-300">
                  {tourCourse.point_name}
                </span>
              )}
            </div>
            
            {/* 카테고리 */}
            {tourCourse.category && (
              <div className="mb-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {tourCourse.category}
                </span>
              </div>
            )}
          </div>
        </div>
        
        {/* 고객용 설명 */}
        {customerDescription && (
          <div 
            className="text-gray-700 mb-4 leading-relaxed"
            dangerouslySetInnerHTML={{ 
              __html: markdownToHtml(customerDescription) 
            }}
          />
        )}
      </div>
      
      {/* 정보 영역 */}
      <div className="p-6 bg-gray-50">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* 위치 정보 */}
          {tourCourse.location && (
            <div className="flex items-center text-sm text-gray-600">
              <MapPin className="h-4 w-4 mr-2 text-red-500 flex-shrink-0" />
              <span className="truncate">{tourCourse.location}</span>
            </div>
          )}
          
          {/* 소요 시간 */}
          {(tourCourse.duration_hours || tourCourse.duration) && (
            <div className="flex items-center text-sm text-gray-600">
              <Clock className="h-4 w-4 mr-2 text-blue-500 flex-shrink-0" />
              <span>
                {isEnglish ? 'Duration: ' : '소요시간: '}
                {tourCourse.duration_hours 
                  ? `${tourCourse.duration_hours} ${isEnglish ? 'minutes' : '분'}`
                  : tourCourse.duration}
              </span>
            </div>
          )}
          
          {/* 난이도 */}
          {difficulty && (
            <div className="flex items-center text-sm text-gray-600">
              <span className="mr-2">{isEnglish ? 'Difficulty: ' : '난이도: '}</span>
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(difficulty)}`}>
                {getDifficultyLabel(difficulty)}
              </span>
            </div>
          )}
          
        </div>
        
        {/* 하이라이트 */}
        {tourCourse.highlights && tourCourse.highlights.length > 0 && (
          <div className="mb-4">
            <h4 className="font-medium text-gray-900 mb-2 text-sm">{isEnglish ? 'Highlights' : '하이라이트'}</h4>
            <ul className="space-y-1">
              {tourCourse.highlights.map((highlight, index) => (
                <li key={index} className="flex items-start text-sm text-gray-600">
                  <Star className="h-3 w-3 text-yellow-400 mr-2 flex-shrink-0 mt-0.5" />
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* 상세 일정 */}
        {tourCourse.itinerary && (
          <div className="mb-4">
            <h4 className="font-medium text-gray-900 mb-2 text-sm">{isEnglish ? 'Detailed Itinerary' : '상세 일정'}</h4>
            <div className="text-sm text-gray-600 bg-white p-3 rounded border">
              <pre className="whitespace-pre-wrap font-sans">
                {JSON.stringify(tourCourse.itinerary, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ProductDetailPage() {
  const params = useParams()
  const productId = params.id as string
  const locale = useLocale()
  const isEnglish = locale === 'en'

  const [product, setProduct] = useState<Product | null>(null)
  const [productDetails, setProductDetails] = useState<ProductDetails | null>(null)
  const [tourCourses, setTourCourses] = useState<ProductTourCourse[]>([])
  const [tourCoursesMap, setTourCoursesMap] = useState<Map<string, any>>(new Map())
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
  const [isAutoSlidePaused, setIsAutoSlidePaused] = useState(false)
  
  // 부킹 시스템 상태
  const [showBookingFlow, setShowBookingFlow] = useState(false)
  const [showCart, setShowCart] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [paymentData, setPaymentData] = useState<any>(null)
  const [cartItems, setCartItems] = useState<any[]>([])
  const [showChoiceDescriptionModal, setShowChoiceDescriptionModal] = useState(false)
  const [selectedChoiceGroupForModal, setSelectedChoiceGroupForModal] = useState<ChoiceGroup | null>(null)

  const showDetailOnCustomerPage = useCallback(
    (field: string) =>
      isProductDetailVisibleOnCustomerPage(
        productDetails?.customer_page_visibility,
        field
      ),
    [productDetails?.customer_page_visibility]
  )

  const hasVisibleIncludedDetailCards = useMemo(() => {
    if (!productDetails) return false
    const s = showDetailOnCustomerPage
    return !!(
      (productDetails.included && s('included')) ||
      (productDetails.not_included && s('not_included'))
    )
  }, [productDetails, showDetailOnCustomerPage])

  const hasVisibleLogisticsCards = useMemo(() => {
    if (!productDetails) return false
    const s = showDetailOnCustomerPage
    return !!(
      (productDetails.pickup_drop_info && s('pickup_drop_info')) ||
      (productDetails.luggage_info && s('luggage_info')) ||
      (productDetails.tour_operation_info && s('tour_operation_info')) ||
      (productDetails.preparation_info && s('preparation_info')) ||
      (productDetails.small_group_info && s('small_group_info')) ||
      (productDetails.companion_recruitment_info &&
        s('companion_recruitment_info')) ||
      (productDetails.notice_info && s('notice_info'))
    )
  }, [productDetails, showDetailOnCustomerPage])

  const hasVisiblePolicyCards = useMemo(() => {
    if (!productDetails) return false
    const s = showDetailOnCustomerPage
    return !!(
      (productDetails.important_notes && s('important_notes')) ||
      (productDetails.private_tour_info && s('private_tour_info')) ||
      (productDetails.cancellation_policy && s('cancellation_policy')) ||
      (productDetails.chat_announcement && s('chat_announcement'))
    )
  }, [productDetails, showDetailOnCustomerPage])

  // Navigation에서 장바구니 결제 열기 이벤트 리스너
  useEffect(() => {
    const handleOpenCartCheckout = () => {
      setShowCart(false)
      setShowCheckout(true)
    }

    window.addEventListener('openCartCheckout', handleOpenCartCheckout)
    return () => {
      window.removeEventListener('openCartCheckout', handleOpenCartCheckout)
    }
  }, [])

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
        // channel_id가 NULL인 공통 정보를 우선적으로 가져오기
        let detailsData: any = null
        let detailsError: any = null
        
        // 먼저 channel_id가 NULL인 공통 정보 조회
        const { data: commonDetails, error: commonError } = await supabase
          .from('product_details_multilingual')
          .select('*')
          .eq('product_id', productId)
          .eq('language_code', locale)
          .is('channel_id', null)
          .limit(1)
        
        if (!commonError && commonDetails && commonDetails.length > 0) {
          detailsData = commonDetails[0]
        } else {
          // 공통 정보가 없으면 channel_id가 있는 것 중 첫 번째 가져오기
          const { data: channelDetails, error: channelError } = await supabase
            .from('product_details_multilingual')
            .select('*')
            .eq('product_id', productId)
            .eq('language_code', locale)
            .limit(1)
          
          if (!channelError && channelDetails && channelDetails.length > 0) {
            detailsData = channelDetails[0]
          } else {
            detailsError = channelError
          }
        }
        
        if (detailsData) {
          setProductDetails(detailsData)
        } else if (locale !== 'ko') {
          // 폴백: 한국어로 시도
          const { data: fallbackDetails } = await supabase
            .from('product_details_multilingual')
            .select('*')
            .eq('product_id', productId)
            .eq('language_code', 'ko')
            .is('channel_id', null)
            .limit(1)
          
          if (fallbackDetails && fallbackDetails.length > 0) {
            setProductDetails(fallbackDetails[0])
          } else {
            // 한국어 channel_id가 있는 것 중 첫 번째 가져오기
            const { data: koChannelDetails } = await supabase
              .from('product_details_multilingual')
              .select('*')
              .eq('product_id', productId)
              .eq('language_code', 'ko')
              .limit(1)
            
            if (koChannelDetails && koChannelDetails.length > 0) {
              setProductDetails(koChannelDetails[0])
            }
          }
        }
        
        // 3. 투어 코스 정보 가져오기
        // product_tour_courses에서 tour_course_id를 사용하여 tour_courses 조인
        let tourCoursesData: any[] = []
        try {
          const { data: tourCoursesDataResult, error: tourCoursesError } = await supabase
            .from('product_tour_courses')
            .select(`
              *,
              tour_courses(
                *,
                photos:tour_course_photos(*)
              )
            `)
            .eq('product_id', productId)
            .order('created_at', { ascending: true })
          
          if (tourCoursesError) {
            console.error('Error fetching tour courses:', tourCoursesError)
            setTourCourses([])
          } else if (tourCoursesDataResult && tourCoursesDataResult.length > 0) {
            console.log('Tour courses data loaded:', tourCoursesDataResult)
            tourCoursesData = tourCoursesDataResult
            
            // tour_courses 데이터를 tour_course로 매핑
            const mappedData = tourCoursesData.map(item => {
              // Supabase는 foreign key 조인 시 배열 또는 객체로 반환할 수 있음
              let tourCourse = null
              
              if (item.tour_courses) {
                if (Array.isArray(item.tour_courses)) {
                  tourCourse = item.tour_courses[0] || null
                } else {
                  tourCourse = item.tour_courses
                }
              }
              
              return {
                ...item,
                tour_course: tourCourse
              }
            }).filter(item => item.tour_course !== null && item.tour_course !== undefined) // tour_course가 없는 항목 제거
            
            // path를 사용해서 부모 정보 가져오기
            const allCourseIds = new Set<string>()
            mappedData.forEach(item => {
              if (item.tour_course?.path) {
                // path는 "id1.id2.id3" 형식
                const pathIds = item.tour_course.path.split('.').filter(Boolean)
                pathIds.forEach(id => allCourseIds.add(id))
              } else if (item.tour_course?.id) {
                allCourseIds.add(item.tour_course.id)
              }
            })
            
            // 모든 관련 코스 정보 가져오기 (부모 포함)
            if (allCourseIds.size > 0) {
              const { data: allCoursesData, error: allCoursesError } = await supabase
                .from('tour_courses')
                .select('id, customer_name_ko, customer_name_en, name_ko, name_en, parent_id, path, level')
                .in('id', Array.from(allCourseIds))
              
              if (allCoursesError) {
                console.error('Error fetching all courses for hierarchy:', allCoursesError)
              }
              
              if (allCoursesData) {
                console.log('All courses data for hierarchy:', allCoursesData)
                
                // 코스 맵 생성
                const courseMap = new Map<string, any>()
                allCoursesData.forEach(course => {
                  courseMap.set(course.id, course)
                })
                
                console.log('Course map created:', {
                  mapSize: courseMap.size,
                  courseIds: Array.from(courseMap.keys())
                })
                
                // courseMap을 state에 저장 (계층 구조 경로 표시용)
                setTourCoursesMap(courseMap)
                
                // 각 투어 코스에 parent 정보 추가
                mappedData.forEach(item => {
                  if (item.tour_course?.path) {
                    const pathIds = item.tour_course.path.split('.').filter(Boolean)
                    const parents: any[] = []
                    
                    // path에서 현재 코스를 제외한 부모들만 가져오기
                    for (let i = 0; i < pathIds.length - 1; i++) {
                      const parentId = pathIds[i]
                      const parent = courseMap.get(parentId)
                      if (parent) {
                        parents.push(parent)
                      }
                    }
                    
                    // parent 체인 구성
                    if (parents.length > 0) {
                      // 역순으로 parent 체인 구성
                      let currentParent: any = null
                      for (let i = parents.length - 1; i >= 0; i--) {
                        const parent = { ...parents[i], parent: currentParent }
                        currentParent = parent
                      }
                      item.tour_course.parent = currentParent
                    }
                  } else if (item.tour_course?.parent_id) {
                    // path가 없으면 parent_id로 직접 찾기
                    const parent = courseMap.get(item.tour_course.parent_id)
                    if (parent) {
                      item.tour_course.parent = parent
                    }
                  }
                })
              }
            }
            
            // 계층별로 정렬
            const sortedData = mappedData.sort((a, b) => {
              const courseA = a.tour_course
              const courseB = b.tour_course
              
              // 1. level 순서로 정렬 (낮은 레벨이 먼저)
              const levelA = courseA?.level ?? 999
              const levelB = courseB?.level ?? 999
              if (levelA !== levelB) {
                return levelA - levelB
              }
              
              // 2. 같은 레벨 내에서는 path 순서로 정렬
              const pathA = courseA?.path || ''
              const pathB = courseB?.path || ''
              if (pathA && pathB) {
                // path 길이로 비교 (짧은 path가 먼저 = 부모가 먼저)
                if (pathA.length !== pathB.length) {
                  return pathA.length - pathB.length
                }
                // 같은 길이면 문자열 비교
                return pathA.localeCompare(pathB)
              }
              
              // 3. sort_order로 정렬
              const sortOrderA = courseA?.sort_order ?? 999
              const sortOrderB = courseB?.sort_order ?? 999
              if (sortOrderA !== sortOrderB) {
                return sortOrderA - sortOrderB
              }
              
              // 4. 이름으로 정렬
              const nameA = locale === 'en'
                ? (courseA?.customer_name_en || courseA?.name_en || courseA?.name_ko || courseA?.name || '')
                : (courseA?.customer_name_ko || courseA?.name_ko || courseA?.name || '')
              const nameB = locale === 'en'
                ? (courseB?.customer_name_en || courseB?.name_en || courseB?.name_ko || courseB?.name || '')
                : (courseB?.customer_name_ko || courseB?.name_ko || courseB?.name || '')
              
              return nameA.localeCompare(nameB)
            })
            
            console.log('Mapped tour courses:', sortedData)
            setTourCourses(sortedData)
          } else {
            console.log('No tour courses data found for product:', productId)
            setTourCourses([])
          }
        } catch (error) {
          console.error('Exception while fetching tour courses:', error)
          setTourCourses([])
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
              choice_group_en,
              description_ko,
              description_en,
              choice_type,
              options:choice_options (
                id,
                option_key,
                option_name,
                option_name_ko,
                description,
                description_ko,
                adult_price,
                child_price,
                infant_price,
                is_default,
                is_active,
                sort_order,
                image_url,
                image_alt,
                thumbnail_url
              )
            `)
            .eq('product_id', productId)
            .order('sort_order', { ascending: true })

          if (fallbackError) {
            console.error('product_choices 로드 오류:', fallbackError)
            console.error('에러 상세:', JSON.stringify(fallbackError, null, 2))
            // 에러가 발생해도 빈 배열로 설정
            setProductChoices([])
          } else if (fallbackChoices) {
            const flattenedChoices: ProductChoice[] = fallbackChoices.flatMap((choice: any) => {
              // 로케일에 맞는 초이스 그룹명 우선 사용 (템플릿을 사용하지 않은 경우 choice_group이 아이디일 수 있음)
              const choiceNameKo = choice.choice_group_ko || null
              const choiceNameEn = choice.choice_group_en || null
              // choice_name은 나중에 groupedChoices에서 로케일에 맞게 설정되므로, 여기서는 기본값만 설정
              // choice_group이 아이디인지 확인 (한글/영어 이름이 없으면 choice_group 사용)
              const choiceName = choiceNameKo || choiceNameEn || choice.choice_group || ''
              const choiceType = choice.choice_type || 'single'
              const options = Array.isArray(choice.options) ? choice.options.filter((opt: any) => opt.is_active !== false) : []

              return options.map((option: any) => ({
                product_id: choice.product_id,
                product_name: product?.name || product?.customer_name_ko || '',
                choice_id: choice.id,
                choice_name: choiceName, // 기본값 (나중에 groupedChoices에서 로케일에 맞게 재설정됨)
                choice_name_ko: choiceNameKo,
                choice_name_en: choiceNameEn,
                choice_type: choiceType,
                choice_description: choice.description_en || null,
                choice_description_ko: choice.description_ko || null,
                choice_description_en: choice.description_en || null,
                choice_image_url: null, // product_choices 테이블에 image_url 필드가 없을 수 있음
                choice_thumbnail_url: null,
                option_id: option.id,
                option_name: option.option_name || option.option_key || '',
                option_name_ko: option.option_name_ko || null,
                option_price: option.adult_price ?? null,
                option_child_price: option.child_price ?? null,
                option_infant_price: option.infant_price ?? null,
                is_default: option.is_default ?? null,
                option_image_url: option.image_url || null,
                option_thumbnail_url: option.thumbnail_url || null,
                option_description: option.description || null,
                option_description_ko: option.description_ko || null
              }))
            })

            setProductChoices(flattenedChoices)
            console.log('ProductDetailPage - productChoices 로드 완료:', flattenedChoices.length, '개')
          } else {
            console.log('ProductDetailPage - productChoices 데이터 없음')
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
        // 원본 투어 코스 데이터에서 course_id 추출
        if (tourCoursesData && tourCoursesData.length > 0) {
          const courseIds = tourCoursesData
            .map(tc => {
              // tour_courses가 배열인 경우 첫 번째 요소, 아니면 객체 자체
              const tourCourse = Array.isArray(tc.tour_courses) 
                ? tc.tour_courses[0] 
                : tc.tour_courses
              return tourCourse?.id
            })
            .filter(Boolean) as string[]
          
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

  // 자동 슬라이드 기능
  useEffect(() => {
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

    // 이미지가 1개 이하면 자동 슬라이드 불필요
    if (allImages.length <= 1 || isAutoSlidePaused) {
      return
    }

    const interval = setInterval(() => {
      setSelectedImageIndex((prevIndex) => {
        return (prevIndex + 1) % allImages.length
      })
    }, 4000) // 4초마다 자동 슬라이드

    return () => clearInterval(interval)
  }, [productMedia, tourCoursePhotos, isAutoSlidePaused])

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
      // 로케일에 맞는 초이스 그룹명 우선 사용
      const displayName = isEnglish 
        ? (choice.choice_name_en || choice.choice_name_ko || choice.choice_name)
        : (choice.choice_name_ko || choice.choice_name_en || choice.choice_name)
      
      groups[groupKey] = {
        choice_id: choice.choice_id,
        choice_name: displayName, // 로케일에 맞는 이름으로 설정
        choice_name_ko: choice.choice_name_ko,
        choice_name_en: choice.choice_name_en || null,
        choice_type: choice.choice_type,
        choice_description: choice.choice_description,
        choice_description_ko: choice.choice_description_ko || null,
        choice_description_en: choice.choice_description_en || null,
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
    setShowCart(false)
    setShowCheckout(true)
  }

  const handleCheckoutSuccess = () => {
    setShowCheckout(false)
    setCartItems([])
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
                  <div 
                    className="relative w-full h-[600px] bg-gray-200 flex items-center justify-center" 
                    onMouseEnter={() => setIsAutoSlidePaused(true)}
                    onMouseLeave={() => setIsAutoSlidePaused(false)}
                  >
                    <Image
                      src={allImages[selectedImageIndex].file_url}
                      alt={allImages[selectedImageIndex].alt_text || allImages[selectedImageIndex].file_name}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 66vw, 800px"
                      priority
                      className="object-contain transition-opacity duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                    <div className="absolute top-4 right-4 flex space-x-2 z-10">
                      <button className="p-2 bg-white/80 rounded-full hover:bg-white transition-colors">
                        <Heart size={20} className="text-gray-600" />
                      </button>
                      <button className="p-2 bg-white/80 rounded-full hover:bg-white transition-colors">
                        <Share2 size={20} className="text-gray-600" />
                      </button>
                    </div>
                  </div>
                  
                  {/* 썸네일 갤러리 */}
                  <div 
                    className="p-4"
                    onMouseEnter={() => setIsAutoSlidePaused(true)}
                    onMouseLeave={() => setIsAutoSlidePaused(false)}
                  >
                    <div className="flex space-x-2 overflow-x-auto">
                      {allImages.slice(0, 8).map((image, index) => (
                        <div 
                          key={image.id} 
                          className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-200 relative border-2 ${selectedImageIndex === index ? 'border-blue-500' : 'border-transparent'}`}
                        >
                          <Image
                            src={image.file_url}
                            alt={image.alt_text || image.file_name}
                            fill
                            sizes="80px"
                            className="object-cover cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => {
                              setSelectedImageIndex(index)
                              setIsAutoSlidePaused(true)
                              // 3초 후 자동 슬라이드 재개
                              setTimeout(() => setIsAutoSlidePaused(false), 3000)
                            }}
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
                  <div className="space-y-8">
                    {/* 슬로건 섹션 */}
                    {productDetails &&
                      (productDetails.slogan1 || productDetails.slogan2 || productDetails.slogan3) &&
                      showDetailOnCustomerPage('slogan1') && (
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                        <div className="space-y-3">
                          {productDetails.slogan1 && (
                            <div className="text-3xl font-bold text-blue-700">
                              {productDetails.slogan1}
                            </div>
                          )}
                          {productDetails.slogan2 && (
                            <div className="text-xl font-semibold text-gray-800">
                              {productDetails.slogan2}
                            </div>
                          )}
                          {productDetails.slogan3 && (
                            <div className="text-base text-gray-700">
                              {productDetails.slogan3}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {productDetails?.greeting && showDetailOnCustomerPage('greeting') && (
                      <div className="bg-white rounded-xl shadow-sm border border-emerald-200 p-6">
                        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-200">
                          <div className="p-2 bg-emerald-100 rounded-lg">
                            <Info className="h-5 w-5 text-emerald-600" />
                          </div>
                          <h3 className="text-xl font-semibold text-gray-900">{isEnglish ? 'Greeting' : '인사말'}</h3>
                        </div>
                        <div
                          className="text-gray-700 leading-relaxed prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{
                            __html: markdownToHtml(productDetails.greeting || '')
                          }}
                        />
                      </div>
                    )}

                    {/* 투어 소개 섹션 */}
                    {showDetailOnCustomerPage('description') && (
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-200">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Info className="h-5 w-5 text-blue-600" />
                          </div>
                          <h3 className="text-xl font-semibold text-gray-900">{isEnglish ? 'Tour Overview' : '투어 소개'}</h3>
                        </div>
                        <div 
                          className="text-gray-700 leading-relaxed prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ 
                            __html: markdownToHtml(productDetails?.description || product.description || getCustomerDisplayName(product) || '') 
                          }}
                        />
                      </div>
                    )}

                    {/* 기본 정보 섹션 */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <Settings className="h-5 w-5 text-green-600" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900">{isEnglish ? 'Key Information' : '기본 정보'}</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                          <div className="p-3 bg-blue-100 rounded-lg flex-shrink-0">
                            <Calendar className="h-6 w-6 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-gray-600 block mb-1">{isEnglish ? 'Duration' : '기간'}</span>
                            <p className="text-lg font-semibold text-gray-900">{formatDuration(product.duration)}</p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                          <div className="p-3 bg-green-100 rounded-lg flex-shrink-0">
                            <Users className="h-6 w-6 text-green-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-gray-600 block mb-1">{isEnglish ? 'Maximum Participants' : '최대 참가자'}</span>
                            <p className="text-lg font-semibold text-gray-900">
                              {product.max_participants || 0}
                              {isEnglish ? ' people' : '명'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                          <div className="p-3 bg-red-100 rounded-lg flex-shrink-0">
                            <MapPin className="h-6 w-6 text-red-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-gray-600 block mb-1">{isEnglish ? 'Category' : '카테고리'}</span>
                            <p className="text-lg font-semibold text-gray-900">{getCategoryLabel(product.category || '')}</p>
                          </div>
                        </div>
                        {product.group_size && (
                          <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                            <div className="p-3 bg-purple-100 rounded-lg flex-shrink-0">
                              <Users2 className="h-6 w-6 text-purple-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-gray-600 block mb-1">{isEnglish ? 'Group Size' : '그룹 크기'}</span>
                              <p className="text-lg font-semibold text-gray-900">{product.group_size}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 태그 섹션 */}
                    {((product.tags && product.tags.length > 0) || (productDetails?.tags && productDetails.tags.length > 0)) && (
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-200">
                          <div className="p-2 bg-yellow-100 rounded-lg">
                            <Lightbulb className="h-5 w-5 text-yellow-600" />
                          </div>
                          <h3 className="text-xl font-semibold text-gray-900">{isEnglish ? 'Tags' : '태그'}</h3>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {(productDetails?.tags || product.tags || []).map((tag, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200 hover:from-blue-100 hover:to-indigo-100 transition-colors"
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
                  <div>
                    {/* 투어 코스 설명 */}
                    <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
                      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <MapPin className="w-5 h-5" />
                        {isEnglish ? 'Tour Course Description' : '투어 코스 설명'}
                      </h2>
                      <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-gray-50">
                        {tourCourses.length > 0 ? (
                          (() => {
                            // 모든 부모 이름을 계층적으로 가져오는 함수
                            const getFullCoursePath = (course: TourCourse, isEnglish: boolean): string => {
                              const path: string[] = []
                              let current: TourCourse | undefined = course
                              const visited = new Set<string>() // 순환 참조 방지
                              
                              while (current && !visited.has(current.id)) {
                                visited.add(current.id)
                                const courseName = isEnglish 
                                  ? (current.customer_name_en || current.customer_name_ko || current.name_en || current.name_ko || '')
                                  : (current.customer_name_ko || current.customer_name_en || current.name_ko || current.name_en || '')
                                
                                if (courseName.trim()) {
                                  path.unshift(courseName)
                                }
                                
                                if (!current || !current.parent_id) {
                                  break
                                }
                                
                                const parentId: string | null = current.parent_id
                                const parent: TourCourse | undefined = tourCourses.find((ptc) => ptc.tour_course?.id === parentId)?.tour_course
                                if (parent) {
                                  current = parent
                                } else {
                                  break
                                }
                              }
                              
                              return path.join(' > ')
                            }

                            // 이름과 설명이 모두 있는 코스만 필터링
                            const validCourses = tourCourses
                              .map(ptc => ptc.tour_course)
                              .filter((course): course is TourCourse => {
                                if (!course) return false
                                const courseName = isEnglish 
                                  ? (course.customer_name_en || course.customer_name_ko || course.name_en || course.name_ko || '')
                                  : (course.customer_name_ko || course.customer_name_en || course.name_ko || course.name_en || '')
                                const courseDescription = isEnglish
                                  ? (course.customer_description_en || course.customer_description_ko || '')
                                  : (course.customer_description_ko || course.customer_description_en || '')
                                
                                // 이름 또는 설명 중 하나라도 있으면 포함
                                return courseName.trim() !== '' || courseDescription.trim() !== ''
                              })

                            if (validCourses.length === 0) {
                              return (
                                <p className="text-sm text-gray-500 text-center py-4">
                                  {isEnglish ? 'No tour course information available.' : '투어 코스 정보가 없습니다.'}
                                </p>
                              )
                            }

                            // 부모별로 그룹화
                            const groupedCourses = new Map<string, TourCourse[]>()
                            validCourses.forEach(course => {
                              const parentId = course.parent_id || 'root'
                              if (!groupedCourses.has(parentId)) {
                                groupedCourses.set(parentId, [])
                              }
                              groupedCourses.get(parentId)!.push(course)
                            })

                            // 그룹별로 렌더링
                            const result: JSX.Element[] = []
                            groupedCourses.forEach((courses, parentId) => {
                              // 부모 이름 가져오기
                              let groupHeader = ''
                              if (parentId !== 'root') {
                                const parentCourse = tourCourses.find(ptc => ptc.tour_course?.id === parentId)?.tour_course
                                if (parentCourse) {
                                  const parentName = isEnglish 
                                    ? (parentCourse.customer_name_en || parentCourse.customer_name_ko || parentCourse.name_en || parentCourse.name_ko || '')
                                    : (parentCourse.customer_name_ko || parentCourse.customer_name_en || parentCourse.name_ko || parentCourse.name_en || '')
                                  
                                  // 부모의 부모도 확인하여 전체 경로 생성
                                  if (parentCourse.parent_id) {
                                    const grandParent = tourCourses.find(ptc => ptc.tour_course?.id === parentCourse.parent_id)?.tour_course
                                    if (grandParent) {
                                      const grandParentName = isEnglish 
                                        ? (grandParent.customer_name_en || grandParent.customer_name_ko || grandParent.name_en || grandParent.name_ko || '')
                                        : (grandParent.customer_name_ko || grandParent.customer_name_en || grandParent.name_ko || grandParent.name_en || '')
                                      if (grandParentName.trim()) {
                                        groupHeader = `${grandParentName} > ${parentName}`
                                      } else {
                                        groupHeader = parentName
                                      }
                                    } else {
                                      groupHeader = parentName
                                    }
                                  } else {
                                    groupHeader = parentName
                                  }
                                }
                              }

                              // 그룹 헤더 추가
                              if (groupHeader && courses.length > 0) {
                                result.push(
                                  <div key={`group-${parentId}`} className="bg-gray-100 border border-gray-200 rounded-lg p-3 mb-4">
                                    <div className="font-semibold text-gray-900">{groupHeader}</div>
                                  </div>
                                )
                              }

                              // 각 코스 렌더링
                              courses.forEach(course => {
                                const fullCourseName = getFullCoursePath(course, isEnglish)
                                
                                const courseDescription = isEnglish
                                  ? (course.customer_description_en || course.customer_description_ko || '')
                                  : (course.customer_description_ko || course.customer_description_en || '')

                                // 사진 가져오기
                                const coursePhotos = (course.photos || tourCoursePhotos.filter(p => p.course_id === course.id))
                                  .sort((a, b) => {
                                    if (a.is_primary && !b.is_primary) return -1
                                    if (!a.is_primary && b.is_primary) return 1
                                    return (a.sort_order || 0) - (b.sort_order || 0)
                                  })

                                // 대표 사진 우선, 없으면 첫 번째 사진
                                const primaryPhoto = coursePhotos.find(p => p.is_primary) || coursePhotos[0]
                                const photoUrl = primaryPhoto?.photo_url || primaryPhoto?.thumbnail_url || null
                                
                                // 사진 URL이 상대 경로인 경우 절대 경로로 변환
                                let fullPhotoUrl = photoUrl
                                if (photoUrl && !photoUrl.startsWith('http')) {
                                  fullPhotoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tour-course-photos/${photoUrl}`
                                }

                                result.push(
                                  <div key={course.id} className="bg-white border border-gray-200 rounded-lg p-4">
                                    <div className="flex gap-4 items-start">
                                      {/* 왼쪽: 사진 */}
                                      {fullPhotoUrl && (
                                        <div className="flex-shrink-0 w-48">
                                          <img 
                                            src={fullPhotoUrl} 
                                            alt={fullCourseName || 'Course image'} 
                                            className="w-full h-36 object-cover rounded-lg border border-gray-200"
                                          />
                                        </div>
                                      )}
                                      {/* 오른쪽: 제목과 설명 */}
                                      <div className="flex-1 min-w-0">
                                        {fullCourseName.trim() !== '' && (
                                          <div className="font-semibold text-gray-900 mb-2">
                                            {fullCourseName}
                                          </div>
                                        )}
                                        {courseDescription && courseDescription.trim() !== '' && (
                                          <div 
                                            className="text-sm text-gray-700 whitespace-pre-wrap"
                                            dangerouslySetInnerHTML={{ 
                                              __html: markdownToHtml(courseDescription) 
                                            }}
                                          />
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })
                            })

                            return result
                          })()
                        ) : (
                          <p className="text-sm text-gray-500 text-center py-4">
                            {isEnglish ? 'No tour course information available.' : '투어 코스 정보가 없습니다.'}
                          </p>
                        )}
                      </div>
                    </div>
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
                          {productDetails?.included && showDetailOnCustomerPage('included') && (
                            <div className="group relative overflow-hidden bg-white border border-green-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300">
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 via-green-500 to-green-600"></div>
                              <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="p-2 bg-gradient-to-br from-green-100 to-green-200 rounded-lg">
                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                  </div>
                                  <h4 className="text-lg font-semibold text-gray-900">{isEnglish ? 'Included' : '포함 사항'}</h4>
                                </div>
                                <div 
                                  className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{ 
                                    __html: markdownToHtml(productDetails.included || '') 
                                  }}
                                />
                              </div>
                            </div>
                          )}
                          {productDetails?.not_included && showDetailOnCustomerPage('not_included') && (
                            <div className="group relative overflow-hidden bg-white border border-red-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300">
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 via-red-500 to-red-600"></div>
                              <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="p-2 bg-gradient-to-br from-red-100 to-red-200 rounded-lg">
                                    <XCircle className="w-5 h-5 text-red-600" />
                                  </div>
                                  <h4 className="text-lg font-semibold text-gray-900">{isEnglish ? 'Excluded' : '불포함 사항'}</h4>
                                </div>
                                <div 
                                  className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{ 
                                    __html: markdownToHtml(productDetails.not_included || '') 
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {!hasVisibleIncludedDetailCards && (
                          <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                            <div className="text-gray-400 mb-2 text-4xl">📋</div>
                            <p className="text-gray-600">{isEnglish ? 'No inclusion or exclusion details available' : '포함/불포함 정보가 없습니다'}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 운영정보 탭 */}
                    {activeDetailTab === 'logistics' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 gap-6">
                          {productDetails?.pickup_drop_info && showDetailOnCustomerPage('pickup_drop_info') && (
                            <div className="group relative overflow-hidden bg-white border border-blue-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300">
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600"></div>
                              <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="p-2 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg">
                                    <Car className="w-5 h-5 text-blue-600" />
                                  </div>
                                  <h4 className="text-lg font-semibold text-gray-900">{isEnglish ? 'Pickup & Drop-off Information' : '픽업/드롭 정보'}</h4>
                                </div>
                                <div 
                                  className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{ 
                                    __html: markdownToHtml(productDetails.pickup_drop_info || '') 
                                  }}
                                />
                              </div>
                            </div>
                          )}
                          
                          {productDetails?.luggage_info && showDetailOnCustomerPage('luggage_info') && (
                            <div className="group relative overflow-hidden bg-white border border-yellow-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300">
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600"></div>
                              <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="p-2 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-lg">
                                    <Luggage className="w-5 h-5 text-yellow-600" />
                                  </div>
                                  <h4 className="text-lg font-semibold text-gray-900">{isEnglish ? 'Luggage Information' : '짐 정보'}</h4>
                                </div>
                                <div 
                                  className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{ 
                                    __html: markdownToHtml(productDetails.luggage_info || '') 
                                  }}
                                />
                              </div>
                            </div>
                          )}
                          
                          {productDetails?.tour_operation_info && showDetailOnCustomerPage('tour_operation_info') && (
                            <div className="group relative overflow-hidden bg-white border border-purple-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300">
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 via-purple-500 to-purple-600"></div>
                              <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="p-2 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg">
                                    <Settings className="w-5 h-5 text-purple-600" />
                                  </div>
                                  <h4 className="text-lg font-semibold text-gray-900">{isEnglish ? 'Tour Operations' : '투어 운영 정보'}</h4>
                                </div>
                                <div 
                                  className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{ 
                                    __html: markdownToHtml(productDetails.tour_operation_info || '') 
                                  }}
                                />
                              </div>
                            </div>
                          )}
                          
                          {productDetails?.preparation_info && showDetailOnCustomerPage('preparation_info') && (
                            <div className="group relative overflow-hidden bg-white border border-orange-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300">
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600"></div>
                              <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="p-2 bg-gradient-to-br from-orange-100 to-orange-200 rounded-lg">
                                    <Lightbulb className="w-5 h-5 text-orange-600" />
                                  </div>
                                  <h4 className="text-lg font-semibold text-gray-900">{isEnglish ? 'Preparation Tips' : '준비사항'}</h4>
                                </div>
                                <div 
                                  className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{ 
                                    __html: markdownToHtml(productDetails.preparation_info || '') 
                                  }}
                                />
                              </div>
                            </div>
                          )}
                          
                          {productDetails?.small_group_info && showDetailOnCustomerPage('small_group_info') && (
                            <div className="group relative overflow-hidden bg-white border border-indigo-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300">
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-400 via-indigo-500 to-indigo-600"></div>
                              <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="p-2 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-lg">
                                    <Users2 className="w-5 h-5 text-indigo-600" />
                                  </div>
                                  <h4 className="text-lg font-semibold text-gray-900">{isEnglish ? 'Small Group Details' : '소그룹 정보'}</h4>
                                </div>
                                <div 
                                  className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{ 
                                    __html: markdownToHtml(productDetails.small_group_info || '') 
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          {productDetails?.companion_recruitment_info && showDetailOnCustomerPage('companion_recruitment_info') && (
                            <div className="group relative overflow-hidden bg-white border border-teal-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300">
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-400 via-teal-500 to-teal-600"></div>
                              <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="p-2 bg-gradient-to-br from-teal-100 to-teal-200 rounded-lg">
                                    <Users2 className="w-5 h-5 text-teal-600" />
                                  </div>
                                  <h4 className="text-lg font-semibold text-gray-900">{isEnglish ? 'Companion recruitment' : '동행모집 안내'}</h4>
                                </div>
                                <div
                                  className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{
                                    __html: markdownToHtml(productDetails.companion_recruitment_info || '')
                                  }}
                                />
                              </div>
                            </div>
                          )}
                          
                          {productDetails?.notice_info && showDetailOnCustomerPage('notice_info') && (
                            <div className="group relative overflow-hidden bg-white border border-red-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300">
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 via-red-500 to-red-600"></div>
                              <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="p-2 bg-gradient-to-br from-red-100 to-red-200 rounded-lg">
                                    <AlertTriangle className="w-5 h-5 text-red-600" />
                                  </div>
                                  <h4 className="text-lg font-semibold text-gray-900">{isEnglish ? 'Important Notes' : '주의사항'}</h4>
                                </div>
                                <div 
                                  className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{ 
                                    __html: markdownToHtml(productDetails.notice_info || '') 
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {!hasVisibleLogisticsCards && (
                          <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                            <div className="text-gray-400 mb-2 text-4xl">🚌</div>
                            <p className="text-gray-600">{isEnglish ? 'No logistics information available' : '운영 정보가 없습니다'}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 정책 탭 */}
                    {activeDetailTab === 'policy' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 gap-6">
                          {productDetails?.important_notes && showDetailOnCustomerPage('important_notes') && (
                            <div className="group relative overflow-hidden bg-white border border-amber-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300">
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600"></div>
                              <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="p-2 bg-gradient-to-br from-amber-100 to-amber-200 rounded-lg">
                                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                                  </div>
                                  <h4 className="text-lg font-semibold text-gray-900">IMPORTANT NOTES</h4>
                                </div>
                                <div
                                  className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{
                                    __html: markdownToHtml(productDetails.important_notes || '')
                                  }}
                                />
                              </div>
                            </div>
                          )}
                          {productDetails?.private_tour_info && showDetailOnCustomerPage('private_tour_info') && (
                            <div className="group relative overflow-hidden bg-white border border-purple-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300">
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 via-purple-500 to-purple-600"></div>
                              <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="p-2 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg">
                                    <Users className="w-5 h-5 text-purple-600" />
                                  </div>
                                  <h4 className="text-lg font-semibold text-gray-900">{isEnglish ? 'Private Tour Information' : '프라이빗 투어 정보'}</h4>
                                </div>
                                <div 
                                  className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{ 
                                    __html: markdownToHtml(productDetails.private_tour_info || '') 
                                  }}
                                />
                              </div>
                            </div>
                          )}
                          
                          {productDetails?.cancellation_policy && showDetailOnCustomerPage('cancellation_policy') && (
                            <div className="group relative overflow-hidden bg-white border border-red-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300">
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 via-red-500 to-red-600"></div>
                              <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="p-2 bg-gradient-to-br from-red-100 to-red-200 rounded-lg">
                                    <Shield className="w-5 h-5 text-red-600" />
                                  </div>
                                  <h4 className="text-lg font-semibold text-gray-900">{isEnglish ? 'Cancellation Policy' : '취소 정책'}</h4>
                                </div>
                                <div 
                                  className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{ 
                                    __html: markdownToHtml(productDetails.cancellation_policy || '') 
                                  }}
                                />
                              </div>
                            </div>
                          )}
                          
                          {productDetails?.chat_announcement && showDetailOnCustomerPage('chat_announcement') && (
                            <div className="group relative overflow-hidden bg-white border border-blue-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300">
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600"></div>
                              <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="p-2 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg">
                                    <Megaphone className="w-5 h-5 text-blue-600" />
                                  </div>
                                  <h4 className="text-lg font-semibold text-gray-900">{isEnglish ? 'Announcements' : '공지사항'}</h4>
                                </div>
                                <div 
                                  className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{ 
                                    __html: markdownToHtml(productDetails.chat_announcement || '') 
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {!hasVisiblePolicyCards && (
                          <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                            <div className="text-gray-400 mb-2 text-4xl">📋</div>
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
                <div className="text-sm text-gray-600 mb-2">
                  {isEnglish ? 'Total price' : '총 가격'}
                </div>
                {/* 가격 상세 내역 */}
                <div className="text-left border-t border-gray-200 pt-4 mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{isEnglish ? 'Base price' : '기본 가격'}</span>
                    <span className="font-medium text-gray-900">
                      ${product.base_price || 0}
                    </span>
                  </div>
                  {/* 선택 옵션 가격 표시 */}
                  {Object.values(groupedChoices).map((group: ChoiceGroup) => {
                    const selectedOptionId = selectedOptions[group.choice_id]
                    if (selectedOptionId) {
                      const option = group.options.find((opt) => opt.option_id === selectedOptionId)
                      if (option && option.option_price && option.option_price > 0) {
                        return (
                          <div key={group.choice_id} className="flex justify-between text-sm">
                            <span className="text-gray-600">
                              {group.choice_name}
                            </span>
                            <span className="font-medium text-gray-900">
                              +${option.option_price}
                            </span>
                          </div>
                        )
                      }
                    }
                    return null
                  })}
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

              {/* 필수 선택 */}
              {Object.keys(groupedChoices).length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900">{isEnglish ? 'Required Selection' : '필수 선택'}</h4>
                    <button
                      type="button"
                      onClick={() => {
                        // 모든 그룹의 설명을 하나의 모달에 표시
                        setShowChoiceDescriptionModal(true)
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200"
                    >
                      <Info className="w-4 h-4" />
                      <span>{isEnglish ? 'Compare Options' : '차이점 확인하기'}</span>
                    </button>
                  </div>
                  <div className="space-y-4">
                    {Object.values(groupedChoices).map((group: ChoiceGroup) => (
                      <div key={group.choice_id}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {group.choice_name}
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

              {/* 포함 사항 섹션 */}
              {productDetails?.included && showDetailOnCustomerPage('included') && (
                <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-lg shadow-sm border-2 border-emerald-200 p-6 mt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 bg-emerald-500 rounded-lg shadow-sm">
                      <CheckCircle2 className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-emerald-800">{isEnglish ? 'Included' : '포함 사항'}</h3>
                  </div>
                  <div 
                    className="text-sm text-gray-800 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ 
                      __html: markdownToHtml(formatInclusionList(productDetails.included || '', true)) 
                    }}
                  />
                </div>
              )}

              {/* 불포함 사항 섹션 */}
              {productDetails?.not_included && showDetailOnCustomerPage('not_included') && (
                <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-lg shadow-sm border-2 border-red-200 p-6 mt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 bg-red-500 rounded-lg shadow-sm">
                      <XCircle className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-red-800">{isEnglish ? 'Excluded' : '불포함 사항'}</h3>
                  </div>
                  <div 
                    className="text-sm text-gray-800 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ 
                      __html: markdownToHtml(formatInclusionList(productDetails.not_included || '', false)) 
                    }}
                  />
                </div>
              )}
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

      {/* 장바구니 결제 페이지 (쿠폰 적용 + 여러 상품 결제) */}
      <CartCheckout
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        onSuccess={handleCheckoutSuccess}
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

      {/* 초이스 그룹 설명 모달 */}
      {showChoiceDescriptionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  {isEnglish ? 'Choice Group Descriptions' : '초이스 그룹 설명'}
                </h2>
                <button
                  onClick={() => setShowChoiceDescriptionModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[80vh]">
              <div className="space-y-6">
                {Object.values(groupedChoices).map((group: ChoiceGroup) => {
                  const groupDescription = isEnglish 
                    ? (group.choice_description_en || group.choice_description)
                    : (group.choice_description_ko || group.choice_description)
                  
                  if (!groupDescription || !groupDescription.trim()) {
                    return null
                  }
                  
                  return (
                    <div key={group.choice_id} className="border-b border-gray-200 pb-6 last:border-b-0 last:pb-0">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        {group.choice_name}
                      </h3>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {groupDescription}
                        </p>
                      </div>
                    </div>
                  )
                })}
                {Object.values(groupedChoices).every((group: ChoiceGroup) => {
                  const groupDescription = isEnglish 
                    ? (group.choice_description_en || group.choice_description)
                    : (group.choice_description_ko || group.choice_description)
                  return !groupDescription || !groupDescription.trim()
                }) && (
                  <div className="text-center py-8 text-gray-500">
                    <p>{isEnglish ? 'No descriptions available for choice groups.' : '초이스 그룹에 대한 설명이 없습니다.'}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
