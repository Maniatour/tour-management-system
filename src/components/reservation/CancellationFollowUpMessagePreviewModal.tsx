'use client'

import React, { useMemo, useState, useCallback, useEffect } from 'react'
import { X, Eye, Loader2, Copy, Check, Pencil, RotateCcw, Mail, MessageSquare } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import {
  builtinCancellationFollowUpEmailBodyHtml,
  extractCancellationFollowUpEmailBodyFromDocument,
  getBuiltinCancellationFollowUpTemplate,
  mergeCancellationFollowUpEmailDocumentFromBody,
  substituteCancellationFollowUpMessageTemplate,
  type CancellationFollowUpMessageChannel,
  type CancellationFollowUpMessageKind,
  type CancellationFollowUpMessageLocale,
} from '@/lib/cancellationFollowUpMessage'
import { resolveReservationEmailIsEnglish } from '@/lib/reservationEmailLocale'
import { supabase } from '@/lib/supabase'
import ResidentInquiryEmailBodyRichEditor from '@/components/reservation/ResidentInquiryEmailBodyRichEditor'
import EmailPreviewBodyPanel from '@/components/reservation/EmailPreviewBodyPanel'

export interface CancellationFollowUpMessagePreviewModalProps {
  isOpen: boolean
  onClose: () => void
  reservationId: string
  customerEmail: string
  customerPhone?: string | null
  customerName: string
  customerLanguage: string | null | undefined
  tourDate: string | null | undefined
  productName: string
  channelRN: string | null | undefined
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
  productName,
  channelRN,
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

  const [channel, setChannel] = useState<CancellationFollowUpMessageChannel>('email')
  const [messageKind, setMessageKind] = useState<CancellationFollowUpMessageKind>(initialMessageKind)

  useEffect(() => {
    if (isOpen) setMessageKind(initialMessageKind)
  }, [isOpen, initialMessageKind])

