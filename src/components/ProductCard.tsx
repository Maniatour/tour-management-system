import React, { useState } from 'react'
import { Package, Users, DollarSign, Clock, Copy } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import { getGroupColorClasses } from '@/utils/groupColors'

type Product = Database['public']['Tables']['products']['Row']

interface ProductCardProps {
  product: Product
  locale: string
  onStatusChange?: (productId: string, newStatus: string) => void
  onProductCopied?: (newProductId: string) => void
}

export default function ProductCard({ product, locale, onStatusChange, onProductCopied }: ProductCardProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [localStatus, setLocalStatus] = useState(product.status || 'inactive')
  const [isCopying, setIsCopying] = useState(false)

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

  const handleCopyProduct = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (isCopying) return
    
    try {
      setIsCopying(true)
      
      // 간단한 복사 데이터 준비 (기본 필드만)
      const copyData = {
        name: `${product.name} (복사본)`,
        name_en: product.name_en ? `${product.name_en} (Copy)` : null,
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

  const getStatusLabel = (status: string) => {
    const statusLabels: { [key: string]: string } = {
      active: '활성',
      inactive: '비활성',
      draft: '초안'
    }
    return statusLabels[status] || status
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'inactive': return 'bg-red-100 text-red-800'
      case 'draft': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriceDisplay = (product: Product) => {
    return `$${product.base_price}`
  }

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

  // choices 옵션들을 뱃지로 렌더링하는 함수 (그룹별 색상 적용)
  const renderChoicesBadges = (product: Product) => {
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
          
          return (
            <span
              key={`${option.id}-${index}`}
              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colorClasses.bg} ${colorClasses.text} border ${colorClasses.border}`}
              title={`${option.groupNameKo || option.groupName || ''} - ${option.name_ko || option.name}`}
            >
              {option.name_ko || option.name}
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
            +{options.length - 4}개
          </span>
        )}
      </div>
    )
  }

  return (
    <Link href={`/${locale}/admin/products/${product.id}`} className="block">
      <div className="bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer group">
        {/* 카드 헤더 */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <Package className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                  {product.name}
                </h3>
                <div className="flex items-center space-x-1 mt-1">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(localStatus)}`}>
                    {getStatusLabel(localStatus)}
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {getCategoryLabel(product.category || '')}
                  </span>
                  {product.sub_category && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {getSubCategoryLabel(product.sub_category)}
                    </span>
                  )}
                </div>
                {/* Choices 선택지 뱃지 */}
                {renderChoicesBadges(product)}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {/* 복사 버튼 */}
              <button
                onClick={handleCopyProduct}
                disabled={isCopying}
                className={`p-1 rounded-full transition-colors ${
                  isCopying 
                    ? 'text-gray-400 cursor-not-allowed' 
                    : 'text-green-600 hover:text-green-800 hover:bg-green-50'
                }`}
                title="상품 복사"
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
        </div>

        {/* 카드 본문 */}
        <div className="p-4 space-y-3">
          {/* 설명 */}
          {product.description && (
            <p className="text-gray-600 text-xs line-clamp-2">
              {product.description}
            </p>
          )}

          {/* 상품 정보 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center space-x-1.5">
              <Clock className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-xs text-gray-600">
                {product.duration || '시간 미정'}
              </span>
            </div>
            <div className="flex items-center space-x-1.5">
              <Users className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-xs text-gray-600">
                최대 {product.max_participants || 'N/A'}명
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

          {/* 가격 */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <div className="flex items-center space-x-1.5">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="text-lg font-bold text-green-600">
                {getPriceDisplay(product)}
              </span>
            </div>
          </div>
        </div>

      </div>
    </Link>
  )
}
