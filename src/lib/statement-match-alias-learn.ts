/**
 * 명세↔지출 수동/자동 매칭 후 paid_to → 명세 토큰 별칭을 expense_vendors에 누적.
 * 실패해도 매칭 자체는 롤백하지 않는다.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatStatementLineDescription } from '@/lib/statement-display'
import {
  isBlockedPaidToForAliasLearning,
  normalizeVendorMatchText,
} from '@/lib/statement-match-text'

const MIN_ALIAS_LEN = 6
const MAX_ALIASES_PER_VENDOR = 40

const BAD_ALIAS_NORMS = new Set(
  [
    'city of',
    'city',
    'parking',
    'tickets',
    'gas',
    'hotel',
    'payment',
    'purchase',
    'interest',
    'finance charge',
  ].map((s) => normalizeVendorMatchText(s))
)

function aliasCandidateFromLine(
  description: string | null | undefined,
  merchant: string | null | undefined
): string | null {
  const formatted = formatStatementLineDescription(description, merchant)
  if (!formatted || formatted === '—') return null
  let t = formatted.replace(/\s+/g, ' ').trim()
  t = t.replace(/\s+[A-Z]{2}\s*(?:USA)?\s*$/i, '').trim()
  t = t.replace(/\s+\d{3}[-.]?\d{3}[-.]?\d{4}\b.*$/i, '').trim()
  if (t.length > 36) {
    const cut = t.slice(0, 36)
    const sp = cut.lastIndexOf(' ')
    t = (sp >= 12 ? cut.slice(0, sp) : cut).trim()
  }
  const norm = normalizeVendorMatchText(t)
  if (norm.length < MIN_ALIAS_LEN) return null
  if (BAD_ALIAS_NORMS.has(norm)) return null
  const words = norm.split(' ').filter((w) => w.length >= 2)
  if (words.length < 2 && norm.length < 8) return null
  return t
}

/**
 * 매칭 성공 후 호출. 네트워크/권한 오류는 삼키고 console만 남긴다.
 */
export async function learnVendorAliasFromStatementMatch(
  supabase: SupabaseClient,
  params: {
    paidTo: string | null | undefined
    statementDescription: string | null | undefined
    statementMerchant: string | null | undefined
  }
): Promise<void> {
  try {
    const paidTo = String(params.paidTo ?? '').trim()
    if (!paidTo || isBlockedPaidToForAliasLearning(paidTo)) return

    const alias = aliasCandidateFromLine(params.statementDescription, params.statementMerchant)
    if (!alias) return

    const paidNorm = normalizeVendorMatchText(paidTo)
    const aliasNorm = normalizeVendorMatchText(alias)
    if (!aliasNorm || aliasNorm === paidNorm) return
    const firstPaid = paidNorm.split(' ')[0] || ''
    if (firstPaid.length >= 3 && aliasNorm.includes(firstPaid)) return

    const { data: existing, error: findErr } = await supabase
      .from('expense_vendors')
      .select('id, name, match_aliases')
      .ilike('name', paidTo)
      .limit(5)

    if (findErr) {
      console.warn('learnVendorAlias: vendor lookup failed', findErr.message)
      return
    }

    const rows = (existing || []) as Array<{
      id: string
      name: string
      match_aliases: string[] | null
    }>
    const exact =
      rows.find((r) => normalizeVendorMatchText(r.name) === paidNorm) || rows[0] || null

    if (exact) {
      const current = (exact.match_aliases ?? []).map((a) => String(a).trim()).filter(Boolean)
      const currentNorm = new Set(current.map((a) => normalizeVendorMatchText(a)))
      if (currentNorm.has(aliasNorm)) return
      const next = [...current, alias].slice(0, MAX_ALIASES_PER_VENDOR)
      const { error } = await supabase
        .from('expense_vendors')
        .update({ match_aliases: next })
        .eq('id', exact.id)
      if (error) console.warn('learnVendorAlias: update failed', error.message)
      return
    }

    const { error: insErr } = await supabase.from('expense_vendors').insert({
      name: paidTo,
      usage_type: 'reusable',
      match_aliases: [alias],
    })
    if (insErr) console.warn('learnVendorAlias: insert failed', insErr.message)
  } catch (e) {
    console.warn('learnVendorAlias: unexpected', e)
  }
}

/**
 * 매칭에 쓰인 명세 줄 + 지출 paid_to를 조회해 별칭 학습.
 */
export async function learnVendorAliasAfterReconciliationMatch(
  supabase: SupabaseClient,
  params: {
    statementLineId: string
    sourceTable: string
    sourceId: string
  }
): Promise<void> {
  try {
    if (
      params.sourceTable !== 'company_expenses' &&
      params.sourceTable !== 'tour_expenses' &&
      params.sourceTable !== 'reservation_expenses'
    ) {
      return
    }

    const [{ data: line }, { data: expense }] = await Promise.all([
      supabase
        .from('statement_lines')
        .select('description, merchant')
        .eq('id', params.statementLineId)
        .maybeSingle(),
      supabase.from(params.sourceTable).select('paid_to').eq('id', params.sourceId).maybeSingle(),
    ])

    const paidTo = (expense as { paid_to?: string | null } | null)?.paid_to
    const desc = (line as { description?: string | null } | null)?.description
    const mer = (line as { merchant?: string | null } | null)?.merchant
    await learnVendorAliasFromStatementMatch(supabase, {
      paidTo,
      statementDescription: desc,
      statementMerchant: mer,
    })
  } catch (e) {
    console.warn('learnVendorAliasAfterReconciliationMatch', e)
  }
}
