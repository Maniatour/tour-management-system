import { autoCreateOrUpdateTour } from '@/lib/tourAutoCreation'
import { generateCustomerId, generateReservationId } from '@/lib/entityIds'
import { syncReservationPricingAggregates } from '@/lib/syncReservationPricingAggregates'
import { isManiatourHomepageBookingEmail } from '@/lib/emailReservationParser'
import {
  resolveImportCustomerLanguage,
  shouldReplaceDefaultImportCustomerLanguage,
} from '@/lib/importCustomerLanguage'
import type { ExtractedReservationData } from '@/types/reservationImport'
import { lookupReservationOperatorId } from '@/lib/operators/lookupReservationOperatorId'
import { computeDayTourCapacityTotals, computePerTourCapacityRows, pickTourWithMostSpotsLeft } from '@/lib/scheduleTourCapacity'
import { shouldOpenPriceInventoryForRemaining } from '@/lib/otaPriceInventory'
import {
  computeChannelPaymentAfterReturn,
  computeChannelSettlementAmount,
  deriveCommissionGrossForSettlement,
} from '@/utils/channelSettlement'
import { isTourCancelled } from '@/utils/tourStatusUtils'
import {
  computeImportReservationStatus,
  didCrossDepartureThreshold,
  reservationCountsTowardDepartureThreshold,
  shouldShowDepartureEmailBatchModal,
  sumReservationPeople,
  type DepartureBatchModalReason,
} from '@/lib/tourDepartureThreshold'
import { resolveOnSiteBalanceAmountForSave } from '@/utils/reservationPricingBalance'
import { AUTO_CONFIRM_ADDED_BY } from '@/lib/emailReservationParseCatalog'
import { selectedChoicesToPricingChoicesJson } from '@/utils/usResidentChoiceSync'
import {
  canyonKeyFromLabels,
  canonicalOptionKeyFromCanyon,
  isCanyonKey,
} from '@/lib/canyonChoice'
import type { SupabaseClient } from '@supabase/supabase-js'

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
  option_key?: string | null
  option_name?: string | null
  option_name_ko?: string | null
  canyon_key?: string | null
  canonical_option_key?: string | null
}

type EnrichedChoiceItem = SelectedChoiceItem & {
  option_key?: string | null
  option_name?: string | null
  option_name_ko?: string | null
  canyon_key?: string | null
  canonical_option_key?: string | null
}

