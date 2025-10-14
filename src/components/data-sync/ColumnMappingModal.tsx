'use client'

import React, { useState } from 'react'
import { RefreshCw, ArrowRight } from 'lucide-react'
import { ColumnInfo, ColumnMapping, SheetInfo } from '@/types/data-sync'
import { getAutoCompleteSuggestions, getAutoMapping } from '@/utils/columnMapping'

interface ColumnMappingModalProps {
  show: boolean
  selectedTable: string
  selectedSheet: string
  tableColumns: ColumnInfo[]
  sheetInfo: SheetInfo[]
  columnMapping: ColumnMapping
  onClose: () => void
  onSave: (mapping: ColumnMapping) => void
  onAutoMapping: () => void
}

export default function ColumnMappingModal({
  show,
  selectedTable,
  selectedSheet,
  tableColumns,
  sheetInfo,
  columnMapping,
  onClose,
  onSave,
  onAutoMapping
}: ColumnMappingModalProps) {
  const [localMapping, setLocalMapping] = useState<ColumnMapping>(columnMapping)

  if (!show) {
    return null
  }

  const handleSave = () => {
    onSave(localMapping)
    onClose()
  }

  const handleAutoMapping = () => {
    const sheet = sheetInfo.find(s => s.name === selectedSheet)
    if (sheet && sheet.columns.length > 0 && tableColumns.length > 0) {
      const autoMapping = getAutoMapping(tableColumns, sheet.columns)
      setLocalMapping(autoMapping)
      onAutoMapping()
    }
  }

  return (
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
            <span className="text-gray-600">실제 데이터베이스에서 테이블 스키마를 불러오는 중...</span>
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
                  {tableColumns.length > 0 && (
                    <span className="ml-2 text-xs text-green-600">
                      (실시간 조회)
                    </span>
                  )}
                </div>
                <div>
                  <span className="font-medium text-blue-800">시트 컬럼 수:</span>
                  <span className="ml-2 text-blue-600">{sheetInfo.find(s => s.name === selectedSheet)?.columns.length || 0}개</span>
                </div>
                <div>
                  <span className="font-medium text-blue-800">매핑된 컬럼:</span>
                  <span className="ml-2 text-blue-600">{Object.keys(localMapping).length}개</span>
                </div>
              </div>
            </div>

            {/* 컬럼 매핑 테이블 */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <div className="grid grid-cols-12 gap-4 text-sm font-medium text-gray-700">
                  <div className="col-span-4">데이터베이스 컬럼</div>
                  <div className="col-span-1 text-center">→</div>
                  <div className="col-span-7">구글 시트 컬럼</div>
                </div>
              </div>
              
              <div className="divide-y divide-gray-200">
                {tableColumns.map((dbColumn, index) => (
                  <div key={`${dbColumn.name}-${index}`} className="px-4 py-3 hover:bg-gray-50">
                    <div className="grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-4">
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900">{dbColumn.name}</span>
                            <span className="text-xs text-gray-500">
                              {dbColumn.type}
                              {!dbColumn.nullable && ' *'}
                              {dbColumn.default && ` (기본값: ${dbColumn.default})`}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="col-span-1 text-center">
                        <ArrowRight className="h-4 w-4 text-gray-400 mx-auto" />
                      </div>
                      <div className="col-span-7">
                        <div className="relative">
                          <select
                            value={(() => {
                              // 현재 데이터베이스 컬럼에 매핑된 구글시트 컬럼 찾기
                              const mappedSheetColumn = Object.entries(localMapping).find(([, dbCol]) => dbCol === dbColumn.name)?.[0] || ''
                              return mappedSheetColumn
                            })()}
                            onChange={(e) => {
                              const newMapping = { ...localMapping }
                              
                              // 기존 매핑에서 이 데이터베이스 컬럼을 사용하는 구글시트 컬럼 제거
                              Object.keys(newMapping).forEach(sheetCol => {
                                if (newMapping[sheetCol] === dbColumn.name) {
                                  delete newMapping[sheetCol]
                                }
                              })
                              
                              // 새로운 매핑 추가
                              if (e.target.value) {
                                newMapping[e.target.value] = dbColumn.name
                              }
                              
                              setLocalMapping(newMapping)
                            }}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">매핑하지 않음</option>
                            {sheetInfo.find(s => s.name === selectedSheet)?.columns.map((sheetColumn) => (
                              <option key={`${sheetColumn}-${index}`} value={sheetColumn}>
                                {sheetColumn}
                              </option>
                            ))}
                          </select>
                          
                          {/* 자동 완성 제안 */}
                          {(() => {
                            const suggestions = getAutoCompleteSuggestions(dbColumn.name, sheetInfo.find(s => s.name === selectedSheet)?.columns || [])
                            const currentValue = Object.entries(localMapping).find(([, dbCol]) => dbCol === dbColumn.name)?.[0] || ''
                            const hasSuggestion = suggestions.length > 0 && !currentValue
                            
                            return hasSuggestion && (
                              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-10">
                                <div className="p-2 text-xs text-gray-500 border-b">
                                  추천: {suggestions.slice(0, 3).join(', ')}
                                </div>
                                {suggestions.slice(0, 3).map((suggestion, idx) => (
                                  <button
                                    key={`suggestion-${idx}`}
                                    onClick={() => {
                                      const newMapping = { ...localMapping }
                                      
                                      // 기존 매핑에서 이 데이터베이스 컬럼을 사용하는 구글시트 컬럼 제거
                                      Object.keys(newMapping).forEach(sheetCol => {
                                        if (newMapping[sheetCol] === dbColumn.name) {
                                          delete newMapping[sheetCol]
                                        }
                                      })
                                      
                                      // 새로운 매핑 추가
                                      newMapping[suggestion] = dbColumn.name
                                      setLocalMapping(newMapping)
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center"
                                  >
                                    <span className="text-blue-600 font-medium">{suggestion}</span>
                                  </button>
                                ))}
                              </div>
                            )
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 매핑 요약 */}
            {Object.keys(localMapping).length > 0 && (
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-green-800 mb-2">매핑 요약</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  {Object.entries(localMapping).map(([sheetCol, dbCol]) => (
                    <div key={`${sheetCol}-${dbCol}`} className="flex items-center">
                      <span className="text-green-700 font-medium">{dbCol}</span>
                      <ArrowRight className="h-3 w-3 text-green-500 mx-2" />
                      <span className="text-green-600">{sheetCol}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between mt-6">
          <button
            onClick={handleAutoMapping}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            자동 매핑
          </button>
          
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
