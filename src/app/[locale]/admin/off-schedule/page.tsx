'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Calendar, CheckCircle, XCircle, Clock, User, Filter, Plus } from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/ko'
import AddOffScheduleModal from '@/components/AddOffScheduleModal'

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
  team?: {
    name_ko: string
    position: string
    is_active: boolean
  }
}

export default function AdminOffSchedulePage() {
  const { user, userRole, loading: authLoading } = useAuth()
  const [offSchedules, setOffSchedules] = useState<OffSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [selectedDate, setSelectedDate] = useState('')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  console.log('AdminOffSchedulePage render:', { 
    user: !!user, 
    userEmail: user?.email,
    authLoading, 
    loading,
    userRole 
  })

  useEffect(() => {
    console.log('useEffect triggered:', { user: !!user, authLoading, filter, selectedDate })
    // 임시로 인증 체크를 우회하여 테스트
    if (!authLoading) {
      console.log('Calling fetchOffData... (auth bypassed for testing)')
      fetchOffData()
    } else {
      console.log('Not calling fetchOffData:', { user: !!user, authLoading })
    }
  }, [user, authLoading, filter, selectedDate, fetchOffData])

  const fetchOffData = useCallback(async () => {
    try {
      setLoading(true)
      console.log('Fetching off schedules data...')
      
      // Fetch off schedules first
      let query = supabase
        .from('off_schedules')
        .select('*')
        .order('created_at', { ascending: false })

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      if (selectedDate) {
        query = query.eq('off_date', selectedDate)
      }

      const { data: schedules, error: schedulesError } = await query

      console.log('Off schedules query result:', { schedules, schedulesError })

      if (schedulesError) {
        console.error('Supabase error:', schedulesError)
        throw schedulesError
      }

      // Fetch team information for each schedule
      if (schedules && schedules.length > 0) {
        const teamEmails = [...new Set(schedules.map(s => s.team_email))]
        const { data: teamData, error: teamError } = await supabase
          .from('team')
          .select('email, name_ko, position, is_active')
          .in('email', teamEmails)

        if (teamError) {
          console.error('Team data error:', teamError)
        } else {
          // Combine schedules with team data
          const schedulesWithTeam = schedules.map(schedule => ({
            ...schedule,
            team: teamData?.find(team => team.email === schedule.team_email)
          }))
          setOffSchedules(schedulesWithTeam)
          console.log('Off schedules with team data set:', schedulesWithTeam.length, 'items')
        }
      } else {
        setOffSchedules([])
        console.log('No off schedules found')
      }
    } catch (error) {
      console.error('Error fetching off data:', error)
    } finally {
      setLoading(false)
    }
  }, [filter, selectedDate])

  const handleApproveRequest = async (requestId: string) => {
    if (!confirm('이 Off 신청을 승인하시겠습니까?')) return

    try {
      // Get admin's email from team table
      const { data: adminMember } = await supabase
        .from('team')
        .select('email')
        .eq('email', user?.email)
        .single()

      const { error } = await supabase
        .from('off_schedules')
        .update({
          status: 'approved',
          approved_by: adminMember?.email,
          approved_at: new Date().toISOString()
        })
        .eq('id', requestId)

      if (error) throw error

      fetchOffData()
      alert('Off 신청이 승인되었습니다.')
    } catch (error) {
      console.error('Error approving request:', error)
      alert('Off 신청 승인 중 오류가 발생했습니다.')
    }
  }

  const handleRejectRequest = async (requestId: string) => {
    if (!confirm('이 Off 신청을 거부하시겠습니까?')) return

    try {
      // Get admin's email from team table
      const { data: adminMember } = await supabase
        .from('team')
        .select('email')
        .eq('email', user?.email)
        .single()

      const { error } = await supabase
        .from('off_schedules')
        .update({
          status: 'rejected',
          approved_by: adminMember?.email,
          approved_at: new Date().toISOString()
        })
        .eq('id', requestId)

      if (error) throw error

      fetchOffData()
      alert('Off 신청이 거부되었습니다.')
    } catch (error) {
      console.error('Error rejecting request:', error)
      alert('Off 신청 거부 중 오류가 발생했습니다.')
    }
  }

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm('이 Off 스케줄을 삭제하시겠습니까?')) return

    try {
      const { error } = await supabase
        .from('off_schedules')
        .delete()
        .eq('id', scheduleId)

      if (error) throw error

      fetchOffData()
      alert('Off 스케줄이 삭제되었습니다.')
    } catch (error) {
      console.error('Error deleting schedule:', error)
      alert('Off 스케줄 삭제 중 오류가 발생했습니다.')
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  // 임시로 인증 체크를 우회하여 테스트
  // if (!user) {
  //   return (
  //     <div className="flex items-center justify-center min-h-screen">
  //       <div className="text-center">
  //         <div className="text-lg text-gray-600 mb-4">로그인이 필요합니다.</div>
  //         <div className="text-sm text-gray-500">관리자 계정으로 로그인해주세요.</div>
  //       </div>
  //     </div>
  //   )
  // }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center">
              <Calendar className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
              Off 스케줄 관리 (관리자)
            </h1>
          </div>

          <div className="p-4 sm:p-6">
            {/* 필터 및 검색 - 모바일 최적화 */}
            <div className="mb-6 space-y-4">
              {/* 필터 그룹 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="flex items-center space-x-2">
                  <Filter className="w-4 h-4 text-gray-500" />
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as 'all' | 'pending' | 'approved' | 'rejected')}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="all">전체</option>
                    <option value="pending">대기중</option>
                    <option value="approved">승인됨</option>
                    <option value="rejected">거부됨</option>
                  </select>
                </div>
                
                <div>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="날짜별 필터"
                  />
                </div>
                
                <button
                  onClick={() => {
                    setFilter('all')
                    setSelectedDate('')
                  }}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  필터 초기화
                </button>
                
                {/* 추가 버튼 */}
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex items-center justify-center px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <Plus className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Off 스케줄 추가</span>
                  <span className="sm:hidden">추가</span>
                </button>
              </div>
            </div>

            {/* Off 신청 관리 */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4">Off 신청 관리</h3>
              {offSchedules.length === 0 ? (
                <div className="text-gray-500 text-center py-8">
                  {filter === 'all' ? '신청된 Off가 없습니다.' : '해당 조건의 Off 신청이 없습니다.'}
                </div>
              ) : (
                <div className="space-y-4">
                  {offSchedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className="p-3 sm:p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-3 sm:space-y-0">
                        <div className="flex-1">
                          <div className="flex items-start space-x-3 mb-2">
                            {getStatusIcon(schedule.status)}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-base sm:text-lg">
                                {dayjs(schedule.off_date).format('YYYY년 MM월 DD일 (ddd)')}
                              </div>
                              <div className="text-sm text-gray-600 flex items-center mt-1">
                                <User className="w-4 h-4 mr-1 flex-shrink-0" />
                                <span className="truncate">{schedule.team?.name_ko || schedule.team_email || 'Unknown User'}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-gray-700 mb-2 text-sm sm:text-base">{schedule.reason}</div>
                          <div className="text-xs text-gray-500 space-y-1">
                            <div>신청일: {dayjs(schedule.created_at).format('YYYY-MM-DD HH:mm')}</div>
                            {schedule.approved_at && (
                              <div>처리일: {dayjs(schedule.approved_at).format('YYYY-MM-DD HH:mm')}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(schedule.status)} self-start`}>
                            {getStatusText(schedule.status)}
                          </span>
                          {schedule.status === 'pending' && (
                            <div className="flex space-x-2 sm:space-x-1">
                              <button
                                onClick={() => handleApproveRequest(schedule.id)}
                                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 flex-1 sm:flex-none"
                              >
                                승인
                              </button>
                              <button
                                onClick={() => handleRejectRequest(schedule.id)}
                                className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 flex-1 sm:flex-none"
                              >
                                거부
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 승인된 Off 스케줄 관리 */}
            <div>
              <h3 className="text-lg font-semibold mb-4">승인된 Off 스케줄</h3>
              {offSchedules.filter(s => s.status === 'approved').length === 0 ? (
                <div className="text-gray-500 text-center py-8">
                  {selectedDate ? '해당 날짜의 승인된 Off가 없습니다.' : '승인된 Off가 없습니다.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {offSchedules.filter(s => s.status === 'approved').map((schedule) => (
                    <div
                      key={schedule.id}
                      className="p-4 border border-gray-200 rounded-lg bg-green-50 hover:bg-green-100"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="font-medium text-green-800">승인됨</span>
                          </div>
                          <div className="font-medium text-gray-900">
                            {dayjs(schedule.off_date).format('YYYY년 MM월 DD일 (ddd)')}
                          </div>
                          <div className="text-sm text-gray-600 mb-1">
                            {schedule.team?.name_ko || schedule.team_email || 'Unknown User'}
                          </div>
                          <div className="text-sm text-gray-700">{schedule.reason}</div>
                        </div>
                        <button
                          onClick={() => handleDeleteSchedule(schedule.id)}
                          className="text-red-600 hover:text-red-800 p-1"
                          title="스케줄 삭제"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Off 스케줄 추가 모달 */}
      <AddOffScheduleModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          fetchOffData() // 데이터 새로고침
        }}
        currentUserEmail={user?.email}
      />
    </div>
  )
}
