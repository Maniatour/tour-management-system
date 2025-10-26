import { google } from 'googleapis'
import { JWT } from 'google-auth-library'

// 타입 정의
interface SheetInfo {
  name: string
  rowCount: number
  columnCount: number
}

interface GoogleSheetsResponse {
  data: {
    sheets?: Array<{
      properties?: {
        title?: string
        gridProperties?: {
          rowCount?: number
          columnCount?: number
        }
        sheetType?: string
      }
    }>
    values?: string[][]
  }
}

interface GoogleSheetsClient {
  spreadsheets: {
    get: (params: { spreadsheetId: string; includeGridData?: boolean }) => Promise<GoogleSheetsResponse>
    values: {
      get: (params: { spreadsheetId: string; range: string; valueRenderOption?: string; dateTimeRenderOption?: string }) => Promise<GoogleSheetsResponse>
    }
  }
}

// 구글 시트 API 설정
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']

// 시트 정보 캐시 (메모리 캐시)
const sheetInfoCache = new Map<string, { data: unknown, timestamp: number }>()
const CACHE_DURATION = 2 * 60 * 60 * 1000 // 2시간으로 증가 (API 호출 대폭 감소)

// 성능 최적화를 위한 설정
const DEFAULT_CHUNK_SIZE = 1000
const MAX_RETRIES = 3
const BASE_DELAY = 1000
const MAX_DELAY = 10000

// 서비스 계정 인증을 위한 설정
const getAuthClient = () => {
  // 환경 변수 검증
  const requiredEnvVars = [
    'GOOGLE_PROJECT_ID',
    'GOOGLE_PRIVATE_KEY_ID', 
    'GOOGLE_PRIVATE_KEY',
    'GOOGLE_CLIENT_EMAIL',
    'GOOGLE_CLIENT_ID'
  ]
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
  
  if (missingVars.length > 0) {
    throw new Error(`Google Sheets API 환경 변수가 설정되지 않았습니다: ${missingVars.join(', ')}. .env.local 파일에 다음 변수들을 설정해주세요: GOOGLE_PROJECT_ID, GOOGLE_PRIVATE_KEY_ID, GOOGLE_PRIVATE_KEY, GOOGLE_CLIENT_EMAIL, GOOGLE_CLIENT_ID`)
  }

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
    email: credentials.client_email!,
    key: credentials.private_key!,
    scopes: SCOPES,
  })

  return auth
}

// 재시도 로직을 위한 헬퍼 함수
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// 지수 백오프 재시도 함수
const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  baseDelay: number = BASE_DELAY,
  maxDelay: number = MAX_DELAY
): Promise<T> => {
  let lastError: Error
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error
      
      // 마지막 시도인 경우 에러 던지기
      if (attempt === maxRetries) {
        throw lastError
      }
      
      // 중단 오류나 네트워크 오류인 경우에만 재시도
      if (error instanceof Error && (
        error.message.includes('aborted') ||
        error.message.includes('ECONNRESET') ||
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('timeout')
      )) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
        console.log(`🔄 재시도 ${attempt + 1}/${maxRetries} - ${delay}ms 대기 후 재시도`)
        await sleep(delay)
      } else {
        // 재시도할 수 없는 오류인 경우 즉시 던지기
        throw error
      }
    }
  }
  
  throw lastError!
}

