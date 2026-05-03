/** AuthContext·스케줄 뷰 등과 동일 — 실제 로그인 계정 기준 슈퍼 관리자 */
export const SUPER_ADMIN_EMAILS = ['info@maniatour.com', 'wooyong.shim09@gmail.com'] as const;

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const n = email.trim().toLowerCase();
  return (SUPER_ADMIN_EMAILS as readonly string[]).includes(n);
}

/** 팀 `position === 'super'` 또는 슈퍼 관리자 이메일 */
export function isSuperAdminActor(
  email: string | null | undefined,
  teamPosition?: string | null
): boolean {
  if (isSuperAdminEmail(email)) return true;
  return (teamPosition ?? '').trim().toLowerCase() === 'super';
}
