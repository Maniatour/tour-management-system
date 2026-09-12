'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Eye, EyeOff, MoreVertical, Receipt } from 'lucide-react'
import { useTranslations } from 'next-intl'

type TourPhotoThumbOverflowMenuProps = {
  disabled?: boolean
  canMoveToReceipt: boolean
  hiddenByAdmin?: boolean
  onMoveToReceipt: () => void
  onToggleHideFromCustomers: () => void
}

export function TourPhotoThumbOverflowMenu({
  disabled = false,
  canMoveToReceipt,
  hiddenByAdmin = false,
  onMoveToReceipt,
  onToggleHideFromCustomers,
}: TourPhotoThumbOverflowMenuProps) {
  const t = useTranslations('tours.tourPhoto')
  const [menu, setMenu] = useState<{ top: number; left: number } | null>(null)

  const close = useCallback(() => setMenu(null), [])

  const openMenu = (anchor: HTMLElement) => {
    if (disabled || typeof window === 'undefined') return
    if (menu) {
      close()
      return
    }
    const rect = anchor.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const menuW = 220
    const menuH = 120
    const left = Math.min(Math.max(8, rect.right - menuW), Math.max(8, vw - menuW - 8))
    const spaceBelow = vh - rect.bottom
    const top =
      spaceBelow < menuH && rect.top > menuH
        ? Math.max(8, rect.top - menuH - 4)
        : rect.bottom + 4
    setMenu({ top, left })
  }

  useEffect(() => {
    if (!menu) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    const onScroll = () => close()
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', close)
    }
  }, [menu, close])

  const portal =
    menu &&
    typeof document !== 'undefined' &&
    createPortal(
      <>
        <div
          className="fixed inset-0 z-[10050]"
          aria-hidden
          onClick={(e) => {
            e.stopPropagation()
            close()
          }}
        />
        <div
          role="menu"
          className="fixed z-[10051] w-[min(13.75rem,calc(100vw-1rem))] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
          style={{ top: menu.top, left: menu.left }}
          onClick={(e) => e.stopPropagation()}
        >
          {canMoveToReceipt && (
            <button
              type="button"
              role="menuitem"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation()
                close()
                onMoveToReceipt()
              }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              <Receipt className="h-4 w-4 shrink-0 text-amber-600" />
              {t('moveToReceipt')}
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation()
              close()
              onToggleHideFromCustomers()
            }}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          >
            {hiddenByAdmin ? (
              <Eye className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <EyeOff className="h-4 w-4 shrink-0 text-slate-600" />
            )}
            {hiddenByAdmin ? t('showToCustomers') : t('hideFromCustomers')}
          </button>
        </div>
      </>,
      document.body
    )

  return (
    <div className="absolute right-1.5 top-1.5 z-30">
      <button
        type="button"
        disabled={disabled}
        aria-label={t('photoActions')}
        aria-haspopup="menu"
        aria-expanded={Boolean(menu)}
        onClick={(e) => {
          e.stopPropagation()
          openMenu(e.currentTarget)
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white shadow-sm backdrop-blur-sm transition hover:bg-black disabled:opacity-50"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {portal}
    </div>
  )
}
