'use client'

import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { MarketCatalogProduct, MarketFocusProduct } from '@/lib/market-research/types'
import { productLabel } from './helpers'

export function MarketResearchFocusProductModal({
  products,
  focusProducts,
  isKo,
  onAdd,
  onDelete,
}: {
  products: MarketCatalogProduct[]
  focusProducts: MarketFocusProduct[]
  isKo: boolean
  onAdd: (productId: string) => Promise<void>
  onDelete: (productId: string) => Promise<void>
}) {
  const focusedIds = new Set(focusProducts.map((row) => row.product_id))
  const available = products.filter((row) => !focusedIds.has(row.id))
  const [productId, setProductId] = useState(available[0]?.id || '')
  const [busy, setBusy] = useState(false)
  const selected = useMemo(
    () => products.filter((row) => focusedIds.has(row.id)),
    [products, focusProducts]
  )

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {isKo
          ? '비교 탭에 보여줄 자사 상품입니다. 지금은 밤도깨비부터 시작하면 됩니다.'
          : 'Choose which of our tours appear as comparison tabs.'}
      </p>
      <div className="space-y-2">
        {selected.map((product) => (
          <div
            key={product.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-4 py-3"
          >
            <span className="font-medium">{productLabel(product, isKo) || product.id}</span>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await onDelete(product.id)
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
        {selected.length === 0 ? (
          <p className="text-sm text-muted-foreground">{isKo ? '선택된 상품이 없습니다.' : 'No products selected.'}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label>{isKo ? '상품 추가' : 'Add product'}</Label>
        <div className="flex gap-2">
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger className="h-11 rounded-xl">
              <SelectValue placeholder={isKo ? '상품 선택' : 'Select product'} />
            </SelectTrigger>
            <SelectContent>
              {available.map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {productLabel(row, isKo) || row.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="h-11 rounded-xl"
            disabled={busy || !productId}
            onClick={async () => {
              setBusy(true)
              try {
                await onAdd(productId)
                setProductId(available.find((row) => row.id !== productId)?.id || '')
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
