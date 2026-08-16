import { supabase } from '@/lib/supabase'

export type TicketBookingDateNoteEntry = {
  note: string
  created_by?: string
}

export function calendarGridYmdRange(monthDate: Date): { startYmd: string; endYmd: string } {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const start = new Date(firstDay)
  start.setDate(start.getDate() - firstDay.getDay())
  const end = new Date(start)
  end.setDate(end.getDate() + 41)
  const toYmd = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  return { startYmd: toYmd(start), endYmd: toYmd(end) }
}

export async function fetchTicketBookingDateNotes(
  startYmd: string,
  endYmd: string
): Promise<Record<string, TicketBookingDateNoteEntry>> {
  const { data, error } = await supabase
    .from('ticket_booking_date_notes')
    .select('note_date, note, created_by')
    .gte('note_date', startYmd)
    .lte('note_date', endYmd)

  if (error) throw error

  const map: Record<string, TicketBookingDateNoteEntry> = {}
  for (const row of data ?? []) {
    const note = (row.note || '').trim()
    if (!note) continue
    map[row.note_date] = {
      note,
      ...(row.created_by ? { created_by: row.created_by } : {}),
    }
  }
  return map
}

export async function upsertTicketBookingDateNote(params: {
  noteDate: string
  note: string
  createdBy: string | null
}): Promise<TicketBookingDateNoteEntry> {
  const note = params.note.trim()
  const { error } = await supabase.from('ticket_booking_date_notes').upsert(
    {
      note_date: params.noteDate,
      note,
      created_by: params.createdBy,
    },
    { onConflict: 'note_date' }
  )
  if (error) throw error
  return {
    note,
    ...(params.createdBy ? { created_by: params.createdBy } : {}),
  }
}

export async function deleteTicketBookingDateNote(noteDate: string): Promise<void> {
  const { error } = await supabase
    .from('ticket_booking_date_notes')
    .delete()
    .eq('note_date', noteDate)
  if (error) throw error
}
