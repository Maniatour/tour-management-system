import { supabaseAdmin } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { todayInLasVegas } from '@/lib/dailyReport/dateUtils'
import {
  MARKET_ALERT_COLUMNS,
  MARKET_ALERTS_TABLE,
  MARKET_BADGE_COLUMNS,
  MARKET_BADGES_TABLE,
  MARKET_COMPARE_ITEM_COLUMNS,
  MARKET_COMPARE_ITEMS_TABLE,
  MARKET_COMPETITOR_COLUMNS,
  MARKET_COMPETITORS_TABLE,
  MARKET_FOCUS_PRODUCT_COLUMNS,
  MARKET_FOCUS_PRODUCTS_TABLE,
  MARKET_LISTING_COLUMNS,
  MARKET_LISTINGS_TABLE,
  MARKET_OUR_OFFER_COLUMNS,
  MARKET_OUR_OFFERS_TABLE,
  MARKET_SNAPSHOT_COLUMNS,
  MARKET_SNAPSHOTS_TABLE,
} from './tables'
import { mapCatalogChannel, mapCatalogProduct, mapFocusProduct, mapMarketBadge, mapMarketCompareItem, mapMarketCompetitor, mapMarketListing, mapMarketOurOffer, mapMarketSnapshot } from './mappers'
import { mapMarketPriceAlertRow } from './notify'
import { loadOurPriceOverlays, loadOurProductPlatformOverlays } from './ourPrice'
import { parseOurChannelSettings } from './ourChannelSettings'
import { isMarketCanyonVariant, isMarketOfferType, isMarketOtaPlatform } from './types'
import type { MarketBadgeCatalogItem, MarketCompareItemCatalog, MarketCompetitor, MarketFocusProduct, MarketListing, MarketOurOffer } from './types'
import { MARKET_BADGE_PRESETS, badgeIdFromLabel, findCatalogBadgeByLabel, sortBadgeCatalog } from './badges'
import {
  MARKET_EXCLUDED_ITEM_PRESETS,
  compareItemDefsFromCatalog,
  parseExcludedItems,
  parseInclusionMap,
  serializeExcludedItems,
  serializeInclusionMap,
  type MarketInclusionMap,
} from './excludedItems'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function requireAdmin() {
  if (!supabaseAdmin) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
  return supabaseAdmin
}

