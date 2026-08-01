'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchReservationSmsLogSummaries,
  type ReservationSmsLogSummary,
} from '@/lib/reservationSmsLogSummaries'

type ReservationLite = { id: string }

function buildReservationIdsKey(reservations: ReservationLite[]): string {
  return reservations
    .map((r) => String(r.id ?? '').trim())
    .filter(Boolean)
    .sort()
    .join(',')
}

export function useReservationSmsLogSummaries(
  reservations: ReservationLite[],
  refreshToken = 0
): {
  summariesByReservationId: Map<string, ReservationSmsLogSummary>
  loading: boolean
  refreshReservationIds: (reservationIds: string[]) => Promise<void>
} {
  const reservationIdsKey = useMemo(() => buildReservationIdsKey(reservations), [reservations])
  const [summariesByReservationId, setSummariesByReservationId] = useState<
    Map<string, ReservationSmsLogSummary>
  >(new Map())
  const [loading, setLoading] = useState(false)
  const loadedIdsRef = useRef<Set<string>>(new Set())
  const fetchGenRef = useRef(0)

  const refreshReservationIds = useCallback(async (reservationIds: string[]) => {
    const ids = [...new Set(reservationIds.map((id) => String(id ?? '').trim()).filter(Boolean))]
    if (ids.length === 0) return

    const fetched = await fetchReservationSmsLogSummaries(ids)
    setSummariesByReservationId((prev) => {
      const next = new Map(prev)
      for (const id of ids) {
        next.set(id, fetched.get(id) ?? { latest: null, byCategory: {} })
        loadedIdsRef.current.add(id)
      }
      return next
    })
  }, [])

  useEffect(() => {
    if (refreshToken > 0) {
      loadedIdsRef.current.clear()
    }
  }, [refreshToken])

  useEffect(() => {
    const ids = reservationIdsKey ? reservationIdsKey.split(',') : []
    if (ids.length === 0) return

    const missing = ids.filter((id) => !loadedIdsRef.current.has(id))
    if (missing.length === 0) return

    const gen = ++fetchGenRef.current
    let cancelled = false

    ;(async () => {
      setLoading(true)
      try {
        const fetched = await fetchReservationSmsLogSummaries(missing)
        if (cancelled || gen !== fetchGenRef.current) return

        setSummariesByReservationId((prev) => {
          const next = new Map(prev)
          for (const id of missing) {
            next.set(id, fetched.get(id) ?? { latest: null, byCategory: {} })
            loadedIdsRef.current.add(id)
          }
          return next
        })
      } catch (e) {
        console.error('useReservationSmsLogSummaries:', e)
      } finally {
        if (!cancelled && gen === fetchGenRef.current) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [reservationIdsKey, refreshToken])

  return { summariesByReservationId, loading, refreshReservationIds }
}
