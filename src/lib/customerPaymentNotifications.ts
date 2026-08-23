import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import {
  RESIDENT_CHECK_PAYMENT_NOTIFY_MARKER,
  type CustomerPaymentNotifyKind,
} from '@/lib/customerPaymentNotifyKind'
import { getUserRole } from '@/lib/roles'
import { SUPER_ADMIN_EMAILS } from '@/lib/superAdmin'

export type { CustomerPaymentNotifyKind } from '@/lib/customerPaymentNotifyKind'

type AdminClient = SupabaseClient<Database>

function normalizeEmail(email: string | null | undefined): string | null {
  const value = email?.trim().toLowerCase()
  return value || null
}

function formatMoneyUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatGuestCounts(adults: number, child: number, infant: number): string {
  const parts: string[] = []
  if (adults > 0) parts.push(`성인 ${adults}`)
  if (child > 0) parts.push(`아동 ${child}`)
  if (infant > 0) parts.push(`유아 ${infant}`)
  return parts.length > 0 ? parts.join(', ') : '인원 정보 없음'
}

/** Admin layout accounts: admin/manager roles. Guides and drivers are excluded. */
function isAdminAccountRecipient(
  email: string,
  position: string | null | undefined,
  isActive: boolean | null | undefined
): boolean {
  const role = getUserRole(email, { position: position ?? null, is_active: isActive ?? null })
  return role === 'admin' || role === 'manager'
}

async function getCustomerPaymentNotificationRecipients(admin: AdminClient): Promise<string[]> {
  const { data, error } = await admin.from('team').select('email, position, is_active')

  if (error) {
    console.error('[customerPaymentNotifications] team recipients', error)
  }

  const emails = new Set<string>()
  for (const row of data || []) {
    const email = normalizeEmail(row.email)
    if (!email) continue
    if (!isAdminAccountRecipient(email, row.position, row.is_active)) continue
    emails.add(email)
  }
  for (const email of SUPER_ADMIN_EMAILS) {
    emails.add(email.toLowerCase())
  }
  return [...emails]
}

/**
 * After a customer Stripe web checkout is newly confirmed, queue staff popup rows.
 * Idempotent via unique (payment_intent_id, reservation_id, recipient_email).
 */
export async function notifyStaffOfCustomerPayment(
  admin: AdminClient,
  args: {
    reservationId: string
    paymentIntentId: string
    paymentRecordId: string | null
    amountUsd: number
    kind?: CustomerPaymentNotifyKind
  }
): Promise<void> {
  try {
    const recipients = await getCustomerPaymentNotificationRecipients(admin)
    if (recipients.length === 0) return

    const { data: reservation } = await admin
      .from('reservations')
      .select('id, tour_date, adults, child, infant, product_id, customer_id')
      .eq('id', args.reservationId)
      .maybeSingle()

    if (!reservation) return

    let customerName: string | null = null
    let customerEmail: string | null = null
    let customerPhone: string | null = null
    if (reservation.customer_id) {
      const { data: customer } = await admin
        .from('customers')
        .select('name, email, phone')
        .eq('id', reservation.customer_id)
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
    const amountLabel = formatMoneyUsd(args.amountUsd)
    const guestLabel = formatGuestCounts(adults, child, infant)
    const tourDate = reservation.tour_date || null
    const kind: CustomerPaymentNotifyKind = args.kind ?? 'web_checkout'
    const headline =
      kind === 'resident_check'
        ? '고객이 거주·연간 패스 안내에서 카드 결제를 완료했습니다.'
        : '고객 웹 결제가 완료되었습니다.'

    const message = [
      kind === 'resident_check' ? RESIDENT_CHECK_PAYMENT_NOTIFY_MARKER : null,
      headline,
      `금액: ${amountLabel}`,
      customerName ? `고객: ${customerName}` : null,
      customerEmail ? `이메일: ${customerEmail}` : null,
      customerPhone ? `전화: ${customerPhone}` : null,
      productName ? `상품: ${productName}` : null,
      tourDate ? `투어일: ${tourDate}` : null,
      `인원: ${guestLabel}`,
    ]
      .filter(Boolean)
      .join('\n')

    const rows = recipients.map((recipientEmail) => ({
      reservation_id: args.reservationId,
      payment_record_id: args.paymentRecordId,
      payment_intent_id: args.paymentIntentId,
      recipient_email: recipientEmail,
      amount: args.amountUsd,
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
      // Unique violation = already notified (idempotent)
      if (insertError.code === '23505') return
      console.error('[customerPaymentNotifications] insert failed', insertError)
    }
  } catch (err) {
    console.error('[customerPaymentNotifications] notify failed', err)
  }
}
