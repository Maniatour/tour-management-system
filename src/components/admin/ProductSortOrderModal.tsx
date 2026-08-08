'use client'

import { useState, useEffect } from 'react'
import { X, ChevronUp, ChevronDown, GripVertical, ListOrdered } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import { useOperatorOptional } from '@/contexts/OperatorContext'
import { resolveOperatorId, withOperatorId } from '@/lib/operators/scopeQuery'
import { isAdminProductSoftDeleted } from '@/lib/adminProductDelete'

type Product = Database['public']['Tables']['products']['Row']

interface ProductSortOrderModalProps {
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
  locale: string
}

export default function ProductSortOrderModal({
  isOpen,
  onClose,
  onUpdate,
  locale,
}: ProductSortOrderModalProps) {
  const { operatorId } = useOperatorOptional()
  const [orderedProducts, setOrderedProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  useEffect(() => {
    if (isOpen) {
      void fetchProducts()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, operatorId])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const { data, error } = await withOperatorId(
        supabase.from('products').select('*'),
        operatorId
      )
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })

      if (error) {
        console.error('Failed to fetch products for sort order:', error)
        return
      }

      const rows = ((data || []) as Product[]).filter(
        (p) => !isAdminProductSoftDeleted((p as { status?: string | null }).status)
      )
      setOrderedProducts(rows)
    } catch (error) {
      console.error('Error fetching products for sort order:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMoveUp = async (index: number) => {
    if (index === 0) return

    const next = [...orderedProducts]
    const [moved] = next.splice(index, 1)
    next.splice(index - 1, 0, moved)
    await updateOrder(next)
  }

  const handleMoveDown = async (index: number) => {
    if (index === orderedProducts.length - 1) return

    const next = [...orderedProducts]
    const [moved] = next.splice(index, 1)
    next.splice(index + 1, 0, moved)
    await updateOrder(next)
  }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', '')
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      return
    }

    const next = [...orderedProducts]
    const [moved] = next.splice(draggedIndex, 1)
    next.splice(dropIndex, 0, moved)

    setDraggedIndex(null)
    setDragOverIndex(null)
    await updateOrder(next)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const updateOrder = async (reorderedProducts: Product[]) => {
    try {
      setSaving(true)
      const opId = resolveOperatorId(operatorId)

      const results = await Promise.all(
        reorderedProducts.map((product, index) =>
          supabase
            .from('products')
            .update({ sort_order: index })
            .eq('id', product.id)
            .eq('operator_id', opId)
        )
      )

      const hasError = results.some((result) => result.error)
      if (hasError) {
        const errors = results.filter((result) => result.error).map((result) => result.error)
        console.error('Error updating product sort orders:', errors)
        alert(locale === 'en' ? 'Failed to update order.' : '순서 변경 중 오류가 발생했습니다.')
        await fetchProducts()
        return
      }

      setOrderedProducts(reorderedProducts)
      onUpdate()
    } catch (error) {
      console.error('Error updating product sort order:', error)
      alert(locale === 'en' ? 'Failed to update order.' : '순서 변경 중 오류가 발생했습니다.')
      await fetchProducts()
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <ListOrdered className="text-primary" size={24} />
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {locale === 'en' ? 'Product display order' : '상품 순서 조정'}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {locale === 'en'
                  ? 'Drag or use arrows. Lower numbers appear first on the catalog.'
                  : '드래그하거나 화살표로 순서를 변경합니다. 위쪽 상품이 목록에 먼저 표시됩니다.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label={locale === 'en' ? 'Close' : '닫기'}
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : orderedProducts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">
                {locale === 'en' ? 'No products found.' : '표시할 상품이 없습니다.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {orderedProducts.map((product, index) => (
                <div
                  key={product.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`
                    flex items-center space-x-4 p-4 border rounded-lg transition-all
                    ${draggedIndex === index ? 'opacity-50 bg-primary/5' : ''}
                    ${dragOverIndex === index ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}
                    ${saving ? 'opacity-50 pointer-events-none' : 'cursor-move'}
                  `}
                >
                  <div className="text-gray-400">
                    <GripVertical size={20} />
                  </div>

                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">
                    {index + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
                    {product.name_en ? (
                      <p className="text-sm text-gray-500 truncate">{product.name_en}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {product.category ? (
                        <span className="inline-block px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">
                          {product.category}
                        </span>
                      ) : null}
                      {product.status ? (
                        <span className="inline-block px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded">
                          {product.status}
                        </span>
                      ) : null}
                      {product.is_published === false ? (
                        <span className="inline-block px-2 py-0.5 text-xs bg-amber-50 text-amber-700 rounded">
                          {locale === 'en' ? 'Unpublished' : '미게시'}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-col space-y-1">
                    <button
                      type="button"
                      onClick={() => void handleMoveUp(index)}
                      disabled={index === 0 || saving}
                      className={`
                        p-1 rounded hover:bg-gray-200 transition-colors
                        ${index === 0 || saving ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                      title={locale === 'en' ? 'Move up' : '위로 이동'}
                    >
                      <ChevronUp size={16} className="text-gray-600" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleMoveDown(index)}
                      disabled={index === orderedProducts.length - 1 || saving}
                      className={`
                        p-1 rounded hover:bg-gray-200 transition-colors
                        ${index === orderedProducts.length - 1 || saving ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                      title={locale === 'en' ? 'Move down' : '아래로 이동'}
                    >
                      <ChevronDown size={16} className="text-gray-600" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            {locale === 'en' ? 'Close' : '닫기'}
          </button>
        </div>
      </div>
    </div>
  )
}
