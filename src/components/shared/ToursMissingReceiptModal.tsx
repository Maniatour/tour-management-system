'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X, Receipt } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { createClientSupabase } from '@/lib/supabase'
import { dedupeReservationIdsPreservingOrder, normalizeReservationIds } from '@/utils/tourUtils'
import { useTourHandlers } from '@/hooks/useTourHandlers'
import {
  fetchToursNeedCheckData,
  type TourNeedCheckRow,
  type DuplicateAssignmentReservationRow,
  type UnassignedReservationNeedCheckRow,
} from '@/lib/toursNeedCheckStats'

export type { TourNeedCheckRow, DuplicateAssignmentReservationRow, UnassignedReservationNeedCheckRow }
/** @deprecated Use TourNeedCheckRow */
export type TourRowMissingReceipt = TourNeedCheckRow

type TabKey = 'noReceipt' | 'balance' | 'duplicate' | 'unassigned'

type DuplicateGroupFilter = 'all' | 'crossTour' | 'listInTour'
type BalanceReservationItem = {
  reservationId: string
  displayLabel: string | null
  totalPeople: number
  balanceAmount: number
}

type Props = {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  tabNoReceiptLabel: string
  tabBalanceLabel: string
  tabDuplicateLabel: string
  tabUnassignedLabel: string
  locale: string
  onTourClick: (tourId: string) => void
  /** 모달에서 데이터를 다시 불러온 뒤 상위(버튼 카운트) 갱신 */
  onDataLoaded?: (payload: {
    unionCount: number
    noReceiptCount: number
    balanceCount: number
    duplicateCount: number
    unassignedCount: number
  }) => void
}

