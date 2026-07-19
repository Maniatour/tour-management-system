import type { AdminProductCardEditSection } from '@/lib/adminProductCardEdit'
import type { ZoneEditConfig } from '@/lib/customerPageZoneEditMap'
import {
  DEFAULT_ROUTING_LOCALE,
  SITE_LOCALES,
  getSiteLocaleMeta,
  isSiteLocale,
  type SiteLocale,
} from '@/lib/siteLocales'

/** Admin content edit locale — same set as customer site locales. */
export type AdminEditLocale = SiteLocale

export type AdminEditLocaleOption = {
  locale: AdminEditLocale
  countryCode: string
  label: string
}

/** 추후 언어 추가 시 SITE_LOCALES만 확장 */
export const ADMIN_EDIT_LOCALE_OPTIONS: readonly AdminEditLocaleOption[] = SITE_LOCALES.map(
  (item) => ({
    locale: item.code,
    countryCode: item.countryCode,
    label: item.label,
  })
)

export function normalizeAdminEditLocale(value: string | null | undefined): AdminEditLocale {
  return isSiteLocale(value) ? value : DEFAULT_ROUTING_LOCALE
}

export function getAdminEditLocaleLabel(locale: AdminEditLocale): string {
  return getSiteLocaleMeta(locale).label
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
