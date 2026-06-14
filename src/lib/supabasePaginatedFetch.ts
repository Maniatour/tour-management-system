import type { PostgrestError } from '@supabase/supabase-js'

/** PostgREST / Supabase 기본 max-rows */
export const SUPABASE_PAGE_SIZE = 1000

type PageResult<T> = { data: T[] | null; error: PostgrestError | null }

/**
 * `.range(from, to)` 쿼리를 1000행씩 순회해 전부 수집합니다.
 * 정렬 컬럼은 호출 측에서 고정해 두어야 합니다(보통 submit_on + id).
 */
export async function fetchAllSupabasePages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>
): Promise<{ data: T[]; error: PostgrestError | null }> {
  const all: T[] = []
  let from = 0
  for (;;) {
    const { data, error } = await fetchPage(from, from + SUPABASE_PAGE_SIZE - 1)
    if (error) return { data: all, error }
    const batch = data ?? []
    all.push(...batch)
    if (batch.length < SUPABASE_PAGE_SIZE) break
    from += SUPABASE_PAGE_SIZE
  }
  return { data: all, error: null }
}
