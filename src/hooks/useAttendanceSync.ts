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

      // 오늘의 모든 출퇴근 기록 조회
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('employee_email', employeeData.email)
        .eq('date', new Date().toISOString().split('T')[0])
        .order('session_number', { ascending: true })

      if (error && error.code !== 'PGRST116') {
        console.log('출퇴근 기록 테이블이 아직 생성되지 않았습니다.')
        setCurrentSession(null)
        return
      }

      if (data && data.length > 0) {
        const records = data.map(record => ({
          ...record,
          employee_name: employeeData.name_ko,
          employee_email: employeeData.email
        }))
        
        // 현재 진행 중인 세션 찾기 (퇴근하지 않은 세션)
        const activeSession = records.find(record => 
          record.check_in_time && !record.check_out_time
        )
        setCurrentSession(activeSession || null)
      } else {
        setCurrentSession(null)
      }
    } catch (error) {
      console.error('오늘 기록 조회 중 오류:', error)
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
        .single()

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
        .eq('date', new Date().toISOString().split('T')[0])
        .order('session_number', { ascending: false })
        .limit(1)

      const nextSessionNumber = existingRecords && existingRecords.length > 0 
        ? existingRecords[0].session_number + 1 
        : 1

      const { error } = await supabase
        .from('attendance_records')
        .insert({
          employee_email: employeeData.email,
          date: new Date().toISOString().split('T')[0],
          check_in_time: new Date().toISOString(),
          status: 'present',
          session_number: nextSessionNumber
        })

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
      const { error } = await supabase
        .from('attendance_records')
        .update({
          check_out_time: new Date().toISOString()
        })
        .eq('id', currentSession.id)

      if (error) {
        console.error('퇴근 체크아웃 오류:', error)
        alert('퇴근 체크아웃에 실패했습니다.')
        return
      }

      alert(`${currentSession.session_number}번째 퇴근 체크아웃이 완료되었습니다!`)
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
