import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createPublicInvoicePaySession } from '@/lib/payableInvoice'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ token: string }> }

/**
 * POST /api/invoices/pay/[token]/checkout
 * 공개: 인보이스 결제(+선택 팁) 또는 팁 오픈금액 Checkout Session 생성
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 })
  }

  const { token } = await params
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    return NextResponse.json({ error: 'Invalid payment token' }, { status: 400 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const locale = body.locale === 'ko' ? 'ko' : 'en'
  const tipRaw = body.tipUsd ?? body.tip
  const amountRaw = body.amountUsd ?? body.amount
  const tipUsd = typeof tipRaw === 'number' ? tipRaw : Number(tipRaw || 0)
  const amountUsd = typeof amountRaw === 'number' ? amountRaw : Number(amountRaw)

  try {
    const result = await createPublicInvoicePaySession(supabaseAdmin, token, {
      locale,
      tipUsd: Number.isFinite(tipUsd) ? tipUsd : 0,
      ...(Number.isFinite(amountUsd) ? { amountUsd } : {}),
    })
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to start payment'
    console.error('[invoices/pay/checkout]', token, err)
    const status = /찾지 못|not found/i.test(message)
      ? 404
      : /이미 결제|already paid|취소|cancelled|금액|amount|팁|tip|0보다|greater|커야|invalid/i.test(
          message
        )
        ? 400
        : 500
    return NextResponse.json({ error: message }, { status })
  }
}
