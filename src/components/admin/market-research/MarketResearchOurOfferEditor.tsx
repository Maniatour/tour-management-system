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
import type { MarketExcludedItem, MarketOtaPlatform } from '@/lib/market-research/types'
import { MarketResearchInclusionItemsEditor } from './MarketResearchInclusionItemsEditor'
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
  const [saving, setSaving] = useState(false)
  const product = bundle.products.find((row) => row.id === productId)

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3">
        <p className="text-sm font-semibold text-blue-900">
          {productLabel(product, isKo) || productId} · {otaPlatformLabel(otaPlatform, isKo)}
        </p>
        <p className="mt-1 text-sm text-blue-800/80">
          {isKo
            ? '판매가·From 가격은 자사 OTA 동적가격에서 가져옵니다. 여기에서는 포함/불포함과 불포함 금액만 정리합니다.'
            : 'Sale and From prices come from our OTA dynamic pricing. Record include/exclude items and fee amounts here.'}
        </p>
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
