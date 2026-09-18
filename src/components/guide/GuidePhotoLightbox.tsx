'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Receipt, RotateCw, Trash2, X } from 'lucide-react'
import { TOUR_DETAIL_NESTED_PICKER_Z_INDEX } from '@/lib/dialogZIndex'
import ZoomablePhoto from '@/components/guide/ZoomablePhoto'
import { nextPhotoRotation, readPhotoRotation, storePhotoRotation, type PhotoRotation } from '@/lib/guidePhotoRotation'

export type GuidePhotoLightboxItem = {
  id: string
  src: string
  alt?: string
  kind?: 'photo' | 'receipt'
  canDelete?: boolean
}

type GuidePhotoLightboxProps = {
  items: GuidePhotoLightboxItem[]
  index: number
  open: boolean
  onClose: () => void
  onIndexChange: (index: number) => void
  onDelete?: ((item: GuidePhotoLightboxItem) => void) | undefined
  closeLabel: string
  prevLabel: string
  nextLabel: string
  hintLabel: string
  rotateLabel: string
  deleteLabel: string
  receiptBadge: string
  photoBadge: string
  deleting?: boolean | undefined
}

export default function GuidePhotoLightbox({
  items,
  index,
  open,
  onClose,
  onIndexChange,
  onDelete,
  closeLabel,
  prevLabel,
  nextLabel,
  hintLabel,
  rotateLabel,
  deleteLabel,
  receiptBadge,
  photoBadge,
  deleting,
}: GuidePhotoLightboxProps) {
  const item = items[index]
  const hasPrev = index > 0
  const hasNext = index < items.length - 1
  const [rotation, setRotation] = useState<PhotoRotation>(0)

  useEffect(() => {
    setRotation(item ? readPhotoRotation(item.id) : 0)
  }, [item?.id])

  useEffect(() => {
    if (!open) return
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
  }, [hasNext, hasPrev, index, onClose, onIndexChange, open])

  if (!open || !item || typeof document === 'undefined') return null

  const kindLabel = item.kind === 'receipt' ? receiptBadge : photoBadge

  return createPortal(
    <div
      className="fixed inset-0 flex flex-col bg-black"
      style={{ zIndex: TOUR_DETAIL_NESTED_PICKER_Z_INDEX + 50 }}
      role="dialog"
      aria-modal="true"
      aria-label={item.alt || closeLabel}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between bg-gradient-to-b from-black/70 to-transparent px-3 pb-10 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="pt-2">
          <p className="text-sm font-medium text-white/90">
            {items.length > 1 ? `${index + 1} / ${items.length}` : ''}
          </p>
          <span
            className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              item.kind === 'receipt' ? 'bg-amber-500 text-white' : 'bg-white/20 text-white'
            }`}
          >
            {item.kind === 'receipt' ? <Receipt className="h-3 w-3" /> : null}
            {kindLabel}
          </span>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const next = nextPhotoRotation(rotation)
              setRotation(next)
              storePhotoRotation(item.id, next)
            }}
            className="rounded-full bg-black/50 p-2.5 text-white hover:bg-black/70"
            aria-label={rotateLabel}
          >
            <RotateCw className="h-5 w-5" />
          </button>
          {onDelete && item.canDelete !== false ? (
            <button
              type="button"
              disabled={deleting}
              onClick={() => onDelete(item)}
              className="rounded-full bg-black/50 p-2.5 text-white hover:bg-red-600 disabled:opacity-50"
              aria-label={deleteLabel}
            >
              <Trash2 className="h-5 w-5" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-black/50 p-2.5 text-white hover:bg-black/70"
            aria-label={closeLabel}
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>

      {hasPrev && (
        <button
          type="button"
          onClick={() => onIndexChange(index - 1)}
          className="absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/50 p-3 text-white hover:bg-black/70 sm:inline-flex"
          aria-label={prevLabel}
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {hasNext && (
        <button
          type="button"
          onClick={() => onIndexChange(index + 1)}
          className="absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/50 p-3 text-white hover:bg-black/70 sm:inline-flex"
          aria-label={nextLabel}
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      <div className="min-h-0 flex-1">
        <ZoomablePhoto
          key={item.id}
          src={item.src}
          alt={item.alt || ''}
          rotation={rotation}
          onSwipeLeft={hasNext ? () => onIndexChange(index + 1) : undefined}
          onSwipeRight={hasPrev ? () => onIndexChange(index - 1) : undefined}
        />
      </div>

      <p className="pointer-events-none pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 text-center text-xs text-white/70">
        {hintLabel}
      </p>
    </div>,
    document.body
  )
}
