/** Latin letters plus common legal-name punctuation. Rejects Hangul, Han, Kana, etc. */
const ENGLISH_LEGAL_NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿĀ-ž][A-Za-zÀ-ÖØ-öø-ÿĀ-ž .'\-]*$/
const HANGUL_RE = /[\uAC00-\uD7A3]/

export function hasHangul(value: string): boolean {
  return HANGUL_RE.test(value)
}

export function isEnglishLegalName(value: string): boolean {
  const name = value.trim().replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 200) return false
  if (!ENGLISH_LEGAL_NAME_RE.test(name)) return false
  const letters = name.replace(/[^A-Za-zÀ-ÖØ-öø-ÿĀ-ž]/g, '')
  return letters.length >= 2
}
