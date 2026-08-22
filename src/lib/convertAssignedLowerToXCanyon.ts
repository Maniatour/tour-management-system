/**
 * 우천으로 Lower Antelope(L)가 닫혀 X Canyon으로 진행할 때
 * 배정된 예약의 초이스를 X로 바꾸고, 인원당 $10 추가할인·잔액을 반영한다.
 */
import {
  canyonKeyFromLabels,
  canonicalOptionKeyFromCanyon,
  choiceKeyFromStoredChoiceRow,
  CANYON_CHOICE_LABELS,
  type ProductOptionCanyonLike,
} from '@/lib/canyonChoice'
import { chunkStrings } from '@/lib/supabaseInChunks'
import { isReservationCancelledStatus, isReservationDeletedStatus } from '@/utils/tourUtils'
import { getReservationPartySize } from '@/utils/reservationUtils'

export const LOWER_TO_X_DISCOUNT_PER_PERSON_USD = 10

type QueryClient = { from: (table: string) => any }

export type CanyonProductOption = ProductOptionCanyonLike & {
  choice_id: string
}

function roundUsd2(n: number): number {
  return Math.round(n * 100) / 100
}

type CanyonCatalog = {
  xOption: CanyonProductOption | null
  lowerOptionIds: Set<string>
}

function optionCanyonKey(opt: ProductOptionCanyonLike): 'X' | 'L' | 'U' | null {
  if (opt.canyon_key === 'X' || opt.canyon_key === 'L' || opt.canyon_key === 'U') {
    return opt.canyon_key
  }
  return canyonKeyFromLabels(
    opt.option_name_ko,
    opt.option_name,
    opt.canonical_option_key ?? opt.option_key
  )
}

function isLowerStoredChoice(
  row: {
    canyon_key?: string | null
    canonical_option_key?: string | null
    option_key?: string | null
    option_name?: string | null
    option_name_ko?: string | null
    option_id?: string | null
  },
  lowerOptionIds?: Set<string>
): boolean {
  if (choiceKeyFromStoredChoiceRow(row) === 'L') return true
  const optionId = String(row.option_id || '').trim()
  return Boolean(optionId && lowerOptionIds?.has(optionId))
}

function remapCanyonChoicesJson(
  choices: unknown,
  xOption: CanyonProductOption,
  lowerOptionIds?: Set<string>
): unknown {
  if (!choices || typeof choices !== 'object') return choices
  const obj = { ...(choices as Record<string, unknown>) }
  const labels = CANYON_CHOICE_LABELS.X
  const patchItem = (item: Record<string, unknown>): Record<string, unknown> => {
    if (!isLowerStoredChoice(item, lowerOptionIds)) return item
    return {
      ...item,
      choice_id: xOption.choice_id,
      option_id: xOption.id,
      option_key: xOption.option_key || canonicalOptionKeyFromCanyon('X'),
      canyon_key: 'X',
      canonical_option_key:
        xOption.canonical_option_key || canonicalOptionKeyFromCanyon('X'),
      option_name: xOption.option_name || labels.option_name,
      option_name_ko: xOption.option_name_ko || labels.option_name_ko,
    }
  }

  if (Array.isArray(obj.required)) {
    obj.required = obj.required.map((item) => {
      if (!item || typeof item !== 'object') return item
      const row = item as Record<string, unknown>
      const patched = patchItem(row)
      if (Array.isArray(row.options)) {
        patched.options = (row.options as Array<Record<string, unknown>>).map((opt) => {
          if (!opt || typeof opt !== 'object') return opt
          if (isLowerStoredChoice(opt, lowerOptionIds)) {
            return {
              ...opt,
              ...patchItem(opt),
              selected: true,
            }
          }
          return opt
        })
      }
      return patched
    })
  }

  return obj
}

