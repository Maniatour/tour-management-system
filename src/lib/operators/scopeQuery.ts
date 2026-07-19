/**
 * Helpers for scoping admin catalog queries by active operator_id.
 * Public catalog uses getPublicOperatorId (Phase 5e.1).
 * Checkout stamps reservation.operator_id + Direct channel via
 * resolvePublicDirectChannel (Phase 5e.2). Do not use these helpers
 * blindly on customer booking paths.
 */
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'

/** Normalize active operator id (fallback Kovegas). */
export function resolveOperatorId(operatorId?: string | null): string {
  const id = (operatorId || '').trim()
  return id || KOVEgAS_OPERATOR_ID
}

/**
 * Apply .eq('operator_id', …) when the column exists on the table.
 * Generic T is preserved without a recursive `eq => T` constraint so Supabase
 * PostgREST builders do not hit "Type instantiation is excessively deep".
 */
export function withOperatorId<T>(query: T, operatorId?: string | null): T {
  return (query as { eq: (column: string, value: string) => T }).eq(
    'operator_id',
    resolveOperatorId(operatorId)
  )
}

/** Payload fragment for inserts. */
export function operatorIdInsert(operatorId?: string | null): { operator_id: string } {
  return { operator_id: resolveOperatorId(operatorId) }
}
