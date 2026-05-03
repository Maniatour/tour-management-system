import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { autoCreateOrUpdateTour } from '@/lib/tourAutoCreation'
import { generateCustomerId, generateReservationId } from '@/lib/entityIds'
import { syncReservationPricingAggregates } from '@/lib/syncReservationPricingAggregates'
import { isManiatourHomepageBookingEmail } from '@/lib/emailReservationParser'

/** 입금 자동 기록: Wix Website (payment_methods.id) */
const PAYMENT_METHOD_WIX_WEBSITE = 'PAYM030'
/** 입금 자동 기록: Partner Received */
const PAYMENT_METHOD_PARTNER_RECEIVED = 'PAYM033'

function depositPaymentMethodIdForEmailImport(
  channelId: string,
  importRow: { platform_key?: string | null; source_email?: string | null; subject?: string | null }
): string {
  const homepageChannel = channelId === 'M00001'
  const homepagePlatform = (importRow.platform_key ?? '').toLowerCase() === 'maniatour'
  const homepageWixEmail = isManiatourHomepageBookingEmail(
    importRow.source_email ?? null,
    importRow.subject ?? null
  )
  if (homepageChannel || homepagePlatform || homepageWixEmail) return PAYMENT_METHOD_WIX_WEBSITE
  return PAYMENT_METHOD_PARTNER_RECEIVED
}

/** 선택된 초이스 (reservation_choices 저장용) */
interface SelectedChoiceItem {
  choice_id: string
  option_id: string
  quantity?: number
  total_price?: number
}

/** 가격 정보 (reservation_pricing 저장용, 새 예약 추가와 동일) */
interface PricingInfo {
  adultProductPrice?: number
  childProductPrice?: number
  infantProductPrice?: number
  productPriceTotal?: number
  not_included_price?: number
  requiredOptions?: Record<string, unknown>
  requiredOptionTotal?: number
  choices?: Record<string, unknown>
  choicesTotal?: number
  subtotal?: number
  couponCode?: string | null
  couponDiscount?: number
  additionalDiscount?: number
  additionalCost?: number
  refundReason?: string | null
  refundAmount?: number
  cardFee?: number
  tax?: number
  prepaymentCost?: number
  prepaymentTip?: number
  selectedOptionalOptions?: Record<string, unknown>
  optionTotal?: number
  totalPrice?: number
  depositAmount?: number
  balanceAmount?: number
  privateTourAdditionalCost?: number
  commission_percent?: number
  commission_amount?: number
  /** 상품가 계산용 성인 수 (없으면 예약 adults) */
  pricingAdults?: number
}

