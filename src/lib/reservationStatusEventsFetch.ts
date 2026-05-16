import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

export type ReservationStatusEventDbRow = {
  reservation_id: string
  from_status: string | null
  to_status: string | null
  occurred_at: string
}

const DEFAULT_CHUNK_SIZE = 80
/** 브라우저 전역 Supabase 동시성(6)과 맞물리지 않게 한 단계 내 병렬 상한 */
const DEFAULT_CHUNK_CONCURRENCY = 3

/**
 * `reservation_status_events`를 reservation_id IN 청크로 나눠 조회한다.
 * 청크끼리는 소량 병렬로 실행해 순차 대비 왕복 시간을 줄인다.
 */
export async function fetchReservationStatusEventsChunked(
  supabase: SupabaseClient<Database>,
  args: {
    reservationIds: string[]
    rangeStartIso: string
    rangeEndIso: string
    chunkSize?: number
    chunkConcurrency?: number
    shouldAbort?: () => boolean
  }
): Promise<{ rows: ReservationStatusEventDbRow[]; error: unknown | null }> {
  const chunkSize = args.chunkSize ?? DEFAULT_CHUNK_SIZE
  const chunkConcurrency = args.chunkConcurrency ?? DEFAULT_CHUNK_CONCURRENCY
  const ids = args.reservationIds.map((x) => String(x).trim()).filter(Boolean)
  const rows: ReservationStatusEventDbRow[] = []

  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += chunkSize) {
    chunks.push(ids.slice(i, i + chunkSize))
  }

  for (let i = 0; i < chunks.length; i += chunkConcurrency) {
    if (args.shouldAbort?.()) {
      return { rows, error: null }
    }
    const batch = chunks.slice(i, i + chunkConcurrency)
    const results = await Promise.all(
      batch.map(async (chunk) => {
        const { data, error } = await supabase
          .from('reservation_status_events')
          .select('reservation_id, from_status, to_status, occurred_at')
          .gte('occurred_at', args.rangeStartIso)
          .lte('occurred_at', args.rangeEndIso)
          .in('reservation_id', chunk)
        return { data, error }
      })
    )

    for (const r of results) {
      if (r.error) {
        return { rows, error: r.error }
      }
      for (const row of r.data || []) {
        rows.push(row as ReservationStatusEventDbRow)
      }
    }
  }

  return { rows, error: null }
}
