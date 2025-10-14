'use client'

import React, { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Search, Star, MapPin, Users, Calendar, Filter, Heart } from 'lucide-react'
import Link from 'next/link'

interface Product {
  id: string
  name: string
  category: string
  description: string
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
}

export default function ProductsPage() {
  const t = useTranslations('products')
  
  const [products] = useState<Product[]>([
    {
      id: '1',
      name: '그랜드서클 1박2일 투어',
      category: 'nature',
      description: '그랜드 캐년, 브라이스 캐년, 자이온 국립공원을 포함한 1박2일 투어',
      duration: 2,
      basePrice: { adult: 299, child: 249, infant: 199 },
      minParticipants: 2,
      maxParticipants: 15,
      difficulty: 'medium',
      status: 'active',
      tags: ['그랜드서클', '자연', '1박2일'],
      images: ['/placeholder-tour.svg', '/placeholder-tour.svg'],
      rating: 4.8,
      reviewCount: 127,
      highlights: ['세계적인 자연 경관', '전문 가이드 동행', '편안한 숙박']
    },
    {
      id: '2',
      name: '모뉴먼트 밸리 일일 투어',
      category: 'nature',
      description: '모뉴먼트 밸리와 앤텔롭 캐년을 방문하는 일일 투어',
      duration: 1,
      basePrice: { adult: 199, child: 169, infant: 139 },
      minParticipants: 1,
      maxParticipants: 12,
      difficulty: 'easy',
      status: 'active',
      tags: ['모뉴먼트밸리', '앤텔롭캐년', '일일투어'],
      images: ['/images/monument-valley-1.jpg'],
      rating: 4.6,
      reviewCount: 89,
      highlights: ['유명한 영화 촬영지', '사진 촬영 최적', '가족 친화적']
    },
    {
      id: '3',
      name: '라스베가스 시티 투어',
      category: 'city',
      description: '라스베가스의 화려한 밤거리와 명소를 둘러보는 시티 투어',
      duration: 1,
      basePrice: { adult: 99, child: 79, infant: 59 },
      minParticipants: 1,
      maxParticipants: 20,
      difficulty: 'easy',
      status: 'active',
      tags: ['라스베가스', '시티투어', '야경'],
      images: ['/placeholder-tour.svg'],
      rating: 4.4,
      reviewCount: 156,
      highlights: ['화려한 네온사인', '유명 호텔 관광', '자유 시간 포함']
    }
  ])

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedDifficulty, setSelectedDifficulty] = useState('all')
  const [priceRange, setPriceRange] = useState('all')

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory
    const matchesDifficulty = selectedDifficulty === 'all' || product.difficulty === selectedDifficulty
    
    let matchesPrice = true
    if (priceRange === 'low') matchesPrice = product.basePrice.adult <= 150
    else if (priceRange === 'medium') matchesPrice = product.basePrice.adult > 150 && product.basePrice.adult <= 300
    else if (priceRange === 'high') matchesPrice = product.basePrice.adult > 300
    
    return matchesSearch && matchesCategory && matchesDifficulty && matchesPrice
  })

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

  const categories = [
    { value: 'all', label: '전체' },
    { value: 'city', label: '도시' },
    { value: 'nature', label: '자연' },
    { value: 'culture', label: '문화' },
    { value: 'adventure', label: '모험' },
    { value: 'food', label: '음식' }
  ]

  const difficulties = [
    { value: 'all', label: '전체' },
    { value: 'easy', label: '쉬움' },
    { value: 'medium', label: '보통' },
    { value: 'hard', label: '어려움' }
  ]

  const priceRanges = [
    { value: 'all', label: '전체' },
    { value: 'low', label: '$150 이하' },
    { value: 'medium', label: '$151 - $300' },
    { value: 'high', label: '$301 이상' }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-4xl font-bold text-gray-900 text-center">투어 상품</h1>
          <p className="mt-4 text-xl text-gray-600 text-center">
            잊을 수 없는 특별한 여행 경험을 제공합니다
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 검색 및 필터 */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* 검색 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="상품명, 설명으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* 카테고리 필터 */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {categories.map(category => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>

            {/* 난이도 필터 */}
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {difficulties.map(difficulty => (
                <option key={difficulty.value} value={difficulty.value}>
                  {difficulty.label}
                </option>
              ))}
            </select>

            {/* 가격 범위 필터 */}
            <select
              value={priceRange}
              onChange={(e) => setPriceRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {priceRanges.map(range => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 상품 목록 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <div key={product.id} className="bg-white rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow">
              {/* 상품 이미지 */}
              <div className="relative h-48 bg-gray-200">
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                <div className="absolute top-3 right-3">
                  <button className="p-2 bg-white/80 rounded-full hover:bg-white transition-colors">
                    <Heart size={16} className="text-gray-600" />
                  </button>
                </div>
                <div className="absolute bottom-3 left-3">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(product.difficulty)}`}>
                    {getDifficultyLabel(product.difficulty)}
                  </span>
                </div>
              </div>

              {/* 상품 정보 */}
              <div className="p-6">
                {/* 카테고리 */}
                <div className="mb-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {getCategoryLabel(product.category)}
                  </span>
                </div>

                {/* 상품명 */}
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  <Link href={`/ko/products/${product.id}`} className="hover:text-blue-600">
                    {product.name}
                  </Link>
                </h3>

                {/* 설명 */}
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                  {product.description}
                </p>

                {/* 하이라이트 */}
                <div className="mb-4">
                  <ul className="space-y-1">
                    {product.highlights.slice(0, 2).map((highlight, index) => (
                      <li key={index} className="flex items-center text-sm text-gray-600">
                        <Star className="h-3 w-3 text-yellow-400 mr-2 flex-shrink-0" />
                        {highlight}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 상품 세부 정보 */}
                <div className="grid grid-cols-2 gap-4 mb-4 text-sm text-gray-600">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    {product.duration}일
                  </div>
                  <div className="flex items-center">
                    <Users className="h-4 w-4 mr-2" />
                    {product.minParticipants}-{product.maxParticipants}명
                  </div>
                </div>

                {/* 가격 및 평점 */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-bold text-gray-900">
                      ${product.basePrice.adult}부터
                    </div>
                    <div className="text-sm text-gray-500">
                      성인 기준
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center">
                      <Star className="h-4 w-4 text-yellow-400 mr-1" />
                      <span className="font-medium">{product.rating}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      ({product.reviewCount}개 리뷰)
                    </div>
                  </div>
                </div>

                {/* 상세보기 버튼 */}
                <div className="mt-4">
                  <Link
                    href={`/ko/products/${product.id}`}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-center block"
                  >
                    상세보기
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 검색 결과 없음 */}
        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <Search className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium text-gray-900">검색 결과가 없습니다</p>
            <p className="text-gray-600">다른 검색어나 필터를 시도해보세요</p>
          </div>
        )}
      </div>
    </div>
  )
}
