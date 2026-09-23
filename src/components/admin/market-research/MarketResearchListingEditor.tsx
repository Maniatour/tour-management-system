'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { companyOtaChannels, initialOtaPlatform, otaSelectOptions } from '@/lib/market-research/otaChannels'
import {
  formatListingLanguages,
  listingLanguageLabel,
  MARKET_LISTING_LANGUAGES,
  parseListingLanguages,
} from '@/lib/market-research/listingLanguages'
import type { MarketCatalogChannel, MarketCatalogProduct, MarketCompetitor, MarketExcludedItem, MarketInclusionMap, MarketListing, MarketSnapshot } from '@/lib/market-research/types'
import { listingRecordedPrices } from '@/lib/market-research/prices'
import { inclusionHasExcluded, parseInclusionMap, snapshotExcludedItems, type MarketCompareItemDef } from '@/lib/market-research/excludedItems'
import { productLabel } from './helpers'
import { MarketResearchInclusionItemsEditor } from './MarketResearchInclusionItemsEditor'
import { MarketResearchOfferPriceFields } from './MarketResearchOfferPriceFields'
import { MarketResearchToggleChips } from './MarketResearchToggleChips'

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
  fromPrice: string
  lowerSale: string
  antelopeXSale: string
  discountEnabled: boolean
  discountPercent: string
  excludedItems: MarketExcludedItem[]
  inclusionItems: MarketInclusionMap
}

function asPriceInput(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? '' : String(value)
}

function exclusiveOffer(listing: MarketListing | null): { all: boolean; sale: boolean } {
  if (listing?.has_sale_plus_excluded && !listing.has_all_inclusive) {
    return { all: false, sale: true }
  }
  return { all: true, sale: false }
}

