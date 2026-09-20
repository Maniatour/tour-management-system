'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { badgeCatalogLabel } from '@/lib/market-research/badges'
import type { MarketBadgeCatalogItem } from '@/lib/market-research/types'

export function MarketResearchBadgeManager({
  badges,
  isKo,
  onAdd,
  onDelete,
}: {
  badges: MarketBadgeCatalogItem[]
  isKo: boolean
  onAdd: (label: string) => Promise<void>
  onDelete: (badgeId: string) => Promise<void>
}) {
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const presets = badges.filter((row) => row.is_preset)
  const custom = badges.filter((row) => !row.is_preset)

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {isKo
          ? 'OTA가 붙이는 Likely to sell out, Top Pick, Top rated 같은 뱃지를 미리 만들어 두고, 오늘 가격에서 바로 고릅니다.'
          : 'Save OTA badges such as Likely to sell out, Top Pick, and Top rated, then attach them when you enter today’s price.'}
      </p>
      <div className="space-y-2">
        <Label>{isKo ? '프리셋' : 'Presets'}</Label>
        <div className="flex flex-wrap gap-2">
          {presets.map((row) => (
            <span
              key={row.badge_id}
              className="rounded-full bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 ring-1 ring-amber-200"
            >
              {badgeCatalogLabel(row, isKo)}
            </span>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>{isKo ? '추가한 뱃지' : 'Custom badges'}</Label>
        {custom.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {isKo ? '직접 추가한 뱃지가 없습니다.' : 'No custom badges yet.'}
          </p>
        ) : (
          custom.map((row) => (
            <div
              key={row.badge_id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-4 py-3"
            >
              <span className="font-medium">{badgeCatalogLabel(row, isKo)}</span>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    await onDelete(row.badge_id)
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                {isKo ? '삭제' : 'Remove'}
              </Button>
            </div>
          ))
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="market-badge-label">{isKo ? '뱃지 추가' : 'Add badge'}</Label>
        <div className="flex gap-2">
          <Input
            id="market-badge-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={isKo ? '예: Viator Award' : 'e.g. Viator Award'}
            className="h-11 rounded-xl"
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
