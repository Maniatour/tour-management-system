'use client'

import React from 'react'

interface DaySelectModalProps {
  isOpen: boolean
  editingDayIndex: number | null
  onSelectDay: (dayIndex: number, day: string) => void
  onClearDay: (dayIndex: number) => void
  onClose: () => void
  locale?: string
}

const DaySelectModal: React.FC<DaySelectModalProps> = ({
  isOpen,
  editingDayIndex,
  onSelectDay,
  onClearDay,
  onClose,
  locale = 'ko'
}) => {
  if (!isOpen || editingDayIndex === null) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xs p-6">
        <h3 className="text-lg font-semibold mb-4">{locale === 'ko' ? '일차 선택' : 'Select Day'}</h3>
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((day) => (
            <button
              key={day}
              onClick={() => {
                onSelectDay(editingDayIndex, `${day}일`)
                onClose()
              }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-500 transition-colors"
            >
              {day}{locale === 'ko' ? '일' : ''}
            </button>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => {
              onClearDay(editingDayIndex)
              onClose()
            }}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            {locale === 'ko' ? '초기화' : 'Clear'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            {locale === 'ko' ? '취소' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DaySelectModal
