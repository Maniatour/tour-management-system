'use client'

import { RefreshCw } from 'lucide-react'
import { RealTimeStats } from '@/types/data-sync'

interface SyncProgressProps {
  loading: boolean
  progress: number
  etaMs: number | null
  realTimeStats: RealTimeStats
  syncLogs: string[]
}

export default function SyncProgress({
  loading,
  progress,
  etaMs,
  realTimeStats,
  syncLogs
}: SyncProgressProps) {
  if (!loading) {
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
        동기화 진행 중
      </h3>
      
      {/* 진행률 바 */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>진행률</span>
          <span>{progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-green-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        {etaMs && etaMs > 0 && (
          <div className="text-xs text-gray-500 mt-1">
            예상 완료 시간: {Math.ceil(etaMs / 1000)}초 후
          </div>
        )}
      </div>

      {/* 실시간 통계 */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="bg-blue-50 p-3 rounded-lg text-center">
          <div className="text-2xl font-bold text-blue-600">{realTimeStats.processed}</div>
          <div className="text-sm text-blue-800">처리됨</div>
        </div>
        <div className="bg-green-50 p-3 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-600">{realTimeStats.inserted}</div>
          <div className="text-sm text-green-800">삽입됨</div>
        </div>
        <div className="bg-yellow-50 p-3 rounded-lg text-center">
          <div className="text-2xl font-bold text-yellow-600">{realTimeStats.updated}</div>
          <div className="text-sm text-yellow-800">업데이트됨</div>
        </div>
        <div className="bg-red-50 p-3 rounded-lg text-center">
          <div className="text-2xl font-bold text-red-600">{realTimeStats.errors}</div>
          <div className="text-sm text-red-800">오류</div>
        </div>
      </div>

      {/* 실시간 로그 */}
      <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-64 overflow-y-auto">
        <div className="text-gray-400 text-xs mb-2">실시간 로그:</div>
        {syncLogs.length === 0 ? (
          <div className="text-gray-500">로그를 기다리는 중...</div>
        ) : (
          syncLogs.map((log, index) => (
            <div key={index} className="mb-1">
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
