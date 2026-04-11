import type { SupabaseClient } from '@supabase/supabase-js'

export type ReservationOptionLineForEmail = {
  label: string
  unitPrice: number
  quantity: number
  lineTotal: number
}

const RECEIPT_OPTION_LABEL_EN: Record<string, string> = {
  '비거주자 비용': 'Non-resident fee',
  '비거주자 (패스 보유)': 'Non-resident (with pass)',
}

function isOptionRowExcluded(status: string | null | undefined): boolean {
  const s = String(status || 'active').toLowerCase()
  return s === 'cancelled' || s === 'refunded'
}

/**
 * 영수증(CustomerReceiptModal)과 동일 출처: `reservation_options` + `options` / `product_options` 이름.
 */
export async function fetchReservationOptionLinesForEmail(
  client: SupabaseClient,
  reservationId: string,
  isEnglish: boolean
): Promise<ReservationOptionLineForEmail[]> {
  const rid = String(reservationId ?? '').trim()
  if (!rid) return []

  const { data: rows, error } = await client
    .from('reservation_options')
    .select('option_id, ea, price, total_price, status, created_at')
    .eq('reservation_id', rid)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[fetchReservationOptionLinesForEmail]', error)
    return []
  }

  const filtered = (rows || []).filter((r) => !isOptionRowExcluded((r as { status?: string }).status))
  if (!filtered.length) return []

  const optionIds = [
    ...new Set(
      filtered
        .map((r) => String((r as { option_id?: string }).option_id ?? '').trim())
        .filter(Boolean)
    ),
  ]

  const optionsMap: Record<string, { name?: string | null; name_ko?: string | null; name_en?: string | null }> =
    {}
  if (optionIds.length > 0) {
    const { data: opts } = await client
      .from('options')
      .select('id, name, name_ko, name_en')
      .in('id', optionIds)
    for (const o of opts || []) {
      if (o?.id != null) optionsMap[String(o.id)] = o as typeof optionsMap[string]
    }
    const missing = optionIds.filter((id) => !optionsMap[id])
    if (missing.length > 0) {
      const { data: po } = await client.from('product_options').select('id, name').in('id', missing)
      for (const o of po || []) {
        if (o?.id != null) optionsMap[String(o.id)] = { name: (o as { name?: string }).name }
      }
    }
  }

  const lines: ReservationOptionLineForEmail[] = []
  for (const r of filtered) {
    const oid = String((r as { option_id?: string }).option_id ?? '').trim()
    const meta = optionsMap[oid] || {}
    const ko = (meta.name_ko && String(meta.name_ko).trim()) || ''
    const en = (meta.name_en && String(meta.name_en).trim()) || ''
    const name = (meta.name && String(meta.name).trim()) || ''
    const label = isEnglish
      ? en || RECEIPT_OPTION_LABEL_EN[ko] || RECEIPT_OPTION_LABEL_EN[name] || ko || name || oid
      : ko || en || name || oid

    const ea = Number((r as { ea?: number }).ea) || 0
    const price = Number((r as { price?: number }).price) || 0
    const tp = (r as { total_price?: unknown }).total_price
    let lineTotal =
      tp != null && tp !== '' ? Number(tp) : ea * price
    if (Number.isNaN(lineTotal)) lineTotal = 0

    lines.push({
      label,
      unitPrice: price,
      quantity: ea,
      lineTotal,
    })
  }

  return lines
}
