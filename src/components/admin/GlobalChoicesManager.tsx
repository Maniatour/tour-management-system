'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Edit, Trash2, Settings, Copy, Upload, ChevronUp, ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import ImageUpload from '@/components/common/ImageUpload'

interface ChoiceTemplate {
  id: string
  name: string
  name_ko?: string
  description?: string
  description_ko?: string
  description_en?: string
  category: string
  adult_price: number
  child_price: number
  infant_price: number
  price_type: string
  status: string
  tags?: string[]
  is_choice_template: boolean
  choice_type: 'single' | 'multiple' | 'quantity'
  min_selections: number
  max_selections: number
  template_group?: string
  template_group_ko?: string
  template_group_description_ko?: string
  template_group_description_en?: string
  is_required: boolean
  sort_order: number
  image_url?: string
  image_alt?: string
  thumbnail_url?: string
  image_order?: number
  created_at: string
}

interface GlobalChoicesManagerProps {
  onTemplateSelect?: (template: ChoiceTemplate) => void
}

export default function GlobalChoicesManager({ onTemplateSelect }: GlobalChoicesManagerProps) {
  const t = useTranslations('common')
  const [templates, setTemplates] = useState<ChoiceTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ChoiceTemplate | null>(null)
  const [showImportChoicesModal, setShowImportChoicesModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState<{template_group: string, template_group_ko: string, template_group_description_ko?: string, template_group_description_en?: string} | null>(null)
  const [allCardsCollapsed, setAllCardsCollapsed] = useState(false)

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('options')
        .select('*')
        .eq('is_choice_template', true)
        .order('template_group', { ascending: true })
        .order('sort_order', { ascending: true })

      if (error) {
        console.error('Error fetching templates:', error)
        return
      }

      setTemplates(data || [])
    } catch (error) {
      console.error('Error fetching templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddTemplate = async (template: Omit<ChoiceTemplate, 'id' | 'created_at'>) => {
    try {
      const newTemplate = {
        id: crypto.randomUUID(),
        name: template.name,
        name_ko: template.name_ko,
        description: template.description,
        description_ko: template.description_ko,
        description_en: template.description_en,
        category: template.category,
        adult_price: template.adult_price,
        child_price: template.child_price,
        infant_price: template.infant_price,
        price_type: template.price_type,
        status: template.status,
        tags: template.tags || [],
        is_choice_template: true,
        choice_type: template.choice_type,
        min_selections: template.min_selections,
        max_selections: template.max_selections,
        template_group: template.template_group,
        template_group_ko: template.template_group_ko,
        is_required: template.is_required,
        sort_order: template.sort_order,
        image_url: template.image_url,
        image_alt: template.image_alt,
        thumbnail_url: template.thumbnail_url,
        image_order: template.image_order
      }

      const { data, error } = await supabase
        .from('options')
        .insert([newTemplate])
        .select()

      if (error) {
        console.error('Error adding template:', error)
        return
      }

      if (data) {
        setTemplates([data[0], ...templates])
      }
      setShowAddForm(false)
    } catch (error) {
      console.error('Error adding template:', error)
    }
  }

  const handleEditTemplate = async (template: Omit<ChoiceTemplate, 'id' | 'created_at'>) => {
    if (editingTemplate) {
      try {
        // 이미지 URL 유효성 검사 및 정리
        const isValidUrl = (url: string | null | undefined): string | null => {
          if (!url || url.trim() === '') return null
          try {
            new URL(url)
            return url.trim()
          } catch {
            return null
          }
        }

        const updatedTemplate = {
          name: template.name,
          name_ko: template.name_ko,
          description: template.description,
          description_ko: template.description_ko,
          description_en: template.description_en,
          category: template.category,
          adult_price: template.adult_price,
          child_price: template.child_price,
          infant_price: template.infant_price,
          price_type: template.price_type,
          status: template.status,
          tags: template.tags || [],
          choice_type: template.choice_type,
          min_selections: template.min_selections,
          max_selections: template.max_selections,
          template_group: template.template_group,
          template_group_ko: template.template_group_ko,
          is_required: template.is_required,
          sort_order: template.sort_order,
          image_url: isValidUrl(template.image_url),
          image_alt: template.image_alt || null,
          thumbnail_url: isValidUrl(template.thumbnail_url),
          image_order: template.image_order || null
        }

        const { error } = await supabase
          .from('options')
          .update(updatedTemplate)
          .eq('id', editingTemplate.id)

        if (error) {
          console.error('Error updating template:', error)
          return
        }

        setTemplates(templates.map(t => t.id === editingTemplate.id ? { ...t, ...updatedTemplate } : t))
        setEditingTemplate(null)
      } catch (error) {
        console.error('Error updating template:', error)
      }
    }
  }

  const handleDeleteTemplate = async (id: string) => {
    if (confirm('이 초이스 템플릿을 삭제하시겠습니까?')) {
      try {
        const { error } = await supabase
          .from('options')
          .delete()
          .eq('id', id)

        if (error) {
          console.error('Error deleting template:', error)
          return
        }

        setTemplates(templates.filter(t => t.id !== id))
      } catch (error) {
        console.error('Error deleting template:', error)
      }
    }
  }

  // 템플릿 복사 함수
  const handleCopyTemplate = async (template: ChoiceTemplate) => {
    try {
      // 같은 그룹 내의 최대 sort_order 찾기
      const sameGroupTemplates = templates.filter(t => t.template_group === template.template_group)
      const maxSortOrder = sameGroupTemplates.length > 0 
        ? Math.max(...sameGroupTemplates.map(t => t.sort_order || 0))
        : -1

      const copiedTemplate = {
        id: crypto.randomUUID(),
        name: `${template.name} (복사본)`,
        name_ko: template.name_ko ? `${template.name_ko} (복사본)` : undefined,
        description: template.description,
        description_ko: template.description_ko,
        description_en: template.description_en,
        category: template.category,
        adult_price: template.adult_price,
        child_price: template.child_price,
        infant_price: template.infant_price,
        price_type: template.price_type,
        status: template.status,
        tags: template.tags || [],
        is_choice_template: true,
        choice_type: template.choice_type,
        min_selections: template.min_selections,
        max_selections: template.max_selections,
        template_group: template.template_group,
        template_group_ko: template.template_group_ko,
        template_group_description_ko: template.template_group_description_ko,
        template_group_description_en: template.template_group_description_en,
        is_required: template.is_required,
        sort_order: maxSortOrder + 1,
        image_url: template.image_url,
        image_alt: template.image_alt,
        thumbnail_url: template.thumbnail_url,
        image_order: template.image_order
      }

      const { data, error } = await supabase
        .from('options')
        .insert([copiedTemplate])
        .select()

      if (error) {
        console.error('Error copying template:', error)
        alert('템플릿 복사 중 오류가 발생했습니다.')
        return
      }

      if (data && data[0]) {
        setTemplates([...templates, data[0] as ChoiceTemplate])
        alert('템플릿이 성공적으로 복사되었습니다.')
      }
    } catch (error) {
      console.error('Error copying template:', error)
      alert('템플릿 복사 중 오류가 발생했습니다.')
    }
  }

  // 정렬순서 변경 함수
  const handleChangeSortOrder = async (templateId: string, direction: 'up' | 'down') => {
    try {
      const currentTemplate = templates.find(t => t.id === templateId)
      if (!currentTemplate) return

      // 같은 그룹 내의 템플릿들만 가져오기
      const sameGroupTemplates = templates
        .filter(t => t.template_group === currentTemplate.template_group)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

      const currentIndex = sameGroupTemplates.findIndex(t => t.id === templateId)
      if (currentIndex === -1) return

      let targetIndex: number
      if (direction === 'up') {
        if (currentIndex === 0) return // 이미 맨 위
        targetIndex = currentIndex - 1
      } else {
        if (currentIndex === sameGroupTemplates.length - 1) return // 이미 맨 아래
        targetIndex = currentIndex + 1
      }

      // 배열에서 항목 위치 변경
      const reorderedTemplates = [...sameGroupTemplates]
      const [movedTemplate] = reorderedTemplates.splice(currentIndex, 1)
      reorderedTemplates.splice(targetIndex, 0, movedTemplate)

      // 모든 템플릿의 sort_order를 0부터 순차적으로 재할당
      const updatePromises = reorderedTemplates.map((template, index) => 
        supabase
          .from('options')
          .update({ sort_order: index })
          .eq('id', template.id)
      )

      const results = await Promise.all(updatePromises)
      
      // 오류 확인
      const hasError = results.some(result => result.error)
      if (hasError) {
        const errors = results.filter(result => result.error).map(result => result.error)
        console.error('Error updating sort orders:', errors)
        alert('순서 변경 중 오류가 발생했습니다.')
        return
      }

      // 데이터베이스에서 최신 데이터 다시 불러오기
      await fetchTemplates()
    } catch (error) {
      console.error('Error changing sort order:', error)
      alert('순서 변경 중 오류가 발생했습니다.')
    }
  }

  // 템플릿 그룹 수정 함수
  const handleEditGroup = async (oldGroup: {template_group: string, template_group_ko: string, template_group_description_ko?: string, template_group_description_en?: string}, newGroup: {template_group: string, template_group_ko: string, template_group_description_ko?: string, template_group_description_en?: string}) => {
    try {
      // 해당 그룹에 속한 모든 템플릿 찾기
      const groupTemplates = templates.filter(t => 
        t.template_group === oldGroup.template_group
      )

      if (groupTemplates.length === 0) {
        alert('수정할 템플릿을 찾을 수 없습니다.')
        return
      }

      // 모든 템플릿의 그룹 정보 업데이트
      const updateData: any = {
        template_group: newGroup.template_group,
        template_group_ko: newGroup.template_group_ko
      }
      
      // 설명 필드가 있으면 추가
      if (newGroup.template_group_description_ko !== undefined) {
        updateData.template_group_description_ko = newGroup.template_group_description_ko || null
      }
      if (newGroup.template_group_description_en !== undefined) {
        updateData.template_group_description_en = newGroup.template_group_description_en || null
      }

      const { error } = await supabase
        .from('options')
        .update(updateData)
        .eq('is_choice_template', true)
        .eq('template_group', oldGroup.template_group)

      if (error) {
        console.error('Error updating template group:', error)
        alert('템플릿 그룹 수정 중 오류가 발생했습니다.')
        return
      }

      // 로컬 상태 업데이트
      setTemplates(templates.map(t => 
        t.template_group === oldGroup.template_group
          ? { 
              ...t, 
              template_group: newGroup.template_group, 
              template_group_ko: newGroup.template_group_ko,
              ...(newGroup.template_group_description_ko !== undefined && { template_group_description_ko: newGroup.template_group_description_ko }),
              ...(newGroup.template_group_description_en !== undefined && { template_group_description_en: newGroup.template_group_description_en })
            } as ChoiceTemplate
          : t
      ))

      setEditingGroup(null)
      alert('템플릿 그룹이 성공적으로 수정되었습니다.')
    } catch (error) {
      console.error('Error updating template group:', error)
      alert('템플릿 그룹 수정 중 오류가 발생했습니다.')
    }
  }

  // 기존 상품 초이스를 템플릿으로 가져오기
  const importChoicesAsTemplates = async (productId: string) => {
    try {
      // 상품 초이스 가져오기
      const { data: productChoices, error: choicesError } = await supabase
        .from('product_choices')
        .select(`
          *,
          options:choice_options(*)
        `)
        .eq('product_id', productId)

      if (choicesError) {
        console.error('Error fetching product choices:', choicesError)
        return
      }

      if (!productChoices || productChoices.length === 0) {
        alert('해당 상품에 등록된 초이스가 없습니다.')
        return
      }

      // 상품 정보 가져오기
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('name, name_ko')
        .eq('id', productId)
        .single()

      if (productError) {
        console.error('Error fetching product:', productError)
        return
      }

      // 각 초이스 그룹을 템플릿으로 변환
      for (const choice of productChoices) {
        const templateGroup = `${product.name_ko || product.name} - ${choice.choice_group_ko}`
        const templateGroupKo = `${product.name_ko || product.name} - ${choice.choice_group_ko}`

        // 템플릿 그룹이 이미 존재하는지 확인
        const { data: existingTemplate } = await supabase
          .from('options')
          .select('id')
          .eq('is_choice_template', true)
          .eq('template_group', templateGroup)
          .limit(1)

        if (existingTemplate && existingTemplate.length > 0) {
          continue // 이미 존재하는 템플릿 그룹은 건너뛰기
        }

        // 각 옵션을 템플릿으로 변환
        for (const option of choice.options || []) {
          const newTemplate = {
            id: crypto.randomUUID(),
            name: option.option_name,
            name_ko: option.option_name_ko,
            description: option.description || null,
            description_ko: option.description_ko || null,
            description_en: null,
            category: null,
            adult_price: option.adult_price || 0,
            child_price: option.child_price || 0,
            infant_price: option.infant_price || 0,
            price_type: 'per_person',
            status: 'active',
            tags: [],
            is_choice_template: true,
            choice_type: choice.choice_type,
            min_selections: choice.min_selections,
            max_selections: choice.max_selections,
            template_group: templateGroup,
            template_group_ko: templateGroupKo,
            is_required: choice.is_required,
            sort_order: option.sort_order || 0
          }

          const { error } = await supabase
            .from('options')
            .insert([newTemplate])

          if (error) {
            console.error('Error importing template:', error)
          }
        }
      }

      // 템플릿 목록 새로고침
      await fetchTemplates()
      setShowImportChoicesModal(false)
      alert('초이스가 템플릿으로 성공적으로 가져와졌습니다.')
    } catch (error) {
      console.error('Error importing choices:', error)
      alert('초이스 가져오기 중 오류가 발생했습니다.')
    }
  }

  const getCategoryColor = (category: string) => {
    const categoryColors: Record<string, string> = {
      'accommodation': 'bg-blue-100 text-blue-800',
      'transportation': 'bg-green-100 text-green-800',
      'meal': 'bg-orange-100 text-orange-800',
      'activity': 'bg-purple-100 text-purple-800',
      'insurance': 'bg-indigo-100 text-indigo-800',
      'equipment': 'bg-amber-100 text-amber-800'
    }
    
    return categoryColors[category] || 'bg-gray-100 text-gray-800'
  }

  const getCategoryLabel = (category: string) => {
    const categoryLabels: Record<string, string> = {
      'accommodation': '숙박',
      'transportation': '교통',
      'meal': '식사',
      'activity': '액티비티',
      'insurance': '보험',
      'equipment': '장비'
    }
    
    return categoryLabels[category] || category
  }

  const getChoiceTypeLabel = (type: string) => {
    const typeLabels: Record<string, string> = {
      'single': '단일 선택',
      'multiple': '다중 선택',
      'quantity': '수량 선택'
    }
    
    return typeLabels[type] || type
  }

  const getPriceTypeLabel = (type: string) => {
    const typeLabels: Record<string, string> = {
      'per_person': '인당',
      'per_group': '그룹당',
      'fixed': '고정'
    }
    
    return typeLabels[type] || type
  }

  const categories = ['all', ...Array.from(new Set(templates.map(t => t.category).filter(Boolean))).sort()]

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (template.name_ko && template.name_ko.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (template.description && template.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (template.tags && template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
    
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory
    
    return matchesSearch && matchesCategory
  })

  // 템플릿 그룹별로 그룹화
  const groupedTemplates = filteredTemplates.reduce((groups, template) => {
    const group = template.template_group_ko || template.template_group || '기타'
    if (!groups[group]) {
      groups[group] = []
    }
    groups[group].push(template)
    return groups
  }, {} as Record<string, ChoiceTemplate[]>)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">{t('loading')}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 검색 및 필터 */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="초이스 템플릿 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">모든 카테고리</option>
          {categories.map(category => (
            <option key={category} value={category}>
              {getCategoryLabel(category)}
            </option>
          ))}
        </select>
        <button
          onClick={() => setAllCardsCollapsed(!allCardsCollapsed)}
          className="px-3 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center space-x-2"
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
        <button
          onClick={() => setShowImportChoicesModal(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2"
        >
          <Upload size={20} />
          <span>기존 초이스 가져오기</span>
        </button>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>템플릿 추가</span>
        </button>
      </div>

      {/* 템플릿 목록 - 그룹별 표시 */}
      {Object.entries(groupedTemplates).map(([groupName, groupTemplates]) => {
        // 그룹의 원본 정보 가져오기 (첫 번째 템플릿에서)
        const firstTemplate = groupTemplates[0]
        const groupInfo = {
          template_group: firstTemplate.template_group || '',
          template_group_ko: firstTemplate.template_group_ko || firstTemplate.template_group || '',
          template_group_description_ko: firstTemplate.template_group_description_ko || '',
          template_group_description_en: firstTemplate.template_group_description_en || ''
        }
        
        return (
        <div key={groupName} className="space-y-4">
          <div className="border-b border-gray-200 pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {groupName} ({groupTemplates.length}개)
                </h3>
                {(groupInfo.template_group_description_ko || groupInfo.template_group_description_en) && (
                  <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {groupInfo.template_group_description_ko && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">설명 (한국어)</p>
                          <p className="text-sm text-gray-700">{groupInfo.template_group_description_ko}</p>
                        </div>
                      )}
                      {groupInfo.template_group_description_en && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">설명 (영어)</p>
                          <p className="text-sm text-gray-700">{groupInfo.template_group_description_en}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => setEditingGroup(groupInfo)}
                className="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded ml-4"
                title="그룹 수정"
              >
                <Edit size={16} />
              </button>
            </div>
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(360px, 100%), 1fr))' }}>
            {groupTemplates
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((template, index, sortedArray) => {
                const isFirst = index === 0
                const isLast = index === sortedArray.length - 1
                return (
                  <div 
                    key={template.id} 
                    className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer max-w-full"
                    onClick={() => setEditingTemplate(template)}
                  >
                    {/* 카드 헤더 */}
                    <div className="p-4 border-b border-gray-100">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-semibold text-blue-600">{index + 1}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-semibold text-gray-900 truncate">
                              {template.name}
                            </h4>
                          </div>
                        </div>
                        <div className="flex space-x-1" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col space-y-0.5 mr-1">
                            <button
                              onClick={() => handleChangeSortOrder(template.id, 'up')}
                              disabled={isFirst}
                              className={`p-0.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded ${
                                isFirst ? 'opacity-30 cursor-not-allowed' : ''
                              }`}
                              title="위로 이동"
                            >
                              <ChevronUp size={12} />
                            </button>
                            <button
                              onClick={() => handleChangeSortOrder(template.id, 'down')}
                              disabled={isLast}
                              className={`p-0.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded ${
                                isLast ? 'opacity-30 cursor-not-allowed' : ''
                              }`}
                              title="아래로 이동"
                            >
                              <ChevronDown size={12} />
                            </button>
                          </div>
                          <button
                            onClick={() => setEditingTemplate(template)}
                            className="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded"
                            title="편집"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCopyTemplate(template)
                            }}
                            className="p-1 text-green-600 hover:text-green-900 hover:bg-green-50 rounded"
                            title="복사"
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="p-1 text-red-600 hover:text-red-900 hover:bg-red-50 rounded"
                            title="삭제"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      
                      {/* 카테고리, 가격유형, 초이스 타입 뱃지 */}
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(template.category)}`}>
                          {getCategoryLabel(template.category)}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {getPriceTypeLabel(template.price_type)}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          {getChoiceTypeLabel(template.choice_type)}
                        </span>
                      </div>
                    </div>

                    {/* 카드 본문 */}
                    {!allCardsCollapsed && (
                      <div className="p-4 space-y-3">
                        {/* 이미지 */}
                        {template.image_url && (
                          <div className="relative w-full bg-gray-100 rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
                            <img
                              src={template.thumbnail_url || template.image_url}
                              alt={template.image_alt || template.name_ko || template.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                          </div>
                        )}

                        {/* 옵션명(고객 한글), 옵션명(고객 영어), ID */}
                        <div className="space-y-1">
                          {template.name_ko && (
                            <p className="text-sm text-gray-900 font-medium">{template.name_ko}</p>
                          )}
                          {template.name && (
                            <p className="text-xs text-gray-600">{template.name}</p>
                          )}
                          <p className="text-xs text-gray-500">ID: {template.id}</p>
                        </div>

                        {/* 설명 */}
                        {template.description && (
                          <p className="text-sm text-gray-600 line-clamp-2">{template.description}</p>
                        )}

                        {/* 가격 정보 */}
                        <div className="text-xs text-gray-500">
                          <div className="flex justify-between">
                            <span>성인: ${template.adult_price}</span>
                            <span>아동: ${template.child_price}</span>
                            <span>유아: ${template.infant_price}</span>
                          </div>
                          <div className="text-center mt-1">
                            {getPriceTypeLabel(template.price_type)}
                          </div>
                        </div>

                        {/* 태그 */}
                        {template.tags && template.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {template.tags.map((tag, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* 상태 */}
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            template.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {template.status === 'active' ? '활성' : '비활성'}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            template.is_required ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {template.is_required ? '필수' : '선택'}
                          </span>
                        </div>

                        {/* 정렬순서 표시 */}
                        <div className="text-xs text-gray-400 text-center pt-1">
                          순서: {template.sort_order + 1}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        </div>
        )
      })}

      {/* 템플릿 추가/편집 모달 */}
      {(showAddForm || editingTemplate) && (
        <TemplateForm
          template={editingTemplate}
          onSubmit={editingTemplate ? handleEditTemplate : handleAddTemplate}
          onCancel={() => {
            setShowAddForm(false)
            setEditingTemplate(null)
          }}
        />
      )}

      {/* 기존 초이스 가져오기 모달 */}
      {showImportChoicesModal && (
        <ImportChoicesModal
          onImport={importChoicesAsTemplates}
          onClose={() => setShowImportChoicesModal(false)}
        />
      )}

      {/* 템플릿 그룹 편집 모달 */}
      {editingGroup && (
        <GroupEditModal
          group={editingGroup}
          onSubmit={(newGroup) => handleEditGroup(editingGroup, newGroup)}
          onClose={() => setEditingGroup(null)}
        />
      )}
    </div>
  )
}

interface TemplateFormProps {
  template?: ChoiceTemplate | null
  onSubmit: (template: Omit<ChoiceTemplate, 'id' | 'created_at'>) => void
  onCancel: () => void
}

function TemplateForm({ template, onSubmit, onCancel }: TemplateFormProps) {
  const [formData, setFormData] = useState({
    name: template?.name || '',
    name_ko: template?.name_ko || '',
    description: template?.description || '',
    description_ko: template?.description_ko || '',
    description_en: template?.description_en || '',
    category: template?.category || '',
    adult_price: template?.adult_price || 0,
    child_price: template?.child_price || 0,
    infant_price: template?.infant_price || 0,
    price_type: template?.price_type || 'per_person',
    status: template?.status || 'active',
    tags: template?.tags || [],
    choice_type: template?.choice_type || 'single' as 'single' | 'multiple' | 'quantity',
    min_selections: template?.min_selections || 1,
    max_selections: template?.max_selections || 1,
    template_group: template?.template_group || '',
    template_group_ko: template?.template_group_ko || '',
    is_required: template?.is_required ?? true,
    sort_order: template?.sort_order || 0,
    image_url: template?.image_url || '',
    image_alt: template?.image_alt || '',
    thumbnail_url: template?.thumbnail_url || '',
    image_order: template?.image_order || 0
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const addTag = () => {
    const input = document.getElementById('tagInput') as HTMLInputElement
    const tag = input.value.trim()
    if (tag && !formData.tags.includes(tag)) {
      setFormData({ ...formData, tags: [...formData.tags, tag] })
      input.value = ''
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(tag => tag !== tagToRemove) })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {template ? '초이스 템플릿 편집' : '초이스 템플릿 추가'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">초이스 이름 (한글)</label>
              <input
                type="text"
                value={formData.name_ko}
                onChange={(e) => setFormData({ ...formData, name_ko: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">초이스 이름 (영문)</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">설명 (한글)</label>
              <textarea
                value={formData.description_ko}
                onChange={(e) => setFormData({ ...formData, description_ko: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">설명 (영문)</label>
              <textarea
                value={formData.description_en}
                onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">초이스 타입</label>
              <select
                value={formData.choice_type}
                onChange={(e) => setFormData({ ...formData, choice_type: e.target.value as 'single' | 'multiple' | 'quantity' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="single">단일 선택</option>
                <option value="multiple">다중 선택</option>
                <option value="quantity">수량 선택</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">카테고리 선택</option>
                <option value="accommodation">숙박</option>
                <option value="transportation">교통</option>
                <option value="meal">식사</option>
                <option value="activity">액티비티</option>
                <option value="insurance">보험</option>
                <option value="equipment">장비</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">가격 타입</label>
              <select
                value={formData.price_type}
                onChange={(e) => setFormData({ ...formData, price_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="per_person">인당</option>
                <option value="per_group">그룹당</option>
                <option value="fixed">고정</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">성인 가격</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.adult_price}
                onChange={(e) => setFormData({ ...formData, adult_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">아동 가격</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.child_price}
                onChange={(e) => setFormData({ ...formData, child_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">유아 가격</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.infant_price}
                onChange={(e) => setFormData({ ...formData, infant_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">최소 선택 수</label>
              <input
                type="number"
                min="0"
                value={formData.min_selections}
                onChange={(e) => setFormData({ ...formData, min_selections: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">최대 선택 수</label>
              <input
                type="number"
                min="1"
                value={formData.max_selections}
                onChange={(e) => setFormData({ ...formData, max_selections: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.is_required}
                onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                className="mr-2"
              />
              필수 선택
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.status === 'active'}
                onChange={(e) => setFormData({ ...formData, status: e.target.checked ? 'active' : 'inactive' })}
                className="mr-2"
              />
              활성 상태
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이미지</label>
            <ImageUpload
              imageUrl={formData.image_url}
              thumbnailUrl={formData.thumbnail_url}
              imageAlt={formData.image_alt}
              onImageChange={(imageUrl, thumbnailUrl, imageAlt) => {
                setFormData({ ...formData, image_url: imageUrl, thumbnail_url: thumbnailUrl, image_alt: imageAlt })
              }}
              onImageRemove={() => {
                setFormData({ ...formData, image_url: '', thumbnail_url: '', image_alt: '' })
              }}
              folder="choices"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이미지 대체 텍스트</label>
            <input
              type="text"
              value={formData.image_alt}
              onChange={(e) => setFormData({ ...formData, image_alt: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="이미지 설명"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">태그</label>
            <div className="flex space-x-2">
              <input
                id="tagInput"
                type="text"
                placeholder="태그 입력"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                추가
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.tags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
            >
              {template ? '수정' : '추가'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// 기존 초이스 가져오기 모달 컴포넌트
interface ImportChoicesModalProps {
  onImport: (productId: string) => void
  onClose: () => void
}

function ImportChoicesModal({ onImport, onClose }: ImportChoicesModalProps) {
  const t = useTranslations('common')
  const [products, setProducts] = useState<Array<{id: string, name: string, name_ko?: string}>>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('products')
        .select('id, name, name_ko')
        .order('name_ko', { ascending: true })

      if (error) {
        console.error('Error loading products:', error)
        return
      }

      setProducts(data || [])
    } catch (error) {
      console.error('Error loading products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleImport = () => {
    if (selectedProductId) {
      onImport(selectedProductId)
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
        <h3 className="text-lg font-medium text-gray-900 mb-4">기존 초이스 가져오기</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              상품 선택
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">상품을 선택하세요</option>
              {products.map(product => (
                <option key={product.id} value={product.id}>
                  {product.name_ko || product.name}
                </option>
              ))}
            </select>
          </div>
          <div className="text-sm text-gray-600">
            <p>선택한 상품의 초이스가 템플릿으로 변환됩니다.</p>
            <p>이미 존재하는 템플릿 그룹은 건너뛰어집니다.</p>
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
            onClick={handleImport}
            disabled={!selectedProductId}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            가져오기
          </button>
        </div>
      </div>
    </div>
  )
}

// 템플릿 그룹 편집 모달 컴포넌트
interface GroupEditModalProps {
  group: {template_group: string, template_group_ko: string, template_group_description_ko?: string, template_group_description_en?: string}
  onSubmit: (newGroup: {template_group: string, template_group_ko: string, template_group_description_ko?: string, template_group_description_en?: string}) => void
  onClose: () => void
}

function GroupEditModal({ group, onSubmit, onClose }: GroupEditModalProps) {
  const [formData, setFormData] = useState({
    template_group: group.template_group || '',
    template_group_ko: group.template_group_ko || '',
    template_group_description_ko: group.template_group_description_ko || '',
    template_group_description_en: group.template_group_description_en || ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.template_group.trim()) {
      alert('초이스 그룹 이름(영문)을 입력해주세요.')
      return
    }
    onSubmit(formData)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
        <h3 className="text-lg font-medium text-gray-900 mb-4">초이스 그룹 수정</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                초이스 그룹 이름 (영문)
              </label>
              <input
                type="text"
                value={formData.template_group}
                onChange={(e) => setFormData({ ...formData, template_group: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="예: Accommodation"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                초이스 그룹 이름 (한글)
              </label>
              <input
                type="text"
                value={formData.template_group_ko}
                onChange={(e) => setFormData({ ...formData, template_group_ko: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="예: 숙박 선택"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                설명 (한국어)
              </label>
              <textarea
                value={formData.template_group_description_ko}
                onChange={(e) => setFormData({ ...formData, template_group_description_ko: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="초이스 그룹에 대한 설명을 입력하세요 (한국어)"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                설명 (영어)
              </label>
              <textarea
                value={formData.template_group_description_en}
                onChange={(e) => setFormData({ ...formData, template_group_description_en: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Enter description for this choice group (English)"
                rows={3}
              />
            </div>
          </div>
          <div className="text-sm text-gray-600 bg-yellow-50 p-3 rounded-lg">
            <p className="font-medium mb-1">⚠️ 주의사항</p>
            <p>이 그룹에 속한 모든 템플릿의 그룹 이름과 설명이 변경됩니다.</p>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
            >
              수정
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}