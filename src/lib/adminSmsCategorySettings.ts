import {
  ADMIN_SMS_CATEGORIES,
  type AdminSmsCategoryDef,
  type AdminSmsCategoryId,
} from '@/lib/adminSmsTemplateCatalog'

export type AdminSmsCategorySettingsRow = {
  category_key: AdminSmsCategoryId
  label_ko: string
  label_en: string
  icon_key: string
  sort_order: number
  updated_at?: string
  updated_by?: string | null
}

export const DEFAULT_ADMIN_SMS_CATEGORY_SETTINGS: Record<
  AdminSmsCategoryId,
  Omit<AdminSmsCategorySettingsRow, 'updated_at' | 'updated_by'>
> = {
  pre_tour_contact: {
    category_key: 'pre_tour_contact',
    label_ko: '투어 사전 연락',
    label_en: 'Pre-tour contact',
    icon_key: 'smartphone',
    sort_order: 10,
  },
  pickup_notification: {
    category_key: 'pickup_notification',
    label_ko: '픽업 알림',
    label_en: 'Pickup notification',
    icon_key: 'bus',
    sort_order: 20,
  },
  guide_schedule_confirm: {
    category_key: 'guide_schedule_confirm',
    label_ko: '가이드 스케줄 컨펌',
    label_en: 'Guide schedule confirm',
    icon_key: 'calendar',
    sort_order: 30,
  },
  cancellation_follow_up: {
    category_key: 'cancellation_follow_up',
    label_ko: '취소 Follow-up',
    label_en: 'Cancellation follow-up',
    icon_key: 'message-square',
    sort_order: 40,
  },
  cancellation_rebooking: {
    category_key: 'cancellation_rebooking',
    label_ko: '취소 재예약',
    label_en: 'Cancellation rebooking',
    icon_key: 'rotate-ccw',
    sort_order: 50,
  },
  pending_alt_tour: {
    category_key: 'pending_alt_tour',
    label_ko: 'Pending 대체 투어',
    label_en: 'Pending alt tour',
    icon_key: 'clock',
    sort_order: 60,
  },
  messenger_contacts: {
    category_key: 'messenger_contacts',
    label_ko: '메신저 연락처',
    label_en: 'Messenger contacts',
    icon_key: 'messages-square',
    sort_order: 70,
  },
}

export function mergeAdminSmsCategorySettings(
  rows: AdminSmsCategorySettingsRow[]
): Record<AdminSmsCategoryId, AdminSmsCategorySettingsRow> {
  const map = { ...DEFAULT_ADMIN_SMS_CATEGORY_SETTINGS } as Record<
    AdminSmsCategoryId,
    AdminSmsCategorySettingsRow
  >
  for (const row of rows) {
    const key = row.category_key
    if (!(key in map)) continue
    map[key] = {
      ...map[key],
      ...row,
      label_ko: row.label_ko?.trim() || map[key].label_ko,
      label_en: row.label_en?.trim() || map[key].label_en,
      icon_key: row.icon_key?.trim() || map[key].icon_key,
    }
  }
  return map
}

export function resolveAdminSmsCategoryLabel(
  categoryId: AdminSmsCategoryId,
  settings: Record<AdminSmsCategoryId, AdminSmsCategorySettingsRow> | undefined,
  locale: string,
  fallback?: AdminSmsCategoryDef
): string {
  const cat = fallback ?? ADMIN_SMS_CATEGORIES.find((c) => c.id === categoryId)
  const row = settings?.[categoryId]
  if (locale.startsWith('ko')) {
    return row?.label_ko?.trim() || cat?.labelKo || categoryId
  }
  return row?.label_en?.trim() || cat?.labelEn || categoryId
}

export function resolveAdminSmsCategoryIconKey(
  categoryId: AdminSmsCategoryId,
  settings: Record<AdminSmsCategoryId, AdminSmsCategorySettingsRow> | undefined
): string {
  return settings?.[categoryId]?.icon_key?.trim() || DEFAULT_ADMIN_SMS_CATEGORY_SETTINGS[categoryId].icon_key
}

export function sortedAdminSmsCategories(
  settings?: Record<AdminSmsCategoryId, AdminSmsCategorySettingsRow>
): AdminSmsCategoryDef[] {
  return [...ADMIN_SMS_CATEGORIES].sort((a, b) => {
    const ao = settings?.[a.id]?.sort_order ?? DEFAULT_ADMIN_SMS_CATEGORY_SETTINGS[a.id].sort_order
    const bo = settings?.[b.id]?.sort_order ?? DEFAULT_ADMIN_SMS_CATEGORY_SETTINGS[b.id].sort_order
    return ao - bo
  })
}
