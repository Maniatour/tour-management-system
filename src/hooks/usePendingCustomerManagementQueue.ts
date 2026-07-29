'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PENDING_CUSTOMER_MANAGEMENT_REFRESH_EVENT } from '@/lib/pendingCustomerManagementRefresh'
import {
  fetchPendingCustomerManagementQueueData,
  type PendingCustomerManagementQueueItem,
} from '@/lib/pendingCustomerManagementQueue'
import {
  buildTodoPanelProductNameMap,
  fetchTodoPanelCatalog,
} from '@/lib/todoPanelCatalogCache'
import type { Customer } from '@/types/reservation'
import type { PendingCustomerResolutionKind } from '@/lib/pendingCustomerManagementWorkflow'

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

export function usePendingCustomerManagementQueue(enabled = true) {
  const [items, setItems] = useState<PendingCustomerManagementQueueItem[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<QueueProduct[]>([])
  const [channels, setChannels] = useState<QueueChannel[]>([])
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' })
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
      const data = await fetchPendingCustomerManagementQueueData(supabase, productMap, tourMap)

      setItems(data.items)
      setCustomers(data.customers)
      setProducts(productList)
      setChannels(channelList)
      setDateRange(data.dateRange)
    } catch (e) {
      console.error('usePendingCustomerManagementQueue', e)
      setError(e instanceof Error ? e.message : 'load failed')
      setItems([])
      setCustomers([])
      setProducts([])
      setChannels([])
    } finally {
      if (!options?.silent) {
        setLoading(false)
      }
    }
  }, [enabled])

  const patchItemFlags = useCallback(
    (
      reservationId: string,
      flags: {
        altTourNoticeManual?: boolean
        hasCustomerResponse?: boolean
        resolutionKind?: PendingCustomerResolutionKind | null
      }
    ) => {
      setItems((prev) =>
        prev.map((item) =>
          item.reservation.id === reservationId
            ? {
                ...item,
                altTourNoticeManual: flags.altTourNoticeManual ?? item.altTourNoticeManual,
                hasCustomerResponse: flags.hasCustomerResponse ?? item.hasCustomerResponse,
                resolutionKind:
                  flags.resolutionKind !== undefined ? flags.resolutionKind : item.resolutionKind,
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
    const onRefresh = () => void reload({ silent: true })
    window.addEventListener(PENDING_CUSTOMER_MANAGEMENT_REFRESH_EVENT, onRefresh)
    return () => window.removeEventListener(PENDING_CUSTOMER_MANAGEMENT_REFRESH_EVENT, onRefresh)
  }, [enabled, reload])

  return {
    items,
    customers,
    products,
    channels,
    dateRange,
    loading,
    error,
    reload,
    patchItemFlags,
    count: items.length,
  }
}
