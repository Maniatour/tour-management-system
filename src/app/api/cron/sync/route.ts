import { NextRequest, NextResponse } from 'next/server'
import { runFullSync } from '@/lib/syncService'

// Vercel Cron Job을 위한 엔드포인트
export async function GET(request: NextRequest) {
  try {
    // 환경 변수에서 기본 설정 가져오기
    const spreadsheetId = process.env.DEFAULT_SPREADSHEET_ID
    const reservationsSheet = process.env.RESERVATIONS_SHEET_NAME || 'Reservations'
    const toursSheet = process.env.TOURS_SHEET_NAME || 'Tours'

    if (!spreadsheetId) {
      console.error('DEFAULT_SPREADSHEET_ID environment variable is not set')
      return NextResponse.json(
        { success: false, message: 'Spreadsheet ID not configured' },
        { status: 500 }
      )
    }

    console.log(`Starting scheduled sync for spreadsheet: ${spreadsheetId}`)
    
    // 전체 동기화 실행
    const result = await runFullSync(spreadsheetId, reservationsSheet, toursSheet)

    console.log('Scheduled sync completed:', result)

    return NextResponse.json({
      success: result.success,
      message: result.message,
      timestamp: new Date().toISOString(),
      details: result.details
    })

  } catch (error) {
    console.error('Scheduled sync error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: `Scheduled sync failed: ${error}`,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// POST 요청도 지원 (수동 실행용)
export async function POST(request: NextRequest) {
  return GET(request)
}
