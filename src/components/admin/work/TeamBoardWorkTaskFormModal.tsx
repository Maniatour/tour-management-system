'use client'

import { X } from 'lucide-react'
import type { TeamBoardTaskFormState } from '@/hooks/useTeamBoardWorkData'
import type { TeamBoardTask } from '@/lib/teamBoard/workTypes'
import { HubArticleManualLinkField } from '@/components/team-board/HubArticleManualLinkField'
import { useTeamBoardManualOptional } from '@/contexts/TeamBoardManualContext'

type TeamBoardWorkTaskFormModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  locale: string
  values: TeamBoardTaskFormState
  onChange: (next: TeamBoardTaskFormState) => void
  onClose: () => void
  onSave: () => void | Promise<void>
  saving?: boolean
}

export function TeamBoardWorkTaskFormModal({
  open,
  mode,
  locale,
  values,
  onChange,
  onClose,
  onSave,
  saving = false,
}: TeamBoardWorkTaskFormModalProps) {
  if (!open) return null
  const isKo = locale === 'ko'
  const manualCtx = useTeamBoardManualOptional()

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {mode === 'create' ? (isKo ? '새 업무 추가' : 'Add task') : isKo ? '업무 수정' : 'Edit task'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label={isKo ? '닫기' : 'Close'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              {isKo ? '제목' : 'Title'}
            </label>
            <input
              value={values.title}
              onChange={(e) => onChange({ ...values, title: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder={isKo ? '업무 제목' : 'Task title'}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              {isKo ? '설명' : 'Description'}
            </label>
            <textarea
              value={values.description}
              onChange={(e) => onChange({ ...values, description: e.target.value })}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder={isKo ? '업무 설명' : 'Description'}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-800">
                {isKo ? '마감일' : 'Due date'}
              </label>
              <input
                type="datetime-local"
                value={values.due_date}
                onChange={(e) => onChange({ ...values, due_date: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-800">
                {isKo ? '우선순위' : 'Priority'}
              </label>
              <select
                value={values.priority}
                onChange={(e) =>
                  onChange({ ...values, priority: e.target.value as TeamBoardTask['priority'] })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="low">{isKo ? '낮음' : 'Low'}</option>
                <option value="medium">{isKo ? '보통' : 'Medium'}</option>
                <option value="high">{isKo ? '높음' : 'High'}</option>
                <option value="urgent">{isKo ? '긴급' : 'Urgent'}</option>
              </select>
            </div>
          </div>

          {mode === 'edit' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-800">
                {isKo ? '상태' : 'Status'}
              </label>
              <select
                value={values.status}
                onChange={(e) =>
                  onChange({ ...values, status: e.target.value as TeamBoardTask['status'] })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="pending">{isKo ? '대기' : 'Pending'}</option>
                <option value="in_progress">{isKo ? '진행중' : 'In progress'}</option>
                <option value="completed">{isKo ? '완료' : 'Completed'}</option>
                <option value="cancelled">{isKo ? '취소' : 'Cancelled'}</option>
              </select>
            </div>
          )}

          <HubArticleManualLinkField
            locale={locale}
            value={values.linked_hub_article_id}
            onChange={(linked_hub_article_id) => onChange({ ...values, linked_hub_article_id })}
            hubArticles={manualCtx?.hubArticles ?? []}
            loading={manualCtx?.hubArticlesLoading ?? false}
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-white disabled:opacity-50"
          >
            {isKo ? '취소' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saving || !values.title.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? (isKo ? '저장 중...' : 'Saving...') : mode === 'create' ? (isKo ? '추가' : 'Add') : isKo ? '저장' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