// 청크 단위로 Google Sheets 데이터 읽기
const readGoogleSheetInChunks = async (
  spreadsheetId: string, 
  range: string, 
  chunkSize: number, 
  sheets: GoogleSheetsClient
) => {
  try {
    console.log(`📊 청크 단위 읽기 시작: ${range}, 청크 크기: ${chunkSize}`)
    
    // 범위 파싱 (예: S_Customers!A:AC)
    const rangeMatch = range.match(/^(.+)!([A-Z]+):([A-Z]+)$/)
    if (!rangeMatch) {
      throw new Error(`Invalid range format: ${range}`)
    }
    
    const [, sheetName, startCol, endCol] = rangeMatch
    
    // 먼저 전체 행 수 확인
    const { data: sheetInfo } = await sheets.spreadsheets.get({
      spreadsheetId,
      includeGridData: false
    })
    
    const sheet = sheetInfo.sheets?.find(s => s.properties?.title === sheetName)
    const totalRows = sheet?.properties?.gridProperties?.rowCount || 1000
    
    console.log(`📋 시트 ${sheetName} 총 행 수: ${totalRows}`)
    
    const allData: Record<string, unknown>[] = []
    let headers: string[] = []
    
    // 첫 번째 청크로 헤더 읽기
    const firstChunkRange = `${sheetName}!${startCol}1:${endCol}${Math.min(chunkSize, totalRows)}`
    console.log(`🎯 첫 번째 청크 읽기: ${firstChunkRange}`)
    
    const firstResponse = await retryWithBackoff(async () => {
      return await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: firstChunkRange,
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'FORMATTED_STRING'
      })
    }, 3, 2000, 8000)
    
    if (!firstResponse.data.values || firstResponse.data.values.length === 0) {
      console.log(`❌ 첫 번째 청크에서 데이터 없음`)
      return []
    }
    
    // 헤더 설정
    headers = firstResponse.data.values[0]
    console.log(`📋 헤더 확인: ${headers.length}개 컬럼`)
    
    // 첫 번째 청크 데이터 처리 (헤더 제외)
    const firstChunkData = firstResponse.data.values.slice(1).map((row: string[]) => {
      const obj: Record<string, unknown> = {}
      headers.forEach((header, index) => {
        obj[header] = row[index] || ''
      })
      return obj
    })
    
    allData.push(...firstChunkData)
    console.log(`✅ 첫 번째 청크 완료: ${firstChunkData.length}개 행`)
    
    // 나머지 청크들 처리
    const remainingRows = totalRows - Math.min(chunkSize, totalRows)
    if (remainingRows > 0) {
      const totalChunks = Math.ceil(remainingRows / chunkSize)
      console.log(`📊 남은 청크 수: ${totalChunks}개`)
      
      for (let i = 0; i < totalChunks; i++) {
        const startRow = chunkSize + (i * chunkSize) + 1
        const endRow = Math.min(startRow + chunkSize - 1, totalRows)
        
        const chunkRange = `${sheetName}!${startCol}${startRow}:${endCol}${endRow}`
        console.log(`🎯 청크 ${i + 2}/${totalChunks + 1} 읽기: ${chunkRange}`)
        
        try {
          // 최적화된 지연 시간 (더 짧게 조정)
          if (i > 0) {
            const delayMs = Math.min(500, Math.max(100, Math.floor(chunkSize / 20)))
            await sleep(delayMs)
          }
          
          const chunkResponse = await retryWithBackoff(async () => {
            return await sheets.spreadsheets.values.get({
              spreadsheetId,
              range: chunkRange,
              valueRenderOption: 'UNFORMATTED_VALUE',
              dateTimeRenderOption: 'FORMATTED_STRING'
            })
          }, 2, 1500, 6000)
          
          if (chunkResponse.data.values && chunkResponse.data.values.length > 0) {
            const chunkData = chunkResponse.data.values.map((row: string[]) => {
              const obj: Record<string, unknown> = {}
              headers.forEach((header, index) => {
                obj[header] = row[index] || ''
              })
              return obj
            })
            
            allData.push(...chunkData)
            console.log(`✅ 청크 ${i + 2} 완료: ${chunkData.length}개 행`)
          }
        } catch (chunkError) {
          console.error(`❌ 청크 ${i + 2} 읽기 실패:`, chunkError)
          // 개별 청크 실패는 무시하고 계속 진행
        }
      }
    }
    
    console.log(`✅ 청크 단위 읽기 완료: 총 ${allData.length}개 행`)
    return allData
    
  } catch (error) {
    console.error(`❌ 청크 단위 읽기 실패:`, error)
    throw error
  }
}

