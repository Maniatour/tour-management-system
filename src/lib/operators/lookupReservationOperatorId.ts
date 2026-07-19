import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'

/** Resolve tenant for a reservation row; falls back to active/Kovegas. */
export async function lookupReservationOperatorId(
  supabase: SupabaseClient,
  reservationId: string | null | undefined,
  fallbackOperatorId?: string | null
): Promise<string> {
  const fallback = resolveOperatorId(fallbackOperatorId)
  const id = (reservationId || '').trim()
  if (!id) return fallback

  const { data, error } = await supabase
    .from('reservations')
    .select('operator_id')
    .eq('id', id)
    .maybeSingle()

  if (error || !data?.operator_id) return fallback
  return resolveOperatorId(data.operator_id as string)
}
