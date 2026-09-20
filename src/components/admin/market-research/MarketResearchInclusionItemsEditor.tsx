'use client'

import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  MARKET_EXCLUDED_ITEM_PRESETS,
  compareItemLabel,
  type MarketCompareItemDef,
  type MarketInclusionMap,
  type MarketInclusionStatus,
} from '@/lib/market-research/excludedItems'
import type { MarketExcludedItem } from '@/lib/market-research/types'
import { cn } from '@/lib/utils'

export function MarketResearchInclusionItemsEditor({
  values,
  onChange,
  amounts,
  onAmountsChange,
  showAmounts = false,
  isKo,
  items = MARKET_EXCLUDED_ITEM_PRESETS,
}: {
  values: MarketInclusionMap
  onChange: (next: MarketInclusionMap) => void
  amounts?: MarketExcludedItem[]
  onAmountsChange?: (items: MarketExcludedItem[]) => void
  showAmounts?: boolean
  isKo: boolean
  items?: readonly MarketCompareItemDef[]
}) {
  const setStatus = (id: string, status: MarketInclusionStatus) => {
    onChange({ ...values, [id]: status })
    if (status === 'included' && amounts && onAmountsChange) {
      onAmountsChange(amounts.filter((row) => row.id !== id))
    }
  }

  const included = items.filter((row) => values[row.id] !== 'excluded')
  const excluded = items.filter((row) => values[row.id] === 'excluded')

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">{isKo ? '포함 / 불포함' : 'Included / not included'}</p>
      <div className="grid grid-cols-2 gap-3">
        <Column title={isKo ? '포함' : 'Included'} empty={isKo ? '없음' : 'None'} tone="included">
          {included.map((preset) => (
            <ItemButton
              key={preset.id}
              label={compareItemLabel(preset, isKo)}
              direction="right"
              moveLabel={isKo ? '불포함으로 보내기' : 'Move to not included'}
              onMove={() => setStatus(preset.id, 'excluded')}
              tone="included"
            />
          ))}
        </Column>
        <Column title={isKo ? '불포함' : 'Not included'} empty={isKo ? '없음' : 'None'} tone="excluded">
          {excluded.map((preset) => {
            const amount = amounts?.find((row) => row.id === preset.id)?.amount
            const label = compareItemLabel(preset, isKo)
            return (
              <div key={preset.id} className="flex items-center gap-1.5">
                <ItemButton
                  label={label}
                  direction="left"
                  moveLabel={isKo ? '포함으로 보내기' : 'Move to included'}
                  onMove={() => setStatus(preset.id, 'included')}
                  tone="excluded"
                />
                {showAmounts ? (
                  <div className="relative w-[4.5rem] shrink-0">
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      min="0"
                      value={amount == null || !Number.isFinite(amount) ? '' : String(amount)}
                      onChange={(e) => {
                        if (!onAmountsChange) return
                        const nextAmount = e.target.value.trim() === '' ? 0 : Number(e.target.value)
                        const without = (amounts || []).filter((row) => row.id !== preset.id)
                        onAmountsChange(
                          nextAmount > 0
                            ? [
                                ...without,
                                {
                                  id: preset.id,
                                  label,
                                  amount: nextAmount,
                                },
                              ]
                            : without
                        )
                      }}
                      className="h-8 rounded-lg pl-5 text-sm"
                      aria-label={isKo ? `${label} 금액` : `${label} amount`}
                    />
                  </div>
                ) : null}
              </div>
            )
          })}
        </Column>
      </div>
    </div>
  )
}

function Column({
  title,
  empty,
  tone,
  children,
}: {
  title: string
  empty: string
  tone: 'included' | 'excluded'
  children: ReactNode
}) {
  const items = Array.isArray(children) ? children : [children]
  const hasItems = items.some(Boolean)
  return (
    <div
      className={cn(
        'min-h-[132px] space-y-2 rounded-2xl border p-3',
        tone === 'included' ? 'border-emerald-100 bg-emerald-50/50' : 'border-slate-200 bg-slate-50/70'
      )}
    >
      <p
        className={cn(
          'text-xs font-semibold tracking-wide',
          tone === 'included' ? 'text-emerald-700' : 'text-slate-600'
        )}
      >
        {title}
      </p>
      <div className="flex flex-col gap-1.5">
        {hasItems ? children : <p className="text-xs text-muted-foreground">{empty}</p>}
      </div>
    </div>
  )
}

function ItemButton({
  label,
  direction,
  moveLabel,
  onMove,
  tone,
}: {
  label: string
  direction: 'left' | 'right'
  moveLabel: string
  onMove: () => void
  tone: 'included' | 'excluded'
}) {
  return (
    <button
      type="button"
      onClick={onMove}
      aria-label={`${label}, ${moveLabel}`}
      className={cn(
        'flex h-8 w-full min-w-0 items-center justify-between gap-1 rounded-lg px-2.5 text-left text-sm font-medium shadow-sm transition duration-200',
        tone === 'included'
          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
          : 'bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-100'
      )}
    >
      {direction === 'left' ? <ChevronLeft className="h-3.5 w-3.5 shrink-0 opacity-80" /> : null}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {direction === 'right' ? <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-80" /> : null}
    </button>
  )
}
