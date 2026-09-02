import { resolveSiteAccessPersona } from '@/lib/site-access-persona'
import type { UserRole } from '@/lib/roles'
import { isSuperAdminActor } from '@/lib/superAdmin'

/** 발송 대상 그룹 키 (team.position 매칭용) */
export type StaffSiteAlertTargetGroup =
  | 'guide'
  | 'driver'
  | 'op'
  | 'office_manager'
  | 'office_staff'

export const STAFF_SITE_ALERT_TARGET_GROUPS: ReadonlyArray<{
  id: StaffSiteAlertTargetGroup
  labelKo: string
  labelEn: string
}> = [
  { id: 'guide', labelKo: '가이드', labelEn: 'Guide' },
  { id: 'driver', labelKo: '드라이버', labelEn: 'Driver' },
  { id: 'op', labelKo: 'OP', labelEn: 'OP' },
  { id: 'office_manager', labelKo: 'Office Manager', labelEn: 'Office Manager' },
  { id: 'office_staff', labelKo: '사무직', labelEn: 'Office Staff' },
]

export type StaffSiteAlertRow = {
  id: string
  title_ko: string
  title_en: string
  body_ko: string
  body_en: string
  target_positions: string[]
  target_individuals?: string[]
  linked_hub_article_ids?: string[]
  requires_signature: boolean
  sent_as_super: boolean
  sent_by_email: string
  sent_by_name: string | null
  display_sender_name: string
  created_at: string
}

export type StaffSiteAlertRecipientRow = {
  id: string
  alert_id: string
  recipient_email: string
  recipient_user_id: string | null
  recipient_position: string | null
  acknowledged_at: string | null
  signature_text: string | null
  signed_at: string | null
  created_at: string
}

export type StaffSiteAlertRecipientMode = 'group' | 'individual'

export type StaffSiteAlertSenderProxy = 'joey_shim' | 'judy'

export const STAFF_SITE_ALERT_PROXY_SENDERS: Record<
  StaffSiteAlertSenderProxy,
  { email: string; displayNameKo: string; displayNameEn: string }
> = {
  joey_shim: {
    email: 'wooyong.shim09@gmail.com',
    displayNameKo: 'Joey Shim',
    displayNameEn: 'Joey Shim',
  },
  judy: {
    email: 'maniaoffice1@gmail.com',
    displayNameKo: 'Judy',
    displayNameEn: 'Judy',
  },
}

export type StaffSiteAlertSendPayload = {
  titleKo: string
  titleEn: string
  bodyKo: string
  bodyEn: string
  recipientMode: StaffSiteAlertRecipientMode
  targetGroups: StaffSiteAlertTargetGroup[]
  targetIndividuals: string[]
  linkedHubArticleIds?: string[]
  requiresSignature: boolean
  /** @deprecated use senderProxy */
  sendAsSuper?: boolean
  senderProxy?: StaffSiteAlertSenderProxy | null
  locale?: string
}

export type StaffSiteAlertTeamMember = {
  email: string
  name_ko: string | null
  position: string | null
  is_active: boolean | null
}

/** 팀보드·team.position 탭 정렬용 (실 DB 값 기준) */
export function normalizeTeamBoardPosition(position: string | null | undefined): string {
  const normalized = (position || '').trim().toLowerCase()
  if (!normalized) return ''
  if (
    normalized === 'office manager' ||
    normalized === 'office_manager' ||
    normalized === 'manager' ||
    normalized === '매니저'
  ) {
    return 'office manager'
  }
  if (normalized === 'super' || normalized === 'admin') return 'super'
  if (normalized === 'tour guide' || normalized === 'guide' || normalized === 'tourguide') {
    return 'tour guide'
  }
  if (normalized === 'driver') return 'driver'
  if (normalized === 'office' || normalized === 'op') return 'op'
  return normalized
}

export const STAFF_SITE_ALERT_POSITION_TABS: ReadonlyArray<{
  id: string
  labelKo: string
  labelEn: string
}> = [
  { id: 'tour guide', labelKo: '가이드', labelEn: 'Guide' },
  { id: 'driver', labelKo: '드라이버', labelEn: 'Driver' },
  { id: 'op', labelKo: 'OP', labelEn: 'OP' },
  { id: 'office manager', labelKo: '매니저', labelEn: 'Manager' },
  { id: 'super', labelKo: '슈퍼', labelEn: 'Super' },
]

export function normalizeTeamPositionKey(position: string | null | undefined): string {
  return (position || '').trim().toLowerCase()
}

