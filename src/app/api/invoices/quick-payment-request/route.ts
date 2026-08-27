import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { requireStaffApiAuth } from '@/lib/api-security'
import {
  buildInvoiceSitePayUrl,
  buildQuickPaymentRequestEmailHtml,
  createQuickPayableInvoice,
  isQuickPaymentInvoiceNotes,
  isTipOpenAmountInvoiceItems,
  listQuickPaymentInvoices,
  replaceGetYourGuideRelayCustomerEmail,
} from '@/lib/payableInvoice'
import {
  buildQuickPaymentRequestEmailText,
  buildQuickPaymentRequestSmsText,
  parseRecipientEmail,
} from '@/lib/quickPaymentRequestMessage'
import { supabaseAdmin } from '@/lib/supabase'
import { sendTwilioSms } from '@/lib/twilioClient'
import { resolveSmsPhone } from '@/utils/formatPhoneToE164'

export const runtime = 'nodejs'
export const maxDuration = 60

function resendFromHeader(): string {
  const raw = (process.env.RESEND_FROM_EMAIL || 'info@maniatour.com').trim()
  if (!raw) return 'Las Vegas Mania Tour <info@maniatour.com>'
  if (raw.includes('<')) return raw
  return `Las Vegas Mania Tour <${raw}>`
}

function isNonRetryableEmailError(message: string): boolean {
  return /invalid|not a valid|unsubscribed|blocked|domain is not verified|missing.*from|unauthorized/i.test(
    message
  )
}

async function sendQuickPaymentEmail(params: {
  to: string
  recipientName: string
  description: string
  amountUsd: number
  invoiceNumber: string
  payUrl: string
  locale: 'ko' | 'en'
  openAmount?: boolean
}): Promise<{ emailSent: boolean; emailId: string | null; emailError: string | null }> {
  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    return {
      emailSent: false,
      emailId: null,
      emailError:
        params.locale === 'ko'
          ? '이메일 서비스가 설정되지 않았습니다. 결제 링크는 생성되었습니다.'
          : 'Email service is not configured. Payment link was still created.',
    }
  }

  const to = parseRecipientEmail(params.to)
  if (!to) {
    return {
      emailSent: false,
      emailId: null,
      emailError:
        params.locale === 'ko' ? '유효한 이메일이 필요합니다.' : 'A valid email is required.',
    }
  }

  const resend = new Resend(resendApiKey)
  const subject = params.openAmount
    ? params.locale === 'ko'
      ? `가이드 팁 요청 - ${params.invoiceNumber}`
      : `Guide tip request - ${params.invoiceNumber}`
    : params.locale === 'ko'
      ? `결제 요청 $${params.amountUsd.toFixed(2)} - ${params.invoiceNumber}`
      : `Payment request $${params.amountUsd.toFixed(2)} - ${params.invoiceNumber}`
  const payload = {
    from: resendFromHeader(),
    replyTo: process.env.RESEND_REPLY_TO || 'info@maniatour.com',
    to,
    subject,
    html: buildQuickPaymentRequestEmailHtml({
      locale: params.locale,
      recipientName: params.recipientName,
      description: params.description,
      amountUsd: params.amountUsd,
      invoiceNumber: params.invoiceNumber,
      payUrl: params.payUrl,
      openAmount: Boolean(params.openAmount),
    }),
    text: buildQuickPaymentRequestEmailText({
      recipientName: params.recipientName,
      description: params.description,
      amountUsd: params.amountUsd,
      invoiceNumber: params.invoiceNumber,
      payUrl: params.payUrl,
      openAmount: Boolean(params.openAmount),
    }),
  }

  let lastError: string | null = null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data, error } = await resend.emails.send(payload)
      if (error) {
        lastError = error.message || 'Failed to send email'
        console.error('[quick-payment-request] email', error)
        if (isNonRetryableEmailError(lastError) || attempt === 1) break
        continue
      }
      return { emailSent: true, emailId: data?.id || null, emailError: null }
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Failed to send email'
      console.error('[quick-payment-request] email throw', err)
      if (isNonRetryableEmailError(lastError) || attempt === 1) break
    }
  }

  return { emailSent: false, emailId: null, emailError: lastError }
}