export async function loadMarketResearchBundle(operatorIdRaw?: string | null) {
  const admin = requireAdmin()
  const operatorId = resolveOperatorId(operatorIdRaw)
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [competitorsRes, listingsRes, snapshotsRes, alertsRes, productsRes, channelsRes, focusRes, badgesRes, compareItemsRes, ourOffersRes] =
    await Promise.all([
      fromUntypedTable(admin, MARKET_COMPETITORS_TABLE)
        .select(MARKET_COMPETITOR_COLUMNS)
        .eq('operator_id', operatorId)
        .order('name', { ascending: true }),
      fromUntypedTable(admin, MARKET_LISTINGS_TABLE)
        .select(MARKET_LISTING_COLUMNS)
        .eq('operator_id', operatorId)
        .order('created_at', { ascending: false }),
      fromUntypedTable(admin, MARKET_SNAPSHOTS_TABLE)
        .select(MARKET_SNAPSHOT_COLUMNS)
        .eq('operator_id', operatorId)
        .gte('observed_on', since)
        .order('observed_on', { ascending: false })
        .limit(2000),
      fromUntypedTable(admin, MARKET_ALERTS_TABLE)
        .select(MARKET_ALERT_COLUMNS)
        .eq('operator_id', operatorId)
        .order('created_at', { ascending: false })
        .limit(50),
      admin.from('products').select('id, name, name_ko, name_en').order('id', { ascending: true }),
      admin.from('channels').select('id, name').order('name', { ascending: true }),
      fromUntypedTable(admin, MARKET_FOCUS_PRODUCTS_TABLE)
        .select(MARKET_FOCUS_PRODUCT_COLUMNS)
        .eq('operator_id', operatorId)
        .order('sort_order', { ascending: true }),
      fromUntypedTable(admin, MARKET_BADGES_TABLE)
        .select(MARKET_BADGE_COLUMNS)
        .eq('operator_id', operatorId)
        .order('sort_order', { ascending: true }),
      fromUntypedTable(admin, MARKET_COMPARE_ITEMS_TABLE)
        .select(MARKET_COMPARE_ITEM_COLUMNS)
        .eq('operator_id', operatorId)
        .order('sort_order', { ascending: true }),
      fromUntypedTable(admin, MARKET_OUR_OFFERS_TABLE)
        .select(MARKET_OUR_OFFER_COLUMNS)
        .eq('operator_id', operatorId)
        .order('product_id', { ascending: true }),
    ])

  if (competitorsRes.error) throw new Error(competitorsRes.error.message)
  if (listingsRes.error) throw new Error(listingsRes.error.message)
  if (snapshotsRes.error) throw new Error(snapshotsRes.error.message)
  if (alertsRes.error) throw new Error(alertsRes.error.message)
  if (compareItemsRes.error) throw new Error(compareItemsRes.error.message)
  if (ourOffersRes.error) throw new Error(ourOffersRes.error.message)

  const competitors = (competitorsRes.data || [])
    .map((row) => mapMarketCompetitor(asRecord(row)))
    .filter((row): row is MarketCompetitor => row != null)
  const snapshots = (snapshotsRes.data || [])
    .map((row) => mapMarketSnapshot(asRecord(row)))
    .filter((row) => row != null)
  const alerts = (alertsRes.data || [])
    .map((row) => mapMarketPriceAlertRow(asRecord(row)))
    .filter((row) => row != null)
  const products = (productsRes.data || [])
    .map((row) => mapCatalogProduct(asRecord(row)))
    .filter((row) => row != null)
  const channels = (channelsRes.data || [])
    .map((row) => mapCatalogChannel(asRecord(row)))
    .filter((row) => row != null)
  let focusProducts = (focusRes.data || [])
    .map((row) => mapFocusProduct(asRecord(row)))
    .filter((row): row is MarketFocusProduct => row != null)
  if (focusProducts.length === 0) {
    focusProducts = await addFocusProduct({ operatorId, productId: 'MDGCSUNRISE' })
      .then((row) => [row])
      .catch(() => focusProducts)
  }

  let badges = (badgesRes.data || [])
    .map((row) => mapMarketBadge(asRecord(row)))
    .filter((row): row is MarketBadgeCatalogItem => row != null)
  badges = await ensureBadgePresets(operatorId).catch(() => badges)
  badges = sortBadgeCatalog(badges)

  let compareItems = (compareItemsRes.data || [])
    .map((row) => mapMarketCompareItem(asRecord(row)))
    .filter((row): row is MarketCompareItemCatalog => row != null)
  if (compareItems.length === 0) {
    compareItems = await ensureCompareItemPresets(operatorId).catch(() => compareItems)
  }
  const compareDefs = compareItemDefsFromCatalog(compareItems)

  const listings = (listingsRes.data || [])
    .map((row) => mapMarketListing(asRecord(row), compareDefs))
    .filter((row): row is MarketListing => row != null)

  const ourOffers = (ourOffersRes.data || [])
    .map((row) => mapMarketOurOffer(asRecord(row), compareDefs))
    .filter((row): row is MarketOurOffer => row != null)

  const overlayProductIds = [
    ...new Set([
      ...focusProducts.map((row) => row.product_id),
      ...listings.map((row) => row.mapped_product_id).filter((id): id is string => Boolean(id)),
    ]),
  ]

  const ourPrices = await loadOurPriceOverlays(admin, listings).catch((error) => {
    console.error('[market-research] our price overlay', error)
    return {} as Record<string, import('./types').OurPriceOverlay>
  })
  const ourPlatformPrices = await loadOurProductPlatformOverlays(admin, overlayProductIds).catch((error) => {
    console.error('[market-research] our platform overlay', error)
    return {} as Record<string, import('./types').OurPriceOverlay>
  })

  return {
    operatorId,
    today: todayInLasVegas(),
    competitors,
    listings,
    snapshots,
    alerts,
    products,
    channels,
    focusProducts,
    badges,
    compareItems,
    ourOffers,
    ourPrices,
    ourPlatformPrices,
  }
}

export async function createCompetitor(input: {
  operatorId?: string | null
  name: string
  websiteUrl?: string | null
  notes?: string | null
  isActive?: boolean
}): Promise<MarketCompetitor> {
  const admin = requireAdmin()
  const name = input.name.trim()
  if (!name) throw new Error('name required')
  const { data, error } = await fromUntypedTable(admin, MARKET_COMPETITORS_TABLE)
    .insert({
      operator_id: resolveOperatorId(input.operatorId),
      name,
      website_url: input.websiteUrl?.trim() || null,
      notes: input.notes?.trim() || null,
      is_active: input.isActive !== false,
    } as never)
    .select(MARKET_COMPETITOR_COLUMNS)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const row = mapMarketCompetitor(asRecord(data))
  if (!row) throw new Error('competitor create failed')
  return row
}

