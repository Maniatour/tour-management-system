'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Star } from 'lucide-react'
import GoogleReviewCommentPreview from '@/components/admin/google-reviews/GoogleReviewCommentPreview'
import GuideReviewSummaryCard from '@/components/guide/GuideReviewSummaryCard'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import type { GuideLinkedReviewRow, GuideReviewSummary } from '@/lib/guideReviews'
import { formatLasVegasDate } from '@/lib/dailyReport/dateUtils'
import { getReviewSourceLabel, isReviewSource } from '@/lib/reviewSources'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslations } from 'next-intl'

type Props = {
  locale: string
  refreshKey?: number
}

type ApiResponse = {
  ok?: boolean
  summary?: GuideReviewSummary
  reviews?: GuideLinkedReviewRow[]
  error?: string
}

const EMPTY_SUMMARY: GuideReviewSummary = {
  reviewCount: 0,
  avgRating: null,
  fiveStarCount: 0,
  fourStarCount: 0,
  threeStarCount: 0,
  twoStarCount: 0,
  oneStarCount: 0,
  unreadCount: 0,
}

export default function GuideReviewsSection({ locale, refreshKey = 0 }: Props) {
  const isKo = locale === 'ko'
  const t = useTranslations('guide.reviews')
  const { isSimulating, simulatedUser } = useAuth()
  const [summary, setSummary] = useState<GuideReviewSummary>(EMPTY_SUMMARY)
  const [reviews, setReviews] = useState<GuideLinkedReviewRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadReviews = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const headers: Record<string, string> = {}
      if (isSimulating && simulatedUser?.email) {
        headers['x-simulated-user-email'] = simulatedUser.email
      }

      const res = await fetchApiWithAuth('/api/guide/reviews', { headers })
      const data = (await res.json()) as ApiResponse
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'load_failed')
      }
      setSummary(data.summary ?? EMPTY_SUMMARY)
      setReviews(data.reviews ?? [])
    } catch (err) {
      setSummary(EMPTY_SUMMARY)
      setReviews([])
      setError(err instanceof Error ? err.message : 'load_failed')
    } finally {
      setLoading(false)
    }
  }, [isSimulating, simulatedUser?.email])

  useEffect(() => {
    void loadReviews()
  }, [loadReviews, refreshKey])

  useEffect(() => {
    const onRefresh = () => void loadReviews()
    window.addEventListener('guide-reviews-refresh', onRefresh)
    return () => window.removeEventListener('guide-reviews-refresh', onRefresh)
  }, [loadReviews])

  const productName = (review: GuideLinkedReviewRow) => {
    if (isKo) return review.productNameKo || review.productNameEn
    return review.productNameEn || review.productNameKo
  }

  return (
    <section id="guide-reviews" className="bg-white rounded-lg shadow">
      <div className="border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500 fill-amber-500" aria-hidden />
            {t('title')}
            {summary.reviewCount > 0 ? (
              <span className="text-sm font-normal text-muted-foreground">
                ({summary.reviewCount})
              </span>
            ) : null}
          </h2>
          {summary.unreadCount > 0 ? (
            <span className="rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-semibold text-white">
              {isKo ? `새 리뷰 ${summary.unreadCount}` : `${summary.unreadCount} new`}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-sm text-danger text-center py-8">{t('loadError')}</p>
        ) : (
          <>
            <GuideReviewSummaryCard summary={summary} locale={locale} />

            {reviews.length > 0 ? (
              <ul className="space-y-3">
                {reviews.map((review) => {
                  const sourceLabel = isReviewSource(review.reviewSource)
                    ? getReviewSourceLabel(review.reviewSource, locale)
                    : review.reviewSource
                  const name = productName(review)

                  return (
                    <li
                      key={review.id}
                      className={`rounded-xl border p-4 space-y-2 transition-colors ${
                        review.isRead
                          ? 'border-border/60 bg-white'
                          : 'border-primary/30 bg-primary/5'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        {!review.isRead ? (
                          <span className="text-[10px] font-semibold uppercase tracking-wide rounded-full bg-primary px-2 py-0.5 text-primary-foreground">
                            {isKo ? '새 리뷰' : 'New'}
                          </span>
                        ) : null}
                        <div className="flex items-center gap-1 text-amber-500">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3.5 w-3.5 ${
                                i < review.rating
                                  ? 'fill-current'
                                  : 'text-muted-foreground/30'
                              }`}
                              aria-hidden
                            />
                          ))}
                        </div>
                        <p className="font-medium text-foreground text-sm">
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
                      </div>
                      {name ? (
                        <p className="text-xs text-muted-foreground">{name}</p>
                      ) : null}
                      {review.tourDate ? (
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {isKo ? '투어일' : 'Tour'}: {review.tourDate}
                        </p>
                      ) : null}
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
            ) : null}
          </>
        )}
      </div>
    </section>
  )
}
