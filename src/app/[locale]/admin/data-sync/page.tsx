'use client'

import { useState, useEffect } from 'react'
import { Upload, RefreshCw, FileSpreadsheet, CheckCircle, XCircle, Clock, Settings, ArrowRight } from 'lucide-react'

interface SheetInfo {
  name: string
  rowCount: number
  sampleData: any[]
  columns: string[]
  error?: string
}

interface SyncResult {
  success: boolean
  message: string
  data?: any
  syncTime?: string
}

interface TableInfo {
  name: string
  displayName: string
}

interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  default: string | null
}

interface ColumnMapping {
  [sheetColumn: string]: string
}

export default function DataSyncPage() {
  const [spreadsheetId, setSpreadsheetId] = useState('')
  const [selectedSheet, setSelectedSheet] = useState('')
  const [selectedTable, setSelectedTable] = useState('')
  const [sheetInfo, setSheetInfo] = useState<SheetInfo[]>([])
  const [availableTables, setAvailableTables] = useState<TableInfo[]>([])
  const [tableColumns, setTableColumns] = useState<ColumnInfo[]>([])
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({})
  const [mappingSuggestions, setMappingSuggestions] = useState<{ [key: string]: ColumnMapping }>({})
  const [loading, setLoading] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null)
  const [showMappingModal, setShowMappingModal] = useState(false)

  // 사용 가능한 테이블 가져오기 (모든 Supabase 테이블)
  const getAvailableTables = async () => {
    try {
      const response = await fetch('/api/sync/all-tables')
      const result = await response.json()
      
      if (result.success) {
        setAvailableTables(result.data.tables)
        console.log('Available tables:', result.data.tables)
      }
    } catch (error) {
      console.error('Error getting available tables:', error)
    }
  }

  // 테이블 스키마 가져오기
  const getTableSchema = async (tableName: string) => {
    try {
      console.log('Fetching table schema for:', tableName)
      const response = await fetch(`/api/sync/schema?table=${tableName}`)
      const result = await response.json()
      
      console.log('Table schema response:', result)
      
      if (result.success) {
        console.log('Setting table columns:', result.data.columns)
        setTableColumns(result.data.columns)
      } else {
        console.error('Error getting table schema:', result.message)
        // 폴백: 하드코딩된 컬럼 목록 사용
        const fallbackColumns = getFallbackColumns(tableName)
        console.log('Using fallback columns:', fallbackColumns)
        setTableColumns(fallbackColumns)
      }
    } catch (error) {
      console.error('Error getting table schema:', error)
      // 폴백: 하드코딩된 컬럼 목록 사용
      const fallbackColumns = getFallbackColumns(tableName)
      console.log('Using fallback columns due to error:', fallbackColumns)
      setTableColumns(fallbackColumns)
    }
  }

  // 폴백 컬럼 목록
  const getFallbackColumns = (tableName: string): ColumnInfo[] => {
    const fallbackColumns: { [key: string]: ColumnInfo[] } = {
      reservations: [
        { name: 'id', type: 'uuid', nullable: false, default: null },
        { name: 'customer_id', type: 'text', nullable: true, default: null },
        { name: 'product_id', type: 'text', nullable: true, default: null },
        { name: 'tour_id', type: 'text', nullable: true, default: null },
        { name: 'customer_name', type: 'text', nullable: true, default: null },
        { name: 'customer_email', type: 'text', nullable: true, default: null },
        { name: 'customer_phone', type: 'text', nullable: true, default: null },
        { name: 'adults', type: 'integer', nullable: true, default: null },
        { name: 'child', type: 'integer', nullable: true, default: null },
        { name: 'infant', type: 'integer', nullable: true, default: null },
        { name: 'total_people', type: 'integer', nullable: true, default: null },
        { name: 'tour_date', type: 'date', nullable: true, default: null },
        { name: 'tour_time', type: 'text', nullable: true, default: null },
        { name: 'pickup_hotel', type: 'text', nullable: true, default: null },
        { name: 'pickup_time', type: 'text', nullable: true, default: null },
        { name: 'channel', type: 'text', nullable: true, default: null },
        { name: 'channel_rn', type: 'text', nullable: true, default: null },
        { name: 'added_by', type: 'text', nullable: true, default: null },
        { name: 'status', type: 'text', nullable: true, default: 'pending' },
        { name: 'event_note', type: 'text', nullable: true, default: null },
        { name: 'is_private_tour', type: 'boolean', nullable: true, default: false },
        { name: 'created_at', type: 'timestamp', nullable: false, default: 'now()' },
        { name: 'updated_at', type: 'timestamp', nullable: false, default: 'now()' }
      ],
      tours: [
        { name: 'id', type: 'text', nullable: false, default: null },
        { name: 'product_id', type: 'text', nullable: true, default: null },
        { name: 'tour_date', type: 'date', nullable: true, default: null },
        { name: 'tour_status', type: 'text', nullable: true, default: 'Recruiting' },
        { name: 'tour_guide_id', type: 'uuid', nullable: true, default: null },
        { name: 'assistant_id', type: 'uuid', nullable: true, default: null },
        { name: 'tour_car_id', type: 'uuid', nullable: true, default: null },
        { name: 'is_private_tour', type: 'boolean', nullable: true, default: false },
        { name: 'created_at', type: 'timestamp', nullable: false, default: 'now()' },
        { name: 'updated_at', type: 'timestamp', nullable: false, default: 'now()' }
      ],
      customers: [
        { name: 'id', type: 'text', nullable: false, default: null },
        { name: 'name', type: 'text', nullable: true, default: null },
        { name: 'email', type: 'text', nullable: true, default: null },
        { name: 'phone', type: 'text', nullable: true, default: null },
        { name: 'language', type: 'text', nullable: true, default: 'ko' },
        { name: 'created_at', type: 'timestamp', nullable: false, default: 'now()' },
        { name: 'updated_at', type: 'timestamp', nullable: false, default: 'now()' }
      ],
      products: [
        { name: 'id', type: 'text', nullable: false, default: null },
        { name: 'name', type: 'text', nullable: true, default: null },
        { name: 'description', type: 'text', nullable: true, default: null },
        { name: 'price', type: 'numeric', nullable: true, default: null },
        { name: 'created_at', type: 'timestamp', nullable: false, default: 'now()' },
        { name: 'updated_at', type: 'timestamp', nullable: false, default: 'now()' }
      ]
    }
    
    return fallbackColumns[tableName] || []
  }

  // 구글 시트 정보 가져오기
  const getSheetInfo = async () => {
    if (!spreadsheetId.trim()) {
      alert('스프레드시트 ID를 입력해주세요.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/sync/sheets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ spreadsheetId }),
      })

      const result = await response.json()
      
      if (result.success) {
        setSheetInfo(result.data.sheets)
        
        // 스프레드시트 ID를 localStorage에 저장
        localStorage.setItem('tour-management-spreadsheet-id', spreadsheetId)
        
        // 첫 번째 시트를 기본 선택
        if (result.data.sheets.length > 0) {
          setSelectedSheet(result.data.sheets[0].name)
        }
      } else {
        alert(`시트 정보를 가져오는데 실패했습니다: ${result.message}`)
      }
    } catch (error) {
      console.error('Error getting sheet info:', error)
      alert('시트 정보를 가져오는데 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 컬럼 매핑 제안 가져오기
  const getMappingSuggestions = async (sheetColumns: string[], tableName: string) => {
    try {
      const response = await fetch(`/api/sync/tables?sheetColumns=${JSON.stringify(sheetColumns)}&tableName=${tableName}`)
      const result = await response.json()
      
      if (result.success) {
        setMappingSuggestions(result.data.suggestions)
      }
    } catch (error) {
      console.error('Error getting mapping suggestions:', error)
    }
  }

  // 시트 선택 시 컬럼 매핑 제안 가져오기
  const handleSheetSelect = (sheetName: string) => {
    console.log('Sheet selected:', sheetName)
    setSelectedSheet(sheetName)
    const sheet = sheetInfo.find(s => s.name === sheetName)
    console.log('Selected sheet info:', sheet)
    
    if (sheet && sheet.columns.length > 0 && selectedTable) {
      console.log('Getting mapping suggestions for columns:', sheet.columns, 'and table:', selectedTable)
      getMappingSuggestions(sheet.columns, selectedTable)
    } else {
      console.log('No columns found for sheet:', sheetName)
      // 컬럼이 없는 시트인 경우 경고 표시
      if (sheet && sheet.rowCount === 0) {
        alert(`${sheetName} 시트는 비어있습니다. 데이터가 있는 다른 시트를 선택해주세요.`)
      }
    }
  }

  // 테이블 선택 시 기본 매핑 설정
  const handleTableSelect = (tableName: string) => {
    console.log('Table selected:', tableName)
    setSelectedTable(tableName)
    setTableColumns([]) // 이전 컬럼 정보 초기화
    
    if (tableName) {
      // 테이블 스키마 가져오기
      console.log('Fetching schema for table:', tableName)
      getTableSchema(tableName)
      
      // 선택된 시트가 있으면 매핑 제안 가져오기
      const sheet = sheetInfo.find(s => s.name === selectedSheet)
      if (sheet && sheet.columns.length > 0) {
        console.log('Getting mapping suggestions for table:', tableName, 'and sheet:', selectedSheet)
        getMappingSuggestions(sheet.columns, tableName)
      }
    }
  }

  // 유연한 데이터 동기화
  const handleFlexibleSync = async () => {
    if (!spreadsheetId.trim() || !selectedSheet || !selectedTable) {
      alert('스프레드시트 ID, 시트, 테이블을 모두 선택해주세요.')
      return
    }

    if (Object.keys(columnMapping).length === 0) {
      alert('컬럼 매핑을 설정해주세요.')
      return
    }

    setLoading(true)
    setSyncResult(null)

    try {
      const response = await fetch('/api/sync/flexible', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spreadsheetId,
          sheetName: selectedSheet,
          targetTable: selectedTable,
          columnMapping,
        }),
      })

      const result = await response.json()
      setSyncResult(result)
      
      if (result.success) {
        setLastSyncTime(new Date().toISOString())
      }
    } catch (error) {
      console.error('Error syncing data:', error)
      setSyncResult({
        success: false,
        message: '데이터 동기화 중 오류가 발생했습니다.'
      })
    } finally {
      setLoading(false)
    }
  }

  // 컴포넌트 마운트 시 사용 가능한 테이블 가져오기 및 저장된 스프레드시트 ID 로드
  useEffect(() => {
    getAvailableTables()
    
    // 저장된 스프레드시트 ID 로드
    const savedSpreadsheetId = localStorage.getItem('tour-management-spreadsheet-id')
    if (savedSpreadsheetId) {
      setSpreadsheetId(savedSpreadsheetId)
    }
  }, [])

  // 주기적 동기화
  const handlePeriodicSync = async () => {
    if (!spreadsheetId.trim()) {
      alert('스프레드시트 ID를 입력해주세요.')
      return
    }

    setLoading(true)
    setSyncResult(null)

    try {
      const response = await fetch('/api/sync/periodic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spreadsheetId,
          reservationsSheet,
          toursSheet,
          lastSyncTime,
        }),
      })

      const result = await response.json()
      setSyncResult(result)
      
      if (result.success) {
        setLastSyncTime(result.syncTime)
      }
    } catch (error) {
      console.error('Error syncing data:', error)
      setSyncResult({
        success: false,
        message: '데이터 동기화 중 오류가 발생했습니다.'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">유연한 데이터 동기화</h1>
        <p className="text-gray-600">
          구글 시트의 모든 데이터를 원하는 테이블로 유연하게 동기화합니다.
        </p>
      </div>

      {/* 설정 섹션 */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <FileSpreadsheet className="h-5 w-5 mr-2" />
          구글 시트 설정
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              스프레드시트 ID
            </label>
            <div className="relative">
              <input
                type="text"
                value={spreadsheetId}
                onChange={(e) => setSpreadsheetId(e.target.value)}
                placeholder="구글 시트의 ID를 입력하세요"
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {spreadsheetId && (
                <button
                  onClick={() => {
                    setSpreadsheetId('')
                    localStorage.removeItem('tour-management-spreadsheet-id')
                    setSheetInfo([])
                    setSelectedSheet('')
                    setSelectedTable('')
                    setTableColumns([])
                    setColumnMapping({})
                  }}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  title="ID 지우기"
                >
                  ✕
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              URL에서 /d/ 다음의 긴 문자열입니다. 입력한 ID는 자동으로 저장됩니다.
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              시트 선택
            </label>
            <select
              value={selectedSheet}
              onChange={(e) => handleSheetSelect(e.target.value)}
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
        </div>

        <div className="flex space-x-3">
          <button
            onClick={getSheetInfo}
            disabled={loading || !spreadsheetId.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            시트 정보 확인
          </button>
        </div>
      </div>

      {/* 테이블 선택 및 컬럼 매핑 */}
      {selectedSheet && (
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            동기화 설정
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 테이블 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                대상 테이블
              </label>
              <select
                value={selectedTable}
                onChange={(e) => handleTableSelect(e.target.value)}
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

            {/* 컬럼 매핑 버튼 */}
            <div className="flex items-end">
              <button
                onClick={() => {
                  console.log('Opening mapping modal. Selected table:', selectedTable, 'Selected sheet:', selectedSheet)
                  console.log('Current table columns:', tableColumns)
                  console.log('Current sheet info:', sheetInfo)
                  setShowMappingModal(true)
                }}
                disabled={!selectedTable || !selectedSheet}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
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
                    <span className="text-gray-600">{sheetCol}</span>
                    <ArrowRight className="h-3 w-3 mx-2 text-gray-400" />
                    <span className="text-gray-900 font-medium">{dbCol}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 동기화 실행 */}
      {selectedSheet && selectedTable && Object.keys(columnMapping).length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">동기화 실행</h3>
          
          <div className="flex space-x-3 mb-4">
            <button
              onClick={handleFlexibleSync}
              disabled={loading}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              <Upload className="h-4 w-4 mr-2" />
              동기화 실행
            </button>
          </div>

          {lastSyncTime && (
            <div className="flex items-center text-sm text-gray-600">
              <Clock className="h-4 w-4 mr-2" />
              마지막 동기화: {new Date(lastSyncTime).toLocaleString('ko-KR')}
            </div>
          )}
        </div>
      )}

      {/* 시트 정보 표시 */}
      {sheetInfo.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">시트 정보</h3>
          <div className="space-y-4">
            {sheetInfo.map((sheet, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{sheet.name}</h4>
                  <span className="text-sm text-gray-500">{sheet.rowCount}행</span>
                </div>
                
                {sheet.error ? (
                  <p className="text-red-500 text-sm">{sheet.error}</p>
                ) : (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">컬럼: {sheet.columns.join(', ')}</p>
                    {sheet.sampleData.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-xs">
                          <thead>
                            <tr className="bg-gray-50">
                              {sheet.columns.map((col, i) => (
                                <th key={i} className="px-2 py-1 text-left font-medium text-gray-700">
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sheet.sampleData.map((row, i) => (
                              <tr key={i} className="border-t">
                                {sheet.columns.map((col, j) => (
                                  <td key={j} className="px-2 py-1 text-gray-600">
                                    {row[col] || '-'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 컬럼 매핑 모달 */}
      {showMappingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              컬럼 매핑 설정
              {selectedTable && (
                <span className="text-sm text-gray-500 ml-2">
                  ({selectedTable} 테이블)
                </span>
              )}
            </h3>
            
            {tableColumns.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-5 w-5 animate-spin text-blue-600 mr-2" />
                <span className="text-gray-600">테이블 스키마를 불러오는 중...</span>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 헤더 정보 */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-blue-800">선택된 테이블:</span>
                      <span className="ml-2 text-blue-600">{selectedTable}</span>
                    </div>
                    <div>
                      <span className="font-medium text-blue-800">데이터베이스 컬럼 수:</span>
                      <span className="ml-2 text-blue-600">{tableColumns.length}개</span>
                    </div>
                    <div>
                      <span className="font-medium text-blue-800">시트 컬럼 수:</span>
                      <span className="ml-2 text-blue-600">{sheetInfo.find(s => s.name === selectedSheet)?.columns.length || 0}개</span>
                    </div>
                    <div>
                      <span className="font-medium text-blue-800">매핑된 컬럼:</span>
                      <span className="ml-2 text-blue-600">{Object.keys(columnMapping).length}개</span>
                    </div>
                  </div>
                </div>

                {/* 컬럼 매핑 테이블 */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <div className="grid grid-cols-12 gap-4 text-sm font-medium text-gray-700">
                      <div className="col-span-4">구글 시트 컬럼</div>
                      <div className="col-span-1 text-center">→</div>
                      <div className="col-span-7">데이터베이스 컬럼</div>
                    </div>
                  </div>
                  
                  <div className="divide-y divide-gray-200">
                    {sheetInfo.find(s => s.name === selectedSheet)?.columns.map((sheetColumn, index) => (
                      <div key={`${sheetColumn}-${index}`} className="px-4 py-3 hover:bg-gray-50">
                        <div className="grid grid-cols-12 gap-4 items-center">
                          <div className="col-span-4">
                            <div className="flex items-center">
                              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                              <span className="text-sm font-medium text-gray-900">{sheetColumn}</span>
                            </div>
                          </div>
                          <div className="col-span-1 text-center">
                            <ArrowRight className="h-4 w-4 text-gray-400 mx-auto" />
                          </div>
                          <div className="col-span-7">
                            <select
                              value={columnMapping[sheetColumn] || ''}
                              onChange={(e) => {
                                const newMapping = { ...columnMapping }
                                if (e.target.value) {
                                  newMapping[sheetColumn] = e.target.value
                                } else {
                                  delete newMapping[sheetColumn]
                                }
                                setColumnMapping(newMapping)
                              }}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="">매핑하지 않음</option>
                              {tableColumns.map((column) => (
                                <option key={`${column.name}-${index}`} value={column.name}>
                                  {column.name} ({column.type})
                                  {!column.nullable && ' *'}
                                  {column.default && ` - 기본값: ${column.default}`}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 매핑 요약 */}
                {Object.keys(columnMapping).length > 0 && (
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-green-800 mb-2">매핑 요약</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      {Object.entries(columnMapping).map(([sheetCol, dbCol]) => (
                        <div key={`${sheetCol}-${dbCol}`} className="flex items-center">
                          <span className="text-green-700 font-medium">{sheetCol}</span>
                          <ArrowRight className="h-3 w-3 text-green-500 mx-2" />
                          <span className="text-green-600">{dbCol}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowMappingModal(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={() => setShowMappingModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 결과 표시 */}
      {syncResult && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">동기화 결과</h3>
          
          <div className={`p-4 rounded-lg flex items-start ${
            syncResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            {syncResult.success ? (
              <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500 mr-3 mt-0.5" />
            )}
            <div>
              <p className={`font-medium ${
                syncResult.success ? 'text-green-800' : 'text-red-800'
              }`}>
                {syncResult.message}
              </p>
              {syncResult.data && (
                <div className="mt-2 text-sm text-gray-600">
                  {syncResult.data.inserted && (
                    <p>삽입: {syncResult.data.inserted}개</p>
                  )}
                  {syncResult.data.updated && (
                    <p>업데이트: {syncResult.data.updated}개</p>
                  )}
                  {syncResult.data.errors && syncResult.data.errors > 0 && (
                    <p className="text-red-600">오류: {syncResult.data.errors}개</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 로딩 상태 */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
            <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
            <span className="text-gray-700">동기화 중...</span>
          </div>
        </div>
      )}
    </div>
  )
}
