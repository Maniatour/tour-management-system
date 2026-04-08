/**
 * 투어 채팅: 직원 발신 표시명 (예: judy@maniatour.com + display_name → "maniatour - Judy")
 */

export function tourChatEmailDomainLabel(email: string): string {
  const trimmed = email.trim().toLowerCase()
  const at = trimmed.indexOf('@')
  if (at === -1) return 'staff'
  const host = trimmed.slice(at + 1).split(':')[0]
  const first = host.split('.')[0]
  return first || 'staff'
}

export function formatTourChatStaffDisplayName(
  email: string | null | undefined,
  team: { display_name?: string | null; name_ko?: string | null } | null | undefined
): string {
  if (!email?.trim()) {
    return (
      team?.display_name?.trim() ||
      team?.name_ko?.trim() ||
      'staff'
    )
  }
  const domain = tourChatEmailDomainLabel(email)
  const person =
    team?.display_name?.trim() ||
    team?.name_ko?.trim() ||
    email.split('@')[0]?.trim() ||
    'staff'
  return `${domain} - ${person}`
}
