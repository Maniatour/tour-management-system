'use client'

import { useEffect, useState } from 'react'
import { Clock, History, User, X } from 'lucide-react'
import { useLocale } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { choiceOptionIdsForSupabaseIn } from '@/utils/usResidentChoiceSync'
import { useReservationFormChildOverlayZIndex } from '@/components/reservation/ReservationFormModalStackContext'

type EditHistoryLog = {
  id: string
  action: string
  changed_fields: string[] | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  created_at: string
  user_email: string | null
}

type AuditLookups = {
  pickupHotelsById: Record<string, { hotel?: string | null; pick_up_location?: string | null }>
  choiceNameById: Record<string, string>
  optionNameById: Record<string, string>
}

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
  channel_rn: { ko: '채널 RN', en: 'Channel RN' },
}

const STATUS_LABELS: Record<string, { ko: string; en: string }> = {
  pending: { ko: '대기', en: 'Pending' },
  confirmed: { ko: '확정', en: 'Confirmed' },
  completed: { ko: '완료', en: 'Completed' },
  cancelled: { ko: '취소', en: 'Cancelled' },
  canceled: { ko: '취소', en: 'Cancelled' },
}

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

function formatAuditValueWithLookups(
  fieldKey: string,
  value: unknown,
  isEn: boolean,
  lookups: AuditLookups
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
      if (!Array.isArray(required) || required.length === 0) {
        return typeof value === 'string' ? value : JSON.stringify(value).slice(0, 60) + '…'
      }
      const parts = required.map((item: { choice_id?: string; option_id?: string; quantity?: number }) => {
        const choiceName = (item.choice_id && lookups.choiceNameById[item.choice_id]) || item.choice_id || '?'
        const optionName =
          item.option_id === '__undecided__'
            ? '미정'
            : (item.option_id && lookups.optionNameById[item.option_id]) || item.option_id || '?'
        const qty = item.quantity ?? 1
        return `${choiceName}: ${optionName} × ${qty}`
      })
      return parts.join(', ')
    } catch {
      return typeof value === 'object' ? JSON.stringify(value).slice(0, 80) + '…' : String(value)
    }
  }
  if (typeof value === 'object') {
    return JSON.stringify(value).slice(0, 80) + (JSON.stringify(value).length > 80 ? '…' : '')
  }
  const s = String(value)
  return s.length > 40 ? s.slice(0, 40) + '…' : s
}

function fieldLabel(fieldKey: string, isEn: boolean): string {
  const label = RESERVATION_FIELD_LABELS[fieldKey]
  return label ? (isEn ? label.en : label.ko) : fieldKey
}

function getEditHistorySummary(action: string, changedFields: string[] | null, isEn: boolean): string {
  if (action === 'INSERT') return isEn ? 'Reservation created' : '예약 생성'
  if (action === 'DELETE') return isEn ? 'Reservation deleted' : '예약 삭제'
  if (action === 'UPDATE') {
    const fields = (Array.isArray(changedFields) ? changedFields : []).filter((f) => f !== 'updated_at')
    const labels = fields.map((f) => fieldLabel(f, isEn)).filter(Boolean)
    const list =
      labels.length > 0 ? labels.join(', ') : isEn ? `${fields.length} field(s)` : `${fields.length}개 필드`
    return isEn ? `Reservation updated: ${list}` : `예약 정보 수정: ${list}`
  }
  return isEn ? 'Change recorded' : '변경 기록'
}

export interface ReservationEditHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  reservationId: string
}

