'use client'

import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Loader2, Sparkles, Star, X } from 'lucide-react'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import type { GoogleReviewImportNotifyRow } from '@/lib/googleReviewImportNotify'
import GoogleReviewImportClassifyRow from '@/components/admin/google-reviews/GoogleReviewImportClassifyRow'
import type { AdminGoogleReviewListItem } from '@/types/googleBusiness'

type ReviewsResponse = {
  ok?: boolean
  reviews?: AdminGoogleReviewListItem[]
  total?: number
  error?: string
}

type Props = {
  locale: string
  notification: GoogleReviewImportNotifyRow
  remaining: number
  onLater: () => void
  onDone: () => void
  onOpenPage: () => void
}

export default function GoogleReviewImportClassifyModal({
  locale,
  notification,
  remaining,
  onLater,
  onDone,
  onOpenPage,
}: Props) {
  const isKo = locale === 'ko'
  const [reviews, setReviews] = useState<AdminGoogleReviewListItem[]>([])
  const [unclassifiedTotal, setUnclassifiedTotal] = useState(0)
  const [loadingReviews, setLoadingReviews] = useState(false)
  const [classifying, setClassifying] = useState(false)
  const [savingProductId, setSavingProductId] = useState<string | null>(null)
  const [savingTourId, setSavingTourId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const loadUnclassified = useCallback(async () => {
    setLoadingReviews(true)
    try {
      const params = new URLSearchParams({
        unclassified: '1',
        source: 'google',
        sort: 'imported_at',
        page: '1',
        limit: '20',
      })
      const res = await fetchApiWithAuth(`/api/admin/google-business/reviews?${params.toString()}`)
      const data = (await res.json()) as ReviewsResponse
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'list_failed')
      }
      setReviews(data.reviews ?? [])
      setUnclassifiedTotal(data.total ?? 0)
    } catch (error) {
      console.error('[GoogleReviewImportClassifyModal]', error)
      setMessage(isKo ? '미분류 리뷰를 불러오지 못했습니다.' : 'Failed to load unclassified reviews.')
    } finally {
      setLoadingReviews(false)
    }
  }, [isKo])

  useEffect(() => {
    void loadUnclassified()
  }, [notification.id, loadUnclassified])

  const runAutoClassify = async () => {
    setClassifying(true)
    setMessage(null)
    try {
      const res = await fetchApiWithAuth('/api/admin/google-business/reviews/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 200 }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        classified?: number
        autoApproved?: number
        tourLinks?: { linked?: number }
        error?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.error || 'classify_failed')
      setMessage(
        isKo
          ? `자동 분류 ${data.classified ?? 0}건, 5★ 자동 승인 ${data.autoApproved ?? 0}건, 투어 연결 ${data.tourLinks?.linked ?? 0}건`
          : `Classified ${data.classified ?? 0}, auto-approved ${data.autoApproved ?? 0}, tours linked ${data.tourLinks?.linked ?? 0}`
      )
      await loadUnclassified()
    } catch (error) {
      setMessage(
        isKo
          ? `자동 분류 실패: ${error instanceof Error ? error.message : 'unknown'}`
          : `Auto-classify failed: ${error instanceof Error ? error.message : 'unknown'}`
      )
    } finally {
      setClassifying(false)
    }
  }

  const updateProduct = async (reviewId: string, productId: string | null) => {
    setSavingProductId(reviewId)
    try {
      const res = await fetchApiWithAuth(`/api/admin/google-business/reviews/${reviewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error || 'update_failed')
      await loadUnclassified()
    } catch (error) {
      setMessage(
        isKo
          ? `상품 분류 실패: ${error instanceof Error ? error.message : 'unknown'}`
          : `Product update failed: ${error instanceof Error ? error.message : 'unknown'}`
      )
    } finally {
      setSavingProductId(null)
    }
  }

  const updateTour = async (
    reviewId: string,
    tourId: string | null,
    tourProduct?: { productId: string | null; productName: string | null } | null
  ) => {
    setSavingTourId(reviewId)
    setReviews((prev) =>
      prev.map((review) => {
        if (review.id !== reviewId) return review
        const linkedProduct = tourId && tourProduct?.productId ? tourProduct : null
        return {
          ...review,
          tourId,
          ...(linkedProduct
            ? {
                productId: linkedProduct.productId,
                productName: linkedProduct.productName ?? review.productName,
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
      await loadUnclassified()
    } catch (error) {
      setMessage(
        isKo
          ? `투어 연결 실패: ${error instanceof Error ? error.message : 'unknown'}`
          : `Tour link failed: ${error instanceof Error ? error.message : 'unknown'}`
      )
      await loadUnclassified()
    } finally {
      setSavingTourId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="google-review-import-notify-title"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border/60 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-amber-100 bg-amber-50 p-4">
          <div className="flex min-w-0 items-start gap-2">
            <div className="rounded-xl bg-amber-500 p-2 text-white">
              <Star size={22} aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 id="google-review-import-notify-title" className="text-base font-semibold text-gray-900">
                {isKo ? '구글 리뷰 가져오기 완료' : 'Google reviews imported'}
              </h2>
              <p className="mt-0.5 text-xs text-amber-800">
                {isKo
                  ? `신규 ${notification.imported_count}건 · 갱신 ${notification.updated_count}건 · 자동 분류 ${notification.classified_count}건`
                  : `New ${notification.imported_count} · Updated ${notification.updated_count} · Classified ${notification.classified_count}`}
              </p>
              {remaining > 0 ? (
                <p className="mt-0.5 text-xs text-amber-700">
                  {isKo ? `외 ${remaining}건 대기 중` : `${remaining} more waiting`}
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onLater}
            className="rounded-md p-1 text-gray-500 hover:bg-white/80 hover:text-gray-800"
            aria-label={isKo ? '닫기' : 'Close'}
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <p className="text-sm text-gray-700">
            {isKo
              ? '라스베이거스 오후 9시 자동 가져오기가 끝났습니다. 미분류 리뷰를 상품·투어에 연결해 주세요.'
              : 'The 9 PM Las Vegas auto-import finished. Classify unmapped reviews by product and tour.'}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={classifying}
              onClick={() => void runAutoClassify()}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60"
            >
              {classifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isKo ? '미분류 자동 분류' : 'Auto-classify'}
            </button>
            <span className="text-xs text-muted-foreground">
              {isKo ? `미분류 ${unclassifiedTotal}건` : `${unclassifiedTotal} unclassified`}
            </span>
          </div>
          {message ? <p className="text-sm text-gray-600">{message}</p> : null}
          {loadingReviews ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : reviews.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {isKo ? '지금 분류할 미분류 리뷰가 없습니다.' : 'There are no unclassified reviews to assign.'}
            </p>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => (
                <GoogleReviewImportClassifyRow
                  key={review.id}
                  locale={locale}
                  review={review}
                  savingProduct={savingProductId === review.id}
                  savingTour={savingTourId === review.id}
                  onProductChange={(productId) => void updateProduct(review.id, productId)}
                  onTourChange={(tourId, tourProduct) => void updateTour(review.id, tourId, tourProduct)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-border/60 p-4">
          <button
            type="button"
            onClick={onLater}
            className="min-h-[44px] rounded-xl px-4 text-sm text-gray-600 hover:bg-gray-50"
          >
            {isKo ? '나중에' : 'Later'}
          </button>
          <button
            type="button"
            onClick={onOpenPage}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border px-4 text-sm font-medium text-foreground hover:bg-muted/50"
          >
            {isKo ? '리뷰 페이지에서 보기' : 'Open reviews page'}
            <ExternalLink className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDone}
            className="inline-flex min-h-[44px] items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {isKo ? '확인' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  )
}
