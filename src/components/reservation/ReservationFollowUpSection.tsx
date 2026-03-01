'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { MessageSquare, Plus, Send, User, Clock, History } from 'lucide-react'
import { useLocale } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export type FollowUpType = 'cancellation_reason' | 'contact'

export interface ReservationFollowUpRow {
  id: string
  reservation_id: string
  type: FollowUpType
  content: string | null
  created_at: string
  created_by: string | null
}

interface ReservationFollowUpSectionProps {
  reservationId: string
  status: string
}

function formatDateTime(iso: string, locale: string = 'ko') {
  try {
    const d = new Date(iso)
    return d.toLocaleString(locale === 'en' ? 'en-US' : 'ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return iso
  }
}

// 예약 수정 이력 전용: "2026-03-01 00:16 AM" 형식
function formatEditHistoryDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    let h = d.getHours()
    const min = String(d.getMinutes()).padStart(2, '0')
    const ampm = h < 12 ? 'AM' : 'PM'
    if (h === 0) h = 12
    else if (h > 12) h -= 12
    const hour = String(h).padStart(2, '0')
    return `${y}-${m}-${day} ${hour}:${min} ${ampm}`
  } catch {
    return iso
  }
}

// reservations 테이블 컬럼명 → 한글/영문 라벨 (예약 수정 이력 표시용)
const RESERVATION_FIELD_LABELS: Record<string, { ko: string; en: string }> = {
  customer_id: { ko: '고객', en: 'Customer' },
  product_id: { ko: '상품', en: 'Product' },
  tour_date: { ko: '투어 날짜', en: 'Tour date' },
  tour_time: { ko: '투어 시간', en: 'Tour time' },
  event_note: { ko: '이벤트 노트', en: 'Event note' },
  pickup_hotel: { ko: '픽업 호텔', en: 'Pickup hotel' },
  pickup_time: { ko: '픽업 시간', en: 'Pickup time' },
  adults: { ko: '성인 인원', en: 'Adults' },
  child: { ko: '아동 인원', en: 'Child' },
  infant: { ko: '유아 인원', en: 'Infant' },
  total_people: { ko: '총 인원', en: 'Total people' },
  channel_id: { ko: '채널', en: 'Channel' },
  status: { ko: '상태', en: 'Status' },
  selected_options: { ko: '선택 옵션', en: 'Selected options' },
  selected_option_prices: { ko: '옵션 가격', en: 'Option prices' },
  choices: { ko: '초이스', en: 'Choices' },
  is_private_tour: { ko: '프라이빗 투어', en: 'Private tour' },
  added_by: { ko: '등록자', en: 'Added by' },
  updated_at: { ko: '수정 일시', en: 'Updated at' },
  channel_rn: { ko: '채널 RN', en: 'Channel RN' }
}

// status 값 → 한글/영문 표시
const STATUS_LABELS: Record<string, { ko: string; en: string }> = {
  pending: { ko: '대기', en: 'Pending' },
  confirmed: { ko: '확정', en: 'Confirmed' },
  completed: { ko: '완료', en: 'Completed' },
  cancelled: { ko: '취소', en: 'Cancelled' },
  canceled: { ko: '취소', en: 'Cancelled' }
}

function formatAuditValue(fieldKey: string, value: unknown, isEn: boolean): string {
  if (value === null || value === undefined) return '-'
  if (fieldKey === 'status' && typeof value === 'string') {
    const v = value.toLowerCase()
    return STATUS_LABELS[v] ? (isEn ? STATUS_LABELS[v].en : STATUS_LABELS[v].ko) : value
  }
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 80) + (JSON.stringify(value).length > 80 ? '…' : '')
  const s = String(value)
  return s.length > 40 ? s.slice(0, 40) + '…' : s
}

