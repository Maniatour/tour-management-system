import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { requireStaffApiAuth } from '@/lib/api-security'

export const dynamic = 'force-dynamic'

const MAX_HTML_CHARS = 400_000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * POST /api/admin/biweekly-pay/send-email
 * 2주급 계산기 프린트 내역을 해당 직원 이메일로 발송
 */
export async function POST(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  try {
    const body = (await request.json()) as {
      employeeEmail?: unknown
      to?: unknown
      subject?: unknown
      html?: unknown
      startDate?: unknown
      endDate?: unknown
    }

    const rawEmail = String(body.employeeEmail ?? body.to ?? '').trim()
    const employeeEmail = rawEmail.toLowerCase()
    const subject = String(body.subject ?? '').trim()
    const html = String(body.html ?? '')
    const startDate = typeof body.startDate === 'string' ? body.startDate : ''
    const endDate = typeof body.endDate === 'string' ? body.endDate : ''

    if (!employeeEmail || !EMAIL_RE.test(employeeEmail)) {
      return NextResponse.json({ error: '올바른 직원 이메일이 필요합니다.' }, { status: 400 })
    }
    if (!subject) {
      return NextResponse.json({ error: '제목이 필요합니다.' }, { status: 400 })
    }
    if (!html) {
      return NextResponse.json({ error: '이메일 내용이 필요합니다.' }, { status: 400 })
    }
    if (html.length > MAX_HTML_CHARS) {
      return NextResponse.json({ error: '이메일 내용이 너무 깁니다.' }, { status: 400 })
    }

    const { data: exactMember, error: memberError } = await auth.staffClient
      .from('team')
      .select('email')
      .eq('email', rawEmail)
      .maybeSingle()

    if (memberError) {
      console.error('[biweekly-pay/send-email] team lookup', memberError)
      return NextResponse.json({ error: '직원 확인 중 오류가 발생했습니다.' }, { status: 500 })
    }

    let recipientEmail = exactMember?.email || ''
    if (!recipientEmail) {
      const { data: teamRows, error: teamScanError } = await auth.staffClient
        .from('team')
        .select('email')
      if (teamScanError) {
        console.error('[biweekly-pay/send-email] team scan', teamScanError)
        return NextResponse.json({ error: '직원 확인 중 오류가 발생했습니다.' }, { status: 500 })
      }
      const matched = (teamRows || []).find(
        (row) => (row.email || '').trim().toLowerCase() === employeeEmail
      )
      recipientEmail = matched?.email || ''
    }

    if (!recipientEmail) {
      return NextResponse.json({ error: '팀 목록에 없는 직원입니다.' }, { status: 400 })
    }

    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      return NextResponse.json({ error: '이메일 서비스 설정 오류입니다.' }, { status: 500 })
    }

    const resend = new Resend(resendApiKey)
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'info@maniatour.com'
    const replyTo = process.env.RESEND_REPLY_TO || 'info@maniatour.com'

    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: fromEmail,
      replyTo,
      to: recipientEmail,
      subject,
      html,
    })

    if (emailError) {
      console.error('[biweekly-pay/send-email] resend', emailError)
      return NextResponse.json(
        { error: '이메일 발송에 실패했습니다.', details: emailError.message },
        { status: 500 }
      )
    }

    console.log('[biweekly-pay/send-email] sent', {
      to: recipientEmail,
      period: `${startDate} ~ ${endDate}`,
      sentBy: auth.userEmail,
      emailId: emailResult?.id,
    })

    return NextResponse.json({
      success: true,
      message: '이메일이 발송되었습니다.',
      emailId: emailResult?.id,
    })
  } catch (error) {
    console.error('[biweekly-pay/send-email]', error)
    return NextResponse.json({ error: '이메일 발송 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
