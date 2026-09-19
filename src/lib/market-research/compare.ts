import type {
  MarketCanyonVariant,
  MarketCompetitor,
  MarketListing,
  MarketOfferType,
  MarketSnapshot,
  OurPriceOverlay,
} from './types'
import { MARKET_PRICE_AXES, marketPriceAxisKey } from './types'
import { latestSnapshotsByAxis, priceDelta, snapshotKey } from './prices'

export type CompareCell = {
  listingId: string | null
  sale: number | null
  notIncluded: number | null
  total: number | null
  currency: string
  observedOn: string | null
  source: string | null
  ourTotal: number | null
  deltaAmount: number | null
  deltaPercent: number | null
}

export type CompareRow = {
  canyon: MarketCanyonVariant
  offer: MarketOfferType
  axisKey: string
  cells: Record<string, CompareCell>
}

export function axisLabel(canyon: MarketCanyonVariant, offer: MarketOfferType, isKo: boolean): string {
  const canyonLabel =
    canyon === 'lower'
      ? isKo
        ? 'Lower'
        : 'Lower'
      : canyon === 'antelope_x'
        ? isKo
          ? 'Antelope X'
          : 'Antelope X'
        : isKo
          ? '캐년 미구분'
          : 'Canyon unspecified'
  const offerLabel = offer === 'all_inclusive'
    ? isKo
      ? '전체포함'
      : 'All-inclusive'
    : isKo
      ? '판매가+불포함'
      : 'Sale + excluded'
  return `${canyonLabel} · ${offerLabel}`
}

export function otaPlatformLabel(platform: string, isKo: boolean): string {
  const labels: Record<string, { ko: string; en: string }> = {
    viator: { ko: 'Viator', en: 'Viator' },
    getyourguide: { ko: 'GetYourGuide', en: 'GetYourGuide' },
    klook: { ko: 'Klook', en: 'Klook' },
    kkday: { ko: 'KKday', en: 'KKday' },
    tripadvisor: { ko: 'TripAdvisor', en: 'TripAdvisor' },
    tripcom: { ko: 'Trip.com', en: 'Trip.com' },
    myrealtrip: { ko: '마이리얼트립', en: 'MyRealTrip' },
    expedia: { ko: 'Expedia', en: 'Expedia' },
    other: { ko: '기타 OTA', en: 'Other OTA' },
  }
  const row = labels[platform]
  if (!row) return platform
  return isKo ? row.ko : row.en
}

function cellFromSnapshot(
  snapshot: MarketSnapshot | undefined,
  our: OurPriceOverlay | undefined,
  canyon: MarketCanyonVariant,
  offer: MarketOfferType
): CompareCell {
  const ourPoint = our?.points[marketPriceAxisKey(canyon, offer)]
  const total = snapshot?.adult_total ?? null
  const ourTotal = ourPoint?.total ?? null
  const delta = priceDelta(ourTotal, total)
  return {
    listingId: snapshot?.listing_id ?? null,
    sale: snapshot?.adult_sale_price ?? null,
    notIncluded: snapshot?.adult_not_included ?? null,
    total,
    currency: snapshot?.currency ?? 'USD',
    observedOn: snapshot?.observed_on ?? null,
    source: snapshot?.source ?? null,
    ourTotal,
    deltaAmount: delta.amount,
    deltaPercent: delta.percent,
  }
}

/** OTA별 비교: 열 = 선택한 리스팅, 행 = Lower/X × 전체포함/판매+불포함 */
export function buildOtaCompareRows(
  listings: MarketListing[],
  snapshots: MarketSnapshot[],
  ourByListing: Record<string, OurPriceOverlay>
): CompareRow[] {
  const latest = latestSnapshotsByAxis(snapshots)
  return MARKET_PRICE_AXES.filter((axis) =>
    listings.some((listing) => {
      if (axis.canyon === 'lower' && !listing.has_lower) return false
      if (axis.canyon === 'antelope_x' && !listing.has_antelope_x) return false
      if (axis.offer === 'all_inclusive' && !listing.has_all_inclusive) return false
      if (axis.offer === 'sale_plus_excluded' && !listing.has_sale_plus_excluded) return false
      return true
    })
  ).map((axis) => {
    const cells: Record<string, CompareCell> = {}
    for (const listing of listings) {
      const exact = latest.get(snapshotKey(listing.id, axis.canyon, axis.offer))
      const unspecified = latest.get(snapshotKey(listing.id, 'unspecified', axis.offer))
      cells[listing.id] = cellFromSnapshot(
        exact ?? unspecified,
        ourByListing[listing.id],
        axis.canyon,
        axis.offer
      )
    }
    return {
      canyon: axis.canyon,
      offer: axis.offer,
      axisKey: marketPriceAxisKey(axis.canyon, axis.offer),
      cells,
    }
  })
}

/** 경쟁사별 비교: 열 = 그 업체의 OTA 리스팅 */
export function buildCompetitorCompareRows(
  listings: MarketListing[],
  snapshots: MarketSnapshot[],
  ourByListing: Record<string, OurPriceOverlay>
): CompareRow[] {
  return buildOtaCompareRows(listings, snapshots, ourByListing)
}

export function compareGridCsv(
  rows: CompareRow[],
  columns: Array<{ id: string; label: string }>,
  isKo: boolean
): string {
  const header = [
    isKo ? '가격축' : 'Axis',
    ...columns.flatMap((col) => [
      `${col.label} ${isKo ? '판매가' : 'sale'}`,
      `${col.label} ${isKo ? '불포함' : 'excluded'}`,
      `${col.label} ${isKo ? '합계' : 'total'}`,
      `${col.label} ${isKo ? '자사' : 'ours'}`,
      `${col.label} Δ`,
    ]),
  ]
  const lines = [header.join(',')]
  for (const row of rows) {
    const label = axisLabel(row.canyon, row.offer, isKo)
    const cells = columns.flatMap((col) => {
      const cell = row.cells[col.id]
      return [
        cell?.sale ?? '',
        cell?.notIncluded ?? '',
        cell?.total ?? '',
        cell?.ourTotal ?? '',
        cell?.deltaAmount ?? '',
      ]
    })
    lines.push([label, ...cells].join(','))
  }
  return lines.join('\n')
}

export function competitorNameById(competitors: MarketCompetitor[]): Map<string, string> {
  return new Map(competitors.map((row) => [row.id, row.name]))
}
