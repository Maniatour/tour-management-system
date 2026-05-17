'use client'

import React, { useMemo, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { X, Mail, ClipboardCheck, Plane, MapPin, XCircle, PhoneForwarded, Globe } from 'lucide-react'
import type { Reservation, Customer } from '@/types/reservation'
import type { ReservationFollowUpPipelineSnapshot } from '@/lib/reservationFollowUpPipeline'
import {
  reservationNeedsConfirmationMail,
  reservationNeedsResidentPipelineAttention,
  reservationExcludedFromFollowUpPipeline,
  reservationNeedsAnyFollowUpAttention,
  reservationNeedsCancelFollowUpQueueAttention,
  followUpModalMatchesDepartureTab,
  followUpModalMatchesPickupTab,
  reservationEligibleForCancelFollowUpQueue,
  reservationCancellationGroupingDateKey,
} from '@/lib/reservationFollowUpPipeline'
import {
  getCustomerName,
  isReservationTourDatePastLocal,
  lasVegasCalendarDateKeyToday,
} from '@/utils/reservationUtils'

export type FollowUpQueueTabId = 'confirm' | 'resident' | 'departure' | 'pickup' | 'cancel'

export type CancelFollowUpManualKind = 'cancel_follow_up' | 'cancel_rebooking'

export interface ReservationFollowUpQueueModalProps {
  isOpen: boolean
  onClose: () => void
  /** 운영 큐용 전역 목록을 처음 채우는 동안(스냅샷 없음) */
  bulkReservationsLoading?: boolean
  /** 첫 청크 이후 나머지 예약을 이어 받는 동안 */
  bulkReservationsSyncing?: boolean
  reservations: Reservation[]
  /** 탭 목록 정렬용 */
  customers: Customer[]
  snapshotsByReservationId: Map<string, ReservationFollowUpPipelineSnapshot>
  loadingSnapshots: boolean
  /** 예약 관리 간단 카드와 동일한 `ReservationCardItem` 트리 */
  renderSimpleReservationCard: (reservation: Reservation) => React.ReactNode
  /** 취소 탭: 수동 완료 토글 저장 */
  onCancelFollowUpManualChange?: (
    reservationId: string,
    kind: CancelFollowUpManualKind,
    action: 'mark' | 'clear'
  ) => void | Promise<void>
}

function tabFilter(
  tab: FollowUpQueueTabId,
  reservation: Reservation,
  status: string | undefined,
  snap: ReservationFollowUpPipelineSnapshot | undefined
): boolean {
  if (tab === 'cancel') {
    return reservationEligibleForCancelFollowUpQueue(status, reservation.tourDate)
  }
  if (!snap) return false
  switch (tab) {
    case 'confirm':
      return reservationNeedsConfirmationMail(status, snap)
    case 'resident':
      return reservationNeedsResidentPipelineAttention(status, snap)
    case 'departure':
      return followUpModalMatchesDepartureTab(status, snap)
    case 'pickup':
      return followUpModalMatchesPickupTab(
        reservation.tourDate,
        reservation.tourTime,
        status,
        snap
      )
    default:
      return false
  }
}

function CancelFollowUpToolbarForReservation({
  reservation,
  snap,
  saving,
  uiLocale,
  onToggle,
}: {
  reservation: Reservation
  snap: ReservationFollowUpPipelineSnapshot | undefined
  saving: boolean
  uiLocale: string
  onToggle: (kind: CancelFollowUpManualKind, action: 'mark' | 'clear') => void
}) {
  const t = useTranslations('reservations.followUpPipeline')
  const fu = snap?.cancelFollowUpManual ?? false
  const re = snap?.cancelRebookingOutreachManual ?? false
  const key = reservationCancellationGroupingDateKey(reservation)
  const approxLabel =
    key === 'unknown'
      ? '—'
      : new Date(key + 'T12:00:00').toLocaleDateString(uiLocale === 'en' ? 'en-US' : 'ko-KR', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })

  const btnClass = (done: boolean) =>
    `inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border text-sm transition-colors disabled:opacity-50 ${
      done
        ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
        : 'border-gray-200 bg-white text-gray-400 hover:border-amber-300 hover:bg-amber-50/60 hover:text-amber-900'
    }`

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/90 px-2 py-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{t('cancelToolbarLabel')}</span>
      <button
        type="button"
        disabled={saving}
        title={t('cancelFollowUpIconTitle')}
        aria-label={t('cancelFollowUpIconTitle')}
        aria-pressed={fu}
        className={btnClass(fu)}
        onClick={() => onToggle('cancel_follow_up', fu ? 'clear' : 'mark')}
      >
        <PhoneForwarded className="h-3 w-3" aria-hidden />
      </button>
      <button
        type="button"
        disabled={saving}
        title={t('cancelRebookingIconTitle')}
        aria-label={t('cancelRebookingIconTitle')}
        aria-pressed={re}
        className={btnClass(re)}
        onClick={() => onToggle('cancel_rebooking', re ? 'clear' : 'mark')}
      >
        <Globe className="h-3 w-3" aria-hidden />
      </button>
      <span className="min-w-0 flex-1 text-[11px] text-slate-600">
        <span className="font-medium text-slate-700">{t('cancelDateApproxLabel')}:</span> {approxLabel}
      </span>
    </div>
  )
}