async function enrichImportSelectedChoices(
  client: SupabaseClient,
  selectedChoices: SelectedChoiceItem[]
): Promise<{
  concrete: EnrichedChoiceItem[]
  all: EnrichedChoiceItem[]
  choicesJson: { required: Array<Record<string, unknown>> }
  canyonChoice: string | null
}> {
  const allInput = selectedChoices.filter((c) => c.choice_id && c.option_id)
  const optionIds = [
    ...new Set(
      allInput
        .map((c) => c.option_id)
        .filter((id) => id && id !== '__undecided__')
    ),
  ]
  const metaById = new Map<
    string,
    {
      option_key: string | null
      option_name: string | null
      option_name_ko: string | null
      adult_price: number | null
      canyon_key: string | null
      canonical_option_key: string | null
    }
  >()
  if (optionIds.length > 0) {
    const { data } = await client
      .from('choice_options')
      .select('id, option_key, option_name, option_name_ko, adult_price, canyon_key, canonical_option_key')
      .in('id', optionIds)
    for (const row of data || []) {
      const o = row as {
        id: string
        option_key?: string | null
        option_name?: string | null
        option_name_ko?: string | null
        adult_price?: number | null
        canyon_key?: string | null
        canonical_option_key?: string | null
      }
      if (!o.id) continue
      metaById.set(o.id, {
        option_key: o.option_key ?? null,
        option_name: o.option_name ?? null,
        option_name_ko: o.option_name_ko ?? null,
        adult_price: o.adult_price ?? null,
        canyon_key: o.canyon_key ?? null,
        canonical_option_key: o.canonical_option_key ?? null,
      })
    }
  }

  const all: EnrichedChoiceItem[] = allInput.map((c) => {
    const meta = metaById.get(c.option_id)
    const optionName = c.option_name ?? meta?.option_name ?? null
    const optionNameKo = c.option_name_ko ?? meta?.option_name_ko ?? null
    const optionKey = c.option_key ?? meta?.option_key ?? null
    const fromLabels = canyonKeyFromLabels(optionNameKo, optionName, optionKey)
    const canyonKey = c.canyon_key ?? meta?.canyon_key ?? fromLabels
    const canonical =
      c.canonical_option_key ??
      meta?.canonical_option_key ??
      (isCanyonKey(canyonKey) ? canonicalOptionKeyFromCanyon(canyonKey) : null)
    const isUndecided = c.option_id === '__undecided__'
    const totalPrice = isUndecided
      ? 0
      : c.total_price != null && Number(c.total_price) > 0
        ? Number(c.total_price)
        : Number(meta?.adult_price) || 0
    return {
      ...c,
      option_key: optionKey,
      option_name: optionName,
      option_name_ko: optionNameKo,
      canyon_key: canyonKey,
      canonical_option_key: canonical,
      total_price: totalPrice,
    }
  })

  const concrete = all.filter((c) => c.option_id !== '__undecided__')
  const canyonChoice = all.map((c) => c.canyon_key).find((k) => isCanyonKey(k)) ?? null
  return {
    concrete,
    all,
    choicesJson: selectedChoicesToPricingChoicesJson(
      all.map((c) => ({
        choice_id: c.choice_id,
        option_id: c.option_id,
        quantity: c.quantity ?? 1,
        total_price: Number(c.total_price) || 0,
        ...(c.option_key ? { option_key: c.option_key } : {}),
        ...(c.option_name_ko ? { option_name_ko: c.option_name_ko } : {}),
        ...(c.option_name ? { option_name: c.option_name } : {}),
      }))
    ),
    canyonChoice,
  }
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
  /** 폼「채널 결제 금액」net 또는 gross 후보 — gross 복원에 사용 */
  commission_base_price?: number
  /** DB `commission_base_price` 산식용 gross — 폼 `onlinePaymentAmount` */
  onlinePaymentAmount?: number
  /** UI에서 직접 넣은 채널 정산 금액이 있으면 우선 (없으면 서버에서 동일 산식 계산) */
  channel_settlement_amount?: number
  /** 상품가 계산용 성인 수 (없으면 예약 adults) */
  pricingAdults?: number
}

/** confirm 요청 body: 예약 생성에 필요한 필드 */
export interface ConfirmReservationImportBody {
  customer_id?: string
  customer_name?: string
  customer_email?: string
  customer_phone?: string
  /** 고객 언어 코드 (KR, EN, ES, …). 없으면 이메일 추출값/전화번호/채널로 추정 */
  customer_language?: string
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
  /** 저장 시 배정할 투어 ID (미지정이고 해당일 활성 투어가 2건 이상이면 여유 좌석 많은 투어로 자동 배정) */
  tour_id?: string | null
  /** 가격 정보 (있으면 reservation_pricing + deposit 시 payment_record 저장) */
  pricingInfo?: PricingInfo
}

export type ConfirmReservationImportFailure = {
  ok: false
  status: number
  error: string
}

export type ConfirmReservationImportSuccess = {
  ok: true
  status: 200
  reservation_id: string
  status_label: 'confirmed'
  reservation_status: string
  total_people_before: number
  total_people_after: number
  departure_threshold_crossed: boolean
  open_price_inventory: boolean
  product_id: string
  tour_date: string
  spots_left_after: number | null
  departure_batch: {
    show: true
    reason: DepartureBatchModalReason | null
    product_id: string
    tour_date: string
    total_people: number
    pending_count: number
    reservation_ids: string[]
  } | null
}

export type ConfirmReservationImportResult =
  | ConfirmReservationImportFailure
  | ConfirmReservationImportSuccess

