import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import {
  reservationAuditRowHasStatusFieldChange,
  reservationStatusEventRowToAuditRow,
  statusFromReservationAuditJson,
  type ReservationStatusAuditRow,
} from '@/lib/reservationStatusAudit'

export type ReservationStatusEventDbRow = {
  reservation_id: string
  from_status: string | null
  to_status: string | null
  occurred_at: string
}

const DEFAULT_CHUNK_SIZE = 80
/** 브라우저 전역 Supabase 동시성(6)과 맞물리지 않게 한 단계 내 병렬 상한 */
const DEFAULT_CHUNK_CONCURRENCY = 3

function statusTransitionDedupeKey(row: ReservationStatusAuditRow): string {
  const from = statusFromReservationAuditJson(row.old_values) ?? ''
  const to = statusFromReservationAuditJson(row.new_values) ?? ''
  return `${row.record_id}|${row.created_at}|${from}|${to}`
}

function auditLogRowToStatusAuditRow(row: {
  record_id: string | null
  created_at: string
  changed_fields: string[] | null
  old_values: unknown
  new_values: unknown
}): ReservationStatusAuditRow | null {
  const recordId = String(row.record_id ?? '').trim()
  if (!recordId) return null
  const auditRow: ReservationStatusAuditRow = {
    record_id: recordId,
    created_at: row.created_at,
    changed_fields: row.changed_fields,
    old_values: row.old_values,
    new_values: row.new_values,
  }
  if (!reservationAuditRowHasStatusFieldChange(auditRow)) return null
  const to = statusFromReservationAuditJson(row.new_values)
  const from = statusFromReservationAuditJson(row.old_values)
  if (!to || (from !== null && from === to)) return null
  return auditRow
}

function mergeStatusTransitionRows(
  eventRows: ReservationStatusAuditRow[],
  auditRows: ReservationStatusAuditRow[]
): ReservationStatusAuditRow[] {
  const seen = new Set<string>()
  const out: ReservationStatusAuditRow[] = []
  for (const row of eventRows) {
    const key = statusTransitionDedupeKey(row)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  for (const row of auditRows) {
    const key = statusTransitionDedupeKey(row)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
}

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

/**
 * 트리거 누락·백필 전 구간 보완: `audit_logs`에서 동일 예약·구간의 status UPDATE만 조회.
 * PostgREST `changed_fields @> {status}` 는 500이 나는 환경이 있어 클라이언트에서 필터한다.
 */
async function fetchReservationStatusAuditLogsChunked(
  supabase: SupabaseClient<Database>,
  args: {
    reservationIds: string[]
    rangeStartIso: string
    rangeEndIso: string
    chunkSize?: number
    chunkConcurrency?: number
    shouldAbort?: () => boolean
  }
): Promise<{ rows: ReservationStatusAuditRow[]; error: unknown | null }> {
  const chunkSize = args.chunkSize ?? DEFAULT_CHUNK_SIZE
  const chunkConcurrency = args.chunkConcurrency ?? DEFAULT_CHUNK_CONCURRENCY
  const ids = args.reservationIds.map((x) => String(x).trim()).filter(Boolean)
  const rows: ReservationStatusAuditRow[] = []

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
          .from('audit_logs')
          .select('record_id, created_at, changed_fields, old_values, new_values')
          .eq('table_name', 'reservations')
          .eq('action', 'UPDATE')
          .gte('created_at', args.rangeStartIso)
          .lte('created_at', args.rangeEndIso)
          .in('record_id', chunk)
        return { data, error }
      })
    )

    for (const r of results) {
      if (r.error) {
        return { rows, error: r.error }
      }
      for (const raw of r.data || []) {
        const mapped = auditLogRowToStatusAuditRow(
          raw as {
            record_id: string | null
            created_at: string
            changed_fields: string[] | null
            old_values: unknown
            new_values: unknown
          }
        )
        if (mapped) rows.push(mapped)
      }
    }
  }

  return { rows, error: null }
}

/**
 * 심플 카드·등록/취소 차트용 status 전환 조회.
 * `reservation_status_events` 우선, events에 없는 건 `audit_logs`로 보완(5/15 이후 트리거 누락 대응).
 */
export async function fetchReservationStatusTransitionsChunked(
  supabase: SupabaseClient<Database>,
  args: {
    reservationIds: string[]
    rangeStartIso: string
    rangeEndIso: string
    chunkSize?: number
    chunkConcurrency?: number
    shouldAbort?: () => boolean
  }
): Promise<{ rows: ReservationStatusAuditRow[]; error: unknown | null }> {
  const [eventsResult, auditResult] = await Promise.all([
    fetchReservationStatusEventsChunked(supabase, args),
    fetchReservationStatusAuditLogsChunked(supabase, args),
  ])

  if (eventsResult.error) return { rows: [], error: eventsResult.error }
  if (auditResult.error) return { rows: [], error: auditResult.error }

  const eventAuditRows: ReservationStatusAuditRow[] = []
  for (const row of eventsResult.rows) {
    const mapped = reservationStatusEventRowToAuditRow(row)
    if (reservationAuditRowHasStatusFieldChange(mapped)) eventAuditRows.push(mapped)
  }

  return {
    rows: mergeStatusTransitionRows(eventAuditRows, auditResult.rows),
    error: null,
  }
}
