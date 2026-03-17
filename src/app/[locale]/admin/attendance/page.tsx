'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Clock, CheckCircle, XCircle, Calendar, User, BarChart3, RefreshCw, Edit, Users, Plus, Calculator, DollarSign } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import AddAttendanceForm from '@/components/AddAttendanceForm'
import { useAttendanceSync } from '@/hooks/useAttendanceSync'
import AttendanceEditModal from '@/components/attendance/AttendanceEditModal'
import OfficeTipsModal from '@/components/attendance/OfficeTipsModal'
import BiweeklyCalculatorModal from '@/components/BiweeklyCalculatorModal'
import TotalEmployeesModal from '@/components/TotalEmployeesModal'
import TipsShareModal from '@/components/TipsShareModal'
import BonusCalculatorModal from '@/components/BonusCalculatorModal'
import ReservationForm from '@/components/reservation/ReservationForm'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

const ReservationFormAny = ReservationForm as React.ComponentType<any>

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
  const { authUser, userPosition } = useAuth()
  const isSuper = userPosition === 'super'
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations('attendancePage')
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [todayRecords, setTodayRecords] = useState<AttendanceRecord[]>([])
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null)
  const [canEditAttendance, setCanEditAttendance] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  /** Tips 쉐어 버튼 표시 (super + manager / office manager) */
  const [canViewTipsShare, setCanViewTipsShare] = useState(false)
  const [teamMembers, setTeamMembers] = useState<Array<{email: string, name_ko: string, position: string}>>([])
  const [selectedEmployee, setSelectedEmployee] = useState<string>('')
  const [currentSessionForSelectedEmployee, setCurrentSessionForSelectedEmployee] = useState<AttendanceRecord | null>(null)
  const [employeeNotFound, setEmployeeNotFound] = useState(false)
  const [isAddFormOpen, setIsAddFormOpen] = useState(false)
  const [isBiweeklyCalculatorOpen, setIsBiweeklyCalculatorOpen] = useState(false)
  const [isTotalEmployeesModalOpen, setIsTotalEmployeesModalOpen] = useState(false)
  const [totalEmployeesOverdueCount, setTotalEmployeesOverdueCount] = useState(0)
  const [isTipsShareModalOpen, setIsTipsShareModalOpen] = useState(false)
  const [isOfficeTipsModalOpen, setIsOfficeTipsModalOpen] = useState(false)
  const [isBonusCalculatorOpen, setIsBonusCalculatorOpen] = useState(false)
  /** Tips 쉐어 모달에서 예약 클릭 시 예약 수정 모달용 */
  const [reservationIdForEdit, setReservationIdForEdit] = useState<string | null>(null)
  const [editingReservation, setEditingReservation] = useState<any>(null)
  const [reservationFormData, setReservationFormData] = useState<{
    customers: any[]
    products: any[]
    channels: any[]
    productOptions: any[]
    options: any[]
    pickupHotels: any[]
    coupons: any[]
  } | null>(null)
  const [loadingReservationForEdit, setLoadingReservationForEdit] = useState(false)
  
  // 어드민 권한 체크
  const checkAdminPermission = async () => {
    if (!authUser?.email) return
    
    try {
      const { data: teamData, error } = await supabase
        .from('team')
        .select('position')
        .eq('email', authUser.email)
        .eq('is_active', true)
        .maybeSingle()
      
      if (error || !teamData) {
        setIsAdmin(false)
        setCanEditAttendance(false)
        setCanViewTipsShare(false)
        return
      }
      
      const position = (teamData as any).position?.toLowerCase()
      const isAdminUser = position === 'super'
      const isManager = position === 'manager' || position === 'office manager'
      
      setIsAdmin(isAdminUser)
      setCanEditAttendance(position === 'super')
      setCanViewTipsShare(isAdminUser || isManager)
    } catch (error) {
      console.error('권한 체크 오류:', error)
      setIsAdmin(false)
      setCanEditAttendance(false)
      setCanViewTipsShare(false)
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

  // DB 예약 → 폼 타입 변환 (attendance 페이지용, tour 컨텍스트 없음)
  const convertReservationToFormType = useCallback((reservation: any): any => {
    return {
      id: reservation.id,
      customerId: reservation.customer_id || '',
      productId: reservation.product_id || '',
      tourDate: reservation.tour_date || '',
      tourTime: reservation.tour_time || '',
      eventNote: reservation.event_note || '',
      pickUpHotel: reservation.pickup_hotel || '',
      pickUpTime: reservation.pickup_time || '',
      adults: reservation.adults || 0,
      child: reservation.child || 0,
      infant: reservation.infant || 0,
      totalPeople: reservation.total_people || 0,
      channelId: reservation.channel_id || '',
      channelRN: reservation.channel_rn || '',
      addedBy: reservation.added_by || '',
      addedTime: reservation.created_at || '',
      tourId: reservation.tour_id || '',
      status: (reservation.status as 'pending' | 'confirmed' | 'completed' | 'cancelled') || 'pending',
      selectedOptions: (typeof reservation.selected_options === 'string'
        ? (() => { try { return JSON.parse(reservation.selected_options) } catch { return {} } })()
        : (reservation.selected_options as { [optionId: string]: string[] }) || {}),
      selectedOptionPrices: (typeof reservation.selected_option_prices === 'string'
        ? (() => { try { return JSON.parse(reservation.selected_option_prices) } catch { return {} } })()
        : (reservation.selected_option_prices as { [key: string]: number }) || {}),
      isPrivateTour: reservation.is_private_tour || false
    }
  }, [])

  // Tips 쉐어 모달에서 예약 클릭 시 → 예약 + 폼 데이터 로드 후 수정 모달 표시
  useEffect(() => {
    if (!reservationIdForEdit) return
    let cancelled = false
    setLoadingReservationForEdit(true)
    ;(async () => {
      try {
        const { data: reservation, error: resError } = await supabase
          .from('reservations')
          .select('*')
          .eq('id', reservationIdForEdit)
          .maybeSingle()
        if (resError || !reservation || cancelled) {
          setLoadingReservationForEdit(false)
          setReservationIdForEdit(null)
          return
        }
        const [customersRes, productsRes, channelsRes, productOptionsRes, optionsRes, pickupHotelsRes, couponsRes] = await Promise.all([
          supabase.from('customers').select('*').order('created_at', { ascending: false }).limit(2000),
          supabase.from('products').select('*').order('name', { ascending: true }).limit(2000),
          supabase.from('channels').select('id, name, type, favicon_url, pricing_type, commission_base_price_only, category, has_not_included_price, not_included_type, not_included_price, commission_percent, commission').order('name', { ascending: true }),
          supabase.from('product_options').select('*').order('name', { ascending: true }),
          supabase.from('options').select('*').order('name', { ascending: true }),
          supabase.from('pickup_hotels').select('*').eq('is_active', true).order('hotel', { ascending: true }),
          supabase.from('coupons').select('*').eq('status', 'active').order('coupon_code', { ascending: true })
        ])
        if (cancelled) return
        setReservationFormData({
          customers: customersRes.data || [],
          products: productsRes.data || [],
          channels: channelsRes.data || [],
          productOptions: productOptionsRes.data || [],
          options: optionsRes.data || [],
          pickupHotels: pickupHotelsRes.data || [],
          coupons: couponsRes.data || []
        })
        setEditingReservation(convertReservationToFormType(reservation))
      } catch (e) {
        console.error('예약/폼 데이터 로드 오류:', e)
      } finally {
        if (!cancelled) setLoadingReservationForEdit(false)
        setReservationIdForEdit(null)
      }
    })()
    return () => { cancelled = true }
  }, [reservationIdForEdit, convertReservationToFormType])

  const handleOpenReservationFromTips = useCallback((reservationId: string) => {
    setReservationIdForEdit(reservationId)
  }, [])

  const handleCloseReservationEditModal = useCallback(() => {
    setEditingReservation(null)
    setReservationFormData(null)
  }, [])

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
        .maybeSingle()

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
        .maybeSingle()

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
        .maybeSingle()

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
        .maybeSingle()

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

  // 출근 시각 기준 날짜(라스베가스) YYYY-MM-DD
  const getCheckInDate = useCallback((r: AttendanceRecord): string => {
    if (r.check_in_time) {
      const utc = new Date(r.check_in_time)
      const lv = new Date(utc.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
      const y = lv.getFullYear()
      const m = String(lv.getMonth() + 1).padStart(2, '0')
      const d = String(lv.getDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    }
    return r.date
  }, [])

  // 월별 그래프용: 해당 월 전체 날짜(1일~말일) + 출근 날짜 기준 근무시간(해당 일자 출근한 세션의 전체 시간만 그 날에 합산)
  const monthlyChartData = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    const byDate: Record<string, number> = {}
    attendanceRecords.forEach((r) => {
      const checkInDate = getCheckInDate(r)
      byDate[checkInDate] = (byDate[checkInDate] || 0) + (r.work_hours || 0)
    })
    const result: { date: number; dateLabel: string; fullDate: string; hours: number }[] = []
    for (let d = 1; d <= lastDay; d++) {
      const dateLabel = d < 10 ? `0${d}` : String(d)
      const fullDate = `${selectedMonth}-${dateLabel}`
      result.push({
        date: d,
        dateLabel,
        fullDate,
        hours: Math.round((byDate[fullDate] || 0) * 100) / 100
      })
    }
    return result
  }, [attendanceRecords, selectedMonth, getCheckInDate])

  // 출근 날짜 기준 월별 통계 (그래프와 동일 로직): 출근 일수, 총 근무시간, 일별 평균 근무시간
  const monthlyStatsByCheckIn = useMemo(() => {
    const monthStart = selectedMonth + '-01'
    const [y, m] = selectedMonth.split('-').map(Number)
    const monthEnd = `${selectedMonth}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
    const byDate: Record<string, number> = {}
    attendanceRecords.forEach((r) => {
      const checkInDate = getCheckInDate(r)
      byDate[checkInDate] = (byDate[checkInDate] || 0) + (r.work_hours || 0)
    })
    let totalWorkHours = 0
    let presentDays = 0
    for (const [d, hours] of Object.entries(byDate)) {
      if (d >= monthStart && d <= monthEnd) {
        presentDays += 1
        totalWorkHours += hours
      }
    }
    const avgHoursPerDay = presentDays > 0 ? Math.round((totalWorkHours / presentDays) * 100) / 100 : 0
    return { presentDays, totalWorkHours, avgHoursPerDay }
  }, [attendanceRecords, selectedMonth, getCheckInDate])

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
      <div className="flex items-center justify-center min-h-[50vh] sm:min-h-screen px-4">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-sm sm:text-base text-gray-600">{t('loading')}</p>
        </div>
      </div>
    )
  }

  // 직원 정보가 없는 경우
  if (!authUser?.email) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] sm:min-h-screen px-4">
        <div className="text-center max-w-sm">
          <User className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-gray-400" />
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">{t('loginRequired')}</h2>
          <p className="text-sm sm:text-base text-gray-600">{t('loginRequiredDesc')}</p>
        </div>
      </div>
    )
  }

  // 직원 정보를 찾을 수 없는 경우
  if (employeeNotFound) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] sm:min-h-screen px-4">
        <div className="text-center max-w-sm">
          <User className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-gray-400" />
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">{t('employeeNotFound')}</h2>
          <p className="text-sm sm:text-base text-gray-600 mb-4 break-words">
            {t('employeeNotFoundDesc', { email: authUser.email })}
          </p>
          <p className="text-xs sm:text-sm text-gray-500">
            {t('contactAdmin')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      {/* 페이지 헤더 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Clock className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600 shrink-0" />
              <span className="truncate">{t('title')}</span>
            </h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">
              {isAdmin ? t('descAdmin') : t('descUser', { name: authUser?.name || authUser?.email?.split('@')[0] || '' })}
            </p>
            
            {/* 어드민인 경우 직원 선택 드롭다운 */}
            {isAdmin && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Users className="w-4 h-4 inline mr-1" />
                  {t('selectEmployee')}
                </label>
                <select
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="w-full sm:w-auto min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  {teamMembers.map((member) => (
                    <option key={member.email} value={member.email}>
                      {member.name_ko} ({member.position}) - {member.email}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="text-xs sm:text-sm text-gray-500 mt-1 break-words">
              {t('currentTime')}: {new Date().toLocaleString(locale === 'en' ? 'en-US' : 'ko-KR', { timeZone: 'Asia/Seoul' })} ({t('korea')}) | 
              {new Date().toLocaleString(locale === 'en' ? 'en-US' : 'ko-KR', { timeZone: 'America/Los_Angeles' })} ({t('lasVegas')})
            </div>
            <div className="text-xs text-blue-600 mt-1 hidden sm:block">
              💡 {t('crossDayHint')}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3 shrink-0">
            {isAdmin && (
              <>
                <button
                  onClick={() => setIsAddFormOpen(true)}
                  className="flex flex-col items-center justify-center gap-0.5 px-3 py-2 text-white bg-blue-600 border border-blue-600 rounded-lg hover:bg-blue-700 transition-colors min-w-[3rem]"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span className="text-[8px] leading-tight font-medium whitespace-nowrap">{t('addRecord')}</span>
                </button>
                {(isAdmin || canViewTipsShare) && (
                  <button
                    onClick={() => setIsOfficeTipsModalOpen(true)}
                    className="flex flex-col items-center justify-center gap-0.5 px-3 py-2 text-white bg-amber-600 border border-amber-600 rounded-lg hover:bg-amber-700 transition-colors min-w-[3rem]"
                  >
                    <DollarSign className="w-4 h-4 shrink-0" />
                    <span className="text-[8px] leading-tight font-medium whitespace-nowrap">{t('officeTips')}</span>
                  </button>
                )}
                <button
                  onClick={() => setIsBiweeklyCalculatorOpen(true)}
                  className="flex flex-col items-center justify-center gap-0.5 px-3 py-2 text-white bg-green-600 border border-green-600 rounded-lg hover:bg-green-700 transition-colors min-w-[3rem]"
                >
                  <Calculator className="w-4 h-4 shrink-0" />
                  <span className="text-[8px] leading-tight font-medium whitespace-nowrap">{t('biweekly')}</span>
                </button>
                <button
                  onClick={() => setIsBonusCalculatorOpen(true)}
                  className="flex flex-col items-center justify-center gap-0.5 px-3 py-2 text-white bg-orange-600 border border-orange-600 rounded-lg hover:bg-orange-700 transition-colors min-w-[3rem]"
                >
                  <Calculator className="w-4 h-4 shrink-0" />
                  <span className="text-[8px] leading-tight font-medium whitespace-nowrap">{t('bonus')}</span>
                </button>
                <button
                  onClick={() => setIsTotalEmployeesModalOpen(true)}
                  className="relative flex flex-col items-center justify-center gap-0.5 px-3 py-2 text-white bg-blue-600 border border-blue-600 rounded-lg hover:bg-blue-700 transition-colors min-w-[3rem]"
                >
                  {totalEmployeesOverdueCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full">
                      {totalEmployeesOverdueCount}
                    </span>
                  )}
                  <Users className="w-4 h-4 shrink-0" />
                  <span className="text-[8px] leading-tight font-medium whitespace-nowrap">{t('totalAll')}</span>
                </button>
              </>
            )}
            {(isAdmin || canViewTipsShare) && (
              <button
                onClick={() => setIsTipsShareModalOpen(true)}
                className="flex flex-col items-center justify-center gap-0.5 px-3 py-2 text-white bg-purple-600 border border-purple-600 rounded-lg hover:bg-purple-700 transition-colors min-w-[3rem]"
              >
                <DollarSign className="w-4 h-4 shrink-0" />
                <span className="text-[8px] leading-tight font-medium whitespace-nowrap">{t('tipsShare')}</span>
              </button>
            )}
            <button
              onClick={refreshData}
              className="flex flex-col items-center justify-center gap-0.5 px-3 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors min-w-[3rem]"
            >
              <RefreshCw className="w-4 h-4 shrink-0" />
              <span className="text-[8px] leading-tight font-medium whitespace-nowrap">{t('refresh')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 오늘의 출퇴근 상태 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Calendar className="w-5 h-5 mr-2 text-green-600 shrink-0" />
          <span className="truncate">{isAdmin ? t('selectedEmployeeStatus', { name: teamMembers.find(m => m.email === selectedEmployee)?.name_ko || t('selectedEmployeeLabel') }) : t('todayStatus')}</span>
        </h2>
        
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="text-center p-3 sm:p-4 bg-gray-50 rounded-lg min-w-0">
            <div className="text-xs sm:text-sm text-gray-600 mb-1">{t('currentSession')}</div>
            <div className="text-sm sm:text-lg font-semibold text-gray-900 truncate">
              {isAdmin ? 
                (currentSessionForSelectedEmployee ? `${currentSessionForSelectedEmployee.session_number}${t('nth')}` : t('none')) :
                (currentSession ? `${currentSession.session_number}${t('nth')}` : t('none'))
              }
            </div>
          </div>
          <div className="text-center p-3 sm:p-4 bg-gray-50 rounded-lg min-w-0">
            <div className="text-xs sm:text-sm text-gray-600 mb-1">{t('checkInTime')}</div>
            <div className="text-sm sm:text-lg font-semibold text-gray-900">
              {isAdmin ? 
                (currentSessionForSelectedEmployee?.check_in_time ? formatTime(currentSessionForSelectedEmployee.check_in_time) : '-') :
                (currentSession?.check_in_time ? formatTime(currentSession.check_in_time) : '-')
              }
            </div>
          </div>
          <div className="text-center p-3 sm:p-4 bg-gray-50 rounded-lg min-w-0">
            <div className="text-xs sm:text-sm text-gray-600 mb-1">{t('totalWorkHours')}</div>
            <div className="text-sm sm:text-lg font-semibold text-gray-900">
              {formatWorkHours(todayRecords.reduce((total, record) => total + (record.work_hours || 0), 0))}
            </div>
          </div>
        </div>

        {/* 현재 진행 중인 세션 */}
        {(isAdmin ? currentSessionForSelectedEmployee : currentSession) && (
          <div className="mt-4 sm:mt-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">{t('currentSessionTitle')}</h3>
            <div className="p-3 sm:p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4 min-w-0">
                  <div className="text-sm font-medium text-gray-600">
                    {t('nthSession', { n: (isAdmin ? currentSessionForSelectedEmployee : currentSession)?.session_number })}
                  </div>
                  <div className="text-sm text-gray-900 break-words">
                    {t('checkIn')}: {formatTime((isAdmin ? currentSessionForSelectedEmployee?.check_in_time : currentSession?.check_in_time) || null)} ({t('lasVegas')})
                  </div>
                  <div className="text-sm text-gray-900">
                    {t('date')}: {(isAdmin ? currentSessionForSelectedEmployee : currentSession)?.date || ''}
                  </div>
                </div>
                <div className="px-3 py-1 text-sm bg-yellow-100 text-yellow-800 rounded-full w-fit shrink-0">
                  {t('inProgress')}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 오늘의 출퇴근 기록 목록 */}
        {todayRecords.length > 0 && (
          <div className="mt-4 sm:mt-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">{t('todayRecords')}</h3>
            <div className="space-y-2">
              {todayRecords.map((record) => (
                <div key={record.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex flex-wrap gap-x-3 gap-y-1 sm:items-center sm:gap-4 min-w-0">
                    <span className="text-sm font-medium text-gray-600">{record.session_number}{t('nth')}</span>
                    <span className="text-sm text-gray-900">{t('checkIn')}: {formatTime(record.check_in_time)}</span>
                    <span className="text-sm text-gray-900">{t('checkOut')}: {formatTime(record.check_out_time)}</span>
                    <span className="text-sm text-gray-900">{t('workHours')}: {formatWorkHours(record.work_hours)}</span>
                  </div>
                  <div className={`px-2 py-1 text-xs rounded-full w-fit ${
                    record.check_out_time 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {record.check_out_time ? t('completed') : t('inProgress')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
          {!currentSession ? (
            <button
              onClick={handleCheckInExecute}
              disabled={isCheckingIn}
              className="flex items-center justify-center px-5 py-3 sm:px-6 bg-green-600 text-white text-sm sm:text-base font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full sm:w-auto"
            >
              <CheckCircle className="w-5 h-5 mr-2 shrink-0" />
              {isCheckingIn ? t('checkingIn') : t('checkInButton')}
            </button>
          ) : (
            <button
              onClick={handleCheckOutExecute}
              className="flex items-center justify-center px-5 py-3 sm:px-6 bg-red-600 text-white text-sm sm:text-base font-medium rounded-lg hover:bg-red-700 transition-colors w-full sm:w-auto"
            >
              <XCircle className="w-5 h-5 mr-2 shrink-0" />
              {t('checkOutButton')}
            </button>
          )}
        </div>
      </div>

      {/* 월별 통계 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center min-w-0">
          <BarChart3 className="w-5 h-5 mr-2 text-blue-600 shrink-0" />
          <span className="truncate">{isAdmin ? t('monthlyStatsAdmin', { name: teamMembers.find(m => m.email === selectedEmployee)?.name_ko || t('selectedEmployeeLabel'), month: selectedMonth }) : t('monthlyStatsUser', { month: selectedMonth })}</span>
        </h2>
        
        {(monthlyStats.length > 0 || monthlyStatsByCheckIn.presentDays > 0) ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-4">
            <div className="text-center p-3 sm:p-4 bg-blue-50 rounded-lg min-w-0">
              <div className="text-lg sm:text-2xl font-bold text-blue-600">
                {monthlyStatsByCheckIn.totalWorkHours.toFixed(1)}{t('hoursUnit')}
              </div>
              <div className="text-xs sm:text-sm text-blue-800">{t('totalWorkHoursLabel')}</div>
            </div>
            <div className="text-center p-3 sm:p-4 bg-green-50 rounded-lg min-w-0">
              <div className="text-lg sm:text-2xl font-bold text-green-600">
                {monthlyStatsByCheckIn.presentDays}{t('daysUnit')}
              </div>
              <div className="text-xs sm:text-sm text-green-800">{t('presentDays')}</div>
            </div>
            <div className="text-center p-3 sm:p-4 bg-teal-50 rounded-lg min-w-0">
              <div className="text-lg sm:text-2xl font-bold text-teal-600">
                {monthlyStatsByCheckIn.presentDays > 0 ? formatWorkHours(monthlyStatsByCheckIn.avgHoursPerDay) : '0시간 0분'}
              </div>
              <div className="text-xs sm:text-sm text-teal-800">{t('avgHoursPerDay')}</div>
            </div>
            <div className="text-center p-3 sm:p-4 bg-purple-50 rounded-lg min-w-0">
              <div className="text-lg sm:text-2xl font-bold text-purple-600">
                {monthlyStats[0]?.first_half_hours?.toFixed(1) ?? 0}{t('hoursUnit')}
              </div>
              <div className="text-xs sm:text-sm text-purple-800">{t('firstHalf')}</div>
            </div>
            <div className="text-center p-3 sm:p-4 bg-orange-50 rounded-lg min-w-0">
              <div className="text-lg sm:text-2xl font-bold text-orange-600">
                {monthlyStats[0]?.second_half_hours?.toFixed(1) ?? 0}{t('hoursUnit')}
              </div>
              <div className="text-xs sm:text-sm text-orange-800">{t('secondHalf')}</div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium mb-2">{t('noMonthlyStats')}</p>
            <p className="text-sm">
              {t('noMonthlyStatsDesc', { month: selectedMonth.split('-')[1] || selectedMonth })}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              {t('checkInCreatesStats')}
            </p>
          </div>
        )}

        {/* 월별 그래프 (X: 날짜, Y: 시간) */}
        {monthlyChartData.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('monthlyChartTitle')}</h3>
            <div className="h-[240px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#9ca3af' }}
                    label={{ value: t('chartXLabel'), position: 'insideBottom', offset: -8, fontSize: 12 }}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#9ca3af' }}
                    label={{ value: t('chartYLabel'), angle: -90, position: 'insideLeft', fontSize: 12 }}
                    tickFormatter={(v) => (v === 0 ? '0시간' : formatWorkHours(v))}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload as { fullDate: string; hours: number }
                      return (
                        <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
                          <div className="text-gray-600">{d.fullDate}</div>
                          <div className="font-medium text-blue-600">{t('chartYLabel')}: {d.hours === 0 ? '0시간 0분' : formatWorkHours(d.hours)}</div>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} name={t('chartYLabel')} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* 월 선택 및 출퇴근 기록 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
            <User className="w-5 h-5 mr-2 text-gray-600 shrink-0" />
            {t('attendanceRecords')}
          </h2>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>

        {attendanceRecords.length === 0 ? (
          <div className="text-center py-6 sm:py-8 text-gray-500">
            <Calendar className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-base sm:text-lg font-medium mb-2">{t('noRecords')}</p>
            <p className="text-sm mb-2">
              {t('noRecordsDesc', { month: selectedMonth.split('-')[1] || selectedMonth })}
            </p>
            <p className="text-xs text-gray-400">
              {t('checkInCreatesRecord')}
            </p>
          </div>
        ) : (
          <>
            {/* 모바일: 카드 리스트 */}
            <div className="md:hidden space-y-3">
              {attendanceRecords.map((record) => (
                <div
                  key={record.id}
                  className={`rounded-lg border p-3 sm:p-4 ${getDateBackgroundColor(record.date)} transition-colors`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="text-sm font-medium text-gray-900">
                      {record.check_in_time ? formatDateFromUTC(record.check_in_time) : formatDateWithWeekday(record.date)}
                    </span>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      record.status === 'present' ? 'bg-green-100 text-green-800' :
                      record.status === 'late' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {record.status === 'present' ? t('statusPresent') : record.status === 'late' ? t('statusLate') : t('statusAbsent')}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-700">
                    <span>{t('checkIn')}</span>
                    <span>{formatTime(record.check_in_time)}</span>
                    <span>{t('checkOut')}</span>
                    <span>{formatTime(record.check_out_time)}</span>
                    <span>{t('workHours')}</span>
                    <span>{formatWorkHours(record.work_hours)}</span>
                  </div>
                  {isAdmin && (
                    <div className="text-xs text-gray-500 font-mono mt-2 truncate" title={record.id}>
                      ID: {record.id}
                    </div>
                  )}
                  {canEditAttendance && (
                    <button
                      onClick={() => handleEditRecord(record)}
                      className="mt-3 flex items-center text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      <Edit className="w-4 h-4 mr-1 shrink-0" />
                      {t('edit')}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* 데스크톱: 테이블 */}
            <div className="hidden md:block overflow-x-auto -mx-4 sm:mx-0">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {isAdmin && (
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ID
                      </th>
                    )}
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('checkInDate')}
                    </th>
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('checkInTimeLv')}
                    </th>
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('checkOutDate')}
                    </th>
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('checkOutTimeLv')}
                    </th>
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('workHoursLabel')}
                    </th>
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('status')}
                    </th>
                    {canEditAttendance && (
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('action')}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {attendanceRecords.map((record) => (
                    <tr key={record.id} className={`${getDateBackgroundColor(record.date)} transition-colors`}>
                      {isAdmin && (
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                          {record.id}
                        </td>
                      )}
                      <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.check_in_time ? formatDateFromUTC(record.check_in_time) : formatDateWithWeekday(record.date)}
                      </td>
                      <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatTime(record.check_in_time)}
                      </td>
                      <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.check_out_time ? formatDateFromUTC(record.check_out_time) : '-'}
                      </td>
                      <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatTime(record.check_out_time)}
                      </td>
                      <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatWorkHours(record.work_hours)}
                      </td>
                      <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          record.status === 'present' 
                            ? 'bg-green-100 text-green-800'
                            : record.status === 'late'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {record.status === 'present' ? t('statusPresent') : 
                           record.status === 'late' ? t('statusLate') : t('statusAbsent')}
                        </span>
                      </td>
                      {canEditAttendance && (
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleEditRecord(record)}
                            className="text-blue-600 hover:text-blue-900 flex items-center"
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            {t('edit')}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
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
        onOverdueCountChange={setTotalEmployeesOverdueCount}
      />

      {/* Office Tips 모달 */}
      <OfficeTipsModal
        isOpen={isOfficeTipsModalOpen}
        onClose={() => setIsOfficeTipsModalOpen(false)}
      />

      {/* Tips 쉐어 모달 */}
      <TipsShareModal
        isOpen={isTipsShareModalOpen}
        onClose={() => setIsTipsShareModalOpen(false)}
        locale={locale}
        onReservationClick={handleOpenReservationFromTips}
      />

      {/* Tips 쉐어에서 예약 클릭 시 예약 수정 모달 (Tips 모달 위에 표시) */}
      {loadingReservationForEdit && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60]" aria-hidden>
          <div className="text-white font-medium">{t('reservationLoading')}</div>
        </div>
      )}
      {editingReservation && reservationFormData && (
        <div className="fixed inset-0 z-[60]">
          <ReservationFormAny
            reservation={editingReservation}
            customers={reservationFormData.customers}
            products={reservationFormData.products}
            channels={reservationFormData.channels}
            productOptions={reservationFormData.productOptions}
            options={reservationFormData.options}
            pickupHotels={reservationFormData.pickupHotels}
            coupons={reservationFormData.coupons}
            layout="modal"
            allowPastDateEdit={isSuper}
            onSubmit={async (reservationData: any) => {
              try {
                const dbReservationData = {
                  customer_id: reservationData.customerId,
                  product_id: reservationData.productId,
                  tour_date: reservationData.tourDate,
                  tour_time: reservationData.tourTime || null,
                  event_note: reservationData.eventNote,
                  pickup_hotel: reservationData.pickUpHotel,
                  pickup_time: reservationData.pickUpTime || null,
                  adults: reservationData.adults,
                  child: reservationData.child,
                  infant: reservationData.infant,
                  total_people: reservationData.totalPeople,
                  channel_id: reservationData.channelId,
                  channel_rn: reservationData.channelRN,
                  added_by: reservationData.addedBy,
                  tour_id: reservationData.tourId || editingReservation.tourId || null,
                  status: reservationData.status,
                  selected_options: reservationData.selectedOptions,
                  selected_option_prices: reservationData.selectedOptionPrices,
                  is_private_tour: reservationData.isPrivateTour || false,
                  choices: reservationData.choices
                }
                const { error } = await supabase
                  .from('reservations')
                  .update(dbReservationData)
                  .eq('id', editingReservation.id)
                if (error) {
                  alert(t('reservationUpdateError') + error.message)
                  return
                }
                if (reservationData.choices?.required && Array.isArray(reservationData.choices.required)) {
                  await supabase.from('reservation_choices').delete().eq('reservation_id', editingReservation.id)
                  const validChoices = reservationData.choices.required
                    .filter((c: any) => c.option_id)
                    .map((c: any) => ({
                      reservation_id: editingReservation.id,
                      choice_id: c.choice_id,
                      option_id: c.option_id,
                      quantity: c.quantity || 1,
                      total_price: c.total_price || 0
                    }))
                  if (validChoices.length > 0) {
                    await (supabase as any).from('reservation_choices').insert(validChoices)
                  }
                }
                handleCloseReservationEditModal()
                alert(t('reservationUpdated'))
              } catch (e) {
                console.error('예약 수정 오류:', e)
                alert(t('reservationUpdateFailed'))
              }
            }}
            onCancel={handleCloseReservationEditModal}
            onRefreshCustomers={async () => {}}
            onDelete={async () => {
              if (!confirm(t('reservationDeleteConfirmSoft'))) return
              try {
                const { error } = await supabase.from('reservations').update({ status: 'deleted' }).eq('id', editingReservation.id)
                if (error) {
                  alert(t('reservationDeleteError') + error.message)
                  return
                }
                handleCloseReservationEditModal()
                alert(t('reservationDeleted'))
              } catch (e) {
                console.error('예약 삭제 처리 오류:', e)
              }
            }}
          />
        </div>
      )}

      {/* 보너스 계산기 모달 */}
      <BonusCalculatorModal
        isOpen={isBonusCalculatorOpen}
        onClose={() => setIsBonusCalculatorOpen(false)}
        locale={locale}
      />
    </div>
  )
}
