import parsePhoneNumber from 'libphonenumber-js'
import type { MessengerContactSettings } from '@/lib/preTourContactSms'

/** 미국·캐나다는 Twilio 전화번호로 보내 회신을 받을 수 있다. twilioClient와 같은 기준. */
function destinationUsesPhoneNumberSender(toE164: string): boolean {
  const trimmed = toE164.trim()
  if (!trimmed.startsWith('+')) return false
  try {
    const parsed = parsePhoneNumber(trimmed)
    if (parsed?.country === 'US' || parsed?.country === 'CA') return true
  } catch {
    /* fall through */
  }
  return trimmed.startsWith('+1')
}

/** 미국·캐나다가 아니면 알파벳 발신(Maniatour)이라 문자 회신을 받을 수 없다. */
export function isOneWaySmsDestination(toE164: string | null | undefined): boolean {
  const phone = toE164?.trim() ?? ''
  if (!phone.startsWith('+')) return false
  return !destinationUsesPhoneNumberSender(phone)
}

export function formatSmsContactChannels(contacts: MessengerContactSettings): string {
  const line = contacts.line_id.trim()
  const whatsapp = contacts.whatsapp.trim()
  const kakao = contacts.kakao.trim()
  const email = contacts.contact_email.trim()
  const whatsappLabel = !whatsapp
    ? ''
    : whatsapp.startsWith('+')
      ? whatsapp
      : `+1${whatsapp}`

  return [
    line ? `LINE ${line}` : '',
    whatsappLabel ? `WhatsApp ${whatsappLabel}` : '',
    kakao ? `Kakao ${kakao}` : '',
    email,
  ]
    .filter(Boolean)
    .join(' / ')
}

function contactSentence(locale: string, channels: string): string {
  if (locale === 'ko') return `문의: ${channels}`
  if (locale === 'ja') return `お問い合わせ: ${channels}`
  return `Questions? ${channels}`
}

function pendingSentence(locale: string, channels: string): string {
  if (locale === 'ko') {
    return `확정·날짜변경·투어변경·취소는 ${channels} 로 알려 주세요.`
  }
  if (locale === 'ja') {
    return `確定・日程変更・ツアー変更・キャンセルは ${channels} までご連絡ください。`
  }
  return `To confirm, change the date, switch tours, or cancel, contact ${channels}.`
}

const STOP_LINE = /(?:^|\n)[ \t]*Reply STOP to opt out\.?[ \t]*$/i

/**
 * 회신을 받을 수 없는 발신으로 나가는 문자에서, 회신 안내만 연락처 안내로 바꾼다.
 * 연락처가 이미 본문에 있으면 Reply STOP 줄만 뺀다.
 */
export function applyOneWaySmsContactGuidance(
  message: string,
  locale: string,
  contacts: MessengerContactSettings
): string {
  const channels = formatSmsContactChannels(contacts)
  if (!channels) return message

  let next = message
    .replaceAll('Questions? Reply here.', contactSentence(locale, channels))
    .replaceAll('문의는 본 문자 회신 부탁드립니다.', contactSentence(locale, channels))
    .replaceAll(
      'Please reply: confirm, change date, switch tour, or cancel.',
      pendingSentence(locale, channels)
    )
    .replaceAll(
      '확정/날짜변경/투어변경/취소 중 회신 부탁드립니다.',
      pendingSentence(locale, channels)
    )

  if (/Reply STOP to opt out\.?/i.test(next)) {
    const alreadyHasContact = /LINE |WhatsApp |Kakao |@/.test(next)
    next = alreadyHasContact
      ? next.replace(STOP_LINE, '')
      : next.replace(/Reply STOP to opt out\.?/i, contactSentence(locale, channels))
  }

  return next.replace(/\n{3,}/g, '\n\n').trim()
}
