'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Save, Copy, Download, Upload, FileText, Info, Share2, ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

// 임시 타입 정의 (데이터베이스 타입이 없을 때 사용)
interface DatabaseOptions {
  id: string
  name: string
  name_ko?: string
  description?: string
  description_ko?: string
  description_en?: string
  adult_price?: number
  child_price?: number
  infant_price?: number
  status?: string
  sort_order?: number
  image_url?: string
  image_alt?: string
  thumbnail_url?: string
  template_group?: string
  template_group_ko?: string
  template_group_description_ko?: string
  template_group_description_en?: string
  choice_type?: string
  is_required?: boolean
  min_selections?: number
  max_selections?: number
  is_choice_template?: boolean
}

interface ProductChoiceData {
  id: string
  choice_group: string
  choice_group_ko: string
  choice_group_en?: string
  description_ko?: string
  description_en?: string
  choice_type: 'single' | 'multiple' | 'quantity'
  is_required: boolean
  min_selections: number
  max_selections: number
  sort_order: number
  options?: ChoiceOptionData[]
}

interface ChoiceOptionData {
  id: string
  option_key: string
  option_name: string
  option_name_ko: string
  description?: string | undefined
  description_ko?: string | undefined
  adult_price: number
  child_price: number
  infant_price: number
  capacity: number
  is_default: boolean
  is_active: boolean
  sort_order: number
  image_url?: string | undefined
  image_alt?: string | undefined
  thumbnail_url?: string | undefined
}

interface SupabaseError {
  message: string
  details?: string
  hint?: string
  code?: string
}


// 새로운 간결한 초이스 시스템 타입 정의
interface ChoiceOption {
  id: string
  option_key: string
  option_name: string
  option_name_ko: string
  description?: string | undefined
  description_ko?: string | undefined
  adult_price: number
  child_price: number
  infant_price: number
  capacity: number
  is_default: boolean
  is_active: boolean
  sort_order: number
  image_url?: string | undefined
  image_alt?: string | undefined
  thumbnail_url?: string | undefined
}

interface ProductChoice {
  id: string
  choice_group: string
  choice_group_ko: string
  choice_group_en?: string
  description_ko?: string
  description_en?: string
  choice_type: 'single' | 'multiple' | 'quantity'
  is_required: boolean
  min_selections: number
  max_selections: number
  sort_order: number
  options: ChoiceOption[]
}

interface ChoicesTabProps {
  productId: string
  isNewProduct: boolean
}

