/**
 * 예약 수정 공통 로직 (예약 목록 모달 + 예약 상세 페이지 동일 적용)
 * - reservations 업데이트, reservation_choices, reservation_customers, 고객 언어, reservation_pricing, 투어 자동 생성
 */
import { supabase } from './supabase'
import { autoCreateOrUpdateTour } from './tourAutoCreation'
import type { Reservation } from '@/types/reservation'
import {
  computeChannelPaymentAfterReturn,
  computeChannelSettlementAmount,
  deriveCommissionGrossForSettlement,
} from '@/utils/channelSettlement'

const UNDECIDED_OPTION_ID = '__undecided__'
const toNum = (v: unknown) => (v !== null && v !== undefined && v !== '' ? Number(v) : 0)

function normalizeTourDateForSlot(d: unknown): string {
  const s = String(d ?? '').trim()
  if (!s) return ''
  return s.includes('T') ? s.split('T')[0]! : s
}

/**
 * 예약이 다른 상품/날짜로 옮겨갈 때, (새 product_id + tour_date)가 아닌 투어들의 reservation_ids에서만 제거한다.
 * 같은 날·같은 상품의 다른 투어에 수동 배정된 상태는 유지한다.
 */
async function removeReservationFromToursNotMatchingSlot(
  reservationId: string,
  targetProductId: string,
  targetTourDate: string
): Promise<void> {
  const rid = String(reservationId).trim()
  if (!rid) return

  const targetP = String(targetProductId ?? '').trim()
  const targetD = normalizeTourDateForSlot(targetTourDate)

  const { data: tours, error } = await supabase
    .from('tours')
    .select('id, product_id, tour_date, reservation_ids')
    .contains('reservation_ids', [rid])

  if (error || !tours?.length) {
    if (error) console.error('removeReservationFromToursNotMatchingSlot:', error)
    return
  }

  for (const tour of tours) {
    const row = tour as {
      id: string
      product_id?: string | null
      tour_date?: string | null
      reservation_ids?: unknown
    }
    const tp = String(row.product_id ?? '').trim()
    const td = normalizeTourDateForSlot(row.tour_date)
    if (tp === targetP && td === targetD) continue

    const ids = Array.isArray(row.reservation_ids)
      ? row.reservation_ids.map((x: unknown) => String(x).trim()).filter(Boolean)
      : []
    if (!ids.includes(rid)) continue

    const next = ids.filter((id) => id !== rid)
    const { error: upErr } = await supabase
      .from('tours')
      .update({ reservation_ids: next } as any)
      .eq('id', row.id)
    if (upErr) console.error('removeReservationFromToursNotMatchingSlot tour update:', upErr)
  }
}

export type ReservationUpdatePayload = Omit<Reservation, 'id'> & {
  pricingInfo?: Record<string, unknown>
  customerLanguage?: string
  variantKey?: string
  selectedChoices?: Array<{ choice_id: string; option_id: string; quantity?: number; total_price?: number }>
  usResidentCount?: number
  nonResidentCount?: number
  nonResidentWithPassCount?: number
  nonResidentUnder16Count?: number
  passCoveredCount?: number
}

export interface UpdateReservationResult {
  success: boolean
  error?: string
}

/**
 * 단일 예약 수정: reservations, choices, reservation_customers, customer language, reservation_pricing, 투어 자동 생성
 */
