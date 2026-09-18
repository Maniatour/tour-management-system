import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { FIELD_CHARGE_PAYMENT_NOTIFY_MARKER } from '@/lib/customerPaymentNotifyKind'
import { sendStaffPushToEmails } from '@/lib/sendStaffWebPush'
import { SUPER_ADMIN_EMAILS, isSuperAdminActor } from '@/lib/superAdmin'

type AdminClient = SupabaseClient<Database>

export const FIELD_CHARGE_PAYMENT_INTENT_PREFIX = 'field-charge:'

export function fieldChargePaymentIntentId(invoiceId: string): string {
  return `${FIELD_CHARGE_PAYMENT_INTENT_PREFIX}${invoiceId}`
}

export function isFieldChargeInvoiceItems(items: unknown): boolean {
  if (!Array.isArray(items)) return false
  return items.some((raw) => (raw as { fieldCharge?: unknown })?.fieldCharge === true)
}

function isQuickPaymentNotes(notes: string | null | undefined): boolean {
  const n = (notes || '').trim()
  if (!n) return false
  if (n.includes('quick_payment_request')) return true
  return n.includes('빠른 금액 청구') || n.includes('Quick payment request')
}

export function isFieldChargePaidNotifyInvoice(params: {
  notes: string | null | undefined
  items: unknown
}): boolean {
  return isQuickPaymentNotes(params.notes) && isFieldChargeInvoiceItems(params.items)
}

export function isFieldChargeOfficePushRecipient(params: {
  email: string | null | undefined
  position: string | null | undefined
  isActive?: boolean | null
}): boolean {
  if (params.isActive === false) return false
  const email = (params.email || '').trim().toLowerCase()
  if (!email) return false
  if (isSuperAdminActor(email, params.position)) return true
  const pos = (params.position || '').trim().toLowerCase()
  if (pos === 'op' || pos === 'super') return true
  if (
    pos === 'office manager' ||
    pos === 'office_manager' ||
    pos === 'manager' ||
    pos === '매니저'
  ) {
    return true
  }
  return false
}

function normalizeEmail(email: string | null | undefined): string | null {
  const value = email?.trim().toLowerCase()
  return value || null
}

