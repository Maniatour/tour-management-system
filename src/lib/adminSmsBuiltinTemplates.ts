import type { AdminSmsCategoryId } from '@/lib/adminSmsTemplateCatalog'
import { getBuiltinPreTourContactSmsTemplate } from '@/lib/preTourContactSms'
import type { PreTourContactSmsLocale } from '@/lib/preTourContactSmsLocale'
import { getBuiltinPickupNotificationSmsTemplate } from '@/lib/pickupNotificationSms'
import { getBuiltinGuideScheduleConfirmSmsTemplate } from '@/lib/guideScheduleConfirmSmsTemplate'
import type { SupportedLocale } from '@/lib/guideLanguageDetection'

export function getBuiltinAdminSmsLocaleTemplate(
  categoryId: AdminSmsCategoryId,
  locale: string
): string {
  if (categoryId === 'pre_tour_contact') {
    const loc = locale as PreTourContactSmsLocale
    if (loc === 'ko' || loc === 'en' || loc === 'ja') {
      return getBuiltinPreTourContactSmsTemplate(loc)
    }
    return ''
  }
  if (categoryId === 'pickup_notification') {
    if (locale === 'ko' || locale === 'en' || locale === 'ja') {
      return getBuiltinPickupNotificationSmsTemplate(locale)
    }
    return ''
  }
  if (categoryId === 'guide_schedule_confirm') {
    if (locale === 'ko' || locale === 'en' || locale === 'ja' || locale === 'zh') {
      return getBuiltinGuideScheduleConfirmSmsTemplate(locale as SupportedLocale)
    }
    return ''
  }
  return ''
}
