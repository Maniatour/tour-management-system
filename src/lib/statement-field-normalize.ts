/**
 * 명세 CSV import / 매칭용 적요·가맹점 정규화.
 * WellsFargo raw(`date:… | descriptions:FOO`)와 ACH 수취인 패턴을 처리한다.
 */

import { formatStatementLineDescription } from '@/lib/statement-display'

const RAW_PIPE_HINT = /(?:^|\|)\s*date\s*:/i
const DESCRIPTIONS_HINT = /descriptions?\s*:/i

/** ACH·이체 적요에서 수취인/상대방 추정 */
export function extractAchPayee(description: string): string | null {
  const s = String(description ?? '').replace(/\s+/g, ' ').trim()
  if (!s) return null

  const patterns: RegExp[] = [
    /\bACH\s+(?:CREDIT|DEBIT|PAYMENT|PMT)?\s*(.+)$/i,
    /\bACH\s+(.+)$/i,
    /\b(?:WIRE|WIRES)\s+(?:TO|FROM)?\s*(.+)$/i,
    /\bZELLE\s+(?:TO|FROM|PAYMENT(?:\s+TO|\s+FROM)?)\s*(.+)$/i,
    /\bVENMO\s+(?:TO|FROM|PAYMENT)?\s*(.+)$/i,
    /\bBUSINESS\s+TO\s+BUSINESS\s+ACH(?:\s+A(?:CH)?)?\s*(.*)$/i,
    /\bBILL\s+PAY(?:MENT)?\s+(?:TO\s+)?(.+)$/i,
    /\bPAYMENT\s+TO\s+(.+)$/i,
    /\bTO\s+([A-Za-z가-힣][A-Za-z가-힣0-9 .,'&-]{2,60})$/i,
  ]

  for (const re of patterns) {
    const m = s.match(re)
    if (!m?.[1]) continue
    let payee = m[1].trim()
    // 참조번호·꼬리 제거
    payee = payee
      .replace(/\s+ON\s+\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b.*$/i, '')
      .replace(/\s+REF\s*#.*$/i, '')
      .replace(/\s+#?\d{5,}\s*$/g, '')
      .replace(/\s+REF[:\s].*$/i, '')
      .replace(/\s+TRACE[:\s].*$/i, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
    if (payee.length >= 3 && !/^(A|ACH|CREDIT|DEBIT|PAYMENT|PMT)$/i.test(payee)) {
      return payee.slice(0, 80)
    }
  }
  return null
}

/**
 * 카드/가맹점 적요 앞부분에서 merchant 후보 (도시·주 코드 앞까지).
 */
export function guessMerchantLabelFromDescription(description: string): string | null {
  const s = String(description ?? '').replace(/\s+/g, ' ').trim()
  if (!s || s.length < 3) return null
  // 이미 ACH면 extractAchPayee 우선
  const ach = extractAchPayee(s)
  if (ach) return ach

  // "NAME CITY ST" 또는 공백 패딩된 카드 적요
  let t = s
    .replace(/\s+[A-Z]{2}\s*(?:USA)?\s*$/i, '')
    .trim()
  if (t.length > 48) {
    const cut = t.slice(0, 48)
    const sp = cut.lastIndexOf(' ')
    t = (sp >= 10 ? cut.slice(0, sp) : cut).trim()
  }
  if (t.length < 3) return null
  return t
}

export type NormalizedStatementFields = {
  description: string
  merchant: string | null
  /** import 전 raw가 파이프/키값 형태였는지 */
  wasRawPipeFormat: boolean
}

/**
 * CSV 파싱·기존 줄 백필용 — description/merchant를 사람이 읽는 형태로 정리.
 * raw 원문은 호출측에서 `raw` JSON에 유지할 수 있다.
 */
export function normalizeImportedStatementFields(
  description: string | null | undefined,
  merchant: string | null | undefined
): NormalizedStatementFields {
  const rawDesc = String(description ?? '').trim()
  const rawMer = merchant == null ? null : String(merchant).trim() || null
  const wasRawPipeFormat = Boolean(
    rawDesc && (RAW_PIPE_HINT.test(rawDesc) || (DESCRIPTIONS_HINT.test(rawDesc) && rawDesc.includes('|')))
  )

  const readable = formatStatementLineDescription(rawDesc || null, rawMer)
  const cleanDesc =
    readable && readable !== '—'
      ? readable
      : rawDesc || '(no description)'

  let cleanMer = rawMer
  if (!cleanMer) {
    cleanMer = extractAchPayee(cleanDesc) || guessMerchantLabelFromDescription(cleanDesc)
  }

  // merchant가 description과 동일하면 중복 저장 방지(짧은 경우만 유지)
  if (cleanMer && cleanMer.toLowerCase() === cleanDesc.toLowerCase() && cleanDesc.length > 40) {
    cleanMer = cleanMer.slice(0, 40).trim()
  }

  return {
    description: cleanDesc || '(no description)',
    merchant: cleanMer,
    wasRawPipeFormat,
  }
}