// 구글 시트에서 데이터 읽기 (청크 단위 처리 지원)
export const readGoogleSheet = async (spreadsheetId: string, range: string, chunkSize?: number) => {
  try {
    const auth = getAuthClient()
    const sheets = google.sheets({ 
      version: 'v4', 
      auth,
      timeout: 120000, // 120초로 증가 (대용량 데이터 처리)
    })

    // 청크 단위 처리 여부 확인
    if (chunkSize && range.includes(':')) {
      return await readGoogleSheetInChunks(spreadsheetId, range, chunkSize, sheets as unknown as GoogleSheetsClient)
    }

    const response = await retryWithBackoff(async () => {
      return await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'FORMATTED_STRING'
      })
    }, 3, 2000, 8000)

    console.log(`🔍 Raw response for ${range}:`, {
      status: response.status,
      hasValues: !!response.data.values,
      valuesLength: response.data.values?.length || 0,
      firstRow: response.data.values?.[0] || 'No first row'
    })

    const rows = response.data.values
    if (!rows || rows.length === 0) {
      console.log(`❌ No data in ${range}`)
      return []
    }

    // 첫 번째 행을 헤더로 사용
    const headers = rows[0]
    console.log(`📋 Headers found:`, headers)
    console.log(`📊 Header count:`, headers.length)
    
    // 빈 헤더 필터링
    const validHeaders = headers.filter(h => h && h.toString().trim() !== '')
    console.log(`✅ Valid headers:`, validHeaders)
    
    if (validHeaders.length === 0) {
      console.log(`❌ No valid headers in ${range}`)
      return []
    }

    // 헤더만 있는 경우도 처리 (데이터 행이 0개여도 헤더는 유효)
    const data = rows.slice(1).map((row) => {
      const obj: Record<string, unknown> = {}
      headers.forEach((header, index) => {
        obj[header] = row[index] || ''
      })
      return obj
    })

    // 헤더만 있는 경우 빈 객체를 하나 생성하여 헤더 정보를 유지
    if (data.length === 0 && validHeaders.length > 0) {
      const emptyRow: Record<string, unknown> = {}
      headers.forEach((header) => {
        emptyRow[header] = ''
      })
      data.push(emptyRow)
    }

    console.log(`✅ Successfully parsed ${data.length} rows with ${validHeaders.length} valid columns`)
    return data
  } catch (error) {
    console.error(`❌ API Error:`, error instanceof Error ? error.message : error)
    throw error
  }
}

// 구글 시트에서 특정 시트의 모든 데이터 읽기 (청크 단위 처리 지원) - 최적화된 버전
export const readSheetData = async (spreadsheetId: string, sheetName: string) => {
  try {
    console.log(`📊 readSheetData 시작: ${sheetName}`)
    
    // 실제 사용된 컬럼 수를 빠르게 파악
    const actualColumnCount = await getQuickColumnCount(spreadsheetId, sheetName)
    const columnRange = getColumnRange(actualColumnCount)
    
    const range = `${sheetName}!A:${columnRange}`
    console.log(`📊 읽기 범위: ${range}`)
    
    // 간단한 청크 크기 설정
    const chunkSize = DEFAULT_CHUNK_SIZE // 고정된 작은 청크 크기
    
    console.log(`📊 청크 단위 읽기 사용: ${chunkSize}행씩`)
    
    return await readGoogleSheet(spreadsheetId, range, chunkSize)
  } catch (error) {
    console.error('readSheetData error:', error)
    
    // 중단 오류인 경우 간단한 폴백 재시도
    if (error instanceof Error && error.message.includes('aborted')) {
      console.log(`🔄 readSheetData: API 중단 오류 감지 - 폴백 재시도 중...`)
      
      try {
        await sleep(2000)
        console.log(`🔄 폴백: 500행 청크로 재시도`)
        const fallbackRange = `${sheetName}!A:ZZ`
        return await readGoogleSheet(spreadsheetId, fallbackRange, 500)
      } catch (retryError) {
        console.error('폴백 재시도 실패:', retryError)
        throw retryError
      }
    }
    
    throw error
  }
}

// 구글 시트에서 특정 범위의 데이터 읽기
export const readSheetRange = async (spreadsheetId: string, sheetName: string, startRow: number, endRow: number) => {
  const range = `${sheetName}!A${startRow}:ZZ${endRow}`
  return await readGoogleSheet(spreadsheetId, range)
}

