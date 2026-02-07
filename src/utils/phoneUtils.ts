import parsePhoneNumber from 'libphonenumber-js'

/**
 * 전화번호 문자열에서 국가 코드(ISO 3166-1 alpha-2, 예: 'KR', 'US')를 추출합니다.
 * 국제 형식(+82, +1 등)이 포함된 번호에서만 추출 가능합니다.
 * @param phone - 전화번호 (예: '+82 10 1234 5678', '82-10-1234-5678', '010-1234-5678'은 국가 불명)
 * @returns 국가 코드(2자) 또는 파싱 실패 시 undefined
 */
export function getCountryFromPhone(phone: string): string | undefined {
  if (!phone || typeof phone !== 'string') return undefined
  const trimmed = phone.trim()
  if (!trimmed) return undefined

  // 숫자와 +, 공백, 하이픈만 남기고 정규화
  let normalized = trimmed.replace(/[\s\-\.()]/g, '')
  if (!normalized) return undefined

  // +가 없고 숫자로 시작하면 국제 접두사로 간주하고 + 붙여서 시도
  if (!normalized.startsWith('+') && /^\d+$/.test(normalized)) {
    normalized = '+' + normalized
  }
  if (!normalized.startsWith('+')) return undefined

  try {
    const parsed = parsePhoneNumber(normalized)
    return parsed?.country
  } catch {
    return undefined
  }
}
