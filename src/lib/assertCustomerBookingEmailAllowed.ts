import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

const MAX_AGE_MS = 2 * 60 * 60 * 1000 // 결제 직후 2시간

type BookingEmailBody = {
  reservationId?: unknown
  email?: unknown
  type?: unknown
}

/**
 * 고객 결제 직후 `/api/send-email` 허용 여부.
 * 예약 소유(고객 이메일 일치) + 최근 생성 또는 확정 결제 기록이 있을 때만 true.
 */
export async function assertCustomerBookingEmailAllowed(
  db: SupabaseClient<Database>,
  body: BookingEmailBody
): Promise<{ ok: true; reservationId: string; email: string } | { ok: false; error: string }> {
  const reservationId =
    typeof body.reservationId === 'string' ? body.reservationId.trim() : ''
  const email =
    typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!reservationId || !email) {
    return { ok: false, error: '예약 ID와 이메일 주소가 필요합니다.' }
  }

  const type = body.type ?? 'both'
  if (type !== 'both' && type !== 'receipt' && type !== 'voucher') {
    return { ok: false, error: '허용되지 않은 이메일 유형입니다.' }
  }

  const { data: reservation, error: reservationError } = await db
    .from('reservations')
    .select('id, customer_id, created_at')
    .eq('id', reservationId)
    .maybeSingle()

  if (reservationError || !reservation) {
    return { ok: false, error: '예약을 찾을 수 없습니다.' }
  }

  if (!reservation.customer_id) {
    return { ok: false, error: '고객 정보가 없는 예약입니다.' }
  }

  const { data: customer, error: customerError } = await db
    .from('customers')
    .select('id, email')
    .eq('id', reservation.customer_id)
    .maybeSingle()

  if (customerError || !customer?.email) {
    return { ok: false, error: '고객 이메일을 확인할 수 없습니다.' }
  }

  if (customer.email.trim().toLowerCase() !== email) {
    return { ok: false, error: '예약 고객 이메일과 일치하지 않습니다.' }
  }

  const createdAt = reservation.created_at ? new Date(reservation.created_at).getTime() : 0
  const recentlyCreated = createdAt > 0 && Date.now() - createdAt <= MAX_AGE_MS

  if (recentlyCreated) {
    return { ok: true, reservationId, email }
  }

  const { data: payment, error: paymentError } = await db
    .from('payment_records')
    .select('id')
    .eq('reservation_id', reservationId)
    .eq('payment_status', 'confirmed')
    .limit(1)
    .maybeSingle()

  if (!paymentError && payment) {
    return { ok: true, reservationId, email }
  }

  return { ok: false, error: '최근 결제/예약 확인이 필요합니다.' }
}
