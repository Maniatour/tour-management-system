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
import { notifyFieldChargePaid } from '@/lib/fieldChargePaidNotify'
import { parseRecipientEmail } from '@/lib/quickPaymentRequestMessage'
import { isSiteLocale, type SiteLocale } from '@/lib/siteLocales'
import {
  actualAmountFromChargedTotal,
  cardFeeFromChargedTotal,
} from '@/lib/choiceProcessingFee'
import {
  fieldCheckoutSettlesInvoice,
  isFieldChargeInvoiceItems,
  resolveFieldCheckout,
  type FieldPayMode,
} from '@/lib/fieldChargePayChoice'
import { loadFieldChargeBalanceUsd } from '@/lib/loadFieldChargeBalance'

export const STAFF_PAYABLE_INVOICE_PURPOSE = 'staff_payable_invoice'
export const STAFF_PAYABLE_CHECKOUT_PURPOSE = 'staff_payable_invoice_checkout'

/** invoices.notes 마커 — 빠른 금액 청구 내역 조회용 */
export const QUICK_PAYMENT_INVOICE_NOTES = 'quick_payment_request'
export const TIP_OPEN_AMOUNT_ITEM_TYPE = 'tip_open_amount'
const QUICK_PAYMENT_NOTES_LEGACY = ['빠른 금액 청구', 'Quick payment request'] as const
const STRIPE_INVOICE_NOTE_PREFIX = 'stripe_invoice_id:'
const STRIPE_CHECKOUT_NOTE_PREFIX = 'stripe_checkout_session_id:'
const STRIPE_TIP_NOTE_SUFFIX = ':tip'

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
  itemType?: string | null
  openAmount?: boolean | null
  fieldCharge?: boolean | null
  baseAmountUsd?: number | null
  cardFeeUsd?: number | null
}

export function isTipOpenAmountInvoiceItems(items: unknown): boolean {
  if (!Array.isArray(items)) return false
  return items.some((raw) => {
    const item = raw as InvoiceItemRow
    if (item?.openAmount === true) return true
    return (item?.itemType || '').trim() === TIP_OPEN_AMOUNT_ITEM_TYPE
  })
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
  const loc = locale === 'ko' ? 'ko' : 'en'
  return `${siteOrigin()}/${loc}/pay/invoice/${paymentToken}`
}

export function invoicePayPathLocale(locale: string | null | undefined): SiteLocale {
  return isSiteLocale(locale) ? locale : 'en'
}

