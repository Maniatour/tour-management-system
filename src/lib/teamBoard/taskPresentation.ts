import type { TeamBoardAnnouncement, TeamBoardMember, TeamBoardTask } from '@/lib/teamBoard/workTypes'

export const POSITION_OPTIONS = [
  { value: 'manager', label: '매니저' },
  { value: 'admin', label: '관리자' },
  { value: 'tour guide', label: '가이드' },
  { value: 'op', label: 'OP' },
  { value: 'driver', label: '드라이버' },
] as const

const TASK_PRIORITY_BORDER: Record<TeamBoardTask['priority'], string> = {
  low: 'border-gray-300',
  medium: 'border-blue-400',
  high: 'border-orange-400',
  urgent: 'border-red-500 border-2',
}

const TASK_PRIORITY_BADGE: Record<TeamBoardTask['priority'], { label: string; className: string }> = {
  low: { label: '낮음', className: 'bg-gray-100 text-gray-600' },
  medium: { label: '보통', className: 'bg-primary/10 text-primary' },
  high: { label: '높음', className: 'bg-orange-100 text-orange-700' },
  urgent: { label: '긴급', className: 'bg-red-600 text-white' },
}

export function normalizeTeamPosition(position: string | null | undefined): string {
  const normalized = (position || '').trim().toLowerCase()
  if (!normalized) return ''
  if (normalized === 'office manager' || normalized === 'office_manager' || normalized === 'manager' || normalized === '매니저') {
    return 'manager'
  }
  if (normalized === 'super' || normalized === 'admin') return 'admin'
  if (normalized === 'tour guide' || normalized === 'guide') return 'tour guide'
  if (normalized === 'office' || normalized === 'op') return 'op'
  if (normalized === 'driver') return 'driver'
  return normalized
}

export function getTeamMemberDisplayName(
  email: string | null | undefined,
  members: TeamBoardMember[]
): string {
  if (!email) return '작성자'
  const member = members.find((m) => (m.email || '').toLowerCase() === email.toLowerCase())
  return member?.name_ko || email.split('@')[0]
}

export function getPositionLabel(value: string): string {
  return (
    POSITION_OPTIONS.find(
      (p) => p.value === value || normalizeTeamPosition(p.value) === normalizeTeamPosition(value)
    )?.label ?? value
  )
}

export function getTaskPriorityBorderClass(priority: TeamBoardTask['priority']): string {
  return TASK_PRIORITY_BORDER[priority] ?? TASK_PRIORITY_BORDER.medium
}

export function getTaskPriorityBadge(priority: TeamBoardTask['priority']): {
  label: string
  className: string
} {
  return TASK_PRIORITY_BADGE[priority] ?? TASK_PRIORITY_BADGE.medium
}

export function taskStatusLabel(status: TeamBoardTask['status'], isKo: boolean): string {
  if (status === 'pending') return isKo ? '대기' : 'Pending'
  if (status === 'in_progress') return isKo ? '진행중' : 'In progress'
  if (status === 'completed') return isKo ? '완료' : 'Done'
  return isKo ? '취소' : 'Cancelled'
}

export function announcementPriorityClass(priority: TeamBoardAnnouncement['priority']): string {
  if (priority === 'urgent') return 'bg-red-600 text-white'
  if (priority === 'high') return 'bg-red-100 text-red-700'
  if (priority === 'low') return 'bg-gray-100 text-gray-600'
  return 'bg-gray-100 text-gray-600'
}