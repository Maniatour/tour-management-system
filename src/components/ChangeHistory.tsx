'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Eye, Clock, User, Database, Activity } from 'lucide-react'

interface ChangeHistoryProps {
  tableName: string
  recordId?: string
  title?: string
  maxItems?: number
}

interface ChangeRecord {
  id: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  old_values: Record<string, any> | null
  new_values: Record<string, any> | null
  changed_fields: string[]
  user_email: string
  created_at: string
}

export default function ChangeHistory({ 
  tableName, 
  recordId, 
  title = '변경 내역', 
  maxItems = 5 
}: ChangeHistoryProps) {
  const [changes, setChanges] = useState<ChangeRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    fetchChangeHistory()
  }, [tableName, recordId])

  const fetchChangeHistory = async () => {
    try {
      setLoading(true)
      
      // 감사 로그 시스템이 준비되었는지 확인 (더 안전한 방법)
      try {
        const { data: systemCheck, error: systemError } = await supabase
          .from('audit_logs')
          .select('id')
          .limit(1)

        if (systemError) {
          console.log('감사 로그 시스템이 아직 준비되지 않았습니다. 시스템 초기화 중...')
          setChanges([])
          return
        }
      } catch (error) {
        console.log('감사 로그 시스템이 아직 준비되지 않았습니다. 시스템 초기화 중...')
        setChanges([])
        return
      }

      // audit_logs 테이블에서 직접 조회
      let query = supabase
        .from('audit_logs')
        .select('id, table_name, record_id, action, old_values, new_values, changed_fields, user_email, created_at')
        .eq('table_name', tableName)
        .order('created_at', { ascending: false })

      if (recordId) {
        query = query.eq('record_id', recordId)
      }

      const { data, error } = await query

      if (error) {
        console.error('감사 로그 조회 오류:', error)
        // 오류가 발생해도 빈 배열로 설정하여 UI가 깨지지 않도록 함
        setChanges([])
        return
      }

      setChanges(data || [])
    } catch (error) {
      console.error('변경 내역 조회 중 예상치 못한 오류:', error)
      // 예외가 발생해도 빈 배열로 설정
      setChanges([])
    } finally {
      setLoading(false)
    }
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case 'INSERT': return 'bg-green-100 text-green-800'
      case 'UPDATE': return 'bg-blue-100 text-blue-800'
      case 'DELETE': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getActionText = (action: string) => {
    switch (action) {
      case 'INSERT': return '생성'
      case 'UPDATE': return '수정'
      case 'DELETE': return '삭제'
      default: return action
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

  const getFieldDisplayName = (fieldName: string) => {
    const fieldNames: Record<string, string> = {
      'name': '이름',
      'email': '이메일',
      'phone': '전화번호',
      'category': '카테고리',
      'description': '설명',
      'base_price': '기본 가격',
      'status': '상태',
      'commission_percent': '커미션 (%)',
      'markup_amount': '업차지 금액',
      'coupon_percent': '쿠폰 할인 (%)',
      'adult_price': '성인 가격',
      'child_price': '아동 가격',
      'infant_price': '유아 가격',
      'is_selling_product': '상품 판매 여부',
      'start_date': '시작일',
      'end_date': '종료일',
      'selected_weekdays': '선택된 요일',
      'is_sale_available': '판매 가능 여부'
    }
    return fieldNames[fieldName] || fieldName
  }

  const formatValue = (value: any, fieldName: string) => {
    if (value === null || value === undefined) return '없음'
    if (typeof value === 'boolean') return value ? '예' : '아니오'
    if (typeof value === 'number') return value.toLocaleString()
    if (Array.isArray(value)) {
      if (fieldName === 'selected_weekdays') {
        const dayNames = ['일', '월', '화', '수', '목', '금', '토']
        return value.map(day => dayNames[day] || day).join(', ')
      }
      return value.join(', ')
    }
    return String(value)
  }

  if (loading) {
    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">변경 내역 로딩 중...</span>
        </div>
      </div>
    )
  }

  if (changes.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center text-gray-500">
          <Clock className="h-5 w-5 mr-2" />
          <span>변경 내역이 없습니다</span>
        </div>
        <div className="mt-2 text-xs text-gray-400">
          아직 {tableName} 테이블에 대한 변경사항이 기록되지 않았습니다.
        </div>
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="text-xs text-blue-800">
            <strong>💡 팁:</strong> 감사 추적 시스템이 활성화되면 모든 데이터 변경사항이 자동으로 기록됩니다.
          </div>
        </div>
      </div>
    )
  }

  const displayChanges = expanded ? changes : changes.slice(0, maxItems)

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      {/* 헤더 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center">
          <Activity className="h-5 w-5 text-blue-600 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          <span className="ml-2 text-sm text-gray-500">({changes.length}건)</span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          {expanded ? '접기' : '더보기'}
        </button>
      </div>

      {/* 변경 내역 목록 */}
      <div className="divide-y divide-gray-200">
        {displayChanges.map((change, index) => (
          <div key={change.id} className="p-4 hover:bg-gray-50">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getActionColor(change.action)}`}>
                    {getActionText(change.action)}
                  </span>
                  <span className="text-sm text-gray-500">
                    {formatDate(change.created_at)}
                  </span>
                  {change.user_email && (
                    <div className="flex items-center text-sm text-gray-600">
                      <User className="h-4 w-4 mr-1" />
                      {change.user_email}
                    </div>
                  )}
                </div>

                {/* 변경된 필드들 */}
                {change.changed_fields && change.changed_fields.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">변경된 항목:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {change.changed_fields.map((field, fieldIndex) => {
                        const oldValue = change.old_values?.[field]
                        const newValue = change.new_values?.[field]
                        
                        return (
                          <div key={fieldIndex} className="bg-gray-50 p-3 rounded">
                            <div className="text-sm font-medium text-gray-700 mb-1">
                              {getFieldDisplayName(field)}
                            </div>
                            <div className="text-xs space-y-1">
                              {change.action === 'UPDATE' && (
                                <>
                                  <div className="text-red-600">
                                    <span className="font-medium">이전:</span> {formatValue(oldValue, field)}
                                  </div>
                                  <div className="text-green-600">
                                    <span className="font-medium">변경:</span> {formatValue(newValue, field)}
                                  </div>
                                </>
                              )}
                              {change.action === 'INSERT' && (
                                <div className="text-green-600">
                                  <span className="font-medium">설정:</span> {formatValue(newValue, field)}
                                </div>
                              )}
                              {change.action === 'DELETE' && (
                                <div className="text-red-600">
                                  <span className="font-medium">삭제됨:</span> {formatValue(oldValue, field)}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* 전체 데이터 보기 버튼 */}
                <div className="mt-3">
                  <button
                    onClick={() => {
                      if (change.action === 'INSERT') {
                        alert(`새로 생성된 데이터:\n${JSON.stringify(change.new_values, null, 2)}`)
                      } else if (change.action === 'UPDATE') {
                        alert(`변경 내역:\n이전 값: ${JSON.stringify(change.old_values, null, 2)}\n\n새로운 값: ${JSON.stringify(change.new_values, null, 2)}`)
                      } else if (change.action === 'DELETE') {
                        alert(`삭제된 데이터:\n${JSON.stringify(change.old_values, null, 2)}`)
                      }
                    }}
                    className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    상세 내용 보기
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 더보기/접기 버튼 */}
      {changes.length > maxItems && (
        <div className="p-4 border-t border-gray-200 text-center">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            {expanded ? '처음 5개만 보기' : `전체 ${changes.length}개 보기`}
          </button>
        </div>
      )}
    </div>
  )
}
