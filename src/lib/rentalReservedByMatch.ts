export type RentalReservedByMember = {
  email: string
  displayName: string
  nickName?: string | null
  nameEn?: string | null
  nameKo?: string | null
}

export type RentalReservedByMatch = {
  email: string
  label: string
}

function normalizePersonName(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^a-z가-힣\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function memberSearchBlob(member: RentalReservedByMember): string {
  return normalizePersonName(
    [member.email, member.displayName, member.nickName, member.nameEn, member.nameKo]
      .filter(Boolean)
      .join(' '),
  )
}

/** 확인서 법적 성명 → 팀 닉네임 */
function canonicalStaffNick(normalizedDriverName: string): 'joey' | 'chad' | null {
  if (/wooyong|woo\s*yong|\bjoey\b/.test(normalizedDriverName)) return 'joey'
  if (/chulyong|chul\s*yong|\bchad\b/.test(normalizedDriverName)) return 'chad'
  return null
}

const FALLBACK_BY_NICK: Record<'joey' | 'chad', RentalReservedByMatch> = {
  joey: { email: 'wooyong.shim09@gmail.com', label: 'Joey' },
  chad: { email: 'lmtchad@gmail.com', label: 'Chad' },
}

function memberMatchesNick(member: RentalReservedByMember, nick: 'joey' | 'chad'): boolean {
  const blob = memberSearchBlob(member)
  const email = member.email.trim().toLowerCase()
  if (nick === 'joey') {
    return (
      /\bjoey\b/.test(blob) ||
      /wooyong/.test(blob) ||
      email === FALLBACK_BY_NICK.joey.email
    )
  }
  return (
    /\bchad\b/.test(blob) ||
    /chulyong/.test(blob) ||
    email === FALLBACK_BY_NICK.chad.email
  )
}

function memberMatchesFullName(member: RentalReservedByMember, normalizedDriverName: string): boolean {
  const candidates = [member.nameEn, member.displayName, member.nickName, member.nameKo]
    .map((value) => normalizePersonName(String(value || '')))
    .filter(Boolean)
  if (candidates.some((name) => name === normalizedDriverName)) return true
  const driverTokens = new Set(normalizedDriverName.split(' ').filter((token) => token.length > 1))
  return candidates.some((name) => {
    const tokens = name.split(' ').filter((token) => token.length > 1)
    return tokens.length >= 2 && tokens.every((token) => driverTokens.has(token))
  })
}

export function resolveRentalReservedBy(
  driverName: string | null | undefined,
  members: RentalReservedByMember[],
): RentalReservedByMatch | null {
  const normalized = normalizePersonName(String(driverName || ''))
  if (!normalized) return null

  const nick = canonicalStaffNick(normalized)
  if (nick) {
    const matched = members.find((member) => memberMatchesNick(member, nick))
    if (matched) {
      return {
        email: matched.email,
        label: matched.displayName || FALLBACK_BY_NICK[nick].label,
      }
    }
    return FALLBACK_BY_NICK[nick]
  }

  const byName = members.find((member) => memberMatchesFullName(member, normalized))
  if (!byName) return null
  return { email: byName.email, label: byName.displayName || byName.email }
}
