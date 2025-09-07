import { createClient } from '@supabase/supabase-js'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// 싱글톤 패턴으로 클라이언트 인스턴스 생성
let supabaseInstance: ReturnType<typeof createClient<Database>> | null = null
let clientSupabaseInstance: ReturnType<typeof createClientComponentClient<Database>> | null = null

export const supabase = (() => {
  if (!supabaseInstance) {
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
