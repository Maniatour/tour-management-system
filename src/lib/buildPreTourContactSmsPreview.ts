import { supabase, supabaseAdmin } from '@/lib/supabase'
import { buildTourChatRoomUrl } from '@/lib/tourChatRoomEmailHtml'
import { fetchMessengerContactSettingsFromDb } from '@/lib/messengerContactSettingsDb'
import {
  getBuiltinPreTourContactSmsTemplate,
  substitutePreTourContactSmsTemplate,
} from '@/lib/preTourContactSms'
import { fetchPreTourContactSmsTemplateFromDb } from '@/lib/preTourContactSmsTemplateDb'
import {
  resolvePreTourContactSmsLocale,
  type PreTourContactSmsLocale,
} from '@/lib/preTourContactSmsLocale'
import { pickCustomerSmsPhone } from '@/utils/formatPhoneToE164'

export type PreTourContactSmsPreviewResult = {
  locale: PreTourContactSmsLocale
  message: string
  bodyTemplate: string
  savedInDb: boolean
  toPhone: string | null
  toPhoneDisplay: string
  customerName: string
  contacts: Awaited<ReturnType<typeof fetchMessengerContactSettingsFromDb>>
}

export async function buildPreTourContactSmsPreview(params: {
  reservationId: string
  localeOverride?: string | null
  bodyTemplateOverride?: string | null
}): Promise<
  { ok: true; data: PreTourContactSmsPreviewResult } | { ok: false; error: string; status: number }
> {
  const { reservationId, localeOverride, bodyTemplateOverride } = params
  const db = supabaseAdmin ?? supabase

  const { data: reservation, error: reservationError } = await db
    .from('reservations')
    .select(
      'id, customer_id, product_id, tour_date, tour_id, channel_rn, pickup_time, pickup_hotel'
    )
    .eq('id', reservationId)
    .single()

  if (reservationError || !reservation) {
    return { ok: false, error: '예약을 찾을 수 없습니다.', status: 404 }
  }

  let customer: {
    id?: string
    name?: string
    phone?: string | null
    emergency_contact?: string | null
    language?: string | null
  } | null = null

  if (reservation.customer_id) {
    const { data: customerData } = await db
      .from('customers')
      .select('id, name, phone, emergency_contact, language')
      .eq('id', reservation.customer_id)
      .maybeSingle()
    customer = customerData
  }

  if (!customer) {
    return { ok: false, error: '고객 정보를 찾을 수 없습니다.', status: 404 }
  }

  let productName = ''
  if (reservation.product_id) {
    const { data: product } = await db
      .from('products')
      .select('name, name_ko, name_en, customer_name_ko, customer_name_en')
      .eq('id', reservation.product_id)
      .maybeSingle()
    if (product) {
      const p = product as {
        customer_name_en?: string
        name_en?: string
        name?: string
        customer_name_ko?: string
        name_ko?: string
      }
      productName =
        p.customer_name_en || p.name_en || p.name || p.customer_name_ko || p.name_ko || ''
    }
  }

  let pickupHotelName = ''
  if (reservation.pickup_hotel) {
    const { data: hotel } = await db
      .from('pickup_hotels')
      .select('hotel')
      .eq('id', reservation.pickup_hotel)
      .maybeSingle()
    pickupHotelName = String((hotel as { hotel?: string } | null)?.hotel ?? '').trim()
  }

  let chatRoomUrl: string | null = null
  if (reservation.tour_id) {
    const { data: chatRoom } = await db
      .from('chat_rooms')
      .select('room_code')
      .eq('tour_id', reservation.tour_id)
      .maybeSingle()
    const code = (chatRoom as { room_code?: string } | null)?.room_code
    if (code?.trim()) chatRoomUrl = buildTourChatRoomUrl(code.trim())
  }

  const locale = resolvePreTourContactSmsLocale(customer.language, localeOverride)
  const contacts = await fetchMessengerContactSettingsFromDb()

  const dbTemplate = await fetchPreTourContactSmsTemplateFromDb(locale)
  const builtin = getBuiltinPreTourContactSmsTemplate(locale)
  const bodyTemplate =
    bodyTemplateOverride?.trim() || dbTemplate || builtin
  const savedInDb = !!dbTemplate && !bodyTemplateOverride

  const message = substitutePreTourContactSmsTemplate(bodyTemplate, {
    customerName: String(customer.name ?? ''),
    productName,
    tourDate: reservation.tour_date,
    channelReference: reservation.channel_rn,
    pickupTime: reservation.pickup_time,
    pickupHotelName,
    chatRoomUrl,
    contacts,
    locale,
  })

  const toPhone = pickCustomerSmsPhone(customer.phone, customer.emergency_contact)
  const rawPhone = customer.phone?.trim() || customer.emergency_contact?.trim() || ''

  return {
    ok: true,
    data: {
      locale,
      message,
      bodyTemplate,
      savedInDb,
      toPhone,
      toPhoneDisplay: rawPhone || (toPhone ?? ''),
      customerName: String(customer.name ?? ''),
      contacts,
    },
  }
}
