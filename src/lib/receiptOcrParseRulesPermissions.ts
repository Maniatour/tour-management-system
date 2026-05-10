/** 관리자 OCR 파싱 규칙 저장 권한 — ReceiptOcrParseRulesAdmin 과 동일 */
export const RECEIPT_OCR_PARSE_RULES_SAVE_EMAILS = [
  'info@maniatour.com',
  'wooyong.shim09@gmail.com',
] as const

export function canSaveReceiptOcrParseRules(identity: {
  userPosition: string | null | undefined
  email: string | null | undefined
}): boolean {
  const pos = String(identity.userPosition ?? '')
  if (pos === 'super' || pos === 'admin') return true
  const em = (identity.email ?? '').trim().toLowerCase()
  return (RECEIPT_OCR_PARSE_RULES_SAVE_EMAILS as readonly string[]).includes(em)
}
