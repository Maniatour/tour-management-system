import type { SupabaseClient } from '@supabase/supabase-js'
import { todayInLasVegas } from '@/lib/dailyReport/dateUtils'
import { findBookingTimeChoicePricing } from '@/lib/bookingTimeChoicePricing'
import { getChannelIdForPlatform } from '@/lib/platformChannelMapping'
import { isCanyonKey, type CanyonKey } from '@/lib/canyonChoice'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import type { MarketListing, MarketOtaPlatform, OurPriceOverlay, OurPricePoint } from './types'
import { MARKET_OTA_PLATFORMS, MARKET_PRICE_AXES, marketPriceAxisKey } from './types'
import { adultTotal, discountedPrice, normalizeDiscountPercent, toMoney } from './prices'

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
  coupon_percent?: number | null
  variant_key: string | null
  choices_pricing: unknown
}

type ChannelRow = {
  id: string
  name: string | null
}

const OTA_CHANNEL_ALIASES: Record<Exclude<MarketOtaPlatform, 'other'>, string[]> = {
  getyourguide: ['getyourguide', 'gyg', 'get your guide'],
  viator: ['viator'],
  klook: ['klook'],
  kkday: ['kkday', 'kk day'],
  tripadvisor: ['tripadvisor', 'trip advisor'],
  tripcom: ['trip.com', 'tripcom', 'ctrip'],
  myrealtrip: ['myrealtrip', 'my real trip', '마이리얼트립'],
  expedia: ['expedia'],
}

function compactToken(value: string): string {
  return value.toLowerCase().replace(/[\s._-]+/g, '')
}

/**
 * 이메일 PLATFORM_CHANNEL_MAP 값이 channels.id 와 다를 수 있다.
 * GetYourGuide 실제 id 는 Partner5 이고, 맵은 'getyourguide' 를 돌려준다.
 */
export function resolveOtaChannelId(
  platform: string,
  channels: readonly ChannelRow[]
): string | null {
  const key = platform.trim().toLowerCase()
  if (!key || key === 'other') return null
  const mapped = getChannelIdForPlatform(key)
  if (mapped && channels.some((row) => row.id === mapped)) return mapped

  const aliases = (
    OTA_CHANNEL_ALIASES[key as Exclude<MarketOtaPlatform, 'other'>] || [key]
  ).map(compactToken)
  const found = channels.find((row) => {
    const id = compactToken(row.id)
    const name = compactToken(row.name || '')
    if (aliases.includes(id) || id === compactToken(key)) return true
    return aliases.some(
      (alias) =>
        (alias.length >= 3 && name.includes(alias)) || (name.length >= 4 && alias.includes(name))
    )
  })
  return found?.id ?? null
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

function choicesPricingBag(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const root = raw as Record<string, unknown>
  if (root.combinations && typeof root.combinations === 'object' && !Array.isArray(root.combinations)) {
    return root.combinations as Record<string, unknown>
  }
  return root
}

function otaSaleFromNode(node: unknown): { sale: number | null; notIncluded: number | null } {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return { sale: null, notIncluded: null }
  }
  const rec = node as Record<string, unknown>
  return {
    sale: toMoney(rec.ota_sale_price),
    notIncluded: toMoney(rec.not_included_price),
  }
}

/**
 * 동적가격 화면과 같이 choices_pricing 의 ota_sale_price 를 쓴다.
 * option.id 가 아니라 option_key(레거시 UUID) 로 키가 저장되는 경우가 많다.
 * adult_price 는 캐년 입장 가산금이라 OTA 판매가로 쓰지 않는다.
 */
