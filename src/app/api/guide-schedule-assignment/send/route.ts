import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { buildGuideScheduleAssignmentPreview } from '@/lib/guideScheduleAssignmentMessage'
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

    type RecipientOverride = {
      email: string
      smsBody?: string
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
    }> = []

    for (const recipient of targets) {
      const override = overrideMap.get(recipient.email.toLowerCase())
      const smsBody = override?.smsBody?.trim() || recipient.smsBody

      if (!smsBody) {
        return NextResponse.json({ error: 'SMS 내용이 비어 있습니다.' }, { status: 400 })
      }

      let smsStatus: 'sent' | 'failed' | 'skipped' = 'skipped'
      let smsError: string | null = null

      if (recipient.phoneE164) {
        const twilioResult = await sendTwilioSms(recipient.phoneE164, smsBody)
        if ('error' in twilioResult) {
          smsStatus = 'failed'
          smsError = twilioResult.error
        } else {
          smsStatus = 'sent'
        }
      } else {
        smsStatus = 'failed'
        smsError = '전화번호 없음'
      }

      results.push({
        email: recipient.email,
        role: recipient.role,
        smsStatus,
        ...(smsError ? { smsError } : {}),
      })
    }

    // 배정 부여 SMS 발송 시 상태를 '부여'로 표시 (대기 중이었을 때만)
    await (db as any)
      .from('tours')
      .update({ assignment_status: 'assigned' })
      .eq('id', tourId)
      .or('assignment_status.eq.pending,assignment_status.is.null')

    const sentCount = results.filter((r) => r.smsStatus === 'sent').length
    const failedCount = results.filter((r) => r.smsStatus === 'failed').length

    console.info('[guide-schedule-assignment/send]', {
      tourId,
      sentBy,
      sentCount,
      failedCount,
    })

    const message =
      failedCount > 0
        ? `SMS ${sentCount}건 발송, 실패 ${failedCount}건.`
        : `SMS ${sentCount}건 발송되었습니다.`

    return NextResponse.json({
      success: true,
      message,
      results,
      preview: preview.data,
    })
  } catch (e) {
    console.error('[guide-schedule-assignment/send]', e)
    return NextResponse.json({ error: '발송 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
