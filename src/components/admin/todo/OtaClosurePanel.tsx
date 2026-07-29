'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { TodoPanelStatusButtons } from '@/components/admin/todo/TodoPanelStatusButtons'
import { useAuth } from '@/contexts/AuthContext'
import { OtaClosureChannelButton } from '@/components/schedule/OtaClosureChannelButton'
import { OTA_STATUS_META } from '@/lib/otaPriceInventory'
import {
  findOtaClosureLinkedTodo,
  otaClosureCompletionDateKey,
  otaClosurePanelTitle,
  readOtaClosureLocalCompleted,
  writeOtaClosureLocalCompleted,
  type OtaClosureLinkedTodo,
} from '@/lib/otaClosureTodo'
import { useOtaClosureQueue } from '@/hooks/useOtaClosureQueue'

type OtaClosurePanelProps = {
  locale: string
  variant?: 'panel' | 'list'
  className?: string
  linkedTodos?: Array<OtaClosureLinkedTodo & { title?: string | null }>
  onToggleLinkedTodo?: (todo: OtaClosureLinkedTodo, completed: boolean) => Promise<void>
  onCompletedChange?: (completed: boolean) => void
  onEditRequest?: () => void
  onHold?: boolean
  holdEnabled?: boolean
  onToggleHold?: () => void
  holdBusy?: boolean
  holdDisabledHint?: string
  queryEnabled?: boolean
}

const EMPTY_LINKED_TODOS: Array<OtaClosureLinkedTodo & { title?: string | null }> = []

function formatShortTourDate(raw: string): string {
  if (!raw) return '—'
  const parts = raw.split('-')
  if (parts.length !== 3) return raw
  const month = Number(parts[1])
  const day = Number(parts[2])
  if (!month || !day) return raw
  return `${month}/${day}`
}

