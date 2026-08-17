import { supabase } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { chunkStrings } from '@/lib/supabaseInChunks'
import type { SupabaseClient } from '@supabase/supabase-js'

export type CancellationFollowUpMeta = { reason: string; firstRecordedAt: string | null }

/** 취소 사유 프리셋 `재예약` / `Rebooking` — 순예약·취소 Follow-up 집계에서 제외 */
export function isRebookingCancellationReason(reason: string | null | undefined): boolean {
  const s = String(reason ?? '').trim().toLowerCase()
  if (!s) return false
  return s === '재예약' || s === 'rebooking'
}

export function isRebookingReservationByReasonMap(
  reservationId: string | null | undefined,
  reasonById: ReadonlyMap<string, string> | Record<string, string | null | undefined> | null | undefined
): boolean {
  const id = String(reservationId ?? '').trim()
  if (!id || !reasonById) return false
  const reason =
    reasonById instanceof Map
      ? reasonById.get(id)
      : (reasonById as Record<string, string | null | undefined>)[id]
  return isRebookingCancellationReason(reason)
}

/** Follow-up 「내용 추가」(type=contact) — 최신순 */
export async function fetchFollowUpContactContents(
  reservationIds: string[],
  client: SupabaseClient = supabase as SupabaseClient
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  const chunks = chunkStrings(reservationIds)
  if (chunks.length === 0) return map

  for (const chunk of chunks) {
    const { data, error } = await fromUntypedTable(client, 'reservation_follow_ups')
      .select('reservation_id, content, created_at')
      .in('reservation_id', chunk)
      .eq('type', 'contact')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('fetchFollowUpContactContents:', error)
      continue
    }
    for (const row of data || []) {
      const typed = row as unknown as { reservation_id: string; content?: string | null }
      const content = String(typed.content ?? '').trim()
      if (!content) continue
      const rid = String(typed.reservation_id)
      const list = map.get(rid) || []
      list.push(content)
      map.set(rid, list)
    }
  }
  return map
}

export async function fetchCancellationFollowUpMeta(
  reservationIds: string[],
  client: SupabaseClient = supabase as SupabaseClient
): Promise<Map<string, CancellationFollowUpMeta>> {
  const map = new Map<string, CancellationFollowUpMeta>()
  const chunks = chunkStrings(reservationIds)
  if (chunks.length === 0) return map

  const grouped = new Map<string, Array<{ content: string | null; created_at: string | null }>>()

  for (const chunk of chunks) {
    const { data, error } = await fromUntypedTable(client, 'reservation_follow_ups')
      .select('reservation_id, content, created_at')
      .in('reservation_id', chunk)
      .eq('type', 'cancellation_reason')
      .order('created_at', { ascending: true })
    if (error) {
      console.error('fetchCancellationFollowUpMeta:', error)
      continue
    }
    for (const row of data || []) {
      const typed = row as unknown as { reservation_id: string; content?: string | null; created_at?: string | null }
      const rid = String(typed.reservation_id)
      const list = grouped.get(rid) || []
      list.push({
        content: typed.content ?? null,
        created_at: typed.created_at ?? null,
      })
      grouped.set(rid, list)
    }
  }

  for (const [rid, rows] of grouped) {
    const sorted = [...rows].sort((a, b) =>
      String(a.created_at || '').localeCompare(String(b.created_at || ''))
    )
    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    const reason =
      last?.content != null && String(last.content).trim() ? String(last.content).trim() : ''
    map.set(rid, {
      reason,
      firstRecordedAt: first?.created_at ? String(first.created_at) : null,
    })
  }
  return map
}

export function attachCancellationFollowUpMeta<T extends { id: string }>(
  rows: T[],
  metaMap: Map<string, CancellationFollowUpMeta>
): (T & { cancellation_reason?: string | null; cancellation_recorded_at?: string | null })[] {
  return rows.map((r) => {
    const m = metaMap.get(String(r.id))
    return {
      ...r,
      cancellation_reason: m !== undefined ? (m.reason ? m.reason : null) : null,
      cancellation_recorded_at: m?.firstRecordedAt ?? null,
    }
  })
}

async function resolveCreatedByEmail(providedEmail?: string | null): Promise<string | null> {
  if (providedEmail && providedEmail.trim()) return providedEmail.trim()
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.user?.email ?? null
  } catch {
    return null
  }
}

export async function upsertReservationCancellationReason(
  reservationId: string,
  reason: string,
  createdByEmail?: string | null
): Promise<void> {
  const trimmed = reason.trim()
  if (!reservationId || !trimmed) return

  const createdBy = await resolveCreatedByEmail(createdByEmail)

  const { data: existingRows, error: fetchError } = await fromUntypedTable(supabase, 'reservation_follow_ups')
    .select('id')
    .eq('reservation_id', reservationId)
    .eq('type', 'cancellation_reason')
    .order('created_at', { ascending: false })
    .limit(1)

  if (fetchError) throw fetchError

  const existingId = existingRows?.[0]?.id ?? null
  if (existingId) {
    const { error: updateError } = await fromUntypedTable(supabase, 'reservation_follow_ups')
      .update({ content: trimmed })
      .eq('id', existingId)
    if (updateError) throw updateError
    return
  }

  const { error: insertError } = await fromUntypedTable(supabase, 'reservation_follow_ups').insert({
    reservation_id: reservationId,
    type: 'cancellation_reason',
    content: trimmed,
    created_by: createdBy,
  })
  if (insertError) throw insertError
}
