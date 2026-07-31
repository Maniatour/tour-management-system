import { fetchAdminSmsTemplateFromDb } from '@/lib/adminSmsTemplateDb'
import { buildPreTourContactSmsPreview } from '@/lib/buildPreTourContactSmsPreview'
import {
  formatRebookingCouponValidUntil,
  formatTourDateLongForCancellationMessage,
  buildCustomerRebookingUrlFromReservation,
  REBOOKING_OUTREACH_COUPON_CODE,
  type ReservationChoiceRowForRebooking,
} from '@/lib/customerRebookingUrl'
import {
  getBuiltinCancellationFollowUpTemplate,
  substituteCancellationFollowUpMessageTemplate,
  type CancellationFollowUpMessageLocale,
} from '@/lib/cancellationFollowUpMessage'
import { fetchMessengerContactSettingsFromDb } from '@/lib/messengerContactSettingsDb'
import {
  getBuiltinPendingAltTourTemplate,
  substitutePendingAltTourMessageTemplate,
  type PendingAltTourMessageLocale,
} from '@/lib/pendingCustomerAltTourMessage'
import {
  getBuiltinPickupNotificationSmsTemplate,
  substitutePickupNotificationSmsTemplate,
  type PickupNotificationSmsLocale,
} from '@/lib/pickupNotificationSms'
import { fetchRebookingPriceComparisonForReservation } from '@/lib/rebookingPriceComparisonServer'
import {
  resolveCustomerSmsLocale,
  type CustomerSmsLocale,
} from '@/lib/reservationEmailLocale'
import type { ReservationOutboundSmsCategoryId } from '@/lib/reservationOutboundSmsCategories'
import { availableLocalesForReservationSmsCategory } from '@/lib/reservationOutboundSmsCategories'
import { resolveReservationChoices } from '@/lib/resolveReservationChoices'
import {
  formatRebookingPriceComparisonHtml,
  formatRebookingPriceComparisonPlain,
} from '@/lib/rebookingPriceComparison'
import { fetchPrimaryStaffOutreachMessageTemplateFromDb } from '@/lib/staffOutreachMessageTemplateDb'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { getProductNameForLocale } from '@/utils/reservationUtils'
import { pickCustomerSmsPhone } from '@/utils/formatPhoneToE164'
import type { SupabaseClient } from '@supabase/supabase-js'

export type ReservationOutboundSmsPreviewResult = {
  categoryId: ReservationOutboundSmsCategoryId
  locale: string
  message: string
  bodyTemplate: string
  savedInDb: boolean
  toPhone: string | null
  toPhoneDisplay: string
  customerName: string
  availableLocales: readonly string[]
}

type BuildParams = {
  reservationId: string
  categoryId: ReservationOutboundSmsCategoryId
  localeOverride?: string | null
  bodyTemplateOverride?: string | null
}

function toPickupNotificationLocale(locale: CustomerSmsLocale): PickupNotificationSmsLocale {
  return locale
}

async function loadReservationBase(reservationId: string) {
  const db = supabaseAdmin ?? supabase
  const { data: reservation, error } = await db
    .from('reservations')
    .select(
      'id, customer_id, product_id, tour_date, tour_id, channel_rn, channel_id, pickup_time, pickup_hotel, adults, child, infant'
    )
    .eq('id', reservationId)
    .single()

  if (error || !reservation) {
    return { ok: false as const, error: '예약을 찾을 수 없습니다.', status: 404 }
  }

  let customer: {
    name?: string
    phone?: string | null
    emergency_contact?: string | null
    language?: string | null
  } | null = null

  if (reservation.customer_id) {
    const { data } = await db
      .from('customers')
      .select('name, phone, emergency_contact, language')
      .eq('id', reservation.customer_id)
      .maybeSingle()
    customer = data
  }

  if (!customer) {
    return { ok: false as const, error: '고객 정보를 찾을 수 없습니다.', status: 404 }
  }

  let product: {
    id: string
    name?: string | null
    name_ko?: string | null
    name_en?: string | null
    customer_name_ko?: string | null
    customer_name_en?: string | null
  } | null = null

  if (reservation.product_id) {
    const { data } = await db
      .from('products')
      .select('id, name, name_ko, name_en, customer_name_ko, customer_name_en')
      .eq('id', reservation.product_id)
      .maybeSingle()
    product = data as typeof product
  }

  let pickupHotelName = ''
  let pickupLocation = ''
  if (reservation.pickup_hotel) {
    const { data: hotel } = await db
      .from('pickup_hotels')
      .select('hotel, pick_up_location')
      .eq('id', reservation.pickup_hotel)
      .maybeSingle()
    pickupHotelName = String((hotel as { hotel?: string } | null)?.hotel ?? '').trim()
    pickupLocation = String((hotel as { pick_up_location?: string } | null)?.pick_up_location ?? '').trim()
  }

  let channelName: string | null = null
  if (reservation.channel_id) {
    const { data: channel } = await db
      .from('channels')
      .select('name')
      .eq('id', reservation.channel_id)
      .maybeSingle()
    channelName = (channel as { name?: string } | null)?.name?.trim() || null
  }

  const toPhone = pickCustomerSmsPhone(customer.phone, customer.emergency_contact)
  const rawPhone = customer.phone?.trim() || customer.emergency_contact?.trim() || ''

  return {
    ok: true as const,
    db,
    reservation,
    customer,
    product,
    pickupHotelName,
    pickupLocation,
    channelName,
    toPhone,
    toPhoneDisplay: rawPhone || (toPhone ?? ''),
    customerName: String(customer.name ?? ''),
  }
}

