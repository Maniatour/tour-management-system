'use client'

import React, { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Search } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import ProductCard from '@/components/ProductCard'

type Product = Database['public']['Tables']['products']['Row']

interface AdminProductsProps {
  params: Promise<{ locale: string }>
}

export default function AdminProducts({ params }: AdminProductsProps) {
  const paramsObj = useParams()
  const locale = paramsObj.locale as string
  const t = useTranslations('products')
  const tCommon = useTranslations('common')
  
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('active')
  const [categories, setCategories] = useState<{ value: string; label: string; count: number }[]>([])
  const [subCategories, setSubCategories] = useState<{ value: string; label: string; count: number }[]>([])
  const [allSubCategories, setAllSubCategories] = useState<{ value: string; label: string; count: number }[]>([])
  const [statusCounts, setStatusCounts] = useState<{ value: string; label: string; count: number }[]>([])

  // Supabase에서 상품 데이터 가져오기
  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      
      console.log('Products 데이터 조회 시작...')
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true })

      if (error) {
        console.error('Products 데이터 조회 오류:', error)
        console.error('오류 상세 정보:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        
        if (error.code === '42P01') {
          console.error('Products 테이블이 존재하지 않습니다. 데이터베이스 마이그레이션이 필요합니다.')
        }
        
        setProducts([])
        return
      }

      console.log('Products 데이터 조회 성공:', data?.length || 0, '개')
      setProducts(data || [])
      
      // 카테고리별 상품 수 계산
      if (data && data.length > 0) {
        const categoryCounts: { [key: string]: number } = {}
        const subCategoryCounts: { [key: string]: number } = {}
        const statusCounts: { [key: string]: number } = {}
        
        data.forEach(product => {
          if ((product as any).category) {
            categoryCounts[(product as any).category] = (categoryCounts[(product as any).category] || 0) + 1
          }
          if ((product as any).sub_category) {
            subCategoryCounts[(product as any).sub_category] = (subCategoryCounts[(product as any).sub_category] || 0) + 1
          }
          if ((product as any).status) {
            statusCounts[(product as any).status] = (statusCounts[(product as any).status] || 0) + 1
          }
        })
        
        // 카테고리 목록 생성 (전체 + 실제 존재하는 카테고리들)
        const categoryList = [
          { value: 'all', label: tCommon('all'), count: data.length }
        ]
        
        // 실제 존재하는 카테고리들을 상품 수 순으로 정렬하여 추가
        Object.entries(categoryCounts)
          .sort(([,a], [,b]) => b - a) // 상품 수 내림차순 정렬
          .forEach(([category, count]) => {
            categoryList.push({ value: category, label: category, count })
          })
        
        // 서브카테고리 목록 생성 (전체 + 실제 존재하는 서브카테고리들)
        const subCategoryList = [
          { value: 'all', label: tCommon('all'), count: data.length }
        ]
        
        // 실제 존재하는 서브카테고리들을 상품 수 순으로 정렬하여 추가
        Object.entries(subCategoryCounts)
          .sort(([,a], [,b]) => b - a) // 상품 수 내림차순 정렬
          .forEach(([subCategory, count]) => {
            subCategoryList.push({ value: subCategory, label: subCategory, count })
          })
        
        // 상태 목록 생성 (전체 + 실제 존재하는 상태들)
        const statusList = [
          { value: 'all', label: '전체', count: data.length }
        ]
        
        // 실제 존재하는 상태들을 상품 수 순으로 정렬하여 추가
        Object.entries(statusCounts)
          .sort(([,a], [,b]) => b - a) // 상품 수 내림차순 정렬
          .forEach(([status, count]) => {
            const statusLabel = status === 'active' ? '활성' : 
                              status === 'inactive' ? '비활성' : 
                              status === 'draft' ? '초안' : status
            statusList.push({ value: status, label: statusLabel, count })
          })
        
        setCategories(categoryList)
        setAllSubCategories(subCategoryList)
        setSubCategories(subCategoryList)
        setStatusCounts(statusList)
      }
    } catch (error) {
      console.error('Products 조회 중 예상치 못한 오류:', error)
      setProducts([])
    } finally {
      setLoading(false)
    }
  }



  // 카테고리 선택 시 서브카테고리 필터링
  const handleCategorySelect = (categoryValue: string) => {
    setSelectedCategory(categoryValue)
    setSelectedSubCategory('all') // 서브카테고리 초기화
    
    if (categoryValue === 'all') {
      // 전체 선택 시 모든 서브카테고리 표시
      setSubCategories(allSubCategories)
    } else {
      // 특정 카테고리 선택 시 해당 카테고리의 서브카테고리만 표시
      const filteredSubCategories = products
        .filter(product => product.category === categoryValue && product.sub_category)
        .reduce((acc, product) => {
          const subCategory = product.sub_category!
          const existing = acc.find((item: { value: string; label: string; count: number }) => item.value === subCategory)
          if (existing) {
            existing.count++
          } else {
            acc.push({ value: subCategory, label: subCategory, count: 1 })
          }
          return acc
        }, [] as { value: string; label: string; count: number }[])
      
      // 전체 옵션 추가
      const categorySubCategories = [
        { value: 'all', label: tCommon('all'), count: products.filter(p => p.category === categoryValue).length },
        ...filteredSubCategories.sort((a: { value: string; label: string; count: number }, b: { value: string; label: string; count: number }) => b.count - a.count)
      ]
      
      setSubCategories(categorySubCategories)
    }
  }

  // 필터링된 상품 목록
  const filteredProducts = products.filter(product => {
    const matchesSearch = 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ((product as any).category && (product as any).category.toLowerCase().includes(searchTerm.toLowerCase())) ||
      ((product as any).sub_category && (product as any).sub_category.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (product.tags && product.tags.some((tag: string) => tag.toLowerCase().includes(searchTerm.toLowerCase())))
    
    const matchesCategory = selectedCategory === 'all' || (product as any).category === selectedCategory
    const matchesSubCategory = selectedSubCategory === 'all' || (product as any).sub_category === selectedSubCategory
    const matchesStatus = selectedStatus === 'all' || (product as any).status === selectedStatus
    
    return matchesSearch && matchesCategory && matchesSubCategory && matchesStatus
  }).sort((a, b) => {
    // name 컬럼으로 정렬
    const nameA = a.name || ''
    const nameB = b.name || ''
    return nameA.localeCompare(nameB, 'ko', { numeric: true })
  })

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedCategory('all')
    setSelectedSubCategory('all')
    setSelectedStatus('active')
    setSubCategories(allSubCategories) // 서브카테고리를 전체 목록으로 복원
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

      {/* 검색 및 필터 섹션 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        {/* 카테고리와 서브카테고리 탭 */}
        <div className="space-y-0">
          {/* 카테고리 탭 */}
          {categories.length > 1 && (
            <div className="border-b border-gray-200">
              <div className="flex items-center justify-between">
                <nav className="flex space-x-4 overflow-x-auto">
                  {categories.map((category) => (
                    <button
                      key={category.value}
                      onClick={() => handleCategorySelect(category.value)}
                      className={`flex items-center space-x-1 py-2 px-2 border-b-2 font-medium text-xs whitespace-nowrap transition-colors ${
                        selectedCategory === category.value
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <span>{category.label}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                        selectedCategory === category.value
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {category.count}
                      </span>
                    </button>
                  ))}
                </nav>
                
                {/* 검색창 */}
                <div className="relative flex-shrink-0">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
        <input
          type="text"
                    placeholder="상품명, 카테고리, 서브카테고리, 설명으로 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-56 pl-7 pr-3 py-1.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
      </div>
                        </div>
                      </div>
          )}

          {/* 서브카테고리 탭 */}
          {subCategories.length > 1 && (
            <div className="border-b border-gray-200">
              <nav className="flex space-x-4 overflow-x-auto px-3">
                {subCategories.map((subCategory) => (
                  <button
                    key={subCategory.value}
                    onClick={() => setSelectedSubCategory(subCategory.value)}
                    className={`flex items-center space-x-1 py-2 px-2 border-b-2 font-medium text-xs whitespace-nowrap transition-colors ${
                      selectedSubCategory === subCategory.value
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span>{subCategory.label}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                      selectedSubCategory === subCategory.value
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {subCategory.count}
                    </span>
                  </button>
                ))}
              </nav>
            </div>
          )}

          {/* 상태 탭 */}
          {statusCounts.length > 1 && (
            <div className="border-b border-gray-200">
              <nav className="flex space-x-4 overflow-x-auto px-3">
                {statusCounts.map((status) => (
                  <button
                    key={status.value}
                    onClick={() => setSelectedStatus(status.value)}
                    className={`flex items-center space-x-1 py-2 px-2 border-b-2 font-medium text-xs whitespace-nowrap transition-colors ${
                      selectedStatus === status.value
                        ? 'border-green-500 text-green-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span>{status.label}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                      selectedStatus === status.value
                        ? 'bg-green-100 text-green-600'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {status.count}
                    </span>
                  </button>
                ))}
              </nav>
            </div>
          )}
                      </div>
                    </div>

      {/* 결과 요약 */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          총 {filteredProducts.length}개의 상품
          {selectedCategory !== 'all' && ` (${categories.find(c => c.value === selectedCategory)?.label})`}
          {selectedSubCategory !== 'all' && ` (${subCategories.find(c => c.value === selectedSubCategory)?.label})`}
          {selectedStatus !== 'all' && ` (${statusCounts.find(s => s.value === selectedStatus)?.label})`}
        </span>
        {searchTerm && (
          <span>&ldquo;<strong>{searchTerm}</strong>&rdquo; 검색 결과</span>
        )}
        {(searchTerm || selectedCategory !== 'all' || selectedSubCategory !== 'all' || selectedStatus !== 'all') && (
          <button
            onClick={clearFilters}
            className="text-blue-600 hover:text-blue-800 underline"
          >
            필터 초기화
          </button>
        )}
      </div>

      {/* 상품 목록 */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <div className="text-gray-400 mb-4">
            <Search className="mx-auto h-12 w-12" />
                      </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">검색 결과가 없습니다</h3>
          <p className="text-gray-600 mb-4">
            검색어나 카테고리를 변경해보세요.
          </p>
                      <button
            onClick={clearFilters}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                      >
            필터 초기화
                      </button>
                    </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                     {filteredProducts.map((product) => (
             <ProductCard
               key={product.id}
               product={product}
               locale={locale}
               onStatusChange={(productId, newStatus) => {
                 // 로컬 상태 업데이트
                 setProducts(prevProducts => 
                   prevProducts.map(p => 
                     p.id === productId ? { ...p, status: newStatus } : p
                   )
                 )
               }}
               onProductCopied={() => {
                 // 상품 복사 후 목록 새로고침
                 fetchProducts()
               }}
             />
           ))}
        </div>
      )}
    </div>
  )
}
