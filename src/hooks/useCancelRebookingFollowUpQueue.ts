'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CANCEL_REBOOKING_FOLLOW_UP_REFRESH_EVENT } from '@/lib/cancelRebookingFollowUpRefresh'
import {
  fetchCancelRebookingFollowUpQueueData,
  fetchTourCapacityByTourIds,
  type CancelRebookingFollowUpQueueItem,
  type CancelRebookingTourCapacity,
} from '@/lib/cancelRebookingFollowUpQueue'
import {
  buildTodoPanelProductNameMap,
  fetchTodoPanelCatalog,
} from '@/lib/todoPanelCatalogCache'
import type { Customer } from '@/types/reservation'

type QueueProduct = {
  id: string
  name?: string | null
  name_ko?: string | null
  name_en?: string | null
  customer_name_ko?: string | null
  customer_name_en?: string | null
}

type QueueChannel = {
  id: string
  name?: string | null
  favicon_url?: string | null
}

export function useCancelRebookingFollowUpQueue(enabled = true) {
  const [items, setItems] = useState<CancelRebookingFollowUpQueueItem[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<QueueProduct[]>([])
  const [channels, setChannels] = useState<QueueChannel[]>([])
  const [tourCapacityByTourId, setTourCapacityByTourId] = useState<
    Map<string, CancelRebookingTourCapacity>
  >(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async (options?: { silent?: boolean }) => {
    if (!enabled) return
    if (!options?.silent) {
      setLoading(true)
    }
    setError(null)
    try {
      const { products: productList, channels: channelList, tourIdMap: tourMap } =
        await fetchTodoPanelCatalog()

      const productMap = buildTodoPanelProductNameMap(productList)
      const data = await fetchCancelRebookingFollowUpQueueData(supabase, productMap, tourMap)
      const tourIds = data.items
        .map((item) => item.reservation.tourId)
        .filter((id): id is string => Boolean(id && String(id).trim()))
      const capacityMap = await fetchTourCapacityByTourIds(supabase, tourIds)

      setItems(data.items)
      setCustomers(data.customers)
      setProducts(productList)
      setChannels(channelList)
      setTourCapacityByTourId(capacityMap)
    } catch (e) {
      console.error('useCancelRebookingFollowUpQueue', e)
      setError(e instanceof Error ? e.message : 'load failed')
      setItems([])
      setCustomers([])
      setProducts([])
      setChannels([])
      setTourCapacityByTourId(new Map())
    } finally {
      if (!options?.silent) {
        setLoading(false)
      }
    }
  }, [enabled])

  const patchItemManualFlags = useCallback(
    (
      reservationId: string,
      flags: { cancelFollowUpManual: boolean; cancelRebookingOutreachManual: boolean }
    ) => {
      setItems((prev) =>
        prev.map((item) =>
          item.reservation.id === reservationId
            ? {
                ...item,
                cancelFollowUpManual: flags.cancelFollowUpManual,
                cancelRebookingOutreachManual: flags.cancelRebookingOutreachManual,
              }
            : item
        )
      )
    },
    []
  )

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!enabled) return
    const onRefresh = () => void reload()
    window.addEventListener(CANCEL_REBOOKING_FOLLOW_UP_REFRESH_EVENT, onRefresh)
    return () => window.removeEventListener(CANCEL_REBOOKING_FOLLOW_UP_REFRESH_EVENT, onRefresh)
  }, [enabled, reload])

  return {
    items,
    customers,
    products,
    channels,
    tourCapacityByTourId,
    loading,
    error,
    reload,
    patchItemManualFlags,
    count: items.length,
  }
}
