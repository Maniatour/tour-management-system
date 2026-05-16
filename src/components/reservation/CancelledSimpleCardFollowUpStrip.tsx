'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { ClipboardList, PhoneForwarded, Globe, X, Loader2, Send, Mail } from 'lucide-react'
import CancellationFollowUpMessagePreviewModal from '@/components/reservation/CancellationFollowUpMessagePreviewModal'
import type { CancellationFollowUpMessageKind } from '@/lib/cancellationFollowUpMessage'
import { useLocale, useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { ReservationFollowUpPipelineSnapshot } from '@/lib/reservationFollowUpPipeline'
import type { CancelFollowUpManualKind } from '@/components/reservation/ReservationFollowUpQueueModal'

export type CancelledSimpleCardFollowUpStripProps = {
  reservationId: string
  snapshot: ReservationFollowUpPipelineSnapshot | null | undefined
  customerEmail?: string
  customerPhone?: string | null
  customerName?: string
  customerLanguage?: string | null
  tourDate?: string | null
  productName?: string
  channelRN?: string | null
  onCancelFollowUpManualChange?: (
    reservationId: string,
    kind: CancelFollowUpManualKind,
    action: 'mark' | 'clear'
  ) => void | Promise<void>
  /** 사유 저장 후 부모가 뱃지 등을 다시 불러오도록 */
  onReasonSaved?: () => void
}

export default function CancelledSimpleCardFollowUpStrip({
  reservationId,
  snapshot,
  customerEmail = '',
  customerPhone = null,
  customerName = '',
  customerLanguage = null,
  tourDate = null,
  productName = '',
  channelRN = null,
  onCancelFollowUpManualChange,
  onReasonSaved,
}: CancelledSimpleCardFollowUpStripProps) {
  const t = useTranslations('reservations.followUpPipeline')
  const tc = useTranslations('reservations.card')
  const locale = useLocale()
  const isEn = locale === 'en'
  const cancellationReasonPresets = useMemo(
    () =>
      isEn
        ? [
            'No Show',
            'Canceled by customer',
            'Rebooking',
            'Not recruited',
            'Weather',
            'Schedule conflict',
            'Duplicate booking',
            'Price / Policy',
            'Other',
          ]
        : ['No Show', '고객 취소', '재예약', '미모집', '날씨', '일정 변경', '중복 예약', '가격/정책', '기타'],
    [isEn]
  )
  const { user } = useAuth()
  const userEmail = user?.email?.trim() || null

  const fu = snapshot?.cancelFollowUpManual ?? false
  const re = snapshot?.cancelRebookingOutreachManual ?? false

  const [reasonOpen, setReasonOpen] = useState(false)
  const [reasonDraft, setReasonDraft] = useState('')
  const [reasonRowId, setReasonRowId] = useState<string | null>(null)
  const [reasonLoading, setReasonLoading] = useState(false)
  const [reasonSaving, setReasonSaving] = useState(false)
  const [toggleSaving, setToggleSaving] = useState(false)
  const [messagePreviewOpen, setMessagePreviewOpen] = useState(false)
  const [messagePreviewKind, setMessagePreviewKind] =
    useState<CancellationFollowUpMessageKind>('follow_up')

  const loadReason = useCallback(async () => {
    if (!reservationId) return
    setReasonLoading(true)
    try {
      const { data, error } = await supabase
        .from('reservation_follow_ups')
        .select('id, content')
        .eq('reservation_id', reservationId)
        .eq('type', 'cancellation_reason')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('cancellation_reason fetch:', error)
        setReasonRowId(null)
        setReasonDraft('')
        return
      }
      const row = data as { id?: string; content?: string | null } | null
      if (row?.id) {
        setReasonRowId(row.id)
        setReasonDraft(String(row.content ?? ''))
      } else {
        setReasonRowId(null)
        setReasonDraft('')
      }
    } finally {
      setReasonLoading(false)
    }
  }, [reservationId])

  useEffect(() => {
    if (!reasonOpen) return
    void loadReason()
  }, [reasonOpen, loadReason])

  const saveReason = async () => {
    if (!userEmail) {
      alert(tc('cancellationReasonNeedLogin'))
      return
    }
    setReasonSaving(true)
    try {
      const trimmed = reasonDraft.trim()
      if (reasonRowId) {
        const { error } = await supabase
          .from('reservation_follow_ups')
          .update({ content: trimmed || null })
          .eq('id', reasonRowId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('reservation_follow_ups').insert({
          reservation_id: reservationId,
          type: 'cancellation_reason',
          content: trimmed || null,
          created_by: userEmail,
        })
        if (error) throw error
      }
      await loadReason()
      onReasonSaved?.()
      setReasonOpen(false)
    } catch (e) {
      console.error(e)
      alert(tc('cancellationReasonSaveFailed'))
    } finally {
      setReasonSaving(false)
    }
  }

  const btnClass = (done: boolean) =>
    `inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border text-sm transition-colors disabled:opacity-50 ${
      done
        ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
        : 'border-gray-200 bg-white text-gray-400 hover:border-amber-300 hover:bg-amber-50/60 hover:text-amber-900'
    }`

  const fireToggle = async (kind: CancelFollowUpManualKind, action: 'mark' | 'clear') => {
    if (!onCancelFollowUpManualChange) return
    setToggleSaving(true)
    try {
      await onCancelFollowUpManualChange(reservationId, kind, action)
    } finally {
      setToggleSaving(false)
    }
  }

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
        <span className="hidden min-[380px]:inline text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {tc('cancelAfterProcessShort')}
        </span>
        <button
          type="button"
          title={tc('cancelFollowUpMessagePreviewTitle')}
          aria-label={tc('cancelFollowUpMessagePreviewTitle')}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100"
          onClick={(e) => {
            e.stopPropagation()
            setMessagePreviewKind('follow_up')
            setMessagePreviewOpen(true)
          }}
        >
          <Mail className="h-3 w-3" aria-hidden />
        </button>
        <button
          type="button"
          disabled={reasonLoading}
          title={tc('cancellationReasonButtonTitle')}
          aria-label={tc('cancellationReasonButtonTitle')}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100 disabled:opacity-50"
          onClick={(e) => {
            e.stopPropagation()
            setReasonOpen(true)
          }}
        >
          {reasonLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ClipboardList className="h-3 w-3" />}
        </button>
        <button
          type="button"
          disabled={toggleSaving || !onCancelFollowUpManualChange}
          title={t('cancelFollowUpIconTitle')}
          aria-label={t('cancelFollowUpIconTitle')}
          aria-pressed={fu}
          className={btnClass(fu)}
          onClick={(e) => {
            e.stopPropagation()
            void fireToggle('cancel_follow_up', fu ? 'clear' : 'mark')
          }}
        >
          <PhoneForwarded className="h-3 w-3" aria-hidden />
        </button>
        <button
          type="button"
          disabled={toggleSaving || !onCancelFollowUpManualChange}
          title={t('cancelRebookingIconTitle')}
          aria-label={t('cancelRebookingIconTitle')}
          aria-pressed={re}
          className={btnClass(re)}
          onClick={(e) => {
            e.stopPropagation()
            void fireToggle('cancel_rebooking', re ? 'clear' : 'mark')
          }}
        >
          <Globe className="h-3 w-3" aria-hidden />
        </button>
      </div>

      <CancellationFollowUpMessagePreviewModal
        isOpen={messagePreviewOpen}
        onClose={() => setMessagePreviewOpen(false)}
        reservationId={reservationId}
        customerEmail={customerEmail}
        customerPhone={customerPhone}
        customerName={customerName}
        customerLanguage={customerLanguage}
        tourDate={tourDate}
        productName={productName}
        channelRN={channelRN}
        initialMessageKind={messagePreviewKind}
      />

      {reasonOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setReasonOpen(false)
            }}
          >
            <div
              className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-gray-900">{tc('cancellationReasonModalTitle')}</h3>
                <button
                  type="button"
                  className="rounded p-1 text-gray-500 hover:bg-gray-100"
                  aria-label={t('close')}
                  onClick={() => setReasonOpen(false)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  {isEn ? 'Cancellation reason' : '취소 사유'}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {cancellationReasonPresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setReasonDraft(preset)}
                      disabled={reasonSaving}
                      className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <textarea
                    value={reasonDraft}
                    onChange={(e) => setReasonDraft(e.target.value)}
                    rows={2}
                    placeholder={tc('cancellationReasonPlaceholderOptional')}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    disabled={reasonSaving || !reasonDraft.trim()}
                    className="flex shrink-0 items-center gap-1 self-stretch rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    onClick={() => void saveReason()}
                  >
                    {reasonSaving ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 shrink-0" />
                    )}
                    {tc('cancellationReasonSave')}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
