import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

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

export function useAttendanceSync() {
  const { authUser } = useAuth()
  const [currentSession, setCurrentSession] = useState<AttendanceRecord | null>(null)
  const [isCheckingIn, setIsCheckingIn] = useState(false)
  const [employeeNotFound, setEmployeeNotFound] = useState(false)
  const [elapsedTime, setElapsedTime] = useState('00:00:00')

  // 오늘의 출퇴근 기록 조회
  const fetchTodayRecords = useCallback(async () => {
    console.log('fetchTodayRecords 시작, authUser.email:', authUser?.email)
    
    if (!authUser?.email) {
      console.log('authUser.email이 없습니다')
      return
    }

    try {
      console.log('직원 정보 조회 시작...')
      console.log('Supabase client available:', !!supabase)
      console.log('Access token available:', !!localStorage.getItem('sb-access-token'))
      
      // 타임아웃과 함께 직원 정보 조회 (5초 타임아웃)
      const queryPromise = supabase
        .from('team')
        .select('name_ko, email, position, is_active')
        .eq('email', authUser.email)
        .eq('is_active', true)
        .maybeSingle()
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Employee query timeout')), 5000)
      )
      
      let employeeData = null
      let employeeError = null
      
      try {
        const result = await Promise.race([
          queryPromise,
          timeoutPromise
        ]) as { data: {
          name_ko: string | null
          email: string
          position: string | null
          is_active: boolean
        } | null; error: { message?: string; code?: string } | null }
        
        employeeData = result.data
        employeeError = result.error
      } catch {
        console.warn('useAttendanceSync: Employee query timed out, skipping attendance sync')
        setEmployeeNotFound(true)
        return
      }

      console.log('직원 정보 조회 결과:', { 
        hasData: !!employeeData, 
        error: employeeError?.message, 
        errorCode: employeeError?.code,
        employeeData: employeeData && !employeeError ? { 
          name_ko: employeeData.name_ko, 
          position: employeeData.position,
          is_active: employeeData.is_active 
        } : null
      })

      if (employeeError && employeeError.code !== 'PGRST116') {
        console.error('직원 정보 조회 오류:', employeeError)
        setEmployeeNotFound(true)
        return
      }

      if (!employeeData) {
        console.log('직원 정보를 찾을 수 없습니다.')
        setEmployeeNotFound(true)
        return
      }

      console.log('출퇴근 기록 조회 시작...')
      // 최근 미체크아웃 기록 조회 (체크아웃되지 않은 모든 기록)
      const today = new Date().toISOString().split('T')[0]
      console.log('오늘 날짜 (UTC):', today)
      
      // 라스베가스 시간대 고려 (UTC-8)
      const lasVegasTime = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Los_Angeles"}))
      const lasVegasToday = lasVegasTime.toISOString().split('T')[0]
      console.log('라스베가스 오늘 날짜:', lasVegasToday)
      
      // 미체크아웃 기록 조회 (최근 7일간)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]
      
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('employee_email', employeeData.email)
        .is('check_out_time', null)
        .gte('date', sevenDaysAgoStr)
        .order('date', { ascending: false })
        .order('check_in_time', { ascending: false })
        .order('session_number', { ascending: true })

      console.log('출퇴근 기록 조회 결과:', { data, error })
      console.log('조회 범위:', { sevenDaysAgoStr, today })

      if (error && error.code !== 'PGRST116') {
        console.log('출퇴근 기록 테이블이 아직 생성되지 않았습니다.')
        setCurrentSession(null)
        return
      }

      if (data && data.length > 0) {
        const records = data.map(record => ({
          ...(record as Record<string, unknown>),
          employee_name: employeeData.name_ko || '',
          employee_email: employeeData.email
        })) as AttendanceRecord[]
        
        // 현재 진행 중인 세션 찾기 (퇴근하지 않은 세션)
        // check_out_time이 null이거나 빈 문자열인 경우를 모두 체크
        const activeSession = records.find(record => 
          record.check_in_time && 
          (record.check_out_time === null || record.check_out_time === '')
        )
        
        console.log('미체크아웃 기록:', records)
        console.log('현재 세션:', activeSession)
        
        setCurrentSession(activeSession || null)
      } else {
        console.log('최근 7일간 미체크아웃 기록이 없습니다.')
        setCurrentSession(null)
      }
    } catch (error) {
      console.error('오늘 기록 조회 중 오류:', error)
      console.error('에러 타입:', typeof error)
      console.error('에러 메시지:', error instanceof Error ? error.message : 'Unknown error')
      console.error('에러 스택:', error instanceof Error ? error.stack : 'No stack trace')
      
      // 타임아웃 에러인 경우 특별 처리
      if (error instanceof Error && error.message === 'Query timeout') {
        console.error('직원 정보 조회가 타임아웃되었습니다.')
        setEmployeeNotFound(true)
      }
    }
  }, [authUser?.email])

  // 출근 체크인
  const handleCheckIn = useCallback(async () => {
    if (!authUser?.email) return

    setIsCheckingIn(true)
    try {
      // 먼저 이메일로 직원 정보 조회
      const { data: employeeData, error: employeeError } = await supabase
        .from('team')
        .select('name_ko, email')
        .eq('email', authUser.email)
        .eq('is_active', true)
        .single() as { data: { name_ko: string | null; email: string } | null; error: { message?: string; code?: string } | null }

      if (employeeError) {
        console.error('직원 정보 조회 오류:', employeeError)
        alert('직원 정보를 찾을 수 없습니다.')
        return
      }

      if (!employeeData) {
        alert('직원 정보를 찾을 수 없습니다.')
        return
      }

      // 오늘의 기존 기록 조회하여 다음 세션 번호 계산
      const { data: existingRecords } = await supabase
        .from('attendance_records')
        .select('session_number')
        .eq('employee_email', employeeData.email)
        .eq('date', new Date().toISOString().split('T')[0] as string)
        .order('session_number', { ascending: false })
        .limit(1)

      const nextSessionNumber = existingRecords && existingRecords.length > 0 
        ? (existingRecords[0] as { session_number: number }).session_number + 1 
        : 1

      const { error } = await supabase
        .from('attendance_records')
        .insert({
          employee_email: employeeData.email,
          date: new Date().toISOString().split('T')[0],
          check_in_time: new Date().toISOString(),
          status: 'present',
          session_number: nextSessionNumber
        } as never)

      if (error) {
        console.error('출근 체크인 오류:', error)
        alert('출퇴근 기록 테이블이 아직 생성되지 않았습니다. 관리자에게 문의하세요.')
        return
      }

      alert(`${nextSessionNumber}번째 출근 체크인이 완료되었습니다!`)
      await fetchTodayRecords()
    } catch (error) {
      console.error('출근 체크인 중 오류:', error)
      alert('출근 체크인 중 오류가 발생했습니다.')
    } finally {
      setIsCheckingIn(false)
    }
  }, [authUser?.email, fetchTodayRecords])

  // 퇴근 체크아웃
  const handleCheckOut = useCallback(async () => {
    if (!currentSession) return

    try {
      const checkOutTime = new Date().toISOString()
      const checkInTime = new Date(currentSession.check_in_time!)
      
      // 근무시간 계산 (시간 단위)
      const workHours = (new Date(checkOutTime).getTime() - checkInTime.getTime()) / (1000 * 60 * 60)
      const roundedWorkHours = Math.round(workHours * 100) / 100 // 소수점 둘째 자리까지 반올림

      const { error } = await supabase
        .from('attendance_records')
        .update({
          check_out_time: checkOutTime,
          work_hours: roundedWorkHours
        } as never)
        .eq('id', currentSession.id as string)

      if (error) {
        console.error('퇴근 체크아웃 오류:', error)
        alert('퇴근 체크아웃에 실패했습니다.')
        return
      }

      alert(`${currentSession.session_number}번째 퇴근 체크아웃이 완료되었습니다! (근무시간: ${roundedWorkHours}시간)`)
      await fetchTodayRecords()
    } catch (error) {
      console.error('퇴근 체크아웃 중 오류:', error)
      alert('퇴근 체크아웃 중 오류가 발생했습니다.')
    }
  }, [currentSession, fetchTodayRecords])

  // 경과 시간 계산 함수
  const calculateElapsedTime = useCallback((startTime: string) => {
    const start = new Date(startTime)
    const now = new Date()
    const diff = now.getTime() - start.getTime()
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }, [])

  // 타이머 업데이트
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    
    if (currentSession && currentSession.check_in_time && !currentSession.check_out_time) {
      // 1초마다 경과 시간 업데이트
      interval = setInterval(() => {
        setElapsedTime(calculateElapsedTime(currentSession.check_in_time!))
      }, 1000)
    } else {
      setElapsedTime('00:00:00')
    }

    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [currentSession, calculateElapsedTime])

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    fetchTodayRecords()
  }, [fetchTodayRecords])

  return {
    currentSession,
    isCheckingIn,
    employeeNotFound,
    elapsedTime,
    handleCheckIn,
    handleCheckOut,
    refreshAttendance: fetchTodayRecords
  }
}
