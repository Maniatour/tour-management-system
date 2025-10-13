import React from 'react'
import { ConnectionStatusLabel } from './TourUIComponents'

interface TourInfoProps {
  tour: any
  product: any
  tourNote: string
  isPrivateTour: boolean
  connectionStatus: { tours: boolean }
  onTourNoteChange: (note: string) => void
  onPrivateTourToggle: () => void
  getStatusColor: (status: string | null) => string
  getStatusText: (status: string | null) => string
}

export const TourInfo: React.FC<TourInfoProps> = ({
  tour,
  product,
  tourNote,
  isPrivateTour,
  connectionStatus,
  onTourNoteChange,
  onPrivateTourToggle,
  getStatusColor,
  getStatusText
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4">
        <h2 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
          기본 정보
          <ConnectionStatusLabel status={connectionStatus.tours} section="투어" />
        </h2>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600 text-sm">투어명:</span>
            <span className="font-medium text-sm">{product?.name_ko || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 text-sm">투어 날짜:</span>
            <span className="font-medium text-sm">
              {tour.tour_date ? new Date(tour.tour_date + 'T00:00:00').toLocaleDateString('ko-KR', {timeZone: 'America/Los_Angeles'}) : ''}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 text-sm">투어 시간:</span>
            <span className="font-medium text-sm">
              {tour.tour_start_datetime ? new Date(tour.tour_start_datetime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '08:00'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 text-sm">상태:</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tour.tour_status)}`}>
              {getStatusText(tour.tour_status)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 text-sm">투어 유형:</span>
            <button
              onClick={onPrivateTourToggle}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                isPrivateTour
                  ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2'
              }`}
            >
              {isPrivateTour ? '단독투어' : '일반투어'}
            </button>
          </div>
        </div>
        
        {/* 투어 노트 */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            투어 노트
          </label>
          <textarea
            value={tourNote}
            onChange={(e) => onTourNoteChange(e.target.value)}
            placeholder="투어 관련 특이사항이나 메모를 입력하세요..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={3}
          />
        </div>
      </div>
    </div>
  )
}
