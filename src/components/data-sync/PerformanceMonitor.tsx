import React, { useState, useEffect } from 'react'
import { Activity, Zap, Clock, Database, TrendingUp, RefreshCw } from 'lucide-react'

interface PerformanceMetrics {
  dataReadTime: number
  dataTransformTime: number
  dataValidationTime: number
  databaseWriteTime: number
  totalTime: number
  rowsPerSecond: number
  cacheStats: {
    size: number
    hitRate: number
  }
}

interface PerformanceMonitorProps {
  metrics?: PerformanceMetrics | null
  onRefreshCache?: () => void
  onClearCache?: () => void
}

export default function PerformanceMonitor({ 
  metrics, 
  onRefreshCache, 
  onClearCache 
}: PerformanceMonitorProps) {
  const [cacheStats, setCacheStats] = useState<{ size: number, hitRate: number } | null>(null)

  useEffect(() => {
    fetchCacheStats()
  }, [])

  const fetchCacheStats = async () => {
    try {
      const response = await fetch('/api/sync/optimized?action=cache-stats')
      const result = await response.json()
      if (result.success) {
        setCacheStats(result.data)
      }
    } catch (error) {
      console.error('캐시 통계 조회 실패:', error)
    }
  }

  const handleClearCache = async () => {
    try {
      const response = await fetch('/api/sync/optimized?action=clear-cache', {
        method: 'GET'
      })
      const result = await response.json()
      if (result.success) {
        await fetchCacheStats()
        onClearCache?.()
      }
    } catch (error) {
      console.error('캐시 삭제 실패:', error)
    }
  }

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const getPerformanceGrade = (rowsPerSecond: number) => {
    if (rowsPerSecond > 1000) return { grade: 'A+', color: 'text-green-600', bg: 'bg-green-100' }
    if (rowsPerSecond > 500) return { grade: 'A', color: 'text-green-500', bg: 'bg-green-50' }
    if (rowsPerSecond > 200) return { grade: 'B', color: 'text-yellow-500', bg: 'bg-yellow-50' }
    if (rowsPerSecond > 100) return { grade: 'C', color: 'text-orange-500', bg: 'bg-orange-50' }
    return { grade: 'D', color: 'text-red-500', bg: 'bg-red-50' }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Activity className="h-5 w-5 mr-2 text-blue-600" />
          성능 모니터링
        </h3>
        <div className="flex space-x-2">
          <button
            onClick={fetchCacheStats}
            className="px-3 py-1 text-sm bg-blue-100 text-blue-600 rounded hover:bg-blue-200 flex items-center"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            새로고침
          </button>
          <button
            onClick={handleClearCache}
            className="px-3 py-1 text-sm bg-red-100 text-red-600 rounded hover:bg-red-200"
          >
            캐시 삭제
          </button>
        </div>
      </div>

      {/* 캐시 통계 */}
      {cacheStats && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-2">캐시 통계</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{cacheStats.size}</div>
              <div className="text-xs text-gray-500">캐시 항목</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{cacheStats.hitRate}</div>
              <div className="text-xs text-gray-500">평균 히트율</div>
            </div>
          </div>
        </div>
      )}

      {/* 성능 메트릭 */}
      {metrics && (
        <div className="space-y-4">
          {/* 전체 성능 등급 */}
          <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
            <div className="flex items-center justify-center mb-2">
              <TrendingUp className="h-6 w-6 text-blue-600 mr-2" />
              <span className="text-lg font-semibold text-gray-700">성능 등급</span>
            </div>
            <div className={`inline-flex items-center px-4 py-2 rounded-full text-2xl font-bold ${getPerformanceGrade(metrics.rowsPerSecond).bg} ${getPerformanceGrade(metrics.rowsPerSecond).color}`}>
              {getPerformanceGrade(metrics.rowsPerSecond).grade}
            </div>
            <div className="text-sm text-gray-600 mt-2">
              {metrics.rowsPerSecond} 행/초 처리
            </div>
          </div>

          {/* 상세 성능 메트릭 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center mb-1">
                <Clock className="h-4 w-4 text-blue-600 mr-1" />
                <span className="text-sm font-medium text-gray-700">총 처리 시간</span>
              </div>
              <div className="text-xl font-bold text-blue-600">{formatTime(metrics.totalTime)}</div>
            </div>

            <div className="p-3 bg-green-50 rounded-lg">
              <div className="flex items-center mb-1">
                <Zap className="h-4 w-4 text-green-600 mr-1" />
                <span className="text-sm font-medium text-gray-700">처리 속도</span>
              </div>
              <div className="text-xl font-bold text-green-600">{metrics.rowsPerSecond} 행/초</div>
            </div>

            <div className="p-3 bg-purple-50 rounded-lg">
              <div className="flex items-center mb-1">
                <Database className="h-4 w-4 text-purple-600 mr-1" />
                <span className="text-sm font-medium text-gray-700">데이터 읽기</span>
              </div>
              <div className="text-lg font-bold text-purple-600">{formatTime(metrics.dataReadTime)}</div>
            </div>

            <div className="p-3 bg-orange-50 rounded-lg">
              <div className="flex items-center mb-1">
                <Activity className="h-4 w-4 text-orange-600 mr-1" />
                <span className="text-sm font-medium text-gray-700">데이터 변환</span>
              </div>
              <div className="text-lg font-bold text-orange-600">{formatTime(metrics.dataTransformTime)}</div>
            </div>
          </div>

          {/* 성능 개선 제안 */}
          <div className="p-4 bg-yellow-50 rounded-lg">
            <h4 className="text-sm font-semibold text-yellow-800 mb-2">성능 개선 제안</h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              {metrics.rowsPerSecond < 100 && (
                <li>• 배치 크기를 늘려보세요 (현재보다 큰 배치 사용)</li>
              )}
              {metrics.dataReadTime > metrics.totalTime * 0.5 && (
                <li>• Google Sheets API 호출을 최적화하세요</li>
              )}
              {metrics.dataTransformTime > metrics.totalTime * 0.3 && (
                <li>• 데이터 변환 로직을 병렬화하세요</li>
              )}
              {cacheStats && cacheStats.hitRate < 0.5 && (
                <li>• 캐시 히트율이 낮습니다. 캐시 전략을 검토하세요</li>
              )}
              {metrics.rowsPerSecond > 500 && (
                <li>• 🎉 우수한 성능입니다! 현재 설정을 유지하세요</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {!metrics && (
        <div className="text-center py-8 text-gray-500">
          <Activity className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>동기화를 실행하면 성능 메트릭이 표시됩니다</p>
        </div>
      )}
    </div>
  )
}
