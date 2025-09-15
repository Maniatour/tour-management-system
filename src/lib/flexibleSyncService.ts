import { supabase } from './supabase'
import { readSheetData, readSheetDataDynamic } from './googleSheets'

// 하드코딩된 매핑 제거 - 실제 데이터베이스 스키마 기반으로 동적 매핑 생성

// 안전한 문자열→문자열 배열 변환
const coerceStringToStringArray = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    return raw.map(v => String(v)).filter(v => v.length > 0)
  }
  if (typeof raw === 'string') {
    const value = raw.trim()
    // JSON 배열 형태: "[\"R1\",\"R2\"]"
    if (value.startsWith('[') && value.endsWith(']')) {
      try {
        const parsed = JSON.parse(value)
        if (Array.isArray(parsed)) {
          return parsed.map(v => String(v)).filter(v => v.length > 0)
        }
      } catch {
        // 무시하고 아래 분기 사용
      }
    }
    // 콤마 구분 문자열: R1, R2, R3 형태 또는 잘못 split된 잔여물 정리
    return value
      .split(',')
      .map(part => part.trim().replace(/^[\[\"\']+|[\]\\"\']+$/g, ''))
      .filter(part => part.length > 0)
  }
  return []
}

// 데이터 타입 변환 함수
const convertDataTypes = (data: any, tableName: string) => {
  console.log(`convertDataTypes called with tableName: ${tableName}`)
  const converted = { ...data }

  // 숫자 필드 변환
  const numberFields = ['adults', 'child', 'infant', 'total_people', 'price', 'rooms', 'unit_price', 'total_price']
  numberFields.forEach(field => {
    if (converted[field] !== undefined && converted[field] !== '') {
      converted[field] = parseFloat(converted[field]) || 0
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

  // 날짜 필드 변환
  let dateFields: string[] = ['tour_date']
  if (tableName === 'tour_hotel_bookings') {
    dateFields = ['event_date', 'check_in_date', 'check_out_date']
  }
  
  dateFields.forEach(field => {
    if (converted[field] && converted[field] !== '') {
      try {
        converted[field] = new Date(converted[field]).toISOString().split('T')[0]
      } catch (error) {
        console.warn(`Invalid date format for ${field}:`, converted[field])
      }
    }
  })

  // tour_hotel_bookings 및 ticket_bookings 테이블 특별 처리
  if (tableName === 'tour_hotel_bookings' || tableName === 'ticket_bookings') {
    console.log('Processing tour_hotel_bookings data:', Object.keys(converted))
    
    // 존재하지 않는 필드 제거
    let validFields: string[] = []
    
    if (tableName === 'tour_hotel_bookings') {
      validFields = [
        'id', 'tour_id', 'event_date', 'submit_on', 'check_in_date', 'check_out_date',
        'reservation_name', 'submitted_by', 'cc', 'rooms', 'city', 'hotel', 'room_type',
        'unit_price', 'total_price', 'payment_method', 'website', 'rn_number',
        'status', 'created_at', 'updated_at'
      ]
    } else if (tableName === 'ticket_bookings') {
      validFields = [
        'id', 'category', 'submit_on', 'submitted_by', 'check_in_date', 'time',
        'company', 'ea', 'expense', 'income', 'payment_method', 'rn_number',
        'tour_id', 'note', 'status', 'season', 'created_at', 'updated_at', 'reservation_id'
      ]
    }
    
    // 유효하지 않은 필드 제거
    const removedFields: string[] = []
    Object.keys(converted).forEach(key => {
      if (!validFields.includes(key)) {
        removedFields.push(key)
        delete converted[key]
      }
    })
    
    if (removedFields.length > 0) {
      console.log('Removed invalid fields:', removedFields)
    }
    
    console.log('Final converted data keys:', Object.keys(converted))
    
    // submit_on 필드가 있으면 타임스탬프로 변환
    if (converted.submit_on && converted.submit_on !== '') {
      try {
        converted.submit_on = new Date(converted.submit_on).toISOString()
      } catch (error) {
        console.warn(`Invalid submit_on format:`, converted.submit_on)
        converted.submit_on = new Date().toISOString()
      }
    }
  }

  // created_at, updated_at은 구글 시트 값 그대로 사용 (문자열로 유지)
  // tour_id도 구글 시트 값 그대로 사용

  // 배열/JSONB 배열 필드 변환
  const arrayFields = ['reservation_ids', 'reservations_ids'] // 예약 ID 목록 (오타 방지 포함)
  arrayFields.forEach(field => {
    if (converted[field] !== undefined && converted[field] !== null) {
      converted[field] = coerceStringToStringArray(converted[field])
    }
  })
  // 필드명 통일: reservations_ids → reservation_ids
  if (converted.reservations_ids && !converted.reservation_ids) {
    converted.reservation_ids = converted.reservations_ids
    delete converted.reservations_ids
  }

  // JSONB 필드 정리 (존재할 때만 정리하고, 없으면 건드리지 않음)
  let jsonbFields: string[] = []
  if (tableName === 'reservations') {
    jsonbFields = ['selected_options', 'selected_option_prices']
  }
  
  jsonbFields.forEach(field => {
    if (converted[field] !== undefined && converted[field] !== null) {
      try {
        if (typeof converted[field] === 'string') {
          // 문자열이면 JSON으로 파싱하여 객체로 저장 (JSONB에 적합)
          const parsed = JSON.parse(converted[field])
          converted[field] = parsed
        }
        // 객체/배열이면 그대로 둠
      } catch (error) {
        console.warn(`Invalid JSON format for ${field}:`, converted[field])
        // 파싱 실패 시 빈 객체로 설정 (문자열이 아닌 JSONB 값으로 저장)
        converted[field] = {}
      }
    }
  })

  // 기본값은 삽입 시에만 적용하도록 이 단계에서는 설정하지 않음

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

// 마지막 동기화 시간 조회 (직접 데이터베이스 접근)
const getLastSyncTime = async (tableName: string, spreadsheetId: string): Promise<Date | null> => {
  try {
    // 직접 Supabase에서 조회
    const { data, error } = await supabase
      .from('sync_history')
      .select('last_sync_time')
      .eq('table_name', tableName)
      .eq('spreadsheet_id', spreadsheetId)
      .order('last_sync_time', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116은 "no rows found" 에러
      console.error('Error fetching sync history:', error)
      return null
    }

    return data?.last_sync_time ? new Date(data.last_sync_time) : null
  } catch (error) {
    console.error('Error fetching last sync time:', error)
    return null
  }
}

// 동기화 히스토리 저장 (직접 데이터베이스 접근)
const saveSyncHistory = async (tableName: string, spreadsheetId: string, recordCount: number) => {
  try {
    // 직접 Supabase에 저장
    const { error } = await supabase
      .from('sync_history')
      .insert({
        table_name: tableName,
        spreadsheet_id: spreadsheetId,
        last_sync_time: new Date().toISOString(),
        record_count: recordCount
      })

    if (error) {
      console.error('Failed to save sync history:', error)
    }
  } catch (error) {
    console.error('Error saving sync history:', error)
  }
}

// 유연한 데이터 동기화 (증분 동기화 지원)
export const flexibleSync = async (
  spreadsheetId: string, 
  sheetName: string, 
  targetTable: string, 
  columnMapping: { [key: string]: string }, 
  enableIncrementalSync: boolean = true,
  onProgress?: (event: {
    type: 'start' | 'progress' | 'complete'
    total?: number
    processed?: number
    inserted?: number
    updated?: number
    errors?: number
    mode?: 'incremental' | 'full'
  }) => void
) => {
  try {
    console.log(`Starting flexible sync for spreadsheet: ${spreadsheetId}, sheet: ${sheetName}, table: ${targetTable}`)
    console.log(`Target table type: ${typeof targetTable}, value: "${targetTable}"`)
    
    // 증분 동기화 비활성화: 항상 전체 동기화
    let lastSyncTime: Date | null = null
    
    // 구글 시트에서 데이터 읽기 (동적 범위 사용)
    const sheetData = await readSheetDataDynamic(spreadsheetId, sheetName)
    console.log(`Read ${sheetData.length} rows from Google Sheet`)

    if (sheetData.length === 0) {
      return { success: true, message: 'No data to sync', count: 0 }
    }

    // 데이터 변환 (전체 동기화)
    const transformedData = sheetData
      .map((row, index) => {
        const transformed: any = {}
        
        // 사용자 정의 컬럼 매핑 적용
        Object.entries(columnMapping).forEach(([sheetColumn, dbColumn]) => {
          if (row[sheetColumn] !== undefined && row[sheetColumn] !== '') {
            transformed[dbColumn] = row[sheetColumn]
          }
        })

        // 첫 번째 행에 대한 디버그 로그
        if (index === 0) {
          console.log('First row mapping:', {
            originalRow: Object.keys(row),
            columnMapping: columnMapping,
            transformedBeforeConversion: Object.keys(transformed)
          })
        }

        const converted = convertDataTypes(transformed, targetTable)
        
        // 첫 번째 행에 대한 디버그 로그
        if (index === 0) {
          console.log('First row after conversion:', Object.keys(converted))
        }
        
        return converted
      })

    const totalRows = transformedData.length
    const mode: 'incremental' | 'full' = 'full'
    console.log(`Transformed ${totalRows} rows (${mode} sync)`)
    onProgress?.({ type: 'start', total: totalRows, mode })

    // 동기화 실행 (배치 upsert로 성능 개선, ID가 없으면 생성)
    const results = {
      inserted: 0,
      updated: 0,
      errors: 0,
      errorDetails: [] as string[]
    }
    let processed = 0
    const batchSize = 500
    const rowsBuffer: any[] = []

    const flush = async () => {
      if (rowsBuffer.length === 0) return
      try {
        const nowIso = new Date().toISOString()
        const payload = rowsBuffer.map(r => ({ ...r, updated_at: nowIso }))
        const { error } = await supabase
          .from(targetTable)
          .upsert(payload, { onConflict: 'id' })
        if (error) {
          console.error('Upsert batch error:', error)
          results.errors += rowsBuffer.length
          results.errorDetails.push(`Upsert batch failed: ${error.message}`)
        } else {
          // 구분이 어려우므로 processed 만큼을 모두 updated로 간주
          results.updated += rowsBuffer.length
        }
      } catch (err: any) {
        console.error('Upsert batch exception:', err)
        results.errors += rowsBuffer.length
        results.errorDetails.push(`Upsert batch exception: ${String(err)}`)
      } finally {
        rowsBuffer.length = 0
      }
    }

    for (const originalRow of transformedData) {
      try {
        const row = { ...originalRow }

        // ID가 없으면 생성하여 스킵 방지
        if (!row.id) {
          try {
            // Node 18+ 환경
            row.id = (globalThis as any).crypto?.randomUUID ? (globalThis as any).crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`
          } catch {
            row.id = `${Date.now()}_${Math.random().toString(36).slice(2)}`
          }
        }

        // 고객 정보 처리 (reservations 테이블인 경우)
        if (targetTable === 'reservations' && row.customer_email) {
          const customerId = await processCustomer(row)
          if (customerId) {
            row.customer_id = customerId
          }
        }

        // 삽입 시 기본값 보완
        const prepared = applyInsertDefaults(targetTable, row)
        rowsBuffer.push(prepared)
      } catch (error) {
        console.error('Error preparing row:', error)
        results.errors++
        results.errorDetails.push(`Prepare failed for ${originalRow.id}: ${error}`)
      }
      processed++
      onProgress?.({ type: 'progress', processed, total: totalRows, inserted: results.inserted, updated: results.updated, errors: results.errors })
      if (rowsBuffer.length >= batchSize) {
        await flush()
      }
    }

    // 마지막 배치 flush
    await flush()

    console.log('Flexible sync completed:', results)
    
    // 동기화 히스토리 저장
    if (processed > 0) {
      await saveSyncHistory(targetTable, spreadsheetId, processed)
    }
    
    const summary = {
      success: results.errors === 0,
      message: `Sync completed: ${results.inserted} inserted, ${results.updated} updated, ${results.errors} errors`,
      count: processed,
      details: results
    }
    onProgress?.({ type: 'complete' })
    return summary

  } catch (error) {
    console.error('Flexible sync error:', error)
    return {
      success: false,
      message: `Sync failed: ${error}`,
      count: 0
    }
  }
}

// 삽입 시에만 기본값을 적용 (업데이트 시에는 기존 DB 값을 보존)
const applyInsertDefaults = (tableName: string, row: any) => {
  const payload = { ...row }
  const nowIso = new Date().toISOString()

  if (!payload.created_at) payload.created_at = nowIso
  if (!payload.updated_at) payload.updated_at = nowIso

  if (tableName === 'reservations') {
    if (!payload.status) payload.status = 'pending'
    if (!payload.channel_id) payload.channel_id = 'default'
  }
  if (tableName === 'tours') {
    if (!payload.tour_status) payload.tour_status = 'Recruiting'
  }
  if (tableName === 'customers') {
    if (!payload.language) payload.language = 'ko'
  }

  return payload
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
