import type { AdminSmsCategoryId } from '@/lib/adminSmsTemplateCatalog'

/** SMS 카테고리별 아이콘 색상 (Tailwind text-* 클래스) */
export const ADMIN_SMS_CATEGORY_ICON_COLORS: Record<AdminSmsCategoryId, string> = {
  pre_tour_contact: 'text-violet-600',
  pickup_notification: 'text-blue-600',
  guide_schedule_assignment: 'text-violet-600',
  guide_schedule_confirm: 'text-indigo-600',
  cancellation_follow_up: 'text-orange-600',
  cancellation_rebooking: 'text-rose-600',
  pending_alt_tour: 'text-amber-600',
  messenger_contacts: 'text-teal-600',
}

export function resolveAdminSmsCategoryIconColor(categoryId: string): string {
  const key = categoryId as AdminSmsCategoryId
  return ADMIN_SMS_CATEGORY_ICON_COLORS[key] ?? 'text-gray-600'
}
