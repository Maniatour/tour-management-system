'use client'

import React, { useState, useEffect } from 'react'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  Palette,
  Tag
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface TourCourseCategory {
  id: string
  name_ko: string
  name_en: string
  description_ko?: string
  description_en?: string
  color: string
  icon: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

interface CategoryManagementModalProps {
  isOpen: boolean
  onClose: () => void
  onCategorySelect: (category: TourCourseCategory) => void
  selectedCategoryId?: string
}

const ICON_OPTIONS = [
  'map-pin', 'building', 'trees', 'mountain', 'landmark', 
  'utensils', 'moon', 'star', 'camera', 'compass', 'flag'
]

const COLOR_OPTIONS = [
  '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', 
  '#6366F1', '#06B6D4', '#84CC16', '#F97316', '#EC4899'
]

export default function CategoryManagementModal({ 
  isOpen, 
  onClose, 
  onCategorySelect,
  selectedCategoryId 
}: CategoryManagementModalProps) {
  const [categories, setCategories] = useState<TourCourseCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [editingCategory, setEditingCategory] = useState<TourCourseCategory | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState({
    name_ko: '',
    name_en: '',
    description_ko: '',
    description_en: '',
    color: '#3B82F6',
    icon: 'map-pin',
    sort_order: 0
  })

  // 카테고리 목록 로드
  const loadCategories = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('tour_course_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error('카테고리 로드 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadCategories()
    }
  }, [isOpen])

  // 카테고리 저장
  const saveCategory = async () => {
    if (!formData.name_ko.trim() || !formData.name_en.trim()) {
      alert('한국어와 영어 이름을 모두 입력해주세요.')
      return
    }

    setLoading(true)
    try {
      if (editingCategory) {
        // 수정
        const { error } = await supabase
          .from('tour_course_categories')
          .update({
            name_ko: formData.name_ko,
            name_en: formData.name_en,
            description_ko: formData.description_ko || null,
            description_en: formData.description_en || null,
            color: formData.color,
            icon: formData.icon,
            sort_order: formData.sort_order
          })
          .eq('id', editingCategory.id)

        if (error) throw error
      } else {
        // 생성
        const { error } = await supabase
          .from('tour_course_categories')
          .insert({
            name_ko: formData.name_ko,
            name_en: formData.name_en,
            description_ko: formData.description_ko || null,
            description_en: formData.description_en || null,
            color: formData.color,
            icon: formData.icon,
            sort_order: formData.sort_order
          })

        if (error) throw error
      }

      await loadCategories()
      resetForm()
    } catch (error) {
      console.error('카테고리 저장 오류:', error)
      alert('카테고리 저장 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 카테고리 삭제
  const deleteCategory = async (categoryId: string) => {
    if (!confirm('이 카테고리를 삭제하시겠습니까?')) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('tour_course_categories')
        .update({ is_active: false })
        .eq('id', categoryId)

      if (error) throw error
      await loadCategories()
    } catch (error) {
      console.error('카테고리 삭제 오류:', error)
      alert('카테고리 삭제 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 폼 초기화
  const resetForm = () => {
    setFormData({
      name_ko: '',
      name_en: '',
      description_ko: '',
      description_en: '',
      color: '#3B82F6',
      icon: 'map-pin',
      sort_order: categories.length
    })
    setEditingCategory(null)
    setIsCreating(false)
  }

  // 편집 시작
  const startEdit = (category: TourCourseCategory) => {
    setFormData({
      name_ko: category.name_ko,
      name_en: category.name_en,
      description_ko: category.description_ko || '',
      description_en: category.description_en || '',
      color: category.color,
      icon: category.icon,
      sort_order: category.sort_order
    })
    setEditingCategory(category)
    setIsCreating(false)
  }

  // 새 카테고리 생성 시작
  const startCreate = () => {
    resetForm()
    setIsCreating(true)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">투어 코스 카테고리 관리</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 새 카테고리 추가 버튼 */}
        <div className="mb-6">
          <button
            onClick={startCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            새 카테고리 추가
          </button>
        </div>

        {/* 카테고리 목록 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {categories.map((category) => (
            <div
              key={category.id}
              className={`border rounded-lg p-4 cursor-pointer transition-all ${
                selectedCategoryId === category.id 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => onCategorySelect(category)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <span className="font-medium text-gray-900">{category.name_ko}</span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      startEdit(category)
                    }}
                    className="p-1 text-gray-400 hover:text-blue-600"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteCategory(category.id)
                    }}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-600">{category.name_en}</p>
              {category.description_ko && (
                <p className="text-xs text-gray-500 mt-1">{category.description_ko}</p>
              )}
            </div>
          ))}
        </div>

        {/* 카테고리 편집/생성 폼 */}
        {(editingCategory || isCreating) && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">
              {editingCategory ? '카테고리 수정' : '새 카테고리 생성'}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  한국어 이름 *
                </label>
                <input
                  type="text"
                  value={formData.name_ko}
                  onChange={(e) => setFormData({ ...formData, name_ko: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="예: 투어 포인트"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  영어 이름 *
                </label>
                <input
                  type="text"
                  value={formData.name_en}
                  onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="예: Tour Point"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  한국어 설명
                </label>
                <textarea
                  value={formData.description_ko}
                  onChange={(e) => setFormData({ ...formData, description_ko: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={2}
                  placeholder="카테고리 설명을 입력하세요"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  영어 설명
                </label>
                <textarea
                  value={formData.description_en}
                  onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={2}
                  placeholder="Category description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  색상
                </label>
                <div className="flex gap-2 flex-wrap">
                  {COLOR_OPTIONS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-8 h-8 rounded-full border-2 ${
                        formData.color === color ? 'border-gray-400' : 'border-gray-200'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  아이콘
                </label>
                <select
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {ICON_OPTIONS.map((icon) => (
                    <option key={icon} value={icon}>
                      {icon}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  정렬 순서
                </label>
                <input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="0"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={saveCategory}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                저장
              </button>
              <button
                onClick={resetForm}
                className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                <X className="w-4 h-4" />
                취소
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
