import { createClient } from '@supabase/supabase-js'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// 환경 변수 검증
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.')
}

console.log('Supabase config:', {
  url: supabaseUrl,
  hasKey: !!supabaseAnonKey,
  keyLength: supabaseAnonKey?.length
})

// 싱글톤 패턴으로 클라이언트 인스턴스 생성
let supabaseInstance: ReturnType<typeof createClient<Database>> | null = null

// 주의: 브라우저에서는 auth-helpers 클라이언트와 스토리지를 공유하지 않도록 비지속 모드 사용
export const supabase = (() => {
  if (!supabaseInstance) {
    const isBrowser = typeof window !== 'undefined'
    console.log('Creating new Supabase client instance')
    supabaseInstance = createClient<Database>(
      supabaseUrl,
      supabaseAnonKey,
      isBrowser
        ? {
            auth: {
              persistSession: true,
              autoRefreshToken: true,
              storage: typeof window !== 'undefined' ? window.localStorage : undefined,
            },
            global: {
              fetch: (url, options = {}) => {
                // QUIC 오류 해결을 위한 설정
                const headers = new Headers(options?.headers)
                headers.set('Connection', 'close')
                
                return fetch(url, {
                  ...options,
                  headers: headers,
                  // HTTP/1.1 사용 강제
                  cache: 'no-store'
                })
              }
            }
          }
        : undefined
    )
  }
  return supabaseInstance
})()

// 클라이언트 컴포넌트용 Supabase 클라이언트 (같은 인스턴스 사용)
export const createClientSupabase = () => {
  return supabase
}

export type { Database }
