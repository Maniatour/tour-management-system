import type { SupabaseClient } from '@supabase/supabase-js'
import { syncReservationPricingAggregates } from '@/lib/syncReservationPricingAggregates'
import {
  computeCustomerPaymentTotalLineFormula,
  computeRemainingBalanceAfterPaymentRecords,
  customerRefundCreditAgainstDue,
  summarizePaymentRecordsForBalance,
  type PartySizeSource,
  type PaymentRecordLike,
} from '@/utils/reservationPricingBalance'
import { roundUsd2 } from '@/utils/pricingSectionDisplay'
import {
  buildResidentChoiceRowsFromLineState,
  computePassCoveredCount,
  emptyResidentStatusAmounts,
  findUsResidentClassificationChoice,
  mergeResidentRowsIntoSelectedChoices,
  parseResidentLineStateFromSelections,
  selectedChoiceRowsFromReservationPricingChoices,
  sumResidentFeeAmountsUsd,
  type ResidentLineKey,
  type ResidentLineState,
} from '@/utils/usResidentChoiceSync'

export type ResidentStatusCountsInput = {
  usResident: number
  nonResident: number
  nonResidentUnder16: number
  nonResidentWithPass: number
  residentStatusAmounts: Partial<Record<ResidentLineKey, number>>
}

function computeBalanceWithResidentFees(
  pricing: Record<string, unknown>,
  party: PartySizeSource,
  records: PaymentRecordLike[],
  residentFeesUsd: number
): { totalCustomerPaymentNet: number; balanceAmount: number; totalPriceGross: number } {
  const grossDue = roundUsd2(
    computeCustomerPaymentTotalLineFormula(
      pricing as Parameters<typeof computeCustomerPaymentTotalLineFormula>[0],
      party
    ) + residentFeesUsd
  )
  const { depositTotalNet, balanceReceivedTotal, returnedTotal, refundedTotal } =
    summarizePaymentRecordsForBalance(records)
  const manualRefund = Math.max(0, Number(pricing.refund_amount) || 0)
  const returnedSurplus = Math.max(0, roundUsd2(returnedTotal - manualRefund))
  const totalCustomerPayment = Math.max(0, roundUsd2(grossDue - returnedSurplus))
  const refundCredit = customerRefundCreditAgainstDue({ refundedTotal }, manualRefund)
  return {
    totalCustomerPaymentNet: totalCustomerPayment,
    balanceAmount: computeRemainingBalanceAfterPaymentRecords(
      totalCustomerPayment,
      depositTotalNet,
      balanceReceivedTotal,
      refundCredit
    ),
    totalPriceGross: grossDue,
  }
}

