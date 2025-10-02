import { NextRequest, NextResponse } from 'next/server'
import { getSheetNames, getSheetSampleData } from '@/lib/googleSheets'

export async function POST(request: NextRequest) {
  try {
    console.log('=== Google Sheets API Route Started ===')
    const body = await request.json()
    const { spreadsheetId } = body

    console.log('Request body:', { spreadsheetId })

    if (!spreadsheetId) {
      console.log('No spreadsheetId provided')
      return NextResponse.json(
        { success: false, message: 'Spreadsheet ID is required' },
        { status: 400 }
      )
    }

    console.log(`Getting sheet information for: ${spreadsheetId}`)
    
    // 환경 변수 확인
    const hasGoogleCredentials = !!(
      process.env.GOOGLE_CLIENT_EMAIL && 
      process.env.GOOGLE_PRIVATE_KEY && 
      process.env.GOOGLE_PROJECT_ID
    )
    console.log('Google credentials available:', hasGoogleCredentials)
    
    if (!hasGoogleCredentials) {
      console.log('Missing Google credentials')
      return NextResponse.json(
        { success: false, message: 'Google Sheets API credentials not configured' },
        { status: 500 }
      )
    }
    
    // 타임아웃 설정 (120초로 증가)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout after 120 seconds')), 120000)
    })

    const fetchPromise = async () => {
      console.log('Starting sheet data fetch...')
      
      // 시트 목록과 메타데이터 가져오기 (빠른 방식)
      const sheets = await getSheetNames(spreadsheetId)
      console.log(`Found ${sheets?.length || 0} sheets`)
      
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
      
      // 각 시트의 샘플 데이터를 순차적으로 가져오기 (안정성 향상)
      const sheetInfo = []
      
      for (let i = 0; i < sheets.length; i++) {
        const sheet = sheets[i]
        console.log(`Processing sheet ${i + 1}/${sheets.length}: ${sheet.name}`)
        
        try {
          console.log(`Reading sheet: ${sheet.name}`)
          const { columns, sampleData } = await getSheetSampleData(spreadsheetId, sheet.name, 1) // 샘플 데이터를 1행으로 줄임
          console.log(`Sheet ${sheet.name} completed - columns: ${columns.length}`)
          
          sheetInfo.push({
            name: sheet.name,
            rowCount: sheet.rowCount,
            sampleData: sampleData,
            columns: columns
          })
        } catch (error) {
          console.error(`Error reading sheet ${sheet.name}:`, error)
          sheetInfo.push({
            name: sheet.name,
            rowCount: sheet.rowCount,
            sampleData: [],
            columns: [],
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
        
        // 시트 간 지연 추가 (API 부하 방지 및 안정성 향상)
        if (i < sheets.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500)) // 500ms 지연
        }
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
        errorMessage = '요청 시간 초과 (120초) - 구글 시트가 너무 크거나 네트워크가 느립니다. 시트 크기를 줄이거나 잠시 후 다시 시도해주세요.'
      } else if (error.message.includes('aborted') || error.message.includes('abort')) {
        errorMessage = '요청이 중단되었습니다. 네트워크 연결을 확인하고 잠시 후 다시 시도해주세요.'
      } else if (error.message.includes('403')) {
        errorMessage = '구글 시트 접근 권한이 없습니다. 시트 공유 설정을 확인해주세요'
      } else if (error.message.includes('404')) {
        errorMessage = '구글 시트를 찾을 수 없습니다. 스프레드시트 ID를 확인해주세요'
      } else if (error.message.includes('quota')) {
        errorMessage = '구글 API 할당량을 초과했습니다. 잠시 후 다시 시도해주세요'
      } else if (error.message.includes('rate limit')) {
        errorMessage = 'API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요'
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
