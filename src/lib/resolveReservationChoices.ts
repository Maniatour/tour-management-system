import type { SupabaseClient } from '@supabase/supabase-js'

export type ResolvedChoiceRow = {
  choice_id: string
  option_id: string
  quantity: number
  option_key?: string | null
  choice_options: {
    option_key: string | null
    option_name: string | null
    option_name_ko: string | null
    internal_name: string | null
    badge_icon_url: string | null
  } | null
  product_choices: {
    choice_group_ko: string | null
  } | null
}

type ChoiceOptionRow = {
  id: string
  choice_id: string
  option_key: string | null
  option_name: string | null
  option_name_ko: string | null
  internal_name: string | null
  badge_icon_url: string | null
  adult_price: number | string | null
}

type ProductChoiceRow = {
  id: string
  choice_group_ko: string | null
}

type JsonChoiceItem = {
  choice_id?: unknown
  option_id?: unknown
  quantity?: unknown
  total_price?: unknown
  option_key?: unknown
  option_name?: unknown
  option_name_ko?: unknown
  choice_group_ko?: unknown
  choice_group?: unknown
}

const OPTION_SELECT =
  'id, choice_id, option_key, option_name, option_name_ko, internal_name, badge_icon_url, adult_price'

function isUndecided(optionId: string | null | undefined): boolean {
  if (!optionId) return true
  const v = optionId.trim()
  return !v || v === '__undecided__' || v === 'undecided'
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

function matchOptionByPrice(
  optionsForChoice: ChoiceOptionRow[],
  totalPrice: number,
  quantityCandidates: number[]
): ChoiceOptionRow | null {
  if (!optionsForChoice.length) return null
  // 예약 JSON에 total_price=0 으로만 남은 orphan은 단가 매칭이 위험
  // (예: 거주구분 미성년자 0원과 혼동). 유료 앤텔롭(L/X)만 안전하게 복구.
  if (!(totalPrice > 0)) return null

  const tried = new Set<number>()
  for (const rawQty of quantityCandidates) {
    const qty = Math.max(1, Math.round(toNumber(rawQty, 0)))
    if (tried.has(qty)) continue
    tried.add(qty)

    const unit = totalPrice / qty
    const byUnit = optionsForChoice.filter(
      (o) => Math.abs(toNumber(o.adult_price) - unit) < 0.011
    )
    if (byUnit.length === 1) return byUnit[0]
  }

  // quantity가 1로 잘못 저장된 경우: total_price 가 단가의 정수배인 옵션이 유일한지 확인
  const byDivisible = optionsForChoice.filter((o) => {
    const price = toNumber(o.adult_price)
    if (!(price > 0)) return false
    const q = totalPrice / price
    return Number.isFinite(q) && q >= 1 && Math.abs(q - Math.round(q)) < 0.011
  })
  if (byDivisible.length === 1) return byDivisible[0]

  return null
}

function toResolved(
  choiceId: string,
  optionId: string,
  quantity: number,
  option: ChoiceOptionRow | null | undefined,
  groupKo: string | null | undefined,
  fallbackNames?: { option_key?: string; option_name?: string; option_name_ko?: string }
): ResolvedChoiceRow {
  return {
    choice_id: choiceId,
    option_id: optionId,
    quantity,
    option_key: option?.option_key ?? fallbackNames?.option_key ?? null,
    choice_options: {
      option_key: option?.option_key ?? fallbackNames?.option_key ?? null,
      option_name: option?.option_name ?? fallbackNames?.option_name ?? null,
      option_name_ko: option?.option_name_ko ?? fallbackNames?.option_name_ko ?? null,
      internal_name: option?.internal_name ?? null,
      badge_icon_url: option?.badge_icon_url ?? null,
    },
    product_choices: {
      choice_group_ko: groupKo ?? null,
    },
  }
}

async function fetchOptionsByIds(
  db: SupabaseClient,
  optionIds: string[]
): Promise<Map<string, ChoiceOptionRow>> {
  const map = new Map<string, ChoiceOptionRow>()
  const ids = [...new Set(optionIds.filter((id) => !isUndecided(id)))]
  if (ids.length === 0) return map

  const { data, error } = await db.from('choice_options').select(OPTION_SELECT).in('id', ids)
  if (error) {
    console.error('choice_options by id 조회 실패:', error.message)
    return map
  }
  for (const row of (data ?? []) as ChoiceOptionRow[]) {
    map.set(row.id, row)
  }

  // 살아있는 옵션에서 못 찾은 orphan id 는 별칭 테이블로 현재 옵션에 연결
  const missing = ids.filter((id) => !map.has(id))
  if (missing.length === 0) return map

  const { data: aliasData, error: aliasError } = await db
    .from('choice_option_aliases')
    .select('old_option_id, current_option_id')
    .in('old_option_id', missing)
  if (aliasError) {
    // 별칭 테이블이 아직 없거나 조회 실패해도 기본 동작(가격매칭)로 진행
    return map
  }

  const aliasRows = (aliasData ?? []) as Array<{
    old_option_id: string
    current_option_id: string
  }>
  if (aliasRows.length === 0) return map

  const currentIds = [...new Set(aliasRows.map((a) => a.current_option_id))]
  const { data: aliasedOptions, error: aliasedErr } = await db
    .from('choice_options')
    .select(OPTION_SELECT)
    .in('id', currentIds)
  if (aliasedErr) return map

  const byCurrentId = new Map<string, ChoiceOptionRow>()
  for (const row of (aliasedOptions ?? []) as ChoiceOptionRow[]) {
    byCurrentId.set(row.id, row)
  }

  // orphan id 키로 현재 옵션을 매핑 (호출부는 원본 option_id 로 조회)
  for (const alias of aliasRows) {
    const current = byCurrentId.get(alias.current_option_id)
    if (current) map.set(alias.old_option_id, current)
  }

  return map
}

async function fetchOptionsByChoiceIds(
  db: SupabaseClient,
  choiceIds: string[]
): Promise<Map<string, ChoiceOptionRow[]>> {
  const map = new Map<string, ChoiceOptionRow[]>()
  const ids = [...new Set(choiceIds.filter(Boolean))]
  if (ids.length === 0) return map

  const { data, error } = await db.from('choice_options').select(OPTION_SELECT).in('choice_id', ids)
  if (error) {
    console.error('choice_options by choice_id 조회 실패:', error.message)
    return map
  }
  for (const row of (data ?? []) as ChoiceOptionRow[]) {
    const arr = map.get(row.choice_id) ?? []
    arr.push(row)
    map.set(row.choice_id, arr)
  }
  return map
}

async function fetchProductChoiceGroups(
  db: SupabaseClient,
  choiceIds: string[]
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>()
  const ids = [...new Set(choiceIds.filter(Boolean))]
  if (ids.length === 0) return map

  const { data, error } = await db
    .from('product_choices')
    .select('id, choice_group_ko')
    .in('id', ids)
  if (error) {
    console.error('product_choices 조회 실패:', error.message)
    return map
  }
  for (const row of (data ?? []) as ProductChoiceRow[]) {
    map.set(row.id, row.choice_group_ko)
  }
  return map
}

function resolveJsonItems(
  items: JsonChoiceItem[],
  byOptionId: Map<string, ChoiceOptionRow>,
  byChoiceId: Map<string, ChoiceOptionRow[]>,
  groupByChoiceId: Map<string, string | null>,
  guestCounts?: { adults?: number; child?: number; total_people?: number }
): ResolvedChoiceRow[] {
  const out: ResolvedChoiceRow[] = []
  const adults = toNumber(guestCounts?.adults, 0)
  const child = toNumber(guestCounts?.child, 0)
  const totalPeople = toNumber(guestCounts?.total_people, 0)
  const payingGuests = adults + child

  for (const item of items) {
    const choiceId = typeof item.choice_id === 'string' ? item.choice_id : ''
    const optionId = typeof item.option_id === 'string' ? item.option_id : ''
    if (!choiceId || isUndecided(optionId)) continue

    const quantity = Math.max(1, toNumber(item.quantity, 1))
    const totalPrice = toNumber(item.total_price, 0)
    let option = byOptionId.get(optionId) ?? null

    if (!option) {
      const qtyCandidates = [quantity, payingGuests, adults, totalPeople, 1].filter((n) => n > 0)
      option = matchOptionByPrice(byChoiceId.get(choiceId) ?? [], totalPrice, qtyCandidates)
    }

    const fallbackNames: {
      option_key?: string
      option_name?: string
      option_name_ko?: string
    } = {}
    if (typeof item.option_key === 'string') fallbackNames.option_key = item.option_key
    if (typeof item.option_name === 'string') fallbackNames.option_name = item.option_name
    if (typeof item.option_name_ko === 'string') {
      fallbackNames.option_name_ko = item.option_name_ko
    } else if (typeof item.option_name === 'string') {
      fallbackNames.option_name_ko = item.option_name
    }

    const groupKo =
      groupByChoiceId.get(choiceId) ??
      (typeof item.choice_group_ko === 'string' ? item.choice_group_ko : null) ??
      (typeof item.choice_group === 'string' ? item.choice_group : null)

    // 옵션을 전혀 해석하지 못했고 이름도 없으면 뱃지 불가 → 스킵
    if (
      !option &&
      !fallbackNames.option_name_ko &&
      !fallbackNames.option_name &&
      !fallbackNames.option_key
    ) {
      continue
    }

    out.push(
      toResolved(choiceId, option?.id ?? optionId, quantity, option, groupKo, fallbackNames)
    )
  }

  return out
}

/**
 * 단일 예약의 초이스를 reservation_choices 우선, 없으면 reservations.choices JSON으로 해석.
 * 옵션이 재생성되어 option_id가 orphan인 경우 choice_id + 단가(total_price/qty)로 현재 옵션에 매칭.
 */
export async function resolveReservationChoices(
  db: SupabaseClient,
  reservationId: string
): Promise<ResolvedChoiceRow[]> {
  if (!reservationId?.trim()) return []

  const { data: rcData, error: rcError } = await db
    .from('reservation_choices')
    .select(
      `
      choice_id,
      option_id,
      quantity,
      option_key,
      choice_options (
        option_key,
        option_name,
        option_name_ko,
        internal_name,
        badge_icon_url,
        adult_price,
        id,
        choice_id
      ),
      product_choices (
        choice_group_ko
      )
    `
    )
    .eq('reservation_id', reservationId)

  if (rcError) {
    console.error('reservation_choices 조회 실패:', {
      reservationId,
      message: rcError.message,
      code: rcError.code,
    })
  }

  const unwrap = <T,>(raw: T | T[] | null | undefined): T | null => {
    if (raw == null) return null
    return Array.isArray(raw) ? (raw[0] ?? null) : raw
  }

  const fromRc: ResolvedChoiceRow[] = []
  const orphanItems: JsonChoiceItem[] = []

  for (const row of (rcData ?? []) as Array<Record<string, unknown>>) {
    const choiceId = typeof row.choice_id === 'string' ? row.choice_id : ''
    const optionId = typeof row.option_id === 'string' ? row.option_id : ''
    if (!choiceId || isUndecided(optionId)) continue

    const co = unwrap(row.choice_options as ChoiceOptionRow | ChoiceOptionRow[] | null)
    const pc = unwrap(
      row.product_choices as { choice_group_ko?: string | null } | { choice_group_ko?: string | null }[] | null
    )
    const quantity = Math.max(1, toNumber(row.quantity, 1))

    if (co && (co.option_name_ko || co.option_name || co.internal_name || co.badge_icon_url)) {
      const fallback: { option_key?: string } = {}
      if (typeof row.option_key === 'string') fallback.option_key = row.option_key
      fromRc.push(
        toResolved(choiceId, optionId, quantity, co as ChoiceOptionRow, pc?.choice_group_ko ?? null, fallback)
      )
    } else {
      orphanItems.push({
        choice_id: choiceId,
        option_id: optionId,
        quantity,
        total_price: 0,
        option_key: row.option_key,
      })
    }
  }

  if (fromRc.length > 0 && orphanItems.length === 0) {
    return fromRc
  }

  const [{ data: reservation, error: resError }, { data: pricingRow, error: pricingError }] =
    await Promise.all([
      db
        .from('reservations')
        .select('choices, adults, child, total_people')
        .eq('id', reservationId)
        .maybeSingle(),
      // reservations.choices 가 비어도 reservation_pricing.choices 에 초이스가 남아있는 경우가 많음
      // (이메일 가져오기 확정 시 순서에 따라 reservations.choices 가 누락되는 케이스)
      db
        .from('reservation_pricing')
        .select('choices')
        .eq('reservation_id', reservationId)
        .maybeSingle(),
    ])

  if (resError) {
    console.error('reservations.choices 조회 실패:', resError.message)
  }
  if (pricingError) {
    // pricing 조회 실패해도 치명적이지 않음
  }

  const requiredFromReservation = (reservation?.choices as { required?: JsonChoiceItem[] } | null)
    ?.required
  const requiredFromPricing = (pricingRow?.choices as { required?: JsonChoiceItem[] } | null)
    ?.required
  const required = Array.isArray(requiredFromReservation) && requiredFromReservation.length > 0
    ? requiredFromReservation
    : requiredFromPricing
  const jsonItems = Array.isArray(required) ? required : []
  const guestCounts = {
    adults: toNumber((reservation as { adults?: number } | null)?.adults, 0),
    child: toNumber((reservation as { child?: number } | null)?.child, 0),
    total_people: toNumber((reservation as { total_people?: number } | null)?.total_people, 0),
  }

  const itemsToResolve = [
    ...orphanItems,
    ...(fromRc.length === 0 ? jsonItems : []),
  ]

  if (itemsToResolve.length === 0) {
    return fromRc
  }

  // orphan RC 행은 JSON에서 같은 option_id의 total_price를 가져와 매칭 정확도 향상
  if (orphanItems.length > 0 && jsonItems.length > 0) {
    for (const orphan of orphanItems) {
      const match = jsonItems.find(
        (j) =>
          String(j.option_id) === String(orphan.option_id) &&
          String(j.choice_id) === String(orphan.choice_id)
      )
      if (match) {
        orphan.total_price = match.total_price
        orphan.quantity = match.quantity ?? orphan.quantity
      }
    }
  }

  const optionIds = itemsToResolve
    .map((i) => (typeof i.option_id === 'string' ? i.option_id : ''))
    .filter(Boolean)
  const choiceIds = itemsToResolve
    .map((i) => (typeof i.choice_id === 'string' ? i.choice_id : ''))
    .filter(Boolean)

  const [byOptionId, byChoiceId, groupByChoiceId] = await Promise.all([
    fetchOptionsByIds(db, optionIds),
    fetchOptionsByChoiceIds(db, choiceIds),
    fetchProductChoiceGroups(db, choiceIds),
  ])

  const resolved = resolveJsonItems(
    itemsToResolve,
    byOptionId,
    byChoiceId,
    groupByChoiceId,
    guestCounts
  )

  if (fromRc.length > 0) {
    // orphan만 보완한 경우 RC 성공 행 + 해석 행 병합 (choice_id 기준 중복 제거)
    const seen = new Set(fromRc.map((r) => `${r.choice_id}:${r.option_id}`))
    for (const row of resolved) {
      const key = `${row.choice_id}:${row.option_id}`
      if (!seen.has(key)) {
        fromRc.push(row)
        seen.add(key)
      }
    }
    return fromRc
  }

  return resolved
}

/**
 * 목록 카드용 배치 해석. reservation_choices 우선, 비어 있으면 reservations.choices JSON + 옵션 매칭.
 */
export async function resolveReservationChoicesBatch(
  db: SupabaseClient,
  reservationIds: string[]
): Promise<Map<string, ResolvedChoiceRow[]>> {
  const unique = [...new Set(reservationIds.map((id) => String(id).trim()).filter(Boolean))]
  const out = new Map<string, ResolvedChoiceRow[]>()
  for (const id of unique) out.set(id, [])
  if (unique.length === 0) return out

  const { data: chData, error: chErr } = await db
    .from('reservation_choices')
    .select(
      `
      reservation_id,
      choice_id,
      option_id,
      quantity,
      option_key,
      choice_options (
        id,
        choice_id,
        option_key,
        option_name,
        option_name_ko,
        internal_name,
        badge_icon_url,
        adult_price
      ),
      product_choices (
        choice_group_ko
      )
    `
    )
    .in('reservation_id', unique)

  if (chErr) {
    console.error('reservation_choices batch 조회 실패:', chErr.message)
  }

  const unwrap = <T,>(raw: T | T[] | null | undefined): T | null => {
    if (raw == null) return null
    return Array.isArray(raw) ? (raw[0] ?? null) : raw
  }

  const needJsonIds = new Set<string>(unique)

  for (const raw of (chData ?? []) as Array<Record<string, unknown>>) {
    const rid = typeof raw.reservation_id === 'string' ? raw.reservation_id : ''
    if (!rid) continue

    const choiceId = typeof raw.choice_id === 'string' ? raw.choice_id : ''
    const optionId = typeof raw.option_id === 'string' ? raw.option_id : ''
    if (!choiceId || isUndecided(optionId)) continue

    const co = unwrap(raw.choice_options as ChoiceOptionRow | ChoiceOptionRow[] | null)
    const pc = unwrap(
      raw.product_choices as { choice_group_ko?: string | null } | { choice_group_ko?: string | null }[] | null
    )
    const quantity = Math.max(1, toNumber(raw.quantity, 1))

    if (co && (co.option_name_ko || co.option_name || co.internal_name || co.badge_icon_url)) {
      const arr = out.get(rid) ?? []
      const fallback: { option_key?: string } = {}
      if (typeof raw.option_key === 'string') fallback.option_key = raw.option_key
      arr.push(
        toResolved(choiceId, optionId, quantity, co as ChoiceOptionRow, pc?.choice_group_ko ?? null, fallback)
      )
      out.set(rid, arr)
      needJsonIds.delete(rid)
    }
  }

  // RC로 하나라도 채워진 예약은 JSON 폴백 생략. 전부 비었거나 orphan만 있던 예약은 JSON 사용.
  for (const rid of unique) {
    if ((out.get(rid) ?? []).length === 0) needJsonIds.add(rid)
  }

  if (needJsonIds.size === 0) return out

  const jsonIds = [...needJsonIds]
  const [{ data: reservations, error: resErr }, { data: pricingRows, error: pricingErr }] =
    await Promise.all([
      db
        .from('reservations')
        .select('id, choices, adults, child, total_people')
        .in('id', jsonIds),
      // reservations.choices 가 비어도 reservation_pricing.choices 에서 초이스 복원
      db.from('reservation_pricing').select('reservation_id, choices').in('reservation_id', jsonIds),
    ])

  if (resErr) {
    console.error('reservations.choices batch 조회 실패:', resErr.message)
    return out
  }
  if (pricingErr) {
    // pricing 조회 실패해도 치명적이지 않음
  }

  const pricingChoicesByRid = new Map<string, JsonChoiceItem[]>()
  for (const row of (pricingRows ?? []) as Array<{
    reservation_id?: string
    choices?: { required?: JsonChoiceItem[] } | null
  }>) {
    const rid = String(row.reservation_id ?? '')
    const required = row.choices?.required
    if (rid && Array.isArray(required) && required.length > 0) {
      pricingChoicesByRid.set(rid, required)
    }
  }

  type ResRow = {
    id?: string
    choices?: { required?: JsonChoiceItem[] } | null
    adults?: number | null
    child?: number | null
    total_people?: number | null
  }

  const allItems: Array<{ reservationId: string; item: JsonChoiceItem }> = []
  const guestByRid = new Map<string, { adults?: number; child?: number; total_people?: number }>()
  const seenRid = new Set<string>()
  for (const row of (reservations ?? []) as ResRow[]) {
    const rid = String(row.id ?? '')
    if (!rid) continue
    seenRid.add(rid)
    guestByRid.set(rid, {
      adults: toNumber(row.adults, 0),
      child: toNumber(row.child, 0),
      total_people: toNumber(row.total_people, 0),
    })
    const fromRes = row.choices?.required
    const required =
      Array.isArray(fromRes) && fromRes.length > 0 ? fromRes : pricingChoicesByRid.get(rid)
    if (!Array.isArray(required)) continue
    for (const item of required) {
      allItems.push({ reservationId: rid, item })
    }
  }

  const optionIds = allItems
    .map(({ item }) => (typeof item.option_id === 'string' ? item.option_id : ''))
    .filter(Boolean)
  const choiceIds = allItems
    .map(({ item }) => (typeof item.choice_id === 'string' ? item.choice_id : ''))
    .filter(Boolean)

  const [byOptionId, byChoiceId, groupByChoiceId] = await Promise.all([
    fetchOptionsByIds(db, optionIds),
    fetchOptionsByChoiceIds(db, choiceIds),
    fetchProductChoiceGroups(db, choiceIds),
  ])

  const byRidItems = new Map<string, JsonChoiceItem[]>()
  for (const { reservationId, item } of allItems) {
    const arr = byRidItems.get(reservationId) ?? []
    arr.push(item)
    byRidItems.set(reservationId, arr)
  }

  for (const rid of jsonIds) {
    const items = byRidItems.get(rid) ?? []
    out.set(
      rid,
      resolveJsonItems(items, byOptionId, byChoiceId, groupByChoiceId, guestByRid.get(rid))
    )
  }

  return out
}
