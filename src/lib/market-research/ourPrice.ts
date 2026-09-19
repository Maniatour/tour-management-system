import type { SupabaseClient } from '@supabase/supabase-js'
import { todayInLasVegas } from '@/lib/dailyReport/dateUtils'
import { getChannelIdForPlatform } from '@/lib/platformChannelMapping'
import { isCanyonKey, type CanyonKey } from '@/lib/canyonChoice'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import type { MarketListing, OurPriceOverlay, OurPricePoint } from './types'
import { MARKET_PRICE_AXES, marketPriceAxisKey } from './types'
import { adultTotal, toMoney } from './prices'

type ChoiceOptionRow = {
  id: string
  canyon_key: string | null
  canonical_option_key: string | null
  option_key: string | null
  adult_price: number | null
}

type DynamicRow = {
  date: string
  adult_price: number | null
  not_included_price: number | null
  variant_key: string | null
  choices_pricing: unknown
}

function canyonFromOption(row: ChoiceOptionRow): 'lower' | 'antelope_x' | null {
  const key = isCanyonKey(row.canyon_key) ? (row.canyon_key as CanyonKey) : null
  if (key === 'L') return 'lower'
  if (key === 'X') return 'antelope_x'
  const blob = `${row.canonical_option_key || ''} ${row.option_key || ''}`.toLowerCase()
  if (blob.includes('antelope_x') || blob.includes('canyon_x')) return 'antelope_x'
  if (blob.includes('lower')) return 'lower'
  return null
}

function variantRank(variantKey: string | null | undefined, offer: 'all_inclusive' | 'sale_plus_excluded'): number {
  const key = (variantKey || 'default').toLowerCase()
  if (offer === 'all_inclusive') {
    if (key.includes('all_inclusive') || key.includes('inclusive')) return 0
    if (key === 'default') return 1
    return 2
  }
  if (key.includes('exclusion') || key.includes('not_included') || key.includes('with_exclusions')) return 0
  if (key === 'default') return 1
  return 2
}

function walkChoicesPricing(
  raw: unknown,
  optionIds: string[]
): { sale: number | null; notIncluded: number | null } {
  if (!raw || typeof raw !== 'object') return { sale: null, notIncluded: null }
  const root = raw as Record<string, unknown>
  const bag = 'combinations' in root && root.combinations && typeof root.combinations === 'object'
    ? (root.combinations as Record<string, unknown>)
    : root

  const tryNode = (node: unknown): { sale: number | null; notIncluded: number | null } | null => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return null
    const rec = node as Record<string, unknown>
    const sale = toMoney(rec.ota_sale_price ?? rec.adult_price ?? rec.sale_price)
    const notIncluded = toMoney(rec.not_included_price)
    if (sale == null && notIncluded == null) return null
    return { sale, notIncluded }
  }

  for (const optionId of optionIds) {
    const direct = tryNode(bag[optionId])
    if (direct?.sale != null) return direct
    for (const value of Object.values(bag)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const nested = tryNode((value as Record<string, unknown>)[optionId])
        if (nested?.sale != null) return nested
      }
    }
  }
  return { sale: null, notIncluded: null }
}

function pickDynamicRow(rows: DynamicRow[], offer: 'all_inclusive' | 'sale_plus_excluded'): DynamicRow | null {
  const sorted = [...rows].sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date)
    if (dateCmp !== 0) return dateCmp
    return variantRank(a.variant_key, offer) - variantRank(b.variant_key, offer)
  })
  return sorted[0] ?? null
}

/**
 * 자사 비교가 — dynamic_pricing / 초이스 / 상품 베이스를 읽기만 한다.
 */
