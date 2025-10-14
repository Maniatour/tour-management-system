import React, { useState, useEffect } from 'react'
import { X, Clock, Building } from 'lucide-react'

interface SimplePickupEditModalProps {
  isOpen: boolean
  reservation: {
    id: string
    pickup_time: string | null
    pickup_hotel: string | null
    customer_id: string | null
  }
  pickupHotels: Array<{ id: string; hotel: string; pick_up_location?: string }>
  onSave: (reservationId: string, pickupTime: string, pickupHotel: string) => Promise<void>
  onClose: () => void
  getCustomerName: (customerId: string) => string
}

export const SimplePickupEditModal: React.FC<SimplePickupEditModalProps> = ({
  isOpen,
  reservation,
  pickupHotels,
  onSave,
  onClose,
  getCustomerName
}) => {
  const [pickupTime, setPickupTime] = useState('')
  const [pickupHotel, setPickupHotel] = useState('')
  const [loading, setLoading] = useState(false)

  // 모달이 열릴 때 현재 값으로 초기화
  useEffect(() => {
    if (isOpen && reservation) {
      setPickupTime(reservation.pickup_time || '')
      setPickupHotel(reservation.pickup_hotel || '')
    }
  }, [isOpen, reservation])

  const handleSave = async () => {
    if (!reservation) return
    
    setLoading(true)
    try {
      await onSave(reservation.id, pickupTime, pickupHotel)
      onClose()
    } catch (error) {
      console.error('픽업 정보 저장 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      onClose()
    }
  }

  if (!isOpen) return null

  const customerName = getCustomerName(reservation.customer_id || '')

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e) => {
        e.stopPropagation()
        handleClose()
      }}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            픽업 정보 수정
          </h3>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleClose()
            }}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* 내용 */}
        <div className="p-4 space-y-4">
          {/* 고객 정보 */}
          <div className="text-sm text-gray-600">
            <span className="font-medium">고객:</span> {customerName}
          </div>

          {/* 픽업 시간 */}
          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
              <Clock size={16} />
              <span>픽업 시간</span>
            </label>
            <input
              type="time"
              value={pickupTime}
              onChange={(e) => setPickupTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
          </div>

          {/* 픽업 호텔 */}
          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
              <Building size={16} />
              <span>픽업 호텔</span>
            </label>
            <select
              value={pickupHotel}
              onChange={(e) => setPickupHotel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            >
              <option value="">호텔 선택</option>
              {pickupHotels.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>
                  {hotel.hotel}
                  {hotel.pick_up_location && ` (${hotel.pick_up_location})`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end space-x-3 p-4 border-t bg-gray-50">
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleClose()
            }}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleSave()
            }}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
