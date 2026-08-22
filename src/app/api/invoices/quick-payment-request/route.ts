import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { requireStaffApiAuth } from '@/lib/api-security'
import {
  buildInvoiceSitePayUrl,
  buildQuickPaymentRequestEmailHtml,
  createQuickPayableInvoice,
  isQuickPaymentInvoiceNotes,
  listQuickPaymentInvoices,
  replaceGetYourGuideRelayCustomerEmail,
} from '@/lib/payableInvoice'
import { buildQuickPaymentRequestSmsText } from '@/lib/quickPaymentRequestMessage'
import { supabaseAdmin } from '@/lib/supabase'
import { sendTwilioSms } from '@/lib/twilioClient'
import { resolveSmsPhone } from '@/utils/formatPhoneToE164'

export const runtime = 'nodejs'

async function sendQuickPaymentSms(params: {
  phone: string
  recipientName: string
  description: string
  amountUsd: number
  payUrl: string
  locale: 'ko' | 'en'
}): Promise<{ smsSent: boolean; smsError: string | null; toPhone: string | null }> {
  const toPhone = resolveSmsPhone(params.phone)
  if (!toPhone) {
    return {
      smsSent: false,
      smsError:
        params.locale === 'ko'
          ? '유효한 전화번호가 필요합니다.'
          : 'A valid phone number is required.',
      toPhone: null,
    }
  }
  const text = buildQuickPaymentRequestSmsText({
    recipientName: params.recipientName,
    description: params.description,
    amountUsd: params.amountUsd,
    payUrl: params.payUrl,
  })
  const twilioResult = await sendTwilioSms(toPhone, text)
  if ('error' in twilioResult) {
    return { smsSent: false, smsError: twilioResult.error, toPhone }
  }
  return { smsSent: true, smsError: null, toPhone }
}

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
  // 고객 발송(이메일·결제 링크) 기본 영문. 한글은 body.locale === 'ko'일 때만.
  const locale = body.locale === 'ko' ? 'ko' : 'en'
  const sendEmail = body.sendEmail !== false
  const sendSms = body.sendSms === true
  const sendSmsOnly = body.sendSmsOnly === true
  const phone = typeof body.phone === 'string' ? body.phone : ''
  const invoiceIdForSms = typeof body.invoiceId === 'string' ? body.invoiceId.trim() : ''
  const updateCustomerEmailOnly = body.updateCustomerEmailOnly === true

  if (updateCustomerEmailOnly) {
    try {
      const replaced = await replaceGetYourGuideRelayCustomerEmail(supabaseAdmin, {
        reservationId,
        newEmail: email,
        recipientName,
        locale,
      })
      if (!replaced) {
        return NextResponse.json(
          {
            error:
              locale === 'ko'
                ? '예약 고객의 GetYourGuide 임시 이메일을 찾을 수 없습니다.'
                : 'No GetYourGuide relay email was found on this reservation customer.',
          },
          { status: 400 }
        )
      }
      return NextResponse.json({
        success: true,
        customerEmailUpdated: true,
        email: replaced.email,
        previousEmail: replaced.previousEmail,
        specialRequests: replaced.specialRequests,
        customerId: replaced.customerId,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update customer email'
      console.error('[quick-payment-request] updateCustomerEmailOnly', err)
      return NextResponse.json({ error: message }, { status: 400 })
    }
  }

  if (sendSmsOnly) {
    if (!invoiceIdForSms) {
      return NextResponse.json(
        { error: locale === 'ko' ? '인보이스가 필요합니다.' : 'Invoice is required.' },
        { status: 400 }
      )
    }
    try {
      const { data: invoice } = await supabaseAdmin
        .from('invoices')
        .select(
          'id, invoice_number, total, items, notes, payment_token, hosted_invoice_url, customers(name)'
        )
        .eq('id', invoiceIdForSms)
        .maybeSingle()

      if (!invoice || !isQuickPaymentInvoiceNotes((invoice as { notes?: string | null }).notes)) {
        return NextResponse.json(
          {
            error:
              locale === 'ko' ? '빠른 금액 청구 내역을 찾을 수 없습니다.' : 'Payment request not found.',
          },
          { status: 404 }
        )
      }

      const paymentToken = String((invoice as { payment_token?: string | null }).payment_token || '').trim()
      const hostedUrl = String((invoice as { hosted_invoice_url?: string | null }).hosted_invoice_url || '').trim()
      const payUrl = paymentToken ? buildInvoiceSitePayUrl(paymentToken, 'en') : hostedUrl
      if (!payUrl) {
        return NextResponse.json(
          { error: locale === 'ko' ? '결제 링크가 없습니다.' : 'Payment link is missing.' },
          { status: 400 }
        )
      }

      const items = Array.isArray((invoice as { items?: unknown }).items)
        ? (invoice as { items: Array<{ description?: string | null; productName?: string | null }> }).items
        : []
      const firstItem = items[0]
      const smsDescription =
        (firstItem?.description || firstItem?.productName || '').trim() || 'Tour payment'
      const smsAmountUsd = Number((invoice as { total?: number }).total) || 0
      const customerRaw = (invoice as { customers?: { name?: string | null } | { name?: string | null }[] })
        .customers
      const customer = Array.isArray(customerRaw) ? customerRaw[0] : customerRaw
      const smsRecipientName = recipientName.trim() || customer?.name || ''

      const sms = await sendQuickPaymentSms({
        phone,
        recipientName: smsRecipientName,
        description: smsDescription,
        amountUsd: smsAmountUsd,
        payUrl,
        locale,
      })
      if (!sms.smsSent) {
        return NextResponse.json({ error: sms.smsError || 'SMS failed', ...sms }, { status: 400 })
      }
      return NextResponse.json({ success: true, ...sms })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send SMS'
      console.error('[quick-payment-request] sendSmsOnly', err)
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

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

    let smsSent = false
    let smsError: string | null = null
    let smsToPhone: string | null = null

    if (sendSms) {
      const sms = await sendQuickPaymentSms({
        phone,
        recipientName: result.recipientName,
        description: result.description,
        amountUsd: result.amountUsd,
        payUrl: result.sitePayUrl,
        locale,
      })
      smsSent = sms.smsSent
      smsError = sms.smsError
      smsToPhone = sms.toPhone
      if (smsSent && !emailSent) {
        await supabaseAdmin
          .from('invoices')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            sent_by: auth.userEmail,
          } as never)
          .eq('id', result.invoiceId)
      }
    }

    return NextResponse.json({
      success: true,
      ...result,
      emailSent,
      emailId,
      emailError,
      smsSent,
      smsError,
      smsToPhone,
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
