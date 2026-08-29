'use client'

import Image from 'next/image'

type WriteReviewProductCardProps = {
  title: string
  imageUrl: string | null
  providerName: string
  changeLabel: string
  onChangeActivity: () => void
}

export default function WriteReviewProductCard({
  title,
  imageUrl,
  providerName,
  changeLabel,
  onChangeActivity,
}: WriteReviewProductCardProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-md bg-muted">
        {imageUrl ? (
          <Image src={imageUrl} alt={title} fill className="object-cover" sizes="72px" />
        ) : (
          <div className="h-full w-full bg-muted" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="text-[15px] font-bold leading-snug text-foreground sm:text-base">{title}</h1>
        <p className="mt-1 text-sm font-medium text-foreground underline underline-offset-2">
          {providerName}
        </p>
        <button
          type="button"
          onClick={onChangeActivity}
          className="mt-1 text-[13px] font-medium text-[var(--wr-accent)] underline underline-offset-2 hover:opacity-80"
        >
          {changeLabel}
        </button>
      </div>
    </div>
  )
}
