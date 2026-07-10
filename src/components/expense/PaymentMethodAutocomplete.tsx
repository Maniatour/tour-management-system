'use client'

import { useState, useEffect } from 'react'
import { DROPDOWN_Z_INDEX } from '@/lib/dialogZIndex'

export type PaymentMethodAutocompleteOption = {
  id: string
  name: string
  /** 연결된 직원·금융 계정 등 — 선택지·입력란에 함께 표시 */
  linkedName?: string | null
}

function formatPaymentMethodOptionLabel(option: PaymentMethodAutocompleteOption): string {
  const linked = option.linkedName?.trim()
  if (!linked) return option.name
  if (option.name.includes(linked)) return option.name
  return `${option.name} · ${linked}`
}

export function PaymentMethodAutocomplete({
  options,
  valueId,
  onChange,
  disabled,
  pleaseSelectLabel,
  className,
}: {
  options: PaymentMethodAutocompleteOption[]
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
    if (sel && !open) setQ(formatPaymentMethodOptionLabel(sel))
  }, [valueId, options, open])

  const filtered = options.filter((o) => {
    const label = formatPaymentMethodOptionLabel(o)
    const needle = q.trim().toLowerCase()
    return (
      label.toLowerCase().includes(needle) ||
      o.name.toLowerCase().includes(needle) ||
      (o.linkedName?.toLowerCase().includes(needle) ?? false)
    )
  })

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
          const exact = options.find((o) => formatPaymentMethodOptionLabel(o).toLowerCase() === q.trim().toLowerCase())
          if (exact) onChange(exact.id)
          else {
            const byName = options.find((o) => o.name.toLowerCase() === q.trim().toLowerCase())
            if (byName) onChange(byName.id)
            else onChange('')
          }
        }}
        className={
          className ??
          'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm'
        }
      />
      {open && filtered.length > 0 && (
        <ul
          className="absolute mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg"
          style={{ zIndex: DROPDOWN_Z_INDEX }}
        >
          {filtered.map((pm) => (
            <li key={pm.id}>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left hover:bg-gray-100"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(pm.id)
                  setQ(formatPaymentMethodOptionLabel(pm))
                  setOpen(false)
                }}
              >
                {formatPaymentMethodOptionLabel(pm)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
