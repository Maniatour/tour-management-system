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

// 시트 읽기: 행당 페이로드가 커서 한 번에 너무 많이 읽으면 타임아웃·실패가 잦음 → 500행 고정
const DEFAULT_CHUNK_SIZE = 500
const MAX_RETRIES = 1  // 재시도 횟수 축소 (3 → 1)
const BASE_DELAY = 500 // 재시도 대기 시간 축소 (1000ms → 500ms)
const MAX_DELAY = 3000 // 최대 대기 시간 축소 (10000ms → 3000ms)
const API_TIMEOUT = 15000 // API 타임아웃 (15초)

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

// Google API 에러를 사용자 친화적인 메시지로 변환
const formatGoogleApiError = (error: unknown, spreadsheetId: string, sheetName?: string): Error => {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = error.code as number
    const message = ('message' in error && typeof error.message === 'string') ? error.message : 'Unknown error'
    
    if (code === 404) {
      const serviceAccountEmail = process.env.GOOGLE_CLIENT_EMAIL
      return new Error(
        `스프레드시트를 찾을 수 없습니다 (404). ` +
        `가능한 원인:\n` +
        `1. 스프레드시트 ID가 잘못되었습니다: ${spreadsheetId}\n` +
        `2. 서비스 계정(${serviceAccountEmail})에 스프레드시트 접근 권한이 없습니다.\n` +
        `   → Google Sheets에서 "공유" 버튼을 클릭하고 서비스 계정 이메일을 추가해주세요.\n` +
        `3. 시트 이름이 잘못되었습니다${sheetName ? `: ${sheetName}` : ''}\n` +
        `4. 스프레드시트가 삭제되었거나 이동되었습니다.`
      )
    } else if (code === 403) {
      return new Error(
        `스프레드시트 접근 권한이 없습니다 (403). ` +
        `서비스 계정(${process.env.GOOGLE_CLIENT_EMAIL})에 스프레드시트 읽기 권한을 부여해주세요.`
      )
    } else if (code === 400) {
      return new Error(`잘못된 요청입니다 (400): ${message}`)
    }
  }
  
  return error instanceof Error ? error : new Error(String(error))
}

// 지수 백오프 재시도 함수
const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  baseDelay: number = BASE_DELAY,
  maxDelay: number = MAX_DELAY,
  context?: { spreadsheetId?: string; sheetName?: string }
): Promise<T> => {
  let lastError: Error
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      // Google API 에러인 경우 상세 정보 추출
      let apiError: unknown = error
      if (error && typeof error === 'object' && 'response' in error) {
        apiError = (error as { response: unknown }).response
      } else if (error && typeof error === 'object' && 'code' in error) {
        apiError = error
      }
      
      lastError = formatGoogleApiError(apiError, context?.spreadsheetId || 'unknown', context?.sheetName)
      
      // 마지막 시도인 경우 에러 던지기
      if (attempt === maxRetries) {
        throw lastError
      }
      
      // 404, 403 같은 권한/리소스 오류는 재시도하지 않음
      if (apiError && typeof apiError === 'object' && 'code' in apiError) {
        const code = apiError.code as number
        if (code === 404 || code === 403 || code === 400) {
          throw lastError
        }
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
        throw lastError
      }
    }
  }
  
  throw lastError!
}

/** 행 배열을 헤더 기준 객체 배열로 변환 */
const rowsToObjects = (headers: string[], rows: string[][]): Record<string, unknown>[] =>
  rows.map((row) => {
    const obj: Record<string, unknown> = {}
    headers.forEach((header, idx) => {
      obj[header] = row[idx] ?? ''
    })
    return obj
  })

/**
 * Google Sheets 범위를 행 단위로 순차 읽기.
 * - 병렬·짧은 race 타임아웃 제거 → API 할당/서버 타임아웃 완화
 * - 실패 시 재시도 후에도 실패하면 throw (데이터 누락 없음)
 */
