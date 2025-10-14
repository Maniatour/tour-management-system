'use client'

import React, { useState, useEffect } from 'react'
import { X, History, Calendar, User, DollarSign } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface GuideCostHistoryRecord {
  id: string
  action: 'created' | 'updated' | 'deactivated'
  old_guide_fee?: number
  new_guide_fee?: number
  old_assistant_fee?: number
  new_assistant_fee?: number
  old_driver_fee?: number
  new_driver_fee?: number
  old_effective_from?: string
  new_effective_from?: string
  old_effective_to?: string
  new_effective_to?: string
  changed_at: string
}

interface GuideCostHistoryProps {
  isOpen: boolean
  onClose: () => void
  productId: string
  productName: string
}

export default function GuideCostHistory({ isOpen, onClose, productId, productName }: GuideCostHistoryProps) {
  const [history, setHistory] = useState<GuideCostHistoryRecord[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && productId) {
      fetchHistory()
    }
  }, [isOpen, productId])

  const fetchHistory = async () => {
    try {
      setLoading(true)
      
      // guide_cost_history 테이블에서 변경 이력 조회
      const { data, error } = await supabase
        .from('guide_cost_history')
        .select(`
          *,
          product_guide_costs!inner(product_id, team_type)
        `)
        .eq('product_guide_costs.product_id', productId)
        .order('changed_at', { ascending: false })

      if (error) {
        console.error('변경 이력 조회 오류:', error)
        // 감사 로그에서 대체 조회 시도
        await fetchFromAuditLogs()
        return
      }

      setHistory(data || [])
    } catch (error) {
      console.error('변경 이력 조회 오류:', error)
      // 감사 로그에서 대체 조회 시도
      await fetchFromAuditLogs()
    } finally {
      setLoading(false)
    }
  }

  const fetchFromAuditLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('table_name', 'product_guide_costs')
        .contains('new_values', { product_id: productId })
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) {
        console.error('감사 로그 조회 오류:', error)
        return
      }

      // 감사 로그 데이터를 GuideCostHistoryRecord 형식으로 변환
      const convertedHistory = data?.map(log => ({
        id: log.id,
        action: log.action as 'created' | 'updated' | 'deactivated',
        old_guide_fee: log.old_values?.guide_fee,
        new_guide_fee: log.new_values?.guide_fee,
        old_assistant_fee: log.old_values?.assistant_fee,
        new_assistant_fee: log.new_values?.assistant_fee,
        old_driver_fee: log.old_values?.driver_fee,
        new_driver_fee: log.new_values?.driver_fee,
        old_effective_from: log.old_values?.effective_from,
        new_effective_from: log.new_values?.effective_from,
        old_effective_to: log.old_values?.effective_to,
        new_effective_to: log.new_values?.effective_to,
        changed_at: log.created_at
      })) || []

      setHistory(convertedHistory)
    } catch (error) {
      console.error('감사 로그 조회 오류:', error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getActionText = (action: string) => {
    switch (action) {
      case 'created': return '생성'
      case 'updated': return '수정'
      case 'deactivated': return '비활성화'
      default: return action
    }
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case 'created': return 'bg-green-100 text-green-800'
      case 'updated': return 'bg-blue-100 text-blue-800'
      case 'deactivated': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatFee = (fee: number | undefined) => {
    if (fee === undefined || fee === null) return '-'
    return `$${fee.toFixed(2)}`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[80vh] overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <History className="h-6 w-6 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">가이드비 변경 이력</h3>
              <p className="text-sm text-gray-600">{productName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* 내용 */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8">
              <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">변경 이력이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((record, index) => (
                <div key={record.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionColor(record.action)}`}>
                        {getActionText(record.action)}
                      </span>
                      <div className="flex items-center space-x-1 text-sm text-gray-600">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(record.changed_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* 변경 내용 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* 가이드비 */}
                    {(record.old_guide_fee !== undefined || record.new_guide_fee !== undefined) && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center space-x-2 mb-2">
                          <DollarSign className="h-4 w-4 text-gray-600" />
                          <span className="text-sm font-medium text-gray-700">가이드비</span>
                        </div>
                        <div className="space-y-1">
                          {record.old_guide_fee !== undefined && (
                            <div className="text-sm">
                              <span className="text-gray-500">이전:</span>
                              <span className="ml-2 font-mono">{formatFee(record.old_guide_fee)}</span>
                            </div>
                          )}
                          {record.new_guide_fee !== undefined && (
                            <div className="text-sm">
                              <span className="text-gray-500">변경:</span>
                              <span className="ml-2 font-mono font-medium">{formatFee(record.new_guide_fee)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 어시스턴트비 */}
                    {(record.old_assistant_fee !== undefined || record.new_assistant_fee !== undefined) && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center space-x-2 mb-2">
                          <DollarSign className="h-4 w-4 text-gray-600" />
                          <span className="text-sm font-medium text-gray-700">어시스턴트비</span>
                        </div>
                        <div className="space-y-1">
                          {record.old_assistant_fee !== undefined && (
                            <div className="text-sm">
                              <span className="text-gray-500">이전:</span>
                              <span className="ml-2 font-mono">{formatFee(record.old_assistant_fee)}</span>
                            </div>
                          )}
                          {record.new_assistant_fee !== undefined && (
                            <div className="text-sm">
                              <span className="text-gray-500">변경:</span>
                              <span className="ml-2 font-mono font-medium">{formatFee(record.new_assistant_fee)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 드라이버비 */}
                    {(record.old_driver_fee !== undefined || record.new_driver_fee !== undefined) && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center space-x-2 mb-2">
                          <DollarSign className="h-4 w-4 text-gray-600" />
                          <span className="text-sm font-medium text-gray-700">드라이버비</span>
                        </div>
                        <div className="space-y-1">
                          {record.old_driver_fee !== undefined && (
                            <div className="text-sm">
                              <span className="text-gray-500">이전:</span>
                              <span className="ml-2 font-mono">{formatFee(record.old_driver_fee)}</span>
                            </div>
                          )}
                          {record.new_driver_fee !== undefined && (
                            <div className="text-sm">
                              <span className="text-gray-500">변경:</span>
                              <span className="ml-2 font-mono font-medium">{formatFee(record.new_driver_fee)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 유효 기간 변경 */}
                  {(record.old_effective_from !== undefined || record.new_effective_from !== undefined ||
                    record.old_effective_to !== undefined || record.new_effective_to !== undefined) && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center space-x-2 mb-2">
                        <Calendar className="h-4 w-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">유효 기간</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <span className="text-xs text-gray-500">시작일</span>
                          <div className="text-sm">
                            {record.old_effective_from && (
                              <div>
                                <span className="text-gray-500">이전:</span>
                                <span className="ml-2">{record.old_effective_from}</span>
                              </div>
                            )}
                            {record.new_effective_from && (
                              <div>
                                <span className="text-gray-500">변경:</span>
                                <span className="ml-2 font-medium">{record.new_effective_from}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">종료일</span>
                          <div className="text-sm">
                            {record.old_effective_to && (
                              <div>
                                <span className="text-gray-500">이전:</span>
                                <span className="ml-2">{record.old_effective_to}</span>
                              </div>
                            )}
                            {record.new_effective_to && (
                              <div>
                                <span className="text-gray-500">변경:</span>
                                <span className="ml-2 font-medium">{record.new_effective_to}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex justify-end p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
