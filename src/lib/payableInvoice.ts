import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'
import type { Database } from '@/lib/database.types'
import { getStripeClient } from '@/lib/customerBookingCheckout'
import { generateCustomerId } from '@/lib/entityIds'
import { operatorIdInsert, resolveOperatorId } from '@/lib/operators/scopeQuery'
import { lookupReservationOperatorId } from '@/lib/operators/lookupReservationOperatorId'
import { syncReservationPricingAggregates } from '@/lib/syncReservationPricingAggregates'
import { isReservationCancelledStatus } from '@/utils/tourUtils'
import {
  appendOtaTempEmailToSpecialRequests,
  isGetYourGuideReplyEmail,
} from '@/lib/otaDirectCustomerEmail'
import { parseRecipientEmail } from '@/lib/quickPaymentRequestMessage'

export const STAFF_PAYABLE_INVOICE_PURPOSE = 'staff_payable_invoice'

/** invoices.notes 마커 — 빠른 금액 청구 내역 조회용 */
export const QUICK_PAYMENT_INVOICE_NOTES = 'quick_payment_request'
const QUICK_PAYMENT_NOTES_LEGACY = ['빠른 금액 청구', 'Quick payment request'] as const
const STRIPE_INVOICE_NOTE_PREFIX = 'stripe_invoice_id:'

export function isQuickPaymentInvoiceNotes(notes: string | null | undefined): boolean {
  const n = (notes || '').trim()
  if (!n) return false
  if (n === QUICK_PAYMENT_INVOICE_NOTES || n.includes(QUICK_PAYMENT_INVOICE_NOTES)) return true
  return (QUICK_PAYMENT_NOTES_LEGACY as readonly string[]).some((legacy) => n.includes(legacy))
}

type AdminClient = SupabaseClient<Database>

function isUniqueViolation(error: { code?: string; message?: string } | null | undefined): boolean {
  const code = String(error?.code || '')
  const message = String(error?.message || '').toLowerCase()
  return code === '23505' || message.includes('duplicate key') || message.includes('unique constraint')
}

function stripeErrorMessage(err: unknown, locale: 'ko' | 'en'): string {
  const raw =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message?: unknown }).message || '')
      : err instanceof Error
        ? err.message
        : ''
  if (!raw) {
    return locale === 'ko' ? 'Stripe 결제 링크를 만들지 못했습니다.' : 'Failed to create a Stripe payment link.'
  }
  if (/email/i.test(raw) && /customer/i.test(raw)) {
    return locale === 'ko'
      ? `고객 이메일 때문에 Stripe 결제 링크를 만들지 못했습니다. (${raw})`
      : `Stripe could not create a payment link because of the customer email. (${raw})`
  }
  return locale === 'ko' ? `Stripe 결제 링크 생성 실패: ${raw}` : `Failed to create Stripe payment link: ${raw}`
}

