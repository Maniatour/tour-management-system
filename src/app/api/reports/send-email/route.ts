import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { Resend } from 'resend'

export async function POST(request: NextRequest) {
  try {
    // 인증 확인 (cron job에서 호출하는 경우 헤더에 특별한 키 포함)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { period, dateRange } = body

    // 어드민 이메일 주소 조회
    const { data: admins } = await supabase
      .from('team')
      .select('email')
      .eq('position', 'super')
      .eq('is_active', true)

    if (!admins || admins.length === 0) {
      return NextResponse.json({ error: '어드민을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 리포트 데이터 생성
    const reportData = await generateReportData(period, dateRange)

    // 이메일 내용 생성
    const emailContent = generateEmailContent(reportData, period, dateRange)

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
    const replyTo = process.env.RESEND_REPLY_TO || 'info@maniatour.com'

    // 모든 어드민에게 이메일 전송
    const emailPromises = admins.map(admin =>
      resend.emails.send({
        from: fromEmail,
        reply_to: replyTo,
        to: admin.email,
        subject: `[${period === 'daily' ? '일별' : period === 'weekly' ? '주별' : period === 'monthly' ? '월별' : '연간'}] 통계 리포트 - ${dateRange.start} ~ ${dateRange.end}`,
        html: emailContent,
      })
    )

    const results = await Promise.allSettled(emailPromises)

    const successCount = results.filter(r => r.status === 'fulfilled').length
    const failureCount = results.filter(r => r.status === 'rejected').length

    return NextResponse.json({
      success: true,
      message: `이메일 전송 완료: ${successCount}건 성공, ${failureCount}건 실패`,
      sentTo: admins.map(a => a.email),
      results
    })
  } catch (error) {
    console.error('이메일 전송 오류:', error)
    return NextResponse.json(
      { error: '이메일 전송 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

async function generateReportData(period: string, dateRange: { start: string; end: string }) {
  // 리포트 데이터 생성 로직 (간단한 예시)
  // 실제로는 더 상세한 통계 데이터를 생성해야 함
  
  const { data: reservations } = await supabase
    .from('reservations')
    .select('id')
    .gte('added_time', dateRange.start)
    .lte('added_time', dateRange.end)

  const { data: tours } = await supabase
    .from('tours')
    .select('id')
    .gte('tour_date', dateRange.start)
    .lte('tour_date', dateRange.end)

  return {
    period,
    dateRange,
    reservations: reservations?.length || 0,
    tours: tours?.length || 0
  }
}

function generateEmailContent(reportData: any, period: string, dateRange: { start: string; end: string }) {
  const periodLabel = period === 'daily' ? '일별' : period === 'weekly' ? '주별' : period === 'monthly' ? '월별' : '연간'
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 5px 5px; }
        .stat-box { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #2563eb; }
        .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${periodLabel} 통계 리포트</h1>
          <p>기간: ${dateRange.start} ~ ${dateRange.end}</p>
        </div>
        <div class="content">
          <div class="stat-box">
            <h3>예약 통계</h3>
            <p>총 예약 수: ${reportData.reservations}건</p>
          </div>
          <div class="stat-box">
            <h3>투어 통계</h3>
            <p>총 투어 수: ${reportData.tours}건</p>
          </div>
          <p style="margin-top: 20px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/reports" 
               style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
              상세 리포트 보기
            </a>
          </p>
        </div>
        <div class="footer">
          <p>이 이메일은 자동으로 생성되었습니다.</p>
        </div>
      </div>
    </body>
    </html>
  `
}
