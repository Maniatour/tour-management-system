'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { DROPDOWN_Z_INDEX } from '@/lib/dialogZIndex'
import { cn } from '@/lib/utils'

export type SearchableTextOption = {
  /** React list key — value·label이 겹칠 때 사용 */
  id?: string
  value: string
  label: string
  hint?: string
}

type Props = {
  value: string
  onChange: (value: string) => void
  options: SearchableTextOption[]
  disabled?: boolean
  placeholder?: string
  id?: string
  required?: boolean
  parentOpen?: boolean
  className?: string
  allowCustom?: boolean
  customHintLabel?: (query: string) => string
}

export function SearchableTextSelect({
  value,
  onChange,
  options,
  disabled,
  placeholder,
  id,
  required,
  parentOpen = true,
  className,
  allowCustom = true,
  customHintLabel,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  const selectedLabel = useMemo(() => {
    const match = options.find((o) => o.value === value)
    return match?.label ?? value
  }, [options, value])

  useEffect(() => {
    if (!parentOpen) setOpen(false)
  }, [parentOpen])

  useEffect(() => {
    if (!open) setQuery(selectedLabel)
  }, [selectedLabel, open])

  useEffect(() => {
    if (!open) return
    const onDocMouseDown = (ev: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(ev.target as Node)) {
        setOpen(false)
        if (allowCustom) onChange(query.trim())
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open, onChange, query, allowCustom])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return options
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(needle) ||
        o.value.toLowerCase().includes(needle) ||
        (o.hint?.toLowerCase().includes(needle) ?? false)
    )
  }, [options, query])

  const showCustomHint =
    allowCustom &&
    query.trim().length > 0 &&
    !options.some((o) => o.value.toLowerCase() === query.trim().toLowerCase())

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <input
        id={id}
        type="text"
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={open ? query : selectedLabel}
        required={required}
        onChange={(e) => {
          setQuery(e.target.value)
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => {
          setQuery(selectedLabel)
          setOpen(true)
        }}
        onClick={() => {
          setQuery(selectedLabel)
          setOpen(true)
        }}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-sm"
      />
      {open && (filtered.length > 0 || showCustomHint) && (
        <ul
          className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg"
          style={{ zIndex: DROPDOWN_Z_INDEX }}
          role="listbox"
        >
          {filtered.map((opt, index) => (
            <li key={opt.id ?? `${opt.value}::${opt.label}::${index}`}>
              <button
                type="button"
                role="option"
                className="w-full px-3 py-1.5 text-left hover:bg-gray-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(opt.value)
                  setQuery(opt.label)
                  setOpen(false)
                }}
              >
                <span>{opt.label}</span>
                {opt.hint ? (
                  <span className="ml-1 text-xs text-gray-500">{opt.hint}</span>
                ) : null}
              </button>
            </li>
          ))}
          {showCustomHint ? (
            <li>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left text-primary hover:bg-gray-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const next = query.trim()
                  onChange(next)
                  setQuery(next)
                  setOpen(false)
                }}
              >
                {customHintLabel
                  ? customHintLabel(query.trim())
                  : `"${query.trim()}" 사용`}
              </button>
            </li>
          ) : null}
        </ul>
      )}
    </div>
  )
}
