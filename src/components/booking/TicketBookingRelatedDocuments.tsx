'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export function isTicketBookingImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp)(\?|#|$)/i.test(url)
}

function AttachmentImageLightbox({
  url,
  onClose,
  closeLabel,
}: {
  url: string
  onClose: () => void
  closeLabel: string
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 sm:p-8"
      data-ticket-booking-docs-lightbox=""
      role="dialog"
      aria-modal="true"
      aria-label={closeLabel}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        aria-label={closeLabel}
      >
        <X className="h-5 w-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        className="max-h-[90vh] max-w-[min(96vw,56rem)] rounded-xl object-contain shadow-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body
  )
}

export function TicketBookingRelatedDocuments({
  urls,
  openLabel,
  closeLabel,
  imageClassName,
  onRemove,
  removeLabel,
}: {
  urls: string[]
  openLabel: string
  closeLabel: string
  imageClassName?: string
  onRemove?: (index: number) => void
  removeLabel?: string
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const files = urls.filter((u) => typeof u === 'string' && u.trim() !== '')

  if (files.length === 0) return null

  return (
    <>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {files.map((url, index) => {
          const isImage = isTicketBookingImageUrl(url)
          return (
            <div
              key={`${url}-${index}`}
              className="group relative overflow-hidden rounded-xl border border-border/60 bg-white shadow-sm transition duration-200 hover:shadow-md"
            >
              {isImage ? (
                <button
                  type="button"
                  className="block w-full text-left"
                  aria-label={openLabel}
                  onClick={(e) => {
                    e.stopPropagation()
                    setPreviewUrl(url)
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    className={
                      imageClassName ??
                      'h-52 w-full object-cover transition duration-300 group-hover:scale-[1.03] sm:h-56'
                    }
                  />
                </button>
              ) : (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={openLabel}
                  className="block"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex h-28 items-center justify-center bg-primary/5 text-xs font-semibold text-primary">
                    FILE
                  </div>
                </a>
              )}
              {onRemove ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove(index)
                  }}
                  className="absolute right-2 top-2 rounded-lg bg-white/90 p-1.5 text-red-600 shadow-sm hover:bg-red-50 hover:text-red-700"
                  aria-label={removeLabel || closeLabel}
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          )
        })}
      </div>
      {previewUrl ? (
        <AttachmentImageLightbox
          url={previewUrl}
          onClose={() => setPreviewUrl(null)}
          closeLabel={closeLabel}
        />
      ) : null}
    </>
  )
}
