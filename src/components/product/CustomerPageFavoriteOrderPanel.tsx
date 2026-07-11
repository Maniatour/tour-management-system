'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, GripVertical, Loader2, Star } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

type Product = Database['public']['Tables']['products']['Row']

type CustomerPageFavoriteOrderPanelProps = {
  locale: string
  onSaved?: () => void
}

export default function CustomerPageFavoriteOrderPanel({
  locale,
  onSaved,
}: CustomerPageFavoriteOrderPanelProps) {
  const [favoriteProducts, setFavoriteProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const fetchFavoriteProducts = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_favorite', true)
        .order('favorite_order', { ascending: true })

      if (error) {
        console.error('Failed to fetch favorite products:', error)
        return
      }

      setFavoriteProducts((data || []) as Product[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchFavoriteProducts()
  }, [fetchFavoriteProducts])

  const updateOrder = async (newProducts: Product[]) => {
    setSaving(true)
    try {
      await Promise.all(
        newProducts.map((product, index) =>
          supabase.from('products').update({ favorite_order: index }).eq('id', product.id)
        )
      )
      setFavoriteProducts(newProducts)
      onSaved?.()
    } catch (error) {
      console.error('Error updating favorite order:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleMoveUp = async (index: number) => {
    if (index === 0) return
    const newProducts = [...favoriteProducts]
    const [moved] = newProducts.splice(index, 1)
    newProducts.splice(index - 1, 0, moved)
    await updateOrder(newProducts)
  }

  const handleMoveDown = async (index: number) => {
    if (index === favoriteProducts.length - 1) return
    const newProducts = [...favoriteProducts]
    const [moved] = newProducts.splice(index, 1)
    newProducts.splice(index + 1, 0, moved)
    await updateOrder(newProducts)
  }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      return
    }
    const newProducts = [...favoriteProducts]
    const [moved] = newProducts.splice(draggedIndex, 1)
    newProducts.splice(dropIndex, 0, moved)
    setDraggedIndex(null)
    setDragOverIndex(null)
    await updateOrder(newProducts)
  }

  const getDisplayName = (product: Product) => {
    if (locale === 'en') {
      return product.customer_name_en || product.name_en || product.name
    }
    return product.customer_name_ko || product.name_ko || product.name
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        불러오는 중…
      </div>
    )
  }

  if (favoriteProducts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600">
        즐겨찾기된 상품이 없습니다. 상품 관리에서 즐겨찾기를 설정하면 홈 추천 투어에 표시됩니다.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        홈 「추천 투어」 섹션에 표시되는 상품 순서입니다. 위로 올릴수록 먼저 노출됩니다.
      </p>
      <ul className="space-y-2">
        {favoriteProducts.map((product, index) => (
          <li
            key={product.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => void handleDrop(e, index)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 bg-white ${
              dragOverIndex === index ? 'border-blue-400 bg-primary/5' : 'border-gray-200'
            }`}
          >
            <GripVertical className="h-4 w-4 text-gray-400 shrink-0 cursor-grab" />
            <Star className="h-4 w-4 text-amber-500 shrink-0" />
            <span className="flex-1 text-sm text-gray-900 truncate">{getDisplayName(product)}</span>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                disabled={saving || index === 0}
                onClick={() => void handleMoveUp(index)}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                aria-label="위로"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={saving || index === favoriteProducts.length - 1}
                onClick={() => void handleMoveDown(index)}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                aria-label="아래로"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
      {saving && (
        <p className="text-xs text-gray-500 flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          순서 저장 중…
        </p>
      )}
    </div>
  )
}
