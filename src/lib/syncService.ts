import { supabase } from './supabase'
import { readSheetData } from './googleSheets'

// 구글 시트의 컬럼명을 데이터베이스 컬럼명으로 매핑
const RESERVATION_COLUMN_MAPPING = {
  '예약번호': 'id',
  '고객명': 'customer_name',
  '이메일': 'customer_email',
  '전화번호': 'customer_phone',
  '성인수': 'adults',
  '아동수': 'child',
  '유아수': 'infant',
  '총인원': 'total_people',
  '투어날짜': 'tour_date',
  '투어시간': 'tour_time',
  '상품ID': 'product_id',
  '투어ID': 'tour_id',
  '픽업호텔': 'pickup_hotel',
  '픽업시간': 'pickup_time',
  '채널': 'channel',
  '채널RN': 'channel_rn',
  '추가자': 'added_by',
  '상태': 'status',
  '특이사항': 'event_note',
  '개인투어': 'is_private_tour',
  '상품명한글': 'name_ko',
  '상품명영어': 'name_en'
}

const TOUR_COLUMN_MAPPING = {
  '투어ID': 'id',
  '상품ID': 'product_id',
  '투어날짜': 'tour_date',
  '투어상태': 'tour_status',
  '가이드이메일': 'tour_guide_id',
  '어시스턴트이메일': 'assistant_id',
  '차량ID': 'tour_car_id',
  '개인투어': 'is_private_tour',
  '상품명한글': 'name_ko',
  '상품명영어': 'name_en',
  '배정현황': 'assignment_status'
}

// 예약 데이터 변환
const transformReservationData = (sheetData: any[]) => {
  return sheetData.map(row => {
    const transformed: any = {}
    
    // 컬럼 매핑 적용
    Object.entries(RESERVATION_COLUMN_MAPPING).forEach(([sheetColumn, dbColumn]) => {
      if (row[sheetColumn] !== undefined && row[sheetColumn] !== '') {
        transformed[dbColumn] = row[sheetColumn]
      }
    })

    // 상품 ID 자동 변환 로직
    if (transformed.product_id) {
      if (transformed.product_id === 'MDGCSUNRISE_X') {
        transformed.product_id = 'MDGCSUNRISE'
        transformed.choice = 'Antelope X Canyon'
      } else if (transformed.product_id === 'MDGC1D_X') {
        transformed.product_id = 'MDGC1D'
        transformed.choice = 'Antelope X Canyon'
      } else if (transformed.product_id === 'MDGCSUNRISE') {
        transformed.choice = 'Lower Antelope Canyon'
      } else if (transformed.product_id === 'MDGC1D') {
        transformed.choice = 'Lower Antelope Canyon'
      }
    }

    // 데이터 타입 변환
    if (transformed.adults) {
      transformed.adults = parseInt(transformed.adults) || 0
    }
    if (transformed.child) {
      transformed.child = parseInt(transformed.child) || 0
    }
    if (transformed.infant) {
      transformed.infant = parseInt(transformed.infant) || 0
    }
    if (transformed.total_people) {
      transformed.total_people = parseInt(transformed.total_people) || 0
    }
    if (transformed.is_private_tour) {
      transformed.is_private_tour = transformed.is_private_tour === 'TRUE' || transformed.is_private_tour === 'true' || transformed.is_private_tour === '1'
    }
    // tour_date는 그대로 저장 (변환하지 않음)

    // status 변환: 구글 시트의 상태 값을 프론트엔드에서 사용하는 값으로 변환
    if (transformed.status) {
      const statusMap: { [key: string]: string } = {
        'Confirmed': 'confirmed',
        'Canceled': 'cancelled',
        'Refunded': 'cancelled',
        'Refund Deleted': 'cancelled',
        'Deposit Received': 'pending',
        'Deleted': 'cancelled',
        'Scenic Received': 'confirmed',
        'Deposit Deleted': 'cancelled',
        'Need to Refund': 'cancelled',
        'Recruiting': 'pending',
        'Pending': 'pending',
        'Payment Requested': 'pending'
      }
      
      // 대소문자 구분 없이 매핑 (정확한 매칭 우선, 없으면 대소문자 무시)
      const normalizedStatus = transformed.status.trim()
      transformed.status = statusMap[normalizedStatus] || 
                          statusMap[normalizedStatus.toLowerCase()] || 
                          statusMap[normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1).toLowerCase()] ||
                          'pending'
    }

    // 기본값 설정
    transformed.status = transformed.status || 'pending'
    transformed.created_at = new Date().toISOString()
    transformed.updated_at = new Date().toISOString()

    return transformed
  })
}