export function stripeCheckoutLocale(
  locale: string | null | undefined
): Stripe.Checkout.SessionCreateParams.Locale {
  switch (invoicePayPathLocale(locale)) {
    case 'ko':
      return 'ko'
    case 'ja':
      return 'ja'
    case 'zh-CN':
      return 'zh'
    case 'zh-TW':
      return 'zh-TW'
    case 'es':
      return 'es'
    case 'fr':
      return 'fr'
    case 'de':
      return 'de'
    default:
      return 'en'
  }
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

/** 잔금이 바뀐 현장 QR의 예전 Stripe 청구서를 닫아, 이미 낸 잔금이 다시 청구되지 않게 합니다. */
export async function retireOpenFieldStripeInvoice(
  admin: AdminClient,
  invoice: { id: string; stripe_invoice_id?: string | null }
): Promise<void> {
  const stripeId = String(invoice.stripe_invoice_id || '').trim()
  if (stripeId) {
    const stripe = getStripeClient()
    try {
      const existing = await stripe.invoices.retrieve(stripeId)
      if (existing.status === 'paid') return
    } catch (err) {
      console.warn('[payableInvoice] field invoice retrieve before retire', stripeId, err)
    }
    await voidOpenStripeInvoice(stripe, stripeId)
  }
  await admin
    .from('invoices')
    .update({
      hosted_invoice_url: null,
      stripe_invoice_status: 'void',
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', invoice.id)
}

function fieldOnsiteStripeEmail(reservationId: string): string {
  const compact = reservationId.replace(/-/g, '').slice(0, 24)
  return `onsite.${compact}@noreply.maniatour.com`
}

/**
 * DB invoices 행으로부터 Stripe Hosted Invoice를 생성(또는 갱신)하고 URL을 저장합니다.
 */
export async function createOrRefreshStripePayableInvoice(
  admin: AdminClient,
  invoiceId: string,
  options?: { locale?: string; forceNew?: boolean; stripeEmailOverride?: string }
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

  let customerEmail = parseRecipientEmail(options?.stripeEmailOverride || '')
  let customerName = ''
  if (invoice.customer_id) {
    const { data: customer } = await admin
      .from('customers')
      .select('id, name, email')
      .eq('id', invoice.customer_id)
      .maybeSingle()
    customerName = (customer?.name || '').trim()
    if (!customerEmail) {
      customerEmail = parseRecipientEmail(customer?.email || '')
    }
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
    .select('id, status, notes, total, items, customer_id, stripe_invoice_id, created_by')
    .eq('id', invoiceId)
    .maybeSingle()

  let targetId = existing?.id
  let alreadyPaid = existing?.status === 'paid'
  let invoiceRow = existing

  if (!existing) {
    const { data: byStripe } = await admin
      .from('invoices')
      .select('id, status, notes, total, items, customer_id, stripe_invoice_id, created_by')
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

  if (!alreadyPaid) {
    const paidUsd = stripeInvoicePaidAmountUsd(stripeInvoice, Number(invoiceRow.total) || 0)
    const tipOnly = isTipOpenAmountInvoiceItems(invoiceRow.items)
    await notifyFieldChargePaid(admin, {
      invoiceId: targetId,
      createdBy: (invoiceRow as { created_by?: string | null }).created_by ?? null,
      customerId: invoiceRow.customer_id,
      reservationId: apply.reservationId,
      amountUsd: paidUsd,
      chargeUsd: tipOnly ? 0 : paidUsd,
      tipUsd: tipOnly ? paidUsd : 0,
      items: invoiceRow.items,
      notes: invoiceRow.notes,
    })
  }

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

export function reservationIdFromInvoiceItems(items: unknown): string | null {
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

function cardFeeUsdFromInvoiceItems(items: unknown): number {
  if (!Array.isArray(items) || isTipOpenAmountInvoiceItems(items)) return 0
  let sum = 0
  for (const raw of items) {
    const fee = Number((raw as InvoiceItemRow)?.cardFeeUsd)
    if (Number.isFinite(fee) && fee > 0) sum += fee
  }
  return roundMoney(sum)
}

async function addCardFeeToReservationPricing(
  admin: AdminClient,
  reservationId: string,
  cardFeeUsd: number
): Promise<void> {
  const extra = roundMoney(cardFeeUsd)
  if (extra <= 0) return
  const { data: pricing, error } = await admin
    .from('reservation_pricing')
    .select('id, card_fee')
    .eq('reservation_id', reservationId)
    .maybeSingle()
  if (error) {
    console.error('[payableInvoice] card_fee lookup failed', error)
    return
  }
  if (!pricing?.id) return
  const next = roundMoney((Number(pricing.card_fee) || 0) + extra)
  const { error: updateError } = await admin
    .from('reservation_pricing')
    .update({ card_fee: next, updated_at: new Date().toISOString() } as never)
    .eq('id', pricing.id)
  if (updateError) {
    console.error('[payableInvoice] card_fee update failed', updateError)
  }
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
    stripeInvoice?: Stripe.Invoice | null
    amountUsdOverride?: number
    paymentNoteMarker?: string
    customerEmail?: string | null
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

  const stripeInvoiceId = params.stripeInvoice?.id
  const noteMarker =
    params.paymentNoteMarker ||
    (stripeInvoiceId ? `${STRIPE_INVOICE_NOTE_PREFIX}${stripeInvoiceId}` : '')
  if (!noteMarker) {
    return { applied: false, reservationId: null, skippedReason: 'missing_payment_ref' }
  }

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

  const amountUsd =
    params.amountUsdOverride != null
      ? roundMoney(params.amountUsdOverride)
      : params.stripeInvoice
        ? stripeInvoicePaidAmountUsd(params.stripeInvoice, params.total)
        : roundMoney(params.total)
  if (amountUsd <= 0) {
    return { applied: false, reservationId: null, skippedReason: 'zero_amount' }
  }

  let email: string | null = params.customerEmail?.trim().toLowerCase() || null
  if (params.customerId) {
    const { data: customer } = await admin
      .from('customers')
      .select('email')
      .eq('id', params.customerId)
      .maybeSingle()
    email = (customer?.email || '').trim().toLowerCase() || email
  }
  if (!email && params.stripeInvoice?.customer_email) {
    email = params.stripeInvoice.customer_email.trim().toLowerCase()
  }

  const metaRid = (params.stripeInvoice?.metadata?.reservation_id || '').trim() || null
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
  const cardFeeUsd = cardFeeUsdFromInvoiceItems(params.items)
  const note = [
    description,
    cardFeeUsd > 0 ? `card_fee:${cardFeeUsd.toFixed(2)}` : '',
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
    if (cardFeeUsd > 0) {
      await addCardFeeToReservationPricing(admin, resolved.reservationId, cardFeeUsd)
    }
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
  openAmount?: boolean
}): string {
  const { locale, recipientName, description, invoiceNumber, payUrl } = params
  const openAmount = Boolean(params.openAmount)
  const greeting =
    locale === 'ko'
      ? `${escapeHtml(recipientName || '고객')}님,`
      : `Hello ${escapeHtml(recipientName || 'there')},`
  const intro = openAmount
    ? locale === 'ko'
      ? '가이드 팁을 남겨 주시면 감사하겠습니다. 아래 링크에서 원하시는 금액을 직접 입력하고 카드로 결제해 주세요.'
      : 'Thank you for considering a guide tip. Please open the link below, enter the amount you would like to leave, and pay securely by card.'
    : locale === 'ko'
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
  const amountCell = openAmount
    ? locale === 'ko'
      ? '손님이 금액 입력'
      : 'You choose the amount'
    : `$${params.amountUsd.toFixed(2)}`

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
        <td style="padding:12px 0;text-align:right;font-size:22px;font-weight:700;">${amountCell}</td>
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
    openAmount?: boolean
    /** 가이드 현장 청구: 예약 고객에 고정 연결하고 OTA 이메일을 덮어쓰지 않습니다. */
    preserveReservationCustomer?: boolean
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
  openAmount: boolean
}> {
  const locale = params.locale === 'ko' ? 'ko' : 'en'
  const reservationId = (params.reservationId || '').trim() || null
  const preserveReservationCustomer = Boolean(params.preserveReservationCustomer && reservationId)
  const email = parseRecipientEmail(params.email)
  const description = params.description.trim().slice(0, 450)
  const openAmount = Boolean(params.openAmount)
  const amountUsd = openAmount ? 0 : roundMoney(Number(params.amountUsd))
  let recipientName = (params.recipientName || '').trim() || email.split('@')[0] || 'Guest'
  let stripeEmailOverride: string | undefined
  let resultEmail = email

  if (!preserveReservationCustomer) {
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
  }
  if (!description) {
    throw new Error(locale === 'ko' ? '청구 내용을 입력해 주세요.' : 'Description is required.')
  }
  if (!openAmount) {
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      throw new Error(locale === 'ko' ? '결제 금액이 0보다 커야 합니다.' : 'Amount must be greater than zero.')
    }
    if (amountUsd > 100_000) {
      throw new Error(locale === 'ko' ? '금액이 너무 큽니다.' : 'Amount is too large.')
    }
  }

  const operatorId = resolveOperatorId(params.operatorId)

  let customerId: string | null = null
  let customerCreated = false
  let customerEmailUpdated = false
  let previousEmail: string | null = null
  let specialRequests: string | null = null

  if (preserveReservationCustomer && reservationId) {
    const { data: reservation } = await admin
      .from('reservations')
      .select('id, customer_id')
      .eq('id', reservationId)
      .maybeSingle()

    if (!reservation?.customer_id) {
      throw new Error(
        locale === 'ko'
          ? '예약에 연결된 고객을 찾을 수 없습니다.'
          : 'This reservation has no linked customer.'
      )
    }

    const { data: reservationCustomer } = await admin
      .from('customers')
      .select('id, name, email, special_requests')
      .eq('id', reservation.customer_id)
      .maybeSingle()

    if (!reservationCustomer?.id) {
      throw new Error(
        locale === 'ko'
          ? '예약에 연결된 고객을 찾을 수 없습니다.'
          : 'This reservation has no linked customer.'
      )
    }

    customerId = reservationCustomer.id
    specialRequests = reservationCustomer.special_requests || null
    if (!params.recipientName?.trim()) {
      recipientName = (reservationCustomer.name || '').trim() || 'Guest'
    }
    const storedEmail = parseRecipientEmail(reservationCustomer.email)
    resultEmail = storedEmail || fieldOnsiteStripeEmail(reservationId)
    if (!storedEmail || isGetYourGuideReplyEmail(storedEmail)) {
      stripeEmailOverride = fieldOnsiteStripeEmail(reservationId)
      resultEmail = stripeEmailOverride
    }
  } else if (reservationId) {
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
    if (!email) {
      throw new Error(locale === 'ko' ? '유효한 이메일이 필요합니다.' : 'A valid email is required.')
    }
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
  const baseAmountUsd = openAmount ? 0 : actualAmountFromChargedTotal(amountUsd)
  const cardFeeUsd = openAmount ? 0 : cardFeeFromChargedTotal(amountUsd)

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
      itemType: openAmount ? TIP_OPEN_AMOUNT_ITEM_TYPE : 'product',
      ...(openAmount ? { openAmount: true } : { baseAmountUsd, cardFeeUsd }),
      ...(reservationId ? { reservationId } : {}),
      ...(preserveReservationCustomer ? { fieldCharge: true } : {}),
    },
  ]

  let invoice: { id: string; invoice_number?: string; payment_token?: string | null } | null = null
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
      .select('id, invoice_number, payment_token')
      .single()
    invoice = inserted.data
    invoiceError = inserted.error
    if (invoice?.id) break
    if (!isUniqueViolation(invoiceError)) break
  }

  if (invoiceError || !invoice) {
    throw new Error(invoiceError?.message || 'Failed to create invoice')
  }

  if (openAmount) {
    const paymentToken = invoice.payment_token || randomUUID()
    if (!invoice.payment_token) {
      await admin.from('invoices').update({ payment_token: paymentToken } as never).eq('id', invoice.id)
    }
    return {
      invoiceId: invoice.id,
      invoiceNumber: String(invoice.invoice_number || ''),
      customerId,
      customerCreated,
      customerEmailUpdated,
      previousEmail,
      specialRequests,
      stripeInvoiceId: '',
      hostedInvoiceUrl: '',
      paymentToken,
      sitePayUrl: buildInvoiceSitePayUrl(paymentToken, 'en'),
      amountUsd,
      description,
      email: resultEmail,
      recipientName,
      reservationId,
      openAmount: true,
    }
  }

  const pay = await createOrRefreshStripePayableInvoice(admin, invoice.id, {
    locale,
    ...(stripeEmailOverride ? { stripeEmailOverride } : {}),
  })

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
    email: resultEmail,
    recipientName,
    reservationId,
    openAmount: false,
  }
}

export type QuickPaymentHistoryFilter = 'all' | 'unpaid' | 'paid' | 'tip'

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
  /** team.nick_name. 없으면 이름, 그것도 없으면 null */
  createdByNick: string | null
  phone: string | null
  channelRn: string | null
  sitePayUrl: string | null
  hostedInvoiceUrl: string | null
  stripeInvoiceStatus: string | null
  openAmount: boolean
  /** 고정 청구의 상품 금액. 팁 링크는 null */
  baseAmountUsd: number | null
  cardFeeUsd: number
  /** 인보이스·결제 기록에서 확인한 실제 결제액. 팁 링크는 손님이 입력한 금액 */
  paidAmountUsd: number | null
  /** 고정 청구에 손님이 더한 가이드 팁. 팁 링크 전체 금액은 paidAmountUsd */
  extraTipUsd: number | null
  paid: boolean
}

export type QuickPaymentHistoryPage = {
  items: QuickPaymentHistoryItem[]
  hasMore: boolean
  total: number | null
}

function descriptionFromInvoiceItems(items: unknown, locale: 'ko' | 'en'): string {
  if (!Array.isArray(items) || items.length === 0) {
    return locale === 'ko' ? '(내용 없음)' : '(No description)'
  }
  const first = items[0] as InvoiceItemRow
  const text = (first.description || first.productName || '').trim()
  return text || (locale === 'ko' ? '(내용 없음)' : '(No description)')
}

const QUICK_PAYMENT_HISTORY_SELECT =
  'id, invoice_number, status, total, items, created_at, sent_at, paid_at, created_by, payment_token, hosted_invoice_url, stripe_invoice_status, customer_id, customers(id, name, email, phone)'

function quickPaymentItemAmounts(items: unknown): {
  baseAmountUsd: number | null
  cardFeeUsd: number
  itemAmountUsd: number
} {
  if (!Array.isArray(items) || items.length === 0) {
    return { baseAmountUsd: null, cardFeeUsd: 0, itemAmountUsd: 0 }
  }
  const first = items[0] as InvoiceItemRow
  const cardFeeRaw = Number(first.cardFeeUsd)
  const cardFeeUsd = Number.isFinite(cardFeeRaw) && cardFeeRaw > 0 ? roundMoney(cardFeeRaw) : 0
  const baseRaw = Number(first.baseAmountUsd)
  const baseAmountUsd = Number.isFinite(baseRaw) && baseRaw > 0 ? roundMoney(baseRaw) : null
  const itemRaw = Number(first.total) || Number(first.unitPrice) || 0
  const itemAmountUsd = Number.isFinite(itemRaw) && itemRaw > 0 ? roundMoney(itemRaw) : 0
  return { baseAmountUsd, cardFeeUsd, itemAmountUsd }
}

function invoiceIdFromPaymentNote(note: string): string | null {
  const match = note.match(/invoice_id:([0-9a-f-]{36})/i)
  return match?.[1]?.toLowerCase() ?? null
}

function paymentNoteIsGuideTip(note: string): boolean {
  return note.includes(STRIPE_CHECKOUT_NOTE_PREFIX) && note.includes(STRIPE_TIP_NOTE_SUFFIX)
}

function staffNickFromTeam(row: {
  nick_name?: string | null
  name_ko?: string | null
  display_name?: string | null
}): string | null {
  const nick = row.nick_name?.trim()
  if (nick) return nick
  const nameKo = row.name_ko?.trim()
  if (nameKo) return nameKo
  const display = row.display_name?.trim()
  return display || null
}

async function teamNickByEmail(admin: AdminClient, emails: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))]
  const map = new Map<string, string>()
  if (unique.length === 0) return map

  const { data, error } = await admin.from('team').select('email, nick_name, name_ko, display_name')
  if (error) {
    console.error('[payableInvoice] team nick lookup failed', error)
    return map
  }

  const wanted = new Set(unique)
  for (const row of data || []) {
    const email = String(row.email || '').trim().toLowerCase()
    if (!email || !wanted.has(email)) continue
    const label = staffNickFromTeam(row)
    if (label) map.set(email, label)
  }
  return map
}

