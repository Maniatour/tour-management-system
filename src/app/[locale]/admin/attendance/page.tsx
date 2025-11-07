'use client'

import React, { useState, useEffect } from 'react'
import { Clock, CheckCircle, XCircle, Calendar, User, BarChart3, RefreshCw, Edit, Users, Plus, Calculator } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import AddAttendanceForm from '@/components/AddAttendanceForm'
import { useAttendanceSync } from '@/hooks/useAttendanceSync'
import AttendanceEditModal from '@/components/attendance/AttendanceEditModal'
import BiweeklyCalculatorModal from '@/components/BiweeklyCalculatorModal'
import TotalEmployeesModal from '@/components/TotalEmployeesModal'
import { useParams } from 'next/navigation'

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
  const params = useParams()
  const locale = params.locale as string
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [todayRecords, setTodayRecords] = useState<AttendanceRecord[]>([])
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null)
  const [canEditAttendance, setCanEditAttendance] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [teamMembers, setTeamMembers] = useState<Array<{email: string, name_ko: string, position: string}>>([])
  const [selectedEmployee, setSelectedEmployee] = useState<string>('')
  const [currentSessionForSelectedEmployee, setCurrentSessionForSelectedEmployee] = useState<AttendanceRecord | null>(null)
  const [employeeNotFound, setEmployeeNotFound] = useState(false)
  const [isAddFormOpen, setIsAddFormOpen] = useState(false)
  const [isBiweeklyCalculatorOpen, setIsBiweeklyCalculatorOpen] = useState(false)
  const [isTotalEmployeesModalOpen, setIsTotalEmployeesModalOpen] = useState(false)
  
  // 어드민 권한 체크
  const checkAdminPermission = async () => {
    if (!authUser?.email) return
    
    try {
      const { data: teamData, error } = await supabase
        .from('team')
        .select('position')
        .eq('email', authUser.email)
        .eq('is_active', true)
        .single()
      
      if (error || !teamData) {
        setIsAdmin(false)
        setCanEditAttendance(false)
        return
      }
      
      const position = (teamData as any).position?.toLowerCase()
      const isAdminUser = position === 'super'
      
      setIsAdmin(isAdminUser)
      setCanEditAttendance(position === 'super')
    } catch (error) {
      console.error('권한 체크 오류:', error)
      setIsAdmin(false)
      setCanEditAttendance(false)
    }
  }

  // 팀 멤버 목록 조회 (OP와 Office Manager만 - 대소문자 구별 없음)
  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('team')
        .select('email, name_ko, position')
        .eq('is_active', true)
        .or('position.ilike.op,position.ilike.office manager')
        .order('name_ko')
      
      if (error) {
        console.error('팀 멤버 조회 오류:', error)
        return
      }
      
      setTeamMembers(data || [])
      
      // 기본값을 현재 사용자로 설정 (OP 또는 Office Manager인 경우)
      if (authUser?.email && data?.length) {
        const currentUser = data.find((member: any) => member.email === authUser.email)
        if (currentUser) {
          setSelectedEmployee(authUser.email)
        } else {
          setSelectedEmployee((data[0] as any).email)
        }
      }
    } catch (error) {
      console.error('팀 멤버 조회 중 오류:', error)
    }
  }
  
  // 출퇴근 동기화 훅 사용
  const {
    currentSession,
    isCheckingIn,
    handleCheckIn,
    handleCheckOut
  } = useAttendanceSync()

  // 오늘의 출퇴근 기록 조회 (선택된 직원 기준)
  const fetchTodayRecords = async () => {
    if (!selectedEmployee) return

    try {
      // 선택된 직원의 정보 조회
      const { data: employeeData, error: employeeError } = await supabase
        .from('team')
        .select('name_ko, email')
        .eq('email', selectedEmployee)
        .eq('is_active', true)
        .single()

      if (employeeError || !employeeData) {
        setTodayRecords([])
        setCurrentSessionForSelectedEmployee(null)
        return
      }

      // 최근 7일간의 미체크아웃 기록 조회
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]
      
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('employee_email', (employeeData as any).email)
        .is('check_out_time', null)
        .gte('date', sevenDaysAgoStr)
        .order('date', { ascending: false })
        .order('check_in_time', { ascending: false })
        .order('session_number', { ascending: true })

      if (error) {
        console.log('오늘 기록 조회 오류:', error)
        setTodayRecords([])
        setCurrentSessionForSelectedEmployee(null)
        return
      }

      const activeRecords = data?.map((record: any) => ({
        ...record,
        employee_name: (employeeData as any).name_ko,
        employee_email: (employeeData as any).email
      })) || []
      
      // 현재 진행 중인 세션 찾기 (퇴근하지 않은 세션)
      const activeSession = activeRecords.find(record => 
        record.check_in_time && 
        (record.check_out_time === null || record.check_out_time === '')
      )
      
      // 오늘의 모든 출퇴근 기록 조회 (완료된 것도 포함)
      const today = new Date().toISOString().split('T')[0]
      const { data: todayData, error: todayError } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('employee_email', (employeeData as any).email)
        .eq('date', today)
        .order('session_number', { ascending: true })

      if (!todayError && todayData) {
        const todayRecords = todayData.map((record: any) => ({
          ...record,
          employee_name: (employeeData as any).name_ko,
          employee_email: (employeeData as any).email
        }))
        setTodayRecords(todayRecords)
      } else {
        setTodayRecords([])
      }
      
      setCurrentSessionForSelectedEmployee(activeSession || null)
    } catch (error) {
      console.error('오늘 기록 조회 중 오류:', error)
    }
  }

  // 출퇴근 기록 조회
  const fetchAttendanceRecords = async () => {
    console.log('fetchAttendanceRecords 시작, selectedEmployee:', selectedEmployee)
    
    if (!selectedEmployee) {
      console.log('selectedEmployee가 없습니다')
      return
    }

    try {
      console.log('직원 정보 조회 시작...')
      // 선택된 직원의 정보 조회
      const { data: employeeData, error: employeeError } = await supabase
        .from('team')
        .select('name_ko, email')
        .eq('email', selectedEmployee)
        .eq('is_active', true)
        .single()

      console.log('직원 정보 조회 결과:', { employeeData, employeeError })

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
      // 해당 월의 마지막 날 계산 수정
      const year = parseInt(selectedMonth.split('-')[0])
      const month = parseInt(selectedMonth.split('-')[1]) - 1 // JavaScript 월은 0부터 시작
      const monthEnd = new Date(year, month + 1, 0).toISOString().split('T')[0]
      
      console.log('출퇴근 기록 조회 시작...', { monthStart, monthEnd, employeeEmail: (employeeData as any).email })
      
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('employee_email', (employeeData as any).email)
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .order('date', { ascending: false })
        .order('check_in_time', { ascending: true })
        .order('session_number', { ascending: true })
        .limit(10000) // 충분히 큰 제한값 설정

      console.log('출퇴근 기록 조회 결과:', { 
        data: data, 
        error: error,
        recordCount: data?.length || 0,
        monthStart,
        monthEnd,
        employeeEmail: (employeeData as any).email
      })

      if (error) {
        console.log('출퇴근 기록 테이블이 아직 생성되지 않았습니다.')
        setAttendanceRecords([])
        return
      }

      const records = data?.map((record: any) => ({
        ...record,
        employee_name: (employeeData as any).name_ko,
        employee_email: (employeeData as any).email
      })) || []
      
      console.log('처리된 출퇴근 기록:', {
        totalRecords: records.length,
        records: records,
        dateRange: records.length > 0 ? {
          earliest: records[records.length - 1]?.date,
          latest: records[0]?.date
        } : null
      })
      setAttendanceRecords(records)
    } catch (error) {
      console.error('출퇴근 기록 조회 중 오류:', error)
    }
  }

  // 월별 통계 조회
  const fetchMonthlyStats = async () => {
    if (!selectedEmployee) return

    try {
      // 선택된 직원의 정보 조회
      const { data: employeeData, error: employeeError } = await supabase
        .from('team')
        .select('name_ko, email')
        .eq('email', selectedEmployee)
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

      console.log('월별 통계 조회 시작...', { employeeEmail: (employeeData as any).email, selectedMonth })

      // 월별 통계 조회 (테이블이 없을 수도 있으므로 에러 무시)
      const { data, error } = await supabase
        .from('monthly_attendance_stats')
        .select('*')
        .eq('employee_email', (employeeData as any).email)
        .eq('month', selectedMonth + '-01')
        .single()

      console.log('월별 통계 조회 결과:', { data, error })

      if (error && error.code !== 'PGRST116') {
        console.log('월별 통계 조회 오류:', error)
        setMonthlyStats([])
        return
      }

      if (data) {
        console.log('월별 통계 데이터:', data)
        setMonthlyStats([data])
      } else {
        console.log('월별 통계 데이터가 없습니다.')
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

  // 수정 모달 열기
  const handleEditRecord = (record: AttendanceRecord) => {
    setSelectedRecord(record)
    setIsEditModalOpen(true)
  }

  // 수정 모달 닫기
  const handleCloseEditModal = () => {
    setIsEditModalOpen(false)
    setSelectedRecord(null)
  }

  // 수정 완료 후 데이터 새로고침
  const handleUpdateComplete = async () => {
    await Promise.all([
      fetchTodayRecords(),
      fetchAttendanceRecords(),
      fetchMonthlyStats()
    ])
  }

  // 데이터 새로고침
  const refreshData = async () => {
    console.log('refreshData 시작')
    setLoading(true)
    await Promise.all([
      fetchTodayRecords(),
      fetchAttendanceRecords(),
      fetchMonthlyStats()
    ])
    setLoading(false)
    console.log('refreshData 완료')
  }

  useEffect(() => {
    console.log('useEffect 실행, authUser:', authUser?.email, 'selectedMonth:', selectedMonth)
    checkAdminPermission()
    fetchTeamMembers()
  }, [authUser])

  useEffect(() => {
    if (selectedEmployee) {
      refreshData()
    }
  }, [selectedEmployee, selectedMonth])

  const formatTime = (timeString: string | null) => {
    if (!timeString) return '-'
    // UTC 시간을 라스베가스 시간대로 정확하게 변환 (썸머타임 자동 처리)
    const utcDate = new Date(timeString)
    // Intl.DateTimeFormat을 사용하여 썸머타임을 자동으로 처리
    const formatter = new Intl.DateTimeFormat('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Los_Angeles',
      hour12: false
    })
    return formatter.format(utcDate)
  }

  // UTC 시간을 라스베가스 현지 날짜로 변환 (요일 포함)
  const formatDateFromUTC = (utcTimeString: string) => {
    if (!utcTimeString) return '-'
    
    const utcDate = new Date(utcTimeString)
    const lasVegasDate = new Date(utcDate.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}))
    
    const year = lasVegasDate.getFullYear()
    const month = lasVegasDate.getMonth() + 1
    const day = lasVegasDate.getDate()
    const weekday = lasVegasDate.toLocaleDateString('ko-KR', { weekday: 'short' })
    
    return `${year}년 ${month}월 ${day}일 (${weekday})`
  }

  // 날짜 문자열에서 요일 추출 (date 필드용) - 라스베가스 현지 시간 기준
  const formatDateWithWeekday = (dateString: string) => {
    if (!dateString) return '-'
    
    // UTC 날짜를 라스베가스 현지 시간으로 변환
    const utcDate = new Date(dateString + 'T00:00:00')
    const lasVegasDate = new Date(utcDate.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}))
    
    const year = lasVegasDate.getFullYear()
    const month = lasVegasDate.getMonth() + 1
    const day = lasVegasDate.getDate()
    const weekday = lasVegasDate.toLocaleDateString('ko-KR', { weekday: 'short' })
    
    return `${year}년 ${month}월 ${day}일 (${weekday})`
  }

  const formatWorkHours = (hours: number) => {
    if (hours === 0) return '-'
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    return `${h}시간 ${m}분`
  }

  // 날짜별 배경 색상 결정 함수
  const getDateBackgroundColor = (date: string) => {
    // 날짜별로 고유한 색상 배열 생성
    const colors = [
      'bg-blue-50 hover:bg-blue-100',      // 연한 파란색
      'bg-green-50 hover:bg-green-100',    // 연한 초록색
      'bg-yellow-50 hover:bg-yellow-100',  // 연한 노란색
      'bg-purple-50 hover:bg-purple-100',  // 연한 보라색
      'bg-pink-50 hover:bg-pink-100',      // 연한 분홍색
      'bg-indigo-50 hover:bg-indigo-100',  // 연한 남색
      'bg-red-50 hover:bg-red-100',       // 연한 빨간색
      'bg-gray-50 hover:bg-gray-100',     // 연한 회색
    ]
    
    // 날짜 문자열을 해시하여 일관된 색상 선택
    let hash = 0
    for (let i = 0; i < date.length; i++) {
      hash = ((hash << 5) - hash + date.charCodeAt(i)) & 0xffffffff
    }
    
    const colorIndex = Math.abs(hash) % colors.length
    return colors[colorIndex]
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
              {isAdmin ? '직원 출퇴근 기록을 관리합니다.' : `${authUser?.name || authUser?.email?.split('@')[0]}님의 출퇴근 기록을 관리합니다.`}
            </p>
            
            {/* 어드민인 경우 직원 선택 드롭다운 */}
            {isAdmin && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Users className="w-4 h-4 inline mr-1" />
                  직원 선택
                </label>
                <select
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {teamMembers.map((member) => (
                    <option key={member.email} value={member.email}>
                      {member.name_ko} ({member.position}) - {member.email}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="text-sm text-gray-500 mt-1">
              현재 시간: {new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (한국) | 
              {new Date().toLocaleString('ko-KR', { timeZone: 'America/Los_Angeles' })} (라스베가스)
            </div>
            <div className="text-xs text-blue-600 mt-1">
              💡 하루를 넘나드는 근무 (오후 12시~다음날 오전 1시)를 고려하여 최근 2일간의 미체크아웃 기록을 조회합니다.
            </div>
          </div>
          <div className="flex space-x-3">
            {isAdmin && (
              <>
                <button
                  onClick={() => setIsAddFormOpen(true)}
                  className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  기록 추가
                </button>
                <button
                  onClick={() => setIsBiweeklyCalculatorOpen(true)}
                  className="flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 border border-green-600 rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Calculator className="w-4 h-4 mr-2" />
                  2주급 계산기
                </button>
                <button
                  onClick={() => setIsTotalEmployeesModalOpen(true)}
                  className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Users className="w-4 h-4 mr-2" />
                  전체 직원 총합
                </button>
              </>
            )}
            <button
              onClick={refreshData}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              새로고침
            </button>
          </div>
        </div>
      </div>

      {/* 오늘의 출퇴근 상태 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Calendar className="w-5 h-5 mr-2 text-green-600" />
          {isAdmin ? `${teamMembers.find(m => m.email === selectedEmployee)?.name_ko || '선택된 직원'}의 출퇴근 상태` : '오늘의 출퇴근 상태'}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">현재 세션</div>
            <div className="text-lg font-semibold text-gray-900">
              {isAdmin ? 
                (currentSessionForSelectedEmployee ? `${currentSessionForSelectedEmployee.session_number}번째` : '없음') :
                (currentSession ? `${currentSession.session_number}번째` : '없음')
              }
            </div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">출근 시간</div>
            <div className="text-lg font-semibold text-gray-900">
              {isAdmin ? 
                (currentSessionForSelectedEmployee?.check_in_time ? formatTime(currentSessionForSelectedEmployee.check_in_time) : '-') :
                (currentSession?.check_in_time ? formatTime(currentSession.check_in_time) : '-')
              }
            </div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">총 근무 시간</div>
            <div className="text-lg font-semibold text-gray-900">
              {formatWorkHours(todayRecords.reduce((total, record) => total + (record.work_hours || 0), 0))}
            </div>
          </div>
        </div>

        {/* 현재 진행 중인 세션 */}
        {(isAdmin ? currentSessionForSelectedEmployee : currentSession) && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">현재 진행 중인 세션</h3>
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="text-sm font-medium text-gray-600">
                    {(isAdmin ? currentSessionForSelectedEmployee : currentSession)?.session_number}번째 세션
                  </div>
                  <div className="text-sm text-gray-900">
                    출근: {formatTime((isAdmin ? currentSessionForSelectedEmployee?.check_in_time : currentSession?.check_in_time) || null)} (라스베가스 현지시간)
                  </div>
                  <div className="text-sm text-gray-900">
                    날짜: {(isAdmin ? currentSessionForSelectedEmployee : currentSession)?.date || ''}
                  </div>
                </div>
                <div className="px-3 py-1 text-sm bg-yellow-100 text-yellow-800 rounded-full">
                  진행중
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 오늘의 출퇴근 기록 목록 */}
        {todayRecords.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">오늘의 출퇴근 기록</h3>
            <div className="space-y-2">
              {todayRecords.map((record) => (
                <div key={record.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="text-sm font-medium text-gray-600">
                      {record.session_number}번째
                    </div>
                    <div className="text-sm text-gray-900">
                      출근: {formatTime(record.check_in_time)} (라스베가스)
                    </div>
                    <div className="text-sm text-gray-900">
                      퇴근: {formatTime(record.check_out_time)} (라스베가스)
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
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
          {isAdmin ? `${teamMembers.find(m => m.email === selectedEmployee)?.name_ko || '선택된 직원'}의 ${selectedMonth} 월별 근무 통계` : `${selectedMonth} 월별 근무 통계`}
        </h2>
        
        {monthlyStats.length > 0 ? (
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
        ) : (
          <div className="text-center py-8 text-gray-500">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium mb-2">월별 통계가 없습니다</p>
            <p className="text-sm">
              {selectedMonth}월의 출퇴근 기록이 없거나 아직 통계가 생성되지 않았습니다.
            </p>
            <p className="text-xs text-gray-400 mt-2">
              출근 체크인을 하시면 자동으로 통계가 생성됩니다.
            </p>
          </div>
        )}
      </div>

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
            <p className="text-lg font-medium mb-2">출퇴근 기록이 없습니다</p>
            <p className="text-sm mb-2">
              {selectedMonth}월의 출퇴근 기록이 없습니다.
            </p>
            <p className="text-xs text-gray-400">
              출근 체크인을 하시면 기록이 생성됩니다.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {isAdmin && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    출근 날짜
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    출근 시간 (라스베가스)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    퇴근 날짜
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    퇴근 시간 (라스베가스)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    근무 시간
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  {canEditAttendance && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      작업
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {attendanceRecords.map((record) => (
                  <tr key={record.id} className={`${getDateBackgroundColor(record.date)} transition-colors`}>
                    {isAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {record.id}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.check_in_time ? formatDateFromUTC(record.check_in_time) : formatDateWithWeekday(record.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatTime(record.check_in_time)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.check_out_time ? formatDateFromUTC(record.check_out_time) : '-'}
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
                    {canEditAttendance && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleEditRecord(record)}
                          className="text-blue-600 hover:text-blue-900 flex items-center"
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          수정
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 수정 모달 */}
      <AttendanceEditModal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        record={selectedRecord}
        onUpdate={handleUpdateComplete}
      />

      {/* 추가 모달 */}
      <AddAttendanceForm
        isOpen={isAddFormOpen}
        onClose={() => setIsAddFormOpen(false)}
        onSuccess={refreshData}
        selectedEmployee={selectedEmployee}
        selectedMonth={selectedMonth}
      />

      {/* 2주급 계산기 모달 */}
      <BiweeklyCalculatorModal
        isOpen={isBiweeklyCalculatorOpen}
        onClose={() => setIsBiweeklyCalculatorOpen(false)}
        locale={locale}
      />

      {/* 전체 직원 총합 모달 */}
      <TotalEmployeesModal
        isOpen={isTotalEmployeesModalOpen}
        onClose={() => setIsTotalEmployeesModalOpen(false)}
        locale={locale}
      />
    </div>
  )
}
