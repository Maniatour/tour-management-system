import { X } from 'lucide-react'
// @ts-ignore
import ReactCountryFlag from 'react-country-flag'

interface PickupTimeModalProps {
  isOpen: boolean
  selectedReservation: any
  pickupTimeValue: string
  onTimeChange: (time: string) => void
  onSave: () => void
  onCancel: () => void
  getCustomerName: (customerId: string) => string
  getCustomerLanguage: (customerId: string) => string
  getPickupHotelName: (pickupHotelId: string) => string
  getCountryCode: (language: string) => string
}

export default function PickupTimeModal({
  isOpen,
  selectedReservation,
  pickupTimeValue,
  onTimeChange,
  onSave,
  onCancel,
  getCustomerName,
  getCustomerLanguage,
  getPickupHotelName,
  getCountryCode
}: PickupTimeModalProps) {
  if (!isOpen || !selectedReservation) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">픽업시간 수정</h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="mb-4">
          <div className="flex items-center space-x-2 mb-2">
            <ReactCountryFlag
              countryCode={getCountryCode(getCustomerLanguage(selectedReservation?.customer_id || '') || '')}
              svg
              style={{ width: '16px', height: '12px' }}
            />
            <span className="font-medium text-sm">{getCustomerName(selectedReservation?.customer_id || '')}</span>
            <span className="text-xs text-gray-600">
              {(selectedReservation?.adults || 0) + (selectedReservation?.child || 0)}명
            </span>
          </div>
          <div className="text-xs text-gray-500 mb-4">
            {getPickupHotelName(selectedReservation?.pickup_hotel || '')}
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            픽업시간
          </label>
          <input
            type="time"
            value={pickupTimeValue}
            onChange={(e) => onTimeChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex space-x-3">
          <button
            onClick={onSave}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            저장
          </button>
          <button
            onClick={onCancel}
            className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  )
}