  const [subjectTpl, setSubjectTpl] = useState('')
  const [bodyTpl, setBodyTpl] = useState('')
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
        const res = await fetch(
          `/api/cancellation-follow-up-message-template?locale=${emailLocale}&channel=${channel}&message_kind=${messageKind}`
        )
        const data = (await res.json()) as {
          subject_template?: string
          body_template?: string
          saved_in_db?: boolean
        }
        if (cancelled) return
        if (!res.ok || !data.body_template?.trim()) {
          const b = getBuiltinCancellationFollowUpTemplate(emailLocale, channel, messageKind)
          setSubjectTpl(b.subject)
          if (channel === 'email') {
            setBodyTpl(
              extractCancellationFollowUpEmailBodyFromDocument(b.body, emailLocale, messageKind)
            )
          } else {
            setBodyTpl(b.body)
          }
          setTemplateEditorNonce((n) => n + 1)
          setSavedInDb(false)
          setTemplateNotice(t('cancelFollowUpTemplateLoadFailed'))
          return
        }
        setSubjectTpl(data.subject_template ?? '')
        if (channel === 'email') {
          setBodyTpl(
            extractCancellationFollowUpEmailBodyFromDocument(
              data.body_template,
              emailLocale,
              messageKind
            )
          )
        } else {
          setBodyTpl(data.body_template)
        }
        setTemplateEditorNonce((n) => n + 1)
        setSavedInDb(!!data.saved_in_db)
      } catch {
        if (!cancelled) {
          const b = getBuiltinCancellationFollowUpTemplate(emailLocale, channel, messageKind)
          setSubjectTpl(b.subject)
          if (channel === 'email') {
            setBodyTpl(
              extractCancellationFollowUpEmailBodyFromDocument(b.body, emailLocale, messageKind)
            )
          } else {
            setBodyTpl(b.body)
          }
          setTemplateEditorNonce((n) => n + 1)
          setSavedInDb(false)
          setTemplateNotice(t('cancelFollowUpTemplateLoadFailed'))
        }
      } finally {
        if (!cancelled) setTemplateLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t stable
  }, [isOpen, emailLocale, channel, messageKind])

  const mergedEmailHtmlTpl = useMemo(() => {
    if (channel !== 'email') return bodyTpl
    return mergeCancellationFollowUpEmailDocumentFromBody(emailLocale, bodyTpl)
  }, [channel, emailLocale, bodyTpl])

  const bodyForSubstitute = channel === 'email' ? mergedEmailHtmlTpl : bodyTpl

  const messageContent = useMemo(() => {
    return substituteCancellationFollowUpMessageTemplate(subjectTpl, bodyForSubstitute, channel, {
      customerName,
      tourDate,
      productName,
      channelReference: channelRN ?? null,
      locale: emailLocale,
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

  const handleSaveTemplate = async () => {
    setSavingTemplate(true)
    setTemplateNotice(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const bodyToSave =
        channel === 'email'
          ? mergeCancellationFollowUpEmailDocumentFromBody(emailLocale, bodyTpl)
          : bodyTpl
      const res = await fetch('/api/cancellation-follow-up-message-template', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale: emailLocale,
          channel,
          message_kind: messageKind,
          subject_template: channel === 'email' ? subjectTpl : null,
          body_template: bodyToSave,
          updated_by: user?.email ?? null,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setTemplateNotice(data.error || t('cancelFollowUpTemplateSaveFailed'))
        return
      }
      setSavedInDb(true)
      setTemplateNotice(t('cancelFollowUpTemplateSaved'))
      setTimeout(() => setTemplateNotice(null), 3200)
    } catch {
      setTemplateNotice(t('cancelFollowUpTemplateSaveFailed'))
    } finally {
      setSavingTemplate(false)
    }
  }

  const handleResetTemplate = async () => {
    setResettingTemplate(true)
    setTemplateNotice(null)
    try {
      const res = await fetch(
        `/api/cancellation-follow-up-message-template?locale=${emailLocale}&channel=${channel}&message_kind=${messageKind}`,
        { method: 'DELETE' }
      )
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setTemplateNotice(data.error || t('cancelFollowUpTemplateResetFailed'))
        return
      }
      const b = getBuiltinCancellationFollowUpTemplate(emailLocale, channel, messageKind)
      setSubjectTpl(b.subject)
      if (channel === 'email') {
        setBodyTpl(builtinCancellationFollowUpEmailBodyHtml(emailLocale, messageKind))
      } else {
        setBodyTpl(b.body)
      }
      setTemplateEditorNonce((n) => n + 1)
      setSavedInDb(false)
      setTemplateNotice(t('cancelFollowUpTemplateResetDone'))
      setTimeout(() => setTemplateNotice(null), 3200)
    } catch {
      setTemplateNotice(t('cancelFollowUpTemplateResetFailed'))
    } finally {
      setResettingTemplate(false)
    }
  }

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
          {editMode && (
            <>
              <button
                type="button"
                onClick={() => void handleSaveTemplate()}
                disabled={savingTemplate || previewBlocked}
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-100 disabled:opacity-50"
              >
                {savingTemplate ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                {savingTemplate ? t('cancelFollowUpTemplateSaving') : t('cancelFollowUpSaveTemplate')}
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
                {t('cancelFollowUpResetTemplate')}
              </button>
            </>
          )}
          <span
            className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              savedInDb ? 'bg-violet-100 text-violet-800' : 'bg-gray-200 text-gray-700'
            }`}
          >
            {savedInDb ? t('cancelFollowUpSavedTemplateBadge') : t('cancelFollowUpBuiltinTemplateBadge')}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {templateNotice && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              {templateNotice}
            </div>
          )}

          {editMode && (
            <div className="mb-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs text-gray-600">{t('cancelFollowUpPlaceholderHint')}</p>
              {channel === 'email' && (
                <p className="text-xs text-gray-500">{t('cancelFollowUpTemplateShellNote')}</p>
              )}
              {channel === 'email' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    {t('cancelFollowUpTemplateSubjectField')}
                  </label>
                  <input
                    type="text"
                    value={subjectTpl}
                    onChange={(e) => setSubjectTpl(e.target.value)}
                    disabled={templateLoading}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  {channel === 'email'
                    ? t('cancelFollowUpTemplateBodyField')
                    : t('cancelFollowUpTemplateSmsField')}
                </label>
                {templateLoading ? (
                  <div className="flex min-h-[200px] items-center justify-center rounded border border-gray-200 bg-white">
                    <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
                  </div>
                ) : channel === 'email' ? (
                  <ResidentInquiryEmailBodyRichEditor
                    key={templateEditorNonce}
                    value={bodyTpl}
                    onChange={setBodyTpl}
                    disabled={templateLoading}
                    uiLocale={uiLocale}
                  />
                ) : (
                  <textarea
                    key={templateEditorNonce}
                    value={bodyTpl}
                    onChange={(e) => setBodyTpl(e.target.value)}
                    rows={6}
                    disabled={templateLoading}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-transparent focus:ring-2 focus:ring-violet-500"
                  />
                )}
              </div>
            </div>
          )}

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
