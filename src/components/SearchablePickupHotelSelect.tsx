'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { PickupHotel } from '@/utils/pickupHotelUtils'

export function SearchablePickupHotelSelect({
  hotels,
  value,
  onChange,
  placeholder,
  noResultsLabel,
  clearTitle,
  disabled = false,
  className = '',
}: {
  hotels: PickupHotel[]
  value: string | null
  onChange: (id: string | null) => void
  placeholder: string
  noResultsLabel: string
  clearTitle: string
  disabled?: boolean
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const selectedHotel = useMemo(
    () => hotels.find((h) => h.id === value) ?? null,
    [hotels, value]
  )

  const filteredHotels = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return hotels
    return hotels.filter(
      (h) =>
        h.hotel.toLowerCase().includes(q) ||
        (h.pick_up_location || '').toLowerCase().includes(q) ||
        (h.address || '').toLowerCase().includes(q)
    )
  }, [hotels, search])

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div ref={containerRef} className={`relative min-w-0 ${className}`}>
      <div className="relative">
        <Search
          size={14}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
        <input
          type="text"
          value={open ? search : selectedHotel?.hotel ?? ''}
          onChange={(e) => {
            setSearch(e.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            if (disabled) return
            setSearch(selectedHotel?.hotel ?? '')
            setOpen(true)
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full pl-7 pr-8 py-1 border rounded-md text-xs disabled:opacity-50 disabled:bg-gray-50"
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={() => {
              onChange(null)
              setSearch('')
              setOpen(false)
            }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 rounded"
            title={clearTitle}
          >
            <X size={14} />
          </button>
        )}
      </div>
      {open && !disabled && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-52 overflow-y-auto">
          {filteredHotels.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500 text-center">{noResultsLabel}</p>
          ) : (
            filteredHotels.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => {
                  onChange(h.id)
                  setSearch('')
                  setOpen(false)
                }}
                className={`w-full text-left px-3 py-2 hover:bg-muted/50 border-b border-gray-100 last:border-b-0 ${
                  value === h.id ? 'bg-primary/5/80' : ''
                }`}
              >
                <div className="text-sm font-medium text-gray-900 truncate">{h.hotel}</div>
                {(h.pick_up_location || h.address) && (
                  <div className="text-xs text-gray-500 truncate">
                    {[h.pick_up_location, h.address].filter(Boolean).join(' · ')}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