// 구글 시트의 시트 목록과 메타데이터 가져오기 (첫 글자가 'S'인 시트만 필터링)
export const getSheetNames = async (spreadsheetId: string, retryCount: number = 0): Promise<SheetInfo[]> => {
  try {
    console.log('=== getSheetNames started ===')
    console.log('spreadsheetId:', spreadsheetId)
    console.log('retryCount:', retryCount)
    
    // 캐시 확인
    const cacheKey = `sheetNames_${spreadsheetId}`
    const cached = sheetInfoCache.get(cacheKey)
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      console.log('Using cached sheet names')
      return cached.data as SheetInfo[]
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
    
    const sheets = google.sheets({ 
      version: 'v4', 
      auth,
      timeout: 120000 // 120초로 증가 (안정성 향상)
    })
    console.log('Google Sheets client created')

    // 타임아웃 설정 (120초로 증가)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Google Sheets API timeout after 120 seconds')), 120000)
    })

    console.log('Making API request to Google Sheets...')
    const fetchPromise = sheets.spreadsheets.get({
      spreadsheetId,
    })

    const response = await Promise.race([fetchPromise, timeoutPromise]) as GoogleSheetsResponse
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
    
    // 재시도 로직 (최대 2번)
    if (retryCount < 2 && error instanceof Error && (
      error.message.includes('timeout') || 
      error.message.includes('ECONNRESET') ||
      error.message.includes('ETIMEDOUT')
    )) {
      console.log(`Retrying getSheetNames (attempt ${retryCount + 1}/2)...`)
      await sleep(2000 * (retryCount + 1)) // 점진적 지연
      return getSheetNames(spreadsheetId, retryCount + 1)
    }
    
    // 구체적인 에러 메시지 제공
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        throw new Error('구글 시트 API 응답 시간 초과 (120초). 네트워크 연결을 확인하고 다시 시도해주세요.')
      } else if (error.message.includes('403')) {
        throw new Error('구글 시트 접근 권한이 없습니다. 시트 공유 설정을 확인해주세요')
      } else if (error.message.includes('404')) {
        throw new Error('구글 시트를 찾을 수 없습니다. 스프레드시트 ID를 확인해주세요')
      } else if (error.message.includes('credentials')) {
        throw new Error('구글 시트 API 인증 정보가 설정되지 않았습니다')
      } else if (error.message.includes('quota') || error.message.includes('Quota exceeded')) {
        throw new Error('Google Sheets API 할당량을 초과했습니다. 1-2분 후에 다시 시도해주세요.')
      }
    }
    
    throw error
  }
}

