'use client'

import { useState } from 'react'
import { FileSpreadsheet, ExternalLink, X } from 'lucide-react'

interface GoogleSheetsConfigProps {
  spreadsheetId: string
  sheetInfo: Array<{
    name: string
    rowCount: number
    sampleData: Record<string, unknown>[]
    columns: string[]
    error?: string
  }>
  loading: boolean
  onGetSheetInfo: () => void
  onCancelRequest: () => void
  onOpenGoogleSheets: () => void
}

export default function GoogleSheetsConfig({
  spreadsheetId,
  sheetInfo,
  loading,
  onGetSheetInfo,
  onCancelRequest,
  onOpenGoogleSheets
}: GoogleSheetsConfigProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
        <FileSpreadsheet className="h-5 w-5 mr-2" />
        구글 시트 설정
      </h2>
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>📋 필터링:</strong> 첫 글자가 &apos;S&apos;로 시작하는 시트만 표시됩니다.
        </p>
      </div>
      
      {sheetInfo.length === 0 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>💡 안내:</strong> 시트 정보를 가져오려면 아래 버튼을 클릭하세요.
          </p>
        </div>
      )}
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          스프레드시트 ID
        </label>
        <div className="relative">
          <input
            type="text"
            value={spreadsheetId}
            readOnly
            className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
          />
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-green-600">
            ✓
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          고정된 구글 시트 ID입니다. 변경할 수 없습니다.
        </p>
      </div>

      <div className="flex space-x-3">
        <button
          onClick={onGetSheetInfo}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-lg font-medium"
        >
          <FileSpreadsheet className="h-5 w-5 mr-2" />
          {loading ? '로딩 중...' : '시트 정보 가져오기'}
        </button>
        {loading && (
          <button
            onClick={onCancelRequest}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center text-lg font-medium"
          >
            <X className="h-5 w-5 mr-2" />
            취소
          </button>
        )}
        <button
          onClick={onOpenGoogleSheets}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center text-lg font-medium"
        >
          <ExternalLink className="h-5 w-5 mr-2" />
          구글 시트 열기
        </button>
      </div>
    </div>
  )
}