export function canyonOtaSaleFromChoices(
  raw: unknown,
  option: Pick<ChoiceOptionRow, 'id' | 'option_key'> | null | undefined
): { sale: number | null; notIncluded: number | null } {
  const bag = choicesPricingBag(raw)
  const tokens = [...new Set([option?.option_key, option?.id].map((value) => String(value || '').trim()).filter(Boolean))]

  for (const token of tokens) {
    const direct = otaSaleFromNode(bag[token])
    if (direct.sale != null) return direct
  }

  for (const token of tokens) {
    const match = findBookingTimeChoicePricing(token, bag)
    const sale = match ? toMoney(match.data.ota_sale_price) : null
    if (sale != null) {
      return {
        sale,
        notIncluded: match ? toMoney(match.data.not_included_price) : null,
      }
    }
  }

  const noChoice = otaSaleFromNode(bag.no_choice ?? bag['no-choice'])
  if (noChoice.sale != null) return noChoice
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
export function ourProductPlatformKey(productId: string, platform: string): string {
  return `${productId}:${platform}`
}

export function overlayAxisPoint(
  overlay: OurPriceOverlay | undefined,
  canyon: 'lower' | 'antelope_x',
  offer: 'all_inclusive' | 'sale_plus_excluded'
): OurPricePoint | undefined {
  if (!overlay) return undefined
  return (
    overlay.points[marketPriceAxisKey(canyon, offer)] ||
    overlay.points[marketPriceAxisKey(canyon, offer === 'all_inclusive' ? 'sale_plus_excluded' : 'all_inclusive')]
  )
}

type OverlayFlags = {
  hasLower?: boolean
  hasAntelopeX?: boolean
  hasAllInclusive?: boolean
  hasSalePlusExcluded?: boolean
}

type PricingContext = {
  productBase: Map<string, number>
  optionsByProduct: Map<string, ChoiceOptionRow[]>
  pricingRows: Array<DynamicRow & { product_id: string | null; channel_id: string | null }>
  channels: ChannelRow[]
}

async function loadPricingContext(client: SupabaseClient, productIds: string[]): Promise<PricingContext> {
  const today = todayInLasVegas()
  const [{ data: products }, { data: choices }, { data: channelRows }] = await Promise.all([
    client
      .from('products')
      .select('id, adult_base_price, base_price')
      .in('id', productIds),
    fromUntypedTable(client, 'product_choices')
      .select('id, product_id, choice_options(id, canyon_key, canonical_option_key, option_key, adult_price)')
      .in('product_id', productIds),
    client.from('channels').select('id, name'),
  ])

  const channels = (channelRows || []) as ChannelRow[]
  const channelIds = [
    ...new Set(
      MARKET_OTA_PLATFORMS.filter((platform) => platform !== 'other')
        .map((platform) => resolveOtaChannelId(platform, channels))
        .filter((id): id is string => Boolean(id))
    ),
  ]

  let pricingQuery = client
    .from('dynamic_pricing')
    .select('product_id, channel_id, date, adult_price, not_included_price, coupon_percent, variant_key, choices_pricing')
    .in('product_id', productIds)
    .gte('date', today)
    .order('date', { ascending: true })
    .limit(2500)
  if (channelIds.length > 0) {
    pricingQuery = pricingQuery.in('channel_id', channelIds)
  }
  const { data: pricing } = await pricingQuery

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

  return {
    productBase,
    optionsByProduct,
    pricingRows: (pricing || []) as Array<DynamicRow & { product_id: string | null; channel_id: string | null }>,
    channels,
  }
}

export function overlayFromContext(
  productId: string,
  channelId: string | null,
  ctx: Pick<PricingContext, 'productBase' | 'optionsByProduct' | 'pricingRows'>,
  flags: OverlayFlags = {}
): OurPriceOverlay {
  const hasLower = flags.hasLower !== false
  const hasAntelopeX = flags.hasAntelopeX !== false
  const hasAllInclusive = flags.hasAllInclusive !== false
  const hasSalePlusExcluded = flags.hasSalePlusExcluded !== false
  const overlay: OurPriceOverlay = {
    productId,
    channelId,
    date: null,
    points: {},
  }
  const productRows = ctx.pricingRows.filter((row) => row.product_id === productId)
  const pool = channelId ? productRows.filter((row) => row.channel_id === channelId) : []
  const options = ctx.optionsByProduct.get(productId) || []

  for (const axis of MARKET_PRICE_AXES) {
    if (axis.offer === 'listing_from') continue
    if (axis.canyon === 'lower' && !hasLower) continue
    if (axis.canyon === 'antelope_x' && !hasAntelopeX) continue
    if (axis.offer === 'all_inclusive' && !hasAllInclusive) continue
    if (axis.offer === 'sale_plus_excluded' && !hasSalePlusExcluded) continue

    const dp = pickDynamicRow(pool, axis.offer)
    overlay.date = overlay.date || dp?.date || null
    const canyonOption = options.find((opt) => canyonFromOption(opt) === axis.canyon) ?? null
    const fromChoices = canyonOtaSaleFromChoices(dp?.choices_pricing, canyonOption)
    const sale =
      fromChoices.sale ??
      toMoney(dp?.adult_price) ??
      (dp ? ctx.productBase.get(productId) ?? null : null)
    const discountPercent = normalizeDiscountPercent(dp?.coupon_percent)
    const discounted = discountedPrice(sale, discountPercent)
    const notIncluded =
      axis.offer === 'all_inclusive'
        ? 0
        : fromChoices.notIncluded ?? toMoney(dp?.not_included_price) ?? 0
    const point: OurPricePoint = {
      sale,
      discounted,
      discountPercent: discounted != null ? discountPercent : null,
      notIncluded,
      total: adultTotal(discounted ?? sale, notIncluded),
      source: fromChoices.sale != null ? 'dynamic' : dp ? 'dynamic' : sale != null ? 'product' : 'none',
    }
    overlay.points[marketPriceAxisKey(axis.canyon, axis.offer)] = point
  }

  return overlay
}

function resolvedListingChannelId(listing: MarketListing, channels: readonly ChannelRow[]): string | null {
  if (listing.mapped_channel_id && channels.some((row) => row.id === listing.mapped_channel_id)) {
    return listing.mapped_channel_id
  }
  return resolveOtaChannelId(listing.ota_platform, channels)
}

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

  const ctx = await loadPricingContext(client, productIds)
  for (const listing of listings) {
    const productId = listing.mapped_product_id
    if (!productId) {
      result[listing.id] = emptyOverlay(listing, today)
      continue
    }
    result[listing.id] = overlayFromContext(productId, resolvedListingChannelId(listing, ctx.channels), ctx, {
      hasLower: listing.has_lower,
      hasAntelopeX: listing.has_antelope_x,
      hasAllInclusive: listing.has_all_inclusive,
      hasSalePlusExcluded: listing.has_sale_plus_excluded,
    })
  }
  return result
}

export async function loadOurProductPlatformOverlays(
  client: SupabaseClient,
  productIds: string[]
): Promise<Record<string, OurPriceOverlay>> {
  const ids = [...new Set(productIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) return {}
  const ctx = await loadPricingContext(client, ids)
  const result: Record<string, OurPriceOverlay> = {}
  for (const productId of ids) {
    for (const platform of MARKET_OTA_PLATFORMS) {
      if (platform === 'other') continue
      result[ourProductPlatformKey(productId, platform)] = overlayFromContext(
        productId,
        resolveOtaChannelId(platform, ctx.channels),
        ctx
      )
    }
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
