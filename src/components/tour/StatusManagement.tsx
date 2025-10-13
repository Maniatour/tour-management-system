import React from 'react'
import { Copy, Trash2, Edit } from 'lucide-react'

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
  onUpdateTourStatus: (status: string) => void
  onUpdateAssignmentStatus: (status: string) => void
  getStatusColor: (status: string | null) => string
  getStatusText: (status: string | null) => string
  getAssignmentStatusColor: () => string
  getAssignmentStatusText: () => string
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
  getAssignmentStatusText
}) => {
  return (
    <div className="flex sm:hidden flex-col w-full mt-1 space-y-3">
      {/* 모바일 상태 변경 버튼들 */}
      <div className="flex space-x-2">
        {/* 투어 상태 드롭다운 */}
        <div className="relative flex-1">
          <button 
            onClick={onToggleTourStatusDropdown}
            className={`w-full px-3 py-2 rounded-lg font-medium text-xs flex items-center justify-center ${getStatusColor(tour.tour_status)} hover:opacity-80 transition-opacity`}
          >
            투어: {getStatusText(tour.tour_status)}
            <svg className="ml-1 w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showTourStatusDropdown && (
            <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50">
              {tourStatusOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onUpdateTourStatus(option.value)
                    onToggleTourStatusDropdown()
                  }}
                  className={`w-full px-3 py-2 text-xs text-left hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${option.color}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* 배정 상태 드롭다운 */}
        <div className="relative flex-1">
          <button 
            onClick={onToggleAssignmentStatusDropdown}
            className={`w-full px-3 py-2 rounded-lg font-medium text-xs flex items-center justify-center ${getAssignmentStatusColor()} hover:opacity-80 transition-opacity`}
          >
            배정: {getAssignmentStatusText()}
            <svg className="ml-1 w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showAssignmentStatusDropdown && (
            <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50">
              {assignmentStatusOptions.map((option) => (
                <button
                  key={option.value}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onUpdateAssignmentStatus(option.value)
                    onToggleAssignmentStatusDropdown()
                  }}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onUpdateAssignmentStatus(option.value)
                    onToggleAssignmentStatusDropdown()
                  }}
                  className={`w-full px-3 py-2 text-xs text-left hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${option.color}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
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
          <button className="p-1.5 text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200">
            <Edit size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
