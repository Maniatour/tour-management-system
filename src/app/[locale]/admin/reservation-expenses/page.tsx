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
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }

  // 구글 시트 동기화
  const handleSync = async () => {
    if (!syncFormData.spreadsheetId || !syncFormData.sheetName) {
      alert(t('sync.requiredFields'))
      return
    }

    try {
      setSyncing(true)
      setSyncMessage(t('sync.startSyncMessage'))

      const response = await fetch('/api/reservation-expenses/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(syncFormData)
      })

      const result = await response.json()
      
      if (result.success) {
        setSyncMessage(t('sync.successMessage', { message: result.message }))
        await loadStats() // 통계 새로고침
      } else {
        setSyncMessage(t('sync.errorMessage', { message: result.message }))
      }
    } catch (error) {
      console.error('Sync error:', error)
      setSyncMessage(t('sync.error', { message: error instanceof Error ? error.message : 'Unknown error' }))
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
          <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
        </div>
        <p className="text-gray-600">
          {t('subtitle')}
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
              <p className="text-sm font-medium text-gray-600">{t('stats.total')}</p>
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
              <p className="text-sm font-medium text-gray-600">{t('stats.pending')}</p>
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
              <p className="text-sm font-medium text-gray-600">{t('stats.approved')}</p>
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
              <p className="text-sm font-medium text-gray-600">{t('stats.rejected')}</p>
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
              <h2 className="text-lg font-semibold text-gray-900">{t('sync.title')}</h2>
            </div>
            <button
              onClick={() => setShowSyncForm(!showSyncForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {showSyncForm ? t('sync.hide') : t('sync.showSettings')}
            </button>
          </div>
        </div>

        {showSyncForm && (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('sync.spreadsheetId')}
                </label>
                <input
                  type="text"
                  value={syncFormData.spreadsheetId}
                  onChange={(e) => setSyncFormData(prev => ({ ...prev, spreadsheetId: e.target.value }))}
                  placeholder={t('sync.spreadsheetIdPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('sync.sheetName')}
                </label>
                <input
                  type="text"
                  value={syncFormData.sheetName}
                  onChange={(e) => setSyncFormData(prev => ({ ...prev, sheetName: e.target.value }))}
                  placeholder={t('sync.sheetNamePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                <p>{t('sync.columnInfo')}</p>
              </div>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {syncing ? t('sync.syncing') : t('sync.syncButton')}
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
