import { supabase } from './supabase'
import { readSheetData } from './googleSheets'

// 하드코딩된 매핑 제거 - 실제 데이터베이스 스키마 기반으로 동적 매핑 생성

// 데이터 타입 변환 함수
const convertDataTypes = (data: any, tableName: string) => {
  const converted = { ...data }

  // 숫자 필드 변환
  const numberFields = ['adults', 'child', 'infant', 'total_people', 'price']
  numberFields.forEach(field => {
    if (converted[field] !== undefined && converted[field] !== '') {
      converted[field] = parseInt(converted[field]) || 0
    }
  })

  // 텍스트 필드 변환 (UUID가 아닌 TEXT 타입들)
  const textFields = ['product_id', 'customer_id', 'tour_id', 'id']
  textFields.forEach(field => {
    if (converted[field] !== undefined && converted[field] !== '') {
      converted[field] = String(converted[field])
    }
  })

  // 불린 필드 변환
  const booleanFields = ['is_private_tour']
  booleanFields.forEach(field => {
    if (converted[field] !== undefined && converted[field] !== '') {
      converted[field] = converted[field] === 'TRUE' || converted[field] === 'true' || converted[field] === '1'
    }
  })

  // 날짜 필드 변환 (tour_date만 날짜 형식으로 변환)
  const dateFields = ['tour_date']
  dateFields.forEach(field => {
    if (converted[field] && converted[field] !== '') {
      try {
        converted[field] = new Date(converted[field]).toISOString().split('T')[0]
      } catch (error) {
        console.warn(`Invalid date format for ${field}:`, converted[field])
      }
    }
  })

  // created_at, updated_at은 구글 시트 값 그대로 사용 (문자열로 유지)
  // tour_id도 구글 시트 값 그대로 사용

  // JSONB 필드 정리 (줄바꿈 문자 제거)
  const jsonbFields = ['selected_options', 'selected_option_prices']
  jsonbFields.forEach(field => {
    if (converted[field]) {
      try {
        // 문자열인 경우 JSON으로 파싱 후 다시 문자열화하여 정리
        if (typeof converted[field] === 'string') {
          const parsed = JSON.parse(converted[field])
          converted[field] = JSON.stringify(parsed)
        }
      } catch (error) {
        console.warn(`Invalid JSON format for ${field}:`, converted[field])
        // JSON 파싱 실패 시 빈 객체로 설정
        converted[field] = '{}'
      }
    } else {
      // 값이 없으면 빈 객체로 설정
      converted[field] = '{}'
    }
  })

  // 기본값 설정
  if (tableName === 'reservations') {
    converted.status = converted.status || 'pending'
    converted.channel_id = converted.channel_id || 'default'
  }
  if (tableName === 'tours') {
    converted.tour_status = converted.tour_status || 'Recruiting'
  }
  if (tableName === 'customers') {
    converted.language = converted.language || 'ko'
  }

  // created_at, updated_at, tour_id는 구글 시트 값 그대로 사용
  // 시스템에서 자동 생성하지 않음

  return converted
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

// 유연한 데이터 동기화
export const flexibleSync = async (
  spreadsheetId: string, 
  sheetName: string, 
  targetTable: string, 
  columnMapping: { [key: string]: string }
) => {
  try {
    console.log(`Starting flexible sync for spreadsheet: ${spreadsheetId}, sheet: ${sheetName}, table: ${targetTable}`)
    
    // 구글 시트에서 데이터 읽기
    const sheetData = await readSheetData(spreadsheetId, sheetName)
    console.log(`Read ${sheetData.length} rows from Google Sheet`)

    if (sheetData.length === 0) {
      return { success: true, message: 'No data to sync', count: 0 }
    }

    // 데이터 변환
    const transformedData = sheetData.map(row => {
      const transformed: any = {}
      
      // 사용자 정의 컬럼 매핑 적용
      Object.entries(columnMapping).forEach(([sheetColumn, dbColumn]) => {
        if (row[sheetColumn] !== undefined && row[sheetColumn] !== '') {
          transformed[dbColumn] = row[sheetColumn]
        }
      })

      return convertDataTypes(transformed, targetTable)
    })

    console.log(`Transformed ${transformedData.length} rows`)

    // 동기화 실행
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

        // 고객 정보 처리 (reservations 테이블인 경우)
        if (targetTable === 'reservations' && row.customer_email) {
          const customerId = await processCustomer(row)
          if (customerId) {
            row.customer_id = customerId
          }
        }

        // 기존 데이터 확인
        const { data: existingRecord } = await supabase
          .from(targetTable)
          .select('id')
          .eq('id', row.id)
          .single()

        if (existingRecord) {
          // 업데이트
          const { error: updateError } = await supabase
            .from(targetTable)
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
            .from(targetTable)
            .insert(row)

          if (insertError) {
            console.error('Insert error:', insertError)
            results.errors++
            results.errorDetails.push(`Insert failed for ${row.id}: ${insertError.message}`)
          } else {
            results.inserted++
          }
        }
      } catch (error) {
        console.error('Error processing row:', error)
        results.errors++
        results.errorDetails.push(`Processing failed for ${row.id}: ${error}`)
      }
    }

    console.log('Flexible sync completed:', results)
    return {
      success: results.errors === 0,
      message: `Sync completed: ${results.inserted} inserted, ${results.updated} updated, ${results.errors} errors`,
      count: results.inserted + results.updated,
      details: results
    }

  } catch (error) {
    console.error('Flexible sync error:', error)
    return {
      success: false,
      message: `Sync failed: ${error}`,
      count: 0
    }
  }
}

