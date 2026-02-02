'use client'

import React, { useState, useEffect, useRef } from 'react'
import { X, Calculator, Clock, DollarSign, Calendar, User, Printer, CreditCard } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import html2pdf from 'html2pdf.js'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

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
  team_type: string
  tour_guide_id: string | null
  assistant_id: string | null
  guide_fee: number
  driver_fee: number
  prepaid_tips: number
  personal_car: number
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
  const [personalCarPay, setPersonalCarPay] = useState<number>(0)
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<string>('')
  const [teamMembers, setTeamMembers] = useState<Array<{email: string, name_ko: string, position: string}>>([])
  const [tourFees, setTourFees] = useState<TourFee[]>([])
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [paymentData, setPaymentData] = useState<{
    paid_to: string
    paid_for: string
    description: string
    amount: number
    payment_method: string
    photo_url: string
  } | null>(null)
  const printContentRef = useRef<HTMLDivElement>(null)

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
  const calculateTotalPay = (attendanceSalary: number, tourSalary: number, tipSalary: number, personalCarSalary: number) => {
    return attendanceSalary + tourSalary + tipSalary + personalCarSalary
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
        .maybeSingle()

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
          reservation_ids,
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

      // 각 투어의 prepaid tips 계산
      const fees = await Promise.all(
        (data || []).map(async (tour) => {
          // 선택된 직원이 가이드인지 어시스턴트인지 확인
          const isGuide = tour.tour_guide_id === selectedEmployee
          const isAssistant = tour.assistant_id === selectedEmployee
          
          // prepaid tips 계산
          let prepaidTips = 0
          
          // 먼저 tour_tip_shares 테이블에서 확인
          try {
            const { data: tipShareData, error: tipShareError } = await supabase
              .from('tour_tip_shares')
              .select('total_tip, guide_amount, assistant_amount')
              .eq('tour_id', tour.id)
              .single()

            if (!tipShareError && tipShareData) {
              // tour_tip_shares에 값이 있으면 그것을 사용
              if (isGuide) {
                prepaidTips = tipShareData.guide_amount || 0
              } else if (isAssistant) {
                prepaidTips = tipShareData.assistant_amount || 0
              }
            } else if (tour.reservation_ids && tour.reservation_ids.length > 0) {
              // tour_tip_shares에 값이 없으면 reservation_pricing에서 계산
              const { data: pricingData, error: pricingError } = await supabase
                .from('reservation_pricing')
                .select('prepayment_tip')
                .in('reservation_id', tour.reservation_ids)

              if (!pricingError && pricingData) {
                const totalTip = pricingData.reduce((sum, pricing) => sum + (pricing.prepayment_tip || 0), 0)
                
                // 팀 타입에 따른 팁 분배
                if (tour.team_type === '1guide' && isGuide) {
                  prepaidTips = totalTip
                } else if (tour.team_type === '2guide' && (isGuide || isAssistant)) {
                  prepaidTips = totalTip / 2
                } else if ((tour.team_type === 'guide+driver' || tour.team_type === 'guide + driver') && isGuide) {
                  prepaidTips = totalTip
                }
              }
            }
          } catch (err) {
            console.error('Prepaid tips 계산 오류:', err)
          }
          
          // Personal Car 금액 계산 (paid_for가 "Rent (Personal Vehicle)"인 tour_expenses 합산)
          let personalCarAmount = 0
          try {
            const { data: expensesData, error: expensesError } = await supabase
              .from('tour_expenses')
              .select('amount')
              .eq('tour_id', tour.id)
              .eq('paid_for', 'Rent (Personal Vehicle)')

            if (!expensesError && expensesData) {
              personalCarAmount = expensesData.reduce((sum, expense) => sum + (expense.amount || 0), 0)
            }
          } catch (err) {
            console.error('Personal Car 금액 계산 오류:', err)
          }
          
          return {
            id: tour.id,
            tour_id: tour.id,
            tour_name: (tour.products as any)?.name_ko || '투어명 없음',
            date: tour.tour_date,
            team_type: tour.team_type || '',
            tour_guide_id: tour.tour_guide_id,
            assistant_id: tour.assistant_id,
            guide_fee: tour.guide_fee || 0,
            driver_fee: tour.assistant_fee || 0,
            prepaid_tips: prepaidTips,
            personal_car: personalCarAmount,
            total_fee: (isGuide ? (tour.guide_fee || 0) : (tour.assistant_fee || 0)) + prepaidTips + personalCarAmount
          }
        })
      )

      setTourFees(fees)
      
      // 투어 급여 계산 (personal_car, prepaid_tips 제외, guide_fee/driver_fee만 포함)
      const tourSalary = fees.reduce((sum, tour) => {
        const isGuide = tour.tour_guide_id === selectedEmployee
        const isAssistant = tour.assistant_id === selectedEmployee
        let fee = 0
        if (isGuide) {
          fee = tour.guide_fee
        } else if (isAssistant) {
          fee = tour.driver_fee
        }
        return sum + fee
      }, 0)
      setTourPay(tourSalary)
      
      // Personal Car 소계 계산
      const personalCarTotal = fees.reduce((sum, tour) => sum + (tour.personal_car || 0), 0)
      setPersonalCarPay(personalCarTotal)
      
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

  // attendancePay, tourPay, tipPay, personalCarPay가 변경될 때마다 총 급여 계산
  useEffect(() => {
    const total = calculateTotalPay(attendancePay, tourPay, tipPay, personalCarPay)
    setTotalPay(total)
  }, [attendancePay, tourPay, tipPay, personalCarPay])

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

  // 투어 필드 업데이트 핸들러
  const handleTourFieldUpdate = async (tourId: string, field: 'team_type' | 'guide_fee' | 'driver_fee' | 'prepaid_tips' | 'personal_car', value: string | number) => {
    try {
      // 로컬 state 먼저 업데이트
      setTourFees(prevFees => {
        const updatedFees = prevFees.map(tour => {
          if (tour.tour_id === tourId) {
            const updated = { ...tour }
            if (field === 'team_type') {
              updated.team_type = value as string
            } else if (field === 'guide_fee') {
              updated.guide_fee = value as number
              // 선택된 직원이 가이드인 경우 total_fee도 업데이트 (prepaid_tips, personal_car 포함)
              if (tour.tour_guide_id === selectedEmployee) {
                updated.total_fee = value as number + (updated.prepaid_tips || 0) + (updated.personal_car || 0)
              }
            } else if (field === 'driver_fee') {
              updated.driver_fee = value as number
              // 선택된 직원이 어시스턴트인 경우 total_fee도 업데이트 (prepaid_tips, personal_car 포함)
              if (tour.assistant_id === selectedEmployee) {
                updated.total_fee = value as number + (updated.prepaid_tips || 0) + (updated.personal_car || 0)
              }
            } else if (field === 'prepaid_tips') {
              updated.prepaid_tips = value as number
              // prepaid_tips 업데이트 시 total_fee도 재계산 (personal_car 포함)
              const isGuide = tour.tour_guide_id === selectedEmployee
              const isAssistant = tour.assistant_id === selectedEmployee
              if (isGuide) {
                updated.total_fee = (updated.guide_fee || 0) + value as number + (updated.personal_car || 0)
              } else if (isAssistant) {
                updated.total_fee = (updated.driver_fee || 0) + value as number + (updated.personal_car || 0)
              }
            } else if (field === 'personal_car') {
              updated.personal_car = value as number
              // personal_car 업데이트 시 total_fee도 재계산
              const isGuide = tour.tour_guide_id === selectedEmployee
              const isAssistant = tour.assistant_id === selectedEmployee
              if (isGuide) {
                updated.total_fee = (updated.guide_fee || 0) + (updated.prepaid_tips || 0) + value as number
              } else if (isAssistant) {
                updated.total_fee = (updated.driver_fee || 0) + (updated.prepaid_tips || 0) + value as number
              }
            }
            return updated
          }
          return tour
        })
        
        // 투어 급여 재계산 (guide_fee/driver_fee만 포함, prepaid_tips, personal_car 제외)
        const tourSalary = updatedFees.reduce((sum, tour) => {
          const isGuide = tour.tour_guide_id === selectedEmployee
          const isAssistant = tour.assistant_id === selectedEmployee
          let fee = 0
          if (isGuide) {
            fee = tour.guide_fee
          } else if (isAssistant) {
            fee = tour.driver_fee
          }
          return sum + fee
        }, 0)
        setTourPay(tourSalary)
        
        // Personal Car 소계 재계산
        const personalCarTotal = updatedFees.reduce((sum, tour) => sum + (tour.personal_car || 0), 0)
        setPersonalCarPay(personalCarTotal)
        
        return updatedFees
      })

      // Supabase에 업데이트
      const updateData: any = {}
      if (field === 'team_type') {
        updateData.team_type = value
      } else if (field === 'guide_fee') {
        updateData.guide_fee = value
      } else if (field === 'driver_fee') {
        updateData.assistant_fee = value
      } else if (field === 'prepaid_tips') {
        // prepaid_tips는 tour_tip_shares 테이블의 total_tip을 업데이트
        // 먼저 기존 tip_share가 있는지 확인
        const { data: existingTipShare, error: tipShareError } = await supabase
          .from('tour_tip_shares')
          .select('id, total_tip, guide_amount, assistant_amount')
          .eq('tour_id', tourId)
          .single()

        if (tipShareError && tipShareError.code !== 'PGRST116') {
          console.error('팁 쉐어 조회 오류:', tipShareError)
          fetchTourFees()
          return
        }

        const newTotalTip = value as number
        const oldTotalTip = existingTipShare?.total_tip || 0

        if (existingTipShare) {
          // 기존 tip_share가 있으면 total_tip과 비율에 따라 guide_amount, assistant_amount 업데이트
          const guidePercent = oldTotalTip > 0 ? (existingTipShare.guide_amount || 0) / oldTotalTip : 0
          const assistantPercent = oldTotalTip > 0 ? (existingTipShare.assistant_amount || 0) / oldTotalTip : 0

          const { error: updateError } = await supabase
            .from('tour_tip_shares')
            .update({
              total_tip: newTotalTip,
              guide_amount: newTotalTip * guidePercent,
              assistant_amount: newTotalTip * assistantPercent
            })
            .eq('tour_id', tourId)

          if (updateError) {
            console.error('팁 쉐어 업데이트 오류:', updateError)
            fetchTourFees()
            return
          }
        } else {
          // 기존 tip_share가 없으면 새로 생성
          const tour = tourFees.find(t => t.tour_id === tourId)
          if (tour) {
            // 팀 타입에 따라 기본 분배
            let guideAmount = 0
            let assistantAmount = 0

            if (tour.team_type === '1guide' && tour.tour_guide_id === selectedEmployee) {
              guideAmount = newTotalTip
            } else if (tour.team_type === '2guide' && (tour.tour_guide_id === selectedEmployee || tour.assistant_id === selectedEmployee)) {
              guideAmount = tour.tour_guide_id === selectedEmployee ? newTotalTip / 2 : 0
              assistantAmount = tour.assistant_id === selectedEmployee ? newTotalTip / 2 : 0
            } else if ((tour.team_type === 'guide+driver' || tour.team_type === 'guide + driver') && tour.tour_guide_id === selectedEmployee) {
              guideAmount = newTotalTip
            }

            const { error: insertError } = await supabase
              .from('tour_tip_shares')
              .insert({
                tour_id: tourId,
                guide_email: tour.tour_guide_id,
                assistant_email: tour.assistant_id,
                total_tip: newTotalTip,
                guide_amount: guideAmount,
                assistant_amount: assistantAmount,
                guide_percent: newTotalTip > 0 ? (guideAmount / newTotalTip) * 100 : 0,
                assistant_percent: newTotalTip > 0 ? (assistantAmount / newTotalTip) * 100 : 0
              })

            if (insertError) {
              console.error('팁 쉐어 생성 오류:', insertError)
              fetchTourFees()
              return
            }
          }
        }
        return // prepaid_tips는 별도로 처리하므로 여기서 종료
      }

      // tours 테이블 업데이트
      const { error } = await supabase
        .from('tours')
        .update(updateData)
        .eq('id', tourId)

      if (error) {
        console.error('투어 업데이트 오류:', error)
        // 에러 발생 시 원래 값으로 복구
        fetchTourFees()
      }
    } catch (error) {
      console.error('투어 필드 업데이트 오류:', error)
      // 에러 발생 시 원래 값으로 복구
      fetchTourFees()
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
    setPersonalCarPay(0)
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
      // 직원 포지션 확인
      const selectedMember = teamMembers.find(m => m.email === selectedEmployee)
      const position = selectedMember?.position?.toLowerCase() || ''
      const isGuideOrDriver = position === '가이드' || 
                              position === 'guide' || 
                              position === 'tour guide' ||
                              position === '드라이버' || 
                              position === 'driver'
      
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
              ${!isGuideOrDriver ? `
              <div class="info-row">
                <span class="info-label">시급:</span>
                <span class="info-value">$${hourlyRate || '0'}</span>
              </div>
              ` : ''}
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
                  <span>가이드 Fee 소계:</span>
                  <span>$${formatCurrency(tourPay)}</span>
                </div>
                <div class="calculation-item">
                  <span>Tips 쉐어 소계:</span>
                  <span>$${formatCurrency(tipPay)}</span>
                </div>
                <div class="calculation-item">
                  <span>Personal Car 소계:</span>
                  <span>$${formatCurrency(personalCarPay)}</span>
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
                  <th>Prepaid Tips</th>
                  <th>Personal Car</th>
                  <th>총 Fee</th>
                </tr>
              </thead>
              <tbody>
                ${tourFees.map(tour => {
                  const isGuide = tour.tour_guide_id === selectedEmployee
                  const isAssistant = tour.assistant_id === selectedEmployee
                  let guideFeeDisplay = 0
                  if (isGuide) {
                    guideFeeDisplay = tour.guide_fee
                  } else if (isAssistant) {
                    guideFeeDisplay = tour.driver_fee
                  }
                  return `
                  <tr>
                    <td>${formatDate(tour.date)}</td>
                    <td>${tour.tour_name}</td>
                    <td>${tour.team_type}</td>
                    <td>$${formatCurrency(guideFeeDisplay)}</td>
                    <td>$${formatCurrency(tour.prepaid_tips || 0)}</td>
                    <td>$${formatCurrency(tour.personal_car || 0)}</td>
                    <td>$${formatCurrency(tour.total_fee)}</td>
                  </tr>
                `
                }).join('')}
                <tr style="font-weight: bold; background: #f3f4f6;">
                  <td colspan="6">총합</td>
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

  // 날짜를 MM/DD/YYYY 형식으로 변환 (라스베가스 시간 기준)
  const formatDateForDescription = (dateString: string) => {
    // YYYY-MM-DD 형식의 문자열을 라스베가스 시간으로 변환
    const date = new Date(dateString + 'T00:00:00')
    const lasVegasDate = new Date(date.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}))
    const month = String(lasVegasDate.getMonth() + 1).padStart(2, '0')
    const day = String(lasVegasDate.getDate()).padStart(2, '0')
    const year = lasVegasDate.getFullYear()
    return `${month}/${day}/${year}`
  }

  // 현재 라스베가스 시간을 MM/DD/YYYY 형식으로 반환
  const getLasVegasDateString = () => {
    const now = new Date()
    const lasVegasDate = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}))
    const month = String(lasVegasDate.getMonth() + 1).padStart(2, '0')
    const day = String(lasVegasDate.getDate()).padStart(2, '0')
    const year = lasVegasDate.getFullYear()
    return `${month}/${day}/${year}`
  }

  // PDF 생성 및 업로드
  const generateAndUploadPDF = async (): Promise<string | null> => {
    if (!selectedEmployee || !startDate || !endDate) {
      alert('직원과 날짜를 선택해주세요.')
      return null
    }

    try {
      setIsGeneratingPDF(true)

      // 프린트용 HTML 생성 (handlePrint 함수의 내용 재사용)
      const selectedMember = teamMembers.find(m => m.email === selectedEmployee)
      const employeeName = selectedMember?.name_ko || ''
      const employeePosition = selectedMember?.position?.toLowerCase() || ''
      const isGuideOrDriver = employeePosition === '가이드' || 
                              employeePosition === 'guide' || 
                              employeePosition === 'tour guide' ||
                              employeePosition === '드라이버' || 
                              employeePosition === 'driver'
      
      // Personal Car 소계 계산
      const personalCarTotal = tourFees.reduce((sum, tour) => sum + (tour.personal_car || 0), 0)

      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>2주급 계산기</title>
          <style>
            * {
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              margin: 0;
              padding: 20mm 15mm;
              color: #333;
              width: 100%;
              max-width: 210mm;
              margin: 0 auto;
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
              margin-bottom: 30px;
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
              table-layout: fixed;
            }
            .table th,
            .table td {
              border: 1px solid #d1d5db;
              padding: 6px 8px;
              text-align: left;
              word-wrap: break-word;
            }
            .table th {
              background: #f9fafb;
              font-weight: 600;
              font-size: 10px;
            }
            .table td {
              font-size: 11px;
            }
            .table tbody tr:nth-child(even) {
              background: #f9fafb;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>2주급 계산기</h1>
            <p>${employeeName} | ${startDate} ~ ${endDate}</p>
          </div>
          
          <div class="content">
            <div class="left-section">
              <div class="section-title">직원 정보</div>
              <div class="info-row">
                <span class="info-label">직원:</span>
                <span class="info-value">${employeeName}</span>
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
                  <span>가이드 Fee 소계:</span>
                  <span>$${formatCurrency(tourPay)}</span>
                </div>
                <div class="calculation-item">
                  <span>Tips 쉐어 소계:</span>
                  <span>$${formatCurrency(tipPay)}</span>
                </div>
                <div class="calculation-item">
                  <span>Personal Car 소계:</span>
                  <span>$${formatCurrency(personalCarTotal)}</span>
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
                  <th>Prepaid Tips</th>
                  <th>Personal Car</th>
                  <th>총 Fee</th>
                </tr>
              </thead>
              <tbody>
                ${tourFees.map(tour => {
                  const isGuide = tour.tour_guide_id === selectedEmployee
                  const isAssistant = tour.assistant_id === selectedEmployee
                  let guideFeeDisplay = 0
                  if (isGuide) {
                    guideFeeDisplay = tour.guide_fee
                  } else if (isAssistant) {
                    guideFeeDisplay = tour.driver_fee
                  }
                  return `
                  <tr>
                    <td>${formatDate(tour.date)}</td>
                    <td>${tour.tour_name}</td>
                    <td>${tour.team_type}</td>
                    <td>$${formatCurrency(guideFeeDisplay)}</td>
                    <td>$${formatCurrency(tour.prepaid_tips || 0)}</td>
                    <td>$${formatCurrency(tour.personal_car || 0)}</td>
                    <td>$${formatCurrency(tour.total_fee)}</td>
                  </tr>
                `
                }).join('')}
                <tr style="font-weight: bold; background: #f3f4f6;">
                  <td colspan="6">총합</td>
                  <td>$${formatCurrency(tourFees.reduce((sum, tour) => sum + tour.total_fee, 0))}</td>
                </tr>
              </tbody>
            </table>
          ` : ''}
        </body>
        </html>
      `

      // 새 창을 열어서 HTML 렌더링 후 PDF 생성
      const printWindow = window.open('', '_blank', 'width=800,height=600')
      if (!printWindow) {
        throw new Error('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.')
      }

      printWindow.document.write(printContent)
      printWindow.document.close()

      // 콘텐츠가 완전히 로드될 때까지 대기
      await new Promise<void>((resolve) => {
        const checkReady = () => {
          if (printWindow.document.readyState === 'complete') {
            // 이미지와 스타일이 로드될 시간 확보
            setTimeout(() => {
              resolve()
            }, 1000)
          } else {
            printWindow.addEventListener('load', () => {
              setTimeout(() => {
                resolve()
              }, 1000)
            })
          }
        }
        checkReady()
      })

      // html2canvas로 캔버스 생성 (새 창의 body 사용)
      const canvas = await html2canvas(printWindow.document.body, {
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: false,
        backgroundColor: '#ffffff',
        width: printWindow.document.documentElement.scrollWidth,
        height: printWindow.document.documentElement.scrollHeight,
        x: 0,
        y: 0
      })

      // jsPDF로 PDF 생성
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      const imgWidth = 210 // A4 너비 (mm)
      const pageHeight = 297 // A4 높이 (mm)
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight
      let position = 0

      // 첫 페이지 추가
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      // 여러 페이지가 필요한 경우
      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      // PDF를 Blob으로 변환
      const pdfBlob = pdf.output('blob')
      
      // 창 닫기
      printWindow.close()

      // Supabase Storage에 업로드
      const fileName = `payroll/${selectedEmployee}/${Date.now()}_payroll_${startDate}_${endDate}.pdf`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('company-expense-files')
        .upload(fileName, pdfBlob, {
          contentType: 'application/pdf',
          upsert: false
        })

      if (uploadError) {
        console.error('PDF 업로드 오류:', uploadError)
        throw uploadError
      }

      // 공개 URL 생성
      const { data: urlData } = supabase.storage
        .from('company-expense-files')
        .getPublicUrl(fileName)

      return urlData.publicUrl
    } catch (error) {
      console.error('PDF 생성 및 업로드 오류:', error)
      alert('PDF 생성 중 오류가 발생했습니다.')
      return null
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  // 기존 PDF 찾기
  const findExistingPDF = async (): Promise<string | null> => {
    if (!selectedEmployee || !startDate || !endDate) {
      return null
    }

    try {
      const selectedMember = teamMembers.find(m => m.email === selectedEmployee)
      const guideName = selectedMember?.name_ko || ''
      
      if (!guideName) {
        return null
      }

      // 날짜 포맷팅 (라스베가스 시간 기준)
      const startDateFormatted = formatDateForDescription(startDate)
      const endDateFormatted = formatDateForDescription(endDate)
      
      // description 패턴: "MM/DD/YYYY ~ MM/DD/YYYY Paid on ..."
      const descriptionPattern = `${startDateFormatted} ~ ${endDateFormatted}`
      
      // company_expenses 테이블에서 해당 기간의 기록 찾기
      const { data: existingExpenses, error } = await supabase
        .from('company_expenses')
        .select('photo_url, description')
        .eq('paid_to', guideName)
        .eq('paid_for', 'Guide Fee')
        .ilike('description', `%${descriptionPattern}%`)
        .not('photo_url', 'is', null)
        .order('submit_on', { ascending: false })
        .limit(1)

      if (error) {
        console.error('기존 PDF 찾기 오류:', error)
        return null
      }

      if (existingExpenses && existingExpenses.length > 0 && existingExpenses[0].photo_url) {
        // PDF URL이 유효한지 확인
        const photoUrl = existingExpenses[0].photo_url
        if (photoUrl && photoUrl.trim() !== '') {
          return photoUrl
        }
      }

      return null
    } catch (error) {
      console.error('기존 PDF 찾기 오류:', error)
      return null
    }
  }

  // 지불 처리
  const handlePayment = async () => {
    if (!selectedEmployee || totalPay === 0) {
      alert('지불할 금액이 없습니다.')
      return
    }

    try {
      // 먼저 기존 PDF가 있는지 확인
      let pdfUrl = await findExistingPDF()
      let isExistingPDF = false
      
      if (!pdfUrl) {
        // 기존 PDF가 없으면 새로 생성
        setIsGeneratingPDF(true)
        pdfUrl = await generateAndUploadPDF()
        if (!pdfUrl) {
          return
        }
      } else {
        // 기존 PDF가 있으면 사용
        isExistingPDF = true
        console.log('기존 PDF를 사용합니다:', pdfUrl)
      }

      // 가이드 이름 가져오기
      const selectedMember = teamMembers.find(m => m.email === selectedEmployee)
      const guideName = selectedMember?.name_ko || ''

      // 날짜 포맷팅 (라스베가스 시간 기준)
      const startDateFormatted = formatDateForDescription(startDate)
      const endDateFormatted = formatDateForDescription(endDate)
      const paidOnDate = getLasVegasDateString()
      const description = `${startDateFormatted} ~ ${endDateFormatted} Paid on ${paidOnDate}`

      setPaymentData({
        paid_to: guideName,
        paid_for: 'Guide Fee',
        description: description,
        amount: totalPay,
        payment_method: 'zelle',
        photo_url: pdfUrl
      })

      // 기존 PDF 사용 시 알림
      if (isExistingPDF) {
        // 알림은 표시하지 않고 바로 모달 열기 (사용자가 확인할 수 있음)
      }

      // 회사 지출 추가 모달 열기
      setShowPaymentModal(true)
      
    } catch (error) {
      console.error('지불 처리 오류:', error)
      alert('지불 처리 중 오류가 발생했습니다.')
    }
  }

  // 회사 지출 저장
  const handleSaveCompanyExpense = async () => {
    if (!paymentData) return

    try {
      const { error } = await supabase
        .from('company_expenses')
        .insert({
          paid_to: paymentData.paid_to,
          paid_for: paymentData.paid_for,
          description: paymentData.description,
          amount: paymentData.amount,
          payment_method: paymentData.payment_method,
          photo_url: paymentData.photo_url,
          submit_by: selectedEmployee,
          category: 'payroll',
          status: 'pending'
        })

      if (error) {
        console.error('회사 지출 추가 오류:', error)
        alert('회사 지출 추가 중 오류가 발생했습니다.')
        return
      }

      alert('회사 지출이 성공적으로 추가되었습니다.')
      setShowPaymentModal(false)
      setPaymentData(null)
    } catch (error) {
      console.error('회사 지출 저장 오류:', error)
      alert('회사 지출 저장 중 오류가 발생했습니다.')
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full mx-4 max-h-[90vh] overflow-y-auto">
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
                        가이드 Fee 소계:
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
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600">
                        <DollarSign className="w-3 h-3 inline mr-1" />
                        Personal Car 소계:
                      </span>
                      <span className="text-sm font-bold text-orange-600">
                        ${formatCurrency(personalCarPay)}
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
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                          {getDateFromCheckInTime(record.check_in_time)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                          {formatTime(record.check_in_time)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                          {formatTime(record.check_out_time)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                          {record.work_hours ? formatWorkHours(record.work_hours) : '-'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
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
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider align-middle">
                        투어 날짜
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider align-middle">
                        투어명
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider align-middle">
                        팀 타입
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider align-middle">
                        가이드 Fee
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider align-middle">
                        드라이버 Fee
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider align-middle">
                        Prepaid Tips
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider align-middle">
                        Personal Car
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider align-middle">
                        총 Fee
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {tourFees.map((tour) => (
                      <tr key={tour.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900 align-middle">
                          {formatDate(tour.date)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900 align-middle">
                          <Link 
                            href={`/${locale}/admin/tours/${tour.tour_id}`}
                            className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-xs"
                          >
                            {tour.tour_name}
                          </Link>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900 align-middle">
                          <select
                            value={tour.team_type || ''}
                            onChange={(e) => handleTourFieldUpdate(tour.tour_id, 'team_type', e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="1guide">1guide</option>
                            <option value="2guide">2guide</option>
                            <option value="guide+driver">guide+driver</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900 align-middle">
                          <input
                            type="number"
                            step="0.01"
                            value={tour.guide_fee || 0}
                            onChange={(e) => handleTourFieldUpdate(tour.tour_id, 'guide_fee', parseFloat(e.target.value) || 0)}
                            className={`w-full px-2 py-1 text-xs border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                              tour.tour_guide_id === selectedEmployee 
                                ? 'border-blue-500 bg-blue-50' 
                                : 'border-gray-300'
                            }`}
                          />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900 align-middle">
                          <input
                            type="number"
                            step="0.01"
                            value={tour.driver_fee || 0}
                            onChange={(e) => handleTourFieldUpdate(tour.tour_id, 'driver_fee', parseFloat(e.target.value) || 0)}
                            className={`w-full px-2 py-1 text-xs border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                              tour.assistant_id === selectedEmployee 
                                ? 'border-green-500 bg-green-50' 
                                : 'border-gray-300'
                            }`}
                          />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900 align-middle">
                          <input
                            type="number"
                            step="0.01"
                            value={tour.prepaid_tips || 0}
                            onChange={(e) => handleTourFieldUpdate(tour.tour_id, 'prepaid_tips', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900 align-middle">
                          <input
                            type="number"
                            step="0.01"
                            value={tour.personal_car || 0}
                            onChange={(e) => handleTourFieldUpdate(tour.tour_id, 'personal_car', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-green-600 align-middle">
                          ${formatCurrency(tour.total_fee)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={7} className="px-3 py-2 text-right text-xs font-medium text-gray-900 align-middle">
                        총합:
                      </td>
                      <td className="px-3 py-2 text-xs font-bold text-green-600 align-middle">
                        ${formatCurrency(tourFees.reduce((sum, tour) => sum + tour.total_fee, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              
              {/* 소계 표시 */}
              <div className="mt-4 bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-xs font-medium text-gray-600 mb-1">가이드 Fee 소계</div>
                    <div className="text-sm font-bold text-purple-600">
                      ${formatCurrency(tourFees.reduce((sum, tour) => {
                        const isGuide = tour.tour_guide_id === selectedEmployee
                        const isAssistant = tour.assistant_id === selectedEmployee
                        let fee = 0
                        if (isGuide) {
                          fee = tour.guide_fee
                        } else if (isAssistant) {
                          fee = tour.driver_fee
                        }
                        return sum + fee
                      }, 0))}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-medium text-gray-600 mb-1">Prepaid Tips 소계</div>
                    <div className="text-sm font-bold text-pink-600">
                      ${formatCurrency(tourFees.reduce((sum, tour) => sum + (tour.prepaid_tips || 0), 0))}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-medium text-gray-600 mb-1">Personal Car 소계</div>
                    <div className="text-sm font-bold text-orange-600">
                      ${formatCurrency(tourFees.reduce((sum, tour) => sum + (tour.personal_car || 0), 0))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 지불 버튼: 직원 선택 시 모든 직군(가이드/드라이버/OP/매니저)에 표시 */}
          {selectedEmployee && (
            <div className="mt-6 flex justify-end">
              <button
                onClick={handlePayment}
                disabled={isGeneratingPDF || totalPay === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
              >
                <CreditCard className="w-4 h-4" />
                {isGeneratingPDF ? 'PDF 생성 중...' : '지불'}
              </button>
            </div>
          )}

        </div>

      </div>
    </div>

    {/* 회사 지출 추가 모달 */}
    {showPaymentModal && paymentData && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">회사 지출 추가</h2>
            <button
              onClick={() => {
                setShowPaymentModal(false)
                setPaymentData(null)
              }}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Paid To *
                </label>
                <input
                  type="text"
                  value={paymentData.paid_to}
                  onChange={(e) => setPaymentData({ ...paymentData, paid_to: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Paid For *
                </label>
                <input
                  type="text"
                  value={paymentData.paid_for}
                  onChange={(e) => setPaymentData({ ...paymentData, paid_for: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={paymentData.description}
                onChange={(e) => setPaymentData({ ...paymentData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Method *
                </label>
                <select
                  value={paymentData.payment_method}
                  onChange={(e) => setPaymentData({ ...paymentData, payment_method: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="zelle">Zelle</option>
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="venmo">Venmo</option>
                  <option value="paypal">PayPal</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Photo URL (PDF)
              </label>
              <input
                type="text"
                value={paymentData.photo_url}
                onChange={(e) => setPaymentData({ ...paymentData, photo_url: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                readOnly
              />
              {paymentData.photo_url && (
                <a
                  href={paymentData.photo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  PDF 보기
                </a>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => {
                  setShowPaymentModal(false)
                  setPaymentData(null)
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSaveCompanyExpense}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    </>
  )
}
