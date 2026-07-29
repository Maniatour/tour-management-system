'use client'

import { BookOpen } from 'lucide-react'
import type { HubArticleLinkOption } from '@/lib/hubArticleManualLink'
import { HubArticlePickerDropdown } from '@/components/team-board/HubArticlePickerDropdown'

type StaffSiteAlertHubAttachmentPickerProps = {
  locale: string
  value: string[]
  onChange: (articleIds: string[]) => void
  hubArticles: HubArticleLinkOption[]
  loading?: boolean
  loadFailed?: boolean
  onRetry?: () => void
}

export function StaffSiteAlertHubAttachmentPicker({
  locale,
  value,
  onChange,
  hubArticles,
  loading = false,
  loadFailed = false,
  onRetry,
}: StaffSiteAlertHubAttachmentPickerProps) {
  const isKo = locale.startsWith('ko')

  return (
    <div className="space-y-2 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-indigo-600" aria-hidden />
        <div>
          <p className="text-sm font-medium text-gray-900">
            {isKo ? '운영 허브 문서 첨부 (선택)' : 'Attach Operations Hub docs (optional)'}
          </p>
          <p className="text-xs text-gray-500">
            {isKo
              ? '수신자가 알림에서 문서를 바로 열어볼 수 있습니다.'
              : 'Recipients can open attached docs from the alert popup.'}
          </p>
        </div>
      </div>

      <HubArticlePickerDropdown
        mode="multiple"
        locale={locale}
        value={value}
        onChange={onChange}
        hubArticles={hubArticles}
        loading={loading}
        loadFailed={loadFailed}
        {...(onRetry ? { onRetry } : {})}
        compact
        zIndexClass="z-[100]"
        placeholder={isKo ? '문서 선택…' : 'Select documents…'}
        {...(value.length === 0
          ? {
              hint: isKo
                ? '드롭다운에서 검색·카테고리별로 문서를 선택하세요.'
                : 'Open the dropdown to search and pick documents by category.',
            }
          : {})}
      />
    </div>
  )
}
