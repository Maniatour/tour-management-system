import { supabaseAdmin } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { todayInLasVegas } from '@/lib/dailyReport/dateUtils'
import {
  MARKET_ALERT_COLUMNS,
  MARKET_ALERTS_TABLE,
  MARKET_COMPETITOR_COLUMNS,
  MARKET_COMPETITORS_TABLE,
  MARKET_LISTING_COLUMNS,
  MARKET_LISTINGS_TABLE,
  MARKET_SNAPSHOT_COLUMNS,
  MARKET_SNAPSHOTS_TABLE,
} from './tables'
import { mapCatalogChannel, mapCatalogProduct, mapMarketCompetitor, mapMarketListing, mapMarketSnapshot } from './mappers'
import { mapMarketPriceAlertRow } from './notify'
import { loadOurPriceOverlays } from './ourPrice'
import { isMarketCanyonVariant, isMarketOfferType, isMarketOtaPlatform } from './types'
import type { MarketCompetitor, MarketListing } from './types'

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

  const [competitorsRes, listingsRes, snapshotsRes, alertsRes, productsRes, channelsRes] =
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
    ])

  if (competitorsRes.error) throw new Error(competitorsRes.error.message)
  if (listingsRes.error) throw new Error(listingsRes.error.message)
  if (snapshotsRes.error) throw new Error(snapshotsRes.error.message)
  if (alertsRes.error) throw new Error(alertsRes.error.message)

  const competitors = (competitorsRes.data || [])
    .map((row) => mapMarketCompetitor(asRecord(row)))
    .filter((row): row is MarketCompetitor => row != null)
  const listings = (listingsRes.data || [])
    .map((row) => mapMarketListing(asRecord(row)))
    .filter((row): row is MarketListing => row != null)
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

  const ourPrices = await loadOurPriceOverlays(admin, listings).catch((error) => {
    console.error('[market-research] our price overlay', error)
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
    ourPrices,
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
      has_all_inclusive: input.hasAllInclusive !== false,
      has_sale_plus_excluded: input.hasSalePlusExcluded !== false,
      watch_enabled: input.watchEnabled !== false,
      duration_note: input.durationNote?.trim() || null,
      pickup_note: input.pickupNote?.trim() || null,
      group_size_note: input.groupSizeNote?.trim() || null,
      cancellation_note: input.cancellationNote?.trim() || null,
      language_note: input.languageNote?.trim() || null,
      itinerary_note: input.itineraryNote?.trim() || null,
      diff_notes: input.diffNotes?.trim() || null,
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
  if (input.hasAllInclusive !== undefined) patch.has_all_inclusive = input.hasAllInclusive
  if (input.hasSalePlusExcluded !== undefined) patch.has_sale_plus_excluded = input.hasSalePlusExcluded
  if (input.watchEnabled !== undefined) patch.watch_enabled = input.watchEnabled
  if (input.durationNote !== undefined) patch.duration_note = input.durationNote?.trim() || null
  if (input.pickupNote !== undefined) patch.pickup_note = input.pickupNote?.trim() || null
  if (input.groupSizeNote !== undefined) patch.group_size_note = input.groupSizeNote?.trim() || null
  if (input.cancellationNote !== undefined) patch.cancellation_note = input.cancellationNote?.trim() || null
  if (input.languageNote !== undefined) patch.language_note = input.languageNote?.trim() || null
  if (input.itineraryNote !== undefined) patch.itinerary_note = input.itineraryNote?.trim() || null
  if (input.diffNotes !== undefined) patch.diff_notes = input.diffNotes?.trim() || null

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
