'use client'

import { Loader2, Star } from 'lucide-react'
import { OpTodoProductSelect } from '@/components/admin/todo/OpTodoProductSelect'
import GoogleReviewCommentPreview from '@/components/admin/google-reviews/GoogleReviewCommentPreview'
import GoogleReviewTourSelect from '@/components/admin/google-reviews/GoogleReviewTourSelect'
import { formatLasVegasDate } from '@/lib/dailyReport/dateUtils'
import type { AdminGoogleReviewListItem } from '@/types/googleBusiness'

type Props = {
  locale: string
  review: AdminGoogleReviewListItem
  savingProduct: boolean
  savingTour: boolean
  onProductChange: (productId: string | null) => void
  onTourChange: (
    tourId: string | null,
    tourProduct?: { productId: string | null; productName: string | null } | null
  ) => void
}

export default function GoogleReviewImportClassifyRow({
  locale,
  review,
  savingProduct,
  savingTour,
  onProductChange,
  onTourChange,
}: Props) {
  const isKo = locale === 'ko'
  const busy = savingProduct || savingTour

  return (
    <article className="space-y-3 rounded-xl border border-border/60 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-foreground">{review.authorName ?? 'Google User'}</p>
        {review.reviewCreatedAt ? (
          <span className="text-xs tabular-nums text-muted-foreground">
            {formatLasVegasDate(review.reviewCreatedAt, locale)}
          </span>
        ) : null}
        <div className="flex items-center gap-0.5 text-amber-500">
          <Star className="h-3.5 w-3.5 fill-current" />
          <span className="text-xs font-medium">{review.rating ?? '—'}</span>
        </div>
      </div>
      {review.comment ? <GoogleReviewCommentPreview comment={review.comment} isKo={isKo} /> : null}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="min-w-0">
          <label className="text-xs font-medium text-muted-foreground">
            {isKo ? '상품' : 'Product'}
          </label>
          <OpTodoProductSelect
            locale={locale}
            variant="combobox"
            value={review.productId ?? undefined}
            {...(review.productName ? { selectedLabel: review.productName } : {})}
            disabled={busy}
            onChange={(productId) => {
              if (productId && productId !== review.productId) {
                onProductChange(productId)
              } else if (productId === undefined && review.productId) {
                onProductChange(null)
              }
            }}
            inputClass="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm h-10"
          />
        </div>
        <div className="min-w-0">
          <label className="text-xs font-medium text-muted-foreground">{isKo ? '투어' : 'Tour'}</label>
          <GoogleReviewTourSelect
            locale={locale}
            reviewDate={review.reviewCreatedAt}
            productId={review.productId}
            value={review.tourId}
            {...(review.tourDate && review.tourProductName
              ? { selectedLabel: `${review.tourDate} · ${review.tourProductName}` }
              : {})}
            disabled={busy}
            onChange={(tourId, tourProduct) => {
              if (tourId !== review.tourId) {
                onTourChange(tourId, tourProduct)
              }
            }}
          />
        </div>
      </div>
      {busy ? (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          {isKo ? '저장 중…' : 'Saving…'}
        </p>
      ) : null}
    </article>
  )
}
