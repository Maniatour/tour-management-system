'use client'

import React, { useState, useEffect } from 'react'
import { X, Calculator, ChevronDown, ChevronRight, Clock, DollarSign, Printer } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import {
  fetchEmployeeHourlyRatePeriods,
  getHourlyRateForEmployeeOnDate,
  employeeHasHourlyPeriods,
  lasVegasDateFromCheckIn,
} from '@/lib/employeeHourlyRates'

interface TotalEmployeesModalProps {
  isOpen: boolean
  onClose: () => void
  locale?: string
  /** 미지급(15일 초과) 직원 수를 부모에 전달 */
  onOverdueCountChange?: (count: number) => void
}

interface EmployeeData {
  email: string
  name: string
  name_en: string
  position: string
  language: string[]
  /** team.is_active */
  is_active: boolean
  attendancePay: number
  guideFee: number
  assistantFee: number
  prepaidTip: number
  totalPay: number
  hasWarning: boolean
  lastPaid: { date: string; amount: number } | null
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
    staff_names: string
    tour_guide_id: string | null
    assistant_id: string | null
    is_guide: boolean
    is_assistant: boolean
    guide_fee: number
    assistant_fee: number
    prepaid_tip: number
    total_fee: number
    has_warning: boolean
  }>
}

export default function TotalEmployeesModal({ isOpen, onClose, locale = 'ko', onOverdueCountChange }: TotalEmployeesModalProps) {
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
  /** true: 재직(활성) 직원만 표시 */
  const [filterActiveOnly, setFilterActiveOnly] = useState(true)
  /** true: 해당 기간 Subtotal(totalPay) > 0 인 직원만 표시 */
  const [filterSubtotalPositive, setFilterSubtotalPositive] = useState(false)

  // 로컬 날짜를 YYYY-MM-DD로 (toISOString은 UTC라 타임존에서 하루 어긋날 수 있음)
  const toLocalDateString = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  // 현재 날짜 기준으로 기본값 설정
  const getDefaultDates = () => {
    const today = new Date()
    const twoWeeksAgo = new Date(today)
    twoWeeksAgo.setDate(today.getDate() - 13)
    return {
      start: toLocalDateString(twoWeeksAgo),
      end: toLocalDateString(today)
    }
  }

  // 이번 2주 설정 (오늘 기준으로 1-15일 또는 16-말일)
  const setCurrentPeriod = () => {
    const today = new Date()
    const currentDate = today.getDate()
    if (currentDate <= 15) {
      const startDate = new Date(today.getFullYear(), today.getMonth(), 1)
      const endDate = new Date(today.getFullYear(), today.getMonth(), 15)
      setStartDate(toLocalDateString(startDate))
      setEndDate(toLocalDateString(endDate))
    } else {
      const startDate = new Date(today.getFullYear(), today.getMonth(), 16)
      const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      setStartDate(toLocalDateString(startDate))
      setEndDate(toLocalDateString(endDate))
    }
  }

  // 지난 2주 설정 (현재 기간의 이전 2주)
  const setPreviousPeriod = () => {
    const today = new Date()
    const currentDate = today.getDate()
    if (currentDate <= 15) {
      // 현재가 1-15일이면, 지난 달 16일-말일
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
      const startDate = new Date(today.getFullYear(), today.getMonth() - 1, 16)
      setStartDate(toLocalDateString(startDate))
      setEndDate(toLocalDateString(lastMonthEnd))
    } else {
      // 현재가 16-말일이면, 이번 달 1일-15일
      const startDate = new Date(today.getFullYear(), today.getMonth(), 1)
      const endDate = new Date(today.getFullYear(), today.getMonth(), 15)
      setStartDate(toLocalDateString(startDate))
      setEndDate(toLocalDateString(endDate))
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
        .select('email, name_ko, name_en, nick_name, display_name, position, languages, is_active')
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

      const ratePeriods = await fetchEmployeeHourlyRatePeriods(supabase)

      const teamNameMap: Record<string, string> = {}
      ;(teamData || []).forEach((m: { email: string; nick_name?: string | null; display_name?: string | null; name_ko?: string | null }) => {
        teamNameMap[m.email] = (m.nick_name || m.display_name || m.name_ko || m.email).trim() || m.email
      })

      // 직원별 데이터 처리
      const processedEmployeeData: EmployeeData[] = await Promise.all(
        teamData?.map(async (employee) => {
          // 출퇴근 기록 필터링
          const employeeAttendanceRecords = filteredAttendanceData.filter(record => 
            record.employee_email === employee.email
          )

          const useDbRates = employeeHasHourlyPeriods(ratePeriods, employee.email)

          // 실제 근무시간·출퇴근 급여 (DB에 직원별 구간이 있으면 일자별 시급, 없으면 시간당 $15)
          let attendancePay = 0
          const actualTotalHours = employeeAttendanceRecords.reduce((sum, record) => {
            let workHours = record.work_hours || 0
            if (workHours > 8) {
              workHours = workHours - 0.5
            }
            const dayStr =
              lasVegasDateFromCheckIn(record.check_in_time) ||
              (typeof record.date === 'string' ? record.date.slice(0, 10) : null)
            const rateForDay =
              useDbRates && dayStr
                ? getHourlyRateForEmployeeOnDate(ratePeriods, employee.email, dayStr, 15)
                : 15
            attendancePay += workHours * rateForDay
            return sum + workHours
          }, 0)

          // 투어 fee 필터링 및 prepaid 팁 계산
          const filteredTours = tourData?.filter(tour => 
            tour.tour_guide_id === employee.email || tour.assistant_id === employee.email
          ) || []
          
          const staffNamesForTour = (t: typeof tour) =>
            [t.tour_guide_id, t.assistant_id]
              .filter((id): id is string => !!id)
              .filter(id => id !== employee.email)
              .map(id => teamNameMap[id] || id)
              .join(', ') || '—'

          const employeeTourFees = await Promise.all(
            filteredTours.map(async (tour) => {
              const isGuide = tour.tour_guide_id === employee.email
              const isAssistant = tour.assistant_id === employee.email
              const tourGuideFee = tour.guide_fee ?? 0
              const tourAssistantFee = tour.assistant_fee ?? 0
              const prepaidTip = await calculatePrepaidTip(tour, employee.email)
              const total_fee = (isGuide ? tourGuideFee : 0) + (isAssistant ? tourAssistantFee : 0) + prepaidTip
              const hasWarning = (isGuide && tourGuideFee === 0) || (isAssistant && tourAssistantFee === 0)
              return {
                id: tour.id,
                tour_id: tour.id,
                tour_name: getTourNameForEmployee(tour, employee.languages),
                date: tour.tour_date,
                team_type: tour.team_type || '',
                staff_names: staffNamesForTour(tour),
                tour_guide_id: tour.tour_guide_id ?? null,
                assistant_id: tour.assistant_id ?? null,
                is_guide: isGuide,
                is_assistant: isAssistant,
                guide_fee: tourGuideFee,
                assistant_fee: tourAssistantFee,
                prepaid_tip: prepaidTip,
                total_fee,
                has_warning: hasWarning
              }
            })
          )

          const guideFee = employeeTourFees.reduce((sum, tour) => sum + (tour.is_guide ? tour.guide_fee : 0), 0)
          const assistantFee = employeeTourFees.reduce((sum, tour) => sum + (tour.is_assistant ? tour.assistant_fee : 0), 0)
          const prepaidTip = employeeTourFees.reduce((sum, tour) => sum + tour.prepaid_tip, 0)
          const totalPay = attendancePay + guideFee + assistantFee + prepaidTip
          
          // 직원에게 경고가 필요한지 확인 (투어 fee 중 하나라도 $0이면 경고)
          const hasWarning = employeeTourFees.some(tour => tour.has_warning)

          // company_expenses에서 해당 직원의 가장 최근 가이드비/웨이지 지불일·금액 조회
          let lastPaid: { date: string; amount: number } | null = null
          try {
            const { data: rows } = await supabase
              .from('company_expenses')
              .select('paid_on, submit_on, amount')
              .eq('paid_to_employee_email', employee.email)
              .or('paid_for.ilike.%guide fee%,paid_for.ilike.%wage%,paid_for.ilike.%wages%')
              .order('submit_on', { ascending: false })
              .limit(30)
            if (rows?.length) {
              const withDate = (rows as { paid_on?: string | null; submit_on?: string | null; amount?: number }[])
                .map((r) => ({
                  date: (r.paid_on || r.submit_on)?.slice(0, 10),
                  amount: Number(r.amount) || 0
                }))
                .filter((x): x is { date: string; amount: number } => !!x.date)
              if (withDate.length) {
                const latest = withDate.reduce((a, b) => (b.date > a.date ? b : a))
                lastPaid = { date: latest.date, amount: latest.amount }
              }
            }
          } catch (_) {}

          return {
            email: employee.email,
            name: employee.name_ko,
            name_en: employee.name_en,
            position: employee.position,
            language: employee.languages,
            is_active: (employee as { is_active?: boolean }).is_active !== false,
            attendancePay,
            guideFee,
            assistantFee,
            prepaidTip,
            totalPay,
            hasWarning,
            lastPaid,
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

  // 투어의 prepaid 팁 (2주급 계산기와 동일: reservation_pricing 합계의 90% 후 2guide 50% / 1guide·guide+driver 가이드 100%, 없으면 tour_tip_shares)
  const calculatePrepaidTip = async (tour: any, employeeEmail: string) => {
    try {
      const isGuide = tour.tour_guide_id === employeeEmail
      const isAssistant = tour.assistant_id === employeeEmail
      let prepayment_tip_total = 0
      let prepaidTips = 0

      if (tour.reservation_ids && tour.reservation_ids.length > 0) {
        const { data: pricingData, error: pricingError } = await supabase
          .from('reservation_pricing')
          .select('prepayment_tip')
          .in('reservation_id', tour.reservation_ids)
        if (!pricingError && pricingData) {
          prepayment_tip_total = pricingData.reduce((sum, p) => sum + (p.prepayment_tip || 0), 0)
          const after10Percent = prepayment_tip_total * 0.9
          const is2guide = tour.team_type === '2guide'
          if (is2guide && (isGuide || isAssistant)) {
            prepaidTips = after10Percent * 0.5
          } else if (
            (tour.team_type === '1guide' ||
              tour.team_type === 'guide+driver' ||
              tour.team_type === 'guide + driver') &&
            isGuide
          ) {
            prepaidTips = after10Percent
          }
        }
      }

      if (prepaidTips === 0 && prepayment_tip_total === 0) {
        const { data: tipShareData, error: tipShareError } = await supabase
          .from('tour_tip_shares')
          .select('total_tip, guide_amount, assistant_amount')
          .eq('tour_id', tour.id)
          .maybeSingle()
        if (!tipShareError && tipShareData) {
          if (isGuide) return tipShareData.guide_amount ?? 0
          if (isAssistant) return tipShareData.assistant_amount ?? 0
        }
      }

      return prepaidTips
    } catch (error) {
      console.error('Prepaid tip 계산 오류:', error)
      return 0
    }
  }

  // 투어 Fee 인라인 수정 (Team Type, Guide Fee, Assistant Fee, Prepaid Tip)
  const handleTourFeeUpdate = async (
    employeeEmail: string,
    tourId: string,
    field: 'team_type' | 'guide_fee' | 'assistant_fee' | 'prepaid_tip',
    value: number | string
  ) => {
    const emp = employeeData.find(e => e.email === employeeEmail)
    const tourItem = emp?.tourFees.find(t => t.tour_id === tourId)
    if (!tourItem) return

    if (field === 'team_type') {
      const teamTypeValue = typeof value === 'string' ? value : ''
      const { error } = await supabase.from('tours').update({ team_type: teamTypeValue }).eq('id', tourId)
      if (error) {
        console.error('Team type 업데이트 오류:', error)
        return
      }
      setEmployeeData(prev =>
        prev.map(e => ({
          ...e,
          tourFees: e.tourFees.map(t => (t.tour_id === tourId ? { ...t, team_type: teamTypeValue } : t))
        }))
      )
      return
    }

    if (field === 'guide_fee') {
      const numValue = typeof value === 'number' ? value : 0
      const { error } = await supabase.from('tours').update({ guide_fee: numValue }).eq('id', tourId)
      if (error) {
        console.error('Guide fee 업데이트 오류:', error)
        return
      }
      setEmployeeData(prev =>
        prev.map(e => {
          const updatedFees = e.tourFees.map(t =>
            t.tour_id === tourId
              ? { ...t, guide_fee: numValue, total_fee: (t.is_guide ? numValue : t.guide_fee) + (t.is_assistant ? t.assistant_fee : 0) + t.prepaid_tip }
              : t
          )
          const guideFee = updatedFees.reduce((s, t) => s + (t.is_guide ? t.guide_fee : 0), 0)
          const assistantFee = updatedFees.reduce((s, t) => s + (t.is_assistant ? t.assistant_fee : 0), 0)
          const prepaidTip = updatedFees.reduce((s, t) => s + t.prepaid_tip, 0)
          return { ...e, tourFees: updatedFees, guideFee, assistantFee, prepaidTip, totalPay: e.attendancePay + guideFee + assistantFee + prepaidTip }
        })
      )
      return
    }

    if (field === 'assistant_fee') {
      const numValue = typeof value === 'number' ? value : 0
      const { error } = await supabase.from('tours').update({ assistant_fee: numValue }).eq('id', tourId)
      if (error) {
        console.error('Assistant fee 업데이트 오류:', error)
        return
      }
      setEmployeeData(prev =>
        prev.map(e => {
          const updatedFees = e.tourFees.map(t =>
            t.tour_id === tourId
              ? { ...t, assistant_fee: numValue, total_fee: (t.is_guide ? t.guide_fee : 0) + (t.is_assistant ? numValue : t.assistant_fee) + t.prepaid_tip }
              : t
          )
          const guideFee = updatedFees.reduce((s, t) => s + (t.is_guide ? t.guide_fee : 0), 0)
          const assistantFee = updatedFees.reduce((s, t) => s + (t.is_assistant ? t.assistant_fee : 0), 0)
          const prepaidTip = updatedFees.reduce((s, t) => s + t.prepaid_tip, 0)
          return { ...e, tourFees: updatedFees, guideFee, assistantFee, prepaidTip, totalPay: e.attendancePay + guideFee + assistantFee + prepaidTip }
        })
      )
      return
    }

    // prepaid_tip: 이 직원의 몫으로 total_tip 역산 후 tour_tip_shares 업데이트
    const numValue = typeof value === 'number' ? value : 0
    const tt = tourItem.team_type
    const isGuide = tourItem.is_guide
    const isAssistant = tourItem.is_assistant
    let newTotalTip = 0
    let guideAmount = 0
    let assistantAmount = 0
    if (tt === '1guide' && isGuide) {
      newTotalTip = numValue
      guideAmount = numValue
    } else if (tt === '2guide') {
      newTotalTip = numValue * 2
      guideAmount = numValue
      assistantAmount = numValue
    } else if ((tt === 'guide+driver' || tt === 'guide + driver') && isGuide) {
      newTotalTip = numValue
      guideAmount = numValue
    } else {
      return
    }

    const { data: existingTipShare } = await supabase
      .from('tour_tip_shares')
      .select('id, total_tip, guide_amount, assistant_amount')
      .eq('tour_id', tourId)
      .maybeSingle()

    if (existingTipShare) {
      const { error: updateError } = await supabase
        .from('tour_tip_shares')
        .update({ total_tip: newTotalTip, guide_amount: guideAmount, assistant_amount: assistantAmount })
        .eq('tour_id', tourId)
      if (updateError) {
        console.error('팁 쉐어 업데이트 오류:', updateError)
        return
      }
    } else {
      const { error: insertError } = await supabase.from('tour_tip_shares').insert({
        tour_id: tourId,
        guide_email: tourItem.tour_guide_id,
        assistant_email: tourItem.assistant_id,
        total_tip: newTotalTip,
        guide_amount: guideAmount,
        assistant_amount: assistantAmount,
        guide_percent: newTotalTip > 0 ? (guideAmount / newTotalTip) * 100 : 0,
        assistant_percent: newTotalTip > 0 ? (assistantAmount / newTotalTip) * 100 : 0
      })
      if (insertError) {
        console.error('팁 쉐어 생성 오류:', insertError)
        return
      }
    }

    setEmployeeData(prev =>
      prev.map(e => {
        const updatedFees = e.tourFees.map(t => {
          if (t.tour_id !== tourId) return t
          const newPrepaid = t.is_guide ? guideAmount : t.is_assistant ? assistantAmount : 0
          const total_fee = (t.is_guide ? t.guide_fee : 0) + (t.is_assistant ? t.assistant_fee : 0) + newPrepaid
          return { ...t, prepaid_tip: newPrepaid, total_fee }
        })
        const prepaidTip = updatedFees.reduce((s, t) => s + t.prepaid_tip, 0)
        const guideFee = updatedFees.reduce((s, t) => s + (t.is_guide ? t.guide_fee : 0), 0)
        const assistantFee = updatedFees.reduce((s, t) => s + (t.is_assistant ? t.assistant_fee : 0), 0)
        return {
          ...e,
          tourFees: updatedFees,
          guideFee,
          assistantFee,
          prepaidTip,
          totalPay: e.attendancePay + guideFee + assistantFee + prepaidTip
        }
      })
    )
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
                  <th>가이드</th>
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
                    <td>${tour.staff_names || '—'}</td>
                    <td style="${tour.guide_fee === 0 ? 'color: #9ca3af;' : ''}">$${formatCurrencyForPrint(tour.guide_fee)}</td>
                    <td style="${tour.assistant_fee === 0 ? 'color: #9ca3af;' : ''}">$${formatCurrencyForPrint(tour.assistant_fee)}</td>
                    <td style="${tour.prepaid_tip === 0 ? 'color: #9ca3af;' : ''}">$${formatCurrencyForPrint(tour.prepaid_tip)}</td>
                    <td style="${tour.total_fee === 0 ? 'color: #9ca3af;' : ''}">$${formatCurrencyForPrint(tour.total_fee)}</td>
                  </tr>
                `).join('')}
                <tr class="total-row">
                  <td colspan="7">${t.total}</td>
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

  const filteredEmployeeData = employeeData.filter((e) => {
    if (filterActiveOnly && !e.is_active) return false
    if (filterSubtotalPositive && e.totalPay <= 0) return false
    return true
  })

  // 필터 적용 후 표시 구간 총합
  const displayTotalAttendancePay =
    employeeData.length > 0 ? filteredEmployeeData.reduce((s, e) => s + e.attendancePay, 0) : totalAttendancePay
  const displayTotalGuideFee =
    employeeData.length > 0 ? filteredEmployeeData.reduce((s, e) => s + e.guideFee, 0) : totalGuideFee
  const displayTotalAssistantFee =
    employeeData.length > 0 ? filteredEmployeeData.reduce((s, e) => s + e.assistantFee, 0) : totalAssistantFee
  const displayTotalPrepaidTip =
    employeeData.length > 0 ? filteredEmployeeData.reduce((s, e) => s + e.prepaidTip, 0) : totalPrepaidTip
  const displayTotalPay =
    employeeData.length > 0 ? filteredEmployeeData.reduce((s, e) => s + e.totalPay, 0) : totalPay

  // Subtotal > 0 이고 Last Paid가 15일 초과(또는 없음)이면 미지급 강조
  const isPaymentOverdue = (emp: EmployeeData) => {
    if (emp.totalPay <= 0) return false
    if (!emp.lastPaid?.date) return true
    const last = new Date(emp.lastPaid.date + 'T00:00:00').getTime()
    const today = new Date().setHours(0, 0, 0, 0)
    const daysSince = Math.floor((today - last) / (24 * 60 * 60 * 1000))
    return daysSince > 15
  }

  const overdueCount = employeeData.filter(isPaymentOverdue).length

  /** 현재 화면(필터 반영)과 동일한 요약 테이블 프린트 */
  const handlePrintSummary = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) return

    const formatCurrencyForPrint = (n: number) =>
      n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    const esc = (s: string) =>
      String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')

    const list = filteredEmployeeData
    const filterLine = [
      filterActiveOnly ? 'Active employees only' : 'Including inactive',
      filterSubtotalPositive ? 'Subtotal &gt; 0 only' : 'All subtotals',
    ].join(' · ')

    const lastPaidFmt = (emp: EmployeeData) => {
      if (!emp.lastPaid) return '—'
      const d = new Date(emp.lastPaid.date + 'T00:00:00').toLocaleDateString(locale === 'en' ? 'en-US' : 'ko-KR')
      return `${d} / $${formatCurrencyForPrint(emp.lastPaid.amount)}`
    }

    const rows =
      list.length > 0
        ? list
            .map(
              (emp) => `
          <tr class="${isPaymentOverdue(emp) ? 'overdue' : ''}">
            <td>${esc(emp.name || '')}${emp.hasWarning ? ' ⚠' : ''}${!emp.is_active ? ' <span class="muted">(Inactive)</span>' : ''}</td>
            <td class="num">$${formatCurrencyForPrint(emp.attendancePay)}</td>
            <td class="num">$${formatCurrencyForPrint(emp.guideFee)}</td>
            <td class="num">$${formatCurrencyForPrint(emp.assistantFee)}</td>
            <td class="num">$${formatCurrencyForPrint(emp.prepaidTip)}</td>
            <td class="num">${emp.tourFees.length}</td>
            <td class="num strong">$${formatCurrencyForPrint(emp.totalPay)}</td>
            <td class="small">${lastPaidFmt(emp)}</td>
          </tr>`
            )
            .join('')
        : `<tr><td colspan="8" style="text-align:center;color:#666;padding:12px">No employees match the current filters.</td></tr>`

    const totalTourSessions = list.reduce((s, e) => s + e.tourFees.length, 0)

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Total Employees Summary</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 10px 12px; color: #111; font-size: 11px; }
          h1 { font-size: 16px; margin: 0 0 4px 0; }
          .sub { color: #666; margin-bottom: 8px; font-size: 11px; }
          .filters { color: #374151; margin-bottom: 10px; font-size: 10px; }
          .totals { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-bottom: 12px; }
          .totals div { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; padding: 6px 8px; text-align: center; }
          .totals .lbl { font-size: 9px; color: #6b7280; margin-bottom: 2px; }
          .totals .amt { font-weight: 700; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; }
          th, td { border: 1px solid #d1d5db; padding: 4px 6px; text-align: left; }
          th { background: #f9fafb; font-weight: 600; }
          th.num { text-align: right; }
          td.num { text-align: right; }
          td.strong { font-weight: 600; color: #059669; }
          tr.overdue { background: #fef2f2; }
          .muted { color: #6b7280; font-size: 9px; }
          td.small { font-size: 9px; }
          tfoot td { font-weight: 700; background: #f3f4f6; }
          @media print { body { padding: 6px 8px; } }
        </style>
      </head>
      <body>
        <h1>Total Employees Summary</h1>
        <div class="sub">Period: ${startDate} ~ ${endDate}</div>
        <div class="filters">${filterLine} · Showing ${list.length} / ${employeeData.length} employees</div>
        <div class="totals">
          <div><div class="lbl">Attendance Subtotal</div><div class="amt">$${formatCurrencyForPrint(displayTotalAttendancePay)}</div></div>
          <div><div class="lbl">Guide Fee</div><div class="amt">$${formatCurrencyForPrint(displayTotalGuideFee)}</div></div>
          <div><div class="lbl">Assistant Fee</div><div class="amt">$${formatCurrencyForPrint(displayTotalAssistantFee)}</div></div>
          <div><div class="lbl">Prepaid Tip</div><div class="amt">$${formatCurrencyForPrint(displayTotalPrepaidTip)}</div></div>
          <div><div class="lbl">Total Pay</div><div class="amt">$${formatCurrencyForPrint(displayTotalPay)}</div></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Employee Name</th>
              <th class="num">Attendance</th>
              <th class="num">Guide Fee</th>
              <th class="num">Asst. Fee</th>
              <th class="num">Prepaid Tip</th>
              <th class="num">Tours</th>
              <th class="num">Subtotal</th>
              <th>Last Paid</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td class="num">$${formatCurrencyForPrint(displayTotalAttendancePay)}</td>
              <td class="num">$${formatCurrencyForPrint(displayTotalGuideFee)}</td>
              <td class="num">$${formatCurrencyForPrint(displayTotalAssistantFee)}</td>
              <td class="num">$${formatCurrencyForPrint(displayTotalPrepaidTip)}</td>
              <td class="num">${totalTourSessions}</td>
              <td class="num">$${formatCurrencyForPrint(displayTotalPay)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </body>
      </html>
    `

    printWindow.document.write(printContent)
    printWindow.document.close()
    printWindow.onload = () => {
      printWindow.print()
    }
  }

  useEffect(() => {
    onOverdueCountChange?.(overdueCount)
  }, [overdueCount, onOverdueCountChange])

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
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handlePrintSummary}
              disabled={loading || employeeData.length === 0}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors touch-manipulation disabled:opacity-40 disabled:pointer-events-none"
              title="요약 프린트"
              aria-label="요약 프린트"
            >
              <Printer className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors touch-manipulation shrink-0"
              type="button"
              aria-label="닫기"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
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

          {/* 필터 */}
          {!loading && employeeData.length > 0 && (
            <div className="mb-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3">
              <span className="text-sm font-medium text-gray-700 shrink-0">필터</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFilterActiveOnly((v) => !v)}
                  className={`px-3 py-2 text-sm font-medium rounded-md border transition-colors touch-manipulation ${
                    filterActiveOnly
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Active 직원
                </button>
                <button
                  type="button"
                  onClick={() => setFilterSubtotalPositive((v) => !v)}
                  className={`px-3 py-2 text-sm font-medium rounded-md border transition-colors touch-manipulation ${
                    filterSubtotalPositive
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Subtotal &gt; 0
                </button>
              </div>
              <span className="text-xs text-gray-500 sm:ml-auto">
                표시 {filteredEmployeeData.length}명 / 전체 {employeeData.length}명
              </span>
            </div>
          )}

          {/* 통계 요약 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4 mb-4 sm:mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">출퇴근 소계</div>
              <div className="text-lg sm:text-2xl font-bold text-blue-600">
                ${formatCurrency(displayTotalAttendancePay)}
              </div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">Guide Fee</div>
              <div className="text-lg sm:text-2xl font-bold text-purple-600">
                ${formatCurrency(displayTotalGuideFee)}
              </div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">Assistant Fee</div>
              <div className="text-lg sm:text-2xl font-bold text-green-600">
                ${formatCurrency(displayTotalAssistantFee)}
              </div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">Prepaid 팁</div>
              <div className="text-lg sm:text-2xl font-bold text-yellow-600">
                ${formatCurrency(displayTotalPrepaidTip)}
              </div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 sm:p-4 col-span-2 sm:col-span-1">
              <div className="text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">Total Pay</div>
              <div className="text-lg sm:text-2xl font-bold text-orange-600">
                ${formatCurrency(displayTotalPay)}
              </div>
            </div>
          </div>

          {/* 직원별 테이블 */}
          {loading ? (
            <div className="text-center py-6 sm:py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm sm:text-base text-gray-600">데이터를 불러오는 중...</p>
            </div>
          ) : filteredEmployeeData.length === 0 && employeeData.length > 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              필터 조건에 맞는 직원이 없습니다. 필터를 해제해 보세요.
            </div>
          ) : (
            <>
              {/* 모바일: 직원 카드 리스트 */}
              <div className="md:hidden space-y-2">
                {filteredEmployeeData.map((employee) => (
                  <div
                    key={employee.email}
                    className={`rounded-lg overflow-hidden ${
                      isPaymentOverdue(employee)
                        ? 'bg-red-50 border-2 border-red-300'
                        : 'bg-white border border-gray-200'
                    }`}
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
                        <span className="font-medium text-gray-900 truncate">
                          {employee.name}
                          {!employee.is_active && (
                            <span className="ml-1.5 text-[10px] font-normal text-gray-500 bg-gray-200 px-1 rounded">Inactive</span>
                          )}
                        </span>
                      </div>
                      <span className={`text-sm font-medium shrink-0 ${isPaymentOverdue(employee) ? 'text-red-600' : 'text-green-600'}`}>{formatCurrencyWithStyle(employee.totalPay)}</span>
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
                      <span>Last Paid</span>
                      <span>
                        {employee.lastPaid
                          ? `${new Date(employee.lastPaid.date + 'T00:00:00').toLocaleDateString(locale === 'en' ? 'en-US' : 'ko-KR')} / $${formatCurrency(employee.lastPaid.amount)}`
                          : '—'}
                      </span>
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
                  Total: ${formatCurrency(displayTotalPay)}
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
                        Last Paid
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredEmployeeData.map((employee) => (
                      <React.Fragment key={employee.email}>
                        <tr 
                          className={`cursor-pointer ${isPaymentOverdue(employee) ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}`}
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
                              {!employee.is_active && (
                                <span className="ml-2 text-xs font-normal text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">Inactive</span>
                              )}
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
                          <td className={`px-4 py-3 whitespace-nowrap text-sm font-medium ${isPaymentOverdue(employee) ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrencyWithStyle(employee.totalPay)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {employee.lastPaid ? (
                              <>
                                <span className="block">{new Date(employee.lastPaid.date + 'T00:00:00').toLocaleDateString(locale === 'en' ? 'en-US' : 'ko-KR')}</span>
                                <span className="text-green-600 font-medium">${formatCurrency(employee.lastPaid.amount)}</span>
                              </>
                            ) : '—'}
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
                            <td colSpan={9} className="px-4 py-4 bg-gray-50">
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
                                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase">가이드</th>
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
                                              <td className="px-2 py-1">
                                                <select
                                                  key={`${tour.tour_id}-team-${tour.team_type}`}
                                                  className="w-full min-w-[7rem] px-1.5 py-0.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                                  value={tour.team_type === 'guide + driver' ? 'guide+driver' : (tour.team_type || '')}
                                                  onChange={(e) => {
                                                    const v = e.target.value
                                                    const current = tour.team_type === 'guide + driver' ? 'guide+driver' : (tour.team_type || '')
                                                    if (v !== current) handleTourFeeUpdate(employee.email, tour.tour_id, 'team_type', v)
                                                  }}
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  <option value="1guide">1 Guide</option>
                                                  <option value="2guide">2 Guide</option>
                                                  <option value="guide+driver">Guide & Driver</option>
                                                </select>
                                              </td>
                                              <td className="px-2 py-1 text-gray-500 text-xs">
                                                {tour.staff_names}
                                              </td>
                                              <td className="px-2 py-1">
                                                <input
                                                  key={`${tour.tour_id}-guide-${tour.guide_fee}`}
                                                  type="number"
                                                  min={0}
                                                  step={0.01}
                                                  className={`w-20 px-1.5 py-0.5 text-sm rounded focus:ring-1 focus:outline-none ${
                                                    tour.is_guide
                                                      ? 'border-2 border-blue-500 focus:ring-blue-500 focus:border-blue-500'
                                                      : 'border border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                                                  }`}
                                                  defaultValue={tour.guide_fee}
                                                  onBlur={(e) => {
                                                    const v = parseFloat(e.target.value)
                                                    if (!Number.isNaN(v) && v !== tour.guide_fee) handleTourFeeUpdate(employee.email, tour.tour_id, 'guide_fee', v)
                                                  }}
                                                  onClick={(e) => e.stopPropagation()}
                                                />
                                              </td>
                                              <td className="px-2 py-1">
                                                <input
                                                  key={`${tour.tour_id}-asst-${tour.assistant_fee}`}
                                                  type="number"
                                                  min={0}
                                                  step={0.01}
                                                  className={`w-20 px-1.5 py-0.5 text-sm rounded focus:ring-1 focus:outline-none ${
                                                    tour.is_assistant
                                                      ? 'border-2 border-emerald-500 focus:ring-emerald-500 focus:border-emerald-500'
                                                      : 'border border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                                                  }`}
                                                  defaultValue={tour.assistant_fee}
                                                  onBlur={(e) => {
                                                    const v = parseFloat(e.target.value)
                                                    if (!Number.isNaN(v) && v !== tour.assistant_fee) handleTourFeeUpdate(employee.email, tour.tour_id, 'assistant_fee', v)
                                                  }}
                                                  onClick={(e) => e.stopPropagation()}
                                                />
                                              </td>
                                              <td className="px-2 py-1">
                                                {(tour.is_guide || tour.is_assistant) ? (
                                                  <input
                                                    key={`${tour.tour_id}-tip-${tour.prepaid_tip}`}
                                                    type="number"
                                                    min={0}
                                                    step={0.01}
                                                    className="w-20 px-1.5 py-0.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                    defaultValue={(Number(tour.prepaid_tip) || 0).toFixed(2)}
                                                    onBlur={(e) => {
                                                      const v = parseFloat(e.target.value)
                                                      if (!Number.isNaN(v) && v !== tour.prepaid_tip) handleTourFeeUpdate(employee.email, tour.tour_id, 'prepaid_tip', v)
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                  />
                                                ) : (
                                                  <span className="text-gray-900">{formatCurrencyWithStyle(tour.prepaid_tip)}</span>
                                                )}
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
                        ${formatCurrency(displayTotalAttendancePay)}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-purple-600">
                        ${formatCurrency(displayTotalGuideFee)}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-green-600">
                        ${formatCurrency(displayTotalAssistantFee)}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-yellow-600">
                        ${formatCurrency(displayTotalPrepaidTip)}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-600">
                        {filteredEmployeeData.reduce((sum, emp) => sum + emp.tourFees.length, 0)}회
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-orange-600">
                        ${formatCurrency(displayTotalPay)}
                      </td>
                      <td className="px-4 py-3"></td>
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
