import { PRE_TOUR_CONTACT_SMS_PLACEHOLDER_HINT } from '@/lib/preTourContactSms'
import {
  GUIDE_SCHEDULE_CONFIRM_SMS_PLACEHOLDER_HINT,
} from '@/lib/guideScheduleConfirmSmsTemplate'
import { PICKUP_NOTIFICATION_SMS_PLACEHOLDER_HINT } from '@/lib/pickupNotificationSms'

export type AdminSmsDbTemplateKey = 'pickup_notification' | 'guide_schedule_confirm'

export type AdminSmsCategoryId =
  | 'pre_tour_contact'
  | AdminSmsDbTemplateKey
  | 'cancellation_follow_up'
  | 'cancellation_rebooking'
  | 'pending_alt_tour'
  | 'messenger_contacts'

export type AdminSmsCategoryDef = {
  id: AdminSmsCategoryId
  labelKo: string
  labelEn: string
  descriptionKo: string
  descriptionEn: string
  /** 단일 locale별 템플릿 (DB 또는 기존 API) */
  kind: 'locale_template' | 'staff_outreach' | 'messenger_contacts'
  locales?: readonly string[]
  placeholderHint?: string
  staffOutreachScope?: 'cancellation_follow_up' | 'pending_alt_tour'
  staffOutreachVariant?: string
}

export const ADMIN_SMS_CATEGORIES: readonly AdminSmsCategoryDef[] = [
  {
    id: 'pre_tour_contact',
    labelKo: '투어 사전 연락',
    labelEn: 'Pre-tour contact',
    descriptionKo: '예약 확정 전 고객에게 보내는 사전 연락 SMS',
    descriptionEn: 'Pre-tour contact SMS sent to guests before the tour',
    kind: 'locale_template',
    locales: ['ko', 'en'],
    placeholderHint: PRE_TOUR_CONTACT_SMS_PLACEHOLDER_HINT,
  },
  {
    id: 'pickup_notification',
    labelKo: '픽업 알림',
    labelEn: 'Pickup notification',
    descriptionKo: '픽업 시간·호텔 확정 안내 SMS',
    descriptionEn: 'Pickup time and hotel confirmation SMS',
    kind: 'locale_template',
    locales: ['ko', 'en'],
    placeholderHint: PICKUP_NOTIFICATION_SMS_PLACEHOLDER_HINT,
  },
  {
    id: 'guide_schedule_confirm',
    labelKo: '가이드 스케줄 컨펌',
    labelEn: 'Guide schedule confirm',
    descriptionKo: '가이드·어시스턴트에게 보내는 스케줄 확인 SMS',
    descriptionEn: 'Schedule confirmation SMS for guides and assistants',
    kind: 'locale_template',
    locales: ['ko', 'en'],
    placeholderHint: GUIDE_SCHEDULE_CONFIRM_SMS_PLACEHOLDER_HINT,
  },
  {
    id: 'cancellation_follow_up',
    labelKo: '취소 Follow-up',
    labelEn: 'Cancellation follow-up',
    descriptionKo: '예약 취소 후 고객 안내 SMS',
    descriptionEn: 'Post-cancellation guest SMS',
    kind: 'staff_outreach',
    staffOutreachScope: 'cancellation_follow_up',
    staffOutreachVariant: 'follow_up',
    placeholderHint:
      '{{CUSTOMER_NAME}}, {{PRODUCT_NAME}}, {{TOUR_DATE}}, {{CHANNEL_RN}}',
  },
  {
    id: 'cancellation_rebooking',
    labelKo: '취소 재예약',
    labelEn: 'Cancellation rebooking',
    descriptionKo: '취소 후 재예약 유도 SMS',
    descriptionEn: 'Rebooking outreach SMS after cancellation',
    kind: 'staff_outreach',
    staffOutreachScope: 'cancellation_follow_up',
    staffOutreachVariant: 'rebooking',
    placeholderHint:
      '{{CUSTOMER_NAME}}, {{PRODUCT_NAME}}, {{TOUR_DATE_LONG}}, {{CHANNEL_RN}}, {{COUPON_CODE}}, {{COUPON_VALID_UNTIL}}, {{REBOOKING_URL}}, {{PRICE_COMPARISON_PLAIN}}',
  },
  {
    id: 'pending_alt_tour',
    labelKo: 'Pending 대체 투어',
    labelEn: 'Pending alt tour',
    descriptionKo: '확정 전(pending) 예약 고객 연락 SMS',
    descriptionEn: 'SMS for guests with pending reservations',
    kind: 'staff_outreach',
    staffOutreachScope: 'pending_alt_tour',
    staffOutreachVariant: 'default',
    placeholderHint: '{{CUSTOMER_NAME}}, {{PRODUCT_NAME}}, {{TOUR_DATE}}, {{CHANNEL_RN}}',
  },
  {
    id: 'messenger_contacts',
    labelKo: '메신저 연락처',
    labelEn: 'Messenger contacts',
    descriptionKo: 'SMS 템플릿에 삽입되는 LINE / WhatsApp / Kakao / 이메일',
    descriptionEn: 'LINE, WhatsApp, Kakao, and email inserted into SMS templates',
    kind: 'messenger_contacts',
  },
] as const

export function getAdminSmsCategory(id: AdminSmsCategoryId): AdminSmsCategoryDef {
  const found = ADMIN_SMS_CATEGORIES.find((c) => c.id === id)
  if (!found) throw new Error(`Unknown admin SMS category: ${id}`)
  return found
}

export function isAdminSmsDbTemplateKey(
  categoryId: AdminSmsCategoryId
): categoryId is AdminSmsDbTemplateKey {
  return categoryId === 'pickup_notification' || categoryId === 'guide_schedule_confirm'
}
