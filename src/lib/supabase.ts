import { createClient } from '@supabase/supabase-js'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

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

export const supabase = (() => {
  if (!supabaseInstance) {
    console.log('Creating new Supabase client instance')
    supabaseInstance = createClient<Database>(supabaseUrl, supabaseAnonKey)
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
