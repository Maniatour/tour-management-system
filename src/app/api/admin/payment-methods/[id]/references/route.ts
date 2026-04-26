import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { PAYMENT_METHOD_REF_TABLES } from '@/lib/paymentMethodRefTables'

const PER_TABLE_LIMIT = 2000

type RouteParams = Promise<{ id: string }> | { id: string }

async function resolveId(params: RouteParams): Promise<string | undefined> {
  const resolved = await Promise.resolve(params)
  return resolved?.id?.trim() || undefined
}

async function resolveReferenceKeys(methodId: string): Promise<string[]> {
  const keys = new Set<string>()
  keys.add(methodId)
  if (!supabaseAdmin) return [...keys]

  const { data } = await supabaseAdmin
    .from('payment_methods')
    .select('id, method, display_name')
    .eq('id', methodId)
    .maybeSingle()

  if (data) {
    for (const v of [data.id, data.method, data.display_name]) {
      if (v == null) continue
      const k = String(v).trim()
      if (k) keys.add(k)
    }
  }
  return [...keys]
}

function tableSelect(table: (typeof PAYMENT_METHOD_REF_TABLES)[number]): string {
  switch (table) {
    case 'company_expenses':
      return 'id,paid_to,paid_for,description,amount,payment_method,submit_on,submit_by,notes,status'
    case 'reservation_expenses':
      return 'id,reservation_id,paid_to,paid_for,amount,payment_method,note,submit_on,status'
    case 'tour_expenses':
      return 'id,tour_id,tour_date,paid_to,paid_for,amount,payment_method,note,submit_on,status'
    case 'payment_records':
      return 'id,reservation_id,amount,payment_method,payment_status,note,submit_on,amount_krw'
    case 'ticket_bookings':
      return 'id,category,company,expense,income,payment_method,tour_id,submit_on,note,status,check_in_date'
    case 'tour_hotel_bookings':
      return 'id,hotel,reservation_name,total_price,unit_price,payment_method,tour_id,event_date,submit_on,note,status'
    default:
      return 'id,payment_method'
  }
}

async function attachReservationCustomers(rows: unknown[]): Promise<void> {
  if (!supabaseAdmin || rows.length === 0) return
  const ids = new Set<string>()
  for (const r of rows) {
    const o = r as { reservation_id?: string | null }
    if (o.reservation_id && String(o.reservation_id).trim()) ids.add(String(o.reservation_id).trim())
  }
  if (ids.size === 0) return
  const { data: rez, error } = await supabaseAdmin
    .from('reservations')
    .select('id, customer_id')
    .in('id', [...ids])

  if (error || !rez) {
    console.warn('references: reservations customer lookup:', error?.message)
    return
  }
  const customerByReservation = new Map<string, string>()
  for (const row of rez as { id: string; customer_id: string | null }[]) {
    if (row.customer_id) customerByReservation.set(row.id, row.customer_id)
  }
  for (const r of rows) {
    const o = r as { reservation_id?: string | null; customer_id?: string | null }
    const rid = o.reservation_id ? String(o.reservation_id).trim() : ''
    if (rid && customerByReservation.has(rid)) {
      o.customer_id = customerByReservation.get(rid) ?? null
    }
  }
}

/**
 * GET: 해당 결제방법(id/method/display_name)을 payment_method 컬럼으로 참조하는 모든 행
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, message: 'SUPABASE_SERVICE_ROLE_KEY가 없습니다.' },
        { status: 503 }
      )
    }

    const methodId = await resolveId(params)
    if (!methodId) {
      return NextResponse.json({ success: false, message: 'id가 필요합니다.' }, { status: 400 })
    }
    const referenceKeys = await resolveReferenceKeys(methodId)

    const results = await Promise.all(
      PAYMENT_METHOD_REF_TABLES.map(async (table) => {
        const { data, error } = await supabaseAdmin
          .from(table)
          .select(tableSelect(table))
          .in('payment_method', referenceKeys)
          .order('submit_on', { ascending: false, nullsFirst: false })
          .limit(PER_TABLE_LIMIT)

        if (error) {
          console.warn(`references GET ${table}:`, error.message)
          return { table, error: error.message, rows: [] as unknown[] }
        }
        let rows = data ?? []
        if (table === 'reservation_expenses' || table === 'payment_records') {
          await attachReservationCustomers(rows)
        }
        return { table, error: null as string | null, rows }
      })
    )

    const groups = results.map((r) => ({
      table: r.table,
      count: r.rows.length,
      capped: r.rows.length >= PER_TABLE_LIMIT,
      error: r.error,
      rows: r.rows,
    }))

    const total = groups.reduce((s, g) => s + g.count, 0)

    return NextResponse.json({ success: true, methodId, referenceKeys, groups, total })
  } catch (e) {
    console.error('payment-methods references GET:', e)
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : '조회 실패' },
      { status: 500 }
    )
  }
}
