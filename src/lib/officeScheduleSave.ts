import type { SupabaseClient } from '@supabase/supabase-js'
import { parseSlotKeyForSave } from '@/lib/officeScheduleStats'

export type OfficeScheduleSlotPayload = {
  employee_email: string
  schedule_date: string
  hour_slot: number
  note?: string | null
}

export type OfficeScheduleSavePayload = {
  deletes: OfficeScheduleSlotPayload[]
  upserts: OfficeScheduleSlotPayload[]
  scopeMonth: string
  snapshotFrom: string
  snapshotTo: string
}

type SlotMap = Map<string, { note: string | null }>

function mayEditSlot(
  employeeEmail: string,
  canEditAll: boolean,
  currentUserEmail: string
): boolean {
  if (canEditAll) return true
  return employeeEmail.trim().toLowerCase() === currentUserEmail.trim().toLowerCase()
}

/** saved ↔ draft diff → RPC 페이로드 */
export function buildOfficeScheduleSavePayload(
  savedSlotMap: SlotMap,
  draftSlotMap: SlotMap,
  canEditAll: boolean,
  currentUserEmail: string,
  scopeMonth: string,
  snapshotFrom: string,
  snapshotTo: string
): OfficeScheduleSavePayload {
  const deletes: OfficeScheduleSlotPayload[] = []
  const upserts: OfficeScheduleSlotPayload[] = []

  for (const key of savedSlotMap.keys()) {
    if (draftSlotMap.has(key)) continue
    const parsed = parseSlotKeyForSave(key)
    if (!parsed) continue
    if (!mayEditSlot(parsed.employee_email, canEditAll, currentUserEmail)) continue
    deletes.push({
      employee_email: parsed.employee_email,
      schedule_date: parsed.schedule_date,
      hour_slot: parsed.hour_slot,
    })
  }

  for (const [key, val] of draftSlotMap) {
    if (savedSlotMap.has(key)) continue
    const parsed = parseSlotKeyForSave(key)
    if (!parsed) continue
    if (!mayEditSlot(parsed.employee_email, canEditAll, currentUserEmail)) continue
    upserts.push({
      employee_email: parsed.employee_email,
      schedule_date: parsed.schedule_date,
      hour_slot: parsed.hour_slot,
      note: val.note,
    })
  }

  return { deletes, upserts, scopeMonth, snapshotFrom, snapshotTo }
}

export async function saveOfficeScheduleBatch(
  client: SupabaseClient,
  payload: OfficeScheduleSavePayload
): Promise<{ deleted: number; upserted: number; revisionId: string | null }> {
  const { data, error } = await client.rpc('save_office_schedule_slots', {
    p_deletes: payload.deletes,
    p_upserts: payload.upserts,
    p_scope_month: payload.scopeMonth,
    p_snapshot_from: payload.snapshotFrom,
    p_snapshot_to: payload.snapshotTo,
  })

  if (error) throw error

  const row = (data ?? {}) as { deleted?: number; upserted?: number; revision_id?: string }
  return {
    deleted: Number(row.deleted ?? 0),
    upserted: Number(row.upserted ?? 0),
    revisionId: row.revision_id ? String(row.revision_id) : null,
  }
}
