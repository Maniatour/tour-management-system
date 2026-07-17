/** 앤텔롭·거주 구분 등 옵션명을 카드 뱃지용 짧은 라벨로 축약 (예약 카드·투어 카드 공통) */
const ANTLOPE_EMOJI = '🏜️'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** option_id / option_key 가 UUID 인 경우 표시용 이름 아님 */
export function isChoiceOptionUuid(value: string | null | undefined): boolean {
  if (value == null) return false
  return UUID_RE.test(String(value).trim())
}

/**
 * 표시용 초이스 라벨 축약.
 * @param label option_name_ko / option_name / option_key
 * @param optionKey stable key (lower_antelope, antelope_x 등) — 이름보다 우선
 * @param internalName 관리자가 설정한 내부용 짧은 이름 (예: 🏜️ X) — 최우선
 */
export function simplifyChoiceLabel(
  label: string,
  optionKey?: string | null,
  internalName?: string | null
): string {
  const internal = internalName != null ? String(internalName).trim() : ''
  if (internal) return internal

  const keyRaw = optionKey != null ? String(optionKey).trim() : ''
  const key =
    keyRaw && !isChoiceOptionUuid(keyRaw) ? keyRaw.toLowerCase() : ''

  if (key === 'antelope_x' || key === 'x' || key === 'antelope x') {
    return `${ANTLOPE_EMOJI} X`
  }
  if (key === 'lower_antelope' || key === 'l' || key === 'lower antelope') {
    return `${ANTLOPE_EMOJI} L`
  }
  if (key === 'upper_antelope' || key === 'u' || key === 'upper antelope') {
    return `${ANTLOPE_EMOJI} U`
  }

  const effective =
    label && !isChoiceOptionUuid(label)
      ? label.trim()
      : key
        ? keyRaw
        : ''
  if (!effective) return ''

  const labelLower = effective.toLowerCase().trim()
  const labelKo = effective.trim()

  // 엑스 앤텔롭 캐년 (Antelope X Canyon) → 🏜️ X
  if (
    labelLower.includes('antelope x canyon') ||
    /\bantelope\s+x\b/i.test(labelLower) ||
    /\bx\s*canyon\b/i.test(labelLower) ||
    labelLower.includes('antelope x') ||
    /엑스\s*앤텔롭|엑스\s*앤틸롭|엑스\s*엔텔롭/.test(labelKo) ||
    /앤텔롭\s*x|앤텔로프\s*x/i.test(labelKo)
  ) {
    return `${ANTLOPE_EMOJI} X`
  }
  // 로어 앤텔롭 캐년 (Lower Antelope Canyon) → 🏜️ L
  if (
    labelLower.includes('lower antelope canyon') ||
    labelLower.includes('lower antelope') ||
    labelLower.includes('lower_antelope') ||
    /로어\s*앤텔롭|로어\s*앤틸롭|로어\s*엔텔롭/.test(labelKo)
  ) {
    return `${ANTLOPE_EMOJI} L`
  }
  // 어퍼 앤텔롭 (Upper Antelope Canyon) → 🏜️ U
  if (
    labelLower.includes('upper antelope canyon') ||
    labelLower.includes('upper antelope') ||
    labelLower.includes('upper_antelope') ||
    /어퍼\s*앤텔롭|어퍼\s*앤틸롭|어퍼\s*엔텔롭/.test(labelKo)
  ) {
    return `${ANTLOPE_EMOJI} U`
  }

  // 거주 구분 · 기타 입장료 — 짧은 뱃지
  const blob = `${labelKo} ${labelLower}`
  if (/패스\s*구매|패스구매|purchase.*pass|buy.*pass/i.test(blob)) {
    return '패스구매'
  }
  if (/패스\s*보유|패스보유|with.*pass|has.*pass/i.test(blob)) {
    return '패스보유'
  }
  if (/미성년|16\s*세|under\s*16|minor/i.test(blob)) {
    return '16세미만'
  }
  if (/비\s*거주|비거주|non[-\s]?resident/i.test(blob)) {
    return '비거주자'
  }
  if (
    (/미국/.test(labelKo) && /거주/.test(labelKo) && !/비/.test(labelKo)) ||
    /\bus\s*resident\b/i.test(labelLower) ||
    labelKo === '거주자' ||
    labelLower === 'resident'
  ) {
    return '거주자'
  }

  return effective
}
