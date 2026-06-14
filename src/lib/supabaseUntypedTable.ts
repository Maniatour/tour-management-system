import type { SupabaseClient } from '@supabase/supabase-js'

/** `database.types.ts`에 아직 없는 테이블 — Supabase 쿼리용 */
export function fromUntypedTable(client: SupabaseClient, table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as SupabaseClient<any>).from(table)
}