export async function replaceGetYourGuideRelayCustomerEmail(
  admin: AdminClient,
  params: {
    reservationId: string
    newEmail: string
    recipientName?: string
    locale?: 'ko' | 'en'
  }
): Promise<{
  customerId: string
  email: string
  previousEmail: string
  specialRequests: string
} | null> {
  const locale = params.locale === 'ko' ? 'ko' : 'en'
  const email = parseRecipientEmail(params.newEmail)
  const reservationId = params.reservationId.trim()
  const recipientName = (params.recipientName || '').trim()

  if (!reservationId) {
    throw new Error(locale === 'ko' ? '예약 정보가 필요합니다.' : 'Reservation is required.')
  }
  if (!email) {
    throw new Error(locale === 'ko' ? '유효한 이메일이 필요합니다.' : 'A valid email is required.')
  }
  if (isGetYourGuideReplyEmail(email)) {
    throw new Error(
      locale === 'ko'
        ? 'GetYourGuide 임시 이메일(@reply.getyourguide.com)로는 금액 청구를 보낼 수 없습니다. 고객의 실제 이메일을 입력해 주세요.'
        : 'GetYourGuide relay addresses (@reply.getyourguide.com) cannot receive payment requests. Enter the guest\'s real email.'
    )
  }

  const { data: reservation } = await admin
    .from('reservations')
    .select('id, customer_id')
    .eq('id', reservationId)
    .maybeSingle()

  if (!reservation?.customer_id) return null

  const { data: reservationCustomer } = await admin
    .from('customers')
    .select('id, name, email, special_requests')
    .eq('id', reservation.customer_id)
    .maybeSingle()

  if (!reservationCustomer?.id) return null

  const storedEmail = (reservationCustomer.email || '').trim()
  if (!isGetYourGuideReplyEmail(storedEmail)) return null
  if (storedEmail.toLowerCase() === email) return null

  const nextSpecial = appendOtaTempEmailToSpecialRequests(
    reservationCustomer.special_requests,
    storedEmail
  )
  const customerUpdate: {
    email: string
    special_requests: string
    updated_at: string
    name?: string
  } = {
    email,
    special_requests: nextSpecial,
    updated_at: new Date().toISOString(),
  }
  if (recipientName && reservationCustomer.name !== recipientName) {
    customerUpdate.name = recipientName
  }

  const { error: emailUpdateError } = await admin
    .from('customers')
    .update(customerUpdate as never)
    .eq('id', reservationCustomer.id)
  if (emailUpdateError) {
    throw new Error(emailUpdateError.message || 'Failed to update customer email')
  }

  return {
    customerId: reservationCustomer.id,
    email,
    previousEmail: storedEmail,
    specialRequests: nextSpecial,
  }
}

type InvoiceItemRow = {
  productName?: string | null
  description?: string | null
  choiceInfo?: string | null
  date?: string | null
  quantity?: number | null
  unitPrice?: number | null
  total?: number | null
  reservationId?: string | null
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
  const found = existing.data[0]
  if (found?.id) {
    if (!found.email || found.email.trim().toLowerCase() !== email) {
      await stripe.customers.update(found.id, {
        email,
        ...(params.name ? { name: params.name } : {}),
      })
    }
    return found.id
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
    customerEmail = parseRecipientEmail(customer?.email || '')
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

  let stripeCustomerId: string
  try {
    stripeCustomerId = await findOrCreateStripeCustomer(stripe, {
      email: customerEmail,
      name: customerName,
      customerId: invoice.customer_id,
    })
  } catch (err) {
    throw new Error(stripeErrorMessage(err, locale))
  }

  const items = (Array.isArray(invoice.items) ? invoice.items : []) as InvoiceItemRow[]
  const reservationIdFromItems = items
    .map((it) => (typeof it.reservationId === 'string' ? it.reservationId.trim() : ''))
    .find((id) => Boolean(id))

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

  let draftId: string | null = null
  try {
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
        ...(reservationIdFromItems
          ? { reservation_id: reservationIdFromItems }
          : {}),
      },
      pending_invoice_items_behavior: 'exclude',
      auto_advance: false,
    })
    draftId = draft.id

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
  } catch (err) {
    if (draftId) {
      try {
        await stripe.invoices.del(draftId)
      } catch {
        try {
          await stripe.invoices.voidInvoice(draftId)
        } catch {
          // ignore cleanup failure
        }
      }
    }
    if (
      err instanceof Error &&
      /Stripe 결제|Stripe could not|Failed to create Stripe|Failed to save Stripe|결제 URL|hosted invoice URL/i.test(
        err.message
      )
    ) {
      throw err
    }
    throw new Error(stripeErrorMessage(err, locale))
  }
}

