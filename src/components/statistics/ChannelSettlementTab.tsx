'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { DollarSign, Users, Calendar, Search, ChevronDown, ChevronRight, X, Filter } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useReservationData } from '@/hooks/useReservationData'
import { getChannelName, getProductName, getCustomerName, getStatusColor } from '@/utils/reservationUtils'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import ReservationForm from '@/components/reservation/ReservationForm'
import { autoCreateOrUpdateTour } from '@/lib/tourAutoCreation'
import type { Reservation } from '@/types/reservation'

interface ChannelSettlementTabProps {
  dateRange: { start: string; end: string }
  /** 채널 필터 (부모/URL과 연동). 변경 시 onChannelChange 호출 */
  selectedChannelId?: string
  onChannelChange?: (channelId: string) => void
  selectedStatuses: string[]
  searchQuery?: string
  /** team.position === 'super' 일 때만 Audit 체크박스 클릭 가능 */
  isSuper?: boolean
}

interface ChannelGroup {
  type: 'OTA' | 'SELF'
  label: string
  channels: Array<{ id: string; name: string; type?: string; category?: string }>
}

interface ReservationItem {
  id: string
  tourDate: string
  registrationDate: string
  customerId: string
  customerName: string
  productId: string
  productName: string
  totalPeople: number
  adults: number
  child: number
  infant: number
  status: string
  channelRN: string
  channelId?: string
  channelName?: string
  totalPrice: number
  adultPrice?: number
  productPriceTotal?: number
  optionTotal?: number
  subtotal?: number
  commissionAmount?: number
  couponDiscount?: number
  additionalDiscount?: number
  additionalCost?: number
  tax?: number
  depositAmount?: number
  balanceAmount?: number
  /** 입금내역 (Partner Received) 합계 */
  partnerReceivedAmount?: number
  /** 채널 정산 금액 (예약 가격 계산과 동일) */
  channelSettlementAmount?: number
  amountAudited?: boolean
  amountAuditedAt?: string | null
  amountAuditedBy?: string | null
}

// TourItem을 ReservationItem과 동일하게 사용
// 배포/team 조회 실패 시에도 Audit 가능하도록 Super 관리자 이메일 직접 확인
const SUPER_ADMIN_EMAILS = ['wooyong.shim09@gmail.com']