const readGoogleSheetInChunks = async (
  spreadsheetId: string,
  range: string,
  chunkSize: number,
  sheets: GoogleSheetsClient
) => {
  const rangeMatch = range.match(/^(.+)!([A-Z]+):([A-Z]+)$/)
  if (!rangeMatch) {
    throw new Error(`Invalid range format: ${range}`)
  }

  const [, sheetName, startCol, endCol] = rangeMatch
  const optimizedEndCol = endCol === 'ZZ' ? 'AZ' : endCol

  let totalRows = 10000
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId, includeGridData: false })
    const sheet = meta.data.sheets?.find((s) => s.properties?.title === sheetName)
    totalRows = sheet?.properties?.gridProperties?.rowCount ?? 10000
  } catch (infoError) {
    console.warn(
      `시트 메타 조회 실패, 그리드 기본 행 수 사용:`,
      infoError instanceof Error ? infoError.message : infoError
    )
  }

  const rowChunk = Math.max(100, Math.min(chunkSize, 500))
  const firstChunkEnd = Math.min(rowChunk, Math.max(1, totalRows))
  const firstRange = `${sheetName}!${startCol}1:${optimizedEndCol}${firstChunkEnd}`

  const fetchRange = async (r: string, label: string): Promise<GoogleSheetsResponse> => {
    let last: unknown
    const maxAttempts = 4
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: r,
          valueRenderOption: 'UNFORMATTED_VALUE',
          dateTimeRenderOption: 'FORMATTED_STRING',
        })
      } catch (e) {
        last = e
        const msg = e instanceof Error ? e.message : String(e)
        const retryable =
          /aborted|ECONNRESET|ETIMEDOUT|timeout|429|Quota|EAI_|socket/i.test(msg) ||
          (e && typeof e === 'object' && 'code' in e && [429, 500, 503].includes(Number((e as { code: number }).code)))
        if (!retryable || attempt === maxAttempts) {
          throw new Error(`${label} 읽기 실패 (${attempt}/${maxAttempts}): ${msg}`)
        }
        const delay = Math.min(500 * 2 ** (attempt - 1), 8000)
        console.warn(`${label} 재시도 ${attempt + 1}/${maxAttempts} — ${delay}ms 후`)
        await sleep(delay)
      }
    }
    throw last
  }

  const firstRes = await fetchRange(firstRange, `첫 구간 ${firstRange}`)
  if (!firstRes.data.values?.length) {
    return []
  }

  const headers = firstRes.data.values[0]
  const firstBody = firstRes.data.values.slice(1)
  const allData: Record<string, unknown>[] = rowsToObjects(headers, firstBody)
  console.log(`시트 ${sheetName}: 헤더 ${headers.length}열, 첫 블록 ${firstBody.length}행`)

  let startRow = firstChunkEnd + 1
  let chunkIndex = 2
  while (startRow <= totalRows) {
    const endRow = Math.min(startRow + rowChunk - 1, totalRows)
    const chunkRange = `${sheetName}!${startCol}${startRow}:${optimizedEndCol}${endRow}`
    const res = await fetchRange(chunkRange, `청크 ${chunkIndex} (${startRow}-${endRow})`)
    const values = res.data.values
    // API는 범위 끝의 빈 행을 생략해 values.length < rowChunk 인 경우가 많음.
    // 이때 break 하면 그 아래 행을 영원히 읽지 못함(고객 시트 등 상단 공백·데이터 하단 배치 시 치명적).
    if (values?.length) {
      allData.push(...rowsToObjects(headers, values))
    }
    startRow = endRow + 1
    chunkIndex += 1
    await sleep(50)
  }

  console.log(`청크 순차 읽기 완료: 총 ${allData.length}행`)
  return allData
}

