import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'

/** Resolve tenant for a tour row; falls back to active/Kovegas. */
export async function lookupTourOperatorId(
  supabase: SupabaseClient,
  tourId: string | null | undefined,
  fallbackOperatorId?: string | null
): Promise<string> {
  const fallback = resolveOperatorId(fallbackOperatorId)
  const id = (tourId || '').trim()
  if (!id) return fallback

  const { data, error } = await supabase
    .from('tours')
    .select('operator_id')
    .eq('id', id)
    .maybeSingle()

  if (error || !(data as { operator_id?: string } | null)?.operator_id) return fallback
  return resolveOperatorId((data as { operator_id: string }).operator_id)
}
