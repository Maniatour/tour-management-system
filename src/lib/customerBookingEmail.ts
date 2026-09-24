import { Resend } from 'resend'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { getAppOrigin } from '@/lib/appOrigin'
import { OPERATIONS_CC_EMAIL } from '@/lib/emailConfig'

type AdminClient = SupabaseClient<Database>

export function parseBookingLocale(raw: unknown): 'ko' | 'en' {
  return raw === 'ko' || raw === 'en' ? raw : 'en'
}

async function hasSuccessfulCustomerBookingEmail(
  admin: AdminClient,
  reservationId: string
): Promise<boolean> {
  const { data } = await admin
    .from('email_logs')
    .select('id')
    .eq('reservation_id', reservationId)
    .eq('status', 'sent')
    .in('email_type', ['confirmation', 'departure', 'both', 'receipt', 'voucher'])
    .limit(1)
    .maybeSingle()
  return Boolean(data?.id)
}

async function notifyOpsBookingEmailFailure(args: {
  reservationId: string
  customerEmail: string
  locale: 'ko' | 'en'
  detail: string
}): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    console.error('[notifyOpsBookingEmailFailure] RESEND_API_KEY missing', args)
    return
  }

  try {
    const resend = new Resend(resendApiKey)
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'info@maniatour.com'
    const subject = `[Action required] Booking email failed — ${args.reservationId}`
    const html = `
      <p>고객 예약 확인 메일(영수증/바우처) 발송에 실패했습니다.</p>
      <ul>
        <li><strong>Reservation ID:</strong> ${args.reservationId}</li>
        <li><strong>Customer email:</strong> ${args.customerEmail}</li>
        <li><strong>Locale:</strong> ${args.locale}</li>
        <li><strong>Detail:</strong> ${args.detail}</li>
      </ul>
      <p>Admin에서 해당 예약을 열고 확인 메일을 수동 재발송해 주세요.</p>
    `
    await resend.emails.send({
      from: fromEmail,
      to: OPERATIONS_CC_EMAIL,
      subject,
      html,
    })
  } catch (err) {
    console.error('[notifyOpsBookingEmailFailure] failed', err)
  }
}

/**
 * 결제 접수 후 고객 영수증(+바우처) 발송.
 * 예약 status는 관리자 수동 확정까지 pending이므로, 메일 본문의 확정 문구는 reservation.status에 따릅니다.
 * 실패 시 운영자에게 알림 메일을 보냅니다. (결제는 이미 성공한 상태로 유지)
 */
