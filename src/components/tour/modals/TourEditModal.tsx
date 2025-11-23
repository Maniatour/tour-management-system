'use client'

import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTranslations } from 'next-intl'

interface TourEditModalProps {
  isOpen: boolean
  tour: {
    id: string
    product_id: string
  }
  currentProduct: {
    id: string
    name_ko?: string | null
    name_en?: string | null
  } | null
  locale: string
  onClose: () => void
  onSave: (productId: string) => Promise<void>
}

interface Product {
  id: string
  name_ko?: string | null
  name_en?: string | null
  status?: string
}

export default function TourEditModal({
  isOpen,
  tour,
  currentProduct,
  locale,
  onClose,
  onSave
}: TourEditModalProps) {
  const t = useTranslations('tours')
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string>(tour.product_id)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (isOpen) {
      setSelectedProductId(tour.product_id)
      loadProducts()
    }
  }, [isOpen, tour.product_id])

  const loadProducts = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('products')
        .select('id, name_ko, name_en, status')
        .eq('status', 'active')
        .order('name_ko', { ascending: true })

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('상품 로드 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (selectedProductId === tour.product_id) {
      onClose()
      return
    }

    try {
      setSaving(true)
      await onSave(selectedProductId)
      onClose()
    } catch (error) {
      console.error('투어 업데이트 오류:', error)
      alert(locale === 'ko' ? '투어 업데이트 중 오류가 발생했습니다.' : 'Error updating tour.')
    } finally {
      setSaving(false)
    }
  }

  const filteredProducts = products.filter(product => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    const nameKo = (product.name_ko || '').toLowerCase()
    const nameEn = (product.name_en || '').toLowerCase()
    return nameKo.includes(searchLower) || nameEn.includes(searchLower)
  })

  if (!isOpen) return null

  const currentProductName = locale === 'ko' 
    ? currentProduct?.name_ko || currentProduct?.name_en || '-' 
    : currentProduct?.name_en || currentProduct?.name_ko || '-'

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {locale === 'ko' ? '투어 편집' : 'Edit Tour'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {/* 현재 투어명 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {locale === 'ko' ? '현재 투어명' : 'Current Tour Name'}
              </label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-700">
                {currentProductName}
              </div>
            </div>

            {/* 상품 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {locale === 'ko' ? '변경할 투어명 (상품)' : 'Select Product'}
              </label>
              
              {/* 검색 */}
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={locale === 'ko' ? '상품명 검색...' : 'Search products...'}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {/* 상품 목록 */}
              <div className="border border-gray-200 rounded-md max-h-64 overflow-y-auto">
                {loading ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    {locale === 'ko' ? '로딩 중...' : 'Loading...'}
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    {locale === 'ko' ? '상품을 찾을 수 없습니다.' : 'No products found.'}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {filteredProducts.map((product) => {
                      const productName = locale === 'ko' 
                        ? product.name_ko || product.name_en || product.id
                        : product.name_en || product.name_ko || product.id
                      
                      return (
                        <button
                          key={product.id}
                          onClick={() => setSelectedProductId(product.id)}
                          className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                            selectedProductId === product.id
                              ? 'bg-blue-50 border-l-4 border-blue-500'
                              : ''
                          }`}
                        >
                          <div className="flex items-center">
                            <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${
                              selectedProductId === product.id
                                ? 'border-blue-500 bg-blue-500'
                                : 'border-gray-300'
                            }`}>
                              {selectedProductId === product.id && (
                                <div className="w-2 h-2 rounded-full bg-white" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">
                                {productName}
                              </div>
                              {product.name_ko && product.name_en && (
                                <div className="text-xs text-gray-500 mt-0.5">
                                  {locale === 'ko' ? product.name_en : product.name_ko}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-2 p-4 border-t">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            {locale === 'ko' ? '취소' : 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || selectedProductId === tour.product_id}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving 
              ? (locale === 'ko' ? '저장 중...' : 'Saving...')
              : (locale === 'ko' ? '저장' : 'Save')
            }
          </button>
        </div>
      </div>
    </div>
  )
}

