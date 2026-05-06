import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'

const INSERTABLE_TICKET_BOOKING_COLUMNS = new Set([
  'category',
  'submit_on',
  'submitted_by',
  'check_in_date',
  'time',
  'company',
  'ea',
  'expense',
  'income',
  'payment_method',
  'rn_number',
  'tour_id',
  'note',
  'status',
  'season',
  'reservation_id',
  'uploaded_file_urls',
  'invoice_number',
  'statement_line_id',
  'booking_status',
  'vendor_status',
  'change_status',
  'payment_status',
  'refund_status',
  'operation_status',
  'hold_expires_at',
  'payment_due_at',
  'vendor_confirmation_number',
  'paid_amount',
  'credit_amount',
  'refund_amount',
  'pending_ea',
  'pending_time',
  'booking_status_before_change',
  'unit_price',
  'zelle_confirmation_number',
])

function normalizeOptionalId(value: unknown): string | null {
  if (value == null) return null
  const s = String(value).trim()
  return s ? s : null
}

function buildTicketBookingInsertPayload(
  body: Record<string, unknown>,
  userEmail: string
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body)) {
    if (INSERTABLE_TICKET_BOOKING_COLUMNS.has(key)) {
      payload[key] = value
    }
  }

  payload.submitted_by = userEmail
  payload.tour_id = normalizeOptionalId(payload.tour_id)
  payload.reservation_id = normalizeOptionalId(payload.reservation_id)
  payload.statement_line_id = normalizeOptionalId(payload.statement_line_id)

  return payload
}

export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: '서버 관리자 권한 설정이 필요합니다' },
        { status: 500 }
      )
    }

    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)
    if (authError || !user?.email) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body = (await request.json()) as Record<string, unknown>
    const payload = buildTicketBookingInsertPayload(body, user.email)

    if (!payload.category || !payload.check_in_date) {
      return NextResponse.json(
        { error: '필수 필드가 누락되었습니다' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('ticket_bookings')
      .insert(payload)
      .select('*')
      .single()

    if (error) {
      console.error('[ticket-bookings POST] 생성 오류:', error)
      return NextResponse.json(
        { error: error.message || '입장권 부킹을 생성할 수 없습니다' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ticketBooking: data })
  } catch (error) {
    console.error('[ticket-bookings POST] 예외:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
