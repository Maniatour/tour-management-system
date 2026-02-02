'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Info, Save, Settings } from 'lucide-react'
import { 
  MdDirectionsCar,      // 밴, 리무진
  MdDirectionsBus,      // 버스
  MdFlightTakeoff,      // 경비행기
  MdLocalTaxi          // 리무진
} from 'react-icons/md'
import { FaHelicopter } from 'react-icons/fa'
import { useTranslations, useLocale } from 'next-intl'
import { supabase } from '@/lib/supabase'
import CategoryManagementModal from './CategoryManagementModal'
import TagSelector from '@/components/admin/TagSelector'

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
  categoryId?: string | undefined
  categoryName?: string | undefined
}

  interface BasicInfoTabProps {
    formData: {
      name: string
      nameEn?: string
      productCode: string
      category: string
      subCategory: string
      description: string
      summaryKo?: string
      summaryEn?: string
      duration: number
      basePrice?: number | { adult: number; child: number; infant: number }
      basePriceAdult?: number
      basePriceChild?: number
      basePriceInfant?: number
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
      transportationMethods?: string[]
      homepagePricingType?: 'single' | 'separate'
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
  const locale = useLocale()
  const t = useTranslations('common')
  const tBasic = useTranslations('products.basicInfoTab')
  const tProducts = useTranslations('products')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [subCategories, setSubCategories] = useState<SubCategoryItem[]>([])
  const [allSubCategories, setAllSubCategories] = useState<SubCategoryItem[]>([])
  const [newDepartureTime, setNewDepartureTime] = useState('')
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [_defaultChoicesPrice, setDefaultChoicesPrice] = useState(0)
  const [loadingChoices, setLoadingChoices] = useState(false)
  const [choicesGroups, setChoicesGroups] = useState<Array<{
    id: string
    choice_group: string
    choice_group_ko: string
    options: Array<{
      id: string
      option_name: string
      option_name_ko: string
      adult_price: number
      child_price: number
      infant_price: number
      is_default: boolean
    }>
  }>>([])

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

  // 태그 변경 핸들러 (TagSelector에서 호출됨)
  const handleTagsChange = async (tags: string[]) => {
    setFormData({
      ...formData,
      tags
    })
    
    // 새로 추가된 태그가 있으면 tags 테이블에 추가
    const currentTags = formData.tags || []
    const newTags = tags.filter(tag => !currentTags.includes(tag))
    
    if (newTags.length > 0) {
      // 각 새 태그를 tags 테이블에 추가
      for (const tagKey of newTags) {
        // 태그 키 형식 검증 (영어 소문자, 언더스코어만 허용)
        const keyPattern = /^[a-z][a-z0-9_]*$/
        
        // 이미 태그 키 형식인 경우 그대로 사용, 아닌 경우 변환
        let normalizedKey = tagKey
        if (!keyPattern.test(tagKey)) {
          // 한글이나 다른 문자를 태그 키 형식으로 변환
          normalizedKey = tagKey
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/^[^a-z]/, 'tag_') // 첫 문자가 영어 소문자가 아니면 'tag_' 추가
            .replace(/_+/g, '_') // 연속된 언더스코어를 하나로
            .replace(/^_|_$/g, '') // 앞뒤 언더스코어 제거
          
          if (!normalizedKey) {
            normalizedKey = `tag_${Date.now()}`
          }
        }
        
        try {
          // 태그가 이미 존재하는지 확인
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: existingTag } = await (supabase as any)
            .from('tags')
            .select('id')
            .eq('key', normalizedKey)
            .maybeSingle()
          
          if (!existingTag) {
            // 태그가 없으면 새로 생성
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: insertError } = await (supabase as any)
              .from('tags')
              .insert({
                id: crypto.randomUUID(),
                key: normalizedKey,
                is_system: false
              })
            
            if (insertError && insertError.code !== '23505') { // unique violation은 무시
              console.error('태그 추가 오류:', insertError)
            } else {
              // 한국어 번역 자동 추가 (태그 키가 한글인 경우)
              if (tagKey !== normalizedKey) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { data: tagData } = await (supabase as any)
                  .from('tags')
                  .select('id')
                  .eq('key', normalizedKey)
                  .single()
                
                if (tagData) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const { error: translationError } = await (supabase as any)
                    .from('tag_translations')
                    .insert({
                      id: crypto.randomUUID(),
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      tag_id: (tagData as any).id,
                      locale: 'ko',
                      label: tagKey
                    })
                  
                  if (translationError && translationError.code !== '23505') {
                    console.error('태그 번역 추가 오류:', translationError)
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error('태그 처리 오류:', error)
        }
      }
    }
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
        setSaveMessage(tBasic('msgEnterName'))
        return
      }
      if (!formData.category) {
        setSaveMessage(tBasic('msgSelectCategory'))
        return
      }
      if (!formData.subCategory) {
        setSaveMessage(tBasic('msgSelectSubCategory'))
        return
      }
      if (formData.duration <= 0) {
        setSaveMessage(tBasic('msgEnterDuration'))
        return
      }
      if (formData.maxParticipants <= 0) {
        setSaveMessage(tBasic('msgEnterMaxParticipants'))
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
            summary_ko: formData.summaryKo?.trim() || null,
            summary_en: formData.summaryEn?.trim() || null,
            duration: formData.duration.toString(),
            base_price: typeof formData.basePrice === 'object' && formData.basePrice 
              ? formData.basePrice.adult 
              : (formData.basePrice || 0),
            adult_base_price: typeof formData.basePrice === 'object' && formData.basePrice 
              ? formData.basePrice.adult 
              : (formData.basePriceAdult ?? (typeof formData.basePrice === 'number' ? formData.basePrice : 0)),
            child_base_price: typeof formData.basePrice === 'object' && formData.basePrice 
              ? formData.basePrice.child 
              : (formData.basePriceChild ?? 0),
            infant_base_price: typeof formData.basePrice === 'object' && formData.basePrice 
              ? formData.basePrice.infant 
              : (formData.basePriceInfant ?? 0),
            homepage_pricing_type: formData.homepagePricingType || 'separate',
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
            customer_name_ko: formData.customerNameKo?.trim() || formData.name.trim() || tBasic('defaultProductName'),
            customer_name_en: formData.customerNameEn?.trim() || formData.nameEn?.trim() || 'Product',
            transportation_methods: formData.transportationMethods || []
          }] as never[])
          .select()
          .single()

        if (error) {
          console.error('상품 생성 오류:', error)
          const errorMessage = error.message || '알 수 없는 오류'
          const errorDetails = error.details || ''
          const errorHint = error.hint || ''
          setSaveMessage(tBasic('msgCreateFailed', { message: `${errorMessage}${errorDetails ? ` (${errorDetails})` : ''}${errorHint ? ` - ${errorHint}` : ''}` }))
          setSaving(false)
          return
        }

        if (!data || !(data as { id?: string })?.id) {
          console.error('상품 생성 후 데이터를 받지 못했습니다:', data)
          setSaveMessage(tBasic('msgCreateNoData'))
          setSaving(false)
          return
        }

        setSaveMessage(tBasic('msgCreateSuccess'))
        
        // 상품 편집 페이지로 이동 (새로 생성된 ID로)
        setTimeout(() => {
          window.location.href = `/${locale}/admin/products/${(data as { id: string }).id}`
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
            summary_ko: formData.summaryKo?.trim() || null,
            summary_en: formData.summaryEn?.trim() || null,
            duration: formData.duration.toString(),
            base_price: typeof formData.basePrice === 'object' && formData.basePrice 
              ? formData.basePrice.adult 
              : (formData.basePrice || 0),
            adult_base_price: typeof formData.basePrice === 'object' && formData.basePrice 
              ? formData.basePrice.adult 
              : (formData.basePriceAdult ?? (typeof formData.basePrice === 'number' ? formData.basePrice : 0)),
            child_base_price: typeof formData.basePrice === 'object' && formData.basePrice 
              ? formData.basePrice.child 
              : (formData.basePriceChild ?? 0),
            infant_base_price: typeof formData.basePrice === 'object' && formData.basePrice 
              ? formData.basePrice.infant 
              : (formData.basePriceInfant ?? 0),
            homepage_pricing_type: formData.homepagePricingType || 'separate',
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
            customer_name_ko: formData.customerNameKo?.trim() || formData.name.trim() || tBasic('defaultProductName'),
            customer_name_en: formData.customerNameEn?.trim() || formData.nameEn?.trim() || 'Product',
            transportation_methods: formData.transportationMethods || []
          } as never)
          .eq('id', productId)

        if (error) throw error

        setSaveMessage(tBasic('msgSaveSuccess'))
        setTimeout(() => setSaveMessage(''), 3000)
      }
    } catch (error) {
      console.error('기본 정보 저장 오류:', error)
      setSaveMessage(tBasic('msgSaveError'))
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

      productsResult.data?.forEach((product: { category?: string; sub_category?: string | null }) => {
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
      console.log('Raw categoriesResult.data:', categoriesResult.data)
      console.log('Raw subCategoriesResult.data:', subCategoriesResult.data)
      
      setCategories(categoryList)
      setAllSubCategories(subCategoryList)
      
      // 현재 선택된 카테고리에 해당하는 서브카테고리만 필터링
      if (formData.category) {
        const selectedCategory = categoryList.find(cat => cat.value === formData.category)
        console.log('Selected category:', selectedCategory)
        console.log('All subcategories:', subCategoryList)
        
        const filteredSubCategories = subCategoryList.filter(sub => sub.categoryId === selectedCategory?.id)
        console.log('Filtered subcategories:', filteredSubCategories)
        
        setSubCategories(filteredSubCategories)
        
        // 현재 선택된 서브카테고리가 필터링된 목록에 없으면 초기화하지 않고 유지
        // 대신 서브카테고리 목록에 현재 선택된 서브카테고리를 추가
        if (formData.subCategory && !filteredSubCategories.some(sub => sub.value === formData.subCategory)) {
          console.log('Current subcategory not found in filtered list, but keeping it:', formData.subCategory)
          // 현재 선택된 서브카테고리를 목록에 추가 (사용자가 수동으로 입력한 경우 대비)
          const currentSubCategory = {
            value: formData.subCategory,
            label: formData.subCategory,
            count: 0,
            categoryId: selectedCategory?.id,
            categoryName: selectedCategory?.label
          }
          setSubCategories([currentSubCategory, ...filteredSubCategories])
        }
      } else {
        setSubCategories([])
        // 카테고리가 선택되지 않았으면 서브카테고리도 초기화하지 않음 (편집 중일 때)
        if (formData.subCategory && !isNewProduct) {
          console.log('No category selected but keeping subcategory for editing:', formData.subCategory)
        } else if (formData.subCategory && isNewProduct) {
          setFormData({ ...formData, subCategory: '' })
        }
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

        products?.forEach((product: { category?: string; sub_category?: string | null }) => {
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
        
        // 현재 선택된 카테고리에 해당하는 서브카테고리만 필터링 (폴백 모드에서는 모든 서브카테고리 표시)
        if (formData.category) {
          // 폴백 모드에서는 카테고리별 필터링이 어려우므로 모든 서브카테고리 표시
          setSubCategories(subCategoryList)
        } else {
          setSubCategories([])
        }
      } catch (fallbackError) {
        console.error('폴백 카테고리 데이터 가져오기 오류:', fallbackError)
      }
    }
  }, [formData, setFormData, isNewProduct])

  // 카테고리와 서브카테고리 데이터 가져오기
  useEffect(() => {
    fetchCategoriesAndSubCategories()
  }, [fetchCategoriesAndSubCategories])

  // 초이스 그룹별 모든 옵션 가격 로드
  const loadDefaultChoicesPrice = useCallback(async () => {
    if (isNewProduct || !productId) {
      setDefaultChoicesPrice(0)
      setChoicesGroups([])
      return
    }

    try {
      setLoadingChoices(true)
      const { data, error } = await supabase
        .from('product_choices')
        .select(`
          id,
          choice_group,
          choice_group_ko,
          options:choice_options (
            id,
            option_name,
            option_name_ko,
            adult_price,
            child_price,
            infant_price,
            is_default,
            is_active
          )
        `)
        .eq('product_id', productId)
        .order('sort_order', { ascending: true })

      if (error) {
        console.error('초이스 가격 로드 오류:', error)
        setDefaultChoicesPrice(0)
        setChoicesGroups([])
        return
      }

      // 초이스 그룹별 데이터 저장
      const groups: Array<{
        id: string
        choice_group: string
        choice_group_ko: string
        options: Array<{
          id: string
          option_name: string
          option_name_ko: string
          adult_price: number
          child_price: number
          infant_price: number
          is_default: boolean
        }>
      }> = []

      // 기본 선택된 옵션들의 성인 가격 합산
      let totalPrice = 0
      if (data && Array.isArray(data)) {
        data.forEach((choice: any) => {
          if (choice.options && Array.isArray(choice.options)) {
            // 활성화된 옵션만 필터링
            const activeOptions = choice.options.filter((opt: any) => opt.is_active !== false)
            
            // 각 초이스 그룹에서 기본 선택된 옵션 찾기
            const defaultOption = activeOptions.find((opt: any) => opt.is_default === true)
            if (defaultOption && defaultOption.adult_price) {
              totalPrice += defaultOption.adult_price || 0
            }

            // 그룹 정보 저장
            groups.push({
              id: choice.id,
              choice_group: choice.choice_group || '',
              choice_group_ko: choice.choice_group_ko || choice.choice_group || '',
              options: activeOptions.map((opt: any) => ({
                id: opt.id,
                option_name: opt.option_name || '',
                option_name_ko: opt.option_name_ko || opt.option_name || '',
                adult_price: opt.adult_price || 0,
                child_price: opt.child_price || 0,
                infant_price: opt.infant_price || 0,
                is_default: opt.is_default || false
              }))
            })
          }
        })
      }

      setDefaultChoicesPrice(totalPrice)
      setChoicesGroups(groups)
    } catch (error) {
      console.error('초이스 가격 로드 오류:', error)
      setDefaultChoicesPrice(0)
      setChoicesGroups([])
    } finally {
      setLoadingChoices(false)
    }
  }, [productId, isNewProduct])

  // 초이스 가격 로드
  useEffect(() => {
    loadDefaultChoicesPrice()
  }, [loadDefaultChoicesPrice])

  // 카테고리 선택 시 서브카테고리 필터링
  const filterSubCategories = useCallback(() => {
    if (formData.category && allSubCategories.length > 0) {
      // 선택된 카테고리에 해당하는 서브카테고리만 필터링
      const selectedCategory = categories.find(cat => cat.value === formData.category)
      const filteredSubCategories = allSubCategories.filter(sub => sub.categoryId === selectedCategory?.id)
      setSubCategories(filteredSubCategories)
      
      // 현재 선택된 서브카테고리가 필터링된 목록에 없으면 유지하고 목록에 추가
      if (formData.subCategory && !filteredSubCategories.some(sub => sub.value === formData.subCategory)) {
        console.log('Current subcategory not found in filtered list, but keeping it:', formData.subCategory)
        // 현재 선택된 서브카테고리를 목록에 추가
        const currentSubCategory = {
          value: formData.subCategory,
          label: formData.subCategory,
          count: 0,
          categoryId: selectedCategory?.id,
          categoryName: selectedCategory?.label
        }
        setSubCategories([currentSubCategory, ...filteredSubCategories])
      }
    } else {
      setSubCategories([])
      // 카테고리가 선택되지 않았으면 서브카테고리도 초기화하지 않음 (편집 중일 때)
      if (formData.subCategory && !isNewProduct) {
        console.log('No category selected but keeping subcategory for editing:', formData.subCategory)
      } else if (formData.subCategory && isNewProduct) {
        setFormData((prev: typeof formData) => ({ ...prev, subCategory: '' }))
      }
    }
  }, [formData.category, formData.subCategory, allSubCategories, categories, setFormData, isNewProduct])

  useEffect(() => {
    filterSubCategories()
  }, [filterSubCategories])

  return (
    <div className="space-y-6">
      {/* 상품 기본 정보 섹션 */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Info className="h-5 w-5 mr-2 text-blue-600" />
          {tBasic('sectionTitle')}
        </h3>
        <div className="space-y-4">
        {/* 상품명 필드들 - 2x2 그리드로 배치 */}
        <div className="space-y-4">
          {/* 내부 한국어, 내부 영어 - 한 줄에 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{tBasic('nameInternalKo')}</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={tBasic('placeholderInternalKo')}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{tBasic('nameInternalEn')}</label>
              <input
                type="text"
                value={formData.nameEn || ''}
                onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={tBasic('placeholderInternalEn')}
              />
            </div>
          </div>
          
          {/* 고객용 한국어, 고객용 영어 - 한 줄에 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{tBasic('nameCustomerKo')}</label>
              <input
                type="text"
                value={formData.customerNameKo || ''}
                onChange={(e) => setFormData({ ...formData, customerNameKo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={tBasic('placeholderCustomerKo')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{tBasic('nameCustomerEn')}</label>
              <input
                type="text"
                value={formData.customerNameEn || ''}
                onChange={(e) => setFormData({ ...formData, customerNameEn: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={tBasic('placeholderCustomerEn')}
              />
            </div>
          </div>
        </div>

        {/* 상품 코드, 판매 상태, 카테고리, 서브카테고리 - 한 줄에 배치 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{tBasic('productCode')}</label>
            <input
              type="text"
              value={formData.productCode || ''}
              onChange={(e) => setFormData({ ...formData, productCode: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={tBasic('productCodePlaceholder')}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{tBasic('salesStatus')}</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' | 'draft' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="draft">{tProducts('status.draft')}</option>
              <option value="active">{tProducts('status.active')}</option>
              <option value="inactive">{tProducts('status.inactive')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{tBasic('category')}</label>
            <div className="flex gap-2">
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value, subCategory: '' })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">{tBasic('categorySelect')}</option>
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
                title={tBasic('categoryManage')}
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{tBasic('subCategory')}</label>
            <div className="flex gap-2">
              <select
                value={formData.subCategory}
                onChange={(e) => {
                  setFormData({ ...formData, subCategory: e.target.value })
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">{tBasic('subCategorySelect')}</option>
                {/* 현재 선택된 서브카테고리가 목록에 없으면 먼저 표시 */}
                {formData.subCategory && !subCategories.some(sub => sub.value === formData.subCategory) && (
                  <option value={formData.subCategory} style={{ backgroundColor: '#fef3c7' }}>
                    {formData.subCategory} {tBasic('currentlySelected')}
                  </option>
                )}
                {subCategories.length === 0 ? (
                  <option value="" disabled>
                    {formData.category ? tBasic('noSubCategory') : tBasic('selectCategoryFirst')}
                  </option>
                ) : (
                  subCategories.map((subCategory) => (
                    <option key={subCategory.value} value={subCategory.value}>
                      {subCategory.label} ({subCategory.count})
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                onClick={() => setShowCategoryModal(true)}
                className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center"
                title={tBasic('subCategoryManage')}
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 상품 설명 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{tBasic('descriptionInternal')}</label>
          <textarea
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={tBasic('descriptionPlaceholder')}
            rows={3}
          />
        </div>

        {/* 상품 요약 */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('productSummaryKo')}</label>
              <textarea
                value={formData.summaryKo || ''}
                onChange={(e) => setFormData({ ...formData, summaryKo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('productSummaryPlaceholderKo')}
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('productSummaryEn')}</label>
              <textarea
                value={formData.summaryEn || ''}
                onChange={(e) => setFormData({ ...formData, summaryEn: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('productSummaryPlaceholderEn')}
                rows={3}
              />
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* 출발/도착 정보 섹션 */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Info className="h-5 w-5 mr-2 text-blue-600" />
          {tBasic('departureArrival')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{tBasic('departureCity')}</label>
          <input
            type="text"
            value={formData.departureCity || ''}
            onChange={(e) => setFormData({ ...formData, departureCity: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={tBasic('placeholderDepartureCity')}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{tBasic('arrivalCity')}</label>
          <input
            type="text"
            value={formData.arrivalCity || ''}
            onChange={(e) => setFormData({ ...formData, arrivalCity: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={tBasic('placeholderArrivalCity')}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{tBasic('departureCountry')}</label>
          <select
            value={formData.departureCountry || ''}
            onChange={(e) => setFormData({ ...formData, departureCountry: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">{tBasic('countrySelect')}</option>
            <option value="USA">{tBasic('countryUSA')}</option>
            <option value="US">{tBasic('countryUS')}</option>
            <option value="KR">{tBasic('countryKR')}</option>
            <option value="JP">{tBasic('countryJP')}</option>
            <option value="CN">{tBasic('countryCN')}</option>
            <option value="TH">{tBasic('countryTH')}</option>
            <option value="VN">{tBasic('countryVN')}</option>
            <option value="SG">{tBasic('countrySG')}</option>
            <option value="MY">{tBasic('countryMY')}</option>
            <option value="ID">{tBasic('countryID')}</option>
            <option value="PH">{tBasic('countryPH')}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{tBasic('arrivalCountry')}</label>
          <select
            value={formData.arrivalCountry || ''}
            onChange={(e) => setFormData({ ...formData, arrivalCountry: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">{tBasic('countrySelect')}</option>
            <option value="USA">{tBasic('countryUSA')}</option>
            <option value="US">{tBasic('countryUS')}</option>
            <option value="KR">{tBasic('countryKR')}</option>
            <option value="JP">{tBasic('countryJP')}</option>
            <option value="CN">{tBasic('countryCN')}</option>
            <option value="TH">{tBasic('countryTH')}</option>
            <option value="VN">{tBasic('countryVN')}</option>
            <option value="SG">{tBasic('countrySG')}</option>
            <option value="MY">{tBasic('countryMY')}</option>
            <option value="ID">{tBasic('countryID')}</option>
            <option value="PH">{tBasic('countryPH')}</option>
          </select>
        </div>
        </div>
      </div>

      {/* 투어 정보 섹션 */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Info className="h-5 w-5 mr-2 text-blue-600" />
          {tBasic('tourInfo')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 운송수단 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{tBasic('transportation')}</label>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'van', labelKey: 'transportVan', icon: MdDirectionsCar },
              { value: 'bus', labelKey: 'transportBus', icon: MdDirectionsBus },
              { value: 'helicopter', labelKey: 'transportHelicopter', icon: FaHelicopter },
              { value: 'light_aircraft', labelKey: 'transportLightAircraft', icon: MdFlightTakeoff },
              { value: 'limousine', labelKey: 'transportLimousine', icon: MdLocalTaxi }
            ].map((method) => {
              const Icon = method.icon
              const isChecked = formData.transportationMethods?.includes(method.value) || false
              
              return (
                <label 
                  key={method.value} 
                  className={`flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg border-2 transition-all text-xs ${
                    isChecked 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      const currentMethods = formData.transportationMethods || []
                      if (e.target.checked) {
                        setFormData({
                          ...formData,
                          transportationMethods: [...currentMethods, method.value]
                        })
                      } else {
                        setFormData({
                          ...formData,
                          transportationMethods: currentMethods.filter(m => m !== method.value)
                        })
                      }
                    }}
                    className="h-3 w-3 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <Icon className="w-4 h-4 text-blue-600" />
                  <span className={`text-xs font-medium ${isChecked ? 'text-blue-700' : 'text-gray-700'}`}>
                    {tBasic(method.labelKey as any)}
                  </span>
                </label>
              )
            })}
          </div>
        </div>
        
        {/* 투어 언어 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{tBasic('tourLanguage')}</label>
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
              {tBasic('langKo')}
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
              {tBasic('langEn')}
            </label>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{tBasic('groupSize')}</label>
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
              {tBasic('privateGroup')}
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
              {tBasic('bigGroup')}
            </label>
          </div>
        </div>
        </div>
      </div>

      {/* 연령 기준 섹션 */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Info className="h-5 w-5 mr-2 text-blue-600" />
          {tBasic('ageSection')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{tBasic('adultAgeMin')}</label>
          <input
            type="number"
            min="0"
            value={formData.adultAge || ''}
            onChange={(e) => setFormData({ ...formData, adultAge: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={tBasic('placeholderAge')}
            required
          />
          <p className="text-xs text-gray-500 mt-1">{tBasic('yearsAndOver')}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{tBasic('childAgeMin')}</label>
          <input
            type="number"
            min="0"
            value={formData.childAgeMin || ''}
            onChange={(e) => setFormData({ ...formData, childAgeMin: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={tBasic('placeholderAge')}
            required
          />
          <p className="text-xs text-gray-500 mt-1">{tBasic('yearsAndOver')}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{tBasic('childAgeMax')}</label>
          <input
            type="number"
            min="0"
            value={formData.childAgeMax || ''}
            onChange={(e) => setFormData({ ...formData, childAgeMax: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={tBasic('placeholderAge')}
            required
          />
          <p className="text-xs text-gray-500 mt-1">{tBasic('yearsAndUnder')}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{tBasic('infantAgeMax')}</label>
          <input
            type="number"
            min="0"
            value={formData.infantAge || ''}
            onChange={(e) => setFormData({ ...formData, infantAge: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={tBasic('placeholderAge')}
            required
          />
          <p className="text-xs text-gray-500 mt-1">{tBasic('yearsAndUnder')}</p>
        </div>
        </div>
      </div>

      {/* 가격 정보 섹션 */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Info className="h-5 w-5 mr-2 text-blue-600" />
          {tBasic('priceSection')}
        </h3>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">{tBasic('basePriceLabel')}</label>
              <span className="text-xs text-gray-500">{tBasic('basePriceHint')}</span>
            </div>
            
            {/* 홈페이지 가격 타입 선택 */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {tBasic('homepagePricingType')}
              </label>
              <div className="flex items-center space-x-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="homepagePricingType"
                    value="separate"
                    checked={(formData.homepagePricingType || 'separate') === 'separate'}
                    onChange={(e) => setFormData({ ...formData, homepagePricingType: e.target.value as 'single' | 'separate' })}
                    className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="text-sm text-gray-700">{tBasic('separatePricing')}</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="homepagePricingType"
                    value="single"
                    checked={formData.homepagePricingType === 'single'}
                    onChange={(e) => {
                      const pricingType = e.target.value as 'single' | 'separate';
                      const currentAdultPrice = typeof formData.basePrice === 'object' && formData.basePrice 
                        ? formData.basePrice.adult 
                        : (formData.basePriceAdult ?? (typeof formData.basePrice === 'number' ? formData.basePrice : 0));
                      setFormData({ 
                        ...formData, 
                        homepagePricingType: pricingType,
                        basePrice: { adult: currentAdultPrice, child: currentAdultPrice, infant: currentAdultPrice },
                        basePriceAdult: currentAdultPrice,
                        basePriceChild: currentAdultPrice,
                        basePriceInfant: currentAdultPrice
                      });
                    }}
                    className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="text-sm text-gray-700">{tBasic('singlePricing')}</span>
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {tBasic('pricingTypeHint')}
              </p>
            </div>

            {/* 가격 입력 필드 - 홈페이지 가격 타입에 따라 변동 */}
            {formData.homepagePricingType === 'single' ? (
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  {tBasic('priceSingle')}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={(() => {
                    if (typeof formData.basePrice === 'object' && formData.basePrice) {
                      return formData.basePrice.adult || 0;
                    }
                    return formData.basePriceAdult ?? (typeof formData.basePrice === 'number' ? formData.basePrice : 0);
                  })()}
                  onChange={(e) => {
                    const price = parseFloat(e.target.value) || 0;
                    // 단일 가격인 경우 모든 가격을 동일하게 설정
                    setFormData({ 
                      ...formData, 
                      basePrice: { adult: price, child: price, infant: price },
                      basePriceAdult: price,
                      basePriceChild: price,
                      basePriceInfant: price
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                  required
                />
                <p className="text-xs text-blue-600 mt-1">{tBasic('samePriceForAll')}</p>
              </div>
            ) : (
              // 분리 가격 모드
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">{tBasic('adult')}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={(() => {
                      if (typeof formData.basePrice === 'object' && formData.basePrice) {
                        return formData.basePrice.adult || 0;
                      }
                      return formData.basePriceAdult ?? (typeof formData.basePrice === 'number' ? formData.basePrice : 0);
                    })()}
                    onChange={(e) => {
                      const adultPrice = parseFloat(e.target.value) || 0;
                      const childPrice = typeof formData.basePrice === 'object' && formData.basePrice 
                        ? formData.basePrice.child 
                        : (formData.basePriceChild ?? 0);
                      const infantPrice = typeof formData.basePrice === 'object' && formData.basePrice 
                        ? formData.basePrice.infant 
                        : (formData.basePriceInfant ?? 0);
                      setFormData({ 
                        ...formData, 
                        basePrice: { adult: adultPrice, child: childPrice, infant: infantPrice },
                        basePriceAdult: adultPrice
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">{tBasic('child')}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={(() => {
                      if (typeof formData.basePrice === 'object' && formData.basePrice) {
                        return formData.basePrice.child || 0;
                      }
                      return formData.basePriceChild ?? 0;
                    })()}
                    onChange={(e) => {
                      const childPrice = parseFloat(e.target.value) || 0;
                      const adultPrice = typeof formData.basePrice === 'object' && formData.basePrice 
                        ? formData.basePrice.adult 
                        : (formData.basePriceAdult ?? 0);
                      const infantPrice = typeof formData.basePrice === 'object' && formData.basePrice 
                        ? formData.basePrice.infant 
                        : (formData.basePriceInfant ?? 0);
                      setFormData({ 
                        ...formData, 
                        basePrice: { adult: adultPrice, child: childPrice, infant: infantPrice },
                        basePriceChild: childPrice
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">{tBasic('infant')}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={(() => {
                      if (typeof formData.basePrice === 'object' && formData.basePrice) {
                        return formData.basePrice.infant || 0;
                      }
                      return formData.basePriceInfant ?? 0;
                    })()}
                    onChange={(e) => {
                      const infantPrice = parseFloat(e.target.value) || 0;
                      const adultPrice = typeof formData.basePrice === 'object' && formData.basePrice 
                        ? formData.basePrice.adult 
                        : (formData.basePriceAdult ?? 0);
                      const childPrice = typeof formData.basePrice === 'object' && formData.basePrice 
                        ? formData.basePrice.child 
                        : (formData.basePriceChild ?? 0);
                      setFormData({ 
                        ...formData, 
                        basePrice: { adult: adultPrice, child: childPrice, infant: infantPrice },
                        basePriceInfant: infantPrice
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                    required
                  />
                </div>
              </div>
            )}
          </div>
          {/* 가격 미리보기 */}
          {!isNewProduct && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="space-y-3 text-sm">
                {/* 기본 가격 */}
                <div className="grid grid-cols-3 gap-3 font-medium">
                  <div className="flex justify-between">
                    <span className="text-gray-700">{tBasic('adult')}:</span>
                    <span className="text-gray-900">${(() => {
                      if (typeof formData.basePrice === 'object' && formData.basePrice) {
                        return formData.basePrice.adult || 0;
                      }
                      return formData.basePriceAdult ?? (typeof formData.basePrice === 'number' ? formData.basePrice : 0);
                    })().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">{tBasic('child')}:</span>
                    <span className="text-gray-900">${(() => {
                      if (typeof formData.basePrice === 'object' && formData.basePrice) {
                        return formData.basePrice.child || 0;
                      }
                      return formData.basePriceChild ?? 0;
                    })().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">유아:</span>
                    <span className="text-gray-900">${(() => {
                      if (typeof formData.basePrice === 'object' && formData.basePrice) {
                        return formData.basePrice.infant || 0;
                      }
                      return formData.basePriceInfant ?? 0;
                    })().toFixed(2)}</span>
                  </div>
                </div>
                
                {/* 각 초이스 그룹별 옵션 가격 표시 */}
                {loadingChoices ? (
                  <div className="text-xs text-gray-500">{tBasic('loading')}</div>
                ) : choicesGroups.length > 0 ? (
                  <div className="space-y-3">
                    {choicesGroups.map((group) => (
                      <div key={group.id} className="bg-white rounded p-3 border border-blue-100">
                        <div className="font-medium text-gray-800 mb-2">
                          {group.choice_group_ko || group.choice_group}
                        </div>
                        <div className="space-y-1.5 ml-2">
                          {group.options.length > 0 ? (
                            group.options.map((option) => {
                              const baseAdultPrice = typeof formData.basePrice === 'object' && formData.basePrice 
                                ? formData.basePrice.adult 
                                : (formData.basePriceAdult ?? (typeof formData.basePrice === 'number' ? formData.basePrice : 0));
                              const optionTotal = baseAdultPrice + option.adult_price
                              return (
                                <div 
                                  key={option.id} 
                                  className={`flex items-center justify-between ${
                                    option.is_default ? 'text-blue-600 font-semibold' : 'text-gray-600'
                                  }`}
                                >
                                  <span className="flex items-center">
                                    {option.option_name_ko || option.option_name}
                                    {option.is_default && <span className="ml-1 text-xs text-blue-500">{tBasic('defaultOption')}</span>}
                                  </span>
                                  <span className="text-xs">
                                    ${option.adult_price.toFixed(2)} + ${baseAdultPrice.toFixed(2)} = <span className="font-semibold">${optionTotal.toFixed(2)}</span>
                                  </span>
                                </div>
                              )
                            })
                          ) : (
                            <div className="text-gray-400 text-xs">{tBasic('noOptions')}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500">{tBasic('noChoices')}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 상품 태그 섹션 */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Info className="h-5 w-5 mr-2 text-blue-600" />
          {tBasic('productTags')}
        </h3>
        <TagSelector
          selectedTags={formData.tags || []}
          onTagsChange={handleTagsChange}
          locale={locale}
          placeholder={tBasic('tagsPlaceholder')}
        />
      </div>

      {/* 추가 정보 섹션 */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Info className="h-5 w-5 mr-2 text-blue-600" />
          {tBasic('additionalInfo')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{tBasic('totalTourHours')}</label>
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
            placeholder={tBasic('totalTourHoursPlaceholder')}
            required
          />
          <p className="text-xs text-gray-500 mt-1">{tBasic('totalTourHoursHint')}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{tBasic('maxParticipants')}</label>
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
              placeholder={tBasic('departureTimeSelect')}
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
              <p className="text-xs text-gray-600">{tBasic('selectedDepartureTimes')}</p>
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
          
          <p className="text-xs text-gray-500 mt-1">{tBasic('addDepartureTimeHint')}</p>
        </div>
        </div>
      </div>

      {/* 저장 버튼 섹션 */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Info className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">{tBasic('saveSectionTitle')}</h3>
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
                <span>{tBasic('saving')}</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>{isNewProduct ? tBasic('createProduct') : tBasic('saveBasicInfo')}</span>
              </>
            )}
          </button>
        </div>
        {saveMessage && (
          <div className={`mt-3 p-3 rounded-lg text-sm ${
            saveMessage.includes(tBasic('successKeyword')) 
              ? 'bg-green-100 text-green-800 border border-green-200' 
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            {saveMessage}
          </div>
        )}
        {isNewProduct && (
          <p className="mt-2 text-sm text-gray-500">
            {tBasic('newProductSaveHint')}
          </p>
        )}
      </div>

      {/* 카테고리 관리 모달 */}
      <CategoryManagementModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        categories={categories}
        subCategories={subCategories}
        onCategoriesUpdate={handleCategoriesUpdate}
      />
    </div>
  )
}
