'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Car, Loader2, MapPin, Plane, RefreshCw, Send } from 'lucide-react'
import { TodoPanelStatusButtons } from '@/components/admin/todo/TodoPanelStatusButtons'
import { TodoPanelTourStatusButtons } from '@/components/admin/todo/TodoPanelTourStatusButtons'
import { RentalCarPickupDropoffSmsModal } from '@/components/admin/todo/RentalCarPickupDropoffSmsModal'
import {
  findRentalCarPickupDropoffLinkedTodo,
  rentalCarPickupDropoffCompletionDateKey,
  rentalCarPickupDropoffPanelTitle,
  readRentalCarPickupDropoffLocalCompleted,
  writeRentalCarPickupDropoffLocalCompleted,
  type RentalCarPickupDropoffLinkedTodo,
} from '@/lib/rentalCarPickupDropoffTodo'
import {
  countTodoPanelTourProgress,
  getTodoPanelTourStatus,
  todoPanelTourRowClassName,
  type TodoPanelTourItemState,
} from '@/lib/todoPanelTourCompletion'
import { useTodoPanelTourCompletion } from '@/hooks/useTodoPanelTourCompletion'
import { useRentalCarPickupDropoffQueue } from '@/hooks/useRentalCarPickupDropoffQueue'
import { useTodoPanelAutoComplete } from '@/hooks/useTodoPanelAutoComplete'
import {
  getTodoPanelAutoCompleteMode,
  todoPanelPendingTourCount,
} from '@/lib/todoPanelAutoComplete'
import { formatStaffNames, type RentalCarPickupDropoffCard } from '@/lib/rentalCarPickupDropoffQueue'
import type { RentalCarPickupDropoffSmsKind } from '@/lib/rentalCarPickupDropoffSms'
import { supabase } from '@/lib/supabase'

type RentalCarPickupDropoffPanelProps = {
  locale: string
  variant?: 'panel' | 'list'
  className?: string
  linkedTodos?: Array<RentalCarPickupDropoffLinkedTodo & { title?: string | null }>
  onToggleLinkedTodo?: (todo: RentalCarPickupDropoffLinkedTodo, completed: boolean) => Promise<void>
  onCompletedChange?: (completed: boolean) => void
  onEditRequest?: () => void
  onHold?: boolean
  holdEnabled?: boolean
  onToggleHold?: () => void
  holdBusy?: boolean
  holdDisabledHint?: string
  queryEnabled?: boolean
}

const EMPTY_LINKED_TODOS: Array<RentalCarPickupDropoffLinkedTodo & { title?: string | null }> = []

function formatShortDate(raw: string | null | undefined): string {
  if (!raw) return '—'
  const parts = raw.split('-')
  if (parts.length !== 3) return raw
  return `${Number(parts[1])}/${Number(parts[2])}`
}

