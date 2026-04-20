import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { PAYMENT_METHOD_REF_TABLES, type PaymentMethodRefTable } from '@/lib/paymentMethodRefTables'

function isRefTable(t: string): t is PaymentMethodRefTable {
  return (PAYMENT_METHOD_REF_TABLES as readonly string[]).includes(t)
}

type PatchBody = {
  table?: string
  id?: string
  patch?: Record<string, unknown>
}

const PATCH_KEYS: Record<PaymentMethodRefTable, string[]> = {
  company_expenses: [
    'paid_to',
    'paid_for',
    'description',
    'amount',
    'payment_method',
    'notes',
    'submit_by',
    'submit_on',
  ],
  reservation_expenses: [
    'paid_to',
    'paid_for',
    'amount',
    'payment_method',
    'note',
    'reservation_id',
    'status',
  ],
  tour_expenses: ['paid_to', 'paid_for', 'amount', 'payment_method', 'note', 'status'],
  payment_records: ['amount', 'payment_method', 'payment_status', 'note', 'amount_krw'],
  ticket_bookings: [
    'payment_method',
    'expense',
    'income',
    'note',
    'company',
    'category',
    'status',
  ],
  tour_hotel_bookings: [
    'payment_method',
    'total_price',
    'unit_price',
    'note',
    'hotel',
    'reservation_name',
    'status',
  ],
}

const NUMERIC_PATCH_KEYS = new Set([
  'amount',
  'expense',
  'income',
  'unit_price',
  'total_price',
  'amount_krw',
])

function normalizeIncomingPatch(
  table: PaymentMethodRefTable,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const allowed = new Set(PATCH_KEYS[table])
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(patch)) {
    if (!allowed.has(k)) continue
    if (v === undefined) continue
    if (NUMERIC_PATCH_KEYS.has(k)) {
      if (v === null || v === '') {
        out[k] = null
      } else {
        const n = typeof v === 'number' ? v : parseFloat(String(v))
        if (!Number.isNaN(n)) out[k] = n
      }
      continue
    }
    if (typeof v === 'string') {
      out[k] = v.trim()
      continue
    }
    out[k] = v
  }
  return out
}

function validateMerged(table: PaymentMethodRefTable, merged: Record<string, unknown>): string | null {
  const str = (x: unknown) => (x == null ? '' : String(x).trim())
  const num = (x: unknown) => {
    if (x == null || x === '') return NaN
    return typeof x === 'number' ? x : parseFloat(String(x))
  }
  switch (table) {
    case 'company_expenses':
      if (!str(merged.paid_to)) return 'paid_to는 필수입니다.'
      if (!str(merged.paid_for)) return 'paid_for는 필수입니다.'
      if (Number.isNaN(num(merged.amount))) return 'amount는 필수입니다.'
      if (!str(merged.submit_by)) return 'submit_by는 필수입니다.'
      if (!str(merged.payment_method)) return 'payment_method는 필수입니다.'
      return null
    case 'reservation_expenses':
      if (!str(merged.paid_to)) return 'paid_to는 필수입니다.'
      if (!str(merged.paid_for)) return 'paid_for는 필수입니다.'
      if (Number.isNaN(num(merged.amount))) return 'amount는 필수입니다.'
      if (!str(merged.payment_method)) return 'payment_method는 필수입니다.'
      return null
    case 'tour_expenses':
      if (!str(merged.paid_to)) return 'paid_to는 필수입니다.'
      if (!str(merged.paid_for)) return 'paid_for는 필수입니다.'
      if (Number.isNaN(num(merged.amount))) return 'amount는 필수입니다.'
      if (!str(merged.payment_method)) return 'payment_method는 필수입니다.'
      return null
    case 'payment_records':
      if (Number.isNaN(num(merged.amount))) return 'amount는 필수입니다.'
      if (!str(merged.payment_method)) return 'payment_method는 필수입니다.'
      if (!str(merged.payment_status)) return 'payment_status는 필수입니다.'
      return null
    case 'ticket_bookings':
    case 'tour_hotel_bookings':
      if (!str(merged.payment_method)) return 'payment_method는 필수입니다.'
      return null
    default:
      return '지원하지 않는 테이블입니다.'
  }
}

/**
 * PATCH: 참조 테이블 한 행 수정 (화이트리스트 컬럼만, service_role)
 */
export async function PATCH(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, message: 'SUPABASE_SERVICE_ROLE_KEY가 없습니다.' },
        { status: 503 }
      )
    }

    const body = (await request.json()) as PatchBody
    const table = typeof body.table === 'string' ? body.table.trim() : ''
    const id = typeof body.id === 'string' ? body.id.trim() : ''
    const patch = body.patch && typeof body.patch === 'object' ? body.patch : null

    if (!table || !id || !patch) {
      return NextResponse.json(
        { success: false, message: 'table, id, patch가 필요합니다.' },
        { status: 400 }
      )
    }
    if (!isRefTable(table)) {
      return NextResponse.json({ success: false, message: '허용되지 않은 table입니다.' }, { status: 400 })
    }

    const { data: row, error: fetchErr } = await supabaseAdmin
      .from(table)
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchErr) {
      return NextResponse.json({ success: false, message: fetchErr.message }, { status: 500 })
    }
    if (!row) {
      return NextResponse.json({ success: false, message: '행을 찾을 수 없습니다.' }, { status: 404 })
    }

    const normalized = normalizeIncomingPatch(table, patch)
    if (Object.keys(normalized).length === 0) {
      return NextResponse.json(
        { success: false, message: 'patch에 허용된 변경 필드가 없습니다.' },
        { status: 400 }
      )
    }

    const merged: Record<string, unknown> = { ...(row as Record<string, unknown>), ...normalized }

    const verr = validateMerged(table, merged)
    if (verr) {
      return NextResponse.json({ success: false, message: verr }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    for (const k of PATCH_KEYS[table]) {
      if (k in merged) updateData[k] = merged[k]
    }
    updateData.updated_at = new Date().toISOString()

    const { data: updated, error: upErr } = await supabaseAdmin
      .from(table)
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (upErr) {
      return NextResponse.json({ success: false, message: upErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: updated })
  } catch (e) {
    console.error('payment-method-references PATCH:', e)
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : '수정 실패' },
      { status: 500 }
    )
  }
}
