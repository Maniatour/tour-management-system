'use client'

import { AlertCircle, Loader2, Star } from 'lucide-react'
import GoogleReviewCommentPreview from '@/components/admin/google-reviews/GoogleReviewCommentPreview'
import GoogleReviewTourSelect from '@/components/admin/google-reviews/GoogleReviewTourSelect'
import { OpTodoProductSelect } from '@/components/admin/todo/OpTodoProductSelect'
import { formatLasVegasDate } from '@/lib/dailyReport/dateUtils'
import type { ParsedOtaReviewRow } from '@/lib/otaReviewParse'

export type LinkedTourPreview = {
  id: string
  tourDate: string
  productId: string | null
  productName: string | null
  guideName: string | null
  assistantName: string | null
  totalPeople: number
}

type ReservationPreview = {
  productId: string | null
  productName: string | null
  customerName: string | null
  tourId: string | null
  tourDate: string | null
}

type Props = {
  locale: string
  draft: ParsedOtaReviewRow | null
  reservation: ReservationPreview | null
  linkedTour: LinkedTourPreview | null
  lookupLoading: boolean
  lookupError: string | null
  alreadyImported?: boolean
  ratingEditable?: boolean
  productEditable?: boolean
  tourEditable?: boolean
  onRatingChange?: (rating: number) => void
  onProductChange?: (productId: string | undefined, productName?: string | null) => void
  onTourChange?: (
    tourId: string | null,
    tourProduct?: { productId: string | null; productName: string | null } | null
  ) => void
}

function formatTourSelectedLabel(tour: LinkedTourPreview, isKo: boolean): string {
  const team = [tour.guideName, tour.assistantName].filter(Boolean).join(' · ')
  const peopleLabel =
    tour.totalPeople > 0 ? (isKo ? `${tour.totalPeople}명` : `${tour.totalPeople} pax`) : null
  const meta = [peopleLabel, team].filter(Boolean).join(' · ')
  const productName = tour.productName ?? (isKo ? '투어' : 'Tour')
  return `${tour.tourDate} · ${productName}${meta ? ` (${meta})` : ''}`
}