// 구글 시트에서 데이터 읽기 (청크 단위 처리 지원)
export const readGoogleSheet = async (spreadsheetId: string, range: string, chunkSize?: number) => {
  try {
    const auth = getAuthClient()
    const sheets = google.sheets({ 
      version: 'v4', 
      auth,
      timeout: 120000, // 120초로 증가 (대용량 시트 및 느린 네트워크 지원)
    })

    // 청크 단위 처리 여부 확인
    if (chunkSize && range.includes(':')) {
      return await readGoogleSheetInChunks(spreadsheetId, range, chunkSize, sheets as unknown as GoogleSheetsClient)
    }

    // 범위에서 시트 이름 추출
    const sheetNameMatch = range.match(/^(.+)!/)
    const sheetName = sheetNameMatch ? sheetNameMatch[1] : undefined
    
    const response = await retryWithBackoff(async () => {
      return await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'FORMATTED_STRING'
      })
    }, 3, 2000, 8000, sheetName ? { spreadsheetId, sheetName } : { spreadsheetId })

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
        obj[header] = row[index] ?? ''
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
    
    // 최적화된 컬럼 범위 사용 (AZ = 52개 컬럼, 대부분의 시트에 충분)
    const range = `${sheetName}!A:AZ`
    
    return await readGoogleSheet(spreadsheetId, range, DEFAULT_CHUNK_SIZE)
  } catch (error) {
    console.error('readSheetData error:', error)
    
    // 중단 오류인 경우 폴백 재시도 (더 작은 청크, 1회만)
    if (error instanceof Error && (
      error.message.includes('aborted') ||
      error.message.includes('timeout') ||
      error.message.includes('ECONNRESET') ||
      error.message.includes('ETIMEDOUT')
    )) {
      console.log(`🔄 readSheetData: 폴백 재시도 (300행 청크)`)
      
      try {
        await sleep(1000) // 1초 대기
        return await readGoogleSheet(spreadsheetId, `${sheetName}!A:AZ`, 300)
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
    // 캐시 확인 (우선순위 높음)
    const cacheKey = `sheetNames_${spreadsheetId}`
    const cached = sheetInfoCache.get(cacheKey)
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      return cached.data as SheetInfo[]
    }
    
    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      throw new Error('Google Sheets API credentials not configured. Please check environment variables.')
    }

    const auth = getAuthClient()
    const sheets = google.sheets({ 
      version: 'v4', 
      auth,
      timeout: 20000 // 20초로 축소 (빠른 응답 우선)
    })

    // 타임아웃 설정 (20초로 축소)
    let timeoutId: NodeJS.Timeout | null = null
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('Google Sheets API timeout after 20 seconds'))
      }, 20000)
    })

    const fetchPromise = sheets.spreadsheets.get({
      spreadsheetId,
    })

    try {
      const response = await Promise.race([fetchPromise, timeoutPromise]) as GoogleSheetsResponse
      // 성공 시 타임아웃 타이머 정리
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      
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
    } catch (raceError) {
      // 타임아웃 타이머 정리
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      // 타임아웃 에러인 경우 명시적으로 처리
      if (raceError instanceof Error && raceError.message.includes('timeout')) {
        throw new Error('Google Sheets API timeout after 20 seconds')
      }
      throw raceError
    }
  } catch (error) {
    console.error('Error getting sheet names:', error)
    
    // 에러 객체의 전체 구조 로깅 (디버깅용)
    if (error && typeof error === 'object') {
      console.error('Error object structure:', {
        name: 'name' in error ? error.name : undefined,
        message: 'message' in error ? error.message : undefined,
        code: 'code' in error ? error.code : undefined,
        status: 'status' in error ? error.status : undefined,
        response: 'response' in error ? {
          status: error.response && typeof error.response === 'object' && 'status' in error.response ? error.response.status : undefined,
          statusText: error.response && typeof error.response === 'object' && 'statusText' in error.response ? error.response.statusText : undefined,
          data: error.response && typeof error.response === 'object' && 'data' in error.response ? error.response.data : undefined
        } : undefined
      })
    }
    
    // Google API 에러 구조 파싱
    let statusCode: number | null = null
    let errorCode: number | null = null
    let errorMessage = error instanceof Error ? error.message : String(error)
    
    // Google API 에러는 보통 error.response.status 또는 error.code를 가짐
    if (error && typeof error === 'object') {
      // error.response.status 체크
      if ('response' in error && error.response && typeof error.response === 'object') {
        const response = error.response as { status?: number; statusText?: string; data?: unknown }
        statusCode = response.status || null
        if (response.data && typeof response.data === 'object' && 'error' in response.data) {
          const apiError = (response.data as { error?: { message?: string; code?: number } }).error
          if (apiError) {
            errorMessage = apiError.message || errorMessage
            errorCode = apiError.code || null
          }
        }
      }
      // error.code 체크
      if ('code' in error && typeof error.code === 'number') {
        errorCode = error.code
      }
      // error.status 체크 (일부 경우)
      if ('status' in error && typeof error.status === 'number') {
        statusCode = error.status
      }
    }
    
    // HTTP 상태 코드가 있으면 우선 사용
    const finalStatusCode = statusCode || errorCode
    
    // TimeoutError 또는 타임아웃 관련 에러 체크
    const isTimeoutError = error instanceof Error && (
      error.name === 'TimeoutError' ||
      error.message.includes('timeout') ||
      error.message.includes('TIMEOUT_ERR') ||
      finalStatusCode === 408 ||
      (error && typeof error === 'object' && 'code' in error && (error as { code: unknown }).code === 23)
    )
    
    // 재시도 로직 (최대 1번으로 축소) - 404, 403, 400은 재시도하지 않음
    if (retryCount < 1 && error instanceof Error && !finalStatusCode && (
      isTimeoutError ||
      error.message.includes('ECONNRESET') ||
      error.message.includes('ETIMEDOUT')
    )) {
      console.log(`Retrying getSheetNames (attempt ${retryCount + 1}/1)...`)
      await sleep(1000) // 1초 대기 후 재시도
      return getSheetNames(spreadsheetId, retryCount + 1)
    }
    
    // 구체적인 에러 메시지 제공
    const lowerErrorMessage = errorMessage.toLowerCase()
    
    if (finalStatusCode === 404 || lowerErrorMessage.includes('404') || lowerErrorMessage.includes('not found')) {
      const serviceAccountEmail = process.env.GOOGLE_CLIENT_EMAIL || '서비스 계정 이메일'
      throw new Error(
        `구글 시트를 찾을 수 없습니다 (404).\n\n` +
        `가능한 원인:\n` +
        `1. 스프레드시트 ID가 잘못되었습니다: ${spreadsheetId}\n` +
        `2. 서비스 계정(${serviceAccountEmail})에 스프레드시트 접근 권한이 없습니다.\n` +
        `   → Google Sheets에서 "공유" 버튼을 클릭하고 서비스 계정 이메일을 추가해주세요.\n` +
        `3. 스프레드시트가 삭제되었거나 이동되었습니다.`
      )
    } else if (finalStatusCode === 403 || lowerErrorMessage.includes('403') || lowerErrorMessage.includes('permission') || lowerErrorMessage.includes('caller does not have permission')) {
      const serviceAccountEmail = process.env.GOOGLE_CLIENT_EMAIL || '서비스 계정 이메일'
      throw new Error(
        `구글 시트 접근 권한이 없습니다 (403).\n\n` +
        `다음 사항을 확인해주세요:\n` +
        `1. Google Cloud Console에서 "Google Sheets API"가 활성화되어 있는지 확인\n` +
        `2. 구글 시트에 서비스 계정 이메일(${serviceAccountEmail})을 공유했는지 확인\n` +
        `3. 서비스 계정 권한이 "편집자" 또는 "뷰어"로 설정되어 있는지 확인`
      )
    } else if (finalStatusCode === 400 || lowerErrorMessage.includes('400')) {
      throw new Error(`잘못된 요청입니다 (400): ${errorMessage}`)
    } else if (isTimeoutError || lowerErrorMessage.includes('timeout')) {
      throw new Error('구글 시트 API 응답 시간 초과 (20초). 네트워크 연결을 확인하고 다시 시도해주세요.')
    } else if (lowerErrorMessage.includes('credentials') || lowerErrorMessage.includes('authentication')) {
      throw new Error('구글 시트 API 인증 정보가 설정되지 않았습니다. .env.local 파일의 환경 변수를 확인해주세요.')
    } else if (lowerErrorMessage.includes('quota') || lowerErrorMessage.includes('quota exceeded')) {
      throw new Error('Google Sheets API 할당량을 초과했습니다. 1-2분 후에 다시 시도해주세요.')
    } else if (lowerErrorMessage.includes('api not enabled')) {
      throw new Error(
        'Google Sheets API가 활성화되지 않았습니다.\n\n' +
        'Google Cloud Console에서 다음을 확인해주세요:\n' +
        '1. 프로젝트 선택\n' +
        '2. "API 및 서비스" > "라이브러리"로 이동\n' +
        '3. "Google Sheets API" 검색 및 활성화'
      )
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
    const response = await retryWithBackoff(async () => {
      return await sheets.spreadsheets.get({
        spreadsheetId,
        includeGridData: false
      })
    }, 3, 2000, 8000, { spreadsheetId, sheetName })

    const sheet = response.data.sheets?.find(s => s.properties?.title === sheetName)
    
    if (!sheet) {
      throw new Error(`시트 "${sheetName}"을(를) 찾을 수 없습니다. 스프레드시트에 해당 시트가 존재하는지 확인해주세요.`)
    }
    
    if (sheet?.properties?.gridProperties) {
      const gridProperties = sheet.properties.gridProperties
      
      // 기본값: 시트의 전체 크기
      const rowCount = gridProperties.rowCount || 1000
      let columnCount = gridProperties.columnCount || 26
      
      // 실제 사용된 범위가 있는 경우 더 정확한 값 사용
      if (sheet.properties.sheetType === 'GRID' && sheet.properties.gridProperties) {
        // 시트의 실제 데이터 범위를 확인하기 위해 첫 번째 행 읽기 시도
        try {
          const firstRowResponse = await retryWithBackoff(async () => {
            return await sheets.spreadsheets.values.get({
              spreadsheetId,
              range: `${sheetName}!1:1`,
              valueRenderOption: 'UNFORMATTED_VALUE'
            })
          }, 2, 1500, 6000, { spreadsheetId, sheetName })
          
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

// 빠른 컬럼 수 파악 함수 (캐시 우선, 빠른 실패)
const getQuickColumnCount = async (spreadsheetId: string, sheetName: string): Promise<number> => {
  const cacheKey = `columnCount_${spreadsheetId}_${sheetName}`
  const cached = sheetInfoCache.get(cacheKey)
  
  // 캐시가 있으면 즉시 반환 (API 호출 완전 스킵)
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    return cached.data as number
  }
  
  // 캐시가 없어도 기본값 26을 먼저 캐시에 저장하고 반환
  // API 호출은 백그라운드에서 시도하거나 건너뜀
  // 이렇게 하면 첫 번째 호출도 즉시 반환됨
  const defaultColumnCount = 26
  
  // 캐시에 기본값 저장 (동기화 시작 시 지연 방지)
  sheetInfoCache.set(cacheKey, {
    data: defaultColumnCount,
    timestamp: Date.now()
  })
  
  // 동기화 성능을 위해 API 호출 건너뜀 - 기본값 26개면 대부분의 시트에 충분
  // 실제 컬럼 수 파악은 readGoogleSheetInChunks에서 자동으로 처리됨
  return defaultColumnCount
}

// 동적으로 시트의 실제 사용된 범위로 데이터 읽기 (청크 단위 처리 지원) - 최적화된 버전
export const readSheetDataDynamic = async (spreadsheetId: string, sheetName: string) => {
  try {
    console.log(`📊 readSheetDataDynamic 시작: ${sheetName}`)
    
    // 청크 단위 읽기로 대용량 데이터 처리 (최적화된 컬럼 범위)
    const data = await readGoogleSheet(spreadsheetId, `${sheetName}!A:AZ`, DEFAULT_CHUNK_SIZE)
    
    console.log(`✅ ${sheetName} 데이터 읽기 완료: ${data.length}개 행`)
    return data
  } catch (error) {
    console.error('Error reading sheet data dynamically:', error)
    
    // 타임아웃 또는 중단 오류인 경우 폴백 재시도
    if (error instanceof Error && (
      error.message.includes('aborted') || 
      error.message.includes('timeout') ||
      error.message.includes('ECONNRESET') ||
      error.message.includes('ETIMEDOUT')
    )) {
      console.log(`🔄 폴백: 작은 청크(300)로 재시도`)
      
      try {
        await sleep(2000) // 2초 대기 후 재시도
        const retryData = await readGoogleSheet(spreadsheetId, `${sheetName}!A:AZ`, 300)
        console.log(`✅ 폴백 성공: ${retryData.length}개 행`)
        return retryData
      } catch (retryError) {
        console.error('폴백 재시도 실패:', retryError)
        throw retryError
      }
    }
    
    throw error
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

// 시트의 샘플 데이터 가져오기 (최적화된 버전 - 단일 API 호출)
export const getSheetSampleData = async (spreadsheetId: string, sheetName: string, maxRows: number = 5) => {
  try {
    // 캐시 확인 (우선순위 높음)
    const cacheKey = `sampleData_${spreadsheetId}_${sheetName}`
    const cached = sheetInfoCache.get(cacheKey)
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      return cached.data
    }

    console.log(`📊 Reading sheet sample: ${sheetName}`)
    
    const auth = getAuthClient()
    const sheets = google.sheets({
      version: 'v4',
      auth,
      timeout: 30000
    })
    
    let timeoutId: NodeJS.Timeout | null = null
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Sample data timeout after 20 seconds')), 20000)
    })
    
    // 1) 헤더: 첫 번째 행 전체(1:1)로 읽어 시트에 있는 모든 컬럼을 가져옴 (컬럼 매핑 선택지에 전부 표시)
    const headerPromise = sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!1:1`,
      valueRenderOption: 'UNFORMATTED_VALUE'
    })
    let response: { data: { values?: string[][] } }
    try {
      response = await Promise.race([headerPromise, timeoutPromise]) as { data: { values?: string[][] } }
      if (timeoutId) clearTimeout(timeoutId)
    } catch (raceError) {
      if (timeoutId) clearTimeout(timeoutId)
      throw raceError
    }
    
    if (!response.data.values || response.data.values.length === 0) {
      console.log(`❌ No data found in ${sheetName}`)
      return { columns: [], sampleData: [] }
    }
    
    const headerRow = response.data.values[0]
    const columns = headerRow.filter(col => col != null && col.toString().trim() !== '')
    const columnCount = headerRow.length
    const lastCol = getColumnRange(columnCount)
    
    // 2) 샘플 행: 헤더 기준 범위로 최대 5행 추가 조회
    const sampleRows = Math.min(maxRows, 5)
    if (sampleRows > 0 && columnCount > 0) {
      const sampleRange = `${sheetName}!A2:${lastCol}${1 + sampleRows}`
      timeoutId = null
      const samplePromise = sheets.spreadsheets.values.get({
        spreadsheetId,
        range: sampleRange,
        valueRenderOption: 'UNFORMATTED_VALUE'
      })
      const sampleTimeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Sample rows timeout')), 15000)
      })
      let sampleResponse: { data: { values?: string[][] } } | null = null
      try {
        sampleResponse = await Promise.race([samplePromise, sampleTimeoutPromise]) as { data: { values?: string[][] } }
        if (timeoutId) clearTimeout(timeoutId)
      } catch {
        if (timeoutId) clearTimeout(timeoutId)
      }
      if (sampleResponse?.data?.values && sampleResponse.data.values.length > 0) {
        const sampleDataRows = sampleResponse.data.values
        const sampleData: Record<string, unknown>[] = sampleDataRows.map((row: string[]) => {
          const obj: Record<string, unknown> = {}
          headerRow.forEach((header, index) => {
            if (header != null && header.toString().trim() !== '') {
              obj[header] = row[index] ?? ''
            }
          })
          return obj
        })
        const result = { columns, sampleData }
        sheetInfoCache.set(cacheKey, { data: result, timestamp: Date.now() })
        console.log(`✅ Found ${columns.length} columns in ${sheetName}`)
        return result
      }
    }
    
    const sampleData: Record<string, unknown>[] = []
    
    console.log(`✅ Found ${columns.length} columns in ${sheetName}`)
    
    const result = { columns, sampleData }
    
    // 캐시에 저장
    sheetInfoCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    })
    
    return result
  } catch (error) {
    console.warn(`⚠️ Sample data fetch failed for ${sheetName}:`, error instanceof Error ? error.message : error)
    // 실패 시 빈 결과 반환 (캐시에 저장하지 않음 - 다음 시도에서 재시도)
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
