import { NextRequest, NextResponse } from 'next/server'
import { getSheetNames, getSheetSampleData } from '@/lib/googleSheets'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { spreadsheetId } = body

    if (!spreadsheetId) {
      return NextResponse.json(
        { success: false, message: 'Spreadsheet ID is required' },
        { status: 400 }
      )
    }

    console.log(`Getting sheet information for: ${spreadsheetId}`)
    
    // 시트 목록과 메타데이터 가져오기 (빠른 방식)
    const sheets = await getSheetNames(spreadsheetId)
    
    // 각 시트의 샘플 데이터를 병렬로 가져오기 (최대 5개씩)
    const BATCH_SIZE = 5
    const sheetInfo = []
    
    for (let i = 0; i < sheets.length; i += BATCH_SIZE) {
      const batch = sheets.slice(i, i + BATCH_SIZE)
      
      const batchResults = await Promise.all(
        batch.map(async (sheet) => {
          try {
            const { columns, sampleData } = await getSheetSampleData(spreadsheetId, sheet.name)
            console.log(`Sheet ${sheet.name} columns:`, columns.length)
            return {
              name: sheet.name,
              rowCount: sheet.rowCount,
              sampleData: sampleData,
              columns: columns
            }
          } catch (error) {
            console.error(`Error reading sheet ${sheet.name}:`, error)
            return {
              name: sheet.name,
              rowCount: sheet.rowCount,
              sampleData: [],
              columns: [],
              error: error.message
            }
          }
        })
      )
      
      sheetInfo.push(...batchResults)
    }

    return NextResponse.json({
      success: true,
      data: {
        spreadsheetId,
        sheets: sheetInfo
      }
    })

  } catch (error) {
    console.error('Get sheets error:', error)
    return NextResponse.json(
      { success: false, message: `Failed to get sheet information: ${error}` },
      { status: 500 }
    )
  }
}
