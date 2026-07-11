'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Loader2, Search, X } from 'lucide-react'

export type CustomerPageProductOption = {
  id: string
  label: string
  sublabel?: string | null
}

type CustomerPageProductSearchSelectProps = {
  value: string | null
  options: CustomerPageProductOption[]
  loading?: boolean
  placeholder?: string
  emptyLabel?: string
  onChange: (productId: string | null) => void
  onSearch?: (term: string) => void
  searching?: boolean
}

export default function CustomerPageProductSearchSelect({
  value,
  options,
  loading = false,
  placeholder = '상품 검색…',
  emptyLabel = '상품을 선택하세요',
  onChange,
  onSearch,
  searching = false,
}: CustomerPageProductSearchSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.id === value) ?? null

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return options.slice(0, 40)
    return options
      .filter(
        (o) =>
          o.label.toLowerCase().includes(term) ||
          o.sublabel?.toLowerCase().includes(term) ||
          o.id.toLowerCase().includes(term)
      )
      .slice(0, 40)
  }, [options, query])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  useEffect(() => {
    if (!onSearch) return
    const timer = window.setTimeout(() => onSearch(query), 250)
    return () => window.clearTimeout(timer)
  }, [query, onSearch])

  return (
    <div ref={rootRef} className="relative min-w-[220px] max-w-full flex-1 sm:flex-none sm:min-w-[280px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={loading}
        className="flex w-full items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-left text-xs shadow-sm hover:border-amber-300 disabled:opacity-60"
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-amber-700" />
        <span className={`flex-1 truncate ${selected ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
          {selected?.label ?? emptyLabel}
        </span>
        {selected && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              onChange(null)
              setQuery('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                onChange(null)
                setQuery('')
              }
            }}
            className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="선택 해제"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        )}
        {loading || searching ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        )}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="border-b border-gray-100 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-lg border border-border py-2 pl-8 pr-3 text-xs focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                autoFocus
              />
            </div>
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-gray-500">검색 결과가 없습니다.</li>
            ) : (
              filtered.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(option.id)
                      setOpen(false)
                      setQuery('')
                    }}
                    className={`flex w-full flex-col items-start px-3 py-2 text-left text-xs hover:bg-muted/50 ${
                      value === option.id ? 'bg-primary/5 text-foreground' : 'text-gray-800'
                    }`}
                  >
                    <span className="font-medium truncate w-full">{option.label}</span>
                    {option.sublabel && (
                      <span className="text-[10px] text-gray-500 truncate w-full">{option.sublabel}</span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
