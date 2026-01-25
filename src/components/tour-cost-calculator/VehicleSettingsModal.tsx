'use client'

import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'

export type VehicleRentalSetting = {
  id: string
  vehicle_type: 'minivan' | '9seater' | '13seater'
  daily_rental_rate: number
  mpg: number
}

interface VehicleSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  vehicleSettings: VehicleRentalSetting[]
  onSave: (type: 'minivan' | '9seater' | '13seater', dailyRate: number, mpg: number) => Promise<void>
  gasPrice: number
  onGasPriceChange: (price: number) => void
}

const VehicleSettingsModal: React.FC<VehicleSettingsModalProps> = ({
  isOpen,
  onClose,
  vehicleSettings,
  onSave,
  gasPrice,
  onGasPriceChange
}) => {
  const [editingType, setEditingType] = useState<'minivan' | '9seater' | '13seater' | null>(null)
  const [dailyRate, setDailyRate] = useState<number>(0)
  const [mpg, setMpg] = useState<number>(0)

  useEffect(() => {
    if (editingType) {
      const setting = vehicleSettings.find(s => s.vehicle_type === editingType)
      if (setting) {
        setDailyRate(setting.daily_rental_rate)
        setMpg(setting.mpg)
      } else {
        setDailyRate(0)
        setMpg(0)
      }
    }
  }, [editingType, vehicleSettings])

  if (!isOpen) return null

  const vehicleTypes: Array<{ type: 'minivan' | '9seater' | '13seater'; label: string }> = [
    { type: 'minivan', label: '미니밴' },
    { type: '9seater', label: '9인승' },
    { type: '13seater', label: '13인승' }
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">차량 렌트비 설정</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          {/* 현재 기름값 입력 */}
          <div className="border rounded-lg p-4 bg-blue-50">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              현재 기름값 (갤런당 USD)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={gasPrice}
              onChange={(e) => onGasPriceChange(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            />
          </div>

          {vehicleTypes.map(({ type, label }) => {
            const setting = vehicleSettings.find(s => s.vehicle_type === type)
            const isEditing = editingType === type

            return (
              <div key={type} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{label}</h4>
                  {!isEditing && (
                    <button
                      onClick={() => setEditingType(type)}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      편집
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        일일 평균 렌트비 (USD)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={dailyRate}
                        onChange={(e) => setDailyRate(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        MPG (Miles Per Gallon)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={mpg}
                        onChange={(e) => setMpg(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onSave(type, dailyRate, mpg)}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => {
                          setEditingType(null)
                          const setting = vehicleSettings.find(s => s.vehicle_type === type)
                          if (setting) {
                            setDailyRate(setting.daily_rental_rate)
                            setMpg(setting.mpg)
                          }
                        }}
                        className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-600">
                    <div>일일 렌트비: ${setting?.daily_rental_rate.toFixed(2) || '0.00'}</div>
                    <div>MPG: {setting?.mpg.toFixed(2) || '0.00'}</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-6">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

export default VehicleSettingsModal