export default function ReservationFollowUpQueueModal({
  isOpen,
  onClose,
  bulkReservationsLoading = false,
  bulkReservationsSyncing = false,
  reservations,
  customers,
  snapshotsByReservationId,
  loadingSnapshots,
  renderSimpleReservationCard,
  onCancelFollowUpManualChange,
}: ReservationFollowUpQueueModalProps) {
  const tp = useTranslations('reservations.followUpPipeline')
  const uiLocale = useLocale()
  const [tab, setTab] = useState<FollowUpQueueTabId>('confirm')
  const [savingCancelId, setSavingCancelId] = useState<string | null>(null)

  const tabs = useMemo(
    () =>
      [
        { id: 'confirm' as const, Icon: Mail, label: tp('tabConfirm') },
        { id: 'resident' as const, Icon: ClipboardCheck, label: tp('tabResident') },
        { id: 'departure' as const, Icon: Plane, label: tp('tabDeparture') },
        { id: 'pickup' as const, Icon: MapPin, label: tp('tabPickup') },
        { id: 'cancel' as const, Icon: XCircle, label: tp('tabCancel') },
      ] as const,
    [tp]
  )

  const { rows, counts, cancelGrouped } = useMemo(() => {
    const counts = {
      confirm: 0,
      resident: 0,
      departure: 0,
      pickup: 0,
      cancel: 0,
    }
    for (const r of reservations) {
      const st = r.status as string | undefined
      if (reservationEligibleForCancelFollowUpQueue(st, r.tourDate)) {
        counts.cancel += 1
      }
      if (isReservationTourDatePastLocal(r.tourDate)) continue
      if (reservationExcludedFromFollowUpPipeline(st)) continue
      const snap = snapshotsByReservationId.get(r.id)
      if (!snap) continue
      if (reservationNeedsConfirmationMail(st, snap)) counts.confirm += 1
      if (reservationNeedsResidentPipelineAttention(st, snap)) counts.resident += 1
      if (followUpModalMatchesDepartureTab(st, snap)) counts.departure += 1
      if (followUpModalMatchesPickupTab(r.tourDate, r.tourTime, st, snap)) counts.pickup += 1
    }

    if (tab === 'cancel') {
      const filtered = reservations.filter((r) =>
        reservationEligibleForCancelFollowUpQueue(r.status as string | undefined, r.tourDate)
      )
      const byDate = new Map<string, Reservation[]>()
      for (const r of filtered) {
        const key = reservationCancellationGroupingDateKey(r)
        const arr = byDate.get(key) ?? []
        arr.push(r)
        byDate.set(key, arr)
      }
      const todayYmd = lasVegasCalendarDateKeyToday()
      const dayDistance = (ymd: string): number => {
        if (ymd === 'unknown') return 999999
        const d = new Date(ymd + 'T12:00:00').getTime()
        const t = new Date(todayYmd + 'T12:00:00').getTime()
        return Math.abs(Math.round((d - t) / 86400000))
      }
      const sortedKeys = [...byDate.keys()].sort((a, b) => {
        const da = dayDistance(a)
        const db = dayDistance(b)
        if (da !== db) return da - db
        return b.localeCompare(a)
      })
      for (const k of sortedKeys) {
        const arr = byDate.get(k)
        if (!arr) continue
        arr.sort((a, b) => {
          const da = String(a.tourDate ?? '')
          const db = String(b.tourDate ?? '')
          if (da !== db) return da.localeCompare(db)
          return getCustomerName(a.customerId, customers).localeCompare(
            getCustomerName(b.customerId, customers)
          )
        })
      }
      return { rows: filtered, counts, cancelGrouped: { sortedKeys, byDate } }
    }

    const filtered = reservations.filter((r) => {
      if (isReservationTourDatePastLocal(r.tourDate)) return false
      const st = r.status as string | undefined
      if (reservationExcludedFromFollowUpPipeline(st)) return false
      const snap = snapshotsByReservationId.get(r.id)
      if (!snap) return false
      return tabFilter(tab, r, st, snap)
    })
    filtered.sort((a, b) => {
      const da = String(a.tourDate ?? '')
      const db = String(b.tourDate ?? '')
      if (da !== db) return da.localeCompare(db)
      return getCustomerName(a.customerId, customers).localeCompare(getCustomerName(b.customerId, customers))
    })
    return { rows: filtered, counts, cancelGrouped: null as null }
  }, [reservations, snapshotsByReservationId, tab, customers])

  const activeNeedUnion = useMemo(() => {
    let n = 0
    for (const r of reservations) {
      if (isReservationTourDatePastLocal(r.tourDate)) continue
      const snap = snapshotsByReservationId.get(r.id)
      if (
        reservationNeedsCancelFollowUpQueueAttention(r.status as string | undefined, r.tourDate, snap)
      ) {
        n += 1
        continue
      }
      if (reservationNeedsAnyFollowUpAttention(r.status as string | undefined, snap)) n += 1
    }
    return n
  }, [reservations, snapshotsByReservationId])

  const handleCancelToggle = async (reservationId: string, kind: CancelFollowUpManualKind, action: 'mark' | 'clear') => {
    if (!onCancelFollowUpManualChange) return
    setSavingCancelId(reservationId)
    try {
      await onCancelFollowUpManualChange(reservationId, kind, action)
    } finally {
      setSavingCancelId(null)
    }
  }

  if (!isOpen) return null

  if (bulkReservationsLoading) {
    const loadingMsg =
      uiLocale === 'en' ? 'Loading all reservations for follow-up…' : 'Follow up 큐용 전체 예약을 불러오는 중…'
    return (
      <div
        className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <div
          className="flex flex-col items-center gap-3 rounded-xl bg-white px-8 py-10 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
          <p className="text-center text-sm text-gray-700">{loadingMsg}</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-7xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {bulkReservationsSyncing && (
          <div
            role="status"
            className="flex shrink-0 items-center gap-2 border-b border-teal-100 bg-teal-50 px-4 py-2 text-xs text-teal-900"
          >
            <div className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
            <span>
              {uiLocale === 'en'
                ? 'Loading more reservations in the background…'
                : '나머지 예약을 불러오는 중… (목록은 계속 사용할 수 있습니다)'}
            </span>
          </div>
        )}
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 bg-gradient-to-r from-slate-700 to-teal-800 px-4 py-3 text-white">
          <div>
            <h2 className="text-lg font-semibold">{tp('modalTitle')}</h2>
            <p className="mt-0.5 text-xs text-teal-100/90">{tp('modalSubtitle')}</p>
            <p className="mt-1 text-[11px] text-teal-100/80">
              {loadingSnapshots ? tp('loadingSnapshots') : tp('unionBadge', { count: activeNeedUnion })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-white/90 hover:bg-white/10"
            aria-label={tp('close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-gray-100 bg-gray-50 px-2 pt-2">
          {tabs.map(({ id, Icon, label }) => {
            const c =
              id === 'confirm'
                ? counts.confirm
                : id === 'resident'
                  ? counts.resident
                  : id === 'departure'
                    ? counts.departure
                    : id === 'pickup'
                      ? counts.pickup
                      : counts.cancel
            const active = tab === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-white text-teal-900 shadow-sm ring-1 ring-gray-200'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>{label}</span>
                <span
                  className={`tabular-nums rounded-full px-1.5 py-0.5 text-[10px] ${
                    active ? 'bg-teal-100 text-teal-900' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {c}
                </span>
              </button>
            )
          })}
        </div>

        <div className="min-h-[200px] flex-1 overflow-y-auto p-3 md:p-4">
          <p className="mb-3 text-xs text-gray-600">
            {tab === 'confirm' && tp('tabHint_confirm')}
            {tab === 'resident' && tp('tabHint_resident')}
            {tab === 'departure' && tp('tabHint_departure')}
            {tab === 'pickup' && tp('tabHint_pickup')}
            {tab === 'cancel' && tp('tabHint_cancel')}
          </p>
          {loadingSnapshots && tab !== 'cancel' ? (
            <div className="py-12 text-center text-sm text-gray-500">{tp('loadingSnapshots')}</div>
          ) : tab === 'cancel' && cancelGrouped ? (
            cancelGrouped.sortedKeys.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-500">{tp('emptyTab')}</div>
            ) : (
              <div className="space-y-8">
                {cancelGrouped.sortedKeys.map((dateKey) => {
                  const groupRows = cancelGrouped.byDate.get(dateKey) ?? []
                  const header =
                    dateKey === 'unknown'
                      ? tp('cancelGroupUnknown')
                      : new Date(dateKey + 'T12:00:00').toLocaleDateString(uiLocale === 'en' ? 'en-US' : 'ko-KR', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                  return (
                    <section key={dateKey}>
                      <h3 className="mb-3 border-b border-gray-200 pb-1 text-sm font-semibold text-gray-800">
                        {tp('cancelGroupHeading')}: {header}
                        <span className="ml-2 font-normal text-gray-500">({groupRows.length})</span>
                      </h3>
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                        {groupRows.map((r) => (
                          <div key={r.id} className="min-w-0">
                            <CancelFollowUpToolbarForReservation
                              reservation={r}
                              snap={snapshotsByReservationId.get(r.id)}
                              saving={savingCancelId === r.id}
                              uiLocale={uiLocale}
                              onToggle={(kind, action) => void handleCancelToggle(r.id, kind, action)}
                            />
                            {renderSimpleReservationCard(r)}
                          </div>
                        ))}
                      </div>
                    </section>
                  )
                })}
              </div>
            )
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">{tp('emptyTab')}</div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((r) => (
                <div key={r.id} className="min-w-0">
                  {renderSimpleReservationCard(r)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