export default function ChannelSettlementTab({ dateRange, selectedChannelId = '', onChannelChange, selectedStatuses, searchQuery = '', isSuper = false }: ChannelSettlementTabProps) {
  const t = useTranslations('reservations')
  const { authUser } = useAuth()
  const isSuperByEmail = Boolean(
    authUser?.email && SUPER_ADMIN_EMAILS.some((e) => e.toLowerCase() === authUser.email!.toLowerCase().trim())
  )
  const canAudit = isSuper || isSuperByEmail

  const {
    reservations,
    customers,
    products,
    channels,
    productOptions,
    options,
    pickupHotels,
    coupons,
    refreshReservations,
    refreshCustomers,
    loading: reservationsLoading
  } = useReservationData()
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null)
  const [toursLoading, setToursLoading] = useState(false)
  const [tourItems, setTourItems] = useState<ReservationItem[]>([])
  const [reservationPrices, setReservationPrices] = useState<Record<string, number>>({})
  const [reservationPricingData, setReservationPricingData] = useState<Record<string, {
    adultPrice: number
    productPriceTotal: number
    optionTotal: number
    subtotal: number
    commissionAmount: number
    couponDiscount: number
    additionalDiscount: number
    additionalCost: number
    tax: number
    depositAmount: number
    balanceAmount: number
    choicesTotal: number
  }>>({})
  const [pricesLoading, setPricesLoading] = useState(false)
  const [activeDetailTab, setActiveDetailTab] = useState<'reservations' | 'tours'>('reservations')
  const [reservationSortOrder, setReservationSortOrder] = useState<'asc' | 'desc'>('asc')
  const [tourSortOrder, setTourSortOrder] = useState<'asc' | 'desc'>('asc')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set())
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false)
  const channelFilter = selectedChannelId ?? ''
  const [partnerReceivedByReservation, setPartnerReceivedByReservation] = useState<Record<string, number>>({})
  const [reservationAudit, setReservationAudit] = useState<Record<string, { amount_audited: boolean; amount_audited_at: string | null; amount_audited_by: string | null }>>({})

  // 예약 클릭 시 수정 모달 열기
  const openReservationEditModal = useCallback((reservationId: string) => {
    const reservation = reservations.find(r => r.id === reservationId)
    setEditingReservation(reservation ? (reservation as Reservation) : null)
  }, [reservations])

  const handleEditReservation = useCallback(async (reservation: Omit<Reservation, 'id'>) => {
    if (!editingReservation) return
    try {
      const reservationData = {
        customer_id: reservation.customerId,
        product_id: reservation.productId,
        tour_date: reservation.tourDate,
        tour_time: reservation.tourTime || null,
        event_note: reservation.eventNote,
        pickup_hotel: reservation.pickUpHotel,
        pickup_time: reservation.pickUpTime || null,
        adults: reservation.adults,
        child: reservation.child,
        infant: reservation.infant,
        total_people: reservation.totalPeople,
        channel_id: reservation.channelId,
        channel_rn: reservation.channelRN,
        added_by: reservation.addedBy,
        tour_id: reservation.tourId,
        status: reservation.status,
        selected_options: reservation.selectedOptions,
        selected_option_prices: reservation.selectedOptionPrices,
        is_private_tour: reservation.isPrivateTour || false,
        choices: reservation.choices,
        variant_key: (reservation as any).variantKey || 'default'
      }
      const { error } = await (supabase as any).from('reservations').update(reservationData as any).eq('id', editingReservation.id)
      if (error) {
        alert(t('messages.reservationUpdateError') + error.message)
        return
      }
      try {
        await supabase.from('reservation_choices').delete().eq('reservation_id', editingReservation.id)
        let choicesToSave: Array<{ reservation_id: string; choice_id: string; option_id: string; quantity: number; total_price: number }> = []
        if (Array.isArray((reservation as any).selectedChoices) && (reservation as any).selectedChoices.length > 0) {
          for (const choice of (reservation as any).selectedChoices) {
            if (choice.choice_id && choice.option_id) {
              choicesToSave.push({
                reservation_id: editingReservation.id,
                choice_id: choice.choice_id,
                option_id: choice.option_id,
                quantity: choice.quantity || 1,
                total_price: choice.total_price !== undefined && choice.total_price !== null ? Number(choice.total_price) : 0
              })
            }
          }
        }
        if (choicesToSave.length === 0 && reservation.choices?.required && Array.isArray(reservation.choices.required)) {
          for (const choice of reservation.choices.required) {
            if (choice.choice_id && choice.option_id) {
              choicesToSave.push({
                reservation_id: editingReservation.id,
                choice_id: choice.choice_id,
                option_id: choice.option_id,
                quantity: choice.quantity || 1,
                total_price: choice.total_price || 0
              })
            }
          }
        }
        if (choicesToSave.length > 0) {
          await (supabase as any).from('reservation_choices').insert(choicesToSave)
        }
      } catch {
        // 초이스 저장 실패해도 예약 수정은 성공
      }
      try {
        await supabase.from('reservation_customers').delete().eq('reservation_id', editingReservation.id)
        const reservationCustomers: any[] = []
        let orderIndex = 0
        const usResidentCount = (reservation as any).usResidentCount || 0
        for (let i = 0; i < usResidentCount; i++) {
          reservationCustomers.push({ reservation_id: editingReservation.id, customer_id: reservation.customerId, resident_status: 'us_resident', pass_covered_count: 0, order_index: orderIndex++ })
        }
        const nonResidentCount = (reservation as any).nonResidentCount || 0
        for (let i = 0; i < nonResidentCount; i++) {
          reservationCustomers.push({ reservation_id: editingReservation.id, customer_id: reservation.customerId, resident_status: 'non_resident', pass_covered_count: 0, order_index: orderIndex++ })
        }
        const nonResidentUnder16Count = (reservation as any).nonResidentUnder16Count || 0
        for (let i = 0; i < nonResidentUnder16Count; i++) {
          reservationCustomers.push({ reservation_id: editingReservation.id, customer_id: reservation.customerId, resident_status: 'non_resident_under_16', pass_covered_count: 0, order_index: orderIndex++ })
        }
        const nonResidentWithPassCount = (reservation as any).nonResidentWithPassCount || 0
        for (let i = 0; i < nonResidentWithPassCount; i++) {
          reservationCustomers.push({ reservation_id: editingReservation.id, customer_id: reservation.customerId, resident_status: 'non_resident_with_pass', pass_covered_count: 4, order_index: orderIndex++ })
        }
        if (reservationCustomers.length > 0) {
          await supabase.from('reservation_customers').insert(reservationCustomers as any)
        }
      } catch {
        // reservation_customers 실패해도 예약 수정은 성공
      }
      if (reservation.pricingInfo) {
        try {
          const pricingInfo = reservation.pricingInfo as any
          await supabase.from('reservation_pricing').upsert({
            reservation_id: editingReservation.id,
            adult_product_price: pricingInfo.adultProductPrice,
            child_product_price: pricingInfo.childProductPrice,
            infant_product_price: pricingInfo.infantProductPrice,
            product_price_total: pricingInfo.productPriceTotal,
            not_included_price: pricingInfo.not_included_price || 0,
            required_options: pricingInfo.requiredOptions,
            required_option_total: pricingInfo.requiredOptionTotal,
            choices: pricingInfo.choices || {},
            choices_total: pricingInfo.choicesTotal || 0,
            subtotal: pricingInfo.subtotal,
            coupon_code: pricingInfo.couponCode,
            coupon_discount: pricingInfo.couponDiscount,
            additional_discount: pricingInfo.additionalDiscount,
            additional_cost: pricingInfo.additionalCost,
            card_fee: pricingInfo.cardFee,
            tax: pricingInfo.tax,
            prepayment_cost: pricingInfo.prepaymentCost,
            prepayment_tip: pricingInfo.prepaymentTip,
            selected_options: pricingInfo.selectedOptionalOptions,
            option_total: pricingInfo.optionTotal,
            total_price: pricingInfo.totalPrice,
            deposit_amount: pricingInfo.depositAmount,
            balance_amount: pricingInfo.balanceAmount,
            private_tour_additional_cost: pricingInfo.privateTourAdditionalCost,
            commission_percent: pricingInfo.commission_percent || 0,
            commission_amount: pricingInfo.commission_amount || 0
          } as any, { onConflict: 'reservation_id', ignoreDuplicates: false })
        } catch {
          // 가격 저장 실패해도 예약 수정은 성공
        }
      }
      try {
        await autoCreateOrUpdateTour(reservation.productId, reservation.tourDate, editingReservation.id, reservation.isPrivateTour)
      } catch {
        // 투어 생성 실패해도 예약 수정은 성공
      }
      await refreshReservations()
      setEditingReservation(null)
      alert(t('messages.reservationUpdated'))
    } catch (error) {
      console.error('Error updating reservation:', error)
      alert(t('messages.reservationUpdateError') + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }, [editingReservation, refreshReservations, t])

  // 금액 Audit 체크박스 토글 (Net Price vs 입금내역 더블체크 기록)
  const handleToggleAmountAudit = useCallback(async (reservationId: string, checked: boolean) => {
    try {
      const payload: { amount_audited: boolean; amount_audited_at: string | null; amount_audited_by: string | null } = checked
        ? { amount_audited: true, amount_audited_at: new Date().toISOString(), amount_audited_by: authUser?.email ?? null }
        : { amount_audited: false, amount_audited_at: null, amount_audited_by: null }
      const { error } = await (supabase as any).from('reservations').update(payload).eq('id', reservationId)
      if (error) {
        alert('Audit 상태 저장 오류: ' + error.message)
        return
      }
      setReservationAudit(prev => ({ ...prev, [reservationId]: { amount_audited: payload.amount_audited, amount_audited_at: payload.amount_audited_at, amount_audited_by: payload.amount_audited_by } }))
    } catch (err) {
      console.error('handleToggleAmountAudit:', err)
      alert('Audit 상태 저장 중 오류가 발생했습니다.')
    }
  }, [authUser?.email])

  const handleDeleteReservation = useCallback(async (id: string) => {
    if (!confirm(t('deleteConfirm'))) return
    try {
      const { error } = await supabase.from('reservations').delete().eq('id', id)
      if (error) {
        alert('예약 삭제 중 오류가 발생했습니다: ' + error.message)
        return
      }
      await refreshReservations()
      setEditingReservation(null)
      alert('예약이 성공적으로 삭제되었습니다!')
    } catch (error) {
      console.error('Error deleting reservation:', error)
      alert('예약 삭제 중 오류가 발생했습니다.')
    }
  }, [refreshReservations, t])

  // 채널 그룹화
  const channelGroups = useMemo((): ChannelGroup[] => {
    if (!channels || channels.length === 0) return []
    
    const otaChannels = channels.filter(channel => {
      const type = (channel.type || '').toLowerCase()
      const category = (channel.category || '').toLowerCase()
      return type === 'ota' || category === 'ota'
    })
    
    const selfChannels = channels.filter(channel => {
      const type = (channel.type || '').toLowerCase()
      const category = (channel.category || '').toLowerCase()
      return type === 'self' || type === 'partner' || category === 'own' || category === 'self' || category === 'partner'
    })
    
    return [
      {
        type: 'OTA',
        label: 'OTA 채널',
        channels: otaChannels
      },
      {
        type: 'SELF',
        label: '자체 채널',
        channels: selfChannels
      }
    ].filter(group => group.channels.length > 0)
  }, [channels])

  // 그룹 토글
  const toggleGroup = (groupType: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupType)) {
        next.delete(groupType)
        // 그룹이 닫힐 때 하위 채널도 모두 닫기
        const group = channelGroups.find(g => g.type === groupType)
        if (group) {
          group.channels.forEach(ch => setExpandedChannels(prevCh => {
            const nextCh = new Set(prevCh)
            nextCh.delete(ch.id)
            return nextCh
          }))
        }
      } else {
        next.add(groupType)
      }
      return next
    })
  }

  // 채널 토글
  const toggleChannel = (channelId: string) => {
    setExpandedChannels(prev => {
      const next = new Set(prev)
      if (next.has(channelId)) {
        next.delete(channelId)
      } else {
        next.add(channelId)
      }
      return next
    })
  }

  // 예약 내역 필터링 (등록일 기준, 상태 필터, 검색 필터, 채널 필터)
  const filteredReservations = useMemo(() => {
    return reservations.filter(reservation => {
      // 채널 필터 (선택된 경우에만)
      if (channelFilter && reservation.channelId !== channelFilter) return false
      
      // 상태 필터 (선택된 경우에만)
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(reservation.status)) return false
      
      // 등록일 필터 (addedTime 기준)
      const registrationDate = new Date(reservation.addedTime)
      const startDate = new Date(dateRange.start)
      const endDate = new Date(dateRange.end)
      endDate.setHours(23, 59, 59, 999) // 하루의 끝까지 포함
      
      if (!(registrationDate >= startDate && registrationDate <= endDate)) return false

      // 검색 필터
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        // 고객명 검색
        const customerName = getCustomerName(reservation.customerId, customers || []).toLowerCase()
        // 채널RN 검색
        const channelRN = reservation.channelRN?.toLowerCase() || ''
        // 상품명 검색
        const productName = getProductName(reservation.productId, products || []).toLowerCase()
        // 투어 날짜 검색
        const tourDate = new Date(reservation.tourDate).toLocaleDateString('ko-KR')
        // 등록일 검색
        const regDate = registrationDate.toLocaleDateString('ko-KR')
        
        if (
          !customerName.includes(query) &&
          !channelRN.includes(query) &&
          !productName.includes(query) &&
          !tourDate.includes(query) &&
          !regDate.includes(query)
        ) {
          return false
        }
      }

      return true
    })
  }, [reservations, selectedStatuses, dateRange, searchQuery, customers, products, channelFilter])

  // 채널별로 예약 필터링하는 헬퍼 함수
  const getReservationsByChannel = useCallback((channelId: string) => {
    return filteredReservations.filter(reservation => reservation.channelId === channelId)
  }, [filteredReservations])

  // 투어 아이템을 채널별로 필터링하는 헬퍼 함수
  const getTourItemsByChannel = useCallback((channelId: string) => {
    return tourItems.filter(item => item.channelId === channelId)
  }, [tourItems])

  // 예약 가격 정보 가져오기
  useEffect(() => {
    const fetchPrices = async () => {
      if (filteredReservations.length === 0) {
        setReservationPrices({})
        return
      }

      setPricesLoading(true)
      try {
        const reservationIds = filteredReservations.map(r => r.id)
        if (reservationIds.length === 0) {
          setReservationPrices({})
          setReservationPricingData({})
          setPricesLoading(false)
          return
        }

        const pricesMap: Record<string, number> = {}
        const pricingDataMap: Record<string, {
          adultPrice: number
          productPriceTotal: number
          optionTotal: number
          subtotal: number
          commissionAmount: number
          couponDiscount: number
          additionalDiscount: number
          additionalCost: number
          tax: number
          depositAmount: number
          balanceAmount: number
          choicesTotal: number
        }> = {}

        // URL 길이 제한을 피하기 위해 청크 단위로 나눠서 요청 (한 번에 최대 100개씩)
        const chunkSize = 100
        for (let i = 0; i < reservationIds.length; i += chunkSize) {
          const chunk = reservationIds.slice(i, i + chunkSize)
          
          const { data: pricingData, error } = await supabase
            .from('reservation_pricing')
            .select('reservation_id, total_price, adult_product_price, product_price_total, option_total, subtotal, commission_amount, coupon_discount, additional_discount, additional_cost, tax, deposit_amount, balance_amount, choices_total')
            .in('reservation_id', chunk)

          if (error) {
            console.error('예약 가격 조회 오류 (청크):', error, { chunkSize: chunk.length, chunkIndex: i / chunkSize })
            continue // 다음 청크 계속 처리
          }

          pricingData?.forEach((p: any) => {
            pricesMap[p.reservation_id] = p.total_price || 0
            pricingDataMap[p.reservation_id] = {
              adultPrice: p.adult_product_price || 0,
              productPriceTotal: p.product_price_total || 0,
              optionTotal: p.option_total || 0,
              subtotal: p.subtotal || 0,
              commissionAmount: p.commission_amount || 0,
              couponDiscount: p.coupon_discount || 0,
              additionalDiscount: p.additional_discount || 0,
              additionalCost: p.additional_cost || 0,
              tax: p.tax || 0,
              depositAmount: p.deposit_amount || 0,
              balanceAmount: p.balance_amount || 0,
              choicesTotal: p.choices_total ?? 0
            }
          })
        }

        // 입금내역 (Partner Received) 합계 조회
        const partnerReceivedMap: Record<string, number> = {}
        for (let i = 0; i < reservationIds.length; i += chunkSize) {
          const chunk = reservationIds.slice(i, i + chunkSize)
          const { data: paymentData } = await supabase
            .from('payment_records')
            .select('reservation_id, amount')
            .in('reservation_id', chunk)
            .eq('payment_status', 'Partner Received')
          paymentData?.forEach((row: { reservation_id: string; amount: number | null }) => {
            const rid = row.reservation_id
            const amt = row.amount ?? 0
            partnerReceivedMap[rid] = (partnerReceivedMap[rid] ?? 0) + amt
          })
        }
        setPartnerReceivedByReservation(prev => ({ ...prev, ...partnerReceivedMap }))

        // 금액 Audit 여부 조회 (amount_audited, amount_audited_at, amount_audited_by)
        const auditMap: Record<string, { amount_audited: boolean; amount_audited_at: string | null; amount_audited_by: string | null }> = {}
        try {
          for (let i = 0; i < reservationIds.length; i += chunkSize) {
            const chunk = reservationIds.slice(i, i + chunkSize)
            const { data: auditData } = await supabase
              .from('reservations')
              .select('id, amount_audited, amount_audited_at, amount_audited_by')
              .in('id', chunk)
            auditData?.forEach((row: any) => {
              auditMap[row.id] = {
                amount_audited: !!row.amount_audited,
                amount_audited_at: row.amount_audited_at ?? null,
                amount_audited_by: row.amount_audited_by ?? null
              }
            })
          }
          setReservationAudit(prev => ({ ...prev, ...auditMap }))
        } catch {
          // 컬럼 미존재 시 무시
        }

        setReservationPrices(pricesMap)
        setReservationPricingData(pricingDataMap)
      } catch (error) {
        console.error('예약 가격 정보 가져오기 오류:', error)
        setReservationPrices({})
        setReservationPricingData({})
      } finally {
        setPricesLoading(false)
      }
    }

    fetchPrices()
  }, [filteredReservations])

  // 예약 내역 데이터 포맷팅 및 정렬 (등록일 기준)
  const reservationItems = useMemo<ReservationItem[]>(() => {
    const items = filteredReservations.map(reservation => {
      const pricing = reservationPricingData[reservation.id] || {
        adultPrice: 0,
        productPriceTotal: 0,
        optionTotal: 0,
        subtotal: 0,
        commissionAmount: 0,
        couponDiscount: 0,
        additionalDiscount: 0,
        additionalCost: 0,
        tax: 0,
        depositAmount: 0,
        balanceAmount: 0,
        choicesTotal: 0
      }
      const productSubtotal = (pricing.productPriceTotal || 0) - Math.abs(pricing.couponDiscount || 0)
      const channelSettlementAmount = Math.max(0, productSubtotal - (pricing.choicesTotal ?? 0) - (pricing.commissionAmount || 0))
      return {
        id: reservation.id,
        tourDate: reservation.tourDate,
        registrationDate: reservation.addedTime,
        customerId: reservation.customerId,
        customerName: getCustomerName(reservation.customerId, customers || []),
        productId: reservation.productId,
        productName: getProductName(reservation.productId, products || []),
        totalPeople: reservation.totalPeople,
        adults: reservation.adults || 0,
        child: reservation.child || 0,
        infant: reservation.infant || 0,
        status: reservation.status,
        channelRN: reservation.channelRN || '',
        totalPrice: reservationPrices[reservation.id] || 0,
        adultPrice: pricing.adultPrice,
        productPriceTotal: pricing.productPriceTotal,
        optionTotal: pricing.optionTotal,
        subtotal: pricing.subtotal,
        commissionAmount: pricing.commissionAmount,
        couponDiscount: pricing.couponDiscount,
        additionalDiscount: pricing.additionalDiscount,
        additionalCost: pricing.additionalCost,
        tax: pricing.tax,
        depositAmount: pricing.depositAmount,
        balanceAmount: pricing.balanceAmount,
        partnerReceivedAmount: partnerReceivedByReservation[reservation.id] ?? 0,
        channelSettlementAmount,
        amountAudited: reservationAudit[reservation.id]?.amount_audited ?? false,
        amountAuditedAt: reservationAudit[reservation.id]?.amount_audited_at ?? null,
        amountAuditedBy: reservationAudit[reservation.id]?.amount_audited_by ?? null
      }
    })
    
    // 등록일별 정렬
    return items.sort((a, b) => {
      const dateA = new Date(a.registrationDate).getTime()
      const dateB = new Date(b.registrationDate).getTime()
      return reservationSortOrder === 'asc' ? dateA - dateB : dateB - dateA
    })
  }, [filteredReservations, customers, products, reservationPrices, reservationPricingData, reservationSortOrder, partnerReceivedByReservation, reservationAudit])

  // 선택된 채널의 투어 진행 내역 가져오기 (투어 날짜 기준 예약 목록)
  useEffect(() => {
    const fetchTourReservations = async () => {
      setToursLoading(true)
      try {
        // 선택된 채널의 예약들 중 기간 필터에 맞는 것들
        // 투어 날짜 기준으로 필터링 (기간 필터 적용)
        let tourDateFilteredReservations = reservations.filter(reservation => {
          // 투어 날짜 기준 기간 필터
          const tourDate = new Date(reservation.tourDate)
          const startDate = new Date(dateRange.start)
          const endDate = new Date(dateRange.end)
          endDate.setHours(23, 59, 59, 999)
          
          if (!(tourDate >= startDate && tourDate <= endDate)) return false
          
          return true
        })

        // 추가 필터링 (채널, 상태, 검색)
        tourDateFilteredReservations = tourDateFilteredReservations.filter(reservation => {
          // 채널 필터 (선택된 경우에만)
          if (selectedChannelId && reservation.channelId !== selectedChannelId) return false
          
          // 상태 필터 (선택된 경우에만)
          if (selectedStatuses.length > 0 && !selectedStatuses.includes(reservation.status)) return false

          // 검색 필터
          if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim()
            const customerName = getCustomerName(reservation.customerId, customers || []).toLowerCase()
            const channelRN = reservation.channelRN?.toLowerCase() || ''
            const productName = getProductName(reservation.productId, products || []).toLowerCase()
            const tourDate = new Date(reservation.tourDate).toLocaleDateString('ko-KR')
            const regDate = new Date(reservation.addedTime).toLocaleDateString('ko-KR')
            
            if (
              !customerName.includes(query) &&
              !channelRN.includes(query) &&
              !productName.includes(query) &&
              !tourDate.includes(query) &&
              !regDate.includes(query)
            ) {
              return false
            }
          }

          return true
        })

        if (tourDateFilteredReservations.length === 0) {
          setTourItems([])
          setToursLoading(false)
          return
        }

        // 예약 가격 정보 가져오기
        const reservationIds = tourDateFilteredReservations.map(r => r.id)
        
        const pricesMap: Record<string, number> = {}
        const pricingDataMap: Record<string, {
          adultPrice: number
          productPriceTotal: number
          optionTotal: number
          subtotal: number
          commissionAmount: number
          couponDiscount: number
          additionalDiscount: number
          additionalCost: number
          tax: number
          depositAmount: number
          balanceAmount: number
          choicesTotal: number
        }> = {}

        // URL 길이 제한을 피하기 위해 청크 단위로 나눠서 요청 (한 번에 최대 100개씩)
        if (reservationIds.length > 0) {
          const chunkSize = 100
          for (let i = 0; i < reservationIds.length; i += chunkSize) {
            const chunk = reservationIds.slice(i, i + chunkSize)
            
            const { data: pricingData, error } = await supabase
              .from('reservation_pricing')
              .select('reservation_id, total_price, adult_product_price, product_price_total, option_total, subtotal, commission_amount, coupon_discount, additional_discount, additional_cost, tax, deposit_amount, balance_amount, choices_total')
              .in('reservation_id', chunk)

            if (error) {
              console.error('예약 가격 조회 오류 (청크):', error, { chunkSize: chunk.length, chunkIndex: i / chunkSize })
              continue // 다음 청크 계속 처리
            }
            
            pricingData?.forEach((p: any) => {
              pricesMap[p.reservation_id] = p.total_price || 0
              pricingDataMap[p.reservation_id] = {
                adultPrice: p.adult_product_price || 0,
                productPriceTotal: p.product_price_total || 0,
                optionTotal: p.option_total || 0,
                subtotal: p.subtotal || 0,
                commissionAmount: p.commission_amount || 0,
                couponDiscount: p.coupon_discount || 0,
                additionalDiscount: p.additional_discount || 0,
                additionalCost: p.additional_cost || 0,
                tax: p.tax || 0,
                depositAmount: p.deposit_amount || 0,
                balanceAmount: p.balance_amount || 0,
                choicesTotal: p.choices_total ?? 0
              }
            })
          }
        }

        // 입금내역 (Partner Received) 및 Audit 조회 (투어 탭용)
        const partnerReceivedMap: Record<string, number> = {}
        const auditMap: Record<string, { amount_audited: boolean; amount_audited_at: string | null; amount_audited_by: string | null }> = {}
        if (reservationIds.length > 0) {
          const chunkSize = 100
          for (let i = 0; i < reservationIds.length; i += chunkSize) {
            const chunk = reservationIds.slice(i, i + chunkSize)
            const { data: paymentData } = await supabase
              .from('payment_records')
              .select('reservation_id, amount')
              .in('reservation_id', chunk)
              .eq('payment_status', 'Partner Received')
            paymentData?.forEach((row: { reservation_id: string; amount: number | null }) => {
              const rid = row.reservation_id
              const amt = row.amount ?? 0
              partnerReceivedMap[rid] = (partnerReceivedMap[rid] ?? 0) + amt
            })
            try {
              const { data: auditData } = await supabase
                .from('reservations')
                .select('id, amount_audited, amount_audited_at, amount_audited_by')
                .in('id', chunk)
              auditData?.forEach((row: any) => {
                auditMap[row.id] = {
                  amount_audited: !!row.amount_audited,
                  amount_audited_at: row.amount_audited_at ?? null,
                  amount_audited_by: row.amount_audited_by ?? null
                }
              })
            } catch { /* 컬럼 미존재 시 무시 */ }
          }
          setPartnerReceivedByReservation(prev => ({ ...prev, ...partnerReceivedMap }))
          setReservationAudit(prev => ({ ...prev, ...auditMap }))
        }

        // 예약 아이템으로 변환
        const tourReservationItems: ReservationItem[] = tourDateFilteredReservations.map(reservation => {
          const pricing = pricingDataMap[reservation.id] || {
            adultPrice: 0,
            productPriceTotal: 0,
            optionTotal: 0,
            subtotal: 0,
            commissionAmount: 0,
            couponDiscount: 0,
            additionalDiscount: 0,
            additionalCost: 0,
            tax: 0,
            depositAmount: 0,
            balanceAmount: 0,
            choicesTotal: 0
          }
          const productSubtotal = (pricing.productPriceTotal || 0) - Math.abs(pricing.couponDiscount || 0)
          const channelSettlementAmount = Math.max(0, productSubtotal - (pricing.choicesTotal ?? 0) - (pricing.commissionAmount || 0))
          return {
          id: reservation.id,
          tourDate: reservation.tourDate,
          registrationDate: reservation.addedTime,
          customerId: reservation.customerId,
          customerName: getCustomerName(reservation.customerId, customers || []),
          productId: reservation.productId,
          productName: getProductName(reservation.productId, products || []),
          totalPeople: reservation.totalPeople,
            adults: reservation.adults || 0,
            child: reservation.child || 0,
            infant: reservation.infant || 0,
          status: reservation.status,
          channelRN: reservation.channelRN || '',
            channelId: reservation.channelId,
            channelName: getChannelName(reservation.channelId, channels || []),
            totalPrice: pricesMap[reservation.id] || 0,
            adultPrice: pricing.adultPrice,
            productPriceTotal: pricing.productPriceTotal,
            optionTotal: pricing.optionTotal,
            subtotal: pricing.subtotal,
            commissionAmount: pricing.commissionAmount,
            couponDiscount: pricing.couponDiscount,
            additionalDiscount: pricing.additionalDiscount,
            additionalCost: pricing.additionalCost,
            tax: pricing.tax,
            depositAmount: pricing.depositAmount,
            balanceAmount: pricing.balanceAmount,
            partnerReceivedAmount: partnerReceivedMap[reservation.id] ?? 0,
            channelSettlementAmount,
            amountAudited: auditMap[reservation.id]?.amount_audited ?? false,
            amountAuditedAt: auditMap[reservation.id]?.amount_audited_at ?? null,
            amountAuditedBy: auditMap[reservation.id]?.amount_audited_by ?? null
          }
        })

        setTourItems(tourReservationItems)
      } catch (error) {
        console.error('투어 진행 내역 조회 오류:', error)
        setTourItems([])
      } finally {
        setToursLoading(false)
      }
    }

    fetchTourReservations()
  }, [reservations, selectedChannelId, selectedStatuses, dateRange, customers, products, channels, searchQuery])

  // 투어 내역 정렬
  const sortedTourItems = useMemo(() => {
    return [...tourItems].sort((a, b) => {
      const dateA = new Date(a.tourDate).getTime()
      const dateB = new Date(b.tourDate).getTime()
      return tourSortOrder === 'asc' ? dateA - dateB : dateB - dateA
    })
  }, [tourItems, tourSortOrder])

  // 합계 계산
  const totals = useMemo(() => {
    const reservationTotalPrice = reservationItems.reduce((sum, r) => sum + r.totalPrice, 0)
    const reservationTotalPeople = reservationItems.reduce((sum, r) => sum + r.totalPeople, 0)
    const tourTotalPrice = sortedTourItems.reduce((sum, t) => sum + t.totalPrice, 0)
    const tourTotalPeople = sortedTourItems.reduce((sum, t) => sum + t.totalPeople, 0)

    return {
      reservations: {
        count: reservationItems.length,
        totalPeople: reservationTotalPeople,
        totalPrice: reservationTotalPrice
      },
      tours: {
        count: sortedTourItems.length,
        totalPeople: tourTotalPeople,
        totalPrice: tourTotalPrice
      }
    }
  }, [reservationItems, sortedTourItems])

  // 선택된 채널명 가져오기 (early return 이전에 위치해야 함)
  const selectedChannelName = useMemo(() => {
    if (!channelFilter) return '전체 채널'
    return getChannelName(channelFilter, channels || []) || '알 수 없는 채널'
  }, [channelFilter, channels])

  if (reservationsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-3 sm:space-y-4 overflow-x-hidden max-w-full">
      {/* 채널 선택 버튼 */}
      <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Filter className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500 flex-shrink-0" />
          <span className="text-xs sm:text-sm font-medium text-gray-700">채널 필터:</span>
          <button
            onClick={() => setIsChannelModalOpen(true)}
            className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium text-blue-700 transition-colors flex items-center gap-1.5"
          >
            <span className="truncate max-w-[140px] sm:max-w-none">{selectedChannelName}</span>
            <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
          </button>
          {channelFilter && (
            <button
              onClick={() => onChannelChange?.('')}
              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
              title="필터 제거"
            >
              <X className="h-3 w-3" />
              초기화
            </button>
          )}
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
            <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 sm:gap-0">
                <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg flex-shrink-0">
                  <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                </div>
                <div className="min-w-0 sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">예약 건수</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{totals.reservations.count}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 sm:gap-0">
                <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg flex-shrink-0">
                  <Users className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                </div>
                <div className="min-w-0 sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">예약 인원</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{totals.reservations.totalPeople}명</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 sm:gap-0">
                <div className="p-1.5 sm:p-2 bg-purple-100 rounded-lg flex-shrink-0">
                  <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                </div>
                <div className="min-w-0 sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">투어 예약</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{totals.tours.count}건</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200 col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2 sm:gap-0">
                <div className="p-1.5 sm:p-2 bg-yellow-100 rounded-lg flex-shrink-0">
                  <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600" />
                </div>
                <div className="min-w-0 sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">투어 총액</p>
                  <p className="text-lg sm:text-2xl font-bold text-green-600 truncate">
                    ${totals.tours.totalPrice.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 상세 내역 탭 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* 탭 네비게이션 */}
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex gap-4 sm:gap-8 px-3 sm:px-6 overflow-x-auto">
                <button
                  onClick={() => setActiveDetailTab('reservations')}
                  className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                    activeDetailTab === 'reservations'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  예약 내역
                </button>
                <button
                  onClick={() => setActiveDetailTab('tours')}
                  className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                    activeDetailTab === 'tours'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  투어 진행 내역
                </button>
              </nav>
            </div>

            {/* 예약 내역 탭 */}
            {activeDetailTab === 'reservations' && (
          <div className="divide-y divide-gray-200">
            {/* 정렬 버튼 */}
            <div className="px-3 sm:px-6 py-2 sm:py-3 bg-gray-50 border-b border-gray-200">
                      <button
                        onClick={() => setReservationSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
                        title="등록일로 정렬"
                      >
                <span>등록일 정렬</span>
                        <span className={`transition-transform ${reservationSortOrder === 'asc' ? '-rotate-180' : 'rotate-0'}`}>
                  <ChevronDown size={16} />
                        </span>
                      </button>
            </div>

            {channelGroups.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                {pricesLoading ? '가격 정보를 불러오는 중...' : '채널 데이터가 없습니다.'}
              </div>
            ) : (
               channelGroups.map(group => {
                 const isGroupExpanded = expandedGroups.has(group.type)
                 const groupReservations = group.channels.flatMap(ch => getReservationsByChannel(ch.id))
                 const groupTotal = groupReservations.reduce((sum, r) => {
                   const pricing = reservationPricingData[r.id] || {}
                   const discountTotal = (pricing.couponDiscount || 0) + (pricing.additionalDiscount || 0)
                   const grandTotal = (pricing.productPriceTotal || 0) - discountTotal + (pricing.additionalCost || 0)
                   const totalPrice = grandTotal - (pricing.commissionAmount || 0)
                   const netPrice = totalPrice + (pricing.optionTotal || 0)
                   return sum + netPrice
                 }, 0)

                 // 자체 채널은 바로 모든 예약을 합쳐서 표시
                 if (group.type === 'SELF') {
                   // 자체 채널의 모든 예약 아이템 생성 및 정렬
                   const allChannelItems = groupReservations.map(reservation => {
                     const pricing = reservationPricingData[reservation.id] || {
                       adultPrice: 0,
                       productPriceTotal: 0,
                       optionTotal: 0,
                       subtotal: 0,
                       commissionAmount: 0,
                       couponDiscount: 0,
                       additionalDiscount: 0,
                       additionalCost: 0,
                       tax: 0,
                       depositAmount: 0,
                       balanceAmount: 0
                     }
                     return {
                       id: reservation.id,
                       tourDate: reservation.tourDate,
                       registrationDate: reservation.addedTime,
                       customerId: reservation.customerId,
                       customerName: getCustomerName(reservation.customerId, customers || []),
                       productId: reservation.productId,
                       productName: getProductName(reservation.productId, products || []),
                       totalPeople: reservation.totalPeople,
                       adults: reservation.adults || 0,
                       child: reservation.child || 0,
                       infant: reservation.infant || 0,
                       status: reservation.status,
                       channelRN: reservation.channelRN || '',
                       channelId: reservation.channelId,
                       channelName: getChannelName(reservation.channelId, channels || []),
                       totalPrice: 0,
                       adultPrice: pricing.adultPrice,
                       productPriceTotal: pricing.productPriceTotal,
                       optionTotal: pricing.optionTotal,
                       subtotal: pricing.subtotal,
                       commissionAmount: pricing.commissionAmount,
                       couponDiscount: pricing.couponDiscount,
                       additionalDiscount: pricing.additionalDiscount,
                       additionalCost: pricing.additionalCost,
                       tax: pricing.tax,
                       depositAmount: pricing.depositAmount,
                       balanceAmount: pricing.balanceAmount
                     }
                   }).sort((a, b) => {
                     const dateA = new Date(a.registrationDate).getTime()
                     const dateB = new Date(b.registrationDate).getTime()
                     return reservationSortOrder === 'asc' ? dateA - dateB : dateB - dateA
                   })

                   return (
                     <div key={group.type} className="border-b border-gray-200">
                       {/* 자체 채널 그룹 헤더 */}
                       <button
                         onClick={() => toggleGroup(group.type)}
                         className="w-full px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                       >
<div className="flex flex-wrap items-center gap-1.5 sm:gap-3 min-w-0">
                         {isGroupExpanded ? (
                             <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 flex-shrink-0" />
                           ) : (
                             <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 flex-shrink-0" />
                           )}
                         <span className="font-semibold text-gray-900 text-sm sm:text-base truncate">{group.label}</span>
                         <span className="text-xs sm:text-sm text-gray-500">({group.channels.length}개)</span>
                         <span className="text-xs sm:text-sm font-medium text-green-600">
                             총 ${groupTotal.toLocaleString()}
                           </span>
                         </div>
                       </button>

                       {/* 자체 채널의 모든 예약 내역 테이블 */}
                       {isGroupExpanded && (
                         <div className="overflow-x-auto bg-gray-50">
                           <table className="w-full divide-y divide-gray-200 text-xs">
                             <thead className="bg-white">
                               <tr>
                                 <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-20">상태</th>
                                 <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">등록일</th>
                                 <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-32">고객명</th>
                                 <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">채널RN</th>
                                 <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">채널</th>
                                 <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase" style={{ width: '150px', minWidth: '150px', maxWidth: '150px' }}>상품명</th>
                                 <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-16">인원</th>
                                 <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">성인 가격</th>
                                 <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">상품가격 합계</th>
                                 <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">할인총액</th>
                                 <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">추가비용 총액</th>
                                 <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">Grand Total</th>
                                 <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">커미션</th>
                                 <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">총 가격</th>
                                 <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">옵션 총합</th>
                                 <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">Net 가격</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                               {allChannelItems.length === 0 ? (
                    <tr>
                                   <td colSpan={16} className="px-2 py-3 text-center text-gray-500 text-xs">
                                     예약 내역이 없습니다.
                      </td>
                    </tr>
                  ) : (
                                 allChannelItems.map((item, idx) => {
                                   const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                                   const grandTotal = (item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0)
                                   const totalPrice = grandTotal - (item.commissionAmount || 0)
                                   const netPrice = totalPrice + (item.optionTotal || 0)
                                   return (
                                     <tr 
                                       key={`self-${item.id}-${idx}`} 
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => openReservationEditModal(item.id)}
                      >
                                       <td className="px-2 py-2 whitespace-nowrap text-xs w-20">
                                         <span className={`px-1.5 py-0.5 rounded text-xs ${getStatusColor(item.status)}`}>
                                           {item.status === 'Confirmed' ? '확정' :
                                            item.status === 'Pending' ? '대기' :
                                            item.status === 'Canceled' ? '취소' :
                                            item.status === 'Completed' ? '완료' :
                                            item.status}
                                         </span>
                        </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 w-24">
                                         {new Date(item.registrationDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                                       </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 w-32 truncate">
                          {item.customerName}
                        </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 w-24 truncate">
                                         {item.channelRN || '-'}
                                       </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 truncate max-w-[120px]">
                                         {item.channelName}
                                       </td>
                                       <td className="px-2 py-2 text-xs text-gray-600 truncate" style={{ width: '150px', minWidth: '150px', maxWidth: '150px' }} title={item.productName}>
                                         {item.productName}
                                       </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 text-center w-16">
                                         {item.totalPeople}
                        </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right w-20">
                                         ${(item.adultPrice || 0).toLocaleString()}
                        </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right w-24">
                                         ${(item.productPriceTotal || 0).toLocaleString()}
                                       </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-red-600 text-right w-20">
                                         -${discountTotal.toLocaleString()}
                                       </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-orange-600 text-right w-24">
                                         ${(item.additionalCost || 0).toLocaleString()}
                                       </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-green-600 font-semibold text-right w-24">
                                         ${grandTotal.toLocaleString()}
                                       </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-blue-600 text-right w-20">
                                         ${(item.commissionAmount || 0).toLocaleString()}
                                       </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-green-600 font-semibold text-right w-20">
                                         ${totalPrice.toLocaleString()}
                                       </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right w-20">
                                         ${(item.optionTotal || 0).toLocaleString()}
                                       </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-purple-600 font-semibold text-right w-24">
                                         ${netPrice.toLocaleString()}
                                       </td>
                                     </tr>
                                   )
                                 })
                               )}
                             </tbody>
                             <tfoot className="bg-gray-50">
                               <tr>
                                 <td colSpan={6} className="px-2 py-2 text-xs font-medium text-gray-900">
                                   합계
                                 </td>
                                 <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-center w-16">
                                   {allChannelItems.reduce((sum, item) => sum + (item.totalPeople || 0), 0)}
                                 </td>
                                 <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-right">
                                   ${allChannelItems.reduce((sum, item) => sum + (item.adultPrice || 0), 0).toLocaleString()}
                                 </td>
                                 <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-right">
                                   ${allChannelItems.reduce((sum, item) => sum + (item.productPriceTotal || 0), 0).toLocaleString()}
                                 </td>
                                 <td className="px-2 py-2 text-xs font-semibold text-red-600 text-right">
                                   -${allChannelItems.reduce((sum, item) => sum + (item.couponDiscount || 0) + (item.additionalDiscount || 0), 0).toLocaleString()}
                                 </td>
                                 <td className="px-2 py-2 text-xs font-semibold text-orange-600 text-right">
                                   ${allChannelItems.reduce((sum, item) => sum + (item.additionalCost || 0), 0).toLocaleString()}
                                 </td>
                                 <td className="px-2 py-2 text-xs font-semibold text-green-600 text-right">
                                   ${allChannelItems.reduce((sum, item) => {
                                     const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                                     return sum + ((item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0))
                                   }, 0).toLocaleString()}
                                 </td>
                                 <td className="px-2 py-2 text-xs font-semibold text-blue-600 text-right">
                                   ${allChannelItems.reduce((sum, item) => sum + (item.commissionAmount || 0), 0).toLocaleString()}
                                 </td>
                                 <td className="px-2 py-2 text-xs font-semibold text-green-600 text-right">
                                   ${allChannelItems.reduce((sum, item) => {
                                     const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                                     const grandTotal = (item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0)
                                     return sum + (grandTotal - (item.commissionAmount || 0))
                                   }, 0).toLocaleString()}
                                 </td>
                                 <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-right">
                                   ${allChannelItems.reduce((sum, item) => sum + (item.optionTotal || 0), 0).toLocaleString()}
                                 </td>
                                 <td className="px-2 py-2 text-xs font-semibold text-purple-600 text-right">
                                   ${groupTotal.toLocaleString()}
                                 </td>
                               </tr>
                             </tfoot>
                           </table>
                         </div>
                       )}
                     </div>
                   )
                 }

                 // OTA 채널은 기존대로 채널별로 나누어 표시
                 return (
                   <div key={group.type} className="border-b border-gray-200">
                     {/* 그룹 헤더 */}
                     <button
                       onClick={() => toggleGroup(group.type)}
                       className="w-full px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                     >
<div className="flex flex-wrap items-center gap-1.5 sm:gap-3 min-w-0">
                         {isGroupExpanded ? (
                             <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 flex-shrink-0" />
                           ) : (
                             <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 flex-shrink-0" />
                           )}
                         <span className="font-semibold text-gray-900 text-sm sm:text-base truncate">{group.label}</span>
                         <span className="text-xs sm:text-sm text-gray-500">({group.channels.length}개)</span>
                         <span className="text-xs sm:text-sm font-medium text-green-600">
                           총 ${groupTotal.toLocaleString()}
                         </span>
                       </div>
                     </button>

                     {/* 채널 목록 */}
                     {isGroupExpanded && (
                       <div className="bg-gray-50">
                         {group.channels.map(channel => {
                          const channelReservations = getReservationsByChannel(channel.id)
                          const isChannelExpanded = expandedChannels.has(channel.id)
                          
                          // 채널별 예약 아이템 생성 및 정렬
                          const channelItems = channelReservations.map(reservation => {
                            const pricing = reservationPricingData[reservation.id] || {
                              adultPrice: 0,
                              productPriceTotal: 0,
                              optionTotal: 0,
                              subtotal: 0,
                              commissionAmount: 0,
                              couponDiscount: 0,
                              additionalDiscount: 0,
                              additionalCost: 0,
                              tax: 0,
                              depositAmount: 0,
                              balanceAmount: 0,
                              choicesTotal: 0
                            }
                            const productSubtotal = (pricing.productPriceTotal || 0) - Math.abs(pricing.couponDiscount || 0)
                            const channelSettlementAmount = Math.max(0, productSubtotal - (pricing.choicesTotal ?? 0) - (pricing.commissionAmount || 0))
                            return {
                              id: reservation.id,
                              tourDate: reservation.tourDate,
                              registrationDate: reservation.addedTime,
                              customerId: reservation.customerId,
                              customerName: getCustomerName(reservation.customerId, customers || []),
                              productId: reservation.productId,
                              productName: getProductName(reservation.productId, products || []),
                              totalPeople: reservation.totalPeople,
                              adults: reservation.adults || 0,
                              child: reservation.child || 0,
                              infant: reservation.infant || 0,
                              status: reservation.status,
                              channelRN: reservation.channelRN || '',
                              totalPrice: reservationPrices[reservation.id] || 0,
                              adultPrice: pricing.adultPrice,
                              productPriceTotal: pricing.productPriceTotal,
                              optionTotal: pricing.optionTotal,
                              subtotal: pricing.subtotal,
                              commissionAmount: pricing.commissionAmount,
                              couponDiscount: pricing.couponDiscount,
                              additionalDiscount: pricing.additionalDiscount,
                              additionalCost: pricing.additionalCost,
                              tax: pricing.tax,
                              depositAmount: pricing.depositAmount,
                              balanceAmount: pricing.balanceAmount,
                              partnerReceivedAmount: partnerReceivedByReservation[reservation.id] ?? 0,
                              channelSettlementAmount,
                              amountAudited: reservationAudit[reservation.id]?.amount_audited ?? false,
                              amountAuditedAt: reservationAudit[reservation.id]?.amount_audited_at ?? null,
                              amountAuditedBy: reservationAudit[reservation.id]?.amount_audited_by ?? null
                            }
                          }).sort((a, b) => {
                            const dateA = new Date(a.registrationDate).getTime()
                            const dateB = new Date(b.registrationDate).getTime()
                            return reservationSortOrder === 'asc' ? dateA - dateB : dateB - dateA
                          })

                          // 채널별 통계 계산
                          const channelStats = channelItems.reduce((acc, item) => {
                            const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                            const grandTotal = (item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0)
                            const totalPrice = grandTotal - (item.commissionAmount || 0)
                            const netPrice = totalPrice + (item.optionTotal || 0)
                            
                            return {
                              grandTotal: acc.grandTotal + grandTotal,
                              commission: acc.commission + (item.commissionAmount || 0),
                              totalPrice: acc.totalPrice + totalPrice,
                              netPrice: acc.netPrice + netPrice
                            }
                          }, { grandTotal: 0, commission: 0, totalPrice: 0, netPrice: 0 })

                          return (
                            <div key={channel.id} className="border-t border-gray-200">
                              {/* 채널 헤더 */}
                              <button
                                onClick={() => toggleChannel(channel.id)}
                                className="w-full px-3 sm:px-8 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2 hover:bg-gray-100 transition-colors text-left"
                              >
<div className="flex flex-wrap items-center gap-1.5 sm:gap-3 min-w-0">
                                {isChannelExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                )}
                                  <span className="font-medium text-gray-800 text-sm sm:text-base truncate">{channel.name}</span>
                                  <span className="text-xs text-gray-500">({channelItems.length}건)</span>
                                  <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-4 gap-y-0 text-xs">
                                    <span className="font-medium text-green-600">
                                      Grand Total: ${channelStats.grandTotal.toLocaleString()}
                                    </span>
                                    <span className="font-medium text-blue-600">
                                      Commission: ${channelStats.commission.toLocaleString()}
                                    </span>
                                    <span className="font-medium text-purple-600">
                                      총 가격: ${channelStats.totalPrice.toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              </button>

                              {/* 채널 예약 내역 테이블 */}
                              {isChannelExpanded && (
                                <div className="overflow-x-auto">
                                  <table className="w-full divide-y divide-gray-200 text-xs">
                                    <thead className="bg-white">
                                      <tr>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-20">상태</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">등록일</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-32">고객명</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">채널RN</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase" style={{ width: '150px', minWidth: '150px', maxWidth: '150px' }}>상품명</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-16">인원</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">성인 가격</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">상품가격 합계</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">할인총액</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">추가비용 총액</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">Grand Total</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">커미션</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">총 가격</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">옵션 총합</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">Net 가격</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">입금내역 (Partner Received)</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">채널 정산 금액</th>
                                        <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase w-20">Audit</th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                      {channelItems.length === 0 ? (
                                        <tr>
                                          <td colSpan={18} className="px-2 py-3 text-center text-gray-500 text-xs">
                                            예약 내역이 없습니다.
                                          </td>
                                        </tr>
                                      ) : (
                                        channelItems.map((item, idx) => {
                                          const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                                          const grandTotal = (item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0)
                                          const totalPrice = grandTotal - (item.commissionAmount || 0)
                                          const netPrice = totalPrice + (item.optionTotal || 0)
                                          const effectiveAudited = reservationAudit[item.id]?.amount_audited ?? item.amountAudited
                                          const effectiveAuditedAt = reservationAudit[item.id]?.amount_audited_at ?? item.amountAuditedAt
                                          const effectiveAuditedBy = reservationAudit[item.id]?.amount_audited_by ?? item.amountAuditedBy
                                          const auditTooltip = !canAudit
                                            ? 'Super 권한이 있는 사용자만 Audit 할 수 있습니다'
                                            : effectiveAudited && (effectiveAuditedBy || effectiveAuditedAt)
                                              ? `Audit: ${effectiveAuditedBy ?? '-'} / ${effectiveAuditedAt ? new Date(effectiveAuditedAt).toLocaleString('ko-KR') : '-'}`
                                              : '금액 더블체크 완료 시 체크'
                                          return (
                                            <tr 
                                              key={`${channel.id}-${item.id}-${idx}`} 
                                              className="hover:bg-gray-50 cursor-pointer transition-colors"
                                              onClick={() => openReservationEditModal(item.id)}
                                            >
                                              <td className="px-2 py-2 whitespace-nowrap text-xs w-20">
                                                <span className={`px-1.5 py-0.5 rounded text-xs ${getStatusColor(item.status)}`}>
                                                  {item.status === 'Confirmed' ? '확정' :
                                                   item.status === 'Pending' ? '대기' :
                                                   item.status === 'Canceled' ? '취소' :
                                                   item.status === 'Completed' ? '완료' :
                             item.status}
                          </span>
                        </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 w-24">
                                                {new Date(item.registrationDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 w-32 truncate">
                                                {item.customerName}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 w-24 truncate">
                          {item.channelRN || '-'}
                        </td>
                                              <td className="px-2 py-2 text-xs text-gray-600 truncate" style={{ width: '150px', minWidth: '150px', maxWidth: '150px' }} title={item.productName}>
                                                {item.productName}
                                              </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 text-center w-16">
                                         {item.totalPeople}
                                       </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right w-20">
                                                ${(item.adultPrice || 0).toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right w-24">
                                                ${(item.productPriceTotal || 0).toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-red-600 text-right w-20">
                                                -${discountTotal.toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-orange-600 text-right w-24">
                                                ${(item.additionalCost || 0).toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-green-600 font-semibold text-right w-24">
                                                ${grandTotal.toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-blue-600 text-right w-20">
                                                ${(item.commissionAmount || 0).toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-green-600 font-semibold text-right w-20">
                                                ${totalPrice.toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right w-20">
                                                ${(item.optionTotal || 0).toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-purple-600 font-semibold text-right w-24">
                                                ${netPrice.toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-teal-600 text-right w-24">
                                                ${(item.partnerReceivedAmount ?? 0).toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-amber-600 text-right w-24">
                                                ${(item.channelSettlementAmount ?? 0).toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-center w-20" onClick={e => e.stopPropagation()} title={auditTooltip}>
                                                <input
                                                  type="checkbox"
                                                  checked={!!effectiveAudited}
                                                  disabled={!canAudit}
                                                  onClick={e => e.stopPropagation()}
                                                  onChange={e => handleToggleAmountAudit(item.id, e.target.checked)}
                                                  className="rounded border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                                />
                                              </td>
                                            </tr>
                                          )
                                        })
                  )}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                                        <td colSpan={5} className="px-2 py-2 text-xs font-medium text-gray-900">
                      합계
                    </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-center w-16">
                                          {channelItems.reduce((sum, item) => sum + (item.totalPeople || 0), 0)}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-right">
                                          ${channelItems.reduce((sum, item) => sum + (item.adultPrice || 0), 0).toLocaleString()}
                    </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-right">
                                          ${channelItems.reduce((sum, item) => sum + (item.productPriceTotal || 0), 0).toLocaleString()}
                    </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-red-600 text-right">
                                          -${channelItems.reduce((sum, item) => sum + (item.couponDiscount || 0) + (item.additionalDiscount || 0), 0).toLocaleString()}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-orange-600 text-right">
                                          ${channelItems.reduce((sum, item) => sum + (item.additionalCost || 0), 0).toLocaleString()}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-green-600 text-right">
                                          ${channelItems.reduce((sum, item) => {
                                            const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                                            return sum + ((item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0))
                                          }, 0).toLocaleString()}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-blue-600 text-right">
                                          ${channelItems.reduce((sum, item) => sum + (item.commissionAmount || 0), 0).toLocaleString()}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-green-600 text-right">
                                          ${channelItems.reduce((sum, item) => {
                                            const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                                            const grandTotal = (item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0)
                                            return sum + (grandTotal - (item.commissionAmount || 0))
                                          }, 0).toLocaleString()}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-right">
                                          ${channelItems.reduce((sum, item) => sum + (item.optionTotal || 0), 0).toLocaleString()}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-purple-600 text-right">
                                          ${channelStats.netPrice.toLocaleString()}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-teal-600 text-right">
                                          ${channelItems.reduce((sum, item) => sum + (item.partnerReceivedAmount ?? 0), 0).toLocaleString()}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-amber-600 text-right">
                                          ${channelItems.reduce((sum, item) => sum + (item.channelSettlementAmount ?? 0), 0).toLocaleString()}
                                        </td>
                                        <td className="px-2 py-2 text-xs text-gray-500 text-center">—</td>
                  </tr>
                </tfoot>
              </table>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })
            )}
            </div>
            )}

            {/* 투어 진행 내역 탭 */}
            {activeDetailTab === 'tours' && (
          <div className="divide-y divide-gray-200">
            {/* 정렬 버튼 */}
            <div className="px-3 sm:px-6 py-2 sm:py-3 bg-gray-50 border-b border-gray-200">
              <button
                onClick={() => setTourSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
                title="투어 날짜로 정렬"
              >
                <span>투어 날짜 정렬</span>
                <span className={`transition-transform ${tourSortOrder === 'asc' ? '-rotate-180' : 'rotate-0'}`}>
                  <ChevronDown size={16} />
                </span>
              </button>
            </div>

                {toursLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : channelGroups.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                채널 데이터가 없습니다.
              </div>
            ) : (
              channelGroups.map(group => {
                const isGroupExpanded = expandedGroups.has(group.type)
                const groupTourItems = group.channels.flatMap(ch => getTourItemsByChannel(ch.id))
                const groupTotal = groupTourItems.reduce((sum, item) => {
                  const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                  const grandTotal = (item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0)
                  const totalPrice = grandTotal - (item.commissionAmount || 0)
                  const netPrice = totalPrice + (item.optionTotal || 0)
                  return sum + netPrice
                }, 0)

                // 자체 채널은 바로 모든 예약을 합쳐서 표시
                if (group.type === 'SELF') {
                  // 자체 채널의 모든 투어 아이템 생성 및 정렬
                  const allTourItems = groupTourItems.sort((a, b) => {
                    const dateA = new Date(a.tourDate).getTime()
                    const dateB = new Date(b.tourDate).getTime()
                    return tourSortOrder === 'asc' ? dateA - dateB : dateB - dateA
                  })

                  return (
                    <div key={group.type} className="border-b border-gray-200">
                      {/* 자체 채널 그룹 헤더 */}
                        <button
                        onClick={() => toggleGroup(group.type)}
                        className="w-full px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                      >
<div className="flex flex-wrap items-center gap-1.5 sm:gap-3 min-w-0">
                         {isGroupExpanded ? (
                             <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 flex-shrink-0" />
                           ) : (
                             <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 flex-shrink-0" />
                           )}
                         <span className="font-semibold text-gray-900 text-sm sm:text-base truncate">{group.label}</span>
                         <span className="text-xs sm:text-sm text-gray-500">({group.channels.length}개)</span>
                         <span className="text-xs sm:text-sm font-medium text-green-600">
                            총 ${groupTotal.toLocaleString()}
                          </span>
                        </div>
                        </button>

                      {/* 자체 채널의 모든 투어 내역 테이블 */}
                      {isGroupExpanded && (
                        <div className="overflow-x-auto bg-gray-50">
                          <table className="w-full divide-y divide-gray-200 text-xs">
                            <thead className="bg-white">
                              <tr>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-20">상태</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">투어 날짜</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-32">고객명</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">채널RN</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">채널</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase" style={{ width: '150px', minWidth: '150px', maxWidth: '150px' }}>상품명</th>
                                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-16">인원</th>
                                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">성인 가격</th>
                                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">상품가격 합계</th>
                                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">할인총액</th>
                                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">추가비용 총액</th>
                                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">Grand Total</th>
                                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">커미션</th>
                                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">총 가격</th>
                                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">옵션 총합</th>
                                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">Net 가격</th>
                                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">입금내역 (Partner Received)</th>
                                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">채널 정산 금액</th>
                                <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase w-20">Audit</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                              {allTourItems.length === 0 ? (
                      <tr>
                                  <td colSpan={19} className="px-2 py-3 text-center text-gray-500 text-xs">
                                    투어 진행 내역이 없습니다.
                        </td>
                      </tr>
                    ) : (
                                allTourItems.map((item, idx) => {
                                  const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                                  const grandTotal = (item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0)
                                  const totalPrice = grandTotal - (item.commissionAmount || 0)
                                  const netPrice = totalPrice + (item.optionTotal || 0)
                                  const effectiveAudited = reservationAudit[item.id]?.amount_audited ?? item.amountAudited
                                  const effectiveAuditedAt = reservationAudit[item.id]?.amount_audited_at ?? item.amountAuditedAt
                                  const effectiveAuditedBy = reservationAudit[item.id]?.amount_audited_by ?? item.amountAuditedBy
                                  const auditTooltip = !canAudit
                                    ? 'Super 권한이 있는 사용자만 Audit 할 수 있습니다'
                                    : effectiveAudited && (effectiveAuditedBy || effectiveAuditedAt)
                                      ? `Audit: ${effectiveAuditedBy ?? '-'} / ${effectiveAuditedAt ? new Date(effectiveAuditedAt).toLocaleString('ko-KR') : '-'}`
                                      : '금액 더블체크 완료 시 체크'
                                  return (
                                    <tr 
                                      key={`self-tour-${item.id}-${idx}`} 
                          className="hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest('[data-audit-cell]')) return
                            openReservationEditModal(item.id)
                          }}
                        >
                                      <td className="px-2 py-2 whitespace-nowrap text-xs w-20">
                                        <span className={`px-1.5 py-0.5 rounded text-xs ${getStatusColor(item.status)}`}>
                                          {item.status === 'Confirmed' ? '확정' :
                                           item.status === 'Pending' ? '대기' :
                                           item.status === 'Canceled' ? '취소' :
                                           item.status === 'Completed' ? '완료' :
                                           item.status}
                                        </span>
                          </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 w-24">
                                        {item.tourDate ? item.tourDate.split('T')[0] : '-'}
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 w-32 truncate">
                            {item.customerName}
                          </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 w-24 truncate">
                                        {item.channelRN || '-'}
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 truncate max-w-[120px]">
                                        {item.channelName || '-'}
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 truncate w-32">
                                        {item.productName}
                                      </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 text-center w-16">
                                         {item.totalPeople}
                          </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right w-20">
                                        ${(item.adultPrice || 0).toLocaleString()}
                          </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right w-24">
                                        ${(item.productPriceTotal || 0).toLocaleString()}
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-red-600 text-right w-20">
                                        -${discountTotal.toLocaleString()}
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-orange-600 text-right w-24">
                                        ${(item.additionalCost || 0).toLocaleString()}
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-green-600 font-semibold text-right w-24">
                                        ${grandTotal.toLocaleString()}
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-blue-600 text-right w-20">
                                        ${(item.commissionAmount || 0).toLocaleString()}
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-green-600 font-semibold text-right w-20">
                                        ${totalPrice.toLocaleString()}
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right w-20">
                                        ${(item.optionTotal || 0).toLocaleString()}
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-purple-600 font-semibold text-right w-24">
                                        ${netPrice.toLocaleString()}
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-teal-600 text-right w-24">
                                        ${(item.partnerReceivedAmount ?? 0).toLocaleString()}
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap text-xs text-amber-600 text-right w-24">
                                        ${(item.channelSettlementAmount ?? 0).toLocaleString()}
                                      </td>
                                      <td data-audit-cell className="px-2 py-2 whitespace-nowrap text-center w-20" onClick={e => e.stopPropagation()} title={auditTooltip}>
                                        <input
                                          type="checkbox"
                                          checked={!!effectiveAudited}
                                          disabled={!canAudit}
                                          onChange={e => handleToggleAmountAudit(item.id, e.target.checked)}
                                          className="rounded border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                        />
                                      </td>
                                    </tr>
                                  )
                                })
                              )}
                            </tbody>
                            <tfoot className="bg-gray-50">
                              <tr>
                                <td colSpan={7} className="px-2 py-2 text-xs font-medium text-gray-900">
                                  합계
                                </td>
                                <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-center w-16">
                                  {allTourItems.reduce((sum, item) => sum + (item.totalPeople || 0), 0)}
                                </td>
                                <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-right">
                                  ${allTourItems.reduce((sum, item) => sum + (item.adultPrice || 0), 0).toLocaleString()}
                                </td>
                                <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-right">
                                  ${allTourItems.reduce((sum, item) => sum + (item.productPriceTotal || 0), 0).toLocaleString()}
                                </td>
                                <td className="px-2 py-2 text-xs font-semibold text-red-600 text-right">
                                  -${allTourItems.reduce((sum, item) => sum + (item.couponDiscount || 0) + (item.additionalDiscount || 0), 0).toLocaleString()}
                                </td>
                                <td className="px-2 py-2 text-xs font-semibold text-orange-600 text-right">
                                  ${allTourItems.reduce((sum, item) => sum + (item.additionalCost || 0), 0).toLocaleString()}
                                </td>
                                <td className="px-2 py-2 text-xs font-semibold text-green-600 text-right">
                                  ${allTourItems.reduce((sum, item) => {
                                    const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                                    return sum + ((item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0))
                                  }, 0).toLocaleString()}
                                </td>
                                <td className="px-2 py-2 text-xs font-semibold text-blue-600 text-right">
                                  ${allTourItems.reduce((sum, item) => sum + (item.commissionAmount || 0), 0).toLocaleString()}
                                </td>
                                <td className="px-2 py-2 text-xs font-semibold text-green-600 text-right">
                                  ${allTourItems.reduce((sum, item) => {
                                    const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                                    const grandTotal = (item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0)
                                    return sum + (grandTotal - (item.commissionAmount || 0))
                                  }, 0).toLocaleString()}
                                </td>
                                <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-right">
                                  ${allTourItems.reduce((sum, item) => sum + (item.optionTotal || 0), 0).toLocaleString()}
                                </td>
                                <td className="px-2 py-2 text-xs font-semibold text-purple-600 text-right">
                                  ${groupTotal.toLocaleString()}
                                </td>
                                <td className="px-2 py-2 text-xs font-semibold text-teal-600 text-right">
                                  ${allTourItems.reduce((sum, item) => sum + (item.partnerReceivedAmount ?? 0), 0).toLocaleString()}
                                </td>
                                <td className="px-2 py-2 text-xs font-semibold text-amber-600 text-right">
                                  ${allTourItems.reduce((sum, item) => sum + (item.channelSettlementAmount ?? 0), 0).toLocaleString()}
                                </td>
                                <td className="px-2 py-2 text-xs text-gray-500 text-center">—</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                }

                // OTA 채널은 기존대로 채널별로 나누어 표시
                return (
                  <div key={group.type} className="border-b border-gray-200">
                    {/* 그룹 헤더 */}
                    <button
                      onClick={() => toggleGroup(group.type)}
                      className="w-full px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                    >
<div className="flex flex-wrap items-center gap-1.5 sm:gap-3 min-w-0">
                         {isGroupExpanded ? (
                             <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 flex-shrink-0" />
                           ) : (
                             <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 flex-shrink-0" />
                           )}
                         <span className="font-semibold text-gray-900 text-sm sm:text-base truncate">{group.label}</span>
                         <span className="text-xs sm:text-sm text-gray-500">({group.channels.length}개)</span>
                         <span className="text-xs sm:text-sm font-medium text-green-600">
                          총 ${groupTotal.toLocaleString()}
                        </span>
                      </div>
                    </button>

                    {/* 채널 목록 */}
                    {isGroupExpanded && (
                      <div className="bg-gray-50">
                        {group.channels.map(channel => {
                          const channelTourItems = getTourItemsByChannel(channel.id)
                          const isChannelExpanded = expandedChannels.has(channel.id)
                          
                          // 채널별 투어 아이템 정렬
                          const sortedChannelItems = channelTourItems.sort((a, b) => {
                            const dateA = new Date(a.tourDate).getTime()
                            const dateB = new Date(b.tourDate).getTime()
                            return tourSortOrder === 'asc' ? dateA - dateB : dateB - dateA
                          })

                          // 채널별 통계 계산 (투어 진행 내역)
                          const channelStats = sortedChannelItems.reduce((acc, item) => {
                            const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                            const grandTotal = (item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0)
                            const totalPrice = grandTotal - (item.commissionAmount || 0)
                            const netPrice = totalPrice + (item.optionTotal || 0)
                            
                            return {
                              grandTotal: acc.grandTotal + grandTotal,
                              commission: acc.commission + (item.commissionAmount || 0),
                              totalPrice: acc.totalPrice + totalPrice,
                              netPrice: acc.netPrice + netPrice
                            }
                          }, { grandTotal: 0, commission: 0, totalPrice: 0, netPrice: 0 })

                          return (
                            <div key={channel.id} className="border-t border-gray-200">
                              {/* 채널 헤더 */}
                              <button
                                onClick={() => toggleChannel(channel.id)}
                                className="w-full px-3 sm:px-8 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2 hover:bg-gray-100 transition-colors text-left"
                              >
                                <div className="flex items-center space-x-3">
                                  {isChannelExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-gray-500" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-gray-500" />
                                  )}
                                  <span className="font-medium text-gray-800">{channel.name}</span>
                                  <span className="text-xs text-gray-500">({sortedChannelItems.length}건)</span>
                                  <div className="flex items-center space-x-4 text-xs">
                                    <span className="font-medium text-green-600">
                                      Grand Total: ${channelStats.grandTotal.toLocaleString()}
                                    </span>
                                    <span className="font-medium text-blue-600">
                                      Commission: ${channelStats.commission.toLocaleString()}
                                    </span>
                                    <span className="font-medium text-purple-600">
                                      총 가격: ${channelStats.totalPrice.toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              </button>

                              {/* 채널 투어 진행 내역 테이블 */}
                              {isChannelExpanded && (
                                <div className="overflow-x-auto">
                                  <table className="w-full divide-y divide-gray-200 text-xs">
                                    <thead className="bg-white">
                                      <tr>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-20">상태</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">투어 날짜</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-32">고객명</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">채널RN</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase" style={{ width: '150px', minWidth: '150px', maxWidth: '150px' }}>상품명</th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-16">인원</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">성인 가격</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">상품가격 합계</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">할인총액</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">추가비용 총액</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">Grand Total</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">커미션</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">총 가격</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">옵션 총합</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">Net 가격</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">입금내역 (Partner Received)</th>
                                        <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">채널 정산 금액</th>
                                        <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase w-20">Audit</th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                      {sortedChannelItems.length === 0 ? (
                                        <tr>
                                          <td colSpan={18} className="px-2 py-3 text-center text-gray-500 text-xs">
                                            투어 진행 내역이 없습니다.
                                          </td>
                                        </tr>
                                      ) : (
                                        sortedChannelItems.map((item, idx) => {
                                          const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                                          const grandTotal = (item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0)
                                          const totalPrice = grandTotal - (item.commissionAmount || 0)
                                          const netPrice = totalPrice + (item.optionTotal || 0)
                                          const effectiveAudited = reservationAudit[item.id]?.amount_audited ?? item.amountAudited
                                          const effectiveAuditedAt = reservationAudit[item.id]?.amount_audited_at ?? item.amountAuditedAt
                                          const effectiveAuditedBy = reservationAudit[item.id]?.amount_audited_by ?? item.amountAuditedBy
                                          const auditTooltip = !canAudit
                                            ? 'Super 권한이 있는 사용자만 Audit 할 수 있습니다'
                                            : effectiveAudited && (effectiveAuditedBy || effectiveAuditedAt)
                                              ? `Audit: ${effectiveAuditedBy ?? '-'} / ${effectiveAuditedAt ? new Date(effectiveAuditedAt).toLocaleString('ko-KR') : '-'}`
                                              : '금액 더블체크 완료 시 체크'
                                          return (
                                            <tr 
                                              key={`${channel.id}-tour-${item.id}-${idx}`} 
                                              className="hover:bg-gray-50 cursor-pointer transition-colors"
                                              onClick={(e) => {
                                                if ((e.target as HTMLElement).closest('[data-audit-cell]')) return
                                                openReservationEditModal(item.id)
                                              }}
                                            >
                                              <td className="px-2 py-2 whitespace-nowrap text-xs w-20">
                                                <span className={`px-1.5 py-0.5 rounded text-xs ${getStatusColor(item.status)}`}>
                                                  {item.status === 'Confirmed' ? '확정' :
                                                   item.status === 'Pending' ? '대기' :
                                                   item.status === 'Canceled' ? '취소' :
                                                   item.status === 'Completed' ? '완료' :
                               item.status}
                            </span>
                          </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 w-24">
                                                {item.tourDate ? item.tourDate.split('T')[0] : '-'}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 w-32 truncate">
                                                {item.customerName}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 w-24 truncate">
                            {item.channelRN || '-'}
                          </td>
                                              <td className="px-2 py-2 text-xs text-gray-600 truncate" style={{ width: '150px', minWidth: '150px', maxWidth: '150px' }} title={item.productName}>
                                                {item.productName}
                                              </td>
                                       <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-600 text-center w-16">
                                         {item.totalPeople}
                                       </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right w-20">
                                                ${(item.adultPrice || 0).toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right w-24">
                                                ${(item.productPriceTotal || 0).toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-red-600 text-right w-20">
                                                -${discountTotal.toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-orange-600 text-right w-24">
                                                ${(item.additionalCost || 0).toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-green-600 font-semibold text-right w-24">
                                                ${grandTotal.toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-blue-600 text-right w-20">
                                                ${(item.commissionAmount || 0).toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-green-600 font-semibold text-right w-20">
                                                ${totalPrice.toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right w-20">
                                                ${(item.optionTotal || 0).toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-purple-600 font-semibold text-right w-24">
                                                ${netPrice.toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-teal-600 text-right w-24">
                                                ${(item.partnerReceivedAmount ?? 0).toLocaleString()}
                                              </td>
                                              <td className="px-2 py-2 whitespace-nowrap text-xs text-amber-600 text-right w-24">
                                                ${(item.channelSettlementAmount ?? 0).toLocaleString()}
                                              </td>
                                              <td data-audit-cell className="px-2 py-2 whitespace-nowrap text-center w-20" onClick={e => e.stopPropagation()} title={auditTooltip}>
                                                <input
                                                  type="checkbox"
                                                  checked={!!effectiveAudited}
                                                  disabled={!canAudit}
                                                  onChange={e => handleToggleAmountAudit(item.id, e.target.checked)}
                                                  className="rounded border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                                />
                                              </td>
                                            </tr>
                                          )
                                        })
                    )}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                                        <td colSpan={6} className="px-2 py-2 text-xs font-medium text-gray-900">
                        합계
                      </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-center w-16">
                                          {sortedChannelItems.reduce((sum, item) => sum + (item.totalPeople || 0), 0)}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-right">
                                          ${sortedChannelItems.reduce((sum, item) => sum + (item.adultPrice || 0), 0).toLocaleString()}
                      </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-right">
                                          ${sortedChannelItems.reduce((sum, item) => sum + (item.productPriceTotal || 0), 0).toLocaleString()}
                      </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-red-600 text-right">
                                          -${sortedChannelItems.reduce((sum, item) => sum + (item.couponDiscount || 0) + (item.additionalDiscount || 0), 0).toLocaleString()}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-orange-600 text-right">
                                          ${sortedChannelItems.reduce((sum, item) => sum + (item.additionalCost || 0), 0).toLocaleString()}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-green-600 text-right">
                                          ${sortedChannelItems.reduce((sum, item) => {
                                            const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                                            return sum + ((item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0))
                                          }, 0).toLocaleString()}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-blue-600 text-right">
                                          ${sortedChannelItems.reduce((sum, item) => sum + (item.commissionAmount || 0), 0).toLocaleString()}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-green-600 text-right">
                                          ${sortedChannelItems.reduce((sum, item) => {
                                            const discountTotal = (item.couponDiscount || 0) + (item.additionalDiscount || 0)
                                            const grandTotal = (item.productPriceTotal || 0) - discountTotal + (item.additionalCost || 0)
                                            return sum + (grandTotal - (item.commissionAmount || 0))
                                          }, 0).toLocaleString()}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-gray-700 text-right">
                                          ${sortedChannelItems.reduce((sum, item) => sum + (item.optionTotal || 0), 0).toLocaleString()}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-purple-600 text-right">
                                          ${channelStats.netPrice.toLocaleString()}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-teal-600 text-right">
                                          ${sortedChannelItems.reduce((sum, item) => sum + (item.partnerReceivedAmount ?? 0), 0).toLocaleString()}
                                        </td>
                                        <td className="px-2 py-2 text-xs font-semibold text-amber-600 text-right">
                                          ${sortedChannelItems.reduce((sum, item) => sum + (item.channelSettlementAmount ?? 0), 0).toLocaleString()}
                                        </td>
                                        <td className="px-2 py-2 text-xs text-gray-500 text-center">—</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
                )}
                            </div>
                          )
                        })}
              </div>
            )}
          </div>
                )
              })
      )}
          </div>
        )}
      </div>

      {/* 채널 선택 모달 */}
      {isChannelModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setIsChannelModalOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">채널 선택</h3>
              <button
                onClick={() => setIsChannelModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-120px)]">
              <div className="space-y-4">
                {/* 전체 채널 옵션 */}
                <button
                  onClick={() => {
                    onChannelChange?.('')
                    setIsChannelModalOpen(false)
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                    !channelFilter
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium">전체 채널</div>
                  <div className="text-sm text-gray-500 mt-1">모든 채널 표시</div>
                </button>

                {/* 채널 그룹별 표시 */}
                {channelGroups.map((group) => (
                  <div key={group.type} className="space-y-2">
                    <div className="text-sm font-semibold text-gray-700 px-2">
                      {group.label}
                    </div>
                    <div className="space-y-2">
                      {group.channels.map((channel) => (
                        <button
                          key={channel.id}
                          onClick={() => {
                            onChannelChange?.(channel.id)
                            setIsChannelModalOpen(false)
                          }}
                          className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                            channelFilter === channel.id
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="font-medium">{channel.name}</div>
                          {channel.type && (
                            <div className="text-xs text-gray-500 mt-1">
                              {channel.type}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {channelGroups.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    채널 데이터가 없습니다.
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200">
              <button
                onClick={() => setIsChannelModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 예약 수정 모달 */}
      {editingReservation && (
        <ReservationForm
          reservation={editingReservation}
          customers={customers || []}
          products={products || []}
          channels={(channels || []) as any}
          productOptions={productOptions || []}
          options={options || []}
          pickupHotels={(pickupHotels || []) as any}
          coupons={(coupons || []) as any}
          onSubmit={handleEditReservation}
          onCancel={() => setEditingReservation(null)}
          onRefreshCustomers={refreshCustomers}
          onDelete={handleDeleteReservation}
          layout="modal"
          allowPastDateEdit={isSuper || isSuperByEmail}
        />
      )}
    </div>
  )
}

