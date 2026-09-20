'use client'

import { Check, Minus } from 'lucide-react'
import { MARKET_EXCLUDED_ITEM_PRESETS } from '@/lib/market-research/excludedItems'

export function MarketResearchCompareItemsGuide({
  allInclusive,
  isKo,
}: {
  allInclusive: boolean
  isKo: boolean
}) {
  const included = allInclusive ? MARKET_EXCLUDED_ITEM_PRESETS : []
  const excluded = allInclusive ? [] : MARKET_EXCLUDED_ITEM_PRESETS
  return (
    <div className="grid gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4 sm:grid-cols-2">
      <CompareColumn
        title={isKo ? '비교 포함' : 'Compare as included'}
        empty={isKo ? '별도 포함 항목 없음' : 'None extra included'}
        items={included.map((row) => (isKo ? row.labelKo : row.labelEn))}
        included
      />
      <CompareColumn
        title={isKo ? '비교 불포함' : 'Compare as not included'}
        empty={isKo ? '별도 불포함 항목 없음' : 'None extra excluded'}
        items={excluded.map((row) => (isKo ? row.labelKo : row.labelEn))}
        included={false}
      />
    </div>
  )
}

function CompareColumn({
  title,
  empty,
  items,
  included,
}: {
  title: string
  empty: string
  items: string[]
  included: boolean
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((label) => (
            <li key={label} className="flex items-start gap-2 text-sm">
              {included ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <Minus className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              )}
              <span>{label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
