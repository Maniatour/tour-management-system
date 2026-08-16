/**
 * 캐년 초이스 정본 키.
 * - canyon_key: 달력·재고·OTA availability (X/L/U)
 * - canonical_option_key: OTA SKU 매핑용 안정 키 (antelope_x 등)
 * choice_options.id UUID는 상품 초이스 재저장 시 바뀌므로 정본으로 쓰지 않음.
 */
import {
  choiceLabelToTourCountKey,
  isCanyonTourChoiceKey,
  type ReservationChoiceRow,
  type TourChoiceCountKey,
} from '@/lib/tourChoiceCounts'

export type CanyonKey = 'X' | 'L' | 'U'

export const CANONICAL_CANYON_OPTION_KEYS = {
  X: 'antelope_x',
  L: 'lower_antelope',
  U: 'upper_antelope',
} as const satisfies Record<CanyonKey, string>

export function isCanyonKey(value: string | null | undefined): value is CanyonKey {
  return value === 'X' || value === 'L' || value === 'U'
}

export function canonicalOptionKeyFromCanyon(key: CanyonKey): string {
  return CANONICAL_CANYON_OPTION_KEYS[key]
}

export function canyonKeyFromLabels(
  nameKo: string | null | undefined,
  nameEn: string | null | undefined,
  optionKey: string | null | undefined
): CanyonKey | null {
  const mapped = choiceLabelToTourCountKey(nameKo, nameEn, optionKey)
  return isCanyonTourChoiceKey(mapped) ? mapped : null
}

export function choiceRowsFromCanyonChoice(
  canyonChoice: string | null | undefined
): ReservationChoiceRow[] {
  if (!isCanyonKey(canyonChoice)) return []
  return [{ choiceKey: canyonChoice, quantity: 1 }]
}

export function applyStoredCanyonChoices(
  map: Map<string, ReservationChoiceRow[]>,
  reservations: Array<{ id: string; canyon_choice?: string | null }>
) {
  for (const r of reservations) {
    if (!r.id) continue
    const existing = map.get(r.id)
    if (existing?.some((row) => isCanyonTourChoiceKey(row.choiceKey))) continue
    const rows = choiceRowsFromCanyonChoice(r.canyon_choice)
    if (rows.length > 0) map.set(r.id, rows)
  }
}

export const CANYON_CHOICE_LABELS: Record<
  CanyonKey,
  { option_name_ko: string; option_name: string; choice_group_ko: string }
> = {
  X: {
    option_name_ko: '엑스 앤텔롭 캐년',
    option_name: 'Antelope X Canyon',
    choice_group_ko: '앤텔롭 캐년 선택',
  },
  L: {
    option_name_ko: '로어 앤텔롭 캐년',
    option_name: 'Lower Antelope Canyon',
    choice_group_ko: '앤텔롭 캐년 선택',
  },
  U: {
    option_name_ko: '어퍼 앤텔롭 캐년',
    option_name: 'Upper Antelope Canyon',
    choice_group_ko: '앤텔롭 캐년 선택',
  },
}

export function displayNamesFromCanyonKey(key: string | null | undefined): {
  option_name_ko: string
  option_name: string
  choice_group_ko: string
} | null {
  if (!isCanyonKey(key)) return null
  return CANYON_CHOICE_LABELS[key]
}

export function choiceKeyFromStoredChoiceRow(row: {
  canyon_key?: string | null | undefined
  canonical_option_key?: string | null | undefined
  option_key?: string | null | undefined
  option_name_ko?: string | null | undefined
  option_name?: string | null | undefined
}): TourChoiceCountKey {
  if (isCanyonKey(row.canyon_key)) return row.canyon_key
  return choiceLabelToTourCountKey(
    row.option_name_ko,
    row.option_name,
    row.canonical_option_key ?? row.option_key
  )
}

export type StoredCanyonChoiceMatch = {
  canyon_key?: string | null | undefined
  canonical_option_key?: string | null | undefined
  option_key?: string | null | undefined
  option_name?: string | null | undefined
  option_name_ko?: string | null | undefined
}

export type ProductOptionCanyonLike = {
  id: string
  option_key?: string | null
  canyon_key?: string | null
  canonical_option_key?: string | null
  option_name?: string | null
  option_name_ko?: string | null
}

/** 저장된 canyon_key / canonical_option_key로 현재 상품 옵션을 찾는다. UUID option_key는 쓰지 않는다. */
export function matchStoredChoiceToProductOption<T extends ProductOptionCanyonLike>(
  options: T[] | null | undefined,
  stored: StoredCanyonChoiceMatch
): T | null {
  if (!options?.length) return null

  const storedCanyon =
    (isCanyonKey(stored.canyon_key) ? stored.canyon_key : null) ??
    canyonKeyFromLabels(stored.option_name_ko, stored.option_name, stored.canonical_option_key ?? stored.option_key)

  if (storedCanyon) {
    const byCanyon = options.find((o) => o.canyon_key === storedCanyon)
    if (byCanyon) return byCanyon

    const canon = stored.canonical_option_key || canonicalOptionKeyFromCanyon(storedCanyon)
    const byCanon = options.find(
      (o) =>
        o.canonical_option_key === canon ||
        o.option_key === canon
    )
    if (byCanon) return byCanon

    const byDerived = options.find(
      (o) => canyonKeyFromLabels(o.option_name_ko, o.option_name, o.canonical_option_key ?? o.option_key) === storedCanyon
    )
    if (byDerived) return byDerived
  }

  const canonKey = (stored.canonical_option_key || '').trim()
  if (canonKey) {
    const byCanon = options.find(
      (o) => o.canonical_option_key === canonKey || o.option_key === canonKey
    )
    if (byCanon) return byCanon
  }

  return null
}

export function hydrateChoiceDisplayNames(input: {
  canyon_key?: string | null | undefined
  canonical_option_key?: string | null | undefined
  option_key?: string | null | undefined
  option_name?: string | null | undefined
  option_name_ko?: string | null | undefined
  choice_group_ko?: string | null | undefined
}): {
  option_key: string | null
  option_name: string | null
  option_name_ko: string | null
  choice_group_ko: string | null
} {
  const labels = displayNamesFromCanyonKey(input.canyon_key)
  return {
    option_key:
      input.option_key ||
      input.canonical_option_key ||
      (isCanyonKey(input.canyon_key) ? canonicalOptionKeyFromCanyon(input.canyon_key) : null),
    option_name: input.option_name || labels?.option_name || null,
    option_name_ko: input.option_name_ko || labels?.option_name_ko || null,
    choice_group_ko: input.choice_group_ko || labels?.choice_group_ko || null,
  }
}
