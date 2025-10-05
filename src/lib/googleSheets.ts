import { google } from 'googleapis'
import { JWT } from 'google-auth-library'

// 구글 시트 API 설정
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']

// 시트 정보 캐시 (메모리 캐시)
const sheetInfoCache = new Map<string, { data: any, timestamp: number }>()
const CACHE_DURATION = 10 * 60 * 1000 // 10분으로 증가 (API 호출 감소)

// 서비스 계정 인증을 위한 설정
const getAuthClient = () => {
  const credentials = {
    type: 'service_account',
    project_id: process.env.GOOGLE_PROJECT_ID,
    private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    client_id: process.env.GOOGLE_CLIENT_ID,
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.GOOGLE_CLIENT_EMAIL}`
  }

  const auth = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: SCOPES,
  })

  return auth
}

// 재시도 로직을 위한 헬퍼 함수
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// 구글 시트에서 데이터 읽기 (재시도 로직 포함)
export const readGoogleSheet = async (spreadsheetId: string, range: string, retries: number = 3) => {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${retries} - Reading range: ${range}`)
      
      // 매번 새로운 인증 클라이언트 생성
      const auth = getAuthClient()
      
      // 더 관대한 설정으로 Google Sheets 클라이언트 생성
      const sheets = google.sheets({ 
        version: 'v4', 
        auth,
        timeout: 120000, // 120초 타임아웃
        retry: true, // 자동 재시도 활성화
        retryConfig: {
          retry: 3,
          retryDelay: 1000,
          statusCodesToRetry: [[100, 199], [429, 429], [500, 599]]
        }
      })

      // AbortController를 사용하지 않고 직접 요청
      const requestOptions = {
        spreadsheetId,
        range,
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'FORMATTED_STRING'
      }
      
      console.log(`Making request with options:`, requestOptions)
      
      const response = await sheets.spreadsheets.values.get(requestOptions)

      const rows = response.data.values
      if (!rows || rows.length === 0) {
        console.log('No data found.')
        return []
      }

      // 첫 번째 행을 헤더로 사용
      const headers = rows[0]
      const data = rows.slice(1).map(row => {
        const obj: any = {}
        headers.forEach((header, index) => {
          obj[header] = row[index] || ''
        })
        return obj
      })

      console.log(`Successfully read ${data.length} rows on attempt ${attempt}`)
      return data
    } catch (error) {
      lastError = error as Error
      console.error(`Attempt ${attempt}/${retries} failed:`, error)
      
      // AbortError인 경우 더 긴 지연 시간 적용
      const isAbortError = error instanceof Error && 
        (error.message.includes('aborted') || error.message.includes('AbortError'))
      
      if (attempt < retries) {
        const baseDelay = isAbortError ? 3000 : 1000 // AbortError인 경우 3초, 그 외는 1초
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 10000) // 최대 10초
        console.log(`Retrying in ${delay}ms... (AbortError: ${isAbortError})`)
        await sleep(delay)
      }
    }
  }
  
  console.error('All retry attempts failed')
  throw lastError || new Error('Failed to read Google Sheet after all retries')
}

// 구글 시트에서 특정 시트의 모든 데이터 읽기
export const readSheetData = async (spreadsheetId: string, sheetName: string) => {
  const range = `${sheetName}!A:ZZ` // A부터 ZZ열까지 읽기 (최대 702개 컬럼)
  return await readGoogleSheet(spreadsheetId, range)
}

// 구글 시트에서 특정 범위의 데이터 읽기
export const readSheetRange = async (spreadsheetId: string, sheetName: string, startRow: number, endRow: number) => {
  const range = `${sheetName}!A${startRow}:ZZ${endRow}`
  return await readGoogleSheet(spreadsheetId, range)
}

