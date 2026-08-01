'use client'

import { useMemo, useState, useCallback, useEffect } from 'react'
import { X, Eye, Loader2, Send, Copy, Check, Pencil } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import {
  extractResidentInquiryEmailBodyFromDocument,
  getBuiltinResidentInquiryEmailTemplate,
  mergeResidentInquiryEmailDocumentFromBody,
  substituteResidentInquiryEmailTemplate,
  type ResidentInquiryEmailLocale,
} from '@/lib/residentInquiryEmailHtml'
import { resolveReservationEmailIsEnglish } from '@/lib/reservationEmailLocale'
import {
  residentInquiryEmailTourKindFromProduct,
  type ResidentInquiryEmailTourKind,
} from '@/lib/residentInquiryTourKind'
import { defaultStaffOutreachTemplateName } from '@/lib/staffOutreachMessageTemplates'
import EmailPreviewBodyPanel from '@/components/reservation/EmailPreviewBodyPanel'
import StaffOutreachMessageTemplatePanel from '@/components/reservation/StaffOutreachMessageTemplatePanel'
import { useStaffOutreachMessageTemplates } from '@/hooks/useStaffOutreachMessageTemplates'
import { useReservationFormChildOverlayZIndex } from '@/components/reservation/ReservationFormModalStackContext'

export interface ResidentInquiryEmailPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  reservationId: string
  customerEmail: string
  customerName: string
  customerLanguage: string | null | undefined
  tourDate: string | null | undefined
  productName: string
  channelRN: string | null | undefined
  /** 상품 코드·태그로 당일/멀티데이 템플릿 자동 선택 */
  productCode?: string | null
  productTags?: string[] | null
  onSend: () => Promise<void>
}

