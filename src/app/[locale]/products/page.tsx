'use client'

import React, { useState, useEffect } from 'react'
import { Search, Users, Calendar, Heart, Loader2 } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { useLocale, useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'

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
  primary_image?: string | null
}

export default function ProductsPage() {
  const locale = useLocale()
  const searchParams = useSearchParams()
  const t = useTranslations('common')
  
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedTag, setSelectedTag] = useState('all')
  const [priceRange, setPriceRange] = useState('all')

  // URL 파라미터에서 태그 읽기
  useEffect(() => {
    const tagParam = searchParams.get('tag')
    if (tagParam) {
      setSelectedTag(tagParam)
    }
  }, [searchParams])

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
          setError(t('errorLoadingProducts'))
          return
        }
        
        // 각 상품의 대표사진 가져오기
        const productsWithImages = await Promise.all(
          (data || []).map(async (product: Product) => {
            try {
              // 1. product_media에서 대표사진 찾기
              const { data: mediaData } = await supabase
                .from('product_media')
                .select('file_url')
                .eq('product_id', product.id)
                .eq('file_type', 'image')
                .eq('is_active', true)
                .eq('is_primary', true)
                .maybeSingle()
              
              if (mediaData && 'file_url' in mediaData) {
                return { ...product, primary_image: (mediaData as any).file_url }
              }
              
              // 2. product_media에서 첫 번째 이미지 찾기
              const { data: firstMediaData } = await supabase
                .from('product_media')
                .select('file_url')
                .eq('product_id', product.id)
                .eq('file_type', 'image')
                .eq('is_active', true)
                .order('order_index', { ascending: true })
                .limit(1)
                .single()
              
              if (firstMediaData && 'file_url' in firstMediaData) {
                return { ...product, primary_image: (firstMediaData as any).file_url }
              }
              
              // 3. 투어 코스 사진에서 대표사진 찾기
              const { data: tourCoursesData } = await supabase
                .from('product_tour_courses')
                .select(`
                  tour_course:tour_courses(*)
                `)
                .eq('product_id', product.id)
              
              if (tourCoursesData && tourCoursesData.length > 0) {
                const courseIds = tourCoursesData.map(tc => (tc as { tour_course?: { id: string } }).tour_course?.id).filter(Boolean)
                if (courseIds.length > 0) {
                  const { data: photoData } = await supabase
                    .from('tour_course_photos')
                    .select('photo_url')
                    .in('course_id', courseIds)
                    .eq('is_primary', true)
                    .maybeSingle()
                  
                  if (photoData && 'photo_url' in photoData) {
                    return { 
                      ...product, 
                      primary_image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tour-course-photos/${(photoData as any).photo_url}` 
                    }
                  }
                  
                  // 4. 투어 코스 사진에서 첫 번째 사진 찾기
                  const { data: firstPhotoData } = await supabase
                    .from('tour_course_photos')
                    .select('photo_url')
                    .in('course_id', courseIds)
                    .order('sort_order', { ascending: true })
                    .limit(1)
                    .single()
                  
                  if (firstPhotoData && 'photo_url' in firstPhotoData) {
                    return { 
                      ...product, 
                      primary_image: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tour-course-photos/${(firstPhotoData as any).photo_url}` 
                    }
                  }
                }
              }
              
              return { ...product, primary_image: null }
            } catch (err) {
              console.error(`Error fetching image for product ${product.id}:`, err)
              return { ...product, primary_image: null }
            }
          })
        )
        
        setProducts(productsWithImages)
      } catch (err) {
        console.error('Error fetching products:', err)
        setError(t('errorLoadingProducts'))
      } finally {
        setLoading(false)
      }
    }
    
    fetchProducts()
  }, [])

  const filteredProducts = products.filter(product => {
    const productName = locale === 'en' && product.customer_name_en ? product.customer_name_en : product.customer_name_ko || product.name_ko || product.name
    const productDescription = product.description || ''
    const productTags = product.tags || []
    
    const matchesSearch = productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         productDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         productTags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory
    
    const matchesTag = selectedTag === 'all' || 
      (productTags && productTags.some(tag => 
        tag.toLowerCase().includes(selectedTag.toLowerCase())
      ))
    
    let matchesPrice = true
    if (priceRange === 'low') matchesPrice = product.base_price <= 150
    else if (priceRange === 'medium') matchesPrice = product.base_price > 150 && product.base_price <= 300
    else if (priceRange === 'high') matchesPrice = product.base_price > 300
    
    return matchesSearch && matchesCategory && matchesTag && matchesPrice
  })

  const getCategoryLabel = (category: string) => {
    const categoryLabels: { [key: string]: string } = {
      city: t('city'),
      nature: t('nature'),
      culture: t('culture'),
      adventure: t('adventure'),
      food: t('food'),
      tour: t('tour'),
      sightseeing: t('sightseeing'),
      outdoor: t('outdoor')
    }
    return categoryLabels[category] || category
  }

  const getCustomerDisplayName = (product: Product) => {
    if (locale === 'en' && product.customer_name_en) {
      return product.customer_name_en
    }
    return product.customer_name_ko || product.name_ko || product.name
  }

  // 실제 상품 데이터에서 카테고리 추출
  const categories = React.useMemo(() => {
    const uniqueCategories = Array.from(new Set(products.map(p => p.category).filter(Boolean)))
    return [
      { value: 'all', label: t('all') },
      ...uniqueCategories.map(category => ({
        value: category,
        label: getCategoryLabel(category)
      }))
    ]
  }, [products, getCategoryLabel, t])

  // 실제 상품 데이터에서 태그 추출
  const tags = React.useMemo(() => {
    const allTags = products.flatMap(p => p.tags || []).filter(Boolean)
    const uniqueTags = Array.from(new Set(allTags))
    return [
      { value: 'all', label: t('all') },
      ...uniqueTags.map(tag => ({
        value: tag,
        label: tag
      }))
    ]
  }, [products, t])

  const priceRanges = [
    { value: 'all', label: t('all') },
        { value: 'low', label: t('priceRangeLow') },
        { value: 'medium', label: t('priceRangeMedium') },
        { value: 'high', label: t('priceRangeHigh') }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-4xl font-bold text-gray-900 text-center">{t('tourProducts')}</h1>
          <p className="mt-4 text-xl text-gray-600 text-center">
            {t('unforgettableTravelExperience')}
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
                placeholder={t('searchProducts')}
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

            {/* 태그 필터 */}
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {tags.map(tag => (
                <option key={tag.value} value={tag.value}>
                  {tag.label}
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
          
          {/* 태그별 모아보기 링크 */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <Link
              href="/ko/products/tags"
              className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              🏷️ {t('viewByTags')}
            </Link>
          </div>
        </div>

        {/* 로딩 상태 */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">{t('loadingProducts')}</span>
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
{t('tryAgain')}
            </button>
          </div>
        )}

        {/* 상품 목록 */}
        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product, index) => (
              <div key={product.id} className="bg-white rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow">
                {/* 상품 이미지 */}
                <div className="relative h-48 bg-gray-200">
                  {product.primary_image ? (
                    <Image
                      src={product.primary_image}
                      alt={getCustomerDisplayName(product)}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover"
                      priority={index === 0}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-4xl mb-2">🏔️</div>
                        <div className="text-sm font-medium text-gray-600">
                          {getCustomerDisplayName(product)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {t('imagePreparing')}
                        </div>
                      </div>
                    </div>
                  )}
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
                    <Link href={`/${locale}/products/${product.id}`} className="hover:text-blue-600">
                      {getCustomerDisplayName(product)}
                    </Link>
                  </h3>

                  {/* 설명 */}
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {product.description || t('checkDetailsForMoreInfo')}
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
                        {t('maxParticipants')}: {product.max_participants}
                      </div>
                    )}
                  </div>

                  {/* 가격 */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-lg font-bold text-gray-900">
                        ${product.base_price} {t('startingFrom')}
                      </div>
                      <div className="text-sm text-gray-500">
                        {t('perAdult')}
                      </div>
                    </div>
                  </div>

                  {/* 상세보기 버튼 */}
                  <div className="mt-4">
                    <Link
                      href={`/${locale}/products/${product.id}`}
                      className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-center block"
                    >
{t('viewDetails')}
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
            <p className="text-lg font-medium text-gray-900">{t('noSearchResults')}</p>
            <p className="text-gray-600">{t('tryDifferentSearch')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
