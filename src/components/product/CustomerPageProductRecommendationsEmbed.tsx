'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Search, Trash2 } from 'lucide-react'
import {
  PRODUCT_RECOMMENDATION_SECTIONS,
  fetchRecommendationEditorProducts,
  fetchSelectedRecommendationIds,
  getProductRecommendationTitle,
  saveProductRecommendationIds,
  type ProductRecommendationEditorProduct,
  type ProductRecommendationSectionKey,
} from '@/lib/productRecommendations'

type CustomerPageProductRecommendationsEmbedProps = {
  productId: string
  sectionKey: ProductRecommendationSectionKey
  locale: string
  onSaved?: () => void
  onDirtyChange?: (dirty: boolean) => void
}

function isRecommendationSectionKey(value: string): value is ProductRecommendationSectionKey {
  return PRODUCT_RECOMMENDATION_SECTIONS.some((section) => section.key === value)
}

export function sectionKeyFromRecommendationTab(tab: string): ProductRecommendationSectionKey {
  const key = tab.replace('detail-recommendations-', '')
  if (key === 'viewed') return 'traveler_viewed'
  if (key === 'for-you') return 'recommended_for_you'
  if (key === 'bought-together') return 'bought_together'
  if (isRecommendationSectionKey(key)) return key
  return 'traveler_viewed'
}

export default function CustomerPageProductRecommendationsEmbed({
  productId,
  sectionKey,
  locale,
  onSaved,
  onDirtyChange,
}: CustomerPageProductRecommendationsEmbedProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [products, setProducts] = useState<ProductRecommendationEditorProduct[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null)

  const title = getProductRecommendationTitle(sectionKey, locale)

  const loadData = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const [allProducts, selected] = await Promise.all([
        fetchRecommendationEditorProducts(locale),
        fetchSelectedRecommendationIds(productId, sectionKey),
      ])
      const filteredProducts = allProducts.filter((product) => product.id !== productId)
      setProducts(filteredProducts)
      setSelectedIds(selected.filter((id) => id !== productId))
      setInitialSnapshot(JSON.stringify(selected.filter((id) => id !== productId)))
    } catch (error) {
      console.error('추천 상품 편집 데이터 로드 오류:', error)
      setMessage('추천 상품 데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [locale, productId, sectionKey])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (!onDirtyChange || !initialSnapshot) return
    onDirtyChange(JSON.stringify(selectedIds) !== initialSnapshot)
  }, [initialSnapshot, onDirtyChange, selectedIds])

  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  )

  const selectedProducts = selectedIds
    .map((id) => productMap.get(id))
    .filter((product): product is ProductRecommendationEditorProduct => product != null)

  const filteredProducts = products.filter((product) => {
    if (selectedIds.includes(product.id)) return false
    const needle = searchTerm.trim().toLowerCase()
    if (!needle) return product.status === 'active'
    return [product.title, product.locationLine, product.category]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle))
  })

  const addProduct = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }

  const removeProduct = (id: string) => {
    setSelectedIds((prev) => prev.filter((selectedId) => selectedId !== id))
  }

  const moveProduct = (id: string, direction: 'up' | 'down') => {
    setSelectedIds((prev) => {
      const index = prev.indexOf(id)
      if (index < 0) return prev
      const nextIndex = direction === 'up' ? index - 1 : index + 1
      if (nextIndex < 0 || nextIndex >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.splice(nextIndex, 0, item)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await saveProductRecommendationIds(productId, sectionKey, selectedIds)
      setInitialSnapshot(JSON.stringify(selectedIds))
      setMessage('저장되었습니다.')
      onSaved?.()
    } catch (error) {
      console.error('추천 상품 저장 오류:', error)
      setMessage('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        추천 상품 불러오는 중…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-muted-foreground">
          DB: <code className="rounded bg-muted px-1">product_recommendations</code>
        </p>
        <h4 className="mt-1 text-sm font-semibold text-foreground">{title}</h4>
        <p className="mt-0.5 text-xs text-muted-foreground">
          선택한 순서대로 고객 상세 페이지 하단 카드 레일에 표시됩니다.
        </p>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h5 className="text-sm font-semibold text-foreground">
            노출 상품 ({selectedProducts.length})
          </h5>
          {selectedProducts.length > 0 ? (
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-xs font-medium text-red-600 hover:text-red-700"
            >
              모두 비우기
            </button>
          ) : null}
        </div>

        {selectedProducts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-5 text-center text-sm text-muted-foreground">
            아직 선택된 상품이 없습니다.
          </div>
        ) : (
          <div className="space-y-2">
            {selectedProducts.map((product, index) => (
              <div
                key={product.id}
                className="flex items-center gap-3 rounded-lg border border-border/60 bg-background px-3 py-2"
              >
                <span className="w-6 text-xs font-semibold text-muted-foreground">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{product.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {product.locationLine || product.category || '위치 정보 없음'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => moveProduct(product.id, 'up')}
                  disabled={index === 0}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                  aria-label="위로 이동"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveProduct(product.id, 'down')}
                  disabled={index === selectedProducts.length - 1}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                  aria-label="아래로 이동"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeProduct(product.id)}
                  className="rounded-md p-1 text-red-600 hover:bg-red-50"
                  aria-label="삭제"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="상품명, 지역, 카테고리 검색"
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        <div className="max-h-72 space-y-2 overflow-y-auto">
          {filteredProducts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              추가할 수 있는 상품이 없습니다.
            </p>
          ) : (
            filteredProducts.map((product) => (
              <div
                key={product.id}
                className="flex items-center gap-3 rounded-lg border border-border/60 bg-background px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{product.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {product.locationLine || product.category || '위치 정보 없음'}
                    {product.status !== 'active' ? ` · ${product.status}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => addProduct(product.id)}
                  className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  추가
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {message ? (
        <p className={`text-sm ${message.includes('오류') ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        저장
      </button>
    </div>
  )
}
