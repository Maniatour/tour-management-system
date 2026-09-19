import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import { readActiveOperatorIdFromRequestLike } from '@/lib/operators/activeOperatorCookie'
import {
  createCompetitor,
  createListing,
  deleteCompetitor,
  deleteListing,
  loadMarketResearchBundle,
  parseSnapshotInput,
  updateCompetitor,
  updateListing,
} from '@/lib/market-research/store'
import { runCompetitorPriceCheck, saveManualSnapshot } from '@/lib/market-research/job'

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
        hasSalePlusExcluded: body.hasSalePlusExcluded !== false,
        watchEnabled: body.watchEnabled !== false,
        durationNote: body.durationNote == null ? null : String(body.durationNote),
        pickupNote: body.pickupNote == null ? null : String(body.pickupNote),
        groupSizeNote: body.groupSizeNote == null ? null : String(body.groupSizeNote),
        cancellationNote: body.cancellationNote == null ? null : String(body.cancellationNote),
        languageNote: body.languageNote == null ? null : String(body.languageNote),
        itineraryNote: body.itineraryNote == null ? null : String(body.itineraryNote),
        diffNotes: body.diffNotes == null ? null : String(body.diffNotes),
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

    if (action === 'fetch' || action === 'fetch_one') {
      const summary = await runCompetitorPriceCheck({
        operatorId,
        listingId: action === 'fetch_one' ? String(body.listingId || '') : undefined,
      })
      return NextResponse.json({ ok: true, summary })
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