export async function updateCompetitor(input: {
  id: string
  name?: string | undefined
  websiteUrl?: string | null | undefined
  notes?: string | null | undefined
  isActive?: boolean | undefined
}): Promise<MarketCompetitor> {
  const admin = requireAdmin()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.name != null) patch.name = input.name.trim()
  if (input.websiteUrl !== undefined) patch.website_url = input.websiteUrl?.trim() || null
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null
  if (input.isActive !== undefined) patch.is_active = input.isActive
  const { data, error } = await fromUntypedTable(admin, MARKET_COMPETITORS_TABLE)
    .update(patch as never)
    .eq('id', input.id)
    .select(MARKET_COMPETITOR_COLUMNS)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const row = mapMarketCompetitor(asRecord(data))
  if (!row) throw new Error('competitor update failed')
  return row
}

export async function deleteCompetitor(id: string): Promise<void> {
  const admin = requireAdmin()
  const { error } = await fromUntypedTable(admin, MARKET_COMPETITORS_TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function createListing(input: {
  operatorId?: string | null
  competitorId: string
  otaPlatform: string
  listingUrl: string
  listingTitle?: string | null
  mappedProductId?: string | null
  mappedChannelId?: string | null
  hasLower?: boolean
  hasAntelopeX?: boolean
  hasAllInclusive?: boolean
  hasSalePlusExcluded?: boolean
  watchEnabled?: boolean
  durationNote?: string | null
  pickupNote?: string | null
  groupSizeNote?: string | null
  cancellationNote?: string | null
  languageNote?: string | null
  itineraryNote?: string | null
  diffNotes?: string | null
  inclusionItems?: MarketInclusionMap | undefined
}): Promise<MarketListing> {
  const admin = requireAdmin()
  if (!isMarketOtaPlatform(input.otaPlatform)) throw new Error('invalid ota platform')
  const listingUrl = input.listingUrl.trim()
  if (!listingUrl) throw new Error('listingUrl required')
  const mappedChannelId = input.mappedChannelId?.trim() || null
  const { data, error } = await fromUntypedTable(admin, MARKET_LISTINGS_TABLE)
    .insert({
      operator_id: resolveOperatorId(input.operatorId),
      competitor_id: input.competitorId,
      ota_platform: input.otaPlatform,
      listing_url: listingUrl,
      listing_title: input.listingTitle?.trim() || null,
      mapped_product_id: input.mappedProductId?.trim() || null,
      mapped_channel_id: mappedChannelId,
      has_lower: input.hasLower !== false,
      has_antelope_x: input.hasAntelopeX !== false,
      has_all_inclusive: !(input.hasSalePlusExcluded === true && input.hasAllInclusive === false),
      has_sale_plus_excluded: input.hasSalePlusExcluded === true && input.hasAllInclusive === false,
      watch_enabled: input.watchEnabled !== false,
      duration_note: input.durationNote?.trim() || null,
      pickup_note: input.pickupNote?.trim() || null,
      group_size_note: input.groupSizeNote?.trim() || null,
      cancellation_note: input.cancellationNote?.trim() || null,
      language_note: input.languageNote?.trim() || null,
      itinerary_note: input.itineraryNote?.trim() || null,
      diff_notes: input.diffNotes?.trim() || null,
      inclusion_items: await inclusionMapForSave(
        resolveOperatorId(input.operatorId),
        input.inclusionItems,
        !(input.hasSalePlusExcluded === true && input.hasAllInclusive === false)
      ),
    } as never)
    .select(MARKET_LISTING_COLUMNS)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const row = mapMarketListing(asRecord(data))
  if (!row) throw new Error('listing create failed')
  return row
}

export async function updateListing(input: {
  id: string
  competitorId?: string | undefined
  listingUrl?: string | undefined
  listingTitle?: string | null | undefined
  mappedProductId?: string | null | undefined
  mappedChannelId?: string | null | undefined
  otaPlatform?: string | undefined
  hasLower?: boolean | undefined
  hasAntelopeX?: boolean | undefined
  hasAllInclusive?: boolean | undefined
  hasSalePlusExcluded?: boolean | undefined
  watchEnabled?: boolean | undefined
  durationNote?: string | null | undefined
  pickupNote?: string | null | undefined
  groupSizeNote?: string | null | undefined
  cancellationNote?: string | null | undefined
  languageNote?: string | null | undefined
  itineraryNote?: string | null | undefined
  diffNotes?: string | null | undefined
  inclusionItems?: MarketInclusionMap | undefined
}): Promise<MarketListing> {
  const admin = requireAdmin()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.listingUrl != null) patch.listing_url = input.listingUrl.trim()
  if (input.competitorId != null) patch.competitor_id = input.competitorId
  if (input.listingTitle !== undefined) patch.listing_title = input.listingTitle?.trim() || null
  if (input.mappedProductId !== undefined) patch.mapped_product_id = input.mappedProductId?.trim() || null
  if (input.mappedChannelId !== undefined) patch.mapped_channel_id = input.mappedChannelId?.trim() || null
  if (input.otaPlatform != null) {
    if (!isMarketOtaPlatform(input.otaPlatform)) throw new Error('invalid ota platform')
    patch.ota_platform = input.otaPlatform
  }
  if (input.hasLower !== undefined) patch.has_lower = input.hasLower
  if (input.hasAntelopeX !== undefined) patch.has_antelope_x = input.hasAntelopeX
  if (input.hasAllInclusive !== undefined || input.hasSalePlusExcluded !== undefined) {
    const saleOnly = input.hasSalePlusExcluded === true && input.hasAllInclusive === false
    patch.has_all_inclusive = !saleOnly
    patch.has_sale_plus_excluded = saleOnly
  }
  if (input.watchEnabled !== undefined) patch.watch_enabled = input.watchEnabled
  if (input.durationNote !== undefined) patch.duration_note = input.durationNote?.trim() || null
  if (input.pickupNote !== undefined) patch.pickup_note = input.pickupNote?.trim() || null
  if (input.groupSizeNote !== undefined) patch.group_size_note = input.groupSizeNote?.trim() || null
  if (input.cancellationNote !== undefined) patch.cancellation_note = input.cancellationNote?.trim() || null
  if (input.languageNote !== undefined) patch.language_note = input.languageNote?.trim() || null
  if (input.itineraryNote !== undefined) patch.itinerary_note = input.itineraryNote?.trim() || null
  if (input.diffNotes !== undefined) patch.diff_notes = input.diffNotes?.trim() || null
  if (input.inclusionItems !== undefined) {
    patch.inclusion_items = await inclusionMapForSave(
      resolveOperatorId(undefined),
      input.inclusionItems,
      !(input.hasSalePlusExcluded === true && input.hasAllInclusive === false)
    )
  }

  const { data, error } = await fromUntypedTable(admin, MARKET_LISTINGS_TABLE)
    .update(patch as never)
    .eq('id', input.id)
    .select(MARKET_LISTING_COLUMNS)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const row = mapMarketListing(asRecord(data))
  if (!row) throw new Error('listing update failed')
  return row
}

export async function deleteListing(id: string): Promise<void> {
  const admin = requireAdmin()
  const { error } = await fromUntypedTable(admin, MARKET_LISTINGS_TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function addFocusProduct(input: {
  operatorId?: string | null | undefined
  productId: string
}): Promise<MarketFocusProduct> {
  const admin = requireAdmin()
  const productId = input.productId.trim()
  if (!productId) throw new Error('productId required')
  const { data, error } = await fromUntypedTable(admin, MARKET_FOCUS_PRODUCTS_TABLE)
    .upsert(
      {
        operator_id: resolveOperatorId(input.operatorId),
        product_id: productId,
        sort_order: 0,
      } as never,
      { onConflict: 'operator_id,product_id' }
    )
    .select(MARKET_FOCUS_PRODUCT_COLUMNS)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const row = mapFocusProduct(asRecord(data))
  if (!row) throw new Error('focus product save failed')
  return row
}

export async function deleteFocusProduct(input: {
  operatorId?: string | null | undefined
  productId: string
}): Promise<void> {
  const admin = requireAdmin()
  const productId = input.productId.trim()
  if (!productId) throw new Error('productId required')
  const { error } = await fromUntypedTable(admin, MARKET_FOCUS_PRODUCTS_TABLE)
    .delete()
    .eq('operator_id', resolveOperatorId(input.operatorId))
    .eq('product_id', productId)
  if (error) throw new Error(error.message)
}

async function loadBadges(operatorId: string): Promise<MarketBadgeCatalogItem[]> {
  const admin = requireAdmin()
  const { data, error } = await fromUntypedTable(admin, MARKET_BADGES_TABLE)
    .select(MARKET_BADGE_COLUMNS)
    .eq('operator_id', operatorId)
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data || [])
    .map((row) => mapMarketBadge(asRecord(row)))
    .filter((row): row is MarketBadgeCatalogItem => row != null)
}

export async function ensureBadgePresets(operatorId: string): Promise<MarketBadgeCatalogItem[]> {
  const admin = requireAdmin()
  const existing = await loadBadges(operatorId)
  const have = new Set(existing.map((row) => row.badge_id))
  const missing = MARKET_BADGE_PRESETS.filter((preset) => !have.has(preset.id))
  if (missing.length === 0) return sortBadgeCatalog(existing)
  const rows = missing.map((preset) => ({
    operator_id: operatorId,
    badge_id: preset.id,
    label_ko: preset.labelKo,
    label_en: preset.labelEn,
    sort_order: MARKET_BADGE_PRESETS.findIndex((item) => item.id === preset.id),
    is_preset: true,
  }))
  const { error } = await fromUntypedTable(admin, MARKET_BADGES_TABLE).upsert(rows as never, {
    onConflict: 'operator_id,badge_id',
  })
  if (error) throw new Error(error.message)
  return sortBadgeCatalog(await loadBadges(operatorId))
}

export async function addMarketBadge(input: {
  operatorId?: string | null | undefined
  label: string
}): Promise<MarketBadgeCatalogItem> {
  const admin = requireAdmin()
  const operatorId = resolveOperatorId(input.operatorId)
  const label = input.label.trim()
  if (!label) throw new Error('badge label required')
  const existing = await loadBadges(operatorId)
  const matched = findCatalogBadgeByLabel(existing, label)
  if (matched) return matched
  const badgeId = (() => {
    const slug = badgeIdFromLabel(label)
    if (!existing.some((row) => row.badge_id === slug)) return slug
    return `${slug}_${Date.now().toString(36)}`
  })()
  const { data, error } = await fromUntypedTable(admin, MARKET_BADGES_TABLE)
    .insert({
      operator_id: operatorId,
      badge_id: badgeId,
      label_ko: label,
      label_en: label,
      sort_order: existing.length,
      is_preset: false,
    } as never)
    .select(MARKET_BADGE_COLUMNS)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const row = mapMarketBadge(asRecord(data))
  if (!row) throw new Error('badge save failed')
  return row
}

export async function deleteMarketBadge(input: {
  operatorId?: string | null | undefined
  badgeId: string
}): Promise<void> {
  const admin = requireAdmin()
  const badgeId = input.badgeId.trim()
  if (!badgeId) throw new Error('badgeId required')
  const { error } = await fromUntypedTable(admin, MARKET_BADGES_TABLE)
    .delete()
    .eq('operator_id', resolveOperatorId(input.operatorId))
    .eq('badge_id', badgeId)
    .eq('is_preset', false)
  if (error) throw new Error(error.message)
}

async function inclusionMapForSave(
  operatorId: string,
  map: MarketInclusionMap | undefined,
  fallbackAllInclusive: boolean
): Promise<MarketInclusionMap> {
  const items = compareItemDefsFromCatalog(await loadCompareItems(operatorId))
  return serializeInclusionMap(parseInclusionMap(map, fallbackAllInclusive, items), items)
}

async function loadCompareItems(operatorId: string): Promise<MarketCompareItemCatalog[]> {
  const admin = requireAdmin()
  const { data, error } = await fromUntypedTable(admin, MARKET_COMPARE_ITEMS_TABLE)
    .select(MARKET_COMPARE_ITEM_COLUMNS)
    .eq('operator_id', operatorId)
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data || [])
    .map((row) => mapMarketCompareItem(asRecord(row)))
    .filter((row): row is MarketCompareItemCatalog => row != null)
}

export async function ensureCompareItemPresets(operatorId: string): Promise<MarketCompareItemCatalog[]> {
  const admin = requireAdmin()
  const rows = MARKET_EXCLUDED_ITEM_PRESETS.map((preset, index) => ({
    operator_id: operatorId,
    item_id: preset.id,
    label_ko: preset.labelKo,
    label_en: preset.labelEn,
    sort_order: index,
    is_preset: true,
  }))
  const { error } = await fromUntypedTable(admin, MARKET_COMPARE_ITEMS_TABLE).upsert(rows as never, {
    onConflict: 'operator_id,item_id',
  })
  if (error) throw new Error(error.message)
  return loadCompareItems(operatorId)
}

export async function addMarketCompareItem(input: {
  operatorId?: string | null | undefined
  label: string
}): Promise<MarketCompareItemCatalog> {
  const admin = requireAdmin()
  const operatorId = resolveOperatorId(input.operatorId)
  const label = input.label.trim()
  if (!label) throw new Error('compare item label required')
  const existing = await loadCompareItems(operatorId)
  const itemId = (() => {
    const base = label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
    const slug = base || `item_${Date.now().toString(36)}`
    if (!existing.some((row) => row.item_id === slug)) return slug
    return `${slug}_${Date.now().toString(36)}`
  })()
  const { data, error } = await fromUntypedTable(admin, MARKET_COMPARE_ITEMS_TABLE)
    .insert({
      operator_id: operatorId,
      item_id: itemId,
      label_ko: label,
      label_en: label,
      sort_order: existing.length,
      is_preset: false,
    } as never)
    .select(MARKET_COMPARE_ITEM_COLUMNS)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const row = mapMarketCompareItem(asRecord(data))
  if (!row) throw new Error('compare item save failed')
  return row
}

export async function deleteMarketCompareItem(input: {
  operatorId?: string | null | undefined
  itemId: string
}): Promise<void> {
  const admin = requireAdmin()
  const itemId = input.itemId.trim()
  if (!itemId) throw new Error('itemId required')
  const { error } = await fromUntypedTable(admin, MARKET_COMPARE_ITEMS_TABLE)
    .delete()
    .eq('operator_id', resolveOperatorId(input.operatorId))
    .eq('item_id', itemId)
  if (error) throw new Error(error.message)
}

export async function saveOurOffer(input: {
  operatorId?: string | null | undefined
  productId: string
  otaPlatform: string
  inclusionItems?: MarketInclusionMap | undefined
  excludedItems?: unknown
  channelSettings?: unknown
}): Promise<MarketOurOffer> {
  const admin = requireAdmin()
  const operatorId = resolveOperatorId(input.operatorId)
  const productId = input.productId.trim()
  if (!productId) throw new Error('productId required')
  if (!isMarketOtaPlatform(input.otaPlatform)) throw new Error('invalid ota platform')
  const items = compareItemDefsFromCatalog(await loadCompareItems(operatorId))
  const inclusionItems = serializeInclusionMap(
    parseInclusionMap(input.inclusionItems, true, items),
    items
  )
  const excludedItems = serializeExcludedItems(parseExcludedItems(input.excludedItems)).filter(
    (row) => inclusionItems[row.id] === 'excluded'
  )
  const now = new Date().toISOString()
  const { data, error } = await fromUntypedTable(admin, MARKET_OUR_OFFERS_TABLE)
    .upsert(
      {
        operator_id: operatorId,
        product_id: productId,
        ota_platform: input.otaPlatform,
        inclusion_items: inclusionItems,
        excluded_items: excludedItems,
        channel_settings: parseOurChannelSettings(input.channelSettings),
        updated_at: now,
      } as never,
      { onConflict: 'operator_id,product_id,ota_platform' }
    )
    .select(MARKET_OUR_OFFER_COLUMNS)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const row = mapMarketOurOffer(asRecord(data), items)
  if (!row) throw new Error('our offer save failed')
  return row
}

export function parseSnapshotInput(body: {
  listingId?: string
  observedOn?: string
  canyon?: string
  offer?: string
  currency?: string
  sale?: unknown
  notIncluded?: unknown
  rating?: unknown
  reviewCount?: unknown
}) {
  const listingId = String(body.listingId || '').trim()
  const canyon = String(body.canyon || '')
  const offer = String(body.offer || '')
  const sale = Number(body.sale)
  if (!listingId) throw new Error('listingId required')
  if (!isMarketCanyonVariant(canyon)) throw new Error('invalid canyon')
  if (!isMarketOfferType(offer)) throw new Error('invalid offer type')
  if (!Number.isFinite(sale) || sale < 0) throw new Error('sale required')
  return {
    listingId,
    observedOn: body.observedOn?.trim() || undefined,
    canyon,
    offer,
    currency: body.currency?.trim() || 'USD',
    sale,
    notIncluded: Number(body.notIncluded) || 0,
    rating: body.rating == null || body.rating === '' ? null : Number(body.rating),
    reviewCount: body.reviewCount == null || body.reviewCount === '' ? null : Number(body.reviewCount),
  }
}
