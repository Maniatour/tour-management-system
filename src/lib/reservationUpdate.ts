/**
 * 예약 수정 공통 로직 (예약 목록 모달 + 예약 상세 페이지 동일 적용)
 * - reservations 업데이트, reservation_choices, reservation_customers, 고객 언어, reservation_pricing, 투어 자동 생성
 */
import { supabase } from './supabase'
import { autoCreateOrUpdateTour } from './tourAutoCreation'
import type { Reservation } from '@/types/reservation'

const UNDECIDED_OPTION_ID = '__undecided__'
const toNum = (v: unknown) => (v !== null && v !== undefined && v !== '' ? Number(v) : 0)

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
      tour_id: payload.tourId,
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
      const pricingData = {
        reservation_id: reservationId,
        adult_product_price: toNum(pricingInfo.adultProductPrice),
        child_product_price: toNum(pricingInfo.childProductPrice),
        infant_product_price: toNum(pricingInfo.infantProductPrice),
        product_price_total: toNum(pricingInfo.productPriceTotal) + notIncludedTotal,
        not_included_price: toNum(pricingInfo.not_included_price),
        required_options: pricingInfo.requiredOptions ?? {},
        required_option_total: toNum(pricingInfo.requiredOptionTotal),
        choices: pricingInfo.choices ?? {},
        choices_total: toNum(pricingInfo.choicesTotal),
        subtotal: toNum(pricingInfo.subtotal) + notIncludedTotal,
        coupon_code: pricingInfo.couponCode ?? '',
        coupon_discount: toNum(pricingInfo.couponDiscount),
        additional_discount: toNum(pricingInfo.additionalDiscount),
        additional_cost: toNum(pricingInfo.additionalCost),
        card_fee: toNum(pricingInfo.cardFee ?? (pricingInfo as any).card_fee),
        tax: toNum(pricingInfo.tax),
        prepayment_cost: toNum(pricingInfo.prepaymentCost),
        prepayment_tip: toNum(pricingInfo.prepaymentTip),
        selected_options: pricingInfo.selectedOptionalOptions ?? {},
        option_total: toNum(pricingInfo.optionTotal),
        total_price: toNum(pricingInfo.totalPrice) + notIncludedTotal,
        deposit_amount: toNum(pricingInfo.depositAmount),
        balance_amount: toNum(pricingInfo.balanceAmount),
        private_tour_additional_cost: toNum(pricingInfo.privateTourAdditionalCost),
        commission_percent: toNum(pricingInfo.commission_percent),
        commission_amount: toNum(pricingInfo.commission_amount),
      }

      const { data: existingPricing } = await supabase
        .from('reservation_pricing')
        .select('id')
        .eq('reservation_id', reservationId)
        .maybeSingle()

      if (existingPricing?.id) {
        await supabase
          .from('reservation_pricing')
          .update(pricingData as any)
          .eq('id', existingPricing.id)
      } else {
        await supabase
          .from('reservation_pricing')
          .insert({ ...pricingData, id: crypto.randomUUID() } as any)
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
