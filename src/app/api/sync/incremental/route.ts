import { NextRequest, NextResponse } from 'next/server'
import { runIncrementalSync } from '@/lib/syncService'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { spreadsheetId, reservationsSheet, toursSheet } = body

    if (!spreadsheetId) {
      return NextResponse.json(
        { success: false, message: 'Spreadsheet ID is required' },
        { status: 400 }
      )
    }

    // 기본 시트명 설정
    const reservationsSheetName = reservationsSheet || 'Reservations'
    const toursSheetName = toursSheet || 'Tours'

    console.log(`Starting incremental sync for spreadsheet: ${spreadsheetId}`)
    
    // 증분 동기화 실행
    const result = await runIncrementalSync(spreadsheetId, reservationsSheetName, toursSheetName)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        data: result.details
      })
    } else {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Incremental sync error:', error)
    return NextResponse.json(
      { success: false, message: `Incremental sync failed: ${error}` },
      { status: 500 }
    )
  }
}