async function fetchCouponValidUntilIso(db: SupabaseClient): Promise<string | null> {
  const { data } = await db
    .from('coupons')
    .select('end_date')
    .ilike('coupon_code', REBOOKING_OUTREACH_COUPON_CODE)
    .eq('status', 'active')
    .order('end_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as { end_date?: string | null } | null)?.end_date ?? null
}

export async function buildReservationOutboundSmsPreview(
  params: BuildParams
): Promise<
  { ok: true; data: ReservationOutboundSmsPreviewResult } | { ok: false; error: string; status: number }
> {
  const { reservationId, categoryId, localeOverride, bodyTemplateOverride } = params
  const availableLocales = availableLocalesForReservationSmsCategory(categoryId)

  const base = await loadReservationBase(reservationId)
  if (!base.ok) return base

  const {
    db,
    reservation,
    customer,
    product,
    pickupHotelName,
    pickupLocation,
    channelName,
    toPhone,
    toPhoneDisplay,
    customerName,
  } = base

  const smsLocale = resolveCustomerSmsLocale(customer.language, localeOverride)

  if (categoryId === 'pre_tour_contact') {
    const result = await buildPreTourContactSmsPreview({
      reservationId,
      localeOverride: smsLocale,
      ...(bodyTemplateOverride !== undefined ? { bodyTemplateOverride } : {}),
    })
    if (!result.ok) return result
    return {
      ok: true,
      data: {
        categoryId,
        locale: smsLocale,
        message: result.data.message,
        bodyTemplate: result.data.bodyTemplate,
        savedInDb: result.data.savedInDb,
        toPhone: result.data.toPhone,
        toPhoneDisplay: result.data.toPhoneDisplay,
        customerName: result.data.customerName,
        availableLocales,
      },
    }
  }

  if (categoryId === 'pickup_notification') {
    const locale = toPickupNotificationLocale(smsLocale)
    const dbTemplate = await fetchAdminSmsTemplateFromDb('pickup_notification', locale)
    const builtin = getBuiltinPickupNotificationSmsTemplate(locale)
    const bodyTemplate = bodyTemplateOverride?.trim() || dbTemplate || builtin
    const savedInDb = !!dbTemplate && !bodyTemplateOverride?.trim()
    const contacts = await fetchMessengerContactSettingsFromDb()
    const productName = getProductNameForLocale(
      String(reservation.product_id ?? ''),
      product ? [product] : [],
      locale
    )
    const message = substitutePickupNotificationSmsTemplate(bodyTemplate, {
      customerName,
      productName,
      tourDate: reservation.tour_date,
      channelReference: reservation.channel_rn,
      pickupTime: reservation.pickup_time,
      pickupHotelName,
      pickupLocation,
      contacts,
      locale,
    })

    return {
      ok: true,
      data: {
        categoryId,
        locale,
        message,
        bodyTemplate,
        savedInDb,
        toPhone,
        toPhoneDisplay,
        customerName,
        availableLocales,
      },
    }
  }

  const staffLocale: CancellationFollowUpMessageLocale | PendingAltTourMessageLocale = smsLocale

  const productsArr = product ? [product] : []
  const productName = getProductNameForLocale(
    String(reservation.product_id ?? ''),
    productsArr,
    staffLocale
  )

  if (categoryId === 'cancellation_follow_up' || categoryId === 'cancellation_rebooking') {
    const messageKind = categoryId === 'cancellation_rebooking' ? 'rebooking' : 'follow_up'
    const dbTpl = await fetchPrimaryStaffOutreachMessageTemplateFromDb(
      'cancellation_follow_up',
      staffLocale,
      'sms',
      messageKind
    )
    const builtin = getBuiltinCancellationFollowUpTemplate(staffLocale, 'sms', messageKind)
    const bodyTemplate = bodyTemplateOverride?.trim() || dbTpl?.body_template || builtin.body
    const savedInDb = !!dbTpl?.body_template?.trim() && !bodyTemplateOverride?.trim()

    let choiceRows: ReservationChoiceRowForRebooking[] = []
    let couponValidUntilIso: string | null = null
    let priceComparisonPlain = ''
    let priceComparisonHtml = ''

    if (messageKind === 'rebooking') {
      const resolved = await resolveReservationChoices(db, reservationId)
      choiceRows = resolved.map((row) => ({
        choice_id: row.choice_id,
        option_id: row.option_id,
        quantity: row.quantity,
      }))
      couponValidUntilIso = await fetchCouponValidUntilIso(db)
      const comparison = await fetchRebookingPriceComparisonForReservation(db, {
        reservationId,
        couponCode: REBOOKING_OUTREACH_COUPON_CODE,
        channelName,
      })
      if (comparison) {
        priceComparisonPlain = formatRebookingPriceComparisonPlain(
          staffLocale,
          comparison,
          REBOOKING_OUTREACH_COUPON_CODE
        )
        priceComparisonHtml = formatRebookingPriceComparisonHtml(
          staffLocale,
          comparison,
          REBOOKING_OUTREACH_COUPON_CODE
        )
      }
    }

    const rebookingUrl = buildCustomerRebookingUrlFromReservation({
      locale: staffLocale,
      reservationId,
      productId: String(reservation.product_id ?? ''),
      tourDate: reservation.tour_date,
      adults: reservation.adults ?? 0,
      children: reservation.child ?? 0,
      infants: reservation.infant ?? 0,
      choiceRows,
      couponCode: REBOOKING_OUTREACH_COUPON_CODE,
      couponValidUntilIso,
    })

    const message = substituteCancellationFollowUpMessageTemplate('', bodyTemplate, 'sms', {
      customerName,
      tourDate: reservation.tour_date,
      productName,
      channelReference: reservation.channel_rn,
      locale: staffLocale,
      tourDateLong: formatTourDateLongForCancellationMessage(reservation.tour_date, staffLocale),
      rebookingUrl,
      couponCode: REBOOKING_OUTREACH_COUPON_CODE,
      couponValidUntil: formatRebookingCouponValidUntil(staffLocale, couponValidUntilIso),
      priceComparisonHtml,
      priceComparisonPlain,
    }).body

    return {
      ok: true,
      data: {
        categoryId,
        locale: staffLocale,
        message,
        bodyTemplate,
        savedInDb,
        toPhone,
        toPhoneDisplay,
        customerName,
        availableLocales,
      },
    }
  }

  const dbTpl = await fetchPrimaryStaffOutreachMessageTemplateFromDb(
    'pending_alt_tour',
    staffLocale,
    'sms',
    'default'
  )
  const builtin = getBuiltinPendingAltTourTemplate(staffLocale, 'sms')
  const bodyTemplate = bodyTemplateOverride?.trim() || dbTpl?.body_template || builtin.body
  const savedInDb = !!dbTpl?.body_template?.trim() && !bodyTemplateOverride?.trim()

  const message = substitutePendingAltTourMessageTemplate(bodyTemplate, {
    customerName,
    tourDate: reservation.tour_date,
    productName,
    channelReference: reservation.channel_rn,
    locale: staffLocale,
  })

  return {
    ok: true,
    data: {
      categoryId,
      locale: staffLocale,
      message,
      bodyTemplate,
      savedInDb,
      toPhone,
      toPhoneDisplay,
      customerName,
      availableLocales,
    },
  }
}
