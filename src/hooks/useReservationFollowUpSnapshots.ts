'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  computeNeedsResidentFlow,
  reservationEligibleForConfirmationInferredFromDeparture,
  type ReservationFollowUpPipelineSnapshot,
} from '@/lib/reservationFollowUpPipeline'
import { fetchFollowUpSnapshotDataForReservationIds } from '@/lib/reservationFollowUpSnapshotsFetch'
import { scheduleDeferredWork } from '@/lib/scheduleDeferredWork'
import { ADMIN_RESERVATION_CARD_VIRTUALIZE_MIN } from '@/components/reservation/AdminReservationCardVirtualGrid'

/** effect 정리·의존성 변경으로 요청이 끊긴 경우 — 실패로 로그하지 않음 */
function isLikelyAbortError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const o = e as { name?: string; message?: string; details?: string }
  if (o.name === 'AbortError') return true
  const blob = `${o.message ?? ''}\n${o.details ?? ''}`
  return blob.includes('AbortError') || blob.includes('signal is aborted')
}

type ReservationLite = {
  id: string
  productId: string
  status?: string | null
  tourStatus?: string | null
}

function buildReservationLiteKey(reservations: ReservationLite[]): string {
  return reservations
    .map((r) => {
      const id = String(r.id ?? '').trim()
      if (!id) return ''
      return `${id}\u0001${String(r.productId ?? '').trim()}\u0001${String(r.status ?? '').trim()}\u0001${String(r.tourStatus ?? '').trim()}`
    })
    .filter(Boolean)
    .sort()
    .join('\u001f')
}

function parseReservationLiteKey(key: string): ReservationLite[] {
  if (!key) return []
  const out: ReservationLite[] = []
  for (const part of key.split('\u001f')) {
    if (!part) continue
    const bits = part.split('\u0001')
    const id = bits[0] ?? ''
    const productId = bits[1] ?? ''
    const status = bits[2] ?? ''
    const tourStatus = bits[3] ?? ''
    if (id) out.push({ id, productId, status: status || null, tourStatus: tourStatus || null })
  }
  return out
}

function buildSnapshotsFromFetch(
  entries: ReservationLite[],
  productCodeByReservationId: Map<string, string | null>,
  reservationStatusById: Map<string, string | null>,
  tourStatusByReservationId: Map<string, string | null>,
  fetchResult: Awaited<ReturnType<typeof fetchFollowUpSnapshotDataForReservationIds>>,
  targetIds: string[]
): Map<string, ReservationFollowUpPipelineSnapshot> {
  const next = new Map<string, ReservationFollowUpPipelineSnapshot>()
  for (const rid of targetIds) {
    const entry = entries.find((e) => e.id === rid)
    const code = productCodeByReservationId.get(rid) ?? null
    const needs = computeNeedsResidentFlow(code)
    const m = fetchResult.manualByReservationId.get(rid)
    const mc = m?.confirmation_manual ?? false
    const mr = m?.resident_manual ?? false
    const md = m?.departure_manual ?? false
    const mp = m?.pickup_manual ?? false
    const cFu = m?.cancel_follow_up_manual ?? false
    const cRe = m?.cancel_rebooking_outreach_manual ?? false
    const departureEffective = fetchResult.departureSent.has(rid) || md
    const confirmationSentDirect = fetchResult.confirmationSent.has(rid) || mc
    const eligibleForInference = reservationEligibleForConfirmationInferredFromDeparture(
      reservationStatusById.get(rid) ?? entry?.status ?? null,
      tourStatusByReservationId.get(rid) ?? entry?.tourStatus ?? null
    )
    const confirmationInferredFromDeparture =
      eligibleForInference && departureEffective && !confirmationSentDirect
    next.set(rid, {
      confirmationSent: confirmationSentDirect || confirmationInferredFromDeparture,
      confirmationSentDirect,
      confirmationInferredFromDeparture,
      residentInquirySent: fetchResult.residentInquirySent.has(rid) || mr,
      guestResidentFlowCompleted: fetchResult.guestDone.has(rid) || mr,
      departureSent: departureEffective,
      pickupSent: fetchResult.pickupSent.has(rid) || mp,
      needsResidentFlow: needs,
      manualConfirmation: mc,
      manualResident: mr,
      manualDeparture: md,
      manualPickup: mp,
      cancelFollowUpManual: cFu,
      cancelRebookingOutreachManual: cRe,
    })
  }
  return next
}

export type UseReservationFollowUpSnapshotsOptions = {
  /**
   * 화면에 렌더된(가상화 overscan 포함) 예약 id — 우선 조회.
   * 비어 있으면 전체 목록을 한 번에 조회한다.
   */
  priorityReservationIds?: string[]
  /** false면 priority만 조회(나머지 idle 배치 생략) */
  loadDeferred?: boolean
}

/**
 * 예약 카드 Follow-up 파이프라인 표시용: email_logs + 거주 확인 + 수동 완료.
 * 스냅샷은 요청 id 범위만 갱신하고 기존 맵과 병합(카드·모달 전환 시 초기화 방지).
 */