export async function markInvoicePaidFromStripeWebhook(
  admin: AdminClient,
  stripeInvoice: Stripe.Invoice
): Promise<{
  ok: boolean
  invoiceId?: string
  alreadyPaid?: boolean
  paymentApplied?: boolean
  reservationId?: string | null
  paymentSkippedReason?: string | null
}> {
  const purpose = stripeInvoice.metadata?.purpose
  const invoiceId = stripeInvoice.metadata?.invoice_id
  if (purpose !== STAFF_PAYABLE_INVOICE_PURPOSE || !invoiceId) {
    return { ok: false }
  }

  const { data: existing } = await admin
    .from('invoices')
    .select('id, status, notes, total, items, customer_id, stripe_invoice_id')
    .eq('id', invoiceId)
    .maybeSingle()

  let targetId = existing?.id
  let alreadyPaid = existing?.status === 'paid'
  let invoiceRow = existing

  if (!existing) {
    const { data: byStripe } = await admin
      .from('invoices')
      .select('id, status, notes, total, items, customer_id, stripe_invoice_id')
      .eq('stripe_invoice_id', stripeInvoice.id)
      .maybeSingle()
    if (!byStripe) return { ok: false }
    targetId = byStripe.id
    alreadyPaid = byStripe.status === 'paid'
    invoiceRow = byStripe
  }

  if (!targetId || !invoiceRow) return { ok: false }

  if (!alreadyPaid) {
    await admin
      .from('invoices')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        stripe_invoice_id: stripeInvoice.id,
        stripe_invoice_status: 'paid',
        hosted_invoice_url: stripeInvoice.hosted_invoice_url || undefined,
      } as never)
      .eq('id', targetId)
  }

  const apply = await applyPaidStaffInvoiceToReservation(admin, {
    invoiceId: targetId,
    notes: invoiceRow.notes,
    total: Number(invoiceRow.total) || 0,
    items: invoiceRow.items,
    customerId: invoiceRow.customer_id,
    stripeInvoice,
  })

  return {
    ok: true,
    invoiceId: targetId,
    alreadyPaid,
    paymentApplied: apply.applied,
    reservationId: apply.reservationId,
    paymentSkippedReason: apply.skippedReason,
  }
}

function paymentStatusForQuickDescription(_description: string): string {
  return 'Balance Received'
}

async function resolveStripePaymentMethodValue(admin: AdminClient): Promise<string> {
  const { data: byId } = await admin
    .from('payment_methods')
    .select('id')
    .eq('id', 'stripe')
    .maybeSingle()
  if (byId?.id) return byId.id

  const { data: byMethod } = await admin
    .from('payment_methods')
    .select('id')
    .ilike('method', 'stripe')
    .limit(1)
    .maybeSingle()
  if (byMethod?.id) return byMethod.id

  return 'stripe'
}

function reservationIdFromInvoiceItems(items: unknown): string | null {
  if (!Array.isArray(items)) return null
  for (const raw of items) {
    const id = (raw as InvoiceItemRow)?.reservationId
    if (typeof id === 'string' && id.trim()) return id.trim()
  }
  return null
}

function descriptionFromInvoiceItemsQuick(items: unknown): string {
  if (!Array.isArray(items) || items.length === 0) return ''
  const first = items[0] as InvoiceItemRow
  return (first.description || first.productName || '').trim()
}

function stripeInvoicePaidAmountUsd(stripeInvoice: Stripe.Invoice, fallbackTotal: number): number {
  const paid =
    typeof stripeInvoice.amount_paid === 'number'
      ? stripeInvoice.amount_paid
      : typeof (stripeInvoice as { amount_due?: number }).amount_due === 'number'
        ? (stripeInvoice as { amount_due: number }).amount_due
        : null
  if (paid != null && Number.isFinite(paid)) return roundMoney(paid / 100)
  return roundMoney(fallbackTotal)
}

