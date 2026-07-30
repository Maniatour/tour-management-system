'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Hotel,
  Loader2,
  RefreshCw,
  Users,
} from 'lucide-react'
import { TodoPanelStatusButtons } from '@/components/admin/todo/TodoPanelStatusButtons'
import { supabase } from '@/lib/supabase'
import type { CustomerCommunicationChannel } from '@/lib/customerCommunicationChannel'
import {
  customerInfoReviewCompletionDateKey,
  customerInfoReviewIssueLabel,
  customerInfoReviewPanelTitle,
  findCustomerInfoReviewLinkedTodo,
  hasRiskyCommunicationChannel,
  isResidentStatusCountIncomplete,
  productRequiresResidentStatus,
  readCustomerInfoReviewLocalCompleted,
  writeCustomerInfoReviewLocalCompleted,
  type CustomerInfoReviewIssue,
  type CustomerInfoReviewLinkedTodo,
} from '@/lib/customerInfoReviewTodo'
import {
  useCustomerInfoReviewQueue,
  type CustomerInfoReviewItem,
} from '@/hooks/useCustomerInfoReviewQueue'
import { CustomerCommunicationChannelPicker } from '@/components/reservation/CustomerCommunicationChannelPicker'
import { ResidentStatusIcon } from '@/components/reservation/ResidentStatusIcon'
import { productShowsResidentStatusSectionByCode } from '@/utils/residentStatusSectionProducts'
import ReactCountryFlag from 'react-country-flag'

const ReservationDetailPageView = dynamic(
  () =>
    import('@/components/reservation/ReservationDetailPageView').then(
      (mod) => mod.ReservationDetailPageView
    ),
  { ssr: false, loading: () => null }
)

type CustomerInfoReviewPanelProps = {
  locale: string
  variant?: 'panel' | 'list'
  className?: string
  linkedTodos?: Array<CustomerInfoReviewLinkedTodo & { title?: string | null }>
  onToggleLinkedTodo?: (todo: CustomerInfoReviewLinkedTodo, completed: boolean) => Promise<void>
  onCompletedChange?: (completed: boolean) => void
  onEditRequest?: () => void
  onHold?: boolean
  holdEnabled?: boolean
  onToggleHold?: () => void
  holdBusy?: boolean
  holdDisabledHint?: string
  queryEnabled?: boolean
}

const EMPTY_LINKED_TODOS: Array<CustomerInfoReviewLinkedTodo & { title?: string | null }> = []

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

function formatShortTourDate(raw: string): string {
  if (!raw) return '—'
  const parts = raw.split('-')
  if (parts.length !== 3) return raw
  const month = Number(parts[1])
  const day = Number(parts[2])
  if (!month || !day) return raw
  return `${month}/${day}`
}

function tourSummaryText(tour: {
  tour_date: string
  product_internal_name: string
  guide_name: string | null
  assistant_name: string | null
  vehicle_number: string | null
}): string {
  const segments = [
    `${formatShortTourDate(tour.tour_date)} ${tour.product_internal_name}`,
    tour.guide_name,
    tour.assistant_name,
    tour.vehicle_number,
  ].filter((s): s is string => Boolean(s && String(s).trim()))
  return segments.join(' , ')
}

function itemStillHasIssues(item: CustomerInfoReviewItem): boolean {
  const issues: CustomerInfoReviewIssue[] = []

  if (
    hasRiskyCommunicationChannel(
      item.customerCommunicationChannel,
      item.channelId,
      item.channelName
    )
  ) {
    issues.push('communication')
  }

  if (item.issues.includes('pickup_hotel')) {
    issues.push('pickup_hotel')
  }

  if (productRequiresResidentStatus(item.productCode)) {
    if (
      isResidentStatusCountIncomplete(item.prefetchedResidentCustomerRows, item.totalPeople)
    ) {
      issues.push('resident_status')
    }
  }

  return issues.length > 0
}

