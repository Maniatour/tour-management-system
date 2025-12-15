'use client'

import React, { useState, useEffect } from 'react'
import { createClientSupabase } from '@/lib/supabase'
import { Database } from '@/lib/database.types'

type Customer = Database['public']['Tables']['customers']['Row']
type Reservation = Database['public']['Tables']['reservations']['Row']
type ReservationPricing = Database['public']['Tables']['reservation_pricing']['Row']
type ReservationOption = Database['public']['Tables']['reservation_options']['Row']
type Payment = Database['public']['Tables']['payment_records']['Row']
type TicketBooking = Database['public']['Tables']['ticket_bookings']['Row']
type TourHotelBooking = Database['public']['Tables']['tour_hotel_bookings']['Row']
type Tour = Database['public']['Tables']['tours']['Row']
type Team = Database['public']['Tables']['team']['Row']
type Product = Database['public']['Tables']['products']['Row']

interface AdminDataReviewProps {
  params: Promise<{ locale: string }>
}

interface ReviewIssue {
  id: string
  type: string
  description: string
  severity: 'low' | 'medium' | 'high'
  data: any
}

interface TabCounts {
  customers: number
  reservations: number
  reservationPricing: number
  reservationOptions: number
  payments: number
  ticketBookings: number
  tourHotelBookings: number
  tours: number
  teams: number
  products: number
}

