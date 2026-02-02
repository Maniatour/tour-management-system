import React, { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Package, Users, DollarSign, Clock, Copy, Star } from 'lucide-react'
import { 
  MdDirectionsCar,      // 밴
  MdDirectionsBus,      // 버스
  MdFlightTakeoff,      // 경비행기
  MdLocalTaxi          // 리무진
} from 'react-icons/md'
import { FaHelicopter } from 'react-icons/fa'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import { getGroupColorClasses } from '@/utils/groupColors'

type Product = Database['public']['Tables']['products']['Row']

interface ProductCardProps {
  product: Product
  locale: string
  collapsed?: boolean
  onStatusChange?: (productId: string, newStatus: string) => void
  onProductCopied?: (newProductId: string) => void
  onFavoriteToggle?: (productId: string, isFavorite: boolean) => void
}

export default function ProductCard({ product, locale, collapsed = false, onStatusChange, onProductCopied, onFavoriteToggle }: ProductCardProps) {
  const t = useTranslations('products')
  const productDisplayName = locale === 'en' ? ((product as any).name_en || product.name) : product.name
  const [isUpdating, setIsUpdating] = useState(false)
  const [localStatus, setLocalStatus] = useState(product.status || 'inactive')
  const [isCopying, setIsCopying] = useState(false)
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false)
  const [isFavorite, setIsFavorite] = useState((product as any).is_favorite || false)
  const [choicePriceRange, setChoicePriceRange] = useState<{ min: number; max: number } | null>(null)

  const handleStatusToggle = async (e: React.MouseEvent) => {
    e.preventDefault() // Link 클릭 방지
    e.stopPropagation() // 이벤트 버블링 방지
    
    if (isUpdating) return
    
    const newStatus = localStatus === 'active' ? 'inactive' : 'active'
    
    try {
      setIsUpdating(true)
      
      // 로컬 상태 즉시 업데이트 (낙관적 업데이트)
      setLocalStatus(newStatus)
      
      // 데이터베이스에 상태 업데이트
      const { error } = await supabase
        .from('products')
        .update({ status: newStatus })
        .eq('id', product.id)
      
      if (error) {
        console.error('상품 상태 업데이트 오류:', error)
        // 에러 시 원래 상태로 되돌리기
        setLocalStatus(product.status || 'inactive')
        return
      }
      
      // 부모 컴포넌트에 상태 변경 알림
      if (onStatusChange) {
        onStatusChange(product.id, newStatus)
      }
      
    } catch (error) {
      console.error('상품 상태 업데이트 중 예상치 못한 오류:', error)
      // 에러 시 원래 상태로 되돌리기
      setLocalStatus(product.status || 'inactive')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleFavoriteToggle = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (isTogglingFavorite) return
    
    const newFavoriteStatus = !isFavorite
    
    try {
      setIsTogglingFavorite(true)
      
      // 로컬 상태 즉시 업데이트 (낙관적 업데이트)
      setIsFavorite(newFavoriteStatus)
      
      // 즐겨찾기 순서 계산 (즐겨찾기로 설정할 때만)
      let favoriteOrder: number | null = null
      if (newFavoriteStatus) {
        // 현재 즐겨찾기된 상품들의 최대 순서 가져오기
        const { data: favorites } = await supabase
          .from('products')
          .select('favorite_order')
          .eq('is_favorite', true)
          .not('favorite_order', 'is', null)
          .order('favorite_order', { ascending: false })
          .limit(1)
        
        favoriteOrder = favorites && favorites.length > 0 
          ? ((favorites[0] as any).favorite_order || 0) + 1 
          : 1
      }
      
      // 데이터베이스에 즐겨찾기 상태 업데이트
      const { error } = await supabase
        .from('products')
        .update({ 
          is_favorite: newFavoriteStatus,
          favorite_order: favoriteOrder
        })
        .eq('id', product.id)
      
      if (error) {
        console.error('즐겨찾기 상태 업데이트 오류:', error)
        // 에러 시 원래 상태로 되돌리기
        setIsFavorite((product as any).is_favorite || false)
        return
      }
      
      // 부모 컴포넌트에 상태 변경 알림
      if (onFavoriteToggle) {
        onFavoriteToggle(product.id, newFavoriteStatus)
      }
      
    } catch (error) {
      console.error('즐겨찾기 상태 업데이트 중 예상치 못한 오류:', error)
      // 에러 시 원래 상태로 되돌리기
      setIsFavorite((product as any).is_favorite || false)
    } finally {
      setIsTogglingFavorite(false)
    }
  }

  const handleCopyProduct = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (isCopying) return
    
    try {
      setIsCopying(true)
      
      // 간단한 복사 데이터 준비 (기본 필드만)
      const copyData = {
        name: locale === 'en' ? `${(product as any).name_en || product.name} (Copy)` : `${product.name} (복사본)`,
        name_en: (product as any).name_en ? `${(product as any).name_en} (Copy)` : null,
        product_code: product.product_code ? `${product.product_code}_COPY` : null,
        category: product.category,
        sub_category: product.sub_category,
        description: product.description,
        duration: product.duration,
        base_price: product.base_price,
        max_participants: product.max_participants,
        status: 'draft' as const, // 복사본은 초안 상태로 생성
        departure_city: product.departure_city,
        arrival_city: product.arrival_city,
        departure_country: product.departure_country,
        arrival_country: product.arrival_country,
        languages: product.languages,
        group_size: product.group_size,
        adult_age: product.adult_age,
        child_age_min: product.child_age_min,
        child_age_max: product.child_age_max,
        infant_age: product.infant_age,
        tags: product.tags
      }
      
      // 새 상품 생성
      const { data: newProduct, error: productError } = await supabase
        .from('products')
        .insert(copyData)
        .select()
        .single()
      
      if (productError) {
        console.error('상품 복사 오류:', productError)
        alert('상품 복사 중 오류가 발생했습니다.')
        return
      }
      
      // 타입 단언으로 해결
      const newProductData = newProduct as { id: string } | null
      
      // 성공 메시지
      alert(`상품이 성공적으로 복사되었습니다! 새 상품 ID: ${newProductData?.id}`)
      
      // 부모 컴포넌트에 알림
      if (onProductCopied) {
        onProductCopied(newProductData?.id || '')
      }
      
      // 새 상품 편집 페이지로 이동
      window.location.href = `/${locale}/admin/products/${newProductData?.id}`
      
    } catch (error) {
      console.error('상품 복사 중 예상치 못한 오류:', error)
      alert('상품 복사 중 오류가 발생했습니다.')
    } finally {
      setIsCopying(false)
    }
  }
  const getCategoryLabel = (category: string) => {
    const categoryLabels: { [key: string]: string } = {
      city: '도시',
      nature: '자연',
      culture: '문화',
      adventure: '모험',
      food: '음식',
      history: '역사',
      shopping: '쇼핑',
      entertainment: '엔터테인먼트',
      beach: '해변',
      mountain: '산',
      museum: '박물관',
      park: '공원',
      temple: '사원',
      market: '시장',
      restaurant: '레스토랑',
      cafe: '카페',
      hotel: '호텔',
      resort: '리조트',
      spa: '스파',
      wellness: '웰니스',
      sports: '스포츠',
      outdoor: '아웃도어',
      indoor: '실내',
      family: '가족',
      couple: '커플',
      solo: '솔로',
      group: '단체',
      luxury: '럭셔리',
      budget: '예산',
      midrange: '중급',
      premium: '프리미엄'
    }
    return categoryLabels[category] || category
  }

  // 카테고리별 색상 매핑
  const getCategoryColor = (category: string) => {
    const categoryColors: { [key: string]: string } = {
      tour: 'bg-blue-100 text-blue-800 border-blue-200',
      service: 'bg-purple-100 text-purple-800 border-purple-200',
      hotel: 'bg-amber-100 text-amber-800 border-amber-200',
      transportation: 'bg-green-100 text-green-800 border-green-200',
      meal: 'bg-red-100 text-red-800 border-red-200',
      activity: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      default: 'bg-gray-100 text-gray-800 border-gray-200'
    }
    const normalizedCategory = category?.toLowerCase() || ''
    return categoryColors[normalizedCategory] || categoryColors.default
  }

  // 카테고리와 서브카테고리를 합친 라벨 생성
  const getCombinedCategoryLabel = (category: string | null, subCategory: string | null) => {
    const categoryLabel = category ? getCategoryLabel(category) : ''
    const subCategoryLabel = subCategory ? getSubCategoryLabel(subCategory) : ''
    
    if (categoryLabel && subCategoryLabel) {
      return `${categoryLabel} - ${subCategoryLabel}`
    } else if (categoryLabel) {
      return categoryLabel
    } else if (subCategoryLabel) {
      return subCategoryLabel
    }
    return '-'
  }

  const getSubCategoryLabel = (subCategory: string) => {
    const subCategoryLabels: { [key: string]: string } = {
      // 도시 관련
      downtown: '시내',
      old_town: '구시가지',
      modern: '현대',
      traditional: '전통',
      
      // 자연 관련
      forest: '숲',
      river: '강',
      lake: '호수',
      ocean: '바다',
      waterfall: '폭포',
      cave: '동굴',
      
      // 문화 관련
      art: '예술',
      music: '음악',
      theater: '극장',
      festival: '축제',
      workshop: '워크샵',
      
      // 모험 관련
      hiking: '등산',
      climbing: '클라이밍',
      rafting: '래프팅',
      diving: '다이빙',
      zip_line: '지프라인',
      
      // 음식 관련
      local: '로컬',
      fine_dining: '파인다이닝',
      street_food: '길거리음식',
      seafood: '해산물',
      vegetarian: '채식',
      
      // 역사 관련
      ancient: '고대',
      medieval: '중세',
      modern_history: '근현대사',
      archaeological: '고고학',
      
      // 쇼핑 관련
      mall: '쇼핑몰',
      boutique: '부티크',
      souvenir: '기념품',
      local_market: '전통시장',
      
      // 엔터테인먼트 관련
      theme_park: '테마파크',
      casino: '카지노',
      nightlife: '야간생활',
      show: '쇼',
      
      // 호텔 관련
      luxury_hotel: '럭셔리호텔',
      boutique_hotel: '부티크호텔',
      resort_hotel: '리조트호텔',
      budget_hotel: '예산호텔',
      
      // 스포츠 관련
      golf: '골프',
      tennis: '테니스',
      swimming: '수영',
      yoga: '요가',
      
      // 계절 관련
      spring: '봄',
      summer: '여름',
      autumn: '가을',
      winter: '겨울',
      
      // 시간 관련
      morning: '아침',
      afternoon: '오후',
      evening: '저녁',
      night: '밤',
      
      // 그룹 관련
      small_group: '소규모',
      large_group: '대규모',
      private: '프라이빗',
      shared: '공유'
    }
    return subCategoryLabels[subCategory] || subCategory
  }

  const _getStatusLabel = (status: string) => {
    const statusLabels: { [key: string]: string } = {
      active: '활성',
      inactive: '비활성',
      draft: '초안'
    }
    return statusLabels[status] || status
  }

  const _getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'inactive': return 'bg-red-100 text-red-800'
      case 'draft': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // 초이스 옵션 가격 범위 로드
  useEffect(() => {
    const loadChoicePriceRange = async () => {
      try {
        const { data, error } = await supabase
          .from('product_choices')
          .select(`
            id,
            options:choice_options (
              adult_price
            )
          `)
          .eq('product_id', product.id)

        if (error) {
          console.error('초이스 가격 범위 로드 오류:', error)
          return
        }

        if (!data || data.length === 0) {
          setChoicePriceRange(null)
          return
        }

        // 모든 옵션의 adult_price 수집
        const prices: number[] = []
        data.forEach((choice: any) => {
          if (choice.options && Array.isArray(choice.options)) {
            choice.options.forEach((option: any) => {
              if (option.adult_price !== null && option.adult_price !== undefined) {
                prices.push(option.adult_price)
              }
            })
          }
        })

        if (prices.length === 0) {
          setChoicePriceRange(null)
          return
        }

        const minPrice = Math.min(...prices)
        const maxPrice = Math.max(...prices)

        setChoicePriceRange({ min: minPrice, max: maxPrice })
      } catch (error) {
        console.error('초이스 가격 범위 로드 중 오류:', error)
        setChoicePriceRange(null)
      }
    }

    loadChoicePriceRange()
  }, [product.id])

  // choices 데이터를 파싱하여 선택지 옵션들을 추출하는 함수 (그룹 정보 포함)
  const getChoicesOptions = (product: Product) => {
    if (!product.choices || typeof product.choices !== 'object') {
      return []
    }

    const choices = product.choices as {
      required?: Array<{
        id?: string;
        name?: string;
        name_ko?: string;
        options?: Array<{
          id?: string;
          name?: string;
          name_ko?: string;
          price?: number;
          adult_price?: number;
        }>;
      }>;
    }
    
    const options: Array<{ 
      id: string; 
      name: string; 
      name_ko?: string; 
      price?: number;
      groupId?: string;
      groupName?: string;
      groupNameKo?: string;
    }> = []

    // required choices에서 옵션들 추출 (그룹 정보 포함)
    if (choices.required && Array.isArray(choices.required)) {
      choices.required.forEach((choice) => {
        if (choice.options && Array.isArray(choice.options)) {
          choice.options.forEach((option) => {
            options.push({
              id: option.id || '',
              name: option.name || '',
              name_ko: option.name_ko || '',
              price: option.price || option.adult_price || 0,
              groupId: choice.id || '',
              groupName: choice.name || '',
              groupNameKo: choice.name_ko || ''
            })
          })
        }
      })
    }

    return options
  }

  // choices 옵션들을 뱃지로 렌더링하는 함수 (그룹별 색상 적용) - 추후 사용 가능
  const _renderChoicesBadges = (product: Product) => {
    const options = getChoicesOptions(product)
    
    if (options.length === 0) {
      return null
    }

    return (
      <div className="flex flex-wrap gap-1 mt-2">
        {options.slice(0, 4).map((option, index) => {
          const colorClasses = getGroupColorClasses(option.groupId || '', option.groupName, 'object') as {
            bg: string;
            text: string;
            border: string;
            price: string;
          }
          
          const optionLabel = locale === 'en' ? (option.name || option.name_ko) : (option.name_ko || option.name)
          const groupLabel = locale === 'en' ? (option.groupName || option.groupNameKo) : (option.groupNameKo || option.groupName)
          return (
            <span
              key={`${option.id}-${index}`}
              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colorClasses.bg} ${colorClasses.text} border ${colorClasses.border}`}
              title={`${groupLabel || ''} - ${optionLabel || ''}`}
            >
              {optionLabel}
              {(option.price || 0) > 0 && (
                <span className={`ml-1 ${colorClasses.price}`}>
                  (+${option.price})
                </span>
              )}
            </span>
          )
        })}
        {options.length > 4 && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200">
            +{options.length - 4}{locale === 'en' ? ` ${t('moreItems')}` : t('moreItems')}
          </span>
        )}
      </div>
    )
  }

  // 운송수단 아이콘 매핑 함수
  const getTransportationIcon = (method: string) => {
    const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
      minivan: MdDirectionsCar,
      van: MdDirectionsCar,
      bus: MdDirectionsBus,
      helicopter: FaHelicopter,
      light_aircraft: MdFlightTakeoff,
      aircraft: MdFlightTakeoff,
      limousine: MdLocalTaxi,
      car: MdDirectionsCar,
      suv: MdDirectionsCar,
    }
    
    const normalizedMethod = method.toLowerCase().trim()
    return iconMap[normalizedMethod] || MdDirectionsCar
  }

  // 운송수단 데이터 유효성 검사
  const hasValidTransportationMethods = (methods: string[] | null | undefined): boolean => {
    if (!methods) return false
    if (!Array.isArray(methods)) return false
    if (methods.length === 0) return false
    return methods.some(m => m && typeof m === 'string' && m.trim().length > 0)
  }

  // 운송수단 아이콘 렌더링
  const renderTransportationMethods = (product: Product) => {
    const methods = product.transportation_methods
    
    if (!hasValidTransportationMethods(methods)) {
      return null
    }

    const validMethods = (methods as string[]).filter(m => m && typeof m === 'string' && m.trim().length > 0)
    
    return (
      <div className="flex items-center gap-1.5">
        {validMethods.slice(0, 5).map((method, index) => {
          const Icon = getTransportationIcon(method)
          return (
            <span
              key={`transport-${method}-${index}`}
              className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 text-blue-700 border border-blue-200"
              title={method}
            >
              <Icon className="w-3.5 h-3.5" />
            </span>
          )
        })}
        {validMethods.length > 5 && (
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-50 text-gray-600 border border-gray-200 text-xs">
            +{validMethods.length - 5}
          </span>
        )}
      </div>
    )
  }

  return (
    <Link href={`/${locale}/admin/products/${product.id}`} className="block">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow max-w-full overflow-hidden">
        {/* 카드 헤더 */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center space-x-3 min-w-0 flex-1">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-gray-900 line-clamp-2" title={productDisplayName}>
                  {productDisplayName}
                </h3>
              </div>
            </div>
            <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
              {/* 즐겨찾기 버튼 */}
              <button
                onClick={handleFavoriteToggle}
                disabled={isTogglingFavorite}
                className={`p-1 rounded transition-colors ${
                  isTogglingFavorite
                    ? 'text-gray-400 cursor-not-allowed'
                    : isFavorite
                    ? 'text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50'
                    : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'
                }`}
                title={isFavorite ? t('removeFavorite') : t('addFavorite')}
              >
                <Star className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
              </button>
              
              {/* 복사 버튼 */}
              <button
                onClick={handleCopyProduct}
                disabled={isCopying}
                className={`p-1 rounded transition-colors ${
                  isCopying 
                    ? 'text-gray-400 cursor-not-allowed' 
                    : 'text-green-600 hover:text-green-900 hover:bg-green-50'
                }`}
                title={t('copyProduct')}
              >
                <Copy className="h-4 w-4" />
              </button>
              
              {/* 상태 토글 스위치 */}
              <button
                onClick={handleStatusToggle}
                disabled={isUpdating}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  localStatus === 'active' ? 'bg-blue-600' : 'bg-gray-200'
                } ${isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    localStatus === 'active' ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
          
          {/* 카테고리 뱃지 */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {(product.category || product.sub_category) && (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getCategoryColor(product.category || '')}`}>
                {getCombinedCategoryLabel(product.category || '', product.sub_category || null)}
              </span>
            )}
          </div>
        </div>

        {/* 카드 본문 */}
        {!collapsed && (
          <div className="p-4 space-y-3">
            {/* 이미지 */}
            {Boolean((product as Record<string, unknown>).primary_image || (product as Record<string, unknown>).thumbnail_url) && (
              <div className="relative w-full bg-gray-100 rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
                <img
                  src={((product as Record<string, unknown>).thumbnail_url || (product as Record<string, unknown>).primary_image) as string}
                  alt={productDisplayName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
            )}

            {/* 상품명(고객 한글/영어 - locale에 따라 하나만 표시) */}
            <div className="space-y-1">
              {locale === 'en' ? (
                productDisplayName && (
                  <p className="text-sm text-gray-900 font-medium">{productDisplayName}</p>
                )
              ) : (
                <>
                  {(product as any).name_ko && (
                    <p className="text-sm text-gray-900 font-medium">{(product as any).name_ko}</p>
                  )}
                  {(product as any).name_en && (
                    <p className="text-xs text-gray-600">{(product as any).name_en}</p>
                  )}
                </>
              )}
            </div>

            {/* 설명 - locale이 en이면 summary_en 우선 */}
            {(() => {
              const descriptionText = locale === 'en'
                ? ((product as any).summary_en || product.description)
                : product.description
              return descriptionText ? (
                <p className="text-sm text-gray-600 line-clamp-2">
                  {descriptionText}
                </p>
              ) : null
            })()}

            {/* 상품 정보 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center space-x-1.5">
                <Clock className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-xs text-gray-600">
                  {product.duration || t('durationTbd')}
                </span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Users className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-xs text-gray-600">
                  {t('maxPeople', { count: String(product.max_participants ?? 'N/A') })}
                </span>
              </div>
            </div>

            {/* 태그 */}
            {product.tags && product.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {product.tags.slice(0, 3).map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-800"
                  >
                    {tag}
                  </span>
                ))}
                {product.tags.length > 3 && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-500">
                    +{product.tags.length - 3}
                  </span>
                )}
              </div>
            )}

             {/* 가격 및 운송수단 */}
             <div className="flex items-center justify-between pt-3 border-t border-gray-100">
               <div className="flex-1">
                 <div className="flex items-center space-x-1.5">
                   <DollarSign className="h-4 w-4 text-green-600" />
                   <div className="flex flex-col">
                     {choicePriceRange ? (
                       <div className="text-lg font-bold text-green-600">
                         <span className="text-xs font-medium text-gray-600 mr-1">{t('ownChannelPrice')}</span>
                         ${(product.base_price || 0) + choicePriceRange.min}
                         {choicePriceRange.min !== choicePriceRange.max && ` ~ $${(product.base_price || 0) + choicePriceRange.max}`}
                       </div>
                     ) : (
                       <div className="text-lg font-bold text-green-600">
                         <span className="text-xs font-medium text-gray-600 mr-1">{t('ownChannelPrice')}</span>
                         ${product.base_price || 0}
                       </div>
                     )}
                   </div>
                 </div>
               </div>
               {/* 운송수단 아이콘 - 오른쪽 끝 정렬 */}
               {renderTransportationMethods(product)}
             </div>
          </div>
        )}

      </div>
    </Link>
  )
}
