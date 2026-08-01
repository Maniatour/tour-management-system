import type { SupabaseClient } from '@supabase/supabase-js'
import type { ReservationOutboundSmsCategoryId } from '@/lib/reservationOutboundSmsCategories'

export type InsertReservationSmsLogParams = {
  reservationId: string
  customerId?: string | null
  categoryId: ReservationOutboundSmsCategoryId | 'pre_tour_contact'
  toPhone: string
  messageBody: string
  locale: string
  sentBy?: string | null
  twilioMessageSid?: string | null
  status: 'sent' | 'failed'
  errorMessage?: string | null
}

export async function insertReservationSmsLog(
  db: SupabaseClient,
  params: InsertReservationSmsLogParams
): Promise<void> {
  const { error } = await (db as any).from('pre_tour_contact_sms_logs').insert({
    reservation_id: params.reservationId,
    customer_id: params.customerId ?? null,
    category_id: params.categoryId,
    to_phone: params.toPhone,
    message_body: params.messageBody,
    locale: params.locale,
    twilio_message_sid: params.twilioMessageSid ?? null,
    status: params.status,
    error_message: params.errorMessage ?? null,
    sent_by: params.sentBy ?? null,
  })

  if (error) {
    console.error('[insertReservationSmsLog]', error)
  }
}

export async function fetchReservationCustomerId(
  db: SupabaseClient,
  reservationId: string
): Promise<string | null> {
  const { data } = await db
    .from('reservations')
    .select('customer_id')
    .eq('id', reservationId)
    .maybeSingle()

  return (data as { customer_id?: string } | null)?.customer_id ?? null
}
