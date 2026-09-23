import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import { supabaseAdmin } from '@/lib/supabase'
import { ensureTourBalanceQrLinks, type TourBalanceQrRequestItem } from '@/lib/tourBalanceQrLinks'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * POST /api/invoices/tour-balance-qr
 * 스태프: 투어 잔금 고객의 현장 카드 결제 링크를 일괄 준비합니다. 메일·문자는 보내지 않습니다.
 */
export async function POST(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON body required' }, { status: 400 })
  }

  const locale = body.locale === 'ko' ? 'ko' : 'en'
  const tourDate = typeof body.tourDate === 'string' ? body.tourDate : ''
  const rawItems = Array.isArray(body.items) ? body.items : []
  const items: TourBalanceQrRequestItem[] = []

  for (const raw of rawItems) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as Record<string, unknown>
    const reservationId = typeof row.reservationId === 'string' ? row.reservationId.trim() : ''
    if (!reservationId) continue
    const amountRaw = row.balanceUsd ?? row.amountUsd
    const balanceUsd = typeof amountRaw === 'number' ? amountRaw : Number(amountRaw)
    items.push({
      reservationId,
      recipientName: typeof row.recipientName === 'string' ? row.recipientName : '',
      balanceUsd,
    })
  }

  if (items.length === 0) {
    return NextResponse.json(
      { error: locale === 'ko' ? '잔금이 남은 예약이 없습니다.' : 'No reservations with a balance.' },
      { status: 400 }
    )
  }

  try {
    const links = await ensureTourBalanceQrLinks(supabaseAdmin, {
      locale,
      tourDate,
      createdBy: auth.userEmail,
      items,
    })
    return NextResponse.json({ success: true, links })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to prepare balance links'
    console.error('[tour-balance-qr]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
