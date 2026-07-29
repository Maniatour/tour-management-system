'use client'

import { X } from 'lucide-react'
import type { TeamBoardAnnouncementFormState } from '@/hooks/useTeamBoardWorkData'
import { HubArticleManualLinkField } from '@/components/team-board/HubArticleManualLinkField'
import { useTeamBoardManualOptional } from '@/contexts/TeamBoardManualContext'

type TeamBoardWorkAnnouncementFormModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  locale: string
  values: TeamBoardAnnouncementFormState
  onChange: (next: TeamBoardAnnouncementFormState) => void
  onClose: () => void
  onSave: () => void | Promise<void>
  saving?: boolean
}

export function TeamBoardWorkAnnouncementFormModal({
  open,
  mode,
  locale,
  values,
  onChange,
  onClose,
  onSave,
  saving = false,
}: TeamBoardWorkAnnouncementFormModalProps) {
  if (!open) return null
  const isKo = locale === 'ko'
  const manualCtx = useTeamBoardManualOptional()

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {mode === 'create'
              ? isKo
                ? '새 전달사항 추가'
                : 'Add announcement'
              : isKo
                ? '전달사항 수정'
                : 'Edit announcement'}
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
              placeholder={isKo ? '전달사항 제목' : 'Title'}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              {isKo ? '내용' : 'Content'}
            </label>
            <textarea
              value={values.content}
              onChange={(e) => onChange({ ...values, content: e.target.value })}
              rows={4}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder={isKo ? '전달 내용' : 'Content'}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-800">
                {isKo ? '우선순위' : 'Priority'}
              </label>
              <select
                value={values.priority}
                onChange={(e) =>
                  onChange({
                    ...values,
                    priority: e.target.value as TeamBoardAnnouncementFormState['priority'],
                  })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="normal">{isKo ? '보통' : 'Normal'}</option>
                <option value="low">{isKo ? '낮음' : 'Low'}</option>
                <option value="high">{isKo ? '높음' : 'High'}</option>
                <option value="urgent">{isKo ? '긴급' : 'Urgent'}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-800">
                {isKo ? '태그' : 'Tags'}
              </label>
              <input
                value={values.tags}
                onChange={(e) => onChange({ ...values, tags: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder={isKo ? '예: 긴급, 회의' : 'e.g. urgent, meeting'}
              />
            </div>
          </div>

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
            disabled={saving || !values.title.trim() || !values.content.trim()}
            className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {saving ? (isKo ? '저장 중...' : 'Saving...') : mode === 'create' ? (isKo ? '추가' : 'Add') : isKo ? '저장' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
