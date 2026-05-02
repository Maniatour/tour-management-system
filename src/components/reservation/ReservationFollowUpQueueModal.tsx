'use client'

import React, { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { X, Mail, ClipboardCheck, Plane, MapPin } from 'lucide-react'
import type { Reservation, Customer } from '@/types/reservation'
import type { ReservationFollowUpPipelineSnapshot } from '@/lib/reservationFollowUpPipeline'
import {
  reservationNeedsConfirmationMail,
  reservationNeedsResidentPipelineAttention,
  reservationExcludedFromFollowUpPipeline,
  reservationNeedsAnyFollowUpAttention,
  followUpModalMatchesDepartureTab,
  followUpModalMatchesPickupTab,
} from '@/lib/reservationFollowUpPipeline'
import { getCustomerName, isReservationTourDatePastLocal, isReservationAddedStrictlyBeforeTodayLocal } from '@/utils/reservationUtils'

export type FollowUpQueueTabId = 'confirm' | 'resident' | 'departure' | 'pickup'

export interface ReservationFollowUpQueueModalProps {
  isOpen: boolean
  onClose: () => void
  reservations: Reservation[]
  /** 탭 목록 정렬용 */
  customers: Customer[]
  snapshotsByReservationId: Map<string, ReservationFollowUpPipelineSnapshot>
  loadingSnapshots: boolean
  /** 예약 관리 간단 카드와 동일한 `ReservationCardItem` 트리 */
  renderSimpleReservationCard: (reservation: Reservation) => React.ReactNode
}

function tabFilter(
  tab: FollowUpQueueTabId,
  reservation: Reservation,
  status: string | undefined,
  snap: ReservationFollowUpPipelineSnapshot | undefined
): boolean {
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

export default function ReservationFollowUpQueueModal({
  isOpen,
  onClose,
  reservations,
  customers,
  snapshotsByReservationId,
  loadingSnapshots,
  renderSimpleReservationCard,
}: ReservationFollowUpQueueModalProps) {
  const t = useTranslations('reservations')
  const [tab, setTab] = useState<FollowUpQueueTabId>('confirm')

  const tabs = useMemo(
    () =>
      [
        { id: 'confirm' as const, Icon: Mail, label: t('followUpPipeline.tabConfirm') },
        { id: 'resident' as const, Icon: ClipboardCheck, label: t('followUpPipeline.tabResident') },
        { id: 'departure' as const, Icon: Plane, label: t('followUpPipeline.tabDeparture') },
        { id: 'pickup' as const, Icon: MapPin, label: t('followUpPipeline.tabPickup') },
      ] as const,
    [t]
  )

  const { rows, counts } = useMemo(() => {
    const counts = {
      confirm: 0,
      resident: 0,
      departure: 0,
      pickup: 0,
    }
    for (const r of reservations) {
      if (isReservationTourDatePastLocal(r.tourDate)) continue
      if (isReservationAddedStrictlyBeforeTodayLocal(r.addedTime)) continue
      const st = r.status as string | undefined
      if (reservationExcludedFromFollowUpPipeline(st)) continue
      const snap = snapshotsByReservationId.get(r.id)
      if (!snap) continue
      if (reservationNeedsConfirmationMail(st, snap)) counts.confirm += 1
      if (reservationNeedsResidentPipelineAttention(st, snap)) counts.resident += 1
      if (followUpModalMatchesDepartureTab(st, snap)) counts.departure += 1
      if (followUpModalMatchesPickupTab(r.tourDate, r.tourTime, st, snap)) counts.pickup += 1
    }
    const filtered = reservations.filter((r) => {
      if (isReservationTourDatePastLocal(r.tourDate)) return false
      if (isReservationAddedStrictlyBeforeTodayLocal(r.addedTime)) return false
      const st = r.status as string | undefined
      const snap = snapshotsByReservationId.get(r.id)
      if (!snap) return false
      return tabFilter(tab, r, st, snap)
    })
    filtered.sort((a, b) => {
      const da = String(a.tourDate ?? '')
      const db = String(b.tourDate ?? '')
      if (da !== db) return da.localeCompare(db)
      return getCustomerName(a.customerId, customers).localeCompare(
        getCustomerName(b.customerId, customers)
      )
    })
    return { rows: filtered, counts }
  }, [reservations, snapshotsByReservationId, tab, customers])

  const activeNeedUnion = useMemo(() => {
    let n = 0
    for (const r of reservations) {
      if (isReservationTourDatePastLocal(r.tourDate)) continue
      if (isReservationAddedStrictlyBeforeTodayLocal(r.addedTime)) continue
      const snap = snapshotsByReservationId.get(r.id)
      if (reservationNeedsAnyFollowUpAttention(r.status as string | undefined, snap)) n += 1
    }
    return n
  }, [reservations, snapshotsByReservationId])

  if (!isOpen) return null

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
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 bg-gradient-to-r from-slate-700 to-teal-800 px-4 py-3 text-white">
          <div>
            <h2 className="text-lg font-semibold">{t('followUpPipeline.modalTitle')}</h2>
            <p className="mt-0.5 text-xs text-teal-100/90">{t('followUpPipeline.modalSubtitle')}</p>
            <p className="mt-1 text-[11px] text-teal-100/80">
              {loadingSnapshots ? t('followUpPipeline.loadingSnapshots') : t('followUpPipeline.unionBadge', { count: activeNeedUnion })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-white/90 hover:bg-white/10"
            aria-label={t('followUpPipeline.close')}
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
                    : counts.pickup
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
          <p className="mb-3 text-xs text-gray-600">{t(`followUpPipeline.tabHint_${tab}`)}</p>
          {loadingSnapshots ? (
            <div className="py-12 text-center text-sm text-gray-500">{t('followUpPipeline.loadingSnapshots')}</div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">{t('followUpPipeline.emptyTab')}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
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
