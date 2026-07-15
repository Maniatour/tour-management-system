import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ token: string }> }

/**
 * GET /api/invoices/pay/[token]
 * 공개: payment_token → Stripe hosted_invoice_url 로 302 리다이렉트
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 })
  }

  const { token } = await params
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    return NextResponse.json({ error: 'Invalid payment token' }, { status: 400 })
  }

  const { data: invoice, error } = await supabaseAdmin
    .from('invoices')
    .select('id, status, hosted_invoice_url, stripe_invoice_status, invoice_number')
    .eq('payment_token', token)
    .maybeSingle()

  if (error || !invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  if (invoice.status === 'paid' || invoice.stripe_invoice_status === 'paid') {
    return NextResponse.json(
      {
        error: 'Invoice already paid',
        status: 'paid',
        invoiceNumber: invoice.invoice_number,
      },
      { status: 409 }
    )
  }

  if (invoice.status === 'cancelled') {
    return NextResponse.json({ error: 'Invoice cancelled', status: 'cancelled' }, { status: 410 })
  }

  if (!invoice.hosted_invoice_url) {
    return NextResponse.json(
      { error: 'Payment link not ready', status: 'pending' },
      { status: 404 }
    )
  }

  return NextResponse.redirect(invoice.hosted_invoice_url, 302)
}
