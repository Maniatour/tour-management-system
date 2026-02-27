import React, { useState, useEffect, useCallback } from 'react'
import { Check, X, Users, Clock, Building, DollarSign, Wallet, Home, Plane, PlaneTakeoff, HelpCircle, CheckCircle2, AlertCircle, XCircle, Circle, MessageSquare } from 'lucide-react'
// @ts-expect-error - react-country-flag 라이브러리의 타입 정의가 없음
import ReactCountryFlag from 'react-country-flag'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { SimplePickupEditModal } from './modals/SimplePickupEditModal'
import ReviewManagementSection from '@/components/reservation/ReviewManagementSection'

interface Reservation {
  id: string
  customer_id: string | null
  product_id: string | null
  tour_date: string
  tour_time: string | null
  pickup_hotel: string | null
  pickup_time: string | null
  adults: number | null
  children?: number | null
  infants?: number | null
  status: string | null
  tour_id: string | null
  channel_id?: string | null
  choices?: string | null
  [key: string]: unknown
}

interface PaymentRecord {
  id: string
  reservation_id: string
  payment_status: string
  amount: number
  payment_method: string
  note?: string
  submit_on: string
  amount_krw?: number
}

interface ReservationPricing {
  id: string
  reservation_id: string
  balance_amount: number | string | null
  total_price?: number | string | null
  total_amount?: number | string | null
  paid_amount?: number | string | null
  currency?: string
  adult_product_price?: number | string | null
  child_product_price?: number | string | null
  infant_product_price?: number | string | null
  product_price_total?: number | string | null
  coupon_discount?: number | string | null
  additional_discount?: number | string | null
  additional_cost?: number | string | null
  commission_percent?: number | string | null
  commission_amount?: number | string | null
}

interface ReservationCardProps {
  reservation: Reservation
  isStaff: boolean
  showActions?: boolean
  showStatus?: boolean
  showTourInfo?: boolean
  onEdit?: (reservation: Reservation) => void
  onAssign?: (reservationId: string) => void
  onUnassign?: (reservationId: string) => void
  onReassign?: (reservationId: string, fromTourId: string) => void
  getCustomerName: (customerId: string) => string
  getCustomerLanguage: (customerId: string) => string
  getChannelInfo?: (channelId: string) => Promise<{ name: string; favicon?: string } | null | undefined>
  safeJsonParse: (data: string | object | null | undefined, fallback?: unknown) => unknown
  pickupHotels?: Array<{ id: string; hotel: string; pick_up_location?: string }>
  /** 새로고침. 픽업 수정 직후 픽업 스케줄 반영을 위해 수정된 픽업 정보를 넘기면 즉시 반영 후 서버 새로고침을 수행합니다. */
  onRefresh?: (updatedPickup?: { reservationId: string; pickup_time: string; pickup_hotel: string }) => Promise<void> | void
}