// 투어 데이터 변환
const transformTourData = (sheetData: any[]) => {
  return sheetData.map(row => {
    const transformed: any = {}
    
    // 컬럼 매핑 적용
    Object.entries(TOUR_COLUMN_MAPPING).forEach(([sheetColumn, dbColumn]) => {
      if (row[sheetColumn] !== undefined && row[sheetColumn] !== '') {
        transformed[dbColumn] = row[sheetColumn]
      }
    })

    // 데이터 타입 변환
    if (transformed.is_private_tour) {
      transformed.is_private_tour = transformed.is_private_tour === 'TRUE' || transformed.is_private_tour === 'true' || transformed.is_private_tour === '1'
    }
    // tour_date는 그대로 저장 (변환하지 않음)

    // 기본값 설정
    transformed.tour_status = transformed.tour_status || 'Recruiting'
    transformed.assignment_status = transformed.assignment_status || 'pending'
    transformed.created_at = new Date().toISOString()
    transformed.updated_at = new Date().toISOString()

    return transformed
  })
}

// 고객 정보 처리
const processCustomer = async (customerData: any) => {
  try {
    if (!customerData.customer_email) return null

    // 기존 고객 확인
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('email', customerData.customer_email)
      .single()

    if (existingCustomer) {
      return existingCustomer.id
    }

    // 새 고객 생성
    const { data: newCustomer, error } = await supabase
      .from('customers')
      .insert({
        name: customerData.customer_name || 'Unknown',
        email: customerData.customer_email,
        phone: customerData.customer_phone || null,
        language: 'ko',
        created_at: new Date().toISOString()
      })
      .select('id')
      .single()

    if (error) {
      console.error('Customer creation error:', error)
      return null
    }

    return newCustomer.id
  } catch (error) {
    console.error('Error processing customer:', error)
    return null
  }
}

// 예약 데이터 동기화
export const syncReservations = async (spreadsheetId: string, sheetName: string) => {
  try {
    console.log(`Starting sync for spreadsheet: ${spreadsheetId}, sheet: ${sheetName}`)
    
    // 구글 시트에서 데이터 읽기
    const sheetData = await readSheetData(spreadsheetId, sheetName)
    console.log(`Read ${sheetData.length} rows from Google Sheet`)

    if (sheetData.length === 0) {
      return { success: true, message: 'No data to sync', count: 0 }
    }

    // 데이터 변환
    const transformedData = transformReservationData(sheetData)
    console.log(`Transformed ${transformedData.length} rows`)

    // 기존 데이터와 비교하여 업데이트/삽입
    const results = {
      inserted: 0,
      updated: 0,
      errors: 0,
      errorDetails: [] as string[]
    }

    for (const row of transformedData) {
      try {
        if (!row.id) {
          console.warn('Skipping row without id:', row)
          continue
        }

        // 고객 정보 처리
        const customerId = await processCustomer(row)
        if (customerId) {
          row.customer_id = customerId
        }

        // choice 정보 분리 (reservations 테이블에는 저장하지 않음)
        const choice = row.choice
        delete row.choice

        // 기존 예약 확인
        const { data: existingReservation } = await supabase
          .from('reservations')
          .select('id')
          .eq('id', row.id)
          .single()

        if (existingReservation) {
          // 업데이트
          const { error: updateError } = await supabase
            .from('reservations')
            .update({
              ...row,
              updated_at: new Date().toISOString()
            })
            .eq('id', row.id)

          if (updateError) {
            console.error('Update error:', updateError)
            results.errors++
            results.errorDetails.push(`Update failed for ${row.id}: ${updateError.message}`)
          } else {
            results.updated++
          }
        } else {
          // 삽입
          const { error: insertError } = await supabase
            .from('reservations')
            .insert(row)

          if (insertError) {
            console.error('Insert error:', insertError)
            results.errors++
            results.errorDetails.push(`Insert failed for ${row.id}: ${insertError.message}`)
          } else {
            results.inserted++
          }
        }

        // choice 정보가 있으면 reservation_options 테이블에 저장
        if (choice) {
          const { error: optionError } = await supabase
            .from('reservation_options')
            .upsert({
              reservation_id: row.id,
              option_name: choice,
              option_value: choice,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })

          if (optionError) {
            console.error('Option insert error:', optionError)
            results.errorDetails.push(`Option insert failed for ${row.id}: ${optionError.message}`)
          }
        }
      } catch (error) {
        console.error('Error processing row:', error)
        results.errors++
        results.errorDetails.push(`Processing failed for ${row.id}: ${error}`)
      }
    }

    console.log('Sync completed:', results)
    return {
      success: results.errors === 0,
      message: `Sync completed: ${results.inserted} inserted, ${results.updated} updated, ${results.errors} errors`,
      count: results.inserted + results.updated,
      details: results
    }

  } catch (error) {
    console.error('Sync error:', error)
    return {
      success: false,
      message: `Sync failed: ${error}`,
      count: 0
    }
  }
}

