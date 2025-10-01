'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Star, MapPin, Users, Calendar, Clock, Heart, Share2, Phone, Mail, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import ProductScheduleDisplay from '@/components/ProductScheduleDisplay'
import ProductFaqDisplay from '@/components/ProductFaqDisplay'
import ProductMediaDisplay from '@/components/ProductMediaDisplay'
import TourScheduleSection from '@/components/product/TourScheduleSection'
import { supabase } from '@/lib/supabase'
import { useLocale } from 'next-intl'

interface Product {
  id: string
  name_ko: string
  name_en: string | null
  internal_name_ko: string
  internal_name_en: string
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
}

export default function ProductDetailPage() {
  const params = useParams()
  const productId = params.id as string
  const locale = useLocale()
  
  const [product, setProduct] = useState<Product | null>(null)
  const [teamType, setTeamType] = useState<'guide+driver' | '2guide' | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // 임시 하드코딩된 데이터 (실제 구현 시 제거)
  const mockProduct: Product = {
    id: '1',
    name_ko: '그랜드서클 1박2일 투어',
    name_en: 'Grand Circle 2-Day Tour',
    internal_name_ko: '그랜드서클 투어',
    internal_name_en: 'Grand Circle Tour',
    customer_name_ko: '그랜드서클 1박2일 투어',
    customer_name_en: 'Grand Circle 2-Day Tour',
    sub_category: 'nature',
    category: 'nature',
    base_price: 299,
    duration: '2일',
    max_participants: 15,
    status: 'active',
    tags: ['그랜드서클', '자연', '1박2일', '프리미엄'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  const [selectedImage, setSelectedImage] = useState(0)
  const [activeTab, setActiveTab] = useState('overview')

  // 실제 데이터 로드 (임시로 mockProduct 사용)
  useEffect(() => {
    const loadProductData = async () => {
      try {
        setLoading(true)
        
        // 실제 구현 시에는 supabase에서 데이터를 가져옴
        // const { data: productData, error } = await supabase
        //   .from('products')
        //   .select('*')
        //   .eq('id', productId)
        //   .single()
        
        // 임시로 mockProduct 사용
        setProduct(mockProduct)
        
        // team_type 결정 (실제로는 tours 테이블에서 가져와야 함)
        // 임시로 하드코딩
        setTeamType('2guide')
        
      } catch (error) {
        console.error('상품 데이터 로드 오류:', error)
        setError('상품 정보를 불러오는데 실패했습니다.')
      } finally {
        setLoading(false)
      }
    }

    loadProductData()
  }, [productId])

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
      food: '음식'
    }
    return categoryLabels[category] || category
  }

  const tabs = [
    { id: 'overview', label: '개요' },
    { id: 'itinerary', label: '일정' },
    { id: 'tour-schedule', label: '투어 스케줄' },
    { id: 'details', label: '상세정보' },
    { id: 'faq', label: 'FAQ' },
    { id: 'media', label: '미디어' }
  ]

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
                {locale === 'en' && product.name_en ? product.name_en : product.name_ko}
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
                <img
                  src={product.images[selectedImage]}
                  alt={product.name}
                  className="w-full h-full object-cover"
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
              <div className="p-4">
                <div className="flex space-x-2 overflow-x-auto">
                  {product.images.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImage(index)}
                      className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 ${
                        selectedImage === index ? 'border-blue-500' : 'border-gray-200'
                      }`}
                    >
                      <img
                        src={image}
                        alt={`${product.name} ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 탭 네비게이션 */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8 px-6">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>

              {/* 탭 콘텐츠 */}
              <div className="p-6">
                {/* 개요 탭 */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">투어 소개</h3>
                      <p className="text-gray-700 leading-relaxed">
                        {locale === 'en' && product.customer_name_en ? product.customer_name_en : product.customer_name_ko}
                      </p>
                    </div>

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
                        <div className="flex items-center space-x-3">
                          <Star className="h-5 w-5 text-yellow-500" />
                          <div>
                            <span className="text-sm text-gray-600">상태</span>
                            <p className="font-medium">{product.status || '미정'}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {product.tags && product.tags.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">태그</h3>
                        <div className="flex flex-wrap gap-2">
                          {product.tags.map((tag, index) => (
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
                  <ProductScheduleDisplay productId={productId} />
                )}

                {/* 투어 스케줄 탭 */}
                {activeTab === 'tour-schedule' && product && (
                  <TourScheduleSection 
                    productId={productId} 
                    teamType={teamType}
                    locale={locale}
                  />
                )}

                {/* 상세정보 탭 */}
                {activeTab === 'details' && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-gray-900">투어 상세 정보</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">기본 정보</h4>
                        <dl className="space-y-2 text-sm">
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
                        </dl>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">태그</h4>
                        <div className="flex flex-wrap gap-2">
                          {product.tags && product.tags.length > 0 ? (
                            product.tags.map((tag, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800"
                              >
                                {tag}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-500">태그가 없습니다.</span>
                          )}
                        </div>
                      </div>
                    </div>
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
              </div>

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
                  <span className="font-medium">{product.rating}</span>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                {product.reviewCount}개의 리뷰
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
