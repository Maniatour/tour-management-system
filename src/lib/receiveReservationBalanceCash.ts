import type { SupabaseClient } from '@supabase/supabase-js'
import { syncReservationPricingAggregates } from '@/lib/syncReservationPricingAggregates'
import { lookupReservationOperatorId } from '@/lib/operators/lookupReservationOperatorId'

export async function receiveReservationBalanceCash(
  supabase: SupabaseClient,
  params: {
    reservationId: string
    balanceAmount: number
    submitBy: string
    teamDisplay: string
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { reservationId, balanceAmount, submitBy, teamDisplay } = params

  if (!Number.isFinite(balanceAmount) || balanceAmount <= 0) {
    return { ok: false, error: '수령할 잔액이 없습니다.' }
  }

  try {
    const operatorId = await lookupReservationOperatorId(supabase, reservationId)
    const { error: paymentInsertError } = await supabase.from('payment_records').insert({
      id: `payment_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      operator_id: operatorId,
      reservation_id: reservationId,
      payment_status: 'Balance Received',
      amount: balanceAmount,
      payment_method: 'cash',
      note: `Balance 수령 (${teamDisplay})`,
      submit_by: submitBy || null,
    })

    if (paymentInsertError) {
      return { ok: false, error: paymentInsertError.message || '입금 내역 생성에 실패했습니다.' }
    }

    const sync = await syncReservationPricingAggregates(supabase, reservationId)
    if (!sync.ok && sync.error) {
      console.warn('[receiveReservationBalanceCash] reservation_pricing 동기화 실패:', reservationId, sync.error)
    }

    const { data: existingPricing, error: pricingFetchError } = await supabase
      .from('reservation_pricing')
      .select('id')
      .eq('reservation_id', reservationId)
      .single()

    if (pricingFetchError && pricingFetchError.code !== 'PGRST116') {
      const msg = typeof pricingFetchError?.message === 'string' ? pricingFetchError.message : ''
      if (!msg.includes('AbortError') && !msg.includes('aborted')) {
        console.error('reservation_pricing 조회 오류:', pricingFetchError)
      }
    }

    if (existingPricing) {
      const { error: updateError } = await supabase
        .from('reservation_pricing')
        .update({
          balance_amount: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingPricing.id)

      if (updateError) {
        return {
          ok: false,
          error: '입금 내역은 생성되었지만 가격 정보 업데이트에 실패했습니다.',
        }
      }
    }

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : '잔액 수령 중 오류가 발생했습니다.',
    }
  }
}
