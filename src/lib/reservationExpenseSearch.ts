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

export async function buildReservationExpenseSearchOrClause(
  supabase: SupabaseClient,
  rawSearch: string
): Promise<string | null> {
  const raw = rawSearch.trim()
  if (!raw) return null

  const q = postgrestIlikeQuoted(raw)
  const parts = buildTextColumnSearchParts(
    ['paid_to', 'paid_for', 'note', 'payment_method', 'submitted_by', 'reservation_id', 'event_id'],
    raw
  )

  const skipAuxLookups = raw.length === 1 && /^[\x00-\x7F]$/.test(raw)

  if (!skipAuxLookups) {
    const pmIds = await safeSelectPaymentMethodIds(supabase, q, 'reservation expense payment_methods')
    if (pmIds.length > 0) {
      parts.push(`payment_method.in.(${pmIds.join(',')})`)
    }

    try {
      const { data: customerRows, error: cErr } = await supabase
        .from('customers')
        .select('id')
        .or(`name.ilike.${q},email.ilike.${q}`)
        .limit(100)
      if (!cErr && customerRows?.length) {
        const customerIds = collectPostgrestIds(customerRows)
        const { data: reservationRows } = await supabase
          .from('reservations')
          .select('id')
          .in('customer_id', customerIds)
          .limit(200)
        const reservationIds = collectPostgrestIds(reservationRows)
        if (reservationIds.length > 0) {
          parts.push(`reservation_id.in.(${reservationIds.join(',')})`)
        }
      }
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[reservation expense search] customer/reservation lookup failed:', e)
      }
    }
  }

  if (isAmountSearchQuery(raw)) {
    parts.push(...buildAmountSearchParts(raw))
  }

  return parts.join(',')
}
