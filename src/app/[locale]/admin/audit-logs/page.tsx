'use client'

import React, { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Calendar,
  User,
  Database,
  Activity,
  ArrowUpDown
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ProtectedRoute from '@/components/auth/ProtectedRoute'

interface AuditLog {
  id: string
  table_name: string
  record_id: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  changed_fields: string[]
  user_id: string
  user_email: string
  ip_address: string
  user_agent: string
  created_at: string
  record_name: string
}

export default function AdminAuditLogs() {
  // const t = useTranslations('audit')
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTable, setSelectedTable] = useState('all')
  const [selectedAction, setSelectedAction] = useState('all')
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  })

  // 감사 로그 데이터 가져오기
  useEffect(() => {
    fetchAuditLogs()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAuditLogs = async () => {
    try {
      setLoading(true)
      
      let query = supabase
        .from('audit_logs_view')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000)

      // 필터 적용
      if (selectedTable !== 'all') {
        query = query.eq('table_name', selectedTable)
      }
      if (selectedAction !== 'all') {
        query = query.eq('action', selectedAction)
      }
      if (dateRange.start) {
        query = query.gte('created_at', dateRange.start)
      }
      if (dateRange.end) {
        query = query.lte('created_at', dateRange.end + 'T23:59:59')
      }

      const { data, error } = await query

      if (error) {
        console.error('감사 로그 조회 오류:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        
        // 에러 상태 설정
        let errorMessage = ''
        if (error.code === 'PGRST116') {
          errorMessage = '감사 로그 뷰가 존재하지 않습니다. 데이터베이스에 audit_logs_view를 생성해주세요.'
        } else if (error.code === '42501') {
          errorMessage = '감사 로그에 대한 접근 권한이 없습니다. 관리자에게 문의하세요.'
        } else {
          errorMessage = `감사 로그 조회 중 오류가 발생했습니다: ${error.message}`
        }
        
        setError(errorMessage)
        return
      }

      setAuditLogs(data || [])
      setError(null) // 에러 상태 초기화
    } catch (error) {
      console.error('감사 로그 조회 중 예상치 못한 오류:', error)
      setError('감사 로그 조회 중 예상치 못한 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  // 필터 적용
  const applyFilters = () => {
    fetchAuditLogs()
  }

  // 필터 초기화
  const resetFilters = () => {
    setSelectedTable('all')
    setSelectedAction('all')
    setDateRange({ start: '', end: '' })
    setSearchTerm('')
    fetchAuditLogs()
  }

  // 감사 로그 내보내기
  const exportAuditLogs = () => {
    const csvContent = [
      ['테이블', '레코드 ID', '액션', '변경된 필드', '사용자', 'IP 주소', '날짜'],
      ...auditLogs.map(log => [
        log.table_name,
        log.record_id,
        log.action,
        log.changed_fields.join(', '),
        log.user_email || 'N/A',
        log.ip_address || 'N/A',
        new Date(log.created_at).toLocaleString('ko-KR')
      ])
    ].map(row => row.map(field => `"${field}"`).join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  // 액션별 색상
  const getActionColor = (action: string) => {
    switch (action) {
      case 'INSERT': return 'bg-green-100 text-green-800'
      case 'UPDATE': return 'bg-blue-100 text-blue-800'
      case 'DELETE': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // 테이블명 한글화
  const getTableName = (tableName: string) => {
    const tableNames: { [key: string]: string } = {
      'customers': '고객',
      'team': '팀원',
      'products': '상품',
      'options': '옵션',
      'tours': '투어',
      'reservations': '예약',
      'channels': '채널',
      'product_options': '상품옵션',
      'dynamic_pricing_rules': '동적 가격 규칙',
      'weekday_pricing': '요일별 가격',
      'required_option_pricing': '필수 옵션 가격'
    }
    return tableNames[tableName] || tableName
  }

  // 변경사항 상세 보기
  const ViewChanges = ({ log }: { log: AuditLog }) => {
    const [isOpen, setIsOpen] = useState(false)

    if (log.action === 'INSERT') {
      return (
        <div className="text-sm">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-blue-600 hover:text-blue-800 flex items-center"
          >
            <Eye size={14} className="mr-1" />
            새로 생성된 데이터 보기
          </button>
          {isOpen && (
            <div className="mt-2 p-3 bg-gray-50 rounded text-xs">
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(log.new_values, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )
    }

    if (log.action === 'UPDATE') {
      return (
        <div className="text-sm">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-blue-600 hover:text-blue-800 flex items-center"
          >
            <Eye size={14} className="mr-1" />
            변경사항 보기 ({log.changed_fields.length}개 필드)
          </button>
          {isOpen && (
            <div className="mt-2 p-3 bg-gray-50 rounded text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-red-600 mb-2">이전 값</h4>
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(log.old_values, null, 2)}
                  </pre>
                </div>
                <div>
                  <h4 className="font-semibold text-green-600 mb-2">새로운 값</h4>
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(log.new_values, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      )
    }

    if (log.action === 'DELETE') {
      return (
        <div className="text-sm">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-blue-600 hover:text-blue-800 flex items-center"
          >
            <Eye size={14} className="mr-1" />
            삭제된 데이터 보기
          </button>
          {isOpen && (
            <div className="mt-2 p-3 bg-gray-50 rounded text-xs">
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(log.old_values, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )
    }

    return null
  }

  return (
    <ProtectedRoute requiredPermission="canViewAuditLogs">
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">감사 추적</h1>
          <p className="mt-2 text-gray-600">
            모든 데이터베이스 변경사항을 추적하고 기록합니다
          </p>
        </div>
        <button
          onClick={exportAuditLogs}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2"
        >
          <Download size={16} />
          <span>내보내기</span>
        </button>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">오류 발생</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setError(null)
                    fetchAuditLogs()
                  }}
                  className="bg-red-100 text-red-800 px-3 py-2 rounded-md text-sm font-medium hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  다시 시도
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 필터 섹션 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center space-x-4 mb-4">
          <Filter className="h-5 w-5 text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900">필터</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* 테이블 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">테이블</label>
            <select
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">모든 테이블</option>
              <option value="customers">고객</option>
              <option value="team">팀원</option>
              <option value="products">상품</option>
              <option value="options">옵션</option>
              <option value="tours">투어</option>
              <option value="reservations">예약</option>
              <option value="channels">채널</option>
              <option value="product_options">상품옵션</option>
              <option value="dynamic_pricing_rules">동적 가격 규칙</option>
              <option value="weekday_pricing">요일별 가격</option>
              <option value="required_option_pricing">필수 옵션 가격</option>
            </select>
          </div>

          {/* 액션 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">액션</label>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">모든 액션</option>
              <option value="INSERT">생성</option>
              <option value="UPDATE">수정</option>
              <option value="DELETE">삭제</option>
            </select>
          </div>

          {/* 시작 날짜 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">시작 날짜</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* 종료 날짜 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">종료 날짜</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex space-x-3 mt-4">
          <button
            onClick={applyFilters}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            필터 적용
          </button>
          <button
            onClick={resetFilters}
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
          >
            필터 초기화
          </button>
        </div>
      </div>

      {/* 감사 로그 테이블 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              감사 로그 ({auditLogs.length}건)
            </h3>
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">
            <Activity className="h-8 w-8 mx-auto mb-2 animate-spin" />
            감사 로그를 불러오는 중...
          </div>
        ) : auditLogs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Database className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>감사 로그가 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button className="flex items-center space-x-1 hover:text-gray-700">
                      <span>날짜/시간</span>
                      <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">테이블</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">레코드</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">액션</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">사용자</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP 주소</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상세보기</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {auditLogs
                  .filter(log => 
                    searchTerm === '' ||
                    log.table_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    log.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    log.record_name?.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                          {new Date(log.created_at).toLocaleString('ko-KR')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {getTableName(log.table_name)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <Database className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="font-mono text-xs">{log.record_id.substring(0, 8)}...</span>
                          {log.record_name && (
                            <span className="ml-2 text-gray-600">({log.record_name})</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                          {log.action === 'INSERT' ? '생성' : 
                           log.action === 'UPDATE' ? '수정' : '삭제'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <User className="h-4 w-4 text-gray-400 mr-2" />
                          {log.user_email || '시스템'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {log.ip_address || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <ViewChanges log={log} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
    </ProtectedRoute>
  )
}