export async function updateReservation(
  reservationId: string,
  payload: ReservationUpdatePayload
): Promise<UpdateReservationResult> {
  try {
    const { data: existingReservation, error: existingErr } = await supabase
      .from('reservations')
      .select('product_id, tour_date')
      .eq('id', reservationId)
      .maybeSingle()

    if (existingErr || !existingReservation) {
      return { success: false, error: existingErr?.message || '예약을 찾을 수 없습니다.' }
    }

    const oldP = String((existingReservation as { product_id?: string | null }).product_id ?? '').trim()
    const oldD = normalizeTourDateForSlot((existingReservation as { tour_date?: string | null }).tour_date)
    const newP = String(payload.productId ?? '').trim()
    const newD = normalizeTourDateForSlot(payload.tourDate)
    const slotChanged = oldP !== newP || oldD !== newD

    if (slotChanged) {
      await removeReservationFromToursNotMatchingSlot(reservationId, newP, newD)
    }

    const reservationData = {
      customer_id: payload.customerId,
      product_id: payload.productId,
      tour_date: payload.tourDate,
      tour_time: payload.tourTime || null,
      event_note: payload.eventNote,
      pickup_hotel: payload.pickUpHotel,
      pickup_time: payload.pickUpTime || null,
      adults: payload.adults,
      child: payload.child,
      infant: payload.infant,
      total_people: payload.totalPeople,
      channel_id: payload.channelId,
      channel_rn: payload.channelRN,
      added_by: payload.addedBy,
      tour_id: slotChanged ? null : payload.tourId,
      status: payload.status,
      selected_options: payload.selectedOptions,
      selected_option_prices: payload.selectedOptionPrices,
      is_private_tour: payload.isPrivateTour || false,
      choices: payload.choices,
      variant_key: payload.variantKey ?? 'default',
    }

    const { error } = await (supabase as any)
      .from('reservations')
      .update(reservationData as any)
      .eq('id', reservationId)

    if (error) {
      return { success: false, error: error.message }
    }

    // reservation_choices: selectedChoices 우선, 없으면 choices.required
    await supabase.from('reservation_choices').delete().eq('reservation_id', reservationId)

    let choicesToSave: Array<{
      reservation_id: string
      choice_id: string
      option_id: string
      quantity: number
      total_price: number
    }> = []

    if (payload.selectedChoices && Array.isArray(payload.selectedChoices) && payload.selectedChoices.length > 0) {
      for (const choice of payload.selectedChoices) {
        if (choice.choice_id && choice.option_id && choice.option_id !== UNDECIDED_OPTION_ID) {
          choicesToSave.push({
            reservation_id: reservationId,
            choice_id: choice.choice_id,
            option_id: choice.option_id,
            quantity: choice.quantity ?? 1,
            total_price: choice.total_price !== undefined && choice.total_price !== null ? Number(choice.total_price) : 0,
          })
        }
      }
    } else if (payload.choices?.required && Array.isArray(payload.choices.required)) {
      for (const choice of payload.choices.required as Array<{ choice_id: string; option_id: string; quantity?: number; total_price?: number }>) {
        if (choice.choice_id && choice.option_id && choice.option_id !== UNDECIDED_OPTION_ID) {
          choicesToSave.push({
            reservation_id: reservationId,
            choice_id: choice.choice_id,
            option_id: choice.option_id,
            quantity: choice.quantity ?? 1,
            total_price: choice.total_price ?? 0,
          })
        }
      }
    }

    if (choicesToSave.length > 0) {
      const { error: choicesError } = await (supabase as any)
        .from('reservation_choices')
        .insert(choicesToSave)
      if (choicesError) {
        return { success: false, error: '초이스 저장: ' + choicesError.message }
      }
    }

    // reservation_customers (거주 상태별 인원)
    await supabase.from('reservation_customers').delete().eq('reservation_id', reservationId)

    const usResidentCount = payload.usResidentCount ?? 0
    const nonResidentCount = payload.nonResidentCount ?? 0
    const nonResidentUnder16Count = payload.nonResidentUnder16Count ?? 0
    const nonResidentWithPassCount = payload.nonResidentWithPassCount ?? 0
    const reservationCustomers: Array<{
      reservation_id: string
      customer_id: string
      resident_status: string
      pass_covered_count: number
      order_index: number
    }> = []
    let orderIndex = 0

    for (let i = 0; i < usResidentCount; i++) {
      reservationCustomers.push({
        reservation_id: reservationId,
        customer_id: payload.customerId,
        resident_status: 'us_resident',
        pass_covered_count: 0,
        order_index: orderIndex++,
      })
    }
    for (let i = 0; i < nonResidentCount; i++) {
      reservationCustomers.push({
        reservation_id: reservationId,
        customer_id: payload.customerId,
        resident_status: 'non_resident',
        pass_covered_count: 0,
        order_index: orderIndex++,
      })
    }
    for (let i = 0; i < nonResidentUnder16Count; i++) {
      reservationCustomers.push({
        reservation_id: reservationId,
        customer_id: payload.customerId,
        resident_status: 'non_resident_under_16',
        pass_covered_count: 0,
        order_index: orderIndex++,
      })
    }
    for (let i = 0; i < nonResidentWithPassCount; i++) {
      reservationCustomers.push({
        reservation_id: reservationId,
        customer_id: payload.customerId,
        resident_status: 'non_resident_with_pass',
        pass_covered_count: 4,
        order_index: orderIndex++,
      })
    }
    if (reservationCustomers.length > 0) {
      await supabase.from('reservation_customers').insert(reservationCustomers as any)
    }

    // 고객 언어 업데이트
    if (payload.customerLanguage != null && payload.customerLanguage !== '' && payload.customerId) {
      await supabase
        .from('customers')
        .update({ language: payload.customerLanguage })
        .eq('id', payload.customerId)
    }

    // reservation_pricing
    const pricingInfo = payload.pricingInfo as Record<string, unknown> | undefined
    if (pricingInfo) {
      const totalPeople = (payload.adults || 0) + (payload.child || 0) + (payload.infant || 0)
      const notIncludedTotal = toNum(pricingInfo.not_included_price) * (totalPeople || 1)

      const { data: existingRow } = await supabase
        .from('reservation_pricing')
        .select(
          'id, adult_product_price, child_product_price, infant_product_price, product_price_total, not_included_price, subtotal, total_price, choices_total, option_total, required_option_total, refund_reason, refund_amount, card_fee, tax, prepayment_cost, prepayment_tip, deposit_amount, balance_amount, commission_percent, commission_amount, commission_base_price'
        )
        .eq('reservation_id', reservationId)
        .maybeSingle()

      // 업데이트 시: 가격이 0이면 기존 DB 값을 유지 (의도치 않은 0 덮어쓰기 방지)
      const keep = (newVal: number, existingVal: unknown) =>
        existingRow && newVal === 0 && (toNum(existingVal) || 0) > 0 ? toNum(existingVal) : newVal

      const newAdult = toNum(pricingInfo.adultProductPrice)
      const newChild = toNum(pricingInfo.childProductPrice)
      const newInfant = toNum(pricingInfo.infantProductPrice)
      const newProductTotal = toNum(pricingInfo.productPriceTotal) + notIncludedTotal
      const newNotIncluded = toNum(pricingInfo.not_included_price)
      const newSubtotal = toNum(pricingInfo.subtotal) + notIncludedTotal
      const newTotal = toNum(pricingInfo.totalPrice) + notIncludedTotal
      const newChoicesTotal = toNum(pricingInfo.choicesTotal)
      const newOptionTotal = toNum(pricingInfo.optionTotal)
      const newRequiredOptionTotal = toNum(pricingInfo.requiredOptionTotal)

      // savePricingInfo와 동일: 채널 정산 산식용 상품 합계(불포함 × 청구 인원)
      const pricingAdultsVal = Math.max(
        0,
        Math.floor(toNum(pricingInfo.pricingAdults ?? pricingInfo.pricing_adults ?? payload.adults))
      )
      const billingPaxForSettlement = pricingAdultsVal + (payload.child || 0) + (payload.infant || 0)
      const notIncludedForSettlement = toNum(pricingInfo.not_included_price) * (billingPaxForSettlement || 1)
      const productTotalForChannelSettlement = toNum(pricingInfo.productPriceTotal) + notIncludedForSettlement

      let returnedAmount = 0
      let partnerReceivedAmount = 0
      try {
        const { data: payRows } = await (supabase as any)
          .from('payment_records')
          .select('amount, payment_status')
          .eq('reservation_id', reservationId)
        ;(payRows || []).forEach((row: { payment_status?: string; amount?: number }) => {
          const status = row.payment_status || ''
          const sl = status.toLowerCase()
          if (status === 'Partner Received') {
            partnerReceivedAmount += Number(row.amount) || 0
          }
          if (status.includes('Returned') || sl === 'returned') {
            returnedAmount += Number(row.amount) || 0
          }
        })
      } catch {
        returnedAmount = 0
        partnerReceivedAmount = 0
      }

      let isOTAChannel = false
      try {
        if (payload.channelId) {
          const { data: chRow } = await (supabase as any)
            .from('channels')
            .select('type, category')
            .eq('id', payload.channelId)
            .maybeSingle()
          if (chRow) {
            isOTAChannel =
              String((chRow as { type?: string }).type || '').toLowerCase() === 'ota' ||
              (chRow as { category?: string }).category === 'OTA'
          }
        }
      } catch {
        isOTAChannel = false
      }

      const storedCb =
        toNum(pricingInfo.commission_base_price) ||
        toNum(pricingInfo.commissionBasePrice) ||
        toNum((existingRow as { commission_base_price?: number } | null)?.commission_base_price)

      const commissionGross =
        toNum(pricingInfo.onlinePaymentAmount) ||
        toNum(pricingInfo.depositAmount) ||
        deriveCommissionGrossForSettlement(storedCb, {
          returnedAmount,
          depositAmount: toNum(pricingInfo.depositAmount),
          productPriceTotal: productTotalForChannelSettlement,
          isOTAChannel,
        }) ||
        storedCb

      const channelSettlementComputeInput = {
        depositAmount: toNum(pricingInfo.depositAmount),
        onlinePaymentAmount: commissionGross,
        productPriceTotal: productTotalForChannelSettlement,
        couponDiscount: toNum(pricingInfo.couponDiscount),
        additionalDiscount: toNum(pricingInfo.additionalDiscount),
        optionTotalSum: newOptionTotal,
        additionalCost: toNum(pricingInfo.additionalCost),
        tax: toNum(pricingInfo.tax),
        cardFee: toNum(pricingInfo.cardFee ?? (pricingInfo as { card_fee?: unknown }).card_fee),
        prepaymentTip: toNum(pricingInfo.prepaymentTip),
        onSiteBalanceAmount: toNum(pricingInfo.balanceAmount),
        returnedAmount,
        partnerReceivedAmount,
        commissionAmount: toNum(pricingInfo.commission_amount),
        reservationStatus: payload.status,
        isOTAChannel,
      }

      const channelPayNet = computeChannelPaymentAfterReturn(channelSettlementComputeInput)
      const channelSettlementComputed = computeChannelSettlementAmount(channelSettlementComputeInput)

      // DB에 저장할 컬럼을 모두 명시 (card_fee, balance_amount, commission_amount 등 누락 방지)
      const pricingData = {
        reservation_id: reservationId,
        adult_product_price: keep(newAdult, existingRow?.adult_product_price),
        child_product_price: keep(newChild, existingRow?.child_product_price),
        infant_product_price: keep(newInfant, existingRow?.infant_product_price),
        product_price_total: keep(newProductTotal, existingRow?.product_price_total),
        not_included_price: keep(newNotIncluded, existingRow?.not_included_price),
        required_options: pricingInfo.requiredOptions ?? {},
        required_option_total: keep(newRequiredOptionTotal, existingRow?.required_option_total),
        choices: pricingInfo.choices ?? {},
        choices_total: keep(newChoicesTotal, existingRow?.choices_total),
        subtotal: keep(newSubtotal, existingRow?.subtotal),
        coupon_code: pricingInfo.couponCode ?? '',
        coupon_discount: toNum(pricingInfo.couponDiscount),
        additional_discount: toNum(pricingInfo.additionalDiscount),
        additional_cost: toNum(pricingInfo.additionalCost),
        refund_reason: String(pricingInfo.refundReason ?? '').trim() || null,
        refund_amount: toNum(pricingInfo.refundAmount),
        card_fee: keep(toNum(pricingInfo.cardFee ?? (pricingInfo as any).card_fee), existingRow?.card_fee),
        tax: keep(toNum(pricingInfo.tax), existingRow?.tax),
        prepayment_cost: keep(toNum(pricingInfo.prepaymentCost), existingRow?.prepayment_cost),
        prepayment_tip: keep(toNum(pricingInfo.prepaymentTip), existingRow?.prepayment_tip),
        selected_options: pricingInfo.selectedOptionalOptions ?? {},
        option_total: keep(newOptionTotal, existingRow?.option_total),
        total_price: keep(newTotal, existingRow?.total_price),
        deposit_amount: toNum(pricingInfo.depositAmount),
        balance_amount: toNum(pricingInfo.balanceAmount),
        private_tour_additional_cost: toNum(pricingInfo.privateTourAdditionalCost),
        commission_percent: toNum(pricingInfo.commission_percent),
        commission_amount: keep(toNum(pricingInfo.commission_amount), existingRow?.commission_amount),
        pricing_adults: pricingAdultsVal,
        commission_base_price: keep(
          Math.round(channelPayNet * 100) / 100,
          (existingRow as { commission_base_price?: number } | null)?.commission_base_price
        ),
        channel_settlement_amount: Math.round(channelSettlementComputed * 100) / 100,
      }

      if (existingRow?.id) {
        const { error: pricingUpdateError } = await supabase
          .from('reservation_pricing')
          .update(pricingData as any)
          .eq('id', existingRow.id)
        if (pricingUpdateError) {
          return { success: false, error: '가격 정보: ' + pricingUpdateError.message }
        }
      } else {
        const { error: pricingInsertError } = await supabase
          .from('reservation_pricing')
          .insert({ ...pricingData, id: crypto.randomUUID() } as any)
        if (pricingInsertError) {
          return { success: false, error: '가격 정보(신규): ' + pricingInsertError.message }
        }
      }
    }

    // 투어 자동 생성/업데이트 (실패해도 예약 수정 성공으로 처리)
    try {
      await autoCreateOrUpdateTour(
        payload.productId,
        payload.tourDate,
        reservationId,
        payload.isPrivateTour
      )
    } catch {
      // 무시
    }

    return { success: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { success: false, error: message }
  }
}