function RatingStars({
  rating,
  editable,
  isKo,
  onChange,
}: {
  rating: number | null
  editable: boolean
  isKo: boolean
  onChange?: ((rating: number) => void) | undefined
}) {
  return (
    <div className="flex items-center gap-0.5 text-amber-500">
      {editable ? (
        <div className="flex items-center gap-0.5" role="group" aria-label={isKo ? '별점 선택' : 'Select rating'}>
          {[1, 2, 3, 4, 5].map((star) => {
            const selected = rating !== null && star <= rating
            return (
              <button
                key={star}
                type="button"
                onClick={() => onChange?.(star)}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                  selected ? 'text-amber-500' : 'text-muted-foreground/40 hover:text-amber-400'
                }`}
                aria-label={isKo ? `${star}점` : `${star} star${star === 1 ? '' : 's'}`}
                aria-pressed={rating === star}
              >
                <Star className={`h-4 w-4 ${selected ? 'fill-current' : ''}`} aria-hidden />
              </button>
            )
          })}
        </div>
      ) : (
        <>
          <Star className="h-3.5 w-3.5 fill-current" aria-hidden />
          <span className="text-xs font-medium">{rating ?? '—'}</span>
        </>
      )}
    </div>
  )
}

export default function OtaReviewImportPreviewCard({
  locale,
  draft,
  reservation,
  linkedTour,
  lookupLoading,
  lookupError,
  alreadyImported = false,
  ratingEditable = false,
  productEditable = false,
  tourEditable = false,
  onRatingChange,
  onProductChange,
  onTourChange,
}: Props) {
  const isKo = locale === 'ko'

  if (!draft) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {isKo ? '등록 후 표시 미리보기' : 'Preview after save'}
        </p>
        <article className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-6 min-h-[320px] flex items-center justify-center text-center">
          <p className="text-sm text-muted-foreground">
            {isKo
              ? '리뷰 텍스트를 붙여넣으면 아래 목록과 같은 카드 형태로 미리보기가 표시됩니다.'
              : 'Paste review text to preview how it will appear in the list below.'}
          </p>
        </article>
      </div>
    )
  }

  const authorName = reservation?.customerName || draft.authorName || (isKo ? '고객명 미확인' : 'Guest unknown')
  const productId = reservation?.productId || draft.productId || undefined
  const productName = reservation?.productName || draft.productHint || undefined
  const tourId = linkedTour?.id || reservation?.tourId || draft.tourId || null
  const tourDateLabel = linkedTour?.tourDate || reservation?.tourDate || draft.tourDate || null
  const tourSelectedLabel = linkedTour
    ? formatTourSelectedLabel(linkedTour, isKo)
    : tourDateLabel && productName
      ? `${tourDateLabel} · ${productName}`
      : undefined

  const staffMembers: Array<{ name: string; role: 'guide' | 'assistant' }> = []
  if (linkedTour?.guideName) {
    staffMembers.push({ name: linkedTour.guideName, role: 'guide' })
  }
  if (linkedTour?.assistantName) {
    staffMembers.push({ name: linkedTour.assistantName, role: 'assistant' })
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {isKo ? '등록 후 표시 미리보기' : 'Preview after save'}
      </p>
      {alreadyImported ? (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
          <p>
            {isKo
              ? '이 리뷰는 이미 등록되어 있습니다. 중복 등록할 수 없습니다.'
              : 'This review is already registered.'}
          </p>
        </div>
      ) : null}
      {ratingEditable && (draft.rating === null || draft.rating < 1) ? (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
          <p>
            {isKo
              ? '별점은 복사되지 않습니다. 아래에서 1~5점을 선택하세요.'
              : 'Stars are not copied. Select a 1–5 rating below.'}
          </p>
        </div>
      ) : null}
      <article
        className={`rounded-xl border p-4 space-y-3 bg-card pointer-events-none select-none ${
          alreadyImported ? 'border-warning/40 opacity-80' : 'opacity-[0.98] border-border/50'
        }`}
      >
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={false}
            readOnly
            disabled
            className="mt-1 h-4 w-4 rounded border-border"
            aria-hidden
          />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <p className="font-medium text-foreground">{authorName}</p>
                {draft.reviewCreatedAt ? (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatLasVegasDate(draft.reviewCreatedAt, locale)}
                  </span>
                ) : null}
                <div className={ratingEditable ? 'pointer-events-auto' : undefined}>
                  <RatingStars
                    rating={draft.rating}
                    editable={ratingEditable}
                    isKo={isKo}
                    onChange={onRatingChange}
                  />
                </div>
                <span className="text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  pending
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="h-8 px-3 rounded-lg text-xs font-medium bg-success/10 text-success inline-flex items-center">
                  {isKo ? '승인' : 'Approve'}
                </span>
                <span className="h-8 px-3 rounded-lg text-xs font-medium bg-danger/10 text-danger inline-flex items-center">
                  {isKo ? '거절' : 'Reject'}
                </span>
              </div>
            </div>

            {draft.comment?.trim() ? (
              <GoogleReviewCommentPreview comment={draft.comment} isKo={isKo} />
            ) : null}

            <div className="space-y-2 pointer-events-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="text-xs font-medium text-muted-foreground">
                    {isKo ? '상품' : 'Product'}
                    {lookupLoading ? null : productId ? (
                      <span className="font-normal text-muted-foreground/80"> (tour_link)</span>
                    ) : null}
                  </label>
                  {lookupLoading ? (
                    <div className="flex items-center gap-2 h-10 px-3 rounded-lg border border-border bg-muted/30 text-sm text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      {isKo ? '상품 조회 중…' : 'Loading product…'}
                    </div>
                  ) : (
                    <OpTodoProductSelect
                      locale={locale}
                      variant="combobox"
                      value={productId}
                      {...(productName ? { selectedLabel: productName } : {})}
                      disabled={!productEditable}
                      onChange={(nextProductId) => onProductChange?.(nextProductId)}
                      inputClass="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm h-10"
                    />
                  )}
                </div>

                <div className="min-w-0 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs font-medium text-muted-foreground">
                      {isKo ? '투어' : 'Tour'}
                      {tourId ? (
                        <span className="font-normal text-muted-foreground/80"> (manual)</span>
                      ) : null}
                    </label>
                    <label className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="checkbox"
                        checked={false}
                        readOnly
                        disabled
                        className="h-4 w-4 rounded border-border"
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {isKo ? '가이드 평점 미반영' : 'Exclude staff rating'}
                      </span>
                    </label>
                  </div>
                  {lookupLoading ? (
                    <div className="flex items-center gap-2 h-10 px-3 rounded-lg border border-border bg-muted/30 text-sm text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      {isKo ? '투어 조회 중…' : 'Loading tour…'}
                    </div>
                  ) : lookupError ? (
                    <p className="text-xs text-danger py-2">{lookupError}</p>
                  ) : (
                    <GoogleReviewTourSelect
                      locale={locale}
                      reviewDate={draft.tourDate || draft.reviewCreatedAt}
                      productId={productId ?? null}
                      value={tourId}
                      {...(tourSelectedLabel ? { selectedLabel: tourSelectedLabel } : {})}
                      disabled={!tourEditable}
                      onChange={(nextTourId, tourProduct) => {
                        onTourChange?.(nextTourId, tourProduct ?? null)
                      }}
                    />
                  )}
                </div>
              </div>

              {staffMembers.length > 0 ? (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {isKo ? '직원' : 'Staff'}:{' '}
                    <strong>
                      {staffMembers
                        .map((member) => {
                          const role =
                            member.role === 'guide'
                              ? isKo
                                ? '가이드'
                                : 'Guide'
                              : isKo
                                ? '어시스턴트'
                                : 'Asst'
                          return `${member.name} (${role})`
                        })
                        .join(', ')}
                    </strong>
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </article>
    </div>
  )
}
