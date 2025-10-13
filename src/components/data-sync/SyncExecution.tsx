'use client'

import { Upload, Clock } from 'lucide-react'
import { ColumnMapping } from '@/types/data-sync'

interface SyncExecutionProps {
  selectedSheet: string
  selectedTable: string
  columnMapping: ColumnMapping
  truncateTable: boolean
  lastSyncTime: string | null
  loading: boolean
  onSync: () => void
}

export default function SyncExecution({
  selectedSheet,
  selectedTable,
  columnMapping,
  truncateTable,
  lastSyncTime,
  loading,
  onSync
}: SyncExecutionProps) {
  if (!selectedSheet || !selectedTable || Object.keys(columnMapping).length === 0) {
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">동기화 실행</h3>
      
      {/* 동기화 설정 요약 */}
      <div className="mb-4 p-4 bg-blue-50 rounded-lg">
        <h4 className="text-sm font-medium text-blue-800 mb-2">동기화 설정 요약</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-blue-700 font-medium">대상 테이블:</span>
            <span className="ml-2 text-blue-600">{selectedTable}</span>
          </div>
          <div>
            <span className="text-blue-700 font-medium">시트:</span>
            <span className="ml-2 text-blue-600">{selectedSheet}</span>
          </div>
          <div>
            <span className="text-blue-700 font-medium">매핑된 컬럼:</span>
            <span className="ml-2 text-blue-600">{Object.keys(columnMapping).length}개</span>
          </div>
          <div>
            <span className="text-blue-700 font-medium">데이터 삭제:</span>
            <span className={`ml-2 ${truncateTable ? 'text-red-600 font-medium' : 'text-green-600'}`}>
              {truncateTable ? '예 (전체 삭제 후 동기화)' : '아니오 (기존 데이터 유지)'}
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex space-x-3 mb-4">
        <button
          onClick={onSync}
          disabled={loading}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          <Upload className="h-4 w-4 mr-2" />
          {truncateTable ? '데이터 삭제 후 동기화 실행' : '동기화 실행'}
        </button>
      </div>

      {lastSyncTime && (
        <div className="flex items-center text-sm text-gray-600">
          <Clock className="h-4 w-4 mr-2" />
          마지막 동기화: {new Date(lastSyncTime).toLocaleString('ko-KR')}
        </div>
      )}
    </div>
  )
}
