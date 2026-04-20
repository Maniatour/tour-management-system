'use client'

import React, { useState, useEffect } from 'react'

export function PaymentMethodAutocomplete({
  options,
  valueId,
  onChange,
  disabled,
  pleaseSelectLabel,
  className,
}: {
  options: { id: string; name: string }[]
  valueId: string
  onChange: (id: string) => void
  disabled?: boolean
  pleaseSelectLabel: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!valueId) {
      if (!open) setQ('')
      return
    }
    const sel = options.find((o) => o.id === valueId)
    if (sel && !open) setQ(sel.name)
  }, [valueId, options, open])

  const filtered = options.filter((o) => o.name.toLowerCase().includes(q.trim().toLowerCase()))

  return (
    <div className="relative">
      <input
        type="text"
        autoComplete="off"
        disabled={disabled}
        placeholder={pleaseSelectLabel}
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setTimeout(() => setOpen(false), 120)
          const exact = options.find((o) => o.name.toLowerCase() === q.trim().toLowerCase())
          if (exact) onChange(exact.id)
          else onChange('')
        }}
        className={
          className ??
          'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm'
        }
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg">
          {filtered.map((pm) => (
            <li key={pm.id}>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left hover:bg-gray-100"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(pm.id)
                  setQ(pm.name)
                  setOpen(false)
                }}
              >
                {pm.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
