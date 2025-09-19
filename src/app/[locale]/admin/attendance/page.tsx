'use client'

import React, { useState, useEffect } from 'react'
import { Clock, CheckCircle, XCircle, Calendar, User, BarChart3, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useAttendanceSync } from '@/hooks/useAttendanceSync'

interface AttendanceRecord {
  id: string
  employee_email: string
  date: string
  check_in_time: string | null
  check_out_time: string | null
  work_hours: number
  status: string
  notes: string | null
  session_number: number
  employee_name: string
}

interface MonthlyStats {
  employee_email: string
  employee_name: string
  month: string
  total_days: number
  present_days: number
  complete_days: number
  total_work_hours: number
  avg_work_hours_per_day: number
  first_half_hours: number
  second_half_hours: number
}

export default function AttendancePage() {
  const { authUser } = useAuth()
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [todayRecords, setTodayRecords] = useState<AttendanceRecord[]>([])
  
  // 출퇴근 동기화 훅 사용
  const {
    currentSession,
    isCheckingIn,
    employeeNotFound,
    elapsedTime,
    handleCheckIn,
    handleCheckOut,
    refreshAttendance
  } = useAttendanceSync()

  // 오늘의 출퇴근 기록 조회 (커스텀 훅 사용)
  const fetchTodayRecords = async () => {
    await refreshAttendance()
    // 추가로 오늘의 모든 기록을 가져와서 todayRecords 업데이트
    if (!authUser?.email) return

    try {
      const { data: employeeData, error: employeeError } = await supabase
        .from('team')
        .select('name_ko, email')
        .eq('email', authUser.email)
        .eq('is_active', true)
        .single()

      if (employeeError || !employeeData) return

      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('employee_email', employeeData.email)
        .eq('date', currentDate.toISOString().split('T')[0])
        .order('session_number', { ascending: true })

      if (data && data.length > 0) {
        const records = data.map(record => ({
          ...record,
          employee_name: employeeData.name_ko,
          employee_email: employeeData.email
        }))
        setTodayRecords(records)
      } else {
        setTodayRecords([])
      }
    } catch (error) {
      console.error('오늘 기록 조회 중 오류:', error)
    }
  }

  // 출퇴근 기록 조회
  const fetchAttendanceRecords = async () => {
    if (!authUser?.email) return

    try {
      // 먼저 이메일로 직원 정보 조회
      const { data: employeeData, error: employeeError } = await supabase
        .from('team')
        .select('name_ko, email')
        .eq('email', authUser.email)
        .eq('is_active', true)
        .single()

      if (employeeError) {
        console.error('직원 정보 조회 오류:', employeeError)
        setEmployeeNotFound(true)
        return
      }

      if (!employeeData) {
        console.log('직원 정보를 찾을 수 없습니다.')
        setEmployeeNotFound(true)
        return
      }

      // 출퇴근 기록 조회 (테이블이 없을 수도 있으므로 에러 무시)
      const monthStart = selectedMonth + '-01'
      const monthEnd = new Date(new Date(monthStart).getFullYear(), new Date(monthStart).getMonth() + 1, 0)
        .toISOString().split('T')[0] // 해당 월의 마지막 날
      
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('employee_email', employeeData.email)
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .order('date', { ascending: false })

      if (error) {
        console.log('출퇴근 기록 테이블이 아직 생성되지 않았습니다.')
        setAttendanceRecords([])
        return
      }

      setAttendanceRecords(data?.map(record => ({
        ...record,
        employee_name: employeeData.name_ko,
        employee_email: employeeData.email
      })) || [])
    } catch (error) {
      console.error('출퇴근 기록 조회 중 오류:', error)
    }
  }

  // 월별 통계 조회
  const fetchMonthlyStats = async () => {
    if (!authUser?.email) return

    try {
      // 먼저 이메일로 직원 정보 조회
      const { data: employeeData, error: employeeError } = await supabase
        .from('team')
        .select('name_ko, email')
        .eq('email', authUser.email)
        .eq('is_active', true)
        .single()

      if (employeeError) {
        console.error('직원 정보 조회 오류:', employeeError)
        setEmployeeNotFound(true)
        return
      }

      if (!employeeData) {
        console.log('직원 정보를 찾을 수 없습니다.')
        setEmployeeNotFound(true)
        return
      }

      // 월별 통계 조회 (테이블이 없을 수도 있으므로 에러 무시)
      const { data, error } = await supabase
        .from('monthly_attendance_stats')
        .select('*')
        .eq('employee_email', employeeData.email)
        .eq('month', selectedMonth + '-01')
        .single()

      if (error && error.code !== 'PGRST116') {
        console.log('월별 통계 테이블이 아직 생성되지 않았습니다.')
        setMonthlyStats([])
        return
      }

      if (data) {
        setMonthlyStats([data])
      } else {
        setMonthlyStats([])
      }
    } catch (error) {
      console.error('월별 통계 조회 중 오류:', error)
    }
  }

  // 출근/퇴근 체크인/아웃 (커스텀 훅 사용)
  const handleCheckInExecute = async () => {
    await handleCheckIn()
    // 모든 데이터 새로고침
    await Promise.all([
      fetchTodayRecords(),
      fetchAttendanceRecords(),
      fetchMonthlyStats()
    ])
  }

  const handleCheckOutExecute = async () => {
    await handleCheckOut()
    // 모든 데이터 새로고침
    await Promise.all([
      fetchTodayRecords(),
      fetchAttendanceRecords(),
      fetchMonthlyStats()
    ])
  }

  // 데이터 새로고침
  const refreshData = async () => {
    setLoading(true)
    await Promise.all([
      fetchTodayRecords(),
      fetchAttendanceRecords(),
      fetchMonthlyStats()
    ])
    setLoading(false)
  }

  useEffect(() => {
    refreshData()
  }, [authUser, selectedMonth])

  const formatTime = (timeString: string | null) => {
    if (!timeString) return '-'
    return new Date(timeString).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    })
  }

  const formatWorkHours = (hours: number) => {
    if (hours === 0) return '-'
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    return `${h}시간 ${m}분`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  // 직원 정보가 없는 경우
  if (!authUser?.email) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <User className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">로그인이 필요합니다</h2>
          <p className="text-gray-600">출퇴근 관리를 위해 먼저 로그인해주세요.</p>
        </div>
      </div>
    )
  }

  // 직원 정보를 찾을 수 없는 경우
  if (employeeNotFound) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <User className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">직원 정보를 찾을 수 없습니다</h2>
          <p className="text-gray-600 mb-4">
            현재 로그인한 이메일({authUser.email})로 등록된 직원 정보가 없습니다.
          </p>
          <p className="text-sm text-gray-500">
            관리자에게 문의하여 직원 등록을 요청해주세요.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Clock className="w-7 h-7 mr-3 text-blue-600" />
              출퇴근 관리
            </h1>
            <p className="text-gray-600 mt-1">
              {authUser?.name || authUser?.email?.split('@')[0]}님의 출퇴근 기록을 관리합니다.
            </p>
          </div>
          <button
            onClick={refreshData}
            className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            새로고침
          </button>
        </div>
      </div>

      {/* 오늘의 출퇴근 상태 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Calendar className="w-5 h-5 mr-2 text-green-600" />
          오늘의 출퇴근 상태
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">현재 세션</div>
            <div className="text-lg font-semibold text-gray-900">
              {currentSession ? `${currentSession.session_number}번째` : '없음'}
            </div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">출근 시간</div>
            <div className="text-lg font-semibold text-gray-900">
              {currentSession?.check_in_time ? formatTime(currentSession.check_in_time) : '-'}
            </div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">총 근무 시간</div>
            <div className="text-lg font-semibold text-gray-900">
              {formatWorkHours(todayRecords.reduce((total, record) => total + (record.work_hours || 0), 0))}
            </div>
          </div>
        </div>

        {/* 오늘의 출퇴근 기록 목록 */}
        {todayRecords.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">오늘의 출퇴근 기록</h3>
            <div className="space-y-2">
              {todayRecords.map((record, index) => (
                <div key={record.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="text-sm font-medium text-gray-600">
                      {record.session_number}번째
                    </div>
                    <div className="text-sm text-gray-900">
                      출근: {formatTime(record.check_in_time)}
                    </div>
                    <div className="text-sm text-gray-900">
                      퇴근: {formatTime(record.check_out_time)}
                    </div>
                    <div className="text-sm text-gray-900">
                      근무: {formatWorkHours(record.work_hours)}
                    </div>
                  </div>
                  <div className={`px-2 py-1 text-xs rounded-full ${
                    record.check_out_time 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {record.check_out_time ? '완료' : '진행중'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-center space-x-4">
          {!currentSession ? (
            /* 출근 체크인 버튼 (현재 세션이 없을 때만 표시) */
            <button
              onClick={handleCheckInExecute}
              disabled={isCheckingIn}
              className="flex items-center px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              {isCheckingIn ? '체크인 중...' : '출근 체크인'}
            </button>
          ) : (
            /* 퇴근 체크아웃 버튼 (현재 세션이 있을 때만 표시) */
            <button
              onClick={handleCheckOutExecute}
              className="flex items-center px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
            >
              <XCircle className="w-5 h-5 mr-2" />
              퇴근 체크아웃
            </button>
          )}
        </div>
      </div>

      {/* 월별 통계 */}
      {monthlyStats.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
            {selectedMonth} 월별 근무 통계
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {monthlyStats[0]?.total_work_hours?.toFixed(1) || 0}시간
              </div>
              <div className="text-sm text-blue-800">총 근무시간</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {monthlyStats[0]?.present_days || 0}일
              </div>
              <div className="text-sm text-green-800">출근일수</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {monthlyStats[0]?.first_half_hours?.toFixed(1) || 0}시간
              </div>
              <div className="text-sm text-purple-800">상반기 (1~15일)</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {monthlyStats[0]?.second_half_hours?.toFixed(1) || 0}시간
              </div>
              <div className="text-sm text-orange-800">하반기 (16일~말일)</div>
            </div>
          </div>
        </div>
      )}

      {/* 월 선택 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <User className="w-5 h-5 mr-2 text-gray-600" />
            출퇴근 기록
          </h2>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {attendanceRecords.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>선택한 월의 출퇴근 기록이 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    날짜
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    출근 시간
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    퇴근 시간
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    근무 시간
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {attendanceRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(record.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatTime(record.check_in_time)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatTime(record.check_out_time)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatWorkHours(record.work_hours)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        record.status === 'present' 
                          ? 'bg-green-100 text-green-800'
                          : record.status === 'late'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {record.status === 'present' ? '정상' : 
                         record.status === 'late' ? '지각' : '결근'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
