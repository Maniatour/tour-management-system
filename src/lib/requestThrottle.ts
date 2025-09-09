/**
 * 요청 제한 및 재시도 유틸리티
 */

interface ThrottleOptions {
  maxConcurrent: number
  delayMs: number
  maxRetries: number
}

class RequestThrottle {
  private queue: Array<() => Promise<any>> = []
  private running = 0
  private options: ThrottleOptions

  constructor(options: ThrottleOptions = {
    maxConcurrent: 5,
    delayMs: 100,
    maxRetries: 3
  }) {
    this.options = options
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await this.executeWithRetry(fn)
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })
      this.processQueue()
    })
  }

  private async executeWithRetry<T>(fn: () => Promise<T>, retries = 0): Promise<T> {
    try {
      return await fn()
    } catch (error) {
      if (retries < this.options.maxRetries) {
        console.warn(`Request failed, retrying (${retries + 1}/${this.options.maxRetries}):`, error)
        await this.delay(this.options.delayMs * Math.pow(2, retries)) // Exponential backoff
        return this.executeWithRetry(fn, retries + 1)
      }
      throw error
    }
  }

  private async processQueue() {
    if (this.running >= this.options.maxConcurrent || this.queue.length === 0) {
      return
    }

    this.running++
    const fn = this.queue.shift()!

    try {
      await fn()
    } finally {
      this.running--
      await this.delay(this.options.delayMs)
      this.processQueue()
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// 전역 인스턴스 생성
export const requestThrottle = new RequestThrottle({
  maxConcurrent: 3, // 동시 요청 수 제한
  delayMs: 200,     // 요청 간 지연 시간
  maxRetries: 2     // 최대 재시도 횟수
})

/**
 * Supabase 요청을 제한된 방식으로 실행하는 헬퍼 함수
 */
export async function throttledSupabaseRequest<T>(
  requestFn: () => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any }> {
  try {
    return await requestThrottle.execute(requestFn)
  } catch (error) {
    console.warn('Throttled request failed:', error)
    return { data: null, error }
  }
}
