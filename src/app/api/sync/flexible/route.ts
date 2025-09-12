import { NextRequest, NextResponse } from 'next/server'
import { flexibleSync } from '@/lib/flexibleSyncService'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      spreadsheetId, 
      sheetName, 
      targetTable, 
      columnMapping 
    } = body

    if (!spreadsheetId || !sheetName || !targetTable) {
      return NextResponse.json(
        { success: false, message: 'Spreadsheet ID, sheet name, and target table are required' },
        { status: 400 }
      )
    }

    console.log(`Starting flexible sync for spreadsheet: ${spreadsheetId}`)
    console.log(`Sheet: ${sheetName}, Table: ${targetTable}`)
    console.log(`Column mapping:`, columnMapping)
    
    // 유연한 동기화 실행
    const result = await flexibleSync(spreadsheetId, sheetName, targetTable, columnMapping)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        data: result.details,
        count: result.count
      })
    } else {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Flexible sync error:', error)
    return NextResponse.json(
      { success: false, message: `Flexible sync failed: ${error}` },
      { status: 500 }
    )
  }
}
