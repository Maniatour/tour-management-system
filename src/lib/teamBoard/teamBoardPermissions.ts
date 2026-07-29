import type { TeamBoardAnnouncement, TeamBoardTask } from '@/lib/teamBoard/workTypes'
import { normalizeTeamPosition } from '@/lib/teamBoard/taskPresentation'

const SUPER_ADMIN_EMAILS = ['info@maniatour.com', 'wooyong.shim09@gmail.com']

export function hasTeamBoardAdminPermission(
  permissions?: string[] | Record<string, boolean> | null
): boolean {
  if (!permissions) return false
  if (Array.isArray(permissions)) {
    return permissions.includes('canViewAdmin') || permissions.includes('canManageTeam')
  }
  return !!(permissions.canViewAdmin || permissions.canManageTeam)
}

export function isTeamBoardAdminUser(input: {
  email?: string | null | undefined
  userRole?: string | null
  userPosition?: string | null
  permissions?: string[] | Record<string, boolean> | null | undefined
}): boolean {
  const normalizedPosition = normalizeTeamPosition(input.userPosition)
  const isAdminByRole = input.userRole === 'admin'
  const isAdminByPosition = ['admin', 'manager'].includes(normalizedPosition)
  const isSuperAdminByEmail =
    !!input.email && SUPER_ADMIN_EMAILS.includes(input.email.toLowerCase())
  return (
    isSuperAdminByEmail ||
    isAdminByRole ||
    isAdminByPosition ||
    hasTeamBoardAdminPermission(input.permissions)
  )
}

export function canEditTeamBoardTask(
  task: TeamBoardTask,
  authEmail: string | null | undefined,
  isAdminUser: boolean
): boolean {
  if (!authEmail) return false
  const email = authEmail.toLowerCase()
  return (
    isAdminUser ||
    (task.created_by || '').toLowerCase() === email ||
    (task.assigned_to != null && task.assigned_to.toLowerCase() === email)
  )
}

export function canEditTeamBoardAnnouncement(
  announcement: TeamBoardAnnouncement,
  authEmail: string | null | undefined,
  isAdminUser: boolean
): boolean {
  if (!authEmail) return false
  return authEmail === announcement.created_by || isAdminUser
}

export function isAnnouncementFullyAcked(
  announcement: TeamBoardAnnouncement,
  ackEmails: string[]
): boolean {
  const recipients = announcement.recipients || []
  if (recipients.length === 0) return ackEmails.length > 0
  return recipients.every((email) =>
    ackEmails.some((ack) => (ack || '').toLowerCase() === (email || '').toLowerCase())
  )
}

export function isAnnouncementUnackedForUser(
  announcement: TeamBoardAnnouncement,
  ackEmails: string[],
  userEmail: string | null | undefined
): boolean {
  if (!userEmail) return false
  const recipients = announcement.recipients || []
  if (recipients.length === 0) {
    return !ackEmails.some((ack) => ack.toLowerCase() === userEmail.toLowerCase())
  }
  const isRecipient = recipients.some((email) => email.toLowerCase() === userEmail.toLowerCase())
  if (!isRecipient) return false
  return !ackEmails.some((ack) => ack.toLowerCase() === userEmail.toLowerCase())
}
