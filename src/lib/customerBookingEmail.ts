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
 * 결제 확정 후 고객 영수증+바우처 발송.
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
