import { createClient } from '@supabase/supabase-js'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tyilwbytyuqrhxekjxcd.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5aWx3Ynl0eXVxcmh4ZWtqeGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU3MzQwMDAsImV4cCI6MjA1MTMxMDAwMH0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8'

console.log('Supabase config:', {
  url: supabaseUrl,
  hasKey: !!supabaseAnonKey,
  keyLength: supabaseAnonKey?.length
})

// 환경 변수가 없을 때 경고
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn('Supabase environment variables not found. Using default local development values.')
}

// 싱글톤 패턴으로 클라이언트 인스턴스 생성
let supabaseInstance: ReturnType<typeof createClient<Database>> | null = null
let clientSupabaseInstance: ReturnType<typeof createClientComponentClient<Database>> | null = null

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
              persistSession: false,
              autoRefreshToken: false,
              storage: undefined,
            },
          }
        : undefined
    )
  }
  return supabaseInstance
})()

// 클라이언트 컴포넌트용 Supabase 클라이언트 (싱글톤)
export const createClientSupabase = () => {
  if (!clientSupabaseInstance) {
    clientSupabaseInstance = createClientComponentClient<Database>()
  }
  return clientSupabaseInstance
}

export type { Database }
