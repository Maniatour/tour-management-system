import { NextRequest, NextResponse } from 'next/server'
import { runFullSync } from '@/lib/syncService'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { spreadsheetId, reservationsSheet, toursSheet, lastSyncTime } = body

    if (!spreadsheetId) {
      return NextResponse.json(
        { success: false, message: 'Spreadsheet ID is required' },
        { status: 400 }
      )
    }

    // 기본 시트명 설정
    const reservationsSheetName = reservationsSheet || 'Reservations'
    const toursSheetName = toursSheet || 'Tours'

    console.log(`Starting periodic sync for spreadsheet: ${spreadsheetId}`)
    console.log(`Last sync time: ${lastSyncTime || 'Never'}`)
    
    // 전체 동기화 실행
    const result = await runFullSync(spreadsheetId, reservationsSheetName, toursSheetName)

    // 동기화 시간 기록
    const syncTime = new Date().toISOString()

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        data: result.details,
        syncTime
      })
    } else {
      return NextResponse.json(
        { success: false, message: result.message, syncTime },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Periodic sync error:', error)
    return NextResponse.json(
      { success: false, message: `Periodic sync failed: ${error}` },
      { status: 500 }
    )
  }
}

// GET 요청으로 동기화 상태 확인
export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      message: 'Sync API is running',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Sync API error: ${error}` },
      { status: 500 }
    )
  }
}
