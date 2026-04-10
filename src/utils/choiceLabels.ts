/** 앤텔롭 캐년 옵션명을 🏜️ L / 🏜️ X / 🏜️ U 뱃지 텍스트로 축약 (예약 카드·투어 카드 공통) */
const ANTLOPE_EMOJI = '🏜️'

export function simplifyChoiceLabel(label: string): string {
  if (!label) return label
  const labelLower = label.toLowerCase().trim()
  const labelKo = label.trim()

  // 엑스 앤텔롭 캐년 (Antelope X Canyon) → 🏜️ X
  if (
    labelLower.includes('antelope x canyon') ||
    /\bantelope\s+x\b/i.test(labelLower) ||
    /엑스\s*앤텔롭|엑스\s*앤틸롭|엑스\s*엔텔롭/.test(labelKo) ||
    /앤텔롭\s*x|앤텔로프\s*x/i.test(labelKo)
  ) {
    return `${ANTLOPE_EMOJI} X`
  }
  // 로어 앤텔롭 캐년 (Lower Antelope Canyon) → 🏜️ L
  if (labelLower.includes('lower antelope canyon') || /로어\s*앤텔롭|로어\s*앤틸롭|로어\s*엔텔롭/.test(labelKo)) {
    return `${ANTLOPE_EMOJI} L`
  }
  // 어퍼 앤텔롭 (Upper Antelope Canyon) → 🏜️ U
  if (labelLower.includes('upper antelope canyon') || /어퍼\s*앤텔롭|어퍼\s*앤틸롭|어퍼\s*엔텔롭/.test(labelKo)) {
    return `${ANTLOPE_EMOJI} U`
  }
  return label
}
