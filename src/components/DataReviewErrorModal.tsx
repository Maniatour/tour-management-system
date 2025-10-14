'use client'

import { X, AlertTriangle } from 'lucide-react'

interface DataReviewErrorModalProps {
  isOpen: boolean
  onClose: () => void
  reservation: {
    id: string
    channel_rn?: string
    customer?: { name: string }
    product?: { name: string }
    validationErrors: string[]
  }
}

export default function DataReviewErrorModal({ isOpen, onClose, reservation }: DataReviewErrorModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">데이터 오류 상세</h2>
                <p className="text-sm text-gray-600">예약 ID: {reservation.id}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* 예약 정보 */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-gray-900 mb-3">예약 정보</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">채널 RN:</span>
                <span className="ml-2 font-medium">{reservation.channel_rn || '없음'}</span>
              </div>
              <div>
                <span className="text-gray-600">고객명:</span>
                <span className="ml-2 font-medium">{reservation.customer?.name || '없음'}</span>
              </div>
              <div>
                <span className="text-gray-600">상품명:</span>
                <span className="ml-2 font-medium">{reservation.product?.name || '없음'}</span>
              </div>
            </div>
          </div>

          {/* 오류 목록 */}
          <div className="mb-6">
            <h3 className="font-medium text-gray-900 mb-3">발견된 오류 ({reservation.validationErrors.length}개)</h3>
            <div className="space-y-2">
              {reservation.validationErrors.map((error, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <X className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-red-700">{error}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 권장 사항 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">권장 사항</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• 누락된 필수 필드를 채워주세요</li>
              <li>• 존재하지 않는 ID는 올바른 ID로 변경해주세요</li>
              <li>• 날짜 형식이 올바른지 확인해주세요</li>
              <li>• 인원 수가 0 이상인지 확인해주세요</li>
            </ul>
          </div>

          {/* 닫기 버튼 */}
          <div className="flex justify-end mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
