'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Star } from 'lucide-react'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import type { ProductReviewItem } from '@/components/product/ProductDetailReviewsSection'
import { fetchGoogleReviews } from '@/lib/fetchGoogleReviews'
import { fetchInstagramPosts } from '@/lib/fetchInstagramPosts'
import { fetchProductReviews } from '@/lib/fetchProductReviews'
import { getDemoReviews } from '@/components/home/homeExtendedSectionData'
import GoogleReviewCard from '@/components/home/GoogleReviewCard'
import {
  HomeManiaTourSectionViewAllFooter,
  HomeManiaTourViewAllLink,
} from '@/components/home/HomeManiaTourSectionHeader'
import { getPublicInstagramProfileUrl } from '@/lib/instagramPublic'
import type { InstagramPostItem } from '@/lib/instagramPublic'
import { MANIATOUR_INSTAGRAM_IMAGES } from '@/lib/maniatourHomeData'

export type ReviewsStructureVariant =
  | 'card-grid'
  | 'carousel-strip'
  | 'featured-quote'
  | 'masonry-mix'
  | 'maniatour-split-instagram'

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < rating ? 'fill-[#ff7e33] text-[#ff7e33]' : 'text-gray-200'}`}
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
  const [googleMapsUrl, setGoogleMapsUrl] = useState<string | null>(null)
  const [instagramPosts, setInstagramPosts] = useState<InstagramPostItem[]>([])
  const [instagramProfileUrl, setInstagramProfileUrl] = useState(getPublicInstagramProfileUrl())
  const [loaded, setLoaded] = useState(false)
  const [reviewIndex, setReviewIndex] = useState(0)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const [googleResult, instagramResult] = await Promise.all([
        fetchGoogleReviews({
          locale,
          limit: Math.max(itemCount, 6),
        }),
        fetchInstagramPosts({ limit: 10 }),
      ])

      if (cancelled) return

      if (instagramResult.posts.length > 0) {
        setInstagramPosts(instagramResult.posts)
        setInstagramProfileUrl(instagramResult.profileUrl)
      }

      if (googleResult.reviews.length > 0) {
        setReviews(googleResult.reviews.slice(0, Math.max(itemCount, 3)))
        setGoogleMapsUrl(googleResult.mapsUrl)
        setLoaded(true)
        return
      }

      const productResult = await fetchProductReviews({
        locale,
        limit: Math.max(itemCount, 6),
      })

      if (cancelled) return
      if (productResult.reviews.length > 0) {
        setReviews(productResult.reviews.slice(0, Math.max(itemCount, 3)))
      } else {
        setReviews(
          getDemoReviews(t).map((review) => ({
            name: review.name,
            country: review.country,
            rating: review.rating,
            quote: review.quote,
          }))
        )
      }
      setGoogleMapsUrl(null)
      setLoaded(true)
    })()

    return () => {
      cancelled = true
    }
  }, [locale, itemCount, t])

  if (variant === 'maniatour-split-instagram') {
    const pool = reviews.length > 0 ? reviews : getDemoReviews(t).map((r) => ({
      name: r.name,
      country: r.country,
      rating: r.rating,
      quote: r.quote,
    }))
    const activeReview = pool[reviewIndex % pool.length] ?? pool[0]
    const instagramGridItems =
      instagramPosts.length > 0
        ? instagramPosts.map((post) => ({
            key: post.id,
            imageUrl: post.imageUrl,
            href: post.permalink,
            alt: post.caption?.slice(0, 120) || `${t('homeInstagramTitle')} ${post.id}`,
          }))
        : MANIATOUR_INSTAGRAM_IMAGES.map((imageUrl, index) => ({
            key: `fallback-${index}`,
            imageUrl,
            href: instagramProfileUrl,
            alt: `${t('homeInstagramTitle')} ${index + 1}`,
          }))

    if (!loaded && !activeReview) {
      return (
        <CustomerPageZone zone={zoneId}>
          <section className="kv-section" aria-busy="true" />
        </CustomerPageZone>
      )
    }

    return (
      <CustomerPageZone zone={zoneId}>
        <section className="kv-section" id="home-reviews">
          <div className="kv-container">
            <div className="kv-reviews-split">
              <div className="kv-reviews-panel">
                <div className="kv-section-header-row">
                  <div className="kv-section-header">
                    <h2 className="kv-section-title">{t('homeReviewsManiaTourTitle')}</h2>
                  </div>
                  <div className="kv-section-view-all-inline">
                    <HomeManiaTourViewAllLink
                      href={googleMapsUrl ?? `/${locale}/products`}
                      label={googleMapsUrl ? t('homeViewAllGoogleReviews') : t('homeViewAllReviews')}
                      {...(googleMapsUrl
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : {})}
                    />
                  </div>
                </div>
                {activeReview ? (
                  <GoogleReviewCard review={activeReview} menuHref={googleMapsUrl} />
                ) : null}
                {pool.length > 1 ? (
                  <div className="kv-review-nav">
                    <button
                      type="button"
                      className="kv-review-nav-btn"
                      onClick={() => setReviewIndex((i) => (i - 1 + pool.length) % pool.length)}
                      aria-label="Previous review"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="kv-review-nav-btn"
                      onClick={() => setReviewIndex((i) => (i + 1) % pool.length)}
                      aria-label="Next review"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}
                <HomeManiaTourSectionViewAllFooter
                  href={googleMapsUrl ?? `/${locale}/products`}
                  label={googleMapsUrl ? t('homeViewAllGoogleReviews') : t('homeViewAllReviews')}
                  {...(googleMapsUrl
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                />
              </div>
              <div className="kv-reviews-divider" aria-hidden />
              <div className="kv-instagram-panel">
                <div className="kv-section-header-row kv-instagram-header">
                  <div className="kv-section-header">
                    <h2 className="kv-section-title">{t('homeInstagramTitle')}</h2>
                  </div>
                  <div className="kv-section-view-all-inline">
                    <HomeManiaTourViewAllLink
                      href={instagramProfileUrl}
                      label={t('homeViewOnInstagram')}
                      size="sm"
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  </div>
                </div>
                <div className="kv-instagram-grid kv-instagram-grid--10">
                  {instagramGridItems.map((item) => (
                    <Link
                      key={item.key}
                      href={item.href}
                      className="kv-instagram-item block"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={item.alt}
                    >
                      <Image
                        src={item.imageUrl}
                        alt={item.alt}
                        fill
                        sizes="(max-width: 768px) 20vw, 100px"
                        className="object-cover"
                      />
                    </Link>
                  ))}
                </div>
                <HomeManiaTourSectionViewAllFooter
                  href={instagramProfileUrl}
                  label={t('homeViewOnInstagram')}
                  size="sm"
                  target="_blank"
                  rel="noopener noreferrer"
                />
              </div>
            </div>
          </div>
        </section>
      </CustomerPageZone>
    )
  }

  if (!loaded || reviews.length === 0) {
    return null
  }

  const title = titleOverride?.trim() || t('guestReviewsTitle')

  return (
    <CustomerPageZone zone={zoneId}>
      <div className="mx-auto max-w-7xl px-4 py-10">
        <h2 className="mb-2 text-center text-2xl font-bold sm:text-3xl">{title}</h2>
        <p className="mb-8 text-center cp-ui-muted">{t('guestReviewsDesc')}</p>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((review, index) => (
            <article key={`${review.name}-${index}`} className="cp-ui-card-surface rounded-2xl border p-6">
              <StarRating rating={review.rating} />
              <p className="mb-4 mt-4 text-sm">&ldquo;{review.quote}&rdquo;</p>
              <p className="font-semibold">{review.name}</p>
            </article>
          ))}
        </div>
      </div>
    </CustomerPageZone>
  )
}