export default function ChoicesTab({ productId, isNewProduct }: ChoicesTabProps) {
  const [productChoices, setProductChoices] = useState<ProductChoice[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [showTemplateInfoModal, setShowTemplateInfoModal] = useState(false)
  const [showTypeInfoModal, setShowTypeInfoModal] = useState(false)
  const [showExportTemplateModal, setShowExportTemplateModal] = useState(false)
  const [selectedChoiceIds, setSelectedChoiceIds] = useState<Set<string>>(new Set())
  const [uploadingImages, setUploadingImages] = useState<{[key: string]: boolean}>({})
  const [dragOverStates, setDragOverStates] = useState<{[key: string]: boolean}>({})
  const [draggedGroupIndex, setDraggedGroupIndex] = useState<number | null>(null)
  const [allCardsCollapsed, setAllCardsCollapsed] = useState(false)
  const [products, setProducts] = useState<Array<{id: string, name: string, name_ko?: string}>>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [importData, setImportData] = useState('')

  // 템플릿에서 초이스 불러오기
  // 초이스 관리 탭에 있는 아이템만 사용 (is_choice_template = true이고 template_group이 있는 것만)
  const loadFromTemplate = useCallback(async (templateGroup: string) => {
    try {
      // 초이스 관리 탭의 아이템만 가져오기 (옵션 관리 탭의 아이템 제외)
      const { data, error } = await supabase
        .from('options')
        .select('*')
        .eq('is_choice_template', true) // 반드시 초이스 관리 탭의 아이템만
        .not('template_group', 'is', null) // template_group이 있는 것만
        .or(`template_group.eq.${templateGroup},template_group_ko.eq.${templateGroup}`)
        .order('sort_order', { ascending: true }) as { data: DatabaseOptions[] | null, error: SupabaseError | null }

      if (error) {
        console.error('Error loading template:', error)
        return
      }

      // 추가 검증: is_choice_template이 true이고 template_group이 있는 것만 사용
      // 옵션 관리 탭의 아이템(is_choice_template = false)은 제외
      const validData = data?.filter(item => {
        // is_choice_template이 명시적으로 true인지 확인
        if (item.is_choice_template !== true) {
          return false
        }
        // template_group이 존재하고 비어있지 않은지 확인
        if (!item.template_group || (typeof item.template_group === 'string' && item.template_group.trim() === '')) {
          return false
        }
        return true
      }) || []

      // 디버깅: 로드된 데이터 확인
      if (data && data.length > 0) {
        console.log('템플릿 불러오기 - 로드된 데이터:', {
          totalCount: data.length,
          validCount: validData.length,
          firstItem: data[0] ? {
            id: data[0].id,
            name: data[0].name,
            name_ko: data[0].name_ko,
            is_choice_template: data[0].is_choice_template,
            template_group: data[0].template_group,
            template_group_ko: data[0].template_group_ko
          } : null,
          allItems: data.map(item => ({
            id: item.id,
            name: item.name,
            is_choice_template: item.is_choice_template,
            template_group: item.template_group
          }))
        })
      }

      if (validData.length === 0) {
        console.error('템플릿 불러오기 실패: 초이스 관리 탭의 유효한 템플릿이 없습니다.', {
          templateGroup,
          dataCount: data?.length || 0,
          data: data?.map(item => ({
            id: item.id,
            name: item.name,
            is_choice_template: item.is_choice_template,
            template_group: item.template_group
          }))
        })
        alert('템플릿을 불러올 수 없습니다. 초이스 관리 탭에 등록된 템플릿인지 확인해주세요.')
        return
      }

      const firstItem = validData[0] as DatabaseOptions
      // 템플릿을 초이스 그룹으로 변환
      const templateGroupName = firstItem.template_group_ko || firstItem.template_group || '템플릿'
      const choiceType = firstItem.choice_type || 'single'
      const isRequired = firstItem.is_required || false
      const minSelections = firstItem.min_selections || 1
      const maxSelections = firstItem.max_selections || 1
      // 템플릿 그룹 설명 가져오기
      const descriptionKo = firstItem.template_group_description_ko || ''
      const descriptionEn = firstItem.template_group_description_en || ''

      const newChoice: ProductChoice = {
        id: crypto.randomUUID(),
        choice_group: templateGroup,
        choice_group_ko: templateGroupName,
        description_ko: descriptionKo,
        description_en: descriptionEn,
        choice_type: choiceType as 'single' | 'multiple' | 'quantity',
        is_required: isRequired,
        min_selections: minSelections,
        max_selections: maxSelections,
        sort_order: productChoices.length,
        options: validData.map((option: DatabaseOptions) => ({
          id: crypto.randomUUID(),
          option_key: option.id,
          option_name: option.name,
          option_name_ko: option.name_ko || option.name,
          description: option.description_en || option.description || undefined, // 영어 설명 우선, 없으면 내부용 설명
          description_ko: option.description_ko || undefined, // 한글 설명
          adult_price: option.adult_price || 0,
          child_price: option.child_price || 0,
          infant_price: option.infant_price || 0,
          capacity: 1,
          is_default: option.id === firstItem.id, // 첫 번째 초이스를 기본값으로
          is_active: option.status === 'active',
          sort_order: option.sort_order || 0,
          image_url: option.image_url,
          image_alt: option.image_alt,
          thumbnail_url: option.thumbnail_url
        }))
      }

      setProductChoices(prev => [...prev, newChoice])
      setShowTemplateModal(false)
    } catch (error) {
      console.error('Error loading template:', error)
    }
  }, [productChoices.length])

  // 상품 목록 로드
  const loadProducts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, name_ko')
        .neq('id', productId) // 현재 상품 제외
        .order('name', { ascending: true })

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('상품 목록 로드 오류:', error)
    }
  }, [productId])

  // 새로운 간결한 초이스 시스템에서 상품의 choices 정보 로드
  const loadProductChoices = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('product_choices')
        .select(`
          id,
          choice_group,
          choice_group_ko,
          choice_group_en,
          description_ko,
          description_en,
          choice_type,
          is_required,
          min_selections,
          max_selections,
          sort_order,
          options:choice_options (
            id,
            option_key,
            option_name,
            option_name_ko,
            description,
            description_ko,
            adult_price,
            child_price,
            infant_price,
            capacity,
            is_default,
            is_active,
            sort_order,
            image_url,
            image_alt,
            thumbnail_url
          )
        `)
        .eq('product_id', productId)
        .order('sort_order', { ascending: true }) as { data: ProductChoiceData[] | null, error: SupabaseError | null }

      if (error) {
        console.error('Choices 로드 오류:', error)
        setSaveMessage('Choices 로드 중 오류가 발생했습니다.')
        return
      }

      console.log('ChoicesTab에서 로드된 product choices:', data)
      const convertedChoices: ProductChoice[] = (data || []).map(choice => ({
        ...choice,
        choice_type: choice.choice_type as 'single' | 'multiple' | 'quantity',
        options: (choice.options || []).map(option => ({
          ...option,
          image_url: option.image_url || undefined,
          image_alt: option.image_alt || undefined,
          thumbnail_url: option.thumbnail_url || undefined
        }))
      }))
      setProductChoices(convertedChoices)
    } catch (error) {
      console.error('Choices 로드 오류:', error)
      setSaveMessage('Choices 로드 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [productId])

  // 초이스 그룹 저장
  const saveChoices = useCallback(async () => {
    if (!productId) return

    setSaving(true)
    setSaveMessage('')

    // 현재 데이터 백업 (저장 실패 시 복구용)
    let backupData: ProductChoice[] = []
    try {
      const backup = await supabase
        .from('product_choices')
        .select(`
          id,
          choice_group,
          choice_group_ko,
          choice_group_en,
          description_ko,
          description_en,
          choice_type,
          is_required,
          min_selections,
          max_selections,
          sort_order,
          options:choice_options (
            id,
            option_key,
            option_name,
            option_name_ko,
            description,
            description_ko,
            adult_price,
            child_price,
            infant_price,
            capacity,
            is_default,
            is_active,
            sort_order,
            image_url,
            image_alt,
            thumbnail_url
          )
        `)
        .eq('product_id', productId)
        .order('sort_order', { ascending: true }) as { data: ProductChoiceData[] | null, error: SupabaseError | null }
      
      if (!backup.error && backup.data) {
        backupData = backup.data.map(choice => ({
          ...choice,
          choice_type: choice.choice_type as 'single' | 'multiple' | 'quantity',
          options: (choice.options || []).map(option => ({
            ...option,
            image_url: option.image_url || undefined,
            image_alt: option.image_alt || undefined,
            thumbnail_url: option.thumbnail_url || undefined
          }))
        }))
      }
    } catch (backupError) {
      console.error('백업 데이터 로드 오류:', backupError)
      // 백업 실패해도 계속 진행
    }

    try {
      // choice_group_ko를 기반으로 choice_group 자동 생성
      const processedChoices = productChoices.map(choice => {
        const trimmedKo = choice.choice_group_ko?.trim() || ''
        let generatedGroup = choice.choice_group?.trim() || ''
        
        // choice_group_ko가 있고 choice_group가 임시값이거나 비어있으면 자동 생성
        if (trimmedKo && (!generatedGroup || generatedGroup.startsWith('choice_group_'))) {
          // 한국어 이름을 URL-friendly ID로 변환
          // 영문, 숫자만 추출하고 나머지는 언더스코어로 변환
          generatedGroup = trimmedKo
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '_') // 영문, 숫자만 허용, 나머지는 언더스코어
            .replace(/_+/g, '_') // 연속된 언더스코어를 하나로
            .replace(/^_|_$/g, '') // 앞뒤 언더스코어 제거
            .substring(0, 50) // 최대 50자로 제한
          
          // 빈 문자열이거나 너무 짧으면 타임스탬프 사용
          if (!generatedGroup || generatedGroup.length < 2) {
            generatedGroup = `choice_group_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
          }
        }
        
        return {
          ...choice,
          choice_group: generatedGroup
        }
      })

      // 유효성 검사: choice_group_ko가 비어있지 않은지 확인 (choice_group는 자동 생성됨)
      const invalidChoices = processedChoices.filter(
        choice => !choice.choice_group_ko || !choice.choice_group_ko.trim()
      )
      
      if (invalidChoices.length > 0) {
        // 어떤 그룹이 문제인지 확인
        const invalidIndices = invalidChoices.map(invalid => {
          const index = processedChoices.indexOf(invalid)
          return index + 1
        })
        setSaveMessage(`초이스 그룹 ${invalidIndices.join(', ')}번의 이름(한국어)을 입력해주세요.`)
        setSaving(false)
        return
      }

      // 중복 검사: 같은 product_id와 choice_group 조합이 있는지 확인
      const choiceGroups = processedChoices.map(c => c.choice_group.trim().toLowerCase())
      const duplicates = choiceGroups.filter((group, index) => choiceGroups.indexOf(group) !== index)
      
      if (duplicates.length > 0) {
        setSaveMessage('중복된 초이스 그룹명이 있습니다. 각 그룹의 이름은 고유해야 합니다.')
        setSaving(false)
        return
      }

      // 기존 choices 삭제 - 유효한 UUID만 필터링
      const validIds = productChoices
        .map(pc => pc.id)
        .filter(id => !id.startsWith('temp_') && id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i))
      
      if (validIds.length > 0) {
        await supabase
          .from('choice_options')
          .delete()
          .in('choice_id', validIds)
      }

      await supabase
        .from('product_choices')
        .delete()
        .eq('product_id', productId)

      // 새로운 choices 저장 (processedChoices 사용)
      for (let index = 0; index < processedChoices.length; index++) {
        const choice = processedChoices[index]
        // choice_group와 choice_group_ko 확인
        const trimmedChoiceGroup = choice.choice_group.trim()
        const trimmedChoiceGroupKo = choice.choice_group_ko.trim()
        
        if (!trimmedChoiceGroup || !trimmedChoiceGroupKo) {
          throw new Error('초이스 그룹명은 필수입니다.')
        }

        const { data: choiceData, error: choiceError } = await (supabase as unknown as {
          from: (table: string) => {
            insert: (data: Record<string, unknown>) => {
              select: () => { single: () => Promise<{ data: ProductChoiceData, error: SupabaseError | null }> }
            }
          }
        })
          .from('product_choices')
          .insert({
            product_id: productId,
            choice_group: trimmedChoiceGroup,
            choice_group_ko: trimmedChoiceGroupKo,
            choice_group_en: choice.choice_group_en?.trim() || null,
            description_ko: choice.description_ko?.trim() || null,
            description_en: choice.description_en?.trim() || null,
            choice_type: choice.choice_type,
            is_required: choice.is_required,
            min_selections: choice.min_selections,
            max_selections: choice.max_selections,
            sort_order: choice.sort_order !== undefined ? choice.sort_order : index
          })
          .select()
          .single() as { data: ProductChoiceData, error: SupabaseError | null }

        if (choiceError) throw choiceError

        // 초이스들 저장
        if (choice.options && choice.options.length > 0) {
          const optionsToInsert = choice.options.map(option => ({
            choice_id: choiceData.id,
            option_key: option.option_key,
            option_name: option.option_name,
            option_name_ko: option.option_name_ko,
            description: option.description,
            description_ko: option.description_ko,
            adult_price: option.adult_price,
            child_price: option.child_price,
            infant_price: option.infant_price,
            capacity: option.capacity,
            is_default: option.is_default,
            is_active: option.is_active,
            sort_order: option.sort_order,
            image_url: option.image_url,
            image_alt: option.image_alt,
            thumbnail_url: option.thumbnail_url
          }))

          const { error: optionsError } = await (supabase as unknown as {
            from: (table: string) => {
              insert: (data: Record<string, unknown>[]) => Promise<{ error: SupabaseError | null }>
            }
          })
            .from('choice_options')
            .insert(optionsToInsert)

          if (optionsError) throw optionsError
        }
      }

      setSaveMessage('초이스가 성공적으로 저장되었습니다.')
      
      // 저장 성공 후 데이터 다시 로드
      try {
        await loadProductChoices()
      } catch (loadError) {
        console.error('Choices 재로드 오류:', loadError)
        // 로드 실패해도 저장은 성공했으므로 경고만 표시
        setSaveMessage('초이스가 저장되었지만 새로고침이 필요할 수 있습니다.')
      }
    } catch (error) {
      console.error('Choices 저장 오류:', error)
      const errorMessage = error instanceof Error ? error.message : '초이스 저장 중 오류가 발생했습니다.'
      setSaveMessage(`초이스 저장 중 오류가 발생했습니다: ${errorMessage}`)
      
      // 저장 실패 시 백업된 데이터로 복구
      if (backupData.length > 0) {
        setProductChoices(backupData)
        setSaveMessage('저장 중 오류가 발생했습니다. 이전 데이터로 복구되었습니다.')
      } else {
        // 백업 데이터가 없으면 서버에서 다시 로드 시도
        try {
          await loadProductChoices()
        } catch (loadError) {
          console.error('Choices 재로드 오류:', loadError)
        }
      }
    } finally {
      setSaving(false)
    }
  }, [productId, productChoices, loadProductChoices])

  // 초이스 그룹 추가
  const addChoiceGroup = useCallback(() => {
    const newGroup: ProductChoice = {
      id: `temp_${Date.now()}`,
      choice_group: `choice_group_${Date.now()}`, // 빈 문자열 대신 임시 고유값 사용
      choice_group_ko: '',
      choice_group_en: '',
      description_ko: '',
      description_en: '',
      choice_type: 'single',
      is_required: true,
      min_selections: 1,
      max_selections: 1,
      sort_order: productChoices.length,
      options: []
    }
    setProductChoices(prev => [...prev, newGroup])
  }, [productChoices.length])

  // 초이스 그룹 삭제
  const removeChoiceGroup = useCallback((index: number) => {
    setProductChoices(prev => prev.filter((_, i) => i !== index))
  }, [])

  // 초이스 그룹 업데이트
  const updateChoiceGroup = useCallback((index: number, field: keyof ProductChoice, value: string | number | boolean) => {
    setProductChoices(prev => prev.map((group, i) => 
      i === index ? { ...group, [field]: value } : group
    ))
  }, [])

  // 초이스 그룹 순서 변경
  const moveChoiceGroup = useCallback((fromIndex: number, toIndex: number) => {
    setProductChoices(prev => {
      const newChoices = [...prev]
      const [moved] = newChoices.splice(fromIndex, 1)
      newChoices.splice(toIndex, 0, moved)
      // sort_order 업데이트
      return newChoices.map((choice, index) => ({
        ...choice,
        sort_order: index
      }))
    })
  }, [])

  // 초이스 추가
  const addChoiceOption = useCallback((groupIndex: number) => {
    const existingOptions = productChoices[groupIndex]?.options || []
    const nextOptionNumber = existingOptions.length + 1
    const newOption: ChoiceOption = {
      id: `temp_option_${Date.now()}`,
      option_key: `option_${nextOptionNumber}`,
      option_name: '',
      option_name_ko: '',
      description: undefined,
      description_ko: undefined,
      adult_price: 0,
      child_price: 0,
      infant_price: 0,
      capacity: 1,
      is_default: false,
      is_active: true,
      sort_order: existingOptions.length,
      image_url: undefined,
      image_alt: undefined,
      thumbnail_url: undefined
    }
    
    setProductChoices(prev => prev.map((group, i) => 
      i === groupIndex 
        ? { ...group, options: [...group.options, newOption] }
        : group
    ))
  }, [productChoices])

  // 초이스 삭제
  const removeChoiceOption = useCallback((groupIndex: number, optionIndex: number) => {
    setProductChoices(prev => prev.map((group, i) => 
      i === groupIndex 
        ? { ...group, options: group.options.filter((_, j) => j !== optionIndex) }
        : group
    ))
  }, [])

  // 초이스 옵션 복사
  const copyChoiceOption = useCallback((groupIndex: number, optionIndex: number) => {
    setProductChoices(prev => prev.map((group, i) => {
      if (i !== groupIndex) return group
      
      const sortedOptions = [...group.options].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      const optionToCopy = sortedOptions[optionIndex]
      
      if (!optionToCopy) return group
      
      const newOption: ChoiceOption = {
        ...optionToCopy,
        id: `temp_option_${Date.now()}_${Math.random()}`,
        option_key: `${optionToCopy.option_key}_copy_${Date.now()}`,
        sort_order: sortedOptions.length, // 맨 마지막에 추가
        is_default: false // 복사본은 기본값 해제
      }
      
      return { ...group, options: [...group.options, newOption] }
    }))
  }, [])

  // 초이스 옵션 순서 변경
  const moveChoiceOption = useCallback((groupIndex: number, optionIndex: number, direction: 'up' | 'down') => {
    setProductChoices(prev => prev.map((group, i) => {
      if (i !== groupIndex) return group
      
      const sortedOptions = [...group.options].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      
      if (direction === 'up' && optionIndex === 0) return group
      if (direction === 'down' && optionIndex === sortedOptions.length - 1) return group
      
      const targetIndex = direction === 'up' ? optionIndex - 1 : optionIndex + 1
      const [moved] = sortedOptions.splice(optionIndex, 1)
      sortedOptions.splice(targetIndex, 0, moved)
      
      // sort_order 업데이트
      const updatedOptions = sortedOptions.map((opt, idx) => ({
        ...opt,
        sort_order: idx
      }))
      
      return { ...group, options: updatedOptions }
    }))
  }, [])

  // 초이스 업데이트
  const updateChoiceOption = useCallback((groupIndex: number, optionIndex: number, field: keyof ChoiceOption, value: string | number | boolean) => {
    setProductChoices(prev => prev.map((group, i) => 
      i === groupIndex 
        ? { 
            ...group, 
            options: group.options.map((option, j) => 
              j === optionIndex ? { ...option, [field]: value } : option
            )
          }
        : group
    ))
  }, [])


  // 이미지 업로드 처리 함수
  const handleImageUpload = useCallback(async (file: File, groupIndex: number, optionIndex: number) => {
    const uploadKey = `${groupIndex}-${optionIndex}`
    setUploadingImages(prev => ({ ...prev, [uploadKey]: true }))
    
    try {
      // 파일 크기 체크 (5MB 제한)
      if (file.size > 5 * 1024 * 1024) {
        alert('파일 크기는 5MB를 초과할 수 없습니다.')
        return
      }

      // 파일 타입 체크
      if (!file.type.startsWith('image/')) {
        alert('이미지 파일만 업로드할 수 있습니다.')
        return
      }

      // 버킷 확인
      const bucketName = 'product-media'
      const { data: buckets, error: listError } = await supabase.storage.listBuckets()
      
      if (listError) {
        console.error('버킷 목록 조회 오류:', listError)
        alert('저장소를 확인할 수 없습니다. 관리자에게 문의하세요.')
        return
      }

      const bucketExists = buckets?.some(bucket => bucket.name === bucketName)
      if (!bucketExists) {
        alert(`'${bucketName}' 버킷이 존재하지 않습니다. 관리자에게 문의하여 버킷을 생성해주세요.`)
        return
      }

      // Supabase Storage에 업로드
      const fileName = `choice-options/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      const { error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        console.error('이미지 업로드 오류:', error)
        alert(`이미지 업로드 중 오류가 발생했습니다: ${error.message}`)
        return
      }

      // 업로드된 이미지의 공개 URL 가져오기
      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName)

      // 이미지 URL과 alt 텍스트 업데이트
      updateChoiceOption(groupIndex, optionIndex, 'image_url', urlData.publicUrl)
      updateChoiceOption(groupIndex, optionIndex, 'image_alt', file.name)
    } catch (error) {
      console.error('이미지 업로드 오류:', error)
      alert(`이미지 업로드 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    } finally {
      setUploadingImages(prev => ({ ...prev, [uploadKey]: false }))
    }
  }, [updateChoiceOption])


  // 초이스 복사
  const copyChoicesFromProduct = useCallback(async () => {
    if (!selectedProductId) return

    try {
      const { data, error } = await supabase
        .from('product_choices')
        .select(`
          choice_group,
          choice_group_ko,
          choice_type,
          is_required,
          min_selections,
          max_selections,
          sort_order,
          options:choice_options (
            option_key,
            option_name,
            option_name_ko,
            adult_price,
            child_price,
            infant_price,
            capacity,
            is_default,
            is_active,
            sort_order
          )
        `)
        .eq('product_id', selectedProductId)
        .order('sort_order') as { data: ProductChoiceData[] | null, error: SupabaseError | null }

      if (error) throw error

        const copiedChoices: ProductChoice[] = (data || []).map((choice: ProductChoiceData) => ({
          id: `temp_${Date.now()}_${Math.random()}`,
          choice_group: choice.choice_group,
          choice_group_ko: choice.choice_group_ko,
          ...(choice.choice_group_en !== undefined && { choice_group_en: choice.choice_group_en }),
          ...(choice.description_ko !== undefined && { description_ko: choice.description_ko }),
          ...(choice.description_en !== undefined && { description_en: choice.description_en }),
          choice_type: choice.choice_type as 'single' | 'multiple' | 'quantity',
          is_required: choice.is_required,
          min_selections: choice.min_selections,
          max_selections: choice.max_selections,
            sort_order: choice.sort_order || index,
          options: (choice.options || []).map((option: ChoiceOptionData) => ({
          id: `temp_option_${Date.now()}_${Math.random()}`,
          option_key: option.option_key,
          option_name: option.option_name,
          option_name_ko: option.option_name_ko,
          description: option.description || undefined,
          description_ko: option.description_ko || undefined,
          adult_price: option.adult_price,
          child_price: option.child_price,
          infant_price: option.infant_price,
          capacity: option.capacity,
          is_default: option.is_default,
          is_active: option.is_active,
          sort_order: option.sort_order,
          image_url: option.image_url,
          image_alt: option.image_alt,
          thumbnail_url: option.thumbnail_url
        }))
      }))

      setProductChoices(prev => [...prev, ...copiedChoices])
      setShowCopyModal(false)
      setSelectedProductId('')
    } catch (error) {
      console.error('초이스 복사 오류:', error)
      setSaveMessage('초이스 복사 중 오류가 발생했습니다.')
    }
  }, [selectedProductId])

  // 초이스 내보내기
  const exportChoices = useCallback(() => {
    const exportData = {
      product_id: productId,
      choices: productChoices.map(choice => ({
        choice_group: choice.choice_group,
        choice_group_ko: choice.choice_group_ko,
        choice_group_en: choice.choice_group_en,
        description_ko: choice.description_ko,
        description_en: choice.description_en,
        choice_type: choice.choice_type,
        is_required: choice.is_required,
        min_selections: choice.min_selections,
        max_selections: choice.max_selections,
            sort_order: choice.sort_order || index,
        options: choice.options.map(option => ({
          option_key: option.option_key,
          option_name: option.option_name,
          option_name_ko: option.option_name_ko,
          description: option.description,
          description_ko: option.description_ko,
          adult_price: option.adult_price,
          child_price: option.child_price,
          infant_price: option.infant_price,
          capacity: option.capacity,
          is_default: option.is_default,
          is_active: option.is_active,
          sort_order: option.sort_order,
          image_url: option.image_url,
          image_alt: option.image_alt,
          thumbnail_url: option.thumbnail_url
        }))
      }))
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `choices_${productId}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [productId, productChoices])

  // 초이스 가져오기
  const importChoices = useCallback(() => {
    try {
      const data = JSON.parse(importData)
      if (data.choices && Array.isArray(data.choices)) {
        const importedChoices: ProductChoice[] = data.choices.map((choice: ProductChoiceData, index: number) => ({
          id: `temp_${Date.now()}_${index}`,
          choice_group: choice.choice_group || '',
          choice_group_ko: choice.choice_group_ko || '',
          choice_group_en: choice.choice_group_en || '',
          description_ko: choice.description_ko || '',
          description_en: choice.description_en || '',
          choice_type: (choice.choice_type || 'single') as 'single' | 'multiple' | 'quantity',
          is_required: choice.is_required !== false,
          min_selections: choice.min_selections || 1,
          max_selections: choice.max_selections || 1,
          sort_order: choice.sort_order || index,
          options: (choice.options || []).map((option: ChoiceOptionData, optionIndex: number) => ({
            id: `temp_option_${Date.now()}_${index}_${optionIndex}`,
            option_key: option.option_key || '',
            option_name: option.option_name || '',
            option_name_ko: option.option_name_ko || '',
            description: option.description || undefined,
            description_ko: option.description_ko || undefined,
            adult_price: option.adult_price || 0,
            child_price: option.child_price || 0,
            infant_price: option.infant_price || 0,
            capacity: option.capacity || 1,
            is_default: option.is_default || false,
            is_active: option.is_active !== false,
            sort_order: option.sort_order || optionIndex,
            image_url: option.image_url,
            image_alt: option.image_alt,
            thumbnail_url: option.thumbnail_url
          }))
        }))

        setProductChoices(prev => [...prev, ...importedChoices])
        setShowImportModal(false)
        setImportData('')
      }
    } catch (error) {
      console.error('초이스 가져오기 오류:', error)
      setSaveMessage('초이스 가져오기 중 오류가 발생했습니다.')
    }
  }, [importData])

  // 초이스를 템플릿으로 내보내기
  const exportChoicesAsTemplates = useCallback(async (selectedIds?: Set<string>) => {
    const choicesToExport = selectedIds && selectedIds.size > 0
      ? productChoices.filter(choice => selectedIds.has(choice.id))
      : productChoices

    if (choicesToExport.length === 0) {
      alert('내보낼 초이스가 없습니다.')
      return
    }

    try {
      // 상품 정보 가져오기
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('name, name_ko')
        .eq('id', productId)
        .single()

      if (productError) {
        console.error('Error fetching product:', productError)
        setSaveMessage('상품 정보를 가져오는 중 오류가 발생했습니다.')
        return
      }

      // 각 초이스 그룹을 템플릿으로 변환
      let exportedCount = 0
      for (const choice of choicesToExport) {
        const templateGroupKo = choice.choice_group_ko || choice.choice_group || '템플릿'
        // template_group은 영문 키로 변환 (URL-friendly)
        const templateGroup = choice.choice_group || 
          templateGroupKo
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
            .substring(0, 50) || 'template'

        // 템플릿 그룹이 이미 존재하는지 확인 (template_group 또는 template_group_ko로 검색)
        const { data: existingTemplate } = await supabase
          .from('options')
          .select('id')
          .eq('is_choice_template', true)
          .or(`template_group.eq.${templateGroup},template_group_ko.eq.${templateGroupKo}`)
          .limit(1)

        if (existingTemplate && existingTemplate.length > 0) {
          // 이미 존재하는 경우 업데이트할지 물어보기
          if (!confirm(`템플릿 "${templateGroupKo}"이 이미 존재합니다. 덮어쓰시겠습니까?`)) {
            continue
          }
          // 기존 템플릿 삭제
          await supabase
            .from('options')
            .delete()
            .eq('is_choice_template', true)
            .or(`template_group.eq.${templateGroup},template_group_ko.eq.${templateGroupKo}`)
        }

        // 각 옵션을 템플릿으로 변환
        for (const option of choice.options || []) {
          const newTemplate = {
            id: crypto.randomUUID(),
            name: option.option_name || option.option_name_ko || '템플릿',
            name_ko: option.option_name_ko || option.option_name || '템플릿',
            description: option.description || null,
            description_ko: option.description_ko || null,
            description_en: null,
            category: null,
            adult_price: option.adult_price || 0,
            child_price: option.child_price || 0,
            infant_price: option.infant_price || 0,
            price_type: 'per_person',
            status: option.is_active ? 'active' : 'inactive',
            tags: [],
            is_choice_template: true,
            choice_type: choice.choice_type,
            min_selections: choice.min_selections,
            max_selections: choice.max_selections,
            template_group: choice.choice_group,
            template_group_ko: templateGroupKo,
            is_required: choice.is_required,
            sort_order: option.sort_order || 0,
            image_url: option.image_url || null,
            image_alt: option.image_alt || null,
            thumbnail_url: option.thumbnail_url || null
          }

          const { error } = await supabase
            .from('options')
            .insert([newTemplate])

          if (error) {
            console.error('Error exporting template:', error)
          } else {
            exportedCount++
          }
        }
      }

      setSaveMessage(`${exportedCount}개의 초이스가 템플릿으로 성공적으로 내보내졌습니다. 옵션 관리 > 초이스 관리에서 확인할 수 있습니다.`)
      setShowExportTemplateModal(false)
      setSelectedChoiceIds(new Set())
    } catch (error) {
      console.error('Error exporting choices as templates:', error)
      setSaveMessage('템플릿 내보내기 중 오류가 발생했습니다.')
    }
  }, [productChoices, productId])

  useEffect(() => {
    if (productId && !isNewProduct) {
      loadProductChoices()
      loadProducts()
    }
  }, [productId, isNewProduct, loadProductChoices, loadProducts])

  // 전역 복사 붙여넣기 이벤트 리스너
  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.startsWith('image/')) {
          // 현재 포커스된 드래그 앤 드롭 영역 찾기
          const activeElement = document.activeElement
          if (activeElement && activeElement.getAttribute('data-upload-area')) {
            const uploadKey = activeElement.getAttribute('data-upload-area')
            if (uploadKey) {
              const [groupIndex, optionIndex] = uploadKey.split('-').map(Number)
              e.preventDefault()
              const file = item.getAsFile()
              if (file) {
                await handleImageUpload(file, groupIndex, optionIndex)
              }
            }
          }
          break
        }
      }
    }

    document.addEventListener('paste', handleGlobalPaste)
    return () => {
      document.removeEventListener('paste', handleGlobalPaste)
    }
  }, [handleImageUpload])

  if (isNewProduct) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">초이스 관리</h3>
        <p className="text-gray-600">상품을 먼저 저장한 후 초이스를 설정할 수 있습니다.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-gray-900">초이스 관리</h3>
          <p className="text-sm text-gray-600">상품의 선택 초이스를 관리합니다.</p>
        </div>
        <div className="flex space-x-2">
          <div className="flex items-center">
            <button
              onClick={() => setShowTemplateModal(true)}
              className="flex items-center px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <FileText className="w-4 h-4 mr-2" />
              템플릿 불러오기
            </button>
            <button
              type="button"
              onClick={() => setShowTemplateInfoModal(true)}
              className="ml-2 inline-flex items-center justify-center w-8 h-8 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-full transition-colors"
              title="템플릿 설명 보기"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => setShowExportTemplateModal(true)}
            className="flex items-center px-3 py-2 text-sm text-green-700 bg-white border border-green-300 rounded-md hover:bg-green-50"
          >
            <Share2 className="w-4 h-4 mr-2" />
            템플릿으로 내보내기
          </button>
          <button
            onClick={() => setShowCopyModal(true)}
            className="flex items-center px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <Copy className="w-4 h-4 mr-2" />
            복사
          </button>
          <button
            onClick={exportChoices}
            className="flex items-center px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <Download className="w-4 h-4 mr-2" />
            내보내기
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <Upload className="w-4 h-4 mr-2" />
            가져오기
          </button>
          <button
            onClick={addChoiceGroup}
            className="flex items-center px-3 py-2 text-sm text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            초이스 그룹 추가
          </button>
        </div>
      </div>

      {/* 저장 메시지 */}
      {saveMessage && (
        <div className={`p-4 rounded-md ${
          saveMessage.includes('오류') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
        }`}>
          {saveMessage}
        </div>
      )}

      {/* 초이스 그룹 목록 */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">초이스를 불러오는 중...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {productChoices.map((choice, groupIndex) => (
            <div 
              key={choice.id} 
              className={`border border-gray-200 rounded-lg p-4 transition-all ${
                draggedGroupIndex === groupIndex ? 'opacity-50' : ''
              } ${draggedGroupIndex !== null && draggedGroupIndex !== groupIndex ? 'hover:border-blue-300' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (draggedGroupIndex !== null && draggedGroupIndex !== groupIndex) {
                  moveChoiceGroup(draggedGroupIndex, groupIndex)
                }
                setDraggedGroupIndex(null)
              }}
            >
              {/* 초이스 그룹 헤더 */}
              <div className="flex justify-between items-start mb-4">
                <div 
                  className="flex items-center space-x-2 mr-2 cursor-move hover:text-gray-600 transition-colors" 
                  title="드래그하여 순서 변경"
                  draggable
                  onDragStart={(e) => {
                    setDraggedGroupIndex(groupIndex)
                    e.dataTransfer.effectAllowed = 'move'
                    e.stopPropagation()
                  }}
                  onDragEnd={() => {
                    setDraggedGroupIndex(null)
                  }}
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                  </svg>
                </div>
                <div className="flex-1 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        초이스 그룹명 (한국어)
                      </label>
                      <input
                        type="text"
                        value={choice.choice_group_ko}
                        onChange={(e) => updateChoiceGroup(groupIndex, 'choice_group_ko', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="예: 숙박 선택"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        초이스 그룹명 (영어)
                      </label>
                      <input
                        type="text"
                        value={choice.choice_group_en || ''}
                        onChange={(e) => updateChoiceGroup(groupIndex, 'choice_group_en', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="예: Accommodation"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        초이스 타입
                        <button
                          type="button"
                          onClick={() => setShowTypeInfoModal(true)}
                          className="ml-2 inline-flex items-center justify-center w-4 h-4 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-full transition-colors"
                          title="초이스 타입 설명 보기"
                        >
                          <Info className="w-3 h-3" />
                        </button>
                      </label>
                      <select
                        value={choice.choice_type}
                        onChange={(e) => updateChoiceGroup(groupIndex, 'choice_type', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="single">단일 선택</option>
                        <option value="multiple">다중 선택</option>
                        <option value="quantity">수량 선택</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        설명 (한국어)
                      </label>
                      <textarea
                        value={choice.description_ko || ''}
                        onChange={(e) => updateChoiceGroup(groupIndex, 'description_ko', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        placeholder="초이스 그룹에 대한 설명을 입력하세요 (한국어)"
                        rows={3}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        설명 (영어)
                      </label>
                      <textarea
                        value={choice.description_en || ''}
                        onChange={(e) => updateChoiceGroup(groupIndex, 'description_en', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        placeholder="Enter description for this choice group (English)"
                        rows={3}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4 ml-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={choice.is_required}
                      onChange={(e) => updateChoiceGroup(groupIndex, 'is_required', e.target.checked)}
                      className="mr-2"
                    />
                    필수 선택
                  </label>
                  <button
                    onClick={() => removeChoiceGroup(groupIndex)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 초이스 목록 */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-medium text-gray-700">초이스</h4>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setAllCardsCollapsed(!allCardsCollapsed)}
                      className="flex items-center px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 rounded border border-gray-200"
                    >
                      {allCardsCollapsed ? (
                        <>
                          <ChevronDown className="w-3 h-3 mr-1" />
                          상세보기
                        </>
                      ) : (
                        <>
                          <ChevronUp className="w-3 h-3 mr-1" />
                          접어보기
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => addChoiceOption(groupIndex)}
                      className="flex items-center px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      초이스 추가
                    </button>
                  </div>
                </div>

                {/* 세로형 카드뷰 그리드 레이아웃 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                 {[...choice.options].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map((option, optionIndex) => {
                   const sortedOptions = [...choice.options].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                   const actualIndex = sortedOptions.findIndex(opt => opt.id === option.id)
                   const isFirst = actualIndex === 0
                   const isLast = actualIndex === sortedOptions.length - 1
                   return (
                   <div key={option.id} className="bg-white rounded-2xl border border-gray-100 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group flex flex-col">
                     {/* 이미지 섹션 (상단) */}
                     <div className="relative w-full h-48 bg-gray-100">
                       {option.image_url ? (
                         <div 
                           className="relative w-full h-full"
                           onDragOver={(e) => {
                             e.preventDefault()
                             e.stopPropagation()
                             setDragOverStates(prev => ({ ...prev, [`${groupIndex}-${optionIndex}`]: true }))
                           }}
                           onDragLeave={(e) => {
                             e.preventDefault()
                             e.stopPropagation()
                             setDragOverStates(prev => ({ ...prev, [`${groupIndex}-${optionIndex}`]: false }))
                           }}
                           onDrop={async (e) => {
                             e.preventDefault()
                             e.stopPropagation()
                             setDragOverStates(prev => ({ ...prev, [`${groupIndex}-${optionIndex}`]: false }))
                             
                             const files = Array.from(e.dataTransfer.files)
                             const imageFiles = files.filter(file => file.type.startsWith('image/'))
                             
                             if (imageFiles.length > 0) {
                               await handleImageUpload(imageFiles[0], groupIndex, optionIndex)
                             }
                           }}
                         >
                           <Image
                             src={option.image_url}
                             alt={option.image_alt || option.option_name_ko}
                             fill
                             sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                             className={`object-cover transition-all ${
                               dragOverStates[`${groupIndex}-${actualIndex}`]
                                 ? 'scale-105 brightness-110'
                                 : ''
                             }`}
                           />
                           {dragOverStates[`${groupIndex}-${actualIndex}`] && (
                             <div className="absolute inset-0 bg-blue-500 bg-opacity-30 flex items-center justify-center z-10">
                               <p className="text-sm font-medium text-white bg-blue-600 px-4 py-2 rounded-lg">이미지 놓기</p>
                             </div>
                           )}
                           {/* 이미지 편집 버튼 */}
                           <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <input
                               type="file"
                               accept="image/*"
                               disabled={uploadingImages[`${groupIndex}-${actualIndex}`]}
                               onChange={async (e) => {
                                 const file = e.target.files?.[0]
                                 if (file) {
                                   await handleImageUpload(file, groupIndex, actualIndex)
                                   e.target.value = ''
                                 }
                               }}
                               className="hidden"
                               id={`file-upload-${groupIndex}-${actualIndex}`}
                             />
                             <button
                               onClick={() => {
                                 if (!uploadingImages[`${groupIndex}-${actualIndex}`]) {
                                   document.getElementById(`file-upload-${groupIndex}-${actualIndex}`)?.click()
                                 }
                               }}
                               className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md"
                               title="이미지 변경"
                             >
                               <Upload className="w-4 h-4" />
                             </button>
                             <button
                               onClick={() => {
                                 updateChoiceOption(groupIndex, actualIndex, 'image_url', '')
                                 updateChoiceOption(groupIndex, actualIndex, 'image_alt', '')
                               }}
                               className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-md"
                               title="이미지 삭제"
                             >
                               <Trash2 className="w-4 h-4" />
                             </button>
                           </div>
                         </div>
                       ) : (
                         <div 
                           className={`w-full h-full border-2 border-dashed transition-all flex items-center justify-center ${
                             dragOverStates[`${groupIndex}-${actualIndex}`]
                               ? 'border-blue-400 bg-blue-50'
                               : 'border-gray-200 bg-gray-50'
                           } ${uploadingImages[`${groupIndex}-${actualIndex}`] ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
                           onDragOver={(e) => {
                             e.preventDefault()
                             e.stopPropagation()
                             setDragOverStates(prev => ({ ...prev, [`${groupIndex}-${actualIndex}`]: true }))
                           }}
                           onDragLeave={(e) => {
                             e.preventDefault()
                             e.stopPropagation()
                             setDragOverStates(prev => ({ ...prev, [`${groupIndex}-${actualIndex}`]: false }))
                           }}
                           onDrop={async (e) => {
                             e.preventDefault()
                             e.stopPropagation()
                             setDragOverStates(prev => ({ ...prev, [`${groupIndex}-${actualIndex}`]: false }))
                             
                             const files = Array.from(e.dataTransfer.files)
                             const imageFiles = files.filter(file => file.type.startsWith('image/'))
                             
                             if (imageFiles.length > 0) {
                               await handleImageUpload(imageFiles[0], groupIndex, actualIndex)
                             }
                           }}
                           onClick={() => {
                             if (!uploadingImages[`${groupIndex}-${actualIndex}`]) {
                               document.getElementById(`file-upload-${groupIndex}-${actualIndex}`)?.click()
                             }
                           }}
                         >
                           <input
                             type="file"
                             accept="image/*"
                             disabled={uploadingImages[`${groupIndex}-${actualIndex}`]}
                             onChange={async (e) => {
                               const file = e.target.files?.[0]
                               if (file) {
                                 await handleImageUpload(file, groupIndex, actualIndex)
                                 e.target.value = ''
                               }
                             }}
                             className="hidden"
                             id={`file-upload-${groupIndex}-${actualIndex}`}
                           />
                           {uploadingImages[`${groupIndex}-${actualIndex}`] ? (
                             <div className="flex flex-col items-center justify-center">
                               <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                               <p className="text-sm text-blue-600 font-medium">업로드 중...</p>
                             </div>
                           ) : (
                             <div className="flex flex-col items-center justify-center">
                               <Upload className="w-8 h-8 text-gray-400 mb-2" />
                               <p className="text-sm text-gray-600 font-medium">이미지 업로드</p>
                               <p className="text-xs text-gray-400 mt-1">클릭하거나 드래그</p>
                             </div>
                           )}
                         </div>
                       )}
                       {/* 번호 뱃지 */}
                       <div className="absolute top-2 left-2 w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg flex items-center justify-center text-sm font-bold shadow-lg">
                         {actualIndex + 1}
                       </div>
                     </div>

                     {/* 정보 섹션 (하단) */}
                     <div className="p-4 flex-1 flex flex-col">
                       {/* 헤더 */}
                       <div className="flex items-center justify-between mb-3">
                         <h4 className="text-base font-semibold text-gray-800">
                           {option.option_name_ko || option.option_name || `초이스 ${actualIndex + 1}`}
                         </h4>
                         <div className="flex items-center gap-2">
                           <div className="flex flex-col space-y-0.5 mr-1">
                             <button
                               onClick={(e) => {
                                 e.stopPropagation()
                                 const sortedOptions = [...choice.options].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                                 const actualIndex = sortedOptions.findIndex(opt => opt.id === option.id)
                                 moveChoiceOption(groupIndex, actualIndex, 'up')
                               }}
                               disabled={isFirst}
                               className={`p-0.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded ${
                                 isFirst ? 'opacity-30 cursor-not-allowed' : ''
                               }`}
                               title="위로 이동"
                             >
                               <ChevronUp size={12} />
                             </button>
                             <button
                               onClick={(e) => {
                                 e.stopPropagation()
                                 const sortedOptions = [...choice.options].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                                 const actualIndex = sortedOptions.findIndex(opt => opt.id === option.id)
                                 moveChoiceOption(groupIndex, actualIndex, 'down')
                               }}
                               disabled={isLast}
                               className={`p-0.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded ${
                                 isLast ? 'opacity-30 cursor-not-allowed' : ''
                               }`}
                               title="아래로 이동"
                             >
                               <ChevronDown size={12} />
                             </button>
                           </div>
                           <label className="flex items-center text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded-md border border-gray-200 hover:border-blue-300 transition-colors cursor-pointer">
                             <input
                               type="checkbox"
                               checked={option.is_default}
                               onChange={(e) => {
                                 const sortedOptions = [...choice.options].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                                 const actualIndex = sortedOptions.findIndex(opt => opt.id === option.id)
                                 updateChoiceOption(groupIndex, actualIndex, 'is_default', e.target.checked)
                               }}
                               className="mr-1 w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
                             />
                             기본값
                           </label>
                           <button
                             onClick={(e) => {
                               e.stopPropagation()
                               const sortedOptions = [...choice.options].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                               const actualIndex = sortedOptions.findIndex(opt => opt.id === option.id)
                               copyChoiceOption(groupIndex, actualIndex)
                             }}
                             className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-md transition-all"
                             title="초이스 복사"
                           >
                             <Copy className="w-4 h-4" />
                           </button>
                           <button
                             onClick={(e) => {
                               e.stopPropagation()
                               const sortedOptions = [...choice.options].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                               const actualIndex = sortedOptions.findIndex(opt => opt.id === option.id)
                               removeChoiceOption(groupIndex, actualIndex)
                             }}
                             className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-all"
                             title="초이스 삭제"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                         </div>
                       </div>

                       {!allCardsCollapsed && (
                         <>
                           {/* 초이스명 */}
                           <div className="space-y-2 mb-3">
                             <label className="block text-xs font-medium text-gray-600">한국어</label>
                             <input
                               type="text"
                               value={option.option_name_ko}
                               onChange={(e) => {
                                 const sortedOptions = [...choice.options].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                                 const actualIndex = sortedOptions.findIndex(opt => opt.id === option.id)
                                 updateChoiceOption(groupIndex, actualIndex, 'option_name_ko', e.target.value)
                               }}
                               placeholder="초이스명 (한국어)"
                               className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white"
                             />
                             <label className="block text-xs font-medium text-gray-600">영어</label>
                             <input
                               type="text"
                               value={option.option_name}
                               onChange={(e) => {
                                 const sortedOptions = [...choice.options].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                                 const actualIndex = sortedOptions.findIndex(opt => opt.id === option.id)
                                 updateChoiceOption(groupIndex, actualIndex, 'option_name', e.target.value)
                               }}
                               placeholder="초이스명 (영어)"
                               className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white"
                             />
                           </div>

                           {/* 설명 */}
                           <div className="space-y-2 mb-3">
                             <label className="block text-xs font-medium text-gray-600">설명 (한국어)</label>
                             <textarea
                               value={option.description_ko || ''}
                               onChange={(e) => {
                                 const sortedOptions = [...choice.options].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                                 const actualIndex = sortedOptions.findIndex(opt => opt.id === option.id)
                                 updateChoiceOption(groupIndex, actualIndex, 'description_ko', e.target.value)
                               }}
                               placeholder="설명 (한국어)"
                               rows={2}
                               className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all bg-gray-50 focus:bg-white"
                             />
                             <label className="block text-xs font-medium text-gray-600">설명 (영어)</label>
                             <textarea
                               value={option.description || ''}
                               onChange={(e) => {
                                 const sortedOptions = [...choice.options].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                                 const actualIndex = sortedOptions.findIndex(opt => opt.id === option.id)
                                 updateChoiceOption(groupIndex, actualIndex, 'description', e.target.value)
                               }}
                               placeholder="Description (English)"
                               rows={2}
                               className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all bg-gray-50 focus:bg-white"
                             />
                           </div>

                           {/* 가격 */}
                           <div className="space-y-2 mb-3">
                             <label className="block text-xs font-medium text-gray-600">가격</label>
                             <div className="grid grid-cols-3 gap-2">
                               <div>
                                 <label className="block text-xs text-gray-500 mb-1">성인</label>
                                 <input
                                   type="number"
                                   value={option.adult_price}
                                   onChange={(e) => {
                                     const sortedOptions = [...choice.options].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                                     const actualIndex = sortedOptions.findIndex(opt => opt.id === option.id)
                                     updateChoiceOption(groupIndex, actualIndex, 'adult_price', parseInt(e.target.value) || 0)
                                   }}
                                   placeholder="0"
                                   className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white"
                                 />
                               </div>
                               <div>
                                 <label className="block text-xs text-gray-500 mb-1">아동</label>
                                 <input
                                   type="number"
                                   value={option.child_price}
                                   onChange={(e) => {
                                     const sortedOptions = [...choice.options].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                                     const actualIndex = sortedOptions.findIndex(opt => opt.id === option.id)
                                     updateChoiceOption(groupIndex, actualIndex, 'child_price', parseInt(e.target.value) || 0)
                                   }}
                                   placeholder="0"
                                   className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white"
                                 />
                               </div>
                               <div>
                                 <label className="block text-xs text-gray-500 mb-1">유아</label>
                                 <input
                                   type="number"
                                   value={option.infant_price}
                                   onChange={(e) => {
                                     const sortedOptions = [...choice.options].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                                     const actualIndex = sortedOptions.findIndex(opt => opt.id === option.id)
                                     updateChoiceOption(groupIndex, actualIndex, 'infant_price', parseInt(e.target.value) || 0)
                                   }}
                                   placeholder="0"
                                   className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white"
                                 />
                               </div>
                             </div>
                             <div className="flex items-center justify-between pt-2">
                               {choice.choice_type === 'quantity' && (
                                 <div>
                                   <div className="flex items-center gap-1 mb-1">
                                     <label className="block text-xs text-gray-500">수용</label>
                                     <div className="relative inline-block">
                                       <Info 
                                         className="w-3.5 h-3.5 text-gray-400 hover:text-blue-500 cursor-help transition-colors" 
                                         onMouseEnter={(e) => {
                                           const tooltip = e.currentTarget.parentElement?.querySelector('[data-tooltip]') as HTMLElement;
                                           if (tooltip) {
                                             // 아이콘 위치 기준으로 계산
                                             const iconRect = e.currentTarget.getBoundingClientRect();
                                             const tooltipWidth = 256;
                                             const tooltipHeight = 90;
                                             const margin = 8;
                                             
                                             let left = iconRect.left + iconRect.width / 2;
                                             let top = iconRect.top - tooltipHeight - margin;
                                             
                                             // 화면 경계 체크 및 조정
                                             if (left - tooltipWidth / 2 < margin) {
                                               left = tooltipWidth / 2 + margin;
                                             } else if (left + tooltipWidth / 2 > window.innerWidth - margin) {
                                               left = window.innerWidth - tooltipWidth / 2 - margin;
                                             }
                                             
                                             // 위쪽 공간이 부족하면 아래쪽에 표시
                                             if (top < margin) {
                                               top = iconRect.bottom + margin;
                                               tooltip.style.transform = 'translate(-50%, 0)';
                                               const arrow = tooltip.querySelector('.tooltip-arrow') as HTMLElement;
                                               if (arrow) {
                                                 arrow.style.top = '0';
                                                 arrow.style.bottom = 'auto';
                                                 arrow.style.transform = 'translate(-50%, -100%)';
                                                 arrow.innerHTML = '<div class="border-4 border-transparent border-b-gray-900"></div>';
                                               }
                                             } else {
                                               tooltip.style.transform = 'translate(-50%, -100%)';
                                               const arrow = tooltip.querySelector('.tooltip-arrow') as HTMLElement;
                                               if (arrow) {
                                                 arrow.style.top = 'auto';
                                                 arrow.style.bottom = '0';
                                                 arrow.style.transform = 'translate(-50%, 100%)';
                                                 arrow.innerHTML = '<div class="border-4 border-transparent border-t-gray-900"></div>';
                                               }
                                             }
                                             
                                             tooltip.style.top = `${top}px`;
                                             tooltip.style.left = `${left}px`;
                                             tooltip.classList.remove('opacity-0', 'invisible');
                                             tooltip.classList.add('opacity-100', 'visible');
                                           }
                                         }}
                                         onMouseLeave={(e) => {
                                           const tooltip = e.currentTarget.parentElement?.querySelector('[data-tooltip]') as HTMLElement;
                                           if (tooltip) {
                                             tooltip.classList.remove('opacity-100', 'visible');
                                             tooltip.classList.add('opacity-0', 'invisible');
                                           }
                                         }}
                                       />
                                       <div 
                                         data-tooltip
                                         className="fixed w-64 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 invisible transition-opacity duration-200 z-[9999] pointer-events-none"
                                         style={{
                                           transform: 'translate(-50%, -100%)',
                                           marginTop: '-8px'
                                         }}>
                                         <div className="mb-1 font-semibold">수용 인원</div>
                                         <div className="text-gray-300">
                                           해당 옵션이 수용할 수 있는 인원 수입니다.<br/>
                                           예: 1인 1실 = 1, 2인 1실 = 2<br/>
                                           수량 기반 선택 시 예약 인원과 비교하여 검증됩니다.
                                         </div>
                                         <div className="tooltip-arrow absolute bottom-0 left-1/2 transform translate-x-1/2 translate-y-full">
                                           <div className="border-4 border-transparent border-t-gray-900"></div>
                                         </div>
                                       </div>
                                     </div>
                                   </div>
                                   <input
                                     type="number"
                                     value={option.capacity}
                                     onChange={(e) => {
                                       const sortedOptions = [...choice.options].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                                       const actualIndex = sortedOptions.findIndex(opt => opt.id === option.id)
                                       updateChoiceOption(groupIndex, actualIndex, 'capacity', parseInt(e.target.value) || 1)
                                     }}
                                     placeholder="1"
                                     className="w-20 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white"
                                   />
                                 </div>
                               )}
                               <label className="flex items-center text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors cursor-pointer">
                                 <input
                                   type="checkbox"
                                   checked={option.is_active}
                                   onChange={(e) => {
                                     const sortedOptions = [...choice.options].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                                     const actualIndex = sortedOptions.findIndex(opt => opt.id === option.id)
                                     updateChoiceOption(groupIndex, actualIndex, 'is_active', e.target.checked)
                                   }}
                                   className="mr-2 w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
                                 />
                                 활성
                               </label>
                             </div>
                           </div>
                         </>
                       )}
                     </div>
                   </div>
                   )
                 })}
               </div>
              </div>
            </div>
          ))}

          {productChoices.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>아직 초이스 그룹이 없습니다.</p>
              <p className="text-sm">&quot;초이스 그룹 추가&quot; 버튼을 클릭하여 첫 번째 초이스를 만들어보세요.</p>
            </div>
          )}
        </div>
      )}

      {/* 저장 버튼 */}
      <div className="flex justify-end">
        <button
          onClick={saveChoices}
          disabled={saving}
          className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? '저장 중...' : '초이스 저장'}
        </button>
      </div>

      {/* 복사 모달 */}
      {showCopyModal && (
        <CopyToModal
          products={products}
          selectedTargetProductId={selectedProductId}
          setSelectedTargetProductId={setSelectedProductId}
          onCopyTo={copyChoicesFromProduct}
          onClose={() => {
            setShowCopyModal(false)
            setSelectedProductId('')
          }}
        />
      )}

      {/* 가져오기 모달 */}
      {showImportModal && (
        <ImportModal
          importData={importData}
          setImportData={setImportData}
          onImport={importChoices}
          onClose={() => {
            setShowImportModal(false)
            setImportData('')
          }}
        />
      )}

      {/* 템플릿 모달 */}
      {showTemplateModal && (
        <TemplateModal
          onSelectTemplate={loadFromTemplate}
          onClose={() => setShowTemplateModal(false)}
        />
      )}

      {/* 템플릿 설명 모달 */}
      {showTemplateInfoModal && (
        <TemplateInfoModal
          onClose={() => setShowTemplateInfoModal(false)}
        />
      )}

      {/* 초이스 타입 설명 모달 */}
      {showTypeInfoModal && (
        <ChoiceTypeInfoModal
          onClose={() => setShowTypeInfoModal(false)}
        />
      )}

      {/* 템플릿으로 내보내기 모달 */}
      {showExportTemplateModal && (
        <ExportTemplateModal
          onExport={() => exportChoicesAsTemplates(selectedChoiceIds)}
          onClose={() => {
            setShowExportTemplateModal(false)
            setSelectedChoiceIds(new Set())
          }}
          productChoices={productChoices}
          selectedChoiceIds={selectedChoiceIds}
          setSelectedChoiceIds={setSelectedChoiceIds}
        />
      )}
    </div>
  )
}

