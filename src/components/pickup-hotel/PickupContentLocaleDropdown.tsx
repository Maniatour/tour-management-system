'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ReactCountryFlag from 'react-country-flag'
import { ChevronDown } from 'lucide-react'
import {
  DEFAULT_PICKUP_CONTENT_LOCALE,
  PICKUP_CONTENT_LOCALES,
  getPickupContentLocaleMeta,
  type PickupContentLocale,
} from '@/lib/pickupHotelLocales'

interface PickupContentLocaleDropdownProps {
  value: PickupContentLocale
  onChange: (locale: PickupContentLocale) => void
  className?: string
  /** Compact trigger for card header */
  size?: 'sm' | 'md'
  /** Show language label next to flag (page header). */
  showLabel?: boolean
}

const MENU_MIN_WIDTH = 216
const MENU_GAP = 6
const VIEWPORT_MARGIN = 8
const MENU_MAX_HEIGHT = 288

export default function PickupContentLocaleDropdown({
  value,
  onChange,
  className = '',
  size = 'sm',
  showLabel = false,
}: PickupContentLocaleDropdownProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [menuStyle, setMenuStyle] = useState<{
    top: number
    left: number
    maxHeight: number
  } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const current = getPickupContentLocaleMeta(value)

  useEffect(() => {
    setMounted(true)
  }, [])

  const updatePosition = useCallback(() => {
    const button = buttonRef.current
    if (!button) return

    const rect = button.getBoundingClientRect()
    const maxLeft = window.innerWidth - MENU_MIN_WIDTH - VIEWPORT_MARGIN
    const left = Math.max(VIEWPORT_MARGIN, Math.min(rect.left, maxLeft))

    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN
    const spaceAbove = rect.top - VIEWPORT_MARGIN
    const openUpward = spaceBelow < MENU_MAX_HEIGHT && spaceAbove > spaceBelow
    const available = openUpward ? spaceAbove : spaceBelow
    const maxHeight = Math.min(MENU_MAX_HEIGHT, Math.max(120, available - MENU_GAP))

    const top = openUpward
      ? Math.max(VIEWPORT_MARGIN, rect.top - MENU_GAP - maxHeight)
      : rect.bottom + MENU_GAP

    setMenuStyle({ top, left, maxHeight })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return

    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (buttonRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onReposition = () => updatePosition()

    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onReposition, true)
    window.addEventListener('resize', onReposition)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onReposition, true)
      window.removeEventListener('resize', onReposition)
    }
  }, [open, updatePosition])

  const menu =
    open && menuStyle ? (
      <ul
        ref={menuRef}
        role="listbox"
        className="fixed z-[10050] min-w-[13.5rem] overflow-y-auto rounded-xl border border-border bg-white py-1 shadow-lg"
        style={{
          top: menuStyle.top,
          left: menuStyle.left,
          maxHeight: menuStyle.maxHeight,
        }}
      >
        {PICKUP_CONTENT_LOCALES.map((item) => {
          const selected = item.code === value
          return (
            <li key={item.code} role="option" aria-selected={selected}>
              <button
                type="button"
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition hover:bg-muted ${
                  selected ? 'bg-muted/70 font-semibold text-slate-900' : 'text-slate-700'
                }`}
                onClick={() => {
                  onChange(item.code)
                  setOpen(false)
                }}
              >
                <ReactCountryFlag
                  countryCode={item.countryCode}
                  svg
                  style={{ width: '22px', height: '16px', borderRadius: '2px' }}
                />
                <span>{item.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    ) : null

  return (
    <div className={`relative inline-flex ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-border bg-white transition hover:bg-muted ${
          size === 'sm' ? 'h-8 px-2' : 'h-9 px-2.5'
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Content language"
        title={current.label}
      >
        <ReactCountryFlag
          countryCode={current.countryCode}
          svg
          style={{ width: '22px', height: '16px', borderRadius: '2px' }}
        />
        {showLabel && (
          <span className="max-w-[9rem] truncate text-sm font-medium text-slate-700">
            {current.label}
          </span>
        )}
        <ChevronDown
          size={14}
          className={`text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>
  )
}

export { DEFAULT_PICKUP_CONTENT_LOCALE }
