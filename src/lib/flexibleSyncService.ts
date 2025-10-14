import { supabase } from './supabase'
import { readSheetDataDynamic } from './googleSheets'

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
const convertDataTypes = (data: Record<string, unknown>, tableName: string) => {
  console.log(`convertDataTypes called with tableName: ${tableName}`)
  const converted = { ...data }

  // 숫자 필드 변환
  const numberFields = ['adults', 'child', 'infant', 'total_people', 'price', 'rooms', 'unit_price', 'total_price', 'base_price', 'commission_amount', 'commission_percent']
  numberFields.forEach(field => {
    if (converted[field] !== undefined && converted[field] !== '') {
      converted[field] = parseFloat(String(converted[field])) || 0
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
        converted[field] = new Date(String(converted[field])).toISOString().split('T')[0]
      } catch {
        console.warn(`Invalid date format for ${field}:`, converted[field])
      }
    }
  })

  // tour_id 정리: 공백 트리밍만 수행 (TEXT PK 허용). 빈 문자열은 null 처리
  if (converted.tour_id !== undefined && converted.tour_id !== null) {
    const val = String(converted.tour_id).trim()
    converted.tour_id = val.length === 0 ? null : val
  }

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

      if (converted.submitted_by === '') converted.submitted_by = null
    } else if (tableName === 'ticket_bookings') {
      validFields = [
        'id', 'category', 'submit_on', 'submitted_by', 'check_in_date', 'time',
        'company', 'ea', 'expense', 'income', 'payment_method', 'rn_number',
        'tour_id', 'note', 'status', 'season', 'created_at', 'updated_at', 'reservation_id'
      ]

      // 입력 보정: 빈 문자열을 NULL/0으로 정리
      if (converted.time === '') converted.time = null
      if (converted.company === '') converted.company = null
      if (converted.ea === '' || converted.ea === undefined || converted.ea === null) converted.ea = 0
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
        converted.submit_on = new Date(String(converted.submit_on)).toISOString()
      } catch {
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

  // team 테이블 전용: languages(TEXT[])는 항상 문자열 배열로 변환
  if (tableName === 'team') {
    if (converted.languages !== undefined && converted.languages !== null) {
      converted.languages = coerceStringToStringArray(converted.languages)
    }
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
      } catch {
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
const processCustomer = async (customerData: Record<string, unknown>) => {
  try {
    if (!customerData.customer_email || typeof customerData.customer_email !== 'string') return null

    // 기존 고객 확인
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('email', customerData.customer_email as string)
      .single()

    if (existingCustomer) {
      return (existingCustomer as { id: string }).id
    }

    // 새 고객 생성
    const { data: newCustomer, error } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .from('customers')
      .insert({
        name: (customerData.customer_name as string) || 'Unknown',
        email: customerData.customer_email as string,
        phone: (customerData.customer_phone as string) || null,
        language: 'ko',
        created_at: new Date().toISOString()
      })
      .select('id')
      .single()

    if (error) {
      console.error('Customer creation error:', error)
      return null
    }

    return (newCustomer as { id: string }).id
  } catch (error) {
    console.error('Error processing customer:', error)
    return null
  }
}

// 마지막 동기화 시간 조회 (사용하지 않음 - 전체 동기화만 지원)
// const getLastSyncTime = async (tableName: string, spreadsheetId: string): Promise<Date | null> => { ... }

// 동기화 히스토리 저장 (직접 데이터베이스 접근)
const saveSyncHistory = async (tableName: string, spreadsheetId: string, recordCount: number) => {
  try {
    // 직접 Supabase에 저장
    const { error } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
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
    type: 'start' | 'progress' | 'complete' | 'info' | 'warn' | 'error'
    message?: string
    total?: number
    processed?: number
    inserted?: number
    updated?: number
    errors?: number
    mode?: 'incremental' | 'full'
  }) => void,
  // 주입 가능한 Supabase 클라이언트 (JWT 포함)
  injectedSupabaseClient?: unknown,
  jwtToken?: string
) => {
  try {
    const db = (injectedSupabaseClient as any) || (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    console.log(`Starting flexible sync for spreadsheet: ${spreadsheetId}, sheet: ${sheetName}, table: ${targetTable}`)
    console.log(`Target table type: ${typeof targetTable}, value: "${targetTable}"`)
    
    onProgress?.({ type: 'info', message: `동기화 시작 - 스프레드시트: ${spreadsheetId}, 시트: ${sheetName}, 테이블: ${targetTable}` })
    
    // 증분 동기화 비활성화: 항상 전체 동기화
    // const lastSyncTime: Date | null = null // 사용하지 않음
    
    // 구글 시트에서 데이터 읽기 (동적 범위 사용)
    onProgress?.({ type: 'info', message: '구글 시트에서 데이터 읽는 중...' })
    const sheetData = await readSheetDataDynamic(spreadsheetId, sheetName)
    console.log(`Read ${sheetData.length} rows from Google Sheet`)
    onProgress?.({ type: 'info', message: `구글 시트에서 ${sheetData.length}개 행을 읽었습니다.` })

    if (sheetData.length === 0) {
      onProgress?.({ type: 'warn', message: '동기화할 데이터가 없습니다.' })
      return { success: true, message: 'No data to sync', count: 0 }
    }

    // 데이터 변환 (전체 동기화)
    onProgress?.({ type: 'info', message: '데이터 변환 중...' })
    const transformedData = sheetData
      .map((row, index) => {
        const transformed: Record<string, unknown> = {}
        
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
    onProgress?.({ type: 'info', message: `데이터 변환 완료 - ${totalRows}개 행 (${mode} 동기화)` })
    onProgress?.({ type: 'start', total: totalRows, mode })

    // 대상 테이블의 컬럼 존재 여부 확인 (샘플 1행 조회)
    let tableColumns: Set<string> | null = null
    try {
      const { data: sampleForColumns } = await (db as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .from(targetTable)
        .select('*')
        .limit(1)
      if (sampleForColumns && sampleForColumns.length > 0) {
        tableColumns = new Set(Object.keys(sampleForColumns[0] as Record<string, unknown>))
      } else {
        tableColumns = new Set()
      }
    } catch {
      tableColumns = new Set()
    }

    // tour_expenses 테이블에 대한 특별한 처리
    if (targetTable === 'tour_expenses') {
      onProgress?.({ type: 'info', message: 'tour_expenses 테이블 동기화 - 외래 키 검증을 건너뜁니다...' })
      
      // 외래 키 검증을 건너뛰고 모든 레코드를 처리
      onProgress?.({ type: 'warn', message: '외래 키 검증을 건너뛰고 모든 레코드를 동기화합니다.' })
      
      // 외래 키 정리: 공백 트리밍만 수행 (TEXT 키 허용). 비어 있으면 null
      transformedData.forEach(row => {
        if (typeof row.tour_id === 'string') row.tour_id = row.tour_id.trim() || null
        if (typeof row.product_id === 'string') row.product_id = row.product_id.trim() || null
      })
      
      // 외래 키 검증을 건너뛰므로 주석 처리
      /*
      // 외래 키 검증을 위한 참조 테이블 데이터 조회
      const { data: existingTours } = await supabase.from('tours').select('id')
      const { data: existingProducts } = await supabase.from('products').select('id')
      
      console.log(`Found ${existingTours?.length || 0} tours in database`)
      console.log(`Found ${existingProducts?.length || 0} products in database`)
      
      // 샘플 tour_id들 로깅
      if (existingTours && existingTours.length > 0) {
        console.log('Sample tour IDs from database:', existingTours.slice(0, 5).map(t => t.id))
        console.log('Tour ID types:', existingTours.slice(0, 3).map(t => ({ id: t.id, type: typeof t.id, length: t.id?.length })))
      }
      
      // 구글 시트에서 읽어온 데이터의 tour_id 샘플 확인
      const sheetTourIds = transformedData
        .map(row => row.tour_id)
        .filter(Boolean)
        .slice(0, 10)
      console.log('Sample tour_ids from Google Sheet:', sheetTourIds)
      console.log('Sheet tour_id types:', sheetTourIds.map(id => ({ id, type: typeof id, length: id?.length })))
      
      // 구글 시트의 tour_id와 DB의 tour_id 비교
      const sheetTourIdSet = new Set(sheetTourIds)
      const dbTourIdSet = new Set(existingTours?.map(t => t.id) || [])
      const commonIds = [...sheetTourIdSet].filter(id => dbTourIdSet.has(id))
      const missingIds = [...sheetTourIdSet].filter(id => !dbTourIdSet.has(id))
      
      console.log(`Common tour_ids: ${commonIds.length}/${sheetTourIdSet.size}`)
      console.log(`Missing tour_ids: ${missingIds.length}/${sheetTourIdSet.size}`)
      if (missingIds.length > 0) {
        console.log('Missing tour_ids sample:', missingIds.slice(0, 5))
      }
      
      const validTourIds = new Set(existingTours?.map(t => t.id) || [])
      const validProductIds = new Set(existingProducts?.map(p => p.id) || [])
      
      // 유효하지 않은 외래 키를 가진 레코드 필터링
      const originalCount = transformedData.length
      const invalidTourIds = new Set<string>()
      const invalidProductIds = new Set<string>()
      
      const filteredData = transformedData.filter(row => {
        let isValid = true
        
        if (row.tour_id && !validTourIds.has(row.tour_id)) {
          invalidTourIds.add(row.tour_id)
          // 첫 번째 몇 개만 상세 로깅
          if (invalidTourIds.size <= 5) {
            console.warn(`Skipping tour_expenses record with invalid tour_id: ${row.tour_id}`)
            console.warn(`  - Looking for tour_id: "${row.tour_id}" (type: ${typeof row.tour_id}, length: ${row.tour_id?.length})`)
            console.warn(`  - Available tour_ids sample:`, Array.from(validTourIds).slice(0, 3))
          }
          isValid = false
        }
        if (row.product_id && !validProductIds.has(row.product_id)) {
          invalidProductIds.add(row.product_id)
          console.warn(`Skipping tour_expenses record with invalid product_id: ${row.product_id}`)
          isValid = false
        }
        return isValid
      })
      
      const filteredCount = originalCount - filteredData.length
      if (filteredCount > 0) {
        onProgress?.({ 
          type: 'warn', 
          message: `${filteredCount}개의 레코드가 유효하지 않은 외래 키로 인해 제외되었습니다. (유효하지 않은 tour_id: ${invalidTourIds.size}개, 유효하지 않은 product_id: ${invalidProductIds.size}개)` 
        })
        
        // 상세 정보 로깅
        if (invalidTourIds.size > 0) {
          console.warn('Invalid tour_ids:', Array.from(invalidTourIds).slice(0, 10))
        }
        if (invalidProductIds.size > 0) {
          console.warn('Invalid product_ids:', Array.from(invalidProductIds).slice(0, 10))
        }
      }
      
      transformedData.length = 0
      transformedData.push(...filteredData)
      */
    }
    
    // 동기화 실행 (배치 upsert로 성능 개선, ID가 없으면 생성)
    onProgress?.({ type: 'info', message: '데이터베이스에 동기화 시작...' })
    
    // 현재 사용자 정보 확인
    onProgress?.({ type: 'info', message: '현재 사용자 정보를 확인합니다...' })
    try {
      let userEmail = ''
      if (jwtToken) {
        const { data: { user } } = await db.auth.getUser(jwtToken)
        userEmail = user?.email || ''
      } else {
        const { data: { user } } = await db.auth.getUser()
        userEmail = user?.email || ''
      }
      onProgress?.({ type: 'info', message: `현재 사용자: ${userEmail || 'unknown'}` })
      
      // is_staff 함수 테스트
      const { data: staffCheck } = await db.rpc('is_staff', { p_email: userEmail || '' })
      onProgress?.({ type: 'info', message: `Staff 권한: ${staffCheck ? 'YES' : 'NO'}` })
    } catch {
      onProgress?.({ type: 'warn', message: '사용자 정보 확인 실패' })
    }
    
    // RLS 정책을 우회하기 위해 직접 SQL 실행 (exec_sql 함수가 없으므로 제거)
    onProgress?.({ type: 'info', message: 'RLS 정책을 우회하여 동기화를 진행합니다...' })
    
    const results = {
      inserted: 0,
      updated: 0,
      errors: 0,
      errorDetails: [] as string[]
    }
    let processed = 0
    const batchSize = 50 // Google Sheets API 할당량을 고려하여 100 → 50으로 추가 감소
    const rowsBuffer: Record<string, unknown>[] = []

    const flush = async () => {
      if (rowsBuffer.length === 0) return
      try {
        const nowIso = new Date().toISOString()
        
        // updated_at 컬럼이 실제로 존재하는 경우에만 추가
        const payload = rowsBuffer.map(r => {
          const row = { ...r }
          if (tableColumns && tableColumns.has('updated_at')) {
            row.updated_at = nowIso
          }
          return row
        })
        
        // API 할당량을 고려한 지연 시간 추가 (200ms)
        await new Promise(resolve => setTimeout(resolve, 200))
        
        const { error } = await (db as any) // eslint-disable-line @typescript-eslint/no-explicit-any
          .from(targetTable)
          .upsert(payload, { onConflict: targetTable === 'team' ? 'email' : 'id' })
        if (error) {
          console.error('Upsert batch error:', error)
          results.errors += rowsBuffer.length
          const errorMsg = `배치 처리 실패 (${rowsBuffer.length}개 행): ${error.message}`
          results.errorDetails.push(errorMsg)
          onProgress?.({ type: 'error', message: errorMsg })
          
          // 구체적인 오류 원인 분석
          if (error.message.includes('duplicate key')) {
            onProgress?.({ type: 'warn', message: '중복 키 오류: ID가 이미 존재합니다. upsert를 사용하여 업데이트됩니다.' })
          } else if (error.message.includes('foreign key')) {
            onProgress?.({ type: 'warn', message: '외래 키 오류: 참조하는 테이블에 해당 ID가 없습니다.' })
          } else if (error.message.includes('not null')) {
            onProgress?.({ type: 'warn', message: 'NOT NULL 제약 오류: 필수 필드가 비어있습니다.' })
          } else if (error.message.includes('invalid input syntax')) {
            onProgress?.({ type: 'warn', message: '데이터 타입 오류: 잘못된 형식의 데이터가 있습니다.' })
          }
        } else {
          // 구분이 어려우므로 processed 만큼을 모두 updated로 간주
          results.updated += rowsBuffer.length
          onProgress?.({ type: 'info', message: `${rowsBuffer.length}개 행 배치 처리 완료` })
        }
      } catch (err: unknown) {
        console.error('Upsert batch exception:', err)
        results.errors += rowsBuffer.length
        const errorMsg = `배치 처리 예외 (${rowsBuffer.length}개 행): ${String(err)}`
        results.errorDetails.push(errorMsg)
        onProgress?.({ type: 'error', message: errorMsg })
        
        // 예외 유형별 분석
        const errMessage = err instanceof Error ? err.message : String(err)
        if (errMessage.includes('Network')) {
          onProgress?.({ type: 'warn', message: '네트워크 오류: 인터넷 연결을 확인하세요.' })
        } else if (errMessage.includes('timeout')) {
          onProgress?.({ type: 'warn', message: '타임아웃 오류: 서버 응답이 지연되고 있습니다.' })
        } else if (errMessage.includes('permission')) {
          onProgress?.({ type: 'warn', message: '권한 오류: 데이터베이스 접근 권한을 확인하세요.' })
        }
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
            // team 테이블은 PK가 email이므로 id를 생성하지 않음
            if (targetTable !== 'team') {
              // Node 18+ 환경
              row.id = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID ? (globalThis as { crypto: { randomUUID: () => string } }).crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`
            }
          } catch {
            if (targetTable !== 'team') {
              row.id = `${Date.now()}_${Math.random().toString(36).slice(2)}`
            }
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
        const prepared = applyInsertDefaults(targetTable, row, tableColumns)
        rowsBuffer.push(prepared)
      } catch (error) {
        console.error('Error preparing row:', error)
        results.errors++
        const errorMsg = `행 준비 실패 (ID: ${originalRow.id || 'unknown'}): ${error}`
        results.errorDetails.push(errorMsg)
        onProgress?.({ type: 'error', message: errorMsg })
        
        // 행 준비 오류 분석
        if (String(error).includes('customer_email')) {
          onProgress?.({ type: 'warn', message: '고객 이메일 처리 오류: 이메일 형식을 확인하세요.' })
        } else if (String(error).includes('date')) {
          onProgress?.({ type: 'warn', message: '날짜 형식 오류: 날짜 형식을 YYYY-MM-DD로 확인하세요.' })
        } else if (String(error).includes('number')) {
          onProgress?.({ type: 'warn', message: '숫자 형식 오류: 숫자 필드에 올바른 값을 입력하세요.' })
        }
      }
      processed++
      onProgress?.({ type: 'progress', processed, total: totalRows, inserted: results.inserted, updated: results.updated, errors: results.errors })
      if (rowsBuffer.length >= batchSize) {
        await flush()
        // 배치 처리 후 추가 지연 (API 할당량 고려)
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    // 마지막 배치 flush
    onProgress?.({ type: 'info', message: '마지막 배치 처리 중...' })
    await flush()

    // 동기화 완료
    onProgress?.({ type: 'info', message: '동기화가 완료되었습니다.' })

    console.log('Flexible sync completed:', results)
    onProgress?.({ type: 'info', message: '동기화 히스토리 저장 중...' })
    
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
const applyInsertDefaults = (tableName: string, row: Record<string, unknown>, tableColumns?: Set<string> | null) => {
  const payload = { ...row }
  const nowIso = new Date().toISOString()

  // created_at/updated_at 컬럼이 실제로 존재하는 경우에만 보완
  if (tableColumns && tableColumns.has('created_at') && !payload.created_at) {
    payload.created_at = nowIso
  }
  if (tableColumns && tableColumns.has('updated_at') && !payload.updated_at) {
    payload.updated_at = nowIso
  }

  if (tableName === 'reservations') {
    if (tableColumns?.has('status') && !payload.status) payload.status = 'pending'
    if (tableColumns?.has('channel_id') && !payload.channel_id) payload.channel_id = 'default'
  }
  if (tableName === 'tours') {
    if (tableColumns?.has('tour_status') && !payload.tour_status) payload.tour_status = 'Recruiting'
  }
  if (tableName === 'customers') {
    if (tableColumns?.has('language') && !payload.language) payload.language = 'ko'
  }
  if (tableName === 'products') {
    if (tableColumns?.has('base_price') && (payload.base_price === undefined || payload.base_price === null || payload.base_price === '')) {
      payload.base_price = 0
    }
  }

  return payload
}

// 사용 가능한 테이블 목록 가져오기 (하드코딩 제거)
export const getAvailableTables = () => {
  // 이제 /api/sync/all-tables에서 모든 테이블을 가져옴
  return []
}

// 테이블 표시명 가져오기 (사용하지 않음)
// const getTableDisplayName = (tableName: string) => { ... }

// 테이블의 기본 컬럼 매핑 가져오기 (하드코딩 제거)
export const getTableColumnMapping = (_tableName: string) => {
  // 이제 동적으로 생성되므로 빈 객체 반환
  return {}
}

// 시트의 컬럼과 테이블 컬럼 매핑 제안 (동적 생성)
export const suggestColumnMapping = (sheetColumns: string[], tableName: string, dbColumns: Record<string, unknown>[] = []) => {
  const suggested: { [key: string]: string } = {}
  
  // 데이터베이스 컬럼명을 기반으로 매핑 제안 생성
  const dbColumnNames = dbColumns.map(col => (col as { name: string }).name)
  
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
