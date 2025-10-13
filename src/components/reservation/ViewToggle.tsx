'use client'

import { Grid3X3, CalendarDays } from 'lucide-react'

interface ViewToggleProps {
  viewMode: 'card' | 'calendar'
  onViewModeChange: (mode: 'card' | 'calendar') => void
  onCalendarLoading: () => void
}

export default function ViewToggle({
  viewMode,
  onViewModeChange,
  onCalendarLoading
}: ViewToggleProps) {
  return (
    <div className="flex items-center space-x-1">
      <button
        onClick={() => onViewModeChange('card')}
        className={`flex items-center space-x-1 px-2 py-1 rounded-md transition-colors text-xs ${
          viewMode === 'card' 
            ? 'bg-blue-500 text-white' 
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        <Grid3X3 className="w-3 h-3" />
        <span className="hidden sm:inline">카드</span>
      </button>
      <button
        onClick={() => {
          onCalendarLoading()
          onViewModeChange('calendar')
        }}
        className={`flex items-center space-x-1 px-2 py-1 rounded-md transition-colors text-xs ${
          viewMode === 'calendar' 
            ? 'bg-blue-500 text-white' 
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        <CalendarDays className="w-3 h-3" />
        <span className="hidden sm:inline">달력</span>
      </button>
    </div>
  )
}
