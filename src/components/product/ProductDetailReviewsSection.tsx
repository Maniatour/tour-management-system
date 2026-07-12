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
  source?: 'google' | 'internal'
  sourceUrl?: string
  avatarUrl?: string
}

type ProductDetailReviewsSectionProps = {
  reviews: ProductReviewItem[]
  averageRating?: number
  variant?: 'default' | 'airbnb'
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
  variant = 'default',
}: ProductDetailReviewsSectionProps) {
  const t = useTranslations('productDetail')

  if (!reviews.length) {
    return null
  }

  const avg =
    averageRating ??
    reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length

  if (variant === 'airbnb') {
    return (
      <section className="airbnb-detail-section">
        <h2 className="airbnb-detail-section-title">{t('guestReviewsTitle')}</h2>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 fill-[#1a2b49] text-[#1a2b49]" aria-hidden />
            <span className="text-2xl font-semibold text-[#1a2b49]">{avg.toFixed(1)}</span>
            <span className="text-[#6b7280]">·</span>
            <span className="text-base font-semibold text-[#1a2b49]">
              {t('reviewCount', { count: reviews.length })}
            </span>
          </div>
        </div>
        <div className="grid gap-8 md:grid-cols-2">
          {reviews.slice(0, 6).map((review, index) => (
            <article key={`${review.name}-${index}`}>
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1a2b49] text-sm font-semibold text-white">
                  {review.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1a2b49]">{review.name}</p>
                  {review.country ? (
                    <p className="text-xs text-[#6b7280]">{review.country}</p>
                  ) : null}
                </div>
              </div>
              <StarRating rating={review.rating} />
              <p className="mt-3 text-sm leading-relaxed text-[#374151]">
                &ldquo;{review.quote}&rdquo;
              </p>
            </article>
          ))}
        </div>
      </section>
    )
  }

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
