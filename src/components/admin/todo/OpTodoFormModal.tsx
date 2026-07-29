'use client'

import { useEffect } from 'react'
import { Trash2, X } from 'lucide-react'
import { OpTodoFormFields, type OpTodoFormValues } from '@/components/admin/todo/OpTodoFormFields'
import { useHubArticlesForManualLink } from '@/hooks/useHubArticlesForManualLink'

type OpTodoFormModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  locale: string
  values: OpTodoFormValues
  onChange: (next: OpTodoFormValues) => void
  onClose: () => void
  onSave: () => void | Promise<void>
  onDelete?: () => void | Promise<void>
  saving?: boolean
}

export function OpTodoFormModal({
  open,
  mode,
  locale,
  values,
  onChange,
  onClose,
  onSave,
  onDelete,
  saving = false,
}: OpTodoFormModalProps) {
  const { articles: hubArticles, loading: hubArticlesLoading, loadFailed, reload } =
    useHubArticlesForManualLink(open)

  useEffect(() => {
    if (!open) return
    void reload()
  }, [open, reload])

  if (!open) return null

  const title = mode === 'create' ? '새 Todo 추가' : 'Todo 수정'

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <OpTodoFormFields
            locale={locale}
            value={values}
            onChange={onChange}
            hubArticles={hubArticles}
            hubArticlesLoading={hubArticlesLoading}
            hubArticlesLoadFailed={loadFailed}
            onRetryHubArticles={() => void reload()}
          />
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-gray-100 bg-gray-50 px-5 py-4">
          {mode === 'edit' && onDelete ? (
            <button
              type="button"
              onClick={() => void onDelete()}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              삭제
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-white disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={saving || !values.title.trim()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? '저장 중...' : mode === 'create' ? '추가' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
