'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { X, Eye, Loader2, Copy, Check, Pencil, Mail, MessageSquare } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import {
  extractPendingAltTourEmailBodyFromDocument,
  getBuiltinPendingAltTourTemplate,
  mergePendingAltTourEmailDocumentFromBody,
  pendingAltTourMessagePreviewParams,
  substitutePendingAltTourFullMessage,
  type PendingAltTourMessageChannel,
  type PendingAltTourMessageLocale,
} from '@/lib/pendingCustomerAltTourMessage'
import { defaultStaffOutreachTemplateName } from '@/lib/staffOutreachMessageTemplates'
import { resolveReservationEmailIsEnglish } from '@/lib/reservationEmailLocale'
import EmailPreviewBodyPanel from '@/components/reservation/EmailPreviewBodyPanel'
import StaffOutreachMessageTemplatePanel from '@/components/reservation/StaffOutreachMessageTemplatePanel'
import { useStaffOutreachMessageTemplates } from '@/hooks/useStaffOutreachMessageTemplates'

type PendingCustomerAltTourMessagePreviewModalProps = {
  isOpen: boolean
  onClose: () => void
  customerEmail?: string
  customerPhone?: string | null
  customerName: string
  customerLanguage: string | null | undefined
  tourDate: string | null | undefined
  productName: string
  channelRN: string | null | undefined
}

export function PendingCustomerAltTourMessagePreviewModal({
  isOpen,
  onClose,
  customerEmail = '',
  customerPhone = null,
  customerName,
  customerLanguage,
  tourDate,
  productName,
  channelRN,
}: PendingCustomerAltTourMessagePreviewModalProps) {
  const t = useTranslations('reservations.card')
  const uiLocale = useLocale()
  const [channel, setChannel] = useState<PendingAltTourMessageChannel>('email')
  const [copied, setCopied] = useState(false)
  const [editMode, setEditMode] = useState(false)

  const emailLocale: PendingAltTourMessageLocale = resolveReservationEmailIsEnglish(
    customerLanguage,
    null
  )
    ? 'en'
    : 'ko'

  const params = useMemo(
    () =>
      pendingAltTourMessagePreviewParams({
        customerName,
        tourDate,
        productName,
        channelRN,
        customerLanguage,
      }),
    [channelRN, customerLanguage, customerName, productName, tourDate]
  )

  const getBuiltin = useCallback(() => {
    const b = getBuiltinPendingAltTourTemplate(emailLocale, channel)
    return {
      name: defaultStaffOutreachTemplateName(emailLocale),
      subject: b.subject,
      body: b.body,
    }
  }, [emailLocale, channel])

  const prepareBodyForEditor = useCallback(
    (stored: string) =>
      channel === 'email'
        ? extractPendingAltTourEmailBodyFromDocument(stored, emailLocale)
        : stored,
    [channel, emailLocale]
  )

  const prepareBodyForSave = useCallback(
    (editor: string) =>
      channel === 'email' ? mergePendingAltTourEmailDocumentFromBody(emailLocale, editor) : editor,
    [channel, emailLocale]
  )

  const templateManager = useStaffOutreachMessageTemplates({
    scope: 'pending_alt_tour',
    locale: emailLocale,
    channel,
    variant: 'default',
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
    if (!isOpen) setEditMode(false)
  }, [isOpen])

  const bodyForSubstitute = useMemo(() => {
    if (channel !== 'email') return bodyTpl
    return mergePendingAltTourEmailDocumentFromBody(emailLocale, bodyTpl)
  }, [channel, emailLocale, bodyTpl])

  const messageContent = useMemo(
    () =>
      substitutePendingAltTourFullMessage(subjectTpl, bodyForSubstitute, channel, {
        ...params,
        locale: emailLocale,
      }),
    [subjectTpl, bodyForSubstitute, channel, params, emailLocale]
  )

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
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      try {
        await navigator.clipboard.writeText(
          channel === 'email' ? messageContent.plainText : messageContent.body
        )
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      } catch {
        alert(uiLocale === 'en' ? 'Failed to copy.' : '복사에 실패했습니다.')
      }
    }
  }, [channel, messageContent, uiLocale])

  if (!isOpen) return null

  const previewBlocked = templateLoading || !bodyTpl.trim()
  const phoneDisplay = customerPhone?.trim() || '—'

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
            <div>
              <h2 className="text-lg font-bold text-gray-900">{t('pendingAltTourPreviewTitle')}</h2>
              <p className="text-xs text-gray-500">{t('pendingAltTourPreviewSubtitle')}</p>
            </div>
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
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setChannel('email')}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                channel === 'email' ? 'bg-violet-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Mail className="h-3 w-3" />
              {t('cancelFollowUpChannelEmail')}
            </button>
            <button
              type="button"
              onClick={() => setChannel('sms')}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                channel === 'sms' ? 'bg-violet-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <MessageSquare className="h-3 w-3" />
              {t('cancelFollowUpChannelSms')}
            </button>
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
            placeholderHint={t('pendingAltTourPlaceholderHint')}
            {...(channel === 'email' ? { shellNote: t('pendingAltTourTemplateShellNote') } : {})}
            accentClass="violet"
            templateManager={templateManager}
          />

          <div className="mb-4 space-y-1 rounded-lg border border-violet-100 bg-violet-50/80 p-3 text-sm text-gray-800">
            {channel === 'email' && (
              <div>
                <span className="font-semibold text-gray-600">{t('cancelFollowUpToEmail')}:</span>{' '}
                <span className="break-all">{customerEmail || '—'}</span>
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
              <pre className="whitespace-pre-wrap break-words font-sans text-sm text-gray-900">
                {messageContent.plainText}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
