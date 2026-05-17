import type { SupabaseClient } from '@supabase/supabase-js'

export type PrepaidTipsTourInput = {
  id: string
  tour_guide_id: string | null
  assistant_id: string | null
  team_type?: string | null
  reservation_ids?: unknown
}

function normalizeTourReservationIds(raw: unknown): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean)
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return normalizeTourReservationIds(parsed)
    } catch {
      // comma-separated or plain string
    }
    return raw.split(',').map((s) => s.trim()).filter(Boolean)
  }
  return []
}

function computeAutoPrepaidShare(
  prepayment_tip_total: number,
  team_type: string | null | undefined,
  isGuide: boolean,
  isAssistant: boolean
): number {
  if (prepayment_tip_total <= 0) return 0
  const after10Percent = prepayment_tip_total * 0.9
  const is2guide = team_type === '2guide'
  if (is2guide && (isGuide || isAssistant)) {
    return after10Percent * 0.5
  }
  if (
    (team_type === '1guide' ||
      team_type === 'guide+driver' ||
      team_type === 'guide + driver') &&
    isGuide
  ) {
    return after10Percent
  }
  return 0
}

/**
 * 직원별 prepaid tips: Tips 쉐어(tour_tip_shares) 저장값 우선,
 * 없으면 reservation_pricing 합계 기준 자동 분배(90% 후 팀 타입별).
 */
export async function calculateEmployeePrepaidTips(
  supabase: SupabaseClient,
  tour: PrepaidTipsTourInput,
  employeeEmail: string
): Promise<{ share: number; prepayment_tip_total: number }> {
  const isGuide = tour.tour_guide_id === employeeEmail
  const isAssistant = tour.assistant_id === employeeEmail
  let prepayment_tip_total = 0

  const resIds = normalizeTourReservationIds(tour.reservation_ids)
  if (resIds.length > 0) {
    const { data: pricingData, error: pricingError } = await supabase
      .from('reservation_pricing')
      .select('prepayment_tip')
      .in('reservation_id', resIds)
    if (!pricingError && pricingData) {
      prepayment_tip_total = pricingData.reduce(
        (sum, p) => sum + (Number(p.prepayment_tip) || 0),
        0
      )
    }
  }

  const { data: tipShareData, error: tipShareError } = await supabase
    .from('tour_tip_shares')
    .select('guide_amount, assistant_amount')
    .eq('tour_id', tour.id)
    .maybeSingle()

  if (!tipShareError && tipShareData) {
    if (isGuide) {
      return { share: Number(tipShareData.guide_amount) || 0, prepayment_tip_total }
    }
    if (isAssistant) {
      return { share: Number(tipShareData.assistant_amount) || 0, prepayment_tip_total }
    }
    return { share: 0, prepayment_tip_total }
  }

  const share = computeAutoPrepaidShare(
    prepayment_tip_total,
    tour.team_type,
    isGuide,
    isAssistant
  )
  return { share, prepayment_tip_total }
}
