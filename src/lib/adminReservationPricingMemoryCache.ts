/**
 * 예약 관리 목록: pricing 인메모리 캐시.
 * 주/월 전환·skipHeavy 후 재hydrate 시 동일 ID의 네트워크를 줄인다.
 */

import type { ReservationPricingMapValue } from '@/types/reservationPricingMap'

const MAX_ENTRIES = 4000
const store = new Map<string, ReservationPricingMapValue>()

function touch(id: string, value: ReservationPricingMapValue) {
  store.delete(id)
  store.set(id, value)
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value
    if (oldest === undefined) break
    store.delete(oldest)
  }
}

export function readAdminReservationPricingMemory(
  reservationIds: string[]
): Map<string, ReservationPricingMapValue> {
  const out = new Map<string, ReservationPricingMapValue>()
  for (const raw of reservationIds) {
    const id = String(raw ?? '').trim()
    if (!id) continue
    const hit = store.get(id)
    if (hit) {
      touch(id, hit)
      out.set(id, hit)
    }
  }
  return out
}

export function writeAdminReservationPricingMemory(
  map: Map<string, ReservationPricingMapValue>
): void {
  map.forEach((value, id) => {
    const key = String(id ?? '').trim()
    if (!key) return
    touch(key, value)
  })
}

export function invalidateAdminReservationPricingMemory(ids?: string[]): void {
  if (!ids) {
    store.clear()
    return
  }
  for (const raw of ids) {
    const id = String(raw ?? '').trim()
    if (id) store.delete(id)
  }
}