export const ReservationCard: React.FC<ReservationCardProps> = ({
  reservation,
  isStaff,
  showActions = false,
  showStatus = true,
  showTourInfo = false,
  onEdit,
  onAssign,
  onUnassign,
  onReassign,
  getCustomerName,
  getCustomerLanguage,
  getChannelInfo,
  safeJsonParse,
  pickupHotels = [],
  onRefresh
}) => {
  const customerName = getCustomerName(reservation.customer_id || '')
  const customerLanguage = getCustomerLanguage(reservation.customer_id || '')
  
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([])
  const [showPaymentRecords, setShowPaymentRecords] = useState(false)
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [reservationPricing, setReservationPricing] = useState<ReservationPricing | null>(null)
  const [showSimplePickupModal, setShowSimplePickupModal] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [channelInfo, setChannelInfo] = useState<{ name: string; favicon?: string; has_not_included_price?: boolean; commission_base_price_only?: boolean } | null>(null)
  const [customerData, setCustomerData] = useState<{ id: string; resident_status: 'us_resident' | 'non_resident' | 'non_resident_with_pass' | null } | null>(null)
  const [paymentMethodMap, setPaymentMethodMap] = useState<Record<string, string>>({})
  // setResidentStatusDropdownOpen는 사용되지만 residentStatusDropdownOpen은 현재 읽히지 않음
  const [_residentStatusDropdownOpen, setResidentStatusDropdownOpen] = useState<string | null>(null)
  const [showResidentStatusModal, setShowResidentStatusModal] = useState(false)
  const [residentStatusCounts, setResidentStatusCounts] = useState({
    usResident: 0,
    nonResident: 0,
    nonResidentUnder16: 0,
    nonResidentWithPass: 0,
    passCoveredCount: 0
  })
  const [reservationChoices, setReservationChoices] = useState<Array<{
    choice_id: string
    option_id: string
    option_name?: string
    option_name_ko?: string
    option_key?: string
    choice_group?: string
    choice_group_ko?: string
  }>>([])

  // 패스 장수에 따라 실제 커버되는 인원 수 계산 (패스 1장 = 4인)
  // 실제 예약 인원을 초과할 수 없음
  const calculateActualPassCovered = (passCount: number, usResident: number, nonResident: number, nonResidentUnder16: number) => {
    const totalPeople = (reservation.adults || 0) + 
      ((reservation.children || (reservation as any).child || 0) as number) + 
      ((reservation.infants || (reservation as any).infant || 0) as number)
    const maxCoverable = passCount * 4 // 패스로 최대 커버 가능한 인원 수
    const remainingPeople = totalPeople - usResident - nonResident - nonResidentUnder16 // 패스로 커버해야 할 인원 수
    return Math.min(maxCoverable, remainingPeople) // 둘 중 작은 값
  }
  
  // 예약별 거주 상태 정보 가져오기 (reservation_customers 테이블에서)
  const fetchCustomerData = useCallback(async () => {
    if (!reservation.id) return
    
    try {
      // reservation_customers 테이블에서 예약의 거주 상태 정보 가져오기
      const { data: reservationCustomers, error } = await supabase
        .from('reservation_customers' as any)
        .select('resident_status, pass_covered_count')
        .eq('reservation_id', reservation.id) as { data: Array<{ resident_status: string | null; pass_covered_count: number | null }> | null; error: any }
      
      if (error) {
        console.error('예약 고객 정보 조회 오류:', error)
        // fallback: customers 테이블에서 가져오기
        if (reservation.customer_id) {
          const { data: customer, error: customerError } = await supabase
            .from('customers')
            .select('id, resident_status')
            .eq('id', reservation.customer_id)
            .maybeSingle()
          
          if (!customerError && customer) {
            setCustomerData({
              id: (customer as any).id,
              resident_status: (customer as any).resident_status as 'us_resident' | 'non_resident' | 'non_resident_with_pass' | null
            })
          }
        }
        return
      }
      
      // 상태별 개수 계산 및 인원 수 저장
      let usResidentCount = 0
      let nonResidentCount = 0
      let nonResidentUnder16Count = 0
      let nonResidentWithPassCount = 0
      let passCoveredCount = 0
      
      if (reservationCustomers && reservationCustomers.length > 0) {
        // 상태별 개수 계산
        const statusCounts: Record<string, number> = {}
        reservationCustomers.forEach((rc: any) => {
          const status = rc.resident_status || 'unknown'
          statusCounts[status] = (statusCounts[status] || 0) + 1
          
          if (status === 'us_resident') {
            usResidentCount++
          } else if (status === 'non_resident') {
            nonResidentCount++
          } else if (status === 'non_resident_under_16') {
            nonResidentUnder16Count++
          } else if (status === 'non_resident_with_pass') {
            nonResidentWithPassCount++
            // 패스 커버 수는 첫 번째 레코드에서만 가져오기
            if (passCoveredCount === 0 && rc.pass_covered_count) {
              passCoveredCount = rc.pass_covered_count
            }
          }
        })
        
        // 거주 상태별 인원 수 저장
        setResidentStatusCounts({
          usResident: usResidentCount,
          nonResident: nonResidentCount,
          nonResidentUnder16: nonResidentUnder16Count,
          nonResidentWithPass: nonResidentWithPassCount,
          passCoveredCount: passCoveredCount
        })
        
        // 가장 많은 상태 찾기
        let mostCommonStatus: 'us_resident' | 'non_resident' | 'non_resident_with_pass' | 'non_resident_under_16' | null = null
        let maxCount = 0
        Object.entries(statusCounts).forEach(([status, count]) => {
          if (count > maxCount && status !== 'unknown') {
            maxCount = count
            mostCommonStatus = status as 'us_resident' | 'non_resident' | 'non_resident_with_pass' | 'non_resident_under_16' | null
          }
        })
        
        // 가장 많은 상태가 없으면 첫 번째 상태 사용
        if (!mostCommonStatus && reservationCustomers[0]) {
          mostCommonStatus = reservationCustomers[0].resident_status as 'us_resident' | 'non_resident' | 'non_resident_with_pass' | 'non_resident_under_16' | null
        }
        
        setCustomerData({
          id: reservation.id, // reservation_id를 id로 사용
          resident_status: (mostCommonStatus === 'non_resident_under_16' ? 'non_resident' : mostCommonStatus) as 'us_resident' | 'non_resident' | 'non_resident_with_pass' | null
        })
      } else {
        // reservation_customers에 데이터가 없으면 customers 테이블에서 가져오기 (fallback)
        if (reservation.customer_id) {
          const { data: customer, error: customerError } = await supabase
            .from('customers')
            .select('id, resident_status')
            .eq('id', reservation.customer_id)
            .maybeSingle()
          
          if (!customerError && customer) {
            setCustomerData({
              id: (customer as any).id,
              resident_status: (customer as any).resident_status as 'us_resident' | 'non_resident' | 'non_resident_with_pass' | null
            })
          }
        }
      }
    } catch (error) {
      console.error('고객 정보 조회 오류:', error)
    }
  }, [reservation.id, reservation.customer_id])

  // 채널 정보 가져오기
  const fetchChannelInfo = useCallback(async () => {
    if (!reservation.channel_id) return
    
    try {
      // 채널 정보 직접 조회 (has_not_included_price, commission_base_price_only 포함)
      type ChannelData = {
        name?: string | null
        favicon_url?: string | null
        has_not_included_price?: boolean | null
        commission_base_price_only?: boolean | null
      }
      
      const { data: channelData, error } = await supabase
        .from('channels')
        .select('name, favicon_url, has_not_included_price, commission_base_price_only')
        .eq('id', reservation.channel_id)
        .maybeSingle()
      
      if (!error && channelData) {
        const channel = channelData as ChannelData
        setChannelInfo({
          name: channel.name || 'Unknown',
          ...(channel.favicon_url ? { favicon: channel.favicon_url } : {}),
          has_not_included_price: channel.has_not_included_price || false,
          commission_base_price_only: channel.commission_base_price_only || false
        })
      } else if (getChannelInfo) {
        // fallback: getChannelInfo 사용
        const info = await getChannelInfo(reservation.channel_id)
        setChannelInfo(info ? { ...info, has_not_included_price: false, commission_base_price_only: false } : null)
      } else {
        setChannelInfo(null)
      }
    } catch (error) {
      console.error('채널 정보 조회 오류:', error)
      // fallback: getChannelInfo 사용
      if (getChannelInfo) {
        try {
          const info = await getChannelInfo(reservation.channel_id!)
          setChannelInfo(info ? { ...info, has_not_included_price: false, commission_base_price_only: false } : null)
        } catch (fallbackError) {
          console.error('채널 정보 조회 fallback 오류:', fallbackError)
          setChannelInfo(null)
        }
      } else {
        setChannelInfo(null)
      }
    }
  }, [getChannelInfo, reservation.channel_id])

  // 예약 가격 정보 가져오기
  const fetchReservationPricing = useCallback(async () => {
    if (!isStaff) return
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('인증이 필요합니다.')
      }

      const response = await fetch(`/api/reservation-pricing?reservation_id=${reservation.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        // 404 오류는 데이터가 없는 것으로 처리
        if (response.status === 404) {
          setReservationPricing(null)
          return
        }
        throw new Error('예약 가격 정보를 불러올 수 없습니다.')
      }

      const data = await response.json()
      if (data.pricing) {
        // balance_amount를 숫자로 변환
        const pricing = {
          ...data.pricing,
          balance_amount: typeof data.pricing.balance_amount === 'string' 
            ? parseFloat(data.pricing.balance_amount) || 0
            : (data.pricing.balance_amount || 0)
        }
        setReservationPricing(pricing)
      } else {
        setReservationPricing(null)
      }
    } catch (error) {
      console.error('예약 가격 정보 조회 오류:', error)
    }
  }, [isStaff, reservation.id])

  // 결제 방법 정보 로드
  const loadPaymentMethods = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('id, method')
      
      if (error) throw error
      
      const methodMap: Record<string, string> = {}
      data?.forEach((pm: any) => {
        // ID로 조회 시 방법명(method)만 반환
        methodMap[pm.id] = pm.method
        // 방법명으로도 매핑 (payment_records에 방법명이 직접 저장된 경우 대비)
        methodMap[pm.method] = pm.method
      })
      setPaymentMethodMap(methodMap)
    } catch (error) {
      console.error('결제 방법 정보 로드 오류:', error)
    }
  }, [])

  // 입금 내역 가져오기
  const fetchPaymentRecords = useCallback(async () => {
    if (!isStaff) return
    
    setLoadingPayments(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('인증이 필요합니다.')
      }

      const response = await fetch(`/api/payment-records?reservation_id=${reservation.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('입금 내역을 불러올 수 없습니다.')
      }

      const data = await response.json()
      setPaymentRecords(data.paymentRecords || [])
    } catch (error) {
      console.error('입금 내역 조회 오류:', error)
      setPaymentRecords([])
    } finally {
      setLoadingPayments(false)
    }
  }, [isStaff, reservation.id])

  // 거주 상태 모달 열기
  const handleOpenResidentStatusModal = useCallback(async () => {
    // 현재 거주 상태별 인원 수 로드
    if (!reservation.id) return
    
    try {
      const { data: reservationCustomers, error } = await supabase
        .from('reservation_customers')
        .select('resident_status, pass_covered_count')
        .eq('reservation_id', reservation.id)
      
      if (!error && reservationCustomers && reservationCustomers.length > 0) {
        let usResidentCount = 0
        let nonResidentCount = 0
        let nonResidentUnder16Count = 0
        let nonResidentWithPassCount = 0
        let passCoveredCount = 0
        
        reservationCustomers.forEach((rc: any) => {
          if (rc.resident_status === 'us_resident') {
            usResidentCount++
          } else if (rc.resident_status === 'non_resident') {
            nonResidentCount++
          } else if (rc.resident_status === 'non_resident_under_16') {
            nonResidentUnder16Count++
          } else if (rc.resident_status === 'non_resident_with_pass') {
            nonResidentWithPassCount++
            // 각 패스는 4인을 커버하므로 합산
            if (rc.pass_covered_count) {
              passCoveredCount += rc.pass_covered_count
            }
          }
        })
        
        setResidentStatusCounts({
          usResident: usResidentCount,
          nonResident: nonResidentCount,
          nonResidentUnder16: nonResidentUnder16Count,
          nonResidentWithPass: nonResidentWithPassCount,
          passCoveredCount: passCoveredCount
        })
      } else {
        // 데이터가 없으면 0으로 초기화
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
    
    setShowResidentStatusModal(true)
  }, [reservation.id])

  // 거주 상태별 인원 수 저장
  const handleSaveResidentStatusCounts = async () => {
    try {
      const totalPeople = (reservation.adults || 0) + 
        ((reservation.children || (reservation as any).child || 0) as number) + 
        ((reservation.infants || (reservation as any).infant || 0) as number)
      
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
        alert(`총 인원(${totalPeople}명)과 거주 상태별 합계(${statusTotal}명)가 일치하지 않습니다.`)
        return
      }

      // 기존 reservation_customers 데이터 삭제
      await supabase
        .from('reservation_customers')
        .delete()
        .eq('reservation_id', reservation.id)

      // 상태별 인원 수에 따라 reservation_customers 레코드 생성
      const reservationCustomers: any[] = []
      let orderIndex = 0

      // 미국 거주자
      for (let i = 0; i < residentStatusCounts.usResident; i++) {
        reservationCustomers.push({
          reservation_id: reservation.id,
          customer_id: reservation.customer_id,
          resident_status: 'us_resident',
          pass_covered_count: 0,
          order_index: orderIndex++
        })
      }

      // 비거주자
      for (let i = 0; i < residentStatusCounts.nonResident; i++) {
        reservationCustomers.push({
          reservation_id: reservation.id,
          customer_id: reservation.customer_id,
          resident_status: 'non_resident',
          pass_covered_count: 0,
          order_index: orderIndex++
        })
      }

      // 비 거주자 (16세 이하)
      for (let i = 0; i < residentStatusCounts.nonResidentUnder16; i++) {
        reservationCustomers.push({
          reservation_id: reservation.id,
          customer_id: reservation.customer_id,
          resident_status: 'non_resident_under_16',
          pass_covered_count: 0,
          order_index: orderIndex++
        })
      }

      // 비거주자 (패스 보유) - 패스 장수만큼 생성, 각 패스는 4인을 커버
      for (let i = 0; i < passCount; i++) {
        reservationCustomers.push({
          reservation_id: reservation.id,
          customer_id: reservation.customer_id,
          resident_status: 'non_resident_with_pass',
          pass_covered_count: 4, // 패스 1장당 4인 커버
          order_index: orderIndex++
        })
      }

      // reservation_customers 데이터 삽입
      if (reservationCustomers.length > 0) {
        const { error: rcError } = await supabase
          .from('reservation_customers' as any)
          .insert(reservationCustomers as any)

        if (rcError) {
          console.error('Error saving reservation_customers:', rcError)
          alert('거주 상태 업데이트에 실패했습니다.')
          return
        }
      }

      // 성공 시 모달 닫기 및 고객 정보 새로고침
      setShowResidentStatusModal(false)
      await fetchCustomerData()
      alert('거주 상태가 성공적으로 업데이트되었습니다.')
    } catch (error) {
      console.error('Error updating resident status:', error)
      alert('거주 상태 업데이트에 실패했습니다.')
    }
  }

  // 거주 상태 업데이트 핸들러 (reservation_customers 테이블 업데이트) - 기존 함수는 유지 (하위 호환성)
  // @ts-expect-error - 하위 호환성을 위해 유지하지만 현재 사용되지 않음
  const handleUpdateResidentStatus = async (reservationId: string, newStatus: 'us_resident' | 'non_resident' | 'non_resident_with_pass' | null) => {
    try {
      // reservation_customers 테이블에서 해당 예약의 모든 레코드 가져오기
      const { data: existingRecords, error: fetchError } = await supabase
        .from('reservation_customers' as any)
        .select('id, customer_id, pass_covered_count')
        .eq('reservation_id', reservationId) as { data: Array<{ id: string; customer_id: string | null; pass_covered_count: number | null }> | null; error: any }
      
      if (fetchError) {
        console.error('Error fetching reservation_customers:', fetchError)
        // reservation_customers에 데이터가 없으면 새로 생성
        if (reservation.customer_id) {
          const { error: insertError } = await supabase
            .from('reservation_customers' as any)
            .insert({
              reservation_id: reservationId,
              customer_id: reservation.customer_id,
              resident_status: newStatus,
              pass_covered_count: 0,
              order_index: 0
            } as any)
          
          if (insertError) {
            console.error('Error creating reservation_customer:', insertError)
            alert('거주 상태 업데이트에 실패했습니다.')
            return
          }
        }
      } else if (existingRecords && existingRecords.length > 0) {
        // 기존 레코드가 있으면 모든 레코드의 상태를 업데이트
        const updatePromises = existingRecords.map((record: any) => 
          (supabase as any)
            .from('reservation_customers')
            .update({ 
              resident_status: newStatus,
              // 패스 보유 상태가 아니면 pass_covered_count를 0으로 설정
              pass_covered_count: newStatus === 'non_resident_with_pass' ? (record.pass_covered_count || 0) : 0
            })
            .eq('id', record.id)
        )
        
        const results = await Promise.all(updatePromises)
        const hasError = results.some(result => result.error)
        
        if (hasError) {
          console.error('Error updating reservation_customers:', results.find(r => r.error)?.error)
          alert('거주 상태 업데이트에 실패했습니다.')
          return
        }
      } else {
        // reservation_customers에 데이터가 없으면 새로 생성
        if (reservation.customer_id) {
          const { error: insertError } = await supabase
            .from('reservation_customers' as any)
            .insert({
              reservation_id: reservationId,
              customer_id: reservation.customer_id,
              resident_status: newStatus,
              pass_covered_count: 0,
              order_index: 0
            } as any)
          
          if (insertError) {
            console.error('Error creating reservation_customer:', insertError)
            alert('거주 상태 업데이트에 실패했습니다.')
            return
          }
        }
      }

      // 성공 시 드롭다운 닫기 및 고객 정보 새로고침
      setResidentStatusDropdownOpen(null)
      await fetchCustomerData()
    } catch (error) {
      console.error('Error updating resident status:', error)
      alert('거주 상태 업데이트에 실패했습니다.')
    }
  }

  // reservation_choices 테이블에서 초이스 정보 가져오기 (그룹 정보 포함)
  const fetchReservationChoices = useCallback(async () => {
    if (!reservation.id) return
    
    try {
      const { data: choicesData, error } = await supabase
        .from('reservation_choices')
        .select(`
          choice_id,
          option_id,
          choice_options!inner (
            option_key,
            option_name,
            option_name_ko
          ),
          product_choices!inner (
            choice_group,
            choice_group_ko
          )
        `)
        .eq('reservation_id', reservation.id)
      
      if (error) {
        console.error('예약 초이스 조회 오류:', error)
        return
      }
      
      if (choicesData && choicesData.length > 0) {
        const choices = choicesData.map((item: any) => ({
          choice_id: item.choice_id,
          option_id: item.option_id,
          option_name: item.choice_options?.option_name,
          option_name_ko: item.choice_options?.option_name_ko,
          option_key: item.choice_options?.option_key,
          choice_group: item.product_choices?.choice_group,
          choice_group_ko: item.product_choices?.choice_group_ko
        }))
        setReservationChoices(choices)
      }
    } catch (error) {
      console.error('예약 초이스 조회 중 오류:', error)
    }
  }, [reservation.id])

  // 컴포넌트 마운트 시 가격 정보, 입금 내역, 채널 정보, 고객 정보 가져오기
  useEffect(() => {
    // 결제 방법 정보 로드
    loadPaymentMethods()
    
    // 동시 요청을 방지하기 위해 예약 ID를 기반으로 일관된 지연 시간 설정
    // 예약 ID의 마지막 문자를 숫자로 변환하여 0-1000ms 사이의 지연 시간 생성
    const reservationIdHash = reservation.id.charCodeAt(reservation.id.length - 1) % 1000
    const delay = reservationIdHash * 2 // 0-2000ms 지연
    
    const timeoutId = setTimeout(() => {
      if (isStaff) {
        fetchReservationPricing()
        // paymentRecords는 필요할 때만 로드하도록 변경 (이미 togglePaymentRecords에서 처리)
        // fetchPaymentRecords()
      }
      fetchChannelInfo()
      fetchCustomerData()
      fetchReservationChoices()
    }, delay)

    return () => clearTimeout(timeoutId)
  }, [isStaff, reservation.id, reservation.customer_id, loadPaymentMethods, fetchReservationPricing, fetchChannelInfo, fetchCustomerData, fetchReservationChoices])

  // 입금 내역 표시 토글
  const togglePaymentRecords = () => {
    if (!showPaymentRecords && paymentRecords.length === 0) {
      fetchPaymentRecords()
    }
    setShowPaymentRecords(!showPaymentRecords)
  }

  // 픽업 정보 저장
  const handleSavePickupInfo = async (reservationId: string, pickupTime: string, pickupHotel: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('인증이 필요합니다.')
      }

      const response = await fetch('/api/reservations/update-pickup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          reservation_id: reservationId,
          pickup_time: pickupTime,
          pickup_hotel: pickupHotel
        })
      })

      if (!response.ok) {
        throw new Error('픽업 정보 저장에 실패했습니다.')
      }

      await response.json()
      
      console.log('픽업 정보가 저장되었습니다:', { reservationId, pickupTime, pickupHotel })

      // 성공 시 부모에 수정된 픽업 정보 전달 후 새로고침 (픽업 스케줄 섹션 즉시 반영)
      if (onRefresh) {
        try {
          await onRefresh({ reservationId, pickup_time: pickupTime, pickup_hotel: pickupHotel })
          console.log('예약 데이터 새로고침 완료')
        } catch (refreshError) {
          console.error('데이터 새로고침 중 오류:', refreshError)
          // 새로고침 실패해도 저장은 성공했으므로 계속 진행
        }
      }
      
    } catch (error) {
      console.error('픽업 정보 저장 오류:', error)
      throw error
    }
  }

  // 언어에 따른 국기 코드 결정
  const getFlagCode = (language: string) => {
    if (!language) return 'US' // 기본값은 미국 국기
    const lang = language.toUpperCase()
    return lang === 'KR' || lang === 'KO' ? 'KR' : 'US'
  }
  
  const flagCode = getFlagCode(customerLanguage)

  // 나중에 사용될 수 있으므로 유지 (현재는 사용되지 않음)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  const getReservationStatusColor = (_status: string): string => {
    switch (_status?.toLowerCase()) {
      case 'confirmed':
        return 'bg-green-100 text-green-800'
      case 'recruiting':
        return 'bg-blue-100 text-blue-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      case 'completed':
        return 'bg-gray-100 text-gray-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }
  
  // 사용하지 않는 함수이지만 나중에 사용될 수 있으므로 유지
  void getReservationStatusColor

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />
      case 'recruiting':
        return <Circle className="w-4 h-4 text-blue-600" />
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-red-600" />
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-gray-600" />
      case 'pending':
        return <AlertCircle className="w-4 h-4 text-yellow-600" />
      default:
        return <Circle className="w-4 h-4 text-gray-600" />
    }
  }

  const getReservationStatusText = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return '확인됨'
      case 'recruiting':
        return '모집 중'
      case 'cancelled':
        return '취소됨'
      case 'completed':
        return '완료됨'
      case 'pending':
        return '대기 중'
      default:
        return status || '알 수 없음'
    }
  }

  // 각 옵션별로 다른 색상을 반환하는 함수 (옵션 ID 기반)
  const getOptionColorClasses = (optionId: string, optionName?: string) => {
    if (!optionId) {
      return {
        bg: 'bg-gray-100',
        text: 'text-gray-800',
        border: 'border-gray-200'
      }
    }
    
    // 풍부한 색상 팔레트
    // 앤텔롭 캐년 초이스: 🏜️ L / 🏜️ X / 🏜️ U 고정 색상 (자동 배정 모달과 동일)
    const name = (optionName || '').trim()
    if (name === '🏜️ L') return { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' }
    if (name === '🏜️ X') return { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-300' }
    if (name === '🏜️ U') return { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' }

    const colorPalette = [
      { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
      { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
      { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
      { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-200' },
      { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-200' },
      { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-200' },
      { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
      { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-200' },
      { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-200' },
      { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200' },
      { bg: 'bg-lime-100', text: 'text-lime-800', border: 'border-lime-200' },
      { bg: 'bg-fuchsia-100', text: 'text-fuchsia-800', border: 'border-fuchsia-200' },
      { bg: 'bg-sky-100', text: 'text-sky-800', border: 'border-sky-200' },
      { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
      { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
      { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' }
    ]
    
    // 옵션 ID의 해시값으로 색상 선택
    let hash = 0
    const idString = optionId + (optionName || '')
    for (let i = 0; i < idString.length; i++) {
      hash = idString.charCodeAt(i) + ((hash << 5) - hash)
    }
    
    return colorPalette[Math.abs(hash) % colorPalette.length]
  }

  const getSelectedChoices = (): Array<{
    name: string
    choice_id: string
    option_id: string
    choice_group?: string
    choice_group_ko?: string
  }> => {
    const selectedChoices: Array<{
      name: string
      choice_id: string
      option_id: string
      choice_group?: string
      choice_group_ko?: string
    }> = []
    
    // 1. reservation_choices 테이블에서 직접 조회한 데이터 사용 (우선순위 1)
    if (reservationChoices.length > 0) {
      reservationChoices.forEach((choice) => {
        const optionName = choice.option_name_ko || 
                          choice.option_name || 
                          choice.option_key || 
                          'Unknown'
        const simplifiedName = simplifyChoiceLabel(optionName)
        const choiceItem: {
          name: string
          choice_id: string
          option_id: string
          choice_group?: string
          choice_group_ko?: string
        } = {
          name: simplifiedName,
          choice_id: choice.choice_id,
          option_id: choice.option_id
        }
        if (choice.choice_group) choiceItem.choice_group = choice.choice_group
        if (choice.choice_group_ko) choiceItem.choice_group_ko = choice.choice_group_ko
        selectedChoices.push(choiceItem)
      })
      return selectedChoices
    }
    
    // 2. reservation.choices JSON 필드에서 파싱 (fallback)
    if (reservation.choices) {
      try {
        const choicesData = safeJsonParse(reservation.choices)
        if (choicesData && typeof choicesData === 'object') {
          const choicesObj = choicesData as Record<string, unknown>
          
          // 새로운 초이스 시스템: required 배열에 choice_id, option_id가 직접 저장된 경우
          if (choicesObj.required && Array.isArray(choicesObj.required)) {
            (choicesObj.required as Array<Record<string, unknown>>).forEach((item) => {
              // 새로운 시스템: choice_id와 option_id가 직접 있는 경우
              if (item.option_id && item.choice_id) {
                // option_id를 사용하여 옵션 이름 찾기
                const optionName = (item.option_name as string) || 
                                  (item.option_name_ko as string) || 
                                  (item.option_key as string) ||
                                  (item.option_id as string) || 
                                  'Unknown'
                const simplifiedName = simplifyChoiceLabel(optionName)
                const choiceItem: {
                  name: string
                  choice_id: string
                  option_id: string
                  choice_group?: string
                  choice_group_ko?: string
                } = {
                  name: simplifiedName,
                  choice_id: item.choice_id as string,
                  option_id: item.option_id as string
                }
                if (item.choice_group && typeof item.choice_group === 'string') {
                  choiceItem.choice_group = item.choice_group
                }
                if (item.choice_group_ko && typeof item.choice_group_ko === 'string') {
                  choiceItem.choice_group_ko = item.choice_group_ko
                }
                selectedChoices.push(choiceItem)
              } 
              // 기존 시스템: choice.options 배열에서 selected/is_default 찾기
              else if (item.options && Array.isArray(item.options)) {
                (item.options as Array<Record<string, unknown>>).forEach((option) => {
                  if (option.selected || option.is_default) {
                    const originalName = (option.name as string) || 
                                       (option.name_ko as string) || 
                                       'Unknown'
                    const simplifiedName = simplifyChoiceLabel(originalName)
                    const choiceItem: {
                      name: string
                      choice_id: string
                      option_id: string
                      choice_group?: string
                      choice_group_ko?: string
                    } = {
                      name: simplifiedName,
                      choice_id: (item.id || item.choice_id || '') as string,
                      option_id: (option.id || option.option_id || '') as string
                    }
                    if (item.group || item.choice_group) {
                      choiceItem.choice_group = (item.group || item.choice_group) as string
                    }
                    if (item.group_ko || item.choice_group_ko) {
                      choiceItem.choice_group_ko = (item.group_ko || item.choice_group_ko) as string
                    }
                    selectedChoices.push(choiceItem)
                  }
                })
              }
            })
          }
        }
      } catch (error) {
        console.error('Error parsing choices:', error)
      }
    }
    
    return selectedChoices
  }

  // 앤텔롭 캐년 관련: 이모지 + L / X / U 로 간단 표시
  const ANTLOPE_EMOJI = '🏜️'

  const simplifyChoiceLabel = (label: string) => {
    if (!label) return label
    const labelLower = label.toLowerCase().trim()
    const labelKo = label.trim()

    // 엑스 앤텔롭 캐년 (Antelope X Canyon) → 🏜️ X
    if (labelLower.includes('antelope x canyon') || /엑스\s*앤텔롭|엑스\s*앤틸롭|엑스\s*엔텔롭/.test(labelKo)) {
      return `${ANTLOPE_EMOJI} X`
    }
    // 로어 앤텔롭 캐년 (Lower Antelope Canyon) → 🏜️ L
    if (labelLower.includes('lower antelope canyon') || /로어\s*앤텔롭|로어\s*앤틸롭|로어\s*엔텔롭/.test(labelKo)) {
      return `${ANTLOPE_EMOJI} L`
    }
    // 어퍼 앤텔롭 (Upper Antelope Canyon) → 🏜️ U
    if (labelLower.includes('upper antelope canyon') || /어퍼\s*앤텔롭|어퍼\s*앤틸롭|어퍼\s*엔텔롭/.test(labelKo)) {
      return `${ANTLOPE_EMOJI} U`
    }
    return label
  }

  const getPickupHotelName = () => {
    if (!reservation.pickup_hotel) return '미정'
    
    // pickup_hotels 테이블에서 호텔 정보 찾기
    const hotelId = reservation.pickup_hotel
    const hotel = pickupHotels.find(h => h.id === hotelId)
    
    if (hotel) {
      return hotel.hotel
    }
    
    // JSON 형태로 저장된 경우 파싱 (fallback)
    // 먼저 JSON인지 확인
    if (typeof reservation.pickup_hotel === 'string' && reservation.pickup_hotel.startsWith('{')) {
      try {
        const hotelData = safeJsonParse(reservation.pickup_hotel)
        if (hotelData && typeof hotelData === 'object') {
          const hotelObj = hotelData as Record<string, unknown>
          return (hotelObj.hotel as string) || (hotelObj.name as string) || '미정'
        }
      } catch (error) {
        console.error('호텔 JSON 파싱 오류:', error)
      }
    }
    
    // 단순 문자열인 경우 그대로 반환
    return reservation.pickup_hotel
  }

  const getPickupLocation = () => {
    if (!reservation.pickup_hotel) return null
    
    // pickup_hotels 테이블에서 픽업 위치 찾기
    const hotelId = reservation.pickup_hotel
    const hotel = pickupHotels.find(h => h.id === hotelId)
    
    if (hotel && hotel.pick_up_location) {
      return hotel.pick_up_location
    }
    
    return null
  }

  const getPickupTime = () => {
    if (!reservation.pickup_time) return '미정'
    
    // 시간에서 초 단위 제거 (HH:MM:SS -> HH:MM)
    const timeStr = reservation.pickup_time
    if (timeStr.includes(':')) {
      const timeParts = timeStr.split(':')
      if (timeParts.length >= 2) {
        return `${timeParts[0]}:${timeParts[1]}`
      }
    }
    
    return timeStr
  }

  // 입금 내역 관련 유틸리티 함수들
  const getStatusColor = (status: string) => {
    if (!status) return 'bg-gray-100 text-gray-800'
    
    const normalizedStatus = status.toLowerCase()
    
    // 수령/완료 상태 (녹색)
    if (normalizedStatus.includes('received') || normalizedStatus.includes('charged')) {
      return 'bg-green-100 text-green-800'
    }
    
    // 환불/삭제 상태 (빨간색)
    if (normalizedStatus.includes('refund') || normalizedStatus.includes('returned') || normalizedStatus.includes('deleted')) {
      return 'bg-red-100 text-red-800'
    }
    
    // 요청 상태 (노란색)
    if (normalizedStatus.includes('requested')) {
      return 'bg-yellow-100 text-yellow-800'
    }
    
    // 기존 값들
    if (normalizedStatus === 'confirmed') {
      return 'bg-green-100 text-green-800'
    }
    if (normalizedStatus === 'rejected') {
      return 'bg-red-100 text-red-800'
    }
    if (normalizedStatus === 'pending') {
      return 'bg-yellow-100 text-yellow-800'
    }
    
    return 'bg-gray-100 text-gray-800'
  }

  const getStatusText = (status: string) => {
    if (!status) return '알 수 없음'
    
    const statusMap: Record<string, string> = {
      'partner received': '파트너 수령',
      'deposit requested': '보증금 요청',
      'deposit received': '보증금 수령',
      'balance received': '잔금 수령',
      'refunded': '환불됨 (우리)',
      "customer's cc charged": '고객 CC 청구 (대행)',
      'deleted': '삭제됨',
      'refund requested': '환불 요청',
      'returned': '환불됨 (파트너)',
      'balance requested': '잔금 요청',
      'commission received !': '수수료 수령 !',
      // 기존 값들도 유지
      'pending': '대기중',
      'confirmed': '확인됨',
      'rejected': '거부됨'
    }
    
    return statusMap[status.toLowerCase()] || status
  }

  const getPaymentMethodText = (method: string) => {
    // payment_methods 테이블에서 조회한 방법명이 있으면 사용
    if (paymentMethodMap[method]) {
      return paymentMethodMap[method]
    }
    
    // 기본 결제 방법 매핑
    switch (method?.toLowerCase()) {
      case 'bank_transfer':
        return '계좌이체'
      case 'cash':
        return '현금'
      case 'card':
        return '카드'
      default:
        return method
    }
  }

  const formatCurrency = (amount: number | null | undefined, currency: string = 'USD') => {
    if (amount === null || amount === undefined) {
      return '$0'
    }
    if (currency === 'KRW') {
      return `₩${amount.toLocaleString()}`
    }
    return `$${amount.toLocaleString()}`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Balance 수령 핸들러
  const handleReceiveBalance = async (e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (!reservationPricing || !isStaff) return
    
    let balanceAmount = 0
    
    // reservation_pricing의 balance_amount가 0보다 크면 우선적으로 사용
    if (reservationPricing.balance_amount) {
      balanceAmount = typeof reservationPricing.balance_amount === 'string'
        ? parseFloat(reservationPricing.balance_amount) || 0
        : (reservationPricing.balance_amount || 0)
    }
    
    // balance_amount가 없거나 0인 경우 계산된 잔금 사용
    if (balanceAmount <= 0) {
      const totalPrice = reservationPricing 
        ? (typeof reservationPricing.total_price === 'string'
            ? parseFloat(reservationPricing.total_price) || 0
            : (reservationPricing.total_price || 0))
        : 0
      
      // 수령된 상태의 레코드만 계산
      const receivedStatuses = ['Deposit Received', 'Balance Received', 'Partner Received', "Customer's CC Charged", 'Commission Received !']
      const totalPaid = paymentRecords
        .filter(record => receivedStatuses.includes(record.payment_status))
        .reduce((sum, record) => {
          const amount = typeof record.amount === 'string'
            ? parseFloat(record.amount) || 0
            : (record.amount || 0)
          return sum + amount
        }, 0)
      
      balanceAmount = totalPrice - totalPaid
    }
    
    if (balanceAmount <= 0) {
      alert('수령할 잔액이 없습니다.')
      return
    }
    
    // 확인 다이얼로그
    if (!confirm(`잔액 ${formatCurrency(balanceAmount, reservationPricing?.currency || 'USD')}을 현금으로 수령하시겠습니까?`)) {
      return
    }
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('인증이 필요합니다.')
      }

      // 1. 입금 내역 생성 (현금)
      const paymentResponse = await fetch('/api/payment-records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          reservation_id: reservation.id,
          payment_status: 'Balance Received',
          amount: balanceAmount,
          payment_method: 'cash',
          note: 'Balance 수령 (관리자)'
        })
      })

      if (!paymentResponse.ok) {
        const errorData = await paymentResponse.json()
        throw new Error(errorData.error || '입금 내역 생성에 실패했습니다.')
      }

      // 2. reservation_pricing의 deposit_amount와 balance_amount 업데이트
      // 먼저 reservation_pricing 레코드 찾기
      const { data: existingPricing, error: pricingFetchError } = await supabase
        .from('reservation_pricing')
        .select('id, deposit_amount')
        .eq('reservation_id', reservation.id)
        .single() as { data: { id: string; deposit_amount?: number | string | null } | null; error: any }

      if (pricingFetchError && pricingFetchError.code !== 'PGRST116') {
        console.error('reservation_pricing 조회 오류:', pricingFetchError)
        // 에러가 발생해도 계속 진행 (레코드가 없을 수도 있음)
      }

      if (existingPricing) {
        // 현재 deposit_amount 값 가져오기
        const currentDepositAmount = typeof existingPricing.deposit_amount === 'string'
          ? parseFloat(existingPricing.deposit_amount) || 0
          : (existingPricing.deposit_amount || 0)
        
        // deposit_amount를 현재 값 + balanceAmount로 업데이트
        // balance_amount를 0으로 업데이트
        const { error: updateError } = await (supabase as any)
          .from('reservation_pricing')
          .update({ 
            deposit_amount: currentDepositAmount + balanceAmount,
            balance_amount: 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingPricing.id)

        if (updateError) {
          console.error('가격 정보 업데이트 오류:', updateError)
          // 업데이트 실패해도 입금 내역은 생성되었으므로 경고만 표시
          alert('입금 내역은 생성되었지만 가격 정보 업데이트에 실패했습니다. 페이지를 새로고침해주세요.')
        }
      }

      // 3. 입금 내역 및 가격 정보 새로고침
      await fetchPaymentRecords()
      await fetchReservationPricing()

      alert('잔액 수령이 완료되었습니다.')
    } catch (error) {
      console.error('Balance 수령 오류:', error)
      alert(error instanceof Error ? error.message : '잔액 수령 중 오류가 발생했습니다.')
    }
  }

  return (
     <div 
       className={`p-3 rounded-lg border transition-colors ${
         isStaff 
           ? 'bg-white hover:bg-gray-50 cursor-pointer' 
           : 'bg-gray-50 cursor-not-allowed'
       }`}
       onClick={() => onEdit && isStaff && !showSimplePickupModal ? onEdit(reservation) : undefined}
     >
      {/* 메인 정보 섹션 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {/* 국가 플래그 - 이름 왼쪽에 배치 */}
          <ReactCountryFlag
            countryCode={flagCode || 'US'}
            svg
            style={{
              width: '20px',
              height: '15px'
            }}
          />
          
          {/* 거주 상태 아이콘 */}
          {isStaff && customerData && (
            <span className="flex-shrink-0 relative resident-status-dropdown">
              {(() => {
                const residentStatus = customerData.resident_status
                
                const getStatusIcon = () => {
                  if (residentStatus === 'us_resident') {
                    return <Home className="h-4 w-4 text-green-600 cursor-pointer hover:scale-110 transition-transform" />
                  } else if (residentStatus === 'non_resident') {
                    return <Plane className="h-4 w-4 text-blue-600 cursor-pointer hover:scale-110 transition-transform" />
                  } else if (residentStatus === 'non_resident_with_pass') {
                    return <PlaneTakeoff className="h-4 w-4 text-purple-600 cursor-pointer hover:scale-110 transition-transform" />
                  } else {
                    return <HelpCircle className="h-4 w-4 text-gray-400 cursor-pointer hover:scale-110 transition-transform" />
                  }
                }

                const getStatusLabel = () => {
                  if (residentStatus === 'us_resident') return '미국 거주자'
                  if (residentStatus === 'non_resident') return '비거주자'
                  if (residentStatus === 'non_resident_with_pass') return '비거주자 (패스 보유)'
                  return '거주 상태 정보 없음'
                }
                
                return (
                  <div className="relative">
                    <div 
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenResidentStatusModal()
                      }}
                      className="relative group"
                    >
                      {getStatusIcon()}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                        {getStatusLabel()} (클릭하여 변경)
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </span>
          )}
          
          {/* 고객 이름 */}
          <p className="font-medium text-sm text-gray-900">{customerName}</p>
          
          {/* 총 인원수 뱃지 - 숫자만 표시 */}
          <div className="flex items-center space-x-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
            <Users size={12} />
            <span>
              {(() => {
                // 필드명이 child/infant일 수도 있고 children/infants일 수도 있음
                const adults = reservation.adults || 0
                const children = (reservation.children || (reservation as any).child || 0) as number
                const infants = (reservation.infants || (reservation as any).infant || 0) as number
                const total = adults + children + infants
                
                return `${total}`
              })()}
            </span>
          </div>
          
          {/* 선택된 Choices 뱃지들 - 각 옵션별 색상 적용 */}
          {getSelectedChoices().map((choice, index) => {
            const colorClasses = getOptionColorClasses(choice.option_id, choice.name)
            
            return (
              <div 
                key={index} 
                className={`px-2 py-1 rounded-full text-xs font-medium ${colorClasses.bg} ${colorClasses.text} border ${colorClasses.border}`}
              >
                {choice.name}
              </div>
            )
          })}
        </div>

        {/* 오른쪽 상단 - 상태 뱃지 */}
        <div className="flex items-center space-x-2">
          {/* 상태 뱃지 - 아이콘으로 표시하고 호버시 텍스트 */}
          {showStatus && reservation.status && (
            <div className="relative group">
              <div className="p-1 rounded-full hover:bg-gray-100 transition-colors">
                {getStatusIcon(reservation.status)}
              </div>
              <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                {getReservationStatusText(reservation.status)}
                <div className="absolute top-full right-2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
              </div>
            </div>
          )}
          
        </div>
      </div>

      {/* 픽업 정보 섹션 */}
      <div className="mt-2 text-xs text-gray-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
             {/* 픽업 시간 수정 버튼 */}
             {isStaff && (
               <button
                 onClick={(e) => {
                   e.stopPropagation()
                   setShowSimplePickupModal(true)
                 }}
                 className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                 title="픽업 시간 수정"
               >
                 <Clock size={12} />
               </button>
             )}
             <span 
               onClick={(e) => {
                 if (isStaff) {
                   e.stopPropagation()
                   setShowSimplePickupModal(true)
                 }
               }}
               className={isStaff ? "cursor-pointer hover:text-blue-700" : ""}
             >
               {getPickupTime()}
             </span>
             {/* 픽업 호텔 수정 버튼 */}
             {isStaff && (
               <button
                 onClick={(e) => {
                   e.stopPropagation()
                   setShowSimplePickupModal(true)
                 }}
                 className="p-1 text-green-500 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
                 title="픽업 호텔 수정"
               >
                 <Building size={12} />
               </button>
             )}
            <span 
              onClick={(e) => {
                if (isStaff) {
                  e.stopPropagation()
                  setShowSimplePickupModal(true)
                }
              }}
              className={isStaff ? "cursor-pointer hover:text-green-700" : ""}
            >
              {getPickupHotelName()}
            </span>
          </div>
          
          {/* 채널 정보 - 두 번째 줄 오른쪽 끝 */}
          <div className="flex items-center space-x-2">
            {/* 채널 정보 */}
            {channelInfo && (
              <div className="flex items-center space-x-1 text-xs text-gray-500">
                {channelInfo.favicon && (
                  <Image 
                    src={channelInfo.favicon} 
                    alt={channelInfo.name}
                    width={12}
                    height={12}
                    className="rounded"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                )}
                <span>{channelInfo.name}</span>
              </div>
            )}
          </div>
        </div>
        
        {/* 금액 계산 섹션 - 별도 줄 */}
        {isStaff && (() => {
          // reservationPricing이 없으면 null 반환
          if (!reservationPricing) {
            return null
          }
          // 숫자로 변환하는 헬퍼 함수
          const toNumber = (value: number | string | null | undefined): number => {
            if (value === null || value === undefined) return 0
            if (typeof value === 'string') return parseFloat(value) || 0
            return value
          }

          const adultPrice = toNumber(reservationPricing.adult_product_price)
          const childPrice = toNumber(reservationPricing.child_product_price)
          const infantPrice = toNumber(reservationPricing.infant_product_price)
          const productPriceTotal = toNumber(reservationPricing.product_price_total)
          const couponDiscount = toNumber(reservationPricing.coupon_discount)
          const additionalDiscount = toNumber(reservationPricing.additional_discount)
          const additionalCost = toNumber(reservationPricing.additional_cost)
          const grandTotal = toNumber(reservationPricing.total_price) || 0
          const commissionPercent = toNumber(reservationPricing.commission_percent)
          const commissionAmount = toNumber(reservationPricing.commission_amount)
          
          // 총 인원수
          const totalPeople = (reservation.adults || 0) + 
        ((reservation.children || (reservation as any).child || 0) as number) + 
        ((reservation.infants || (reservation as any).infant || 0) as number)
          
          // 할인/추가비용 합계
          const discountTotal = couponDiscount + additionalDiscount
          const adjustmentTotal = additionalCost - discountTotal
          
          // 커미션 계산
          // total_price는 판매가격(Grand Total)이고, Net Price는 total_price - commission
          const commissionBasePriceOnly = channelInfo?.commission_base_price_only || false
          
          let calculatedCommission = 0
          let netPrice = grandTotal
          
          if (commissionAmount > 0) {
            // 커미션 금액이 있는 경우
            calculatedCommission = commissionAmount
            netPrice = grandTotal > 0 ? (grandTotal - calculatedCommission) : 0
          } else if (commissionPercent > 0 && grandTotal > 0) {
            if (commissionBasePriceOnly) {
              // commission_base_price_only: 판매가격에만 커미션 적용
              const basePriceForCommission = productPriceTotal - couponDiscount - additionalDiscount + additionalCost
              calculatedCommission = basePriceForCommission * (commissionPercent / 100)
              netPrice = grandTotal > 0 ? (grandTotal - calculatedCommission) : 0
            } else {
              // 일반 채널: 전체 가격에 커미션 적용
              calculatedCommission = grandTotal * (commissionPercent / 100)
              netPrice = grandTotal > 0 ? (grandTotal - calculatedCommission) : 0
            }
          } else {
            // 커미션이 없으면 total_price가 Net Price
            netPrice = grandTotal
          }
          
          // 통화
          const currency = reservationPricing.currency || 'USD'
          const currencySymbol = currency === 'KRW' ? '₩' : '$'
          
          // 계산식 구성 (한 줄 형식: $384 x 1 = $384 - $34.56 = $349.44 - $87.36 = $262.08)
          let calculationString = ''
          
          // grandTotal이 있거나 netPrice가 있으면 무조건 계산식 표시
          if (grandTotal > 0 || netPrice > 0) {
            // 1. 상품가격 x 총인원 = 소계
            let subtotal = productPriceTotal
            if (subtotal === 0 && adultPrice > 0 && totalPeople > 0) {
              const children = (reservation.children || (reservation as any).child || 0) as number
              const infants = (reservation.infants || (reservation as any).infant || 0) as number
              subtotal = adultPrice * (reservation.adults || 0) + childPrice * children + infantPrice * infants
            }
            
            // subtotal이 0이면 grandTotal을 역산하여 추정
            if (subtotal === 0) {
              // 할인/추가비용을 고려하여 역산
              subtotal = grandTotal + discountTotal - additionalCost
              if (subtotal <= 0) {
                subtotal = grandTotal
              }
            }
            
            if (subtotal > 0) {
              const children = (reservation.children || (reservation as any).child || 0) as number
              const infants = (reservation.infants || (reservation as any).infant || 0) as number
              if (totalPeople > 0 && adultPrice > 0 && totalPeople === (reservation.adults || 0) && children === 0 && infants === 0) {
                // 성인만 있는 경우
                calculationString = `${currencySymbol}${adultPrice.toFixed(2)} × ${totalPeople} = ${currencySymbol}${subtotal.toFixed(2)}`
              } else if (totalPeople > 0 && (adultPrice > 0 || childPrice > 0 || infantPrice > 0)) {
                // 여러 연령대가 있는 경우
                const priceParts: string[] = []
                if ((reservation.adults || 0) > 0 && adultPrice > 0) {
                  priceParts.push(`${currencySymbol}${adultPrice.toFixed(2)} × ${reservation.adults || 0}`)
                }
                const children = (reservation.children || (reservation as any).child || 0) as number
                const infants = (reservation.infants || (reservation as any).infant || 0) as number
                if (children > 0 && childPrice > 0) {
                  priceParts.push(`${currencySymbol}${childPrice.toFixed(2)} × ${children}`)
                }
                if (infants > 0 && infantPrice > 0) {
                  priceParts.push(`${currencySymbol}${infantPrice.toFixed(2)} × ${infants}`)
                }
                if (priceParts.length > 0) {
                  calculationString = `${priceParts.join(' + ')} = ${currencySymbol}${subtotal.toFixed(2)}`
                } else {
                  calculationString = `${currencySymbol}${subtotal.toFixed(2)}`
                }
              } else {
                // 인원 정보가 없거나 가격 정보가 없는 경우
                calculationString = `${currencySymbol}${subtotal.toFixed(2)}`
              }
            } else {
              // subtotal이 0이면 grandTotal부터 시작
              calculationString = `${currencySymbol}${grandTotal.toFixed(2)}`
            }
            
            // 2. 소계 - 할인/추가비용 = grand total (이전 결과를 이어서)
            // grandTotal < subtotal이면 total_price가 넷가격으로 저장된 경우이므로 " = grandTotal" 추가하지 않음 (수수료 이중 차감 방지)
            const skipMiddleGrandTotal = subtotal > 0 && grandTotal < subtotal - 0.01
            if (adjustmentTotal !== 0 && calculationString) {
              if (adjustmentTotal > 0) {
                // 추가비용이 있는 경우
                calculationString += ` + ${currencySymbol}${adjustmentTotal.toFixed(2)} = ${currencySymbol}${grandTotal.toFixed(2)}`
              } else {
                // 할인이 있는 경우
                calculationString += ` - ${currencySymbol}${Math.abs(adjustmentTotal).toFixed(2)} = ${currencySymbol}${grandTotal.toFixed(2)}`
              }
            } else if (calculationString && subtotal > 0 && Math.abs(subtotal - grandTotal) > 0.01 && !skipMiddleGrandTotal) {
              calculationString += ` = ${currencySymbol}${grandTotal.toFixed(2)}`
            } else if (!calculationString) {
              calculationString = `${currencySymbol}${grandTotal.toFixed(2)}`
            }
            
            // 3. (소계 또는 grand total) - commission = Net price
            // skipMiddleGrandTotal인 경우 표시용 넷가격 = subtotal - commission (수수료 1회만 차감)
            const displayNetPrice = skipMiddleGrandTotal && calculatedCommission > 0
              ? subtotal - calculatedCommission
              : netPrice
            if (calculatedCommission > 0 && calculationString) {
              calculationString += ` - ${currencySymbol}${calculatedCommission.toFixed(2)} = ${currencySymbol}${displayNetPrice.toFixed(2)}`
            } else if (calculationString && Math.abs(grandTotal - netPrice) > 0.01) {
              calculationString += ` = ${currencySymbol}${netPrice.toFixed(2)}`
            } else if (!calculationString) {
              calculationString = `${currencySymbol}${netPrice.toFixed(2)}`
            }
          }
          
          // 계산식이 비어있으면 grandTotal과 commission으로 기본 계산식 생성
          if (!calculationString || calculationString.trim() === '') {
            if (grandTotal > 0) {
              if (calculatedCommission > 0) {
                calculationString = `${currencySymbol}${grandTotal.toFixed(2)} - ${currencySymbol}${calculatedCommission.toFixed(2)} = ${currencySymbol}${netPrice.toFixed(2)}`
              } else {
                calculationString = `${currencySymbol}${grandTotal.toFixed(2)} = ${currencySymbol}${netPrice.toFixed(2)}`
              }
            } else if (netPrice > 0) {
              calculationString = `${currencySymbol}${netPrice.toFixed(2)}`
            }
          }
          
          // 계산식이 여전히 비어있으면 최소한 Net Price라도 표시
          if (!calculationString || calculationString.trim() === '') {
            calculationString = `${currencySymbol}${netPrice.toFixed(2)}`
          }
          
          return (
            <div className="mt-1 text-xs text-gray-700">
              <div className="text-gray-600 break-words font-medium">
                {calculationString}
              </div>
            </div>
          )
        })()}
        
        {/* 3번째 줄 - pickup_location과 잔액 정보, 액션 버튼들 */}
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center space-x-3">
            {/* 픽업 위치 */}
            <div className="text-xs text-gray-400">
              {getPickupLocation() || ''}
            </div>
            
            {/* 잔액 뱃지 및 수령 버튼 - balance_amount가 0보다 클 때만 보라색으로 표시 */}
            {isStaff && (() => {
              // reservation_pricing의 balance_amount가 0보다 클 때만 표시
              if (reservationPricing?.balance_amount !== null && reservationPricing?.balance_amount !== undefined) {
                const balanceAmount = typeof reservationPricing.balance_amount === 'string'
                  ? parseFloat(reservationPricing.balance_amount) || 0
                  : (reservationPricing.balance_amount || 0)
                
                // balance_amount가 0보다 클 때만 보라색 뱃지와 보라색 수령 버튼 표시
                if (balanceAmount > 0) {
                  return (
                    <div className="flex items-center space-x-2">
                      <div className="px-2 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200">
                        {formatCurrency(balanceAmount, reservationPricing?.currency || 'USD')}
                      </div>
                      <button
                        onClick={handleReceiveBalance}
                        className="px-2 py-1 text-xs font-medium bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors flex items-center space-x-1"
                        title="Balance 수령"
                      >
                        <Wallet size={12} />
                        <span>수령</span>
                      </button>
                    </div>
                  )
                }
              }
              
              // balance_amount가 0이거나 null/undefined이면 아무것도 표시하지 않음
              return null
            })()}
          </div>
          
          {/* 오른쪽 액션 버튼들 */}
          <div className="flex items-center space-x-1">
            {/* 입금 내역 버튼 */}
            {isStaff && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  togglePaymentRecords()
                }}
                className="p-1 text-green-600 hover:bg-green-50 rounded"
                title="입금 내역 보기"
              >
                <DollarSign size={14} />
              </button>
            )}

            {/* 후기 관리 버튼 */}
            {isStaff && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowReviewModal(true)
                }}
                className="p-1 text-purple-600 hover:bg-purple-50 rounded"
                title="후기 관리"
              >
                <MessageSquare size={14} />
              </button>
            )}

            {/* 액션 버튼들 */}
            {showActions && isStaff && (
              <>
                {onAssign && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onAssign(reservation.id)
                    }}
                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                    title="이 투어로 배정"
                  >
                    <Check size={14} />
                  </button>
                )}
                
                {onUnassign && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onUnassign(reservation.id)
                    }}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                    title="배정 해제"
                  >
                    <X size={14} />
                  </button>
                )}
                
                {onReassign && reservation.tour_id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (reservation.tour_id) {
                        onReassign(reservation.id, reservation.tour_id)
                      }
                    }}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                    title="다른 투어로 재배정"
                  >
                    <Check size={14} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* 투어 정보 섹션 */}
      {showTourInfo && reservation.tour_id && (
        <div className="mt-2 flex items-center space-x-2">
          {/* 투어 정보 */}
          <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
            투어 배정됨
          </span>
        </div>
      )}

      {/* 입금 내역 섹션 */}
      {showPaymentRecords && isStaff && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-700">입금 내역</h4>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowPaymentRecords(false)
              }}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              접기
            </button>
          </div>
          
          {loadingPayments ? (
            <div className="text-center py-2">
              <div className="text-sm text-gray-500">입금 내역을 불러오는 중...</div>
            </div>
          ) : paymentRecords.length === 0 ? (
            <div className="text-center py-2">
              <div className="text-sm text-gray-500">입금 내역이 없습니다</div>
            </div>
          ) : (
            <div className="space-y-2">
              {paymentRecords.map((record) => (
                <div key={record.id} className="bg-gray-50 border border-gray-200 rounded p-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getStatusColor(record.payment_status)}`}>
                        {getStatusText(record.payment_status)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {getPaymentMethodText(record.payment_method)}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-gray-900">
                        {formatCurrency(record.amount, 'USD')}
                      </div>
                      {record.amount_krw && (
                        <div className="text-xs text-gray-600">
                          {formatCurrency(record.amount_krw, 'KRW')}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {formatDate(record.submit_on)}
                  </div>
                  {record.note && (
                    <div className="text-xs text-gray-600 mt-1 truncate">
                      {record.note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
         </div>
       )}

       {/* 간단한 픽업 수정 모달 */}
       <SimplePickupEditModal
         isOpen={showSimplePickupModal}
         reservation={reservation}
         pickupHotels={pickupHotels}
         onSave={handleSavePickupInfo}
         onClose={() => setShowSimplePickupModal(false)}
         getCustomerName={getCustomerName}
       />

       {/* 거주 상태별 인원 수 설정 모달 */}
       {showResidentStatusModal && (
         <div 
           className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
           onClick={(e) => {
             if (e.target === e.currentTarget) {
               setShowResidentStatusModal(false)
             }
           }}
         >
           <div 
             className="bg-white rounded-lg p-6 w-full max-w-md"
             onClick={(e) => e.stopPropagation()}
           >
             <div className="flex items-center justify-between mb-4">
               <h3 className="text-lg font-semibold text-gray-900">
                 거주 상태별 인원 수 설정
               </h3>
               <button
                 onClick={() => setShowResidentStatusModal(false)}
                 className="text-gray-400 hover:text-gray-600"
               >
                 <X className="h-5 w-5" />
               </button>
             </div>

             <div className="space-y-4">
               {/* 총 인원 표시 */}
               <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                 <div className="text-sm font-medium text-blue-900">
                   총 인원: {(reservation.adults || 0) + 
                     ((reservation.children || (reservation as any).child || 0) as number) + 
                     ((reservation.infants || (reservation as any).infant || 0) as number)}명
                 </div>
               </div>

               {/* 미국 거주자 */}
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-2">
                   <span className="inline-flex items-center">
                     <span className="w-3 h-3 rounded-full bg-green-600 mr-2"></span>
                     미국 거주자
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
                      residentStatusCounts.nonResident,
                      residentStatusCounts.nonResidentUnder16
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
                     비거주자
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
                     비 거주자 (16세 이하)
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
                     비거주자 (패스 보유) (패스 장수)
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
                      residentStatusCounts.nonResident,
                      residentStatusCounts.nonResidentUnder16
                    )
                     setResidentStatusCounts(prev => ({ 
                       ...prev, 
                       nonResidentWithPass: newPassCount,
                       passCoveredCount: actualPassCovered // 패스 장수와 실제 예약 인원에 따라 자동 계산
                     }))
                   }}
                   min="0"
                   className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                   placeholder="실제 보유한 패스 장수 입력"
                 />
                 <p className="text-xs text-gray-500 mt-1">
                   패스 {residentStatusCounts.nonResidentWithPass}장 = {calculateActualPassCovered(residentStatusCounts.nonResidentWithPass, residentStatusCounts.usResident, residentStatusCounts.nonResident, residentStatusCounts.nonResidentUnder16)}인 커버 (최대 {residentStatusCounts.nonResidentWithPass * 4}인 가능)
                 </p>
               </div>

               {/* 패스로 커버되는 인원 수 - 자동 계산 표시 */}
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-2">
                   패스로 커버되는 인원 수 (자동 계산)
                 </label>
                 <input
                   type="number"
                   value={residentStatusCounts.passCoveredCount}
                   readOnly
                   className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed"
                 />
                 <p className="text-xs text-gray-500 mt-1">
                   패스 1장당 4인 커버 (실제 예약 인원과 패스 최대 커버 인원 중 작은 값)
                 </p>
               </div>

               {/* 합계 확인 */}
               <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                 <div className="text-sm text-gray-700">
                   거주 상태별 합계: {residentStatusCounts.usResident + residentStatusCounts.nonResident + residentStatusCounts.nonResidentUnder16 + residentStatusCounts.passCoveredCount}명
                 </div>
                 <div className="text-xs text-gray-600 mt-1">
                   (미국 거주자: {residentStatusCounts.usResident}명, 비거주자: {residentStatusCounts.nonResident}명, 비 거주자 16세 이하: {residentStatusCounts.nonResidentUnder16}명, 패스 커버: {residentStatusCounts.passCoveredCount}명)
                 </div>
                 {(residentStatusCounts.usResident + residentStatusCounts.nonResident + residentStatusCounts.nonResidentUnder16 + residentStatusCounts.passCoveredCount) !== 
                  ((reservation.adults || 0) + 
                    ((reservation.children || (reservation as any).child || 0) as number) + 
                    ((reservation.infants || (reservation as any).infant || 0) as number)) && (
                  <div className="text-xs text-orange-600 mt-1">
                    ⚠️ 총 인원과 일치하지 않습니다
                  </div>
                )}
               </div>

               {/* 버튼 */}
               <div className="flex justify-end space-x-2 pt-4">
                 <button
                   onClick={() => setShowResidentStatusModal(false)}
                   className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                 >
                   취소
                 </button>
                 <button
                   onClick={handleSaveResidentStatusCounts}
                   className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                 >
                   저장
                 </button>
               </div>
             </div>
          </div>
        </div>
      )}

      {/* 후기 관리 모달 */}
      {showReviewModal && (
        <ReviewManagementModal
          reservationId={reservation.id}
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
        />
      )}
    </div>
  )
}

// 후기 관리 모달 컴포넌트
function ReviewManagementModal({
  reservationId,
  isOpen,
  onClose
}: {
  reservationId: string
  isOpen: boolean
  onClose: () => void
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-xl font-semibold text-gray-900">후기 관리</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <ReviewManagementSection reservationId={reservationId} />
        </div>
      </div>
    </div>
  )
}