export function useReservationFollowUpSnapshots(
  reservations: ReservationLite[],
  products: Array<{ id: string; product_code?: string | null }>,
  /** 수동 완료 저장 후 스냅샷 재조회 */
  refreshToken = 0,
  options?: UseReservationFollowUpSnapshotsOptions
): {
  snapshotsByReservationId: Map<string, ReservationFollowUpPipelineSnapshot>
  loading: boolean
  patchCancelManualFlags: (
    reservationId: string,
    cancelFollowUpManual: boolean,
    cancelRebookingOutreachManual: boolean
  ) => void
} {
  const priorityReservationIds = options?.priorityReservationIds
  const loadDeferred = options?.loadDeferred !== false

  const reservationLiteKey = useMemo(() => buildReservationLiteKey(reservations), [reservations])

  const priorityKey = useMemo(
    () =>
      [...new Set((priorityReservationIds ?? []).map((id) => String(id ?? '').trim()).filter(Boolean))]
        .sort()
        .join(','),
    [priorityReservationIds]
  )

  const productsKey = useMemo(
    () =>
      products
        .map((p) => `${p.id}:${p.product_code ?? ''}`)
        .sort()
        .join('|'),
    [products]
  )

  const [snapshotsByReservationId, setSnapshotsByReservationId] = useState<
    Map<string, ReservationFollowUpPipelineSnapshot>
  >(new Map())
  const [loading, setLoading] = useState(false)
  const loadedIdsRef = useRef<Set<string>>(new Set())
  const fetchGenRef = useRef(0)

  const patchCancelManualFlags = useCallback(
    (reservationId: string, cancelFollowUpManual: boolean, cancelRebookingOutreachManual: boolean) => {
      const rid = String(reservationId ?? '').trim()
      if (!rid) return
      setSnapshotsByReservationId((prev) => {
        const cur = prev.get(rid)
        if (!cur) return prev
        if (
          cur.cancelFollowUpManual === cancelFollowUpManual &&
          cur.cancelRebookingOutreachManual === cancelRebookingOutreachManual
        ) {
          return prev
        }
        const next = new Map(prev)
        next.set(rid, { ...cur, cancelFollowUpManual, cancelRebookingOutreachManual })
        return next
      })
    },
    []
  )

  useEffect(() => {
    loadedIdsRef.current = new Set()
    setSnapshotsByReservationId(new Map())
  }, [refreshToken])

  useEffect(() => {
    const entries = parseReservationLiteKey(reservationLiteKey)
    const allIds = entries.map((e) => e.id)
    if (allIds.length === 0) {
      setLoading(false)
      return
    }

    const prioritySet = new Set(
      (priorityReservationIds ?? [])
        .map((id) => String(id ?? '').trim())
        .filter((id) => allIds.includes(id))
    )
    if (prioritySet.size === 0 && allIds.length >= ADMIN_RESERVATION_CARD_VIRTUALIZE_MIN) {
      setLoading(false)
      return
    }
    const priorityIds = prioritySet.size > 0 ? [...prioritySet] : allIds
    const deferredIds = loadDeferred
      ? allIds.filter((id) => !priorityIds.includes(id) && !loadedIdsRef.current.has(id))
      : []

    const productCodeById = new Map(products.map((p) => [p.id, p.product_code ?? null]))
    const productCodeByReservationId = new Map<string, string | null>()
    const reservationStatusById = new Map<string, string | null>()
    const tourStatusByReservationId = new Map<string, string | null>()
    for (const e of entries) {
      const pid = String(e.productId ?? '').trim()
      productCodeByReservationId.set(e.id, pid ? (productCodeById.get(pid) ?? null) : null)
      reservationStatusById.set(e.id, e.status ?? null)
      tourStatusByReservationId.set(e.id, e.tourStatus ?? null)
    }

    const pendingPriority = priorityIds.filter((id) => !loadedIdsRef.current.has(id))
    if (pendingPriority.length === 0 && deferredIds.length === 0) {
      setLoading(false)
      return
    }

    const gen = ++fetchGenRef.current
    let cancelled = false

    const applyIds = async (ids: string[]) => {
      if (ids.length === 0) return
      const fetchResult = await fetchFollowUpSnapshotDataForReservationIds(ids, () => cancelled)
      if (cancelled || gen !== fetchGenRef.current) return
      const built = buildSnapshotsFromFetch(
        entries,
        productCodeByReservationId,
        reservationStatusById,
        tourStatusByReservationId,
        fetchResult,
        ids
      )
      for (const id of ids) loadedIdsRef.current.add(id)
      setSnapshotsByReservationId((prev) => {
        const next = new Map(prev)
        built.forEach((v, k) => next.set(k, v))
        return next
      })
    }

    ;(async () => {
      setLoading(true)
      try {
        await applyIds(pendingPriority)
        if (cancelled || gen !== fetchGenRef.current) return
        if (deferredIds.length === 0) return

        await new Promise<void>((resolve) => {
          scheduleDeferredWork(() => resolve(), 400)
        })
        if (cancelled || gen !== fetchGenRef.current) return
        await applyIds(deferredIds)
      } catch (e) {
        if (cancelled || isLikelyAbortError(e)) return
        console.error('useReservationFollowUpSnapshots:', e)
      } finally {
        if (!cancelled && gen === fetchGenRef.current) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [reservationLiteKey, productsKey, priorityKey, loadDeferred, priorityReservationIds])

  return { snapshotsByReservationId, loading, patchCancelManualFlags }
}
