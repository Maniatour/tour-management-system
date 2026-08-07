'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DollarSign,
  ExternalLink,
  Globe,
  Loader2,
  Pencil,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { TodoPanelStatusButtons } from '@/components/admin/todo/TodoPanelStatusButtons'
import { TodoPanelTourStatusButtons } from '@/components/admin/todo/TodoPanelTourStatusButtons'
import { TourHotelPriceCheckEditModal } from '@/components/admin/todo/TourHotelPriceCheckEditModal'
import {
  findTourHotelPriceCheckLinkedTodo,
  getTourHotelPriceCheckUnitPrice,
  isTourHotelPriceCheckHighUnitPrice,
  normalizeTourHotelWebsiteUrl,
  readTourHotelPriceCheckLocalCompleted,
  tourHotelPriceCheckCompletionDateKey,
  tourHotelPriceCheckPanelTitle,
  writeTourHotelPriceCheckLocalCompleted,
  type TourHotelPriceCheckLinkedTodo,
} from '@/lib/tourHotelPriceCheckTodo'
import {
  countTodoPanelTourProgress,
  getTodoPanelTourStatus,
  todoPanelTourRowClassName,
  todoPanelTourTitleClassName,
} from '@/lib/todoPanelTourCompletion'
import { useTodoPanelTourCompletion } from '@/hooks/useTodoPanelTourCompletion'
import { useTourHotelPriceCheckQueue } from '@/hooks/useTourHotelPriceCheckQueue'
import { supabase } from '@/lib/supabase'
import type { TourPriceCheckResult } from '@/lib/hotels/tour-price-check-types'

type TourHotelPriceCheckPanelProps = {
  locale: string
  variant?: 'panel' | 'list'
  className?: string
  linkedTodos?: Array<TourHotelPriceCheckLinkedTodo & { title?: string | null }>
  onToggleLinkedTodo?: (todo: TourHotelPriceCheckLinkedTodo, completed: boolean) => Promise<void>
  onCompletedChange?: (completed: boolean) => void
  onEditRequest?: () => void
  onOpenTourDetail?: (tourId: string) => void
  onHold?: boolean
  holdEnabled?: boolean
  onToggleHold?: () => void
  holdBusy?: boolean
  holdDisabledHint?: string
  queryEnabled?: boolean
}

const EMPTY_LINKED_TODOS: Array<TourHotelPriceCheckLinkedTodo & { title?: string | null }> = []

function formatShortDate(raw: string): string {
  if (!raw) return '—'
  const parts = raw.split('-')
  if (parts.length !== 3) return raw
  const month = Number(parts[1])
  const day = Number(parts[2])
  if (!month || !day) return raw
  return `${month}/${day}`
}

