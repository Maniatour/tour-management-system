import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getOperationsCc } from '@/lib/emailConfig'

/**
 * POST /api/send-guide-assignment-email
 * 가이드 배정 안내 이메일 발송
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { to, subject, html } = body as {
      to?: string
      subject?: string
      html?: string
      sentBy?: string | null
      tourIds?: string[]
    }

    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: '수신자, 제목, 내용이 필요합니다.' },
        { status: 400 },
      )
    }

    const resendApiKey = process.env.RESEND_API_KEY
    const isDevelopment = process.env.NODE_ENV === 'development'
    const skipEmailInDev = process.env.SKIP_EMAIL_IN_DEV === 'true'

    if (!resendApiKey) {
      if (isDevelopment && skipEmailInDev) {
        return NextResponse.json({
          success: true,
          message: '개발 환경: 이메일 발송이 건너뛰어졌습니다.',
          skipped: true,
        })
      }
      return NextResponse.json(
        { error: '이메일 서비스 설정 오류입니다. RESEND_API_KEY가 필요합니다.' },
        { status: 500 },
      )
    }

    const resend = new Resend(resendApiKey)
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'info@maniatour.com'
    const replyTo = process.env.RESEND_REPLY_TO || 'info@maniatour.com'

    const opsCc = getOperationsCc(to)
    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: fromEmail,
      replyTo,
      to,
      ...(opsCc ? { cc: opsCc } : {}),
      subject,
      html,
    })

    if (emailError) {
      console.error('[send-guide-assignment-email]', emailError)
      return NextResponse.json(
        { error: '이메일 발송에 실패했습니다.', details: emailError.message },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      message: '이메일이 발송되었습니다.',
      emailId: emailResult?.id,
    })
  } catch (error) {
    console.error('[send-guide-assignment-email]', error)
    return NextResponse.json(
      { error: '이메일 발송 중 오류가 발생했습니다.' },
      { status: 500 },
    )
  }
}
