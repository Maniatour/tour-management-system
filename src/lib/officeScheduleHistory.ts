import type { SupabaseClient } from '@supabase/supabase-js'
import { officeScheduleSlotKey } from '@/lib/officeScheduleMonthDays'

export type OfficeScheduleRevisionRow = {
  id: string
  scope_month: string
  date_from: string
  date_to: string
  action: 'save' | 'restore'
  restored_from_id: string | null
  saved_by_email: string
  saved_by_name: string | null
  deleted_count: number
  upserted_count: number
  slot_count: number
  created_at: string
}

export type SlotMap = Map<string, { note: string | null }>

type SlotJson = {
  employee_email: string
  schedule_date: string
  hour_slot: number
  note: string | null
}

export function slotsJsonToSlotMap(slots: SlotJson[]): SlotMap {
  const map: SlotMap = new Map()
  for (const row of slots) {
    const date =
      typeof row.schedule_date === 'string'
        ? row.schedule_date.slice(0, 10)
        : String(row.schedule_date)
    const key = officeScheduleSlotKey(row.employee_email, date, row.hour_slot)
    map.set(key, { note: row.note ?? null })
  }
  return map
}

export async function listOfficeScheduleRevisions(
  client: SupabaseClient,
  scopeMonth: string,
  limit = 40
): Promise<OfficeScheduleRevisionRow[]> {
  const { data, error } = await client.rpc('list_office_schedule_revisions', {
    p_scope_month: scopeMonth,
    p_limit: limit,
  })
  if (error) throw error
  return (data ?? []) as OfficeScheduleRevisionRow[]
}

export async function restoreOfficeScheduleRevision(
  client: SupabaseClient,
  revisionId: string
): Promise<{ revision_id: string; restored_from_id: string; slot_count: number }> {
  const { data, error } = await client.rpc('restore_office_schedule_revision', {
    p_revision_id: revisionId,
  })
  if (error) throw error
  const row = (data ?? {}) as {
    revision_id?: string
    restored_from_id?: string
    slot_count?: number
  }
  return {
    revision_id: String(row.revision_id ?? ''),
    restored_from_id: String(row.restored_from_id ?? ''),
    slot_count: Number(row.slot_count ?? 0),
  }
}

export function formatRevisionTimestamp(iso: string, timeZone = 'America/Los_Angeles'): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function revisionEditorLabel(row: OfficeScheduleRevisionRow): string {
  return (row.saved_by_name || row.saved_by_email.split('@')[0]).trim()
}
