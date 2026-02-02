'use client'

import React, { useState, useEffect } from 'react'
import { X, DollarSign, Calendar, User, Save, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'

/** 결제 기록에서 수수료 적용·강조 대상 (Square Invoice, Wix Website) */
const CARD_FEE_PAYMENT_METHOD_IDS = ['PAYM027', 'PAYM030'] as const
const isCardFeePaymentMethod = (id: string | null) =>
  id != null && CARD_FEE_PAYMENT_METHOD_IDS.includes(id as any)

interface TipsShareModalProps {
  isOpen: boolean
  onClose: () => void
  locale?: string
  tourId?: string // 단일 투어 모드: 특정 투어 ID가 있으면 해당 투어만 표시
  /** 결제 기록에서 예약 ID 클릭 시 호출 (예약 수정 모달 열기용) */
  onReservationClick?: (reservationId: string) => void
}

/** 투어별 결제 수단 내역 (payment_records 기반, Tips 쉐어 시 카드 수수료 공제 여부 표시용) */
export interface PaymentBreakdownItem {
  method_display: string
  amount: number
  has_card_fee: boolean
}

/** prepayment_tip > 0 인 예약별 payment_records 한 건 */
export interface PaymentRecordItem {
  id: string
  reservation_id: string
  amount: number
  payment_method: string | null
  payment_method_display: string
  payment_status: string | null
  submit_on: string | null
  note: string | null
}

/** prepayment_tip > 0 인 예약 하나와 그 예약의 payment_records 목록 */
export interface ReservationWithPayments {
  reservation_id: string
  prepayment_tip: number
  records: PaymentRecordItem[]
}

interface TourWithTip {
  id: string
  tour_date: string
  tour_name: string
  tour_guide_id: string | null
  assistant_id: string | null
  guide_name: string | null
  assistant_name: string | null
  total_prepaid_tip: number
  reservation_ids: string[]
  /** 해당 투어 예약들의 결제 내역 (결제 수단별 합계, 카드 수수료 적용 여부) */
  payment_breakdown: PaymentBreakdownItem[]
  /** prepayment_tip > 0 인 예약별 payment_records 목록 */
  payment_records_list: ReservationWithPayments[]
}

interface TipShare {
  tour_id: string
  guide_email: string | null
  assistant_email: string | null
  op_emails: string[] // 여러 OP를 선택할 수 있도록 배열로 변경
  guide_percent: number
  assistant_percent: number
  op_percent: number
  guide_amount: number
  assistant_amount: number
  op_amount: number // 총 OP 금액
  op_shares: Array<{op_email: string, op_amount: number, op_percent: number}> // 각 OP별 금액
  total_tip: number
  deduct_fee?: boolean // 수수료 차감 (5%) 적용 여부
}

export default function TipsShareModal({ isOpen, onClose, locale = 'ko', tourId, onReservationClick }: TipsShareModalProps) {
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [toursWithTips, setToursWithTips] = useState<TourWithTip[]>([])
  const [tipShares, setTipShares] = useState<Record<string, TipShare>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [opMembers, setOpMembers] = useState<Array<{email: string, name_ko: string}>>([])
  /** 투어별 쉐어할 tips (수수료 차감 체크 시 5% 차감, 사용자 입력 가능) */
  const [shareableTipByTour, setShareableTipByTour] = useState<Record<string, number>>({})
  /** 투어별 수수료 차감 여부 (체크 시 5% 차감) */
  const [deductFeeByTour, setDeductFeeByTour] = useState<Record<string, boolean>>({})

  const getShareableTip = (tour: TourWithTip) => {
    if (shareableTipByTour[tour.id] !== undefined) return shareableTipByTour[tour.id]
    const deduct = deductFeeByTour[tour.id] !== false
    return deduct ? Math.round(tour.total_prepaid_tip * 0.95 * 100) / 100 : tour.total_prepaid_tip
  }

  // 단일 투어 모드인지 확인
  const isSingleTourMode = !!tourId

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

  // OP 멤버 조회 (수습기간 제외)
  const fetchOpMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('team')
        .select('email, name_ko, hire_date')
        .eq('is_active', true)
        .or('position.ilike.op,position.ilike.office manager')
        .order('name_ko')

      if (error) {
        console.error('OP 멤버 조회 오류:', error)
        return
      }

      // 수습기간인 OP 제외 (hire_date가 3개월 이내인 경우)
      const today = new Date()
      const threeMonthsAgo = new Date(today)
      threeMonthsAgo.setMonth(today.getMonth() - 3)

      const filteredMembers = (data || []).filter(member => {
        if (!member.hire_date) {
          // hire_date가 없으면 수습기간이 아니라고 가정
          return true
        }
        const hireDate = new Date(member.hire_date)
        // hire_date가 3개월 이전이면 수습기간이 아님
        return hireDate < threeMonthsAgo
      })

      setOpMembers(filteredMembers.map(m => ({ email: m.email, name_ko: m.name_ko })))
    } catch (error) {
      console.error('OP 멤버 조회 오류:', error)
    }
  }

  // 해당 기간의 투어와 prepaid 팁 조회 (또는 단일 투어)
  const fetchToursWithTips = async () => {
    // 단일 투어 모드가 아닐 때는 날짜 체크
    if (!isSingleTourMode && (!startDate || !endDate)) {
      setToursWithTips([])
      return
    }

    setLoading(true)
    try {
      let query = supabase
        .from('tours')
        .select(`
          id,
          tour_date,
          tour_guide_id,
          assistant_id,
          reservation_ids,
          products!inner(name_ko)
        `)
      
      // 단일 투어 모드면 해당 투어만 조회
      if (isSingleTourMode && tourId) {
        query = query.eq('id', tourId)
      } else {
        // 기간별 조회
        query = query
          .gte('tour_date', startDate)
          .lte('tour_date', endDate)
          .order('tour_date', { ascending: true })
      }
      
      const { data: toursData, error: toursError } = await query

      if (toursError) {
        console.error('투어 조회 오류:', toursError)
        setToursWithTips([])
        return
      }

      if (!toursData || toursData.length === 0) {
        setToursWithTips([])
        return
      }

      // 각 투어의 prepaid 팁 계산
      const toursWithTipData: TourWithTip[] = []
      
      for (const tour of toursData) {
        if (!tour.reservation_ids || tour.reservation_ids.length === 0) {
          continue
        }

        // reservation_pricing에서 reservation_id, prepayment_tip 조회 (prepayment_tip > 0 인 예약만 사용)
        const { data: pricingData, error: pricingError } = await supabase
          .from('reservation_pricing')
          .select('reservation_id, prepayment_tip')
          .in('reservation_id', tour.reservation_ids)

        if (pricingError) {
          console.error('Reservation pricing 조회 오류:', pricingError)
          continue
        }

        // prepayment_tip > 0 인 예약만 필터
        const reservationsWithTip = (pricingData || []).filter(
          (p: { reservation_id: string; prepayment_tip?: number | null }) => (p.prepayment_tip || 0) > 0
        )
        const totalTip = reservationsWithTip.reduce(
          (sum: number, p: { prepayment_tip?: number | null }) => sum + (p.prepayment_tip || 0),
          0
        )

        if (totalTip > 0) {
          // 가이드와 어시스턴트 이름 조회
          let guideName = null
          let assistantName = null

          if (tour.tour_guide_id) {
            const { data: guideData } = await supabase
              .from('team')
              .select('name_ko')
              .eq('email', tour.tour_guide_id)
              .maybeSingle()
            guideName = guideData?.name_ko || null
          }

          if (tour.assistant_id) {
            const { data: assistantData } = await supabase
              .from('team')
              .select('name_ko')
              .eq('email', tour.assistant_id)
              .maybeSingle()
            assistantName = assistantData?.name_ko || null
          }

          // 해당 투어 예약들의 payment_records 조회 → 결제 수단별 합계 및 카드 수수료 여부
          let payment_breakdown: PaymentBreakdownItem[] = []
          try {
            const { data: records } = await supabase
              .from('payment_records')
              .select('amount, payment_method')
              .in('reservation_id', tour.reservation_ids)
              .in('payment_status', ['confirmed', 'Received', 'received'])

            if (records && records.length > 0) {
              const byMethod: Record<string, number> = {}
              for (const r of records) {
                const key = (r.payment_method || '').trim() || 'Unknown'
                byMethod[key] = (byMethod[key] || 0) + (Number(r.amount) || 0)
              }
              const { data: methods } = await supabase
                .from('payment_methods')
                .select('id, method, display_name, deduct_card_fee_for_tips')
                .eq('status', 'active')

              const methodById = new Map((methods || []).map((m: any) => [m.id, m]))
              const methodByMethod = new Map((methods || []).map((m: any) => [m.method, m]))

              for (const [methodKey, amount] of Object.entries(byMethod)) {
                const pm = methodById.get(methodKey) || methodByMethod.get(methodKey)
                const display = pm
                  ? (pm.display_name || pm.method || methodKey)
                  : methodKey
                const has_card_fee = pm?.deduct_card_fee_for_tips === true
                payment_breakdown.push({ method_display: display, amount, has_card_fee })
              }
              payment_breakdown.sort((a, b) => b.amount - a.amount)
            }
          } catch (_) {
            // deduct_card_fee_for_tips 컬럼이 없을 수 있음 → display_name만 사용
            try {
              const { data: records } = await supabase
                .from('payment_records')
                .select('amount, payment_method')
                .in('reservation_id', tour.reservation_ids)
                .in('payment_status', ['confirmed', 'Received', 'received'])
              if (records && records.length > 0) {
                const byMethod: Record<string, number> = {}
                for (const r of records) {
                  const key = (r.payment_method || '').trim() || 'Unknown'
                  byMethod[key] = (byMethod[key] || 0) + (Number(r.amount) || 0)
                }
                const { data: methods } = await supabase
                  .from('payment_methods')
                  .select('id, method, display_name')
                  .eq('status', 'active')
                const methodById = new Map((methods || []).map((m: any) => [m.id, m]))
                const methodByMethod = new Map((methods || []).map((m: any) => [m.method, m]))
                for (const [methodKey, amount] of Object.entries(byMethod)) {
                  const pm = methodById.get(methodKey) || methodByMethod.get(methodKey)
                  payment_breakdown.push({
                    method_display: pm ? (pm.display_name || pm.method || methodKey) : methodKey,
                    amount,
                    has_card_fee: false
                  })
                }
                payment_breakdown.sort((a, b) => b.amount - a.amount)
              }
            } catch (__) {}
          }

          // prepayment_tip > 0 인 예약별 payment_records 목록 조회
          const payment_records_list: ReservationWithPayments[] = []
          const tipReservationIds = reservationsWithTip.map((p: { reservation_id: string }) => p.reservation_id)
          if (tipReservationIds.length > 0) {
            try {
              const { data: allRecords } = await supabase
                .from('payment_records')
                .select('id, reservation_id, amount, payment_method, payment_status, submit_on, note')
                .in('reservation_id', tipReservationIds)
                .order('submit_on', { ascending: false })

              const { data: methods } = await supabase
                .from('payment_methods')
                .select('id, method, display_name')
                .eq('status', 'active')
              const methodById = new Map((methods || []).map((m: any) => [m.id, m]))
              const methodByMethod = new Map((methods || []).map((m: any) => [m.method, m]))

              const getMethodDisplay = (key: string | null) => {
                if (!key) return '—'
                const pm = methodById.get(key) || methodByMethod.get(key)
                return pm ? (pm.display_name || pm.method || key) : key
              }

              for (const row of reservationsWithTip) {
                const rid = row.reservation_id
                const prepayment_tip = row.prepayment_tip || 0
                const recordsForRes = (allRecords || []).filter((r: any) => r.reservation_id === rid)
                const records: PaymentRecordItem[] = recordsForRes.map((r: any) => ({
                  id: r.id,
                  reservation_id: r.reservation_id,
                  amount: Number(r.amount) || 0,
                  payment_method: r.payment_method,
                  payment_method_display: getMethodDisplay((r.payment_method || '').trim() || null),
                  payment_status: r.payment_status,
                  submit_on: r.submit_on,
                  note: r.note
                }))
                payment_records_list.push({ reservation_id: rid, prepayment_tip, records })
              }
            } catch (_) {}
          }

          toursWithTipData.push({
            id: tour.id,
            tour_date: tour.tour_date,
            tour_name: (tour.products as any)?.name_ko || '투어명 없음',
            tour_guide_id: tour.tour_guide_id,
            assistant_id: tour.assistant_id,
            guide_name: guideName,
            assistant_name: assistantName,
            total_prepaid_tip: totalTip,
            reservation_ids: tour.reservation_ids,
            payment_breakdown,
            payment_records_list
          })
        }
      }

      setToursWithTips(toursWithTipData)
      setDeductFeeByTour((prev) => {
        const next = { ...prev }
        toursWithTipData.forEach((t) => {
          const hasCardFeeMethod = t.payment_records_list?.some((res) =>
            res.records?.some((r) => isCardFeePaymentMethod(r.payment_method))
          )
          next[t.id] = !!hasCardFeeMethod
        })
        return next
      })
      setShareableTipByTour((prev) => {
        const next = { ...prev }
        toursWithTipData.forEach((t) => {
          const hasCardFeeMethod = t.payment_records_list?.some((res) =>
            res.records?.some((r) => isCardFeePaymentMethod(r.payment_method))
          )
          next[t.id] = hasCardFeeMethod
            ? Math.round(t.total_prepaid_tip * 0.95 * 100) / 100
            : Math.round(t.total_prepaid_tip * 100) / 100
        })
        return next
      })

      // 기존 팁 쉐어 데이터 로드
      await loadTipShares(toursWithTipData.map((t) => t.id))
    } catch (error) {
      console.error('투어 팁 조회 오류:', error)
      setToursWithTips([])
    } finally {
      setLoading(false)
    }
  }

  // 기존 팁 쉐어 데이터 로드
  const loadTipShares = async (tourIds: string[]) => {
    if (tourIds.length === 0) return

    try {
      const { data, error } = await supabase
        .from('tour_tip_shares')
        .select('*')
        .in('tour_id', tourIds)

      if (error) {
        // 테이블이 없을 수 있으므로 에러 무시
        console.log('팁 쉐어 데이터 조회 오류 (테이블이 없을 수 있음):', error)
        return
      }

      const shares: Record<string, TipShare> = {}
      
      // 각 tour_tip_share에 대한 OP 정보 조회
      for (const share of data || []) {
        // OP별 팁 쉐어 정보 조회
        const { data: opSharesData, error: opSharesError } = await supabase
          .from('tour_tip_share_ops')
          .select('op_email, op_amount, op_percent')
          .eq('tour_tip_share_id', share.id)

        // 테이블이 없을 수 있으므로 에러 무시
        if (opSharesError && opSharesError.code !== '42P01') {
          console.log('OP 팁 쉐어 데이터 조회 오류:', opSharesError)
        }

        const opShares = opSharesData || []
        const opEmails = opShares.map((op: any) => op.op_email)
        
        shares[share.tour_id] = {
          tour_id: share.tour_id,
          guide_email: share.guide_email,
          assistant_email: share.assistant_email,
          op_emails: opEmails,
          guide_percent: share.guide_percent || 0,
          assistant_percent: share.assistant_percent || 0,
          op_percent: share.op_percent || 0,
          guide_amount: share.guide_amount || 0,
          assistant_amount: share.assistant_amount || 0,
          op_amount: share.op_amount || 0,
          op_shares: opShares.map((op: any) => ({
            op_email: op.op_email,
            op_amount: op.op_amount || 0,
            op_percent: op.op_percent || 0
          })),
          total_tip: share.total_tip || 0,
          deduct_fee: (share as any).deduct_fee !== false
        }
      }

      setTipShares(shares)
      setShareableTipByTour((prev) => {
        const next = { ...prev }
        Object.entries(shares).forEach(([tid, s]) => {
          next[tid] = s.total_tip ?? 0
        })
        return next
      })
      setDeductFeeByTour((prev) => {
        const next = { ...prev }
        Object.entries(shares).forEach(([tid, s]) => {
          next[tid] = (s as any).deduct_fee !== false
        })
        return next
      })
    } catch (error) {
      console.error('팁 쉐어 데이터 로드 오류:', error)
    }
  }

  // 팁 쉐어 초기화 (투어별로) — 쉐어할 금액(5% 차감 기본) 기준
  const initializeTipShare = (tour: TourWithTip) => {
    if (tipShares[tour.id]) {
      return tipShares[tour.id]
    }

    const totalTip = getShareableTip(tour)
    // 기본값: 가이드+어시스턴트 합쳐서 90%, OP 10%
    const hasAssistant = !!tour.assistant_id
    const defaultGuidePercent = hasAssistant ? 45 : 90
    const defaultAssistantPercent = hasAssistant ? 45 : 0
    const defaultOpPercent = 10

    const guideAmount = (totalTip * defaultGuidePercent) / 100
    const assistantAmount = (totalTip * defaultAssistantPercent) / 100
    const opAmount = (totalTip * defaultOpPercent) / 100

    return {
      tour_id: tour.id,
      guide_email: tour.tour_guide_id,
      assistant_email: tour.assistant_id,
      op_emails: [],
      guide_percent: defaultGuidePercent,
      assistant_percent: defaultAssistantPercent,
      op_percent: defaultOpPercent,
      guide_amount: guideAmount,
      assistant_amount: assistantAmount,
      op_amount: opAmount,
      op_shares: [],
      total_tip: totalTip,
      deduct_fee: true
    }
  }

  // 비율 변경 핸들러 (자동 정규화 제거 - 사용자가 직접 입력한 값 유지)
  const handlePercentChange = (tourId: string, role: 'guide' | 'assistant' | 'op', value: number) => {
    const tour = toursWithTips.find((t) => t.id === tourId)
    if (!tour) return

    const currentShare = tipShares[tourId] || initializeTipShare(tour)
    const totalTip = getShareableTip(tour)

    let newGuidePercent = currentShare.guide_percent
    let newAssistantPercent = currentShare.assistant_percent
    let newOpPercent = currentShare.op_percent

    if (role === 'guide') {
      newGuidePercent = Math.max(0, Math.min(100, value))
    } else if (role === 'assistant') {
      newAssistantPercent = Math.max(0, Math.min(100, value))
    } else if (role === 'op') {
      newOpPercent = Math.max(0, Math.min(100, value))
    }

    // 비율에 따라 금액 계산 (자동 정규화 없이 사용자 입력값 그대로 사용)
    const guideAmount = (totalTip * newGuidePercent) / 100
    const assistantAmount = (totalTip * newAssistantPercent) / 100
    const opAmount = (totalTip * newOpPercent) / 100

    setTipShares({
      ...tipShares,
      [tourId]: {
        ...currentShare,
        guide_percent: newGuidePercent,
        assistant_percent: newAssistantPercent,
        op_percent: newOpPercent,
        guide_amount: guideAmount,
        assistant_amount: assistantAmount,
        op_amount: opAmount,
        total_tip: totalTip,
        deduct_fee: currentShare.deduct_fee !== false
      }
    })
  }

  // 금액 변경 핸들러
  const handleAmountChange = (tourId: string, role: 'guide' | 'assistant' | 'op', value: number) => {
    const tour = toursWithTips.find((t) => t.id === tourId)
    if (!tour) return

    const currentShare = tipShares[tourId] || initializeTipShare(tour)
    const totalTip = getShareableTip(tour)

    let newGuideAmount = currentShare.guide_amount
    let newAssistantAmount = currentShare.assistant_amount
    let newOpAmount = currentShare.op_amount

    if (role === 'guide') {
      newGuideAmount = Math.max(0, Math.min(totalTip, value))
    } else if (role === 'assistant') {
      newAssistantAmount = Math.max(0, Math.min(totalTip, value))
    } else if (role === 'op') {
      newOpAmount = Math.max(0, Math.min(totalTip, value))
    }

    // 비율 재계산 (자동 정규화 없이 사용자 입력값 그대로 사용)
    const guidePercent = totalTip > 0 ? (newGuideAmount / totalTip) * 100 : 0
    const assistantPercent = totalTip > 0 ? (newAssistantAmount / totalTip) * 100 : 0
    const opPercent = totalTip > 0 ? (newOpAmount / totalTip) * 100 : 0

    setTipShares({
      ...tipShares,
      [tourId]: {
        ...currentShare,
        guide_percent: guidePercent,
        assistant_percent: assistantPercent,
        op_percent: opPercent,
        guide_amount: newGuideAmount,
        assistant_amount: newAssistantAmount,
        op_amount: newOpAmount,
        total_tip: totalTip
      }
    })
  }

  // 수수료 차감 체크 변경 (체크 시 5% 차감 적용, 미체크 시 전체 금액)
  const handleDeductFeeChange = (tourId: string, checked: boolean) => {
    const tour = toursWithTips.find((t) => t.id === tourId)
    if (!tour) return

    setDeductFeeByTour((prev) => ({ ...prev, [tourId]: checked }))
    const newShareable = checked
      ? Math.round(tour.total_prepaid_tip * 0.95 * 100) / 100
      : tour.total_prepaid_tip
    setShareableTipByTour((prev) => ({ ...prev, [tourId]: newShareable }))

    const currentShare = tipShares[tourId] || initializeTipShare(tour)
    const guideAmount = (newShareable * currentShare.guide_percent) / 100
    const assistantAmount = (newShareable * currentShare.assistant_percent) / 100
    const opAmount = (newShareable * currentShare.op_percent) / 100

    const updatedOpShares =
      currentShare.op_shares.length > 0
        ? currentShare.op_shares.map((op) => ({
            ...op,
            op_percent: currentShare.op_percent / currentShare.op_shares.length,
            op_amount: opAmount / currentShare.op_shares.length
          }))
        : []

    setTipShares({
      ...tipShares,
      [tourId]: {
        ...currentShare,
        total_tip: newShareable,
        guide_amount: guideAmount,
        assistant_amount: assistantAmount,
        op_amount: opAmount,
        op_shares: updatedOpShares.length > 0 ? updatedOpShares : currentShare.op_shares
      }
    })
  }

  // 쉐어할 tips 입력 변경 (비율 유지, 금액만 재계산)
  const handleShareableTipChange = (tourId: string, value: number) => {
    const tour = toursWithTips.find((t) => t.id === tourId)
    if (!tour) return

    const safeValue = Math.max(0, value)
    setShareableTipByTour((prev) => ({ ...prev, [tourId]: safeValue }))

    const currentShare = tipShares[tourId] || initializeTipShare(tour)
    const deduct = deductFeeByTour[tourId] !== false
    const guideAmount = (safeValue * currentShare.guide_percent) / 100
    const assistantAmount = (safeValue * currentShare.assistant_percent) / 100
    const opAmount = (safeValue * currentShare.op_percent) / 100

    const updatedOpShares =
      currentShare.op_shares.length > 0
        ? currentShare.op_shares.map((op) => ({
            ...op,
            op_percent: currentShare.op_percent / currentShare.op_shares.length,
            op_amount: opAmount / currentShare.op_shares.length
          }))
        : []

    setTipShares({
      ...tipShares,
      [tourId]: {
        ...currentShare,
        total_tip: safeValue,
        guide_amount: guideAmount,
        assistant_amount: assistantAmount,
        op_amount: opAmount,
        op_shares: updatedOpShares.length > 0 ? updatedOpShares : currentShare.op_shares,
        deduct_fee: deduct
      }
    })
  }

  // 쉐어할 tips 리셋 후 자동 계산 (수수료 차감 여부에 따라 5% 차감 또는 전액)
  const handleResetShareableTip = (tourId: string) => {
    const tour = toursWithTips.find((t) => t.id === tourId)
    if (!tour) return
    const deduct = deductFeeByTour[tourId] !== false
    const newValue = deduct
      ? Math.round(tour.total_prepaid_tip * 0.95 * 100) / 100
      : Math.round(tour.total_prepaid_tip * 100) / 100
    handleShareableTipChange(tourId, newValue)
  }

  // OP 체크박스 토글 핸들러
  const handleOpToggle = (tourId: string, opEmail: string, checked: boolean) => {
    const tour = toursWithTips.find((t) => t.id === tourId)
    if (!tour) return

    const currentShare = tipShares[tourId] || initializeTipShare(tour)
    const totalTip = getShareableTip(tour)
    const opTotalPercent = currentShare.op_percent // 사용자가 입력한 값 사용
    const opTotalAmount = (totalTip * opTotalPercent) / 100

    let newOpShares = [...currentShare.op_shares]

    if (checked) {
      // OP 추가 - 기본값은 균등 분배
      const existingOpCount = newOpShares.length
      const newOpCount = existingOpCount + 1
      const defaultPercent = opTotalPercent / newOpCount
      const defaultAmount = opTotalAmount / newOpCount

      // 기존 OP들의 비율 재조정
      newOpShares = newOpShares.map(op => ({
        ...op,
        op_percent: defaultPercent,
        op_amount: defaultAmount
      }))

      // 새 OP 추가
      newOpShares.push({
        op_email: opEmail,
        op_amount: defaultAmount,
        op_percent: defaultPercent
      })
    } else {
      // OP 제거
      newOpShares = newOpShares.filter(op => op.op_email !== opEmail)
      
      // 남은 OP들의 비율 재조정
      if (newOpShares.length > 0) {
        const remainingPercent = opTotalPercent / newOpShares.length
        const remainingAmount = opTotalAmount / newOpShares.length
        newOpShares = newOpShares.map(op => ({
          ...op,
          op_percent: remainingPercent,
          op_amount: remainingAmount
        }))
      }
    }

    setTipShares({
      ...tipShares,
      [tourId]: {
        ...currentShare,
        op_emails: newOpShares.map(op => op.op_email),
        op_shares: newOpShares,
        op_amount: opTotalAmount
      }
    })
  }

  // OP별 퍼센테이지 변경 핸들러
  const handleOpPercentChange = (tourId: string, opEmail: string, percent: number) => {
    const tour = toursWithTips.find((t) => t.id === tourId)
    if (!tour) return

    const currentShare = tipShares[tourId]
    if (!currentShare) return

    const totalTip = getShareableTip(tour)
    const opTotalPercent = currentShare.op_percent // 사용자가 입력한 값 사용
    const opTotalAmount = (totalTip * opTotalPercent) / 100

    // 해당 OP의 퍼센테이지 업데이트 (0 ~ opTotalPercent 사이로 제한)
    const newPercent = Math.max(0, Math.min(opTotalPercent, percent))
    
    // 해당 OP를 제외한 나머지 OP들
    const otherOps = currentShare.op_shares.filter(op => op.op_email !== opEmail)
    const remainingPercent = opTotalPercent - newPercent
    
    // 나머지 OP들이 남은 비율을 균등하게 나눠가져감
    const otherOpCount = otherOps.length
    const otherOpPercent = otherOpCount > 0 ? remainingPercent / otherOpCount : 0
    const otherOpAmount = otherOpCount > 0 ? (opTotalAmount - (totalTip * newPercent) / 100) / otherOpCount : 0

    const newOpShares = currentShare.op_shares.map(op => {
      if (op.op_email === opEmail) {
        return {
          ...op,
          op_percent: newPercent,
          op_amount: (totalTip * newPercent) / 100
        }
      } else {
        return {
          ...op,
          op_percent: otherOpPercent,
          op_amount: otherOpAmount
        }
      }
    })

    setTipShares({
      ...tipShares,
      [tourId]: {
        ...currentShare,
        op_shares: newOpShares,
        op_amount: opTotalAmount
      }
    })
  }

  // OP별 금액 변경 핸들러
  const handleOpAmountChange = (tourId: string, opEmail: string, amount: number) => {
    const tour = toursWithTips.find((t) => t.id === tourId)
    if (!tour) return

    const currentShare = tipShares[tourId]
    if (!currentShare) return

    const totalTip = getShareableTip(tour)
    const opTotalPercent = currentShare.op_percent // 사용자가 입력한 값 사용
    const opTotalAmount = (totalTip * opTotalPercent) / 100

    // 해당 OP의 금액 업데이트 (0 ~ opTotalAmount 사이로 제한)
    const newAmount = Math.max(0, Math.min(opTotalAmount, amount))
    
    // 해당 OP를 제외한 나머지 OP들
    const otherOps = currentShare.op_shares.filter(op => op.op_email !== opEmail)
    const remainingAmount = opTotalAmount - newAmount
    
    // 나머지 OP들이 남은 금액을 균등하게 나눠가져감
    const otherOpCount = otherOps.length
    const otherOpAmount = otherOpCount > 0 ? remainingAmount / otherOpCount : 0
    const otherOpPercent = otherOpCount > 0 ? (otherOpAmount / totalTip) * 100 : 0

    const newOpShares = currentShare.op_shares.map(op => {
      if (op.op_email === opEmail) {
        const newPercent = (newAmount / totalTip) * 100
        return {
          ...op,
          op_percent: newPercent,
          op_amount: newAmount
        }
      } else {
        return {
          ...op,
          op_percent: otherOpPercent,
          op_amount: otherOpAmount
        }
      }
    })

    setTipShares({
      ...tipShares,
      [tourId]: {
        ...currentShare,
        op_shares: newOpShares,
        op_amount: opTotalAmount
      }
    })
  }

  // 저장
  const handleSave = async () => {
    setSaving(true)
    try {
      const sharesToSave = Object.values(tipShares).filter(share => 
        toursWithTips.some(tour => tour.id === share.tour_id)
      )

      if (sharesToSave.length === 0) {
        alert('저장할 팁 쉐어 데이터가 없습니다.')
        return
      }

      // 기존 데이터 삭제 후 새로 삽입
      const tourIds = sharesToSave.map(s => s.tour_id)
      
      // 기존 tour_tip_shares 조회 (OP 데이터 삭제를 위해)
      const { data: existingShares } = await supabase
        .from('tour_tip_shares')
        .select('id')
        .in('tour_id', tourIds)

      // 기존 OP 데이터 삭제
      if (existingShares && existingShares.length > 0) {
        const existingShareIds = existingShares.map(s => s.id)
        const { error: deleteOpError } = await supabase
          .from('tour_tip_share_ops')
          .delete()
          .in('tour_tip_share_id', existingShareIds)

        if (deleteOpError && deleteOpError.code !== '42P01') {
          console.error('기존 OP 팁 쉐어 삭제 오류:', deleteOpError)
        }
      }
      
      // 기존 tour_tip_shares 삭제
      const { error: deleteError } = await supabase
        .from('tour_tip_shares')
        .delete()
        .in('tour_id', tourIds)

      if (deleteError && deleteError.code !== '42P01') { // 테이블이 없으면 무시
        console.error('기존 팁 쉐어 삭제 오류:', deleteError)
      }

      // tour_tip_shares 삽입
      const { data: insertedShares, error: insertError } = await supabase
        .from('tour_tip_shares')
        .insert(sharesToSave.map(share => ({
          tour_id: share.tour_id,
          guide_email: share.guide_email,
          assistant_email: share.assistant_email,
          op_email: null, // 더 이상 사용하지 않음
          guide_percent: share.guide_percent,
          assistant_percent: share.assistant_percent,
          op_percent: share.op_percent,
          guide_amount: share.guide_amount,
          assistant_amount: share.assistant_amount,
          op_amount: share.op_amount,
          total_tip: share.total_tip,
          deduct_fee: share.deduct_fee !== false
        })))
        .select('id, tour_id')

      if (insertError) {
        console.error('팁 쉐어 저장 오류:', insertError)
        alert('팁 쉐어 저장 중 오류가 발생했습니다. 데이터베이스 테이블이 생성되었는지 확인해주세요.')
        return
      }

      // tour_tip_share_ops 삽입
      const opSharesToInsert: any[] = []
      insertedShares?.forEach((insertedShare) => {
        const originalShare = sharesToSave.find(s => s.tour_id === insertedShare.tour_id)
        if (originalShare && originalShare.op_shares.length > 0) {
          originalShare.op_shares.forEach(opShare => {
            opSharesToInsert.push({
              tour_tip_share_id: insertedShare.id,
              op_email: opShare.op_email,
              op_amount: opShare.op_amount,
              op_percent: opShare.op_percent
            })
          })
        }
      })

      if (opSharesToInsert.length > 0) {
        const { error: opInsertError } = await supabase
          .from('tour_tip_share_ops')
          .insert(opSharesToInsert)

        if (opInsertError) {
          console.error('OP 팁 쉐어 저장 오류:', opInsertError)
          alert('OP 팁 쉐어 저장 중 오류가 발생했습니다.')
          return
        }
      }

      alert('팁 쉐어 정보가 저장되었습니다.')
      onClose()
    } catch (error) {
      console.error('팁 쉐어 저장 오류:', error)
      alert('팁 쉐어 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // 모달 열릴 때 초기화
  useEffect(() => {
    if (isOpen) {
      if (isSingleTourMode) {
        // 단일 투어 모드: 바로 투어 조회
        fetchOpMembers()
        fetchToursWithTips()
      } else {
        // 기간별 모드: 날짜 설정 후 조회
        const defaultDates = getDefaultDates()
        setStartDate(defaultDates.start)
        setEndDate(defaultDates.end)
        fetchOpMembers()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isSingleTourMode, tourId])

  // 날짜 변경 시 투어 조회 (기간별 모드만)
  useEffect(() => {
    if (isOpen && !isSingleTourMode && startDate && endDate) {
      fetchToursWithTips()
    }
  }, [isOpen, isSingleTourMode, startDate, endDate])

  // 숫자 포맷팅
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  // 날짜 포맷팅
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-3 sm:p-6 border-b border-gray-200">
          <div className="flex items-center">
            <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 mr-2" />
            <h2 className="text-base sm:text-xl font-bold text-gray-900">Tips 쉐어 관리</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* 내용 */}
        <div className="p-3 sm:p-6">
          {/* 기간 선택 (단일 투어 모드가 아닐 때만 표시) */}
          {!isSingleTourMode && (
            <div className="mb-4 sm:mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:space-x-4 mb-3 sm:mb-4">
              <div className="flex-1">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                  시작일
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                  종료일
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div className="flex items-end space-x-2 sm:flex-shrink-0">
                <button
                  onClick={setCurrentPeriod}
                  className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs font-medium text-white bg-purple-600 border border-purple-600 rounded-md hover:bg-purple-700 transition-colors"
                >
                  이번
                </button>
                <button
                  onClick={setPreviousPeriod}
                  className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  지난
                </button>
                <button
                  onClick={fetchToursWithTips}
                  disabled={loading}
                  className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 inline ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>
          )}

          {/* 투어 목록 */}
          {loading ? (
            <div className="text-center py-6 sm:py-8">
              <RefreshCw className="w-6 h-6 sm:w-8 sm:h-8 animate-spin mx-auto mb-3 sm:mb-4 text-purple-600" />
              <p className="text-sm sm:text-base text-gray-600">투어를 불러오는 중...</p>
            </div>
          ) : toursWithTips.length === 0 ? (
            <div className="text-center py-6 sm:py-8 text-gray-500">
              <DollarSign className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-gray-300" />
              <p className="text-base sm:text-lg font-medium mb-2">prepaid 팁이 있는 투어가 없습니다</p>
              <p className="text-xs sm:text-sm">
                {isSingleTourMode 
                  ? '이 투어에는 prepaid 팁이 없습니다.' 
                  : '선택한 기간에 prepaid 팁이 있는 투어가 없습니다.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {toursWithTips.map((tour) => {
                const share = tipShares[tour.id] || initializeTipShare(tour)
                return (
                  <div key={tour.id} className="border border-gray-200 rounded-lg p-3 sm:p-4">
                    <div className="mb-3 sm:mb-4">
                      <h3 className="text-sm sm:text-lg font-semibold text-gray-900 mb-1">
                        {tour.tour_name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs sm:text-sm text-gray-600">
                        <span>{formatDate(tour.tour_date)} | 총 팁: ${formatCurrency(tour.total_prepaid_tip)}</span>
                        <span className="flex items-center gap-2">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={deductFeeByTour[tour.id] !== false}
                              onChange={(e) => handleDeductFeeChange(tour.id, e.target.checked)}
                              className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                            />
                            <span className="font-medium text-gray-700">수수료 차감 (5%)</span>
                          </label>
                          <span className="flex items-center gap-1.5">
                            <label className="font-medium text-gray-700">쉐어할 tips</label>
                            <span className="text-gray-500">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={getShareableTip(tour).toFixed(2)}
                              onChange={(e) => handleShareableTipChange(tour.id, parseFloat(e.target.value) || 0)}
                              className="w-20 sm:w-24 px-1.5 py-0.5 text-xs sm:text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleResetShareableTip(tour.id)}
                              title="기존 입력값 리셋 후 자동 계산"
                              className="p-1 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          </span>
                        </span>
                      </div>
                      {tour.payment_breakdown && tour.payment_breakdown.length > 0 && (
                        <div className="mt-2 text-xs text-gray-500 border-t border-gray-100 pt-2">
                          <span className="font-medium text-gray-600">결제 내역: </span>
                          {tour.payment_breakdown.map((item, idx) => (
                            <span key={idx}>
                              {idx > 0 && ', '}
                              {item.method_display} ${formatCurrency(item.amount)}
                              {item.has_card_fee ? (
                                <span className="text-amber-600" title="쉐어 시 카드 수수료 공제"> (카드 수수료 적용)</span>
                              ) : (
                                <span className="text-green-600" title="쉐어 시 수수료 없음"> (수수료 없음)</span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                      {tour.payment_records_list && tour.payment_records_list.length > 0 && (
                        <div className="mt-2 border-t border-gray-100 pt-2">
                          <div className="text-xs font-medium text-gray-600 mb-1.5">결제 기록 (prepayment_tip 있는 예약별)</div>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {tour.payment_records_list.map((res) => (
                              <div key={res.reservation_id} className="text-xs bg-gray-50 rounded p-2">
                                <div className="font-medium text-gray-700 mb-1">
                                  {onReservationClick ? (
                                    <button
                                      type="button"
                                      onClick={() => onReservationClick(res.reservation_id)}
                                      className="text-left text-purple-600 hover:text-purple-800 hover:underline focus:outline-none focus:underline cursor-pointer"
                                    >
                                      예약 {res.reservation_id.slice(0, 8)}…
                                    </button>
                                  ) : (
                                    <span>예약 {res.reservation_id.slice(0, 8)}…</span>
                                  )}
                                  {' | 팁 $'}{formatCurrency(res.prepayment_tip)}
                                </div>
                                {res.records.length === 0 ? (
                                  <div className="text-gray-500 italic">결제 기록 없음</div>
                                ) : (
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-left text-gray-500 border-b border-gray-200">
                                        <th className="py-0.5 pr-2">날짜</th>
                                        <th className="py-0.5 pr-2">결제수단</th>
                                        <th className="py-0.5 pr-2 text-right">금액</th>
                                        <th className="py-0.5">상태</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {res.records.map((rec) => {
                                        const isCardFee = isCardFeePaymentMethod(rec.payment_method)
                                        return (
                                          <tr
                                            key={rec.id}
                                            className={`border-b border-gray-100 last:border-0 ${isCardFee ? 'bg-amber-50 border-l-4 border-l-amber-400' : ''}`}
                                          >
                                            <td className="py-0.5 pr-2">
                                              {rec.submit_on
                                                ? new Date(rec.submit_on).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', year: '2-digit' })
                                                : '—'}
                                            </td>
                                            <td className="py-0.5 pr-2">
                                              {isCardFee ? (
                                                <span className="font-semibold text-amber-800">
                                                  {rec.payment_method_display}
                                                  <span className="ml-1 text-[10px] font-medium text-amber-600 bg-amber-200/80 px-1 rounded">수수료 적용</span>
                                                </span>
                                              ) : (
                                                rec.payment_method_display
                                              )}
                                            </td>
                                            <td className="py-0.5 pr-2 text-right">${formatCurrency(rec.amount)}</td>
                                            <td className="py-0.5 text-gray-500">{rec.payment_status || '—'}</td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                      {/* 가이드 */}
                      <div className="space-y-2">
                        <label className="block text-xs sm:text-sm font-medium text-gray-700">
                          가이드 {tour.guide_name && `(${tour.guide_name})`}
                        </label>
                        <div className="flex flex-col space-y-2">
                          <div>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={share.guide_percent.toFixed(1)}
                              onChange={(e) => handlePercentChange(tour.id, 'guide', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 text-xs sm:text-sm border border-gray-300 rounded-md"
                              placeholder="%"
                            />
                            <span className="text-xs text-gray-500 ml-1">%</span>
                          </div>
                          <div className="relative">
                            <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={share.guide_amount.toFixed(2)}
                              onChange={(e) => handleAmountChange(tour.id, 'guide', parseFloat(e.target.value) || 0)}
                              className="w-full pl-4 pr-1 py-1 text-xs sm:text-sm border border-gray-300 rounded-md"
                            />
                          </div>
                        </div>
                      </div>

                      {/* 어시스턴트 */}
                      <div className="space-y-2">
                        <label className="block text-xs sm:text-sm font-medium text-gray-700">
                          어시스턴트 {tour.assistant_name && `(${tour.assistant_name})`}
                        </label>
                        {tour.assistant_id ? (
                          <div className="flex flex-col space-y-2">
                            <div>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={share.assistant_percent.toFixed(1)}
                                onChange={(e) => handlePercentChange(tour.id, 'assistant', parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1 text-xs sm:text-sm border border-gray-300 rounded-md"
                                placeholder="%"
                              />
                              <span className="text-xs text-gray-500 ml-1">%</span>
                            </div>
                            <div className="relative">
                              <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={share.assistant_amount.toFixed(2)}
                                onChange={(e) => handleAmountChange(tour.id, 'assistant', parseFloat(e.target.value) || 0)}
                                className="w-full pl-4 pr-1 py-1 text-xs sm:text-sm border border-gray-300 rounded-md"
                              />
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs sm:text-sm text-gray-400">어시스턴트 없음</p>
                        )}
                      </div>

                      {/* OP */}
                      <div className="space-y-2">
                        <label className="block text-xs sm:text-sm font-medium text-gray-700">
                          OP 합계
                        </label>
                        <div className="border border-gray-300 rounded-md p-2 max-h-32 sm:max-h-48 overflow-y-auto">
                          {opMembers.map((op) => {
                            const isSelected = share.op_emails.includes(op.email)
                            const opShare = share.op_shares.find(s => s.op_email === op.email)
                            return (
                              <div key={op.email} className="flex items-center space-x-2 py-1">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => handleOpToggle(tour.id, op.email, e.target.checked)}
                                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                                />
                                <label className="flex-1 text-xs sm:text-sm text-gray-700 truncate">
                                  {op.name_ko}
                                </label>
                                {isSelected && opShare && (
                                  <div className="flex items-center space-x-1 flex-shrink-0">
                                    <input
                                      type="number"
                                      min="0"
                                      max="10"
                                      step="0.1"
                                      value={opShare.op_percent.toFixed(1)}
                                      onChange={(e) => handleOpPercentChange(tour.id, op.email, parseFloat(e.target.value) || 0)}
                                      className="w-12 sm:w-16 px-1 py-0.5 text-xs border border-gray-300 rounded"
                                    />
                                    <span className="text-xs text-gray-500">%</span>
                                    <div className="relative">
                                      <span className="absolute left-0.5 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={opShare.op_amount.toFixed(2)}
                                        onChange={(e) => handleOpAmountChange(tour.id, op.email, parseFloat(e.target.value) || 0)}
                                        className="w-16 sm:w-20 pl-3 sm:pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                        <div className="flex flex-col space-y-2">
                          <div>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={share.op_percent.toFixed(1)}
                              onChange={(e) => {
                                const newOpPercent = parseFloat(e.target.value) || 0
                                handlePercentChange(tour.id, 'op', newOpPercent)
                                if (share.op_shares.length > 0) {
                                  const totalTip = getShareableTip(tour)
                                  const newOpTotalAmount = (totalTip * newOpPercent) / 100
                                  const defaultOpPercent = newOpPercent / share.op_shares.length
                                  const defaultOpAmount = newOpTotalAmount / share.op_shares.length
                                  const updatedOpShares = share.op_shares.map((op) => ({
                                    ...op,
                                    op_percent: defaultOpPercent,
                                    op_amount: defaultOpAmount
                                  }))
                                  setTipShares({
                                    ...tipShares,
                                    [tour.id]: {
                                      ...share,
                                      op_percent: newOpPercent,
                                      op_amount: newOpTotalAmount,
                                      op_shares: updatedOpShares
                                    }
                                  })
                                }
                              }}
                              className="w-full px-2 py-1 text-xs sm:text-sm border border-gray-300 rounded-md"
                              placeholder="%"
                            />
                            <span className="text-xs text-gray-500 ml-1">% (총합)</span>
                          </div>
                          <div className="relative">
                            <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={share.op_amount.toFixed(2)}
                              onChange={(e) => {
                                const newOpAmount = parseFloat(e.target.value) || 0
                                const totalTip = getShareableTip(tour)
                                const newOpPercent = totalTip > 0 ? (newOpAmount / totalTip) * 100 : 0
                                handleAmountChange(tour.id, 'op', newOpAmount)
                                if (share.op_shares.length > 0) {
                                  const defaultOpAmount = newOpAmount / share.op_shares.length
                                  const defaultOpPercent = newOpPercent / share.op_shares.length
                                  const updatedOpShares = share.op_shares.map((op) => ({
                                    ...op,
                                    op_percent: defaultOpPercent,
                                    op_amount: defaultOpAmount
                                  }))
                                  setTipShares({
                                    ...tipShares,
                                    [tour.id]: {
                                      ...share,
                                      op_percent: newOpPercent,
                                      op_amount: newOpAmount,
                                      op_shares: updatedOpShares
                                    }
                                  })
                                }
                              }}
                              className="w-full pl-4 pr-1 py-1 text-xs sm:text-sm border border-gray-300 rounded-md"
                            />
                            <span className="text-xs text-gray-500 ml-1">(총합)</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 총합 확인 */}
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0 text-xs sm:text-sm">
                        <span className="text-gray-600">총합:</span>
                        <span className={`font-semibold text-right ${
                          (share.guide_percent + share.assistant_percent + share.op_percent).toFixed(1) === '100.0' &&
                          (share.guide_amount + share.assistant_amount + share.op_amount).toFixed(2) === share.total_tip.toFixed(2)
                            ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {(share.guide_percent + share.assistant_percent + share.op_percent).toFixed(1)}% / 
                          ${formatCurrency(share.guide_amount + share.assistant_amount + share.op_amount)} / 
                          총 ${formatCurrency(share.total_tip)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* 저장 버튼 */}
          {toursWithTips.length > 0 && (
            <div className="mt-4 sm:mt-6 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center justify-center px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white bg-purple-600 border border-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 w-full sm:w-auto"
              >
                <Save className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

