'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Edit, Trash2, Settings, Copy, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ImageUpload from '@/components/common/ImageUpload'

interface ChoiceTemplate {
  id: string
  name: string
  name_ko?: string
  description?: string
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
  const [templates, setTemplates] = useState<ChoiceTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ChoiceTemplate | null>(null)
  const [showImportChoicesModal, setShowImportChoicesModal] = useState(false)

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
            description: `${product.name_ko || product.name}에서 가져온 초이스`,
            category: 'imported',
            adult_price: option.adult_price || 0,
            child_price: option.child_price || 0,
            infant_price: option.infant_price || 0,
            price_type: 'per_person',
            status: 'active',
            tags: ['imported', product.name],
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
      {Object.entries(groupedTemplates).map(([groupName, groupTemplates]) => (
        <div key={groupName} className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
            {groupName} ({groupTemplates.length}개)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupTemplates.map((template) => (
              <div key={template.id} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                {/* 카드 헤더 */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Settings className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold text-gray-900 truncate">
                          {template.name_ko || template.name}
                        </h4>
                        <p className="text-xs text-gray-500 truncate">{template.name}</p>
                      </div>
                    </div>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => setEditingTemplate(template)}
                        className="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded"
                        title="편집"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => onTemplateSelect?.(template)}
                        className="p-1 text-green-600 hover:text-green-900 hover:bg-green-50 rounded"
                        title="사용하기"
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
                </div>

                {/* 카드 본문 */}
                <div className="p-4 space-y-3">
                  {/* 이미지 */}
                  {template.image_url && (
                    <div className="relative w-full h-32 bg-gray-100 rounded-lg overflow-hidden">
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

                  {/* 카테고리와 타입 */}
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(template.category)}`}>
                      {getCategoryLabel(template.category)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {getChoiceTypeLabel(template.choice_type)}
                    </span>
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
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

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
              <label className="block text-sm font-medium text-gray-700 mb-1">템플릿 이름 (영문)</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">템플릿 이름 (한글)</label>
              <input
                type="text"
                value={formData.name_ko}
                onChange={(e) => setFormData({ ...formData, name_ko: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
            />
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
              <label className="block text-sm font-medium text-gray-700 mb-1">템플릿 그룹 (영문)</label>
              <input
                type="text"
                value={formData.template_group}
                onChange={(e) => setFormData({ ...formData, template_group: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="예: Accommodation"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">템플릿 그룹 (한글)</label>
              <input
                type="text"
                value={formData.template_group_ko}
                onChange={(e) => setFormData({ ...formData, template_group_ko: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="예: 숙박 선택"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">정렬 순서</label>
              <input
                type="number"
                value={formData.sort_order}
                onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
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