/** confirm 요청 body: 예약 생성에 필요한 필드 */
interface ConfirmBody {
  customer_id?: string
  customer_name?: string
  customer_email?: string
  customer_phone?: string
  product_id: string
  tour_date: string
  tour_time?: string | null
  event_note?: string | null
  pickup_hotel?: string | null
  pickup_time?: string | null
  adults: number
  child?: number
  infant?: number
  total_people: number
  channel_id: string
  channel_rn?: string | null
  added_by: string
  status?: string
  variant_key?: string
  selected_choices?: SelectedChoiceItem[]
  /** 가격 정보 (있으면 reservation_pricing + deposit 시 payment_record 저장) */
  pricingInfo?: PricingInfo
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: importId } = await params
  const client = supabaseAdmin ?? (await import('@/lib/supabase')).supabase

  const { data: importRow, error: fetchImportError } = await client
    .from('reservation_imports')
    .select('*')
    .eq('id', importId)
    .eq('status', 'pending')
    .single()

  if (fetchImportError || !importRow) {
    return NextResponse.json(
      { error: 'Import not found or already processed' },
      { status: 404 }
    )
  }

  const body = (await request.json().catch(() => null)) as ConfirmBody | null
  if (!body?.product_id || !body.tour_date || body.adults == null || !body.channel_id || !body.added_by) {
    return NextResponse.json(
      { error: 'Missing required fields: product_id, tour_date, adults, channel_id, added_by' },
      { status: 400 }
    )
  }

  let customerId = body.customer_id
  if (!customerId) {
    if (body.customer_email && body.customer_name) {
      const { data: existing } = await client
        .from('customers')
        .select('id')
        .eq('email', body.customer_email)
        .maybeSingle()
      if (existing) {
        customerId = existing.id
      } else {
        const { data: newCustomer, error: insertCustomerError } = await client
          .from('customers')
          .insert({
            id: generateCustomerId(),
            name: body.customer_name,
            email: body.customer_email,
            phone: body.customer_phone ?? null,
          })
          .select('id')
          .single()
        if (insertCustomerError || !newCustomer) {
          return NextResponse.json(
            { error: 'Failed to create customer: ' + (insertCustomerError?.message ?? '') },
            { status: 500 }
          )
        }
        customerId = newCustomer.id
      }
    } else {
      return NextResponse.json(
        { error: 'Provide either customer_id or (customer_name + customer_email)' },
        { status: 400 }
      )
    }
  }

  const reservationId = generateReservationId()
  const child = body.child ?? 0
  const infant = body.infant ?? 0
  const totalPeople = body.total_people ?? body.adults + child + infant

  const reservationData = {
    id: reservationId,
    customer_id: customerId,
    product_id: body.product_id,
    tour_date: body.tour_date,
    tour_time: body.tour_time ?? null,
    event_note: body.event_note ?? null,
    pickup_hotel: body.pickup_hotel ?? null,
    pickup_time: body.pickup_time ?? null,
    adults: body.adults,
    child,
    infant,
    total_people: totalPeople,
    channel_id: body.channel_id,
    channel_rn: body.channel_rn ?? null,
    added_by: body.added_by,
    tour_id: null,
    status: body.status ?? 'confirmed',
    selected_options: null,
    selected_option_prices: null,
    is_private_tour: false,
    choices: null,
    variant_key: body.variant_key ?? 'default',
  }

  const { error: insertReservationError } = await client
    .from('reservations')
    .insert(reservationData)

  if (insertReservationError) {
    return NextResponse.json(
      { error: 'Failed to create reservation: ' + insertReservationError.message },
      { status: 500 }
    )
  }

  const _tourResult = await autoCreateOrUpdateTour(
    body.product_id,
    body.tour_date,
    reservationId,
    false
  )

  // reservation_choices 저장 (미정 __undecided__ 제외)
  const selectedChoices = Array.isArray(body.selected_choices) ? body.selected_choices : []
  const choicesToInsert = selectedChoices.filter(
    (c) => c.choice_id && c.option_id && c.option_id !== '__undecided__'
  )
  if (choicesToInsert.length > 0) {
    const { error: choicesError } = await client
      .from('reservation_choices')
      .insert(
        choicesToInsert.map((c) => ({
          reservation_id: reservationId,
          choice_id: c.choice_id,
          option_id: c.option_id,
          quantity: c.quantity ?? 1,
          total_price: c.total_price ?? 0,
        }))
      )
    if (choicesError) {
      console.error('[reservation-imports/confirm] reservation_choices insert error:', choicesError)
    }
  }

  // reservation_pricing 저장 (pricingInfo 있으면 새 예약 추가와 동일하게)
  const pricingInfo = body.pricingInfo
  if (pricingInfo) {
    const rawPa = pricingInfo.pricingAdults
    const billingAdults =
      rawPa !== undefined && rawPa !== null && String(rawPa) !== ''
        ? Math.max(0, Math.floor(Number(rawPa)))
        : Math.max(0, Math.floor(Number(body.adults) || 0))
    const billingPax = billingAdults + (body.child ?? 0) + (body.infant ?? 0)
    const notIncludedTotal = (Number(pricingInfo.not_included_price) || 0) * (billingPax || 1)
    const pricingId = crypto.randomUUID()
    const pricingData = {
      id: pricingId,
      reservation_id: reservationId,
      adult_product_price: Number(pricingInfo.adultProductPrice) || 0,
      child_product_price: Number(pricingInfo.childProductPrice) || 0,
      infant_product_price: Number(pricingInfo.infantProductPrice) || 0,
      product_price_total: (Number(pricingInfo.productPriceTotal) || 0) + notIncludedTotal,
      not_included_price: Number(pricingInfo.not_included_price) || 0,
      required_options: pricingInfo.requiredOptions ?? {},
      required_option_total: Number(pricingInfo.requiredOptionTotal) || 0,
      choices: pricingInfo.choices ?? {},
      choices_total: Number(pricingInfo.choicesTotal) || 0,
      subtotal: (Number(pricingInfo.subtotal) || 0) + notIncludedTotal,
      coupon_code: pricingInfo.couponCode ?? null,
      coupon_discount: Number(pricingInfo.couponDiscount) || 0,
      additional_discount: Number(pricingInfo.additionalDiscount) || 0,
      additional_cost: Number(pricingInfo.additionalCost) || 0,
      refund_reason: String(pricingInfo.refundReason ?? '').trim() || null,
      refund_amount: Number(pricingInfo.refundAmount) || 0,
      card_fee: Number(pricingInfo.cardFee) || 0,
      tax: Number(pricingInfo.tax) || 0,
      prepayment_cost: Number(pricingInfo.prepaymentCost) || 0,
      prepayment_tip: Number(pricingInfo.prepaymentTip) || 0,
      selected_options: pricingInfo.selectedOptionalOptions ?? {},
      option_total: Number(pricingInfo.optionTotal) || 0,
      total_price: (Number(pricingInfo.totalPrice) || 0) + notIncludedTotal,
      deposit_amount: Number(pricingInfo.depositAmount) || 0,
      balance_amount: Number(pricingInfo.balanceAmount) || 0,
      private_tour_additional_cost: Number(pricingInfo.privateTourAdditionalCost) || 0,
      commission_percent: Number(pricingInfo.commission_percent) || 0,
      commission_amount: Number(pricingInfo.commission_amount) || 0,
      pricing_adults: Math.max(0, Math.floor(billingAdults)),
    }
    const { error: pricingError } = await client
      .from('reservation_pricing')
      .insert(pricingData as Record<string, unknown>)
    if (pricingError) {
      console.error('[reservation-imports/confirm] reservation_pricing insert error:', pricingError)
    }
  }

  // payment_records 저장 (보증금 > 0 이면 Deposit Received, 새 예약 추가와 동일)
  if (pricingInfo && Number(pricingInfo.depositAmount) > 0) {
    const depositAmount = Number(pricingInfo.depositAmount)
    const paymentId = `payment_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const paymentMethodId = depositPaymentMethodIdForEmailImport(body.channel_id, importRow)
    const { error: paymentError } = await client
      .from('payment_records')
      .insert({
        id: paymentId,
        reservation_id: reservationId,
        payment_status: 'Deposit Received',
        amount: depositAmount,
        payment_method: paymentMethodId,
        submit_by: body.added_by,
      } as Record<string, unknown>)
    if (paymentError) {
      console.error('[reservation-imports/confirm] payment_records insert error:', paymentError)
    }
  }

  const sync = await syncReservationPricingAggregates(client, reservationId)
  if (!sync.ok && sync.error) {
    console.warn('[reservation-imports/confirm] reservation_pricing 동기화 실패:', reservationId, sync.error)
  }

  const { error: updateImportError } = await client
    .from('reservation_imports')
    .update({
      status: 'confirmed',
      reservation_id: reservationId,
      confirmed_by: body.added_by,
      updated_at: new Date().toISOString(),
    })
    .eq('id', importId)

  if (updateImportError) {
    return NextResponse.json(
      { error: 'Reservation created but import update failed: ' + updateImportError.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ reservation_id: reservationId, status: 'confirmed' })
}
