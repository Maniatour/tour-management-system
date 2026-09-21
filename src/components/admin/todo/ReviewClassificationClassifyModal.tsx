'use client'

import { useState } from 'react'
import { Loader2, Star, X } from 'lucide-react'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import GoogleReviewImportClassifyRow from '@/components/admin/google-reviews/GoogleReviewImportClassifyRow'
import type { AdminGoogleReviewRow } from '@/lib/googleReviewAdmin'

type Props = {
  locale: string
  review: AdminGoogleReviewRow
  onClose: () => void
  onSaved: (review: AdminGoogleReviewRow) => void
}

export default function ReviewClassificationClassifyModal({
  locale,
  review,
  onClose,
  onSaved,
}: Props) {
  const isKo = locale === 'ko'
  const [current, setCurrent] = useState(review)
  const [savingProduct, setSavingProduct] = useState(false)
  const [savingTour, setSavingTour] = useState(false)
  const [savingExcludeStaff, setSavingExcludeStaff] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const busy = savingProduct || savingTour || savingExcludeStaff

  const patchReview = async (body: Record<string, unknown>, next: AdminGoogleReviewRow) => {
    const res = await fetchApiWithAuth(`/api/admin/google-business/reviews/${current.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = (await res.json()) as { ok?: boolean; error?: string }
    if (!res.ok || !data.ok) throw new Error(data.error || 'update_failed')
    setCurrent(next)
    onSaved(next)
  }

  const updateProduct = async (productId: string | null) => {
    setSavingProduct(true)
    setMessage(null)
    try {
      await patchReview({ productId }, { ...current, productId })
    } catch (error) {
      setMessage(
        isKo
          ? `상품 분류 실패: ${error instanceof Error ? error.message : 'unknown'}`
          : `Product update failed: ${error instanceof Error ? error.message : 'unknown'}`
      )
    } finally {
      setSavingProduct(false)
    }
  }

  const updateTour = async (
    tourId: string | null,
    tourProduct?: { productId: string | null; productName: string | null } | null
  ) => {
    setSavingTour(true)
    setMessage(null)
    const linkedProduct = tourId && tourProduct?.productId ? tourProduct : null
    const next: AdminGoogleReviewRow = {
      ...current,
      tourId,
      ...(linkedProduct
        ? {
            productId: linkedProduct.productId,
            productName: linkedProduct.productName ?? current.productName,
            classificationMethod: 'tour_link',
          }
        : {}),
    }
    setCurrent(next)
    try {
      await patchReview({ tourId, excludeStaffRating: false }, { ...next, excludeStaffRating: false })
    } catch (error) {
      setMessage(
        isKo
          ? `투어 연결 실패: ${error instanceof Error ? error.message : 'unknown'}`
          : `Tour link failed: ${error instanceof Error ? error.message : 'unknown'}`
      )
      setCurrent(review)
    } finally {
      setSavingTour(false)
    }
  }

  const updateExcludeStaffRating = async (excludeStaffRating: boolean) => {
    setSavingExcludeStaff(true)
    setMessage(null)
    const next: AdminGoogleReviewRow = {
      ...current,
      excludeStaffRating,
      ...(excludeStaffRating
        ? { tourId: null, tourDate: null, tourProductName: null, tourMatchMethod: null, staff: [] }
        : {}),
    }
    setCurrent(next)
    try {
      await patchReview(
        {
          excludeStaffRating,
          ...(excludeStaffRating ? { tourId: null } : {}),
        },
        next
      )
    } catch (error) {
      setMessage(
        isKo
          ? `가이드 평점 설정 실패: ${error instanceof Error ? error.message : 'unknown'}`
          : `Staff rating update failed: ${error instanceof Error ? error.message : 'unknown'}`
      )
      setCurrent(review)
    } finally {
      setSavingExcludeStaff(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-classification-modal-title"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border/60 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-amber-100 bg-amber-50 p-4">
          <div className="flex min-w-0 items-start gap-2">
            <div className="rounded-xl bg-amber-500 p-2 text-white">
              <Star size={22} aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 id="review-classification-modal-title" className="text-base font-semibold text-gray-900">
                {isKo ? '구글 리뷰 분류' : 'Classify Google review'}
              </h2>
              <p className="mt-0.5 text-xs text-amber-800">
                {isKo
                  ? '투어를 선택하면 가이드 평점에 반영됩니다.'
                  : 'Assign a tour so the review counts toward staff ratings.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-500 hover:bg-white/80 hover:text-gray-800"
            aria-label={isKo ? '닫기' : 'Close'}
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {message ? <p className="text-sm text-gray-600">{message}</p> : null}
          <GoogleReviewImportClassifyRow
            locale={locale}
            review={current}
            savingProduct={savingProduct}
            savingTour={savingTour}
            savingExcludeStaff={savingExcludeStaff}
            onProductChange={(productId) => void updateProduct(productId)}
            onTourChange={(tourId, tourProduct) => void updateTour(tourId, tourProduct)}
            onExcludeStaffRatingChange={(excludeStaffRating) =>
              void updateExcludeStaffRating(excludeStaffRating)
            }
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-border/60 p-4">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="inline-flex min-h-[44px] items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            {isKo ? '완료' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  )
}
