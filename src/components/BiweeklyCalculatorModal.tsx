'use client'

import React, { useState, useEffect } from 'react'
import { X, Calculator, Clock, DollarSign, Calendar, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface BiweeklyCalculatorModalProps {
  isOpen: boolean
  onClose: () => void
  locale?: string
}

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

interface TourFee {
  id: string
  tour_id: string
  tour_name: string
  date: string
  guide_fee: number
  driver_fee: number
  total_fee: number
}

export default function BiweeklyCalculatorModal({ isOpen, onClose, locale = 'ko' }: BiweeklyCalculatorModalProps) {
  const [hourlyRate, setHourlyRate] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [totalHours, setTotalHours] = useState<number>(0)
  const [totalPay, setTotalPay] = useState<number>(0)
  const [attendancePay, setAttendancePay] = useState<number>(0)
  const [tourPay, setTourPay] = useState<number>(0)
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<string>('')
  const [teamMembers, setTeamMembers] = useState<Array<{email: string, name_ko: string, position: string}>>([])
  const [tourFees, setTourFees] = useState<TourFee[]>([])

  // 현재 날짜 기준으로 기본값 설정
  const getDefaultDates = () => {
    const today = new Date()
    const twoWeeksAgo = new Date(today)
    twoWeeksAgo.setDate(today.getDate() - 13) // 14일 전이 아닌 13일 전으로 설정 (오늘 포함)
    
    return {
      start: twoWeeksAgo.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0]
    }
  }

  // 이번 기간 설정 함수
  const setCurrentPeriod = () => {
    const today = new Date()
    const day = today.getDate()
    
    let startDate, endDate
    
    if (day >= 1 && day <= 15) {
      // 1~15일: 이번 달 1일~15일
      startDate = new Date(today.getFullYear(), today.getMonth(), 1)
      endDate = new Date(today.getFullYear(), today.getMonth(), 15)
    } else {
      // 16일~말일: 이번 달 16일~말일
      startDate = new Date(today.getFullYear(), today.getMonth(), 16)
      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0) // 다음 달 0일 = 이번 달 말일
    }
    
    setStartDate(startDate.toISOString().split('T')[0])
    setEndDate(endDate.toISOString().split('T')[0])
  }

  // 지난 기간 설정 함수
  const setPreviousPeriod = () => {
    const today = new Date()
    const day = today.getDate()
    
    let startDate, endDate
    
    if (day >= 1 && day <= 15) {
      // 현재가 1~15일이면 지난 달 16일~말일
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 16)
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0) // 이번 달 0일 = 지난 달 말일
      startDate = lastMonth
      endDate = lastMonthEnd
    } else {
      // 현재가 16일~말일이면 이번 달 1일~15일
      startDate = new Date(today.getFullYear(), today.getMonth(), 1)
      endDate = new Date(today.getFullYear(), today.getMonth(), 15)
    }
    
    setStartDate(startDate.toISOString().split('T')[0])
    setEndDate(endDate.toISOString().split('T')[0])
  }

  // 팀 멤버 목록 조회 (op와 office manager만)
  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('team')
        .select('email, name_ko, position')
        .eq('is_active', true)
        .order('name_ko')

      if (error) {
        console.error('팀 멤버 조회 오류:', error)
        return
      }

      // op, office manager, 가이드, 드라이버 필터링
      const filteredMembers = (data || []).filter(member => {
        const position = member.position?.toLowerCase()
        return position === 'op' || 
               position === 'office manager' || 
               position === '가이드' || 
               position === 'guide' ||
               position === 'tour guide' ||
               position === '드라이버' || 
               position === 'driver'
      })

      setTeamMembers(filteredMembers)
      if (filteredMembers.length > 0) {
        const firstMember = filteredMembers[0]
        setSelectedEmployee(firstMember.email)
        
        // 첫 번째 직원의 position에 따라 시급 설정
        const position = firstMember.position?.toLowerCase()
        if (position === 'op') {
          setHourlyRate('15')
        } else if (position === 'office manager') {
          setHourlyRate('17')
        } else {
          setHourlyRate('')
        }
      }

      // 기본 날짜 설정
      const defaultDates = getDefaultDates()
      setStartDate(defaultDates.start)
      setEndDate(defaultDates.end)
    } catch (error) {
      console.error('팀 멤버 조회 오류:', error)
    }
  }

  // 출퇴근 기록 조회
  const fetchAttendanceRecords = async () => {
    if (!selectedEmployee || !startDate || !endDate) {
      setAttendanceRecords([])
      setTotalHours(0)
      return
    }

    setLoading(true)
    try {
      // 날짜 형식 검증 및 디버깅
      console.log('입력된 날짜:', {
        startDate,
        endDate,
        startDateType: typeof startDate,
        endDateType: typeof endDate
      })

      // 날짜 유효성 검사
      if (!startDate || !endDate) {
        console.error('날짜가 비어있음:', { startDate, endDate })
        setAttendanceRecords([])
        setTotalHours(0)
        return
      }

      // 날짜 형식 검증
      const startDateObj = new Date(startDate)
      const endDateObj = new Date(endDate)
      
      if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
        console.error('잘못된 날짜 형식:', { startDate, endDate })
        setAttendanceRecords([])
        setTotalHours(0)
        return
      }

      console.log('조회 조건:', {
        employee: selectedEmployee,
        startDate,
        endDate,
        startDateISO: startDateObj.toISOString().split('T')[0],
        endDateISO: endDateObj.toISOString().split('T')[0]
      })

      // 먼저 출퇴근 기록만 조회 - 종료일 포함
      const query = supabase
        .from('attendance_records')
        .select('id, employee_email, date, check_in_time, check_out_time, work_hours, status, notes, session_number')
        .eq('employee_email', selectedEmployee)
        .gte('date', startDate)
        .lte('date', endDate) // 종료일 포함
        .order('date', { ascending: true })

      console.log('실행할 쿼리:', {
        table: 'attendance_records',
        select: 'id, employee_email, date, check_in_time, check_out_time, work_hours, status, notes, session_number',
        filters: {
          employee_email: selectedEmployee,
          date_gte: startDate,
          date_lte: endDate
        }
      })

      const { data: attendanceData, error: attendanceError } = await query

      if (attendanceError) {
        console.error('출퇴근 기록 조회 오류:', attendanceError)
        setAttendanceRecords([])
        setTotalHours(0)
        return
      }

      console.log('조회된 출퇴근 기록 (필터링 전):', attendanceData)
      console.log('조회된 기록 수 (필터링 전):', attendanceData?.length || 0)
      
      // 클라이언트 사이드에서 추가 필터링 (Supabase 필터가 제대로 작동하지 않는 경우 대비)
      const filteredData = attendanceData?.filter(record => {
        const recordDate = record.date
        const isInRange = recordDate >= startDate && recordDate <= endDate
        
        console.log('날짜 필터링 체크:', {
          recordDate,
          startDate,
          endDate,
          isInRange,
          gte: recordDate >= startDate,
          lte: recordDate <= endDate
        })
        
        return isInRange
      }) || []

      console.log('필터링된 출퇴근 기록:', filteredData)
      console.log('필터링된 기록 수:', filteredData.length)
      
      if (filteredData.length > 0) {
        console.log('첫 번째 기록 날짜:', filteredData[0].date)
        console.log('마지막 기록 날짜:', filteredData[filteredData.length - 1].date)
        console.log('모든 기록의 날짜들:', filteredData.map(r => r.date))
      }

      // 선택된 직원의 이름 조회
      const { data: teamData, error: teamError } = await supabase
        .from('team')
        .select('name_ko')
        .eq('email', selectedEmployee)
        .single()

      const employeeName = teamData?.name_ko || ''

      const records = filteredData.map(record => ({
        ...record,
        employee_name: employeeName
      }))

      // 출근 날짜 순으로 정렬 (check_in_time 기준)
      const sortedRecords = records.sort((a, b) => {
        if (!a.check_in_time || !b.check_in_time) return 0
        
        const dateA = new Date(a.check_in_time)
        const dateB = new Date(b.check_in_time)
        
        return dateA.getTime() - dateB.getTime()
      })

      setAttendanceRecords(sortedRecords)
      
      // 실제 근무시간 계산
      const actualTotalHours = sortedRecords.reduce((sum, record) => {
        let workHours = record.work_hours || 0
        // 8시간을 넘으면 30분 식사시간 차감
        if (workHours > 8) {
          workHours = workHours - 0.5
        }
        return sum + workHours
      }, 0)
      
      setTotalHours(actualTotalHours)
      
      // 시급이 입력되어 있으면 출퇴근 급여 계산
      if (hourlyRate && !isNaN(Number(hourlyRate))) {
        const attendanceSalary = actualTotalHours * Number(hourlyRate)
        setAttendancePay(attendanceSalary)
        setTotalPay(attendanceSalary + tourPay)
      } else {
        setAttendancePay(0)
        setTotalPay(tourPay)
      }
    } catch (error) {
      console.error('출퇴근 기록 조회 오류:', error)
      setAttendanceRecords([])
      setTotalHours(0)
    } finally {
      setLoading(false)
    }
  }

  // 컴포넌트 마운트 시 팀 멤버 조회
  useEffect(() => {
    if (isOpen) {
      fetchTeamMembers()
    }
  }, [isOpen])

  // 투어 fee 데이터 조회 (선택된 직원 필터링)
  const fetchTourFees = async () => {
    if (!startDate || !endDate || !selectedEmployee) {
      setTourFees([])
      return
    }

    try {
      const { data, error } = await supabase
        .from('tours')
        .select(`
          id,
          tour_date,
          tour_guide_id,
          assistant_id,
          guide_fee,
          assistant_fee,
          team_type,
          products!inner(name_ko)
        `)
        .gte('tour_date', startDate)
        .lte('tour_date', endDate)
        .or(`tour_guide_id.eq.${selectedEmployee},assistant_id.eq.${selectedEmployee}`)
        .order('tour_date', { ascending: true })

      if (error) {
        console.error('투어 fee 조회 오류:', error)
        setTourFees([])
        return
      }

      const fees = data?.map(tour => {
        // 선택된 직원이 가이드인지 어시스턴트인지 확인
        const isGuide = tour.tour_guide_id === selectedEmployee
        const isAssistant = tour.assistant_id === selectedEmployee
        
        return {
          id: tour.id,
          tour_id: tour.id,
          tour_name: (tour.products as any)?.name_ko || '투어명 없음',
          date: tour.tour_date,
          team_type: tour.team_type || '',
          guide_fee: isGuide ? (tour.guide_fee || 0) : 0,
          driver_fee: isAssistant ? (tour.assistant_fee || 0) : 0,
          total_fee: isGuide ? (tour.guide_fee || 0) : (tour.assistant_fee || 0)
        }
      }) || []

      setTourFees(fees)
      
      // 투어 급여 계산
      const tourSalary = fees.reduce((sum, tour) => sum + tour.total_fee, 0)
      setTourPay(tourSalary)
      setTotalPay(attendancePay + tourSalary)
    } catch (error) {
      console.error('투어 fee 조회 오류:', error)
      setTourFees([])
    }
  }

  // 날짜나 직원이 변경될 때 출퇴근 기록 조회
  useEffect(() => {
    if (selectedEmployee && startDate && endDate) {
      fetchAttendanceRecords()
    }
  }, [selectedEmployee, startDate, endDate])

  // 날짜나 직원이 변경될 때 투어 fee 조회
  useEffect(() => {
    if (selectedEmployee && startDate && endDate) {
      fetchTourFees()
    }
  }, [selectedEmployee, startDate, endDate])

  // 시급 입력 핸들러
  const handleHourlyRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setHourlyRate(value)
    
    // 숫자만 입력 허용하고 출퇴근 급여 계산
    if (value === '' || !isNaN(Number(value))) {
      if (value && !isNaN(Number(value)) && totalHours > 0) {
        const attendanceSalary = totalHours * Number(value)
        setAttendancePay(attendanceSalary)
        setTotalPay(attendanceSalary + tourPay)
      } else {
        setAttendancePay(0)
        setTotalPay(tourPay)
      }
    }
  }

  // 날짜 변경 핸들러
  const handleDateChange = (type: 'start' | 'end', value: string) => {
    if (type === 'start') {
      setStartDate(value)
    } else {
      setEndDate(value)
    }
  }

  // 직원 선택 핸들러
  const handleEmployeeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedEmail = e.target.value
    setSelectedEmployee(selectedEmail)
    
    // 선택된 직원의 position에 따라 시급 설정
    const selectedMember = teamMembers.find(member => member.email === selectedEmail)
    if (selectedMember) {
      const position = selectedMember.position?.toLowerCase()
      if (position === 'op') {
        setHourlyRate('15')
      } else if (position === 'office manager') {
        setHourlyRate('17')
      } else {
        // 다른 position의 경우 기본값 없음
        setHourlyRate('')
      }
    }
  }

  // 모달 닫기
  const handleClose = () => {
    setHourlyRate('')
    setStartDate('')
    setEndDate('')
    setTotalHours(0)
    setTotalPay(0)
    setAttendancePay(0)
    setTourPay(0)
    setAttendanceRecords([])
    setSelectedEmployee('')
    setTourFees([])
    onClose()
  }

  // 시간 포맷팅 함수
  const formatTime = (timeString: string | null) => {
    if (!timeString) return '-'
    return new Date(timeString).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  // 근무시간을 시간과 분으로 변환하는 함수
  const formatWorkHours = (hours: number) => {
    const wholeHours = Math.floor(hours)
    const minutes = Math.round((hours - wholeHours) * 60)
    return `${wholeHours}시간 ${minutes}분`
  }

  // check_in_time을 라스베가스 시간으로 변환하여 날짜 추출하는 함수
  const getDateFromCheckInTime = (checkInTime: string | null) => {
    if (!checkInTime) return '-'
    
    // UTC 시간을 라스베가스 시간으로 변환
    const utcDate = new Date(checkInTime)
    
    // 라스베가스 시간대 (America/Los_Angeles)로 변환
    const lasVegasTime = new Date(utcDate.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}))
    
    return lasVegasTime.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  // 날짜 포맷팅 함수 (시간대 변환 없이)
  const formatDate = (dateString: string) => {
    // YYYY-MM-DD 형식의 문자열을 그대로 사용
    const [year, month, day] = dateString.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    
    const formatted = date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short'
    })
    
    console.log('날짜 포맷팅:', {
      input: dateString,
      year, month, day,
      formatted
    })
    
    return formatted
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <Calculator className="w-6 h-6 text-blue-600 mr-2" />
            <h2 className="text-xl font-bold text-gray-900">2주급 계산기</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 내용 */}
        <div className="p-6 space-y-6">
          {/* 직원 선택 */}
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700 w-20 flex-shrink-0">
              <User className="w-4 h-4 inline mr-1" />
              직원 선택
            </label>
            <select
              value={selectedEmployee}
              onChange={handleEmployeeChange}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">직원을 선택하세요</option>
              {teamMembers.map((member) => (
                <option key={member.email} value={member.email}>
                  {member.name_ko} ({member.position}) - {member.email}
                </option>
              ))}
            </select>
            <div className="flex space-x-2">
              <button
                onClick={setCurrentPeriod}
                className="px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                이번
              </button>
              <button
                onClick={setPreviousPeriod}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                지난
              </button>
            </div>
          </div>

          {/* 입력 필드들 - 같은 줄에 배치 */}
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                <Calendar className="w-4 h-4 inline mr-1" />
                시작일
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleDateChange('start', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                <Calendar className="w-4 h-4 inline mr-1" />
                종료일
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleDateChange('end', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                <DollarSign className="w-4 h-4 inline mr-1" />
                시급 ($)
              </label>
              <input
                type="text"
                value={hourlyRate}
                onChange={handleHourlyRateChange}
                placeholder="예: 15.00"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* 계산 결과 */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                <Clock className="w-4 h-4 inline mr-1" />
                총 근무 시간:
              </span>
              <span className="text-lg font-bold text-blue-600">
                {loading ? '계산 중...' : formatWorkHours(totalHours)}
              </span>
            </div>
            
            {hourlyRate && !isNaN(Number(hourlyRate)) && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    <DollarSign className="w-4 h-4 inline mr-1" />
                    출퇴근 기록 소계:
                  </span>
                  <span className="text-lg font-bold text-blue-600">
                    ${attendancePay.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    <DollarSign className="w-4 h-4 inline mr-1" />
                    투어 Fee 소계:
                  </span>
                  <span className="text-lg font-bold text-purple-600">
                    ${tourPay.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="text-sm font-medium text-gray-700">
                    <DollarSign className="w-4 h-4 inline mr-1" />
                    총 급여:
                  </span>
                  <span className="text-xl font-bold text-green-600">
                    ${totalPay.toFixed(2)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* 출퇴근 기록 테이블 */}
          {attendanceRecords.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                출퇴근 기록 ({new Set(attendanceRecords.map(record => {
                  if (!record.check_in_time) return record.date
                  const utcDate = new Date(record.check_in_time)
                  const lasVegasTime = new Date(utcDate.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}))
                  return lasVegasTime.toISOString().split('T')[0]
                })).size}일, 총 {attendanceRecords.length}회)
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        출근 날짜 (라스베가스 시간)
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        출근 시간
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        퇴근 시간
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        근무시간
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        식사시간 차감 후
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        상태
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {attendanceRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          {getDateFromCheckInTime(record.check_in_time)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          {formatTime(record.check_in_time)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          {formatTime(record.check_out_time)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          {record.work_hours ? formatWorkHours(record.work_hours) : '-'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          {record.work_hours ? formatWorkHours(record.work_hours > 8 ? record.work_hours - 0.5 : record.work_hours) : '-'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
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
            </div>
          )}

          {/* 투어 Fee 테이블 */}
          {tourFees.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                투어 Fee ({tourFees.length}개 투어)
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        투어 날짜
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        투어명
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        팀 타입
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        가이드 Fee
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        드라이버 Fee
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        총 Fee
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {tourFees.map((tour) => (
                      <tr key={tour.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(tour.date)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          <Link 
                            href={`/${locale}/admin/tours/${tour.tour_id}`}
                            className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          >
                            {tour.tour_name}
                          </Link>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          {tour.team_type || '-'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          ${tour.guide_fee.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          ${tour.driver_fee.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-green-600">
                          ${tour.total_fee.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={5} className="px-3 py-2 text-right text-sm font-medium text-gray-900">
                        총합:
                      </td>
                      <td className="px-3 py-2 text-sm font-bold text-green-600">
                        ${tourFees.reduce((sum, tour) => sum + tour.total_fee, 0).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* 안내 메시지 */}
          <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg">
            💡 실제 출퇴근 기록을 기반으로 근무시간을 계산합니다. 기록이 없는 날은 제외됩니다.
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex justify-end p-6 border-t border-gray-200">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
