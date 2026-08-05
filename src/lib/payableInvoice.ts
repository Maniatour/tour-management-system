import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'
import type { Database } from '@/lib/database.types'
import { getStripeClient } from '@/lib/customerBookingCheckout'
import { generateCustomerId } from '@/lib/entityIds'
import { operatorIdInsert, resolveOperatorId } from '@/lib/operators/scopeQuery'

export const STAFF_PAYABLE_INVOICE_PURPOSE = 'staff_payable_invoice'

/** invoices.notes 마커 — 빠른 금액 청구 내역 조회용 */
export const QUICK_PAYMENT_INVOICE_NOTES = 'quick_payment_request'
const QUICK_PAYMENT_NOTES_LEGACY = ['빠른 금액 청구', 'Quick payment request'] as const

export function isQuickPaymentInvoiceNotes(notes: string | null | undefined): boolean {
  const n = (notes || '').trim()
  if (!n) return false
  if (n === QUICK_PAYMENT_INVOICE_NOTES) return true
  return (QUICK_PAYMENT_NOTES_LEGACY as readonly string[]).includes(n)
}

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

function lasVegasDateString(offsetDays = 0): string {
  const now = new Date()
  const lv = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  if (offsetDays) lv.setDate(lv.getDate() + offsetDays)
  const y = lv.getFullYear()
  const m = String(lv.getMonth() + 1).padStart(2, '0')
  const d = String(lv.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function buildQuickInvoiceNumber(): string {
  const date = lasVegasDateString().replace(/-/g, '')
  const random = Math.floor(Math.random() * 9000) + 1000
  return `INV-${date}-${random}`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildQuickPaymentRequestEmailHtml(params: {
  locale: 'ko' | 'en'
  recipientName: string
  description: string
  amountUsd: number
  invoiceNumber: string
  payUrl: string
}): string {
  const { locale, recipientName, description, amountUsd, invoiceNumber, payUrl } = params
  const greeting =
    locale === 'ko'
      ? `${escapeHtml(recipientName || '고객')}님,`
      : `Hello ${escapeHtml(recipientName || 'there')},`
  const intro =
    locale === 'ko'
      ? '아래 금액에 대한 결제 요청이 도착했습니다. 카드를 통해 안전하게 결제해 주세요.'
      : 'You have a payment request. Please pay securely by card using the button below.'
  const amountLabel = locale === 'ko' ? '청구 금액' : 'Amount'
  const descLabel = locale === 'ko' ? '내용' : 'Description'
  const invLabel = locale === 'ko' ? '인보이스 번호' : 'Invoice #'
  const cta = locale === 'ko' ? '지금 결제하기' : 'Pay Now'
  const footer =
    locale === 'ko'
      ? '본 메일은 Las Vegas Mania Tour / Kovegas에서 발송되었습니다.'
      : 'This email was sent by Las Vegas Mania Tour / Kovegas.'

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px;">
    <p style="margin:0 0 12px;font-size:16px;">${greeting}</p>
    <p style="margin:0 0 20px;font-size:14px;color:#4b5563;line-height:1.5;">${intro}</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;">${invLabel}</td>
        <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-size:13px;font-weight:600;">${escapeHtml(invoiceNumber)}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;">${descLabel}</td>
        <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-size:13px;">${escapeHtml(description)}</td>
      </tr>
      <tr>
        <td style="padding:12px 0;color:#6b7280;font-size:13px;">${amountLabel}</td>
        <td style="padding:12px 0;text-align:right;font-size:22px;font-weight:700;">$${amountUsd.toFixed(2)}</td>
      </tr>
    </table>
    <div style="text-align:center;margin:8px 0 20px;">
      <a href="${escapeHtml(payUrl)}" style="display:inline-block;background:#0B5FFF;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;">${cta}</a>
    </div>
    <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">${footer}</p>
  </div>
</body>
</html>`
}

/**
 * 금액·내용·이메일만으로 DB 인보이스 + Stripe Hosted Invoice를 만들고 결제 URL을 반환합니다.
 */
export async function createQuickPayableInvoice(
  admin: AdminClient,
  params: {
    email: string
    amountUsd: number
    description: string
    recipientName?: string
    locale?: 'ko' | 'en'
    operatorId?: string | null
    createdBy?: string | null
  }
): Promise<{
  invoiceId: string
  invoiceNumber: string
  customerId: string
  customerCreated: boolean
  stripeInvoiceId: string
  hostedInvoiceUrl: string
  paymentToken: string
  sitePayUrl: string
  amountUsd: number
  description: string
  email: string
  recipientName: string
}> {
  const locale = params.locale === 'ko' ? 'ko' : 'en'
  const email = params.email.trim().toLowerCase()
  const description = params.description.trim()
  const amountUsd = roundMoney(Number(params.amountUsd))
  const recipientName = (params.recipientName || '').trim() || email.split('@')[0] || 'Guest'

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(locale === 'ko' ? '유효한 이메일이 필요합니다.' : 'A valid email is required.')
  }
  if (!description) {
    throw new Error(locale === 'ko' ? '청구 내용을 입력해 주세요.' : 'Description is required.')
  }
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    throw new Error(locale === 'ko' ? '결제 금액이 0보다 커야 합니다.' : 'Amount must be greater than zero.')
  }
  if (amountUsd > 100_000) {
    throw new Error(locale === 'ko' ? '금액이 너무 큽니다.' : 'Amount is too large.')
  }

  const operatorId = resolveOperatorId(params.operatorId)

  const { data: existingCustomer } = await admin
    .from('customers')
    .select('id, name, email')
    .eq('operator_id', operatorId)
    .ilike('email', email)
    .eq('archive', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let customerId: string
  let customerCreated = false

  if (existingCustomer?.id) {
    customerId = existingCustomer.id
    if (recipientName && existingCustomer.name !== recipientName) {
      await admin
        .from('customers')
        .update({ name: recipientName, updated_at: new Date().toISOString() } as never)
        .eq('id', customerId)
    }
  } else {
    customerId = generateCustomerId()
    const { error: customerError } = await admin.from('customers').insert({
      id: customerId,
      name: recipientName,
      email,
      status: 'active',
      ...operatorIdInsert(operatorId),
    } as never)
    if (customerError) {
      throw new Error(customerError.message || 'Failed to create customer')
    }
    customerCreated = true
  }

  const invoiceNumber = buildQuickInvoiceNumber()
  const invoiceDate = lasVegasDateString()
  const dueDate = lasVegasDateString(7)

  const items = [
    {
      id: randomUUID(),
      productId: '',
      productName: description,
      description,
      date: invoiceDate,
      quantity: 1,
      unitPrice: amountUsd,
      total: amountUsd,
      editable: true,
      itemType: 'product',
    },
  ]

  const { data: invoice, error: invoiceError } = await admin
    .from('invoices')
    .insert({
      customer_id: customerId,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      due_date: dueDate,
      items: items as never,
      subtotal: amountUsd,
      tax: 0,
      tax_percent: 0,
      apply_tax: false,
      discount: 0,
      discount_percent: 0,
      apply_discount: false,
      processing_fee: 0,
      apply_processing_fee: false,
      total: amountUsd,
      notes: QUICK_PAYMENT_INVOICE_NOTES,
      status: 'draft',
      created_by: params.createdBy || null,
    } as never)
    .select('id')
    .single()

  if (invoiceError || !invoice) {
    throw new Error(invoiceError?.message || 'Failed to create invoice')
  }

  const pay = await createOrRefreshStripePayableInvoice(admin, invoice.id, { locale })

  return {
    invoiceId: pay.invoiceId,
    invoiceNumber: pay.invoiceNumber,
    customerId,
    customerCreated,
    stripeInvoiceId: pay.stripeInvoiceId,
    hostedInvoiceUrl: pay.hostedInvoiceUrl,
    paymentToken: pay.paymentToken,
    sitePayUrl: pay.sitePayUrl,
    amountUsd,
    description,
    email,
    recipientName,
  }
}

export type QuickPaymentHistoryItem = {
  id: string
  invoiceNumber: string
  status: string
  total: number
  description: string
  email: string
  recipientName: string
  createdAt: string | null
  sentAt: string | null
  paidAt: string | null
  createdBy: string | null
  sitePayUrl: string | null
  hostedInvoiceUrl: string | null
  stripeInvoiceStatus: string | null
}

function descriptionFromInvoiceItems(items: unknown, locale: 'ko' | 'en'): string {
  if (!Array.isArray(items) || items.length === 0) {
    return locale === 'ko' ? '(내용 없음)' : '(No description)'
  }
  const first = items[0] as InvoiceItemRow
  const text = (first.description || first.productName || '').trim()
  return text || (locale === 'ko' ? '(내용 없음)' : '(No description)')
}

/**
 * 빠른 금액 청구로 만든 인보이스 최근 목록을 반환합니다.
 */
export async function listQuickPaymentInvoices(
  admin: AdminClient,
  options?: { locale?: 'ko' | 'en'; limit?: number }
): Promise<QuickPaymentHistoryItem[]> {
  const locale = options?.locale === 'ko' ? 'ko' : 'en'
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100)

  const { data, error } = await admin
    .from('invoices')
    .select(
      'id, invoice_number, status, total, items, created_at, sent_at, paid_at, created_by, payment_token, hosted_invoice_url, stripe_invoice_status, customer_id, customers(id, name, email)'
    )
    .in('notes', [QUICK_PAYMENT_INVOICE_NOTES, ...QUICK_PAYMENT_NOTES_LEGACY])
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(error.message || 'Failed to load quick payment history')
  }

  return (data || []).map((row) => {
    const customerRaw = (row as { customers?: unknown }).customers
    const customer = Array.isArray(customerRaw)
      ? (customerRaw[0] as { name?: string | null; email?: string | null } | undefined)
      : (customerRaw as { name?: string | null; email?: string | null } | null | undefined)
    const paymentToken = (row as { payment_token?: string | null }).payment_token
    return {
      id: String(row.id),
      invoiceNumber: String(row.invoice_number || ''),
      status: String(row.status || 'draft'),
      total: roundMoney(Number(row.total) || 0),
      description: descriptionFromInvoiceItems(row.items, locale),
      email: (customer?.email || '').trim(),
      recipientName: (customer?.name || '').trim(),
      createdAt: row.created_at ?? null,
      sentAt: row.sent_at ?? null,
      paidAt: row.paid_at ?? null,
      createdBy: row.created_by ?? null,
      sitePayUrl: paymentToken ? buildInvoiceSitePayUrl(paymentToken, locale) : null,
      hostedInvoiceUrl: row.hosted_invoice_url ?? null,
      stripeInvoiceStatus: row.stripe_invoice_status ?? null,
    }
  })
}
