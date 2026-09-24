type SmsUiLocale = 'ko' | 'en'

const EXPLANATIONS: Record<string, { ko: string; en: string }> = {
  '30001': {
    ko: 'Twilio 발송 대기열이 가득 차 문자가 나가지 못했습니다. 잠시 뒤 다시 보내세요.',
    en: 'Twilio’s send queue was full. Wait a moment and try again.',
  },
  '30002': {
    ko: 'Twilio 계정이 정지되어 문자를 보낼 수 없습니다. Twilio 계정 상태를 확인하세요.',
    en: 'The Twilio account is suspended, so the message could not be sent.',
  },
  '30003': {
    ko: '손님 휴대폰이 꺼져 있거나 신호가 없어 문자를 받지 못했습니다. 전원을 켜고 신호가 있을 때 다시 보내세요.',
    en: 'The handset was off or had no signal. Retry when the phone can receive SMS.',
  },
  '30004': {
    ko: '통신사나 휴대폰이 이 문자를 차단했습니다. 스팸 차단, 수신 거부, 해외 문자 차단을 확인하세요.',
    en: 'The carrier or handset blocked this message. Check spam, opt-out, or international SMS blocks.',
  },
  '30005': {
    ko: '없거나 해지된 번호입니다. 손님 전화번호와 국가번호를 다시 확인하세요.',
    en: 'The number is unknown or no longer in service. Check the guest phone number and country code.',
  },
  '30006': {
    ko: '유선 전화이거나, 그 통신사는 문자를 받을 수 없습니다. 휴대전화 번호인지 확인하세요.',
    en: 'This is a landline, or that carrier cannot receive SMS. Confirm it is a mobile number.',
  },
  '30007': {
    ko: '스팸이나 정책 위반으로 걸러졌습니다. 같은 문구를 반복하거나 링크가 많은 안내 문자는 통신사가 막을 수 있습니다.',
    en: 'The carrier or Twilio filtered this message as spam or a policy violation. Repeated text and many links are often blocked.',
  },
  '30008': {
    ko: '통신사가 이유를 구체적으로 알려주지 않고 실패만 돌려준 경우입니다.\n\n• 손님 휴대폰이 꺼져 있거나, 신호가 없거나, 해외 로밍 중입니다.\n• 그 나라 통신사가 발신 번호나 해외 문자를 막습니다.\n• 같은 내용의 긴 문자(메신저 링크가 들어간 안내 문자)를 통신사가 걸러냅니다.\n• 통신사 경로가 잠깐 불안정합니다.',
    en: 'The carrier reported a failure without a specific reason.\n\n• The phone is off, has no signal, or is roaming.\n• That country’s carrier blocked the sender or international SMS.\n• A long, repeated message with messenger links was filtered.\n• The carrier route was briefly unstable.',
  },
  '30017': {
    ko: '통신사 망이 혼잡해 전달되지 않았습니다. 잠시 뒤 한 번만 다시 보내세요.',
    en: 'The carrier network was congested. Wait and retry once.',
  },
  '30019': {
    ko: '문자 내용이 통신사 길이 한도를 넘었습니다. 내용을 줄여 다시 보내세요.',
    en: 'The message is longer than the carrier allows. Shorten it and resend.',
  },
  '30032': {
    ko: '미국·캐나다 무료 수신 번호(Toll-Free) 인증이 없어 막혔습니다. Twilio에서 발신 번호 인증 상태를 확인하세요.',
    en: 'The US/Canada toll-free sender is not verified. Check that number’s verification in Twilio.',
  },
  '30034': {
    ko: '미국에 등록되지 않은 발신 번호라 통신사가 막았습니다. Twilio 발신 번호 등록을 확인하세요.',
    en: 'The US carrier blocked an unregistered sender. Check the Twilio sender registration.',
  },
  '21211': {
    ko: '전화번호 형식이 잘못되었습니다. 국가번호가 포함된 휴대전화 번호인지 확인하세요.',
    en: 'The phone number format is invalid. Include the country code and use a mobile number.',
  },
  '21408': {
    ko: '그 나라로 문자를 보내는 권한이 Twilio 계정에 없습니다. Twilio 지역 권한을 확인하세요.',
    en: 'This Twilio account is not allowed to send SMS to that country.',
  },
  '21610': {
    ko: '손님이 STOP으로 수신 거부한 번호입니다. 다시 보내도 전달되지 않습니다.',
    en: 'The guest opted out with STOP. Resending will not deliver.',
  },
  '21612': {
    ko: '이 번호로는 문자를 보낼 수 없습니다. 휴대전화 번호인지, 그 나라가 문자 수신이 되는지 확인하세요.',
    en: 'SMS cannot be delivered to this number. Confirm it is a mobile number that can receive texts.',
  },
  '21614': {
    ko: '휴대전화가 아닌 번호입니다. 문자 수신이 되는 휴대전화 번호로 바꾸세요.',
    en: 'This is not a mobile number. Use a number that can receive SMS.',
  },
  '21617': {
    ko: '문자가 너무 깁니다. 내용을 줄여 다시 보내세요.',
    en: 'The message is too long. Shorten it and resend.',
  },
}

export function extractSmsErrorCode(raw: string | null | undefined): string | null {
  if (!raw) return null
  const labeled = raw.match(/(?:error|오류)\s*[:#]?\s*(\d{4,6})/i)
  if (labeled?.[1]) return labeled[1]
  const bare = raw.match(/\b(\d{5})\b/)
  return bare?.[1] ?? null
}

export function explainSmsFailure(
  raw: string | null | undefined,
  locale: SmsUiLocale = 'ko'
): string {
  const code = extractSmsErrorCode(raw)
  const known = code ? EXPLANATIONS[code]?.[locale] : null
  if (known) return known

  const detail = raw?.trim()
  if (locale === 'en') {
    if (code) {
      return detail
        ? `Twilio error ${code}. The carrier or Twilio rejected the message.\n\n${detail}\n\nCheck the number, carrier blocking, and whether that country can receive SMS.`
        : `Twilio error ${code}. The carrier or Twilio rejected the message. Check the number, carrier blocking, and country permissions.`
    }
    return detail
      ? `Delivery failed.\n\n${detail}\n\nCheck the phone number, carrier blocking, and international sending limits.`
      : 'Delivery failed, and Twilio did not leave a detailed reason. Check the phone, number, and carrier blocking.'
  }

  if (code) {
    return detail
      ? `Twilio 오류 ${code}입니다. 통신사나 Twilio가 이 코드로 문자를 거절했습니다.\n\n${detail}\n\n번호, 통신사 차단, 그 나라 문자 수신 가능 여부를 확인하세요.`
      : `Twilio 오류 ${code}입니다. 통신사나 Twilio가 이 코드로 문자를 거절했습니다. 번호, 통신사 차단, 그 나라 문자 수신 가능 여부를 확인하세요.`
  }
  return detail
    ? `전달에 실패했습니다.\n\n${detail}\n\n번호, 통신사 차단, 해외 발송 한도를 확인하세요.`
    : '전달에 실패했지만 자세한 사유가 없습니다. 휴대폰 전원, 번호, 통신사 차단을 확인하세요.'
}
