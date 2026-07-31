import type { MessengerContactSettings } from '@/lib/preTourContactSms'
import { DEFAULT_MESSENGER_CONTACT_SETTINGS } from '@/lib/preTourContactSms'
import {
  applySmsDatePlaceholders,
  buildSmsDatePlaceholderValues,
  type SmsTemplateDateLocale,
} from '@/lib/smsTemplateDatePlaceholders'
import { formatPickupHotelSmsDisplay } from '@/utils/pickupHotelUtils'

export type PickupNotificationSmsLocale = 'ko' | 'en' | 'ja'

const BUILTIN_BODY: Record<PickupNotificationSmsLocale, string> = {
  ko: `[MANIA TOUR] {{CUSTOMER_NAME}}님,

{{PRODUCT_NAME}} 픽업 안내입니다.

🗓 투어: {{TOUR_DATE}}
🕒 픽업: {{PICKUP_DATE_TIME}}
📍 {{PICKUP_HOTEL}}

예약번호: {{CHANNEL_RN}}

문의:
LINE {{LINE_ID}}
WhatsApp +1{{WHATSAPP}}
KakaoTalk {{KAKAO}}

Reply STOP to opt out.`,
  en: `[MANIA TOUR] Hi {{CUSTOMER_NAME}},

Pickup info for {{PRODUCT_NAME}}.

🗓 Tour: {{TOUR_DATE}}
🕒 Pickup: {{PICKUP_DATE_TIME}}
📍 {{PICKUP_HOTEL}}

Ref: {{CHANNEL_RN}}

Contact:
LINE {{LINE_ID}}
WhatsApp +1{{WHATSAPP}}
KakaoTalk {{KAKAO}}

Reply STOP to opt out.`,
  ja: `[MANIA TOUR] {{CUSTOMER_NAME}}様

{{PRODUCT_NAME}} ピックアップのご案内です。

🗓 ツアー: {{TOUR_DATE}}
🕒 ピックアップ: {{PICKUP_DATE_TIME}}
📍 {{PICKUP_HOTEL}}

予約番号: {{CHANNEL_RN}}

お問い合わせ:
LINE {{LINE_ID}}
WhatsApp +1{{WHATSAPP}}
KakaoTalk {{KAKAO}}

Reply STOP to opt out.`,
}

export function getBuiltinPickupNotificationSmsTemplate(locale: PickupNotificationSmsLocale): string {
  return BUILTIN_BODY[locale]
}

export function parsePickupNotificationSmsLocale(v: string | null | undefined): PickupNotificationSmsLocale | null {
  if (v === 'ko' || v === 'en' || v === 'ja') return v
  return null
}

export const PICKUP_NOTIFICATION_SMS_PLACEHOLDER_HINT =
  '{{CUSTOMER_NAME}}, {{PRODUCT_NAME}}, {{TOUR_DATE}}, {{PICKUP_DATE}}, {{PICKUP_TIME}}, {{PICKUP_DATE_TIME}}, {{CHANNEL_RN}}, {{PICKUP_HOTEL}} (호텔명 - 픽업장소), {{PICKUP_LOCATION}}, {{LINE_ID}}, {{WHATSAPP}}, {{KAKAO}}'

export type SubstitutePickupNotificationSmsParams = {
  customerName: string
  productName: string
  tourDate: string | null | undefined
  channelReference: string | null | undefined
  pickupTime: string | null | undefined
  pickupHotelName: string | null | undefined
  pickupLocation?: string | null | undefined
  contacts?: MessengerContactSettings
  locale: PickupNotificationSmsLocale
}

export function substitutePickupNotificationSmsTemplate(
  bodyTpl: string,
  params: SubstitutePickupNotificationSmsParams
): string {
  const locale = params.locale
  const refPlain = params.channelReference?.trim() || (locale === 'ja' ? '—' : 'N/A')
  const namePlain =
    params.customerName?.trim() ||
    (locale === 'ja' ? 'お客様' : locale === 'en' ? 'Guest' : '고객')
  const productPlain =
    params.productName?.trim() ||
    (locale === 'ja' ? 'ツアー' : locale === 'en' ? 'Tour' : '투어')
  const pickupLocationPlain = params.pickupLocation?.trim() || '—'
  const pickupHotelPlain = formatPickupHotelSmsDisplay(
    params.pickupHotelName,
    params.pickupLocation
  )
  const contacts = params.contacts ?? DEFAULT_MESSENGER_CONTACT_SETTINGS
  const { line_id, whatsapp, kakao } = contacts
  const dateValues = buildSmsDatePlaceholderValues(
    params.tourDate,
    params.pickupTime,
    locale as SmsTemplateDateLocale
  )

  let result = bodyTpl
    .replace(/\{\{CUSTOMER_NAME\}\}/g, namePlain)
    .replace(/\{\{PRODUCT_NAME\}\}/g, productPlain)
    .replace(/\{\{CHANNEL_RN\}\}/g, refPlain)
    .replace(/\{\{PICKUP_HOTEL\}\}/g, pickupHotelPlain)
    .replace(/\{\{PICKUP_LOCATION\}\}/g, pickupLocationPlain)
    .replace(/\{\{LINE_ID\}\}/g, line_id)
    .replace(/\{\{WHATSAPP\}\}/g, whatsapp)
    .replace(/\{\{KAKAO\}\}/g, kakao)

  result = applySmsDatePlaceholders(result, dateValues)
  return result.trim()
}
