'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Search, Users, Calendar, Heart, Loader2, ChevronDown, ChevronUp, Grid3x3, List, MapPin } from 'lucide-react'
import { 
  MdDirectionsCar,      // 밴
  MdDirectionsBus,      // 버스
  MdFlightTakeoff,      // 경비행기
  MdLocalTaxi          // 리무진
} from 'react-icons/md'
import { FaHelicopter } from 'react-icons/fa'
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
  transportation_methods?: string[] | null
}

export default function ProductsPage() {
  const locale = useLocale()
  const searchParams = useSearchParams()
  const t = useTranslations('common')
  
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedTag, setSelectedTag] = useState('all')
  const [priceRange, setPriceRange] = useState('all')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [expandedSubCategories, setExpandedSubCategories] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'grouped' | 'grid'>('grouped')

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
        
        // 디버깅: 운송수단 데이터 확인
        console.log('Loaded products with transportation_methods:', productsWithImages.map(p => ({
          id: p.id,
          name: p.name,
          transportation_methods: p.transportation_methods
        })))
        
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

  // 운송수단 데이터 유효성 검사 헬퍼 함수
  const hasValidTransportationMethods = (methods: string[] | null | undefined): boolean => {
    if (!methods) return false
    if (!Array.isArray(methods)) return false
    if (methods.length === 0) return false
    return methods.some(m => m && typeof m === 'string' && m.trim().length > 0)
  }

  // 운송수단 아이콘 매핑 함수
  const getTransportationIcon = (method: string) => {
    const iconMap: Record<string, { icon: React.ComponentType<{ className?: string }>, label: string }> = {
      minivan: { icon: MdDirectionsCar, label: locale === 'en' ? 'Minivan' : '미니밴' },
      van: { icon: MdDirectionsCar, label: locale === 'en' ? 'Van' : '밴' },
      bus: { icon: MdDirectionsBus, label: locale === 'en' ? 'Bus' : '버스' },
      helicopter: { icon: FaHelicopter, label: locale === 'en' ? 'Helicopter' : '헬리콥터' },
      light_aircraft: { icon: MdFlightTakeoff, label: locale === 'en' ? 'Light Aircraft' : '경비행기' },
      aircraft: { icon: MdFlightTakeoff, label: locale === 'en' ? 'Aircraft' : '비행기' },
      limousine: { icon: MdLocalTaxi, label: locale === 'en' ? 'Limousine' : '리무진' },
      car: { icon: MdDirectionsCar, label: locale === 'en' ? 'Car' : '승용차' },
      suv: { icon: MdDirectionsCar, label: locale === 'en' ? 'SUV' : 'SUV' },
    }
    
    const normalizedMethod = method.toLowerCase().trim()
    return iconMap[normalizedMethod] || { icon: MdDirectionsCar, label: method }
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

  // 카테고리별 상품 그룹화
  const productsByCategory = useMemo(() => {
    const grouped: Record<string, Product[]> = {}
    
    filteredProducts.forEach(product => {
      const category = product.category || '기타'
      if (!grouped[category]) {
        grouped[category] = []
      }
      grouped[category].push(product)
    })
    
    return grouped
  }, [filteredProducts])

  // 카테고리별 서브카테고리 그룹화
  const productsByCategoryAndSubCategory = useMemo(() => {
    const grouped: Record<string, Record<string, Product[]>> = {}
    
    filteredProducts.forEach(product => {
      const category = product.category || '기타'
      const subCategory = product.sub_category || '기타'
      
      if (!grouped[category]) {
        grouped[category] = {}
      }
      if (!grouped[category][subCategory]) {
        grouped[category][subCategory] = []
      }
      grouped[category][subCategory].push(product)
    })
    
    return grouped
  }, [filteredProducts])

  // 카테고리별 서브카테고리 목록 (기타 제외하고, 실제 서브카테고리가 있는 것만)
  const subCategoriesByCategory = useMemo(() => {
    const result: Record<string, string[]> = {}
    
    Object.keys(productsByCategoryAndSubCategory).forEach(category => {
      const subCategories = Object.keys(productsByCategoryAndSubCategory[category]).filter(
        subCat => subCat !== '기타'
      )
      result[category] = subCategories.sort()
    })
    
    return result
  }, [productsByCategoryAndSubCategory])

  // 서브카테고리 토글 함수
  const toggleSubCategory = (category: string, subCategory: string) => {
    const key = `${category}:${subCategory}`
    setExpandedSubCategories(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  // 카테고리 목록 (상품이 있는 카테고리만)
  const availableCategories = useMemo(() => {
    return Object.keys(productsByCategory).sort((a, b) => {
      // Tour를 첫 번째로 배치
      if (a === 'Tour') return -1
      if (b === 'Tour') return 1
      return a.localeCompare(b)
    })
  }, [productsByCategory])

  // 카테고리 토글 함수
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  // 필터된 상품의 카테고리 목록 (문자열로 변환하여 비교)
  const filteredCategoryKeysString = useMemo(() => {
    const categories = new Set<string>()
    filteredProducts.forEach(product => {
      if (product.category) {
        categories.add(product.category)
      }
    })
    return Array.from(categories).sort().join(',')
  }, [filteredProducts])

  // 이전 필터 값들을 추적하기 위한 ref
  const prevFilterRef = useRef({
    selectedCategory: 'all',
    searchTerm: '',
    selectedTag: 'all',
    priceRange: 'all',
    filteredCategoryKeysString: '',
    viewMode: 'grouped' as 'grouped' | 'grid',
    initialized: false
  })

  // 카테고리 목록 문자열 (비교용)
  const categoryKeysString = useMemo(() => {
    return availableCategories.sort().join(',')
  }, [availableCategories])

  // 선택된 카테고리가 'all'이 아니거나 검색/필터가 적용되면 자동으로 확장
  useEffect(() => {
    const hasActiveFilters = selectedCategory !== 'all' || searchTerm || selectedTag !== 'all' || priceRange !== 'all'
    const filtersChanged = 
      prevFilterRef.current.selectedCategory !== selectedCategory ||
      prevFilterRef.current.searchTerm !== searchTerm ||
      prevFilterRef.current.selectedTag !== selectedTag ||
      prevFilterRef.current.priceRange !== priceRange ||
      prevFilterRef.current.filteredCategoryKeysString !== filteredCategoryKeysString ||
      prevFilterRef.current.viewMode !== viewMode

    if (hasActiveFilters && filtersChanged) {
      // 필터가 적용되면 모든 관련 카테고리 및 서브카테고리 자동 확장
      // filteredCategoryKeysString에서 카테고리 추출
      const relevantCategories = new Set(
        filteredCategoryKeysString.split(',').filter(Boolean)
      )
      setExpandedCategories(relevantCategories)
      
      // 모든 관련 서브카테고리도 자동 확장
      const relevantSubCategories = new Set<string>()
      relevantCategories.forEach(category => {
        const subCategories = subCategoriesByCategory[category] || []
        subCategories.forEach(subCategory => {
          relevantSubCategories.add(`${category}:${subCategory}`)
        })
      })
      setExpandedSubCategories(relevantSubCategories)
    } else if (!hasActiveFilters && viewMode === 'grouped' && !prevFilterRef.current.initialized) {
      // 초기 상태에서만 'Tour' 카테고리 자동 확장 (한 번만 실행)
      if (categoryKeysString.includes('Tour')) {
        setExpandedCategories(new Set(['Tour']))
        // Tour 카테고리의 첫 번째 서브카테고리도 자동 확장
        const tourSubCategories = subCategoriesByCategory['Tour'] || []
        if (tourSubCategories.length > 0) {
          const firstSubCategory = tourSubCategories[0]
          setExpandedSubCategories(new Set([`Tour:${firstSubCategory}`]))
        }
        prevFilterRef.current.initialized = true
      }
    }

    // 현재 필터 값 업데이트
    prevFilterRef.current = {
      selectedCategory,
      searchTerm,
      selectedTag,
      priceRange,
      filteredCategoryKeysString,
      viewMode,
      initialized: prevFilterRef.current.initialized || hasActiveFilters
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, searchTerm, selectedTag, priceRange, filteredCategoryKeysString, viewMode, categoryKeysString, subCategoriesByCategory])

  // 상품 카드 렌더링 함수
  const renderProductCard = (product: Product, index: number) => (
    <div key={product.id} className="bg-white rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow">
      {/* 상품 이미지 */}
      <div className="relative h-48 bg-gray-200">
        {product.primary_image && !imageErrors.has(product.id) ? (
          <Image
            src={product.primary_image}
            alt={getCustomerDisplayName(product)}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
            priority={index === 0}
            onError={() => {
              setImageErrors(prev => new Set(prev).add(product.id))
            }}
            unoptimized={process.env.NODE_ENV === 'development'}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-2">🏔️</div>
              <div className="text-sm font-medium text-gray-600">
                {getCustomerDisplayName(product)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {product.primary_image ? t('imagePreparing') : t('imagePreparing')}
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
        {/* 운송수단 아이콘 (이미지 위에 표시) */}
        <div className="absolute bottom-3 left-3 flex gap-1.5 flex-wrap">
          {(() => {
            const methods = product.transportation_methods
            
            // 디버깅
            if (index === 0) {
              console.log('First product transportation_methods:', {
                raw: methods,
                type: typeof methods,
                isArray: Array.isArray(methods),
                length: Array.isArray(methods) ? methods.length : 'N/A',
                valid: hasValidTransportationMethods(methods)
              })
            }
            
            if (hasValidTransportationMethods(methods)) {
              const validMethods = (methods as string[]).filter(m => m && typeof m === 'string' && m.trim().length > 0)
              return validMethods.slice(0, 3).map((method, idx) => {
                const trimmedMethod = method.trim()
                const { icon: Icon, label } = getTransportationIcon(trimmedMethod)
                return (
                  <div
                    key={`transport-${trimmedMethod}-${idx}`}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm shadow-md border border-white/50 hover:bg-white transition-colors"
                    title={label}
                  >
                    <Icon className="w-4 h-4 text-blue-700" />
                  </div>
                )
              })
            } else {
              // 운송수단이 없으면 카테고리 뱃지 표시
              return (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-white/90 backdrop-blur-sm text-gray-800 shadow-md border border-white/50">
                  {getCategoryLabel(product.category)}
                </span>
              )
            }
          })()}
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

        {/* 운송수단 아이콘 */}
        {(() => {
          const methods = product.transportation_methods
          
          if (hasValidTransportationMethods(methods)) {
            const validMethods = (methods as string[]).filter(m => m && typeof m === 'string' && m.trim().length > 0)
            return (
              <div className="mb-3 flex flex-wrap gap-2">
                {validMethods.map((method, index) => {
                  const trimmedMethod = method.trim()
                  const { icon: Icon, label } = getTransportationIcon(trimmedMethod)
                  return (
                    <div
                      key={`transport-badge-${trimmedMethod}-${index}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
                      title={label}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{label}</span>
                    </div>
                  )
                })}
              </div>
            )
          }
          return null
        })()}

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
        <div className="space-y-2 mb-4 text-sm text-gray-600">
          {product.departure_city && (
            <div className="flex items-center">
              <MapPin className="h-4 w-4 mr-2 text-blue-600 flex-shrink-0" />
              <span className="truncate">
                {product.departure_city}
                {product.departure_country && `, ${product.departure_country}`}
              </span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
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
  )

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
          
          {/* 뷰 모드 및 태그 링크 */}
          <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
            <Link
              href="/ko/products/tags"
              className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              🏷️ {t('viewByTags')}
            </Link>
            
            {/* 뷰 모드 토글 */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grouped')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'grouped'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title={t('groupedView')}
              >
                <List className="w-4 h-4 inline mr-1" />
                {t('groupedView')}
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title={t('gridView')}
              >
                <Grid3x3 className="w-4 h-4 inline mr-1" />
                {t('gridView')}
              </button>
            </div>
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
          <>
            {viewMode === 'grouped' ? (
              /* 카테고리별 그룹화 뷰 */
              <div className="space-y-8">
                {availableCategories.length > 0 ? (
                  availableCategories.map((category) => {
                    const categoryProducts = productsByCategory[category] || []
                    const isExpanded = expandedCategories.has(category)
                    
                    return (
                      <div key={category} className="bg-white rounded-lg shadow-sm border overflow-hidden">
                        {/* 카테고리 헤더 */}
                        <button
                          onClick={() => toggleCategory(category)}
                          className="w-full px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-colors flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <h2 className="text-xl font-bold text-gray-900">
                              {getCategoryLabel(category)}
                            </h2>
                            <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                              {categoryProducts.length} {t('items')}
                            </span>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-600" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-600" />
                          )}
                        </button>
                        
                        {/* 카테고리 상품 목록 */}
                        {isExpanded && (
                          <div className="p-6 space-y-6">
                            {(() => {
                              const subCategories = subCategoriesByCategory[category] || []
                              const hasSubCategories = subCategories.length > 0
                              const otherProducts = productsByCategoryAndSubCategory[category]?.['기타'] || []
                              
                              return (
                                <>
                                  {/* 서브카테고리별 그룹화 */}
                                  {hasSubCategories && subCategories.map((subCategory) => {
                                    const subCategoryProducts = productsByCategoryAndSubCategory[category]?.[subCategory] || []
                                    const subCategoryKey = `${category}:${subCategory}`
                                    const isSubCategoryExpanded = expandedSubCategories.has(subCategoryKey)
                                    
                                    // 서브카테고리가 '기타'이고 상품이 없으면 표시하지 않음
                                    if (subCategory === '기타' && subCategoryProducts.length === 0) {
                                      return null
                                    }
                                    
                                    return (
                                      <div key={subCategoryKey} className="border-l-4 border-blue-200 bg-gray-50 rounded-r-lg overflow-hidden">
                                        {/* 서브카테고리 헤더 */}
                                        <button
                                          onClick={() => toggleSubCategory(category, subCategory)}
                                          className="w-full px-5 py-3 bg-gradient-to-r from-gray-50 to-blue-50 hover:from-gray-100 hover:to-blue-100 transition-colors flex items-center justify-between"
                                        >
                                          <div className="flex items-center gap-3">
                                            <h3 className="text-lg font-semibold text-gray-800">
                                              {subCategory}
                                            </h3>
                                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                              {subCategoryProducts.length} {t('items')}
                                            </span>
                                          </div>
                                          {isSubCategoryExpanded ? (
                                            <ChevronUp className="w-4 h-4 text-gray-600" />
                                          ) : (
                                            <ChevronDown className="w-4 h-4 text-gray-600" />
                                          )}
                                        </button>
                                        
                                        {/* 서브카테고리 상품 목록 */}
                                        {isSubCategoryExpanded && (
                                          <div className="p-5">
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                              {subCategoryProducts.map((product, index) => renderProductCard(product, index))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                  
                                  {/* 서브카테고리가 없는 상품들 (기타) */}
                                  {otherProducts.length > 0 && (
                                    <div className="border-l-4 border-gray-300 bg-gray-50 rounded-r-lg overflow-hidden">
                                      <div className="px-5 py-3 bg-gray-100">
                                        <div className="flex items-center gap-3">
                                          <h3 className="text-lg font-semibold text-gray-800">
                                            {t('other') || '기타'}
                                          </h3>
                                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-700">
                                            {otherProducts.length} {t('items')}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="p-5">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                          {otherProducts.map((product, index) => renderProductCard(product, index))}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* 서브카테고리가 없는 경우 전체 상품 표시 */}
                                  {!hasSubCategories && categoryProducts.length > 0 && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                      {categoryProducts.map((product, index) => renderProductCard(product, index))}
                                    </div>
                                  )}
                                </>
                              )
                            })()}
                          </div>
                        )}
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center py-12 bg-white rounded-lg shadow-sm border">
                    <Search className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium text-gray-900">{t('noSearchResults')}</p>
                    <p className="text-gray-600">{t('tryDifferentSearch')}</p>
                  </div>
                )}
              </div>
            ) : (
              /* 일반 그리드 뷰 */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map((product, index) => renderProductCard(product, index))}
              </div>
            )}
          </>
        )}

        {/* 검색 결과 없음 - 그리드 뷰 전용 */}
        {!loading && !error && viewMode === 'grid' && filteredProducts.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm border">
            <Search className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium text-gray-900">{t('noSearchResults')}</p>
            <p className="text-gray-600">{t('tryDifferentSearch')}</p>
          </div>
        )}
      </div>
    </div>
  )
}

