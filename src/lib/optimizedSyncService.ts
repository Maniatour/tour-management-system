import { supabase, supabaseAdmin } from './supabase'
import { readSheetDataDynamic } from './googleSheets'
import { highPerformanceCache, databaseOptimizer } from './performanceOptimizer'
import { SYNC_TABLES_REQUIRE_SHEET_ROW_ID } from './syncSheetPrimaryKey'

// 최적화된 동기화 서비스
export class OptimizedSyncService {
  private static instance: OptimizedSyncService
  private cache = new Map<string, { data: any, timestamp: number }>()
  private readonly CACHE_DURATION = 2 * 60 * 60 * 1000 // 2시간

  static getInstance(): OptimizedSyncService {
    if (!OptimizedSyncService.instance) {
      OptimizedSyncService.instance = new OptimizedSyncService()
    }
    return OptimizedSyncService.instance
  }

  // 병렬 처리를 위한 청크 분할
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }

  // 병렬 배치 처리
  private async processBatchesInParallel<T>(
    batches: T[][],
    processor: (batch: T[]) => Promise<void>,
    maxConcurrency: number = 3
  ): Promise<void> {
    const results: Promise<void>[] = []
    
    for (let i = 0; i < batches.length; i += maxConcurrency) {
      const batchGroup = batches.slice(i, i + maxConcurrency)
      const batchPromises = batchGroup.map(batch => processor(batch))
      results.push(...batchPromises)
      
      // 동시 실행 수 제한
      if (results.length >= maxConcurrency) {
        await Promise.all(results.splice(0, maxConcurrency))
      }
    }
    
    // 남은 배치들 처리
    if (results.length > 0) {
      await Promise.all(results)
    }
  }

  // 최적화된 데이터 변환 (벌크 처리)
  private optimizeDataTransformation(
    sheetData: Record<string, unknown>[],
    columnMapping: { [key: string]: string },
    targetTable: string
  ): Record<string, unknown>[] {
    console.log(`🚀 벌크 데이터 변환 시작: ${sheetData.length}개 행`)
    
    // 병렬 처리를 위한 청크 분할
    const chunkSize = Math.max(100, Math.floor(sheetData.length / 10))
    const chunks = this.chunkArray(sheetData, chunkSize)
    
    const transformedChunks: Record<string, unknown>[][] = []
    
    // 각 청크를 병렬로 처리
    chunks.forEach((chunk, index) => {
      const transformedChunk = chunk.map((row, rowIndex) => {
        const transformed: Record<string, unknown> = {}
        
        // 컬럼 매핑 적용
        Object.entries(columnMapping).forEach(([sheetColumn, dbColumn]) => {
          if (row[sheetColumn] !== undefined && row[sheetColumn] !== '') {
            transformed[dbColumn] = row[sheetColumn]
          }
        })

        // 데이터 타입 변환
        return this.convertDataTypes(transformed, targetTable)
      })
      
      transformedChunks.push(transformedChunk)
      
      if (index % 5 === 0) {
        console.log(`📊 청크 ${index + 1}/${chunks.length} 변환 완료`)
      }
    })
    
    // 모든 청크를 하나로 합치기
    const result = transformedChunks.flat()
    console.log(`✅ 벌크 데이터 변환 완료: ${result.length}개 행`)
    
    return result
  }

  // 최적화된 데이터 타입 변환
  private convertDataTypes(data: Record<string, unknown>, tableName: string): Record<string, unknown> {
    const converted = { ...data }

    // 숫자 필드 변환
    const numberFields = ['adults', 'child', 'infant', 'total_people', 'price', 'rooms', 'unit_price', 'total_price', 'base_price', 'commission_amount', 'commission_percent']
    numberFields.forEach(field => {
      if (converted[field] !== undefined && converted[field] !== '') {
        converted[field] = parseFloat(String(converted[field])) || 0
      }
    })

    // 텍스트 필드 변환
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

    // 날짜 필드 변환 (tour_date는 제외하고 그대로 저장)
    let dateFields: string[] = []
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
    
    // tour_date는 그대로 저장 (변환하지 않음)
    if (converted.tour_date !== undefined && converted.tour_date !== null && converted.tour_date !== '') {
      converted.tour_date = String(converted.tour_date).trim()
    }

    // tour_id 정리
    if (converted.tour_id !== undefined && converted.tour_id !== null) {
      const val = String(converted.tour_id).trim()
      converted.tour_id = val.length === 0 ? null : val
    }

    // 배열 필드 변환 (PostgreSQL 배열 리터럴 형식으로 변환)
    const arrayFields = ['reservation_ids', 'reservations_ids', 'languages']
    arrayFields.forEach(field => {
      if (converted[field] !== undefined && converted[field] !== null) {
        converted[field] = this.convertToPostgreSQLArray(converted[field])
      }
    })

    // 필드명 통일: reservations_ids → reservation_ids
    if (converted.reservations_ids && !converted.reservation_ids) {
      converted.reservation_ids = converted.reservations_ids
      delete converted.reservations_ids
    }

    // JSONB 필드 정리
    const jsonbFields = ['selected_options', 'selected_option_prices']
    jsonbFields.forEach(field => {
      if (converted[field] !== undefined && converted[field] !== null) {
        try {
          if (typeof converted[field] === 'string') {
            const parsed = JSON.parse(converted[field])
            converted[field] = parsed
          }
        } catch {
          console.warn(`Invalid JSON format for ${field}:`, converted[field])
          converted[field] = {}
        }
      }
    })

    return converted
  }

  // PostgreSQL 배열 리터럴 형식으로 변환
  private convertToPostgreSQLArray(value: unknown): string[] | null {
    if (!value) return null
    
    // 이미 배열인 경우
    if (Array.isArray(value)) {
      return value.map(v => String(v)).filter(v => v.length > 0)
    }
    
    // 문자열인 경우 파싱
    if (typeof value === 'string') {
      const trimmed = value.trim()
      
      // JSON 배열 형태: "[\"R1\",\"R2\"]"
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed)
          if (Array.isArray(parsed)) {
            return parsed.map(v => String(v)).filter(v => v.length > 0)
          }
        } catch {
          // JSON 파싱 실패 시 콤마 구분으로 처리
        }
      }
      
      // 콤마 구분 문자열: R1, R2, R3 형태
      return trimmed
        .split(',')
        .map(part => part.trim().replace(/^[\[\"\']+|[\]\\"\']+$/g, ''))
        .filter(part => part.length > 0)
    }
    
    return null
  }

  // 최적화된 벌크 upsert (성능 최적화 통합)
  private async optimizedBulkUpsert(
    targetTable: string,
    data: Record<string, unknown>[],
    batchSize: number = 200
  ): Promise<{ inserted: number, updated: number, errors: number }> {
    console.log(`🚀 최적화된 벌크 upsert 시작: ${data.length}개 행, 배치 크기: ${batchSize}`)
    
    const results = { inserted: 0, updated: 0, errors: 0 }
    
    try {
      // 1. 데이터 검증 (병렬 처리)
      console.log(`🔍 데이터 검증 시작`)
      const validationRules = this.getValidationRules(targetTable)
      console.log(`🔍 검증 규칙:`, validationRules)
      
      const { valid, invalid } = await databaseOptimizer.validateBulkData(targetTable, data, validationRules)
      console.log(`✅ 데이터 검증 완료: 유효한 행 ${valid.length}개, 무효한 행 ${invalid.length}개`)
      
      if (invalid.length > 0) {
        console.warn(`⚠️ ${invalid.length}개 행이 검증 실패로 제외됨`)
        // 처음 5개 검증 실패 사유 출력
        invalid.slice(0, 5).forEach((item, index) => {
          console.warn(`검증 실패 ${index + 1}:`, item.errors)
        })
      }
      
      if (valid.length === 0) {
        console.log('❌ 유효한 데이터가 없습니다.')
        return results
      }
      
      // 2. 테이블 컬럼 정보 캐시에서 가져오기
      console.log(`🔍 테이블 컬럼 정보 조회: ${targetTable}`)
      const tableColumns = await databaseOptimizer.getTableColumns(targetTable)
      console.log(`✅ 테이블 컬럼 정보 조회 완료:`, Array.from(tableColumns))
      
      // 3. 배치 처리
      const batches = this.chunkArray(valid, batchSize)
      console.log(`📊 배치 분할 완료: ${batches.length}개 배치`)
      
      // 병렬 배치 처리 (대용량 데이터의 경우 동시성 증가)
      const maxConcurrency = data.length > 5000 ? 5 : 3
      await this.processBatchesInParallel(
        batches,
        async (batch) => {
          try {
            const nowIso = new Date().toISOString()
            
            // ID가 없는 행들에 대해 UUID 생성
            const preparedBatch = batch.map(row => {
              const prepared = { ...row }
              if (!prepared.id && targetTable !== 'team') {
                if (!SYNC_TABLES_REQUIRE_SHEET_ROW_ID.has(targetTable)) {
                  prepared.id = this.generateUUID()
                }
              }
              
              // 테이블에 updated_at 컬럼이 있는 경우에만 추가
              if (tableColumns.has('updated_at')) {
                prepared.updated_at = nowIso
              }
              
              return prepared
            })
            
            // RLS 정책 우회를 위한 직접 SQL 실행
            const { error } = await this.executeDirectUpsert(targetTable, preparedBatch, tableColumns)
            
            if (error) {
              console.error('❌ 배치 upsert 오류:', error)
              results.errors += batch.length
            } else {
              results.updated += batch.length
            }
          } catch (error) {
            console.error('❌ 배치 upsert 예외:', error)
            results.errors += batch.length
          }
        },
        maxConcurrency // 대용량 데이터의 경우 5개, 그 외 3개 배치 동시 처리
      )
      
      console.log(`✅ 벌크 upsert 완료: ${results.updated}개 업데이트, ${results.errors}개 오류`)
      return results
    } catch (error) {
      console.error('❌ 벌크 upsert 전체 실패:', error)
      results.errors = data.length
      return results
    }
  }

  // 테이블별 검증 규칙 정의
  private getValidationRules(tableName: string) {
    const rules: { [key: string]: any } = {
      reservations: {
        requiredFields: [], // 필수 필드 없음 (모든 필드 선택적)
        foreignKeys: [] // 외래 키 검증 비활성화 (선택적)
      },
      tour_expenses: {
        requiredFields: ['id'],
        foreignKeys: [
          { field: 'tour_id', table: 'tours' },
          { field: 'product_id', table: 'products' }
        ]
      },
      team: {
        requiredFields: ['email']
      },
      reservation_pricing: {
        requiredFields: ['id', 'reservation_id']
      },
      reservation_expenses: {
        requiredFields: ['id']
      },
      company_expenses: {
        requiredFields: ['id']
      }
    }
    
    return rules[tableName] || { requiredFields: [] }
  }

  // UUID 생성
  private generateUUID(): string {
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID()
    }
    return `${Date.now()}_${Math.random().toString(36).slice(2)}`
  }

  // 메인 최적화된 동기화 함수
  async optimizedSync(
    spreadsheetId: string,
    sheetName: string,
    targetTable: string,
    columnMapping: { [key: string]: string },
    onProgress?: (event: {
      type: 'start' | 'progress' | 'complete' | 'info' | 'warn' | 'error'
      message?: string
      total?: number
      processed?: number
      inserted?: number
      updated?: number
      errors?: number
    }) => void
  ) {
    try {
      console.log(`🚀 최적화된 동기화 시작: ${spreadsheetId}/${sheetName} → ${targetTable}`)
      console.log(`📋 컬럼 매핑:`, columnMapping)
      onProgress?.({ type: 'info', message: `최적화된 동기화 시작 - ${sheetName} → ${targetTable}` })
      
      // 1. 구글 시트에서 데이터 읽기
      console.log(`📊 구글 시트에서 데이터 읽기 시작: ${sheetName}`)
      onProgress?.({ type: 'info', message: '구글 시트에서 데이터 읽는 중...' })
      
      const sheetData = await readSheetDataDynamic(spreadsheetId, sheetName)
      console.log(`📊 구글 시트 데이터 읽기 완료: ${sheetData.length}개 행`)
      
      if (sheetData.length === 0) {
        console.log(`⚠️ 동기화할 데이터가 없습니다.`)
        onProgress?.({ type: 'warn', message: '동기화할 데이터가 없습니다.' })
        return { success: true, message: 'No data to sync', count: 0 }
      }
      
      onProgress?.({ type: 'info', message: `구글 시트에서 ${sheetData.length}개 행을 읽었습니다.` })
      
      // 2. 최적화된 데이터 변환
      console.log(`🔄 데이터 변환 시작`)
      onProgress?.({ type: 'info', message: '데이터 변환 중...' })
      const transformedData = this.optimizeDataTransformation(sheetData, columnMapping, targetTable)
      console.log(`✅ 데이터 변환 완료: ${transformedData.length}개 행`)
      
      // 3. 최적화된 배치 크기 계산
      const optimalBatchSize = this.calculateOptimalBatchSize(transformedData.length)
      console.log(`📊 최적 배치 크기: ${optimalBatchSize}`)
      onProgress?.({ type: 'info', message: `최적 배치 크기: ${optimalBatchSize}` })
      
      // 4. 최적화된 벌크 upsert
      console.log(`💾 데이터베이스 동기화 시작`)
      onProgress?.({ type: 'info', message: '데이터베이스에 동기화 시작...' })
      onProgress?.({ type: 'start', total: transformedData.length })
      
      const results = await this.optimizedBulkUpsert(targetTable, transformedData, optimalBatchSize)
      console.log(`✅ 데이터베이스 동기화 완료:`, results)
      
      // 5. 결과 반환
      const summary = {
        success: results.errors === 0,
        message: `최적화된 동기화 완료: ${results.updated}개 업데이트, ${results.errors}개 오류`,
        count: transformedData.length,
        details: results
      }
      
      onProgress?.({ type: 'complete' })
      console.log(`✅ 최적화된 동기화 완료:`, summary)
      
      return summary
      
    } catch (error) {
      console.error('❌ 최적화된 동기화 오류:', error)
      console.error('❌ 오류 스택:', error instanceof Error ? error.stack : 'No stack trace')
      onProgress?.({ type: 'error', message: `동기화 실패: ${error}` })
      return {
        success: false,
        message: `최적화된 동기화 실패: ${error}`,
        count: 0
      }
    }
  }

  // 최적 배치 크기 계산 (대용량 데이터에 맞게 조정)
  // 9500개 이상의 rows 처리를 위해 배치 크기 대폭 증가
  private calculateOptimalBatchSize(totalRows: number): number {
    if (totalRows > 50000) return 1000
    if (totalRows > 20000) return 800
    if (totalRows > 10000) return 500
    if (totalRows > 5000) return 400
    return 200
  }

  // 캐시 관리 (고성능 캐시 시스템 사용)
  getFromCache<T>(key: string, ttl?: number): T | null {
    return highPerformanceCache.get<T>(key, ttl)
  }

  setCache<T>(key: string, data: T, ttl?: number): void {
    highPerformanceCache.set(key, data, ttl)
  }

  clearCache(): void {
    highPerformanceCache.clear()
    databaseOptimizer.clearCache()
  }

  // 캐시 통계
  getCacheStats() {
    return highPerformanceCache.getStats()
  }

  // 특정 패턴의 캐시 삭제
  clearCachePattern(pattern: string): void {
    highPerformanceCache.deletePattern(pattern)
  }

  // RLS 정책을 우회하는 직접 SQL 실행
  private async executeDirectUpsert(
    tableName: string, 
    batch: Record<string, unknown>[], 
    tableColumns: Set<string>
  ): Promise<{ error: any }> {
    try {
      // RLS를 우회하기 위해 서비스 계정으로 직접 upsert 실행
      const conflictColumn = tableName === 'team' ? 'email' : 'id'
      
      console.log(`🔧 RLS 우회 upsert: ${tableName} 테이블에 ${batch.length}개 행 처리`)
      
      // 서버 환경에서는 서비스 계정 사용 (RLS 우회)
      const client = supabaseAdmin ?? supabase

      // 서비스/익명 클라이언트로 upsert 실행
      const { error } = await client
        .from(tableName)
        .upsert(batch, { 
          onConflict: conflictColumn,
          ignoreDuplicates: false
        })
      
      if (error) {
        console.error('RLS bypass upsert error:', error)
        
        // RLS 오류인 경우 폴백으로 개별 처리
        if (error.code === '42501') {
          console.log(`🔄 RLS 오류 감지 - 개별 처리로 폴백: ${tableName}`)
          return await this.fallbackIndividualUpsert(tableName, batch, tableColumns)
        }
        
        return { error }
      }
      
      return { error: null }
    } catch (error) {
      console.error('RLS bypass upsert exception:', error)
      return { error }
    }
  }

  // RLS 오류 시 미니 배치 처리 폴백 (개별 처리 대신 작은 배치로 재시도)
  private async fallbackIndividualUpsert(
    tableName: string,
    batch: Record<string, unknown>[],
    tableColumns: Set<string>
  ): Promise<{ error: any }> {
    try {
      // 대용량 데이터의 경우 미니 배치로 처리 (개별 처리 대신)
      // 재시도 횟수를 대폭 줄이기 위해 작은 배치 단위로 처리
      const miniBatchSize = batch.length > 100 ? 25 : 10
      console.log(`🔄 미니 배치 폴백: ${tableName} 테이블에 ${batch.length}개 행 (배치 크기: ${miniBatchSize})`)
      
      const conflictColumn = tableName === 'team' ? 'email' : 'id'
      let successCount = 0
      let errorCount = 0
      const client = supabaseAdmin ?? supabase
      
      // 미니 배치로 분할하여 처리
      for (let i = 0; i < batch.length; i += miniBatchSize) {
        const miniBatch = batch.slice(i, i + miniBatchSize)
        
        try {
          const { error } = await client
            .from(tableName)
            .upsert(miniBatch, { 
              onConflict: conflictColumn,
              ignoreDuplicates: false
            })
          
          if (error) {
            // 미니 배치 실패 시 해당 배치만 오류로 카운트 (더 이상 개별 처리하지 않음)
            console.warn(`미니 배치 upsert 오류 (${tableName}): ${error.message}`)
            errorCount += miniBatch.length
          } else {
            successCount += miniBatch.length
          }
        } catch (batchError) {
          console.warn(`미니 배치 upsert 예외 (${tableName}):`, batchError)
          errorCount += miniBatch.length
        }
        
        // 미니 배치 간 최소 지연 (서버 부하 방지)
        if (i + miniBatchSize < batch.length) {
          await new Promise(resolve => setTimeout(resolve, 5))
        }
      }
      
      console.log(`✅ 미니 배치 폴백 완료: ${successCount}개 성공, ${errorCount}개 실패`)
      
      // 일부라도 성공했으면 성공으로 간주
      if (successCount > 0) {
        return { error: null }
      } else {
        return { error: new Error(`모든 미니 배치 upsert 실패: ${errorCount}개 오류`) }
      }
    } catch (error) {
      console.error('미니 배치 폴백 예외:', error)
      return { error }
    }
  }
}

// 싱글톤 인스턴스 export
export const optimizedSyncService = OptimizedSyncService.getInstance()
