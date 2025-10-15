'use client'

import React, { useState, useEffect } from 'react'
import { Search, Users, Calendar, Heart, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLocale } from 'next-intl'

interface Product {
  id: string
  name: string
  name_ko: string | null
  name_en: string | null
  customer_name_ko: string
  customer_name_en: string
  category: string
  sub_category: string | null
  description: string | null
  duration: string | null
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
  base_price: number
  max_participants: number | null
  status: string | null
  tags: string[] | null
  created_at: string | null
  use_common_details: boolean
  choices: Record<string, unknown> | null
  tour_departure_times: Record<string, unknown> | null
}

export default function ProductsPage() {
  const locale = useLocale()
  
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [priceRange, setPriceRange] = useState('all')

  // 제품 데이터 로드
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
        
        if (error) {
          console.error('Error fetching products:', error)
          setError('제품을 불러오는 중 오류가 발생했습니다.')
          return
        }
        
        setProducts(data || [])
      } catch (err) {
        console.error('Error fetching products:', err)
        setError('제품을 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }
    
    fetchProducts()
  }, [])

  const filteredProducts = products.filter(product => {
    const productName = locale === 'en' && product.name_en ? product.name_en : product.name_ko || product.name
    const productDescription = product.description || ''
    const productTags = product.tags || []
    
    const matchesSearch = productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         productDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         productTags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory
    
    // 난이도 필터는 제거 (데이터베이스에 없음)
    const matchesDifficulty = true
    
    let matchesPrice = true
    if (priceRange === 'low') matchesPrice = product.base_price <= 150
    else if (priceRange === 'medium') matchesPrice = product.base_price > 150 && product.base_price <= 300
    else if (priceRange === 'high') matchesPrice = product.base_price > 300
    
    return matchesSearch && matchesCategory && matchesDifficulty && matchesPrice
  })

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

  const categories = [
    { value: 'all', label: '전체' },
    { value: 'city', label: '도시' },
    { value: 'nature', label: '자연' },
    { value: 'culture', label: '문화' },
    { value: 'adventure', label: '모험' },
    { value: 'food', label: '음식' },
    { value: 'tour', label: '투어' },
    { value: 'sightseeing', label: '관광' },
    { value: 'outdoor', label: '야외활동' }
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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

        {/* 로딩 상태 */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">제품을 불러오는 중...</span>
          </div>
        )}

        {/* 에러 상태 */}
        {error && (
          <div className="text-center py-12">
            <div className="text-red-600 mb-4">{error}</div>
            <button 
              onClick={() => window.location.reload()} 
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* 상품 목록 */}
        {!loading && !error && (
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
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {getCategoryLabel(product.category)}
                    </span>
                  </div>
                </div>

                {/* 상품 정보 */}
                <div className="p-6">
                  {/* 상품명 */}
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    <Link href={`/ko/products/${product.id}`} className="hover:text-blue-600">
                      {getProductDisplayName(product)}
                    </Link>
                  </h3>

                  {/* 설명 */}
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {product.description || '상세 정보를 확인해주세요.'}
                  </p>

                  {/* 태그 */}
                  {product.tags && product.tags.length > 0 && (
                    <div className="mb-4">
                      <div className="flex flex-wrap gap-1">
                        {product.tags.slice(0, 3).map((tag, index) => (
                          <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 상품 세부 정보 */}
                  <div className="grid grid-cols-2 gap-4 mb-4 text-sm text-gray-600">
                    {product.duration && (
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2" />
                        {product.duration}
                      </div>
                    )}
                    {product.max_participants && (
                      <div className="flex items-center">
                        <Users className="h-4 w-4 mr-2" />
                        최대 {product.max_participants}명
                      </div>
                    )}
                  </div>

                  {/* 가격 */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-lg font-bold text-gray-900">
                        ${product.base_price}부터
                      </div>
                      <div className="text-sm text-gray-500">
                        성인 기준
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
        )}

        {/* 검색 결과 없음 */}
        {!loading && !error && filteredProducts.length === 0 && (
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
