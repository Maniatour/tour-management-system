'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { X, Save, Calendar, DollarSign, Users, Printer, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { workCalendarDateYmd } from '@/lib/employeeHourlyRates'
import { useTranslations, useLocale } from 'next-intl'
import { getStatusColor, getStatusText } from '@/utils/tourStatusUtils'
import { calculateAssignedPeople, normalizeReservationIds } from '@/utils/tourUtils'

const TIER_LIMITS = { low: 480, mid: 960 } as const

const OFFICE_TIPS_DATE_RANGE_KEY = 'office-tips-date-range-v1'

function readPersistedOfficeTipsDates(): { start: string; end: string } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(OFFICE_TIPS_DATE_RANGE_KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as { start?: unknown; end?: unknown }
    const start = typeof o.start === 'string' ? o.start.trim() : ''
    const end = typeof o.end === 'string' ? o.end.trim() : ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return null
    if (start > end) return null
    return { start, end }
  } catch {
    return null
  }
}

function writePersistedOfficeTipsDates(start: string, end: string) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(OFFICE_TIPS_DATE_RANGE_KEY, JSON.stringify({ start, end }))
  } catch {
    /* quota / private mode */
  }
}

function localDateToYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getTierPercent(totalHours: number): 0 | 50 | 100 {
  if (totalHours < TIER_LIMITS.low) return 0
  if (totalHours < TIER_LIMITS.mid) return 50
  return 100
}

interface TourOfficeTipRow {
  id: string
  tour_date: string
  tour_status: string
  product_name: string
  /** reservation_ids 배정 예약 인원 합(취소·삭제 제외, 투어 상세와 동일) */
  total_participants: number
  guide_name: string | null
  assistant_name: string | null
  office_tip_amount: number
  prepaid_tips_office_share: number
  note: string
  settled_at: string | null
}

interface OpMember {
  email: string
  name_ko: string | null
}

interface EmployeeShareRow {
  email: string
  name_ko: string | null
  /** 누적 근무(기존 h 합산) — 식사 차감 전 */
  totalGrossHoursAllTime: number
  /** office_meal_log 전체 건수 */
  totalMealCountAllTime: number
  /** 누적 순 근무시간(팁 티어 기준) = totalGross − 0.5×식사횟수 */
  totalWorkHoursAllTime: number
  tierPercent: 0 | 50 | 100
  /** 선택 기간 근무 합 — 식사 차감 전 */
  hoursInPeriodGross: number
  /** 선택 기간 office_meal_log 건수 */
  mealCountInPeriod: number
  /** 선택 기간 순 근무(팁 쉐어 비중 계산) */
  hoursInPeriod: number
  sharePercent: number
  shareAmount: number
}

