import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'

export type BundleDiscountType = 'percentage' | 'fixed'

export type ProductBundleDiscountRule = {
  sourceProductId: string
  bundledProductId: string
  discountType: BundleDiscountType
  discountValue: number
}

export type BundleDiscountLineResult = {
  lineIndex: number
  productId: string
  sourceProductId: string
  discountAmount: number
  discountType: BundleDiscountType
  discountValue: number
}

export type ResolveBundleDiscountsResult = {
  lineDiscounts: number[]
  totalDiscount: number
  applied: BundleDiscountLineResult[]
}

type AdminClient = SupabaseClient<Database>

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

function calculateDiscountAmount(
  subtotal: number,
  discountType: BundleDiscountType,
  discountValue: number
): number {
  if (subtotal <= 0 || discountValue <= 0) return 0
  if (discountType === 'percentage') {
    return roundMoney(Math.min(subtotal, (subtotal * discountValue) / 100))
  }
  return roundMoney(Math.min(subtotal, discountValue))
}

/** 활성 번들 할인 규칙 조회 (recommended_for_you 섹션) */
export async function fetchBundleDiscountRules(
  admin: AdminClient,
  productIds: string[]
): Promise<ProductBundleDiscountRule[]> {
  if (productIds.length === 0) return []

  const uniqueIds = [...new Set(productIds.filter(Boolean))]
  const { data, error } = await fromUntypedTable(admin, 'product_recommendations')
    .select(
      'source_product_id, recommended_product_id, discount_type, discount_value, is_active, section_key'
    )
    .eq('section_key', 'recommended_for_you')
    .eq('is_active', true)
    .in('source_product_id', uniqueIds)

  if (error) {
    console.error('[fetchBundleDiscountRules]', error)
    return []
  }

  const productIdSet = new Set(uniqueIds)
  return ((data ?? []) as Array<Record<string, unknown>>)
    .map((row) => {
      const discountType = row.discount_type
      const discountValue = Number(row.discount_value)
      const sourceProductId = String(row.source_product_id ?? '')
      const bundledProductId = String(row.recommended_product_id ?? '')
      if (
        discountType !== 'percentage' &&
        discountType !== 'fixed' &&
        discountType != null
      ) {
        return null
      }
      if (!sourceProductId || !bundledProductId || !discountType || !Number.isFinite(discountValue) || discountValue <= 0) {
        return null
      }
      if (!productIdSet.has(bundledProductId)) return null
      return {
        sourceProductId,
        bundledProductId,
        discountType: discountType as BundleDiscountType,
        discountValue,
      }
    })
    .filter((rule): rule is ProductBundleDiscountRule => rule != null)
}

/**
 * 장바구니 라인에 번들 할인 적용.
 * source + bundled 상품이 모두 장바구니에 있을 때 bundled 라인에 할인.
 * 동일 bundled 상품에 여러 source가 있으면 가장 큰 할인만 적용.
 */
export function resolveBundleDiscountsForLines(
  lines: Array<{ productId: string; subtotal: number }>,
  rules: ProductBundleDiscountRule[]
): ResolveBundleDiscountsResult {
  const lineDiscounts = lines.map(() => 0)
  const applied: BundleDiscountLineResult[] = []
  const cartProductIds = new Set(lines.map((line) => line.productId))

  for (let bundledIndex = 0; bundledIndex < lines.length; bundledIndex++) {
    const bundledLine = lines[bundledIndex]!
    const matchingRules = rules.filter(
      (rule) =>
        rule.bundledProductId === bundledLine.productId &&
        cartProductIds.has(rule.sourceProductId) &&
        rule.sourceProductId !== bundledLine.productId
    )

    if (matchingRules.length === 0) continue

    let bestDiscount = 0
    let bestRule: ProductBundleDiscountRule | null = null

    for (const rule of matchingRules) {
      const amount = calculateDiscountAmount(
        bundledLine.subtotal,
        rule.discountType,
        rule.discountValue
      )
      if (amount > bestDiscount) {
        bestDiscount = amount
        bestRule = rule
      }
    }

    if (bestDiscount > 0 && bestRule) {
      lineDiscounts[bundledIndex] = bestDiscount
      applied.push({
        lineIndex: bundledIndex,
        productId: bundledLine.productId,
        sourceProductId: bestRule.sourceProductId,
        discountAmount: bestDiscount,
        discountType: bestRule.discountType,
        discountValue: bestRule.discountValue,
      })
    }
  }

  const totalDiscount = roundMoney(lineDiscounts.reduce((sum, value) => sum + value, 0))
  return { lineDiscounts, totalDiscount, applied }
}

export async function resolveBundleDiscountsForCart(
  admin: AdminClient,
  lines: Array<{ productId: string; subtotal: number }>
): Promise<ResolveBundleDiscountsResult> {
  const productIds = lines.map((line) => line.productId)
  const rules = await fetchBundleDiscountRules(admin, productIds)
  return resolveBundleDiscountsForLines(lines, rules)
}

export function formatBundleDiscountLabel(
  discountType: BundleDiscountType,
  discountValue: number,
  locale: string
): string {
  if (discountType === 'percentage') {
    return locale === 'en' ? `${discountValue}% off bundle` : `함께 구매 시 ${discountValue}% 할인`
  }
  const formatted = new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'ko-KR', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(discountValue)
  return locale === 'en' ? `${formatted} off bundle` : `함께 구매 시 ${formatted} 할인`
}

export function computeDiscountedPrice(
  price: number,
  discountType: BundleDiscountType | null | undefined,
  discountValue: number | null | undefined
): number | null {
  if (!discountType || !discountValue || discountValue <= 0 || price <= 0) return null
  return Math.max(0, price - calculateDiscountAmount(price, discountType, discountValue))
}
