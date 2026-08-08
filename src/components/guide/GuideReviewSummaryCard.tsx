'use client'

import { useMemo } from 'react'
import type { GuideReviewSummary } from '@/lib/guideReviews'

export type GuideReviewRatingFilter = 'five' | 'four' | 'three' | 'two' | 'one'

type Props = {
  summary: GuideReviewSummary
  locale: string
  selectedFilter?: GuideReviewRatingFilter | null
  onFilterChange?: (filter: GuideReviewRatingFilter | null) => void
  /** When false, distribution rows are display-only (customer pages). Default true. */
  interactive?: boolean
  className?: string
}

type DistributionRow = {
  key: GuideReviewRatingFilter
  labelEn: string
  labelKo: string
  count: number
}

export function matchesGuideReviewRatingFilter(
  rating: number,
  filter: GuideReviewRatingFilter | null | undefined
): boolean {
  if (!filter) return true
  switch (filter) {
    case 'five':
      return rating >= 5
    case 'four':
      return rating >= 4 && rating < 5
    case 'three':
      return rating >= 3 && rating < 4
    case 'two':
      return rating >= 2 && rating < 3
    case 'one':
      return rating < 2
    default:
      return true
  }
}

function overallLabel(avg: number, isKo: boolean): string {
  if (avg >= 4.5) return isKo ? '최고' : 'Excellent'
  if (avg >= 4.0) return isKo ? '매우 좋음' : 'Very Good'
  if (avg >= 3.5) return isKo ? '좋음' : 'Good'
  if (avg >= 3.0) return isKo ? '보통' : 'Average'
  if (avg >= 2.0) return isKo ? '나쁨' : 'Poor'
  return isKo ? '최악' : 'Terrible'
}

function CircleRating({ rating, total }: { rating: number; total: number }) {
  const full = Math.floor(rating)
  const hasHalf = rating - full >= 0.25 && rating - full < 0.75
  const extraFull = rating - full >= 0.75 ? 1 : 0
  const filled = Math.min(5, full + extraFull)

  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      {Array.from({ length: 5 }).map((_, index) => {
        const isFilled = index < filled
        const isHalf = !isFilled && hasHalf && index === filled
        return (
          <span
            key={index}
            className={`relative h-3.5 w-3.5 rounded-full border ${
              isFilled
                ? 'border-emerald-600 bg-emerald-600'
                : isHalf
                  ? 'border-emerald-600 bg-emerald-600/40'
                  : 'border-gray-300 bg-gray-200'
            }`}
          />
        )
      })}
      <span className="text-sm text-muted-foreground tabular-nums">({total})</span>
    </div>
  )
}

function DistributionBar({
  label,
  count,
  maxCount,
  selected,
  onSelect,
  interactive,
}: {
  label: string
  count: number
  maxCount: number
  selected: boolean
  onSelect: () => void
  interactive: boolean
}) {
  const widthPercent = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0

  const content = (
    <>
      <span
        className={`w-20 shrink-0 font-medium ${
          selected ? 'text-emerald-800' : 'text-muted-foreground'
        }`}
      >
        {label}
      </span>
      <div className="flex-1 h-2.5 rounded-full bg-gray-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-700 transition-all duration-300"
          style={{ width: `${widthPercent}%` }}
        />
      </div>
      <span className="w-6 shrink-0 text-right tabular-nums text-foreground font-medium">
        {count}
      </span>
    </>
  )

  if (!interactive) {
    return (
      <div className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-left">
        {content}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-left transition-colors ${
        selected
          ? 'bg-emerald-50 ring-1 ring-emerald-600/40'
          : 'hover:bg-muted/60'
      }`}
    >
      {content}
    </button>
  )
}

export default function GuideReviewSummaryCard({
  summary,
  locale,
  selectedFilter = null,
  onFilterChange,
  interactive = true,
  className,
}: Props) {
  const isKo = locale === 'ko'
  const avg = summary.avgRating ?? 0

  const distribution: DistributionRow[] = useMemo(
    () => [
      {
        key: 'five',
        labelEn: 'Excellent',
        labelKo: '최고',
        count: summary.fiveStarCount,
      },
      {
        key: 'four',
        labelEn: 'Good',
        labelKo: '좋음',
        count: summary.fourStarCount,
      },
      {
        key: 'three',
        labelEn: 'Average',
        labelKo: '보통',
        count: summary.threeStarCount,
      },
      {
        key: 'two',
        labelEn: 'Poor',
        labelKo: '나쁨',
        count: summary.twoStarCount,
      },
      {
        key: 'one',
        labelEn: 'Terrible',
        labelKo: '최악',
        count: summary.oneStarCount,
      },
    ],
    [summary]
  )

  const maxCount = Math.max(...distribution.map((row) => row.count), 1)

  if (summary.reviewCount === 0) {
    return (
      <div className="border-b border-border/60 bg-muted/20 px-3 py-6 text-center text-sm text-muted-foreground sm:px-4">
        {isKo ? '아직 연결된 리뷰가 없습니다.' : 'No linked reviews yet.'}
      </div>
    )
  }

  return (
    <div
      className={
        className ??
        'border-b border-border/60 bg-white px-3 py-4 sm:px-4 sm:py-5'
      }
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex shrink-0 flex-col items-center justify-center bg-gray-50 px-4 py-5 sm:min-w-[140px] sm:rounded-xl">
          <p className="text-4xl font-bold tabular-nums text-foreground leading-none">
            {avg.toFixed(2)}
          </p>
          <p className="mt-2 text-sm font-medium text-muted-foreground">
            {overallLabel(avg, isKo)}
          </p>
          <div className="mt-3">
            <CircleRating rating={avg} total={summary.reviewCount} />
          </div>
        </div>

        <div
          className="flex-1 space-y-1 min-w-0"
          role="group"
          aria-label={
            interactive
              ? isKo
                ? '평점 필터'
                : 'Rating filter'
              : isKo
                ? '평점 분포'
                : 'Rating distribution'
          }
        >
          {distribution.map((row) => (
            <DistributionBar
              key={row.key}
              label={isKo ? row.labelKo : row.labelEn}
              count={row.count}
              maxCount={maxCount}
              selected={interactive && selectedFilter === row.key}
              interactive={interactive}
              onSelect={() => {
                if (!onFilterChange) return
                onFilterChange(selectedFilter === row.key ? null : row.key)
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
