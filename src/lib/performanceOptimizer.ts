import { supabase } from './supabase'

// 고성능 캐싱 시스템
export class HighPerformanceCache {
  private static instance: HighPerformanceCache
  private cache = new Map<string, { data: any, timestamp: number, hits: number }>()
  private readonly DEFAULT_TTL = 2 * 60 * 60 * 1000 // 2시간
  private readonly MAX_CACHE_SIZE = 1000 // 최대 캐시 항목 수
  private readonly CLEANUP_INTERVAL = 30 * 60 * 1000 // 30분마다 정리

  static getInstance(): HighPerformanceCache {
    if (!HighPerformanceCache.instance) {
      HighPerformanceCache.instance = new HighPerformanceCache()
      // 주기적 캐시 정리 시작
      setInterval(() => {
        HighPerformanceCache.instance.cleanup()
      }, HighPerformanceCache.instance.CLEANUP_INTERVAL)
    }
    return HighPerformanceCache.instance
  }

  // 캐시에서 데이터 가져오기
  get<T>(key: string, ttl?: number): T | null {
    const cached = this.cache.get(key)
    if (!cached) return null

    const now = Date.now()
    const cacheTTL = ttl || this.DEFAULT_TTL
    
    if (now - cached.timestamp > cacheTTL) {
      this.cache.delete(key)
      return null
    }

    // 히트 카운트 증가
    cached.hits++
    return cached.data as T
  }

  // 캐시에 데이터 저장
  set<T>(key: string, data: T, ttl?: number): void {
    // 캐시 크기 제한 확인
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.evictLeastUsed()
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      hits: 0
    })
  }

  // 가장 적게 사용된 항목 제거
  private evictLeastUsed(): void {
    let leastUsedKey = ''
    let minHits = Infinity

    for (const [key, value] of this.cache.entries()) {
      if (value.hits < minHits) {
        minHits = value.hits
        leastUsedKey = key
      }
    }

    if (leastUsedKey) {
      this.cache.delete(leastUsedKey)
    }
  }

  // 만료된 캐시 항목 정리
  cleanup(): void {
    const now = Date.now()
    const keysToDelete: string[] = []

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.DEFAULT_TTL) {
        keysToDelete.push(key)
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key))
    
    if (keysToDelete.length > 0) {
      console.log(`🧹 캐시 정리 완료: ${keysToDelete.length}개 항목 제거`)
    }
  }

  // 특정 패턴의 캐시 삭제
  deletePattern(pattern: string): void {
    const regex = new RegExp(pattern)
    const keysToDelete: string[] = []

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key)
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key))
    console.log(`🗑️ 패턴 캐시 삭제: ${keysToDelete.length}개 항목 (${pattern})`)
  }

  // 전체 캐시 삭제
  clear(): void {
    this.cache.clear()
    console.log('🧹 전체 캐시 삭제 완료')
  }

  // 캐시 통계
  getStats(): { size: number, hitRate: number } {
    let totalHits = 0
    for (const value of this.cache.values()) {
      totalHits += value.hits
    }
    
    const hitRate = this.cache.size > 0 ? totalHits / this.cache.size : 0
    
    return {
      size: this.cache.size,
      hitRate: Math.round(hitRate * 100) / 100
    }
  }
}

// 데이터베이스 쿼리 최적화 유틸리티
export class DatabaseOptimizer {
  private static instance: DatabaseOptimizer
  private queryCache = new Map<string, { data: any, timestamp: number }>()
  private readonly QUERY_CACHE_TTL = 5 * 60 * 1000 // 5분

  static getInstance(): DatabaseOptimizer {
    if (!DatabaseOptimizer.instance) {
      DatabaseOptimizer.instance = new DatabaseOptimizer()
    }
    return DatabaseOptimizer.instance
  }

  // 최적화된 테이블 컬럼 조회 (캐시 사용)
  async getTableColumns(tableName: string): Promise<Set<string>> {
    const cacheKey = `table_columns_${tableName}`
    const cached = this.queryCache.get(cacheKey)
    
    if (cached && (Date.now() - cached.timestamp) < this.QUERY_CACHE_TTL) {
      return cached.data
    }

    try {
      const { data: sampleData } = await supabase
        .from(tableName)
        .select('*')
        .limit(1)

      const columns = sampleData && sampleData.length > 0 
        ? new Set(Object.keys(sampleData[0] as Record<string, unknown>))
        : new Set()

      this.queryCache.set(cacheKey, {
        data: columns,
        timestamp: Date.now()
      })

      return columns
    } catch (error) {
      console.error(`테이블 컬럼 조회 실패 (${tableName}):`, error)
      return new Set()
    }
  }

  // 벌크 데이터 검증
  async validateBulkData(
    tableName: string, 
    data: Record<string, unknown>[],
    validationRules?: {
      requiredFields?: string[]
      foreignKeys?: { field: string, table: string }[]
    }
  ): Promise<{ valid: Record<string, unknown>[], invalid: Record<string, unknown>[] }> {
    const valid: Record<string, unknown>[] = []
    const invalid: Record<string, unknown>[] = []

    // 필수 필드 검증
    if (validationRules?.requiredFields) {
      data.forEach(row => {
        const hasAllRequired = validationRules.requiredFields!.every(field => 
          row[field] !== undefined && row[field] !== null && row[field] !== ''
        )
        
        if (hasAllRequired) {
          valid.push(row)
        } else {
          invalid.push(row)
        }
      })
    } else {
      valid.push(...data)
    }

    // 외래 키 검증 (병렬 처리)
    if (validationRules?.foreignKeys && valid.length > 0) {
      const foreignKeyPromises = validationRules.foreignKeys.map(async ({ field, table }) => {
        const fieldValues = valid.map(row => row[field]).filter(Boolean)
        if (fieldValues.length === 0) return new Set()

        const { data: existingValues } = await supabase
          .from(table)
          .select('id')
          .in('id', fieldValues)

        return new Set(existingValues?.map(item => item.id) || [])
      })

      const validKeySets = await Promise.all(foreignKeyPromises)
      
      // 유효한 외래 키를 가진 행만 필터링
      const finalValid: Record<string, unknown>[] = []
      const finalInvalid: Record<string, unknown>[] = []

      valid.forEach(row => {
        let isValid = true
        validationRules.foreignKeys!.forEach(({ field }, index) => {
          if (row[field] && !validKeySets[index].has(row[field] as string)) {
            isValid = false
          }
        })

        if (isValid) {
          finalValid.push(row)
        } else {
          finalInvalid.push(row)
        }
      })

      return { valid: finalValid, invalid: [...invalid, ...finalInvalid] }
    }

    return { valid, invalid }
  }

  // 캐시 정리
  clearCache(): void {
    this.queryCache.clear()
  }
}

// 싱글톤 인스턴스들 export
export const highPerformanceCache = HighPerformanceCache.getInstance()
export const databaseOptimizer = DatabaseOptimizer.getInstance()
