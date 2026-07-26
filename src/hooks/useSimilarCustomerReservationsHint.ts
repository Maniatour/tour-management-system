'use client'

import { useEffect, useState } from 'react'
import { createClientSupabase } from '@/lib/supabase'
import { checkHasSimilarCustomerReservations } from '@/lib/similarCustomerReservations'
import type { Customer } from '@/types/reservation'

const hintCache = new Map<string, boolean>()

export function invalidateSimilarCustomerReservationsHint(customerId?: string) {
  if (customerId) {
    hintCache.delete(customerId)
    return
  }
  hintCache.clear()
}

export function useSimilarCustomerReservationsHint(
  customer: Customer | null | undefined,
  allCustomers: Customer[],
  productMap: Map<string, string> | undefined,
  operatorId?: string | null,
  enabled = true
): boolean {
  const [hasSimilar, setHasSimilar] = useState(false)
  const customerId = customer?.id ?? ''

  useEffect(() => {
    if (!enabled || !customerId || !customer || !productMap) {
      setHasSimilar(false)
      return
    }

    const cached = hintCache.get(customerId)
    if (cached !== undefined) {
      setHasSimilar(cached)
      return
    }

    let cancelled = false
    const supabase = createClientSupabase()

    void checkHasSimilarCustomerReservations(supabase, customer, allCustomers, productMap, operatorId)
      .then((result) => {
        hintCache.set(customerId, result)
        if (!cancelled) setHasSimilar(result)
      })
      .catch(() => {
        hintCache.set(customerId, false)
        if (!cancelled) setHasSimilar(false)
      })

    return () => {
      cancelled = true
    }
  }, [enabled, customerId, customer, allCustomers, productMap, operatorId])

  return hasSimilar
}
