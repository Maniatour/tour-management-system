'use client'

import { useState, useEffect } from 'react'
import { Search, Loader2 } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
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
  primary_image?: string | null
}

interface TagCategory {
  id: string
  name: string
  nameEn: string
  icon: string
  description: string
  color: string
  products: Product[]
}

export default function ProductTagsPage() {
  const locale = useLocale()
  
  const [tagCategories, setTagCategories] = useState<TagCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  // 태그 카테고리 정의
  const tagDefinitions: Omit<TagCategory, 'products'>[] = [
    {
      id: 'antelope-canyon',
      name: '앤텔롭 캐년',
      nameEn: 'Antelope Canyon',
      icon: '🏜️',
      description: '세계적으로 유명한 사암 협곡의 아름다움을 경험하세요',
      color: 'from-yellow-400 to-orange-500'
    },
    {
      id: 'grand-canyon',
      name: '그랜드캐년',
      nameEn: 'Grand Canyon',
      icon: '🏔️',
      description: '세계 7대 자연경관의 위대함을 만나보세요',
      color: 'from-orange-400 to-red-500'
    },
    {
      id: 'suburban-tour',
      name: '근교투어',
      nameEn: 'Suburban Tour',
      icon: '🗺️',
      description: '도시 근처의 아름다운 자연을 탐험하세요',
      color: 'from-green-400 to-emerald-500'
    },
    {
      id: 'day-tour',
      name: '당일투어',
      nameEn: 'Day Tour',
      icon: '🛣️',
      description: '하루 만에 완성하는 특별한 여행',
      color: 'from-blue-400 to-cyan-500'
    },
    {
      id: 'accommodation-tour',
      name: '숙박투어',
      nameEn: 'Accommodation Tour',
      icon: '🏕️',
      description: '숙박이 포함된 며칠간의 여행',
      color: 'from-purple-400 to-pink-500'
    },
    {
      id: 'city-tour',
      name: '시티투어',
      nameEn: 'City Tour',
      icon: '🏙️',
      description: '도시의 명소와 문화를 둘러보세요',
      color: 'from-indigo-400 to-blue-500'
    },
    {
      id: 'helicopter-tour',
      name: '헬기 투어',
      nameEn: 'Helicopter Tour',
      icon: '🚁',
      description: '하늘에서 바라보는 장관의 풍경',
      color: 'from-red-400 to-pink-500'
    },
    {
      id: 'light-aircraft-tour',
      name: '경비행기 투어',
      nameEn: 'Light Aircraft Tour',
      icon: '✈️',
      description: '로맨틱한 항공 투어 경험',
      color: 'from-sky-400 to-blue-500'
    },
    {
      id: 'bus-tour',
      name: '버스투어',
      nameEn: 'Bus Tour',
      icon: '🚌',
      description: '편안한 버스로 떠나는 그룹 투어',
      color: 'from-yellow-400 to-orange-500'
    },
    {
      id: 'premium-tour',
      name: '프리미엄 투어',
      nameEn: 'Premium Tour',
      icon: '⭐',
      description: '최고급 서비스의 특별한 투어',
      color: 'from-amber-400 to-yellow-500'
    },
    {
      id: 'performance-ticket',
      name: '공연티켓',
      nameEn: 'Performance Ticket',
      icon: '🎫',
      description: '다양한 공연과 쇼의 티켓',
      color: 'from-orange-400 to-red-500'
    },
    {
      id: 'attraction',
      name: '어트랙션',
      nameEn: 'Attraction',
      icon: '🎪',
      description: '재미있는 놀이시설과 어트랙션',
      color: 'from-purple-400 to-pink-500'
    },
    {
      id: 'event',
      name: '이벤트',
      nameEn: 'Event',
      icon: '🎉',
      description: '특별한 이벤트와 축제',
      color: 'from-pink-400 to-rose-500'
    },
    {
      id: 'coupon',
      name: '쿠폰',
      nameEn: 'Coupon',
      icon: '🎟️',
      description: '할인 혜택이 있는 쿠폰',
      color: 'from-green-400 to-emerald-500'
    },
    {
      id: 'insurance',
      name: '보험',
      nameEn: 'Insurance',
      icon: '🛡️',
      description: '안전한 여행을 위한 보험',
      color: 'from-blue-400 to-indigo-500'
    },
    {
      id: 'convention-support',
      name: '컨벤션지원',
      nameEn: 'Convention Support',
      icon: '🤝',
      description: '비즈니스 미팅과 컨벤션 지원',
      color: 'from-teal-400 to-cyan-500'
    }
  ]

  // 상품 데이터 로드
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
                .single()
              
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
              
              return { ...product, primary_image: null }
            } catch (err) {
              console.error(`Error fetching image for product ${product.id}:`, err)
              return { ...product, primary_image: null }
            }
          })
        )

        // 태그별로 상품 분류
        const categorizedTags = tagDefinitions.map(tagDef => {
          const matchingProducts = productsWithImages.filter(product => {
            if (!product.tags) return false
            return product.tags.some(tag => 
              tag.toLowerCase().includes(tagDef.id.toLowerCase()) ||
              tag.toLowerCase().includes(tagDef.name.toLowerCase()) ||
              tag.toLowerCase().includes(tagDef.nameEn.toLowerCase())
            )
          })
          
          return {
            ...tagDef,
            products: matchingProducts
          }
        })

        setTagCategories(categorizedTags)
      } catch (err) {
        console.error('Error fetching products:', err)
        setError('제품을 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }
    
    fetchProducts()
  }, [])

  const getCustomerDisplayName = (product: Product) => {
    if (locale === 'en' && product.customer_name_en) {
      return product.customer_name_en
    }
    return product.customer_name_ko || product.name_ko || product.name
  }

  const filteredTagCategories = tagCategories.filter(tagCategory => {
    if (!searchTerm) return true
    
    const searchLower = searchTerm.toLowerCase()
    return (
      tagCategory.name.toLowerCase().includes(searchLower) ||
      tagCategory.nameEn.toLowerCase().includes(searchLower) ||
      tagCategory.description.toLowerCase().includes(searchLower) ||
      tagCategory.products.some(product => 
        getCustomerDisplayName(product).toLowerCase().includes(searchLower)
      )
    )
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-4xl font-bold text-gray-900 text-center">상품 태그별 모아보기</h1>
          <p className="mt-4 text-xl text-gray-600 text-center">
            관심 있는 카테고리별로 상품을 찾아보세요
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 검색 */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="태그명, 상품명으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* 로딩 상태 */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">상품을 불러오는 중...</span>
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

        {/* 태그 카테고리 목록 */}
        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTagCategories.map((tagCategory) => (
              <div key={tagCategory.id} className="bg-white rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow">
                {/* 태그 헤더 */}
                <div className={`bg-gradient-to-r ${tagCategory.color} p-6 text-white`}>
                  <div className="flex items-center space-x-3">
                    <div className="text-3xl">{tagCategory.icon}</div>
                    <div>
                      <h3 className="text-lg font-bold">
                        {locale === 'en' ? tagCategory.nameEn : tagCategory.name}
                      </h3>
                      <p className="text-sm opacity-90">{tagCategory.description}</p>
                    </div>
                  </div>
                  <div className="mt-3 text-sm">
                    {tagCategory.products.length}개 상품
                  </div>
                </div>

                {/* 상품 목록 */}
                <div className="p-4">
                  {tagCategory.products.length > 0 ? (
                    <div className="space-y-3">
                      {tagCategory.products.slice(0, 3).map((product) => (
                        <Link
                          key={product.id}
                          href={`/ko/products/${product.id}`}
                          className="block p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                        >
                          <div className="flex items-center space-x-3">
                            {product.primary_image ? (
                              <div className="w-12 h-12 relative rounded-lg overflow-hidden">
                                <Image
                                  src={product.primary_image}
                                  alt={getCustomerDisplayName(product)}
                                  fill
                                  sizes="48px"
                                  className="object-cover"
                                />
                              </div>
                            ) : (
                              <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                                <span className="text-gray-400">🏔️</span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-gray-900 truncate">
                                {getCustomerDisplayName(product)}
                              </h4>
                              <p className="text-xs text-gray-500">
                                ${product.base_price}부터
                              </p>
                            </div>
                          </div>
                        </Link>
                      ))}
                      {tagCategory.products.length > 3 && (
                        <div className="text-center pt-2">
                          <Link
                            href={`/ko/products?tag=${tagCategory.id}`}
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            +{tagCategory.products.length - 3}개 더 보기
                          </Link>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      <p className="text-sm">해당 태그의 상품이 없습니다</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 검색 결과 없음 */}
        {!loading && !error && filteredTagCategories.length === 0 && (
          <div className="text-center py-12">
            <Search className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium text-gray-900">검색 결과가 없습니다</p>
            <p className="text-gray-600">다른 검색어를 시도해보세요</p>
          </div>
        )}
      </div>
    </div>
  )
}