interface OfficeTipsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function OfficeTipsModal({ isOpen, onClose }: OfficeTipsModalProps) {
  const t = useTranslations('attendancePage')
  const locale = useLocale()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedStaffEmails, setSelectedStaffEmails] = useState<string[]>([])
  const [tours, setTours] = useState<TourOfficeTipRow[]>([])
  const [opMembers, setOpMembers] = useState<OpMember[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [employeeStats, setEmployeeStats] = useState<EmployeeShareRow[]>([])
  const lastSavedToursRef = useRef<string>('')

  const getDefaultDates = useCallback(() => {
    const today = new Date()
    const twoWeeksAgo = new Date(today)
    twoWeeksAgo.setDate(today.getDate() - 13)
    return {
      start: twoWeeksAgo.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0]
    }
  }, [])

  /**
   * 지난 2주 (달력 상·하반기 기준)
   * - 오늘이 1~15일: 전월 16일 ~ 전월 말일
   * - 오늘이 16일~말일: 당월 1일 ~ 15일
   */
  const getPreviousFortnight = useCallback(() => {
    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth()
    const day = today.getDate()

    if (day >= 1 && day <= 15) {
      const prevMonth = month === 0 ? 11 : month - 1
      const prevYear = month === 0 ? year - 1 : year
      const lastDayOfPrev = new Date(prevYear, prevMonth + 1, 0).getDate()
      const start = new Date(prevYear, prevMonth, 16)
      const end = new Date(prevYear, prevMonth, lastDayOfPrev)
      return { start: localDateToYmd(start), end: localDateToYmd(end) }
    }

    const start = new Date(year, month, 1)
    const end = new Date(year, month, 15)
    return { start: localDateToYmd(start), end: localDateToYmd(end) }
  }, [])

  const applyThisFortnight = useCallback(() => {
    const { start, end } = getDefaultDates()
    setStartDate(start)
    setEndDate(end)
  }, [getDefaultDates])

  const applyLastFortnight = useCallback(() => {
    const { start, end } = getPreviousFortnight()
    setStartDate(start)
    setEndDate(end)
  }, [getPreviousFortnight])

  const fetchOpMembers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('team')
        .select('email, name_ko')
        .eq('is_active', true)
        .or('position.ilike.op,position.ilike.office manager')
        .order('name_ko')
      if (error) {
        console.error('OP/OM 멤버 조회 오류:', error)
        return
      }
      setOpMembers((data || []).map(m => ({ email: m.email, name_ko: m.name_ko })))
    } catch (e) {
      console.error('OP/OM 멤버 조회 오류:', e)
    }
  }, [])

  const fetchTours = useCallback(async () => {
    if (!startDate || !endDate) {
      setTours([])
      return
    }
    setLoading(true)
    try {
      const { data: toursData, error: toursError } = await supabase
        .from('tours')
        .select(`
          id,
          tour_date,
          tour_status,
          tour_guide_id,
          assistant_id,
          reservation_ids,
          products!inner(name_ko)
        `)
        .gte('tour_date', startDate)
        .lte('tour_date', endDate)
        .in('tour_status', ['Confirmed', 'Recruiting'])
        .order('tour_date', { ascending: true })

      if (toursError || !toursData?.length) {
        setTours([])
        return
      }

      const { data: officeTipsData } = await supabase
        .from('tour_office_tips')
        .select('tour_id, office_tip_amount, note, settled_at')
        .in('tour_id', toursData.map((t: { id: string }) => t.id))

      const tipsByTour = new Map(
        (officeTipsData || []).map((r: { tour_id: string; office_tip_amount?: number; note?: string | null; settled_at?: string | null }) => [
          r.tour_id,
          { amount: Number(r.office_tip_amount) || 0, note: r.note || '', settled_at: r.settled_at || null }
        ])
      )

      const allReservationIds = (toursData as { reservation_ids?: string[] | unknown }[])
        .flatMap(t => {
          const ids = t.reservation_ids
          if (!ids) return []
          return Array.isArray(ids) ? ids : typeof ids === 'string' ? ids.split(',').map((id: string) => id.trim()).filter(Boolean) : []
        })
        .filter((id, i, arr) => arr.indexOf(id) === i)

      let pricingByReservation = new Map<string, number>()
      let reservationsBatch: Array<{
        id: string
        total_people?: number | null
        status?: string | null
        adults?: number | null
        child?: number | null
        children?: number | null
        infant?: number | null
        infants?: number | null
      }> = []
      if (allReservationIds.length > 0) {
        const { data: pricingData } = await supabase
          .from('reservation_pricing')
          .select('reservation_id, prepayment_tip')
          .in('reservation_id', allReservationIds)
        pricingData?.forEach((p: { reservation_id: string; prepayment_tip?: number | null }) => {
          pricingByReservation.set(p.reservation_id, Number(p.prepayment_tip) || 0)
        })
        const { data: resRows } = await supabase
          .from('reservations')
          .select('id, total_people, status, adults, child, infant')
          .in('id', allReservationIds)
        reservationsBatch = (resRows || []) as typeof reservationsBatch
      }

      const getPrepaidTipsOfficeShare = (tour: { reservation_ids?: string[] | unknown }) => {
        const list = normalizeReservationIds(tour.reservation_ids)
        if (list.length === 0) return 0
        let sum = 0
        for (const rid of list) {
          const tip = pricingByReservation.get(rid) ?? 0
          sum += tip * 0.1
        }
        return Math.round(sum * 100) / 100
      }

      const rows: TourOfficeTipRow[] = []
      for (const tour of toursData) {
        let guideName: string | null = null
        let assistantName: string | null = null
        if (tour.tour_guide_id) {
          const { data: g } = await supabase.from('team').select('nick_name, name_ko').eq('email', tour.tour_guide_id).maybeSingle()
          const gRow = g as { nick_name?: string | null; name_ko?: string | null } | null
          guideName = gRow?.nick_name || gRow?.name_ko || null
        }
        if (tour.assistant_id) {
          const { data: a } = await supabase.from('team').select('nick_name, name_ko').eq('email', tour.assistant_id).maybeSingle()
          const aRow = a as { nick_name?: string | null; name_ko?: string | null } | null
          assistantName = aRow?.nick_name || aRow?.name_ko || null
        }
        const tip = tipsByTour.get(tour.id) || { amount: 0, note: '', settled_at: null }
        rows.push({
          id: tour.id,
          tour_date: tour.tour_date,
          tour_status: String((tour as { tour_status?: string | null }).tour_status ?? '').trim() || '—',
          product_name: (tour.products as { name_ko?: string })?.name_ko || '—',
          total_participants: calculateAssignedPeople(tour, reservationsBatch),
          guide_name: guideName,
          assistant_name: assistantName,
          office_tip_amount: tip.amount,
          prepaid_tips_office_share: getPrepaidTipsOfficeShare(tour),
          note: tip.note,
          settled_at: tip.settled_at ?? null
        })
      }
      setTours(rows)
      lastSavedToursRef.current = JSON.stringify(rows.map(r => ({ id: r.id, office_tip_amount: r.office_tip_amount, note: r.note, settled_at: r.settled_at })))
      setDirty(false)
    } catch (e) {
      console.error('투어 조회 오류:', e)
      setTours([])
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  const fetchAttendanceForStaff = useCallback(async () => {
    if (selectedStaffEmails.length === 0) {
      setEmployeeStats([])
      return
    }
    try {
      const { data: allRecords, error } = await supabase
        .from('attendance_records')
        .select('employee_email, date, check_in_time, work_hours')
        .in('employee_email', selectedStaffEmails)
        .not('check_out_time', 'is', null)

      if (error) {
        console.error('근무 기록 조회 오류:', error)
        setEmployeeStats([])
        return
      }

      const records = allRecords || []
      const totalByEmail = new Map<string, number>()
      const periodByEmail = new Map<string, number>()
      // 출퇴근 관리(상·하반기·월 통계)와 동일: 세션별 work_hours 그대로 합산, 출근일은 workCalendarDateYmd(LV).
      // 예전 8시간 초과 시 0.5h 자동 차감은 여기서 적용하지 않음 — 식사는 office_meal_log만 반영.
      for (const r of records as {
        employee_email: string
        date: string
        check_in_time: string | null
        work_hours: number | null
      }[]) {
        const h = Number(r.work_hours) || 0
        totalByEmail.set(r.employee_email, (totalByEmail.get(r.employee_email) || 0) + h)
        const workYmd = workCalendarDateYmd({ check_in_time: r.check_in_time, date: r.date })
        if (startDate && endDate && workYmd >= startDate && workYmd <= endDate) {
          periodByEmail.set(r.employee_email, (periodByEmail.get(r.employee_email) || 0) + h)
        }
      }

      const { data: mealRows, error: mealErr } = await supabase
        .from('office_meal_log')
        .select('employee_email, meal_date')
        .in('employee_email', selectedStaffEmails)

      if (mealErr) {
        console.error('office_meal_log 조회 오류:', mealErr)
      }

      const periodMealsByEmail = new Map<string, number>()
      const allMealsByEmail = new Map<string, number>()
      for (const row of mealRows || []) {
        const em = (row as { employee_email: string }).employee_email
        const mdRaw = (row as { meal_date: string }).meal_date
        const md = typeof mdRaw === 'string' ? mdRaw.slice(0, 10) : String(mdRaw)
        allMealsByEmail.set(em, (allMealsByEmail.get(em) || 0) + 1)
        if (startDate && endDate && md >= startDate && md <= endDate) {
          periodMealsByEmail.set(em, (periodMealsByEmail.get(em) || 0) + 1)
        }
      }

      const round2 = (n: number) => Math.round(n * 100) / 100
      const mealHours = (n: number) => round2(n * 0.5)

      const rows: EmployeeShareRow[] = selectedStaffEmails.map(email => {
        const totalGross = totalByEmail.get(email) || 0
        const periodGross = periodByEmail.get(email) || 0
        const mealsAll = allMealsByEmail.get(email) || 0
        const mealsPeriod = periodMealsByEmail.get(email) || 0
        const totalNet = Math.max(0, round2(totalGross - mealHours(mealsAll)))
        const periodNet = Math.max(0, round2(periodGross - mealHours(mealsPeriod)))
        const tier = getTierPercent(totalNet)
        const member = opMembers.find(m => m.email === email)
        return {
          email,
          name_ko: member?.name_ko ?? null,
          totalGrossHoursAllTime: totalGross,
          totalMealCountAllTime: mealsAll,
          totalWorkHoursAllTime: totalNet,
          tierPercent: tier,
          hoursInPeriodGross: periodGross,
          mealCountInPeriod: mealsPeriod,
          hoursInPeriod: periodNet,
          sharePercent: 0,
          shareAmount: 0
        }
      })
      const totalEffective = rows.reduce(
        (sum, r) => sum + r.hoursInPeriod * (r.tierPercent / 100),
        0
      ) || 0
      const n = rows.length
      const equalShare = n > 0 ? round2(100 / n) : 0
      const withShare = rows.map((r, i) => ({
        ...r,
        sharePercent: totalEffective > 0
          ? round2((100 * r.hoursInPeriod * (r.tierPercent / 100)) / totalEffective)
          : (i === n - 1 ? round2(100 - equalShare * (n - 1)) : equalShare)
      }))
      setEmployeeStats(withShare)
    } catch (e) {
      console.error('근무 기록 조회 오류:', e)
      setEmployeeStats([])
    }
  }, [selectedStaffEmails, startDate, endDate, opMembers])

  useEffect(() => {
    if (!isOpen) return
    const persisted = readPersistedOfficeTipsDates()
    if (persisted) {
      setStartDate(persisted.start)
      setEndDate(persisted.end)
    } else {
      const { start, end } = getDefaultDates()
      setStartDate(start)
      setEndDate(end)
    }
    fetchOpMembers()
  }, [isOpen, getDefaultDates, fetchOpMembers])

  /** 선택 기간을 새로고침 후에도 유지 */
  useEffect(() => {
    if (!isOpen) return
    if (!startDate || !endDate) return
    writePersistedOfficeTipsDates(startDate, endDate)
  }, [isOpen, startDate, endDate])

  useEffect(() => {
    if (!isOpen || opMembers.length === 0) return
    const defaultEmails = opMembers
      .filter(m => {
        const name = (m.name_ko || '').trim()
        const email = (m.email || '').toLowerCase()
        const nameLower = name.toLowerCase()
        return (
          name === '송화영' ||
          nameLower.includes('amy') || email.includes('amy') ||
          nameLower.includes('hana') || nameLower.includes('myers') || email.includes('hana') || email.includes('myers')
        )
      })
      .map(m => m.email)
    if (defaultEmails.length > 0) {
      setSelectedStaffEmails(defaultEmails)
    }
  }, [isOpen, opMembers])

  useEffect(() => {
    if (isOpen && startDate && endDate) fetchTours()
  }, [isOpen, startDate, endDate, fetchTours])

  useEffect(() => {
    if (isOpen && selectedStaffEmails.length > 0 && opMembers.length > 0) fetchAttendanceForStaff()
    else if (selectedStaffEmails.length === 0) setEmployeeStats([])
  }, [isOpen, selectedStaffEmails, startDate, endDate, opMembers, fetchAttendanceForStaff])

  const unsettledTours = tours.filter(t => !t.settled_at)
  const settledTours = tours.filter(t => !!t.settled_at)
  const totalOfficeTips = unsettledTours.reduce((s, row) => s + (row.office_tip_amount || 0), 0)
  const totalPrepaidTips = unsettledTours.reduce((s, row) => s + (row.prepaid_tips_office_share || 0), 0)
  const totalToDistribute = totalOfficeTips + totalPrepaidTips

  const totalPeriodOfficeTips = tours.reduce((s, row) => s + (row.office_tip_amount || 0), 0)
  const totalPeriodPrepaidTips = tours.reduce((s, row) => s + (row.prepaid_tips_office_share || 0), 0)
  const totalPeriodGrand = totalPeriodOfficeTips + totalPeriodPrepaidTips

  const totalSettledOfficeTips = settledTours.reduce((s, row) => s + (row.office_tip_amount || 0), 0)
  const totalSettledPrepaidTips = settledTours.reduce((s, row) => s + (row.prepaid_tips_office_share || 0), 0)
  const totalSettledPool = totalSettledOfficeTips + totalSettledPrepaidTips

  const sumShareForPool = useCallback((pool: number) => {
    const raw = employeeStats.reduce((sum, e) => sum + pool * (e.sharePercent / 100), 0)
    return Math.round(raw * 100) / 100
  }, [employeeStats])

  const shareSumUnsettled = useMemo(() => sumShareForPool(totalToDistribute), [sumShareForPool, totalToDistribute])
  const shareSumSettled = useMemo(() => sumShareForPool(totalSettledPool), [sumShareForPool, totalSettledPool])

  useEffect(() => {
    setEmployeeStats(prev =>
      prev.map(p => ({
        ...p,
        shareAmount: totalToDistribute * (p.sharePercent / 100)
      }))
    )
  }, [totalToDistribute, employeeStats.length])

  const updateTourTip = (tourId: string, field: 'office_tip_amount' | 'note' | 'settled_at', value: number | string | null) => {
    setDirty(true)
    setTours(prev =>
      prev.map(t =>
        t.id === tourId
          ? {
              ...t,
              ...(field === 'office_tip_amount' ? { office_tip_amount: Number(value) || 0 } : field === 'note' ? { note: String(value) } : { settled_at: value as string | null })
            }
          : t
      )
    )
  }

  const toggleSettled = (tourId: string) => {
    setDirty(true)
    setTours(prev =>
      prev.map(t =>
        t.id === tourId
          ? { ...t, settled_at: t.settled_at ? null : new Date().toISOString() }
          : t
      )
    )
  }

  const updateSharePercent = (email: string, value: number) => {
    const round2 = (n: number) => Math.round(n * 100) / 100
    const clamped = round2(Math.max(0, Math.min(100, value)))
    setEmployeeStats(prev =>
      prev.map(p => (p.email === email ? { ...p, sharePercent: clamped } : p))
    )
  }

  const updateTier = (email: string, value: 0 | 50 | 100) => {
    setEmployeeStats(prev => {
      const next = prev.map(p => (p.email === email ? { ...p, tierPercent: value } : p))
      const totalEffective = next.reduce((s, r) => s + r.hoursInPeriod * (r.tierPercent / 100), 0) || 0
      const round2 = (n: number) => Math.round(n * 100) / 100
      return next.map(r => ({
        ...r,
        sharePercent: totalEffective > 0 ? round2((100 * r.hoursInPeriod * (r.tierPercent / 100)) / totalEffective) : 0
      }))
    })
  }

  const getTierForStaff = (email: string): 0 | 50 | 100 => {
    const row = employeeStats.find(e => e.email === email)
    return row ? row.tierPercent : 50
  }

  const toggleStaff = (email: string) => {
    setSelectedStaffEmails(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    )
  }

  const upsertTourTips = async (toursToSave: TourOfficeTipRow[], settledAt: string | null) => {
    for (const tour of toursToSave) {
      const payload = {
        tour_id: tour.id,
        office_tip_amount: tour.office_tip_amount,
        note: tour.note || null,
        settled_at: settledAt ?? tour.settled_at ?? null
      }
      const { data: existing, error: fetchError } = await supabase
        .from('tour_office_tips')
        .select('id')
        .eq('tour_id', tour.id)
        .maybeSingle()
      if (fetchError) {
        throw new Error(`투어 팁 조회 실패: ${fetchError.message}`)
      }
      if (existing) {
        const { error: updateError } = await supabase.from('tour_office_tips').update(payload).eq('tour_id', tour.id)
        if (updateError) {
          throw new Error(`저장 실패 (투어 ${tour.tour_date}): ${updateError.message}`)
        }
      } else {
        const { error: insertError } = await supabase.from('tour_office_tips').insert(payload)
        if (insertError) {
          throw new Error(`저장 실패 (투어 ${tour.tour_date}): ${insertError.message}`)
        }
      }
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await upsertTourTips(tours, null)
      lastSavedToursRef.current = JSON.stringify(tours.map(r => ({ id: r.id, office_tip_amount: r.office_tip_amount, note: r.note, settled_at: r.settled_at })))
      setDirty(false)
      toast.success(t('saveSuccess'))
      onClose()
    } catch (e) {
      console.error('저장 오류:', e)
      const message = e instanceof Error ? e.message : '저장 중 오류가 발생했습니다.'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const handleBatchSettle = async () => {
    if (tours.length === 0) return
    setSaving(true)
    try {
      const settledAt = new Date().toISOString()
      await upsertTourTips(tours, settledAt)
      setTours(prev => prev.map(t => ({ ...t, settled_at: settledAt })))
      lastSavedToursRef.current = JSON.stringify(tours.map(r => ({ id: r.id, office_tip_amount: r.office_tip_amount, note: r.note, settled_at: settledAt })))
      setDirty(false)
      toast.success(t('batchSettleSuccess'))
    } catch (e) {
      console.error('배분 완료 오류:', e)
      const message = e instanceof Error ? e.message : '배분 완료 처리 중 오류가 발생했습니다.'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'Z')
    const m = d.getUTCMonth() + 1
    const day = d.getUTCDate()
    return `${m}월 ${day}일`
  }

  const handlePrint = () => {
    window.print()
  }

  const handleClose = () => {
    const currentSnapshot = JSON.stringify(tours.map(r => ({ id: r.id, office_tip_amount: r.office_tip_amount, note: r.note, settled_at: r.settled_at })))
    if (dirty && currentSnapshot !== lastSavedToursRef.current) {
      if (window.confirm(t('unsavedChanges'))) {
        onClose()
      }
    } else {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #office-tips-modal-root, #office-tips-modal-root * { visibility: visible; }
          #office-tips-modal-root { position: absolute; left: 0; top: 0; width: 100%; min-height: 100%; background: white; }
        }
      `}} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 print:bg-white print:p-0 print:block" id="office-tips-modal-root">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-[min(95vw,88rem)] max-h-[90vh] overflow-hidden flex flex-col print:max-h-none print:shadow-none print:rounded-none">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 print:justify-start">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-amber-600 print:inline" />
            {t('officeTips')}
          </h2>
          <div className="flex items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Printer className="w-4 h-4" />
              {t('print') || '인쇄'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-0 sm:min-w-[11rem] sm:flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('officeTipsStartDate')}</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="min-w-0 sm:min-w-[11rem] sm:flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('officeTipsEndDate')}</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2 sm:pb-0.5">
              <button
                type="button"
                onClick={applyLastFortnight}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 whitespace-nowrap"
              >
                {t('officeTipsLastTwoWeeks')}
              </button>
              <button
                type="button"
                onClick={applyThisFortnight}
                className="px-3 py-2 text-sm font-medium text-white bg-amber-600 border border-amber-700 rounded-lg hover:bg-amber-700 whitespace-nowrap"
              >
                {t('officeTipsThisTwoWeeks')}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('officeTipsSelectStaff')}</label>
            <div className="flex flex-wrap items-center gap-3">
              {opMembers.map(m => {
                const isSelected = selectedStaffEmails.includes(m.email)
                const tier = getTierForStaff(m.email)
                return (
                  <div key={m.email} className="flex items-center gap-2 flex-wrap">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleStaff(m.email)}
                        className="rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-sm text-gray-700">{m.name_ko || m.email}</span>
                    </label>
                    {isSelected && (
                      <span className="flex items-center gap-1.5 text-sm">
                        <span className="text-gray-500">{t('officeTipsTier')}:</span>
                        <select
                          value={tier}
                          onChange={e => updateTier(m.email, Number(e.target.value) as 0 | 50 | 100)}
                          className="rounded border border-gray-300 px-2 py-1 text-sm w-[72px]"
                        >
                          <option value={0}>0%</option>
                          <option value={50}>50%</option>
                          <option value={100}>100%</option>
                        </select>
                      </span>
                    )}
                  </div>
                )
              })}
              {opMembers.length === 0 && (
                <span className="text-sm text-gray-500">{t('noRecords')}</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {t('officeTipsPerTour')}
              </h3>
              {loading ? (
                <p className="text-sm text-gray-500">{t('officeTipsLoading') || '로딩 중...'}</p>
              ) : tours.length === 0 ? (
                <p className="text-sm text-gray-500">{t('officeTipsNoTours') || `${startDate} ~ ${endDate} 기간에 투어가 없습니다.`}</p>
              ) : (
                <div className="border border-gray-200 rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-200">
                        <th className="text-left py-1 px-2 font-medium text-gray-700 whitespace-nowrap">{t('officeTipsDate')}</th>
                        <th className="text-left py-1 px-2 font-medium text-gray-700">{t('officeTipsProduct')}</th>
                        <th className="text-right py-1 px-2 font-medium text-gray-700 whitespace-nowrap w-[3.5rem]">
                          {t('officeTipsTourHeadcount')}
                        </th>
                        <th className="text-left py-1 px-2 font-medium text-gray-700">{t('officeTipsGuide')}</th>
                        <th className="text-left py-1 px-2 font-medium text-gray-700 whitespace-nowrap">{t('officeTipsTourStatus')}</th>
                        <th className="text-left py-1 px-2 font-medium text-gray-700 whitespace-nowrap">{t('officeTipsPerTour')}</th>
                        <th className="text-left py-1 px-2 font-medium text-gray-700 whitespace-nowrap">Prepaid Tips</th>
                        <th className="text-left py-1 px-2 font-medium text-gray-700">{t('officeTipsNote')}</th>
                        <th className="text-left py-1 px-2 font-medium text-gray-700 whitespace-nowrap">{t('officeTipsSettled')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tours.map(tour => {
                        const guideLabel = [tour.guide_name, tour.assistant_name].filter(Boolean).join(', ') || '—'
                        const statusRaw = tour.tour_status && tour.tour_status !== '—' ? tour.tour_status : null
                        const statusLabel = statusRaw ? getStatusText(statusRaw, locale) : '—'
                        return (
                          <tr key={tour.id} className="border-b border-gray-100 hover:bg-gray-50/50 last:border-b-0">
                            <td className="py-1 px-2 text-gray-900 whitespace-nowrap align-middle">{formatDateLabel(tour.tour_date)}</td>
                            <td className="py-1 px-2 text-gray-900 truncate align-middle" title={tour.product_name}>{tour.product_name}</td>
                            <td className="py-1 px-2 text-gray-900 text-right tabular-nums align-middle whitespace-nowrap">
                              {tour.total_participants > 0 ? tour.total_participants : '—'}
                            </td>
                            <td className="py-1 px-2 text-gray-600 truncate align-middle" title={guideLabel}>{guideLabel}</td>
                            <td className="py-1 px-2 align-middle">
                              {statusRaw ? (
                                <span
                                  className={`inline-flex max-w-[10rem] truncate px-1.5 py-0.5 rounded-full text-[11px] font-medium ${getStatusColor(statusRaw)}`}
                                  title={statusRaw}
                                >
                                  {statusLabel}
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="py-1 px-2 align-middle">
                              <span className="text-gray-500 mr-0.5">$</span>
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={tour.office_tip_amount || ''}
                                onChange={e => updateTourTip(tour.id, 'office_tip_amount', e.target.value)}
                                className="w-16 rounded border border-gray-300 px-1.5 py-0.5 text-xs"
                              />
                            </td>
                            <td className="py-1 px-2 align-middle text-gray-700">
                              ${tour.prepaid_tips_office_share.toFixed(2)}
                            </td>
                            <td className="py-1 px-2 align-middle">
                              <input
                                type="text"
                                value={tour.note || ''}
                                onChange={e => updateTourTip(tour.id, 'note', e.target.value)}
                                placeholder={t('officeTipsNotePlaceholder')}
                                className="w-full min-w-0 rounded border border-gray-300 px-1.5 py-0.5 text-xs"
                              />
                            </td>
                            <td className="py-1 px-2 align-middle">
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!!tour.settled_at}
                                  onChange={() => toggleSettled(tour.id)}
                                  className="rounded border-gray-300 text-green-600 w-3.5 h-3.5"
                                />
                                {tour.settled_at && (
                                  <span className="text-[11px] text-gray-500 whitespace-nowrap">
                                    {new Date(tour.settled_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', year: '2-digit' })}
                                  </span>
                                )}
                              </label>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-2 space-y-1.5 text-sm text-gray-700">
                {tours.length > 0 && (
                  <>
                    <div className="font-semibold text-gray-900">{t('officeTipsPeriodSummaryTitle')}</div>
                    <div className="font-medium">
                      {t('officeTipsPeriodTotalOfficeTips')}: ${totalPeriodOfficeTips.toFixed(2)}
                    </div>
                    <div className="font-medium">
                      {t('officeTipsPeriodTotalPrepaid')}: ${totalPeriodPrepaidTips.toFixed(2)}
                    </div>
                    <div className="font-semibold text-gray-900 border-b border-gray-200 pb-2">
                      {t('officeTipsPeriodGrandTotal')}: ${totalPeriodGrand.toFixed(2)}
                    </div>
                    <div className="font-semibold text-green-800 pt-1">
                      {t('officeTipsSettledTotal')}: ${totalSettledPool.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500 -mt-1">
                      {t('officeTipsSettledBreakdown', {
                        office: `$${totalSettledOfficeTips.toFixed(2)}`,
                        prepaid: `$${totalSettledPrepaidTips.toFixed(2)}`,
                      })}
                    </div>
                    <div className="font-semibold text-amber-900">{t('officeTipsUnsettledTotal')}: ${totalToDistribute.toFixed(2)}</div>
                    <div className="text-xs text-gray-500 -mt-1">
                      {t('officeTipsUnsettledBreakdown', {
                        office: `$${totalOfficeTips.toFixed(2)}`,
                        prepaid: `$${totalPrepaidTips.toFixed(2)}`,
                      })}
                    </div>
                  </>
                )}
                {employeeStats.length > 0 && (totalToDistribute > 0 || totalSettledPool > 0) && (
                  <div className="border-t border-gray-200 pt-2 mt-1 space-y-1 font-medium">
                    {totalToDistribute > 0 && (
                      <div className="text-amber-900">
                        {t('officeTipsShareSumUnsettled')}: ${shareSumUnsettled.toFixed(2)}
                      </div>
                    )}
                    {totalSettledPool > 0 && (
                      <div className="text-green-900">
                        {t('officeTipsShareSumSettled')}: ${shareSumSettled.toFixed(2)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="border-l border-gray-200 pl-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-1 flex items-center gap-2">
                <Users className="w-4 h-4" />
                {t('officeTipsWorkAndShareTitle')}
              </h3>
              <p className="text-[11px] text-gray-500 leading-snug mb-2 max-w-md">
                {t('officeTipsPeriodWorkDayRule')}
              </p>
              {employeeStats.length === 0 ? (
                <p className="text-sm text-gray-500">{t('officeTipsSelectStaff')}</p>
              ) : (
                <ul className="space-y-3">
                  {employeeStats.map(emp => {
                    const mealDeductHours = (c: number) => Math.round(c * 0.5 * 100) / 100
                    return (
                    <li key={emp.email} className="border border-gray-200 rounded-lg p-3 bg-white space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900">{emp.name_ko || emp.email}</span>
                        <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                          {emp.tierPercent}%
                        </span>
                        {emp.tierPercent !== 100 && (
                          <span
                            className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 tabular-nums"
                            title={t('officeTipsCumulativeNetHoursBadgeTitle')}
                          >
                            {emp.totalWorkHoursAllTime.toFixed(1)}h
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-600 space-y-0.5 rounded-md bg-amber-50/50 p-2 border border-amber-100/80">
                        <div className="font-medium text-gray-800">{t('officeTipsPeriodWork')}</div>
                        <div>
                          {t('officeTipsPeriodGross', {
                            start: startDate,
                            end: endDate,
                            gross: emp.hoursInPeriodGross.toFixed(1),
                          })}
                        </div>
                        <div>
                          {t('officeTipsMealDeductLine', {
                            count: emp.mealCountInPeriod,
                            deduct: mealDeductHours(emp.mealCountInPeriod).toFixed(1),
                          })}
                        </div>
                        <div className="font-medium text-gray-900">
                          {t('officeTipsNetHoursLine', { net: emp.hoursInPeriod.toFixed(1) })}
                        </div>
                      </div>
                      <div className="text-[11px] text-amber-800/90">{t('officeTipsShareUsesNet')}</div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-600">{t('tipSharePercent')}</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.01}
                          value={emp.sharePercent.toFixed(2)}
                          onChange={e => updateSharePercent(emp.email, parseFloat(e.target.value) || 0)}
                          className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                        <span className="text-xs">%</span>
                        <span className="text-sm font-medium ml-auto">{t('tipShareAmount')}: ${(totalToDistribute * (emp.sharePercent / 100)).toFixed(2)}</span>
                      </div>
                    </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50 print:hidden">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {t('close') || '닫기'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? (t('saving') || '저장 중...') : (t('save') || '저장')}
          </button>
          <button
            type="button"
            onClick={handleBatchSettle}
            disabled={saving || tours.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            <CheckCircle className="w-4 h-4" />
            {t('officeTipsBatchSettle') || '배분 완료'}
          </button>
        </div>
      </div>
    </div>
    </>
  )
}
