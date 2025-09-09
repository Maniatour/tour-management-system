/**
 * 데이터 캐싱 유틸리티
 */

interface CacheItem<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
}

class DataCache {
  private cache = new Map<string, CacheItem<any>>()
  private defaultTTL = 5 * 60 * 1000 // 5분

  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    })
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key)
    
    if (!item) {
      return null
    }

    // TTL 확인
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key)
      return null
    }

    return item.data as T
  }

  has(key: string): boolean {
    const item = this.cache.get(key)
    
    if (!item) {
      return false
    }

    // TTL 확인
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  clear(): void {
    this.cache.clear()
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  // 특정 패턴의 키들을 삭제
  deletePattern(pattern: string): void {
    const regex = new RegExp(pattern)
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key)
      }
    }
  }
}

// 전역 캐시 인스턴스
export const dataCache = new DataCache()

// 간단한 해시 함수
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // 32bit 정수로 변환
  }
  return Math.abs(hash).toString(36)
}

// 캐시 키 생성 헬퍼
export const cacheKeys = {
  products: () => 'products:all',
  product: (id: string) => `product:${id}`,
  productSubCategories: () => 'products:sub_categories',
  tours: (productIds: string[], tourDates: string[]) => {
    // 해시를 사용하여 긴 키를 짧게 만들기
    const productKey = productIds.sort().join(',')
    const dateKey = tourDates.sort().join(',')
    const productHash = simpleHash(productKey)
    const dateHash = simpleHash(dateKey)
    return `tours:${productHash}:${dateHash}`
  },
  customers: () => 'customers:all',
  channels: () => 'channels:all',
  options: () => 'options:all',
  pickupHotels: () => 'pickup_hotels:all',
  coupons: () => 'coupons:all'
}

// 캐시된 데이터 가져오기 또는 새로 로드
export async function getCachedOrFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // 캐시에서 먼저 확인
  const cached = dataCache.get<T>(key)
  if (cached !== null) {
    console.log(`✅ Cache hit: ${key}`)
    return cached
  }

  // 캐시에 없으면 새로 가져오기
  console.log(`🔄 Cache miss: ${key}, fetching...`)
  const data = await fetchFn()
  
  // 캐시에 저장
  dataCache.set(key, data, ttl)
  console.log(`💾 Cached: ${key}`)
  
  return data
}
