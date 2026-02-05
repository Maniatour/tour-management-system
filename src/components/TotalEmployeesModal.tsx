'use client'

import React, { useState, useEffect } from 'react'
import { X, Calculator, ChevronDown, ChevronRight, Clock, DollarSign, Printer } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface TotalEmployeesModalProps {
  isOpen: boolean
  onClose: () => void
  locale?: string
}

interface EmployeeData {
  email: string
  name: string
  name_en: string
  position: string
  language: string[]
  attendancePay: number
  guideFee: number
  assistantFee: number
  prepaidTip: number
  totalPay: number
  hasWarning: boolean
  attendanceRecords: Array<{
    date: string
    check_in_time: string | null
    check_out_time: string | null
    work_hours: number
    status: string
  }>
  tourFees: Array<{
    id: string
    tour_id: string
    tour_name: string
    date: string
    team_type: string
    guide_fee: number
    assistant_fee: number
    prepaid_tip: number
    total_fee: number
    has_warning: boolean
  }>
}

export default function TotalEmployeesModal({ isOpen, onClose, locale = 'ko' }: TotalEmployeesModalProps) {
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [employeeData, setEmployeeData] = useState<EmployeeData[]>([])
  const [totalAttendancePay, setTotalAttendancePay] = useState<number>(0)
  const [totalGuideFee, setTotalGuideFee] = useState<number>(0)
  const [totalAssistantFee, setTotalAssistantFee] = useState<number>(0)
  const [totalPrepaidTip, setTotalPrepaidTip] = useState<number>(0)
  const [totalPay, setTotalPay] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set())

  // 현재 날짜 기준으로 기본값 설정
  const getDefaultDates = () => {
    const today = new Date()
    const twoWeeksAgo = new Date(today)
    twoWeeksAgo.setDate(today.getDate() - 13)
    
    return {
      start: twoWeeksAgo.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0]
    }
  }

  // 이번 2주 설정 (오늘 기준으로 1-15일 또는 16-말일)
  const setCurrentPeriod = () => {
    const today = new Date()
    const currentDate = today.getDate()
    
    if (currentDate <= 15) {
      // 1일-15일
      const startDate = new Date(today.getFullYear(), today.getMonth(), 1)
      const endDate = new Date(today.getFullYear(), today.getMonth(), 15)
      setStartDate(startDate.toISOString().split('T')[0])
      setEndDate(endDate.toISOString().split('T')[0])
    } else {
      // 16일-말일
      const startDate = new Date(today.getFullYear(), today.getMonth(), 16)
      const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0) // 말일
      setStartDate(startDate.toISOString().split('T')[0])
      setEndDate(endDate.toISOString().split('T')[0])
    }
  }

  // 지난 2주 설정 (현재 기간의 이전 2주)
  const setPreviousPeriod = () => {
    const today = new Date()
    const currentDate = today.getDate()
    
    if (currentDate <= 15) {
      // 현재가 1-15일이면, 지난 달 16일-말일
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 0)
      const startDate = new Date(today.getFullYear(), today.getMonth() - 1, 16)
      setStartDate(startDate.toISOString().split('T')[0])
      setEndDate(lastMonth.toISOString().split('T')[0])
    } else {
      // 현재가 16-말일이면, 이번 달 1일-15일
      const startDate = new Date(today.getFullYear(), today.getMonth(), 1)
      const endDate = new Date(today.getFullYear(), today.getMonth(), 15)
      setStartDate(startDate.toISOString().split('T')[0])
      setEndDate(endDate.toISOString().split('T')[0])
    }
  }

  // 전체 직원 데이터 조회
  const fetchAllEmployeeData = async () => {
    if (!startDate || !endDate) return

    setLoading(true)
    try {
      // 팀 멤버 조회
      const { data: teamData, error: teamError } = await supabase
        .from('team')
        .select('email, name_ko, name_en, position, languages')
        .eq('is_active', true)
        .order('name_ko')

      if (teamError) {
        console.error('팀 멤버 조회 오류:', teamError)
        return
      }

      // 출퇴근 기록 조회
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_records')
        .select(`
          id,
          employee_email,
          date,
          check_in_time,
          check_out_time,
          work_hours,
          status
        `)
        .gte('date', new Date(new Date(startDate).getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .lte('date', new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('date', { ascending: true })

      if (attendanceError) {
        console.error('출퇴근 기록 조회 오류:', attendanceError)
        return
      }

      // 투어 fee 조회 (reservation_ids 포함)
      const { data: tourData, error: tourError } = await supabase
        .from('tours')
        .select(`
          id,
          tour_date,
          tour_guide_id,
          assistant_id,
          guide_fee,
          assistant_fee,
          team_type,
          product_id,
          reservation_ids,
          products!inner(name_ko, name_en)
        `)
        .gte('tour_date', startDate)
        .lte('tour_date', endDate)
        .order('tour_date', { ascending: true })

      if (tourError) {
        console.error('투어 fee 조회 오류:', tourError)
        return
      }

      // 클라이언트 사이드에서 날짜 필터링
      const filteredAttendanceData = attendanceData?.filter(record => {
        if (!record.check_in_time) return false
        
        const utcDate = new Date(record.check_in_time)
        const lasVegasTime = new Date(utcDate.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}))
        
        const year = lasVegasTime.getFullYear()
        const month = String(lasVegasTime.getMonth() + 1).padStart(2, '0')
        const day = String(lasVegasTime.getDate()).padStart(2, '0')
        const lasVegasDate = `${year}-${month}-${day}`
        
        return lasVegasDate >= startDate && lasVegasDate <= endDate
      }) || []

      // 직원별 데이터 처리
      const processedEmployeeData: EmployeeData[] = await Promise.all(
        teamData?.map(async (employee) => {
          // 출퇴근 기록 필터링
          const employeeAttendanceRecords = filteredAttendanceData.filter(record => 
            record.employee_email === employee.email
          )

          // 시급 설정
          let hourlyRate = 15 // 기본값
          if (employee.position === 'office manager') {
            hourlyRate = 17
          }

          // 실제 근무시간 계산 (식사시간 차감 포함)
          const actualTotalHours = employeeAttendanceRecords.reduce((sum, record) => {
            let workHours = record.work_hours || 0
            if (workHours > 8) {
              workHours = workHours - 0.5
            }
            return sum + workHours
          }, 0)

          const attendancePay = actualTotalHours * hourlyRate

          // 투어 fee 필터링 및 prepaid 팁 계산
          const filteredTours = tourData?.filter(tour => 
            tour.tour_guide_id === employee.email || tour.assistant_id === employee.email
          ) || []
          
          const employeeTourFees = await Promise.all(
            filteredTours.map(async (tour) => {
              const isGuide = tour.tour_guide_id === employee.email
              const isAssistant = tour.assistant_id === employee.email
              const guideFee = isGuide ? (tour.guide_fee || 0) : 0
              const assistantFee = isAssistant ? (tour.assistant_fee || 0) : 0
              
              // prepaid 팁 계산
              const prepaidTip = await calculatePrepaidTip(tour, employee.email)
              
              // 경고 표시가 필요한지 확인
              const hasWarning = (isGuide && guideFee === 0) || (isAssistant && assistantFee === 0)
              
              return {
                id: tour.id,
                tour_id: tour.id,
                tour_name: getTourNameForEmployee(tour, employee.languages),
                date: tour.tour_date,
                team_type: tour.team_type || '',
                guide_fee: guideFee,
                assistant_fee: assistantFee,
                prepaid_tip: prepaidTip,
                total_fee: guideFee + assistantFee + prepaidTip,
                has_warning: hasWarning
              }
            })
          )

          const guideFee = employeeTourFees.reduce((sum, tour) => sum + tour.guide_fee, 0)
          const assistantFee = employeeTourFees.reduce((sum, tour) => sum + tour.assistant_fee, 0)
          const prepaidTip = employeeTourFees.reduce((sum, tour) => sum + tour.prepaid_tip, 0)
          const totalPay = attendancePay + guideFee + assistantFee + prepaidTip
          
          // 직원에게 경고가 필요한지 확인 (투어 fee 중 하나라도 $0이면 경고)
          const hasWarning = employeeTourFees.some(tour => tour.has_warning)

          return {
            email: employee.email,
            name: employee.name_ko,
            name_en: employee.name_en,
            position: employee.position,
            language: employee.languages,
            attendancePay,
            guideFee,
            assistantFee,
            prepaidTip,
            totalPay,
            hasWarning,
            attendanceRecords: employeeAttendanceRecords.map(record => ({
              date: record.date,
              check_in_time: record.check_in_time,
              check_out_time: record.check_out_time,
              work_hours: record.work_hours || 0,
              status: record.status
            })),
            tourFees: employeeTourFees
          }
        }) || []
      )

      setEmployeeData(processedEmployeeData)

      // 총합 계산
      const totalAttendance = processedEmployeeData.reduce((sum, emp) => sum + emp.attendancePay, 0)
      const totalGuide = processedEmployeeData.reduce((sum, emp) => sum + emp.guideFee, 0)
      const totalAssistant = processedEmployeeData.reduce((sum, emp) => sum + emp.assistantFee, 0)
      const totalPrepaid = processedEmployeeData.reduce((sum, emp) => sum + emp.prepaidTip, 0)
      const total = processedEmployeeData.reduce((sum, emp) => sum + emp.totalPay, 0)

      setTotalAttendancePay(totalAttendance)
      setTotalGuideFee(totalGuide)
      setTotalAssistantFee(totalAssistant)
      setTotalPrepaidTip(totalPrepaid)
      setTotalPay(total)

    } catch (error) {
      console.error('전체 직원 데이터 조회 중 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  // 직원의 첫 번째 언어 확인 함수 (배열 처리)
  const getEmployeePrimaryLanguage = (employeeLanguages: string[]) => {
    if (!employeeLanguages || employeeLanguages.length === 0) return 'KR'
    return employeeLanguages[0] || 'KR'
  }

  // 투어의 prepaid 팁을 계산하는 함수
  const calculatePrepaidTip = async (tour: any, employeeEmail: string) => {
    if (!tour.reservation_ids || tour.reservation_ids.length === 0) {
      return 0
    }

    try {
      // reservation_pricing에서 prepayment_tip 조회
      const { data: pricingData, error: pricingError } = await supabase
        .from('reservation_pricing')
        .select('prepayment_tip')
        .in('reservation_id', tour.reservation_ids)

      if (pricingError) {
        console.error('Reservation pricing 조회 오류:', pricingError)
        return 0
      }

      // 총 prepayment_tip 합계
      const totalTip = pricingData?.reduce((sum, pricing) => sum + (pricing.prepayment_tip || 0), 0) || 0

      // 팀 타입에 따른 팁 분배
      const isGuide = tour.tour_guide_id === employeeEmail
      const isAssistant = tour.assistant_id === employeeEmail

      if (tour.team_type === '1guide' && isGuide) {
        return totalTip // 가이드가 모두 가져감
      } else if (tour.team_type === '2guide' && (isGuide || isAssistant)) {
        return totalTip / 2 // 가이드와 어시스턴트가 절반씩
      } else if ((tour.team_type === 'guide+driver' || tour.team_type === 'guide + driver') && isGuide) {
        return totalTip // 가이드가 모두 가져감
      }

      return 0
    } catch (error) {
      console.error('Prepaid tip 계산 오류:', error)
      return 0
    }
  }

  // 개별 직원 프린트 함수
  const handlePrintEmployee = (employee: EmployeeData) => {
    const printWindow = window.open('', '_blank', 'width=800,height=600')
    
    if (printWindow) {
      const isEnglish = getEmployeePrimaryLanguage(employee.language) === 'EN'
      
      // 프린트용 헬퍼 함수들
      const formatTourDateForPrint = (dateString: string) => {
        // 날짜 문자열을 직접 파싱하여 시간대 변환 방지
        const [year, month, day] = dateString.split('-').map(Number)
        const date = new Date(year, month - 1, day)
        const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const weekday = weekdays[date.getDay()]
        
        return `${year}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')} (${weekday})`
      }

      const formatTeamTypeForPrint = (teamType: string) => {
        switch (teamType) {
          case '1guide':
            return '1 Guide'
          case '2guide':
            return '2 Guide'
          case 'guide + driver':
            return 'Guide & Driver'
          case 'guide+driver':
            return 'Guide & Driver'
          default:
            return teamType || ''
        }
      }

      const formatCurrencyForPrint = (amount: number) => {
        return amount.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })
      }
      
      // 언어별 텍스트 정의
      const texts = {
        ko: {
          title: `${employee.name_en} Payroll Details`,
          period: `Period: ${startDate} ~ ${endDate}`,
          employeeInfo: 'Employee Information',
          name: 'Name:',
          position: 'Position:',
          attendanceSubtotal: 'Attendance Subtotal',
          guideFee: 'Guide Fee',
          assistantFee: 'Assistant Fee',
          prepaidTip: 'Prepaid Tip',
          totalPay: 'Total Pay',
          attendanceRecords: 'Attendance Records',
          tourFee: 'Tour Fee',
          date: 'Date',
          checkIn: 'Check In',
          checkOut: 'Check Out',
          workHours: 'Work Hours',
          status: 'Status',
          tourDate: 'Tour Date',
          tourName: 'Tour Name',
          teamType: 'Team Type',
          guideFeeCol: 'Guide Fee',
          assistantFeeCol: 'Assistant Fee',
          totalFee: 'Total Fee',
          total: 'Total',
          normal: 'Normal',
          late: 'Late',
          absent: 'Absent'
        },
        en: {
          title: `${employee.name_en} Payroll Details`,
          period: `Period: ${startDate} ~ ${endDate}`,
          employeeInfo: 'Employee Information',
          name: 'Name:',
          position: 'Position:',
          attendanceSubtotal: 'Attendance Subtotal',
          guideFee: 'Guide Fee',
          assistantFee: 'Assistant Fee',
          prepaidTip: 'Prepaid Tip',
          totalPay: 'Total Pay',
          attendanceRecords: 'Attendance Records',
          tourFee: 'Tour Fee',
          date: 'Date',
          checkIn: 'Check In',
          checkOut: 'Check Out',
          workHours: 'Work Hours',
          status: 'Status',
          tourDate: 'Tour Date',
          tourName: 'Tour Name',
          teamType: 'Team Type',
          guideFeeCol: 'Guide Fee',
          assistantFeeCol: 'Assistant Fee',
          totalFee: 'Total Fee',
          total: 'Total',
          normal: 'Normal',
          late: 'Late',
          absent: 'Absent'
        }
      }
      
      const t = texts.en
      
      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${t.title}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .employee-info { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
            .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
            .summary-card { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
            .summary-card h3 { margin: 0 0 10px 0; font-size: 14px; color: #666; }
            .summary-card .amount { font-size: 18px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .section-title { font-size: 16px; font-weight: bold; margin: 20px 0 10px 0; color: #333; }
            .total-row { font-weight: bold; background-color: #f8f9fa; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${t.title}</h1>
            <p>${t.period}</p>
          </div>
          
          <div class="employee-info">
            <h2>${t.employeeInfo}</h2>
            <p><strong>${t.name}</strong> ${employee.hasWarning ? '⚠️ ' : ''}${employee.name_en}</p>
            <p><strong>${t.position}</strong> ${employee.position}</p>
          </div>
          
          <div class="summary">
            <div class="summary-card">
              <h3>${t.attendanceSubtotal}</h3>
              <div class="amount">$${formatCurrency(employee.attendancePay)}</div>
            </div>
            <div class="summary-card">
              <h3>${t.guideFee}</h3>
              <div class="amount">$${formatCurrency(employee.guideFee)}</div>
            </div>
            <div class="summary-card">
              <h3>${t.assistantFee}</h3>
              <div class="amount">$${formatCurrency(employee.assistantFee)}</div>
            </div>
            <div class="summary-card">
              <h3>${t.prepaidTip}</h3>
              <div class="amount">$${formatCurrency(employee.prepaidTip)}</div>
            </div>
            <div class="summary-card">
              <h3>${t.totalPay}</h3>
              <div class="amount">$${formatCurrency(employee.totalPay)}</div>
            </div>
          </div>
          
          ${employee.attendanceRecords.length > 0 ? `
            <div class="section-title">${t.attendanceRecords}</div>
            <table>
              <thead>
                <tr>
                  <th>${t.date}</th>
                  <th>${t.checkIn}</th>
                  <th>${t.checkOut}</th>
                  <th>${t.workHours}</th>
                  <th>${t.status}</th>
                </tr>
              </thead>
              <tbody>
                ${employee.attendanceRecords.map(record => `
                  <tr>
                    <td>${getDateFromCheckInTime(record.check_in_time)}</td>
                    <td>${formatTime(record.check_in_time)}</td>
                    <td>${formatTime(record.check_out_time)}</td>
                    <td>${formatWorkHours(record.work_hours)}</td>
                    <td>${record.status === 'present' ? t.normal : record.status === 'late' ? t.late : t.absent}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}
          
          ${employee.tourFees.length > 0 ? `
            <div class="section-title">${t.tourFee}</div>
            <table>
              <thead>
                <tr>
                  <th>${t.tourDate}</th>
                  <th>${t.tourName}</th>
                  <th>${t.teamType}</th>
                  <th>${t.guideFeeCol}</th>
                  <th>${t.assistantFeeCol}</th>
                  <th>${t.prepaidTip}</th>
                  <th>${t.totalFee}</th>
                </tr>
              </thead>
              <tbody>
                ${employee.tourFees.map(tour => `
                  <tr>
                    <td>${formatTourDateForPrint(tour.date)}</td>
                    <td>${tour.tour_name}</td>
                    <td>${formatTeamTypeForPrint(tour.team_type)}</td>
                    <td style="${tour.guide_fee === 0 ? 'color: #9ca3af;' : ''}">$${formatCurrencyForPrint(tour.guide_fee)}</td>
                    <td style="${tour.assistant_fee === 0 ? 'color: #9ca3af;' : ''}">$${formatCurrencyForPrint(tour.assistant_fee)}</td>
                    <td style="${tour.prepaid_tip === 0 ? 'color: #9ca3af;' : ''}">$${formatCurrencyForPrint(tour.prepaid_tip)}</td>
                    <td style="${tour.total_fee === 0 ? 'color: #9ca3af;' : ''}">$${formatCurrencyForPrint(tour.total_fee)}</td>
                  </tr>
                `).join('')}
                <tr class="total-row">
                  <td colspan="6">${t.total}</td>
                  <td>$${formatCurrencyForPrint(employee.tourFees.reduce((sum, tour) => sum + tour.total_fee, 0))}</td>
                </tr>
              </tbody>
            </table>
          ` : ''}
        </body>
        </html>
      `
      
      printWindow.document.write(printContent)
      printWindow.document.close()
      
      // 프린트 창이 로드된 후 프린트 실행
      printWindow.onload = () => {
        printWindow.print()
      }
    }
  }

  // 투어명을 직원의 언어에 맞게 표시하는 함수 (배열 처리)
  const getTourNameForEmployee = (tour: any, employeeLanguages: string[]) => {
    const product = tour.products as any
    if (!product) return '투어명 없음'
    
    // 직원의 첫 번째 언어 확인
    const primaryLanguage = getEmployeePrimaryLanguage(employeeLanguages)
    
    if (primaryLanguage === 'EN' && product.name_en) {
      return product.name_en
    } else if (product.name_ko) {
      return product.name_ko
    } else if (product.name_en) {
      return product.name_en
    }
    
    return '투어명 없음'
  }

  // 날짜 변경 핸들러
  const handleDateChange = (type: 'start' | 'end', value: string) => {
    if (type === 'start') {
      setStartDate(value)
    } else {
      setEndDate(value)
    }
  }

  // 직원 확장/축소 토글
  const toggleEmployeeExpansion = (email: string) => {
    const newExpanded = new Set(expandedEmployees)
    if (newExpanded.has(email)) {
      newExpanded.delete(email)
    } else {
      newExpanded.add(email)
    }
    setExpandedEmployees(newExpanded)
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
    return `${wholeHours}hours ${minutes}min`
  }

  // check_in_time을 라스베가스 시간으로 변환하여 날짜 추출하는 함수
  const getDateFromCheckInTime = (checkInTime: string | null) => {
    if (!checkInTime) return '-'
    
    const utcDate = new Date(checkInTime)
    const lasVegasTime = new Date(utcDate.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}))
    
    const year = lasVegasTime.getFullYear()
    const month = String(lasVegasTime.getMonth() + 1).padStart(2, '0')
    const day = String(lasVegasTime.getDate()).padStart(2, '0')
    
    const weekdayStr = lasVegasTime.toLocaleDateString('en-US', {
      weekday: 'short'
    })
    
    return `${year}-${month}-${day} (${weekdayStr})`
  }

  // 날짜 포맷팅 함수 (출퇴근 기록용)
  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short'
    })
  }

  // 투어 날짜를 YYYY.MM.DD (Mon) 형식으로 포맷하는 함수
  const formatTourDate = (dateString: string) => {
    // 날짜 문자열을 직접 파싱하여 시간대 변환 방지
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const weekday = weekdays[date.getDay()]
    
    return `${year}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')} (${weekday})`
  }

  // 팀 타입을 표시 형식으로 변환하는 함수
  const formatTeamType = (teamType: string) => {
    console.log('Team type received:', teamType)
    switch (teamType) {
      case '1guide':
        return '1 Guide'
      case '2guide':
        return '2 Guide'
      case 'guide + driver':
        return 'Guide & Driver'
      case 'guide+driver':
        return 'Guide & Driver'
      default:
        console.log('Unknown team type:', teamType)
        return teamType || ''
    }
  }

  // 숫자 포맷팅 함수 (천 단위 구분 기호 추가)
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  // 금액 표시 함수 (0원일 때 회색으로 표시)
  const formatCurrencyWithStyle = (amount: number) => {
    const formatted = formatCurrency(amount)
    const isZero = amount === 0
    return (
      <span className={isZero ? 'text-gray-400' : ''}>
        ${formatted}
      </span>
    )
  }

  // 컴포넌트 마운트 시 기본 날짜 설정
  useEffect(() => {
    if (isOpen) {
      const defaultDates = getDefaultDates()
      setStartDate(defaultDates.start)
      setEndDate(defaultDates.end)
    }
  }, [isOpen])

  // 날짜 변경 시 데이터 조회
  useEffect(() => {
    if (startDate && endDate) {
      fetchAllEmployeeData()
    }
  }, [startDate, endDate])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-t-xl sm:rounded-lg shadow-xl max-w-6xl w-full sm:mx-4 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 sticky top-0 bg-white z-10 shrink-0">
          <div className="flex items-center min-w-0">
            <Calculator className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 mr-2 shrink-0" />
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">Total Employees Summary</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors touch-manipulation shrink-0"
            type="button"
            aria-label="닫기"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* 내용 */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0">
          {/* 날짜 선택 */}
          <div className="mb-4 sm:mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  시작일
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleDateChange('start', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  종료일
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => handleDateChange('end', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  기간 선택
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={setPreviousPeriod}
                    type="button"
                    className="flex-1 px-3 py-2.5 sm:py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors touch-manipulation"
                  >
                    지난 2주
                  </button>
                  <button
                    onClick={setCurrentPeriod}
                    type="button"
                    className="flex-1 px-3 py-2.5 sm:py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors touch-manipulation"
                  >
                    이번 2주
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 통계 요약 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4 mb-4 sm:mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">출퇴근 소계</div>
              <div className="text-lg sm:text-2xl font-bold text-blue-600">
                ${formatCurrency(totalAttendancePay)}
              </div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">Guide Fee</div>
              <div className="text-lg sm:text-2xl font-bold text-purple-600">
                ${formatCurrency(totalGuideFee)}
              </div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">Assistant Fee</div>
              <div className="text-lg sm:text-2xl font-bold text-green-600">
                ${formatCurrency(totalAssistantFee)}
              </div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">Prepaid 팁</div>
              <div className="text-lg sm:text-2xl font-bold text-yellow-600">
                ${formatCurrency(totalPrepaidTip)}
              </div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 sm:p-4 col-span-2 sm:col-span-1">
              <div className="text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">Total Pay</div>
              <div className="text-lg sm:text-2xl font-bold text-orange-600">
                ${formatCurrency(totalPay)}
              </div>
            </div>
          </div>

          {/* 직원별 테이블 */}
          {loading ? (
            <div className="text-center py-6 sm:py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm sm:text-base text-gray-600">데이터를 불러오는 중...</p>
            </div>
          ) : (
            <>
              {/* 모바일: 직원 카드 리스트 */}
              <div className="md:hidden space-y-2">
                {employeeData.map((employee) => (
                  <div
                    key={employee.email}
                    className="bg-white border border-gray-200 rounded-lg overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggleEmployeeExpansion(employee.email)}
                      className="w-full text-left p-3 flex items-center justify-between gap-2 hover:bg-gray-50 active:bg-gray-100 touch-manipulation"
                    >
                      <div className="flex items-center min-w-0">
                        {employee.hasWarning && (
                          <span className="text-red-500 mr-1.5 shrink-0" title="Fee가 $0으로 설정된 투어가 있습니다">⚠️</span>
                        )}
                        <span className="font-medium text-gray-900 truncate">{employee.name}</span>
                      </div>
                      <span className="text-sm font-medium text-green-600 shrink-0">{formatCurrencyWithStyle(employee.totalPay)}</span>
                      {expandedEmployees.has(employee.email) ? (
                        <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
                      )}
                    </button>
                    <div className="px-3 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs text-gray-600">
                      <span>출퇴근</span>
                      <span>{formatCurrencyWithStyle(employee.attendancePay)}</span>
                      <span>Guide</span>
                      <span>{formatCurrencyWithStyle(employee.guideFee)}</span>
                      <span>Assistant</span>
                      <span>{formatCurrencyWithStyle(employee.assistantFee)}</span>
                      <span>Prepaid</span>
                      <span>{formatCurrencyWithStyle(employee.prepaidTip)}</span>
                      <span>투어</span>
                      <span>{employee.tourFees.length}회</span>
                    </div>
                    {expandedEmployees.has(employee.email) && (
                      <div className="border-t border-gray-100 bg-gray-50 p-3 space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="text-sm font-semibold text-gray-900">{employee.name} 상세</h4>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handlePrintEmployee(employee)
                            }}
                            className="flex items-center px-2 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md touch-manipulation"
                          >
                            <Printer className="w-3.5 h-3.5 mr-1" />
                            Print
                          </button>
                        </div>
                        {employee.attendanceRecords.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center">
                              <Clock className="w-3.5 h-3.5 mr-1" />
                              Attendance
                            </h4>
                            <div className="space-y-1.5">
                              {employee.attendanceRecords.map((record, index) => (
                                <div key={index} className="flex flex-wrap items-center justify-between gap-2 text-xs bg-white rounded p-2">
                                  <span>{getDateFromCheckInTime(record.check_in_time)}</span>
                                  <span>{formatTime(record.check_in_time)} ~ {formatTime(record.check_out_time)}</span>
                                  <span>{formatWorkHours(record.work_hours)}</span>
                                  <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${
                                    record.status === 'present' ? 'bg-green-100 text-green-800' :
                                    record.status === 'late' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                                  }`}>
                                    {record.status === 'present' ? 'Normal' : record.status === 'late' ? 'Late' : 'Absent'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {employee.tourFees.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center">
                              <DollarSign className="w-3.5 h-3.5 mr-1" />
                              Tour Fee
                            </h4>
                            <div className="space-y-1.5">
                              {employee.tourFees.map((tour) => (
                                <div key={tour.id} className="text-xs bg-white rounded p-2">
                                  <div className="flex justify-between items-start gap-2">
                                    <Link
                                      href={`/${locale}/admin/tours/${tour.tour_id}`}
                                      className="text-blue-600 hover:underline truncate"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {tour.tour_name}
                                    </Link>
                                    <span className="font-medium text-gray-900 shrink-0">{formatCurrencyWithStyle(tour.total_fee)}</span>
                                  </div>
                                  <div className="mt-1 text-[10px] text-gray-500">
                                    {formatTourDate(tour.date)} · {formatTeamType(tour.team_type)} · G: {formatCurrencyWithStyle(tour.guide_fee)} A: {formatCurrencyWithStyle(tour.assistant_fee)} Tip: {formatCurrencyWithStyle(tour.prepaid_tip)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <div className="text-right text-sm font-bold text-orange-600 pt-2">
                  Total: ${formatCurrency(totalPay)}
                </div>
              </div>

              {/* 데스크톱: 테이블 */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Employee Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Attendance Subtotal
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Guide Fee
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Assistant Fee
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Prepaid Tip
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tour Count
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Subtotal
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {employeeData.map((employee) => (
                      <React.Fragment key={employee.email}>
                        <tr 
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => toggleEmployeeExpansion(employee.email)}
                        >
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            <div className="flex items-center">
                              {employee.hasWarning && (
                                <span className="text-red-500 mr-2" title="Fee가 $0으로 설정된 투어가 있습니다">
                                  ⚠️
                                </span>
                              )}
                              {employee.name}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrencyWithStyle(employee.attendancePay)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrencyWithStyle(employee.guideFee)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrencyWithStyle(employee.assistantFee)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrencyWithStyle(employee.prepaidTip)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {employee.tourFees.length}회
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-green-600">
                            {formatCurrencyWithStyle(employee.totalPay)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleEmployeeExpansion(employee.email)
                              }}
                              className="text-blue-600 hover:text-blue-800 transition-colors"
                            >
                              {expandedEmployees.has(employee.email) ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                        </tr>
                        
                        {/* 확장된 상세 정보 (데스크톱) */}
                        {expandedEmployees.has(employee.email) && (
                          <tr>
                            <td colSpan={8} className="px-4 py-4 bg-gray-50">
                              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
                                <h4 className="text-sm font-semibold text-gray-900">{employee.name} 상세 내역</h4>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handlePrintEmployee(employee)
                                  }}
                                  className="flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors w-fit"
                                >
                                  <Printer className="w-4 h-4 mr-1" />
                                  Print
                                </button>
                              </div>
                              <div className="space-y-4">
                                {/* 출퇴근 기록 */}
                                {employee.attendanceRecords.length > 0 && (
                                  <div>
                                    <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center">
                                      <Clock className="w-4 h-4 mr-1" />
                                      Attendance Records
                                    </h4>
                                    <div className="overflow-x-auto">
                                      <table className="min-w-full text-sm">
                                        <thead className="bg-gray-100">
                                          <tr>
                                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase">Check In</th>
                                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase">Check Out</th>
                                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase">Work Hours</th>
                                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                          {employee.attendanceRecords.map((record, index) => (
                                            <tr key={index}>
                                              <td className="px-2 py-1 text-gray-900">
                                                {getDateFromCheckInTime(record.check_in_time)}
                                              </td>
                                              <td className="px-2 py-1 text-gray-900">
                                                {formatTime(record.check_in_time)}
                                              </td>
                                              <td className="px-2 py-1 text-gray-900">
                                                {formatTime(record.check_out_time)}
                                              </td>
                                              <td className="px-2 py-1 text-gray-900">
                                                {formatWorkHours(record.work_hours)}
                                              </td>
                                              <td className="px-2 py-1">
                                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                                  record.status === 'present' 
                                                    ? 'bg-green-100 text-green-800'
                                                    : record.status === 'late'
                                                    ? 'bg-yellow-100 text-yellow-800'
                                                    : 'bg-red-100 text-red-800'
                                                }`}>
                                                  {record.status === 'present' ? 'Normal' : 
                                                   record.status === 'late' ? 'Late' : 'Absent'}
                                                </span>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}

                                {/* 투어 Fee */}
                                {employee.tourFees.length > 0 && (
                                  <div>
                                    <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center">
                                      <DollarSign className="w-4 h-4 mr-1" />
                                      Tour Fee
                                    </h4>
                                    <div className="overflow-x-auto">
                                      <table className="min-w-full text-sm">
                                        <thead className="bg-gray-100">
                                          <tr>
                                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase">Tour Date</th>
                                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase">Tour Name</th>
                                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase">Team Type</th>
                                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase">Guide Fee</th>
                                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase">Assistant Fee</th>
                                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase">Prepaid Tip</th>
                                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase">Total Fee</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                          {employee.tourFees.map((tour) => (
                                            <tr key={tour.id}>
                                              <td className="px-2 py-1 text-gray-900">
                                                {formatTourDate(tour.date)}
                                              </td>
                                              <td className="px-2 py-1 text-gray-900">
                                                <Link 
                                                  href={`/${locale}/admin/tours/${tour.tour_id}`}
                                                  className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  {tour.tour_name}
                                                </Link>
                                              </td>
                                              <td className="px-2 py-1 text-gray-900">
                                                {formatTeamType(tour.team_type)}
                                              </td>
                                              <td className="px-2 py-1 text-gray-900">
                                                {formatCurrencyWithStyle(tour.guide_fee)}
                                              </td>
                                              <td className="px-2 py-1 text-gray-900">
                                                {formatCurrencyWithStyle(tour.assistant_fee)}
                                              </td>
                                              <td className="px-2 py-1 text-gray-900">
                                                {formatCurrencyWithStyle(tour.prepaid_tip)}
                                              </td>
                                              <td className="px-2 py-1 text-gray-900 font-medium">
                                                {formatCurrencyWithStyle(tour.total_fee)}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900">Total</td>
                      <td className="px-4 py-3 text-sm font-bold text-blue-600">
                        ${formatCurrency(totalAttendancePay)}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-purple-600">
                        ${formatCurrency(totalGuideFee)}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-green-600">
                        ${formatCurrency(totalAssistantFee)}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-yellow-600">
                        ${formatCurrency(totalPrepaidTip)}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-600">
                        {employeeData.reduce((sum, emp) => sum + emp.tourFees.length, 0)}회
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-orange-600">
                        ${formatCurrency(totalPay)}
                      </td>
                      <td className="px-4 py-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
