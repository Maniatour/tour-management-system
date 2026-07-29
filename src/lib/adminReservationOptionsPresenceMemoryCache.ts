/**
 * 예약 관리 목록: options presence 인메모리 캐시.
 * skipHeavy 후 가시/idle hydrate 시 동일 ID 재조회를 줄인다.
 */

const MAX_ENTRIES = 4000
const store = new Map<string, boolean>()

function touch(id: string, value: boolean) {
  store.delete(id)
  store.set(id, value)
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value
    if (oldest === undefined) break
    store.delete(oldest)
  }
}

export function readAdminReservationOptionsPresenceMemory(
  reservationIds: string[]
): Map<string, boolean> {
  const out = new Map<string, boolean>()
  for (const raw of reservationIds) {
    const id = String(raw ?? '').trim()
    if (!id) continue
    if (!store.has(id)) continue
    const hit = store.get(id)!
    touch(id, hit)
    out.set(id, hit)
  }
  return out
}

export function writeAdminReservationOptionsPresenceMemory(
  map: Map<string, boolean>
): void {
  map.forEach((value, id) => {
    const key = String(id ?? '').trim()
    if (!key) return
    touch(key, value)
  })
}

export function invalidateAdminReservationOptionsPresenceMemory(ids?: string[]): void {
  if (!ids) {
    store.clear()
    return
  }
  for (const raw of ids) {
    const id = String(raw ?? '').trim()
    if (id) store.delete(id)
  }
}
