'use client'

import { useState } from 'react'
import { Cloud, Download, Calendar, RefreshCw, Sun } from 'lucide-react'

interface WeatherDataCollectorProps {
  className?: string
}

export default function WeatherDataCollector({ className = '' }: WeatherDataCollectorProps) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')

  const collectDataForDate = async (date: string) => {
    try {
      setLoading(true)
      setError('')
      setMessage('')

      const response = await fetch('/api/weather-collector', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ date })
      })

      if (response.ok) {
        const result = await response.json()
        setMessage(`✅ ${date} 날짜 데이터 수집 완료: ${result.message}`)
      } else {
        const errorData = await response.json()
        setError(`❌ 오류: ${errorData.error}`)
      }
    } catch (err) {
      setError(`❌ 네트워크 오류: ${err instanceof Error ? err.message : '알 수 없는 오류'}`)
    } finally {
      setLoading(false)
    }
  }

  const collectDataForRange = async (startDate: string, endDate: string) => {
    try {
      setLoading(true)
      setError('')
      setMessage('')

      const response = await fetch('/api/weather-collector', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ startDate, endDate })
      })

      if (response.ok) {
        const result = await response.json()
        setMessage(`✅ ${startDate} ~ ${endDate} 기간 데이터 수집 완료: ${result.message}`)
      } else {
        const errorData = await response.json()
        setError(`❌ 오류: ${errorData.error}`)
      }
    } catch (err) {
      setError(`❌ 네트워크 오류: ${err instanceof Error ? err.message : '알 수 없는 오류'}`)
    } finally {
      setLoading(false)
    }
  }

  const collectNext7Days = async () => {
    try {
      setLoading(true)
      setError('')
      setMessage('')

      const response = await fetch('/api/weather-scheduler')

      if (response.ok) {
        const result = await response.json()
        setMessage(`✅ 다음 7일간 데이터 수집 완료: ${result.message}`)
        if (result.results) {
          const successCount = result.results.filter((r: any) => r.status === 'success').length
          const errorCount = result.results.filter((r: any) => r.status === 'error').length
          setMessage(`✅ 다음 7일간 데이터 수집 완료: 성공 ${successCount}일, 실패 ${errorCount}일`)
        }
      } else {
        const errorData = await response.json()
        setError(`❌ 오류: ${errorData.error}`)
      }
    } catch (err) {
      setError(`❌ 네트워크 오류: ${err instanceof Error ? err.message : '알 수 없는 오류'}`)
    } finally {
      setLoading(false)
    }
  }

  const collect1MonthSunriseSunset = async (startDate: string) => {
    try {
      setLoading(true)
      setError('')
      setMessage('')

      const response = await fetch('/api/weather-collector', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          collect1MonthSunriseSunset: true,
          startDate: startDate
        })
      })

      if (response.ok) {
        const result = await response.json()
        setMessage(`✅ 1개월 일출/일몰 데이터 수집 완료: ${result.message}`)
      } else {
        const errorData = await response.json()
        setError(`❌ 오류: ${errorData.error}`)
      }
    } catch (err) {
      setError(`❌ 네트워크 오류: ${err instanceof Error ? err.message : '알 수 없는 오류'}`)
    } finally {
      setLoading(false)
    }
  }

  const getToday = () => {
    return new Date().toISOString().split('T')[0]
  }

  const getNextWeek = () => {
    const today = new Date()
    const nextWeek = new Date(today)
    nextWeek.setDate(today.getDate() + 7)
    return nextWeek.toISOString().split('T')[0]
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
      <div className="flex items-center mb-4">
        <div className="bg-blue-100 rounded-full p-2 mr-3">
          <Cloud className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800">날씨 데이터 수집</h2>
          <p className="text-sm text-gray-600">밤도깨비 투어 날씨 및 일출/일몰 데이터 수집</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* 1개월 일출/일몰 데이터 수집 */}
        <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="flex items-center flex-1">
            <Sun className="h-4 w-4 text-yellow-600 mr-2" />
            <div className="flex-1">
              <span className="text-sm font-medium text-yellow-800">1개월 일출/일몰 데이터 수집</span>
              <p className="text-xs text-yellow-600">그랜드캐년 사우스림만</p>
              <div className="mt-2">
                <input
                  type="date"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="text-xs px-2 py-1 border border-yellow-300 rounded"
                  placeholder="시작 날짜 선택"
                />
              </div>
            </div>
          </div>
          <button
            onClick={() => collect1MonthSunriseSunset(selectedMonth || getToday())}
            disabled={loading || !selectedMonth}
            className="px-4 py-2 bg-yellow-600 text-white text-sm rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center ml-4"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            수집
          </button>
        </div>

        {/* 오늘 날짜 수집 */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center">
            <Calendar className="h-4 w-4 text-gray-500 mr-2" />
            <span className="text-sm font-medium">오늘 날짜 데이터 수집</span>
          </div>
          <button
            onClick={() => collectDataForDate(getToday())}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            수집
          </button>
        </div>

        {/* 다음 7일간 수집 */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center">
            <Calendar className="h-4 w-4 text-gray-500 mr-2" />
            <span className="text-sm font-medium">다음 7일간 데이터 수집</span>
          </div>
          <button
            onClick={collectNext7Days}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            수집
          </button>
        </div>

        {/* 특정 기간 수집 */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center">
            <Calendar className="h-4 w-4 text-gray-500 mr-2" />
            <span className="text-sm font-medium">특정 기간 데이터 수집</span>
          </div>
          <button
            onClick={() => collectDataForRange(getToday(), getNextWeek())}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            수집
          </button>
        </div>
      </div>

      {/* 메시지 표시 */}
      {message && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700">{message}</p>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* 안내 메시지 */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="text-sm text-blue-700">
          <p className="font-medium mb-1">💡 사용 팁:</p>
          <ul className="text-xs space-y-1">
            <li>• <strong>1개월 일출/일몰</strong>: 그랜드캐년 사우스림 1개월치 일출/일몰 데이터 수집 (권장)</li>
            <li>• 오늘 날짜: 현재 날짜의 데이터만 수집</li>
            <li>• 다음 7일간: 오늘부터 7일간의 데이터 수집</li>
            <li>• 특정 기간: 오늘부터 다음 주까지의 데이터 수집</li>
            <li>• 데이터 수집 후 투어 페이지에서 캐시된 데이터를 확인할 수 있습니다</li>
          </ul>
        </div>
      </div>
    </div>
  )
}