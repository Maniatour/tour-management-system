import { applyStoredCanyonChoices, choiceKeyFromStoredChoiceRow } from '@/lib/canyonChoice'
import { isCanyonTourChoiceKey, type ReservationChoiceRow } from '@/lib/tourChoiceCounts'
import { SUPABASE_IN_FILTER_CHUNK_SIZE, chunkStrings } from '@/lib/supabaseInChunks'

type QueryClient = { from: (table: string) => any }

/** 조인 없이 canyon_key / option_key만 — 인쇄·달력 L/X 판별의 기본 경로 */
const SELECT_COLUMNS = 'reservation_id, quantity, option_key, canyon_key, canonical_option_key'
const SELECT_WITH_FK =
  `${SELECT_COLUMNS}, choice_options!reservation_choices_option_id_fkey(option_key, option_name_ko, option_name)`
const SELECT_PLAIN = `${SELECT_COLUMNS}, choice_options(option_key, option_name_ko, option_name)`

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

function ingestChoiceQueryRows(map: Map<string, ReservationChoiceRow[]>, rows: ReservationChoiceQueryRow[]) {
  for (const row of rows) {
    const parsed = choiceRowFromQuery(row)
    const rid = row.reservation_id?.trim()
    if (!rid || !parsed) continue
    pushChoice(map, rid, parsed)
  }
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

async function selectReservationChoices(
  supabase: QueryClient,
  reservationIds: string[],
  select: string
): Promise<{ rows: ReservationChoiceQueryRow[]; error: { message?: string } | null }> {
  if (reservationIds.length === 0) return { rows: [], error: null }
  const chunks = chunkStrings(reservationIds, SUPABASE_IN_FILTER_CHUNK_SIZE)
  const parts = await Promise.all(
    chunks.map(async (batchIds) => {
      const { data, error } = await supabase
        .from('reservation_choices')
        .select(select)
        .in('reservation_id', batchIds)
      return { data: (data || []) as ReservationChoiceQueryRow[], error }
    })
  )
  const error = parts.find((p) => p.error)?.error ?? null
  return { rows: parts.flatMap((p) => p.data), error }
}

/**
 * 입장권 달력 X/L 집계용.
 * - 기본은 reservation_choices 컬럼만 조회 (choice_options 조인 없음)
 * - canyon_key / canonical_option_key / option_key로 판별되지 않는 ID만 조인 폴백
 * - inner join을 쓰지 않아 option_id 없는 행을 버리지 않음
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

  const columns = await selectReservationChoices(supabase, ids, SELECT_COLUMNS)
  if (columns.error) {
    console.warn('캐년 초이스 조회:', columns.error.message)
  } else {
    ingestChoiceQueryRows(map, columns.rows)
  }

  if (reservationsForJsonFallback?.length) {
    appendCanyonChoicesFromReservationJson(map, reservationsForJsonFallback)
  }

  const unresolved = ids.filter((id) => !hasCanyonChoice(map.get(id)))
  if (unresolved.length === 0) return map

  let joined = await selectReservationChoices(supabase, unresolved, SELECT_WITH_FK)
  if (joined.error) {
    joined = await selectReservationChoices(supabase, unresolved, SELECT_PLAIN)
  }
  if (joined.error) {
    console.warn('캐년 초이스 조인 조회:', joined.error.message)
    return map
  }
  ingestChoiceQueryRows(map, joined.rows)
  return map
}

export type CalendarChoiceReservation = {
  id: string
  canyon_choice?: string | null
  choices?: unknown
}

/**
 * 달력·체크인·인쇄: 저장된 canyon_choice → choices JSON → reservation_choices.
 * 네트워크 조회는 canyon_choice/JSON으로 안 잡힌 예약만.
 */
export async function loadCalendarChoiceRows(
  supabase: QueryClient,
  reservations: CalendarChoiceReservation[]
): Promise<Map<string, ReservationChoiceRow[]>> {
  const map = new Map<string, ReservationChoiceRow[]>()
  applyStoredCanyonChoices(map, reservations)
  appendCanyonChoicesFromReservationJson(map, reservations)
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
