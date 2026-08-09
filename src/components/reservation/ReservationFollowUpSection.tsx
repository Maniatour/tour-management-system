'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { MessageSquare, Plus, Send, User, Clock } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { supabase, isAbortLikeError } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { useAuth } from '@/contexts/AuthContext'
import { useReservationFollowUpSnapshots } from '@/hooks/useReservationFollowUpSnapshots'
import { ReservationFollowUpPipelineIcons } from '@/components/reservation/ReservationFollowUpPipelineIcons'
import EmailPreviewModal from '@/components/reservation/EmailPreviewModal'
import ResidentInquiryEmailPreviewModal from '@/components/reservation/ResidentInquiryEmailPreviewModal'
import CancellationFollowUpMessagePreviewModal from '@/components/reservation/CancellationFollowUpMessagePreviewModal'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import {
  resolveReservationEmailIsEnglish,
  resolveReservationEmailLocale,
} from '@/lib/reservationEmailLocale'
import { getCustomerName, getProductName } from '@/utils/reservationUtils'
import type { FollowUpPipelineStepKey } from '@/lib/reservationFollowUpPipeline'
import { reservationExcludedFromFollowUpPipeline } from '@/lib/reservationFollowUpPipeline'
import type { Reservation, Customer, Product } from '@/types/reservation'

type PipelineEmailPreviewState = {
  reservationId: string
  emailType: 'confirmation' | 'departure' | 'pickup' | 'resident_inquiry'
  customerEmail: string
  pickupTime?: string | null
  tourDate?: string | null
  customerName?: string | null
  productName?: string | null
  channelRN?: string | null
  customerLanguage?: string | null
  productCode?: string | null
  productTags?: string[] | null
}

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
  /** 예약 폼과 동일: 컨펌·거주·출발·픽업 파이프라인 표시 */
  followUpPipelineProductId?: string | null
  followUpPipelineProducts?: Array<{
    id: string
    product_code?: string | null
    tags?: string[] | null
    name?: string | null
    name_ko?: string | null
    name_en?: string | null
    customer_name_ko?: string | null
    customer_name_en?: string | null
  }>
  followUpPipelineReservation?: Reservation | null
  followUpPipelineCustomers?: Customer[]
  /** 상단 이메일 버튼 발송 성공 시 부모에서 증가 → 파이프라인 재조회 */
  followUpPipelineRefreshToken?: number
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

