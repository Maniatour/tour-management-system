import { fetchApiWithAuth } from '@/lib/api-client-bearer'

/** 같은 예약은 15분간 Resend 재조회 생략 (동기화 성공·대상 없음일 때만) */
const SYNC_TTL_MS = 15 * 60 * 1000
const MAX_RESERVATIONS_PER_REQUEST = 4
const lastSyncedAtByReservationId = new Map<string, number>()

export function reservationIdsNeedingEmailDeliverySync(reservationIds: string[]): string[] {
  const now = Date.now()
  return [
    ...new Set(reservationIds.map((id) => String(id ?? '').trim()).filter(Boolean)),
  ].filter((id) => now - (lastSyncedAtByReservationId.get(id) ?? 0) > SYNC_TTL_MS)
}

export function markEmailDeliverySyncAttempted(reservationIds: string[]) {
  const now = Date.now()
  for (const id of reservationIds) {
    const rid = String(id ?? '').trim()
    if (rid) lastSyncedAtByReservationId.set(rid, now)
  }
}

export function clearEmailDeliverySyncCache(reservationId?: string) {
  if (reservationId) {
    lastSyncedAtByReservationId.delete(reservationId)
    return
  }
  lastSyncedAtByReservationId.clear()
}

async function syncReservationBatch(
  reservationIds: string[]
): Promise<{ synced: number; checked: number; updatedReservationIds: string[] }> {
  const response = await fetchApiWithAuth('/api/email-logs/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reservationIds }),
  })
  const data = (await response.json().catch(() => ({}))) as {
    synced?: number
    checked?: number
    updatedReservationIds?: string[]
    error?: string
  }
  if (!response.ok) {
    console.warn('[emailLogDeliverySyncClient]', data.error ?? response.status)
    return { synced: 0, checked: 0, updatedReservationIds: [] }
  }
  return {
    synced: data.synced ?? 0,
    checked: data.checked ?? 0,
    updatedReservationIds: data.updatedReservationIds ?? [],
  }
}

/** sent 상태 로그를 Resend와 동기화 (배치, staff API) */
export async function syncPendingEmailLogsForReservations(
  reservationIds: string[]
): Promise<{ synced: number; checked: number; updatedReservationIds: string[] }> {
  const toSync = reservationIdsNeedingEmailDeliverySync(reservationIds)
  if (toSync.length === 0) {
    return { synced: 0, checked: 0, updatedReservationIds: [] }
  }

  let totalSynced = 0
  let totalChecked = 0
  const allUpdated = new Set<string>()
  const noPendingIds = new Set<string>()

  try {
    for (let i = 0; i < toSync.length; i += MAX_RESERVATIONS_PER_REQUEST) {
      const batch = toSync.slice(i, i + MAX_RESERVATIONS_PER_REQUEST)
      const result = await syncReservationBatch(batch)
      totalSynced += result.synced
      totalChecked += result.checked
      for (const id of result.updatedReservationIds) allUpdated.add(id)

      // 이 배치에 대해 조회 대상 로그가 없었으면(이미 delivered 등) 캐시 가능
      if (result.checked === 0) {
        for (const id of batch) noPendingIds.add(id)
      }

      if (i + MAX_RESERVATIONS_PER_REQUEST < toSync.length) {
        await new Promise((r) => setTimeout(r, 300))
      }
    }

    if (noPendingIds.size > 0) {
      markEmailDeliverySyncAttempted([...noPendingIds])
    }
    if (allUpdated.size > 0) {
      markEmailDeliverySyncAttempted([...allUpdated])
    }

    return {
      synced: totalSynced,
      checked: totalChecked,
      updatedReservationIds: [...allUpdated],
    }
  } catch (e) {
    console.warn('[emailLogDeliverySyncClient]', e)
    return { synced: 0, checked: 0, updatedReservationIds: [] }
  }
}

export function snapshotHasPendingEmailDelivery(
  snapshot: { emailDelivery?: Partial<Record<string, string>> } | null | undefined
): boolean {
  if (!snapshot?.emailDelivery) return false
  return Object.values(snapshot.emailDelivery).some((state) => state === 'pending')
}
