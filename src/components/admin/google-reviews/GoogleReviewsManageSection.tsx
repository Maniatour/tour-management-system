'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, EyeOff, Loader2, Star, X } from 'lucide-react'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import { OpTodoProductSelect } from '@/components/admin/todo/OpTodoProductSelect'
import GoogleReviewCommentPreview from '@/components/admin/google-reviews/GoogleReviewCommentPreview'
import GoogleReviewTourSelect from '@/components/admin/google-reviews/GoogleReviewTourSelect'
import GoogleReviewRecentChangesPanel from '@/components/admin/google-reviews/GoogleReviewRecentChangesPanel'
import GoogleReviewChangeHistory from '@/components/admin/google-reviews/GoogleReviewChangeHistory'
import { formatLasVegasDate } from '@/lib/dailyReport/dateUtils'
import type { ReviewSource } from '@/lib/reviewSources'
import { getReviewSourceLabel } from '@/lib/reviewSources'
import type { AdminGoogleReviewListItem, GoogleReviewStats } from '@/types/googleBusiness'

type ReviewsResponse = {
  ok?: boolean
  reviews?: AdminGoogleReviewListItem[]
  total?: number
  page?: number
  stats?: GoogleReviewStats
  error?: string
}

type Props = {
  locale: string
  enabled: boolean
  reviewSource: ReviewSource
  onMessage: (message: string) => void
  refreshKey: number
}

const STATUS_FILTERS = ['all', 'pending', 'approved', 'rejected', 'hidden'] as const

