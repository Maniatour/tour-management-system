'use client'

import { useEffect, useRef, useState } from 'react'
import { DollarSign } from 'lucide-react'

type QuickEntranceFeePopoverProps = {
  courseName: string
  initialPrice: number | null
  x: number
  y: number
  saving?: boolean
  labels: {
    title: string
    perPerson: string
    save: string
    cancel: string
    clear: string
  }
  onSave: (price: number | null) => void
  onClose: () => void
}

export default function QuickEntranceFeePopover({
  courseName,
  initialPrice,
  x,
  y,
  saving = false,
  labels,
  onSave,
  onClose,
}: QuickEntranceFeePopoverProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(initialPrice != null ? String(initialPrice) : '')

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const parsedPrice = value.trim() === '' ? null : Number(value)
  const canSave = parsedPrice == null || (Number.isFinite(parsedPrice) && parsedPrice >= 0)

  const left = Math.min(Math.max(12, x), typeof window === 'undefined' ? x : window.innerWidth - 300)
  const top = Math.min(Math.max(12, y), typeof window === 'undefined' ? y : window.innerHeight - 220)

  return (
    <div className="fixed inset-0 z-50" onClick={onClose} onContextMenu={(event) => { event.preventDefault(); onClose() }}>
      <div
        role="dialog"
        aria-label={labels.title}
        className="absolute w-72 rounded-xl border border-border bg-white p-4 shadow-lg"
        style={{ left, top }}
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-sm font-semibold text-gray-900 truncate" title={courseName}>{courseName}</p>
        <label className="mt-3 block text-xs font-medium text-gray-600" htmlFor="quick-entrance-fee">
          {labels.perPerson}
        </label>
        <div className="mt-1.5 relative">
          <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="quick-entrance-fee"
            ref={inputRef}
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && canSave && !saving) {
                event.preventDefault()
                onSave(parsedPrice)
              }
            }}
            className="h-11 w-full rounded-lg border border-gray-300 pl-9 pr-3 text-sm focus:border-ring focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => onSave(parsedPrice)}
            disabled={!canSave || saving}
            className="h-10 flex-1 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {labels.save}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-gray-200 px-3 text-sm text-gray-700 hover:bg-gray-50"
          >
            {labels.cancel}
          </button>
        </div>
        <button
          type="button"
          onClick={() => onSave(null)}
          disabled={saving}
          className="mt-2 w-full h-9 rounded-lg text-xs text-muted-foreground hover:bg-muted/60"
        >
          {labels.clear}
        </button>
      </div>
    </div>
  )
}
