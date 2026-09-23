import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { withChoiceProcessingFee } from '@/lib/choiceProcessingFee'
import { getStripeClient } from '@/lib/customerBookingCheckout'
import {
  buildInvoiceSitePayUrl,
  createQuickPayableInvoice,
  QUICK_PAYMENT_INVOICE_NOTES,
} from '@/lib/payableInvoice'

type AdminClient = SupabaseClient<Database>

export type TourBalanceQrRequestItem = {
  reservationId: string
  recipientName: string
  balanceUsd: number
}

export type TourBalanceQrLink = {
  reservationId: string
  recipientName: string
  balanceUsd: number
  chargeUsd: number
  sitePayUrl: string
  reused: boolean
  error?: string
}

type InvoiceRow = {
  id: string
  total: number | null
  items: unknown
  payment_token: string | null
  hosted_invoice_url: string | null
  status: string | null
  stripe_invoice_status: string | null
  paid_at: string | null
  stripe_invoice_id: string | null
  customer_id: string | null
  created_at: string | null
}

const MAX_ITEMS = 40

function cents(amount: number): number {
  return Math.round(amount * 100)
}

function fieldChargeReservationId(items: unknown): string | null {
  if (!Array.isArray(items)) return null
  for (const raw of items) {
    const item = raw as { fieldCharge?: boolean; reservationId?: string | null }
    if (item?.fieldCharge !== true) continue
    const id = String(item.reservationId || '').trim()
    if (id) return id
  }
  return null
}

function isOpenFieldInvoice(row: InvoiceRow): boolean {
  if (row.paid_at) return false
  const status = String(row.status || '').toLowerCase()
  const stripe = String(row.stripe_invoice_status || '').toLowerCase()
  if (status === 'paid' || status === 'cancelled' || status === 'void' || status === 'canceled') {
    return false
  }
  if (stripe === 'paid' || stripe === 'void' || stripe === 'uncollectible') return false
  return true
}

function payUrlFor(row: InvoiceRow): string {
  const token = String(row.payment_token || '').trim()
  if (token) return buildInvoiceSitePayUrl(token, 'en')
  return String(row.hosted_invoice_url || '').trim()
}

async function voidStripeInvoice(stripeInvoiceId: string | null | undefined): Promise<void> {
  const id = String(stripeInvoiceId || '').trim()
  if (!id) return
  const stripe = getStripeClient()
  try {
    const inv = await stripe.invoices.retrieve(id)
    if (inv.status === 'draft') {
      await stripe.invoices.del(id)
      return
    }
    if (inv.status === 'open') {
      await stripe.invoices.voidInvoice(id)
    }
  } catch (err) {
    console.warn('[tour-balance-qr] void stripe invoice', id, err)
  }
}

