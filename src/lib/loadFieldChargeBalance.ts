import type { SupabaseClient } from '@supabase/supabase-js'
import { roundFieldUsd } from '@/lib/fieldChargePayChoice'
import { loadReservationBalanceRows } from '@/lib/loadReservationBalanceRows'

export async function loadFieldChargeBalanceUsd(
  admin: SupabaseClient,
  reservationId: string
): Promise<{ balanceUsd: number; currency: string } | null> {
  const id = reservationId.trim()
  if (!id) return null
  const rows = await loadReservationBalanceRows([id], admin)
  const row = rows[0]
  if (!row) return null
  return {
    balanceUsd: roundFieldUsd(row.balanceAmount),
    currency: (row.currency || 'USD').toUpperCase(),
  }
}
