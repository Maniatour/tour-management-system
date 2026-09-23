'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { listingOptionOffer, listingObservedMeta, listingRecordedPrices } from '@/lib/market-research/prices'
import { labelForOta } from '@/lib/market-research/otaChannels'
import {
  compareItemDefsFromCatalog,
  inclusionHasExcluded,
  parseInclusionMap,
  serializeExcludedItems,
  snapshotExcludedItems,
  sumExcludedItems,
  type MarketInclusionMap,
} from '@/lib/market-research/excludedItems'
import type { MarketExcludedItem, MarketListingBadge } from '@/lib/market-research/types'
import { MarketResearchInclusionItemsEditor } from './MarketResearchInclusionItemsEditor'
import { MarketResearchObservedMetaFields } from './MarketResearchObservedMetaFields'
import { MarketResearchOfferPriceFields } from './MarketResearchOfferPriceFields'
import type { MarketResearchBundle } from './helpers'

function asPriceInput(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? '' : String(value)
}

export function MarketResearchPriceEntryForm({
  bundle,
  isKo,
  defaultListingId,
  onSave,
  onCreateBadge,
}: {
  bundle: MarketResearchBundle
  isKo: boolean
  defaultListingId?: string | undefined
  onCreateBadge: (label: string) => Promise<string>
  onSave: (input: {
    listingId: string
    fromPrice: number | null
    lowerSale: number | null
    antelopeXSale: number | null
    lowerNotIncluded: number | null
    antelopeXNotIncluded: number | null
    lowerExcludedItems: MarketExcludedItem[]
    antelopeXExcludedItems: MarketExcludedItem[]
    offer: 'all_inclusive' | 'sale_plus_excluded'
    rating?: number | null
    reviewCount?: number | null
    badges?: MarketListingBadge[]
    inclusionItems?: MarketInclusionMap
    discountEnabled?: boolean
    discountPercent?: number
  }) => Promise<void>
}) {
  const [listingId, setListingId] = useState(defaultListingId || bundle.listings[0]?.id || '')
  const listing = bundle.listings.find((row) => row.id === listingId)
  const [fromPrice, setFromPrice] = useState('')
  const [lowerSale, setLowerSale] = useState('')
  const [antelopeXSale, setAntelopeXSale] = useState('')
  const [discountEnabled, setDiscountEnabled] = useState(false)
  const [discountPercent, setDiscountPercent] = useState('')
  const [excludedItems, setExcludedItems] = useState<MarketExcludedItem[]>([])
  const compareItems = compareItemDefsFromCatalog(bundle.compareItems)
  const [inclusionItems, setInclusionItems] = useState<MarketInclusionMap>(() =>
    parseInclusionMap(
      listing?.inclusion_items,
      listing ? listingOptionOffer(listing) === 'all_inclusive' : true,
      compareItems
    )
  )
  const [rating, setRating] = useState('')
  const [reviewCount, setReviewCount] = useState('')
  const [badgeIds, setBadgeIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const nameByCompetitor = new Map(bundle.competitors.map((row) => [row.id, row.name]))
  const money = (value: string) => (value.trim() === '' ? null : Number(value))
  const hasAnyPrice = Boolean(fromPrice || lowerSale || antelopeXSale)

  useEffect(() => {
    if (defaultListingId) setListingId(defaultListingId)
  }, [defaultListingId])

  useEffect(() => {
    if (!listingId) return
    const recorded = listingRecordedPrices(bundle.snapshots, listingId)
    setFromPrice(asPriceInput(recorded.from?.adult_sale_price))
    setLowerSale(asPriceInput(recorded.lower?.adult_sale_price))
    setAntelopeXSale(asPriceInput(recorded.antelopeX?.adult_sale_price))
    const percent =
      recorded.from?.discount_percent ||
      recorded.lower?.discount_percent ||
      recorded.antelopeX?.discount_percent ||
      0
    setDiscountEnabled(Boolean(recorded.from?.discount_enabled || recorded.lower?.discount_enabled || recorded.antelopeX?.discount_enabled || percent > 0))
    setDiscountPercent(percent > 0 ? String(percent) : '')
    const lowerExcluded = snapshotExcludedItems(recorded.lower)
    const xExcluded = snapshotExcludedItems(recorded.antelopeX)
    const amounts = (lowerExcluded.length ? lowerExcluded : xExcluded).map((item) =>
      item.id === 'meals' ? { ...item, id: 'lunch', label: item.label } : item
    )
    setExcludedItems(amounts)
    const listingRow = bundle.listings.find((row) => row.id === listingId)
    setInclusionItems(
      parseInclusionMap(
        listingRow?.inclusion_items,
        listingRow ? listingOptionOffer(listingRow) === 'all_inclusive' : true,
        compareItemDefsFromCatalog(bundle.compareItems)
      )
    )
    setRating(asPriceInput(recorded.from?.rating ?? recorded.lower?.rating ?? recorded.antelopeX?.rating))
    setReviewCount(
      asPriceInput(recorded.from?.review_count ?? recorded.lower?.review_count ?? recorded.antelopeX?.review_count)
    )
    setBadgeIds(listingObservedMeta(bundle.snapshots, listingId).badges.map((row) => row.id))
  }, [listingId, bundle.snapshots, bundle.listings, bundle.compareItems])

  const allInclusive = !inclusionHasExcluded(inclusionItems)

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {isKo
          ? '리스팅에 저장한 포함/불포함 항목이 그대로 선택됩니다. 오늘 조사한 금액만 고치면 됩니다.'
          : 'Included / not-included items come from the listing. Update today’s amounts as needed.'}
      </p>
      <div className="space-y-2">
        <Label>{isKo ? '리스팅' : 'Listing'}</Label>
        <Select value={listingId} onValueChange={setListingId}>
          <SelectTrigger className="h-11 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {bundle.listings.map((row) => (
              <SelectItem key={row.id} value={row.id}>
                {nameByCompetitor.get(row.competitor_id)} · {labelForOta(row.ota_platform, bundle.channels, isKo)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <MarketResearchInclusionItemsEditor
        values={inclusionItems}
        onChange={setInclusionItems}
        amounts={excludedItems}
        onAmountsChange={setExcludedItems}
        showAmounts
        isKo={isKo}
        items={compareItems}
      />
      <MarketResearchOfferPriceFields
        isKo={isKo}
        allInclusive={allInclusive}
        hasLower={listing?.has_lower !== false}
        hasAntelopeX={listing?.has_antelope_x !== false}
        fromPrice={fromPrice}
        lowerSale={lowerSale}
        antelopeXSale={antelopeXSale}
        discountEnabled={discountEnabled}
        discountPercent={discountPercent}
        onFromPrice={setFromPrice}
        onLowerSale={setLowerSale}
        onAntelopeXSale={setAntelopeXSale}
        onDiscountEnabled={setDiscountEnabled}
        onDiscountPercent={setDiscountPercent}
      />
      <MarketResearchObservedMetaFields
        observedOn={bundle.today}
        badges={bundle.badges}
        selectedBadgeIds={badgeIds}
        onBadgesChange={setBadgeIds}
        onCreateBadge={onCreateBadge}
        rating={rating}
        reviewCount={reviewCount}
        onRatingChange={setRating}
        onReviewCountChange={setReviewCount}
        isKo={isKo}
      />
      <Button
        className="h-11 rounded-xl"
        disabled={saving || !listingId || !hasAnyPrice}
        onClick={async () => {
          setSaving(true)
          try {
            const items = allInclusive
              ? []
              : serializeExcludedItems(excludedItems.filter((row) => inclusionItems[row.id] === 'excluded'))
            const excludedTotal = items.length ? sumExcludedItems(items) : 0
            await onSave({
              listingId,
              fromPrice: money(fromPrice),
              lowerSale: listing?.has_lower === false ? null : money(lowerSale),
              antelopeXSale: listing?.has_antelope_x === false ? null : money(antelopeXSale),
              lowerNotIncluded: allInclusive ? 0 : excludedTotal,
              antelopeXNotIncluded: allInclusive ? 0 : excludedTotal,
              lowerExcludedItems: items,
              antelopeXExcludedItems: items,
              offer: allInclusive ? 'all_inclusive' : 'sale_plus_excluded',
              rating: rating ? Number(rating) : null,
              reviewCount: reviewCount ? Number(reviewCount) : null,
              badges: badgeIds.map((id) => {
                const row = bundle.badges.find((item) => item.badge_id === id)
                return { id, label: row ? (isKo ? row.label_ko : row.label_en) : id }
              }),
              inclusionItems,
              discountEnabled,
              discountPercent: discountEnabled ? Number(discountPercent) || 0 : 0,
            })
          } finally {
            setSaving(false)
          }
        }}
      >
        {isKo ? '가격 저장' : 'Save prices'}
      </Button>
    </div>
  )
}
