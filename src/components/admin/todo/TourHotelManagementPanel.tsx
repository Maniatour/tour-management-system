'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { DollarSign, ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { TodoPanelStatusButtons } from '@/components/admin/todo/TodoPanelStatusButtons'
import { TodoPanelTourStatusButtons } from '@/components/admin/todo/TodoPanelTourStatusButtons'
import {
  countTodoPanelTourProgress,
  getTodoPanelTourStatus,
  todoPanelTourRowClassName,
  todoPanelTourTitleClassName,
} from '@/lib/todoPanelTourCompletion'
import { useTodoPanelTourCompletion } from '@/hooks/useTodoPanelTourCompletion'
import {
  findTourHotelManagementLinkedTodo,
  readTourHotelManagementLocalCompleted,
  resolveMultiDayHotelSurveyNights,
  tourHotelManagementCompletionDateKey,
  tourHotelManagementPanelTitle,
  writeTourHotelManagementLocalCompleted,
  type TourHotelManagementLinkedTodo,
} from '@/lib/tourHotelManagementTodo'
import {
  useTourHotelManagementQueue,
  type TourHotelManagementQueueRow,
} from '@/hooks/useTourHotelManagementQueue'
import { supabase } from '@/lib/supabase'
import type {
  TourHotelRateSurveyResult,
  TourHotelRateSurveyStay,
} from '@/lib/hotels/tour-price-check-types'

