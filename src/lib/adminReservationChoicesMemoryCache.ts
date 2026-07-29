/**
 * 예약 관리 카드 choices 배치 결과 인메모리 캐시.
 * 주 전환·리마운트 후에도 `/choices/batch` 재호출을 줄인다.
 */

import type { PrefetchedChoiceRow } from '@/lib/adminReservationCardPrefetch'

const MAX_ENTRIES = 3000
const store = new Map<string, PrefetchedChoiceRow[]>()

function touch(id: string, value: PrefetchedChoiceRow[]) {
  store.delete(id)
  store.set(id, value)
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value
    if (oldest === undefined) break
    store.delete(oldest)
  }
}

export function readAdminReservationChoicesMemory(
  reservationIds: string[]
): Map<string, PrefetchedChoiceRow[]> {
  const out = new Map<string, PrefetchedChoiceRow[]>()
  for (const raw of reservationIds) {
    const id = String(raw ?? '').trim()
    if (!id || !store.has(id)) continue
    const hit = store.get(id)!
    touch(id, hit)
    out.set(id, hit)
  }
  return out
}

export function writeAdminReservationChoicesMemory(
  map: Map<string, PrefetchedChoiceRow[]>
): void {
  map.forEach((value, id) => {
    const key = String(id ?? '').trim()
    if (!key) return
    touch(key, value)
  })
}

export function seedChoicesCacheRefFromMemory(
  reservationIds: string[],
  choicesCacheRef: { current: Map<string, PrefetchedChoiceRow[]> }
): void {
  const hits = readAdminReservationChoicesMemory(reservationIds)
  hits.forEach((rows, id) => {
    if (!choicesCacheRef.current.has(id)) {
      choicesCacheRef.current.set(id, rows)
    }
  })
}

export function invalidateAdminReservationChoicesMemory(ids?: string[]): void {
  if (!ids) {
    store.clear()
    return
  }
  for (const raw of ids) {
    const id = String(raw ?? '').trim()
    if (id) store.delete(id)
  }
}
