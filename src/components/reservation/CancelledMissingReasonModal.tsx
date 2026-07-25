'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X, ClipboardList, PhoneForwarded, MessageSquare, ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { createClientSupabase } from '@/lib/supabase'
import type { Reservation } from '@/types/reservation'
import {
  fetchCancelledMissingReasonQueueData,
  dismissCancelledMissingReasonAutoOpenForToday,
  type CancelledMissingReasonTab,
} from '@/lib/cancelledMissingReasonQueue'

export type CancelledMissingReasonModalProps = {
  isOpen: boolean
  onClose: () => void
  locale: string
  productMap: Map<string, string>
  tourMap: Map<string, boolean>
  onDataLoaded?: (payload: {
    unionCount: number
    needsFollowUpCount: number
    awaitingReasonCount: number
  }) => void
  onQueueChanged?: () => void
  renderSimpleReservationCard: (
    reservation: Reservation,
    helpers: { onReasonSaved: () => void }
  ) => React.ReactNode
}

export default function CancelledMissingReasonModal({
  isOpen,
  onClose,
  locale: _locale,
  productMap,
  tourMap,
  onDataLoaded,
  onQueueChanged,
  renderSimpleReservationCard,
}: CancelledMissingReasonModalProps) {
  const t = useTranslations('reservations.cancelReasonQueue')
  const supabase = createClientSupabase()

  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<CancelledMissingReasonTab>('needs_follow_up')
  const [needsFollowUpIds, setNeedsFollowUpIds] = useState<string[]>([])
  const [awaitingReasonIds, setAwaitingReasonIds] = useState<string[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const onDataLoadedRef = useRef(onDataLoaded)
  onDataLoadedRef.current = onDataLoaded

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchCancelledMissingReasonQueueData(supabase, productMap, tourMap)
      setNeedsFollowUpIds(data.needsFollowUpIds)
      setAwaitingReasonIds(data.awaitingReasonIds)
      setReservations(data.reservations)
      onDataLoadedRef.current?.({
        unionCount: data.unionCount,
        needsFollowUpCount: data.needsFollowUpCount,
        awaitingReasonCount: data.awaitingReasonCount,
      })
      if (data.needsFollowUpCount === 0 && data.awaitingReasonCount > 0) {
        setTab('awaiting_reason')
      } else if (data.needsFollowUpCount > 0) {
        setTab('needs_follow_up')
      }
    } finally {
      setLoading(false)
    }
  }, [supabase, productMap, tourMap])

  useEffect(() => {
    if (!isOpen) return
    void load()
  }, [isOpen, load])

  const reservationById = useMemo(() => {
    const m = new Map<string, Reservation>()
    for (const r of reservations) m.set(r.id, r)
    return m
  }, [reservations])

  const activeIds = tab === 'needs_follow_up' ? needsFollowUpIds : awaitingReasonIds
  const activeReservations = activeIds
    .map((id) => reservationById.get(id))
    .filter((r): r is Reservation => !!r)

  const handleClose = () => {
    onClose()
  }

  const handleDismissToday = () => {
    dismissCancelledMissingReasonAutoOpenForToday()
    onClose()
  }

  const handleReasonSaved = () => {
    onQueueChanged?.()
    void load()
  }

  if (!isOpen) return null

  const workflowSteps = [
    { key: 'intake', label: t('workflowIntake'), Icon: ClipboardList },
    { key: 'follow_up', label: t('workflowFollowUp'), Icon: PhoneForwarded },
    { key: 'response', label: t('workflowResponse'), Icon: MessageSquare },
    { key: 'reason', label: t('workflowReason'), Icon: ClipboardList },
  ] as const

  return (
    <div className="fixed inset-0 z-[1150] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[88vh] w-full max-w-6xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 p-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="shrink-0 rounded-lg bg-rose-50 p-2 text-rose-800">
              <ClipboardList className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900">{t('title')}</h2>
              <p className="mt-1 text-sm leading-snug text-gray-600">{t('subtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="shrink-0 rounded-lg p-2 text-gray-600 hover:bg-gray-100"
            aria-label={t('close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-gray-100 bg-slate-50 px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t('workflowTitle')}
          </p>
          <ol className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm">
            {workflowSteps.map((step, index) => (
              <li key={step.key} className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-800">
                  <step.Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
                  <span>{step.label}</span>
                </span>
                {index < workflowSteps.length - 1 ? (
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                ) : null}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">{t('workflowHint')}</p>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-gray-100 px-4 pt-3">
          <button
            type="button"
            onClick={() => setTab('needs_follow_up')}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === 'needs_follow_up'
                ? 'bg-rose-100 text-rose-900 ring-1 ring-rose-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('tabNeedsFollowUp')}
            <span className="ml-1.5 tabular-nums opacity-90">({needsFollowUpIds.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('awaiting_reason')}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === 'awaiting_reason'
                ? 'bg-violet-100 text-violet-900 ring-1 ring-violet-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('tabAwaitingReason')}
            <span className="ml-1.5 tabular-nums opacity-90">({awaitingReasonIds.length})</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-gray-500">{t('loading')}</div>
          ) : activeReservations.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-12 text-center text-sm text-gray-600">
              {tab === 'needs_follow_up' ? t('emptyNeedsFollowUp') : t('emptyAwaitingReason')}
            </div>
          ) : (
            <div className="admin-reservations-card-grid admin-reservations-card-grid--simple">
              {activeReservations.map((reservation) => (
                <React.Fragment key={reservation.id}>
                  {renderSimpleReservationCard(reservation, { onReasonSaved: handleReasonSaved })}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500">{t('dismissHint')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDismissToday}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t('dismissToday')}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-200"
            >
              {t('close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
