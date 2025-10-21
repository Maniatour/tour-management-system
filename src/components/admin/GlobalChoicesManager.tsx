'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Edit, Trash2, Settings, Copy, Eye } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface GlobalChoiceTemplate {
  id: string
  template_name: string
  template_name_ko: string
  description?: string
  choice_type: 'single' | 'multiple' | 'quantity'
  is_required: boolean
  min_selections: number
  max_selections: number
  category?: string
  tags?: string[]
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
  options?: GlobalChoiceTemplateOption[]
}

interface GlobalChoiceTemplateOption {
  id: string
  template_id: string
  option_key: string
  option_name: string
  option_name_ko: string
  description?: string
  adult_price: number
  child_price: number
  infant_price: number
  capacity: number
  is_default: boolean
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

interface GlobalChoicesManagerProps {
  onTemplateSelect?: (template: GlobalChoiceTemplate) => void
}

export default function GlobalChoicesManager({ onTemplateSelect }: GlobalChoicesManagerProps) {
  const [templates, setTemplates] = useState<GlobalChoiceTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<GlobalChoiceTemplate | null>(null)
  const [showOptions, setShowOptions] = useState<string | null>(null)

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('global_choice_templates')
        .select(`
          *,
          options:global_choice_template_options(*)
        `)
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

  const handleAddTemplate = async (template: Omit<GlobalChoiceTemplate, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const newTemplate = {
        id: crypto.randomUUID(),
        template_name: template.template_name,
        template_name_ko: template.template_name_ko,
        description: template.description,
        choice_type: template.choice_type,
        is_required: template.is_required,
        min_selections: template.min_selections,
        max_selections: template.max_selections,
        category: template.category,
        tags: template.tags || [],
        sort_order: template.sort_order,
        is_active: template.is_active
      }

      const { data, error } = await supabase
        .from('global_choice_templates')
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

  const handleEditTemplate = async (template: Omit<GlobalChoiceTemplate, 'id' | 'created_at' | 'updated_at'>) => {
    if (editingTemplate) {
      try {
        const updatedTemplate = {
          template_name: template.template_name,
          template_name_ko: template.template_name_ko,
          description: template.description,
          choice_type: template.choice_type,
          is_required: template.is_required,
          min_selections: template.min_selections,
          max_selections: template.max_selections,
          category: template.category,
          tags: template.tags || [],
          sort_order: template.sort_order,
          is_active: template.is_active
        }

        const { error } = await supabase
          .from('global_choice_templates')
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
          .from('global_choice_templates')
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

  const getCategoryColor = (category?: string) => {
    const categoryColors: Record<string, string> = {
      'accommodation': 'bg-blue-100 text-blue-800',
      'transportation': 'bg-green-100 text-green-800',
      'meal': 'bg-orange-100 text-orange-800',
      'activity': 'bg-purple-100 text-purple-800',
      'insurance': 'bg-indigo-100 text-indigo-800',
      'equipment': 'bg-amber-100 text-amber-800'
    }
    
    return categoryColors[category || ''] || 'bg-gray-100 text-gray-800'
  }

  const getCategoryLabel = (category?: string) => {
    const categoryLabels: Record<string, string> = {
      'accommodation': '숙박',
      'transportation': '교통',
      'meal': '식사',
      'activity': '액티비티',
      'insurance': '보험',
      'equipment': '장비'
    }
    
    return categoryLabels[category || ''] || category || '기타'
  }

  const getChoiceTypeLabel = (type: string) => {
    const typeLabels: Record<string, string> = {
      'single': '단일 선택',
      'multiple': '다중 선택',
      'quantity': '수량 선택'
    }
    
    return typeLabels[type] || type
  }

  const categories = ['all', ...Array.from(new Set(templates.map(t => t.category).filter(Boolean))).sort()]

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.template_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.template_name_ko.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (template.description && template.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (template.tags && template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
    
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory
    
    return matchesSearch && matchesCategory
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">로딩 중...</div>
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
          onClick={() => setShowAddForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>템플릿 추가</span>
        </button>
      </div>

      {/* 템플릿 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map((template) => (
          <div key={template.id} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            {/* 카드 헤더 */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Settings className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{template.template_name_ko}</h3>
                    <p className="text-xs text-gray-500 truncate">{template.template_name}</p>
                  </div>
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => setShowOptions(showOptions === template.id ? null : template.id)}
                    className="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded"
                    title="옵션 보기"
                  >
                    <Eye size={14} />
                  </button>
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

              {/* 옵션 개수 */}
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>옵션 {template.options?.length || 0}개</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  template.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {template.is_active ? '활성' : '비활성'}
                </span>
              </div>
            </div>

            {/* 옵션 목록 (펼쳐진 경우) */}
            {showOptions === template.id && template.options && template.options.length > 0 && (
              <div className="border-t border-gray-100 p-4 bg-gray-50">
                <h4 className="text-sm font-medium text-gray-900 mb-2">옵션 목록</h4>
                <div className="space-y-2">
                  {template.options.map((option) => (
                    <div key={option.id} className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-medium">{option.option_name_ko}</span>
                        <span className="text-gray-500 ml-2">({option.option_name})</span>
                      </div>
                      <div className="text-gray-500">
                        성인: ${option.adult_price} | 아동: ${option.child_price}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

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
    </div>
  )
}

interface TemplateFormProps {
  template?: GlobalChoiceTemplate | null
  onSubmit: (template: Omit<GlobalChoiceTemplate, 'id' | 'created_at' | 'updated_at'>) => void
  onCancel: () => void
}

function TemplateForm({ template, onSubmit, onCancel }: TemplateFormProps) {
  const [formData, setFormData] = useState({
    template_name: template?.template_name || '',
    template_name_ko: template?.template_name_ko || '',
    description: template?.description || '',
    choice_type: template?.choice_type || 'single' as 'single' | 'multiple' | 'quantity',
    is_required: template?.is_required ?? true,
    min_selections: template?.min_selections || 1,
    max_selections: template?.max_selections || 1,
    category: template?.category || '',
    tags: template?.tags || [],
    sort_order: template?.sort_order || 0,
    is_active: template?.is_active ?? true
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
                value={formData.template_name}
                onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">템플릿 이름 (한글)</label>
              <input
                type="text"
                value={formData.template_name_ko}
                onChange={(e) => setFormData({ ...formData, template_name_ko: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
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
              <label className="block text-sm font-medium text-gray-700 mb-1">정렬 순서</label>
              <input
                type="number"
                value={formData.sort_order}
                onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
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
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="mr-2"
              />
              활성 상태
            </label>
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
