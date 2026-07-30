import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { SUPER_ADMIN_EMAILS } from '@/lib/superAdmin'

type TeamSuperRow = {
  email: string
  name_ko: string | null
  position: string | null
  is_active: boolean | null
}

export async function fetchSuperAdminRecipients(
  client: SupabaseClient<Database>
): Promise<Array<{ email: string; name: string | null }>> {
  const { data: teamRows } = await client
    .from('team')
    .select('email, name_ko, position, is_active')

  const byEmail = new Map<string, { email: string; name: string | null }>()

  for (const email of SUPER_ADMIN_EMAILS) {
    byEmail.set(email.toLowerCase(), { email, name: null })
  }

  for (const row of (teamRows ?? []) as TeamSuperRow[]) {
    const email = (row.email ?? '').trim().toLowerCase()
    if (!email) continue
    const isSuper =
      (row.position ?? '').trim().toLowerCase() === 'super' ||
      SUPER_ADMIN_EMAILS.some((e) => e.toLowerCase() === email)
    const active = row.is_active !== false
    if (isSuper && active) {
      byEmail.set(email, { email: row.email, name: row.name_ko ?? null })
    }
  }

  return Array.from(byEmail.values())
}
