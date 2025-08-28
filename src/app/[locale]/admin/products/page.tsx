'use client'

import React, { useState, use, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Search, Edit, Trash2, Package, Users, DollarSign, Settings, Star, CheckCircle, Link as LinkIcon } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

type Product = Database['public']['Tables']['products']['Row']
type ProductInsert = Database['public']['Tables']['products']['Insert']
type ProductUpdate = Database['public']['Tables']['products']['Update']

interface AdminProductsProps {
  params: Promise<{ locale: string }>
}

export default function AdminProducts({ params }: AdminProductsProps) {
  const { locale } = use(params)
  const t = useTranslations('products')
  const tCommon = useTranslations('common')
  
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Supabase에서 상품 데이터 가져오기
  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      
      // 테이블 존재 여부 확인을 건너뛰고 직접 데이터 조회 시도
      console.log('Products 데이터 조회 시작...')
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Products 데이터 조회 오류:', error)
        console.error('오류 상세 정보:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        
        // 테이블이 존재하지 않는 경우를 특별히 처리
        if (error.code === '42P01') {
          console.error('Products 테이블이 존재하지 않습니다. 데이터베이스 마이그레이션이 필요합니다.')
        }
        
        setProducts([])
        return
      }

      console.log('Products 데이터 조회 성공:', data?.length || 0, '개')
      setProducts(data || [])
    } catch (error) {
      console.error('Products 조회 중 예상치 못한 오류:', error)
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (product.tags && product.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
  )

  const handleDeleteProduct = async (id: string) => {
    if (confirm(t('deleteConfirm'))) {
      try {
        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', id)

        if (error) {
          console.error('Error deleting product:', error)
          return
        }

        setProducts(products.filter(p => p.id !== id))
      } catch (error) {
        console.error('Error deleting product:', error)
      }
    }
  }

  const getCategoryLabel = (category: string) => {
    const categoryLabels: { [key: string]: string } = {
      city: '도시',
      nature: '자연',
      culture: '문화',
      adventure: '모험',
      food: '음식'
    }
    return categoryLabels[category] || category
  }



  const getStatusLabel = (status: string) => {
    const statusLabels: { [key: string]: string } = {
      active: '활성',
      inactive: '비활성',
      draft: '초안'
    }
    return statusLabels[status] || status
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'inactive': return 'bg-red-100 text-red-800'
      case 'draft': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriceDisplay = (product: Product) => {
    return `$${product.base_price}`
  }

  const getOptionsSummary = (product: Product) => {
    // TODO: product_options 테이블에서 연관된 옵션 정보를 가져와서 표시
    return '옵션 정보 로딩 중...'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <div className="text-gray-500">{tCommon('loading')}</div>
        </div>
      </div>
    )
  }

  // 오류 상태 표시 (products가 빈 배열이고 로딩이 완료된 경우)
  if (products.length === 0 && !loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <Link
            href={`/${locale}/admin/products/new`}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            {t('addProduct')}
          </Link>
        </div>
        
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">상품이 없습니다</h3>
          <p className="text-gray-600 mb-4">
            아직 등록된 상품이 없거나 데이터베이스 연결에 문제가 있을 수 있습니다.
          </p>
          <div className="space-y-2">
            <button
              onClick={fetchProducts}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              다시 시도
            </button>
            <div className="text-xs text-gray-500">
              또는 새 상품을 추가해보세요
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">상품 관리</h1>
          <p className="mt-2 text-gray-600">
            투어 상품을 추가, 편집, 삭제할 수 있습니다
          </p>
        </div>
        <Link
                          href={`/${locale}/admin/products/new`}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>새 상품 추가</span>
        </Link>
      </div>

      {/* 검색 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="상품명, 카테고리, 설명으로 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* 상품 목록 */}
      <div className="bg-white rounded-lg shadow-md border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상품명</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">카테고리</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">가격</th>

                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">옵션</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">작업</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <Package className="h-6 w-6 text-blue-600" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{product.name}</div>
                        <div className="text-sm text-gray-500">{product.description}</div>
                        <div className="flex items-center mt-1">
                          <Star className="h-3 w-3 text-yellow-400 mr-1" />
                          <span className="text-xs text-gray-500">{product.duration}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {getCategoryLabel(product.category)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      <div className="font-medium">{getPriceDisplay(product)}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        최대 {product.max_participants}명
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      <div className="flex items-center">
                        <Settings className="h-4 w-4 text-gray-400 mr-2" />
                        {getOptionsSummary(product)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        옵션 정보 로딩 중...
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(product.status)}`}>
                      {getStatusLabel(product.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <Link
                        href={`/${locale}/admin/products/${product.id}`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit size={16} />
                      </Link>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