// 시트의 실제 사용된 범위 확인 (정확한 방법)
export const getSheetUsedRange = async (spreadsheetId: string, sheetName: string) => {
  try {
    const auth = getAuthClient()
    const sheets = google.sheets({ version: 'v4', auth })

    // 실제 사용된 범위를 정확히 파악하기 위해 시트 메타데이터 조회
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      includeGridData: false
    })

    const sheet = response.data.sheets?.find(s => s.properties?.title === sheetName)
    
    if (sheet?.properties?.gridProperties) {
      const gridProperties = sheet.properties.gridProperties
      
      // 기본값: 시트의 전체 크기
      const rowCount = gridProperties.rowCount || 1000
      let columnCount = gridProperties.columnCount || 26
      
      // 실제 사용된 범위가 있는 경우 더 정확한 값 사용
      if (sheet.properties.sheetType === 'GRID' && sheet.properties.gridProperties) {
        // 시트의 실제 데이터 범위를 확인하기 위해 첫 번째 행 읽기 시도
        try {
          const firstRowResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!1:1`,
            valueRenderOption: 'UNFORMATTED_VALUE'
          })
          
          if (firstRowResponse.data.values && firstRowResponse.data.values[0]) {
            // 첫 번째 행에서 실제 데이터가 있는 마지막 컬럼 찾기
            const firstRow = firstRowResponse.data.values[0]
            let actualColumnCount = 0
            
            for (let i = firstRow.length - 1; i >= 0; i--) {
              if (firstRow[i] && firstRow[i].toString().trim() !== '') {
                actualColumnCount = i + 1
                break
              }
            }
            
            // 실제 컬럼 수가 발견된 경우 사용 (최소 26개)
            if (actualColumnCount > 0) {
              columnCount = Math.max(26, actualColumnCount)
              console.log(`📊 ${sheetName} 실제 컬럼 수: ${columnCount}개`)
            }
          }
        } catch (firstRowError) {
          console.warn(`첫 번째 행 읽기 실패, 기본값 사용:`, firstRowError)
        }
      }
      
      return {
        rowCount,
        columnCount
      }
    }
    
    return { rowCount: 1000, columnCount: 26 }
  } catch (error) {
    console.error('Error getting sheet used range:', error)
    // 에러 발생 시 기본값 반환
    return { rowCount: 1000, columnCount: 26 }
  }
}

// 빠른 컬럼 수 파악 함수 (캐시 활용)
const getQuickColumnCount = async (spreadsheetId: string, sheetName: string): Promise<number> => {
  console.log(`🔍 getQuickColumnCount 시작: ${sheetName}`)
  
  const cacheKey = `columnCount_${spreadsheetId}_${sheetName}`
  const cached = sheetInfoCache.get(cacheKey)
  
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    console.log(`⚡ 캐시에서 컬럼 수 반환: ${cached.data}`)
    return cached.data as number
  }
  
  try {
    console.log(`🔍 Google Sheets API 호출 시작: ${sheetName}!A1:AX1`)
    const auth = getAuthClient()
    const sheets = google.sheets({ 
      version: 'v4', 
      auth,
      timeout: 30000 // 30초 타임아웃
    })
    
    try {
      // 더 간단한 방법으로 컬럼 수 파악 (A1:Z1만 확인)
      console.log(`🔍 간단한 컬럼 수 파악: ${sheetName}!A1:Z1`)
      const simpleResponse = await Promise.race([
        sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!A1:Z1`, // A부터 Z까지 (26개 컬럼만)
          valueRenderOption: 'UNFORMATTED_VALUE'
        }),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Simple column count timeout after 10 seconds')), 10000)
        )
      ])
      
      if (simpleResponse.data.values && simpleResponse.data.values[0]) {
        const firstRow = simpleResponse.data.values[0]
        let actualColumnCount = 0
        
        // 뒤에서부터 실제 데이터가 있는 마지막 컬럼 찾기
        for (let i = firstRow.length - 1; i >= 0; i--) {
          if (firstRow[i] && firstRow[i].toString().trim() !== '') {
            actualColumnCount = i + 1
            break
          }
        }
        
        const columnCount = Math.max(26, Math.min(actualColumnCount, 26))
        
        // 캐시에 저장
        sheetInfoCache.set(cacheKey, {
          data: columnCount,
          timestamp: Date.now()
        })
        
        console.log(`⚡ ${sheetName} 간단한 컬럼 수 파악 완료: ${columnCount}개`)
        return columnCount
      }
      
      console.log(`⚡ 기본 컬럼 수 반환: 26개`)
      return 26
    } catch (simpleError) {
      console.warn(`⚠️ 간단한 컬럼 수 파악도 실패, 기본값 사용:`, simpleError)
      return 26
    }
  } catch (error) {
    console.error(`❌ 빠른 컬럼 수 파악 실패:`, error)
    console.log(`⚡ 기본값 사용: 26개`)
    return 26
  }
}

