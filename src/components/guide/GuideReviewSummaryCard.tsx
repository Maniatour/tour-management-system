'use client'

import { useMemo } from 'react'
import type { GuideReviewSummary } from '@/lib/guideReviews'

type Props = {
  summary: GuideReviewSummary
  locale: string
}

type DistributionRow = {
  key: 'five' | 'four' | 'three' | 'two' | 'one'
  labelEn: string
  labelKo: string
  count: number
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
}: {
  label: string
  count: number
  maxCount: number
}) {
  const widthPercent = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <div className="flex-1 h-2.5 rounded-full bg-gray-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-700 transition-all duration-300"
          style={{ width: `${widthPercent}%` }}
        />
      </div>
      <span className="w-6 shrink-0 text-right tabular-nums text-foreground font-medium">
        {count}
      </span>
    </div>
  )
}

export default function GuideReviewSummaryCard({ summary, locale }: Props) {
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
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
        {isKo ? '아직 연결된 리뷰가 없습니다.' : 'No linked reviews yet.'}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-white p-4 sm:p-6 shadow-sm">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="flex shrink-0 flex-col items-center justify-center rounded-xl bg-gray-50 px-6 py-5 sm:min-w-[140px]">
          <p className="text-4xl font-bold tabular-nums text-foreground leading-none">
            {avg.toFixed(1)}
          </p>
          <p className="mt-2 text-sm font-medium text-muted-foreground">
            {overallLabel(avg, isKo)}
          </p>
          <div className="mt-3">
            <CircleRating rating={avg} total={summary.reviewCount} />
          </div>
        </div>

        <div className="flex-1 space-y-2.5 min-w-0">
          {distribution.map((row) => (
            <DistributionBar
              key={row.key}
              label={isKo ? row.labelKo : row.labelEn}
              count={row.count}
              maxCount={maxCount}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
