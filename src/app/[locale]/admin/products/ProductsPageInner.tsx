'use client'

import { useState, useEffect, useMemo, type SetStateAction } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Search, Grid3x3, List, Copy, Save, X, Edit2, ChevronDown, ChevronRight, Star, Languages, Trash2, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import ProductCard from '@/components/ProductCard'
import FavoriteOrderModal from '@/components/admin/FavoriteOrderModal'
import ProductLocaleReadinessModal from '@/components/admin/ProductLocaleReadinessModal'
import AdminProductCardPreviewLocaleToggle from '@/components/admin/AdminProductCardPreviewLocaleToggle'
import AdminPageHubManualButton from '@/components/admin/AdminPageHubManualButton'
import { useRoutePersistedState } from '@/hooks/useRoutePersistedState'
import type { AdminProductCardPreviewLocale } from '@/lib/adminProductCardPreviewLabels'
import { buildAdminProductCustomerEditPath } from '@/lib/adminProductCustomerEdit'
import {
  PRODUCTS_HOME_SECTIONS_MANUAL_SLUG,
  productsHomeSectionsManualDocument,
  productsHomeSectionsManualTitles,
} from '@/lib/productsHomeSectionsManualDocument'
import { withLowestChoicePrices } from '@/lib/fetchLowestChoicePrices'
import { withPrimaryImages } from '@/lib/fetchProductPrimaryImagesBatch'
import { fetchAdminChoiceCombinations } from '@/lib/adminProductChoiceCombinations'
import { useOperatorOptional } from '@/contexts/OperatorContext'
import { resolveOperatorId, withOperatorId } from '@/lib/operators/scopeQuery'
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'
import { cloneAdminProduct } from '@/lib/adminProductClone'
import {
  canSoftDeleteAdminProduct,
  isAdminProductSoftDeleted,
  restoreAdminProduct,
  softDeleteAdminProduct,
} from '@/lib/adminProductDelete'
import { useAuth } from '@/contexts/AuthContext'

type Product = Database['public']['Tables']['products']['Row']

const PRODUCTS_LIST_UI_DEFAULT = {
  searchTerm: '',
  selectedCategory: 'all',
  selectedSubCategory: 'all',
  selectedStatus: 'active',
  selectedPublish: 'all' as 'all' | 'published' | 'unpublished',
  viewMode: 'card' as 'card' | 'table',
  cardPreviewLocale: 'ko' as AdminProductCardPreviewLocale,
}

