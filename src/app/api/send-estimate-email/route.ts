import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

/**
 * POST /api/send-estimate-email
 * 
 * Estimate 이메일 발송 API
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { to, subject, html, customerName, customerPhone } = body

    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: '이메일 주소, 제목, 내용이 필요합니다.' },
        { status: 400 }
      )
    }

    // Resend API 키 확인
    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      console.error('RESEND_API_KEY 환경 변수가 설정되지 않았습니다.')
      return NextResponse.json(
        { error: '이메일 서비스 설정 오류입니다.' },
        { status: 500 }
      )
    }

    const resend = new Resend(resendApiKey)
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'info@maniatour.com'
    // Reply-To 설정: 회신은 info@maniatour.com으로 받기
    const replyTo = process.env.RESEND_REPLY_TO || 'info@maniatour.com'

    // 이메일 발송
    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: fromEmail,
      reply_to: replyTo,
      to: to,
      subject: subject,
      html: html,
    })

    if (emailError) {
      console.error('Resend 이메일 발송 오류:', emailError)
      return NextResponse.json(
        { error: '이메일 발송에 실패했습니다.', details: emailError.message },
        { status: 500 }
      )
    }

    console.log('Estimate 이메일 발송 성공:', {
      to: to,
      subject: subject,
      customerName,
      emailId: emailResult?.id
    })

    return NextResponse.json({
      success: true,
      message: 'Estimate가 발송되었습니다.',
      emailId: emailResult?.id
    })

  } catch (error) {
    console.error('Estimate 발송 오류:', error)
    return NextResponse.json(
      { error: 'Estimate 발송 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