export async function confirmReservationImport(
  client: SupabaseClient,
  importId: string,
  body: ConfirmReservationImportBody
): Promise<ConfirmReservationImportResult> {
  const { data: importRow, error: fetchImportError } = await client
    .from('reservation_imports')
    .select('*')
    .eq('id', importId)
    .eq('status', 'pending')
    .single()

  if (fetchImportError || !importRow) {
    return { ok: false, status: 404, error: 'Import not found or already processed' }
  }

  if (!body?.product_id || !body.tour_date || body.adults == null || !body.channel_id || !body.added_by) {
    return {
      ok: false,
      status: 400,
      error: 'Missing required fields: product_id, tour_date, adults, channel_id, added_by',
    }
  }

  let customerId = body.customer_id
  if (!customerId) {
    if (!body.customer_name) {
      return {
        ok: false,
        status: 400,
        error: 'Provide either customer_id or customer_name',
      }
    }
    const extracted =
      importRow.extracted_data && typeof importRow.extracted_data === 'object'
        ? (importRow.extracted_data as ExtractedReservationData)
        : {}
    const customerLanguage = resolveImportCustomerLanguage(
      {
        ...extracted,
        ...(body.customer_language ? { language: body.customer_language } : {}),
        ...(body.customer_phone ? { customer_phone: body.customer_phone } : {}),
      },
      importRow.platform_key
    )
    if (body.customer_email) {
      const { data: existing } = await client
        .from('customers')
        .select('id, language')
        .eq('email', body.customer_email)
        .maybeSingle()
      if (existing) {
        customerId = existing.id
        if (shouldReplaceDefaultImportCustomerLanguage(existing.language)) {
          await client.from('customers').update({ language: customerLanguage }).eq('id', existing.id)
        }
      }
    }
    if (!customerId) {
      const { data: newCustomer, error: insertCustomerError } = await client
        .from('customers')
        .insert({
          id: generateCustomerId(),
          name: body.customer_name,
          email: body.customer_email ?? null,
          phone: body.customer_phone ?? null,
          language: customerLanguage,
        })
        .select('id')
        .single()
      if (insertCustomerError || !newCustomer) {
        return {
          ok: false,
          status: 500,
          error: 'Failed to create customer: ' + (insertCustomerError?.message ?? ''),
        }
      }
      customerId = newCustomer.id
    }
  }

  const reservationId = generateReservationId()
  const child = body.child ?? 0
  const infant = body.infant ?? 0
  const totalPeople = body.total_people ?? body.adults + child + infant
  const tourDateYmd = String(body.tour_date).slice(0, 10)

  const { data: existingDayReservations } = await client
    .from('reservations')
    .select('id, total_people, status')
    .eq('product_id', body.product_id)
    .eq('tour_date', tourDateYmd)

  const existingTotalPeople = sumReservationPeople(existingDayReservations || [])
  const reservationStatus = computeImportReservationStatus(existingTotalPeople, totalPeople)
  const totalPeopleAfter = existingTotalPeople + totalPeople
  const crossedDepartureThreshold = didCrossDepartureThreshold(
    existingTotalPeople,
    totalPeopleAfter
  )

  const enrichedChoices = await enrichImportSelectedChoices(
    client,
    Array.isArray(body.selected_choices) ? body.selected_choices : []
  )
  const hasChoicesJson = enrichedChoices.choicesJson.required.length > 0

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
    status: reservationStatus,
    selected_options: null,
    selected_option_prices: null,
    is_private_tour: false,
    choices: hasChoicesJson ? enrichedChoices.choicesJson : null,
    canyon_choice: enrichedChoices.canyonChoice,
    variant_key: body.variant_key ?? 'default',
    import_needs_review: String(body.added_by || '').startsWith(AUTO_CONFIRM_ADDED_BY),
  }

  const { error: insertReservationError } = await client
    .from('reservations')
    .insert(reservationData)

  if (insertReservationError) {
    return { ok: false, status: 500, error: 'Failed to create reservation: ' + insertReservationError.message }
  }

  let assignTourId = body.tour_id?.trim() || null
  if (!assignTourId) {
    const { data: dayToursForAssign } = await client
      .from('tours')
      .select('id, tour_date, product_id, tour_status, max_participants, reservation_ids')
      .eq('product_id', body.product_id)
      .eq('tour_date', tourDateYmd)

    const activeToursForAssign = (dayToursForAssign || []).filter(
      (t) => !isTourCancelled((t as { tour_status?: string | null }).tour_status)
    )

    if (activeToursForAssign.length > 1) {
      const { data: capacityReservations } = await client
        .from('reservations')
        .select('id, tour_date, product_id, total_people, status')
        .eq('product_id', body.product_id)
        .eq('tour_date', tourDateYmd)

      const capacityRows = computePerTourCapacityRows(
        activeToursForAssign as Parameters<typeof computePerTourCapacityRows>[0],
        (capacityReservations || []) as Parameters<typeof computePerTourCapacityRows>[1],
        tourDateYmd,
        body.product_id
      )
      assignTourId = pickTourWithMostSpotsLeft(capacityRows)
    }
  }

  await autoCreateOrUpdateTour(
    body.product_id,
    body.tour_date,
    reservationId,
    false,
    { targetTourId: assignTourId }
  )

  // reservation_choices 저장 (미정 __undecided__ 제외)
  if (enrichedChoices.concrete.length > 0) {
    const { error: choicesError } = await client
      .from('reservation_choices')
      .insert(
        enrichedChoices.concrete.map((c) => ({
          reservation_id: reservationId,
          choice_id: c.choice_id,
          option_id: c.option_id,
          option_key: c.option_key ?? null,
          canyon_key: isCanyonKey(c.canyon_key) ? c.canyon_key : null,
          canonical_option_key: c.canonical_option_key ?? null,
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
    const productPriceTotalRow = (Number(pricingInfo.productPriceTotal) || 0) + notIncludedTotal

    let isOTAChannel = false
    const { data: chRow } = await client
      .from('channels')
      .select('type, category')
      .eq('id', body.channel_id)
      .maybeSingle()
    if (chRow) {
      const row = chRow as { type?: string | null; category?: string | null }
      isOTAChannel =
        String(row.type || '').toLowerCase() === 'ota' || row.category === 'OTA'
    }

    // 가격 행 생성 시점에는 payment_records 없음 → Returned/Partner Received 0 (savePricingInfo와 동일 산식)
    const depAmt = Number(pricingInfo.depositAmount) || 0
    const storedCb = Number(pricingInfo.commission_base_price) || 0
    const onlineGross = Number(pricingInfo.onlinePaymentAmount) || 0
    const commissionGross =
      onlineGross ||
      depAmt ||
      deriveCommissionGrossForSettlement(storedCb, {
        returnedAmount: 0,
        depositAmount: depAmt,
        productPriceTotal: productPriceTotalRow,
        isOTAChannel,
      }) ||
      storedCb

    const channelSettlementComputeInput = {
      depositAmount: depAmt,
      onlinePaymentAmount: commissionGross,
      productPriceTotal: productPriceTotalRow,
      couponDiscount: Number(pricingInfo.couponDiscount) || 0,
      additionalDiscount: Number(pricingInfo.additionalDiscount) || 0,
      optionTotalSum: Number(pricingInfo.optionTotal) || 0,
      additionalCost: Number(pricingInfo.additionalCost) || 0,
      tax: Number(pricingInfo.tax) || 0,
      cardFee: Number(pricingInfo.cardFee) || 0,
      prepaymentTip: Number(pricingInfo.prepaymentTip) || 0,
      onSiteBalanceAmount: resolveOnSiteBalanceAmountForSave({
        formBalance: pricingInfo.balanceAmount,
        totalPrice: Number(pricingInfo.totalPrice) || 0,
        depositAmount: depAmt,
      }),
      returnedAmount: 0,
      partnerReceivedAmount: 0,
      commissionAmount: Number(pricingInfo.commission_amount) || 0,
      reservationStatus,
      isOTAChannel,
    }

    const channelPayNet = computeChannelPaymentAfterReturn(channelSettlementComputeInput)
    const channelSettlementComputed = computeChannelSettlementAmount(channelSettlementComputeInput)

    const manualChSettle = pricingInfo.channel_settlement_amount
    const channelSettlementStored =
      manualChSettle !== undefined &&
      manualChSettle !== null &&
      String(manualChSettle) !== '' &&
      Number.isFinite(Number(manualChSettle))
        ? Math.round(Number(manualChSettle) * 100) / 100
        : Math.round(channelSettlementComputed * 100) / 100

    /** 가격 정보 모달·폼과 동일: 소계 후 할인·추가비·환불 반영 (클라이언트 totalPrice 미갱신 대비) */
    const round2 = (n: number) => Math.round(n * 100) / 100
    const reqOpt = Number(pricingInfo.requiredOptionTotal) || 0
    const optTot = Number(pricingInfo.optionTotal) || 0
    const subtotalStored = round2(productPriceTotalRow + reqOpt + optTot)
    const couponDisc = Number(pricingInfo.couponDiscount) || 0
    const addDisc = Number(pricingInfo.additionalDiscount) || 0
    const totalDiscount = Math.abs(couponDisc) + addDisc
    const totalAdditional =
      (Number(pricingInfo.additionalCost) || 0) +
      (Number(pricingInfo.cardFee) || 0) +
      (Number(pricingInfo.tax) || 0) +
      (Number(pricingInfo.prepaymentCost) || 0) +
      (Number(pricingInfo.prepaymentTip) || 0) +
      (Number(pricingInfo.privateTourAdditionalCost) || 0)
    const refundAmt = Math.max(0, Number(pricingInfo.refundAmount) || 0)
    const totalPriceStored = Math.max(
      0,
      round2(subtotalStored - totalDiscount + totalAdditional - refundAmt)
    )

    const pricingId = crypto.randomUUID()
    const pricingData = {
      id: pricingId,
      reservation_id: reservationId,
      adult_product_price: Number(pricingInfo.adultProductPrice) || 0,
      child_product_price: Number(pricingInfo.childProductPrice) || 0,
      infant_product_price: Number(pricingInfo.infantProductPrice) || 0,
      product_price_total: productPriceTotalRow,
      not_included_price: Number(pricingInfo.not_included_price) || 0,
      required_options: pricingInfo.requiredOptions ?? {},
      required_option_total: reqOpt,
      choices:
        pricingInfo.choices &&
        typeof pricingInfo.choices === 'object' &&
        Array.isArray((pricingInfo.choices as { required?: unknown }).required) &&
        ((pricingInfo.choices as { required: unknown[] }).required.length > 0)
          ? pricingInfo.choices
          : hasChoicesJson
            ? enrichedChoices.choicesJson
            : {},
      choices_total: Number(pricingInfo.choicesTotal) || 0,
      subtotal: subtotalStored,
      coupon_code: pricingInfo.couponCode ?? null,
      coupon_discount: couponDisc,
      additional_discount: addDisc,
      additional_cost: Number(pricingInfo.additionalCost) || 0,
      refund_reason: String(pricingInfo.refundReason ?? '').trim() || null,
      refund_amount: Number(pricingInfo.refundAmount) || 0,
      card_fee: Number(pricingInfo.cardFee) || 0,
      tax: Number(pricingInfo.tax) || 0,
      prepayment_cost: Number(pricingInfo.prepaymentCost) || 0,
      prepayment_tip: Number(pricingInfo.prepaymentTip) || 0,
      selected_options: pricingInfo.selectedOptionalOptions ?? {},
      option_total: optTot,
      total_price: totalPriceStored,
      deposit_amount: depAmt,
      balance_amount: resolveOnSiteBalanceAmountForSave({
        formBalance: pricingInfo.balanceAmount,
        totalPrice: totalPriceStored,
        depositAmount: depAmt,
      }),
      private_tour_additional_cost: Number(pricingInfo.privateTourAdditionalCost) || 0,
      commission_percent: Number(pricingInfo.commission_percent) || 0,
      commission_amount: Number(pricingInfo.commission_amount) || 0,
      /** UI「채널 결제 금액」과 동일 — Returned 차감 후 net (신규 행은 payment_records 없음) */
      commission_base_price: Math.round(channelPayNet * 100) / 100,
      channel_settlement_amount: channelSettlementStored,
      pricing_adults: Math.max(0, Math.floor(billingAdults)),
    }
    const { error: pricingError } = await client
      .from('reservation_pricing')
      .insert(pricingData as never)
    if (pricingError) {
      console.error('[reservation-imports/confirm] reservation_pricing insert error:', pricingError)
    }
  }

  // payment_records 저장 (보증금 > 0 이면 Deposit Received, 새 예약 추가와 동일)
  if (pricingInfo && Number(pricingInfo.depositAmount) > 0) {
    const depositAmount = Number(pricingInfo.depositAmount)
    const paymentId = `payment_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const paymentMethodId = depositPaymentMethodIdForEmailImport(body.channel_id, importRow)
    const operatorId = await lookupReservationOperatorId(client, reservationId)
    const { error: paymentError } = await client
      .from('payment_records')
      .insert({
        id: paymentId,
        operator_id: operatorId,
        reservation_id: reservationId,
        payment_status: 'Deposit Received',
        amount: depositAmount,
        payment_method: paymentMethodId,
        submit_by: body.added_by,
      } as never)
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
    return {
      ok: false,
      status: 500,
      error: 'Reservation created but import update failed: ' + updateImportError.message,
    }
  }

  const [{ data: dayTours }, { data: dayReservations }, { data: dayReservationsForDeparture }] =
    await Promise.all([
    client
      .from('tours')
      .select('id, tour_date, max_participants, tour_status, reservation_ids, product_id')
      .eq('product_id', body.product_id)
      .eq('tour_date', tourDateYmd),
    client
      .from('reservations')
      .select('id, tour_date, product_id, total_people, status')
      .eq('product_id', body.product_id)
      .eq('tour_date', tourDateYmd)
      .in('status', ['confirmed', 'recruiting']),
    client
      .from('reservations')
      .select('id, total_people, status')
      .eq('product_id', body.product_id)
      .eq('tour_date', tourDateYmd),
  ])

  const capacityAfter = computeDayTourCapacityTotals(
    dayTours || [],
    dayReservations || [],
    tourDateYmd,
    body.product_id
  )
  const spotsLeftAfter = capacityAfter?.totalSpotsLeft ?? null
  const spotsLeftBefore =
    spotsLeftAfter != null ? spotsLeftAfter + totalPeople : null
  const openPriceInventory = shouldOpenPriceInventoryForRemaining(
    spotsLeftAfter,
    spotsLeftBefore
  )

  const activeDayReservations = (dayReservationsForDeparture || []).filter((row) =>
    reservationCountsTowardDepartureThreshold(row.status)
  )
  const pendingReservationCount = activeDayReservations.filter(
    (row) => String(row.status ?? '').trim().toLowerCase() === 'pending'
  ).length
  const showDepartureBatch = shouldShowDepartureEmailBatchModal({
    totalPeopleAfter,
    crossedThreshold: crossedDepartureThreshold,
    pendingReservationCount,
  })
  let departureBatchReason: DepartureBatchModalReason | null = null
  if (showDepartureBatch) {
    departureBatchReason = crossedDepartureThreshold
      ? 'threshold_crossed'
      : 'pending_on_confirmed_day'
  }

  return {
    ok: true,
    status: 200,
    reservation_id: reservationId,
    status_label: 'confirmed',
    reservation_status: reservationStatus,
    total_people_before: existingTotalPeople,
    total_people_after: totalPeopleAfter,
    departure_threshold_crossed: crossedDepartureThreshold,
    open_price_inventory: openPriceInventory,
    product_id: body.product_id,
    tour_date: tourDateYmd,
    spots_left_after: spotsLeftAfter,
    departure_batch: showDepartureBatch
      ? {
          show: true,
          reason: departureBatchReason,
          product_id: body.product_id,
          tour_date: tourDateYmd,
          total_people: totalPeopleAfter,
          pending_count: pendingReservationCount,
          reservation_ids: activeDayReservations.map((row) => row.id),
        }
      : null,
  }
}
