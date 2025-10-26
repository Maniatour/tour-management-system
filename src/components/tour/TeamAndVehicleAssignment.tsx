import React, { useState } from 'react'
import { User, Users, Car, Save } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ConnectionStatusLabel } from './TourUIComponents'

interface TeamMember {
  id: string
  name_ko: string
  email: string
  position: string
  is_active: boolean
}

interface Vehicle {
  id: string
  vehicle_number: string | null
  vehicle_type: string | null
  vehicle_status: string | null
}

interface TeamAndVehicleAssignmentProps {
  teamMembers: TeamMember[]
  vehicles: Vehicle[]
  vehiclesLoading: boolean
  vehiclesError: string
  teamType: '1guide' | '2guide' | 'guide+driver'
  selectedGuide: string
  selectedAssistant: string
  selectedVehicleId: string
  guideFee: number
  assistantFee: number
  isGuideFeeFromTour: boolean
  isAssistantFeeFromTour: boolean
  isGuideFeeFromDefault: boolean
  isAssistantFeeFromDefault: boolean
  startMileage: number
  endMileage: number
  isMileageLoading: boolean
  expandedSections: Set<string>
  connectionStatus: { team: boolean; vehicles: boolean }
  onToggleSection: (sectionId: string) => void
  onTeamTypeChange: (type: '1guide' | '2guide' | 'guide+driver') => void
  onGuideSelect: (email: string) => void
  onAssistantSelect: (email: string) => void
  onVehicleSelect: (vehicleId: string) => void
  onGuideFeeChange: (fee: number) => void
  onAssistantFeeChange: (fee: number) => void
  onStartMileageChange: (mileage: number) => void
  onEndMileageChange: (mileage: number) => void
  onSave: () => Promise<void>
  onLoadTeamMembersFallback: () => void
  onFetchVehicles: () => void
  getTeamMemberName: (email: string) => string
  getVehicleName: (vehicleId: string) => string
}

