'use client'

import { useMemo, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { axisLabel, otaPlatformLabel } from '@/lib/market-research/compare'
import { excludedItemLabel, snapshotExcludedItems } from '@/lib/market-research/excludedItems'
import type { MarketListing } from '@/lib/market-research/types'
import { formatUsd, type MarketResearchBundle } from './helpers'

export function MarketResearchHistorySection({
  bundle,
  isKo,
}: {
  bundle: MarketResearchBundle
  isKo: boolean
}) {
  const [listingId, setListingId] = useState(bundle.listings[0]?.id || '')
  const listing = bundle.listings.find((row) => row.id === listingId)
  const nameByCompetitor = new Map(bundle.competitors.map((row) => [row.id, row.name]))
  const rows = useMemo(
    () => bundle.snapshots.filter((row) => row.listing_id === listingId).slice(0, 40),
    [bundle.snapshots, listingId]
  )

  const listingLabel = (row: MarketListing) =>
    `${nameByCompetitor.get(row.competitor_id) || ''} · ${otaPlatformLabel(row.ota_platform, isKo)}`

  return (
    <div className="space-y-4">
      <Select value={listingId} onValueChange={setListingId}>
        <SelectTrigger className="h-11 max-w-md rounded-xl">
          <SelectValue placeholder={isKo ? '리스팅' : 'Listing'} />
        </SelectTrigger>
        <SelectContent>
          {bundle.listings.map((row) => (
            <SelectItem key={row.id} value={row.id}>
              {listingLabel(row)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="overflow-x-auto rounded-2xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{isKo ? '날짜' : 'Date'}</TableHead>
              <TableHead>{isKo ? '축' : 'Axis'}</TableHead>
              <TableHead>{isKo ? '합계' : 'Total'}</TableHead>
              <TableHead>{isKo ? '판매 / 불포함' : 'Sale / excl.'}</TableHead>
              <TableHead>{isKo ? '출처' : 'Source'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => {
              const newer = rows[index - 1]
              const changed =
                newer &&
                newer.canyon_variant === row.canyon_variant &&
                newer.offer_type === row.offer_type &&
                newer.adult_total !== row.adult_total
              return (
                <TableRow key={row.id} className={changed ? 'bg-amber-50' : undefined}>
                  <TableCell>{row.observed_on}</TableCell>
                  <TableCell>{axisLabel(row.canyon_variant, row.offer_type, isKo)}</TableCell>
                  <TableCell className="font-semibold">{formatUsd(row.adult_total)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <div>
                      {formatUsd(row.adult_sale_price)} / {formatUsd(row.adult_not_included)}
                    </div>
                    {snapshotExcludedItems(row).length ? (
                      <div className="mt-1 space-y-0.5">
                        {snapshotExcludedItems(row).map((item) => (
                          <div key={item.id}>
                            {excludedItemLabel(item, isKo)} {formatUsd(item.amount)}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>{row.source === 'manual' ? (isKo ? '수동' : 'Manual') : isKo ? '자동' : 'Auto'}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      {listing?.diff_notes ? (
        <p className="rounded-xl border border-border/60 bg-muted/40 p-4 text-sm">{listing.diff_notes}</p>
      ) : null}
    </div>
  )
}