export default function ReservationEditHistoryModal({
  isOpen,
  onClose,
  reservationId,
}: ReservationEditHistoryModalProps) {
  const locale = useLocale()
  const isEn = locale === 'en'
  const overlayZIndex = useReservationFormChildOverlayZIndex(120)

  const [editHistory, setEditHistory] = useState<EditHistoryLog[]>([])
  const [loading, setLoading] = useState(false)
  const [teamNameByEmail, setTeamNameByEmail] = useState<Record<string, string>>({})
  const [pickupHotelsById, setPickupHotelsById] = useState<
    Record<string, { hotel?: string | null; pick_up_location?: string | null }>
  >({})
  const [choiceNameById, setChoiceNameById] = useState<Record<string, string>>({})
  const [optionNameById, setOptionNameById] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isOpen || !reservationId) return
    let cancelled = false
    setLoading(true)
    supabase
      .from('audit_logs_view')
      .select('id, action, changed_fields, old_values, new_values, created_at, user_email')
      .eq('table_name', 'reservations')
      .eq('record_id', reservationId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (cancelled) return
        setLoading(false)
        if (error) {
          console.warn('audit_logs_view (reservation edit history) fetch skipped:', error.message)
          setEditHistory([])
          return
        }
        setEditHistory((data || []) as EditHistoryLog[])
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, reservationId])

  useEffect(() => {
    if (!isOpen) return
    const emails = [
      ...new Set(
        editHistory.flatMap((l) => {
          const list: string[] = []
          if (l.user_email?.trim()) list.push(l.user_email.trim())
          if (!l.user_email?.trim() && l.action === 'INSERT' && l.new_values) {
            const ab = l.new_values.added_by
            if (typeof ab === 'string' && ab.trim()) list.push(ab.trim())
          }
          return list
        })
      ),
    ]
    if (emails.length === 0) {
      setTeamNameByEmail({})
      return
    }
    let cancelled = false
    supabase
      .from('team')
      .select('email, nick_name, name_ko')
      .in('email', emails)
      .then(({ data }) => {
        if (cancelled) return
        const map: Record<string, string> = {}
        ;(data || []).forEach((row: { email: string; nick_name: string | null; name_ko: string | null }) => {
          map[row.email] = row.nick_name ?? row.name_ko ?? row.email
        })
        setTeamNameByEmail(map)
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, editHistory])

  useEffect(() => {
    if (!isOpen) return
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
        } catch {
          /* ignore */
        }
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
    let cancelled = false
    Promise.all([
      pickupIds.size > 0
        ? supabase.from('pickup_hotels').select('id, hotel, pick_up_location').in('id', [...pickupIds])
        : Promise.resolve({ data: [] }),
      choiceIds.size > 0
        ? supabase.from('product_choices').select('id, choice_group_ko, choice_group').in('id', [...choiceIds])
        : Promise.resolve({ data: [] }),
      optionIds.size > 0
        ? (() => {
            const ids = choiceOptionIdsForSupabaseIn(optionIds)
            return ids.length > 0
              ? supabase.from('choice_options').select('id, option_name_ko, option_name').in('id', ids)
              : Promise.resolve({ data: [] })
          })()
        : Promise.resolve({ data: [] }),
    ]).then(([pickupRes, choiceRes, optionRes]) => {
      if (cancelled) return
      const byId: Record<string, { hotel?: string | null; pick_up_location?: string | null }> = {}
      ;(pickupRes.data || []).forEach((row: { id: string; hotel?: string | null; pick_up_location?: string | null }) => {
        byId[row.id] = {
          hotel: row.hotel ?? null,
          pick_up_location: row.pick_up_location ?? null,
        }
      })
      setPickupHotelsById(byId)
      const choiceNames: Record<string, string> = {}
      ;(choiceRes.data || []).forEach((row: { id: string; choice_group_ko?: string | null; choice_group?: string | null }) => {
        choiceNames[row.id] =
          (useKo ? row.choice_group_ko : row.choice_group) || row.choice_group_ko || row.choice_group || row.id
      })
      setChoiceNameById(choiceNames)
      const optionNames: Record<string, string> = {}
      ;(optionRes.data || []).forEach((row: { id: string; option_name_ko?: string | null; option_name?: string | null }) => {
        optionNames[row.id] =
          (useKo ? row.option_name_ko : row.option_name) || row.option_name_ko || row.option_name || row.id
      })
      setOptionNameById(optionNames)
    })
    return () => {
      cancelled = true
    }
  }, [isOpen, editHistory, isEn])

  if (!isOpen) return null

  const visibleLogs = editHistory.filter((log) => {
    if (log.action !== 'UPDATE') return true
    const fields = Array.isArray(log.changed_fields) ? log.changed_fields : []
    if (fields.length !== 1) return true
    return fields[0] !== 'updated_at'
  })

  const lookups: AuditLookups = { pickupHotelsById, choiceNameById, optionNameById }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
      style={{ zIndex: overlayZIndex }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reservation-edit-history-title"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <h3
            id="reservation-edit-history-title"
            className="text-sm font-semibold text-gray-900 flex items-center gap-2"
          >
            <History className="w-4 h-4 text-gray-600" />
            {isEn ? 'Reservation edit history' : '예약 수정 이력'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
            aria-label={isEn ? 'Close' : '닫기'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {loading ? (
            <p className="text-sm text-gray-500 py-6 text-center">{isEn ? 'Loading...' : '불러오는 중...'}</p>
          ) : visibleLogs.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">
              {isEn ? 'No edit history yet.' : '수정 이력이 없습니다.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {visibleLogs.map((log) => {
                const rawFields = Array.isArray(log.changed_fields) ? log.changed_fields : []
                const fields = rawFields.filter((f) => f !== 'updated_at')
                const oldV = log.old_values || {}
                const newV = log.new_values || {}
                const addedByFromRow =
                  log.action === 'INSERT' && typeof newV.added_by === 'string'
                    ? newV.added_by.trim() || null
                    : null
                const authorEmail = log.user_email?.trim() || addedByFromRow
                const hasDetail = log.action === 'UPDATE' && fields.length > 0
                return (
                  <li
                    key={log.id}
                    className="flex flex-col gap-1.5 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                  >
                    <div className="text-gray-800 font-medium">
                      {getEditHistorySummary(log.action, log.changed_fields, isEn)}
                    </div>
                    {hasDetail && (
                      <div className="mt-1 pl-2 border-l-2 border-gray-200 space-y-1 text-gray-600">
                        {fields.map((fieldKey) => {
                          const oldVal = formatAuditValueWithLookups(fieldKey, oldV[fieldKey], isEn, lookups)
                          const newVal = formatAuditValueWithLookups(fieldKey, newV[fieldKey], isEn, lookups)
                          return (
                            <div key={fieldKey} className="flex flex-wrap gap-x-1">
                              <span className="shrink-0 font-medium text-gray-700">
                                {fieldLabel(fieldKey, isEn)}:
                              </span>
                              <span className="text-red-600 line-through">{oldVal}</span>
                              <span className="shrink-0"> → </span>
                              <span className="text-green-700 font-medium">{newVal}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {log.action === 'INSERT' && newV && Object.keys(newV).length > 0 && (
                      <div className="mt-1 pl-2 border-l-2 border-gray-200 text-gray-600">
                        {Object.keys(newV)
                          .slice(0, 5)
                          .map((k) => (
                            <div key={k}>
                              <span className="font-medium text-gray-700">{fieldLabel(k, isEn)}:</span>{' '}
                              {formatAuditValueWithLookups(k, newV[k], isEn, lookups)}
                            </div>
                          ))}
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
                      <span className="flex items-center gap-1" title={authorEmail ?? ''}>
                        <User className="w-3.5 h-3.5 shrink-0" />
                        {authorEmail
                          ? teamNameByEmail[authorEmail] ?? authorEmail
                          : isEn
                            ? 'Unknown'
                            : '알 수 없음'}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
