'use client'

import { useState, useEffect, useCallback } from 'react'
import { MessageSquare, PhoneForwarded, Globe, Loader2, Mail } from 'lucide-react'
import CancellationFollowUpMessagePreviewModal from '@/components/reservation/CancellationFollowUpMessagePreviewModal'
import CancellationReasonModal from '@/components/reservation/CancellationReasonModal'
import type { CancellationFollowUpMessageKind } from '@/lib/cancellationFollowUpMessage'
import { useLocale, useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
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
  productId: string
  products: Array<{ id: string; name?: string | null; name_ko?: string | null; name_en?: string | null; customer_name_ko?: string | null; customer_name_en?: string | null }>
  adults?: number
  children?: number
  infants?: number
  channelRN?: string | null
  channelName?: string | null
  onCancelFollowUpManualChange?: (
    reservationId: string,
    kind: CancelFollowUpManualKind,
    action: 'mark' | 'clear'
  ) => void | Promise<void>
  /** 사유 저장 후 부모가 뱃지 등을 다시 불러오도록 */
  onReasonSaved?: () => void
  /** 부모가 이미 알고 있는 취소 사유(있으면 버튼 강조 생략) */
  knownCancellationReason?: string | null
}

export default function CancelledSimpleCardFollowUpStrip({
  reservationId,
  snapshot,
  customerEmail = '',
  customerPhone = null,
  customerName = '',
  customerLanguage = null,
  tourDate = null,
  productId,
  products,
  adults = 0,
  children = 0,
  infants = 0,
  channelRN = null,
  channelName = null,
  onCancelFollowUpManualChange,
  onReasonSaved,
  knownCancellationReason,
}: CancelledSimpleCardFollowUpStripProps) {
  const t = useTranslations('reservations.followUpPipeline')
  const tc = useTranslations('reservations.card')
  const locale = useLocale()
  const { user } = useAuth()
  const userEmail = user?.email?.trim() || null

  const fu = snapshot?.cancelFollowUpManual ?? false
  const re = snapshot?.cancelRebookingOutreachManual ?? false

  const [reasonOpen, setReasonOpen] = useState(false)
  const [reasonDraft, setReasonDraft] = useState('')
  const [reasonRowId, setReasonRowId] = useState<string | null>(null)
  const [reasonLoading, setReasonLoading] = useState(false)
  const [reasonSaving, setReasonSaving] = useState(false)
  const [reasonLoaded, setReasonLoaded] = useState(false)
  const [toggleSaving, setToggleSaving] = useState(false)
  const [messagePreviewOpen, setMessagePreviewOpen] = useState(false)
  const [messagePreviewKind, setMessagePreviewKind] =
    useState<CancellationFollowUpMessageKind>('follow_up')

  const loadReason = useCallback(async () => {
    if (!reservationId) return
    setReasonLoading(true)
    try {
      const { data, error } = await fromUntypedTable(supabase, 'reservation_follow_ups')
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
        setReasonLoaded(true)
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
      setReasonLoaded(true)
    } finally {
      setReasonLoading(false)
    }
  }, [reservationId])

  useEffect(() => {
    void loadReason()
  }, [loadReason])

  useEffect(() => {
    if (!reasonOpen) return
    void loadReason()
  }, [reasonOpen, loadReason])

  const saveReason = async (reason: string) => {
    if (!userEmail) {
      alert(tc('cancellationReasonNeedLogin'))
      return
    }
    setReasonSaving(true)
    try {
      const trimmed = reason.trim()
      if (reasonRowId) {
        const { error } = await fromUntypedTable(supabase, 'reservation_follow_ups')
          .update({ content: trimmed || null })
          .eq('id', reasonRowId)
        if (error) throw error
      } else {
        const { error } = await fromUntypedTable(supabase, 'reservation_follow_ups').insert({
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

  const hasCancellationReason =
    Boolean(String(knownCancellationReason ?? '').trim()) ||
    Boolean(reasonLoaded && reasonDraft.trim())

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
          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border transition-colors disabled:opacity-50 ${
            hasCancellationReason
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              : 'border-amber-300 bg-amber-50 text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100'
          }`}
          onClick={(e) => {
            e.stopPropagation()
            setReasonOpen(true)
          }}
        >
          {reasonLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3 w-3" />}
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
        productId={productId}
        products={products}
        adults={adults}
        children={children}
        infants={infants}
        channelRN={channelRN}
        channelName={channelName}
        initialMessageKind={messagePreviewKind}
      />

      <CancellationReasonModal
        isOpen={reasonOpen}
        locale={locale}
        title={tc('cancellationReasonModalTitle')}
        initialValue={reasonDraft}
        saving={reasonSaving}
        onClose={() => setReasonOpen(false)}
        onSubmit={saveReason}
      />
    </>
  )
}
