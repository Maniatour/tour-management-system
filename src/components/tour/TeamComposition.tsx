import React from 'react'
import { User, Users, Car } from 'lucide-react'
import { ConnectionStatusLabel } from './TourUIComponents'

interface TeamCompositionProps {
  teamMembers: any[]
  teamType: '1guide' | '2guide' | 'guide+driver'
  selectedGuide: string
  selectedAssistant: string
  expandedSections: Set<string>
  connectionStatus: { team: boolean }
  onToggleSection: (sectionId: string) => void
  onTeamTypeChange: (type: '1guide' | '2guide' | 'guide+driver') => void
  onGuideSelect: (email: string) => void
  onAssistantSelect: (email: string) => void
  onLoadTeamMembersFallback: () => void
  getTeamMemberName: (email: string) => string
}

export const TeamComposition: React.FC<TeamCompositionProps> = ({
  teamMembers,
  teamType,
  selectedGuide,
  selectedAssistant,
  expandedSections,
  connectionStatus,
  onToggleSection,
  onTeamTypeChange,
  onGuideSelect,
  onAssistantSelect,
  onLoadTeamMembersFallback,
  getTeamMemberName
}) => {
  const getFilteredTeamMembers = (excludeEmail?: string) => {
    return teamMembers.filter((member: any) => {
      if (excludeEmail && member.email === excludeEmail) return false
      
      if (!member.position) return true // position이 없으면 포함
      const position = member.position.toLowerCase()
      return position.includes('tour') && position.includes('guide') ||
             position.includes('guide') ||
             position.includes('가이드') ||
             position.includes('driver') ||
             position.includes('드라이버') ||
             position.includes('운전')
    })
  }

  const getDisplayName = (member: any) => {
    const locale = window.location.pathname.split('/')[1] || 'ko'
    return locale === 'ko' 
      ? (member.name_ko || member.name_en || member.email)
      : (member.name_en || member.name_ko || member.email)
  }

  const guideDriverCount = teamMembers.filter((m: any) => {
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
                <select
                  value={selectedGuide}
                  onChange={(e) => onGuideSelect(e.target.value)}
                  className="text-xs border rounded px-2 py-1 min-w-32"
                >
                  <option value="">가이드 선택</option>
                  {getFilteredTeamMembers().map((member: any) => (
                    <option key={member.email} value={member.email}>
                      {getDisplayName(member)} ({member.position || 'No position'})
                    </option>
                  ))}
                </select>
              </div>

              {/* 2가이드 또는 가이드+드라이버일 때 어시스턴트 선택 */}
              {(teamType === '2guide' || teamType === 'guide+driver') && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">
                    {teamType === '2guide' ? '2차 가이드:' : '드라이버:'}
                  </span>
                  <select
                    value={selectedAssistant}
                    onChange={(e) => onAssistantSelect(e.target.value)}
                    className="text-xs border rounded px-2 py-1 min-w-32"
                  >
                    <option value="">선택</option>
                    {getFilteredTeamMembers(selectedGuide).map((member: any) => (
                      <option key={member.email} value={member.email}>
                        {getDisplayName(member)} ({member.position || 'No position'})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* 현재 배정된 팀원 표시 */}
            {(selectedGuide || selectedAssistant) && (
              <div className="p-2 bg-gray-50 rounded text-xs">
                <div className="font-medium text-gray-700 mb-1">현재 배정된 팀원:</div>
                {selectedGuide && (
                  <div className="text-gray-600">가이드: {getTeamMemberName(selectedGuide)}</div>
                )}
                {selectedAssistant && (
                  <div className="text-gray-600">
                    {teamType === '2guide' ? '2차 가이드' : '드라이버'}: {getTeamMemberName(selectedAssistant)}
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
