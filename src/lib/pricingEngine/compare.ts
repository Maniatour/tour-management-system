import type {
  LegacyPricingSnapshotFromUi,
  PricingComparisonResult,
  PricingComparisonRow,
  PricingEngineContext,
  ReservationPricingResult,
} from '@/lib/pricingEngine/types'
import { computeReservationPricing } from '@/lib/pricingEngine/compute'

const MATCH_EPS = 0.02

function roundUsd2(n: number): number {
  return Math.round(n * 100) / 100
}

const COMPARISON_FIELDS: Array<{
  key: keyof LegacyPricingSnapshotFromUi
  labelKo: string
  labelEn: string
}> = [
  { key: 'customerPaymentGross', labelKo: '① 고객 총액 (gross)', labelEn: 'Customer gross' },
  { key: 'customerPaymentNet', labelKo: '① 고객 총 결제 (넷)', labelEn: 'Customer net' },
  { key: 'onSiteBalance', labelKo: '② 잔액', labelEn: 'On-site balance' },
  { key: 'channelPaymentNet', labelKo: '③ 채널 결제', labelEn: 'Channel payment' },
  { key: 'channelSettlement', labelKo: '③ 채널 정산', labelEn: 'Channel settlement' },
  { key: 'companyTotalRevenue', labelKo: '④ 총 매출', labelEn: 'Total revenue' },
  { key: 'operatingProfit', labelKo: '④ 운영 이익', labelEn: 'Operating profit' },
]

export function comparePricingEngines(
  legacy: LegacyPricingSnapshotFromUi,
  next: ReservationPricingResult
): PricingComparisonResult {
  const rows: PricingComparisonRow[] = COMPARISON_FIELDS.map(({ key, labelKo, labelEn }) => {
    const legacyVal = roundUsd2(legacy[key])
    const nextVal = roundUsd2(next.totals[key])
    const delta = roundUsd2(nextVal - legacyVal)
    return {
      key,
      labelKo,
      labelEn,
      legacy: legacyVal,
      next: nextVal,
      delta,
      match: Math.abs(delta) <= MATCH_EPS,
    }
  })

  const mismatchCount = rows.filter((r) => !r.match).length

  return {
    profile: next.profile,
    allMatch: mismatchCount === 0,
    mismatchCount,
    rows,
    legacy,
    next,
  }
}

/** UI 스냅샷 + 컨텍스트 → 비교 결과 한 번에 */
export function runPricingEngineComparison(
  ctx: PricingEngineContext,
  legacy: LegacyPricingSnapshotFromUi
): PricingComparisonResult {
  const next = computeReservationPricing(ctx)
  return comparePricingEngines(legacy, next)
}
