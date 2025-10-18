'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Info, Save, Settings } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import CategoryManagementModal from './CategoryManagementModal'

interface CategoryItem {
  value: string
  label: string
  count: number
  id?: string
}

interface SubCategoryItem {
  value: string
  label: string
  count: number
  id?: string
  categoryId?: string
  categoryName?: string
}

  interface BasicInfoTabProps {
    formData: {
      name: string
      nameEn?: string
      productCode: string
      category: string
      subCategory: string
      description: string
      duration: number
      maxParticipants: number
      departureCity: string
      arrivalCity: string
      departureCountry: string
      arrivalCountry: string
      languages: string[]
      groupSize: string[]
      adultAge: number
      childAgeMin: number
      childAgeMax: number
      infantAge: number
      status: 'active' | 'inactive' | 'draft'
      tourDepartureTime?: string
      tourDepartureTimes?: string[]
      customerNameKo?: string
      customerNameEn?: string
      tags?: string[]
    }
  setFormData: <T>(updater: React.SetStateAction<T>) => void
  productId: string
  isNewProduct: boolean
}

export default function BasicInfoTab({
  formData,
  setFormData,
  productId,
  isNewProduct
}: BasicInfoTabProps) {
  const t = useTranslations('common')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [subCategories, setSubCategories] = useState<SubCategoryItem[]>([])
  const [allSubCategories, setAllSubCategories] = useState<SubCategoryItem[]>([])
  const [newDepartureTime, setNewDepartureTime] = useState('')
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [newTag, setNewTag] = useState('')

  // 디버깅을 위한 로그
  console.log('BasicInfoTab - formData.tourDepartureTimes:', formData.tourDepartureTimes);
  console.log('BasicInfoTab - tourDepartureTimes 타입:', typeof formData.tourDepartureTimes);
  console.log('BasicInfoTab - tourDepartureTimes 배열 여부:', Array.isArray(formData.tourDepartureTimes));

  // 출발 시간 관리 함수들
  const addDepartureTime = () => {
    if (newDepartureTime && !formData.tourDepartureTimes?.includes(newDepartureTime)) {
      setFormData({
        ...formData,
        tourDepartureTimes: [...(formData.tourDepartureTimes || []), newDepartureTime]
      })
      setNewDepartureTime('')
    }
  }

  const removeDepartureTime = (index: number) => {
    setFormData({
      ...formData,
      tourDepartureTimes: formData.tourDepartureTimes?.filter((_, i) => i !== index) || []
    })
  }

  // 태그 관련 핸들러 함수들
  const addTag = () => {
    if (newTag.trim() && !formData.tags?.includes(newTag.trim())) {
      setFormData({
        ...formData,
        tags: [...(formData.tags || []), newTag.trim()]
      })
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: (formData.tags || []).filter(tag => tag !== tagToRemove)
    })
  }

  // 카테고리 관리 모달 업데이트 핸들러
  const handleCategoriesUpdate = (updatedCategories: CategoryItem[], updatedSubCategories: SubCategoryItem[]) => {
    setCategories(updatedCategories)
    setAllSubCategories(updatedSubCategories)
    
    // 현재 선택된 카테고리에 해당하는 서브카테고리만 필터링
    if (formData.category) {
      const selectedCategory = updatedCategories.find(cat => cat.value === formData.category)
      const filteredSubCategories = updatedSubCategories.filter(sub => sub.categoryId === selectedCategory?.id)
      setSubCategories(filteredSubCategories)
      
      // 현재 선택된 서브카테고리가 필터링된 목록에 없으면 초기화
      if (formData.subCategory && !filteredSubCategories.some(sub => sub.value === formData.subCategory)) {
        setFormData({ ...formData, subCategory: '' })
      }
    } else {
      setSubCategories([])
      // 카테고리가 선택되지 않았으면 서브카테고리도 초기화
      if (formData.subCategory) {
        setFormData({ ...formData, subCategory: '' })
      }
    }
  }

  // 기본 정보 저장 함수
  const handleSave = async () => {
    setSaving(true)
    setSaveMessage('')

    try {
      // 필수 필드 검증
      if (!formData.name.trim()) {
        setSaveMessage('상품명을 입력해주세요.')
        return
      }
      if (!formData.category) {
        setSaveMessage('카테고리를 선택해주세요.')
        return
      }
      if (!formData.subCategory) {
        setSaveMessage('하위 카테고리를 선택해주세요.')
        return
      }
      if (formData.duration <= 0) {
        setSaveMessage('소요시간을 입력해주세요.')
        return
      }
      if (formData.maxParticipants <= 0) {
        setSaveMessage('최대 참가자 수를 입력해주세요.')
        return
      }

      if (isNewProduct) {
        // 새 상품 생성
        const { data, error } = await supabase
          .from('products')
          .insert([{
            name: formData.name.trim(),
            name_en: formData.nameEn?.trim() || null,
            product_code: formData.productCode.trim(),
            category: formData.category,
            sub_category: formData.subCategory.trim(),
            description: formData.description.trim(),
            duration: formData.duration.toString(),
            base_price: 0, // 기본값
            max_participants: formData.maxParticipants,
            status: formData.status,
            departure_city: formData.departureCity.trim(),
            arrival_city: formData.arrivalCity.trim(),
            departure_country: formData.departureCountry,
            arrival_country: formData.arrivalCountry,
            languages: formData.languages,
            group_size: formData.groupSize.join(','),
            adult_age: formData.adultAge,
            child_age_min: formData.childAgeMin,
            child_age_max: formData.childAgeMax,
            infant_age: formData.infantAge,
            tour_departure_times: formData.tourDepartureTimes || null,
            customer_name_ko: formData.customerNameKo?.trim() || null,
            customer_name_en: formData.customerNameEn?.trim() || null
          }] as never[])
          .select()
          .single()

        if (error) {
          console.error('상품 생성 오류:', error)
          setSaveMessage('상품 생성에 실패했습니다.')
          return
        }

        setSaveMessage('상품이 성공적으로 생성되었습니다!')
        
        // 상품 편집 페이지로 이동 (새로 생성된 ID로)
        setTimeout(() => {
          window.location.href = `/admin/products/${(data as { id: string }).id}`
        }, 1500)
      } else {
        // 기존 상품 업데이트
        const { error } = await supabase
          .from('products')
          .update({
            name: formData.name.trim(),
            name_en: formData.nameEn?.trim() || null,
            product_code: formData.productCode.trim(),
            category: formData.category,
            sub_category: formData.subCategory.trim(),
            description: formData.description.trim(),
            duration: formData.duration.toString(),
            base_price: 0, // 기본 가격은 동적 가격에서 설정
            max_participants: formData.maxParticipants,
            status: formData.status,
            departure_city: formData.departureCity.trim(),
            arrival_city: formData.arrivalCity.trim(),
            departure_country: formData.departureCountry,
            arrival_country: formData.arrivalCountry,
            languages: formData.languages,
            group_size: formData.groupSize.toString(),
            adult_age: formData.adultAge,
            child_age_min: formData.childAgeMin,
            child_age_max: formData.childAgeMax,
            infant_age: formData.infantAge,
            tour_departure_times: formData.tourDepartureTimes || null,
            customer_name_ko: formData.customerNameKo?.trim() || null,
            customer_name_en: formData.customerNameEn?.trim() || null
          } as never)
          .eq('id', productId)

        if (error) throw error

        setSaveMessage('기본 정보가 성공적으로 저장되었습니다.')
        setTimeout(() => setSaveMessage(''), 3000)
      }
    } catch (error) {
      console.error('기본 정보 저장 오류:', error)
      setSaveMessage('기본 정보 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const fetchCategoriesAndSubCategories = useCallback(async () => {
    try {
      // 새로운 카테고리 관리 테이블에서 데이터 가져오기
      const [categoriesResult, subCategoriesResult, productsResult] = await Promise.all([
        supabase.from('product_categories').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('product_sub_categories').select('*, product_categories(name)').eq('is_active', true).order('sort_order'),
        supabase.from('products').select('category, sub_category')
      ])

      if (categoriesResult.error) throw categoriesResult.error
      if (subCategoriesResult.error) throw subCategoriesResult.error
      if (productsResult.error) throw productsResult.error

      // 상품 데이터에서 카테고리와 서브카테고리 사용 횟수 계산
      const categoryCounts: { [key: string]: number } = {}
      const subCategoryCounts: { [key: string]: number } = {}

      productsResult.data?.forEach((product: { category?: string; sub_category?: string }) => {
        if (product.category) {
          categoryCounts[product.category] = (categoryCounts[product.category] || 0) + 1
        }
        if (product.sub_category) {
          subCategoryCounts[product.sub_category] = (subCategoryCounts[product.sub_category] || 0) + 1
        }
      })

      // 카테고리 목록 생성 (DB에서 가져온 데이터 + 사용 횟수)
      const categoryList = categoriesResult.data?.map((category: { id: string; name: string }) => ({
        value: category.name,
        label: category.name,
        count: categoryCounts[category.name] || 0,
        id: category.id
      })) || []

      // 서브카테고리 목록 생성 (DB에서 가져온 데이터 + 사용 횟수 + 카테고리 정보)
      const subCategoryList = subCategoriesResult.data?.map((subCategory: { id: string; name: string; category_id: string; product_categories: { name: string } }) => ({
        value: subCategory.name,
        label: subCategory.name,
        count: subCategoryCounts[subCategory.name] || 0,
        id: subCategory.id,
        categoryId: subCategory.category_id,
        categoryName: subCategory.product_categories?.name
      })) || []

      console.log('=== Categories and SubCategories Debug ===')
      console.log('Categories from DB:', categoryList)
      console.log('SubCategories from DB:', subCategoryList)
      console.log('Current formData.category:', formData.category)
      console.log('Current formData.subCategory:', formData.subCategory)
      
      setCategories(categoryList)
      setAllSubCategories(subCategoryList)
      
      // 현재 선택된 카테고리에 해당하는 서브카테고리만 필터링
      if (formData.category) {
        const selectedCategory = categoryList.find(cat => cat.value === formData.category)
        const filteredSubCategories = subCategoryList.filter(sub => sub.categoryId === selectedCategory?.id)
        setSubCategories(filteredSubCategories)
      } else {
        setSubCategories([])
      }
    } catch (error) {
      console.error('카테고리 및 서브카테고리 데이터 가져오기 오류:', error)
      
      // DB 테이블이 없을 경우 기존 방식으로 폴백
      try {
        const { data: products, error } = await supabase
          .from('products')
          .select('category, sub_category')

        if (error) throw error

        // 카테고리 통계 계산
        const categoryCounts: { [key: string]: number } = {}
        const subCategoryCounts: { [key: string]: number } = {}

        products?.forEach((product: { category?: string; sub_category?: string }) => {
          if (product.category) {
            categoryCounts[product.category] = (categoryCounts[product.category] || 0) + 1
          }
          if (product.sub_category) {
            subCategoryCounts[product.sub_category] = (subCategoryCounts[product.sub_category] || 0) + 1
          }
        })

        // 카테고리 목록 생성
        const categoryList = Object.keys(categoryCounts).map(category => ({
          value: category,
          label: category,
          count: categoryCounts[category]
        }))

        // 서브카테고리 목록 생성
        const subCategoryList = Object.keys(subCategoryCounts).map(subCategory => ({
          value: subCategory,
          label: subCategory,
          count: subCategoryCounts[subCategory]
        }))

        setCategories(categoryList)
        setAllSubCategories(subCategoryList)
        setSubCategories(subCategoryList)
      } catch (fallbackError) {
        console.error('폴백 카테고리 데이터 가져오기 오류:', fallbackError)
      }
    }
  }, [formData.category, formData.subCategory])

  // 카테고리와 서브카테고리 데이터 가져오기
  useEffect(() => {
    fetchCategoriesAndSubCategories()
  }, [fetchCategoriesAndSubCategories])

  // 카테고리 선택 시 서브카테고리 필터링
  const filterSubCategories = useCallback(() => {
    if (formData.category && allSubCategories.length > 0) {
      // 선택된 카테고리에 해당하는 서브카테고리만 필터링
      const selectedCategory = categories.find(cat => cat.value === formData.category)
      const filteredSubCategories = allSubCategories.filter(sub => sub.categoryId === selectedCategory?.id)
      setSubCategories(filteredSubCategories)
      
      // 현재 선택된 서브카테고리가 필터링된 목록에 없으면 초기화
      if (formData.subCategory && !filteredSubCategories.some(sub => sub.value === formData.subCategory)) {
        setFormData((prev: typeof formData) => ({ ...prev, subCategory: '' }))
      }
    } else {
      setSubCategories([])
      // 카테고리가 선택되지 않았으면 서브카테고리도 초기화
      if (formData.subCategory) {
        setFormData((prev: typeof formData) => ({ ...prev, subCategory: '' }))
      }
    }
  }, [formData.category, formData.subCategory, allSubCategories, categories, setFormData])

  useEffect(() => {
    filterSubCategories()
  }, [filterSubCategories])

  return (
    <>
      {/* 상품 기본 정보 */}
      <div className="space-y-4">
        {/* 상품명 필드들 - 2x2 그리드로 배치 */}
        <div className="space-y-4">
          {/* 내부 한국어, 내부 영어 - 한 줄에 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">상품명 (내부 한국어) *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="내부용 한국어 상품명을 입력하세요"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">상품명 (내부 영어)</label>
              <input
                type="text"
                value={formData.nameEn || ''}
                onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Internal English product name"
              />
            </div>
          </div>
          
          {/* 고객용 한국어, 고객용 영어 - 한 줄에 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">상품명 (고객용 한국어)</label>
              <input
                type="text"
                value={formData.customerNameKo || ''}
                onChange={(e) => setFormData({ ...formData, customerNameKo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="고객용 한국어 상품명을 입력하세요"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">상품명 (고객용 영어)</label>
              <input
                type="text"
                value={formData.customerNameEn || ''}
                onChange={(e) => setFormData({ ...formData, customerNameEn: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Customer English product name"
              />
            </div>
          </div>
        </div>

        {/* 상품 코드, 판매 상태, 카테고리, 서브카테고리 - 한 줄에 배치 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">상품 코드 *</label>
            <input
              type="text"
              value={formData.productCode || ''}
              onChange={(e) => setFormData({ ...formData, productCode: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="예: ANT-001"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">판매 상태 *</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' | 'draft' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="draft">초안</option>
              <option value="active">활성</option>
              <option value="inactive">비활성</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">카테고리 *</label>
            <div className="flex gap-2">
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value, subCategory: '' })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">카테고리 선택</option>
                {categories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label} ({category.count})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowCategoryModal(true)}
                className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center"
                title="카테고리 관리"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">서브카테고리 *</label>
            <div className="flex gap-2">
              <select
                value={formData.subCategory}
                onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">서브카테고리 선택</option>
                {subCategories.map((subCategory) => (
                  <option key={subCategory.value} value={subCategory.value}>
                    {subCategory.label} ({subCategory.count})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowCategoryModal(true)}
                className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center"
                title="서브카테고리 관리"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 상품 설명 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">상품 설명 (내부)</label>
          <textarea
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="상품에 대한 간단한 설명을 입력하세요"
            rows={3}
          />
        </div>

        {/* 상품 태그 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">상품 태그</label>
          <div className="flex space-x-2 mb-2">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addTag()}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="태그를 입력하고 Enter를 누르세요"
            />
            <button
              type="button"
              onClick={addTag}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              추가
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(formData.tags || []).map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="ml-2 text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 출발/도착 정보 - 한 줄에 배치 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">출발 도시 *</label>
          <input
            type="text"
            value={formData.departureCity || ''}
            onChange={(e) => setFormData({ ...formData, departureCity: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="예: 라스베가스"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">도착 도시 *</label>
          <input
            type="text"
            value={formData.arrivalCity || ''}
            onChange={(e) => setFormData({ ...formData, arrivalCity: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="예: 앤텔롭 캐년"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">출발 국가 *</label>
          <select
            value={formData.departureCountry || ''}
            onChange={(e) => setFormData({ ...formData, departureCountry: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">국가 선택</option>
            <option value="USA">미국</option>
            <option value="US">미국 (US)</option>
            <option value="KR">한국</option>
            <option value="JP">일본</option>
            <option value="CN">중국</option>
            <option value="TH">태국</option>
            <option value="VN">베트남</option>
            <option value="SG">싱가포르</option>
            <option value="MY">말레이시아</option>
            <option value="ID">인도네시아</option>
            <option value="PH">필리핀</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">도착 국가 *</label>
          <select
            value={formData.arrivalCountry || ''}
            onChange={(e) => setFormData({ ...formData, arrivalCountry: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">국가 선택</option>
            <option value="USA">미국</option>
            <option value="US">미국 (US)</option>
            <option value="KR">한국</option>
            <option value="JP">일본</option>
            <option value="CN">중국</option>
            <option value="TH">태국</option>
            <option value="VN">베트남</option>
            <option value="SG">싱가포르</option>
            <option value="MY">말레이시아</option>
            <option value="ID">인도네시아</option>
            <option value="PH">필리핀</option>
          </select>
        </div>
      </div>
      
      {/* 투어 언어 및 그룹 크기 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">투어 언어 *</label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.languages?.includes('ko') || false}
                onChange={(e) => {
                  const languages = formData.languages || [];
                  if (e.target.checked) {
                    setFormData({ ...formData, languages: [...languages, 'ko'] });
                  } else {
                    setFormData({ ...formData, languages: languages.filter(lang => lang !== 'ko') });
                  }
                }}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              한국어
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.languages?.includes('en') || false}
                onChange={(e) => {
                  const languages = formData.languages || [];
                  if (e.target.checked) {
                    setFormData({ ...formData, languages: [...languages, 'en'] });
                  } else {
                    setFormData({ ...formData, languages: languages.filter(lang => lang !== 'en') });
                  }
                }}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              영어
            </label>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">그룹 크기 *</label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.groupSize?.includes('private') || false}
                onChange={(e) => {
                  const groupSizes = formData.groupSize || [];
                  if (e.target.checked) {
                    setFormData({ ...formData, groupSize: [...groupSizes, 'private'] });
                  } else {
                    setFormData({ ...formData, groupSize: groupSizes.filter(size => size !== 'private') });
                  }
                }}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              Private (개인/가족)
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.groupSize?.includes('small') || false}
                onChange={(e) => {
                  const groupSizes = formData.groupSize || [];
                  if (e.target.checked) {
                    setFormData({ ...formData, groupSize: [...groupSizes, 'small'] });
                  } else {
                    setFormData({ ...formData, groupSize: groupSizes.filter(size => size !== 'small') });
                  }
                }}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              Small Group (소규모 그룹)
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.groupSize?.includes('big') || false}
                onChange={(e) => {
                  const groupSizes = formData.groupSize || [];
                  if (e.target.checked) {
                    setFormData({ ...formData, groupSize: [...groupSizes, 'big'] });
                  } else {
                    setFormData({ ...formData, groupSize: groupSizes.filter(size => size !== 'big') });
                  }
                }}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              Big Group (대규모 그룹)
            </label>
          </div>
        </div>
      </div>
      
      {/* 연령 기준 - 한 줄에 배치 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">성인 기준 (이상) *</label>
          <input
            type="number"
            min="0"
            value={formData.adultAge || ''}
            onChange={(e) => setFormData({ ...formData, adultAge: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="예: 13"
            required
          />
          <p className="text-xs text-gray-500 mt-1">세 이상</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">아동 기준 (이상) *</label>
          <input
            type="number"
            min="0"
            value={formData.childAgeMin || ''}
            onChange={(e) => setFormData({ ...formData, childAgeMin: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="예: 3"
            required
          />
          <p className="text-xs text-gray-500 mt-1">세 이상</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">아동 기준 (이하) *</label>
          <input
            type="number"
            min="0"
            value={formData.childAgeMax || ''}
            onChange={(e) => setFormData({ ...formData, childAgeMax: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="예: 12"
            required
          />
          <p className="text-xs text-gray-500 mt-1">세 이하</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">유아 기준 (이하) *</label>
          <input
            type="number"
            min="0"
            value={formData.infantAge || ''}
            onChange={(e) => setFormData({ ...formData, infantAge: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="예: 2"
            required
          />
          <p className="text-xs text-gray-500 mt-1">세 이하</p>
        </div>
      </div>

      {/* 추가 정보 섹션 */}
      <div className="border-t pt-6 mt-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <Info className="h-5 w-5 mr-2" />
          추가 정보
        </h3>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">총 투어 시간 (시간) *</label>
          <input
            type="number"
            min="0.5"
            max="168"
            step="0.5"
            value={formData.duration}
            onChange={(e) => {
              const value = parseFloat(e.target.value);
              if (value >= 0.5 && value <= 168) {
                setFormData({ ...formData, duration: value });
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="예: 3.5 (숙박 투어의 경우 25, 48 등)"
            required
          />
          <p className="text-xs text-gray-500 mt-1">시간 단위로 입력 (0.5시간 = 30분, 최대 168시간 = 7일)</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">최대 참가자 *</label>
          <input
            type="number"
            min="1"
            value={formData.maxParticipants}
            onChange={(e) => setFormData({ ...formData, maxParticipants: parseInt(e.target.value) || 1 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('tourDepartureTimes')}</label>
          
          {/* 시간 추가 입력 */}
          <div className="flex gap-2 mb-3">
            <input
              type="time"
              value={newDepartureTime}
              onChange={(e) => setNewDepartureTime(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent flex-1"
              placeholder="출발 시간 선택"
            />
            <button
              type="button"
              onClick={addDepartureTime}
              disabled={!newDepartureTime || (formData.tourDepartureTimes?.includes(newDepartureTime) ?? false)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                newDepartureTime && !(formData.tourDepartureTimes?.includes(newDepartureTime) ?? false)
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {t('addDepartureTime')}
            </button>
          </div>
          
          {/* 선택된 시간 목록 */}
          {formData.tourDepartureTimes && formData.tourDepartureTimes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-600">선택된 출발 시간들:</p>
              <div className="flex flex-wrap gap-2">
                {formData.tourDepartureTimes.map((time, index) => (
                  <div key={index} className="flex items-center bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                    <span>{time}</span>
                    <button
                      type="button"
                      onClick={() => removeDepartureTime(index)}
                      className="ml-2 text-red-600 hover:text-red-800 font-medium"
                      title={t('removeDepartureTime')}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <p className="text-xs text-gray-500 mt-1">여러 출발 시간을 추가할 수 있습니다</p>
        </div>
      </div>


      {/* 기본 정보 저장 버튼 */}
      <div className="border-t pt-6 mt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Info className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-medium text-gray-900">기본 정보</h3>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={`px-6 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors ${
              saving
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500"></div>
                <span>저장 중...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>{isNewProduct ? '상품 생성' : '기본 정보 저장'}</span>
              </>
            )}
          </button>
        </div>
        {saveMessage && (
          <div className={`mt-3 p-3 rounded-lg text-sm ${
            saveMessage.includes('성공') 
              ? 'bg-green-100 text-green-800 border border-green-200' 
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            {saveMessage}
          </div>
        )}
        {isNewProduct && (
          <p className="mt-2 text-sm text-gray-500">
            새 상품은 전체 저장을 사용해주세요.
          </p>
        )}
      </div>
      </div>

      {/* 저장 버튼 */}
      <div className="flex justify-end pt-6 border-t border-gray-200">
        <button
          onClick={handleSave}
          disabled={saving || isNewProduct}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? '저장 중...' : '기본 정보 저장'}
        </button>
      </div>

      {/* 카테고리 관리 모달 */}
      <CategoryManagementModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        categories={categories}
        subCategories={subCategories}
        onCategoriesUpdate={handleCategoriesUpdate}
      />
    </>
  )
}