type TourHotelManagementPanelProps = {
  locale: string
  variant?: 'panel' | 'list'
  className?: string
  linkedTodos?: Array<TourHotelManagementLinkedTodo & { title?: string | null }>
  onToggleLinkedTodo?: (todo: TourHotelManagementLinkedTodo, completed: boolean) => Promise<void>
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

const EMPTY_LINKED_TODOS: Array<TourHotelManagementLinkedTodo & { title?: string | null }> = []

function formatShortTourDate(raw: string): string {
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

function stayIdFor(tourId: string, checkIn: string, checkOut: string): string {
  return `${tourId}|${checkIn}|${checkOut}`
}

function buildStaysForTour(row: TourHotelManagementQueueRow): TourHotelRateSurveyStay[] {
  return resolveMultiDayHotelSurveyNights(row.tour_date, row.product_id).map((night) => ({
    stayId: stayIdFor(row.id, night.checkIn, night.checkOut),
    checkIn: night.checkIn,
    checkOut: night.checkOut,
    nightIndex: night.nightIndex,
    tourId: row.id,
  }))
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

export function TourHotelManagementPanel({
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
}: TourHotelManagementPanelProps) {
  const isKo = locale === 'ko'
  const isList = variant === 'list'
  const completionDateKey = useMemo(() => tourHotelManagementCompletionDateKey(), [])
  const { rows, loading, reload, dateRange } = useTourHotelManagementQueue(queryEnabled)
  const { tourState, setTourStatus } = useTodoPanelTourCompletion(
    'tour-hotel-management',
    completionDateKey
  )
  const linkedTodo = findTourHotelManagementLinkedTodo(linkedTodos)

  const [localCompleted, setLocalCompleted] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [surveyBusy, setSurveyBusy] = useState(false)
  const [hydrateBusy, setHydrateBusy] = useState(false)
  const [rowBusyId, setRowBusyId] = useState<string | null>(null)
  const [surveyByStayId, setSurveyByStayId] = useState<
    Record<string, TourHotelRateSurveyResult>
  >({})

  useEffect(() => {
    setLocalCompleted(readTourHotelManagementLocalCompleted(completionDateKey))
  }, [completionDateKey])

  const completed = linkedTodo?.completed ?? localCompleted

  const buildStaysPayload = useCallback(
    () => rows.flatMap((row) => buildStaysForTour(row)),
    [rows]
  )

  const applySurveyResults = useCallback((list: TourHotelRateSurveyResult[]) => {
    setSurveyByStayId((prev) => {
      const next = { ...prev }
      for (const r of list) {
        next[r.stayId] = r
      }
      return next
    })
  }, [])

  const hydrateFromDb = useCallback(async () => {
    const stays = buildStaysPayload()
    if (!stays.length) {
      setSurveyByStayId({})
      return
    }
    setHydrateBusy(true)
    try {
      const headers = await authHeaders()
      const res = await fetch('/api/hotels/rates/tour-price-check', {
        method: 'POST',
        headers,
        body: JSON.stringify({ hydrate: true, survey: true, stays }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'hydrate failed')
      applySurveyResults((json.results || []) as TourHotelRateSurveyResult[])
    } catch {
      // Keep previous badges if hydrate fails
    } finally {
      setHydrateBusy(false)
    }
  }, [buildStaysPayload, applySurveyResults])

  useEffect(() => {
    if (loading) return
    void hydrateFromDb()
  }, [loading, rows, hydrateFromDb])

  const dateRangeLabel = useMemo(() => {
    const fmt = (d: string) => {
      const parts = d.split('-')
      if (parts.length !== 3) return d
      return `${Number(parts[1])}/${Number(parts[2])}`
    }
    return `${fmt(dateRange.start)} – ${fmt(dateRange.end)}`
  }, [dateRange])

  const progress = useMemo(
    () => countTodoPanelTourProgress(rows.map((r) => r.id), tourState),
    [rows, tourState]
  )

  const progressLabel =
    rows.length > 0
      ? progress.onHold > 0
        ? isKo
          ? `미부킹 ${rows.length}건 · 완료 ${progress.done}/${progress.total} · 보류 ${progress.onHold}`
          : `${rows.length} mismatched · done ${progress.done}/${progress.total} · hold ${progress.onHold}`
        : isKo
          ? `미부킹 ${rows.length}건 · 완료 ${progress.done}/${progress.total}`
          : `${rows.length} mismatched · done ${progress.done}/${progress.total}`
      : isKo
        ? '미부킹 0건'
        : '0 mismatched'

  const uniqueScrapeEstimate = useMemo(() => {
    const keys = new Set<string>()
    for (const row of rows) {
      for (const night of resolveMultiDayHotelSurveyNights(row.tour_date, row.product_id)) {
        keys.add(`${night.checkIn}|${night.checkOut}`)
      }
    }
    // Page + Kanab per unique night (API runs nights in parallel, dests in parallel)
    return keys.size * 2
  }, [rows])

  /** Wall-clock hint: ~30s/wave; each wave covers 2 nights × Page+Kanab */
  const surveyEtaLabel = useMemo(() => {
    const nights = uniqueScrapeEstimate / 2
    if (!nights) return ''
    const waves = Math.ceil(nights / 2)
    const minutes = Math.max(1, Math.ceil((waves * 30) / 60))
    return isKo ? `약 ${minutes}분` : `~${minutes} min`
  }, [uniqueScrapeEstimate, isKo])

  const handleToggleComplete = useCallback(async () => {
    const next = !completed
    setCompleting(true)
    try {
      if (linkedTodo && onToggleLinkedTodo) {
        await onToggleLinkedTodo(linkedTodo, next)
        onCompletedChange?.(next)
      } else {
        writeTourHotelManagementLocalCompleted(next, completionDateKey)
        setLocalCompleted(next)
      }
      onCompletedChange?.(next)
    } finally {
      setCompleting(false)
    }
  }, [completed, linkedTodo, onToggleLinkedTodo, onCompletedChange, completionDateKey])

  const runSurvey = useCallback(
    async (stays: TourHotelRateSurveyStay[], opts?: { toastId?: string | number }) => {
      if (!stays.length) {
        toast.error(isKo ? '조회할 숙박일이 없습니다.' : 'No hotel nights to survey.')
        return
      }
      const headers = await authHeaders()
      const res = await fetch('/api/hotels/rates/tour-price-check', {
        method: 'POST',
        headers,
        body: JSON.stringify({ survey: true, stays }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || (isKo ? '요금 조회 실패' : 'Rate survey failed'))

      applySurveyResults((json.results || []) as TourHotelRateSurveyResult[])

      const ok = json.okCount ?? 0
      const total = json.total ?? stays.length
      const scrapes = json.scrapeCount ?? 0
      const saved = json.savedHotels ?? 0
      toast.success(
        isKo
          ? `시세 조사 ${ok}/${total} · 저장 ${saved}곳 · Playwright ${scrapes}회`
          : `Survey ${ok}/${total} · saved ${saved} · ${scrapes} scrapes`,
        opts?.toastId != null ? { id: opts.toastId } : undefined
      )
    },
    [isKo, applySurveyResults]
  )

  const handleSurveyAll = useCallback(async () => {
    const stays = buildStaysPayload()
    if (!stays.length) {
      toast.error(isKo ? '조회할 투어가 없습니다.' : 'No tours to survey.')
      return
    }
    setSurveyBusy(true)
    const toastId = toast.loading(
      isKo
        ? `Page·Kanab 시세 조사 중… (${uniqueScrapeEstimate}회 · 병렬 · ${surveyEtaLabel})`
        : `Surveying Page·Kanab… (${uniqueScrapeEstimate} scrapes · parallel · ${surveyEtaLabel})`
    )
    try {
      await runSurvey(stays, { toastId })
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : isKo
            ? '요금 조회 실패'
            : 'Rate survey failed',
        { id: toastId }
      )
    } finally {
      setSurveyBusy(false)
    }
  }, [buildStaysPayload, isKo, uniqueScrapeEstimate, surveyEtaLabel, runSurvey])

  const handleSurveyRow = useCallback(
    async (row: TourHotelManagementQueueRow) => {
      const stays = buildStaysForTour(row)
      if (!stays.length) {
        toast.error(isKo ? '이 투어의 숙박일을 계산할 수 없습니다.' : 'No hotel nights for this tour.')
        return
      }
      setRowBusyId(row.id)
      const toastId = toast.loading(
        isKo
          ? `${row.product_name} · Page·Kanab 시세 조사 중…`
          : `${row.product_name} · surveying Page·Kanab…`
      )
      try {
        await runSurvey(stays, { toastId })
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : isKo
              ? '요금 조회 실패'
              : 'Rate survey failed',
          { id: toastId }
        )
      } finally {
        setRowBusyId(null)
      }
    },
    [isKo, runSurvey]
  )

  return (
    <div
      className={
        isList
          ? className
          : `w-full rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50/80 to-white p-3 shadow-sm ${completed ? 'opacity-80' : ''}`
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
                {tourHotelManagementPanelTitle(locale)}
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
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                disabled={surveyBusy || loading || rows.length === 0}
                onClick={() => void handleSurveyAll()}
                className="rounded p-1 text-sky-700 hover:bg-sky-50 disabled:opacity-40"
                title={
                  isKo
                    ? `미부킹 투어 Page·Kanab 시세 한 번에 조회 (${uniqueScrapeEstimate}회 · ${surveyEtaLabel})`
                    : `Survey Page·Kanab rates for unbooked tours (${uniqueScrapeEstimate} · ${surveyEtaLabel})`
                }
                aria-label={isKo ? '미부킹 투어 호텔 시세 조회' : 'Survey hotel rates'}
              >
                {surveyBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <DollarSign className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => void reload()}
                className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-sky-800"
                title={isKo ? '목록 새로고침' : 'Refresh list'}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading || hydrateBusy ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 space-y-1.5">
        {loading ? (
          <div className="flex items-center gap-2 py-3 text-xs text-gray-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {isKo ? '멀티데이 투어 호텔 확인 중…' : 'Checking multi-day tour hotels…'}
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-md border border-dashed border-gray-200 bg-white/60 py-3 text-center text-[11px] text-gray-500">
            {isKo
              ? '호텔 부킹이 부족한 멀티데이 투어가 없습니다.'
              : 'No multi-day tours with hotel booking gaps.'}
          </p>
        ) : (
          rows.map((row) => {
            const rowStatus = getTodoPanelTourStatus(row.id, tourState)
            const nights = resolveMultiDayHotelSurveyNights(row.tour_date, row.product_id)
            const nightResults = nights
              .map((n) => surveyByStayId[stayIdFor(row.id, n.checkIn, n.checkOut)])
              .filter(Boolean) as TourHotelRateSurveyResult[]
            const okNights = nightResults.filter((r) => r.ok && r.cheapestPrice != null)
            const bestNight = okNights.reduce<TourHotelRateSurveyResult | null>((best, cur) => {
              if (!best || (cur.cheapestPrice ?? Infinity) < (best.cheapestPrice ?? Infinity)) {
                return cur
              }
              return best
            }, null)
            const hoverRates = bestNight?.rates || []
            const rowBusy = rowBusyId === row.id || surveyBusy

            return (
              <div
                key={row.id}
                className={[
                  'group relative rounded-md border p-1.5',
                  todoPanelTourRowClassName(rowStatus),
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
                    className={`flex min-w-0 flex-1 flex-wrap items-center gap-1 truncate text-[11px] font-medium leading-snug ${todoPanelTourTitleClassName(rowStatus)}`}
                  >
                    <span className="tabular-nums">{formatShortTourDate(row.tour_date)}</span>
                    <span>{row.product_name}</span>
                    <span
                      className="inline-flex rounded bg-blue-50 px-1 py-0.5 text-[10px] font-medium tabular-nums text-blue-900"
                      title={isKo ? '투어 총 인원' : 'Total guests'}
                    >
                      {row.assigned_people}
                      {isKo ? '인' : ' pax'}
                    </span>
                    <span
                      className="inline-flex rounded bg-violet-50 px-1 py-0.5 text-[10px] font-medium tabular-nums text-violet-900"
                      title={isKo ? '예약 건수' : 'Reservation count'}
                    >
                      {row.reservation_count}
                      {isKo ? '그룹' : ' grp'}
                    </span>
                    {row.guide_name ? <span className="text-gray-700">{row.guide_name}</span> : null}
                    <span
                      className={[
                        'inline-flex rounded px-1 py-0.5 text-[10px] font-semibold tabular-nums',
                        row.booked_hotel_count < row.required_hotel_count
                          ? 'border border-red-300 bg-red-50 text-red-900'
                          : 'border border-gray-200 bg-gray-50 text-gray-900',
                      ].join(' ')}
                      title={
                        isKo
                          ? `고객 ${row.customer_hotel_count}실 + 가이드 1실`
                          : `${row.customer_hotel_count} customer + 1 guide`
                      }
                    >
                      {row.booked_hotel_count} / {row.required_hotel_count}
                    </span>
                    {okNights.map((night) => (
                      <span
                        key={night.stayId}
                        className="inline-flex rounded bg-emerald-50 px-1 py-0.5 text-[10px] font-semibold tabular-nums text-emerald-900 ring-1 ring-violet-200"
                        title={
                          isKo
                            ? `N${night.nightIndex ?? '?'} 최저 ${formatUsd(night.cheapestPrice)} · ${night.cheapestHotel || ''}${
                                night.cheapestDestination ? ` (${night.cheapestDestination})` : ''
                              }${night.checkedAt ? ` · 조회 ${night.checkedAt.slice(5, 16).replace('T', ' ')}` : ''}`
                            : `N${night.nightIndex ?? '?'} low ${formatUsd(night.cheapestPrice)} · ${night.cheapestHotel || ''}${
                                night.checkedAt ? ` · ${night.checkedAt.slice(5, 16).replace('T', ' ')}` : ''
                              }`
                        }
                      >
                        {nights.length > 1 ? `N${night.nightIndex ?? ''} ` : ''}
                        {formatUsd(night.cheapestPrice)}
                      </span>
                    ))}
                  </p>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      disabled={rowBusy || nights.length === 0}
                      onClick={() => void handleSurveyRow(row)}
                      className="inline-flex h-6 w-6 items-center justify-center rounded border border-sky-200 bg-white text-sky-700 hover:bg-sky-50 disabled:opacity-40"
                      title={
                        isKo
                          ? '이 투어 Page·Kanab 시세 조회 (미부킹)'
                          : 'Survey Page·Kanab rates for this tour'
                      }
                      aria-label={isKo ? '시세 조회' : 'Survey rates'}
                    >
                      {rowBusyId === row.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <DollarSign className="h-3.5 w-3.5" />
                      )}
                    </button>
                    {onOpenTourDetail ? (
                      <button
                        type="button"
                        onClick={() => onOpenTourDetail(row.id)}
                        className="inline-flex h-6 w-6 items-center justify-center rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                        title={isKo ? '투어 상세' : 'Tour detail'}
                        aria-label={isKo ? '투어 상세' : 'Tour detail'}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>

                {hoverRates.length > 0 ? (
                  <div className="pointer-events-none absolute left-2 right-2 top-full z-30 mt-0.5 hidden group-hover:block">
                    <div className="rounded-lg border border-sky-200 bg-white p-2 shadow-lg">
                      <p className="mb-1 text-[10px] font-semibold text-sky-900">
                        {isKo ? 'Page·Kanab 공개 요금' : 'Page·Kanab public rates'}
                        {bestNight?.cheapestPrice != null
                          ? ` · ${isKo ? '최저' : 'low'} ${formatUsd(bestNight.cheapestPrice)}`
                          : ''}
                      </p>
                      <ul className="max-h-40 space-y-0.5 overflow-y-auto">
                        {hoverRates.map((rate) => (
                          <li
                            key={`${rate.destination || ''}-${rate.roomType}-${rate.price}`}
                            className={`flex items-start justify-between gap-2 text-[10px] ${
                              rate.cheapest
                                ? 'font-semibold text-violet-800'
                                : 'text-gray-700'
                            }`}
                          >
                            <span className="min-w-0 flex-1 truncate">
                              {rate.destination ? `${rate.destination} · ` : ''}
                              {rate.roomType}
                              {rate.cheapest ? (isKo ? ' (최저)' : ' (low)') : ''}
                            </span>
                            <span className="shrink-0 tabular-nums">{formatUsd(rate.price)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