async function resolveReservationForQuickPayment(
  admin: AdminClient,
  params: {
    reservationIdHint: string | null
    customerId: string | null
    email: string | null
    amountUsd: number
  }
): Promise<{ reservationId: string | null; reason: string | null }> {
  const hint = (params.reservationIdHint || '').trim()
  if (hint) {
    const { data } = await admin.from('reservations').select('id, status').eq('id', hint).maybeSingle()
    if (data?.id) return { reservationId: data.id, reason: null }
  }

  const customerIds = new Set<string>()
  if (params.customerId) customerIds.add(params.customerId)

  const email = (params.email || '').trim().toLowerCase()
  if (email) {
    const { data: customers } = await admin
      .from('customers')
      .select('id')
      .ilike('email', email)
      .eq('archive', false)
      .limit(20)
    for (const c of customers || []) {
      if (c.id) customerIds.add(c.id)
    }
  }

  if (customerIds.size === 0) {
    return { reservationId: null, reason: 'no_customer_match' }
  }

  const ids = [...customerIds]
  const { data: reservations } = await admin
    .from('reservations')
    .select('id, status, tour_date, customer_id')
    .in('customer_id', ids)
    .order('tour_date', { ascending: false })
    .limit(40)

  const open = (reservations || []).filter((r) => !isReservationCancelledStatus(r.status))
  if (open.length === 0) {
    return { reservationId: null, reason: 'no_open_reservation' }
  }

  const openIds = open.map((r) => r.id)
  const { data: pricingRows } = await admin
    .from('reservation_pricing')
    .select('reservation_id, balance_amount')
    .in('reservation_id', openIds)

  const balanceById = new Map<string, number>()
  for (const row of pricingRows || []) {
    balanceById.set(row.reservation_id, roundMoney(Number(row.balance_amount) || 0))
  }

  const withBalance = open
    .map((r) => ({
      id: r.id,
      tourDate: r.tour_date || '',
      balance: balanceById.get(r.id) ?? 0,
    }))
    .filter((r) => r.balance > 0.009)

  if (withBalance.length === 1) {
    return { reservationId: withBalance[0]!.id, reason: null }
  }

  if (withBalance.length > 1) {
    const amountMatches = withBalance.filter(
      (r) => Math.abs(r.balance - params.amountUsd) < 0.02
    )
    if (amountMatches.length === 1) {
      return { reservationId: amountMatches[0]!.id, reason: null }
    }
    // soonest upcoming / latest tour with balance
    const sorted = [...withBalance].sort((a, b) => {
      const today = lasVegasDateString()
      const aFuture = a.tourDate >= today ? 0 : 1
      const bFuture = b.tourDate >= today ? 0 : 1
      if (aFuture !== bFuture) return aFuture - bFuture
      return b.tourDate.localeCompare(a.tourDate)
    })
    return { reservationId: sorted[0]!.id, reason: null }
  }

  // no positive balance — attach to most recent open reservation so payment is still recorded
  return { reservationId: open[0]!.id, reason: null }
}

/**
 * 빠른 금액 청구(및 스태프 payable) 결제 완료 시 payment_records + 잔금 sync.
 * idempotent: 동일 stripe invoice note가 있으면 skip.
 */
