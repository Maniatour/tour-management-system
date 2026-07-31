'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarPlus, CalendarX, ExternalLink, Loader2, RefreshCw, Users } from 'lucide-react'
import ReactCountryFlag from 'react-country-flag'
import { TodoPanelStatusButtons } from '@/components/admin/todo/TodoPanelStatusButtons'
import { ReservationCardSmsMenuButton } from '@/components/reservation/ReservationCardSmsMenuButton'
import CancelledSimpleCardFollowUpStrip from '@/components/reservation/CancelledSimpleCardFollowUpStrip'
import { CancelRebookingFollowUpStepBar } from '@/components/reservation/CancelRebookingFollowUpStepBar'
import { ReservationChannelFavicon } from '@/components/reservation/ReservationChannelFavicon'
import {
  cancelRebookingFollowUpCompletionDateKey,
  cancelRebookingFollowUpPanelTitle,
  findCancelRebookingFollowUpLinkedTodo,
  readCancelRebookingFollowUpLocalCompleted,
  writeCancelRebookingFollowUpLocalCompleted,
  type CancelRebookingFollowUpLinkedTodo,
} from '@/lib/cancelRebookingFollowUpTodo'
import { useAuth } from '@/contexts/AuthContext'
import { useCancelRebookingFollowUpQueue } from '@/hooks/useCancelRebookingFollowUpQueue'
import { supabase } from '@/lib/supabase'
import { upsertReservationCancelFollowUpManual } from '@/lib/reservationCancelFollowUpManual'
import { getCustomerName, getProductInternalName, getReservationPartySize } from '@/utils/reservationUtils'
import type { CancelFollowUpManualKind } from '@/components/reservation/ReservationFollowUpQueueModal'
import type { ReservationFollowUpPipelineSnapshot } from '@/lib/reservationFollowUpPipeline'

