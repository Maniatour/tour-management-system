'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { compareItemLabel } from '@/lib/market-research/excludedItems'
import type { MarketCompareItemCatalog } from '@/lib/market-research/types'

export function MarketResearchCompareItemsManager({
  items,
  isKo,
  onAdd,
  onDelete,
}: {
  items: MarketCompareItemCatalog[]
  isKo: boolean
  onAdd: (label: string) => Promise<void>
  onDelete: (itemId: string) => Promise<void>
}) {
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {isKo
          ? '가격 비교 표의 불포함 사항 행을 추가하거나 삭제합니다. 모든 리스팅에 같이 적용됩니다.'
          : 'Add or remove Not included rows on the pricing board. Changes apply to every listing.'}
      </p>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
          {isKo ? '등록된 항목이 없습니다.' : 'No comparison items yet.'}
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((row) => (
            <div
              key={row.item_id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-4 py-3"
            >
              <span className="min-w-0 truncate font-medium">{compareItemLabel({
                id: row.item_id,
                labelKo: row.label_ko,
                labelEn: row.label_en,
              }, isKo)}</span>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={async () => {
                  if (
                    !window.confirm(
                      isKo ? '이 항목을 가격 비교에서 삭제할까요?' : 'Remove this row from the pricing board?'
                    )
                  ) {
                    return
                  }
                  setBusy(true)
                  try {
                    await onDelete(row.item_id)
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                {isKo ? '삭제' : 'Remove'}
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="market-compare-item-label">{isKo ? '항목 추가' : 'Add item'}</Label>
        <div className="flex gap-2">
          <Input
            id="market-compare-item-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={isKo ? '예: 입장료' : 'e.g. Entrance fee'}
            className="h-11 rounded-xl"
            onKeyDown={async (e) => {
              if (e.key !== 'Enter' || busy || !label.trim()) return
              e.preventDefault()
              setBusy(true)
              try {
                await onAdd(label.trim())
                setLabel('')
              } finally {
                setBusy(false)
              }
            }}
          />
          <Button
            className="h-11 rounded-xl"
            disabled={busy || !label.trim()}
            onClick={async () => {
              setBusy(true)
              try {
                await onAdd(label.trim())
                setLabel('')
              } finally {
                setBusy(false)
              }
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            {isKo ? '추가' : 'Add'}
          </Button>
        </div>
      </div>
    </div>
  )
}
