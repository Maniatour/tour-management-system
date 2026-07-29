import type { SupabaseClient } from '@supabase/supabase-js'

type GuideOpTodoAudience = 'office' | 'guide' | 'common'

/** 가이드 보드: 부서(office/guide/common) 공통 체크리스트 + 레거시 개별 할당 병합 */
export async function fetchGuideOpTodos<T extends { id: string; created_at: string }>(
  supabase: SupabaseClient,
  email: string,
  audiences: readonly GuideOpTodoAudience[]
) {
  const deptList = [...audiences]

  const [deptRes, assignRes] = await Promise.all([
    supabase
      .from('op_todos')
      .select('*')
      .in('department', deptList)
      .order('created_at', { ascending: false })
      .limit(200),
    email
      ? supabase
          .from('op_todos')
          .select('*')
          .eq('assigned_to', email)
          .order('created_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (deptRes.error) throw deptRes.error
  if (assignRes.error) throw assignRes.error

  const merged = new Map<string, T>()
  for (const row of [...(deptRes.data || []), ...(assignRes.data || [])] as T[]) {
    merged.set(row.id, row)
  }

  return Array.from(merged.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}
