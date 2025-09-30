'use client'

import React, { useState, useEffect } from 'react'
import { X, User, Search } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

interface TeamMember {
  email: string
  name_ko: string
  position: string
  is_active: boolean
}

interface SimulationModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function SimulationModal({ isOpen, onClose }: SimulationModalProps) {
  const { startSimulation } = useAuth()
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [filteredMembers, setFilteredMembers] = useState<TeamMember[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 팀원 목록 가져오기
  useEffect(() => {
    if (isOpen) {
      fetchTeamMembers()
    }
  }, [isOpen])

  // 검색 필터링
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredMembers(teamMembers)
    } else {
      const filtered = teamMembers.filter(member =>
        member.name_ko.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.position.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredMembers(filtered)
    }
  }, [searchTerm, teamMembers])

  const fetchTeamMembers = async () => {
    setLoading(true)
    setError('')
    
    try {
      // 클라이언트에서 직접 supabase 사용
      const { data: teamMembers, error } = await supabase
        .from('team')
        .select('email, name_ko, position, is_active')
        .eq('is_active', true)
        .order('name_ko')

      if (error) {
        console.error('Error fetching team members:', error)
        setError('팀원 목록을 가져오는데 실패했습니다.')
        return
      }

      setTeamMembers(teamMembers || [])
      setFilteredMembers(teamMembers || [])
    } catch (err) {
      console.error('Error fetching team members:', err)
      setError('팀원 목록을 가져오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleStartSimulation = (member: TeamMember) => {
    // UserRole 타입에 맞게 변환
    const role = member.position === 'admin' ? 'admin' :
                 member.position === 'manager' ? 'manager' :
                 member.position === 'team_member' ? 'team_member' : 'team_member'

    const simulatedUser = {
      email: member.email,
      name_ko: member.name_ko,
      position: member.position,
      role: role as 'admin' | 'manager' | 'team_member'
    }

    startSimulation(simulatedUser)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">시뮬레이션 시작</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 검색 입력 */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="팀원 이름, 이메일, 포지션으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* 팀원 목록 */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="ml-2 text-gray-600">팀원 목록을 불러오는 중...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={fetchTeamMembers}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                다시 시도
              </button>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-8">
              <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">검색 결과가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMembers.map((member) => (
                <button
                  key={member.email}
                  onClick={() => handleStartSimulation(member)}
                  className="w-full p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-medium text-sm">
                        {member.name_ko.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {member.name_ko}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {member.email}
                      </p>
                      <p className="text-xs text-blue-600 font-medium">
                        {member.position}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  )
}