type CancelRebookingFollowUpPanelProps = {
  locale: string
  variant?: 'panel' | 'list'
  className?: string
  linkedTodos?: Array<CancelRebookingFollowUpLinkedTodo & { title?: string | null }>
  onToggleLinkedTodo?: (todo: CancelRebookingFollowUpLinkedTodo, completed: boolean) => Promise<void>
  onCompletedChange?: (completed: boolean) => void
  onEditRequest?: () => void
  onOpenReservation?: (reservationId: string) => void
  onCancelFollowUpManualChange?: (
    reservationId: string,
    kind: CancelFollowUpManualKind,
    action: 'mark' | 'clear'
  ) => void | Promise<void>
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

const EMPTY_LINKED_TODOS: Array<CancelRebookingFollowUpLinkedTodo & { title?: string | null }> = []

function getLanguageFlagCountryCode(language: string | undefined | null): string {
  if (!language) return 'US'
  const lang = language.toLowerCase().trim()
  if (lang === 'kr' || lang === 'ko' || lang.startsWith('ko-') || lang === 'korean') return 'KR'
  if (lang === 'en' || lang.startsWith('en-') || lang === 'english') return 'US'
  if (lang === 'ja' || lang === 'jp' || lang.startsWith('ja-') || lang === 'japanese') return 'JP'
  if (lang === 'zh' || lang === 'cn' || lang.startsWith('zh-') || lang === 'chinese') return 'CN'
  if (lang === 'es' || lang.startsWith('es-') || lang === 'spanish') return 'ES'
  if (lang === 'fr' || lang.startsWith('fr-') || lang === 'french') return 'FR'
  if (lang === 'de' || lang.startsWith('de-') || lang === 'german') return 'DE'
  if (lang === 'it' || lang.startsWith('it-') || lang === 'italian') return 'IT'
  if (lang === 'pt' || lang.startsWith('pt-') || lang === 'portuguese') return 'PT'
  if (lang === 'ru' || lang.startsWith('ru-') || lang === 'russian') return 'RU'
  if (lang === 'th' || lang === 'thai') return 'TH'
  if (lang === 'vi' || lang === 'vietnamese') return 'VN'
  if (lang === 'id' || lang === 'indonesian') return 'ID'
  if (lang === 'ms' || lang === 'malay') return 'MY'
  if (lang === 'ph' || lang === 'filipino' || lang === 'tl') return 'PH'
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

function formatTimestampMmDdYyyy(value: string | null | undefined): string {
  if (!value || !String(value).trim()) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`
}

function snapshotFromItem(item: {
  cancelFollowUpManual: boolean
  cancelRebookingOutreachManual: boolean
}): ReservationFollowUpPipelineSnapshot {
  return {
    confirmationSent: false,
    confirmationSentDirect: false,
    confirmationInferredFromDeparture: false,
    residentInquirySent: false,
    guestResidentFlowCompleted: false,
    departureSent: false,
    pickupSent: false,
    needsResidentFlow: false,
    manualConfirmation: false,
    manualResident: false,
    manualDeparture: false,
    manualPickup: false,
    cancelFollowUpManual: item.cancelFollowUpManual,
    cancelRebookingOutreachManual: item.cancelRebookingOutreachManual,
  }
}

export function CancelRebookingFollowUpPanel({
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
}: CancelRebookingFollowUpPanelProps) {
  const isKo = locale === 'ko'
  const isList = variant === 'list'
  const { user } = useAuth()
  const sentBy = user?.email || null
  const completionDateKey = useMemo(() => cancelRebookingFollowUpCompletionDateKey(), [])
  const {
    items,
    customers,
    products: queueProducts,
    channels: queueChannels,
    tourCapacityByTourId,
    loading,
    reload,
    patchItemManualFlags,
    count,
  } = useCancelRebookingFollowUpQueue(queryEnabled)
  const displayProducts = products.length > 0 ? products : queueProducts
  const displayChannels = channels.length > 0 ? channels : queueChannels
  const linkedTodo = findCancelRebookingFollowUpLinkedTodo(linkedTodos)

  const [localCompleted, setLocalCompleted] = useState(false)
  const [completing, setCompleting] = useState(false)

  useEffect(() => {
    setLocalCompleted(readCancelRebookingFollowUpLocalCompleted(completionDateKey))
  }, [completionDateKey])

  const completed = linkedTodo?.completed ?? localCompleted
  const progressLabel = isKo ? `대기 ${count}건` : `${count} pending`

  const handleToggleComplete = useCallback(async () => {
    const next = !completed
    setCompleting(true)
    try {
      if (linkedTodo && onToggleLinkedTodo) {
        await onToggleLinkedTodo(linkedTodo, next)
        onCompletedChange?.(next)
      } else {
        writeCancelRebookingFollowUpLocalCompleted(next, completionDateKey)
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

  const handleManualChange = useCallback(
    async (reservationId: string, kind: CancelFollowUpManualKind, action: 'mark' | 'clear') => {
      try {
        const result = await upsertReservationCancelFollowUpManual(
          supabase,
          reservationId,
          kind,
          action
        )
        if (result) {
          patchItemManualFlags(reservationId, result)
        }
      } catch (e) {
        console.error(e)
        alert(isKo ? '저장에 실패했습니다.' : 'Save failed.')
        throw e
      }
    },
    [isKo, patchItemManualFlags]
  )

  return (
    <div
      className={
        isList
          ? className
          : `w-full rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50/80 to-white p-3 shadow-sm ${completed ? 'opacity-80' : ''}`
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
                {cancelRebookingFollowUpPanelTitle(locale)}
              </p>
              {isList ? (
                <span className="shrink-0 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-900">
                  {isKo ? '일일' : 'Daily'}
                </span>
              ) : null}
              {count > 0 ? (
                <span className="shrink-0 text-[10px] font-medium text-rose-800">{progressLabel}</span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => void reload()}
              className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-rose-800"
              title={isKo ? '목록 새로고침' : 'Refresh list'}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-2 space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 py-3 text-xs text-gray-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {isKo ? '취소 Follow-up 대기 목록 불러오는 중…' : 'Loading cancel follow-up queue…'}
          </div>
        ) : items.length === 0 ? (
          <p className="rounded-md border border-dashed border-gray-200 bg-white/60 py-3 text-center text-[11px] text-gray-500">
            {isKo
              ? 'Follow-up·재예약 권유가 필요한 취소 예약이 없습니다.'
              : 'No cancelled reservations need follow-up or rebook outreach.'}
          </p>
        ) : (
          items.map((item) => {
            const { reservation } = item
            const customer = customers.find((c) => c.id === reservation.customerId)
            const snapshot = snapshotFromItem(item)
            const customerName = getCustomerName(reservation.customerId, customers)
            const productName = getProductInternalName(reservation.productId, displayProducts)
            const tourCapacity = reservation.tourId
              ? tourCapacityByTourId.get(reservation.tourId)
              : undefined
            const channelName =
              reservation.channelNameSnapshot ??
              displayChannels.find((c) => c.id === reservation.channelId)?.name ??
              null
            const partySize = getReservationPartySize(reservation as unknown as Record<string, unknown>)
            return (
              <div
                key={reservation.id}
                className="rounded-md border border-rose-100/80 bg-white/90 p-2 shadow-sm"
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
                      <span
                        className="inline-flex shrink-0 items-center gap-0.5 tabular-nums text-gray-700"
                        title={isKo ? '배정 인원 / 정원' : 'Assigned / capacity'}
                      >
                        <Users className="h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden />
                        {tourCapacity
                          ? `${tourCapacity.assignedPeople} / ${tourCapacity.maxParticipants}`
                          : '— / —'}
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
                          {formatTimestampMmDdYyyy(reservation.addedTime)}
                        </span>
                      </span>
                      <span
                        className="inline-flex items-center gap-1 tabular-nums"
                        title={isKo ? '취소일' : 'Cancellation date'}
                      >
                        <CalendarX className="h-3 w-3 shrink-0 text-red-600" aria-hidden />
                        <span className="text-gray-500">{isKo ? '취소' : 'Cancel'}</span>
                        <span className="font-medium text-gray-800">
                          {formatTimestampMmDdYyyy(
                            item.cancellationRecordedAt ?? reservation.updated_at ?? null
                          )}
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 leading-none">
                    <ReservationCardSmsMenuButton
                      reservationId={reservation.id}
                      customer={customer}
                      sentBy={sentBy}
                      uiLocale={locale === 'en' ? 'en' : 'ko'}
                    />
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
                </div>
                <CancelRebookingFollowUpStepBar
                  locale={locale}
                  snapshot={snapshot}
                  cancellationReason={item.cancellationReason}
                  hasCustomerResponse={item.hasCustomerResponse}
                  compact
                />
                <div className="mt-1.5 border-t border-gray-100 pt-1.5">
                  <CancelledSimpleCardFollowUpStrip
                    reservationId={reservation.id}
                    snapshot={snapshot}
                    customerEmail={customer?.email ?? ''}
                    customerPhone={customer?.phone ?? null}
                    customerName={getCustomerName(reservation.customerId, customers)}
                    customerLanguage={customer?.language ?? null}
                    tourDate={reservation.tourDate ?? null}
                    productId={reservation.productId}
                    products={displayProducts}
                    adults={reservation.adults || 0}
                    children={reservation.child || 0}
                    infants={reservation.infant || 0}
                    channelRN={reservation.channelRN ?? null}
                    channelName={channelName}
                    onCancelFollowUpManualChange={handleManualChange}
                    onReasonSaved={bumpRefresh}
                    knownCancellationReason={item.cancellationReason}
                    showWorkflowStepBar={false}
                    knownHasCustomerResponse={item.hasCustomerResponse}
                    onCustomerResponseSaved={bumpRefresh}
                  />
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
