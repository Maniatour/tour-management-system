'use client'

import React, { useMemo, useState, useCallback } from 'react'
import { X, Eye, Loader2, Send, Copy, Check } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import {
  buildResidentInquiryEmail,
  type ResidentInquiryEmailLocale,
} from '@/lib/residentInquiryEmailHtml'
import { resolveReservationEmailIsEnglish } from '@/lib/reservationEmailLocale'

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
  onSend,
}: ResidentInquiryEmailPreviewModalProps) {
  const t = useTranslations('reservations.card')
  const uiLocale = useLocale()
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)

  const emailLocale: ResidentInquiryEmailLocale = resolveReservationEmailIsEnglish(
    customerLanguage,
    null
  )
    ? 'en'
    : 'ko'

  const emailContent = useMemo(() => {
    return buildResidentInquiryEmail({
      customerName,
      tourDate,
      productName,
      channelReference: channelRN ?? null,
      residentCheckAbsoluteUrl: '',
      locale: emailLocale,
    })
  }, [customerName, tourDate, productName, channelRN, emailLocale])

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

        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2">
          <button
            type="button"
            onClick={handleCopyHtml}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? t('residentInquiryCopied') : t('residentInquiryCopyHtml')}
          </button>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {sending ? t('residentInquirySending') : t('residentInquirySend')}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-4 space-y-1 rounded-lg border border-teal-100 bg-teal-50/80 p-3 text-sm text-gray-800">
            <div>
              <span className="font-semibold text-gray-600">{t('residentInquiryTo')}:</span>{' '}
              <span className="break-all">{customerEmail}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-600">{t('residentInquirySubject')}:</span>{' '}
              {emailContent.subject}
            </div>
            <div className="text-xs text-gray-500">
              {t('residentInquiryReservationId')}: {reservationId}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600">
              {t('residentInquiryPreviewBody')}
            </div>
            <div
              className="email-preview-body-host max-h-[min(55vh,520px)] overflow-auto p-3"
              dangerouslySetInnerHTML={{ __html: emailContent.html }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
