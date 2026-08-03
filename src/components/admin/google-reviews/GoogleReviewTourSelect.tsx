'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Loader2, Search } from 'lucide-react'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import { toLasVegasDateKey } from '@/lib/dailyReport/dateUtils'
import { addDaysToYmd } from '@/utils/tourUtils'

type TourOption = {
  id: string
  tourDate: string
  productId: string | null
  productName: string | null
  guideName: string | null
  assistantName: string | null
  totalPeople?: number
  customerNames?: string[]
}

type Props = {
  locale: string
  reviewDate: string | null
  productId: string | null
  value: string | null
  selectedLabel?: string
  disabled?: boolean
  onChange: (tourId: string | null, tourProduct?: Pick<TourOption, 'productId' | 'productName'> | null) => void
}

function formatTeamNames(tour: TourOption): string {
  const parts: string[] = []
  if (tour.guideName) parts.push(tour.guideName)
  if (tour.assistantName) parts.push(tour.assistantName)
  return parts.join(' · ')
}

/** 근처 투어 드롭다운 — 날짜·상품·총인원·가이드·드라이버 이름 */
function formatTourTitle(tour: TourOption, isKo: boolean): string {
  const team = formatTeamNames(tour)
  const peopleLabel =
    tour.totalPeople != null && tour.totalPeople > 0
      ? isKo
        ? `${tour.totalPeople}명`
        : `${tour.totalPeople} pax`
      : null
  const meta = [peopleLabel, team].filter(Boolean).join(' · ')
  return `${tour.tourDate} · ${tour.productName ?? (isKo ? '투어' : 'Tour')}${meta ? ` (${meta})` : ''}`
}