// 구글 시트의 시트 목록과 메타데이터 가져오기 (첫 글자가 'S'인 시트만 필터링)
export const getSheetNames = async (spreadsheetId: string) => {
  try {
    console.log('=== getSheetNames started ===')
    console.log('spreadsheetId:', spreadsheetId)
    
    // 캐시 확인
    const cacheKey = `sheetNames_${spreadsheetId}`
    const cached = sheetInfoCache.get(cacheKey)
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      console.log('Using cached sheet names')
      return cached.data
    }

    // 환경변수 확인
    console.log('Checking environment variables...')
    console.log('GOOGLE_CLIENT_EMAIL:', !!process.env.GOOGLE_CLIENT_EMAIL)
    console.log('GOOGLE_PRIVATE_KEY:', !!process.env.GOOGLE_PRIVATE_KEY)
    console.log('GOOGLE_PROJECT_ID:', !!process.env.GOOGLE_PROJECT_ID)
    
    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      throw new Error('Google Sheets API credentials not configured. Please check environment variables.')
    }

    console.log('Creating auth client...')
    const auth = getAuthClient()
    console.log('Auth client created successfully')
    
    const sheets = google.sheets({ version: 'v4', auth })
    console.log('Google Sheets client created')

    // 타임아웃 설정 (90초로 증가)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Google Sheets API timeout')), 90000)
    })

    console.log('Making API request to Google Sheets...')
    const fetchPromise = sheets.spreadsheets.get({
      spreadsheetId,
    })

    const response = await Promise.race([fetchPromise, timeoutPromise]) as any
    console.log('API response received:', !!response?.data)

    const allSheets = response.data.sheets || []
    
    // 첫 글자가 'S'인 시트만 필터링하고 메타데이터 포함
    const filteredSheets = allSheets
      .filter(sheet => {
        const title = sheet.properties?.title
        return title && title.charAt(0).toUpperCase() === 'S'
      })
      .map(sheet => ({
        name: sheet.properties?.title || '',
        rowCount: sheet.properties?.gridProperties?.rowCount || 0,
        columnCount: sheet.properties?.gridProperties?.columnCount || 0
      }))
    
    console.log(`Total sheets: ${allSheets.length}, Filtered sheets (starting with 'S'): ${filteredSheets.length}`)
    console.log('Filtered sheet names:', filteredSheets.map(s => s.name))
    
    // 캐시에 저장
    sheetInfoCache.set(cacheKey, {
      data: filteredSheets,
      timestamp: Date.now()
    })
    
    return filteredSheets
  } catch (error) {
    console.error('Error getting sheet names:', error)
    
    // 구체적인 에러 메시지 제공
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        throw new Error('구글 시트 API 응답 시간 초과')
      } else if (error.message.includes('403')) {
        throw new Error('구글 시트 접근 권한이 없습니다. 시트 공유 설정을 확인해주세요')
      } else if (error.message.includes('404')) {
        throw new Error('구글 시트를 찾을 수 없습니다. 스프레드시트 ID를 확인해주세요')
      } else if (error.message.includes('credentials')) {
        throw new Error('구글 시트 API 인증 정보가 설정되지 않았습니다')
      }
    }
    
    throw error
  }
}

// 시트의 실제 사용된 범위 확인
export const getSheetUsedRange = async (spreadsheetId: string, sheetName: string) => {
  try {
    const auth = getAuthClient()
    const sheets = google.sheets({ version: 'v4', auth })

    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      includeGridData: false
    })

    const sheet = response.data.sheets?.find(s => s.properties?.title === sheetName)
    const gridProperties = sheet?.properties?.gridProperties
    
    if (gridProperties) {
      return {
        rowCount: gridProperties.rowCount || 0,
        columnCount: gridProperties.columnCount || 0
      }
    }
    
    return { rowCount: 0, columnCount: 0 }
  } catch (error) {
    console.error('Error getting sheet used range:', error)
    // 에러 발생 시 기본값 반환
    return { rowCount: 1000, columnCount: 26 }
  }
}

