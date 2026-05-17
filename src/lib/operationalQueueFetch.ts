import type { SupabaseClient } from '@supabase/supabase-js'
import { RESERVATION_LIST_SELECT } from '@/lib/reservationListSelect'

const ID_CHUNK = 200
const ID_FETCH_PARALLEL = 3
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isRpcMissing(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  const code = String(err.code ?? '')
  const msg = (err.message ?? '').toLowerCase()
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    msg.includes('admin_operational_queue_candidate_ids') ||
    (msg.includes('function') && msg.includes('does not exist'))
  )
}

function parseRpcIdRows(data: unknown): string[] {
  if (!Array.isArray(data)) return []
  const out: string[] = []
  for (const row of data) {
    if (typeof row === 'string' && row) {
      out.push(row)
      continue
    }
    if (row && typeof row === 'object') {
      const id =
        'admin_operational_queue_candidate_ids' in row
          ? (row as { admin_operational_queue_candidate_ids: string }).admin_operational_queue_candidate_ids
          : 'id' in row
            ? (row as { id: string }).id
            : null
      if (id) out.push(String(id))
    }
  }
  return [...new Set(out)]
}

/** RPC로 운영 큐 후보 예약 id (마이그레이션 미적용 시 null) */
export async function fetchOperationalQueueCandidateIds(
  supabase: SupabaseClient,
  customerIdFromUrl: string | null
): Promise<{ ids: string[] | null; error: Error | null; usedRpc: boolean }> {
  const customerUuid =
    customerIdFromUrl && UUID_RE.test(customerIdFromUrl.trim()) ? customerIdFromUrl.trim() : null

  const { data, error } = await supabase.rpc('admin_operational_queue_candidate_ids', {
    p_customer_id: customerUuid,
  })

  if (error) {
    if (isRpcMissing(error)) {
      return { ids: null, error: null, usedRpc: false }
    }
    return { ids: null, error: error as Error, usedRpc: true }
  }

  return { ids: parseRpcIdRows(data), error: null, usedRpc: true }
}

export type FetchReservationsByIdsChunkHandlers = {
  onChunk: (rows: Record<string, unknown>[]) => boolean | void | Promise<boolean | void>
}

/** 운영 큐 스냅샷에 실제 예약이 있을 때만 true (빈 `reservations: []`는 미로드로 간주) */
export function operationalQueueHasReservations(
  snapshot: { reservations?: unknown[] } | null | undefined
): boolean {
  return (snapshot?.reservations?.length ?? 0) > 0
}

/** Follow-up·처리필요 모달: 운영 큐가 비어 있으면 목록 필터 결과로 폴백 */
export function pickReservationsForOperationalQueue<T>(
  snapshot: { reservations?: T[] } | null | undefined,
  fallback: T[]
): T[] {
  const op = snapshot?.reservations
  return op && op.length > 0 ? op : fallback
}

/** 후보 id만 `RESERVATION_LIST_SELECT`로 배치 조회 */
export async function fetchReservationsByIdsProgressive(
  supabase: SupabaseClient,
  ids: string[],
  handlers: FetchReservationsByIdsChunkHandlers
): Promise<{ error: Error | null; loadedRowCount: number }> {
  const unique = [...new Set(ids.map((id) => String(id ?? '').trim()).filter(Boolean))]
  if (unique.length === 0) {
    return { error: null, loadedRowCount: 0 }
  }

  let loadedRowCount = 0
  try {
    const idChunks: string[][] = []
    for (let i = 0; i < unique.length; i += ID_CHUNK) {
      idChunks.push(unique.slice(i, i + ID_CHUNK))
    }

    for (let i = 0; i < idChunks.length; i += ID_FETCH_PARALLEL) {
      const slice = idChunks.slice(i, i + ID_FETCH_PARALLEL)
      const results = await Promise.all(
        slice.map(async (chunkIds) => {
          const { data, error } = await supabase
            .from('reservations')
            .select(RESERVATION_LIST_SELECT)
            .in('id', chunkIds)
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
          return { data, error }
        })
      )

      for (const { data, error } of results) {
        if (error) {
          return { error: error as Error, loadedRowCount }
        }
        const batch = (data || []) as Record<string, unknown>[]
        if (batch.length === 0) continue
        loadedRowCount += batch.length
        const keepGoing = await handlers.onChunk(batch)
        if (keepGoing === false) {
          return { error: null, loadedRowCount }
        }
      }
    }
    return { error: null, loadedRowCount }
  } catch (e) {
    return {
      error: e instanceof Error ? e : new Error(String(e)),
      loadedRowCount,
    }
  }
}
