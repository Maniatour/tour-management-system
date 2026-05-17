import { supabase } from '@/lib/supabase'

/** team.email → display_name (없으면 name_ko, name_en 순) */
export async function fetchTeamMemberDisplayName(email: string): Promise<string | null> {
  const em = String(email || '').trim()
  if (!em || !em.includes('@')) return null

  const { data, error } = await supabase
    .from('team')
    .select('display_name, name_ko, name_en')
    .ilike('email', em)
    .limit(1)
    .maybeSingle()

  if (error || !data) return null

  const row = data as {
    display_name?: string | null
    name_ko?: string | null
    name_en?: string | null
  }
  const label = String(row.display_name || row.name_ko || row.name_en || '').trim()
  return label || null
}
