import type { SupabaseClient } from '@supabase/supabase-js'
import { isAmountSearchQuery, normalizeAmountSearchQuery } from '@/lib/amountSearch'
import {
  postgrestIlikeQuoted,
  safeSelectPaymentMethodIds,
  buildTextColumnSearchParts,
} from '@/lib/postgrestSearchUtils'

function buildAmountSearchParts(raw: string): string[] {
  const parts: string[] = []
  const q = normalizeAmountSearchQuery(raw)
  if (!q) return parts

  parts.push(`amount_abs_text.ilike.${postgrestIlikeQuoted(q)}`)

  const qNum = Number(q)
  if (Number.isFinite(qNum)) {
    const abs = Math.abs(qNum)
    const lo = abs - 0.005
    const hi = abs + 0.005
    parts.push(`and(amount.gte.${lo},amount.lte.${hi})`)
    if (qNum < 0 || raw.trim().startsWith('-')) {
      parts.push(`and(amount.gte.${-hi},amount.lte.${-lo})`)
    }
  }

  return parts
}

/**
 * 회사 지출 목록 검색용 PostgREST or(...) 절.
 */
export async function buildCompanyExpenseSearchOrClause(
  supabase: SupabaseClient,
  rawSearch: string
): Promise<string | null> {
  const raw = rawSearch.trim()
  if (!raw) return null

  const q = postgrestIlikeQuoted(raw)
  const parts = buildTextColumnSearchParts(
    [
      'paid_to',
      'paid_for',
      'description',
      'notes',
      'category',
      'subcategory',
      'standard_paid_for',
      'submit_by',
    ],
    raw
  )

  parts.push(`payment_method.ilike.${q}`)

  const skipPmLookup = raw.length === 1 && /^[\x00-\x7F]$/.test(raw)
  if (!skipPmLookup) {
    const pmIds = await safeSelectPaymentMethodIds(supabase, q, 'company expense payment_methods')
    if (pmIds.length > 0) {
      parts.push(`payment_method.in.(${pmIds.join(',')})`)
    }
  }

  if (isAmountSearchQuery(raw)) {
    parts.push(...buildAmountSearchParts(raw))
  }

  return parts.join(',')
}

/** @deprecated postgrestIlikeQuoted 사용 */
export const companyExpenseIlikeQuoted = postgrestIlikeQuoted