// 동적으로 시트의 실제 사용된 범위로 데이터 읽기 (청크 단위 처리 지원) - 최적화된 버전
export const readSheetDataDynamic = async (spreadsheetId: string, sheetName: string) => {
  try {
    console.log(`📊 readSheetDataDynamic 시작: ${sheetName}`)
    
    // 간단한 방법으로 데이터 읽기 (A:Z 범위 사용)
    console.log(`📊 간단한 방법으로 데이터 읽기: ${sheetName}!A:Z`)
    
    // 타임아웃 설정 (30초로 단축)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('readSheetDataDynamic timeout after 30 seconds')), 30000)
    })
    
    const dataPromise = readGoogleSheet(spreadsheetId, `${sheetName}!A:Z`)
    const data = await Promise.race([dataPromise, timeoutPromise])
    
    console.log(`✅ ${sheetName} 데이터 읽기 완료: ${data.length}개 행`)
    return data
  } catch (error) {
    console.error('Error reading sheet data dynamically:', error)
    
    // 중단 오류인 경우 간단한 폴백 재시도
    if (error instanceof Error && error.message.includes('aborted')) {
      console.log(`🔄 API 중단 오류 감지 - 폴백 재시도 중...`)
      
      try {
        await sleep(2000)
        console.log(`🔄 폴백: 500행 청크로 재시도`)
        const actualColumnCount = await getQuickColumnCount(spreadsheetId, sheetName)
        const columnRange = getColumnRange(actualColumnCount)
        const retryRange = `${sheetName}!A:${columnRange}`
        const retryData = await readGoogleSheet(spreadsheetId, retryRange, 500)
        console.log(`✅ 폴백 재시도 성공: ${retryData.length}개 행`)
        return retryData
      } catch (retryError) {
        console.error('폴백 재시도 실패:', retryError)
      }
    }
    
    // 폴백: 기본 범위로 읽기
    console.log(`🔄 최종 폴백: 기본 범위로 읽기 시도`)
    try {
      const fallbackData = await readSheetData(spreadsheetId, sheetName)
      console.log(`✅ 폴백 성공: ${fallbackData.length}개 행`)
      console.log(`📄 폴백 첫 번째 행 키:`, fallbackData.length > 0 ? Object.keys(fallbackData[0]) : 'No data')
      return fallbackData
    } catch (fallbackError) {
      console.error(`❌ 최종 폴백도 실패:`, fallbackError)
      
      // 최후의 수단: 매우 간단한 범위로 읽기
      console.log(`🔄 최후의 수단: A:Z 범위로 읽기`)
      try {
        const simpleData = await readGoogleSheet(spreadsheetId, `${sheetName}!A:Z`)
        console.log(`✅ 최후의 수단 성공: ${simpleData.length}개 행`)
        return simpleData
      } catch (finalError) {
        console.error(`❌ 모든 방법 실패:`, finalError)
        throw finalError
      }
    }
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

// 시트의 샘플 데이터 가져오기 (최적화된 버전)
export const getSheetSampleData = async (spreadsheetId: string, sheetName: string, maxRows: number = 5) => {
  try {
    // 캐시 확인
    const cacheKey = `sampleData_${spreadsheetId}_${sheetName}`
    const cached = sheetInfoCache.get(cacheKey)
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      return cached.data
    }

    console.log(`📊 Reading sheet: ${sheetName}`)
    
    // 실제 사용된 컬럼 수를 빠르게 파악
    const actualColumnCount = await getQuickColumnCount(spreadsheetId, sheetName)
    const columnRange = getColumnRange(actualColumnCount)
    
    // 첫 번째 행만 읽어서 헤더 정보 가져오기
    const headerRange = `${sheetName}!A1:${columnRange}1`
    console.log(`🎯 Reading headers: ${headerRange}`)
    
    const headerData = await readGoogleSheet(spreadsheetId, headerRange)
    
    if (headerData.length === 0) {
      console.log(`❌ No headers found in ${sheetName}`)
      return { columns: [], sampleData: [] }
    }
    
    // 헤더 추출
    const columns = Object.keys(headerData[0]).filter(col => col && col.trim() !== '')
    
    // 샘플 데이터가 필요한 경우에만 추가로 읽기
    let sampleData: Record<string, unknown>[] = []
    if (maxRows > 0) {
      const sampleRange = `${sheetName}!A1:${columnRange}${Math.min(maxRows + 1, 6)}` // 헤더 포함 최대 6행
      console.log(`🎯 Reading sample data: ${sampleRange}`)
      
      const fullSampleData = await readGoogleSheet(spreadsheetId, sampleRange)
      sampleData = fullSampleData.slice(1) // 헤더 제외
    }
    
    console.log(`✅ Found ${columns.length} columns in ${sheetName}:`, columns)
    console.log(`📄 Sample data rows:`, sampleData.length)
    
    const result = { columns, sampleData }
    
    // 캐시에 저장
    sheetInfoCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    })
    
    return result
  } catch (error) {
    console.error(`❌ Error reading ${sheetName}:`, error)
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

// 캐시 통계 조회 함수
export const getCacheStats = () => {
  const now = Date.now()
  const entries = Array.from(sheetInfoCache.entries())
  const validEntries = entries.filter(([, value]) => (now - value.timestamp) < CACHE_DURATION)
  
  return {
    totalEntries: entries.length,
    validEntries: validEntries.length,
    expiredEntries: entries.length - validEntries.length,
    cacheHitRate: validEntries.length / Math.max(entries.length, 1),
    memoryUsage: JSON.stringify(entries).length
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
  clearSheetCache,
  getCacheStats
}
