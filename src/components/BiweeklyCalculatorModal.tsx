'use client'

import React, { useState, useEffect } from 'react'
import { X, Calculator, Clock, DollarSign, Calendar, User, Printer } from 'lucide-react'
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
  const [tipPay, setTipPay] = useState<number>(0)
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

  // 총 급여 계산 함수
  const calculateTotalPay = (attendanceSalary: number, tourSalary: number, tipSalary: number) => {
    return attendanceSalary + tourSalary + tipSalary
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

      // 먼저 출퇴근 기록만 조회 - 더 넓은 범위로 조회 후 클라이언트에서 필터링
      const query = supabase
        .from('attendance_records')
        .select('id, employee_email, date, check_in_time, check_out_time, work_hours, status, notes, session_number')
        .eq('employee_email', selectedEmployee)
        .gte('date', new Date(new Date(startDate).getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]) // 하루 전부터
        .lte('date', new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]) // 하루 후까지
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
      
      // 클라이언트 사이드에서 check_in_time을 라스베가스 시간으로 변환하여 정확한 필터링
      const filteredData = attendanceData?.filter(record => {
        if (!record.check_in_time) return false
        
        // check_in_time을 라스베가스 시간으로 변환
        const utcDate = new Date(record.check_in_time)
        const lasVegasTime = new Date(utcDate.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}))
        
        // 라스베가스 시간에서 날짜 부분만 추출 (YYYY-MM-DD 형식)
        const year = lasVegasTime.getFullYear()
        const month = String(lasVegasTime.getMonth() + 1).padStart(2, '0')
        const day = String(lasVegasTime.getDate()).padStart(2, '0')
        const lasVegasDate = `${year}-${month}-${day}`
        
        const isInRange = lasVegasDate >= startDate && lasVegasDate <= endDate
        
        console.log('라스베가스 시간 필터링 체크:', {
          originalCheckInTime: record.check_in_time,
          lasVegasDate,
          startDate,
          endDate,
          isInRange,
          gte: lasVegasDate >= startDate,
          lte: lasVegasDate <= endDate
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
        // 총 급여는 별도 useEffect에서 계산
      } else {
        setAttendancePay(0)
        // 총 급여는 별도 useEffect에서 계산
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
      // 총 급여는 별도 useEffect에서 계산
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

  // attendancePay, tourPay, tipPay가 변경될 때마다 총 급여 계산
  useEffect(() => {
    const total = calculateTotalPay(attendancePay, tourPay, tipPay)
    setTotalPay(total)
  }, [attendancePay, tourPay, tipPay])

  // 날짜나 직원이 변경될 때 투어 fee 조회
  useEffect(() => {
    if (selectedEmployee && startDate && endDate) {
      fetchTourFees()
      fetchTipShares()
    }
  }, [selectedEmployee, startDate, endDate])

  // 팁 쉐어 데이터 조회
  const fetchTipShares = async () => {
    if (!startDate || !endDate || !selectedEmployee) {
      setTipPay(0)
      return
    }

    try {
      // 선택된 직원의 position 확인
      const selectedMember = teamMembers.find(m => m.email === selectedEmployee)
      const isOp = selectedMember?.position?.toLowerCase() === 'op' || 
                   selectedMember?.position?.toLowerCase() === 'office manager'

      let tourIds: string[] = []

      if (isOp) {
        // OP의 경우 해당 기간의 모든 투어 조회
        const { data: toursData, error: toursError } = await supabase
          .from('tours')
          .select('id')
          .gte('tour_date', startDate)
          .lte('tour_date', endDate)

        if (toursError) {
          console.error('투어 조회 오류:', toursError)
          setTipPay(0)
          return
        }

        tourIds = toursData?.map(t => t.id) || []
      } else {
        // 가이드/어시스턴트의 경우 배정된 투어만 조회
        const { data: toursData, error: toursError } = await supabase
          .from('tours')
          .select('id')
          .gte('tour_date', startDate)
          .lte('tour_date', endDate)
          .or(`tour_guide_id.eq.${selectedEmployee},assistant_id.eq.${selectedEmployee}`)

        if (toursError) {
          console.error('투어 조회 오류:', toursError)
          setTipPay(0)
          return
        }

        tourIds = toursData?.map(t => t.id) || []
      }

      if (tourIds.length === 0) {
        setTipPay(0)
        return
      }

      // 팁 쉐어 데이터 조회
      const { data: tipSharesData, error: tipSharesError } = await supabase
        .from('tour_tip_shares')
        .select('*')
        .in('tour_id', tourIds)

      if (tipSharesError) {
        // 테이블이 없을 수 있으므로 에러 무시
        console.log('팁 쉐어 데이터 조회 오류 (테이블이 없을 수 있음):', tipSharesError)
        setTipPay(0)
        return
      }

      console.log('조회된 팁 쉐어 데이터:', {
        tourIds,
        tipSharesData,
        selectedEmployee,
        shareCount: tipSharesData?.length || 0
      })

      // 선택된 직원이 가이드, 어시스턴트인 경우의 팁 금액 합산
      let totalTipPay = 0
      const shareIds = tipSharesData?.map((s: any) => s.id) || []
      
      // 이메일 비교를 대소문자 구분 없이 처리
      const normalizedSelectedEmail = selectedEmployee?.toLowerCase().trim()
      
      tipSharesData?.forEach((share: any) => {
        const guideEmail = share.guide_email?.toLowerCase().trim()
        const assistantEmail = share.assistant_email?.toLowerCase().trim()
        
        console.log('팁 쉐어 비교:', {
          shareId: share.id,
          tourId: share.tour_id,
          guideEmail,
          assistantEmail,
          selectedEmail: normalizedSelectedEmail,
          guideAmount: share.guide_amount,
          assistantAmount: share.assistant_amount,
          guideMatch: guideEmail === normalizedSelectedEmail,
          assistantMatch: assistantEmail === normalizedSelectedEmail
        })
        
        if (guideEmail === normalizedSelectedEmail) {
          totalTipPay += share.guide_amount || 0
        }
        if (assistantEmail === normalizedSelectedEmail) {
          totalTipPay += share.assistant_amount || 0
        }
      })

      // OP의 경우 tour_tip_share_ops 테이블에서 조회
      if (shareIds.length > 0) {
        const { data: opSharesData, error: opSharesError } = await supabase
          .from('tour_tip_share_ops')
          .select('op_email, op_amount')
          .in('tour_tip_share_id', shareIds)

        if (opSharesError) {
          console.log('OP 팁 쉐어 데이터 조회 오류:', opSharesError)
        } else {
          console.log('조회된 OP 팁 쉐어 데이터:', {
            shareIds,
            opSharesData,
            selectedEmployee: normalizedSelectedEmail
          })
        }

        if (!opSharesError && opSharesData) {
          opSharesData.forEach((opShare: any) => {
            const opEmail = opShare.op_email?.toLowerCase().trim()
            console.log('OP 팁 쉐어 비교:', {
              opEmail,
              selectedEmail: normalizedSelectedEmail,
              opAmount: opShare.op_amount,
              match: opEmail === normalizedSelectedEmail
            })
            if (opEmail === normalizedSelectedEmail) {
              totalTipPay += opShare.op_amount || 0
            }
          })
        }
      }

      console.log('최종 팁 금액:', totalTipPay)
      setTipPay(totalTipPay)
    } catch (error) {
      console.error('팁 쉐어 조회 오류:', error)
      setTipPay(0)
    }
  }

  // 시급 입력 핸들러
  const handleHourlyRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setHourlyRate(value)
    
    // 숫자만 입력 허용하고 출퇴근 급여 계산
    if (value === '' || !isNaN(Number(value))) {
      if (value && !isNaN(Number(value)) && totalHours > 0) {
        const attendanceSalary = totalHours * Number(value)
        setAttendancePay(attendanceSalary)
        // 총 급여는 별도 useEffect에서 계산
      } else {
        setAttendancePay(0)
        // 총 급여는 별도 useEffect에서 계산
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
    setTipPay(0)
    setAttendanceRecords([])
    setSelectedEmployee('')
    setTourFees([])
    onClose()
  }

  // 프린트 함수
  const handlePrint = () => {
    // 프린트용 새 창 열기
    const printWindow = window.open('', '_blank', 'width=800,height=600')
    
    if (printWindow) {
      // 프린트용 HTML 생성
      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>2주급 계산기</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              margin: 20px;
              color: #333;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 20px;
            }
            .header h1 {
              font-size: 24px;
              font-weight: bold;
              margin: 0 0 10px 0;
            }
            .header p {
              font-size: 14px;
              color: #666;
              margin: 0;
            }
            .content {
              display: flex;
              gap: 30px;
            }
            .left-section {
              flex: 1;
            }
            .right-section {
              flex: 1;
            }
            .section-title {
              font-size: 18px;
              font-weight: 600;
              margin-bottom: 15px;
              color: #374151;
            }
            .info-row {
              display: flex;
              margin-bottom: 10px;
            }
            .info-label {
              font-weight: 500;
              min-width: 120px;
              color: #6b7280;
            }
            .info-value {
              font-weight: 600;
              color: #111827;
            }
            .calculation-box {
              background: #f9fafb;
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 20px;
              margin-bottom: 20px;
            }
            .calculation-item {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
              padding: 5px 0;
            }
            .calculation-item.total {
              border-top: 1px solid #d1d5db;
              padding-top: 10px;
              margin-top: 10px;
              font-weight: bold;
              font-size: 16px;
            }
            .table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 15px;
            }
            .table th,
            .table td {
              border: 1px solid #d1d5db;
              padding: 8px 12px;
              text-align: left;
            }
            .table th {
              background: #f9fafb;
              font-weight: 600;
              font-size: 14px;
            }
            .table td {
              font-size: 13px;
            }
            .table tbody tr:nth-child(even) {
              background: #f9fafb;
            }
            .tour-link {
              color: #2563eb;
              text-decoration: none;
            }
            .tour-link:hover {
              text-decoration: underline;
            }
            @media print {
              body { margin: 0; }
              .content { display: block; }
              .left-section, .right-section { flex: none; margin-bottom: 20px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>2주급 계산기</h1>
            <p>${selectedEmployee && teamMembers.find(m => m.email === selectedEmployee)?.name_ko || ''} | ${startDate} ~ ${endDate}</p>
          </div>
          
          <div class="content">
            <div class="left-section">
              <div class="section-title">직원 정보</div>
              <div class="info-row">
                <span class="info-label">직원:</span>
                <span class="info-value">${selectedEmployee && teamMembers.find(m => m.email === selectedEmployee)?.name_ko || ''}</span>
              </div>
              <div class="info-row">
                <span class="info-label">기간:</span>
                <span class="info-value">${startDate} ~ ${endDate}</span>
              </div>
              <div class="info-row">
                <span class="info-label">시급:</span>
                <span class="info-value">$${hourlyRate || '0'}</span>
              </div>
            </div>
            
            <div class="right-section">
              <div class="section-title">급여 계산</div>
              <div class="calculation-box">
                <div class="calculation-item">
                  <span>총 근무시간:</span>
                  <span>${formatWorkHours(totalHours)}</span>
                </div>
                <div class="calculation-item">
                  <span>출퇴근 기록 소계:</span>
                  <span>$${formatCurrency(attendancePay)}</span>
                </div>
                <div class="calculation-item">
                  <span>투어 Fee 소계:</span>
                  <span>$${formatCurrency(tourPay)}</span>
                </div>
                <div class="calculation-item">
                  <span>Tips 쉐어 소계:</span>
                  <span>$${formatCurrency(tipPay)}</span>
                </div>
                <div class="calculation-item total">
                  <span>총 급여:</span>
                  <span>$${formatCurrency(totalPay)}</span>
                </div>
              </div>
            </div>
          </div>
          
          ${attendanceRecords.length > 0 ? `
            <div class="section-title">출퇴근 기록 (${new Set(attendanceRecords.map(record => {
              if (!record.check_in_time) return record.date
              const utcDate = new Date(record.check_in_time)
              const lasVegasTime = new Date(utcDate.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}))
              return lasVegasTime.toISOString().split('T')[0]
            })).size}일, 총 ${attendanceRecords.length}회)</div>
            <table class="table">
              <thead>
                <tr>
                  <th>출근 날짜</th>
                  <th>출근 시간</th>
                  <th>퇴근 시간</th>
                  <th>근무시간</th>
                  <th>식사시간 차감 후</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                ${attendanceRecords.map(record => `
                  <tr>
                    <td>${getDateFromCheckInTime(record.check_in_time)}</td>
                    <td>${formatTime(record.check_in_time)}</td>
                    <td>${formatTime(record.check_out_time)}</td>
                    <td>${formatWorkHours(record.work_hours || 0)}</td>
                    <td>${formatWorkHours(record.work_hours && record.work_hours > 8 ? record.work_hours - 0.5 : record.work_hours || 0)}</td>
                    <td>${record.status || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}
          
          ${tourFees.length > 0 ? `
            <div class="section-title">투어 Fee</div>
            <table class="table">
              <thead>
                <tr>
                  <th>투어 날짜</th>
                  <th>투어명</th>
                  <th>팀 타입</th>
                  <th>가이드 Fee</th>
                  <th>드라이버 Fee</th>
                  <th>총 Fee</th>
                </tr>
              </thead>
              <tbody>
                ${tourFees.map(tour => `
                  <tr>
                    <td>${formatDate(tour.date)}</td>
                    <td>${tour.tour_name}</td>
                    <td>${tour.team_type}</td>
                    <td>$${formatCurrency(tour.guide_fee)}</td>
                    <td>$${formatCurrency(tour.driver_fee)}</td>
                    <td>$${formatCurrency(tour.total_fee)}</td>
                  </tr>
                `).join('')}
                <tr style="font-weight: bold; background: #f3f4f6;">
                  <td colspan="5">총합</td>
                  <td>$${formatCurrency(tourFees.reduce((sum, tour) => sum + tour.total_fee, 0))}</td>
                </tr>
              </tbody>
            </table>
          ` : ''}
        </body>
        </html>
      `
      
      printWindow.document.write(printContent)
      printWindow.document.close()
      
      // 프린트 대화상자 열기
      printWindow.onload = () => {
        printWindow.print()
        printWindow.close()
      }
    }
  }

  // 시간 포맷팅 함수
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
    
    // 날짜와 요일을 분리하여 포맷팅
    const dateStr = lasVegasTime.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    
    const weekdayStr = lasVegasTime.toLocaleDateString('ko-KR', {
      weekday: 'short'
    })
    
    return `${dateStr} (${weekdayStr})`
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

  // 숫자 포맷팅 함수 (천 단위 구분 기호 추가)
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <Calculator className="w-6 h-6 text-blue-600 mr-2" />
            <h2 className="text-xl font-bold text-gray-900">2주급 계산기</h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="프린트"
            >
              <Printer className="w-6 h-6" />
            </button>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* 내용 */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-8">
            {/* 왼쪽: 입력 필드들 */}
            <div className="space-y-4">
              {/* 직원 선택 */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 flex items-center">
                  <User className="w-4 h-4 mr-1" />
                  직원 선택
                </label>
                <div className="flex space-x-2">
                  <select
                    value={selectedEmployee}
                    onChange={handleEmployeeChange}
                    className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">직원을 선택하세요</option>
                    {teamMembers.map((member) => (
                      <option key={member.email} value={member.email}>
                        {member.name_ko} ({member.position})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={setCurrentPeriod}
                    className="px-2 py-1.5 text-xs font-medium text-white bg-blue-600 border border-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    이번
                  </button>
                  <button
                    onClick={setPreviousPeriod}
                    className="px-2 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    지난
                  </button>
                </div>
              </div>

              {/* 날짜 및 시급 입력 */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    시작일
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => handleDateChange('start', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    종료일
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => handleDateChange('end', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <DollarSign className="w-4 h-4 inline mr-1" />
                    시급 ($)
                  </label>
                  <input
                    type="text"
                    value={hourlyRate}
                    onChange={handleHourlyRateChange}
                    placeholder="예: 15.00"
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* 오른쪽: 계산 결과 */}
            <div className="space-y-2">
              <div className="bg-gray-50 rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">
                    <Clock className="w-3 h-3 inline mr-1" />
                    총 근무 시간:
                  </span>
                  <span className="text-sm font-bold text-blue-600">
                    {loading ? '계산 중...' : formatWorkHours(totalHours)}
                  </span>
                </div>
                
                {hourlyRate && !isNaN(Number(hourlyRate)) && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600">
                        <DollarSign className="w-3 h-3 inline mr-1" />
                        출퇴근 기록 소계:
                      </span>
                      <span className="text-sm font-bold text-blue-600">
                        ${formatCurrency(attendancePay)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600">
                        <DollarSign className="w-3 h-3 inline mr-1" />
                        투어 Fee 소계:
                      </span>
                      <span className="text-sm font-bold text-purple-600">
                        ${formatCurrency(tourPay)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600">
                        <DollarSign className="w-3 h-3 inline mr-1" />
                        Tips 쉐어 소계:
                      </span>
                      <span className="text-sm font-bold text-pink-600">
                        ${formatCurrency(tipPay)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t pt-1">
                      <span className="text-xs font-medium text-gray-700">
                        <DollarSign className="w-3 h-3 inline mr-1" />
                        총 급여:
                      </span>
                      <span className="text-base font-bold text-green-600">
                        ${formatCurrency(totalPay)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 출퇴근 기록 테이블 */}
          {attendanceRecords.length > 0 && (
            <div className="mt-8">
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
            <div className="mt-8">
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
                          ${formatCurrency(tour.guide_fee)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          ${formatCurrency(tour.driver_fee)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-green-600">
                          ${formatCurrency(tour.total_fee)}
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
                        ${formatCurrency(tourFees.reduce((sum, tour) => sum + tour.total_fee, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}


        </div>

      </div>
    </div>

    </>
  )
}
