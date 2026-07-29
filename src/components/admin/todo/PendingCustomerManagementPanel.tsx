'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarPlus, ExternalLink, Loader2, RefreshCw, Users } from 'lucide-react'
import ReactCountryFlag from 'react-country-flag'
import { TodoPanelStatusButtons } from '@/components/admin/todo/TodoPanelStatusButtons'
import { PendingCustomerFollowUpStrip } from '@/components/reservation/PendingCustomerFollowUpStrip'
import { ReservationChannelFavicon } from '@/components/reservation/ReservationChannelFavicon'
import {
  findPendingCustomerManagementLinkedTodo,
  pendingCustomerManagementCompletionDateKey,
  pendingCustomerManagementPanelTitle,
  readPendingCustomerManagementLocalCompleted,
  writePendingCustomerManagementLocalCompleted,
  type PendingCustomerManagementLinkedTodo,
} from '@/lib/pendingCustomerManagementTodo'
import { usePendingCustomerManagementQueue } from '@/hooks/usePendingCustomerManagementQueue'
import { supabase } from '@/lib/supabase'
import {
  upsertReservationPendingAltTourNoticeManual,
  upsertReservationPendingCustomerResolution,
} from '@/lib/reservationPendingCustomerManual'
import { dispatchPendingCustomerManagementRefresh } from '@/lib/pendingCustomerManagementRefresh'
import type { PendingCustomerResolutionKind } from '@/lib/pendingCustomerManagementWorkflow'
import { getCustomerName, getProductInternalName, getReservationPartySize } from '@/utils/reservationUtils'

type PendingCustomerManagementPanelProps = {
  locale: string
  variant?: 'panel' | 'list'
  className?: string
  linkedTodos?: Array<PendingCustomerManagementLinkedTodo & { title?: string | null }>
  onToggleLinkedTodo?: (todo: PendingCustomerManagementLinkedTodo, completed: boolean) => Promise<void>
  onCompletedChange?: (completed: boolean) => void
  onEditRequest?: () => void
  onOpenReservation?: (reservationId: string) => void
  onHold?: boolean
  holdEnabled?: boolean
  onToggleHold?: () => void
  holdBusy?: boolean
  holdDisabledHint?: string
  queryEnabled?: boolean
  products?: Array<{
    id: string
    name?: string | null
    name_ko?: string | null
    name_en?: string | null
    customer_name_ko?: string | null
    customer_name_en?: string | null
  }>
  channels?: Array<{ id: string; name?: string | null; favicon_url?: string | null }>
}

const EMPTY_LINKED_TODOS: Array<PendingCustomerManagementLinkedTodo & { title?: string | null }> = []

function getLanguageFlagCountryCode(language: string | undefined | null): string {
  if (!language) return 'US'
  const lang = language.toLowerCase().trim()
  if (lang === 'kr' || lang === 'ko' || lang.startsWith('ko-') || lang === 'korean') return 'KR'
  if (lang === 'en' || lang.startsWith('en-') || lang === 'english') return 'US'
  if (lang === 'ja' || lang === 'jp' || lang.startsWith('ja-') || lang === 'japanese') return 'JP'
  if (lang === 'zh' || lang === 'cn' || lang.startsWith('zh-') || lang === 'chinese') return 'CN'
  return 'US'
}

