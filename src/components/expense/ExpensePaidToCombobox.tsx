'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { DROPDOWN_Z_INDEX } from '@/lib/dialogZIndex'
import { cn } from '@/lib/utils'

type Props = {
  value: string
  onChange: (value: string) => void
  options: string[]
  disabled?: boolean
  placeholder?: string
  id?: string
  required?: boolean
  parentOpen?: boolean
  className?: string
}

export function ExpensePaidToCombobox({
  value,
  onChange,
  options,
  disabled,
  placeholder,
  id,
  required,
  parentOpen = true,
  className,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!parentOpen) setOpen(false)
  }, [parentOpen])

  useEffect(() => {
    if (!open) setQuery(value)
  }, [value, open])

  useEffect(() => {
    if (!open) return
    const onDocMouseDown = (ev: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(ev.target as Node)) {
        setOpen(false)
        onChange(query.trim())
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open, onChange, query])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return options
    return options.filter((o) => o.toLowerCase().includes(needle))
  }, [options, query])

  const showCustomHint =
    query.trim().length > 0 &&
    !options.some((o) => o.toLowerCase() === query.trim().toLowerCase())

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <Input
        id={id}
        type="text"
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={open ? query : value}
        required={required}
        onChange={(e) => {
          setQuery(e.target.value)
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => {
          setQuery(value)
          setOpen(true)
        }}
        onClick={() => {
          setQuery(value)
          setOpen(true)
        }}
      />
      {open && (filtered.length > 0 || showCustomHint) && (
        <ul
          className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg"
          style={{ zIndex: DROPDOWN_Z_INDEX }}
          role="listbox"
        >
          {filtered.map((opt) => (
            <li key={opt}>
              <button
                type="button"
                role="option"
                className="w-full px-3 py-1.5 text-left hover:bg-gray-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(opt)
                  setQuery(opt)
                  setOpen(false)
                }}
              >
                {opt}
              </button>
            </li>
          ))}
          {showCustomHint && (
            <li>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left text-blue-700 hover:bg-gray-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const next = query.trim()
                  onChange(next)
                  setQuery(next)
                  setOpen(false)
                }}
              >
                &quot;{query.trim()}&quot; 새로 입력
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
