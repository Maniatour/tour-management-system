'use client'
import { BROWSER_AUTOFILL_OFF_PROPS } from '@/lib/browserAutofill'

import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type ProductRow = {
  id: string
  name: string
  name_ko: string | null
  name_en: string | null
}

type OpTodoProductSelectProps = {
  locale: string
  value: string | undefined
  onChange: (productId: string | undefined) => void
  inputClass?: string
  /** stacked: 선택 칩 + 검색창 분리(기본), combobox: 선택값이 검색창에 표시 */
  variant?: 'stacked' | 'combobox'
  disabled?: boolean
  /** 목록 로드 전·비활성 상품 등 표시용 라벨 */
  selectedLabel?: string
}

function productLabel(p: ProductRow, locale: string): string {
  if (locale === 'en' && p.name_en) return p.name_en
  return p.name_ko || p.name || p.id
}

export function OpTodoProductSelect({
  locale,
  value,
  onChange,
  inputClass = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm',
  variant = 'stacked',
  disabled = false,
  selectedLabel: selectedLabelProp,
}: OpTodoProductSelectProps) {
  const isKo = locale === 'ko'
  const [products, setProducts] = useState<ProductRow[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('products')
        .select('id, name, name_ko, name_en')
        .eq('status', 'active')
        .order('name_ko', { ascending: true })
        .limit(500)
      if (!cancelled) {
        if (!error) setProducts((data || []) as ProductRow[])
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const selected = useMemo(() => products.find((p) => p.id === value), [products, value])
  const selectedLabel = selected
    ? productLabel(selected, locale)
    : selectedLabelProp?.trim() || ''

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products.slice(0, 40)
    return products
      .filter((p) => {
        const label = productLabel(p, locale).toLowerCase()
        return label.includes(q) || p.id.toLowerCase().includes(q)
      })
      .slice(0, 40)
  }, [products, query, locale])

  const inputValue =
    variant === 'combobox'
      ? isFocused || query.length > 0
        ? query
        : selectedLabel
      : query

  const showDropdown =
    open &&
    !disabled &&
    (variant === 'combobox'
      ? isFocused
      : query.length > 0 || !selected)

  if (variant === 'combobox') {
    return (
      <div className="relative">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input {...BROWSER_AUTOFILL_OFF_PROPS} type="search"
            value={inputValue}
            disabled={disabled}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => {
              setIsFocused(true)
              setOpen(true)
              if (selectedLabel && !query) {
                setQuery(selectedLabel)
              }
            }}
            onBlur={() => {
              window.setTimeout(() => {
                setIsFocused(false)
                setQuery('')
                setOpen(false)
              }, 150)
            }}
            placeholder={isKo ? '상품 검색…' : 'Search product…'}
            className={`${inputClass} pl-8 pr-8`}
          />
          {selected && !disabled ? (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(undefined)
                setQuery('')
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground px-1"
              aria-label={isKo ? '상품 분류 해제' : 'Clear product'}
            >
              ×
            </button>
          ) : null}
        </div>

        {showDropdown ? (
          <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-gray-200 bg-white text-sm shadow-lg">
            {loading ? (
              <li className="px-3 py-2 text-xs text-gray-500">{isKo ? '로딩...' : 'Loading...'}</li>
            ) : filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-gray-500">
                {isKo ? '검색 결과 없음' : 'No results'}
              </li>
            ) : (
              filtered.map((p) => {
                const label = productLabel(p, locale)
                const isSelected = p.id === value
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={`w-full px-3 py-2 text-left hover:bg-gray-50 ${
                        isSelected ? 'bg-primary/5 font-medium' : ''
                      }`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        if (p.id !== value) onChange(p.id)
                        setQuery('')
                        setOpen(false)
                        setIsFocused(false)
                      }}
                    >
                      {label}
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        ) : null}
      </div>
    )
  }

  return (
    <div className="relative mt-1">
      {selected ? (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-sm">
          <span className="truncate text-gray-900">{productLabel(selected, locale)}</span>
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="shrink-0 text-xs text-gray-500 hover:text-gray-800"
          >
            {isKo ? '해제' : 'Clear'}
          </button>
        </div>
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        <input {...BROWSER_AUTOFILL_OFF_PROPS} type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          placeholder={isKo ? '상품명 검색...' : 'Search product...'}
          className={`${inputClass} pl-8`}
        />
      </div>

      {open && (query.length > 0 || !selected) ? (
        <ul className="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded-md border border-gray-200 bg-white text-sm shadow-lg">
          {loading ? (
            <li className="px-3 py-2 text-xs text-gray-500">{isKo ? '로딩...' : 'Loading...'}</li>
          ) : filtered.length === 0 ? (
            <li className="px-3 py-2 text-xs text-gray-500">
              {isKo ? '검색 결과 없음' : 'No results'}
            </li>
          ) : (
            filtered.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-gray-50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(p.id)
                    setQuery('')
                    setOpen(false)
                  }}
                >
                  {productLabel(p, locale)}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
