import type { SupabaseClient } from '@supabase/supabase-js'

/** Legacy shape for reservation-check UI; loads rows by `reservation_options.reservation_id` and joins `options`. */
export type LegacyReservationOptionRow = {
  choice_id: string
  option_id: string
  choice: {
    choice_name: string
    choice_name_ko: string | null
    choice_type: string
  }
  option: {
    option_name: string
    option_name_ko: string | null
    option_price: number | null
  }
}

type OptionCatalog = {
  id: string
  name?: string | null
  name_ko?: string | null
  adult_price?: number | null
}

function mapRow(
  row: {
    option_id: string | null
    ea?: number | null
    price?: number | null
    total_price?: number | null
  },
  catalog?: OptionCatalog | null
): LegacyReservationOptionRow {
  const oid = String(row.option_id ?? '').trim()
  const name = (catalog?.name && String(catalog.name).trim()) || oid
  const nameKoRaw = catalog?.name_ko
  const nameKo =
    nameKoRaw != null && String(nameKoRaw).trim() !== '' ? String(nameKoRaw) : null
  const lineRaw = row.total_price
  const line =
    lineRaw != null && lineRaw !== ''
      ? Number(lineRaw)
      : (Number(row.price) || 0) * (Number(row.ea) || 1)
  const unit = catalog?.adult_price != null ? Number(catalog.adult_price) : null
  const option_price =
    !Number.isNaN(line) && line !== 0 ? line : unit != null && !Number.isNaN(unit) ? unit : null

  return {
    choice_id: oid,
    option_id: oid,
    choice: {
      choice_name: name,
      choice_name_ko: nameKo,
      choice_type: 'option',
    },
    option: {
      option_name: name,
      option_name_ko: nameKo,
      option_price,
    },
  }
}

async function loadOptionsCatalog(
  client: SupabaseClient,
  optionIds: string[]
): Promise<Map<string, OptionCatalog>> {
  const map = new Map<string, OptionCatalog>()
  const ids = [...new Set(optionIds.map((id) => String(id).trim()).filter(Boolean))]
  if (ids.length === 0) return map
  const { data, error } = await client
    .from('options')
    .select('id, name, name_ko, adult_price')
    .in('id', ids)
  if (error) {
    console.error('[fetchReservationOptionsLegacy] options 조회 오류:', error)
    return map
  }
  for (const o of data || []) {
    if (o?.id != null) map.set(String(o.id), o as OptionCatalog)
  }
  return map
}

/** `reservation_options.reservation_id`(text)로만 조회 */
export async function fetchReservationOptionsLegacyByReservationId(
  client: SupabaseClient,
  reservationId: string
): Promise<LegacyReservationOptionRow[]> {
  const rid = String(reservationId ?? '').trim()
  if (!rid) return []

  const { data: rows, error } = await client
    .from('reservation_options')
    .select('option_id, ea, price, total_price, created_at')
    .eq('reservation_id', rid)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[fetchReservationOptionsLegacyByReservationId]', error)
    return []
  }
  if (!rows?.length) return []

  const catalog = await loadOptionsCatalog(
    client,
    rows.map((r) => String((r as { option_id?: string }).option_id ?? ''))
  )
  return rows.map((r) => mapRow(r as any, catalog.get(String((r as any).option_id ?? '').trim())))
}

export async function fetchReservationOptionsLegacyByReservationIds(
  client: SupabaseClient,
  reservationIds: string[]
): Promise<Map<string, LegacyReservationOptionRow[]>> {
  const out = new Map<string, LegacyReservationOptionRow[]>()
  const ids = [...new Set(reservationIds.map((id) => String(id ?? '').trim()).filter(Boolean))]
  if (ids.length === 0) return out

  const { data: rows, error } = await client
    .from('reservation_options')
    .select('reservation_id, option_id, ea, price, total_price, created_at')
    .in('reservation_id', ids)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[fetchReservationOptionsLegacyByReservationIds]', error)
    return out
  }
  if (!rows?.length) return out

  const catalog = await loadOptionsCatalog(
    client,
    rows.map((r) => String((r as { option_id?: string }).option_id ?? ''))
  )

  for (const r of rows) {
    const rid = String((r as { reservation_id?: string }).reservation_id ?? '').trim()
    if (!rid) continue
    const list = out.get(rid) ?? []
    list.push(mapRow(r as any, catalog.get(String((r as any).option_id ?? '').trim())))
    out.set(rid, list)
  }
  return out
}
