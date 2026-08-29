'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Star } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import GuideReviewSummaryCard from '@/components/guide/GuideReviewSummaryCard'
import type { GuideReviewSummary } from '@/lib/guideReviews'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { SectionHeader } from '@/components/ui/section-header'

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
  productId?: string
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

function buildReviewSummary(
  reviews: ProductReviewItem[],
  averageRating?: number
): GuideReviewSummary {
  const counts = { five: 0, four: 0, three: 0, two: 0, one: 0 }
  let ratingSum = 0

  for (const review of reviews) {
    ratingSum += review.rating
    if (review.rating >= 5) counts.five += 1
    else if (review.rating >= 4) counts.four += 1
    else if (review.rating >= 3) counts.three += 1
    else if (review.rating >= 2) counts.two += 1
    else counts.one += 1
  }

  return {
    reviewCount: reviews.length,
    avgRating:
      averageRating ?? (reviews.length > 0 ? ratingSum / reviews.length : null),
    fiveStarCount: counts.five,
    fourStarCount: counts.four,
    threeStarCount: counts.three,
    twoStarCount: counts.two,
    oneStarCount: counts.one,
    unreadCount: 0,
  }
}

function ReviewCarouselCard({
  reviews,
  accentClassName = 'bg-foreground text-background',
}: {
  reviews: ProductReviewItem[]
  accentClassName?: string
}) {
  const t = useTranslations('productDetail')
  const [index, setIndex] = useState(0)
  const total = reviews.length
  const review = reviews[index] ?? reviews[0]

  if (!review) return null

  const goPrev = () => setIndex((i) => (i - 1 + total) % total)
  const goNext = () => setIndex((i) => (i + 1) % total)

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm">
      <article
        key={`${review.name}-${index}`}
        className="p-5 sm:p-6 transition-opacity duration-300"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="mb-4 flex items-center gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${accentClassName}`}
            aria-hidden
          >
            {review.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{review.name}</p>
            {review.country ? (
              <p className="text-xs text-muted-foreground">{review.country}</p>
            ) : null}
          </div>
          {review.date ? (
            <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
              {review.date}
            </span>
          ) : null}
        </div>

        <StarRating rating={review.rating} />

        <p className="mt-4 text-sm leading-relaxed text-foreground sm:text-base">
          &ldquo;{review.quote}&rdquo;
        </p>
      </article>

      {total > 1 ? (
        <div className="flex items-center justify-between gap-3 border-t border-border/60 px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={goPrev}
            aria-label={t('reviewPrev')}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>

          <p className="text-sm tabular-nums text-muted-foreground">
            {t('reviewCarouselPosition', { current: index + 1, total })}
          </p>

          <button
            type="button"
            onClick={goNext}
            aria-label={t('reviewNext')}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  )
}

function WriteReviewLink({
  locale,
  productId,
  label,
}: {
  locale: string
  productId?: string | undefined
  label: string
}) {
  const href = productId
    ? `/${locale}/reviews/write?productId=${encodeURIComponent(productId)}`
    : `/${locale}/reviews/write`

  return (
    <Link
      href={href}
      className="inline-flex h-11 items-center justify-center rounded-xl border border-border/60 bg-white px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {label}
    </Link>
  )
}

export default function ProductDetailReviewsSection({
  reviews,
  averageRating,
  variant = 'default',
  productId,
}: ProductDetailReviewsSectionProps) {
  const t = useTranslations('productDetail')
  const locale = useLocale()

  const summary = useMemo(
    () => buildReviewSummary(reviews, averageRating),
    [reviews, averageRating]
  )

  const writeCta = (
    <div className={`${reviews.length ? 'mt-6' : ''} flex flex-col items-start gap-2`}>
      {!reviews.length ? (
        <p className="text-sm text-muted-foreground">{t('writeReviewBeFirst')}</p>
      ) : null}
      <WriteReviewLink locale={locale} productId={productId} label={t('writeReviewCta')} />
    </div>
  )

  if (variant === 'airbnb') {
    return (
      <section className="airbnb-detail-section">
        <h2 className="airbnb-detail-section-title">{t('guestReviewsTitle')}</h2>

        {reviews.length > 0 ? (
          <>
            <div className="mb-6 overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm">
              <GuideReviewSummaryCard
                summary={summary}
                locale={locale}
                interactive={false}
                className="px-3 py-4 sm:px-5 sm:py-5"
              />
            </div>

            <ReviewCarouselCard
              reviews={reviews}
              accentClassName="bg-[#1a2b49] text-white"
            />
          </>
        ) : null}

        {writeCta}
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

          {reviews.length > 0 ? (
            <>
              <div className="mb-6 overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm">
                <GuideReviewSummaryCard
                  summary={summary}
                  locale={locale}
                  interactive={false}
                  className="px-3 py-4 sm:px-5 sm:py-5"
                />
              </div>

              <ReviewCarouselCard reviews={reviews} />
            </>
          ) : null}

          {writeCta}
        </Container>
      </Section>
    </CustomerPageZone>
  )
}
