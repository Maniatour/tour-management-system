import { resolveSiteAccessPersona } from '@/lib/site-access-persona'
import type { UserRole } from '@/lib/roles'
import { isSuperAdminActor } from '@/lib/superAdmin'

export type StaffCredentialVaultCategory = 'ota' | 'email' | 'payment' | 'social' | 'other'

export type StaffCredentialVaultAccessAction =
  | 'reveal_password'
  | 'copy_password'
  | 'create'
  | 'update'
  | 'delete'
  | 'archive'
  | 'restore'

export type StaffCredentialVaultRow = {
  id: string
  site_name: string
  site_url: string | null
  category: StaffCredentialVaultCategory
  login_id: string
  notes: string | null
  created_by_email: string
  created_by_name: string | null
  updated_by_email: string | null
  updated_by_name: string | null
  created_at: string
  updated_at: string
  is_archived: boolean
}

export type StaffCredentialVaultListItem = StaffCredentialVaultRow & {
  has_password: boolean
}

export type StaffCredentialVaultAccessLogRow = {
  id: string
  credential_id: string
  accessor_email: string
  accessor_name: string | null
  accessor_position: string | null
  action: StaffCredentialVaultAccessAction
  accessed_at: string
  ip_address: string | null
  user_agent: string | null
}

export const STAFF_CREDENTIAL_VAULT_CATEGORIES: ReadonlyArray<{
  id: StaffCredentialVaultCategory
  labelKo: string
  labelEn: string
}> = [
  { id: 'ota', labelKo: 'OTA', labelEn: 'OTA' },
  { id: 'email', labelKo: '이메일', labelEn: 'Email' },
  { id: 'payment', labelKo: '결제', labelEn: 'Payment' },
  { id: 'social', labelKo: 'SNS', labelEn: 'Social' },
  { id: 'other', labelKo: '기타', labelEn: 'Other' },
]

export function credentialVaultCategoryLabel(
  category: StaffCredentialVaultCategory,
  locale: string
): string {
  const row = STAFF_CREDENTIAL_VAULT_CATEGORIES.find((item) => item.id === category)
  if (!row) return category
  return locale === 'ko' ? row.labelKo : row.labelEn
}

export function credentialVaultAccessActionLabel(
  action: StaffCredentialVaultAccessAction,
  locale: string
): string {
  const isKo = locale === 'ko'
  switch (action) {
    case 'reveal_password':
      return isKo ? '비밀번호 열람' : 'Password revealed'
    case 'copy_password':
      return isKo ? '비밀번호 복사' : 'Password copied'
    case 'create':
      return isKo ? '등록' : 'Created'
    case 'update':
      return isKo ? '수정' : 'Updated'
    case 'delete':
      return isKo ? '삭제' : 'Deleted'
    case 'archive':
      return isKo ? '보관' : 'Archived'
    case 'restore':
      return isKo ? '복구' : 'Restored'
    default:
      return action
  }
}

/** Super / Office Manager / Manager — OP 제외 */
export function canAccessStaffCredentialVault(ctx: {
  userRole: UserRole | null
  userPosition: string | null
  authUserEmail: string | null | undefined
}): boolean {
  const persona = resolveSiteAccessPersona({
    userRole: ctx.userRole,
    userPosition: ctx.userPosition,
    isSuper: isSuperAdminActor(ctx.authUserEmail, ctx.userPosition),
    authUserEmail: ctx.authUserEmail,
  })
  return persona === 'office_manager' || persona === 'super'
}

export type StaffCredentialVaultFormPayload = {
  siteName: string
  siteUrl?: string
  category: StaffCredentialVaultCategory
  loginId: string
  password?: string
  notes?: string
}

const VALID_CATEGORIES = new Set<StaffCredentialVaultCategory>([
  'ota',
  'email',
  'payment',
  'social',
  'other',
])

export function parseStaffCredentialVaultCategory(
  value: unknown
): StaffCredentialVaultCategory | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase() as StaffCredentialVaultCategory
  return VALID_CATEGORIES.has(normalized) ? normalized : null
}