function reservationIdFromItems(items: unknown): string | null {
  if (!Array.isArray(items)) return null
  for (const raw of items) {
    const id = (raw as { reservationId?: string | null })?.reservationId
    if (typeof id === 'string' && id.trim()) return id.trim()
  }
  return null
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

async function officeRecipientEmails(admin: AdminClient): Promise<string[]> {
  const { data, error } = await admin.from('team').select('email, position, is_active')
  if (error) {
    console.error('[fieldChargePaidNotify] team recipients', error)
  }
  const emails = new Set<string>()
  for (const row of data || []) {
    const email = normalizeEmail(row.email)
    if (!email) continue
    if (!isFieldChargeOfficePushRecipient(row)) continue
    emails.add(email)
  }
  for (const email of SUPER_ADMIN_EMAILS) {
    emails.add(email.toLowerCase())
  }
  return [...emails]
}

async function resolveTourId(admin: AdminClient, reservationId: string): Promise<string | null> {
  const { data } = await admin
    .from('tours')
    .select('id')
    .overlaps('reservation_ids', [reservationId])
    .limit(1)
    .maybeSingle()
  return data?.id ? String(data.id) : null
}

/**
 * 가이드 현장 청구가 새로 결제되면 청구 가이드 + OP/Office Manager/Super에게
 * 인앱 알림 행과 web push를 보냅니다. unique 제약으로 중복 전송을 막습니다.
 */
export async function notifyFieldChargePaid(
  admin: AdminClient,
  args: {
    invoiceId: string
    createdBy: string | null | undefined
    customerId: string | null | undefined
    reservationId: string | null | undefined
    amountUsd: number
    items: unknown
    notes: string | null | undefined
  }
): Promise<void> {
  try {
    if (!isFieldChargePaidNotifyInvoice({ notes: args.notes, items: args.items })) return

    const reservationId = (args.reservationId || reservationIdFromItems(args.items) || '').trim()
    if (!reservationId) return

    const invoiceId = args.invoiceId.trim()
    if (!invoiceId) return

    const amountUsd = Number.isFinite(args.amountUsd) ? Math.round(args.amountUsd * 100) / 100 : 0
    const creatorEmail = normalizeEmail(args.createdBy)
    const officeEmails = await officeRecipientEmails(admin)
    const recipients = new Set<string>(officeEmails)
    if (creatorEmail) recipients.add(creatorEmail)
    if (recipients.size === 0) return

    const { data: reservation } = await admin
      .from('reservations')
      .select('id, tour_date, adults, child, infant, product_id, customer_id')
      .eq('id', reservationId)
      .maybeSingle()
    if (!reservation) return

    let customerName: string | null = null
    let customerEmail: string | null = null
    let customerPhone: string | null = null
    const customerId = args.customerId || reservation.customer_id
    if (customerId) {
      const { data: customer } = await admin
        .from('customers')
        .select('name, email, phone')
        .eq('id', customerId)
        .maybeSingle()
      customerName = customer?.name?.trim() || null
      customerEmail = customer?.email?.trim() || null
      customerPhone = customer?.phone?.trim() || null
    }

    let productName: string | null = null
    if (reservation.product_id) {
      const { data: product } = await admin
        .from('products')
        .select('internal_name_ko, customer_name_ko, name_ko, name')
        .eq('id', reservation.product_id)
        .maybeSingle()
      productName =
        product?.internal_name_ko?.trim() ||
        product?.customer_name_ko?.trim() ||
        product?.name_ko?.trim() ||
        product?.name?.trim() ||
        null
    }

    const adults = Number(reservation.adults) || 0
    const child = Number(reservation.child) || 0
    const infant = Number(reservation.infant) || 0
    const tourDate = reservation.tour_date || null
    const amountLabel = formatUsd(amountUsd)
    const guestName = customerName || 'Guest'
    const message = [
      FIELD_CHARGE_PAYMENT_NOTIFY_MARKER,
      '가이드 현장 청구 결제가 완료되었습니다.',
      `금액: ${amountLabel}`,
      `고객: ${guestName}`,
      customerEmail ? `이메일: ${customerEmail}` : null,
      productName ? `상품: ${productName}` : null,
      tourDate ? `투어일: ${tourDate}` : null,
      creatorEmail ? `청구 가이드: ${creatorEmail}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    const paymentIntentId = fieldChargePaymentIntentId(invoiceId)
    const rows = [...recipients].map((recipientEmail) => ({
      reservation_id: reservationId,
      payment_record_id: null,
      payment_intent_id: paymentIntentId,
      recipient_email: recipientEmail,
      amount: amountUsd,
      currency: 'usd',
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      product_name: productName,
      tour_date: tourDate,
      adults,
      child,
      infant,
      message,
    }))

    const { error: insertError } = await (admin as any)
      .from('customer_payment_notifications')
      .insert(rows)

    if (insertError) {
      if (insertError.code === '23505') return
      console.error('[fieldChargePaidNotify] insert failed', insertError)
      return
    }

    const tourId = await resolveTourId(admin, reservationId)

    await sendStaffPushToEmails(admin, {
      targetEmailsLower: recipients,
      buildPayload: ({ email, language }) => {
        const isKo = language === 'ko'
        const isCreator = creatorEmail != null && email === creatorEmail
        const guidePath = tourId ? `/${language}/guide/tours/${tourId}` : `/${language}/guide`
        const officePath = `/${language}/admin/reservations/${reservationId}`
        return {
          title: isKo ? '현장 청구 결제 완료' : 'On-site charge paid',
          body: isKo
            ? `${guestName} · ${amountLabel}`
            : `${guestName} · ${amountLabel}`,
          tag: `field-charge-paid-${invoiceId}`,
          url: isCreator ? guidePath : officePath,
          extraData: {
            type: 'field_charge_paid',
            invoiceId,
            reservationId,
          },
        }
      },
    })
  } catch (err) {
    console.error('[fieldChargePaidNotify] notify failed', err)
  }
}
