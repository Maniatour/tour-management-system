import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { requireTourReportAdminAccess } from '@/lib/tourReportAdminAccess'
import {
  buildTourReportReminderCopy,
  defaultTourReportStatusRange,
  groupMissingReminderRecipients,
  guidePortalUrl,
  loadTourReportStatus,
  type TourReportReminderTarget,
} from '@/lib/tourReportMissing'
import { sendTourReportReminderPush } from '@/lib/sendStaffSopPush'
import { sendTwilioSms } from '@/lib/twilioClient'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

type ChannelFlags = {
  email?: boolean
  sms?: boolean
  push?: boolean
}

export async function POST(request: NextRequest) {
  const auth = await requireTourReportAdminAccess(request)
  if (!auth.ok) return auth.response

  try {
    const body = (await request.json()) as {
      from?: string
      to?: string
      operatorId?: string
      locale?: string
      channels?: ChannelFlags
      targets?: TourReportReminderTarget[]
    }

    const fallback = defaultTourReportStatusRange()
    const from = typeof body.from === 'string' && DATE_RE.test(body.from) ? body.from : fallback.from
    const to = typeof body.to === 'string' && DATE_RE.test(body.to) ? body.to : fallback.to
    const operatorId = typeof body.operatorId === 'string' ? body.operatorId : null
    const locale = body.locale === 'en' ? 'en' : 'ko'
    const sendEmail = Boolean(body.channels?.email)
    const sendSms = Boolean(body.channels?.sms)
    const sendPush = Boolean(body.channels?.push)

    if (!sendEmail && !sendSms && !sendPush) {
      return NextResponse.json({ error: '이메일, 문자, 앱 알림 중 하나 이상 선택해 주세요.' }, { status: 400 })
    }

    const targets = Array.isArray(body.targets)
      ? body.targets
          .map((row) => ({
            tourId: String(row?.tourId || '').trim(),
            email: String(row?.email || '').trim().toLowerCase(),
          }))
          .filter((row) => row.tourId && row.email)
      : []

    if (targets.length === 0) {
      return NextResponse.json({ error: '알림을 보낼 대상을 선택해 주세요.' }, { status: 400 })
    }

    const status = await loadTourReportStatus(auth.db, { from, to, operatorId, locale })
    const recipients = groupMissingReminderRecipients(status.tours, targets)
    if (recipients.length === 0) {
      return NextResponse.json({ error: '선택한 대상의 미작성 리포트가 없습니다.' }, { status: 400 })
    }

    const resendApiKey = process.env.RESEND_API_KEY
    const skipEmailInDev = process.env.NODE_ENV === 'development' && process.env.SKIP_EMAIL_IN_DEV === 'true'
    const resend = resendApiKey ? new Resend(resendApiKey) : null
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Maniatour <info@maniatour.com>'
    const replyTo = process.env.RESEND_REPLY_TO || 'info@maniatour.com'

    const results: Array<{
      email: string
      name: string
      tourCount: number
      emailStatus: 'sent' | 'failed' | 'skipped'
      smsStatus: 'sent' | 'failed' | 'skipped'
      pushStatus: 'sent' | 'failed' | 'skipped'
      emailError?: string
      smsError?: string
      pushError?: string
    }> = []

    for (const recipient of recipients) {
      const guideUrl = guidePortalUrl(recipient.locale)
      const localized = buildTourReportReminderCopy({
        locale: recipient.locale,
        name: recipient.name,
        tours: recipient.tours,
        guideUrl,
      })

      let emailStatus: 'sent' | 'failed' | 'skipped' = 'skipped'
      let emailError: string | undefined
      if (sendEmail) {
        if (skipEmailInDev) {
          emailStatus = 'sent'
        } else if (!resend) {
          emailStatus = 'failed'
          emailError = 'RESEND_API_KEY 없음'
        } else {
          const { error } = await resend.emails.send({
            from: fromEmail,
            replyTo,
            to: recipient.email,
            subject: localized.emailSubject,
            html: localized.emailHtml,
          })
          if (error) {
            emailStatus = 'failed'
            emailError = error.message
          } else {
            emailStatus = 'sent'
          }
        }
      }

      let smsStatus: 'sent' | 'failed' | 'skipped' = 'skipped'
      let smsError: string | undefined
      if (sendSms) {
        if (!recipient.phoneE164) {
          smsStatus = 'failed'
          smsError = '전화번호 없음'
        } else {
          const twilioResult = await sendTwilioSms(recipient.phoneE164, localized.smsBody)
          if ('error' in twilioResult) {
            smsStatus = 'failed'
            smsError = twilioResult.error
          } else {
            smsStatus = 'sent'
          }
        }
      }

      let pushStatus: 'sent' | 'failed' | 'skipped' = 'skipped'
      let pushError: string | undefined
      if (sendPush) {
        const pushResult = await sendTourReportReminderPush(auth.db, {
          targetEmail: recipient.email,
          pushTitle: localized.pushTitle,
          pushBody: localized.pushBody,
          url: guideUrl,
        })
        if (pushResult.skippedNoVapid) {
          pushStatus = 'failed'
          pushError = 'VAPID 미설정'
        } else if (pushResult.sent > 0) {
          pushStatus = 'sent'
          if (pushResult.failed > 0) pushError = `일부 기기 실패 ${pushResult.failed}`
        } else {
          pushStatus = 'failed'
          pushError = pushResult.noSubscriptions > 0 ? '앱 푸시 구독 없음' : '푸시 발송 실패'
        }
      }

      results.push({
        email: recipient.email,
        name: recipient.name,
        tourCount: recipient.tours.length,
        emailStatus,
        smsStatus,
        pushStatus,
        ...(emailError ? { emailError } : {}),
        ...(smsError ? { smsError } : {}),
        ...(pushError ? { pushError } : {}),
      })
    }

    const emailSent = results.filter((row) => row.emailStatus === 'sent').length
    const smsSent = results.filter((row) => row.smsStatus === 'sent').length
    const pushSent = results.filter((row) => row.pushStatus === 'sent').length
    const failedCount = results.filter(
      (row) =>
        row.emailStatus === 'failed' || row.smsStatus === 'failed' || row.pushStatus === 'failed'
    ).length

    console.info('[admin/tour-reports/remind]', {
      sentBy: auth.user.email,
      recipients: recipients.length,
      emailSent,
      smsSent,
      pushSent,
      failedCount,
    })

    return NextResponse.json({
      success: true,
      recipientCount: recipients.length,
      emailSent,
      smsSent,
      pushSent,
      failedCount,
      results,
    })
  } catch (e) {
    console.error('[admin/tour-reports/remind]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '알림 발송에 실패했습니다.' },
      { status: 500 }
    )
  }
}
