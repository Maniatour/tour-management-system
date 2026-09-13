'use client'

import { useEffect } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, Star, X } from 'lucide-react'
import { TourPhotoMediaViewer } from '@/components/tour/TourPhotoMedia'
import type { AdminGalleryPhoto } from '@/lib/adminTourPhotos'

type AdminTourPhotoLightboxProps = {
  photos: AdminGalleryPhoto[]
  index: number
  openTourLabel: string
  hiddenBadge: string
  closeLabel: string
  prevLabel: string
  nextLabel: string
  favoriteAddLabel: string
  favoriteRemoveLabel: string
  isFavorite: boolean
  onClose: () => void
  onIndexChange: (index: number) => void
  onOpenTour: (tourId: string) => void
  onToggleFavorite: (photoId: string) => void
}

export default function AdminTourPhotoLightbox({
  photos,
  index,
  openTourLabel,
  hiddenBadge,
  closeLabel,
  prevLabel,
  nextLabel,
  favoriteAddLabel,
  favoriteRemoveLabel,
  isFavorite,
  onClose,
  onIndexChange,
  onOpenTour,
  onToggleFavorite,
}: AdminTourPhotoLightboxProps) {
  const photo = photos[index]
  const hasPrev = index > 0
  const hasNext = index < photos.length - 1

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft' && hasPrev) onIndexChange(index - 1)
      if (event.key === 'ArrowRight' && hasNext) onIndexChange(index + 1)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [hasNext, hasPrev, index, onClose, onIndexChange])

  if (!photo) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <button type="button" className="absolute inset-0" aria-label={closeLabel} onClick={onClose} />
      <div className="relative flex h-full w-full max-w-6xl items-center justify-center">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
          aria-label={closeLabel}
        >
          <X className="h-6 w-6" />
        </button>
        {hasPrev && (
          <button
            type="button"
            onClick={() => onIndexChange(index - 1)}
            className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-3 text-white hover:bg-black/70"
            aria-label={prevLabel}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {hasNext && (
          <button
            type="button"
            onClick={() => onIndexChange(index + 1)}
            className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-3 text-white hover:bg-black/70"
            aria-label={nextLabel}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
        <TourPhotoMediaViewer
          filePath={photo.filePath}
          fileName={photo.fileName}
          mimeType={photo.mimeType}
          alt={photo.fileName}
        />
        <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-black/55 p-4 text-white">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {photo.tourDate} · {photo.productName}
              </p>
              <p className="truncate text-xs text-white/80">
                {[photo.guideName, photo.assistantName].filter(Boolean).join(' · ')
                  || photo.uploadedByName
                  || photo.uploadedBy}
                {photo.hiddenByAdmin ? ` · ${hiddenBadge}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onToggleFavorite(photo.id)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-sm font-medium hover:bg-white/25"
                aria-pressed={isFavorite}
              >
                <Star className={`h-4 w-4 ${isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                {isFavorite ? favoriteRemoveLabel : favoriteAddLabel}
              </button>
              <button
                type="button"
                onClick={() => onOpenTour(photo.tourId)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-sm font-medium hover:bg-white/25"
              >
                <ExternalLink className="h-4 w-4" />
                {openTourLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
