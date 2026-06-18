import type { SupabaseClient } from '@supabase/supabase-js'
import { isAmountSearchQuery, normalizeAmountSearchQuery } from '@/lib/amountSearch'
import {
  postgrestIlikeQuoted,
  collectPostgrestIds,
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

export async function buildTourExpenseSearchOrClause(
  supabase: SupabaseClient,
  rawSearch: string
): Promise<string | null> {
  const raw = rawSearch.trim()
  if (!raw) return null

  const q = postgrestIlikeQuoted(raw)
  const parts = buildTextColumnSearchParts(
    ['paid_for', 'paid_to', 'note', 'tour_id', 'payment_method'],
    raw
  )

  const skipAuxLookups = raw.length === 1 && /^[\x00-\x7F]$/.test(raw)

  if (!skipAuxLookups) {
    const pmIds = await safeSelectPaymentMethodIds(supabase, q, 'tour expense payment_methods')
    if (pmIds.length > 0) {
      parts.push(`payment_method.in.(${pmIds.join(',')})`)
    }

    try {
      const { data: productRows, error: pErr } = await supabase
        .from('products')
        .select('id')
        .or(`name.ilike.${q},name_ko.ilike.${q},name_en.ilike.${q}`)
        .limit(100)
      if (!pErr && productRows?.length) {
        const productIds = collectPostgrestIds(productRows)
        if (productIds.length > 0) {
          parts.push(`product_id.in.(${productIds.join(',')})`)
          const { data: tourRows } = await supabase
            .from('tours')
            .select('id')
            .in('product_id', productIds)
            .limit(200)
          const tourIds = collectPostgrestIds(tourRows)
          if (tourIds.length > 0) {
            parts.push(`tour_id.in.(${tourIds.join(',')})`)
          }
        }
      }
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[tour expense search] product/tour lookup failed:', e)
      }
    }
  }

  if (isAmountSearchQuery(raw)) {
    parts.push(...buildAmountSearchParts(raw))
  }

  return parts.join(',')
}
