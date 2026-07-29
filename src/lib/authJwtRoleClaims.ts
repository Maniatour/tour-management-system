import type { UserRole } from '@/lib/roles'

const VALID_ROLES = new Set<UserRole>(['customer', 'team_member', 'admin', 'manager'])

export type JwtTeamClaims = {
  email: string
  teamRole: UserRole
  teamPosition: string | null
  teamNameKo: string | null
}

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    if (typeof atob === 'undefined') return null
    const json = atob(padded)
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

function asUserRole(value: unknown): UserRole | null {
  if (typeof value !== 'string') return null
  const role = value.trim().toLowerCase() as UserRole
  return VALID_ROLES.has(role) ? role : null
}

export function readTeamClaimsFromAccessToken(token: string): JwtTeamClaims | null {
  const payload = parseJwtPayload(token)
  if (!payload) return null

  const email =
    typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
  const teamRole = asUserRole(payload.team_role)
  if (!email || !teamRole) return null

  return {
    email,
    teamRole,
    teamPosition:
      typeof payload.team_position === 'string' ? payload.team_position : null,
    teamNameKo: typeof payload.team_name_ko === 'string' ? payload.team_name_ko : null,
  }
}

export function isStaffTeamRole(role: UserRole): boolean {
  return role !== 'customer'
}
