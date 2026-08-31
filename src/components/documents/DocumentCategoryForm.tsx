'use client'

import { useMemo, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  categoryOptionLabel,
  flattenCategoryTree,
  isDescendantCategory,
} from '@/lib/documentCategories'

export interface ManagedDocumentCategory {
  id: string
  name_ko: string
  name_en: string
  description_ko?: string | null
  description_en?: string | null
  color: string
  icon: string
  sort_order: number
  is_active: boolean
  parent_id?: string | null
  created_at: string
  updated_at: string
}

const CATEGORY_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#8B5CF6',
  '#EF4444',
  '#6B7280',
  '#F97316',
  '#84CC16',
  '#06B6D4',
  '#EC4899',
]

interface DocumentCategoryFormProps {
  categories: ManagedDocumentCategory[]
  editingCategory: ManagedDocumentCategory | null
  lockedParentId?: string | null
  onCancel: () => void
  onSaved: () => void
}

export default function DocumentCategoryForm({
  categories,
  editingCategory,
  lockedParentId = null,
  onCancel,
  onSaved,
}: DocumentCategoryFormProps) {
  const parentOptions = useMemo(() => {
    return flattenCategoryTree(categories).filter((category) => {
      if (!editingCategory) return true
      if (category.id === editingCategory.id) return false
      return !isDescendantCategory(categories, editingCategory.id, category.id)
    })
  }, [categories, editingCategory])

  const defaultParentId = editingCategory?.parent_id || lockedParentId || ''
  const parentCategory = categories.find((category) => category.id === (lockedParentId || defaultParentId))

  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name_ko: editingCategory?.name_ko || '',
    name_en: editingCategory?.name_en || '',
    description_ko: editingCategory?.description_ko || '',
    description_en: editingCategory?.description_en || '',
    color: editingCategory?.color || parentCategory?.color || '#3B82F6',
    icon: editingCategory?.icon || 'folder',
    sort_order: editingCategory?.sort_order ?? 0,
    is_active: editingCategory?.is_active ?? true,
    parent_id: defaultParentId,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const nameKo = formData.name_ko.trim()
    const nameEn = formData.name_en.trim() || nameKo
    if (!nameKo) {
      toast.error('카테고리 이름을 입력해주세요.')
      return
    }

    const parentId = lockedParentId || formData.parent_id || null

    try {
      setLoading(true)
      const categoryData = {
        name_ko: nameKo,
        name_en: nameEn,
        description_ko: String(formData.description_ko || '').trim() || null,
        description_en: String(formData.description_en || '').trim() || null,
        color: formData.color,
        icon: formData.icon,
        sort_order: formData.sort_order,
        is_active: formData.is_active,
        parent_id: parentId,
      }

      if (editingCategory) {
        const { error } = await supabase
          .from('document_categories')
          .update(categoryData as never)
          .eq('id', editingCategory.id)
        if (error) throw error
        toast.success('카테고리가 수정되었습니다.')
      } else {
        const { error } = await supabase.from('document_categories').insert(categoryData as never)
        if (error) throw error
        toast.success(parentId ? '하위 폴더가 생성되었습니다.' : '카테고리가 생성되었습니다.')
      }

      onSaved()
    } catch (error) {
      console.error('카테고리 저장 오류:', error)
      toast.error('카테고리 저장 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {lockedParentId ? (
        <p className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-gray-600">
          상위 폴더: <span className="font-medium text-gray-900">{parentCategory?.name_ko || '카테고리'}</span>
        </p>
      ) : (
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">상위 폴더</label>
          <select
            value={formData.parent_id}
            onChange={(e) => setFormData((prev) => ({ ...prev, parent_id: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">없음 (최상위)</option>
            {parentOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {categoryOptionLabel(category.name_ko, category.depth)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">한국어 이름 *</label>
          <input
            type="text"
            value={formData.name_ko}
            onChange={(e) => setFormData((prev) => ({ ...prev, name_ko: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="예: 계약/협약"
            required
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">영어 이름</label>
          <input
            type="text"
            value={formData.name_en}
            onChange={(e) => setFormData((prev) => ({ ...prev, name_en: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="비우면 한국어 이름을 사용합니다"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">설명</label>
        <textarea
          value={formData.description_ko}
          onChange={(e) => setFormData((prev) => ({ ...prev, description_ko: e.target.value }))}
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="이 폴더에 어떤 문서를 넣을지 적어 주세요"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">색상</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, color }))}
              className={`h-8 w-8 rounded-full border-2 ${
                formData.color === color ? 'border-gray-800' : 'border-gray-300'
              }`}
              style={{ backgroundColor: color }}
              aria-label={color}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="is_active"
          checked={formData.is_active}
          onChange={(e) => setFormData((prev) => ({ ...prev, is_active: e.target.checked }))}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring"
        />
        <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
          활성 상태
        </label>
      </div>

      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {editingCategory ? '수정' : lockedParentId ? '폴더 추가' : '생성'}
        </button>
      </div>
    </form>
  )
}
