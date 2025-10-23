import { NextRequest, NextResponse } from 'next/server'
import { paymentMethodsSyncService } from '@/lib/paymentMethodsSyncService'

// POST: 구글 시트에서 결제 방법 데이터 동기화
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { spreadsheetId, sheetName } = body

    if (!spreadsheetId || !sheetName) {
      return NextResponse.json(
        { success: false, message: 'Spreadsheet ID와 Sheet Name이 필요합니다.' },
        { status: 400 }
      )
    }

    console.log(`결제 방법 동기화 시작: ${spreadsheetId}/${sheetName}`)

    const result = await paymentMethodsSyncService.syncFromGoogleSheet(
      spreadsheetId,
      sheetName,
      (event) => {
        console.log(`동기화 진행: ${event.type} - ${event.message}`)
        if (event.processed && event.total) {
          console.log(`진행률: ${event.processed}/${event.total} (${Math.round((event.processed / event.total) * 100)}%)`)
        }
      }
    )

    return NextResponse.json(result)

  } catch (error) {
    console.error('결제 방법 동기화 API 오류:', error)
    return NextResponse.json(
      { success: false, message: `결제 방법 동기화 API 오류: ${error}` },
      { status: 500 }
    )
  }
}

// GET: 결제 방법 동기화 통계 조회
export async function GET() {
  try {
    const stats = await paymentMethodsSyncService.getSyncStats()
    
    return NextResponse.json({
      success: true,
      data: stats
    })

  } catch (error) {
    console.error('결제 방법 통계 조회 오류:', error)
    return NextResponse.json(
      { success: false, message: `통계 조회 오류: ${error}` },
      { status: 500 }
    )
  }
}