async function cancelInvoiceRow(admin: AdminClient, row: InvoiceRow): Promise<void> {
  await voidStripeInvoice(row.stripe_invoice_id)
  await admin
    .from('invoices')
    .update({
      status: 'cancelled',
      stripe_invoice_status: 'void',
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', row.id)
}

/**
 * 투어 잔금 QR: 같은 예약·같은 카드 청구액의 미결제 현장 링크는 재사용하고,
 * 금액이 달라진 예전 링크는 새 링크를 만든 뒤 취소합니다. 메일은 보내지 않습니다.
 */
export async function ensureTourBalanceQrLinks(
  admin: AdminClient,
  params: {
    locale?: 'ko' | 'en'
    tourDate?: string | null
    createdBy?: string | null
    items: TourBalanceQrRequestItem[]
  }
): Promise<TourBalanceQrLink[]> {
  const locale = params.locale === 'ko' ? 'ko' : 'en'
  const tourDate = String(params.tourDate || '').trim()
  const seen = new Set<string>()
  const items: TourBalanceQrRequestItem[] = []
  for (const raw of params.items) {
    const reservationId = String(raw.reservationId || '').trim()
    if (!reservationId || seen.has(reservationId)) continue
    seen.add(reservationId)
    const balanceUsd = Math.round(Number(raw.balanceUsd) * 100) / 100
    items.push({
      reservationId,
      recipientName: String(raw.recipientName || '').trim() || 'Guest',
      balanceUsd,
    })
    if (items.length >= MAX_ITEMS) break
  }

  if (items.length === 0) return []

  const reservationIds = items.map((item) => item.reservationId)
  const { data: reservations } = await admin
    .from('reservations')
    .select('id, customer_id')
    .in('id', reservationIds)

  const customerIdByReservation = new Map<string, string>()
  for (const row of reservations || []) {
    const id = String((row as { id?: string }).id || '').trim()
    const customerId = String((row as { customer_id?: string | null }).customer_id || '').trim()
    if (id && customerId) customerIdByReservation.set(id, customerId)
  }

  const customerIds = [...new Set(customerIdByReservation.values())]
  const openByReservation = new Map<string, InvoiceRow[]>()
  if (customerIds.length > 0) {
    const { data: invoices } = await admin
      .from('invoices')
      .select(
        'id, total, items, payment_token, hosted_invoice_url, status, stripe_invoice_status, paid_at, stripe_invoice_id, customer_id, created_at'
      )
      .in('customer_id', customerIds)
      .eq('notes', QUICK_PAYMENT_INVOICE_NOTES)
      .is('paid_at', null)
      .order('created_at', { ascending: false })
      .limit(400)

    for (const raw of (invoices || []) as InvoiceRow[]) {
      if (!isOpenFieldInvoice(raw)) continue
      const reservationId = fieldChargeReservationId(raw.items)
      if (!reservationId || !seen.has(reservationId)) continue
      const list = openByReservation.get(reservationId) || []
      list.push(raw)
      openByReservation.set(reservationId, list)
    }
  }

  const results: TourBalanceQrLink[] = []

  for (const item of items) {
    const chargeUsd = withChoiceProcessingFee(item.balanceUsd, true) ?? item.balanceUsd
    const baseResult = {
      reservationId: item.reservationId,
      recipientName: item.recipientName,
      balanceUsd: item.balanceUsd,
      chargeUsd,
    }

    if (!Number.isFinite(item.balanceUsd) || item.balanceUsd <= 0) {
      results.push({ ...baseResult, sitePayUrl: '', reused: false, error: 'invalid_amount' })
      continue
    }
    if (!customerIdByReservation.has(item.reservationId)) {
      results.push({
        ...baseResult,
        sitePayUrl: '',
        reused: false,
        error: locale === 'ko' ? '예약에 연결된 고객이 없습니다.' : 'This reservation has no linked customer.',
      })
      continue
    }

    const openRows = openByReservation.get(item.reservationId) || []
    const match = openRows.find(
      (row) => payUrlFor(row) && cents(Number(row.total) || 0) === cents(chargeUsd)
    )

    if (match) {
      const stale = openRows.filter((row) => row.id !== match.id)
      for (const row of stale) {
        try {
          await cancelInvoiceRow(admin, row)
        } catch (err) {
          console.warn('[tour-balance-qr] cancel stale', row.id, err)
        }
      }
      results.push({
        ...baseResult,
        sitePayUrl: payUrlFor(match),
        reused: true,
      })
      continue
    }

    try {
      const description = tourDate
        ? `On-site balance · ${item.recipientName} · ${tourDate}`
        : `On-site balance · ${item.recipientName}`
      const created = await createQuickPayableInvoice(admin, {
        email: '',
        amountUsd: chargeUsd,
        description,
        recipientName: item.recipientName,
        locale: 'en',
        createdBy: params.createdBy || null,
        reservationId: item.reservationId,
        preserveReservationCustomer: true,
        openAmount: false,
      })
      for (const row of openRows) {
        try {
          await cancelInvoiceRow(admin, row)
        } catch (err) {
          console.warn('[tour-balance-qr] cancel replaced', row.id, err)
        }
      }
      results.push({
        ...baseResult,
        chargeUsd: created.amountUsd,
        sitePayUrl: created.sitePayUrl,
        reused: false,
      })
    } catch (err) {
      results.push({
        ...baseResult,
        sitePayUrl: '',
        reused: false,
        error: err instanceof Error ? err.message : 'Failed to create payment link',
      })
    }
  }

  return results
}
