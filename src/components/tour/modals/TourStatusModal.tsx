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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {locale === 'ko' ? '투어 상태 변경' : 'Change Tour Status'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X size={20} />
          </button>
        </div>

        {/* 내용 */}
        <div className="p-4 space-y-6">
          {/* 투어 상태 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {locale === 'ko' ? '투어 상태' : 'Tour Status'}
            </label>
            <div className="space-y-2">
              {tourStatusOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedTourStatus(option.value)}
                  className={`w-full px-4 py-3 rounded-lg text-sm text-left transition-colors ${
                    selectedTourStatus === option.value
                      ? `${option.color} ring-2 ring-blue-500`
                      : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{option.label}</span>
                    {selectedTourStatus === option.value && (
                      <span className="text-blue-600">✓</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 배정 상태 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {locale === 'ko' ? '배정 상태' : 'Assignment Status'}
            </label>
            <div className="space-y-2">
              {assignmentStatusOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedAssignmentStatus(option.value)}
                  className={`w-full px-4 py-3 rounded-lg text-sm text-left transition-colors ${
                    selectedAssignmentStatus === option.value
                      ? `${option.color} ring-2 ring-blue-500`
                      : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{option.label}</span>
                    {selectedAssignmentStatus === option.value && (
                      <span className="text-blue-600">✓</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-2 p-4 border-t">
          <button
            onClick={onClose}
            disabled={isUpdating}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {locale === 'ko' ? '취소' : 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            disabled={isUpdating}
            className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