export default function AdminProducts() {
  const paramsObj = useParams()
  const locale = paramsObj.locale as string
  const t = useTranslations('products')
  const tCommon = useTranslations('common')
  const { operatorId } = useOperatorOptional()
  const { user, userPosition } = useAuth()
  const canSoftDelete = canSoftDeleteAdminProduct(user?.email, userPosition)

  const initialListUi = useMemo(
    () => ({
      ...PRODUCTS_LIST_UI_DEFAULT,
      cardPreviewLocale: (locale === 'en' ? 'en' : 'ko') as AdminProductCardPreviewLocale,
    }),
    [locale]
  )

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [listUi, setListUi] = useRoutePersistedState('products-list', initialListUi)
  const {
    searchTerm,
    selectedCategory,
    selectedSubCategory,
    selectedStatus,
    selectedPublish,
    viewMode,
    cardPreviewLocale,
  } = listUi
  const setSearchTerm = (v: SetStateAction<string>) =>
    setListUi((u) => ({
      ...u,
      searchTerm: typeof v === 'function' ? (v as (s: string) => string)(u.searchTerm) : v,
    }))
  const setSelectedCategory = (c: string) => setListUi((u) => ({ ...u, selectedCategory: c }))
  const setSelectedSubCategory = (c: string) => setListUi((u) => ({ ...u, selectedSubCategory: c }))
  const setSelectedStatus = (s: string) => setListUi((u) => ({ ...u, selectedStatus: s }))
  const setSelectedPublish = (p: 'all' | 'published' | 'unpublished') =>
    setListUi((u) => ({ ...u, selectedPublish: p }))
  const setViewMode = (m: 'card' | 'table') => setListUi((u) => ({ ...u, viewMode: m }))
  const setCardPreviewLocale = (previewLocale: AdminProductCardPreviewLocale) =>
    setListUi((u) => ({ ...u, cardPreviewLocale: previewLocale }))
  const [categories, setCategories] = useState<{ value: string; label: string; count: number }[]>([])
  const [subCategories, setSubCategories] = useState<{ value: string; label: string; count: number }[]>([])
  const [allSubCategories, setAllSubCategories] = useState<{ value: string; label: string; count: number }[]>([])
  const [statusCounts, setStatusCounts] = useState<{ value: string; labelKey: string; count: number }[]>([])
  const [updatingProducts, setUpdatingProducts] = useState<Set<string>>(new Set())
  const [copyingProducts, setCopyingProducts] = useState<Set<string>>(new Set())
  const [editingField, setEditingField] = useState<{ productId: string; fieldName: string } | null>(null)
  const [editingValue, setEditingValue] = useState<string | number>('')
  const [savingProducts, setSavingProducts] = useState<Set<string>>(new Set())
  const [choiceCombinations, setChoiceCombinations] = useState<{ 
    [productId: string]: Array<{
      id: string
      combinationName: string
      combinationNameKo: string
      totalPrice: number
      isDefault: boolean
      choices: Array<{
        id: string
        name: string
        name_ko: string
        adult_price: number
        child_price: number
        infant_price: number
        is_default: boolean
      }>
    }>
  }>({})
  const [homepageChannel, setHomepageChannel] = useState<any>(null)
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
  const [isFavoriteOrderModalOpen, setIsFavoriteOrderModalOpen] = useState(false)
  const [isLocaleReadinessModalOpen, setIsLocaleReadinessModalOpen] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Supabase에서 상품 데이터 가져오기 (테넌트 전환 시 재조회)
  useEffect(() => {
    void fetchProducts()
    void fetchHomepageChannel()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when active operator changes
  }, [operatorId])

  // 홈페이지 채널 정보 가져오기 (테넌트 스코프; Kovegas만 M00001 보정)
  const fetchHomepageChannel = async () => {
    try {
      const opId = resolveOperatorId(operatorId)
      const scoped = withOperatorId(
        supabase
          .from('channels')
          .select('*')
          .or('name.ilike.%홈페이지%,name.ilike.%homepage%,name.ilike.%direct%')
          .eq('status', 'active')
          .limit(1),
        opId
      )

      const [scopedResult, m00001Result] = await Promise.all([
        scoped.maybeSingle(),
        opId === KOVEgAS_OPERATOR_ID
          ? supabase.from('channels').select('*').eq('id', 'M00001').maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ])

      if (scopedResult.error && scopedResult.error.code !== 'PGRST116') {
        console.error('홈페이지 채널 조회 오류:', scopedResult.error)
      }

      const channel = m00001Result.data || scopedResult.data
      setHomepageChannel(channel ?? null)
    } catch (error) {
      console.error('홈페이지 채널 조회 중 예상치 못한 오류:', error)
    }
  }

  const fetchChoicePrices = async (productIds: string[]) => {
    try {
      const combinationsMap = await fetchAdminChoiceCombinations(supabase, productIds)
      setChoiceCombinations(combinationsMap as typeof choiceCombinations)
    } catch (error) {
      console.error('초이스 가격 조회 중 예상치 못한 오류:', error)
    }
  }

  const fetchProducts = async () => {
    try {
      setLoading(true)
      setLoadError(null)

      const { data, error } = await withOperatorId(
        supabase.from('products').select('*'),
        operatorId
      ).order('name', { ascending: true })

      if (error) {
        console.error('Products 데이터 조회 오류:', error)
        console.error('오류 상세 정보:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        
        if (error.code === '42P01') {
          console.error('Products 테이블이 존재하지 않습니다. 데이터베이스 마이그레이션이 필요합니다.')
        }
        
        setProducts([])
        setLoadError(error.message || t('retry'))
        return
      }

      // 대표사진 배치 조회 (N+1 제거)
      const productsWithImages = await withPrimaryImages(data || [])
      const productsWithChoicePrices = await withLowestChoicePrices(productsWithImages)
      setProducts(productsWithChoicePrices as Product[])
      
      // 초이스 가격 정보 가져오기
      if (data && data.length > 0) {
        const productIds = data.map(p => p.id)
        await fetchChoicePrices(productIds)
      }
      
      // 카테고리별 상품 수 계산 (삭제됨은 '전체'에서 제외, 별도 탭)
      if (data && data.length > 0) {
        const categoryCounts: { [key: string]: number } = {}
        const subCategoryCounts: { [key: string]: number } = {}
        const statusCountsMap: { [key: string]: number } = {}
        const nonDeleted = data.filter((p) => !isAdminProductSoftDeleted((p as { status?: string | null }).status))
        
        data.forEach(product => {
          if ((product as any).category) {
            categoryCounts[(product as any).category] = (categoryCounts[(product as any).category] || 0) + 1
          }
          if ((product as any).sub_category) {
            subCategoryCounts[(product as any).sub_category] = (subCategoryCounts[(product as any).sub_category] || 0) + 1
          }
          if ((product as any).status) {
            statusCountsMap[(product as any).status] = (statusCountsMap[(product as any).status] || 0) + 1
          }
        })
        
        // 카테고리 목록 생성 (전체 + 실제 존재하는 카테고리들)
        const categoryList = [
          { value: 'all', label: tCommon('all'), count: nonDeleted.length }
        ]
        
        // 실제 존재하는 카테고리들을 상품 수 순으로 정렬하여 추가
        Object.entries(categoryCounts)
          .sort(([,a], [,b]) => b - a) // 상품 수 내림차순 정렬
          .forEach(([category, count]) => {
            categoryList.push({ value: category, label: category, count })
          })
        
        // 서브카테고리 목록 생성 (전체 + 실제 존재하는 서브카테고리들)
        const subCategoryList = [
          { value: 'all', label: tCommon('all'), count: nonDeleted.length }
        ]
        
        // 실제 존재하는 서브카테고리들을 상품 수 순으로 정렬하여 추가
        Object.entries(subCategoryCounts)
          .sort(([,a], [,b]) => b - a) // 상품 수 내림차순 정렬
          .forEach(([subCategory, count]) => {
            subCategoryList.push({ value: subCategory, label: subCategory, count })
          })
        
        // 상태 목록 생성 (전체 + 실제 존재하는 상태들)
        const statusList: { value: string; labelKey: string; count: number }[] = [
          { value: 'all', labelKey: 'all', count: nonDeleted.length }
        ]
        
        // 실제 존재하는 상태들을 상품 수 순으로 정렬하여 추가
        Object.entries(statusCountsMap)
          .sort(([,a], [,b]) => b - a) // 상품 수 내림차순 정렬
          .forEach(([status, count]) => {
            statusList.push({ value: status, labelKey: status, count })
          })
        
        setCategories(categoryList)
        setAllSubCategories(subCategoryList)
        setSubCategories(subCategoryList)
        setStatusCounts(statusList)
      }
    } catch (error) {
      console.error('Products 조회 중 예상치 못한 오류:', error)
      setProducts([])
      setLoadError(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }



  // 카테고리 선택 시 서브카테고리 필터링
  const handleCategorySelect = (categoryValue: string) => {
    setSelectedCategory(categoryValue)
    setSelectedSubCategory('all') // 서브카테고리 초기화
    
    if (categoryValue === 'all') {
      // 전체 선택 시 모든 서브카테고리 표시
      setSubCategories(allSubCategories)
    } else {
      // 특정 카테고리 선택 시 해당 카테고리의 서브카테고리만 표시
      const filteredSubCategories = products
        .filter(product => product.category === categoryValue && product.sub_category)
        .reduce((acc, product) => {
          const subCategory = product.sub_category!
          const existing = acc.find((item: { value: string; label: string; count: number }) => item.value === subCategory)
          if (existing) {
            existing.count++
          } else {
            acc.push({ value: subCategory, label: subCategory, count: 1 })
          }
          return acc
        }, [] as { value: string; label: string; count: number }[])
      
      // 전체 옵션 추가
      const categorySubCategories = [
        { value: 'all', label: tCommon('all'), count: products.filter(p => p.category === categoryValue).length },
        ...filteredSubCategories.sort((a: { value: string; label: string; count: number }, b: { value: string; label: string; count: number }) => b.count - a.count)
      ]
      
      setSubCategories(categorySubCategories)
    }
  }

  const publishCounts = useMemo(() => {
    const publishedCount = products.filter((p) => p.is_published !== false).length
    const unpublishedCount = products.filter((p) => p.is_published === false).length
    return [
      { value: 'all' as const, labelKey: 'all', count: products.length },
      { value: 'published' as const, labelKey: 'published', count: publishedCount },
      { value: 'unpublished' as const, labelKey: 'unpublished', count: unpublishedCount },
    ]
  }, [products])

  // 필터링된 상품 목록
  const filteredProducts = products.filter(product => {
    const matchesSearch = 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ((product as any).category && (product as any).category.toLowerCase().includes(searchTerm.toLowerCase())) ||
      ((product as any).sub_category && (product as any).sub_category.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (product.tags && product.tags.some((tag: string) => tag.toLowerCase().includes(searchTerm.toLowerCase())))
    
    const matchesCategory = selectedCategory === 'all' || (product as any).category === selectedCategory
    const matchesSubCategory = selectedSubCategory === 'all' || (product as any).sub_category === selectedSubCategory
    const matchesStatus =
      selectedStatus === 'all'
        ? !isAdminProductSoftDeleted((product as { status?: string | null }).status)
        : (product as { status?: string | null }).status === selectedStatus
    const isPublished = product.is_published !== false
    const matchesPublish =
      selectedPublish === 'all' ||
      (selectedPublish === 'published' && isPublished) ||
      (selectedPublish === 'unpublished' && !isPublished)
    
    return matchesSearch && matchesCategory && matchesSubCategory && matchesStatus && matchesPublish
  }).sort((a, b) => {
    // name 컬럼으로 정렬
    const nameA = a.name || ''
    const nameB = b.name || ''
    return nameA.localeCompare(nameB, 'ko', { numeric: true })
  })

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedCategory('all')
    setSelectedSubCategory('all')
    setSelectedStatus('active')
    setSelectedPublish('all')
    setSubCategories(allSubCategories) // 서브카테고리를 전체 목록으로 복원
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
    const categoryColors: { [key: string]: { bg: string; text: string; border: string } } = {
      tour: { bg: 'bg-primary/10', text: 'text-primary', border: 'border-border' },
      service: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
      hotel: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
      transportation: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
      meal: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
      activity: { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200' },
      default: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' }
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
      downtown: '시내',
      old_town: '구시가지',
      modern: '현대',
      traditional: '전통',
      forest: '숲',
      river: '강',
      lake: '호수',
      ocean: '바다',
      waterfall: '폭포',
      cave: '동굴',
      art: '예술',
      music: '음악',
      theater: '극장',
      festival: '축제',
      workshop: '워크샵',
      hiking: '등산',
      climbing: '클라이밍',
      rafting: '래프팅',
      diving: '다이빙',
      zip_line: '지프라인',
      local: '로컬',
      fine_dining: '파인다이닝',
      street_food: '길거리음식',
      seafood: '해산물',
      vegetarian: '채식',
      ancient: '고대',
      medieval: '중세',
      modern_history: '근현대사',
      archaeological: '고고학',
      mall: '쇼핑몰',
      boutique: '부티크',
      souvenir: '기념품',
      local_market: '전통시장',
      theme_park: '테마파크',
      casino: '카지노',
      nightlife: '야간생활',
      show: '쇼',
      luxury_hotel: '럭셔리호텔',
      boutique_hotel: '부티크호텔',
      resort_hotel: '리조트호텔',
      budget_hotel: '예산호텔',
      golf: '골프',
      tennis: '테니스',
      swimming: '수영',
      skiing: '스키',
      surfing: '서핑'
    }
    return subCategoryLabels[subCategory] || subCategory
  }

  // 상태 토글 핸들러
  const handleStatusToggle = async (productId: string, currentStatus: string) => {
    if (updatingProducts.has(productId)) return
    if (isAdminProductSoftDeleted(currentStatus)) return
    
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    
    try {
      setUpdatingProducts(prev => new Set(prev).add(productId))
      
      // 로컬 상태 즉시 업데이트
      setProducts(prevProducts => 
        prevProducts.map(p => 
          p.id === productId ? { ...p, status: newStatus } : p
        )
      )
      
      // 데이터베이스에 상태 업데이트
      const { error } = await supabase
        .from('products')
        .update({ status: newStatus })
        .eq('id', productId)
        .eq('operator_id', resolveOperatorId(operatorId))
      
      if (error) {
        console.error('상품 상태 업데이트 오류:', error)
        // 에러 시 원래 상태로 되돌리기
        setProducts(prevProducts => 
          prevProducts.map(p => 
            p.id === productId ? { ...p, status: currentStatus } : p
          )
        )
      }
    } catch (error) {
      console.error('상품 상태 업데이트 중 예상치 못한 오류:', error)
      // 에러 시 원래 상태로 되돌리기
      setProducts(prevProducts => 
        prevProducts.map(p => 
          p.id === productId ? { ...p, status: currentStatus } : p
        )
      )
    } finally {
      setUpdatingProducts(prev => {
        const next = new Set(prev)
        next.delete(productId)
        return next
      })
    }
  }

  const handleSoftDeleteProduct = async (product: Product) => {
    if (!canSoftDelete || updatingProducts.has(product.id)) return
    if (isAdminProductSoftDeleted(product.status)) return

    const name =
      product.customer_name_ko || product.name_ko || product.name || product.id
    const ok = window.confirm(t('softDeleteConfirm', { name }))
    if (!ok) return

    try {
      setUpdatingProducts((prev) => new Set(prev).add(product.id))
      await softDeleteAdminProduct(supabase, product.id, operatorId)
      await fetchProducts()
      alert(t('edit.softDeleteSuccess'))
    } catch (error) {
      console.error('상품 soft delete 오류:', error)
      const msg = error instanceof Error ? error.message : String(error)
      alert(`${t('edit.softDeleteError')}\n\n${msg}`)
    } finally {
      setUpdatingProducts((prev) => {
        const next = new Set(prev)
        next.delete(product.id)
        return next
      })
    }
  }

  const handleRestoreProduct = async (product: Product) => {
    if (!canSoftDelete || updatingProducts.has(product.id)) return
    if (!isAdminProductSoftDeleted(product.status)) return

    try {
      setUpdatingProducts((prev) => new Set(prev).add(product.id))
      await restoreAdminProduct(supabase, product.id, operatorId)
      await fetchProducts()
      alert(t('edit.restoreSuccess'))
    } catch (error) {
      console.error('상품 복구 오류:', error)
      const msg = error instanceof Error ? error.message : String(error)
      alert(`${t('edit.restoreError')}\n\n${msg}`)
    } finally {
      setUpdatingProducts((prev) => {
        const next = new Set(prev)
        next.delete(product.id)
        return next
      })
    }
  }

  // 고객 사이트 배포 토글 (판매 상태와 별개)
  const handlePublishToggle = async (productId: string, currentPublished: boolean) => {
    if (updatingProducts.has(productId)) return

    const newPublished = !currentPublished

    try {
      setUpdatingProducts((prev) => new Set(prev).add(productId))

      setProducts((prevProducts) =>
        prevProducts.map((p) => (p.id === productId ? { ...p, is_published: newPublished } : p))
      )

      const { error } = await supabase
        .from('products')
        .update({ is_published: newPublished })
        .eq('id', productId)
        .eq('operator_id', resolveOperatorId(operatorId))

      if (error) {
        console.error('상품 배포 상태 업데이트 오류:', error)
        setProducts((prevProducts) =>
          prevProducts.map((p) =>
            p.id === productId ? { ...p, is_published: currentPublished } : p
          )
        )
      }
    } catch (error) {
      console.error('상품 배포 상태 업데이트 중 예상치 못한 오류:', error)
      setProducts((prevProducts) =>
        prevProducts.map((p) =>
          p.id === productId ? { ...p, is_published: currentPublished } : p
        )
      )
    } finally {
      setUpdatingProducts((prev) => {
        const next = new Set(prev)
        next.delete(productId)
        return next
      })
    }
  }

  // 인라인 편집 시작
  const startEdit = (productId: string, fieldName: string, currentValue: string | number | null) => {
    setEditingField({ productId, fieldName })
    setEditingValue(currentValue ?? '')
  }

  // 인라인 편집 취소
  const cancelEdit = () => {
    setEditingField(null)
    setEditingValue('')
  }

  // 인라인 편집 저장
  const saveEdit = async (productId: string, fieldName: string, value?: string | number) => {
    if (savingProducts.has(productId)) return

    try {
      setSavingProducts(prev => new Set(prev).add(productId))

      // 업데이트할 데이터 준비
      const updateData: any = {}
      const valueToUse = value !== undefined ? value : editingValue
      
      // 필드 타입에 따라 값 변환
      if (fieldName === 'base_price' || fieldName === 'max_participants') {
        updateData[fieldName] = valueToUse === '' ? null : Number(valueToUse)
      } else {
        updateData[fieldName] = valueToUse === '' ? null : String(valueToUse)
      }

      // Supabase 업데이트
      const { error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', productId)
        .eq('operator_id', resolveOperatorId(operatorId))

      if (error) {
        console.error('상품 업데이트 오류:', error)
        alert('상품 정보 업데이트 중 오류가 발생했습니다.')
        return
      }

      // 로컬 상태 업데이트
      setProducts(prevProducts => 
        prevProducts.map(p => 
          p.id === productId ? { ...p, ...updateData } : p
        )
      )

      // 편집 모드 종료
      cancelEdit()
    } catch (error) {
      console.error('상품 업데이트 중 예상치 못한 오류:', error)
      alert('상품 정보 업데이트 중 오류가 발생했습니다.')
    } finally {
      setSavingProducts(prev => {
        const next = new Set(prev)
        next.delete(productId)
        return next
      })
    }
  }

  // 카테고리 옵션 목록 (드롭다운용)
  const getCategoryOptions = () => {
    return categories.filter(c => c.value !== 'all').map(c => ({
      value: c.value,
      label: getCategoryLabel(c.value)
    }))
  }

  // 서브카테고리 옵션 목록 (드롭다운용)
  const getSubCategoryOptions = (category?: string | null): { value: string; label: string }[] => {
    if (!category) {
      return allSubCategories.filter(c => c.value !== 'all').map(c => ({
        value: c.value,
        label: getSubCategoryLabel(c.value)
      }))
    }
    
    const filtered = products
      .filter(p => p.category === category && p.sub_category)
      .reduce((acc: { value: string; label: string }[], p) => {
        const subCat = p.sub_category!
        if (!acc.find((item: { value: string; label: string }) => item.value === subCat)) {
          acc.push({
            value: subCat,
            label: getSubCategoryLabel(subCat)
          })
        }
        return acc
      }, [] as { value: string; label: string }[])
    
    return filtered
  }

  // 상품 복사 핸들러 (초이스·미디어·상세·가격 포함)
  const handleCopyProduct = async (product: Product) => {
    if (copyingProducts.has(product.id)) return
    
    try {
      setCopyingProducts(prev => new Set(prev).add(product.id))

      const result = await cloneAdminProduct(
        supabase,
        product.id,
        operatorId,
        locale === 'en' ? 'en' : 'ko'
      )

      alert(
        locale === 'en'
          ? `Product copied. New id: ${result.newProductId}`
          : `상품이 복사되었습니다. (초이스 ${result.counts.choices}, 가격 ${result.counts.pricing}건 포함)\n새 ID: ${result.newProductId}`
      )

      fetchProducts()
      window.location.href = `/${locale}/admin/products/${result.newProductId}`
    } catch (error) {
      console.error('상품 복사 중 예상치 못한 오류:', error)
      const msg = error instanceof Error ? error.message : String(error)
      alert(locale === 'en' ? `Copy failed: ${msg}` : `상품 복사 중 오류: ${msg}`)
    } finally {
      setCopyingProducts(prev => {
        const next = new Set(prev)
        next.delete(product.id)
        return next
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <div className="text-gray-500">{tCommon('loading')}</div>
        </div>
      </div>
    )
  }

  // 로드 실패 vs 빈 목록 구분
  if (products.length === 0 && !loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-gray-900">{t('title')}</h1>
          {!loadError && (
            <Link
              href={`/${locale}/admin/products/new`}
              className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm font-medium hover:bg-primary/90"
            >
              {t('addProduct')}
            </Link>
          )}
        </div>
        
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {loadError
              ? locale === 'en'
                ? 'Failed to load products'
                : '상품을 불러오지 못했습니다'
              : t('noProducts')}
          </h3>
          <p className="text-gray-600 mb-4">
            {loadError || t('noProductsDescription')}
          </p>
          <div className="space-y-2">
            <button
              onClick={fetchProducts}
              className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm font-medium hover:bg-primary/90"
            >
              {t('retry')}
            </button>
            {!loadError && (
              <div className="text-xs text-gray-500">
                {t('orAddNewProduct')}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{t('pageTitle')}</h1>
            <AdminPageHubManualButton
              slug={PRODUCTS_HOME_SECTIONS_MANUAL_SLUG}
              fallbackDoc={productsHomeSectionsManualDocument}
              fallbackTitle={productsHomeSectionsManualTitles}
              storageKey="products-home-sections-manual-modal-rect-v1"
            />
            <AdminProductCardPreviewLocaleToggle
              value={cardPreviewLocale}
              onChange={setCardPreviewLocale}
              koLabel={t('cardPreviewLocaleKo')}
              enLabel={t('cardPreviewLocaleEn')}
              groupLabel={t('cardPreviewLocaleGroup')}
            />
          </div>
          <p className="mt-1 text-sm text-gray-600">{t('pageDescription')}</p>
          <p className="mt-1 text-xs text-indigo-700">{t('homeSectionsManualHint')}</p>
          {viewMode === 'card' ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {cardPreviewLocale === 'ko' ? t('cardPreviewLocaleKoHint') : t('cardPreviewLocaleEnHint')}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
          <Link
            href={`/${locale}/admin/products/locale-readiness`}
            className="bg-indigo-600 text-white px-3 py-1.5 rounded-md hover:bg-indigo-700 flex items-center gap-1.5 text-sm font-medium"
          >
            <Languages size={16} />
            <span>{t('localeReadiness.button')}</span>
          </Link>
          <button
            onClick={() => setIsFavoriteOrderModalOpen(true)}
            className="bg-yellow-500 text-white px-3 py-1.5 rounded-md hover:bg-yellow-600 flex items-center gap-1.5 text-sm font-medium"
          >
            <Star size={16} />
            <span>{t('favoriteOrder')}</span>
          </button>
          <Link
            href={`/${locale}/admin/products/new`}
            className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 flex items-center gap-1.5 text-sm font-medium"
          >
            <Plus size={16} />
            <span>{t('addProduct')}</span>
          </Link>
        </div>
      </div>

      {/* 검색 및 필터 섹션 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        {/* 카테고리와 서브카테고리 탭 */}
        <div className="space-y-0">
          {/* 카테고리 탭 */}
          {categories.length > 1 && (
            <div className="border-b border-gray-200">
              <div className="flex items-center justify-between">
                <nav className="flex space-x-4 overflow-x-auto">
                  {categories.map((category) => (
                    <button
                      key={category.value}
                      onClick={() => handleCategorySelect(category.value)}
                      className={`flex items-center space-x-1 py-2 px-2 border-b-2 font-medium text-xs whitespace-nowrap transition-colors ${
                        selectedCategory === category.value
                          ? 'border-primary text-primary'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <span>{category.label}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                        selectedCategory === category.value
                          ? 'bg-primary/10 text-primary'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {category.count}
                      </span>
                    </button>
                  ))}
                </nav>
                
                {/* 검색창 */}
                <div className="relative flex-shrink-0">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
        <input
          type="text"
                    placeholder={t('searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-56 pl-7 pr-3 py-1.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-ring focus:border-transparent text-sm"
        />
      </div>
                        </div>
                      </div>
          )}

          {/* 서브카테고리 탭 */}
          {subCategories.length > 1 && (
            <div className="border-b border-gray-200">
              <nav className="flex space-x-4 overflow-x-auto px-3">
                {subCategories.map((subCategory) => (
                  <button
                    key={subCategory.value}
                    onClick={() => setSelectedSubCategory(subCategory.value)}
                    className={`flex items-center space-x-1 py-2 px-2 border-b-2 font-medium text-xs whitespace-nowrap transition-colors ${
                      selectedSubCategory === subCategory.value
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span>{subCategory.label}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                      selectedSubCategory === subCategory.value
                        ? 'bg-primary/10 text-primary'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {subCategory.count}
                    </span>
                  </button>
                ))}
              </nav>
            </div>
          )}

          {/* 상태 탭 */}
          {statusCounts.length > 1 && (
            <div className="border-b border-gray-200">
              <nav className="flex space-x-4 overflow-x-auto px-3">
                {statusCounts.map((status) => (
                  <button
                    key={status.value}
                    onClick={() => setSelectedStatus(status.value)}
                    className={`flex items-center space-x-1 py-2 px-2 border-b-2 font-medium text-xs whitespace-nowrap transition-colors ${
                      selectedStatus === status.value
                        ? 'border-green-500 text-green-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span>{status.labelKey === 'all' ? t('all') : t(`status.${status.labelKey}`)}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                      selectedStatus === status.value
                        ? 'bg-green-100 text-green-600'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {status.count}
                    </span>
                  </button>
                ))}
              </nav>
            </div>
          )}

          {/* 배포 여부 탭 */}
          {products.length > 0 && (
            <div className="border-b border-gray-200">
              <nav className="flex space-x-4 overflow-x-auto px-3">
                {publishCounts.map((publish) => (
                  <button
                    key={publish.value}
                    onClick={() => setSelectedPublish(publish.value)}
                    className={`flex items-center space-x-1 py-2 px-2 border-b-2 font-medium text-xs whitespace-nowrap transition-colors ${
                      selectedPublish === publish.value
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span>
                      {publish.labelKey === 'all'
                        ? t('all')
                        : publish.labelKey === 'published'
                          ? t('published')
                          : t('unpublished')}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                      selectedPublish === publish.value
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {publish.count}
                    </span>
                  </button>
                ))}
              </nav>
            </div>
          )}
                      </div>
                    </div>

      {/* 결과 요약 및 뷰 전환 - 모바일 2줄 정리 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-gray-600">
        {/* 1줄: 총 N개 상품 + 필터 초기화 */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="min-w-0 truncate">
            {t('totalProducts', { count: filteredProducts.length })}
            {selectedCategory !== 'all' && ` (${categories.find(c => c.value === selectedCategory)?.label})`}
            {selectedSubCategory !== 'all' && ` (${subCategories.find(c => c.value === selectedSubCategory)?.label})`}
            {selectedStatus !== 'all' && (() => {
              const s = statusCounts.find(s => s.value === selectedStatus)
              return s ? ` (${s.labelKey === 'all' ? t('all') : t(`status.${s.labelKey}`)})` : ''
            })()}
            {selectedPublish !== 'all' &&
              ` (${selectedPublish === 'published' ? t('published') : t('unpublished')})`}
          </span>
          <div className="flex items-center gap-2 flex-shrink-0">
            {searchTerm && (
              <span className="hidden sm:inline">&ldquo;<strong>{searchTerm}</strong>&rdquo; {t('searchResults')}</span>
            )}
            {(searchTerm ||
              selectedCategory !== 'all' ||
              selectedSubCategory !== 'all' ||
              selectedStatus !== 'all' ||
              selectedPublish !== 'all') && (
              <button
                onClick={clearFilters}
                className="text-primary hover:text-primary/80 underline whitespace-nowrap"
              >
                {t('clearFilters')}
              </button>
            )}
          </div>
        </div>
        {/* 2줄: 카드/테이블 뷰 전환 */}
        <div className="flex items-center justify-end gap-2">
          <div className="flex items-center space-x-2 border border-gray-300 rounded-lg p-1">
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'card'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              title={t('cardView')}
            >
              <Grid3x3 size={18} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'table'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              title={t('tableView')}
            >
              <List size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* 상품 목록 */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <div className="text-gray-400 mb-4">
            <Search className="mx-auto h-12 w-12" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('noSearchResults')}</h3>
          <p className="text-gray-600 mb-4">
            {t('noSearchResultsHint')}
          </p>
          <button
            onClick={clearFilters}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90"
          >
            {t('clearFilters')}
          </button>
        </div>
      ) : viewMode === 'card' ? (
        <div className="gyg-listing admin-products-listing">
          <div className="admin-products-gyg-grid">
            {filteredProducts.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                locale={locale}
                displayLocale={cardPreviewLocale}
                priority={index === 0}
                canSoftDelete={canSoftDelete}
                onSoftDeleted={() => {
                  void fetchProducts()
                }}
                onRestored={() => {
                  void fetchProducts()
                }}
                onStatusChange={(productId, newStatus) => {
                  setProducts((prevProducts) =>
                    prevProducts.map((p) => (p.id === productId ? { ...p, status: newStatus } : p))
                  )
                }}
                onPublishChange={(productId, isPublished) => {
                  setProducts((prevProducts) =>
                    prevProducts.map((p) =>
                      p.id === productId ? { ...p, is_published: isPublished } : p
                    )
                  )
                }}
                onProductCopied={() => {
                  fetchProducts()
                }}
                onFavoriteToggle={(productId, isFavorite) => {
                  setProducts((prevProducts) =>
                    prevProducts.map((p) => (p.id === productId ? { ...p, is_favorite: isFavorite } : p))
                  )
                }}
                onRibbonToggle={(productId, tags) => {
                  setProducts((prevProducts) =>
                    prevProducts.map((p) => (p.id === productId ? { ...p, tags } : p))
                  )
                }}
                onProductUpdated={(productId, updates) => {
                  setProducts((prevProducts) =>
                    prevProducts.map((p) => (p.id === productId ? { ...p, ...updates } : p))
                  )
                }}
              />
            ))}
          </div>
        </div>
      ) : (
        /* 테이블 뷰 */
        <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10" style={{ width: '200px', maxWidth: '200px' }}>
                    {t('columns.name')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('columns.category')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '250px', width: '250px' }}>
                    {t('choice')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('basePrice')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '120px', width: '120px' }}>
                    {t('choicePrice')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '120px', width: '120px' }}>
                    Net Price
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('duration')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('maxParticipants')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('action')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.map((product) => {
                  const productStatus = (product as any).status || 'inactive'
                  const isPublished = product.is_published !== false
                  const isUpdating = updatingProducts.has(product.id)
                  const isCopying = copyingProducts.has(product.id)
                  
                  const isEditing = editingField?.productId === product.id
                  const isSaving = savingProducts.has(product.id)
                  
                  const isExpanded = expandedProducts.has(product.id)
                  const combinations = choiceCombinations[product.id]
                  const hasChoices = combinations && combinations.length > 0
                  
                  // Net Price가 있는지 확인
                  const hasNetPrice = (() => {
                    if (!homepageChannel) return false
                    const basePrice = product.base_price || 0
                    const commissionRate = (homepageChannel.commission_percent || 0) / 100
                    
                    if (!combinations || combinations.length === 0) {
                      const homepagePrice = (basePrice * 0.8) * (1 - commissionRate)
                      return homepagePrice > 0
                    }
                    
                    // 기본 조합으로 확인
                    const defaultCombo = combinations.find(c => c.isDefault) || combinations[0]
                    if (defaultCombo) {
                      const totalChoicePrice = defaultCombo.totalPrice || 0
                      const homepagePrice = (basePrice * 0.8 + totalChoicePrice) * (1 - commissionRate)
                      return homepagePrice > 0
                    }
                    
                    return false
                  })()
                  
                  return (
                    <tr 
                      key={product.id} 
                      className={`${hasNetPrice ? 'hover:bg-gray-50' : 'bg-yellow-50 hover:bg-yellow-100'} ${hasChoices ? 'cursor-pointer' : ''}`}
                      onClick={() => {
                        if (hasChoices) {
                          setExpandedProducts(prev => {
                            const next = new Set(prev)
                            if (next.has(product.id)) {
                              next.delete(product.id)
                            } else {
                              next.add(product.id)
                            }
                            return next
                          })
                        }
                      }}
                    >
                      <td 
                        className="px-4 py-4 sticky left-0 bg-white z-10" 
                        style={{ width: '200px', maxWidth: '200px' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isEditing && editingField?.fieldName === 'name' ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-ring focus:border-ring"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  saveEdit(product.id, 'name')
                                } else if (e.key === 'Escape') {
                                  cancelEdit()
                                }
                              }}
                            />
                            <div className="flex space-x-1">
                              <button
                                onClick={() => saveEdit(product.id, 'name')}
                                disabled={isSaving}
                                className="p-1 text-green-600 hover:text-green-900 disabled:opacity-50"
                                title={t('save')}
                              >
                                <Save size={14} />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="p-1 text-gray-600 hover:text-gray-900"
                                title={t('cancel')}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between group">
                            <div className="flex-1 min-w-0">
                              <Link 
                                href={buildAdminProductCustomerEditPath(locale, product.id)}
                                className="text-sm font-medium text-primary hover:text-primary/80 hover:underline block truncate"
                              >
                                {locale === 'en' ? (product.name_en || product.name) : product.name}
                              </Link>
                              {product.description && (
                                <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                                  {product.description}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => startEdit(product.id, 'name', locale === 'en' ? (product.name_en || product.name) : product.name)}
                              className="ml-2 p-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-primary transition-opacity"
                              title={t('editProductName')}
                            >
                              <Edit2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                      <td 
                        className="px-4 py-4 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isEditing && (editingField?.fieldName === 'category' || editingField?.fieldName === 'sub_category') ? (
                          <div className="space-y-2">
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">{t('columns.category')}</label>
                              <select
                                value={editingField?.fieldName === 'category' ? (editingValue as string) : (product.category || '')}
                                onChange={(e) => {
                                  if (editingField?.fieldName === 'category') {
                                    setEditingValue(e.target.value)
                                  } else {
                                    saveEdit(product.id, 'category', e.target.value)
                                  }
                                }}
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-ring focus:border-ring"
                                autoFocus={editingField?.fieldName === 'category'}
                              >
                                <option value="">{t('selectNone')}</option>
                                {getCategoryOptions().map(opt => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">{t('subCategory')}</label>
                              <select
                                value={editingField?.fieldName === 'sub_category' ? (editingValue as string) : (product.sub_category || '')}
                                onChange={(e) => {
                                  if (editingField?.fieldName === 'sub_category') {
                                    setEditingValue(e.target.value)
                                  } else {
                                    saveEdit(product.id, 'sub_category', e.target.value)
                                  }
                                }}
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-ring focus:border-ring"
                                autoFocus={editingField?.fieldName === 'sub_category'}
                                disabled={!product.category && editingField?.fieldName !== 'sub_category'}
                              >
                                <option value="">{t('selectNone')}</option>
                                {getSubCategoryOptions(product.category || editingValue as string).map((opt: { value: string; label: string }) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="flex space-x-1">
                              <button
                                onClick={() => {
                                  if (editingField?.fieldName === 'category') {
                                    saveEdit(product.id, 'category')
                                  } else {
                                    saveEdit(product.id, 'sub_category')
                                  }
                                }}
                                disabled={isSaving}
                                className="p-1 text-green-600 hover:text-green-900 disabled:opacity-50"
                                title={t('save')}
                              >
                                <Save size={14} />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="p-1 text-gray-600 hover:text-gray-900"
                                title={t('cancel')}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between group">
                            {(product.category || product.sub_category) ? (
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getCategoryColor(product.category || '').bg} ${getCategoryColor(product.category || '').text} ${getCategoryColor(product.category || '').border}`}>
                                {getCombinedCategoryLabel(product.category, product.sub_category)}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                            <button
                              onClick={() => startEdit(product.id, 'category', product.category || '')}
                              className="ml-2 p-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-primary transition-opacity"
                              title={t('editCategory')}
                            >
                              <Edit2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                      {/* 초이스 컬럼 */}
                      <td 
                        className="px-4 py-2" 
                        style={{ minWidth: '250px', width: '250px' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (hasChoices) {
                            setExpandedProducts(prev => {
                              const next = new Set(prev)
                              if (next.has(product.id)) {
                                next.delete(product.id)
                              } else {
                                next.add(product.id)
                              }
                              return next
                            })
                          }
                        }}
                      >
                        {(() => {
                          if (!combinations || combinations.length === 0) {
                            return <span className="text-sm text-gray-400">-</span>
                          }
                          
                          // 기본 조합 찾기
                          const defaultCombo = combinations.find(c => c.isDefault)
                          const displayCombinations = isExpanded ? combinations : (defaultCombo ? [defaultCombo] : [combinations[0]])
                          
                          return (
                            <div className={`space-y-1 ${hasChoices ? 'cursor-pointer' : ''}`}>
                              {displayCombinations.map((combo) => (
                                <div key={combo.id} className="text-xs flex items-center gap-1">
                                  {!isExpanded && displayCombinations.length === 1 && (
                                    <ChevronRight size={12} className="text-gray-400 flex-shrink-0" />
                                  )}
                                  {isExpanded && (
                                    <ChevronDown size={12} className="text-gray-400 flex-shrink-0" />
                                  )}
                                  <span className="text-gray-600 font-medium">
                                    {locale === 'en' ? combo.combinationName : combo.combinationNameKo}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )
                        })()}
                      </td>
                      {/* 기본 가격 컬럼 */}
                      <td 
                        className="px-4 py-4 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isEditing && editingField?.fieldName === 'base_price' ? (
                          <div className="space-y-2">
                            <div className="flex items-center">
                              <span className="text-xs text-gray-500 mr-1">$</span>
                              <input
                                type="number"
                                step="0.01"
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value === '' ? '' : Number(e.target.value))}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-ring focus:border-ring"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    saveEdit(product.id, 'base_price')
                                  } else if (e.key === 'Escape') {
                                    cancelEdit()
                                  }
                                }}
                              />
                            </div>
                            <div className="flex space-x-1">
                              <button
                                onClick={() => saveEdit(product.id, 'base_price')}
                                disabled={isSaving}
                                className="p-1 text-green-600 hover:text-green-900 disabled:opacity-50"
                                title={t('save')}
                              >
                                <Save size={14} />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="p-1 text-gray-600 hover:text-gray-900"
                                title={t('cancel')}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between group">
                            <span className="text-sm font-medium text-green-600">
                              ${product.base_price || 0}
                            </span>
                            <button
                              onClick={() => startEdit(product.id, 'base_price', product.base_price || 0)}
                              className="ml-2 p-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-primary transition-opacity"
                              title={t('editPrice')}
                            >
                              <Edit2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                      {/* 초이스 가격 컬럼 */}
                      <td 
                        className="px-4 py-2" 
                        style={{ minWidth: '120px', width: '120px' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {(() => {
                          if (!combinations || combinations.length === 0) {
                            return <span className="text-sm text-gray-400">-</span>
                          }
                          
                          // 기본 조합 찾기
                          const defaultCombo = combinations.find(c => c.isDefault)
                          const displayCombinations = isExpanded ? combinations : (defaultCombo ? [defaultCombo] : [combinations[0]])
                          
                          return (
                            <div className="space-y-1">
                              {displayCombinations.map((combo) => (
                                <div key={combo.id} className="text-xs">
                                  <span className="text-primary font-semibold">
                                    ${combo.totalPrice > 0 ? combo.totalPrice.toFixed(2) : '0.00'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )
                        })()}
                      </td>
                      {/* Net Price 컬럼 */}
                      <td 
                        className="px-4 py-2" 
                        style={{ minWidth: '120px', width: '120px' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {(() => {
                          if (!homepageChannel) {
                            return <span className="text-sm text-gray-400">-</span>
                          }
                          
                          const basePrice = product.base_price || 0
                          const commissionRate = (homepageChannel.commission_percent || 0) / 100
                          
                          // 각 조합별로 Net Price 계산
                          if (!combinations || combinations.length === 0) {
                            // 초이스가 없으면 기본 가격만으로 계산
                            const homepagePrice = (basePrice * 0.8) * (1 - commissionRate)
                            if (homepagePrice <= 0) {
                              return <span className="text-sm text-gray-400">-</span>
                            }
                            return (
                              <span className="text-sm font-semibold text-purple-600">
                                ${homepagePrice.toFixed(2)}
                              </span>
                            )
                          }
                          
                          // 기본 조합 찾기
                          const defaultCombo = combinations.find(c => c.isDefault)
                          const displayCombinations = isExpanded ? combinations : (defaultCombo ? [defaultCombo] : [combinations[0]])
                          
                          return (
                            <div className="space-y-1">
                              {displayCombinations.map((combo) => {
                                const totalChoicePrice = combo.totalPrice || 0
                                // 홈페이지 Net Price = (기본 가격 * 0.8 + 초이스 가격 합계) * (1 - 수수료율)
                                const homepagePrice = (basePrice * 0.8 + totalChoicePrice) * (1 - commissionRate)
                                
                                if (homepagePrice <= 0) {
                                  return (
                                    <div key={combo.id} className="text-xs">
                                      <span className="text-gray-400">-</span>
                                    </div>
                                  )
                                }
                                
                                return (
                                  <div key={combo.id} className="text-xs">
                                    <span className="text-purple-600 font-semibold">
                                      ${homepagePrice.toFixed(2)}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })()}
                      </td>
                      <td 
                        className="px-4 py-4 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isEditing && editingField?.fieldName === 'duration' ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-ring focus:border-ring"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  saveEdit(product.id, 'duration')
                                } else if (e.key === 'Escape') {
                                  cancelEdit()
                                }
                              }}
                            />
                            <div className="flex space-x-1">
                              <button
                                onClick={() => saveEdit(product.id, 'duration')}
                                disabled={isSaving}
                                className="p-1 text-green-600 hover:text-green-900 disabled:opacity-50"
                                title={t('save')}
                              >
                                <Save size={14} />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="p-1 text-gray-600 hover:text-gray-900"
                                title={t('cancel')}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between group">
                            <span className="text-sm text-gray-600">
                              {product.duration || '-'}
                            </span>
                            <button
                              onClick={() => startEdit(product.id, 'duration', product.duration || '')}
                              className="ml-2 p-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-primary transition-opacity"
                              title={t('editDuration')}
                            >
                              <Edit2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                      <td 
                        className="px-4 py-4 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isEditing && editingField?.fieldName === 'max_participants' ? (
                          <div className="space-y-2">
                            <div className="flex items-center">
                              <input
                                type="number"
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value === '' ? '' : Number(e.target.value))}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-ring focus:border-ring"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    saveEdit(product.id, 'max_participants')
                                  } else if (e.key === 'Escape') {
                                    cancelEdit()
                                  }
                                }}
                              />
                              <span className="text-xs text-gray-500 ml-1">{t('peopleUnit')}</span>
                            </div>
                            <div className="flex space-x-1">
                              <button
                                onClick={() => saveEdit(product.id, 'max_participants')}
                                disabled={isSaving}
                                className="p-1 text-green-600 hover:text-green-900 disabled:opacity-50"
                                title={t('save')}
                              >
                                <Save size={14} />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="p-1 text-gray-600 hover:text-gray-900"
                                title={t('cancel')}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between group">
                            <span className="text-sm text-gray-600">
                              {product.max_participants ?? '-'}{product.max_participants != null ? t('peopleUnit') : ''}
                            </span>
                            <button
                              onClick={() => startEdit(product.id, 'max_participants', product.max_participants || 0)}
                              className="ml-2 p-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-primary transition-opacity"
                              title={t('editMaxParticipants')}
                            >
                              <Edit2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                      <td 
                        className="px-4 py-4 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center space-x-2">
                          {/* 복사 버튼 */}
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleCopyProduct(product)
                            }}
                            disabled={isCopying}
                            className={`p-1.5 rounded transition-colors ${
                              isCopying 
                                ? 'text-gray-400 cursor-not-allowed' 
                                : 'text-green-600 hover:text-green-800 hover:bg-green-50'
                            }`}
                            title={t('copyProduct')}
                          >
                            <Copy className="h-4 w-4" />
                          </button>

                          {canSoftDelete ? (
                            isAdminProductSoftDeleted(productStatus) ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  void handleRestoreProduct(product)
                                }}
                                disabled={isUpdating}
                                className={`p-1.5 rounded transition-colors ${
                                  isUpdating
                                    ? 'text-gray-400 cursor-not-allowed'
                                    : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                                }`}
                                title={t('edit.restore')}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  void handleSoftDeleteProduct(product)
                                }}
                                disabled={isUpdating}
                                className={`p-1.5 rounded transition-colors ${
                                  isUpdating
                                    ? 'text-gray-400 cursor-not-allowed'
                                    : 'text-red-600 hover:text-red-800 hover:bg-red-50'
                                }`}
                                title={t('edit.delete')}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )
                          ) : null}
                          
                          {/* 활성화 토글 */}
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleStatusToggle(product.id, productStatus)
                            }}
                            disabled={isUpdating || isAdminProductSoftDeleted(productStatus)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                              productStatus === 'active' ? 'bg-blue-600' : 'bg-gray-200'
                            } ${isUpdating || isAdminProductSoftDeleted(productStatus) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            title={productStatus === 'active' ? t('deactivate') : t('activate')}
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                productStatus === 'active' ? 'translate-x-5' : 'translate-x-1'
                              }`}
                            />
                          </button>

                          {/* 고객 사이트 배포 토글 */}
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handlePublishToggle(product.id, isPublished)
                            }}
                            disabled={isUpdating}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                              isPublished ? 'bg-emerald-600' : 'bg-gray-200'
                            } ${isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            title={isPublished ? t('unpublish') : t('publish')}
                            aria-label={t('publishToggle')}
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                isPublished ? 'translate-x-5' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ProductLocaleReadinessModal
        isOpen={isLocaleReadinessModalOpen}
        onClose={() => setIsLocaleReadinessModalOpen(false)}
        products={filteredProducts}
        homepageChannelId={homepageChannel?.id ?? null}
        locale={locale}
      />

      {/* 즐겨찾기 순서 조정 모달 */}
      <FavoriteOrderModal
        isOpen={isFavoriteOrderModalOpen}
        onClose={() => setIsFavoriteOrderModalOpen(false)}
        onUpdate={() => {
          fetchProducts() // 상품 목록 새로고침
        }}
        locale={locale}
      />
    </div>
  )
}
