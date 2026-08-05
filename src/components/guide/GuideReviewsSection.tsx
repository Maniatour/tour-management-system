'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Star } from 'lucide-react'
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

const PAGE_SIZE = 10

function buildPageNumbers(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const pages: Array<number | 'ellipsis'> = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  if (start > 2) pages.push('ellipsis')
  for (let page = start; page <= end; page += 1) {
    pages.push(page)
  }
  if (end < total - 1) pages.push('ellipsis')
  pages.push(total)
  return pages
}

export default function GuideReviewsSection({ locale, refreshKey = 0 }: Props) {
  const isKo = locale === 'ko'
  const t = useTranslations('guide.reviews')
  const { isSimulating, simulatedUser } = useAuth()
  const [summary, setSummary] = useState<GuideReviewSummary>(EMPTY_SUMMARY)
  const [reviews, setReviews] = useState<GuideLinkedReviewRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

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
      setCurrentPage(1)
    } catch (err) {
      setSummary(EMPTY_SUMMARY)
      setReviews([])
      setError(err instanceof Error ? err.message : 'load_failed')
      setCurrentPage(1)
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

  const totalPages = Math.max(1, Math.ceil(reviews.length / PAGE_SIZE))

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages))
  }, [totalPages])

  const paginatedReviews = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return reviews.slice(start, start + PAGE_SIZE)
  }, [reviews, currentPage])

  const pageNumbers = useMemo(
    () => buildPageNumbers(currentPage, totalPages),
    [currentPage, totalPages]
  )

  const rangeStart = reviews.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, reviews.length)

  const goToPage = (page: number) => {
    const next = Math.min(Math.max(1, page), totalPages)
    setCurrentPage(next)
    document.getElementById('guide-reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const productName = (review: GuideLinkedReviewRow) => {
    if (isKo) return review.productNameKo || review.productNameEn
    return review.productNameEn || review.productNameKo
  }

  return (
    <section id="guide-reviews" className="bg-white rounded-none lg:rounded-lg shadow-none lg:shadow border-b border-gray-200 lg:border-0">
      <div className="border-b border-gray-200 px-3 sm:px-6 py-4">
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

      <div className="p-3 sm:p-6 space-y-6">
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
              <>
                <ul className="space-y-3">
                  {paginatedReviews.map((review) => {
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

                {totalPages > 1 ? (
                  <nav
                    className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between"
                    aria-label={isKo ? '리뷰 페이지 탐색' : 'Review pagination'}
                  >
                    <p className="text-xs sm:text-sm text-muted-foreground tabular-nums text-center sm:text-left">
                      {t('showingRange', {
                        start: rangeStart,
                        end: rangeEnd,
                        total: reviews.length,
                      })}
                    </p>

                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage <= 1}
                        aria-label={t('pagePrev')}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-30"
                      >
                        <ChevronLeft className="h-4 w-4" aria-hidden />
                      </button>

                      {pageNumbers.map((item, index) =>
                        item === 'ellipsis' ? (
                          <span
                            key={`ellipsis-${index}`}
                            className="px-1 text-sm text-muted-foreground"
                            aria-hidden
                          >
                            …
                          </span>
                        ) : (
                          <button
                            key={item}
                            type="button"
                            onClick={() => goToPage(item)}
                            aria-current={item === currentPage ? 'page' : undefined}
                            className={`inline-flex h-10 min-w-10 items-center justify-center rounded-xl px-2 text-sm font-medium tabular-nums transition-colors ${
                              item === currentPage
                                ? 'bg-primary text-primary-foreground'
                                : 'border border-border/60 text-foreground hover:bg-muted'
                            }`}
                          >
                            {item}
                          </button>
                        )
                      )}

                      <button
                        type="button"
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage >= totalPages}
                        aria-label={t('pageNext')}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-30"
                      >
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </nav>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
}
