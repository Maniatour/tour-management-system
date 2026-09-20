import type {
  MarketCanyonVariant,
  MarketCompetitor,
  MarketExcludedItem,
  MarketListing,
  MarketOfferType,
  MarketSnapshot,
  OurPriceOverlay,
} from './types'
import { marketPriceAxisKey } from './types'
import {
  collectExcludedItemIds,
  excludedAmountFor,
  excludedItemLabel,
  snapshotExcludedItems,
} from './excludedItems'
import { listingAxes, latestSnapshotsByAxis, priceDelta, snapshotKey } from './prices'

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
  excludedItems: MarketExcludedItem[]
}

export type CompareRow = {
  canyon: MarketCanyonVariant
  offer: MarketOfferType
  axisKey: string
  excludedItemId: string | null
  excludedItemLabel: string | null
  cells: Record<string, CompareCell>
}

export function axisLabel(
  canyon: MarketCanyonVariant,
  offer: MarketOfferType,
  isKo: boolean,
  excluded?: { id: string; label: string } | null
): string {
  const canyonLabel =
    canyon === 'lower'
      ? 'Lower'
      : canyon === 'antelope_x'
        ? 'Antelope X'
        : isKo
          ? '캐년 미구분'
          : 'Canyon unspecified'
  if (excluded) {
    if (excluded.id === 'total') {
      return isKo ? `${canyonLabel} · 불포함 합계` : `${canyonLabel} · excluded total`
    }
    const itemLabel = excludedItemLabel(excluded, isKo)
    return isKo ? `${canyonLabel} · 불포함 · ${itemLabel}` : `${canyonLabel} · excl. · ${itemLabel}`
  }
  if (offer === 'listing_from') return isKo ? 'From · 1인' : 'From / person'
  const offerLabel = offer === 'all_inclusive'
    ? isKo
      ? '옵션 판매가'
      : 'Option sale'
    : isKo
      ? '옵션 판매가+불포함'
      : 'Option sale + excluded'
  return `${canyonLabel} · ${offerLabel}`
}

export function compareRowLabel(row: CompareRow, isKo: boolean): string {
  return axisLabel(
    row.canyon,
    row.offer,
    isKo,
    row.excludedItemId
      ? { id: row.excludedItemId, label: row.excludedItemLabel || row.excludedItemId }
      : null
  )
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

function emptyCell(): CompareCell {
  return {
    listingId: null,
    sale: null,
    notIncluded: null,
    total: null,
    currency: 'USD',
    observedOn: null,
    source: null,
    ourTotal: null,
    deltaAmount: null,
    deltaPercent: null,
    excludedItems: [],
  }
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
    excludedItems: snapshotExcludedItems(snapshot),
  }
}

function optionSnapshot(
  latest: Map<string, MarketSnapshot>,
  listingId: string,
  canyon: MarketCanyonVariant,
  offer: MarketOfferType
): MarketSnapshot | undefined {
  if (canyon === 'unspecified' && offer === 'listing_from') {
    return (
      latest.get(snapshotKey(listingId, 'unspecified', 'listing_from')) ??
      latest.get(snapshotKey(listingId, 'unspecified', 'all_inclusive'))
    )
  }
  const other = offer === 'sale_plus_excluded' ? 'all_inclusive' : 'sale_plus_excluded'
  return (
    latest.get(snapshotKey(listingId, canyon, offer)) ??
    latest.get(snapshotKey(listingId, canyon, other)) ??
    latest.get(snapshotKey(listingId, 'unspecified', offer))
  )
}

function makeRow(
  canyon: MarketCanyonVariant,
  offer: MarketOfferType,
  axisKey: string,
  cells: Record<string, CompareCell>,
  excluded?: { id: string; label: string }
): CompareRow {
  return {
    canyon,
    offer,
    axisKey,
    excludedItemId: excluded?.id ?? null,
    excludedItemLabel: excluded?.label ?? null,
    cells,
  }
}

/** OTA별 비교: 열 = 선택한 리스팅, 행 = From + Lower/X + 불포함 항목 */
export function buildOtaCompareRows(
  listings: MarketListing[],
  snapshots: MarketSnapshot[],
  ourByListing: Record<string, OurPriceOverlay>
): CompareRow[] {
  const latest = latestSnapshotsByAxis(snapshots)
  const seen = new Set<string>()
  const axes: Array<{ canyon: MarketCanyonVariant; offer: MarketOfferType }> = []
  for (const listing of listings) {
    for (const axis of listingAxes(listing)) {
      const key = marketPriceAxisKey(axis.canyon, axis.offer)
      if (seen.has(key)) continue
      seen.add(key)
      axes.push(axis)
    }
  }

  const rows: CompareRow[] = axes.map((axis) => {
    const cells: Record<string, CompareCell> = {}
    for (const listing of listings) {
      cells[listing.id] = cellFromSnapshot(
        optionSnapshot(latest, listing.id, axis.canyon, axis.offer),
        ourByListing[listing.id],
        axis.canyon,
        axis.offer
      )
    }
    return makeRow(axis.canyon, axis.offer, marketPriceAxisKey(axis.canyon, axis.offer), cells)
  })

  const optionAxes = axes.filter((axis) => axis.offer !== 'listing_from' && axis.canyon !== 'unspecified')
  for (const axis of optionAxes) {
    const optionSnaps = listings.map((listing) => optionSnapshot(latest, listing.id, axis.canyon, axis.offer))
    const hasExcluded = optionSnaps.some(
      (snap) => (snap?.adult_not_included || 0) > 0 || snapshotExcludedItems(snap).length > 0
    )
    if (!hasExcluded) continue

    const totalCells: Record<string, CompareCell> = {}
    for (let i = 0; i < listings.length; i += 1) {
      const listing = listings[i]
      const snap = optionSnaps[i]
      const items = snapshotExcludedItems(snap)
      const amount = items.length ? items.reduce((sum, item) => sum + item.amount, 0) : snap?.adult_not_included ?? null
      totalCells[listing.id] = {
        ...emptyCell(),
        listingId: snap?.listing_id ?? null,
        notIncluded: amount,
        total: amount,
        currency: snap?.currency ?? 'USD',
        observedOn: snap?.observed_on ?? null,
        source: snap?.source ?? null,
        excludedItems: items,
      }
    }
    rows.push(
      makeRow(axis.canyon, axis.offer, `excluded:${axis.canyon}:total`, totalCells, {
        id: 'total',
        label: 'total',
      })
    )

    for (const item of collectExcludedItemIds(optionSnaps)) {
      const itemCells: Record<string, CompareCell> = {}
      for (let i = 0; i < listings.length; i += 1) {
        const listing = listings[i]
        const snap = optionSnaps[i]
        const items = snapshotExcludedItems(snap)
        const amount = excludedAmountFor(items, item.id)
        itemCells[listing.id] = {
          ...emptyCell(),
          listingId: snap?.listing_id ?? null,
          notIncluded: amount,
          total: amount,
          currency: snap?.currency ?? 'USD',
          observedOn: snap?.observed_on ?? null,
          source: snap?.source ?? null,
          excludedItems: items.filter((row) => row.id === item.id),
        }
      }
      rows.push(
        makeRow(axis.canyon, axis.offer, `excluded:${axis.canyon}:${item.id}`, itemCells, item)
      )
    }
  }

  return rows
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
    const label = compareRowLabel(row, isKo)
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
