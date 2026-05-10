import type { SupabaseClient } from '@supabase/supabase-js'
import { RECEIPT_OCR_BUILTIN_CATEGORY_KEYWORDS } from '@/lib/receiptOcrParseBuiltin'

export const RECEIPT_OCR_PARSE_RULES_KEY = 'receipt_ocr_parse_rules'

const RULES_VERSION = 1 as const
const MAX_REGEX_PATTERN_LEN = 400

export type ReceiptOcrCategoryRuleStored = {
  id: string
  paid_for: string
  keywords: string[]
  enabled: boolean
}

export type ReceiptOcrPaidToSkipPatternStored = {
  id: string
  pattern: string
  flags?: string
  enabled: boolean
  /** UI 복원용: 사용자가 입력한 일반 문구(없으면 정규식만 표시) */
  plain_phrase?: string
}

export type ReceiptOcrAmountLineHintStored = {
  id: string
  line_pattern: string
  flags?: string
  enabled: boolean
  /** UI 복원용: 사용자가 입력한 일반 문구 */
  plain_phrase?: string
}

/** OCR 본문(소문자 비교)에 문구가 포함되면 지급처·지급항목 등을 덮어씀 — 위에서 아래 순으로 첫 일치만 적용 */
export type ReceiptOcrBodyMatchRuleStored = {
  id: string
  /** 공백·대소문자 정규화 후 부분 일치 */
  contains_phrase: string
  /** 비우면 지급처는 기존 휴리스틱 유지 */
  paid_to: string
  /** 비우면 분류 키워드 결과 유지 */
  paid_for: string
  /** 비우면 카드/텍스트 매칭으로 결제수단 추정 */
  payment_method_id: string
  /** true이고 카드 끝 4자리가 있으면 payment_method_text 를 «CC» 로 */
  payment_use_cc_label: boolean
  enabled: boolean
}

export type ReceiptOcrParseRulesStored = {
  version: typeof RULES_VERSION
  category_rules: ReceiptOcrCategoryRuleStored[]
  paid_to_skip_patterns: ReceiptOcrPaidToSkipPatternStored[]
  amount_line_hints: ReceiptOcrAmountLineHintStored[]
  body_match_rules: ReceiptOcrBodyMatchRuleStored[]
}

export type ReceiptOcrParseRuntime = {
  /** 사용자 규칙(앞) + 내장 규칙(뒤) — 먼저 맞는 분류가 적용됩니다. */
  categoryKeywordRows: Array<{ paidFor: string; keywords: string[] }>
  paidToSkipRes: RegExp[]
  amountLineHintRes: RegExp[]
  bodyMatchRules: Array<{
    containsNorm: string
    paidTo: string | null
    paidFor: string | null
    paymentMethodId: string | null
    paymentUseCcLabel: boolean
  }>
}

function safeRegex(pattern: string, flags: string | undefined): RegExp | null {
  const p = pattern.trim()
  if (!p || p.length > MAX_REGEX_PATTERN_LEN) return null
  try {
    return new RegExp(p, flags && /^[gimsuy]*$/.test(flags) ? flags : 'i')
  } catch {
    return null
  }
}

function normalizeKeywordList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const k = item.trim().toLowerCase()
    if (k.length > 0 && k.length <= 80) out.push(k)
  }
  return out
}

function normalizeCategoryRule(r: unknown): ReceiptOcrCategoryRuleStored | null {
  if (!r || typeof r !== 'object') return null
  const o = r as Record<string, unknown>
  const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : ''
  const paid_for = typeof o.paid_for === 'string' ? o.paid_for.trim() : ''
  const enabled = o.enabled !== false
  const keywords = normalizeKeywordList(o.keywords)
  if (!id || !paid_for || keywords.length === 0) return null
  return { id, paid_for, keywords, enabled }
}