export async function loadOurPriceOverlays(
  client: SupabaseClient,
  listings: MarketListing[]
): Promise<Record<string, OurPriceOverlay>> {
  const today = todayInLasVegas()
  const result: Record<string, OurPriceOverlay> = {}
  const productIds = [...new Set(listings.map((row) => row.mapped_product_id).filter(Boolean))] as string[]
  if (productIds.length === 0) {
    for (const listing of listings) {
      result[listing.id] = emptyOverlay(listing, today)
    }
    return result
  }

  const [{ data: products }, { data: choices }, { data: pricing }] = await Promise.all([
    client
      .from('products')
      .select('id, adult_base_price, base_price')
      .in('id', productIds),
    fromUntypedTable(client, 'product_choices')
      .select('id, product_id, choice_options(id, canyon_key, canonical_option_key, option_key, adult_price)')
      .in('product_id', productIds),
    client
      .from('dynamic_pricing')
      .select('product_id, channel_id, date, adult_price, not_included_price, variant_key, choices_pricing')
      .in('product_id', productIds)
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(400),
  ])

  const productBase = new Map<string, number>()
  for (const row of products || []) {
    const rec = row as { id: string; adult_base_price?: number | null; base_price?: number | null }
    const price = toMoney(rec.adult_base_price) ?? toMoney(rec.base_price)
    if (rec.id && price != null) productBase.set(rec.id, price)
  }

  const optionsByProduct = new Map<string, ChoiceOptionRow[]>()
  for (const choice of choices || []) {
    const rec = choice as {
      product_id?: string | null
      choice_options?: ChoiceOptionRow | ChoiceOptionRow[] | null
    }
    const productId = rec.product_id
    if (!productId) continue
    const opts = Array.isArray(rec.choice_options)
      ? rec.choice_options
      : rec.choice_options
        ? [rec.choice_options]
        : []
    const prev = optionsByProduct.get(productId) || []
    optionsByProduct.set(productId, prev.concat(opts))
  }

  type PricingRec = DynamicRow & { product_id: string | null; channel_id: string | null }
  const pricingRows = (pricing || []) as PricingRec[]

  for (const listing of listings) {
    const productId = listing.mapped_product_id
    const channelId = listing.mapped_channel_id || getChannelIdForPlatform(listing.ota_platform)
    const overlay: OurPriceOverlay = {
      productId,
      channelId,
      date: null,
      points: {},
    }
    if (!productId) {
      result[listing.id] = overlay
      continue
    }

    const productRows = pricingRows.filter((row) => row.product_id === productId)
    const channelRows = channelId
      ? productRows.filter((row) => row.channel_id === channelId)
      : productRows
    const pool = channelRows.length > 0 ? channelRows : productRows
    const options = optionsByProduct.get(productId) || []

    for (const axis of MARKET_PRICE_AXES) {
      if (axis.canyon === 'lower' && !listing.has_lower) continue
      if (axis.canyon === 'antelope_x' && !listing.has_antelope_x) continue
      if (axis.offer === 'all_inclusive' && !listing.has_all_inclusive) continue
      if (axis.offer === 'sale_plus_excluded' && !listing.has_sale_plus_excluded) continue

      const dp = pickDynamicRow(pool, axis.offer)
      overlay.date = overlay.date || dp?.date || null
      const canyonOptions = options.filter((opt) => canyonFromOption(opt) === axis.canyon)
      const fromChoices = walkChoicesPricing(
        dp?.choices_pricing,
        canyonOptions.map((opt) => opt.id)
      )
      const choiceAdult = canyonOptions
        .map((opt) => toMoney(opt.adult_price))
        .find((n) => n != null && n > 0) ?? null
      const sale =
        fromChoices.sale ??
        choiceAdult ??
        toMoney(dp?.adult_price) ??
        productBase.get(productId) ??
        null
      const notIncluded =
        axis.offer === 'all_inclusive'
          ? 0
          : fromChoices.notIncluded ?? toMoney(dp?.not_included_price) ?? 0
      const point: OurPricePoint = {
        sale,
        notIncluded,
        total: adultTotal(sale, notIncluded),
        source: fromChoices.sale != null ? 'dynamic' : choiceAdult != null ? 'choice' : dp ? 'dynamic' : sale != null ? 'product' : 'none',
      }
      overlay.points[marketPriceAxisKey(axis.canyon, axis.offer)] = point
    }

    result[listing.id] = overlay
  }

  return result
}

function emptyOverlay(listing: MarketListing, today: string): OurPriceOverlay {
  return {
    productId: listing.mapped_product_id,
    channelId: listing.mapped_channel_id,
    date: today,
    points: {},
  }
}
