'use client'

import { Star } from 'lucide-react'
import { useTranslations } from 'next-intl'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { SectionHeader } from '@/components/ui/section-header'
import { Card } from '@/components/ui/card'

export type ProductReviewItem = {
  name: string
  country?: string
  rating: number
  quote: string
  date?: string
}

type ProductDetailReviewsSectionProps = {
  reviews: ProductReviewItem[]
  averageRating?: number
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
        />
      ))}
    </div>
  )
}

/** Renders only when real review data is provided — no placeholder or demo content. */
export default function ProductDetailReviewsSection({
  reviews,
  averageRating,
}: ProductDetailReviewsSectionProps) {
  const t = useTranslations('productDetail')

  if (!reviews.length) {
    return null
  }

  const avg =
    averageRating ??
    reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length

  return (
    <CustomerPageZone zone="detail-reviews-section">
      <Section spacing="compact" variant="muted">
        <Container>
          <SectionHeader
            heading={t('guestReviewsTitle')}
            subtitle={t('guestReviewsSubtitle')}
          />
          <div className="mb-6 flex items-center gap-3">
            <span className="text-2xl font-bold text-foreground">{avg.toFixed(1)}</span>
            <StarRating rating={Math.round(avg)} />
            <span className="text-sm text-muted-foreground">
              {t('reviewCount', { count: reviews.length })}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((review, index) => (
              <Card key={`${review.name}-${index}`} variant="elevated" className="p-5 sm:p-6">
                <StarRating rating={review.rating} />
                <p className="mt-3 text-sm leading-relaxed text-foreground">
                  &ldquo;{review.quote}&rdquo;
                </p>
                <p className="mt-4 text-sm font-semibold text-foreground">{review.name}</p>
                {review.country ? (
                  <p className="text-xs text-muted-foreground">{review.country}</p>
                ) : null}
                {review.date ? (
                  <p className="mt-1 text-xs text-muted-foreground">{review.date}</p>
                ) : null}
              </Card>
            ))}
          </div>
        </Container>
      </Section>
    </CustomerPageZone>
  )
}
