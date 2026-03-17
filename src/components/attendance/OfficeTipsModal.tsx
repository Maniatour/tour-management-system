'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { X, Save, Calendar, DollarSign, Users, Printer, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTranslations } from 'next-intl'

const TIER_LIMITS = { low: 480, mid: 960 } as const
function getTierPercent(totalHours: number): 0 | 50 | 100 {
  if (totalHours < TIER_LIMITS.low) return 0
  if (totalHours < TIER_LIMITS.mid) return 50
  return 100
}

interface TourOfficeTipRow {
  id: string
  tour_date: string
  product_name: string
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
  totalWorkHoursAllTime: number
  tierPercent: 0 | 50 | 100
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
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedStaffEmails, setSelectedStaffEmails] = useState<string[]>([])
  const [tours, setTours] = useState<TourOfficeTipRow[]>([])
  const [opMembers, setOpMembers] = useState<OpMember[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [employeeStats, setEmployeeStats] = useState<EmployeeShareRow[]>([])

  const getDefaultDates = useCallback(() => {
    const today = new Date()
    const twoWeeksAgo = new Date(today)
    twoWeeksAgo.setDate(today.getDate() - 13)
    return {
      start: twoWeeksAgo.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0]
    }
  }, [])

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
      if (allReservationIds.length > 0) {
        const { data: pricingData } = await supabase
          .from('reservation_pricing')
          .select('reservation_id, prepayment_tip')
          .in('reservation_id', allReservationIds)
        pricingData?.forEach((p: { reservation_id: string; prepayment_tip?: number | null }) => {
          pricingByReservation.set(p.reservation_id, Number(p.prepayment_tip) || 0)
        })
      }

      const getPrepaidTipsOfficeShare = (tour: { reservation_ids?: string[] | unknown }) => {
        const ids = tour.reservation_ids
        if (!ids || (Array.isArray(ids) && ids.length === 0)) return 0
        const list = Array.isArray(ids) ? ids as string[] : typeof ids === 'string' ? (ids as string).split(',').map((id: string) => id.trim()).filter(Boolean) : []
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
          product_name: (tour.products as { name_ko?: string })?.name_ko || '—',
          guide_name: guideName,
          assistant_name: assistantName,
          office_tip_amount: tip.amount,
          prepaid_tips_office_share: getPrepaidTipsOfficeShare(tour),
          note: tip.note,
          settled_at: tip.settled_at ?? null
        })
      }
      setTours(rows)
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
        .select('employee_email, date, work_hours')
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
      for (const r of records) {
        const raw = Number(r.work_hours) || 0
        const h = raw > 8 ? raw - 0.5 : raw
        totalByEmail.set(r.employee_email, (totalByEmail.get(r.employee_email) || 0) + h)
        if (startDate && endDate && r.date >= startDate && r.date <= endDate) {
          periodByEmail.set(r.employee_email, (periodByEmail.get(r.employee_email) || 0) + h)
        }
      }

      const rows: EmployeeShareRow[] = selectedStaffEmails.map(email => {
        const total = totalByEmail.get(email) || 0
        const period = periodByEmail.get(email) || 0
        const tier = getTierPercent(total)
        const member = opMembers.find(m => m.email === email)
        return {
          email,
          name_ko: member?.name_ko ?? null,
          totalWorkHoursAllTime: total,
          tierPercent: tier,
          hoursInPeriod: period,
          sharePercent: 0,
          shareAmount: 0
        }
      })
      const totalEffective = rows.reduce(
        (sum, r) => sum + r.hoursInPeriod * (r.tierPercent / 100),
        0
      ) || 0
      const round2 = (n: number) => Math.round(n * 100) / 100
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
    if (isOpen) {
      const { start, end } = getDefaultDates()
      setStartDate(start)
      setEndDate(end)
      fetchOpMembers()
    }
  }, [isOpen, getDefaultDates, fetchOpMembers])

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

  const totalOfficeTips = tours.reduce((s, row) => s + (row.office_tip_amount || 0), 0)
  const totalPrepaidTips = tours.reduce((s, row) => s + (row.prepaid_tips_office_share || 0), 0)
  const totalToDistribute = totalOfficeTips + totalPrepaidTips

  useEffect(() => {
    setEmployeeStats(prev =>
      prev.map(p => ({
        ...p,
        shareAmount: totalToDistribute * (p.sharePercent / 100)
      }))
    )
  }, [totalToDistribute, employeeStats.length])

  const updateTourTip = (tourId: string, field: 'office_tip_amount' | 'note' | 'settled_at', value: number | string | null) => {
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
      const { data: existing } = await supabase
        .from('tour_office_tips')
        .select('id')
        .eq('tour_id', tour.id)
        .maybeSingle()
      if (existing) {
        await supabase.from('tour_office_tips').update(payload).eq('tour_id', tour.id)
      } else {
        await supabase.from('tour_office_tips').insert(payload)
      }
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await upsertTourTips(tours, null)
      onClose()
    } catch (e) {
      console.error('저장 오류:', e)
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
    } catch (e) {
      console.error('배분 완료 오류:', e)
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
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('officeTipsStartDate')}</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('officeTipsEndDate')}</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
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
                        <th className="text-left py-1 px-2 font-medium text-gray-700">{t('officeTipsGuide')}</th>
                        <th className="text-left py-1 px-2 font-medium text-gray-700 whitespace-nowrap">{t('officeTipsPerTour')}</th>
                        <th className="text-left py-1 px-2 font-medium text-gray-700 whitespace-nowrap">Prepaid Tips</th>
                        <th className="text-left py-1 px-2 font-medium text-gray-700">{t('officeTipsNote')}</th>
                        <th className="text-left py-1 px-2 font-medium text-gray-700 whitespace-nowrap">{t('officeTipsSettled')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tours.map(tour => {
                        const guideLabel = [tour.guide_name, tour.assistant_name].filter(Boolean).join(', ') || '—'
                        return (
                          <tr key={tour.id} className="border-b border-gray-100 hover:bg-gray-50/50 last:border-b-0">
                            <td className="py-1 px-2 text-gray-900 whitespace-nowrap align-middle">{formatDateLabel(tour.tour_date)}</td>
                            <td className="py-1 px-2 text-gray-900 truncate align-middle" title={tour.product_name}>{tour.product_name}</td>
                            <td className="py-1 px-2 text-gray-600 truncate align-middle" title={guideLabel}>{guideLabel}</td>
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
              <div className="mt-2 space-y-1 text-sm font-medium text-gray-700">
                <div>{t('officeTipsTotal') || '총 오피스 팁'}: ${totalOfficeTips.toFixed(2)}</div>
                <div>Prepaid Tips 총합: ${totalPrepaidTips.toFixed(2)}</div>
                <div className="border-t border-gray-200 pt-1 mt-1 font-semibold">배분 할 금액: ${totalToDistribute.toFixed(2)}</div>
              </div>
            </div>

            <div className="border-l border-gray-200 pl-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <Users className="w-4 h-4" />
                {t('totalWorkHoursSoFar')} / {t('tipSharePercent')}
              </h3>
              {employeeStats.length === 0 ? (
                <p className="text-sm text-gray-500">{t('officeTipsSelectStaff')}</p>
              ) : (
                <ul className="space-y-3">
                  {employeeStats.map(emp => {
                    const isAmy = (emp.name_ko || emp.email).toLowerCase().includes('amy')
                    return (
                    <li key={emp.email} className="border border-gray-200 rounded-lg p-3 bg-white space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900">{emp.name_ko || emp.email}</span>
                        <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                          {emp.tierPercent}%
                        </span>
                        {isAmy && (
                          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            476.8h
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-600">
                        {t('workHoursLabel')} ({startDate}~{endDate}): {emp.hoursInPeriod.toFixed(1)}h
                      </div>
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
            onClick={onClose}
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