export default function AdminDataReview({ }: AdminDataReviewProps) {
  const [activeTab, setActiveTab] = useState<string>('customers')
  const [loading, setLoading] = useState(true)
  const [tabCounts, setTabCounts] = useState<TabCounts>({
    customers: 0,
    reservations: 0,
    reservationPricing: 0,
    reservationOptions: 0,
    payments: 0,
    ticketBookings: 0,
    tourHotelBookings: 0,
    tours: 0,
    teams: 0,
    products: 0
  })
  const [issues, setIssues] = useState<ReviewIssue[]>([])
  const [filteredIssues, setFilteredIssues] = useState<ReviewIssue[]>([])
  const [editingItem, setEditingItem] = useState<any>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [pricingSubTab, setPricingSubTab] = useState<string>('all')

  const supabase = createClientSupabase()

  useEffect(() => {
    loadReviewData()
  }, [])

  useEffect(() => {
    let filtered = issues.filter(issue => {
      // 예약 가격 탭은 모든 reservationPricing1-6 타입을 포함
      if (activeTab === 'reservationPricing') {
        return issue.type.startsWith('reservationPricing')
      }
      return issue.type === activeTab
    })
    
    // 고객 탭에서 필터 적용
    if (activeTab === 'customers' && activeFilter !== 'all') {
      filtered = filtered.filter(issue => {
        if (activeFilter === 'language') {
          return issue.description === '언어 정보가 없습니다'
        } else if (activeFilter === 'email') {
          return issue.description === '이메일 정보가 없습니다'
        } else if (activeFilter === 'phone') {
          return issue.description === '전화번호 정보가 없습니다'
        } else if (activeFilter === 'channel') {
          return issue.description === '채널 정보가 없습니다'
        }
        return true
      })
    }
    
    // 예약 탭에서 필터 적용
    if (activeTab === 'reservations') {
      // 기본 필터 적용
      if (activeFilter !== 'all') {
        filtered = filtered.filter(issue => {
          if (activeFilter === 'pickup') {
            return issue.description.includes('픽업')
        } else if (activeFilter === 'channel_rn') {
          return issue.description === '채널 ID가 없습니다'
          } else if (activeFilter === 'status') {
            return issue.description === '상태 정보가 없습니다'
          } else if (activeFilter === 'tour_id') {
            return issue.description === '투어 ID가 없습니다'
          } else if (activeFilter === 'choices') {
            return issue.description === '선택사항 정보가 없습니다'
          }
          return true
        })
      }
      
      // 상태 필터 적용
      if (statusFilter !== 'all') {
        filtered = filtered.filter(issue => {
          return issue.data.status === statusFilter
        })
      }
    }
    
    // 예약 가격 탭에서 하위 탭 필터 적용
    if (activeTab === 'reservationPricing' && pricingSubTab !== 'all') {
      filtered = filtered.filter(issue => issue.type === pricingSubTab)
    }
    
    setFilteredIssues(filtered)
  }, [activeTab, issues, activeFilter, statusFilter, pricingSubTab])

  const loadReviewData = async () => {
    try {
      setLoading(true)
      
      // 각 테이블별 검수 데이터 로드
      await Promise.all([
        checkCustomers(),
        checkReservations(),
        checkReservationPricing(),
        checkReservationOptions(),
        checkPayments(),
        checkTicketBookings(),
        checkTourHotelBookings(),
        checkTours(),
        checkTeams(),
        checkProducts()
      ])
    } catch (error) {
      console.error('Error loading review data:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkCustomers = async () => {
    const { data: customers, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching customers:', error)
      return
    }

    const customerIssues: ReviewIssue[] = []
    let count = 0

    customers?.forEach(customer => {
      // 언어가 없는 고객
      if (!customer.language) {
        customerIssues.push({
          id: customer.id,
          type: 'customers',
          description: '언어 정보가 없습니다',
          severity: 'medium',
          data: customer
        })
        count++
      }

      // 이메일이 없는 고객
      if (!customer.email) {
        customerIssues.push({
          id: customer.id,
          type: 'customers',
          description: '이메일 정보가 없습니다',
          severity: 'high',
          data: customer
        })
        count++
      }

      // 전화번호가 없는 고객
      if (!customer.phone) {
        customerIssues.push({
          id: customer.id,
          type: 'customers',
          description: '전화번호 정보가 없습니다',
          severity: 'medium',
          data: customer
        })
        count++
      }

      // 채널 ID가 없는 고객
      if (!customer.channel_id) {
        customerIssues.push({
          id: customer.id,
          type: 'customers',
          description: '채널 정보가 없습니다',
          severity: 'medium',
          data: customer
        })
        count++
      }
    })

    setIssues(prev => [...prev, ...customerIssues])
    setTabCounts(prev => ({ ...prev, customers: count }))
  }

  const checkReservations = async () => {
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('*')
      .gte('tour_date', new Date().toISOString().split('T')[0]) // 오늘 날짜 이후만
      .order('tour_date', { ascending: true }) // 투어 날짜 기준 오름차순 (가까운 순)

    if (error) {
      console.error('Error fetching reservations:', error)
      return
    }

    // 고객 정보 가져오기
    const customerIds = [...new Set(reservations?.map(r => r.customer_id).filter(Boolean) || [])]
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name')
      .in('id', customerIds)

    // 채널 정보 가져오기
    const channelIds = [...new Set(reservations?.map(r => r.channel_id).filter(Boolean) || [])]
    const { data: channels } = await supabase
      .from('channels')
      .select('id, name')
      .in('id', channelIds)

    // 고객과 채널 정보를 맵으로 변환
    const customerMap = new Map(customers?.map(c => [c.id, c.name]) || [])
    const channelMap = new Map(channels?.map(c => [c.id, c.name]) || [])

    const reservationIssues: ReviewIssue[] = []
    let count = 0

    reservations?.forEach(reservation => {
      // 픽업 정보가 없는 예약 (시간 또는 호텔 중 하나라도 없으면)
      if (!reservation.pickup_time || !reservation.pickup_hotel) {
        const missingItems = []
        if (!reservation.pickup_time) missingItems.push('시간')
        if (!reservation.pickup_hotel) missingItems.push('호텔')
        
        reservationIssues.push({
          id: reservation.id,
          type: 'reservations',
          description: `픽업 ${missingItems.join(', ')} 정보가 없습니다`,
          severity: 'high',
          data: {
            ...reservation,
            customer_name: customerMap.get(reservation.customer_id) || '-',
            channel_name: channelMap.get(reservation.channel_id) || '-'
          }
        })
        count++
      }

      // 채널 ID가 없는 예약
      if (!reservation.channel_id) {
        reservationIssues.push({
          id: reservation.id,
          type: 'reservations',
          description: '채널 ID가 없습니다',
          severity: 'medium',
          data: {
            ...reservation,
            customer_name: customerMap.get(reservation.customer_id) || '-',
            channel_name: channelMap.get(reservation.channel_id) || '-'
          }
        })
        count++
      }

      // 상태 정보가 없는 예약
      if (!reservation.status) {
        reservationIssues.push({
          id: reservation.id,
          type: 'reservations',
          description: '상태 정보가 없습니다',
          severity: 'medium',
          data: {
            ...reservation,
            customer_name: customerMap.get(reservation.customer_id) || '-',
            channel_name: channelMap.get(reservation.channel_id) || '-'
          }
        })
        count++
      }

      // 투어 ID가 없는 예약
      if (!reservation.tour_id) {
        reservationIssues.push({
          id: reservation.id,
          type: 'reservations',
          description: '투어 ID가 없습니다',
          severity: 'high',
          data: {
            ...reservation,
            customer_name: customerMap.get(reservation.customer_id) || '-',
            channel_name: channelMap.get(reservation.channel_id) || '-'
          }
        })
        count++
      }

      // 선택사항 정보가 없는 예약
      if (!reservation.choices) {
        reservationIssues.push({
          id: reservation.id,
          type: 'reservations',
          description: '선택사항 정보가 없습니다',
          severity: 'medium',
          data: {
            ...reservation,
            customer_name: customerMap.get(reservation.customer_id) || '-',
            channel_name: channelMap.get(reservation.channel_id) || '-'
          }
        })
        count++
      }
    })

    setIssues(prev => [...prev, ...reservationIssues])
    setTabCounts(prev => ({ ...prev, reservations: count }))
  }

  const checkReservationPricing = async () => {
    // 예약 가격 데이터 가져오기
    const { data: pricing, error: pricingError } = await supabase
      .from('reservation_pricing')
      .select('*')

    if (pricingError) {
      console.error('Error fetching reservation pricing:', pricingError)
      return
    }

    // 예약 데이터 가져오기
    const { data: reservations, error: reservationsError } = await supabase
      .from('reservations')
      .select('id, adults, child, infant, product_id')

    if (reservationsError) {
      console.error('Error fetching reservations:', reservationsError)
      return
    }

    // 예약 옵션 데이터 가져오기
    const { data: options, error: optionsError } = await supabase
      .from('reservation_options')
      .select('*')

    if (optionsError) {
      console.error('Error fetching reservation options:', optionsError)
      return
    }

    // 결제 데이터 가져오기
    const { data: payments, error: paymentsError } = await supabase
      .from('payment_records')
      .select('*')

    if (paymentsError) {
      console.error('Error fetching payments:', paymentsError)
      return
    }

    // 상품 데이터 가져오기 (sub_category 확인용)
    const productIds = [...new Set(reservations?.map(r => r.product_id).filter(Boolean) || [])]
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, sub_category')
      .in('id', productIds)

    if (productsError) {
      console.error('Error fetching products:', productsError)
      return
    }

    const pricingIssues: ReviewIssue[] = []
    const counts = {
      reservationPricing1: 0,
      reservationPricing2: 0,
      reservationPricing3: 0,
      reservationPricing4: 0,
      reservationPricing5: 0,
      reservationPricing6: 0
    }

    // 예약 데이터를 맵으로 변환
    const reservationMap = new Map(reservations?.map(r => [r.id, r]) || [])
    const productMap = new Map(products?.map(p => [p.id, p]) || [])
    const optionsMap = new Map()
    const paymentsMap = new Map()

    // 예약 옵션을 예약 ID별로 그룹화
    options?.forEach(option => {
      if (!optionsMap.has(option.reservation_id)) {
        optionsMap.set(option.reservation_id, [])
      }
      optionsMap.get(option.reservation_id).push(option)
    })

    // 결제를 예약 ID별로 그룹화
    payments?.forEach(payment => {
      if (payment.payment_status !== 'canceled') {
        if (!paymentsMap.has(payment.reservation_id)) {
          paymentsMap.set(payment.reservation_id, [])
        }
        paymentsMap.get(payment.reservation_id).push(payment)
      }
    })

    pricing?.forEach(price => {
      const reservation = reservationMap.get(price.reservation_id)
      if (!reservation) return

      // 1. 기본 가격 계산 검증
      const product = productMap.get(reservation.product_id)
      const isServiceProduct = product?.sub_category === 'Mania Service' || product?.sub_category === 'Agency Service'
      
      let calculatedProductTotal
      if (isServiceProduct) {
        // Mania Service 또는 Agency Service는 단일가 적용
        calculatedProductTotal = price.adult_product_price
      } else {
        // 일반 상품은 인원별 계산
        calculatedProductTotal = 
          (price.adult_product_price * reservation.adults) +
          (price.child_product_price * reservation.child) +
          (price.infant_product_price * reservation.infant)
      }

      if (Math.abs(calculatedProductTotal - price.product_price_total) > 0.01) {
        pricingIssues.push({
          id: price.id,
          type: 'reservationPricing1',
          description: `기본 가격 계산 오류: 계산값 ${calculatedProductTotal} ≠ 저장값 ${price.product_price_total}`,
          severity: 'high',
          data: { ...price, reservation, calculatedProductTotal }
        })
        counts.reservationPricing1++
      }

      // 2. 옵션 가격 계산 검증
      const reservationOptions = optionsMap.get(price.reservation_id) || []
      const calculatedOptionTotal = reservationOptions.reduce((sum, option) => 
        sum + (option.ea * option.price), 0)

      if (Math.abs(calculatedOptionTotal - price.option_total) > 0.01) {
        pricingIssues.push({
          id: price.id,
          type: 'reservationPricing2',
          description: `옵션 가격 계산 오류: 계산값 ${calculatedOptionTotal} ≠ 저장값 ${price.option_total}`,
          severity: 'high',
          data: { ...price, reservationOptions, calculatedOptionTotal }
        })
        counts.reservationPricing2++
      }

      // 3. 소계 계산 검증
      const subtotal = price.product_price_total + price.option_total
      if (Math.abs(subtotal - price.subtotal) > 0.01) {
        pricingIssues.push({
          id: price.id,
          type: 'reservationPricing3',
          description: `소계 계산 오류: 계산값 ${subtotal} ≠ 저장값 ${price.subtotal}`,
          severity: 'high',
          data: { ...price, calculatedSubtotal: subtotal }
        })
        counts.reservationPricing3++
      }

      // 4. 총 가격 계산 검증
      const totalPrice = price.subtotal - 
        (price.coupon_discount || 0) - 
        (price.additional_discount || 0) + 
        (price.additional_cost || 0) - 
        (price.card_fee || 0) + 
        (price.tax || 0) + 
        (price.prepayment_cost || 0) + 
        (price.prepayment_tip || 0) + 
        (price.private_tour_additional_cost || 0)

      if (Math.abs(totalPrice - price.total_price) > 0.01) {
        pricingIssues.push({
          id: price.id,
          type: 'reservationPricing4',
          description: `총 가격 계산 오류: 계산값 ${totalPrice} ≠ 저장값 ${price.total_price}`,
          severity: 'high',
          data: { ...price, calculatedTotalPrice: totalPrice }
        })
        counts.reservationPricing4++
      }

      // 5. 잔액 계산 검증
      const balanceAmount = price.total_price - price.deposit_amount - (price.commission_amount || 0)
      if (Math.abs(balanceAmount - price.balance_amount) > 0.01) {
        pricingIssues.push({
          id: price.id,
          type: 'reservationPricing5',
          description: `잔액 계산 오류: 계산값 ${balanceAmount} ≠ 저장값 ${price.balance_amount}`,
          severity: 'high',
          data: { ...price, calculatedBalanceAmount: balanceAmount }
        })
        counts.reservationPricing5++
      }

      // 6. 결제 금액 검증
      const reservationPayments = paymentsMap.get(price.reservation_id) || []
      const totalPaymentAmount = reservationPayments.reduce((sum, payment) => sum + payment.amount, 0)

      if (Math.abs(totalPaymentAmount - price.deposit_amount) > 0.01) {
        pricingIssues.push({
          id: price.id,
          type: 'reservationPricing6',
          description: `결제 금액 불일치: 결제총액 ${totalPaymentAmount} ≠ 예약금 ${price.deposit_amount}`,
          severity: 'high',
          data: { ...price, reservationPayments, totalPaymentAmount }
        })
        counts.reservationPricing6++
      }
    })

    setIssues(prev => [...prev, ...pricingIssues])
    setTabCounts(prev => ({ 
      ...prev, 
      reservationPricing: counts.reservationPricing1 + counts.reservationPricing2 + counts.reservationPricing3 + counts.reservationPricing4 + counts.reservationPricing5 + counts.reservationPricing6
    }))
  }

  const checkReservationOptions = async () => {
    const { data: options, error } = await supabase
      .from('reservation_options')
      .select('*')

    if (error) {
      console.error('Error fetching reservation options:', error)
      return
    }

    const optionIssues: ReviewIssue[] = []
    let count = 0

    options?.forEach(option => {
      // 예약 ID가 없는 경우
      if (!option.reservation_id) {
        optionIssues.push({
          id: option.id,
          type: 'reservationOptions',
          description: '예약 정보가 연결되지 않았습니다',
          severity: 'high',
          data: option
        })
        count++
      }

      // 옵션 ID가 없는 경우
      if (!option.option_id) {
        optionIssues.push({
          id: option.id,
          type: 'reservationOptions',
          description: '옵션 정보가 연결되지 않았습니다',
          severity: 'high',
          data: option
        })
        count++
      }

      // 수량이 0인 경우
      if (option.ea === 0) {
        optionIssues.push({
          id: option.id,
          type: 'reservationOptions',
          description: '수량이 0입니다',
          severity: 'medium',
          data: option
        })
        count++
      }
    })

    setIssues(prev => [...prev, ...optionIssues])
    setTabCounts(prev => ({ ...prev, reservationOptions: count }))
  }

  const checkPayments = async () => {
    const { data: payments, error } = await supabase
      .from('payment_records')
      .select('*')

    if (error) {
      console.error('Error fetching payments:', error)
      return
    }

    const paymentIssues: ReviewIssue[] = []
    let count = 0

    payments?.forEach(payment => {
      // 예약 ID가 없는 경우
      if (!payment.reservation_id) {
        paymentIssues.push({
          id: payment.id,
          type: 'payments',
          description: '예약 정보가 연결되지 않았습니다',
          severity: 'high',
          data: payment
        })
        count++
      }

      // 결제 방법이 없는 경우
      if (!payment.payment_method) {
        paymentIssues.push({
          id: payment.id,
          type: 'payments',
          description: '결제 방법 정보가 없습니다',
          severity: 'medium',
          data: payment
        })
        count++
      }

      // 금액이 0인 경우
      if (payment.amount === 0) {
        paymentIssues.push({
          id: payment.id,
          type: 'payments',
          description: '결제 금액이 0입니다',
          severity: 'high',
          data: payment
        })
        count++
      }
    })

    setIssues(prev => [...prev, ...paymentIssues])
    setTabCounts(prev => ({ ...prev, payments: count }))
  }

  const checkTicketBookings = async () => {
    const { data: tickets, error } = await supabase
      .from('ticket_bookings')
      .select('*')

    if (error) {
      console.error('Error fetching ticket bookings:', error)
      return
    }

    const ticketIssues: ReviewIssue[] = []
    let count = 0

    tickets?.forEach(ticket => {
      // 투어 ID가 없는 경우
      if (!ticket.tour_id) {
        ticketIssues.push({
          id: ticket.id,
          type: 'ticketBookings',
          description: '투어 정보가 연결되지 않았습니다',
          severity: 'high',
          data: ticket
        })
        count++
      }

      // 회사 정보가 없는 경우
      if (!ticket.company) {
        ticketIssues.push({
          id: ticket.id,
          type: 'ticketBookings',
          description: '회사 정보가 없습니다',
          severity: 'medium',
          data: ticket
        })
        count++
      }
    })

    setIssues(prev => [...prev, ...ticketIssues])
    setTabCounts(prev => ({ ...prev, ticketBookings: count }))
  }

  const checkTourHotelBookings = async () => {
    const { data: hotels, error } = await supabase
      .from('tour_hotel_bookings')
      .select('*')

    if (error) {
      console.error('Error fetching tour hotel bookings:', error)
      return
    }

    const hotelIssues: ReviewIssue[] = []
    let count = 0

    hotels?.forEach(hotel => {
      // 투어 ID가 없는 경우
      if (!hotel.tour_id) {
        hotelIssues.push({
          id: hotel.id,
          type: 'tourHotelBookings',
          description: '투어 정보가 연결되지 않았습니다',
          severity: 'high',
          data: hotel
        })
        count++
      }

      // 호텔명이 없는 경우
      if (!hotel.hotel_name) {
        hotelIssues.push({
          id: hotel.id,
          type: 'tourHotelBookings',
          description: '호텔명이 없습니다',
          severity: 'medium',
          data: hotel
        })
        count++
      }

      // 체크인 날짜가 없는 경우
      if (!hotel.check_in_date) {
        hotelIssues.push({
          id: hotel.id,
          type: 'tourHotelBookings',
          description: '체크인 날짜가 없습니다',
          severity: 'medium',
          data: hotel
        })
        count++
      }
    })

    setIssues(prev => [...prev, ...hotelIssues])
    setTabCounts(prev => ({ ...prev, tourHotelBookings: count }))
  }

  const checkTours = async () => {
    const { data: tours, error } = await supabase
      .from('tours')
      .select('*')

    if (error) {
      console.error('Error fetching tours:', error)
      return
    }

    const tourIssues: ReviewIssue[] = []
    let count = 0

    tours?.forEach(tour => {
      // 상품 ID가 없는 경우
      if (!tour.product_id) {
        tourIssues.push({
          id: tour.id,
          type: 'tours',
          description: '상품 정보가 연결되지 않았습니다',
          severity: 'high',
          data: tour
        })
        count++
      }

      // 투어 가이드가 없는 경우
      if (!tour.tour_guide_id) {
        tourIssues.push({
          id: tour.id,
          type: 'tours',
          description: '투어 가이드가 배정되지 않았습니다',
          severity: 'medium',
          data: tour
        })
        count++
      }

      // 투어 상태가 없는 경우
      if (!tour.tour_status) {
        tourIssues.push({
          id: tour.id,
          type: 'tours',
          description: '투어 상태가 설정되지 않았습니다',
          severity: 'medium',
          data: tour
        })
        count++
      }
    })

    setIssues(prev => [...prev, ...tourIssues])
    setTabCounts(prev => ({ ...prev, tours: count }))
  }

  const checkTeams = async () => {
    const { data: teams, error } = await supabase
      .from('team')
      .select('*')

    if (error) {
      console.error('Error fetching teams:', error)
      return
    }

    const teamIssues: ReviewIssue[] = []
    let count = 0

    teams?.forEach(team => {
      // 영어 이름이 없는 경우
      if (!team.name_en) {
        teamIssues.push({
          id: team.email,
          type: 'teams',
          description: '영어 이름이 없습니다',
          severity: 'medium',
          data: team
        })
        count++
      }

      // 전화번호가 없는 경우
      if (!team.phone) {
        teamIssues.push({
          id: team.email,
          type: 'teams',
          description: '전화번호가 없습니다',
          severity: 'medium',
          data: team
        })
        count++
      }

      // 언어 정보가 없는 경우
      if (!team.languages || team.languages.length === 0) {
        teamIssues.push({
          id: team.email,
          type: 'teams',
          description: '언어 정보가 없습니다',
          severity: 'medium',
          data: team
        })
        count++
      }
    })

    setIssues(prev => [...prev, ...teamIssues])
    setTabCounts(prev => ({ ...prev, teams: count }))
  }

  const checkProducts = async () => {
    const { data: products, error } = await supabase
      .from('products')
      .select('*')

    if (error) {
      console.error('Error fetching products:', error)
      return
    }

    const productIssues: ReviewIssue[] = []
    let count = 0

    products?.forEach(product => {
      // 영어 이름이 없는 경우
      if (!product.name_en) {
        productIssues.push({
          id: product.id,
          type: 'products',
          description: '영어 이름이 없습니다',
          severity: 'medium',
          data: product
        })
        count++
      }

      // 상품 코드가 없는 경우
      if (!product.product_code) {
        productIssues.push({
          id: product.id,
          type: 'products',
          description: '상품 코드가 없습니다',
          severity: 'medium',
          data: product
        })
        count++
      }

      // 카테고리가 없는 경우
      if (!product.category) {
        productIssues.push({
          id: product.id,
          type: 'products',
          description: '카테고리가 설정되지 않았습니다',
          severity: 'medium',
          data: product
        })
        count++
      }

      // 기본 가격이 없는 경우
      if (!product.base_price || product.base_price === 0) {
        productIssues.push({
          id: product.id,
          type: 'products',
          description: '기본 가격이 설정되지 않았습니다',
          severity: 'high',
          data: product
        })
        count++
      }
    })

    setIssues(prev => [...prev, ...productIssues])
    setTabCounts(prev => ({ ...prev, products: count }))
  }

  const handleEditItem = (item: any) => {
    // 예약 관련 탭인 경우 예약 상세 페이지로 이동
    if (activeTab === 'reservations' || activeTab.startsWith('reservationPricing')) {
      // 예약 가격 탭의 경우 reservation_id를 사용
      const reservationId = activeTab.startsWith('reservationPricing') 
        ? (item.data?.reservation_id || item.reservation_id || item.id) 
        : item.id
      
      if (!reservationId) {
        console.error('예약 ID를 찾을 수 없습니다:', item)
        alert('예약 ID를 찾을 수 없습니다.')
        return
      }
      
      window.location.href = `/ko/admin/reservations/${reservationId}`
      return
    }
    
    setEditingItem(item)
    setEditModalOpen(true)
  }

  const handleSaveEdit = async (updatedData: any) => {
    try {
      const tableName = activeTab.startsWith('reservationPricing') ? 'reservation_pricing' :
                       activeTab === 'reservationOptions' ? 'reservation_options' :
                       activeTab === 'ticketBookings' ? 'ticket_bookings' :
                       activeTab === 'tourHotelBookings' ? 'tour_hotel_bookings' :
                       activeTab === 'teams' ? 'team' :
                       activeTab === 'products' ? 'products' :
                       activeTab === 'customers' ? 'customers' :
                       activeTab === 'reservations' ? 'reservations' :
                       activeTab === 'payments' ? 'payment_records' :
                       activeTab === 'tours' ? 'tours' : activeTab

      const { error } = await supabase
        .from(tableName)
        .update(updatedData)
        .eq('id', editingItem.id)

      if (error) {
        console.error('Error updating data:', error)
        return
      }

      setEditModalOpen(false)
      setEditingItem(null)
      await loadReviewData() // 데이터 다시 로드
    } catch (error) {
      console.error('Error saving edit:', error)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-50'
      case 'medium': return 'text-yellow-600 bg-yellow-50'
      case 'low': return 'text-blue-600 bg-blue-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const tabs = [
    { key: 'customers', label: '고객', count: tabCounts.customers },
    { key: 'reservations', label: '예약', count: tabCounts.reservations },
    { key: 'reservationPricing', label: '예약 가격', count: tabCounts.reservationPricing },
    { key: 'reservationOptions', label: '예약 옵션', count: tabCounts.reservationOptions },
    { key: 'payments', label: '결제', count: tabCounts.payments },
    { key: 'ticketBookings', label: '티켓 예약', count: tabCounts.ticketBookings },
    { key: 'tourHotelBookings', label: '투어 호텔', count: tabCounts.tourHotelBookings },
    { key: 'tours', label: '투어', count: tabCounts.tours },
    { key: 'teams', label: '팀', count: tabCounts.teams },
    { key: 'products', label: '상품', count: tabCounts.products }
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">데이터를 검수하는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">데이터 검수</h1>
          <p className="text-gray-600">각 테이블의 데이터 품질을 검수하고 수정할 수 있습니다.</p>
        </div>

        {/* 탭 메뉴 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`ml-2 py-0.5 px-2 rounded-full text-xs font-medium ${
                      activeTab === tab.key ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* 검수 결과 목록 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">
                {tabs.find(tab => tab.key === activeTab)?.label} 검수 결과
                <span className="ml-2 text-sm text-gray-500">
                  ({filteredIssues.length}개 항목)
                </span>
              </h2>
              
              {/* 고객 탭 필터 버튼 */}
              {activeTab === 'customers' && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => setActiveFilter('all')}
                    className={`px-3 py-1 text-sm rounded-md ${
                      activeFilter === 'all'
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    전체
                  </button>
                  <button
                    onClick={() => setActiveFilter('language')}
                    className={`px-3 py-1 text-sm rounded-md ${
                      activeFilter === 'language'
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    언어
                  </button>
                  <button
                    onClick={() => setActiveFilter('email')}
                    className={`px-3 py-1 text-sm rounded-md ${
                      activeFilter === 'email'
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    이메일
                  </button>
                  <button
                    onClick={() => setActiveFilter('phone')}
                    className={`px-3 py-1 text-sm rounded-md ${
                      activeFilter === 'phone'
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    전화번호
                  </button>
                  <button
                    onClick={() => setActiveFilter('channel')}
                    className={`px-3 py-1 text-sm rounded-md ${
                      activeFilter === 'channel'
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    채널
                  </button>
                </div>
              )}
              
              {/* 예약 가격 탭 하위 탭 */}
              {activeTab === 'reservationPricing' && (
                <div className="flex space-x-2 flex-wrap">
                  <button
                    onClick={() => setPricingSubTab('all')}
                    className={`px-3 py-1 text-sm rounded-md ${
                      pricingSubTab === 'all'
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    전체
                  </button>
                  <button
                    onClick={() => setPricingSubTab('reservationPricing1')}
                    className={`px-3 py-1 text-sm rounded-md ${
                      pricingSubTab === 'reservationPricing1'
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    기본가격
                  </button>
                  <button
                    onClick={() => setPricingSubTab('reservationPricing2')}
                    className={`px-3 py-1 text-sm rounded-md ${
                      pricingSubTab === 'reservationPricing2'
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    옵션가격
                  </button>
                  <button
                    onClick={() => setPricingSubTab('reservationPricing3')}
                    className={`px-3 py-1 text-sm rounded-md ${
                      pricingSubTab === 'reservationPricing3'
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    소계
                  </button>
                  <button
                    onClick={() => setPricingSubTab('reservationPricing4')}
                    className={`px-3 py-1 text-sm rounded-md ${
                      pricingSubTab === 'reservationPricing4'
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    총가격
                  </button>
                  <button
                    onClick={() => setPricingSubTab('reservationPricing5')}
                    className={`px-3 py-1 text-sm rounded-md ${
                      pricingSubTab === 'reservationPricing5'
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    잔액
                  </button>
                  <button
                    onClick={() => setPricingSubTab('reservationPricing6')}
                    className={`px-3 py-1 text-sm rounded-md ${
                      pricingSubTab === 'reservationPricing6'
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    결제금액
                  </button>
                </div>
              )}
              
              {/* 예약 탭 필터 버튼 */}
              {activeTab === 'reservations' && (
                <div className="space-y-3">
                  {/* 기본 필터 버튼들 */}
                  <div className="flex space-x-2 flex-wrap">
                    <button
                      onClick={() => setActiveFilter('all')}
                      className={`px-3 py-1 text-sm rounded-md ${
                        activeFilter === 'all'
                          ? 'bg-blue-100 text-blue-700 border border-blue-200'
                          : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      전체
                    </button>
                    <button
                      onClick={() => setActiveFilter('pickup')}
                      className={`px-3 py-1 text-sm rounded-md ${
                        activeFilter === 'pickup'
                          ? 'bg-blue-100 text-blue-700 border border-blue-200'
                          : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      픽업
                    </button>
                    <button
                      onClick={() => setActiveFilter('channel_rn')}
                      className={`px-3 py-1 text-sm rounded-md ${
                        activeFilter === 'channel_rn'
                          ? 'bg-blue-100 text-blue-700 border border-blue-200'
                          : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      채널
                    </button>
                    <button
                      onClick={() => setActiveFilter('status')}
                      className={`px-3 py-1 text-sm rounded-md ${
                        activeFilter === 'status'
                          ? 'bg-blue-100 text-blue-700 border border-blue-200'
                          : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      상태
                    </button>
                    <button
                      onClick={() => setActiveFilter('tour_id')}
                      className={`px-3 py-1 text-sm rounded-md ${
                        activeFilter === 'tour_id'
                          ? 'bg-blue-100 text-blue-700 border border-blue-200'
                          : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      투어ID
                    </button>
                    <button
                      onClick={() => setActiveFilter('choices')}
                      className={`px-3 py-1 text-sm rounded-md ${
                        activeFilter === 'choices'
                          ? 'bg-blue-100 text-blue-700 border border-blue-200'
                          : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      선택사항
                    </button>
                  </div>
                  
                  {/* 상태 드롭다운 */}
                  <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium text-gray-700">상태별 필터:</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">전체 상태</option>
                      <option value="Canceled">Canceled</option>
                      <option value="Pending">Pending</option>
                      <option value="Confirmed">Confirmed</option>
                      <option value="Recruiting">Recruiting</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {filteredIssues.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="text-gray-400 mb-2">
                  <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">검수할 항목이 없습니다</h3>
                <p className="text-gray-500">이 테이블의 모든 데이터가 정상입니다.</p>
              </div>
            ) : (
              filteredIssues.map((issue, index) => (
                <div key={`${issue.type}-${issue.id}-${index}`} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(issue.severity)}`}>
                          {issue.severity === 'high' ? '높음' : issue.severity === 'medium' ? '보통' : '낮음'}
                        </span>
                        <h3 className="text-sm font-medium text-gray-900">{issue.description}</h3>
                      </div>
                      
                      {/* 고객 정보 상세 표시 */}
                      {activeTab === 'customers' && (
                        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">이름:</span>
                            <div className="text-gray-900">{issue.data.name || '-'}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">전화번호:</span>
                            <div className="text-gray-900">{issue.data.phone || '-'}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">이메일:</span>
                            <div className="text-gray-900">{issue.data.email || '-'}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">상태:</span>
                            <div className="text-gray-900">{issue.data.status || '-'}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">생성일:</span>
                            <div className="text-gray-900">
                              {issue.data.created_at ? new Date(issue.data.created_at).toLocaleDateString('ko-KR') : '-'}
                            </div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">채널 ID:</span>
                            <div className="text-gray-900">{issue.data.channel_id || '-'}</div>
                          </div>
                        </div>
                      )}
                      
                      {/* 예약 정보 상세 표시 */}
                      {activeTab === 'reservations' && (
                        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">투어날짜:</span>
                            <div className="text-gray-900">
                              {issue.data.tour_date || '-'}
                            </div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">고객명:</span>
                            <div className="text-gray-900">{issue.data.customer_name || '-'}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">총인원:</span>
                            <div className="text-gray-900">{issue.data.total_people || '-'}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">픽업시간:</span>
                            <div className="text-gray-900">{issue.data.pickup_time || '-'}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">픽업호텔:</span>
                            <div className="text-gray-900">{issue.data.pickup_hotel || '-'}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">채널:</span>
                            <div className="text-gray-900">{issue.data.channel_name || '-'}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">상태:</span>
                            <div className="text-gray-900">{issue.data.status || '-'}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">투어ID:</span>
                            <div className="text-gray-900">{issue.data.tour_id || '-'}</div>
                          </div>
                        </div>
                      )}
                      
                      <div className="mt-2 text-sm text-gray-500">
                        ID: {issue.id}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEditItem(issue.data)}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        수정
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 수정 모달 */}
        {editModalOpen && editingItem && (
          <EditModal
            item={editingItem}
            tableType={activeTab}
            onSave={handleSaveEdit}
            onClose={() => {
              setEditModalOpen(false)
              setEditingItem(null)
            }}
          />
        )}
      </div>
    </div>
  )
}

// 수정 모달 컴포넌트
interface EditModalProps {
  item: any
  tableType: string
  onSave: (data: any) => void
  onClose: () => void
}

function EditModal({ item, tableType, onSave, onClose }: EditModalProps) {
  const [formData, setFormData] = useState<any>(item)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  const renderFormFields = () => {
    switch (tableType) {
      case 'customers':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
              <input
                type="tel"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">언어</label>
              <select
                value={formData.language || ''}
                onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">언어 선택</option>
                <option value="ko">한국어</option>
                <option value="en">영어</option>
                <option value="ja">일본어</option>
                <option value="zh">중국어</option>
              </select>
            </div>
          </>
        )
      case 'teams':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">한국어 이름</label>
              <input
                type="text"
                value={formData.name_ko || ''}
                onChange={(e) => setFormData({ ...formData, name_ko: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">영어 이름</label>
              <input
                type="text"
                value={formData.name_en || ''}
                onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
              <input
                type="tel"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">언어 (쉼표로 구분)</label>
              <input
                type="text"
                value={Array.isArray(formData.languages) ? formData.languages.join(', ') : formData.languages || ''}
                onChange={(e) => setFormData({ ...formData, languages: e.target.value.split(',').map(lang => lang.trim()).filter(lang => lang) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ko, en, ja"
              />
            </div>
          </>
        )
      case 'products':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">상품명 (한국어)</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">상품명 (영어)</label>
              <input
                type="text"
                value={formData.name_en || ''}
                onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">상품 코드</label>
              <input
                type="text"
                value={formData.product_code || ''}
                onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
              <input
                type="text"
                value={formData.category || ''}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">기본 가격</label>
              <input
                type="number"
                value={formData.base_price || ''}
                onChange={(e) => setFormData({ ...formData, base_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </>
        )
      default:
        return (
          <div className="text-center py-4">
            <p className="text-gray-500">이 테이블의 수정 기능은 아직 구현되지 않았습니다.</p>
          </div>
        )
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">데이터 수정</h3>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              {renderFormFields()}
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                취소
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                저장
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