export async function deliverCustomerBookingConfirmationEmail(
  admin: AdminClient,
  args: {
    reservationId: string
    email: string
    locale: 'ko' | 'en'
    origin?: string
    /** 이미 발송 성공 로그가 있으면 스킵 */
    skipIfAlreadySent?: boolean
  }
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const email = args.email.trim().toLowerCase()
  if (!email) return { ok: false, error: 'missing email' }

  if (args.skipIfAlreadySent !== false) {
    const already = await hasSuccessfulCustomerBookingEmail(admin, args.reservationId)
    if (already) return { ok: true, skipped: true }
  }

  const base = (args.origin || getAppOrigin()).replace(/\/$/, '')
  let lastError = ''

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(`${base}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId: args.reservationId,
          email,
          type: 'both',
          locale: args.locale,
        }),
      })
      if (res.ok) {
        return { ok: true }
      }
      lastError = await res.text().catch(() => `HTTP ${res.status}`)
      console.error('[deliverCustomerBookingConfirmationEmail] attempt', attempt, lastError)
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      console.error('[deliverCustomerBookingConfirmationEmail] attempt', attempt, err)
    }
  }

  try {
    await admin.from('email_logs').insert({
      reservation_id: args.reservationId,
      email,
      email_type: 'confirmation',
      subject: `Booking confirmation failed — ${args.reservationId}`,
      status: 'failed',
      error_message: lastError.slice(0, 1000),
      sent_at: new Date().toISOString(),
      sent_by: 'customer_web_checkout_auto',
    })
  } catch (logErr) {
    console.error('[deliverCustomerBookingConfirmationEmail] email_logs insert', logErr)
  }

  await notifyOpsBookingEmailFailure({
    reservationId: args.reservationId,
    customerEmail: email,
    locale: args.locale,
    detail: lastError.slice(0, 500),
  })

  return { ok: false, error: lastError }
}

export const OFFICE_NEW_BOOKING_EMAIL = 'info@maniatour.com'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * kovegas.com 예약이 새로 들어오면 사무실 메일로 알린다.
 * 같은 예약번호로 이미 보낸 종류는 다시 보내지 않는다.
 */
export async function notifyOfficeOfNewWebReservation(
  admin: AdminClient,
  args: {
    reservationId: string
    kind: 'paid' | 'inquiry'
  }
): Promise<void> {
  const emailType = args.kind === 'paid' ? 'office_new_booking_paid' : 'office_new_booking_inquiry'
  try {
    const { data: already } = await admin
      .from('email_logs')
      .select('id')
      .eq('reservation_id', args.reservationId)
      .eq('email_type', emailType)
      .eq('status', 'sent')
      .limit(1)
      .maybeSingle()
    if (already?.id) return

    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      console.error('[notifyOfficeOfNewWebReservation] RESEND_API_KEY missing', args.reservationId)
      return
    }

    const { data: reservation } = await admin
      .from('reservations')
      .select('id, tour_date, adults, child, infant, product_id, customer_id, status, event_note')
      .eq('id', args.reservationId)
      .maybeSingle()
    if (!reservation) return

    let customerName = ''
    let customerEmail = ''
    let customerPhone = ''
    if (reservation.customer_id) {
      const { data: customer } = await admin
        .from('customers')
        .select('name, email, phone')
        .eq('id', reservation.customer_id)
        .maybeSingle()
      customerName = customer?.name?.trim() || ''
      customerEmail = customer?.email?.trim() || ''
      customerPhone = customer?.phone?.trim() || ''
    }

    let productName = reservation.product_id || ''
    if (reservation.product_id) {
      const { data: product } = await admin
        .from('products')
        .select('internal_name_ko, customer_name_ko, name_ko, name')
        .eq('id', reservation.product_id)
        .maybeSingle()
      productName =
        product?.internal_name_ko?.trim() ||
        product?.customer_name_ko?.trim() ||
        product?.name_ko?.trim() ||
        product?.name?.trim() ||
        productName
    }

    const { data: pricing } = await admin
      .from('reservation_pricing')
      .select('total_price')
      .eq('reservation_id', args.reservationId)
      .maybeSingle()
    const amount = Number(pricing?.total_price)
    const amountLabel = Number.isFinite(amount)
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
      : ''

    const guestBits = [
      Number(reservation.adults) > 0 ? `성인 ${reservation.adults}` : '',
      Number(reservation.child) > 0 ? `아동 ${reservation.child}` : '',
      Number(reservation.infant) > 0 ? `유아 ${reservation.infant}` : '',
    ].filter(Boolean)
    const headline =
      args.kind === 'paid'
        ? 'kovegas.com에서 결제가 완료된 예약이 들어왔습니다.'
        : 'kovegas.com에서 예약 문의가 들어왔습니다.'
    const who = customerName || '고객'
    const subject = `[Kovegas] 새 예약 — ${who}${reservation.tour_date ? ` · ${reservation.tour_date}` : ''}`
    const origin = getAppOrigin().replace(/\/$/, '')
    const adminUrl = `${origin}/ko/admin/reservations`
    const rows: Array<[string, string]> = [
      ['예약번호', reservation.id],
      ['고객', customerName],
      ['이메일', customerEmail],
      ['전화', customerPhone],
      ['상품', productName],
      ['투어일', reservation.tour_date || ''],
      ['인원', guestBits.join(', ')],
      ['금액', amountLabel],
      ['상태', reservation.status || ''],
    ]
    const list = rows
      .filter(([, value]) => value)
      .map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`)
      .join('')
    const note = reservation.event_note?.trim()
    const html = `
      <p>${escapeHtml(headline)}</p>
      <ul>${list}</ul>
      ${note ? `<p><strong>메모</strong><br/>${escapeHtml(note).replace(/\n/g, '<br/>')}</p>` : ''}
      <p><a href="${escapeHtml(adminUrl)}">예약 관리 열기</a></p>
    `

    const resend = new Resend(resendApiKey)
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Las Vegas Mania Tour <info@maniatour.com>'
    const sent = await resend.emails.send({
      from: fromEmail,
      to: OFFICE_NEW_BOOKING_EMAIL,
      subject,
      html,
    })

    await admin.from('email_logs').insert({
      reservation_id: args.reservationId,
      email: OFFICE_NEW_BOOKING_EMAIL,
      email_type: emailType,
      subject,
      status: sent.error ? 'failed' : 'sent',
      error_message: sent.error ? String(sent.error.message || sent.error).slice(0, 1000) : null,
      resend_email_id: sent.data?.id || null,
      sent_at: new Date().toISOString(),
      sent_by: 'kovegas_web_booking',
    })
    if (sent.error) {
      console.error('[notifyOfficeOfNewWebReservation] resend', sent.error)
    }
  } catch (err) {
    console.error('[notifyOfficeOfNewWebReservation] failed', args.reservationId, err)
  }
}