// 템플릿 선택 모달 컴포넌트
interface TemplateModalProps {
  onSelectTemplate: (templateGroup: string) => void
  onClose: () => void
}

function TemplateModal({ onSelectTemplate, onClose }: TemplateModalProps) {
  const t = useTranslations('common')
  const [templates, setTemplates] = useState<Array<{template_group: string, template_group_ko: string, count: number}>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTemplateGroups()
  }, [])

  const loadTemplateGroups = async () => {
    try {
      setLoading(true)
      // 초이스 관리 탭에 있는 아이템만 가져오기 (is_choice_template = true이고 template_group이 있는 것만)
      const { data, error } = await (supabase
        .from('options')
        .select('template_group, template_group_ko')
        .eq('is_choice_template', true) // 초이스 관리 탭의 아이템만 사용
        .not('template_group', 'is', null) as { data: DatabaseOptions[] | null, error: SupabaseError | null }) // template_group이 있는 것만

      if (error) {
        console.error('Error loading template groups:', error)
        return
      }

      // 그룹별로 카운트
      const groupCounts = data?.reduce((acc, item: DatabaseOptions) => {
        const group = item.template_group
        if (!group) return acc
        if (!acc[group]) {
          acc[group] = {
            template_group: group,
            template_group_ko: item.template_group_ko || group,
            count: 0
          }
        }
        acc[group].count++
        return acc
      }, {} as Record<string, {template_group: string, template_group_ko: string, count: number}>)

      setTemplates(Object.values(groupCounts || {}))
    } catch (error) {
      console.error('Error loading template groups:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-96">
          <div className="text-center">{t('loading')}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96">
        <h3 className="text-lg font-medium text-gray-900 mb-4">템플릿 불러오기</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {templates.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              사용 가능한 템플릿이 없습니다.
            </div>
          ) : (
            templates.map((template) => (
              <button
                key={template.template_group}
                onClick={() => onSelectTemplate(template.template_group)}
                className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium text-gray-900">
                      {template.template_group_ko}
                    </div>
                    <div className="text-sm text-gray-500">
                      {template.template_group}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {template.count}개 초이스
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  )
}


// 가져오기 모달 컴포넌트
interface ImportModalProps {
  importData: string
  setImportData: (data: string) => void
  onImport: () => void
  onClose: () => void
}

function ImportModal({ importData, setImportData, onImport, onClose }: ImportModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96">
        <h3 className="text-lg font-medium text-gray-900 mb-4">초이스 가져오기</h3>
        <p className="text-sm text-gray-600 mb-4">
          JSON 형식의 초이스 데이터를 붙여넣으세요.
        </p>
        <textarea
          value={importData}
          onChange={(e) => setImportData(e.target.value)}
          className="w-full h-32 p-3 border border-gray-300 rounded-md resize-none"
          placeholder="JSON 데이터를 여기에 붙여넣으세요..."
        />
        <div className="flex justify-end space-x-3 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
          >
            취소
          </button>
          <button
            onClick={onImport}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
          >
            가져오기
          </button>
        </div>
      </div>
    </div>
  )
}

// 복사 대상 선택 모달 컴포넌트
interface CopyToModalProps {
  products: Array<{id: string, name: string, name_ko?: string}>
  selectedTargetProductId: string
  setSelectedTargetProductId: (id: string) => void
  onCopyTo: () => void
  onClose: () => void
}

function CopyToModal({ products, selectedTargetProductId, setSelectedTargetProductId, onCopyTo, onClose }: CopyToModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96">
        <h3 className="text-lg font-medium text-gray-900 mb-4">복사 대상 선택</h3>
        <p className="text-sm text-gray-600 mb-4">
          초이스를 복사할 상품을 선택하세요.
        </p>
        <select
          value={selectedTargetProductId}
          onChange={(e) => setSelectedTargetProductId(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-md"
        >
          <option value="">상품을 선택하세요</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name_ko || product.name}
            </option>
          ))}
        </select>
        <div className="flex justify-end space-x-3 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
          >
            취소
          </button>
          <button
            onClick={onCopyTo}
            disabled={!selectedTargetProductId}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            복사
          </button>
        </div>
      </div>
    </div>
  )
}