// 투어 데이터 동기화
export const syncTours = async (spreadsheetId: string, sheetName: string) => {
  try {
    console.log(`Starting tour sync for spreadsheet: ${spreadsheetId}, sheet: ${sheetName}`)
    
    const sheetData = await readSheetData(spreadsheetId, sheetName)
    console.log(`Read ${sheetData.length} tour rows from Google Sheet`)

    if (sheetData.length === 0) {
      return { success: true, message: 'No tour data to sync', count: 0 }
    }

    const results = {
      inserted: 0,
      updated: 0,
      errors: 0,
      errorDetails: [] as string[]
    }

    // 데이터 변환
    const transformedData = transformTourData(sheetData)
    console.log(`Transformed ${transformedData.length} tour rows`)

    for (const row of transformedData) {
      try {
        if (!row.id) {
          console.warn('Skipping tour row without id:', row)
          continue
        }

        // 기존 투어 확인
        const { data: existingTour } = await supabase
          .from('tours')
          .select('id')
          .eq('id', row.id)
          .single()

        if (existingTour) {
          // 업데이트
          const { error: updateError } = await supabase
            .from('tours')
            .update({
              ...row,
              updated_at: new Date().toISOString()
            })
            .eq('id', row.id)

          if (updateError) {
            console.error('Tour update error:', updateError)
            results.errors++
            results.errorDetails.push(`Tour update failed for ${row.id}: ${updateError.message}`)
          } else {
            results.updated++
          }
        } else {
          // 삽입
          const { error: insertError } = await supabase
            .from('tours')
            .insert(row)

          if (insertError) {
            console.error('Tour insert error:', insertError)
            results.errors++
            results.errorDetails.push(`Tour insert failed for ${row.id}: ${insertError.message}`)
          } else {
            results.inserted++
          }
        }
      } catch (error) {
        console.error('Error processing tour row:', error)
        results.errors++
        results.errorDetails.push(`Tour processing failed for ${row.id}: ${error}`)
      }
    }

    console.log('Tour sync completed:', results)
    return {
      success: results.errors === 0,
      message: `Tour sync completed: ${results.inserted} inserted, ${results.updated} updated, ${results.errors} errors`,
      count: results.inserted + results.updated,
      details: results
    }

  } catch (error) {
    console.error('Tour sync error:', error)
    return {
      success: false,
      message: `Tour sync failed: ${error}`,
      count: 0
    }
  }
}

// 증분 동기화 (변경된 데이터만)
export const runIncrementalSync = async (spreadsheetId: string, reservationsSheet: string, toursSheet: string) => {
  try {
    console.log('Starting incremental sync...')
    
    // 마지막 동기화 시간 확인
    const { data: lastSync } = await supabase
      .from('sync_logs')
      .select('last_sync_time')
      .eq('spreadsheet_id', spreadsheetId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    const lastSyncTime = lastSync?.last_sync_time || new Date('1900-01-01').toISOString()
    console.log('Last sync time:', lastSyncTime)
    
    // 증분 동기화 실행 (현재는 전체 동기화와 동일하지만 향후 개선 가능)
    const reservationResult = await syncReservations(spreadsheetId, reservationsSheet)
    const tourResult = await syncTours(spreadsheetId, toursSheet)
    
    // 동기화 로그 저장
    await supabase
      .from('sync_logs')
      .insert({
        spreadsheet_id: spreadsheetId,
        reservations_sheet: reservationsSheet,
        tours_sheet: toursSheet,
        sync_type: 'incremental',
        last_sync_time: new Date().toISOString(),
        reservations_count: reservationResult.count || 0,
        tours_count: tourResult.count || 0,
        success: reservationResult.success && tourResult.success,
        error_message: reservationResult.success && tourResult.success ? null : 'Sync completed with errors',
        created_at: new Date().toISOString()
      })
    
    return {
      success: reservationResult.success && tourResult.success,
      message: `Incremental sync completed. Reservations: ${reservationResult.message}, Tours: ${tourResult.message}`,
      details: {
        reservations: reservationResult,
        tours: tourResult,
        lastSyncTime
      }
    }
  } catch (error) {
    console.error('Incremental sync error:', error)
    return {
      success: false,
      message: `Incremental sync failed: ${error}`,
      details: null
    }
  }
}

// 전체 동기화 실행
export const runFullSync = async (spreadsheetId: string, reservationsSheet: string, toursSheet: string) => {
  try {
    console.log('Starting full sync...')
    
    const reservationResult = await syncReservations(spreadsheetId, reservationsSheet)
    const tourResult = await syncTours(spreadsheetId, toursSheet)
    
    // 동기화 로그 저장
    await supabase
      .from('sync_logs')
      .insert({
        spreadsheet_id: spreadsheetId,
        reservations_sheet: reservationsSheet,
        tours_sheet: toursSheet,
        sync_type: 'full',
        last_sync_time: new Date().toISOString(),
        reservations_count: reservationResult.count || 0,
        tours_count: tourResult.count || 0,
        success: reservationResult.success && tourResult.success,
        error_message: reservationResult.success && tourResult.success ? null : 'Sync completed with errors',
        created_at: new Date().toISOString()
      })
    
    return {
      success: reservationResult.success && tourResult.success,
      message: `Full sync completed. Reservations: ${reservationResult.message}, Tours: ${tourResult.message}`,
      details: {
        reservations: reservationResult,
        tours: tourResult
      }
    }
  } catch (error) {
    console.error('Full sync error:', error)
    return {
      success: false,
      message: `Full sync failed: ${error}`,
      details: null
    }
  }
}