export function listingToDraft(
  listing: MarketListing | null,
  competitorId: string,
  productId?: string,
  otaPlatform?: string,
  snapshots: MarketSnapshot[] = [],
  compareItems?: readonly MarketCompareItemDef[],
  channels: MarketCatalogChannel[] = []
): ListingDraft {
  const offer = exclusiveOffer(listing)
  const recorded = listing ? listingRecordedPrices(snapshots, listing.id) : null
  const excluded =
    snapshotExcludedItems(recorded?.lower).length > 0
      ? snapshotExcludedItems(recorded?.lower)
      : snapshotExcludedItems(recorded?.antelopeX)
  return {
    competitorId: listing?.competitor_id || competitorId,
    otaPlatform: initialOtaPlatform(listing?.ota_platform, otaPlatform, channels),
    listingUrl: listing?.listing_url || '',
    listingTitle: listing?.listing_title || '',
    mappedProductId: listing?.mapped_product_id || productId || '',
    mappedChannelId: listing?.mapped_channel_id || '',
    hasLower: listing?.has_lower !== false,
    hasAntelopeX: listing?.has_antelope_x !== false,
    hasAllInclusive: offer.all,
    hasSalePlusExcluded: offer.sale,
    watchEnabled: listing?.watch_enabled !== false,
    durationNote: listing?.duration_note || '',
    pickupNote: listing?.pickup_note || '',
    groupSizeNote: listing?.group_size_note || '',
    cancellationNote: listing?.cancellation_note || '',
    languageNote: listing?.language_note || '',
    itineraryNote: listing?.itinerary_note || '',
    diffNotes: listing?.diff_notes || '',
    fromPrice: asPriceInput(recorded?.from?.adult_sale_price),
    lowerSale: asPriceInput(recorded?.lower?.adult_sale_price),
    antelopeXSale: asPriceInput(recorded?.antelopeX?.adult_sale_price),
    discountEnabled: Boolean(
      recorded?.from?.discount_enabled ||
        recorded?.lower?.discount_enabled ||
        recorded?.antelopeX?.discount_enabled ||
        (recorded?.from?.discount_percent || 0) > 0 ||
        (recorded?.lower?.discount_percent || 0) > 0 ||
        (recorded?.antelopeX?.discount_percent || 0) > 0
    ),
    discountPercent: String(
      recorded?.from?.discount_percent ||
        recorded?.lower?.discount_percent ||
        recorded?.antelopeX?.discount_percent ||
        ''
    ).replace(/^0$/, ''),
    excludedItems: excluded,
    inclusionItems: parseInclusionMap(listing?.inclusion_items, offer.all, compareItems),
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
  defaultProductId,
  defaultOtaPlatform,
  snapshots = [],
  competitors,
  products,
  channels,
  compareItems = [],
  isKo,
  onSave,
  onCancel,
}: {
  defaultCompetitorId?: string | undefined
  defaultProductId?: string | undefined
  defaultOtaPlatform?: string | undefined
  snapshots?: MarketSnapshot[]
  listing: MarketListing | null
  competitors: MarketCompetitor[]
  products: MarketCatalogProduct[]
  channels: MarketCatalogChannel[]
  compareItems?: readonly MarketCompareItemDef[]
  isKo: boolean
  onSave: (draft: ListingDraft) => Promise<void>
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<ListingDraft>(() =>
    listingToDraft(
      listing,
      defaultCompetitorId || competitors[0]?.id || '',
      defaultProductId,
      defaultOtaPlatform,
      snapshots,
      compareItems,
      channels
    )
  )
  const otaOptions = otaSelectOptions(channels, draft.otaPlatform, isKo)
  const selectedOta =
    otaOptions.find(
      (option) => option.platform === draft.otaPlatform || option.value === draft.otaPlatform
    ) || null
  const registeredOta = companyOtaChannels(channels)
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof ListingDraft>(key: K, value: ListingDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }))
  const selectedLanguages = parseListingLanguages(draft.languageNote)

  return (
    <div className="space-y-4">
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
            <Label>{isKo ? 'OTA 채널' : 'OTA channel'}</Label>
            <p className="text-xs text-muted-foreground">
              {registeredOta.length > 0
                ? isKo
                  ? '채널 관리에 등록된 OTA 중에서 고릅니다.'
                  : 'Choose an OTA channel registered for this company.'
                : isKo
                  ? '등록된 OTA 채널이 없습니다. 채널 관리에서 분류를 OTA로 저장하면 여기에 나타납니다.'
                  : 'No OTA channels are registered yet. Mark a channel as OTA in channel settings.'}
            </p>
            <Select
              {...(selectedOta?.value ? { value: selectedOta.value } : {})}
              onValueChange={(value) => {
                const picked = otaOptions.find((option) => option.value === value)
                if (picked) set('otaPlatform', picked.platform)
              }}
            >
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue placeholder={isKo ? 'OTA 채널 선택' : 'Select an OTA channel'} />
              </SelectTrigger>
              <SelectContent>
                {otaOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
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
            <Label>{isKo ? '비교할 자사 상품' : 'Our product to compare'}</Label>
            <p className="text-xs text-muted-foreground">
              {isKo
                ? '이 경쟁사 리스팅과 맞춰 볼 Kovegas 상품입니다. 고르면 비교 표에 자사 가격이 같이 나옵니다.'
                : 'Maps this competitor listing to a Kovegas product so our price appears in the compare grid.'}
            </p>
            <Select value={draft.mappedProductId || '__none'} onValueChange={(v) => set('mappedProductId', v === '__none' ? '' : v)}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder={isKo ? '선택' : 'Select'} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">{isKo ? '비교 안 함' : 'Skip compare'}</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{productLabel(p, isKo)} ({p.id})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{isKo ? '비교할 자사 채널' : 'Our channel to compare'}</Label>
            <p className="text-xs text-muted-foreground">
              {isKo
                ? '같은 OTA의 자사 판매가와 맞춥니다. 자동이면 위에서 고른 OTA에 맞춰 비교합니다.'
                : 'Uses our price on the same OTA. Auto follows the OTA selected above.'}
            </p>
            <Select value={draft.mappedChannelId || '__none'} onValueChange={(v) => set('mappedChannelId', v === '__none' ? '' : v)}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">{isKo ? '자동 (선택한 OTA)' : 'Auto (this OTA)'}</SelectItem>
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
          <Check checked={draft.watchEnabled} onChange={(v) => set('watchEnabled', v)} label={isKo ? '일 1회 자동 수집' : 'Daily fetch'} />
        </div>
        <MarketResearchInclusionItemsEditor
          values={draft.inclusionItems}
          onChange={(next) => {
            const sale = inclusionHasExcluded(next)
            setDraft((prev) => ({
              ...prev,
              inclusionItems: next,
              hasAllInclusive: !sale,
              hasSalePlusExcluded: sale,
            }))
          }}
          amounts={draft.excludedItems}
          onAmountsChange={(items) => set('excludedItems', items)}
          showAmounts
          isKo={isKo}
          items={compareItems}
        />
        <div className="space-y-2">
          <Label>{isKo ? '가격 유형' : 'Price type'}</Label>
          <p className="text-xs text-muted-foreground">
            {isKo ? '이 리스팅이 보여주는 가격 방식 하나를 고릅니다.' : 'Pick the one price style this listing uses.'}
          </p>
          <MarketResearchToggleChips
            selected={[draft.hasSalePlusExcluded ? 'sale_plus_excluded' : 'all_inclusive']}
            onChange={(next) => {
              const sale = next[0] === 'sale_plus_excluded'
              setDraft((prev) => ({
                ...prev,
                hasAllInclusive: !sale,
                hasSalePlusExcluded: sale,
                inclusionItems: parseInclusionMap({}, !sale),
              }))
            }}
            options={[
              { id: 'all_inclusive', label: isKo ? '전체포함가' : 'All-inclusive' },
              { id: 'sale_plus_excluded', label: isKo ? '판매가+불포함' : 'Sale + excluded' },
            ]}
          />
        </div>
        <MarketResearchOfferPriceFields
          isKo={isKo}
          allInclusive={!draft.hasSalePlusExcluded}
          hasLower={draft.hasLower}
          hasAntelopeX={draft.hasAntelopeX}
          fromPrice={draft.fromPrice}
          lowerSale={draft.lowerSale}
          antelopeXSale={draft.antelopeXSale}
          discountEnabled={draft.discountEnabled}
          discountPercent={draft.discountPercent}
          onFromPrice={(value) => set('fromPrice', value)}
          onLowerSale={(value) => set('lowerSale', value)}
          onAntelopeXSale={(value) => set('antelopeXSale', value)}
          onDiscountEnabled={(value) => set('discountEnabled', value)}
          onDiscountPercent={(value) => set('discountPercent', value)}
        />
        <div className="space-y-2">
          <Label>{isKo ? '언어' : 'Languages'}</Label>
          <p className="text-xs text-muted-foreground">
            {isKo ? '이 리스팅이 제공하는 가이드 언어를 여러 개 고를 수 있습니다.' : 'Select every guide language this listing offers.'}
          </p>
          <MarketResearchToggleChips
            multiple
            selected={selectedLanguages}
            onChange={(next) => set('languageNote', formatListingLanguages(next))}
            options={MARKET_LISTING_LANGUAGES.map((row) => ({
              id: row.id,
              label: listingLanguageLabel(row.id, isKo),
            }))}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Input placeholder={isKo ? '소요시간 차이' : 'Duration'} value={draft.durationNote} onChange={(e) => set('durationNote', e.target.value)} className="h-11 rounded-xl" />
          <Input placeholder={isKo ? '픽업' : 'Pickup'} value={draft.pickupNote} onChange={(e) => set('pickupNote', e.target.value)} className="h-11 rounded-xl" />
          <Input placeholder={isKo ? '그룹 규모' : 'Group size'} value={draft.groupSizeNote} onChange={(e) => set('groupSizeNote', e.target.value)} className="h-11 rounded-xl" />
          <Input placeholder={isKo ? '취소 정책' : 'Cancellation'} value={draft.cancellationNote} onChange={(e) => set('cancellationNote', e.target.value)} className="h-11 rounded-xl" />
          <Input placeholder={isKo ? '일정 요약' : 'Itinerary'} value={draft.itineraryNote} onChange={(e) => set('itineraryNote', e.target.value)} className="h-11 rounded-xl md:col-span-2" />
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
                await onSave({
                  ...draft,
                  hasAllInclusive: !inclusionHasExcluded(draft.inclusionItems),
                  hasSalePlusExcluded: inclusionHasExcluded(draft.inclusionItems),
                })
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
    </div>
  )
}
