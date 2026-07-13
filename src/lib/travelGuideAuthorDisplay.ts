import { supabaseAdmin } from '@/lib/supabase'

type TeamAuthorRow = {
  email: string
  display_name: string | null
  nick_name: string | null
  name_ko: string | null
  name_en: string | null
}

function pickTeamDisplayName(row: TeamAuthorRow, locale: string): string {
  const isKo = locale === 'ko'
  const label = isKo
    ? row.display_name?.trim() ||
      row.nick_name?.trim() ||
      row.name_ko?.trim() ||
      row.name_en?.trim()
    : row.display_name?.trim() ||
      row.name_en?.trim() ||
      row.nick_name?.trim() ||
      row.name_ko?.trim()

  if (label) return label
  const localPart = row.email.split('@')[0]?.trim()
  return localPart || 'Staff'
}

export async function resolveTravelGuideAuthorNames(
  userIds: Array<string | null | undefined>,
  locale: string
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  const uniqueIds = [...new Set(userIds.filter((id): id is string => Boolean(id?.trim())))]
  const admin = supabaseAdmin
  if (!uniqueIds.length || !admin) return result

  const emailByUserId = new Map<string, string>()

  await Promise.all(
    uniqueIds.map(async (userId) => {
      try {
        const { data, error } = await admin.auth.admin.getUserById(userId)
        const email = data.user?.email?.trim().toLowerCase()
        if (!error && email) {
          emailByUserId.set(userId, email)
        }
      } catch (lookupError) {
        console.error('[travelGuideAuthorDisplay] getUserById failed', lookupError)
      }
    })
  )

  const emails = [...new Set(emailByUserId.values())]
  if (!emails.length) return result

  const { data: teamRows, error: teamError } = await admin
    .from('team')
    .select('email, display_name, nick_name, name_ko, name_en')

  if (teamError) {
    console.error('[travelGuideAuthorDisplay] team lookup failed', teamError.message)
  }

  const teamByEmail = new Map<string, TeamAuthorRow>()
  for (const row of (teamRows ?? []) as TeamAuthorRow[]) {
    teamByEmail.set(row.email.trim().toLowerCase(), row)
  }

  for (const [userId, email] of emailByUserId) {
    const team = teamByEmail.get(email)
    result.set(userId, team ? pickTeamDisplayName(team, locale) : email.split('@')[0] || 'Staff')
  }

  return result
}

export function formatTravelGuideDisplayDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(iso))
  } catch {
    return iso.slice(0, 10)
  }
}