async function paymentSplitsByInvoiceId(
  admin: AdminClient,
  invoiceIds: string[]
): Promise<Map<string, { chargeUsd: number; tipUsd: number }>> {
  const splits = new Map<string, { chargeUsd: number; tipUsd: number }>()
  const ids = [...new Set(invoiceIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) return splits

  const chunkSize = 25
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += chunkSize) chunks.push(ids.slice(i, i + chunkSize))

  const concurrency = 4
  for (let i = 0; i < chunks.length; i += concurrency) {
    const group = chunks.slice(i, i + concurrency)
    const results = await Promise.all(
      group.map(async (chunk) => {
        const orFilter = chunk.map((id) => `note.ilike.%invoice_id:${id}%`).join(',')
        const { data, error } = await admin.from('payment_records').select('amount, note').or(orFilter)
        if (error) {
          console.error('[payableInvoice] quick payment history payments failed', error)
          return []
        }
        return data || []
      })
    )
    for (const rows of results) {
      for (const row of rows) {
        const note = String(row.note || '')
        const invoiceId = invoiceIdFromPaymentNote(note)
        if (!invoiceId) continue
        const amount = roundMoney(Number(row.amount) || 0)
        if (amount <= 0) continue
        const current = splits.get(invoiceId) || { chargeUsd: 0, tipUsd: 0 }
        if (paymentNoteIsGuideTip(note)) current.tipUsd = roundMoney(current.tipUsd + amount)
        else current.chargeUsd = roundMoney(current.chargeUsd + amount)
        splits.set(invoiceId, current)
      }
    }
  }
  return splits
}

