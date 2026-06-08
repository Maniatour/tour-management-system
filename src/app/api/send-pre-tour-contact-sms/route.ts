import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { buildPreTourContactSmsPreview } from '@/lib/buildPreTourContactSmsPreview'
import { sendTwilioSms } from '@/lib/twilioClient'

/**
 * POST /api/send-pre-tour-contact-sms
 * Twilio로 투어 사전 연락 SMS 발송
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const reservationId = typeof body.reservationId === 'string' ? body.reservationId.trim() : ''
    const locale =
      typeof body.locale === 'string' && body.locale.trim() ? body.locale.trim() : null
    const bodyTemplateOverride =
      typeof body.bodyTemplate === 'string' ? body.bodyTemplate : null
    const sentBy = typeof body.sentBy === 'string' ? body.sentBy : null

    if (!reservationId) {
      return NextResponse.json({ error: 'reservationId가 필요합니다.' }, { status: 400 })
    }

    const preview = await buildPreTourContactSmsPreview({
      reservationId,
      localeOverride: locale,
      bodyTemplateOverride,
    })

    if (!preview.ok) {
      return NextResponse.json({ error: preview.error }, { status: preview.status })
    }

    const { message, toPhone, locale: resolvedLocale } = preview.data

    if (!toPhone) {
      return NextResponse.json(
        { error: '고객 전화번호가 없거나 유효하지 않습니다.' },
        { status: 400 }
      )
    }

    const twilioResult = await sendTwilioSms(toPhone, message)
    const db = supabaseAdmin ?? supabase

    const { data: reservation } = await db
      .from('reservations')
      .select('customer_id')
      .eq('id', reservationId)
      .maybeSingle()

    if ('error' in twilioResult) {
      await (db as any).from('pre_tour_contact_sms_logs').insert({
        reservation_id: reservationId,
        customer_id: (reservation as { customer_id?: string } | null)?.customer_id ?? null,
        to_phone: toPhone,
        message_body: message,
        locale: resolvedLocale,
        status: 'failed',
        error_message: twilioResult.error,
        sent_by: sentBy,
      })

      return NextResponse.json(
        { error: 'SMS 발송에 실패했습니다.', details: twilioResult.error },
        { status: 500 }
      )
    }

    await (db as any).from('pre_tour_contact_sms_logs').insert({
      reservation_id: reservationId,
      customer_id: (reservation as { customer_id?: string } | null)?.customer_id ?? null,
      to_phone: toPhone,
      message_body: message,
      locale: resolvedLocale,
      twilio_message_sid: twilioResult.sid,
      status: 'sent',
      sent_by: sentBy,
    })

    await db
      .from('reservations')
      .update({ customer_communication_channel: 'text_message' })
      .eq('id', reservationId)

    return NextResponse.json({
      success: true,
      message: 'SMS가 발송되었습니다.',
      twilioMessageSid: twilioResult.sid,
      toPhone,
      locale: resolvedLocale,
    })
  } catch (e) {
    console.error('[send-pre-tour-contact-sms]', e)
    return NextResponse.json({ error: 'SMS 발송 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
