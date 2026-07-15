import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import { supabaseAdmin } from '@/lib/supabase'
import { createOrRefreshStripePayableInvoice } from '@/lib/payableInvoice'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * POST /api/invoices/[id]/create-payment-link
 * 스태프: DB 인보이스 → Stripe Hosted Invoice 결제 링크 생성
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'Invoice id required' }, { status: 400 })
  }

  let forceNew = false
  let locale: 'ko' | 'en' = 'en'
  try {
    const body = await request.json().catch(() => ({}))
    forceNew = Boolean(body?.forceNew)
    if (body?.locale === 'ko') locale = 'ko'
  } catch {
    // empty body ok
  }

  try {
    const result = await createOrRefreshStripePayableInvoice(supabaseAdmin, id, {
      locale,
      forceNew,
    })
    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create payment link'
    console.error('[create-payment-link]', id, err)
    const status = /찾지 못|not found/i.test(message)
      ? 404
      : /이미 결제|already paid|취소|cancelled|이메일|email|0보다|greater than/i.test(message)
        ? 400
        : 500
    return NextResponse.json({ error: message }, { status })
  }
}
