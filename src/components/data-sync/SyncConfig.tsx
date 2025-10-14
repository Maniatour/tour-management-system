'use client'

import { Settings, ArrowRight } from 'lucide-react'
import { TableInfo, ColumnInfo, ColumnMapping, SheetInfo } from '@/types/data-sync'

interface SyncConfigProps {
  selectedSheet: string
  selectedTable: string
  sheetInfo: SheetInfo[]
  availableTables: TableInfo[]
  tableColumns: ColumnInfo[]
  columnMapping: ColumnMapping
  truncateTable: boolean
  lastSyncTime: string | null
  onTableSelect: (tableName: string) => void
  onSheetSelect: (sheetName: string) => void
  onTruncateTableChange: (checked: boolean) => void
  onShowMappingModal: () => void
}

export default function SyncConfig({
  selectedSheet,
  selectedTable,
  sheetInfo,
  availableTables,
  columnMapping,
  truncateTable,
  lastSyncTime,
  onTableSelect,
  onSheetSelect,
  onTruncateTableChange,
  onShowMappingModal
}: SyncConfigProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <Settings className="h-5 w-5 mr-2" />
        동기화 설정
      </h3>
      
      {/* 동기화 옵션 (초기화 후 전체 동기화) */}
      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={truncateTable}
              onChange={(e) => onTruncateTableChange(e.target.checked)}
              className="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500"
              disabled={!selectedTable}
            />
            <span className="text-sm font-medium text-gray-700">
              동기화 전에 {selectedTable || '선택된 테이블'} 전체 삭제
            </span>
          </label>
          <div className="text-xs text-gray-500">
            {selectedTable ? (
              <>
                <strong>⚠️ 주의:</strong> {selectedTable} 테이블의 모든 데이터가 삭제됩니다. 
                복구 불가이므로 사전 백업을 권장합니다.
              </>
            ) : (
              '테이블을 선택하면 해당 테이블의 데이터를 삭제할 수 있습니다.'
            )}
          </div>
        </div>
        {lastSyncTime && (
          <p className="text-xs text-blue-600 mt-2">
            마지막 동기화: {new Date(lastSyncTime).toLocaleString('ko-KR')}
          </p>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 테이블 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            대상 테이블
          </label>
          <select
            value={selectedTable}
            onChange={(e) => onTableSelect(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">테이블을 선택하세요</option>
            {availableTables.map((table) => (
              <option key={table.name} value={table.name}>
                {table.displayName} ({table.name})
              </option>
            ))}
          </select>
        </div>

        {/* 시트 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            시트 선택
          </label>
          <select
            value={selectedSheet}
            onChange={(e) => onSheetSelect(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={sheetInfo.length === 0}
          >
            <option value="">시트를 선택하세요</option>
            {sheetInfo.map((sheet) => (
              <option 
                key={sheet.name} 
                value={sheet.name}
                disabled={sheet.rowCount === 0}
                style={{ 
                  color: sheet.rowCount === 0 ? '#999' : 'inherit',
                  fontStyle: sheet.rowCount === 0 ? 'italic' : 'normal'
                }}
              >
                {sheet.name} ({sheet.rowCount}행) {sheet.rowCount === 0 ? '- 비어있음' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* 컬럼 매핑 버튼 */}
        <div className="flex items-end">
          <button
            onClick={onShowMappingModal}
            disabled={!selectedTable || !selectedSheet}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <Settings className="h-4 w-4 mr-2" />
            컬럼 매핑 설정
          </button>
        </div>
      </div>

      {/* 현재 매핑 상태 표시 */}
      {Object.keys(columnMapping).length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-2">현재 매핑:</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(columnMapping).map(([sheetCol, dbCol]) => (
              <div key={sheetCol} className="flex items-center">
                <span className="text-gray-600">{dbCol}</span>
                <ArrowRight className="h-3 w-3 mx-2 text-gray-400" />
                <span className="text-gray-900 font-medium">{sheetCol}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
