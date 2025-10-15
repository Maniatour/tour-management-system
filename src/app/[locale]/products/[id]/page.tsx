'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Star, MapPin, Users, Calendar, Clock, Heart, Share2, Phone, Mail, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import ProductFaqDisplay from '@/components/ProductFaqDisplay'
import ProductMediaDisplay from '@/components/ProductMediaDisplay'
import TourScheduleSection from '@/components/product/TourScheduleSection'
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
  
  const [product, setProduct] = useState<Product | null>(null)
  const [productDetails, setProductDetails] = useState<ProductDetails | null>(null)
  const [tourCourses, setTourCourses] = useState<ProductTourCourse[]>([])
  const [productChoices, setProductChoices] = useState<ProductChoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState('overview')

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
          setError('상품을 찾을 수 없습니다.')
          return
        }
        
        setProduct(productData)
        
        // 2. 다국어 상세 정보 가져오기
        const { data: detailsData, error: detailsError } = await supabase
          .from('product_details_multilingual')
          .select('*')
          .eq('product_id', productId)
          .eq('language_code', locale)
          .single()
        
        if (!detailsError && detailsData) {
          setProductDetails(detailsData)
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
        
        // 4. 선택 옵션 정보 가져오기 (view 사용)
        const { data: choicesData, error: choicesError } = await supabase
          .from('product_choices_view')
          .select('*')
          .eq('product_id', productId)
        
        if (!choicesError && choicesData) {
          setProductChoices(choicesData)
        }
        
      } catch (error) {
        console.error('상품 데이터 로드 오류:', error)
        setError('상품 정보를 불러오는데 실패했습니다.')
      } finally {
        setLoading(false)
      }
    }

    if (productId) {
      loadProductData()
    }
  }, [productId, locale])

  const getDifficultyLabel = (difficulty: string) => {
    const difficultyLabels: { [key: string]: string } = {
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
    const categoryLabels: { [key: string]: string } = {
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

  const getProductDisplayName = (product: Product) => {
    if (locale === 'en' && product.name_en) {
      return product.name_en
    }
    return product.name_ko || product.name
  }

  const getCustomerDisplayName = (product: Product) => {
    if (locale === 'en' && product.customer_name_en) {
      return product.customer_name_en
    }
    return product.customer_name_ko || product.name_ko || product.name
  }

  const tabs = [
    { id: 'overview', label: '개요' },
    { id: 'itinerary', label: '일정' },
    { id: 'tour-schedule', label: '투어 스케줄' },
    { id: 'details', label: '상세정보' },
    { id: 'faq', label: 'FAQ' },
    { id: 'media', label: '미디어' }
  ]

  const detailTabs = [
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
          <p className="text-gray-600">상품 정보를 불러오는 중...</p>
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
          <h2 className="text-xl font-semibold text-gray-900 mb-2">오류가 발생했습니다</h2>
          <p className="text-gray-600 mb-4">{error || '상품을 찾을 수 없습니다.'}</p>
          <Link 
            href="/products" 
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            상품 목록으로 돌아가기
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
          <div className="flex items-center space-x-4">
            <Link href="/ko/products" className="text-gray-500 hover:text-gray-700">
              <ArrowLeft size={24} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {getProductDisplayName(product)}
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 메인 콘텐츠 */}
          <div className="lg:col-span-2 space-y-8">
            {/* 이미지 갤러리 */}
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <div className="relative h-96 bg-gray-200">
                <div className="w-full h-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-6xl mb-4">🏔️</div>
                    <div className="text-lg font-medium text-gray-600">
                      {getProductDisplayName(product)}
                    </div>
                    <div className="text-sm text-gray-500 mt-2">
                      이미지 준비 중
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
                    이미지 없음
                  </div>
                </div>
              </div>
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
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">투어 소개</h3>
                      <p className="text-gray-700 leading-relaxed">
                        {productDetails?.description || product.description || getCustomerDisplayName(product)}
                      </p>
                    </div>

                    {/* 기본 정보 */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">기본 정보</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center space-x-3">
                          <Calendar className="h-5 w-5 text-blue-500" />
                          <div>
                            <span className="text-sm text-gray-600">기간</span>
                            <p className="font-medium">{product.duration || '미정'}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Users className="h-5 w-5 text-green-500" />
                          <div>
                            <span className="text-sm text-gray-600">최대 참가자</span>
                            <p className="font-medium">{product.max_participants || 0}명</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <MapPin className="h-5 w-5 text-red-500" />
                          <div>
                            <span className="text-sm text-gray-600">카테고리</span>
                            <p className="font-medium">{getCategoryLabel(product.category || '')}</p>
                          </div>
                        </div>
                        {product.group_size && (
                          <div className="flex items-center space-x-3">
                            <Users className="h-5 w-5 text-purple-500" />
                            <div>
                              <span className="text-sm text-gray-600">그룹 크기</span>
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
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">포함 사항</h3>
                            <div className="text-gray-700 whitespace-pre-line">
                              {productDetails.included}
                            </div>
                          </div>
                        )}
                        {productDetails.not_included && (
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">불포함 사항</h3>
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
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">태그</h3>
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
                              <p className="text-gray-700 mb-4">
                                {tourCourse.description}
                              </p>
                            )}
                            
                            {tourCourse.duration && (
                              <div className="flex items-center mb-4">
                                <Clock className="h-5 w-5 text-blue-500 mr-2" />
                                <span className="text-gray-600">소요시간: {tourCourse.duration}</span>
                              </div>
                            )}
                            
                            {tourCourse.difficulty && (
                              <div className="flex items-center mb-4">
                                <span className="text-gray-600 mr-2">난이도:</span>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(tourCourse.difficulty)}`}>
                                  {getDifficultyLabel(tourCourse.difficulty)}
                                </span>
                              </div>
                            )}
                            
                            {tourCourse.highlights && tourCourse.highlights.length > 0 && (
                              <div className="mb-4">
                                <h4 className="font-medium text-gray-900 mb-2">하이라이트</h4>
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
                                <h4 className="font-medium text-gray-900 mb-2">상세 일정</h4>
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
                        <p className="text-lg font-medium text-gray-900">일정 정보가 없습니다</p>
                        <p className="text-gray-600">투어 코스 정보를 추가해주세요</p>
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
                    <h3 className="text-lg font-semibold text-gray-900">투어 상세 정보</h3>
                    
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
                            <h4 className="font-medium text-gray-900 mb-3">기본 정보</h4>
                            <dl className="space-y-3 text-sm">
                              <div className="flex justify-between">
                                <dt className="text-gray-600">카테고리</dt>
                                <dd className="text-gray-900">{getCategoryLabel(product.category || '')}</dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-gray-600">서브 카테고리</dt>
                                <dd className="text-gray-900">{product.sub_category || '미정'}</dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-gray-600">기간</dt>
                                <dd className="text-gray-900">{product.duration || '미정'}</dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-gray-600">최대 참가자</dt>
                                <dd className="text-gray-900">{product.max_participants || 0}명</dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-gray-600">상태</dt>
                                <dd className="text-gray-900">{product.status || '미정'}</dd>
                              </div>
                              {product.group_size && (
                                <div className="flex justify-between">
                                  <dt className="text-gray-600">그룹 크기</dt>
                                  <dd className="text-gray-900">{product.group_size}</dd>
                                </div>
                              )}
                            </dl>
                          </div>
                          
                          <div>
                            <h4 className="font-medium text-gray-900 mb-3">연령 정보</h4>
                            <dl className="space-y-3 text-sm">
                              {product.adult_age && (
                                <div className="flex justify-between">
                                  <dt className="text-gray-600">성인 연령</dt>
                                  <dd className="text-gray-900">{product.adult_age}세 이상</dd>
                                </div>
                              )}
                              {product.child_age_min && product.child_age_max && (
                                <div className="flex justify-between">
                                  <dt className="text-gray-600">아동 연령</dt>
                                  <dd className="text-gray-900">{product.child_age_min}-{product.child_age_max}세</dd>
                                </div>
                              )}
                              {product.infant_age && (
                                <div className="flex justify-between">
                                  <dt className="text-gray-600">유아 연령</dt>
                                  <dd className="text-gray-900">{product.infant_age}세 미만</dd>
                                </div>
                              )}
                            </dl>
                          </div>
                        </div>

                        {/* 언어 정보 */}
                        {product.languages && product.languages.length > 0 && (
                          <div>
                            <h4 className="font-medium text-gray-900 mb-3">지원 언어</h4>
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
                            <h4 className="font-medium text-gray-900 mb-3">출발/도착 정보</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {product.departure_city && (
                                <div className="flex items-center space-x-2">
                                  <MapPin className="h-4 w-4 text-blue-500" />
                                  <span className="text-sm text-gray-600">출발지:</span>
                                  <span className="text-sm font-medium">{product.departure_city}</span>
                                  {product.departure_country && (
                                    <span className="text-sm text-gray-500">({product.departure_country})</span>
                                  )}
                                </div>
                              )}
                              {product.arrival_city && (
                                <div className="flex items-center space-x-2">
                                  <MapPin className="h-4 w-4 text-green-500" />
                                  <span className="text-sm text-gray-600">도착지:</span>
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
                            <h4 className="font-medium text-gray-900 mb-3">태그</h4>
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
                              <h4 className="font-medium text-gray-900 mb-3">포함 사항</h4>
                              <div className="text-sm text-gray-600 whitespace-pre-line bg-green-50 p-4 rounded-lg">
                                {productDetails.included}
                              </div>
                            </div>
                          )}
                          {productDetails?.not_included && (
                            <div>
                              <h4 className="font-medium text-gray-900 mb-3">불포함 사항</h4>
                              <div className="text-sm text-gray-600 whitespace-pre-line bg-red-50 p-4 rounded-lg">
                                {productDetails.not_included}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {!productDetails?.included && !productDetails?.not_included && (
                          <div className="text-center py-8">
                            <div className="text-gray-400 mb-2">📋</div>
                            <p className="text-gray-600">포함/불포함 정보가 없습니다</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 운영정보 탭 */}
                    {activeDetailTab === 'logistics' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {productDetails?.pickup_drop_info && (
                            <div>
                              <h4 className="font-medium text-gray-900 mb-3">픽업/드롭 정보</h4>
                              <div className="text-sm text-gray-600 whitespace-pre-line bg-blue-50 p-4 rounded-lg">
                                {productDetails.pickup_drop_info}
                              </div>
                            </div>
                          )}
                          
                          {productDetails?.luggage_info && (
                            <div>
                              <h4 className="font-medium text-gray-900 mb-3">짐 정보</h4>
                              <div className="text-sm text-gray-600 whitespace-pre-line bg-yellow-50 p-4 rounded-lg">
                                {productDetails.luggage_info}
                              </div>
                            </div>
                          )}
                          
                          {productDetails?.tour_operation_info && (
                            <div>
                              <h4 className="font-medium text-gray-900 mb-3">투어 운영 정보</h4>
                              <div className="text-sm text-gray-600 whitespace-pre-line bg-purple-50 p-4 rounded-lg">
                                {productDetails.tour_operation_info}
                              </div>
                            </div>
                          )}
                          
                          {productDetails?.preparation_info && (
                            <div>
                              <h4 className="font-medium text-gray-900 mb-3">준비사항</h4>
                              <div className="text-sm text-gray-600 whitespace-pre-line bg-orange-50 p-4 rounded-lg">
                                {productDetails.preparation_info}
                              </div>
                            </div>
                          )}
                          
                          {productDetails?.small_group_info && (
                            <div>
                              <h4 className="font-medium text-gray-900 mb-3">소그룹 정보</h4>
                              <div className="text-sm text-gray-600 whitespace-pre-line bg-indigo-50 p-4 rounded-lg">
                                {productDetails.small_group_info}
                              </div>
                            </div>
                          )}
                          
                          {productDetails?.notice_info && (
                            <div>
                              <h4 className="font-medium text-gray-900 mb-3">주의사항</h4>
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
                            <p className="text-gray-600">운영 정보가 없습니다</p>
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
                              <h4 className="font-medium text-gray-900 mb-3">프라이빗 투어 정보</h4>
                              <div className="text-sm text-gray-600 whitespace-pre-line bg-purple-50 p-4 rounded-lg">
                                {productDetails.private_tour_info}
                              </div>
                            </div>
                          )}
                          
                          {productDetails?.cancellation_policy && (
                            <div>
                              <h4 className="font-medium text-gray-900 mb-3">취소 정책</h4>
                              <div className="text-sm text-gray-600 whitespace-pre-line bg-red-50 p-4 rounded-lg">
                                {productDetails.cancellation_policy}
                              </div>
                            </div>
                          )}
                          
                          {productDetails?.chat_announcement && (
                            <div>
                              <h4 className="font-medium text-gray-900 mb-3">공지사항</h4>
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
                            <p className="text-gray-600">정책 정보가 없습니다</p>
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

                {/* 미디어 탭 */}
                {activeTab === 'media' && (
                  <ProductMediaDisplay productId={productId} />
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
                  ${product.base_price || 0}
                </div>
                <div className="text-sm text-gray-600">기본 가격</div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">최대 참가자</span>
                  <span className="font-medium">{product.max_participants || 0}명</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">기간</span>
                  <span className="font-medium">{product.duration || '미정'}</span>
                </div>
                {product.group_size && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">그룹 크기</span>
                    <span className="font-medium">{product.group_size}</span>
                  </div>
                )}
              </div>

              {/* 선택 옵션 */}
              {productChoices.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-medium text-gray-900 mb-3">선택 옵션</h4>
                  <div className="space-y-3">
                    {productChoices.map((choice, index) => (
                      <div key={index} className="border rounded-lg p-3">
                        <div className="font-medium text-sm text-gray-900 mb-2">
                          {locale === 'en' && choice.choice_name_ko ? choice.choice_name_ko : choice.choice_name}
                        </div>
                        <div className="text-sm text-gray-600">
                          {locale === 'en' && choice.option_name_ko ? choice.option_name_ko : choice.option_name}
                          {choice.option_price && (
                            <span className="ml-2 font-medium text-blue-600">
                              +${choice.option_price}
                            </span>
                          )}
                          {choice.is_default && (
                            <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                              기본
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium">
                예약하기
              </button>

              <div className="mt-4 text-center">
                <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                  문의하기
                </button>
              </div>
            </div>

            {/* 연락처 정보 */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="font-semibold text-gray-900 mb-4">연락처</h3>
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
                <h3 className="font-semibold text-gray-900">리뷰</h3>
                <div className="flex items-center">
                  <Star className="h-4 w-4 text-yellow-400 mr-1" />
                  <span className="font-medium">4.5</span>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                12개의 리뷰
              </div>
              <button className="w-full mt-3 text-blue-600 hover:text-blue-700 text-sm font-medium">
                모든 리뷰 보기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
