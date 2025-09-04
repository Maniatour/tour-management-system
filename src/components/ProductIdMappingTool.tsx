'use client'

import { useState, useEffect } from 'react'
import { Database } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import { AlertTriangle, CheckCircle, RefreshCw, Download, Upload } from 'lucide-react'

type Reservation = Database['public']['Tables']['reservations']['Row']
type ProductOption = Database['public']['Tables']['product_options']['Row']

interface ProductIdMappingToolProps {
  onDataUpdated: () => void
}

interface MappingRule {
  oldProductId: string
  newProductId: string
  requiredOption: string
  description: string
}

export default function ProductIdMappingTool({ onDataUpdated }: ProductIdMappingToolProps) {
  const [mappingRules, setMappingRules] = useState<MappingRule[]>([
    {
      oldProductId: 'MDGCSUNRISE_X',
      newProductId: 'MDGCSUNRISE',
      requiredOption: 'Antelope X Canyon',
      description: 'MDGCSUNRISE_X를 MDGCSUNRISE로 통합하고 Antelope X Canyon 옵션 추가'
    },
    {
      oldProductId: 'MDGCSUNRISE',
      newProductId: 'MDGCSUNRISE',
      requiredOption: 'Lower Antelope Canyon',
      description: '기존 MDGCSUNRISE에 Lower Antelope Canyon 옵션 추가'
    }
  ])

  const [affectedReservations, setAffectedReservations] = useState<Reservation[]>([])
  const [productOptions, setProductOptions] = useState<ProductOption[]>([])
  const [loading, setLoading] = useState(false)
  const [previewMode, setPreviewMode] = useState(true)
  const [migrationResults, setMigrationResults] = useState<any[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // 영향받을 예약들 로드
      const { data: reservations, error: reservationsError } = await supabase
        .from('reservations')
        .select('*')
        .in('product_id', ['MDGCSUNRISE', 'MDGCSUNRISE_X'])
        .order('created_at', { ascending: false })

      if (reservationsError) throw reservationsError

      // 상품 옵션들 로드
      const { data: options, error: optionsError } = await supabase
        .from('product_options')
        .select('*')
        .eq('product_id', 'MDGCSUNRISE')
        .eq('is_required', true)

      if (optionsError) throw optionsError

      setAffectedReservations(reservations || [])
      setProductOptions(options || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const executeMigration = async () => {
    try {
      setLoading(true)
      
      // 마이그레이션 함수 실행
      const { data, error } = await supabase.rpc('migrate_product_ids')
      
      if (error) throw error
      
      setMigrationResults(data || [])
      setPreviewMode(false)
      
      // 데이터 새로고침
      onDataUpdated()
      
      alert('마이그레이션이 완료되었습니다!')
    } catch (error) {
      console.error('Error executing migration:', error)
      alert('마이그레이션 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const getReservationCount = (productId: string) => {
    return affectedReservations.filter(r => r.product_id === productId).length
  }

  const getOptionId = (optionName: string) => {
    return productOptions.find(opt => opt.name === optionName)?.id
  }

  const hasOption = (reservation: Reservation, optionName: string) => {
    const optionId = getOptionId(optionName)
    if (!optionId || !reservation.selected_options) return false
    return reservation.selected_options.hasOwnProperty(optionId)
  }

  const getReservationsByProduct = (productId: string) => {
    return affectedReservations.filter(r => r.product_id === productId)
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">상품 ID 매핑 도구</h3>
          <p className="text-sm text-gray-600">도깨비 투어 상품 ID를 통합하고 필수 선택 옵션을 추가합니다.</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>새로고침</span>
          </button>
        </div>
      </div>

      {/* 매핑 규칙 */}
      <div className="mb-6">
        <h4 className="font-medium text-gray-900 mb-3">매핑 규칙</h4>
        <div className="space-y-3">
          {mappingRules.map((rule, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  <span className="font-medium text-gray-900">{rule.oldProductId}</span>
                  <span className="text-gray-400">→</span>
                  <span className="font-medium text-gray-900">{rule.newProductId}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">
                    {getReservationCount(rule.oldProductId)}개 예약
                  </span>
                  {getReservationCount(rule.oldProductId) > 0 && (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-2">{rule.description}</p>
              <div className="text-sm text-gray-500">
                필수 옵션: <span className="font-medium">{rule.requiredOption}</span>
                {getOptionId(rule.requiredOption) ? (
                  <CheckCircle className="w-4 h-4 text-green-500 inline ml-1" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-500 inline ml-1" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 영향받을 예약 목록 */}
      <div className="mb-6">
        <h4 className="font-medium text-gray-900 mb-3">영향받을 예약 목록</h4>
        <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">예약 ID</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">현재 상품</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">새 상품</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">추가 옵션</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {affectedReservations.map((reservation) => {
                const rule = mappingRules.find(r => r.oldProductId === reservation.product_id)
                const hasRequiredOption = rule ? hasOption(reservation, rule.requiredOption) : false
                
                return (
                  <tr key={reservation.id}>
                    <td className="px-4 py-2 text-sm text-gray-900">{reservation.id}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{reservation.product_id}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{rule?.newProductId}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{rule?.requiredOption}</td>
                    <td className="px-4 py-2 text-sm">
                      {hasRequiredOption ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          옵션 있음
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          옵션 추가 예정
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 마이그레이션 결과 */}
      {migrationResults.length > 0 && (
        <div className="mb-6">
          <h4 className="font-medium text-gray-900 mb-3">마이그레이션 결과</h4>
          <div className="space-y-2">
            {migrationResults.map((result, index) => (
              <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-green-800">
                    {result.old_product_id} → {result.new_product_id}
                  </span>
                  <span className="text-sm font-medium text-green-900">
                    {result.updated_count}개 업데이트
                  </span>
                </div>
                <div className="text-xs text-green-700 mt-1">
                  옵션: {result.option_name}
                </div>
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
          onClick={executeMigration}
          disabled={loading || affectedReservations.length === 0}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          <span>마이그레이션 실행</span>
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
              <li>• 마이그레이션 전에 상품 옵션이 올바르게 설정되어 있는지 확인하세요.</li>
              <li>• 작업 중에는 다른 사용자가 데이터를 수정하지 않도록 주의하세요.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
