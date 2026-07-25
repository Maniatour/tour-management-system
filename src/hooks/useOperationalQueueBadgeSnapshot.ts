'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { scheduleDeferredWork } from '@/lib/scheduleDeferredWork'
import {
  fetchOperationalQueueCandidateIds,
  fetchReservationsByIdsProgressive,
} from '@/lib/operationalQueueFetch'
import {
  mergeAdminListHydratedSnapshots,
  type AdminListHydratedSnapshot,
} from '@/hooks/useReservationData'
import { describeError, serializeError } from '@/lib/errorSerialization'

type UseOperationalQueueBadgeSnapshotArgs = {
  enabled: boolean
  customerIdFromUrl: string | null
  operatorId?: string | null
  hydrateAdminListRawRows: (raw: Record<string, unknown>[]) => Promise<AdminListHydratedSnapshot>
  /** 목록 본문 로드 완료 후 idle 시 배지 스냅샷 조회 */
  listReady: boolean
}

/**
 * 헤더 배지(처리 필요·Follow-up)용 경량 운영 큐 스냅샷.
 * RPC 후보 id → 슬림 예약 행만 hydrate (전 테이블 flat 스캔·모달 전량 로드와 분리).
 */
export function useOperationalQueueBadgeSnapshot({
  enabled,
  customerIdFromUrl,
  operatorId,
  hydrateAdminListRawRows,
  listReady,
}: UseOperationalQueueBadgeSnapshotArgs) {
  const [badgeSnapshot, setBadgeSnapshot] = useState<AdminListHydratedSnapshot | null>(null)
  const [badgeLoading, setBadgeLoading] = useState(false)
  const fetchGenRef = useRef(0)
  const inFlightRef = useRef(false)

  const clearBadgeSnapshot = useCallback(() => {
    fetchGenRef.current += 1
    inFlightRef.current = false
    setBadgeSnapshot(null)
    setBadgeLoading(false)
  }, [])

  const loadBadgeSnapshot = useCallback(async () => {
    if (!enabled || inFlightRef.current) return
    inFlightRef.current = true
    const gen = ++fetchGenRef.current
    setBadgeLoading(true)

    try {
      const { ids, error: candidateError, usedRpc } = await fetchOperationalQueueCandidateIds(
        supabase,
        customerIdFromUrl
      )
      if (gen !== fetchGenRef.current) return
      if (candidateError) throw candidateError
      if (!usedRpc || !ids?.length) {
        setBadgeSnapshot(null)
        return
      }

      let merged: AdminListHydratedSnapshot | null = null
      const { error: fetchErr } = await fetchReservationsByIdsProgressive(
        supabase,
        ids,
        {
          onChunk: async (rows) => {
            if (gen !== fetchGenRef.current) return false
            if (rows.length === 0) return true
            const hydrated = await hydrateAdminListRawRows(rows)
            if (gen !== fetchGenRef.current) return false
            merged = mergeAdminListHydratedSnapshots(merged, hydrated)
            return true
          },
        },
        operatorId
      )
      if (fetchErr) throw fetchErr
      if (gen !== fetchGenRef.current) return
      setBadgeSnapshot(merged)
    } catch (e) {
      if (gen !== fetchGenRef.current) return
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          `useOperationalQueueBadgeSnapshot: ${describeError(e)}`,
          serializeError(e)
        )
      }
      setBadgeSnapshot(null)
    } finally {
      inFlightRef.current = false
      if (gen === fetchGenRef.current) setBadgeLoading(false)
    }
  }, [enabled, customerIdFromUrl, operatorId, hydrateAdminListRawRows])

  useEffect(() => {
    clearBadgeSnapshot()
  }, [customerIdFromUrl, operatorId, clearBadgeSnapshot])

  useEffect(() => {
    if (!enabled || !listReady || badgeSnapshot || inFlightRef.current) return
    return scheduleDeferredWork(() => {
      void loadBadgeSnapshot()
    }, 1200)
  }, [enabled, listReady, badgeSnapshot, loadBadgeSnapshot])

  return {
    badgeSnapshot,
    badgeLoading,
    loadBadgeSnapshot,
    clearBadgeSnapshot,
  }
}
