import type { SupabaseClient } from '@supabase/supabase-js'

/** 명세 대조에 연결된 지출·입금 원장 id 집합 (목록에 아이콘 배치용) */
export async function fetchReconciledSourceIds(
  supabase: SupabaseClient,
  sourceTable: string,
  sourceIds: string[]
): Promise<Set<string>> {
  const ids = sourceIds.filter(Boolean)
  if (ids.length === 0) return new Set()
  const { data, error } = await supabase
    .from('reconciliation_matches')
    .select('source_id')
    .eq('source_table', sourceTable)
    .in('source_id', ids)
  if (error || !data) return new Set()
  return new Set(data.map((r: { source_id: string }) => r.source_id))
}
