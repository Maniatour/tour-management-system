import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'
import type { Database } from '@/lib/database.types'
import { getStripeClient } from '@/lib/customerBookingCheckout'

export const STAFF_PAYABLE_INVOICE_PURPOSE = 'staff_payable_invoice'

type AdminClient = SupabaseClient<Database>

type InvoiceItemRow = {
  productName?: string | null
  description?: string | null
  choiceInfo?: string | null
  date?: string | null
  quantity?: number | null
  unitPrice?: number | null
  total?: number | null
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

function usdToCents(amountUsd: number): number {
  return Math.round(amountUsd * 100)
}

function siteOrigin(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (siteUrl) return siteUrl.replace(/\/$/, '')
  const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL?.trim()
  if (vercelUrl) return `https://${vercelUrl.replace(/^https?:\/\//, '')}`
  return 'http://localhost:3000'
}

export function buildInvoiceSitePayUrl(paymentToken: string, locale: string = 'en'): string {
  const loc = locale === 'ko' || locale === 'en' ? locale : 'en'
  return `${siteOrigin()}/${loc}/pay/invoice/${paymentToken}`
}

function lineDescription(item: InvoiceItemRow, locale: string): string {
  const parts: string[] = []
  const name = (item.productName || '').trim()
  const desc = (item.description || '').trim()
  const choice = (item.choiceInfo || '').trim()
  const date = (item.date || '').trim()
  if (name) parts.push(name)
  else if (desc) parts.push(desc)
  if (choice) parts.push(choice)
  if (date) parts.push(date)
  if (parts.length === 0) {
    return locale === 'ko' ? '투어 항목' : 'Tour item'
  }
  return parts.join(' · ').slice(0, 450)
}

async function findOrCreateStripeCustomer(
  stripe: Stripe,
  params: { email: string; name: string; customerId: string | null }
): Promise<string> {
  const email = params.email.trim().toLowerCase()
  const existing = await stripe.customers.list({ email, limit: 1 })
  if (existing.data[0]?.id) {
    return existing.data[0].id
  }
  const created = await stripe.customers.create({
    email,
    ...(params.name ? { name: params.name } : {}),
    metadata: {
      customer_id: params.customerId || '',
      source: 'kovegas_staff_invoice',
    },
  })
  return created.id
}

async function voidOpenStripeInvoice(stripe: Stripe, stripeInvoiceId: string | null | undefined) {
  if (!stripeInvoiceId) return
  try {
    const inv = await stripe.invoices.retrieve(stripeInvoiceId)
    if (inv.status === 'draft') {
      await stripe.invoices.del(stripeInvoiceId)
      return
    }
    if (inv.status === 'open') {
      await stripe.invoices.voidInvoice(stripeInvoiceId)
    }
  } catch (err) {
    console.warn('[payableInvoice] failed to void previous Stripe invoice', stripeInvoiceId, err)
  }
}

/**
 * DB invoices 행으로부터 Stripe Hosted Invoice를 생성(또는 갱신)하고 URL을 저장합니다.
 */
export async function createOrRefreshStripePayableInvoice(
  admin: AdminClient,
  invoiceId: string,
  options?: { locale?: string; forceNew?: boolean }
): Promise<{
  invoiceId: string
  invoiceNumber: string
  stripeInvoiceId: string
  hostedInvoiceUrl: string
  paymentToken: string
  sitePayUrl: string
  reused: boolean
}> {
  const locale = options?.locale === 'ko' ? 'ko' : 'en'
  const stripe = getStripeClient()

  const { data: invoice, error: invoiceError } = await admin
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .single()

  if (invoiceError || !invoice) {
    throw new Error(locale === 'ko' ? '인보이스를 찾을 수 없습니다.' : 'Invoice not found.')
  }

  if (invoice.status === 'paid') {
    throw new Error(locale === 'ko' ? '이미 결제 완료된 인보이스입니다.' : 'Invoice is already paid.')
  }
  if (invoice.status === 'cancelled') {
    throw new Error(locale === 'ko' ? '취소된 인보이스입니다.' : 'Invoice is cancelled.')
  }

  const total = roundMoney(Number(invoice.total) || 0)
  if (total <= 0) {
    throw new Error(locale === 'ko' ? '결제 금액이 0보다 커야 합니다.' : 'Invoice total must be greater than zero.')
  }

  // 기존 open 인보이스가 있고 강제 재생성 아니면 재사용
  if (
    !options?.forceNew &&
    invoice.stripe_invoice_id &&
    invoice.hosted_invoice_url &&
    (invoice.stripe_invoice_status === 'open' || invoice.stripe_invoice_status === 'draft')
  ) {
    try {
      const existing = await stripe.invoices.retrieve(invoice.stripe_invoice_id)
      if (existing.status === 'open' && existing.hosted_invoice_url) {
        const token = invoice.payment_token || randomUUID()
        if (!invoice.payment_token) {
          await admin.from('invoices').update({ payment_token: token } as never).eq('id', invoiceId)
        }
        return {
          invoiceId,
          invoiceNumber: invoice.invoice_number,
          stripeInvoiceId: existing.id,
          hostedInvoiceUrl: existing.hosted_invoice_url,
          paymentToken: token,
          sitePayUrl: buildInvoiceSitePayUrl(token, locale),
          reused: true,
        }
      }
    } catch {
      // fall through to recreate
    }
  }

  let customerEmail = ''
  let customerName = ''
  if (invoice.customer_id) {
    const { data: customer } = await admin
      .from('customers')
      .select('id, name, email')
      .eq('id', invoice.customer_id)
      .maybeSingle()
    customerEmail = (customer?.email || '').trim()
    customerName = (customer?.name || '').trim()
  }

  if (!customerEmail) {
    throw new Error(
      locale === 'ko'
        ? '고객 이메일이 없어 Stripe 결제 링크를 만들 수 없습니다.'
        : 'Customer email is required to create a Stripe payment link.'
    )
  }

  await voidOpenStripeInvoice(stripe, invoice.stripe_invoice_id)

  const stripeCustomerId = await findOrCreateStripeCustomer(stripe, {
    email: customerEmail,
    name: customerName,
    customerId: invoice.customer_id,
  })

  const items = (Array.isArray(invoice.items) ? invoice.items : []) as InvoiceItemRow[]
  const lineAmounts: { description: string; amountCents: number }[] = []

  for (const item of items) {
    const lineTotal =
      item.total != null && Number.isFinite(Number(item.total))
        ? roundMoney(Number(item.total))
        : roundMoney((Number(item.unitPrice) || 0) * (Number(item.quantity) || 0))
    if (lineTotal === 0) continue
    lineAmounts.push({
      description: lineDescription(item, locale),
      amountCents: usdToCents(lineTotal),
    })
  }

  const linesSum = lineAmounts.reduce((s, l) => s + l.amountCents, 0)
  const targetCents = usdToCents(total)
  const adjustment = targetCents - linesSum

  let daysUntilDue = 14
  if (invoice.due_date) {
    const dueMs = new Date(`${invoice.due_date}T23:59:59Z`).getTime()
    const diffDays = Math.ceil((dueMs - Date.now()) / 86_400_000)
    daysUntilDue = Math.max(1, Math.min(Number.isFinite(diffDays) ? diffDays : 14, 90))
  }

  const draft = await stripe.invoices.create({
    customer: stripeCustomerId,
    collection_method: 'send_invoice',
    days_until_due: daysUntilDue,
    currency: 'usd',
    metadata: {
      purpose: STAFF_PAYABLE_INVOICE_PURPOSE,
      invoice_id: invoiceId,
      invoice_number: invoice.invoice_number,
      customer_id: invoice.customer_id || '',
    },
    pending_invoice_items_behavior: 'exclude',
    auto_advance: false,
  })

  for (const line of lineAmounts) {
    if (line.amountCents === 0) continue
    await stripe.invoiceItems.create({
      customer: stripeCustomerId,
      invoice: draft.id,
      amount: line.amountCents,
      currency: 'usd',
      description: line.description,
    })
  }

  if (adjustment !== 0) {
    await stripe.invoiceItems.create({
      customer: stripeCustomerId,
      invoice: draft.id,
      amount: adjustment,
      currency: 'usd',
      description:
        locale === 'ko'
          ? adjustment > 0
            ? '세금·수수료·기타 조정'
            : '할인·기타 조정'
          : adjustment > 0
            ? 'Tax, fees & adjustments'
            : 'Discount & adjustments',
    })
  }

  const finalized = await stripe.invoices.finalizeInvoice(draft.id)
  const hostedInvoiceUrl = finalized.hosted_invoice_url
  if (!hostedInvoiceUrl) {
    throw new Error(
      locale === 'ko'
        ? 'Stripe 결제 URL을 받지 못했습니다.'
        : 'Stripe did not return a hosted invoice URL.'
    )
  }

  const paymentToken = invoice.payment_token || randomUUID()

  const { error: updateError } = await admin
    .from('invoices')
    .update({
      stripe_invoice_id: finalized.id,
      stripe_customer_id: stripeCustomerId,
      hosted_invoice_url: hostedInvoiceUrl,
      stripe_invoice_status: finalized.status || 'open',
      payment_token: paymentToken,
    } as never)
    .eq('id', invoiceId)

  if (updateError) {
    throw new Error(updateError.message || 'Failed to save Stripe invoice fields')
  }

  return {
    invoiceId,
    invoiceNumber: invoice.invoice_number,
    stripeInvoiceId: finalized.id,
    hostedInvoiceUrl,
    paymentToken,
    sitePayUrl: buildInvoiceSitePayUrl(paymentToken, locale),
    reused: false,
  }
}

export async function markInvoicePaidFromStripeWebhook(
  admin: AdminClient,
  stripeInvoice: Stripe.Invoice
): Promise<{ ok: boolean; invoiceId?: string; alreadyPaid?: boolean }> {
  const purpose = stripeInvoice.metadata?.purpose
  const invoiceId = stripeInvoice.metadata?.invoice_id
  if (purpose !== STAFF_PAYABLE_INVOICE_PURPOSE || !invoiceId) {
    return { ok: false }
  }

  const { data: existing } = await admin
    .from('invoices')
    .select('id, status')
    .eq('id', invoiceId)
    .maybeSingle()

  if (!existing) {
    // fallback by stripe_invoice_id
    const { data: byStripe } = await admin
      .from('invoices')
      .select('id, status')
      .eq('stripe_invoice_id', stripeInvoice.id)
      .maybeSingle()
    if (!byStripe) return { ok: false }
    if (byStripe.status === 'paid') {
      return { ok: true, invoiceId: byStripe.id, alreadyPaid: true }
    }
    await admin
      .from('invoices')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        stripe_invoice_status: 'paid',
        hosted_invoice_url: stripeInvoice.hosted_invoice_url || undefined,
      } as never)
      .eq('id', byStripe.id)
    return { ok: true, invoiceId: byStripe.id }
  }

  if (existing.status === 'paid') {
    return { ok: true, invoiceId: existing.id, alreadyPaid: true }
  }

  await admin
    .from('invoices')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      stripe_invoice_id: stripeInvoice.id,
      stripe_invoice_status: 'paid',
      hosted_invoice_url: stripeInvoice.hosted_invoice_url || undefined,
    } as never)
    .eq('id', existing.id)

  return { ok: true, invoiceId: existing.id }
}
