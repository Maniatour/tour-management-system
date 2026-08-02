import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { buildGuideScheduleConfirmPreview } from '@/lib/guideScheduleConfirmMessage'
import { sendTwilioSms } from '@/lib/twilioClient'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const tourId = typeof body.tourId === 'string' ? body.tourId.trim() : ''
    const locale = typeof body.locale === 'string' ? body.locale.trim() : 'ko'
    const sentBy = typeof body.sentBy === 'string' ? body.sentBy : null
    const recipientEmails =
      Array.isArray(body.recipientEmails) && body.recipientEmails.length > 0
        ? (body.recipientEmails as string[]).map((e) => e.trim().toLowerCase()).filter(Boolean)
        : null
    const sendMode = body.sendMode === 'site_only' ? 'site_only' : 'sms_and_site'

    type RecipientOverride = {
      email: string
      smsBody?: string
      siteTitle?: string
      siteMessageBody?: string
    }

    const overrideMap = new Map<string, RecipientOverride>()
    if (Array.isArray(body.recipientOverrides)) {
      for (const item of body.recipientOverrides as RecipientOverride[]) {
        if (!item || typeof item.email !== 'string') continue
        overrideMap.set(item.email.trim().toLowerCase(), item)
      }
    }

    if (!tourId) {
      return NextResponse.json({ error: 'tourId가 필요합니다.' }, { status: 400 })
    }

    const preview = await buildGuideScheduleConfirmPreview(tourId, locale)
    if (!preview.ok) {
      return NextResponse.json({ error: preview.error }, { status: preview.status })
    }

    const db = supabaseAdmin ?? supabase
    const targets = recipientEmails
      ? preview.data.recipients.filter((r) => recipientEmails.includes(r.email.toLowerCase()))
      : preview.data.recipients

    if (targets.length === 0) {
      return NextResponse.json({ error: '발송 대상이 없습니다.' }, { status: 400 })
    }

    const results: Array<{
      email: string
      role: string
      smsStatus: string
      smsError?: string
      popupId?: string
    }> = []

    for (const recipient of targets) {
      const override = overrideMap.get(recipient.email.toLowerCase())
      const smsBody = override?.smsBody?.trim() || recipient.smsBody
      const siteTitle = override?.siteTitle?.trim() || recipient.siteTitle
      const siteMessageBody = override?.siteMessageBody?.trim() || recipient.siteMessageBody

      if (!siteTitle || !siteMessageBody) {
        return NextResponse.json({ error: '사이트 팝업 내용이 비어 있습니다.' }, { status: 400 })
      }

      if (sendMode === 'sms_and_site' && !smsBody) {
        return NextResponse.json({ error: 'SMS 내용이 비어 있습니다.' }, { status: 400 })
      }

      let smsStatus: 'sent' | 'failed' | 'skipped' = 'skipped'
      let smsTwilioSid: string | null = null
      let smsError: string | null = null

      if (sendMode === 'sms_and_site') {
        if (recipient.phoneE164) {
          const twilioResult = await sendTwilioSms(recipient.phoneE164, smsBody)
          if ('error' in twilioResult) {
            smsStatus = 'failed'
            smsError = twilioResult.error
          } else {
            smsStatus = 'sent'
            smsTwilioSid = twilioResult.sid
          }
        } else {
          smsError = '전화번호 없음'
        }
      } else {
        smsError = '사이트 팝업만 발송'
      }

      const { data: inserted, error: insertErr } = await (db as any)
        .from('guide_schedule_confirm_popups')
        .insert({
          tour_id: tourId,
          recipient_email: recipient.email,
          recipient_role: recipient.role,
          title: siteTitle,
          site_message_body: siteMessageBody,
          sms_body: smsBody || recipient.smsBody,
          first_pickup_time: preview.data.firstPickupTime,
          office_arrival_time: preview.data.officeArrivalTime,
          sent_by: sentBy,
          sms_status: smsStatus,
          sms_twilio_sid: smsTwilioSid,
          sms_error: smsError,
        })
        .select('id')
        .single()

      if (insertErr) {
        console.error('[guide-schedule-confirm/send] insert', insertErr)
        return NextResponse.json({ error: '팝업 메시지 저장에 실패했습니다.' }, { status: 500 })
      }

      // 컨펌 요청 발송 시 배정 상태를 '부여'로 표시 (대기 중이었을 때만)
      await (db as any)
        .from('tours')
        .update({ assignment_status: 'assigned' })
        .eq('id', tourId)
        .or('assignment_status.eq.pending,assignment_status.is.null')

      results.push({
        email: recipient.email,
        role: recipient.role,
        smsStatus,
        ...(smsError ? { smsError } : {}),
        ...(inserted?.id ? { popupId: inserted.id as string } : {}),
      })
    }

    const sentCount = results.filter((r) => r.smsStatus === 'sent').length
    const failedCount = results.filter((r) => r.smsStatus === 'failed').length

    const message =
      sendMode === 'site_only'
        ? `사이트 팝업 ${results.length}건 등록되었습니다.`
        : `사이트 팝업 ${results.length}건 등록, SMS ${sentCount}건 발송${failedCount > 0 ? `, 실패 ${failedCount}건` : ''}.`

    return NextResponse.json({
      success: true,
      message,
      results,
      preview: preview.data,
    })
  } catch (e) {
    console.error('[guide-schedule-confirm/send]', e)
    return NextResponse.json({ error: '발송 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
