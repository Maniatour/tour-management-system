import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

export type CustomerRow = Database['public']['Tables']['customers']['Row']

/** 관리자 API: 서비스 롤이 있으면 RLS 우회, 없으면 기존 RLS·RPC 검증과 동일 */
export async function insertCustomerViaAdminApi(
  customerRow: Record<string, unknown>
): Promise<{ customer: CustomerRow | null; errorMessage: string | null }> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) {
    return { customer: null, errorMessage: '세션이 없습니다. 다시 로그인해 주세요.' }
  }
  const res = await fetch('/api/admin/customers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ customer: customerRow }),
  })
  const json = (await res.json().catch(() => ({}))) as {
    error?: string
    customer?: CustomerRow
  }
  if (!res.ok) {
    return { customer: null, errorMessage: json.error || `요청 실패 (${res.status})` }
  }
  return { customer: json.customer ?? null, errorMessage: null }
}