async function loadCanyonCatalogForProduct(
  supabase: QueryClient,
  productId: string
): Promise<CanyonCatalog> {
  const empty: CanyonCatalog = { xOption: null, lowerOptionIds: new Set() }
  const { data, error } = await supabase
    .from('product_choices')
    .select(
      `
      id,
      options:choice_options (
        id,
        option_key,
        canyon_key,
        canonical_option_key,
        option_name,
        option_name_ko
      )
    `
    )
    .eq('product_id', productId)

  if (error || !data) return empty

  const lowerOptionIds = new Set<string>()
  let xOption: CanyonProductOption | null = null

  for (const group of data as Array<{
    id: string
    options?: ProductOptionCanyonLike[] | null
  }>) {
    for (const opt of group.options || []) {
      if (!opt.id) continue
      const canyon = optionCanyonKey(opt)
      if (canyon === 'L') lowerOptionIds.add(String(opt.id))
      if (canyon === 'X' && !xOption) {
        xOption = {
          ...opt,
          id: String(opt.id),
          choice_id: group.id,
        }
      }
    }
  }

  return { xOption, lowerOptionIds }
}

export type ConvertAssignedLowerToXResult = {
  converted: number
  skipped: number
  errors: string[]
}

export async function convertAssignedLowerCanyonToX(args: {
  supabase: QueryClient
  reservationIds: string[]
  fallbackProductId?: string | null
}): Promise<ConvertAssignedLowerToXResult> {
  const ids = [...new Set(args.reservationIds.map((id) => String(id).trim()).filter(Boolean))]
  const errors: string[] = []
  if (ids.length === 0) {
    return { converted: 0, skipped: 0, errors: [] }
  }

  const reservations: Array<{
    id: string
    product_id: string | null
    status: string | null
    adults: number | null
    child: number | null
    infant: number | null
    total_people: number | null
    canyon_choice: string | null
    choices: unknown
  }> = []

  for (const chunk of chunkStrings(ids)) {
    const { data, error } = await args.supabase
      .from('reservations')
      .select('id, product_id, status, adults, child, infant, total_people, canyon_choice, choices')
      .in('id', chunk)
    if (error) {
      return { converted: 0, skipped: 0, errors: [error.message] }
    }
    reservations.push(...((data || []) as typeof reservations))
  }

  const choiceRows: Array<{
    id: string
    reservation_id: string | null
    choice_id: string | null
    option_id: string | null
    option_key: string | null
    canyon_key: string | null
    canonical_option_key: string | null
    quantity: number | null
  }> = []

  for (const chunk of chunkStrings(ids)) {
    const { data, error } = await args.supabase
      .from('reservation_choices')
      .select('id, reservation_id, choice_id, option_id, option_key, canyon_key, canonical_option_key, quantity')
      .in('reservation_id', chunk)
    if (error) {
      return { converted: 0, skipped: 0, errors: [error.message] }
    }
    choiceRows.push(...((data || []) as typeof choiceRows))
  }

  const choicesByRes = new Map<string, typeof choiceRows>()
  for (const row of choiceRows) {
    const rid = String(row.reservation_id || '')
    if (!rid) continue
    const list = choicesByRes.get(rid) || []
    list.push(row)
    choicesByRes.set(rid, list)
  }

  const catalogByProduct = new Map<string, CanyonCatalog>()
  const getCatalog = async (productId: string | null | undefined) => {
    const pid = String(productId || args.fallbackProductId || '').trim()
    if (!pid) return { xOption: null, lowerOptionIds: new Set<string>() }
    const cached = catalogByProduct.get(pid)
    if (cached) return cached
    const catalog = await loadCanyonCatalogForProduct(args.supabase, pid)
    catalogByProduct.set(pid, catalog)
    return catalog
  }

  let converted = 0
  let skipped = 0

  for (const res of reservations) {
    if (isReservationCancelledStatus(res.status) || isReservationDeletedStatus(res.status)) {
      skipped += 1
      continue
    }

    const catalog = await getCatalog(res.product_id)
    const lowerIds = catalog.lowerOptionIds
    const rows = choicesByRes.get(res.id) || []
    const hasLowerChoice = rows.some((row) => isLowerStoredChoice(row, lowerIds))
    const jsonIsLower =
      res.choices != null &&
      typeof res.choices === 'object' &&
      Array.isArray((res.choices as { required?: unknown }).required) &&
      ((res.choices as { required: Array<Record<string, unknown>> }).required || []).some((item) =>
        item && typeof item === 'object' ? isLowerStoredChoice(item, lowerIds) : false
      )
    const summaryIsLower = res.canyon_choice === 'L'

    if (!hasLowerChoice && !jsonIsLower && !summaryIsLower) {
      skipped += 1
      continue
    }

    const xOption = catalog.xOption
    if (!xOption) {
      errors.push(`${res.id}: X Canyon 옵션을 찾을 수 없습니다.`)
      skipped += 1
      continue
    }

    const people = Math.max(1, getReservationPartySize(res as Record<string, unknown>))
    const discountAdd = roundUsd2(LOWER_TO_X_DISCOUNT_PER_PERSON_USD * people)

    const lowerRows = rows.filter((row) => isLowerStoredChoice(row, lowerIds))
    if (lowerRows.length > 0) {
      for (const row of lowerRows) {
        const { error } = await args.supabase
          .from('reservation_choices')
          .update({
            choice_id: xOption.choice_id,
            option_id: xOption.id,
            option_key: xOption.option_key || canonicalOptionKeyFromCanyon('X'),
            canyon_key: 'X',
            canonical_option_key: xOption.canonical_option_key || canonicalOptionKeyFromCanyon('X'),
          })
          .eq('id', row.id)
        if (error) {
          errors.push(`${res.id}: 초이스 업데이트 실패 (${error.message})`)
        }
      }
    } else if (!rows.some((row) => choiceKeyFromStoredChoiceRow(row) === 'X')) {
      const { error } = await args.supabase.from('reservation_choices').insert({
        reservation_id: res.id,
        choice_id: xOption.choice_id,
        option_id: xOption.id,
        option_key: xOption.option_key || canonicalOptionKeyFromCanyon('X'),
        canyon_key: 'X',
        canonical_option_key: xOption.canonical_option_key || canonicalOptionKeyFromCanyon('X'),
        quantity: 1,
        total_price: 0,
      })
      if (error) {
        errors.push(`${res.id}: 초이스 추가 실패 (${error.message})`)
      }
    }

    const nextChoices = remapCanyonChoicesJson(res.choices, xOption, lowerIds)
    const { error: resErr } = await args.supabase
      .from('reservations')
      .update({
        canyon_choice: 'X',
        ...(nextChoices !== res.choices ? { choices: nextChoices } : {}),
      })
      .eq('id', res.id)
    if (resErr) {
      errors.push(`${res.id}: 예약 초이스 저장 실패 (${resErr.message})`)
    }

    const { data: pricingRow, error: pricingLoadErr } = await args.supabase
      .from('reservation_pricing')
      .select('id, additional_discount, total_price, balance_amount, choices')
      .eq('reservation_id', res.id)
      .maybeSingle()

    if (pricingLoadErr) {
      errors.push(`${res.id}: 가격 조회 실패 (${pricingLoadErr.message})`)
      converted += 1
      continue
    }

    if (!pricingRow?.id) {
      errors.push(`${res.id}: 가격 정보가 없어 할인을 적용하지 못했습니다.`)
      converted += 1
      continue
    }

    const additionalDiscount = roundUsd2(Number(pricingRow.additional_discount) || 0) + discountAdd
    const totalPrice = roundUsd2(Math.max(0, (Number(pricingRow.total_price) || 0) - discountAdd))
    const prevBalance = Number(pricingRow.balance_amount)
    const balanceBase = Number.isFinite(prevBalance) ? prevBalance : 0
    const balanceAmount = roundUsd2(balanceBase - discountAdd)
    const nextPricingChoices = remapCanyonChoicesJson(pricingRow.choices, xOption, lowerIds)

    const { error: pricingErr } = await args.supabase
      .from('reservation_pricing')
      .update({
        additional_discount: additionalDiscount,
        total_price: totalPrice,
        balance_amount: balanceAmount,
        ...(nextPricingChoices !== pricingRow.choices ? { choices: nextPricingChoices } : {}),
      })
      .eq('id', pricingRow.id)

    if (pricingErr) {
      errors.push(`${res.id}: 할인/잔액 저장 실패 (${pricingErr.message})`)
    }

    converted += 1
  }

  return { converted, skipped, errors }
}
