import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import type { ScheduleDisplayTicketBookingRow } from '@/lib/scheduleDisplayData'

export type ScheduleDisplayRpcChoiceRow = {
  reservation_id: string
  quantity?: number | null
  option_key?: string | null
  option_name_ko?: string | null
  option_name?: string | null
}

export type ScheduleDisplayRpcPayload = {
  products: unknown[]
  teamMembers: Database['public']['Tables']['team']['Row'][]
  tours: unknown[]
  reservations: unknown[]
  vehicles: Array<{
    id: string
    vehicle_number?: string | null
    nick?: string | null
    vehicle_category?: string | null
    status?: string | null
    rental_start_date?: string | null
    rental_end_date?: string | null
    engine_oil_change_cycle?: number | null
    recent_engine_oil_change_mileage?: number | null
    current_mileage?: number | null
  }>
  ticketBookings: ScheduleDisplayTicketBookingRow[]
  tourHotelBookings: Array<{
    id: string
    tour_id: string | null
    status: string | null
    rooms: number | null
    hotel?: string
    check_in_date?: string
  }>
  offSchedules: Array<{
    team_email: string
    off_date: string
    reason: string
    status: string
  }>
  dateNotes: Array<{
    note_date: string
    note: string | null
    created_by?: string | null
  }>
  reservationChoices: ScheduleDisplayRpcChoiceRow[]
  customers: Pick<Database['public']['Tables']['customers']['Row'], 'id' | 'language' | 'name'>[]
}

export type ScheduleDisplayRpcParams = {
  operatorId: string
  rangeStart: string
  rangeEnd: string
  gridNoteStart: string
  gridNoteEnd: string
}

function isRpcPayload(value: unknown): value is ScheduleDisplayRpcPayload {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return (
    Array.isArray(row.products) &&
    Array.isArray(row.teamMembers) &&
    Array.isArray(row.tours) &&
    Array.isArray(row.reservations)
  )
}

/** DB RPC get_schedule_display — 실패 시 null (호출부에서 기존 다중 쿼리로 폴백) */
export async function fetchScheduleDisplayViaRpc(
  supabase: SupabaseClient,
  params: ScheduleDisplayRpcParams,
): Promise<ScheduleDisplayRpcPayload | null> {
  const { data, error } = await (supabase as SupabaseClient & {
    rpc: (
      fn: 'get_schedule_display',
      args: {
        p_operator_id: string
        p_range_start: string
        p_range_end: string
        p_grid_note_start: string
        p_grid_note_end: string
      },
    ) => Promise<{ data: unknown; error: { message: string } | null }>
  }).rpc('get_schedule_display', {
    p_operator_id: params.operatorId,
    p_range_start: params.rangeStart,
    p_range_end: params.rangeEnd,
    p_grid_note_start: params.gridNoteStart,
    p_grid_note_end: params.gridNoteEnd,
  })

  if (error) {
    console.warn('get_schedule_display RPC failed, using parallel queries:', error.message)
    return null
  }

  if (!isRpcPayload(data)) {
    console.warn('get_schedule_display RPC returned unexpected shape')
    return null
  }

  return data
}

export function mapRpcDateNotesToRecord(
  rows: ScheduleDisplayRpcPayload['dateNotes'],
): Record<string, { note: string; created_by?: string }> {
  const notesMap: Record<string, { note: string; created_by?: string }> = {}
  for (const item of rows) {
    notesMap[item.note_date] = {
      note: item.note || '',
      ...(item.created_by ? { created_by: item.created_by } : {}),
    }
  }
  return notesMap
}
