'use client'

import { Star } from 'lucide-react'

type AdminSidebarFavoriteStarProps = {
  active: boolean
  onClick: () => void
  addLabel: string
  removeLabel: string
  limitLabel: string
  atLimit: boolean
}

export default function AdminSidebarFavoriteStar({
  active,
  onClick,
  addLabel,
  removeLabel,
  limitLabel,
  atLimit,
}: AdminSidebarFavoriteStarProps) {
  const disabled = !active && atLimit
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        if (disabled) return
        onClick()
      }}
      className={`ml-1 shrink-0 rounded-md p-1 transition-colors ${
        disabled
          ? 'cursor-not-allowed text-gray-300'
          : active
            ? 'text-amber-500 hover:bg-amber-50 hover:text-amber-600'
            : 'text-gray-300 hover:bg-gray-100 hover:text-amber-500'
      }`}
      aria-label={active ? removeLabel : disabled ? limitLabel : addLabel}
      title={active ? removeLabel : disabled ? limitLabel : addLabel}
    >
      <Star size={14} className={active ? 'fill-current' : undefined} />
    </button>
  )
}
