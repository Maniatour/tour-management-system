import { supabase } from '@/lib/supabase'

export type TeamMemberNameFields = {
  nick_name?: string | null
  name_ko?: string | null
  name_en?: string | null
  display_name?: string | null
}

function trimName(value: string | null | undefined): string {
  return String(value || '').trim()
}

function hasHangul(value: string): boolean {
  return /[\uAC00-\uD7A3]/.test(value)
}

/**
 * 로케일별 팀원 표시명.
 * - en: name_en 우선. 한글 nick_name이 영문 이름을 덮지 않음.
 * - ko: nick_name → name_ko → name_en
 */
export function teamMemberNameForLocale(
  member: TeamMemberNameFields | null | undefined,
  locale: string
): string | null {
  if (!member) return null

  const nick = trimName(member.nick_name)
  const nameKo = trimName(member.name_ko)
  const nameEn = trimName(member.name_en)
  const display = trimName(member.display_name)

  if (locale === 'en' || locale.startsWith('en')) {
    if (nameEn) return nameEn
    if (display && !hasHangul(display)) return display
    if (nick && !hasHangul(nick)) return nick
    if (display) return display
    if (nick) return nick
    return nameKo || null
  }

  return nick || nameKo || nameEn || display || null
}

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
