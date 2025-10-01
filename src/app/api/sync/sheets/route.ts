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
    
    // 타임아웃 설정 (30초)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000)
    })

    const fetchPromise = async () => {
      // 시트 목록과 메타데이터 가져오기 (빠른 방식)
      const sheets = await getSheetNames(spreadsheetId)
      
      // 시트가 없는 경우 빈 배열 반환
      if (!sheets || sheets.length === 0) {
        return {
          success: true,
          data: {
            spreadsheetId,
            sheets: []
          }
        }
      }
      
      // 각 시트의 샘플 데이터를 병렬로 가져오기 (최대 2개씩으로 줄임)
      const BATCH_SIZE = 2
      const sheetInfo = []
      
      for (let i = 0; i < sheets.length; i += BATCH_SIZE) {
        const batch = sheets.slice(i, i + BATCH_SIZE)
        
        const batchResults = await Promise.all(
          batch.map(async (sheet) => {
            try {
              const { columns, sampleData } = await getSheetSampleData(spreadsheetId, sheet.name, 2) // 샘플 데이터를 2행으로 줄임
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
                error: error instanceof Error ? error.message : 'Unknown error'
              }
            }
          })
        )
        
        sheetInfo.push(...batchResults)
      }

      return {
        success: true,
        data: {
          spreadsheetId,
          sheets: sheetInfo
        }
      }
    }

    // 타임아웃과 함께 실행
    const result = await Promise.race([fetchPromise(), timeoutPromise])
    return NextResponse.json(result)

  } catch (error) {
    console.error('Get sheets error:', error)
    
    // 구체적인 에러 메시지 제공
    let errorMessage = 'Failed to get sheet information'
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        errorMessage = 'Request timeout - 구글 시트 API 응답이 너무 오래 걸립니다'
      } else if (error.message.includes('403')) {
        errorMessage = '구글 시트 접근 권한이 없습니다. 시트 공유 설정을 확인해주세요'
      } else if (error.message.includes('404')) {
        errorMessage = '구글 시트를 찾을 수 없습니다. 스프레드시트 ID를 확인해주세요'
      } else {
        errorMessage = `API 오류: ${error.message}`
      }
    }
    
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    )
  }
}
