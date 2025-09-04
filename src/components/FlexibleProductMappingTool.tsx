'use client'

import { useState, useEffect } from 'react'
import { Database } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import { AlertTriangle, CheckCircle, RefreshCw, Search, Plus, X, ArrowRight } from 'lucide-react'

type Reservation = Database['public']['Tables']['reservations']['Row']
type Product = Database['public']['Tables']['products']['Row']
type ProductOption = Database['public']['Tables']['product_options']['Row']

interface FlexibleProductMappingToolProps {
  onDataUpdated: () => void
}

interface MappingRule {
  id: string
  sourceProductId: string
  targetProductId: string
  targetOptions: string[]
  description: string
}

export default function FlexibleProductMappingTool({ onDataUpdated }: FlexibleProductMappingToolProps) {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [productOptions, setProductOptions] = useState<ProductOption[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSourceProduct, setSelectedSourceProduct] = useState('')
  const [selectedTargetProduct, setSelectedTargetProduct] = useState('')
  const [selectedOptions, setSelectedOptions] = useState<string[]>([])
  const [mappingRules, setMappingRules] = useState<MappingRule[]>([])
  const [previewMode, setPreviewMode] = useState(true)
  const [migrationResults, setMigrationResults] = useState<any[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      
      const [reservationsRes, productsRes, optionsRes] = await Promise.all([
        supabase.from('reservations').select('*').order('created_at', { ascending: false }),
        supabase.from('products').select('*').order('name'),
        supabase.from('product_options').select('*').order('name')
      ])

      if (reservationsRes.error) throw reservationsRes.error
      if (productsRes.error) throw productsRes.error
      if (optionsRes.error) throw optionsRes.error

      setReservations(reservationsRes.data || [])
      setProducts(productsRes.data || [])
      setProductOptions(optionsRes.data || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  // 고유한 상품 ID 목록 가져오기
  const getUniqueProductIds = () => {
    const productIds = [...new Set(reservations.map(r => r.product_id).filter(Boolean))]
    return productIds.sort()
  }

  // 특정 상품 ID를 사용하는 예약 수
  const getReservationCount = (productId: string) => {
    return reservations.filter(r => r.product_id === productId).length
  }

  // 상품명 가져오기
  const getProductName = (productId: string) => {
    const product = products.find(p => p.id === productId)
    return product ? product.name : productId
  }

  // 상품의 옵션 목록 가져오기
  const getProductOptions = (productId: string) => {
    return productOptions.filter(opt => opt.product_id === productId)
  }

  // 매핑 규칙 추가
  const addMappingRule = () => {
    if (!selectedSourceProduct || !selectedTargetProduct) {
      alert('소스 상품과 타겟 상품을 모두 선택해주세요.')
      return
    }

    const newRule: MappingRule = {
      id: Date.now().toString(),
      sourceProductId: selectedSourceProduct,
      targetProductId: selectedTargetProduct,
      targetOptions: selectedOptions,
      description: `${getProductName(selectedSourceProduct)} → ${getProductName(selectedTargetProduct)}`
    }

    setMappingRules(prev => [...prev, newRule])
    setSelectedSourceProduct('')
    setSelectedTargetProduct('')
    setSelectedOptions([])
  }

  // 매핑 규칙 제거
  const removeMappingRule = (ruleId: string) => {
    setMappingRules(prev => prev.filter(rule => rule.id !== ruleId))
  }

  // 매핑 실행
  const executeMapping = async () => {
    if (mappingRules.length === 0) {
      alert('매핑 규칙을 추가해주세요.')
      return
    }

    try {
      setLoading(true)
      
      const results = []
      
      for (const rule of mappingRules) {
        // 상품 ID 변경
        const { error: updateError } = await supabase
          .from('reservations')
          .update({ product_id: rule.targetProductId })
          .eq('product_id', rule.sourceProductId)

        if (updateError) throw updateError

        const updatedCount = reservations.filter(r => r.product_id === rule.sourceProductId).length

        // 옵션 추가
        if (rule.targetOptions.length > 0) {
          const optionIds = rule.targetOptions.map(optionName => {
            const option = productOptions.find(opt => 
              opt.product_id === rule.targetProductId && opt.name === optionName
            )
            return option?.id
          }).filter(Boolean)

          if (optionIds.length > 0) {
            // 옵션을 selected_options에 추가
            const { error: optionError } = await supabase
              .from('reservations')
              .update({
                selected_options: supabase.raw(`
                  COALESCE(selected_options, '{}'::jsonb) || 
                  ${JSON.stringify(
                    optionIds.reduce((acc, id) => {
                      acc[id!] = []
                      return acc
                    }, {} as Record<string, any>)
                  )}::jsonb
                `)
              })
              .eq('product_id', rule.targetProductId)

            if (optionError) {
              console.warn('옵션 추가 중 오류:', optionError)
            }
          }
        }

        results.push({
          sourceProductId: rule.sourceProductId,
          targetProductId: rule.targetProductId,
          updatedCount,
          optionsAdded: rule.targetOptions.length
        })
      }

      setMigrationResults(results)
      setPreviewMode(false)
      onDataUpdated()
      
      alert('매핑이 완료되었습니다!')
    } catch (error) {
      console.error('Error executing mapping:', error)
      alert('매핑 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 필터링된 예약 목록
  const filteredReservations = reservations.filter(reservation => {
    const matchesSearch = !searchTerm || 
      reservation.product_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getProductName(reservation.product_id || '').toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesSource = !selectedSourceProduct || reservation.product_id === selectedSourceProduct
    
    return matchesSearch && matchesSource
  })

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">유연한 상품 매핑 도구</h3>
          <p className="text-sm text-gray-600">기존 상품을 선택하고 새로운 상품과 옵션으로 일괄 변환할 수 있습니다.</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 flex items-center space-x-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>새로고침</span>
        </button>
      </div>

      {/* 매핑 규칙 설정 */}
      <div className="mb-6">
        <h4 className="font-medium text-gray-900 mb-4">매핑 규칙 설정</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* 소스 상품 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">변환할 상품 (소스)</label>
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="상품 ID 또는 이름으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={selectedSourceProduct}
              onChange={(e) => setSelectedSourceProduct(e.target.value)}
              className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">소스 상품 선택</option>
              {getUniqueProductIds().map(productId => (
                <option key={productId} value={productId}>
                  {getProductName(productId)} ({productId}) - {getReservationCount(productId)}개
                </option>
              ))}
            </select>
          </div>

          {/* 타겟 상품 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">변환될 상품 (타겟)</label>
            <select
              value={selectedTargetProduct}
              onChange={(e) => setSelectedTargetProduct(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">타겟 상품 선택</option>
              {products.map(product => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.id})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 옵션 선택 */}
        {selectedTargetProduct && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">추가할 옵션 (선택사항)</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {getProductOptions(selectedTargetProduct).map(option => (
                <label key={option.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={selectedOptions.includes(option.name)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedOptions(prev => [...prev, option.name])
                      } else {
                        setSelectedOptions(prev => prev.filter(name => name !== option.name))
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{option.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* 규칙 추가 버튼 */}
        <button
          onClick={addMappingRule}
          disabled={!selectedSourceProduct || !selectedTargetProduct}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>매핑 규칙 추가</span>
        </button>
      </div>

      {/* 매핑 규칙 목록 */}
      {mappingRules.length > 0 && (
        <div className="mb-6">
          <h4 className="font-medium text-gray-900 mb-3">매핑 규칙 목록</h4>
          <div className="space-y-2">
            {mappingRules.map(rule => (
              <div key={rule.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="font-medium text-gray-900">{rule.sourceProductId}</span>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-gray-900">{rule.targetProductId}</span>
                  {rule.targetOptions.length > 0 && (
                    <span className="text-sm text-gray-600">
                      (+ {rule.targetOptions.length}개 옵션)
                    </span>
                  )}
                </div>
                <button
                  onClick={() => removeMappingRule(rule.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 미리보기 */}
      {selectedSourceProduct && (
        <div className="mb-6">
          <h4 className="font-medium text-gray-900 mb-3">미리보기</h4>
          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">예약 ID</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">현재 상품</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">변환될 상품</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">추가될 옵션</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredReservations.slice(0, 10).map((reservation) => (
                  <tr key={reservation.id}>
                    <td className="px-4 py-2 text-sm text-gray-900">{reservation.id}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{getProductName(reservation.product_id || '')}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {selectedTargetProduct ? getProductName(selectedTargetProduct) : '-'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {selectedOptions.length > 0 ? selectedOptions.join(', ') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredReservations.length > 10 && (
              <div className="px-4 py-2 text-sm text-gray-500 text-center">
                ... 및 {filteredReservations.length - 10}개 더
              </div>
            )}
          </div>
        </div>
      )}

      {/* 마이그레이션 결과 */}
      {migrationResults.length > 0 && (
        <div className="mb-6">
          <h4 className="font-medium text-gray-900 mb-3">마이그레이션 결과</h4>
          <div className="space-y-2">
            {migrationResults.map((result, index) => (
              <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-green-800">
                    {result.sourceProductId} → {result.targetProductId}
                  </span>
                  <span className="text-sm font-medium text-green-900">
                    {result.updatedCount}개 업데이트
                  </span>
                </div>
                {result.optionsAdded > 0 && (
                  <div className="text-xs text-green-700 mt-1">
                    {result.optionsAdded}개 옵션 추가
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 실행 버튼 */}
      <div className="flex justify-end space-x-3">
        <button
          onClick={() => setPreviewMode(!previewMode)}
          className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          {previewMode ? '미리보기 해제' : '미리보기 모드'}
        </button>
        <button
          onClick={executeMapping}
          disabled={loading || mappingRules.length === 0}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}
          <span>매핑 실행</span>
        </button>
      </div>

      {/* 주의사항 */}
      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-start space-x-2">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <p className="font-medium">주의사항:</p>
            <ul className="mt-1 space-y-1">
              <li>• 이 작업은 되돌릴 수 없습니다. 실행 전에 데이터를 백업하세요.</li>
              <li>• 여러 매핑 규칙을 한 번에 실행할 수 있습니다.</li>
              <li>• 옵션은 선택된 타겟 상품의 옵션만 추가됩니다.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
