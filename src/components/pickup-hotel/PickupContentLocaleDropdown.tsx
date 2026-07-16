'use client'

import { useEffect, useRef, useState } from 'react'
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

export default function PickupContentLocaleDropdown({
  value,
  onChange,
  className = '',
  size = 'sm',
  showLabel = false,
}: PickupContentLocaleDropdownProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const current = getPickupContentLocaleMeta(value)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className={`relative inline-flex ${className}`}>
      <button
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

      {open && (
        <ul
          role="listbox"
          className="absolute left-0 top-[calc(100%+0.35rem)] z-50 max-h-72 min-w-[13.5rem] overflow-y-auto rounded-xl border border-border bg-white py-1 shadow-lg"
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
      )}
    </div>
  )
}

export { DEFAULT_PICKUP_CONTENT_LOCALE }
