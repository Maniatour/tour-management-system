import { supabase } from './supabase'

export interface HealthCheckResult {
  isConnected: boolean
  error?: string
  details?: any
}

/**
 * Supabase 연결 상태를 확인하는 함수
 */
export async function checkSupabaseHealth(): Promise<HealthCheckResult> {
  try {
    // 간단한 쿼리로 연결 테스트
    const { data, error } = await supabase
      .from('customers')
      .select('count', { count: 'exact', head: true })

    if (error) {
      return {
        isConnected: false,
        error: error.message,
        details: error
      }
    }

    return {
      isConnected: true,
      details: { count: data }
    }
  } catch (error) {
    return {
      isConnected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error
    }
  }
}

/**
 * Supabase 연결 상태를 콘솔에 로깅하는 함수
 */
export async function logSupabaseStatus(): Promise<void> {
  const result = await checkSupabaseHealth()
  
  if (result.isConnected) {
    console.log('✅ Supabase 연결 성공')
  } else {
    console.warn('❌ Supabase 연결 실패:', result.error)
    console.warn('상세 정보:', result.details)
  }
}