export function ToursNeedCheckModal({
  isOpen,
  onClose,
  title,
  subtitle,
  tabNoReceiptLabel,
  tabBalanceLabel,
  tabDuplicateLabel,
  tabUnassignedLabel,
  locale,
  onTourClick,
  onDataLoaded,
}: Props) {
  const supabase = createClientSupabase()
  const t = useTranslations('tours')
  const { handleAssignReservation } = useTourHandlers()
  const isKo = locale === 'ko'
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<TabKey>('noReceipt')
  const [noReceipt, setNoReceipt] = useState<TourNeedCheckRow[]>([])
  const [balanceRemaining, setBalanceRemaining] = useState<TourNeedCheckRow[]>([])
  const [duplicateByReservation, setDuplicateByReservation] = useState<DuplicateAssignmentReservationRow[]>([])
  const [unassignedReservations, setUnassignedReservations] = useState<UnassignedReservationNeedCheckRow[]>([])
  const [duplicateGroupFilter, setDuplicateGroupFilter] = useState<DuplicateGroupFilter>('all')
  const [unassigningKey, setUnassigningKey] = useState<string | null>(null)
  const [deduping, setDeduping] = useState(false)
  const [unassignedAssigningKey, setUnassignedAssigningKey] = useState<string | null>(null)
  const [expandedBalanceTourId, setExpandedBalanceTourId] = useState<string | null>(null)
  const [balanceDetailsByTourId, setBalanceDetailsByTourId] = useState<Record<string, BalanceReservationItem[]>>({})
  const [balanceDetailsLoadingTourId, setBalanceDetailsLoadingTourId] = useState<string | null>(null)
  const [collectingBalanceKey, setCollectingBalanceKey] = useState<string | null>(null)
  const [previewReservationId, setPreviewReservationId] = useState<string | null>(null)
  const [previewTourId, setPreviewTourId] = useState<string | null>(null)
  const onDataLoadedRef = useRef(onDataLoaded)
  onDataLoadedRef.current = onDataLoaded

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchToursNeedCheckData(supabase)
      setNoReceipt(data.noReceipt)
      setBalanceRemaining(data.balanceRemaining)
      setDuplicateByReservation(data.duplicateByReservation)
      setUnassignedReservations(data.unassignedReservations)
      onDataLoadedRef.current?.({
        unionCount: data.unionCount,
        noReceiptCount: data.noReceiptCount,
        balanceCount: data.balanceCount,
        duplicateCount: data.duplicateCount,
        unassignedCount: data.unassignedCount,
      })
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const handleUnassignPlacement = useCallback(
    async (tourId: string, reservationId: string) => {
      if (!window.confirm(t('needCheckDuplicateUnassignConfirm'))) return
      const key = `${tourId}:${reservationId}`
      setUnassigningKey(key)
      try {
        const { data, error: fetchErr } = await supabase
          .from('tours')
          .select('reservation_ids')
          .eq('id', tourId)
          .maybeSingle()

        if (fetchErr) {
          alert(isKo ? `조회 오류: ${fetchErr.message}` : fetchErr.message)
          return
        }
        if (!data) {
          alert(isKo ? '투어를 찾을 수 없습니다.' : 'Tour not found.')
          return
        }
        const rid = String(reservationId).trim()
        const next = normalizeReservationIds(
          (data as { reservation_ids?: unknown }).reservation_ids
        ).filter((id) => id !== rid)

        const { error: upErr } = await supabase
          .from('tours')
          .update({ reservation_ids: next })
          .eq('id', tourId)

        if (upErr) {
          alert(isKo ? `저장 오류: ${upErr.message}` : upErr.message)
          return
        }
        await supabase.from('reservations').update({ tour_id: null }).eq('id', rid).eq('tour_id', tourId)
        await load()
      } finally {
        setUnassigningKey(null)
      }
    },
    [supabase, load, isKo, t]
  )

  useEffect(() => {
    if (!isOpen) return
    void load()
  }, [isOpen, load])

  useEffect(() => {
    if (!isOpen) setDuplicateGroupFilter('all')
  }, [isOpen])

  const loadBalanceReservationsForTour = useCallback(
    async (tourId: string) => {
      const tid = String(tourId).trim()
      if (!tid) return [] as BalanceReservationItem[]
      setBalanceDetailsLoadingTourId(tid)
      try {
        const { data: tourRow, error: tourErr } = await supabase
          .from('tours')
          .select('reservation_ids')
          .eq('id', tid)
          .maybeSingle()
        if (tourErr || !tourRow) {
          if (tourErr) console.error('loadBalanceReservationsForTour tours', tourErr)
          setBalanceDetailsByTourId((prev) => ({ ...prev, [tid]: [] }))
          return []
        }
        const reservationIds = normalizeReservationIds((tourRow as { reservation_ids?: unknown }).reservation_ids)
        if (reservationIds.length === 0) {
          setBalanceDetailsByTourId((prev) => ({ ...prev, [tid]: [] }))
          return []
        }
        const { data: pricingRows, error: pricingErr } = await supabase
          .from('reservation_pricing')
          .select('reservation_id, balance_amount')
          .in('reservation_id', reservationIds)
        if (pricingErr) {
          console.error('loadBalanceReservationsForTour pricing', pricingErr)
          setBalanceDetailsByTourId((prev) => ({ ...prev, [tid]: [] }))
          return []
        }
        const balanceMap = new Map<string, number>()
        for (const p of pricingRows || []) {
          const row = p as { reservation_id: string; balance_amount?: number | string | null }
          const rid = String(row.reservation_id).trim()
          if (!rid) continue
          const b =
            row.balance_amount == null
              ? 0
              : typeof row.balance_amount === 'string'
                ? parseFloat(row.balance_amount) || 0
                : Number(row.balance_amount) || 0
          balanceMap.set(rid, b)
        }

        const { data: reservRows, error: reservErr } = await supabase
          .from('reservations')
          .select('id, customer_id, channel_rn, total_people, adults, child, infant')
          .in('id', reservationIds)
        if (reservErr) {
          console.error('loadBalanceReservationsForTour reservations', reservErr)
          setBalanceDetailsByTourId((prev) => ({ ...prev, [tid]: [] }))
          return []
        }
        const customerIds = [
          ...new Set(
            (reservRows || [])
              .map((r) => (r as { customer_id?: string | null }).customer_id)
              .filter((cid): cid is string => cid != null && String(cid).trim() !== '')
              .map((cid) => String(cid).trim())
          ),
        ]
        const customerNameById = new Map<string, string>()
        if (customerIds.length > 0) {
          const { data: customerRows } = await supabase.from('customers').select('id, name').in('id', customerIds)
          for (const c of customerRows || []) {
            const row = c as { id: string; name?: string | null }
            customerNameById.set(String(row.id), String(row.name || '').trim())
          }
        }

        const details: BalanceReservationItem[] = []
        for (const r of reservRows || []) {
          const row = r as {
            id: string
            customer_id?: string | null
            channel_rn?: string | null
            total_people?: number | null
            adults?: number | null
            child?: number | null
            infant?: number | null
          }
          const rid = String(row.id).trim()
          if (!rid) continue
          const bal = balanceMap.get(rid) ?? 0
          if (bal <= 0.009) continue
          const custId = row.customer_id ? String(row.customer_id).trim() : ''
          const label = (custId ? customerNameById.get(custId) : null) || String(row.channel_rn || '').trim() || null
          const totalPeople =
            Number(row.total_people) > 0
              ? Number(row.total_people)
              : (Number(row.adults) || 0) + (Number(row.child) || 0) + (Number(row.infant) || 0)
          details.push({
            reservationId: rid,
            displayLabel: label,
            totalPeople,
            balanceAmount: bal,
          })
        }
        details.sort((a, b) => b.balanceAmount - a.balanceAmount)
        setBalanceDetailsByTourId((prev) => ({ ...prev, [tid]: details }))
        return details
      } finally {
        setBalanceDetailsLoadingTourId((curr) => (curr === tid ? null : curr))
      }
    },
    [supabase]
  )

  const handleToggleBalanceAccordion = useCallback(
    async (tourId: string) => {
      const tid = String(tourId).trim()
      if (!tid) return
      if (expandedBalanceTourId === tid) {
        setExpandedBalanceTourId(null)
        return
      }
      setExpandedBalanceTourId(tid)
      if (!balanceDetailsByTourId[tid]) {
        await loadBalanceReservationsForTour(tid)
      }
    },
    [expandedBalanceTourId, balanceDetailsByTourId, loadBalanceReservationsForTour]
  )

  const handleCollectBalance = useCallback(
    async (tourId: string, reservationId: string) => {
      const tid = String(tourId).trim()
      const rid = String(reservationId).trim()
      if (!tid || !rid) return
      if (!window.confirm(isKo ? '해당 예약의 잔액을 수령 처리할까요?' : 'Mark this reservation balance as received?')) return
      const key = `${tid}:${rid}`
      setCollectingBalanceKey(key)
      try {
        const { error } = await supabase.from('reservation_pricing').update({ balance_amount: 0 }).eq('reservation_id', rid)
        if (error) {
          alert(isKo ? `수령 처리 오류: ${error.message}` : error.message)
          return
        }
        await loadBalanceReservationsForTour(tid)
        await load()
      } finally {
        setCollectingBalanceKey((curr) => (curr === key ? null : curr))
      }
    },
    [supabase, isKo, loadBalanceReservationsForTour, load]
  )

  const visibleDuplicateRows = useMemo(() => {
    return duplicateByReservation.filter((r) => {
      if (duplicateGroupFilter === 'all') return true
      if (duplicateGroupFilter === 'crossTour') return r.isCrossTourDuplicate
      return r.isListOnlyInTourDuplicate
    })
  }, [duplicateByReservation, duplicateGroupFilter])

  const handleDedupeTourList = useCallback(
    async (tourId: string) => {
      if (!window.confirm(t('needCheckDuplicateDedupeListConfirmSingle'))) return
      setDeduping(true)
      try {
        const { data, error: fetchErr } = await supabase
          .from('tours')
          .select('reservation_ids')
          .eq('id', tourId)
          .maybeSingle()

        if (fetchErr) {
          alert(isKo ? `조회 오류: ${fetchErr.message}` : fetchErr.message)
          return
        }
        if (!data) {
          alert(isKo ? '투어를 찾을 수 없습니다.' : 'Tour not found.')
          return
        }
        const before = normalizeReservationIds((data as { reservation_ids?: unknown }).reservation_ids)
        const next = dedupeReservationIdsPreservingOrder((data as { reservation_ids?: unknown }).reservation_ids)
        if (before.length === next.length) {
          alert(isKo ? '중복 ID가 없습니다.' : 'No duplicate IDs in this list.')
          return
        }
        const { error: upErr } = await supabase
          .from('tours')
          .update({ reservation_ids: next })
          .eq('id', tourId)
        if (upErr) {
          alert(isKo ? `저장 오류: ${upErr.message}` : upErr.message)
          return
        }
        await load()
      } finally {
        setDeduping(false)
      }
    },
    [supabase, load, isKo, t]
  )

  const handleDedupeAllInTourLists = useCallback(async () => {
    const tourIds = new Set<string>()
    for (const r of duplicateByReservation) {
      for (const p of r.placements) {
        if (p.slotsInTourList > 1) tourIds.add(p.tourId)
      }
    }
    if (tourIds.size === 0) {
      alert(isKo ? '목록 중복이 있는 투어가 없습니다.' : 'No tours with duplicate entries in the assignment list.')
      return
    }
    if (!window.confirm(t('needCheckDuplicateDedupeListAllConfirm', { count: tourIds.size }))) return
    setDeduping(true)
    try {
      for (const tourId of tourIds) {
        const { data, error: fetchErr } = await supabase
          .from('tours')
          .select('reservation_ids')
          .eq('id', tourId)
          .maybeSingle()
        if (fetchErr || !data) continue
        const before = normalizeReservationIds((data as { reservation_ids?: unknown }).reservation_ids)
        const next = dedupeReservationIdsPreservingOrder((data as { reservation_ids?: unknown }).reservation_ids)
        if (before.length === next.length) continue
        const { error: upErr } = await supabase
          .from('tours')
          .update({ reservation_ids: next })
          .eq('id', tourId)
        if (upErr) {
          console.error('dedupe tour', tourId, upErr)
        }
      }
      await load()
    } finally {
      setDeduping(false)
    }
  }, [supabase, duplicateByReservation, load, isKo, t])

  const handleAssignUnassignedToTour = useCallback(
    async (reservationId: string, tourId: string) => {
      if (!window.confirm(t('needCheckUnassignedAssignConfirm'))) return
      const uKey = `${tourId}:${reservationId}`
      setUnassignedAssigningKey(uKey)
      try {
        const { data, error: fetchErr } = await supabase
          .from('tours')
          .select('id, reservation_ids')
          .eq('id', tourId)
          .maybeSingle()

        if (fetchErr) {
          alert(isKo ? `조회 오류: ${fetchErr.message}` : fetchErr.message)
          return
        }
        if (!data) {
          alert(isKo ? '투어를 찾을 수 없습니다.' : 'Tour not found.')
          return
        }
        const row = data as { id: string; reservation_ids?: unknown }
        const next = await handleAssignReservation(
          { id: row.id, reservation_ids: row.reservation_ids } as unknown as { id: string },
          reservationId
        )
        if (next) {
          const rid = String(reservationId).trim()
          await supabase.from('reservations').update({ tour_id: tourId }).eq('id', rid)
          await load()
        }
      } finally {
        setUnassignedAssigningKey(null)
      }
    },
    [supabase, load, isKo, t, handleAssignReservation]
  )

  if (!isOpen) return null

  const rows = tab === 'noReceipt' ? noReceipt : tab === 'balance' ? balanceRemaining : null
  const formatUsd = (v: number) => `$${v.toFixed(2)}`
  const previewSrc =
    previewReservationId != null
      ? `/${locale}/admin/reservations/${previewReservationId}`
      : previewTourId != null
        ? `/${locale}/admin/tours/${previewTourId}`
        : null
  const previewTitle =
    previewReservationId != null
      ? isKo
        ? '예약 상세'
        : 'Reservation detail'
      : previewTourId != null
        ? isKo
          ? '투어 상세'
          : 'Tour detail'
        : ''

  return (
    <>
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/50">
      <div
        className={`bg-white rounded-xl shadow-xl w-full max-h-[85vh] flex flex-col ${
          tab === 'duplicate' || tab === 'unassigned' ? 'max-w-5xl' : 'max-w-3xl'
        }`}
      >
        <div className="flex items-start justify-between gap-3 p-4 border-b border-gray-200">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-800 shrink-0">
              <Receipt className="w-5 h-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
              {subtitle ? <p className="text-sm text-gray-600 mt-1">{subtitle}</p> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 pt-3 border-b border-gray-100 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab('noReceipt')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'noReceipt'
                ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tabNoReceiptLabel}
            <span className="ml-1.5 tabular-nums opacity-90">({noReceipt.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('balance')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'balance'
                ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tabBalanceLabel}
            <span className="ml-1.5 tabular-nums opacity-90">({balanceRemaining.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('duplicate')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'duplicate'
                ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tabDuplicateLabel}
            <span className="ml-1.5 tabular-nums opacity-90">({duplicateByReservation.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('unassigned')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'unassigned'
                ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tabUnassignedLabel}
            <span className="ml-1.5 tabular-nums opacity-90">({unassignedReservations.length})</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="text-sm text-gray-500">{isKo ? '불러오는 중…' : 'Loading…'}</p>
          ) : tab === 'unassigned' ? (
            unassignedReservations.length === 0 ? (
              <p className="text-sm text-gray-500">{t('needCheckUnassignedEmpty')}</p>
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-2 pr-3 align-top w-[200px]">{t('needCheckUnassignedColReservation')}</th>
                    <th className="py-2 pr-3 align-top whitespace-nowrap w-28">
                      {t('needCheckUnassignedColDate')}
                    </th>
                    <th className="py-2 pr-3 align-top">{t('needCheckUnassignedColProduct')}</th>
                    <th className="py-2 pr-2 align-top min-w-0">{t('needCheckUnassignedColCandidates')}</th>
                  </tr>
                </thead>
                <tbody>
                  {unassignedReservations.map((r) => (
                    <tr key={r.reservationId} className="border-b border-gray-100 hover:bg-gray-50 align-top">
                      <td className="py-2 pr-3">
                        <div className="font-medium text-gray-900">{r.displayLabel || '—'}</div>
                        <div className="text-xs text-gray-500 font-mono mt-0.5 break-all" title={r.reservationId}>
                          {r.reservationId}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {t('needCheckUnassignedStatusPeople', { status: r.status || '—', n: r.totalPeople })}
                        </div>
                        <div className="mt-1">
                          <button
                            type="button"
                            onClick={() => setPreviewReservationId(r.reservationId)}
                            className="text-[11px] font-medium text-blue-600 hover:text-blue-800"
                          >
                            {isKo ? '예약 상세' : 'Reservation detail'}
                          </button>
                        </div>
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap text-gray-800">{r.tourDate || '—'}</td>
                      <td
                        className="py-2 pr-3 max-w-[200px] truncate text-gray-800"
                        title={r.productName || r.productId}
                      >
                        {r.productName || r.productId}
                      </td>
                      <td className="py-2 pr-2">
                        {r.candidateTours.length === 0 ? (
                          <p className="text-sm text-amber-800">{t('needCheckUnassignedNoCandidates')}</p>
                        ) : (
                          <ul className="space-y-2">
                            {r.candidateTours.map((c) => {
                              const busy = unassignedAssigningKey === `${c.tourId}:${r.reservationId}`
                              return (
                                <li
                                  key={c.tourId}
                                  className="flex flex-wrap items-center gap-2 text-xs border border-gray-100 rounded-md p-2 bg-gray-50/80"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="text-gray-900 font-medium tabular-nums">
                                      {c.tourDate || '—'} · {(c.tourStatus || '—').toString()}
                                    </div>
                                    <div className="text-gray-600 truncate" title={c.guideName || ''}>
                                      {c.guideName || '—'}
                                    </div>
                                    <div
                                      className="text-[10px] text-gray-500 font-mono break-all mt-0.5"
                                      title={c.tourId}
                                    >
                                      {c.tourId}
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      disabled={unassignedAssigningKey !== null}
                                      onClick={() => void handleAssignUnassignedToTour(r.reservationId, c.tourId)}
                                      className="px-2 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-900 text-[11px] font-medium hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {busy ? '…' : t('needCheckUnassignedAssign')}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setPreviewTourId(c.tourId)}
                                      className="text-[11px] font-medium text-blue-600 hover:text-blue-800"
                                    >
                                      {t('needCheckDuplicateOpenTour')}
                                    </button>
                                  </div>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : tab === 'duplicate' ? (
            duplicateByReservation.length === 0 ? (
              <p className="text-sm text-gray-500">{t('needCheckDuplicateEmpty')}</p>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-end gap-2 justify-between gap-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-gray-500 shrink-0">{t('needCheckDuplicateFilterLabel')}</span>
                    <button
                      type="button"
                      onClick={() => setDuplicateGroupFilter('all')}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                        duplicateGroupFilter === 'all'
                          ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-200'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {t('needCheckDuplicateFilterAll')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDuplicateGroupFilter('crossTour')}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                        duplicateGroupFilter === 'crossTour'
                          ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-200'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {t('needCheckDuplicateFilterCrossTour')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDuplicateGroupFilter('listInTour')}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                        duplicateGroupFilter === 'listInTour'
                          ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-200'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {t('needCheckDuplicateFilterListInTour')}
                    </button>
                    <span className="text-xs text-gray-500 pl-1">
                      {t('needCheckDuplicateResultCount', { n: visibleDuplicateRows.length })}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={deduping}
                    onClick={() => void handleDedupeAllInTourLists()}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100 disabled:opacity-50"
                  >
                    {deduping ? '…' : t('needCheckDuplicateDedupeListAllButton')}
                  </button>
                </div>
                {visibleDuplicateRows.length === 0 ? (
                  <p className="text-sm text-gray-500">{t('needCheckDuplicateFilterEmpty')}</p>
                ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-2 pr-3 align-top w-[200px]">{t('needCheckDuplicateColReservation')}</th>
                    <th className="py-2 pr-3 align-top whitespace-nowrap w-32">{t('needCheckDuplicateColCount')}</th>
                    <th className="py-2 pr-2 align-top">{t('needCheckDuplicateColTours')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleDuplicateRows.map((r) => (
                    <tr key={r.reservationId} className="border-b border-gray-100 hover:bg-gray-50 align-top">
                      <td className="py-2 pr-3">
                        <div className="font-medium text-gray-900">
                          {r.displayLabel || '—'}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          <div className="tabular-nums text-gray-700">
                            {r.reservationTourDate || '—'}
                          </div>
                          <div
                            className="text-gray-700 mt-0.5 truncate max-w-[220px]"
                            title={r.reservationProductLabel || ''}
                          >
                            {r.reservationProductLabel || '—'}
                          </div>
                          <div className="mt-1">
                            <button
                              type="button"
                              onClick={() => setPreviewReservationId(r.reservationId)}
                              className="text-[11px] font-medium text-blue-600 hover:text-blue-800"
                            >
                              {isKo ? '예약 상세' : 'Reservation detail'}
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-gray-800">
                        <div className="tabular-nums font-medium">{r.occurrenceCount}</div>
                        {r.isCrossTourDuplicate ? (
                          <div className="text-[10px] text-gray-500 mt-0.5 leading-tight">
                            {t('needCheckDuplicateUniqueTours', { n: r.uniqueTourCount })}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-2 pr-2">
                        <div className="overflow-x-auto -mx-1">
                          <table className="w-full min-w-[820px] text-xs border border-gray-200 rounded-md overflow-hidden">
                            <thead>
                              <tr className="bg-gray-50 text-gray-700 border-b border-gray-200">
                                <th className="py-1.5 px-2 text-left font-medium whitespace-nowrap">
                                  {t('needCheckDuplicatePlacementDate')}
                                </th>
                                <th className="py-1.5 px-2 text-left font-medium whitespace-nowrap w-36">
                                  {t('needCheckDuplicatePlacementTourId')}
                                </th>
                                <th className="py-1.5 px-2 text-left font-medium">
                                  {t('needCheckDuplicatePlacementProduct')}
                                </th>
                                <th className="py-1.5 px-2 text-right font-medium whitespace-nowrap w-20">
                                  {t('needCheckDuplicatePlacementPeople')}
                                </th>
                                <th className="py-1.5 px-2 text-left font-medium whitespace-nowrap w-24">
                                  {t('needCheckDuplicatePlacementStatus')}
                                </th>
                                <th className="py-1.5 px-2 text-left font-medium whitespace-nowrap w-28">
                                  {t('needCheckDuplicatePlacementGuide')}
                                </th>
                                <th className="py-1.5 px-2 text-left font-medium whitespace-nowrap w-44">
                                  {t('needCheckDuplicatePlacementActions')}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.placements.map((p) => {
                                const uKey = `${p.tourId}:${r.reservationId}`
                                const busy = unassigningKey === uKey
                                return (
                                  <tr
                                    key={`${r.reservationId}-${p.tourId}`}
                                    className="border-b border-gray-100 last:border-b-0 bg-white"
                                  >
                                    <td className="py-1.5 px-2 whitespace-nowrap text-gray-900 font-medium align-top">
                                      <div>{p.tourDate || '—'}</div>
                                      {p.slotsInTourList > 1 ? (
                                        <div className="text-[10px] font-normal text-amber-800 mt-0.5 leading-tight">
                                          {t('needCheckDuplicateSlotsInList', { count: p.slotsInTourList })}
                                        </div>
                                      ) : null}
                                    </td>
                                    <td
                                      className="py-1.5 px-2 font-mono text-[11px] text-gray-600 break-all max-w-[140px]"
                                      title={p.tourId}
                                    >
                                      {p.tourId}
                                    </td>
                                    <td
                                      className="py-1.5 px-2 max-w-[200px] truncate text-gray-800"
                                      title={p.productName || ''}
                                    >
                                      {p.productName || '—'}
                                    </td>
                                    <td className="py-1.5 px-2 text-right tabular-nums text-gray-800">
                                      {p.assignedPeopleCount}
                                    </td>
                                    <td className="py-1.5 px-2 text-gray-700">{(p.tourStatus || '—').toString()}</td>
                                    <td
                                      className="py-1.5 px-2 max-w-[120px] truncate text-gray-700"
                                      title={p.guideName || ''}
                                    >
                                      {p.guideName || '—'}
                                    </td>
                                    <td className="py-1.5 px-2">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        {p.slotsInTourList > 1 ? (
                                          <button
                                            type="button"
                                            disabled={deduping || unassigningKey !== null}
                                            onClick={() => void handleDedupeTourList(p.tourId)}
                                            className="px-2 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-900 text-[11px] font-medium hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                          >
                                            {t('needCheckDuplicateDedupeListButton')}
                                          </button>
                                        ) : null}
                                        <button
                                          type="button"
                                          disabled={deduping || unassigningKey !== null}
                                          onClick={() => void handleUnassignPlacement(p.tourId, r.reservationId)}
                                          className="px-2 py-0.5 rounded border border-red-200 bg-red-50 text-red-800 text-[11px] font-medium hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                          {busy ? '…' : t('needCheckDuplicateUnassign')}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setPreviewTourId(p.tourId)}
                                          className="text-[11px] font-medium text-blue-600 hover:text-blue-800"
                                        >
                                          {t('needCheckDuplicateOpenTour')}
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
                )}
              </>
            )
          ) : tab === 'balance' ? (
            balanceRemaining.length === 0 ? (
              <p className="text-sm text-gray-500">
                {isKo ? '조건에 해당하는 투어가 없습니다.' : 'No tours match this filter.'}
              </p>
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-2 pr-2 w-8"></th>
                    <th className="py-2 pr-2">{isKo ? '투어일' : 'Date'}</th>
                    <th className="py-2 pr-2">{isKo ? '상품' : 'Product'}</th>
                    <th className="py-2 pr-2">{isKo ? '가이드' : 'Guide'}</th>
                    <th className="py-2 pr-2">{isKo ? '상태' : 'Status'}</th>
                    <th className="py-2 pr-2 w-28">{isKo ? '상세' : 'Open'}</th>
                  </tr>
                </thead>
                <tbody>
                  {balanceRemaining.map((t) => {
                    const isOpenRow = expandedBalanceTourId === t.id
                    const detailRows = balanceDetailsByTourId[t.id] || []
                    const loadingDetail = balanceDetailsLoadingTourId === t.id
                    return (
                      <Fragment key={t.id}>
                        <tr className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2 pr-2">
                            <button
                              type="button"
                              onClick={() => void handleToggleBalanceAccordion(t.id)}
                              className="w-6 h-6 inline-flex items-center justify-center rounded border border-gray-300 text-xs text-gray-700 hover:bg-gray-100"
                              aria-label={isOpenRow ? 'collapse' : 'expand'}
                            >
                              {isOpenRow ? '−' : '+'}
                            </button>
                          </td>
                          <td className="py-2 pr-2 whitespace-nowrap">{t.tour_date || '—'}</td>
                          <td className="py-2 pr-2 truncate max-w-[200px]" title={t.product_name || t.product_id || ''}>
                            {t.product_name || t.product_id || '—'}
                          </td>
                          <td className="py-2 pr-2 truncate max-w-[140px]">{t.guide_name || '—'}</td>
                          <td className="py-2 pr-2">{(t.tour_status || '—').toString()}</td>
                          <td className="py-2 pr-2">
                            <button
                              type="button"
                              onClick={() => setPreviewTourId(t.id)}
                              className="text-xs font-medium text-blue-600 hover:text-blue-800"
                            >
                              {isKo ? '투어 상세' : 'Tour detail'}
                            </button>
                          </td>
                        </tr>
                        {isOpenRow ? (
                          <tr className="border-b border-gray-100 bg-gray-50/60">
                            <td colSpan={6} className="py-2 px-3">
                              {loadingDetail ? (
                                <p className="text-xs text-gray-500">{isKo ? '예약 목록 조회 중…' : 'Loading reservations…'}</p>
                              ) : detailRows.length === 0 ? (
                                <p className="text-xs text-gray-500">
                                  {isKo ? '잔액이 남은 예약이 없습니다.' : 'No reservations with remaining balance.'}
                                </p>
                              ) : (
                                <table className="w-full text-xs border border-gray-200 rounded-md overflow-hidden bg-white">
                                  <thead>
                                    <tr className="bg-gray-50 text-gray-700 border-b border-gray-200">
                                      <th className="py-1.5 px-2 text-left font-medium">{isKo ? '예약' : 'Reservation'}</th>
                                      <th className="py-1.5 px-2 text-right font-medium w-28">{isKo ? '발란스' : 'Balance'}</th>
                                      <th className="py-1.5 px-2 text-left font-medium w-44">{isKo ? '작업' : 'Action'}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {detailRows.map((r) => {
                                      const busy = collectingBalanceKey === `${t.id}:${r.reservationId}`
                                      const totalPeople = Number(r.totalPeople) || 0
                                      return (
                                        <tr key={r.reservationId} className="border-b border-gray-100 last:border-b-0">
                                          <td className="py-1.5 px-2">
                                            <div className="font-medium text-gray-900">{r.displayLabel || '—'}</div>
                                            <div className="text-[10px] text-gray-600 mt-0.5">
                                              {isKo ? `총 ${totalPeople}명` : `${totalPeople} pax`}
                                            </div>
                                            <div className="text-[10px] text-gray-500 font-mono mt-0.5 break-all">{r.reservationId}</div>
                                          </td>
                                          <td className="py-1.5 px-2 text-right tabular-nums text-gray-900">
                                            {formatUsd(r.balanceAmount)}
                                          </td>
                                          <td className="py-1.5 px-2">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                              <button
                                                type="button"
                                                disabled={collectingBalanceKey !== null}
                                                onClick={() => void handleCollectBalance(t.id, r.reservationId)}
                                                className="px-2 py-0.5 rounded border border-emerald-300 bg-emerald-50 text-emerald-900 text-[11px] font-medium hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                              >
                                                {busy ? '…' : (isKo ? '수령' : 'Collect')}
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => setPreviewReservationId(r.reservationId)}
                                                className="text-[11px] font-medium text-blue-600 hover:text-blue-800"
                                              >
                                                {isKo ? '예약 상세' : 'Reservation detail'}
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            )
          ) : rows && rows.length === 0 ? (
            <p className="text-sm text-gray-500">
              {isKo ? '조건에 해당하는 투어가 없습니다.' : 'No tours match this filter.'}
            </p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 border-b">
                  <th className="py-2 pr-2">{isKo ? '투어일' : 'Date'}</th>
                  <th className="py-2 pr-2">{isKo ? '상품' : 'Product'}</th>
                  <th className="py-2 pr-2">{isKo ? '가이드' : 'Guide'}</th>
                  <th className="py-2 pr-2">{isKo ? '상태' : 'Status'}</th>
                  <th className="py-2 pr-2 w-28">{isKo ? '이동' : 'Open'}</th>
                </tr>
              </thead>
              <tbody>
                {(rows || []).map((t) => (
                  <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 pr-2 whitespace-nowrap">{t.tour_date || '—'}</td>
                    <td className="py-2 pr-2 truncate max-w-[200px]" title={t.product_name || t.product_id || ''}>
                      {t.product_name || t.product_id || '—'}
                    </td>
                    <td className="py-2 pr-2 truncate max-w-[140px]">{t.guide_name || '—'}</td>
                    <td className="py-2 pr-2">{(t.tour_status || '—').toString()}</td>
                    <td className="py-2 pr-2">
                      <button
                        type="button"
                        onClick={() => setPreviewTourId(t.id)}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800"
                      >
                        {isKo ? '상세' : 'Open'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
    {previewSrc ? (
      <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/60">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-[1200px] h-[88vh] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200">
            <div className="text-sm font-semibold text-gray-900">{previewTitle}</div>
            <div className="flex items-center gap-2">
              {previewTourId ? (
                <button
                  type="button"
                  onClick={() => onTourClick(previewTourId)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium border border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100"
                >
                  {isKo ? '페이지로 이동' : 'Open page'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  if (!previewSrc) return
                  window.open(previewSrc, '_blank', 'noopener,noreferrer')
                }}
                className="px-2.5 py-1 rounded-md text-xs font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              >
                {isKo ? '새 탭' : 'New tab'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreviewReservationId(null)
                  setPreviewTourId(null)
                }}
                className="px-2.5 py-1 rounded-md text-xs font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              >
                {isKo ? '닫기' : 'Close'}
              </button>
            </div>
          </div>
          <iframe src={previewSrc} title={previewTitle} className="w-full h-full border-0 bg-white" loading="lazy" />
        </div>
      </div>
    ) : null}
    </>
  )
}

/** @deprecated Use ToursNeedCheckModal */
export const ToursMissingReceiptModal = ToursNeedCheckModal
