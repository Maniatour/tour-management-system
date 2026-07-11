'use client'

import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ReviewSummaryProps = {
  rating: number
  reviewCount: number
  /** e.g. "4.9" display — defaults to rating.toFixed(1) */
  ratingLabel?: string
  reviewsLabel: string
  className?: string
  compact?: boolean
}

export default function ReviewSummary({
  rating,
  reviewCount,
  ratingLabel,
  reviewsLabel,
  className,
  compact = false,
}: ReviewSummaryProps) {
  if (reviewCount <= 0 || rating <= 0) {
    return null
  }

  const displayRating = ratingLabel ?? rating.toFixed(1)

  return (
    <div
      className={cn(
        'inline-flex flex-wrap items-center gap-2',
        compact ? 'gap-1.5' : 'gap-2 sm:gap-3',
        className
      )}
      aria-label={`${displayRating} ${reviewsLabel}`}
    >
      <div className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-white px-2.5 py-1 shadow-sm">
        <Star
          className={cn('fill-amber-400 text-amber-400', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')}
          aria-hidden
        />
        <span className={cn('font-semibold text-foreground', compact ? 'text-xs' : 'text-sm')}>
          {displayRating}
        </span>
      </div>
      <span className={cn('text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>
        {reviewsLabel}
      </span>
    </div>
  )
}