function VehicleCard({
  card,
  locale,
  status,
  teamOptions,
  continuingId,
  onSetStatus,
  onReservedByChange,
  onSelectContinuing,
  onOpenSms,
}: {
  card: RentalCarPickupDropoffCard
  locale: string
  status: TodoPanelTourItemState
  teamOptions: Array<{ email: string; displayName: string }>
  continuingId: string
  onSetStatus: (next: TodoPanelTourItemState) => void
  onReservedByChange: (email: string) => void
  onSelectContinuing: (vehicleId: string) => void
  onOpenSms: (kind: RentalCarPickupDropoffSmsKind) => void
}) {
  const isKo = locale === 'ko'
  const lastUsers = formatStaffNames([card.lastTour?.guide, card.lastTour?.assistant])
  const location = card.kind === 'pickup' ? card.pickupLocation : card.returnLocation

  return (
    <div className={`rounded-md border p-2 ${todoPanelTourRowClassName(status)}`}>
      <div className="flex items-start gap-1.5">
        <TodoPanelTourStatusButtons locale={locale} status={status} onSetStatus={onSetStatus} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Car className="h-3.5 w-3.5 shrink-0 text-sky-700" aria-hidden />
            <p className="truncate text-[12px] font-semibold text-gray-900">{card.vehicleLabel}</p>
            <span
              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                card.kind === 'pickup' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-900'
              }`}
            >
              {card.kind === 'pickup' ? (isKo ? '픽업' : 'Pickup') : isKo ? '반납' : 'Return'}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
            {[card.rentalCompany, `${formatShortDate(card.startDate)}–${formatShortDate(card.endDate)}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {location ? (
            <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{location}</span>
            </p>
          ) : null}

          {card.kind === 'pickup' ? (
            <label className="mt-1.5 block">
              <span className="text-[10px] font-medium text-gray-600">
                {isKo ? '예약자 / 픽업 담당' : 'Reserved by'}
              </span>
              <select
                value={card.reservedByEmail || ''}
                onChange={(e) => onReservedByChange(e.target.value)}
                className="mt-0.5 h-8 w-full rounded-lg border border-input bg-white px-2 text-[11px]"
              >
                <option value="">{isKo ? '팀원 선택' : 'Select teammate'}</option>
                {teamOptions.map((member) => (
                  <option key={member.email} value={member.email}>
                    {member.displayName}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="mt-1.5 text-[10px] text-gray-700">
              <span className="font-medium">{isKo ? '마지막 사용자' : 'Last users'}:</span>{' '}
              {lastUsers || (isKo ? '배정된 가이드/드라이버 없음' : 'No assigned guide/driver')}
              {card.lastTour ? ` · ${card.lastTour.productName}` : ''}
            </p>
          )}

          {card.kind === 'return' && card.continuingCrews.length > 0 ? (
            <div className="mt-1.5 rounded-md border border-sky-200 bg-sky-50/70 p-1.5">
              <p className="text-[10px] font-medium text-sky-900">
                {card.lastTour?.isNightGoblin
                  ? isKo
                    ? '밤도깨비: 계속 사용 차량 팀에 공항 픽업 요청'
                    : 'Night Goblin: ask continuing crew to pick up at airport rental'
                  : isKo
                    ? '계속 사용 차량 팀에 공항 픽업 요청'
                    : 'Ask continuing crew to pick up at airport rental'}
              </p>
              {card.continuingCrews.length > 1 ? (
                <select
                  value={continuingId}
                  onChange={(e) => onSelectContinuing(e.target.value)}
                  className="mt-1 h-7 w-full rounded-md border border-sky-200 bg-white px-2 text-[10px]"
                >
                  {card.continuingCrews.map((crew) => (
                    <option key={crew.vehicleId} value={crew.vehicleId}>
                      {crew.vehicleLabel} · {formatStaffNames([crew.tour.guide, crew.tour.assistant])}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="mt-0.5 text-[10px] text-sky-800">
                  {card.continuingCrews[0]?.vehicleLabel} ·{' '}
                  {formatStaffNames([
                    card.continuingCrews[0]?.tour.guide,
                    card.continuingCrews[0]?.tour.assistant,
                  ])}
                </p>
              )}
            </div>
          ) : null}

          <div className="mt-1.5 flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => onOpenSms(card.kind)}
              className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2 text-[10px] font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Send className="h-3 w-3" />
              {card.kind === 'pickup'
                ? isKo
                  ? '픽업 안내'
                  : 'Pickup SMS'
                : isKo
                  ? '반납 안내'
                  : 'Return SMS'}
            </button>
            {card.kind === 'return' && card.continuingCrews.length > 0 ? (
              <button
                type="button"
                onClick={() => onOpenSms('airport_shuttle')}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-sky-300 bg-white px-2 text-[10px] font-medium text-sky-800 hover:bg-sky-50"
              >
                <Plane className="h-3 w-3" />
                {isKo ? '공항 픽업 요청' : 'Airport pickup'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export function RentalCarPickupDropoffPanel({
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
}: RentalCarPickupDropoffPanelProps) {
  const isKo = locale === 'ko'
  const isList = variant === 'list'
  const completionDateKey = useMemo(() => rentalCarPickupDropoffCompletionDateKey(), [])
  const { pickups, returns, teamOptions, loading, error, reload, today } =
    useRentalCarPickupDropoffQueue(queryEnabled, locale)
  const { tourState, setTourStatus } = useTodoPanelTourCompletion(
    'rental-car-pickup-dropoff',
    completionDateKey
  )
  const linkedTodo = findRentalCarPickupDropoffLinkedTodo(linkedTodos)

  const [localCompleted, setLocalCompleted] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [smsCard, setSmsCard] = useState<RentalCarPickupDropoffCard | null>(null)
  const [smsKind, setSmsKind] = useState<RentalCarPickupDropoffSmsKind>('pickup')
  const [continuingByReturnId, setContinuingByReturnId] = useState<Record<string, string>>({})

  const rows = useMemo(() => [...pickups, ...returns], [pickups, returns])

  useEffect(() => {
    setLocalCompleted(readRentalCarPickupDropoffLocalCompleted(completionDateKey))
  }, [completionDateKey])

  const completed = linkedTodo?.completed ?? localCompleted
  const progress = useMemo(
    () => countTodoPanelTourProgress(rows.map((r) => r.itemId), tourState),
    [rows, tourState]
  )

  const setPanelCompleted = useCallback(
    async (next: boolean) => {
      if (next === completed) return
      setCompleting(true)
      try {
        if (linkedTodo && onToggleLinkedTodo) {
          await onToggleLinkedTodo(linkedTodo, next)
        } else {
          writeRentalCarPickupDropoffLocalCompleted(next, completionDateKey)
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
    workCount: todoPanelPendingTourCount(progress),
    completed,
    onHold,
    mode: getTodoPanelAutoCompleteMode('rental-car-pickup-dropoff'),
    applyCompleted: setPanelCompleted,
  })

  const handleReservedByChange = useCallback(
    async (vehicleId: string, email: string) => {
      const { error: updateError } = await supabase
        .from('vehicles')
        .update({ rental_reserved_by: email || null })
        .eq('id', vehicleId)
      if (updateError) {
        alert(isKo ? '예약자 저장에 실패했습니다.' : 'Failed to save reserved-by.')
        return
      }
      await reload()
    },
    [isKo, reload]
  )

  const progressLabel =
    progress.onHold > 0
      ? isKo
        ? `${progress.done}/${progress.total} · 보류 ${progress.onHold}`
        : `${progress.done}/${progress.total} · hold ${progress.onHold}`
      : isKo
        ? `${progress.done}/${progress.total}`
        : `${progress.done}/${progress.total}`

  const dateLabel = formatShortDate(today)

  return (
    <>
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
                <Car className="h-3.5 w-3.5 shrink-0 text-sky-700" aria-hidden />
                <p
                  className={`min-w-0 text-[13px] font-semibold leading-snug ${
                    completed ? 'text-gray-400 line-through' : onHold ? 'text-amber-900' : 'text-gray-900'
                  }`}
                >
                  {rentalCarPickupDropoffPanelTitle(locale)}
                </p>
                {isList ? (
                  <span className="shrink-0 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-800">
                    {isKo ? '일일' : 'Daily'}
                  </span>
                ) : null}
                <span className="shrink-0 text-[10px] text-gray-500">{dateLabel}</span>
                {rows.length > 0 ? (
                  <span className="shrink-0 text-[10px] font-medium text-sky-700">{progressLabel}</span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void reload()}
                className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-sky-700"
                title={isKo ? '새로고침' : 'Refresh'}
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
              {isKo ? '불러오는 중…' : 'Loading…'}
            </div>
          ) : error ? (
            <p className="py-2 text-center text-[11px] text-destructive">{error}</p>
          ) : rows.length === 0 ? (
            <p className="rounded-md border border-dashed border-gray-200 bg-white/60 py-3 text-center text-[11px] text-gray-500">
              {isKo ? '오늘 픽업·반납할 렌터카가 없습니다.' : 'No rental pickups or returns today.'}
            </p>
          ) : (
            <>
              {pickups.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800">
                    {isKo ? `오늘 픽업 ${pickups.length}` : `Pickup today ${pickups.length}`}
                  </p>
                  {pickups.map((card) => (
                    <VehicleCard
                      key={card.itemId}
                      card={card}
                      locale={locale}
                      status={getTodoPanelTourStatus(card.itemId, tourState)}
                      teamOptions={teamOptions}
                      continuingId=""
                      onSetStatus={(next) => setTourStatus(card.itemId, next)}
                      onReservedByChange={(email) => void handleReservedByChange(card.vehicleId, email)}
                      onSelectContinuing={() => undefined}
                      onOpenSms={(kind) => {
                        setSmsKind(kind)
                        setSmsCard(card)
                      }}
                    />
                  ))}
                </div>
              ) : null}
              {returns.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                    {isKo ? `오늘 반납 ${returns.length}` : `Return today ${returns.length}`}
                  </p>
                  {returns.map((card) => (
                    <VehicleCard
                      key={card.itemId}
                      card={card}
                      locale={locale}
                      status={getTodoPanelTourStatus(card.itemId, tourState)}
                      teamOptions={teamOptions}
                      continuingId={continuingByReturnId[card.vehicleId] || card.continuingCrews[0]?.vehicleId || ''}
                      onSetStatus={(next) => setTourStatus(card.itemId, next)}
                      onReservedByChange={() => undefined}
                      onSelectContinuing={(vehicleId) =>
                        setContinuingByReturnId((prev) => ({ ...prev, [card.vehicleId]: vehicleId }))
                      }
                      onOpenSms={(kind) => {
                        setSmsKind(kind)
                        setSmsCard(card)
                      }}
                    />
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      <RentalCarPickupDropoffSmsModal
        isOpen={Boolean(smsCard)}
        locale={locale}
        kind={smsKind}
        card={smsCard}
        continuingVehicleId={
          smsCard ? continuingByReturnId[smsCard.vehicleId] || smsCard.continuingCrews[0]?.vehicleId : null
        }
        onClose={() => setSmsCard(null)}
        onSent={() => void reload()}
      />
    </>
  )
}
