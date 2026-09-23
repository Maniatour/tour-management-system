'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { buildOtaCompareRows, compareGridCsv } from '@/lib/market-research/compare'
import { otaChoicesForBoard } from '@/lib/market-research/otaChannels'
import { MarketResearchCompareTable } from './MarketResearchCompareTable'
import type { MarketResearchBundle } from './helpers'

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function MarketResearchOtaCompareSection({
  bundle,
  isKo,
}: {
  bundle: MarketResearchBundle
  isKo: boolean
}) {
  const otaChoices = otaChoicesForBoard(bundle.channels, bundle.listings, isKo)
  const [platform, setPlatform] = useState(bundle.listings[0]?.ota_platform || otaChoices[0]?.id || 'viator')
  const platformListings = bundle.listings.filter((row) => row.ota_platform === platform)
  const [selected, setSelected] = useState<string[]>(() => platformListings.map((row) => row.id))

  const visible = platformListings.filter((row) => selected.includes(row.id))
  const nameByCompetitor = new Map(bundle.competitors.map((row) => [row.id, row.name]))
  const rows = useMemo(
    () => buildOtaCompareRows(visible, bundle.snapshots, bundle.ourPrices),
    [visible, bundle.snapshots, bundle.ourPrices]
  )
  const columns = visible.map((row) => ({
    id: row.id,
    label: nameByCompetitor.get(row.competitor_id) || row.listing_title || row.id,
  }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm font-medium">{isKo ? 'OTA 선택' : 'OTA'}</p>
          <Select
            value={platform}
            onValueChange={(value) => {
              setPlatform(value as typeof platform)
              setSelected(bundle.listings.filter((row) => row.ota_platform === value).map((row) => row.id))
            }}
          >
            <SelectTrigger className="h-11 w-56 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {otaChoices.map((choice) => (
                <SelectItem key={choice.id} value={choice.id}>
                  {choice.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          className="h-11 rounded-xl"
          onClick={() =>
            downloadCsv(`market-research-${platform}.csv`, compareGridCsv(rows, columns, isKo))
          }
        >
          CSV
        </Button>
      </div>
      <div className="flex flex-wrap gap-3">
        {platformListings.map((listing) => (
          <label key={listing.id} className="flex min-h-11 items-center gap-2 rounded-xl border border-border/60 px-3 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(listing.id)}
              onChange={(e) =>
                setSelected((prev) =>
                  e.target.checked ? [...prev, listing.id] : prev.filter((id) => id !== listing.id)
                )
              }
            />
            {nameByCompetitor.get(listing.competitor_id) || listing.listing_title}
          </label>
        ))}
      </div>
      <MarketResearchCompareTable rows={rows} columns={columns} isKo={isKo} />
    </div>
  )
}
