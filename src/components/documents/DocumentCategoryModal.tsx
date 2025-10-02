'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { 
  X, 
  Save, 
  Loader2,
  Palette,
  Folder,
  Trash2
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface DocumentCategory {
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

interface DocumentCategoryModalProps {
  onClose: () => void
  onSuccess: () => void
  editingCategory?: DocumentCategory | null
}

const CATEGORY_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#8B5CF6', // violet
  '#EF4444', // red
  '#6B7280', // gray
  '#F97316', // orange
  '#84CC16', // lime
  '#06B6D4', // cyan
  '#EC4899', // pink
]

const CATEGORY_ICONS = [
  'file-signature',
  'shield-check',
  'truck',
  'id-card',
  'calculator',
  'folder',
  'file-text',
  'briefcase',
  'home',
  'users',
  'settings',
  'book',
  'clipboard',
  'archive',
  'star'
]

export default function DocumentCategoryModal({
  onClose,
  onSuccess,
  editingCategory
}: DocumentCategoryModalProps) {
  const t = useTranslations('documents')
  
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name_ko: editingCategory?.name_ko || '',
    name_en: editingCategory?.name_en || '',
    description_ko: editingCategory?.description_ko || '',
    description_en: editingCategory?.description_en || '',
    color: editingCategory?.color || '#3B82F6',
    icon: editingCategory?.icon || 'folder',
    sort_order: editingCategory?.sort_order || 0,
    is_active: editingCategory?.is_active ?? true
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name_ko.trim() || !formData.name_en.trim()) {
      toast.error('카테고리 이름을 입력해주세요.')
      return
    }

    try {
      setLoading(true)
      
      const categoryData = {
        name_ko: formData.name_ko.trim(),
        name_en: formData.name_en.trim(),
        description_ko: formData.description_ko.trim() || null,
        description_en: formData.description_en.trim() || null,
        color: formData.color,
        icon: formData.icon,
        sort_order: formData.sort_order,
        is_active: formData.is_active
      }
      
      if (editingCategory) {
        // 카테고리 수정
        const { error } = await supabase
          .from('document_categories')
          .update(categoryData)
          .eq('id', editingCategory.id)
        
        if (error) throw error
        
        toast.success('카테고리가 수정되었습니다.')
      } else {
        // 새 카테고리 생성
        const { error } = await supabase
          .from('document_categories')
          .insert(categoryData)
        
        if (error) throw error
        
        toast.success('카테고리가 생성되었습니다.')
      }
      
      onSuccess()
    } catch (error) {
      console.error('카테고리 저장 오류:', error)
      toast.error('카테고리 저장 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!editingCategory) return
    
    if (!confirm('정말로 이 카테고리를 삭제하시겠습니까? 이 카테고리에 속한 문서들은 미분류로 변경됩니다.')) {
      return
    }

    try {
      setLoading(true)
      
      const { error } = await supabase
        .from('document_categories')
        .delete()
        .eq('id', editingCategory.id)
      
      if (error) throw error
      
      toast.success('카테고리가 삭제되었습니다.')
      onSuccess()
    } catch (error) {
      console.error('카테고리 삭제 오류:', error)
      toast.error('카테고리 삭제 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
        <div className="p-6">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {editingCategory ? '카테고리 수정' : '새 카테고리'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 카테고리 이름 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  한국어 이름 *
                </label>
                <input
                  type="text"
                  value={formData.name_ko}
                  onChange={(e) => setFormData(prev => ({ ...prev, name_ko: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="예: 계약/협약"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  영어 이름 *
                </label>
                <input
                  type="text"
                  value={formData.name_en}
                  onChange={(e) => setFormData(prev => ({ ...prev, name_en: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="예: Contracts/Agreements"
                  required
                />
              </div>
            </div>

            {/* 설명 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  한국어 설명
                </label>
                <textarea
                  value={formData.description_ko}
                  onChange={(e) => setFormData(prev => ({ ...prev, description_ko: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="카테고리에 대한 설명을 입력하세요"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  영어 설명
                </label>
                <textarea
                  value={formData.description_en}
                  onChange={(e) => setFormData(prev => ({ ...prev, description_en: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter description for this category"
                />
              </div>
            </div>

            {/* 색상 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                색상
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, color }))}
                    className={`w-8 h-8 rounded-full border-2 ${
                      formData.color === color ? 'border-gray-800' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* 아이콘 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                아이콘
              </label>
              <div className="grid grid-cols-5 gap-2">
                {CATEGORY_ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, icon }))}
                    className={`p-2 rounded border ${
                      formData.icon === icon 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <Folder className="w-4 h-4 mx-auto" />
                  </button>
                ))}
              </div>
            </div>

            {/* 정렬 순서 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                정렬 순서
              </label>
              <input
                type="number"
                min="0"
                value={formData.sort_order}
                onChange={(e) => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* 활성 상태 */}
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                활성 상태
              </label>
            </div>

            {/* 버튼 */}
            <div className="flex items-center justify-between pt-6 border-t">
              <div>
                {editingCategory && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>삭제</span>
                  </button>
                )}
              </div>
              
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>저장 중...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>{editingCategory ? '수정' : '생성'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
