'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Save, Copy, Download, Upload, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// 새로운 간결한 초이스 시스템 타입 정의
interface ChoiceOption {
  id: string
  option_key: string
  option_name: string
  option_name_ko: string
  adult_price: number
  child_price: number
  infant_price: number
  capacity: number
  is_default: boolean
  is_active: boolean
  sort_order: number
  image_url?: string
  image_alt?: string
  thumbnail_url?: string
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
  const [showCopyToModal, setShowCopyToModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [products, setProducts] = useState<Array<{id: string, name: string, name_ko?: string}>>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedTargetProductId, setSelectedTargetProductId] = useState('')
  const [importData, setImportData] = useState('')

  // 템플릿에서 초이스 불러오기
  const loadFromTemplate = useCallback(async (templateGroup: string) => {
    try {
      const { data, error } = await supabase
        .from('options')
        .select('*')
        .eq('is_choice_template', true)
        .eq('template_group', templateGroup)
        .order('sort_order', { ascending: true })

      if (error) {
        console.error('Error loading template:', error)
        return
      }

      if (data && data.length > 0) {
        // 템플릿을 초이스 그룹으로 변환
        const templateGroupName = data[0].template_group_ko || data[0].template_group || '템플릿'
        const choiceType = data[0].choice_type || 'single'
        const isRequired = data[0].is_required || false
        const minSelections = data[0].min_selections || 1
        const maxSelections = data[0].max_selections || 1

        const newChoice: ProductChoice = {
          id: crypto.randomUUID(),
          choice_group: templateGroup,
          choice_group_ko: templateGroupName,
          choice_type: choiceType as 'single' | 'multiple' | 'quantity',
          is_required: isRequired,
          min_selections: minSelections,
          max_selections: maxSelections,
          sort_order: productChoices.length,
          options: data.map(option => ({
            id: crypto.randomUUID(),
            option_key: option.id,
            option_name: option.name,
            option_name_ko: option.name_ko || option.name,
            adult_price: option.adult_price || 0,
            child_price: option.child_price || 0,
            infant_price: option.infant_price || 0,
            capacity: 1,
            is_default: option.id === data[0].id, // 첫 번째 옵션을 기본값으로
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
            adult_price,
            child_price,
            infant_price,
            capacity,
            is_default,
            is_active,
            sort_order
          )
        `)
        .eq('product_id', productId)
        .order('sort_order')

      if (error) throw error

      console.log('ChoicesTab에서 로드된 product choices:', data)
      setProductChoices(data || [])
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
        const { data: choiceData, error: choiceError } = await supabase
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
          .single()

        if (choiceError) throw choiceError

        // 옵션들 저장
        if (choice.options && choice.options.length > 0) {
          const optionsToInsert = choice.options.map(option => ({
            choice_id: choiceData.id,
            option_key: option.option_key,
            option_name: option.option_name,
            option_name_ko: option.option_name_ko,
            adult_price: option.adult_price,
            child_price: option.child_price,
            infant_price: option.infant_price,
            capacity: option.capacity,
            is_default: option.is_default,
            is_active: option.is_active,
            sort_order: option.sort_order
          }))

          const { error: optionsError } = await supabase
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
  const updateChoiceGroup = useCallback((index: number, field: keyof ProductChoice, value: any) => {
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
      adult_price: 0,
      child_price: 0,
      infant_price: 0,
      capacity: 1,
      is_default: false,
      is_active: true,
      sort_order: existingOptions.length
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
  const updateChoiceOption = useCallback((groupIndex: number, optionIndex: number, field: keyof ChoiceOption, value: any) => {
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
        .order('sort_order')

      if (error) throw error

      const copiedChoices: ProductChoice[] = (data || []).map(choice => ({
        id: `temp_${Date.now()}_${Math.random()}`,
        choice_group: choice.choice_group,
        choice_group_ko: choice.choice_group_ko,
        choice_type: choice.choice_type,
        is_required: choice.is_required,
        min_selections: choice.min_selections,
        max_selections: choice.max_selections,
        sort_order: choice.sort_order,
        options: (choice.options || []).map(option => ({
          id: `temp_option_${Date.now()}_${Math.random()}`,
          option_key: option.option_key,
          option_name: option.option_name,
          option_name_ko: option.option_name_ko,
          adult_price: option.adult_price,
          child_price: option.child_price,
          infant_price: option.infant_price,
          capacity: option.capacity,
          is_default: option.is_default,
          is_active: option.is_active,
          sort_order: option.sort_order
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
          adult_price: option.adult_price,
          child_price: option.child_price,
          infant_price: option.infant_price,
          capacity: option.capacity,
          is_default: option.is_default,
          is_active: option.is_active,
          sort_order: option.sort_order
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
        const importedChoices: ProductChoice[] = data.choices.map((choice: any, index: number) => ({
          id: `temp_${Date.now()}_${index}`,
          choice_group: choice.choice_group || '',
          choice_group_ko: choice.choice_group_ko || '',
          choice_type: choice.choice_type || 'single',
          is_required: choice.is_required !== false,
          min_selections: choice.min_selections || 1,
          max_selections: choice.max_selections || 1,
          sort_order: choice.sort_order || index,
          options: (choice.options || []).map((option: any, optionIndex: number) => ({
            id: `temp_option_${Date.now()}_${index}_${optionIndex}`,
            option_key: option.option_key || '',
            option_name: option.option_name || '',
            option_name_ko: option.option_name_ko || '',
            adult_price: option.adult_price || 0,
            child_price: option.child_price || 0,
            infant_price: option.infant_price || 0,
            capacity: option.capacity || 1,
            is_default: option.is_default || false,
            is_active: option.is_active !== false,
            sort_order: option.sort_order || optionIndex
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

                {choice.options.map((option, optionIndex) => (
                  <div key={option.id} className="p-3 bg-gray-50 rounded-md">
                    <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">옵션 키</label>
                        <input
                          type="text"
                          value={option.option_key}
                          onChange={(e) => updateChoiceOption(groupIndex, optionIndex, 'option_key', e.target.value)}
                          placeholder="옵션 키"
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50"
                          title="옵션 키는 자동으로 생성됩니다. 필요시 수정 가능합니다."
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">옵션명 (한국어)</label>
                        <input
                          type="text"
                          value={option.option_name_ko}
                          onChange={(e) => updateChoiceOption(groupIndex, optionIndex, 'option_name_ko', e.target.value)}
                          placeholder="옵션명 (한국어)"
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">성인 가격</label>
                        <input
                          type="number"
                          value={option.adult_price}
                          onChange={(e) => updateChoiceOption(groupIndex, optionIndex, 'adult_price', parseInt(e.target.value) || 0)}
                          placeholder="성인 가격"
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">아동 가격</label>
                        <input
                          type="number"
                          value={option.child_price}
                          onChange={(e) => updateChoiceOption(groupIndex, optionIndex, 'child_price', parseInt(e.target.value) || 0)}
                          placeholder="아동 가격"
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">유아 가격</label>
                        <input
                          type="number"
                          value={option.infant_price}
                          onChange={(e) => updateChoiceOption(groupIndex, optionIndex, 'infant_price', parseInt(e.target.value) || 0)}
                          placeholder="유아 가격"
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">수용 인원</label>
                        <input
                          type="number"
                          value={option.capacity}
                          onChange={(e) => updateChoiceOption(groupIndex, optionIndex, 'capacity', parseInt(e.target.value) || 1)}
                          placeholder="수용 인원"
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">기본 옵션</label>
                        <div className="flex items-center space-x-2">
                          <label className="flex items-center text-xs">
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
                            className="p-1 text-red-600 hover:bg-red-100 rounded"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {productChoices.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>아직 초이스 그룹이 없습니다.</p>
              <p className="text-sm">"초이스 그룹 추가" 버튼을 클릭하여 첫 번째 초이스를 만들어보세요.</p>
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
    </div>
  )
}

// 템플릿 선택 모달 컴포넌트
interface TemplateModalProps {
  onSelectTemplate: (templateGroup: string) => void
  onClose: () => void
}

function TemplateModal({ onSelectTemplate, onClose }: TemplateModalProps) {
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
        .not('template_group', 'is', null)

      if (error) {
        console.error('Error loading template groups:', error)
        return
      }

      // 그룹별로 카운트
      const groupCounts = data?.reduce((acc, item) => {
        const group = item.template_group
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
          <div className="text-center">로딩 중...</div>
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

// 복사 모달 컴포넌트
interface CopyModalProps {
  onCopy: () => void
  onClose: () => void
}

function CopyModal({ onCopy, onClose }: CopyModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96">
        <h3 className="text-lg font-medium text-gray-900 mb-4">초이스 복사</h3>
        <p className="text-sm text-gray-600 mb-6">
          현재 상품의 초이스를 다른 상품으로 복사하시겠습니까?
        </p>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
          >
            취소
          </button>
          <button
            onClick={onCopy}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
          >
            복사
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
