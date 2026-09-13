'use client'

import { Star } from 'lucide-react'

type AdminTourPhotoStarButtonProps = {
  isFavorite: boolean
  addLabel: string
  removeLabel: string
  onToggle: () => void
}

export default function AdminTourPhotoStarButton({
  isFavorite,
  addLabel,
  removeLabel,
  onToggle,
}: AdminTourPhotoStarButtonProps) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onToggle()
      }}
      className="absolute right-2 top-2 z-10 rounded-full bg-black/55 p-1.5 text-white hover:bg-black/75"
      aria-label={isFavorite ? removeLabel : addLabel}
      aria-pressed={isFavorite}
    >
      <Star className={`h-4 w-4 ${isFavorite ? 'fill-amber-400 text-amber-400' : 'text-white'}`} />
    </button>
  )
}
