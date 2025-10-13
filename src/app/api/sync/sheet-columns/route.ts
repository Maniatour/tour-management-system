import { NextRequest, NextResponse } from 'next/server'
import { getSheetSampleData } from '@/lib/googleSheets'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { spreadsheetId, sheetName } = body

    if (!spreadsheetId || !sheetName) {
      return NextResponse.json(
        { success: false, message: 'Spreadsheet ID and sheet name are required' },
        { status: 400 }
      )
    }

    console.log(`Getting columns for sheet: ${sheetName}`)
    
    // 시트의 컬럼 정보 가져오기
    const { columns, sampleData } = await getSheetSampleData(spreadsheetId, sheetName, 1)
    
    return NextResponse.json({
      success: true,
      data: {
        sheetName,
        columns,
        sampleData
      }
    })

  } catch (error) {
    console.error('Get sheet columns error:', error)
    
    let errorMessage = 'Failed to get sheet columns'
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        errorMessage = '요청 시간 초과 - 구글 시트가 너무 크거나 네트워크가 느립니다.'
      } else if (error.message.includes('403')) {
        errorMessage = '구글 시트 접근 권한이 없습니다.'
      } else if (error.message.includes('404')) {
        errorMessage = '구글 시트를 찾을 수 없습니다.'
      } else if (error.message.includes('quota') || error.message.includes('Quota exceeded')) {
        errorMessage = 'Google Sheets API 할당량을 초과했습니다. 1-2분 후에 다시 시도해주세요.'
      } else {
        errorMessage = `오류: ${error.message}`
      }
    }
    
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    )
  }
}
