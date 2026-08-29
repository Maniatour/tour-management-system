'use client'

type ReviewBubbleRatingProps = {
  value: number | null
  onChange: (value: number) => void
  size?: 'lg' | 'sm'
  name: string
}

export default function ReviewBubbleRating({
  value,
  onChange,
  size = 'sm',
  name,
}: ReviewBubbleRatingProps) {
  const dim = size === 'lg' ? 'h-12 w-12 sm:h-[52px] sm:w-[52px]' : 'h-7 w-7'
  const gap = size === 'lg' ? 'gap-3' : 'gap-1.5'

  return (
    <div className={`flex items-center ${gap}`} role="radiogroup" aria-label={name}>
      {Array.from({ length: 5 }).map((_, index) => {
        const rating = index + 1
        const selected = value != null && rating <= value
        return (
          <button
            key={rating}
            type="button"
            role="radio"
            aria-checked={value === rating}
            aria-label={`${rating}`}
            onClick={() => onChange(rating)}
            className={`${dim} shrink-0 rounded-full border-[2.5px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wr-accent)] focus-visible:ring-offset-2 ${
              selected
                ? 'border-[var(--wr-accent)] bg-[var(--wr-accent)]'
                : 'border-[#c6c6c6] bg-white hover:border-[var(--wr-accent)]'
            }`}
          />
        )
      })}
    </div>
  )
}
