import { supabase } from '@/lib/supabase'
import { getLowestChoiceAddonTotal } from '@/lib/productChoiceGrouping'

type ChoiceOptionRow = {
  adult_price?: number | string | null
  is_active?: boolean | null
}

type ProductChoiceRow = {
  product_id: string
  id: string
  options?: ChoiceOptionRow[] | null
}

function parseOptionPrice(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/** 상품별 초이스 최저 시작가(그룹별 최저 옵션가 합) 맵 */
export async function fetchLowestChoicePricesByProductIds(
  productIds: string[]
): Promise<Record<string, number>> {
  const ids = [...new Set(productIds.filter(Boolean))]
  if (ids.length === 0) return {}

  const { data, error } = await supabase
    .from('product_choices')
    .select(
      `
      product_id,
      id,
      options:choice_options (
        adult_price,
        is_active
      )
    `
    )
    .in('product_id', ids)

  if (error) {
    console.error('초이스 최저가 조회 오류:', error)
    return {}
  }

  const flatByProduct = new Map<
    string,
    Array<{ choice_id: string; option_price: number | null }>
  >()

  for (const row of (data ?? []) as ProductChoiceRow[]) {
    const productId = row.product_id
    if (!productId) continue
    const options = Array.isArray(row.options) ? row.options : []
    const list = flatByProduct.get(productId) ?? []

    for (const option of options) {
      if (option.is_active === false) continue
      list.push({
        choice_id: row.id,
        option_price: parseOptionPrice(option.adult_price),
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
