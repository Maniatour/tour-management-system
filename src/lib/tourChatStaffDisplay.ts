/**
 * 투어 채팅: 직원 발신 표시명 (예: judy@maniatour.com + 이름 → "maniatour - Judy")
 * team 테이블에는 display_name 없음 → nick_name / name_ko / name_en 순으로 후보 사용.
 */

export type TourChatStaffTeamFields = {
  /** 과거 코드·별칭용 (DB에 없으면 생략) */
  display_name?: string | null
  nick_name?: string | null
  name_ko?: string | null
  name_en?: string | null
}

function resolveTourChatPersonName(team: TourChatStaffTeamFields | null | undefined): string | undefined {
  const s =
    team?.display_name?.trim() ||
    team?.nick_name?.trim() ||
    team?.name_ko?.trim() ||
    team?.name_en?.trim()
  return s || undefined
}

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
  team: TourChatStaffTeamFields | null | undefined
): string {
  if (!email?.trim()) {
    return resolveTourChatPersonName(team) || 'staff'
  }
  const domain = tourChatEmailDomainLabel(email)
  const person =
    resolveTourChatPersonName(team) ||
    email.split('@')[0]?.trim() ||
    'staff'
  return `${domain} - ${person}`
}