function formatTourDateMmDdYyyy(tourDate: string | null | undefined): string {
  if (!tourDate) return '—'
  const parts = tourDate.split('-')
  if (parts.length !== 3) return tourDate
  const month = Number(parts[1])
  const day = Number(parts[2])
  const year = Number(parts[0])
  if (!month || !day || !year) return tourDate
  return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`
}

export function PendingCustomerManagementPanel({
  locale,
  variant = 'list',
  className = '',
  linkedTodos = EMPTY_LINKED_TODOS,
  onToggleLinkedTodo,
  onCompletedChange,
  onEditRequest,
  onOpenReservation,
  onHold = false,
  holdEnabled = false,
  onToggleHold,
  holdBusy = false,
  holdDisabledHint,
  products = [],
  channels = [],
  queryEnabled = true,
}: PendingCustomerManagementPanelProps) {
  const isKo = locale === 'ko'
  const isList = variant === 'list'
  const completionDateKey = useMemo(() => pendingCustomerManagementCompletionDateKey(), [])
  const {
    items,
    customers,
    products: queueProducts,
    channels: queueChannels,
    dateRange,
    loading,
    reload,
    patchItemFlags,
    count,
  } = usePendingCustomerManagementQueue(queryEnabled)
  const displayProducts = products.length > 0 ? products : queueProducts
  const displayChannels = channels.length > 0 ? channels : queueChannels
  const linkedTodo = findPendingCustomerManagementLinkedTodo(linkedTodos)

  const [localCompleted, setLocalCompleted] = useState(false)
  const [completing, setCompleting] = useState(false)

  useEffect(() => {
    setLocalCompleted(readPendingCustomerManagementLocalCompleted(completionDateKey))
  }, [completionDateKey])

  const completed = linkedTodo?.completed ?? localCompleted
  const progressLabel = isKo ? `대기 ${count}건` : `${count} pending`
  const dateRangeLabel = dateRange.start && dateRange.end ? `${dateRange.start} ~ ${dateRange.end}` : ''

  const handleToggleComplete = useCallback(async () => {
    const next = !completed
    setCompleting(true)
    try {
      if (linkedTodo && onToggleLinkedTodo) {
        await onToggleLinkedTodo(linkedTodo, next)
        onCompletedChange?.(next)
      } else {
        writePendingCustomerManagementLocalCompleted(next, completionDateKey)
        setLocalCompleted(next)
      }
      onCompletedChange?.(next)
    } finally {
      setCompleting(false)
    }
  }, [completed, linkedTodo, onToggleLinkedTodo, onCompletedChange, completionDateKey])

  const bumpRefresh = useCallback(() => {
    void reload({ silent: true })
  }, [reload])

  const handleAltTourNoticeChange = useCallback(
    async (reservationId: string, action: 'mark' | 'clear') => {
      try {
        const result = await upsertReservationPendingAltTourNoticeManual(supabase, reservationId, action)
        if (result) {
          patchItemFlags(reservationId, { altTourNoticeManual: result.altTourNoticeManual })
        }
        dispatchPendingCustomerManagementRefresh()
      } catch (e) {
        console.error(e)
        alert(isKo ? '저장에 실패했습니다.' : 'Save failed.')
        throw e
      }
    },
    [isKo, patchItemFlags]
  )

  const handleResolutionSaved = useCallback(
    async (reservationId: string, kind: PendingCustomerResolutionKind) => {
      try {
        const result = await upsertReservationPendingCustomerResolution(
          supabase,
          reservationId,
          kind,
          'mark'
        )
        if (result) {
          patchItemFlags(reservationId, {
            altTourNoticeManual: result.altTourNoticeManual,
            resolutionKind: kind,
          })
        }
        dispatchPendingCustomerManagementRefresh()
        bumpRefresh()
      } catch (e) {
        console.error(e)
        alert(isKo ? '저장에 실패했습니다.' : 'Save failed.')
        throw e
      }
    },
    [bumpRefresh, isKo, patchItemFlags]
  )

  return (
    <div
      className={
        isList
          ? className
          : `w-full rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50/80 to-white p-3 shadow-sm ${completed ? 'opacity-80' : ''}`
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
                {pendingCustomerManagementPanelTitle(locale)}
              </p>
              {isList ? (
                <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                  {isKo ? '일일' : 'Daily'}
                </span>
              ) : null}
              {count > 0 ? (
                <span className="shrink-0 text-[10px] font-medium text-amber-800">{progressLabel}</span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => void reload()}
              className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-amber-800"
              title={isKo ? '목록 새로고침' : 'Refresh list'}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {dateRangeLabel ? (
            <p className="mt-0.5 text-[10px] text-gray-500">
              {isKo
                ? `투어 3일 이내 · pending (${dateRangeLabel})`
                : `Pending · tour within 3 days (${dateRangeLabel})`}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-2 space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 py-3 text-xs text-gray-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {isKo ? 'Pending 예약 목록 불러오는 중…' : 'Loading pending reservations…'}
          </div>
        ) : items.length === 0 ? (
          <p className="rounded-md border border-dashed border-gray-200 bg-white/60 py-3 text-center text-[11px] text-gray-500">
            {isKo
              ? '처리가 필요한 Pending 예약이 없습니다.'
              : 'No pending reservations need outreach within 3 days.'}
          </p>
        ) : (
          items.map((item) => {
            const { reservation } = item
            const customer = customers.find((c) => c.id === reservation.customerId)
            const customerName = getCustomerName(reservation.customerId, customers)
            const productName = getProductInternalName(reservation.productId, displayProducts)
            const channelName =
              reservation.channelNameSnapshot ??
              displayChannels.find((c) => c.id === reservation.channelId)?.name ??
              null
            const partySize = getReservationPartySize(reservation as unknown as Record<string, unknown>)
            return (
              <div
                key={reservation.id}
                className="rounded-md border border-amber-100/80 bg-white/90 p-2 shadow-sm"
              >
                <div className="mb-1.5 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      {customer?.language ? (
                        <ReactCountryFlag
                          countryCode={getLanguageFlagCountryCode(customer.language)}
                          svg
                          style={{
                            width: '14px',
                            height: '11px',
                            borderRadius: '2px',
                            flexShrink: 0,
                          }}
                          title={customer.language}
                        />
                      ) : null}
                      <span className="min-w-0 truncate text-[11px] font-semibold text-gray-900">
                        {customerName}
                      </span>
                      {partySize > 0 ? (
                        <span
                          className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-primary"
                          title={isKo ? '총 예약 인원' : 'Total guests'}
                        >
                          <Users className="h-3 w-3 shrink-0" aria-hidden />
                          {partySize}
                        </span>
                      ) : null}
                      <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                        D-{item.daysUntilTour}
                      </span>
                      <ReservationChannelFavicon
                        channelId={reservation.channelId}
                        channels={displayChannels}
                        sizeClass="h-4 w-4"
                        className="rounded"
                      />
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-700">
                      <span
                        className="shrink-0 font-medium tabular-nums text-gray-900"
                        title={isKo ? '투어 날짜' : 'Tour date'}
                      >
                        {formatTourDateMmDdYyyy(reservation.tourDate)}
                      </span>
                      <span className="min-w-0 font-medium text-gray-900 [overflow-wrap:anywhere]">
                        {productName}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-gray-600">
                      <span
                        className="inline-flex items-center gap-1 tabular-nums"
                        title={isKo ? '등록일' : 'Registration date'}
                      >
                        <CalendarPlus className="h-3 w-3 shrink-0 text-primary" aria-hidden />
                        <span className="text-gray-500">{isKo ? '등록' : 'Reg.'}</span>
                        <span className="font-medium text-gray-800">
                          {reservation.addedTime
                            ? formatTourDateMmDdYyyy(String(reservation.addedTime).slice(0, 10))
                            : '—'}
                        </span>
                      </span>
                      {channelName ? (
                        <span className="truncate text-gray-600">{channelName}</span>
                      ) : null}
                    </div>
                  </div>
                  {onOpenReservation ? (
                    <button
                      type="button"
                      onClick={() => onOpenReservation(reservation.id)}
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                      title={isKo ? '예약 카드에서 열기' : 'Open in reservations'}
                      aria-label={isKo ? '예약 카드에서 열기' : 'Open in reservations'}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
                <PendingCustomerFollowUpStrip
                  locale={locale}
                  reservationId={reservation.id}
                  altTourNoticeManual={item.altTourNoticeManual}
                  hasCustomerResponse={item.hasCustomerResponse}
                  resolutionKind={item.resolutionKind}
                  customerEmail={customer?.email ?? ''}
                  customerPhone={customer?.phone ?? null}
                  customerName={customerName}
                  customerLanguage={customer?.language ?? null}
                  tourDate={reservation.tourDate ?? null}
                  productId={reservation.productId}
                  products={displayProducts}
                  channelRN={reservation.channelRN ?? null}
                  onAltTourNoticeManualChange={handleAltTourNoticeChange}
                  onResolutionSaved={handleResolutionSaved}
                  onCustomerResponseSaved={bumpRefresh}
                />
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
