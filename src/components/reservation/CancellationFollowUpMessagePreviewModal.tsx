'use client'

import { useMemo, useState, useCallback, useEffect } from 'react'
import { X, Eye, Loader2, Copy, Check, Pencil, Mail, MessageSquare } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import {
  extractCancellationFollowUpEmailBodyFromDocument,
  getBuiltinCancellationFollowUpTemplate,
  mergeCancellationFollowUpEmailDocumentFromBody,
  substituteCancellationFollowUpMessageTemplate,
  type CancellationFollowUpMessageChannel,
  type CancellationFollowUpMessageKind,
  type CancellationFollowUpMessageLocale,
} from '@/lib/cancellationFollowUpMessage'
import { defaultStaffOutreachTemplateName } from '@/lib/staffOutreachMessageTemplates'
import {
  buildCustomerRebookingUrlFromReservation,
  formatRebookingCouponValidUntil,
  formatTourDateLongForCancellationMessage,
  REBOOKING_OUTREACH_COUPON_CODE,
  type ReservationChoiceRowForRebooking,
} from '@/lib/customerRebookingUrl'
import {
  formatRebookingPriceComparisonHtml,
  formatRebookingPriceComparisonPlain,
  type RebookingPriceComparisonResult,
} from '@/lib/rebookingPriceComparison'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import { resolveReservationEmailIsEnglish } from '@/lib/reservationEmailLocale'
import { getProductNameForLocale } from '@/utils/reservationUtils'
import { supabase } from '@/lib/supabase'
import EmailPreviewBodyPanel from '@/components/reservation/EmailPreviewBodyPanel'
import StaffOutreachMessageTemplatePanel from '@/components/reservation/StaffOutreachMessageTemplatePanel'
import { useStaffOutreachMessageTemplates } from '@/hooks/useStaffOutreachMessageTemplates'

export interface CancellationFollowUpMessagePreviewModalProps {
  isOpen: boolean
  onClose: () => void
  reservationId: string
  customerEmail: string
  customerPhone?: string | null
  customerName: string
  customerLanguage: string | null | undefined
  tourDate: string | null | undefined
  productId: string
  products: Array<{ id: string; name?: string | null; name_ko?: string | null; name_en?: string | null; customer_name_ko?: string | null; customer_name_en?: string | null }>
  adults?: number
  children?: number
  infants?: number
  channelRN: string | null | undefined
  channelName?: string | null
  initialMessageKind?: CancellationFollowUpMessageKind
}

