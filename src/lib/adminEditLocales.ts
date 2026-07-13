import type { AdminProductCardEditSection } from '@/lib/adminProductCardEdit'
import type { ZoneEditConfig } from '@/lib/customerPageZoneEditMap'

export type AdminEditLocale = 'ko' | 'en'

export type AdminEditLocaleOption = {
  locale: AdminEditLocale
  countryCode: string
}

/** 추후 언어 추가 시 이 배열만 확장 */
export const ADMIN_EDIT_LOCALE_OPTIONS: readonly AdminEditLocaleOption[] = [
  { locale: 'ko', countryCode: 'KR' },
  { locale: 'en', countryCode: 'US' },
] as const

export function normalizeAdminEditLocale(value: string | null | undefined): AdminEditLocale {
  return value === 'en' ? 'en' : 'ko'
}

export function cardEditSectionSupportsLocaleSwitch(
  section: AdminProductCardEditSection | null
): boolean {
  return section === 'location' || section === 'basic'
}

export function zoneEditSupportsLocaleSwitch(config: ZoneEditConfig | undefined): boolean {
  if (!config) return false

  switch (config.editType) {
    case 'basic-fields':
    case 'detail-fields':
    case 'home-settings':
    case 'admin-tab':
    case 'field-picker':
      return true
    default:
      return false
  }
}
