'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Save, Copy, Download, Upload, FileText, Info } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

// 임시 타입 정의 (데이터베이스 타입이 없을 때 사용)
interface DatabaseOptions {
  id: string
  name: string
  name_ko?: string
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
  const [showTypeInfoModal, setShowTypeInfoModal] = useState(false)
  const [uploadingImages, setUploadingImages] = useState<{[key: string]: boolean}>({})
  const [dragOverStates, setDragOverStates] = useState<{[key: string]: boolean}>({})
  const [products, setProducts] = useState<Array<{id: string, name: string, name_ko?: string}>>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [importData, setImportData] = useState('')

  // 템플릿에서 초이스 불러오기
  const loadFromTemplate = useCallback(async (templateGroup: string) => {
    try {
      const { data, error } = await supabase
        .from('options')
        .select('*')
        .eq('is_choice_template', true)
        .eq('template_group', templateGroup)
        .order('sort_order', { ascending: true }) as { data: DatabaseOptions[] | null, error: SupabaseError | null }

      if (error) {
        console.error('Error loading template:', error)
        return
      }

      if (data && data.length > 0) {
        const firstItem = data[0] as DatabaseOptions
        // 템플릿을 초이스 그룹으로 변환
        const templateGroupName = firstItem.template_group_ko || firstItem.template_group || '템플릿'
        const choiceType = firstItem.choice_type || 'single'
        const isRequired = firstItem.is_required || false
        const minSelections = firstItem.min_selections || 1
        const maxSelections = firstItem.max_selections || 1

        const newChoice: ProductChoice = {
          id: crypto.randomUUID(),
          choice_group: templateGroup,
          choice_group_ko: templateGroupName,
          choice_type: choiceType as 'single' | 'multiple' | 'quantity',
          is_required: isRequired,
          min_selections: minSelections,
          max_selections: maxSelections,
          sort_order: productChoices.length,
          options: data.map((option: DatabaseOptions) => ({
            id: crypto.randomUUID(),
            option_key: option.id,
            option_name: option.name,
            option_name_ko: option.name_ko || option.name,
            description: undefined,
            description_ko: undefined,
            adult_price: option.adult_price || 0,
            child_price: option.child_price || 0,
            infant_price: option.infant_price || 0,
            capacity: 1,
            is_default: option.id === firstItem.id, // 첫 번째 옵션을 기본값으로
            is_active: option.status === 'active',
            sort_order: option.sort_order || 0,
            image_url: option.image_url,
            image_alt: option.image_alt,
            thumbnail_url: option.thumbnail_url
          }))
        }

        setProductChoices(prev => [...prev, newChoice])
        setShowTemplateModal(false)
      }
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
        .order('sort_order') as { data: ProductChoiceData[] | null, error: SupabaseError | null }

      if (error) throw error

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

    try {
      // 기존 choices 삭제
      await supabase
        .from('choice_options')
        .delete()
        .in('choice_id', productChoices.map(pc => pc.id))

      await supabase
        .from('product_choices')
        .delete()
        .eq('product_id', productId)

      // 새로운 choices 저장
      for (const choice of productChoices) {
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
            choice_group: choice.choice_group,
            choice_group_ko: choice.choice_group_ko,
            choice_type: choice.choice_type,
            is_required: choice.is_required,
            min_selections: choice.min_selections,
            max_selections: choice.max_selections,
            sort_order: choice.sort_order
          })
          .select()
          .single() as { data: ProductChoiceData, error: SupabaseError | null }

        if (choiceError) throw choiceError

        // 옵션들 저장
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
      await loadProductChoices() // 다시 로드
    } catch (error) {
      console.error('Choices 저장 오류:', error)
      setSaveMessage('초이스 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }, [productId, productChoices, loadProductChoices])

  // 초이스 그룹 추가
  const addChoiceGroup = useCallback(() => {
    const newGroup: ProductChoice = {
      id: `temp_${Date.now()}`,
      choice_group: '',
      choice_group_ko: '',
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

  // 초이스 옵션 추가
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

  // 초이스 옵션 삭제
  const removeChoiceOption = useCallback((groupIndex: number, optionIndex: number) => {
    setProductChoices(prev => prev.map((group, i) => 
      i === groupIndex 
        ? { ...group, options: group.options.filter((_, j) => j !== optionIndex) }
        : group
    ))
  }, [])

  // 초이스 옵션 업데이트
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

      // Supabase Storage에 업로드
      const fileName = `choice-option-${Date.now()}-${file.name}`
      const { error } = await supabase.storage
        .from('product-images')
        .upload(fileName, file)

      if (error) {
        console.error('이미지 업로드 오류:', error)
        alert('이미지 업로드 중 오류가 발생했습니다.')
        return
      }

      // 업로드된 이미지의 공개 URL 가져오기
      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName)

      // 이미지 URL과 alt 텍스트 업데이트
      updateChoiceOption(groupIndex, optionIndex, 'image_url', urlData.publicUrl)
      updateChoiceOption(groupIndex, optionIndex, 'image_alt', file.name)
    } catch (error) {
      console.error('이미지 업로드 오류:', error)
      alert('이미지 업로드 중 오류가 발생했습니다.')
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
          choice_type: choice.choice_type as 'single' | 'multiple' | 'quantity',
          is_required: choice.is_required,
          min_selections: choice.min_selections,
          max_selections: choice.max_selections,
          sort_order: choice.sort_order,
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
        choice_type: choice.choice_type,
        is_required: choice.is_required,
        min_selections: choice.min_selections,
        max_selections: choice.max_selections,
        sort_order: choice.sort_order,
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
          <p className="text-sm text-gray-600">상품의 선택 옵션을 관리합니다.</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowTemplateModal(true)}
            className="flex items-center px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <FileText className="w-4 h-4 mr-2" />
            템플릿 불러오기
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
            <div key={choice.id} className="border border-gray-200 rounded-lg p-4">
              {/* 초이스 그룹 헤더 */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      초이스 그룹 ID
                    </label>
                    <input
                      type="text"
                      value={choice.choice_group}
                      onChange={(e) => updateChoiceGroup(groupIndex, 'choice_group', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="예: accommodation"
                    />
                  </div>
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
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={choice.is_required}
                        onChange={(e) => updateChoiceGroup(groupIndex, 'is_required', e.target.checked)}
                        className="mr-2"
                      />
                      필수 선택
                    </label>
                  </div>
                </div>
                <button
                  onClick={() => removeChoiceGroup(groupIndex)}
                  className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-md"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* 초이스 옵션 목록 */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-medium text-gray-700">초이스 옵션</h4>
                  <button
                    onClick={() => addChoiceOption(groupIndex)}
                    className="flex items-center px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    옵션 추가
                  </button>
                </div>

                {/* 2열 그리드 레이아웃 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                 {choice.options.map((option, optionIndex) => (
                   <div key={option.id} className="border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
                     {/* 옵션 헤더 */}
                     <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 rounded-t-lg">
                       <div className="flex items-center justify-between">
                         <div className="flex items-center space-x-2">
                           <div className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                             {optionIndex + 1}
                           </div>
                           <h4 className="text-xs font-semibold text-gray-900">
                             옵션 {optionIndex + 1}
                           </h4>
                         </div>
                         <div className="flex items-center space-x-2">
                           <label className="flex items-center text-xs text-gray-600">
                             <input
                               type="checkbox"
                               checked={option.is_default}
                               onChange={(e) => updateChoiceOption(groupIndex, optionIndex, 'is_default', e.target.checked)}
                               className="mr-1"
                             />
                             기본
                           </label>
                           <button
                             onClick={() => removeChoiceOption(groupIndex, optionIndex)}
                             className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors duration-200"
                             title="옵션 삭제"
                           >
                             <Trash2 className="w-3 h-3" />
                           </button>
                         </div>
                       </div>
                     </div>

                     {/* 옵션 내용 */}
                     <div className="p-3 space-y-4">
                       {/* 옵션명 섹션 */}
                       <div className="space-y-2">
                         <h5 className="text-xs font-medium text-gray-700 uppercase tracking-wide">옵션명</h5>
                         <div className="grid grid-cols-1 gap-2">
                           <div>
                             <label className="block text-xs font-medium text-gray-700 mb-1">한국어</label>
                             <input
                               type="text"
                               value={option.option_name_ko}
                               onChange={(e) => updateChoiceOption(groupIndex, optionIndex, 'option_name_ko', e.target.value)}
                               placeholder="옵션명 (한국어)"
                               className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                             />
                           </div>
                           <div>
                             <label className="block text-xs font-medium text-gray-700 mb-1">영어</label>
                             <input
                               type="text"
                               value={option.option_name}
                               onChange={(e) => updateChoiceOption(groupIndex, optionIndex, 'option_name', e.target.value)}
                               placeholder="옵션명 (영어)"
                               className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                             />
                           </div>
                         </div>
                       </div>

                       {/* 설명 섹션 */}
                       <div className="space-y-2">
                         <h5 className="text-xs font-medium text-gray-700 uppercase tracking-wide">설명</h5>
                         <div className="grid grid-cols-1 gap-2">
                           <div>
                             <label className="block text-xs font-medium text-gray-700 mb-1">한국어</label>
                             <textarea
                               value={option.description_ko || ''}
                               onChange={(e) => updateChoiceOption(groupIndex, optionIndex, 'description_ko', e.target.value)}
                               placeholder="설명 (한국어)"
                               rows={2}
                               className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent resize-none"
                             />
                           </div>
                           <div>
                             <label className="block text-xs font-medium text-gray-700 mb-1">영어</label>
                             <textarea
                               value={option.description || ''}
                               onChange={(e) => updateChoiceOption(groupIndex, optionIndex, 'description', e.target.value)}
                               placeholder="Description (English)"
                               rows={2}
                               className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent resize-none"
                             />
                           </div>
                         </div>
                       </div>

                       {/* 가격 및 기타 정보 섹션 */}
                       <div className="space-y-2">
                         <h5 className="text-xs font-medium text-gray-700 uppercase tracking-wide">가격 및 설정</h5>
                         <div className="grid grid-cols-2 gap-2">
                           <div>
                             <label className="block text-xs font-medium text-gray-700 mb-1">성인</label>
                             <input
                               type="number"
                               value={option.adult_price}
                               onChange={(e) => updateChoiceOption(groupIndex, optionIndex, 'adult_price', parseInt(e.target.value) || 0)}
                               placeholder="0"
                               className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                             />
                           </div>
                           <div>
                             <label className="block text-xs font-medium text-gray-700 mb-1">아동</label>
                             <input
                               type="number"
                               value={option.child_price}
                               onChange={(e) => updateChoiceOption(groupIndex, optionIndex, 'child_price', parseInt(e.target.value) || 0)}
                               placeholder="0"
                               className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                             />
                           </div>
                           <div>
                             <label className="block text-xs font-medium text-gray-700 mb-1">유아</label>
                             <input
                               type="number"
                               value={option.infant_price}
                               onChange={(e) => updateChoiceOption(groupIndex, optionIndex, 'infant_price', parseInt(e.target.value) || 0)}
                               placeholder="0"
                               className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                             />
                           </div>
                           <div>
                             <label className="block text-xs font-medium text-gray-700 mb-1">수용</label>
                             <input
                               type="number"
                               value={option.capacity}
                               onChange={(e) => updateChoiceOption(groupIndex, optionIndex, 'capacity', parseInt(e.target.value) || 1)}
                               placeholder="1"
                               className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                             />
                           </div>
                         </div>
                         <div className="flex items-center justify-between">
                           <label className="flex items-center text-xs text-gray-600">
                             <input
                               type="checkbox"
                               checked={option.is_active}
                               onChange={(e) => updateChoiceOption(groupIndex, optionIndex, 'is_active', e.target.checked)}
                               className="mr-1"
                             />
                             활성
                           </label>
                         </div>
                       </div>

                       {/* 이미지 업로드 섹션 */}
                       <div className="space-y-2">
                         <h5 className="text-xs font-medium text-gray-700 uppercase tracking-wide">이미지</h5>
                         
                         {/* 현재 이미지 미리보기 */}
                         {option.image_url ? (
                           <div className="flex items-center space-x-2">
                             <Image
                               src={option.image_url}
                               alt={option.image_alt || option.option_name_ko}
                               width={40}
                               height={40}
                               className="w-10 h-10 object-cover rounded border flex-shrink-0"
                             />
                             <div className="flex-1 min-w-0">
                               <p className="text-xs text-gray-600 truncate">{option.image_url}</p>
                               <div className="flex space-x-1 mt-1">
                                 <button
                                   onClick={() => {
                                     updateChoiceOption(groupIndex, optionIndex, 'image_url', '')
                                     updateChoiceOption(groupIndex, optionIndex, 'image_alt', '')
                                   }}
                                   className="px-1 py-0.5 text-xs text-red-600 bg-red-50 hover:bg-red-100 rounded"
                                 >
                                   삭제
                                 </button>
                                 <button
                                   onClick={() => {
                                     const url = prompt('새 이미지 URL:', option.image_url || '')
                                     if (url !== null) {
                                       updateChoiceOption(groupIndex, optionIndex, 'image_url', url)
                                     }
                                   }}
                                   className="px-1 py-0.5 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 rounded"
                                 >
                                   변경
                                 </button>
                               </div>
                             </div>
                           </div>
                         ) : (
                           <div className="text-xs text-gray-500 py-2 text-center border border-dashed border-gray-300 rounded">
                             이미지 없음
                           </div>
                         )}

                         {/* 이미지 URL 입력 */}
                         <div className="space-y-1">
                           <div>
                             <label className="block text-xs font-medium text-gray-700 mb-1">URL</label>
                             <input
                               type="url"
                               value={option.image_url || ''}
                               onChange={(e) => updateChoiceOption(groupIndex, optionIndex, 'image_url', e.target.value)}
                               placeholder="https://example.com/image.jpg"
                               className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                             />
                           </div>
                           <div>
                             <label className="block text-xs font-medium text-gray-700 mb-1">Alt</label>
                             <input
                               type="text"
                               value={option.image_alt || ''}
                               onChange={(e) => updateChoiceOption(groupIndex, optionIndex, 'image_alt', e.target.value)}
                               placeholder="이미지 설명"
                               className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                             />
                           </div>
                         </div>

                         {/* 드래그앤드롭 업로드 영역 */}
                         <div className="border-t pt-2">
                           <div className="relative">
                             <input
                               type="file"
                               accept="image/*"
                               disabled={uploadingImages[`${groupIndex}-${optionIndex}`]}
                               onChange={async (e) => {
                                 const file = e.target.files?.[0]
                                 if (file) {
                                   await handleImageUpload(file, groupIndex, optionIndex)
                                   e.target.value = ''
                                 }
                               }}
                               className="hidden"
                               id={`file-upload-${groupIndex}-${optionIndex}`}
                             />
                             
                             <div
                               className={`border border-dashed rounded p-2 text-center transition-colors ${
                                 dragOverStates[`${groupIndex}-${optionIndex}`]
                                   ? 'border-blue-400 bg-blue-50'
                                   : 'border-gray-300 hover:border-gray-400'
                               } ${uploadingImages[`${groupIndex}-${optionIndex}`] ? 'pointer-events-none opacity-50' : ''}`}
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
                               onClick={() => {
                                 if (!uploadingImages[`${groupIndex}-${optionIndex}`]) {
                                   document.getElementById(`file-upload-${groupIndex}-${optionIndex}`)?.click()
                                 }
                               }}
                               onPaste={async (e) => {
                                 const items = e.clipboardData?.items
                                 if (!items) return

                                 for (let i = 0; i < items.length; i++) {
                                   const item = items[i]
                                   if (item.type.startsWith('image/')) {
                                     e.preventDefault()
                                     const file = item.getAsFile()
                                     if (file) {
                                       await handleImageUpload(file, groupIndex, optionIndex)
                                     }
                                     break
                                   }
                                 }
                               }}
                               tabIndex={0}
                             >
                               {uploadingImages[`${groupIndex}-${optionIndex}`] ? (
                                 <div className="flex flex-col items-center">
                                   <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-1"></div>
                                   <p className="text-xs text-blue-600">업로드 중...</p>
                                 </div>
                               ) : (
                                 <div className="flex flex-col items-center">
                                   <Upload className="w-4 h-4 text-gray-400 mb-1" />
                                   <p className="text-xs text-gray-600">드래그/클릭</p>
                                   <p className="text-xs text-gray-500">Ctrl+V</p>
                                 </div>
                               )}
                             </div>
                           </div>
                         </div>
                       </div>
                     </div>
                   </div>
                 ))}
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

      {/* 초이스 타입 설명 모달 */}
      {showTypeInfoModal && (
        <ChoiceTypeInfoModal
          onClose={() => setShowTypeInfoModal(false)}
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
      const { data, error } = await supabase
        .from('options')
        .select('template_group, template_group_ko')
        .eq('is_choice_template', true)
        .not('template_group', 'is', null) as { data: DatabaseOptions[] | null, error: SupabaseError | null }

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
                    {template.count}개 옵션
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
                <strong>설명:</strong> 여러 옵션 중 하나만 선택할 수 있는 타입입니다.
              </p>
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm text-gray-600 mb-2"><strong>사용 예시:</strong></p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 숙박 타입 선택 (호텔, 펜션, 게스트하우스)</li>
                  <li>• 식사 옵션 선택 (조식 포함, 조식 불포함)</li>
                  <li>• 교통편 선택 (버스, 기차, 항공)</li>
                </ul>
              </div>
              <div className="bg-blue-50 p-3 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>특징:</strong> 라디오 버튼 형태로 표시되며, 하나의 옵션만 선택 가능합니다.
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
                <strong>설명:</strong> 여러 옵션을 동시에 선택할 수 있는 타입입니다.
              </p>
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm text-gray-600 mb-2"><strong>사용 예시:</strong></p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 추가 서비스 선택 (WiFi, 조식, 픽업 서비스)</li>
                  <li>• 관광지 선택 (여러 관광지를 동시에 선택)</li>
                  <li>• 옵션 추가 (보험, 가이드, 장비 대여)</li>
                </ul>
              </div>
              <div className="bg-green-50 p-3 rounded-md">
                <p className="text-sm text-green-800">
                  <strong>특징:</strong> 체크박스 형태로 표시되며, 여러 옵션을 동시에 선택할 수 있습니다.
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
                <strong>설명:</strong> 각 옵션에 대해 수량을 설정할 수 있는 타입입니다. 다중 선택과 유사하지만 각 옵션별로 개수를 지정할 수 있습니다.
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
                  <strong>특징:</strong> 각 옵션마다 수량 입력 필드가 제공되며, 가격이 수량에 따라 자동 계산됩니다.
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
                <h4 className="text-sm font-medium text-yellow-800">추가 설정 옵션</h4>
                <div className="mt-2 text-sm text-yellow-700">
                  <ul className="space-y-1">
                    <li>• <strong>필수 선택:</strong> 해당 초이스 그룹을 반드시 선택해야 하는지 설정</li>
                    <li>• <strong>최소/최대 선택:</strong> 선택할 수 있는 옵션의 개수 제한</li>
                    <li>• <strong>기본 옵션:</strong> 미리 선택된 기본값 설정</li>
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
