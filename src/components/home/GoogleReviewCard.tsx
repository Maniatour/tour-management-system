'use client'

import Image from 'next/image'
import { MoreVertical, Star } from 'lucide-react'
import type { ProductReviewItem } from '@/components/product/ProductDetailReviewsSection'

function GoogleStarRating({ rating }: { rating: number }) {
  return (
    <div className="kv-google-review-stars" aria-label={`${rating} stars`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={`kv-google-review-star ${index < rating ? 'kv-google-review-star--filled' : ''}`}
          aria-hidden
        />
      ))}
    </div>
  )
}

type GoogleReviewCardProps = {
  review: ProductReviewItem
  menuHref?: string | null
}

export default function GoogleReviewCard({
  review,
  menuHref,
}: GoogleReviewCardProps) {
  const profileLink = menuHref ?? review.sourceUrl ?? null

  return (
    <article className="kv-google-review">
      <div className="kv-google-review-header">
        <div className="kv-google-review-identity">
          <div className="kv-google-review-avatar" aria-hidden>
            {review.avatarUrl ? (
              <Image
                src={review.avatarUrl}
                alt=""
                width={40}
                height={40}
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{review.name.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="kv-google-review-identity-text">
            <p className="kv-google-review-name">{review.name}</p>
            {review.source !== 'google' && review.country ? (
              <p className="kv-google-review-source">{review.country}</p>
            ) : null}
          </div>
        </div>
        {profileLink ? (
          <a
            href={profileLink}
            className="kv-google-review-menu"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View review on Google"
          >
            <MoreVertical className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </a>
        ) : null}
      </div>

      <div className="kv-google-review-meta-row">
        <GoogleStarRating rating={review.rating} />
        {review.date ? <span className="kv-google-review-time">{review.date}</span> : null}
      </div>

      <p className="kv-google-review-body">{review.quote}</p>
    </article>
  )
}