function mapQuickPaymentHistoryRow(
  row: {
    id: string
    invoice_number?: string | null
    status?: string | null
    total?: number | null
    items?: unknown
    created_at?: string | null
    sent_at?: string | null
    paid_at?: string | null
    created_by?: string | null
    payment_token?: string | null
    hosted_invoice_url?: string | null
    stripe_invoice_status?: string | null
    customers?: unknown
  },
  locale: 'ko' | 'en',
  nicks: Map<string, string>,
  payments: Map<string, { chargeUsd: number; tipUsd: number }>
): QuickPaymentHistoryItem {
  const customerRaw = row.customers
  const customer = Array.isArray(customerRaw)
    ? (customerRaw[0] as { name?: string | null; email?: string | null; phone?: string | null } | undefined)
    : (customerRaw as { name?: string | null; email?: string | null; phone?: string | null } | null | undefined)
  const openAmount = isTipOpenAmountInvoiceItems(row.items)
  const amounts = quickPaymentItemAmounts(row.items)
  const invoiceTotal = roundMoney(Number(row.total) || 0)
  const status = String(row.status || 'draft')
  const stripeStatus = row.stripe_invoice_status ?? null
  const statusPaid = status.toLowerCase() === 'paid' || (stripeStatus || '').toLowerCase() === 'paid'
  const split = payments.get(String(row.id).toLowerCase()) || { chargeUsd: 0, tipUsd: 0 }

  let paidAmountUsd: number | null = null
  let extraTipUsd: number | null = null
  if (openAmount) {
    const fromPayments = split.tipUsd > 0 ? split.tipUsd : split.chargeUsd
    const fromInvoice = invoiceTotal > 0 ? invoiceTotal : amounts.itemAmountUsd
    paidAmountUsd = fromPayments > 0 ? fromPayments : fromInvoice > 0 ? fromInvoice : null
  } else {
    paidAmountUsd = split.chargeUsd > 0 ? split.chargeUsd : statusPaid ? invoiceTotal : null
    extraTipUsd = split.tipUsd > 0 ? split.tipUsd : null
  }

  const createdBy = row.created_by?.trim() || null
  const createdByNick = createdBy ? nicks.get(createdBy.toLowerCase()) || null : null
  const paymentToken = row.payment_token

  return {
    id: String(row.id),
    invoiceNumber: String(row.invoice_number || ''),
    status,
    total: invoiceTotal,
    description: descriptionFromInvoiceItems(row.items, locale),
    email: (customer?.email || '').trim(),
    recipientName: (customer?.name || '').trim(),
    reservationId: reservationIdFromInvoiceItems(row.items),
    createdAt: row.created_at ?? null,
    sentAt: row.sent_at ?? null,
    paidAt: row.paid_at ?? null,
    createdBy,
    createdByNick,
    phone: (customer?.phone || '').trim() || null,
    channelRn: null,
    sitePayUrl: paymentToken ? buildInvoiceSitePayUrl(paymentToken, locale) : null,
    hostedInvoiceUrl: row.hosted_invoice_url ?? null,
    stripeInvoiceStatus: stripeStatus,
    openAmount,
    baseAmountUsd: openAmount ? null : amounts.baseAmountUsd,
    cardFeeUsd: openAmount ? 0 : amounts.cardFeeUsd,
    paidAmountUsd,
    extraTipUsd,
    paid: statusPaid || (paidAmountUsd != null && paidAmountUsd > 0),
  }
}

function postgrestIlikeQuoted(term: string): string {
  const pattern = `%${term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')}%`
  return `"${pattern.replace(/"/g, '""')}"`
}

function sanitizeHistorySearch(raw: string | undefined): string {
  return (raw || '').replace(/[(),]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
}

function phoneSearchClauses(term: string): string[] {
  const like = postgrestIlikeQuoted(term)
  const clauses = [`phone.ilike.${like}`, `emergency_contact.ilike.${like}`]
  const digits = term.replace(/\D/g, '')
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  if (local.length >= 10) {
    const pattern = `%${local.slice(0, 3)}%${local.slice(3, 6)}%${local.slice(6, 10)}%`
    clauses.push(`phone.ilike."${pattern.replace(/"/g, '""')}"`)
  } else if (digits.length >= 7) {
    clauses.push(`phone.ilike.${postgrestIlikeQuoted(digits)}`)
  }
  return clauses
}

const QUICK_PAYMENT_SEARCH_NOTES = [QUICK_PAYMENT_INVOICE_NOTES, ...QUICK_PAYMENT_NOTES_LEGACY]

async function quickPaymentInvoiceIds(
  admin: AdminClient,
  // PostgREST 필터 체인이 select 이후에 갈라져 호출부에서만 조건을 붙입니다.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apply: (query: any) => any
): Promise<string[]> {
  const base = admin.from('invoices').select('id').in('notes', QUICK_PAYMENT_SEARCH_NOTES)
  const { data, error } = await apply(base).order('created_at', { ascending: false }).limit(40)
  if (error) {
    console.error('[payableInvoice] quick payment search invoices', error)
    return []
  }
  return (data || []).map((row: { id?: string }) => String(row.id || '')).filter(Boolean)
}

async function invoiceIdsForReservationItems(admin: AdminClient, reservationIds: string[]): Promise<string[]> {
  const ids = reservationIds.slice(0, 15)
  const groups = await Promise.all(
    ids.map(async (reservationId) => {
      const { data, error } = await admin
        .from('invoices')
        .select('id')
        .in('notes', QUICK_PAYMENT_SEARCH_NOTES)
        .contains('items', [{ reservationId }])
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) {
        console.error('[payableInvoice] quick payment search by reservation', error)
        return [] as string[]
      }
      return (data || []).map((row) => String(row.id))
    })
  )
  return groups.flat()
}