// 픽업 호텔/초이스 ID → 이름 lookup으로 사람이 읽기 쉬운 값 표시
function formatAuditValueWithLookups(
  fieldKey: string,
  value: unknown,
  isEn: boolean,
  lookups: {
    pickupHotelsById: Record<string, { hotel?: string | null; pick_up_location?: string | null }>
    choiceNameById: Record<string, string>
    optionNameById: Record<string, string>
  }
): string {
  if (value === null || value === undefined) return '-'
  if (fieldKey === 'status' && typeof value === 'string') {
    const v = value.toLowerCase()
    return STATUS_LABELS[v] ? (isEn ? STATUS_LABELS[v].en : STATUS_LABELS[v].ko) : value
  }
  if (fieldKey === 'pickup_hotel' && typeof value === 'string') {
    const hotel = lookups.pickupHotelsById[value]
    if (hotel?.hotel) {
      return hotel.pick_up_location ? `${hotel.hotel} (${hotel.pick_up_location})` : hotel.hotel
    }
    return value
  }
  if (fieldKey === 'choices' && (typeof value === 'object' || typeof value === 'string')) {
    try {
      const raw = typeof value === 'string' ? JSON.parse(value) : value
      const required = raw?.required
      if (!Array.isArray(required) || required.length === 0) return typeof value === 'string' ? value : JSON.stringify(value).slice(0, 60) + '…'
      const parts = required.map((item: { choice_id?: string; option_id?: string; quantity?: number }) => {
        const choiceName = (item.choice_id && lookups.choiceNameById[item.choice_id]) || item.choice_id || '?'
        const optionName = (item.option_id && lookups.optionNameById[item.option_id]) || item.option_id || '?'
        const qty = item.quantity ?? 1
        return `${choiceName}: ${optionName} × ${qty}`
      })
      return parts.join(', ')
    } catch {
      return typeof value === 'object' ? JSON.stringify(value).slice(0, 80) + '…' : String(value)
    }
  }
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 80) + (JSON.stringify(value).length > 80 ? '…' : '')
  const s = String(value)
  return s.length > 40 ? s.slice(0, 40) + '…' : s
}