export default function ResidentInquiryEmailPreviewModal({
  isOpen,
  onClose,
  reservationId,
  customerEmail,
  customerName,
  customerLanguage,
  tourDate,
  productName,
  channelRN,
  productCode,
  productTags,
  onSend,
}: ResidentInquiryEmailPreviewModalProps) {
  const t = useTranslations('reservations.card')
  const tRes = useTranslations('reservations')
  const uiLocale = useLocale()
  const overlayZIndex = useReservationFormChildOverlayZIndex(120)
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  const emailLocale: ResidentInquiryEmailLocale = resolveReservationEmailIsEnglish(
    customerLanguage,
    null
  )
    ? 'en'
    : 'ko'

  const reservationTourKind: ResidentInquiryEmailTourKind = useMemo(
    () => residentInquiryEmailTourKindFromProduct(productCode, productTags),
    [productCode, productTags]
  )

  const [editorTourKind, setEditorTourKind] = useState<ResidentInquiryEmailTourKind>(reservationTourKind)

  useEffect(() => {
    if (isOpen) setEditorTourKind(reservationTourKind)
  }, [isOpen, reservationTourKind])

  const getBuiltin = useCallback(() => {
    const b = getBuiltinResidentInquiryEmailTemplate(emailLocale, editorTourKind)
    return {
      name: defaultStaffOutreachTemplateName(emailLocale),
      subject: b.subject,
      body: b.html,
    }
  }, [emailLocale, editorTourKind])

  const prepareBodyForEditor = useCallback(
    (stored: string) =>
      extractResidentInquiryEmailBodyFromDocument(stored, emailLocale, editorTourKind),
    [emailLocale, editorTourKind]
  )

  const prepareBodyForSave = useCallback(
    (editor: string) => mergeResidentInquiryEmailDocumentFromBody(emailLocale, editor),
    [emailLocale]
  )

  const templateManager = useStaffOutreachMessageTemplates({
    scope: 'resident_inquiry',
    locale: emailLocale,
    channel: 'email',
    variant: editorTourKind,
    isOpen,
    showSubject: true,
    getBuiltin,
    prepareBodyForEditor,
    prepareBodyForSave,
    loadFailedMessage: t('residentInquiryTemplateLoadFailed'),
    saveFailedMessage: t('residentInquiryTemplateSaveFailed'),
    deleteFailedMessage: t('residentInquiryTemplateResetFailed'),
    savedMessage: t('residentInquiryTemplateSaved'),
    deletedMessage: t('staffOutreachTemplateDeleted'),
    addedMessage: t('staffOutreachTemplateAdded'),
  })

  const { subjectTpl, bodyTpl: bodyHtml, loading: templateLoading, savedInDb } = templateManager

  const [editMode, setEditMode] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setEditMode(false)
      setCopied(false)
      setCopiedLink(false)
    }
  }, [isOpen])
  /** HTML 복사·수동 발송용 — 미리보기 열릴 때 예약별 개인 링크 생성 */
  const [guestLinkUrl, setGuestLinkUrl] = useState<string | null>(null)
  const [guestLinkLoading, setGuestLinkLoading] = useState(false)
  const [guestLinkError, setGuestLinkError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setGuestLinkUrl(null)
      setGuestLinkError(null)
      setGuestLinkLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setGuestLinkLoading(true)
      setGuestLinkError(null)
      try {
        const res = await fetch('/api/resident-check/mint-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reservationId, locale: emailLocale }),
        })
        const data = (await res.json()) as { absoluteUrl?: string; error?: string }
        if (cancelled) return
        if (!res.ok || !data.absoluteUrl?.trim()) {
          setGuestLinkUrl(null)
          setGuestLinkError(data.error || t('residentInquiryGuestLinkFailed'))
          return
        }
        setGuestLinkUrl(data.absoluteUrl.trim())
      } catch {
        if (!cancelled) {
          setGuestLinkUrl(null)
          setGuestLinkError(t('residentInquiryGuestLinkFailed'))
        }
      } finally {
        if (!cancelled) setGuestLinkLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOpen, reservationId, emailLocale, t])

  const mergedHtmlTpl = useMemo(
    () => mergeResidentInquiryEmailDocumentFromBody(emailLocale, bodyHtml),
    [emailLocale, bodyHtml]
  )

  const emailContent = useMemo(() => {
    return substituteResidentInquiryEmailTemplate(subjectTpl, mergedHtmlTpl, {
      customerName,
      tourDate,
      productName,
      channelReference: channelRN ?? null,
      residentCheckAbsoluteUrl: guestLinkUrl || '',
      locale: emailLocale,
      flowLinkPreview: !guestLinkUrl,
    })
  }, [
    customerName,
    tourDate,
    productName,
    channelRN,
    emailLocale,
    subjectTpl,
    mergedHtmlTpl,
    guestLinkUrl,
  ])

  const handleCopyHtml = useCallback(async () => {
    if (!guestLinkUrl) {
      alert(guestLinkError || t('residentInquiryGuestLinkRequired'))
      return
    }
    const cleanHtml = emailContent.html
    try {
      const htmlBlob = new Blob([cleanHtml], { type: 'text/html' })
      const textBlob = new Blob([cleanHtml], { type: 'text/plain' })
      const clipboardItem = new ClipboardItem({
        'text/html': htmlBlob,
        'text/plain': textBlob,
      })
      await navigator.clipboard.write([clipboardItem])
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      try {
        await navigator.clipboard.writeText(cleanHtml)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        alert(uiLocale === 'en' ? 'Failed to copy.' : '복사에 실패했습니다.')
      }
    }
  }, [emailContent.html, uiLocale, guestLinkUrl, guestLinkError, t])

  const handleCopyGuestLink = useCallback(async () => {
    if (!guestLinkUrl) {
      alert(guestLinkError || t('residentInquiryGuestLinkRequired'))
      return
    }
    try {
      await navigator.clipboard.writeText(guestLinkUrl)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    } catch {
      alert(uiLocale === 'en' ? 'Failed to copy link.' : '링크 복사에 실패했습니다.')
    }
  }, [guestLinkUrl, guestLinkError, t, uiLocale])

  const handleSend = async () => {
    setSending(true)
    try {
      await onSend()
      onClose()
    } catch (e) {
      console.error(e)
    } finally {
      setSending(false)
    }
  }

  if (!isOpen) return null

  const previewBlocked = templateLoading || guestLinkLoading || !subjectTpl.trim()
  const copyBlocked = previewBlocked || !guestLinkUrl
  const canSendEmail = !!customerEmail.trim()

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 p-4"
      style={{ zIndex: overlayZIndex }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 shrink-0 text-teal-600" />
            <h2 className="text-lg font-bold text-gray-900">{t('residentInquiryPreviewTitle')}</h2>
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() => setEditorTourKind('day_tour')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  editorTourKind === 'day_tour'
                    ? 'bg-teal-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {t('residentInquiryTemplateTabDayTour')}
              </button>
              <button
                type="button"
                onClick={() => setEditorTourKind('multi_day')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  editorTourKind === 'multi_day'
                    ? 'bg-teal-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {t('residentInquiryTemplateTabMultiDay')}
              </button>
            </div>
            <p className="text-[11px] leading-snug text-gray-600 sm:max-w-[55%] sm:text-right">
              {reservationTourKind === 'multi_day'
                ? t('residentInquiryBookingUsesMulti')
                : t('residentInquiryBookingUsesDay')}
              {editorTourKind !== reservationTourKind ? (
                <span className="mt-1 block text-amber-900 sm:mt-0 sm:ml-2 sm:inline">
                  {t('residentInquiryTabNotBookingKind')}
                </span>
              ) : null}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2">
          <button
            type="button"
            onClick={() => void handleCopyHtml()}
            disabled={copyBlocked}
            title={!guestLinkUrl ? t('residentInquiryGuestLinkRequired') : undefined}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? t('residentInquiryCopied') : t('residentInquiryCopyHtml')}
          </button>
          <button
            type="button"
            onClick={() => void handleCopyGuestLink()}
            disabled={copyBlocked}
            title={!guestLinkUrl ? t('residentInquiryGuestLinkRequired') : undefined}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            {copiedLink ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedLink ? t('residentInquiryCopied') : t('residentInquiryCopyGuestLink')}
          </button>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending || previewBlocked || !canSendEmail}
            title={
              !canSendEmail ? tRes('messages.emailSendRequiresCustomerEmail') : undefined
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {sending ? t('residentInquirySending') : t('residentInquirySend')}
          </button>
          <button
            type="button"
            onClick={() => setEditMode((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
          >
            <Pencil className="h-3.5 w-3.5" />
            {editMode ? t('residentInquiryDoneEditing') : t('residentInquiryEditTemplate')}
          </button>
          <span
            className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              savedInDb ? 'bg-teal-100 text-teal-800' : 'bg-gray-200 text-gray-700'
            }`}
          >
            {savedInDb ? t('residentInquirySavedTemplateBadge') : t('residentInquiryBuiltinTemplateBadge')}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!canSendEmail ? (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              {tRes('messages.noCustomerEmail')}
            </div>
          ) : null}
          {guestLinkError && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
              {guestLinkError}
            </div>
          )}
          {guestLinkUrl && (
            <div className="mb-3 rounded-lg border border-teal-200 bg-teal-50/80 px-3 py-2 text-sm text-teal-950">
              <p className="font-medium">{t('residentInquiryGuestLinkReady')}</p>
              <p className="mt-1 break-all text-xs text-teal-900/90">{guestLinkUrl}</p>
              <p className="mt-1 text-xs text-teal-800/80">{t('residentInquiryGuestLinkCopyHint')}</p>
            </div>
          )}

          <StaffOutreachMessageTemplatePanel
            channel="email"
            uiLocale={uiLocale}
            editMode={editMode}
            showSubject
            placeholderHint={t('residentInquiryPlaceholderHint')}
            shellNote={t('residentInquiryTemplateShellNote')}
            accentClass="teal"
            templateManager={templateManager}
          />

          <div className="mb-4 space-y-1 rounded-lg border border-teal-100 bg-teal-50/80 p-3 text-sm text-gray-800">
            <div>
              <span className="font-semibold text-gray-600">{t('residentInquiryTo')}:</span>{' '}
              <span className="break-all">{customerEmail}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-600">{t('residentInquirySubject')}:</span>{' '}
              {previewBlocked ? '…' : emailContent.subject}
            </div>
            <div className="text-xs text-gray-500">
              {t('residentInquiryReservationId')}: {reservationId}
            </div>
          </div>

          {previewBlocked ? (
            <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-gray-200 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
            </div>
          ) : (
            <EmailPreviewBodyPanel
              html={emailContent.html}
              title={t('residentInquiryPreviewBody')}
              htmlTabLabel="HTML 미리보기"
              textTabLabel="텍스트 보기"
              bodyClassName="email-preview-body-host p-3"
            />
          )}
        </div>
      </div>
    </div>
  )
}
