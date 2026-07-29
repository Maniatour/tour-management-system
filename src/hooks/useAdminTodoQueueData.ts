'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  fetchOperationalQueueCandidateIds,
  fetchReservationsByIdsProgressive,
} from '@/lib/operationalQueueFetch'
import {
  mergeAdminListHydratedSnapshots,
  useReservationData,
  type AdminListHydratedSnapshot,
} from '@/hooks/useReservationData'
import { useOperatorOptional } from '@/contexts/OperatorContext'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'

type UseAdminTodoQueueDataArgs = {
  enabled: boolean
}

export function useAdminTodoQueueData({ enabled }: UseAdminTodoQueueDataArgs) {
  const { operatorId } = useOperatorOptional()
  const activeOperatorId = resolveOperatorId(operatorId)
  const {
    customers,
    products,
    channels,
    productOptions,
    optionChoices,
    pickupHotels,
    reservationPricingMap,
    toursMap: hookToursMap,
    hydrateAdminListRawRows,
    listCatalogLoading,
  } = useReservationData({
    disableReservationsAutoLoad: true,
    deferFormCatalogs: false,
    productsSelectLite: true,
    customersSelectLite: true,
    customersByReservationIds: true,
  })

  const [snapshot, setSnapshot] = useState<AdminListHydratedSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const genRef = useRef(0)

  const loadQueue = useCallback(async () => {
    const gen = ++genRef.current
    setLoading(true)
    try {
      const { ids, error, usedRpc } = await fetchOperationalQueueCandidateIds(
        supabase,
        null,
        activeOperatorId
      )
      if (gen !== genRef.current) return
      if (error) throw error
      if (!usedRpc || !ids?.length) {
        setSnapshot(null)
        return
      }

      let merged: AdminListHydratedSnapshot | null = null
      const { error: fetchErr } = await fetchReservationsByIdsProgressive(supabase, ids, {
        onChunk: async (rows) => {
          if (gen !== genRef.current) return false
          if (!rows.length) return true
          const hydrated = await hydrateAdminListRawRows(rows)
          if (gen !== genRef.current) return false
          merged = mergeAdminListHydratedSnapshots(merged, hydrated)
          setSnapshot(merged)
          return true
        },
      })
      if (gen !== genRef.current) return
      if (fetchErr) throw fetchErr
      setSnapshot(merged)
    } catch (e) {
      console.error('useAdminTodoQueueData', e)
      setSnapshot(null)
    } finally {
      if (gen === genRef.current) setLoading(false)
    }
  }, [activeOperatorId, hydrateAdminListRawRows])

  useEffect(() => {
    if (!enabled) {
      genRef.current += 1
      setSnapshot(null)
      setLoading(false)
      return
    }
    void loadQueue()
  }, [enabled, loadQueue])

  const toursMap = snapshot?.toursMap.size ? snapshot.toursMap : hookToursMap
  const pricingMap = snapshot?.pricingMap.size
    ? new Map([...reservationPricingMap, ...snapshot.pricingMap])
    : reservationPricingMap

  return {
    snapshot,
    loading: loading || listCatalogLoading,
    reload: loadQueue,
    customers,
    products,
    channels,
    productOptions,
    optionChoices,
    pickupHotels,
    reservationPricingMap: pricingMap,
    toursMap,
  }
}
