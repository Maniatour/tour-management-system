import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import {
  getTicketBookingVendorCc,
  TICKET_BOOKING_VENDOR_FROM_HEADER,
  TICKET_BOOKING_VENDOR_REPLY_TO,
} from '@/lib/ticketBookingVendorEmailConfig'

/**
 * POST /api/ticket-booking-vendor-email
 * 티켓 부킹 제휴업체 예매/변경 요청 메일 발송
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { to, subject, html } = body as {
      to?: string
      subject?: string
      html?: string
    }

    const recipient = String(to || '').trim()
    if (!recipient || !subject?.trim() || !html?.trim()) {
      return NextResponse.json(
        { error: '수신 주소, 제목, 본문이 필요합니다.' },
        { status: 400 }
      )
    }

    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      console.error('RESEND_API_KEY 환경 변수가 설정되지 않았습니다.')
      return NextResponse.json(
        { error: '이메일 서비스 설정 오류입니다.' },
        { status: 500 }
      )
    }

    const resend = new Resend(resendApiKey)

    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: TICKET_BOOKING_VENDOR_FROM_HEADER,
      reply_to: TICKET_BOOKING_VENDOR_REPLY_TO,
      to: recipient,
      cc: getTicketBookingVendorCc(recipient),
      subject: subject.trim(),
      html: html.trim(),
    })

    if (emailError) {
      console.error('티켓 부킹 제휴 메일 발송 오류:', emailError)
      return NextResponse.json(
        { error: '이메일 발송에 실패했습니다.', details: emailError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '제휴업체 이메일이 발송되었습니다.',
      emailId: emailResult?.id,
    })
  } catch (error) {
    console.error('티켓 부킹 제휴 메일 발송 오류:', error)
    return NextResponse.json(
      { error: '이메일 발송 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
