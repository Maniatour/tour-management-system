/**
 * Route Handler / Server Action용 — 요청 쿠키의 Supabase 세션을 사용합니다.
 * (anon 키만 쓰는 클라이언트는 RLS `authenticated` 정책에서 행이 비어 나올 수 있습니다.)
 */
export { createServerSupabase as createClient } from '../supabase-server'
export type { Database } from '../database.types'