async function sendQuickPaymentSms(params: {
  phone: string
  recipientName: string
  description: string
  amountUsd: number
  payUrl: string
  locale: 'ko' | 'en'
  openAmount?: boolean
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
    openAmount: Boolean(params.openAmount),
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

  const email = parseRecipientEmail(typeof body.email === 'string' ? body.email : '')
  const description = typeof body.description === 'string' ? body.description : ''
  const recipientName = typeof body.recipientName === 'string' ? body.recipientName : ''
  const reservationId = typeof body.reservationId === 'string' ? body.reservationId : ''
  const amountRaw = body.amountUsd ?? body.amount
  const amountUsd = typeof amountRaw === 'number' ? amountRaw : Number(amountRaw)
  const openAmount =
    body.openAmount === true ||
    body.requestKind === 'tip_open' ||
    body.requestKind === 'tip_open_amount'
  // 고객 발송(이메일·결제 링크) 기본 영문. 한글은 body.locale === 'ko'일 때만.
  const locale = body.locale === 'ko' ? 'ko' : 'en'
  const sendEmail = body.sendEmail !== false
  const sendSms = body.sendSms === true
  const sendSmsOnly = body.sendSmsOnly === true
  const sendEmailOnly = body.sendEmailOnly === true
  const phone = typeof body.phone === 'string' ? body.phone : ''
  const invoiceIdForFollowUp = typeof body.invoiceId === 'string' ? body.invoiceId.trim() : ''
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
    if (!invoiceIdForFollowUp) {
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
        .eq('id', invoiceIdForFollowUp)
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
      const smsOpenAmount = isTipOpenAmountInvoiceItems((invoice as { items?: unknown }).items)
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
        openAmount: smsOpenAmount,
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

  if (sendEmailOnly) {
    if (!invoiceIdForFollowUp) {
      return NextResponse.json(
        { error: locale === 'ko' ? '인보이스가 필요합니다.' : 'Invoice is required.' },
        { status: 400 }
      )
    }
    try {
      const { data: invoice } = await supabaseAdmin
        .from('invoices')
        .select(
          'id, invoice_number, total, items, notes, payment_token, hosted_invoice_url, customers(name, email)'
        )
        .eq('id', invoiceIdForFollowUp)
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
      const mailDescription =
        (firstItem?.description || firstItem?.productName || '').trim() || 'Tour payment'
      const mailAmountUsd = Number((invoice as { total?: number }).total) || 0
      const customerRaw = (
        invoice as {
          customers?:
            | { name?: string | null; email?: string | null }
            | { name?: string | null; email?: string | null }[]
        }
      ).customers
      const customer = Array.isArray(customerRaw) ? customerRaw[0] : customerRaw
      const toEmail = parseRecipientEmail(email) || parseRecipientEmail(customer?.email || '')
      if (!toEmail) {
        return NextResponse.json(
          {
            error: locale === 'ko' ? '유효한 이메일이 필요합니다.' : 'A valid email is required.',
          },
          { status: 400 }
        )
      }

      const sent = await sendQuickPaymentEmail({
        to: toEmail,
        recipientName: recipientName.trim() || customer?.name || '',
        description: mailDescription,
        amountUsd: mailAmountUsd,
        invoiceNumber: String((invoice as { invoice_number?: string }).invoice_number || ''),
        payUrl,
        locale: 'en',
        openAmount: isTipOpenAmountInvoiceItems((invoice as { items?: unknown }).items),
      })
      if (!sent.emailSent) {
        return NextResponse.json(
          { error: sent.emailError || 'Email failed', ...sent },
          { status: 400 }
        )
      }
      await supabaseAdmin
        .from('invoices')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          sent_by: auth.userEmail,
          email_id: sent.emailId,
        } as never)
        .eq('id', invoiceIdForFollowUp)
      return NextResponse.json({ success: true, email: toEmail, ...sent })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send email'
      console.error('[quick-payment-request] sendEmailOnly', err)
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  try {
    const result = await createQuickPayableInvoice(supabaseAdmin, {
      email,
      amountUsd: openAmount ? 0 : amountUsd,
      description: description.trim() || (openAmount ? 'Guide Tip' : ''),
      recipientName,
      locale,
      createdBy: auth.userEmail,
      openAmount,
      ...(reservationId.trim() ? { reservationId: reservationId.trim() } : {}),
    })

    let emailId: string | null = null
    let emailSent = false
    let emailError: string | null = null

    if (sendEmail) {
      const sent = await sendQuickPaymentEmail({
        to: result.email,
        recipientName: result.recipientName,
        description: result.description,
        amountUsd: result.amountUsd,
        invoiceNumber: result.invoiceNumber,
        payUrl: result.sitePayUrl,
        locale: 'en',
        openAmount: result.openAmount,
      })
      emailSent = sent.emailSent
      emailId = sent.emailId
      emailError = sent.emailError
      if (emailSent) {
        try {
          await supabaseAdmin
            .from('invoices')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              sent_by: auth.userEmail,
              email_id: emailId,
            } as never)
            .eq('id', result.invoiceId)
        } catch (updateErr) {
          console.error('[quick-payment-request] sent status update', updateErr)
        }
      }
    }

    let smsSent = false
    let smsError: string | null = null
    let smsToPhone: string | null = null

    if (sendSms) {
      try {
        const sms = await sendQuickPaymentSms({
          phone,
          recipientName: result.recipientName,
          description: result.description,
          amountUsd: result.amountUsd,
          payUrl: result.sitePayUrl,
          locale,
          openAmount: result.openAmount,
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
      } catch (smsErr) {
        smsSent = false
        smsError = smsErr instanceof Error ? smsErr.message : 'SMS failed'
        console.error('[quick-payment-request] sms', smsErr)
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
