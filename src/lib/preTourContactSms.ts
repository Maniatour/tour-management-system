import type { PreTourContactSmsLocale } from '@/lib/preTourContactSmsLocale'
import {
  applySmsDatePlaceholders,
  buildSmsDatePlaceholderValues,
  type SmsTemplateDateLocale,
} from '@/lib/smsTemplateDatePlaceholders'
import { formatPickupHotelSmsDisplay } from '@/utils/pickupHotelUtils'

export type MessengerContactSettings = {
  line_id: string
  whatsapp: string
  kakao: string
  contact_email: string
}

export const DEFAULT_MESSENGER_CONTACT_SETTINGS: MessengerContactSettings = {
  line_id: process.env.SMS_CONTACT_LINE_ID?.trim() || 'maniatour',
  whatsapp: process.env.SMS_CONTACT_WHATSAPP?.trim() || '7024445531',
  kakao: process.env.SMS_CONTACT_KAKAO?.trim() || 'vegasmaniatour',
  contact_email: process.env.SMS_CONTACT_EMAIL?.trim() || 'vegasmanitour@gmail.com',
}

export type SubstitutePreTourContactSmsParams = {
  customerName: string
  productName: string
  tourDate: string | null | undefined
  channelReference: string | null | undefined
  pickupTime: string | null | undefined
  pickupHotelName: string | null | undefined
  pickupLocation?: string | null | undefined
  chatRoomUrl: string | null | undefined
  contacts: MessengerContactSettings
  locale: PreTourContactSmsLocale
}

const BUILTIN_BODY: Record<PreTourContactSmsLocale, string> = {
  ja: `【Maniatour】{{CUSTOMER_NAME}}様
{{TOUR_DATE}} {{PRODUCT_NAME}}のご案内です。(Ref {{CHANNEL_RN}})
事前連絡: LINE {{LINE_ID}} / WhatsApp +1{{WHATSAPP}} / Kakao {{KAKAO}}
Email: {{CONTACT_EMAIL}}
{{CHAT_ROOM_URL}}`,
  en: `[Maniatour] Hi {{CUSTOMER_NAME}}, pre-tour info for {{PRODUCT_NAME}} on {{TOUR_DATE}} (Ref {{CHANNEL_RN}}).
Contact: LINE {{LINE_ID}}, WhatsApp +1{{WHATSAPP}}, Kakao {{KAKAO}}, {{CONTACT_EMAIL}}
{{CHAT_ROOM_URL}}`,
  ko: `[마니아투어] {{CUSTOMER_NAME}}님, {{TOUR_DATE}} {{PRODUCT_NAME}} 투어 사전 안내입니다. (RN {{CHANNEL_RN}})
연락: LINE {{LINE_ID}} / WhatsApp +1{{WHATSAPP}} / Kakao {{KAKAO}} / {{CONTACT_EMAIL}}
{{CHAT_ROOM_URL}}`,
}

export function getBuiltinPreTourContactSmsTemplate(locale: PreTourContactSmsLocale): string {
  return BUILTIN_BODY[locale]
}

export function substitutePreTourContactSmsTemplate(
  bodyTpl: string,
  params: SubstitutePreTourContactSmsParams
): string {
  const locale = params.locale
  const refPlain = params.channelReference?.trim() || (locale === 'ja' ? '—' : 'N/A')
  const namePlain =
    params.customerName?.trim() ||
    (locale === 'ja' ? 'お客様' : locale === 'en' ? 'Guest' : '고객')
  const productPlain =
    params.productName?.trim() ||
    (locale === 'ja' ? 'ツアー' : locale === 'en' ? 'Tour' : '투어')
  const dateValues = buildSmsDatePlaceholderValues(
    params.tourDate,
    params.pickupTime,
    locale as SmsTemplateDateLocale
  )
  const pickupLocationPlain = params.pickupLocation?.trim() || ''
  const pickupHotelPlain = formatPickupHotelSmsDisplay(
    params.pickupHotelName,
    params.pickupLocation
  )
  const chatUrl = params.chatRoomUrl?.trim() || ''
  const chatLine =
    chatUrl.length > 0
      ? locale === 'ja'
        ? `Chat: ${chatUrl}`
        : locale === 'en'
          ? `Chat: ${chatUrl}`
          : `채팅: ${chatUrl}`
      : ''

  const { line_id, whatsapp, kakao, contact_email } = params.contacts

  let result = bodyTpl
    .replace(/\{\{CUSTOMER_NAME\}\}/g, namePlain)
    .replace(/\{\{PRODUCT_NAME\}\}/g, productPlain)
    .replace(/\{\{CHANNEL_RN\}\}/g, refPlain)
    .replace(/\{\{PICKUP_HOTEL\}\}/g, pickupHotelPlain)
    .replace(/\{\{PICKUP_LOCATION\}\}/g, pickupLocationPlain || '—')
    .replace(/\{\{LINE_ID\}\}/g, line_id)
    .replace(/\{\{WHATSAPP\}\}/g, whatsapp)
    .replace(/\{\{KAKAO\}\}/g, kakao)
    .replace(/\{\{CONTACT_EMAIL\}\}/g, contact_email)
    .replace(/\{\{CHAT_ROOM_URL\}\}/g, chatLine)

  result = applySmsDatePlaceholders(result, dateValues)
  return result.replace(/\n{3,}/g, '\n\n').trim()
}

export const PRE_TOUR_CONTACT_SMS_PLACEHOLDER_HINT =
  '{{CUSTOMER_NAME}}, {{PRODUCT_NAME}}, {{TOUR_DATE}}, {{PICKUP_DATE}}, {{PICKUP_TIME}}, {{PICKUP_DATE_TIME}}, {{CHANNEL_RN}}, {{PICKUP_HOTEL}} (호텔명 - 픽업장소), {{PICKUP_LOCATION}}, {{LINE_ID}}, {{WHATSAPP}}, {{KAKAO}}, {{CONTACT_EMAIL}}, {{CHAT_ROOM_URL}}'