async function searchQuickPaymentInvoiceIds(admin: AdminClient, term: string): Promise<string[]> {
  const like = postgrestIlikeQuoted(term)
  const escaped = term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
  const customerOr = [`name.ilike.${like}`, `email.ilike.${like}`, ...phoneSearchClauses(term)].join(',')
  const guestOr = [
    `name.ilike.${like}`,
    `name_en.ilike.${like}`,
    `name_ko.ilike.${like}`,
    `email.ilike.${like}`,
    ...phoneSearchClauses(term).filter((clause) => clause.startsWith('phone.ilike.')),
  ].join(',')

  const [customers, reservations, guests, team, channels] = await Promise.all([
    admin.from('customers').select('id').or(customerOr).limit(40),
    admin
      .from('reservations')
      .select('id, customer_id')
      .or(`channel_rn.ilike.${like},id.ilike.${like},pickup_hotel.ilike.${like}`)
      .limit(30),
    admin.from('reservation_customers').select('reservation_id, customer_id').or(guestOr).limit(30),
    admin
      .from('team')
      .select('email')
      .or(
        `nick_name.ilike.${like},name_ko.ilike.${like},name_en.ilike.${like},display_name.ilike.${like},email.ilike.${like}`
      )
      .limit(20),
    admin.from('channels').select('id').ilike('name', `%${escaped}%`).limit(8),
  ])

  if (customers.error) console.error('[payableInvoice] quick payment search customers', customers.error)
  if (reservations.error) console.error('[payableInvoice] quick payment search reservations', reservations.error)
  if (guests.error) console.error('[payableInvoice] quick payment search guests', guests.error)
  if (team.error) console.error('[payableInvoice] quick payment search team', team.error)
  if (channels.error) console.error('[payableInvoice] quick payment search channels', channels.error)

  const customerIds = new Set<string>()
  const reservationIds = new Set<string>()
  for (const row of customers.data || []) {
    if (row.id) customerIds.add(String(row.id))
  }
  for (const row of reservations.data || []) {
    if (row.id) reservationIds.add(String(row.id))
    if (row.customer_id) customerIds.add(String(row.customer_id))
  }
  for (const row of guests.data || []) {
    if (row.reservation_id) reservationIds.add(String(row.reservation_id))
    if (row.customer_id) customerIds.add(String(row.customer_id))
  }

  const channelIds = (channels.data || []).map((row) => String(row.id)).filter(Boolean)
  if (channelIds.length > 0) {
    const { data, error } = await admin
      .from('reservations')
      .select('id, customer_id')
      .in('channel_id', channelIds)
      .order('created_at', { ascending: false })
      .limit(30)
    if (error) console.error('[payableInvoice] quick payment search channel reservations', error)
    for (const row of data || []) {
      if (row.id) reservationIds.add(String(row.id))
      if (row.customer_id) customerIds.add(String(row.customer_id))
    }
  }

  const staffEmails = [...new Set((team.data || []).map((row) => String(row.email || '').trim()).filter(Boolean))].slice(
    0,
    20
  )
  const customerIdList = [...customerIds].slice(0, 40)
  const reservationIdList = [...reservationIds].slice(0, 15)

  const idGroups = await Promise.all([
    quickPaymentInvoiceIds(admin, (query) => query.ilike('invoice_number', `%${escaped}%`)),
    customerIdList.length > 0
      ? quickPaymentInvoiceIds(admin, (query) => query.in('customer_id', customerIdList))
      : Promise.resolve([]),
    staffEmails.length > 0
      ? quickPaymentInvoiceIds(admin, (query) =>
          query.or(staffEmails.map((email) => `created_by.ilike.${postgrestIlikeQuoted(email)}`).join(','))
        )
      : Promise.resolve([]),
    reservationIdList.length > 0
      ? invoiceIdsForReservationItems(admin, reservationIdList)
      : Promise.resolve([]),
  ])

  return [...new Set(idGroups.flat())].slice(0, 80)
}

async function channelRnByReservationId(admin: AdminClient, reservationIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const ids = [...new Set(reservationIds.map((id) => id.trim()).filter(Boolean))].slice(0, 80)
  if (ids.length === 0) return map
  const { data, error } = await admin.from('reservations').select('id, channel_rn').in('id', ids)
  if (error) {
    console.error('[payableInvoice] quick payment channel rn lookup', error)
    return map
  }
  for (const row of data || []) {
    const rn = String(row.channel_rn || '').trim()
    if (row.id && rn) map.set(String(row.id), rn)
  }
  return map
}

/**
 * 빠른 금액 청구로 만든 인보이스 목록.
 * 결제 기록의 청구액·가이드 팁과 담당 닉네임을 함께 붙입니다.
 */
export async function listQuickPaymentInvoices(
  admin: AdminClient,
  options?: {
    locale?: 'ko' | 'en'
    limit?: number
    offset?: number
    filter?: QuickPaymentHistoryFilter
    query?: string
  }
): Promise<QuickPaymentHistoryPage> {
  const locale = options?.locale === 'ko' ? 'ko' : 'en'
  const limit = Math.min(Math.max(options?.limit ?? 40, 1), 50)
  const offset = Math.max(options?.offset ?? 0, 0)
  const filter: QuickPaymentHistoryFilter =
    options?.filter === 'unpaid' || options?.filter === 'paid' || options?.filter === 'tip'
      ? options.filter
      : 'all'
  const search = sanitizeHistorySearch(options?.query)

  let query = admin
    .from('invoices')
    .select(QUICK_PAYMENT_HISTORY_SELECT, { count: 'exact' })
    .in('notes', [QUICK_PAYMENT_INVOICE_NOTES, ...QUICK_PAYMENT_NOTES_LEGACY])
    .order('created_at', { ascending: false })

  if (search.length >= 2) {
    const matchedIds = await searchQuickPaymentInvoiceIds(admin, search)
    if (matchedIds.length === 0) {
      return { items: [], hasMore: false, total: 0 }
    }
    query = query.in('id', matchedIds)
  }

  if (filter === 'paid') {
    query = query.or('status.eq.paid,stripe_invoice_status.eq.paid')
  } else if (filter === 'unpaid') {
    query = query.in('status', ['draft', 'sent'])
  }

  const searching = search.length >= 2
  const scan = filter === 'tip' && !searching ? 300 : limit
  const { data, error, count } =
    filter === 'tip'
      ? await query.limit(searching ? 80 : scan)
      : await query.range(offset, offset + limit - 1)

  if (error) {
    throw new Error(error.message || 'Failed to load quick payment history')
  }

  const rows = data || []
  const [nicks, payments] = await Promise.all([
    teamNickByEmail(
      admin,
      rows.map((row) => String(row.created_by || ''))
    ),
    paymentSplitsByInvoiceId(
      admin,
      rows.map((row) => String(row.id))
    ),
  ])

  const mappedRows = rows.map((row) => mapQuickPaymentHistoryRow(row, locale, nicks, payments))
  const rnByReservation = await channelRnByReservationId(
    admin,
    mappedRows.map((item) => item.reservationId || '')
  )
  const mapped = mappedRows.map((item) => ({
    ...item,
    channelRn: item.reservationId ? rnByReservation.get(item.reservationId) || null : null,
  }))
  if (filter === 'tip') {
    const tipped = mapped.filter((item) => item.openAmount || (item.extraTipUsd != null && item.extraTipUsd > 0))
    return {
      items: tipped.slice(offset, offset + limit),
      hasMore: tipped.length > offset + limit,
      total: tipped.length,
    }
  }

  const total = typeof count === 'number' ? count : null
  return {
    items: mapped,
    hasMore: total != null ? offset + mapped.length < total : mapped.length === limit,
    total,
  }
}

