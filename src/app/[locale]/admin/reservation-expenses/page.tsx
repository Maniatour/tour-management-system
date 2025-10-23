'use client'

import React, { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import ReservationExpenseManager from '@/components/ReservationExpenseManager'
import { DollarSign, Download, Upload, BarChart3, Filter, Search } from 'lucide-react'

interface ReservationExpenseStats {
  total: number
  pending: number
  approved: number
  rejected: number
}

export default function ReservationExpensesPage() {
  const t = useTranslations('reservationExpense')
  const [stats, setStats] = useState<ReservationExpenseStats>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0
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
      const response = await fetch('/api/reservation-expenses/sync')
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

      const response = await fetch('/api/reservation-expenses/sync', {
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

  useEffect(() => {
    loadStats()
  }, [])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-4">
          <DollarSign className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">예약 지출 관리</h1>
        </div>
        <p className="text-gray-600">
          투어 이외의 예약에 대한 지출을 입력하고 관리할 수 있습니다.
        </p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BarChart3 className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">전체</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Filter className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">대기중</p>
              <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <BarChart3 className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">승인됨</p>
              <p className="text-2xl font-bold text-gray-900">{stats.approved}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <BarChart3 className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">거부됨</p>
              <p className="text-2xl font-bold text-gray-900">{stats.rejected}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 구글 시트 동기화 섹션 */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Upload className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">구글 시트 동기화</h2>
            </div>
            <button
              onClick={() => setShowSyncForm(!showSyncForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {showSyncForm ? '숨기기' : '동기화 설정'}
            </button>
          </div>
        </div>

        {showSyncForm && (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  스프레드시트 ID
                </label>
                <input
                  type="text"
                  value={syncFormData.spreadsheetId}
                  onChange={(e) => setSyncFormData(prev => ({ ...prev, spreadsheetId: e.target.value }))}
                  placeholder="구글 스프레드시트 ID를 입력하세요"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  시트 이름
                </label>
                <input
                  type="text"
                  value={syncFormData.sheetName}
                  onChange={(e) => setSyncFormData(prev => ({ ...prev, sheetName: e.target.value }))}
                  placeholder="시트 이름을 입력하세요"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                <p>구글 시트 컬럼: ID, Submit on, Submitted by, Paid to, Paid for, Amount, Payment Method, Note, Image, File, Status, Reservation ID, Event ID</p>
              </div>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {syncing ? '동기화 중...' : '동기화 시작'}
              </button>
            </div>

            {syncMessage && (
              <div className="mt-4 p-3 bg-gray-100 rounded-lg">
                <p className="text-sm text-gray-700">{syncMessage}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 예약 지출 관리 컴포넌트 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <ReservationExpenseManager />
        </div>
      </div>
    </div>
  )
}
