import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildOfficeScheduleOffDaySavePayload,
  offDayMapsEqual,
  type OffDayMap,
} from '@/lib/officeScheduleOffDays'
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
  offDeletes: Array<{ employee_email: string; schedule_date: string }>
  offUpserts: Array<{ employee_email: string; schedule_date: string; note?: string | null }>
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
  savedOffDayMap: OffDayMap,
  draftOffDayMap: OffDayMap,
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

  const offPayload = buildOfficeScheduleOffDaySavePayload(
    savedOffDayMap,
    draftOffDayMap,
    canEditAll,
    currentUserEmail
  )

  return {
    deletes,
    upserts,
    offDeletes: offPayload.deletes,
    offUpserts: offPayload.upserts,
    scopeMonth,
    snapshotFrom,
    snapshotTo,
  }
}

export function scheduleDraftsEqual(
  savedSlots: SlotMap,
  draftSlots: SlotMap,
  savedOffDays: OffDayMap,
  draftOffDays: OffDayMap
): boolean {
  return (
    slotMapsEqual(savedSlots, draftSlots) && offDayMapsEqual(savedOffDays, draftOffDays)
  )
}

function slotMapsEqual(
  a: Map<string, { note: string | null }>,
  b: Map<string, { note: string | null }>
): boolean {
  if (a.size !== b.size) return false
  for (const key of a.keys()) {
    if (!b.has(key)) return false
  }
  return true
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
    p_off_deletes: payload.offDeletes,
    p_off_upserts: payload.offUpserts,
  })

  if (error) throw error

  const row = (data ?? {}) as { deleted?: number; upserted?: number; revision_id?: string }
  return {
    deleted: Number(row.deleted ?? 0),
    upserted: Number(row.upserted ?? 0),
    revisionId: row.revision_id ? String(row.revision_id) : null,
  }
}
