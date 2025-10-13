import { ArrowLeft, Edit, Trash2, Copy } from 'lucide-react'
import { useRouter } from 'next/navigation'
import TourSunriseTime from '@/components/TourSunriseTime'
import { StatusManagement } from '@/components/tour/StatusManagement'

interface TourHeaderProps {
  tour: any
  product: any
  params: { locale: string }
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

export default function TourHeader({
  tour,
  product,
  params,
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
}: TourHeaderProps) {
  const router = useRouter()

  return (
    <div className="bg-white shadow-sm border-b">
      <div className="px-2 sm:px-6 py-2 sm:py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push(`/${params.locale}/admin/tours`)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-base sm:text-xl font-bold text-gray-900 truncate">
                  {product?.name_ko || '투어 상세'}
                </h1>
                {/* 일출 시간 표시 (투어 날짜 기반) */}
                <TourSunriseTime tourDate={tour.tour_date} />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-600 mt-1">
                <span>투어 ID: {tour.id}</span>
                <span className="hidden sm:inline">|</span>
                <span>날짜: {tour.tour_date ? new Date(tour.tour_date + 'T00:00:00').toLocaleDateString('ko-KR', {timeZone: 'America/Los_Angeles'}) : ''}</span>
                <span className="hidden sm:inline">|</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tour.tour_status)}`}>
                  {getStatusText(tour.tour_status)}
                </span>
              </div>
            </div>
          </div>
          
          {/* 모바일 요약/액션 (아이콘) */}
          <StatusManagement
            tour={tour}
            showTourStatusDropdown={showTourStatusDropdown}
            showAssignmentStatusDropdown={showAssignmentStatusDropdown}
            tourStatusOptions={tourStatusOptions}
            assignmentStatusOptions={assignmentStatusOptions}
            getTotalAssignedPeople={getTotalAssignedPeople}
            getTotalPeopleFiltered={getTotalPeopleFiltered}
            getTotalPeopleAll={getTotalPeopleAll}
            onToggleTourStatusDropdown={onToggleTourStatusDropdown}
            onToggleAssignmentStatusDropdown={onToggleAssignmentStatusDropdown}
            onUpdateTourStatus={onUpdateTourStatus}
            onUpdateAssignmentStatus={onUpdateAssignmentStatus}
            getStatusColor={getStatusColor}
            getStatusText={getStatusText}
            getAssignmentStatusColor={getAssignmentStatusColor}
            getAssignmentStatusText={getAssignmentStatusText}
          />

          {/* 데스크톱 요약/액션 */}
          <div className="hidden sm:flex items-center space-x-6">
            {/* 투어 상태 버튼들 - 왼쪽 배치 */}
            <div className="flex space-x-3">
              {/* 투어 Status 드롭다운 */}
              <div className="relative">
                <button 
                  onClick={onToggleTourStatusDropdown}
                  className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center justify-center min-w-[120px] ${getStatusColor(tour.tour_status)} hover:opacity-80 transition-opacity`}
                >
                  투어: {getStatusText(tour.tour_status)}
                  <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                        }}
                        className={`w-full px-4 py-2 text-sm text-left hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${option.color}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* 투어 배정 Status 드롭다운 */}
              <div className="relative">
                <button 
                  onClick={onToggleAssignmentStatusDropdown}
                  className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center justify-center min-w-[120px] ${getAssignmentStatusColor()} hover:opacity-80 transition-opacity`}
                >
                  배정: {getAssignmentStatusText()}
                  <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                        }}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          onUpdateAssignmentStatus(option.value)
                        }}
                        className={`w-full px-4 py-2 text-sm text-left hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${option.color}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* 총 배정 인원 표시 */}
            <div className="text-center bg-blue-50 rounded-lg px-4 py-3 border border-blue-200">
              <div className="text-xl font-bold text-blue-600">
                {getTotalAssignedPeople}명 / {getTotalPeopleFiltered}명 ({Math.max(getTotalPeopleAll - getTotalPeopleFiltered, 0)}명)
              </div>
              <div className="text-xs text-blue-600 mt-1">
                배정 / 전체 / 취소및 대기
              </div>
            </div>
            
            <div className="flex space-x-2">
              <button className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center space-x-2">
                <Copy size={16} />
                <span>복사</span>
              </button>
              <button className="px-4 py-2 text-red-700 bg-red-100 rounded-lg hover:bg-red-200 flex items-center space-x-2">
                <Trash2 size={16} />
                <span>삭제</span>
              </button>
              <button className="px-4 py-2 text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 flex items-center space-x-2">
                <Edit size={16} />
                <span>편집</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
