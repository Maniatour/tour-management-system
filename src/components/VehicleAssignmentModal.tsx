'use client'

import React, { useState, useEffect } from 'react'
import { X, Car, Calendar, Clock, User, Check, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Vehicle {
  id: string
  vehicle_number: string
  nick?: string | null
  vehicle_type: string
  capacity: number
  status: string
  current_mileage: number
  vehicle_category: string
  rental_company?: string
  daily_rate?: number
  rental_start_date?: string
  rental_end_date?: string
  rental_pickup_location?: string
  rental_return_location?: string
  rental_total_cost?: number
}

interface VehicleAssignmentModalProps {
  tourId: string
  tourDate: string
  onClose: () => void
  onAssignmentComplete: () => void
}

export default function VehicleAssignmentModal({ 
  tourId, 
  tourDate, 
  onClose, 
  onAssignmentComplete 
}: VehicleAssignmentModalProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [selectedVehicle, setSelectedVehicle] = useState<string>('')
  const [vehicleType, setVehicleType] = useState<'company' | 'rental'>('company')
  const [startTime, setStartTime] = useState<string>('')
  const [endTime, setEndTime] = useState<string>('')
  const [driverName, setDriverName] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [selectedRentalReservation, setSelectedRentalReservation] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tourData, setTourData] = useState<any>(null)


  useEffect(() => {
    fetchVehicles()
    fetchTourData()
  }, [tourId, tourDate])

  const fetchVehicles = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('vehicle_category', { ascending: true })
        .order('vehicle_number', { ascending: true })

      if (error) throw error
      setVehicles(data || [])
    } catch (error) {
      console.error('차량 목록을 불러오는 중 오류가 발생했습니다:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTourData = async () => {
    try {
      const { data, error } = await supabase
        .from('tours')
        .select('*')
        .eq('id', tourId)
        .single()

      if (error) throw error
      
      if (data) {
        setTourData(data)
        setSelectedVehicle(data.tour_car_id || '')
        setStartTime(data.car_start_time || '')
        setEndTime(data.car_end_time || '')
        setDriverName(data.car_driver_name || '')
        setNotes(data.car_notes || '')
      }
    } catch (error) {
      console.error('투어 데이터를 불러오는 중 오류가 발생했습니다:', error)
    }
  }

  const handleSave = async () => {
    if (!selectedVehicle) {
      alert('차량을 선택해주세요.')
      return
    }

    try {
      setSaving(true)
      
      // tours 테이블 업데이트
      const { error } = await supabase
        .from('tours')
        .update({
          tour_car_id: selectedVehicle,
          car_start_time: startTime,
          car_end_time: endTime,
          car_driver_name: driverName,
          car_notes: notes
        })
        .eq('id', tourId)

      if (error) throw error

      alert('차량 배정이 완료되었습니다.')
      onAssignmentComplete()
      onClose()
    } catch (error) {
      console.error('차량 배정 중 오류가 발생했습니다:', error)
      alert('차량 배정 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!tourData?.tour_car_id) return

    if (!confirm('정말로 이 차량 배정을 삭제하시겠습니까?')) return

    try {
      setSaving(true)
      const { error } = await supabase
        .from('tours')
        .update({
          tour_car_id: null
        })
        .eq('id', tourId)

      if (error) throw error

      alert('차량 배정이 삭제되었습니다.')
      onAssignmentComplete()
      onClose()
    } catch (error) {
      console.error('차량 배정 삭제 중 오류가 발생했습니다:', error)
      alert('차량 배정 삭제 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const selectedVehicleData = vehicles.find(v => v.id === selectedVehicle)

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>
          <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">차량 목록을 불러오는 중...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-6">
                          <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <Car className="w-5 h-5 mr-2" />
              {tourData?.tour_car_id ? '차량 배정 수정' : '차량 배정'}
            </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 투어 정보 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">투어 정보</h4>
                <p className="text-sm text-gray-600">투어 ID: {tourId}</p>
                <p className="text-sm text-gray-600">투어 날짜: {new Date(tourDate).toLocaleDateString('ko-KR')}</p>
              </div>

              {/* 차량 타입 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  차량 타입 *
                </label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="vehicleType"
                      value="company"
                      checked={vehicleType === 'company'}
                      onChange={(e) => {
                        setVehicleType(e.target.value as 'company')
                        setSelectedVehicle('')
                        setSelectedRentalReservation('')
                      }}
                      className="mr-2"
                    />
                    회사 차량
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="vehicleType"
                      value="rental"
                      checked={vehicleType === 'rental'}
                      onChange={(e) => {
                        setVehicleType(e.target.value as 'rental')
                        setSelectedVehicle('')
                        setSelectedRentalReservation('')
                      }}
                      className="mr-2"
                    />
                    렌터카
                  </label>
                </div>
              </div>

              {/* 차량 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  차량 선택 *
                </label>
                <select
                  value={selectedVehicle}
                  onChange={(e) => setSelectedVehicle(e.target.value)}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">차량을 선택하세요</option>
                  {vehicles
                    .filter(vehicle => vehicle.vehicle_category === vehicleType)
                    .map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.vehicle_category === 'company' 
                          ? `${vehicle.nick?.trim() || vehicle.vehicle_number} - ${vehicle.vehicle_type} (${vehicle.capacity}인승)`
                          : `${vehicle.rental_company} - ${vehicle.vehicle_type} (${vehicle.capacity}인승) - ${vehicle.rental_start_date} ~ ${vehicle.rental_end_date}`
                        }
                      </option>
                    ))}
                </select>
              </div>

              {/* 선택된 차량 정보 */}
              {selectedVehicleData && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                    <Car className="w-4 h-4 mr-2" />
                    선택된 차량 정보
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p><span className="font-medium">차량 번호:</span> {selectedVehicleData.nick?.trim() || selectedVehicleData.vehicle_number}</p>
                    <p><span className="font-medium">차종:</span> {selectedVehicleData.vehicle_type}</p>
                    <p><span className="font-medium">탑승인원:</span> {selectedVehicleData.capacity}인승</p>
                    <p><span className="font-medium">현재 마일리지:</span> {selectedVehicleData.current_mileage?.toLocaleString() || 'N/A'} miles</p>
                    {selectedVehicleData.vehicle_category === 'rental' && (
                      <>
                        <p><span className="font-medium">렌터카 회사:</span> {selectedVehicleData.rental_company}</p>
                        <p><span className="font-medium">렌탈 기간:</span> {selectedVehicleData.rental_start_date} ~ {selectedVehicleData.rental_end_date}</p>
                        <p><span className="font-medium">일일 요금:</span> ${selectedVehicleData.daily_rate?.toLocaleString() || 'N/A'}</p>
                        <p><span className="font-medium">총 비용:</span> ${selectedVehicleData.rental_total_cost?.toLocaleString() || 'N/A'}</p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* 차량 배정 상세 정보 */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">차량 배정 상세 정보</h4>
                
                {/* 시작 시간 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    시작 시간
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* 종료 시간 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    종료 시간
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* 운전자 이름 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    운전자 이름
                  </label>
                  <input
                    type="text"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="운전자 이름을 입력하세요"
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* 메모 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    메모
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="차량 배정 관련 메모를 입력하세요"
                    rows={3}
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* 경고 메시지 */}
              {vehicles.length === 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex">
                    <AlertCircle className="w-5 h-5 text-yellow-400 mr-2" />
                    <div>
                      <h4 className="text-sm font-medium text-yellow-800">사용 가능한 차량이 없습니다</h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        운행 가능한 상태의 차량이 없습니다. 차량 관리 페이지에서 차량 상태를 확인해주세요.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              onClick={handleSave}
              disabled={!selectedVehicle || saving}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? '저장 중...' : tourData?.tour_car_id ? '수정' : '배정'}
            </button>
            {tourData?.tour_car_id && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-red-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                삭제
              </button>
            )}
            <button
              onClick={onClose}
              disabled={saving}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