export default function GoogleReviewTourSelect({
  locale,
  reviewDate,
  productId,
  value,
  selectedLabel,
  disabled = false,
  onChange,
}: Props) {
  const isKo = locale === 'ko'
  const [nearbyTours, setNearbyTours] = useState<TourOption[]>([])
  const [searchTours, setSearchTours] = useState<TourOption[]>([])
  const [loadingNearby, setLoadingNearby] = useState(false)
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [tourDate, setTourDate] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [query, setQuery] = useState('')
  const selectedTourIdRef = useRef(value)
  selectedTourIdRef.current = value

  const reviewDateKey = useMemo(() => toLasVegasDateKey(reviewDate), [reviewDate])

  useEffect(() => {
    if (reviewDateKey) {
      setTourDate(reviewDateKey)
    }
  }, [reviewDateKey])

  const shiftTourDate = useCallback(
    (delta: number) => {
      setTourDate((current) => {
        const base = current || reviewDateKey
        if (!base) return current
        const next = addDaysToYmd(base, delta)
        return next || current
      })
    },
    [reviewDateKey]
  )

  const loadNearby = useCallback(
    async (options?: { background?: boolean }) => {
      if (!options?.background) setLoadingNearby(true)
      try {
        const params = new URLSearchParams({ mode: 'nearby', day_range: '3', limit: '100' })
        if (reviewDateKey) params.set('review_date', reviewDateKey)
        if (selectedTourIdRef.current) {
          params.set('include_tour_id', selectedTourIdRef.current)
        }

        const res = await fetchApiWithAuth(
          `/api/admin/google-business/reviews/tours-search?${params.toString()}`
        )
        const data = (await res.json()) as { ok?: boolean; tours?: TourOption[] }
        if (res.ok && data.ok) {
          setNearbyTours(data.tours ?? [])
        }
      } finally {
        setLoadingNearby(false)
      }
    },
    [reviewDateKey]
  )

  useEffect(() => {
    void loadNearby()
  }, [loadNearby])

  useEffect(() => {
    if (!showAdvanced) return

    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoadingSearch(true)
        try {
          const params = new URLSearchParams({ mode: 'search' })
          const trimmedCustomerName = customerName.trim()
          if (tourDate && !trimmedCustomerName) params.set('tour_date', tourDate)
          if (productId) params.set('product_id', productId)
          if (trimmedCustomerName) params.set('customer_name', trimmedCustomerName)
          if (query.trim()) params.set('q', query.trim())

          const res = await fetchApiWithAuth(
            `/api/admin/google-business/reviews/tours-search?${params.toString()}`
          )
          const data = (await res.json()) as { ok?: boolean; tours?: TourOption[] }
          if (!cancelled && res.ok && data.ok) {
            setSearchTours(data.tours ?? [])
          }
        } finally {
          if (!cancelled) setLoadingSearch(false)
        }
      })()
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [showAdvanced, tourDate, customerName, query, productId])

  const selectedFromList =
    nearbyTours.find((tour) => tour.id === value) ??
    searchTours.find((tour) => tour.id === value) ??
    null

  const displayValue = value ?? ''

  return (
    <div className="space-y-2">
      <div className="relative">
        <select
          value={displayValue}
          disabled={disabled || loadingNearby}
          onChange={(e) => {
            const next = e.target.value || null
            if (next !== value) {
              const tour =
                nearbyTours.find((item) => item.id === next) ??
                searchTours.find((item) => item.id === next) ??
                null
              onChange(
                next,
                tour?.productId
                  ? { productId: tour.productId, productName: tour.productName }
                  : null
              )
            }
          }}
          className="w-full h-10 appearance-none rounded-lg border border-border bg-background px-3 pr-9 text-sm truncate disabled:opacity-50"
          aria-label={isKo ? '투어 선택' : 'Select tour'}
        >
          <option value="">
            {loadingNearby
              ? isKo
                ? '투어 불러오는 중…'
                : 'Loading tours…'
              : nearbyTours.length === 0
                ? isKo
                  ? '근처 투어 없음 — 더보기로 검색'
                  : 'No nearby tours — use More to search'
                : isKo
                  ? '투어 선택…'
                  : 'Select tour…'}
          </option>
          {value && !nearbyTours.some((tour) => tour.id === value) ? (
            <option value={value}>
              {selectedFromList
                ? formatTourTitle(selectedFromList, isKo)
                : selectedLabel || value}
            </option>
          ) : null}
          {nearbyTours.map((tour) => (
            <option key={tour.id} value={tour.id}>
              {formatTourTitle(tour, isKo)}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => setShowAdvanced((open) => !open)}
        className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
      >
        {showAdvanced ? (isKo ? '검색 닫기' : 'Close search') : isKo ? '더보기 · 날짜·고객명 검색' : 'More · search by date or guest'}
      </button>

      {showAdvanced ? (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                {isKo ? '투어 날짜' : 'Tour date'}
              </span>
              <div className="relative">
                <input
                  type="date"
                  value={tourDate}
                  onChange={(e) => setTourDate(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-background pl-3 pr-9 text-sm [color-scheme:light] dark:[color-scheme:dark]"
                />
                <div className="absolute inset-y-0 right-0 flex w-8 flex-col items-center justify-center border-l border-border/60">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => shiftTourDate(1)}
                    className="flex h-1/2 w-full items-center justify-center text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-40"
                    aria-label={isKo ? '하루 뒤' : 'Next day'}
                  >
                    <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => shiftTourDate(-1)}
                    className="flex h-1/2 w-full items-center justify-center text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-40"
                    aria-label={isKo ? '하루 전' : 'Previous day'}
                  >
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </div>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                {isKo ? '고객명' : 'Guest name'}
              </span>
              <input
                type="search"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={isKo ? '예약 고객명' : 'Reservation guest name'}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              />
            </label>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isKo ? '상품·가이드 검색 (선택)' : 'Product or guide (optional)'}
              className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"
            />
          </div>

          <ul className="max-h-44 overflow-y-auto rounded-lg border border-border bg-background shadow-sm">
            {loadingSearch ? (
              <li className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {isKo ? '검색 중…' : 'Searching…'}
              </li>
            ) : searchTours.length === 0 ? (
              <li className="px-3 py-3 text-sm text-muted-foreground">
                {tourDate || customerName.trim() || query.trim()
                  ? isKo
                    ? '해당 조건의 투어가 없습니다.'
                    : 'No tours match your search.'
                  : isKo
                    ? '날짜 또는 고객명을 입력해 검색하세요.'
                    : 'Enter a date or guest name to search.'}
              </li>
            ) : (
              searchTours.map((tour) => (
                <li key={tour.id}>
                  <button
                    type="button"
                    className={`w-full px-3 py-2 text-left hover:bg-muted/50 ${
                      tour.id === value ? 'bg-primary/5' : ''
                    }`}
                    onClick={() => {
                      onChange(tour.id, {
                        productId: tour.productId,
                        productName: tour.productName,
                      })
                      void loadNearby({ background: true })
                    }}
                  >
                    <span
                      className={`block text-sm leading-snug ${
                        tour.id === value ? 'font-medium text-foreground' : 'text-foreground'
                      }`}
                    >
                      {formatTourTitle(tour, isKo)}
                    </span>
                    {tour.customerNames && tour.customerNames.length > 0 ? (
                      <span className="block text-xs text-muted-foreground mt-0.5 leading-snug">
                        {isKo ? '예약자: ' : 'Guests: '}
                        {tour.customerNames.join(', ')}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
