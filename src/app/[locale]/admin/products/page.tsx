'use client'

import React, { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Search, Grid3x3, List, Copy, Save, X, Edit2, ChevronDown, ChevronRight, ChevronUp, Star } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import ProductCard from '@/components/ProductCard'
import FavoriteOrderModal from '@/components/admin/FavoriteOrderModal'

type Product = Database['public']['Tables']['products']['Row']

interface AdminProductsProps {
  params: Promise<{ locale: string }>
}

export default function AdminProducts({ params }: AdminProductsProps) {
  const paramsObj = useParams()
  const locale = paramsObj.locale as string
  const t = useTranslations('products')
  const tCommon = useTranslations('common')
  
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('active')
  const [categories, setCategories] = useState<{ value: string; label: string; count: number }[]>([])
  const [subCategories, setSubCategories] = useState<{ value: string; label: string; count: number }[]>([])
  const [allSubCategories, setAllSubCategories] = useState<{ value: string; label: string; count: number }[]>([])
  const [statusCounts, setStatusCounts] = useState<{ value: string; label: string; count: number }[]>([])
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card')
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
  const [allCardsCollapsed, setAllCardsCollapsed] = useState(false)
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
  const [isFavoriteOrderModalOpen, setIsFavoriteOrderModalOpen] = useState(false)

  // Supabase에서 상품 데이터 가져오기
  useEffect(() => {
    fetchProducts()
    fetchHomepageChannel()
  }, [])

  // 홈페이지 채널 정보 가져오기
  const fetchHomepageChannel = async () => {
    try {
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .or('id.eq.M00001,name.ilike.%홈페이지%,name.ilike.%homepage%')
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('홈페이지 채널 조회 오류:', error)
      } else if (data) {
        setHomepageChannel(data)
      }
    } catch (error) {
      console.error('홈페이지 채널 조회 중 예상치 못한 오류:', error)
    }
  }

  // 모든 초이스 조합 생성 함수
  const generateCombinations = (groups: Array<Array<any>>): Array<Array<any>> => {
    if (groups.length === 0) return [[]]
    if (groups.length === 1) return groups[0].map(item => [item])
    
    const [firstGroup, ...restGroups] = groups
    const restCombinations = generateCombinations(restGroups)
    
    const combinations: Array<Array<any>> = []
    firstGroup.forEach(item => {
      restCombinations.forEach(restCombo => {
        combinations.push([item, ...restCombo])
      })
    })
    
    return combinations
  }

  // 상품별 초이스 조합 정보 가져오기
  const fetchChoicePrices = async (productIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from('product_choices')
        .select(`
          product_id,
          choice_group,
          choice_group_ko,
          sort_order,
          options:choice_options (
            id,
            option_name,
            option_name_ko,
            adult_price,
            child_price,
            infant_price,
            sort_order,
            is_default
          )
        `)
        .in('product_id', productIds)
        .order('sort_order', { ascending: true })

      if (error) {
        console.error('초이스 가격 조회 오류:', error)
        return
      }

      const combinationsMap: { 
        [productId: string]: Array<{
          id: string
          combinationName: string
          combinationNameKo: string
          totalPrice: number
          choices: Array<{
            id: string
            name: string
            name_ko: string
            adult_price: number
            child_price: number
            infant_price: number
          }>
        }>
      } = {}
      
      if (data) {
        // 상품별로 그룹화
        const productGroups: { [productId: string]: any[] } = {}
        data.forEach((choice: any) => {
          const productId = choice.product_id
          if (!productGroups[productId]) {
            productGroups[productId] = []
          }
          
          if (choice.options && Array.isArray(choice.options) && choice.options.length > 0) {
            // 각 옵션을 정렬
            const sortedOptions = [...choice.options].sort((a, b) => {
              const sortA = a.sort_order || 0
              const sortB = b.sort_order || 0
              if (sortA !== sortB) return sortA - sortB
              return (a.option_name_ko || a.option_name || '').localeCompare(b.option_name_ko || b.option_name || '', 'ko')
            })
            
            productGroups[productId].push({
              groupName: choice.choice_group_ko || choice.choice_group || '',
              options: sortedOptions.map((option: any) => ({
                id: option.id,
                name: option.option_name || '',
                name_ko: option.option_name_ko || option.option_name || '',
                adult_price: parseFloat(option.adult_price) || 0,
                child_price: parseFloat(option.child_price) || 0,
                infant_price: parseFloat(option.infant_price) || 0,
                is_default: option.is_default || false
              }))
            })
          }
        })
        
        // 각 상품별로 모든 조합 생성
        Object.keys(productGroups).forEach(productId => {
          const groups = productGroups[productId]
          if (groups.length === 0) {
            combinationsMap[productId] = []
            return
          }
          
          // 각 그룹의 옵션 배열 추출
          const optionArrays = groups.map(group => group.options)
          
          // 모든 조합 생성
          const allCombinations = generateCombinations(optionArrays)
          
          // 각 그룹에서 기본 옵션 찾기
          const defaultOptions = groups.map(group => {
            return group.options.find(opt => opt.is_default === true) || group.options[0]
          })
          
          // 조합을 표시용 데이터로 변환
          combinationsMap[productId] = allCombinations.map((combo, index) => {
            const combinationNameKo = combo.map((option, idx) => {
              const groupName = groups[idx]?.groupName || ''
              return `${option.name_ko || option.name}`
            }).join(' - ')
            
            const combinationName = combo.map(option => option.name || option.name_ko).join(' - ')
            
            const totalPrice = combo.reduce((sum, option) => sum + option.adult_price, 0)
            
            // 기본 조합인지 확인 (각 그룹의 기본 옵션과 일치하는지)
            const isDefault = combo.every((option, idx) => {
              const defaultOpt = defaultOptions[idx]
              return defaultOpt && option.id === defaultOpt.id
            })
            
            return {
              id: `combo-${productId}-${index}`,
              combinationName,
              combinationNameKo,
              totalPrice,
              isDefault,
              choices: combo
            }
          })
        })
        
        setChoiceCombinations(combinationsMap)
      }
    } catch (error) {
      console.error('초이스 가격 조회 중 예상치 못한 오류:', error)
    }
  }

  const fetchProducts = async () => {
    try {
      setLoading(true)
      
      console.log('Products 데이터 조회 시작...')
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true })

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
        return
      }

      console.log('Products 데이터 조회 성공:', data?.length || 0, '개')
      
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
              .maybeSingle()
            
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
      
      setProducts(productsWithImages)
      
      // 초이스 가격 정보 가져오기
      if (data && data.length > 0) {
        const productIds = data.map(p => p.id)
        await fetchChoicePrices(productIds)
      }
      
      // 카테고리별 상품 수 계산
      if (data && data.length > 0) {
        const categoryCounts: { [key: string]: number } = {}
        const subCategoryCounts: { [key: string]: number } = {}
        const statusCounts: { [key: string]: number } = {}
        
        data.forEach(product => {
          if ((product as any).category) {
            categoryCounts[(product as any).category] = (categoryCounts[(product as any).category] || 0) + 1
          }
          if ((product as any).sub_category) {
            subCategoryCounts[(product as any).sub_category] = (subCategoryCounts[(product as any).sub_category] || 0) + 1
          }
          if ((product as any).status) {
            statusCounts[(product as any).status] = (statusCounts[(product as any).status] || 0) + 1
          }
        })
        
        // 카테고리 목록 생성 (전체 + 실제 존재하는 카테고리들)
        const categoryList = [
          { value: 'all', label: tCommon('all'), count: data.length }
        ]
        
        // 실제 존재하는 카테고리들을 상품 수 순으로 정렬하여 추가
        Object.entries(categoryCounts)
          .sort(([,a], [,b]) => b - a) // 상품 수 내림차순 정렬
          .forEach(([category, count]) => {
            categoryList.push({ value: category, label: category, count })
          })
        
        // 서브카테고리 목록 생성 (전체 + 실제 존재하는 서브카테고리들)
        const subCategoryList = [
          { value: 'all', label: tCommon('all'), count: data.length }
        ]
        
        // 실제 존재하는 서브카테고리들을 상품 수 순으로 정렬하여 추가
        Object.entries(subCategoryCounts)
          .sort(([,a], [,b]) => b - a) // 상품 수 내림차순 정렬
          .forEach(([subCategory, count]) => {
            subCategoryList.push({ value: subCategory, label: subCategory, count })
          })
        
        // 상태 목록 생성 (전체 + 실제 존재하는 상태들)
        const statusList = [
          { value: 'all', label: '전체', count: data.length }
        ]
        
        // 실제 존재하는 상태들을 상품 수 순으로 정렬하여 추가
        Object.entries(statusCounts)
          .sort(([,a], [,b]) => b - a) // 상품 수 내림차순 정렬
          .forEach(([status, count]) => {
            const statusLabel = status === 'active' ? '활성' : 
                              status === 'inactive' ? '비활성' : 
                              status === 'draft' ? '초안' : status
            statusList.push({ value: status, label: statusLabel, count })
          })
        
        setCategories(categoryList)
        setAllSubCategories(subCategoryList)
        setSubCategories(subCategoryList)
        setStatusCounts(statusList)
      }
    } catch (error) {
      console.error('Products 조회 중 예상치 못한 오류:', error)
      setProducts([])
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
    const matchesStatus = selectedStatus === 'all' || (product as any).status === selectedStatus
    
    return matchesSearch && matchesCategory && matchesSubCategory && matchesStatus
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
    setSubCategories(allSubCategories) // 서브카테고리를 전체 목록으로 복원
  }

  // 상태 레이블 및 색상 헬퍼 함수
  const getStatusLabel = (status: string) => {
    const statusLabels: { [key: string]: string } = {
      active: '활성',
      inactive: '비활성',
      draft: '초안'
    }
    return statusLabels[status] || status
  }

  const getStatusColor = (status: string) => {
    const statusColors: { [key: string]: string } = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      draft: 'bg-yellow-100 text-yellow-800'
    }
    return statusColors[status] || 'bg-gray-100 text-gray-800'
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
      tour: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
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
  const getSubCategoryOptions = (category?: string | null) => {
    if (!category) {
      return allSubCategories.filter(c => c.value !== 'all').map(c => ({
        value: c.value,
        label: getSubCategoryLabel(c.value)
      }))
    }
    
    const filtered = products
      .filter(p => p.category === category && p.sub_category)
      .reduce((acc, p) => {
        const subCat = p.sub_category!
        if (!acc.find(item => item.value === subCat)) {
          acc.push({
            value: subCat,
            label: getSubCategoryLabel(subCat)
          })
        }
        return acc
      }, [] as { value: string; label: string }[])
    
    return filtered
  }

  // 상품 복사 핸들러
  const handleCopyProduct = async (product: Product) => {
    if (copyingProducts.has(product.id)) return
    
    try {
      setCopyingProducts(prev => new Set(prev).add(product.id))
      
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
        status: 'draft' as const,
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
      
      alert(`상품이 성공적으로 복사되었습니다! 새 상품 ID: ${newProduct?.id}`)
      
      // 목록 새로고침
      fetchProducts()
      
      // 새 상품 편집 페이지로 이동
      window.location.href = `/${locale}/admin/products/${newProduct?.id}`
      
    } catch (error) {
      console.error('상품 복사 중 예상치 못한 오류:', error)
      alert('상품 복사 중 오류가 발생했습니다.')
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
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <div className="text-gray-500">{tCommon('loading')}</div>
        </div>
      </div>
    )
  }

  // 오류 상태 표시 (products가 빈 배열이고 로딩이 완료된 경우)
  if (products.length === 0 && !loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <Link
            href={`/${locale}/admin/products/new`}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            {t('addProduct')}
          </Link>
        </div>
        
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">상품이 없습니다</h3>
          <p className="text-gray-600 mb-4">
            아직 등록된 상품이 없거나 데이터베이스 연결에 문제가 있을 수 있습니다.
          </p>
          <div className="space-y-2">
            <button
              onClick={fetchProducts}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              다시 시도
            </button>
            <div className="text-xs text-gray-500">
              또는 새 상품을 추가해보세요
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">상품 관리</h1>
          <p className="mt-2 text-gray-600">
            투어 상품을 추가, 편집, 삭제할 수 있습니다
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsFavoriteOrderModalOpen(true)}
            className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 flex items-center space-x-2"
          >
            <Star size={20} />
            <span>즐겨찾기 순서 조정</span>
          </button>
          <Link
            href={`/${locale}/admin/products/new`}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
          >
            <Plus size={20} />
            <span>새 상품 추가</span>
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
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <span>{category.label}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                        selectedCategory === category.value
                          ? 'bg-blue-100 text-blue-600'
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
                    placeholder="상품명, 카테고리, 서브카테고리, 설명으로 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-56 pl-7 pr-3 py-1.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span>{subCategory.label}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                      selectedSubCategory === subCategory.value
                        ? 'bg-blue-100 text-blue-600'
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
                    <span>{status.label}</span>
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
                      </div>
                    </div>

      {/* 결과 요약 및 뷰 전환 */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          총 {filteredProducts.length}개의 상품
          {selectedCategory !== 'all' && ` (${categories.find(c => c.value === selectedCategory)?.label})`}
          {selectedSubCategory !== 'all' && ` (${subCategories.find(c => c.value === selectedSubCategory)?.label})`}
          {selectedStatus !== 'all' && ` (${statusCounts.find(s => s.value === selectedStatus)?.label})`}
        </span>
        <div className="flex items-center space-x-4">
          {searchTerm && (
            <span>&ldquo;<strong>{searchTerm}</strong>&rdquo; 검색 결과</span>
          )}
          {(searchTerm || selectedCategory !== 'all' || selectedSubCategory !== 'all' || selectedStatus !== 'all') && (
            <button
              onClick={clearFilters}
              className="text-blue-600 hover:text-blue-800 underline"
            >
              필터 초기화
            </button>
          )}
          {/* 뷰 전환 버튼 */}
          <div className="flex items-center space-x-2">
            {viewMode === 'card' && (
              <button
                onClick={() => setAllCardsCollapsed(!allCardsCollapsed)}
                className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center space-x-2"
              >
                {allCardsCollapsed ? (
                  <>
                    <ChevronDown size={16} />
                    <span>상세보기</span>
                  </>
                ) : (
                  <>
                    <ChevronUp size={16} />
                    <span>접어보기</span>
                  </>
                )}
              </button>
            )}
            <div className="flex items-center space-x-2 border border-gray-300 rounded-lg p-1">
              <button
                onClick={() => setViewMode('card')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'card'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="카드뷰"
              >
                <Grid3x3 size={18} />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'table'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="테이블뷰"
              >
                <List size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 상품 목록 */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <div className="text-gray-400 mb-4">
            <Search className="mx-auto h-12 w-12" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">검색 결과가 없습니다</h3>
          <p className="text-gray-600 mb-4">
            검색어나 카테고리를 변경해보세요.
          </p>
          <button
            onClick={clearFilters}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            필터 초기화
          </button>
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(360px, 100%), 1fr))' }}>
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              locale={locale}
              collapsed={allCardsCollapsed}
              onStatusChange={(productId, newStatus) => {
                // 로컬 상태 업데이트
                setProducts(prevProducts => 
                  prevProducts.map(p => 
                    p.id === productId ? { ...p, status: newStatus } : p
                  )
                )
              }}
              onProductCopied={() => {
                // 상품 복사 후 목록 새로고침
                fetchProducts()
              }}
              onFavoriteToggle={(productId, isFavorite) => {
                // 로컬 상태 업데이트
                setProducts(prevProducts => 
                  prevProducts.map(p => 
                    p.id === productId ? { ...p, is_favorite: isFavorite } : p
                  )
                )
              }}
            />
          ))}
        </div>
      ) : (
        /* 테이블 뷰 */
        <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10" style={{ width: '200px', maxWidth: '200px' }}>
                    상품명
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    카테고리
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    기본 가격
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '250px', width: '250px' }}>
                    초이스
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '120px', width: '120px' }}>
                    초이스 가격
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '120px', width: '120px' }}>
                    Net Price
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    기간
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    최대 참가자
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    액션
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.map((product) => {
                  const productStatus = (product as any).status || 'inactive'
                  const isUpdating = updatingProducts.has(product.id)
                  const isCopying = copyingProducts.has(product.id)
                  
                  const isEditing = editingField?.productId === product.id
                  const isSaving = savingProducts.has(product.id)
                  
                  const isExpanded = expandedProducts.has(product.id)
                  const combinations = choiceCombinations[product.id]
                  const hasChoices = combinations && combinations.length > 0
                  
                  return (
                    <tr 
                      key={product.id} 
                      className={`hover:bg-gray-50 ${hasChoices ? 'cursor-pointer' : ''}`}
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
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                                title="저장"
                              >
                                <Save size={14} />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="p-1 text-gray-600 hover:text-gray-900"
                                title="취소"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between group">
                            <div className="flex-1 min-w-0">
                              <Link 
                                href={`/${locale}/admin/products/${product.id}`}
                                className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline block truncate"
                              >
                                {product.name}
                              </Link>
                              {product.description && (
                                <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                                  {product.description}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => startEdit(product.id, 'name', product.name)}
                              className="ml-2 p-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 transition-opacity"
                              title="상품명 수정"
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
                              <label className="block text-xs text-gray-600 mb-1">카테고리</label>
                              <select
                                value={editingField?.fieldName === 'category' ? (editingValue as string) : (product.category || '')}
                                onChange={(e) => {
                                  if (editingField?.fieldName === 'category') {
                                    setEditingValue(e.target.value)
                                  } else {
                                    saveEdit(product.id, 'category', e.target.value)
                                  }
                                }}
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                autoFocus={editingField?.fieldName === 'category'}
                              >
                                <option value="">선택 안함</option>
                                {getCategoryOptions().map(opt => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">서브카테고리</label>
                              <select
                                value={editingField?.fieldName === 'sub_category' ? (editingValue as string) : (product.sub_category || '')}
                                onChange={(e) => {
                                  if (editingField?.fieldName === 'sub_category') {
                                    setEditingValue(e.target.value)
                                  } else {
                                    saveEdit(product.id, 'sub_category', e.target.value)
                                  }
                                }}
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                autoFocus={editingField?.fieldName === 'sub_category'}
                                disabled={!product.category && editingField?.fieldName !== 'sub_category'}
                              >
                                <option value="">선택 안함</option>
                                {getSubCategoryOptions(product.category || editingValue as string).map(opt => (
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
                                title="저장"
                              >
                                <Save size={14} />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="p-1 text-gray-600 hover:text-gray-900"
                                title="취소"
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
                              className="ml-2 p-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 transition-opacity"
                              title="카테고리/서브카테고리 수정"
                            >
                              <Edit2 size={14} />
                            </button>
                          </div>
                        )}
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
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                                title="저장"
                              >
                                <Save size={14} />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="p-1 text-gray-600 hover:text-gray-900"
                                title="취소"
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
                              className="ml-2 p-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 transition-opacity"
                              title="가격 수정"
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
                                <div key={combo.id} className="text-xs flex items-center gap-1">
                                  {!isExpanded && displayCombinations.length === 1 && (
                                    <ChevronRight size={12} className="text-gray-400 flex-shrink-0" />
                                  )}
                                  {isExpanded && (
                                    <ChevronDown size={12} className="text-gray-400 flex-shrink-0" />
                                  )}
                                  <span className="text-gray-600 font-medium">
                                    {combo.combinationNameKo}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )
                        })()}
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
                                  <span className="text-blue-600 font-semibold">
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
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                                title="저장"
                              >
                                <Save size={14} />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="p-1 text-gray-600 hover:text-gray-900"
                                title="취소"
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
                              className="ml-2 p-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 transition-opacity"
                              title="기간 수정"
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
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    saveEdit(product.id, 'max_participants')
                                  } else if (e.key === 'Escape') {
                                    cancelEdit()
                                  }
                                }}
                              />
                              <span className="text-xs text-gray-500 ml-1">명</span>
                            </div>
                            <div className="flex space-x-1">
                              <button
                                onClick={() => saveEdit(product.id, 'max_participants')}
                                disabled={isSaving}
                                className="p-1 text-green-600 hover:text-green-900 disabled:opacity-50"
                                title="저장"
                              >
                                <Save size={14} />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="p-1 text-gray-600 hover:text-gray-900"
                                title="취소"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between group">
                            <span className="text-sm text-gray-600">
                              {product.max_participants || '-'}명
                            </span>
                            <button
                              onClick={() => startEdit(product.id, 'max_participants', product.max_participants || 0)}
                              className="ml-2 p-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 transition-opacity"
                              title="최대 참가자 수정"
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
                            title="상품 복사"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          
                          {/* 상태 토글 스위치 */}
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleStatusToggle(product.id, productStatus)
                            }}
                            disabled={isUpdating}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                              productStatus === 'active' ? 'bg-blue-600' : 'bg-gray-200'
                            } ${isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            title={productStatus === 'active' ? '비활성화' : '활성화'}
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                productStatus === 'active' ? 'translate-x-5' : 'translate-x-1'
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
