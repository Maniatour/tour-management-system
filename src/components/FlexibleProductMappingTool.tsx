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
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 })
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSourceProduct, setSelectedSourceProduct] = useState('')
  const [selectedTargetProduct, setSelectedTargetProduct] = useState('')
  const [selectedOptions, setSelectedOptions] = useState<string[]>([])
  const [mappingRules, setMappingRules] = useState<MappingRule[]>([])
  const [previewMode, setPreviewMode] = useState(true)
  const [migrationResults, setMigrationResults] = useState<Record<string, unknown>[]>([])
  const [debugMode, setDebugMode] = useState(false)
  const [testMode, setTestMode] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setLoadingProgress({ current: 0, total: 0 })
      
      // 먼저 총 개수를 가져오기
      const { count } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })

      const totalCount = count || 0
      setLoadingProgress({ current: 0, total: totalCount })
      
      // 모든 예약 데이터를 페이지네이션으로 로드
      let allReservations: Reservation[] = []
      let from = 0
      const pageSize = 1000
      let hasMore = true

      console.log(`데이터 로딩 시작: 총 ${totalCount}개 예약`)

      while (hasMore) {
        console.log(`페이지 로딩: ${from} ~ ${from + pageSize - 1}`)
        
        const { data, error } = await supabase
          .from('reservations')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1)

        if (error) throw error

        if (data && data.length > 0) {
          allReservations = [...allReservations, ...data]
          console.log(`페이지 로딩 완료: ${data.length}개 추가, 총 ${allReservations.length}개`)
          
          from += pageSize
          // 더 안전한 종료 조건: 데이터가 페이지 크기보다 적으면 마지막 페이지
          hasMore = data.length >= pageSize
          
          // 진행률 업데이트
          setLoadingProgress({ current: allReservations.length, total: totalCount })
        } else {
          hasMore = false
        }
      }

      // 추가 검증: MDGCSUNRISE 예약이 모두 로드되었는지 확인
      const mdgcCount = allReservations.filter(r => r.product_id === 'MDGCSUNRISE').length
      console.log(`로드된 MDGCSUNRISE 예약 수: ${mdgcCount}개`)
      
      // MDGCSUNRISE 예약이 부족한 경우 추가 로드
      if (mdgcCount < 1467) {
        console.log(`MDGCSUNRISE 예약 부족 감지: ${mdgcCount}/1467개`)
        
        // MDGCSUNRISE 예약만 별도로 로드
        const { data: mdgcData, error: mdgcError } = await supabase
          .from('reservations')
          .select('*')
          .eq('product_id', 'MDGCSUNRISE')
          .order('created_at', { ascending: false })
        
        if (mdgcError) {
          console.error('MDGCSUNRISE 예약 추가 로드 오류:', mdgcError)
        } else if (mdgcData) {
          console.log(`MDGCSUNRISE 예약 추가 로드: ${mdgcData.length}개`)
          
          // 기존 데이터에서 MDGCSUNRISE 제거 후 새 데이터로 교체
          const otherReservations = allReservations.filter(r => r.product_id !== 'MDGCSUNRISE')
          allReservations = [...otherReservations, ...mdgcData]
          
          console.log(`최종 MDGCSUNRISE 예약 수: ${allReservations.filter(r => r.product_id === 'MDGCSUNRISE').length}개`)
        }
      }

      console.log(`데이터 로딩 완료: 총 ${allReservations.length}개 예약 로드됨`)
      
      // 데이터 로딩 검증
      if (allReservations.length !== totalCount) {
        console.warn(`⚠️ 데이터 로딩 불일치: 예상 ${totalCount}개, 실제 ${allReservations.length}개`)
      }

      const [productsRes, optionsRes] = await Promise.all([
        supabase.from('products').select('*').order('name'),
        supabase.from('product_options').select('*').order('name')
      ])

      if (productsRes.error) throw productsRes.error
      if (optionsRes.error) throw optionsRes.error

      setReservations(allReservations)
      setProducts(productsRes.data || [])
      setProductOptions(optionsRes.data || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
      setLoadingProgress({ current: 0, total: 0 })
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

  // 상품의 필수 선택 옵션 목록 가져오기
  const getRequiredProductOptions = (productId: string) => {
    return productOptions.filter(opt => opt.product_id === productId && opt.is_required === true)
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
        console.log(`매핑 규칙 실행 시작: ${rule.sourceProductId} → ${rule.targetProductId}`)
        
        // 변환할 예약들을 미리 찾기 (selected_options가 null이거나 빈 객체인 것만)
        const reservationsToUpdate = reservations.filter(r => 
          r.product_id === rule.sourceProductId && 
          (r.selected_options === null || 
           r.selected_options === undefined || 
           Object.keys(r.selected_options || {}).length === 0)
        )
        const updatedCount = reservationsToUpdate.length

        console.log(`변환 대상 예약 수: ${updatedCount}개 (selected_options가 없는 예약만)`)
        
        // 필터링된 예약들의 selected_options 상태 확인
        const nullOptions = reservationsToUpdate.filter(r => r.selected_options === null).length
        const emptyOptions = reservationsToUpdate.filter(r => 
          r.selected_options && Object.keys(r.selected_options).length === 0
        ).length
        console.log(`- selected_options가 null인 예약: ${nullOptions}개`)
        console.log(`- selected_options가 빈 객체인 예약: ${emptyOptions}개`)

        if (updatedCount === 0) {
          console.warn(`변환할 예약이 없습니다: ${rule.sourceProductId}`)
          continue
        }

        // 상품 ID가 다른 경우에만 변경
        if (rule.sourceProductId !== rule.targetProductId) {
          console.log(`상품 ID 변경 실행: ${rule.sourceProductId} → ${rule.targetProductId}`)
          
          const { error: updateError } = await supabase
            .from('reservations')
            .update({ product_id: rule.targetProductId })
            .eq('product_id', rule.sourceProductId)

          if (updateError) {
            console.error(`상품 ID 변경 중 오류 (${rule.sourceProductId}):`, updateError)
            throw updateError
          }
          
          console.log(`상품 ID 변경 완료: ${updatedCount}개 예약`)
        } else {
          console.log(`상품 ID가 동일하므로 변경 생략: ${rule.sourceProductId}`)
        }

        // 필수 선택 옵션을 selected_options에 추가
        if (rule.targetOptions.length > 0) {
          console.log(`옵션 추가 시작: ${rule.targetOptions.join(', ')}`)
          
          const optionIds = rule.targetOptions.map(optionName => {
            const option = productOptions.find(opt => 
              opt.product_id === rule.targetProductId && opt.name === optionName && opt.is_required === true
            )
            console.log(`옵션 "${optionName}" 찾기:`, option ? `ID: ${option.id}` : '찾을 수 없음')
            return option?.id
          }).filter(Boolean)
          
          console.log(`rule.targetOptions:`, rule.targetOptions)
          console.log(`찾은 옵션 ID들:`, optionIds)

          if (optionIds.length > 0) {
            console.log(`${optionIds.length}개 옵션을 ${reservationsToUpdate.length}개 예약에 추가`)
            
            // 배치 업데이트로 트랜잭션 문제 해결 시도
            let successCount = 0
            let errorCount = 0
            
            // 10개씩 배치로 처리
            const batchSize = 10
            for (let i = 0; i < reservationsToUpdate.length; i += batchSize) {
              const batch = reservationsToUpdate.slice(i, i + batchSize)
              console.log(`배치 ${Math.floor(i/batchSize) + 1} 처리 중: ${batch.length}개 예약`)
              
              // 각 배치를 개별 트랜잭션으로 처리
              for (const reservation of batch) {
                try {
                  const currentOptions = reservation.selected_options || {}
                  const newOptions = optionIds.reduce((acc, id) => {
                    // 실제 시스템과 동일한 방식: 옵션 ID를 키로 하고, 선택된 choice ID를 배열로 저장
                    // 선택된 옵션은 옵션 ID 자체를 choice ID로 사용
                    acc[id!] = [id!] // 옵션 ID 자체를 choice ID로 사용 (실제 시스템 방식)
                    return acc
                  }, {} as Record<string, string[]>)
                  
                  // 선택되지 않은 옵션들도 포함 (빈 배열로)
                  const allOptionIds = productOptions
                    .filter(opt => opt.product_id === rule.targetProductId && opt.is_required === true)
                    .map(opt => opt.id)
                  
                  allOptionIds.forEach(optionId => {
                    if (!newOptions[optionId]) {
                      newOptions[optionId] = [] // 선택되지 않은 옵션은 빈 배열
                    }
                  })
                  
                  const updatedOptions = { ...currentOptions, ...newOptions }
                  
                  console.log(`예약 ${reservation.id} 옵션 업데이트 시도:`, {
                    before: currentOptions,
                    after: updatedOptions
                  })
                  
                  // 단일 업데이트로 트랜잭션 범위 최소화
                  const { data: updateData, error: optionError } = await supabase
                    .from('reservations')
                    .update({ selected_options: updatedOptions })
                    .eq('id', reservation.id)
                    .select('id, selected_options')

                  if (optionError) {
                    console.error(`예약 ${reservation.id} 옵션 추가 중 오류:`, {
                      code: optionError.code,
                      message: optionError.message,
                      details: optionError.details,
                      hint: optionError.hint
                    })
                    errorCount++
                  } else {
                    console.log(`예약 ${reservation.id} 옵션 추가 완료:`, updateData)
                    successCount++
                    
                    // 실제 업데이트된 데이터 확인
                    if (updateData && updateData.length > 0) {
                      console.log(`실제 업데이트된 selected_options:`, updateData[0].selected_options)
                    } else {
                      console.warn(`예약 ${reservation.id} 업데이트 결과가 없습니다.`)
                    }
                  }
                  
                  // 각 업데이트 사이에 작은 지연
                  await new Promise(resolve => setTimeout(resolve, 100))
                  
                } catch (error) {
                  console.error(`예약 ${reservation.id} 처리 중 예외:`, error)
                  errorCount++
                }
              }
              
              // 배치 간 지연
              await new Promise(resolve => setTimeout(resolve, 500))
            }
            
            console.log(`배치 처리 완료: 성공 ${successCount}개, 실패 ${errorCount}개`)
            
          } else {
            console.warn('추가할 옵션을 찾을 수 없습니다.')
          }
        } else {
          console.log('추가할 옵션이 없습니다.')
        }

        results.push({
          sourceProductId: rule.sourceProductId,
          targetProductId: rule.targetProductId,
          updatedCount,
          optionsAdded: rule.targetOptions.length
        })

        console.log(`매핑 완료: ${rule.sourceProductId} → ${rule.targetProductId} (${updatedCount}개 예약)`)
      }

      setMigrationResults(results)
      setPreviewMode(false)
      onDataUpdated()
      
      const totalUpdated = results.reduce((sum, result) => sum + result.updatedCount, 0)
      alert(`매핑이 완료되었습니다!\n총 ${totalUpdated}개 예약이 변환되었습니다.`)
    } catch (error) {
      console.error('Error executing mapping:', error)
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      alert(`매핑 중 오류가 발생했습니다:\n${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  // 필터링된 예약 목록 (선택된 소스 상품의 예약들)
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
          <p className="text-sm text-gray-600">
            기존 상품을 선택하고 새로운 상품으로 통합하며, 필수 선택 옵션을 추가할 수 있습니다.
            {reservations.length > 0 && (
              <span className="ml-2 text-blue-600 font-medium">
                (전체 {reservations.length}개 예약 로드됨)
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setDebugMode(!debugMode)}
            className={`px-3 py-2 text-sm rounded-lg flex items-center space-x-2 ${
              debugMode 
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span>디버그 모드</span>
          </button>
          <button
            onClick={() => setTestMode(!testMode)}
            className={`px-3 py-2 text-sm rounded-lg flex items-center space-x-2 ${
              testMode 
                ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span>테스트 모드</span>
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>
              {loading 
                ? `Loading... (${loadingProgress.current}/${loadingProgress.total})` 
                : '새로고침'
              }
            </span>
          </button>
        </div>
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

        {/* 필수 선택 옵션 선택 */}
        {selectedTargetProduct && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">추가할 필수 선택 옵션</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {getRequiredProductOptions(selectedTargetProduct).map(option => (
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
                  <span className="text-xs text-red-500">(필수)</span>
                </label>
              ))}
            </div>
            {getRequiredProductOptions(selectedTargetProduct).length === 0 && (
              <p className="text-sm text-gray-500">이 상품에는 필수 선택 옵션이 없습니다.</p>
            )}
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
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">현재 selected_options</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">추가될 필수 옵션</th>
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
                      {reservation.selected_options && Object.keys(reservation.selected_options).length > 0 ? (
                        <div className="max-w-xs">
                          <div className="text-xs text-gray-600 mb-1">현재 옵션:</div>
                          <div className="text-xs bg-gray-100 p-1 rounded font-mono break-all">
                            {JSON.stringify(reservation.selected_options, null, 2)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">없음</span>
                      )}
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

      {/* 디버그 정보 */}
      {debugMode && (
        <div className="mb-6">
          <h4 className="font-medium text-gray-900 mb-3">디버그 정보</h4>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">전체 예약 수:</span> {reservations.length}
              </div>
              <div>
                <span className="font-medium">상품 수:</span> {products.length}
              </div>
              <div>
                <span className="font-medium">옵션 수:</span> {productOptions.length}
              </div>
              <div>
                <span className="font-medium">매핑 규칙 수:</span> {mappingRules.length}
              </div>
            </div>
            {selectedSourceProduct && (
              <div className="mt-4">
                <div className="font-medium text-gray-700 mb-2">선택된 소스 상품: {selectedSourceProduct}</div>
                <div className="text-sm text-gray-600">
                  변환 대상 예약 수: {reservations.filter(r => r.product_id === selectedSourceProduct).length}개
                </div>
                <div className="text-sm text-gray-600">
                  필터링된 예약 수: {filteredReservations.length}개
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 테스트 모드 */}
      {testMode && (
        <div className="mb-6">
          <h4 className="font-medium text-gray-900 mb-3">테스트 모드</h4>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="space-y-4">
              <div>
                <button
                  onClick={async () => {
                    console.log('=== 데이터베이스 옵션 조회 테스트 ===')
                    
                    // MDGCSUNRISE 상품의 옵션 조회
                    const { data: options, error } = await supabase
                      .from('product_options')
                      .select('*')
                      .eq('product_id', 'MDGCSUNRISE')
                      .eq('is_required', true)
                    
                    if (error) {
                      console.error('옵션 조회 오류:', error)
                    } else {
                      console.log('MDGCSUNRISE 옵션들:', options)
                    }
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  MDGCSUNRISE 옵션 조회 테스트
                </button>
              </div>
              
              <div>
                <button
                  onClick={async () => {
                    console.log('=== 예약 데이터 조회 테스트 ===')
                    
                    // 첫 번째 예약의 selected_options 조회
                    const { data: reservation, error } = await supabase
                      .from('reservations')
                      .select('id, product_id, selected_options')
                      .eq('product_id', 'MDGCSUNRISE')
                      .limit(1)
                    
                    if (error) {
                      console.error('예약 조회 오류:', error)
                    } else {
                      console.log('첫 번째 MDGCSUNRISE 예약:', reservation)
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  예약 데이터 조회 테스트
                </button>
              </div>
              
              <div>
                <button
                  onClick={async () => {
                    console.log('=== 단일 예약 업데이트 테스트 ===')
                    
                    // 첫 번째 예약을 찾아서 테스트 업데이트
                    const { data: reservation, error: fetchError } = await supabase
                      .from('reservations')
                      .select('id, product_id, selected_options')
                      .eq('product_id', 'MDGCSUNRISE')
                      .limit(1)
                    
                    if (fetchError) {
                      console.error('예약 조회 오류:', fetchError)
                      return
                    }
                    
                    if (reservation && reservation.length > 0) {
                      const testId = reservation[0].id
                      const testOptions = { "test-option-id": [] }
                      
                      console.log(`테스트 업데이트: 예약 ${testId}`)
                      console.log('업데이트할 데이터:', testOptions)
                      
                      const { data: updateData, error: updateError } = await supabase
                        .from('reservations')
                        .update({ selected_options: testOptions })
                        .eq('id', testId)
                        .select('id, selected_options')
                      
                      if (updateError) {
                        console.error('업데이트 오류:', updateError)
                      } else {
                        console.log('업데이트 성공:', updateData)
                      }
                    }
                  }}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  단일 예약 업데이트 테스트
                </button>
                
                <button
                  onClick={async () => {
                    console.log('=== MDGCSUNRISE 예약 수 확인 테스트 ===')
                    
                    // 실제 데이터베이스에서 MDGCSUNRISE 예약 수 조회
                    const { count, error } = await supabase
                      .from('reservations')
                      .select('*', { count: 'exact', head: true })
                      .eq('product_id', 'MDGCSUNRISE')
                    
                    if (error) {
                      console.error('예약 수 조회 오류:', error)
                    } else {
                      console.log(`실제 MDGCSUNRISE 예약 수: ${count}개`)
                    }
                    
                    // 로드된 데이터에서 MDGCSUNRISE 예약 수 확인
                    const loadedCount = reservations.filter(r => r.product_id === 'MDGCSUNRISE').length
                    console.log(`로드된 MDGCSUNRISE 예약 수: ${loadedCount}개`)
                    
                    // selected_options 상태별 분류
                    const mdgcReservations = reservations.filter(r => r.product_id === 'MDGCSUNRISE')
                    const nullOptions = mdgcReservations.filter(r => r.selected_options === null).length
                    const emptyOptions = mdgcReservations.filter(r => 
                      r.selected_options && Object.keys(r.selected_options).length === 0
                    ).length
                    const hasOptions = mdgcReservations.filter(r => 
                      r.selected_options && Object.keys(r.selected_options).length > 0
                    ).length
                    
                    console.log(`MDGCSUNRISE 예약 selected_options 상태:`)
                    console.log(`- null: ${nullOptions}개`)
                    console.log(`- 빈 객체: ${emptyOptions}개`)
                    console.log(`- 옵션 있음: ${hasOptions}개`)
                    
                    // 전체 예약 수도 확인
                    console.log(`전체 로드된 예약 수: ${reservations.length}개`)
                  }}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  MDGCSUNRISE 예약 수 확인
                </button>
                
                <button
                  onClick={async () => {
                    console.log('=== 전체 데이터 다시 로드 테스트 ===')
                    
                    // 모든 MDGCSUNRISE 예약을 직접 조회
                    const { data: allMdgcReservations, error } = await supabase
                      .from('reservations')
                      .select('*')
                      .eq('product_id', 'MDGCSUNRISE')
                      .order('created_at', { ascending: false })
                    
                    if (error) {
                      console.error('전체 MDGCSUNRISE 예약 조회 오류:', error)
                    } else {
                      console.log(`직접 조회한 MDGCSUNRISE 예약 수: ${allMdgcReservations?.length || 0}개`)
                      console.log('첫 5개 예약 ID:', allMdgcReservations?.slice(0, 5).map(r => r.id))
                    }
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  전체 MDGCSUNRISE 데이터 직접 조회
                </button>
                
                <button
                  onClick={async () => {
                    console.log('=== selected_options 변경 추적 테스트 ===')
                    
                    // 1. 현재 로드된 데이터에서 MDGCSUNRISE 예약의 selected_options 상태 확인
                    const loadedMdgc = reservations.filter(r => r.product_id === 'MDGCSUNRISE')
                    const loadedWithOptions = loadedMdgc.filter(r => 
                      r.selected_options && Object.keys(r.selected_options).length > 0
                    )
                    console.log(`로드된 데이터에서 옵션이 있는 MDGCSUNRISE 예약: ${loadedWithOptions.length}개`)
                    
                    if (loadedWithOptions.length > 0) {
                      console.log('옵션이 있는 예약들:', loadedWithOptions.slice(0, 3).map(r => ({
                        id: r.id,
                        selected_options: r.selected_options
                      })))
                    }
                    
                    // 2. 데이터베이스에서 직접 조회하여 실제 상태 확인
                    const { data: dbMdgc, error } = await supabase
                      .from('reservations')
                      .select('id, selected_options')
                      .eq('product_id', 'MDGCSUNRISE')
                      .limit(10)
                    
                    if (error) {
                      console.error('데이터베이스 조회 오류:', error)
                    } else {
                      const dbWithOptions = dbMdgc?.filter(r => 
                        r.selected_options && Object.keys(r.selected_options).length > 0
                      ) || []
                      console.log(`데이터베이스에서 옵션이 있는 MDGCSUNRISE 예약: ${dbWithOptions.length}개`)
                      
                      if (dbWithOptions.length > 0) {
                        console.log('데이터베이스의 옵션이 있는 예약들:', dbWithOptions.slice(0, 3))
                      }
                    }
                    
                    // 3. 로드된 데이터와 데이터베이스 데이터 비교
                    console.log('=== 데이터 일치성 검사 ===')
                    console.log(`로드된 데이터: ${loadedWithOptions.length}개`)
                    console.log(`데이터베이스: ${dbWithOptions?.length || 0}개`)
                  }}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                >
                  selected_options 변경 추적
                </button>
                
                <button
                  onClick={async () => {
                    console.log('=== 모든 데이터 강제 다시 로드 ===')
                    
                    try {
                      setLoading(true)
                      
                      // 모든 예약을 페이지네이션으로 로드
                      let allReservations: Reservation[] = []
                      let from = 0
                      const pageSize = 1000
                      let hasMore = true
                      
                      while (hasMore) {
                        const { data, error } = await supabase
                          .from('reservations')
                          .select('*')
                          .order('created_at', { ascending: false })
                          .range(from, from + pageSize - 1)
                        
                        if (error) throw error
                        
                        if (data && data.length > 0) {
                          allReservations = [...allReservations, ...data]
                          from += pageSize
                          hasMore = data.length >= pageSize
                          console.log(`Loading: ${allReservations.length} items`)
                        } else {
                          hasMore = false
                        }
                      }
                      
                      setReservations(allReservations)
                      console.log(`강제 로딩 완료: 총 ${allReservations.length}개 예약`)
                      
                      const mdgcCount = allReservations.filter(r => r.product_id === 'MDGCSUNRISE').length
                      console.log(`MDGCSUNRISE 예약 수: ${mdgcCount}개`)
                      
                    } catch (error) {
                      console.error('강제 로딩 오류:', error)
                    } finally {
                      setLoading(false)
                    }
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  모든 데이터 강제 다시 로드
                </button>
                
                <button
                  onClick={async () => {
                    console.log('=== 단일 예약 업데이트 상세 테스트 ===')
                    
                    try {
                      // 1. MDGCSUNRISE 예약 하나 조회
                      const { data: reservation, error: fetchError } = await supabase
                        .from('reservations')
                        .select('id, product_id, selected_options')
                        .eq('product_id', 'MDGCSUNRISE')
                        .limit(1)
                      
                      if (fetchError) {
                        console.error('예약 조회 오류:', fetchError)
                        return
                      }
                      
                      if (!reservation || reservation.length === 0) {
                        console.log('MDGCSUNRISE 예약이 없습니다.')
                        return
                      }
                      
                      const testReservation = reservation[0]
                      console.log('테스트 대상 예약:', {
                        id: testReservation.id,
                        product_id: testReservation.product_id,
                        selected_options: testReservation.selected_options
                      })
                      
                      // 2. 현재 시간으로 고유한 테스트 데이터 생성
                      const timestamp = Date.now()
                      const testData = { 
                        [`test-${timestamp}`]: [],
                        "test-option": ["test-value"]
                      }
                      
                      console.log('업데이트할 테스트 데이터:', testData)
                      
                      // 3. 업데이트 실행
                      const { data: updateData, error: updateError } = await supabase
                        .from('reservations')
                        .update({ selected_options: testData })
                        .eq('id', testReservation.id)
                        .select('id, selected_options')
                      
                      if (updateError) {
                        console.error('업데이트 오류:', updateError)
                        console.error('오류 상세:', {
                          code: updateError.code,
                          message: updateError.message,
                          details: updateError.details,
                          hint: updateError.hint
                        })
                      } else {
                        console.log('업데이트 성공:', updateData)
                        
                        // 4. 즉시 다시 조회하여 확인
                        const { data: verifyData, error: verifyError } = await supabase
                          .from('reservations')
                          .select('id, selected_options')
                          .eq('id', testReservation.id)
                        
                        if (verifyError) {
                          console.error('확인 조회 오류:', verifyError)
                        } else {
                          console.log('확인 조회 결과:', verifyData)
                        }
                      }
                      
                    } catch (error) {
                      console.error('테스트 중 오류:', error)
                    }
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  단일 예약 업데이트 상세 테스트
                </button>
                
                <button
                  onClick={async () => {
                    console.log('=== 실제 시스템 데이터 구조 분석 ===')
                    
                    try {
                      // 1. 실제 시스템에서 저장된 예약 데이터 조회
                      const { data: realReservations, error: realError } = await supabase
                        .from('reservations')
                        .select('id, product_id, selected_options')
                        .not('selected_options', 'is', null)
                        .limit(5)
                      
                      if (realError) {
                        console.error('실제 데이터 조회 오류:', realError)
                        return
                      }
                      
                      console.log('실제 시스템에서 저장된 selected_options 예시:')
                      realReservations?.forEach((res, index) => {
                        console.log(`${index + 1}. 예약 ${res.id}:`, res.selected_options)
                      })
                      
                      // 2. MDGCSUNRISE 옵션과 choice 조회
                      const { data: options, error: optionsError } = await supabase
                        .from('product_options')
                        .select('id, name, product_id')
                        .eq('product_id', 'MDGCSUNRISE')
                        .eq('is_required', true)
                      
                      if (optionsError) {
                        console.error('옵션 조회 오류:', optionsError)
                        return
                      }
                      
                      console.log('MDGCSUNRISE 필수 옵션들:')
                      options?.forEach(option => {
                        console.log(`- ${option.name} (ID: ${option.id})`)
                      })
                      
                      // 3. 실제 시스템 방식 설명
                      console.log('실제 시스템 방식:')
                      console.log('- 선택된 옵션: 옵션 ID 자체를 choice ID로 사용')
                      console.log('- 선택되지 않은 옵션: 빈 배열 []')
                      console.log('- 예시:')
                      console.log('  "475beeab-52c3-4df0-ba06-f18c4fa6079c": [] (선택되지 않음)')
                      console.log('  "f9484397-80fa-4840-b0ab-6c5b19e37b20": ["f9484397-80fa-4840-b0ab-6c5b19e37b20"] (선택됨)')
                      
                    } catch (error) {
                      console.error('분석 중 오류:', error)
                    }
                  }}
                  className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700"
                >
                  실제 시스템 데이터 구조 분석
                </button>
              </div>
            </div>
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
              <li>• 필수 선택 옵션만 selected_options JSONB 컬럼에 추가됩니다.</li>
              <li>• 상품 통합 후 각 예약의 selected_options에서 구분됩니다.</li>
              <li>• 브라우저 콘솔에서 상세한 실행 로그를 확인할 수 있습니다.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
