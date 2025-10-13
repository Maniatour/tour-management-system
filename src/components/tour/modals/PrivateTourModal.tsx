import { X } from 'lucide-react'

interface PrivateTourModalProps {
  isOpen: boolean
  pendingValue: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function PrivateTourModal({
  isOpen,
  pendingValue,
  onConfirm,
  onCancel
}: PrivateTourModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              단독투어 상태 변경
            </h3>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>
          
          <div className="mb-6">
            <p className="text-gray-700 mb-4">
              이 투어를 <span className="font-semibold text-blue-600">
                {pendingValue ? '단독투어' : '일반투어'}
              </span>로 변경하시겠습니까?
            </p>
            
            {pendingValue && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-blue-800">단독투어 안내</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      단독투어로 설정하면 이 투어는 개별 고객을 위한 전용 투어가 됩니다.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {!pendingValue && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-gray-800">일반투어 안내</h4>
                    <p className="text-sm text-gray-700 mt-1">
                      일반투어로 설정하면 여러 고객이 함께 참여할 수 있는 공용 투어가 됩니다.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              취소
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                pendingValue
                  ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                  : 'bg-gray-600 hover:bg-gray-700 focus:ring-gray-500'
              }`}
            >
              {pendingValue ? '단독투어로 변경' : '일반투어로 변경'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