// 사용 가능한 테이블 목록 가져오기 (하드코딩 제거)
export const getAvailableTables = () => {
  // 이제 /api/sync/all-tables에서 모든 테이블을 가져옴
  return []
}

// 테이블 표시명 가져오기
const getTableDisplayName = (tableName: string) => {
  const displayNames: { [key: string]: string } = {
    reservations: '예약',
    tours: '투어',
    customers: '고객',
    products: '상품'
  }
  return displayNames[tableName] || tableName
}

// 테이블의 기본 컬럼 매핑 가져오기 (하드코딩 제거)
export const getTableColumnMapping = (tableName: string) => {
  // 이제 동적으로 생성되므로 빈 객체 반환
  return {}
}

// 시트의 컬럼과 테이블 컬럼 매핑 제안 (동적 생성)
export const suggestColumnMapping = (sheetColumns: string[], tableName: string, dbColumns: any[] = []) => {
  const suggested: { [key: string]: string } = {}
  
  // 데이터베이스 컬럼명을 기반으로 매핑 제안 생성
  const dbColumnNames = dbColumns.map(col => col.name)
  
  sheetColumns.forEach(sheetColumn => {
    // 정확한 매칭 (대소문자 무시)
    const exactMatch = dbColumnNames.find(dbCol => 
      dbCol.toLowerCase() === sheetColumn.toLowerCase()
    )
    if (exactMatch) {
      suggested[sheetColumn] = exactMatch
      return
    }
    
    // 부분 매칭 (포함 관계)
    const partialMatch = dbColumnNames.find(dbCol => 
      dbCol.toLowerCase().includes(sheetColumn.toLowerCase()) ||
      sheetColumn.toLowerCase().includes(dbCol.toLowerCase())
    )
    if (partialMatch) {
      suggested[sheetColumn] = partialMatch
      return
    }
    
    // 한글 매핑 (일반적인 패턴)
    const koreanMappings: { [key: string]: string } = {
      '예약번호': 'id',
      '고객명': 'name',
      '이메일': 'email',
      '전화번호': 'phone',
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
      '채널': 'channel_id',
      '상태': 'status',
      '비고': 'notes',
      '개인투어': 'is_private_tour',
      '가이드': 'tour_guide_id',
      '어시스턴트': 'assistant_id'
    }
    
    if (koreanMappings[sheetColumn]) {
      const mappedColumn = koreanMappings[sheetColumn]
      if (dbColumnNames.includes(mappedColumn)) {
        suggested[sheetColumn] = mappedColumn
      }
    }
  })
  
  return suggested
}
