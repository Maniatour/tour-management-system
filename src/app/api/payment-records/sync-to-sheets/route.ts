import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { googleSheets } from '@/lib/googleSheets'

// 입금 내역을 구글 시트에 동기화
export async function POST(request: NextRequest) {
  try {
    // Authorization 헤더에서 토큰 확인
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    
    // 토큰으로 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const { paymentRecordId, sheetId, sheetName = 'Payment Records' } = body

    if (!paymentRecordId || !sheetId) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다' }, { status: 400 })
    }

    // 입금 내역 조회
    const { data: paymentRecord, error: paymentError } = await supabase
      .from('payment_records')
      .select(`
        *,
        reservation:reservations(
          id,
          customer_id,
          customer:customers(
            name,
            email
          )
        )
      `)
      .eq('id', paymentRecordId)
      .single()

    if (paymentError || !paymentRecord) {
      return NextResponse.json({ error: '입금 내역을 찾을 수 없습니다' }, { status: 404 })
    }

    // 구글 시트에 데이터 추가
    const rowData = [
      paymentRecord.id,
      paymentRecord.reservation_id,
      paymentRecord.payment_status,
      paymentRecord.amount,
      paymentRecord.payment_method,
      paymentRecord.note || '',
      paymentRecord.image_file_url || '',
      paymentRecord.submit_on,
      paymentRecord.submit_by,
      paymentRecord.confirmed_on || '',
      paymentRecord.confirmed_by || '',
      paymentRecord.amount_krw || ''
    ]

    try {
      await googleSheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `${sheetName}!A:L`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [rowData]
        }
      })

      return NextResponse.json({ 
        success: true, 
        message: '구글 시트에 성공적으로 동기화되었습니다.' 
      })
    } catch (sheetsError) {
      console.error('구글 시트 동기화 오류:', sheetsError)
      return NextResponse.json({ 
        error: '구글 시트 동기화 중 오류가 발생했습니다.' 
      }, { status: 500 })
    }
  } catch (error) {
    console.error('입금 내역 동기화 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

// 모든 입금 내역을 구글 시트에 일괄 동기화
export async function PUT(request: NextRequest) {
  try {
    // Authorization 헤더에서 토큰 확인
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    
    // 토큰으로 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const { sheetId, sheetName = 'Payment Records', clearSheet = false } = body

    if (!sheetId) {
      return NextResponse.json({ error: '구글 시트 ID가 필요합니다' }, { status: 400 })
    }

    // 모든 입금 내역 조회
    const { data: paymentRecords, error: paymentError } = await supabase
      .from('payment_records')
      .select(`
        *,
        reservation:reservations(
          id,
          customer_id,
          customer:customers(
            name,
            email
          )
        )
      `)
      .order('created_at', { ascending: false })

    if (paymentError) {
      return NextResponse.json({ error: '입금 내역을 불러올 수 없습니다' }, { status: 500 })
    }

    // 헤더 행
    const headerRow = [
      'ID',
      'Reservation ID', 
      'Payment Status',
      'Amount',
      'Payment Method',
      'Note',
      'Image/File',
      'Submit on',
      'Submit by',
      'Confirmed on',
      'Confirmed by',
      'Amount (KRW)'
    ]

    // 데이터 행들
    const dataRows = paymentRecords?.map(record => [
      record.id,
      record.reservation_id,
      record.payment_status,
      record.amount,
      record.payment_method,
      record.note || '',
      record.image_file_url || '',
      record.submit_on,
      record.submit_by,
      record.confirmed_on || '',
      record.confirmed_by || '',
      record.amount_krw || ''
    ]) || []

    try {
      // 시트 초기화 (선택사항)
      if (clearSheet) {
        await googleSheets.spreadsheets.values.clear({
          spreadsheetId: sheetId,
          range: `${sheetName}!A:L`
        })
      }

      // 헤더와 데이터를 함께 업데이트
      const allRows = [headerRow, ...dataRows]
      
      await googleSheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${sheetName}!A:L`,
        valueInputOption: 'RAW',
        requestBody: {
          values: allRows
        }
      })

      return NextResponse.json({ 
        success: true, 
        message: `${paymentRecords?.length || 0}개의 입금 내역이 구글 시트에 동기화되었습니다.`,
        count: paymentRecords?.length || 0
      })
    } catch (sheetsError) {
      console.error('구글 시트 일괄 동기화 오류:', sheetsError)
      return NextResponse.json({ 
        error: '구글 시트 동기화 중 오류가 발생했습니다.' 
      }, { status: 500 })
    }
  } catch (error) {
    console.error('입금 내역 일괄 동기화 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
