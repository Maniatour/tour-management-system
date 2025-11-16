'use client'

import React, { useState, useEffect } from 'react'
import { X, DollarSign, Calendar, User, Save, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface TipsShareModalProps {
  isOpen: boolean
  onClose: () => void
  locale?: string
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
}

export default function TipsShareModal({ isOpen, onClose, locale = 'ko' }: TipsShareModalProps) {
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [toursWithTips, setToursWithTips] = useState<TourWithTip[]>([])
  const [tipShares, setTipShares] = useState<Record<string, TipShare>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [opMembers, setOpMembers] = useState<Array<{email: string, name_ko: string}>>([])

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

  // 해당 기간의 투어와 prepaid 팁 조회
  const fetchToursWithTips = async () => {
    if (!startDate || !endDate) {
      setToursWithTips([])
      return
    }

    setLoading(true)
    try {
      // 해당 기간의 투어 조회
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
        .order('tour_date', { ascending: true })

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

        // reservation_pricing에서 prepayment_tip 조회
        const { data: pricingData, error: pricingError } = await supabase
          .from('reservation_pricing')
          .select('prepayment_tip')
          .in('reservation_id', tour.reservation_ids)

        if (pricingError) {
          console.error('Reservation pricing 조회 오류:', pricingError)
          continue
        }

        // 총 prepayment_tip 합계
        const totalTip = pricingData?.reduce((sum, pricing) => sum + (pricing.prepayment_tip || 0), 0) || 0

        if (totalTip > 0) {
          // 가이드와 어시스턴트 이름 조회
          let guideName = null
          let assistantName = null

          if (tour.tour_guide_id) {
            const { data: guideData } = await supabase
              .from('team')
              .select('name_ko')
              .eq('email', tour.tour_guide_id)
              .single()
            guideName = guideData?.name_ko || null
          }

          if (tour.assistant_id) {
            const { data: assistantData } = await supabase
              .from('team')
              .select('name_ko')
              .eq('email', tour.assistant_id)
              .single()
            assistantName = assistantData?.name_ko || null
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
            reservation_ids: tour.reservation_ids
          })
        }
      }

      setToursWithTips(toursWithTipData)

      // 기존 팁 쉐어 데이터 로드
      await loadTipShares(toursWithTipData.map(t => t.id))
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
          total_tip: share.total_tip || 0
        }
      }

      setTipShares(shares)
    } catch (error) {
      console.error('팁 쉐어 데이터 로드 오류:', error)
    }
  }

  // 팁 쉐어 초기화 (투어별로)
  const initializeTipShare = (tour: TourWithTip) => {
    if (tipShares[tour.id]) {
      return tipShares[tour.id]
    }

    // 기본값: 가이드+어시스턴트 합쳐서 90%, OP 10%
    // 어시스턴트가 있으면 가이드 45%, 어시스턴트 45%, OP 10%
    // 어시스턴트가 없으면 가이드 90%, OP 10%
    const hasAssistant = !!tour.assistant_id
    const defaultGuidePercent = hasAssistant ? 45 : 90
    const defaultAssistantPercent = hasAssistant ? 45 : 0
    const defaultOpPercent = 10

    const totalTip = tour.total_prepaid_tip
    const guideAmount = (totalTip * defaultGuidePercent) / 100
    const assistantAmount = (totalTip * defaultAssistantPercent) / 100
    const opAmount = (totalTip * defaultOpPercent) / 100

    // 기본적으로 OP는 선택하지 않음 (사용자가 선택하도록)
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
      total_tip: totalTip
    }
  }

  // 비율 변경 핸들러
  const handlePercentChange = (tourId: string, role: 'guide' | 'assistant' | 'op', value: number) => {
    const tour = toursWithTips.find(t => t.id === tourId)
    if (!tour) return

    const currentShare = tipShares[tourId] || initializeTipShare(tour)
    const totalTip = tour.total_prepaid_tip

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

    // 총합이 100%가 되도록 조정
    const total = newGuidePercent + newAssistantPercent + newOpPercent
    if (total !== 100) {
      // 비율을 정규화
      if (total > 0) {
        newGuidePercent = (newGuidePercent / total) * 100
        newAssistantPercent = (newAssistantPercent / total) * 100
        newOpPercent = (newOpPercent / total) * 100
      }
    }

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
        total_tip: totalTip
      }
    })
  }

  // 금액 변경 핸들러
  const handleAmountChange = (tourId: string, role: 'guide' | 'assistant' | 'op', value: number) => {
    const tour = toursWithTips.find(t => t.id === tourId)
    if (!tour) return

    const currentShare = tipShares[tourId] || initializeTipShare(tour)
    const totalTip = tour.total_prepaid_tip

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

    // 총합이 totalTip을 넘지 않도록 조정
    const total = newGuideAmount + newAssistantAmount + newOpAmount
    if (total > totalTip) {
      const ratio = totalTip / total
      newGuideAmount = newGuideAmount * ratio
      newAssistantAmount = newAssistantAmount * ratio
      newOpAmount = newOpAmount * ratio
    }

    // 비율 재계산
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

  // OP 체크박스 토글 핸들러
  const handleOpToggle = (tourId: string, opEmail: string, checked: boolean) => {
    const tour = toursWithTips.find(t => t.id === tourId)
    if (!tour) return

    const currentShare = tipShares[tourId] || initializeTipShare(tour)
    const totalTip = tour.total_prepaid_tip
    const opTotalPercent = currentShare.op_percent // 10% 고정
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
    const tour = toursWithTips.find(t => t.id === tourId)
    if (!tour) return

    const currentShare = tipShares[tourId]
    if (!currentShare) return

    const totalTip = tour.total_prepaid_tip
    const opTotalPercent = currentShare.op_percent // 10% 고정
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
    const tour = toursWithTips.find(t => t.id === tourId)
    if (!tour) return

    const currentShare = tipShares[tourId]
    if (!currentShare) return

    const totalTip = tour.total_prepaid_tip
    const opTotalPercent = currentShare.op_percent // 10% 고정
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
          total_tip: share.total_tip
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
      const defaultDates = getDefaultDates()
      setStartDate(defaultDates.start)
      setEndDate(defaultDates.end)
      fetchOpMembers()
    }
  }, [isOpen])

  // 날짜 변경 시 투어 조회
  useEffect(() => {
    if (isOpen && startDate && endDate) {
      fetchToursWithTips()
    }
  }, [isOpen, startDate, endDate])

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <DollarSign className="w-6 h-6 text-purple-600 mr-2" />
            <h2 className="text-xl font-bold text-gray-900">Tips 쉐어 관리</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 내용 */}
        <div className="p-6">
          {/* 기간 선택 */}
          <div className="mb-6">
            <div className="flex items-center space-x-4 mb-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  시작일
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  종료일
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div className="flex items-end space-x-2">
                <button
                  onClick={setCurrentPeriod}
                  className="px-3 py-2 text-xs font-medium text-white bg-purple-600 border border-purple-600 rounded-md hover:bg-purple-700 transition-colors"
                >
                  이번
                </button>
                <button
                  onClick={setPreviousPeriod}
                  className="px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  지난
                </button>
                <button
                  onClick={fetchToursWithTips}
                  disabled={loading}
                  className="px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 inline ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* 투어 목록 */}
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-600" />
              <p className="text-gray-600">투어를 불러오는 중...</p>
            </div>
          ) : toursWithTips.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <DollarSign className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">prepaid 팁이 있는 투어가 없습니다</p>
              <p className="text-sm">선택한 기간에 prepaid 팁이 있는 투어가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {toursWithTips.map((tour) => {
                const share = tipShares[tour.id] || initializeTipShare(tour)
                return (
                  <div key={tour.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {tour.tour_name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {formatDate(tour.tour_date)} | 총 팁: ${formatCurrency(tour.total_prepaid_tip)}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      {/* 가이드 */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          가이드 {tour.guide_name && `(${tour.guide_name})`}
                        </label>
                        <div className="flex space-x-2">
                          <div className="flex-1">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={share.guide_percent.toFixed(1)}
                              onChange={(e) => handlePercentChange(tour.id, 'guide', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                              placeholder="%"
                            />
                            <span className="text-xs text-gray-500">%</span>
                          </div>
                          <div className="flex-1">
                            <div className="relative">
                              <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={share.guide_amount.toFixed(2)}
                                onChange={(e) => handleAmountChange(tour.id, 'guide', parseFloat(e.target.value) || 0)}
                                className="w-full pl-4 pr-1 py-1 text-sm border border-gray-300 rounded-md"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 어시스턴트 */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          어시스턴트 {tour.assistant_name && `(${tour.assistant_name})`}
                        </label>
                        {tour.assistant_id ? (
                          <div className="flex space-x-2">
                            <div className="flex-1">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={share.assistant_percent.toFixed(1)}
                                onChange={(e) => handlePercentChange(tour.id, 'assistant', parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                                placeholder="%"
                              />
                              <span className="text-xs text-gray-500">%</span>
                            </div>
                            <div className="flex-1">
                              <div className="relative">
                                <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={share.assistant_amount.toFixed(2)}
                                  onChange={(e) => handleAmountChange(tour.id, 'assistant', parseFloat(e.target.value) || 0)}
                                  className="w-full pl-4 pr-1 py-1 text-sm border border-gray-300 rounded-md"
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400">어시스턴트 없음</p>
                        )}
                      </div>

                      {/* OP */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          OP (10% 합계)
                        </label>
                        <div className="border border-gray-300 rounded-md p-2 max-h-48 overflow-y-auto">
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
                                <label className="flex-1 text-sm text-gray-700">
                                  {op.name_ko}
                                </label>
                                {isSelected && opShare && (
                                  <div className="flex items-center space-x-1">
                                    <input
                                      type="number"
                                      min="0"
                                      max="10"
                                      step="0.1"
                                      value={opShare.op_percent.toFixed(1)}
                                      onChange={(e) => handleOpPercentChange(tour.id, op.email, parseFloat(e.target.value) || 0)}
                                      className="w-16 px-1 py-0.5 text-xs border border-gray-300 rounded"
                                    />
                                    <span className="text-xs text-gray-500">%</span>
                                    <div className="relative">
                                      <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={opShare.op_amount.toFixed(2)}
                                        onChange={(e) => handleOpAmountChange(tour.id, op.email, parseFloat(e.target.value) || 0)}
                                        className="w-20 pl-4 pr-1 py-0.5 text-xs border border-gray-300 rounded"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                        <div className="flex space-x-2">
                          <div className="flex-1">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={share.op_percent.toFixed(1)}
                              onChange={(e) => handlePercentChange(tour.id, 'op', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                              placeholder="%"
                              readOnly
                            />
                            <span className="text-xs text-gray-500">% (총합)</span>
                          </div>
                          <div className="flex-1">
                            <div className="relative">
                              <span className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={share.op_amount.toFixed(2)}
                                onChange={(e) => handleAmountChange(tour.id, 'op', parseFloat(e.target.value) || 0)}
                                className="w-full pl-4 pr-1 py-1 text-sm border border-gray-300 rounded-md"
                                readOnly
                              />
                            </div>
                            <span className="text-xs text-gray-500">(총합)</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 총합 확인 */}
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">총합:</span>
                        <span className={`font-semibold ${
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
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

