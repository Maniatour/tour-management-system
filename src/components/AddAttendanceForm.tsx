'use client'

import React, { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Calendar, Clock, User, X, Plus } from 'lucide-react'

interface AddAttendanceFormProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  selectedEmployee: string
  selectedMonth: string
}

interface TeamMember {
  email: string
  name_ko: string | null
}

export default function AddAttendanceForm({ 
  isOpen, 
  onClose, 
  onSuccess, 
  selectedEmployee,
  selectedMonth 
}: AddAttendanceFormProps) {
  const [formData, setFormData] = useState({
    employee_email: selectedEmployee,
    date: '',
    check_in_time: '',
    check_out_time: '',
    notes: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])

  // 팀 멤버 목록 조회
  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('team')
        .select('email, name_ko')
        .eq('is_active', true)
        .order('name_ko')

      if (error) {
        console.error('팀 멤버 조회 오류:', error)
        return
      }

      setTeamMembers(data || [])
    } catch (error) {
      console.error('팀 멤버 조회 오류:', error)
    }
  }

  // 폼이 열릴 때 팀 멤버 조회
  React.useEffect(() => {
    if (isOpen) {
      fetchTeamMembers()
      // 기본값 설정
      const today = new Date().toISOString().split('T')[0]
      setFormData({
        employee_email: selectedEmployee,
        date: today,
        check_in_time: '',
        check_out_time: '',
        notes: ''
      })
    }
  }, [isOpen, selectedEmployee])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('인증이 필요합니다.')
      }

      // 필수 필드 검증
      if (!formData.employee_email || !formData.date || !formData.check_in_time) {
        throw new Error('직원, 날짜, 출근 시간은 필수입니다.')
      }

      // 시간 형식 검증
      const checkInTime = new Date(`${formData.date}T${formData.check_in_time}`)
      if (isNaN(checkInTime.getTime())) {
        throw new Error('올바른 출근 시간을 입력해주세요.')
      }

      let checkOutTime = null
      if (formData.check_out_time) {
        checkOutTime = new Date(`${formData.date}T${formData.check_out_time}`)
        if (isNaN(checkOutTime.getTime())) {
          throw new Error('올바른 퇴근 시간을 입력해주세요.')
        }
        if (checkOutTime <= checkInTime) {
          throw new Error('퇴근 시간은 출근 시간보다 늦어야 합니다.')
        }
      }

      const response = await fetch('/api/attendance-records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          employee_email: formData.employee_email,
          date: formData.date,
          check_in_time: checkInTime.toISOString(),
          check_out_time: checkOutTime?.toISOString() || null,
          notes: formData.notes || null
        })
      })

      let result
      try {
        result = await response.json()
      } catch (jsonError) {
        console.error('JSON 파싱 오류:', jsonError)
        throw new Error('서버 응답을 처리할 수 없습니다. 서버 오류가 발생했을 수 있습니다.')
      }

      if (!response.ok) {
        console.error('API 응답 오류:', {
          status: response.status,
          statusText: response.statusText,
          result
        })
        throw new Error(result.error || result.details || '출퇴근 기록 추가에 실패했습니다.')
      }

      alert('출퇴근 기록이 성공적으로 추가되었습니다!')
      onSuccess()
      onClose()
    } catch (error) {
      console.error('출퇴근 기록 추가 오류:', error)
      setError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    setError('')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <Plus className="w-5 h-5 mr-2 text-blue-600" />
            출퇴근 기록 추가
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* 직원 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4 inline mr-1" />
              직원
            </label>
            <select
              value={formData.employee_email}
              onChange={(e) => handleInputChange('employee_email', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">직원을 선택하세요</option>
              {teamMembers.map((member) => (
                <option key={member.email} value={member.email}>
                  {member.name_ko || member.email}
                </option>
              ))}
            </select>
          </div>

          {/* 날짜 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              날짜
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => handleInputChange('date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* 출근 시간 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Clock className="w-4 h-4 inline mr-1" />
              출근 시간
            </label>
            <input
              type="time"
              value={formData.check_in_time}
              onChange={(e) => handleInputChange('check_in_time', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* 퇴근 시간 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Clock className="w-4 h-4 inline mr-1" />
              퇴근 시간 (선택사항)
            </label>
            <input
              type="time"
              value={formData.check_out_time}
              onChange={(e) => handleInputChange('check_out_time', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              메모 (선택사항)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="추가 메모를 입력하세요..."
            />
          </div>

          {/* 버튼 */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
            >
              {loading ? '추가 중...' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
