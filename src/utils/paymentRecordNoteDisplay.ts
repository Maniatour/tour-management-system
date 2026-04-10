import type { SupabaseClient } from '@supabase/supabase-js'

/** 과거 배정 카드·API에서 쓰이던 고정 문구 (표시 시 team.display_name으로 치환) */
export const LEGACY_BALANCE_NOTE_ADMIN = 'Balance 수령 (관리자)'

function emailKey(email: string) {
  return email.trim().toLowerCase()
}

/** team.display_name만 사용 (없으면 null) */
export async function fetchTeamDisplayNameByEmail(
  supabase: SupabaseClient,
  email: string | null | undefined
): Promise<string | null> {
  if (!email?.trim()) return null
  const { data } = await supabase
    .from('team')
    .select('display_name')
    .eq('email', email.trim())
    .maybeSingle()
  const dn = (data as { display_name?: string | null } | null)?.display_name?.trim()
  return dn || null
}

export async function fetchTeamDisplayNameMap(
  supabase: SupabaseClient,
  emails: string[]
): Promise<Record<string, string>> {
  const raw = [...new Set(emails.filter(Boolean).map((e) => e.trim()))]
  if (raw.length === 0) return {}
  const { data, error } = await supabase.from('team').select('email, display_name').in('email', raw)
  if (error || !data) return {}
  const map: Record<string, string> = {}
  for (const row of data as { email: string; display_name?: string | null }[]) {
    const dn = row.display_name?.trim()
    if (row.email && dn) {
      map[emailKey(row.email)] = dn
    }
  }
  return map
}

export function displayPaymentRecordNote(
  note: string | undefined,
  submitBy: string | undefined,
  teamDisplayByEmail: Record<string, string>
): string | undefined {
  if (!note) return note
  if (note === LEGACY_BALANCE_NOTE_ADMIN && submitBy) {
    const dn = teamDisplayByEmail[emailKey(submitBy)]
    if (dn) return `Balance 수령 (${dn})`
  }
  return note
}
