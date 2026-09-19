'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MARKET_OTA_PLATFORMS } from '@/lib/market-research/types'
import { otaPlatformLabel } from '@/lib/market-research/compare'
import type { MarketCatalogChannel, MarketCatalogProduct, MarketCompetitor, MarketListing } from '@/lib/market-research/types'
import { productLabel } from './helpers'

export type ListingDraft = {
  competitorId: string
  otaPlatform: string
  listingUrl: string
  listingTitle: string
  mappedProductId: string
  mappedChannelId: string
  hasLower: boolean
  hasAntelopeX: boolean
  hasAllInclusive: boolean
  hasSalePlusExcluded: boolean
  watchEnabled: boolean
  durationNote: string
  pickupNote: string
  groupSizeNote: string
  cancellationNote: string
  languageNote: string
  itineraryNote: string
  diffNotes: string
}

export function listingToDraft(listing: MarketListing | null, competitorId: string): ListingDraft {
  return {
    competitorId: listing?.competitor_id || competitorId,
    otaPlatform: listing?.ota_platform || 'viator',
    listingUrl: listing?.listing_url || '',
    listingTitle: listing?.listing_title || '',
    mappedProductId: listing?.mapped_product_id || '',
    mappedChannelId: listing?.mapped_channel_id || '',
    hasLower: listing?.has_lower !== false,
    hasAntelopeX: listing?.has_antelope_x !== false,
    hasAllInclusive: listing?.has_all_inclusive !== false,
    hasSalePlusExcluded: listing?.has_sale_plus_excluded !== false,
    watchEnabled: listing?.watch_enabled !== false,
    durationNote: listing?.duration_note || '',
    pickupNote: listing?.pickup_note || '',
    groupSizeNote: listing?.group_size_note || '',
    cancellationNote: listing?.cancellation_note || '',
    languageNote: listing?.language_note || '',
    itineraryNote: listing?.itinerary_note || '',
    diffNotes: listing?.diff_notes || '',
  }
}

function Check({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

export function MarketResearchListingEditor({
  listing,
  defaultCompetitorId,
  competitors,
  products,
  channels,
  isKo,
  onSave,
  onCancel,
}: {
  defaultCompetitorId?: string | undefined
  listing: MarketListing | null
  competitors: MarketCompetitor[]
  products: MarketCatalogProduct[]
  channels: MarketCatalogChannel[]
  isKo: boolean
  onSave: (draft: ListingDraft) => Promise<void>
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<ListingDraft>(() =>
    listingToDraft(listing, defaultCompetitorId || competitors[0]?.id || '')
  )
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof ListingDraft>(key: K, value: ListingDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }))

  return (
    <Card className="rounded-2xl border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">{listing ? (isKo ? '리스팅 수정' : 'Edit listing') : isKo ? '리스팅 추가' : 'Add listing'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{isKo ? '경쟁사' : 'Competitor'}</Label>
            <Select value={draft.competitorId} onValueChange={(v) => set('competitorId', v)}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {competitors.map((row) => (
                  <SelectItem key={row.id} value={row.id}>{row.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>OTA</Label>
            <Select value={draft.otaPlatform} onValueChange={(v) => set('otaPlatform', v)}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MARKET_OTA_PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p}>{otaPlatformLabel(p, isKo)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>{isKo ? '리스팅 URL' : 'Listing URL'}</Label>
          <Input value={draft.listingUrl} onChange={(e) => set('listingUrl', e.target.value)} className="h-11 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label>{isKo ? '리스팅 제목' : 'Title'}</Label>
          <Input value={draft.listingTitle} onChange={(e) => set('listingTitle', e.target.value)} className="h-11 rounded-xl" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{isKo ? '자사 상품' : 'Our product'}</Label>
            <Select value={draft.mappedProductId || '__none'} onValueChange={(v) => set('mappedProductId', v === '__none' ? '' : v)}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder={isKo ? '선택' : 'Select'} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">{isKo ? '없음' : 'None'}</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{productLabel(p, isKo)} ({p.id})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{isKo ? '자사 채널' : 'Our channel'}</Label>
            <Select value={draft.mappedChannelId || '__none'} onValueChange={(v) => set('mappedChannelId', v === '__none' ? '' : v)}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">{isKo ? '자동' : 'Auto'}</SelectItem>
                {channels.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name || c.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Check checked={draft.hasLower} onChange={(v) => set('hasLower', v)} label="Lower Antelope" />
          <Check checked={draft.hasAntelopeX} onChange={(v) => set('hasAntelopeX', v)} label="Antelope X" />
          <Check checked={draft.hasAllInclusive} onChange={(v) => set('hasAllInclusive', v)} label={isKo ? '전체포함가' : 'All-inclusive'} />
          <Check checked={draft.hasSalePlusExcluded} onChange={(v) => set('hasSalePlusExcluded', v)} label={isKo ? '판매가+불포함' : 'Sale + excluded'} />
          <Check checked={draft.watchEnabled} onChange={(v) => set('watchEnabled', v)} label={isKo ? '일 1회 자동 수집' : 'Daily fetch'} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Input placeholder={isKo ? '소요시간 차이' : 'Duration'} value={draft.durationNote} onChange={(e) => set('durationNote', e.target.value)} className="h-11 rounded-xl" />
          <Input placeholder={isKo ? '픽업' : 'Pickup'} value={draft.pickupNote} onChange={(e) => set('pickupNote', e.target.value)} className="h-11 rounded-xl" />
          <Input placeholder={isKo ? '그룹 규모' : 'Group size'} value={draft.groupSizeNote} onChange={(e) => set('groupSizeNote', e.target.value)} className="h-11 rounded-xl" />
          <Input placeholder={isKo ? '취소 정책' : 'Cancellation'} value={draft.cancellationNote} onChange={(e) => set('cancellationNote', e.target.value)} className="h-11 rounded-xl" />
          <Input placeholder={isKo ? '언어' : 'Language'} value={draft.languageNote} onChange={(e) => set('languageNote', e.target.value)} className="h-11 rounded-xl" />
          <Input placeholder={isKo ? '일정 요약' : 'Itinerary'} value={draft.itineraryNote} onChange={(e) => set('itineraryNote', e.target.value)} className="h-11 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label>{isKo ? '자사 대비 차이 노트' : 'Difference vs ours'}</Label>
          <textarea
            value={draft.diffNotes}
            onChange={(e) => set('diffNotes', e.target.value)}
            className="min-h-[88px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <Button
            className="h-11 rounded-xl"
            disabled={saving || !draft.listingUrl.trim() || !draft.competitorId}
            onClick={async () => {
              setSaving(true)
              try {
                await onSave(draft)
              } finally {
                setSaving(false)
              }
            }}
          >
            {isKo ? '저장' : 'Save'}
          </Button>
          <Button variant="outline" className="h-11 rounded-xl" onClick={onCancel}>
            {isKo ? '취소' : 'Cancel'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
