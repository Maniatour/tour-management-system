import { applyStoredCanyonChoices, choiceKeyFromStoredChoiceRow } from '@/lib/canyonChoice'
import { isCanyonTourChoiceKey, type ReservationChoiceRow } from '@/lib/tourChoiceCounts'

type QueryClient = { from: (table: string) => any }

const SELECT_WITH_FK =
  'reservation_id, quantity, option_key, canyon_key, canonical_option_key, choice_options!reservation_choices_option_id_fkey(option_key, option_name_ko, option_name)'
const SELECT_PLAIN =
  'reservation_id, quantity, option_key, canyon_key, canonical_option_key, choice_options(option_key, option_name_ko, option_name)'

type ChoiceOptionEmbed = {
  option_key?: string | null
  option_name_ko?: string | null
  option_name?: string | null
  canyon_key?: string | null
  canonical_option_key?: string | null
}

type ReservationChoiceQueryRow = {
  reservation_id?: string | null
  quantity?: number | null
  option_key?: string | null
  canyon_key?: string | null
  canonical_option_key?: string | null
  choice_options?: ChoiceOptionEmbed | ChoiceOptionEmbed[] | null
}

function unwrapChoiceOption(raw: unknown): ChoiceOptionEmbed | null {
  if (!raw) return null
  if (Array.isArray(raw)) {
    const first = raw[0]
    return first && typeof first === 'object' ? (first as ChoiceOptionEmbed) : null
  }
  if (typeof raw === 'object') return raw as ChoiceOptionEmbed
  return null
}

function hasCanyonChoice(rows: ReservationChoiceRow[] | undefined): boolean {
  return Boolean(rows?.some((r) => isCanyonTourChoiceKey(r.choiceKey)))
}

function pushChoice(
  map: Map<string, ReservationChoiceRow[]>,
  reservationId: string,
  row: ReservationChoiceRow
) {
  const list = map.get(reservationId) || []
  list.push(row)
  map.set(reservationId, list)
}

function choiceRowFromQuery(row: ReservationChoiceQueryRow): ReservationChoiceRow | null {
  const rid = row.reservation_id?.trim()
  if (!rid) return null
  const opt = unwrapChoiceOption(row.choice_options)
  const choiceKey = choiceKeyFromStoredChoiceRow({
    canyon_key: row.canyon_key,
    canonical_option_key: row.canonical_option_key ?? opt?.canonical_option_key,
    option_key: opt?.option_key ?? row.option_key,
    option_name_ko: opt?.option_name_ko,
    option_name: opt?.option_name,
  })
  return { choiceKey, quantity: Number(row.quantity) || 1 }
}

function parseJsonUnknown(val: unknown): unknown {
  if (val == null) return null
  if (typeof val === 'object') return val
  if (typeof val !== 'string') return null
  try {
    return JSON.parse(val)
  } catch {
    return null
  }
}

/** 예전 예약: reservation_choices 없이 reservations.choices JSON만 있는 경우 */
export function appendCanyonChoicesFromReservationJson(
  map: Map<string, ReservationChoiceRow[]>,
  reservations: Array<{ id: string; choices?: unknown }>
) {
  for (const r of reservations) {
    if (!r.id || hasCanyonChoice(map.get(r.id)) || r.choices == null) continue
    const choicesObj = parseJsonUnknown(r.choices) as Record<string, unknown> | null
    if (!choicesObj || !Array.isArray(choicesObj.required)) continue
    for (const item of choicesObj.required as Array<Record<string, unknown>>) {
      const qty = Number(item.quantity) || 1
      if (item.option_id || item.option_key || item.canonical_option_key || item.canyon_key || item.option_name_ko || item.option_name) {
        const choiceKey = choiceKeyFromStoredChoiceRow({
          canyon_key: (item.canyon_key as string | null) ?? null,
          canonical_option_key: (item.canonical_option_key as string | null) ?? null,
          option_key: (item.option_key as string | null) ?? null,
          option_name_ko: (item.option_name_ko as string | null) ?? null,
          option_name: (item.option_name as string | null) ?? null,
        })
        pushChoice(map, r.id, { choiceKey, quantity: qty })
        continue
      }
      if (!Array.isArray(item.options)) continue
      for (const opt of item.options as Array<Record<string, unknown>>) {
        if (!(opt.selected || opt.is_default)) continue
        const choiceKey = choiceKeyFromStoredChoiceRow({
          canyon_key: (opt.canyon_key as string | null) ?? null,
          canonical_option_key: (opt.canonical_option_key as string | null) ?? null,
          option_key: (opt.option_key as string | null) ?? null,
          option_name_ko: (opt.name_ko as string | null) ?? (opt.option_name_ko as string | null) ?? null,
          option_name: (opt.name as string | null) ?? (opt.option_name as string | null) ?? null,
        })
        pushChoice(map, r.id, { choiceKey, quantity: qty })
      }
    }
  }
}

