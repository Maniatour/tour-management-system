import { supabase } from '@/lib/supabase'
import { generateReservationId } from '@/lib/entityIds'
import { DATE_CHANGED_RESERVATION_STATUS, isDateChangedReservationStatus } from '@/lib/reservationStatus'
import { updateReservationTourSlot } from '@/lib/reservationUpdate'
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'

export type ApplyNoShowDateChangeInput = {
  liveReservationId: string
  newTourDate: string
  additionalCostUsd: number
  note?: string | null
}

export type ApplyNoShowDateChangeResult =
  | {
      success: true
      liveReservationId: string
      placeholderReservationId: string
      oldTourDate: string
      newTourDate: string
    }
  | { success: false; error: string }

function ymd(raw: unknown): string {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  return s.includes('T') ? s.split('T')[0]! : s.slice(0, 10)
}

function roundUsd2(n: number): number {
  return Math.round(n * 100) / 100
}

function appendEventNote(existing: string | null | undefined, addition: string): string {
  const prev = String(existing ?? '').trim()
  return prev ? `${prev}\n${addition}` : addition
}

function nextCheckInExclusive(ymdDate: string): string {
  const [y, m, d] = ymdDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1))
  dt.setUTCDate(dt.getUTCDate() + 1)
  return dt.toISOString().slice(0, 10)
}

