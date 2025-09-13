import { NextRequest, NextResponse } from 'next/server'
import { getSheetNames, readSheetData, readSheetDataDynamic } from '@/lib/googleSheets'

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
    
    // 시트 목록 가져오기
    const sheetNames = await getSheetNames(spreadsheetId)
    
    // 각 시트의 샘플 데이터 가져오기 (첫 5행)
    const sheetInfo = await Promise.all(
      sheetNames.map(async (sheetName) => {
        try {
          // 동적 범위로 데이터 읽기 시도
          const sampleData = await readSheetDataDynamic(spreadsheetId, sheetName)
          console.log(`Sheet ${sheetName} columns:`, sampleData.length > 0 ? Object.keys(sampleData[0]).length : 0)
          return {
            name: sheetName,
            rowCount: sampleData.length,
            sampleData: sampleData.slice(0, 5), // 첫 5행만
            columns: sampleData.length > 0 ? Object.keys(sampleData[0]) : []
          }
        } catch (error) {
          console.error(`Error reading sheet ${sheetName}:`, error)
          // 폴백: 기본 범위로 읽기 시도
          try {
            const fallbackData = await readSheetData(spreadsheetId, sheetName)
            return {
              name: sheetName,
              rowCount: fallbackData.length,
              sampleData: fallbackData.slice(0, 5),
              columns: fallbackData.length > 0 ? Object.keys(fallbackData[0]) : []
            }
          } catch (fallbackError) {
            console.error(`Fallback also failed for sheet ${sheetName}:`, fallbackError)
            return {
              name: sheetName,
              rowCount: 0,
              sampleData: [],
              columns: [],
              error: error.message
            }
          }
        }
      })
    )

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
