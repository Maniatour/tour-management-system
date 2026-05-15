'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { X, Eye, Loader2, Copy, Check, Share2, Link2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

export interface TourChatRoomEmailPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  reservationId: string
  tourDate?: string | null
  tourId?: string | null
}

export default function TourChatRoomEmailPreviewModal({
  isOpen,
  onClose,
  reservationId,
  tourDate,
  tourId,
}: TourChatRoomEmailPreviewModalProps) {
  const t = useTranslations('reservations.card')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailContent, setEmailContent] = useState<{
    subject: string
    html: string
    chatUrl: string
    chatRoomCode: string
  } | null>(null)
  const previewBodyRef = useRef<HTMLDivElement>(null)

  const loadPreview = useCallback(async () => {
    if (!isOpen || !reservationId) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/preview-tour-chat-room-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId,
          tourDate: tourDate ?? null,
          tourId: tourId ?? null,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : t('tourChatRoomPreviewLoadFailed'))
      }
      setEmailContent({
        subject: data.subject,
        html: data.html,
        chatUrl: data.chatUrl,
        chatRoomCode: data.chatRoomCode,
      })
    } catch (err) {
      setEmailContent(null)
      setError(err instanceof Error ? err.message : t('tourChatRoomPreviewLoadFailed'))
    } finally {
      setLoading(false)
    }
  }, [isOpen, reservationId, tourDate, tourId, t])

  useEffect(() => {
    if (isOpen) {
      void loadPreview()
    } else {
      setEmailContent(null)
      setError(null)
      setCopied(false)
      setLinkCopied(false)
    }
  }, [isOpen, loadPreview])

  const handleCopyHtml = async () => {
    if (!emailContent) return
    try {
      const htmlBlob = new Blob([emailContent.html], { type: 'text/html' })
      const textBlob = new Blob([emailContent.html], { type: 'text/plain' })
      const clipboardItem = new ClipboardItem({
        'text/html': htmlBlob,
        'text/plain': textBlob,
      })
      await navigator.clipboard.write([clipboardItem])
      setCopied(true)
      setLinkCopied(false)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      try {
        await navigator.clipboard.writeText(emailContent.html)
        setCopied(true)
        setLinkCopied(false)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        alert(t('tourChatRoomCopyFailed'))
      }
    }
  }

  const handleCopyLink = async () => {
    if (!emailContent?.chatUrl) return
    try {
      await navigator.clipboard.writeText(emailContent.chatUrl)
      setLinkCopied(true)
      setCopied(false)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch {
      alert(t('tourChatRoomCopyFailed'))
    }
  }

  const handleShareLink = async () => {
    if (!emailContent?.chatUrl) return
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: emailContent.subject || 'Tour Chat',
          url: emailContent.chatUrl,
        })
      } catch (err: unknown) {
        const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: string }).name) : ''
        if (name === 'AbortError') return
        await handleCopyLink()
      }
    } else {
      await handleCopyLink()
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-gray-900">{t('tourChatRoomPreviewTitle')}</h2>
            {emailContent?.chatUrl ? (
              <p className="truncate text-xs text-gray-500">{emailContent.chatUrl}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label={t('close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-2">
          <button
            type="button"
            onClick={() => void loadPreview()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
            {t('tourChatRoomRefreshPreview')}
          </button>
          <button
            type="button"
            onClick={() => void handleCopyHtml()}
            disabled={!emailContent || loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-800 hover:bg-teal-100 disabled:opacity-50"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? t('tourChatRoomCopied') : t('tourChatRoomCopyHtml')}
          </button>
          <button
            type="button"
            onClick={() => void handleCopyLink()}
            disabled={!emailContent || loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          >
            {linkCopied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
            {linkCopied ? t('tourChatRoomLinkCopied') : t('tourChatRoomCopyLink')}
          </button>
          <button
            type="button"
            onClick={() => void handleShareLink()}
            disabled={!emailContent || loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          >
            <Share2 className="h-3.5 w-3.5" />
            {t('tourChatRoomShare')}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-gray-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t('tourChatRoomPreviewLoading')}
            </div>
          ) : error ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {error}
            </div>
          ) : emailContent ? (
            <div
              ref={previewBodyRef}
              className="email-preview-body-host rounded-lg border border-gray-200 bg-white p-4"
              dangerouslySetInnerHTML={{ __html: emailContent.html }}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
