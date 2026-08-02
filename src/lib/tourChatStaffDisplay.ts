/**
 * 투어 채팅: 직원 발신 표시명 — "Judy (MANIATOUR)" 형식
 * team 테이블에는 display_name 없음 → name_en / nick_name / display_name / name_ko 순으로 후보 사용.
 */

export const TOUR_CHAT_STAFF_ORG_LABEL = 'MANIATOUR'

export type TourChatStaffTeamFields = {
  /** 과거 코드·별칭용 (DB에 없으면 생략) */
  display_name?: string | null
  nick_name?: string | null
  name_ko?: string | null
  name_en?: string | null
}

function resolveTourChatPersonName(team: TourChatStaffTeamFields | null | undefined): string | undefined {
  const s =
    team?.name_en?.trim() ||
    team?.nick_name?.trim() ||
    team?.display_name?.trim() ||
    team?.name_ko?.trim()
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
  const personName = email?.trim()
    ? resolveTourChatPersonName(team) ||
      email.split('@')[0]?.trim() ||
      'staff'
    : resolveTourChatPersonName(team) || 'staff'

  return `${personName} (${TOUR_CHAT_STAFF_ORG_LABEL})`
}
