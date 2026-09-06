'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import TourChatRoom from './TourChatRoom'
import { DIALOG_Z_INDEX } from '@/lib/dialogZIndex'
import type { SupportedLanguage } from '@/lib/translation'

interface TourChatModalProps {
  tourId: string
  guideEmail: string
  tourDate: string
  isOpen: boolean
  onClose: () => void
  title: string
  closeLabel: string
  customerLanguage?: SupportedLanguage
  productNames?: { name?: string | null; name_ko?: string | null; name_en?: string | null } | null
}

export default function TourChatModal({
  tourId,
  guideEmail,
  tourDate,
  isOpen,
  onClose,
  title,
  closeLabel,
  customerLanguage = 'en',
  productNames = null,
}: TourChatModalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const html = document.documentElement
    const body = document.body
    const prevHtmlOverflow = html.style.overflow
    const prevBodyOverflow = body.style.overflow
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      html.style.overflow = prevHtmlOverflow
      body.style.overflow = prevBodyOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen || !mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 flex flex-col bg-white"
      style={{ zIndex: DIALOG_Z_INDEX.elevated }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <h2 className="min-w-0 truncate text-base font-semibold tracking-tight text-gray-900">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          aria-label={closeLabel}
        >
          <X className="h-6 w-6" aria-hidden />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden pb-[env(safe-area-inset-bottom,0px)]">
        <TourChatRoom
          tourId={tourId}
          guideEmail={guideEmail}
          tourDate={tourDate}
          isPublicView={false}
          customerLanguage={customerLanguage}
          productNames={productNames}
        />
      </div>
    </div>,
    document.body
  )
}
