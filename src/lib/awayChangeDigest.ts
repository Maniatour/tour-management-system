import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

export const AWAY_CHANGE_IDLE_MS_DEFAULT = 5 * 60 * 1000

export type AwayChangeDigestScope = {
  reservations?: boolean
  tours?: boolean
  bookings?: boolean
}

export type AwayChangeItemKind = 'reservation_audit' | 'tour_audit' | 'booking_history'

export type AwayChangeItem = {
  kind: AwayChangeItemKind
  id: string
  at: string
  actor: string | null
  action: string
  recordId: string
  /** 짧은 설명 (번역 키 조합용) */
  labelKey: 'reservation' | 'tour' | 'ticketBooking' | 'hotelBooking'
}

function normEmail(v: string | null | undefined): string {
  return (v || '').trim().toLowerCase()
}

function isOtherActor(actor: string | null, myEmail: string): boolean {
  const a = normEmail(actor)
  const me = normEmail(myEmail)
  if (!me) return true
  if (!a) return true
  return a !== me
}

export async function fetchAwayChangeDigest(
  supabase: SupabaseClient<Database>,
  args: {
    sinceIso: string
    myEmail: string
    scope: AwayChangeDigestScope
    auditLimit?: number
    bookingLimit?: number
  }
): Promise<AwayChangeItem[]> {
  const { sinceIso, myEmail, scope } = args
  const auditLimit = args.auditLimit ?? 80
  const bookingLimit = args.bookingLimit ?? 80
  const items: AwayChangeItem[] = []

  const auditTables: string[] = []
  if (scope.reservations) auditTables.push('reservations')
  if (scope.tours) auditTables.push('tours')

  if (auditTables.length > 0) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, table_name, record_id, action, user_email, created_at')
      .in('table_name', auditTables)
      .gt('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(auditLimit)

    if (!error && data) {
      for (const row of data) {
        if (!isOtherActor(row.user_email, myEmail)) continue
        const tableName = row.table_name
        const kind: AwayChangeItemKind =
          tableName === 'tours' ? 'tour_audit' : 'reservation_audit'
        items.push({
          kind,
          id: row.id,
          at: row.created_at || sinceIso,
          actor: row.user_email,
          action: row.action,
          recordId: String(row.record_id),
          labelKey:
            tableName === 'tours'
              ? 'tour'
              : 'reservation',
        })
      }
    }
  }

  if (scope.bookings) {
    const { data, error } = await supabase
      .from('booking_history')
      .select('id, booking_type, booking_id, action, changed_by, changed_at')
      .gt('changed_at', sinceIso)
      .order('changed_at', { ascending: false })
      .limit(bookingLimit)

    if (!error && data) {
      for (const row of data) {
        if (!isOtherActor(row.changed_by, myEmail)) continue
        const bt = (row.booking_type || '').toLowerCase()
        items.push({
          kind: 'booking_history',
          id: row.id,
          at: row.changed_at || sinceIso,
          actor: row.changed_by,
          action: row.action,
          recordId: row.booking_id,
          labelKey: bt === 'hotel' ? 'hotelBooking' : 'ticketBooking',
        })
      }
    }
  }

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  return items
}

export function maxAwayChangeAtIso(items: AwayChangeItem[]): string {
  if (!items.length) return new Date().toISOString()
  let max = 0
  for (const it of items) {
    const t = new Date(it.at).getTime()
    if (Number.isFinite(t) && t > max) max = t
  }
  return new Date(max + 1).toISOString()
}
