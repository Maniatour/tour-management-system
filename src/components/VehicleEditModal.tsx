'use client'

import React, { useState, useEffect } from 'react'
import { X, Car, DollarSign, Wrench, Calendar, Upload, Trash2 } from 'lucide-react'

interface Vehicle {
  id?: string
  vehicle_number: string
  vin?: string
  vehicle_type: string
  capacity: number
  year: number
  mileage_at_purchase: number
  purchase_amount: number
  purchase_date?: string
  memo?: string
  engine_oil_change_cycle: number
  current_mileage: number
  recent_engine_oil_change_mileage: number
  vehicle_status: string
  front_tire_size?: string
  rear_tire_size?: string
  windshield_wiper_size?: string
  headlight_model?: string
  headlight_model_name?: string
  is_installment: boolean
  installment_amount: number
  interest_rate: number
  monthly_payment: number
  additional_payment: number
  payment_due_date?: string
  installment_start_date?: string
  installment_end_date?: string
  vehicle_image_url?: string
  // 렌터카 관련 필드 (간소화)
  vehicle_category?: string
  rental_company?: string
  daily_rate?: number
  rental_start_date?: string
  rental_end_date?: string
  rental_pickup_location?: string
  rental_return_location?: string
  rental_total_cost?: number
  rental_status?: string
  rental_notes?: string
}

interface VehicleEditModalProps {
  vehicle: Vehicle | null
  onSave: (vehicleData: Partial<Vehicle>) => void
  onClose: () => void
}

