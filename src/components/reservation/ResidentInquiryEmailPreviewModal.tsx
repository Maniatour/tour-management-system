'use client'

import React, { useMemo, useState, useCallback, useEffect } from 'react'
import { X, Eye, Loader2, Send, Copy, Check, Pencil, RotateCcw } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import {
  builtinResidentInquiryBodyHtml,
  extractResidentInquiryEmailBodyFromDocument,
  getBuiltinResidentInquiryEmailTemplate,
  mergeResidentInquiryEmailDocumentFromBody,
  substituteResidentInquiryEmailTemplate,
  type ResidentInquiryEmailLocale,
} from '@/lib/residentInquiryEmailHtml'
import { resolveReservationEmailIsEnglish } from '@/lib/reservationEmailLocale'
import {
  residentInquiryEmailTourKindFromProduct,
  residentInquiryEmailTourKindToApiParam,
  type ResidentInquiryEmailTourKind,
} from '@/lib/residentInquiryTourKind'
import { supabase } from '@/lib/supabase'
import ResidentInquiryEmailBodyRichEditor from '@/components/reservation/ResidentInquiryEmailBodyRichEditor'
import EmailPreviewBodyPanel from '@/components/reservation/EmailPreviewBodyPanel'

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
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)

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

  const [subjectTpl, setSubjectTpl] = useState('')
  /** 카드 안쪽 본문 HTML(리치 텍스트). 저장 시 셸과 합쳐 전체 문서로 보냄 */
  const [bodyHtml, setBodyHtml] = useState('')
  const [templateEditorNonce, setTemplateEditorNonce] = useState(0)
  const [templateLoading, setTemplateLoading] = useState(false)
  const [savedInDb, setSavedInDb] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [resettingTemplate, setResettingTemplate] = useState(false)
  const [templateNotice, setTemplateNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setEditMode(false)
      setTemplateNotice(null)
      return
    }
    let cancelled = false
    ;(async () => {
      setTemplateLoading(true)
      setTemplateNotice(null)
      try {
        const tk = residentInquiryEmailTourKindToApiParam(editorTourKind)
        const res = await fetch(`/api/resident-inquiry-email-template?locale=${emailLocale}&tour_kind=${tk}`)
        const data = (await res.json()) as {
          subject_template?: string
          html_template?: string
          saved_in_db?: boolean
        }
        if (cancelled) return
        if (!res.ok || !data.subject_template?.trim() || !data.html_template?.trim()) {
          const b = getBuiltinResidentInquiryEmailTemplate(emailLocale, editorTourKind)
          setSubjectTpl(b.subject)
          setBodyHtml(builtinResidentInquiryBodyHtml(emailLocale, editorTourKind))
          setTemplateEditorNonce((n) => n + 1)
          setSavedInDb(false)
          setTemplateNotice(t('residentInquiryTemplateLoadFailed'))
          return
        }
        setSubjectTpl(data.subject_template)
        setBodyHtml(
          extractResidentInquiryEmailBodyFromDocument(data.html_template, emailLocale, editorTourKind)
        )
        setTemplateEditorNonce((n) => n + 1)
        setSavedInDb(!!data.saved_in_db)
      } catch {
        if (!cancelled) {
          const b = getBuiltinResidentInquiryEmailTemplate(emailLocale, editorTourKind)
          setSubjectTpl(b.subject)
          setBodyHtml(builtinResidentInquiryBodyHtml(emailLocale, editorTourKind))
          setTemplateEditorNonce((n) => n + 1)
          setSavedInDb(false)
          setTemplateNotice(t('residentInquiryTemplateLoadFailed'))
        }
      } finally {
        if (!cancelled) setTemplateLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t stable; keys: isOpen, emailLocale, editorTourKind
  }, [isOpen, emailLocale, editorTourKind])

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
      residentCheckAbsoluteUrl: '',
      locale: emailLocale,
    })
  }, [customerName, tourDate, productName, channelRN, emailLocale, subjectTpl, mergedHtmlTpl])

  const handleCopyHtml = useCallback(async () => {
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
  }, [emailContent.html, uiLocale])

  const handleSaveTemplate = async () => {
    setSavingTemplate(true)
    setTemplateNotice(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const res = await fetch('/api/resident-inquiry-email-template', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale: emailLocale,
          tour_kind: editorTourKind,
          subject_template: subjectTpl,
          html_template: mergeResidentInquiryEmailDocumentFromBody(emailLocale, bodyHtml),
          updated_by: user?.email ?? null,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setTemplateNotice(data.error || t('residentInquiryTemplateSaveFailed'))
        return
      }
      setSavedInDb(true)
      setTemplateNotice(t('residentInquiryTemplateSaved'))
      setTimeout(() => setTemplateNotice(null), 3200)
    } catch {
      setTemplateNotice(t('residentInquiryTemplateSaveFailed'))
    } finally {
      setSavingTemplate(false)
    }
  }

  const handleResetTemplate = async () => {
    setResettingTemplate(true)
    setTemplateNotice(null)
    try {
      const tk = residentInquiryEmailTourKindToApiParam(editorTourKind)
      const res = await fetch(`/api/resident-inquiry-email-template?locale=${emailLocale}&tour_kind=${tk}`, {
        method: 'DELETE',
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setTemplateNotice(data.error || t('residentInquiryTemplateResetFailed'))
        return
      }
      const b = getBuiltinResidentInquiryEmailTemplate(emailLocale, editorTourKind)
      setSubjectTpl(b.subject)
      setBodyHtml(builtinResidentInquiryBodyHtml(emailLocale, editorTourKind))
      setTemplateEditorNonce((n) => n + 1)
      setSavedInDb(false)
    } catch {
      setTemplateNotice(t('residentInquiryTemplateResetFailed'))
    } finally {
      setResettingTemplate(false)
    }
  }

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

  const previewBlocked = templateLoading || !subjectTpl.trim()
  const canSendEmail = !!customerEmail.trim()

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4"
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
            onClick={handleCopyHtml}
            disabled={previewBlocked}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? t('residentInquiryCopied') : t('residentInquiryCopyHtml')}
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
          {editMode && (
            <>
              <button
                type="button"
                onClick={() => void handleSaveTemplate()}
                disabled={savingTemplate || previewBlocked}
                className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-800 hover:bg-teal-100 disabled:opacity-50"
              >
                {savingTemplate ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                {savingTemplate ? t('residentInquiryTemplateSaving') : t('residentInquirySaveTemplate')}
              </button>
              <button
                type="button"
                onClick={() => void handleResetTemplate()}
                disabled={resettingTemplate || previewBlocked}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
              >
                {resettingTemplate ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
                {t('residentInquiryResetTemplate')}
              </button>
            </>
          )}
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
          {templateNotice && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              {templateNotice}
            </div>
          )}

          {editMode && (
            <div className="mb-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs text-gray-600">{t('residentInquiryPlaceholderHint')}</p>
              <p className="text-xs text-gray-500">{t('residentInquiryTemplateShellNote')}</p>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  {t('residentInquiryTemplateBodyField')}
                </label>
                {templateLoading ? (
                  <div className="flex min-h-[260px] items-center justify-center rounded border border-gray-200 bg-white">
                    <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                  </div>
                ) : (
                  <ResidentInquiryEmailBodyRichEditor
                    key={templateEditorNonce}
                    value={bodyHtml}
                    onChange={setBodyHtml}
                    disabled={templateLoading}
                    uiLocale={uiLocale}
                  />
                )}
              </div>
            </div>
          )}

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
