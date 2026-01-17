'use client'

import React, { useState } from 'react'
import { Database, RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import { CleanupStatus, SyncResult } from '@/types/data-sync'

interface ReservationCleanupProps {
  cleanupStatus: CleanupStatus | null
  onRefresh: () => void
}

export default function ReservationCleanup({ cleanupStatus, onRefresh }: ReservationCleanupProps) {
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<SyncResult | null>(null)

  const handleReservationCleanup = async () => {
    if (!confirm('예약 데이터를 정리하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return
    }

    setCleanupLoading(true)
    setCleanupResult(null)

    try {
      const response = await fetch('/api/sync/reservation-cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        // HTTP 에러 상태 코드인 경우
        const errorText = await response.text()
        let errorMessage = `서버 오류 (${response.status}): ${response.statusText}`
        
        try {
          const errorJson = JSON.parse(errorText)
          errorMessage = errorJson.message || errorMessage
        } catch {
          // JSON 파싱 실패 시 텍스트 그대로 사용
          if (errorText) {
            errorMessage = errorText
          }
        }
        
        setCleanupResult({
          success: false,
          message: errorMessage
        })
        return
      }

      const result = await response.json()
      setCleanupResult(result)
      
      if (result.success) {
        // 정리 후 상태 다시 확인
        onRefresh()
      }
    } catch (error) {
      console.error('Error during cleanup:', error)
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
      setCleanupResult({
        success: false,
        message: `예약 데이터 정리 중 오류가 발생했습니다: ${errorMessage}`
      })
    } finally {
      setCleanupLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
        <Database className="h-5 w-5 mr-2" />
        예약 데이터 정리
      </h2>
      
      <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="text-sm font-medium text-yellow-800 mb-2">정리 규칙:</h3>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• <strong>MDGCSUNRISE_X</strong> → <strong>MDGCSUNRISE</strong>로 변경하고 <strong>Antelope X Canyon</strong> 옵션 추가</li>
          <li>• <strong>MDGC1D_X</strong> → <strong>MDGC1D</strong>로 변경하고 <strong>Antelope X Canyon</strong> 옵션 추가</li>
          <li>• <strong>MDGCSUNRISE</strong> → <strong>Lower Antelope Canyon</strong> 옵션 추가 (옵션이 없는 경우)</li>
          <li>• <strong>MDGC1D</strong> → <strong>Lower Antelope Canyon</strong> 옵션 추가 (옵션이 없는 경우)</li>
        </ul>
      </div>

      {/* 현재 상태 표시 */}
      {cleanupStatus && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-sm font-medium text-blue-800 mb-2">현재 상태:</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="bg-white p-2 rounded text-center">
              <div className="font-bold text-blue-600">{cleanupStatus.summary?.totalReservations || 0}</div>
              <div className="text-blue-800">총 예약</div>
            </div>
            <div className="bg-white p-2 rounded text-center">
              <div className="font-bold text-green-600">{cleanupStatus.summary?.reservationsWithChoices || 0}</div>
              <div className="text-green-800">선택사항 있음</div>
            </div>
            <div className="bg-white p-2 rounded text-center">
              <div className="font-bold text-purple-600">{cleanupStatus.summary?.productsWithChoices || 0}</div>
              <div className="text-purple-800">상품 선택사항</div>
            </div>
            <div className="bg-white p-2 rounded text-center">
              <div className="font-bold text-orange-600">
                {cleanupStatus.reservations?.filter((r) => r.product_id?.includes('_X')).length || 0}
              </div>
              <div className="text-orange-800">_X 상품</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex space-x-3">
        <button
          onClick={handleReservationCleanup}
          disabled={cleanupLoading}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          <Database className="h-4 w-4 mr-2" />
          {cleanupLoading ? '정리 중...' : '예약 데이터 정리 실행'}
        </button>
        <button
          onClick={onRefresh}
          disabled={cleanupLoading}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          상태 새로고침
        </button>
      </div>

      {/* 정리 결과 표시 */}
      {cleanupResult && (
        <div className="mt-4 p-4 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-900 flex items-center">
              {cleanupResult.success ? (
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500 mr-2" />
              )}
              정리 결과
            </h4>
            <button
              onClick={() => setCleanupResult(null)}
              className="text-gray-400 hover:text-gray-600 text-sm"
            >
              ✕ 닫기
            </button>
          </div>
          
          <div className={`p-3 rounded-lg ${
            cleanupResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <p className={`text-sm font-medium ${
              cleanupResult.success ? 'text-green-800' : 'text-red-800'
            }`}>
              {cleanupResult.message}
            </p>
            
            {cleanupResult.data && (
              <div className="mt-3">
                <div className="text-sm text-gray-700 mb-2">
                  <strong>처리된 데이터:</strong> {cleanupResult.data.totalProcessed || 0}개 예약
                </div>
                <div className="text-sm text-gray-700 mb-2">
                  <strong>상품 ID:</strong> {cleanupResult.data.productIds?.join(', ') || '없음'}
                </div>
                <div className="text-sm text-gray-700 mb-2">
                  <strong>업데이트된 예약:</strong> {cleanupResult.data.updatedReservations || 0}개
                </div>
                
                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="bg-blue-50 p-2 rounded text-center">
                    <div className="font-bold text-blue-600">{cleanupResult.data.mdgcSunriseXUpdated || 0}</div>
                    <div className="text-blue-800">MDGCSUNRISE_X → X</div>
                  </div>
                  <div className="bg-purple-50 p-2 rounded text-center">
                    <div className="font-bold text-purple-600">{cleanupResult.data.mdgc1DXUpdated || 0}</div>
                    <div className="text-purple-800">MDGC1D_X → X</div>
                  </div>
                  <div className="bg-green-50 p-2 rounded text-center">
                    <div className="font-bold text-green-600">
                      {cleanupResult.data && 'lowerAntelopeCount' in cleanupResult.data ? 
                        (cleanupResult.data as { lowerAntelopeCount: number }).lowerAntelopeCount : 0}
                    </div>
                    <div className="text-green-800">Lower Antelope</div>
                  </div>
                  <div className="bg-orange-50 p-2 rounded text-center">
                    <div className="font-bold text-orange-600">
                      {cleanupResult.data && 'antelopeXCount' in cleanupResult.data ? 
                        (cleanupResult.data as { antelopeXCount: number }).antelopeXCount : 0}
                    </div>
                    <div className="text-orange-800">Antelope X</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
