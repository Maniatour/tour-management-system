import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import { readActiveOperatorIdFromRequestLike } from '@/lib/operators/activeOperatorCookie'
import {
  addFocusProduct,
  addMarketBadge,
  addMarketCompareItem,
  createCompetitor,
  createListing,
  deleteCompetitor,
  deleteFocusProduct,
  deleteListing,
  deleteMarketBadge,
  deleteMarketCompareItem,
  loadMarketResearchBundle,
  parseSnapshotInput,
  saveOurOffer,
  updateCompetitor,
  updateListing,
} from '@/lib/market-research/store'
import { runCompetitorPriceCheck, saveManualSnapshot, saveTodayPrices } from '@/lib/market-research/competitorPriceJob'
import { parseExcludedItems, parseInclusionMap } from '@/lib/market-research/excludedItems'
import { parseListingBadges } from '@/lib/market-research/badges'


function operatorFrom(request: NextRequest): string | null {
  return (
    readActiveOperatorIdFromRequestLike(request) ||
    request.nextUrl.searchParams.get('operatorId')
  )
}

export async function GET(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  try {
    const bundle = await loadMarketResearchBundle(operatorFrom(request))
    return NextResponse.json({ ok: true, ...bundle })
  } catch (error) {
    console.error('[admin/market-research GET]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'load failed' },
      { status: 400 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  try {
    const body = (await request.json()) as Record<string, unknown>
    const action = String(body.action || '')
    const operatorId = operatorFrom(request)

    if (action === 'create_competitor') {
      const row = await createCompetitor({
        operatorId,
        name: String(body.name || ''),
        websiteUrl: body.websiteUrl == null ? null : String(body.websiteUrl),
        notes: body.notes == null ? null : String(body.notes),
        isActive: body.isActive !== false,
      })
      return NextResponse.json({ ok: true, competitor: row })
    }

    if (action === 'update_competitor') {
      const row = await updateCompetitor({
        id: String(body.id || ''),
        name: body.name == null ? undefined : String(body.name),
        websiteUrl: body.websiteUrl === undefined ? undefined : body.websiteUrl == null ? null : String(body.websiteUrl),
        notes: body.notes === undefined ? undefined : body.notes == null ? null : String(body.notes),
        isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
      })
      return NextResponse.json({ ok: true, competitor: row })
    }

    if (action === 'delete_competitor') {
      await deleteCompetitor(String(body.id || ''))
      return NextResponse.json({ ok: true })
    }

    if (action === 'create_listing') {
      const row = await createListing({
        operatorId,
        competitorId: String(body.competitorId || ''),
        otaPlatform: String(body.otaPlatform || ''),
        listingUrl: String(body.listingUrl || ''),
        listingTitle: body.listingTitle == null ? null : String(body.listingTitle),
        mappedProductId: body.mappedProductId == null ? null : String(body.mappedProductId),
        mappedChannelId: body.mappedChannelId == null ? null : String(body.mappedChannelId),
        hasLower: body.hasLower !== false,
        hasAntelopeX: body.hasAntelopeX !== false,
        hasAllInclusive: body.hasAllInclusive !== false,
        hasSalePlusExcluded: body.hasSalePlusExcluded === true,
        watchEnabled: body.watchEnabled !== false,
        durationNote: body.durationNote == null ? null : String(body.durationNote),
        pickupNote: body.pickupNote == null ? null : String(body.pickupNote),
        groupSizeNote: body.groupSizeNote == null ? null : String(body.groupSizeNote),
        cancellationNote: body.cancellationNote == null ? null : String(body.cancellationNote),
        languageNote: body.languageNote == null ? null : String(body.languageNote),
        itineraryNote: body.itineraryNote == null ? null : String(body.itineraryNote),
        diffNotes: body.diffNotes == null ? null : String(body.diffNotes),
        inclusionItems: parseInclusionMap(body.inclusionItems, body.hasSalePlusExcluded !== true),
      })
      return NextResponse.json({ ok: true, listing: row })
    }

    if (action === 'update_listing') {
      const row = await updateListing({
        id: String(body.id || ''),
        listingUrl: body.listingUrl == null ? undefined : String(body.listingUrl),
        listingTitle: body.listingTitle === undefined ? undefined : body.listingTitle == null ? null : String(body.listingTitle),
        mappedProductId:
          body.mappedProductId === undefined
            ? undefined
            : body.mappedProductId == null
              ? null
              : String(body.mappedProductId),
        mappedChannelId:
          body.mappedChannelId === undefined
            ? undefined
            : body.mappedChannelId == null
              ? null
              : String(body.mappedChannelId),
        otaPlatform: body.otaPlatform == null ? undefined : String(body.otaPlatform),
        competitorId: body.competitorId == null ? undefined : String(body.competitorId),
        hasLower: typeof body.hasLower === 'boolean' ? body.hasLower : undefined,
        hasAntelopeX: typeof body.hasAntelopeX === 'boolean' ? body.hasAntelopeX : undefined,
        hasAllInclusive: typeof body.hasAllInclusive === 'boolean' ? body.hasAllInclusive : undefined,
        hasSalePlusExcluded:
          typeof body.hasSalePlusExcluded === 'boolean' ? body.hasSalePlusExcluded : undefined,
        watchEnabled: typeof body.watchEnabled === 'boolean' ? body.watchEnabled : undefined,
        durationNote: body.durationNote === undefined ? undefined : body.durationNote == null ? null : String(body.durationNote),
        pickupNote: body.pickupNote === undefined ? undefined : body.pickupNote == null ? null : String(body.pickupNote),
        groupSizeNote: body.groupSizeNote === undefined ? undefined : body.groupSizeNote == null ? null : String(body.groupSizeNote),
        cancellationNote:
          body.cancellationNote === undefined
            ? undefined
            : body.cancellationNote == null
              ? null
              : String(body.cancellationNote),
        languageNote: body.languageNote === undefined ? undefined : body.languageNote == null ? null : String(body.languageNote),
        itineraryNote: body.itineraryNote === undefined ? undefined : body.itineraryNote == null ? null : String(body.itineraryNote),
        diffNotes: body.diffNotes === undefined ? undefined : body.diffNotes == null ? null : String(body.diffNotes),
        inclusionItems:
          body.inclusionItems === undefined
            ? undefined
            : parseInclusionMap(body.inclusionItems, body.hasSalePlusExcluded !== true),
      })
      return NextResponse.json({ ok: true, listing: row })
    }

    if (action === 'delete_listing') {
      await deleteListing(String(body.id || ''))
      return NextResponse.json({ ok: true })
    }

    if (action === 'save_snapshot') {
      const parsed = parseSnapshotInput(body)
      const result = await saveManualSnapshot({ ...parsed, operatorId })
      return NextResponse.json({ ok: true, ...result })
    }

    if (action === 'save_today_prices') {
      const optionalMoney = (value: unknown): number | null => {
        if (value == null || value === '') return null
        const n = Number(value)
        return Number.isFinite(n) && n >= 0 ? n : null
      }
      const result = await saveTodayPrices({
        operatorId,
        listingId: String(body.listingId || ''),
        fromPrice: optionalMoney(body.fromPrice),
        lowerSale: optionalMoney(body.lowerSale),
        antelopeXSale: optionalMoney(body.antelopeXSale),
        lowerNotIncluded: optionalMoney(body.lowerNotIncluded),
        antelopeXNotIncluded: optionalMoney(body.antelopeXNotIncluded),
        lowerExcludedItems: parseExcludedItems(body.lowerExcludedItems),
        antelopeXExcludedItems: parseExcludedItems(body.antelopeXExcludedItems),
        rating: optionalMoney(body.rating),
        reviewCount: optionalMoney(body.reviewCount),
        badges: parseListingBadges(body.badges),
        offer: body.offer === 'sale_plus_excluded' ? 'sale_plus_excluded' : 'all_inclusive',
        discountEnabled: body.discountEnabled === true || Number(body.discountPercent) > 0,
        discountPercent: Number(body.discountPercent) || 0,
      })
      return NextResponse.json({ ok: true, ...result })
    }

    if (action === 'fetch' || action === 'fetch_one') {
      const summary = await runCompetitorPriceCheck({
        operatorId,
        listingId: action === 'fetch_one' ? String(body.listingId || '') : undefined,
      })
      return NextResponse.json({ ok: true, summary })
    }

    if (action === 'add_focus_product') {
      const row = await addFocusProduct({
        operatorId,
        productId: String(body.productId || ''),
      })
      return NextResponse.json({ ok: true, focusProduct: row })
    }

    if (action === 'delete_focus_product') {
      await deleteFocusProduct({
        operatorId,
        productId: String(body.productId || ''),
      })
      return NextResponse.json({ ok: true })
    }

    if (action === 'add_badge') {
      const row = await addMarketBadge({
        operatorId,
        label: String(body.label || ''),
      })
      return NextResponse.json({ ok: true, badge: row })
    }

    if (action === 'delete_badge') {
      await deleteMarketBadge({
        operatorId,
        badgeId: String(body.badgeId || ''),
      })
      return NextResponse.json({ ok: true })
    }

    if (action === 'add_compare_item') {
      const row = await addMarketCompareItem({
        operatorId,
        label: String(body.label || ''),
      })
      return NextResponse.json({ ok: true, compareItem: row })
    }

    if (action === 'delete_compare_item') {
      await deleteMarketCompareItem({
        operatorId,
        itemId: String(body.itemId || ''),
      })
      return NextResponse.json({ ok: true })
    }

    if (action === 'save_our_offer') {
      const row = await saveOurOffer({
        operatorId,
        productId: String(body.productId || ''),
        otaPlatform: String(body.otaPlatform || ''),
        inclusionItems: parseInclusionMap(body.inclusionItems, true),
        excludedItems: parseExcludedItems(body.excludedItems),
        channelSettings: body.channelSettings,
      })
      return NextResponse.json({ ok: true, ourOffer: row })
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 })
  } catch (error) {
    console.error('[admin/market-research POST]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'save failed' },
      { status: 400 }
    )
  }
}