export function OtaClosurePanel({
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
}: OtaClosurePanelProps) {
  const isKo = locale === 'ko'
  const isList = variant === 'list'
  const { user } = useAuth()
  const completionDateKey = useMemo(() => otaClosureCompletionDateKey(), [])
  const { rows, loading, reload, markSynced, syncingKey, teamMembers, targetDates } =
    useOtaClosureQueue(queryEnabled)
  const linkedTodo = findOtaClosureLinkedTodo(linkedTodos)

  const [localCompleted, setLocalCompleted] = useState(false)
  const [completing, setCompleting] = useState(false)

  useEffect(() => {
    setLocalCompleted(readOtaClosureLocalCompleted(completionDateKey))
  }, [completionDateKey])

  const completed = linkedTodo?.completed ?? localCompleted

  const updaterName = useMemo(() => {
    const email = user?.email
    if (!email) return ''
    const member = teamMembers.find((m) => m.email === email)
    return member?.nick_name || member?.name_ko || email.split('@')[0] || ''
  }, [teamMembers, user?.email])

  const handleToggleComplete = useCallback(async () => {
    const next = !completed
    setCompleting(true)
    try {
      if (linkedTodo && onToggleLinkedTodo) {
        await onToggleLinkedTodo(linkedTodo, next)
        onCompletedChange?.(next)
      } else {
        writeOtaClosureLocalCompleted(next, completionDateKey)
        setLocalCompleted(next)
      }
      onCompletedChange?.(next)
    } finally {
      setCompleting(false)
    }
  }, [completed, linkedTodo, onToggleLinkedTodo, onCompletedChange, completionDateKey])

  const dateRangeLabel = useMemo(() => {
    const [d1, d2] = targetDates
    const fmt = (d: string) => {
      const parts = d.split('-')
      if (parts.length !== 3) return d
      return `${Number(parts[1])}/${Number(parts[2])}`
    }
    return `${fmt(d1)} – ${fmt(d2)}`
  }, [targetDates])

  const pendingActions = useMemo(
    () => rows.reduce((sum, row) => sum + row.closureActions.length, 0),
    [rows]
  )

  const progressLabel = isKo
    ? `미반영 ${pendingActions}건`
    : `${pendingActions} pending`

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
                {otaClosurePanelTitle(locale)}
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
        </div>
      </div>

      <div className="mt-2 space-y-1.5">
        {loading ? (
          <div className="flex items-center gap-2 py-3 text-xs text-gray-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {isKo ? '잔여·매진 일정 불러오는 중…' : 'Loading low/sold-out dates…'}
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-md border border-dashed border-gray-200 bg-white/60 py-3 text-center text-[11px] text-gray-500">
            {isKo
              ? '앞으로 7일 내 OTA 반영이 필요한 일정이 없습니다.'
              : 'No OTA updates needed in the next 7 days.'}
          </p>
        ) : (
          rows.map((row) => {
            const statusMeta = OTA_STATUS_META[row.status]
            const hasMismatch = row.canyonBadges.some((b) => b.mismatch)
            return (
              <div
                key={row.key}
                className={[
                  'rounded-md border border-gray-200/80 bg-white/80 p-1.5',
                  completed ? 'opacity-70' : '',
                ].join(' ')}
              >
                <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
                  <p className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-[11px] font-medium leading-snug text-gray-900">
                    <span className="tabular-nums">{formatShortTourDate(row.date)}</span>
                    <span>{row.productName}</span>
                    <span
                      className={[
                        'inline-flex rounded px-1 py-0.5 text-[10px] font-medium tabular-nums',
                        row.isLowVehicleRemaining
                          ? 'border border-red-300 bg-red-50 font-bold text-red-900'
                          : 'bg-blue-50 text-blue-900',
                      ].join(' ')}
                      title={
                        row.vehicleRemaining != null
                          ? isKo
                            ? `차량 잔여 ${row.vehicleRemaining}석`
                            : `${row.vehicleRemaining} seats left`
                          : undefined
                      }
                    >
                      🚌 {row.totalAssigned} / {row.totalMax}
                      {row.isLowVehicleRemaining && row.vehicleRemaining != null ? (
                        <span className="ml-0.5 text-[9px] font-bold text-red-700">
                          ({isKo ? '잔여' : 'left'} {row.vehicleRemaining})
                        </span>
                      ) : null}
                      {hasMismatch ? ' ⚠️' : ''}
                    </span>
                    {row.canyonBadges.map((badge) => (
                      <span
                        key={badge.key}
                        title={
                          badge.mismatch
                            ? isKo
                              ? '예약 초이스와 입장권 부킹 수가 다릅니다'
                              : 'Choice vs ticket booking mismatch'
                            : isKo
                              ? '예약 초이스 / 입장권 부킹'
                              : 'Choice / ticket booking'
                        }
                        className={[
                          'inline-flex rounded px-1 py-0.5 text-[10px] font-medium tabular-nums',
                          badge.mismatch
                            ? 'border border-amber-300 bg-amber-50 text-amber-950'
                            : 'bg-orange-50 text-orange-900',
                        ].join(' ')}
                      >
                        {badge.text}
                        {badge.mismatch ? ' ⚠️' : ''}
                      </span>
                    ))}
                  </p>
                  <span
                    className={`shrink-0 rounded border px-1 py-0.5 text-[9px] font-semibold leading-none ${statusMeta.badgeClass}`}
                  >
                    {statusMeta.label}
                  </span>
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  {row.closureActions.map((action) => {
                    const syncKey = `${action.listing.id}:${row.key}`
                    return (
                      <OtaClosureChannelButton
                        key={action.listing.id}
                        listing={action.listing}
                        {...(action.faviconUrl ? { faviconUrl: action.faviconUrl } : {})}
                        currentRemaining={action.currentRemaining}
                        saving={syncingKey === syncKey}
                        historyEntries={action.historyEntries}
                        teamMembers={teamMembers}
                        onMarkSynced={() => {
                          void markSynced(row.key, action.listing, user?.email, updaterName)
                        }}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