function formatUsd(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return '—'
  return `$${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function formatDiffBadge(diff: number | null | undefined, isKo: boolean): {
  label: string
  className: string
} {
  if (diff == null || !Number.isFinite(diff)) {
    return {
      label: isKo ? '미조회' : 'No fetch',
      className: 'bg-gray-100 text-gray-600',
    }
  }
  const rounded = Math.round(diff)
  if (rounded === 0) {
    return {
      label: '$0',
      className: 'bg-slate-100 text-slate-700',
    }
  }
  if (rounded > 0) {
    return {
      label: `+$${rounded}`,
      className: 'bg-orange-50 text-orange-700',
    }
  }
  return {
    label: `−$${Math.abs(rounded)}`,
    className: 'bg-blue-50 text-blue-700',
  }
}

function tourHotelPriceCheckRowBorderClassName(
  rowStatus: ReturnType<typeof getTodoPanelTourStatus>,
  highPrice: boolean
): string {
  if (highPrice) {
    return 'border-red-300 bg-red-50/40 shadow-[inset_0_0_0_1px] shadow-red-200/50'
  }
  if (rowStatus === 'pending') {
    return 'border-sky-200/80 bg-white/80 shadow-[inset_0_0_0_1px] shadow-sky-300/40'
  }
  return todoPanelTourRowClassName(rowStatus)
}

async function authHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  }
  return headers
}

export function TourHotelPriceCheckPanel({
  locale,
  variant = 'list',
  className = '',
  linkedTodos = EMPTY_LINKED_TODOS,
  onToggleLinkedTodo,
  onCompletedChange,
  onEditRequest,
  onOpenTourDetail,
  onHold = false,
  holdEnabled = false,
  onToggleHold,
  holdBusy = false,
  holdDisabledHint,
  queryEnabled = true,
}: TourHotelPriceCheckPanelProps) {
  const isKo = locale === 'ko'
  const isList = variant === 'list'
  const completionDateKey = useMemo(() => tourHotelPriceCheckCompletionDateKey(), [])
  const { rows, loading, error, reload, dateRange } = useTourHotelPriceCheckQueue(queryEnabled)
  const { tourState, setTourStatus } = useTodoPanelTourCompletion(
    'tour-hotel-price-check',
    completionDateKey
  )
  const linkedTodo = findTourHotelPriceCheckLinkedTodo(linkedTodos)

  const [localCompleted, setLocalCompleted] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [editBookingId, setEditBookingId] = useState<string | null>(null)
  const [batchBusy, setBatchBusy] = useState(false)
  const [fetchByBookingId, setFetchByBookingId] = useState<
    Record<string, TourPriceCheckResult>
  >({})

  useEffect(() => {
    setLocalCompleted(readTourHotelPriceCheckLocalCompleted(completionDateKey))
  }, [completionDateKey])

  const completed = linkedTodo?.completed ?? localCompleted

  const displayRows = rows

  const progress = useMemo(
    () => countTodoPanelTourProgress(rows.map((r) => r.id), tourState),
    [rows, tourState]
  )

  const progressLabel =
    progress.onHold > 0
      ? isKo
        ? `확인 ${progress.done}/${progress.total} · 보류 ${progress.onHold}`
        : `Checked ${progress.done}/${progress.total} · hold ${progress.onHold}`
      : isKo
        ? `확인 ${progress.done}/${progress.total}`
        : `Checked ${progress.done}/${progress.total}`

  const dateRangeLabel = useMemo(() => {
    const fmt = (d: string) => {
      const parts = d.split('-')
      if (parts.length !== 3) return d
      return `${Number(parts[1])}/${Number(parts[2])}`
    }
    return `${fmt(dateRange.start)} – ${fmt(dateRange.end)}`
  }, [dateRange])

  const uniqueScrapeEstimate = useMemo(() => {
    const keys = new Set<string>()
    for (const row of rows) {
      const destHint = /^p-/i.test(row.hotel)
        ? 'page'
        : /^k-/i.test(row.hotel)
          ? 'kanab'
          : row.city || row.hotel
      keys.add(`${destHint}|${row.check_in_date}|${row.check_out_date}`)
    }
    return keys.size
  }, [rows])

  const handleToggleComplete = useCallback(async () => {
    const next = !completed
    setCompleting(true)
    try {
      if (linkedTodo && onToggleLinkedTodo) {
        await onToggleLinkedTodo(linkedTodo, next)
        onCompletedChange?.(next)
      } else {
        writeTourHotelPriceCheckLocalCompleted(next, completionDateKey)
        setLocalCompleted(next)
      }
      onCompletedChange?.(next)
    } finally {
      setCompleting(false)
    }
  }, [completed, linkedTodo, onToggleLinkedTodo, onCompletedChange, completionDateKey])

  const handleFetchAllRates = useCallback(async () => {
    if (!rows.length) {
      toast.error(isKo ? '조회할 부킹이 없습니다.' : 'No bookings to check.')
      return
    }

    setBatchBusy(true)
    const toastId = toast.loading(
      isKo
        ? `Wyndham 공개가 조회 중… (고유 날짜·도시 ${uniqueScrapeEstimate}회, 수 분 소요 가능)`
        : `Fetching Wyndham rates… (${uniqueScrapeEstimate} unique date/city scrapes)`
    )
    const controller = new AbortController()
    const abortTimer = window.setTimeout(() => controller.abort(), 290_000)

    try {
      const headers = await authHeaders()
      const res = await fetch('/api/hotels/rates/tour-price-check', {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          jobs: rows.map((row) => ({
            bookingId: row.id,
            hotel: row.hotel,
            city: row.city,
            checkIn: row.check_in_date,
            checkOut: row.check_out_date,
            bookedUnitPrice: getTourHotelPriceCheckUnitPrice(
              row.total_price,
              row.unit_price,
              row.rooms
            ),
            rooms: row.rooms,
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || (isKo ? '요금 조회 실패' : 'Rate fetch failed'))

      const map: Record<string, TourPriceCheckResult> = {}
      for (const r of (json.results || []) as TourPriceCheckResult[]) {
        map[r.bookingId] = r
      }
      setFetchByBookingId(map)

      const ok = json.okCount ?? 0
      const total = json.total ?? rows.length
      const scrapes = json.scrapeCount ?? uniqueScrapeEstimate
      toast.success(
        isKo
          ? `시세 매칭 ${ok}/${total} · Playwright ${scrapes}회`
          : `Matched ${ok}/${total} · ${scrapes} scrapes`,
        { id: toastId }
      )
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === 'AbortError'
      toast.error(
        aborted
          ? isKo
            ? '요금 조회 시간 초과. 날짜가 많으면 범위를 줄이거나 다시 시도하세요.'
            : 'Rate fetch timed out. Try again or reduce date span.'
          : err instanceof Error
            ? err.message
            : isKo
              ? '요금 조회 실패'
              : 'Rate fetch failed',
        { id: toastId }
      )
    } finally {
      window.clearTimeout(abortTimer)
      setBatchBusy(false)
    }
  }, [rows, isKo, uniqueScrapeEstimate])

  return (
    <>
      <div
        className={
          isList
            ? className
            : `w-full rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50/70 to-white p-3 shadow-sm ${completed ? 'opacity-80' : ''}`
        }
        title={onEditRequest ? (isKo ? '우클릭: 수정' : 'Right-click to edit') : undefined}
        onContextMenu={
          onEditRequest
            ? (e) => {
                e.preventDefault()
                e.stopPropagation()
                onEditRequest()
              }
            : undefined
        }
      >
        <div className="flex items-start gap-2">
          <TodoPanelStatusButtons
            locale={locale}
            completed={completed}
            onHold={onHold}
            busy={completing}
            holdBusy={holdBusy}
            holdEnabled={holdEnabled}
            holdDisabledHint={holdDisabledHint}
            onToggleComplete={() => void handleToggleComplete()}
            onToggleHold={onToggleHold}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                <p
                  className={`min-w-0 text-[13px] font-semibold leading-snug ${
                    completed ? 'text-gray-400 line-through' : onHold ? 'text-amber-900' : 'text-gray-900'
                  }`}
                >
                  {tourHotelPriceCheckPanelTitle(locale)}
                </p>
                {isList ? (
                  <span className="shrink-0 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-800">
                    {isKo ? '일일' : 'Daily'}
                  </span>
                ) : null}
                <span className="shrink-0 text-[10px] text-gray-500">{dateRangeLabel}</span>
                {rows.length > 0 ? (
                  <span className="shrink-0 text-[10px] font-medium text-sky-800">{progressLabel}</span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void reload()}
                className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-sky-800"
                title={isKo ? '목록 새로고침' : 'Refresh list'}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                disabled={batchBusy || loading || rows.length === 0}
                onClick={() => void handleFetchAllRates()}
                className="inline-flex h-7 items-center gap-1 rounded-lg bg-sky-700 px-2 text-[10px] font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
                title={
                  isKo
                    ? `고유 날짜·도시 ${uniqueScrapeEstimate}회 스크랩 (순차). 날짜가 많으면 수 분 걸립니다.`
                    : `${uniqueScrapeEstimate} unique date/city scrapes (sequential).`
                }
              >
                {batchBusy ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <DollarSign className="h-3 w-3" />
                )}
                {batchBusy
                  ? isKo
                    ? '요금 조회 중…'
                    : 'Fetching…'
                  : isKo
                    ? `주요 호텔 요금 한 번에 가져오기 (${rows.length})`
                    : `Fetch all rates (${rows.length})`}
              </button>
              {uniqueScrapeEstimate > 0 ? (
                <span className="text-[9px] text-gray-500">
                  {isKo
                    ? `≈${uniqueScrapeEstimate}회 조회 · 호버 시 요금 목록`
                    : `≈${uniqueScrapeEstimate} scrapes · hover for rates`}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-2 space-y-1.5">
          {loading ? (
            <div className="flex items-center gap-2 py-3 text-xs text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {isKo ? '부킹 목록 불러오는 중…' : 'Loading bookings…'}
            </div>
          ) : error ? (
            <p className="rounded-md border border-dashed border-red-200 bg-red-50/60 py-3 text-center text-[11px] text-red-700">
              {isKo ? '부킹 목록을 불러오지 못했습니다.' : 'Failed to load bookings.'}
            </p>
          ) : displayRows.length === 0 ? (
            <p className="rounded-md border border-dashed border-gray-200 bg-white/60 py-3 text-center text-[11px] text-gray-500">
              {isKo
                ? '가격 확인이 필요한 투어 호텔 부킹이 없습니다.'
                : 'No tour hotel bookings need a price check.'}
            </p>
          ) : (
            displayRows.map((row) => {
              const rowStatus = getTodoPanelTourStatus(row.id, tourState)
              const websiteUrl = normalizeTourHotelWebsiteUrl(row.website)
              const tourLabel = row.tour_name || row.reservation_name || '—'
              const highPrice = isTourHotelPriceCheckHighUnitPrice(
                row.total_price,
                row.unit_price,
                row.rooms
              )
              const fetched = fetchByBookingId[row.id]
              const diffBadge = formatDiffBadge(fetched?.ok ? fetched.diff : null, isKo)
              const hoverRates = fetched?.rates || []
              const rowTitle = [
                formatShortDate(row.check_in_date),
                row.hotel,
                tourLabel,
                formatUsd(row.display_price),
                fetched?.ok
                  ? `${isKo ? '시세' : 'Mkt'} ${formatUsd(fetched.marketPrice)}`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')

              return (
                <div
                  key={row.id}
                  className={[
                    'group relative rounded-md border p-1.5',
                    tourHotelPriceCheckRowBorderClassName(rowStatus, highPrice),
                    completed ? 'opacity-70' : '',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-1.5">
                    <TodoPanelTourStatusButtons
                      locale={locale}
                      status={rowStatus}
                      onSetStatus={(next) => setTourStatus(row.id, next)}
                    />
                    <p
                      className={`min-w-0 flex-1 truncate text-[11px] font-medium leading-snug ${todoPanelTourTitleClassName(rowStatus)}`}
                      title={rowTitle}
                    >
                      <span className="tabular-nums">{formatShortDate(row.check_in_date)}</span>
                      <span className="text-gray-400"> , </span>
                      <span>{row.hotel}</span>
                      <span className="text-gray-400"> , </span>
                      <span>{tourLabel}</span>
                      <span className="text-gray-400"> , </span>
                      <span
                        className={`inline-flex rounded px-1 py-0.5 text-[10px] font-semibold tabular-nums ${
                          highPrice ? 'bg-red-50 text-red-900' : 'bg-emerald-50 text-emerald-900'
                        }`}
                      >
                        {formatUsd(row.display_price)}
                      </span>
                      {row.rooms > 1 ? (
                        <span className="ml-0.5 text-[10px] text-gray-500">×{row.rooms}</span>
                      ) : null}
                      <span className="text-gray-400"> , </span>
                      <span
                        className={`inline-flex rounded px-1 py-0.5 text-[10px] font-semibold tabular-nums ${diffBadge.className}`}
                      >
                        {diffBadge.label}
                      </span>
                    </p>
                    <div className="flex shrink-0 items-center gap-0.5">
                      {websiteUrl ? (
                        <a
                          href={websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-6 w-6 items-center justify-center rounded border border-gray-200 bg-white text-sky-700 hover:bg-sky-50"
                          title={isKo ? '예약 사이트에서 가격 확인' : 'Check price on booking site'}
                          aria-label={isKo ? '예약 사이트 열기' : 'Open booking site'}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Globe className="h-3.5 w-3.5" />
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setEditBookingId(row.id)}
                        className="inline-flex h-6 w-6 items-center justify-center rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                        title={isKo ? '부킹 수정 · 재부킹' : 'Edit / rebook'}
                        aria-label={isKo ? '부킹 수정 · 재부킹' : 'Edit / rebook'}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {row.tour_id && onOpenTourDetail ? (
                        <button
                          type="button"
                          onClick={() => onOpenTourDetail(row.tour_id!)}
                          className="inline-flex h-6 w-6 items-center justify-center rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                          title={isKo ? '투어 상세' : 'Tour detail'}
                          aria-label={isKo ? '투어 상세' : 'Tour detail'}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Hover: fetched rate list */}
                  {hoverRates.length > 0 ? (
                    <div className="pointer-events-none absolute left-2 right-2 top-full z-30 mt-0.5 hidden group-hover:block">
                      <div className="rounded-lg border border-sky-200 bg-white p-2 shadow-lg">
                        <p className="mb-1 text-[10px] font-semibold text-sky-900">
                          {isKo ? '조회된 공개 요금' : 'Fetched public rates'}
                          {fetched?.destination ? ` · ${fetched.destination}` : ''}
                          {fetched?.marketPrice != null
                            ? ` · ${isKo ? '매칭' : 'match'} ${formatUsd(fetched.marketPrice)}`
                            : ''}
                        </p>
                        <ul className="max-h-40 space-y-0.5 overflow-y-auto">
                          {hoverRates.map((rate) => (
                            <li
                              key={`${rate.roomType}-${rate.price}`}
                              className={`flex items-start justify-between gap-2 text-[10px] ${
                                rate.matched ? 'font-semibold text-sky-900' : 'text-gray-700'
                              }`}
                            >
                              <span className="min-w-0 flex-1 truncate">{rate.roomType}</span>
                              <span className="shrink-0 tabular-nums">{formatUsd(rate.price)}</span>
                            </li>
                          ))}
                        </ul>
                        {fetched && !fetched.ok && fetched.error ? (
                          <p className="mt-1 text-[9px] text-red-600">{fetched.error}</p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      </div>

      <TourHotelPriceCheckEditModal
        bookingId={editBookingId}
        locale={locale}
        onClose={() => setEditBookingId(null)}
        onSaved={() => void reload()}
      />
    </>
  )
}
