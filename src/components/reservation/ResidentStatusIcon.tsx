'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Home, Plane, PlaneTakeoff, HelpCircle, X } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { supabase } from '@/lib/supabase'

interface ResidentStatusIconProps {
  reservationId: string
  customerId: string | null
  totalPeople: number
  onUpdate?: () => void
}

export const ResidentStatusIcon: React.FC<ResidentStatusIconProps> = ({
  reservationId,
  customerId,
  totalPeople,
  onUpdate
}) => {
  const t = useTranslations('common')
  const locale = useLocale()
  const [residentStatus, setResidentStatus] = useState<'us_resident' | 'non_resident' | 'non_resident_with_pass' | 'non_resident_under_16' | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [residentStatusCounts, setResidentStatusCounts] = useState({
    usResident: 0,
    nonResident: 0,
    nonResidentUnder16: 0,
    nonResidentWithPass: 0,
    passCoveredCount: 0
  })

  // 패스 장수에 따라 실제 커버되는 인원 수 계산 (패스 1장 = 4인)
  // 실제 예약 인원을 초과할 수 없음
  const calculateActualPassCovered = (passCount: number, usResident: number, nonResident: number, nonResidentUnder16: number) => {
    const maxCoverable = passCount * 4 // 패스로 최대 커버 가능한 인원 수
    const remainingPeople = totalPeople - usResident - nonResident - nonResidentUnder16 // 패스로 커버해야 할 인원 수
    return Math.min(maxCoverable, remainingPeople) // 둘 중 작은 값
  }

  // 거주 상태 정보 가져오기
  const fetchResidentStatus = useCallback(async () => {
    try {
      const { data: reservationCustomers, error } = await supabase
        .from('reservation_customers')
        .select('resident_status')
        .eq('reservation_id', reservationId)
      
      if (!error && reservationCustomers && reservationCustomers.length > 0) {
        const statusCounts: Record<string, number> = {}
        reservationCustomers.forEach((rc: any) => {
          const status = rc.resident_status || 'unknown'
          statusCounts[status] = (statusCounts[status] || 0) + 1
        })
        
        let mostCommonStatus: 'us_resident' | 'non_resident' | 'non_resident_with_pass' | 'non_resident_under_16' | null = null
        let maxCount = 0
        Object.entries(statusCounts).forEach(([status, count]) => {
          if (count > maxCount && status !== 'unknown') {
            maxCount = count
            mostCommonStatus = status as 'us_resident' | 'non_resident' | 'non_resident_with_pass' | 'non_resident_under_16' | null
          }
        })
        
        setResidentStatus(mostCommonStatus)
      }
    } catch (error) {
      console.error('거주 상태 조회 오류:', error)
    }
  }, [reservationId])

  // 모달 열 때 현재 인원 수 로드
  const handleOpenModal = useCallback(async () => {
    try {
      const { data: reservationCustomers, error } = await supabase
        .from('reservation_customers')
        .select('resident_status, pass_covered_count')
        .eq('reservation_id', reservationId)
      
      if (!error && reservationCustomers && reservationCustomers.length > 0) {
        let usResidentCount = 0
        let nonResidentCount = 0
        let nonResidentUnder16Count = 0
        let nonResidentWithPassCount = 0
        let totalPassCoveredCount = 0
        
        reservationCustomers.forEach((rc: any) => {
          if (rc.resident_status === 'us_resident') {
            usResidentCount++
          } else if (rc.resident_status === 'non_resident') {
            nonResidentCount++
          } else if (rc.resident_status === 'non_resident_under_16') {
            nonResidentUnder16Count++
          } else if (rc.resident_status === 'non_resident_with_pass') {
            nonResidentWithPassCount++ // 패스 장수
            // 각 패스는 4인을 커버하므로 합산
            if (rc.pass_covered_count) {
              totalPassCoveredCount += rc.pass_covered_count
            }
          }
        })
        
        setResidentStatusCounts({
          usResident: usResidentCount,
          nonResident: nonResidentCount,
          nonResidentUnder16: nonResidentUnder16Count,
          nonResidentWithPass: nonResidentWithPassCount, // 패스 장수
          passCoveredCount: totalPassCoveredCount // 패스로 커버되는 총 인원 수
        })
      } else {
        setResidentStatusCounts({
          usResident: 0,
          nonResident: 0,
          nonResidentUnder16: 0,
          nonResidentWithPass: 0,
          passCoveredCount: 0
        })
      }
    } catch (error) {
      console.error('거주 상태 정보 로드 오류:', error)
    }
    
    setShowModal(true)
  }, [reservationId])

  // 거주 상태별 인원 수 저장
  const handleSave = async () => {
    try {
      // 패스 장수는 비거주자 (패스 보유) 인원 수와 같음
      const passCount = residentStatusCounts.nonResidentWithPass
      // 패스로 커버되는 인원 수는 패스 장수 × 4와 실제 예약 인원 중 작은 값
      const actualPassCovered = calculateActualPassCovered(
        passCount, 
        residentStatusCounts.usResident, 
        residentStatusCounts.nonResident,
        residentStatusCounts.nonResidentUnder16
      )

      // 총 인원 수 확인
      const statusTotal = residentStatusCounts.usResident + residentStatusCounts.nonResident + residentStatusCounts.nonResidentUnder16 + actualPassCovered
      
      if (statusTotal !== totalPeople) {
        const message = locale === 'ko'
          ? `총 인원(${totalPeople}명)과 거주 상태별 합계(${statusTotal}명)가 일치하지 않습니다.`
          : `Total people (${totalPeople}) does not match resident status total (${statusTotal}).`
        alert(message)
        return
      }

      // 기존 reservation_customers 데이터 삭제
      await supabase
        .from('reservation_customers')
        .delete()
        .eq('reservation_id', reservationId)

      // 상태별 인원 수에 따라 reservation_customers 레코드 생성
      const reservationCustomers: any[] = []
      let orderIndex = 0

      // 미국 거주자
      for (let i = 0; i < residentStatusCounts.usResident; i++) {
        reservationCustomers.push({
          reservation_id: reservationId,
          customer_id: customerId,
          resident_status: 'us_resident',
          pass_covered_count: 0,
          order_index: orderIndex++
        })
      }

      // 비거주자
      for (let i = 0; i < residentStatusCounts.nonResident; i++) {
        reservationCustomers.push({
          reservation_id: reservationId,
          customer_id: customerId,
          resident_status: 'non_resident',
          pass_covered_count: 0,
          order_index: orderIndex++
        })
      }

      // 비 거주자 (16세 이하)
      for (let i = 0; i < residentStatusCounts.nonResidentUnder16; i++) {
        reservationCustomers.push({
          reservation_id: reservationId,
          customer_id: customerId,
          resident_status: 'non_resident_under_16',
          pass_covered_count: 0,
          order_index: orderIndex++
        })
      }

      // 비거주자 (패스 보유) - 패스 장수만큼 생성, 각 패스는 4인을 커버
      for (let i = 0; i < passCount; i++) {
        reservationCustomers.push({
          reservation_id: reservationId,
          customer_id: customerId,
          resident_status: 'non_resident_with_pass',
          pass_covered_count: 4, // 패스 1장당 4인 커버
          order_index: orderIndex++
        })
      }

      // reservation_customers 데이터 삽입
      if (reservationCustomers.length > 0) {
        const { error: rcError } = await supabase
          .from('reservation_customers')
          .insert(reservationCustomers)

        if (rcError) {
          console.error('Error saving reservation_customers:', rcError)
          alert(t('residentStatusUpdateFailed'))
          return
        }
      }

      // 성공 시 모달 닫기 및 상태 새로고침
      setShowModal(false)
      await fetchResidentStatus()
      if (onUpdate) {
        onUpdate()
      }
      alert(t('residentStatusUpdateSuccess'))
    } catch (error) {
      console.error('Error updating resident status:', error)
      alert(t('residentStatusUpdateFailed'))
    }
  }

  useEffect(() => {
    fetchResidentStatus()
  }, [fetchResidentStatus])

  const getStatusIcon = () => {
    if (residentStatus === 'us_resident') {
      return <Home className="h-4 w-4 text-green-600 cursor-pointer hover:scale-110 transition-transform" />
    } else if (residentStatus === 'non_resident') {
      return <Plane className="h-4 w-4 text-blue-600 cursor-pointer hover:scale-110 transition-transform" />
    } else if (residentStatus === 'non_resident_with_pass') {
      return <PlaneTakeoff className="h-4 w-4 text-purple-600 cursor-pointer hover:scale-110 transition-transform" />
    } else if (residentStatus === 'non_resident_under_16') {
      return <Plane className="h-4 w-4 text-orange-600 cursor-pointer hover:scale-110 transition-transform" />
    } else {
      return <HelpCircle className="h-4 w-4 text-gray-400 cursor-pointer hover:scale-110 transition-transform" />
    }
  }

  return (
    <>
      <span 
        className="ml-2 flex-shrink-0"
        onClick={(e) => {
          e.stopPropagation()
          handleOpenModal()
        }}
      >
        {getStatusIcon()}
      </span>

      {/* 거주 상태별 인원 수 설정 모달 */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowModal(false)
            }
          }}
        >
          <div 
            className="bg-white rounded-lg p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {t('residentStatusSetup')}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 총 인원 표시 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-sm font-medium text-blue-900">
                  {t('total')}: {totalPeople}{locale === 'ko' ? '명' : ` ${t('people')}`}
                </div>
              </div>

              {/* 미국 거주자 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <span className="inline-flex items-center">
                    <span className="w-3 h-3 rounded-full bg-green-600 mr-2"></span>
                    {t('statusUsResident')}
                  </span>
                </label>
                <input
                  type="number"
                  value={residentStatusCounts.usResident}
                  onChange={(e) => {
                    const newCount = Number(e.target.value) || 0
                    const actualPassCovered = calculateActualPassCovered(
                      residentStatusCounts.nonResidentWithPass,
                      newCount,
                      residentStatusCounts.nonResident
                    )
                    setResidentStatusCounts(prev => ({ 
                      ...prev, 
                      usResident: newCount,
                      passCoveredCount: actualPassCovered
                    }))
                  }}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* 비거주자 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <span className="inline-flex items-center">
                    <span className="w-3 h-3 rounded-full bg-blue-600 mr-2"></span>
                    {t('statusNonResident')}
                  </span>
                </label>
                <input
                  type="number"
                  value={residentStatusCounts.nonResident}
                  onChange={(e) => {
                    const newCount = Number(e.target.value) || 0
                    const actualPassCovered = calculateActualPassCovered(
                      residentStatusCounts.nonResidentWithPass,
                      residentStatusCounts.usResident,
                      newCount,
                      residentStatusCounts.nonResidentUnder16
                    )
                    setResidentStatusCounts(prev => ({ 
                      ...prev, 
                      nonResident: newCount,
                      passCoveredCount: actualPassCovered
                    }))
                  }}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* 비 거주자 (16세 이하) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <span className="inline-flex items-center">
                    <span className="w-3 h-3 rounded-full bg-orange-600 mr-2"></span>
                    {locale === 'ko' ? '비 거주자 (16세 이하)' : 'Non-Resident (Under 16)'}
                  </span>
                </label>
                <input
                  type="number"
                  value={residentStatusCounts.nonResidentUnder16}
                  onChange={(e) => {
                    const newCount = Number(e.target.value) || 0
                    const actualPassCovered = calculateActualPassCovered(
                      residentStatusCounts.nonResidentWithPass,
                      residentStatusCounts.usResident,
                      residentStatusCounts.nonResident,
                      newCount
                    )
                    setResidentStatusCounts(prev => ({ 
                      ...prev, 
                      nonResidentUnder16: newCount,
                      passCoveredCount: actualPassCovered
                    }))
                  }}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              {/* 비거주자 (패스 보유) - 실제 패스 장수 입력 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <span className="inline-flex items-center">
                    <span className="w-3 h-3 rounded-full bg-purple-600 mr-2"></span>
                    {t('statusNonResidentWithPass')} {locale === 'ko' ? '(패스 장수)' : '(Number of passes)'}
                  </span>
                </label>
                <input
                  type="number"
                  value={residentStatusCounts.nonResidentWithPass}
                  onChange={(e) => {
                    const newPassCount = Number(e.target.value) || 0
                    const actualPassCovered = calculateActualPassCovered(
                      newPassCount,
                      residentStatusCounts.usResident,
                      residentStatusCounts.nonResident
                    )
                    setResidentStatusCounts(prev => ({ 
                      ...prev, 
                      nonResidentWithPass: newPassCount,
                      passCoveredCount: actualPassCovered // 패스 장수와 실제 예약 인원에 따라 자동 계산
                    }))
                  }}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder={locale === 'ko' ? '실제 보유한 패스 장수 입력' : 'Enter number of passes'}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {locale === 'ko' 
                    ? `패스 ${residentStatusCounts.nonResidentWithPass}장 = ${calculateActualPassCovered(residentStatusCounts.nonResidentWithPass, residentStatusCounts.usResident, residentStatusCounts.nonResident, residentStatusCounts.nonResidentUnder16)}인 커버 (최대 ${residentStatusCounts.nonResidentWithPass * 4}인 가능)`
                    : `${residentStatusCounts.nonResidentWithPass} passes = covers ${calculateActualPassCovered(residentStatusCounts.nonResidentWithPass, residentStatusCounts.usResident, residentStatusCounts.nonResident, residentStatusCounts.nonResidentUnder16)} people (max ${residentStatusCounts.nonResidentWithPass * 4} possible)`}
                </p>
              </div>

              {/* 패스로 커버되는 인원 수 - 자동 계산 표시 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('passCoveredCount')} {locale === 'ko' ? '(자동 계산)' : '(Auto-calculated)'}
                </label>
                <input
                  type="number"
                  value={residentStatusCounts.passCoveredCount}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {locale === 'ko' 
                    ? `패스 1장당 4인 커버 (실제 예약 인원과 패스 최대 커버 인원 중 작은 값)`
                    : `1 pass covers 4 people (min of actual reservation count and max pass coverage)`}
                </p>
              </div>

              {/* 합계 확인 */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="text-sm text-gray-700">
                  {t('residentStatusTotal')}: {residentStatusCounts.usResident + residentStatusCounts.nonResident + residentStatusCounts.nonResidentUnder16 + residentStatusCounts.passCoveredCount}{locale === 'ko' ? '명' : ` ${t('people')}`}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {locale === 'ko' 
                    ? `(미국 거주자: ${residentStatusCounts.usResident}명, 비거주자: ${residentStatusCounts.nonResident}명, 비 거주자 16세 이하: ${residentStatusCounts.nonResidentUnder16}명, 패스 커버: ${residentStatusCounts.passCoveredCount}명)`
                    : `(US Resident: ${residentStatusCounts.usResident}, Non-Resident: ${residentStatusCounts.nonResident}, Non-Resident Under 16: ${residentStatusCounts.nonResidentUnder16}, Pass Covered: ${residentStatusCounts.passCoveredCount})`}
                </div>
                {(residentStatusCounts.usResident + residentStatusCounts.nonResident + residentStatusCounts.nonResidentUnder16 + residentStatusCounts.passCoveredCount) !== totalPeople && (
                  <div className="text-xs text-orange-600 mt-1">
                    ⚠️ {t('peopleCountMismatch')}
                  </div>
                )}
              </div>

              {/* 버튼 */}
              <div className="flex justify-end space-x-2 pt-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  {locale === 'ko' ? '취소' : 'Cancel'}
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {locale === 'ko' ? '저장' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

