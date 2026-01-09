import React, { useState } from 'react'
import { Copy, Trash2, Edit } from 'lucide-react'
import { TourStatusModal } from './modals/TourStatusModal'

interface StatusManagementProps {
  tour: any
  showTourStatusDropdown: boolean
  showAssignmentStatusDropdown: boolean
  tourStatusOptions: Array<{ value: string; label: string; color: string }>
  assignmentStatusOptions: Array<{ value: string; label: string; color: string }>
  getTotalAssignedPeople: number
  getTotalPeopleFiltered: number
  getTotalPeopleAll: number
  onToggleTourStatusDropdown: () => void
  onToggleAssignmentStatusDropdown: () => void
  onUpdateTourStatus: (status: string) => Promise<void>
  onUpdateAssignmentStatus: (status: string) => Promise<void>
  getStatusColor: (status: string | null) => string
  getStatusText: (status: string | null, locale: string) => string
  getAssignmentStatusColor: (tour: any) => string
  getAssignmentStatusText: (tour: any, locale: string) => string
  locale: string
  onEditClick?: () => void
}

export const StatusManagement: React.FC<StatusManagementProps> = ({
  tour,
  showTourStatusDropdown,
  showAssignmentStatusDropdown,
  tourStatusOptions,
  assignmentStatusOptions,
  getTotalAssignedPeople,
  getTotalPeopleFiltered,
  getTotalPeopleAll,
  onToggleTourStatusDropdown,
  onToggleAssignmentStatusDropdown,
  onUpdateTourStatus,
  onUpdateAssignmentStatus,
  getStatusColor,
  getStatusText,
  getAssignmentStatusColor,
  getAssignmentStatusText,
  locale,
  onEditClick
}) => {
  const [showStatusModal, setShowStatusModal] = useState(false)
  
  return (
    <div className="flex sm:hidden flex-col w-full mt-1 space-y-3">
      {/* 모바일 상태 변경 버튼들 */}
      <div className="flex space-x-2">
        {/* 투어 상태 버튼 */}
        <button 
          type="button"
          onClick={() => setShowStatusModal(true)}
          className={`flex-1 px-3 py-2 rounded-lg font-medium text-xs flex items-center justify-center ${getStatusColor(tour.tour_status)} hover:opacity-80 transition-opacity cursor-pointer`}
        >
          투어: {getStatusText(tour.tour_status, locale)}
        </button>
        
        {/* 배정 상태 버튼 */}
        <button 
          type="button"
          onClick={() => setShowStatusModal(true)}
          className={`flex-1 px-3 py-2 rounded-lg font-medium text-xs flex items-center justify-center ${getAssignmentStatusColor(tour)} hover:opacity-80 transition-opacity cursor-pointer`}
        >
          배정: {getAssignmentStatusText(tour, locale)}
        </button>
      </div>
      
      {/* 모바일 요약 정보 및 액션 버튼들 */}
      <div className="flex items-center justify-between">
        <div className="bg-blue-50 rounded px-2 py-1 border border-blue-200 text-blue-700 text-xs font-semibold">
          {getTotalAssignedPeople} / {getTotalPeopleFiltered} ({Math.max(getTotalPeopleAll - getTotalPeopleFiltered, 0)})
        </div>
        <div className="flex items-center space-x-1">
          <button className="p-1.5 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
            <Copy size={16} />
          </button>
          <button className="p-1.5 text-red-700 bg-red-100 rounded-lg hover:bg-red-200">
            <Trash2 size={16} />
          </button>
          <button 
            onClick={onEditClick}
            className="p-1.5 text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200"
          >
            <Edit size={16} />
          </button>
        </div>
      </div>

      {/* 상태 변경 모달 */}
      <TourStatusModal
        isOpen={showStatusModal}
        tour={tour}
        currentTourStatus={tour.tour_status}
        currentAssignmentStatus={tour.assignment_status}
        locale={locale}
        onClose={() => setShowStatusModal(false)}
        onUpdateTourStatus={onUpdateTourStatus}
        onUpdateAssignmentStatus={onUpdateAssignmentStatus}
        getStatusColor={getStatusColor}
        getStatusText={getStatusText}
        getAssignmentStatusColor={getAssignmentStatusColor}
        getAssignmentStatusText={getAssignmentStatusText}
      />
    </div>
  )
}