export default function GoogleReviewsManageSection({
  locale,
  enabled,
  reviewSource,
  onMessage,
  refreshKey,
}: Props) {
  const isKo = locale === 'ko'
  const sourceLabel = getReviewSourceLabel(reviewSource, locale)
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('pending')
  const [unclassifiedOnly, setUnclassifiedOnly] = useState(false)
  const [reviews, setReviews] = useState<AdminGoogleReviewListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [acting, setActing] = useState(false)
  const [savingProductReviewId, setSavingProductReviewId] = useState<string | null>(null)
  const [savingTourReviewId, setSavingTourReviewId] = useState<string | null>(null)
  const [savingExcludeStaffReviewId, setSavingExcludeStaffReviewId] = useState<string | null>(null)
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)

  const bumpHistoryRefresh = () => setHistoryRefreshKey((key) => key + 1)

  const loadReviews = useCallback(async (options?: { silent?: boolean }) => {
    if (!enabled) {
      setReviews([])
      setTotal(0)
      return
    }

    if (!options?.silent) {
      setLoading(true)
    }
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '15',
        source: reviewSource,
      })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (unclassifiedOnly) params.set('unclassified', '1')

      const res = await fetchApiWithAuth(`/api/admin/google-business/reviews?${params.toString()}`)
      const data = (await res.json()) as ReviewsResponse
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'list_failed')
      }
      setReviews(data.reviews ?? [])
      setTotal(data.total ?? 0)
      if (!options?.silent) {
        setSelectedIds(new Set())
      }
    } catch (error) {
      console.error('[GoogleReviewsManageSection]', error)
      onMessage(
        isKo ? '리뷰 목록을 불러오지 못했습니다.' : 'Failed to load review list.'
      )
    } finally {
      if (!options?.silent) {
        setLoading(false)
      }
    }
  }, [enabled, isKo, onMessage, page, reviewSource, statusFilter, unclassifiedOnly])

  useEffect(() => {
    void loadReviews()
  }, [loadReviews, refreshKey])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const runBulk = async (action: 'approve' | 'reject' | 'hide') => {
    if (!selectedIds.size) return
    setActing(true)
    try {
      const res = await fetchApiWithAuth('/api/admin/google-business/reviews/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selectedIds], action }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error || 'bulk_failed')
      onMessage(
        isKo
          ? `${selectedIds.size}건 상태를 변경했습니다.`
          : `Updated status for ${selectedIds.size} reviews.`
      )
      await loadReviews()
      bumpHistoryRefresh()
    } catch (error) {
      onMessage(
        isKo
          ? `일괄 처리 실패: ${error instanceof Error ? error.message : 'unknown'}`
          : `Bulk action failed: ${error instanceof Error ? error.message : 'unknown'}`
      )
    } finally {
      setActing(false)
    }
  }

  const updateOne = async (id: string, importStatus: string) => {
    setActing(true)
    try {
      const res = await fetchApiWithAuth(`/api/admin/google-business/reviews/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importStatus }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error || 'update_failed')
      await loadReviews({ silent: true })
      bumpHistoryRefresh()
    } catch (error) {
      onMessage(
        isKo
          ? `상태 변경 실패: ${error instanceof Error ? error.message : 'unknown'}`
          : `Status update failed: ${error instanceof Error ? error.message : 'unknown'}`
      )
    } finally {
      setActing(false)
    }
  }

  const updateProduct = async (reviewId: string, productId: string | null) => {
    setSavingProductReviewId(reviewId)
    try {
      const res = await fetchApiWithAuth(`/api/admin/google-business/reviews/${reviewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error || 'update_failed')
      onMessage(
        isKo
          ? productId
            ? '상품 분류를 수정했습니다.'
            : '상품 분류를 해제했습니다.'
          : productId
            ? 'Product assignment updated.'
            : 'Product assignment cleared.'
      )
      await loadReviews({ silent: true })
      bumpHistoryRefresh()
    } catch (error) {
      onMessage(
        isKo
          ? `상품 수정 실패: ${error instanceof Error ? error.message : 'unknown'}`
          : `Product update failed: ${error instanceof Error ? error.message : 'unknown'}`
      )
    } finally {
      setSavingProductReviewId(null)
    }
  }

  const updateTour = async (
    reviewId: string,
    tourId: string | null,
    tourProduct?: { productId: string | null; productName: string | null } | null
  ) => {
    setSavingTourReviewId(reviewId)
    const previousReviews = reviews
    setReviews((prev) =>
      prev.map((review) => {
        if (review.id !== reviewId) return review
        const shouldFillProduct = tourId && tourProduct?.productId && !review.productId
        return {
          ...review,
          tourId,
          excludeStaffRating: false,
          staff: [],
          ...(shouldFillProduct
            ? {
                productId: tourProduct.productId,
                productName: tourProduct.productName ?? review.productName,
                classificationMethod: 'tour_link',
              }
            : {}),
        }
      })
    )
    try {
      const res = await fetchApiWithAuth(`/api/admin/google-business/reviews/${reviewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tourId, excludeStaffRating: false }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error || 'update_failed')
      onMessage(
        isKo
          ? tourId
            ? '투어 연결을 저장했습니다.'
            : '투어 연결을 해제했습니다.'
          : tourId
            ? 'Tour link saved.'
            : 'Tour link cleared.'
      )
      await loadReviews({ silent: true })
      bumpHistoryRefresh()
    } catch (error) {
      setReviews(previousReviews)
      onMessage(
        isKo
          ? `투어 연결 실패: ${error instanceof Error ? error.message : 'unknown'}`
          : `Tour link failed: ${error instanceof Error ? error.message : 'unknown'}`
      )
    } finally {
      setSavingTourReviewId(null)
    }
  }

  const updateExcludeStaffRating = async (reviewId: string, excludeStaffRating: boolean) => {
    setSavingExcludeStaffReviewId(reviewId)
    const previousReviews = reviews
    setReviews((prev) =>
      prev.map((review) => {
        if (review.id !== reviewId) return review
        return {
          ...review,
          excludeStaffRating,
          ...(excludeStaffRating
            ? { tourId: null, tourDate: null, tourProductName: null, tourMatchMethod: null, staff: [] }
            : {}),
        }
      })
    )
    try {
      const res = await fetchApiWithAuth(`/api/admin/google-business/reviews/${reviewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          excludeStaffRating,
          ...(excludeStaffRating ? { tourId: null } : {}),
        }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error || 'update_failed')
      onMessage(
        isKo
          ? excludeStaffRating
            ? '가이드 평점 미반영으로 저장했습니다.'
            : '가이드 평점 반영으로 변경했습니다.'
          : excludeStaffRating
            ? 'Marked as excluded from staff ratings.'
            : 'Staff rating exclusion removed.'
      )
      await loadReviews({ silent: true })
      bumpHistoryRefresh()
    } catch (error) {
      setReviews(previousReviews)
      onMessage(
        isKo
          ? `저장 실패: ${error instanceof Error ? error.message : 'unknown'}`
          : `Save failed: ${error instanceof Error ? error.message : 'unknown'}`
      )
    } finally {
      setSavingExcludeStaffReviewId(null)
    }
  }

  useEffect(() => {
    setPage(1)
    setSelectedIds(new Set())
  }, [reviewSource])

  if (!enabled) return null

  const totalPages = Math.max(1, Math.ceil(total / 15))

  return (
    <section className="rounded-2xl border border-border/60 bg-card shadow-sm p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {isKo ? `${sourceLabel} 리뷰 관리` : `${sourceLabel} review moderation`}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isKo
              ? '승인된 리뷰만 상품 페이지에 표시됩니다. 상품 드롭다운에서 바로 수정할 수 있습니다.'
              : 'Only approved reviews appear on product pages. Change the product directly from the dropdown.'}
          </p>
        </div>
        <p className="text-sm text-muted-foreground tabular-nums">
          {isKo ? `총 ${total}건` : `${total} total`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => {
              setPage(1)
              setStatusFilter(filter)
            }}
            className={`h-9 px-3 rounded-full text-xs font-medium border transition-colors ${
              statusFilter === filter
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border text-muted-foreground hover:bg-muted/50'
            }`}
          >
            {filter === 'all'
              ? isKo
                ? '전체'
                : 'All'
              : filter === 'pending'
                ? isKo
                  ? '대기'
                  : 'Pending'
                : filter === 'approved'
                  ? isKo
                    ? '승인'
                    : 'Approved'
                  : filter === 'rejected'
                    ? isKo
                      ? '거절'
                      : 'Rejected'
                    : isKo
                      ? '숨김'
                      : 'Hidden'}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setPage(1)
            setUnclassifiedOnly((prev) => !prev)
          }}
          className={`h-9 px-3 rounded-full text-xs font-medium border transition-colors ${
            unclassifiedOnly
              ? 'bg-amber-500 text-white border-amber-500'
              : 'bg-background border-border text-muted-foreground hover:bg-muted/50'
          }`}
          title={
            isKo
              ? '상품 없음, 또는 (투어 없음이고 가이드 평점 미반영도 아닌) 리뷰만 표시'
              : 'Reviews missing product, or missing tour without staff-rating exclusion'
          }
        >
          {isKo ? '미분류만' : 'Unclassified only'}
        </button>
      </div>

      <GoogleReviewRecentChangesPanel
        locale={locale}
        enabled={enabled}
        refreshKey={historyRefreshKey}
      />

      {selectedIds.size > 0 ? (
        <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-muted/30 border border-border/50">
          <span className="text-sm text-muted-foreground self-center">
            {selectedIds.size} {isKo ? '건 선택' : 'selected'}
          </span>
          <button
            type="button"
            disabled={acting}
            onClick={() => void runBulk('approve')}
            className="inline-flex items-center gap-1 h-9 px-3 rounded-lg bg-success/10 text-success text-xs font-medium"
          >
            <Check className="h-3.5 w-3.5" />
            {isKo ? '승인' : 'Approve'}
          </button>
          <button
            type="button"
            disabled={acting}
            onClick={() => void runBulk('reject')}
            className="inline-flex items-center gap-1 h-9 px-3 rounded-lg bg-danger/10 text-danger text-xs font-medium"
          >
            <X className="h-3.5 w-3.5" />
            {isKo ? '거절' : 'Reject'}
          </button>
          <button
            type="button"
            disabled={acting}
            onClick={() => void runBulk('hide')}
            className="inline-flex items-center gap-1 h-9 px-3 rounded-lg bg-muted text-foreground text-xs font-medium"
          >
            <EyeOff className="h-3.5 w-3.5" />
            {isKo ? '숨김' : 'Hide'}
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {isKo ? '표시할 리뷰가 없습니다.' : 'No reviews to show.'}
        </p>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <article
              key={review.id}
              className="rounded-xl border border-border/50 p-4 space-y-3 hover:border-border transition-colors"
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(review.id)}
                  onChange={() => toggleSelect(review.id)}
                  className="mt-1 h-4 w-4 rounded border-border"
                  aria-label={isKo ? '리뷰 선택' : 'Select review'}
                />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <p className="font-medium text-foreground">{review.authorName ?? 'Google User'}</p>
                      {review.reviewCreatedAt ? (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatLasVegasDate(review.reviewCreatedAt, locale)}
                        </span>
                      ) : null}
                      <div className="flex items-center gap-0.5 text-amber-500">
                        <Star className="h-3.5 w-3.5 fill-current" />
                        <span className="text-xs font-medium">{review.rating ?? '—'}</span>
                      </div>
                      <span className="text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {review.importStatus}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {review.importStatus !== 'approved' ? (
                        <button
                          type="button"
                          disabled={acting}
                          onClick={() => void updateOne(review.id, 'approved')}
                          className="h-8 px-3 rounded-lg text-xs font-medium bg-success/10 text-success hover:bg-success/15"
                        >
                          {isKo ? '승인' : 'Approve'}
                        </button>
                      ) : null}
                      {review.importStatus !== 'rejected' ? (
                        <button
                          type="button"
                          disabled={acting}
                          onClick={() => void updateOne(review.id, 'rejected')}
                          className="h-8 px-3 rounded-lg text-xs font-medium bg-danger/10 text-danger hover:bg-danger/15"
                        >
                          {isKo ? '거절' : 'Reject'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {review.comment ? (
                    <GoogleReviewCommentPreview comment={review.comment} isKo={isKo} />
                  ) : null}
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="min-w-0">
                        <label className="text-xs font-medium text-muted-foreground">
                          {isKo ? '상품' : 'Product'}
                          {review.classificationMethod ? (
                            <span className="font-normal text-muted-foreground/80">
                              {' '}
                              ({review.classificationMethod})
                            </span>
                          ) : null}
                        </label>
                        <OpTodoProductSelect
                          locale={locale}
                          variant="combobox"
                          value={review.productId ?? undefined}
                          {...(review.productName ? { selectedLabel: review.productName } : {})}
                          disabled={acting || savingProductReviewId === review.id}
                          onChange={(productId) => {
                            if (productId && productId !== review.productId) {
                              void updateProduct(review.id, productId)
                            } else if (productId === undefined && review.productId) {
                              void updateProduct(review.id, null)
                            }
                          }}
                          inputClass="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm h-10"
                        />
                        {savingProductReviewId === review.id ? (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                            {isKo ? '저장 중…' : 'Saving…'}
                          </p>
                        ) : null}
                      </div>
                      <div className="min-w-0 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <label className="text-xs font-medium text-muted-foreground">
                            {isKo ? '투어' : 'Tour'}
                            {review.tourMatchMethod ? (
                              <span className="font-normal text-muted-foreground/80">
                                {' '}
                                ({review.tourMatchMethod})
                              </span>
                            ) : null}
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={review.excludeStaffRating}
                              disabled={
                                acting ||
                                savingExcludeStaffReviewId === review.id ||
                                savingTourReviewId === review.id
                              }
                              onChange={(e) => {
                                void updateExcludeStaffRating(review.id, e.target.checked)
                              }}
                              className="h-4 w-4 rounded border-border"
                            />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {isKo ? '가이드 평점 미반영' : 'Exclude staff rating'}
                            </span>
                          </label>
                        </div>
                        <GoogleReviewTourSelect
                          locale={locale}
                          reviewDate={review.reviewCreatedAt}
                          productId={review.productId}
                          value={review.tourId}
                          {...(review.tourDate && review.tourProductName
                            ? { selectedLabel: `${review.tourDate} · ${review.tourProductName}` }
                            : {})}
                          disabled={
                            acting ||
                            savingTourReviewId === review.id ||
                            savingExcludeStaffReviewId === review.id ||
                            review.excludeStaffRating
                          }
                          onChange={(tourId, tourProduct) => {
                            if (tourId !== review.tourId) {
                              void updateTour(review.id, tourId, tourProduct)
                            }
                          }}
                        />
                        {savingTourReviewId === review.id || savingExcludeStaffReviewId === review.id ? (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                            {isKo ? '저장 중…' : 'Saving…'}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    {review.staff.length ? (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          {isKo ? '직원' : 'Staff'}:{' '}
                          <strong>
                            {review.staff
                              .map((member) => {
                                const role =
                                  member.staffRole === 'guide'
                                    ? isKo
                                      ? '가이드'
                                      : 'Guide'
                                    : isKo
                                      ? '어시스턴트'
                                      : 'Asst'
                                return `${member.staffName ?? member.staffEmail} (${role})`
                              })
                              .join(', ')}
                          </strong>
                        </span>
                      </div>
                    ) : null}
                    <GoogleReviewChangeHistory
                      reviewId={review.id}
                      locale={locale}
                      refreshKey={historyRefreshKey}
                      compact
                    />
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {totalPages > 1 ? (        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="h-9 px-3 rounded-lg border border-border text-sm disabled:opacity-40"
          >
            {isKo ? '이전' : 'Previous'}
          </button>
          <span className="text-sm text-muted-foreground tabular-nums">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            className="h-9 px-3 rounded-lg border border-border text-sm disabled:opacity-40"
          >
            {isKo ? '다음' : 'Next'}
          </button>
        </div>
      ) : null}
    </section>
  )
}
