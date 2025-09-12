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
  const range = `${sheetName}!A:Z` // A부터 Z열까지 읽기
  return await readGoogleSheet(spreadsheetId, range)
}

// 구글 시트에서 특정 범위의 데이터 읽기
export const readSheetRange = async (spreadsheetId: string, sheetName: string, startRow: number, endRow: number) => {
  const range = `${sheetName}!A${startRow}:Z${endRow}`
  return await readGoogleSheet(spreadsheetId, range)
}

// 구글 시트의 시트 목록 가져오기
export const getSheetNames = async (spreadsheetId: string) => {
  try {
    const auth = getAuthClient()
    const sheets = google.sheets({ version: 'v4', auth })

    const response = await sheets.spreadsheets.get({
      spreadsheetId,
    })

    const sheetNames = response.data.sheets?.map(sheet => sheet.properties?.title) || []
    return sheetNames
  } catch (error) {
    console.error('Error getting sheet names:', error)
    throw error
  }
}
