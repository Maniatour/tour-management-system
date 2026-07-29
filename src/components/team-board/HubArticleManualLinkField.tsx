'use client'

import { BookOpen } from 'lucide-react'
import type { HubArticleLinkOption } from '@/lib/hubArticleManualLink'
import { HubArticlePickerDropdown } from '@/components/team-board/HubArticlePickerDropdown'

type HubArticleManualLinkFieldProps = {
  locale: string
  value: string | null | undefined
  onChange: (articleId: string | null) => void
  hubArticles: HubArticleLinkOption[]
  loading?: boolean
  loadFailed?: boolean
  onRetry?: (() => void) | undefined
  compact?: boolean
}

export function HubArticleManualLinkField({
  locale,
  value,
  onChange,
  hubArticles,
  loading = false,
  loadFailed = false,
  onRetry,
  compact = false,
}: HubArticleManualLinkFieldProps) {
  const isKo = locale === 'ko'

  return (
    <HubArticlePickerDropdown
      mode="single"
      locale={locale}
      value={value}
      onChange={onChange}
      hubArticles={hubArticles}
      loading={loading}
      loadFailed={loadFailed}
      onRetry={onRetry}
      compact={compact}
      label={
        <span className="inline-flex items-center gap-1">
          <BookOpen className="h-3.5 w-3.5 text-indigo-600" aria-hidden />
          {isKo ? '메뉴얼 연결' : 'Linked manual'}
        </span>
      }
      hint={
        !value?.trim()
          ? isKo
            ? '카드 클릭 시 운영 허브 메뉴얼을 모달로 엽니다.'
            : 'Card click opens the linked Operations Hub manual in a modal.'
          : undefined
      }
    />
  )
}
