/**
 * 예약 상품과 다른 product_choices에 묶인 reservation_choices 행을
 * 현재 상품 초이스로 리매치하고, 이미 동일 그룹이 있으면 타상품 행은 제거한다.
 *
 * 예: MNGC1N(1박2일) 예약에 MDGC1D(당일) "로어 앤텔롭"이 남아
 * 로어 뱃지가 2번 보이던 문제.
 */
import { matchStoredChoiceToProductOption } from '@/lib/canyonChoice'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ProductChoiceOptionLike = {
  id: string
  option_key?: string | null
  canyon_key?: string | null
  canonical_option_key?: string | null
  option_name?: string | null
  option_name_ko?: string | null
}

export type ProductChoiceLike = {
  id: string
  choice_group?: string | null
  choice_group_ko?: string | null
  max_selections?: number | null
  options?: ProductChoiceOptionLike[] | null
}

export type ReservationChoiceRowLike = {
  choice_id: string
  option_id: string
  quantity?: number | undefined
  total_price?: number | undefined
  option_key?: string | undefined
  canyon_key?: string | null | undefined
  canonical_option_key?: string | null | undefined
  option_name_ko?: string | undefined
  choice_options?: {
    option_key?: string | null
    canyon_key?: string | null
    canonical_option_key?: string | null
    option_name?: string | null
    option_name_ko?: string | null
    product_choices?: {
      id?: string
      product_id?: string | null
      choice_group_ko?: string | null
    } | null
  } | null
}

function isUndecidedOptionId(optionId: string | null | undefined): boolean {
  if (!optionId) return true
  const v = String(optionId).trim()
  return !v || v === '__undecided__' || v === 'undecided'
}

function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim())
}

function norm(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase()
}

function namesMatch(a: string, b: string): boolean {
  const x = norm(a)
  const y = norm(b)
  if (!x || !y) return false
  return x === y || x.includes(y) || y.includes(x)
}

function findOptionInProduct(
  productChoices: ProductChoiceLike[],
  row: ReservationChoiceRowLike
): { choiceId: string; option: ProductChoiceOptionLike; groupKo: string | null } | null {
  if (!productChoices.length || isUndecidedOptionId(row.option_id)) return null

  for (const choice of productChoices) {
    const option = choice.options?.find((o) => o.id === row.option_id)
    if (option) {
      return {
        choiceId: choice.id,
        option,
        groupKo: choice.choice_group_ko ?? choice.choice_group ?? null,
      }
    }
  }

  const storedMatch = matchStoredChoiceToProductOption(
    productChoices.flatMap((c) => c.options ?? []),
    {
      canyon_key: row.canyon_key ?? row.choice_options?.canyon_key,
      canonical_option_key: row.canonical_option_key ?? row.choice_options?.canonical_option_key,
      option_key: row.choice_options?.option_key || row.option_key,
      option_name: row.choice_options?.option_name,
      option_name_ko: row.choice_options?.option_name_ko || row.option_name_ko,
    }
  )
  if (storedMatch) {
    const owner = productChoices.find((c) => c.options?.some((o) => o.id === storedMatch.id))
    if (owner) {
      return {
        choiceId: owner.id,
        option: storedMatch,
        groupKo: owner.choice_group_ko ?? owner.choice_group ?? null,
      }
    }
  }

  const keyRaw = (row.choice_options?.option_key || row.option_key || '').trim()
  const key = norm(keyRaw)
  if (key && !isUuid(keyRaw)) {
    for (const choice of productChoices) {
      const option = choice.options?.find((o) => norm(o.option_key) === key)
      if (option) {
        return {
          choiceId: choice.id,
          option,
          groupKo: choice.choice_group_ko ?? choice.choice_group ?? null,
        }
      }
    }
  }

  const nameKo = (row.choice_options?.option_name_ko || row.option_name_ko || '').trim()
  const nameEn = (row.choice_options?.option_name || '').trim()
  if (!nameKo && !nameEn) return null

  for (const choice of productChoices) {
    const option = choice.options?.find((o) => {
      const ok = o.option_name_ko || ''
      const on = o.option_name || ''
      return (
        (nameKo && (namesMatch(ok, nameKo) || namesMatch(on, nameKo))) ||
        (nameEn && (namesMatch(on, nameEn) || namesMatch(ok, nameEn)))
      )
    })
    if (option) {
      return {
        choiceId: choice.id,
        option,
        groupKo: choice.choice_group_ko ?? choice.choice_group ?? null,
      }
    }
  }

  return null
}

