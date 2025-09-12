import { NextRequest, NextResponse } from 'next/server'
import { syncReservations, syncTours } from '@/lib/syncService'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { spreadsheetId, reservationsSheet, toursSheet } = body

    if (!spreadsheetId) {
      return NextResponse.json(
        { success: false, message: 'Spreadsheet ID is required' },
        { status: 400 }
      )
    }

    console.log('Testing sync with spreadsheet:', spreadsheetId)
    
    // 예약 데이터 동기화 테스트
    const reservationResult = await syncReservations(
      spreadsheetId, 
      reservationsSheet || 'Reservations'
    )
    
    // 투어 데이터 동기화 테스트
    const tourResult = await syncTours(
      spreadsheetId, 
      toursSheet || 'Tours'
    )

    return NextResponse.json({
      success: true,
      message: 'Test sync completed',
      data: {
        reservations: reservationResult,
        tours: tourResult
      }
    })

  } catch (error) {
    console.error('Test sync error:', error)
    return NextResponse.json(
      { success: false, message: `Test sync failed: ${error}` },
      { status: 500 }
    )
  }
}