export const TeamAndVehicleAssignment: React.FC<TeamAndVehicleAssignmentProps> = ({
  teamMembers,
  vehicles,
  vehiclesLoading,
  vehiclesError,
  teamType,
  selectedGuide,
  selectedAssistant,
  selectedVehicleId,
  guideFee,
  assistantFee,
  isGuideFeeFromTour,
  isAssistantFeeFromTour,
  isGuideFeeFromDefault,
  isAssistantFeeFromDefault,
  startMileage,
  endMileage,
  isMileageLoading,
  expandedSections,
  connectionStatus,
  onToggleSection,
  onTeamTypeChange,
  onGuideSelect,
  onAssistantSelect,
  onVehicleSelect,
  onGuideFeeChange,
  onAssistantFeeChange,
  onStartMileageChange,
  onEndMileageChange,
  onSave,
  onLoadTeamMembersFallback,
  onFetchVehicles,
  getTeamMemberName,
  getVehicleName
}) => {
  const t = useTranslations('tours.teamAndVehicle')
  const [isSaving, setIsSaving] = useState(false)

  const getFilteredTeamMembers = (excludeEmail?: string) => {
    return teamMembers.filter((member) => {
      // is_active가 TRUE인 사람만 포함 (대소문자 구별 없이)
      if (String(member.is_active).toLowerCase() !== 'true') return false
      
      // 제외할 이메일이 있으면 제외
      if (excludeEmail && member.email === excludeEmail) return false
      
      // position이 없으면 포함
      if (!member.position) return true
      
      // position 필터링
      const position = member.position.toLowerCase()
      return position.includes('tour') && position.includes('guide') ||
             position.includes('guide') ||
             position.includes('가이드') ||
             position.includes('driver') ||
             position.includes('드라이버') ||
             position.includes('운전')
    })
  }

  const getDisplayName = (member: { name_ko: string; email: string }) => {
    // name_ko만 표시, 없으면 이메일 표시
    return member.name_ko || member.email
  }

  const guideDriverCount = teamMembers.filter((m) => {
    // is_active가 TRUE인 사람만 포함 (대소문자 구별 없이)
    if (String(m.is_active).toLowerCase() !== 'true') return false
    
    if (!m.position) return true
    const position = m.position.toLowerCase()
    return position.includes('tour') && position.includes('guide') ||
           position.includes('guide') ||
           position.includes('가이드') ||
           position.includes('driver') ||
           position.includes('드라이버') ||
           position.includes('운전')
  }).length

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave()
    } finally {
      setIsSaving(false)
    }
  }

  const hasChanges = () => {
    // 변경사항이 있는지 확인하는 로직 (필요에 따라 구현)
    return true // 임시로 항상 true 반환
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => onToggleSection('team-vehicle-assignment')}
        >
          <h2 className="text-md font-semibold text-gray-900 flex items-center">
            {t('title')}
            <ConnectionStatusLabel status={connectionStatus.team} section={t('sectionTeam')} />
            <ConnectionStatusLabel status={connectionStatus.vehicles} section={t('sectionVehicle')} />
            {teamMembers.length === 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onLoadTeamMembersFallback()
                }}
                className="ml-2 px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200"
              >
                팀 멤버 다시 로드
              </button>
            )}
          </h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleSave()
              }}
              disabled={isSaving || !hasChanges()}
              className={`px-4 py-2 text-sm font-medium rounded-md flex items-center space-x-2 ${
                isSaving || !hasChanges()
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500'
              }`}
            >
              <Save size={16} />
              <span>{isSaving ? t('saving') : t('save')}</span>
            </button>
            <svg 
              className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
                expandedSections.has('team-vehicle-assignment') ? 'rotate-180' : ''
              }`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        
        {expandedSections.has('team-vehicle-assignment') && (
          <div className="mt-4 space-y-4">
            {/* 팀 타입 선택 */}
            <div className="flex space-x-2">
              <button 
                onClick={() => onTeamTypeChange('1guide')}
                className={`px-3 py-2 text-sm rounded flex items-center space-x-2 ${
                  teamType === '1guide' 
                    ? 'bg-blue-100 text-blue-800 border border-blue-300' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300'
                }`}
              >
                <User size={16} />
                <span>{t('oneGuide')}</span>
              </button>
              
              <button 
                onClick={() => onTeamTypeChange('2guide')}
                className={`px-3 py-2 text-sm rounded flex items-center space-x-2 ${
                  teamType === '2guide' 
                    ? 'bg-blue-100 text-blue-800 border border-blue-300' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300'
                }`}
              >
                <Users size={16} />
                <span>{t('twoGuide')}</span>
              </button>
              
              <button 
                onClick={() => onTeamTypeChange('guide+driver')}
                className={`px-3 py-2 text-sm rounded flex items-center space-x-2 ${
                  teamType === 'guide+driver' 
                    ? 'bg-blue-100 text-blue-800 border border-blue-300' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300'
                }`}
              >
                <Car size={16} />
                <span>{t('guideDriver')}</span>
              </button>
            </div>

            <div className="space-y-4">
              {/* 가이드 선택 */}
              <div className="flex items-center space-x-4">
                <label className="w-20 text-sm font-medium text-gray-700">{t('guide')}</label>
                <select
                  value={selectedGuide || ''}
                  onChange={(e) => onGuideSelect(e.target.value)}
                  className="flex-1 text-sm border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">{t('selectGuide')}</option>
                  {getFilteredTeamMembers().map((member) => (
                    <option key={member.email} value={member.email}>
                      {getDisplayName(member)}
                    </option>
                  ))}
                </select>
                <div className="flex items-center space-x-2 relative">
                  <input
                    type="number"
                    value={guideFee || ''}
                    onChange={(e) => onGuideFeeChange(Number(e.target.value) || 0)}
                    className={`text-sm border rounded px-2 py-1 w-24 pl-6 ${
                      isGuideFeeFromDefault ? 'text-blue-600 bg-blue-50 border-blue-300' : 
                      isGuideFeeFromTour ? 'text-green-600 bg-green-50 border-green-300' : 
                      'text-gray-900 border-gray-300'
                    }`}
                    placeholder="0"
                    min="0"
                    step="0.01"
                    title={isGuideFeeFromDefault ? '기본값 (수정 시 자동 저장)' : isGuideFeeFromTour ? '투어에 저장됨' : '수정 가능'}
                  />
                  <span className="absolute left-2 text-sm text-gray-500 pointer-events-none">$</span>
                  {isGuideFeeFromDefault && (
                    <span className="text-sm text-blue-600" title="기본값">
                      📋
                    </span>
                  )}
                  {isGuideFeeFromTour && (
                    <span className="text-sm text-green-600" title="저장된 값">
                      💾
                    </span>
                  )}
                </div>
              </div>

              {/* 2차 가이드/드라이버 선택 */}
              {(teamType === '2guide' || teamType === 'guide+driver') && (
                <div className="flex items-center space-x-4">
                  <label className="w-20 text-sm font-medium text-gray-700">
                    {teamType === '2guide' ? t('secondGuide') : t('driver')}
                  </label>
                  <select
                    value={selectedAssistant || ''}
                    onChange={(e) => onAssistantSelect(e.target.value)}
                    className="flex-1 text-sm border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">{t('selectGuide')}</option>
                    {getFilteredTeamMembers(selectedGuide).map((member) => (
                      <option key={member.email} value={member.email}>
                        {getDisplayName(member)}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center space-x-2 relative">
                    <input
                      type="number"
                      value={assistantFee || ''}
                      onChange={(e) => onAssistantFeeChange(Number(e.target.value) || 0)}
                      className={`text-sm border rounded px-2 py-1 w-24 pl-6 ${
                        isAssistantFeeFromDefault ? 'text-blue-600 bg-blue-50 border-blue-300' : 
                        isAssistantFeeFromTour ? 'text-green-600 bg-green-50 border-green-300' : 
                        'text-gray-900 border-gray-300'
                      }`}
                      placeholder="0"
                      min="0"
                      step="0.01"
                      title={isAssistantFeeFromDefault ? '기본값 (수정 시 자동 저장)' : isAssistantFeeFromTour ? '투어에 저장됨' : '수정 가능'}
                    />
                    <span className="absolute left-2 text-sm text-gray-500 pointer-events-none">$</span>
                    {isAssistantFeeFromDefault && (
                      <span className="text-sm text-blue-600" title="기본값">
                        📋
                      </span>
                    )}
                    {isAssistantFeeFromTour && (
                      <span className="text-sm text-green-600" title="저장된 값">
                        💾
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* 차량 선택 */}
              <div className="flex items-center space-x-4">
                <label className="w-20 text-sm font-medium text-gray-700">{t('vehicle')}</label>
                <select
                  value={selectedVehicleId || ''}
                  onChange={(e) => onVehicleSelect(e.target.value)}
                  className="flex-1 text-sm border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={vehiclesLoading}
                >
                  <option value="">{t('selectVehicle')}</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.vehicle_number || '번호 없음'} - {vehicle.vehicle_type || '타입 없음'}
                    </option>
                  ))}
                </select>
                {vehiclesError && (
                  <span className="text-sm text-red-600">{vehiclesError}</span>
                )}
              </div>

              {/* 마일리지 입력 */}
              {selectedVehicleId && (
                <div className="flex items-center space-x-4">
                  <label className="w-20 text-sm font-medium text-gray-700">{t('start')}</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      value={startMileage || ''}
                      onChange={(e) => onStartMileageChange(Number(e.target.value) || 0)}
                      className="text-sm border rounded px-2 py-1 w-32 text-gray-900 border-gray-300"
                      placeholder="0"
                      min="0"
                      disabled={isMileageLoading}
                    />
                    <span className="text-sm text-gray-500">miles</span>
                    {isMileageLoading && (
                      <span className="text-sm text-gray-500">로딩...</span>
                    )}
                  </div>
                  
                  <label className="w-20 text-sm font-medium text-gray-700">{t('end')}</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      value={endMileage || ''}
                      onChange={(e) => onEndMileageChange(Number(e.target.value) || 0)}
                      className="text-sm border rounded px-2 py-1 w-32 text-gray-900 border-gray-300"
                      placeholder="0"
                      min="0"
                    />
                    <span className="text-sm text-gray-500">miles</span>
                  </div>
                </div>
              )}
            </div>

            {/* 현재 배정된 팀원 및 차량 표시 */}
            {(selectedGuide || selectedAssistant || selectedVehicleId) && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="font-medium text-gray-700 mb-2">
                  {t('currentlyAssigned')} ({teamType === '1guide' ? t('oneGuide') : teamType === '2guide' ? t('twoGuide') : t('guideDriver')}):
                </div>
                <div className="space-y-1 text-sm">
                  {selectedGuide && (
                    <div className="text-gray-600 flex justify-between">
                      <span>{t('guide')}: {getTeamMemberName(selectedGuide)}</span>
                      {guideFee > 0 && (
                        <span className={`flex items-center space-x-1 ${
                          isGuideFeeFromTour ? 'text-green-600' : 
                          isGuideFeeFromDefault ? 'text-blue-600' : 
                          'text-gray-600'
                        }`}>
                          <span>${guideFee}</span>
                          {isGuideFeeFromTour && <span title="저장된 값">💾</span>}
                          {isGuideFeeFromDefault && <span title="기본값">📋</span>}
                        </span>
                      )}
                    </div>
                  )}
                  {selectedAssistant && (
                    <div className="text-gray-600 flex justify-between">
                      <span>
                        {teamType === '2guide' ? t('secondGuide') : t('driver')}: {getTeamMemberName(selectedAssistant)}
                      </span>
                      {assistantFee > 0 && (
                        <span className={`flex items-center space-x-1 ${
                          isAssistantFeeFromTour ? 'text-green-600' : 
                          isAssistantFeeFromDefault ? 'text-blue-600' : 
                          'text-gray-600'
                        }`}>
                          <span>${assistantFee}</span>
                          {isAssistantFeeFromTour && <span title="저장된 값">💾</span>}
                          {isAssistantFeeFromDefault && <span title="기본값">📋</span>}
                        </span>
                      )}
                    </div>
                  )}
                  {selectedVehicleId && (
                    <div className="text-gray-600 flex justify-between">
                      <span>{t('vehicle')}: {getVehicleName(selectedVehicleId)}</span>
                      {(startMileage > 0 || endMileage > 0) && (
                        <span className="text-gray-600">
                          {startMileage > 0 && `${startMileage}miles`}
                          {startMileage > 0 && endMileage > 0 && ' → '}
                          {endMileage > 0 && `${endMileage}miles`}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
