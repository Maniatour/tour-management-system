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
import { buildCompetitorCompareRows, compareGridCsv, otaPlatformLabel } from '@/lib/market-research/compare'
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

export function MarketResearchCompetitorCompareSection({
  bundle,
  isKo,
}: {
  bundle: MarketResearchBundle
  isKo: boolean
}) {
  const active = bundle.competitors.filter((row) => row.is_active)
  const [competitorId, setCompetitorId] = useState(active[0]?.id || '')
  const listings = bundle.listings.filter((row) => row.competitor_id === competitorId)
  const [selected, setSelected] = useState<string[]>(() => listings.map((row) => row.id))
  const visible = listings.filter((row) => selected.includes(row.id))
  const rows = useMemo(
    () => buildCompetitorCompareRows(visible, bundle.snapshots, bundle.ourPrices),
    [visible, bundle.snapshots, bundle.ourPrices]
  )
  const columns = visible.map((row) => ({
    id: row.id,
    label: otaPlatformLabel(row.ota_platform, isKo),
  }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm font-medium">{isKo ? '경쟁사 선택' : 'Competitor'}</p>
          <Select
            value={competitorId}
            onValueChange={(value) => {
              setCompetitorId(value)
              setSelected(bundle.listings.filter((row) => row.competitor_id === value).map((row) => row.id))
            }}
          >
            <SelectTrigger className="h-11 w-64 rounded-xl">
              <SelectValue placeholder={isKo ? '경쟁사' : 'Competitor'} />
            </SelectTrigger>
            <SelectContent>
              {active.map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {row.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          className="h-11 rounded-xl"
          onClick={() => downloadCsv('market-research-competitor.csv', compareGridCsv(rows, columns, isKo))}
        >
          CSV
        </Button>
      </div>
      <div className="flex flex-wrap gap-3">
        {listings.map((listing) => (
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
            {otaPlatformLabel(listing.ota_platform, isKo)}
          </label>
        ))}
      </div>
      <MarketResearchCompareTable rows={rows} columns={columns} isKo={isKo} />
    </div>
  )
}
