import parsePhoneNumber from 'libphonenumber-js'

/**
 * SMS 발송용 E.164 형식(+821012345678)으로 정규화합니다.
 * @returns E.164 문자열 또는 파싱 실패 시 null
 */
export function formatPhoneToE164(
  phone: string | null | undefined,
  defaultCountry?: string
): string | null {
  if (!phone || typeof phone !== 'string') return null
  const trimmed = phone.trim()
  if (!trimmed) return null

  try {
    const parsed = trimmed.startsWith('+')
      ? parsePhoneNumber(trimmed)
      : parsePhoneNumber(trimmed, (defaultCountry as 'US' | 'JP' | 'KR') || undefined)
    if (!parsed?.isValid()) return null
    return parsed.format('E.164')
  } catch {
    return null
  }
}

/** 고객 phone / emergency_contact 중 SMS 가능한 번호 선택 */
export function pickCustomerSmsPhone(
  phone: string | null | undefined,
  emergencyContact: string | null | undefined
): string | null {
  const primary = formatPhoneToE164(phone)
  if (primary) return primary
  return formatPhoneToE164(emergencyContact)
}
