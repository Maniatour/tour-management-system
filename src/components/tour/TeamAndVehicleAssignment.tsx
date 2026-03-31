import React, { useState, useRef, useEffect, useMemo } from 'react'
import { User, Users, Car, Save, ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ConnectionStatusLabel } from './TourUIComponents'
import { isVehicleShownInTeamAssignmentDropdown } from '@/utils/tourUtils'

interface TeamMember {
  id: string
  name_ko: string
  nick_name?: string | null
  email: string
  position: string
  is_active: boolean
}

interface Vehicle {
  id: string
  vehicle_number: string | null
  nick?: string | null
  vehicle_type: string | null
  status: string | null
  vehicle_category?: string | null
  rental_company?: string | null
  rental_start_date?: string | null
  rental_end_date?: string | null
}

interface TeamAndVehicleAssignmentProps {
  /** 투어일 (YYYY-MM-DD). 렌터카 드롭다운 필터에 사용 */
  tourDate?: string | null
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

/** 드롭다운 열었을 때 내부에 활성/비활성 탭이 있는 팀원 선택 드롭다운 */
function MemberSelectWithTabs({
  value,
  onChange,
  activeMembers,
  inactiveMembers,
  placeholder,
  getDisplayName,
  getTeamMemberName
}: {
  value: string
  onChange: (email: string) => void
  activeMembers: TeamMember[]
  inactiveMembers: TeamMember[]
  placeholder: string
  getDisplayName: (m: TeamMember) => string
  getTeamMemberName: (email: string) => string
}) {
  const t = useTranslations('tours.teamAndVehicle')
  const [isOpen, setIsOpen] = useState(false)
  const [tab, setTab] = useState<'active' | 'inactive'>('active')
  const [searchQuery, setSearchQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const onOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [isOpen])

  const members = tab === 'active' ? activeMembers : inactiveMembers
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredMembers = normalizedQuery
    ? members.filter((member) => {
        const displayName = getDisplayName(member).toLowerCase()
        const email = (member.email || '').toLowerCase()
        const nameKo = (member.name_ko || '').toLowerCase()
        const nickName = (member.nick_name || '').toLowerCase()
        return (
          displayName.includes(normalizedQuery) ||
          email.includes(normalizedQuery) ||
          nameKo.includes(normalizedQuery) ||
          nickName.includes(normalizedQuery)
        )
      })
    : members
  const displayText = value ? getTeamMemberName(value) : placeholder

  return (
    <div className="relative flex-1 min-w-0" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="w-full text-left text-sm border border-gray-300 rounded px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center justify-between gap-2"
      >
        <span className={value ? 'text-gray-900' : 'text-gray-500'}>{displayText}</span>
        <ChevronDown className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[200px] bg-white border border-gray-200 rounded-lg shadow-lg py-1">
          {/* 드롭다운 내부: 활성 | 비활성 탭 */}
          <div className="flex border-b border-gray-200 px-2 pb-1 mb-1">
            <button
              type="button"
              onClick={() => setTab('active')}
              className={`flex-1 py-1.5 text-sm font-medium rounded ${tab === 'active' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {t('memberTabActive')}
            </button>
            <button
              type="button"
              onClick={() => setTab('inactive')}
              className={`flex-1 py-1.5 text-sm font-medium rounded ${tab === 'inactive' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {t('memberTabInactive')}
            </button>
          </div>
          <div className="px-2 pb-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="이름/닉네임/이메일 검색"
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          {/* 선택 해제 */}
          <button
            type="button"
            onClick={() => { onChange(''); setIsOpen(false); setSearchQuery(''); }}
            className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
          >
            {placeholder}
          </button>
          {/* 탭별 목록 */}
          <div className="max-h-48 overflow-y-auto">
            {filteredMembers.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-400">{tab === 'active' ? t('memberTabActive') : t('memberTabInactive')} 팀원 없음</div>
            ) : (
              filteredMembers.map((member) => (
                <button
                  key={member.email}
                  type="button"
                  onClick={() => { onChange(member.email); setIsOpen(false); setSearchQuery(''); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${value === member.email ? 'bg-blue-50 text-blue-800' : 'text-gray-900'}`}
                >
                  {getDisplayName(member)}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export const TeamAndVehicleAssignment: React.FC<TeamAndVehicleAssignmentProps> = ({
  tourDate,
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

  /** 회사·개인(비렌트)은 항상, 렌터카는 투어일이 렌트 구간(시작~종료+3일)에 들어갈 때만. 이미 배정된 차량은 목록에 없어도 옵션에 유지 */
  const vehiclesForSelect = useMemo(() => {
    const filtered = vehicles.filter((v) => isVehicleShownInTeamAssignmentDropdown(v, tourDate))
    if (!selectedVehicleId) return filtered
    if (filtered.some((v) => v.id === selectedVehicleId)) return filtered
    const current = vehicles.find((v) => v.id === selectedVehicleId)
    return current ? [...filtered, current] : filtered
  }, [vehicles, tourDate, selectedVehicleId])

  const isMemberActive = (member: TeamMember): boolean => {
    if (typeof member.is_active === 'boolean') return member.is_active
    // null/undefined: DB 미입력·구 데이터는 활성으로 간주 (비활성 탭은 is_active === false 만)
    if (member.is_active == null) return true
    const normalized = String(member.is_active).trim().toLowerCase()
    if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'f') return false
    return normalized === 'true' || normalized === '1' || normalized === 't' || normalized === 'yes'
  }

  const positionFilter = (member: TeamMember) => {
    if (!member.position) return true
    const position = member.position.toLowerCase()
    return position.includes('tour') && position.includes('guide') ||
           position.includes('guide') ||
           position.includes('가이드') ||
           position.includes('driver') ||
           position.includes('드라이버') ||
           position.includes('운전')
  }

  /** 활성 팀원만 (가이드/드라이버 포지션) */
  const getFilteredTeamMembersActive = (excludeEmail?: string) =>
    teamMembers.filter((m) => {
      if (!isMemberActive(m)) return false
      if (excludeEmail && m.email === excludeEmail) return false
      return positionFilter(m)
    })

  /** 비활성 팀원만 (가이드/드라이버 포지션) */
  const getFilteredTeamMembersInactive = (excludeEmail?: string) =>
    teamMembers.filter((m) => {
      if (isMemberActive(m)) return false
      if (excludeEmail && m.email === excludeEmail) return false
      return positionFilter(m)
    })

  const getDisplayName = (member: { name_ko: string; nick_name?: string | null; email: string }) => {
    // nick_name 우선, 없으면 name_ko, 없으면 이메일 표시
    return member.nick_name || member.name_ko || member.email
  }

  const guideDriverCount = teamMembers.filter((m) => {
    if (!isMemberActive(m)) return false
    return positionFilter(m)
  }).length

  const formatRentalDateShort = (dateStr?: string | null) => {
    if (!dateStr) return ''
    const raw = String(dateStr).slice(0, 10)
    const [year, month, day] = raw.split('-')
    if (!year || !month || !day) return ''
    const m = Number(month)
    const d = Number(day)
    if (Number.isNaN(m) || Number.isNaN(d)) return ''
    return `${m}/${d}`
  }

  const getVehicleOptionLabel = (vehicle: Vehicle) => {
    const baseLabel = `${(vehicle.nick && vehicle.nick.trim()) || vehicle.vehicle_number || '번호 없음'} - ${vehicle.vehicle_type || '타입 없음'}`
    if (vehicle.vehicle_category === 'company') return baseLabel

    const start = formatRentalDateShort(vehicle.rental_start_date)
    const end = formatRentalDateShort(vehicle.rental_end_date)
    if (start && end) {
      return `${baseLabel} (${start}~${end})`
    }
    return baseLabel
  }

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
              {/* 가이드 선택 (드롭다운 열면 활성/비활성 탭) */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                <label className="text-sm font-medium text-gray-700 flex-shrink-0 whitespace-nowrap">{t('guide')}</label>
                <MemberSelectWithTabs
                  value={selectedGuide || ''}
                  onChange={onGuideSelect}
                  activeMembers={getFilteredTeamMembersActive()}
                  inactiveMembers={getFilteredTeamMembersInactive()}
                  placeholder={t('selectGuide')}
                  getDisplayName={getDisplayName}
                  getTeamMemberName={getTeamMemberName}
                />
                <div className="flex items-center space-x-2 relative flex-shrink-0">
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

              {/* 2차 가이드/드라이버 선택 (드롭다운 열면 활성/비활성 탭) */}
              {(teamType === '2guide' || teamType === 'guide+driver') && (
                <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                  <label className="text-sm font-medium text-gray-700 flex-shrink-0 whitespace-nowrap">
                    {teamType === '2guide' ? t('secondGuide') : t('driver')}
                  </label>
                  <MemberSelectWithTabs
                    value={selectedAssistant || ''}
                    onChange={onAssistantSelect}
                    activeMembers={getFilteredTeamMembersActive(selectedGuide)}
                    inactiveMembers={getFilteredTeamMembersInactive(selectedGuide)}
                    placeholder={t('selectGuide')}
                    getDisplayName={getDisplayName}
                    getTeamMemberName={getTeamMemberName}
                  />
                  <div className="flex items-center space-x-2 relative flex-shrink-0">
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
              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                <label className="text-sm font-medium text-gray-700 flex-shrink-0 whitespace-nowrap">{t('vehicle')}</label>
                <select
                  value={selectedVehicleId || ''}
                  onChange={(e) => onVehicleSelect(e.target.value)}
                  className="flex-1 min-w-0 text-sm border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={vehiclesLoading}
                >
                  <option value="">{t('selectVehicle')}</option>
                  {vehiclesForSelect.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {getVehicleOptionLabel(vehicle)}
                    </option>
                  ))}
                </select>
                {vehiclesError && (
                  <span className="text-sm text-red-600">{vehiclesError}</span>
                )}
              </div>

              {/* 마일리지 입력 */}
              {selectedVehicleId && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <label className="text-sm font-medium text-gray-700 flex-shrink-0 whitespace-nowrap">{t('start')}</label>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <input
                        type="number"
                        value={startMileage || ''}
                        onChange={(e) => onStartMileageChange(Number(e.target.value) || 0)}
                        className="text-sm border rounded px-2 py-1 flex-1 min-w-0 max-w-full text-gray-900 border-gray-300"
                        placeholder="0"
                        min="0"
                        disabled={isMileageLoading}
                      />
                      <span className="text-sm text-gray-500 flex-shrink-0">miles</span>
                      {isMileageLoading && (
                        <span className="text-sm text-gray-500 flex-shrink-0">로딩...</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <label className="text-sm font-medium text-gray-700 flex-shrink-0 whitespace-nowrap">{t('end')}</label>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <input
                        type="number"
                        value={endMileage || ''}
                        onChange={(e) => onEndMileageChange(Number(e.target.value) || 0)}
                        className="text-sm border rounded px-2 py-1 flex-1 min-w-0 max-w-full text-gray-900 border-gray-300"
                        placeholder="0"
                        min="0"
                      />
                      <span className="text-sm text-gray-500 flex-shrink-0">miles</span>
                    </div>
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
