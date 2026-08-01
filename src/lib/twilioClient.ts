import parsePhoneNumber, { type CountryCode } from 'libphonenumber-js'
import twilio from 'twilio'

const COUNTRY_LABEL_KO: Partial<Record<CountryCode, string>> = {
  JP: '일본',
  KR: '한국',
  US: '미국',
  CA: '캐나다',
  GB: '영국',
  AU: '호주',
  CN: '중국',
  TW: '대만',
  HK: '홍콩',
  SG: '싱가포르',
  TH: '태국',
  VN: '베트남',
  DE: '독일',
  FR: '프랑스',
  MX: '멕시코',
}

function countryLabelKo(toE164: string): string {
  try {
    const parsed = parsePhoneNumber(toE164.trim())
    if (parsed?.country) {
      return COUNTRY_LABEL_KO[parsed.country] ?? parsed.country
    }
  } catch {
    /* fall through */
  }
  return '해당 국가'
}

/** Twilio API 오류를 운영자가 이해하기 쉬운 한국어 메시지로 변환 */
export function formatTwilioSmsError(msg: string, toE164: string): string {
  const lower = msg.toLowerCase()

  if (
    lower.includes('permission to send an sms has not been enabled') ||
    lower.includes('geo-permissions') ||
    lower.includes('geo permissions')
  ) {
    const country = countryLabelKo(toE164)
    return (
      `${country}(${toE164}) 번호로 SMS 발송 권한이 Twilio 계정에 활성화되어 있지 않습니다. ` +
      'Twilio 콘솔 → Messaging → Settings → Geo permissions에서 해당 국가를 허용한 뒤 다시 시도하세요.'
    )
  }

  if (
    msg.includes('current combination') &&
    msg.includes('From') &&
    twilioDestinationRequiresPhoneNumberFrom(toE164)
  ) {
    return (
      '미국·캐나다 번호 발송 실패: TWILIO_SMS_FROM_NUMBER에 Twilio 전화번호(+1...)를 설정하세요. ' +
      '알파벳 발신 ID는 일본 등 해외 번호에만 사용됩니다. (Twilio: ' +
      msg +
      ')'
    )
  }

  return msg
}

export function getTwilioConfig(): {
  accountSid: string
  authToken: string
  /** 국제(일본 등) — 알파벳 Sender ID. 미국·캐나다에서는 사용 불가 */
  alphanumericFrom: string
  /** 미국·캐나다(+1) — Twilio 구매 번호 E.164 (+1...) */
  fromNumber: string | null
  messagingServiceSid: string | null
} | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  if (!accountSid || !authToken) return null

  const fromNumber =
    process.env.TWILIO_SMS_FROM_NUMBER?.trim() ||
    process.env.TWILIO_PHONE_NUMBER?.trim() ||
    null

  // E.164(+...) 형식이면 전화번호, 아니면 알파벳 Sender ID
  const rawFrom = process.env.TWILIO_SMS_FROM?.trim() || 'Maniatour'
  const alphanumericFrom = rawFrom.startsWith('+') ? 'Maniatour' : rawFrom
  const resolvedFromNumber = rawFrom.startsWith('+') ? rawFrom : fromNumber

  return {
    accountSid,
    authToken,
    alphanumericFrom,
    fromNumber: resolvedFromNumber,
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID?.trim() || null,
  }
}

/** 미국·캐나다는 알파벳 Sender ID 미지원 → Twilio 전화번호 필요 */
export function twilioDestinationRequiresPhoneNumberFrom(toE164: string): boolean {
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

export function resolveTwilioSmsFrom(
  toE164: string,
  config: NonNullable<ReturnType<typeof getTwilioConfig>>
): { from?: string; messagingServiceSid?: string; error?: string } {
  if (config.messagingServiceSid) {
    return { messagingServiceSid: config.messagingServiceSid }
  }

  if (twilioDestinationRequiresPhoneNumberFrom(toE164)) {
    if (!config.fromNumber) {
      return {
        error:
          '미국·캐나다(+1) 번호로는 알파벳 발신 ID(Maniatour)를 사용할 수 없습니다. ' +
          'Twilio 콘솔에서 구매한 번호를 .env에 TWILIO_SMS_FROM_NUMBER=+1XXXXXXXXXX 로 설정하거나, ' +
          'Messaging Service(TWILIO_MESSAGING_SERVICE_SID)를 사용하세요.',
      }
    }
    return { from: config.fromNumber }
  }

  return { from: config.alphanumericFrom }
}

export function resolveTwilioStatusCallbackUrl(): string | null {
  const explicit = process.env.TWILIO_SMS_STATUS_CALLBACK_URL?.trim()
  if (explicit) return explicit

  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)

  if (!base) return null
  return `${base.replace(/\/$/, '')}/api/webhooks/twilio/sms-status`
}

export async function sendTwilioSms(
  toE164: string,
  body: string
): Promise<{ sid: string } | { error: string }> {
  const config = getTwilioConfig()
  if (!config) {
    return {
      error:
        'Twilio 설정 오류: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN 환경 변수를 확인하세요.',
    }
  }

  const fromResolved = resolveTwilioSmsFrom(toE164, config)
  if (fromResolved.error) {
    return { error: fromResolved.error }
  }

  try {
    const client = twilio(config.accountSid, config.authToken)
    const statusCallback = resolveTwilioStatusCallbackUrl()

    const createParams: {
      to: string
      body: string
      from?: string
      messagingServiceSid?: string
      statusCallback?: string
    } = {
      to: toE164,
      body,
    }

    if (statusCallback) {
      createParams.statusCallback = statusCallback
    }

    if (fromResolved.messagingServiceSid) {
      createParams.messagingServiceSid = fromResolved.messagingServiceSid
    } else if (fromResolved.from) {
      createParams.from = fromResolved.from
    } else {
      return { error: 'TWILIO_SMS_FROM 또는 TWILIO_MESSAGING_SERVICE_SID가 필요합니다.' }
    }

    const message = await client.messages.create(createParams)
    return { sid: message.sid }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[sendTwilioSms]', { to: toE164, msg })
    return { error: formatTwilioSmsError(msg, toE164) }
  }
}