const MIN_TIP_CENTS = 50
const MAX_TIP_CENTS = 200_000
const MAX_OPEN_AMOUNT_CENTS = 1_000_000

function checkoutNoteMarker(sessionId: string): string {
  return `${STRIPE_CHECKOUT_NOTE_PREFIX}${sessionId}`
}

function tipNoteMarker(sessionId: string): string {
  return `${STRIPE_CHECKOUT_NOTE_PREFIX}${sessionId}${STRIPE_TIP_NOTE_SUFFIX}`
}

function invoiceSummaryDescription(items: unknown, invoiceNumber: string): string {
  const fromItems = descriptionFromInvoiceItemsQuick(items)
  if (fromItems) return fromItems.slice(0, 120)
  return `Invoice ${invoiceNumber}`.slice(0, 120)
}

async function applyPrepaidTipToReservation(
  admin: AdminClient,
  params: {
    invoiceId: string
    notes: string | null
    items: unknown
    customerId: string | null
    customerEmail?: string | null
    amountUsd: number
    paymentNoteMarker: string
    reservationIdHint?: string | null
    description: string
  }
): Promise<{ applied: boolean; reservationId: string | null; skippedReason: string | null }> {
  const amountUsd = roundMoney(params.amountUsd)
  if (amountUsd <= 0) {
    return { applied: false, reservationId: null, skippedReason: 'zero_amount' }
  }

  const { data: existingPay } = await admin
    .from('payment_records')
    .select('id, reservation_id')
    .ilike('note', `%${params.paymentNoteMarker}%`)
    .limit(1)
    .maybeSingle()

  if (existingPay?.id) {
    return {
      applied: false,
      reservationId: existingPay.reservation_id,
      skippedReason: 'already_applied',
    }
  }

  let email: string | null = params.customerEmail?.trim().toLowerCase() || null
  if (params.customerId) {
    const { data: customer } = await admin
      .from('customers')
      .select('email')
      .eq('id', params.customerId)
      .maybeSingle()
    email = (customer?.email || '').trim().toLowerCase() || email
  }

  const itemRid = reservationIdFromInvoiceItems(params.items)
  const resolved = await resolveReservationForQuickPayment(admin, {
    reservationIdHint: params.reservationIdHint || itemRid,
    customerId: params.customerId,
    email,
    amountUsd,
  })

  if (!resolved.reservationId) {
    console.warn('[payableInvoice] tip paid but no reservation matched', {
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

  const paymentMethod = await resolveStripePaymentMethodValue(admin)
  const operatorId = await lookupReservationOperatorId(admin, resolved.reservationId)
  const paymentId = `payment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  const note = [
    params.description || 'Guide Tip',
    params.paymentNoteMarker,
    `invoice_id:${params.invoiceId}`,
    email ? `email:${email}` : '',
  ]
    .filter(Boolean)
    .join(' | ')

  const { error: insertError } = await admin.from('payment_records').insert({
    id: paymentId,
    operator_id: operatorId,
    reservation_id: resolved.reservationId,
    payment_status: 'Deposit Received',
    amount: amountUsd,
    payment_method: paymentMethod,
    note,
    submit_by: 'stripe_webhook',
    submit_on: new Date().toISOString(),
  } as never)

  if (insertError) {
    console.error('[payableInvoice] tip payment_records insert failed', insertError)
    return {
      applied: false,
      reservationId: resolved.reservationId,
      skippedReason: 'payment_insert_failed',
    }
  }

  const { data: pricing } = await admin
    .from('reservation_pricing')
    .select('id, prepayment_tip')
    .eq('reservation_id', resolved.reservationId)
    .maybeSingle()

  if (pricing?.id) {
    const nextTip = roundMoney((Number(pricing.prepayment_tip) || 0) + amountUsd)
    const { error: tipError } = await admin
      .from('reservation_pricing')
      .update({ prepayment_tip: nextTip, updated_at: new Date().toISOString() } as never)
      .eq('id', pricing.id)
    if (tipError) {
      console.error('[payableInvoice] prepayment_tip update failed', tipError)
    }
  }

  try {
    await syncReservationPricingAggregates(admin, resolved.reservationId)
  } catch (err) {
    console.error('[payableInvoice] syncReservationPricingAggregates failed after tip', err)
  }

  return { applied: true, reservationId: resolved.reservationId, skippedReason: null }
}

function syncFieldBalanceChargeItems(
  items: unknown,
  plan: { balanceUsd: number; cardFeeUsd: number; invoiceAmountUsd: number }
): InvoiceItemRow[] {
  const rows = Array.isArray(items) ? ([...items] as InvoiceItemRow[]) : []
  if (rows.length === 0) return rows
  const first = { ...rows[0] }
  first.unitPrice = plan.invoiceAmountUsd
  first.total = plan.invoiceAmountUsd
  first.baseAmountUsd = plan.balanceUsd
  first.cardFeeUsd = plan.cardFeeUsd
  rows[0] = first
  return rows
}

function withPaidOpenAmountItems(items: unknown, paidUsd: number): InvoiceItemRow[] {
  const rows = Array.isArray(items) ? ([...items] as InvoiceItemRow[]) : []
  if (rows.length === 0) {
    return [
      {
        productName: 'Guide Tip',
        description: 'Guide Tip',
        quantity: 1,
        unitPrice: paidUsd,
        total: paidUsd,
        itemType: TIP_OPEN_AMOUNT_ITEM_TYPE,
        openAmount: true,
      },
    ]
  }
  const first = { ...rows[0] }
  first.unitPrice = paidUsd
  first.total = paidUsd
  first.quantity = first.quantity || 1
  rows[0] = first
  return rows
}

export async function createPublicInvoicePaySession(
  admin: AdminClient,
  token: string,
  params: {
    locale?: string
    tipUsd?: number
    amountUsd?: number
    payMode?: FieldPayMode | null
  }
): Promise<{ url: string; mode: 'hosted_invoice' | 'checkout' }> {
  const pathLocale = invoicePayPathLocale(params.locale)
  const locale = pathLocale === 'ko' ? 'ko' : 'en'
  const stripe = getStripeClient()

  const { data: invoice, error } = await admin
    .from('invoices')
    .select(
      'id, status, notes, total, items, customer_id, payment_token, hosted_invoice_url, stripe_invoice_id, stripe_invoice_status, stripe_customer_id, invoice_number'
    )
    .eq('payment_token', token)
    .maybeSingle()

  if (error || !invoice) {
    throw new Error(locale === 'ko' ? '인보이스를 찾을 수 없습니다.' : 'Invoice not found.')
  }
  const invoicePaid = invoice.status === 'paid' || invoice.stripe_invoice_status === 'paid'
  const fieldPayMode: FieldPayMode | null =
    params.payMode === 'balance' || params.payMode === 'tip' || params.payMode === 'both'
      ? params.payMode
      : null
  const fieldCharge = isFieldChargeInvoiceItems(invoice.items)
  if (invoicePaid && !(fieldCharge && fieldPayMode === 'tip')) {
    throw new Error(locale === 'ko' ? '이미 결제 완료된 인보이스입니다.' : 'Invoice is already paid.')
  }
  if (invoice.status === 'cancelled') {
    throw new Error(locale === 'ko' ? '취소된 인보이스입니다.' : 'Invoice is cancelled.')
  }

  const openAmount = isTipOpenAmountInvoiceItems(invoice.items)
  let invoiceAmountUsd = openAmount ? 0 : roundMoney(Number(invoice.total) || 0)
  let tipUsd = openAmount
    ? roundMoney(Number(params.amountUsd))
    : roundMoney(Number(params.tipUsd) || 0)
  let activeFieldPayMode: FieldPayMode | '' = ''

  if (fieldCharge && fieldPayMode) {
    const reservationId = reservationIdFromInvoiceItems(invoice.items)
    if (!reservationId) {
      throw new Error(
        locale === 'ko' ? '예약에 연결된 결제가 아닙니다.' : 'This payment is not linked to a reservation.'
      )
    }
    const live = await loadFieldChargeBalanceUsd(admin, reservationId)
    const resolved = resolveFieldCheckout({
      mode: fieldPayMode,
      invoicePaid,
      balanceUsd: live?.balanceUsd ?? 0,
      currency: live?.currency || 'USD',
      tipUsd,
    })
    if (!resolved.ok) {
      if (resolved.reason === 'balance_settled') {
        throw new Error(
          locale === 'ko' ? '받을 잔금이 없습니다. 팁만 결제할 수 있습니다.' : 'There is no balance due. You can pay a tip only.'
        )
      }
      if (resolved.reason === 'unsupported_currency') {
        throw new Error(
          locale === 'ko' ? '이 잔금은 카드 QR로 결제할 수 없습니다.' : 'This balance cannot be paid with the card QR.'
        )
      }
      throw new Error(
        locale === 'ko' ? '팁 금액은 $0.50 이상이어야 합니다.' : 'Tip amount must be at least $0.50.'
      )
    }
    activeFieldPayMode = fieldPayMode
    invoiceAmountUsd = resolved.plan.invoiceAmountUsd
    tipUsd = resolved.plan.tipUsd
    if (resolved.plan.balanceUsd > 0) {
      const nextItems = syncFieldBalanceChargeItems(invoice.items, resolved.plan)
      await admin
        .from('invoices')
        .update({
          items: nextItems as never,
          subtotal: resolved.plan.invoiceAmountUsd,
          total: resolved.plan.invoiceAmountUsd,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', invoice.id)
      invoice.items = nextItems
    }
    if (resolved.plan.retireHostedInvoice) {
      await retireOpenFieldStripeInvoice(admin, invoice)
      invoice.hosted_invoice_url = null
    }
  }

  if (openAmount) {
    const tipCents = usdToCents(tipUsd)
    if (!Number.isFinite(tipUsd) || tipCents < MIN_TIP_CENTS) {
      throw new Error(
        locale === 'ko'
          ? '팁 금액은 $0.50 이상이어야 합니다.'
          : 'Tip amount must be at least $0.50.'
      )
    }
    if (tipCents > MAX_OPEN_AMOUNT_CENTS) {
      throw new Error(locale === 'ko' ? '금액이 너무 큽니다.' : 'Amount is too large.')
    }
  } else {
    if (invoiceAmountUsd <= 0 && activeFieldPayMode !== 'tip') {
      throw new Error(locale === 'ko' ? '결제 금액이 0보다 커야 합니다.' : 'Invoice total must be greater than zero.')
    }
    if (tipUsd < 0) {
      throw new Error(locale === 'ko' ? '팁 금액이 올바르지 않습니다.' : 'Tip amount is invalid.')
    }
    const tipCents = usdToCents(tipUsd)
    if (tipUsd > 0 && tipCents < MIN_TIP_CENTS) {
      throw new Error(
        locale === 'ko' ? '팁은 $0.50 이상이거나 0이어야 합니다.' : 'Tip must be at least $0.50, or left at $0.'
      )
    }
    if (tipCents > MAX_TIP_CENTS) {
      throw new Error(locale === 'ko' ? '팁 금액이 너무 큽니다.' : 'Tip amount is too large.')
    }
  }

  const hostedUrl = String(invoice.hosted_invoice_url || '').trim()
  if (!activeFieldPayMode && !openAmount && tipUsd <= 0 && hostedUrl) {
    return { url: hostedUrl, mode: 'hosted_invoice' }
  }

  let customerEmail = ''
  if (invoice.customer_id) {
    const { data: customer } = await admin
      .from('customers')
      .select('id, name, email')
      .eq('id', invoice.customer_id)
      .maybeSingle()
    customerEmail = parseRecipientEmail(customer?.email || '')
  }

  const reservationId =
    reservationIdFromInvoiceItems(invoice.items) ||
    ''
  const invoiceNumber = String(invoice.invoice_number || '')
  const description = invoiceSummaryDescription(invoice.items, invoiceNumber)
  const origin = siteOrigin()
  const invoiceCents = usdToCents(invoiceAmountUsd)
  const tipCents = usdToCents(tipUsd)

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []
  if (invoiceCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: invoiceCents,
        product_data: {
          name: description || `Invoice ${invoiceNumber}`,
          ...(invoiceNumber ? { description: `Invoice ${invoiceNumber}` } : {}),
        },
      },
    })
  }
  if (tipCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: tipCents,
        product_data: {
          name: 'Guide Tip',
          description: openAmount
            ? 'Thank you for tipping your guide'
            : 'Optional guide gratuity',
        },
      },
    })
  }
  if (lineItems.length === 0) {
    throw new Error(locale === 'ko' ? '결제 금액이 없습니다.' : 'Nothing to charge.')
  }

  const metadata: Record<string, string> = {
    purpose: STAFF_PAYABLE_CHECKOUT_PURPOSE,
    invoice_id: invoice.id,
    invoice_number: invoiceNumber,
    invoice_amount_cents: String(invoiceCents),
    tip_amount_cents: String(tipCents),
    open_amount: openAmount ? '1' : '0',
    ...(activeFieldPayMode ? { pay_mode: activeFieldPayMode } : {}),
    customer_id: invoice.customer_id || '',
    ...(reservationId ? { reservation_id: reservationId } : {}),
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    line_items: lineItems,
    locale: stripeCheckoutLocale(pathLocale),
    success_url: `${origin}/${pathLocale}/pay/invoice/${token}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/${pathLocale}/pay/invoice/${token}?canceled=1`,
    metadata,
    payment_intent_data: {
      metadata,
      description:
        openAmount || activeFieldPayMode === 'tip'
          ? `Guide tip ${invoiceNumber}`
          : `Invoice ${invoiceNumber}${tipCents > 0 ? ' + tip' : ''}`,
    },
    submit_type: 'pay',
  }

  if (invoice.stripe_customer_id) {
    sessionParams.customer = invoice.stripe_customer_id
  } else if (customerEmail) {
    sessionParams.customer_email = customerEmail
  }

  const session = await stripe.checkout.sessions.create(sessionParams)
  if (!session.url) {
    throw new Error(
      locale === 'ko' ? 'Stripe 결제 URL을 받지 못했습니다.' : 'Stripe did not return a checkout URL.'
    )
  }
  return { url: session.url, mode: 'checkout' }
}

export async function markInvoicePaidFromCheckoutSession(
  admin: AdminClient,
  session: Stripe.Checkout.Session
): Promise<{
  ok: boolean
  invoiceId?: string
  alreadyPaid?: boolean
  paymentApplied?: boolean
  tipApplied?: boolean
  reservationId?: string | null
  paymentSkippedReason?: string | null
}> {
  const purpose = session.metadata?.purpose
  const invoiceId = session.metadata?.invoice_id
  if (purpose !== STAFF_PAYABLE_CHECKOUT_PURPOSE || !invoiceId) {
    return { ok: false }
  }
  if (session.payment_status !== 'paid') {
    return { ok: false }
  }

  const { data: invoice } = await admin
    .from('invoices')
    .select('id, status, notes, total, items, customer_id, stripe_invoice_id, created_by')
    .eq('id', invoiceId)
    .maybeSingle()

  if (!invoice) return { ok: false }

  const openAmount = session.metadata?.open_amount === '1' || isTipOpenAmountInvoiceItems(invoice.items)
  const payModeRaw = session.metadata?.pay_mode || ''
  const payMode: FieldPayMode | '' =
    payModeRaw === 'balance' || payModeRaw === 'tip' || payModeRaw === 'both' ? payModeRaw : ''
  const settlesInvoice = fieldCheckoutSettlesInvoice(payMode)
  const invoiceAmountUsd = roundMoney(Number(session.metadata?.invoice_amount_cents || 0) / 100)
  const tipAmountUsd = roundMoney(Number(session.metadata?.tip_amount_cents || 0) / 100)
  const paidTotalUsd =
    typeof session.amount_total === 'number'
      ? roundMoney(session.amount_total / 100)
      : roundMoney(invoiceAmountUsd + tipAmountUsd)
  const alreadyPaid = invoice.status === 'paid'
  const sessionId = session.id

  if (!alreadyPaid && settlesInvoice) {
    const paidItems = openAmount ? withPaidOpenAmountItems(invoice.items, paidTotalUsd) : invoice.items
    const updatePayload: Record<string, unknown> = {
      status: 'paid',
      paid_at: new Date().toISOString(),
      stripe_invoice_status: 'paid',
    }
    if (openAmount) {
      updatePayload.total = paidTotalUsd
      updatePayload.subtotal = paidTotalUsd
      updatePayload.items = paidItems
    }
    await admin.from('invoices').update(updatePayload as never).eq('id', invoice.id)
  }

  if (invoice.stripe_invoice_id) {
    try {
      const stripe = getStripeClient()
      await voidOpenStripeInvoice(stripe, invoice.stripe_invoice_id)
    } catch (err) {
      console.warn('[payableInvoice] failed to void Stripe invoice after checkout', err)
    }
  }

  const customerEmail =
    (typeof session.customer_email === 'string' && session.customer_email) ||
    (typeof session.customer_details?.email === 'string' ? session.customer_details.email : null)

  let paymentApplied = false
  let tipApplied = false
  let reservationId: string | null = null
  let paymentSkippedReason: string | null = null

  if (!openAmount && payMode !== 'tip' && invoiceAmountUsd > 0) {
    const apply = await applyPaidStaffInvoiceToReservation(admin, {
      invoiceId: invoice.id,
      notes: invoice.notes,
      total: invoiceAmountUsd,
      items: invoice.items,
      customerId: invoice.customer_id,
      amountUsdOverride: invoiceAmountUsd,
      paymentNoteMarker: checkoutNoteMarker(sessionId),
      customerEmail,
    })
    paymentApplied = apply.applied
    reservationId = apply.reservationId
    paymentSkippedReason = apply.skippedReason
  }

  const tipUsd = openAmount ? paidTotalUsd : tipAmountUsd
  if (tipUsd > 0) {
    const tip = await applyPrepaidTipToReservation(admin, {
      invoiceId: invoice.id,
      notes: invoice.notes,
      items: invoice.items,
      customerId: invoice.customer_id,
      customerEmail,
      amountUsd: tipUsd,
      paymentNoteMarker: tipNoteMarker(sessionId),
      reservationIdHint: (session.metadata?.reservation_id || '').trim() || null,
      description: openAmount
        ? descriptionFromInvoiceItemsQuick(invoice.items) || 'Guide Tip'
        : 'Guide Tip',
    })
    tipApplied = tip.applied
    if (!reservationId) reservationId = tip.reservationId
    if (!paymentSkippedReason) paymentSkippedReason = tip.skippedReason
  }

  if (!alreadyPaid || payMode) {
    const chargeUsd = openAmount || payMode === 'tip' ? 0 : invoiceAmountUsd
    const tipUsd = openAmount ? paidTotalUsd : tipAmountUsd
    await notifyFieldChargePaid(admin, {
      invoiceId: invoice.id,
      createdBy: (invoice as { created_by?: string | null }).created_by ?? null,
      customerId: invoice.customer_id,
      reservationId,
      amountUsd: roundMoney(chargeUsd + tipUsd),
      notifyKey: payMode ? `field-charge:${invoice.id}:${sessionId}` : null,
      chargeUsd,
      tipUsd,
      items: openAmount ? withPaidOpenAmountItems(invoice.items, paidTotalUsd) : invoice.items,
      notes: invoice.notes,
    })
  }

  return {
    ok: true,
    invoiceId: invoice.id,
    alreadyPaid,
    paymentApplied,
    tipApplied,
    reservationId,
    paymentSkippedReason,
  }
}

