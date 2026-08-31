'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Folder,
  FolderPlus,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { flattenCategoryTree } from '@/lib/documentCategories'
import DocumentCategoryForm, {
  type ManagedDocumentCategory,
} from '@/components/documents/DocumentCategoryForm'

interface DocumentCategoryModalProps {
  onClose: () => void
  onSuccess: () => void
  editingCategory?: ManagedDocumentCategory | null
}

export default function DocumentCategoryModal({
  onClose,
  onSuccess,
}: DocumentCategoryModalProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<ManagedDocumentCategory[]>([])
  const [docCounts, setDocCounts] = useState<Record<string, number>>({})
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ManagedDocumentCategory | null>(null)
  const [lockedParentId, setLockedParentId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [{ data: categoryData, error: categoryError }, { data: documentData, error: documentError }] =
        await Promise.all([
          supabase.from('document_categories').select('*').order('sort_order'),
          supabase.from('documents').select('category_id'),
        ])

      if (categoryError) throw categoryError
      if (documentError) throw documentError

      setCategories((categoryData || []) as unknown as ManagedDocumentCategory[])
      const counts: Record<string, number> = {}
      for (const doc of documentData || []) {
        const id = (doc as { category_id?: string | null }).category_id
        if (!id) continue
        counts[id] = (counts[id] || 0) + 1
      }
      setDocCounts(counts)
    } catch (error) {
      console.error('카테고리 로드 오류:', error)
      toast.error('카테고리를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const treeRows = useMemo(() => flattenCategoryTree(categories), [categories])

  const openCreate = (parentId: string | null = null) => {
    setEditing(null)
    setLockedParentId(parentId)
    setFormOpen(true)
  }

  const openEdit = (category: ManagedDocumentCategory) => {
    setEditing(category)
    setLockedParentId(null)
    setFormOpen(true)
  }

  const handleSaved = () => {
    setFormOpen(false)
    setEditing(null)
    setLockedParentId(null)
    void load()
    onSuccess()
  }

  const handleDelete = async (category: ManagedDocumentCategory) => {
    const childCount = categories.filter((item) => item.parent_id === category.id).length
    const docCount = docCounts[category.id] || 0
    const message = [
      `"${category.name_ko}" 폴더를 삭제할까요?`,
      docCount > 0 ? `이 폴더의 문서 ${docCount}개는 미분류가 됩니다.` : null,
      childCount > 0 ? `하위 폴더 ${childCount}개는 한 단계 위로 이동합니다.` : null,
    ]
      .filter(Boolean)
      .join('\n')

    if (!confirm(message)) return

    try {
      setSaving(true)
      const { error: reparentError } = await supabase
        .from('document_categories')
        .update({ parent_id: category.parent_id || null } as never)
        .eq('parent_id', category.id)
      if (reparentError) throw reparentError

      const { error } = await supabase.from('document_categories').delete().eq('id', category.id)
      if (error) throw error

      toast.success('카테고리가 삭제되었습니다.')
      void load()
      onSuccess()
    } catch (error) {
      console.error('카테고리 삭제 오류:', error)
      toast.error('카테고리 삭제 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const title = formOpen
    ? editing
      ? '카테고리 수정'
      : lockedParentId
        ? '하위 폴더 추가'
        : '새 카테고리'
    : '카테고리 관리'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-xl sm:h-auto sm:max-h-[90vh] sm:rounded-lg">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-2">
            {formOpen ? (
              <button
                type="button"
                onClick={() => {
                  setFormOpen(false)
                  setEditing(null)
                  setLockedParentId(null)
                }}
                className="rounded p-1.5 text-gray-400 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-ring"
                title="목록으로"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            ) : null}
            <h2 className="truncate text-lg font-semibold text-gray-900 sm:text-xl">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {formOpen ? (
            <DocumentCategoryForm
              categories={categories}
              editingCategory={editing}
              lockedParentId={lockedParentId}
              onCancel={() => {
                setFormOpen(false)
                setEditing(null)
                setLockedParentId(null)
              }}
              onSaved={handleSaved}
            />
          ) : loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-gray-600">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              카테고리를 불러오는 중...
            </div>
          ) : (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => openCreate(null)}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                새 카테고리
              </button>

              {treeRows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">
                  아직 카테고리가 없습니다. 새 카테고리를 만들어 주세요.
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
                  {treeRows.map((category) => (
                    <li
                      key={category.id}
                      className="flex items-center gap-2 bg-white px-3 py-2.5 sm:px-4"
                      style={{ paddingLeft: `${12 + category.depth * 20}px` }}
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${category.color || '#6B7280'}20` }}
                      >
                        <Folder className="h-4 w-4" style={{ color: category.color || '#6B7280' }} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {category.name_ko}
                          {category.is_active === false ? (
                            <span className="ml-2 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                              비활성
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-gray-500">문서 {docCounts[category.id] || 0}개</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => openCreate(category.id)}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-50 hover:text-primary"
                          title="하위 폴더 추가"
                          disabled={saving}
                        >
                          <FolderPlus className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(category)}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700"
                          title="수정"
                          disabled={saving}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(category)}
                          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          title="삭제"
                          disabled={saving}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
