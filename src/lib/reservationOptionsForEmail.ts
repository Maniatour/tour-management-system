import type { SupabaseClient } from '@supabase/supabase-js'

export type ReservationOptionLineForEmail = {
  label: string
  unitPrice: number
  quantity: number
  lineTotal: number
}

export type ReservationOptionLineBilingual = {
  labelKo: string
  labelEn: string
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

  const optionsMap = await loadOptionsNameMap(client, optionIds)

  const lines: ReservationOptionLineForEmail[] = []
  for (const r of filtered) {
    const bilingual = reservationOptionRowToLine(
      r as { option_id?: string; ea?: number; price?: number; total_price?: unknown },
      optionsMap
    )
    if (!bilingual) continue
    lines.push({
      label: isEnglish ? bilingual.labelEn : bilingual.labelKo,
      unitPrice: bilingual.unitPrice,
      quantity: bilingual.quantity,
      lineTotal: bilingual.lineTotal,
    })
  }

  return lines
}

function optionLabelsFromMeta(
  meta: { name?: string | null; name_ko?: string | null; name_en?: string | null },
  oid: string
): { labelKo: string; labelEn: string } {
  const ko = (meta.name_ko && String(meta.name_ko).trim()) || ''
  const en = (meta.name_en && String(meta.name_en).trim()) || ''
  const name = (meta.name && String(meta.name).trim()) || ''
  return {
    labelKo: ko || en || name || oid,
    labelEn: en || RECEIPT_OPTION_LABEL_EN[ko] || RECEIPT_OPTION_LABEL_EN[name] || ko || name || oid,
  }
}

function reservationOptionRowToLine(
  r: { option_id?: string; ea?: number; price?: number; total_price?: unknown },
  optionsMap: Record<string, { name?: string | null; name_ko?: string | null; name_en?: string | null }>
): ReservationOptionLineBilingual | null {
  const oid = String(r.option_id ?? '').trim()
  if (!oid) return null
  const meta = optionsMap[oid] || {}
  const { labelKo, labelEn } = optionLabelsFromMeta(meta, oid)
  const ea = Math.max(0, Math.floor(Number(r.ea) || 0))
  const price = Number(r.price) || 0
  const tp = r.total_price
  let lineTotal = tp != null && tp !== '' ? Number(tp) : ea * price
  if (Number.isNaN(lineTotal)) lineTotal = 0
  lineTotal = Math.round(lineTotal * 100) / 100
  if (lineTotal < 0.005) return null
  const qty = ea > 0 ? ea : 1
  const unitPrice =
    ea > 0 && lineTotal > 0
      ? Math.round((lineTotal / ea) * 100) / 100
      : Math.round(price * 100) / 100 || lineTotal
  return { labelKo, labelEn, unitPrice, quantity: qty, lineTotal }
}

async function loadOptionsNameMap(
  client: SupabaseClient,
  optionIds: string[]
): Promise<Record<string, { name?: string | null; name_ko?: string | null; name_en?: string | null }>> {
  const optionsMap: Record<string, { name?: string | null; name_ko?: string | null; name_en?: string | null }> =
    {}
  if (optionIds.length === 0) return optionsMap

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
  return optionsMap
}

/** Balance 봉투 등: 예약 ID별 옵션 라인 (한·영 라벨) */
export async function fetchReservationOptionLinesBatch(
  client: SupabaseClient,
  reservationIds: string[]
): Promise<Map<string, ReservationOptionLineBilingual[]>> {
  const ids = [...new Set(reservationIds.map((id) => String(id ?? '').trim()).filter(Boolean))]
  const out = new Map<string, ReservationOptionLineBilingual[]>()
  if (ids.length === 0) return out

  const { data: rows, error } = await client
    .from('reservation_options')
    .select('reservation_id, option_id, ea, price, total_price, status, created_at')
    .in('reservation_id', ids)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[fetchReservationOptionLinesBatch]', error)
    return out
  }

  const filtered = (rows || []).filter((r) => !isOptionRowExcluded((r as { status?: string }).status))
  const optionIds = [
    ...new Set(
      filtered
        .map((r) => String((r as { option_id?: string }).option_id ?? '').trim())
        .filter(Boolean)
    ),
  ]
  const optionsMap = await loadOptionsNameMap(client, optionIds)

  for (const id of ids) out.set(id, [])

  for (const r of filtered) {
    const resId = String((r as { reservation_id?: string }).reservation_id ?? '').trim()
    if (!resId) continue
    const line = reservationOptionRowToLine(r as Parameters<typeof reservationOptionRowToLine>[0], optionsMap)
    if (!line) continue
    const list = out.get(resId) || []
    list.push(line)
    out.set(resId, list)
  }

  return out
}
