'use client'

import React, { useState, useEffect } from 'react'
import { X, ChevronUp, ChevronDown, GripVertical, Star } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

type Product = Database['public']['Tables']['products']['Row']

interface FavoriteOrderModalProps {
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
  locale: string
}

export default function FavoriteOrderModal({ isOpen, onClose, onUpdate, locale }: FavoriteOrderModalProps) {
  const [favoriteProducts, setFavoriteProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  useEffect(() => {
    if (isOpen) {
      fetchFavoriteProducts()
    }
  }, [isOpen])

  const fetchFavoriteProducts = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_favorite', true)
        .order('favorite_order', { ascending: true, nullsLast: true })

      if (error) {
        console.error('Failed to fetch favorite products:', error)
        return
      }

      setFavoriteProducts(data || [])
    } catch (error) {
      console.error('Error fetching favorite products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMoveUp = async (index: number) => {
    if (index === 0) return

    const newProducts = [...favoriteProducts]
    const [movedProduct] = newProducts.splice(index, 1)
    newProducts.splice(index - 1, 0, movedProduct)

    await updateOrder(newProducts)
  }

  const handleMoveDown = async (index: number) => {
    if (index === favoriteProducts.length - 1) return

    const newProducts = [...favoriteProducts]
    const [movedProduct] = newProducts.splice(index, 1)
    newProducts.splice(index + 1, 0, movedProduct)

    await updateOrder(newProducts)
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

    const newProducts = [...favoriteProducts]
    const [movedProduct] = newProducts.splice(draggedIndex, 1)
    newProducts.splice(dropIndex, 0, movedProduct)

    setDraggedIndex(null)
    setDragOverIndex(null)

    await updateOrder(newProducts)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const updateOrder = async (reorderedProducts: Product[]) => {
    try {
      setSaving(true)

      // 모든 상품의 favorite_order를 0부터 순차적으로 재할당
      const updatePromises = reorderedProducts.map((product, index) =>
        supabase
          .from('products')
          .update({ favorite_order: index })
          .eq('id', product.id)
      )

      const results = await Promise.all(updatePromises)

      const hasError = results.some(result => result.error)
      if (hasError) {
        const errors = results.filter(result => result.error).map(result => result.error)
        console.error('Error updating favorite orders:', errors)
        alert(locale === 'en' ? 'Failed to update order.' : '순서 변경 중 오류가 발생했습니다.')
        await fetchFavoriteProducts() // 원래 상태로 복원
        return
      }

      setFavoriteProducts(reorderedProducts)
      onUpdate() // 부모 컴포넌트에 업데이트 알림
    } catch (error) {
      console.error('Error updating favorite order:', error)
      alert(locale === 'en' ? 'Failed to update order.' : '순서 변경 중 오류가 발생했습니다.')
      await fetchFavoriteProducts() // 원래 상태로 복원
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <Star className="text-yellow-500" size={24} />
            <h2 className="text-xl font-bold text-gray-900">
              {locale === 'en' ? 'Favorite Products Order' : '즐겨찾기 상품 순서 조정'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* 내용 */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : favoriteProducts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">
                {locale === 'en' ? 'No favorite products found.' : '즐겨찾기된 상품이 없습니다.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {favoriteProducts.map((product, index) => (
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
                    ${draggedIndex === index ? 'opacity-50 bg-blue-50' : ''}
                    ${dragOverIndex === index ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
                    ${saving ? 'opacity-50 pointer-events-none' : 'cursor-move'}
                  `}
                >
                  {/* 드래그 핸들 */}
                  <div className="text-gray-400">
                    <GripVertical size={20} />
                  </div>

                  {/* 순서 번호 */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-semibold text-sm">
                    {index + 1}
                  </div>

                  {/* 상품 정보 */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {product.name}
                    </h3>
                    {product.name_en && (
                      <p className="text-sm text-gray-500 truncate">
                        {product.name_en}
                      </p>
                    )}
                    {product.category && (
                      <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">
                        {product.category}
                      </span>
                    )}
                  </div>

                  {/* 순서 조정 버튼 */}
                  <div className="flex flex-col space-y-1">
                    <button
                      onClick={() => handleMoveUp(index)}
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
                      onClick={() => handleMoveDown(index)}
                      disabled={index === favoriteProducts.length - 1 || saving}
                      className={`
                        p-1 rounded hover:bg-gray-200 transition-colors
                        ${index === favoriteProducts.length - 1 || saving ? 'opacity-50 cursor-not-allowed' : ''}
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

        {/* 푸터 */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
          <button
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

