import React from 'react'
import { User, Users, Car } from 'lucide-react'
import { ConnectionStatusLabel } from './TourUIComponents'

interface TeamCompositionProps {
  teamMembers: Array<{
    id: string
    name_ko: string
    email: string
    position: string
    is_active: boolean
  }>
  teamType: '1guide' | '2guide' | 'guide+driver'
  selectedGuide: string
  selectedAssistant: string
  guideFee: number
  assistantFee: number
  isGuideFeeFromTour: boolean
  isAssistantFeeFromTour: boolean
  isGuideFeeFromDefault: boolean
  isAssistantFeeFromDefault: boolean
  expandedSections: Set<string>
  connectionStatus: { team: boolean }
  onToggleSection: (sectionId: string) => void
  onTeamTypeChange: (type: '1guide' | '2guide' | 'guide+driver') => void
  onGuideSelect: (email: string) => void
  onAssistantSelect: (email: string) => void
  onGuideFeeChange: (fee: number) => void
  onAssistantFeeChange: (fee: number) => void
  onLoadTeamMembersFallback: () => void
  getTeamMemberName: (email: string) => string
}

export const TeamComposition: React.FC<TeamCompositionProps> = ({
  teamMembers,
  teamType,
  selectedGuide,
  selectedAssistant,
  guideFee,
  assistantFee,
  isGuideFeeFromTour,
  isAssistantFeeFromTour,
  isGuideFeeFromDefault,
  isAssistantFeeFromDefault,
  expandedSections,
  connectionStatus,
  onToggleSection,
  onTeamTypeChange,
  onGuideSelect,
  onAssistantSelect,
  onGuideFeeChange,
  onAssistantFeeChange,
  onLoadTeamMembersFallback,
  getTeamMemberName
}) => {
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

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => onToggleSection('team-composition')}
        >
          <h2 className="text-md font-semibold text-gray-900 flex items-center">
            팀 구성
            <ConnectionStatusLabel status={connectionStatus.team} section="팀" />
            <span className="ml-2 text-xs text-gray-500">
              ({teamMembers.length}명 로드됨, 가이드/드라이버 {guideDriverCount}명)
            </span>
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
          <svg 
            className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
              expandedSections.has('team-composition') ? 'rotate-180' : ''
            }`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        
        {expandedSections.has('team-composition') && (
          <div className="mt-4 space-y-3">
            {/* 팀 타입 선택 */}
            <div className="flex space-x-2">
              <button 
                onClick={() => onTeamTypeChange('1guide')}
                className={`px-2 py-1 text-xs rounded flex items-center space-x-1 ${
                  teamType === '1guide' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <User size={12} />
                <span>1가이드</span>
              </button>
              
              <button 
                onClick={() => onTeamTypeChange('2guide')}
                className={`px-2 py-1 text-xs rounded flex items-center space-x-1 ${
                  teamType === '2guide' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Users size={12} />
                <span>2가이드</span>
              </button>
              
              <button 
                onClick={() => onTeamTypeChange('guide+driver')}
                className={`px-2 py-1 text-xs rounded flex items-center space-x-1 ${
                  teamType === 'guide+driver' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Car size={12} />
                <span>가이드+드라이버</span>
              </button>
            </div>

            {/* 가이드 선택 */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 text-sm">가이드:</span>
                <div className="flex items-center space-x-2">
                  <select
                    value={selectedGuide}
                    onChange={(e) => onGuideSelect(e.target.value)}
                    className="text-xs border rounded px-2 py-1 min-w-32"
                  >
                    <option value="">가이드 선택</option>
                    {getFilteredTeamMembers().map((member) => (
                      <option key={member.email} value={member.email}>
                        {getDisplayName(member)}
                      </option>
                    ))}
                  </select>
                    <div className="flex items-center space-x-1">
                      <span className="text-xs text-gray-500">수수료:</span>
                      <input
                        type="number"
                        value={guideFee || ''}
                        onChange={(e) => onGuideFeeChange(Number(e.target.value) || 0)}
                        className={`text-xs border rounded px-2 py-1 w-20 ${
                          isGuideFeeFromDefault ? 'text-blue-600 bg-blue-50 border-blue-300' : 
                          isGuideFeeFromTour ? 'text-green-600 bg-green-50 border-green-300' : 
                          'text-gray-900 border-gray-300'
                        }`}
                        placeholder="0"
                        min="0"
                        step="0.01"
                        title={isGuideFeeFromDefault ? '기본값 (수정 시 자동 저장)' : isGuideFeeFromTour ? '투어에 저장됨' : '수정 가능'}
                      />
                      <span className="text-xs text-gray-500">$</span>
                      {isGuideFeeFromDefault && (
                        <span className="text-xs text-blue-600" title="기본값">
                          📋
                        </span>
                      )}
                      {isGuideFeeFromTour && (
                        <span className="text-xs text-green-600" title="투어에 저장됨">
                          💾
                        </span>
                      )}
                    </div>
                </div>
              </div>

              {/* 2가이드 또는 가이드+드라이버일 때 어시스턴트 선택 */}
              {(teamType === '2guide' || teamType === 'guide+driver') && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">
                    {teamType === '2guide' ? '2차 가이드:' : '드라이버:'}
                  </span>
                  <div className="flex items-center space-x-2">
                    <select
                      value={selectedAssistant}
                      onChange={(e) => onAssistantSelect(e.target.value)}
                      className="text-xs border rounded px-2 py-1 min-w-32"
                    >
                      <option value="">선택</option>
                      {getFilteredTeamMembers(selectedGuide).map((member) => (
                        <option key={member.email} value={member.email}>
                          {getDisplayName(member)}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center space-x-1">
                      <span className="text-xs text-gray-500">수수료:</span>
                      <input
                        type="number"
                        value={assistantFee || ''}
                        onChange={(e) => onAssistantFeeChange(Number(e.target.value) || 0)}
                        className={`text-xs border rounded px-2 py-1 w-20 ${
                          isAssistantFeeFromDefault ? 'text-blue-600 bg-blue-50 border-blue-300' : 
                          isAssistantFeeFromTour ? 'text-green-600 bg-green-50 border-green-300' : 
                          'text-gray-900 border-gray-300'
                        }`}
                        placeholder="0"
                        min="0"
                        step="0.01"
                        title={isAssistantFeeFromDefault ? '기본값 (수정 시 자동 저장)' : isAssistantFeeFromTour ? '투어에 저장됨' : '수정 가능'}
                      />
                      <span className="text-xs text-gray-500">$</span>
                      {isAssistantFeeFromDefault && (
                        <span className="text-xs text-blue-600" title="기본값">
                          📋
                        </span>
                      )}
                      {isAssistantFeeFromTour && (
                        <span className="text-xs text-green-600" title="투어에 저장됨">
                          💾
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 현재 배정된 팀원 표시 */}
            {(selectedGuide || selectedAssistant) && (
              <div className="p-2 bg-gray-50 rounded text-xs">
                <div className="font-medium text-gray-700 mb-1">
                  현재 배정된 팀원 ({teamType === '1guide' ? '1가이드' : teamType === '2guide' ? '2가이드' : '가이드+드라이버'}):
                </div>
                {selectedGuide && (
                  <div className="text-gray-600 flex justify-between">
                    <span>가이드: {getTeamMemberName(selectedGuide)}</span>
                    {guideFee > 0 && (
                      <span className={`flex items-center space-x-1 ${
                        isGuideFeeFromTour ? 'text-green-600' : 
                        isGuideFeeFromDefault ? 'text-blue-600' : 
                        'text-gray-600'
                      }`}>
                        <span>${guideFee}</span>
                        {isGuideFeeFromTour && <span title="투어에 저장됨">💾</span>}
                        {isGuideFeeFromDefault && <span title="기본값">📋</span>}
                      </span>
                    )}
                  </div>
                )}
                {selectedAssistant && (
                  <div className="text-gray-600 flex justify-between">
                    <span>
                      {teamType === '2guide' ? '2차 가이드' : '드라이버'}: {getTeamMemberName(selectedAssistant)}
                    </span>
                    {assistantFee > 0 && (
                      <span className={`flex items-center space-x-1 ${
                        isAssistantFeeFromTour ? 'text-green-600' : 
                        isAssistantFeeFromDefault ? 'text-blue-600' : 
                        'text-gray-600'
                      }`}>
                        <span>${assistantFee}</span>
                        {isAssistantFeeFromTour && <span title="투어에 저장됨">💾</span>}
                        {isAssistantFeeFromDefault && <span title="기본값">📋</span>}
                      </span>
                    )}
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
