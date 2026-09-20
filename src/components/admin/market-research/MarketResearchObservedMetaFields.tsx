'use client'

import { useState } from 'react'
import { Plus, Star } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { badgeCatalogLabel, findCatalogBadgeByLabel } from '@/lib/market-research/badges'
import type { MarketBadgeCatalogItem } from '@/lib/market-research/types'
import { MarketResearchToggleChips } from './MarketResearchToggleChips'

export function MarketResearchObservedMetaFields({
  observedOn,
  badges,
  selectedBadgeIds,
  onBadgesChange,
  onCreateBadge,
  rating,
  reviewCount,
  onRatingChange,
  onReviewCountChange,
  isKo,
}: {
  observedOn: string
  badges: MarketBadgeCatalogItem[]
  selectedBadgeIds: string[]
  onBadgesChange: (next: string[]) => void
  onCreateBadge: (label: string) => Promise<string>
  rating: string
  reviewCount: string
  onRatingChange: (value: string) => void
  onReviewCountChange: (value: string) => void
  isKo: boolean
}) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const addDraft = async () => {
    const label = draft.trim()
    if (!label || busy) return
    const existing = findCatalogBadgeByLabel(badges, label)
    if (existing) {
      if (!selectedBadgeIds.includes(existing.badge_id)) {
        onBadgesChange([...selectedBadgeIds, existing.badge_id])
      }
      setDraft('')
      return
    }
    setBusy(true)
    try {
      const id = await onCreateBadge(label)
      if (id && !selectedBadgeIds.includes(id)) {
        onBadgesChange([...selectedBadgeIds, id])
      }
      setDraft('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : isKo ? '뱃지를 저장하지 못했습니다.' : 'Could not save badge.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border/60 bg-white p-4">
      <div>
        <p className="text-sm font-semibold">{isKo ? '조사 날짜 기록' : 'Observation notes'}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {isKo
            ? `${observedOn} 조사 시점의 OTA 뱃지, 평점, 리뷰 수를 남깁니다.`
            : `Record the OTA badges, rating, and review count seen on ${observedOn}.`}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="market-badge-draft">{isKo ? 'OTA 뱃지' : 'OTA badges'}</Label>
        {badges.length > 0 ? (
          <MarketResearchToggleChips
            multiple
            selected={selectedBadgeIds}
            onChange={onBadgesChange}
            options={badges.map((row) => ({
              id: row.badge_id,
              label: badgeCatalogLabel(row, isKo),
            }))}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {isKo
              ? '아래 입력란에 뱃지를 추가하면 다음부터 버튼으로 나옵니다.'
              : 'Add a badge below and it will appear as a button next time.'}
          </p>
        )}
        <div className="flex gap-2">
          <Input
            id="market-badge-draft"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void addDraft()
              }
            }}
            placeholder={isKo ? '예: Top rated, Free cancellation' : 'e.g. Top rated, Free cancellation'}
            className="h-11 rounded-xl"
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 shrink-0 rounded-xl"
            disabled={busy || !draft.trim()}
            onClick={() => void addDraft()}
          >
            <Plus className="mr-1 h-4 w-4" />
            {isKo ? '추가' : 'Add'}
          </Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="market-rating">{isKo ? '평점' : 'Rating'}</Label>
          <div className="relative">
            <Star className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-500" />
            <Input
              id="market-rating"
              type="number"
              min="0"
              max="5"
              step="0.1"
              value={rating}
              onChange={(e) => onRatingChange(e.target.value)}
              placeholder="4.7"
              className="h-11 rounded-xl pl-10"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="market-reviews">{isKo ? '리뷰 수' : 'Reviews'}</Label>
          <Input
            id="market-reviews"
            type="number"
            min="0"
            value={reviewCount}
            onChange={(e) => onReviewCountChange(e.target.value)}
            placeholder="485"
            className="h-11 rounded-xl"
          />
          <p className="text-xs text-muted-foreground">
            {isKo ? '예: 4.7 · 485 reviews' : 'Example: 4.7 · 485 reviews'}
          </p>
        </div>
      </div>
    </div>
  )
}
