import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { requireStaffApiAuth } from '@/lib/api-security'
import { supabaseAdmin } from '@/lib/supabase'
import {
  buildQuickPaymentRequestEmailHtml,
  createQuickPayableInvoice,
  listQuickPaymentInvoices,
} from '@/lib/payableInvoice'

export const runtime = 'nodejs'

/**
 * GET /api/invoices/quick-payment-request
 * 스태프: 빠른 금액 청구 히스토리
 */
export async function GET(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const locale = searchParams.get('locale') === 'ko' ? 'ko' : 'en'
  const limitRaw = Number(searchParams.get('limit') || 50)
  const limit = Number.isFinite(limitRaw) ? limitRaw : 50

  try {
    const items = await listQuickPaymentInvoices(supabaseAdmin, { locale, limit })
    return NextResponse.json({ success: true, items })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load history'
    console.error('[quick-payment-request GET]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/invoices/quick-payment-request
 * 스태프: 금액·내용·수신 이메일로 Stripe Hosted Invoice를 만들고 결제 요청 메일을 보냅니다.
 */
export async function POST(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON body required' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email : ''
  const description = typeof body.description === 'string' ? body.description : ''
  const recipientName = typeof body.recipientName === 'string' ? body.recipientName : ''
  const reservationId = typeof body.reservationId === 'string' ? body.reservationId : ''
  const amountRaw = body.amountUsd ?? body.amount
  const amountUsd = typeof amountRaw === 'number' ? amountRaw : Number(amountRaw)
  const locale = body.locale === 'ko' ? 'ko' : 'en'
  const sendEmail = body.sendEmail !== false

  try {
    const result = await createQuickPayableInvoice(supabaseAdmin, {
      email,
      amountUsd,
      description,
      recipientName,
      locale,
      createdBy: auth.userEmail,
      ...(reservationId.trim() ? { reservationId: reservationId.trim() } : {}),
    })

    let emailId: string | null = null
    let emailSent = false
    let emailError: string | null = null

    if (sendEmail) {
      const resendApiKey = process.env.RESEND_API_KEY
      if (!resendApiKey) {
        emailError =
          locale === 'ko'
            ? '이메일 서비스가 설정되지 않았습니다. 결제 링크는 생성되었습니다.'
            : 'Email service is not configured. Payment link was still created.'
      } else {
        const resend = new Resend(resendApiKey)
        const fromEmail = process.env.RESEND_FROM_EMAIL || 'info@maniatour.com'
        const replyTo = process.env.RESEND_REPLY_TO || 'info@maniatour.com'
        const subject =
          locale === 'ko'
            ? `결제 요청 $${result.amountUsd.toFixed(2)} - ${result.invoiceNumber}`
            : `Payment request $${result.amountUsd.toFixed(2)} - ${result.invoiceNumber}`

        const html = buildQuickPaymentRequestEmailHtml({
          locale,
          recipientName: result.recipientName,
          description: result.description,
          amountUsd: result.amountUsd,
          invoiceNumber: result.invoiceNumber,
          payUrl: result.sitePayUrl,
        })

        const { data: emailResult, error: sendErr } = await resend.emails.send({
          from: fromEmail,
          replyTo,
          to: result.email,
          subject,
          html,
        })

        if (sendErr) {
          emailError = sendErr.message || 'Failed to send email'
          console.error('[quick-payment-request] email', sendErr)
        } else {
          emailId = emailResult?.id || null
          emailSent = true
          await supabaseAdmin
            .from('invoices')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              sent_by: auth.userEmail,
              email_id: emailId,
            } as never)
            .eq('id', result.invoiceId)
        }
      }
    }

    return NextResponse.json({
      success: true,
      ...result,
      emailSent,
      emailId,
      emailError,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create payment request'
    console.error('[quick-payment-request]', err)
    const status = /이메일|email|금액|amount|내용|description|유효|valid|0보다|greater|너무 큽/i.test(
      message
    )
      ? 400
      : 500
    return NextResponse.json({ error: message }, { status })
  }
}