// 동적으로 시트의 실제 사용된 범위로 데이터 읽기
export const readSheetDataDynamic = async (spreadsheetId: string, sheetName: string) => {
  try {
    const usedRange = await getSheetUsedRange(spreadsheetId, sheetName)
    console.log(`Sheet ${sheetName} used range:`, usedRange)
    
    // 실제 사용된 컬럼 수에 맞춰 범위 설정 (최소 26개, 최대 702개)
    const columnCount = Math.max(26, Math.min(usedRange.columnCount || 26, 702))
    const columnRange = getColumnRange(columnCount)
    
    const range = `${sheetName}!A:${columnRange}`
    console.log(`Reading range: ${range}`)
    
    const data = await readGoogleSheet(spreadsheetId, range)
    console.log(`Sheet ${sheetName} data length:`, data.length)
    console.log(`Sheet ${sheetName} first row keys:`, data.length > 0 ? Object.keys(data[0]) : 'No data')
    return data
  } catch (error) {
    console.error('Error reading sheet data dynamically:', error)
    // 폴백: 기본 범위로 읽기
    console.log(`Falling back to readSheetData for ${sheetName}`)
    const fallbackData = await readSheetData(spreadsheetId, sheetName)
    console.log(`Fallback data length:`, fallbackData.length)
    console.log(`Fallback first row keys:`, fallbackData.length > 0 ? Object.keys(fallbackData[0]) : 'No data')
    return fallbackData
  }
}

// 컬럼 수에 따른 범위 문자열 생성
const getColumnRange = (columnCount: number): string => {
  if (columnCount <= 26) {
    return String.fromCharCode(64 + columnCount) // A-Z
  } else {
    const firstChar = String.fromCharCode(64 + Math.floor((columnCount - 1) / 26))
    const secondChar = String.fromCharCode(64 + ((columnCount - 1) % 26) + 1)
    return firstChar + secondChar
  }
}

// 시트의 샘플 데이터 가져오기 (첫 5행만)
export const getSheetSampleData = async (spreadsheetId: string, sheetName: string, maxRows: number = 5) => {
  try {
    // 캐시 확인
    const cacheKey = `sampleData_${spreadsheetId}_${sheetName}`
    const cached = sheetInfoCache.get(cacheKey)
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      console.log(`Using cached sample data for ${sheetName}`)
      return cached.data
    }

    // 더 작은 범위로 시도 (A1:E1만 먼저 시도)
    let data: any[] = []
    let range = `${sheetName}!A1:E1` // 매우 작은 범위로 시작
    
    try {
      console.log(`Trying small range first: ${range}`)
      data = await readGoogleSheet(spreadsheetId, range, 2) // 재시도 횟수 줄임
      
      if (data.length > 0) {
        // 성공하면 더 큰 범위로 확장
        range = `${sheetName}!A1:M${maxRows}`
        console.log(`Small range successful, trying larger range: ${range}`)
        data = await readGoogleSheet(spreadsheetId, range, 2)
      }
    } catch (error) {
      console.error(`Failed to read sheet ${sheetName}, returning empty data`)
      const result = { columns: [], sampleData: [] }
      // 빈 결과도 캐시에 저장
      sheetInfoCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      })
      return result
    }
    
    if (data.length === 0) {
      const result = { columns: [], sampleData: [] }
      // 빈 결과도 캐시에 저장
      sheetInfoCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      })
      return result
    }
    
    // 첫 번째 행을 헤더로 사용
    const columns = Object.keys(data[0])
    const sampleData = data.slice(0, maxRows)
    const result = { columns, sampleData }
    
    // 캐시에 저장
    sheetInfoCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    })
    
    return result
  } catch (error) {
    console.error(`Error getting sample data for sheet ${sheetName}:`, error)
    return { columns: [], sampleData: [] }
  }
}

// 캐시 초기화 함수
export const clearSheetCache = (spreadsheetId?: string) => {
  if (spreadsheetId) {
    // 특정 스프레드시트의 캐시만 삭제
    const keysToDelete = Array.from(sheetInfoCache.keys()).filter(key => 
      key.includes(spreadsheetId)
    )
    keysToDelete.forEach(key => sheetInfoCache.delete(key))
    console.log(`Cleared cache for spreadsheet: ${spreadsheetId}`)
  } else {
    // 전체 캐시 삭제
    sheetInfoCache.clear()
    console.log('Cleared all sheet cache')
  }
}

// googleSheets 객체 export (기존 코드 호환성을 위해)
export const googleSheets = {
  readGoogleSheet,
  readSheetData,
  readSheetRange,
  getSheetNames,
  getSheetUsedRange,
  readSheetDataDynamic,
  getSheetSampleData,
  clearSheetCache
}
