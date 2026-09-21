'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  compareItemDefsFromCatalog,
  inclusionHasExcluded,
  parseInclusionMap,
  serializeExcludedItems,
  type MarketInclusionMap,
} from '@/lib/market-research/excludedItems'
import { otaPlatformLabel } from '@/lib/market-research/compare'
import { defaultOurChannelSettings } from '@/lib/market-research/ourChannelSettings'
import { overlayAxisPoint, ourProductPlatformKey } from '@/lib/market-research/ourPrice'
import type { MarketExcludedItem, MarketOtaPlatform, OurChannelSettings } from '@/lib/market-research/types'
import { MarketResearchInclusionItemsEditor } from './MarketResearchInclusionItemsEditor'
import { MarketResearchOurChannelSettingsFields } from './MarketResearchOurChannelSettingsFields'
import { productLabel, type MarketResearchBundle } from './helpers'

export function MarketResearchOurOfferEditor({
  bundle,
  productId,
  otaPlatform,
  isKo,
  onSave,
  onCancel,
}: {
  bundle: MarketResearchBundle
  productId: string
  otaPlatform: MarketOtaPlatform
  isKo: boolean
  onSave: (input: {
    productId: string
    otaPlatform: MarketOtaPlatform
    inclusionItems: MarketInclusionMap
    excludedItems: MarketExcludedItem[]
    channelSettings: OurChannelSettings
  }) => Promise<void>
  onCancel: () => void
}) {
  const compareItems = compareItemDefsFromCatalog(bundle.compareItems)
  const offer = bundle.ourOffers.find(
    (row) => row.product_id === productId && row.ota_platform === otaPlatform
  )
  const [inclusionItems, setInclusionItems] = useState<MarketInclusionMap>(() =>
    parseInclusionMap(offer?.inclusion_items, true, compareItems)
  )
  const [excludedItems, setExcludedItems] = useState<MarketExcludedItem[]>(() => offer?.excluded_items || [])
  const [channelSettings, setChannelSettings] = useState<OurChannelSettings>(
    () => offer?.channel_settings || defaultOurChannelSettings()
  )
  const [saving, setSaving] = useState(false)
  const overlay = bundle.ourPlatformPrices[ourProductPlatformKey(productId, otaPlatform)]
  const lowerPoint = overlayAxisPoint(overlay, 'lower', 'all_inclusive')
  const antelopePoint = overlayAxisPoint(overlay, 'antelope_x', 'all_inclusive')
  const dynamicPercent = lowerPoint?.discountPercent ?? antelopePoint?.discountPercent ?? null
  const product = bundle.products.find((row) => row.id === productId)

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3">
        <p className="text-sm font-semibold text-blue-900">
          {productLabel(product, isKo) || productId} · {otaPlatformLabel(otaPlatform, isKo)}
        </p>
        <p className="mt-1 text-sm text-blue-800/80">
          {isKo
            ? '채널마다 할인, 판매가, 포함 항목을 따로 맞출 수 있습니다.'
            : 'Set discount, sale price, and included items separately for each channel.'}
        </p>
      </div>
      <MarketResearchOurChannelSettingsFields
        settings={channelSettings}
        onChange={setChannelSettings}
        dynamicLower={lowerPoint?.sale ?? null}
        dynamicAntelopeX={antelopePoint?.sale ?? null}
        dynamicPercent={dynamicPercent}
        isKo={isKo}
      />
      <MarketResearchInclusionItemsEditor
        values={inclusionItems}
        onChange={setInclusionItems}
        amounts={excludedItems}
        onAmountsChange={setExcludedItems}
        showAmounts
        isKo={isKo}
        items={compareItems}
      />
      <p className="text-xs text-muted-foreground">
        {isKo
          ? inclusionHasExcluded(inclusionItems)
            ? '불포함 항목이 있으면 비교 표는 판매가+불포함 기준으로 맞춥니다.'
            : '모두 포함이면 비교 표는 올인클루시브 판매가로 맞춥니다.'
          : inclusionHasExcluded(inclusionItems)
            ? 'Excluded items switch this column to sale + not-included.'
            : 'All included uses the all-inclusive sale price.'}
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" className="h-11 rounded-xl" onClick={onCancel}>
          {isKo ? '닫기' : 'Close'}
        </Button>
        <Button
          className="h-11 rounded-xl"
          disabled={saving}
          onClick={async () => {
            setSaving(true)
            try {
              await onSave({
                productId,
                otaPlatform,
                inclusionItems,
                excludedItems: serializeExcludedItems(
                  excludedItems.filter((row) => inclusionItems[row.id] === 'excluded')
                ),
                channelSettings,
              })
            } finally {
              setSaving(false)
            }
          }}
        >
          {isKo ? '저장' : 'Save'}
        </Button>
      </div>
    </div>
  )
}
