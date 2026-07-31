'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  computeNeedsResidentFlow,
  reservationEligibleForConfirmationInferredFromDeparture,
  type ReservationFollowUpPipelineSnapshot,
} from '@/lib/reservationFollowUpPipeline'
import { fetchFollowUpSnapshotDataForReservationIds } from '@/lib/reservationFollowUpSnapshotsFetch'
import { fetchProductChoicesByProductIds } from '@/lib/productChoicesForResidentFlow'
import {
  syncPendingEmailLogsForReservations,
  clearEmailDeliverySyncCache,
} from '@/lib/emailLogDeliverySyncClient'
import { scheduleDeferredWork } from '@/lib/scheduleDeferredWork'
import type { ProductChoiceForResidentFlow } from '@/utils/usResidentChoiceSync'

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

function resolveChoicesForProduct(
  productId: string | null | undefined,
  choicesMap: Map<string, ProductChoiceForResidentFlow[]>,
  choicesFetchDone: boolean
): ProductChoiceForResidentFlow[] | null {
  const pid = String(productId ?? '').trim()
  if (!pid) return null
  if (!choicesFetchDone) return null
  return choicesMap.get(pid) ?? []
}

function buildSnapshotsFromFetch(
  entries: ReservationLite[],
  productCodeByReservationId: Map<string, string | null>,
  productIdByReservationId: Map<string, string | null>,
  productChoicesByProductId: Map<string, ProductChoiceForResidentFlow[]>,
  productChoicesFetchDone: boolean,
  reservationStatusById: Map<string, string | null>,
  tourStatusByReservationId: Map<string, string | null>,
  fetchResult: Awaited<ReturnType<typeof fetchFollowUpSnapshotDataForReservationIds>>,
  targetIds: string[]
): Map<string, ReservationFollowUpPipelineSnapshot> {
  const next = new Map<string, ReservationFollowUpPipelineSnapshot>()
  for (const rid of targetIds) {
    const entry = entries.find((e) => e.id === rid)
    const code = productCodeByReservationId.get(rid) ?? null
    const productId = productIdByReservationId.get(rid) ?? entry?.productId ?? null
    const choices = resolveChoicesForProduct(productId, productChoicesByProductId, productChoicesFetchDone)
    const needs = computeNeedsResidentFlow(code, choices)
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
      emailDelivery: fetchResult.emailDeliveryByReservationId.get(rid) ?? {},
    })
  }
  return next
}

const BACKGROUND_EMAIL_SYNC_MAX_IDS = 4
const BACKGROUND_EMAIL_SYNC_DELAY_MS = 2500

function collectPendingDeliveryReservationIds(
  ids: string[],
  emailDeliveryByReservationId: Map<string, ReservationFollowUpPipelineSnapshot['emailDelivery']>
): string[] {
  return ids.filter((id) => {
    const delivery = emailDeliveryByReservationId.get(id)
    if (!delivery) return false
    return Object.values(delivery).some((state) => state === 'pending')
  })
}

