import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { getBuiltinResidentInquiryEmailTemplate, substituteResidentInquiryEmailTemplate } from '@/lib/residentInquiryEmailHtml'
import { fetchResidentInquiryEmailTemplateFromDb } from '@/lib/residentInquiryEmailTemplateDb'
import {
  residentInquiryEmailTourKindFromProduct,
  type ResidentInquiryEmailTourKind,
} from '@/lib/residentInquiryTourKind'
import { mintResidentCheckTokenForReservation } from '@/lib/mintResidentCheckToken'
import { resolveReservationEmailIsEnglish } from '@/lib/reservationEmailLocale'
import { getOperationsCc } from '@/lib/emailConfig'

/**
 * POST /api/send-resident-inquiry-email
 * Body: { reservationId: string, locale?: 'ko' | 'en', sentBy?: string | null }
 * 수신 주소는 DB 고객 이메일만 사용합니다.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { reservationId, locale: localeParam, sentBy } = body as {
      reservationId?: string
      locale?: string | null
      sentBy?: string | null
    }

    if (!reservationId?.trim()) {
      return NextResponse.json({ error: '예약 ID가 필요합니다.' }, { status: 400 })
    }

    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('id, customer_id, product_id, tour_date, channel_rn')
      .eq('id', reservationId.trim())
      .maybeSingle()

    if (reservationError || !reservation) {
      return NextResponse.json({ error: '예약을 찾을 수 없습니다.' }, { status: 404 })
    }

    const row = reservation as {
      customer_id: string | null
      product_id: string | null
      tour_date: string | null
      channel_rn: string | null
    }

    if (!row.customer_id) {
      return NextResponse.json({ error: '고객 정보가 없습니다.' }, { status: 400 })
    }

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, name, email, language')
      .eq('id', row.customer_id)
      .maybeSingle()

    if (customerError || !customer) {
      return NextResponse.json({ error: '고객을 찾을 수 없습니다.' }, { status: 404 })
    }

    const cust = customer as {
      name: string | null
      email: string | null
      language: string | null
    }

    const toEmail = (cust.email || '').trim()
    if (!toEmail) {
      return NextResponse.json({ error: '고객 이메일이 없습니다.' }, { status: 400 })
    }

    let productName = ''
    let emailTourKind: ResidentInquiryEmailTourKind = 'day_tour'
    if (row.product_id) {
      const { data: product } = await supabase
        .from('products')
        .select('name, name_ko, name_en, customer_name_ko, customer_name_en, product_code, tags')
        .eq('id', row.product_id)
        .maybeSingle()
      const p = product as {
        name?: string
        name_ko?: string | null
        name_en?: string | null
        customer_name_ko?: string | null
        customer_name_en?: string | null
        product_code?: string | null
        tags?: string[] | null
      } | null
      if (p) {
        const en = resolveReservationEmailIsEnglish(cust.language, localeParam)
        productName = en
          ? (p.customer_name_en || p.name_en || p.name || '').trim()
          : (p.customer_name_ko || p.name_ko || p.name || '').trim()
        emailTourKind = residentInquiryEmailTourKindFromProduct(p.product_code, p.tags)
      }
    }

    const en = resolveReservationEmailIsEnglish(cust.language, localeParam)
    const emailLocale = en ? 'en' : 'ko'

    const minted = await mintResidentCheckTokenForReservation({
      reservationId: reservationId.trim(),
      emailLocalePath: emailLocale,
    })
    const residentCheckAbsoluteUrl = minted?.absoluteUrl?.trim() || ''

    const stored = await fetchResidentInquiryEmailTemplateFromDb(emailLocale, emailTourKind)
    const builtin = getBuiltinResidentInquiryEmailTemplate(emailLocale, emailTourKind)
    const subjectTpl = stored?.subject_template ?? builtin.subject
    const htmlTpl = stored?.html_template ?? builtin.html

    const { subject, html } = substituteResidentInquiryEmailTemplate(subjectTpl, htmlTpl, {
      customerName: cust.name || '',
      tourDate: row.tour_date,
      productName: productName || (emailLocale === 'en' ? 'Tour' : '투어'),
      channelReference: row.channel_rn,
      residentCheckAbsoluteUrl,
      locale: emailLocale,
    })

    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      return NextResponse.json({ error: '이메일 서비스 설정 오류입니다.' }, { status: 500 })
    }

    const resend = new Resend(resendApiKey)
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'info@maniatour.com'
    const replyTo = process.env.RESEND_REPLY_TO || 'info@maniatour.com'

    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: fromEmail,
      reply_to: replyTo,
      to: toEmail,
      cc: getOperationsCc(toEmail),
      subject,
      html,
      open_tracking: true,
      click_tracking: true,
    })

    if (emailError) {
      try {
        if (supabaseAdmin) {
          await supabaseAdmin.from('email_logs').insert({
            reservation_id: reservationId.trim(),
            email: toEmail,
            email_type: 'resident_inquiry',
            subject,
            status: 'failed',
            error_message: emailError.message || 'Email sending failed',
            sent_at: new Date().toISOString(),
            sent_by: sentBy || null,
          } as never)
        } else {
          console.error('email_logs: supabaseAdmin 미설정, 실패 로그 미저장')
        }
      } catch {
        // ignore
      }
      return NextResponse.json(
        { error: '이메일 발송에 실패했습니다.', details: emailError.message },
        { status: 500 }
      )
    }

    try {
      if (supabaseAdmin) {
        await supabaseAdmin.from('email_logs').insert({
          reservation_id: reservationId.trim(),
          email: toEmail,
          email_type: 'resident_inquiry',
          subject,
          status: 'sent',
          sent_at: new Date().toISOString(),
          sent_by: sentBy || null,
          resend_email_id: emailResult?.id || null,
        } as never)
      } else {
        console.error('email_logs: supabaseAdmin 미설정, 발송 로그 미저장')
      }
    } catch {
      // ignore
    }

    return NextResponse.json({
      success: true,
      message: '이메일이 발송되었습니다.',
      subject,
    })
  } catch (e) {
    console.error('send-resident-inquiry-email:', e)
    return NextResponse.json({ error: '이메일 발송 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