export async function applyPaidStaffInvoiceToReservation(
  admin: AdminClient,
  params: {
    invoiceId: string
    notes: string | null
    total: number
    items: unknown
    customerId: string | null
    stripeInvoice: Stripe.Invoice
  }
): Promise<{
  applied: boolean
  reservationId: string | null
  skippedReason: string | null
}> {
  // 빠른 금액 청구만 자동 입금 반영 (정식 인보이스는 수동 입금 유지)
  if (!isQuickPaymentInvoiceNotes(params.notes)) {
    return { applied: false, reservationId: null, skippedReason: 'not_quick_payment' }
  }

  const stripeInvoiceId = params.stripeInvoice.id
  const noteMarker = `${STRIPE_INVOICE_NOTE_PREFIX}${stripeInvoiceId}`

  const { data: existingPay } = await admin
    .from('payment_records')
    .select('id, reservation_id')
    .ilike('note', `%${noteMarker}%`)
    .limit(1)
    .maybeSingle()

  if (existingPay?.id) {
    return {
      applied: false,
      reservationId: existingPay.reservation_id,
      skippedReason: 'already_applied',
    }
  }

  const amountUsd = stripeInvoicePaidAmountUsd(params.stripeInvoice, params.total)
  if (amountUsd <= 0) {
    return { applied: false, reservationId: null, skippedReason: 'zero_amount' }
  }

  let email: string | null = null
  if (params.customerId) {
    const { data: customer } = await admin
      .from('customers')
      .select('email')
      .eq('id', params.customerId)
      .maybeSingle()
    email = (customer?.email || '').trim().toLowerCase() || null
  }
  if (!email && params.stripeInvoice.customer_email) {
    email = params.stripeInvoice.customer_email.trim().toLowerCase()
  }

  const metaRid = (params.stripeInvoice.metadata?.reservation_id || '').trim() || null
  const itemRid = reservationIdFromInvoiceItems(params.items)
  const description = descriptionFromInvoiceItemsQuick(params.items) || 'Quick payment'

  const resolved = await resolveReservationForQuickPayment(admin, {
    reservationIdHint: metaRid || itemRid,
    customerId: params.customerId,
    email,
    amountUsd,
  })

  if (!resolved.reservationId) {
    console.warn('[payableInvoice] quick payment paid but no reservation matched', {
      invoiceId: params.invoiceId,
      email,
      reason: resolved.reason,
    })
    return {
      applied: false,
      reservationId: null,
      skippedReason: resolved.reason || 'reservation_not_found',
    }
  }

  const paymentStatus = paymentStatusForQuickDescription(description)
  const paymentMethod = await resolveStripePaymentMethodValue(admin)
  const operatorId = await lookupReservationOperatorId(admin, resolved.reservationId)
  const paymentId = `payment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  const note = [
    description,
    noteMarker,
    `invoice_id:${params.invoiceId}`,
    email ? `email:${email}` : '',
  ]
    .filter(Boolean)
    .join(' | ')

  const { error: insertError } = await admin.from('payment_records').insert({
    id: paymentId,
    operator_id: operatorId,
    reservation_id: resolved.reservationId,
    payment_status: paymentStatus,
    amount: amountUsd,
    payment_method: paymentMethod,
    note,
    submit_by: 'stripe_webhook',
    submit_on: new Date().toISOString(),
  } as never)

  if (insertError) {
    console.error('[payableInvoice] payment_records insert failed', insertError)
    return {
      applied: false,
      reservationId: resolved.reservationId,
      skippedReason: 'payment_insert_failed',
    }
  }

  try {
    await syncReservationPricingAggregates(admin, resolved.reservationId)
  } catch (err) {
    console.error('[payableInvoice] syncReservationPricingAggregates failed', err)
  }

  return { applied: true, reservationId: resolved.reservationId, skippedReason: null }
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
  const random = Math.floor(Math.random() * 900000) + 100000
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
    reservationId?: string | null
  }
): Promise<{
  invoiceId: string
  invoiceNumber: string
  customerId: string
  customerCreated: boolean
  customerEmailUpdated: boolean
  previousEmail: string | null
  specialRequests: string | null
  stripeInvoiceId: string
  hostedInvoiceUrl: string
  paymentToken: string
  sitePayUrl: string
  amountUsd: number
  description: string
  email: string
  recipientName: string
  reservationId: string | null
}> {
  const locale = params.locale === 'ko' ? 'ko' : 'en'
  const email = parseRecipientEmail(params.email)
  const description = params.description.trim().slice(0, 450)
  const amountUsd = roundMoney(Number(params.amountUsd))
  const recipientName = (params.recipientName || '').trim() || email.split('@')[0] || 'Guest'

  if (!email) {
    throw new Error(locale === 'ko' ? '유효한 이메일이 필요합니다.' : 'A valid email is required.')
  }
  if (isGetYourGuideReplyEmail(email)) {
    throw new Error(
      locale === 'ko'
        ? 'GetYourGuide 임시 이메일(@reply.getyourguide.com)로는 금액 청구를 보낼 수 없습니다. 고객의 실제 이메일을 입력해 주세요.'
        : 'GetYourGuide relay addresses (@reply.getyourguide.com) cannot receive payment requests. Enter the guest\'s real email.'
    )
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
  const reservationId = (params.reservationId || '').trim() || null

  let customerId: string | null = null
  let customerCreated = false
  let customerEmailUpdated = false
  let previousEmail: string | null = null
  let specialRequests: string | null = null

  if (reservationId) {
    const replaced = await replaceGetYourGuideRelayCustomerEmail(admin, {
      reservationId,
      newEmail: email,
      recipientName,
      locale,
    })
    if (replaced) {
      customerId = replaced.customerId
      customerEmailUpdated = true
      previousEmail = replaced.previousEmail
      specialRequests = replaced.specialRequests
    } else {
      const { data: reservation } = await admin
        .from('reservations')
        .select('id, customer_id')
        .eq('id', reservationId)
        .maybeSingle()

      if (reservation?.customer_id) {
        const { data: reservationCustomer } = await admin
          .from('customers')
          .select('id, name, email, special_requests')
          .eq('id', reservation.customer_id)
          .maybeSingle()

        if (reservationCustomer?.id) {
          const storedEmailNorm = (reservationCustomer.email || '').trim().toLowerCase()
          if (storedEmailNorm === email) {
            customerId = reservationCustomer.id
            specialRequests = reservationCustomer.special_requests || null
            if (recipientName && reservationCustomer.name !== recipientName) {
              await admin
                .from('customers')
                .update({ name: recipientName, updated_at: new Date().toISOString() } as never)
                .eq('id', customerId)
            }
          }
        }
      }
    }
  }

  if (!customerId) {
    const { data: existingCustomer } = await admin
      .from('customers')
      .select('id, name, email')
      .eq('operator_id', operatorId)
      .ilike('email', email)
      .eq('archive', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingCustomer?.id) {
      customerId = existingCustomer.id
      if (recipientName && existingCustomer.name !== recipientName) {
        await admin
          .from('customers')
          .update({ name: recipientName, updated_at: new Date().toISOString() } as never)
          .eq('id', customerId)
      }
    } else {
      const { data: archivedOrOther } = await admin
        .from('customers')
        .select('id, name, email')
        .ilike('email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (archivedOrOther?.id) {
        customerId = archivedOrOther.id
        if (recipientName && archivedOrOther.name !== recipientName) {
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
          const { data: raced } = await admin
            .from('customers')
            .select('id, name, email')
            .ilike('email', email)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (raced?.id) {
            customerId = raced.id
          } else {
            throw new Error(customerError.message || 'Failed to create customer')
          }
        } else {
          customerCreated = true
        }
      }
    }
  }

  if (!customerId) {
    throw new Error(locale === 'ko' ? '고객을 찾을 수 없습니다.' : 'Customer could not be resolved.')
  }

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
      ...(reservationId ? { reservationId } : {}),
    },
  ]

  let invoice: { id: string } | null = null
  let invoiceError: { code?: string; message?: string } | null = null
  for (let attempt = 0; attempt < 5; attempt++) {
    const invoiceNumber = buildQuickInvoiceNumber()
    const inserted = await admin
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
    invoice = inserted.data
    invoiceError = inserted.error
    if (invoice?.id) break
    if (!isUniqueViolation(invoiceError)) break
  }

  if (invoiceError || !invoice) {
    throw new Error(invoiceError?.message || 'Failed to create invoice')
  }

  const pay = await createOrRefreshStripePayableInvoice(admin, invoice.id, { locale })

  return {
    invoiceId: pay.invoiceId,
    invoiceNumber: pay.invoiceNumber,
    customerId,
    customerCreated,
    customerEmailUpdated,
    previousEmail,
    specialRequests,
    stripeInvoiceId: pay.stripeInvoiceId,
    hostedInvoiceUrl: pay.hostedInvoiceUrl,
    paymentToken: pay.paymentToken,
    sitePayUrl: pay.sitePayUrl,
    amountUsd,
    description,
    email,
    recipientName,
    reservationId,
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
  reservationId: string | null
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
      reservationId: reservationIdFromInvoiceItems(row.items),
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
