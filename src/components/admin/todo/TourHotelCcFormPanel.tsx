'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BadgeCheck, ExternalLink, Loader2, Phone, RefreshCw } from 'lucide-react'
import { TodoPanelStatusButtons } from '@/components/admin/todo/TodoPanelStatusButtons'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  findTourHotelCcFormLinkedTodo,
  isTourHotelCcFormRowDone,
  normalizeTourHotelCcStatus,
  readTourHotelCcFormLocalCompleted,
  TOUR_HOTEL_CC_STATUS_OPTIONS,
  tourHotelCcFormCompletionDateKey,
  tourHotelCcFormRowBorderClassName,
  tourHotelCcFormPanelTitle,
  tourHotelCcStatusClassName,
  writeTourHotelCcFormLocalCompleted,
  type TourHotelCcFormLinkedTodo,
  type TourHotelCcStatus,
} from '@/lib/tourHotelCcFormTodo'
import {
  useTourHotelCcFormQueue,
  type TourHotelCcFormQueueRow,
} from '@/hooks/useTourHotelCcFormQueue'
import { useTodoPanelAutoComplete } from '@/hooks/useTodoPanelAutoComplete'
import { getTodoPanelAutoCompleteMode } from '@/lib/todoPanelAutoComplete'

type TourHotelCcFormPanelProps = {
  locale: string
  variant?: 'panel' | 'list'
  className?: string
  linkedTodos?: Array<TourHotelCcFormLinkedTodo & { title?: string | null }>
  onToggleLinkedTodo?: (todo: TourHotelCcFormLinkedTodo, completed: boolean) => Promise<void>
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

const EMPTY_LINKED_TODOS: Array<TourHotelCcFormLinkedTodo & { title?: string | null }> = []

function formatShortDate(raw: string): string {
  if (!raw) return '—'
  const parts = raw.split('-')
  if (parts.length !== 3) return raw
  const month = Number(parts[1])
  const day = Number(parts[2])
  if (!month || !day) return raw
  return `${month}/${day}`
}

export function TourHotelCcFormPanel({
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
}: TourHotelCcFormPanelProps) {
  const isKo = locale === 'ko'
  const isList = variant === 'list'
  const { user } = useAuth()
  const completionDateKey = useMemo(() => tourHotelCcFormCompletionDateKey(), [])
  const { rows, loading, error, reload, targetCheckIn, setRows } =
    useTourHotelCcFormQueue(queryEnabled)
  const linkedTodo = findTourHotelCcFormLinkedTodo(linkedTodos)

  const [localCompleted, setLocalCompleted] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    setLocalCompleted(readTourHotelCcFormLocalCompleted(completionDateKey))
  }, [completionDateKey])

  const completed = linkedTodo?.completed ?? localCompleted

  const doneCount = useMemo(
    () => rows.filter((r) => isTourHotelCcFormRowDone(r)).length,
    [rows]
  )

  const progressLabel =
    rows.length > 0
      ? isKo
        ? `체크인 ${formatShortDate(targetCheckIn)} · 완료 ${doneCount}/${rows.length}`
        : `Check-in ${formatShortDate(targetCheckIn)} · done ${doneCount}/${rows.length}`
      : isKo
        ? `체크인 ${formatShortDate(targetCheckIn)} · 0건`
        : `Check-in ${formatShortDate(targetCheckIn)} · 0`

  const setPanelCompleted = useCallback(
    async (next: boolean) => {
      if (next === completed) return
      setCompleting(true)
      try {
        if (linkedTodo && onToggleLinkedTodo) {
          await onToggleLinkedTodo(linkedTodo, next)
        } else {
          writeTourHotelCcFormLocalCompleted(next, completionDateKey)
          setLocalCompleted(next)
        }
        onCompletedChange?.(next)
      } finally {
        setCompleting(false)
      }
    },
    [completed, linkedTodo, onToggleLinkedTodo, onCompletedChange, completionDateKey]
  )

  const handleToggleComplete = useCallback(async () => {
    await setPanelCompleted(!completed)
  }, [completed, setPanelCompleted])

  useTodoPanelAutoComplete({
    enabled: queryEnabled,
    loading,
    workCount: rows.length - doneCount,
    completed,
    onHold,
    mode: getTodoPanelAutoCompleteMode('tour-hotel-cc-form'),
    applyCompleted: setPanelCompleted,
  })

  const patchRow = useCallback(
    (id: string, patch: Partial<TourHotelCcFormQueueRow>) => {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    },
    [setRows]
  )

  const handleCcChange = useCallback(
    async (row: TourHotelCcFormQueueRow, nextCc: TourHotelCcStatus) => {
      if (row.cc === nextCc || busyId === row.id) return
      const prevCc = row.cc
      const prevConfirmedAt = row.name_change_confirmed_at
      const prevConfirmedBy = row.name_change_confirmed_by
      const clearNameConfirm = nextCc !== 'sent'
      setBusyId(row.id)
      patchRow(row.id, {
        cc: nextCc,
        ...(clearNameConfirm
          ? { name_change_confirmed_at: null, name_change_confirmed_by: null }
          : {}),
      })
      try {
        const { error: updateError } = await supabase
          .from('tour_hotel_bookings')
          .update({
            cc: nextCc,
            ...(clearNameConfirm
              ? { name_change_confirmed_at: null, name_change_confirmed_by: null }
              : {}),
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id)
        if (updateError) throw updateError
      } catch (e) {
        console.error('TourHotelCcFormPanel cc update', e)
        patchRow(row.id, {
          cc: prevCc,
          name_change_confirmed_at: prevConfirmedAt,
          name_change_confirmed_by: prevConfirmedBy,
        })
        alert(isKo ? 'CC 상태 저장에 실패했습니다.' : 'Failed to update CC status.')
      } finally {
        setBusyId(null)
      }
    },
    [busyId, isKo, patchRow]
  )

  const handleToggleNameConfirm = useCallback(
    async (row: TourHotelCcFormQueueRow) => {
      if (normalizeTourHotelCcStatus(row.cc) !== 'sent') return
      if (busyId === row.id) return
      const nextConfirmed = !row.name_change_confirmed_at
      const prevAt = row.name_change_confirmed_at
      const prevBy = row.name_change_confirmed_by
      const confirmedAt = nextConfirmed ? new Date().toISOString() : null
      const confirmedBy = nextConfirmed ? user?.email?.trim() || null : null
      setBusyId(row.id)
      patchRow(row.id, {
        name_change_confirmed_at: confirmedAt,
        name_change_confirmed_by: confirmedBy,
      })
      try {
        const { error: updateError } = await supabase
          .from('tour_hotel_bookings')
          .update({
            name_change_confirmed_at: confirmedAt,
            name_change_confirmed_by: confirmedBy,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id)
        if (updateError) throw updateError
      } catch (e) {
        console.error('TourHotelCcFormPanel name confirm', e)
        patchRow(row.id, {
          name_change_confirmed_at: prevAt,
          name_change_confirmed_by: prevBy,
        })
        alert(
          isKo
            ? '이름 변경 확인 저장에 실패했습니다. DB 마이그레이션 적용 여부를 확인해 주세요.'
            : 'Failed to save name-change confirmation. Check that the DB migration is applied.'
        )
      } finally {
        setBusyId(null)
      }
    },
    [busyId, isKo, patchRow, user?.email]
  )

  return (
    <div
      className={
        isList
          ? className
          : `w-full rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/70 to-white p-3 shadow-sm ${completed ? 'opacity-80' : ''}`
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
                {tourHotelCcFormPanelTitle(locale)}
              </p>
              {isList ? (
                <span className="shrink-0 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-800">
                  {isKo ? '일일' : 'Daily'}
                </span>
              ) : null}
              <span className="shrink-0 text-[10px] font-medium text-violet-800">{progressLabel}</span>
            </div>
            <button
              type="button"
              onClick={() => void reload()}
              className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-violet-800"
              title={isKo ? '목록 새로고침' : 'Refresh list'}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="mt-0.5 text-[10px] leading-snug text-gray-500">
            {isKo
              ? '다음날 체크인 확정 호텔 · CC 발송 후 호텔에 전화해 이름 변경 확인'
              : 'Confirmed hotels checking in tomorrow · After CC, call hotel to confirm name change'}
          </p>
        </div>
      </div>

      <div className="mt-2 space-y-1.5">
        {loading ? (
          <div className="flex items-center gap-2 py-3 text-xs text-gray-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {isKo ? '호텔 부킹 불러오는 중…' : 'Loading hotel bookings…'}
          </div>
        ) : error ? (
          <p className="rounded-md border border-dashed border-red-200 bg-red-50/60 py-3 text-center text-[11px] text-red-700">
            {isKo ? '호텔 부킹을 불러오지 못했습니다.' : 'Failed to load hotel bookings.'}
          </p>
        ) : rows.length === 0 ? (
          <p className="rounded-md border border-dashed border-gray-200 bg-white/60 py-3 text-center text-[11px] text-gray-500">
            {isKo
              ? `${formatShortDate(targetCheckIn)} 체크인 확정 호텔이 없습니다.`
              : `No confirmed hotels checking in on ${formatShortDate(targetCheckIn)}.`}
          </p>
        ) : (
          rows.map((row) => {
            const rowDone = isTourHotelCcFormRowDone(row)
            const nameConfirmed = Boolean(row.name_change_confirmed_at)
            const canConfirmName = row.cc === 'sent'
            const rowBusy = busyId === row.id
            const tourLabel = row.tour_name || '—'
            return (
              <div
                key={row.id}
                className={[
                  'rounded-md border p-2',
                  tourHotelCcFormRowBorderClassName(row),
                  completed ? 'opacity-70' : '',
                ].join(' ')}
              >
                <div className="flex items-start gap-1.5">
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-[11px] font-medium leading-snug ${
                        rowDone ? 'text-gray-500' : 'text-gray-900'
                      }`}
                      title={`${row.hotel} · ${row.reservation_name}`}
                    >
                      <span className="tabular-nums">{formatShortDate(row.check_in_date)}</span>
                      <span className="text-gray-400"> · </span>
                      <span>{row.hotel}</span>
                      {row.city ? (
                        <span className="text-gray-500"> ({row.city})</span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] text-gray-600">
                      <span className="font-medium text-gray-800">
                        {row.reservation_name || '—'}
                      </span>
                      {row.rn_number ? (
                        <>
                          <span className="text-gray-400"> · </span>
                          <span className="font-mono">RN {row.rn_number}</span>
                        </>
                      ) : null}
                      <span className="text-gray-400"> · </span>
                      <span>
                        {tourLabel}
                        {row.tour_date
                          ? ` (${formatShortDate(row.tour_date)})`
                          : ''}
                      </span>
                      {row.rooms > 1 ? (
                        <>
                          <span className="text-gray-400"> · </span>
                          <span>×{row.rooms}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  {row.tour_id && onOpenTourDetail ? (
                    <button
                      type="button"
                      onClick={() => onOpenTourDetail(row.tour_id!)}
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                      title={isKo ? '투어 상세' : 'Tour detail'}
                      aria-label={isKo ? '투어 상세' : 'Tour detail'}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <label className="sr-only" htmlFor={`cc-status-${row.id}`}>
                    {isKo ? 'CC 상태' : 'CC status'}
                  </label>
                  <select
                    id={`cc-status-${row.id}`}
                    value={row.cc}
                    disabled={rowBusy}
                    onChange={(e) =>
                      void handleCcChange(row, normalizeTourHotelCcStatus(e.target.value))
                    }
                    className={`h-7 max-w-[9.5rem] rounded-md border px-1.5 text-[10px] font-medium outline-none focus:ring-2 focus:ring-violet-300 disabled:opacity-60 ${tourHotelCcStatusClassName(row.cc)}`}
                  >
                    {TOUR_HOTEL_CC_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {isKo ? opt.labelKo : opt.labelEn}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    disabled={!canConfirmName || rowBusy}
                    onClick={() => void handleToggleNameConfirm(row)}
                    className={[
                      'inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] font-medium transition-colors',
                      nameConfirmed
                        ? 'border-emerald-300 bg-emerald-100 text-emerald-900 hover:bg-emerald-50'
                        : canConfirmName
                          ? 'border-sky-300 bg-white text-sky-800 hover:bg-sky-50'
                          : 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400',
                    ].join(' ')}
                    title={
                      !canConfirmName
                        ? isKo
                          ? 'CC 발송 완료 후 이름 변경을 확인할 수 있습니다'
                          : 'Confirm name change after CC is sent'
                        : nameConfirmed
                          ? isKo
                            ? '이름 변경 확인 취소'
                            : 'Clear name-change confirmation'
                          : isKo
                            ? '호텔 전화로 예약자 이름 변경 확인 후 클릭'
                            : 'Click after confirming name change by phone with hotel'
                    }
                  >
                    {rowBusy ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : nameConfirmed ? (
                      <BadgeCheck className="h-3 w-3" />
                    ) : (
                      <Phone className="h-3 w-3" />
                    )}
                    {nameConfirmed
                      ? isKo
                        ? '이름 변경 확인됨'
                        : 'Name confirmed'
                      : isKo
                        ? '이름 변경 확인'
                        : 'Confirm name'}
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