export default function ReservationFollowUpSection({
  reservationId,
  status
}: ReservationFollowUpSectionProps) {
  const locale = useLocale()
  const { user } = useAuth()
  const userEmail = user?.email ?? ''
  const isEn = locale === 'en'

  const [followUps, setFollowUps] = useState<ReservationFollowUpRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [cancellationReason, setCancellationReason] = useState('')
  const [cancellationReasonId, setCancellationReasonId] = useState<string | null>(null)
  const [newContactContent, setNewContactContent] = useState('')
  const [showContactForm, setShowContactForm] = useState(false)
  const [teamNameByEmail, setTeamNameByEmail] = useState<Record<string, string>>({})
  const [editHistory, setEditHistory] = useState<{
    id: string
    action: string
    changed_fields: string[] | null
    old_values: Record<string, unknown> | null
    new_values: Record<string, unknown> | null
    created_at: string
    user_email: string | null
  }[]>([])
  const [editHistoryLoading, setEditHistoryLoading] = useState(false)
  const [pickupHotelsById, setPickupHotelsById] = useState<Record<string, { hotel?: string | null; pick_up_location?: string | null }>>({})
  const [choiceNameById, setChoiceNameById] = useState<Record<string, string>>({})
  const [optionNameById, setOptionNameById] = useState<Record<string, string>>({})

  const isCancelled =
    (status && (status as string).toLowerCase()) === 'cancelled' ||
    (status && (status as string).toLowerCase()) === 'canceled'
  const isPending = (status && (status as string).toLowerCase()) === 'pending'

  const fetchFollowUps = useCallback(async () => {
    if (!reservationId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('reservation_follow_ups')
        .select('id, reservation_id, type, content, created_at, created_by')
        .eq('reservation_id', reservationId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('reservation_follow_ups fetch error:', error)
        setFollowUps([])
        return
      }
      const rows = (data || []) as ReservationFollowUpRow[]
      setFollowUps(rows)

      const reasonRow = rows.find((r) => r.type === 'cancellation_reason')
      if (reasonRow) {
        setCancellationReason(reasonRow.content ?? '')
        setCancellationReasonId(reasonRow.id)
      } else {
        setCancellationReason('')
        setCancellationReasonId(null)
      }
    } finally {
      setLoading(false)
    }
  }, [reservationId])

  useEffect(() => {
    fetchFollowUps()
  }, [fetchFollowUps])

  const saveCancellationReason = async () => {
    if (!reservationId || !userEmail) return
    setSaving(true)
    try {
      if (cancellationReasonId) {
        const { error } = await supabase
          .from('reservation_follow_ups')
          .update({ content: cancellationReason.trim() || null })
          .eq('id', cancellationReasonId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('reservation_follow_ups').insert({
          reservation_id: reservationId,
          type: 'cancellation_reason',
          content: cancellationReason.trim() || null,
          created_by: userEmail
        })
        if (error) throw error
      }
      await fetchFollowUps()
    } catch (e) {
      console.error('Save cancellation reason error:', e)
      alert(isEn ? 'Failed to save.' : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const addContact = async () => {
    const content = newContactContent.trim()
    if (!reservationId || !userEmail || !content) return
    setSaving(true)
    try {
      const { error } = await supabase.from('reservation_follow_ups').insert({
        reservation_id: reservationId,
        type: 'contact',
        content,
        created_by: userEmail
      })
      if (error) throw error
      setNewContactContent('')
      setShowContactForm(false)
      await fetchFollowUps()
    } catch (e) {
      console.error('Add contact log error:', e)
      alert(isEn ? 'Failed to add content.' : '내용 추가에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const contactLogs = followUps.filter((r) => r.type === 'contact')

  // 예약 수정 이력 조회 (audit_logs_view)
  useEffect(() => {
    if (!reservationId) return
    setEditHistoryLoading(true)
    supabase
      .from('audit_logs_view')
      .select('id, action, changed_fields, old_values, new_values, created_at, user_email')
      .eq('table_name', 'reservations')
      .eq('record_id', reservationId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        setEditHistoryLoading(false)
        if (error) {
          console.warn('audit_logs_view (reservation edit history) fetch skipped:', error.message)
          setEditHistory([])
          return
        }
        setEditHistory((data || []) as {
          id: string
          action: string
          changed_fields: string[] | null
          old_values: Record<string, unknown> | null
          new_values: Record<string, unknown> | null
          created_at: string
          user_email: string | null
        }[])
      })
  }, [reservationId])

  // contact 로그 + 예약 수정 이력의 이메일로 team nick_name 조회 (표시용: nick_name 우선, 없으면 name_ko, 없으면 이메일)
  useEffect(() => {
    const fromContact = followUps.filter((r) => r.type === 'contact').map((l) => l.created_by).filter(Boolean) as string[]
    const fromEdit = editHistory.map((l) => l.user_email).filter(Boolean) as string[]
    const emails = [...new Set([...fromContact, ...fromEdit])]
    if (emails.length === 0) {
      setTeamNameByEmail((prev) => (Object.keys(prev).length === 0 ? prev : {}))
      return
    }
    supabase
      .from('team')
      .select('email, nick_name, name_ko')
      .in('email', emails)
      .then(({ data }) => {
        const map: Record<string, string> = {}
        ;(data || []).forEach((row: { email: string; nick_name: string | null; name_ko: string | null }) => {
          map[row.email] = row.nick_name ?? row.name_ko ?? row.email
        })
        setTeamNameByEmail(map)
      })
  }, [followUps, editHistory])

  // 예약 수정 이력에 나오는 픽업 호텔 ID, 초이스/옵션 ID 수집 후 이름 lookup 조회
  useEffect(() => {
    const pickupIds = new Set<string>()
    const choiceIds = new Set<string>()
    const optionIds = new Set<string>()
    editHistory.forEach((log) => {
      const oldV = log.old_values || {}
      const newV = log.new_values || {}
      if (typeof oldV.pickup_hotel === 'string' && oldV.pickup_hotel) pickupIds.add(oldV.pickup_hotel)
      if (typeof newV.pickup_hotel === 'string' && newV.pickup_hotel) pickupIds.add(newV.pickup_hotel)
      const parseChoices = (val: unknown) => {
        try {
          const raw = typeof val === 'string' ? JSON.parse(val) : val
          const required = raw?.required
          if (Array.isArray(required)) {
            required.forEach((item: { choice_id?: string; option_id?: string }) => {
              if (item.choice_id) choiceIds.add(item.choice_id)
              if (item.option_id) optionIds.add(item.option_id)
            })
          }
        } catch { /* ignore */ }
      }
      parseChoices(oldV.choices)
      parseChoices(newV.choices)
    })
    if (pickupIds.size === 0 && choiceIds.size === 0 && optionIds.size === 0) {
      setPickupHotelsById({})
      setChoiceNameById({})
      setOptionNameById({})
      return
    }
    const useKo = !isEn
    Promise.all([
      pickupIds.size > 0
        ? supabase.from('pickup_hotels').select('id, hotel, pick_up_location').in('id', [...pickupIds])
        : Promise.resolve({ data: [] }),
      choiceIds.size > 0
        ? supabase.from('product_choices').select('id, choice_group_ko, choice_group').in('id', [...choiceIds])
        : Promise.resolve({ data: [] }),
      optionIds.size > 0
        ? supabase.from('choice_options').select('id, option_name_ko, option_name').in('id', [...optionIds])
        : Promise.resolve({ data: [] })
    ]).then(([pickupRes, choiceRes, optionRes]) => {
      const byId: Record<string, { hotel?: string | null; pick_up_location?: string | null }> = {}
      ;(pickupRes.data || []).forEach((row: { id: string; hotel?: string | null; pick_up_location?: string | null }) => {
        byId[row.id] = { hotel: row.hotel, pick_up_location: row.pick_up_location }
      })
      setPickupHotelsById(byId)
      const choiceNames: Record<string, string> = {}
      ;(choiceRes.data || []).forEach((row: { id: string; choice_group_ko?: string | null; choice_group?: string | null }) => {
        choiceNames[row.id] = (useKo ? row.choice_group_ko : row.choice_group) || row.choice_group_ko || row.choice_group || row.id
      })
      setChoiceNameById(choiceNames)
      const optionNames: Record<string, string> = {}
      ;(optionRes.data || []).forEach((row: { id: string; option_name_ko?: string | null; option_name?: string | null }) => {
        optionNames[row.id] = (useKo ? row.option_name_ko : row.option_name) || row.option_name_ko || row.option_name || row.id
      })
      setOptionNameById(optionNames)
    })
  }, [editHistory, isEn])

  // 취소 사유 프리셋 (클릭 시 바로 기록)
  const CANCELLATION_REASON_PRESETS = isEn
    ? ['No Show', 'Canceled by customer', 'Not recruited', 'Weather', 'Schedule conflict', 'Duplicate booking', 'Price / Policy', 'Other']
    : ['No Show', '고객 취소', '미모집', '날씨', '일정 변경', '중복 예약', '가격/정책', '기타']

  const saveCancellationReasonWithValue = async (value: string) => {
    if (!reservationId || !userEmail) return
    const trimmed = value.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      if (cancellationReasonId) {
        const { error } = await supabase
          .from('reservation_follow_ups')
          .update({ content: trimmed })
          .eq('id', cancellationReasonId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('reservation_follow_ups').insert({
          reservation_id: reservationId,
          type: 'cancellation_reason',
          content: trimmed,
          created_by: userEmail
        })
        if (error) throw error
      }
      setCancellationReason(trimmed)
      await fetchFollowUps()
    } catch (e) {
      console.error('Save cancellation reason error:', e)
      alert(isEn ? 'Failed to save.' : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const title = 'Follow up'

  // 감사 로그 액션 + 변경 필드 → 한 줄 요약 (수정 일시는 제외)
  const getEditHistorySummary = (action: string, changedFields: string[] | null): string => {
    if (action === 'INSERT') return isEn ? 'Reservation created' : '예약 생성'
    if (action === 'DELETE') return isEn ? 'Reservation deleted' : '예약 삭제'
    if (action === 'UPDATE') {
      const fields = (Array.isArray(changedFields) ? changedFields : []).filter((f) => f !== 'updated_at')
      const labels = fields
        .map((f) => (RESERVATION_FIELD_LABELS[f] ? (isEn ? RESERVATION_FIELD_LABELS[f].en : RESERVATION_FIELD_LABELS[f].ko) : f))
        .filter(Boolean)
      const list = labels.length > 0 ? labels.join(', ') : (isEn ? `${fields.length} field(s)` : `${fields.length}개 필드`)
      return isEn ? `Reservation updated: ${list}` : `예약 정보 수정: ${list}`
    }
    return isEn ? 'Change recorded' : '변경 기록'
  }

  return (
    <div id="follow-up-section" className="space-y-3 overflow-y-auto border border-gray-200 rounded-xl p-3 sm:p-4 bg-gray-50/50">
      <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
        <MessageSquare className="w-4 h-4" />
        {title}
      </h3>

      {loading ? (
        <div className="text-sm text-gray-500 py-2">
          {isEn ? 'Loading...' : '불러오는 중...'}
        </div>
      ) : (
        <>
          {isCancelled && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-700">
                {isEn ? 'Cancellation reason' : '취소 사유'}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {CANCELLATION_REASON_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => saveCancellationReasonWithValue(preset)}
                    disabled={saving}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <textarea
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder={
                    isEn
                      ? 'Or enter cancellation reason (optional)'
                      : '또는 취소 사유를 직접 입력 (선택)'
                  }
                  rows={2}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={saveCancellationReason}
                  disabled={saving}
                  className="shrink-0 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium flex items-center gap-1"
                >
                  <Send className="w-4 h-4" />
                  {isEn ? 'Save' : '저장'}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-700">
                {isEn ? 'Content' : '내용'}
              </span>
              <button
                type="button"
                onClick={() => setShowContactForm((v) => !v)}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                {isEn ? 'Add' : '내용 추가'}
              </button>
            </div>

            {showContactForm && (
              <div className="flex gap-2 items-start">
                <textarea
                  value={newContactContent}
                  onChange={(e) => setNewContactContent(e.target.value)}
                  placeholder={
                    isEn
                      ? 'What was communicated (e.g. call, email, refund notice)'
                      : '연락 내용을 입력하세요 (전화, 이메일, 환불 안내 등)'
                  }
                  rows={2}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={addContact}
                  disabled={saving || !newContactContent.trim()}
                  className="shrink-0 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium flex items-center gap-1"
                >
                  <Send className="w-4 h-4" />
                  {isEn ? 'Add' : '추가'}
                </button>
              </div>
            )}

            {contactLogs.length === 0 ? (
              <p className="text-xs text-gray-500 py-2">
                {isEn ? 'No content yet.' : '내용이 없습니다.'}
              </p>
            ) : (
              <ul className="space-y-2 max-h-48 overflow-y-auto">
                {contactLogs.map((log) => (
                  <li
                    key={log.id}
                    className="flex flex-col gap-1.5 p-2 bg-white border border-gray-200 rounded-lg text-xs"
                  >
                    <div className="text-gray-800 whitespace-pre-wrap break-words">
                      {log.content || '-'}
                    </div>
                    <div className="flex items-center justify-between text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        {formatDateTime(log.created_at, locale)}
                      </span>
                      <span className="flex items-center gap-1" title={log.created_by ?? ''}>
                        <User className="w-3.5 h-3.5 shrink-0" />
                        {log.created_by ? (teamNameByEmail[log.created_by] ?? log.created_by) : (isEn ? 'Unknown' : '알 수 없음')}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 예약 수정 이력 (audit_logs_view) - Follow up와 동일 카드 뷰 */}
          <div className="space-y-2 pt-3 border-t border-gray-200">
            <span className="text-xs font-medium text-gray-700 flex items-center gap-1">
              <History className="w-3.5 h-3.5" />
              {isEn ? 'Reservation edit history' : '예약 수정 이력'}
            </span>
            {editHistoryLoading ? (
              <p className="text-xs text-gray-500 py-2">{isEn ? 'Loading...' : '불러오는 중...'}</p>
            ) : editHistory.length === 0 ? (
              <p className="text-xs text-gray-500 py-2">
                {isEn ? 'No edit history yet.' : '수정 이력이 없습니다.'}
              </p>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {editHistory
                  .filter((log) => {
                    // 수정 일시(updated_at)만 변경된 항목은 제외
                    if (log.action !== 'UPDATE') return true
                    const fields = Array.isArray(log.changed_fields) ? log.changed_fields : []
                    if (fields.length !== 1) return true
                    return fields[0] !== 'updated_at'
                  })
                  .map((log) => {
                  const rawFields = Array.isArray(log.changed_fields) ? log.changed_fields : []
                  const fields = rawFields.filter((f) => f !== 'updated_at')
                  const oldV = log.old_values || {}
                  const newV = log.new_values || {}
                  const hasDetail = log.action === 'UPDATE' && fields.length > 0
                  return (
                    <li
                      key={log.id}
                      className="flex flex-col gap-1.5 p-2 bg-white border border-gray-200 rounded-lg text-xs"
                    >
                      <div className="text-gray-800 font-medium">
                        {getEditHistorySummary(log.action, log.changed_fields)}
                      </div>
                      {hasDetail && (
                        <div className="mt-1 pl-2 border-l-2 border-gray-200 space-y-1 text-gray-600">
                          {fields.map((fieldKey) => {
                            const label = RESERVATION_FIELD_LABELS[fieldKey]
                              ? (isEn ? RESERVATION_FIELD_LABELS[fieldKey].en : RESERVATION_FIELD_LABELS[fieldKey].ko)
                              : fieldKey
                            const lookups = { pickupHotelsById, choiceNameById, optionNameById }
                            const oldVal = formatAuditValueWithLookups(fieldKey, oldV[fieldKey], isEn, lookups)
                            const newVal = formatAuditValueWithLookups(fieldKey, newV[fieldKey], isEn, lookups)
                            return (
                              <div key={fieldKey} className="flex flex-wrap gap-x-1">
                                <span className="shrink-0 font-medium text-gray-700">{label}:</span>
                                <span className="text-red-600 line-through">{oldVal}</span>
                                <span className="shrink-0">{isEn ? ' → ' : ' → '}</span>
                                <span className="text-green-700 font-medium">{newVal}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {log.action === 'INSERT' && newV && Object.keys(newV).length > 0 && (
                        <div className="mt-1 pl-2 border-l-2 border-gray-200 text-gray-600">
                          {Object.keys(newV).slice(0, 5).map((k) => {
                            const label = RESERVATION_FIELD_LABELS[k] ? (isEn ? RESERVATION_FIELD_LABELS[k].en : RESERVATION_FIELD_LABELS[k].ko) : k
                            const lookups = { pickupHotelsById, choiceNameById, optionNameById }
                            return (
                              <div key={k}>
                                <span className="font-medium text-gray-700">{label}:</span>{' '}
                                {formatAuditValueWithLookups(k, newV[k], isEn, lookups)}
                              </div>
                            )
                          })}
                          {Object.keys(newV).length > 5 && (
                            <div className="text-gray-400">… +{Object.keys(newV).length - 5} more</div>
                          )}
                        </div>
                      )}
                      <div className="flex items-center justify-between text-gray-500 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          {formatEditHistoryDateTime(log.created_at)}
                        </span>
                        <span className="flex items-center gap-1" title={log.user_email ?? ''}>
                          <User className="w-3.5 h-3.5 shrink-0" />
                          {log.user_email ? (teamNameByEmail[log.user_email] ?? log.user_email) : (isEn ? 'Unknown' : '알 수 없음')}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
