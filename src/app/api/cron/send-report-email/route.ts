import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { Resend } from 'resend'

export async function GET(request: NextRequest) {
  try {
    // Vercel Cron Job 인증 확인
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    // Vercel Cron은 자동으로 인증 헤더를 추가하지만, 추가 보안을 위해 확인
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const now = new Date()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()
    const currentTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}:00`

    // 활성화된 스케줄 조회
    const { data: schedules, error } = await supabase
      .from('report_email_schedules')
      .select('*')
      .eq('enabled', true)

    if (error) {
      console.error('스케줄 조회 오류:', error)
      return NextResponse.json({ error: '스케줄 조회 실패' }, { status: 500 })
    }

    if (!schedules || schedules.length === 0) {
      return NextResponse.json({ message: '활성화된 스케줄이 없습니다.' })
    }

    // 현재 시간과 일치하는 스케줄 찾기
    const activeSchedules = schedules.filter(schedule => {
      const scheduleTime = schedule.send_time
      return scheduleTime === currentTime
    })

    if (activeSchedules.length === 0) {
      return NextResponse.json({ message: '현재 시간에 실행할 스케줄이 없습니다.' })
    }

    // 각 스케줄에 대해 리포트 이메일 전송
    const results = []
    for (const schedule of activeSchedules) {
      try {
        const dateRange = calculateDateRange(schedule.period)
        const result = await sendReportEmail(schedule.period, dateRange)
        results.push({
          schedule: schedule.period,
          success: true,
          result
        })
      } catch (error) {
        console.error(`${schedule.period} 리포트 이메일 전송 오류:`, error)
        results.push({
          schedule: schedule.period,
          success: false,
          error: error instanceof Error ? error.message : '알 수 없는 오류'
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `${results.length}개의 리포트 이메일을 처리했습니다.`,
      results
    })
  } catch (error) {
    console.error('리포트 이메일 cron job 오류:', error)
    return NextResponse.json(
      { error: '리포트 이메일 전송 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

function calculateDateRange(period: string): { start: string; end: string } {
  const today = new Date()
  let startDate: Date
  let endDate = new Date(today)
  endDate.setHours(23, 59, 59, 999)

  switch (period) {
    case 'daily':
      startDate = new Date(today)
      startDate.setHours(0, 0, 0, 0)
      break
    case 'weekly':
      startDate = new Date(today)
      const dayOfWeek = startDate.getDay()
      startDate.setDate(today.getDate() - dayOfWeek)
      startDate.setHours(0, 0, 0, 0)
      break
    case 'monthly':
      startDate = new Date(today.getFullYear(), today.getMonth(), 1)
      startDate.setHours(0, 0, 0, 0)
      break
    case 'yearly':
      startDate = new Date(today.getFullYear(), 0, 1)
      startDate.setHours(0, 0, 0, 0)
      break
    default:
      startDate = new Date(today)
      startDate.setHours(0, 0, 0, 0)
  }

  return {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0]
  }
}

async function sendReportEmail(period: string, dateRange: { start: string; end: string }) {
  // 어드민 이메일 주소 조회
  const { data: admins } = await supabase
    .from('team')
    .select('email')
    .eq('position', 'super')
    .eq('is_active', true)

  if (!admins || admins.length === 0) {
    throw new Error('어드민을 찾을 수 없습니다.')
  }

  // 리포트 데이터 생성
  const reportData = await generateReportData(period, dateRange)

  // 이메일 내용 생성
  const emailContent = generateEmailContent(reportData, period, dateRange)

  // Resend API 키 확인
  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY 환경 변수가 설정되지 않았습니다.')
  }

  const resend = new Resend(resendApiKey)
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'info@maniatour.com'
  const replyTo = process.env.RESEND_REPLY_TO || 'info@maniatour.com'

  const periodLabel = period === 'daily' ? '일별' : period === 'weekly' ? '주별' : period === 'monthly' ? '월별' : '연간'

  // 모든 어드민에게 이메일 전송
  const emailPromises = admins.map(admin =>
    resend.emails.send({
      from: fromEmail,
      reply_to: replyTo,
      to: admin.email,
      subject: `[${periodLabel}] 통계 리포트 - ${dateRange.start} ~ ${dateRange.end}`,
      html: emailContent,
    })
  )

  const results = await Promise.allSettled(emailPromises)
  const successCount = results.filter(r => r.status === 'fulfilled').length
  const failureCount = results.filter(r => r.status === 'rejected').length

  return {
    sentTo: admins.map(a => a.email),
    successCount,
    failureCount
  }
}

async function generateReportData(period: string, dateRange: { start: string; end: string }) {
  // 예약 통계
  const { data: reservations } = await supabase
    .from('reservations')
    .select('id')
    .gte('added_time', dateRange.start)
    .lte('added_time', dateRange.end)

  // 예약 가격
  const reservationIds = reservations?.map(r => r.id) || []
  let reservationRevenue = 0
  if (reservationIds.length > 0) {
    const { data: pricing } = await supabase
      .from('reservation_pricing')
      .select('total_price')
      .in('reservation_id', reservationIds)
    
    reservationRevenue = pricing?.reduce((sum, p) => sum + (p.total_price || 0), 0) || 0
  }

  // 투어 통계
  const { data: tours } = await supabase
    .from('tours')
    .select('id')
    .gte('tour_date', dateRange.start)
    .lte('tour_date', dateRange.end)

  // 입금 통계
  const { data: deposits } = await supabase
    .from('payment_records')
    .select('amount')
    .gte('submit_on', dateRange.start)
    .lte('submit_on', dateRange.end)
    .in('payment_status', ['Deposit Received', 'Balance Received', 'Partner Received', "Customer's CC Charged", 'Commission Received !'])

  const totalDeposits = deposits?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0

  // 지출 통계
  const { data: expenses } = await supabase
    .from('tour_expenses')
    .select('amount')
    .gte('created_at', dateRange.start)
    .lte('created_at', dateRange.end)

  const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0

  return {
    period,
    dateRange,
    reservations: reservations?.length || 0,
    tours: tours?.length || 0,
    revenue: reservationRevenue,
    deposits: totalDeposits,
    expenses: totalExpenses,
    netProfit: reservationRevenue - totalExpenses
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
        .stat-row { display: flex; justify-content: space-between; margin: 8px 0; }
        .stat-label { color: #6b7280; }
        .stat-value { font-weight: bold; color: #111827; }
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
            <div class="stat-row">
              <span class="stat-label">총 예약 수:</span>
              <span class="stat-value">${reportData.reservations}건</span>
            </div>
          </div>
          <div class="stat-box">
            <h3>투어 통계</h3>
            <div class="stat-row">
              <span class="stat-label">총 투어 수:</span>
              <span class="stat-value">${reportData.tours}건</span>
            </div>
          </div>
          <div class="stat-box">
            <h3>수익 통계</h3>
            <div class="stat-row">
              <span class="stat-label">총 수익:</span>
              <span class="stat-value">$${reportData.revenue.toLocaleString()}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">총 입금:</span>
              <span class="stat-value">$${reportData.deposits.toLocaleString()}</span>
            </div>
          </div>
          <div class="stat-box">
            <h3>지출 통계</h3>
            <div class="stat-row">
              <span class="stat-label">총 지출:</span>
              <span class="stat-value">$${reportData.expenses.toLocaleString()}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">순이익:</span>
              <span class="stat-value">$${reportData.netProfit.toLocaleString()}</span>
            </div>
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