export default function ReservationFollowUpSection({
  reservationId,
  status,
  followUpPipelineProductId,
  followUpPipelineProducts,
  followUpPipelineReservation,
  followUpPipelineCustomers,
  followUpPipelineRefreshToken = 0,
}: ReservationFollowUpSectionProps) {
  const locale = useLocale()
  const tRes = useTranslations('reservations')
  const { user } = useAuth()
  const userEmail = user?.email ?? ''
  const isEn = locale === 'en'

  const showFollowUpPipeline =
    !!followUpPipelineReservation &&
    !!String(followUpPipelineProductId ?? '').trim() &&
    (followUpPipelineProducts?.length ?? 0) > 0

  const reservationsLiteForPipeline = useMemo(
    () =>
      showFollowUpPipeline && reservationId
        ? [
            {
              id: reservationId,
              productId: String(followUpPipelineProductId ?? '').trim(),
              status: followUpPipelineReservation?.status ?? null,
              tourStatus: null,
            },
          ]
        : [],
    [
      showFollowUpPipeline,
      reservationId,
      followUpPipelineProductId,
      followUpPipelineReservation?.status,
    ]
  )

  const [pipelineLocalRevision, setPipelineLocalRevision] = useState(0)
  const pipelineRefreshCombined = followUpPipelineRefreshToken + pipelineLocalRevision

  const { snapshotsByReservationId: pipelineSnapshots, loading: pipelineSnapshotsLoading } =
    useReservationFollowUpSnapshots(
      reservationsLiteForPipeline,
      (followUpPipelineProducts ?? []) as Array<{ id: string; product_code?: string | null }>,
      pipelineRefreshCombined
    )

  const pipelineSnapshot = pipelineSnapshots.get(reservationId) ?? null

  const [pipelineEmailPreview, setPipelineEmailPreview] = useState<PipelineEmailPreviewState | null>(
    null
  )

  const openPipelineEmailPreview = useCallback(
    (
      emailType: 'confirmation' | 'departure' | 'pickup' | 'resident_inquiry'
    ) => {
      const res = followUpPipelineReservation
      const customers = followUpPipelineCustomers ?? []
      if (!res) return
      const customer = customers.find((c) => c.id === res.customerId)
      if (!customer) {
        alert(tRes('messages.customerNotLinkedForEmailPreview'))
        return
      }

      if (emailType === 'pickup' && (!res.pickUpTime || !res.tourDate)) {
        alert(tRes('messages.pickupAndTourDateRequired'))
        return
      }

      if (emailType === 'resident_inquiry') {
        const prod = followUpPipelineProducts?.find((p) => p.id === res.productId)
        const emailIsEn = resolveReservationEmailIsEnglish(customer.language ?? null, null)
        const productNameForEmail =
          prod != null
            ? emailIsEn
              ? String(prod.customer_name_en || prod.name_en || prod.name || '').trim()
              : String(prod.customer_name_ko || prod.name_ko || prod.name || '').trim()
            : ''
        setPipelineEmailPreview({
          reservationId: res.id,
          emailType: 'resident_inquiry',
          customerEmail: customer.email ?? '',
          pickupTime: null,
          tourDate: res.tourDate,
          customerName:
            getCustomerName(res.customerId, customers) || customer.name || '',
          productName:
            productNameForEmail ||
            getProductName(res.productId, (followUpPipelineProducts ?? []) as Product[]),
          channelRN: res.channelRN ?? null,
          customerLanguage: customer.language ?? null,
          productCode: prod?.product_code ?? null,
          productTags: prod?.tags ?? null,
        })
        return
      }

      setPipelineEmailPreview({
        reservationId: res.id,
        emailType,
        customerEmail: customer.email ?? '',
        pickupTime: res.pickUpTime,
        tourDate: res.tourDate,
      })
    },
    [followUpPipelineReservation, followUpPipelineCustomers, followUpPipelineProducts, tRes]
  )

  const sendPipelineEmailFromPreview = useCallback(async (opts?: { includePriceInfo?: boolean }) => {
    if (!pipelineEmailPreview) return
    if (!pipelineEmailPreview.customerEmail?.trim()) {
      alert(tRes('messages.emailSendRequiresCustomerEmail'))
      return
    }
    const customers = followUpPipelineCustomers ?? []
    const customer = customers.find((c) => c.id === followUpPipelineReservation?.customerId)
    const sendLocale = resolveReservationEmailLocale(customer?.language ?? null, null)
    const includePriceInfo = opts?.includePriceInfo !== false

    let response: Response
    if (pipelineEmailPreview.emailType === 'resident_inquiry') {
      response = await fetchApiWithAuth('/api/send-resident-inquiry-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId: pipelineEmailPreview.reservationId,
          locale: sendLocale,
          sentBy: userEmail || null,
        }),
      })
    } else if (pipelineEmailPreview.emailType === 'confirmation') {
      response = await fetchApiWithAuth('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId: pipelineEmailPreview.reservationId,
          email: pipelineEmailPreview.customerEmail,
          type: 'both',
          locale: sendLocale,
          sentBy: userEmail || null,
          includePriceInfo,
        }),
      })
    } else if (pipelineEmailPreview.emailType === 'departure') {
      response = await fetchApiWithAuth('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId: pipelineEmailPreview.reservationId,
          email: pipelineEmailPreview.customerEmail,
          type: 'voucher',
          locale: sendLocale,
          sentBy: userEmail || null,
          includePriceInfo,
        }),
      })
    } else if (pipelineEmailPreview.emailType === 'pickup') {
      if (!pipelineEmailPreview.pickupTime || !pipelineEmailPreview.tourDate) {
        throw new Error(tRes('messages.pickupAndTourDateRequired'))
      }
      const pt = pipelineEmailPreview.pickupTime.trim()
      response = await fetchApiWithAuth('/api/send-pickup-schedule-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId: pipelineEmailPreview.reservationId,
          pickupTime: pt.includes(':') ? pt : `${pt}:00`,
          tourDate: pipelineEmailPreview.tourDate,
          locale: sendLocale,
          sentBy: userEmail || null,
        }),
      })
    } else {
      throw new Error(tRes('messages.emailSendError'))
    }

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(typeof data?.error === 'string' ? data.error : tRes('messages.emailSendError'))
    }

    alert(tRes('messages.emailSendSuccess'))
    setPipelineEmailPreview(null)
    setPipelineLocalRevision((x) => x + 1)
  }, [
    pipelineEmailPreview,
    followUpPipelineCustomers,
    followUpPipelineReservation?.customerId,
    userEmail,
    tRes,
  ])

  const handlePipelineManualStep = useCallback(
    async (step: FollowUpPipelineStepKey, action: 'mark' | 'clear') => {
      const col =
        step === 'confirmation'
          ? 'confirmation_manual'
          : step === 'resident'
            ? 'resident_manual'
            : step === 'departure'
              ? 'departure_manual'
              : 'pickup_manual'

      const { data: existing, error: selErr } = await supabase
        .from('reservation_follow_up_pipeline_manual')
        .select(
          'confirmation_manual, resident_manual, departure_manual, pickup_manual, cancel_follow_up_manual, cancel_rebooking_outreach_manual'
        )
        .eq('reservation_id', reservationId)
        .maybeSingle()

      if (selErr) {
        console.error(selErr)
        alert(isEn ? `Save failed: ${selErr.message}` : `저장 실패: ${selErr.message}`)
        return
      }

      const base = {
        confirmation_manual: !!(existing as { confirmation_manual?: boolean } | null)?.confirmation_manual,
        resident_manual: !!(existing as { resident_manual?: boolean } | null)?.resident_manual,
        departure_manual: !!(existing as { departure_manual?: boolean } | null)?.departure_manual,
        pickup_manual: !!(existing as { pickup_manual?: boolean } | null)?.pickup_manual,
        cancel_follow_up_manual: !!(existing as { cancel_follow_up_manual?: boolean } | null)?.cancel_follow_up_manual,
        cancel_rebooking_outreach_manual: !!(existing as { cancel_rebooking_outreach_manual?: boolean } | null)
          ?.cancel_rebooking_outreach_manual,
      }
      base[col as keyof typeof base] = action === 'mark'

      const anyTrue = Object.values(base).some(Boolean)

      if (!anyTrue) {
        if (existing) {
          const { error } = await supabase
            .from('reservation_follow_up_pipeline_manual')
            .delete()
            .eq('reservation_id', reservationId)
          if (error) {
            console.error(error)
            alert(isEn ? `Save failed: ${error.message}` : `저장 실패: ${error.message}`)
            return
          }
        }
      } else {
        const { error } = await supabase.from('reservation_follow_up_pipeline_manual').upsert(
          {
            reservation_id: reservationId,
            ...base,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'reservation_id' }
        )
        if (error) {
          console.error(error)
          alert(isEn ? `Save failed: ${error.message}` : `저장 실패: ${error.message}`)
          return
        }
      }

      setPipelineLocalRevision((x) => x + 1)
    },
    [reservationId, isEn]
  )

  const [followUps, setFollowUps] = useState<ReservationFollowUpRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [cancellationReason, setCancellationReason] = useState('')
  const [cancellationReasonId, setCancellationReasonId] = useState<string | null>(null)
  const [newContactContent, setNewContactContent] = useState('')
  const [showContactForm, setShowContactForm] = useState(false)
  const [teamNameByEmail, setTeamNameByEmail] = useState<Record<string, string>>({})
  const [cancelMessagePreviewOpen, setCancelMessagePreviewOpen] = useState(false)

  const isCancelled =
    (status && (status as string).toLowerCase()) === 'cancelled' ||
    (status && (status as string).toLowerCase()) === 'canceled'

  const fetchFollowUps = useCallback(async () => {
    if (!reservationId) return
    setLoading(true)
    try {
      const { data, error } = await fromUntypedTable(supabase, 'reservation_follow_ups')
        .select('id, reservation_id, type, content, created_at, created_by')
        .eq('reservation_id', reservationId)
        .order('created_at', { ascending: false })

      if (error) {
        if (!isAbortLikeError(error)) {
          console.error('reservation_follow_ups fetch error:', error)
        }
        setFollowUps([])
        return
      }
      const rows = (data || []) as unknown as ReservationFollowUpRow[]
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
        const { error } = await fromUntypedTable(supabase, 'reservation_follow_ups')
          .update({ content: cancellationReason.trim() || null })
          .eq('id', cancellationReasonId)
        if (error) throw error
      } else {
        const { error } = await fromUntypedTable(supabase, 'reservation_follow_ups').insert({
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
      const { error } = await fromUntypedTable(supabase, 'reservation_follow_ups').insert({
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

  // contact 로그 이메일로 team nick_name 조회 (표시용: nick_name 우선, 없으면 name_ko, 없으면 이메일)
  useEffect(() => {
    const emails = [
      ...new Set(
        followUps.filter((r) => r.type === 'contact').map((l) => l.created_by).filter(Boolean) as string[]
      ),
    ]
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
  }, [followUps])

  // 취소 사유 프리셋 (클릭 시 바로 기록)
  const CANCELLATION_REASON_PRESETS = isEn
    ? [
        'No Show',
        'No response after cancel',
        'Rebooking',
        'Not recruited',
        'Closed out',
        'Weather',
        'Schedule conflict',
        'Duplicate booking',
        'Price / Policy',
        'Other',
      ]
    : ['No Show', '취소 후 무 응답', '재예약', '미모집', '마감', '날씨', '일정 변경', '중복 예약', '가격/정책', '기타']

  const saveCancellationReasonWithValue = async (value: string) => {
    if (!reservationId || !userEmail) return
    const trimmed = value.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      if (cancellationReasonId) {
        const { error } = await fromUntypedTable(supabase, 'reservation_follow_ups')
          .update({ content: trimmed })
          .eq('id', cancellationReasonId)
        if (error) throw error
      } else {
        const { error } = await fromUntypedTable(supabase, 'reservation_follow_ups').insert({
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

  return (
    <div id="follow-up-section" className="space-y-3 max-lg:overflow-y-auto lg:overflow-visible border border-gray-200 rounded-xl p-3 sm:p-4 bg-gray-50/50">
      <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
        <MessageSquare className="w-4 h-4" />
        {title}
      </h3>

      {showFollowUpPipeline ? (
        <div className="rounded-lg border border-teal-100 bg-teal-50/50 px-3 py-2.5 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-gray-800">{tRes('followUpPipeline.rowTitle')}</span>
            {pipelineSnapshotsLoading ? (
              <span className="text-[11px] text-gray-500">{tRes('followUpPipeline.loadingSnapshots')}</span>
            ) : (
              <ReservationFollowUpPipelineIcons
                snapshot={pipelineSnapshot}
                snapshotLoaded={!pipelineSnapshotsLoading && pipelineSnapshots.has(reservationId)}
                disabled={reservationExcludedFromFollowUpPipeline(
                  followUpPipelineReservation?.status ?? status
                )}
                onEmailPreviewClick={(emailType) => {
                  const map = {
                    confirmation: 'confirmation',
                    resident_inquiry: 'resident_inquiry',
                    departure: 'departure',
                    pickup: 'pickup',
                  } as const
                  openPipelineEmailPreview(map[emailType])
                }}
                allowManualCompletion
                onManualStepChange={handlePipelineManualStep}
              />
            )}
          </div>
          <p className="text-[11px] text-gray-600 leading-snug">{tRes('followUpPipeline.pipelineHintManual')}</p>
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-gray-500 py-2">
          {isEn ? 'Loading...' : '불러오는 중...'}
        </div>
      ) : (
        <>
          {isCancelled && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setCancelMessagePreviewOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-medium text-violet-900 hover:bg-violet-100"
              >
                {tRes('card.cancelFollowUpMessagePreviewTitle')}
              </button>
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
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-ring focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={saveCancellationReason}
                  disabled={saving}
                  className="shrink-0 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 text-sm font-medium flex items-center gap-1"
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
                className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
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
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-ring"
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
        </>
      )}

      {cancelMessagePreviewOpen && followUpPipelineReservation ? (
        <CancellationFollowUpMessagePreviewModal
          isOpen
          onClose={() => setCancelMessagePreviewOpen(false)}
          reservationId={reservationId}
          customerEmail={
            followUpPipelineCustomers?.find((c) => c.id === followUpPipelineReservation.customerId)
              ?.email ?? ''
          }
          customerPhone={
            followUpPipelineCustomers?.find((c) => c.id === followUpPipelineReservation.customerId)
              ?.phone ?? null
          }
          customerName={getCustomerName(
            followUpPipelineReservation.customerId,
            followUpPipelineCustomers ?? []
          )}
          customerLanguage={
            followUpPipelineCustomers?.find((c) => c.id === followUpPipelineReservation.customerId)
              ?.language ?? null
          }
          tourDate={followUpPipelineReservation.tourDate ?? null}
          productId={followUpPipelineReservation.productId}
          products={
            (followUpPipelineProducts ?? []) as Array<{
              id: string
              name?: string | null
              name_ko?: string | null
              name_en?: string | null
              customer_name_ko?: string | null
              customer_name_en?: string | null
            }>
          }
          adults={followUpPipelineReservation.adults || 0}
          children={followUpPipelineReservation.child || 0}
          infants={followUpPipelineReservation.infant || 0}
          channelRN={followUpPipelineReservation.channelRN ?? null}
          channelName={
            followUpPipelineReservation.channelNameSnapshot ?? null
          }
        />
      ) : null}

      {pipelineEmailPreview && pipelineEmailPreview.emailType === 'resident_inquiry' ? (
        <ResidentInquiryEmailPreviewModal
          isOpen
          onClose={() => setPipelineEmailPreview(null)}
          reservationId={pipelineEmailPreview.reservationId}
          customerEmail={pipelineEmailPreview.customerEmail}
          customerName={pipelineEmailPreview.customerName || ''}
          customerLanguage={pipelineEmailPreview.customerLanguage}
          tourDate={pipelineEmailPreview.tourDate}
          productName={pipelineEmailPreview.productName || ''}
          channelRN={pipelineEmailPreview.channelRN}
          productCode={pipelineEmailPreview.productCode ?? null}
          productTags={pipelineEmailPreview.productTags ?? null}
          onSend={sendPipelineEmailFromPreview}
        />
      ) : null}

      {pipelineEmailPreview && pipelineEmailPreview.emailType !== 'resident_inquiry' ? (
        <EmailPreviewModal
          isOpen
          onClose={() => setPipelineEmailPreview(null)}
          reservationId={pipelineEmailPreview.reservationId}
          emailType={pipelineEmailPreview.emailType}
          customerEmail={pipelineEmailPreview.customerEmail}
          pickupTime={pipelineEmailPreview.pickupTime ?? null}
          tourDate={pipelineEmailPreview.tourDate ?? null}
          onSend={sendPipelineEmailFromPreview}
        />
      ) : null}
    </div>
  )
}
