'use client'

import { X } from 'lucide-react'

interface OptionsManualModalProps {
  show: boolean
  onClose: () => void
}

export default function OptionsManualModal({
  show,
  onClose
}: OptionsManualModalProps) {
  if (!show) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">📚 옵션 관리 가이드</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="space-y-4 text-sm text-gray-700">
          <div className="bg-blue-50 p-3 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">✅ 필수 옵션 (택일)</h4>
            <p className="text-blue-800">
              고객이 반드시 선택해야 하는 옵션입니다.<br/>
              <strong>예시:</strong> 숙박 선택, 캐년 입장권 선택
            </p>
            <div className="mt-2 text-xs">
              <span className="font-medium">설정:</span> 필수 ✅ + 다중 ❌
            </div>
          </div>

          <div className="bg-green-50 p-3 rounded-lg">
            <h4 className="font-medium text-green-900 mb-2">ℹ️ 선택 옵션 (추가 서비스)</h4>
            <p className="text-green-800">
              고객이 원할 때 선택할 수 있는 옵션입니다.<br/>
              <strong>예시:</strong> 도시락, 카시트, 호텔 픽업
            </p>
            <div className="mt-2 text-xs">
              <span className="font-medium">설정:</span> 필수 ❌ + 다중 ✅
            </div>
          </div>

          <div className="bg-yellow-50 p-3 rounded-lg">
            <h4 className="font-medium text-yellow-900 mb-2">💡 빠른 설정 팁</h4>
            <ul className="text-yellow-800 space-y-1 text-xs">
              <li>• <strong>택일:</strong> 필수 ✅ + 다중 ❌</li>
              <li>• <strong>추가:</strong> 필수 ❌ + 다중 ✅</li>
              <li>• <strong>설명:</strong> 고객이 이해하기 쉽게 작성</li>
              <li>• <strong>가격:</strong> 성인/아동/유아별로 개별 설정</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
