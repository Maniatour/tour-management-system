/**
 * 운영 큐(처리 필요 / Follow-up) 하이드레이트 스냅샷 sessionStorage 캐시.
 * 모달 재오픈·hover prefetch 시 즉시 표시 후 백그라운드 갱신.
 */

import type { Reservation } from '@/types/reservation'
import type { ReservationPricingMapValue } from '@/types/reservationPricingMap'
import type { AdminListHydratedSnapshot, ReservationListTourMapRow } from '@/hooks/useReservationData'

export type AdminOperationalQueueCachePayload = {
  reservations: Reservation[]
  pricingMap: Record<string, ReservationPricingMapValue>
  reservationOptionsPresenceByReservationId: Record<string, boolean>
  toursMap: Record<string, ReservationListTourMapRow>
}

const CACHE_TTL_MS = 90 * 1000
const CACHE_KEY_PREFIX = 'admin-reservation-op-queue\u001f'

export function buildAdminOperationalQueueCacheKey(args: {
  operatorId: string | null | undefined
  customerIdFromUrl: string | null
}): string {
  return [CACHE_KEY_PREFIX, args.operatorId ?? '', args.customerIdFromUrl || ''].join('\u001f')
}

function snapshotToPayload(snapshot: AdminListHydratedSnapshot): AdminOperationalQueueCachePayload {
  const pricingMap: Record<string, ReservationPricingMapValue> = {}
  snapshot.pricingMap.forEach((v, k) => {
    pricingMap[k] = v
  })
  const reservationOptionsPresenceByReservationId: Record<string, boolean> = {}
  snapshot.reservationOptionsPresenceByReservationId.forEach((v, k) => {
    reservationOptionsPresenceByReservationId[k] = v
  })
  const toursMap: Record<string, ReservationListTourMapRow> = {}
  snapshot.toursMap.forEach((v, k) => {
    toursMap[k] = v
  })
  return {
    reservations: snapshot.reservations.slice(0, 800),
    pricingMap,
    reservationOptionsPresenceByReservationId,
    toursMap,
  }
}

function payloadToSnapshot(payload: AdminOperationalQueueCachePayload): AdminListHydratedSnapshot {
  return {
    reservations: Array.isArray(payload.reservations) ? payload.reservations : [],
    pricingMap: new Map(Object.entries(payload.pricingMap || {})),
    reservationOptionsPresenceByReservationId: new Map(
      Object.entries(payload.reservationOptionsPresenceByReservationId || {})
    ),
    toursMap: new Map(Object.entries(payload.toursMap || {})),
  }
}

export function readAdminOperationalQueueCache(
  key: string
): AdminListHydratedSnapshot | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { at: number; data: AdminOperationalQueueCachePayload }
    if (!parsed?.at || Date.now() - parsed.at > CACHE_TTL_MS) {
      sessionStorage.removeItem(key)
      return null
    }
    if (!parsed.data || !Array.isArray(parsed.data.reservations)) {
      sessionStorage.removeItem(key)
      return null
    }
    return payloadToSnapshot(parsed.data)
  } catch {
    return null
  }
}

export function writeAdminOperationalQueueCache(
  key: string,
  snapshot: AdminListHydratedSnapshot
): void {
  if (typeof sessionStorage === 'undefined') return
  if (!snapshot.reservations?.length) return
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({ at: Date.now(), data: snapshotToPayload(snapshot) })
    )
  } catch {
    /* quota */
  }
}