export async function applyNoShowDateChange(
  input: ApplyNoShowDateChangeInput
): Promise<ApplyNoShowDateChangeResult> {
  const liveId = String(input.liveReservationId ?? '').trim()
  const newTourDate = ymd(input.newTourDate)
  const extra = roundUsd2(Math.max(0, Number(input.additionalCostUsd) || 0))
  const extraNote = String(input.note ?? '').trim()

  if (!liveId) return { success: false, error: '예약 ID가 없습니다.' }
  if (!newTourDate) return { success: false, error: '새 투어 날짜가 필요합니다.' }

  const { data: live, error: liveErr } = await supabase
    .from('reservations')
    .select('*')
    .eq('id', liveId)
    .maybeSingle()

  if (liveErr || !live) {
    return { success: false, error: liveErr?.message || '예약을 찾을 수 없습니다.' }
  }

  const row = live as Record<string, unknown>
  const status = String(row.status ?? '').toLowerCase().trim()
  if (isDateChangedReservationStatus(status)) {
    return { success: false, error: '자리표시(날짜변경) 예약에서는 다시 날짜 변경할 수 없습니다. 실예약을 열어 주세요.' }
  }
  if (status === 'cancelled' || status === 'canceled' || status === 'deleted') {
    return { success: false, error: '취소·삭제된 예약은 날짜 변경할 수 없습니다.' }
  }

  const existingPlaceholder = String(row.date_change_placeholder_reservation_id ?? '').trim()
  if (existingPlaceholder) {
    return { success: false, error: '이미 날짜 변경된 예약입니다. 자리표시 예약에서 실예약을 열어 확인해 주세요.' }
  }

  const oldTourDate = ymd(row.tour_date)
  if (!oldTourDate) return { success: false, error: '기존 투어 날짜가 없습니다.' }
  if (oldTourDate === newTourDate) {
    return { success: false, error: '같은 날짜로는 변경할 수 없습니다.' }
  }

  const productId = String(row.product_id ?? '').trim()
  const channelId = String(row.channel_id ?? '').trim()
  if (!productId) return { success: false, error: '상품이 없는 예약은 날짜 변경할 수 없습니다.' }
  if (!channelId) return { success: false, error: '채널이 없는 예약은 날짜 변경할 수 없습니다.' }

  const placeholderId = generateReservationId()
  const nowIso = new Date().toISOString()
  const operatorId = String(row.operator_id ?? '').trim() || KOVEgAS_OPERATOR_ID
  const people = Number(row.total_people) || 0
  const adults = Number(row.adults) || 0
  const child = Number(row.child) || 0
  const infant = Number(row.infant) || 0
  const channelRn = String(row.channel_rn ?? '').trim()

  const liveNoteLine = [
    `[노쇼 날짜 변경] ${oldTourDate} → ${newTourDate}.`,
    extra > 0 ? `고객 추가 청구 $${extra.toFixed(2)} (입장권/processing, 채널 정산 금액 유지).` : '추가 청구 $0.',
    `구날짜 자리표시 ${placeholderId}.`,
    extraNote || '',
  ]
    .filter(Boolean)
    .join(' ')

  const placeholderNoteLine = [
    `[노쇼 날짜 변경 자리표시] ${oldTourDate} 앤텔롭 티켓 대조용. 금액 $0. 투어 미배정.`,
    `실예약 ${liveId} (${newTourDate}${channelRn ? `, RN ${channelRn}` : ''}).`,
    extraNote || '',
  ]
    .filter(Boolean)
    .join(' ')

  const placeholderInsert = {
    id: placeholderId,
    customer_id: row.customer_id ?? null,
    product_id: productId,
    tour_date: oldTourDate,
    tour_time: row.tour_time ?? null,
    event_note: placeholderNoteLine,
    pickup_hotel: null,
    pickup_time: null,
    adults,
    child,
    infant,
    total_people: people,
    channel_id: channelId,
    variant_key: String(row.variant_key ?? 'default') || 'default',
    channel_rn: null,
    added_by: row.added_by ?? null,
    created_at: nowIso,
    updated_at: nowIso,
    tour_id: null,
    status: DATE_CHANGED_RESERVATION_STATUS,
    selected_options: row.selected_options ?? null,
    selected_option_prices: {},
    selected_choices: row.selected_choices ?? null,
    choices: row.choices ?? null,
    canyon_choice: row.canyon_choice ?? null,
    customer_communication_channel: row.customer_communication_channel ?? null,
    is_private_tour: row.is_private_tour ?? false,
    operator_id: operatorId,
    archive: false,
    date_change_live_reservation_id: liveId,
    date_change_placeholder_reservation_id: null,
  }

  const { error: phErr } = await supabase.from('reservations').insert(placeholderInsert as never)
  if (phErr) {
    return { success: false, error: `자리표시 예약 생성 실패: ${phErr.message}` }
  }

  try {
    const { data: choiceRows } = await supabase
      .from('reservation_choices')
      .select(
        'choice_id, option_id, option_key, quantity, canyon_key, canonical_option_key, choice_group'
      )
      .eq('reservation_id', liveId)

    if (choiceRows && choiceRows.length > 0) {
      const copied = choiceRows.map((c) => ({
        reservation_id: placeholderId,
        choice_id: c.choice_id,
        option_id: c.option_id,
        option_key: c.option_key,
        quantity: c.quantity,
        canyon_key: c.canyon_key,
        canonical_option_key: c.canonical_option_key,
        choice_group: c.choice_group,
        total_price: 0,
      }))
      const { error: chErr } = await supabase.from('reservation_choices').insert(copied as never)
      if (chErr) {
        throw new Error(`초이스 복사 실패: ${chErr.message}`)
      }
    }

    const { data: custRows } = await supabase
      .from('reservation_customers')
      .select(
        'customer_id, email, name, name_en, name_ko, order_index, phone, resident_status, pass_covered_count'
      )
      .eq('reservation_id', liveId)

    if (custRows && custRows.length > 0) {
      const copiedCust = custRows.map((c) => ({
        ...c,
        reservation_id: placeholderId,
      }))
      const { error: cuErr } = await supabase.from('reservation_customers').insert(copiedCust as never)
      if (cuErr) {
        console.warn('[no-show date change] reservation_customers 복사 경고:', cuErr.message)
      }
    }

    const { error: priceErr } = await supabase.from('reservation_pricing').insert({
      id: crypto.randomUUID(),
      reservation_id: placeholderId,
      additional_cost: 0,
      additional_discount: 0,
      adult_product_price: 0,
      child_product_price: 0,
      infant_product_price: 0,
      product_price_total: 0,
      required_option_total: 0,
      subtotal: 0,
      coupon_discount: 0,
      card_fee: 0,
      tax: 0,
      prepayment_cost: 0,
      prepayment_tip: 0,
      private_tour_additional_cost: 0,
      option_total: 0,
      choices_total: 0,
      not_included_price: 0,
      deposit_amount: 0,
      balance_amount: 0,
      refund_amount: 0,
      commission_amount: 0,
      commission_percent: 0,
      commission_base_price: 0,
      channel_settlement_amount: 0,
      company_total_revenue: 0,
      operating_profit: 0,
      total_price: 0,
    } as never)
    if (priceErr) {
      console.warn('[no-show date change] 자리표시 가격 $0 저장 경고:', priceErr.message)
    }

    const { data: livePricing } = await supabase
      .from('reservation_pricing')
      .select('id, additional_cost, total_price, balance_amount, company_total_revenue')
      .eq('reservation_id', liveId)
      .maybeSingle()

    if (livePricing && extra > 0) {
      const { error: livePriceErr } = await supabase
        .from('reservation_pricing')
        .update({
          additional_cost: roundUsd2(Number(livePricing.additional_cost ?? 0) + extra),
          total_price: roundUsd2(Number(livePricing.total_price ?? 0) + extra),
          balance_amount: roundUsd2(Number(livePricing.balance_amount ?? 0) + extra),
          company_total_revenue: roundUsd2(Number(livePricing.company_total_revenue ?? 0) + extra),
          updated_at: nowIso,
        } as never)
        .eq('id', livePricing.id)
      if (livePriceErr) {
        throw new Error(`추가비용 반영 실패: ${livePriceErr.message}`)
      }
    }

    const slot = await updateReservationTourSlot(liveId, { tourDate: newTourDate })
    if (!slot.success) {
      throw new Error(slot.error || '실예약 날짜 이동에 실패했습니다.')
    }

    const { data: liveAfterSlot } = await supabase
      .from('reservations')
      .select('event_note')
      .eq('id', liveId)
      .maybeSingle()

    const { error: liveUpErr } = await supabase
      .from('reservations')
      .update({
        event_note: appendEventNote(String(liveAfterSlot?.event_note ?? row.event_note ?? ''), liveNoteLine),
        date_change_placeholder_reservation_id: placeholderId,
        updated_at: nowIso,
      } as never)
      .eq('id', liveId)
    if (liveUpErr) {
      throw new Error(`실예약 메모 저장 실패: ${liveUpErr.message}`)
    }

    const { error: ticketErr } = await supabase
      .from('ticket_bookings')
      .update({ reservation_id: placeholderId } as never)
      .eq('reservation_id', liveId)
      .gte('check_in_date', oldTourDate)
      .lt('check_in_date', nextCheckInExclusive(oldTourDate))
    if (ticketErr) {
      console.warn('[no-show date change] 15일 티켓 재연결 경고:', ticketErr.message)
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await supabase.from('reservations').delete().eq('id', placeholderId)
    return { success: false, error: message }
  }

  return {
    success: true,
    liveReservationId: liveId,
    placeholderReservationId: placeholderId,
    oldTourDate,
    newTourDate,
  }
}
