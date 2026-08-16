import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSupabaseForApiRoute } from '@/lib/api-route-supabase'
import {
  applyZelleGroupLinkToBookings,
  applyZelleImportLinkToBookings,
  listZelleReservationImports,
  processZellePaymentsFromReservationImports,
} from '@/lib/processZellePaymentEmail'

export const maxDuration = 120

export async function GET(request: NextRequest) {
  const auth = await getSupabaseForApiRoute(request)
  if (auth instanceof NextResponse) return auth
  const {
    data: { user },
  } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  const client = supabaseAdmin ?? auth
  const items = await listZelleReservationImports(client)
  const pending = items.filter((r) => !r.processed).length
  const needsReview = items.filter(
    (r) =>
      r.processed &&
      (r.status === 'unmatched' || r.status === 'partial' || r.status === 'amount_mismatch' || r.status === 'parse_failed')
  ).length
  return NextResponse.json({ items, pending, needsReview })
}

export async function POST(request: NextRequest) {
  const auth = await getSupabaseForApiRoute(request)
  if (auth instanceof NextResponse) return auth
  const {
    data: { user },
  } = await auth.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as {
    action?: string
    reprocessUnmatched?: boolean
    importId?: string
    bookingIds?: string[]
    importIds?: string[]
    reparseFailed?: boolean
    reparseToken?: string
    links?: Array<{ importId: string; bookingIds: string[] }>
  }
  const client = supabaseAdmin ?? auth

  if (body.action === 'link') {
    const groupImportIds = (body.importIds ?? []).filter(Boolean)
    const groupBookingIds = body.bookingIds ?? []
    if (groupImportIds.length > 0 && groupBookingIds.length > 0) {
      const r = await applyZelleGroupLinkToBookings(client, {
        importIds: groupImportIds,
        bookingIds: groupBookingIds,
        actorEmail: user.email,
      })
      if (r.error) {
        return NextResponse.json({ error: r.error, paid: 0, attached: 0 }, { status: 400 })
      }
      return NextResponse.json({
        action: 'link',
        paid: r.paidBookingIds.length,
        attached: r.attached,
        results: [{ importId: groupImportIds.join(','), ...r }],
        error: null,
      })
    }
    const links =
      Array.isArray(body.links) && body.links.length > 0
        ? body.links
        : body.importId
          ? [{ importId: body.importId, bookingIds: body.bookingIds ?? [] }]
          : []
    if (links.length === 0) {
      return NextResponse.json({ error: '연결할 Zelle·부킹이 없습니다.' }, { status: 400 })
    }
    const results: Array<{
      importId: string
      paidBookingIds: string[]
      attached: number
      error?: string
    }> = []
    for (const link of links) {
      if (!link.importId || !Array.isArray(link.bookingIds) || link.bookingIds.length === 0) continue
      const r = await applyZelleImportLinkToBookings(client, {
        importId: link.importId,
        bookingIds: link.bookingIds,
        actorEmail: user.email,
      })
      results.push({ importId: link.importId, ...r })
    }
    const paid = results.reduce((s, r) => s + r.paidBookingIds.length, 0)
    const attached = results.reduce((s, r) => s + r.attached, 0)
    const firstError = results.find((r) => r.error)?.error
    return NextResponse.json({
      action: 'link',
      paid,
      attached,
      results,
      error: firstError ?? null,
    })
  }

  const result = await processZellePaymentsFromReservationImports(client, {
    actorEmail: user.email,
    reprocessUnmatched: body.reprocessUnmatched === true,
    reparseFailed: body.reparseFailed === true,
    reparseToken: typeof body.reparseToken === 'string' ? body.reparseToken : null,
    importIds: Array.isArray(body.importIds) ? body.importIds.filter(Boolean) : undefined,
    batchSize: 20,
  })

  const items = result.items.map((r) => ({
    importId: r.importId,
    status: r.status,
    processed: r.processed,
    skipped: r.skipped,
    amount: r.parsed?.amount ?? null,
    recipient: r.parsed?.recipient ?? null,
    confirmationNumber: r.parsed?.confirmationNumber ?? null,
    paymentDateYmd: r.parsed?.paymentDateYmd ?? null,
    received_at: r.receivedAt ?? null,
    rnNumbers: r.parsed?.rnNumbers ?? [],
    invoiceNumbers: r.parsed?.invoiceNumbers ?? [],
    paidBookingIds: r.paidBookingIds,
    unmatchedRns: r.unmatchedRns,
    tourExpenseIds: r.tourExpenseIds,
    statementLineIds: r.statementLineIds,
    bookingExpenseSum: r.bookingExpenseSum,
    amountMismatch: r.amountMismatch,
    error: r.error ?? null,
  }))

  return NextResponse.json({
    processed: result.processed,
    remaining: result.remaining,
    fetchedBodies: result.fetchedBodies,
    skippedVendors: result.skippedVendors,
    gmailError: result.gmailError,
    paid: items.filter((i) => i.status === 'paid').length,
    partial: items.filter((i) => i.status === 'partial').length,
    unmatched: items.filter((i) => i.status === 'unmatched').length,
    amountMismatch: items.filter((i) => i.status === 'amount_mismatch').length,
    parseFailed: items.filter((i) => i.status === 'parse_failed').length,
    items,
  })
}
