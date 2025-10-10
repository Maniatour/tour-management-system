'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Calendar, Plus, Trash2, Clock, CheckCircle, XCircle } from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/ko'

dayjs.locale('ko')

interface OffSchedule {
  id: string
  team_email: string
  off_date: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  approved_by?: string
  approved_at?: string
  created_at: string
}

export default function OffSchedulePage() {
  const { user, loading: userLoading } = useAuth()
  const [offSchedules, setOffSchedules] = useState<OffSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [newRequest, setNewRequest] = useState({
    off_date: '',
    reason: ''
  })

  useEffect(() => {
    if (user && !userLoading) {
      fetchOffData()
    }
  }, [user, userLoading])

  const fetchOffData = async () => {
    try {
      setLoading(true)
      
      // Get user's email from team table
      const { data: teamMember } = await supabase
        .from('team')
        .select('email')
        .eq('email', user?.email)
        .single()

      if (!teamMember) {
        console.error('User not found in team table')
        return
      }

      // Fetch off schedules (all statuses)
      const { data: schedules, error: schedulesError } = await supabase
        .from('off_schedules')
        .select('*')
        .eq('team_email', teamMember.email)
        .order('off_date', { ascending: false })

      if (schedulesError) throw schedulesError

      setOffSchedules(schedules || [])
    } catch (error) {
      console.error('Error fetching off data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newRequest.off_date || !newRequest.reason.trim()) {
      alert('날짜와 사유를 모두 입력해주세요.')
      return
    }

    try {
      // Get user's email from team table
      const { data: teamMember } = await supabase
        .from('team')
        .select('email')
        .eq('email', user?.email)
        .single()

      if (!teamMember) {
        alert('팀 멤버로 등록되지 않은 사용자입니다.')
        return
      }

      const { error } = await supabase
        .from('off_schedules')
        .insert({
          id: `OFF_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          team_email: teamMember.email,
          off_date: newRequest.off_date,
          reason: newRequest.reason.trim()
        })

      if (error) throw error

      setNewRequest({ off_date: '', reason: '' })
      setShowRequestForm(false)
      fetchOffData()
      alert('Off 신청이 제출되었습니다.')
    } catch (error) {
      console.error('Error submitting request:', error)
      alert('Off 신청 중 오류가 발생했습니다.')
    }
  }

  const handleCancelRequest = async (requestId: string) => {
    if (!confirm('정말로 이 Off 신청을 취소하시겠습니까?')) return

    try {
      // Get user's email from team table
      const { data: teamMember } = await supabase
        .from('team')
        .select('email')
        .eq('email', user?.email)
        .single()

      if (!teamMember) {
        alert('팀 멤버로 등록되지 않은 사용자입니다.')
        return
      }

      const { error } = await supabase
        .from('off_schedules')
        .delete()
        .eq('id', requestId)
        .eq('team_email', teamMember.email)

      if (error) throw error

      fetchOffData()
      alert('Off 신청이 취소되었습니다.')
    } catch (error) {
      console.error('Error canceling request:', error)
      alert('Off 신청 취소 중 오류가 발생했습니다.')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved':
        return '승인됨'
      case 'rejected':
        return '거부됨'
      default:
        return '대기중'
    }
  }

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-lg text-gray-600 mb-4">로그인이 필요합니다.</div>
          <div className="text-sm text-gray-500">팀 멤버 계정으로 로그인해주세요.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <Calendar className="w-6 h-6 mr-2" />
                Off 스케줄 관리
              </h1>
              <button
                onClick={() => setShowRequestForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Off 신청
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* Off 신청 폼 */}
            {showRequestForm && (
              <div className="mb-8 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold mb-4">새 Off 신청</h3>
                <form onSubmit={handleSubmitRequest} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Off 날짜
                    </label>
                    <input
                      type="date"
                      value={newRequest.off_date}
                      onChange={(e) => setNewRequest({ ...newRequest, off_date: e.target.value })}
                      min={dayjs().format('YYYY-MM-DD')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      사유
                    </label>
                    <textarea
                      value={newRequest.reason}
                      onChange={(e) => setNewRequest({ ...newRequest, reason: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows={3}
                      placeholder="Off 신청 사유를 입력해주세요"
                      required
                    />
                  </div>
                  <div className="flex space-x-2">
                    <button
                      type="submit"
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                    >
                      신청하기
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRequestForm(false)}
                      className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
                    >
                      취소
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Off 신청 내역 */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4">Off 신청 내역</h3>
              {offSchedules.length === 0 ? (
                <div className="text-gray-500 text-center py-8">
                  신청한 Off가 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {offSchedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                    >
                      <div className="flex items-center space-x-4">
                        {getStatusIcon(schedule.status)}
                        <div>
                          <div className="font-medium">
                            {dayjs(schedule.off_date).format('YYYY년 MM월 DD일 (ddd)')}
                          </div>
                          <div className="text-sm text-gray-600">{schedule.reason}</div>
                          <div className="text-xs text-gray-500">
                            신청일: {dayjs(schedule.created_at).format('YYYY-MM-DD HH:mm')}
                            {schedule.approved_at && (
                              <span className="ml-2">
                                | 처리일: {dayjs(schedule.approved_at).format('YYYY-MM-DD HH:mm')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          schedule.status === 'approved' ? 'bg-green-100 text-green-800' :
                          schedule.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {getStatusText(schedule.status)}
                        </span>
                        {schedule.status === 'pending' && (
                          <button
                            onClick={() => handleCancelRequest(schedule.id)}
                            className="text-red-600 hover:text-red-800 p-1"
                            title="신청 취소"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 승인된 Off 스케줄 */}
            <div>
              <h3 className="text-lg font-semibold mb-4">승인된 Off 스케줄</h3>
              {offSchedules.filter(s => s.status === 'approved').length === 0 ? (
                <div className="text-gray-500 text-center py-8">
                  승인된 Off가 없습니다.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {offSchedules.filter(s => s.status === 'approved').map((schedule) => (
                    <div
                      key={schedule.id}
                      className="p-4 border border-gray-200 rounded-lg bg-green-50"
                    >
                      <div className="flex items-center space-x-2 mb-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="font-medium text-green-800">승인됨</span>
                      </div>
                      <div className="font-medium text-gray-900">
                        {dayjs(schedule.off_date).format('YYYY년 MM월 DD일 (ddd)')}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">{schedule.reason}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
