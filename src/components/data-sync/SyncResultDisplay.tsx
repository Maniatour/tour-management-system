'use client'

import React, { useState } from 'react'
import { CheckCircle, XCircle } from 'lucide-react'
import { SyncResult } from '@/types/data-sync'

interface SyncResultDisplayProps {
  syncResult: SyncResult | null
  syncLogs: string[]
  onClose: () => void
}

export default function SyncResultDisplay({
  syncResult,
  syncLogs,
  onClose
}: SyncResultDisplayProps) {
  const [logFilter, setLogFilter] = useState<string>('all') // 'all', 'info', 'warn', 'error'
  const [showFullLogs, setShowFullLogs] = useState(false)

  if (!syncResult) {
    return null
  }

  const handleCopyLogs = () => {
    const logText = syncLogs.join('\n')
    navigator.clipboard.writeText(logText)
    alert('로그가 클립보드에 복사되었습니다.')
  }

  const handleDownloadLogs = () => {
    const logText = syncLogs.join('\n')
    const blob = new Blob([logText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sync-log-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          {syncResult.success ? (
            <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
          ) : (
            <XCircle className="h-5 w-5 text-red-500 mr-2" />
          )}
          동기화 결과
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          ✕ 닫기
        </button>
      </div>
      
      {/* 상태 메시지 */}
      <div className={`p-4 rounded-lg mb-4 ${
        syncResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
      }`}>
        <p className={`font-medium ${
          syncResult.success ? 'text-green-800' : 'text-red-800'
        }`}>
          {syncResult.message}
        </p>
        {syncResult.syncTime && (
          <p className="text-sm text-gray-600 mt-1">
            완료 시간: {new Date(syncResult.syncTime).toLocaleString('ko-KR')}
          </p>
        )}
      </div>

      {/* 상세 통계 */}
      {syncResult.data && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-600">
              {(syncResult.data.inserted || 0) + (syncResult.data.updated || 0)}
            </div>
            <div className="text-sm text-blue-800">총 처리</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-600">{syncResult.data.inserted || 0}</div>
            <div className="text-sm text-green-800">삽입됨</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-yellow-600">{syncResult.data.updated || 0}</div>
            <div className="text-sm text-yellow-800">업데이트됨</div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-red-600">{syncResult.data.errors || 0}</div>
            <div className="text-sm text-red-800">오류</div>
          </div>
        </div>
      )}

      {/* 오류 상세 정보 */}
      {syncResult.data && syncResult.data.errorDetails && Array.isArray(syncResult.data.errorDetails) && syncResult.data.errorDetails.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-medium text-red-800 mb-2 flex items-center">
            <XCircle className="h-4 w-4 mr-1" />
            오류 상세 ({syncResult.data.errorDetails.length}개)
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {syncResult.data.errorDetails.map((error: string, index: number) => (
              <div key={index} className="text-sm text-red-700 font-mono bg-red-100 p-2 rounded border-l-4 border-red-400">
                <div className="font-semibold">오류 #{index + 1}:</div>
                <div className="mt-1">{error}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-red-600">
            💡 <strong>해결 방법:</strong> 구글 시트의 데이터 형식을 확인하고, 필수 필드가 비어있지 않은지 확인하세요.
          </div>
        </div>
      )}

      {/* 전체 실행 로그 */}
      {syncLogs.length > 0 && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h4 className="font-medium text-gray-800">실행 로그 전체 ({syncLogs.length}개 항목):</h4>
              <div className="text-xs text-gray-600 mt-1">
                정보: {syncLogs.filter(log => log.includes('[INFO]')).length}개 | 
                경고: {syncLogs.filter(log => log.includes('[WARN]')).length}개 | 
                오류: {syncLogs.filter(log => log.includes('[ERROR]')).length}개 | 
                결과: {syncLogs.filter(log => log.includes('[RESULT]')).length}개
              </div>
            </div>
            <div className="flex gap-2 items-center">
              {/* 로그 필터 */}
              <select
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
                className="px-2 py-1 text-xs border rounded"
              >
                <option value="all">전체</option>
                <option value="info">정보만</option>
                <option value="warn">경고만</option>
                <option value="error">오류만</option>
              </select>
              
              {/* 전체 로그 토글 */}
              <button
                onClick={() => setShowFullLogs(!showFullLogs)}
                className={`px-3 py-1 text-xs rounded ${
                  showFullLogs 
                    ? 'bg-yellow-500 text-white hover:bg-yellow-600' 
                    : 'bg-gray-500 text-white hover:bg-gray-600'
                }`}
              >
                {showFullLogs ? '간소화' : '전체보기'}
              </button>
              
              <button
                onClick={handleCopyLogs}
                className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
              >
                로그 복사
              </button>
              <button
                onClick={handleDownloadLogs}
                className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
              >
                로그 다운로드
              </button>
            </div>
          </div>
          <div 
            ref={(el) => {
              if (el && !showFullLogs) {
                el.scrollTop = el.scrollHeight
              }
            }}
            className={`bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-y-auto border ${
              showFullLogs ? 'max-h-screen' : 'max-h-96'
            }`}
          >
            {syncLogs
              .filter(log => {
                if (logFilter === 'all') return true
                if (logFilter === 'info') return log.includes('[INFO]')
                if (logFilter === 'warn') return log.includes('[WARN]')
                if (logFilter === 'error') return log.includes('[ERROR]')
                return true
              })
              .map((log, index) => {
                let logColor = 'text-green-400'
                if (log.includes('[ERROR]')) logColor = 'text-red-400'
                else if (log.includes('[WARN]')) logColor = 'text-yellow-400'
                else if (log.includes('[INFO]')) logColor = 'text-blue-400'
                else if (log.includes('[RESULT]')) logColor = 'text-purple-400'
                
                return (
                  <div key={index} className={`mb-1 whitespace-pre-wrap ${logColor}`}>
                    {log}
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}
