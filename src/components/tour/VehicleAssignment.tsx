import React from 'react'
import { ConnectionStatusLabel } from './TourUIComponents'

interface VehicleAssignmentProps {
  vehicles: any[]
  vehiclesLoading: boolean
  vehiclesError: string | null
  selectedVehicleId: string
  assignedVehicle: any
  expandedSections: Set<string>
  connectionStatus: { vehicles: boolean }
  onToggleSection: (sectionId: string) => void
  onVehicleSelect: (vehicleId: string) => void
  onFetchVehicles: () => void
}

export const VehicleAssignment: React.FC<VehicleAssignmentProps> = ({
  vehicles,
  vehiclesLoading,
  vehiclesError,
  selectedVehicleId,
  assignedVehicle,
  expandedSections,
  connectionStatus,
  onToggleSection,
  onVehicleSelect,
  onFetchVehicles
}) => {
  const getVehicleDisplayName = (vehicle: any) => {
    if (vehicle.vehicle_category === 'company') {
      return `${vehicle.vehicle_number} - ${vehicle.vehicle_type} (${vehicle.capacity}인승)`
    } else {
      return `${vehicle.rental_company} - ${vehicle.vehicle_type} (${vehicle.capacity}인승) - ${vehicle.rental_start_date} ~ ${vehicle.rental_end_date}`
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => onToggleSection('vehicle-assignment')}
        >
          <h2 className="text-md font-semibold text-gray-900 flex items-center">
            차량 배정
            <ConnectionStatusLabel status={connectionStatus.vehicles} section="차량" />
          </h2>
          <svg 
            className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
              expandedSections.has('vehicle-assignment') ? 'rotate-180' : ''
            }`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        
        {expandedSections.has('vehicle-assignment') && (
          <div className="mt-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 text-sm">차량 선택:</span>
              {vehiclesLoading ? (
                <div className="text-xs text-gray-500 flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-500"></div>
                  <span>Loading vehicle data...</span>
                </div>
              ) : vehiclesError ? (
                <div className="text-xs text-red-500 flex items-center space-x-2">
                  <span>❌</span>
                  <span>{vehiclesError}</span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      onFetchVehicles()
                    }}
                    className="text-blue-500 hover:text-blue-700 underline"
                  >
                    다시 시도
                  </button>
                </div>
              ) : (
                <select
                  value={selectedVehicleId}
                  onChange={(e) => onVehicleSelect(e.target.value)}
                  className="text-xs border rounded px-2 py-1 min-w-48"
                  disabled={vehiclesLoading}
                >
                  <option value="">
                    {vehicles.length === 0 
                      ? "사용 가능한 차량이 없습니다" 
                      : `차량을 선택하세요 (${vehicles.length}대 사용 가능)`
                    }
                  </option>
                  {vehicles.map((vehicle: any) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {getVehicleDisplayName(vehicle)}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* 현재 배정된 차량 정보 표시 */}
            {assignedVehicle && (
              <div className="p-2 bg-blue-50 rounded text-xs">
                <div className="font-medium text-blue-700 mb-1">현재 배정된 차량:</div>
                <div className="text-blue-600">
                  {getVehicleDisplayName(assignedVehicle)}
                </div>
              </div>
            )}

            {/* 차량 데이터 상태 정보 */}
            {!vehiclesLoading && !vehiclesError && (
              <div className="text-xs text-gray-500">
                {vehicles.length === 0 ? (
                  <div className="p-2 bg-yellow-50 rounded border border-yellow-200">
                    <div className="font-medium text-yellow-700 mb-1">⚠️ 사용 가능한 차량이 없습니다</div>
                    <div className="text-yellow-600">
                      • 같은 날짜의 다른 투어에서 이미 배정된 차량들이 있습니다<br/>
                      • 렌터카의 경우 투어 날짜가 렌탈 기간에 포함되지 않을 수 있습니다<br/>
                      • 차량 데이터를 새로고침하려면 페이지를 다시 로드해주세요
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-600">
                    총 {vehicles.length}대의 차량이 사용 가능합니다
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