export type UseReservationFollowUpSnapshotsOptions = {
  /**
   * 화면에 렌더된(가상화 overscan 포함) 예약 id — 우선 조회.
   * 비어 있으면 전체 목록을 한 번에 조회한다.
   */
  priorityReservationIds?: string[]
  /** false면 priority만 조회(나머지 idle 배치 생략) */
  loadDeferred?: boolean
  /**
   * true면 스냅샷 조회 전 Resend API 동기화(느림). 기본 false — DB 상태로 먼저 표시 후 백그라운드 갱신.
   */
  blockingEmailDeliverySync?: boolean
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
  refreshReservationIds: (reservationIds: string[]) => Promise<void>
} {
  const priorityReservationIds = options?.priorityReservationIds
  const loadDeferred = options?.loadDeferred !== false
  const blockingEmailDeliverySync = options?.blockingEmailDeliverySync === true

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
  const productChoicesByProductIdRef = useRef<Map<string, ProductChoiceForResidentFlow[]>>(new Map())
  const [productChoicesFetchDone, setProductChoicesFetchDone] = useState(false)
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

  /** 수동 완료 등 refreshToken 변경 시 스냅샷 맵은 유지하고 캐시만 무효화해 재조회 (전체 초기화 시 UI가 비활성처럼 보임) */
  useEffect(() => {
    if (refreshToken <= 0) return
    loadedIdsRef.current = new Set()
  }, [refreshToken])

  useEffect(() => {
    const productIds = [...new Set(products.map((p) => String(p.id ?? '').trim()).filter(Boolean))]
    if (productIds.length === 0) {
      productChoicesByProductIdRef.current = new Map()
      setProductChoicesFetchDone(true)
      return
    }

    let cancelled = false
    setProductChoicesFetchDone(false)
    ;(async () => {
      try {
        const map = await fetchProductChoicesByProductIds(productIds)
        if (!cancelled) {
          productChoicesByProductIdRef.current = map
          setProductChoicesFetchDone(true)
        }
      } catch (e) {
        if (!cancelled) {
          console.error('useReservationFollowUpSnapshots product choices:', e)
          productChoicesByProductIdRef.current = new Map()
          setProductChoicesFetchDone(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [productsKey])

  /** 상품 초이스 로드 후 거주 단계 여부만 기존 스냅샷에 반영 (email_logs 재조회 없음) */
  useEffect(() => {
    if (!productChoicesFetchDone) return

    const entries = parseReservationLiteKey(reservationLiteKey)
    if (entries.length === 0) return

    const productCodeById = new Map(products.map((p) => [p.id, p.product_code ?? null]))

    setSnapshotsByReservationId((prev) => {
      if (prev.size === 0) return prev
      let changed = false
      const next = new Map(prev)
      for (const [rid, snap] of prev) {
        const entry = entries.find((e) => e.id === rid)
        const pid = String(entry?.productId ?? '').trim()
        const code = pid ? (productCodeById.get(pid) ?? null) : null
        const choices = resolveChoicesForProduct(pid, productChoicesByProductIdRef.current, true)
        const needs = computeNeedsResidentFlow(code, choices)
        if (needs !== snap.needsResidentFlow) {
          next.set(rid, { ...snap, needsResidentFlow: needs })
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [productChoicesFetchDone, reservationLiteKey, productsKey, products])

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
    const priorityIds = prioritySet.size > 0 ? [...prioritySet] : allIds
    const deferredIds = loadDeferred
      ? allIds.filter((id) => !priorityIds.includes(id) && !loadedIdsRef.current.has(id))
      : []

    const productCodeById = new Map(products.map((p) => [p.id, p.product_code ?? null]))
    const productCodeByReservationId = new Map<string, string | null>()
    const productIdByReservationId = new Map<string, string | null>()
    const reservationStatusById = new Map<string, string | null>()
    const tourStatusByReservationId = new Map<string, string | null>()
    for (const e of entries) {
      const pid = String(e.productId ?? '').trim()
      productIdByReservationId.set(e.id, pid || null)
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
    const choicesMap = productChoicesByProductIdRef.current
    const choicesDone = productChoicesFetchDone

    const applyIds = async (
      ids: string[],
      emailSync: 'none' | 'background' | 'blocking'
    ) => {
      if (ids.length === 0) return

      if (emailSync === 'blocking') {
        await syncPendingEmailLogsForReservations(ids)
        if (cancelled || gen !== fetchGenRef.current) return
      }

      const fetchResult = await fetchFollowUpSnapshotDataForReservationIds(ids, () => cancelled)
      if (cancelled || gen !== fetchGenRef.current) return
      const built = buildSnapshotsFromFetch(
        entries,
        productCodeByReservationId,
        productIdByReservationId,
        choicesMap,
        choicesDone,
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

      if (emailSync !== 'background' || cancelled || gen !== fetchGenRef.current) return

      const pendingIds = collectPendingDeliveryReservationIds(
        ids,
        fetchResult.emailDeliveryByReservationId
      ).slice(0, BACKGROUND_EMAIL_SYNC_MAX_IDS)
      if (pendingIds.length === 0) return

      scheduleDeferredWork(() => {
        void (async () => {
          if (cancelled || gen !== fetchGenRef.current) return
          const { synced, updatedReservationIds } =
            await syncPendingEmailLogsForReservations(pendingIds)
          if (synced === 0 || cancelled || gen !== fetchGenRef.current) return

          const refetchIds =
            updatedReservationIds.length > 0
              ? updatedReservationIds.filter((id) => ids.includes(id))
              : pendingIds
          if (refetchIds.length === 0) return

          const refetchResult = await fetchFollowUpSnapshotDataForReservationIds(
            refetchIds,
            () => cancelled
          )
          if (cancelled || gen !== fetchGenRef.current) return
          const rebuilt = buildSnapshotsFromFetch(
            entries,
            productCodeByReservationId,
            productIdByReservationId,
            choicesMap,
            choicesDone,
            reservationStatusById,
            tourStatusByReservationId,
            refetchResult,
            refetchIds
          )
          setSnapshotsByReservationId((prev) => {
            const next = new Map(prev)
            rebuilt.forEach((v, k) => next.set(k, v))
            return next
          })
        })()
      }, BACKGROUND_EMAIL_SYNC_DELAY_MS)
    }

    ;(async () => {
      setLoading(true)
      try {
        const prioritySync = blockingEmailDeliverySync ? 'blocking' : 'background'
        await applyIds(pendingPriority, prioritySync)
        if (cancelled || gen !== fetchGenRef.current) return
        if (deferredIds.length === 0) return

        await new Promise<void>((resolve) => {
          scheduleDeferredWork(() => resolve(), 400)
        })
        if (cancelled || gen !== fetchGenRef.current) return
        await applyIds(deferredIds, 'none')
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
  }, [
    reservationLiteKey,
    productsKey,
    priorityKey,
    loadDeferred,
    priorityReservationIds,
    productChoicesFetchDone,
    blockingEmailDeliverySync,
    refreshToken,
  ])

  const refreshReservationIds = useCallback(
    async (reservationIds: string[]) => {
      const uniqueIds = [
        ...new Set(reservationIds.map((id) => String(id ?? '').trim()).filter(Boolean)),
      ]
      if (uniqueIds.length === 0) return

      const entries = parseReservationLiteKey(reservationLiteKey)
      const productCodeById = new Map(products.map((p) => [p.id, p.product_code ?? null]))
      const productCodeByReservationId = new Map<string, string | null>()
      const productIdByReservationId = new Map<string, string | null>()
      const reservationStatusById = new Map<string, string | null>()
      const tourStatusByReservationId = new Map<string, string | null>()
      for (const e of entries) {
        const pid = String(e.productId ?? '').trim()
        productIdByReservationId.set(e.id, pid || null)
        productCodeByReservationId.set(e.id, pid ? (productCodeById.get(pid) ?? null) : null)
        reservationStatusById.set(e.id, e.status ?? null)
        tourStatusByReservationId.set(e.id, e.tourStatus ?? null)
      }

      const targetIds = uniqueIds.filter((id) => entries.some((e) => e.id === id))
      if (targetIds.length === 0) return

      for (const id of targetIds) clearEmailDeliverySyncCache(id)

      try {
        await syncPendingEmailLogsForReservations(targetIds)

        const fetchResult = await fetchFollowUpSnapshotDataForReservationIds(targetIds)
        const builtFinal = buildSnapshotsFromFetch(
          entries,
          productCodeByReservationId,
          productIdByReservationId,
          productChoicesByProductIdRef.current,
          productChoicesFetchDone,
          reservationStatusById,
          tourStatusByReservationId,
          fetchResult,
          targetIds
        )
        for (const id of targetIds) loadedIdsRef.current.add(id)
        setSnapshotsByReservationId((prev) => {
          const next = new Map(prev)
          builtFinal.forEach((v, k) => next.set(k, v))
          return next
        })
      } catch (e) {
        if (!isLikelyAbortError(e)) {
          console.error('useReservationFollowUpSnapshots refreshReservationIds:', e)
        }
      }
    },
    [reservationLiteKey, products, productChoicesFetchDone]
  )

  return { snapshotsByReservationId, loading, patchCancelManualFlags, refreshReservationIds }
}