function ReviewItemRow({
  item,
  locale,
  onOpenReservation,
  onCommunicationChannelChange,
  onResidentStatusUpdate,
}: {
  item: CustomerInfoReviewItem
  locale: string
  onOpenReservation: (reservationId: string) => void
  onCommunicationChannelChange: (
    reservationId: string,
    channel: CustomerCommunicationChannel
  ) => Promise<void>
  onResidentStatusUpdate: (reservationId: string) => void
}) {
  const isKo = locale === 'ko'
  const showResidentStatusUi = productShowsResidentStatusSectionByCode(item.productCode)
  const showPickupIssue = item.issues.includes('pickup_hotel')
  const showCommunicationPicker = hasRiskyCommunicationChannel(
    item.customerCommunicationChannel,
    item.channelId,
    item.channelName
  )

  return (
    <div className="rounded-md border border-gray-200/90 bg-white/90 p-1.5">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {item.customerLanguage ? (
            <ReactCountryFlag
              countryCode={getLanguageFlagCountryCode(item.customerLanguage)}
              svg
              style={{ width: '14px', height: '11px', borderRadius: '2px', flexShrink: 0 }}
            />
          ) : null}
          <button
            type="button"
            onClick={() => onOpenReservation(item.reservationId)}
            className="min-w-0 truncate text-left text-[11px] font-semibold text-gray-900 hover:text-emerald-700 hover:underline"
            title={isKo ? '예약 수정' : 'Edit reservation'}
          >
            {item.customerName}
          </button>
          <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-gray-800 tabular-nums">
            <Users className="h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden />
            {item.totalPeople}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 leading-none">
          {showCommunicationPicker ? (
            <CustomerCommunicationChannelPicker
              compact
              align="right"
              value={item.customerCommunicationChannel}
              channelId={item.channelId}
              channelName={item.channelName}
              onChange={(channel) => onCommunicationChannelChange(item.reservationId, channel)}
            />
          ) : null}
          {showResidentStatusUi ? (
            <ResidentStatusIcon
              compact
              reservationId={item.reservationId}
              customerId={item.customerId}
              totalPeople={item.totalPeople}
              prefetchedResidentCustomerRows={item.prefetchedResidentCustomerRows}
              onUpdate={() => onResidentStatusUpdate(item.reservationId)}
            />
          ) : null}
          {showPickupIssue ? (
            <span
              className="inline-flex h-4 items-center gap-0.5 rounded border border-amber-200 bg-amber-50 px-1 text-[9px] font-medium text-amber-900"
              title={customerInfoReviewIssueLabel('pickup_hotel', locale)}
            >
              <Hotel className="h-3 w-3 shrink-0" aria-hidden />
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function CustomerInfoReviewPanel({
  locale,
  variant = 'list',
  className = '',
  linkedTodos = EMPTY_LINKED_TODOS,
  onToggleLinkedTodo,
  onCompletedChange,
  onEditRequest,
  onHold = false,
  holdEnabled = false,
  onToggleHold,
  holdBusy = false,
  holdDisabledHint,
  queryEnabled = true,
}: CustomerInfoReviewPanelProps) {
  const isKo = locale === 'ko'
  const isList = variant === 'list'
  const completionDateKey = useMemo(() => customerInfoReviewCompletionDateKey(), [])
  const { groups, loading, reload, targetDates } = useCustomerInfoReviewQueue(queryEnabled)
  const linkedTodo = findCustomerInfoReviewLinkedTodo(linkedTodos)

  const [localCompleted, setLocalCompleted] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [editingReservationId, setEditingReservationId] = useState<string | null>(null)
  const [localGroups, setLocalGroups] = useState(groups)

  useEffect(() => {
    setLocalGroups(groups)
  }, [groups])

  useEffect(() => {
    setLocalCompleted(readCustomerInfoReviewLocalCompleted(completionDateKey))
  }, [completionDateKey])

  const completed = linkedTodo?.completed ?? localCompleted

  const handleToggleComplete = useCallback(async () => {
    const next = !completed
    setCompleting(true)
    try {
      if (linkedTodo && onToggleLinkedTodo) {
        await onToggleLinkedTodo(linkedTodo, next)
        onCompletedChange?.(next)
      } else {
        writeCustomerInfoReviewLocalCompleted(next, completionDateKey)
        setLocalCompleted(next)
      }
      onCompletedChange?.(next)
    } finally {
      setCompleting(false)
    }
  }, [completed, linkedTodo, onToggleLinkedTodo, onCompletedChange, completionDateKey])

  const patchItem = useCallback(
    (reservationId: string, patch: Partial<CustomerInfoReviewItem>) => {
      setLocalGroups((prev) =>
        prev
          .map((group) => ({
            ...group,
            items: group.items.map((item) =>
              item.reservationId === reservationId ? { ...item, ...patch } : item
            ),
          }))
          .map((group) => ({
            ...group,
            items: group.items.filter((item) => itemStillHasIssues(item)),
          }))
          .filter((group) => group.items.length > 0)
      )
    },
    []
  )

  const handleCommunicationChannelChange = useCallback(
    async (reservationId: string, channel: CustomerCommunicationChannel) => {
      const current = localGroups
        .flatMap((g) => g.items)
        .find((item) => item.reservationId === reservationId)
      if (!current) return

      const previous = current.customerCommunicationChannel
      patchItem(reservationId, { customerCommunicationChannel: channel })

      const { error } = await supabase
        .from('reservations')
        .update({ customer_communication_channel: channel })
        .eq('id', reservationId)

      if (error) {
        patchItem(reservationId, { customerCommunicationChannel: previous })
        alert(isKo ? '소통 채널 저장에 실패했습니다.' : 'Failed to save communication channel.')
        return
      }

      const updated = { ...current, customerCommunicationChannel: channel }
      if (!itemStillHasIssues(updated)) {
        void reload()
      }
    },
    [isKo, localGroups, patchItem, reload]
  )

  const handleResidentStatusUpdate = useCallback(() => {
    void reload()
  }, [reload])

  const handleModalSaved = useCallback(() => {
    setEditingReservationId(null)
    void reload()
  }, [reload])

  const dateRangeLabel = useMemo(() => {
    const [d1, d2] = targetDates
    const fmt = (d: string) => {
      const parts = d.split('-')
      if (parts.length !== 3) return d
      return `${Number(parts[1])}/${Number(parts[2])}`
    }
    return `${fmt(d1)} – ${fmt(d2)}`
  }, [targetDates])

  const visibleIssueCount = useMemo(
    () => localGroups.reduce((sum, group) => sum + group.items.length, 0),
    [localGroups]
  )

  return (
    <>
      <div
        className={
          isList
            ? className
            : `w-full rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/80 to-white p-3 shadow-sm ${completed ? 'opacity-80' : ''}`
        }
      >
        <div
          className="flex items-start gap-2"
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
                  {customerInfoReviewPanelTitle(locale)}
                </p>
                {isList ? (
                  <span className="shrink-0 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-800">
                    {isKo ? '일일' : 'Daily'}
                  </span>
                ) : null}
                {!completed && visibleIssueCount > 0 ? (
                  <span className="shrink-0 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-800 tabular-nums">
                    {visibleIssueCount}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void reload()}
                className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-violet-700"
                title={isKo ? '목록 새로고침' : 'Refresh list'}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <p className="mt-0.5 text-[10px] text-gray-500">
              {isKo
                ? `내일·모레 투어 (${dateRangeLabel}) · 이름 클릭 시 예약 수정`
                : `Tours ${dateRangeLabel} · click name to edit`}
            </p>
          </div>
        </div>

        <div className="mt-2 space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 py-3 text-xs text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {isKo ? '검수 대상 불러오는 중…' : 'Loading review items…'}
            </div>
          ) : localGroups.length === 0 ? (
            <p className="rounded-md border border-dashed border-gray-200 bg-white/60 py-3 text-center text-[11px] text-gray-500">
              {isKo
                ? '내일·모레 투어 중 검수가 필요한 예약이 없습니다.'
                : 'No reservations need review for tomorrow or the day after.'}
            </p>
          ) : (
            localGroups.map((group) => (
              <div key={group.id} className="rounded-md border border-gray-200/80 bg-white/70 p-1.5">
                <p
                  className="truncate text-[11px] font-medium text-gray-900"
                  title={`${tourSummaryText(group)} · ${group.assigned_people}`}
                >
                  <span>{tourSummaryText(group)}</span>
                  <span className="text-gray-400"> , </span>
                  <span className="inline-flex items-center gap-0.5 align-middle text-gray-700">
                    <Users className="h-3 w-3 shrink-0" aria-hidden />
                    <span className="tabular-nums">{group.assigned_people}</span>
                  </span>
                </p>
                <div className="mt-1.5 space-y-1">
                  {group.items.map((item) => (
                    <ReviewItemRow
                      key={item.reservationId}
                      item={item}
                      locale={locale}
                      onOpenReservation={setEditingReservationId}
                      onCommunicationChannelChange={handleCommunicationChannelChange}
                      onResidentStatusUpdate={handleResidentStatusUpdate}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {editingReservationId ? (
        <ReservationDetailPageView
          reservationId={editingReservationId}
          layout="modal"
          modalLightLoad
          modalStackLevel="elevated"
          onCancel={() => setEditingReservationId(null)}
          onSaved={handleModalSaved}
        />
      ) : null}
    </>
  )
}
