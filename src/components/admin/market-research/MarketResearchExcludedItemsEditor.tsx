'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  MARKET_EXCLUDED_ITEM_PRESETS,
  serializeExcludedItems,
  sumExcludedItems,
  type MarketExcludedItem,
} from '@/lib/market-research/excludedItems'
import { formatUsd } from './helpers'

function amountText(items: MarketExcludedItem[], id: string): string {
  const found = items.find((row) => row.id === id)
  return found ? String(found.amount) : ''
}

function upsertItem(items: MarketExcludedItem[], next: MarketExcludedItem): MarketExcludedItem[] {
  const without = items.filter((row) => row.id !== next.id)
  if (next.amount <= 0 || !next.label.trim()) return without
  return [...without, next]
}

export function MarketResearchExcludedItemsEditor({
  title,
  items,
  onChange,
  isKo,
}: {
  title: string
  items: MarketExcludedItem[]
  onChange: (items: MarketExcludedItem[]) => void
  isKo: boolean
}) {
  const customItems = items.filter((row) => !MARKET_EXCLUDED_ITEM_PRESETS.some((preset) => preset.id === row.id))
  const total = sumExcludedItems(serializeExcludedItems(items))

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4 md:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-sm font-medium">{title}</Label>
        <span className="text-sm font-semibold">
          {isKo ? '합계' : 'Total'} {formatUsd(total || null)}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {MARKET_EXCLUDED_ITEM_PRESETS.map((preset) => (
          <div key={preset.id} className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{isKo ? preset.labelKo : preset.labelEn}</Label>
            <Input
              type="number"
              min="0"
              value={amountText(items, preset.id)}
              onChange={(e) =>
                onChange(
                  upsertItem(items, {
                    id: preset.id,
                    label: isKo ? preset.labelKo : preset.labelEn,
                    amount: e.target.value.trim() === '' ? 0 : Number(e.target.value),
                  })
                )
              }
              className="h-11 rounded-xl"
            />
          </div>
        ))}
      </div>
      {customItems.map((item) => (
        <div key={item.id} className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
          <Input
            value={item.label}
            placeholder={isKo ? '항목 이름' : 'Item name'}
            onChange={(e) => {
              const label = e.target.value
              onChange(items.map((row) => (row.id === item.id ? { ...row, label } : row)))
            }}
            className="h-11 rounded-xl"
          />
          <Input
            type="number"
            min="0"
            value={item.amount ? String(item.amount) : ''}
            onChange={(e) =>
              onChange(
                items.map((row) =>
                  row.id === item.id
                    ? { ...row, amount: e.target.value.trim() === '' ? 0 : Number(e.target.value) }
                    : row
                )
              )
            }
            className="h-11 rounded-xl"
          />
          <Button
            type="button"
            variant="ghost"
            className="h-11 rounded-xl"
            onClick={() => onChange(items.filter((row) => row.id !== item.id))}
            aria-label={isKo ? '항목 삭제' : 'Remove item'}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="h-11 rounded-xl"
        onClick={() =>
          onChange([
            ...items,
            { id: `custom:${Date.now()}`, label: '', amount: 0 },
          ])
        }
      >
        <Plus className="mr-2 h-4 w-4" />
        {isKo ? '항목 추가' : 'Add item'}
      </Button>
    </div>
  )
}
