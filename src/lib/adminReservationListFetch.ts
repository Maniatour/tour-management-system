import type { SupabaseClient } from '@supabase/supabase-js'

function qIdent(s: string): string {
  return String(s).replace(/"/g, '""')
}

/** PostgREST or() / filter용 ilike 값 (따옴표 포함) */
function ilikeQuoted(term: string): string {
  const p = `%${term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')}%`
  return `"${qIdent(p)}"`
}

export type AdminReservationListSort = 'created_at' | 'tour_date' | 'customer_name' | 'product_name'

export type FetchAdminReservationListArgs = {
  mode: 'card-flat' | 'card-week' | 'calendar'
  activityRangeStartIso?: string
  activityRangeEndIso?: string
  page: number
  pageSize: number
  selectedStatus: string
  selectedChannel: string
  dateRange: { start: string; end: string }
  customerIdFromUrl: string | null
  debouncedSearchTerm: string
  sortBy: AdminReservationListSort
  sortOrder: 'asc' | 'desc'
  calendarTourDateStart?: string
  calendarTourDateEnd?: string
  calendarCreatedStartIso?: string
  calendarCreatedEndIso?: string
}

async function buildSearchOrClause(
  supabase: SupabaseClient,
  term: string
): Promise<string | null> {
  const t = term.trim()
  if (!t) return null

  const q = ilikeQuoted(t)
  const parts: string[] = [
    `id.ilike.${q}`,
    `channel_rn.ilike.${q}`,
    `tour_date.ilike.${q}`,
    `tour_time.ilike.${q}`,
    `pickup_hotel.ilike.${q}`,
    `added_by.ilike.${q}`,
    `event_note.ilike.${q}`,
  ]

  const likePat = `%${t.replace(/%/g, '\\%')}%`
  const [{ data: cust }, { data: prod }, { data: ch }] = await Promise.all([
    supabase
      .from('customers')
      .select('id')
      .or(`name.ilike.${q},special_requests.ilike.${q}`)
      .limit(400),
    supabase
      .from('products')
      .select('id')
      .or(`name.ilike.${q},name_ko.ilike.${q},name_en.ilike.${q}`)
      .limit(400),
    supabase.from('channels').select('id').ilike('name', likePat).limit(400),
  ])

  const cids = [...new Set((cust || []).map((r: { id: string }) => r.id).filter(Boolean))]
  const pids = [...new Set((prod || []).map((r: { id: string }) => r.id).filter(Boolean))]
  const chids = [...new Set((ch || []).map((r: { id: string }) => r.id).filter(Boolean))]
  if (cids.length) parts.push(`customer_id.in.(${cids.join(',')})`)
  if (pids.length) parts.push(`product_id.in.(${pids.join(',')})`)
  if (chids.length) parts.push(`channel_id.in.(${chids.join(',')})`)

  return parts.join(',')
}

/**
 * 예약 관리: 서버 필터·검색·정렬·페이지네이션(플랫 카드) 또는 주간 전량(날짜 그룹 카드).
 */
export async function fetchAdminReservationList(
  supabase: SupabaseClient,
  args: FetchAdminReservationListArgs
): Promise<{ data: Record<string, unknown>[] | null; count: number | null; error: Error | null }> {
  try {
    let selectFields = '*, choices'
    if (args.sortBy === 'customer_name') {
      selectFields = '*, choices, customers(name)'
    } else if (args.sortBy === 'product_name') {
      selectFields = '*, choices, products(name, name_ko, name_en)'
    }

    let q = supabase.from('reservations').select(selectFields, { count: 'exact' })

    if (args.customerIdFromUrl) {
      q = q.eq('customer_id', args.customerIdFromUrl)
    }

    if (args.selectedStatus === 'all') {
      q = q.neq('status', 'deleted')
    } else {
      q = q.eq('status', args.selectedStatus)
    }

    if (args.selectedChannel !== 'all') {
      q = q.eq('channel_id', args.selectedChannel)
    }

    if (args.dateRange.start && args.dateRange.end) {
      q = q.gte('tour_date', args.dateRange.start).lte('tour_date', args.dateRange.end)
    }

    if (args.mode === 'card-week' && args.activityRangeStartIso && args.activityRangeEndIso) {
      const a = qIdent(args.activityRangeStartIso)
      const b = qIdent(args.activityRangeEndIso)
      q = q.or(
        `and(created_at.gte."${a}",created_at.lte."${b}"),and(updated_at.gte."${a}",updated_at.lte."${b}")`
      )
    }

    if (args.mode === 'calendar') {
      const td0 = args.calendarTourDateStart
      const td1 = args.calendarTourDateEnd
      const c0 = args.calendarCreatedStartIso
      const c1 = args.calendarCreatedEndIso
      if (td0 && td1 && c0 && c1) {
        const tds = qIdent(td0)
        const tde = qIdent(td1)
        const cs = qIdent(c0)
        const ce = qIdent(c1)
        q = q.or(
          `and(tour_date.gte."${tds}",tour_date.lte."${tde}"),and(created_at.gte."${cs}",created_at.lte."${ce}")`
        )
      }
    }

    const searchOr = await buildSearchOrClause(supabase, args.debouncedSearchTerm)
    if (searchOr) {
      q = q.or(searchOr)
    }

    const asc = args.sortOrder === 'asc'
    switch (args.sortBy) {
      case 'tour_date':
        q = q.order('tour_date', { ascending: asc, nullsFirst: false }).order('id', { ascending: asc })
        break
      case 'customer_name':
        q = q
          .order('name', { ascending: asc, referencedTable: 'customers' })
          .order('id', { ascending: asc })
        break
      case 'product_name':
        q = q
          .order('name', { ascending: asc, referencedTable: 'products' })
          .order('id', { ascending: asc })
        break
      case 'created_at':
      default:
        q = q
          .order('created_at', { ascending: asc, nullsFirst: false })
          .order('id', { ascending: asc })
        break
    }

    if (args.mode === 'card-flat') {
      const from = (args.page - 1) * args.pageSize
      const to = from + args.pageSize - 1
      q = q.range(from, to)
    }

    const { data, error, count } = await q
    if (error) {
      return { data: null, count: null, error: error as Error }
    }
    return { data: (data || []) as Record<string, unknown>[], count: count ?? null, error: null }
  } catch (e) {
    return { data: null, count: null, error: e instanceof Error ? e : new Error(String(e)) }
  }
}
