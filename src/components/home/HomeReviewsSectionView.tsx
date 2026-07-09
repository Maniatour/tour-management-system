'use client'

import { Star } from 'lucide-react'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import { getDemoReviews } from '@/components/home/homeExtendedSectionData'

export type ReviewsStructureVariant = 'card-grid' | 'carousel-strip' | 'featured-quote' | 'masonry-mix'

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
        />
      ))}
    </div>
  )
}

export default function HomeReviewsSectionView({
  variant,
  t,
  zoneId,
  titleOverride,
  itemCount = 3,
}: {
  variant: ReviewsStructureVariant
  t: (key: string) => string
  zoneId: string
  titleOverride?: string
  itemCount?: number
}) {
  const reviews = getDemoReviews(t).slice(0, itemCount)
  const title = titleOverride?.trim() || t('guestReviewsTitle')

  if (variant === 'featured-quote') {
    const featured = reviews[0]
    if (!featured) return null
    return (
      <CustomerPageZone zone={zoneId}>
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <StarRating rating={featured.rating} />
          <blockquote className="text-xl sm:text-2xl font-medium mt-4 mb-6 leading-relaxed">
            &ldquo;{featured.quote}&rdquo;
          </blockquote>
          <p className="font-semibold">{featured.name}</p>
          <p className="text-sm cp-ui-muted">{featured.country}</p>
        </div>
      </CustomerPageZone>
    )
  }

  if (variant === 'carousel-strip') {
    return (
      <CustomerPageZone zone={zoneId}>
        <div className="max-w-7xl mx-auto px-4 py-10">
          <h2 className="text-2xl font-bold mb-6">{title}</h2>
          <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
            {reviews.map((r, i) => (
              <article
                key={i}
                className="snap-start shrink-0 w-72 cp-ui-card-surface rounded-2xl border p-5"
              >
                <StarRating rating={r.rating} />
                <p className="text-sm mt-3 mb-4 line-clamp-4">&ldquo;{r.quote}&rdquo;</p>
                <p className="text-sm font-semibold">{r.name}</p>
                <p className="text-xs cp-ui-muted">{r.country}</p>
              </article>
            ))}
          </div>
        </div>
      </CustomerPageZone>
    )
  }

  if (variant === 'masonry-mix') {
    return (
      <CustomerPageZone zone={zoneId}>
        <div className="max-w-7xl mx-auto px-4 py-10">
          <h2 className="text-2xl font-bold text-center mb-8">{title}</h2>
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
            {reviews.map((r, i) => (
              <article key={i} className="break-inside-avoid cp-ui-card-surface rounded-2xl border p-5">
                <StarRating rating={r.rating} />
                <p className="text-sm mt-3 mb-3">&ldquo;{r.quote}&rdquo;</p>
                <p className="text-sm font-semibold">{r.name}</p>
              </article>
            ))}
          </div>
        </div>
      </CustomerPageZone>
    )
  }

  return (
    <CustomerPageZone zone={zoneId}>
      <div className="max-w-7xl mx-auto px-4 py-10">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2">{title}</h2>
        <p className="text-center cp-ui-muted mb-8">{t('guestReviewsDesc')}</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {reviews.map((r, i) => (
            <article key={i} className="cp-ui-card-surface rounded-2xl border p-6">
              <StarRating rating={r.rating} />
              <p className="text-sm mt-4 mb-4">&ldquo;{r.quote}&rdquo;</p>
              <p className="font-semibold">{r.name}</p>
              <p className="text-xs cp-ui-muted">{r.country}</p>
            </article>
          ))}
        </div>
      </div>
    </CustomerPageZone>
  )
}
