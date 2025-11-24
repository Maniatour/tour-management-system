import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { Resend } from 'resend'

/**
 * POST /api/send-email
 * 
 * 예약 확인 이메일 발송 API
 * 
 * 요청 본문:
 * {
 *   reservationId: string,
 *   email: string,
 *   type: 'receipt' | 'voucher' | 'both',  // 영수증, 투어 바우처, 또는 둘 다
 *   locale?: 'ko' | 'en'
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { reservationId, email, type = 'both', locale = 'ko' } = body

    if (!reservationId || !email) {
      return NextResponse.json(
        { error: '예약 ID와 이메일 주소가 필요합니다.' },
        { status: 400 }
      )
    }

    // 예약 정보 조회
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select(`
        *,
        products (
          id,
          name,
          name_ko,
          name_en,
          customer_name_ko,
          customer_name_en,
          duration,
          departure_city,
          arrival_city
        )
      `)
      .eq('id', reservationId)
      .single()

    if (reservationError || !reservation) {
      return NextResponse.json(
        { error: '예약을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const product = reservation.products as any
    const isEnglish = locale === 'en'

    // 이메일 내용 생성
    const emailContent = generateEmailContent(reservation, product, type, isEnglish)
    
    // Resend를 사용한 이메일 발송
    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      console.error('RESEND_API_KEY 환경 변수가 설정되지 않았습니다.')
      return NextResponse.json(
        { error: '이메일 서비스 설정 오류입니다.' },
        { status: 500 }
      )
    }

    const resend = new Resend(resendApiKey)
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev' // 기본값 (Resend 기본 도메인)

    try {
      const { data: emailResult, error: emailError } = await resend.emails.send({
        from: fromEmail,
        to: email,
        subject: emailContent.subject,
        html: emailContent.html,
      })

      if (emailError) {
        console.error('Resend 이메일 발송 오류:', emailError)
        return NextResponse.json(
          { error: '이메일 발송에 실패했습니다.', details: emailError.message },
          { status: 500 }
        )
      }

      console.log('이메일 발송 성공:', {
        to: email,
        subject: emailContent.subject,
        type,
        reservationId,
        emailId: emailResult?.id
      })
    } catch (error) {
      console.error('이메일 발송 오류:', error)
      return NextResponse.json(
        { error: '이메일 발송 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    // 이메일 발송 기록 저장 (선택사항)
    try {
      const { error: logError } = await supabase
        .from('email_logs')
        .insert({
          reservation_id: reservationId,
          email: email,
          email_type: type,
          subject: emailContent.subject,
          status: 'sent',
          sent_at: new Date().toISOString()
        } as never)
        .catch(() => {
          // email_logs 테이블이 없으면 무시
        })

      if (logError) {
        console.error('이메일 로그 저장 오류 (무시):', logError)
      }
    } catch (error) {
      // email_logs 테이블이 없으면 무시
      console.log('이메일 로그 테이블이 없습니다. (무시됨)')
    }

    return NextResponse.json({
      success: true,
      message: '이메일이 발송되었습니다.',
      email: emailContent
    })

  } catch (error) {
    console.error('이메일 발송 오류:', error)
    return NextResponse.json(
      { error: '이메일 발송 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

export function generateEmailContent(reservation: any, product: any, type: 'receipt' | 'voucher' | 'both', isEnglish: boolean) {
  const productName = isEnglish 
    ? (product?.customer_name_en || product?.name_en || product?.name) 
    : (product?.customer_name_ko || product?.name_ko || product?.name)
  
  const tourDate = new Date(reservation.tour_date).toLocaleDateString(isEnglish ? 'en-US' : 'ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  let subject = ''
  let html = ''

  if (type === 'receipt' || type === 'both') {
    subject = isEnglish 
      ? `Payment Receipt - Reservation ${reservation.id}`
      : `결제 영수증 - 예약 ${reservation.id}`
    
    html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .footer { background: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
          .info-row { margin: 10px 0; }
          .label { font-weight: bold; color: #374151; }
          .value { color: #1f2937; }
          .total { font-size: 18px; font-weight: bold; color: #2563eb; margin-top: 20px; padding-top: 20px; border-top: 2px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${isEnglish ? 'Payment Receipt' : '결제 영수증'}</h1>
          </div>
          <div class="content">
            <div class="info-row">
              <span class="label">${isEnglish ? 'Reservation ID:' : '예약 번호:'}</span>
              <span class="value">${reservation.id}</span>
            </div>
            <div class="info-row">
              <span class="label">${isEnglish ? 'Customer Name:' : '고객명:'}</span>
              <span class="value">${reservation.customer_name}</span>
            </div>
            <div class="info-row">
              <span class="label">${isEnglish ? 'Product:' : '상품:'}</span>
              <span class="value">${productName}</span>
            </div>
            <div class="info-row">
              <span class="label">${isEnglish ? 'Tour Date:' : '투어 날짜:'}</span>
              <span class="value">${tourDate}</span>
            </div>
            ${reservation.departure_time ? `
            <div class="info-row">
              <span class="label">${isEnglish ? 'Departure Time:' : '출발 시간:'}</span>
              <span class="value">${reservation.departure_time}</span>
            </div>
            ` : ''}
            <div class="info-row">
              <span class="label">${isEnglish ? 'Participants:' : '참가 인원:'}</span>
              <span class="value">
                ${isEnglish ? 'Adults' : '성인'}: ${reservation.adults}, 
                ${isEnglish ? 'Children' : '아동'}: ${reservation.children}, 
                ${isEnglish ? 'Infants' : '유아'}: ${reservation.infants}
              </span>
            </div>
            <div class="total">
              <span class="label">${isEnglish ? 'Total Amount:' : '총 결제 금액:'}</span>
              <span class="value">$${reservation.total_price.toFixed(2)}</span>
            </div>
          </div>
          <div class="footer">
            <p>${isEnglish ? 'Thank you for your reservation!' : '예약해 주셔서 감사합니다!'}</p>
          </div>
        </div>
      </body>
      </html>
    `
  }

  if (type === 'voucher' || type === 'both') {
    const voucherSubject = isEnglish 
      ? `Tour Voucher - Reservation ${reservation.id}`
      : `투어 바우처 - 예약 ${reservation.id}`
    
    const voucherHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #059669; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f0fdf4; padding: 20px; border: 1px solid #86efac; }
          .voucher-code { background: white; padding: 15px; border: 2px dashed #059669; text-align: center; margin: 20px 0; font-size: 24px; font-weight: bold; color: #059669; }
          .info-row { margin: 10px 0; }
          .label { font-weight: bold; color: #065f46; }
          .value { color: #047857; }
          .footer { background: #d1fae5; padding: 15px; text-align: center; font-size: 12px; color: #065f46; border-radius: 0 0 8px 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${isEnglish ? 'Tour Voucher' : '투어 바우처'}</h1>
          </div>
          <div class="content">
            <div class="voucher-code">
              ${reservation.id}
            </div>
            <div class="info-row">
              <span class="label">${isEnglish ? 'Customer Name:' : '고객명:'}</span>
              <span class="value">${reservation.customer_name}</span>
            </div>
            <div class="info-row">
              <span class="label">${isEnglish ? 'Product:' : '상품:'}</span>
              <span class="value">${productName}</span>
            </div>
            <div class="info-row">
              <span class="label">${isEnglish ? 'Tour Date:' : '투어 날짜:'}</span>
              <span class="value">${tourDate}</span>
            </div>
            ${reservation.departure_time ? `
            <div class="info-row">
              <span class="label">${isEnglish ? 'Departure Time:' : '출발 시간:'}</span>
              <span class="value">${reservation.departure_time}</span>
            </div>
            ` : ''}
            <div class="info-row">
              <span class="label">${isEnglish ? 'Participants:' : '참가 인원:'}</span>
              <span class="value">
                ${isEnglish ? 'Adults' : '성인'}: ${reservation.adults}, 
                ${isEnglish ? 'Children' : '아동'}: ${reservation.children}, 
                ${isEnglish ? 'Infants' : '유아'}: ${reservation.infants}
              </span>
            </div>
            ${reservation.notes ? `
            <div class="info-row">
              <span class="label">${isEnglish ? 'Special Requests:' : '특별 요청사항:'}</span>
              <span class="value">${reservation.notes}</span>
            </div>
            ` : ''}
          </div>
          <div class="footer">
            <p>${isEnglish ? 'Please present this voucher on the tour date.' : '투어 당일 이 바우처를 제시해 주세요.'}</p>
          </div>
        </div>
      </body>
      </html>
    `

    if (type === 'both') {
      subject = isEnglish 
        ? `Reservation Confirmation - ${reservation.id}`
        : `예약 확인 - ${reservation.id}`
      html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .section { margin-bottom: 30px; }
          </style>
        </head>
        <body>
          ${html}
          <hr style="margin: 30px 0; border: none; border-top: 2px solid #e5e7eb;">
          ${voucherHtml}
        </body>
        </html>
      `
    } else {
      subject = voucherSubject
      html = voucherHtml
    }
  }

  return { subject, html }
}

