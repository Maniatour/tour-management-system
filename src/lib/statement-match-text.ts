import { formatStatementLineDescription } from '@/lib/statement-display'
import { extractAchPayee } from '@/lib/statement-field-normalize'

/**
 * 자동 매칭용 명세 텍스트 haystack.
 * WellsFargo raw(`date:… | descriptions:FOO`)는 표시용과 같이 descriptions 본문만 사용.
 */
export function statementLineMatchHaystack(
  description: string | null | undefined,
  merchant: string | null | undefined
): string {
  const formatted = formatStatementLineDescription(description, merchant)
  const parts: string[] = []
  const mer = (merchant ?? '').trim()
  if (mer) parts.push(mer)
  if (formatted && formatted !== '—') {
    if (!mer || formatted !== mer) parts.push(formatted)
  }
  const ach = extractAchPayee(formatted && formatted !== '—' ? formatted : String(description ?? ''))
  if (ach && !parts.some((p) => p.toLowerCase().includes(ach.toLowerCase()))) {
    parts.push(ach)
  }
  if (parts.length > 0) return parts.join(' ').trim()
  return `${merchant ?? ''} ${description ?? ''}`.trim()
}

/** 토큰 집합 (길이 ≥2) */
export function statementMatchTextTokenSet(raw: string): Set<string> {
  const norm = String(raw ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .trim()
  if (!norm) return new Set()
  const out = new Set<string>()
  for (const t of norm.split(/\s+/)) {
    if (t.length >= 2) out.add(t)
  }
  return out
}

export function normalizeVendorMatchText(raw: string): string {
  return String(raw ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/** 카드사·결제망 이름만 있는 paid_to — 별칭 학습/과매칭 제외 */
const PAID_TO_ALIAS_BLOCKLIST = new Set(
  [
    'amex',
    'american express',
    'american express simplycash',
    'mastercard',
    'master',
    'visa',
    'discover',
    'wells fargo',
    'us bank',
    'citi',
    'capital one',
    'cash',
    'zelle',
    'venmo',
    'paypal',
    'credit card',
    'debit card',
    'card',
  ].map((s) => normalizeVendorMatchText(s))
)

export function isBlockedPaidToForAliasLearning(paidTo: string): boolean {
  const n = normalizeVendorMatchText(paidTo)
  if (n.length < 3) return true
  if (PAID_TO_ALIAS_BLOCKLIST.has(n)) return true
  // 너무 짧은 일반명
  if (['gas', 'parking', 'hotel', 'food', 'uber', 'lyft'].includes(n)) return true
  return false
}

export type ExpenseVendorAliasRow = {
  name: string
  match_aliases?: string[] | null
}

/**
 * paid_to 에 대응하는 벤더 별칭 목록 (이름 유사 + DB match_aliases).
 */
export function vendorAliasTextsForPaidTo(
  paidTo: string,
  vendors: ExpenseVendorAliasRow[]
): string[] {
  const normPaid = normalizeVendorMatchText(paidTo)
  if (normPaid.length < 2) return []
  const out: string[] = []
  const seen = new Set<string>()
  const push = (s: string) => {
    const t = s.trim()
    if (!t) return
    const k = normalizeVendorMatchText(t)
    if (!k || seen.has(k)) return
    seen.add(k)
    out.push(t)
  }

  for (const v of vendors) {
    const name = String(v.name ?? '').trim()
    const normName = normalizeVendorMatchText(name)
    const aliases = (v.match_aliases ?? []).map((a) => String(a).trim()).filter(Boolean)
    const nameHit =
      normName.length >= 2 &&
      (normName === normPaid || normName.includes(normPaid) || normPaid.includes(normName))
    if (nameHit) {
      push(name)
      for (const a of aliases) push(a)
      continue
    }
    // paid_to 가 별칭과 직접 일치하면 해당 벤더의 다른 별칭·이름도 사용
    for (const a of aliases) {
      const na = normalizeVendorMatchText(a)
      if (na === normPaid || (na.length >= 3 && (normPaid.includes(na) || na.includes(normPaid)))) {
        push(name)
        for (const x of aliases) push(x)
        break
      }
    }
  }
  return out
}

/**
 * 명세 토큰 vs 지출 paid_to/paid_for + 별칭 겹침 보너스 (0~maxBonus).
 */
export function statementVendorTextMatchBonus(
  lineTokens: Set<string>,
  paidTo: string,
  paidFor: string,
  aliasTexts: string[],
  maxBonus = 12
): number {
  if (lineTokens.size === 0) return 0
  const hayParts = [paidTo, paidFor, ...aliasTexts].filter(Boolean).join(' ')
  const expTokens = statementMatchTextTokenSet(hayParts)
  if (expTokens.size === 0) return 0

  let shared = 0
  for (const t of expTokens) if (lineTokens.has(t)) shared += 1

  // 별칭/결제처 부분문자 일치 (토큰 분할이 깨지는 CITY OF PAGE HSB 등)
  const lineHay = [...lineTokens].join(' ')
  let substringHit = false
  for (const raw of [paidTo, ...aliasTexts]) {
    const n = normalizeVendorMatchText(raw)
    if (n.length < 3) continue
    if (lineHay.includes(n) || n.split(' ').some((p) => p.length >= 3 && lineTokens.has(p))) {
      // multi-word alias: require majority of significant tokens
      const parts = n.split(' ').filter((p) => p.length >= 3)
      if (parts.length === 0) continue
      const hitCount = parts.filter((p) => lineTokens.has(p) || lineHay.includes(p)).length
      if (hitCount >= Math.min(2, parts.length) || (parts.length === 1 && hitCount === 1)) {
        substringHit = true
        break
      }
    }
    // alias phrase contained in joined line tokens loosely
    const compactLine = lineHay.replace(/\s+/g, '')
    const compactAlias = n.replace(/\s+/g, '')
    if (compactAlias.length >= 5 && compactLine.includes(compactAlias)) {
      substringHit = true
      break
    }
  }

  if (shared === 0 && !substringHit) return 0
  const fromTokens = shared === 0 ? 0 : Math.min(maxBonus, 4 + shared * 4)
  const fromSub = substringHit ? Math.min(maxBonus, 10) : 0
  return Math.min(maxBonus, Math.max(fromTokens, fromSub))
}
