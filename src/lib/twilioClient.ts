import twilio from 'twilio'

export function getTwilioConfig(): {
  accountSid: string
  authToken: string
  from: string | null
  messagingServiceSid: string | null
} | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  if (!accountSid || !authToken) return null

  return {
    accountSid,
    authToken,
    from: process.env.TWILIO_SMS_FROM?.trim() || 'Maniatour',
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID?.trim() || null,
  }
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

  try {
    const client = twilio(config.accountSid, config.authToken)
    const createParams: {
      to: string
      body: string
      from?: string
      messagingServiceSid?: string
    } = {
      to: toE164,
      body,
    }

    if (config.messagingServiceSid) {
      createParams.messagingServiceSid = config.messagingServiceSid
    } else if (config.from) {
      createParams.from = config.from
    } else {
      return { error: 'TWILIO_SMS_FROM 또는 TWILIO_MESSAGING_SERVICE_SID가 필요합니다.' }
    }

    const message = await client.messages.create(createParams)
    return { sid: message.sid }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[sendTwilioSms]', msg)
    return { error: msg }
  }
}
