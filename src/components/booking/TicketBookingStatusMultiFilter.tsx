'use client'

import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  TICKET_BOOKING_STATUS_FILTER_VENDOR_PENDING,
  type TicketBookingStatusFilterKey,
} from '@/lib/ticketBookingStatusFilter'
import {
  TICKET_BOOKING_STATUS_VALUES,
  formatTicketBookingStatusLabel,
  getTicketBookingStatusBadgeClass,
} from '@/lib/ticketBookingStatus'

export type TicketBookingStatusMultiFilterProps = {
  locale: string
  t: (key: string) => string
  selected: ReadonlySet<TicketBookingStatusFilterKey>
  onChange: (next: Set<TicketBookingStatusFilterKey>) => void
  disabled?: boolean
  disabledTitle?: string
}

type FilterOption = {
  key: TicketBookingStatusFilterKey
  label: string
  badgeClass: string
}

export default function TicketBookingStatusMultiFilter({
  locale,
  t,
  selected,
  onChange,
  disabled = false,
  disabledTitle,
}: TicketBookingStatusMultiFilterProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const isKo = locale.startsWith('ko')

  const options = useMemo((): FilterOption[] => {
    const vendorPending: FilterOption = {
      key: TICKET_BOOKING_STATUS_FILTER_VENDOR_PENDING,
      label: isKo ? '벤더 응답 대기 (요청 중)' : 'Vendor pending (requests)',
      badgeClass: 'bg-red-100 text-red-800',
    }
    const statusOpts: FilterOption[] = TICKET_BOOKING_STATUS_VALUES.map((sv) => ({
      key: sv,
      label: formatTicketBookingStatusLabel(sv, t, locale),
      badgeClass: getTicketBookingStatusBadgeClass(sv),
    }))
    return [vendorPending, ...statusOpts]
  }, [isKo, t, locale])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const summary = useMemo(() => {
    if (selected.size === 0) {
      return isKo ? '전체' : 'All'
    }
    if (selected.size === 1) {
      const key = [...selected][0]!
      const opt = options.find((o) => o.key === key)
      return opt?.label ?? key
    }
    return isKo ? `${selected.size}개 선택` : `${selected.size} selected`
  }, [selected, options, isKo])

  const toggleKey = (key: TicketBookingStatusFilterKey) => {
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onChange(next)
  }

  const selectAll = () => {
    onChange(new Set(options.map((o) => o.key)))
  }

  const clearAll = () => {
    onChange(new Set())
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        disabled={disabled}
        title={disabled ? disabledTitle : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        onClick={() => !disabled && setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-left text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
      >
        <span className="min-w-0 truncate">{summary}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open && !disabled ? (
        <div
          id={listId}
          role="listbox"
          aria-multiselectable="true"
          className="absolute left-0 right-0 z-[80] mt-1 max-h-72 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg ring-1 ring-black/5"
        >
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-2 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              {isKo ? '상태 (다중)' : 'Status (multi)'}
            </span>
            <div className="flex gap-2 text-[10px] font-medium">
              <button
                type="button"
                className="text-blue-600 hover:underline"
                onClick={selectAll}
              >
                {isKo ? '전체' : 'All'}
              </button>
              <button
                type="button"
                className="text-gray-600 hover:underline"
                onClick={clearAll}
              >
                {isKo ? '해제' : 'Clear'}
              </button>
            </div>
          </div>
          {options.map((opt) => {
            const checked = selected.has(opt.key)
            return (
              <label
                key={opt.key}
                className={`flex cursor-pointer items-center gap-2 px-2 py-1.5 text-xs hover:bg-gray-50 ${
                  checked ? 'bg-blue-50/80' : ''
                }`}
              >
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 shrink-0 rounded border-gray-300"
                  checked={checked}
                  onChange={() => toggleKey(opt.key)}
                />
                <span
                  className={`inline-flex min-w-0 flex-1 truncate rounded-full px-2 py-0.5 text-[11px] font-medium ${opt.badgeClass}`}
                >
                  {opt.label}
                </span>
              </label>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
