// 간단한 메모리 캐시 유틸리티
interface CacheItem<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
}

class MemoryCache {
  private cache = new Map<string, CacheItem<unknown>>()

  set<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key)
    if (!item) return null

    // TTL 체크
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key)
      return null
    }

    return item.data
  }

  has(key: string): boolean {
    const item = this.cache.get(key)
    if (!item) return false

    // TTL 체크
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
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

export const cache = new MemoryCache()

// 캐시 키 생성 헬퍼
export const cacheKeys = {
  tour: (id: string) => `tour:${id}`,
  product: (id: string) => `product:${id}`,
  productOptions: (id: string) => `product_options:${id}`,
  reservations: (productId: string, tourDate: string) => `reservations:${productId}:${tourDate}`,
  customers: (ids: string[]) => `customers:${ids.sort().join(',')}`,
  vehicles: () => 'vehicles:all',
  team: () => 'team:guides',
  pickupHotels: () => 'pickup_hotels:all',
  products: () => 'products:all',
  channels: () => 'channels:all'
}
