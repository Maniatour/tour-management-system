import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'

/** Resolve tenant for a vehicle row; falls back to active/Kovegas. */
export async function lookupVehicleOperatorId(
  supabase: SupabaseClient,
  vehicleId: string | null | undefined,
  fallbackOperatorId?: string | null
): Promise<string> {
  const fallback = resolveOperatorId(fallbackOperatorId)
  const id = (vehicleId || '').trim()
  if (!id) return fallback

  const { data, error } = await supabase
    .from('vehicles')
    .select('operator_id')
    .eq('id', id)
    .maybeSingle()

  if (error || !data?.operator_id) return fallback
  return resolveOperatorId(data.operator_id as string)
}