/**
 * 입장권 달력 X/L 집계용.
 * - choice_options 조인이 없는 예전 행도 reservation_choices.option_key 사용
 * - inner join을 쓰지 않아 option_id 없는 행을 버리지 않음
 * - 배치 오류는 건너뛰고 나머지 예약은 계속 로드
 */
export async function fetchCanyonChoiceRowsByReservationIds(
  supabase: QueryClient,
  reservationIds: string[],
  reservationsForJsonFallback?: Array<{ id: string; choices?: unknown }>
): Promise<Map<string, ReservationChoiceRow[]>> {
  const map = new Map<string, ReservationChoiceRow[]>()
  const ids = [...new Set(reservationIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) {
    if (reservationsForJsonFallback?.length) {
      appendCanyonChoicesFromReservationJson(map, reservationsForJsonFallback)
    }
    return map
  }

  const BATCH = 250
  let select = SELECT_WITH_FK
  let usePlainSelect = false

  for (let i = 0; i < ids.length; i += BATCH) {
    const batchIds = ids.slice(i, i + BATCH)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let { data, error } = await (supabase as any)
      .from('reservation_choices')
      .select(select)
      .in('reservation_id', batchIds)

    if (error && !usePlainSelect) {
      usePlainSelect = true
      select = SELECT_PLAIN
      const retry = await (supabase as any)
        .from('reservation_choices')
        .select(select)
        .in('reservation_id', batchIds)
      data = retry.data
      error = retry.error
    }

    if (error) {
      console.warn('캐년 초이스 조회:', error)
      continue
    }

    for (const row of (data || []) as ReservationChoiceQueryRow[]) {
      const parsed = choiceRowFromQuery(row)
      const rid = row.reservation_id?.trim()
      if (!rid || !parsed) continue
      pushChoice(map, rid, parsed)
    }
  }

  if (reservationsForJsonFallback?.length) {
    appendCanyonChoicesFromReservationJson(map, reservationsForJsonFallback)
  }

  return map
}

export type CalendarChoiceReservation = {
  id: string
  canyon_choice?: string | null
  choices?: unknown
}

/** 달력·체크인: 저장된 canyon_choice 우선, 없으면 초이스 행/JSON 폴백 */
export async function loadCalendarChoiceRows(
  supabase: QueryClient,
  reservations: CalendarChoiceReservation[]
): Promise<Map<string, ReservationChoiceRow[]>> {
  const map = new Map<string, ReservationChoiceRow[]>()
  applyStoredCanyonChoices(map, reservations)
  const missing = reservations.filter((r) => r.id && !hasCanyonChoice(map.get(r.id)))
  if (missing.length === 0) return map

  const fallback = await fetchCanyonChoiceRowsByReservationIds(
    supabase,
    missing.map((r) => r.id),
    missing
  )
  for (const [id, rows] of fallback) {
    if (!hasCanyonChoice(map.get(id))) map.set(id, rows)
  }
  return map
}

