'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Ban,
  CalendarRange,
  Check,
  Loader2,
  Mail,
  MessageSquare,
  Route,
} from 'lucide-react'
import { CustomerFollowUpResponseModal } from '@/components/reservation/CustomerFollowUpResponseModal'
import CancellationReasonModal from '@/components/reservation/CancellationReasonModal'
import { PendingCustomerAltTourMessagePreviewModal } from '@/components/reservation/PendingCustomerAltTourMessagePreviewModal'
import { PendingCustomerManagementStepBar } from '@/components/reservation/PendingCustomerManagementStepBar'
import { PendingCustomerResolutionModal } from '@/components/reservation/PendingCustomerResolutionModal'
import { pendingCustomerManagementCardCopy } from '@/lib/pendingCustomerManagementCardCopy'
import type { PendingCustomerResolutionKind } from '@/lib/pendingCustomerManagementWorkflow'
import {
  buildCustomerResponseContactContent,
  uploadCustomerResponseImages,
  type CustomerFollowUpResponseSubmitPayload,
} from '@/lib/customerFollowUpResponseAssets'
import { useAuth } from '@/contexts/AuthContext'
import { upsertReservationCancellationReason } from '@/lib/reservationCancellationReason'
import { supabase } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { getProductInternalName } from '@/utils/reservationUtils'
import { useTranslations } from 'next-intl'

export type PendingCustomerFollowUpStripProps = {
  locale: string
  reservationId: string
  altTourNoticeManual: boolean
  hasCustomerResponse: boolean
  resolutionKind: PendingCustomerResolutionKind | null
  customerEmail?: string
  customerPhone?: string | null
  customerName?: string
  customerLanguage?: string | null
  tourDate?: string | null
  productId: string
  products: Array<{
    id: string
    name?: string | null
    name_ko?: string | null
    name_en?: string | null
    customer_name_ko?: string | null
    customer_name_en?: string | null
  }>
  channelRN?: string | null
  onAltTourNoticeManualChange?: (
    reservationId: string,
    action: 'mark' | 'clear'
  ) => void | Promise<void>
  onResolutionSaved?: (
    reservationId: string,
    kind: PendingCustomerResolutionKind
  ) => void | Promise<void>
  onCustomerResponseSaved?: () => void
  showWorkflowStepBar?: boolean
}

