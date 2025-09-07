'use client'

import { useState, useEffect } from 'react'
import { X, Calendar, User, FileText, Save, Plus } from 'lucide-react'
import { createClientSupabase } from '@/lib/supabase'
import dayjs from 'dayjs'

interface TeamMember {
  email: string
  name_ko: string
  position: string
  is_active: boolean
}

interface OffDateItem {
  id: string
  date: string
}

interface AddOffScheduleModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  currentUserEmail?: string
}

export default function AddOffScheduleModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  currentUserEmail 
}: AddOffScheduleModalProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [selectedMember, setSelectedMember] = useState('')
  const [offDates, setOffDates] = useState<OffDateItem[]>([])
  const [reason, setReason] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 팀원 목록 조회
  useEffect(() => {
    if (isOpen) {
      fetchTeamMembers()
    }
  }, [isOpen])

  const fetchTeamMembers = async () => {
    try {
      const supabase = createClientSupabase()
      const { data, error } = await supabase
        .from('team')
        .select('email, name_ko, position, is_active')
        .eq('is_active', true)
        .order('name_ko')

      if (error) {
        console.error('Error fetching team members:', error)
        return
      }

      setTeamMembers(data || [])
      
      // 현재 사용자가 팀원인 경우 기본값으로 설정
      if (currentUserEmail && data?.some(member => member.email === currentUserEmail)) {
        setSelectedMember(currentUserEmail)
      }
    } catch (err) {
      console.error('Error fetching team members:', err)
    }
  }

  // 날짜 추가
  const addOffDate = () => {
    const newDate: OffDateItem = {
      id: Date.now().toString(),
      date: dayjs().add(1, 'day').format('YYYY-MM-DD')
    }
    setOffDates([...offDates, newDate])
  }

  // 날짜 제거
  const removeOffDate = (id: string) => {
    setOffDates(offDates.filter(item => item.id !== id))
  }

  // 날짜 업데이트
  const updateOffDate = (id: string, value: string) => {
    setOffDates(offDates.map(item => 
      item.id === id ? { ...item, date: value } : item
    ))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMember || offDates.length === 0) {
      setError('팀원을 선택하고 최소 하나의 Off 날짜를 추가해주세요.')
      return
    }

    if (!reason.trim()) {
      setError('Off 신청 사유를 입력해주세요.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClientSupabase()
      
      // 여러 Off 스케줄을 한 번에 추가 (공통 사유 사용)
      const offSchedulesToInsert = offDates.map(item => ({
        team_email: selectedMember,
        off_date: item.date,
        reason: reason.trim(),
        status: 'pending'
      }))

      const { error: insertError } = await supabase
        .from('off_schedules')
        .insert(offSchedulesToInsert)

      if (insertError) {
        console.error('Error adding off schedules:', insertError)
        setError('Off 스케줄 추가 중 오류가 발생했습니다.')
        return
      }

      // 성공 시 폼 초기화 및 모달 닫기
      setSelectedMember('')
      setOffDates([])
      setReason('')
      onSuccess()
      onClose()
    } catch (err) {
      console.error('Error adding off schedules:', err)
      setError('Off 스케줄 추가 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Off 스케줄 추가</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="space-y-6">
            {/* 팀원 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-1" />
                팀원 선택
              </label>
              <select
                value={selectedMember}
                onChange={(e) => setSelectedMember(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">팀원을 선택하세요</option>
                {teamMembers.map((member) => (
                  <option key={member.email} value={member.email}>
                    {member.name_ko} ({member.position})
                  </option>
                ))}
              </select>
            </div>

            {/* Off 날짜 목록 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Off 날짜 목록
                </label>
                <button
                  type="button"
                  onClick={addOffDate}
                  className="flex items-center px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  날짜 추가
                </button>
              </div>

              {offDates.length === 0 ? (
                <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-md">
                  <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p>Off 날짜를 추가해주세요</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {offDates.map((item, index) => (
                    <div key={item.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-md bg-gray-50">
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-medium text-gray-600">
                          #{index + 1}
                        </span>
                        <input
                          type="date"
                          value={item.date}
                          onChange={(e) => updateOffDate(item.id, e.target.value)}
                          min={dayjs().format('YYYY-MM-DD')}
                          className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                        <span className="text-sm text-gray-500">
                          {dayjs(item.date).format('MM월 DD일 (ddd)')}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeOffDate(item.id)}
                        className="text-red-600 hover:text-red-800 transition-colors p-1"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 공통 사유 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FileText className="w-4 h-4 inline mr-1" />
                Off 신청 사유
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Off 신청 사유를 입력하세요 (모든 날짜에 공통으로 적용됩니다)"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                required
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isLoading || offDates.length === 0}
              className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors flex items-center"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {isLoading ? '추가 중...' : `${offDates.length}개 추가`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
