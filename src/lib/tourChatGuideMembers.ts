import { parseTourAssignmentEmails } from '@/utils/tourUtils'

export type ChatGuideMembershipSource = 'assignment' | 'invited'

export type ChatGuideParticipantRow = {
  id: string
  participant_id: string
  is_active: boolean | null
  membership_source?: string | null
}

export type TourChatGuideSyncPlan = {
  assignedEmails: string[]
  toInsert: string[]
  toReactivateIds: string[]
  toDeactivateIds: string[]
}

export function normalizeStaffEmail(raw: string | null | undefined): string {
  return String(raw ?? '').trim().toLowerCase()
}

export function assignedTourStaffEmails(
  tourGuideId: string | null | undefined,
  assistantId: string | null | undefined
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const email of [
    ...parseTourAssignmentEmails(tourGuideId),
    ...parseTourAssignmentEmails(assistantId),
  ]) {
    const key = normalizeStaffEmail(email)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(key)
  }
  return out
}

export function isAssignedChatGuide(
  participantEmail: string,
  assignedEmails: readonly string[]
): boolean {
  const key = normalizeStaffEmail(participantEmail)
  return assignedEmails.some((email) => normalizeStaffEmail(email) === key)
}

export function isInvitedMembershipSource(source: string | null | undefined): boolean {
  return String(source ?? '').trim().toLowerCase() === 'invited'
}

/**
 * 배정 동기화 계획.
 * - 현재 배정된 이메일은 추가/재활성화
 * - assignment 멤버 중 배정에서 빠진 사람만 비활성화
 * - invited 멤버는 배정이 바뀌어도 유지
 */
export function planTourChatGuideSync(args: {
  tourGuideId: string | null | undefined
  assistantId: string | null | undefined
  existing: ChatGuideParticipantRow[]
}): TourChatGuideSyncPlan {
  const assignedEmails = assignedTourStaffEmails(args.tourGuideId, args.assistantId)
  const assignedSet = new Set(assignedEmails)
  const existingByEmail = new Map<string, ChatGuideParticipantRow>()

  for (const row of args.existing) {
    const key = normalizeStaffEmail(row.participant_id)
    if (!key) continue
    const prev = existingByEmail.get(key)
    if (!prev) {
      existingByEmail.set(key, row)
      continue
    }
    const prevActive = prev.is_active !== false
    const nextActive = row.is_active !== false
    if (nextActive && !prevActive) existingByEmail.set(key, row)
  }

  const toInsert: string[] = []
  const toReactivateIds: string[] = []
  const toDeactivateIds: string[] = []

  for (const email of assignedEmails) {
    const existing = existingByEmail.get(email)
    if (!existing) {
      toInsert.push(email)
      continue
    }
    if (existing.is_active === false) {
      toReactivateIds.push(existing.id)
    }
  }

  for (const [email, row] of existingByEmail) {
    if (assignedSet.has(email)) continue
    if (isInvitedMembershipSource(row.membership_source)) continue
    if (row.is_active === false) continue
    toDeactivateIds.push(row.id)
  }

  return { assignedEmails, toInsert, toReactivateIds, toDeactivateIds }
}

export function canRemoveTourChatGuide(args: {
  participantEmail: string
  membershipSource?: string | null
  assignedEmails: readonly string[]
}): boolean {
  if (isInvitedMembershipSource(args.membershipSource)) return true
  return !isAssignedChatGuide(args.participantEmail, args.assignedEmails)
}

export function isGuideOrDriverTeamPosition(position: string | null | undefined): boolean {
  const value = String(position ?? '').toLowerCase()
  return (
    value.includes('guide') ||
    value.includes('가이드') ||
    value.includes('driver') ||
    value.includes('드라이버') ||
    value.includes('운전')
  )
}