function normalizeSkip(r: unknown): ReceiptOcrPaidToSkipPatternStored | null {
  if (!r || typeof r !== 'object') return null
  const o = r as Record<string, unknown>
  const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : ''
  const pattern = typeof o.pattern === 'string' ? o.pattern : ''
  const flags = typeof o.flags === 'string' ? o.flags : undefined
  const enabled = o.enabled !== false
  const plain_phrase =
    typeof o.plain_phrase === 'string' && o.plain_phrase.trim() ? o.plain_phrase.trim() : undefined
  if (!id || !pattern.trim()) return null
  return { id, pattern, flags, enabled, ...(plain_phrase ? { plain_phrase } : {}) }
}

function normalizeAmountHint(r: unknown): ReceiptOcrAmountLineHintStored | null {
  if (!r || typeof r !== 'object') return null
  const o = r as Record<string, unknown>
  const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : ''
  const line_pattern = typeof o.line_pattern === 'string' ? o.line_pattern : ''
  const flags = typeof o.flags === 'string' ? o.flags : undefined
  const enabled = o.enabled !== false
  const plain_phrase =
    typeof o.plain_phrase === 'string' && o.plain_phrase.trim() ? o.plain_phrase.trim() : undefined
  if (!id || !line_pattern.trim()) return null
  return { id, line_pattern, flags, enabled, ...(plain_phrase ? { plain_phrase } : {}) }
}

export const MAX_BODY_MATCH_PHRASE = 120