export async function saveResidentStatusWithPricing(
  supabase: SupabaseClient,
  reservationId: string,
  customerId: string | null,
  totalPeople: number,
  counts: ResidentStatusCountsInput
): Promise<{ ok: boolean; error?: string }> {
  const passCount = counts.nonResidentWithPass
  const passCovered = computePassCoveredCount(
    passCount,
    counts.usResident,
    counts.nonResident,
    counts.nonResidentUnder16,
    totalPeople
  )
  const statusTotal =
    counts.usResident + counts.nonResident + counts.nonResidentUnder16 + passCovered
  if (statusTotal !== totalPeople) {
    return { ok: false, error: 'RESIDENT_COUNT_MISMATCH' }
  }

  const { error: deleteErr } = await supabase
    .from('reservation_customers')
    .delete()
    .eq('reservation_id', reservationId)
  if (deleteErr) {
    return { ok: false, error: deleteErr.message }
  }

  const reservationCustomers: Array<{
    reservation_id: string
    customer_id: string | null
    resident_status: string
    pass_covered_count: number
    order_index: number
  }> = []
  let orderIndex = 0

  for (let i = 0; i < counts.usResident; i++) {
    reservationCustomers.push({
      reservation_id: reservationId,
      customer_id: customerId,
      resident_status: 'us_resident',
      pass_covered_count: 0,
      order_index: orderIndex++,
    })
  }
  for (let i = 0; i < counts.nonResident; i++) {
    reservationCustomers.push({
      reservation_id: reservationId,
      customer_id: customerId,
      resident_status: 'non_resident',
      pass_covered_count: 0,
      order_index: orderIndex++,
    })
  }
  for (let i = 0; i < counts.nonResidentUnder16; i++) {
    reservationCustomers.push({
      reservation_id: reservationId,
      customer_id: customerId,
      resident_status: 'non_resident_under_16',
      pass_covered_count: 0,
      order_index: orderIndex++,
    })
  }
  for (let i = 0; i < passCount; i++) {
    reservationCustomers.push({
      reservation_id: reservationId,
      customer_id: customerId,
      resident_status: 'non_resident_with_pass',
      pass_covered_count: 4,
      order_index: orderIndex++,
    })
  }

  if (reservationCustomers.length > 0) {
    const { error: insertErr } = await supabase
      .from('reservation_customers')
      .insert(reservationCustomers)
    if (insertErr) {
      return { ok: false, error: insertErr.message }
    }
  }

  const { data: reservation, error: resErr } = await supabase
    .from('reservations')
    .select('product_id, adults, child, infant')
    .eq('id', reservationId)
    .maybeSingle()
  if (resErr || !reservation?.product_id) {
    return { ok: true }
  }

  const { data: pricing, error: pricingErr } = await supabase
    .from('reservation_pricing')
    .select('*')
    .eq('reservation_id', reservationId)
    .maybeSingle()
  if (pricingErr || !pricing?.id) {
    return { ok: true }
  }

  const { data: productChoices, error: choicesErr } = await supabase
    .from('product_choices')
    .select(
      'id, choice_group_ko, choice_group, options:choice_options(id, option_name_ko, option_name, option_key)'
    )
    .eq('product_id', reservation.product_id)
  if (choicesErr) {
    return { ok: false, error: choicesErr.message }
  }

  const residentChoice = findUsResidentClassificationChoice(productChoices || [])
  const amounts = { ...emptyResidentStatusAmounts(), ...counts.residentStatusAmounts }
  const residentState: ResidentLineState = {
    undecidedResidentCount: 0,
    usResidentCount: counts.usResident,
    nonResidentCount: counts.nonResident,
    nonResidentUnder16Count: counts.nonResidentUnder16,
    nonResidentWithPassCount: counts.nonResidentWithPass,
    nonResidentPurchasePassCount: 0,
    residentStatusAmounts: amounts,
  }

  let choicesJson: { required: Array<Record<string, unknown>> } = { required: [] }
  if (pricing.choices && typeof pricing.choices === 'object') {
    const raw = pricing.choices as { required?: Array<Record<string, unknown>> }
    choicesJson = { required: Array.isArray(raw.required) ? [...raw.required] : [] }
  }

  if (residentChoice) {
    const existingRows = selectedChoiceRowsFromReservationPricingChoices(pricing.choices)
    const residentRows = buildResidentChoiceRowsFromLineState(residentChoice, residentState, false)
    const { selectedChoices, choicesTotal } = mergeResidentRowsIntoSelectedChoices(
      productChoices || [],
      existingRows,
      residentRows
    )
    choicesJson = {
      required: selectedChoices.map((row) => ({
        choice_id: row.choice_id,
        option_id: row.option_id,
        quantity: row.quantity ?? 1,
        total_price: row.total_price ?? 0,
        ...(row.option_name_ko != null && row.option_name_ko !== ''
          ? { option_name_ko: row.option_name_ko }
          : {}),
        ...(row.option_key != null && row.option_key !== ''
          ? { option_key: row.option_key }
          : {}),
      })),
    }

    const residentFeesUsd = sumResidentFeeAmountsUsd(amounts)
    const party: PartySizeSource = {
      adults: reservation.adults ?? 0,
      child: reservation.child ?? 0,
      infant: reservation.infant ?? 0,
    }

    const { data: payRows } = await supabase
      .from('payment_records')
      .select('payment_status, amount')
      .eq('reservation_id', reservationId)
    const records: PaymentRecordLike[] = (payRows || []).map((r) => ({
      payment_status: String(r.payment_status || ''),
      amount: Number(r.amount) || 0,
    }))

    const { balanceAmount, totalPriceGross } = computeBalanceWithResidentFees(
      pricing as Record<string, unknown>,
      party,
      records,
      residentFeesUsd
    )

    const { error: updateErr } = await supabase
      .from('reservation_pricing')
      .update({
        choices: choicesJson,
        choices_total: choicesTotal,
        total_price: totalPriceGross,
        balance_amount: balanceAmount,
      })
      .eq('id', pricing.id)
    if (updateErr) {
      return { ok: false, error: updateErr.message }
    }
  } else {
    const parsed = parseResidentLineStateFromSelections(productChoices || [], choicesJson.required as never[])
    if (parsed) {
      const residentFeesUsd = sumResidentFeeAmountsUsd(amounts)
      const party: PartySizeSource = {
        adults: reservation.adults ?? 0,
        child: reservation.child ?? 0,
        infant: reservation.infant ?? 0,
      }
      const { data: payRows } = await supabase
        .from('payment_records')
        .select('payment_status, amount')
        .eq('reservation_id', reservationId)
      const records: PaymentRecordLike[] = (payRows || []).map((r) => ({
        payment_status: String(r.payment_status || ''),
        amount: Number(r.amount) || 0,
      }))
      const { balanceAmount, totalPriceGross } = computeBalanceWithResidentFees(
        pricing as Record<string, unknown>,
        party,
        records,
        residentFeesUsd
      )
      const { error: updateErr } = await supabase
        .from('reservation_pricing')
        .update({
          total_price: totalPriceGross,
          balance_amount: balanceAmount,
        })
        .eq('id', pricing.id)
      if (updateErr) {
        return { ok: false, error: updateErr.message }
      }
    }
  }

  const residentFeesUsd = sumResidentFeeAmountsUsd(amounts)
  await syncReservationPricingAggregates(supabase, reservationId)

  if (residentFeesUsd > 0.005) {
    const { data: pricingAfter } = await supabase
      .from('reservation_pricing')
      .select('*')
      .eq('reservation_id', reservationId)
      .maybeSingle()
    if (pricingAfter?.id) {
      const party: PartySizeSource = {
        adults: reservation.adults ?? 0,
        child: reservation.child ?? 0,
        infant: reservation.infant ?? 0,
      }
      const { data: payRowsAfter } = await supabase
        .from('payment_records')
        .select('payment_status, amount')
        .eq('reservation_id', reservationId)
      const recordsAfter: PaymentRecordLike[] = (payRowsAfter || []).map((r) => ({
        payment_status: String(r.payment_status || ''),
        amount: Number(r.amount) || 0,
      }))
      const { balanceAmount, totalPriceGross } = computeBalanceWithResidentFees(
        pricingAfter as Record<string, unknown>,
        party,
        recordsAfter,
        residentFeesUsd
      )
      await supabase
        .from('reservation_pricing')
        .update({
          total_price: totalPriceGross,
          balance_amount: balanceAmount,
        })
        .eq('id', pricingAfter.id)
    }
  }

  return { ok: true }
}

/** 모달 오픈 시 기존 choices·인원에서 금액 로드 */
export async function loadResidentStatusAmountsForReservation(
  supabase: SupabaseClient,
  reservationId: string,
  productId: string | null
): Promise<Partial<Record<ResidentLineKey, number>>> {
  const amounts = emptyResidentStatusAmounts()
  if (!productId) return amounts

  const { data: pricing } = await supabase
    .from('reservation_pricing')
    .select('choices')
    .eq('reservation_id', reservationId)
    .maybeSingle()
  if (!pricing?.choices) return amounts

  const { data: productChoices } = await supabase
    .from('product_choices')
    .select(
      'id, choice_group_ko, choice_group, options:choice_options(id, option_name_ko, option_name, option_key)'
    )
    .eq('product_id', productId)
  if (!productChoices?.length) return amounts

  const rows = selectedChoiceRowsFromReservationPricingChoices(pricing.choices)
  const parsed = parseResidentLineStateFromSelections(productChoices, rows)
  if (!parsed) return amounts
  return { ...amounts, ...parsed.residentStatusAmounts }
}
