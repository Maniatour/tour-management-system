'use client'

import { Suspense, useState, useEffect } from 'react'
import { Search, Loader2, Mountain } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { useLocale, useTranslations } from 'next-intl'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import CustomerPagePreviewHighlightEffect from '@/components/product/CustomerPagePreviewHighlightEffect'
import { useCustomerPageEditMode } from '@/components/product/CustomerPageEditModeProvider'
import CustomerPageZoneLayoutRenderer from '@/components/product/CustomerPageZoneLayoutRenderer'
import CustomerPageShell from '@/components/customer/CustomerPageShell'
import PriceDisplay from '@/components/customer/ui/PriceDisplay'
import { getTagCategoryIcon } from '@/lib/tagCategoryIcons'
import { withLowestChoicePrices } from '@/lib/fetchLowestChoicePrices'
import { resolveProductListingPrice } from '@/lib/productDetailDisplay'

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
  lowest_choice_price?: number | null
}

interface TagCategory {
  id: string
  name: string
  nameEn: string
  description: string
  products: Product[]
}

export default function ProductTagsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">…</div>}>
      <ProductTagsPageInner />
    </Suspense>
  )
}

function ProductTagsPageInner() {
  const locale = useLocale()
  const t = useTranslations('common')
  const { isPreview, isEditMode } = useCustomerPageEditMode()
  const contentEditMode = isPreview && isEditMode
  const [tagCategories, setTagCategories] = useState<TagCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  // 태그 카테고리 정의
  const tagDefinitions: Omit<TagCategory, 'products'>[] = [
    { id: 'antelope-canyon', name: '앤텔롭 캐년', nameEn: 'Antelope Canyon', description: '세계적으로 유명한 사암 협곡의 아름다움을 경험하세요' },
    { id: 'grand-canyon', name: '그랜드캐년', nameEn: 'Grand Canyon', description: '세계 7대 자연경관의 위대함을 만나보세요' },
    { id: 'suburban-tour', name: '근교투어', nameEn: 'Suburban Tour', description: '도시 근처의 아름다운 자연을 탐험하세요' },
    { id: 'day-tour', name: '당일투어', nameEn: 'Day Tour', description: '하루 만에 완성하는 특별한 여행' },
    { id: 'accommodation-tour', name: '숙박투어', nameEn: 'Accommodation Tour', description: '숙박이 포함된 며칠간의 여행' },
    { id: 'city-tour', name: '시티투어', nameEn: 'City Tour', description: '도시의 명소와 문화를 둘러보세요' },
    { id: 'helicopter-tour', name: '헬기 투어', nameEn: 'Helicopter Tour', description: '하늘에서 바라보는 장관의 풍경' },
    { id: 'light-aircraft-tour', name: '경비행기 투어', nameEn: 'Light Aircraft Tour', description: '로맨틱한 항공 투어 경험' },
    { id: 'bus-tour', name: '버스투어', nameEn: 'Bus Tour', description: '편안한 버스로 떠나는 그룹 투어' },
    { id: 'premium-tour', name: '프리미엄 투어', nameEn: 'Premium Tour', description: '최고급 서비스의 특별한 투어' },
    { id: 'performance-ticket', name: '공연티켓', nameEn: 'Performance Ticket', description: '다양한 공연과 쇼의 티켓' },
    { id: 'attraction', name: '어트랙션', nameEn: 'Attraction', description: '재미있는 놀이시설과 어트랙션' },
    { id: 'event', name: '이벤트', nameEn: 'Event', description: '특별한 이벤트와 축제' },
    { id: 'coupon', name: '쿠폰', nameEn: 'Coupon', description: '할인 혜택이 있는 쿠폰' },
    { id: 'insurance', name: '보험', nameEn: 'Insurance', description: '안전한 여행을 위한 보험' },
    { id: 'convention-support', name: '컨벤션지원', nameEn: 'Convention Support', description: '비즈니스 미팅과 컨벤션 지원' },
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
          ((data || []) as Product[]).map(async (product) => {
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

        const productsWithChoicePrices = await withLowestChoicePrices(productsWithImages)

        // 태그별로 상품 분류
        const categorizedTags = tagDefinitions.map(tagDef => {
          const matchingProducts = productsWithChoicePrices.filter(product => {
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

        setTagCategories(categorizedTags as TagCategory[])
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
    <CustomerPageShell locale={locale}>
      <div className={`min-h-screen app-page-bg ${contentEditMode ? 'bg-muted/30' : ''}`}>
        <CustomerPagePreviewHighlightEffect />
      <CustomerPageZoneLayoutRenderer
        pageId="products-tags"
        layoutEditMode={false}
        renderBlock={(zoneId) => {
          if (zoneId === 'tags-page-header') {
            return (
              <CustomerPageZone zone="tags-page-header" className="shadow-sm border-b cp-ui-panel-surface">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                  <h1 className="text-4xl font-bold text-center">{t('tagsPageTitle')}</h1>
                  <p className="mt-4 text-xl cp-ui-muted text-center">{t('tagsPageSubtitle')}</p>
                </div>
              </CustomerPageZone>
            )
          }

          if (zoneId === 'tags-page-categories') {
            return (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="app-panel mb-8 p-6">
                  <div className="relative">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      size={20}
                    />
                    <input
                      type="text"
                      placeholder={t('tagsPageSearchPlaceholder')}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="app-input pl-10"
                    />
                  </div>
                </div>

                {loading && (
                  <div className="flex justify-center items-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin cp-ui-icon" />
                    <span className="ml-2 cp-ui-muted">상품을 불러오는 중...</span>
                  </div>
                )}

                {error && (
                  <div className="text-center py-12">
                    <div className="text-red-600 mb-4">{error}</div>
                    <button
                      onClick={() => window.location.reload()}
                      className="cp-ui-btn-primary px-4 py-2 rounded-lg transition-colors"
                    >
                      다시 시도
                    </button>
                  </div>
                )}

                {!loading && !error && (
                  <CustomerPageZone
                    zone="tags-page-categories"
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                  >
                    {filteredTagCategories.map((tagCategory) => {
                      const Icon = getTagCategoryIcon(tagCategory.id)
                      return (
                      <div
                        key={tagCategory.id}
                        className="cp-ui-card-surface overflow-hidden rounded-card border border-border/60 shadow-card transition-shadow hover:shadow-card-hover"
                      >
                        <div className="border-b border-border/60 bg-card p-6">
                          <div className="flex items-start gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-booking/10">
                              <Icon className="h-5 w-5 text-booking" aria-hidden />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="text-lg font-bold">
                                {locale === 'en' ? tagCategory.nameEn : tagCategory.name}
                              </h3>
                              <p className="mt-1 text-sm cp-ui-muted">{tagCategory.description}</p>
                              <p className="mt-2 text-xs font-medium text-booking">
                                {tagCategory.products.length}개 상품
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="p-4">
                          {tagCategory.products.length > 0 ? (
                            <div className="space-y-3">
                              {tagCategory.products.slice(0, 3).map((product) => (
                                <Link
                                  key={product.id}
                                  href={`/${locale}/products/${product.id}`}
                                  className="block rounded-lg border border-border/60 p-3 transition-colors hover:border-booking/30"
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
                                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted/50">
                                        <Mountain className="h-5 w-5 text-muted-foreground" aria-hidden />
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <h4 className="text-sm font-medium truncate">
                                        {getCustomerDisplayName(product)}
                                      </h4>
                                      <div className="text-xs cp-ui-muted">
                                        <PriceDisplay
                                          amount={
                                            resolveProductListingPrice(
                                              product as unknown as Record<string, unknown>
                                            ) ?? product.base_price ?? 0
                                          }
                                          {...(locale === 'en'
                                            ? { prefixLabel: 'From', suffixLabel: '/ person' }
                                            : { suffixLabel: '부터' })}
                                          size="sm"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </Link>
                              ))}
                              {tagCategory.products.length > 3 && (
                                <div className="text-center pt-2">
                                  <Link
                                    href={`/${locale}/products?tag=${tagCategory.id}`}
                                    className="text-sm cp-ui-link hover:underline"
                                  >
                                    +{tagCategory.products.length - 3}개 더 보기
                                  </Link>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="py-4 text-center text-muted-foreground">
                              <p className="text-sm">해당 태그의 상품이 없습니다</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )})}
                  </CustomerPageZone>
                )}

                {!loading && !error && filteredTagCategories.length === 0 && (
                  <div className="py-12 text-center">
                    <Search className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
                    <p className="text-lg font-medium text-foreground">검색 결과가 없습니다</p>
                    <p className="text-muted-foreground">다른 검색어를 시도해보세요</p>
                  </div>
                )}
              </div>
            )
          }

          return null
        }}
      />
      </div>
    </CustomerPageShell>
  )
}