export default function VehicleEditModal({ vehicle, onSave, onClose }: VehicleEditModalProps) {
  const [formData, setFormData] = useState<Partial<Vehicle>>({
    vehicle_number: '',
    vin: '',
    vehicle_type: '',
    capacity: 0,
    year: new Date().getFullYear(),
    mileage_at_purchase: 0,
    purchase_amount: 0,
    purchase_date: '',
    memo: '',
    engine_oil_change_cycle: 10000,
    current_mileage: 0,
    recent_engine_oil_change_mileage: 0,
    vehicle_status: '운행 가능',
    front_tire_size: '',
    rear_tire_size: '',
    windshield_wiper_size: '',
    headlight_model: '',
    headlight_model_name: '',
    is_installment: false,
    installment_amount: 0,
    interest_rate: 0,
    monthly_payment: 0,
    additional_payment: 0,
    payment_due_date: '',
    installment_start_date: '',
    installment_end_date: '',
    vehicle_image_url: '',
    // 렌터카 관련 필드 초기화 (간소화)
    vehicle_category: 'company',
    rental_company: '',
    daily_rate: 0,
    rental_start_date: '',
    rental_end_date: '',
    rental_pickup_location: '',
    rental_return_location: '',
    rental_total_cost: 0,
    rental_status: 'available',
    rental_notes: ''
  })

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')

  useEffect(() => {
    if (vehicle) {
      // null 값들을 기본값으로 변환
      setFormData({
        ...vehicle,
        year: vehicle.year || new Date().getFullYear(),
        capacity: vehicle.capacity || 0,
        mileage_at_purchase: vehicle.mileage_at_purchase || 0,
        purchase_amount: vehicle.purchase_amount || 0,
        engine_oil_change_cycle: vehicle.engine_oil_change_cycle || 10000,
        current_mileage: vehicle.current_mileage || 0,
        recent_engine_oil_change_mileage: vehicle.recent_engine_oil_change_mileage || 0,
        installment_amount: vehicle.installment_amount || 0,
        interest_rate: vehicle.interest_rate || 0,
        monthly_payment: vehicle.monthly_payment || 0,
        additional_payment: vehicle.additional_payment || 0,
        daily_rate: vehicle.daily_rate || 0,
        rental_total_cost: vehicle.rental_total_cost || 0,
        // 문자열 필드들
        vehicle_number: vehicle.vehicle_number || '',
        vin: vehicle.vin || '',
        vehicle_type: vehicle.vehicle_type || '',
        purchase_date: vehicle.purchase_date || '',
        memo: vehicle.memo || '',
        front_tire_size: vehicle.front_tire_size || '',
        rear_tire_size: vehicle.rear_tire_size || '',
        windshield_wiper_size: vehicle.windshield_wiper_size || '',
        headlight_model: vehicle.headlight_model || '',
        headlight_model_name: vehicle.headlight_model_name || '',
        payment_due_date: vehicle.payment_due_date || '',
        installment_start_date: vehicle.installment_start_date || '',
        installment_end_date: vehicle.installment_end_date || '',
        vehicle_image_url: vehicle.vehicle_image_url || '',
        rental_company: vehicle.rental_company || '',
        rental_start_date: vehicle.rental_start_date || '',
        rental_end_date: vehicle.rental_end_date || '',
        rental_pickup_location: vehicle.rental_pickup_location || '',
        rental_return_location: vehicle.rental_return_location || '',
        rental_notes: vehicle.rental_notes || '',
        // 불린 필드들
        is_installment: vehicle.is_installment || false,
        // 기타 필드들
        vehicle_status: vehicle.vehicle_status || '운행 가능',
        vehicle_category: vehicle.vehicle_category || 'company',
        rental_status: vehicle.rental_status || 'available'
      })
      if (vehicle.vehicle_image_url) {
        setImagePreview(vehicle.vehicle_image_url)
      }
    } else {
      // 새 차량인 경우 기본값 설정
      setFormData({
        vehicle_number: '',
        vin: '',
        vehicle_type: '',
        capacity: 0,
        year: new Date().getFullYear(),
        mileage_at_purchase: 0,
        purchase_amount: 0,
        purchase_date: '',
        memo: '',
        engine_oil_change_cycle: 10000,
        current_mileage: 0,
        recent_engine_oil_change_mileage: 0,
        vehicle_status: '운행 가능',
        front_tire_size: '',
        rear_tire_size: '',
        windshield_wiper_size: '',
        headlight_model: '',
        headlight_model_name: '',
        is_installment: false,
        installment_amount: 0,
        interest_rate: 0,
        monthly_payment: 0,
        additional_payment: 0,
        payment_due_date: '',
        installment_start_date: '',
        installment_end_date: '',
        vehicle_image_url: '',
        // 렌터카 관련 필드 초기화
        vehicle_category: 'company',
        rental_company: '',
        daily_rate: 0,
        rental_start_date: '',
        rental_end_date: '',
        rental_pickup_location: '',
        rental_return_location: '',
        rental_total_cost: 0,
        rental_status: 'available',
        rental_notes: ''
      })
    }
  }, [vehicle])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked
      setFormData(prev => ({ ...prev, [name]: checked }))
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handlePasteImage = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile()
        if (file) {
          setImageFile(file)
          const reader = new FileReader()
          reader.onload = (e) => {
            setImagePreview(e.target?.result as string)
          }
          reader.readAsDataURL(file)
        }
        break
      }
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  const calculateTotalPayment = () => {
    if (!formData.is_installment) return 0
    const monthly = formData.monthly_payment || 0
    const additional = formData.additional_payment || 0
    return monthly + additional
  }

  const calculateRemainingAmount = () => {
    if (!formData.is_installment) return 0
    const total = formData.installment_amount || 0
    const paid = calculateTotalPayment()
    return Math.max(0, total - paid)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <Car className="w-5 h-5 mr-2" />
                  {vehicle ? '차량 정보 수정' : '새 차량 추가'}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 기본 정보 */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-900 flex items-center">
                    <Car className="w-4 h-4 mr-2" />
                    기본 정보
                  </h4>
                  
                  {/* 차량 카테고리 선택 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">차량 카테고리 *</label>
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="vehicle_category"
                          value="company"
                          checked={formData.vehicle_category === 'company'}
                          onChange={handleInputChange}
                          className="mr-2"
                        />
                        회사 차량
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="vehicle_category"
                          value="rental"
                          checked={formData.vehicle_category === 'rental'}
                          onChange={handleInputChange}
                          className="mr-2"
                        />
                        렌터카
                      </label>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">차량 번호 *</label>
                      <input
                        type="text"
                        name="vehicle_number"
                        value={formData.vehicle_number}
                        onChange={handleInputChange}
                        required
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">VIN</label>
                      <input
                        type="text"
                        name="vin"
                        value={formData.vin}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">차종 *</label>
                    <input
                      type="text"
                      name="vehicle_type"
                      value={formData.vehicle_type}
                      onChange={handleInputChange}
                      required
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">탑승 인원 *</label>
                      <input
                        type="number"
                        name="capacity"
                        value={formData.capacity}
                        onChange={handleInputChange}
                        required
                        min="1"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">연식 *</label>
                      <input
                        type="number"
                        name="year"
                        value={formData.year}
                        onChange={handleInputChange}
                        required
                        min="1900"
                        max={new Date().getFullYear() + 1}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">구매시 마일리지 (miles)</label>
                      <input
                        type="number"
                        name="mileage_at_purchase"
                        value={formData.mileage_at_purchase}
                        onChange={handleInputChange}
                        min="0"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">구매 금액 ($)</label>
                      <input
                        type="number"
                        name="purchase_amount"
                        value={formData.purchase_amount}
                        onChange={handleInputChange}
                        min="0"
                        step="0.01"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">구매일</label>
                    <input
                      type="date"
                      name="purchase_date"
                      value={formData.purchase_date}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">메모</label>
                    <textarea
                      name="memo"
                      value={formData.memo}
                      onChange={handleInputChange}
                      rows={3}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* 렌터카 정보 (렌터카 선택시에만 표시) */}
                {formData.vehicle_category === 'rental' && (
                  <div className="space-y-4">
                    <h4 className="text-md font-medium text-gray-900 flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      렌터카 정보
                    </h4>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">렌터카 회사 *</label>
                      <input
                        type="text"
                        name="rental_company"
                        value={formData.rental_company}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="예: Hertz, Enterprise, Budget"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">일일 요금 ($)</label>
                      <input
                        type="number"
                        name="daily_rate"
                        value={formData.daily_rate}
                        onChange={handleInputChange}
                        min="0"
                        step="0.01"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0.00"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">렌탈 시작일</label>
                        <input
                          type="date"
                          name="rental_start_date"
                          value={formData.rental_start_date}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">렌탈 종료일</label>
                        <input
                          type="date"
                          name="rental_end_date"
                          value={formData.rental_end_date}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">픽업 장소</label>
                        <input
                          type="text"
                          name="rental_pickup_location"
                          value={formData.rental_pickup_location}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">반납 장소</label>
                        <input
                          type="text"
                          name="rental_return_location"
                          value={formData.rental_return_location}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">총 비용 ($)</label>
                      <input
                        type="number"
                        name="rental_total_cost"
                        value={formData.rental_total_cost}
                        onChange={handleInputChange}
                        min="0"
                        step="0.01"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">렌터카 상태</label>
                      <select
                        name="rental_status"
                        value={formData.rental_status}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="available">사용가능</option>
                        <option value="reserved">예약됨</option>
                        <option value="picked_up">픽업완료</option>
                        <option value="in_use">사용중</option>
                        <option value="returned">반납완료</option>
                        <option value="cancelled">취소됨</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">메모</label>
                      <textarea
                        name="rental_notes"
                        value={formData.rental_notes}
                        onChange={handleInputChange}
                        rows={3}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}

                {/* 관리 정보 (회사 차량일 때만 표시) */}
                {formData.vehicle_category === 'company' && (
                  <div className="space-y-4">
                    <h4 className="text-md font-medium text-gray-900 flex items-center">
                      <Wrench className="w-4 h-4 mr-2" />
                      관리 정보
                    </h4>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">엔진오일 교체 주기 (miles)</label>
                      <input
                        type="number"
                        name="engine_oil_change_cycle"
                        value={formData.engine_oil_change_cycle}
                        onChange={handleInputChange}
                        min="0"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">현재 마일리지 (miles)</label>
                      <input
                        type="number"
                        name="current_mileage"
                        value={formData.current_mileage}
                        onChange={handleInputChange}
                        min="0"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">최근 엔진오일 교체 마일리지</label>
                      <input
                        type="number"
                        name="recent_engine_oil_change_mileage"
                        value={formData.recent_engine_oil_change_mileage}
                        onChange={handleInputChange}
                        min="0"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">엔진오일 교체 비용 등록 시 자동 업데이트됩니다</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">차량 상태</label>
                      <select
                        name="vehicle_status"
                        value={formData.vehicle_status}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="운행 가능">운행 가능</option>
                        <option value="수리 중">수리 중</option>
                        <option value="대기 중">대기 중</option>
                        <option value="폐차">폐차</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">앞타이어 사이즈</label>
                        <input
                          type="text"
                          name="front_tire_size"
                          value={formData.front_tire_size}
                          onChange={handleInputChange}
                          placeholder="예: 205/55R16"
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">뒷타이어 사이즈</label>
                        <input
                          type="text"
                          name="rear_tire_size"
                          value={formData.rear_tire_size}
                          onChange={handleInputChange}
                          placeholder="예: 205/55R16"
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">윈드실드 와이퍼 사이즈</label>
                      <input
                        type="text"
                        name="windshield_wiper_size"
                        value={formData.windshield_wiper_size}
                        onChange={handleInputChange}
                        placeholder="예: 26인치"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">헤드라이트 모델</label>
                        <input
                          type="text"
                          name="headlight_model"
                          value={formData.headlight_model}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">헤드라이트 모델명</label>
                        <input
                          type="text"
                          name="headlight_model_name"
                          value={formData.headlight_model_name}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 할부 정보 (회사 차량일 때만 표시) */}
              {formData.vehicle_category === 'company' && (
                <div className="mt-6 space-y-4">
                  <h4 className="text-md font-medium text-gray-900 flex items-center">
                    <DollarSign className="w-4 h-4 mr-2" />
                    할부 정보
                  </h4>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="is_installment"
                      checked={formData.is_installment}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">할부 여부</label>
                  </div>

                  {formData.is_installment && (
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">할부 금액 (USD)</label>
                        <input
                          type="number"
                          name="installment_amount"
                          value={formData.installment_amount}
                          onChange={handleInputChange}
                          min="0"
                          step="0.01"
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">이자율 (%)</label>
                        <input
                          type="number"
                          name="interest_rate"
                          value={formData.interest_rate}
                          onChange={handleInputChange}
                          min="0"
                          step="0.01"
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">월 납부금 (USD)</label>
                        <input
                          type="number"
                          name="monthly_payment"
                          value={formData.monthly_payment}
                          onChange={handleInputChange}
                          min="0"
                          step="0.01"
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">추가 납부금 (USD)</label>
                        <input
                          type="number"
                          name="additional_payment"
                          value={formData.additional_payment}
                          onChange={handleInputChange}
                          min="0"
                          step="0.01"
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">납부 마감일</label>
                        <input
                          type="date"
                          name="payment_due_date"
                          value={formData.payment_due_date}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">할부 시작일</label>
                        <input
                          type="date"
                          name="installment_start_date"
                          value={formData.installment_start_date}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">할부 종료일</label>
                        <input
                          type="date"
                          name="installment_end_date"
                          value={formData.installment_end_date}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  {formData.is_installment && (
                    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-md">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">총 납부 금액</label>
                        <p className="mt-1 text-sm text-gray-900">${calculateTotalPayment().toLocaleString()} (자동 계산)</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">남은 할부금</label>
                        <p className="mt-1 text-sm text-gray-900">${calculateRemainingAmount().toLocaleString()} (자동 계산)</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 차량 이미지 */}
              <div className="mt-6 space-y-4">
                <h4 className="text-md font-medium text-gray-900 flex items-center">
                  <Upload className="w-4 h-4 mr-2" />
                  차량 이미지
                </h4>

                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center"
                  onPaste={handlePasteImage}
                >
                  {imagePreview ? (
                    <div className="space-y-4">
                      <img
                        src={imagePreview}
                        alt="차량 이미지 미리보기"
                        className="mx-auto h-32 w-auto rounded-lg object-cover"
                      />
                      <div className="flex justify-center space-x-2">
                        <label className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                          <Upload className="w-4 h-4 mr-2" />
                          이미지 변경
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setImagePreview('')
                            setImageFile(null)
                          }}
                          className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          삭제
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Upload className="mx-auto h-12 w-12 text-gray-400" />
                      <div>
                        <label className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                          <Upload className="w-4 h-4 mr-2" />
                          이미지 추가
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <p className="text-sm text-gray-500">차량 사진을 업로드하세요</p>
                      <p className="text-xs text-gray-400">팁: Ctrl+V로 클립보드의 이미지를 직접 붙여넣을 수 있습니다!</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="submit"
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
              >
                저장
              </button>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              >
                취소
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}