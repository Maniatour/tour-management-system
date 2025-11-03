import { NextRequest, NextResponse } from 'next/server'
import { getSheetNames } from '@/lib/googleSheets'

// Next.js API route 타임아웃 설정 (최대 120초)
export const maxDuration = 120

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
      
      // 각 시트의 기본 정보만 가져오기 (컬럼 정보는 나중에 필요할 때만)
      const sheetInfo = sheets.map(sheet => ({
        name: sheet.name,
        rowCount: sheet.rowCount,
        sampleData: [], // 나중에 필요할 때만 로드
        columns: [] // 나중에 필요할 때만 로드
      }))
      
      console.log(`✅ Processed ${sheetInfo.length} sheets without detailed data`)

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
      const errorMsg = error.message.toLowerCase()
      const errorString = JSON.stringify(error)
      
      console.error('Error details:', {
        message: error.message,
        error: errorString,
        name: error.name
      })
      
      if (errorMsg.includes('timeout')) {
        errorMessage = '요청 시간 초과 (120초) - 구글 시트가 너무 크거나 네트워크가 느립니다. 시트 크기를 줄이거나 잠시 후 다시 시도해주세요.'
      } else if (errorMsg.includes('aborted') || errorMsg.includes('abort')) {
        errorMessage = '요청이 중단되었습니다. 네트워크 연결을 확인하고 잠시 후 다시 시도해주세요.'
      } else if (errorMsg.includes('403') || errorMsg.includes('permission') || errorMsg.includes('caller does not have permission')) {
        const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || '서비스 계정 이메일'
        errorMessage = `구글 시트 접근 권한이 없습니다.\n\n다음 사항을 확인해주세요:\n` +
          `1. Google Cloud Console에서 "Google Sheets API"가 활성화되어 있는지 확인\n` +
          `2. 구글 시트에 서비스 계정 이메일(${clientEmail})을 공유했는지 확인\n` +
          `3. 서비스 계정 권한이 "편집자" 또는 "뷰어"로 설정되어 있는지 확인`
      } else if (errorMsg.includes('404') || errorMsg.includes('not found')) {
        errorMessage = '구글 시트를 찾을 수 없습니다. 스프레드시트 ID를 확인해주세요'
      } else if (errorMsg.includes('quota') || errorMsg.includes('quota exceeded')) {
        errorMessage = 'Google Sheets API 할당량을 초과했습니다. 1-2분 후에 다시 시도해주세요. 할당량이 복구되면 자동으로 재시도됩니다.'
      } else if (errorMsg.includes('rate limit')) {
        errorMessage = 'API 요청 한도를 초과했습니다. 1-2분 후에 다시 시도해주세요.'
      } else if (errorMsg.includes('api not enabled')) {
        errorMessage = `Google Sheets API가 활성화되지 않았습니다.\n\n` +
          `Google Cloud Console에서 다음을 확인해주세요:\n` +
          `1. 프로젝트 선택\n` +
          `2. "API 및 서비스" > "라이브러리"로 이동\n` +
          `3. "Google Sheets API" 검색 및 활성화`
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
