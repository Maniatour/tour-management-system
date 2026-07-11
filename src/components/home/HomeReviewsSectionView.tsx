'use client'

import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import type { ProductReviewItem } from '@/components/product/ProductDetailReviewsSection'
import { fetchProductReviews } from '@/lib/fetchProductReviews'

export type ReviewsStructureVariant = 'card-grid' | 'carousel-strip' | 'featured-quote' | 'masonry-mix'

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
        />
      ))}
    </div>
  )
}

export default function HomeReviewsSectionView({
  variant,
  t,
  zoneId,
  locale,
  titleOverride,
  itemCount = 3,
}: {
  variant: ReviewsStructureVariant
  t: (key: string) => string
  zoneId: string
  locale: string
  titleOverride?: string
  itemCount?: number
}) {
  const [reviews, setReviews] = useState<ProductReviewItem[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const result = await fetchProductReviews({
        locale,
        limit: Math.max(itemCount, 6),
      })

      if (cancelled) return
      setReviews(result.reviews.slice(0, itemCount))
      setLoaded(true)
    })()

    return () => {
      cancelled = true
    }
  }, [locale, itemCount])

  if (!loaded || reviews.length === 0) {
    return null
  }

  const title = titleOverride?.trim() || t('guestReviewsTitle')

  if (variant === 'featured-quote') {
    const featured = reviews[0]
    if (!featured) return null
    return (
      <CustomerPageZone zone={zoneId}>
        <div className="mx-auto max-w-4xl px-4 py-12 text-center">
          <StarRating rating={featured.rating} />
          <blockquote className="mb-6 mt-4 text-xl font-medium leading-relaxed sm:text-2xl">
            &ldquo;{featured.quote}&rdquo;
          </blockquote>
          <p className="font-semibold">{featured.name}</p>
          {featured.country ? (
            <p className="text-sm cp-ui-muted">{featured.country}</p>
          ) : null}
        </div>
      </CustomerPageZone>
    )
  }

  if (variant === 'carousel-strip') {
    return (
      <CustomerPageZone zone={zoneId}>
        <div className="mx-auto max-w-7xl px-4 py-10">
          <h2 className="mb-6 text-2xl font-bold">{title}</h2>
          <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
            {reviews.map((review, index) => (
              <article
                key={`${review.name}-${index}`}
                className="cp-ui-card-surface w-72 shrink-0 snap-start rounded-2xl border p-5"
              >
                <StarRating rating={review.rating} />
                <p className="mb-4 mt-3 line-clamp-4 text-sm">&ldquo;{review.quote}&rdquo;</p>
                <p className="text-sm font-semibold">{review.name}</p>
                {review.country ? (
                  <p className="text-xs cp-ui-muted">{review.country}</p>
                ) : null}
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
        <div className="mx-auto max-w-7xl px-4 py-10">
          <h2 className="mb-8 text-center text-2xl font-bold">{title}</h2>
          <div className="columns-1 gap-4 space-y-4 sm:columns-2 lg:columns-3">
            {reviews.map((review, index) => (
              <article
                key={`${review.name}-${index}`}
                className="cp-ui-card-surface break-inside-avoid rounded-2xl border p-5"
              >
                <StarRating rating={review.rating} />
                <p className="mb-3 mt-3 text-sm">&ldquo;{review.quote}&rdquo;</p>
                <p className="text-sm font-semibold">{review.name}</p>
              </article>
            ))}
          </div>
        </div>
      </CustomerPageZone>
    )
  }

  return (
    <CustomerPageZone zone={zoneId}>
      <div className="mx-auto max-w-7xl px-4 py-10">
        <h2 className="mb-2 text-center text-2xl font-bold sm:text-3xl">{title}</h2>
        <p className="mb-8 text-center cp-ui-muted">{t('guestReviewsDesc')}</p>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((review, index) => (
            <article
              key={`${review.name}-${index}`}
              className="cp-ui-card-surface rounded-2xl border p-6"
            >
              <StarRating rating={review.rating} />
              <p className="mb-4 mt-4 text-sm">&ldquo;{review.quote}&rdquo;</p>
              <p className="font-semibold">{review.name}</p>
              {review.country ? (
                <p className="text-xs cp-ui-muted">{review.country}</p>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </CustomerPageZone>
  )
}
