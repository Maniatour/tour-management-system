'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export type StringMultiSelectOption = {
  value: string
  label: string
  /** 검색용 추가 텍스트(이메일 등) */
  searchText?: string
}

export type StringMultiSelectFilterProps = {
  id?: string
  groupLabel: string
  options: StringMultiSelectOption[]
  selected: ReadonlySet<string>
  onChange: (next: Set<string>) => void
  disabled?: boolean
  searchable?: boolean
  searchPlaceholder?: string
  allLabel?: string
  clearLabel?: string
  selectedCountLabel?: (count: number) => string
  emptySearchLabel?: string
  /** 작은 높이·라벨 — 필터 바 등 밀집 레이아웃 */
  compact?: boolean
  /** 라벨 대신 버튼 title/aria (compact + hideLabel) */
  hideLabel?: boolean
  /** 트리거·루트 래퍼 className */
  className?: string
  /** 드롭다운 패널 className (min-width 등) */
  panelClassName?: string
}

export default function StringMultiSelectFilter({
  id,
  groupLabel,
  options,
  selected,
  onChange,
  disabled = false,
  searchable = false,
  searchPlaceholder,
  allLabel,
  clearLabel,
  selectedCountLabel,
  emptySearchLabel,
  compact = false,
  hideLabel = false,
  className,
  panelClassName,
}: StringMultiSelectFilterProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const searchId = `${id ?? listId}-search`

  useEffect(() => {
    if (!open) {
      setSearch('')
      return
    }
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

  const optionByValue = useMemo(() => {
    const m = new Map<string, StringMultiSelectOption>()
    for (const o of options) m.set(o.value, o)
    return m
  }, [options])

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => {
      const hay = `${o.label} ${o.searchText ?? ''} ${o.value}`.toLowerCase()
      return hay.includes(q)
    })
  }, [options, search])

  const summary = useMemo(() => {
    if (selected.size === 0) return allLabel ?? groupLabel
    if (selected.size === 1) {
      const key = [...selected][0]!
      return optionByValue.get(key)?.label ?? key
    }
    return selectedCountLabel ? selectedCountLabel(selected.size) : `${selected.size}`
  }, [selected, optionByValue, allLabel, groupLabel, selectedCountLabel])

  const toggleValue = (value: string) => {
    const next = new Set(selected)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    onChange(next)
  }

  const selectAllVisible = () => {
    const next = new Set(selected)
    for (const o of filteredOptions) next.add(o.value)
    onChange(next)
  }

  const clearAll = () => onChange(new Set())

  const labelCls = compact
    ? 'block text-[10px] font-medium text-gray-600 mb-0 leading-tight truncate'
    : 'block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1'
  const btnCls = compact
    ? 'flex h-7 w-full items-center justify-between gap-0.5 rounded-md border border-gray-300 bg-white px-1.5 py-0 text-left text-[11px] focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500'
    : 'flex w-full items-center justify-between gap-1 rounded-lg border border-gray-300 bg-white px-2 sm:px-3 py-1.5 sm:py-2 text-left text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500'

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className ?? ''}`}>
      {hideLabel ? null : (
        <label htmlFor={id} className={labelCls} title={groupLabel}>
          {groupLabel}
        </label>
      )}
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        aria-label={hideLabel ? groupLabel : undefined}
        title={hideLabel ? groupLabel : undefined}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={btnCls}
      >
        <span className="min-w-0 truncate">{summary}</span>
        <ChevronDown
          className={`${compact ? 'h-3 w-3' : 'h-4 w-4'} shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open && !disabled ? (
        <div
          id={listId}
          role="listbox"
          aria-multiselectable="true"
          className={`absolute left-0 z-[80] mt-1 max-h-72 min-w-full w-max max-w-[min(calc(100vw-2rem),32rem)] overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg ring-1 ring-black/5 ${panelClassName ?? ''}`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-2 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{groupLabel}</span>
            <div className="flex gap-2 text-[10px] font-medium">
              <button type="button" className="text-primary hover:underline" onClick={selectAllVisible}>
                {allLabel ?? 'All'}
              </button>
              <button type="button" className="text-gray-600 hover:underline" onClick={clearAll}>
                {clearLabel ?? 'Clear'}
              </button>
            </div>
          </div>
          {searchable ? (
            <div className="border-b border-gray-100 px-2 py-1.5">
              <input
                id={searchId}
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          ) : null}
          {filteredOptions.length === 0 ? (
            <p className="px-2 py-2 text-xs text-gray-500">{emptySearchLabel ?? '—'}</p>
          ) : (
            filteredOptions.map((opt) => {
              const checked = selected.has(opt.value)
              return (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-start gap-2 px-2 py-1.5 text-xs hover:bg-gray-50 ${
                    checked ? 'bg-primary/5/80' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-gray-300"
                    checked={checked}
                    onChange={() => toggleValue(opt.value)}
                  />
                  <span className="min-w-0 flex-1 break-words leading-snug text-gray-800" title={opt.label}>
                    {opt.label}
                  </span>
                </label>
              )
            })
          )}
        </div>
      ) : null}
    </div>
  )
}