export default function CancellationFollowUpMessagePreviewModal({
  isOpen,
  onClose,
  reservationId,
  customerEmail,
  customerPhone,
  customerName,
  customerLanguage,
  tourDate,
  productId,
  products,
  adults = 0,
  children = 0,
  infants = 0,
  channelRN,
  channelName = null,
  initialMessageKind = 'follow_up',
}: CancellationFollowUpMessagePreviewModalProps) {
  const t = useTranslations('reservations.card')
  const uiLocale = useLocale()
  const [copied, setCopied] = useState(false)

  const emailLocale: CancellationFollowUpMessageLocale = resolveReservationEmailIsEnglish(
    customerLanguage,
    null
  )
    ? 'en'
    : 'ko'

  const productName = useMemo(
    () => getProductNameForLocale(productId, products, emailLocale),
    [productId, products, emailLocale]
  )

  const [channel, setChannel] = useState<CancellationFollowUpMessageChannel>('email')
  const [messageKind, setMessageKind] = useState<CancellationFollowUpMessageKind>(initialMessageKind)
  const [editMode, setEditMode] = useState(false)

  useEffect(() => {
    if (isOpen) setMessageKind(initialMessageKind)
  }, [isOpen, initialMessageKind])

  const getBuiltin = useCallback(() => {
    const b = getBuiltinCancellationFollowUpTemplate(emailLocale, channel, messageKind)
    return {
      name: defaultStaffOutreachTemplateName(emailLocale),
      subject: b.subject,
      body: b.body,
    }
  }, [emailLocale, channel, messageKind])

  const prepareBodyForEditor = useCallback(
    (stored: string) =>
      channel === 'email'
        ? extractCancellationFollowUpEmailBodyFromDocument(stored, emailLocale, messageKind)
        : stored,
    [channel, emailLocale, messageKind]
  )

  const prepareBodyForSave = useCallback(
    (editor: string) =>
      channel === 'email'
        ? mergeCancellationFollowUpEmailDocumentFromBody(emailLocale, editor)
        : editor,
    [channel, emailLocale]
  )

  const templateManager = useStaffOutreachMessageTemplates({
    scope: 'cancellation_follow_up',
    locale: emailLocale,
    channel,
    variant: messageKind,
    isOpen,
    showSubject: channel === 'email',
    getBuiltin,
    prepareBodyForEditor,
    prepareBodyForSave,
    loadFailedMessage: t('cancelFollowUpTemplateLoadFailed'),
    saveFailedMessage: t('cancelFollowUpTemplateSaveFailed'),
    deleteFailedMessage: t('cancelFollowUpTemplateResetFailed'),
    savedMessage: t('cancelFollowUpTemplateSaved'),
    deletedMessage: t('staffOutreachTemplateDeleted'),
    addedMessage: t('staffOutreachTemplateAdded'),
  })

  const { subjectTpl, bodyTpl, loading: templateLoading, savedInDb } = templateManager

  useEffect(() => {
    if (!isOpen) {
      setEditMode(false)
    }
  }, [isOpen])
  const [choiceRows, setChoiceRows] = useState<ReservationChoiceRowForRebooking[]>([])
  const [couponValidUntilIso, setCouponValidUntilIso] = useState<string | null>(null)
  const [priceComparison, setPriceComparison] = useState<RebookingPriceComparisonResult | null>(null)

  useEffect(() => {
    if (!isOpen || !reservationId) {
      setChoiceRows([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const response = await fetchApiWithAuth(
          `/api/reservations/${encodeURIComponent(reservationId)}/choices`,
          { cache: 'no-store' }
        )
        if (!response.ok || cancelled) return
        const body = (await response.json()) as { choices?: ReservationChoiceRowForRebooking[] }
        if (!cancelled) setChoiceRows(body.choices ?? [])
      } catch {
        if (!cancelled) setChoiceRows([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOpen, reservationId])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await supabase
          .from('coupons')
          .select('end_date, discount_type, percentage_value')
          .ilike('coupon_code', REBOOKING_OUTREACH_COUPON_CODE)
          .eq('status', 'active')
          .order('end_date', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (!cancelled) {
          const row = data as {
            end_date?: string | null
            discount_type?: string | null
            percentage_value?: number | null
          } | null
          setCouponValidUntilIso(row?.end_date ?? null)
        }
      } catch {
        if (!cancelled) {
          setCouponValidUntilIso(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || messageKind !== 'rebooking' || !reservationId) {
      setPriceComparison(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const qs = new URLSearchParams({
          reservation_id: reservationId,
          coupon_code: REBOOKING_OUTREACH_COUPON_CODE,
        })
        if (channelName?.trim()) qs.set('channel_name', channelName.trim())
        const response = await fetchApiWithAuth(
          `/api/rebooking/price-comparison?${qs.toString()}`,
          { cache: 'no-store' }
        )
        if (!response.ok || cancelled) {
          if (!cancelled) setPriceComparison(null)
          return
        }
        const body = (await response.json()) as {
          comparison?: RebookingPriceComparisonResult | null
        }
        if (cancelled) return
        const comparison = body.comparison ?? null
        setPriceComparison(comparison)
      } catch {
        if (!cancelled) setPriceComparison(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOpen, messageKind, reservationId, channelName])

  const mergedEmailHtmlTpl = useMemo(() => {
    if (channel !== 'email') return bodyTpl
    return mergeCancellationFollowUpEmailDocumentFromBody(emailLocale, bodyTpl)
  }, [channel, emailLocale, bodyTpl])

  const bodyForSubstitute = channel === 'email' ? mergedEmailHtmlTpl : bodyTpl

  const rebookingUrl = useMemo(
    () =>
      buildCustomerRebookingUrlFromReservation({
        locale: emailLocale,
        reservationId,
        productId,
        tourDate: tourDate ?? null,
        adults,
        children,
        infants,
        choiceRows,
        couponCode: REBOOKING_OUTREACH_COUPON_CODE,
        couponValidUntilIso,
      }),
    [
      emailLocale,
      reservationId,
      productId,
      tourDate,
      adults,
      children,
      infants,
      choiceRows,
      couponValidUntilIso,
    ]
  )

  const couponValidUntilLabel = useMemo(
    () => formatRebookingCouponValidUntil(emailLocale, couponValidUntilIso),
    [emailLocale, couponValidUntilIso]
  )

  const tourDateLong = useMemo(
    () => formatTourDateLongForCancellationMessage(tourDate, emailLocale),
    [tourDate, emailLocale]
  )

  const priceComparisonHtml = useMemo(() => {
    if (!priceComparison) return ''
    return formatRebookingPriceComparisonHtml(emailLocale, priceComparison, REBOOKING_OUTREACH_COUPON_CODE)
  }, [priceComparison, emailLocale])

  const priceComparisonPlain = useMemo(() => {
    if (!priceComparison) return ''
    return formatRebookingPriceComparisonPlain(emailLocale, priceComparison, REBOOKING_OUTREACH_COUPON_CODE)
  }, [priceComparison, emailLocale])

  const messageContent = useMemo(() => {
    return substituteCancellationFollowUpMessageTemplate(subjectTpl, bodyForSubstitute, channel, {
      customerName,
      tourDate,
      productName,
      channelReference: channelRN ?? null,
      locale: emailLocale,
      tourDateLong,
      rebookingUrl,
      couponCode: REBOOKING_OUTREACH_COUPON_CODE,
      couponValidUntil: couponValidUntilLabel,
      priceComparisonHtml,
      priceComparisonPlain,
    })
  }, [
    subjectTpl,
    bodyForSubstitute,
    channel,
    customerName,
    tourDate,
    productName,
    channelRN,
    emailLocale,
    tourDateLong,
    rebookingUrl,
    couponValidUntilLabel,
    priceComparisonHtml,
    priceComparisonPlain,
  ])

  const handleCopy = useCallback(async () => {
    try {
      if (channel === 'email') {
        const html = messageContent.body
        const htmlBlob = new Blob([html], { type: 'text/html' })
        const textBlob = new Blob([messageContent.plainText], { type: 'text/plain' })
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': htmlBlob,
            'text/plain': textBlob,
          }),
        ])
      } else {
        await navigator.clipboard.writeText(messageContent.plainText)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      try {
        await navigator.clipboard.writeText(
          channel === 'email' ? messageContent.plainText : messageContent.body
        )
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        alert(uiLocale === 'en' ? 'Failed to copy.' : '복사에 실패했습니다.')
      }
    }
  }, [channel, messageContent, uiLocale])

  if (!isOpen) return null

  const previewBlocked = templateLoading || !bodyTpl.trim()
  const phoneDisplay = customerPhone?.trim() || (uiLocale === 'en' ? '—' : '—')

  return (
    <div
      className="fixed inset-0 z-[145] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 shrink-0 text-violet-600" />
            <h2 className="text-lg font-bold text-gray-900">{t('cancelFollowUpPreviewTitle')}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label={t('close')}
          >
            <X size={22} />
          </button>
        </div>

        <div className="border-b border-gray-100 bg-slate-50 px-4 py-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() => setMessageKind('follow_up')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  messageKind === 'follow_up'
                    ? 'bg-violet-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {t('cancelFollowUpKindFollowUp')}
              </button>
              <button
                type="button"
                onClick={() => setMessageKind('rebooking')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  messageKind === 'rebooking'
                    ? 'bg-violet-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {t('cancelFollowUpKindRebooking')}
              </button>
            </div>
            <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() => setChannel('email')}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  channel === 'email'
                    ? 'bg-violet-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Mail className="h-3 w-3" />
                {t('cancelFollowUpChannelEmail')}
              </button>
              <button
                type="button"
                onClick={() => setChannel('sms')}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  channel === 'sms'
                    ? 'bg-violet-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <MessageSquare className="h-3 w-3" />
                {t('cancelFollowUpChannelSms')}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2">
          <button
            type="button"
            onClick={() => void handleCopy()}
            disabled={previewBlocked}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied
              ? t('cancelFollowUpCopied')
              : channel === 'email'
                ? t('cancelFollowUpCopyEmail')
                : t('cancelFollowUpCopySms')}
          </button>
          <button
            type="button"
            onClick={() => setEditMode((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
          >
            <Pencil className="h-3.5 w-3.5" />
            {editMode ? t('cancelFollowUpDoneEditing') : t('cancelFollowUpEditTemplate')}
          </button>
          <span
            className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              savedInDb ? 'bg-violet-100 text-violet-800' : 'bg-gray-200 text-gray-700'
            }`}
          >
            {savedInDb ? t('cancelFollowUpSavedTemplateBadge') : t('cancelFollowUpBuiltinTemplateBadge')}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <StaffOutreachMessageTemplatePanel
            channel={channel}
            uiLocale={uiLocale}
            editMode={editMode}
            showSubject={channel === 'email'}
            placeholderHint={t('cancelFollowUpPlaceholderHint')}
            {...(channel === 'email' ? { shellNote: t('cancelFollowUpTemplateShellNote') } : {})}
            accentClass="violet"
            templateManager={templateManager}
          />

          <div className="mb-4 space-y-1 rounded-lg border border-violet-100 bg-violet-50/80 p-3 text-sm text-gray-800">
            {channel === 'email' && (
              <div>
                <span className="font-semibold text-gray-600">{t('cancelFollowUpToEmail')}:</span>{' '}
                <span className="break-all">{customerEmail || (uiLocale === 'en' ? '—' : '—')}</span>
              </div>
            )}
            {channel === 'sms' && (
              <div>
                <span className="font-semibold text-gray-600">{t('cancelFollowUpToPhone')}:</span>{' '}
                <span className="break-all">{phoneDisplay}</span>
              </div>
            )}
            {channel === 'email' && (
              <div>
                <span className="font-semibold text-gray-600">{t('cancelFollowUpSubject')}:</span>{' '}
                {previewBlocked ? '…' : messageContent.subject}
              </div>
            )}
            <div className="text-xs text-gray-500">
              {t('cancelFollowUpReservationId')}: {reservationId}
            </div>
          </div>

          {previewBlocked ? (
            <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-gray-200 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
            </div>
          ) : channel === 'email' ? (
            <EmailPreviewBodyPanel
              html={messageContent.body}
              title={t('cancelFollowUpPreviewBody')}
              htmlTabLabel="HTML 미리보기"
              textTabLabel="텍스트 보기"
              bodyClassName="email-preview-body-host p-3"
            />
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="mb-2 text-xs font-medium text-gray-600">{t('cancelFollowUpPreviewBody')}</p>
              <pre className="whitespace-pre-wrap break-words text-sm text-gray-900 font-sans">
                {messageContent.plainText}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
