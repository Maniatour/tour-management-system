import { useEffect, useMemo, useState } from 'react'
import { fetchCancellationFollowUpMeta } from '@/lib/reservationCancellationReason'

/** `reservation_follow_ups` 취소 사유 — 재예약 제외·Follow-up 필터 등에 사용 */
export function useCancellationReasonByReservationId(reservationIds: string[]): {
  reasonById: Map<string, string>
  loading: boolean
} {
  const idsKey = useMemo(
    () =>
      [...new Set(reservationIds.map((x) => String(x).trim()).filter(Boolean))]
        .sort()
        .join('\u0001'),
    [reservationIds]
  )

  const [reasonById, setReasonById] = useState<Map<string, string>>(() => new Map())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const ids = idsKey ? idsKey.split('\u0001').filter(Boolean) : []
    if (ids.length === 0) {
      setReasonById(new Map())
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    void fetchCancellationFollowUpMeta(ids)
      .then((meta) => {
        if (cancelled) return
        const map = new Map<string, string>()
        for (const [id, m] of meta) {
          const reason = m.reason?.trim()
          if (reason) map.set(id, reason)
        }
        setReasonById(map)
        setLoading(false)
      })
      .catch((e) => {
        if (!cancelled) {
          console.error('useCancellationReasonByReservationId:', e)
          setReasonById(new Map())
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [idsKey])

  return { reasonById, loading }
}