/** 본문 포함 매칭용 — 공백·대소문자 정규화 */
export function normalizeReceiptBodyForMatch(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

function normalizeBodyMatchRule(r: unknown): ReceiptOcrBodyMatchRuleStored | null {
  if (!r || typeof r !== 'object') return null
  const o = r as Record<string, unknown>
  const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : ''
  const contains_phrase =
    typeof o.contains_phrase === 'string' ? o.contains_phrase.trim().slice(0, MAX_BODY_MATCH_PHRASE) : ''
  const paid_to = typeof o.paid_to === 'string' ? o.paid_to.trim().slice(0, 120) : ''
  const paid_for = typeof o.paid_for === 'string' ? o.paid_for.trim().slice(0, 120) : ''
  const payment_method_id =
    typeof o.payment_method_id === 'string' ? o.payment_method_id.trim().slice(0, 80) : ''
  const payment_use_cc_label = o.payment_use_cc_label === true
  const enabled = o.enabled !== false
  if (!id || !contains_phrase) return null
  if (!paid_to && !paid_for && !payment_use_cc_label && !payment_method_id) return null
  return {
    id,
    contains_phrase,
    paid_to,
    paid_for,
    payment_method_id,
    payment_use_cc_label,
    enabled,
  }
}

/** shared_settings.setting_value JSON → 정규화된 저장 형태 */
export function parseStoredReceiptOcrRules(value: unknown): ReceiptOcrParseRulesStored {
  const empty: ReceiptOcrParseRulesStored = {
    version: RULES_VERSION,
    category_rules: [],
    paid_to_skip_patterns: [],
    amount_line_hints: [],
    body_match_rules: [],
  }
  if (!value || typeof value !== 'object') return empty
  const o = value as Record<string, unknown>
  if (o.version !== RULES_VERSION && o.version != null) {
    /* 알 수 없는 버전은 빈 규칙으로 안전 폴백 */
    return empty
  }

  const category_rules = Array.isArray(o.category_rules)
    ? (o.category_rules.map(normalizeCategoryRule).filter(Boolean) as ReceiptOcrCategoryRuleStored[])
    : []
  const paid_to_skip_patterns = Array.isArray(o.paid_to_skip_patterns)
    ? (o.paid_to_skip_patterns.map(normalizeSkip).filter(Boolean) as ReceiptOcrPaidToSkipPatternStored[])
    : []
  const amount_line_hints = Array.isArray(o.amount_line_hints)
    ? (o.amount_line_hints.map(normalizeAmountHint).filter(Boolean) as ReceiptOcrAmountLineHintStored[])
    : []
  const body_match_rules = Array.isArray(o.body_match_rules)
    ? (o.body_match_rules.map(normalizeBodyMatchRule).filter(Boolean) as ReceiptOcrBodyMatchRuleStored[])
    : []

  return { version: RULES_VERSION, category_rules, paid_to_skip_patterns, amount_line_hints, body_match_rules }
}

export function buildReceiptOcrParseRuntime(stored: ReceiptOcrParseRulesStored | null): ReceiptOcrParseRuntime {
  const s = stored ?? parseStoredReceiptOcrRules(null)

  const userCats = s.category_rules
    .filter((r) => r.enabled)
    .map((r) => ({ paidFor: r.paid_for, keywords: [...r.keywords] }))

  const builtinCats = RECEIPT_OCR_BUILTIN_CATEGORY_KEYWORDS.map((row) => ({
    paidFor: row.paidFor,
    keywords: [...row.keywords],
  }))

  const paidToSkipRes: RegExp[] = []
  for (const p of s.paid_to_skip_patterns) {
    if (!p.enabled) continue
    const re = safeRegex(p.pattern, p.flags)
    if (re) paidToSkipRes.push(re)
  }

  const amountLineHintRes: RegExp[] = []
  for (const h of s.amount_line_hints) {
    if (!h.enabled) continue
    const re = safeRegex(h.line_pattern, h.flags)
    if (re) amountLineHintRes.push(re)
  }

  const bodyMatchRules: ReceiptOcrParseRuntime['bodyMatchRules'] = []
  for (const b of s.body_match_rules) {
    if (!b.enabled) continue
    const cn = normalizeReceiptBodyForMatch(b.contains_phrase)
    if (!cn) continue
    const pt = b.paid_to.trim()
    const pf = b.paid_for.trim()
    const pmid = (b.payment_method_id ?? '').trim()
    if (!pt && !pf && !b.payment_use_cc_label && !pmid) continue
    bodyMatchRules.push({
      containsNorm: cn,
      paidTo: pt || null,
      paidFor: pf || null,
      paymentMethodId: pmid || null,
      paymentUseCcLabel: b.payment_use_cc_label,
    })
  }

  return {
    categoryKeywordRows: [...userCats, ...builtinCats],
    paidToSkipRes,
    amountLineHintRes,
    bodyMatchRules,
  }
}

export const DEFAULT_RECEIPT_OCR_PARSE_RUNTIME: ReceiptOcrParseRuntime =
  buildReceiptOcrParseRuntime(parseStoredReceiptOcrRules(null))

export async function fetchReceiptOcrParseRulesStored(
  supabase: SupabaseClient
): Promise<ReceiptOcrParseRulesStored> {
  const { data, error } = await supabase
    .from('shared_settings')
    .select('setting_value')
    .eq('setting_key', RECEIPT_OCR_PARSE_RULES_KEY)
    .maybeSingle()

  if (error || data?.setting_value == null) {
    return parseStoredReceiptOcrRules(null)
  }
  return parseStoredReceiptOcrRules(data.setting_value)
}

export async function fetchReceiptOcrParseRuntime(supabase: SupabaseClient): Promise<ReceiptOcrParseRuntime> {
  const stored = await fetchReceiptOcrParseRulesStored(supabase)
  return buildReceiptOcrParseRuntime(stored)
}

export async function upsertReceiptOcrParseRulesStored(
  supabase: SupabaseClient,
  stored: ReceiptOcrParseRulesStored
) {
  const payload = serializeReceiptOcrRulesForSave(stored)
  return supabase.from('shared_settings').upsert(
    {
      setting_key: RECEIPT_OCR_PARSE_RULES_KEY,
      setting_value: payload,
    },
    { onConflict: 'setting_key' }
  )
}

export function serializeReceiptOcrRulesForSave(
  stored: ReceiptOcrParseRulesStored
): ReceiptOcrParseRulesStored {
  return {
    version: RULES_VERSION,
    category_rules: stored.category_rules
      .map((r) => ({
        id: r.id,
        paid_for: r.paid_for.trim(),
        keywords: normalizeKeywordList(r.keywords),
        enabled: r.enabled !== false,
      }))
      .filter((r) => r.paid_for.length > 0 && r.keywords.length > 0),
    paid_to_skip_patterns: stored.paid_to_skip_patterns
      .map((r) => ({
        id: r.id,
        pattern: r.pattern.trim().slice(0, MAX_REGEX_PATTERN_LEN),
        flags: r.flags?.trim() || undefined,
        enabled: r.enabled !== false,
        ...(r.plain_phrase?.trim() ? { plain_phrase: r.plain_phrase.trim().slice(0, 200) } : {}),
      }))
      .filter((r) => r.pattern.length > 0),
    amount_line_hints: stored.amount_line_hints
      .map((r) => ({
        id: r.id,
        line_pattern: r.line_pattern.trim().slice(0, MAX_REGEX_PATTERN_LEN),
        flags: r.flags?.trim() || undefined,
        enabled: r.enabled !== false,
        ...(r.plain_phrase?.trim() ? { plain_phrase: r.plain_phrase.trim().slice(0, 200) } : {}),
      }))
      .filter((r) => r.line_pattern.length > 0),
    body_match_rules: stored.body_match_rules
      .map((r) => ({
        id: r.id,
        contains_phrase: r.contains_phrase.trim().slice(0, MAX_BODY_MATCH_PHRASE),
        paid_to: r.paid_to.trim().slice(0, 120),
        paid_for: r.paid_for.trim().slice(0, 120),
        payment_method_id: (r.payment_method_id ?? '').trim().slice(0, 80),
        payment_use_cc_label: r.payment_use_cc_label === true,
        enabled: r.enabled !== false,
      }))
      .filter(
        (r) =>
          r.contains_phrase.length > 0 &&
          (r.paid_to.length > 0 ||
            r.paid_for.length > 0 ||
            r.payment_use_cc_label ||
            r.payment_method_id.length > 0)
      ),
  }
}

function newBodyMatchRuleId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `r_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

/** OCR 원문에서 본문 매칭용 짧은 문구 제안(첫 비어 있지 않은 줄, 최대 길이) */
export function suggestBodyMatchPhraseFromOcrText(raw: string): string {
  const line =
    raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? ''
  return line.slice(0, MAX_BODY_MATCH_PHRASE)
}

/**
 * 본문 매칭 규칙을 목록 맨 앞에 추가(우선 적용). 관리자 화면과 동일 shared_settings.
 */
export async function prependBodyMatchRuleToStoredSettings(
  supabase: SupabaseClient,
  input: {
    contains_phrase: string
    paid_to: string
    paid_for: string
    payment_method_id: string
    payment_use_cc_label: boolean
  }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const phrase = input.contains_phrase.trim().slice(0, MAX_BODY_MATCH_PHRASE)
  const paid_to = input.paid_to.trim().slice(0, 120)
  const paid_for = input.paid_for.trim().slice(0, 120)
  const payment_method_id = input.payment_method_id.trim().slice(0, 80)
  if (!phrase) return { ok: false, message: 'empty_phrase' }
  if (!paid_to && !paid_for && !input.payment_use_cc_label && !payment_method_id) {
    return { ok: false, message: 'empty_targets' }
  }

  const stored = await fetchReceiptOcrParseRulesStored(supabase)
  const normNew = normalizeReceiptBodyForMatch(phrase)
  if (!normNew) return { ok: false, message: 'empty_phrase' }

  for (const b of stored.body_match_rules) {
    if (!b.enabled) continue
    if (
      normalizeReceiptBodyForMatch(b.contains_phrase) === normNew &&
      b.paid_to.trim() === paid_to &&
      b.paid_for.trim() === paid_for &&
      (b.payment_method_id ?? '').trim() === payment_method_id &&
      b.payment_use_cc_label === input.payment_use_cc_label
    ) {
      return { ok: false, message: 'duplicate' }
    }
  }

  const newRule: ReceiptOcrBodyMatchRuleStored = {
    id: newBodyMatchRuleId(),
    contains_phrase: phrase,
    paid_to,
    paid_for,
    payment_method_id,
    payment_use_cc_label: input.payment_use_cc_label,
    enabled: true,
  }

  const next: ReceiptOcrParseRulesStored = {
    ...stored,
    body_match_rules: [newRule, ...stored.body_match_rules],
  }

  const { error } = await upsertReceiptOcrParseRulesStored(supabase, next)
  if (error) return { ok: false, message: error.message || 'save_failed' }
  return { ok: true }
}