// 템플릿으로 내보내기 모달 컴포넌트
interface ExportTemplateModalProps {
  onExport: () => void
  onClose: () => void
  productChoices: ProductChoice[]
  selectedChoiceIds: Set<string>
  setSelectedChoiceIds: (ids: Set<string>) => void
}

function ExportTemplateModal({ onExport, onClose, productChoices, selectedChoiceIds, setSelectedChoiceIds }: ExportTemplateModalProps) {
  const handleToggleAll = () => {
    if (selectedChoiceIds.size === productChoices.length) {
      setSelectedChoiceIds(new Set())
    } else {
      setSelectedChoiceIds(new Set(productChoices.map(choice => choice.id)))
    }
  }

  const handleToggleChoice = (choiceId: string) => {
    const newSelected = new Set(selectedChoiceIds)
    if (newSelected.has(choiceId)) {
      newSelected.delete(choiceId)
    } else {
      newSelected.add(choiceId)
    }
    setSelectedChoiceIds(newSelected)
  }

  const selectedCount = selectedChoiceIds.size

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-medium text-gray-900 mb-4">템플릿으로 내보내기</h3>
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            <p>내보낼 초이스 그룹을 선택하세요.</p>
            <p className="mt-2">내보낸 템플릿은 <strong>옵션 관리 &gt; 초이스 관리</strong>에서 확인할 수 있으며, 다른 상품에서도 사용할 수 있습니다.</p>
          </div>

          {/* 전체 선택/해제 */}
          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={selectedChoiceIds.size === productChoices.length && productChoices.length > 0}
                onChange={handleToggleAll}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-sm font-medium text-gray-700">
                전체 선택 ({selectedCount}/{productChoices.length})
              </span>
            </label>
          </div>

          {/* 초이스 그룹 목록 */}
          <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
            {productChoices.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                내보낼 초이스 그룹이 없습니다.
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {productChoices.map((choice) => (
                  <label
                    key={choice.id}
                    className="flex items-start p-4 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedChoiceIds.has(choice.id)}
                      onChange={() => handleToggleChoice(choice.id)}
                      className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div className="ml-3 flex-1">
                      <div className="font-medium text-gray-900">
                        {choice.choice_group_ko || choice.choice_group || '이름 없음'}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        타입: {choice.choice_type === 'single' ? '단일 선택' : choice.choice_type === 'multiple' ? '다중 선택' : '수량 선택'} | 
                        초이스 {choice.options?.length || 0}개
                        {choice.is_required && (
                          <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">필수</span>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-xs text-yellow-800">
              <strong>주의:</strong> 같은 이름의 템플릿 그룹이 이미 존재하는 경우 덮어쓰기 여부를 확인합니다.
            </p>
          </div>
        </div>
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
          >
            취소
          </button>
          <button
            onClick={onExport}
            disabled={selectedCount === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            내보내기 ({selectedCount}개)
          </button>
        </div>
      </div>
    </div>
  )
}

// 템플릿 설명 모달 컴포넌트
interface TemplateInfoModalProps {
  onClose: () => void
}

function TemplateInfoModal({ onClose }: TemplateInfoModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium text-gray-900">템플릿이란?</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="space-y-6">
          {/* 템플릿 개요 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                <FileText className="w-4 h-4 text-blue-600" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900">템플릿이란?</h4>
            </div>
            <div className="ml-11 space-y-2">
              <p className="text-gray-700">
                템플릿은 <strong>재사용 가능한 초이스 그룹</strong>입니다. 한 번 만들어두면 여러 상품에서 동일한 초이스 그룹을 빠르게 불러와 사용할 수 있습니다.
              </p>
              <div className="bg-blue-50 p-3 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>예시:</strong> "숙박 선택" 템플릿을 만들어두면, 여러 투어 상품에서 동일한 숙박 옵션을 쉽게 추가할 수 있습니다.
                </p>
              </div>
            </div>
          </div>

          {/* 템플릿 불러오기 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                <span className="text-green-600 font-semibold text-sm">1</span>
              </div>
              <h4 className="text-lg font-semibold text-gray-900">템플릿 불러오기</h4>
            </div>
            <div className="ml-11 space-y-2">
              <p className="text-gray-700">
                <strong>사용 방법:</strong>
              </p>
              <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1 ml-2">
                <li>"템플릿 불러오기" 버튼을 클릭합니다.</li>
                <li>사용할 템플릿을 선택합니다.</li>
                <li>선택한 템플릿의 초이스 그룹이 현재 상품에 추가됩니다.</li>
              </ol>
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm text-gray-600 mb-2"><strong>주의사항:</strong></p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 템플릿을 불러온 후에도 가격, 설명 등을 수정할 수 있습니다.</li>
                  <li>• 템플릿을 불러와도 원본 템플릿은 변경되지 않습니다.</li>
                  <li>• 여러 템플릿을 중복으로 불러올 수 있습니다.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 템플릿으로 내보내기 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                <span className="text-purple-600 font-semibold text-sm">2</span>
              </div>
              <h4 className="text-lg font-semibold text-gray-900">템플릿으로 내보내기</h4>
            </div>
            <div className="ml-11 space-y-2">
              <p className="text-gray-700">
                <strong>사용 방법:</strong>
              </p>
              <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1 ml-2">
                <li>만든 초이스 그룹을 선택합니다.</li>
                <li>"템플릿으로 내보내기" 버튼을 클릭합니다.</li>
                <li>초이스 그룹이 템플릿으로 저장되어 다른 상품에서도 사용할 수 있습니다.</li>
              </ol>
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm text-gray-600 mb-2"><strong>저장 위치:</strong></p>
                <p className="text-sm text-gray-600">
                  내보낸 템플릿은 <strong>옵션 관리 &gt; 초이스 관리</strong>에서 확인하고 관리할 수 있습니다.
                </p>
              </div>
            </div>
          </div>

          {/* 템플릿 관리 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                <span className="text-orange-600 font-semibold text-sm">3</span>
              </div>
              <h4 className="text-lg font-semibold text-gray-900">템플릿 관리</h4>
            </div>
            <div className="ml-11 space-y-2">
              <p className="text-gray-700">
                템플릿은 <strong>옵션 관리 &gt; 초이스 관리</strong> 메뉴에서 관리할 수 있습니다.
              </p>
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm text-gray-600 mb-2"><strong>관리 기능:</strong></p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 템플릿 추가, 수정, 삭제</li>
                  <li>• 템플릿 그룹별로 관리</li>
                  <li>• 템플릿 활성/비활성 설정</li>
                  <li>• 템플릿 순서 변경</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 활용 팁 */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-yellow-800">활용 팁</h4>
                <div className="mt-2 text-sm text-yellow-700">
                  <ul className="space-y-1">
                    <li>• 자주 사용하는 초이스 그룹은 템플릿으로 만들어두면 시간을 절약할 수 있습니다.</li>
                    <li>• 템플릿 이름을 명확하게 지으면 나중에 찾기 쉽습니다.</li>
                    <li>• 비슷한 상품들에 공통으로 사용되는 초이스는 템플릿으로 관리하는 것이 좋습니다.</li>
                    <li>• 템플릿을 불러온 후 상품별로 가격이나 설명을 수정하여 맞춤화할 수 있습니다.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}

// 초이스 타입 설명 모달 컴포넌트
interface ChoiceTypeInfoModalProps {
  onClose: () => void
}

function ChoiceTypeInfoModal({ onClose }: ChoiceTypeInfoModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium text-gray-900">초이스 타입 설명</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="space-y-6">
          {/* 단일 선택 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                <span className="text-blue-600 font-semibold text-sm">1</span>
              </div>
              <h4 className="text-lg font-semibold text-gray-900">단일 선택 (Single Choice)</h4>
            </div>
            <div className="ml-11 space-y-2">
              <p className="text-gray-700">
                <strong>설명:</strong> 여러 초이스 중 하나만 선택할 수 있는 타입입니다.
              </p>
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm text-gray-600 mb-2"><strong>사용 예시:</strong></p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 숙박 타입 선택 (호텔, 펜션, 게스트하우스)</li>
                  <li>• 식사 초이스 선택 (조식 포함, 조식 불포함)</li>
                  <li>• 교통편 선택 (버스, 기차, 항공)</li>
                </ul>
              </div>
              <div className="bg-blue-50 p-3 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>특징:</strong> 라디오 버튼 형태로 표시되며, 하나의 초이스만 선택 가능합니다.
                </p>
              </div>
            </div>
          </div>

          {/* 다중 선택 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                <span className="text-green-600 font-semibold text-sm">2</span>
              </div>
              <h4 className="text-lg font-semibold text-gray-900">다중 선택 (Multiple Choice)</h4>
            </div>
            <div className="ml-11 space-y-2">
              <p className="text-gray-700">
                <strong>설명:</strong> 여러 초이스를 동시에 선택할 수 있는 타입입니다.
              </p>
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm text-gray-600 mb-2"><strong>사용 예시:</strong></p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 추가 서비스 선택 (WiFi, 조식, 픽업 서비스)</li>
                  <li>• 관광지 선택 (여러 관광지를 동시에 선택)</li>
                  <li>• 초이스 추가 (보험, 가이드, 장비 대여)</li>
                </ul>
              </div>
              <div className="bg-green-50 p-3 rounded-md">
                <p className="text-sm text-green-800">
                  <strong>특징:</strong> 체크박스 형태로 표시되며, 여러 초이스를 동시에 선택할 수 있습니다.
                </p>
              </div>
            </div>
          </div>

          {/* 수량 선택 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                <span className="text-purple-600 font-semibold text-sm">3</span>
              </div>
              <h4 className="text-lg font-semibold text-gray-900">수량 선택 (Quantity Choice)</h4>
            </div>
            <div className="ml-11 space-y-2">
              <p className="text-gray-700">
                <strong>설명:</strong> 각 초이스에 대해 수량을 설정할 수 있는 타입입니다. 다중 선택과 유사하지만 각 초이스별로 개수를 지정할 수 있습니다.
              </p>
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm text-gray-600 mb-2"><strong>사용 예시:</strong></p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 티켓 수량 선택 (성인 2명, 아동 1명)</li>
                  <li>• 식사 수량 선택 (조식 3인분, 중식 2인분)</li>
                  <li>• 상품 수량 선택 (기념품 5개, 사진 10장)</li>
                </ul>
              </div>
              <div className="bg-purple-50 p-3 rounded-md">
                <p className="text-sm text-purple-800">
                  <strong>특징:</strong> 각 초이스마다 수량 입력 필드가 제공되며, 가격이 수량에 따라 자동 계산됩니다.
                </p>
              </div>
            </div>
          </div>

          {/* 추가 정보 */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-yellow-800">추가 설정 초이스</h4>
                <div className="mt-2 text-sm text-yellow-700">
                  <ul className="space-y-1">
                    <li>• <strong>필수 선택:</strong> 해당 초이스 그룹을 반드시 선택해야 하는지 설정</li>
                    <li>• <strong>최소/최대 선택:</strong> 선택할 수 있는 초이스의 개수 제한</li>
                    <li>• <strong>기본 초이스:</strong> 미리 선택된 기본값 설정</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
