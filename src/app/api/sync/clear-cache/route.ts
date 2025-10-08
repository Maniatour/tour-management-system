import { NextRequest, NextResponse } from 'next/server'
import { clearSheetCache } from '@/lib/googleSheets'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { spreadsheetId } = body

    console.log('Clearing cache for spreadsheet:', spreadsheetId)
    
    // 캐시 초기화
    clearSheetCache(spreadsheetId)
    
    return NextResponse.json({
      success: true,
      message: 'Cache cleared successfully'
    })
  } catch (error) {
    console.error('Error clearing cache:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to clear cache' },
      { status: 500 }
    )
  }
}
