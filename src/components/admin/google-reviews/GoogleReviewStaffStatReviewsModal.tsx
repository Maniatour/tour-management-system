'use client'

import { useEffect, useState } from 'react'
import { Loader2, Star } from 'lucide-react'
import GoogleReviewCommentPreview from '@/components/admin/google-reviews/GoogleReviewCommentPreview'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import { formatLasVegasDate } from '@/lib/dailyReport/dateUtils'
import { getReviewSourceLabel, isReviewSource } from '@/lib/reviewSources'
import type {
  GoogleReviewStaffMonthBy,
  GoogleReviewStaffStatReviewItem,
} from '@/types/googleBusiness'

export type StaffStatReviewModalTarget = {
  staffEmail: string
  staffName: string
  rating: number
  year?: number | null
  month?: number | null
  monthBy?: GoogleReviewStaffMonthBy
}

type Props = {
  locale: string
  target: StaffStatReviewModalTarget | null
  onClose: () => void
}

export default function GoogleReviewStaffStatReviewsModal({
  locale,
  target,
  onClose,
}: Props) {
  const isKo = locale === 'ko'
  const [reviews, setReviews] = useState<GoogleReviewStaffStatReviewItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!target) {
      setReviews([])
      setError(null)
      return
    }

    const controller = new AbortController()

    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          staffEmail: target.staffEmail,
          rating: String(target.rating),
        })
        if (target.year) params.set('year', String(target.year))
        if (target.month) params.set('month', String(target.month))
        if (target.monthBy) params.set('monthBy', target.monthBy)

        const res = await fetchApiWithAuth(
          `/api/admin/google-business/reviews/staff-stats/reviews?${params.toString()}`,
          { signal: controller.signal }
        )
        const data = (await res.json()) as {
          ok?: boolean
          reviews?: GoogleReviewStaffStatReviewItem[]
          error?: string
        }
        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'load_failed')
        }
        setReviews(data.reviews ?? [])
      } catch (err) {
        if (controller.signal.aborted) return
        setReviews([])
        setError(err instanceof Error ? err.message : 'load_failed')
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    })()

    return () => controller.abort()
  }, [target])

  const monthByLabel =
    target?.monthBy === 'review_date'
      ? isKo
        ? '등록일 기준'
        : 'by review date'
      : target?.monthBy === 'tour_date'
        ? isKo
          ? '투어일 기준'
          : 'by tour date'
        : null

  const periodLabel =
    target?.year && target?.month
      ? isKo
        ? `${target.year}년 ${target.month}월`
        : `${target.year}-${String(target.month).padStart(2, '0')}`
      : target?.year
        ? String(target.year)
        : isKo
          ? '전체 기간'
          : 'All time'

  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
            <span>{target?.staffName}</span>
            <span className="inline-flex items-center gap-1 text-amber-500 text-base font-semibold">
              <Star className="h-4 w-4 fill-current" aria-hidden />
              {target?.rating}
            </span>
          </DialogTitle>
          <DialogDescription>
            {isKo
              ? `${periodLabel}${monthByLabel ? ` · ${monthByLabel}` : ''} · 연결된 리뷰`
              : `${periodLabel}${monthByLabel ? ` · ${monthByLabel}` : ''} · linked reviews`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 -mx-1 px-1">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="text-sm text-danger py-8 text-center">{error}</p>
          ) : reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {isKo ? '표시할 리뷰가 없습니다.' : 'No reviews to show.'}
            </p>
          ) : (
            <ul className="space-y-3">
              {reviews.map((review) => {
                const sourceLabel = isReviewSource(review.reviewSource)
                  ? getReviewSourceLabel(review.reviewSource, locale)
                  : review.reviewSource

                return (
                  <li
                    key={review.id}
                    className="rounded-xl border border-border/60 bg-muted/10 p-4 space-y-2"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <p className="font-medium text-foreground">
                        {review.authorName || (isKo ? '고객' : 'Guest')}
                      </p>
                      {review.reviewCreatedAt ? (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatLasVegasDate(review.reviewCreatedAt, locale)}
                        </span>
                      ) : null}
                      <span className="text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {sourceLabel}
                      </span>
                      {review.productName ? (
                        <span className="text-xs text-muted-foreground">{review.productName}</span>
                      ) : null}
                      {review.tourDate ? (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {review.tourDate}
                        </span>
                      ) : null}
                    </div>
                    {review.comment ? (
                      <GoogleReviewCommentPreview comment={review.comment} isKo={isKo} />
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        {isKo ? '리뷰 내용 없음' : 'No review text'}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