export function teamPositionMatchesTargetGroup(
  position: string | null | undefined,
  group: StaffSiteAlertTargetGroup
): boolean {
  const pos = normalizeTeamPositionKey(position)
  if (!pos) return false

  switch (group) {
    case 'guide':
      return (
        pos === 'guide' ||
        pos === 'tour guide' ||
        pos === 'tourguide' ||
        (pos.includes('tour') && pos.includes('guide'))
      )
    case 'driver':
      return pos === 'driver' || pos.includes('driver')
    case 'op':
      return pos === 'op'
    case 'office_manager':
      return pos === 'office manager' || pos === 'manager' || pos === '매니저' || pos.includes('manager')
    case 'office_staff':
      return (
        pos === 'office' ||
        (pos.includes('office') && !pos.includes('manager')) ||
        pos.includes('reservation') ||
        pos.includes('cs') ||
        pos.includes('accounting')
      )
    default:
      return false
  }
}

export function canSendStaffSiteAlert(ctx: {
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
  return persona === 'op' || persona === 'office_manager' || persona === 'super'
}

export function canUseSendAsJoeyShimOption(ctx: {
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
  return persona === 'op' || persona === 'office_manager' || persona === 'super'
}

/** OP만 Office Manager(Judy) 명의 발송 가능 */
export function canUseSendAsJudyOption(ctx: {
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
  return persona === 'op'
}

/** @deprecated use canUseSendAsJoeyShimOption */
export function canUseSendAsSuperOption(ctx: {
  userRole: UserRole | null
  userPosition: string | null
  authUserEmail: string | null | undefined
}): boolean {
  return canUseSendAsJoeyShimOption(ctx)
}

export function parseStaffSiteAlertSenderProxy(
  body: Pick<StaffSiteAlertSendPayload, 'senderProxy' | 'sendAsSuper'>
): StaffSiteAlertSenderProxy | null {
  if (body.senderProxy === 'joey_shim' || body.senderProxy === 'judy') {
    return body.senderProxy
  }
  if (body.sendAsSuper) return 'joey_shim'
  return null
}

export function staffSiteAlertDisplaySenderName(
  senderProxy: StaffSiteAlertSenderProxy | null,
  actualName: string | null | undefined,
  locale: string
): string {
  if (senderProxy === 'joey_shim') {
    return locale.startsWith('ko')
      ? STAFF_SITE_ALERT_PROXY_SENDERS.joey_shim.displayNameKo
      : STAFF_SITE_ALERT_PROXY_SENDERS.joey_shim.displayNameEn
  }
  if (senderProxy === 'judy') {
    return locale.startsWith('ko')
      ? STAFF_SITE_ALERT_PROXY_SENDERS.judy.displayNameKo
      : STAFF_SITE_ALERT_PROXY_SENDERS.judy.displayNameEn
  }
  return (actualName || '').trim() || 'Admin'
}

export function staffSiteAlertSentAsSuperFlag(senderProxy: StaffSiteAlertSenderProxy | null): boolean {
  return senderProxy === 'joey_shim'
}

export function staffSiteAlertLocalizedTitle(alert: StaffSiteAlertRow, locale: string): string {
  if (locale.startsWith('ko')) return alert.title_ko
  const en = (alert.title_en || '').trim()
  return en || alert.title_ko
}

export function staffSiteAlertLocalizedBody(alert: StaffSiteAlertRow, locale: string): string {
  if (locale.startsWith('ko')) return alert.body_ko
  const en = (alert.body_en || '').trim()
  return en || alert.body_ko
}

export function staffSiteAlertTargetGroupLabel(group: string, locale: string): string {
  const found = STAFF_SITE_ALERT_TARGET_GROUPS.find((g) => g.id === group)
  if (!found) return group
  return locale.startsWith('ko') ? found.labelKo : found.labelEn
}

export function staffSiteAlertTargetSummary(alert: StaffSiteAlertRow, locale: string): string {
  const individuals = alert.target_individuals || []
  if (individuals.length > 0) {
    return locale.startsWith('ko') ? `개별 ${individuals.length}명` : `${individuals.length} selected`
  }
  const groups = alert.target_positions || []
  if (groups.length === 0) return locale.startsWith('ko') ? '대상 없음' : 'No targets'
  return groups.map((g) => staffSiteAlertTargetGroupLabel(g, locale)).join(', ')
}

/** 원격 DB에 staff_site_alerts 마이그레이션 미적용 시 PostgREST PGRST205 */
export function isStaffSiteAlertSchemaMissingError(
  error: { code?: string | null; message?: string | null } | null | undefined
): boolean {
  if (!error) return false
  if (error.code === 'PGRST205') return true
  const msg = String(error.message ?? '')
  return /staff_site_alert/i.test(msg) && /schema cache|could not find the table/i.test(msg)
}

/** 수기 PNG(data URL) 또는 이미지 URL. 예전 텍스트 이름 서명과 구분. */
export function isDrawnSignatureValue(value: string | null | undefined): boolean {
  if (!value) return false
  const v = value.trim()
  return v.startsWith('data:image/') || /^https?:\/\//i.test(v)
}
