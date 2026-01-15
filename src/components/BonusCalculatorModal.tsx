'use client'

import React, { useState, useEffect } from 'react'
import { X, Calculator, Calendar, User, DollarSign, Users, Link as LinkIcon, Save, CreditCard, Star, Eye } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'

interface BonusCalculatorModalProps {
  isOpen: boolean
  onClose: () => void
  locale?: string
}

interface TourBonus {
  id: string
  tour_id: string
  tour_date: string
  tour_name: string
  guide_email: string | null
  guide_name: string | null
  driver_email: string | null
  driver_name: string | null
  non_resident_count: number
  additional_cost: number
  guide_bonus: number
  driver_bonus: number
  review_bonus_points: number // 후기 기반 보너스 포인트
  reviews: Array<{
    reservation_id: string
    customer_name: string
    rating: number
    platform: string
  }>
}

export default function BonusCalculatorModal({ isOpen, onClose, locale = 'ko' }: BonusCalculatorModalProps) {
  const { authUser } = useAuth()
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [selectedEmployee, setSelectedEmployee] = useState<string>('')
  const [teamMembers, setTeamMembers] = useState<Array<{email: string, name_ko: string, position: string}>>([])
  const [tourBonuses, setTourBonuses] = useState<TourBonus[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [paying, setPaying] = useState(false)
  const [totalAdditionalCost, setTotalAdditionalCost] = useState<number>(0)
  const [totalGuideBonus, setTotalGuideBonus] = useState<number>(0)
  const [totalDriverBonus, setTotalDriverBonus] = useState<number>(0)
  const [totalReviewBonusPoints, setTotalReviewBonusPoints] = useState<number>(0)
  const [selectedTourForReview, setSelectedTourForReview] = useState<TourBonus | null>(null)

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

  // 이번 기간 설정 함수
  const setCurrentPeriod = () => {
    const today = new Date()
    const day = today.getDate()
    
    let startDate, endDate
    
    if (day >= 1 && day <= 15) {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1)
      endDate = new Date(today.getFullYear(), today.getMonth(), 15)
    } else {
      startDate = new Date(today.getFullYear(), today.getMonth(), 16)
      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0)
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
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 16)
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
      startDate = lastMonth
      endDate = lastMonthEnd
    } else {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1)
      endDate = new Date(today.getFullYear(), today.getMonth(), 15)
    }
    
    setStartDate(startDate.toISOString().split('T')[0])
    setEndDate(endDate.toISOString().split('T')[0])
  }

  // 팀 멤버 목록 조회 (가이드와 드라이버만)
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

      // 가이드와 드라이버만 필터링
      const filteredMembers = (data || []).filter(member => {
        const position = member.position?.toLowerCase()
        return position === '가이드' || 
               position === 'guide' ||
               position === 'tour guide' ||
               position === '드라이버' || 
               position === 'driver' ||
               position === '전용 운전기사'
      })

      setTeamMembers(filteredMembers)
      if (filteredMembers.length > 0) {
        setSelectedEmployee(filteredMembers[0].email)
      }

      // 기본 날짜 설정
      const defaultDates = getDefaultDates()
      setStartDate(defaultDates.start)
      setEndDate(defaultDates.end)
    } catch (error) {
      console.error('팀 멤버 조회 오류:', error)
    }
  }

  // 저장된 보너스 값 불러오기
  const loadSavedBonuses = async (tourIds: string[]) => {
    if (tourIds.length === 0) return []
    
    try {
      const { data, error } = await supabase
        .from('tour_bonuses')
        .select('tour_id, guide_bonus, driver_bonus')
        .in('tour_id', tourIds)
      
      if (error) {
        // 테이블이 없을 수 있으므로 에러 무시
        console.log('저장된 보너스 조회 오류 (테이블이 없을 수 있음):', error)
        return []
      }
      
      return data || []
    } catch (error) {
      console.error('저장된 보너스 조회 오류:', error)
      return []
    }
  }

  // 투어 보너스 데이터 조회
  const fetchTourBonuses = async () => {
    if (!startDate || !endDate || !selectedEmployee) {
      setTourBonuses([])
      return
    }

    setLoading(true)
    try {
      // 선택된 직원이 진행한 투어 조회
      const { data: toursData, error: toursError } = await supabase
        .from('tours')
        .select(`
          id,
          tour_date,
          tour_guide_id,
          assistant_id,
          reservation_ids,
          products!inner(name_ko)
        `)
        .gte('tour_date', startDate)
        .lte('tour_date', endDate)
        .or(`tour_guide_id.eq.${selectedEmployee},assistant_id.eq.${selectedEmployee}`)
        .order('tour_date', { ascending: true })

      if (toursError) {
        console.error('투어 조회 오류:', toursError)
        setTourBonuses([])
        return
      }

      if (!toursData || toursData.length === 0) {
        setTourBonuses([])
        setTotalAdditionalCost(0)
        setTotalGuideBonus(0)
        setTotalDriverBonus(0)
        return
      }

      // 각 투어에 대한 상세 정보 조회
      const tourBonusesData = await Promise.all(
        toursData.map(async (tour) => {
          // 가이드와 드라이버 이름 조회
          let guideName = null
          let driverName = null

          if (tour.tour_guide_id) {
            const { data: guideData } = await supabase
              .from('team')
              .select('name_ko')
              .eq('email', tour.tour_guide_id)
              .single()
            guideName = guideData?.name_ko || null
          }

          if (tour.assistant_id) {
            const { data: driverData } = await supabase
              .from('team')
              .select('name_ko')
              .eq('email', tour.assistant_id)
              .single()
            driverName = driverData?.name_ko || null
          }

          // 해당 투어의 예약들 조회
          const reservationIds = tour.reservation_ids || []
          if (reservationIds.length === 0) {
            return {
              id: tour.id,
              tour_id: tour.id,
              tour_date: tour.tour_date,
              tour_name: (tour.products as any)?.name_ko || '투어명 없음',
              guide_email: tour.tour_guide_id,
              guide_name: guideName,
              driver_email: tour.assistant_id,
              driver_name: driverName,
              non_resident_count: 0,
              additional_cost: 0,
              guide_bonus: 0,
              driver_bonus: 0,
              review_bonus_points: 0,
              reviews: []
            }
          }

          // 비거주자 인원 수 계산
          const { data: reservationCustomers, error: rcError } = await supabase
            .from('reservation_customers')
            .select('reservation_id, resident_status')
            .in('reservation_id', reservationIds)
            .eq('resident_status', 'non_resident')

          const nonResidentCount = reservationCustomers?.length || 0

          // 추가비용 합계 계산
          const { data: pricingData, error: pricingError } = await supabase
            .from('reservation_pricing')
            .select('additional_cost')
            .in('reservation_id', reservationIds)

          const additionalCost = pricingData?.reduce((sum, p) => sum + (p.additional_cost || 0), 0) || 0

          // 후기 조회 및 보너스 포인트 계산
          const { data: reviewsData, error: reviewsError } = await supabase
            .from('reservation_reviews')
            .select('reservation_id, rating, platform')
            .in('reservation_id', reservationIds)

          // 별점에 따른 보너스 포인트 계산
          // 1점: -3, 2점: -2, 3점: -1, 4점: 0, 5점: +1
          const ratingToPoints = (rating: number): number => {
            switch (rating) {
              case 1: return -3
              case 2: return -2
              case 3: return -1
              case 4: return 0
              case 5: return 1
              default: return 0
            }
          }

          const reviewBonusPoints = reviewsData?.reduce((sum, review) => {
            return sum + ratingToPoints(review.rating)
          }, 0) || 0

          // 후기 상세 정보 (고객 이름 포함)
          const reviewsWithCustomer = await Promise.all(
            (reviewsData || []).map(async (review) => {
              // 예약 정보에서 고객 ID 가져오기
              const { data: reservationData } = await supabase
                .from('reservations')
                .select('customer_id')
                .eq('id', review.reservation_id)
                .single()

              let customerName = 'Unknown'
              if (reservationData?.customer_id) {
                const { data: customerData } = await supabase
                  .from('customers')
                  .select('name')
                  .eq('id', reservationData.customer_id)
                  .single()
                customerName = customerData?.name || 'Unknown'
              }

              return {
                reservation_id: review.reservation_id,
                customer_name: customerName,
                rating: review.rating,
                platform: review.platform
              }
            })
          )

          // 보너스 계산 (추가비용의 10%)
          const bonusAmount = additionalCost * 0.1
          const guideBonus = tour.tour_guide_id === selectedEmployee ? bonusAmount : 0
          const driverBonus = tour.assistant_id === selectedEmployee ? bonusAmount : 0

          return {
            id: tour.id,
            tour_id: tour.id,
            tour_date: tour.tour_date,
            tour_name: (tour.products as any)?.name_ko || '투어명 없음',
            guide_email: tour.tour_guide_id,
            guide_name: guideName,
            driver_email: tour.assistant_id,
            driver_name: driverName,
            non_resident_count: nonResidentCount,
            additional_cost: additionalCost,
            guide_bonus: guideBonus,
            driver_bonus: driverBonus,
            review_bonus_points: reviewBonusPoints,
            reviews: reviewsWithCustomer
          }
        })
      )

      // 저장된 보너스 값 불러오기
      const savedBonuses = await loadSavedBonuses(tourBonusesData.map(t => t.tour_id))
      
      // 저장된 값이 있으면 적용, 없으면 계산된 값 사용
      const finalBonuses = tourBonusesData.map(tour => {
        const saved = savedBonuses.find(s => s.tour_id === tour.tour_id)
        return {
          ...tour,
          guide_bonus: saved?.guide_bonus ?? tour.guide_bonus,
          driver_bonus: saved?.driver_bonus ?? tour.driver_bonus
        }
      })

      setTourBonuses(finalBonuses)

      // 총합 계산
      const totalCost = finalBonuses.reduce((sum, tour) => sum + tour.additional_cost, 0)
      const totalGuide = finalBonuses.reduce((sum, tour) => sum + tour.guide_bonus, 0)
      const totalDriver = finalBonuses.reduce((sum, tour) => sum + tour.driver_bonus, 0)
      const totalReviewPoints = finalBonuses.reduce((sum, tour) => sum + tour.review_bonus_points, 0)

      setTotalAdditionalCost(totalCost)
      setTotalGuideBonus(totalGuide)
      setTotalDriverBonus(totalDriver)
      setTotalReviewBonusPoints(totalReviewPoints)
    } catch (error) {
      console.error('투어 보너스 조회 오류:', error)
      setTourBonuses([])
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

  // 보너스 값 저장
  const saveBonuses = async () => {
    if (tourBonuses.length === 0) {
      alert('저장할 보너스 정보가 없습니다.')
      return
    }

    setSaving(true)
    try {
      // tour_bonuses 테이블이 있는지 확인하고 없으면 생성
      // 일단 upsert로 처리 (테이블이 없으면 에러 발생)
      const bonusesToSave = tourBonuses.map(tour => ({
        tour_id: tour.tour_id,
        guide_bonus: tour.guide_bonus,
        driver_bonus: tour.driver_bonus,
        guide_email: tour.guide_email,
        driver_email: tour.driver_email,
        additional_cost: tour.additional_cost,
        non_resident_count: tour.non_resident_count,
        updated_at: new Date().toISOString()
      }))

      // 각 투어별로 upsert
      for (const bonus of bonusesToSave) {
        const { error } = await supabase
          .from('tour_bonuses')
          .upsert({
            tour_id: bonus.tour_id,
            guide_bonus: bonus.guide_bonus,
            driver_bonus: bonus.driver_bonus,
            guide_email: bonus.guide_email,
            driver_email: bonus.driver_email,
            additional_cost: bonus.additional_cost,
            non_resident_count: bonus.non_resident_count,
            updated_at: bonus.updated_at
          }, {
            onConflict: 'tour_id'
          })
        
        if (error) {
          // 테이블이 없으면 생성 시도
          if (error.code === '42P01') {
            await createTourBonusesTable()
            // 다시 시도
            await supabase
              .from('tour_bonuses')
              .upsert(bonus, { onConflict: 'tour_id' })
          } else {
            throw error
          }
        }
      }

      alert('보너스 정보가 저장되었습니다.')
    } catch (error: any) {
      console.error('보너스 저장 오류:', error)
      // 테이블이 없으면 생성 시도
      if (error.code === '42P01') {
        try {
          await createTourBonusesTable()
          await saveBonuses() // 재시도
          return
        } catch (createError) {
          console.error('테이블 생성 오류:', createError)
          alert('보너스 저장 중 오류가 발생했습니다. 테이블 생성이 필요합니다.')
        }
      } else {
        alert('보너스 저장 중 오류가 발생했습니다.')
      }
    } finally {
      setSaving(false)
    }
  }

  // tour_bonuses 테이블 생성 (마이그레이션 파일로 처리되므로 주석 처리)
  const createTourBonusesTable = async () => {
    // 테이블은 마이그레이션 파일로 생성되므로 여기서는 에러만 처리
    console.warn('tour_bonuses 테이블이 없습니다. 마이그레이션을 실행해주세요.')
    throw new Error('tour_bonuses 테이블이 없습니다. 마이그레이션을 실행해주세요.')
  }

  // 보너스 값 업데이트
  const updateBonus = (tourId: string, type: 'guide' | 'driver', value: number) => {
    setTourBonuses(prev => {
      const updated = prev.map(tour => {
        if (tour.tour_id === tourId) {
          if (type === 'guide') {
            return { ...tour, guide_bonus: value }
          } else {
            return { ...tour, driver_bonus: value }
          }
        }
        return tour
      })
      
      // 총합 재계산
      const totalCost = updated.reduce((sum, tour) => sum + tour.additional_cost, 0)
      const totalGuide = updated.reduce((sum, tour) => sum + tour.guide_bonus, 0)
      const totalDriver = updated.reduce((sum, tour) => sum + tour.driver_bonus, 0)
      
      setTotalAdditionalCost(totalCost)
      setTotalGuideBonus(totalGuide)
      setTotalDriverBonus(totalDriver)
      
      return updated
    })
  }

  // 지불 처리 (회사 지출에 추가)
  const handlePayment = async () => {
    if (tourBonuses.length === 0) {
      alert('지불할 보너스 정보가 없습니다.')
      return
    }

    if (!authUser?.email) {
      alert('로그인이 필요합니다.')
      return
    }

    const totalBonus = totalGuideBonus + totalDriverBonus
    if (totalBonus === 0) {
      alert('지불할 보너스가 없습니다.')
      return
    }

    if (!confirm(`총 ${formatCurrency(totalBonus)}의 보너스를 지불하고 회사 지출에 추가하시겠습니까?`)) {
      return
    }

    setPaying(true)
    try {
      const selectedMember = teamMembers.find(m => m.email === selectedEmployee)
      const employeeName = selectedMember?.name_ko || selectedEmployee

      // 가이드 보너스가 있으면 회사 지출에 추가
      if (totalGuideBonus > 0) {
        const guideId = `BONUS_GUIDE_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
        const { error: guideError } = await supabase
          .from('company_expenses')
          .insert({
            id: guideId,
            paid_to: tourBonuses.find(t => t.guide_email)?.guide_name || '가이드',
            paid_for: `보너스 - ${employeeName} (가이드)`,
            description: `${startDate} ~ ${endDate} 기간 동안의 가이드 보너스`,
            amount: totalGuideBonus,
            payment_method: 'cash',
            submit_by: authUser.email,
            category: 'payroll',
            subcategory: 'bonus',
            status: 'approved',
            expense_type: 'operating',
            tax_deductible: true
          })

        if (guideError) {
          throw guideError
        }
      }

      // 드라이버 보너스가 있으면 회사 지출에 추가
      if (totalDriverBonus > 0) {
        const driverId = `BONUS_DRIVER_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
        const { error: driverError } = await supabase
          .from('company_expenses')
          .insert({
            id: driverId,
            paid_to: tourBonuses.find(t => t.driver_email)?.driver_name || '드라이버',
            paid_for: `보너스 - ${employeeName} (드라이버)`,
            description: `${startDate} ~ ${endDate} 기간 동안의 드라이버 보너스`,
            amount: totalDriverBonus,
            payment_method: 'cash',
            submit_by: authUser.email,
            category: 'payroll',
            subcategory: 'bonus',
            status: 'approved',
            expense_type: 'operating',
            tax_deductible: true
          })

        if (driverError) {
          throw driverError
        }
      }

      alert('보너스가 회사 지출에 추가되었습니다.')
      
      // 보너스 정보 저장
      await saveBonuses()
    } catch (error: any) {
      console.error('보너스 지불 오류:', error)
      alert('보너스 지불 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'))
    } finally {
      setPaying(false)
    }
  }

  // 날짜나 직원이 변경될 때 투어 보너스 조회
  useEffect(() => {
    if (selectedEmployee && startDate && endDate) {
      fetchTourBonuses()
    }
  }, [selectedEmployee, startDate, endDate])

  // 날짜 포맷팅 함수
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

  // 숫자 포맷팅 함수 (천 단위 구분 기호 추가)
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  // 모달 닫기
  const handleClose = () => {
    setStartDate('')
    setEndDate('')
    setSelectedEmployee('')
    setTourBonuses([])
    setTotalAdditionalCost(0)
    setTotalGuideBonus(0)
    setTotalDriverBonus(0)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <Calculator className="w-6 h-6 text-blue-600 mr-2" />
            <h2 className="text-xl font-bold text-gray-900">보너스 계산기</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 내용 */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-8 mb-6">
            {/* 왼쪽: 입력 필드들 */}
            <div className="space-y-4">
              {/* 직원 선택 */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 flex items-center">
                  <User className="w-4 h-4 mr-1" />
                  담당 직원 선택
                </label>
                <div className="flex space-x-2">
                  <select
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
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

              {/* 날짜 입력 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    시작일
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
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
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* 오른쪽: 요약 정보 */}
            <div className="space-y-2">
              <div className="bg-gray-50 rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">
                    <DollarSign className="w-3 h-3 inline mr-1" />
                    총 추가비용:
                  </span>
                  <span className="text-sm font-bold text-blue-600">
                    ${formatCurrency(totalAdditionalCost)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">
                    <Users className="w-3 h-3 inline mr-1" />
                    가이드 보너스:
                  </span>
                  <span className="text-sm font-bold text-green-600">
                    ${formatCurrency(totalGuideBonus)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">
                    <Users className="w-3 h-3 inline mr-1" />
                    드라이버 보너스:
                  </span>
                  <span className="text-sm font-bold text-purple-600">
                    ${formatCurrency(totalDriverBonus)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">
                    <Star className="w-3 h-3 inline mr-1" />
                    후기 보너스 포인트:
                  </span>
                  <span className={`text-sm font-bold ${
                    totalReviewBonusPoints > 0 ? 'text-green-600' : 
                    totalReviewBonusPoints < 0 ? 'text-red-600' : 
                    'text-gray-600'
                  }`}>
                    {totalReviewBonusPoints > 0 ? '+' : ''}{totalReviewBonusPoints}점
                  </span>
                </div>
                <div className="flex items-center justify-between border-t pt-1">
                  <span className="text-xs font-medium text-gray-700">
                    <DollarSign className="w-3 h-3 inline mr-1" />
                    총 보너스:
                  </span>
                  <span className="text-base font-bold text-green-600">
                    ${formatCurrency(totalGuideBonus + totalDriverBonus)}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  * 추가비용의 10%를 가이드와 드라이버에게 각각 지급<br/>
                  * 후기 보너스 포인트: 1점(-3), 2점(-2), 3점(-1), 4점(0), 5점(+1)
                </div>
              </div>
            </div>
          </div>

          {/* 투어 목록 테이블 */}
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">데이터를 불러오는 중...</p>
            </div>
          ) : tourBonuses.length > 0 ? (
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                투어 목록 ({tourBonuses.length}개 투어)
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
                        가이드
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        드라이버
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        비거주자 인원
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        추가비용
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        가이드 보너스
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        드라이버 보너스
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        후기 포인트
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        작업
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {tourBonuses.map((tour) => (
                      <tr key={tour.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(tour.tour_date)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          <Link 
                            href={`/${locale}/admin/tours/${tour.tour_id}`}
                            className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer flex items-center"
                          >
                            <LinkIcon className="w-3 h-3 mr-1" />
                            {tour.tour_name}
                          </Link>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          {tour.guide_name || '-'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          {tour.driver_name || '-'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-center">
                          {tour.non_resident_count}명
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          ${formatCurrency(tour.additional_cost)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm">
                          <div className="flex items-center">
                            <span className="text-green-600 font-medium mr-1">$</span>
                            <input
                              type="text"
                              value={tour.guide_bonus.toFixed(2)}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0
                                updateBonus(tour.tour_id, 'guide', Math.round(val * 100) / 100)
                              }}
                              onBlur={(e) => {
                                const val = parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0
                                updateBonus(tour.tour_id, 'guide', Math.round(val * 100) / 100)
                              }}
                              className="w-24 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-green-600 font-medium"
                              placeholder="0.00"
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm">
                          <div className="flex items-center">
                            <span className="text-purple-600 font-medium mr-1">$</span>
                            <input
                              type="text"
                              value={tour.driver_bonus.toFixed(2)}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0
                                updateBonus(tour.tour_id, 'driver', Math.round(val * 100) / 100)
                              }}
                              onBlur={(e) => {
                                const val = parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0
                                updateBonus(tour.tour_id, 'driver', Math.round(val * 100) / 100)
                              }}
                              className="w-24 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-purple-600 font-medium"
                              placeholder="0.00"
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-center">
                          <div className="flex items-center justify-center">
                            <span className={`font-medium ${
                              tour.review_bonus_points > 0 ? 'text-green-600' : 
                              tour.review_bonus_points < 0 ? 'text-red-600' : 
                              'text-gray-600'
                            }`}>
                              {tour.review_bonus_points > 0 ? '+' : ''}{tour.review_bonus_points}점
                            </span>
                            {tour.reviews.length > 0 && (
                              <button
                                onClick={() => setSelectedTourForReview(tour)}
                                className="ml-2 p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="후기 상세보기"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm">
                          <button
                            onClick={() => {
                              const tourBonus = tourBonuses.find(t => t.tour_id === tour.tour_id)
                              if (tourBonus) {
                                updateBonus(tour.tour_id, 'guide', tourBonus.guide_bonus)
                                updateBonus(tour.tour_id, 'driver', tourBonus.driver_bonus)
                              }
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800"
                            disabled
                          >
                            -
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={5} className="px-3 py-2 text-right text-sm font-medium text-gray-900">
                        총합:
                      </td>
                      <td className="px-3 py-2 text-sm font-bold text-gray-900">
                        ${formatCurrency(totalAdditionalCost)}
                      </td>
                      <td className="px-3 py-2 text-sm font-bold text-green-600">
                        ${formatCurrency(totalGuideBonus)}
                      </td>
                      <td className="px-3 py-2 text-sm font-bold text-purple-600">
                        ${formatCurrency(totalDriverBonus)}
                      </td>
                      <td className="px-3 py-2 text-sm font-bold text-center">
                        <span className={`${
                          totalReviewBonusPoints > 0 ? 'text-green-600' : 
                          totalReviewBonusPoints < 0 ? 'text-red-600' : 
                          'text-gray-600'
                        }`}>
                          {totalReviewBonusPoints > 0 ? '+' : ''}{totalReviewBonusPoints}점
                        </span>
                      </td>
                      <td className="px-3 py-2"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : selectedEmployee && startDate && endDate ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">투어가 없습니다</p>
              <p className="text-sm">
                선택한 기간 동안 진행한 투어가 없습니다.
              </p>
            </div>
          ) : null}

          {/* 저장 및 지불 버튼 */}
          {tourBonuses.length > 0 && (
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={saveBonuses}
                disabled={saving}
                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? '저장 중...' : '보너스 저장'}
              </button>
              <button
                onClick={handlePayment}
                disabled={paying || (totalGuideBonus === 0 && totalDriverBonus === 0)}
                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 border border-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                {paying ? '지불 중...' : '지불 및 회사 지출 추가'}
              </button>
            </div>
          )}

          {/* 후기 상세보기 모달 */}
          {selectedTourForReview && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
                  <h2 className="text-xl font-semibold text-gray-900">
                    후기 상세 - {selectedTourForReview.tour_name}
                  </h2>
                  <button
                    onClick={() => setSelectedTourForReview(null)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  {selectedTourForReview.reviews.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Star className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-sm">등록된 후기가 없습니다.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                        <div className="text-sm font-medium text-gray-700">
                          총 후기 보너스 포인트: 
                          <span className={`ml-2 font-bold ${
                            selectedTourForReview.review_bonus_points > 0 ? 'text-green-600' : 
                            selectedTourForReview.review_bonus_points < 0 ? 'text-red-600' : 
                            'text-gray-600'
                          }`}>
                            {selectedTourForReview.review_bonus_points > 0 ? '+' : ''}{selectedTourForReview.review_bonus_points}점
                          </span>
                        </div>
                      </div>
                      {selectedTourForReview.reviews.map((review, index) => {
                        const ratingToPoints = (rating: number): number => {
                          switch (rating) {
                            case 1: return -3
                            case 2: return -2
                            case 3: return -1
                            case 4: return 0
                            case 5: return 1
                            default: return 0
                          }
                        }
                        const points = ratingToPoints(review.rating)
                        return (
                          <div key={index} className="p-4 bg-white border border-gray-200 rounded-lg">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center space-x-3">
                                <span className="text-sm font-medium text-gray-900">
                                  {review.customer_name}
                                </span>
                                <span className="text-xs text-gray-500">
                                  ({review.platform})
                                </span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <div className="flex items-center">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <Star
                                      key={star}
                                      className={`w-4 h-4 ${
                                        star <= review.rating
                                          ? 'text-yellow-400 fill-yellow-400'
                                          : 'text-gray-300'
                                      }`}
                                    />
                                  ))}
                                </div>
                                <span className={`text-sm font-bold ${
                                  points > 0 ? 'text-green-600' : 
                                  points < 0 ? 'text-red-600' : 
                                  'text-gray-600'
                                }`}>
                                  {points > 0 ? '+' : ''}{points}점
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
