'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ReactCountryFlag from 'react-country-flag'
import { ChevronDown, X } from 'lucide-react'
import {
  SITE_LOCALES,
  getSiteLocaleMeta,
  type SiteLocale,
} from '@/lib/siteLocales'

export type LocaleDropdownProps = {
  value: SiteLocale
  onChange: (locale: SiteLocale) => void
  className?: string
  size?: 'sm' | 'md'
  /** Show language label next to flag (page header). */
  showLabel?: boolean
  /**
   * default — bordered control
   * ghost — compact admin/nav trigger
   * header — customer site circular icon button (flag only)
   */
  variant?: 'default' | 'ghost' | 'header'
  ariaLabel?: string
  /** Show close (x) control inside the menu header. */
  showCloseButton?: boolean
  /** Hide chevron (useful for compact header icon). */
  hideChevron?: boolean
}

const MENU_MIN_WIDTH = 216
const MENU_GAP = 6
const VIEWPORT_MARGIN = 8
const ROW_HEIGHT = 40
const MENU_VERTICAL_PADDING = 8
/** Preferred height to show every locale without scrolling. */
const MENU_CONTENT_HEIGHT =
  SITE_LOCALES.length * ROW_HEIGHT + MENU_VERTICAL_PADDING

export default function LocaleDropdown({
  value,
  onChange,
  className = '',
  size = 'sm',
  showLabel = false,
  variant = 'default',
  ariaLabel = 'Language',
  showCloseButton = false,
  hideChevron = false,
}: LocaleDropdownProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [menuStyle, setMenuStyle] = useState<{
    top: number
    left: number
  } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const current = getSiteLocaleMeta(value)

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
    const preferred = MENU_CONTENT_HEIGHT + (showCloseButton ? 36 : 0)
    const openUpward = spaceBelow < preferred && spaceAbove > spaceBelow
    const height = Math.min(
      preferred,
      Math.max(120, (openUpward ? spaceAbove : spaceBelow) - MENU_GAP)
    )

    const top = openUpward
      ? Math.max(VIEWPORT_MARGIN, rect.top - MENU_GAP - height)
      : rect.bottom + MENU_GAP

    setMenuStyle({ top, left })
  }, [showCloseButton])

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
      <div
        ref={menuRef}
        className="fixed z-[10050] min-w-[13.5rem] overflow-hidden rounded-xl border border-border bg-white shadow-lg"
        style={{
          top: menuStyle.top,
          left: menuStyle.left,
        }}
      >
        {showCloseButton ? (
          <div className="flex items-center justify-end border-b border-border/60 px-2 py-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-slate-500 transition hover:bg-muted hover:text-slate-800"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        <ul role="listbox" className="py-1">
          {SITE_LOCALES.map((item) => {
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
                  <span>{item.nativeLabel}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    ) : null

  const triggerClass =
    variant === 'header'
      ? 'kv-header-icon-btn'
      : variant === 'ghost'
        ? 'inline-flex items-center gap-1 rounded-md p-1 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900'
        : `inline-flex items-center gap-1.5 rounded-lg border border-border bg-white transition hover:bg-muted ${
            size === 'sm' ? 'h-8 px-2' : 'h-9 px-2.5'
          }`

  const showChevron = !hideChevron && variant !== 'header'

  return (
    <div className={`relative inline-flex ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={triggerClass}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        title={current.label}
      >
        {variant === 'header' ? (
          <ReactCountryFlag
            countryCode={current.countryCode}
            svg
            aria-hidden
            className="kv-header-flag-icon"
          />
        ) : (
          <ReactCountryFlag
            countryCode={current.countryCode}
            svg
            style={{ width: '22px', height: '16px', borderRadius: '2px' }}
          />
        )}
        {showLabel && (
          <span className="max-w-[9rem] truncate text-sm font-medium text-slate-700">
            {current.label}
          </span>
        )}
        {showChevron ? (
          <ChevronDown
            size={14}
            className={`text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        ) : null}
      </button>

      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>
  )
}
