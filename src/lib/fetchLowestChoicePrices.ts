import { supabase } from '@/lib/supabase'
import { getLowestChoiceAddonTotal } from '@/lib/productChoiceGrouping'
import { withChoiceProcessingFee } from '@/lib/choiceProcessingFee'

type ChoiceOptionRow = {
  adult_price?: number | string | null
  is_active?: boolean | null
}

type ProductChoiceRow = {
  product_id: string
  id: string
  apply_processing_fee?: boolean | null
  options?: ChoiceOptionRow[] | null
}

const CHOICE_PRICE_SELECT: string = `
      product_id,
      id,
      apply_processing_fee,
      options:choice_options (
        adult_price,
        is_active
      )
    `

const CHOICE_PRICE_SELECT_WITHOUT_FEE: string = `
      product_id,
      id,
      options:choice_options (
        adult_price,
        is_active
      )
    `

/** 원격 DB에 apply_processing_fee가 아직 없을 때, 같은 세션에서 반복 400을 피함 */
let omitApplyProcessingFeeColumn = false

function parseOptionPrice(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function formatChoicePriceQueryError(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error)
  const e = error as { message?: string; details?: string; hint?: string; code?: string }
  const parts = [e.message, e.details, e.hint, e.code].filter(
    (part): part is string => typeof part === 'string' && part.trim().length > 0
  )
  return parts.join(' · ') || 'unknown'
}

function isMissingApplyProcessingFeeColumn(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: string; message?: string }
  const msg = String(e.message ?? '').toLowerCase()
  return (
    msg.includes('apply_processing_fee') &&
    (e.code === 'PGRST204' ||
      e.code === '42703' ||
      msg.includes('does not exist') ||
      msg.includes('could not find') ||
      msg.includes('schema cache'))
  )
}

/** 상품별 초이스 최저 시작가(그룹별 최저 옵션가 합) 맵 */
export async function fetchLowestChoicePricesByProductIds(
  productIds: string[]
): Promise<Record<string, number>> {
  const ids = [...new Set(productIds.filter(Boolean))]
  if (ids.length === 0) return {}

  const query = (includeFee: boolean) =>
    supabase
      .from('product_choices')
      .select(includeFee ? CHOICE_PRICE_SELECT : CHOICE_PRICE_SELECT_WITHOUT_FEE)
      .in('product_id', ids)

  let includeFee = !omitApplyProcessingFeeColumn
  let { data, error } = await query(includeFee)

  if (error && includeFee && isMissingApplyProcessingFeeColumn(error)) {
    omitApplyProcessingFeeColumn = true
    const retry = await query(false)
    data = retry.data
    error = retry.error
  }

  if (error) {
    console.error('초이스 최저가 조회 오류:', formatChoicePriceQueryError(error))
    return {}
  }

  const flatByProduct = new Map<
    string,
    Array<{ choice_id: string; option_price: number | null }>
  >()

  for (const row of (data ?? []) as unknown as ProductChoiceRow[]) {
    const productId = row.product_id
    if (!productId) continue
    const options = Array.isArray(row.options) ? row.options : []
    const list = flatByProduct.get(productId) ?? []

    for (const option of options) {
      if (option.is_active === false) continue
      list.push({
        choice_id: row.id,
        option_price: withChoiceProcessingFee(
          parseOptionPrice(option.adult_price),
          row.apply_processing_fee === true
        ),
      })
    }

    flatByProduct.set(productId, list)
  }

  const result: Record<string, number> = {}
  for (const [productId, choices] of flatByProduct) {
    const lowest = getLowestChoiceAddonTotal(choices)
    if (lowest != null && lowest > 0) {
      result[productId] = lowest
    }
  }

  return result
}

/** 상품 행에 lowest_choice_price를 붙여 카드 가격 폴백에 사용 */
export async function withLowestChoicePrices<T extends { id: string }>(
  products: T[]
): Promise<Array<T & { lowest_choice_price: number | null }>> {
  if (products.length === 0) return []

  const priceMap = await fetchLowestChoicePricesByProductIds(products.map((p) => p.id))

  return products.map((product) => ({
    ...product,
    lowest_choice_price: priceMap[product.id] ?? null,
  }))
}
