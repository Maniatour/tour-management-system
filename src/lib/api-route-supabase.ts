import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseClientWithToken, supabase } from '@/lib/supabase'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/database.types'

/**
 * App Router API: 쿠키 세션(@supabase/ssr)이 없을 때(예: localStorage 전용 mock 세션)에도
 * Authorization: Bearer <access_token> 으로 동일 사용자 RLS가 적용되도록 Supabase 클라이언트를 반환합니다.
 */
export async function getSupabaseForApiRoute(
  request: NextRequest
): Promise<SupabaseClient<Database> | NextResponse> {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim()
    if (token) {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token)
      if (!error && user) {
        return createSupabaseClientWithToken(token)
      }
    }
  }

  const cookieClient = await createClient()
  const {
    data: { user },
    error,
  } = await cookieClient.auth.getUser()
  if (!error && user) {
    return cookieClient
  }

  return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
}
