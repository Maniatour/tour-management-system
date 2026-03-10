import { NextResponse } from 'next/server'

const emptyStatus = {
  connected: false,
  email: null as string | null,
  updated_at: null as string | null,
}

/**
 * GET /api/email/gmail/status
 * 현재 Gmail 연결 여부 및 연결된 이메일 반환
 * 테이블/설정 오류 시에도 200 + connected: false 로 응답해 페이지가 깨지지 않도록 함
 */
const statusOk = (body: object) => NextResponse.json(body, { status: 200 })

export async function GET() {
  try {
    const mod = await import('@/lib/supabase')
    const client = mod.supabaseAdmin ?? mod.supabase
    if (!client) {
      console.warn('[gmail/status] Supabase client not available (SUPABASE_SERVICE_ROLE_KEY may be missing)')
      return statusOk(emptyStatus)
    }
    const { data, error } = await client
      .from('gmail_connections')
      .select('email, updated_at')
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[gmail/status] Supabase error:', error.message, error.code)
      return statusOk(emptyStatus)
    }
    return statusOk({
      connected: !!data,
      email: data?.email ?? null,
      updated_at: data?.updated_at ?? null,
    })
  } catch (err) {
    console.error('[gmail/status] Unexpected error:', err)
    return statusOk(emptyStatus)
  }
}