export function PendingCustomerFollowUpStrip({
  locale,
  reservationId,
  altTourNoticeManual,
  hasCustomerResponse: knownHasCustomerResponse,
  resolutionKind,
  customerEmail = '',
  customerPhone = null,
  customerName = '',
  customerLanguage = null,
  tourDate = null,
  productId,
  products,
  channelRN = null,
  onAltTourNoticeManualChange,
  onResolutionSaved,
  onCustomerResponseSaved,
  showWorkflowStepBar = true,
}: PendingCustomerFollowUpStripProps) {
  const tc = useTranslations('reservations.card')
  const copy = pendingCustomerManagementCardCopy(locale)
  const { user } = useAuth()
  const userEmail = user?.email?.trim() || null

  const [hasCustomerResponse, setHasCustomerResponse] = useState(knownHasCustomerResponse)
  const [messagePreviewOpen, setMessagePreviewOpen] = useState(false)
  const [responseOpen, setResponseOpen] = useState(false)
  const [responseDraft, setResponseDraft] = useState('')
  const [responseSaving, setResponseSaving] = useState(false)
  const [toggleSaving, setToggleSaving] = useState(false)
  const [cancelReasonOpen, setCancelReasonOpen] = useState(false)
  const [cancelReasonDraft, setCancelReasonDraft] = useState('')
  const [cancelReasonSaving, setCancelReasonSaving] = useState(false)
  const [resolutionOpen, setResolutionOpen] = useState(false)
  const [resolutionKindDraft, setResolutionKindDraft] = useState<Exclude<PendingCustomerResolutionKind, 'cancel'>>(
    'date_change'
  )

  const productName = getProductInternalName(productId, products)

  const loadCustomerResponse = useCallback(async () => {
    if (!reservationId) return
    const { data, error } = await fromUntypedTable(supabase, 'reservation_follow_ups')
      .select('content')
      .eq('reservation_id', reservationId)
      .eq('type', 'contact')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) {
      console.error('pending customer response fetch:', error)
      return
    }
    const content = String((data as { content?: string | null } | null)?.content ?? '').trim()
    setResponseDraft(content)
    setHasCustomerResponse(Boolean(content))
  }, [reservationId])

  useEffect(() => {
    void loadCustomerResponse()
  }, [loadCustomerResponse])

  useEffect(() => {
    setHasCustomerResponse(knownHasCustomerResponse)
  }, [knownHasCustomerResponse])

  const loadCancellationReason = useCallback(async () => {
    if (!reservationId) return
    const { data, error } = await fromUntypedTable(supabase, 'reservation_follow_ups')
      .select('content')
      .eq('reservation_id', reservationId)
      .eq('type', 'cancellation_reason')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) {
      console.error('pending cancel reason fetch:', error)
      setCancelReasonDraft('')
      return
    }
    setCancelReasonDraft(String((data as { content?: string | null } | null)?.content ?? '').trim())
  }, [reservationId])

  useEffect(() => {
    if (!cancelReasonOpen) return
    void loadCancellationReason()
  }, [cancelReasonOpen, loadCancellationReason])

  const btnClass = (done: boolean) =>
    `inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border text-sm transition-colors disabled:opacity-50 ${
      done
        ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
        : 'border-gray-200 bg-white text-gray-400 hover:border-amber-300 hover:bg-amber-50/60 hover:text-amber-900'
    }`

  const resolutionBtnClass = (kind: PendingCustomerResolutionKind) =>
    `inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border text-sm transition-colors disabled:opacity-50 ${
      resolutionKind === kind
        ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
        : 'border-gray-200 bg-white text-gray-500 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-900'
    }`

  const fireAltTourToggle = async (action: 'mark' | 'clear') => {
    if (!onAltTourNoticeManualChange) return
    setToggleSaving(true)
    try {
      await onAltTourNoticeManualChange(reservationId, action)
    } finally {
      setToggleSaving(false)
    }
  }

  const saveCustomerResponse = async ({
    text,
    images,
    existingImages = [],
  }: CustomerFollowUpResponseSubmitPayload) => {
    if (!userEmail) {
      alert(locale === 'ko' ? '로그인이 필요합니다.' : 'Login required.')
      return
    }
    if (!altTourNoticeManual) {
      alert(copy.resolutionBlockedNoNotice)
      return
    }
    const trimmedText = text.trim()
    if (!trimmedText && images.length === 0 && existingImages.length === 0) return

    setResponseSaving(true)
    try {
      const uploadedImages = await uploadCustomerResponseImages(reservationId, images, locale)
      const content = buildCustomerResponseContactContent(
        trimmedText,
        [...existingImages, ...uploadedImages],
        locale
      )
      const { error } = await fromUntypedTable(supabase, 'reservation_follow_ups').insert({
        reservation_id: reservationId,
        type: 'contact',
        content,
        created_by: userEmail,
      })
      if (error) throw error
      setHasCustomerResponse(true)
      setResponseDraft(content)
      onCustomerResponseSaved?.()
      setResponseOpen(false)
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : copy.customerResponseSaveFailed)
    } finally {
      setResponseSaving(false)
    }
  }

  const openCancelResolution = () => {
    if (!altTourNoticeManual) {
      alert(copy.resolutionBlockedNoNotice)
      return
    }
    if (!hasCustomerResponse) {
      alert(copy.resolutionBlockedNoCustomerResponse)
      return
    }
    setCancelReasonOpen(true)
  }

  const openResolution = (kind: Exclude<PendingCustomerResolutionKind, 'cancel'>) => {
    if (!altTourNoticeManual) {
      alert(copy.resolutionBlockedNoNotice)
      return
    }
    if (!hasCustomerResponse) {
      alert(copy.resolutionBlockedNoCustomerResponse)
      return
    }
    setResolutionKindDraft(kind)
    setResolutionOpen(true)
  }

  const saveCancelReason = async (reason: string) => {
    if (!userEmail) {
      alert(tc('cancellationReasonNeedLogin'))
      return
    }
    const trimmed = reason.trim()
    if (!trimmed) return

    setCancelReasonSaving(true)
    try {
      await upsertReservationCancellationReason(reservationId, trimmed, userEmail)
      await onResolutionSaved?.(reservationId, 'cancel')
      setCancelReasonOpen(false)
    } catch (e) {
      console.error(e)
      alert(tc('cancellationReasonSaveFailed'))
    } finally {
      setCancelReasonSaving(false)
    }
  }

  return (
    <>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {showWorkflowStepBar ? (
          <PendingCustomerManagementStepBar
            locale={locale}
            altTourNoticeManual={altTourNoticeManual}
            hasCustomerResponse={hasCustomerResponse}
            resolutionKind={resolutionKind}
            compact
          />
        ) : null}
        <div className="flex min-w-0 shrink-0 items-center gap-1">
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              title={copy.altTourMessagePreviewTitle}
              aria-label={copy.altTourMessagePreviewTitle}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100"
              onClick={(e) => {
                e.stopPropagation()
                setMessagePreviewOpen(true)
              }}
            >
              <Mail className="h-3 w-3" aria-hidden />
            </button>
            <button
              type="button"
              disabled={toggleSaving || !onAltTourNoticeManualChange}
              title={copy.altTourNoticeTitle}
              aria-label={copy.altTourNoticeTitle}
              className={btnClass(altTourNoticeManual)}
              onClick={(e) => {
                e.stopPropagation()
                void fireAltTourToggle(altTourNoticeManual ? 'clear' : 'mark')
              }}
            >
              {toggleSaving ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              ) : (
                <Check className="h-3 w-3" aria-hidden />
              )}
            </button>
            <button
              type="button"
              title={copy.customerResponseTitle}
              aria-label={copy.customerResponseTitle}
              className={btnClass(hasCustomerResponse)}
              onClick={(e) => {
                e.stopPropagation()
                setResponseOpen(true)
              }}
            >
              <MessageSquare className="h-3 w-3" aria-hidden />
            </button>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button
              type="button"
              disabled={!!resolutionKind}
              title={copy.resolutionCancelTitle}
              aria-label={copy.resolutionCancelTitle}
              className={resolutionBtnClass('cancel')}
              onClick={(e) => {
                e.stopPropagation()
                openCancelResolution()
              }}
            >
              <Ban className="h-3 w-3" aria-hidden />
            </button>
            <button
              type="button"
              disabled={!!resolutionKind}
              title={copy.resolutionDateChangeTitle}
              aria-label={copy.resolutionDateChangeTitle}
              className={resolutionBtnClass('date_change')}
              onClick={(e) => {
                e.stopPropagation()
                openResolution('date_change')
              }}
            >
              <CalendarRange className="h-3 w-3" aria-hidden />
            </button>
            <button
              type="button"
              disabled={!!resolutionKind}
              title={copy.resolutionTourChangeTitle}
              aria-label={copy.resolutionTourChangeTitle}
              className={resolutionBtnClass('tour_change')}
              onClick={(e) => {
                e.stopPropagation()
                openResolution('tour_change')
              }}
            >
              <Route className="h-3 w-3" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      <PendingCustomerAltTourMessagePreviewModal
        isOpen={messagePreviewOpen}
        onClose={() => setMessagePreviewOpen(false)}
        customerEmail={customerEmail}
        customerPhone={customerPhone}
        customerName={customerName}
        customerLanguage={customerLanguage}
        tourDate={tourDate}
        productName={productName}
        channelRN={channelRN}
      />

      <CustomerFollowUpResponseModal
        isOpen={responseOpen}
        onClose={() => setResponseOpen(false)}
        locale={locale}
        initialValue={responseDraft}
        saving={responseSaving}
        onSubmit={saveCustomerResponse}
      />

      <CancellationReasonModal
        isOpen={cancelReasonOpen}
        locale={locale}
        title={tc('cancellationReasonModalTitle')}
        initialValue={cancelReasonDraft}
        saving={cancelReasonSaving}
        onClose={() => setCancelReasonOpen(false)}
        onSubmit={saveCancelReason}
      />

      <PendingCustomerResolutionModal
        isOpen={resolutionOpen}
        kind={resolutionKindDraft}
        locale={locale}
        reservationId={reservationId}
        currentTourDate={tourDate}
        currentProductId={productId}
        products={products}
        userEmail={userEmail}
        onClose={() => setResolutionOpen(false)}
        onSaved={async (kind) => {
          await onResolutionSaved?.(reservationId, kind)
        }}
      />
    </>
  )
}
