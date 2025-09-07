import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { Database } from './database.types'

// 서버 컴포넌트용 Supabase 클라이언트
export const createServerSupabase = () => createServerComponentClient<Database>({ cookies })
