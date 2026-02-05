'use client'

import React, { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import PaymentMethodManager from '@/components/PaymentMethodManager'
import { 
  CreditCard, 
  Download, 
  Upload, 
  BarChart3, 
  Filter, 
  Search, 
  DollarSign,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  PieChart
} from 'lucide-react'

interface PaymentMethodStats {
  total: number
  active: number
  inactive: number
  suspended: number
  expired: number
  byType: {
    card: number
    cash: number
    transfer: number
    mobile: number
    other: number
  }
  totalLimit: number
  totalUsage: number
}

export default function PaymentMethodsPage() {
  const t = useTranslations('paymentMethod')
  const [stats, setStats] = useState<PaymentMethodStats>({
    total: 0,
    active: 0,
    inactive: 0,
    suspended: 0,
    expired: 0,
    byType: { card: 0, cash: 0, transfer: 0, mobile: 0, other: 0 },
    totalLimit: 0,
    totalUsage: 0
  })
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [showSyncForm, setShowSyncForm] = useState(false)
  const [syncFormData, setSyncFormData] = useState({
    spreadsheetId: '',
    sheetName: ''
  })

  // 통계 로드
  const loadStats = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/payment-methods/sync')
      const result = await response.json()
      
      if (result.success) {
        setStats(result.data)
      }
    } catch (error) {
      console.error('통계 로드 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  // 구글 시트 동기화
  const handleSync = async () => {
    if (!syncFormData.spreadsheetId || !syncFormData.sheetName) {
      alert('스프레드시트 ID와 시트 이름을 입력해주세요.')
      return
    }

    try {
      setSyncing(true)
      setSyncMessage('동기화를 시작합니다...')

      const response = await fetch('/api/payment-methods/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(syncFormData)
      })

      const result = await response.json()
      
      if (result.success) {
        setSyncMessage(`동기화 완료: ${result.message}`)
        await loadStats() // 통계 새로고침
      } else {
        setSyncMessage(`동기화 실패: ${result.message}`)
      }
    } catch (error) {
      console.error('동기화 오류:', error)
      setSyncMessage(`동기화 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    } finally {
      setSyncing(false)
    }
  }

  // 사용량 리셋
  const handleResetUsage = async (resetType: 'monthly' | 'daily') => {
    if (!confirm(`정말로 ${resetType === 'monthly' ? '월별' : '일별'} 사용량을 리셋하시겠습니까?`)) return

    try {
      const response = await fetch('/api/payment-methods/usage', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reset_type: resetType })
      })

      const result = await response.json()
      
      if (result.success) {
        alert(`${resetType === 'monthly' ? '월별' : '일별'} 사용량이 리셋되었습니다.`)
        await loadStats() // 통계 새로고침
      } else {
        alert(`사용량 리셋에 실패했습니다: ${result.message}`)
      }
    } catch (error) {
      console.error('사용량 리셋 오류:', error)
      alert(`사용량 리셋 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  // 통화 포맷
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(amount)
  }

  // 사용률 계산
  const getUsageRate = () => {
    if (stats.totalLimit === 0) return 0
    return Math.min((stats.totalUsage / stats.totalLimit) * 100, 100)
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-7xl mx-auto">
      {/* 헤더 - 모바일 컴팩트 */}
      <div className="mb-4 sm:mb-6 lg:mb-8">
        <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
          <CreditCard className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 flex-shrink-0" />
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900">결제 방법 관리</h1>
        </div>
        <p className="text-gray-600 text-xs sm:text-sm hidden sm:block">
          직원 카드 및 결제 방법을 관리하고 사용량을 추적할 수 있습니다.
        </p>
      </div>

      {/* 통계 카드 - 모바일 2x2 컴팩트 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 lg:gap-6 mb-4 sm:mb-6 lg:mb-8">
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6">
          <div className="flex items-center gap-2 sm:block sm:ml-0">
            <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg w-9 h-9 sm:w-auto sm:h-auto flex items-center justify-center">
              <BarChart3 className="h-4 w-4 sm:h-6 sm:w-6 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">전체</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6">
          <div className="flex items-center gap-2 sm:block sm:ml-0">
            <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg w-9 h-9 sm:w-auto sm:h-auto flex items-center justify-center">
              <CheckCircle className="h-4 w-4 sm:h-6 sm:w-6 text-green-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">활성</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.active}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6">
          <div className="flex items-center gap-2 sm:block sm:ml-0">
            <div className="p-1.5 sm:p-2 bg-yellow-100 rounded-lg w-9 h-9 sm:w-auto sm:h-auto flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 sm:h-6 sm:w-6 text-yellow-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">정지/만료</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.suspended + stats.expired}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6">
          <div className="flex items-center gap-2 sm:block sm:ml-0">
            <div className="p-1.5 sm:p-2 bg-purple-100 rounded-lg w-9 h-9 sm:w-auto sm:h-auto flex items-center justify-center">
              <DollarSign className="h-4 w-4 sm:h-6 sm:w-6 text-purple-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">총 한도</p>
              <p className="text-base sm:text-2xl font-bold text-gray-900 truncate">{formatCurrency(stats.totalLimit)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 사용량 및 유형별 통계 - 모바일 컴팩트 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6 mb-4 sm:mb-6 lg:mb-8">
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 sm:mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">사용량 현황</h3>
            <div className="flex gap-2">
              <button
                onClick={() => handleResetUsage('daily')}
                className="flex-1 sm:flex-none px-2 py-1.5 sm:px-3 text-xs sm:text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
              >
                일별 리셋
              </button>
              <button
                onClick={() => handleResetUsage('monthly')}
                className="flex-1 sm:flex-none px-2 py-1.5 sm:px-3 text-xs sm:text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                월별 리셋
              </button>
            </div>
          </div>
          <div className="space-y-3 sm:space-y-4">
            <div>
              <div className="flex justify-between text-xs sm:text-sm text-gray-600 mb-1.5 sm:mb-2">
                <span>월 사용량</span>
                <span className="truncate ml-2">{formatCurrency(stats.totalUsage)} / {formatCurrency(stats.totalLimit)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 sm:h-3">
                <div 
                  className={`h-2.5 sm:h-3 rounded-full ${getUsageRate() >= 90 ? 'bg-red-500' : getUsageRate() >= 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{ width: `${getUsageRate()}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">사용률: {getUsageRate().toFixed(1)}%</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">유형별 분포</h3>
          <div className="space-y-2 sm:space-y-3">
            {Object.entries(stats.byType).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0 ${
                    type === 'card' ? 'bg-blue-500' :
                    type === 'cash' ? 'bg-green-500' :
                    type === 'transfer' ? 'bg-purple-500' :
                    type === 'mobile' ? 'bg-orange-500' : 'bg-gray-500'
                  }`}></div>
                  <span className="text-xs sm:text-sm font-medium text-gray-700 capitalize">{type}</span>
                </div>
                <span className="text-xs sm:text-sm text-gray-600">{count}개</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 구글 시트 동기화 섹션 - 모바일 컴팩트 */}
      <div className="bg-white rounded-lg shadow mb-4 sm:mb-6 lg:mb-8">
        <div className="p-3 sm:p-4 lg:p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Upload className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 flex-shrink-0" />
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate">구글 시트 동기화</h2>
            </div>
            <button
              onClick={() => setShowSyncForm(!showSyncForm)}
              className="px-3 py-1.5 sm:px-4 sm:py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
            >
              {showSyncForm ? '숨기기' : '동기화 설정'}
            </button>
          </div>
        </div>

        {showSyncForm && (
          <div className="p-3 sm:p-4 lg:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">스프레드시트 ID</label>
                <input
                  type="text"
                  value={syncFormData.spreadsheetId}
                  onChange={(e) => setSyncFormData(prev => ({ ...prev, spreadsheetId: e.target.value }))}
                  placeholder="스프레드시트 ID"
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">시트 이름</label>
                <input
                  type="text"
                  value={syncFormData.sheetName}
                  onChange={(e) => setSyncFormData(prev => ({ ...prev, sheetName: e.target.value }))}
                  placeholder="시트 이름"
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-xs sm:text-sm text-gray-600 space-y-0.5">
                <p>컬럼: ID, Method, User, Limit, Status</p>
                <p className="text-gray-500 hidden sm:block">예: PAYM012 | CC 4052 | lmtchad@gmail.com | 5000 | active</p>
              </div>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="px-4 sm:px-6 py-1.5 sm:py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex-shrink-0"
              >
                {syncing ? '동기화 중...' : '동기화 시작'}
              </button>
            </div>

            {syncMessage && (
              <div className="mt-3 sm:mt-4 p-2.5 sm:p-3 bg-gray-100 rounded-lg">
                <p className="text-xs sm:text-sm text-gray-700">{syncMessage}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 결제 방법 관리 컴포넌트 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-3 sm:p-4 lg:p-6">
          <PaymentMethodManager />
        </div>
      </div>
    </div>
  )
}
