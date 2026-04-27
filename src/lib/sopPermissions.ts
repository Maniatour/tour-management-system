/** SOP 게시·스토리지 관리 권한 (팀 직책 + 슈퍼관리자 이메일) */

const SUPER_ADMIN_EMAILS = ['info@maniatour.com', 'wooyong.shim09@gmail.com'] as const

export function normalizeEmail(email: string | null | undefined): string {
  return (email || '').trim().toLowerCase()
}

export function canManageCompanySop(
  email: string | null | undefined,
  teamRow: { position?: string | null; is_active?: boolean | null } | null
): boolean {
  const e = normalizeEmail(email)
  if (e && (SUPER_ADMIN_EMAILS as readonly string[]).includes(e)) return true
  if (!teamRow?.is_active) return false
  const p = (teamRow.position || '').trim().toLowerCase()
  return p === 'super' || p === 'op' || p === 'office manager'
}
