'use client'

import React, { useState } from 'react'
import { useParams } from 'next/navigation'
import { Star, MapPin, Users, Calendar, Clock, Heart, Share2, Phone, Mail, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface Product {
  id: string
  name: string
  category: string
  description: string
  detailedDescription: string
  duration: number
  basePrice: {
    adult: number
    child: number
    infant: number
  }
  minParticipants: number
  maxParticipants: number
  difficulty: 'easy' | 'medium' | 'hard'
  status: 'active' | 'inactive' | 'draft'
  tags: string[]
  images: string[]
  rating: number
  reviewCount: number
  highlights: string[]
  itinerary: string[]
  included: string[]
  notIncluded: string[]
  faq: Array<{ question: string; answer: string }>
}

export default function ProductDetailPage() {
  const params = useParams()
  const productId = params.id as string
  
  const [product] = useState<Product>({
    id: '1',
    name: '그랜드서클 1박2일 투어',
    category: 'nature',
    description: '그랜드 캐년, 브라이스 캐년, 자이온 국립공원을 포함한 1박2일 투어',
    detailedDescription: '아리조나와 유타 주의 가장 아름다운 자연 경관을 둘러보는 프리미엄 투어입니다. 그랜드 캐년의 장엄한 풍경, 브라이스 캐년의 독특한 후두형 지형, 자이온 국립공원의 웅장한 협곡을 경험할 수 있습니다. 전문 가이드의 상세한 설명과 함께 자연의 신비를 깊이 있게 탐험해보세요.',
    duration: 2,
    basePrice: { adult: 299, child: 249, infant: 199 },
    minParticipants: 2,
    maxParticipants: 15,
    difficulty: 'medium',
    status: 'active',
    tags: ['그랜드서클', '자연', '1박2일', '프리미엄'],
    images: ['/images/grand-circle-1.jpg', '/images/grand-circle-2.jpg', '/images/grand-circle-3.jpg'],
    rating: 4.8,
    reviewCount: 127,
    highlights: [
      '세계적인 자연 경관 그랜드 캐년 방문',
      '브라이스 캐년의 독특한 후두형 지형 감상',
      '자이온 국립공원의 웅장한 협곡 탐험',
      '전문 가이드의 상세한 설명',
      '편안한 숙박과 맛있는 식사 제공',
      '소규모 그룹으로 개인적인 관심'
    ],
    itinerary: [
      '1일차: 라스베가스 출발 → 그랜드 캐년 남쪽 가장자리 → 브라이스 캐년 → 호텔 체크인',
      '2일차: 자이온 국립공원 → 앤젤스 랜딩 트레킹 → 라스베가스 도착'
    ],
    included: [
      '전문 가이드 동행',
      '편안한 교통편 (에어컨, Wi-Fi)',
      '1박 호텔 숙박',
      '아침식사 1회, 저녁식사 1회',
      '입장료 및 관광지 수수료',
      '보험'
    ],
    notIncluded: [
      '개인 경비',
      '선택적 액티비티',
      '가이드 팁',
      '기타 개인 지출'
    ],
    faq: [
      {
        question: '투어는 언제 출발하나요?',
        answer: '매주 월요일과 목요일 오전 7시에 라스베가스에서 출발합니다.'
      },
      {
        question: '어떤 복장을 준비해야 하나요?',
        answer: '편안한 등산화와 계절에 맞는 옷차림을 권장합니다. 야간에는 기온이 낮아질 수 있으니 겉옷을 준비하세요.'
      },
      {
        question: '식사는 어떻게 제공되나요?',
        answer: '1박 2일 동안 아침식사 1회, 저녁식사 1회가 포함되어 있습니다. 점심은 개별적으로 준비하거나 현지 식당에서 드실 수 있습니다.'
      }
    ]
  })

  const [selectedImage, setSelectedImage] = useState(0)
  const [activeTab, setActiveTab] = useState('overview')

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
    { id: 'details', label: '상세정보' },
    { id: 'faq', label: 'FAQ' }
  ]

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
              <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDifficultyColor(product.difficulty)}`}>
                  {getDifficultyLabel(product.difficulty)}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {getCategoryLabel(product.category)}
                </span>
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
                      <p className="text-gray-700 leading-relaxed">{product.detailedDescription}</p>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">하이라이트</h3>
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {product.highlights.map((highlight, index) => (
                          <li key={index} className="flex items-start">
                            <Star className="h-5 w-5 text-yellow-400 mr-3 mt-0.5 flex-shrink-0" />
                            <span className="text-gray-700">{highlight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">포함 사항</h3>
                        <ul className="space-y-2">
                          {product.included.map((item, index) => (
                            <li key={index} className="flex items-center text-gray-700">
                              <div className="w-2 h-2 bg-green-500 rounded-full mr-3" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">불포함 사항</h3>
                        <ul className="space-y-2">
                          {product.notIncluded.map((item, index) => (
                            <li key={index} className="flex items-center text-gray-700">
                              <div className="w-2 h-2 bg-red-500 rounded-full mr-3" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* 일정 탭 */}
                {activeTab === 'itinerary' && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-gray-900">투어 일정</h3>
                    <div className="space-y-4">
                      {product.itinerary.map((day, index) => (
                        <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                          <div className="font-medium text-gray-900">{day}</div>
                        </div>
                      ))}
                    </div>
                  </div>
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
                            <dd className="text-gray-900">{getCategoryLabel(product.category)}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-600">난이도</dt>
                            <dd className="text-gray-900">{getDifficultyLabel(product.difficulty)}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-600">기간</dt>
                            <dd className="text-gray-900">{product.duration}일</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-600">참가자</dt>
                            <dd className="text-gray-900">{product.minParticipants}-{product.maxParticipants}명</dd>
                          </div>
                        </dl>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">태그</h4>
                        <div className="flex flex-wrap gap-2">
                          {product.tags.map((tag, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* FAQ 탭 */}
                {activeTab === 'faq' && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-gray-900">자주 묻는 질문</h3>
                    <div className="space-y-4">
                      {product.faq.map((item, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg">
                          <button className="w-full px-4 py-3 text-left font-medium text-gray-900 hover:bg-gray-50">
                            {item.question}
                          </button>
                          <div className="px-4 pb-3 text-gray-700">
                            {item.answer}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 사이드바 */}
          <div className="space-y-6">
            {/* 예약 카드 */}
            <div className="bg-white rounded-lg shadow-sm border p-6 sticky top-6">
              <div className="text-center mb-6">
                <div className="text-3xl font-bold text-gray-900">${product.basePrice.adult}</div>
                <div className="text-sm text-gray-600">성인 기준</div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">아동 (3-12세)</span>
                  <span className="font-medium">${product.basePrice.child}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">유아 (0-2세)</span>
                  <span className="font-medium">${product.basePrice.infant}</span>
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
