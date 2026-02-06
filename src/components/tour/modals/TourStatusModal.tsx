import React, { useState } from 'react'
import { X } from 'lucide-react'
import { tourStatusOptions, assignmentStatusOptions } from '@/utils/tourStatusUtils'

interface TourStatusModalProps {
  isOpen: boolean
  tour: any
  currentTourStatus: string | null
  currentAssignmentStatus: string | null
  locale: string
  onClose: () => void
  onUpdateTourStatus: (status: string) => Promise<void>
  onUpdateAssignmentStatus: (status: string) => Promise<void>
  getStatusColor: (status: string | null) => string
  getStatusText: (status: string | null, locale: string) => string
  getAssignmentStatusColor: (tour: any) => string
  getAssignmentStatusText: (tour: any, locale: string) => string
}

export const TourStatusModal: React.FC<TourStatusModalProps> = ({
  isOpen,
  tour,
  currentTourStatus,
  currentAssignmentStatus,
  locale,
  onClose,
  onUpdateTourStatus,
  onUpdateAssignmentStatus,
  getStatusColor,
  getStatusText,
  getAssignmentStatusColor,
  getAssignmentStatusText
}) => {
  const [selectedTourStatus, setSelectedTourStatus] = useState<string | null>(currentTourStatus)
  const [selectedAssignmentStatus, setSelectedAssignmentStatus] = useState<string | null>(currentAssignmentStatus)
  const [isUpdating, setIsUpdating] = useState(false)

  if (!isOpen) return null

  const handleSave = async () => {
    setIsUpdating(true)
    try {
      // 투어 상태가 변경된 경우
      if (selectedTourStatus !== currentTourStatus && selectedTourStatus) {
        await onUpdateTourStatus(selectedTourStatus)
      }
      
      // 배정 상태가 변경된 경우
      if (selectedAssignmentStatus !== currentAssignmentStatus && selectedAssignmentStatus) {
        await onUpdateAssignmentStatus(selectedAssignmentStatus)
      }
      
      onClose()
    } catch (error) {
      console.error('상태 업데이트 오류:', error)
      alert(locale === 'ko' ? '상태 업데이트 중 오류가 발생했습니다.' : 'Error updating status.')
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-xl sm:rounded-lg shadow-xl max-w-md w-full max-h-[90vh] sm:max-h-[85vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-3 py-2 sm:p-4 border-b flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900">
            {locale === 'ko' ? '투어 상태 변경' : 'Change Tour Status'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
          >
            <X size={18} />
          </button>
        </div>

        {/* 내용 - 스크롤 가능, 푸터가 가려지지 않도록 */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-4">
          {/* 투어 상태 - 컴팩트 그리드 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              {locale === 'ko' ? '투어 상태' : 'Tour Status'}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {tourStatusOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedTourStatus(option.value)}
                  className={`px-2 py-2 rounded-md text-xs transition-colors flex items-center justify-center gap-1 ${
                    selectedTourStatus === option.value
                      ? `${option.color} ring-2 ring-blue-500`
                      : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {selectedTourStatus === option.value && (
                    <span className="text-blue-600 shrink-0">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 배정 상태 - 컴팩트 그리드 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              {locale === 'ko' ? '배정 상태' : 'Assignment Status'}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {assignmentStatusOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedAssignmentStatus(option.value)}
                  className={`px-2 py-2 rounded-md text-xs transition-colors flex items-center justify-center gap-1 ${
                    selectedAssignmentStatus === option.value
                      ? `${option.color} ring-2 ring-blue-500`
                      : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {selectedAssignmentStatus === option.value && (
                    <span className="text-blue-600 shrink-0">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 푸터 - 항상 보이도록 flex-shrink-0 + safe area */}
        <div className="flex items-center justify-end gap-2 p-3 sm:p-4 pt-2 border-t bg-white flex-shrink-0 pb-[env(safe-area-inset-bottom)]">
          <button
            onClick={onClose}
            disabled={isUpdating}
            className="px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {locale === 'ko' ? '취소' : 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            disabled={isUpdating}
            className="px-3 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUpdating 
              ? (locale === 'ko' ? '저장 중...' : 'Saving...')
              : (locale === 'ko' ? '저장' : 'Save')
            }
          </button>
        </div>
      </div>
    </div>
  )
}
