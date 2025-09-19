import React from 'react'
import { X } from 'lucide-react'

interface PickupScheduleModalProps {
  isOpen: boolean
  onClose: () => void
  pickupSchedule: Array<{
    time: string
    hotel: string
    location: string
    people: number
  }>
}

export default function PickupScheduleModal({ 
  isOpen, 
  onClose, 
  pickupSchedule 
}: PickupScheduleModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            픽업 스케줄
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="space-y-3">
          {pickupSchedule.length > 0 ? (
            pickupSchedule.map((schedule, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-900">
                    {schedule.time}
                  </div>
                  <div className="text-xs text-gray-500">
                    {schedule.people}명
                  </div>
                </div>
                <div className="mt-1 text-sm text-gray-700">
                  {schedule.hotel}
                </div>
                <div className="text-xs text-gray-500">
                  {schedule.location}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-gray-500 py-4">
              픽업 스케줄이 없습니다.
            </div>
          )}
        </div>
        
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
