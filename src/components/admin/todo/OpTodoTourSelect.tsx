'use client'
import { BROWSER_AUTOFILL_OFF_PROPS } from '@/lib/browserAutofill'

import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { supabase } from '@/lib/supabase'
import { tourDateFromOffset } from '@/lib/opTodoAction'

dayjs.extend(utc)
dayjs.extend(timezone)

type TourRow = {
  id: string
  tour_date: string
  tour_time: string | null
  product_id: string | null
  products: { name_ko: string | null; name: string | null } | null
}

type OpTodoTourSelectProps = {
  locale: string
  value: string | undefined
  productId?: string
  tourDateOffsetDays?: number
  onChange: (tourId: string | undefined) => void
  inputClass?: string
}

function tourLabel(t: TourRow, locale: string): string {
  const product =
    locale === 'ko'
      ? t.products?.name_ko || t.products?.name
      : t.products?.name || t.products?.name_ko
  const time = t.tour_time ? ` ${t.tour_time.slice(0, 5)}` : ''
  return `${product || 'Tour'} · ${t.tour_date}${time}`
}

export function OpTodoTourSelect({
  locale,
  value,
  productId,
  tourDateOffsetDays,
  onChange,
  inputClass = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm',
}: OpTodoTourSelectProps) {
  const isKo = locale === 'ko'
  const targetDate =
    tourDateFromOffset(tourDateOffsetDays ?? 0) ?? dayjs().tz('America/Los_Angeles').format('YYYY-MM-DD')

  const [tours, setTours] = useState<TourRow[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      let q = supabase
        .from('tours')
        .select('id, tour_date, tour_time, product_id, products(name_ko, name)')
        .eq('tour_date', targetDate)
        .order('tour_time', { ascending: true })
        .limit(100)

      if (productId) {
        q = q.eq('product_id', productId)
      }

      const { data, error } = await q
      if (!cancelled) {
        if (!error) setTours((data || []) as unknown as TourRow[])
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [targetDate, productId])

  const selected = useMemo(() => tours.find((t) => t.id === value), [tours, value])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tours
    return tours.filter((t) => tourLabel(t, locale).toLowerCase().includes(q) || t.id.includes(q))
  }, [tours, query, locale])

  return (
    <div className="relative mt-1 space-y-1">
      <p className="text-xs text-gray-500">
        {isKo ? `투어일: ${targetDate}` : `Tour date: ${targetDate}`}
        {productId ? (isKo ? ' · 상품 필터 적용' : ' · product filter') : ''}
      </p>

      {selected ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-sm">
          <span className="truncate text-gray-900">{tourLabel(selected, locale)}</span>
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
          placeholder={isKo ? '투어 검색...' : 'Search tour...'}
          className={`${inputClass} pl-8`}
        />
      </div>

      {open ? (
        <ul className="max-h-40 overflow-y-auto rounded-md border border-gray-200 bg-white text-sm shadow-sm">
          {loading ? (
            <li className="px-3 py-2 text-xs text-gray-500">{isKo ? '로딩...' : 'Loading...'}</li>
          ) : filtered.length === 0 ? (
            <li className="px-3 py-2 text-xs text-gray-500">
              {isKo ? '해당 날짜 투어 없음' : 'No tours on this date'}
            </li>
          ) : (
            filtered.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-gray-50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(t.id)
                    setQuery('')
                    setOpen(false)
                  }}
                >
                  {tourLabel(t, locale)}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