/**
 * 현재 상품 초이스 기준으로 행을 정규화한다.
 * - 현재 상품 choice_id → 유지
 * - 타상품 choice_id → 옵션명/키로 현재 상품에 리매치 (이미 같은 그룹이 있으면 스킵)
 * - 리매치 불가 타상품 행 → 제거
 */
export function normalizeReservationChoicesForProduct<T extends ReservationChoiceRowLike>(
  rows: T[],
  reservationProductId: string | null | undefined,
  productChoices: ProductChoiceLike[]
): T[] {
  if (!rows.length || !productChoices.length) return rows

  const currentIds = new Set(productChoices.map((c) => c.id))
  const native: T[] = []
  const foreign: T[] = []

  for (const row of rows) {
    if (isUndecidedOptionId(row.option_id) || currentIds.has(row.choice_id)) {
      native.push(row)
      continue
    }

    const rowProductId = row.choice_options?.product_choices?.product_id ?? null
    if (
      (reservationProductId && rowProductId && rowProductId !== reservationProductId) ||
      !currentIds.has(row.choice_id)
    ) {
      foreign.push(row)
    } else {
      native.push(row)
    }
  }

  const out: T[] = [...native]
  const coveredChoiceIds = new Set(out.map((r) => r.choice_id))

  for (const row of foreign) {
    const matched = findOptionInProduct(productChoices, row)
    if (!matched) continue
    if (coveredChoiceIds.has(matched.choiceId)) continue

    coveredChoiceIds.add(matched.choiceId)
    out.push({
      ...row,
      choice_id: matched.choiceId,
      option_id: matched.option.id,
      ...(matched.option.canyon_key
        ? { canyon_key: matched.option.canyon_key }
        : row.canyon_key
          ? { canyon_key: row.canyon_key }
          : {}),
      ...(matched.option.canonical_option_key
        ? { canonical_option_key: matched.option.canonical_option_key }
        : row.canonical_option_key
          ? { canonical_option_key: row.canonical_option_key }
          : {}),
      ...(matched.option.option_key
        ? { option_key: matched.option.option_key }
        : row.option_key
          ? { option_key: row.option_key }
          : {}),
      ...(matched.option.option_name_ko
        ? { option_name_ko: matched.option.option_name_ko }
        : row.option_name_ko
          ? { option_name_ko: row.option_name_ko }
          : {}),
      choice_options: {
        ...(row.choice_options || {}),
        option_key: matched.option.option_key ?? row.choice_options?.option_key ?? null,
        canyon_key: matched.option.canyon_key ?? row.choice_options?.canyon_key ?? row.canyon_key ?? null,
        canonical_option_key:
          matched.option.canonical_option_key ??
          row.choice_options?.canonical_option_key ??
          row.canonical_option_key ??
          null,
        option_name: matched.option.option_name ?? row.choice_options?.option_name ?? null,
        option_name_ko:
          matched.option.option_name_ko ?? row.choice_options?.option_name_ko ?? null,
        product_choices: {
          id: matched.choiceId,
          product_id: reservationProductId ?? row.choice_options?.product_choices?.product_id ?? null,
          choice_group_ko:
            matched.groupKo ?? row.choice_options?.product_choices?.choice_group_ko ?? null,
        },
      },
    })
  }

  return out
}
