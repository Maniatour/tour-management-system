'use client'

import { Star } from 'lucide-react'
import { formatLasVegasDate, formatLasVegasDateTime } from '@/lib/dailyReport/dateUtils'
import { getReviewSourceLabel } from '@/lib/reviewSources'
import type { AdminGoogleReviewRow } from '@/lib/googleReviewAdmin'
import {
  isOtaReviewPlatformDue,
  otaLastActivityAt,
  type OtaReviewPlatformStatus,
} from '@/lib/reviewClassificationTodo'

export function otaUpdateCopy(
  platform: OtaReviewPlatformStatus,
  locale: string,
  due: boolean
): { lastLabel: string; prompt: string } {
  const isKo = locale === 'ko'
  const when = formatLasVegasDateTime(otaLastActivityAt(platform), locale)
  const lastLabel = when
    ? isKo
      ? `마지막 업데이트 ${when}`
      : `Last updated ${when}`
    : isKo
      ? '아직 확인한 기록이 없습니다'
      : 'No check recorded yet'

  if (!due) {
    return { lastLabel, prompt: '' }
  }

  if (!when) {
    return {
      lastLabel,
      prompt: isKo ? '오늘 채널을 확인하고 리뷰 없음을 눌러 주세요.' : 'Check the channel and mark No review.',
    }
  }

  return {
    lastLabel,
    prompt: isKo ? `${when}에 업데이트했으니 다시 업데이트하세요.` : `Last updated ${when}. Please update again.`,
  }
}

export function GoogleReviewQueueRow({
  review,
  locale,
  onOpen,
}: {
  review: AdminGoogleReviewRow
  locale: string
  onOpen: () => void
}) {
  const isKo = locale === 'ko'
  const dateLabel = formatLasVegasDate(review.reviewCreatedAt || review.importedAt, locale)
  const snippet = review.comment?.replace(/\s+/g, ' ').trim() ?? ''

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-md border border-amber-200/80 bg-amber-50/60 px-2 py-1.5 text-left transition hover:border-amber-300 hover:bg-amber-50"
    >
      <div className="flex items-center gap-1.5">
        <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-gray-900">
          {review.authorName ?? 'Google User'}
        </p>
        <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-medium text-amber-700">
          <Star className="h-3 w-3 fill-current" aria-hidden />
          {review.rating ?? '—'}
        </span>
        {dateLabel ? (
          <span className="shrink-0 text-[10px] tabular-nums text-gray-500">{dateLabel}</span>
        ) : null}
      </div>
      <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-gray-600">
        {snippet || (isKo ? '내용 없음' : 'No comment')}
      </p>
    </button>
  )
}

export function OtaPlatformRow({
  platform,
  locale,
  todayKey,
  saving,
  onMarkNoReview,
}: {
  platform: OtaReviewPlatformStatus
  locale: string
  todayKey: string
  saving: boolean
  onMarkNoReview: () => void
}) {
  const isKo = locale === 'ko'
  const due = isOtaReviewPlatformDue(platform, todayKey)
  const copy = otaUpdateCopy(platform, locale, due)
  const label = getReviewSourceLabel(platform.source, locale)

  return (
    <div
      className={`rounded-md border px-2 py-1.5 ${
        due ? 'border-orange-200 bg-orange-50/70' : 'border-gray-200/80 bg-white/80'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-gray-900">{label}</p>
          <p className="text-[10px] tabular-nums text-gray-500">{copy.lastLabel}</p>
          {copy.prompt ? (
            <p className={`text-[11px] leading-snug ${due ? 'text-orange-900' : 'text-gray-600'}`}>
              {copy.prompt}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={onMarkNoReview}
          className="inline-flex min-h-7 shrink-0 items-center rounded-md border border-gray-200 bg-white px-2 text-[10px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {isKo ? '리뷰 없음' : 'No review'}
        </button>
      </div>
    </div>
  )
}
