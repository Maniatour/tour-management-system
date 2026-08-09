import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import {
  buildGuideScheduleAssignmentPreview,
  parseGuideScheduleAssignmentChannels,
} from '@/lib/guideScheduleAssignmentMessage'
import { sendGuideScheduleAssignmentPush } from '@/lib/sendStaffSopPush'
import { sendTwilioSms } from '@/lib/twilioClient'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const tourId = typeof body.tourId === 'string' ? body.tourId.trim() : ''
    const locale = typeof body.locale === 'string' ? body.locale.trim() : 'ko'
    const sentBy = typeof body.sentBy === 'string' ? body.sentBy : null
    const channels = parseGuideScheduleAssignmentChannels(body.channels)
    const sendSms = channels === 'sms' || channels === 'both'
    const sendPush = channels === 'push' || channels === 'both'
    const recipientEmails =
      Array.isArray(body.recipientEmails) && body.recipientEmails.length > 0
        ? (body.recipientEmails as string[]).map((e) => e.trim().toLowerCase()).filter(Boolean)
        : null

    type RecipientOverride = {
      email: string
      smsBody?: string
      pushTitle?: string
      pushBody?: string
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

    const preview = await buildGuideScheduleAssignmentPreview(tourId, locale)
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
      pushStatus: string
      pushError?: string
      pushSentDevices?: number
      popupId?: string
      popupError?: string
    }> = []

    for (const recipient of targets) {
      const override = overrideMap.get(recipient.email.toLowerCase())
      const smsBody = override?.smsBody?.trim() || recipient.smsBody
      const pushTitle = override?.pushTitle?.trim() || recipient.pushTitle
      const pushBody = override?.pushBody?.trim() || recipient.pushBody
      const siteTitle = override?.siteTitle?.trim() || recipient.siteTitle
      const siteMessageBody = override?.siteMessageBody?.trim() || recipient.siteMessageBody

      if (!siteTitle || !siteMessageBody) {
        return NextResponse.json({ error: '사이트 팝업 내용이 비어 있습니다.' }, { status: 400 })
      }
      if (sendSms && !smsBody) {
        return NextResponse.json({ error: 'SMS 내용이 비어 있습니다.' }, { status: 400 })
      }
      if (sendPush && (!pushTitle || !pushBody)) {
        return NextResponse.json({ error: '푸시 알림 내용이 비어 있습니다.' }, { status: 400 })
      }

      let smsStatus: 'sent' | 'failed' | 'skipped' = 'skipped'
      let smsTwilioSid: string | null = null
      let smsError: string | null = null

      if (sendSms) {
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
          smsStatus = 'failed'
          smsError = '전화번호 없음'
        }
      }

      let pushStatus: 'sent' | 'failed' | 'skipped' = 'skipped'
      let pushError: string | null = null
      let pushSentDevices = 0

      if (sendPush) {
        const pushResult = await sendGuideScheduleAssignmentPush(db, {
          tourId,
          targetEmail: recipient.email,
          pushTitle,
          pushBody,
          confirmUrl: recipient.confirmUrl,
        })
        pushSentDevices = pushResult.sent
        if (pushResult.skippedNoVapid) {
          pushStatus = 'failed'
          pushError = 'VAPID 미설정'
        } else if (pushResult.noSubscriptions > 0 && pushResult.sent === 0) {
          pushStatus = 'failed'
          pushError = '앱 푸시 구독 없음'
        } else if (pushResult.sent > 0) {
          pushStatus = 'sent'
          if (pushResult.failed > 0) {
            pushError = `일부 기기 실패 ${pushResult.failed}`
          }
        } else {
          pushStatus = 'failed'
          pushError = pushResult.failed > 0 ? '푸시 발송 실패' : '앱 푸시 구독 없음'
        }
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
          sms_status: sendSms ? smsStatus : 'skipped',
          sms_twilio_sid: smsTwilioSid,
          sms_error: sendSms
            ? smsError
            : sendPush
              ? pushError || '사이트 팝업 + 푸시'
              : '사이트 팝업만 등록',
        })
        .select('id')
        .single()

      if (insertErr) {
        console.error('[guide-schedule-assignment/send] popup insert', insertErr)
        results.push({
          email: recipient.email,
          role: recipient.role,
          smsStatus,
          ...(smsError ? { smsError } : {}),
          pushStatus,
          ...(pushError ? { pushError } : {}),
          ...(sendPush ? { pushSentDevices } : {}),
          popupError: '팝업 저장 실패',
        })
        continue
      }

      results.push({
        email: recipient.email,
        role: recipient.role,
        smsStatus,
        ...(smsError ? { smsError } : {}),
        pushStatus,
        ...(pushError ? { pushError } : {}),
        ...(sendPush ? { pushSentDevices } : {}),
        ...(inserted?.id ? { popupId: inserted.id as string } : {}),
      })
    }

    const anyDelivered = results.some(
      (r) => r.smsStatus === 'sent' || r.pushStatus === 'sent' || Boolean(r.popupId)
    )
    if (anyDelivered) {
      // 배정 부여 발송 시 상태를 '부여'로 표시 (대기 중이었을 때만)
      await (db as any)
        .from('tours')
        .update({ assignment_status: 'assigned' })
        .eq('id', tourId)
        .or('assignment_status.eq.pending,assignment_status.is.null')
    }

    const smsSentCount = results.filter((r) => r.smsStatus === 'sent').length
    const smsFailedCount = results.filter((r) => r.smsStatus === 'failed').length
    const pushSentCount = results.filter((r) => r.pushStatus === 'sent').length
    const pushFailedCount = results.filter((r) => r.pushStatus === 'failed').length
    const popupCount = results.filter((r) => r.popupId).length

    console.info('[guide-schedule-assignment/send]', {
      tourId,
      sentBy,
      channels,
      smsSentCount,
      smsFailedCount,
      pushSentCount,
      pushFailedCount,
      popupCount,
    })

    const parts: string[] = [`사이트 팝업 ${popupCount}건 등록`]
    if (sendSms) {
      parts.push(
        smsFailedCount > 0
          ? `SMS ${smsSentCount}건 발송, 실패 ${smsFailedCount}건`
          : `SMS ${smsSentCount}건 발송`
      )
    }
    if (sendPush) {
      parts.push(
        pushFailedCount > 0
          ? `푸시 ${pushSentCount}건 발송, 실패 ${pushFailedCount}건`
          : `푸시 ${pushSentCount}건 발송`
      )
    }
    const message = `${parts.join('. ')}.`

    return NextResponse.json({
      success: true,
      message,
      channels,
      results,
      preview: preview.data,
    })
  } catch (e) {
    console.error('[guide-schedule-assignment/send]', e)
    return NextResponse.json({ error: '발송 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
