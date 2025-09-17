import { google } from 'googleapis'
import { JWT } from 'google-auth-library'

// 구글 시트 API 설정
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']

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

// 구글 시트에서 데이터 읽기
export const readGoogleSheet = async (spreadsheetId: string, range: string) => {
  try {
    const auth = getAuthClient()
    const sheets = google.sheets({ version: 'v4', auth })

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    })

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

    return data
  } catch (error) {
    console.error('Error reading Google Sheet:', error)
    throw error
  }
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

// 구글 시트의 시트 목록 가져오기 (첫 글자가 'S'인 시트만 필터링)
export const getSheetNames = async (spreadsheetId: string) => {
  try {
    const auth = getAuthClient()
    const sheets = google.sheets({ version: 'v4', auth })

    const response = await sheets.spreadsheets.get({
      spreadsheetId,
    })

    const allSheetNames = response.data.sheets?.map(sheet => sheet.properties?.title) || []
    
    // 첫 글자가 'S'인 시트만 필터링 (대소문자 구분 없음)
    const filteredSheetNames = allSheetNames.filter(sheetName => 
      sheetName && sheetName.charAt(0).toUpperCase() === 'S'
    )
    
    console.log(`Total sheets: ${allSheetNames.length}, Filtered sheets (starting with 'S'): ${filteredSheetNames.length}`)
    console.log('Filtered sheet names:', filteredSheetNames)
    
    return filteredSheetNames
  } catch (error) {
    console.error('Error getting sheet names:', error)
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
      ranges: [`${sheetName}!A1:ZZ1000`], // 충분히 큰 범위로 요청
      includeGridData: false
    })

    const sheet = response.data.sheets?.[0]
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
    
    return await readGoogleSheet(spreadsheetId, range)
  } catch (error) {
    console.error('Error reading sheet data dynamically:', error)
    // 폴백: 기본 범위로 읽기
    return await readSheetData(spreadsheetId, sheetName)
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
